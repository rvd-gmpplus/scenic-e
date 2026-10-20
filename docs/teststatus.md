# Teststatus

Stand: 20 oktober 2026. Eerste schematische versie; de definitieve vrijgave en regressiebasis worden nog afgerond.

## Herkomst

Alle 49 generieke bestanden zijn byte voor byte gelijk aan laguna3 main `321661674a56d3fa96d91b98301d441b3d4285af` (versie 17). Linux, Chromium 154 en SwiftShader. `a87014e` is de eerste kandidaat; `1c8e4fe` werkt de carrosserieopeningen af en `0116fc1` sluit de raamvoeten aan.

## Uitgevoerde controles

| Controle | Uitkomst |
| --- | --- |
| Bouw, lint, framework, nummergegevens | Geslaagd |
| Desktop-/mobiele rooktest en publicatiepagina | Geslaagd op de eerste kandidaat; de generieke laag is ongewijzigd |
| Integriteit, silhouet en verborgen onderdelen | Geslaagd na de grote herstelronde |
| Interactie desktop en mobiel | 65 controles, 0 fouten na de grote herstelronde |
| Driehoekenbudget | Alle groepen groen; telling na de laatste raamvoetafwerking wordt bijgewerkt |
| Beweging en botsingen | Alle zeven openers botsingsvrij; geen spookbatches |
| Animatietijd | Geïsoleerde meting: p95 openen 4,2 ms en sluiten 3,6 ms, onder de grens van 8 ms |
| Zicht bij geopende delen | Laatste raamvoetronde loopt; portieren vallen binnen 2%, achterklep nog 2,3% tegenover 2% |
| Visuele regressiebasis | Nog te initialiseren voor deze nieuwe auto |
| macOS, echte telefoon, onafhankelijke reviewer | Niet uitgevoerd in deze Linux-omgeving |

De eerste volledige set (`uit/acceptatie`) was rood. De betrokken controles zijn na herstel apart herhaald (`uit/herstel` en `uit/raamvoet`). Er is nog geen claim dat één volledige set op de definitieve bron groen is. Doorzichtige ruiten worden in de strenge blootleggingstest niet als afsluiting meegeteld; meetstralen en fysieke raamranden worden daarom apart beoordeeld.

De silhouetdata bewaakt een expliciete ontwerpreferentie, geen onafhankelijke fotometing. Een eerste regressiebasis bewijst geen overeenkomst met Renault-CAD. Technische feiten en schattingen staan in [specificaties-en-bronnen.md](specificaties-en-bronnen.md).

## Repository

De GitHub-repo is beschikbaar op https://github.com/rvd-gmpplus/scenic-e. Eerdere automatische aanmaakpogingen werden door de koppeling geweigerd; de inmiddels beschikbare lege repo wordt gebruikt. Er is geen websitepublicatie aangevraagd.
