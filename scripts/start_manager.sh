#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
export PATH="$HOME/.local/bin:$PATH"
if [[ "${1:-}" != "--dry-run" ]] && ! command -v claude >/dev/null 2>&1; then
  echo "Claude Code not found: install/login and ensure ~/.local/bin is in PATH" >&2
  exit 2
fi
cd "$ROOT"
exec python3 "$ROOT/scripts/pm_runner.py" --project "$ROOT" "$@"
