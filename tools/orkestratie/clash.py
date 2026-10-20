"""Clash: doordringing en kleinste afstand van knopen tegen de rest van het model.

    python3 tools/orkestratie/clash.py KNOOP [KNOOP...] [--straal MM] [--tegen KNOOP...] [--punt MM] [--tol MM]
                                       [--toegestaan BESTAND.json] [--max N] [--json UIT.json]

KNOOP is een knoopnaam of een pad (Groep/Deel/Onderdeel); alle meshes eronder tellen mee. Van elk mesh worden de
oppervlaktepunten bemonsterd (driehoeken, ongeveer --punt mm, standaard 5, in wereldcoordinaten in de gemonteerde stand).
Tegen elk ander mesh (standaard alle meshes van het model, ook binnen dezelfde hoofdgroep; --tegen beperkt dat tot
de meshes onder de genoemde knopen; de eigen afstammelingen van de knoop tellen niet mee) wordt per paar gemeten:
  - de kleinste afstand van de punten tot het oppervlak van het andere mesh, tot --straal mm (standaard 10);
  - of punten binnen het andere mesh liggen (straal door het punt, oneven aantal snijpunten met het mesh = binnen,
    drie richtingen met meerderheid), en hoe diep: de grootste afstand van een binnenpunt tot het oppervlak.
Beide richtingen worden gemeten (punten van A tegen B en van B tegen A). Een paar is per knooppad samengenomen.

Uitvoer: per paar de afstand in mm, negatief bij doordringing (de grootste diepte, een schatting op de puntdichtheid),
oplopend gesorteerd, met de twee paden en de plek (wereldcoordinaten in mm). Het binnen-in-oordeel is alleen
betrouwbaar als het omhullende mesh gesloten is (elke gelaste rand bij twee driehoeken). Is het niet gesloten (een schaal,
een buis met open uiteinden), dan betekent 'binnen' alleen 'achter het oppervlak': dat staat er als ONZEKER, NIET GESLOTEN
bij, met het aantal punten, en telt niet als doordringing. Oppervlakken die elkaar snijden zonder
dat een bemonsterd punt erin ligt (dunne platen, open meshes) geven een afstand rond nul of kleiner dan de puntafstand,
geen negatieve waarde.

--toegestaan: JSON-lijst met objecten {"a": patroon, "b": patroon, "reden": tekst, "max_diepte_mm": getal (optioneel)}.
Patronen zijn fnmatch-patronen op het pad zonder wortelnaam (zoals tools/open_allow.json); a en b mogen omgekeerd staan.
Toegestane paren staan in de uitvoer met 'toegestaan' en tellen niet mee voor de exitcode.

Exitcode 1 als een niet-toegestaan paar doordringt (afstand onder -tol mm, standaard 0,05), 2 bij een fout in de
argumenten of een onbekende knoop. Met --json komt alles ook in een bestand.
"""
import sys, os, json, argparse, fnmatch
sys.path.insert(0, os.path.join(os.path.dirname(os.path.abspath(__file__)), '..'))  # tools/ van deze checkout
from harness import session

HERE = os.path.dirname(os.path.abspath(__file__))


def toegestaan(paar, lijst):
    for e in lijst:
        for x, y in ((paar['a'], paar['b']), (paar['b'], paar['a'])):
            if fnmatch.fnmatchcase(x, e['a']) and fnmatch.fnmatchcase(y, e['b']):
                if 'max_diepte_mm' in e and -paar['dist_mm'] > e['max_diepte_mm']:
                    continue
                return e.get('reden') or 'toegestaan'
    return None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n')[0], add_help=True)
    ap.add_argument('knopen', nargs='+', metavar='KNOOP')
    ap.add_argument('--straal', type=float, default=10.0, metavar='MM', help='zoekstraal voor afstanden in mm (10)')
    ap.add_argument('--tegen', nargs='+', metavar='KNOOP', help='alleen meshes onder deze knopen als tegenpartij')
    ap.add_argument('--punt', type=float, default=5.0, metavar='MM', help='puntafstand van de bemonstering in mm (5)')
    ap.add_argument('--tol', type=float, default=0.05, metavar='MM', help='diepte vanaf waar een paar telt als doordringing (0,05)')
    ap.add_argument('--toegestaan', metavar='BESTAND', help='JSON met toegestane paren')
    ap.add_argument('--max', type=int, default=60, metavar='N', help='hoeveel paren te tonen (60, 0 = alle)')
    ap.add_argument('--json', metavar='UIT', help='schrijf het resultaat als JSON')
    a = ap.parse_args()
    lijst = json.load(open(a.toegestaan, encoding='utf-8')) if a.toegestaan else []
    with session() as s:
        pg = s.page(1280, 800)
        pg.wait_for_function('window.__model && window.__model.ready', timeout=180000)
        pg.evaluate(open(os.path.join(HERE, 'meetlib.js'), encoding='utf-8').read())
        r = pg.evaluate('o => window.__meet.clash(o)', {'targets': a.knopen, 'tegen': a.tegen, 'R': a.straal / 1000, 'h': a.punt / 1000, 'tol': a.tol / 1000, 'cap': 300000})
        if r.get('fouten'):
            for f in r['fouten']: print('FOUT:', f)
            sys.exit(2)
        for w in r['waarschuwingen']: print('let op:', w)
        paren = []
        for p in r['paren']:
            q = {'a': p['a'], 'b': p['b'], 'dist_mm': round(p['dist'] * 1000, 3) if p['dist'] is not None else None,
                 'punten_binnen_ab': p['binnenAB'], 'punten_binnen_ba': p['binnenBA'], 'punten_ab': p['puntenAB'], 'punten_ba': p['puntenBA'],
                 'onzeker_ab': p['onzekerAB'], 'onzeker_ba': p['onzekerBA'], 'onzeker_diepte_mm': round(p['onzekerDiepte'] * 1000, 3),
                 'niet_gesloten_a': p['openA'], 'niet_gesloten_b': p['openB'],
                 'plek_mm': [round(v * 1000, 1) for v in p['plek']] if p['plek'] else None, 'meshes': p['meshes']}
            q['doordringing'] = q['dist_mm'] is not None and q['dist_mm'] <= -a.tol
            q['toegestaan'] = toegestaan(q, lijst) if q['doordringing'] else None
            paren.append(q)
        fout = [p for p in paren if p['doordringing'] and not p['toegestaan']]
        print(f"doelen: {', '.join(r['doelen'])} ({r['doelMeshes']} meshes) tegen {r['andereMeshes']} meshes; {r['kandidaten']} meshparen binnen {a.straal:g} mm; stand {r['stand']}")
        print(f"{len(paren)} paren binnen {a.straal:g} mm, doordringend of onzeker; {sum(1 for p in paren if p['doordringing'])} doordringend ({len(fout)} niet toegestaan)")
        for p in (paren if a.max == 0 else paren[:a.max]):
            vlag = []
            if p['doordringing']: vlag.append('TOEGESTAAN: ' + p['toegestaan'] if p['toegestaan'] else 'DOORDRINGING')
            if p['punten_binnen_ab'] or p['punten_binnen_ba']:
                vlag.append(f"binnen {p['punten_binnen_ab']}/{p['punten_ab']} (a in b), {p['punten_binnen_ba']}/{p['punten_ba']} (b in a)")
            if p['onzeker_ab'] or p['onzeker_ba']:
                wie = ' en '.join(x for x, f in (('b', p['niet_gesloten_b']), ('a', p['niet_gesloten_a'])) if f)
                vlag.append(f"ONZEKER, NIET GESLOTEN {wie}: {p['onzeker_ab']} (a achter b), {p['onzeker_ba']} (b achter a), tot {p['onzeker_diepte_mm']:.1f} mm; telt niet als doordringing")
            d = f"{p['dist_mm']:9.3f}" if p['dist_mm'] is not None else f"{'> ' + format(a.straal, 'g'):>9}"
            print(f"{d} mm  {p['a']}  <>  {p['b']}" + (f"  [{'; '.join(vlag)}]" if vlag else '') + (f"  @ {p['plek_mm']}" if p['plek_mm'] else ''))
        if a.max and len(paren) > a.max: print(f'... nog {len(paren) - a.max} paren (--max 0 voor alles)')
        if a.json:
            json.dump({'opties': {'knopen': a.knopen, 'tegen': a.tegen, 'straal_mm': a.straal, 'punt_mm': a.punt, 'tol_mm': a.tol}, 'model': r['stand'], 'paren': paren},
                      open(a.json, 'w', encoding='utf-8'), ensure_ascii=False, indent=1)
            print('geschreven:', a.json)
        s.report()
        sys.exit(1 if fout or s.errors() else 0)


if __name__ == '__main__':
    main()
