# Sjabloon: bouwcontract voor een nieuwe auto

Kopieer dit bestand naar `docs/contract.md` van de nieuwe auto en vul elke tabel in vóór de domeinen beginnen. Het contract legt vast wat de domeineigenaars van elkaar mogen verwachten. Wie een waarde wijzigt, meldt dat aan de orkestrator. De architectuur van de app (knoop-API, uitklaplogica, klikregel, modus Openen, bundelen, `inner`, `hideWhen`) is generiek en staat in `docs/ontwerp-en-architectuur.md` van de referentie (laguna3); die verandert per auto niet. Voorbeelden tussen haakjes komen uit laguna3 en espace5.

## 1. De auto

| Onderwerp | Keuze | Bron |
|---|---|---|
| Model en fase | (Renault Laguna III, fase 2, 2011) | onderzoek |
| Uitvoering | (Initiale Paris) | eigenaar |
| Lak | (Gris Platine, zilvergrijs metallic) | eigenaar, foto's |
| Wielen en banden | (225/45 R18) | onderzoek |
| Motor | code, cilinderinhoud, boring x slag, vermogen, koppel | onderzoek |
| Bak | (automaat AJ0, zes versnellingen) | onderzoek |
| Bijzonderheden | (panoramadak, geen 4Control) | eigenaar |

Kenteken en chassisnummer van de eigenaar komen nooit in de repo, de pagina of een commitbericht; alleen afgeleide feiten met de bron "volgens de RDW" of "volgens het chassisnummer van de eigenaar".

## 2. Assen en hoofdmaten (autoframe)

Meter. x links (+) en rechts (-), y omhoog vanaf de grond, z naar voren (+). De auto is in de lengte gecentreerd. `src/body.js` exporteert deze symbolen; de generieke tests lezen ze (framework).

| Symbool | Waarde | Herkomst |
|---|---|---|
| `ZF`, `ZR` | voorste en achterste punt | lengte |
| `AXF`, `AXR` | vooras en achteras | overhang en wielbasis |
| `AY` | hoogte van de wielas | bandstraal min indrukking |
| `TRACK_F`, `TRACK_R` | halve spoorbreedte | spoor |
| `BOD_WMAX` | halve breedte zonder spiegels plus 6 mm | breedte (`integrity.py`) |
| `BOD_MIRW` | halve breedte met spiegels plus 6 mm | breedte met spiegels (`integrity.py`) |
| `BOD_H` | hoogte onbeladen | brochure (`integrity.py`) |
| `HW`, `YB`, `YT`, `surfX` | de huid als functie van z | carrosserie; andere domeinen rekenen hiermee, niet met vaste getallen |

## 3. Motorframe en aandrijflijn

Oorsprong op de krukas-as, +x langs de krukas naar de vliegwielzijde, +y langs de cilinders omhoog, +z naar de inlaatzijde. Leg vast waar inlaat en uitlaat liggen, de cilindernummering, en de beginwaarden van `PT_POS`, `PT_TILT` en `GB_X`. Eisen: de as van het differentieel ligt binnen 3 cm van de hartlijn van de voorwielen; gebruik altijd `fromPT`, `toPT`, `ENG2CAR` en `PTM`.

## 4. Motorkap en ruimte in de motorruimte

Het kapprofiel staat in `body.js`. `integrity.py` faalt als een onderdeel minder dan 2,5 cm onder de buitenhuid van de motorkap blijft of minder dan 0,5 cm onder de laagste laag van de kap. Leg vast welke hoogte de motor tot de samenvoeging aanhoudt.

## 5. Aansluitpunten

`ENG_PORTS` (motorframe, `engine1.js`) en `DRV_PORTS` (`drivetrain.js`): de lijst sleutels, wat vervalt (zoals `psOut` en `psIn` bij elektrische besturing) en wat erbij komt.

## 6. Namen (ankers)

Elke naam komt precies een keer voor in de boom; `tools/anchors.json` is de lijst die getoetst wordt.

- Wortel: de naam uit `auto.json` (`wortel`), met precies deze acht kinderen in deze volgorde (framework, ook de kleuren per systeem): Carrosserie, Interieur, Aandrijflijn, Onderstel, Koeling en luchtinlaat, Uitlaatsysteem, Brandstofsysteem, Elektrisch systeem.
- `Onderstel` heeft precies vier kinderen: Vooras en stuurinrichting, Achteras, Wielen, Remsysteem.
- De motor is een kind van Aandrijflijn waarvan de naam met `Motor ` begint (Motor F4Rt, Motor M5M).
- De motorkap heet `Motorkap` (de ruimtetoets van `integrity.py` zoekt die naam).
- Per hoofdgroep de ankernamen die presets en tests gebruiken.

## 7. Eigendom en voorvoegsels

| Domein | Bestanden | Voorvoegsel |
|---|---|---|
| Carrosserie | `body.js`, `bodyparts.js`, `panorama.js` (als er een glazen dak is) | `bod`, `pan` |
| Motor | `engine1.js`, `engine2.js`, `engine3.js` | `eng` |
| Aandrijving | `drivetrain.js` | `drv` |
| Onderstel | `chassis.js` | `chs` |
| Interieur | `interior.js` | `int` |
| Systemen | `systems.js` (met `buildCar()`) | `sys` |
| App en framework | alles in `framework.json` onder generiek, plus `presetdata.js` | `ui`, `app` |

Functies, materialen en cachesleutels krijgen het voorvoegsel van de eigenaar.

## 8. Budgetten

In `tools/anchors.json`: driehoeken totaal (700.000) en per hoofdgroep, tekenopdrachten gemonteerd met bundelen onder 1.500, paginagrootte. `tri.py --gate` bewaakt ze.

## 9. Openers (modus Openen)

Lijst van openers met type (scharnier of schuif), volle hoek of slag, ondergrens `open.min` (minstens 0,8 maal de volle hoek of slag), `needs`, volgers, telescopen en wat met `hideWhen` uitgenomen wordt. Uitzonderingen op de botsingstoets in `tools/open_allow.json`, met reden.

## 10. Regels voor alle eigenaars

- `d` verplicht (Nederlandse beschrijving), `spec` alleen voor geverifieerde feiten in Nederlandse notatie, `ex` als uitklapvector, `inner` alleen voor wat van buiten nooit te zien is.
- Elke wijziging met `python3 build.py --lint`; voor samenvoegen `tools/orkestratie/mergecheck.py`; na samenvoegen de volledige set (`tools/orkestratie/finaltests.sh`).
- Een melding eerst narekenen met `pick.py`, `probe.py` of stralen; dan pas wijzigen.
