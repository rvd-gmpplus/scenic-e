"""Rooktest: bouwt de pagina, laadt hem op desktop- en telefoonformaat en meldt fouten, aantallen en rendercijfers.

    python3 tools/smoke.py            # exitcode 1 bij console- of paginafouten
"""
import sys, os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import session

STATS = """(() => { const L = window.__model; const parts = L.ALL.filter(n => !n.asm).length;
  let tris = 0; for (const m of L.MESHES) { const g = m.geometry; tris += (g.index ? g.index.count : g.attributes.position.count) / 3; }
  return { nodes: L.ALL.length, groups: L.ALL.length - parts, parts, maxDepth: Math.max(...L.ALL.map(n => n.depth)), meshes: L.MESHES.length, tris: Math.round(tris) }; })()"""
RENDER = """(() => { renderer.info.reset(); const t = performance.now(); renderer.render(scene, camera); renderer.getContext().finish();
  return { ms: Math.round(performance.now() - t), calls: renderer.info.render.calls, tris: renderer.info.render.triangles, geos: renderer.info.memory.geometries }; })()"""

with session() as s:
    pg = s.page(1280, 800)
    print('boom', pg.evaluate(STATS))
    print('render gemonteerd', pg.evaluate(RENDER))
    pg.evaluate("(() => { const L = window.__model; (L.explodeAllUnder || (() => {}))(L.ROOT); L.finishAll(); })()")
    pg.wait_for_timeout(200)
    print('render alles uit', pg.evaluate(RENDER))
    ph = s.page(390, 844, scale=2, touch=True)
    print('telefoon horizontale scroll', ph.evaluate("document.documentElement.scrollWidth > window.innerWidth"))
    s.report()
    sys.exit(1 if s.errors() else 0)
