"""Gerichte opnames. Gebruik: shots.py UITMAP 'naam' 'JS-voorbereiding' ['naam2' 'JS2' ...]. Elke JS draait na een verse openAll(0)."""
import sys, os
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))  # tools/ van deze checkout
from harness import session
out = sys.argv[1]; os.makedirs(out, exist_ok=True)
SHOT_TIMEOUT = int(os.environ.get('MODEL_TIMEOUT_MS', 120000))  # zelfde wachttijd als het laden (harness.py)
pairs = list(zip(sys.argv[2::2], sys.argv[3::2]))
with session() as s:
    pg = s.page(1280, 800)
    pg.wait_for_function('window.__model && window.__model.ready', timeout=180000)
    pg.evaluate('() => window.__model.setOpenMode(true)')
    for name, js in pairs:
        pg.evaluate('() => { window.__model.openAll(0, true); window.__model.finishAll(); }')
        pg.wait_for_timeout(300)
        r = pg.evaluate(js)
        pg.wait_for_timeout(300)
        pg.evaluate('() => window.__model.finishAll()')
        pg.wait_for_timeout(1200)
        # Software-rendering (SwiftShader) rondt een tekenopdracht pas na 5 tot 15 s af, onder belasting (tweede proces, andere
        # tests) langer. Page.screenshot wacht daar op en haalde met 30 s niet altijd de eindstreep. Daarom eerst twee
        # animatieframes afwachten (de GPU-wachtrij loopt dan leeg, zonder tijdslimiet van 30 s) en dan opnemen met ruime limiet.
        pg.evaluate('() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)))')
        pg.screenshot(path=f'{out}/{name}.png', timeout=SHOT_TIMEOUT)
        print(name, r)
    s.report()
