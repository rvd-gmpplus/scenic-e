"""Zichtbaarheidstoets voor ingesloten onderdelen (inner).

    python3 tools/ui_inner.py            # rapport; exitcode 0
    python3 tools/ui_inner.py --strict   # exitcode 1 als een ingesloten knoop van buitenaf zichtbaar is
    python3 tools/ui_inner.py --json     # rapport ook als JSON op de laatste regel
    python3 tools/ui_inner.py --open     # ook met alle openers open en met elke opener afzonderlijk open

In de gemonteerde stand verbergt de app elke `inner`-knoop (met zijn deelboom) zolang zijn ouder dicht is. Dat mag
alleen als niets ervan van buitenaf te zien is. Deze toets schiet evenwijdige stralen vanuit minstens 200 richtingen
(Fibonacci-bol) op de hele auto en op elke hoofdgroep apart (geïsoleerd), tegen alle meshes, ook de verborgen
ingesloten meshes. Is de eerste treffer een mesh onder een ingesloten knoop, dan zou daar een gat in het beeld
vallen: die knoop wordt gemeld met zijn eigenaar (domeinbestand). Doorzichtige onderdelen (glas) houden geen straal tegen.

Met --open draait dezelfde toets nog eens met alle openers open (openmodus) en daarna met elke opener afzonderlijk
open. Een opener legt ingesloten delen bloot (`uiOpenNear`); dan telt alleen een ingesloten knoop die in die stand
nog verborgen is (`uiInnerHidden`) maar van buitenaf als eerste getroffen wordt: door de opening zou een gat in het
beeld vallen. UI_INNER_OPEN_DIRS (standaard 120) stelt het aantal richtingen per opener in.
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import session

DIRS = int(os.environ.get('UI_INNER_DIRS', '200'))
ODIRS = int(os.environ.get('UI_INNER_OPEN_DIRS', '120'))
OPEN = '--open' in sys.argv

JS = r"""((nDirs, state) => {
  // state: null (gemonteerd, alles dicht), 'all' (alle openers open) of een getal (alleen die opener open)
  const L = __model; L.preset('assembled'); L.finishAll();
  const leaders = L.ALL.filter(n => n.opn && !n.opn.lead);
  const pathOf0 = n => { const a = []; for (let k = n; k && k.parent; k = k.parent) a.unshift(k.name); return a.join('/'); };
  let label = 'dicht';
  if (state === 'all') { L.openAll(1, true); L.finishAll(); label = 'alle openers open'; }
  else if (typeof state === 'number') { L.setOpen(pathOf0(leaders[state]), 1, true); L.finishAll(); label = leaders[state].name + ' open'; }
  L.ROOT.obj.updateMatrixWorld(true);
  const MS = L.MESHES.filter(m => !(m.userData.base || m.material).transparent);
  const top = new Map();  // mesh -> bovenste ingesloten knoop op zijn pad (of null); met open openers alleen wat nog verborgen is
  const isHid = a => a.inner && (state === null || uiInnerHidden(a));
  for (const m of MS) { let t = null; for (let a = m.userData.node; a; a = a.parent) if (isHid(a)) t = a; top.set(m, t); }
  const sph = MS.map(m => { const g = m.geometry; if (!g.boundingSphere) g.computeBoundingSphere(); const s = g.boundingSphere.clone().applyMatrix4(m.matrixWorld); return s; });
  const ray = new THREE.Raycaster(); ray.layers.enableAll();
  const hits = [];
  const owner = n => { const p = []; for (let a = n; a; a = a.parent) p.unshift(a.name); const main = p[1] || '';
    if (main === 'Carrosserie') return 'body.js / bodyparts.js';
    if (main === 'Interieur') return 'interior.js';
    if (main === 'Onderstel') return 'chassis.js';
    if (main === 'Aandrijflijn') return p.some(x => x.startsWith('Motor ')) ? 'engine1.js / engine2.js / engine3.js' : 'drivetrain.js';
    return 'systems.js'; };
  const pathOf = n => { const p = []; for (let a = n.parent; a && a.parent; a = a.parent) p.unshift(a.name); return p.join(' > '); };
  const found = new Map();
  function scan(view, idx, grid) {
    const box = new THREE.Box3(); for (const i of idx) box.union(new THREE.Box3().setFromObject(MS[i]));
    const c = box.getCenter(new THREE.Vector3()), R = box.getSize(new THREE.Vector3()).length() / 2;
    const d = new THREE.Vector3(), right = new THREE.Vector3(), up = new THREE.Vector3(), o = new THREE.Vector3(), tmp = new THREE.Vector3();
    let rays = 0, blocked = 0;
    const cand = [], out = [];
    for (let k = 0; k < nDirs; k++) {
      const y = 1 - 2 * (k + 0.5) / nDirs, r = Math.sqrt(1 - y * y), th = k * Math.PI * (3 - Math.sqrt(5));
      d.set(Math.cos(th) * r, y, Math.sin(th) * r);
      const ref = Math.abs(d.y) > 0.9 ? new THREE.Vector3(1, 0, 0) : new THREE.Vector3(0, 1, 0);
      right.crossVectors(ref, d).normalize(); up.crossVectors(d, right);
      for (let i = 0; i < grid; i++) for (let j = 0; j < grid; j++) {
        const u = ((i + 0.5) / grid * 2 - 1) * R, v = ((j + 0.5) / grid * 2 - 1) * R;
        o.copy(c).addScaledVector(d, 2.2 * R).addScaledVector(right, u).addScaledVector(up, v);
        tmp.copy(d).negate();
        ray.set(o, tmp); rays++;
        cand.length = 0;
        for (const q of idx) { const s = sph[q]; const ox = s.center.x - o.x, oy = s.center.y - o.y, oz = s.center.z - o.z;
          const tc = ox * tmp.x + oy * tmp.y + oz * tmp.z, d2 = ox * ox + oy * oy + oz * oz - tc * tc, r2 = s.radius * s.radius;
          if (d2 > r2) continue; cand.push([tc - Math.sqrt(r2 - d2), q]); }
        if (!cand.length) continue;
        cand.sort((a, b) => a[0] - b[0]);
        let best = Infinity, bm = null;
        for (const [entry, q] of cand) { if (entry > best) break; out.length = 0; MS[q].raycast(ray, out);
          for (const h of out) if (h.distance < best) { best = h.distance; bm = MS[q]; } }
        if (!bm) continue;
        const t = top.get(bm); if (!t) continue;
        blocked++;
        let f = found.get(t); if (!f) found.set(t, (f = { name: t.name, path: pathOf(t), owner: owner(t), hits: 0, views: {}, part: bm.userData.node.name }));
        f.hits++; f.views[view] = (f.views[view] || 0) + 1;
      }
    }
    return { view, rays, inner: blocked };
  }
  const all = MS.map((m, i) => i);
  const views = [scan('hele auto', all, 14)];
  if (typeof state !== 'number') for (const g of L.ROOT.kids) { const set = new Set(g.meshes); const idx = all.filter(i => set.has(MS[i])); if (idx.length) views.push(scan(g.name, idx, 10)); }
  const innerNodes = L.ALL.filter(n => n.inner).length;
  const nOpen = leaders.length;
  L.openAll(0, true); L.finishAll();
  return { innerNodes, views, label, nOpen, offenders: [...found.values()].sort((a, b) => b.hits - a.hits) };
})"""

def show(r, dirs):
    print(f"[{r['label']}] richtingen per weergave: {dirs}")
    for v in r['views']:
        print(f"  {v['view']}: {v['rays']} stralen, {v['inner']} eerste treffers op een ingesloten onderdeel")
    offs = r['offenders']
    if offs:
        print(f"{len(offs)} ingesloten knopen zijn van buitenaf zichtbaar (gat in het beeld als ze verborgen worden):")
        by = {}
        for o in offs:
            by.setdefault(o['owner'], []).append(o)
        for own, lst in by.items():
            print(f'  eigenaar {own}:')
            for o in lst:
                vs = ', '.join(f'{k} {n}' for k, n in o['views'].items())
                print(f"    {o['name']}  ({o['path']})  {o['hits']} treffers [{vs}], bijv. {o['part']}")
    else:
        print('geen ingesloten knoop van buitenaf zichtbaar')
    return offs


with session() as s:
    pg = s.page(1280, 800, timeout=300000)
    pg.set_default_timeout(1200000)
    r = pg.evaluate(JS + f'({DIRS}, null)')
    print(f"ingesloten knopen in de boom: {r['innerNodes']}")
    offs = show(r, DIRS)
    allr = [r]
    if OPEN:
        n = r['nOpen']
        print(f"\nopenmodus: {n} openers")
        states = [('"all"', DIRS)] + [(str(i), ODIRS) for i in range(n)] if n else []
        for st, dirs in states:
            ro = pg.evaluate(JS + f'({dirs}, {st})')
            allr.append(ro)
            offs = offs + show(ro, dirs)
    s.report()
    if '--json' in sys.argv:
        print(json.dumps(allr if OPEN else r))
    sys.exit(1 if ('--strict' in sys.argv and offs) else 0)
