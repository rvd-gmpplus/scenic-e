"""Eigendomscontrole voor een agenttak vóór het samenvoegen.

    python3 tools/orkestratie/mergecheck.py [--met-index] DOMEIN COMMIT [BASIS]

Meldt welke bestanden de tak wijzigt, of ze binnen het eigendom van het domein vallen, en of alleen-lezen
bestanden (testbestanden van de orkestrator, index.html, docs) zijn aangeraakt. Exitcode 1 bij een overtreding.

index.html is voor elke tak een overtreding, ook voor het domein `orkestrator`: hij hoort bij src/ en de orkestrator bouwt
hem. De tests overschrijven hem niet meer (de harness bouwt naar een tijdelijke map, zie build_test in tools/harness.py),
maar een index.html die niet bij de src/ van de tak past, blijft een fout. Alleen de bewuste herbouw na de samenvoegingen
(golf 5b-3: fase 3.5, ronde 2, 3 en 8) en de publicatie gaan met --met-index, en dan alleen voor `orkestrator`.
"""
import os, sys, subprocess, fnmatch

REPO = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
OWN = {
    'app': ['src/head.html', 'src/core.js', 'src/app1.js', 'src/presetdata.js', 'src/presets.js', 'src/app2-panel.js', 'src/app2-controls.js', 'src/app2-labels.js', 'src/app2-input.js', 'src/app2-loop.js'],   # de testscripts (itest, ui_*, opentest) zijn alleen-lezen: zie READONLY
    'body': ['src/body.js', 'src/bodyparts.js', 'src/panorama.js'],
    'engine': ['src/engine1.js', 'src/engine2.js', 'src/engine3.js'],
    'drivetrain': ['src/drivetrain.js'],
    'chassis': ['src/chassis.js'],
    'interior': ['src/interior.js'],
    'systems': ['src/systems.js'],
    'data': ['src/partnumbers.js', 'docs/onderdeelnummers.csv', 'docs/onderdeelnummers-schema.md', 'data/*', 'tools/orkestratie/build_pn.py', 'tools/pncheck.py'],
    'docs': ['README.md', 'docs/*.md', 'docs/screenshots/*', 'CHANGELOG.md', 'handomdraai.md'],
    # de orkestrator mag alles; deze lijst dient om een orkestratortak te laten zien wat hij raakt
    'orkestrator': ['*'],
}
INDEX = 'index.html'   # de gebouwde pagina: voor elke tak een overtreding, behalve de bewuste herbouw (--met-index, alleen orkestrator)
# Alleen-lezen voor domeineigenaars: contracten, alle testscripts (ook itest, ui_*, opentest, visdiff), poortbestanden en de gebouwde pagina.
# Wijzigen alleen door de orkestrator (CLAUDE.md, Eigendom en contracten).
READONLY = ['build.py', 'auto.json', 'framework.json', 'tools/framework.py', 'VERSION', 'requirements.txt', 'LICENSE', 'CLAUDE.md', '.claude/*', 'tools/setup.sh', 'tools/harness.py', 'tools/smoke.py',
            'tools/integrity.py', 'tools/silhouette.py', 'tools/pubsmoke.py', 'tools/tri.py', 'tools/shot.py', 'tools/anchors.json',
            'tools/itest.py', 'tools/ui_*.py', 'tools/opentest.py', 'tools/visdiff.py', 'tools/anchorcheck.py', 'tools/lag3-vm.sh', 'tools/vm/*',
            'tools/open_allow.json', 'tools/orkestratie/*', 'index.html', 'docs/*', 'README.md', 'CHANGELOG.md', 'src/core.js', 'src/body.js']
# de docs zijn alleen-lezen voor de andere domeinen, niet voor het domein docs zelf; docs/cijfers.md blijft van de orkestrator
# (tools/orkestratie/cijfers.py maakt hem)
DOCS_EIGEN = ['docs/*', 'README.md', 'CHANGELOG.md']


def readonly(dom, f):
    if dom == 'docs' and f != 'docs/cijfers.md' and any(fnmatch.fnmatch(f, p) for p in DOCS_EIGEN):
        return False
    return any(fnmatch.fnmatch(f, p) for p in READONLY)


def main():
    argv = [a for a in sys.argv[1:] if a != '--met-index']
    met_index = len(argv) != len(sys.argv) - 1
    if len(argv) < 2 or argv[0] not in OWN:
        print(__doc__); print('domeinen:', ', '.join(OWN)); return 2
    dom, commit = argv[0], argv[1]
    base = argv[2] if len(argv) > 2 else subprocess.run(['git', '-C', REPO, 'merge-base', 'HEAD', commit], capture_output=True, text=True).stdout.strip()
    files = subprocess.run(['git', '-C', REPO, 'diff', '--name-only', f'{base}..{commit}'], capture_output=True, text=True, check=True).stdout.split()
    bad = []
    for f in files:
        # een alleen-lezen bestand is voor een domeineigenaar nooit eigen, ook als het in zijn domein ligt (core.js, body.js)
        ro = readonly(dom, f)
        owned = any(fnmatch.fnmatch(f, p) for p in OWN[dom]) and (dom == 'orkestrator' or not ro)
        if f == INDEX:
            owned, ro = met_index and dom == 'orkestrator', True
        tag = 'eigen' if owned else ('ALLEEN-LEZEN' if ro else 'VAN EEN ANDER')
        if not owned:
            bad.append(f)
        print(f'  {tag:14s} {f}')
    stat = subprocess.run(['git', '-C', REPO, 'diff', '--shortstat', f'{base}..{commit}'], capture_output=True, text=True).stdout.strip()
    print(f'{dom}: {len(files)} bestanden, {stat}; basis {base[:7]}, tak {commit[:7]}')
    if bad:
        print('OVERTREDINGEN:', *bad)
    return 1 if bad else 0


if __name__ == '__main__':
    sys.exit(main())
