# Ontwerp en architectuur

De Scénic gebruikt de generieke engine van laguna3 zonder lokale wijzigingen. [framework.md](framework.md) en [sjabloon-contract.md](sjabloon-contract.md) beschrijven de A/P-boom, app, animatie en testhaak. `src/core.js` definieert materialen en geometriehelpers; `app1.js` en `app2-*.js` verzorgen selectie, camera, explosie, openen, labels en URL-status.

Alle auto-eigen inhoud staat in `auto.json` en de domeinbestanden. `buildCar()` in `systems.js` levert de acht contractgroepen. `presetdata.js` levert categorieën, presets en rondleiding. `build.py` voegt die bronbestanden samen tot de gecommitte `index.html`, met inhoudshash en SRI voor de klassieke three.js-afhankelijkheden. Het model gebruikt geen modeldownloads of server-API.

De geometrie blijft schematisch. `bodPanel()` trianguleert ook concave panelen; wielopeningen zijn geen doorlopende blokken. Elke opener beweegt zijn volledige familie rond een geschat scharnier in het ouderframe. `inner` is uitsluitend voor werkelijk bedekte onderdelen, niet om zichtbare geometriefouten weg te werken.

Automatisering spreekt `window.__model` of de alias `window.__scenic` aan. Onderdeelnummers worden pas geladen wanneer nodig. Lege nummergegevens worden als Niet onderzocht getoond.
