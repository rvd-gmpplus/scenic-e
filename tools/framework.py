"""Framework voor explosietekeningen: controleren, exporteren, vergelijken en een nieuwe auto opzetten (docs/framework.md).

    python3 tools/framework.py check                 generieke bestanden bestaan en noemen deze auto niet (auto.json: verboden),
                                                     auto.json heeft elk veld dat head.html en de code vragen
    python3 tools/framework.py vergelijk DOEL        per generiek bestand: gelijk, afwijkend of ontbrekend in de repo DOEL
    python3 tools/framework.py export DOEL [--droog] kopieert de generieke bestanden naar DOEL (raakt de autobestanden niet)
    python3 tools/framework.py nieuw DOEL --id ID --wortel "Merk Model" [--merk Merk]
                                                     zet een nieuwe auto op: generiek, sjablonen en een minimale beginauto die
                                                     bouwt en de rooktest haalt (DOEL moet leeg zijn of niet bestaan)
    python3 tools/framework.py extra-namen           namen van de extra tests uit auto.json (extraTests), op een regel,
                                                     gescheiden door spaties; niets als het veld ontbreekt; exit 1 bij een
                                                     ongeldig veld (finaltests.sh gebruikt dit)
    python3 tools/framework.py extra NAAM UITMAP     voert de extra test NAAM uit vanuit de repowortel, met {uit} = UITMAP
                                                     (absoluut) en {root} = de repowortel in het commando; geeft de exitcode
                                                     van het commando ongewijzigd door, 2 bij een onbekende naam

Exitcode 1 bij een fout. De lijsten staan in framework.json; deze repo is de bron.
Extra tests: optioneel veld extraTests in auto.json, een lijst {"naam": ..., "cmd": [...], "uitleg": ...} (docs/framework.md).
"""
import sys, os, re, json, shutil, subprocess, filecmp

HERE = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))


def load(path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


MAN = load(os.path.join(HERE, 'framework.json'))


def files(kind):
    return [p for p in MAN[kind] if not p.endswith('/')]


def commit():
    r = subprocess.run(['git', '-C', HERE, 'rev-parse', '--short', 'HEAD'], capture_output=True, text=True)
    return r.stdout.strip() or 'onbekend'


# velden die de generieke laag uit auto.json leest: {{veld}} in head.html en AUTO.veld in de JavaScript
def wanted_fields():
    head = open(os.path.join(HERE, 'src', 'head.html'), encoding='utf-8').read()
    out = set(re.findall(r'\{\{(\w+)\}\}', head))
    for f in files('generiek'):
        if f.startswith('src/') and f.endswith('.js'):
            out |= set(re.findall(r'\bAUTO\.(\w+)', open(os.path.join(HERE, f), encoding='utf-8').read()))
    return sorted(out)


EXTRA_NAAM = re.compile(r'^[a-z][a-z0-9_-]*$')


def vaste_tests():
    """De vaste testnamen uit de TESTS-regel van finaltests.sh (de enige bron; CI bewaakt die regel)."""
    txt = open(os.path.join(HERE, 'tools', 'orkestratie', 'finaltests.sh'), encoding='utf-8').read()
    m = re.search(r'^TESTS="([^"]*)"', txt, re.M)
    return m.group(1).split() if m else []


def extra_tests():
    """(lijst extraTests uit auto.json, fouten); zonder het veld een lege lijst. Controleert de vorm, niet of bestanden bestaan."""
    try:
        a = load(os.path.join(HERE, 'auto.json'))
    except (OSError, ValueError) as e:
        return [], [f'auto.json is niet te lezen: {e}']
    if 'extraTests' not in a:
        return [], []
    et, fails = a['extraTests'], []
    if not isinstance(et, list):
        return [], ['auto.json: extraTests moet een lijst zijn']
    vast, gezien, ok = vaste_tests(), set(), []
    for i, t in enumerate(et):
        wie = f'auto.json: extraTests[{i}]'
        if not isinstance(t, dict):
            fails.append(f'{wie} moet een object zijn'); continue
        naam, cmd = t.get('naam'), t.get('cmd')
        if isinstance(naam, str):
            wie = f'auto.json: extra test "{naam}"'
        for k in t:
            if k not in ('naam', 'cmd', 'uitleg'):
                fails.append(f'{wie} heeft een onbekend veld "{k}" (toegestaan: naam, cmd, uitleg)')
        if 'uitleg' in t and not isinstance(t['uitleg'], str):
            fails.append(f'{wie}: uitleg moet tekst zijn')
        good = True
        if not isinstance(naam, str) or not EXTRA_NAAM.match(naam):
            fails.append(f'{wie}: naam moet passen op ^[a-z][a-z0-9_-]*$'); good = False
        elif naam in gezien:
            fails.append(f'{wie}: naam komt dubbel voor'); good = False
        elif naam in vast:
            fails.append(f'{wie}: naam botst met een vaste test van finaltests.sh ({" ".join(vast)})'); good = False
        if isinstance(naam, str):
            gezien.add(naam)
        if not isinstance(cmd, list) or not cmd or not all(isinstance(c, str) and c for c in cmd):
            fails.append(f'{wie}: cmd moet een niet-lege lijst van teksten zijn'); good = False
        if good:
            ok.append(t)
    return ok if not fails else [], fails


def extra_paden(cmd):
    """tools/...-paden in een extra commando (ook als {root}/tools/...)."""
    return [c for c in cmd if re.match(r'^(\{root\}/|\./)?tools/', c)]


def extra_namen():
    et, fails = extra_tests()
    if fails:
        print('extra tests ongeldig:\n  ' + '\n  '.join(fails), file=sys.stderr)
        return 1
    print(' '.join(t['naam'] for t in et), end='\n' if et else '')
    return 0


def extra(naam, uit):
    et, fails = extra_tests()
    if fails:
        print('extra tests ongeldig:\n  ' + '\n  '.join(fails), file=sys.stderr)
        return 1
    t = next((t for t in et if t['naam'] == naam), None)
    if t is None:
        print(f'onbekende extra test "{naam}"; bekend: {" ".join(x["naam"] for x in et) or "(geen)"}', file=sys.stderr)
        return 2
    uit = os.path.abspath(uit)
    cmd = [c.replace('{uit}', uit).replace('{root}', HERE) for c in t['cmd']]
    os.chdir(HERE)
    sys.stdout.flush(); sys.stderr.flush()
    try:
        os.execvp(cmd[0], cmd)
    except OSError as e:
        print(f'extra test "{naam}": kan {cmd[0]} niet starten: {e}', file=sys.stderr)
        return 127


def check():
    fails = []
    a = load(os.path.join(HERE, 'auto.json'))
    et, efails = extra_tests()
    fails += efails
    if not efails:
        for t in et:
            for c in extra_paden(t['cmd']):
                if not os.path.exists(os.path.join(HERE, c.replace('{root}/', '', 1))):
                    fails.append(f'auto.json: extra test "{t["naam"]}" noemt {c}, dat bestaat niet')
    for k in wanted_fields():
        if k not in a:
            fails.append(f'auto.json mist het veld {k}')
    terms = a.get('verboden', [])
    for f in files('generiek'):
        p = os.path.join(HERE, f)
        if not os.path.exists(p):
            fails.append(f'generiek bestand ontbreekt: {f}')
            continue
        if f.endswith('.md') or f == 'framework.json':
            continue  # de documenten en het manifest noemen de referentie-auto's bij naam (voorbeeld, bron)
        txt = open(p, encoding='utf-8', errors='replace').read()
        for t in terms:
            for m in re.finditer(re.escape(t), txt):
                line = txt.count('\n', 0, m.start()) + 1
                fails.append(f'{f}:{line} noemt "{t}" (autospecifiek; hoort in auto.json of een autobestand)')
    # alles wat build.py in de pagina zet, staat in een van de lijsten
    order = re.search(r"ORDER = \[([^\]]*)\]", open(os.path.join(HERE, 'build.py'), encoding='utf-8').read()).group(1)
    known = set(MAN['generiek']) | set(MAN['auto'])
    for name in re.findall(r"'([^']+)'", order):
        if 'src/' + name not in known:
            fails.append(f'src/{name} staat in ORDER maar niet in framework.json')
    print(f'framework {MAN["versie"]}: {len(files("generiek"))} generieke bestanden, {len(wanted_fields())} velden uit auto.json'
          + (f', {len(et)} extra tests ({" ".join(t["naam"] for t in et)})' if et and not efails else ''))
    print('framework: ok' if not fails else 'framework: FOUT\n  ' + '\n  '.join(fails[:60]))
    return 1 if fails else 0


def compare(dst):
    rows, diff = [], 0
    for f in files('generiek'):
        a, b = os.path.join(HERE, f), os.path.join(dst, f)
        if not os.path.exists(b):
            rows.append(f'  ontbreekt   {f}'); diff += 1
        elif not filecmp.cmp(a, b, shallow=False):
            la, lb = open(a, encoding='utf-8', errors='replace').read().splitlines(), open(b, encoding='utf-8', errors='replace').read().splitlines()
            import difflib
            n = sum(1 for l in difflib.unified_diff(la, lb, lineterm='', n=0) if l[:1] in '+-' and l[:3] not in ('+++', '---'))
            rows.append(f'  afwijkend   {f} ({n} regels)'); diff += 1
        else:
            rows.append(f'  gelijk      {f}')
    fw = os.path.join(dst, 'FRAMEWORK')
    print(f'{dst}: framework {open(fw).read().strip() if os.path.exists(fw) else "nooit geëxporteerd"}; bron nu {MAN["versie"]} ({commit()})')
    print('\n'.join(rows))
    print(f'{diff} van {len(files("generiek"))} generieke bestanden wijken af of ontbreken')
    return 1 if diff else 0


def export(dst, dry):
    if not os.path.exists(os.path.join(dst, 'auto.json')):
        print(f'{dst} heeft geen auto.json: maak die eerst (zie docs/framework.md, stap 2) of gebruik "nieuw"')
        return 1
    n = 0
    for f in files('generiek'):
        a, b = os.path.join(HERE, f), os.path.join(dst, f)
        if os.path.exists(b) and filecmp.cmp(a, b, shallow=False):
            continue
        print(('zou kopiëren ' if dry else 'kopieer ') + f)
        n += 1
        if not dry:
            os.makedirs(os.path.dirname(b) or '.', exist_ok=True)
            shutil.copy2(a, b)
    if not dry:
        with open(os.path.join(dst, 'FRAMEWORK'), 'w') as fh:
            fh.write(f'{MAN["versie"]} ({MAN["bron"]} {commit()})\n')
    print(f'{n} bestanden {"te kopiëren" if dry else "gekopieerd"}; autobestanden niet aangeraakt. Daarna in DOEL: python3 build.py en de testset.')
    return 0


# minimale beginauto: acht hoofdgroepen met elk een blok op de plek waar het in een auto zit, zodat bouwen, de rooktest en
# de framework-controle direct slagen; de domeineigenaars vervangen elk bestand door het echte werk
GROUPS = [  # naam, bestand, functie, maat (x, y, z), plek, uitklapvector
    ('Carrosserie', 'body.js', 'buildBody', (1.8, 0.9, 4.2), (0, 0.95, 0), (0, 1.9, 0.1)),
    ('Interieur', 'interior.js', 'buildInterior', (1.4, 0.5, 1.8), (0, 0.75, -0.2), (0, 0.85, -0.2)),
    ('Aandrijflijn', 'engine1.js', 'buildPowertrain', (0.7, 0.5, 0.6), (0, 0.6, 1.4), (0, 0.45, 1.25)),
    ('Onderstel', 'chassis.js', 'buildChassis', (1.6, 0.25, 3.4), (0, 0.3, 0), (0, -0.55, 0)),
    ('Koeling en luchtinlaat', 'systems.js', 'buildCooling', (0.6, 0.4, 0.1), (0, 0.6, 1.9), (0, 0.25, 2.0)),
    ('Uitlaatsysteem', 'systems.js', 'buildExhaust', (0.15, 0.1, 2.8), (0.3, 0.25, -0.6), (0.4, -1.5, -0.6)),
    ('Brandstofsysteem', 'systems.js', 'buildFuel', (0.8, 0.25, 0.5), (-0.2, 0.3, -1.0), (-0.75, -0.95, -0.3)),
    ('Elektrisch systeem', 'systems.js', 'buildElectrical', (0.3, 0.2, 0.2), (0.45, 0.75, 1.5), (0.4, 0.6, 0.9)),
]


def scaffold_js(wortel):
    by = {}
    for name, fn, func, size, pos, ex in GROUPS:
        by.setdefault(fn, []).append(
            f"function {func}() {{\n"
            f"  // beginauto: één blok als plaatshouder; de eigenaar van {fn} vervangt dit door de echte onderdelen\n"
            f"  return A('{name}', {{ d: 'Plaatshouder voor de hoofdgroep {name}.', ex: [{ex[0]}, {ex[1]}, {ex[2]}] }}, [\n"
            f"    P('{name} (plaatshouder)', G.box({size[0]}, {size[1]}, {size[2]}), MAT.plasticGrey, {{ d: 'Blok op de plek van de hoofdgroep; wordt vervangen.', p: [{pos[0]}, {pos[1]}, {pos[2]}], ex: [0, 0.2, 0] }}),\n"
            f"  ]);\n}}\n")
    # Onderstel heeft in elk model precies deze vier kinderen (contract §6)
    by['chassis.js'] = [
        "function buildChassis() {\n"
        "  // beginauto: de vier vaste kinderen van Onderstel als plaatshouders; de eigenaar van chassis.js vervangt ze\n"
        "  const ph = (name, size, pos) => A(name, { d: 'Plaatshouder voor ' + name + '.' }, [P(name + ' (plaatshouder)', G.box(...size), MAT.plasticGrey, { d: 'Blok op de plek van ' + name + '; wordt vervangen.', p: pos, ex: [0, -0.2, 0] })]);\n"
        "  return A('Onderstel', { d: 'Plaatshouder voor het onderstel.', ex: [0, -0.55, 0] }, [\n"
        "    ph('Vooras en stuurinrichting', [1.4, 0.15, 0.3], [0, 0.3, 1.3]), ph('Achteras', [1.4, 0.15, 0.3], [0, 0.3, -1.3]),\n"
        "    ph('Wielen', [1.7, 0.6, 0.3], [0, 0.3, 0]), ph('Remsysteem', [0.3, 0.1, 0.3], [0, 0.2, 0.6]),\n"
        "  ]);\n}\n"]
    by['systems.js'].append(
        "function buildCar() {\n"
        "  // de wortel heet zoals auto.json zegt (AUTO.wortel) en heeft precies de acht hoofdgroepen, in deze volgorde\n"
        f"  return A(AUTO.wortel, {{ d: 'Beginauto van het framework: acht plaatshouders. Klik op een onderdeel om het uit te klappen.' }},\n"
        "    [buildBody(), buildInterior(), buildPowertrain(), buildChassis(), buildCooling(), buildExhaust(), buildFuel(), buildElectrical()]);\n}\n")
    return by


def new(dst, cid, wortel, merk):
    if os.path.exists(dst) and os.listdir(dst):
        print(f'{dst} is niet leeg; "nieuw" schrijft alleen in een lege map')
        return 1
    for f in files('generiek') + files('sjabloon'):
        a, b = os.path.join(HERE, f), os.path.join(dst, f)
        if os.path.exists(a):
            os.makedirs(os.path.dirname(b) or '.', exist_ok=True)
            shutil.copy2(a, b)
    a = load(os.path.join(HERE, 'auto.json'))
    model = wortel.split(' ', 1)[1] if ' ' in wortel else wortel
    na = {'_uitleg': a['_uitleg'], 'id': cid, 'hook': '__model', 'merk': merk or wortel.split(' ')[0], 'wortel': wortel,
          'titel': f'{model} explosietekening', 'h1': model, 'h1sub': 'uitvoering', 'sub': 'bouwjaar · carrosserie · kleur · <b>motor</b>',
          'beschrijving': f'Interactieve 3D-explosietekening van een {wortel}.', 'ogBeschrijving': f'Interactieve 3D-explosietekening van een {wortel}.',
          'ogBeeld': '', 'canvasLabel': f'3D-explosietekening van een {wortel}. Klik op een onderdeel om het uit te klappen.',
          'notitie': 'Schematisch 3D-model: vormen, maten en posities zijn benaderd en niet geschikt als montagevoorschrift.',
          'openUitleg': f'{wortel}. Openen: klik op een deel dat opengaat; nog een klik sluit het weer.',
          'pnType': 'type nog vast te stellen', 'hintVersie': 'v1', 'pnToelichting': False, 'docshots': [['gemonteerd', 'assembled'], ['hoofdgroepen', 'main'], ['alles-uit-elkaar', 'everything']], 'verboden': [model]}
    for k in wanted_fields():
        na.setdefault(k, '')
    with open(os.path.join(dst, 'auto.json'), 'w', encoding='utf-8') as f:
        json.dump(na, f, ensure_ascii=False, indent=2)
    open(os.path.join(dst, 'VERSION'), 'w').write('1\n')
    src = os.path.join(dst, 'src')
    js = scaffold_js(wortel)
    js['body.js'].insert(0, "// hoofdmaten in het autoframe (contract §2); de generieke tests lezen ze. Vervang ze door de gemeten waarden.\n"
                            "const ZF = 2.1, ZR = -2.1, AXF = 1.3, AXR = -1.3;\n"
                            "const BOD_WMAX = 0.9, BOD_MIRW = 1.0, BOD_H = 1.45;\n")
    for name in ['body.js', 'bodyparts.js', 'panorama.js', 'engine1.js', 'engine2.js', 'engine3.js', 'drivetrain.js', 'chassis.js', 'interior.js', 'systems.js']:
        with open(os.path.join(src, name), 'w', encoding='utf-8') as f:
            f.write(f'/* ===================== {name}: beginauto van het framework, wordt vervangen door de domeineigenaar ===================== */\n')
            f.write(''.join(js.get(name, [])))
    with open(os.path.join(src, 'partnumbers.js'), 'w', encoding='utf-8') as f:
        f.write('/* onderdeelnummers: nog leeg (tools/orkestratie/build_pn.py vult dit uit data/pn/) */\nconst PN_DATA = { units: {}, map: {}, info: {}, meta: {} };\n')
    with open(os.path.join(src, 'presetdata.js'), 'w', encoding='utf-8') as f:
        f.write("/* ===================== presetgegevens van deze auto (de motor en de uitleg van de velden staan in presets.js) ===================== */\n"
                "const appCar = AUTO.wortel;   // de wortel van de boom (auto.json)\n"
                "const appCats = ['Overzicht', 'Motor', 'Aandrijving', 'Onderstel', 'Carrosserie', 'Interieur', 'Openen'];\n"
                "const PRESETS = [\n"
                "  { id: 'assembled', cat: 'Overzicht', label: 'Gemonteerd', key: '0', note: 'De hele auto, alles dicht.', cam: { dir: [1, 0.45, 1.1], pad: 1.05 } },\n"
                "  { id: 'main', cat: 'Overzicht', label: 'Hoofdgroepen', key: '1', note: 'De acht hoofdgroepen uit elkaar.', open: [appCar], labels: appCar, cam: { dir: [1, 0.5, 1.08], pad: 1.04 } },\n"
                "  { id: 'tour', cat: 'Overzicht', label: 'Rondleiding', note: 'Alle stappen achter elkaar.', tour: true },\n"
                "];\n"
                "const appTourSteps = ['assembled', 'main', 'assembled'];\n")
    main = [g[0] for g in GROUPS]
    # ankers, verwachte aantallen en budgetten (contract §6 en §8); elk ander veld bovenaan is een lijst ankers
    a8 = {'root': [wortel], 'main': main, 'root_children_order': main, 'onderstel_children': ['Vooras en stuurinrichting', 'Achteras', 'Wielen', 'Remsysteem'], 'contains': [], 'content': {},
          'openers': [], 'preset_ids': ['assembled', 'main', 'tour'],
          'triangle_budgets': {'_uitleg': 'driehoeken per hoofdgroep (tri.py --gate)', 'totaal': 700000}}
    with open(os.path.join(dst, 'tools', 'anchors.json'), 'w', encoding='utf-8') as f:
        json.dump(a8, f, ensure_ascii=False, indent=1)
    with open(os.path.join(dst, 'tools', 'open_allow.json'), 'w', encoding='utf-8') as f:
        f.write('[]\n')
    os.makedirs(os.path.join(dst, 'data', 'pn'), exist_ok=True)
    json.dump({'_uitleg': 'Silhouet van deze auto, nog te meten (docs/framework.md, stap 3).', 'top': [], 'plan': [], 'belt': [], 'axf': 1.3, 'axr': -1.3,
               'neusMax': 9, 'staartMax': 9, 'tolAs': 0.03, 'tolOverhang': 0.05, 'maxBuiten': 2},
              open(os.path.join(dst, 'data', 'silhouet.json'), 'w'), indent=1)
    with open(os.path.join(dst, 'FRAMEWORK'), 'w') as fh:
        fh.write(f'{MAN["versie"]} ({MAN["bron"]} {commit()})\n')
    print(f'nieuwe auto in {dst}: {len(files("generiek"))} generieke bestanden, sjablonen, auto.json en een beginauto met acht plaatshouders.')
    print('Volgende stappen: docs/framework.md, vanaf stap 2. Eerst: python3 build.py && python3 tools/smoke.py')
    return 0


def main(argv):
    if not argv or argv[0] in ('-h', '--help'):
        print(__doc__); return 0
    cmd, rest = argv[0], argv[1:]
    if cmd == 'check':
        return check()
    if cmd == 'extra-namen':
        return extra_namen()
    if cmd == 'extra':
        if len(rest) != 2:
            print('extra vraagt NAAM en UITMAP'); return 2
        return extra(rest[0], rest[1])
    if cmd == 'vergelijk' and rest:
        return compare(os.path.abspath(rest[0]))
    if cmd == 'export' and rest:
        return export(os.path.abspath(rest[0]), '--droog' in rest)
    if cmd == 'nieuw' and rest:
        def opt(k):
            return rest[rest.index(k) + 1] if k in rest and rest.index(k) + 1 < len(rest) else None
        if not opt('--id') or not opt('--wortel'):
            print('nieuw vraagt --id en --wortel'); return 2
        return new(os.path.abspath(rest[0]), opt('--id'), opt('--wortel'), opt('--merk'))
    print(__doc__); return 2


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
