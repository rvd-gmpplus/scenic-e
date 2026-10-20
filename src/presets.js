/* ===================== presets: de toepassingsmotor (de gegevens per auto staan in presetdata.js) ===================== */
// Elke preset is alleen gegevens. Velden:
//   id, cat (categorie), label, key (sneltoets), note (wat je ziet, één regel),
//   iso: [ankers] alleen deze tonen, open: [groepen] precies deze uitklappen, deep: [groepen] met hun hele deelboom,
//   pull: { naam: [dx,dy,dz] } hele groep verschuiven (in het frame van de ouder), xray, sys (kleuren per systeem),
//   spread (standaard 1), cam: { dir: [x,y,z], pad }, select: naam, labels: naam (van welke groep de kinderen een label krijgen),
//   labelOnly: [namen] alleen deze kinderen van de labelgroep krijgen een label,
//   frame: [namen] wat in beeld moet (standaard iso, anders de hele auto),
//   opens: [openers] of 'all': de modus Openen met precies deze openers open (pad of unieke naam; een volger telt als zijn
//   leider). Zonder frame is het kader de open.look.nodes van de eerste opener, met zijn look.dir als richting. Alle andere
//   presets zetten de modus terug op Uitklappen en sluiten de openers (de modusknop niet: die laat ze staan).
// Alleen ankernamen uit contract §8 / tools/anchors.json. Een preset waarvan een naam niet oplost, verschijnt niet in de menu's.
const appPresetById = new Map(PRESETS.map(p => [p.id, p]));

function appPresetNames(p) {
  return [...(p.iso || []), ...(p.open || []), ...(p.deep || []), ...Object.keys(p.pull || {}), ...(p.select ? [p.select] : []), ...(p.labels ? [p.labels] : []), ...(p.frame || [])];
}
// verwijzing naar een opener (pad of unieke naam) zonder consolefout; geeft de leider van de opener, anders null
function appOpenRef(ref) {
  const n = uiResolve(ref);
  return n && n.opn ? (n.opn.lead || n) : null;
}
function appPresetErrors(p) {
  const err = [];
  if (p.opens && p.opens !== 'all') for (const ref of p.opens) if (!appOpenRef(ref)) err.push(`preset "${p.label}": opener "${ref}" bestaat niet of is geen opener`);
  for (const name of new Set(appPresetNames(p))) {
    const c = uiNameCount.get(name) || 0;
    if (c === 0) err.push(`preset "${p.label}": naam "${name}" bestaat niet`);
    else if (c > 1) err.push(`preset "${p.label}": naam "${name}" komt ${c}x voor`);
  }
  if (err.length) return err;
  const iso = (p.iso || []).map(byName);
  const scope = iso.length ? iso : [ROOT];
  for (const name of [...(p.open || []), ...(p.deep || []), ...(p.select ? [p.select] : []), ...(p.labels ? [p.labels] : [])]) {
    const n = byName(name);
    if (!scope.some(r => isUnder(n, r))) err.push(`preset "${p.label}": "${name}" ligt niet onder ${iso.length ? (p.iso || []).join(' of ') : 'de auto'}`);
  }
  // labelOnly: namen van kinderen van de labelgroep (niet uniek in de boom); een typefout verbergt anders stil labels
  if (p.labelOnly && p.labels) {
    const kids = byName(p.labels).kids.map(k => k.name);
    for (const name of p.labelOnly) if (!kids.includes(name)) err.push(`preset "${p.label}": labelOnly "${name}" is geen kind van "${p.labels}"`);
  }
  return err;
}
function appCheckPresets() {
  const err = [], ids = new Set(), keys = new Set();
  for (const p of PRESETS) {
    if (ids.has(p.id)) err.push(`preset-id "${p.id}" komt twee keer voor`); ids.add(p.id);
    if (p.key) { if (keys.has(p.key)) err.push(`sneltoets ${p.key} komt twee keer voor`); keys.add(p.key); }
    if (!appCats.includes(p.cat)) err.push(`preset "${p.label}": onbekende categorie ${p.cat}`);
    err.push(...appPresetErrors(p));
  }
  for (const id of appTourSteps) if (!appPresetById.has(id)) err.push(`rondleiding: preset "${id}" bestaat niet`);
  return err;
}
const appPresetOk = p => p.tour || appPresetErrors(p).length === 0;
function appSubject(p) {
  if (p.opens && p.opens !== 'all' && !p.frame) { // het kader van de eerste opener (open.look.nodes), anders de opener zelf
    const l = appOpenRef(p.opens[0]), lk = l && l.opn.look, out = [];
    for (const r of lk && lk.nodes ? lk.nodes : [l]) { const m = typeof r === 'string' ? uiResolve(r) : r; if (m && !out.includes(m)) out.push(m); }
    if (out.length) return out;
  }
  const names = p.frame || (p.iso && p.iso.length ? p.iso : [appCar]);
  return names.map(byName).filter(Boolean);
}
// camerarichting van een preset: cam.dir, anders de look.dir van zijn eerste opener, anders het ¾-aanzicht
function appPresetDir(p) {
  if (p.cam && p.cam.dir) return V3(...p.cam.dir);
  const l = p.opens && p.opens !== 'all' ? appOpenRef(p.opens[0]) : null, d = l && l.opn.look && l.opn.look.dir;
  return d ? V3(...d) : DIRS.iso;
}
// openers die een preset open wil hebben (leiders)
function appWantOpen(p) {
  const out = new Set();
  if (p.opens === 'all') OPENERS.forEach(n => out.add(n));
  else for (const r of p.opens || []) { const l = appOpenRef(r); if (l) out.add(l); }
  return out;
}

/* ---------- toepassen in fasen: (1) dicht wat dicht moet (diepste eerst), (2) camera naar de eindkadrering
   terwijl (3) open gaat wat open moet (ondiepste eerst). Alles samen hoogstens 2,5 s. ---------- */
function appApplyPreset(p, opt = {}) {
  if (!p || p.tour || !appPresetOk(p)) return false;
  uiStopPlay();
  if (!opt.tour) uiStopTour();
  if (!opt.noHistory) uiPush();
  uiSetDim(null); // U19: een preset begint zonder gedimde rest
  // modus en openers: alleen een preset met opens zet Openen aan; elke andere zet Uitklappen terug en sluit de openers
  // (behalve met keepOpen, de wissel met de modusknop)
  OPENMODE = opt.openMode != null ? opt.openMode : !!p.opens;
  const wantOpen = appWantOpen(p);
  if (!opt.keepOpen) for (const n of OPENERS) if (!wantOpen.has(n)) uiSetOpen(n, 0);   // eerst sluiten (needs sluit mee), dan openen; keepOpen: de modusknop laat ze staan
  for (const n of wantOpen) uiSetOpen(n, 1);
  const want = new Set();
  for (const name of p.open || []) want.add(byName(name));
  for (const name of p.deep || []) subtree(byName(name)).forEach(a => { if (a.asm) want.add(a); });
  // isolatie en weergave (U4: wat door de isolatie uit beeld gaat, fadet uit; zie uiFadeFrom in app1.js)
  const wasVisible = uiVisibleMeshes();
  ISO = (p.iso || []).map(byName);
  XRAY = !!p.xray; SYSCOL = !!p.sys;
  if (SPREAD !== (p.spread || 1)) uiSetSpread(p.spread || 1, false);
  uiDrop();
  // in de eindstand verborgen groepen (buiten de isolatie en niet op het pad erheen) springen direct dicht
  const onPath = new Set(); for (const r of ISO) for (let a = r; a; a = a.parent) onPath.add(a);
  const shown = a => !ISO.length || onPath.has(a) || uiInScope(a);
  const closing = [], opening = [];
  for (const a of ASMS) {
    const t = want.has(a) ? 1 : 0;
    if (a.target === t && !uiAnim.has(a)) continue;
    if (!shown(a)) { uiSetNow(a, t); continue; }
    (t ? opening : closing).push(a);
  }
  const span = list => list.length ? [Math.min(...list.map(a => a.depth)), Math.max(...list.map(a => a.depth))] : [0, 0];
  const [c0, c1] = span(closing), [o0, o1] = span(opening);
  const cStag = closing.length ? Math.min(0.06, 0.3 / Math.max(1, c1 - c0)) : 0;
  const cDur = 0.45, closeT = closing.length ? cDur + cStag * (c1 - c0) : 0;
  const oDur = 0.7, oStag = opening.length ? Math.min(0.22, Math.max(0.04, (2.35 - closeT - oDur) / Math.max(1, o1 - o0))) : 0;
  closing.forEach(a => setTarget(a, 0, cStag * (c1 - a.depth), cDur));
  opening.forEach(a => setTarget(a, 1, closeT + oStag * (a.depth - o0), oDur));
  // optillen
  const pulls = new Map(Object.entries(p.pull || {}).map(([k, v]) => [byName(k), v]));
  for (const n of ALL) {
    const v = pulls.get(n);
    if (v) { n.pull.set(v[0], v[1], v[2]); uiOffTo(n, 1.0, closeT); }
    else if (n.pull.lengthSq() > 0) { n.pull.set(0, 0, 0); uiOffTo(n, 0.6, 0); }
  }
  applyVisibility(); uiFadeFrom(wasVisible); applyMats();
  uiSyncIso(); // U4: de badge staat in het dock en verandert het vrije beeld; eerst bijwerken, dan pas kadreren
  // selectie, labels en camera
  CTX = p.labels ? byName(p.labels) : (p.select ? byName(p.select) : ((p.open || p.deep || []).length ? byName((p.open || p.deep)[0]) : null));
  uiLabelForce = !!p.labels;
  ACTIVE_PRESET = p.id;
  uiSyncCats(); uiSyncOpenUi(); // G1: de presetnaam en de openmodus veranderen het dock; eerst meten, dan pas kadreren (geen herkadrering midden in de animatie)
  const sel = p.select ? byName(p.select) : (ISO.length === 1 ? ISO[0] : ROOT);
  select(sel);
  const openSpan = opening.length ? oDur + oStag * (o1 - o0) : 0;
  const camDelay = closing.length ? closeT * 0.6 : 0;
  const camDur = clamp(Math.max(0.9, openSpan + closeT - camDelay), 0.9, 2.5 - camDelay);
  const cam = p.cam || {};
  focusNodes(appSubject(p), appPresetDir(p), cam.pad || 1.06, { dur: camDur, delay: camDelay });
  uiLastFit = { preset: p }; // R3: een formaatwissel kadreert opnieuw op het onderwerp van deze preset
  if (REDUCED) finishAll();
  uiAfterAction();
  requestRender();
  return true;
}

/* ---------- rondleiding ---------- */
// R4: de rondleiding kent pauze en hervat (knop, of vanzelf als het tabblad verborgen is), vorige en volgende.
// appTour: { i: huidige stap, timer, due: tijdstip van de volgende stap, left: resttijd bij pauze, paused, auto }
let appTour = null;
function uiStartTour() {
  uiStopPlay();
  uiPush();
  appTour = { i: -1, timer: 0, due: 0, left: 0, paused: false, auto: false };
  uiTourStep(1);
  uiSyncTour();
}
// dir = 1 volgende stap, -1 vorige; een stap waarvan de namen niet (meer) oplossen, wordt in die richting overgeslagen
// (de waarschuwing staat al bij het starten in de console). Voorbij het einde stopt de rondleiding; vóór het begin blijft hij staan.
function uiTourStep(dir) {
  if (!appTour) return;
  dir = dir === -1 ? -1 : 1;
  clearTimeout(appTour.timer);
  let i = appTour.i + dir, p = null;
  for (; i >= 0 && i < appTourSteps.length; i += dir) { const q = appPresetById.get(appTourSteps[i]); if (q && appPresetOk(q)) { p = q; break; } }
  if (!p) { if (dir > 0) uiStopTour(); else uiTourArm(); return; }
  appTour.i = i;
  // eerst het bijschrift: op een telefoon houdt het vrije beeld er rekening mee, zodat de camera de auto eronder inpast
  uiTourCaption(p, i, appTourSteps.length);
  appApplyPreset(p, { tour: true, noHistory: true });
  uiTourArm();
  uiSyncTour();
}
function uiTourArm() {
  if (!appTour || appTour.paused) return;
  const ms = REDUCED ? CFG.tijd.tourStapRustigMs : CFG.tijd.tourStapMs;
  appTour.due = performance.now() + ms;
  appTour.timer = setTimeout(uiTourStep, ms);
}
function uiTourPause(on) {
  if (!appTour || appTour.paused === !!on) return;
  appTour.paused = !!on;
  if (on) { clearTimeout(appTour.timer); appTour.left = Math.max(800, appTour.due - performance.now()); }
  else { appTour.due = performance.now() + appTour.left; appTour.timer = setTimeout(uiTourStep, appTour.left); }
  uiSyncTour();
}
function uiStopTour() {
  if (!appTour) return;
  clearTimeout(appTour.timer);
  appTour = null;
  uiTourCaption(null);
  uiSyncTour();
}
