"""Welk onderdeel staat op schermpunten in een galerijweergave?  python3 pickview.py REPO VIEWNAAM x,y [x,y ...]"""
import sys, os, json
if len(sys.argv) < 4: print(__doc__); sys.exit(2)
REPO, VIEW = sys.argv[1], sys.argv[2]
PTS = [tuple(map(int, a.split(','))) for a in sys.argv[3:]]
sys.path.insert(0, os.path.join(REPO, 'tools'))
sys.argv = [sys.argv[0], REPO, '/dev/null']
import importlib.util
spec = importlib.util.spec_from_file_location('g', os.path.join(os.path.dirname(__file__), 'gallery.py'))
src = open(spec.origin).read().split("os.makedirs(OUT")[0]
ns = {}
exec(compile(src, 'gallery_defs', 'exec'), ns)
views = {v['name']: v for k in ns['SETS'] for v in ns['SETS'][k]}
from harness import session
with session() as s:
    pg = s.page(1280, 800)
    pg.evaluate(ns['APPLY'], views[VIEW])
    pg.wait_for_timeout(300)
    for (x, y) in PTS:
        r = pg.evaluate("""([x,y]) => { const L = window.__model; const n = L.pickAt(x, y); if (!n) return null;
            const o = L.byName(n); const path = []; let p = o; while (p && path.length < 6) { path.push(p.name); p = p.parent && p.parent.userData && p.parent.userData.node ? p.parent : (L.parentOf ? L.parentOf(p) : null); }
            return n; }""", [x, y])
        print(f'{x},{y}: {r}')
