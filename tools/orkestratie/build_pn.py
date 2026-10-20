"""Bouwt src/partnumbers.js en docs/onderdeelnummers.csv uit data/pn/, de canonieke, geverifieerde nummergegevens.

    python3 tools/orkestratie/build_pn.py             schrijft src/partnumbers.js en docs/onderdeelnummers.csv
    python3 tools/orkestratie/build_pn.py --check     bouwt in het geheugen en vergelijkt byte voor byte met de gecommitte
                                                      bestanden; exitcode 1 bij een verschil of een fout in de gegevens
    python3 tools/orkestratie/build_pn.py --out MAP   schrijft partnumbers.js en onderdeelnummers.csv naar MAP

Invoer (data/pn/): meta.json; units/<plak>.json (verkoopeenheden per onderzoeksplak, id -> record); map.json (pad zonder
wortel -> [eenheid, 'zelf' | 'deel' | 'set', regel]); info.json (pad -> [[label, waarde, bron, zekerheid]]); en data/tree.json
(alle paden van de boom, uit de pagina; de orkestrator ververst hem als de boom verandert).

De CSV is een platte projectie van dezelfde gegevens: één rij per pad en nummer, met per rij de eenheid (unit_id), alle bronnen
van de eenheid, variant, verpakking, regel, de gekozen uitvoering en de onderhoudsregels van het pad; paden zonder record staan
erin als "niet onderzocht". De kolommen staan beschreven in docs/onderdeelnummers-schema.md. Knoopnamen kunnen een schuine
streep bevatten (ABS/ESP-unit); de naam en de diepte van elke knoop worden daarom uit de boom afgeleid (de langste ouder die
zelf in de boom staat) en als eigen kolommen meegegeven, zodat een pad nooit gesplitst hoeft te worden.

De bouw stopt bij: een pad in map of info dat niet in de boom bestaat, een eenheid in map die niet bestaat, een eenheid die
nergens gebruikt wordt, een status buiten past, vin of nietgevonden, een gekozen uitvoering (kz) met een nummer dat niet in
de lijst van de eenheid staat, een bron die niet met https begint, of een bron met het scheidingsteken van de bronkolom.
De eenmalige migraties van golf 4 en 5 (RENAME, DROP, INHERIT, UNIT_FIX, VAR_FIX, VIN_KEUZE, ATTR_NL) zijn in de gegevens
verwerkt en beschreven in data/pn/README.md; dit script voert ze niet opnieuw uit. Het chassisnummer en het kenteken van de
gebruiker staan nooit in deze gegevens.
"""
import json, os, sys, csv, io, re, glob

HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(os.path.dirname(HERE))
DATA = os.path.join(REPO, 'data', 'pn')
AUTO = json.load(open(os.path.join(REPO, 'auto.json'), encoding='utf-8'))
ROOT = AUTO['wortel'] + '/'  # de wortel van de boom (auto.json)
# De notitie bij een eenheid (note) toont het paneel alleen als auto.json pnToelichting aanzet; anders blijft hij in data/pn
# en gaat hij niet mee naar de pagina (golf 5c-2, P1: scheelt bij de referentieauto circa 69 kB).
TOELICHTING = bool(AUTO.get('pnToelichting'))
SEP = '|'  # scheidingsteken binnen de kolommen bronnen en bronnen_keuze
HEADER = ("/* ===================== onderdeelnummers ===================== */\n"
          "// Gegevens, geen code. Gemaakt door de orkestrator uit de geverifieerde onderzoeksbestanden (build_pn.py); niet met de hand bewerken.\n"
          "// build.py zet het object als JSON in een eigen blok #pn (script van het type application/json); de pagina leest het pas als het\n"
          "// paneel of het zoeken op nummer het nodig heeft (uiPnLazy in app2-panel.js). In het geheugen heeft PN_DATA de vorm hieronder.\n"
          "// units: id -> { n, st: 'past' | 'vin' | 'nietgevonden', oe: [[nummer, opmerking, bewijs]], am: [[merk, nummer, opmerking, bewijs]],\n"
          "//                var, per, note (alleen met pnToelichting in auto.json), src: [[url, label]], kz }; bewijs A, B, C of D (zie het paneel).\n"
          "// kz (alleen bij een gekozen uitvoering voor de auto van de gebruiker): { o: [gekozen Renault-nummers], a: [[merk, nummer]], v: uitvoering, b: bewijs, z: zekerheid, g: grond, s: [bronnen] }.\n"
          "// map: pad zonder wortel -> [unit-id, 'zelf' | 'deel' | 'set', regel]. Een pad dat niet in map staat, is 'niet onderzocht'.\n"
          "//      In dit bestand staat map voorgecodeerd als lijst [p, rest, unit-id, relatie, regel?] in de volgorde van data/pn/map.json:\n"
          "//      het pad is de eerste p tekens van het vorige pad plus rest; een lege regel valt weg (uiPnDecode in app2-panel.js).\n"
          "// info: pad zonder wortel -> [[label, waarde, bron, zekerheid]] (onderhoud en bekende problemen).\n")


def front_code(pmap):
    """map als lijst met voorvoegselcodering: [gedeeld met het vorige pad, rest, eenheid, relatie, regel?]. Verliesloos en
    onafhankelijk van de volgorde van de boom (geen knoop-id's, die verschuiven bij elke nieuwe knoop); de volgorde blijft die
    van map.json, zodat de eerste 'zelf'-knoop per eenheid dezelfde blijft."""
    out, prev = [], ''
    for p, (uid, how, rule) in pmap.items():
        n, m = 0, min(len(p), len(prev))
        while n < m and p[n] == prev[n]:
            n += 1
        # p telt in UTF-16-eenheden, zoals String.slice in de pagina (een teken buiten het BMP telt dan voor twee)
        out.append([len(p[:n].encode('utf-16-le')) // 2, p[n:], uid, how] + ([rule] if rule else []))
        prev = p
    return out


# kolommen van docs/onderdeelnummers.csv; betekenis in docs/onderdeelnummers-schema.md
COLS = ['pad', 'naam', 'diepte', 'knoop', 'unit_id', 'verkoopeenheid', 'relatie', 'regel', 'status', 'soort', 'merk', 'nummer',
        'bewijs', 'opmerking', 'var', 'per', 'bronnen', 'gekozen', 'uitvoering_keuze', 'zekerheid_keuze', 'grond_keuze',
        'bronnen_keuze', 'info']
# statuslabel zoals het paneel het toont (kleine letters); None staat voor een pad zonder record
LABEL = {'past': 'past volgens catalogus', 'vin': 'variant: kies op VIN', 'nietgevonden': 'niet gevonden', None: 'niet onderzocht'}


def load(name):
    with open(os.path.join(DATA, name), encoding='utf-8') as f:
        return json.load(f)


def tree_names(paths):
    """Per pad de ouder (het langste kortere pad in de boom dat ervoor staat), de naam en de diepte. Een naam mag een
    schuine streep bevatten; daarom wordt niet op de streep gesplitst maar in de boom gezocht."""
    pset, out = set(paths), {}
    for p in paths:
        i, parent = p.rfind('/'), ''
        while i > 0:
            if p[:i] in pset: parent = p[:i]; break
            i = p.rfind('/', 0, i)
        out[p] = (parent, p[len(parent) + 1:] if parent else p)
    depth = {}
    for p in sorted(paths, key=len):
        parent = out[p][0]
        depth[p] = depth[parent] + 1 if parent else 1
    groups = set(out[p][0] for p in paths if out[p][0])
    return {p: {'parent': out[p][0], 'name': out[p][1], 'depth': depth[p], 'group': p in groups} for p in paths}


def build():
    meta = load('meta.json')
    tags = sorted(os.path.basename(f)[:-5] for f in glob.glob(os.path.join(DATA, 'units', '*.json')))
    tags = (['pilot'] if 'pilot' in tags else []) + [t for t in tags if t != 'pilot']
    units = {}
    for t in tags:
        for uid, u in load(os.path.join('units', t + '.json')).items():
            if not uid.startswith(t + ':'):
                sys.exit(f'eenheid {uid} staat in het verkeerde plakbestand {t}.json')
            units[uid] = u
    pmap, info = load('map.json'), load('info.json')
    with open(os.path.join(REPO, 'data', 'tree.json'), encoding='utf-8') as f:
        paths = set(p[len(ROOT):] for p in json.load(f) if p.startswith(ROOT))
    errs = []
    for p, (uid, how, rule) in pmap.items():
        if p not in paths: errs.append(f'map: pad bestaat niet in de boom: {p}')
        if uid not in units: errs.append(f'map: eenheid bestaat niet: {uid} ({p})')
        if how not in ('zelf', 'deel', 'set'): errs.append(f'map: relatie {how} bij {p}')
    for p in info:
        if p not in paths: errs.append(f'info: pad bestaat niet in de boom: {p}')
    used = set(v[0] for v in pmap.values())
    for uid, u in units.items():
        if uid not in used: errs.append(f'eenheid wordt nergens gebruikt: {uid}')
        if u.get('st') not in ('past', 'vin', 'nietgevonden'): errs.append(f'status {u.get("st")} bij {uid}')
        for url, _ in u.get('src', []):
            if not re.match(r'^https://', url): errs.append(f'bron zonder https bij {uid}: {url}')
            if SEP in url or ' ' in url: errs.append(f'bron met {SEP!r} of spatie bij {uid}: {url}')
        kz = u.get('kz')
        if kz:
            for nr in kz.get('o', []):
                if nr not in [x[0] for x in u['oe']]: errs.append(f'kz: Renault-nummer {nr} staat niet in {uid}')
            for brand, nr in kz.get('a', []):
                if [brand, nr] not in [[x[0], x[1]] for x in u['am']]: errs.append(f'kz: {brand} {nr} staat niet in {uid}')
            if any(not re.match(r'^https://', x) or SEP in x or ' ' in x for x in kz.get('s', [])): errs.append(f'kz: bron zonder https of met {SEP!r} in {uid}')
    if errs:
        for e in errs[:40]: print('FOUT ' + e, file=sys.stderr)
        sys.exit(f'{len(errs)} fouten in data/pn')
    page_units = units if TOELICHTING else {uid: {k: v for k, v in u.items() if k != 'note'} for uid, u in units.items()}
    data = {'meta': meta, 'units': page_units, 'map': front_code(pmap), 'info': info}
    js = HEADER + 'const PN_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n'
    # CSV: alle paden van de boom, gesorteerd; per pad één rij per nummer, of één rij zonder nummer
    nodes = tree_names(paths)
    buf = io.StringIO()
    w = csv.writer(buf, delimiter=';', lineterminator='\r\n')
    w.writerow(COLS)
    nrows, urls = 0, set()
    for p in sorted(paths):
        nd = nodes[p]
        inf = ' | '.join(f'{l}: {v} ({z}; {b})' if b else f'{l}: {v} ({z})' for l, v, b, z in info.get(p, []))
        base = {'pad': p, 'naam': nd['name'], 'diepte': nd['depth'], 'knoop': 'groep' if nd['group'] else 'onderdeel', 'info': inf}
        if p not in pmap:
            w.writerow([base.get(c, '') if c != 'status' else LABEL[None] for c in COLS]); nrows += 1
            continue
        uid, how, rule = pmap[p]
        u, kz = units[uid], units[uid].get('kz')
        base.update({'unit_id': uid, 'verkoopeenheid': u['n'], 'relatie': how, 'regel': rule or '',
                     'status': 'gekozen voor deze auto' if (u['st'] == 'vin' and kz) else LABEL[u['st']],
                     'var': u.get('var', ''), 'per': u.get('per', ''), 'bronnen': SEP.join(x[0] for x in u['src'])})
        urls.update(x[0] for x in u['src'])
        if kz:
            base.update({'uitvoering_keuze': kz.get('v', ''), 'zekerheid_keuze': kz.get('z', ''), 'grond_keuze': kz.get('g', ''),
                         'bronnen_keuze': SEP.join(kz.get('s', []))})
            urls.update(kz.get('s', []))
        rows = [['Renault', 'Renault', x[0], x[2], x[1]] for x in u['oe']] + [['fabrikant', x[0], x[1], x[3], x[2]] for x in u['am']]
        if not rows:
            w.writerow([base.get(c, '') for c in COLS]); nrows += 1
        for soort, merk, nr, lvl, note in rows:
            gek = bool(kz) and ((soort == 'Renault' and nr in kz['o']) or (soort == 'fabrikant' and [merk, nr] in kz['a']))
            r = dict(base, soort=soort, merk=merk, nummer=nr, bewijs=lvl, opmerking=note, gekozen='ja' if gek else '')
            w.writerow([r.get(c, '') for c in COLS]); nrows += 1
    csvtxt = buf.getvalue()
    nummers = sum(len(u['oe']) + len(u['am']) for u in units.values())
    stats = {
        'paden_in_boom': len(paths), 'paden_met_regel': len(pmap),
        'paden_met_nummer': sum(1 for p, (uid, h, r) in pmap.items() if units[uid]['oe'] or units[uid]['am']),
        'eenheden': len(units), 'eenheden_met_keuze': sum(1 for u in units.values() if u.get('kz')),
        'nummers': nummers,
        'bronnen_per_nummer': round(sum(len(u['src']) for u in units.values()) / max(1, nummers), 3),
        'bronnen_uniek': len(set(x[0] for u in units.values() for x in u['src'])), 'bronnen_uniek_in_csv': len(urls),
        'bronnen_met_page': len(set(x[0] for u in units.values() for x in u['src'] if '?page=' in x[0])),
        'info_paden': len(info), 'csv_rijen': nrows, 'namen_met_schuine_streep': sum(1 for n in nodes.values() if '/' in n['name']),
        'bytes_js': len(js.encode('utf-8')), 'bytes_csv': len(csvtxt.encode('utf-8'))}
    return js, csvtxt, stats


def main(argv):
    js, csvtxt, stats = build()
    out = REPO
    if '--out' in argv:
        out = argv[argv.index('--out') + 1]
        os.makedirs(os.path.join(out, 'src'), exist_ok=True); os.makedirs(os.path.join(out, 'docs'), exist_ok=True)
    pj, pc = os.path.join(out, 'src', 'partnumbers.js'), os.path.join(out, 'docs', 'onderdeelnummers.csv')
    if '--check' in argv:
        same_js = open(os.path.join(REPO, 'src', 'partnumbers.js'), 'rb').read() == js.encode('utf-8')
        same_csv = open(os.path.join(REPO, 'docs', 'onderdeelnummers.csv'), 'rb').read() == csvtxt.encode('utf-8')
        print(json.dumps(stats, ensure_ascii=False))
        print('partnumbers.js gelijk:', same_js, '| onderdeelnummers.csv gelijk:', same_csv)
        return 0 if same_js and same_csv else 1
    with open(pj, 'w', encoding='utf-8', newline='') as f: f.write(js)
    with open(pc, 'w', encoding='utf-8', newline='') as f: f.write(csvtxt)
    print(json.dumps(stats, ensure_ascii=False, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
