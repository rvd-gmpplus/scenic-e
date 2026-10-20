/* ===================== bediening (5/5): formaat, thema, beeldkwaliteit, render-lus, debug, URL, start en testhaak ===================== */

/* ---------- formaat en vrij beeld ---------- */
let uiRefitTimer = 0;
// G1: het kader waarop de camera is ingepast staat in uiFitRef en uiFitFree (app1.js, bij uiLastFit);
// uiRefitCheck: de wachtende herkadrering komt alleen van een layoutwijziging en vervalt als de camera al past.
let uiRefitCheck = false;
const uiViewPrev = { l: -99, r: -99, t: -99, b: -99 };
let uiViewW = 0, uiViewH = 0;
function layoutView() {
  const wide = !uiSheetBottom(); // bureaublad of telefoon liggend: het paneel staat als kolom rechts
  const title = els.topbar.querySelector('.title').getBoundingClientRect();
  const acts = els.topbar.querySelector('.top-actions').getBoundingClientRect();
  const sheet = els.sheet.getBoundingClientRect();
  let dockTop = H;
  for (const el of [$('modes'), $('xctl'), els.presets, $('openCtl'), $('openList'), els.isoBadge]) { const r = el.getBoundingClientRect(); if (r.height > 0 && r.top < dockTop) dockTop = r.top; }
  if (wide) {
    VIEW.l = 0; VIEW.r = Math.max(0, W - sheet.left + 8);
    VIEW.t = Math.min(H * 0.3, title.bottom + 6);
    VIEW.b = Math.max(0, H - dockTop + 6);
    if (uiSide() && !els.tourBar.hidden) { const tb = els.tourBar.getBoundingClientRect(); if (tb.height > 0) VIEW.t = Math.max(VIEW.t, Math.min(H * 0.45, tb.bottom + 4)); }
  } else {
    VIEW.l = 0; VIEW.r = 0;
    VIEW.t = Math.min(H * 0.3, Math.max(title.bottom, acts.bottom, $('openSeg').getBoundingClientRect().bottom) + 4);
    const bottom = els.sheet.dataset.state === 'open' ? sheet.top : Math.min(dockTop, sheet.top);
    VIEW.b = Math.max(0, H - bottom + 4);
    // Tijdens de rondleiding staat het bijschrift als balk onder de titel: het beeld begint eronder.
    if (!els.tourBar.hidden) { const tb = els.tourBar.getBoundingClientRect(); if (tb.height > 0) VIEW.t = Math.max(VIEW.t, Math.min(H * 0.45, tb.bottom + 4)); }
    // Altijd een bruikbaar vrij beeld: op een kort scherm (telefoon liggend) overlapt het dock dan liever het beeld.
    const minH = Math.min(160, H * 0.4);
    if (H - VIEW.t - VIEW.b < minH) {
      VIEW.b = Math.max(0, H - VIEW.t - minH);
      if (H - VIEW.t - VIEW.b < minH) VIEW.t = Math.max(0, H - VIEW.b - minH);
    }
  }
  // Kleine verschuivingen van de bediening (een focusrand, een paar pixels in het dock) verschuiven het beeld niet:
  // anders springt de scène onder de vinger weg tussen aanwijzen en tikken.
  const prevFree = uiViewPrev.t > -99 && uiViewW === W && uiViewH === H ? H - uiViewPrev.t - uiViewPrev.b : -1;
  for (const k of ['l', 'r', 't', 'b']) { if (Math.abs(VIEW[k] - uiViewPrev[k]) < 6 && uiViewW === W && uiViewH === H) VIEW[k] = uiViewPrev[k]; uiViewPrev[k] = VIEW[k]; }
  uiViewW = W; uiViewH = H;
  // Een layoutwijziging van het dock (de isoleerbadge verschijnt, de presetbalk breekt om) die het vrije beeld meer dan 24 px
  // in hoogte verandert nadat de camera was ingepast: opnieuw inpassen, anders valt het onderwerp buiten het beeld.
  // Een kader dat sinds de vorige meting is ingepast, is ingepast op het vrije beeld van die vorige meting (prevFree).
  if (uiLastFit !== uiFitRef) { uiFitRef = uiLastFit; uiFitFree = prevFree; }
  if (uiFitFree >= 0 && Math.abs((H - VIEW.t - VIEW.b) - uiFitFree) > CFG.indeling.herkaderPx) uiRefitSoon(true);
  camera.setViewOffset(W, H, (VIEW.r - VIEW.l) / 2, (VIEW.b - VIEW.t) / 2, W, H);
  camera.updateProjectionMatrix();
  uiPlaceMenu();
  uiUiChanged();
  uiSyncLabels();
}
// Na een wijziging van het vrije beeld opnieuw inpassen, tenzij de gebruiker de camera zelf heeft verplaatst.
// Een kader dat na de laatste meting is ingepast, hoort bij het huidige vrije beeld; anders telt het verschil met het vrije beeld bij het inpassen.
function uiFitStale() { return uiLastFit === uiFitRef && uiFitFree >= 0 && Math.abs((H - VIEW.t - VIEW.b) - uiFitFree) > CFG.indeling.herkaderPx; }
function uiRefitNow() {
  const check = uiRefitCheck;
  clearTimeout(uiRefitTimer); uiRefitTimer = 0; uiRefitCheck = false;
  if (uiUserCam || !uiLastFit) return;
  if (check && !uiFitStale()) return; // alleen een layoutwijziging als aanleiding: niet herkadreren als de camera al op dit vrije beeld past
  const f = uiLastFit;
  if (f.preset) { const c = f.preset.cam || {}; focusNodes(appSubject(f.preset), appPresetDir(f.preset), c.pad || 1.06, { dur: 0.4 }); uiLastFit = f; }
  else focusNodes(f.nodes, f.dir, f.pad, Object.assign({}, f.opt || {}, { dur: 0.4, delay: 0 }));
  uiFitRef = uiLastFit; uiFitFree = H - VIEW.t - VIEW.b;
}
// check: de aanleiding is alleen een layoutwijziging van het dock (layoutView); een formaatwissel of paneelwissel herkadreert altijd.
function uiRefitSoon(check) {
  uiRefitCheck = !!check && (!uiRefitTimer || uiRefitCheck);
  clearTimeout(uiRefitTimer);
  uiRefitTimer = setTimeout(uiRefitNow, CFG.tijd.herkaderMs);
}
let uiDprCap = Math.min(window.devicePixelRatio || 1, 2), uiDpr = uiDprCap;
function resize() {
  W = Math.max(1, canvas.clientWidth); H = Math.max(1, canvas.clientHeight);
  uiDprCap = Math.min(window.devicePixelRatio || 1, 2);
  uiDpr = uiPickDpr(false); uiBufferSize();
  camera.aspect = W / H;
  camera.updateProjectionMatrix();
  syncSheetHeight();
  layoutView();
  requestRender(); // P4: de lus kan stilstaan; een nieuwe buffermaat is leeg tot de volgende weergave
}
window.addEventListener('resize', () => { resize(); uiRefitSoon(); });
if (window.ResizeObserver) {
  let lastH = 0;
  new ResizeObserver(() => { syncSheetHeight(); layoutView(); const h = els.sheet.offsetHeight; if (uiSheetBottom() && Math.abs(h - lastH) > CFG.indeling.herkaderPx) uiRefitSoon(); lastH = h; }).observe(els.sheet);
  new ResizeObserver(() => layoutView()).observe(els.dock);
}

/* ---------- thema ---------- */
function refreshTheme() { uiThemeLights(); const old = ground.material.map; ground.material.map = gridTexture(); ground.material.needsUpdate = true; old && old.dispose(); requestRender(); }
if (window.matchMedia) { const mq = matchMedia('(prefers-color-scheme: dark)'); mq.addEventListener ? mq.addEventListener('change', refreshTheme) : mq.addListener(refreshTheme); }
new MutationObserver(refreshTheme).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });

/* ---------- beeldkwaliteit: lagere pixelratio tijdens grote animaties, lichte weergave als het hapert ---------- */
let uiLite = false, uiAdapted = false, uiLastFrame = 0, uiPrevActive = false;
const uiFt = [];
function uiMoving() { let c = 0; for (const n of uiAnim) if (n.delay <= 0) c += n.count; if (uiPlayS) c += uiPlayS.w.count; return c; }
function uiPickDpr(active) {
  if (uiLite) return Math.min(1, uiDprCap);
  if (active && uiMoving() > 800) return Math.max(1, uiDprCap * 0.75);
  return uiDprCap;
}
function uiSetDpr(v) { if (Math.abs(v - uiDpr) < 1e-3) return; uiDpr = v; uiBufferSize(); }
// tekenbuffer in één keer op maat (setPixelRatio + setSize wezen hem twee keer opnieuw toe); niets doen als hij al klopt
function uiBufferSize() {
  if (canvas.width === Math.floor(W * uiDpr) && canvas.height === Math.floor(H * uiDpr) && renderer.getPixelRatio() === uiDpr) {
    const s = renderer.getSize(new THREE.Vector2()); if (s.x === W && s.y === H) return;
  }
  renderer.setDrawingBufferSize(W, H, uiDpr);
}
function uiSetLite(on) {
  uiAdapted = true; uiLite = on;
  const cc = on ? 0 : 1;
  MAT.paint.clearcoat = cc; MAT.paint.needsUpdate = true;
  for (const m of [uiHV.get(MAT.paint), uiSL.get(MAT.paint)]) if (m) { m.clearcoat = on ? 0 : 0.2; m.needsUpdate = true; }
  els.qualityRow.hidden = false; els.qualityNote.hidden = !on; els.quality.checked = !on;
  uiSetDpr(uiPickDpr(false));
  requestRender();
}
function uiMeasure(now, active) {
  if (uiAdapted || REDUCED) return;
  const dt = now - uiLastFrame;
  if (active && uiPrevActive && uiLastFrame && dt < 250) {
    uiFt.push(dt); if (uiFt.length > 20) uiFt.shift();
    if (uiFt.length === 20 && uiFt.reduce((a, b) => a + b, 0) / 20 > 40) uiSetLite(true);
  } else if (!active) uiFt.length = 0;
  uiLastFrame = now; uiPrevActive = active;
}
function uiNearFar() {
  const d = camera.position.distanceTo(controls.target);
  const near = clamp(d / 250, 0.004, 0.08), far = Math.max(80, d * 30);
  if (Math.abs(near - camera.near) / camera.near > 0.2 || Math.abs(far - camera.far) / camera.far > 0.2) { camera.near = near; camera.far = far; camera.updateProjectionMatrix(); }
}
// Markeer-, aanwijs- en systeemmaterialen vooraf compileren (in kleine stukjes na de eerste weergave),
// zodat de eerste keer aanwijzen of selecteren niet hapert op het compileren van een shader.
function uiWarmMaterials() {
  const todo = [];
  const bases = [...new Set(MESHES.map(m => m.userData.base))];
  for (const b of [...bases, ...Object.values(SYS_MATS)]) todo.push(uiSelMat(b), uiHvMat(b));
  todo.push(...Object.values(SYS_MATS), GHOST, GHOST_HL, uiGhostHv, uiDimMat);
  const geo = new THREE.BoxGeometry(0.001, 0.001, 0.001);
  // kleine oefenscène met dezelfde soorten en aantallen lichten en dezelfde omgeving als de echte scène: dezelfde
  // shaderprogramma's, maar compile() hoeft niet elke keer alle 2.400 meshes van de auto langs
  const ws = new THREE.Scene();
  scene.traverse(o => { if (o.isLight) ws.add(o.clone()); });
  const step = () => {
    const batch = todo.splice(0, 4);
    if (!batch.length) { geo.dispose(); return; }
    ws.environment = scene.environment;
    const g = new THREE.Group();
    for (const mat of batch) { const m = new THREE.Mesh(geo, mat); m.position.set(0, -40, 0); g.add(m); }
    ws.add(g);
    try { renderer.compile(ws, camera); } catch (_) { } finally { ws.remove(g); }
    setTimeout(step, 40);
  };
  setTimeout(step, 600);
}
// R2: bij contextverlies een melding en preventDefault (anders herstelt de browser de context niet); bij herstel de
// omgevingskaart opnieuw maken (een rendertarget heeft geen kopie in het geheugen) en de melding weghalen
let uiContextLost = false;
canvas.addEventListener('webglcontextlost', e => {
  e.preventDefault(); uiContextLost = true;
  uiNotice(TXT.contextWeg);
});
canvas.addEventListener('webglcontextrestored', () => {
  uiContextLost = false;
  uiRemakeEnvironment(); // geometrie en gegevenstexturen zet three.js zelf opnieuw op de kaart
  uiNotice(null);
  requestRender();
});

/* ---------- render-lus ---------- */
controls.addEventListener('change', requestRender);
controls.addEventListener('start', () => { camAnim = null; uiUserCam = true; hideHint(); uiStopTour(); uiWake(); });
function uiTick(dt) {
  let active = stepExplode(dt);
  if (uiStepOff(dt)) active = true;
  if (stepOpen(dt)) active = true;
  if (uiStepPlay(dt)) active = true;
  if (stepCam(dt)) active = true;
  if (stepGround(dt)) active = true;
  if (uiStepFade(dt)) active = true; // U4
  if (uiVisDirty) { applyVisibility(); active = true; }
  return active;
}
function uiAfterAnim() {
  renderPanel();
  if (treeVisible()) renderTree();
  uiSyncExplode();
  if (uiHoverPos && !down) uiDoHover();
}
// Golf 5c-2, P4: één frame is drie stappen: tick (animaties en de camera), render (alleen als er iets te tekenen is) en
// achtergrondwerk (labelankers en batches, binnen een tijdsbudget). Is er na een frame niets meer te doen, dan vraagt de lus
// geen volgend frame aan; uiWake() (app1.js) start hem weer bij invoer, animatie, rondleiding, formaatwissel,
// contextherstel en thema (via requestRender en de animatiefuncties). Een fout midden in een frame houdt de lus draaiende.
let last = performance.now(), uiBatchDrawT = 0; // uiWasActive staat bij de lusstand in app1.js
function loop(now) {
  let more = true;
  try { more = uiFrame(now); } finally { if (more) requestAnimationFrame(loop); else { uiLoopOn = false; uiDebugIdle(); } }
}
function uiFrame(now) {
  // na stilstand rekent het eerste frame met één normale frameduur, niet met de hele rustperiode; en tekent het (uiWake)
  if (uiLoopWoke) { uiLoopWoke = false; last = now - 1000 / 60; needs = true; }
  const dt = Math.min(0.1, Math.max(0, (now - last) / 1000)); last = now;
  const active = uiTick(dt);
  const moved = controls.update(); // demping: de camera loopt na het loslaten nog even uit
  const drew = active || needs || controls.autoRotate ? uiRenderFrame(now, active) : false;
  uiDebugFrame(now, dt, drew);
  const busy = uiBackgroundWork(now, active);
  if (uiWasActive && !active) { needs = true; uiAfterAnim(); }
  uiWasActive = active;
  return active || needs || moved || controls.autoRotate || busy;
}
function uiRenderFrame(now, active) {
  uiSetDpr(uiPickDpr(active));
  uiNearFar();
  uiBatchSync(); // eerst de batchkeuze (was een omhulsel om renderer.render in app1.js)
  renderer.render(scene, camera);
  updateLabels();
  needs = false;
  uiMeasure(now, active);
  return true;
}
// achtergrondwerk; true zolang er nog werk in de rij staat
function uiBackgroundWork(now, active) {
  // labelankers van de groep die opent in kleine porties vooruit bouwen (zie uiAnchorStep)
  if (uiAnchorFrame(active)) needs = true;
  // batches bouwen in de vrije tijd van het frame; opnieuw tekenen als de rij leeg is of hoogstens elke 300 ms
  // (een weergave per batch zou in software-WebGL de opbouw zelf vertragen); bij het opstarten hoogstens elke 1,5 s,
  // zodat de eerste batches niet op een rij volle weergaven van de losse auto hoeven te wachten
  const uiStart = now - uiReadyT < CFG.tijd.startMs;
  if (uiBatchOn && (uiBatchQ.size || uiBatchJob) && uiBatchStep(active ? CFG.budget.batchActief : (uiStart ? CFG.budget.batchStart : CFG.budget.batchRust)) && (!uiBatchQ.size && !uiBatchJob || now - uiBatchDrawT > (uiStart ? CFG.budget.batchTekenStartMs : CFG.budget.batchTekenMs))) { needs = true; uiBatchDrawT = now; }
  if (uiTiming.batches === undefined && !uiBatchQ.size && !uiBatchJob) uiTiming.batches = Math.round(now);
  return !!(uiAnchorQ.size || uiAnchorJob || (uiBatchOn && (uiBatchQ.size || uiBatchJob)));
}

/* ---------- debug-overlay (?debug=1): tekensnelheid, tekenopdrachten, pixelratio, lichte weergave en versie, zodat een
   melding van een echt apparaat meetbaar is (docs/telefoontest.md) ---------- */
const uiDebug = (() => { try { return new URLSearchParams(location.search).get('debug') === '1'; } catch (_) { return false; } })();
const uiDbg = uiDebug ? { el: document.createElement('div'), t: 0, n: 0, acc: 0 } : null;
if (uiDbg) { uiDbg.el.id = 'debug'; uiDbg.el.setAttribute('aria-hidden', 'true'); document.getElementById('app').appendChild(uiDbg.el); }
function uiDebugIdle() { if (uiDbg) { uiDbg.n = 0; uiDbg.acc = 0; uiDbg.t = 0; uiDebugFrame(performance.now(), 0, false); } }
function uiDebugFrame(now, dt, drew) {
  if (!uiDbg) return;
  if (drew) uiDbg.n++;
  uiDbg.acc += dt;
  if (now - uiDbg.t < 500) return;
  const i = renderer.info.render, fps = uiDbg.acc > 0 ? uiDbg.n / uiDbg.acc : 0;
  uiDbg.el.textContent = TXT.debug(uiDbg.n ? fps : null, i.calls, Math.round(i.triangles / 1000), renderer.getPixelRatio(), uiLite, uiVersion);
  uiDbg.t = now; uiDbg.n = 0; uiDbg.acc = 0;
}

/* ---------- deelbare stand in de URL: ?preset=id, of ?open=naam,naam (modus Openen; een naam die vaker voorkomt als pad zonder
   wortel). De URL volgt de stand met replaceState, zodat de adresbalk altijd een werkende link is. ---------- */
let uiUrlLast = null;
function uiUrlSync() {
  let u; try { u = new URL(location.href); } catch (_) { return; }
  if (!/^https?:$/.test(u.protocol)) return;
  const q = u.searchParams; q.delete('preset'); q.delete('open');
  if (ACTIVE_PRESET && appPresetById.has(ACTIVE_PRESET) && ACTIVE_PRESET !== 'assembled') q.set('preset', ACTIVE_PRESET);
  else if (OPENMODE) {
    const open = OPENERS.filter(n => n.ot > 0).map(n => uiNameCount.get(n.name) === 1 ? n.name : uiRelPath(n));
    if (open.length) q.set('open', open.join(','));
  }
  const s = q.toString(), next = u.pathname + (s ? '?' + s : '') + u.hash;
  if (next === uiUrlLast) return;
  uiUrlLast = next;
  try { history.replaceState(history.state, '', next); } catch (_) { }
}
function uiUrlApply() {
  let q; try { q = new URLSearchParams(location.search); } catch (_) { return; }
  const pid = q.get('preset'), open = q.get('open');
  if (pid) {
    const p = appPresetById.get(pid);
    if (p && !p.tour && appPresetOk(p)) { appApplyPreset(p, { noHistory: true }); finishAll(); return; }
  }
  if (open) {
    const refs = open.split(',').map(x => x.trim()).filter(Boolean);
    const p = { id: 'url', cat: 'Openen', label: TXT.gedeeldeStand, note: TXT.gedeeldeStandUitleg, opens: refs };
    if (refs.length && appPresetOk(p)) { appApplyPreset(p, { noHistory: true }); finishAll(); }
  }
}

/* ---------- start (uiReady en uiReadyT staan bovenin app2-panel.js) ---------- */
uiTiming.startUp = Math.round(performance.now());
applyVisibility();
if (uiSide()) els.sheet.dataset.state = 'open';
resize();
select(ROOT);
uiBuildCats();
uiSyncUndo();
updateGround();
{ const f = uiFitPoints(uiCollect([ROOT], true), DIRS.iso, 1.04); if (f) { camera.position.copy(f.pos); controls.target.copy(f.target); } uiLastFit = { preset: appPresetById.get('assembled') }; }
controls.update();
uiTiming.render0 = Math.round(performance.now());
LOADING.textContent = TXT.laadEerste;
uiBatchSync();
renderer.render(scene, camera);
LOADING.classList.add('gone');
uiTiming.firstFrame = Math.round(performance.now());
uiInitHint();
uiUrlApply();
requestAnimationFrame(t => {
  last = t; uiReady = true; uiReadyT = performance.now(); uiTiming.interactive = Math.round(uiReadyT);
  uiLoopLive = true; uiLoopOn = true; loop(t);
  setTimeout(uiPnFill, 0); // P1: de nummers in het paneel pas na de eerste weergave
});
uiWarmMaterials();
{ const errs = appCheckPresets(); if (errs.length) console.warn('presets: ' + errs.join('; ')); }
// labelbreedtes opnieuw meten zodra de lettertypen er zijn
if (document.fonts && document.fonts.ready) document.fonts.ready.then(() => { for (const n of ALL) n._lw = null; uiUiChanged(); layoutView(); });

function finishAll() {
  if (uiRefitTimer) uiRefitNow();
  for (const n of uiAnim) { n.delay = 0; n.k = 1; n.amt = n.target; placeKids(n); }
  if (uiAnim.size) { uiAnim.clear(); uiOpenResync(); }
  for (const n of uiOffAnim) { n.odelay = 0; n.ok = 1; n.off.copy(n.off1); if (n.off.lengthSq() === 0) n.hasOff = false; uiPlace(n); }
  uiOffAnim.clear();
  for (const n of uiOpenAnim) { n.opk = 1; n.ou = n.ot; uiOpenApply(n); }
  if (uiOpenAnim.size) { uiOpenAnim.clear(); uiStrutSync(); }
  if (uiPlayS) { const s = uiPlayS; uiPlayS = null; uiApplyX(s.w, s.x1, true); updateGround(); }
  if (camAnim) { camera.position.copy(camAnim.p1); controls.target.copy(camAnim.t1); camAnim = null; }
  uiFadeEnd(); // U4: ook de fade bij isoleren is dan klaar
  applyVisibility();
  ground.position.y = groundTarget; blob.position.y = groundTarget + 0.002;
  controls.update();
  ROOT.obj.updateMatrixWorld(true); camera.updateMatrixWorld();
  uiAnchorPrefetch(); uiAnchorFlush();
  uiAfterAnim(); uiSyncCats(); uiSyncLabels();
  uiBatchSync(); // de eindstand direct in de batchkeuze (testgereedschap tekent soms zelf met renderer.render)
  requestRender();
}
// Frametijd zonder finishAll(): klapt de groep uit en draait de echte animatiestap N keer
// (uitklappen, verschuivingen, wereldmatrices en labelindeling, zonder renderer.render).
function uiProfileFrames(name, frames = 120, cold = false) {
  const g = typeof name === 'string' ? byName(name) : name;
  if (!g) return null;
  const snap = uiSnap();
  collapseTree(g); finishAll();
  const oldCtx = CTX, oldForce = uiLabelForce;
  if (cold) { uiAnchorQ.clear(); uiAnchorJob = null; uiPfGroup = null; uiGeoAnchor = new WeakMap(); for (const n of ALL) { n._la = null; n._lf = null; } }
  explodeAllUnder(g); CTX = g; uiLabelForce = false;
  const times = []; let aMax = 0;
  for (let i = 0; i < frames; i++) {
    const t0 = performance.now();
    uiTick(1 / 60);
    ROOT.obj.updateMatrixWorld();
    const t1 = performance.now();
    uiAnchorFrame(true);
    aMax = Math.max(aMax, performance.now() - t1);
    updateLabels();
    times.push(performance.now() - t0);
  }
  uiRestore(snap, true); CTX = oldCtx; uiLabelForce = oldForce; finishAll();
  const s = times.slice().sort((a, b) => a - b), q = f => s[Math.min(s.length - 1, Math.floor(f * s.length))];
  return { frames, p50: +q(0.5).toFixed(3), p95: +q(0.95).toFixed(3), max: +s[s.length - 1].toFixed(3), mean: +(times.reduce((a, b) => a + b, 0) / frames).toFixed(3), anchorMax: +aMax.toFixed(3) };
}
function uiState() {
  const w = uiWorking(), L = uiLevels(w).length;
  return {
    open: ASMS.filter(n => n.target > 0.5).map(n => n.name), selected: (SEL || ROOT).name, iso: ISO.map(n => n.name), xray: XRAY,
    explode: { group: w.name, value: L ? +(uiExplodeX(w) / L).toFixed(4) : 0, levels: L }, history: uiHist.length,
    lifted: uiLifted ? uiLifted.name : null, preset: ACTIVE_PRESET, dim: DIM ? DIM.name : null, mode: MODE, openMode: OPENMODE, openers: OPENERS.filter(n => n.ot > 0).map(n => n.name), tour: !!appTour, playing: !!uiPlayS, sys: SYSCOL,
  };
}
function uiFrameOf(names) {
  const nodes = (Array.isArray(names) ? names : [names]).map(n => (typeof n === 'string' ? byName(n) : n)).filter(Boolean);
  const v = uiFreeView();
  const b = nodes.length ? uiProject(uiCollect(nodes, false)) : null;
  const view = { x: v.x0, y: v.y0, w: v.x1 - v.x0, h: v.y1 - v.y0 };
  if (!b) return { box: null, view, inside: false, cover: 0 };
  const box = { x: b.x0, y: b.y0, w: b.x1 - b.x0, h: b.y1 - b.y0 };
  const ix = Math.max(0, Math.min(b.x1, v.x1) - Math.max(b.x0, v.x0)), iy = Math.max(0, Math.min(b.y1, v.y1) - Math.max(b.y0, v.y0));
  const inside = b.x0 >= v.x0 - 1 && b.y0 >= v.y0 - 1 && b.x1 <= v.x1 + 1 && b.y1 <= v.y1 + 1;
  return { box, view, inside, cover: +(ix * iy / Math.max(1, view.w * view.h)).toFixed(4) };
}
// Testkoppeling. Aanroepen die de stand veranderen tellen als interactie: de hint verdwijnt direct
// en de presetmarkering vervalt (een preset die je daarna kiest, zet hem weer).
const uiApi = (f, changes) => (...a) => { hideHint(true); const r = f(...a); if (changes) { clearPreset(); uiAfterAction(); } return r; };
window.__model = {
  version: uiVersion || null,  // versiestempel uit build.py (VERSION plus inhoudshash)
  finishAll, ROOT, ALL, MESHES, PRESETS, byName,
  select: uiApi(select), tapNode: uiApi(tapNode), focusNodes: uiApi(focusNodes),
  setTarget: uiApi(setTarget, true), explodeAllUnder: uiApi(explodeAllUnder, true), collapseAll: uiApi(collapseAll, true), isolate: uiApi(isolate, true),
  // klaar: gebouwd, eerste keer getekend en bedienbaar; op de batches van de beginstand wordt hoogstens 2 s gewacht
  // (tests die gebundelde aantallen meten roepen eerst batchFlush() aan)
  get ready() {
    const ok = uiReady && (!uiBatchOn || (!uiBatchQ.size && !uiBatchJob) || performance.now() - uiReadyT > CFG.tijd.klaarMs);
    if (ok && uiTiming.ready === undefined) uiTiming.ready = Math.round(performance.now());
    return ok;
  },
  timing: () => Object.assign({ batchesDone: !uiBatchQ.size && !uiBatchJob }, uiTiming),
  byPath: uiByPath,
  preset: id => { hideHint(true); return uiRunPreset(id); },
  presetList: () => PRESETS.filter(appPresetOk).map(p => ({ id: p.id, cat: p.cat, label: p.label, key: p.key || null, subject: p.tour ? [] : appSubject(p).map(n => n.name), tour: !!p.tour })),
  checkPresets: appCheckPresets,
  state: uiState,
  pickAt: (x, y) => { const n = pick(x, y); return n ? n.name : null; },
  pickNodeAt: (x, y, loose) => pick(x, y, loose),
  hoverTarget: uiHoverTarget,
  hoverNode: (x, y) => uiActTarget(pick(x, y)),
  sel: () => SEL,
  liftedNode: () => uiLifted,
  nodeById: id => uiById.get(id),
  undo: () => uiUndo(),
  setExplode: uiSetExplodeValue,
  play: uiPlay,
  labelRects: uiLabelRects,
  uiRects,
  frameOf: uiFrameOf,
  freeView: () => { const v = uiFreeView(); return { x: v.x0, y: v.y0, w: v.x1 - v.x0, h: v.y1 - v.y0 }; },
  profileFrames: uiProfileFrames,
  setMode: uiSetMode,
  dimInfo: () => ({ on: uiDimOn, focus: DIM ? DIM.name : null, dimmed: uiDimSet ? MESHES.filter(m => !uiDimSet.has(m)).length : 0 }),
  setDimOn: on => { uiDimOn = !!on; $('tDim').checked = uiDimOn; if (!uiDimOn) uiSetDim(null); applyMats(); uiAfterAction(); return uiDimOn; },
  dive: n => uiDive(typeof n === 'string' ? byName(n) : n),
  collapseAt: n => uiCollapseAt(typeof n === 'string' ? byName(n) : n),
  stopTour: uiStopTour,
  get lite() { return uiLite; },
  batching: on => { if (on !== undefined) { uiSetBatching(on); $('tBatch').checked = uiBatchOn; requestRender(); } return uiBatchOn; },
  batchFlush: () => { uiBatchFlush(); requestRender(); return uiBatchStats(); },
  batchStats: uiBatchStats,
  batchedGroups: () => [...uiBatched].map(g => g.name),
  // tekentijd (software-rendering, alleen om standen te vergelijken): gemiddelde ms per render, met gl.finish aan beide kanten
  renderMs: (k = 5) => { const gl = renderer.getContext(); uiBatchSync(); gl.finish(); const t = performance.now(); for (let i = 0; i < k; i++) renderer.render(scene, camera); gl.finish(); return +((performance.now() - t) / k).toFixed(2); },
  drawCalls: () => { uiBatchSync(); renderer.info.reset(); renderer.render(scene, camera); return renderer.info.render.calls; },
  // openmodus (kern): leiders met hun stand; setOpen(naam, 0..1, direct); openAll(0..1, direct)
  openers: () => OPENERS.map(n => ({ name: n.name, label: n.opn.label || n.name, type: n.opn.type, open: +n.ou.toFixed(4), target: n.ot, followers: n.opn.followers.map(f => f.name) })),
  setOpenMode: on => { hideHint(true); uiSetOpenMode(on); return OPENMODE; },
  openPlan: x => { const n = typeof x === 'string' ? byName(x) : x; const pl = n && uiOpenPlan(n); return pl ? { opener: pl.n.name, open: pl.open } : null; },
  pnRebuild: uiPnBuild, pnCheck: uiPnCheck, pnOf: x => { const n = typeof x === 'string' ? (uiByPath(x) || byName(x)) : x; const r = n && uiPnRec(n); return r ? { kind: r.kind, unit: r.id, rule: r.rule || null } : null; },
  setOpen: (name, v, instant) => { const r = uiSetOpen(name, v, instant); uiSyncOpenUi(); renderPanel(); requestRender(); return r; },
  openAll: (v, instant) => { for (const n of OPENERS) uiSetOpen(n, v, instant); uiSyncOpenUi(); renderPanel(); requestRender(); return OPENERS.length; },
  // golf 5c-1: toetsbare toestand van de nieuwe functies
  get lastError() { return window.__modelLastError || null; },           // R1b: laatste fout uit de globale handler
  get contextLost() { return uiContextLost; },                           // R2
  lastFit: () => !uiLastFit ? null : uiLastFit.preset ? { preset: uiLastFit.preset.id } : { nodes: uiLastFit.nodes.map(n => n.name), dir: uiLastFit.dir ? uiLastFit.dir.toArray() : null, pad: uiLastFit.pad }, // R3
  tourState: () => appTour ? { step: appTour.i, steps: appTourSteps.length, paused: !!appTour.paused, auto: !!appTour.auto, preset: appTourSteps[appTour.i] } : null, // R4
  tour: { pause: () => uiTourPause(true), resume: () => uiTourPause(false), prev: () => uiTourStep(-1), next: () => uiTourStep(1) },
  labelsMore: () => uiLabelsMore,                                       // U2
  get hintStage() { return uiHintStage; }, hintNext: uiHintNext,        // U8
  get fading() { return !!uiFade; },                                    // U4
  isolated: () => ISO.map(n => n.name),                                 // U4
  theme: () => ({ choice: uiThemeChoice(), dark: getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim() === 'dark' }), // U5
  setTheme: uiSetTheme,
  norm: uiNorm, searchTerms: uiSearchTerms,                             // U10
  saveImage: uiSaveImage,                                               // U9
  toast: uiToast,                                                       // U8
};
// de testhaak heet in elk model __model; AUTO.hook geeft er per auto een tweede naam aan
if (AUTO.hook && AUTO.hook !== '__model') window[AUTO.hook] = window.__model;
