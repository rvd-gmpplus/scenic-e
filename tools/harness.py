"""Gedeelde testhulp: three.js ophalen, testversie bouwen, lokaal serveren, Chromium starten.

Elk testscript doet:
    from harness import session
    with session() as s:            # bouwt src/ naar een tijdelijke testmap
        pg = s.page(1280, 800)      # laadt index.html, wacht tot window.__model er is
        ...
        s.report()                  # console- en paginafouten

Omgevingsvariabelen:
    THREE_DIR   map met het uitgepakte npm-pakket three@0.147.0 (standaard ~/.cache/explosietekening/three-0.147.0/package)
    CHROMIUM    pad naar een Chromium-binary (standaard /opt/pw-browsers/chromium als die bestaat)
    MODEL_TEST bestaande testmap gebruiken in plaats van opnieuw te bouwen
    MODEL_TIMEOUT_MS wachttijd op laden en `ready` in milliseconden (standaard 120000)

Los aan te roepen: `python3 tools/harness.py --ensure-three` haalt three.js op (met hashcontrole) en drukt de map af.
"""
import os, sys, json, time, shutil, tempfile, threading, subprocess, functools, contextlib, fcntl, hashlib, base64
import http.server, socketserver

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, ROOT)
import build as _build
THREE_VERSION = _build.THREE_VERSION
# npm `dist.integrity` van three@0.147.0: het opgehaalde pakket moet hier byte voor byte mee kloppen
THREE_INTEGRITY = 'sha512-LPTOslYQXFkmvceQjFTNnVVli2LaVF6C99Pv34fJypp8NbQLbTlu3KinZ0zURghS5zEehK+VQyvWuPZ/Sm8fzw=='
ARGS = ['--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist']
# LAG3_GPU=1: echte GPU (macOS: ANGLE Metal) in plaats van SwiftShader, alleen voor beelden die het oog beoordeelt (S7, galerij);
# visdiff, basislijnen en de testset blijven op SwiftShader (golf 5f, 19 oktober 2026: de spikkels zijn een SwiftShader-artefact)
if os.environ.get('LAG3_GPU') == '1':
    if sys.platform != 'darwin':
        sys.exit('LAG3_GPU=1 werkt alleen op macOS (ANGLE Metal); zet de variabele uit')
    ARGS = ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist']
# Contract: consolemeldingen die geen fout zijn. Alleen de orkestrator wijzigt deze lijst, elke regel met reden en datum.
IGNORE = (
    'favicon.ico',  # de testpagina heeft geen favicon en de browser vraagt hem toch op (golf 1, 13 oktober 2026)
    'GPU stall due to ReadPixels',  # prestatiemelding van de GPU-driver (macOS, OpenGL) bij het teruglezen van pixels voor de meting; geen fout in de pagina (16 oktober 2026)
)


def _check_tgz(path):
    with open(path, 'rb') as f:
        got = 'sha512-' + base64.b64encode(hashlib.sha512(f.read()).digest()).decode()
    if got != THREE_INTEGRITY:
        raise SystemExit(f'three.js-pakket {path} komt niet overeen met de npm-integriteit van three@{THREE_VERSION}: {got}')


def ensure_three():
    """Geeft de map met het uitgepakte npm-pakket; haalt het op als het ontbreekt. Een bestandsvergrendeling voorkomt dat
    twee gelijktijdige testreeksen allebei `npm pack` draaien."""
    d = os.environ.get('THREE_DIR')
    if d and os.path.isfile(os.path.join(d, 'build', 'three.min.js')):
        return d
    cache = os.path.expanduser(f'~/.cache/explosietekening/three-{THREE_VERSION}')
    pkg = os.path.join(cache, 'package')
    tgz = os.path.join(cache, f'three-{THREE_VERSION}.tgz')
    os.makedirs(cache, exist_ok=True)
    with open(os.path.join(cache, '.lock'), 'w') as lk:
        fcntl.flock(lk, fcntl.LOCK_EX)
        if not os.path.isfile(os.path.join(pkg, 'build', 'three.min.js')):
            subprocess.run(['npm', 'pack', f'three@{THREE_VERSION}'], cwd=cache, check=True, capture_output=True)
            _check_tgz(tgz)
            subprocess.run(['tar', 'xzf', tgz], cwd=cache, check=True)
        elif os.path.isfile(tgz):
            _check_tgz(tgz)
    return pkg


def build_test(test_dir=None):
    """Bouwt src/ naar test_dir/index.html met three/ als symlink. Geeft de map terug."""
    test_dir = test_dir or tempfile.mkdtemp(prefix='model-test-')
    r = subprocess.run([sys.executable, os.path.join(ROOT, 'build.py'), '--test-only', test_dir], capture_output=True, text=True)
    if r.returncode != 0:
        raise SystemExit('bouw mislukt:\n' + r.stderr + r.stdout)
    link = os.path.join(test_dir, 'three')
    if not os.path.exists(link):
        os.symlink(ensure_three(), link)
    return test_dir


def chromium_path():
    for c in (os.environ.get('CHROMIUM'), '/opt/pw-browsers/chromium'):
        if c and os.path.exists(c):
            return c
    return None


FONT_HOSTS = ('https://fonts.googleapis.com/', 'https://fonts.gstatic.com/')


def _font_route(rt):
    """Antwoord op een Fonts-verzoek uit ~/.cache/explosietekening/fonts; haalt het één keer op met Python. Lukt ophalen
    niet, dan een leeg antwoord (de pagina valt terug op de systeemletter, zonder consolefout)."""
    import urllib.request
    url = rt.request.url
    d = os.path.expanduser('~/.cache/explosietekening/fonts')
    f = os.path.join(d, hashlib.sha256(url.encode()).hexdigest())
    css = 'fonts.googleapis.com' in url
    if not os.path.isfile(f):
        try:
            req = urllib.request.Request(url, headers={'User-Agent': rt.request.headers.get('user-agent', 'Mozilla/5.0')})
            with urllib.request.urlopen(req, timeout=30) as r:
                body = r.read()
            os.makedirs(d, exist_ok=True)
            with open(f + '.tmp', 'wb') as o:
                o.write(body)
            os.replace(f + '.tmp', f)
        except Exception:
            return rt.fulfill(status=200, body='', headers={'content-type': 'text/css' if css else 'font/woff2', 'access-control-allow-origin': '*'})
    with open(f, 'rb') as i:
        body = i.read()
    return rt.fulfill(status=200, body=body, headers={'content-type': 'text/css; charset=utf-8' if css else 'font/woff2', 'access-control-allow-origin': '*'})


class _Quiet(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *a):
        pass


class Session:
    def __init__(self, test_dir, owns_dir=False):
        from playwright.sync_api import sync_playwright
        self.dir = test_dir
        self.owns_dir = owns_dir  # tijdelijke testmap van deze sessie: wordt bij close() opgeruimd
        self.srv = socketserver.TCPServer(('127.0.0.1', 0), functools.partial(_Quiet, directory=test_dir))
        self.port = self.srv.server_address[1]
        threading.Thread(target=self.srv.serve_forever, daemon=True).start()
        self._pw = sync_playwright().start()
        exe = chromium_path()
        self.browser = self._pw.chromium.launch(executable_path=exe, args=ARGS) if exe else self._pw.chromium.launch(args=ARGS)
        self.logs = []
        self.load_times = []

    def page(self, w=1280, h=800, scale=1, wait=True, touch=False, timeout=None, query=''):
        """query: optionele querystring zoals '?preset=engine' (deelbare stand) of '?debug=1'."""
        # MODEL_TIMEOUT_MS: wachttijd op laden en `ready` (standaard 120 s; op een belaste machine of CI hoger zetten)
        timeout = int(os.environ.get('MODEL_TIMEOUT_MS', timeout or 120000))
        ctx = self.browser.new_context(viewport={'width': w, 'height': h}, device_scale_factor=scale, has_touch=touch, is_mobile=touch)
        ctx.add_init_script('window.__MODEL_CACHECHECK = true;')
        # Google Fonts uit een lokale cache beantwoorden: met een tweede, nog renderende pagina in dezelfde browser faalt het
        # echte verzoek op macOS met net::ERR_SOCKET_NOT_CONNECTED. De cache houdt de letters gelijk aan de echte pagina
        # (visdiff); bereikbaarheid controleert pubsmoke.py met curl. (orkestrator, 16 oktober 2026)
        ctx.route(lambda u: u.startswith(FONT_HOSTS), _font_route)
        pg = ctx.new_page()
        tag = f'{w}x{h}'

        def on_console(m):
            if m.type in ('error', 'warning') and not any(i in m.text for i in IGNORE):
                loc = m.location or {}
                if 'Failed to load resource' in m.text and any(i in (loc.get('url') or '') for i in IGNORE):
                    return
                self.logs.append(f'[{tag}] {m.type}: {m.text}')
        pg.on('console', on_console)
        pg.on('pageerror', lambda e: self.logs.append(f'[{tag}] PAGEERROR: {e}'))
        t0 = time.time()
        pg.goto(f'http://127.0.0.1:{self.port}/index.html{query}', wait_until='load', timeout=timeout)
        if wait:
            pg.wait_for_function('window.__model && window.__model.ready !== false', timeout=timeout)
            pg.wait_for_timeout(300)
        self.load_times.append((tag, round(time.time() - t0, 2)))
        return pg

    def errors(self):
        """Alle gelogde consolemeldingen: fouten én waarschuwingen tellen (docs/testen.md), behalve IGNORE."""
        return list(self.logs)

    def warnings(self):
        return [l for l in self.logs if '] warning:' in l]

    def report(self):
        if os.environ.get('LAG3_GPU') == '1':
            print('renderer: echte GPU (LAG3_GPU=1, ANGLE Metal)')
        for t, s in self.load_times:
            print(f'laadtijd {t}: {s} s')
        if self.logs:
            print(f'{len(self.logs)} console-meldingen:')
            for l in self.logs[:40]:
                print('  ' + l[:400])
        else:
            print('geen console-fouten of -waarschuwingen')

    def close(self):
        try:
            self.browser.close()
            self._pw.stop()
        finally:
            self.srv.shutdown()
            if self.owns_dir:
                shutil.rmtree(self.dir, ignore_errors=True)


@contextlib.contextmanager
def session(test_dir=None):
    given = test_dir or os.environ.get('MODEL_TEST')
    d = given or build_test()
    if not os.path.exists(os.path.join(d, 'three')):
        os.symlink(ensure_three(), os.path.join(d, 'three'))
    s = Session(d, owns_dir=not given)
    try:
        yield s
    finally:
        s.close()


def js(pg, code, *args):
    """Evalueert code in de pagina; code mag een functie-expressie of een expressie zijn."""
    return pg.evaluate(code, *args) if args else pg.evaluate(code)


def screen_pt(pg, node_expr):
    """Schermcoördinaat (CSS-pixels) van het midden van een knoop. node_expr: JS-expressie die een knoop oplevert."""
    return pg.evaluate("""(() => { const n = %s; const w = n.obj.localToWorld(n.lc.clone()); const v = w.project(camera);
        const r = canvas.getBoundingClientRect(); return [r.left + (v.x * 0.5 + 0.5) * r.width, r.top + (-v.y * 0.5 + 0.5) * r.height, v.z]; })()""" % node_expr)


if __name__ == '__main__':
    if '--ensure-three' in sys.argv[1:]:
        print(ensure_three())
    else:
        print(__doc__)
