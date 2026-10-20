std("intSeat", 0x424c54, 0, 0.9);
std("intBlue", 0x5086a8, 0.2, 0.48);
function intSeat(name, x, z) {
  return A(
    name,
    {
      d: "Schematische stoel met zitting, rugleuning, hoofdsteun en rails.",
      ex: [x > 0 ? 0.25 : -0.25, 0.4, 0],
    },
    [
      P("Zitting", G.rbox(0.47, 0.14, 0.48, 0.06), MAT.intSeat, {
        d: "Afgerond zitkussen; stoffering en vorm geschat.",
        p: [x, 0.69, z],
        ex: [0, 0.15, 0.15],
      }),
      P("Rugleuning", G.rbox(0.46, 0.52, 0.12, 0.055), MAT.intSeat, {
        d: "Licht achterover hellende rugleuning.",
        p: [x, 0.99, z - 0.22],
        r: [-0.1, 0, 0],
        ex: [0, 0.3, -0.2],
      }),
      P("Hoofdsteun", G.rbox(0.25, 0.14, 0.09, 0.035), MAT.intSeat, {
        d: "Afgeronde verstelbare hoofdsteun.",
        p: [x, 1.36, z - 0.25],
        ex: [0, 0.45, 0],
      }),
      ...[-1, 1].map((s) =>
        P(
          "Stoelrail " + sideName(s),
          G.rbox(0.025, 0.04, 0.46, 0.006),
          MAT.steel,
          {
            d: "Schematische geleider onder de stoel.",
            p: [x + s * 0.16, 0.55, z],
            ex: [s * 0.12, -0.1, 0],
          },
        ),
      ),
    ],
  );
}
function buildInterior() {
  return A(
    "Interieur",
    {
      d: "Vijf zitplaatsen, vlakke vloer, openR-dashboard en centrale console. Interne afmetingen en bekleding schematisch.",
      ex: [0, 0.9, -0.2],
    },
    [
      P("Vloerbedekking", G.rbox(1.63, 0.018, 2.33, 0.008), MAT.carpet, {
        d: "Vlakke donkere vloer boven de tractieaccu.",
        p: [0, 0.51, -0.12],
        ex: [0, 0.1, 0],
      }),
      A(
        "Dashboard",
        {
          d: "OpenR-dashboard met instrumentendisplay en staand middendisplay; vormen benaderd.",
          ex: [0, 0.3, 0.3],
        },
        [
          P("Dashboarddrager", G.rbox(1.59, 0.22, 0.34, 0.04), MAT.dash, {
            d: "Brede donkere dashboardvorm voor de voorstoelen.",
            p: [0, 1.02, 0.88],
            ex: [0, 0.1, 0.1],
          }),
          P(
            "Instrumentendisplay",
            G.rbox(0.3, 0.15, 0.014, 0.006),
            MAT.screen,
            {
              d: "Digitaal instrumentenpaneel voor de bestuurder.",
              p: [0.43, 1.15, 0.702],
              ex: [0, 0.2, -0.15],
            },
          ),
          P(
            "OpenR middendisplay",
            G.rbox(0.18, 0.25, 0.016, 0.008),
            MAT.screen,
            {
              d: "Staand centraal openR-link touchscreen, visueel benaderd.",
              p: [0.03, 1.07, 0.69],
              r: [-0.15, 0, 0],
              ex: [0, 0.1, -0.2],
            },
          ),
          P("Display accent", G.rbox(0.13, 0.012, 0.008, 0.002), MAT.intBlue, {
            d: "Blauwe grafische accentbalk op het schematische scherm.",
            p: [0.03, 1.12, 0.673],
            ex: [0, 0.1, -0.2],
          }),
          P("Stuurwiel", G.torus("z", 0.16, 0.018, 36, 8), MAT.rubber, {
            d: "Stuurwiel links; diameter en afplatting vereenvoudigd.",
            p: [0.43, 1.02, 0.5],
            ex: [0, 0, -0.3],
          }),
          P("Stuurwielnaaf", G.rbox(0.16, 0.085, 0.055, 0.02), MAT.dash, {
            d: "Schematische stuurwielnaaf met airbagmodule.",
            p: [0.43, 1.02, 0.5],
            ex: [0, 0, -0.15],
          }),
        ],
      ),
      intSeat("Bestuurdersstoel", 0.43, 0.11),
      intSeat("Passagiersstoel", -0.43, 0.11),
      A(
        "Achterbank",
        {
          d: "Drie achterste zitplaatsen met gedeelde rugleuning; verhoudingen geschat.",
          ex: [0, 0.4, -0.3],
        },
        [
          P(
            "Zitkussen achterbank",
            G.rbox(1.42, 0.14, 0.47, 0.05),
            MAT.intSeat,
            {
              d: "Doorlopende zitting voor drie passagiers.",
              p: [0, 0.7, -0.93],
              ex: [0, 0.15, 0],
            },
          ),
          P(
            "Rugleuning achterbank",
            G.rbox(1.42, 0.48, 0.12, 0.04),
            MAT.intSeat,
            {
              d: "Vereenvoudigde achterbankleuning.",
              p: [0, 0.99, -1.18],
              ex: [0, 0.2, -0.25],
            },
          ),
          ...[-0.48, 0, 0.48].map((x, i) =>
            P(
              "Hoofdsteun achter " + (i + 1),
              G.rbox(0.22, 0.13, 0.08, 0.025),
              MAT.intSeat,
              {
                d: "Hoofdsteun voor een achterpassagier.",
                p: [x, 1.31, -1.2],
                ex: [0, 0.25, 0],
              },
            ),
          ),
        ],
      ),
      P("Middenconsole", G.rbox(0.23, 0.23, 0.63, 0.035), MAT.dash, {
        d: "Verhoogde console tussen de voorstoelen; indeling geschat.",
        p: [0, 0.72, 0.12],
        ex: [0, 0.3, 0],
      }),
      P("Bagageruimtevloer", G.rbox(1.35, 0.025, 0.67, 0.01), MAT.carpet, {
        d: "Vlakke laadvloer achter de achterbank.",
        p: [0, 0.61, -1.69],
        ex: [0, 0.2, -0.2],
      }),
      ...[-1, 1].map((s) =>
        P(
          "Bagageruimte zijwand " + sideName(s),
          G.rbox(0.12, 0.34, 0.7, 0.025),
          MAT.carpet,
          {
            d: "Binnenbekleding over de achterste wielkast.",
            p: [s * 0.75, 0.76, -1.63],
            ex: [s * 0.15, 0, 0],
          },
        ),
      ),
    ],
  );
}
