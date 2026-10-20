# Bouwcontract Scénic E-Tech electric

## Voertuig en assen

Actuele Nederlandse MY26 EV89 long range. Modeljaar 2027 niet afzonderlijk bevestigd. Hoofdmaten: [cijfers.md](cijfers.md). Autoframe in meter: x positief links, y omhoog vanaf de grond, z positief voor. Lengte gecentreerd. De asplaatsen zijn afgeleid uit de gepubliceerde overhangen. Geen verbrandingsmotorframe; elektrische aandrijving gebruikt het autoframe.

## Geometrie

`body.js` levert de maatconstanten, paneeltriangulatie, kooi en vaste carrosserie. `bodyparts.js` levert portieren, kleppen en lichtsignaturen; `panorama.js` het vaste dak. Panelen hebben een schematische huid; interne dwarsdoorsneden zijn niet uit CAD afgeleid. De wielbogen blijven vrij van de gelakte zijschermen. Wielkuipen, schutbord en onderplaten sluiten de motorruimte af. Het rechter voorscherm heeft een echte opening achter de laadklep. Vaste driehoeksruiten en stijlafwerking sluiten de portier- en achterklepranden.

`engine1.js` levert Motor E-Tech, `engine2.js` de Omvormer en `drivetrain.js` de vaste reductie en aandrijfassen. `systems.js` bevat de tractieaccu, lader, CCS-connector, boordvoeding en thermisch beheer. Alle domeinen maken uitsluitend A/P-knopen met Nederlandse beschrijvingen, eindige geometrie en uitklapvectoren.

## Boom en ankers

Wortel: `AUTO.wortel`. Acht vaste kinderen in frameworkvolgorde, conform `tools/anchors.json`. Onderstel heeft Vooras en stuurinrichting, Achteras, Wielen en Remsysteem. De verplichte motorgroep begint met Motor. Uitlaatsysteem en Brandstofsysteem bevatten uitsluitend de informatienoot Niet aanwezig met een onzichtbaar intern markersymbool; geen fysiek systeem wordt gesuggereerd.

## Openers

Motorkap, vier portieren, achterklep en laadklep. Scharnieren zijn schattingen, met `open.min` boven 80% van de volle hoek. Glas en binnenbekleding bewegen met het portier. Solarbay is vast en heeft geen opener. Ankers vermelden volledige paden. Bewegingsbotsingen en open-zichtmetingen worden met de oorspronkelijke frameworktests gerapporteerd.

## Framework en budget

De 49 generieke bestanden komen ongewijzigd uit laguna3 main, commit `3216616`. Aanpassingen blijven in autobestanden. De totale driehoekenpoort en budgetten per groep staan in `tools/anchors.json`. Nieuwe generieke ontwikkelingen moeten eerst in de bronrepo worden doorgevoerd en geëxporteerd.

## Bronnen en kwaliteit

Alleen bevestigde getallen komen in `spec`; schattingen staan in `d`. Geen VIN, kenteken, verzonnen onderdeelnummers, batterijchemie of moduleaantallen als feit. Silhouetdata is een ontwerpreferentie met expliciete herkomst. Dit is een eerste schematische implementatie, geen claim van gelijk detailniveau aan de jaren doorontwikkelde Laguna.
