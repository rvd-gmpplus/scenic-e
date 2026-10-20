"""Huid: bewaar de buitenkant van knopen en meet later hoeveel die verschoven is.

    python3 tools/orkestratie/huid.py --bewaar UIT.json KNOOP [KNOOP...]
    python3 tools/orkestratie/huid.py --vergelijk UIT.json [--zones [N]] [--grens MM] [--json UIT2.json]

--bewaar legt per knoop (naam of pad; alle meshes eronder) de wereldpunten van de huid vast: de vertices van alle
driehoeken, in wereldcoordinaten in de gemonteerde stand (na updateMatrixWorld), gededupliceerd op 0,1 micrometer.
Het bestand bevat ook de modelversie en de stand (preset, uitklap, geopende onderdelen) waarin het gemaakt is.

--vergelijk meet voor elk bewaard referentiepunt de afstand tot het nieuwe oppervlak van dezelfde knoop (het
dichtstbijzijnde punt op de driehoeken, dus niet het dichtstbijzijnde vertex) en geeft per knoop het aantal punten, het
maximum, het 95-percentiel, het gemiddelde en de plek van het maximum (referentiepunt en dichtstbijzijnd punt op het nieuwe
oppervlak, in mm). Op dezelfde stand is het maximum 0. De meting is een-richtings: ze ziet wat van de oude huid is
weggeschoven, niet wat er aan nieuw oppervlak bij is gekomen op plekken waar de oude huid geen punten had.
--zones [N] deelt het kader van de referentie per knoop in N x N x N vakken (standaard 3) en toont de vakken met de
grootste afwijking (aantal, maximum, 95-percentiel, kader in mm); dat wijst aan waar het verschil zit.
--grens MM: exitcode 1 als het maximum van een knoop boven de grens ligt. Exitcode 2 bij een fout (bestand, onbekende knoop).
"""
import sys, os, json, argparse, math
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))  # tools/ van deze checkout
from harness import session

HERE = os.path.dirname(os.path.abspath(__file__))


def pct(sorted_vals, p):
    if not sorted_vals: return 0.0
    return sorted_vals[min(len(sorted_vals) - 1, max(0, math.ceil(p * len(sorted_vals)) - 1))]


def mm(v): return round(v * 1000, 1)


def zones(punten, d, n):
    lo = [min(punten[k::3]) for k in range(3)]; hi = [max(punten[k::3]) for k in range(3)]
    ext = [max(hi[k] - lo[k], 1e-9) for k in range(3)]; vak = {}
    for i, dist in enumerate(d):
        c = tuple(min(n - 1, int((punten[3 * i + k] - lo[k]) / ext[k] * n)) for k in range(3))
        vak.setdefault(c, []).append(dist)
    rows = []
    for c, v in vak.items():
        v.sort()
        rows.append({'vak': list(c), 'n': len(v), 'max_mm': round(v[-1] * 1000, 3), 'p95_mm': round(pct(v, 0.95) * 1000, 3),
                     'kader_mm': [[mm(lo[k] + ext[k] * c[k] / n), mm(lo[k] + ext[k] * (c[k] + 1) / n)] for k in range(3)]})
    rows.sort(key=lambda r: -r['max_mm'])
    return rows


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0])
    ap.add_argument('knopen', nargs='*', metavar='KNOOP')
    ap.add_argument('--bewaar', metavar='UIT.json')
    ap.add_argument('--vergelijk', metavar='REF.json')
    ap.add_argument('--zones', nargs='?', const=3, type=int, metavar='N')
    ap.add_argument('--grens', type=float, metavar='MM')
    ap.add_argument('--json', metavar='UIT2.json', help='schrijf de meetresultaten van --vergelijk als JSON')
    a = ap.parse_args()
    if bool(a.bewaar) == bool(a.vergelijk):
        ap.error('geef precies een van --bewaar en --vergelijk')
    if a.bewaar and not a.knopen:
        ap.error('--bewaar vraagt minstens een KNOOP')
    if a.vergelijk and a.knopen:
        ap.error('--vergelijk neemt de knopen uit het referentiebestand; geen KNOOP-argumenten')
    ref = None
    if a.vergelijk:
        try:
            ref = json.load(open(a.vergelijk, encoding='utf-8'))
        except (OSError, ValueError) as e:
            print('FOUT: referentie niet te lezen:', e); sys.exit(2)
    with session() as s:
        pg = s.page(1280, 800)
        pg.wait_for_function('window.__model && window.__model.ready', timeout=180000)
        pg.evaluate(open(os.path.join(HERE, 'meetlib.js'), encoding='utf-8').read())
        if a.bewaar:
            r = pg.evaluate('n => window.__meet.huidBewaar(n)', a.knopen)
            if r['fouten']:
                for f in r['fouten']: print('FOUT:', f)
                sys.exit(2)
            os.makedirs(os.path.dirname(os.path.abspath(a.bewaar)), exist_ok=True)
            doc = {'versie': 1, 'eenheid': 'm', 'model': r['model'], 'stand': r['stand'], 'knopen': r['knopen']}
            with open(a.bewaar, 'w', encoding='utf-8') as f:
                json.dump(doc, f, ensure_ascii=False, separators=(',', ':'))
            print(f"bewaard: {a.bewaar} (model {r['model']}, stand {r['stand']})")
            for k, v in r['knopen'].items():
                print(f"  {k}: {v['n']} punten uit {len(v['meshes'])} mesh(es)  [{v['pad']}]" + (f"  let op: {v['waarschuwing']}" if v['waarschuwing'] else ''))
            s.report()
            sys.exit(1 if s.errors() else 0)
        r = pg.evaluate('ref => window.__meet.huidVergelijk(ref)', ref)
        if r['fouten']:
            for f in r['fouten']: print('FOUT:', f)
            sys.exit(2)
        print(f"referentie: model {ref.get('model')}, stand {ref.get('stand')}\nnu:         model {r['model']}, stand {r['stand']}")
        if ref.get('stand') != r['stand']:
            print('let op: de stand verschilt van die van de referentie; verschillen kunnen daar vandaan komen')
        uit, over = {}, False
        for naam, k in ref['knopen'].items():
            n = r['knopen'][naam]; d = n['d']; punten = k['punten']
            srt = sorted(d); i = max(range(len(d)), key=d.__getitem__) if d else 0
            m = {'n': len(d), 'max_mm': round(srt[-1] * 1000, 3) if d else 0.0, 'p95_mm': round(pct(srt, 0.95) * 1000, 3), 'gem_mm': round(sum(d) / max(1, len(d)) * 1000, 3),
                 'plek_ref_mm': [mm(v) for v in punten[3 * i:3 * i + 3]] if d else None, 'plek_nieuw_mm': [mm(v) for v in n['cp'][3 * i:3 * i + 3]] if d else None,
                 'driehoeken_nu': n['nieuwTriangles'], 'meshes_nu': n['nieuwMeshes'], 'meshes_ref': len(k['meshes'])}
            boven = a.grens is not None and m['max_mm'] > a.grens
            over = over or boven
            print(f"{naam}: {m['n']} punten  max {m['max_mm']:.3f} mm  p95 {m['p95_mm']:.3f} mm  gem {m['gem_mm']:.3f} mm"
                  + (f"  max op {m['plek_ref_mm']} (nieuw oppervlak bij {m['plek_nieuw_mm']})" if m['max_mm'] > 0 else '')
                  + (f"  BOVEN GRENS {a.grens:g} mm" if boven else '')
                  + (f"  let op: {m['meshes_ref']} mesh(es) bewaard, nu {m['meshes_nu']}" if m['meshes_ref'] != m['meshes_nu'] else ''))
            if a.zones:
                m['zones'] = zones(punten, d, a.zones)
                for z in [z for z in m['zones'] if z['max_mm'] > 0][:8]:
                    print(f"    vak {z['vak']}  n {z['n']}  max {z['max_mm']:.3f} mm  p95 {z['p95_mm']:.3f} mm  kader x {z['kader_mm'][0]} y {z['kader_mm'][1]} z {z['kader_mm'][2]} mm")
            uit[naam] = m
        if a.json:
            json.dump({'ref': a.vergelijk, 'grens_mm': a.grens, 'knopen': uit}, open(a.json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('geschreven:', a.json)
        s.report()
        sys.exit(1 if over or s.errors() else 0)


if __name__ == '__main__':
    main()
