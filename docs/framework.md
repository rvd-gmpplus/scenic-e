# Framework voor explosietekeningen

Dit document beschrijft hoe een auto in deze opzet wordt gemodelleerd en hoe je dat voor een volgende auto herhaalt. Het is de bovenlaag boven [ontwerp-en-architectuur.md](ontwerp-en-architectuur.md) (de techniek van de app en de engine), [testen.md](testen.md) (de tests) en [sjabloon-contract.md](sjabloon-contract.md) (het bouwcontract per auto). laguna3 is de referentie: hier ontstaat en leeft het framework. espace5 is de tweede auto.

## Waarom een framework

espace5 is gemaakt door laguna3 versie 6 te kopiëren en de domeinbestanden opnieuw te schrijven. Gemeten op 16 oktober 2026: `core.js`, `app1.js`, `app2.js` en `head.html` verschilden 0 tot 16 regels van laguna3 versie 6, alleen in namen en teksten van de auto; de domeinbestanden (carrosserie, motor, onderstel, interieur, systemen) waren volledig eigen. Het kopiëren werkte, maar verbeteringen gingen niet meer mee. Sinds die kopie kreeg laguna3 het vangnet, toegankelijkheid, robuustheid, de visuele regressietest en de openstand die bij de wissel blijft staan; espace5 kreeg intussen een volledig documentgeraamte voor GitHub Pages, dat laguna3 miste (een telefoon toonde de Pages-versie op 980 px breedte). `tools/framework.py vergelijk ../espace5` telt 41 van de 41 generieke bestanden als afwijkend of ontbrekend.

Het framework maakt de scheiding hard: wat generiek is, is per auto byte voor byte gelijk en komt uit deze repo; wat bij de auto hoort, staat in eigen bestanden en in `auto.json`.

## Hoe de modellering is opgezet

1. **Alles in code, één pagina.** Geen modelbestanden: elk onderdeel is een stuk geometrie in JavaScript (three.js r147, de laatste versie met de klassieke `examples/js`). `build.py` plakt `src/` tot één `index.html`. Dat maakt elke maat controleerbaar in een diff en elke auto reproduceerbaar uit de bron.
2. **Een boom van knopen.** `A(naam, opties, kinderen)` voor een groep en `P(naam, geometrie, materiaal, opties)` voor een onderdeel, met verplicht `d` (Nederlandse beschrijving), `spec` alleen voor geverifieerde feiten, `ex` als uitklapvector, `inner` voor wat van buiten nooit te zien is, `open` voor wat opengaat, `hideWhen` voor wat uitgenomen wordt en `uitsteek` (meter) voor een deel dat bewust voor of achter de lengte ZF..ZR uitsteekt, zoals een trekhaak. De wortel heeft in elke auto dezelfde acht hoofdgroepen in dezelfde volgorde: Carrosserie, Interieur, Aandrijflijn, Onderstel, Koeling en luchtinlaat, Uitlaatsysteem, Brandstofsysteem, Elektrisch systeem. Details: [ontwerp-en-architectuur.md](ontwerp-en-architectuur.md), Knoop-API.
3. **Vaste assenstelsels.** Het autoframe in meter: x naar links, y omhoog vanaf de grond, z naar voren, de auto in de lengte gecentreerd. Daarnaast een motorframe (oorsprong op de krukas-as) met vaste omrekeningen naar het autoframe. Elk domein rekent in deze frames en met de huidfuncties van de carrosserie (`HW`, `YB`, `YT`, `surfX`), niet met losse getallen.
4. **Domeinen met eigenaars.** Eén bestand of groep bestanden per domein (carrosserie, motor, aandrijving, onderstel, interieur, systemen), elk met een eigen voorvoegsel voor functies, materialen en cachesleutels. Domeinen werken parallel in eigen worktrees en praten alleen via het contract.
5. **Een contract per auto.** Vóór het bouwen legt `docs/contract.md` vast: de auto, de hoofdmaten, het motorframe, het kapprofiel, de aansluitpunten, de ankernamen, eigendom, budgetten en openers. Sjabloon: [sjabloon-contract.md](sjabloon-contract.md).
6. **Onderzoek eerst, met status per feit.** Specificaties komen uit brochures, werkplaatshandboeken, de RDW en de eigenaar, elk met een bron en een status (bevestigd, aannemelijk, geschat). Het silhouet wordt gemeten uit zij- en bovenaanzicht en vastgelegd als meetpunten; de carrosserie moet daar binnen de tolerantie op liggen.
7. **Poorten in plaats van vertrouwen.** Elke stap heeft een test die faalt als het misgaat: bouwcontroles, rooktest, integriteit (ankers, maten, ruimte onder de kap, uitsteken), silhouet, ingesloten delen, openers (botsing, ondergrens, blootleggen), interactie, budgetten, publicatie per kanaal, visuele regressie en labelankers. Daarnaast een visuele poort met beoordelaars op vaste kenmerken. Lijst en betekenis: [testen.md](testen.md).
8. **Publiceren met teruglezen.** GitHub Pages serveert `index.html` (een volledig document); het artefact krijgt de kale pagina uit `build.py --bare`. Na elke publicatie worden beide teruggelezen en byte voor byte vergeleken.

## De lagen

`framework.json` zegt per bestand waar het hoort. Samengevat:

| Laag | Wat | Per auto |
|---|---|---|
| Generiek | `build.py`; `src/core.js`, `app1.js`, `presets.js` (de motor van presets en rondleiding), de bediening in `app2-panel.js`, `app2-controls.js`, `app2-labels.js`, `app2-input.js` en `app2-loop.js` (tot golf 5c-2 één `app2.js`), `head.html` (sjabloon met `{{velden}}`); de tests en de orkestratie in `tools/`; CI, de sessiehook, `framework.json`, dit document en het contractsjabloon | byte voor byte gelijk, uit laguna3 |
| Auto | `auto.json`; de domeinbestanden (`body.js` tot `systems.js`, `buildCar()` in `systems.js`); `presetdata.js` (categorieën, presets, rondleiding); `partnumbers.js` en `data/pn/`; `data/silhouet.json`; `tools/anchors.json` en `open_allow.json`; het onderzoek, het contract, de screenshots en de basislijn | eigen werk |
| Sjabloon | `CLAUDE.md`, het ontwerpdocument, `testen.md`, `telefoontest.md`, `.gitignore`, `LICENSE` | gekopieerd en aangepast |

### Het aansluitcontract tussen generiek en auto

Wat de generieke laag van een auto verwacht, en niet meer dan dat:

- `auto.json` met elk veld dat `head.html` (`{{veld}}`) en de code (`AUTO.veld`) gebruiken; `tools/framework.py check` toetst dat. Het veld `verboden` noemt termen van deze auto die nooit in een generiek bestand mogen staan.
- `buildCar()` geeft de wortel met de naam `AUTO.wortel` en de acht hoofdgroepen; Onderstel heeft precies Vooras en stuurinrichting, Achteras, Wielen en Remsysteem; de motor is een kind van Aandrijflijn waarvan de naam met `Motor ` begint; de motorkap heet `Motorkap`.
- `body.js` definieert `ZF`, `ZR` (lengte) en `BOD_WMAX`, `BOD_MIRW`, `BOD_H` (halve breedte zonder en met spiegels, hoogte); de huidfuncties `HW`, `YB`, `YT`, `surfX` zijn welkom (de tests gebruiken ze als ze bestaan).
- `data/silhouet.json` met de meetpunten; `planY` en `beltY` (hoogtebereik van de zijstralen en van het zoeken naar de raamlijn) zijn optioneel en staan standaard op die van laguna3 (0,22 tot 1,05 en 0,80 tot 1,15 m). Een hogere auto zoals espace5 zet ze zelf.
- `auto.json: docshots` is de lijst `[bestandsnaam, preset-id]` voor `docs/screenshots` (`tools/orkestratie/docshots.py`; `mobiel.png` komt er altijd bij).
- `auto.json: pnToelichting` zegt of de notitie bij een verkoopeenheid (`note`) als Toelichting in het paneel staat (espace5 ja; in laguna3 zijn het onderzoeksaantekeningen, daar nee).
- `presetdata.js` definieert `appCar`, `appCats`, `PRESETS` en `appTourSteps`.
- `partnumbers.js` definieert `PN_DATA` (leeg mag).
- De testhaak heet in elk model `window.__model`; `AUTO.hook` geeft er een tweede naam aan (laguna3: `__laguna`).

### Wat nog niet generiek is

Eerlijk benoemd, zodat het de volgende stap is en geen verrassing:

- `tools/itest.py` noemt onderdelen van de Laguna bij naam (motorkap, portieren, achterklep, hoedenplank) in een deel van zijn 222 controles. Het staat daarom onder auto. Volgende stap: de autospecifieke namen naar een testdeel in de autogegevens, zodat de controles zelf generiek worden.
- De poortcamera's (`gallery.py`, `gateshots.py`, `poort.js`) en `rays_bagage.py` zijn per auto.
- Het ontwerpdocument en `testen.md` mengen generieke uitleg met Laguna-feiten; ze staan onder sjabloon.

## Extra tests per auto (`extraTests`)

De vaste testlijst van `finaltests.sh` is generiek en blijft letterlijk gelijk (CI bewaakt de `TESTS`-regel). Wil een auto er eigen tests bij, zoals een meetscript of een poort die alleen voor haar model zin heeft, dan meldt ze die aan in `auto.json`; de generieke laag blijft autoneutraal. Het veld is optioneel en ontbreekt bij een auto zonder extra tests (dan is de uitvoer, `tests.txt` en de exitcode precies als zonder de haak).

```json
"extraTests": [
  {"naam": "meet", "cmd": ["python3", "tools/meet.py", "--uit", "{uit}/meet"], "uitleg": "meetpoort van deze auto"}
]
```

- `naam`: past op `^[a-z][a-z0-9_-]*$`, is uniek en botst niet met een vaste testnaam uit de `TESTS`-regel. De naam wordt de bestandsnaam `NAAM.txt` in de uitvoermap.
- `cmd`: een niet-lege lijst van teksten, het commando met argumenten (geen shell). `{uit}` wordt de absolute uitvoermap van de run en `{root}` de repowortel; het commando draait vanuit de repowortel. Een pad dat met `tools/` begint (ook als `{root}/tools/`) moet bestaan.
- `uitleg`: vrije tekst voor wie het leest; geen invloed op de run.
- Andere velden zijn een fout, zodat een typefout niet stil een test laat vervallen.

Hoe het werkt: `python3 tools/framework.py check` valideert het veld (rood bij een fout). `framework.py extra-namen` drukt de namen op één regel af (niets als het veld ontbreekt) en geeft exit 1 bij een ongeldig veld; `finaltests.sh` stopt dan meteen met een melding. Anders start `finaltests.sh` de extra tests als derde parallelle reeks naast de twee vaste, elk via `framework.py extra NAAM UITMAP`, dat de exitcode van het commando ongewijzigd doorgeeft (onbekende naam: 2). Elke extra test schrijft `NAAM.txt` met als laatste regel `exit N (Ns)`, telt in de eindlus mee (een ontbrekend `NAAM.txt` is FOUT) en staat na de vaste lijst in `tests.txt`.

Eigen scripts van de auto horen in het manifest onder `auto` (niet onder `generiek`), want ze verschillen per auto.

## Een nieuwe auto in stappen

Elke stap eindigt met een poort; pas als die groen is, begint de volgende.

| Stap | Wat | Poort |
|---|---|---|
| 0. Opzetten | `python3 tools/framework.py nieuw ../repo --id ID --wortel "Merk Model"`: generieke bestanden, sjablonen, `auto.json` en een beginauto met acht plaatshouders. | `python3 build.py`, `tools/smoke.py`, `tools/integrity.py` en `tools/tri.py --gate` groen (zo getoetst op 16 oktober met een proefauto); `tools/framework.py check` groen |
| 1. Onderzoek | Specificaties met bron en status, foto's van de auto van de eigenaar, RDW-gegevens; kenteken en chassisnummer nooit in de repo. | `docs/specificaties-en-bronnen.md` en `docs/onderzoek/` met een beslissing per open vraag |
| 2. Contract | `docs/contract.md` uit het sjabloon; `auto.json` met naam, teksten en verboden termen. | het contract volledig ingevuld; `framework.py check` groen |
| 3. Carrosserie | Silhouet meten naar `data/silhouet.json`; dan de carrosserie met de huidfuncties. Herkenbaarheid eerst: de auto moet op de eerste blik de juiste zijn. | `tools/silhouette.py` groen; visuele poort op de herkenningskenmerken |
| 4. Domeinen | Motor, aandrijving, onderstel, interieur en systemen parallel in worktrees, elk tegen het contract. | `tools/orkestratie/mergecheck.py`; na samenvoegen `integrity.py` 0 fouten en de budgetpoort |
| 5. Openers en presets | Openers met ondergrens, `presetdata.js`, de ankers in `anchors.json`. | `tools/opentest.py --strikt-min`, `ui_inner.py --open --strict`, integrity zonder ankerfouten |
| 6. Interactie | Het autodeel van de interactietest. | `tools/itest.py` met `ITEST_GATES=1` |
| 7. Onderdeelnummers | `data/pn/` in plakken met een verificatiepoort en lokvogels. | `tools/pncheck.py` |
| 8. Publiceren | Volledige set, visuele poort, `index.html` naar Pages, `build.py --bare` naar het artefact, teruglezen, `CHANGELOG.md` en `handomdraai.md`. | `tools/orkestratie/finaltests.sh` groen; beide kanalen byte voor byte |

## Werken met meerdere auto's

- **Een verbetering in de generieke laag ontstaat hier.** Daarna `python3 tools/framework.py export ../andere-repo` (eerst met `--droog`), in die repo `python3 build.py` en de testset, en committen daar. De export raakt de autobestanden niet en schrijft het bestand `FRAMEWORK` met de versie en de bron-commit.
- **Ontstaat een verbetering in een andere auto** (zoals het documentgeraamte in espace5), dan wordt die eerst hier overgenomen en daarna geëxporteerd. Nooit in twee repo's apart.
- **Afwijking meten:** `python3 tools/framework.py vergelijk ../andere-repo` geeft per generiek bestand gelijk, afwijkend of ontbrekend.
- **Bewaken:** `python3 tools/framework.py check` draait in CI; een autonaam of motorcode in een generiek bestand is rood.

## Wat golf 5b-2 aan de generieke laag toevoegde

Op 16 oktober 2026 kwamen in laguna3 (golf 5b-2, versie 9, in `main` sinds `3be230e`) de volgende generieke wijzigingen. Ze staan in `framework.json` bij de generieke bestanden en zijn dezelfde avond met `framework.py export` naar espace5 gebracht, op de tak `framework-laguna3-v9` (niet in de `main` van espace5, want die publiceert de pagina van espace5):

- `tools/harness.py`: Google Fonts-verzoeken worden uit een lokale cache beantwoord (`~/.cache/explosietekening/fonts`), omdat Chromium op macOS met `net::ERR_SOCKET_NOT_CONNECTED` faalde zodra een tweede pagina laadde terwijl de eerste nog renderde. Een auto die op macOS test, heeft dit nodig.
- `tools/orkestratie/finaltests.sh`: `VISDIFF_BASIS` kiest een andere basislijn voor `visdiff`. De basislijn (`docs/baseline`) hoort bij een auto en bij een platform: software-rendering wijkt tussen macOS, een Linux-container en een Linux-VM 2 tot 33 procent per beeld af. Een nieuwe auto maakt dus eigen basislijnen en meet op een ander platform eerst een eigen basis van een groene startstand.
- `tools/orkestratie/clash.py`, `huid.py` en `meetlib.js`: meting van doordringing tussen delen (ook binnen een hoofdgroep, waar `integrity.py` niet kijkt) en van de afwijking van een buitenhuid. Ze kennen geen onderdeelnamen; een toegestaan paar staat per auto in `data/clash-toegestaan.json` (autobestand). Bij een nieuwe auto is `clash.py` de eerste maat om de eigen kalibratie te toetsen: kies een bekend geval, zoals de laguna3-meting op het Leidingblok met de Koude laadluchtslang (-10,5 mm), en kijk of het script het vindt.
- `tools/orkestratie/mergecheck.py`: `src/core.js` en `src/body.js` zijn voor domeineigenaren alleen-lezen (voorheen telde "eigen" vóór "alleen-lezen").
- `tools/orkestratie/shots.py`: wacht twee animatieframes en gebruikt `MODEL_TIMEOUT_MS`.
- `src/core.js`: `hexBolt` met steel 6 en ring 8 segmenten (minder driehoeken per bout in elke auto; de tekenopdrachten blijven gelijk). De verdere generieke opschoning van `core.js` (G8e: gedeelde constructies als bellows, slangklem en Sutherland-Hodgman) is in golf 5b-3 gedaan (zie hieronder) en gaat eenmalig met een export naar espace5, niet in twee repo's apart.

Wat dit voor het framework betekent: de premortem van de golf leverde een patroon voor elke auto. Een poort die alleen het bestaande meet (`integrity.py` slaat de Carrosserie over), laat de schade van nieuwe geometrie door; meet dus eerst met `clash.py` en `huid.py` op een bekend geval, en geef elke tak een presetlijst vooraf zodat elk rood beeld aan één wijziging hangt.

## Wat golf 5b-3 aan de generieke laag toevoegde

Op 17 oktober 2026 kwamen in laguna3 (golf 5b-3, versie 10, gepubliceerd vanaf `main` op `d3fe58f`; inhoud van de tak `golf-5b3` tot en met ronde 9, stand `b775511`) de volgende generieke wijzigingen. `framework.py check` is groen (45 generieke bestanden). De export naar espace5 (stap 3.3 van het plan) staat op de espace5-tak `golf-5b3-export` (nu `bcb15a4`, export `3606ebe` uit laguna3 `3e5e491`, plus `index.html` herbouwd; Mac-set functioneel groen, itest 152 van 152; `visdiff` op de Mac tegen de eigen Mac-basis van espace5 `main` 49 van 51, rood 11-injection en 44-openHood): de export zelf en een eigen commit die de lokale kopieën weghaalt, geometrie-hash gelijk. De tak is nog niet samengevoegd; dat gebeurt pas na een eigen testset in espace5 en een `visdiff` tegen een basis van hetzelfde platform als de espace5-basislijn (los van versie 10).

- `src/core.js`: nieuwe generieke helpers `bellows` (verplaatst uit `drivetrain.js`), `hexNut`, `hoseClamp` (met en zonder schroef), `hinge`, `follow`, `clipPoly`, `weldAll`, `creasedWeld` en `ringPattern`, en `spring()` met de parameter `per` (punten per winding, standaard 14; bestaande sleutels en aanroepen blijven gelijk, ook in espace5). Een lokale const of function met een van deze namen op het hoogste niveau botst; lokale namen binnen een functie niet.
- In laguna3 zijn de lokale kopieën weg: `chsNut`, `chsClamp`, `sysClampGeo`, `intHinge`, `intFollow`, `intClip`, `engClip`, `bodWeldAll`, `panWeld` en `drvRing`; `engNut` blijft als dunne wrapper op `hexNut`. In espace5 zijn ze met de export weggehaald en de aanroepen omgezet, behalve `chsClamp`: daar zit het slotblokje op een andere plek dan `hoseClamp` kan maken.
- `build.py`: de tekstcontrole `lint_texts` leest nu `d`, `spec`, `note` en `label`; R1, R2, R4, R5 en R7 zijn fouten (R4, R5 en R7 waren meldingen). R7 leest de tabel `_voorvoegsels` in `auto.json` (per auto, dus niet in het generieke bestand): een auto zonder die tabel wordt niet op cachesleutels getoetst. Meet in espace5 eerst R4 en R5 als melding en los de treffers in de eigen teksten in dezelfde commit op, of laat ze daar als melding met een reden; laguna3 houdt dat niet op.
- `src/body.js`: `REAR_SPR`, `REAR_BEAM` en `SUB_ROD` (gedeelde maten voor achterveer, torsiebalk en koppelstang). Dit is auto-specifiek en niet generiek; espace5 heeft eigen maten.
- `src/app1.js` (commit `f63b185`, van `origin/main`, uit een andere sessie; ontstaan in Alto, `d3f8223`): de samenvoegmodus (gebundeld renderen, `uiBatchAdd`) kopieerde alleen `position` en `normal`, zodat onderdelen met een textuur in de samengevoegde stand zwart werden. Nu krijgt elke materiaalgroep met minstens één mesh met uv een uv-attribuut (nullen voor meshes zonder uv), en `uiGeoBytes` en de bytetelling rekenen 8 byte per vertex extra, zodat `uiBatchCap` klopt. Generiek, dus mee in de export; de batches zijn er groter door (zie [cijfers.md](cijfers.md)). Controleer in espace5 dat de export de huidige `app1.js` bevat (anders `framework.py export` opnieuw) en kijk handmatig naar een textuuronderdeel in de standaardmodus.
- `src/app1.js`, `src/app2.js` en `src/presets.js`: herkadrering als de layout van het dock verandert (`uiFitFree`, `uiRefitSoon`), en `uiRestore` herstelt kader, vrij beeld en gebruikerscamera. Dit gaat mee met de export. In laguna3 vangt itest controle 5 nu de camera na Stap terug; in espace5 is die fout nog niet getoetst, dus draai daar `tools/itest.py` na de export en kijk handmatig naar Stap terug op een preset met een andere kadrering.
- `tools/itest.py` is een autobestand en gaat dus niet mee: neem de controle 5 (camera na Stap terug) en de aanvulling van controle 7 (ook na 1,5 s) zelf over in de itest van espace5. Generiek: `tools/orkestratie/mergecheck.py` (testscripts en de VM-scripts zijn alleen-lezen voor domeineigenaren, ook `tools/visdiff.py`, `tools/anchorcheck.py`, `tools/lag3-vm.sh` en `tools/vm/*`; sinds `3673b17` is het domein docs wel eigenaar van `README.md`, `docs/*.md`, `CHANGELOG.md` en `handomdraai.md`, terwijl `docs/cijfers.md` van de orkestrator blijft: eerder woog alleen-lezen zwaarder dan het eigendom, zodat een docs-tak nooit groen kon worden) en `tools/orkestratie/cijfers.py` (de koptekst van de opstarttijdlijn zegt dat de tijden van de Mac komen, niet van de container).
- `tools/orkestratie/meetlib.js` (commit `a000772`, ronde 3 van golf 5b-3): de cache van de wereldgeometrie per mesh gold voor de hele paginasessie, zodat `clash.py` en `huid.py` in een open stand de geometrie van de eerste (dichte) stand gebruikten. De cache geldt nu per stand en ververst op geometrie, geometrieversie en `matrixWorld`. Een auto die metingen in open stand deed met een oudere `meetlib.js`, moet die metingen opnieuw doen; dichte metingen waren niet geraakt. De fix is geëxporteerd naar espace5 op de tak `golf-5b3-export` (nog niet samengevoegd). Bij een nieuwe auto: kalibreer `clash.py` ook in een open stand, op een bekend verschil (Portier linksvoor dicht tegen open geeft nu 1,18 m, was 0).

## Wat golf 5c-2 aan de generieke laag toevoegde

In laguna3 (golf 5c-2, versie 11, tak `golf-5c2`, stand `84b9adc`; nog niet in `main`) kwamen de volgende generieke wijzigingen. Het meeste is code-opruiming zonder gedrag: de geometrie-hash en de knoopvelden zijn gelijk gebleven. Alles hieronder gaat mee met `framework.py export`.

- `src/core.js`: `CFG`, de vaste getallen van de bediening op één plek (gebaren, tijden, rekenbudgetten per frame, indeling met de breekpunten). `TXT`, elke tekst die de code zelf op de pagina zet, met `TXT.num` (getallen met een decimale komma) en `TXT.procent`; een vertaling vervangt alleen de tabel. Wat per auto verschilt, blijft in `auto.json`. `roundPlate(poly, t, b, ri, seg, klein)` kreeg de optionele parameter `klein` (per hoek de keuze voor een kleine afronding); de lokale kopie `intRoundPlate` in `interior.js` is daarmee vervallen, ook in een doelauto die haar had. Een lokale const met de naam `CFG` of `TXT` op het hoogste niveau botst.
- `src/app1.js`: `initAppFields(n)`, het knoopschema in één functie (het waren circa 40 velden verspreid over het bestand); `uiWake()` en `requestRender()` voor de rustende renderlus (de lus stopt als er niets te doen is; wie camera of scène wijzigt, roept `requestRender()` aan).
- `src/app2.js` is opgedeeld in vijf bestanden met een vaste volgorde (`ORDER` in `build.py`): `app2-panel.js` (basis van de bediening, `UI_MODES` met één strategie per klikmodus, onderdeelnummers met `uiPnLazy`, selectie en paneel, boom en zoeken), `app2-controls.js` (handelingen, openen, weergave, presetmenu), `app2-labels.js`, `app2-input.js` (aanwijzen, gebaren, hint, toetsenbord) en `app2-loop.js` (formaat, thema, renderlus, debug-overlay, deelbare stand, start en `window.__model`). Achterwaartse verwijzingen zijn naar voren gehaald, zodat een `const` of `let` nooit eerder wordt gelezen dan zijn regel. `framework.json` noemt de vijf bestanden als generiek.
- Nummergegevens (P1): `build.py` zet de regel `const PN_DATA = {...};` uit `partnumbers.js` als JSON in een eigen blok `<script type="application/json" id="pn">` en laat in het script `const PN_DATA = uiPnLazy();` staan; de pagina leest het blok pas als het paneel of het zoeken op nummer erom vraagt. Een stub die geen geldige JSON is (zoals de lege stub van `framework.py`), blijft gewoon JavaScript. `build_pn.py` schrijft de `map` voorvoegselgecodeerd (`[gedeeld met het vorige pad, rest, eenheid, relatie, regel?]`, in de volgorde van `data/pn/map.json`) en laat `note` weg zolang `pnToelichting` in `auto.json` niet aanstaat; `uiPnDecode` in `app2-panel.js` zet de map in de pagina terug. `pubsmoke.py` toetst het blok; de pagina meldt in de console als het blok ontbreekt.
- Overig: de tekenbuffer krijgt zijn maat vóór de WebGL-context (een inline script direct na het canvas in `head.html`; `setPixelRatio` in `core.js` maakt er dan meteen de juiste buffer van), één synchronisatie per handeling (`uiAfterAction`), geen DOM-schrijven per frame, dode code en dubbele hulpjes weg (K2, K3). De tak `u.info` blijft, omdat itest controle 15 hem toetst. `customProgramCacheKey` op het voorruitmateriaal (`glassWs`) is auto-specifiek en gaat niet mee.
- `framework.py check` blijft de poort voor de generieke laag; `build_pn.py` noemde in een commentaar de autonaam en is daarop gecorrigeerd (`a6fb48c`).

Export naar een doelauto (espace5), in deze volgorde:

1. `python3 /pad/naar/laguna3/tools/framework.py export .` in de doelauto, op een eigen tak.
2. Verwijder in de doelauto `src/app2.js` (de export zet de vijf `app2-*.js` ernaast, en `ORDER` in `build.py` noemt ze al); anders staat de bediening dubbel in de pagina.
3. Draai `tools/orkestratie/build_pn.py` opnieuw, zodat `src/partnumbers.js` de voorvoegselcodering en de uitgesloten `note` krijgt; een doelauto die de toelichting in het paneel wil, zet `pnToelichting` aan in `auto.json`.
4. `python3 build.py`, `framework.py check` en de volledige set; draai `pubsmoke.py` voor het blok `#pn`. Neem de lokale kopieën van `roundPlate` met een kleine afronding over naar de parameter `klein`.
5. Controleer dat de eigen tests die rechtstreeks op `PN_DATA`, de renderlus of `src/app2.js` leunen, nog kloppen: na een wijziging via interne namen is `requestRender()` nodig (zie `docs/testen.md`, Bevroren testcontract).

## Wat golf 5f en 5e aan de generieke laag toevoegde

In laguna3 (golf 5f en 5e, versie 12, tak `golf-5f`) kwamen twee generieke wijzigingen; de rest van de golf is autospecifiek (carrosserie, interieur, teksten). Beide gaan mee met `framework.py export` (espace5 versie 6).

- `src/core.js` en `src/app1.js`, `src/app2-controls.js` (F4): de tijden van de trapsgewijze beweging staan in `CFG.tijd`: `staffelS` (duiken), `tonenStaffelS` (tonen), `staffelMaxS` (samen hoogstens zolang, voor duiken en tonen), `allesStaffelS` en `allesStaffelMaxS` (alles uitklappen onder een groep). `uiStaffel(stap, k, max)` in `app1.js` geeft de wachttijd per laag: de stap, maar nooit meer dan `max` verdeeld over k lagen; bij `REDUCED` nul. `uiDive`, `uiRevealExplode` en `explodeAllUnder` gebruiken hem; de duur van één stap (`CFG.tijd.uitklapS`) blijft. Een doelauto met eigen waarden past alleen `CFG` aan.
- `tools/harness.py` en `tools/orkestratie/finaltests.sh`: `LAG3_GPU=1` start de testbrowser op de echte GPU (ANGLE Metal, alleen macOS; op andere systemen stopt de harness met een melding) en meldt dat in het rapport. Alleen voor beelden die het oog beoordeelt (de herkenbaarheidspoort, de galerij); `finaltests.sh` zet de variabele uit, zodat de testset, `visdiff` en de basislijnen op SwiftShader blijven. De naam van de variabele is nog die van de eerste auto; een doelauto mag hem houden.

Autospecifiek en dus niet generiek: de `bod*`-constanten van de B-stijl en het staartvlak, de kaartlezer en de startknop in `interior.js`, en de ATF-tekst in `drivetrain.js`.

## espace5 naar het framework

Stand van 16 oktober: alle generieke bestanden wijken af of ontbreken, omdat espace5 op versie 6 is blijven staan. De overstap, in de sessie die aan espace5 werkt (niet vanuit hier, om haar werk niet te kruisen):

1. `auto.json` maken met de teksten die nu in `head.html`, `app2.js` en `presets.js` van espace5 staan, `hook: "__espace"`.
2. De presetlijst uit `presets.js` naar `src/presetdata.js`; `appCar` wordt `AUTO.wortel`.
3. Het silhouet uit `tools/silhouette.py` naar `data/silhouet.json`.
4. `python3 /pad/naar/laguna3/tools/framework.py export .` en daarna `python3 build.py`, `framework.py check` en de volledige set.
5. Eigen verbeteringen van espace5 in de generieke laag (de `openHint` per wortel, de toelichting bij een onderdeelnummer, `PN_DATA.meta.type`) eerst in laguna3 overnemen, dan exporteren. Stand: de `openHint` en `PN_DATA.meta.type` zijn al vervangen door `auto.json: openUitleg` en `pnType`; de toelichting is `pnToelichting`; daarbij kwamen de knoopoptie `uitsteek` (de trekhaak van espace5) en `planY` en `beltY` in het silhouet.
