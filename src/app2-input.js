/* ===================== bediening (4/5): aanwijzen en tikken, hint en hulp, toetsenbord ===================== */

/* ---------- aanwijzen en tikken ---------- */
const ray = new THREE.Raycaster(), ndc = new THREE.Vector2();
ray.layers.enableAll(); // samengevoegd getekende onderdelen staan op laag 1 en blijven aanwijsbaar
let uiPickXray = [], uiPickXrayKey = -1;
function uiPickList() {
  if (!XRAY) return uiPickable;
  if (uiPickXrayKey !== uiPickVer) { uiPickXray = uiPickable.filter(m => !m.userData.node.isBody); uiPickXrayKey = uiPickVer; }
  return uiPickXray;
}
// hover: aanwijzen met de muis. Golf 5c-2, P3: renderer.render werkt de wereldmatrices van de hele scène bij; staat er
// sindsdien niets te tekenen (needs) en beweegt er niets (uiWasActive), dan zijn ze nog geldig en blijft de volledige
// updateMatrixWorld over 2.400 meshes achterwege. Tikken, klikken en de testhaken rekenen altijd alles opnieuw.
function pick(cx, cy, loose, hover) {
  const r = canvas.getBoundingClientRect();
  ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  camera.updateMatrixWorld();
  if (!hover || needs || uiWasActive) ROOT.obj.updateMatrixWorld();
  ray.setFromCamera(ndc, camera);
  const list = uiPickList();
  const hits = ray.intersectObjects(list, false);
  // U19: een gedimd deel voor de focus slaat de klik over; raakt de straal niets in de focus, dan telt het gedimde deel
  let hit = hits[0];
  if (hit && uiDimSet && uiDimmed(hit.object)) { const f = hits.find(h => !uiDimmed(h.object)); if (f) hit = f; }
  if (hit) return hit.object.userData.node;
  if (!loose) return null;
  // vinger naast een klein onderdeel: het dichtstbijzijnde onderdeel binnen CFG.gebaar.naastPx
  let best = null, bd = CFG.gebaar.naastPx * CFG.gebaar.naastPx;
  for (const m of list) {
    const n = m.userData.node;
    uiToScreen(uiPv.copy(n.lc).applyMatrix4(m.matrixWorld), r.width, r.height);
    if (uiPv.z > 1) continue;
    const dx = uiPv.x + r.left - cx, dy = uiPv.y + r.top - cy, d = dx * dx + dy * dy;
    if (d < bd) { bd = d; best = n; }
  }
  return best;
}
// Wat een klik in de huidige modus zou raken.
function uiActTarget(p) { return p ? uiMode().target(p) : null; }
function uiShowTip(html, x, y) {
  const tip = els.tip;
  if (tip._h !== html) { tip.innerHTML = html.replace(/<(?!\/?i>)/g, '&lt;'); tip._h = html; }
  tip.hidden = false;
  const w = tip.offsetWidth, h = tip.offsetHeight;
  let tx = x + 14, ty = y + 16;
  if (tx + w > window.innerWidth - 8) tx = Math.max(8, x - w - 12);
  if (ty + h > window.innerHeight - 8) ty = y - h - 12;
  tip.style.transform = `translate(${Math.round(tx)}px, ${Math.round(ty)}px)`;
}
function uiHideTip() { els.tip.hidden = true; if (uiSetHover(null)) requestRender(); canvas.style.cursor = ''; }
let uiHoverPos = null, uiHoverT = 0, uiHoverTimer = 0;
function uiDoHover() {
  uiHoverTimer = 0;
  if (!uiHoverPos) return;
  uiHoverT = performance.now();
  const p = pick(uiHoverPos.x, uiHoverPos.y, false, true);
  if (!p) { uiHideTip(); return; }
  const m = uiMode(), t = m.target(p);
  if (uiSetHover(t)) requestRender();
  uiShowTip(m.tip(p, t), uiHoverPos.x, uiHoverPos.y);
  canvas.style.cursor = m.cursor(p) ? 'pointer' : '';
}
function uiHoverTarget(x, y) { const p = pick(x, y); const t = uiActTarget(p); return t ? t.name : null; }

const uiPtrs = new Map();
let down = null, uiLastTap = null, uiPressS = null;
function uiCancelPress() {
  if (!uiPressS) return;
  clearTimeout(uiPressS.show); clearTimeout(uiPressS.fire); clearTimeout(uiPressS.zero); cancelAnimationFrame(uiPressS.raf);
  els.press.hidden = true; els.press.classList.remove('run');
  uiPressS = null;
}
// Lang drukken, tikken en dubbeltikken worden beslist op de tijdstempels van het gebaar zelf (event.timeStamp),
// niet op het moment waarop een handler toevallig draait. De timer toont de ring en wapent het lang drukken;
// vóór het doorvoeren laat hij wachtende invoer eerst afhandelen (een animatieframe en daarna een nul-timeout).
// Komt er in die tijd een pointerup of pointercancel binnen, dan beslist die (op zijn eigen tijdstempel).
function uiCommitPress(d, fromUp) {
  if (d.consumed || (d.ended && !fromUp)) return;
  d.consumed = true;
  if (uiPressS && uiPressS.d === d) uiCancelPress();
  try { navigator.vibrate && navigator.vibrate(CFG.gebaar.trilMs); } catch (_) { } // U8: de ring is vol (alleen waar vibrate bestaat)
  if (d.pick) uiCollapseAt(d.pick);
}
function uiStartPress(d) {
  uiCancelPress();
  const s = uiPressS = { d, raf: 0, zero: 0 };
  s.show = setTimeout(() => { els.press.style.transform = `translate(${d.x}px, ${d.y}px)`; els.press.hidden = false; void els.press.offsetWidth; els.press.classList.add('run'); }, CFG.gebaar.ringMs);
  // gewapend: eerst wachtende invoer laten afhandelen, dan pas doorvoeren als de vinger er nog ligt. Kwam een timer
  // te laat (de hoofddraad was bezig, er kan invoer in de rij staan), dan opnieuw kijken tot de draad weer vrij is.
  s.tries = 0;
  const later = (ms, fn) => { const due = performance.now() + ms; s.fire = setTimeout(() => fn(performance.now() - due), ms); };
  const check = lag => {
    if (uiPressS !== s || d.ended) return;
    if (lag > 40 && s.tries++ < 40) { later(30, check); return; }
    s.raf = requestAnimationFrame(() => later(0, lag2 => {
      if (uiPressS !== s || d.ended) return;
      if (lag2 > 40 && s.tries++ < 40) { later(30, check); return; }
      uiCommitPress(d);
    }));
  };
  later(CFG.gebaar.drukMs, check);
}
canvas.addEventListener('pointerdown', e => {
  for (const l of labelPool) l._pd = false; // elk gebaar begint schoon: geen label houdt een oude druk vast
  uiPtrs.set(e.pointerId, e.pointerType);
  try { canvas.focus({ preventScroll: true }); } catch (_) { }
  uiHideTip();
  if (uiPtrs.size === 1) {
    down = { id: e.pointerId, x: e.clientX, y: e.clientY, t: e.timeStamp, type: e.pointerType, button: e.button, shift: e.shiftKey, consumed: false, ended: false };
    down.pick = pick(e.clientX, e.clientY, e.pointerType !== 'mouse'); // de pick van deze tik, ook voor een dubbeltik
    if (e.pointerType !== 'mouse' && e.button === 0) uiStartPress(down);
  } else { if (down) down.ended = true; down = null; uiCancelPress(); }
});
canvas.addEventListener('pointermove', e => {
  if (down && down.id === e.pointerId && Math.hypot(e.clientX - down.x, e.clientY - down.y) >= CFG.gebaar.sleepPx) uiCancelPress();
  if (e.pointerType !== 'mouse' || e.buttons) { if (!els.tip.hidden) uiHideTip(); return; }
  uiHoverPos = { x: e.clientX, y: e.clientY };
  const wait = CFG.gebaar.aanwijsMs - (performance.now() - uiHoverT);
  if (wait <= 0) uiDoHover(); else if (!uiHoverTimer) uiHoverTimer = setTimeout(uiDoHover, wait);
});
canvas.addEventListener('pointerleave', () => { uiHoverPos = null; clearTimeout(uiHoverTimer); uiHoverTimer = 0; uiHideTip(); });
canvas.addEventListener('pointerup', e => {
  uiPtrs.delete(e.pointerId);
  if (!down || down.id !== e.pointerId) return;
  const d = down; down = null;
  d.ended = true;
  uiCancelPress();
  if (d.consumed) return;
  const moved = Math.hypot(e.clientX - d.x, e.clientY - d.y), dt = e.timeStamp - d.t;
  if (moved >= CFG.gebaar.sleepPx) return; // slepen is nooit een klik
  // lang drukken op touch: beslist door de duur van het gebaar zelf, ook als de timer nog niet aan de beurt was
  if (d.type !== 'mouse' && d.button === 0 && dt >= CFG.gebaar.drukMs) { uiCommitPress(d, true); return; }
  if (dt >= CFG.gebaar.tikMaxMs) return;
  if (d.button === 2) { if (d.type === 'mouse') { d.pick ? uiCollapseAt(d.pick) : uiBackground(); } return; }
  if (d.button !== 0) return;
  const now = e.timeStamp, L = uiLastTap;
  if (L && now - L.t < CFG.gebaar.dubbelMs && now - L.t >= 0 && Math.hypot(e.clientX - L.x, e.clientY - L.y) < CFG.gebaar.dubbelPx && L.type === d.type) {
    uiLastTap = null;
    if (!uiMode().dubbel) return; // in Openen is dubbelklik gelijk aan een enkele klik
    if (L.pick) uiDive(L.pick); // altijd het onderdeel van de eerste tik
    return;
  }
  uiLastTap = { t: now, x: e.clientX, y: e.clientY, pick: d.pick, type: d.type };
  if (d.shift) { d.pick ? uiCollapseAt(d.pick) : uiBackground(); return; }
  uiAct(d.pick);
});
const uiPtrReset = () => { uiPtrs.clear(); if (down) down.ended = true; down = null; uiCancelPress(); };
canvas.addEventListener('pointercancel', e => { uiPtrs.delete(e.pointerId); if (down && down.id === e.pointerId) { down.ended = true; down = null; } uiCancelPress(); });
canvas.addEventListener('lostpointercapture', e => { if (uiPtrs.has(e.pointerId) && down && down.id === e.pointerId && down.type !== 'mouse') uiPtrs.delete(e.pointerId); });
window.addEventListener('blur', uiPtrReset);
document.addEventListener('visibilitychange', () => { if (document.hidden) uiPtrReset(); });
canvas.addEventListener('contextmenu', e => e.preventDefault()); // rechtsklik zelf wordt in pointerup afgehandeld (niet na slepen)
// Een tik op het canvas is in pointerup al volledig afgehandeld. De browser stuurt daarna nog muis-compatibiliteits-
// gebeurtenissen en een click, die op het element vallen dat er op dat moment ligt: na het selecteren staat daar vaak
// een net verschoven label, dat dan een tweede actie uitvoert (bewezen in de itest: tik op Binnenframe motorkap,
// click op label Koplampsproeiers). touchend afvangen onderdrukt die nagekomen click.
canvas.addEventListener('touchend', e => { if (e.cancelable) e.preventDefault(); }, { passive: false });
canvas.addEventListener('wheel', () => { uiStopPlay(); uiStopTour(); hideHint(); uiHideTip(); }, { passive: true });

/* ---------- hint en hulp ---------- */
const uiHintKey = AUTO.id + '-hint-' + AUTO.hintVersie;
let uiHintStage = 0; // 0 geen, 1 de uitleg, 2 de suggestie (U8); elke handeling sluit hem voorgoed
function uiInitHint() {
  let seen = false;
  try { seen = window.localStorage.getItem(uiHintKey) === '1'; } catch (_) { seen = false; }
  if (seen) { els.hint.hidden = true; return; }
  uiHintStage = 1;
  els.hint.textContent = uiTouch ? TXT.hintTik : TXT.hintKlik;
  setTimeout(uiHintNext, CFG.tijd.hintMs);
}
// U8: na de uitleg één concrete suggestie, tot de eerste klik of tik (daarna nooit meer: de hint telt als gezien)
function uiHintNext() {
  if (uiHintStage !== 1 || els.hint.hidden || els.hint.classList.contains('gone')) return;
  uiHintStage = 2;
  els.hint.textContent = uiTouch ? TXT.probeerTik : TXT.probeerKlik;
  uiUiChanged();
}
function hideHint(instant) {
  if (instant === true && !els.hint.hidden) { uiHintStage = 0; els.hint.hidden = true; els.hint.classList.add('gone'); try { window.localStorage.setItem(uiHintKey, '1'); } catch (_) { } uiUiChanged(); return; }
  if (els.hint.hidden || els.hint.classList.contains('gone')) return;
  uiHintStage = 0;
  els.hint.classList.add('gone');
  try { window.localStorage.setItem(uiHintKey, '1'); } catch (_) { }
  setTimeout(() => { els.hint.hidden = true; uiUiChanged(); uiSyncLabels(); }, REDUCED ? 0 : 450);
}
// U7: het hulpvenster leest de categorieën en sneltoetsen uit appCats en PRESETS (niet met de hand bijhouden)
function uiFillHelp() {
  const keyed = PRESETS.filter(p => p.key && appPresetOk(p)).sort((a, b) => a.key.localeCompare(b.key));
  $('helpCats').textContent = TXT.hulpCats(appCats);
  $('helpKeysT').innerHTML = keyed.length ? TXT.hulpToetsen(esc(keyed[0].key), esc(keyed[keyed.length - 1].key)) : '';
  $('helpKeys').textContent = keyed.map(p => p.label).join(', ') + '.';
}
// U6: zolang het hulpvenster open is, is de rest van de pagina inert (waar de browser dat kent) en blijft Tab in het venster
function uiHelpInert(on) {
  if (!('inert' in HTMLElement.prototype)) return;
  for (const el of els.helpDlg.parentElement.children) if (el !== els.helpDlg) el.inert = on;
}
function uiHelpFocusables() { return [...els.helpDlg.querySelectorAll('button, a[href], input, [tabindex]:not([tabindex="-1"])')].filter(e => !e.disabled && e.offsetParent !== null); }
function uiHelp(open) {
  els.helpDlg.hidden = !open;
  uiHelpInert(open);
  if (open) {
    uiFillHelp();
    const m = $('helpMouse'), t = $('helpTouch');
    if (uiTouch) m.before(t); else t.before(m);
    $('helpClose').focus({ preventScroll: true });
    els.helpDlg.firstElementChild.scrollTop = 0;
  } else els.help.focus({ preventScroll: true });
  uiUiChanged();
}
els.help.onclick = () => uiHelp(true);
$('helpClose').onclick = () => uiHelp(false);
els.helpDlg.addEventListener('click', e => { if (e.target === els.helpDlg) uiHelp(false); });

/* ---------- toetsenbord (werkt zodra de pagina de focus heeft; het canvas krijgt die bij de eerste aanraking) ---------- */
function uiEnter(shift) { uiMode().enter(SEL || ROOT, shift); }
if (!uiTouch) els.search.placeholder += TXT.zoekToets;
window.addEventListener('keydown', e => {
  const t = e.target;
  if (!els.helpDlg.hidden) {
    if (e.key === 'Escape') { e.preventDefault(); uiHelp(false); return; }
    if (e.key === 'Tab') { // focusval: Tab en Shift+Tab lopen rond binnen het venster
      const f = uiHelpFocusables(); if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && (i <= 0)) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && (i < 0 || i >= f.length - 1)) { e.preventDefault(); f[0].focus(); }
    }
    return;
  }
  if (uiMenuCat && uiMenuKey(e)) return;
  const typing = t && ((t.tagName === 'INPUT' && !/^(range|checkbox|radio|button)$/.test(t.type)) || t.tagName === 'TEXTAREA' || t.isContentEditable);
  if (typing) { if (e.key === 'Escape') t.blur(); return; }
  if (e.ctrlKey || e.metaKey || e.altKey) return;
  const onCtl = !!(t && t.closest && t.closest('button, a, input, select, summary'));
  // U6: Esc sluit eerst het mobiele paneel (de lade), daarna pas de rest
  if (e.key === 'Escape' && uiSheetBottom() && els.sheet.dataset.state === 'open') { e.preventDefault(); setSheet('peek'); return; }
  if (e.key === 'Escape') { uiStopPlay(); uiStopTour(); hideHint(); uiBackground(); return; }
  if (e.key === 'Enter') { if (onCtl) return; e.preventDefault(); uiStopPlay(); uiStopTour(); hideHint(); uiEnter(e.shiftKey); return; }
  if (e.key === 'Backspace') { e.preventDefault(); uiStopPlay(); uiStopTour(); uiUndo(); return; }
  if (e.key === '?') { e.preventDefault(); uiHelp(true); return; }
  if (e.key === 'o' || e.key === 'O') { e.preventDefault(); hideHint(); uiSetOpenMode(!OPENMODE); return; }
  // U17: / springt naar het zoekveld van de onderdelenlijst (op de telefoon gaat het paneel daarvoor open)
  if (e.key === '/') { e.preventDefault(); hideHint(); showTab('tree'); if (uiSheetBottom()) setSheet('open'); els.search.focus(); els.search.select(); return; }
  // pijltjes (niet op een bedieningselement): door de boom lopen. Omhoog = bovenliggende groep, omlaag = eerste deel,
  // links/rechts = vorige/volgende op hetzelfde niveau (audit U29). Selecteren en in beeld houden, niets uitklappen.
  if (!onCtl && /^Arrow(Up|Down|Left|Right)$/.test(e.key)) {
    const n = SEL || ROOT, sib = n.parent ? n.parent.kids : [n];
    let m = null;
    if (e.key === 'ArrowUp') m = n.parent && (!ISO.length || uiInScope(n.parent)) ? n.parent : null;
    else if (e.key === 'ArrowDown') m = n.asm ? n.kids.find(k => k.ev) : null;
    else { const i = sib.indexOf(n), d = e.key === 'ArrowRight' ? 1 : -1; for (let j = 1; j < sib.length && !m; j++) { const k = sib[(i + d * j + sib.length * j) % sib.length]; if (k.ev) m = k; } }
    if (m && m !== n) { e.preventDefault(); uiStopPlay(); uiStopTour(); hideHint(); uiPush(); select(m); uiSoftFrame([m]); uiAfterAction(); }
    return;
  }
  if (/^[0-9]$/.test(e.key)) {
    const p = PRESETS.find(q => q.key === e.key);
    if (p && appPresetOk(p)) { e.preventDefault(); uiStopPlay(); uiStopTour(); uiRunPreset(p.id); }
  }
});
