"""Probe: wereldkaders van knopen bij dicht en open. Gebruik: probe.py 'JS-expressie die een object teruggeeft'"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))  # tools/ van deze checkout
from harness import session
js = sys.argv[1]
with session() as s:
    pg = s.page(1280, 800)
    pg.wait_for_function('window.__model && window.__model.ready', timeout=180000)
    pg.evaluate('''() => { window.__box = (name) => { const L = window.__model; const n = L.byName(name) || L.byPath(name); if (!n) return null; L.finishAll(); n.obj.updateWorldMatrix(true, true); const b = new THREE.Box3().setFromObject(n.obj); const r = v => Math.round(v * 1000) / 1000; return { min: [r(b.min.x), r(b.min.y), r(b.min.z)], max: [r(b.max.x), r(b.max.y), r(b.max.z)] }; }; }''')
    print(json.dumps(pg.evaluate(js), ensure_ascii=False, indent=1))
    s.report()
