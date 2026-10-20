/* ===================== bediening (1/5): basis, klikmodi, paneel, onderdeelnummers, boom en tabs ===================== */
// De bediening staat in vijf bestanden (golf 5c-2, K5), in deze volgorde in build.py (ORDER): app2-panel.js (gedeelde
// basis, klikmodi, selectie en paneel, onderdeelnummers, onderdelenboom, tabs), app2-controls.js (handelingen, isoleren,
// openmodus, weergave, explosieschuif, presets en rondleiding), app2-labels.js (labels), app2-input.js (aanwijzen,
// tikken, hint en hulp, toetsenbord) en app2-loop.js (formaat, thema, beeldkwaliteit, render-lus, debug, URL, start en
// testhaak). Het is één script: functies zijn overal bekend; const en let pas vanaf hun regel in die volgorde.
document.documentElement.lang = TXT.taal;
const $ = id => document.getElementById(id);
const els = {
  sheet: $('sheet'), crumbs: $('crumbs'), name: $('selName'), meta: $('selMeta'), desc: $('selDesc'), spec: $('selSpec'), kids: $('selKids'), kidsTitle: $('kidsTitle'),
  toggle: $('actToggle'), open: $('actOpen'), all: $('actAll'), up: $('actUp'), dive: $('actDive'), dim: $('actDim'), iso: $('actIsolate'), focus: $('actFocus'),
  tree: $('tree'), search: $('treeSearch'), treeInfo: $('treeInfo'), labels: $('labels'), leaders: $('leaders'), hint: $('hint'), presets: $('presets'), legend: $('legend'),
  menu: $('menu'), tip: $('tip'), press: $('press'), explode: $('explode'), explodeName: $('explodeName'), explodeOut: $('explodeOut'), play: $('play'), undo: $('undo'),
  help: $('help'), helpDlg: $('helpDlg'), tourBar: $('tourBar'), tourText: $('tourText'), tourStop: $('tourStop'), dock: $('dock'), topbar: $('topbar'),
  quality: $('tQuality'), qualityRow: $('qualityRow'), qualityNote: $('qualityNote'),
  notice: $('notice'), toast: $('toast'), isoBadge: $('isoBadge'), isoName: $('isoName'),
};
// Getallen van de bediening staan in CFG (core.js, golf 5c-2, K1).
const UI_THEME_KEY = AUTO.id + '-theme';        // U5: onthouden themakeuze (light, dark; systeem = niets bewaard)
// MODE, LABELS, CTX, ACTIVE_PRESET, uiLabelForce, needs en requestRender staan in app1.js: app1.js en presets.js lezen ze.
// uiReady: de eerste weergave is klaar en de pagina bedienbaar (gezet bij de start in app2-loop.js), uiReadyT: dat moment.
let uiReady = false, uiReadyT = 0;
const uiVersion = (document.querySelector('meta[name="model-version"]') || {}).content || ''; // VERSION plus inhoudshash (build.py)
const fmtCount = n => TXT.onderdelen(n.count);
// standbadge in het paneel; on: gemarkeerd (open, uitgeklapt, uitgelicht)
const uiBadge = (txt, on) => `<span class="state${on ? ' open' : ''}">${txt}</span>`;
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);
const uiTouch = !!(window.matchMedia && matchMedia('(hover: none), (pointer: coarse)').matches);
if (uiTouch) document.body.classList.add('touch');
// Indeling van het paneel: onder als lade (telefoon staand), als kolom rechts (bureaublad en telefoon liggend).
// Eén mediaquery per breekpunt uit CFG.indeling; dezelfde voorwaarden staan in de mediaqueries van head.html.
const uiMqText = `(max-width: ${CFG.indeling.breekpunt - 0.02}px)`; // 919,98 px: precies als in de CSS (smaller dan het breekpunt)
const uiMqNarrow = window.matchMedia ? matchMedia(uiMqText) : null;
const uiMqSide = window.matchMedia ? matchMedia(`${uiMqText} and (max-height: ${CFG.indeling.liggendMaxH}px) and (orientation: landscape)`) : null;
const uiNarrow = () => (uiMqNarrow ? uiMqNarrow.matches : window.innerWidth < CFG.indeling.breekpunt); // smaller dan het breekpunt
const uiSide = () => !!(uiMqSide && uiMqSide.matches);
const uiSheetBottom = () => uiNarrow() && !uiSide();
controls.minDistance = 0.05;
let uiUiDirty = true;            // schermvlakken van de bediening opnieuw meten
let uiSyncPending = false;
const uiUiChanged = () => {
  uiUiDirty = true; requestRender();
  if (!uiSyncPending) { uiSyncPending = true; Promise.resolve().then(() => { uiSyncPending = false; uiSyncLabels(); }); }
};

/* ---------- hulpfuncties voor de boom ---------- */
function uiScopeRoot() { return ISO.length === 1 ? ISO[0] : ROOT; }
function pathFrom(n) { const p = []; for (let a = n; a; a = a.parent) { p.unshift(a); if (ISO.includes(a)) break; } return p; }
function uiClosedAbove(n) { for (let a = n.parent; a; a = a.parent) { if (!uiOpen(a)) return a; if (ISO.includes(a)) break; } return null; }
function uiDeepestOpen(p) { let a = null; pathFrom(p).forEach(x => { if (x.asm && uiOpen(x)) a = x; }); return a; }

/* ---------- klikmodi: één strategie per modus (golf 5c-2, K4) ---------- */
// In Uitklappen bepaalt de klikmodus van het dock (MODE: part, layers, collapse, select) wat een klik doet; in Openen
// (OPENMODE) geldt altijd de strategie open, en blijft MODE bewaard voor de terugkeer. uiMode() geeft de geldende strategie.
// Alle verschillen tussen de modi staan hier, de rest van de code vraagt het aan de strategie:
//   act(p)          klik of tik op p (een onderdeel, of het label of de lijstregel van een groep)
//   target(p)       wat een klik op onderdeel p zou raken (aanwijzen, tip, testhaak hoverNode)
//   tip(p, t)       tiptekst bij aanwijzen, met t = target(p)
//   cursor(p)       handje bij aanwijzen
//   collapse(p)     rechtsklik, Shift+klik en lang drukken
//   enter(n, shift) Enter en Shift+Enter op de selectie
//   reveal(n)       n kiezen in de lijst, het paneel of de nummers
//   state(n)        de standbadge in het paneel; plan(n) de openknop in het paneel (null: geen knop); desc(n) de beschrijving
//   uitklap         het paneel toont de knoppen voor uitklappen, duiken, dimmen en isoleren
//   dubbel          een dubbelklik duikt naar het onderdeel (in Openen heeft de eerste klik al gedaan wat er te doen was)
//   dim             duiken dimt de rest (U19)
//   tint(n)         de geselecteerde knoop krijgt de gele tint (in Openen niet op een opener: die is het doel van de klik)
// U7: de uitleg bij de hele auto in de modus Openen (de beschrijving in systems.js noemt het uitklappen)
const uiOpenRootDesc = AUTO.openUitleg;
const uiOpenLabel = n => (n.opn && n.opn.label) || n.name; // naam van een opener in teksten
function uiSelectAct(p) { uiPush(); select(p); uiAfterAction(); }
// Klik op onderdeel P (modus Onderdeel): is de eigen groep G dicht, dan klapt alleen G ter plekke uit;
// staat G al open, dan wordt P geselecteerd en uitgelicht. Een klik klapt nooit een groep boven G uit.
// Laag voor laag: G is de buitenste dichte groep op het pad. groupOf(p) geeft G of niets.
const uiExplodeAct = groupOf => p => {
  if (p.asm) { if (uiOpen(p)) uiSelectAct(p); else doExplode(p); return; } // label of lijst van een groep
  const g = groupOf(p);
  if (g) { doExplode(g); return; }
  uiPush(); select(p); uiLift(p); uiAfterAction();
};
const uiOuterClosed = p => pathFrom(p).find(x => x.asm && !uiOpen(x));
function uiCollapseDeepest(p) { const a = uiDeepestOpen(p); if (a) doCollapse(a); else uiSelectAct(p); }
function uiEnterExplode(n, shift) {
  if (shift) { if (n.asm && uiOpen(n)) doCollapse(n); else if (!n.asm) uiCollapseAt(n); return; }
  if (n.asm && !uiOpen(n)) { doExplode(n); return; }
  const a = uiClosedAbove(n);
  if (a) { doExplode(a); return; }
  if (n.asm) doCollapse(n); else { uiPush(); uiLift(n); uiAfterAction(); }
}
function uiStateExplode(n) {
  if (n.asm) return uiOpen(n) ? uiBadge(TXT.stand.uitgeklapt, true) : uiBadge(n.target > 0 ? TXT.stand.deels : TXT.stand.ingeklapt);
  return n === uiLifted ? uiBadge(TXT.stand.uitgelicht, true) : uiBadge(TXT.stand.onderdeel);
}
const uiTipExplode = (p, t) => (t.asm ? TXT.tipUitklappen(t.name, fmtCount(t)) : TXT.tipUitlichten(t.name));
// gemeenschappelijk voor de vier klikmodi van Uitklappen
const uiModeExplode = {
  tip: uiTipExplode, cursor: () => true, collapse: uiCollapseDeepest, enter: uiEnterExplode, reveal: uiRevealExplode,
  state: uiStateExplode, plan: () => null, desc: n => n.d || '', uitklap: true, dubbel: true, dim: true, tint: () => true,
};
const UI_MODES = {
  part: Object.assign({}, uiModeExplode, { act: uiExplodeAct(p => (uiOpen(p.parent) ? null : p.parent)), target: p => (uiOpen(p.parent) ? p : p.parent) }),
  layers: Object.assign({}, uiModeExplode, { act: uiExplodeAct(uiOuterClosed), target: p => uiOuterClosed(p) || p }),
  collapse: Object.assign({}, uiModeExplode, {
    act: p => { if (!p.asm) uiCollapseAt(p); else if (uiOpen(p)) doCollapse(p); else uiSelectAct(p); },
    target: p => uiDeepestOpen(p) || p,
    tip: (p, t) => (t.asm ? TXT.tipInklappen(t.name, fmtCount(t)) : TXT.tipNietsIn(p.name)),
  }),
  select: Object.assign({}, uiModeExplode, { act: uiSelectAct, target: p => p, tip: p => TXT.tipInfo(p.name) }),
  open: {
    act: p => uiOpenAct(p),
    target: p => { const pl = uiOpenPlan(p); return pl ? pl.n : p; },
    tip: p => { const pl = uiOpenPlan(p); return pl ? TXT.tipOpen(uiOpenLabel(pl.n), pl.open) : TXT.tipNietsOpen(p.name); },
    cursor: p => !!uiOpenPlan(p),
    collapse: p => uiOpenClose(p),
    // Enter opent of sluit de opener van de selectie, Shift+Enter sluit de binnenste open opener
    enter: (n, shift) => { if (shift) uiOpenClose(n); else { const pl = uiPanelPlan(n); if (pl) uiOpenTo(pl.n, pl.open); } },
    reveal: uiRevealOpen,
    state: n => (n.opn && !n.opn.lead ? (n.ot > 0 ? uiBadge(TXT.stand.open, true) : uiBadge(TXT.stand.dicht)) : n.asm ? uiBadge(TXT.stand.gemonteerd) : uiStateExplode(n)),
    plan: n => uiPanelPlan(n),
    // de wortel krijgt een eigen uitleg bij de modus (U7: een eigen tekst, geen knip uit de beschrijving in systems.js)
    desc: n => (n === ROOT ? uiOpenRootDesc : (n.d || '')),
    uitklap: false, dubbel: false, dim: false, tint: n => !n.opn,
  },
};
const uiMode = () => (OPENMODE ? UI_MODES.open : UI_MODES[MODE] || UI_MODES.part); // een onbekende klikmodus (testhaak setMode) werkt als Onderdeel

/* ---------- onderdeelnummers ---------- */
// Gegevens uit PN_DATA (src/partnumbers.js). map: pad zonder wortel -> [eenheid, 'zelf' | 'deel' | 'set', regel].
// 'zelf': het onderdeel is zelf de verkoopeenheid; 'deel' of 'set': het zit in de eenheid en wordt daarmee besteld.
// Een knoop zonder regel is niet onderzocht. De pagina toont alleen wat er staat en voegt zelf geen nummers toe.
// Golf 5c-2, P1: build.py zet de gegevens als JSON in het blok #pn (script van het type application/json) en maakt van PN_DATA een
// object waarvan meta, units, map en info pas bij het eerste gebruik worden gelezen (uiPnLazy). De index (uiPnBuild) wordt
// pas gebouwd als het paneel, het zoeken op nummer of een testhaak hem nodig heeft (uiPnReady); bij het opstarten vult het
// paneel de nummers na de eerste weergave. In het geheugen heeft PN_DATA dezelfde vorm als vroeger (testcontract).
let uiPnIdx = new Map(), uiPnUnitNode = new Map(), uiPnBad = [], uiPnCov = new Map(), uiPnGen = 0, uiPnLater = false;
const UI_LINK_REL = 'noopener noreferrer'; // R5: cataloguslinks zonder opener en zonder verwijzende pagina (Referer)
const uiPnCompact = t => uiNorm(t).replace(/[\s.\-\/]/g, ''); // een nummer zonder spaties, punten, streepjes en schuine strepen (K3: op uiNorm)
const uiPnHasNum = r => !!r && ((r.u.oe && r.u.oe.length > 0) || (r.u.am && r.u.am.length > 0));
// map uit partnumbers.js: een lijst [p, rest, eenheid, relatie, regel?] met voorvoegselcodering (build_pn.py, front_code)
// terug naar pad -> [eenheid, relatie, regel]; een object (oudere of lege gegevens) blijft zoals het is
function uiPnDecode(d) {
  const out = { meta: d.meta || {}, units: d.units || {}, map: d.map || {}, info: d.info || {} };
  if (Array.isArray(d.map)) {
    const m = {}; let prev = '';
    for (const [p, rest, id, how, rule] of d.map) { prev = prev.slice(0, p) + rest; m[prev] = [id, how, rule || '']; }
    out.map = m;
  }
  return out;
}
// Wordt aangeroepen op de plaats van partnumbers.js (build.py); functiedeclaraties zijn in het hele script al bekend.
function uiPnLazy() {
  let data = null;
  const load = () => {
    if (data) return data;
    const t0 = performance.now(), el = document.getElementById('pn');
    // uiPnLazy bestaat alleen als build.py de gegevens heeft gesplitst; zonder het blok zou het paneel stil leeg blijven
    if (!el) console.error('onderdeelnummers: het JSON-blok #pn ontbreekt');
    try { data = uiPnDecode(el ? JSON.parse(el.textContent) : {}); } catch (e) {
      console.error('onderdeelnummers: de gegevens in #pn zijn onleesbaar (' + (e && e.message) + ')');
      data = uiPnDecode({});
    }
    uiTiming.pn = Math.round(performance.now()); uiTiming.pnMs = Math.round(performance.now() - t0);
    return data;
  };
  const o = {};
  for (const k of ['meta', 'units', 'map', 'info']) Object.defineProperty(o, k, { enumerable: true, get: () => load()[k], set: v => { load()[k] = v; } });
  return o;
}
function uiPnReady() { if (!uiPnGen) uiPnBuild(); }
function uiPnBuild() {
  uiPnIdx = new Map(); uiPnUnitNode = new Map(); uiPnBad = []; uiPnCov = new Map(); uiPnGen++;
  // paden opzoeken in een vaste tabel: een naam kan zelf een schuine streep bevatten (ABS/ESP-unit)
  const full = new Map(ALL.map(k => [uiRelPath(k), k]));
  for (const [path, e] of Object.entries(PN_DATA.map || {})) {
    const n = full.get(path) || uiByPath(path), id = Array.isArray(e) ? e[0] : null, u = id != null && PN_DATA.units ? PN_DATA.units[id] : null;
    if (!n) { uiPnBad.push(path + ': pad bestaat niet'); continue; }
    if (!u) { uiPnBad.push(path + ': eenheid ' + id + ' ontbreekt'); continue; }
    const kind = e[1] === 'deel' || e[1] === 'set' ? e[1] : 'zelf';
    const q = [...(u.oe || []).map(x => x[0]), ...(u.am || []).map(x => x[1])].map(uiPnCompact).join(' ');
    uiPnIdx.set(n, { id, kind, rule: e[2] || '', u, q });
    if (kind === 'zelf' && !uiPnUnitNode.has(id)) uiPnUnitNode.set(id, n);
  }
}
function uiPnCheck() { uiPnReady(); return uiPnBad.slice(); }
function uiPnRec(n) { uiPnReady(); return uiPnIdx.get(n) || null; }
// aantal onderdelen onder n waarvoor een nummer bekend is (een eenheid met nummer telt voor al haar onderdelen)
function uiPnCover(n) {
  let c = uiPnCov.get(n);
  if (c != null) return c;
  const r = uiPnRec(n);
  c = uiPnHasNum(r) ? n.count : (n.asm ? n.kids.reduce((a, k) => a + uiPnCover(k), 0) : 0);
  uiPnCov.set(n, c);
  return c;
}
function renderPn(n) {
  const box = $('pnBody'), mk = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
  box.textContent = '';
  // bij het opstarten de gegevens niet vóór de eerste weergave lezen: uiPnFill vult het paneel daarna
  if (!uiPnGen && !uiReady) { uiPnLater = true; return; }
  const r = uiPnRec(n), u = r && r.u, st = mk('p', 'pn-status');
  let badge, ok = false;
  if (r && r.kind === 'zelf' && u.st === 'past') { badge = TXT.pnPast; ok = true; }
  else if (r && r.kind === 'zelf' && u.st === 'vin') badge = u.kz ? TXT.pnGekozen : TXT.pnVin;
  else if (r && r.kind === 'zelf' && u.st === 'nietgevonden') badge = TXT.pnNietGevonden;
  else if (r && r.kind !== 'zelf') badge = r.kind === 'set' ? TXT.pnDeelSet : TXT.pnDeel;
  else if (!n.asm || uiPnCover(n) === 0) badge = TXT.pnNietOnderzocht;
  if (badge) st.appendChild(mk('span', 'state' + (ok ? ' ok' : ''), badge));
  if (r && r.kind !== 'zelf') {
    const un = uiPnUnitNode.get(r.id);
    if (un && un !== n) { const b = mk('button', null, u.n || un.name); b.type = 'button'; b.onclick = () => reveal(un); st.appendChild(b); }
    else st.appendChild(mk('b', null, u.n || r.id));
    if (r.rule) st.appendChild(mk('small', null, r.rule));
  } else if (r && u.n && u.n !== n.name) st.appendChild(mk('small', null, u.n));
  if (n.asm) {
    const sub = n.kids.reduce((a, k) => a + uiPnCover(k), 0);
    if (sub > 0) st.appendChild(mk('small', null, TXT.pnHieronder(sub, n.count)));
  }
  box.appendChild(st);
  const kz = r && r.kind === 'zelf' && u.kz;
  if (kz) {
    // De uitvoering voor de auto van de gebruiker, volgens de RDW en het chassisnummer van de gebruiker (zie build_pn.py, VIN_KEUZE).
    box.appendChild(mk('h4', null, TXT.pnGekozen));
    const k = mk('div', 'pn-kzbox');
    k.appendChild(mk('p', 'pn-txt', kz.v));
    const gek = [...(kz.o || []), ...(kz.a || []).map(x => x[0] + ' ' + x[1])];
    if (gek.length) k.appendChild(mk('p', 'pn-txt', TXT.pnKeuze(gek.join(', '), kz.b, kz.z)));
    k.appendChild(mk('p', 'pn-txt', kz.g));
    const bronnen = (kz.s || []).filter(x => /^https:\/\//i.test(x));
    if (bronnen.length) {
      const d = mk('div', 'pn-src');
      for (const url of bronnen) { const a = mk('a', null, url.replace(/^https?:\/\/(www\.)?/, '').split('/')[0]); a.href = url; a.target = '_blank'; a.rel = UI_LINK_REL; d.appendChild(a); }
      k.appendChild(d);
    }
    if (PN_DATA.meta && PN_DATA.meta.auto) k.appendChild(mk('small', null, PN_DATA.meta.auto));
    box.appendChild(k);
  }
  const isKz = (oe, am) => !!kz && (oe != null ? (kz.o || []).includes(oe) : (kz.a || []).some(x => x[0] === am[0] && x[1] === am[1]));
  if (uiPnHasNum(r)) {
    const head = (txt) => box.appendChild(mk('h4', null, txt));
    if (u.oe && u.oe.length) {
      head(r.kind === 'zelf' ? TXT.pnMerkNummer(AUTO.merk, u.oe.length > 1) : TXT.pnMerkNummerVan(AUTO.merk, u.n || r.id));
      const ul = mk('ul', 'pn-nums');
      for (const [num, note, lvl] of u.oe) { const li = mk('li'); if (isKz(num)) li.className = 'pn-kz'; li.appendChild(mk('b', null, num)); if (isKz(num)) li.appendChild(mk('em', null, TXT.pnGekozenKort)); if (lvl) li.appendChild(uiPnLvl(mk, lvl)); if (note) li.appendChild(mk('span', null, note)); ul.appendChild(li); }
      box.appendChild(ul);
    }
    if (u.am && u.am.length) {
      head(TXT.pnAndere);
      const t = mk('table', 'pn-tab'), hr = t.createTHead().insertRow();
      for (const h of TXT.pnKolommen) hr.appendChild(mk('th', null, h));
      const tb = t.createTBody();
      for (const [merk, num, note, lvl] of u.am) { const tr = tb.insertRow(); if (isKz(null, [merk, num])) tr.className = 'pn-kz'; tr.appendChild(mk('td', null, merk)); tr.appendChild(mk('td', 'num', num)); const td = mk('td'); if (lvl) td.appendChild(uiPnLvl(mk, lvl)); tr.appendChild(td); const tn = mk('td', null, note || ''); if (tr.className === 'pn-kz') tn.appendChild(mk('em', null, (note ? ' ' : '') + TXT.pnGekozenKort)); tr.appendChild(tn); }
      box.appendChild(t);
    }
    box.appendChild(mk('p', 'pn-txt', TXT.pnBewijs(AUTO.pnType, AUTO.merk)));
  }
  if (u && u.var) { box.appendChild(mk('h4', null, kz ? TXT.pnVarianten : TXT.pnVariant)); box.appendChild(mk('p', 'pn-txt', u.var)); }
  // de notitie bij een eenheid is per auto een onderzoeksaantekening of een toelichting voor de lezer (auto.json: pnToelichting)
  if (AUTO.pnToelichting && u && u.note) { box.appendChild(mk('h4', null, TXT.pnToelichting)); box.appendChild(mk('p', 'pn-txt', u.note)); }
  if (u && u.per) { box.appendChild(mk('h4', null, TXT.pnVerpakking)); box.appendChild(mk('p', 'pn-txt', u.per)); }
  const links = u && (u.src || []).filter(x => x && /^https?:\/\//i.test(x[0]));
  if (links && links.length) {
    box.appendChild(mk('h4', null, TXT.pnBronnen));
    const d = mk('div', 'pn-src');
    for (const [url, label] of links) { const a = mk('a', null, label || url); a.href = url; a.target = '_blank'; a.rel = UI_LINK_REL; d.appendChild(a); }
    box.appendChild(d);
  }
  // onderhoud bij een eenheid: de echte gegevens hebben het (nog) niet, itest controle 15 toetst het met eigen gegevens
  if (u && u.info && u.info.length) {
    box.appendChild(mk('h4', null, TXT.pnOnderhoudEenheid));
    const dl = mk('dl', 'pn-info');
    for (const [label, waarde, bron] of u.info) { dl.appendChild(mk('dt', null, label)); const dd = mk('dd', null, waarde); if (bron) dd.appendChild(mk('small', null, bron)); dl.appendChild(dd); }
    box.appendChild(dl);
  }
  const inf = PN_DATA.info && PN_DATA.info[uiRelPath(n)];
  if (inf && inf.length) {
    box.appendChild(mk('h4', null, TXT.pnOnderhoud));
    const dl = mk('dl', 'pn-info');
    for (const [label, waarde, bron, zeker] of inf) {
      dl.appendChild(mk('dt', null, label));
      const dd = mk('dd', null, waarde);
      if (bron || zeker) { const sm = mk('small', null, (zeker ? zeker + (bron ? ', ' : '') : '')); if (bron && /^https?:\/\//i.test(bron)) { const a = mk('a', null, TXT.pnBron); a.href = bron; a.target = '_blank'; a.rel = UI_LINK_REL; sm.appendChild(a); } else if (bron) sm.appendChild(document.createTextNode(bron)); dd.appendChild(sm); }
      dl.appendChild(dd);
    }
    box.appendChild(dl);
  }
  if (PN_DATA.meta && PN_DATA.meta.checked && (r || n.asm)) box.appendChild(mk('p', 'pn-txt', TXT.pnGecontroleerd(PN_DATA.meta.checked)));
}
function uiPnFill() {
  if (!uiPnLater) return;
  uiPnLater = false; uiPnReady(); renderPn(SEL || ROOT); syncSheetHeight(); uiUiChanged();
}
function uiPnLvl(mk, lvl) {
  const e = mk('span', 'pn-lvl', lvl);
  e.title = TXT.pnNiveau(lvl, AUTO.merk);
  return e;
}

/* ---------- selectie en paneel ---------- */
function select(n, opts = {}) {
  n = n || uiScopeRoot();
  if (uiLifted && uiLifted !== n) uiDrop();
  if (DIM && !isUnder(n, DIM)) uiSetDim(null); // U19: de selectie verlaat de focus (omhoog, breadcrumb, ander deel): de rest komt terug
  SEL = n;
  applyMats();
  renderPanel();
  if (opts.focus) focusNodes([SEL], null, SEL.asm ? 1.1 : 1.6, { min: 0.3 });
  if (treeVisible()) renderTree();
  uiSyncExplode();
  requestRender();
}
// Golf 5c-2, P2: select() en uiAfterAction() bouwen allebei het paneel. De vaste inhoud (kruimelpad, beschrijving,
// specificaties, onderdelenlijst en nummers) hangt alleen af van de knoop, de modus Openen en de nummergegevens en wordt
// daarom één keer per knoop gebouwd (uiPanelFixed); de stand en de knoppen volgen elke keer.
let uiPanelKey = '';
function renderPanel() {
  const n = SEL || ROOT;
  const key = n.id + '|' + (OPENMODE ? 1 : 0) + '|' + uiPnGen;
  if (key !== uiPanelKey) { uiPanelKey = key; uiPanelFixed(n); }
  // U6: de live regions (#selName, #selMeta) alleen beschrijven als er iets verandert; een schermlezer leest anders elke
  // herhaalde opbouw van het paneel voor (bij elke handeling twee tot drie keer)
  if (els.name.textContent !== n.name) els.name.textContent = n.name;
  const m = uiMode(), state = m.state(n);
  const isoTxt = ISO.includes(n) ? TXT.geisoleerd : '';
  const meta = `${state}${n.asm ? fmtCount(n) : (n.parent ? TXT.inGroep(esc(n.parent.name)) : '')}${isoTxt}`;
  if (els.meta._h !== meta) { els.meta._h = meta; els.meta.innerHTML = meta; }
  const plan = m.plan(n);
  els.open.hidden = !plan;
  if (plan) { els.open.textContent = TXT.openKnop(plan.open); els.open.setAttribute('aria-label', TXT.openKnopAria(plan.open, uiOpenLabel(plan.n))); els.open.title = TXT.openKnopTitel(plan.open, uiOpenLabel(plan.n)); }
  // in Openen is er niets uit te klappen of te isoleren: alleen de opener en In beeld blijven
  els.toggle.hidden = !n.asm || !m.uitklap;
  els.toggle.textContent = n.asm && uiOpen(n) ? TXT.inklappen : TXT.uitklappen;
  els.all.hidden = !n.asm || !m.uitklap;
  els.dive.hidden = n.asm || !m.uitklap;
  els.dim.hidden = !DIM || !m.uitklap;
  if (DIM) els.dim.title = TXT.dimTitel(DIM.name);
  els.up.hidden = !m.uitklap; els.iso.hidden = !m.uitklap;
  els.up.disabled = !uiClosedAbove(n);
  els.up.title = els.up.disabled ? TXT.omhoogVol : TXT.omhoogTitel;
  const isoOn = ISO.length === 1 && ISO[0] === n;
  els.iso.textContent = isoOn || (ISO.length && n === ROOT) ? TXT.allesTonen : TXT.isoleren;
  els.iso.disabled = n === ROOT && !ISO.length;
  syncSheetHeight();
  uiUiDirty = true;
}
function uiPanelFixed(n) {
  els.crumbs.innerHTML = '';
  ancestors(n).forEach((a, i) => {
    if (i) { const sp = document.createElement('span'); sp.textContent = '›'; els.crumbs.appendChild(sp); }
    const b = document.createElement('button'); b.textContent = a.name; b.onclick = () => { uiPush(); select(a, { focus: true }); uiAfterAction(); }; els.crumbs.appendChild(b);
  });
  // in Openen krijgt de wortel een eigen uitleg bij de modus (U7: een eigen tekst, geen knip uit de beschrijving in systems.js)
  els.desc.textContent = uiMode().desc(n);
  els.spec.innerHTML = (n.spec || []).map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(v)}</dd>`).join('');
  els.spec.hidden = !n.spec;
  els.kids.innerHTML = '';
  els.kidsTitle.hidden = !n.asm;
  renderPn(n);
  if (n.asm) {
    els.kidsTitle.textContent = TXT.bestaatUit(n.kids.length);
    const MAXK = CFG.indeling.kinderen;
    n.kids.slice(0, MAXK).forEach((k, i) => {
      const b = document.createElement('button');
      b.innerHTML = `<b>${i + 1}</b>${esc(k.name)}`;
      b.onclick = () => reveal(k);
      els.kids.appendChild(b);
    });
    if (n.kids.length > MAXK) {
      const b = document.createElement('button'); b.textContent = TXT.enNog(n.kids.length - MAXK);
      b.onclick = () => { showTab('tree'); if (uiSheetBottom()) setSheet('open'); };
      els.kids.appendChild(b);
    }
  }
}

// Na elke gebruikershandeling: paneel, boom, schuif, presetknoppen en stap-terug bijwerken.
// I5/I6: schakelaars en spreidingsschuif volgen de stand ook na presets, stap terug en de rondleiding
function uiSyncToggles() {
  $('tXray').checked = XRAY; $('tSys').checked = SYSCOL; els.legend.hidden = !SYSCOL;
  const sp = Math.round(SPREAD * 100); $('spread').value = String(sp); $('spreadOut').textContent = TXT.procent(sp);
}
function uiAfterAction() {
  renderPanel();
  if (treeVisible()) renderTree();
  uiSyncExplode(); uiSyncCats(); uiSyncUndo(); uiSyncToggles(); uiSyncOpenUi(); uiSyncIso();
  applyMats(); // I3: geen gele selectietint meer op een groep die open is gegaan
  uiHideTip();
  uiSyncLabels();
  uiUrlSync();
  requestRender();
}
// Labels direct bijwerken (niet pas bij het volgende frame), zodat er nooit een label van een vorige stand blijft staan.
function uiSyncLabels() {
  if (!uiReady) return;
  ROOT.obj.updateMatrixWorld(); camera.updateMatrixWorld();
  updateLabels();
}
function uiAfterUndo() { applyMats(); uiAfterAction(); }
function clearPreset() { if (ACTIVE_PRESET) { ACTIVE_PRESET = null; uiSyncCats(); } }

/* ---------- onderdelenboom ---------- */
const openRows = new Set([ROOT.id]);
function treeVisible() { return !$('tab-tree').hidden && (!uiSheetBottom() || els.sheet.dataset.state === 'open'); }
function treeRow(n, level) {
  const li = document.createElement('li'); li.setAttribute('role', 'none');
  const row = document.createElement('div'); row.className = 'trow' + (n === SEL ? ' sel' : ''); row.setAttribute('role', 'treeitem'); row.setAttribute('aria-level', String(level)); row.setAttribute('aria-selected', String(n === SEL));
  const tw = document.createElement('button'); tw.className = 'tw';
  if (n.asm) { const op = openRows.has(n.id); row.setAttribute('aria-expanded', String(op)); tw.textContent = op ? '▾' : '▸'; tw.setAttribute('aria-label', op ? TXT.lijstIn : TXT.lijstUit); tw.onclick = () => { op ? openRows.delete(n.id) : openRows.add(n.id); renderTree(); }; } else { tw.tabIndex = -1; tw.setAttribute('aria-hidden', 'true'); }
  const dot = document.createElement('span'); dot.className = 'dot' + (uiOpen(n) ? ' open' : ''); if (!n.asm) dot.style.visibility = 'hidden';
  dot.title = uiOpen(n) ? TXT.bolOpen : TXT.bolDicht;
  const nm = document.createElement('button'); nm.className = 'tn'; nm.textContent = n.name; nm.onclick = () => reveal(n);
  const c = document.createElement('span'); c.className = 'tc'; c.textContent = n.asm ? n.count : '';
  row.append(tw, dot, nm, c); li.appendChild(row);
  if (n.asm && openRows.has(n.id)) { const ul = document.createElement('ul'); ul.setAttribute('role', 'group'); n.kids.forEach(k => ul.appendChild(treeRow(k, level + 1))); li.appendChild(ul); }
  return li;
}
// U10: synoniemen. Een zoekterm die een woord uit een groep bevat, zoekt ook met de andere woorden van die groep
// ("alternator" vindt de Dynamo, "remblok binnen" ook een remvoering). Vergelijken gebeurt op uiNorm (app1.js):
// kleine letters zonder diakrieten, zodat "Röntgen", "rontgen" en "RONTGEN" hetzelfde zijn.
const uiSynonyms = [
  ['remvoering', 'remblok'], ['dynamo', 'alternator'], ['accu', 'batterij'], ['versnellingsbak', 'transmissie', 'automaat'],
  ['uitlaat', 'demper'], ['koppeling', 'koppelomvormer'], ['bougie', 'ontstekingskaars'], ['schokdemper', 'demper'],
  ['ruitenwisser', 'wisser'], ['stuurbekrachtiging', 'stuurpomp'],
];
// alle zoektermen voor q: q zelf en elke variant waarin een synoniem is ingevuld; terms[0] is q
function uiSearchTerms(q) {
  q = uiNorm(q).trim();
  const terms = [q];
  if (!q) return terms;
  for (const group of uiSynonyms) for (const w of group) if (q.includes(w)) for (const o of group) { if (o === w) continue; const v = q.replace(w, o); if (!terms.includes(v)) terms.push(v); }
  return terms;
}
// Golf 5c-2, P2: de boom alleen opnieuw opbouwen als wat hij toont is veranderd: de zoekterm en de treffers, de selectie, de
// open rijen en de stand (uitgeklapt of niet) van elke getoonde groep. select() en uiAfterAction() vragen er allebei om.
let uiTreeKey = '';
function uiTreeSig(list) {
  let s = (SEL ? SEL.id : -1) + ':';
  const row = n => { s += n.id + (uiOpen(n) ? '+' : '-'); if (n.asm && openRows.has(n.id)) { s += '['; n.kids.forEach(row); s += ']'; } };
  list.forEach(row);
  return s;
}
function renderTree() {
  const terms = uiSearchTerms(els.search.value), q = terms[0];
  let all = null;
  if (q.length >= 2) {
    const qn = uiPnCompact(q), byNum = qn.length >= 3 && /\d/.test(qn);   // een zoekterm met cijfers zoekt ook in de nummers
    if (byNum) uiPnReady();
    all = ALL.filter(n => terms.some(t => n.norm.includes(t)) || (byNum && (uiPnIdx.get(n) || { q: '' }).q.includes(qn)));
  }
  const key = els.search.value + '|' + uiPnGen + '|' + (all ? all.length + '|' + uiTreeSig(all.slice(0, CFG.indeling.treffers)) : uiTreeSig([ROOT]));
  if (key === uiTreeKey) return;
  uiTreeKey = key;
  els.tree.innerHTML = '';
  const ul = document.createElement('ul');
  if (all) {
    const hits = all.slice(0, CFG.indeling.treffers);
    const syn = terms.length > 1 ? TXT.zoekOok(terms.slice(1)) : '';
    els.treeInfo.textContent = all.length ? TXT.treffers(all.length) + syn + (all.length > hits.length ? TXT.eersteN(hits.length) : '') : TXT.geenTreffer(syn);
    hits.forEach(n => { const li = treeRow(n, 1); const small = document.createElement('div'); small.className = 'tpath'; small.textContent = ancestors(n).slice(1).map(a => a.name).join(' › ') || TXT.heleAuto; li.appendChild(small); ul.appendChild(li); });
  } else {
    els.treeInfo.textContent = q.length === 1 ? TXT.tweeLetters : '';
    ul.appendChild(treeRow(ROOT, 1));
  }
  els.tree.appendChild(ul);
}
els.search.addEventListener('input', renderTree);

/* ---------- tabs en paneel (mobiel) ---------- */
function showTab(id) {
  ['info', 'tree', 'view'].forEach(t => { $('tab-' + t).hidden = t !== id; $('tabbtn-' + t).setAttribute('aria-selected', String(t === id)); $('tabbtn-' + t).tabIndex = t === id ? 0 : -1; });
  if (id === 'tree') { ancestors(SEL).forEach(a => openRows.add(a.id)); renderTree(); }
}
['info', 'tree', 'view'].forEach((t, i, arr) => {
  const b = $('tabbtn-' + t);
  b.addEventListener('click', () => showTab(t));
  b.addEventListener('keydown', e => { if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return; const j = (i + (e.key === 'ArrowRight' ? 1 : arr.length - 1)) % arr.length; showTab(arr[j]); $('tabbtn-' + arr[j]).focus(); e.preventDefault(); });
});
function setSheet(state) {
  if (uiSide()) state = 'open'; // zijkolom: altijd de volle inhoud, geen peek en geen lade
  els.sheet.dataset.state = state;
  $('sheetToggle').setAttribute('aria-expanded', String(state === 'open'));
  $('sheetToggle').setAttribute('aria-label', state === 'open' ? TXT.paneelKleiner : TXT.paneelGroter);
  $('btnParts').setAttribute('aria-pressed', String(state === 'open' && !$('tab-tree').hidden));
  $('btnView').setAttribute('aria-pressed', String(state === 'open' && !$('tab-view').hidden));
  syncSheetHeight(); layoutView(); uiRefitSoon();
  if (treeVisible()) renderTree();
}
// Draaien of formaat wisselen tussen lade en zijkolom: stand van het paneel en vrij beeld opnieuw bepalen
if (uiMqSide) { const f = () => { setSheet(uiSide() ? 'open' : 'peek'); }; uiMqSide.addEventListener ? uiMqSide.addEventListener('change', f) : uiMqSide.addListener(f); }
$('sheetToggle').onclick = () => setSheet(els.sheet.dataset.state === 'open' ? 'peek' : 'open');
$('btnParts').onclick = () => { const open = els.sheet.dataset.state === 'open' && !$('tab-tree').hidden; showTab('tree'); setSheet(open ? 'peek' : 'open'); };
$('btnView').onclick = () => { const open = els.sheet.dataset.state === 'open' && !$('tab-view').hidden; showTab('view'); setSheet(open ? 'peek' : 'open'); };
function syncSheetHeight() {
  if (uiSheetBottom()) document.getElementById('app').style.setProperty('--sheet-h', (els.sheet.dataset.state === 'open' ? 0 : els.sheet.offsetHeight) + 'px');
}
