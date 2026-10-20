/* Elektrisch bekrachtigde synchrone motor; inwendige vorm en windingaantallen zijn schematisch. */
std("engOrange", 0xf47723, 0.15, 0.45);
function buildPowertrain() {
  return A(
    "Aandrijflijn",
    {
      d: "Elektromotor, vermogenselektronica, vaste reductie en aandrijfassen op de vooras.",
      spec: [
        ["Aandrijving", "voorwielen"],
        ["Vermogen", "160 kW (220 pk)"],
      ],
      ex: [0, 0.55, 1.4],
    },
    [
      A(
        "Motor E-Tech",
        {
          d: "Elektrisch bekrachtigde synchrone tractiemotor. Rotormaten en windingen zijn schematisch, geen demontagegegevens.",
          ex: [0, 0.3, 0.1],
        },
        [
          P("Motorhuis", G.cyl("x", 0.19, 0.19, 0.38, 40, true), MAT.aluCast, {
            d: "Cilindrische aluminium motormantel met open uiteinden in de explosietekening.",
            p: [0.16, 0.67, 1.4],
            ex: [0, 0.2, 0],
          }),
          A(
            "Stator",
            {
              d: "Vast gelamineerd ijzerpakket met koperen fasewikkelingen; lamellen en spoelen zijn vereenvoudigd.",
              ex: [0, 0.45, 0],
            },
            [
              P(
                "Statorpakket",
                G.torus("x", 0.135, 0.028, 40, 8),
                MAT.darkSteel,
                {
                  d: "Schematisch gelamineerd statorblikpakket.",
                  p: [0.16, 0.67, 1.4],
                  s: [3.5, 1, 1],
                  ex: [0, 0.2, 0],
                },
              ),
              ...Array.from({ length: 12 }, (_, i) => {
                const t = (i * PI) / 6;
                return P(
                  "Fasewikkeling " + (i + 1),
                  G.rbox(0.29, 0.035, 0.035, 0.01),
                  MAT.copper,
                  {
                    d: "Koperen spoelsegment; het aantal getoonde segmenten is illustratief.",
                    p: [
                      0.16,
                      0.67 + 0.125 * Math.cos(t),
                      1.4 + 0.125 * Math.sin(t),
                    ],
                    r: [t, 0, 0],
                    ex: [0, 0.1 * Math.cos(t), 0.1 * Math.sin(t)],
                  },
                );
              }),
            ],
          ),
          A(
            "Bekrachtigde rotor",
            {
              d: "Rotor met elektrische bekrachtiging in plaats van permanente magneten; constructie schematisch.",
              ex: [0.5, 0, 0],
            },
            [
              P(
                "Rotorlichaam",
                G.cyl("x", 0.084, 0.084, 0.28, 32),
                MAT.darkSteel,
                {
                  d: "Schematisch rotorlichaam in het statorveld.",
                  p: [0.16, 0.67, 1.4],
                  ex: [0.18, 0, 0],
                  inner: true,
                },
              ),
              P("Rotoras", G.cyl("x", 0.023, 0.023, 0.52, 20), MAT.steel, {
                d: "Uitgaande as naar de vaste reductie.",
                p: [0.16, 0.67, 1.4],
                ex: [0.4, 0, 0],
              }),
              P(
                "Bekrachtigingswikkeling",
                G.torus("x", 0.074, 0.009, 24, 6),
                MAT.copper,
                {
                  d: "Symbolische koperen rotorwikkeling; aansluitingen vereenvoudigd.",
                  p: [0.16, 0.67, 1.4],
                  ex: [0.3, 0.15, 0],
                  inner: true,
                },
              ),
            ],
          ),
          ...[-1, 1].map((s) =>
            P(
              "Eindschild " + sideName(s),
              G.cyl("x", 0.19, 0.19, 0.018, 40),
              MAT.aluCast,
              {
                d: "Aluminium einddeksel van het motorhuis.",
                p: [0.16 + s * 0.195, 0.67, 1.4],
                ex: [s * 0.3, 0, 0],
              },
            ),
          ),
        ],
      ),
      buildEngInverter(),
      buildDrivetrain(),
    ],
  );
}
