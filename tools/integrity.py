"""Integriteit van de onderdelenboom: namen, beschrijvingen, geometrie, posities, uitklapvectoren en presets.

    python3 tools/integrity.py        # exitcode 1 bij fouten; waarschuwingen worden alleen gemeld
"""
import sys, os, json
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import session

CHECK = r"""(ANCHORS) => {
  const L = window.__model, err = [], warn = [];
  const path = n => { const a = []; for (let p = n; p; p = p.parent) a.unshift(p.name); return a.join(' › '); };
  L.ROOT.obj.updateMatrixWorld(true);
  const box = new THREE.Box3(), v = new THREE.Vector3();
  // grenzen uit body.js van de auto (framework): halve breedte zonder en met spiegels (BOD_WMAX, BOD_MIRW), hoogte (BOD_H), lengte (ZF, ZR)
  const WMAX = BOD_WMAX, MIRW = BOD_MIRW, HMAX = BOD_H;
  const LIM = { x: MIRW + 0.115, y0: -0.08, y1: HMAX + 0.175, z: Math.max(ZF, -ZR) + 0.135 };
  const pos = new Map();
  const bodyRoot = L.ALL.find(n => n.name === 'Carrosserie');
  L.__inBody = n => { for (let p = n; p; p = p.parent) if (p === bodyRoot) return true; return false; };
  L.__inMirror = n => { for (let p = n; p; p = p.parent) if (/^Buitenspiegel/.test(p.name)) return true; return false; };
  for (const n of L.ALL) {
    if (!n.name || typeof n.name !== 'string') err.push('naamloze knoop ' + n.id);
    if (!n.d || n.d.length < 8) warn.push('geen of korte beschrijving: ' + path(n));
    if (n.asm) {
      if (n.kids.length === 0) err.push('lege groep: ' + path(n));
      else if (n.kids.length === 1) warn.push('groep met één onderdeel: ' + path(n));
      const names = new Map();
      for (const k of n.kids) names.set(k.name, (names.get(k.name) || 0) + 1);
      for (const [k, c] of names) if (c > 1) warn.push(`dubbele naam binnen groep (${c}x): ${path(n)} › ${k}`);
    } else {
      const g = n.obj.geometry, a = g && g.attributes.position;
      if (!a || a.count === 0) { err.push('onderdeel zonder geometrie: ' + path(n)); continue; }
      let bad = false; for (let i = 0; i < a.array.length; i++) if (!Number.isFinite(a.array[i])) { bad = true; break; }
      if (bad) { err.push('NaN in geometrie: ' + path(n)); continue; }
      box.setFromObject(n.obj);
      if (box.isEmpty() || ![box.min.x, box.min.y, box.min.z, box.max.x, box.max.y, box.max.z].every(Number.isFinite)) { err.push('ongeldige box: ' + path(n)); continue; }
      if (box.min.x < -LIM.x || box.max.x > LIM.x || box.min.y < LIM.y0 || box.max.y > LIM.y1 || box.min.z < -LIM.z || box.max.z > LIM.z)
        err.push(`buiten de auto (gemonteerd): ${path(n)} [${box.min.toArray().map(x => x.toFixed(2))} .. ${box.max.toArray().map(x => x.toFixed(2))}]`);
      // audit C08: carrosserie binnen ZR..ZF (6 mm marge voor kentekenplaten) en zonder spiegels niet breder dan BOD_WMAX; spiegels tot BOD_MIRW
      if (n.obj && L.__inBody(n)) {
        const mirror = L.__inMirror(n), wmax = mirror ? MIRW : WMAX;
        if (box.min.x < -wmax || box.max.x > wmax) err.push(`carrosserie breder dan ${wmax.toFixed(3)}${mirror ? ' (spiegel)' : ''}: ${path(n)} [x ${box.min.x.toFixed(3)} .. ${box.max.x.toFixed(3)}]`);
        let ut = 0; for (let p = n; p; p = p.parent) ut = Math.max(ut, p.uitsteek || 0);   // bewust uitstekend (optie uitsteek, zoals een trekhaak)
        if (box.max.z > ZF + 0.006 + ut || box.min.z < ZR - 0.006 - ut) err.push(`carrosserie langer dan ZR..ZF: ${path(n)} [z ${box.min.z.toFixed(3)} .. ${box.max.z.toFixed(3)}]`);
      } else if (box.min.x < -MIRW || box.max.x > MIRW) err.push(`breder dan de spiegels (${MIRW.toFixed(3)}): ${path(n)} [x ${box.min.x.toFixed(3)} .. ${box.max.x.toFixed(3)}]`);
      const key = box.getCenter(v).toArray().map(x => x.toFixed(4)).join(',') + '|' + (g.index ? g.index.count : a.count) + '|' + (n.obj.material && n.obj.material.name);
      if (pos.has(key)) warn.push('dubbel onderdeel op dezelfde plek: ' + path(n) + '  ==  ' + pos.get(key)); else pos.set(key, path(n));
    }
    if (n.parent) {
      const e = n.exv;
      if (!e || ![e.x, e.y, e.z].every(Number.isFinite)) err.push('ongeldige uitklapvector: ' + path(n));
      else if (e.length() < 1e-4) warn.push('uitklapvector nul: ' + path(n));
    }
  }
  const anchorErr = [];
  const A = ANCHORS, count = new Map();
  for (const n of L.ALL) count.set(n.name, (count.get(n.name) || 0) + 1);
  const SPECIAL = new Set(['root_children_order', 'onderstel_children', 'contains', 'content', 'openers', 'preset_ids', 'triangle_budgets']);
  for (const [k, list] of Object.entries(A)) {
    if (SPECIAL.has(k)) continue;
    for (const name of list) { const c = count.get(name) || 0; if (c !== 1) anchorErr.push(`anker "${name}" (${k}) komt ${c}x voor, moet 1x`); }
  }
  // openers: precies deze leiders in de modus Openen, als pad (namen zoals Zijruit komen vier keer voor), niet meer en niet minder
  if (A.openers) {
    const leaders = (typeof OPENERS !== 'undefined' && typeof uiPathOf === 'function') ? OPENERS.map(n => uiPathOf(n)) : [];
    const have = new Set(leaders);
    for (const p of A.openers) if (!have.has(p)) anchorErr.push(`opener "${p}" bestaat niet of is geen leider in de modus Openen`);
    for (const p of have) if (!A.openers.includes(p)) anchorErr.push(`opener "${p}" staat niet in anchors.json (openers)`);
    if (have.size !== A.openers.length) anchorErr.push(`${have.size} openers in de pagina, ${A.openers.length} in anchors.json`);
  }
  // presets: precies deze id's (een verdwenen of hernoemde preset is een fout)
  if (A.preset_ids && L.PRESETS) {
    const ids = L.PRESETS.map(p => p.id);
    for (const id of A.preset_ids) if (!ids.includes(id)) anchorErr.push(`preset "${id}" bestaat niet meer`);
    for (const id of ids) if (!A.preset_ids.includes(id)) anchorErr.push(`preset "${id}" staat niet in anchors.json (preset_ids)`);
  }
  const rc = L.ROOT.kids.map(k => k.name).join(' | '), want = A.root_children_order.join(' | ');
  if (rc !== want) anchorErr.push(`hoofdgroepen: "${rc}" in plaats van "${want}"`);
  const byN = new Map(); for (const n of L.ALL) if (!byN.has(n.name)) byN.set(n.name, n);
  const under = (n, a) => { for (let p = n; p; p = p.parent) if (p === a) return true; return false; };
  for (const [anc, des] of (A.contains || [])) { const a = byN.get(anc), d = byN.get(des); if (a && d && !under(d, a)) anchorErr.push(`"${des}" hoort onder "${anc}" te hangen`); }
  for (const [anc, rules] of Object.entries(A.content || {})) {
    const a = byN.get(anc); if (!a) continue;
    const sub = []; (function w(n) { sub.push(n); n.kids.forEach(w); })(a); sub.shift();
    for (const r of rules) { const re = new RegExp(r.re, "i"); const c = sub.filter(n => (r.groups ? n.asm : r.parts ? !n.asm : true) && re.test(n.name)).length;
      if (c < r.min) anchorErr.push(`"${anc}" bevat ${c} knopen die op /${r.re}/ passen${r.groups ? ' (groepen)' : r.parts ? ' (onderdelen)' : ''}, minimaal ${r.min}`); }
  }
  const on = L.ALL.find(n => n.name === 'Onderstel');
  if (on) { const oc = on.kids.map(k => k.name).slice().sort().join(' | '), ow = A.onderstel_children.slice().sort().join(' | '); if (oc !== ow) anchorErr.push(`Onderstel bevat "${oc}" in plaats van "${ow}"`); }
  // Doorsteken: het hoogste punt van een onderdeel buiten de carrosserie mag niet boven de bovenste carrosseriehuid
  // op dezelfde (x, z) uitkomen (motor door de motorkap, hoofdsteun door het dak, enzovoort).
  const bodyN = L.ALL.find(n => n.name === 'Carrosserie');
  if (bodyN) {
    const bodyMeshes = bodyN.meshes.filter(m => m.visible);
    const rc = new THREE.Raycaster(), down = new THREE.Vector3(0, -1, 0), o = new THREE.Vector3(), w = new THREE.Vector3();
    rc.layers.enableAll();   // gebundeld tekenen zet losse meshes op laag 1
    const isBody = n => { for (let p = n; p; p = p.parent) if (p === bodyN) return true; return false; };
    let checked = 0;
    for (const n of L.ALL) {
      if (n.asm || isBody(n)) continue;
      const a = n.obj.geometry.attributes.position, step = Math.max(1, Math.floor(a.count / 400));
      let top = null;
      for (let i = 0; i < a.count; i += step) { w.fromBufferAttribute(a, i).applyMatrix4(n.obj.matrixWorld); if (!top || w.y > top.y) top = w.clone(); }
      if (!top || top.y < 0.45) continue;
      if (typeof HW === 'function' && Math.abs(top.x) > HW(top.z) - 0.08) continue;   // tegen de flank: deze controle kijkt alleen van boven
      o.set(top.x, 2.5, top.z); rc.set(o, down); rc.far = 3;
      const hits = rc.intersectObjects(bodyMeshes, false), hit = hits[0];
      checked++;
      if (!hit) continue;
      const inHood = h => { for (let p = h.object.userData.node; p; p = p.parent) if (p.name === 'Motorkap') return true; return false; };
      const hood = inHood(hit);
      const gap = hit.point.y - top.y;
      // laagste laag van de motorkap boven dit punt (buitenhuid, binnenframe of isolatiemat): daar moet het onderdeel 5 mm onder blijven
      const low = hood ? hits.filter(inHood).reduce((m, h) => (h.point.y < m.point.y ? h : m), hit) : null;
      if (gap < -0.004) err.push(`steekt boven de carrosserie uit (${(-gap * 100).toFixed(1)} cm door ${hit.object.userData.node.name}): ${path(n)}`);
      else if (hood && gap < 0.025) err.push(`te weinig ruimte onder de motorkap (${(gap * 100).toFixed(1)} cm, minimaal 2,5 cm onder de buitenhuid): ${path(n)}`);
      else if (low && low.point.y - top.y < 0.005) err.push(`raakt een laag van de motorkap (${((top.y - low.point.y) * 100).toFixed(1)} cm door ${low.object.userData.node.name}; minimaal 0,5 cm eronder): ${path(n)}`);
    }
    if (!checked) warn.push('doorsteekcontrole: niets gecontroleerd');
    // Zijkant: onder de gordellijn mogen onderdelen buiten de carrosserie niet buiten de huid steken.
    if (typeof surfX === 'function' && typeof YT === 'function' && typeof YB === 'function') {
      const EXC = /^(Band|Velg|Wielbout|Naafdop|Ventiel|Ventieldop|Bandenspanningssensor|Balansgewicht|Balanceergewicht|Tankklep|Tankdop|Uitlaateindstuk|Uitlaatsierstuk)/;
      const wheels = L.ALL.find(n => n.name === 'Wielen');
      for (const n of L.ALL) {
        if (n.asm || isBody(n) || EXC.test(n.name) || (wheels && under(n, wheels))) continue;
        const a = n.obj.geometry.attributes.position, step = Math.max(1, Math.floor(a.count / 300));
        let worst = 0;
        for (let i = 0; i < a.count; i += step) {
          w.fromBufferAttribute(a, i).applyMatrix4(n.obj.matrixWorld);
          if (w.z > ZF - 0.05 || w.z < ZR + 0.05) continue;
          if (w.y > YT(w.z) - 0.01 || w.y < YB(w.z) + 0.02) continue;
          const ex = Math.abs(w.x) - (surfX(w.z, w.y) - 0.003);
          if (ex > worst) worst = ex;
        }
        if (worst > 0.002) err.push(`steekt zijdelings door de huid (${(worst * 100).toFixed(1)} cm): ${path(n)}`);
      }
    }
  }
  const presetErr = [];
  if (L.checkPresets) presetErr.push(...L.checkPresets());
  return { err, warn, presetErr, anchorErr, nodes: L.ALL.length, parts: L.ALL.filter(n => !n.asm).length };
}"""

ANCHORS = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'anchors.json'), encoding='utf-8'))

with session() as s:
    pg = s.page(1100, 700)
    r = pg.evaluate(CHECK, ANCHORS)
    print(f"{r['nodes']} knopen, {r['parts']} onderdelen")
    print(f"{len(r['err'])} fouten, {len(r['anchorErr'])} ankerfouten, {len(r['warn'])} waarschuwingen, {len(r['presetErr'])} presetfouten")
    for e in r['err'][:60]: print('FOUT  ' + e)
    for e in r['anchorErr'][:60]: print('ANKER ' + e)
    for e in r['presetErr'][:30]: print('PRESET ' + e)
    show = int(os.environ.get('WARN', '25'))
    for w in r['warn'][:show]: print('let op ' + w)
    if len(r['warn']) > show: print(f'... nog {len(r["warn"]) - show} waarschuwingen (WARN=999 voor alles)')
    s.report()
    sys.exit(1 if (r['err'] or r['anchorErr'] or r['presetErr'] or s.errors()) else 0)
