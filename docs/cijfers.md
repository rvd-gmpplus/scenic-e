# Cijfers

Centrale bron voor de maatvoering en gepubliceerde technische cijfers. Bron: actuele Nederlandse Renault-brochure, pagina 22 en 23, geraadpleegd 20 oktober 2026. Geometrie in meter, teksten in Nederlandse notatie.

| Eigenschap | Waarde | Status |
| --- | --- | --- |
| Lengte | 4.470 mm | Renault |
| Breedte zonder spiegels | 1.864 mm | Renault |
| Breedte met spiegels | 2.085 mm | Renault |
| Hoogte | 1.571 mm | Renault |
| Wielbasis | 2.785 mm | Renault |
| Overhang voor / achter | 842 / 843 mm | Renault |
| EV89 bruikbare accucapaciteit | 89 kWh | Renault |
| EV67 bruikbare accucapaciteit | 67 kWh | Renault; niet de gekozen modelvariant |
| Vermogen | 160 kW (220 pk) | Renault |
| Maximumkoppel | 300 Nm | Renault |
| EV89 maximum WLTP | 642 km | Renault; afhankelijk van uitvoering |
| EV89 DC-laden | tot 150 kW; 15–80% in 28 minuten | Renault-brochure; onder passende omstandigheden |
| Modelmodules | 12 illustratieve blokken | Ontwerpkeuze, geen werkelijk moduleaantal |

## Modeltellingen

Uit de definitieve Linux-rooktest en budgetcontrole: 310 knopen, 55 groepen, 255 meshonderdelen, maximale diepte 5 en 68.874 driehoeken. Twee meshonderdelen zijn de verborgen informatiemarkers van de niet aanwezige brandstof- en uitlaatgroepen. Er zijn 21 presets en zeven openers. Dit zijn modeltellingen, geen aantallen van onderdelen in de echte auto.

De gecontroleerde totale bovengrens is 180.000 driehoeken. Details per hoofdgroep volgen uit `tools/tri.py --gate`; de teststatus staat in [teststatus.md](teststatus.md).
