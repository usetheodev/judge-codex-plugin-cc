---
description: Verify Codex CLI install + login; offer to install if missing
disable-model-invocation: true
allowed-tools: Bash, AskUserQuestion
---

# `/judge-codex:setup`

Verifies the runtime that `judge-codex` depends on:

1. `codex` CLI is on PATH.
2. `codex` is authenticated (`codex --version` succeeds + a quick `codex auth status`-like check).
3. Node.js ≥ 18.18.

If `codex` is missing AND `npm` is available, the command offers to install via:

```bash
npm install -g @openai/codex
```

If `codex` is installed but not logged in:

```
Please run: !codex login
```

This command does NOT touch the user's project. It is environment-only.

## Execution

```bash
bash "${CLAUDE_PLUGIN_ROOT}/scripts/setup-check.sh"
```

The script exits 0 when ready, non-zero when manual action is required, and prints a concise diagnostic.
