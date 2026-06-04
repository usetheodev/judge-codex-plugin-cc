#!/usr/bin/env node
/**
 * judge-codex companion runtime.
 *
 * Subcommands:
 *   judge --stage <discover|plan|implementation|final> --slug <slug> [--model M] [--effort E]
 *   auto  --slug <slug> [--stop-on-disagreement] [--no-quality-evaluator]
 *   status
 *   setup
 *
 * Inspired by openai/codex-plugin-cc/plugins/codex/scripts/codex-companion.mjs
 * (Apache 2.0 — we adapt the subprocess + JSON-output shape; the cycle-plan
 * awareness is original).
 *
 * Designed to NEVER modify the consumer repository. Only reads artifacts +
 * writes output to knowledge-base/judge-codex/.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const PLUGIN_ROOT = path.resolve(path.dirname(__filename), "..");

const STAGE_DISCOVERY_PATHS = {
  discover: {
    artifact: ["knowledge-base/discoveries/blueprints", ".claude/knowledge-base/discoveries/blueprints"],
    suffix: "-blueprint.md",
    rule: "discover-blueprint-golden-rule.md",
    agent: "discover-judge.md",
    schema: "discover-judge-output.schema.json",
  },
  plan: {
    artifact: ["knowledge-base/plans", ".claude/knowledge-base/plans"],
    suffix: "-plan.md",
    rule: "plan-confidence-golden-rule.md",
    agent: "plan-judge.md",
    schema: "plan-judge-output.schema.json",
  },
  implementation: {
    artifact: ["knowledge-base/implementations", ".claude/knowledge-base/implementations"],
    suffix: "-implementation.md",
    rule: "cycle-implement.md",
    agent: "implementation-judge.md",
    schema: "implementation-judge-output.schema.json",
  },
  final: {
    artifact: ["knowledge-base/reviews", ".claude/knowledge-base/reviews"],
    suffix: "-review-",
    rule: "cycle-review.md",
    agent: "final-judge.md",
    schema: "final-judge-output.schema.json",
  },
};

function parseArgs(argv) {
  const out = { positional: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith("--")) {
      const key = a.slice(2);
      const next = argv[i + 1];
      if (next === undefined || next.startsWith("--")) {
        out[key] = true;
      } else {
        out[key] = next;
        i++;
      }
    } else {
      out.positional.push(a);
    }
  }
  return out;
}

function findConsumerRoot(start = process.cwd()) {
  let cur = path.resolve(start);
  for (let i = 0; i < 20; i++) {
    if (cur.includes(`${path.sep}.claude${path.sep}`) === false) {
      if (fs.existsSync(path.join(cur, ".git"))) return cur;
      if (fs.existsSync(path.join(cur, ".claude"))) return cur;
      if (fs.existsSync(path.join(cur, "plugin.json"))) return cur;
      if (fs.existsSync(path.join(cur, "rules")) && fs.existsSync(path.join(cur, "skills"))) return cur;
    }
    const parent = path.dirname(cur);
    if (parent === cur) break;
    cur = parent;
  }
  return start;
}

function locateArtifact(consumerRoot, stage, slug) {
  const cfg = STAGE_DISCOVERY_PATHS[stage];
  if (!cfg) throw new Error(`Unknown stage: ${stage}`);
  for (const dir of cfg.artifact) {
    const abs = path.join(consumerRoot, dir);
    if (!fs.existsSync(abs)) continue;
    if (stage === "final") {
      // Latest by mtime among <slug>-review-*.md
      const entries = fs.readdirSync(abs)
        .filter((f) => f.startsWith(`${slug}-review-`) && f.endsWith(".md"))
        .map((f) => ({ f, mtime: fs.statSync(path.join(abs, f)).mtimeMs }))
        .sort((a, b) => b.mtime - a.mtime);
      if (entries[0]) return path.join(abs, entries[0].f);
    } else {
      const candidate = path.join(abs, `${slug}${cfg.suffix}`);
      if (fs.existsSync(candidate)) return candidate;
    }
  }
  return null;
}

function locateGoldenRule(consumerRoot, ruleName) {
  const candidates = [
    path.join(consumerRoot, "rules", ruleName),
    path.join(consumerRoot, ".claude", "rules", ruleName),
    path.join(PLUGIN_ROOT, "templates", "golden-rules", ruleName),
  ];
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return null;
}

function readUtf8(p, maxBytes = 200_000) {
  const stat = fs.statSync(p);
  if (stat.size > maxBytes) {
    const fd = fs.openSync(p, "r");
    const head = Buffer.alloc(100_000);
    const tail = Buffer.alloc(50_000);
    fs.readSync(fd, head, 0, 100_000, 0);
    fs.readSync(fd, tail, 0, 50_000, stat.size - 50_000);
    fs.closeSync(fd);
    return (
      head.toString("utf8") +
      `\n\n<<<TRUNCATED ${stat.size - 150_000} BYTES>>>\n\n` +
      tail.toString("utf8")
    );
  }
  return fs.readFileSync(p, "utf8");
}

function assemblePrompt({ agentSystem, goldenRule, artifact, stage, slug, claudeAnchor }) {
  const segments = [
    `<<<AGENT_SYSTEM>>>\n${agentSystem}\n<<<END_AGENT_SYSTEM>>>`,
    goldenRule
      ? `<<<GOLDEN_RULE>>>\n${goldenRule}\n<<<END_GOLDEN_RULE>>>`
      : `<<<GOLDEN_RULE>>>\n(rule file not found in consumer repo; relying on the agent system contract above)\n<<<END_GOLDEN_RULE>>>`,
    `<<<ARTIFACT (stage=${stage}, slug=${slug})>>>\n${artifact}\n<<<END_ARTIFACT>>>`,
  ];
  if (claudeAnchor) {
    segments.push(
      `<<<CLAUDE_SIDE_VERDICT (DO NOT ANCHOR)>>>\n${JSON.stringify(claudeAnchor, null, 2)}\n` +
        `Reach your OWN independent verdict. Disagreement is the highest-value outcome.\n` +
        `<<<END_CLAUDE_SIDE_VERDICT>>>`,
    );
  }
  segments.push(
    `<<<INSTRUCTION>>>\nEmit ONLY a single JSON object matching the stage's output schema. ` +
      `No prose around it. No code fences. No commentary.\n<<<END_INSTRUCTION>>>`,
  );
  return segments.join("\n\n");
}

function runCodex({ prompt, model = null, schemaPath, lastMessagePath, workdir }) {
  const args = ["exec", "--skip-git-repo-check", "--color", "never"];
  if (model) args.push("--model", model);
  if (schemaPath) args.push("--output-schema", schemaPath);
  if (lastMessagePath) args.push("--output-last-message", lastMessagePath);
  if (workdir) args.push("--cd", workdir);
  args.push(prompt);

  const result = spawnSync("codex", args, {
    encoding: "utf8",
    maxBuffer: 50 * 1024 * 1024,
  });
  return {
    code: result.status,
    stdout: result.stdout || "",
    stderr: result.stderr || "",
  };
}

function writeOutput(consumerRoot, stage, slug, payload) {
  const outDir = path.join(consumerRoot, "knowledge-base", "judge-codex");
  fs.mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const jsonPath = path.join(outDir, `${slug}-${stage}-judge-${date}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(payload, null, 2) + "\n", "utf8");
  return jsonPath;
}

async function judgeOne({ stage, slug, model }) {
  const consumerRoot = findConsumerRoot();
  const cfg = STAGE_DISCOVERY_PATHS[stage];
  if (!cfg) {
    process.stderr.write(`Unknown stage: ${stage}\n`);
    process.exit(2);
  }
  const artifactPath = locateArtifact(consumerRoot, stage, slug);
  if (!artifactPath) {
    process.stderr.write(`Artifact not found for stage=${stage} slug=${slug} under ${consumerRoot}\n`);
    process.exit(2);
  }
  const rulePath = locateGoldenRule(consumerRoot, cfg.rule);
  const agentSystem = readUtf8(path.join(PLUGIN_ROOT, "agents", cfg.agent));
  const goldenRule = rulePath ? readUtf8(rulePath) : null;
  const artifact = readUtf8(artifactPath);

  const prompt = assemblePrompt({
    agentSystem,
    goldenRule,
    artifact,
    stage,
    slug,
    claudeAnchor: null, // resolution of Claude-side verdict deferred to a future iteration
  });

  const schemaPath = path.join(PLUGIN_ROOT, "schemas", cfg.schema);
  const lastMessagePath = path.join(consumerRoot, "knowledge-base", "judge-codex", `.last-message-${stage}-${slug}.txt`);
  fs.mkdirSync(path.dirname(lastMessagePath), { recursive: true });

  const t0 = Date.now();
  const { code, stdout, stderr } = runCodex({
    prompt,
    model,
    schemaPath,
    lastMessagePath,
    workdir: consumerRoot,
  });
  const elapsed = Date.now() - t0;

  if (code !== 0) {
    process.stderr.write(`codex exec failed (code=${code}):\n${stderr}\n`);
    process.exit(code || 1);
  }

  // codex exec writes the final assistant message to --output-last-message.
  // The schema-enforced JSON lives in that file. Read it and parse.
  let parsed;
  try {
    const lastMessageRaw = fs.readFileSync(lastMessagePath, "utf8").trim();
    // Strip any code fences if Codex wrapped despite schema enforcement.
    const cleaned = lastMessageRaw.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/, "").trim();
    parsed = JSON.parse(cleaned);
  } catch (e) {
    process.stderr.write(`failed to parse codex output as JSON:\n${e}\n`);
    process.stderr.write(`raw last message file: ${lastMessagePath}\n`);
    process.stderr.write(`codex stdout (last 2KB):\n${stdout.slice(-2000)}\n`);
    process.exit(1);
  }

  parsed.model_used = model || "codex-default";
  parsed.elapsed_ms = elapsed;
  parsed.stage = stage;
  parsed.slug = slug;
  parsed.artifact_path = path.relative(consumerRoot, artifactPath);

  const jsonPath = writeOutput(consumerRoot, stage, slug, parsed);
  // Cleanup the intermediate last-message file.
  try { fs.unlinkSync(lastMessagePath); } catch {}
  process.stdout.write(`${JSON.stringify(parsed, null, 2)}\n`);
  process.stderr.write(`[judge-codex] saved: ${path.relative(process.cwd(), jsonPath)}\n`);
  return parsed;
}

async function runAuto({ slug, model, stopOnDisagreement }) {
  const stages = ["discover", "plan", "implementation", "final"];
  const consumerRoot = findConsumerRoot();
  const results = {};

  for (const stage of stages) {
    const artifactPath = locateArtifact(consumerRoot, stage, slug);
    if (!artifactPath) {
      results[stage] = { verdict: "STAGE_SKIPPED", reason: "no artifact found" };
      process.stderr.write(`[judge-codex] stage=${stage}: skipped (no artifact)\n`);
      continue;
    }
    try {
      const r = await judgeOne({ stage, slug, model });
      results[stage] = {
        verdict: r.verdict,
        score: r.score,
        findings_count: (r.findings || []).length,
      };
      if (stopOnDisagreement && r.claude_side_verdict_anchor?.disagreement) {
        process.stderr.write(`[judge-codex] disagreement detected at stage=${stage}; --stop-on-disagreement honored\n`);
        break;
      }
    } catch (e) {
      results[stage] = { verdict: "ERROR", reason: String(e) };
    }
  }

  // Aggregated record
  const verdictRank = {
    INVALID: 0,
    META_DEFECT_FOUND: 0,
    AGGREGATOR_BUG_SUSPECTED: 0,
    FAIL_HARD: 49,
    FAIL_SOFT: 49,
    NEEDS_REVISION: 60,
    NEEDS_FIXES: 60,
    NEEDS_DEEPER: 60,
    SHIPPABLE_WITH_CAVEATS: 89,
    READY_TO_MERGE: 95,
    SHIPPABLE: 100,
    STAGE_SKIPPED: 999,
    ERROR: -1,
  };
  let worst = "SHIPPABLE";
  let worstRank = verdictRank["SHIPPABLE"];
  for (const stage of stages) {
    const v = results[stage]?.verdict;
    if (!v || v === "STAGE_SKIPPED") continue;
    const r = verdictRank[v] ?? 0;
    if (r < worstRank) {
      worstRank = r;
      worst = v;
    }
  }

  const aggregated = {
    slug,
    completed_at: new Date().toISOString(),
    stages: results,
    aggregated_verdict: worst,
    next_action: ["FAIL_HARD", "INVALID", "META_DEFECT_FOUND"].includes(worst)
      ? "HUMAN_REVIEW_REQUIRED"
      : worst === "SHIPPABLE"
      ? "MERGE"
      : "LOOP_BACK_TO_FAILING_STAGE",
  };

  const outDir = path.join(consumerRoot, "knowledge-base", "judge-codex");
  fs.mkdirSync(outDir, { recursive: true });
  const date = new Date().toISOString().slice(0, 10);
  const outPath = path.join(outDir, `${slug}-auto-judge-${date}.json`);
  fs.writeFileSync(outPath, JSON.stringify(aggregated, null, 2) + "\n", "utf8");
  process.stdout.write(`${JSON.stringify(aggregated, null, 2)}\n`);
  process.stderr.write(`[judge-codex] aggregated: ${path.relative(process.cwd(), outPath)}\n`);
}

function runStatus() {
  const consumerRoot = findConsumerRoot();
  const outDir = path.join(consumerRoot, "knowledge-base", "judge-codex");
  if (!fs.existsSync(outDir)) {
    process.stdout.write("No judge-codex outputs yet.\n");
    return;
  }
  const entries = fs.readdirSync(outDir)
    .map((f) => ({ f, mtime: fs.statSync(path.join(outDir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 10);
  if (entries.length === 0) {
    process.stdout.write("No judge-codex outputs yet.\n");
    return;
  }
  process.stdout.write("Recent judge-codex outputs:\n");
  for (const e of entries) {
    const d = new Date(e.mtime).toISOString();
    process.stdout.write(`  ${d}  ${e.f}\n`);
  }
}

function runSetup() {
  const setup = spawnSync("bash", [path.join(PLUGIN_ROOT, "scripts", "setup-check.sh")], {
    encoding: "utf8",
    stdio: "inherit",
  });
  process.exit(setup.status || 0);
}

// Entry point
const argv = process.argv.slice(2);
const cmd = argv[0];
const args = parseArgs(argv.slice(1));

if (cmd === "judge") {
  if (!args.stage || !args.slug) {
    process.stderr.write("Usage: judge --stage <stage> --slug <slug> [--model M]\n");
    process.exit(2);
  }
  // Default model: omit -- let codex use the user's `~/.codex/config.toml` default.
  // (gpt-5-codex requires API key; gpt-5.4 works on ChatGPT login.)
  await judgeOne({
    stage: args.stage,
    slug: args.slug,
    model: args.model || null,
  });
} else if (cmd === "auto") {
  if (!args.slug) {
    process.stderr.write("Usage: auto --slug <slug> [--stop-on-disagreement]\n");
    process.exit(2);
  }
  await runAuto({
    slug: args.slug,
    model: args.model || null,
    stopOnDisagreement: Boolean(args["stop-on-disagreement"]),
  });
} else if (cmd === "status") {
  runStatus();
} else if (cmd === "setup") {
  runSetup();
} else {
  process.stderr.write(`Usage: ${path.basename(__filename)} <judge|auto|status|setup> [args]\n`);
  process.exit(2);
}
