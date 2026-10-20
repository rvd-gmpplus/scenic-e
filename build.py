"""Bouwt index.html uit src/ en controleert de broncode.

Gebruik:
  python3 build.py                 schrijft index.html: een volledig document met doctype en viewport-regel (GitHub Pages), three.js via CDN
  python3 build.py --bare BESTAND  schrijft ook de kale pagina zonder documentgeraamte naar BESTAND (het artefact: de host zet er zelf een geraamte omheen)
  python3 build.py MAP             schrijft ook MAP/index.html die three.js uit MAP/three/ laadt
  python3 build.py --lint          controleert alleen, schrijft niets
  python3 build.py --test-only MAP schrijft alleen MAP/index.html (gebruikt door de tests; laat index.html ongemoeid)

Controles (de bouw stopt bij een fout):
  - dubbele functienamen op het hoogste niveau over alle bestanden (die zouden elkaar stil overschrijven)
  - dubbele materiaalnamen in std()/phys()
  - teksten in `d:`, `spec:`, `note:` en `label:` (R1, R2, R4, R5 fouten) en cachesleutels zonder voorvoegsel van het bestand (R7, fout): zie lint_texts()
  - syntaxis van het samengevoegde script via `node --check` (vangt ook dubbele const/let), en van elk inline script in head.html

De scripttags van three.js krijgen integrity (sha384) en crossorigin="anonymous"; de hash komt uit het lokale npm-pakket
(THREE_DIR of ~/.cache/explosietekening/three-0.147.0/package, zie tools/harness.py --ensure-three). Ontbreekt dat, dan stopt de bouw.
"""
import os, re, sys, json, shutil, subprocess, tempfile, hashlib, base64

HERE = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(HERE, 'src')
ORDER = ['core.js', 'body.js', 'bodyparts.js', 'panorama.js', 'engine1.js', 'engine2.js', 'engine3.js', 'drivetrain.js', 'chassis.js', 'interior.js', 'systems.js', 'partnumbers.js', 'app1.js', 'presetdata.js', 'presets.js', 'app2-panel.js', 'app2-controls.js', 'app2-labels.js', 'app2-input.js', 'app2-loop.js']
LIBS = ['build/three.min.js', 'examples/js/controls/OrbitControls.js', 'examples/js/environments/RoomEnvironment.js', 'examples/js/geometries/RoundedBoxGeometry.js', 'examples/js/utils/BufferGeometryUtils.js']
THREE_VERSION = '0.147.0'  # r147: de laatste three.js met de niet-module examples/js (OrbitControls enz.)
CDN = f'https://cdn.jsdelivr.net/npm/three@{THREE_VERSION}/'


def three_dir():
    """Map met het uitgepakte npm-pakket three@THREE_VERSION (dezelfde padlogica als tools/harness.py: THREE_DIR, anders de
    cache van `python3 tools/harness.py --ensure-three`)."""
    d = os.environ.get('THREE_DIR')
    if d and os.path.isfile(os.path.join(d, 'build', 'three.min.js')):
        return d
    return os.path.expanduser(f'~/.cache/explosietekening/three-{THREE_VERSION}/package')


def integrity(lib):
    """R5: sha384-integriteit van een CDN-bestand, berekend uit het lokale npm-pakket (tools/pubsmoke.py bewaakt dat de CDN
    byte voor byte hetzelfde levert). Zonder pakket stopt de bouw: een pagina zonder integrity zou stil anders zijn."""
    path = os.path.join(three_dir(), lib)
    if not os.path.isfile(path):
        raise SystemExit(f'three.js-bestand {path} ontbreekt voor de integriteitshash; haal het pakket op met: python3 tools/harness.py --ensure-three')
    with open(path, 'rb') as f:
        return 'sha384-' + base64.b64encode(hashlib.sha384(f.read()).digest()).decode()


def read(name):
    with open(os.path.join(SRC, name), encoding='utf-8') as f:
        return f.read()


# ---------------------------------------------------------------------------------------------------------------------
# Tekstcontrole en sleutelvoorvoegsels (golf 5b-3, besluit G9e: Nederlandse notatie).
# lint_texts() leest alleen de stringwaarden van `d:`, `spec:`, `note:` en `label:` in de bronbestanden; commentaar en ${...} in sjablonen worden
# overgeslagen. Regels:
#   R1 (fout)     in `spec` geen schatwoorden: spec is alleen voor geverifieerde feiten
#   R2 (fout)     geen decimale punt bij een eenheid (komma decimaal: 114,3 mm)
#   R4 (fout)     een getal vanaf 1.000 vóór een eenheid heeft een punt als duizendtal (3.250 tpm); jaartallen zonder
#                 eenheid en productcodes (7PK1795) vallen er niet onder
#   R5 (fout)     Ø staat zonder spatie vóór de maat (Ø57)
#   R7 (fout)     een cachesleutel begint met het voorvoegsel van het bestand (tabel `_voorvoegsels` in auto.json: dat is per
#                 auto, dus niet in dit generieke bestand; een bestand zonder regel in de tabel, zoals core.js, wordt niet getoetst)
# R4, R5 en R7 waren tot de laatste fase van golf 5b-3 meldingen; sinds stap 3.1 zijn het fouten (de bouw stopt).
# ---------------------------------------------------------------------------------------------------------------------
TEXT_SKIP = {'partnumbers.js'}   # bronnamen en citaten van derden: letterlijk laten staan

_UNIT = (r'(?:mm²|cm²|dm²|m²|mm³|cm³|dm³|m³|km/h|km/u|l/min|g/km|N·m|Nm|kPa|MPa|mbar|bar|psi|µm|mm|cm|dm|km|kg|mg|ml|cl|kN|mA|Ah|kWh|kW|Wh|'
         r'kHz|Hz|rpm|tpm|°C|°|%|pk|PK|ms|min|uur|dB|[mglNtVAWs])(?![A-Za-zÀ-ÿ²³µ])')
_CHAIN = r'(?:\s*[×x]\s*\d[\d.,]*)*\s*'   # maten als 4.695 × 1.811 × 1.445 mm: de eenheid staat achter de laatste
_R1 = re.compile(r'(?<![A-Za-zÀ-ÿ])(?:geschat\w*|aannemelijk\w*|circa|ca\.|ongeveer|afgeleid\w*|schatting\w*)', re.I)
_R2 = re.compile(r'(?<![0-9A-Za-z_.,])\d+\.\d{1,2}(?!\d|[.,]\d)' + _CHAIN + _UNIT)
_R4 = re.compile(r'(?<![0-9A-Za-z_.,])\d{4,}(?!\d|[.,]\d)' + _CHAIN + _UNIT)
_R5 = re.compile(r'Ø[  \t]')

_S1 = re.compile(r"'(?:\\.|[^'\\\n])*'")
_S2 = re.compile(r'"(?:\\.|[^"\\\n])*"')
_RELIT = re.compile(r'/(?:\\.|\[(?:\\.|[^\]\\\n])*\]|[^/\\\n\[])+/[a-z]*')
_SCAN = re.compile(r"""
    (?P<lc>//[^\n]*) | (?P<bc>/\*.*?\*/) | (?P<s1>'(?:\\.|[^'\\\n])*') | (?P<s2>"(?:\\.|[^"\\\n])*") | (?P<tpl>`)
  | (?P<key>(?<![\w$.])(?P<kn>d|spec|note|label)[ \t]*:(?!:)) | (?P<call>(?<![\w$])(?P<cn>cache|lathe)\s*\()
  | (?P<div>/) | (?P<word>[\w$]+) | (?P<other>[^\w$'"`/]+)""", re.X | re.S)
_ARGS = re.compile(r"""(?P<s>'(?:\\.|[^'\\\n])*'|"(?:\\.|[^"\\\n])*")|(?P<t>`)|(?P<c>//[^\n]*|/\*.*?\*/)|(?P<p>[()\[\]{},])""", re.S)
_ESC = re.compile(r'\\(u[0-9a-fA-F]{4}|x[0-9a-fA-F]{2}|.)', re.S)
_FUNC = re.compile(r'\bfunction\s+([A-Za-z_$][\w$]*)\s*\(([^)]*)\)')
_BLANK = ' \t\r\n'


def _unesc(s):
    def sub(m):
        c = m.group(1)
        if c[0] in 'ux' and len(c) > 1:
            return chr(int(c[1:], 16))
        return {'n': ' ', 't': ' '}.get(c, c)
    return _ESC.sub(sub, s)


def _tpl(text, i):
    """Sjabloon vanaf i (net na de backtick). Geeft (tekst met \\0 voor elke ${...}, tekst vóór de eerste ${, eindpositie)."""
    out, lead = [], None
    n = len(text)
    while i < n:
        c = text[i]
        if c == '`':
            return ''.join(out), (''.join(out) if lead is None else lead), i + 1
        if c == '\\':
            out.append(_unesc(text[i:i + 2])); i += 2
        elif c == '$' and text[i + 1:i + 2] == '{':
            if lead is None:
                lead = ''.join(out)
            out.append('\0')
            i = _skip_expr(text, i + 2)
        else:
            out.append(c); i += 1
    return ''.join(out), (''.join(out) if lead is None else lead), n


def _skip_expr(text, i):
    """Positie na de } die de ${ afsluit (i staat na de {)."""
    depth = 1
    while depth:
        m = _ARGS.search(text, i)
        if not m:
            return len(text)
        i = m.end()
        if m.group('t'):
            i = _tpl(text, i)[2]
        elif m.group('p') == '{':
            depth += 1
        elif m.group('p') == '}':
            depth -= 1
    return i


def _lit(text, i):
    """Letterlijke string of sjabloon op positie i (na witruimte). Geeft (tekst, tekst vóór de eerste ${, eind) of None."""
    while i < len(text) and text[i] in _BLANK:
        i += 1
    c = text[i:i + 1]
    if c in ("'", '"'):
        m = (_S1 if c == "'" else _S2).match(text, i)
        if m:
            t = _unesc(m.group(0)[1:-1])
            return t, t, m.end()
    elif c == '`':
        return _tpl(text, i + 1)
    return None


def _args(text, i):
    """Top-level argumenten van een aanroep (i staat na de haakje-open) als lijst (begin, eind)."""
    out, start, depth = [], i, 1
    while True:
        m = _ARGS.search(text, i)
        if not m:
            return out
        i = m.end()
        if m.group('t'):
            i = _tpl(text, i)[2]
        elif m.group('p'):
            p = m.group('p')
            if p in '([{':
                depth += 1
            elif p in ')]}':
                depth -= 1
                if depth == 0:
                    out.append((start, m.start()))
                    return out
            elif p == ',' and depth == 1:
                out.append((start, m.start())); start = i


def _expr_strings(text, i):
    """Alle letterlijke strings van de uitdrukking die op positie i begint (tot de komma of sluit-haak op het eerste niveau), als
    lijst (positie, tekst). Delen die met `+` aan elkaar hangen zijn één tekst; een voorwaarde (a ? 'x' : 'y') geeft er twee."""
    out, depth, last = [], 0, None
    while True:
        m = _ARGS.search(text, i)
        if not m:
            return out
        i = m.end()
        if m.group('t'):
            s, _, i = _tpl(text, i)
        elif m.group('s'):
            s = _unesc(m.group('s')[1:-1])
        else:
            p = m.group('p')
            if p and p in '([{':
                depth += 1
            elif p and p in ')]}':
                if depth == 0:
                    return out
                depth -= 1
            elif p == ',' and depth == 0:
                return out
            continue
        if out and last is not None and text[last:m.start()].strip() == '+':
            out[-1] = (out[-1][0], out[-1][1] + s)
        else:
            out.append((m.start(), s))
        last = i


def _scan_file(text):
    """Geeft (teksten, sleutels): teksten = [(positie, soort 'd'|'spec', tekst)]; sleutels = [(positie, letterlijk begin van de
    sleutel, ident dat erop volgt of None)] van cache(...) en G.lathe(..., sleutel)."""
    texts, keys = [], []
    pos, n = 0, len(text)
    while pos < n:
        m = _SCAN.match(text, pos)
        if not m:
            pos += 1
            continue
        pos = m.end()
        if m.group('tpl'):
            pos = _tpl(text, pos)[2]
        elif m.group('div'):
            j = m.start() - 1
            while j >= 0 and text[j] in _BLANK:
                j -= 1
            if j < 0 or text[j] in '(,=:[!&|?{};+-*%<>~^' or text[max(0, j - 5):j + 1] == 'return':
                r = _RELIT.match(text, m.start())
                if r:
                    pos = r.end()
        elif m.group('key'):
            j = m.start() - 1
            while j >= 0 and text[j] in _BLANK:
                j -= 1
            if j >= 0 and text[j] not in '{,(':
                continue
            for p, t in _expr_strings(text, pos):
                texts.append((p, m.group('kn'), t))
        elif m.group('call'):
            if m.group('cn') == 'cache':
                got = _lit(text, pos)
                if got:
                    ident = re.match(r'\s*\+\s*([A-Za-z_$][\w$]*)\s*(?![\w$.(\[])', text[got[2]:got[2] + 80])
                    keys.append((m.start(), got[1], ident.group(1) if ident else None))
            else:
                a = _args(text, pos)
                if len(a) >= 4:
                    got = _lit(text[:a[3][1]], a[3][0])
                    if got and not text[got[2]:a[3][1]].strip():
                        keys.append((m.start(), got[1], None))
    return texts, keys


def _resolve(sources, name, pos, lead, ident):
    """Vult de parameter `ident` van de functie waarin de cache-aanroep staat in met de letterlijke argumenten van alle aanroepen
    van die functie (discGeo(..., 'F') geeft 'discF'). Leeg als dat niet kan."""
    text = dict(sources)[name]
    fn = None
    for f in _FUNC.finditer(text, 0, pos):
        fn = f
    if not fn:
        return []
    params = [re.split(r'[=\s]', p.strip())[0] for p in fn.group(2).split(',')]
    if ident not in params:
        return []
    idx, found = params.index(ident), []
    call = re.compile(r'(?<![\w$.])(?<!function )' + re.escape(fn.group(1)) + r'\s*\(')
    for sname, stext in sources:
        if sname in TEXT_SKIP:
            continue
        for c in call.finditer(stext):
            a = _args(stext, c.end())
            if len(a) > idx:
                got = _lit(stext[:a[idx][1]], a[idx][0])
                if got and not stext[got[2]:a[idx][1]].strip() and '\0' not in got[0]:
                    found.append(lead + got[0])
    return sorted(set(found))


def lint_texts(sources, prefixes=None):
    """Geeft de fouten: een lijst regels 'bestand:regel: ... (Rn)'. sources = [(naam, tekst)];
    prefixes = {bestand: [voorvoegsels]} (leeg of None: geen R7)."""
    errors = []
    prefixes = prefixes or {}
    texts_of = dict(sources)

    def line(name, pos):
        return texts_of[name].count('\n', 0, pos) + 1

    def short(t):
        t = t.replace('\0', '…')
        return t if len(t) <= 70 else t[:67] + '...'

    for name, text in sources:
        if name in TEXT_SKIP:
            continue
        texts, keys = _scan_file(text)
        for pos, kind, t in texts:
            where = f'{name}:{line(name, pos)}'
            if kind == 'spec':
                for m in _R1.finditer(t):
                    errors.append(f'{where}: schatwoord "{m.group(0)}" in spec "{short(t)}" (R1)')
            for m in _R2.finditer(t):
                errors.append(f'{where}: decimale punt bij eenheid "{m.group(0).strip()}", schrijf een komma (R2)')
            for m in _R4.finditer(t):
                for num in re.findall(r'(?<![\d.,])\d{4,}(?!\d|[.,]\d)', m.group(0)):   # elk getal van een maat apart
                    errors.append(f'{where}: duizendtal zonder punt "{num}" in "{m.group(0).strip()}", schrijf een punt (R4)')
            for m in _R5.finditer(t):
                errors.append(f'{where}: Ø met spatie in "{short(t[max(0, m.start() - 12):m.end() + 12])}" (R5)')
        pre = prefixes.get(name)
        if not pre:
            continue
        seen = set()
        for pos, lead, ident in keys:
            names = (_resolve(sources, name, pos, lead, ident) if ident else []) or [lead]
            for key in names:
                if key and not key.startswith(tuple(pre)) and (key, pos) not in seen:
                    seen.add((key, pos))
                    errors.append(f'{name}:{line(name, pos)}: cachesleutel "{key}" begint niet met {"/".join(pre)} (R7)')
    return errors


def lint(sources, prefixes=None):
    """Geeft de fouten (tekstregels R1 tot en met R7 en de dubbele namen)."""
    errors = lint_texts(sources, prefixes)
    seen_fn, seen_mat = {}, {}
    for name, text in sources:
        for i, line in enumerate(text.split('\n'), 1):
            m = re.match(r'(?:async\s+)?function\s*\*?\s*([A-Za-z_$][\w$]*)', line)
            if m:
                fn = m.group(1)
                if fn in seen_fn:
                    errors.append(f'{name}:{i}: functie {fn} bestaat al in {seen_fn[fn]}')
                else:
                    seen_fn[fn] = f'{name}:{i}'
            for mm in re.finditer(r'\b(?:std|phys)\(\s*[\'"]([^\'"]+)[\'"]', line):
                mat = mm.group(1)
                if mat in seen_mat:
                    errors.append(f'{name}:{i}: materiaal {mat} bestaat al in {seen_mat[mat]}')
                else:
                    seen_mat[mat] = f'{name}:{i}'
    js = '\n'.join(text for _, text in sources)
    node = shutil.which('node')
    if node:
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
            f.write(js)
            tmp = f.name
        try:
            r = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
            if r.returncode != 0:
                msg = (r.stderr or r.stdout).strip().replace(tmp, 'samengevoegd.js')
                # regelnummer terugvertalen naar bronbestand
                lm = re.search(r'samengevoegd\.js:(\d+)', msg)
                if lm:
                    ln, acc = int(lm.group(1)), 0
                    for name, text in sources:
                        n = text.count('\n') + 1
                        if ln <= acc + n:
                            msg += f'\n  -> {name}:{ln - acc}'
                            break
                        acc += n
                errors.append('syntaxfout:\n' + msg)
        finally:
            os.unlink(tmp)
    else:
        print('let op: node niet gevonden, syntaxcontrole overgeslagen', file=sys.stderr)
    return errors


def lint_head(head):
    """Inline scripts in head.html (zoals de foutafhandeling vóór de scripttags) vallen buiten het samengevoegde script;
    ze gaan apart door node --check."""
    errors = []
    node = shutil.which('node')
    if not node:
        return errors
    for i, sc in enumerate(re.findall(r'<script(?![^>]*\bsrc=)[^>]*>(.*?)</script>', head, re.S), 1):
        with tempfile.NamedTemporaryFile('w', suffix='.js', delete=False, encoding='utf-8') as f:
            f.write(sc)
            tmp = f.name
        try:
            r = subprocess.run([node, '--check', tmp], capture_output=True, text=True)
            if r.returncode != 0:
                errors.append(f'syntaxfout in inline script {i} van head.html:\n' + (r.stderr or r.stdout).strip().replace(tmp, 'head-inline.js'))
        finally:
            os.unlink(tmp)
    return errors


def version(head, js, test=False):
    """Versiestempel: het nummer uit VERSION plus een inhoudshash (7 tekens) van head.html en het samengevoegde script,
    zodat de pagina zelf zegt uit welke bron hij komt. Niet uit HEAD: de commit die index.html bevat bestaat bij het bouwen nog niet."""
    with open(os.path.join(HERE, 'VERSION'), encoding='utf-8') as f:
        num = f.read().strip()
    h = hashlib.sha256((head + '\n' + js).encode('utf-8')).hexdigest()[:7]
    return f'{num} (bron {h}{", testversie" if test else ""})'


# documentgeraamte voor index.html: zonder doctype staat de pagina in quirks-modus en zonder viewport-regel rekent een telefoon
# met 980 px breedte (pubsmoke toetst beide op de Pages-versie)
DOC_HEAD = '<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover"></head><body>\n'
DOC_TAIL = '</body></html>\n'


def auto():
    """De autogegevens uit auto.json: alles wat per auto verschilt in de generieke laag (docs/framework.md)."""
    with open(os.path.join(HERE, 'auto.json'), encoding='utf-8') as f:
        return json.load(f)


def fill(head, a):
    """Zet de velden {{naam}} in head.html in; een veld dat niet in auto.json staat, stopt de bouw."""
    def sub(m):
        k = m.group(1)
        if k not in a or not isinstance(a[k], str):
            raise SystemExit(f'BOUW GESTOPT: head.html vraagt {{{{{k}}}}}, maar auto.json heeft geen tekstveld {k}')
        return a[k]
    return re.sub(r'\{\{(\w+)\}\}', sub, head)


# Nummergegevens (golf 5c-2, P1): de regel `const PN_DATA = {...};` uit partnumbers.js gaat als JSON in een eigen
# <script type="application/json" id="pn"> en het script krijgt `const PN_DATA = uiPnLazy();` (app2-panel.js), dat de JSON pas
# leest als het paneel of het zoeken op nummer erom vraagt. Een JSON-blok is voor de browser inert: het hoeft niet als
# JavaScript geparsed te worden en overleeft het geraamte van de artefacthost (de kale pagina staat daar in een ander
# document). Elke < wordt \u003c, zodat </script> of <!-- in een tekst het blok niet kan sluiten. Geen geldige JSON (de lege
# stub van tools/framework.py heeft sleutels zonder aanhalingstekens): dan blijft de regel gewoon JavaScript.
_PN_LINE = re.compile(r'^const PN_DATA = (\{.*\});[ \t]*$', re.M)


def pn_split(js):
    """Geeft (js, json-blok): het script zonder de gegevens en het HTML-blok met de gegevens, of (js, '') als er niets te
    verplaatsen is."""
    m = _PN_LINE.search(js)
    if not m:
        return js, ''
    try:
        json.loads(m.group(1))
    except ValueError:
        return js, ''
    data = m.group(1).replace('<', '\\u003c')
    return js[:m.start()] + 'const PN_DATA = uiPnLazy();' + js[m.end():], f'<script type="application/json" id="pn">{data}</script>\n'


def page(head, js, prefix, test=False):
    a = auto()
    head = fill(head, a)
    js = 'const AUTO = Object.freeze(' + json.dumps({k: v for k, v in a.items() if not k.startswith('_')}, ensure_ascii=False) + ');\n' + js
    tags = '\n'.join(f'<script src="{prefix}{l}" integrity="{integrity(l)}" crossorigin="anonymous"></script>' for l in LIBS)
    head = head.replace('__MODEL_VERSION__', version(head, js, test))  # de hash dekt ook de gegevens (vóór het splitsen)
    js, pn = pn_split(js)
    return f"{head}\n{tags}\n{pn}<script>\n{js}\n</script>\n"


def main(argv):
    lint_only = '--lint' in argv
    test_only = '--test-only' in argv
    bare = None
    if '--bare' in argv:
        i = argv.index('--bare')
        if i + 1 >= len(argv) or argv[i + 1].startswith('--'):
            print('--bare vraagt een bestandsnaam', file=sys.stderr)
            return 2
        bare = argv[i + 1]
        argv = argv[:i] + argv[i + 2:]
    args = [a for a in argv if not a.startswith('--')]
    sources = [(f, read(f)) for f in ORDER]
    errors = lint(sources, auto().get('_voorvoegsels')) + lint_head(read('head.html'))
    if errors:
        print('BOUW GESTOPT:', file=sys.stderr)
        for e in errors:
            print('  ' + e, file=sys.stderr)
        return 1
    if lint_only:
        print('lint ok')
        return 0
    head = read('head.html')
    js = '\n'.join(text for _, text in sources)
    out = os.path.join(HERE, 'index.html')
    if test_only and not args:
        print('--test-only vraagt een map', file=sys.stderr)
        return 2
    if not test_only:
        with open(out, 'w', encoding='utf-8') as f:
            f.write(DOC_HEAD + page(head, js, CDN) + DOC_TAIL)
        if bare:
            with open(bare, 'w', encoding='utf-8') as f:
                f.write(page(head, js, CDN))
    if args:
        test_dir = args[0]
        os.makedirs(test_dir, exist_ok=True)
        body = page(head, js, 'three/', test=True)
        with open(os.path.join(test_dir, 'index.html'), 'w', encoding='utf-8') as f:
            f.write(DOC_HEAD + body + DOC_TAIL)
    print('ok', 'testversie' if test_only else f'{os.path.getsize(out)} bytes')
    return 0


if __name__ == '__main__':
    sys.exit(main(sys.argv[1:]))
