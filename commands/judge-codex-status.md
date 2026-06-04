---
description: List judge-codex background jobs and recent outputs
disable-model-invocation: true
allowed-tools: Bash(node:*), Bash(ls:*), Read
---

# `/judge-codex:status`

Lists:

1. Active background jobs (running `codex-companion-judge.mjs` processes).
2. Recent outputs in `knowledge-base/judge-codex/` (last 10).
3. Disagreements with `plan` verdicts (when both sides scored the same artifact).

## Execution

```bash
node "${CLAUDE_PLUGIN_ROOT}/scripts/codex-companion-judge.mjs" status
```

The script prints a concise table; no Claude paraphrasing.
