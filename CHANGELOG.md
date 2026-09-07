# Changelog

All notable changes to this project are recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/) and this project adopts [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **Repository renamed from `judge-codex-plugin-cc` to `judge-codex`,** matching the plugin id it has always declared. The `-plugin-cc` suffix said where the plugin runs, not what it does. New location: `https://github.com/usetheodev/judge-codex`; install with `/plugin marketplace add usetheodev/judge-codex`. GitHub redirects the old URL, so existing clones keep working until their remote is updated.

## [0.1.0] - 2026-06-04

### Added
- **First release** of `judge-codex` — Codex-as-orthogonal-LLM-jury for the `plan` cycle ecosystem.
- 8 slash commands (`/judge-codex:setup`, `:discover`, `:plan`, `:implementation`, `:final`, `:auto`, `:status`, `:help`).
- 7 sub-agents: `judge-codex-jury` (thin forwarder) + 4 stage-judges (`discover-judge`, `plan-judge`, `implementation-judge`, `final-judge`) + `quality-evaluator` (Autoresearch keep/discard gate) + `report-writer` (auto-aggregator).
- 3 skills: `codex-cli-runtime`, `judge-prompting`, `cycle-plan-context`.
- 4 JSON schemas (one per stage) using `plan`'s canonical verdict vocabulary plus final-stage meta-verdicts (`META_DEFECT_FOUND`, `AGGREGATOR_BUG_SUSPECTED`).
- `scripts/codex-companion-judge.mjs` (~350 lines): single-entry runtime that locates artifacts in the consumer repo, assembles prompts (agent system + golden-rule + artifact + anti-anchoring), invokes `codex exec --output-schema --output-last-message --skip-git-repo-check --cd`, validates + persists output.
- `scripts/setup-check.sh` — environment verification (Node ≥ 18.18, codex CLI, login).
- `hooks/hooks.json` — optional Stop hook (off by default).
- Marketplace manifest at `.claude-plugin/marketplace.json` for `/plugin marketplace add` install.
- README documents cycle-aware verdict vocabulary distinct from the binary `approve` / `needs-attention` of generic code-review plugins.

### Verified
- Live integration test against `plan/knowledge-base/plans/harden-fabrication-and-cq-gate-plan.md`:
  - Codex elapsed 87993 ms.
  - Codex verdict `INVALID` (score 49) — caught fabricated ADR reference `D9` that the Claude-side `plan-confidence` M3 v0.1 detector had missed (M3 only inspects `#### Evidence` blocks; `D9` was in plan prose outside that scope).
  - Plus 2 medium-severity soft caps (`goal_not_smart_timebound`, `risks_section_missing`).
  - This is the disagreement-with-Claude scenario the plugin exists to surface.

### Inspired by
- [openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc) (Apache 2.0) — adopted `.claude-plugin/` layout, codex-companion subprocess pattern, `disable-model-invocation: true` convention, Stop hook. Distinct: cycle-aware (one command per `plan` stage with golden-rule injection), structured verdict vocabulary, review-of-review final stage.
- [paulohenriquevn/loop-code-review](https://github.com/paulohenriquevn/loop-code-review) (MIT) — adopted per-specialist agent layout, Autoresearch keep/discard quality-evaluator gate, report-writer aggregator.
