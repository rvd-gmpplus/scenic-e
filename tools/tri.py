"""Driehoeken per hoofdgroep en de 25 zwaarste onderdelen; met --gate een poort op de budgetten uit tools/anchors.json.

    python3 tools/tri.py            informatie, exitcode 0
    python3 tools/tri.py --gate     exitcode 1 zodra een hoofdgroep of het totaal boven zijn budget zit
    python3 tools/tri.py --json UIT.json   schrijft de cijfers ook als JSON

Per hoofdgroep staat ook het aantal onderdelen, zodat een zwaar deel dat naar een andere groep verhuist zichtbaar blijft.
"""
import sys, os, json, argparse
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import session

ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
ap.add_argument('--gate', action='store_true', help='faal boven de budgetten uit tools/anchors.json')
ap.add_argument('--json', default=None, help='schrijf de cijfers naar dit bestand')
a = ap.parse_args()
budgets = json.load(open(os.path.join(os.path.dirname(os.path.abspath(__file__)), 'anchors.json'), encoding='utf-8')).get('triangle_budgets', {})

with session() as s:
    pg = s.page(400, 300)
    r = pg.evaluate("""(() => { const out = {}, byTop = {}, parts = {}; let tot = 0;
      for (const m of window.__model.MESHES) { const g = m.geometry, t = (g.index ? g.index.count : g.attributes.position.count) / 3; tot += t;
        const n = m.userData.node, k = (n.parent ? n.parent.name + ' / ' : '') + n.name; out[k] = (out[k] || 0) + t;
        let top = n; while (top.parent && top.parent.parent) top = top.parent; byTop[top.name] = (byTop[top.name] || 0) + t; parts[top.name] = (parts[top.name] || 0) + 1; }
      return { tot, arr: Object.entries(out).sort((a, b) => b[1] - a[1]).slice(0, 25), byTop, parts }; })()""")
    fails = []
    def check(name, value):
        b = budgets.get(name)
        if b is None: return ''
        if value > b: fails.append(f'{name}: {int(value)} driehoeken boven budget {b}')
        return f'  (budget {b}, {"OVER" if value > b else "ok"})'
    print('totaal', int(r['tot']), check('totaal', r['tot']))
    for k, v in sorted(r['byTop'].items(), key=lambda kv: -kv[1]):
        print(f'{int(v):>8}  {k:<24} {r["parts"].get(k, 0):>5} onderdelen{check(k, v)}')
    print('zwaarste onderdelen:')
    for k, v in r['arr']: print(f'{int(v):>8}  {k}')
    if a.json:
        json.dump({'totaal': r['tot'], 'perGroep': r['byTop'], 'onderdelen': r['parts'], 'zwaarste': r['arr'], 'budgetten': budgets, 'fouten': fails}, open(a.json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
    s.report()
    if a.gate:
        for f in fails: print('FOUT', f)
        print('budgetpoort:', 'ok' if not fails and not s.errors() else 'FOUT')
        sys.exit(1 if fails or s.errors() else 0)
    sys.exit(1 if s.errors() else 0)
