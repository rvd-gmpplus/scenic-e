"""Screenshots voor docs/screenshots via de presets van de app (de lijst docshots uit auto.json op 1280 x 800 en mobiel.png op 390 x 844), daarna
teruggebracht tot 256 kleuren met Pillow (ongeveer 60 procent kleiner; zonder Pillow blijven ze in volle kleur, met een melding).

    python3 tools/orkestratie/docshots.py REPO UITVOERMAP    exitcode 1 bij consolefouten
"""
import sys, os
if len(sys.argv) < 3: print(__doc__); sys.exit(2)
repo, out = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.path.join(repo, 'tools'))
from harness import session
import json
# de beelden per auto: auto.json, veld docshots ([[bestandsnaam, preset-id], ...]); mobiel.png komt er altijd bij
with open(os.path.join(repo, 'auto.json'), encoding='utf-8') as f:
    SHOTS = [tuple(x) for x in json.load(f)['docshots']]
os.makedirs(out, exist_ok=True)
def klein(path):
    try:
        from PIL import Image
    except ImportError:
        print('Pillow ontbreekt: ' + path + ' blijft in volle kleur'); return
    im = Image.open(path).convert('RGB')
    im.quantize(colors=256, method=Image.Quantize.MEDIANCUT, dither=Image.Dither.FLOYDSTEINBERG).save(path, 'PNG', optimize=True)
with session() as s:
    pg = s.page(1280, 800)
    for name, pid in SHOTS:
        pg.evaluate("(id) => { const L = __model; L.preset(id); L.finishAll(); if (L.batchFlush) L.batchFlush(); L.finishAll(); return 1; }", pid)
        pg.wait_for_timeout(1200)
        pg.screenshot(path=os.path.join(out, name + '.png'), timeout=180000); klein(os.path.join(out, name + '.png')); print('beeld', name)
    pg2 = s.page(390, 844, scale=2, touch=True)
    pg2.evaluate("() => { const L = __model; L.preset('main'); L.finishAll(); if (L.batchFlush) L.batchFlush(); L.finishAll(); return 1; }")
    pg2.wait_for_timeout(1200)
    pg2.screenshot(path=os.path.join(out, 'mobiel.png'), timeout=180000); klein(os.path.join(out, 'mobiel.png')); print('beeld mobiel')
    s.report()
    sys.exit(1 if s.errors() else 0)
