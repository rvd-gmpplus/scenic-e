"""Kerncijfers van de pagina als één bron voor de documentatie: docs/cijfers.md uit stats.json (van stats.py) en,
als die er is, de JSON van tri.py --json.

    python3 tools/orkestratie/cijfers.py UIT/stats.json [UIT/tri.json] > docs/cijfers.md

De lijst grootheden is vast (zie VELDEN); een getal dat in een ander document staat, hoort hiernaar te verwijzen.
"""
import sys, json, subprocess, datetime

if len(sys.argv) < 2:
    print(__doc__); sys.exit(2)
st = json.load(open(sys.argv[1], encoding='utf-8'))
tri = json.load(open(sys.argv[2], encoding='utf-8')) if len(sys.argv) > 2 else None
try:
    commit = subprocess.run(['git', 'log', '--format=%h %ad', '--date=format:%Y-%m-%d', '-1'], capture_output=True, text=True).stdout.strip()
except Exception:
    commit = 'onbekend'
nl = lambda v: f'{int(v):,}'.replace(',', '.') if isinstance(v, (int, float)) else str(v)
per = st.get('perMainGroup', {})
budg = (tri or {}).get('budgetten', {})
cats = st.get('presetCategories', {})
t = st.get('timing') or {}
b = st.get('batchStats') or {}
out = []
out.append(f'# Kerncijfers\n\nGegenereerd door `tools/orkestratie/cijfers.py` uit `stats.json` op {datetime.date.today().isoformat()}, bron `{commit}`. Niet met de hand bewerken; andere documenten verwijzen hiernaar in plaats van getallen te herhalen.\n')
out.append('## Boom\n\n| Grootheid | Waarde |\n|---|---|')
for k, label in [('nodes', 'Knopen'), ('groups', 'Groepen'), ('parts', 'Onderdelen'), ('maxDepth', 'Diepte'), ('innerNodes', 'Ingesloten knopen (`inner`)'), ('presets', 'Presets')]:
    out.append(f'| {label} | {nl(st.get(k, "?"))} |')
out.append('| Presets per categorie | ' + ', '.join(f'{k} {v}' for k, v in cats.items()) + ' |')
out.append('\n## Driehoeken per hoofdgroep\n\n| Hoofdgroep | Onderdelen | Driehoeken | Budget |\n|---|---|---|---|')
for k, v in sorted(per.items(), key=lambda kv: -kv[1]['tris']):
    out.append(f"| {k} | {nl(v['parts'])} | {nl(v['tris'])} | {nl(budg[k]) if k in budg else ''} |")
out.append(f"| Totaal | {nl(st.get('parts', 0))} | {nl(st.get('triangles', 0))} | {nl(budg['totaal']) if 'totaal' in budg else ''} |")
out.append('\n## Tekenopdrachten (gemonteerd)\n\n| Stand | Waarde |\n|---|---|')
out.append(f"| Met gebundeld renderen | {nl(st.get('drawCallsBatched', '?'))} |")
out.append(f"| Zonder bundelen | {nl(st.get('drawCallsUnbatched', '?'))} |")
if b:
    out.append(f"| Batches | {nl(b.get('groups', 0))} groepen, {nl(b.get('batchMeshes', 0))} batchmeshes, {nl(b.get('replaced', 0))} losse meshes vervangen, {str(b.get('mb', '?')).replace('.', ',')} MB van {str(b.get('capMb', '?')).replace('.', ',')} MB |")
out.append('\n## Opstarttijdlijn (software-rendering van Chromium op de Mac die de cijfers meet, niet in de container; ms sinds het begin van de navigatie)\n\n| Moment | ms |\n|---|---|')
for k in ['script', 'buildStart', 'buildCar', 'startUp', 'render0', 'firstFrame', 'interactive', 'ready', 'batches']:
    if k in t: out.append(f'| {k} | {nl(t[k])} |')
if 'buildStart' in t and 'buildCar' in t:
    out.append(f"| duur buildCar() | {nl(t['buildCar'] - t['buildStart'] if t['buildCar'] > t['buildStart'] else t['buildCar'])} |")
out.append('\nDeze tijden zeggen niets over een echt apparaat; zie `docs/telefoontest.md`.\n')
print('\n'.join(out))
