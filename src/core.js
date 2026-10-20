'use strict';
/* ===================== basis: renderer, scène, materialen, geometrie-hulpen ===================== */
/* ---------- instellingen van de app (golf 5c-2, K1) ---------- */
// Alle vaste getallen van de bediening op één plek: gebaren, tijden, rekenbudgetten per frame en indeling. Tijden in ms,
// tenzij de naam op S eindigt (seconden); afstanden in CSS-pixels. De mediaqueries in head.html gebruiken dezelfde
// breekpunten met het getal zelf (CSS kent geen variabele in een mediaquery); elk van die regels verwijst naar CFG.indeling.
const CFG = Object.freeze({
  gebaar: Object.freeze({
    sleepPx: 7,          // vanaf zoveel beweging is een gebaar slepen (geen tik, geen lang drukken)
    tikMaxMs: 600,       // langer ingedrukt (muis) is geen klik
    dubbelMs: 420,       // tweede tik binnen deze tijd ...
    dubbelPx: 26,        // ... en binnen deze afstand is een dubbeltik
    drukMs: 500,         // lang drukken op een aanraakscherm
    ringMs: 150,         // de ring van lang drukken verschijnt na deze tijd
    trilMs: 10,          // U8: trilling als de ring vol is
    naastPx: 22,         // een vinger naast een klein onderdeel: het dichtstbijzijnde binnen deze straal
    aanwijsMs: 60,       // aanwijzen met de muis hoogstens zo vaak
  }),
  tijd: Object.freeze({
    hintMs: 9000,        // hint bij de start, daarna (U8) de suggestie tot de eerste klik
    toastMs: 1800,       // U8, U9: korte melding onderin
    isoFadeMs: 300,      // U4: uitfaden van wat bij isoleren uit beeld gaat
    tourStapMs: 5000, tourStapRustigMs: 4500, // R4: duur van een stap van de rondleiding (normaal, minder beweging)
    herkaderMs: 160,     // R3: herkadreren na een formaatwissel of een andere indeling, zoveel later
    uitklapS: 0.85,      // standaardduur van uitklappen (een volle stap)
    staffelS: 0.22, tonenStaffelS: 0.18, staffelMaxS: 0.6, // F4: wachttijd per laag bij duiken (0,22) en tonen (0,18), samen hoogstens zolang (een duik duurt zo hoogstens circa 1,45 s)
    allesStaffelS: 0.32, allesStaffelMaxS: 1.4, // F4: idem bij alles uitklappen onder een groep (hoogstens circa 2,25 s)
    openS: 0.9,          // standaardduur van openen (open.dur van een opener gaat voor)
    startMs: 8000,       // zolang na het opstarten krijgen de batches meer rekentijd
    klaarMs: 2000,       // __model.ready wacht hoogstens zolang op de batches van de beginstand
  }),
  budget: Object.freeze({ // rekentijd per frame (ms) voor werk op de achtergrond
    batchActief: 3, batchRust: 10, batchStart: 25, // samengevoegde groepen bouwen: tijdens beweging, in rust, bij het opstarten
    batchTekenMs: 300, batchTekenStartMs: 1500,  // na een klare batch hoogstens zo vaak opnieuw tekenen (in rust, bij het opstarten)
    ankerActief: 2, ankerRust: 8,                // labelankers vooruit bouwen
  }),
  indeling: Object.freeze({
    breekpunt: 920,      // vanaf deze breedte staat het paneel als kolom rechts; smaller is het een lade onderin
    liggendMaxH: 520,    // smaller dan het breekpunt en hoogstens zo hoog in liggende stand: zijkolom (telefoon liggend)
    smal: 600,           // smal scherm: minder labels, het presetmenu als lade onderin
    labels: 24, labelsSmal: 10, // U2: hoogstens zoveel labels
    historie: 50,        // stappen terug
    kinderen: 80,        // knoppen in de lijst Bestaat uit
    treffers: 80,        // zoektreffers in de onderdelenlijst
    herkaderPx: 24,      // het vrije beeld verandert meer dan dit in hoogte: opnieuw inpassen
  }),
});
/* ---------- teksten van de app (golf 5c-2, K6) ---------- */
// Elke tekst die de code zelf op de pagina zet, staat in deze tabel; een vertaling vervangt alleen de tabel. Een functie is
// een sjabloon: de code geeft de waarden, de tabel de zinsbouw (meervoud en volgorde). Niet in deze tabel: wat per auto
// verschilt (auto.json, in de code AUTO), de vaste teksten van de HTML (head.html), de meldingen voor ontwikkelaars in de
// console en die van de presetcontrole. HTML-opmaak (<i>, <b>, <kbd>) die in een sjabloon staat, hoort bij de tekst.
// TXT.num is de opmaakhulp voor getallen in Nederlandse notatie: decimale komma, geen duizendtalpunt (de pagina toont geen
// getallen van vier cijfers met een eenheid; een telling als 2564 onderdelen blijft zoals hij was).
const TXT = Object.freeze({
  taal: 'nl',
  num: (v, d = 1) => v.toFixed(d).replace('.', ','),
  procent: p => p + '%',
  // opstarten en fouten
  laadDrie: 'De 3D-bibliotheek kon niet worden geladen. Controleer de verbinding en laad de pagina opnieuw.',
  laadWebgl: 'Deze browser kan geen 3D tekenen (WebGL is niet beschikbaar of uitgeschakeld). Probeer een andere browser of zet hardwareversnelling aan.',
  laadBouwen: 'Onderdelen bouwen…',
  laadModelFout: fout => 'Het model kon niet worden opgebouwd (' + fout + '). Laad de pagina opnieuw.',
  laadEerste: 'Eerste weergave…',
  contextWeg: 'De 3D-weergave is onderbroken (de grafische context is verloren). De pagina herstelt dit meestal zelf; zo niet, laad haar dan opnieuw.',
  // paneel: stand en knoppen
  onderdelen: n => (n === 1 ? '1 onderdeel' : `${n} onderdelen`),
  stand: Object.freeze({ open: 'Open', dicht: 'Dicht', gemonteerd: 'Gemonteerd', uitgeklapt: 'Uitgeklapt', deels: 'Deels uitgeklapt', ingeklapt: 'Ingeklapt', uitgelicht: 'Uitgelicht', onderdeel: 'Onderdeel' }),
  inGroep: naam => 'in ' + naam,
  geisoleerd: ' · geïsoleerd',
  openKnop: open => (open ? 'Openen' : 'Sluiten'),
  openKnopAria: (open, opener) => (open ? 'Openen: ' : 'Sluiten: ') + opener,
  openKnopTitel: (open, opener) => (open ? 'Opent ' : 'Sluit ') + opener + ' (Enter)',
  uitklappen: 'Uitklappen', inklappen: 'Inklappen',
  dimTitel: groep => 'De gedimde rest van de auto weer volledig tonen (buiten ' + groep + ')',
  omhoogVol: 'Alles boven deze selectie is al uitgeklapt',
  omhoogTitel: 'De dichte groep boven de selectie uitklappen (Enter)',
  allesTonen: 'Alles tonen', isoleren: 'Isoleren',
  bestaatUit: n => `Bestaat uit (${n})`,
  enNog: n => `… en nog ${n} (zie Onderdelen)`,
  namenEn: namen => namen.join(' en '),
  // paneel: onderdeelnummers (merk en type komen uit auto.json)
  pnPast: 'Past volgens catalogus', pnGekozen: 'Gekozen voor deze auto', pnVin: 'Variant: kies op VIN', pnNietGevonden: 'Niet gevonden',
  pnDeelSet: 'Deel van set', pnDeel: 'Deel van', pnNietOnderzocht: 'Niet onderzocht',
  pnHieronder: (n, van) => `Hieronder hebben ${n} van ${van} onderdelen een nummer.`,
  pnKeuze: (nummers, bewijs, zeker) => 'Nummer: ' + nummers + '. Bewijs ' + bewijs + ', zekerheid van de keuze ' + zeker + '.',
  pnMerkNummer: (merk, meer) => merk + (meer ? '-nummers' : '-nummer'),
  pnMerkNummerVan: (merk, eenheid) => merk + '-nummer van ' + eenheid,
  pnAndere: 'Andere fabrikanten',
  pnKolommen: Object.freeze(['Merk', 'Nummer', 'Bewijs', 'Opmerking']),
  pnGekozenKort: 'gekozen',
  pnBewijs: (type, merk) => 'Bewijs: A staat in de catalogus voor dit type (' + type + ') op de juiste plaats; B is het ' + merk + '-nummer van zo\'n artikel; C is een kruisverwijzing van een A- of B-nummer; D komt alleen uit een advertentie voor een gebruikt onderdeel en is niet in een catalogus gecontroleerd.',
  pnNiveau: (niveau, merk) => ({ A: 'In de catalogus voor dit type, op de juiste plaats', B: merk + '-nummer van een artikel dat voor dit type in de catalogus staat', C: 'Kruisverwijzing van een A- of B-nummer', D: 'Alleen uit een advertentie voor een gebruikt onderdeel van dit model; niet in een catalogus gecontroleerd' }[niveau] || ''),
  pnVarianten: 'Varianten in de catalogus', pnVariant: 'Variant', pnToelichting: 'Toelichting', pnVerpakking: 'Verpakking', pnBronnen: 'Bronnen',
  pnOnderhoudEenheid: 'Onderhoud', pnOnderhoud: 'Onderhoud en bekende problemen', pnBron: 'bron',
  pnGecontroleerd: datum => 'Gegevens gecontroleerd op ' + datum + '.',
  // tip bij aanwijzen (de code geeft namen en tellingen; <i> is opmaak van de tip)
  tipUitklappen: (naam, telling) => `${naam} · ${telling} · klik om uit te klappen`,
  tipUitlichten: naam => `${naam} · <i>klik om uit te lichten</i>`,
  tipInklappen: (naam, telling) => `${naam} · ${telling} · klik om in te klappen`,
  tipNietsIn: naam => `${naam} · <i>niets uitgeklapt om in te klappen</i>`,
  tipInfo: naam => `${naam} · <i>klik voor gegevens</i>`,
  tipOpen: (opener, open) => `${opener} · <i>klik om te ${open ? 'openen' : 'sluiten'}</i>`,
  tipNietsOpen: naam => `${naam} · <i>niets te openen</i>`,
  // onderdelenlijst en zoeken
  lijstIn: 'Inklappen in lijst', lijstUit: 'Uitklappen in lijst', bolOpen: 'uitgeklapt', bolDicht: 'ingeklapt',
  zoekOok: termen => ` (ook gezocht op ${termen.join(', ')})`,
  treffers: n => (n === 1 ? '1 treffer' : `${n} treffers`),
  eersteN: n => `, de eerste ${n} staan hieronder`,
  geenTreffer: ook => 'Geen onderdeel gevonden met die naam' + ook + '.',
  heleAuto: 'hele auto',
  tweeLetters: 'Typ minstens twee letters.',
  zoekToets: ' (toets /)',
  paneelKleiner: 'Paneel kleiner maken', paneelGroter: 'Paneel groter maken',
  // beeld opslaan en meldingen
  beeldNummer: nummers => 'Onderdeelnummer ' + nummers + ' · ',
  beeldVoet: (titel, versie) => titel + ', versie ' + versie,
  beeldNaam: 'beeld',
  beeldMislukt: 'Het beeld kon niet worden opgeslagen.',
  beeldOpgeslagen: naam => 'Beeld opgeslagen als ' + naam,
  // explosieschuif en afspelen
  lagen: (x, n) => `${TXT.num(x)} van ${n} ${n === 1 ? 'laag' : 'lagen'}`,
  stop: 'Stop', monteren: 'Monteren', demonteren: 'Demonteren',
  // presets, menu en rondleiding
  tourLoopt: 'Rondleiding loopt',
  presetsAantal: n => `${n} presets`,
  catAria: (cat, actief) => cat + (actief ? ', actief: ' + actief : ''),
  menuSluiten: 'Menu sluiten',
  menuAria: cat => 'Presets ' + cat,
  tourStoppen: 'Stop rondleiding',
  tourKop: (i, n, titel) => `Rondleiding ${i} van ${n} · ${titel}`,
  hervatten: 'Hervatten', pauze: 'Pauze', tourHervatten: 'Rondleiding hervatten', tourPauzeren: 'Rondleiding pauzeren',
  gedeeldeStand: 'Gedeelde stand', gedeeldeStandUitleg: 'De stand uit de gedeelde link.',
  // hint en hulp
  hintTik: 'Tik op een onderdeel om het uit te klappen · dubbeltik om er direct heen te gaan · houd vast om in te klappen',
  hintKlik: 'Klik op een onderdeel om het uit te klappen · dubbelklik om er direct naartoe te gaan · rechtsklik om in te klappen',
  probeerTik: 'Probeer: tik op de motorkap', probeerKlik: 'Probeer: klik op de motorkap',
  hulpCats: cats => `${cats.length} categorieën (${cats.join(', ')}) met kant-en-klare standen, ook de rondleiding.`,
  hulpToetsen: (van, tot) => `<kbd>${van}</kbd> tot <kbd>${tot}</kbd>`,
  // labels
  labelAria: (nr, naam) => `${nr}. ${naam}`,
  meer: n => `+${n} meer`,
  meerAria: n => `${n} onderdelen meer zonder label; open de lijst`,
  meerTitel: 'Alle onderdelen van deze groep in de lijst',
  // debug-overlay (?debug=1); fps en dpr in de notatie van het meetgereedschap
  debug: (fps, calls, ktri, dpr, lite, versie) => (fps != null ? fps.toFixed(0) + ' fps' : 'rust') + ' · ' + calls + ' tekenopdrachten · ' + ktri + 'k driehoeken · dpr ' + dpr.toFixed(2) + (lite ? ' · lichte weergave' : '') + ' · versie ' + versie,
});
const LOADING = document.getElementById('loading');
// tijdlijn van het opstarten (ms sinds het begin van de navigatie), uit te lezen via __model.timing
const uiTiming = { script: Math.round(performance.now()) };
if (!window.THREE || !THREE.OrbitControls || !THREE.BufferGeometryUtils || !THREE.RoomEnvironment || !THREE.RoundedBoxGeometry) {
  LOADING.textContent = TXT.laadDrie;
  throw new Error('three.js ontbreekt');
}
THREE.ColorManagement.legacyMode = false;
const PI = Math.PI, HALF = PI / 2;
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const lerp = (a, b, t) => a + (b - a) * t;
const V3 = (x, y, z) => new THREE.Vector3(x, y, z);
const REDUCED = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

const canvas = document.getElementById('stage');
// zonder WebGL (of met een geblokkeerde GPU) blijft de laadmelding anders eeuwig op "Model opbouwen" staan
const renderer = (() => {
  try { return new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' }); } catch (e) {
    LOADING.textContent = TXT.laadWebgl;
    throw e;
  }
})();
renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
renderer.outputEncoding = THREE.sRGBEncoding;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 0.98;
renderer.setClearColor(0x000000, 0);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(36, 1, 0.02, 400);
camera.position.set(5.6, 2.5, 6.2);
const controls = new THREE.OrbitControls(camera, canvas);
controls.enableDamping = true;
controls.dampingFactor = 0.09;
controls.target.set(0, 0.62, 0);
controls.minDistance = 0.12;
controls.maxDistance = 60;
controls.maxPolarAngle = PI * 0.97;
controls.rotateSpeed = 0.8;
controls.zoomSpeed = 0.9;
controls.autoRotateSpeed = 0.7;

// Omgevingskaart (PMREM) voor de glans. Na een hersteld WebGL-contextverlies (R2) maakt uiRemakeEnvironment hem opnieuw:
// het resultaat is een rendertarget zonder kopie in het geheugen en komt anders zwart terug.
let pmrem = new THREE.PMREMGenerator(renderer);
function uiMakeEnvironment() {
  const old = scene.environment;
  scene.environment = pmrem.fromScene(new THREE.RoomEnvironment(), 0.04).texture;
  if (old) old.dispose();
}
function uiRemakeEnvironment() {
  pmrem.dispose();
  pmrem = new THREE.PMREMGenerator(renderer);
  uiMakeEnvironment();
}
uiMakeEnvironment();
const uiHemi = new THREE.HemisphereLight(0xffffff, 0x3c434b, 0.35);
scene.add(uiHemi);
const sun = new THREE.DirectionalLight(0xffffff, 1.2);
sun.position.set(4, 9, 6);
scene.add(sun);
const rim = new THREE.DirectionalLight(0xdfe8ff, 0.35);
rim.position.set(-6, 3, -5);
scene.add(rim);
// donkere modus: meer omgevings- en randlicht, zodat zwarte en donkergrijze onderdelen loskomen van de achtergrond
function uiThemeLights() {
  const dark = getComputedStyle(document.documentElement).getPropertyValue('color-scheme').trim() === 'dark';
  uiHemi.intensity = dark ? 0.75 : 0.35; rim.intensity = dark ? 0.75 : 0.35;
  uiHemi.groundColor.setHex(dark ? 0x5a636d : 0x3c434b);
}
uiThemeLights();

/* ---------- materialen ---------- */
const MAT = {};
function std(name, color, metal, rough, extra) {
  const m = new THREE.MeshStandardMaterial(Object.assign({ color, metalness: metal, roughness: rough, side: THREE.DoubleSide }, extra || {}));
  m.name = name; MAT[name] = m; return m;
}
function phys(name, opts) {
  const m = new THREE.MeshPhysicalMaterial(Object.assign({ side: THREE.DoubleSide }, opts));
  m.name = name; MAT[name] = m; return m;
}
phys('paint', { color: 0x92979e, metalness: 0.74, roughness: 0.26, clearcoat: 1, clearcoatRoughness: 0.05, envMapIntensity: 1.15 });
std('paintIn', 0x8b9096, 0.45, 0.55);
std('underbody', 0x3a3f45, 0.15, 0.85);
phys('glass', { color: 0x0b1117, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.86, depthWrite: false, envMapIntensity: 0.85 });
std('chrome', 0xeef1f4, 1, 0.08, { envMapIntensity: 1.25 });
std('blackGloss', 0x0e1013, 0.3, 0.2);
std('plastic', 0x1e2024, 0, 0.72);
std('plasticGrey', 0x4a4f57, 0, 0.62);
std('rubber', 0x141516, 0, 0.88);
std('alu', 0xc3c7cc, 0.85, 0.34);
std('aluCast', 0xa6abb1, 0.7, 0.56);
std('iron', 0x5b6066, 0.75, 0.52);
std('steel', 0xa0a6ad, 0.95, 0.28);
std('darkSteel', 0x3c4147, 0.85, 0.45);
std('bearing', 0xc9a265, 0.95, 0.3);
std('copper', 0xb36d42, 0.9, 0.35);
std('leather', 0xcbb796, 0, 0.6);
std('dash', 0x2a2c30, 0, 0.78);
std('fabric', 0xd8d2c6, 0, 0.95);
std('carpet', 0x2a2927, 0, 1);
std('satin', 0xc8ccd1, 0.9, 0.26);
phys('lensRed', { color: 0xa8121d, metalness: 0, roughness: 0.15, transparent: true, opacity: 0.9 });
phys('lensClear', { color: 0xe6eef5, metalness: 0, roughness: 0.04, transparent: true, opacity: 0.3, depthWrite: false });
std('amber', 0xd8871a, 0.1, 0.35);
std('reflector', 0xdde2e7, 1, 0.14);
std('plateYellow', 0xf3c400, 0, 0.5);
std('plateBlue', 0x1d3f9a, 0, 0.5);
std('ceramic', 0xf1efe9, 0, 0.35);
phys('tank', { color: 0xe9e5da, metalness: 0, roughness: 0.4, transparent: true, opacity: 0.86 });
std('oilFilter', 0x2a56a8, 0.3, 0.45);
std('belt', 0x111214, 0, 0.85);
std('exhaust', 0x8c8681, 0.75, 0.48);
std('heat', 0xcac4b9, 0.9, 0.32);
std('ecu', 0x2f3339, 0.45, 0.5);
std('red', 0xc0262d, 0.1, 0.5);
std('friction', 0x4b3c31, 0, 0.9);
std('handle', 0xf0b81f, 0, 0.5);
std('screen', 0x0b1118, 0.2, 0.1);
std('filter', 0xdcc8a0, 0, 0.9);
std('heater', 0xa86a3d, 0.6, 0.45);

const GHOST = new THREE.MeshStandardMaterial({ color: 0xc4ccd5, metalness: 0, roughness: 0.4, transparent: true, opacity: 0.09, depthWrite: false, side: THREE.DoubleSide });
const GHOST_HL = new THREE.MeshStandardMaterial({ color: 0xf2c230, emissive: 0xf2c230, emissiveIntensity: 0.25, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide });

/* ---------- geometrie-hulpen ---------- */
const GC = new Map();
// Testmodus (window.__MODEL_CACHECHECK): bouwt bij hergebruik van een sleutel opnieuw en meldt een botsing
// als dezelfde sleutel voor andere geometrie wordt gebruikt (bijvoorbeeld twee bestanden met sleutel 'cap').
function cacheSame(a, b) {
  const pa = a.attributes.position, pb = b.attributes.position;
  if (!pa || !pb || pa.count !== pb.count) return false;
  a.computeBoundingBox(); b.computeBoundingBox();
  return a.boundingBox.min.distanceTo(b.boundingBox.min) < 1e-6 && a.boundingBox.max.distanceTo(b.boundingBox.max) < 1e-6;
}
function cache(key, fn) {
  let g = GC.get(key);
  if (!g) { g = fn(); GC.set(key, g); }
  else if (window.__MODEL_CACHECHECK) { const t = fn(); if (!cacheSame(g, t)) console.error(`cache-sleutel "${key}" wordt voor verschillende geometrie gebruikt`); t.dispose(); }
  return g;
}
function xf(g, p, r, s) {
  const c = g.clone();
  const m = new THREE.Matrix4().compose(V3(...(p || [0, 0, 0])), new THREE.Quaternion().setFromEuler(new THREE.Euler(...(r || [0, 0, 0]))), V3(...(s || [1, 1, 1])));
  c.applyMatrix4(m);
  return c;
}
function cleanG(g) {
  const n = g.index ? g.toNonIndexed() : g.clone();
  for (const k of Object.keys(n.attributes)) if (k !== 'position' && k !== 'normal') n.deleteAttribute(k);
  if (!n.attributes.normal) n.computeVertexNormals();
  n.morphAttributes = {}; n.clearGroups();
  return n;
}
function merge(list) {
  const m = THREE.BufferGeometryUtils.mergeBufferGeometries(list.filter(Boolean).map(cleanG), false);
  if (!m) throw new Error('merge mislukt');
  return m;
}
// as-oriëntatie: geometrie gebouwd langs Y (cilinder/lathe) of Z (extrude/torus)
function yTo(g, ax) { if (ax === 'x') g.rotateZ(-HALF); else if (ax === 'z') g.rotateX(HALF); else if (ax === '-x') g.rotateZ(HALF); return g; }
function zTo(g, ax) { if (ax === 'x') g.rotateY(HALF); else if (ax === 'y') g.rotateX(-HALF); return g; }

const G = {
  box: (w, h, d) => cache(`b${w}|${h}|${d}`, () => new THREE.BoxGeometry(w, h, d)),
  rbox: (w, h, d, r) => cache(`rb${w}|${h}|${d}|${r}`, () => new THREE.RoundedBoxGeometry(w, h, d, 2, Math.max(0.0005, Math.min(r, Math.min(w, h, d) / 2 - 0.0002)))),
  cyl: (ax, rt, rb, h, seg = 24, open = false) => cache(`c${ax}${rt}|${rb}|${h}|${seg}|${open}`, () => yTo(new THREE.CylinderGeometry(rt, rb, h, seg, 1, open), ax)),
  half: (ax, r, h, start, seg = 16) => cache(`h${ax}${r}|${h}|${start}|${seg}`, () => yTo(new THREE.CylinderGeometry(r, r, h, seg, 1, true, start, PI), ax)),
  torus: (ax, R, r, seg = 40, rad = 8, arc = PI * 2) => cache(`t${ax}${R}|${r}|${seg}|${rad}|${arc}`, () => zTo(new THREE.TorusGeometry(R, r, rad, seg, arc), ax)),
  sphere: (r, seg = 16) => cache(`s${r}|${seg}`, () => new THREE.SphereGeometry(r, seg, Math.max(6, seg * 0.6 | 0))),
  lathe: (ax, pts, seg = 32, key) => {
    const build = () => yTo(new THREE.LatheGeometry(pts.map(p => new THREE.Vector2(p[0], p[1])), seg), ax);
    return key ? cache('l' + ax + key + seg, build) : build();
  },
};
function hexBolt(len, d, ax = 'y') { // kop bij oorsprong, steel richting +as; steel 6 en ring 8 segmenten (golf 5b-2, G6: 80 in plaats van 128 driehoeken)
  return cache(`bolt${len}|${d}|${ax}`, () => {
    const head = new THREE.CylinderGeometry(d * 0.9, d * 0.9, d * 0.65, 6); head.translate(0, -d * 0.325, 0);
    const shank = new THREE.CylinderGeometry(d / 2, d / 2, len, 6); shank.translate(0, len / 2, 0);
    const washer = new THREE.CylinderGeometry(d * 1.05, d * 1.05, d * 0.12, 8); washer.translate(0, d * 0.06, 0);
    return yTo(merge([head, shank, washer]), ax);
  });
}
// schroefveer langs de as ax, gecentreerd op de oorsprong; per = punten per winding (standaard 14, minstens 24 punten in totaal).
// De cachesleutel krijgt per alleen als die afwijkt, zodat bestaande sleutels en aanroepen gelijk blijven.
function spring(R, wire, h, turns, ax = 'y', per = 14) {
  return cache(`sp${R}|${wire}|${h}|${turns}|${ax}` + (per !== 14 ? `|${per}` : ''), () => {
    const pts = []; const N = Math.max(24, Math.ceil(turns * per));
    for (let i = 0; i <= N; i++) { const t = i / N, a = t * turns * PI * 2; pts.push(V3(R * Math.cos(a), t * h - h / 2, R * Math.sin(a))); }
    return yTo(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), N, wire, 5, false), ax);
  });
}
function tube(points, r, seg = 64, rad = 10, closed = false) {
  const curve = new THREE.CatmullRomCurve3(points.map(p => Array.isArray(p) ? V3(...p) : p), closed, 'centripetal');
  return new THREE.TubeGeometry(curve, seg, r, rad, closed);
}

/* ---------- generieke onderdelen en bewerkingen (golf 5b-3, G8e) ---------- */
// profiel [r, y] van een balg voor G.lathe: n plooien over lengte len, straal loopt van r1 naar r2; elk tweede punt 5 mm naar binnen
function bellows(r1, r2, len, n) { const pts = []; for (let k = 0; k <= n * 2; k++) { const t = k / (n * 2); pts.push([lerp(r1, r2, t) - (k % 2 ? 0.005 : 0), t * len]); } return pts; }
// zeskantmoer: zeshoekig prisma met omgeschreven straal r en hoogte h langs as ax, gecentreerd op de oorsprong
function hexNut(ax, r, h) { return G.cyl(ax, r, r, h, 6); }
// slangklem: band (torus) met straal R rond as ax.
// Zonder schroef (standaard): dunne band met een slotblokje van 8 mm op +x in het lokale frame.
// Met schroef ({ screw: true }): bredere band met slothuis en stelschroef op +y; gebouwd rond as z en daarna naar ax gedraaid.
function hoseClamp(ax, R, o = {}) {
  if (!o.screw) return cache(`hcl${ax}${R}`, () => merge([G.torus(ax, R, 0.0018, 20, 4), xf(G.box(0.008, 0.008, 0.008), [R + 0.003, 0, 0])]));
  return cache(`hcls${ax}${R}`, () => zTo(merge([G.torus('z', R, 0.0022, 14, 5), xf(G.box(0.014, 0.006, 0.01), [0, R + 0.004, 0]), xf(G.cyl('x', 0.0025, 0.0025, 0.016, 6), [0, R + 0.007, 0])]), ax));
}
// openmodus: scharnier om een as; pivot in het frame van de ouder van de knoop (zelfde frame als p); extra voegt velden toe (min, label, look)
function hinge(pivot, axis, angle, extra) { return Object.assign({ type: 'hinge', pivot, axis, angle }, extra); }
// volger van een opener: beweegt met de stand van de leider om hetzelfde scharnier
function follow(lead, pivot, axis, angle, extra) { return Object.assign({ type: 'hinge', pivot, axis, angle, follow: lead }, extra); }
// veelhoek afsnijden op a*u + b*v <= c (Sutherland-Hodgman) met u en v de eerste twee coördinaten van elk punt;
// verdere coördinaten (bijvoorbeeld z) worden lineair meegenomen. Punten op de lijn blijven staan.
function clipPoly(poly, a, b, c) {
  const out = [];
  poly.forEach((P0, i) => {
    const Q = poly[(i + 1) % poly.length], dp = a * P0[0] + b * P0[1] - c, dq = a * Q[0] + b * Q[1] - c;
    if (dp <= 0) out.push(P0);
    if ((dp < 0 && dq > 0) || (dp > 0 && dq < 0)) { const t = dp / (dp - dq); out.push(P0.map((v, k) => v + (Q[k] - v) * t)); }
  });
  return out;
}
// naden gladtrekken, ook tussen losse vlakken: eerst de normalen weg (anders vallen punten op de naad niet samen),
// dan punten binnen tol samenvoegen en gladde normalen berekenen. Let op: haalt de normalen van g zelf weg.
function weldAll(g, tol = 1e-4) { g.deleteAttribute('normal'); const m = THREE.BufferGeometryUtils.mergeVertices(g, tol); m.computeVertexNormals(); return m; }
// punten op positie samenvoegen (1e-5) en gladde normalen met een knik boven drempel (radialen; 0,52 is 30 graden)
function creasedWeld(g, drempel) { return cleanG(THREE.BufferGeometryUtils.toCreasedNormals(THREE.BufferGeometryUtils.mergeVertices(g, 1e-5), drempel)); }
// n kopieën van fn() op een cirkel met straal r in het (y,z)-vlak rond middelpunt c, op langsplaats x; gecachet onder key
function ringPattern(key, n, r, fn, phase = 0, c = [0, 0], x = 0) {
  return cache(key, () => merge(Array.from({ length: n }, (_, k) => { const a = phase + k * PI * 2 / n; return xf(fn(), [x, c[0] + r * Math.cos(a), c[1] + r * Math.sin(a)]); })));
}
function shapeOf(pts) { const s = new THREE.Shape(); pts.forEach((p, i) => i ? s.lineTo(p[0], p[1]) : s.moveTo(p[0], p[1])); s.closePath(); return s; }
function circlePath(cx, cy, r) { const h = new THREE.Path(); h.absarc(cx, cy, r, 0, PI * 2, true); return h; }
function rrectPts(w, h, r, n = 4) {
  const pts = [], hw = w / 2, hh = h / 2;
  const cs = [[hw - r, hh - r, 0], [-hw + r, hh - r, HALF], [-hw + r, -hh + r, PI], [hw - r, -hh + r, PI * 1.5]];
  for (const [cx, cy, a0] of cs) for (let i = 0; i <= n; i++) { const a = a0 + i / n * HALF; pts.push([cx + r * Math.cos(a), cy + r * Math.sin(a)]); }
  return pts;
}
function extrude(shape, depth, curveSeg = 12) {
  const g = new THREE.ExtrudeGeometry(shape, { depth, bevelEnabled: false, curveSegments: curveSeg });
  g.translate(0, 0, -depth / 2);
  return g;
}
// rechthoek u0..u1 x v0..v1 (hoekpunten tegen de klok in) met weggesneden onderhoeken: elke [kant, u, v] in cut haalt
// het stuk onder v en voorbij u aan die kant (kant +1 of -1) weg
function notchRect(u0, u1, v0, v1, cut = []) {
  const R = cut.find(c => c[0] > 0 && c[1] < u1), L = cut.find(c => c[0] < 0 && c[1] > u0), p = [];
  p.push(L ? [L[1], v0] : [u0, v0]);
  if (R) p.push([R[1], v0], [R[1], R[2]], [u1, R[2]]); else p.push([u1, v0]);
  p.push([u1, v1], [u0, v1]);
  if (L) p.push([u0, L[2]], [L[1], L[2]]);
  return p;
}
// kussen of plaat uit één stuk met rondom afgeronde randen: rechthoekige omtrek poly (tegen de klok in, in het vlak u-v,
// buitenmaat), dikte t langs de derde as (gecentreerd), randstraal b; holle hoeken van de omtrek krijgen straal ri.
// Geen naden zoals bij losse blokken; de normalen zijn glad met een knik boven 30 graden.
// klein(i): optioneel; geeft hoek i de kleine afronding (4 mm) ook als die hol is (golf 5c-2, K8: was de lokale kopie intRoundPlate)
function roundPlate(poly, t, b, ri = 0.025, seg = 4, klein = null) {
  b = Math.min(b, t / 2 - 0.0008);
  const n = poly.length, unit = (a, c) => { const dx = c[0] - a[0], dy = c[1] - a[1], l = Math.hypot(dx, dy); return [dx / l, dy / l]; };
  // omtrek b naar binnen: de afronding van ExtrudeGeometry zet hem weer b naar buiten
  const ins = poly.map((P, i) => { const e1 = unit(poly[(i + n - 1) % n], P), e2 = unit(P, poly[(i + 1) % n]); return [P[0] - b * (e1[1] + e2[1]), P[1] + b * (e1[0] + e2[0])]; });
  const pts = [];
  ins.forEach((P, i) => {
    const d1 = unit(P, ins[(i + n - 1) % n]), d2 = unit(P, ins[(i + 1) % n]), convex = d1[0] * d2[1] - d1[1] * d2[0] < 0, r = convex || (klein && klein(i)) ? 0.004 : ri + b;
    const cx = P[0] + (d1[0] + d2[0]) * r, cy = P[1] + (d1[1] + d2[1]) * r, a1 = Math.atan2(-d2[1], -d2[0]);
    let da = Math.atan2(-d1[1], -d1[0]) - a1; while (da > PI) da -= 2 * PI; while (da < -PI) da += 2 * PI;
    for (let k = 0; k <= 3; k++) pts.push(new THREE.Vector2(cx + r * Math.cos(a1 + da * k / 3), cy + r * Math.sin(a1 + da * k / 3)));
  });
  const g = new THREE.ExtrudeGeometry(new THREE.Shape(pts), { depth: t - 2 * b, bevelEnabled: true, bevelThickness: b, bevelSize: b, bevelSegments: seg, curveSegments: 1 });
  g.translate(0, 0, -(t - 2 * b) / 2);
  // hoekpunten op positie samenvoegen (geïndexeerd), daarna gladde normalen met een knik boven 30 graden
  g.deleteAttribute('normal'); g.deleteAttribute('uv');
  return creasedWeld(g, 0.52);
}
// vorm in (x,z)-vlak, dikte langs y (bovenaanzicht)
function plan(shape, depth) { const g = extrude(shape, depth); g.rotateX(HALF); return g; }
// vorm in (z,y)-vlak, dikte langs x (zijaanzicht)
function side(shape, depth) { const g = extrude(shape, depth); g.rotateY(-HALF); return g; }
// vorm in (x,y)-vlak, dikte langs z (vooraanzicht)
function front(shape, depth) { return extrude(shape, depth); }
function gearShape(n, ro, rr, hole, inner) {
  const s = new THREE.Shape(), st = PI * 2 / n;
  for (let i = 0; i < n; i++) {
    const a = i * st;
    [[rr, a], [ro, a + 0.2 * st], [ro, a + 0.45 * st], [rr, a + 0.65 * st]].forEach(([r, t], j) => {
      const x = r * Math.cos(t), y = r * Math.sin(t);
      (i === 0 && j === 0) ? s.moveTo(x, y) : s.lineTo(x, y);
    });
  }
  s.closePath();
  if (hole > 0) s.holes.push(circlePath(0, 0, hole));
  return s;
}
function gear(n, ro, rr, w, hole = 0, ax = 'x') {
  return cache(`g${n}|${ro}|${rr}|${w}|${hole}|${ax}`, () => zTo(extrude(gearShape(n, ro, rr, hole), w, 6), ax));
}
function ringGear(n, rOut, rTip, rRoot, w, ax = 'x') {
  return cache(`rg${n}|${rOut}|${rTip}|${rRoot}|${w}|${ax}`, () => {
    const s = new THREE.Shape(); s.absarc(0, 0, rOut, 0, PI * 2, false);
    const h = new THREE.Path(), st = PI * 2 / n;
    for (let i = 0; i < n; i++) {
      const a = i * st;
      [[rRoot, a], [rTip, a + 0.2 * st], [rTip, a + 0.45 * st], [rRoot, a + 0.65 * st]].forEach(([r, t], j) => {
        const x = r * Math.cos(t), y = r * Math.sin(t);
        (i === 0 && j === 0) ? h.moveTo(x, y) : h.lineTo(x, y);
      });
    }
    h.closePath(); s.holes.push(h);
    return zTo(extrude(s, w, 24), ax);
  });
}
function annulus(rIn, rOut, t, ax = 'x', seg = 40) {
  return cache(`an${rIn}|${rOut}|${t}|${ax}|${seg}`, () => yTo(new THREE.LatheGeometry([[rIn, -t / 2], [rOut, -t / 2], [rOut, t / 2], [rIn, t / 2], [rIn, -t / 2]].map(p => new THREE.Vector2(...p)), seg), ax));
}
function hull(P) {
  P = P.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  up.pop(); lo.pop();
  return lo.concat(up);
}
function circlesHull(circles, grow) {
  const pts = [];
  circles.forEach(([a, b, r]) => { for (let i = 0; i < 56; i++) { const t = i / 56 * PI * 2; pts.push([a + (r + grow) * Math.cos(t), b + (r + grow) * Math.sin(t)]); } });
  return hull(pts);
}
// riem rond poelies in het (z,y)-vlak, breedte langs x
function beltGeo(circles, width, thick) {
  const outer = circlesHull(circles, thick), inner = circlesHull(circles, 0);
  const s = shapeOf(outer); s.holes.push(new THREE.Path(inner.map(p => new THREE.Vector2(p[0], p[1]))));
  return side(s, width);
}
function hullSolid(circles, grow, depth) { return side(shapeOf(circlesHull(circles, grow)), depth); }
function blades(n, rIn, rOut, h, t, twist, ax = 'x') { // waaier-/turbineschoepen rond as
  const list = [];
  for (let i = 0; i < n; i++) {
    const a = i / n * PI * 2;
    const b = new THREE.BoxGeometry(t, h, rOut - rIn);
    b.translate(0, 0, (rIn + rOut) / 2);
    b.rotateZ(twist);
    b.rotateY(a);
    list.push(b);
  }
  return yTo(merge(list), ax);
}
function quatFromTo(a, b) { return new THREE.Quaternion().setFromUnitVectors(a.clone().normalize(), b.clone().normalize()); }
// staaf/buis tussen twee punten (as Y gebouwd)
function rodBetween(a, b, r, seg = 12) {
  const A = V3(...a), B = V3(...b), d = B.clone().sub(A), L = d.length();
  const g = new THREE.CylinderGeometry(r, r, L, seg);
  g.applyQuaternion(quatFromTo(V3(0, 1, 0), d));
  const m = A.clone().add(B).multiplyScalar(0.5);
  g.translate(m.x, m.y, m.z);
  return g;
}

/* ---------- onderdelenboom ---------- */
const NODES = [];
let NID = 0;
function mkNode(obj, name, o) {
  const n = {
    id: NID++, name, d: o.d || '', spec: o.spec || null, obj, kids: [], parent: null, asm: false,
    ex: o.ex ? V3(...o.ex) : null, exs: o.exs != null ? o.exs : 1,
    amt: 0, target: 0, delay: 0, base: null, exv: V3(0, 0, 0), sys: null, depth: 0, count: 0, lc: null, rad: 0,
    inner: !!o.inner,  // ingesloten: onzichtbaar zolang de bovenliggende groep dicht is (de app verbergt het dan)
    opn: o.open || null,    // openmodus: scharnier of schuif (zie docs/ontwerp-en-architectuur.md, "Openmodus")
    strut: o.strut || null, // telescoop (gasveer) die de app tussen twee punten richt
    stay: !!o.stay,         // blijft op zijn plek als de opener erboven draait (carrosseriezijde van een scharnier)
    hideWhen: o.hideWhen || null, // openmodus: onzichtbaar zolang een van deze openers open is (uitgenomen, zoals de hoedenplank)
    uitsteek: o.uitsteek || 0    // meter die dit deel en zijn kinderen bewust voor of achter ZF..ZR uitsteken (trekhaak); integrity.py
  };
  obj.userData.node = n;
  if (o.p) obj.position.set(...o.p);
  if (o.r) obj.rotation.set(...o.r);
  if (o.q) obj.quaternion.copy(o.q);
  if (o.s) obj.scale.set(...o.s);
  NODES.push(n);
  return n;
}
function A(name, o = {}, kids = []) {
  const n = mkNode(new THREE.Group(), name, o);
  n.asm = true;
  [kids].flat(Infinity).forEach(k => k && addKid(n, k));
  return n;
}
function P(name, geo, m, o = {}) {
  const mesh = new THREE.Mesh(geo, m);
  mesh.userData.base = m;
  return mkNode(mesh, name, o);
}
function addKid(p, c) { p.kids.push(c); c.parent = p; p.obj.add(c.obj); }
const sideName = s => (s > 0 ? 'links' : 'rechts');
