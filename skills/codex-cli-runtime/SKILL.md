---
name: codex-cli-runtime
description: Internal helper contract for calling the codex-companion-judge runtime. Used by `judge-codex-jury` only.
user-invocable: false
---

# codex-cli-runtime

## Primary helper

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion-judge.mjs" <subcommand> [args]
```

## Subcommands

| Subcommand | Purpose |
|---|---|
| `judge --stage <stage> --slug <slug>` | Single-stage judge run |
| `auto --slug <slug>` | End-to-end 4-stage run |
| `status` | List background jobs + recent outputs |
| `setup` | Verify codex CLI availability + login |

## Required environment

- `codex` CLI on PATH (`@openai/codex` npm package, install via `/judge-codex:setup` or `npm install -g @openai/codex`).
- Codex logged in (`codex auth status` returns OK).

## CLI shape used internally by the companion

```bash
codex exec --json --model "${MODEL:-gpt-5-codex}" --effort "${EFFORT:-medium}" \
  "<prompt assembled from artifact + golden-rule + judge agent system prompt>"
```

The companion script:

1. Locates the artifact by slug + stage.
2. Loads the corresponding golden-rule contract from the consumer repo's `rules/` or `.claude/rules/`.
3. Loads the corresponding judge agent's system prompt from `${CLAUDE_PLUGIN_ROOT}/agents/<stage>-judge.md`.
4. Assembles a single prompt with: agent system + golden-rule + artifact + stage-specific instructions.
5. Calls `codex exec --json` and pipes the output through a JSON-schema validator.
6. Writes the result to `knowledge-base/judge-codex/<slug>-<stage>-judge-<date>.json`.
7. Returns the JSON to stdout for the `judge-codex-jury` subagent to forward verbatim.

## Execution rules

- The `judge-codex-jury` subagent makes EXACTLY ONE Bash call to this script per request.
- The subagent does NOT inspect the repository, read files, run grep, or do any independent work.
- If `codex` CLI is absent, the script exits 1 with a clear message — the subagent returns nothing.
- `--background` is handled by Claude Code's `Bash(..., run_in_background: true)`, not by the script.

## Flags supported by the companion (subset)

| Flag | Meaning |
|---|---|
| `--model <name>` | Override Codex model (default: `gpt-5-codex`) |
| `--effort <level>` | Reasoning effort (default: `medium`) |
| `--wait` / `--background` | Execution mode (handled by Claude Code) |
| `--stop-on-disagreement` | (auto only) Halt at first stage that disagrees with the Claude-side verdict |
| `--no-quality-evaluator` | (auto only) Skip the keep/discard gate — NOT recommended; for debugging only |

## Safety rules

- Read-only on the consumer repo. The companion NEVER modifies source files.
- Outputs land only under `knowledge-base/judge-codex/`.
- Disagreement logs are append-only — never overwrite a prior disagreement record.
