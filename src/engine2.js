function buildEngInverter() {
  return A(
    "Omvormer",
    {
      d: "Vermogenselektronica zet de gelijkstroom uit de tractieaccu om in driefasenstroom. Inwendige opbouw geschat.",
      ex: [0, 0.5, 0],
    },
    [
      P("Omvormerbehuizing", G.rbox(0.51, 0.09, 0.36, 0.02), MAT.alu, {
        d: "Gegoten vermogenselektronicabehuizing boven de motor.",
        p: [0.12, 0.916, 1.37],
        ex: [0, 0.15, 0],
      }),
      P("Vermogensmodule", G.rbox(0.33, 0.022, 0.23, 0.005), MAT.ecu, {
        d: "Schematische vermogensmodule op de koelplaat.",
        p: [0.12, 0.91, 1.37],
        ex: [0, 0.35, 0],
        inner: true,
      }),
      P(
        "HV-aansluiting motor",
        G.rbox(0.13, 0.06, 0.045, 0.008),
        MAT.engOrange,
        {
          d: "Oranje hoogspanningsaansluiting naar de motor.",
          p: [0.12, 0.9, 1.58],
          ex: [0, 0, 0.2],
        },
      ),
    ],
  );
}
