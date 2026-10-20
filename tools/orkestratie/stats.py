"""Eindcijfers voor de documentatie: boom, presets, tekenopdrachten met en zonder bundelen, timing.

    python3 tools/orkestratie/stats.py REPO UIT.json    exitcode 1 bij consolefouten
"""
import sys, os, json
if len(sys.argv) < 3: print(__doc__); sys.exit(2)
repo, out = sys.argv[1], sys.argv[2]
sys.path.insert(0, os.path.join(repo, 'tools'))
from harness import session
with session() as s:
    pg = s.page(1280, 800)
    r = pg.evaluate("""(() => { const L = __model; const per = {}; let tris = 0, inner = 0, depth = 0;
      for (const n of L.ALL) { depth = Math.max(depth, n.depth || 0); if (n.inner) inner++;
        if (!n.asm) { const g = n.obj.geometry; const t = (g.index ? g.index.count : g.attributes.position.count) / 3; tris += t;
          let top = n; while (top.parent && top.parent.parent) top = top.parent; const k = top === L.ROOT ? 'root' : top.name; per[k] = per[k] || { parts: 0, tris: 0 }; per[k].parts++; per[k].tris += t; } }
      const P = L.PRESETS || []; const cats = {}; for (const p of P) cats[p.cat] = (cats[p.cat] || 0) + 1;
      const res = { nodes: L.ALL.length, groups: L.ALL.filter(n => n.asm).length, parts: L.ALL.filter(n => !n.asm).length, maxDepth: depth, triangles: Math.round(tris), innerNodes: inner, perMainGroup: per, presets: P.length, presetCategories: cats };
      try { res.timing = L.timing ? L.timing() : null; } catch (e) { res.timing = String(e); }
      try { L.batchFlush && L.batchFlush(); L.finishAll(); res.drawCallsBatched = L.drawCalls ? L.drawCalls() : null; if (L.batching) { L.batching(false); res.drawCallsUnbatched = L.drawCalls(); L.batching(true); } res.batchStats = L.batchStats ? L.batchStats() : null; } catch (e) { res.drawErr = String(e); }
      return res; })()""")
    json.dump(r, open(out, 'w'), ensure_ascii=False, indent=1)
    print(json.dumps({k: v for k, v in r.items() if k not in ('perMainGroup',)}, ensure_ascii=False)[:1500])
    s.report()
    sys.exit(1 if s.errors() else 0)
