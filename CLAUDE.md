# scenic-e: bouwafspraken

Nederlandse teksten, commentaar en commits. Geen em-dashes. Lees README.md, docs/contract.md en docs/teststatus.md voor omvang en verificatie.

- De generieke laag is byte voor byte gelijk aan laguna3 main `3216616`; zie FRAMEWORK en framework.json.
- `python3 build.py --lint`, `python3 tools/framework.py check` en `python3 build.py` voor iedere broncommit. `index.html` wordt gecommit.
- Alle geometrie staat in src/. A/P-knopen hebben Nederlandse `d`, `spec` alleen voor bevestigde feiten en een eigen `ex`.
- Nummerbestanden uitsluitend genereren uit data/pn/ met tools/orkestratie/build_pn.py. Geen onbevestigde onderdeelnummers.
- Hoofdmaten en voertuigcijfers staan in docs/cijfers.md. Bronnen en onzekerheden staan in docs/specificaties-en-bronnen.md.
- De accu heeft twaalf illustratieve blokken, geen bevestigd moduleaantal. MY27 is niet afzonderlijk bevestigd. Solarbay is geen schuifdak.
- Geen chassisnummer of kenteken in broncode, documentatie of commits.
- Volledige Linux-testset: bash tools/orkestratie/finaltests.sh uit/volledig. Regressiebasis is per auto en platform; een nieuwe basis is geen onafhankelijk visueel kwaliteitsoordeel.
- Begin vervolgwerk met git ls-remote --heads origin en een vergelijking met main, wanneer de remote bestaat.
