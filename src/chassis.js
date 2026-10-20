/* Ophanging en aerodynamische 20-inch wielen; verbindingen en profielen schematisch. */
function chsWheel(s, z) {
  const name = "Wiel " + sideName(s) + (z > 0 ? "voor" : "achter");
  return A(
    name,
    {
      d: "Aerodynamisch wiel met band, velg en vijf gestileerde dubbele spaken.",
      ex: [s * 0.42, 0, z > 0 ? 0.1 : -0.1],
    },
    [
      P("Band", G.torus("x", 0.307, 0.062, 56, 12), MAT.rubber, {
        d: "Afgeronde band met vereenvoudigd loopvlak; bandmaat afhankelijk van uitvoering.",
        p: [s * 0.8, 0.37, z],
        s: [1.7, 1, 1],
        ex: [s * 0.2, 0, 0],
      }),
      P("Velgrand", G.torus("x", 0.251, 0.012, 48, 8), MAT.alu, {
        d: "Buitenrand van de 20-inch lichtmetalen velg.",
        p: [s * 0.895, 0.37, z],
        ex: [s * 0.3, 0, 0],
      }),
      P(
        "Aerodynamische inzet",
        G.cyl("x", 0.242, 0.242, 0.015, 40),
        MAT.blackGloss,
        {
          d: "Donkere schijf tussen de gestileerde spaken.",
          p: [s * 0.875, 0.37, z],
          ex: [s * 0.12, 0, 0],
        },
      ),
      ...Array.from({ length: 5 }, (_, i) => {
        const t = (i * PI * 2) / 5;
        return P(
          "Spaak " + (i + 1),
          G.rbox(0.018, 0.21, 0.043, 0.008),
          MAT.satin,
          {
            d: "Schematisch gefreesd spaakvlak op de aerodynamische velg.",
            p: [s * 0.898, 0.37 + 0.125 * Math.cos(t), z + 0.125 * Math.sin(t)],
            r: [t, 0, 0],
            ex: [s * 0.3, 0.1 * Math.cos(t), 0.1 * Math.sin(t)],
          },
        );
      }),
      P("Naafdop", G.cyl("x", 0.045, 0.045, 0.023, 20), MAT.bodRoof, {
        d: "Donkere centrale naafdop.",
        p: [s * 0.905, 0.37, z],
        ex: [s * 0.4, 0, 0],
      }),
    ],
  );
}
function chsAxle(front) {
  const z = front ? AXF : AXR;
  return A(
    front ? "Vooras en stuurinrichting" : "Achteras",
    {
      d: front
        ? "Schematische voorwielophanging met elektrische stuurinrichting."
        : "Schematische achterwielophanging; exacte armgeometrie niet geverifieerd.",
      ex: [0, -0.25, front ? 0.2 : -0.2],
    },
    [
      P("Subframe", G.rbox(1.23, 0.075, 0.43, 0.025), MAT.darkSteel, {
        d: "Schematisch subframe onder de ophanging.",
        p: [0, 0.3, z],
        ex: [0, -0.2, 0],
      }),
      ...[-1, 1].flatMap((s) => [
        P(
          "Draagarm " + sideName(s),
          G.rbox(0.32, 0.035, 0.11, 0.015),
          MAT.aluCast,
          {
            d: "Schematisch wielgeleidend draagarmpunt.",
            p: [s * 0.62, 0.27, z],
            ex: [s * 0.15, -0.1, 0],
          },
        ),
        P(
          "Demper " + sideName(s),
          G.cyl("y", 0.025, 0.025, 0.37, 16),
          MAT.darkSteel,
          {
            d: "Schematische telescopische schokdemper.",
            p: [s * 0.64, front ? 0.58 : 0.4, z],
            ex: [s * 0.15, 0.1, 0],
          },
        ),
        P(
          "Schroefveer " + sideName(s),
          spring(0.055, 0.008, 0.22, 5),
          MAT.iron,
          {
            d: "Schematische schroefveer; windingaantal en veerconstante niet geverifieerd.",
            p: [s * 0.64, front ? 0.65 : 0.475, z],
            ex: [s * 0.25, 0.2, 0],
          },
        ),
      ]),
      ...(front
        ? [
            P(
              "Elektrisch stuurhuis",
              G.cyl("x", 0.034, 0.034, 1.1, 20),
              MAT.aluCast,
              {
                d: "Tandheugelstuurhuis met elektrische bekrachtiging; vorm geschat.",
                p: [0, 0.43, 1.16],
                ex: [0, 0.1, 0.2],
              },
            ),
          ]
        : []),
    ],
  );
}
function buildChassis() {
  return A(
    "Onderstel",
    {
      d: "Vooras, achteras, vier wielen en schijfremmen. Maten van de interne constructie zijn benaderd.",
      ex: [0, -0.7, 0],
    },
    [
      chsAxle(true),
      chsAxle(false),
      A(
        "Wielen",
        {
          d: "Vier aerodynamische 20-inch wielen, als gekozen visualisatie van de long range.",
          ex: [0, -0.1, 0],
        },
        [-1, 1].flatMap((s) => [chsWheel(s, AXF), chsWheel(s, AXR)]),
      ),
      A(
        "Remsysteem",
        {
          d: "Vier schijfremmen met ABS-regeling; remschijfdiameters en klauwvormen schematisch. Regeneratief remmen gebeurt via de tractiemotor.",
          ex: [0, 0.1, 0.3],
        },
        [
          ...[-1, 1].flatMap((s) =>
            [AXF, AXR].flatMap((z) => [
              P(
                "Remschijf " + sideName(s) + (z > 0 ? "voor" : "achter"),
                G.cyl("x", 0.145, 0.145, 0.022, 36),
                MAT.steel,
                {
                  d: "Schematische remschijf, zonder geverifieerde diameter.",
                  p: [s * 0.78, 0.37, z],
                  ex: [s * 0.2, 0, 0],
                },
              ),
              P(
                "Remklauw " + sideName(s) + (z > 0 ? "voor" : "achter"),
                G.rbox(0.07, 0.12, 0.085, 0.015),
                MAT.darkSteel,
                {
                  d: "Schematische remklauw over de schijfrand.",
                  p: [s * 0.79, 0.4, z - 0.13],
                  ex: [s * 0.3, 0, 0],
                },
              ),
            ]),
          ),
          P("ABS-regelunit", G.rbox(0.12, 0.1, 0.1, 0.01), MAT.alu, {
            d: "Schematisch hydraulisch remregelblok in de motorruimte.",
            p: [0.58, 0.74, 1.06],
            ex: [0.2, 0.1, 0],
          }),
        ],
      ),
    ],
  );
}
