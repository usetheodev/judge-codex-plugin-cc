---
description: Run Codex as orthogonal judge on a `/discover-plan` blueprint
argument-hint: '<slug> [--wait|--background]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), AskUserQuestion
---

# `/judge-codex:discover`

Submits the blueprint at `knowledge-base/discoveries/blueprints/<slug>-blueprint.md` to **Codex** as an orthogonal LLM jury, validated against `rules/discover-blueprint-golden-rule.md`.

## What Codex evaluates

| Check | Source of truth |
|---|---|
| ≥2-source evidence per major claim | `feedback_never_single_source_evidence` (unbreakable rule, propagated from `plan` memory) |
| `fabricated_citation` (file refs, blueprint sections, ADRs, Unbreakable Rules) | `discover-blueprint-golden-rule.md § hard caps` |
| `empty_research_question` | same |
| `empty_coverage_corner` | same |
| Cross-cutting comparison rigor (each axis has ≥2 source rows) | `cycle-discover.md § Phase contracts` |
| Acceptable-disagreement honesty (disagreements surfaced, not hidden) | `feedback_never_single_source_evidence § How to apply` |

## Output

Structured JSON validated against `schemas/discover-judge-output.schema.json`. Persisted to:

```
knowledge-base/judge-codex/<slug>-discover-judge-<date>.json
```

Verdict enum: `SHIPPABLE` / `SHIPPABLE_WITH_CAVEATS` / `NEEDS_REVISION` / `FAIL_SOFT` / `FAIL_HARD` / `INVALID`.

## Argument handling

- `<slug>` is mandatory (no positional fallback — be explicit per `plan` discipline).
- `--wait` / `--background` map to foreground / background execution; if absent, the command estimates blueprint size and recommends one.

## Foreground

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion-judge.mjs" judge \
  --stage discover \
  --slug "$1" \
  $REMAINDER
```

Return Codex stdout verbatim — do not paraphrase, summarize, or rewrite.

## Background

```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion-judge.mjs" judge --stage discover --slug "$1" --background`,
  description: "judge-codex discover review",
  run_in_background: true
})
```

After launch: "judge-codex started. Check `/judge-codex:status` for progress."

## Refuse to run when

- Slug omitted.
- `knowledge-base/discoveries/blueprints/<slug>-blueprint.md` not found.
- `codex` CLI absent (run `/judge-codex:setup` first).
