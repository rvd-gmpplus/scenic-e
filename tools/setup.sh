#!/bin/bash
# Maakt een verse omgeving klaar voor de testset: Playwright (Python), three.js 0.147.0 in de cache (met hashcontrole),
# en een Chromium. Idempotent; draait zonder vragen. Gebruik: tools/setup.sh
set -euo pipefail
R="$(cd "$(dirname "$0")/.." && pwd)"
export PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD=1
python3 -m pip install --quiet --disable-pip-version-check -r "$R/requirements.txt"
python3 "$R/tools/harness.py" --ensure-three
if [ -z "${CHROMIUM:-}" ] && [ ! -x /opt/pw-browsers/chromium ]; then
  echo "geen Chromium in /opt/pw-browsers; playwright install chromium"
  python3 -m playwright install chromium
fi
node --version >/dev/null 2>&1 || echo "let op: node ontbreekt, build.py slaat de syntaxcontrole over"
python3 -c "import playwright; from importlib.metadata import version; print('playwright', version('playwright'))"
echo "klaar: python3 tools/smoke.py"
