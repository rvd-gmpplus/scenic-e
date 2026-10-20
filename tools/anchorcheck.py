"""Labelankers per preset: ligt het anker op het eigen onderdeel, en heeft het een vrije zichtlijn?

    python3 tools/anchorcheck.py [--json UIT.json] [--basis BASIS.json] [--only id,id]

Voor elke preset (zonder de rondleiding) zet het script de preset, rondt alle animaties af en leest de geplaatste labels
(`uiSpots`, dezelfde lijst als `__model.labelRects()`, met het ankerpunt op het scherm). Door elk ankerpunt gaat een
straal vanuit de camera over de aanklikbare meshes (`uiPickList()`, dezelfde lijst als een klik):

- eigen: op de straal ligt een treffer op het gelabelde onderdeel of een afstammeling binnen 1 cm van het ankerpunt
  (het anker zit dus op het eigen deel en niet in de lucht of op het midden van een kader);
- vrij: de eerste treffer op de straal is het gelabelde onderdeel of een afstammeling (niets staat ervoor).

Een anker kan eigen zijn zonder vrij (het ligt op het deel maar achter een ander deel) en andersom (de straal raakt eerst
het deel, maar het anker zelf ligt erachter in de lucht). Per preset en over alles samen: labels, eigen, vrij. Met
--json gaan de uitkomsten als JSON naar een bestand. De poort is "geen van beide totalen daalt": met --basis BASIS.json
(een eerder bewaarde uitvoer) is een lager totaal eigen of vrij rood (exitcode 1). Zonder --basis is het script
informatie; consolefouten geven altijd exitcode 1.

Vóór golf 4 lagen 261 van 345 ankers op het eigen deel en 84 achter een ander deel (36 presets; docs/testen.md,
"Labelankers"). Dit script maakt dat meetbaar en herhaalbaar op elke stand.
"""
import sys, os, json, argparse, subprocess
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from harness import session

JS = r"""(() => {
  const L = window.__model;
  const rc = new THREE.Raycaster(); rc.layers.enableAll();
  const ndc = new THREE.Vector2(), a = new THREE.Vector3();
  const r = canvas.getBoundingClientRect();
  camera.updateMatrixWorld(); L.ROOT.obj.updateMatrixWorld(true);
  const under = (n, k) => { for (let p = n; p; p = p.parent) if (p === k) return true; return false; };
  const list = uiPickList();
  const out = [];
  for (let i = 0; i < uiNPlaced; i++) {
    const sp = uiSpots[i], k = sp.k;
    uiLabelAnchor(k, a);
    const dist = a.distanceTo(camera.position);
    ndc.set((sp.ax / r.width) * 2 - 1, -(sp.ay / r.height) * 2 + 1);
    rc.setFromCamera(ndc, camera);
    const hits = rc.intersectObjects(list, false);
    const first = hits.length ? hits[0].object.userData.node : null;
    const eigen = hits.some(h => under(h.object.userData.node, k) && Math.abs(h.distance - dist) < 0.01);
    const vrij = !!first && under(first, k);
    out.push({ naam: k.name, eigen, vrij, voor: vrij || !first ? null : first.name });
  }
  return out;
})()"""


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument('--json', help='uitkomsten als JSON naar dit bestand')
    ap.add_argument('--basis', help='eerder bewaarde JSON; een lager totaal eigen of vrij is rood')
    ap.add_argument('--only', help='alleen deze preset-id\'s (komma\'s)')
    a = ap.parse_args()
    only = set(a.only.split(',')) if a.only else None
    try:
        commit = subprocess.run(['git', 'log', '--oneline', '-1'], capture_output=True, text=True, cwd=os.path.dirname(os.path.dirname(os.path.abspath(__file__)))).stdout.strip()
    except Exception:
        commit = ''
    per, tot = {}, {'labels': 0, 'eigen': 0, 'vrij': 0}
    with session() as s:
        pg = s.page(1280, 800)
        plist = [p for p in pg.evaluate('__model.presetList()') if not p['tour'] and (not only or p['id'] in only)]
        for p in plist:
            pg.evaluate(f"__model.preset({json.dumps(p['id'])}); __model.finishAll()")
            pg.wait_for_timeout(250)
            pg.evaluate('__model.finishAll()')
            rows = pg.evaluate(JS)
            n, e, v = len(rows), sum(1 for x in rows if x['eigen']), sum(1 for x in rows if x['vrij'])
            achter = [f"{x['naam']} achter {x['voor']}" for x in rows if x['eigen'] and not x['vrij']]
            lucht = [x['naam'] for x in rows if not x['eigen']]
            per[p['id']] = {'label': p['label'], 'labels': n, 'eigen': e, 'vrij': v, 'achter': achter, 'lucht': lucht}
            for k in tot: tot[k] += per[p['id']][k]
            print(f"{p['id']:<12} {n:>3} labels, eigen {e:>3}, vrij {v:>3}" + (f"; achter: {'; '.join(achter[:3])}" if achter else '') + (f"; in de lucht: {', '.join(lucht[:3])}" if lucht else ''))
        pg.close()
        s.report()
        errs = s.errors()
    print(f"\nTOTAAL over {len(plist)} presets: {tot['labels']} labels, eigen {tot['eigen']}, vrije zichtlijn {tot['vrij']}")
    rood = []
    if a.basis:
        with open(a.basis, encoding='utf-8') as fh:
            b = json.load(fh)['totaal']
        for k in ('eigen', 'vrij'):
            if tot[k] < b[k]: rood.append(f'{k} daalt van {b[k]} naar {tot[k]}')
        print('poort tegen ' + a.basis + ': ' + ('ok' if not rood else 'ROOD, ' + '; '.join(rood)))
    if a.json:
        with open(a.json, 'w', encoding='utf-8') as fh:
            json.dump({'commit': commit, 'viewport': '1280x800', 'totaal': tot, 'presets': per}, fh, ensure_ascii=False, indent=1)
        print('geschreven: ' + a.json)
    sys.exit(1 if rood or errs else 0)


if __name__ == '__main__':
    main()
