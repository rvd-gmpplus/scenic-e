# Teststatus

Stand: 20 oktober 2026. De volledige ongewijzigde Linux-frameworktestset is groen op commit `9d2410ddd4f3d835782e1fbd308bc1696be6aed3`: [Acceptatie, alle 13 controles geslaagd](https://github.com/rvd-gmpplus/scenic-e/actions/runs/39427548325).

Dit is een eerste schematische implementatie; de geometrie is geen gevalideerd Renault-CAD-model.

## Herkomst en omgeving

Alle 49 generieke bestanden zijn byte voor byte gelijk aan laguna3 main `321661674a56d3fa96d91b98301d441b3d4285af` (versie 17). De definitieve geometrie staat in `8e217df`. De regressiebasis is gemaakt op GitHub Actions, Ubuntu, Python 3.12, Playwright 1.64.0 en three.js r147. Zie [baseline/HERKOMST.md](baseline/HERKOMST.md).

## Uitkomsten

| Controle | Uitkomst |
| --- | --- |
| GitHub-CI op de actuele geometrie | Geslaagd: lint, reproduceerbare pagina, nummergegevens, framework, smoke, integrity, silhouette en budgetpoort |
| Volledige frameworktestset | Alle 13 controles geslaagd in één GitHub-run, inclusief strikte openers, verborgen delen, interactie, publicatiepagina, beelden, visdiff en labelankers |
| Volledige onderdelenboom | In GitHub gecontroleerd tegen data/tree.json |
| Interactie desktop en mobiel | 65 controles, 0 fouten na de grote herstelronde |
| Verborgen onderdelen | Geen onterecht verborgen onderdelen, gesloten, alles open en zeven afzonderlijke openstanden |
| Openers | Alle zeven botsingsvrij; alle eindstanden en ondergrenzen goed |
| Blootleggen | Motorkap 1,0%; voorportieren 1,2%; achterportieren 1,7%; laadklep 0,0%; achterklep na de laatste statische afwerking 1,4%. Grens 2%; geen treffers op verborgen onderdelen |
| Batchweergave | Geen spookbatches; de achterklepcontrole is na de omgevingsherstart afzonderlijk herhaald met 0 fouten |
| Animatietijd | Volledige acceptatiepoort geslaagd met de ongewijzigde grens van 8 ms op software-rendering; geen toestelgarantie |
| Visuele regressie | Alle 20 presets uit twee afzonderlijke CI-rendersessies binnen de drempel van 1,5% |
| Labelankers | Beide CI-runs gelijk: 85 labels, 77 met een eigen oppervlak, 63 met vrije zichtlijn. Dit is de eerste referentie, geen claim dat ieder label vrij ligt |
| macOS, echte telefoon, onafhankelijke reviewer | Niet uitgevoerd in deze omgeving |

De volledige testlijst is `lint smoke integ sil inner opentest itest tri pub stats shots visdiff anchor`. Alle 13 eindigen in de definitieve acceptatierun met exitcode 0; de framework- en onderdelenboomcontrole zijn bovendien vooraf apart uitgevoerd. De testset en grenswaarden zijn ongewijzigd gebleven. [Samenvatting van de CI-uitvoer](testresultaten/acceptatie.txt).

De geometrie- en CI-cijfers staan in [cijfers.md](cijfers.md) en [testresultaten/stats.json](testresultaten/stats.json). De meetuitkomsten zijn ontwikkelcontroles; de silhouetdata is een geschatte ontwerpreferentie, geen onafhankelijke fotometing. Voor een aparte MY27-specificatie en werkelijke interne constructies is aanvullend bronmateriaal nodig.

## Afhankelijkheden en herhalen

`requirements.txt` blijft exact gelijk aan het framework. De aanvullende `requirements-visuals.txt` installeert NumPy voor `visdiff.py`; zonder die uitbreiding mist de bronrequirements die dependency. Installeer deze uitbreiding vóór de volledige lokale set:

```sh
bash tools/setup.sh
python3 -m pip install -r requirements-visuals.txt
bash tools/orkestratie/finaltests.sh uit/volledig
```

De generieke CI en nightly zijn ongewijzigd meegenomen. De eigen Acceptatie-workflow installeert de aanvullende dependency en bewaakt ook de volledige strenge set. Visuele basisbeelden worden alleen na inspectie overgenomen; de workflow voor voorbereiding overschrijft geen bestaande basis.

## Controleerbare CI-bronnen

- [Volledige groene acceptatieset](https://github.com/rvd-gmpplus/scenic-e/actions/runs/39427548325).
- [Groene reguliere CI met de vastgelegde beelden](https://github.com/rvd-gmpplus/scenic-e/actions/runs/39427548358).
- [Geslaagde tweede render- en basismeting](https://github.com/rvd-gmpplus/scenic-e/actions/runs/39425634497).
- [Eerste rendersessie](https://github.com/rvd-gmpplus/scenic-e/actions/runs/39424397511): presets, geometrie en ankers slaagden; de basisexport vond de ontbrekende NumPy-dependency, daarna opgelost met het aanvullende requirementsbestand.

Repository: https://github.com/rvd-gmpplus/scenic-e. Er is geen websitepublicatie aangevraagd.
