/* Elektrische systemen. De twee lege legacy-hoofdgroepen zijn informatieve onderdelen, geen fictieve tank of uitlaat. */
std("sysCell", 0x405d6b, 0.55, 0.4);
function buildCooling() {
  return A(
    "Koeling en luchtinlaat",
    {
      d: "Thermisch beheer van accu, motor en interieur met warmtepomp. Leidingloop en componentvormen schematisch.",
      ex: [0, 0.25, 2],
    },
    [
      P("Koelpakket", G.rbox(1.1, 0.37, 0.075, 0.012), MAT.darkSteel, {
        d: "Schematische warmtewisselaar achter de neus.",
        p: [0, 0.67, 1.99],
        ex: [0, 0, 0.3],
      }),
      P("Ventilator", G.torus("z", 0.15, 0.02, 28, 6), MAT.plastic, {
        d: "Schematische elektrische koelventilator.",
        p: [0, 0.68, 1.92],
        ex: [0, 0, -0.2],
      }),
      P("Warmtepompcompressor", G.cyl("x", 0.07, 0.07, 0.19, 24), MAT.alu, {
        d: "Elektrische compressor voor het thermische systeem; plaats geschat.",
        p: [0.5, 0.56, 1.7],
        ex: [0.25, 0, 0],
      }),
      P("Koelvloeistofreservoir", G.rbox(0.15, 0.15, 0.13, 0.025), MAT.tank, {
        d: "Schematisch expansievat van de vloeistofkoeling.",
        p: [-0.56, 0.84, 1.2],
        ex: [-0.2, 0.15, 0],
      }),
      P(
        "Koelleiding naar accupakket",
        tube(
          [
            [0.45, 0.55, 1.7],
            [0.56, 0.47, 0.9],
            [0.56, 0.35, 0.55],
          ],
          0.012,
          24,
          8,
        ),
        MAT.rubber,
        {
          d: "Vereenvoudigde vloeistofleiding naar het accukoelcircuit.",
          ex: [0.2, 0, 0],
        },
      ),
    ],
  );
}
function sysLegacy(name, text, z) {
  return A(name, { d: text, ex: [0, -0.2, z] }, [
    P("Niet aanwezig", G.box(0.001, 0.001, 0.001), MAT.plastic, {
      d: text,
      p: [0, 0.3, z],
      ex: [0, -0.1, 0],
      inner: true,
    }),
  ]);
}
function buildExhaust() {
  return sysLegacy(
    "Uitlaatsysteem",
    "Niet aanwezig: de volledig elektrische Scénic heeft geen verbrandingsmotor, katalysator of uitlaat. Deze informatietak behoudt het achtgroepencontract van het framework.",
    -0.1,
  );
}
function buildFuel() {
  return sysLegacy(
    "Brandstofsysteem",
    "Niet aanwezig: energie wordt opgeslagen in de tractieaccu, niet in een brandstoftank. Deze informatietak behoudt het achtgroepencontract van het framework.",
    0.1,
  );
}
function sysBattery() {
  return A(
    "Tractieaccu",
    {
      d: "Vlak hoogspanningsaccupakket onder de cabine. Buitenmaten, celvorm, moduleaantal en interne indeling zijn uitsluitend schematisch.",
      spec: [
        ["Bruikbare accucapaciteit", "89 kWh"],
        ["Bron", "Actuele Nederlandse Renault-brochure, EV89"],
      ],
      ex: [0, -0.55, -0.15],
    },
    [
      P("Accubak", G.rbox(1.43, 0.13, 2.25, 0.025), MAT.darkSteel, {
        d: "Schematische structurele accubehuizing onder de vloer.",
        p: [0, 0.3, -0.18],
        ex: [0, -0.2, 0],
      }),
      P("Bodembeschermplaat", G.rbox(1.48, 0.018, 2.3, 0.008), MAT.alu, {
        d: "Beschermplaat onder het accupakket; dikte geschat.",
        p: [0, 0.215, -0.18],
        ex: [0, -0.4, 0],
      }),
      P("Accudeksel", G.rbox(1.44, 0.022, 2.26, 0.01), MAT.alu, {
        d: "Schematisch bovenste accudeksel onder de cabinevloer.",
        p: [0, 0.383, -0.18],
        ex: [0, 0.45, 0],
      }),
      A(
        "Illustratieve accumodules",
        {
          d: "Twaalf blokken tonen het principe van een modulair accupakket. Dit is nadrukkelijk geen bevestigd aantal modules of cellen van de 89 kWh-accu.",
          ex: [0, 0.15, 0],
        },
        [
          ...Array.from({ length: 12 }, (_, i) => {
            const x = ((i % 3) - 1) * 0.44,
              z = (Math.floor(i / 3) - 1.5) * 0.51 - 0.18;
            return A(
              "Schematische module " + (i + 1),
              {
                d: "Illustratief accublok; celtype, celgetal en maat zijn niet geverifieerd.",
                ex: [x * 0.3, 0.1, z * 0.15],
              },
              [
                P(
                  "Modulebehuizing",
                  G.rbox(0.4, 0.085, 0.46, 0.012),
                  MAT.sysCell,
                  {
                    d: "Schematische modulekast in het accupakket.",
                    p: [x, 0.3, z],
                    ex: [0, 0.1, 0],
                    inner: true,
                  },
                ),
                P(
                  "Aansluitrail",
                  G.rbox(0.3, 0.008, 0.025, 0.003),
                  MAT.copper,
                  {
                    d: "Illustratieve elektrische verbinding op een module.",
                    p: [x, 0.35, z],
                    ex: [0, 0.2, 0],
                    inner: true,
                  },
                ),
              ],
            );
          }),
        ],
      ),
      P("Accucontactorkast", G.rbox(0.32, 0.09, 0.16, 0.012), MAT.ecu, {
        d: "Schematische behuizing van hoogspanningsschakelaars en meetelektronica.",
        p: [0, 0.32, 1.08],
        ex: [0, 0.1, 0.3],
      }),
      P("Accukoelplaat", G.rbox(1.33, 0.012, 2.14, 0.005), MAT.alu, {
        d: "Symbolische vloeistofgekoelde plaat; werkelijke kanalen niet bekend.",
        p: [0, 0.255, -0.18],
        ex: [0, -0.3, 0],
        inner: true,
      }),
    ],
  );
}
function buildElectrical() {
  return A(
    "Elektrisch systeem",
    {
      d: "Hoogspanningsaccu, laden, boordvoeding en kabels. Componentposities en kabelroutes zijn geschat.",
      ex: [0.9, -0.1, -0.2],
    },
    [
      sysBattery(),
      A(
        "Laadapparatuur",
        {
          d: "AC-boordlader en CCS-aansluiting aan het rechter voorscherm; inwendige opbouw en posities schematisch.",
          ex: [-0.45, 0.4, 0.2],
        },
        [
          P("Boordlader", G.rbox(0.36, 0.1, 0.29, 0.015), MAT.alu, {
            d: "Schematische AC-naar-DC-boordlader in de motorruimte. Laadvermogen verschilt per uitvoering.",
            p: [-0.53, 0.68, 1.61],
            ex: [-0.25, 0.25, 0],
          }),
          P(
            "CCS-laadaansluiting",
            G.rbox(0.06, 0.13, 0.12, 0.014),
            MAT.blackGloss,
            {
              d: "Schematische gecombineerde AC/DC-laadpoort achter de laadklep.",
              p: [-0.871, 0.94, 1.15],
              ex: [-0.25, 0, 0],
            },
          ),
          ...[-1, 1].map((s) =>
            P(
              "DC-contact " + sideName(s),
              G.cyl("x", 0.015, 0.015, 0.012, 16),
              MAT.copper,
              {
                d: "Symbolisch DC-contact in de CCS-laadconnector.",
                p: [-0.907, 0.9, 1.15 + s * 0.028],
                ex: [-0.25, 0, 0],
              },
            ),
          ),
        ],
      ),
      P("DC-DC-omvormer", G.rbox(0.23, 0.08, 0.18, 0.012), MAT.alu, {
        d: "Schematische omvormer van de tractiespanning naar het laagspanningsboordnet.",
        p: [-0.5, 0.85, 1.7],
        ex: [-0.25, 0.15, 0],
      }),
      P("Laagspanningsaccu", G.rbox(0.23, 0.18, 0.16, 0.015), MAT.plastic, {
        d: "Schematische 12-voltaccu voor het boordnet. Technologie en exacte plaats nog niet bevestigd.",
        p: [0.54, 0.84, 1.35],
        ex: [0.25, 0.25, 0],
      }),
      P(
        "Hoogspanningskabel",
        tube(
          [
            [0.04, 0.38, 1.08],
            [0.12, 0.48, 1.15],
            [0.42, 0.6, 1.21],
            [0.4, 0.88, 1.5],
          ],
          0.018,
          32,
          8,
        ),
        MAT.engOrange,
        {
          d: "Oranje hoogspanningsverbinding van accu naar vermogenselektronica; route geschat.",
          ex: [0.2, 0.1, 0],
        },
      ),
    ],
  );
}
function buildCar() {
  return A(
    AUTO.wortel,
    {
      d: "Renault Scénic E-Tech electric long range: schematische interactieve explosietekening op basis van de actuele MY26-specificatie. MY27 niet afzonderlijk bevestigd.",
    },
    [
      buildBody(),
      buildInterior(),
      buildPowertrain(),
      buildChassis(),
      buildCooling(),
      buildExhaust(),
      buildFuel(),
      buildElectrical(),
    ],
  );
}
