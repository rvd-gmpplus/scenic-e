# Bezetting van kaders: welke meshes (alle domeinen) snijden een kader?
# Gebruik: python3 zone.py WORKTREE '{"naam":{"lo":[x,y,z],"hi":[x,y,z]}}' [motor|auto]
# Standaard in het motorframe (oorsprong krukas-as, +x vliegwielzijde = links in de auto, +y cilinderas, +z inlaatzijde = voor);
# met 'auto' in het autoframe. Geeft per kader de snijdende meshes met hun kader en de hoogte van de carrosserie erboven.
import sys, os, json
if len(sys.argv) < 3: print(open(__file__, encoding='utf-8').read().split('import sys')[0]); sys.exit(2)
repo = sys.argv[1]
sys.path.insert(0, os.path.join(repo, 'tools'))
from harness import session
ZONES = json.loads(sys.argv[2])
FRAME = sys.argv[3] if len(sys.argv) > 3 else 'motor'
with session() as s:
    pg = s.page(400, 300)
    r = pg.evaluate("""([Z, FRAME]) => { const L = window.__model; L.ROOT.obj.updateMatrixWorld(true);
      const eng = L.ALL.find(n => n.parent && n.parent.name === 'Aandrijflijn' && n.name.startsWith('Motor ')); const EW = FRAME === 'auto' ? new THREE.Matrix4() : eng.obj.matrixWorld.clone(); const Minv = EW.clone().invert();
      const v = new THREE.Vector3(), M = new THREE.Matrix4(), out = {};
      const boxes = L.MESHES.map(m => { M.multiplyMatrices(Minv, m.matrixWorld); const a = m.geometry.attributes.position;
        const lo = [1e9,1e9,1e9], hi = [-1e9,-1e9,-1e9];
        for (let i = 0; i < a.count; i++) { v.fromBufferAttribute(a, i).applyMatrix4(M); const c = [v.x, v.y, v.z];
          for (let k = 0; k < 3; k++) { if (c[k] < lo[k]) lo[k] = c[k]; if (c[k] > hi[k]) hi[k] = c[k]; } }
        let p = []; for (let n = m.userData.node; n; n = n.parent) p.unshift(n.name); return { p: p.slice(1).join(' / '), lo, hi }; });
      for (const [name, z] of Object.entries(Z)) { out[name] = boxes.filter(b => b.lo[0] < z.hi[0] && b.hi[0] > z.lo[0] && b.lo[1] < z.hi[1] && b.hi[1] > z.lo[1] && b.lo[2] < z.hi[2] && b.hi[2] > z.lo[2])
          .map(b => b.p + '  x ' + b.lo[0].toFixed(3) + '..' + b.hi[0].toFixed(3) + ' y ' + b.lo[1].toFixed(3) + '..' + b.hi[1].toFixed(3) + ' z ' + b.lo[2].toFixed(3) + '..' + b.hi[2].toFixed(3)); }
      // motorkap boven de zones: straal omlaag in autoframe tegen de carrosserie
      const body = L.ALL.find(n => n.name === 'Carrosserie'); const bm = []; body.obj.traverse(o => { if (o.isMesh) bm.push(o); });
      const rc = new THREE.Raycaster(); rc.layers.enableAll(); const hood = {};
      for (const [name, z] of Object.entries(Z)) { const pts = [];
        for (const ex of [z.lo[0], z.hi[0]]) for (const ey of [z.hi[1]]) for (const ez of [z.lo[2], z.hi[2]]) {
          const w = new THREE.Vector3(ex, ey, ez).applyMatrix4(EW); rc.set(new THREE.Vector3(w.x, 2.5, w.z), new THREE.Vector3(0, -1, 0));
          const h = rc.intersectObjects(bm, false)[0]; pts.push([w.x.toFixed(3), w.y.toFixed(3), w.z.toFixed(3), h ? h.point.y.toFixed(3) : 'geen']); }
        hood[name] = pts; }
      return { out, hood, eng: eng.obj.matrixWorld.elements.map(e => +e.toFixed(4)) }; }""", [ZONES, FRAME])
    for k, v in r['out'].items():
        print('==', k, len(v));
        for l in v: print('  ', l)
    for k, v in r['hood'].items(): print('kap', k, v)
    print('engine matrixWorld', r['eng'])
    s.report()
    sys.exit(1 if s.errors() else 0)
