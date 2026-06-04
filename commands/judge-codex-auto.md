---
description: Run all 4 judge stages sequentially against a slice
argument-hint: '<slug> [--background] [--stop-on-disagreement]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

# `/judge-codex:auto`

End-to-end orthogonal review. Runs the 4 stage judges sequentially against artifacts produced by a single slice, then emits an aggregated verdict.

## Sequence

```
/judge-codex:discover       <slug>   (if blueprint exists at knowledge-base/discoveries/blueprints/)
/judge-codex:plan           <slug>   (always — every slice has a plan)
/judge-codex:implementation <slug>   (if knowledge-base/implementations/<slug>-implementation.md exists)
/judge-codex:final          <slug>   (if knowledge-base/reviews/<slug>-review-*.md exists)
```

Each stage is mandatory IF the upstream artifact exists. Missing upstream artifacts produce `STAGE_SKIPPED` entries, never errors.

## Aggregated verdict

After the 4 stages run, the auto-orchestrator emits one consolidated JSON record:

```
knowledge-base/judge-codex/<slug>-auto-judge-<date>.json
```

Contents:

```json
{
  "stages": {
    "discover":       { "verdict": "...", "score": ..., "findings_count": ... },
    "plan":           { "verdict": "...", "score": ..., "findings_count": ... },
    "implementation": { "verdict": "...", "score": ..., "findings_count": ... },
    "final":          { "verdict": "...", "score": ..., "findings_count": ... }
  },
  "aggregated_verdict": "<min(stages.*.verdict) per the smallest-cap-wins rule>",
  "disagreements_with_claude": [
    "stage_name: claude-side=<V>, codex-side=<W>"
  ],
  "next_action": "<MERGE | LOOP_BACK_TO_STAGE | HUMAN_REVIEW_REQUIRED>"
}
```

## Smallest-cap-wins rule

Same as `plan-confidence`. If `discover.verdict == SHIPPABLE` but `implementation.verdict == FAIL_HARD`, the aggregated verdict is `FAIL_HARD`. Hard caps never get masked by upstream green stages.

## `--stop-on-disagreement`

When set, the auto run halts at the first stage where Codex disagrees with Claude (`plan`'s prior verdict on the same artifact). Surfaces immediately rather than spending tokens on stages that may already be invalidated upstream.

## Foreground / background

Default: background (this run can be long — 4 Codex calls).

```typescript
Bash({
  command: `node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion-judge.mjs" auto --slug "$1" $REMAINDER`,
  description: "judge-codex auto pipeline",
  run_in_background: true
})
```

After launch: "judge-codex auto started. Check `/judge-codex:status` for progress; aggregated report lands in knowledge-base/judge-codex/<slug>-auto-judge-<date>.json."

## Refuse to run when

- Slug omitted.
- No upstream artifacts exist for any stage (at least the plan must be present).
- `codex` CLI absent.
