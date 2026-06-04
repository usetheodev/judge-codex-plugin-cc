---
description: Show judge-codex commands + their golden-rule mapping
disable-model-invocation: true
allowed-tools: Read
---

# `/judge-codex:help`

Quick reference for `judge-codex` slash commands.

| Command | Argument | Stage of `plan` cycle | Golden-rule contract |
|---|---|---|---|
| `/judge-codex:setup` | — | environment | n/a |
| `/judge-codex:discover` | `<slug>` | After `/discover-plan` | `rules/discover-blueprint-golden-rule.md` |
| `/judge-codex:plan` | `<slug>` | After `/to-plan` (or after `/plan-confidence`) | `rules/plan-confidence-golden-rule.md` |
| `/judge-codex:implementation` | `<slug>` | After `/implement` IMPLEMENTATION_COMPLETE | `rules/cycle-implement.md` |
| `/judge-codex:final` | `<slug>` | After `/review` consolidated report | `rules/cycle-review.md` (review-of-review) |
| `/judge-codex:auto` | `<slug>` | End-to-end | all of the above sequentially |
| `/judge-codex:status` | — | anytime | n/a |
| `/judge-codex:help` | — | anytime | n/a |

## Verdict vocabulary (locked, mirrors `plan`)

- `SHIPPABLE` (90–100)
- `SHIPPABLE_WITH_CAVEATS` (70–89)
- `NEEDS_REVISION` (50–69)
- `FAIL_SOFT` (49)
- `FAIL_HARD` (49 — blocks downstream)
- `INVALID` (0 — structural integrity broken)
- Plus meta-verdicts at the `final` stage: `META_DEFECT_FOUND`, `AGGREGATOR_BUG_SUSPECTED`.

## Disagreement protocol

When `judge-codex` and Claude `/review` reach **different verdicts** on the same artifact:

1. The disagreement is logged in `knowledge-base/judge-codex/<slug>-<stage>-disagreement-<date>.json`.
2. Pipeline downstream is **paused**.
3. Human adjudication is required — neither LLM is automatically trusted.

This is the entire point of having an orthogonal jury: agreement = high confidence; disagreement = signal for human attention.

## See also

- README: `README.md`
- Inspiration: `openai/codex-plugin-cc`, `paulohenriquevn/loop-code-review`.
- Consumer of these reports: `plan`'s `cycle-review`.
