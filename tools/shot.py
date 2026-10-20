"""Screenshots met stappen per viewport.

    python3 tools/shot.py UITVOERMAP 'JSON'

JSON: [["naam", breedte, hoogte, ["eval:JS", "wait:ms", "click:selector", "shot:bestandsnaam"]], ...]
Voorbeeld: [["desk",1280,800,["shot:gemonteerd","eval:__model.preset('main'); __model.finishAll(); 1","wait:800","shot:hoofdgroepen"]]]
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import session

OUT = sys.argv[1]
steps = json.loads(sys.argv[2]) if len(sys.argv) > 2 else [["desk", 1280, 800, ["shot:gemonteerd"]]]
os.makedirs(OUT, exist_ok=True)
with session() as s:
    for (name, w, h, actions) in steps:
        pg = s.page(w, h, scale=1, touch=w < 700)
        for a in actions:
            if a.startswith('eval:'): print(name, 'eval ->', str(pg.evaluate(a[5:]))[:300])
            elif a.startswith('wait:'): pg.wait_for_timeout(int(a[5:]))
            elif a.startswith('click:'): pg.click(a[6:])
            elif a.startswith('shot:'):
                pg.screenshot(path=os.path.join(OUT, a[5:] + '.png'), timeout=180000); print(name, 'shot', a[5:])
        pg.close()
    s.report()
