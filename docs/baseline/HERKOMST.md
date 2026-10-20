# Eerste visuele regressiebasis

Gemaakt op GitHub Actions, Ubuntu, Playwright 1.64.0, three.js r147, desktop 1280 × 800; de opgeslagen PNG's zijn volgens het ongewijzigde framework teruggebracht tot 640 × 400 en 256 kleuren.

Bron: commit `eb496ef19686a814eb33e69ed2a6033af8b6ead8`, workflowrun [39425634497](https://github.com/rvd-gmpplus/scenic-e/actions/runs/39425634497). De app- en geometriebron is gelijk aan die van `8e217df`.

De 20 beelden zijn ook vergeleken met de onafhankelijke eerdere rendersessie op `3043c4e`: alle beelden binnen de drempel van 1,5%. De labelmetingen zijn in beide sessies gelijk: 85 labels, 77 eigen oppervlakken, 63 vrije zichtlijnen.

Dit is een eerste referentie voor volgende wijzigingen. Het is geen bewijs van overeenkomst met Renault-CAD en geen onafhankelijke visuele beoordeling van de voertuigvorm. De geselecteerde overzichtsbeelden en het mobiele beeld staan in ../screenshots/.

Vernieuwen: voer de workflow 'Visuele basis voorbereiden' uit, inspecteer het artefact `visual-bootstrap` en neem daarna bewust `baseline/` en eventueel `screenshots/` over. Het workflowartefact overschrijft de gecommitte basis nooit automatisch. `requirements-visuals.txt` bevat de aanvullende dependency voor de vergelijking.
