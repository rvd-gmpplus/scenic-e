"""Publicatierooktest: de CDN-versie zoals hij gepubliceerd wordt, in de verpakking van de artefacthost.

    python3 tools/pubsmoke.py          # exitcode 1 bij een fout

Wat hij doet:
1. Bouwt de kale CDN-pagina in het geheugen (zoals build.py --bare hem schrijft) en zet hem in hetzelfde
   HTML-geraamte dat de artefacthost eromheen zet; daarnaast laadt hij index.html zoals GitHub Pages het serveert
   (een volledig document) op een telefoon en eist standaardmodus en een schermbreedte van 390 px.
2. Laadt hem in Chromium. Verzoeken naar cdn.jsdelivr.net/npm/three@0.147.0/ worden beantwoord uit het lokale
   npm-pakket (de container heeft geen directe internettoegang voor Chromium); lettertypen krijgen een lege stylesheet.
3. Controleert: geen console- of paginafouten, __model klaar binnen 20 s, THREE.REVISION = 147, het canvas heeft
   touch-action en user-select uit en de stylesheet schakelt -webkit-touch-callout uit (lang drukken op iOS). Staan de
   nummergegevens als JSON-blok #pn in de pagina (build.py, golf 5c-2 P1), dan moet dat blok het geraamte van de host
   overleven en leesbaar zijn: PN_DATA.map heeft dan minstens één pad.
4. Controleert met curl via de proxy dat elk CDN-bestand bestaat en byte voor byte gelijk is aan het lokale pakket,
   en dat de lettertype-stylesheet van Google Fonts bereikbaar is.
"""
import sys, os, re, time, hashlib, subprocess, importlib.util, tempfile
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import ROOT, ensure_three, chromium_path, ARGS

SKELETON_HEAD = ('<!doctype html><html><head><meta charset=utf8><meta name=viewport content="width=device-width,initial-scale=1,viewport-fit=cover">'
                 '<style>:root{color-scheme:light;box-sizing:border-box;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px)}'
                 'html{scroll-padding-top:env(safe-area-inset-top,0px)}body{margin:0;padding:0;font:14px -apple-system,BlinkMacSystemFont,sans-serif;background:#fff;color:#000}'
                 'img{max-width:100%}[hidden]:not([hidden=until-found i]){display:none!important}</style></head><body>\n')
SKELETON_TAIL = '\n\n</body></html>'


def load_build():
    spec = importlib.util.spec_from_file_location('lagbuild', os.path.join(ROOT, 'build.py'))
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def main():
    b = load_build()
    sources = [(f, b.read(f)) for f in b.ORDER]
    errs = b.lint(sources)
    if errs:
        print('lint faalt:', *errs, sep='\n  ')
        return 1
    page = b.page(b.read('head.html'), '\n'.join(t for _, t in sources), b.CDN)
    html = SKELETON_HEAD + page + SKELETON_TAIL   # artefact: de kale pagina (build.py --bare) in het geraamte van de host
    # GitHub Pages serveert index.html zoals het is: dat moet zelf een volledig document zijn (doctype, viewport)
    pages = open(os.path.join(ROOT, 'index.html'), encoding='utf-8').read()
    three = ensure_three()
    fails = []

    # 4. CDN en lettertypen via curl (proxy)
    for lib in b.LIBS:
        url = b.CDN + lib
        r = subprocess.run(['curl', '-sS', '-L', '--max-time', '60', '-o', '-', '-w', '%{http_code}', url], capture_output=True)
        body, code = r.stdout[:-3], r.stdout[-3:].decode(errors='replace')
        local = open(os.path.join(three, lib), 'rb').read()
        if code != '200':
            fails.append(f'CDN {url} geeft HTTP {code}')
        elif hashlib.sha256(body).hexdigest() != hashlib.sha256(local).hexdigest():
            fails.append(f'CDN {url} wijkt af van het lokale pakket ({len(body)} tegen {len(local)} bytes)')
    fonts = re.search(r'href="(https://fonts\.googleapis\.com/css2[^"]+)"', page)
    if fonts:
        r = subprocess.run(['curl', '-sS', '-o', '/dev/null', '-w', '%{http_code}', '--max-time', '30', fonts.group(1).replace('&amp;', '&')], capture_output=True, text=True)
        if r.stdout.strip() != '200':
            fails.append(f'Google Fonts geeft HTTP {r.stdout.strip()}')

    # 1 tot 3. Laden in de hostverpakking
    from playwright.sync_api import sync_playwright
    logs = []
    with sync_playwright() as p:
        exe = chromium_path()
        br = p.chromium.launch(executable_path=exe, args=ARGS) if exe else p.chromium.launch(args=ARGS)
        for (w, h, touch, kanaal) in ((1280, 800, False, 'artefact'), (390, 844, True, 'artefact'), (390, 844, True, 'pages')):
            ctx = br.new_context(viewport={'width': w, 'height': h}, device_scale_factor=2 if touch else 1, has_touch=touch, is_mobile=touch)
            ctx.add_init_script('window.__MODEL_CACHECHECK = true;')
            pg = ctx.new_page()
            tag = f'{w}x{h}' + (' pages' if kanaal == 'pages' else '')
            pg.on('console', lambda m, tag=tag: logs.append(f'[{tag}] {m.type}: {m.text}') if m.type in ('error', 'warning') else None)
            pg.on('pageerror', lambda e, tag=tag: logs.append(f'[{tag}] PAGEERROR: {e}'))

            def route(rt):
                url = rt.request.url
                if url.startswith(b.CDN):
                    path = os.path.join(three, url[len(b.CDN):].split('?')[0])
                    if os.path.isfile(path):
                        return rt.fulfill(status=200, body=open(path, 'rb').read(), headers={'content-type': 'application/javascript', 'access-control-allow-origin': '*'})
                    return rt.fulfill(status=404, body='niet gevonden')
                if 'fonts.googleapis.com' in url or 'fonts.gstatic.com' in url:
                    return rt.fulfill(status=200, body='', headers={'content-type': 'text/css', 'access-control-allow-origin': '*'})
                if url.startswith('https://artifact.local/'):
                    return rt.fulfill(status=200, body=html if kanaal == 'artefact' else pages, headers={'content-type': 'text/html; charset=utf-8'})
                return rt.abort()
            pg.route('**/*', route)
            t0 = time.time()
            pg.goto('https://artifact.local/index.html', wait_until='load', timeout=120000)
            # grens voor `ready`: 20 s (docs/testen.md); op een belaste machine of CI via PUBSMOKE_READY_MS hoger zetten
            ready_ms = int(os.environ.get('PUBSMOKE_READY_MS', '20000'))
            try:
                pg.wait_for_function('window.__model && window.__model.ready !== false', timeout=ready_ms)
            except Exception:
                fails.append(f'[{tag}] __model niet klaar binnen {ready_ms / 1000:g} s')
                continue
            dt = time.time() - t0
            r = pg.evaluate("""(() => { const c = document.querySelector('canvas'); const cs = getComputedStyle(c);
                const css = [...document.styleSheets].map(s => { try { return [...s.cssRules].map(r => r.cssText).join('\\n'); } catch (e) { return ''; } }).join('\\n');
                return { rev: THREE.REVISION, touch: cs.touchAction, select: cs.userSelect || cs.webkitUserSelect, callout: /-webkit-touch-callout\\s*:\\s*none/.test(css) || /touch-callout/.test(document.documentElement.innerHTML),
                         hscroll: document.documentElement.scrollWidth > innerWidth, mode: document.compatMode, iw: innerWidth,
                         pn: document.getElementById('pn') ? (() => { try { return Object.keys(PN_DATA.map).length; } catch (e) { return -1; } })() : null }; })()""")
            print(f'[{tag}] klaar in {dt:.1f} s, three r{r["rev"]}, touch-action {r["touch"]}, user-select {r["select"]}, touch-callout uit: {r["callout"]}, horizontale scroll: {r["hscroll"]}, nummerpaden: {r["pn"]}')
            if r['rev'] != '147': fails.append(f'[{tag}] THREE.REVISION is {r["rev"]}')
            if r['touch'] != 'none': fails.append(f'[{tag}] canvas touch-action is {r["touch"]}, moet none')
            if r['select'] != 'none': fails.append(f'[{tag}] canvas user-select is {r["select"]}, moet none')
            if not r['callout']: fails.append(f'[{tag}] -webkit-touch-callout: none ontbreekt (lang drukken op iOS opent dan het systeemmenu)')
            if r['hscroll']: fails.append(f'[{tag}] horizontale scroll')
            # zonder doctype staat de pagina in quirks-modus, zonder viewport-regel rekent een telefoon met 980 px breedte
            if r['mode'] != 'CSS1Compat': fails.append(f'[{tag}] documentmodus {r["mode"]}, moet CSS1Compat (doctype ontbreekt)')
            if r['pn'] is not None and r['pn'] < 1: fails.append(f'[{tag}] nummergegevens in #pn onleesbaar of leeg ({r["pn"]})')
            if touch and r['iw'] != w: fails.append(f'[{tag}] schermbreedte {r["iw"]} px in plaats van {w} (viewport-regel ontbreekt)')
            ctx.close()
        br.close()
    errs = [l for l in logs if 'error' in l.lower() or 'PAGEERROR' in l]
    for l in logs[:30]: print('  ' + l[:300])
    fails += errs
    print('PUBLICATIEROOKTEST OK' if not fails else 'PUBLICATIEROOKTEST NIET OK:\n  ' + '\n  '.join(fails))
    return 1 if fails else 0


if __name__ == '__main__':
    sys.exit(main())
