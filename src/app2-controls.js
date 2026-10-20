/* ===================== bediening (2/5): handelingen, isoleren, openmodus, weergave, explosieschuif, presets en rondleiding ===================== */

/* ---------- handelingen ---------- */
function uiAct(p) {
  if (!p) { uiBackground(); return; }
  uiMode().act(p);
}
function tapNode(n) { uiAct(n); }
function doExplode(g) {
  uiPush();
  setTarget(g, 1); updateGround();
  CTX = g; uiLabelForce = false; clearPreset();
  select(g);
  uiSoftFrame([g]);
  uiAfterAction();
}
function doCollapse(a) {
  uiPush();
  collapseTree(a); updateGround(); // I4: de vloer volgt de eindstand
  CTX = a.parent && uiOpen(a.parent) ? a.parent : null; uiLabelForce = false; clearPreset();
  select(a);
  uiAfterAction();
}
function uiCollapseAt(p) { uiMode().collapse(p); }
function uiBackground() {
  const r = uiScopeRoot();
  if (SEL === r && !uiLifted) return;
  uiPush(); uiDrop(); select(r); uiAfterAction();
}
// Dubbelklik: alle dichte groepen op het pad van de isolatiewortel (of de auto) tot en met de ouder van P openen, laag voor laag.
function uiDive(p) {
  if (!p) return;
  uiPush();
  const lv = [...pathFrom(p)].filter(a => a.asm && a !== p && !uiOpen(a)), st = uiStaffel(CFG.tijd.staffelS, lv.length, CFG.tijd.staffelMaxS);
  lv.forEach((a, i) => setTarget(a, 1, i * st));
  CTX = p.parent || p; uiLabelForce = false; clearPreset();
  if (uiMode().dim) uiSetDim(p); // U19
  select(p);
  focusNodes([p], null, p.asm ? 1.15 : 1.7, { min: 0.3, dur: Math.max(0.95, lv.length * st + 0.55) });
  uiAfterAction();
}
function reveal(n) { uiMode().reveal(n); }
// in Openen klapt niets uit: alleen selecteren en in beeld brengen
function uiRevealOpen(n) {
  uiPush();
  if (uiSheetBottom() && els.sheet.dataset.state === 'open') setSheet('peek');
  select(n);
  focusNodes([n], null, n.asm ? 1.12 : 1.6, { min: 0.3 });
  uiAfterAction();
}
function uiRevealExplode(n) {
  uiPush();
  if (ISO.length && !uiInScope(n)) { ISO = []; applyVisibility(); updateGround(); }
  const lv = [...ancestors(n)].filter(a => !uiOpen(a)), st = uiStaffel(CFG.tijd.tonenStaffelS, lv.length, CFG.tijd.staffelMaxS);
  lv.forEach((a, i) => setTarget(a, 1, i * st));
  CTX = n.parent || null; uiLabelForce = false; clearPreset();
  uiSetDim(n); // U19 (de wortel zet het uit)
  // telefoon: paneel terug naar de smalle stand, zodat je ziet wat er gebeurt
  if (uiSheetBottom() && els.sheet.dataset.state === 'open') setSheet('peek');
  select(n);
  focusNodes([n], null, n.asm ? 1.12 : 1.6, { min: 0.3, dur: Math.max(0.95, lv.length * st + 0.55) });
  uiAfterAction();
}
function uiUp() {
  const a = SEL && uiClosedAbove(SEL);
  if (a) doExplode(a);
}
// Kadreren na een klik: alleen bewegen als de groep niet (goed) in beeld is.
function uiSoftFrame(nodes) {
  const pts = uiCollect(nodes, true);
  if (!pts.length) return;
  const b = uiProject(pts), v = uiFreeView();
  const inside = b && b.x0 >= v.x0 && b.x1 <= v.x1 && b.y0 >= v.y0 && b.y1 <= v.y1;
  const cover = b ? ((b.x1 - b.x0) * (b.y1 - b.y0)) / Math.max(1, (v.x1 - v.x0) * (v.y1 - v.y0)) : 0;
  if (inside && cover > 0.06) return;
  const f = uiFitPoints(pts, null, 1.3, { min: 0.45 });
  if (f) { animCam(f.pos, f.target, 0.9); uiLastFit = { nodes, dir: null, pad: 1.3, opt: { min: 0.45 } }; }
}
const uiPv = V3(0, 0, 0);
// Een wereldpunt naar schermpixels in een vlak van w bij h (linksboven 0,0). v wordt ter plekke omgezet; z blijft de diepte
// van project() (boven 1 ligt het punt achter de camera). Golf 5c-2, K3: was vier keer uitgeschreven.
function uiToScreen(v, w = W, h = H) { v.project(camera); v.x = (v.x * 0.5 + 0.5) * w; v.y = (-v.y * 0.5 + 0.5) * h; return v; }
function uiProject(pts) {
  camera.updateMatrixWorld();
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (let i = 0; i < pts.length; i += 3) {
    uiToScreen(uiPv.set(pts[i], pts[i + 1], pts[i + 2]));
    if (uiPv.z > 1) return null;
    const x = uiPv.x, y = uiPv.y;
    if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y;
  }
  return Number.isFinite(x0) ? { x0, y0, x1, y1 } : null;
}
function uiFreeView() { return { x0: VIEW.l, y0: VIEW.t, x1: W - VIEW.r, y1: H - VIEW.b }; }
// U4: isoleren met een korte fade van wat uit beeld gaat (uiFadeFrom in app1.js) en de badge in het dock (uiSyncIso)
function isolate(list) {
  uiSetDim(null);
  const before = uiVisibleMeshes();
  ISO = list.slice(); applyVisibility(); uiFadeFrom(before); applyMats(); updateGround(); uiSyncIso(); requestRender();
}
function uiSyncIso() {
  const on = ISO.length > 0, txt = TXT.namenEn(ISO.map(n => n.name));
  // Eerst de tekst, dan de badge en de maat: een andere naam kan de badge laten omslaan, en het dock verandert dan meteen
  // (niet pas bij de ResizeObserver, die op een trage machine na het kadreren komt).
  let relayout = false;
  if (on && els.isoName.textContent !== txt) { els.isoName.textContent = txt; uiUiDirty = true; relayout = true; }
  if (els.isoBadge.hidden !== !on) { els.isoBadge.hidden = !on; uiUiChanged(); relayout = true; }
  if (relayout) layoutView();
}
$('isoShowAll').onclick = () => $('btnShowAll').click();

els.toggle.onclick = () => { const n = SEL; if (!n.asm) return; uiOpen(n) ? doCollapse(n) : doExplode(n); };
els.all.onclick = () => { const n = SEL; if (!n.asm) return; uiPush(); explodeAllUnder(n); CTX = n; uiLabelForce = false; clearPreset(); focusNodes([n], null, 1.04); uiAfterAction(); };
els.up.onclick = uiUp;
els.dim.onclick = () => { uiPush(); uiSetDim(null); uiAfterAction(); };
els.dive.onclick = () => uiDive(SEL);
els.iso.onclick = () => {
  uiPush();
  const on = ISO.length && (ISO.includes(SEL) || SEL === ROOT);
  isolate(on ? [] : [SEL]); clearPreset();
  focusNodes(on ? [ROOT] : [SEL]);
  uiAfterAction();
};
els.focus.onclick = () => { focusNodes([SEL], null, SEL.asm ? 1.08 : 1.6, { min: 0.25 }); };

/* ---------- openmodus: bediening ---------- */
// Openers (OPENERS in app1.js) draaien of schuiven open. In de modus Openen doet een klik dat in plaats van uitklappen.
// Klikregel: neem de openers op het pad van het geraakte onderdeel, van buiten naar binnen (volgers tellen als hun leider).
// De eerste dichte opener gaat open; zijn ze allemaal open, dan sluit de binnenste. Een klik op de ruit van een dicht
// portier opent dus het portier, daarna de ruit; een tweede klik op de ruit sluit de ruit weer. Rechtsklik, Shift+klik en
// lang drukken sluiten de binnenste open opener op het pad. Ingang: alles ingeklapt (Gemonteerd), openers blijven; uitgang: openers blijven staan.
function uiOpenPath(p) {
  const chain = []; for (let a = p; a; a = a.parent) chain.unshift(a);
  const out = [];
  for (const a of chain) if (a.opn) { const l = a.opn.lead || a; if (!out.includes(l)) out.push(l); }
  return out;
}
// wat een klik op p nu doet: { n: de opener, open: true om te openen, false om te sluiten } of null
function uiOpenPlan(p) {
  const list = p ? uiOpenPath(p) : [];
  if (!list.length) return null;
  const closed = list.find(n => n.ot === 0);
  return closed ? { n: closed, open: true } : { n: list[list.length - 1], open: false };
}
// paneel en Enter: staat de selectie zelf voor een opener (een leider), dan werkt de knop op die opener, ook als een
// buitenste opener dicht is (de knop past dan bij de badge Open of Dicht); bij een ander onderdeel geldt de klikregel
function uiPanelPlan(p) {
  if (p && p.opn && !p.opn.lead) return { n: p, open: p.ot === 0 };
  return uiOpenPlan(p);
}
// camera bij openen: richting en kader uit open.look, het kader in de eindstand (focusNodes rekent de doelstand mee)
function uiOpenFrame(nodes, dir, pad) { focusNodes(nodes, dir, pad, { min: 0.3 }); }
function uiOpenTo(n, open) {
  uiStopPlay(); uiStopTour(); hideHint();
  uiPush();
  uiSetOpen(n, open ? 1 : 0);
  clearPreset(); CTX = null; uiLabelForce = false;
  select(n); // eerst het paneel: de kaart wordt bij een selectie hoger en het vrije beeld rekent met zijn werkelijke hoogte
  if (open) { // bij sluiten beweegt de camera niet
    if (uiSheetBottom()) { syncSheetHeight(); layoutView(); }
    const lk = n.opn.look || {}, nodes = (lk.nodes || []).map(r => uiRef(r, n.name)).filter(Boolean);
    uiOpenFrame(nodes.length ? nodes : [n], lk.dir ? V3(...lk.dir) : null, 1.1);
  }
  uiAfterAction();
}
function uiOpenAct(p) {
  const pl = uiOpenPlan(p);
  if (pl) uiOpenTo(pl.n, pl.open);
  else { uiPush(); select(p); uiAfterAction(); }
}
function uiOpenClose(p) {
  const open = p ? uiOpenPath(p).filter(n => n.ot > 0) : [];
  if (open.length) uiOpenTo(open[open.length - 1], false);
  else if (p) { uiPush(); select(p); uiAfterAction(); }
}
function uiOpenAllTo(v) {
  uiStopPlay(); uiStopTour(); hideHint();
  uiPush();
  for (const n of OPENERS) uiSetOpen(n, v ? 1 : 0);
  clearPreset();
  if (v) uiOpenFrame([ROOT], DIRS.iso, 1.04);
  uiAfterAction();
}
function uiSetOpenMode(on) {
  on = !!on;
  if (on === OPENMODE) return;
  uiStopPlay(); uiStopTour();
  uiPush();
  // de openstand blijft bij elke wissel staan: een geopende motorkap blijft open in Uitklappen (en kan daar uitgeklapt
  // worden), en terug in Openen gaat de explosie dicht maar blijven de openers zoals ze waren
  if (on) appApplyPreset(appPresetById.get('assembled'), { noHistory: true, openMode: true, keepOpen: true });
  else OPENMODE = false;
  clearPreset();
  uiUiChanged();
  uiAfterAction();
}
const uiOpenBtns = [...document.querySelectorAll('#openSeg [data-omode]')];
uiOpenBtns.forEach((b, i) => {
  b.addEventListener('click', () => { hideHint(); uiSetOpenMode(b.dataset.omode === 'open'); });
  b.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const j = (i + (e.key === 'ArrowRight' ? 1 : uiOpenBtns.length - 1)) % uiOpenBtns.length; uiSetOpenMode(uiOpenBtns[j].dataset.omode === 'open'); uiOpenBtns[j].focus(); e.preventDefault(); });
});
$('btnOpenAll').onclick = () => uiOpenAllTo(true);
$('btnCloseAll').onclick = () => uiOpenAllTo(false);
els.open.onclick = () => { const pl = uiPanelPlan(SEL); if (pl) uiOpenTo(pl.n, pl.open); };
// openerlijst: een knop per opener (aria-pressed = open), bereikbaar met toetsenbord en schermlezer
const uiOpenChips = OPENERS.map(n => {
  const b = document.createElement('button');
  b.type = 'button'; b.textContent = uiOpenLabel(n); b.setAttribute('aria-pressed', 'false');
  b.onclick = () => { uiCloseOpenList(); uiOpenTo(n, n.ot === 0); };
  $('openList').appendChild(b);
  return [n, b];
});
let uiOpenListOn = false;
$('btnOpenList').onclick = () => {
  uiOpenListOn = !uiOpenListOn; $('btnOpenList').setAttribute('aria-expanded', String(uiOpenListOn)); uiSyncOpenUi(); uiUiChanged(); layoutView();
  if (uiNarrow()) uiRefitSoon(); // de lijst neemt vrij beeld in of geeft het terug: de auto past in wat overblijft
};
// Op een smal scherm (telefoon staand en liggend, tablet) is de lijst een keuzemenu: na een keuze gaat hij dicht, zodat hij het
// beeld niet afdekt en het vrije beeld weer de volle hoogte heeft voordat de camera de opener kadreert. Op het bureaublad
// staat hij naast het beeld en blijft open.
function uiCloseOpenList() {
  if (!uiOpenListOn || !uiNarrow()) return;
  uiOpenListOn = false; $('btnOpenList').setAttribute('aria-expanded', 'false'); uiSyncOpenUi(); uiUiChanged(); layoutView();
}
let uiOpenWas = false;
function uiSyncOpenUi() {
  uiUrlSync(); // de adresbalk volgt de openstand (ook via de testhaken setOpen en openAll)
  $('app').classList.toggle('omode', OPENMODE);
  uiOpenBtns.forEach(b => { const on = (b.dataset.omode === 'open') === OPENMODE; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
  let open = 0;
  for (const [n, b] of uiOpenChips) { const on = n.ot > 0; if (on) open++; if (b.getAttribute('aria-pressed') !== String(on)) b.setAttribute('aria-pressed', String(on)); }
  const txt = open + '/' + OPENERS.length;
  if ($('openCount').textContent !== txt) $('openCount').textContent = txt;
  const showList = OPENMODE && uiOpenListOn;
  if ($('openList').hidden === showList) $('openList').hidden = !showList;
  if (uiOpenWas !== OPENMODE) { uiOpenWas = OPENMODE; uiUiChanged(); layoutView(); }
}

/* ---------- weergave-bediening ---------- */
$('spread').addEventListener('input', e => { uiSetSpread(e.target.value / 100, false); $('spreadOut').textContent = TXT.procent(e.target.value); requestRender(); });
$('spread').addEventListener('change', () => { updateGround(); focusNodes(contextNodes()); });
$('tLabels').addEventListener('change', e => { LABELS = e.target.checked; requestRender(); });
$('tXray').addEventListener('change', e => { uiPush(); XRAY = e.target.checked; clearPreset(); applyMats(); uiAfterAction(); });
$('tSys').addEventListener('change', e => { uiPush(); SYSCOL = e.target.checked; clearPreset(); applyMats(); uiAfterAction(); });
$('tRotate').addEventListener('change', e => { controls.autoRotate = e.target.checked; requestRender(); });
els.quality.addEventListener('change', e => uiSetLite(!e.target.checked));
$('tDim').addEventListener('change', e => { uiDimOn = e.target.checked; if (!uiDimOn) uiSetDim(null); applyMats(); uiAfterAction(); });
$('tBatch').addEventListener('change', e => { uiSetBatching(e.target.checked); requestRender(); });
els.legend.innerHTML = Object.entries(SYS_COLORS).map(([k, c]) => `<span><i style="background:#${c.toString(16).padStart(6, '0')}"></i>${esc(k)}</span>`).join('');
document.querySelectorAll('[data-cam]').forEach(b => b.addEventListener('click', () => focusNodes(contextNodes(), DIRS[b.dataset.cam])));
// U5: thema. 'system' volgt prefers-color-scheme (geen data-theme); 'light' en 'dark' staan op <html> en in localStorage.
// De MutationObserver op data-theme (hieronder bij thema) past lichten en vloer aan.
const uiThemeBtns = [...document.querySelectorAll('#themeSeg [data-theme]')];
function uiThemeChoice() { const t = document.documentElement.getAttribute('data-theme'); return t === 'light' || t === 'dark' ? t : 'system'; }
function uiSetTheme(t) {
  t = t === 'light' || t === 'dark' ? t : 'system';
  if (t === 'system') document.documentElement.removeAttribute('data-theme'); else document.documentElement.setAttribute('data-theme', t);
  try { if (t === 'system') window.localStorage.removeItem(UI_THEME_KEY); else window.localStorage.setItem(UI_THEME_KEY, t); } catch (_) { }
  uiSyncTheme();
}
function uiSyncTheme() {
  const cur = uiThemeChoice();
  uiThemeBtns.forEach(b => { const on = b.dataset.theme === cur; b.setAttribute('aria-checked', String(on)); b.tabIndex = on ? 0 : -1; });
}
uiThemeBtns.forEach((b, i) => {
  b.addEventListener('click', () => uiSetTheme(b.dataset.theme));
  b.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const j = (i + (e.key === 'ArrowRight' ? 1 : uiThemeBtns.length - 1)) % uiThemeBtns.length; uiSetTheme(uiThemeBtns[j].dataset.theme); uiThemeBtns[j].focus(); e.preventDefault(); });
});
uiSyncTheme();
// U9: beeld opslaan en de kaart afdrukken
function uiSlug(s) { return uiNorm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || TXT.beeldNaam; }
function uiSaveImage() {
  const n = SEL || ROOT, r = uiPnRec(n), nums = r && r.kind === 'zelf' && r.u ? [...(r.u.oe || []).map(x => x[0]), ...(r.u.am || []).map(x => x[0] + ' ' + x[1])] : [];
  uiBatchSync(); renderer.render(scene, camera); // op verzoek tekenen: de buffer wordt na het tonen niet bewaard
  const dpr = renderer.getPixelRatio(), w = canvas.width, h = canvas.height, bar = Math.round(44 * dpr);
  const c2 = document.createElement('canvas'); c2.width = w; c2.height = h + bar;
  const g = c2.getContext('2d');
  const cs = getComputedStyle(document.body);
  g.fillStyle = cs.backgroundColor || '#e5e9ed'; g.fillRect(0, 0, w, h + bar);
  g.drawImage(canvas, 0, 0);
  g.fillStyle = cs.color || '#151a21'; g.textBaseline = 'middle';
  g.font = `700 ${Math.round(15 * dpr)}px ${cs.fontFamily}`; g.fillText(n.name, Math.round(14 * dpr), h + bar / 2, w * 0.55);
  g.font = `${Math.round(12 * dpr)}px ${cs.fontFamily}`; g.textAlign = 'right';
  g.fillText((nums.length ? TXT.beeldNummer(nums.slice(0, 2).join(', ')) : '') + TXT.beeldVoet(AUTO.titel, uiVersion), w - Math.round(14 * dpr), h + bar / 2, w * 0.43);
  const name = `${AUTO.id}-${uiSlug(n.name)}.png`;
  return new Promise(res => c2.toBlob(blob => {
    if (!blob) { uiToast(TXT.beeldMislukt); res(null); return; }
    const a = document.createElement('a'), url = URL.createObjectURL(blob);
    a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 2000);
    uiToast(TXT.beeldOpgeslagen(name));
    res({ name, w: c2.width, h: c2.height, numbers: nums });
  }, 'image/png'));
}
$('btnShot').onclick = () => { uiSaveImage(); };
$('btnPrint').onclick = () => { showTab('info'); try { window.print(); } catch (_) { } };
// korte melding onderin (U8, U9); een nieuwe vervangt de vorige
let uiToastTimer = 0;
function uiToast(txt) {
  els.toast.textContent = txt; els.toast.hidden = false; els.toast.classList.remove('gone');
  clearTimeout(uiToastTimer);
  uiToastTimer = setTimeout(() => { els.toast.classList.add('gone'); setTimeout(() => { if (els.toast.classList.contains('gone')) els.toast.hidden = true; }, REDUCED ? 0 : 300); }, CFG.tijd.toastMs);
}
// R2: melding die blijft staan tot ze wordt weggehaald (contextverlies)
function uiNotice(txt) { els.notice.hidden = !txt; els.notice.textContent = txt || ''; }
$('btnExplodeAll').onclick = () => { const r = uiScopeRoot(); uiPush(); explodeAllUnder(r); CTX = r; uiLabelForce = false; clearPreset(); focusNodes(contextNodes(), null, 1.02); uiAfterAction(); };
$('btnCollapseAll').onclick = () => { uiPush(); collapseAll(); uiDrop(); CTX = null; clearPreset(); focusNodes(contextNodes()); uiAfterAction(); };
$('btnShowAll').onclick = () => { uiPush(); isolate([]); clearPreset(); select(ROOT); focusNodes([ROOT]); uiAfterAction(); };
const uiModeBtns = [...document.querySelectorAll('#modes [data-mode]')];
function uiSetMode(m) {
  MODE = m;
  uiModeBtns.forEach(x => { const on = x.dataset.mode === m; x.setAttribute('aria-checked', String(on)); x.tabIndex = on ? 0 : -1; });
  uiSetHover(null); uiHideTip(); requestRender();
}
uiModeBtns.forEach((b, i) => {
  b.addEventListener('click', () => uiSetMode(b.dataset.mode));
  b.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const j = (i + (e.key === 'ArrowRight' ? 1 : uiModeBtns.length - 1)) % uiModeBtns.length; uiSetMode(uiModeBtns[j].dataset.mode); uiModeBtns[j].focus(); e.preventDefault(); });
});

/* ---------- explosieschuif en afspelen ---------- */
// Werkgroep: de geselecteerde groep, anders de enige geïsoleerde groep, anders de hele auto.
// Met L niveaus en x = waarde × L krijgt een groep op relatieve diepte r doel clamp(x − r, 0, 1).
function uiWorking() { if (SEL && SEL.asm) return SEL; if (ISO.length === 1) return ISO[0]; return ROOT; }
const uiLevelCache = new Map();
function uiLevels(w) {
  let L = uiLevelCache.get(w);
  if (!L) { L = []; for (const a of subtree(w)) if (a.asm) { const r = a.depth - w.depth; (L[r] || (L[r] = [])).push(a); } uiLevelCache.set(w, L); }
  return L;
}
function uiExplodeX(w) { let x = 0; for (const lv of uiLevels(w)) { let s = 0; for (const a of lv) s += a.target; x += s / lv.length; } return x; }
function uiApplyX(w, x, now) {
  uiLevels(w).forEach((lv, r) => { const t = clamp(x - r, 0, 1); for (const a of lv) now ? uiSetNow(a, t) : setTarget(a, t, 0, 0.6); });
  // Een opgetild onderdeel gaat terug zodra zijn groep dichtgaat, anders zweeft het buiten de gesloten auto.
  if (uiLifted && !uiOpen(uiLifted.parent)) uiDrop();
}
let uiDrag = false, uiPlayS = null;
// Golf 5c-2, P3: tijdens afspelen draait dit elk frame; de DOM (waarde, tekst, aria-* en het pictogram) alleen schrijven als
// er iets verandert.
function uiSyncExplode(fromSlider) {
  const w = uiWorking(), L = uiLevels(w).length, x = uiExplodeX(w), v = L ? x / L : 0;
  const val = String(Math.round(v * 1000)), pct = TXT.procent(Math.round(v * 100)), vt = TXT.lagen(x, L);
  if (!fromSlider && !uiDrag && els.explode.value !== val) els.explode.value = val;
  if (els.explodeOut.textContent !== pct) els.explodeOut.textContent = pct;
  if (els.explode.getAttribute('aria-valuetext') !== vt) els.explode.setAttribute('aria-valuetext', vt);
  if (els.explodeName.textContent !== w.name) { els.explodeName.textContent = w.name; uiUiDirty = true; }
  const lbl = uiPlayS ? TXT.stop : (v >= 0.999 ? TXT.monteren : TXT.demonteren);
  if (els.play.lastChild.textContent !== lbl) { els.play.lastChild.textContent = lbl; els.play.setAttribute('aria-label', lbl); uiUiDirty = true; }
  const pressed = String(!!uiPlayS);
  if (els.play.getAttribute('aria-pressed') !== pressed) els.play.setAttribute('aria-pressed', pressed);
  const icon = uiPlayS ? '<path d="M7 6h3v12H7zM14 6h3v12h-3z"/>' : (v >= 0.999 ? '<path d="M16 5L5 12l11 7z"/>' : '<path d="M8 5l11 7-11 7z"/>');
  if (els.play._icon !== icon) { els.play._icon = icon; els.play.firstChild.innerHTML = icon; }
}
els.explode.addEventListener('input', () => {
  if (!uiDrag) { uiDrag = true; uiStopPlay(); uiStopTour(); hideHint(); uiPush(); uiSetDim(null); applyMats(); }
  const w = uiWorking(), L = uiLevels(w).length;
  uiApplyX(w, (els.explode.value / 1000) * L, true);
  CTX = w; uiLabelForce = false; clearPreset();
  uiSyncExplode(true); requestRender();
});
els.explode.addEventListener('change', () => { uiDrag = false; updateGround(); uiAfterAction(); });
function uiSetExplodeValue(v) {
  uiStopPlay(); uiPush(); uiSetDim(null);
  const w = uiWorking();
  uiApplyX(w, clamp(v, 0, 1) * uiLevels(w).length, false);
  CTX = w; uiLabelForce = false; clearPreset(); updateGround();
  uiAfterAction();
}
function uiPlay() {
  if (uiPlayS) { uiStopPlay(); return; }
  uiStopTour(); uiPush(); uiSetDim(null);
  const w = uiWorking(), L = uiLevels(w).length, x0 = uiExplodeX(w);
  const up = x0 / L < 0.999, x1 = up ? L : 0;
  uiPlayS = { w, x: x0, x1, v: (up ? 1 : -1) / 0.8 };
  CTX = w; uiLabelForce = false; clearPreset();
  // camera naar de eindstand
  const saved = []; uiLevels(w).forEach((lv, r) => lv.forEach(a => { saved.push([a, a.target]); a.target = clamp(x1 - r, 0, 1); }));
  try { focusNodes([w], null, 1.05, { dur: Math.min(2.5, Math.abs(x1 - x0) * 0.8) }); } finally { saved.forEach(([a, t]) => { a.target = t; }); }
  if (REDUCED) finishAll();
  uiAfterAction();
}
function uiStepPlay(dt) {
  const s = uiPlayS; if (!s) return false;
  s.x += s.v * dt;
  const done = s.v > 0 ? s.x >= s.x1 : s.x <= s.x1;
  if (done) s.x = s.x1;
  uiApplyX(s.w, s.x, true);
  if (done) { uiPlayS = null; updateGround(); uiAfterAction(); } else uiSyncExplode();
  return true;
}
function uiStopPlay() { if (!uiPlayS) return; uiPlayS = null; updateGround(); uiAfterAction(); }
els.play.onclick = uiPlay;
els.undo.onclick = () => { uiStopPlay(); uiStopTour(); uiUndo(); };
function uiSyncUndo() { els.undo.disabled = !uiHist.length; }

/* ---------- presets: categorieknoppen en menu ---------- */
let uiMenuCat = null, uiMenuBtn = null;
function uiBuildCats() {
  els.presets.innerHTML = '';
  for (const cat of appCats) {
    const list = PRESETS.filter(p => p.cat === cat && appPresetOk(p));
    if (!list.length) continue;
    const b = document.createElement('button');
    b.className = 'cat'; b.dataset.cat = cat; b.setAttribute('aria-haspopup', 'menu'); b.setAttribute('aria-expanded', 'false');
    b.tabIndex = els.presets.children.length ? -1 : 0; // U6: één tabstop voor de werkbalk, pijlen lopen erdoorheen
    b.innerHTML = `<b>${esc(cat)}</b><small></small>`;
    b.onclick = () => (uiMenuCat === cat ? uiCloseMenu(true) : uiOpenMenu(cat, b));
    b.addEventListener('keydown', e => { if (e.key === 'ArrowUp' || e.key === 'ArrowDown') { e.preventDefault(); uiOpenMenu(cat, b); } });
    b.addEventListener('focus', () => uiCatTabStop(b));
    els.presets.appendChild(b);
  }
  uiSyncCats();
}
function uiCatTabStop(b) { for (const c of els.presets.children) c.tabIndex = c === b ? 0 : -1; }
// pijlen links en rechts, Home en End in de werkbalk met presetcategorieën (role="toolbar")
els.presets.addEventListener('keydown', e => {
  if (!/^(ArrowLeft|ArrowRight|Home|End)$/.test(e.key)) return;
  const cats = [...els.presets.children], i = cats.indexOf(document.activeElement);
  if (i < 0 || !cats.length) return;
  const j = e.key === 'Home' ? 0 : e.key === 'End' ? cats.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : cats.length - 1)) % cats.length;
  e.preventDefault(); uiCatTabStop(cats[j]); cats[j].focus();
});
let uiCatSeen = null;
function uiSyncCats() {
  const p = ACTIVE_PRESET && appPresetById.get(ACTIVE_PRESET);
  let textChanged = false;
  for (const b of els.presets.children) {
    const cat = b.dataset.cat, n = PRESETS.filter(q => q.cat === cat && appPresetOk(q)).length;
    const on = !!p && p.cat === cat;
    b.classList.toggle('on', on);
    const txt = cat === 'Overzicht' && appTour ? TXT.tourLoopt : (on ? p.label : TXT.presetsAantal(n));
    if (b.lastChild.textContent !== txt) { b.lastChild.textContent = txt; uiUiDirty = true; textChanged = true; }
    b.setAttribute('aria-label', TXT.catAria(cat, on ? p.label : ''));
  }
  // De naam van de actieve preset kan de presetbalk laten omslaan naar een tweede rij en zo het vrije beeld verkleinen.
  // Direct opnieuw meten: layoutView ziet dan de nieuwe hoogte en laat de camera opnieuw inpassen (G1), nog voor de
  // ResizeObserver van het dock aan de beurt is.
  if (textChanged && uiReady) layoutView();
  // In een zijwaarts schuivende rij (telefoon) schuift een nieuwe actieve categorie in beeld; handmatig schuiven blijft ongemoeid
  const act = p ? p.cat : null;
  if (act !== uiCatSeen) {
    uiCatSeen = act;
    const on = act && els.presets.querySelector('.cat.on'), row = els.presets;
    if (on && row.scrollWidth > row.clientWidth + 1) {
      const rr = row.getBoundingClientRect(), br = on.getBoundingClientRect();
      if (br.left < rr.left + 16) row.scrollLeft += br.left - rr.left - 16;
      else if (br.right > rr.right - 24) row.scrollLeft += br.right - rr.right + 24;
    }
  }
}
function uiMenuItems() { return [...els.menu.querySelectorAll('.mi')]; }
function uiOpenMenu(cat, btn) {
  uiCloseMenu(false);
  uiMenuCat = cat; uiMenuBtn = btn;
  const m = els.menu;
  m.innerHTML = '';
  // U6: de kop met de sluitknop staat buiten het element met role="menu"; dat bevat alleen menuitems
  const head = document.createElement('div'); head.className = 'mhead';
  head.innerHTML = `<span>${esc(cat)}</span>`;
  const close = document.createElement('button'); close.className = 'mclose'; close.setAttribute('aria-label', TXT.menuSluiten); close.textContent = '×'; close.onclick = () => uiCloseMenu(true);
  head.appendChild(close); m.appendChild(head);
  const list = document.createElement('div'); list.setAttribute('role', 'menu'); list.setAttribute('aria-label', TXT.menuAria(cat)); m.appendChild(list);
  for (const p of PRESETS.filter(q => q.cat === cat && appPresetOk(q))) {
    const b = document.createElement('button');
    b.className = 'mi'; b.setAttribute('role', 'menuitem'); b.dataset.preset = p.id; b.tabIndex = -1;
    const label = p.tour && appTour ? TXT.tourStoppen : p.label;
    b.innerHTML = `<span class="mi-t">${esc(label)}${p.key ? `<kbd>${p.key}</kbd>` : ''}</span><span class="mi-n">${esc(p.note)}</span>`;
    if (p.id === ACTIVE_PRESET) b.setAttribute('aria-current', 'true');
    b.onclick = () => { uiCloseMenu(false); uiRunPreset(p.id); };
    list.appendChild(b);
  }
  m.hidden = false;
  btn.setAttribute('aria-expanded', 'true');
  uiPlaceMenu();
  const items = uiMenuItems();
  const cur = items.find(i => i.getAttribute('aria-current') === 'true') || items[0];
  if (cur) cur.focus({ preventScroll: true });
  uiUiChanged();
}
function uiPlaceMenu() {
  const m = els.menu, btn = uiMenuBtn;
  if (!btn || m.hidden) return;
  if (window.innerWidth <= CFG.indeling.smal) { m.style.left = ''; m.style.top = ''; m.style.bottom = ''; m.style.maxHeight = ''; return; }
  const r = btn.getBoundingClientRect();
  const w = m.offsetWidth;
  m.style.left = clamp(r.left, 8, window.innerWidth - w - 8) + 'px';
  m.style.top = 'auto';
  m.style.bottom = (window.innerHeight - r.top + 8) + 'px';
  m.style.maxHeight = Math.max(160, r.top - 16) + 'px';
}
function uiCloseMenu(focusBack) {
  if (!uiMenuCat) return;
  els.menu.hidden = true; els.menu.innerHTML = '';
  if (uiMenuBtn) { uiMenuBtn.setAttribute('aria-expanded', 'false'); if (focusBack) uiMenuBtn.focus({ preventScroll: true }); }
  uiMenuCat = null; uiMenuBtn = null;
  uiUiChanged();
}
function uiMenuKey(e) {
  const items = uiMenuItems(); if (!items.length) return false;
  const i = items.indexOf(document.activeElement);
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); const j = i < 0 ? 0 : (i + (e.key === 'ArrowDown' ? 1 : items.length - 1)) % items.length; items[j].focus(); return true; }
  if (e.key === 'Home' || e.key === 'End') { e.preventDefault(); items[e.key === 'Home' ? 0 : items.length - 1].focus(); return true; }
  if (e.key === 'Escape') { e.preventDefault(); uiCloseMenu(true); return true; }
  if (e.key === 'Tab') { uiCloseMenu(false); return false; }
  if (e.key === 'Enter' || e.key === ' ') { if (i >= 0) { e.preventDefault(); items[i].click(); } return true; }
  return false;
}
document.addEventListener('pointerdown', e => {
  const t = e.target;
  if (uiMenuCat && !els.menu.contains(t) && !(uiMenuBtn && uiMenuBtn.contains(t))) uiCloseMenu(false);
  if (!(t.closest && t.closest('#play'))) uiStopPlay();
  if (!(t.closest && t.closest('#tourBar, #menu, [data-cat="Overzicht"], #help, #helpDlg'))) uiStopTour();
  hideHint();
}, true);
function uiRunPreset(id) {
  const p = appPresetById.get(id); if (!p) return false;
  hideHint(); uiCloseMenu(false);
  if (p.tour) { appTour ? uiStopTour() : uiStartTour(); return true; }
  return appApplyPreset(p);
}
function uiTourCaption(p, i, n) {
  if (!p) { els.tourBar.hidden = true; if (uiNarrow()) layoutView(); uiUiChanged(); return; }
  els.tourText.innerHTML = `<b>${TXT.tourKop(i + 1, n, esc(p.label))}</b>${esc(p.note)}`;
  els.tourBar.hidden = false;
  if (uiNarrow()) layoutView();
  uiUiChanged();
}
// R4: de knoppen in de rondleidingsbalk volgen de stand (pauze of hervat, vorige uit bij de eerste stap)
function uiSyncTour() {
  uiSyncCats();
  const t = appTour, paused = !!(t && t.paused), pb = $('tourPause');
  pb.setAttribute('aria-pressed', String(paused));
  pb.setAttribute('aria-label', paused ? TXT.hervatten : TXT.pauze); pb.title = paused ? TXT.tourHervatten : TXT.tourPauzeren;
  pb.firstElementChild.innerHTML = paused ? '<path d="M8 5l11 7-11 7z"/>' : '<path d="M7 5h4v14H7zM13 5h4v14h-4z"/>';
  $('tourPrev').disabled = !t || t.i <= 0;
  $('tourNext').disabled = !t;
}
els.tourStop.onclick = () => uiStopTour();
$('tourPause').onclick = () => uiTourPause(!(appTour && appTour.paused));
$('tourPrev').onclick = () => uiTourStep(-1);
$('tourNext').onclick = () => uiTourStep(1);
// een verborgen tabblad zet de rondleiding stil; komt het terug, dan loopt hij verder (een eigen pauze blijft staan)
document.addEventListener('visibilitychange', () => {
  if (!appTour) return;
  if (document.hidden) { if (!appTour.paused) { uiTourPause(true); appTour.auto = true; } }
  else if (appTour.auto) { appTour.auto = false; uiTourPause(false); }
});
