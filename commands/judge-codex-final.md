---
description: Review-of-review — Codex audits the consolidated `/review` report
argument-hint: '<slug> [--wait|--background]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), AskUserQuestion
---

# `/judge-codex:final`

The **review-of-review** stage. Submits `knowledge-base/reviews/<slug>-review-<date>.md` (the consolidated output from `plan`'s 5–7-Claude-sub-agent `/review`) to **Codex** as orthogonal jury.

## Why this stage exists

`plan`'s `/review` produces a consolidated finding-set by running `consolidate_findings.py` on 5–7 sub-agent outputs. That script itself can have bugs — for example, on 2026-06-04 a YAML-syntax issue in one agent's findings file caused 3 of 7 files to be silently skipped, producing a false `READY_TO_MERGE` verdict that was caught only by manual rebuild. **judge-codex:final closes that meta-defect class** by asking Codex to inspect the consolidated report itself, comparing back to the agent files in `agents/review-<slug>-<date>/`.

## What Codex evaluates

| Check | Failure mode it catches |
|---|---|
| Every BLOCKER / HIGH severity finding declared by any agent appears in the consolidated report | `consolidate_findings.py` silently dropping files |
| Verdict consistency: BLOCKER count → verdict ≠ READY_TO_MERGE | aggregator bug overriding individual agent verdicts |
| Each finding has a real file:line that resolves | fabricated finding location |
| `edge_case_coverage.py` ratio is methodologically sound (not extracting ADR alternatives as edge cases) | known over-extraction heuristic |
| Wiring triad pillar (a) caller pass rate matches what each agent observed | data drift between aggregation passes |
| Process-drift events (declared agent ≠ what was actually invoked) honestly logged | silent agent substitution |

## Output

```
knowledge-base/judge-codex/<slug>-final-judge-<date>.json
```

Schema: `schemas/final-judge-output.schema.json`. Verdict vocabulary aligned with `cycle-review.md § Verdicts` (`READY_TO_MERGE` / `NEEDS_FIXES` / `NEEDS_DEEPER`) plus the meta-verdict tokens (`META_DEFECT_FOUND`, `AGGREGATOR_BUG_SUSPECTED`).

## Composability

When `/review` returns `READY_TO_MERGE` and `/judge-codex:final` returns the same → high-confidence go.

When they disagree → **STOP**. Surface to human. The disagreement is the highest-value signal in the entire pipeline (the LLM-judge-of-LLM-judge loop just self-detected an inconsistency).

## Foreground / background

Identical to `/judge-codex:discover`. Stage = `final`.

## Refuse to run when

- Slug omitted.
- `knowledge-base/reviews/<slug>-review-*.md` not found.
- `codex` CLI absent.
