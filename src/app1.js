/* ===================== opbouw en explosielogica ===================== */
// Model-laag van de app: boom doorlopen, uitklaprichtingen, animatie (uitklappen, uitlichten, optillen),
// zichtbaarheid (isolatie en ingesloten onderdelen), materialen, camera-inpassing, vloer en de stap-terug-geschiedenis.
// Golf 5c-2, P4: de render-lus (loop in app2-loop.js) stopt in rust. uiWake() start hem weer; alles wat een animatie begint of de
// scène verandert, roept hem aan (requestRender doet dat ook). Pas na het opstarten (uiLoopLive) doet hij iets.
let uiLoopLive = false, uiLoopOn = false, uiLoopWoke = false;
let needs = true;          // er is iets te tekenen: de lus tekent bij het volgende frame
let uiWasActive = false;   // in het vorige frame bewoog er iets (uiFrame in app2-loop.js; pick in app2-input.js)
function uiWake() {
  if (!uiLoopLive || uiLoopOn) return;
  uiLoopOn = true; uiLoopWoke = true;
  requestAnimationFrame(loop);
}
const requestRender = () => { needs = true; uiWake(); }; // P4: de lus kan stilstaan
const ROOT = (() => {
  const t0 = performance.now();
  uiTiming.buildStart = Math.round(t0);
  LOADING.textContent = TXT.laadBouwen;
  try { const r = buildCar(); uiTiming.buildCar = Math.round(performance.now() - t0); return r; } catch (e) {
    LOADING.textContent = TXT.laadModelFout(e && e.message ? e.message : e);
    throw e;
  }
})();
scene.add(ROOT.obj);
const ALL = [], ASMS = [];
(function walk(n, d) { n.depth = d; ALL.push(n); if (n.asm) ASMS.push(n); n.kids.forEach(k => walk(k, d + 1)); })(ROOT, 0);
const MESHES = [];
ROOT.obj.traverse(o => { if (o.isMesh) MESHES.push(o); });
const SYS_COLORS = { 'Carrosserie': 0x7d93b4, 'Interieur': 0xcaa77a, 'Aandrijflijn': 0xe0782f, 'Onderstel': 0x8a64c8, 'Koeling en luchtinlaat': 0x2fa6a0, 'Uitlaatsysteem': 0x9a6b4b, 'Brandstofsysteem': 0x58a24d, 'Elektrisch systeem': 0xe5c23a };
const SYS_MATS = {};
for (const [k, c] of Object.entries(SYS_COLORS)) SYS_MATS[k] = new THREE.MeshStandardMaterial({ color: c, metalness: 0.15, roughness: 0.55, side: THREE.DoubleSide });
const uiById = new Map();
const uiNames = new Map();     // naam -> eerste knoop
const uiNameCount = new Map(); // naam -> aantal
// U10: zoeknormalisatie als functie (kleine letters, zonder diakrieten), voor namen én zoektermen
const uiNorm = s => String(s).toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
// Knoopschema van de app (golf 5c-2, K5). mkNode (core.js) maakt de knoop met de velden van de boom: id, name, d, spec,
// obj, kids, parent, asm, ex, exs, inner, opn, strut, stay, hideWhen, uitsteek, plus de lege plaatsen amt, target, delay,
// base, exv, sys, depth, count, lc en rad die de app vult. initAppFields zet alle velden die de app bij het opstarten
// toevoegt of vult, op één plek. Zet de velden van een knoop alleen hier; wat elders lui of later komt, staat hieronder.
// De lus loopt achterwaarts door ALL (kinderen vóór hun ouder), want count en bySize lezen de kinderen.
// Later gezet, buiten initAppFields:
//   depth           diepte in de boom (de wandeling die ALL vult, hierboven)
//   exv             uitklapvector in het frame van de ouder (lus na initAppFields: hij leest het midden en de maat van de ouder)
//   stayO, hideN    openmodus: de opener boven een vast deel, de openers die een knoop uitnemen (lussen bij de openmodus)
//   _p, _q, _s, _u  bewaarde stand tijdens uiWithFinal (eindstand voorspellen)
//   _bc, bat, bInfo samenvoegmodus: groep kan gebundeld worden, de bundel en zijn gegevens (uiBatchSync en verder)
//   _la, _lf, _lw, _lh, _lo   labels: ankerlijst, gekozen anker, maat van het label en zijn verschuiving (app2-labels.js)
ROOT.obj.updateMatrixWorld(true);
const _box = new THREE.Box3(), _v = V3(0, 0, 0);
function initAppFields(n) {
  // telling en rust
  n.count = n.asm ? n.kids.reduce((a, k) => a + k.count, 0) : 1;   // aantal onderdelen (bladeren) in de deelboom
  n.base = n.obj.position.clone();                                   // rustpositie in het frame van de ouder
  // hoofdgroep
  let top = n; while (top.parent && top.parent !== ROOT) top = top.parent;
  n.sys = top === ROOT ? null : top.name;                            // naam van de hoofdgroep (null voor de wortel)
  n.isBody = top.name === 'Carrosserie';                             // hoort bij de carrosserie (röntgen, aanwijzen)
  // meshes en maat, in de rustpositie
  n.meshes = [];                                                     // alle meshes in de deelboom
  n.obj.traverse(o => { if (o.isMesh) n.meshes.push(o); });
  _box.makeEmpty();
  for (const m of n.meshes) _box.expandByObject(m);
  if (_box.isEmpty()) _box.setFromCenterAndSize(n.obj.getWorldPosition(V3(0, 0, 0)), V3(0.01, 0.01, 0.01));
  const c = _box.getCenter(V3(0, 0, 0));
  n.rad = Math.max(0.01, _box.getSize(_v).length() / 2);            // halve diagonaal van de omhullende doos (minstens 1 cm)
  n.wc = c.clone();                                                  // midden in wereldcoördinaten
  n.lc = n.obj.worldToLocal(c.clone());                              // midden in het eigen frame (labels, uitlichten, aanwijstip)
  // kinderen
  n.innerKids = n.asm && n.kids.some(k => k.inner);                  // minstens één kind is ingesloten (zichtbaarheid)
  n.bySize = n.asm ? n.kids.slice().sort((a, b) => b.rad - a.rad) : null; // kinderen van groot naar klein (labels)
  n.idx = n.parent ? n.parent.kids.indexOf(n) : 0;                   // plaats onder de ouder (labelnummer idx + 1)
  n.norm = uiNorm(n.name);                                           // naam voor het zoeken (kleine letters, zonder accenten)
  // verschuiving: positie = ... + off, met off naar pull + liftV (uiOffTo, uiStepOff)
  n.off = V3(0, 0, 0);                                               // huidige verschuiving
  n.off0 = V3(0, 0, 0); n.off1 = V3(0, 0, 0);                        // begin en doel van de lopende verschuiving
  n.pull = V3(0, 0, 0);                                              // weggetrokken door een preset
  n.liftV = V3(0, 0, 0);                                             // opgetild (uitlichten, uiLift)
  n.hasOff = false;                                                  // off is niet nul of animeert
  n.ok = 1; n.odur = 0.5; n.odelay = 0;                              // voortgang (0 tot 1), duur en wachttijd in s van de verschuiving
  // uitklappen: amt animeert van a0 naar target (setTarget, stepExplode)
  n.a0 = 0; n.k = 1; n.dur = 0.85;                                   // beginstand, voortgang (0 tot 1) en duur in s
  // zichtbaarheid (applyVisibility)
  n.vis = true;                                                      // zelf zichtbaar
  n.ev = true;                                                       // zichtbaar met alle ouders (aanwijzen, labels)
  // openmodus: ou animeert van opa0 naar ot (uiSetOpen, stepOpen)
  n.ou = 0; n.ot = 0;                                                // huidige en gevraagde openstand (0 dicht, 1 open)
  n.opk = 1; n.opa0 = 0; n.opd = 0.9;                                // voortgang (0 tot 1), beginstand en duur in s
  n.q0 = n.obj.quaternion.clone(); n.s0 = n.obj.scale.clone();       // rustoriëntatie en -schaal
}
for (let i = ALL.length - 1; i >= 0; i--) initAppFields(ALL[i]);
// opzoektabellen, in boomvolgorde (uiNames houdt de eerste knoop met een naam)
for (const n of ALL) {
  uiById.set(n.id, n);
  if (!uiNames.has(n.name)) uiNames.set(n.name, n);
  uiNameCount.set(n.name, (uiNameCount.get(n.name) || 0) + 1);
}
// uitklapvector: weg van het midden van de ouder, of de vaste `ex` van de knoop
for (const n of ALL) {
  if (!n.parent) continue;
  const p = n.parent;
  if (n.ex) { n.exv.copy(n.ex); continue; }
  const pc = p.obj.worldToLocal(p.wc.clone()), cc = p.obj.worldToLocal(n.wc.clone());
  const dir = cc.sub(pc);
  if (dir.length() < 1e-3) dir.set(0, 1, 0);
  const dist = Math.max(0.04, p.exs * (0.35 * p.rad + 0.5 * n.rad));
  n.exv.copy(dir.normalize().multiplyScalar(dist));
}
const byName = name => uiNames.get(name);
function uiByPath(path) {
  const segs = String(path).split('/').map(s => s.trim()).filter(Boolean);
  let n = ROOT;
  if (segs[0] === ROOT.name) segs.shift();
  for (const s of segs) { n = n && n.kids.find(k => k.name === s); if (!n) return null; }
  return n;
}

/* ---------- uitklappen ---------- */
let SPREAD = 1;
let uiSpreadEnd = 1;   // spreiding aan het eind van de lopende animatie (uiExFin)
const DUR = REDUCED ? 0.01 : CFG.tijd.uitklapS;
const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const uiAnim = new Set();     // groepen die animeren
const uiOffAnim = new Set();  // knopen met een animerende verschuiving (uitlichten, optillen)
let uiVisDirty = true;
const uiOpen = n => !!n && n.asm && n.target > 0.5;
// De positieregel (golf 5c-2, K3: was zes varianten): positie = rustpositie (base, of de openpose van een opener)
// + exv x stand van de ouder x spreiding + verschuiving. uiExOff telt de huidige stand op p op (amt, SPREAD, off);
// uiExFin de eindstand van het uitklappen (doel van de ouder en de eindspreiding), zonder verschuiving.
function uiExOff(k, p) {
  if (k.parent) p.addScaledVector(k.exv, k.parent.amt * SPREAD);
  if (k.hasOff) p.add(k.off);
  return p;
}
function uiExFin(k, p) { return p.addScaledVector(k.exv, k.parent.target * uiSpreadEnd); }
function placeKids(n) { for (const k of n.kids) uiPlace(k); }
function uiPlace(k) {
  if (k.ou > 0) uiOpenPose(k); else k.obj.position.copy(k.base);
  uiExOff(k, k.obj.position);
}

/* ---------- openmodus: scharnieren, schuiven, volgers, vaste delen en telescopen ---------- */
// Een knoop met `open` draait om een scharnier of schuift, bovenop de uitklapregel:
//   pos = pivot + R(u * angle) * (base - pivot) + exv * amt * SPREAD + off,  quat = R * q0
// 'slide': eerst `tilt` (eerste deel van u, standaard 35 %, met optioneel `rise`: een verschuiving tijdens het kantelen), dan `move` (recht)
// en/of `arc` (draaien om een verre as, zodat een paneel de kromming van het dak volgt). u is de geanimeerde openstand (0 tot 1).
// Een volger (`follow`) beweegt met de u van zijn leider. Een knoop met `stay` in de deelboom van een
// opener blijft staan als die opener draait (carrosseriezijde van een scharnier, afdichting). Een volger
// met `stay` beweegt in het frame van de rustende opener (motorkapsteun onder de motorkap).
// Een telescoop (`strut`) wordt na elke stap van punt a naar punt b gericht; zijn kind `rod` schuift mee.
// `needs`: openen opent eerst die andere opener; sluiten van die andere sluit eerst deze.
// Verwijzingen (follow, needs, strut.a.node, strut.b.node, strut.lead) zijn een pad vanaf de wortel of een unieke naam.
const OPENERS = [];            // leiders, in boomvolgorde
const uiOpenAnim = new Set();  // leiders die bewegen
const STRUTS = [], STAYS = [];
const uiOq = new THREE.Quaternion(), uiOq2 = new THREE.Quaternion(), uiOv = V3(0, 0, 0), uiOv2 = V3(0, 0, 0);
const uiOm = new THREE.Matrix4(), uiOm2 = new THREE.Matrix4(), uiOm3 = new THREE.Matrix4(), uiOs = V3(1, 1, 1);
const UI_Z = V3(0, 0, 1);
// Verwijzing naar een knoop: een pad vanaf de wortel (met /) of een naam die precies één keer voorkomt; anders null.
// uiResolve zwijgt (presets toetsen zelf), uiRef meldt een verwijzing die niet oplost (golf 5c-2, K3: was drie kopieën).
function uiResolve(ref) { return !ref ? null : ref.includes('/') ? uiByPath(ref) : (uiNameCount.get(ref) === 1 ? uiNames.get(ref) : null); }
function uiRef(ref, who) {
  if (!ref) return null;
  const n = uiResolve(ref);
  if (!n) console.error('openmodus: verwijzing ' + JSON.stringify(ref) + ' van ' + who + ' lost niet op' + (uiNameCount.get(ref) > 1 ? ' (naam niet uniek, gebruik een pad)' : ''));
  return n;
}
const uiPathOf = n => { const a = []; for (let k = n; k; k = k.parent) a.unshift(k.name); return a.join('/'); };
const uiRelPath = n => uiPathOf(n).replace(/^[^/]+\//, ''); // pad zonder wortel (sleutel van de nummergegevens en van ?open=)
const uiOpenAnc = n => { for (let p = n.parent; p; p = p.parent) if (p.opn) return p; return null; };
for (const n of ALL) {
  const o = n.opn;
  if (o) {
    o.type = o.type || 'hinge';
    if (o.pivot) o.pv = V3(...o.pivot);
    if (o.axis) o.ax = V3(...o.axis).normalize();
    if (o.move) o.mv = V3(...o.move);
    if (o.arc) { o.apv = V3(...o.arc.pivot); o.aax = V3(...o.arc.axis).normalize(); o.aang = o.arc.angle; }
    if (o.tilt) { o.tpv = V3(...o.tilt.pivot); o.tax = V3(...o.tilt.axis).normalize(); o.tang = o.tilt.angle; o.tf = o.tilt.part != null ? o.tilt.part : 0.35; if (o.tilt.rise) o.trs = V3(...o.tilt.rise); }
    o.dur = o.dur || (REDUCED ? 0.01 : CFG.tijd.openS);
    o.followers = []; o.stays = []; o.struts = []; o.needBy = [];
    if (o.type === 'hinge' && (!o.pv || !o.ax || typeof o.angle !== 'number')) console.error('openmodus: scharnier ' + n.name + ' mist pivot, axis of angle');
  }
}
for (const n of ALL) {
  const o = n.opn;
  if (o && o.follow) {
    const lead = uiRef(o.follow, n.name);
    if (lead && lead.opn && !lead.opn.follow) { lead.opn.followers.push(n); o.lead = lead; } else console.error('openmodus: volger ' + n.name + ' zonder leider ' + o.follow);
  } else if (o) OPENERS.push(n);
  if (o && o.needs) o.needSpec = o.needs;
  if (n.stay) { const anc = uiOpenAnc(n); if (anc) { n.stayO = anc; STAYS.push(n); if (!o) (anc.opn.lead ? anc.opn.lead : anc).opn.stays.push(n); } else console.error('openmodus: ' + n.name + ' heeft stay maar geen opener erboven'); }
}
// needs: deze opener kan pas open als een andere open is (panoramadak: eerst het zonnescherm)
for (const n of OPENERS) n.opn.vis = uiOpenVis(n);
// hideWhen: de knoop is uitgenomen zolang een van de genoemde openers open is; die openers markeren de zichtbaarheid als vuil
for (const n of ALL) {
  if (!n.hideWhen) continue;
  n.hideN = n.hideWhen.map(r => uiRef(r, n.name)).filter(m => { if (m && m.opn && !m.opn.lead) { m.opn.vis = true; return true; } console.error('openmodus: hideWhen van ' + n.name + ' lost niet op'); return false; });
}
for (const n of OPENERS) { const o = n.opn; if (!o.needSpec) continue; const m = uiRef(o.needSpec, n.name); if (m && m.opn && !m.opn.lead) { o.needN = m; m.opn.needBy.push(n); } else console.error('openmodus: needs van ' + n.name + ' lost niet op'); }
for (const n of ALL) {
  if (!n.strut) continue;
  const s = n.strut;
  if (!s.a || !s.b || !s.a.node || !s.b.node) { console.error('openmodus: telescoop ' + n.name + ' heeft a.node en b.node nodig'); continue; }
  s.na = uiRef(s.a.node, n.name); s.nb = uiRef(s.b.node, n.name);
  s.pa = V3(...s.a.p); s.pb = V3(...s.b.p);
  s.rodN = s.rod ? n.kids.find(k => k.name === s.rod) : null;
  let lead = s.lead ? uiRef(s.lead, n.name) : null;
  if (!lead && s.nb) lead = s.nb.opn ? s.nb : uiOpenAnc(s.nb);
  if (lead && lead.opn && lead.opn.lead) lead = lead.opn.lead;
  if (!s.na || !s.nb || !lead) { console.error('openmodus: telescoop ' + n.name + ' onvolledig'); continue; }
  s.leadN = lead; s.dirty = false; lead.opn.struts.push(n); STRUTS.push(n);
}
// pose van een openende knoop in het frame van zijn ouder (zonder uitklapverschuiving)
function uiOpenPose(k) {
  const o = k.opn, u = k.ou, p = k.obj.position;
  p.copy(k.base); k.obj.quaternion.copy(k.q0);
  if (o.type === 'slide') {
    let us = u;
    const more = o.mv || o.apv;
    if (o.tax) {
      const ut = more ? Math.min(1, u / o.tf) : u;
      us = more ? Math.max(0, (u - o.tf) / (1 - o.tf)) : 0;
      uiOq.setFromAxisAngle(o.tax, o.tang * ut);
      p.sub(o.tpv).applyQuaternion(uiOq).add(o.tpv);
      k.obj.quaternion.premultiply(uiOq);
      if (o.trs) p.addScaledVector(o.trs, ut);   // rise: tijdens het kantelen recht omhoog (een draaidop die losdraait)
    }
    if (o.apv) { uiOq.setFromAxisAngle(o.aax, o.aang * us); p.sub(o.apv).applyQuaternion(uiOq).add(o.apv); k.obj.quaternion.premultiply(uiOq); }
    if (o.mv) p.addScaledVector(o.mv, us);
    return;
  }
  uiOq.setFromAxisAngle(o.ax, o.angle * u);
  p.sub(o.pv).applyQuaternion(uiOq).add(o.pv);
  k.obj.quaternion.premultiply(uiOq);
}
// vaste delen: Lk' = A^-1 * Ocur^-1 * X * A * Lk (X = rustmatrix van de opener O, A = tussenliggende groepen)
function uiStayFix(k) {
  const O = k.stayO;
  if (O.ou === 0) { if (!k.opn) { uiPlace(k); k.obj.quaternion.copy(k.q0); k.obj.scale.copy(k.s0); } return; }
  O.obj.updateMatrix();
  uiOm.identity();
  for (let p = k.parent; p && p !== O; p = p.parent) { p.obj.updateMatrix(); uiOm.premultiply(p.obj.matrix); }   // A
  uiExOff(O, uiOv.copy(O.base));
  uiOm2.compose(uiOv, O.q0, O.s0);                                   // X
  uiOm3.copy(O.obj.matrix).invert().multiply(uiOm2).multiply(uiOm);   // Ocur^-1 * X * A
  if (!k.opn) { uiExOff(k, k.obj.position.copy(k.base)); k.obj.quaternion.copy(k.q0); k.obj.scale.copy(k.s0); }
  k.obj.updateMatrix();
  uiOm2.copy(uiOm).invert().multiply(uiOm3).multiply(k.obj.matrix);
  uiOm2.decompose(k.obj.position, k.obj.quaternion, uiOs); k.obj.scale.copy(uiOs);
}
function uiOpenApply(n) {
  uiPlace(n);
  if (n.ou === 0) { n.obj.quaternion.copy(n.q0); }
  for (const f of n.opn.followers) { f.ou = n.ou; uiPlace(f); if (f.ou === 0) f.obj.quaternion.copy(f.q0); if (f.stay) uiStayFix(f); }
  for (const k of n.opn.stays) uiStayFix(k);
}
// raakt het open of dicht gaan van deze opener de zichtbaarheid van ingesloten delen (bij de ouder of eronder)
function uiOpenVis(n) { const sub = k => k.inner || (k.asm && k.kids.some(sub)); return !!((n.parent && n.parent.innerKids) || (n.asm && n.kids.some(sub)) || n.opn.followers.some(f => f.parent && f.parent.innerKids)); }
function uiSetOpen(n, v, instant) {
  if (typeof n === 'string') n = uiRef(n, 'setOpen');
  if (!n || !n.opn || n.opn.lead) return false;
  v = clamp(+v || 0, 0, 1);
  if (v > 0 && n.opn.needN && n.opn.needN.ot === 0) uiSetOpen(n.opn.needN, 1, instant);
  if (v === 0) for (const d of n.opn.needBy) if (d.ot > 0) uiSetOpen(d, 0, instant);
  if (n.opn.vis && ((n.ot > 0) !== (v > 0) || (n.ou > 0) !== (v > 0))) uiVisDirty = true;
  if (instant || REDUCED) { n.ot = v; n.ou = v; n.opk = 1; uiOpenAnim.delete(n); uiOpenApply(n); uiStrutSync(); uiWake(); return true; }
  if (n.ot === v && (uiOpenAnim.has(n) || n.ou === v)) return true;
  n.ot = v; n.opa0 = n.ou; n.opk = 0;
  n.opd = Math.max(0.05, n.opn.dur * Math.max(0.45, Math.abs(v - n.ou)));
  uiOpenAnim.add(n); uiWake();
  return true;
}
function stepOpen(dt) {
  if (!uiOpenAnim.size) return false;
  for (const n of uiOpenAnim) {
    const was = n.ou > 0;
    n.opk = Math.min(1, n.opk + dt / n.opd);
    n.ou = n.opk >= 1 ? n.ot : n.opa0 + (n.ot - n.opa0) * ease(n.opk);
    uiOpenApply(n);
    if (n.opn.vis && was !== (n.ou > 0)) uiVisDirty = true;
    if (n.opk >= 1) uiOpenAnim.delete(n);
  }
  uiStrutSync();
  return true;
}
// Na een uitklapstap staan de onderdelen op base + exv; een open opener moet daarna zijn volgers, vaste delen en
// telescopen opnieuw zetten (een open achterklep in Uitklappen: de gasveren blijven aan hun ankers)
function uiOpenResync() {
  let any = false;
  for (const n of OPENERS) if (n.ou > 0) { uiOpenApply(n); any = true; }
  if (any) uiStrutSync();
}
// telescopen: richten van a naar b zolang hun leider open is; daarna terug naar de gebouwde stand
function uiStrutSync() {
  if (!STRUTS.length) return;
  for (const n of STRUTS) {
    const s = n.strut;
    if (s.leadN.ou === 0) {
      if (s.dirty) { uiPlace(n); n.obj.quaternion.copy(n.q0); if (s.rodN) uiPlace(s.rodN); s.dirty = false; }
      continue;
    }
    const par = n.parent.obj;
    par.updateWorldMatrix(true, false); s.na.obj.updateWorldMatrix(true, false); s.nb.obj.updateWorldMatrix(true, false);
    const a = par.worldToLocal(s.na.obj.localToWorld(uiOv.copy(s.pa)));
    const b = par.worldToLocal(s.nb.obj.localToWorld(uiOv2.copy(s.pb)));
    if (s.d0 === undefined) s.d0 = s.restLen || s.pb.distanceTo(s.pa);
    const d = b.distanceTo(a);
    n.obj.position.copy(a);
    uiOq2.setFromUnitVectors(UI_Z, b.sub(a).normalize());
    n.obj.quaternion.copy(uiOq2);
    if (s.rodN) { s.rodN.obj.position.copy(s.rodN.base); s.rodN.obj.position.z += d - s.d0; }
    s.dirty = true;
  }
}
// knopen die in de eindstand anders staan (voor camera en kaders): openers, volgers, vaste delen, telescopen
function uiOpenFinalNodes() {
  const out = [];
  for (const n of OPENERS) if (n.ou > 0 || n.ot > 0) { out.push(n, ...n.opn.followers, ...n.opn.stays, ...n.opn.struts); for (const t of n.opn.struts) if (t.strut.rodN) out.push(t.strut.rodN); }
  return out;
}
function uiOpenFinalPose() {
  for (const n of OPENERS) if (n.ou > 0 || n.ot > 0) {
    n.ou = n.ot;
    if (n.ou > 0) { uiOpenPose(n); uiExFin(n, n.obj.position); } else n.obj.quaternion.copy(n.q0);
    for (const f of n.opn.followers) { f.ou = n.ou; if (f.ou > 0) { uiOpenPose(f); uiExFin(f, f.obj.position); } else f.obj.quaternion.copy(f.q0); if (f.stay) uiStayFix(f); }
    for (const k of n.opn.stays) uiStayFix(k);
  }
  const keep = STRUTS.map(t => t.strut.dirty);
  uiStrutSync();
  STRUTS.forEach((t, i) => { t.strut.dirty = keep[i]; });
}

function setTarget(n, t, delay = 0, dur = DUR) {
  if (!n || !n.asm) return;
  t = clamp(+t || 0, 0, 1);
  if (n.target === t) { if (uiAnim.has(n)) n.delay = Math.min(n.delay, delay); return; }
  const was = n.target;
  n.target = t; n.a0 = n.amt; n.k = 0; n.delay = REDUCED ? 0 : Math.max(0, delay);
  n.dur = REDUCED ? 0.01 : Math.max(0.05, dur * Math.max(0.45, Math.abs(t - n.amt)));
  uiAnim.add(n); uiWake();
  if (n.innerKids && (was === 0) !== (t === 0)) uiVisDirty = true;
}
function uiSetNow(n, t) { // direct, zonder animatie (schuif en afspelen)
  if (!n.asm) return;
  t = clamp(t, 0, 1);
  if (n.target === t && n.amt === t && !uiAnim.has(n)) return;
  const was = n.target;
  n.target = t; n.amt = t; n.delay = 0; n.k = 1; uiAnim.delete(n);
  placeKids(n);
  uiOpenResync(); uiWake();
  if (n.innerKids && (was === 0) !== (t === 0)) uiVisDirty = true;
}
function stepExplode(dt) {
  if (!uiAnim.size) return false;
  for (const n of uiAnim) {
    if (n.delay > 0) { n.delay -= dt; if (n.delay > 0) continue; }
    n.k = Math.min(1, n.k + dt / n.dur);
    n.amt = n.k >= 1 ? n.target : n.a0 + (n.target - n.a0) * ease(n.k);
    placeKids(n);
    if (n.k >= 1) { uiAnim.delete(n); if (n.innerKids && n.target === 0) uiVisDirty = true; }
  }
  uiOpenResync();
  return true;
}
/* verschuivingen: optillen (preset) en uitlichten (klik op een onderdeel in een open groep) */
function uiOffTo(n, dur = 0.55, delay = 0) {
  n.off1.copy(n.pull).add(n.liftV);
  if (n.off1.distanceToSquared(n.off) < 1e-14 && !uiOffAnim.has(n)) return;
  n.off0.copy(n.off); n.ok = 0; n.odur = REDUCED ? 0.01 : dur; n.odelay = REDUCED ? 0 : delay; n.hasOff = true;
  uiOffAnim.add(n); uiWake();
}
function uiStepOff(dt) {
  if (!uiOffAnim.size) return false;
  for (const n of uiOffAnim) {
    if (n.odelay > 0) { n.odelay -= dt; if (n.odelay > 0) continue; }
    n.ok = Math.min(1, n.ok + dt / n.odur);
    if (n.ok >= 1) { n.off.copy(n.off1); uiOffAnim.delete(n); if (n.off.lengthSq() === 0) n.hasOff = false; }
    else n.off.lerpVectors(n.off0, n.off1, ease(n.ok));
    uiPlace(n);
  }
  return true;
}
let uiLifted = null;
function uiLiftDist(n) { return clamp(0.6 * n.rad, 0.02, 0.25); }
function uiLift(n) {
  if (!n || !n.parent) return;
  if (uiLifted && uiLifted !== n) uiDrop();
  const g = n.parent, dir = n.exv.clone();
  if (dir.lengthSq() < 1e-10) {
    ROOT.obj.updateMatrixWorld(true);
    const w = n.obj.localToWorld(n.lc.clone());
    dir.copy(g.obj.worldToLocal(w)).sub(g.lc);
    if (dir.lengthSq() < 1e-10) dir.set(0, 1, 0);
  }
  n.liftV.copy(dir.normalize().multiplyScalar(uiLiftDist(n)));
  uiLifted = n;
  uiOffTo(n, 0.45);
}
function uiDrop() {
  if (!uiLifted) return;
  uiLifted.liftV.set(0, 0, 0); uiOffTo(uiLifted, 0.35);
  uiLifted = null;
}
function subtree(n, out = []) { out.push(n); n.kids.forEach(k => subtree(k, out)); return out; }
// F4: wachttijd per laag van een trapsgewijze beweging over k lagen; de lagen samen wachten hoogstens max seconden
const uiStaffel = (stap, k, max) => (REDUCED ? 0 : Math.min(stap, max / Math.max(1, k - 1)));
function explodeAllUnder(n) {
  const asm = subtree(n).filter(a => a.asm), md = Math.max(0, ...asm.map(a => a.depth - n.depth));
  const st = uiStaffel(CFG.tijd.allesStaffelS, md + 1, CFG.tijd.allesStaffelMaxS);
  asm.forEach(a => setTarget(a, 1, (a.depth - n.depth) * st));
}
function collapseTree(n) {
  const list = subtree(n).filter(a => a.asm);
  const md = Math.max(...list.map(a => a.depth));
  list.forEach(a => setTarget(a, 0, (md - a.depth) * (REDUCED ? 0 : 0.1)));
  if (uiLifted && isUnder(uiLifted, n)) uiDrop();
}
function collapseAll() { collapseTree(ROOT); }
function ancestors(n) { const a = []; for (let p = n.parent; p; p = p.parent) a.unshift(p); return a; }
function isUnder(n, a) { for (let p = n; p; p = p.parent) if (p === a) return true; return false; }

/* ---------- zichtbaarheid en materialen ---------- */
let ISO = [];
let XRAY = false, SYSCOL = false, SEL = null;
let OPENMODE = false;   // klikmodus Openen (bediening in app2-controls.js): een klik opent of sluit openers in plaats van uit te klappen
let MODE = 'part', LABELS = true;   // klikmodus van het dock (UI_MODES in app2-panel.js) en de schakelaar Labels
let CTX = null, ACTIVE_PRESET = 'assembled'; // groep die de labels krijgt na de laatste handeling; actieve preset (null: geen)
let uiLabelForce = false;          // de labels van CTX gaan voor (preset met `labels`, uiLabelGroup in app2-labels.js)
const uiPickable = [];
let uiPickVer = 0;
let uiFade = null; // U4: lopende fade bij isoleren, { t: verstreken s, out: Set<mesh> }
function uiInScope(a) { return !ISO.length || ISO.some(r => isUnder(a, r)); }
// Ingesloten onderdelen (inner) zijn niet te zien zolang hun oudergroep dicht is; dan tekenen we ze niet.
// Staat de ouder zelf buiten de isolatie (je isoleert het ingesloten deel), dan is er niets dat het verbergt.
// een open opener (de ouder zelf of een broer) legt de ingesloten delen van die ouder bloot
const uiOpenNear = (p, fin) => (fin ? p.ot : p.ou) > 0 || p.kids.some(k => k.opn && (fin ? (k.opn.lead ? k.opn.lead.ot : k.ot) : k.ou) > 0);
// fin: in de eindstand (na alle lopende animaties; voor camera en kaders), anders de stand van nu (golf 5c-2, K3: was ook uiPredHidden)
function uiInnerHidden(n, fin = false) { const p = n.parent; return !!(n.inner && p && p.target === 0 && (fin || p.amt < 1e-4) && uiInScope(p) && !uiOpenNear(p, fin)); }
function applyVisibility() {
  const onPath = new Set();
  for (const r of ISO) for (let a = r.parent; a; a = a.parent) onPath.add(a);
  uiPickable.length = 0;
  (function walk(n, inside, pv) {
    const ins = inside || !ISO.length || ISO.includes(n);
    const own = (ins || onPath.has(n)) && !uiInnerHidden(n) && !(n.hideN && n.hideN.some(m => m.ot > 0));
    n.obj.visible = own; n.vis = own; n.ev = pv && own;
    if (!n.asm) { if (n.ev && ins) uiPickable.push(n.obj); return; }
    for (const k of n.kids) walk(k, ins, n.ev);
  })(ROOT, false, true);
  if (uiFade) uiFadeShow(); // U4: wat uitfadet blijft tot het einde van de fade getekend
  uiVisDirty = false; uiPickVer++;
}
// U4: overgang bij isoleren. Wat uit beeld gaat, wordt CFG.tijd.isoFadeMs lang als vervagend spook getekend (één gedeeld
// materiaal, geen kloon per mesh) en pas daarna verborgen. De zichtbaarheid (ev, aanwijzen, labels) staat al meteen
// op de nieuwe stand; alleen obj.visible van de vervagende meshes en hun groepen wordt zolang overschreven.
const uiFadeMat = new THREE.MeshBasicMaterial({ color: 0xaab5c2, transparent: true, opacity: 0.5, depthWrite: false, toneMapped: false });
uiFadeMat.name = 'uiFade';
// uitsnijdende klonen van het vervaagmateriaal (uiCut) vervagen mee
const uiFadeCuts = new Set();
// de alphaTest schaalt mee met de dekking: anders valt het opschrift weg zodra de dekking onder de drempel zakt, terwijl de rest nog vervaagt
function uiFadeSync() { for (const c of uiFadeCuts) { c.opacity = uiFadeMat.opacity; c.alphaTest = Math.max(1e-3, c.userData.at0 * c.opacity); } }
function uiVisibleMeshes() { const s = new Set(); for (const m of MESHES) if (m.userData.node.ev) s.add(m); return s; }
function uiFadeShow() {
  for (const m of uiFade.out) for (let o = m; o && o !== scene; o = o.parent) o.visible = true;
}
// before: de zichtbare meshes vóór de wijziging (uiVisibleMeshes); na applyVisibility() aanroepen
function uiFadeFrom(before) {
  if (uiFade) { uiFade = null; applyVisibility(); } // een lopende fade eindigt eerst (zijn meshes stonden nog zichtbaar)
  if (REDUCED || !before) return false;
  const out = new Set();
  for (const m of before) if (!m.userData.node.ev) out.add(m);
  if (!out.size) return false;
  uiFade = { t: 0, out }; uiWake();
  uiFadeMat.opacity = 0.5; uiFadeSync();
  uiFadeShow();
  for (const m of out) m.material = uiCut(m.userData.base, uiFadeMat);
  return true;
}
function uiFadeEnd() { if (!uiFade) return; uiFade = null; applyVisibility(); applyMats(); }
function uiStepFade(dt) {
  if (!uiFade) return false;
  uiFade.t += dt;
  const k = Math.min(1, uiFade.t / (CFG.tijd.isoFadeMs / 1000));
  uiFadeMat.opacity = 0.5 * (1 - k); uiFadeSync();
  if (k >= 1) uiFadeEnd();
  return true;
}
// Markering door de kleur zelf te verschuiven (een optelsom met emissive verdwijnt op glanzend, licht metaal:
// gemeten 218 -> 222 in rood op de lak). Minder metaal en minder reflectie, zodat de tint ook op de lak leesbaar is.
function uiTint(base, hex, k) {
  const m = base.clone(), c = new THREE.Color(hex);
  if (m.color) m.color.lerp(c, k);
  m.emissive = c.clone(); m.emissiveIntensity = 0.28;
  if (m.metalness != null) m.metalness = Math.min(m.metalness, 0.15);
  if (m.roughness != null) m.roughness = Math.max(m.roughness, 0.5);
  if (m.envMapIntensity != null) m.envMapIntensity = Math.min(m.envMapIntensity, 1) * 0.45;
  if (m.clearcoat) m.clearcoat = 0.15;
  if (m.transparent) m.opacity = Math.max(m.opacity, 0.55);
  return m;
}
// U19: bij duiken naar een onderdeel wordt de rest van de auto gedimd (een doorschijnend spookmateriaal), zodat het
// onderdeel eruit springt en niets ervoor staat. DIM is de focusknoop: alles erbuiten is gedimd. Aanwijzen en klikken
// blijft werken, maar een klik raakt liever iets in de focus dan een gedimd deel ervoor (zie pick in app2-input.js).
let DIM = null, uiDimSet = null, uiDimOn = true;
// Vlak en eenzijdig getekend: een doorschijnend, dubbelzijdig PBR-materiaal kostte op 2.500 meshes zes keer zoveel tekentijd
// (twee doorgangen per mesh en de volledige belichting); voor een spook doet een vlakke kleur hetzelfde.
const uiDimMat = new THREE.MeshBasicMaterial({ color: 0xaab5c2, transparent: true, opacity: 0.14, depthWrite: false, toneMapped: false });
function uiDimmed(m) { return !!uiDimSet && !uiDimSet.has(m); }
// Zet de focus: een groep zelf, een onderdeel via zijn ouder (de broers blijven het gezelschap). null of de wortel: uit.
function uiSetDim(n) {
  const f = n && uiDimOn ? (n.asm ? n : n.parent) : null, nf = f && f !== ROOT ? f : null;
  if (nf === DIM) return false;
  DIM = nf; uiDimSet = nf ? new Set(nf.meshes) : null;
  return true;
}
const uiHV = new Map(), uiSL = new Map();
function uiHvMat(base) { let m = uiHV.get(base); if (!m) { m = uiTint(base, 0x3d8cff, 0.7); uiHV.set(base, m); } return m; }
function uiSelMat(base) { let m = uiSL.get(base); if (!m) { m = uiTint(base, 0xf2c230, 0.75); uiSL.set(base, m); } return m; }
const uiGhostHv = new THREE.MeshStandardMaterial({ color: 0x5aa0ff, emissive: 0x2f86ff, emissiveIntensity: 0.3, transparent: true, opacity: 0.3, depthWrite: false, side: THREE.DoubleSide });
let uiSelSet = new Set(), uiHovSet = new Set(), uiHovNode = null;
// uitsnijdend materiaal (alphaTest met een textuur, zoals een opschrift): een vervangend materiaal (systeemkleur, dimmen, vervagen,
// markering) houdt de textuur, de alphaTest en de polygonOffset van het basismateriaal, anders wordt het opschrift een dichte plaat
const uiCutC = new WeakMap();
function uiCut(base, mat) {
  if (!base.alphaTest || mat === base || mat.map) return mat;
  let c = uiCutC.get(base); if (!c) uiCutC.set(base, c = new Map());
  let r = c.get(mat);
  if (!r) { r = mat.clone(); r.map = base.map; r.alphaTest = base.alphaTest; r.polygonOffset = base.polygonOffset; r.polygonOffsetFactor = base.polygonOffsetFactor; r.polygonOffsetUnits = base.polygonOffsetUnits; c.set(mat, r); if (mat === uiFadeMat) { r.userData.at0 = base.alphaTest; uiFadeCuts.add(r); } }
  return r;
}
function uiMatFor(m) { return uiCut(m.userData.base, uiMatPick(m)); }
function uiMatPick(m) {
  const n = m.userData.node;
  let mat = m.userData.base;
  if (SYSCOL && n.sys) mat = SYS_MATS[n.sys] || mat;
  const ghost = XRAY && n.isBody;
  if (ghost) mat = GHOST;
  const dim = uiDimmed(m);
  if (uiFade && uiFade.out.has(m)) return uiFadeMat;
  if (uiSelSet.has(m)) return ghost ? GHOST_HL : uiSelMat(mat);
  if (uiHovSet.has(m)) return ghost || dim ? uiGhostHv : uiHvMat(mat);
  return dim && !ghost ? uiDimMat : mat;
}
// Golf 5c-2, P2: select() en uiAfterAction() roepen dit allebei aan; de lus over alle meshes loopt alleen als een invoer van
// uiMatFor sindsdien is veranderd. De sets en de fade worden bij elke wijziging vervangen, dus vergelijken op identiteit
// volstaat (uiSetHover en uiFadeFrom schrijven zelf materialen en vervangen daarbij hun set: de volgende keer loopt de lus).
let uiMatKey = null;
function applyMats() {
  // een gekozen opener (portier, kap) krijgt geen gele tint: hij is het doel van de klik en zou anders geel blijven
  // uiMode staat later in het script (app2-panel.js); hij wordt pas gelezen met een selectie, en SEL is null tot de start
  const showHl = SEL && SEL !== ROOT && !ISO.includes(SEL) && (!SEL.asm || SEL.target <= 0.5) && uiMode().tint(SEL);
  const key = [showHl ? SEL : null, SYSCOL, XRAY, uiDimSet, uiFade, uiHovSet];
  if (uiMatKey && key.every((v, i) => v === uiMatKey[i])) return;
  uiMatKey = key;
  uiSelSet = showHl ? new Set(SEL.meshes) : new Set();
  for (const m of MESHES) m.material = uiMatFor(m);
}
// Aanwijs-markering: alleen de meshes die veranderen krijgen een ander materiaal.
function uiSetHover(n) {
  if (n === uiHovNode) return false;
  uiHovNode = n;
  const next = new Set(n && n !== ROOT ? n.meshes : []);
  const changed = [];
  for (const m of uiHovSet) if (!next.has(m)) changed.push(m);
  for (const m of next) if (!uiHovSet.has(m)) changed.push(m);
  uiHovSet = next;
  for (const m of changed) m.material = uiMatFor(m);
  return changed.length > 0;
}

/* ---------- camera ---------- */
const VIEW = { l: 0, r: 0, t: 0, b: 0 };
let W = 1, H = 1;
const DIRS = { iso: V3(1, 0.42, 1.08), front: V3(0.12, 0.22, 1), rear: V3(-0.15, 0.3, -1), side: V3(1, 0.1, 0.02), top: V3(0.0001, 1, 0.12), isoRear: V3(-1, 0.45, -1) };
// Eindstand voorspellen: posities na afloop van alle lopende animaties, met de zichtbaarheid van de eindstand (uiInnerHidden(n, true)).
function uiWithFinal(fn) {
  const moved = uiOpenFinalNodes();
  for (const n of moved) { (n._q || (n._q = new THREE.Quaternion())).copy(n.obj.quaternion); n._s = n.obj.scale.clone(); n._u = n.ou; }
  for (const n of ALL) if (n.parent) {
    (n._p || (n._p = V3(0, 0, 0))).copy(n.obj.position);
    uiExFin(n, n.obj.position.copy(n.base)).add(n.pull).add(n.liftV);
  }
  if (moved.length) uiOpenFinalPose();
  ROOT.obj.updateMatrixWorld(true);
  try { return fn(); } finally {
    for (const n of ALL) if (n.parent) n.obj.position.copy(n._p);
    for (const n of moved) { n.obj.quaternion.copy(n._q); n.obj.scale.copy(n._s); n.ou = n._u; }
    ROOT.obj.updateMatrixWorld(true);
  }
}
const uiCorner = V3(0, 0, 0);
// Hoekpunten van de begrenzende dozen van alle zichtbare meshes (in de eindstand) als puntenwolk.
function uiCollect(nodes, final = true, out = []) {
  const go = () => {
    const walk = n => {
      if (final ? uiInnerHidden(n, true) : !n.ev) return;
      if (!n.asm) {
        if (final && ISO.length && !uiInScope(n)) return;
        const g = n.obj.geometry; if (!g.boundingBox) g.computeBoundingBox();
        const b = g.boundingBox, mw = n.obj.matrixWorld;
        for (let i = 0; i < 8; i++) {
          uiCorner.set(i & 1 ? b.max.x : b.min.x, i & 2 ? b.max.y : b.min.y, i & 4 ? b.max.z : b.min.z).applyMatrix4(mw);
          out.push(uiCorner.x, uiCorner.y, uiCorner.z);
        }
        return;
      }
      n.kids.forEach(walk);
    };
    nodes.forEach(walk);
    return out;
  };
  return final ? uiWithFinal(go) : (ROOT.obj.updateMatrixWorld(true), go());
}
function predictedBox(nodes) {
  const pts = uiCollect(nodes, true), box = new THREE.Box3();
  for (let i = 0; i < pts.length; i += 3) box.expandByPoint(uiCorner.set(pts[i], pts[i + 1], pts[i + 2]));
  return box;
}
let camAnim = null;
let uiUserCam = false; // de gebruiker heeft de camera zelf verplaatst sinds de laatste inpassing
// Camera inpassen op een puntenwolk zodat alles binnen het vrije beeld valt (tussen paneel, dock en titel).
function uiFitPoints(pts, dir, pad = 1.08, opt = {}) {
  if (!pts.length) return null;
  const back = (dir ? dir.clone() : camera.position.clone().sub(controls.target)).normalize();
  const upW = Math.abs(back.y) > 0.985 ? V3(0, 0, back.y > 0 ? -1 : 1) : V3(0, 1, 0);
  const right = V3(0, 0, 0).crossVectors(upW, back).normalize(), up = V3(0, 0, 0).crossVectors(back, right);
  const box = new THREE.Box3();
  for (let i = 0; i < pts.length; i += 3) box.expandByPoint(uiCorner.set(pts[i], pts[i + 1], pts[i + 2]));
  const c = box.getCenter(V3(0, 0, 0));
  const vf = camera.fov * PI / 180, tv0 = Math.tan(vf / 2), th0 = tv0 * camera.aspect;
  const fw = Math.max(0.25, (W - VIEW.l - VIEW.r) / W), fh = Math.max(0.25, (H - VIEW.t - VIEW.b) / H);
  const tv = tv0 * fh, th = th0 * fw;
  // midden in beeldvlak (orthografisch), daarna afstand en een correctie voor perspectief
  let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
  const P = uiCorner;
  for (let i = 0; i < pts.length; i += 3) {
    P.set(pts[i] - c.x, pts[i + 1] - c.y, pts[i + 2] - c.z);
    const x = P.dot(right), y = P.dot(up); if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  c.addScaledVector(right, (x0 + x1) / 2).addScaledVector(up, (y0 + y1) / 2);
  let d = 0.2;
  const dist = () => {
    let dd = 0.2;
    for (let i = 0; i < pts.length; i += 3) {
      P.set(pts[i] - c.x, pts[i + 1] - c.y, pts[i + 2] - c.z);
      const x = P.dot(right), y = P.dot(up), z = P.dot(back);
      dd = Math.max(dd, Math.abs(x) * pad / th + z, Math.abs(y) * pad / tv + z);
    }
    return dd;
  };
  d = dist();
  for (let it = 0; it < 2; it++) { // herschik het midden op de geprojecteerde randen
    let u0 = Infinity, u1 = -Infinity, w0 = Infinity, w1 = -Infinity;
    for (let i = 0; i < pts.length; i += 3) {
      P.set(pts[i] - c.x, pts[i + 1] - c.y, pts[i + 2] - c.z);
      const z = d - P.dot(back); if (z <= 0.01) continue;
      const u = P.dot(right) / z, w = P.dot(up) / z;
      if (u < u0) u0 = u; if (u > u1) u1 = u; if (w < w0) w0 = w; if (w > w1) w1 = w;
    }
    if (!Number.isFinite(u0)) break;
    c.addScaledVector(right, (u0 + u1) / 2 * d).addScaledVector(up, (w0 + w1) / 2 * d);
    d = dist();
  }
  if (opt.min) d = Math.max(d, opt.min * 0.5 / Math.min(th, tv) * pad);
  d = clamp(d, controls.minDistance * 1.2, controls.maxDistance * 0.95);
  return { pos: c.clone().add(back.multiplyScalar(d)), target: c };
}
const uiSph0 = new THREE.Spherical(), uiSph1 = new THREE.Spherical();
function animCam(pos, target, dur, delay = 0) {
  dur = REDUCED ? 0.01 : (dur || 0.95);
  camAnim = { p0: camera.position.clone(), t0: controls.target.clone(), p1: pos.clone(), t1: target.clone(), t: 0, dur, delay: REDUCED ? 0 : delay, started: false };
  uiUserCam = false; uiWake();
}
function stepCam(dt) {
  if (!camAnim) return false;
  if (camAnim.delay > 0) { camAnim.delay -= dt; return true; }
  if (!camAnim.started) { camAnim.p0.copy(camera.position); camAnim.t0.copy(controls.target); camAnim.started = true; }
  camAnim.t = Math.min(1, camAnim.t + dt / camAnim.dur);
  const k = ease(camAnim.t);
  // bolcoördinaten (azimut en hoogte over de kortste hoek) voor een vloeiende baan zonder salto over de top
  uiSph0.setFromVector3(_v.copy(camAnim.p0).sub(camAnim.t0));
  uiSph1.setFromVector3(_v.copy(camAnim.p1).sub(camAnim.t1));
  let dth = uiSph1.theta - uiSph0.theta; if (dth > PI) dth -= 2 * PI; if (dth < -PI) dth += 2 * PI;
  const r = Math.exp(lerp(Math.log(Math.max(1e-4, uiSph0.radius)), Math.log(Math.max(1e-4, uiSph1.radius)), k));
  _v.setFromSphericalCoords(r, lerp(uiSph0.phi, uiSph1.phi, k), uiSph0.theta + dth * k);
  controls.target.lerpVectors(camAnim.t0, camAnim.t1, k);
  camera.position.copy(controls.target).add(_v);
  if (camAnim.t >= 1) { camera.position.copy(camAnim.p1); controls.target.copy(camAnim.t1); camAnim = null; }
  return true;
}
// R3: het laatste echte kaderdoel, voor het herkadreren na een formaatwissel (uiRefitNow in app2-loop.js). focusNodes zet het
// zelf, zodat duiken, Alles uitklappen, afspelen, kruimelklik en rondleiding nooit op een ouder doel terugvallen; een preset
// zet daarna { preset } (appApplyPreset), zodat het kader met het onderwerp van de preset meegaat.
let uiLastFit = null;
// G1: uiFitRef is het kader (uiLastFit) waarop de camera is ingepast, uiFitFree de hoogte van het vrije beeld op dat moment
// (layoutView en uiRefitNow in app2-loop.js zetten ze; uiSnap en uiRestore bewaren ze)
let uiFitRef = null, uiFitFree = -1;
function focusNodes(nodes, dir, pad, opt = {}) {
  const pts = uiCollect(nodes, true);
  if (!pts.length) uiCollect(nodes.map(() => ROOT), true, pts);
  const f = uiFitPoints(pts, dir, pad || 1.08, opt);
  if (f) animCam(f.pos, f.target, opt.dur, opt.delay);
  uiLastFit = { nodes: nodes.slice(), dir: dir ? dir.clone() : null, pad: pad || 1.08, opt: opt.min ? { min: opt.min } : {} };
  updateGround();
}
function contextNodes() { return ISO.length ? ISO : [ROOT]; }

/* ---------- vloer ---------- */
// Vloer en schaduw als DataTexture uit JavaScript (geen 2D-canvas: dat tekenen kostte in software-WebGL bij het
// opstarten seconden; dit zijn een paar tientallen milliseconden).
function uiRgba(str, fb) {
  const m = /rgba?\(([^)]+)\)/.exec(str || '');
  const v = m ? m[1].split(',').map(t => parseFloat(t)) : fb;
  return [v[0] | 0, v[1] | 0, v[2] | 0, v.length > 3 && isFinite(v[3]) ? v[3] : 1];
}
// lineaire overgang door kleurstops [[t, waarde], ...]
const uiStops = (st, t) => { if (t <= st[0][0]) return st[0][1]; for (let i = 1; i < st.length; i++) if (t <= st[i][0]) { const [t0, a] = st[i - 1], [t1, b] = st[i]; return a + (b - a) * (t - t0) / (t1 - t0); } return st[st.length - 1][1]; };
function uiDataTex(data, w, h) {
  const t = new THREE.DataTexture(data, w, h, THREE.RGBAFormat);
  t.magFilter = THREE.LinearFilter; t.minFilter = THREE.LinearMipmapLinearFilter; t.generateMipmaps = true;
  t.encoding = THREE.sRGBEncoding; t.needsUpdate = true;
  return t;
}
function gridTexture() {
  const cs = getComputedStyle(document.documentElement);
  const c1 = uiRgba(cs.getPropertyValue('--grid').trim(), [0, 0, 0, 0.08]), c2 = uiRgba(cs.getPropertyValue('--grid-strong').trim(), [0, 0, 0, 0.16]);
  const S = 1024, N = 48, step = S / N;
  // dekking per kolom (= per rij): 49 lijnen, elke zesde dikker en sterker, met zachte randen
  const lineA = new Float32Array(S);
  for (let i = 0; i <= N; i++) {
    const w = i % 6 === 0 ? 2 : 1, al = i % 6 === 0 ? c2[3] : c1[3], pos = i * step;
    for (let x = Math.max(0, Math.floor(pos - 2)); x <= Math.min(S - 1, Math.ceil(pos + 2)); x++) {
      const cov = clamp(w / 2 + 0.5 - Math.abs(x + 0.5 - pos), 0, 1) * al;
      if (cov > lineA[x]) lineA[x] = cov;
    }
  }
  const mask = [[0, 1], [0.55, 0.75], [1, 0]], r0 = S * 0.05, r1 = S / 2;
  const d = new Uint8Array(S * S * 4), [R, G, B] = c2;
  for (let y = 0; y < S; y++) {
    const ay = lineA[y], dy = y + 0.5 - S / 2;
    for (let x = 0; x < S; x++) {
      const ax = lineA[x];
      let a = ax + ay - ax * ay;
      if (a > 0) a *= uiStops(mask, (Math.hypot(x + 0.5 - S / 2, dy) - r0) / (r1 - r0));
      const k = (y * S + x) * 4;
      d[k] = R; d[k + 1] = G; d[k + 2] = B; d[k + 3] = Math.round(a * 255);
    }
  }
  return uiDataTex(d, S, S);
}
const ground = new THREE.Mesh(new THREE.PlaneGeometry(36, 36), new THREE.MeshBasicMaterial({ map: gridTexture(), transparent: true, depthWrite: false, toneMapped: false }));
ground.rotation.x = -HALF; ground.renderOrder = -2;
scene.add(ground);
// zachte elliptische schaduw onder de auto
const blob = new THREE.Mesh(new THREE.PlaneGeometry(2.9, 5.6), new THREE.MeshBasicMaterial({ map: (() => {
  const w = 64, h = 128, d = new Uint8Array(w * h * 4), st = [[0, 0.55], [0.6, 0.25], [1, 0]];
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const r = Math.hypot((x + 0.5) / w * 256 - 128, (y + 0.5) / h * 256 - 128);
    d[(y * w + x) * 4 + 3] = Math.round(255 * uiStops(st, (r - 8) / 116));
  }
  return uiDataTex(d, w, h);
})(), transparent: true, depthWrite: false, opacity: 0.85, toneMapped: false }));
blob.rotation.x = -HALF; blob.renderOrder = -1;
scene.add(blob);
let groundTarget = 0;
function updateGround() {
  // gemonteerd staat de auto op de vloer (y = 0); alleen als iets onder de vloer uitklapt zakt de vloer mee
  const b = predictedBox([ROOT]);
  groundTarget = b.isEmpty() || b.min.y > -0.004 ? 0 : b.min.y - 0.03;
  if (Math.abs(ground.position.y - groundTarget) >= 1e-4) uiWake(); // de vloer zakt of komt terug (stepGround)
}
function stepGround(dt) {
  const y = ground.position.y;
  const fade = 1 - Math.min(1, ROOT.amt) * 0.85;
  blob.material.opacity = 0.85 * fade;
  blob.visible = !ISO.length;
  if (Math.abs(y - groundTarget) < 1e-4) { blob.position.y = y + 0.002; return false; }
  ground.position.y = lerp(y, groundTarget, Math.min(1, dt * 5));
  if (Math.abs(ground.position.y - groundTarget) < 1e-3) ground.position.y = groundTarget;
  blob.position.y = ground.position.y + 0.002;
  return true;
}

/* ---------- stap terug (geschiedenis) ---------- */
const uiHist = [];
function uiSnap() {
  return {
    t: ASMS.map(n => n.target), o: OPENERS.map(n => n.ot),
    pull: ALL.filter(n => n.pull.lengthSq() > 0).map(n => [n.id, n.pull.x, n.pull.y, n.pull.z]),
    lift: uiLifted ? uiLifted.id : null,
    iso: ISO.map(n => n.id), dim: DIM ? DIM.id : null, xray: XRAY, sys: SYSCOL, spread: SPREAD, om: OPENMODE,
    sel: (SEL || ROOT).id, ctx: CTX ? CTX.id : null, force: uiLabelForce, preset: ACTIVE_PRESET,
    cam: [camera.position.clone(), controls.target.clone()],
    // G1: het kader waarop deze camera is ingepast, het vrije beeld daarvan en of de gebruiker de camera zelf had verplaatst
    fit: uiLastFit, ffree: uiLastFit === uiFitRef ? uiFitFree : H - VIEW.t - VIEW.b, user: uiUserCam,
  };
}
function uiPush() {
  uiHist.push(uiSnap());
  if (uiHist.length > CFG.indeling.historie) uiHist.shift();
  if (typeof uiSyncUndo === 'function') uiSyncUndo();
}
function uiRestore(s, instant) {
  ISO = s.iso.map(id => uiById.get(id)).filter(Boolean);
  ASMS.forEach((n, i) => setTarget(n, s.t[i], 0, 0.7));
  OPENERS.forEach((n, i) => uiSetOpen(n, s.o ? s.o[i] : 0));
  for (const n of ALL) if (n.pull.lengthSq() > 0) { n.pull.set(0, 0, 0); uiOffTo(n, 0.7); }
  for (const [id, x, y, z] of s.pull) { const n = uiById.get(id); if (n) { n.pull.set(x, y, z); uiOffTo(n, 0.7); } }
  uiDrop();
  if (s.lift != null) { const n = uiById.get(s.lift); if (n) uiLift(n); }
  XRAY = s.xray; SYSCOL = s.sys; OPENMODE = !!s.om;
  uiSetDim(s.dim != null ? uiById.get(s.dim) : null);
  if (SPREAD !== s.spread) uiSetSpread(s.spread, true);
  CTX = s.ctx != null ? uiById.get(s.ctx) : null; uiLabelForce = !!s.force;
  uiVisDirty = true; applyVisibility();
  SEL = uiById.get(s.sel) || ROOT;
  animCam(s.cam[0], s.cam[1], 0.8);
  // G1: de camera is terug op het oude kader; kader, vrij beeld en gebruikerscamera horen daarbij (anders trekt layoutView hem naar het kader van de preset waaruit je terugging)
  uiLastFit = s.fit; uiFitRef = s.fit; uiFitFree = s.ffree; uiUserCam = s.user;
  updateGround();
  if (instant) finishAll();
  ACTIVE_PRESET = s.preset || null;
}
function uiUndo() {
  const s = uiHist.pop();
  if (!s) return false;
  uiRestore(s);
  if (typeof uiAfterUndo === 'function') uiAfterUndo();
  return true;
}
function uiSetSpread(v, rerender) {
  SPREAD = v; uiSpreadEnd = v;
  for (const n of ASMS) if (n.amt > 0) placeKids(n);
  uiOpenResync();
  if (rerender) updateGround();
}

/* ---------- samengevoegd tekenen van gesloten groepen (premortem struikeldraad 5) ---------- */
// Een groep waarvan de hele deelboom gemonteerd is (alle explosiewaarden 0, geen animatie, geen verschuiving),
// die niet gemarkeerd (selectie, aanwijzen) is en helemaal binnen de isolatie valt, wordt getekend als één mesh
// per materiaal in het lokale frame van de groep. De losse meshes blijven in de scène voor aanwijzen, labels en de
// lijst; ze gaan zolang naar laag 1 (de camera tekent die niet, de raycaster raakt hem wel). Ingesloten (inner)
// knopen tellen niet mee: in een gesloten deelboom zijn ze toch verborgen. Doorzichtige onderdelen (glas) blijven los
// getekend, zodat de diepte-sortering van doorzichtige vlakken gelijk blijft. Batches worden lui gebouwd, verspreid over
// frames, en hun extra geheugen is begrensd (minst recent gebruikte eerst weg).
let uiBatchOn = true;
const UI_BATCH_TRIS = 60000;   // grotere groepen worden over hun kinderen verdeeld
const UI_HIDE_LAYER = 1;
const uiBatched = new Set();   // groepen die nu samengevoegd getekend worden
const uiBatchQ = new Set();    // groepen die op een batch wachten
const uiBatchWant = new Set();
let uiBatchJob = null, uiBatchBytes = 0, uiBatchClock = 0, uiBatchKey = '';
const uiBm = new THREE.Matrix4(), uiBl = new THREE.Matrix4(), uiBn = new THREE.Matrix3(), uiBv = V3(0, 0, 0);
const uiGeoTris = g => (g.index ? g.index.count : g.attributes.position.count) / 3;
const uiGeoBytes = g => g.attributes.position.count * (g.attributes.uv ? 32 : 24) + (g.index ? g.index.count : g.attributes.position.count) * 4;
// geheugengrens: 1,25 x de geometrie van de gemonteerde auto (alle instanties één keer)
const uiBatchCap = Math.round(1.25 * MESHES.reduce((a, m) => a + uiGeoBytes(m.geometry), 0));
// inhoud van de batch van groep g: alle meshes in de deelboom, behalve onder een ingesloten knoop
function uiBatchInfo(g) {
  if (g.bInfo) return g.bInfo;
  const src = []; let tris = 0;
  const walk = n => { for (const k of n.kids) { if (k.inner) continue; if (k.asm) walk(k); else if (!(k.obj.userData.base || k.obj.material).transparent) { src.push(k.obj); tris += uiGeoTris(k.obj.geometry); } } };
  walk(g);
  return (g.bInfo = { src, tris, ok: src.length >= 2 && tris <= UI_BATCH_TRIS });
}
// per knoop: is de deelboom gemonteerd en ongemarkeerd (van onder naar boven, één keer per weergave)
function uiBatchClean() {
  for (let i = ALL.length - 1; i >= 0; i--) {
    const n = ALL[i];
    if (!n.asm) { n._bc = !uiSelSet.has(n.obj) && !uiHovSet.has(n.obj); continue; }
    let c = n.target === 0 && n.amt === 0 && !uiAnim.has(n) && !(n.strut && n.strut.dirty);
    if (c) for (const k of n.kids) { if (k.inner) continue; if (!k._bc || k.hasOff || k.ou > 0 || (k.strut && k.strut.dirty) || (k.stayO && k.stayO.ou > 0)) { c = false; break; } }
    n._bc = c;
  }
}
function uiBatchMat(base, g) {
  if (XRAY && g.isBody) return uiCut(base, GHOST);
  if (DIM && !isUnder(g, DIM) && !isUnder(DIM, g)) return uiCut(base, uiDimMat);
  if (SYSCOL && g.sys) return uiCut(base, SYS_MATS[g.sys] || base);
  return base;
}
function uiBatchShow(g) {
  const b = g.bat;
  for (const m of b.src) m.layers.set(UI_HIDE_LAYER);
  if (b.key !== uiBatchKey) { for (const bm of b.obj.children) bm.material = uiBatchMat(bm.userData.base, g); b.key = uiBatchKey; }
  b.obj.visible = true; uiBatched.add(g);
}
function uiUnbatch(g) {
  const b = g.bat;
  for (const m of b.src) m.layers.set(0);
  b.obj.visible = false; uiBatched.delete(g);
}
// Vóór elke weergave: kies per tak de hoogste geschikte groep met een klare batch; wissel waar nodig (zelfde frame).
function uiBatchSync() {
  if (!uiBatchOn) { for (const g of [...uiBatched]) uiUnbatch(g); return; }
  uiBatchClean();
  uiBatchKey = (XRAY ? 'x' : '') + (SYSCOL ? 's' : '') + (DIM ? 'd' + DIM.id : '');
  uiBatchWant.clear();
  // enq: nog geen hogere groep in de rij gezet; daaronder alleen bestaande batches gebruiken (niets dubbel bouwen)
  const walk = (n, enq) => {
    if (!n.asm || !n.ev) return;
    if (n._bc && uiInScope(n) && uiBatchInfo(n).ok) {
      if (n.bat) { uiBatchWant.add(n); n.bat.used = ++uiBatchClock; return; }
      if (enq) { uiBatchQ.add(n); enq = false; }
    }
    for (const k of n.kids) walk(k, enq);
  };
  walk(ROOT, true);
  for (const g of [...uiBatched]) if (!uiBatchWant.has(g)) uiUnbatch(g);
  for (const g of uiBatchWant) if (!uiBatched.has(g) || g.bat.key !== uiBatchKey) uiBatchShow(g);
}
// matrix van mesh naar groep in de gemonteerde stand (basisposities), onafhankelijk van de huidige explosie
function uiBaseRel(o, top) {
  uiBm.identity();
  for (; o && o !== top; o = o.parent) { const n = o.userData.node; uiBl.compose(n ? n.base : o.position, n ? n.q0 : o.quaternion, n ? n.s0 : o.scale); uiBm.premultiply(uiBl); }
  return uiBm;
}
function uiBatchAdd(job, m) {
  const g = m.geometry, pos = g.attributes.position, nor = g.attributes.normal, nv = pos.count;
  const M = uiBaseRel(m, job.g.obj); uiBn.getNormalMatrix(M);
  const flip = M.determinant() < 0;
  const base = m.userData.base || m.material;
  let acc = job.parts.get(base);
  if (!acc) job.parts.set(base, (acc = { p: [], n: [], u: [], uv: false, i: [], nv: 0, ni: 0 }));
  const P = new Float32Array(nv * 3), N = new Float32Array(nv * 3);
  for (let i = 0; i < nv; i++) {
    uiBv.set(pos.getX(i), pos.getY(i), pos.getZ(i)).applyMatrix4(M); P[i * 3] = uiBv.x; P[i * 3 + 1] = uiBv.y; P[i * 3 + 2] = uiBv.z;
    if (nor) { uiBv.set(nor.getX(i), nor.getY(i), nor.getZ(i)).applyMatrix3(uiBn).normalize(); N[i * 3] = uiBv.x; N[i * 3 + 1] = uiBv.y; N[i * 3 + 2] = uiBv.z; }
  }
  const UV = new Float32Array(nv * 2), guv = g.attributes.uv;   // uv mee: anders leest elke textuur (grille, plaat, reflector) één en hetzelfde pixeltje
  if (guv) { acc.uv = true; for (let i = 0; i < nv; i++) { UV[i * 2] = guv.getX(i); UV[i * 2 + 1] = guv.getY(i); } }
  const ix = g.index, ic = ix ? ix.count : nv, I = new Uint32Array(ic), o = acc.nv;
  for (let t = 0; t + 2 < ic; t += 3) {
    const a = ix ? ix.getX(t) : t, b = ix ? ix.getX(t + 1) : t + 1, c = ix ? ix.getX(t + 2) : t + 2;
    I[t] = a + o; I[t + 1] = (flip ? c : b) + o; I[t + 2] = (flip ? b : c) + o; // gespiegeld: wikkeling omdraaien (DoubleSide-belichting)
  }
  acc.p.push(P); acc.n.push(N); acc.u.push(UV); acc.i.push(I); acc.nv += nv; acc.ni += ic;
}
function uiBatchFinish(job) {
  const obj = new THREE.Group(); obj.name = 'uiBatch'; obj.visible = false;
  let bytes = 0;
  const cat = (list, n, T) => { const out = new T(n); let k = 0; for (const a of list) { out.set(a, k); k += a.length; } return out; };
  for (const [base, a] of job.parts) {
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(cat(a.p, a.nv * 3, Float32Array), 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(cat(a.n, a.nv * 3, Float32Array), 3));
    if (a.uv) geo.setAttribute('uv', new THREE.BufferAttribute(cat(a.u, a.nv * 2, Float32Array), 2));
    const idx = cat(a.i, a.ni, a.nv < 65536 ? Uint16Array : Uint32Array);
    geo.setIndex(new THREE.BufferAttribute(idx, 1));
    geo.computeBoundingSphere(); geo.computeBoundingBox();
    const bm = new THREE.Mesh(geo, uiBatchMat(base, job.g));
    bm.userData.base = base; bm.userData.uiBatch = true;
    obj.add(bm);
    bytes += a.nv * (a.uv ? 32 : 24) + a.ni * idx.BYTES_PER_ELEMENT;
  }
  job.g.obj.add(obj);
  job.g.bat = { obj, src: job.src, bytes, used: ++uiBatchClock, key: uiBatchKey };
  uiBatchBytes += bytes;
}
function uiBatchFree(g) {
  if (uiBatched.has(g)) uiUnbatch(g);
  g.obj.remove(g.bat.obj);
  for (const bm of g.bat.obj.children) bm.geometry.dispose();
  uiBatchBytes -= g.bat.bytes; g.bat = null;
}
// Bouwt batches binnen een tijdsbudget (ms) per frame. Geeft true als er een batch klaar is gekomen.
function uiBatchStep(budget) {
  const t0 = performance.now();
  let done = false;
  while (performance.now() - t0 < budget) {
    if (!uiBatchJob) {
      let g = null;
      for (const q of uiBatchQ) { uiBatchQ.delete(q); if (!q.bat) { g = q; break; } }
      if (!g) break;
      const info = uiBatchInfo(g);
      let est = 0; for (const m of info.src) est += uiGeoBytes(m.geometry);
      if (uiBatchBytes + est > uiBatchCap) { // ruimte maken: minst recent gebruikte batches die nu niet getekend worden
        const old = ASMS.filter(a => a.bat && !uiBatched.has(a)).sort((a, b) => a.bat.used - b.bat.used);
        while (old.length && uiBatchBytes + est > uiBatchCap) uiBatchFree(old.shift());
        if (uiBatchBytes + est > uiBatchCap) continue; // past niet: deze groep blijft los getekend
      }
      uiBatchJob = { g, src: info.src, i: 0, parts: new Map() };
    }
    const j = uiBatchJob;
    while (j.i < j.src.length && performance.now() - t0 < budget) uiBatchAdd(j, j.src[j.i++]);
    if (j.i >= j.src.length) { uiBatchFinish(j); uiBatchJob = null; done = true; }
  }
  return done;
}
function uiBatchFlush() { // voor tests: alles wat in de rij staat direct bouwen
  for (let it = 0; it < 50; it++) { uiBatchSync(); if (!uiBatchQ.size && !uiBatchJob) break; uiBatchStep(1e9); }
  uiBatchSync();
}
function uiSetBatching(on) {
  uiBatchOn = !!on;
  if (!uiBatchOn) { uiBatchQ.clear(); uiBatchJob = null; }
  uiBatchSync();
}
function uiBatchStats() {
  let meshes = 0; for (const g of uiBatched) meshes += g.bat.obj.children.length;
  let hidden = 0; for (const g of uiBatched) hidden += g.bat.src.length;
  return { on: uiBatchOn, groups: uiBatched.size, built: ASMS.filter(a => a.bat).length, queued: uiBatchQ.size + (uiBatchJob ? 1 : 0), batchMeshes: meshes, replaced: hidden, mb: +(uiBatchBytes / 1048576).toFixed(1), capMb: +(uiBatchCap / 1048576).toFixed(1) };
}
// Golf 5c-2, P4: elke weergave van de scène roept eerst zelf uiBatchSync() aan (de lus, de eerste weergave, beeld opslaan en
// de testhaken drawCalls en renderMs; finishAll synchroniseert ook). Er is geen omhulsel meer om renderer.render.
