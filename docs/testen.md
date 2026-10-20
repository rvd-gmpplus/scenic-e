# Testen

```sh
bash tools/setup.sh
python3 -m pip install -r requirements-visuals.txt
python3 build.py --lint
python3 tools/framework.py check
python3 tools/pncheck.py --tree
bash tools/orkestratie/finaltests.sh uit/volledig
```

De originele generieke tests, CI en nightly zijn ongewijzigd meegenomen. `tools/itest.py` is het auto-eigen interactiedeel voor de Scénic. Testuitvoer hoort onder `uit/`, niet als ongestructureerde bestanden in Git. [teststatus.md](teststatus.md) bevat de feitelijke uitslagen en beperkingen.

`integrity.py` controleert maten, geometrie en ankers; `silhouette.py` toetst de expliciet geschatte ontwerpreferentie; `tri.py --gate` bewaakt budgetten. `opentest.py --strikt-min` meet alle zeven openers, inclusief botsingen en zicht. `ui_inner.py --open --strict` zoekt onterecht verborgen geometrie. `pubsmoke.py` toetst desktop, telefoon en CDN/SRI. `anchorcheck.py` bewaakt labelankers en `visdiff.py` vergelijkt met een basis op hetzelfde renderplatform.

Een nieuwe regressiebasis is alleen een beginpunt voor volgende wijzigingen, geen bewijs dat de vorm een ingemeten Renault-model is. MacOS en een onafhankelijke visuele reviewer zijn in deze Linux-omgeving niet beschikbaar; een groene Linux-set mag niet worden omschreven als die bredere verificatie.
