#!/bin/bash
# SessionStart-hook voor Claude Code-sessies in de cloud: zet de testomgeving klaar (zie tools/setup.sh).
set -euo pipefail
if [ "${CLAUDE_CODE_REMOTE:-}" != "true" ]; then
  exit 0
fi
cd "${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "$0")/../.." && pwd)}"
tools/setup.sh
