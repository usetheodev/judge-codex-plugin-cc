# Changelog

All notable changes to this project are recorded in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/) and this project adopts [Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- Bootstrap of `judge-codex` plugin scaffold. Manifest `.claude-plugin/plugin.json` declares `name: judge-codex`, version `0.0.1`, MIT license, author Paulo Henrique. Layout follows `.claude-plugin/` + `commands/` + `agents/` + `skills/` + `schemas/` + `hooks/` + `scripts/` + `templates/` + `tests/` convention validated by ≥2 source plugins (`openai/codex-plugin-cc` and `paulohenriquevn/loop-code-review`). README documents the cycle-aware verdict vocabulary aligned with `plan`'s canonical contract (`SHIPPABLE` / `SHIPPABLE_WITH_CAVEATS` / `NEEDS_REVISION` / `FAIL_SOFT` / `FAIL_HARD` / `INVALID`) — distinct from the binary `approve` / `needs-attention` used by generic code-review plugins.
