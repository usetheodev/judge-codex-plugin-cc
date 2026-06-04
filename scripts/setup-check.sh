#!/usr/bin/env bash
# /judge-codex:setup — verifies the runtime that judge-codex depends on.
# Exits 0 when ready, non-zero when manual action is required.

set -uo pipefail

err=0

# Node check
if ! command -v node >/dev/null 2>&1; then
  echo "[setup] FAIL — node not found on PATH. Install Node.js >= 18.18 first." >&2
  err=1
else
  node_version=$(node --version 2>/dev/null | sed 's/^v//')
  major=${node_version%%.*}
  if [ "$major" -lt 18 ]; then
    echo "[setup] FAIL — Node.js $node_version found, but judge-codex requires >=18.18." >&2
    err=1
  else
    echo "[setup] OK   — Node.js $node_version"
  fi
fi

# Codex CLI check
if ! command -v codex >/dev/null 2>&1; then
  echo "[setup] FAIL — codex CLI not on PATH." >&2
  if command -v npm >/dev/null 2>&1; then
    echo "       Run: npm install -g @openai/codex" >&2
  else
    echo "       Install npm first, then: npm install -g @openai/codex" >&2
  fi
  err=1
else
  codex_version=$(codex --version 2>/dev/null | head -1 || echo "unknown")
  echo "[setup] OK   — codex $codex_version"
fi

# Codex login check (best-effort — exact command varies by codex version)
if command -v codex >/dev/null 2>&1; then
  if codex auth status >/dev/null 2>&1; then
    echo "[setup] OK   — codex logged in"
  elif codex --help 2>&1 | grep -q "login"; then
    # Login command exists but status doesn't — try other check
    if codex login --check >/dev/null 2>&1 || codex whoami >/dev/null 2>&1; then
      echo "[setup] OK   — codex logged in"
    else
      echo "[setup] WARN — codex login status unclear. If review fails, run: codex login" >&2
    fi
  fi
fi

if [ "$err" -eq 0 ]; then
  echo ""
  echo "[setup] judge-codex is ready. Try: /judge-codex:help"
fi

exit "$err"
