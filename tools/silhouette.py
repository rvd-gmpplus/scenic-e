"""Silhouettoets: meet de gemonteerde carrosserie met stralen en vergelijkt met het gemeten fase 2-silhouet.

    python3 tools/silhouette.py        # exitcode 1 als de toets niet slaagt

Referentie: data/silhouet.json van deze auto (zijaanzicht, bovenaanzicht en raamlijn, gemeten uit het onderzoek), in het
autoframe (x links +, y omhoog, z voor +), met de toleranties en grenzen erbij. De toets slaagt als hoogstens maxBuiten
stations per reeks buiten de tolerantie vallen en neus en staart in bovenaanzicht smal genoeg zijn (neusMax, staartMax).
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import session

# referentie per auto: data/silhouet.json (framework: de toets is generiek, het silhouet hoort bij de auto)
with open(os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))), 'data', 'silhouet.json'), encoding='utf-8') as _f:
    REF = json.load(_f)
TOP, PLAN, BELT = [tuple(t) for t in REF['top']], [tuple(t) for t in REF['plan']], [tuple(t) for t in REF['belt']]
AXF, AXR = REF['axf'], REF['axr']
# hoogtebereik van de zijstralen voor het bovenaanzicht en van het zoeken naar de raamlijn (per auto; standaard die van de eerste auto)
PLAN_Y, BELT_Y = REF.get('planY', [0.22, 1.05]), REF.get('beltY', [0.80, 1.15])

MEASURE = r"""(cfg) => {
  const L = window.__model; L.collapseAll(); L.finishAll(); L.ROOT.obj.updateMatrixWorld(true);
  const body = L.ALL.find(n => n.name === 'Carrosserie');
  const skip = n => { for (let p = n; p && p !== body; p = p.parent) if (/Buitenspiegel|Antenne|Ruitenwisser|Wisser|greep/i.test(p.name)) return true; return false; };
  const meshes = body.meshes.filter(m => m.visible && !skip(m.userData.node));
  const glassy = m => m.material && (m.material.name === 'glass' || /ruit|glas/i.test(m.userData.node.name));
  const rc = new THREE.Raycaster(); rc.layers.enableAll();   // gebundeld tekenen zet losse meshes op laag 1
  const hitDown = (x, z) => { rc.set(new THREE.Vector3(x, 3, z), new THREE.Vector3(0, -1, 0)); rc.far = 4; const h = rc.intersectObjects(meshes, false)[0]; return h ? h.point.y : null; };
  const hitSide = (y, z) => { rc.set(new THREE.Vector3(2.5, y, z), new THREE.Vector3(-1, 0, 0)); rc.far = 2.6; const h = rc.intersectObjects(meshes, false)[0]; return h ? h : null; };
  const top = cfg.top.map(([z]) => hitDown(0, z));
  const plan = cfg.plan.map(([z]) => { let best = null; for (let y = cfg.planY[0]; y <= cfg.planY[1]; y += 0.02) { const h = hitSide(y, z); if (h && (best === null || h.point.x > best)) best = h.point.x; } return best; });
  const belt = cfg.belt.map(([z]) => { for (let y = cfg.beltY[0]; y <= cfg.beltY[1]; y += 0.004) { const h = hitSide(y, z); if (h && glassy(h.object)) return y; } return null; });
  return { top, plan, belt, meshes: meshes.length };
}"""


def judge(name, ref, got, tol_fn):
    rows, bad = [], 0
    for (z, r), g in zip(ref, got):
        tol = tol_fn(z)
        ok = g is not None and abs(g - r) <= tol
        bad += 0 if ok else 1
        rows.append(f'  {name:5s} z={z:+.3f}  ref {r:.3f}  gemeten {"-" if g is None else f"{g:.3f}"}  {"ok" if ok else "BUITEN TOLERANTIE"}  (±{tol:.2f})')
    return rows, bad


tol = lambda z: REF['tolAs'] if AXR <= z <= AXF else REF['tolOverhang']
with session() as s:
    pg = s.page(800, 600)
    r = pg.evaluate(MEASURE, {'top': TOP, 'plan': PLAN, 'belt': BELT, 'planY': PLAN_Y, 'beltY': BELT_Y})
    out, fails = [], []
    for name, ref, got in (('top', TOP, r['top']), ('plan', PLAN, r['plan']), ('raam', BELT, r['belt'])):
        rows, bad = judge(name, ref, got, tol)
        out += rows
        if bad > REF['maxBuiten']:
            fails.append(f'{name}: {bad} stations buiten tolerantie')
    hw_front, hw_rear = r['plan'][0], r['plan'][-1]
    if hw_front is None or hw_front > REF['neusMax']:
        fails.append(f"neus te breed in bovenaanzicht: halve breedte bij z={PLAN[0][0]:+.2f} is {hw_front}, maximaal {REF['neusMax']}")
    if hw_rear is None or hw_rear > REF['staartMax']:
        fails.append(f"staart te breed in bovenaanzicht: halve breedte bij z={PLAN[-1][0]:+.2f} is {hw_rear}, maximaal {REF['staartMax']}")
    print('\n'.join(out))
    print(f"{r['meshes']} carrosseriemeshes gemeten")
    print('SILHOUET OK' if not fails else 'SILHOUET NIET OK:\n  ' + '\n  '.join(fails))
    s.report()
    sys.exit(1 if fails or s.errors() else 0)
