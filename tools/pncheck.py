"""Controle van de onderdeelnummers: data/pn/ bouwt byte voor byte de gecommitte src/partnumbers.js en docs/onderdeelnummers.csv,
en (met --tree) data/tree.json is gelijk aan de boom van de pagina.

    python3 tools/pncheck.py            zonder browser: herbouw en vergelijk (exitcode 1 bij verschil of fout in de gegevens)
    python3 tools/pncheck.py --tree     ook de boom in de pagina vergelijken met data/tree.json (browser)
    python3 tools/pncheck.py --tree --update   schrijft data/tree.json opnieuw uit de pagina (daarna build_pn.py draaien)
"""
import sys, os, json, subprocess
HERE = os.path.dirname(os.path.abspath(__file__))
REPO = os.path.dirname(HERE)
r = subprocess.run([sys.executable, os.path.join(REPO, 'tools', 'orkestratie', 'build_pn.py'), '--check'])
rc = r.returncode
if '--tree' in sys.argv:
    sys.path.insert(0, HERE)
    from harness import session
    with session() as s:
        pg = s.page(800, 600)
        live = pg.evaluate("() => window.__model.ALL.map(n => uiPathOf(n))")
        s.report()
    tf = os.path.join(REPO, 'data', 'tree.json')
    old = json.load(open(tf, encoding='utf-8')) if os.path.exists(tf) else []   # een nieuwe auto heeft nog geen boom
    if '--update' in sys.argv:
        json.dump(live, open(tf, 'w', encoding='utf-8'), ensure_ascii=False, indent=0)
        print(f'data/tree.json bijgewerkt: {len(live)} paden (was {len(old)})')
    else:
        a, b = set(old), set(live)
        gone, new = sorted(a - b), sorted(b - a)
        print(f'boom: {len(live)} paden in de pagina, {len(old)} in data/tree.json; verdwenen {len(gone)}, nieuw {len(new)}')
        for p in gone[:20]: print('  verdwenen', p)
        for p in new[:20]: print('  nieuw', p)
        if gone or new: rc = 1
print('pncheck:', 'ok' if rc == 0 else 'FOUT')
sys.exit(rc)
