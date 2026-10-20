#!/bin/bash
# Volledige testset op de werktak, uitvoer naar $1 (map). Draait in twee parallelle reeksen, strikt (ui_inner --strict,
# opentest --strikt-min, itest met poorten, tri --gate). Exitcode 1 zodra een test faalt; per test de duur in seconden.
# Extra tests per auto: auto.json: extraTests (docs/framework.md). Ze draaien als derde parallelle reeks, elk met NAAM.txt en
# dezelfde strikte exitcode, en staan na de vaste lijst in tests.txt. Zonder dat veld is alles precies zoals hierboven.
# Gebruik: tools/orkestratie/finaltests.sh UITVOERMAP
set -u
unset LAG3_GPU  # de set, visdiff en de basislijnen draaien altijd op SwiftShader (zie docs/testen.md)
if [ $# -lt 1 ] || [ -z "$1" ]; then echo "gebruik: $0 UITVOERMAP" >&2; exit 2; fi
OUT="$(mkdir -p "$1" && cd "$1" && pwd)" || exit 2
R="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$R" || exit 1
# Vaste lijst: CI vergelijkt deze namen met de verwachting, zodat een test niet stil uit de set kan vallen.
TESTS="lint smoke integ sil inner opentest itest tri pub stats shots visdiff anchor"
# Extra tests van deze auto (leeg zonder extraTests). Een ongeldig veld maakt de set meteen rood, vóór het werk begint.
EXTRA="$(python3 tools/framework.py extra-namen)" || { echo "FOUT: tools/framework.py extra-namen faalde (extraTests in auto.json ongeldig); zie de melding hierboven" >&2; exit 1; }
git log --oneline -1 > "$OUT/commit.txt"
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$OUT/start.txt"

run() { # run NAAM COMMANDO...  : uitvoer naar NAAM.txt, laatste regel "exit N (Ns)"
  local name="$1"; shift
  local t0; t0=$(date +%s)
  "$@" > "$OUT/$name.txt" 2>&1
  local rc=$?
  echo "exit $rc ($(( $(date +%s) - t0 ))s)" >> "$OUT/$name.txt"
}

run lint python3 build.py --lint
( run smoke python3 tools/smoke.py
  run integ python3 tools/integrity.py
  run sil python3 tools/silhouette.py
  run inner python3 tools/ui_inner.py --open --strict
  run opentest python3 tools/opentest.py --strikt-min --out "$OUT/opentest" ) &
( run itest env ITEST_GATES=1 python3 tools/itest.py
  run tri python3 tools/tri.py --gate --json "$OUT/tri.json"
  run pub python3 tools/pubsmoke.py
  run stats python3 tools/orkestratie/stats.py "$R" "$OUT/stats.json"
  run shots python3 tools/orkestratie/presetshots.py "$R" "$OUT/presets"
  # VISDIFF_BASIS: andere basislijn, bijvoorbeeld een eigen meting op dezelfde machine (software-rendering verschilt per
  # platform: macOS tegen de Linux-container circa 2 procent per beeld)
  run visdiff python3 tools/visdiff.py "$OUT/presets" "${VISDIFF_BASIS:-docs/baseline}" --uit "$OUT/visdiff"
  run anchor python3 tools/anchorcheck.py --json "$OUT/anchorcheck.json" --basis docs/baseline/anchorcheck.json ) &
if [ -n "$EXTRA" ]; then
  ( for n in $EXTRA; do run "$n" python3 tools/framework.py extra "$n" "$OUT"; done ) &
fi
wait
date -u +"%Y-%m-%dT%H:%M:%SZ" > "$OUT/einde.txt"
fail=0
for f in $TESTS $EXTRA; do
  if [ -f "$OUT/$f.txt" ]; then last="$(tail -n 1 "$OUT/$f.txt")"; else last="geen uitvoer ($f.txt ontbreekt)"; fi
  case "$last" in "exit 0 "*) st=ok ;; *) st=FOUT; fail=1 ;; esac
  echo "== $f: $st ($last) $([ -f "$OUT/$f.txt" ] && tail -n 3 "$OUT/$f.txt" | head -n 2 | tr '\n' ' ' | cut -c1-200)"
done
echo "$TESTS${EXTRA:+ $EXTRA}" > "$OUT/tests.txt"
[ $fail -eq 0 ] && echo "ALLES GROEN" || echo "RODE TESTS, zie $OUT"
exit $fail
