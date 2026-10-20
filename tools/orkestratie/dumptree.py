"""Boom als JSON (pad, naam, groep, ingesloten, kinderen, diepte). Gebruik: dumptree.py UIT.json"""
import sys, os, json
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))  # tools/ van deze checkout
from harness import session
out = sys.argv[1]
with session() as s:
    pg = s.page(1280, 800)
    pg.wait_for_function('window.__model && window.__model.ready', timeout=120000)
    data = pg.evaluate('''() => {
      const L = window.__model, res = [];
      (function walk(n, path) {
        const p = path ? path + '/' + n.name : n.name;
        res.push({ path: p, name: n.name, asm: !!n.asm, d: n.d || '', spec: n.spec || null, kids: n.kids.length, depth: n.depth });
        n.kids.forEach(k => walk(k, p));
      })(L.ROOT, '');
      return res;
    }''')
    json.dump(data, open(out, 'w'), ensure_ascii=False, indent=0)
    print(len(data), 'knopen', sum(1 for d in data if not d['asm']), 'onderdelen')
    s.report()
