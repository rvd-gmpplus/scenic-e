/* ===================== bediening (3/5): labels, genummerde callouts met leiderlijn ===================== */

/* ---------- labels: genummerde callouts met leiderlijn ---------- */
const labelPool = [], uiLinePool = [], uiDotPool = [];
const uiSvgNs = 'http://www.w3.org/2000/svg';
let uiRectCache = [], uiNPlaced = 0, uiVx0 = 0, uiVy0 = 0, uiVx1 = 0, uiVy1 = 0;
const uiCands = [], uiSpots = [];
const uiAnchor = V3(0, 0, 0), uiGc = V3(0, 0, 0);
// De groep waarvan de kinderen een label krijgen: de open selectie, anders de open context (CTX), en pas als die ver genoeg
// uitgeklapt is. vooruit (uiAnchorPrefetch): al zodra de groep opengaat, en zonder de vaste labelgroep van een preset.
// Golf 5c-2, K3: de ankerrij had een eigen kopie van deze keuze.
function uiLabelGroup(vooruit = false) {
  if (!LABELS) return null;
  if (!vooruit && uiLabelForce && CTX) return CTX;
  const ok = g => g && uiOpen(g) && (vooruit || g.amt > 0.6);
  if (SEL && SEL.asm && ok(SEL)) return SEL;
  return ok(CTX) ? CTX : null;
}
// Labelanker op de gelabelde knoop zelf. Het midden van het kader (n.lc) ligt bij een groep vaak op een ander deel of
// in de lucht, zeker als de groep zelf is uitgeklapt (Stuurpomp: Pomphuis en Stroomregelklep). Daarom ankert elk
// label op een representatief mesh: bij een onderdeel het mesh zelf, bij een groep een groot, niet-ingesloten mesh zo
// dicht mogelijk bij het midden van de groep. Het punt ligt in de eigen coördinaten van dat mesh, zodat het anker
// meebeweegt als de groep uitklapt: het midden van het mesh als dat binnenin ligt, anders (ring, holle bus) het midden
// van de driehoek die het dichtst bij dat midden ligt. Eén keer per knoop berekend (lui), per geometrie gedeeld; geen
// raycasts per frame.
let uiGeoAnchor = new WeakMap();
function uiGeoPoint(geo) {
  let p = uiGeoAnchor.get(geo);
  if (p) return p;
  if (!geo.boundingBox) geo.computeBoundingBox();
  const c = geo.boundingBox.getCenter(V3(0, 0, 0)), pos = geo.attributes.position, idx = geo.index;
  const nt = idx ? idx.count / 3 : pos.count / 3, C = [c.x, c.y, c.z], cross = [0, 0, 0], q = [[], [], []];
  let bd = Infinity; p = c.clone();
  for (let t = 0; t < nt; t++) {
    for (let j = 0; j < 3; j++) { const v = idx ? idx.getX(3 * t + j) : 3 * t + j; q[j][0] = pos.getX(v); q[j][1] = pos.getY(v); q[j][2] = pos.getZ(v); }
    const x = (q[0][0] + q[1][0] + q[2][0]) / 3, y = (q[0][1] + q[1][1] + q[2][1]) / 3, z = (q[0][2] + q[1][2] + q[2][2]) / 3;
    const dd = (x - c.x) * (x - c.x) + (y - c.y) * (y - c.y) + (z - c.z) * (z - c.z);
    if (dd < bd) { bd = dd; p.set(x, y, z); }
    // stralen vanuit het midden langs +x, +y en +z: hoe vaak snijden ze het oppervlak (oneven = midden ligt binnenin)
    for (let ax = 0; ax < 3; ax++) {
      const u = (ax + 1) % 3, w = (ax + 2) % 3, pu = C[u], pw = C[w];
      const d = (q[1][u] - q[0][u]) * (q[2][w] - q[0][w]) - (q[2][u] - q[0][u]) * (q[1][w] - q[0][w]);
      if (Math.abs(d) < 1e-14) continue;
      const l1 = ((q[1][u] - pu) * (q[2][w] - pw) - (q[2][u] - pu) * (q[1][w] - pw)) / d;
      const l2 = ((q[2][u] - pu) * (q[0][w] - pw) - (q[0][u] - pu) * (q[2][w] - pw)) / d;
      const l3 = 1 - l1 - l2;
      if (l1 < 0 || l2 < 0 || l3 < 0) continue;
      if (l1 * q[0][ax] + l2 * q[1][ax] + l3 * q[2][ax] > C[ax]) cross[ax]++;
    }
  }
  // dicht, bol deel: het midden zelf (valt in elk aanzicht binnen het silhouet); ring, buis of open schaal: het
  // dichtstbijzijnde stukje oppervlak
  if (cross[0] % 2 && cross[1] % 2 && cross[2] % 2) p.copy(c);
  uiGeoAnchor.set(geo, p);
  return p;
}
const uiBox = new THREE.Box3(), uiBs = V3(0, 0, 0);
// maat voor hoe groot een mesh in beeld komt: grootste vlak van zijn kader plus een toeslag voor dikte, zodat een
// huis het wint van een dunne ring of een lange bout
function uiMeshSize(m) {
  uiBox.setFromObject(m).getSize(uiBs);
  const d = [uiBs.x, uiBs.y, uiBs.z].sort((x, y) => y - x);
  return d[0] * d[1] + 4 * d[1] * d[2];
}
// Rangschikt de meshes van een knoop en geeft de zes beste terug; het (dure) ankerpunt per mesh volgt los van elkaar
// (uiGeoPoint), zodat het werk over frames te verdelen is.
function uiRankAnchors(k) {
  if (!k.asm) return [{ m: k.obj, node: k }];
  if (!k.meshes.length) return [];
  // ingesloten meshes (binnen k) zijn alleen te zien als hun groep open is; die komen pas na de rest
  const isIn = m => { for (let q = m.userData.node; q && q !== k; q = q.parent) if (q.inner) return true; return false; };
  const info = k.meshes.map(m => ({ m, inner: isIn(m), size: uiMeshSize(m), d: m.userData.node.wc.distanceTo(k.wc) }));
  const outer = info.filter(x => !x.inner), big = Math.max(...(outer.length ? outer : info).map(x => x.size));
  const rank = x => (x.size >= 0.5 * big ? 0 : 2) + (x.inner ? 1 : 0);
  info.sort((x, y) => rank(x) - rank(y) || x.d - y.d);
  return info.slice(0, 6).map(x => ({ m: x.m, node: x.m.userData.node }));
}
// De ankers van een groep worden niet in één frame gebouwd (bij Carrosserie 17 ms, bij de hoofdgroepen ~19 ms in het
// midden van het uitklappen): knopen komen in een rij en uiAnchorStep bouwt ze binnen een tijdsbudget per frame, per
// stap één rangschikking of één geometrie. Tot een knoop klaar is, ankert zijn label op het midden van het kader.
// Zodra een groep begint uit te klappen, gaat zijn rij met labelkandidaten (grootste eerst) vooruit de rij in.
const uiAnchorQ = new Set();
let uiAnchorJob = null, uiPfGroup = null, uiPfMax = 0;
function uiAnchorStep(budget) {
  const t0 = performance.now();
  let done = false;
  while (performance.now() - t0 < budget) {
    if (!uiAnchorJob) {
      let k = null;
      for (const q of uiAnchorQ) { uiAnchorQ.delete(q); if (!q._la) { k = q; break; } }
      if (!k) break;
      uiAnchorJob = { k, list: uiRankAnchors(k), i: 0 };
    } else {
      const j = uiAnchorJob;
      if (j.i < j.list.length) { const x = j.list[j.i++]; x.p = uiGeoPoint(x.m.geometry); }
      if (j.i >= j.list.length) { j.k._la = j.list; uiAnchorJob = null; done = true; }
    }
  }
  return done;
}
function uiAnchorFlush() { // voor tests en voor finishAll: alles in de rij direct bouwen
  for (let it = 0; it < 1000 && (uiAnchorQ.size || uiAnchorJob); it++) uiAnchorStep(1e9);
}
// per frame: vooruit inplannen en binnen het budget bouwen; true als er ankers klaar zijn gekomen (labels opnieuw leggen)
function uiAnchorFrame(active) {
  uiAnchorPrefetch();
  return (uiAnchorQ.size || uiAnchorJob) ? uiAnchorStep(active ? CFG.budget.ankerActief : CFG.budget.ankerRust) : false;
}
function uiAnchorPrefetch() {
  const g = uiLabelGroup(true);
  const max = W < CFG.indeling.smal ? CFG.indeling.labelsSmal : CFG.indeling.labels;
  if (g === uiPfGroup && max === uiPfMax) return;
  uiPfGroup = g; uiPfMax = max;
  if (!g) return;
  let n = 0;
  for (const k of g.bySize) { if (n++ >= max) break; if (!k._la) uiAnchorQ.add(k); }
}
function uiLabelAnchor(k, out) {
  const a = k._la;
  if (!a) { uiAnchorQ.add(k); return out.copy(k.lc).applyMatrix4(k.obj.matrixWorld); }
  for (const x of a) if (x.node.ev) return out.copy(x.p).applyMatrix4(x.m.matrixWorld);
  // geen van de zes gekozen meshes is zichtbaar (bijvoorbeeld na isoleren): eerste zichtbare mesh van de knoop, anders
  // het midden van het kader
  let f = k._lf;
  if (!f || !f.node.ev) {
    f = null;
    if (k.asm) for (const m of k.meshes) { const nd = m.userData.node; if (nd.ev) { f = { m, node: nd }; break; } }
    k._lf = f;
  }
  if (f) { if (!f.p) f.p = uiGeoPoint(f.m.geometry); return out.copy(f.p).applyMatrix4(f.m.matrixWorld); }
  return out.copy(k.lc).applyMatrix4(k.obj.matrixWorld);
}
function uiNewLabel() {
  const el = document.createElement('button');
  el.className = 'lbl'; el.hidden = true; el.tabIndex = -1;
  el.innerHTML = '<b></b><span></span>';
  // alleen een klik die op dit label begon (of een klik zonder aanwijzer: toetsenbord, schermlezer); geen nagekomen
  // click van een tik die op het canvas begon en waarna het label onder de vinger is geschoven
  el.addEventListener('pointerdown', () => { el._pd = true; });
  el.addEventListener('click', e => {
    const was = el._pd; el._pd = false; const k = el._k; if (!k || (e.detail > 0 && !was)) return;
    // U8: op een aanraakscherm is er geen title-tip; een afgekapt label toont zijn volledige naam als toast
    if (uiTouch && el.lastChild.scrollWidth > el.lastChild.clientWidth + 1) uiToast(k.name);
    uiStopPlay(); uiStopTour(); hideHint(); uiAct(k);
  });
  els.labels.appendChild(el);
  const ln = document.createElementNS(uiSvgNs, 'line'); ln.style.display = 'none'; els.leaders.appendChild(ln);
  const dot = document.createElementNS(uiSvgNs, 'circle'); dot.setAttribute('r', '3'); dot.style.display = 'none'; els.leaders.appendChild(dot);
  labelPool.push(el); uiLinePool.push(ln); uiDotPool.push(dot);
  return el;
}
function uiHideLabel(i) {
  const el = labelPool[i];
  if (!el.hidden) { el.hidden = true; el.style.transform = 'translate(-9999px,-9999px)'; el._x = el._y = null; }
  el._k = null;
  if (uiLinePool[i].style.display !== 'none') { uiLinePool[i].style.display = 'none'; uiDotPool[i].style.display = 'none'; }
}
function uiMeasureUi() {
  const out = [];
  const add = (id, el) => { if (!el || el.hidden) return; const r = el.getBoundingClientRect(); if (r.width > 0 && r.height > 0) out.push({ id, x: r.left, y: r.top, w: r.width, h: r.height }); };
  add('panel', els.sheet);
  add('modes', $('modes')); add('explode', $('xctl')); add('presets', els.presets);
  add('openSeg', $('openSeg')); add('openCtl', $('openCtl')); add('openList', $('openList')); add('isoBadge', els.isoBadge);
  add('title', els.topbar.querySelector('.title')); add('topActions', els.topbar.querySelector('.top-actions'));
  add('notice', els.notice); if (!els.toast.classList.contains('gone')) add('toast', els.toast);
  if (!els.hint.hidden && !els.hint.classList.contains('gone')) add('hint', els.hint);
  if (!els.menu.hidden) add('menu', els.menu);
  if (!els.tourBar.hidden) add('tour', els.tourBar);
  if (!els.helpDlg.hidden) add('help', els.helpDlg.firstElementChild);
  return out;
}
function uiRects() { return uiMeasureUi(); }
const uiDirs = [0, 0.52, -0.52, 1.05, -1.05, 1.57, -1.57, 2.36, -2.36, 3.14];
const uiRadii = [30, 52, 78, 110, 150];
let uiLabelsMore = 0, uiMoreEl = null;
function updateLabels() {
  if (uiUiDirty) { uiRectCache = uiMeasureUi(); uiUiDirty = false; }
  const g = uiLabelGroup();
  const max = W < CFG.indeling.smal ? CFG.indeling.labelsSmal : CFG.indeling.labels;
  uiCands.length = 0;
  if (SEL && !SEL.asm && SEL.ev && LABELS) uiCands.push(SEL);
  const lp = uiLabelForce && ACTIVE_PRESET ? appPresetById.get(ACTIVE_PRESET) : null;
  const only = lp && lp.labelOnly && g && g.name === lp.labels ? lp.labelOnly : null;
  let eligible = 0; // U2: alle kinderen die een label zouden kunnen krijgen, ook voorbij het maximum
  if (g) for (const k of g.bySize) { if (k !== SEL && k.ev && (!only || only.includes(k.name))) { eligible++; if (uiCands.length < max) uiCands.push(k); } }
  // nieuwe teksten eerst toewijzen, dan in één keer meten
  while (labelPool.length < uiCands.length) uiNewLabel();
  for (let i = 0; i < uiCands.length; i++) {
    const k = uiCands[i], el = labelPool[i];
    if (el._t !== k) { el.firstChild.textContent = String(k.idx + 1); el.lastChild.textContent = k.name; el.title = k.name; el._t = k; el.setAttribute('aria-label', TXT.labelAria(k.idx + 1, k.name)); }
  }
  for (let i = 0; i < uiCands.length; i++) {
    const k = uiCands[i];
    if (k._lw == null) { const el = labelPool[i]; const wasHidden = el.hidden; el.hidden = false; k._lw = el.offsetWidth; k._lh = el.offsetHeight; if (wasHidden) el.hidden = true; }
  }
  const v = uiFreeView(), M = 4;
  uiVx0 = v.x0 + M; uiVy0 = v.y0 + M; uiVx1 = v.x1 - M; uiVy1 = v.y1 - M;
  uiNPlaced = 0;
  let gx = 0, gy = 0;
  if (g) { uiToScreen(uiGc.copy(g.lc).applyMatrix4(g.obj.matrixWorld)); gx = uiGc.x; gy = uiGc.y; }
  let shown = 0;
  for (let i = 0; i < uiCands.length; i++) {
    const k = uiCands[i], el = labelPool[i];
    uiToScreen(uiLabelAnchor(k, uiAnchor));
    const ax = uiAnchor.x, ay = uiAnchor.y;
    const w = k._lw || 100, h = k._lh || 22;
    let found = false, dx = 0, dy = 0;
    if (uiAnchor.z <= 1 && ax >= uiVx0 && ax <= uiVx1 && ay >= uiVy0 && ay <= uiVy1) {
      // eerst de vorige plek (rustig beeld tijdens animaties), dan ringen rond het anker, van de groep af gericht
      if (k._lo && uiFits(ax + k._lo[0] - w / 2, ay + k._lo[1] - h / 2, w, h)) { found = true; dx = k._lo[0]; dy = k._lo[1]; }
      const base = g && Math.abs(ax - gx) + Math.abs(ay - gy) > 6 ? Math.atan2(ay - gy, ax - gx) : -HALF;
      for (let ri = 0; !found && ri < uiRadii.length; ri++) {
        const R = uiRadii[ri];
        for (let di = 0; di < uiDirs.length; di++) {
          const a = base + uiDirs[di], ca = Math.cos(a), sa = Math.sin(a);
          dx = ca * (R + w / 2 * Math.abs(ca)); dy = sa * (R * 0.75 + h / 2 * Math.abs(sa));
          if (uiFits(ax + dx - w / 2, ay + dy - h / 2, w, h)) { found = true; if (!k._lo) k._lo = [0, 0]; k._lo[0] = dx; k._lo[1] = dy; break; }
        }
      }
    }
    if (!found) { uiHideLabel(i); continue; }
    const x = ax + dx - w / 2, y = ay + dy - h / 2;
    let sp = uiSpots[uiNPlaced];
    if (!sp) sp = uiSpots[uiNPlaced] = { x: 0, y: 0, w: 0, h: 0, ax: 0, ay: 0, k: null };
    sp.x = x; sp.y = y; sp.w = w; sp.h = h; sp.ax = ax; sp.ay = ay; sp.k = k;
    uiNPlaced++;
    el._k = k;
    const isSel = k === SEL;
    if (el._sel !== isSel) { el._sel = isSel; el.classList.toggle('sel', isSel); uiDotPool[i].classList.toggle('sel', isSel); }
    const rx = Math.round(x), ry = Math.round(y);
    if (el._x !== rx || el._y !== ry || el.hidden) { el._x = rx; el._y = ry; el.style.transform = 'translate(' + rx + 'px,' + ry + 'px)'; }
    if (el.hidden) el.hidden = false;
    // leiderlijn van het ankerpunt naar de dichtstbijzijnde rand van het label
    const x1 = Math.round(ax), y1 = Math.round(ay), x2 = Math.round(clamp(ax, x, x + w)), y2 = Math.round(clamp(ay, y, y + h));
    const ln = uiLinePool[i], dot = uiDotPool[i];
    if (ln._x1 !== x1 || ln._y1 !== y1 || ln._x2 !== x2 || ln._y2 !== y2) {
      ln._x1 = x1; ln._y1 = y1; ln._x2 = x2; ln._y2 = y2;
      ln.setAttribute('x1', x1); ln.setAttribute('y1', y1); ln.setAttribute('x2', x2); ln.setAttribute('y2', y2);
      dot.setAttribute('cx', x1); dot.setAttribute('cy', y1);
    }
    if (ln.style.display) { ln.style.display = ''; dot.style.display = ''; }
    shown++;
  }
  for (let i = uiCands.length; i < labelPool.length; i++) uiHideLabel(i);
  // U2: wat niet getoond is (voorbij het maximum of zonder vrije plek) staat als "+n meer" in een hoek van het vrije beeld
  const selShown = uiCands.length && uiCands[0] === SEL && !SEL.asm ? 1 : 0;
  uiLabelsMore = g ? Math.max(0, eligible - (shown - selShown)) : 0;
  uiPlaceMore(g);
  return shown;
}
function uiPlaceMore(g) {
  if (!uiMoreEl) {
    uiMoreEl = document.createElement('button'); uiMoreEl.className = 'lmore'; uiMoreEl.hidden = true; uiMoreEl.tabIndex = -1;
    uiMoreEl.title = TXT.meerTitel;
    uiMoreEl.onclick = () => { showTab('tree'); if (uiSheetBottom()) setSheet('open'); if (uiMoreEl._g) { openRows.add(uiMoreEl._g.id); renderTree(); } };
    els.labels.appendChild(uiMoreEl);
  }
  const el = uiMoreEl;
  // bij verbergen ook de onthouden plek wissen, anders blijft een chip die op dezelfde plek terugkomt op -9999 staan
  if (!uiLabelsMore) { if (!el.hidden) { el.hidden = true; el.style.transform = 'translate(-9999px,-9999px)'; el._x = el._y = null; } return; }
  const txt = TXT.meer(uiLabelsMore);
  if (el.textContent !== txt) { el.textContent = txt; el.setAttribute('aria-label', TXT.meerAria(uiLabelsMore)); el._w = 0; }
  el._g = g;
  if (el.hidden) el.hidden = false;
  if (!el._w) { el._w = el.offsetWidth; el._h = el.offsetHeight; }
  const w = el._w || 70, h = el._h || 22;
  // hoeken van het vrije beeld, rechtsonder eerst; past geen enkele, dan toch rechtsonder
  const spots = [[uiVx1 - w, uiVy1 - h], [uiVx0, uiVy1 - h], [uiVx1 - w, uiVy0], [uiVx0, uiVy0]];
  let p = spots.find(([x, y]) => uiFits(x, y, w, h)) || spots[0];
  const rx = Math.round(p[0]), ry = Math.round(p[1]);
  if (el._x !== rx || el._y !== ry) { el._x = rx; el._y = ry; el.style.transform = 'translate(' + rx + 'px,' + ry + 'px)'; }
}
// vrije plek voor een label: binnen het vrije beeld, niet over andere labels of hun ankers, niet over de bediening
function uiFits(x, y, w, h) {
  if (x < uiVx0 || y < uiVy0 || x + w > uiVx1 || y + h > uiVy1) return false;
  for (let j = 0; j < uiNPlaced; j++) {
    const q = uiSpots[j];
    if (x < q.x + q.w + 4 && x + w + 4 > q.x && y < q.y + q.h + 4 && y + h + 4 > q.y) return false;
    if (q.ax > x - 3 && q.ax < x + w + 3 && q.ay > y - 3 && q.ay < y + h + 3) return false;
  }
  for (let j = 0; j < uiRectCache.length; j++) {
    const q = uiRectCache[j];
    if (x < q.x + q.w + 2 && x + w + 2 > q.x && y < q.y + q.h + 2 && y + h + 2 > q.y) return false;
  }
  return true;
}
function uiLabelRects() { return uiSpots.slice(0, uiNPlaced).map(p => ({ name: p.k.name, x: p.x, y: p.y, w: p.w, h: p.h })); }
