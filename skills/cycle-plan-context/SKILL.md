---
name: cycle-plan-context
description: Locates `plan` cycle artifacts (blueprints, plans, implementation logs, review reports) in the consumer repository. Internal helper for the companion script.
user-invocable: false
---

# cycle-plan-context

How the companion script finds the artifacts to judge in a consumer repo that has the `plan` plugin installed.

## Conventional paths (in order of preference)

For a given `<slug>`, the companion looks for artifacts under the **consumer repo root** (the cwd when the slash command was invoked):

| Stage | Artifact location | Fallback |
|---|---|---|
| `discover` | `knowledge-base/discoveries/blueprints/<slug>-blueprint.md` | `.claude/knowledge-base/discoveries/blueprints/<slug>-blueprint.md` |
| `plan` | `knowledge-base/plans/<slug>-plan.md` | `.claude/knowledge-base/plans/<slug>-plan.md` |
| `implementation` | `knowledge-base/implementations/<slug>-implementation.md` | `.claude/knowledge-base/implementations/<slug>-implementation.md` |
| `final` | `knowledge-base/reviews/<slug>-review-*.md` (latest by mtime) | `.claude/knowledge-base/reviews/<slug>-review-*.md` |
| `final` (aux) | `agents/review-<slug>-*/` (per-agent files) | `.claude/agents/review-<slug>-*/` |

## Companion repo detection

The companion script walks up from `cwd` looking for the consumer repo root via these markers (in order):

1. `.git/`
2. `.claude/`
3. `plugin.json` (Claude Code plugin manifest — the `plan` repo signature)
4. `rules/` directory paired with `skills/` (the planning ecosystem layout)
5. `pyproject.toml` / `package.json` as last-resort (not specific to `plan`)

This mirrors the resolver added to `plan`'s `run_structural.py:_find_repo_root_from_plan` (2026-06-04) — same logic.

## Golden-rule resolution

Once the consumer repo root is found, golden-rule files are looked up at:

1. `<root>/rules/<rule>.md`
2. `<root>/.claude/rules/<rule>.md`
3. `${CLAUDE_PLUGIN_ROOT}/templates/golden-rules/<rule>.md` (plugin-bundled fallback)

The fallback templates exist so judge-codex works even in repos that have not promoted the rule files from `skills/*/defaults/`.

## Claude-side verdict resolution (for disagreement detection)

The companion looks up the Claude-side verdict (when present) at:

| Stage | Claude-side gate output |
|---|---|
| `discover` | `knowledge-base/reviews/<slug>-discover-confidence-*.json` |
| `plan` | `knowledge-base/reviews/<slug>-plan-confidence-*.json` |
| `implementation` | `knowledge-base/reviews/<slug>-implement-validate-*.md` + `knowledge-base/audits/<slug>-code-quality-*.md` |
| `final` | `knowledge-base/reviews/<slug>-review-*.md` (the verdict line) |

When found, the verdict is included in the prompt's anti-anchoring section (see `judge-prompting`).

## Output location

All judge-codex output lands in the consumer repo at:

```
knowledge-base/judge-codex/<slug>-<stage>-judge-<YYYY-MM-DD>.json
knowledge-base/judge-codex/<slug>-<stage>-judge-<YYYY-MM-DD>.md         (human-readable)
knowledge-base/judge-codex/<slug>-<stage>-disagreement-<YYYY-MM-DD>.json (when Claude vs Codex differ)
```

The directory is created if missing.
