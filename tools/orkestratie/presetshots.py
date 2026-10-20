"""Screenshot van elke preset (zonder rondleiding).  python3 presetshots.py REPO UITVOERMAP"""
import sys, os
if len(sys.argv) < 3: print(__doc__); sys.exit(2)
REPO, OUT = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.path.join(REPO, 'tools'))
from harness import session
os.makedirs(OUT, exist_ok=True)
failed = False
with session() as s:
    pg = s.page(1280, 800)
    # de presets uit de pagina zelf, in hun volgorde (de rondleiding niet); zonder presets is er iets mis, geen leeg succes
    ids = pg.evaluate("() => window.__model.presetList().map(p => p.id).filter(id => id !== 'tour')")
    if not ids:
        print('MISLUKT: de pagina heeft geen presets'); sys.exit(1)
    for i, pid in enumerate(ids):
        try:
            pg.evaluate("(id) => { const L = window.__model; L.preset(id); L.finishAll(); return true; }", pid)
            pg.wait_for_timeout(500)
            pg.evaluate("() => { window.__model.finishAll(); }")
            pg.wait_for_timeout(300)
            pg.screenshot(path=os.path.join(OUT, f'{i+1:02d}-{pid}.png'), timeout=180000)
            print('beeld', pid)
        except Exception as e:
            print('MISLUKT', pid, str(e)[:200]); failed = True
    s.report()
    sys.exit(1 if failed or s.errors() else 0)
