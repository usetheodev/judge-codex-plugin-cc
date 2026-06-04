---
description: Run Codex as orthogonal judge on a `/to-plan` plan
argument-hint: '<slug> [--wait|--background]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), AskUserQuestion
---

# `/judge-codex:plan`

Submits `knowledge-base/plans/<slug>-plan.md` to **Codex** as orthogonal jury, validated against `rules/plan-confidence-golden-rule.md`.

## What Codex evaluates

| Check | Source of truth |
|---|---|
| Coverage Matrix semantic completeness (not just 100% mapping, but goals are SMART) | `plan-confidence-golden-rule.md § Rules that cannot be bent` |
| `fabricated_citation` M3+ (rule refs, Blueprint refs, intra-plan ADRs, Unbreakable Rules) | M3 v0.1 active in `plan` (2026-06-04) |
| `adr_without_alternatives` | `plan-confidence-golden-rule.md` soft cap 70 |
| `bugfix_without_tdd` (every bug-fix task has RED-GREEN-REFACTOR explicit) | same |
| Goal SMART (Specific, Measurable, Achievable, Relevant, Time-bound) | empty corner — judge surfaces if absent |
| Risks section non-empty + qualified | judge heuristic |
| Open Questions surfaced — not buried | judge heuristic |

## Output

```
knowledge-base/judge-codex/<slug>-plan-judge-<date>.json
```

Schema: `schemas/plan-judge-output.schema.json`. Verdict vocabulary same as discover.

## Composability

When `/plan-confidence` already scored the plan, judge-codex adds an **independent second opinion**:

```
plan-confidence (deterministic structural check)  ──→  e.g., SHIPPABLE 97.6
judge-codex:plan (Codex semantic check)           ──→  e.g., NEEDS_REVISION (Goal vague)
                                                       ▲
                                                       │
                                          Disagreement = signal for human
```

A human review absorbs disagreements per `cycle-review.md § verdict`.

## Foreground / background flow

Identical to `/judge-codex:discover` (see that file). Stage flag = `plan`.

## Refuse to run when

- Slug omitted.
- `knowledge-base/plans/<slug>-plan.md` not found.
- `codex` CLI absent.
