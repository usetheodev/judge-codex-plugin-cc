---
description: Run Codex as orthogonal judge on a `/implement` cycle output
argument-hint: '<slug> [--wait|--background]'
disable-model-invocation: true
allowed-tools: Read, Glob, Grep, Bash(node:*), Bash(git:*), AskUserQuestion
---

# `/judge-codex:implementation`

Submits `knowledge-base/implementations/<slug>-implementation.md` + the actual commits (via `git log` since the plan's slug-tagged base) to **Codex** as orthogonal jury, validated against `rules/cycle-implement.md`.

## What Codex evaluates

| Check | Source of truth |
|---|---|
| Wiring triad COMPLETE per new public symbol (caller + integration test + runtime metric) | `cycle-implement.md § Wiring triad` |
| TDD audit-trail: every task has visible RED commit before GREEN | `cycle-implement.md § Chain` |
| No new symbols dangling (ADR-deferred metrics OK; silent omissions NOT) | `cycle-implement.md § Hard gates` |
| `/code-quality` gate present in the post-halt-loop validation (per ADR 0002) | `rules/cycle-code-quality.md § Pre-conditions` |
| CHANGELOG `[Unreleased]` populated with the slice's entries (Inquebrável Rule 6) | `CLAUDE.md global § 6` |
| Plan ↔ commits semantic match (every plan task → ≥1 commit; no orphan commits without plan task) | `cycle-implement.md § Anti-patterns` |
| Dead code from refactor leftovers in production paths | judge heuristic + `/code-quality` D1 cross-check |

## Output

```
knowledge-base/judge-codex/<slug>-implementation-judge-<date>.json
```

Schema: `schemas/implementation-judge-output.schema.json`. Verdict vocabulary aligned with `cycle-implement.md` exit states.

## Context fed to Codex

The companion script (`codex-companion-judge.mjs`) bundles:

1. The implementation log markdown.
2. `git log --stat <baseline-ref>..HEAD` filtered to the slice's commits.
3. The plan markdown (for cross-validation).
4. The cycle rule + golden rule paths (Codex reads them).

## Foreground / background

Identical pattern to `/judge-codex:discover`. Stage = `implementation`.

## Refuse to run when

- Slug omitted.
- `knowledge-base/implementations/<slug>-implementation.md` not found.
- Working tree dirty (per `cycle-review.md` discipline — judge a stable state).
- `codex` CLI absent.
