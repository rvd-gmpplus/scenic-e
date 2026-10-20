"""Visuele regressie: vergelijkt de PNG's in BEELDMAP met de gelijknamige PNG's in BASISMAP (de basislijn).

    python3 tools/visdiff.py BEELDMAP BASISMAP [--drempel 1.5] [--tolerantie 16] [--schaal 2] [--uit RAPPORT]
    python3 tools/visdiff.py --basislijn BRONMAP BASISMAP [--schaal 2]   # alleen de orkestrator: basislijn (ver)nieuwen

Elk nieuw beeld wordt eerst met een vaste factor verkleind (SCHAAL, standaard 2: 1280 x 800 wordt 640 x 400, Lanczos); de
basislijn staat al op die maat (een beeld dat die maat al heeft, zoals de basislijn tegen zichzelf, wordt niet verkleind). Daarna telt het script per beeld het aandeel pixels waarvan minstens een kanaal (R, G of B)
meer dan TOLERANTIE (0 tot 255) afwijkt van de basislijn. Ligt dat aandeel boven DREMPEL procent, dan is het beeld rood; dan
komt er een verschilbeeld (basis, nieuw, verschil in rood, op de verkleinde maat) in RAPPORT. Een beeld dat in een van beide
mappen ontbreekt of na het verkleinen een ander formaat heeft dan de basislijn, is ook rood. Een regel per beeld, onderaan een
samenvatting; exitcode 1 bij een rood beeld, anders 0.

De basislijn staat in docs/baseline/ en is gemaakt met `--basislijn` uit de uitvoer van tools/orkestratie/presetshots.py:
de beelden worden daarbij met SCHAAL verkleind en teruggebracht tot 256 kleuren (Pillow quantize met MAXCOVERAGE, dat de
grootste kleurfout klein houdt: hoogstens 12 stappen per kanaal op deze beelden, en kleinere bestanden geeft dan de
mediaansnede van docshots.py), zodat de 42 presets samen ruim onder de 3 MB blijven (elke vernieuwing komt opnieuw in de
git-geschiedenis). De standaardtolerantie van 16 ligt boven die kwantiseringsfout: een verse reeks op dezelfde stand geeft
0,000 procent afwijking op alle beelden, dus alles boven de drempel is een echte verandering van de weergave. Alleen de
orkestrator vernieuwt de basislijn, in een eigen commit met een voor/na-galerij (premortem, struikeldraad T8).

Pillow en numpy zijn nodig (requirements.txt); ontbreken ze, dan stopt het script met een melding en exitcode 2.
"""
import sys, os, argparse, json

try:
    from PIL import Image
    import numpy as np
except ImportError as e:  # pragma: no cover
    print('visdiff: Pillow en numpy zijn nodig (pip install -r requirements.txt): ' + str(e)); sys.exit(2)


def pngs(d):
    return sorted(f for f in os.listdir(d) if f.lower().endswith('.png'))


def verklein(im, schaal):
    """Verkleint met een vaste factor (Lanczos); schaal 1 laat het beeld zoals het is."""
    if schaal <= 1:
        return im
    return im.resize((max(1, im.width // schaal), max(1, im.height // schaal)), Image.LANCZOS)


def laad_paar(nieuw_pad, basis_pad, schaal):
    """Nieuw beeld en basislijn als arrays. Heeft het nieuwe beeld al de maat van de basislijn (bijvoorbeeld de basislijn
    tegen zichzelf), dan wordt het niet verkleind; anders met SCHAAL."""
    n, b = Image.open(nieuw_pad).convert('RGB'), Image.open(basis_pad).convert('RGB')
    if n.size != b.size:
        n = verklein(n, schaal)
    return np.asarray(n, dtype=np.int16), np.asarray(b, dtype=np.int16)


def pct(x):
    return f'{x:.2f}'.replace('.', ',') + ' %'


def vergelijk(nieuw, basis, tolerantie):
    """Geeft (aandeel afwijkende pixels in procent, masker) of (None, reden) bij een ander formaat."""
    if nieuw.shape != basis.shape:
        return None, f'formaat {nieuw.shape[1]}x{nieuw.shape[0]} (na verkleinen) tegen basis {basis.shape[1]}x{basis.shape[0]}'
    mask = (np.abs(nieuw - basis) > tolerantie).any(axis=2)
    return 100.0 * mask.mean(), mask


def verschilbeeld(nieuw, basis, mask, path):
    """Drie panelen naast elkaar: basis, nieuw, en nieuw in grijs met de afwijkende pixels in rood."""
    grijs = (nieuw.astype(np.float32).mean(axis=2) * 0.45 + 120).clip(0, 255).astype(np.uint8)
    d = np.stack([grijs, grijs, grijs], axis=2)
    d[mask] = (220, 30, 30)
    out = np.concatenate([basis.astype(np.uint8), nieuw.astype(np.uint8), d], axis=1)
    Image.fromarray(out).save(path, 'PNG', optimize=True)


def klein(src, dst, schaal):
    """Kopie op de verkleinde maat in 256 kleuren voor de basislijn. MAXCOVERAGE kiest het palet op de kleinste grootste
    kleurfout (hier hoogstens 12 stappen per kanaal) en comprimeert ongeveer de helft kleiner dan de mediaansnede."""
    im = verklein(Image.open(src).convert('RGB'), schaal)
    im.quantize(colors=256, method=Image.Quantize.MAXCOVERAGE).save(dst, 'PNG', optimize=True)
    return im.size


def maak_basislijn(bron, basis, schaal):
    os.makedirs(basis, exist_ok=True)
    namen = pngs(bron)
    if not namen:
        print(f'geen PNG in {bron}'); return 1
    oud = set(pngs(basis)) - set(namen)
    tot, maat = 0, None
    for f in namen:
        maat = klein(os.path.join(bron, f), os.path.join(basis, f), schaal)
        tot += os.path.getsize(os.path.join(basis, f))
        print('basis', f)
    for f in sorted(oud):
        print(f'let op: {f} staat in de basislijn maar niet in {bron} (met de hand verwijderen als de preset weg is)')
    print(f'{len(namen)} beelden in {basis} op {maat[0]}x{maat[1]} (schaal {schaal}), samen ' + f'{tot:,}'.replace(',', '.') + ' bytes')
    return 0


def main():
    ap = argparse.ArgumentParser(description=__doc__.split('\n\n')[0], formatter_class=argparse.RawDescriptionHelpFormatter, epilog=__doc__)
    ap.add_argument('beeldmap', help='map met nieuwe PNG\'s (bijvoorbeeld de uitvoer van presetshots.py); met --basislijn: de bronmap')
    ap.add_argument('basismap', help='de basislijn (docs/baseline)')
    ap.add_argument('--drempel', type=float, default=1.5, help='rood boven dit percentage afwijkende pixels per beeld (standaard 1,5)')
    ap.add_argument('--tolerantie', type=int, default=16, help='kanaalverschil (0 tot 255) dat nog als gelijk telt (standaard 16)')
    ap.add_argument('--schaal', type=int, default=2, help='vaste verkleiningsfactor vóór het vergelijken; de basislijn staat op die maat (standaard 2)')
    ap.add_argument('--uit', help='map voor de verschilbeelden van rode beelden en visdiff.json')
    ap.add_argument('--basislijn', action='store_true', help='schrijf BEELDMAP verkleind en in 256 kleuren naar BASISMAP (alleen de orkestrator)')
    a = ap.parse_args()
    if a.schaal < 1:
        print('schaal moet minstens 1 zijn'); sys.exit(2)
    if a.basislijn:
        sys.exit(maak_basislijn(a.beeldmap, a.basismap, a.schaal))
    for d in (a.beeldmap, a.basismap):
        if not os.path.isdir(d):
            print(f'geen map: {d}'); sys.exit(2)
    if a.uit:
        os.makedirs(a.uit, exist_ok=True)
    nieuw, basis = pngs(a.beeldmap), pngs(a.basismap)
    rood, uitkomst = [], {}
    for f in sorted(set(nieuw) | set(basis)):
        if f not in basis:
            print(f'ROOD {f}: geen basislijn (nieuw beeld; de orkestrator vernieuwt de basislijn)'); rood.append(f); uitkomst[f] = {'ok': False, 'reden': 'geen basislijn'}; continue
        if f not in nieuw:
            print(f'ROOD {f}: geen beeld in {a.beeldmap}'); rood.append(f); uitkomst[f] = {'ok': False, 'reden': 'geen beeld'}; continue
        n, b = laad_paar(os.path.join(a.beeldmap, f), os.path.join(a.basismap, f), a.schaal)
        p, mask = vergelijk(n, b, a.tolerantie)
        if p is None:
            print(f'ROOD {f}: {mask}'); rood.append(f); uitkomst[f] = {'ok': False, 'reden': mask}; continue
        ok = p <= a.drempel
        extra = ''
        if not ok and a.uit:
            dp = os.path.join(a.uit, f[:-4] + '.diff.png')
            verschilbeeld(n, b, mask, dp); extra = f', verschilbeeld {dp}'
        print(f'{"ok  " if ok else "ROOD"} {f}: {pct(p)} afwijkend (drempel {pct(a.drempel)}){extra}')
        if not ok: rood.append(f)
        uitkomst[f] = {'ok': bool(ok), 'procent': round(float(p), 3)}
    if a.uit:
        with open(os.path.join(a.uit, 'visdiff.json'), 'w', encoding='utf-8') as fh:
            json.dump({'drempel': a.drempel, 'tolerantie': a.tolerantie, 'schaal': a.schaal, 'beelden': uitkomst}, fh, ensure_ascii=False, indent=1)
    n_ok = sum(1 for v in uitkomst.values() if v['ok'])
    print(f'\nVISDIFF: {n_ok} van {len(uitkomst)} beelden binnen de drempel' + (', rood: ' + ', '.join(rood) if rood else ''))
    sys.exit(1 if rood else 0)


if __name__ == '__main__':
    main()
