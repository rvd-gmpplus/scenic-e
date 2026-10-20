function buildDrivetrain() {
  return A(
    "Reductie en aandrijfassen",
    {
      d: "Vaste overbrenging met differentieel naar de voorwielen. Tandenaantallen en overbrengingsverhouding zijn niet geverifieerd.",
      ex: [-0.45, 0, 0.15],
    },
    [
      A(
        "Vaste reductie",
        {
          d: "Enkelvoudige elektrische rijoverbrenging; geen meertraps automaat of koppelomvormer.",
          ex: [-0.3, 0, 0],
        },
        [
          P("Reductiehuis", G.rbox(0.25, 0.32, 0.31, 0.04), MAT.aluCast, {
            d: "Schematisch reductiehuis naast de tractiemotor.",
            p: [-0.23, 0.59, 1.4],
            ex: [-0.25, 0, 0],
          }),
          P("Reductietandwiel", G.cyl("x", 0.11, 0.11, 0.038, 32), MAT.steel, {
            d: "Symbolisch tandwiel voor de vaste reductie.",
            p: [-0.23, 0.59, 1.4],
            ex: [-0.45, 0.15, 0],
            inner: true,
          }),
          P(
            "Differentieel",
            G.cyl("x", 0.075, 0.075, 0.14, 24),
            MAT.darkSteel,
            {
              d: "Vereenvoudigde verdeler van het aandrijfkoppel tussen de voorwielen.",
              p: [-0.23, 0.525, 1.4],
              ex: [-0.3, -0.2, 0],
              inner: true,
            },
          ),
        ],
      ),
      ...[-1, 1].map((s) =>
        A(
          "Aandrijfas " + sideName(s),
          {
            d: "Aandrijfas met homokinetische koppelingen naar het voorwiel.",
            ex: [s * 0.3, -0.1, 0],
          },
          [
            P(
              "Asstaaf",
              G.cyl("x", 0.017, 0.017, s > 0 ? 0.46 : 0.35, 16),
              MAT.steel,
              {
                d: "Stalen aandrijfas; lengte geschat.",
                p: [s * 0.56, 0.38, AXF],
                ex: [s * 0.1, 0, 0],
              },
            ),
            P(
              "Buitenste homokineet",
              G.cyl("x", 0.047, 0.047, 0.09, 20),
              MAT.darkSteel,
              {
                d: "Schematische homokinetische koppeling aan wielzijde.",
                p: [s * 0.76, 0.38, AXF],
                ex: [s * 0.2, 0, 0],
              },
            ),
            P(
              "Stofbalg",
              G.lathe("x", bellows(0.04, 0.027, 0.09, 5), 20),
              MAT.rubber,
              {
                d: "Geplooide rubberen hoes over de koppeling.",
                p: [s * 0.64, 0.38, AXF],
                ex: [0, -0.1, 0],
              },
            ),
          ],
        ),
      ),
    ],
  );
}
