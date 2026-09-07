# judge-codex — Codex-as-judge for the `plan` cycle ecosystem

> **Autonomous + rigorous orthogonal-LLM jury** for the [`plan`](https://github.com/paulohenriquevn/plan) cycle pipeline. Breaks the Claude-only monoculture by adding GPT-Codex as an independent reviewer that re-validates each cycle artifact against its golden-rule contract.

## Why this exists

`plan` already runs `/review` with 5–7 specialized sub-agents in parallel (architecture, tests, wiring, cross-validation, domain). They are all **Claude** — same model family, same training, same blind spots. Concurrency hazards, side-channel risks, and certain classes of subtle bugs get systematically under-weighted because every reviewer shares the same priors.

**judge-codex** adds a second LLM family (GPT-Codex via the official `codex` CLI) as an **orthogonal jury** that consumes the same artifact and emits an independent verdict using `plan`'s canonical verdict vocabulary. When Claude and Codex disagree, the disagreement itself is the signal — and the loop halts for human adjudication.

## What you get

Slash commands (one per cycle stage):

| Command | When | What it judges |
|---|---|---|
| `/judge-codex:discover <slug>` | After `/discover-plan` produces a blueprint | ≥2-source evidence rule, `fabricated_citation`, empty corners, cross-cutting comparison rigor |
| `/judge-codex:plan <slug>` | After `/to-plan` (typically also after `/plan-confidence`) | Coverage Matrix semantic completeness, Goal SMART quality, ADR alternative honesty, TDD discipline in bug-fixes, citation fabrication |
| `/judge-codex:implementation <slug>` | After `/implement` emits `IMPLEMENTATION_COMPLETE` | Wiring triad depth (caller + integration test + runtime metric), TDD RED→GREEN→REFACTOR audit-trail, dead code in production paths |
| `/judge-codex:final <slug>` | After `/review` emits the consolidated report | Review-of-review: does the consolidated finding-set itself hold up? Catches the `consolidate_findings.py` YAML-bug class of meta-defects |
| `/judge-codex:auto <slug>` | End-to-end | Runs all 4 above sequentially against artifacts produced by a single slice |
| `/judge-codex:setup` | Once per environment | Verifies `codex` CLI install + login; offers to install if missing |
| `/judge-codex:status` | Anytime | Lists background jobs |
| `/judge-codex:help` | Anytime | Shows commands + their golden-rule mapping |

Sub-agent:

| Name | Role |
|---|---|
| `judge-codex-jury` | Thin forwarding wrapper that hands a cycle artifact + golden-rule contract to Codex via `codex-companion-judge.mjs`. Returns Codex stdout verbatim. |

## Verdict vocabulary (locked, mirrors `plan`)

```
SHIPPABLE              — 90–100  green
SHIPPABLE_WITH_CAVEATS — 70–89   caveats logged
NEEDS_REVISION         — 50–69   loop back
FAIL_SOFT              — 49      soft cap blew
FAIL_HARD              — 49      hard cap blew → block downstream
INVALID                — 0       structural integrity broken
```

> **Different from `codex-plugin-cc`:** that plugin uses a binary `approve` / `needs-attention` schema (general-purpose code review). judge-codex outputs structured findings keyed by `plan`'s cycle-specific golden rules.

## Quick start

```bash
# 1. Install Codex CLI (one-time)
npm install -g @openai/codex
codex login

# 2. Install this plugin
/plugin marketplace add paulohenriquevn/judge-codex
/plugin install judge-codex@judge-codex
/reload-plugins

# 3. Verify
/judge-codex:setup

# 4. Use after any plan cycle
/judge-codex:discover my-slug
/judge-codex:plan my-slug
/judge-codex:implementation my-slug
/judge-codex:final my-slug

# OR end-to-end after a slice completes
/judge-codex:auto my-slug
```

## How it composes with `plan`

```
plan's existing /review (5-7 Claude sub-agents):  ───────────────────┐
  ├── architecture-reviewer                                          │
  ├── test-auditor                                                   │
  ├── wiring-validator                                               │
  ├── cross-validation                                               │
  └── domain-specific (1-3)                                          │
                                                                     │
NEW: /judge-codex (Codex orthogonal jury):  ─────────────────────────┤
  ├── /judge-codex:discover    (blueprint judge)                     │
  ├── /judge-codex:plan        (plan judge)                          ├── verdict
  ├── /judge-codex:implementation                                    │
  └── /judge-codex:final       (review-of-review)                    │
                                                                     │
  When Claude and Codex agree → confidence ↑                         │
  When they disagree         → loop halts for human                  │
                                                                     ┘
```

## Cycle-aware vs generic Codex review

| Concern | `codex-plugin-cc` (generic) | `judge-codex` (cycle-aware) |
|---|---|---|
| Input | "Current git state" | Specific `plan` artifact (blueprint / plan / implementation log / review report) |
| Contract reference | None | The cycle's golden rule (e.g., `discover-blueprint-golden-rule.md`, `plan-confidence-golden-rule.md`) |
| Verdict | `approve` / `needs-attention` | Full `plan` verdict vocabulary with hard-cap identifiers |
| Findings format | Free-form | Structured JSON validated against `schemas/{stage}-judge-output.schema.json` |
| Use case | Replace Claude review for code | **Add** Codex jury alongside Claude `/review` for full pipeline |

## Inspiration / prior art

Built by reading two reference plugins (≥2-source evidence rule of the `plan` ecosystem):

1. **[openai/codex-plugin-cc](https://github.com/openai/codex-plugin-cc)** — official OpenAI plugin. Adopted: `.claude-plugin/plugin.json` layout, `codex-companion.mjs` companion-script pattern, `Stop` hook for end-of-turn review, `disable-model-invocation: true` on slash commands (user-only), JSON-schema'd output. Adapted away: binary verdict, generic-review framing, no cycle awareness.
2. **[paulohenriquevn/loop-code-review](https://github.com/paulohenriquevn/loop-code-review)** — autonomous 5-phase code-review loop with Ralph-Wiggum self-referential loop + Autoresearch keep/discard quality gates. Adopted: phase-per-specialist agent layout, evidence-backed findings, quality-evaluator gate before report-writer.

## Requirements

- **Codex CLI** (`@openai/codex`) installed + logged in (ChatGPT subscription OR OpenAI API key).
- **Node.js 18.18+**.
- **`plan` plugin installed** — judge-codex consumes `plan` artifacts (blueprints, plans, implementation logs, review reports) by path convention.

## License

MIT. See [`LICENSE`](./LICENSE).
