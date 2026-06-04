---
name: judge-prompting
description: Internal prompting contract for assembling the Codex judge prompt. Used by the companion script to template the system + golden-rule + artifact bundle.
user-invocable: false
---

# judge-prompting

How the companion script assembles the prompt fed to `codex exec`.

## Template (compose 4 segments, in order)

```
<segment 1: agent system prompt — read from ${CLAUDE_PLUGIN_ROOT}/agents/<stage>-judge.md>

<segment 2: golden-rule contract — read from CONSUMER_REPO/rules/<rule>.md OR ${CLAUDE_PLUGIN_ROOT}/templates/golden-rules/<rule>.md fallback>

<segment 3: artifact to judge — read from CONSUMER_REPO/knowledge-base/<dir>/<slug>-<stage>.md>

<segment 4: stage-specific instructions:>
You are judging stage "<stage>" of slug "<slug>". Read the golden-rule above, then the artifact, then emit ONLY a JSON object matching schemas/<stage>-judge-output.schema.json. No prose around the JSON. No code fences around the JSON.
```

## Rules for the assembled prompt

- The system / golden-rule / artifact MUST be quoted with clear delimiters (e.g., `<<<AGENT_SYSTEM>>>`, `<<<GOLDEN_RULE>>>`, `<<<ARTIFACT>>>`).
- The artifact is included VERBATIM. No summarization, no truncation unless artifact > 200KB (in which case the companion logs a warning and truncates the prose body — never the headers).
- The instruction at segment 4 ALWAYS includes "emit ONLY JSON" — Codex is reliable about following structured-output requests when the contract is explicit.

## Per-stage rule files used

| Stage | Primary rule | Fallback (in plugin) |
|---|---|---|
| `discover` | `rules/discover-blueprint-golden-rule.md` | `templates/golden-rules/discover-blueprint-golden-rule.md` |
| `plan` | `rules/plan-confidence-golden-rule.md` | `templates/golden-rules/plan-confidence-golden-rule.md` |
| `implementation` | `rules/cycle-implement.md` + `rules/code-quality-golden-rule.md` | both fallbacks |
| `final` | `rules/cycle-review.md` | `templates/golden-rules/cycle-review.md` |

## Schemas referenced in the prompt

| Stage | Output schema |
|---|---|
| `discover` | `schemas/discover-judge-output.schema.json` |
| `plan` | `schemas/plan-judge-output.schema.json` |
| `implementation` | `schemas/implementation-judge-output.schema.json` |
| `final` | `schemas/final-judge-output.schema.json` |

## Cross-validation prompt elements (per-stage)

The instruction segment 4 also embeds the Claude-side verdict if it exists (for disagreement detection downstream):

```
Note: the Claude-side equivalent gate (`/plan-confidence`, `/review`, etc.) reached this verdict on this artifact:
  verdict: <V>
  score: <N>
  hard_caps_triggered: [...]

You MUST reach your own independent verdict. Do not anchor on the Claude-side result. Disagreement is the highest-value outcome.
```

This explicit anti-anchoring instruction is critical — without it, Codex tends to agree with the upstream verdict (sycophancy / mode-matching).

## Token budget

- Default: no limit beyond Codex CLI's defaults.
- For artifacts > 50KB: the companion adds `--effort high` automatically.
- For artifacts > 200KB: artifact truncated to first 100KB + last 50KB with a `<<<TRUNCATED N BYTES>>>` marker.
