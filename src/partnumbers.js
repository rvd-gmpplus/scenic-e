/* ===================== onderdeelnummers ===================== */
// Gegevens, geen code. Gemaakt door de orkestrator uit de geverifieerde onderzoeksbestanden (build_pn.py); niet met de hand bewerken.
// build.py zet het object als JSON in een eigen blok #pn (script van het type application/json); de pagina leest het pas als het
// paneel of het zoeken op nummer het nodig heeft (uiPnLazy in app2-panel.js). In het geheugen heeft PN_DATA de vorm hieronder.
// units: id -> { n, st: 'past' | 'vin' | 'nietgevonden', oe: [[nummer, opmerking, bewijs]], am: [[merk, nummer, opmerking, bewijs]],
//                var, per, note (alleen met pnToelichting in auto.json), src: [[url, label]], kz }; bewijs A, B, C of D (zie het paneel).
// kz (alleen bij een gekozen uitvoering voor de auto van de gebruiker): { o: [gekozen Renault-nummers], a: [[merk, nummer]], v: uitvoering, b: bewijs, z: zekerheid, g: grond, s: [bronnen] }.
// map: pad zonder wortel -> [unit-id, 'zelf' | 'deel' | 'set', regel]. Een pad dat niet in map staat, is 'niet onderzocht'.
//      In dit bestand staat map voorgecodeerd als lijst [p, rest, unit-id, relatie, regel?] in de volgorde van data/pn/map.json:
//      het pad is de eerste p tekens van het vorige pad plus rest; een lege regel valt weg (uiPnDecode in app2-panel.js).
// info: pad zonder wortel -> [[label, waarde, bron, zekerheid]] (onderhoud en bekende problemen).
const PN_DATA = {"meta":{"auto":"Scénic E-Tech electric EV89 MY26; MY27 niet afzonderlijk bevestigd","checked":"20 oktober 2026","status":"Geen geverifieerde onderdeelnummers."},"units":{"basis:tractieaccu":{"n":"Tractieaccu EV89 (geen nummer geverifieerd)","st":"nietgevonden","oe":[],"am":[],"var":"Actuele MY26 EV89 long range; kies een artikel uitsluitend op geverifieerde catalogusgegevens.","per":"accupakket","src":[["https://www.renault.nl/elektrische-autos/scenic.html","Renault-modelpagina; geen onderdelencatalogus"]]}},"map":[[0,"Elektrisch systeem/Tractieaccu","basis:tractieaccu","zelf","Geen onderdeelnummer geverifieerd."]],"info":{}};
