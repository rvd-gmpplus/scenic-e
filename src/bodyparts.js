// Licht gekroond oppervlak met smalle schouders; paneelvorm geschat.
function bodBonnet() {
  const v = [],
    ix = [],
    nx = 12,
    nz = 12;
  for (let j = 0; j <= nz; j++) {
    const t = j / nz,
      z = lerp(1.11, 2.15, t),
      w = lerp(0.87, 0.84, t);
    for (let i = 0; i <= nx; i++) {
      const u = (i / nx) * 2 - 1;
      v.push(w * u, lerp(1.065, 1.04, t) + 0.012 * (1 - u * u), z);
    }
  }
  for (let j = 0; j < nz; j++)
    for (let i = 0; i < nx; i++) {
      const k = j * (nx + 1) + i;
      ix.push(k, k + 1, k + nx + 1, k + 1, k + nx + 2, k + nx + 1);
    }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  g.setIndex(ix);
  g.computeVertexNormals();
  return g;
}
/* Openende buitenpanelen; de geometrie blijft in het autoframe. */
function buildBodHood() {
  return A(
    "Motorkap",
    {
      d: "Korte motorkap boven elektromotor, laadapparatuur en thermisch systeem. Scharnierstand geschat.",
      ex: [0, 0.4, 0.25],
      open: hinge([0, 1.055, 1.1], [1, 0, 0], (-62 * PI) / 180, {
        min: (52 * PI) / 180,
        look: { dir: [0.8, 0.9, 1] },
      }),
    },
    [
      P("Buitenplaat motorkap", bodBonnet(), MAT.bodPaint, {
        d: "Licht aflopende gelakte motorkap; profilering geschat.",
        ex: [0, 0.15, 0],
      }),
      P(
        "Binnenframe motorkap",
        G.rbox(1.4, 0.025, 0.78, 0.025),
        MAT.darkSteel,
        {
          d: "Schematisch verstevigingsframe onder de kap.",
          p: [0, 1.002, 1.63],
          ex: [0, -0.12, 0],
        },
      ),
    ],
  );
}
function buildBodDoor(s, front) {
  const n = "Portier " + sideName(s) + (front ? "voor" : "achter");
  const z0 = front ? -0.06 : -0.83,
    z1 = front ? 0.83 : -0.1;
  const upper = front
    ? [
        [z1, 1.06],
        [0.52, 1.517],
        [z0, 1.535],
        [z0, 1.085],
      ]
    : [
        [z1, 1.085],
        [z1, 1.535],
        [-0.82, 1.535],
        [-1.16, 1.105],
      ];
  const shell = [
    [z0, 0.49],
    [z1, 0.49],
    [z1, 1.055],
    [z0, 1.08],
  ];
  const pivot = [s * 0.91, 0.75, z1 + 0.01];
  return A(
    n,
    {
      d:
        "Scharnierend " +
        (front ? "voorportier" : "achterportier") +
        " met verzonken handgreep, zijruit en binnenpaneel. Constructie geschat.",
      ex: [s * 0.55, 0, front ? 0.12 : -0.12],
      open: hinge(pivot, [0, 1, 0], (-s * (front ? 66 : 62) * PI) / 180, {
        min: ((front ? 55 : 51) * PI) / 180,
        look: { dir: [s, 0.45, 0.2] },
      }),
    },
    [
      P("Buitenpaneel", bodSide(s, shell), MAT.bodPaint, {
        d: "Gelakt portierpaneel met een aparte opening in de vaste carrosserie.",
        ex: [s * 0.15, 0, 0],
      }),
      P("Zijruit", bodSide(s, upper), MAT.bodGlass, {
        d: "Donkere zijruit; profiel en tint geschat.",
        ex: [s * 0.1, 0.2, 0],
      }),
      P(
        "Binnenbekleding",
        G.rbox(0.045, 0.4, z1 - z0 - 0.07, 0.018),
        MAT.dash,
        {
          d: "Donkere portierbekleding onder de raamlijn.",
          p: [s * 0.872, 0.76, (z0 + z1) / 2],
          ex: [-s * 0.2, 0, 0],
        },
      ),
      P(
        "Verzonken portiergreep",
        G.rbox(0.017, 0.028, 0.14, 0.008),
        MAT.bodRoof,
        {
          d: "Vlakliggende handgreep in de portierhuid.",
          p: [s * 0.922, 0.985, z0 + 0.16],
          ex: [s * 0.1, 0, 0],
        },
      ),
      ...(front
        ? [
            A(
              "Buitenspiegel " + sideName(s),
              {
                d: "Zwarte spiegelkap aan de voorzijde van het portier.",
                ex: [s * 0.2, 0, 0],
              },
              [
                P(
                  "Spiegelvoet",
                  G.rbox(0.105, 0.035, 0.065, 0.009),
                  MAT.plastic,
                  {
                    d: "Korte steun van de buitenspiegel.",
                    p: [s * 0.941, 1.104, 0.75],
                    ex: [s * 0.06, 0, 0],
                  },
                ),
                P("Spiegelkap", G.rbox(0.14, 0.085, 0.19, 0.032), MAT.bodRoof, {
                  d: "Afgeronde zwarte buitenspiegelkap.",
                  p: [s * 0.971, 1.13, 0.74],
                  ex: [s * 0.1, 0, 0],
                }),
                P(
                  "Spiegelglas",
                  G.rbox(0.11, 0.06, 0.006, 0.002),
                  MAT.reflector,
                  {
                    d: "Reflecterend spiegelvlak aan de achterzijde.",
                    p: [s * 0.973, 1.13, 0.641],
                    ex: [0, 0, -0.1],
                  },
                ),
              ],
            ),
          ]
        : []),
    ],
  );
}
function buildBodTailgate() {
  return A(
    "Achterklep",
    {
      d: "Schuin aflopende achterklep met hoog gemonteerde achterruit. Openingshoek geschat.",
      ex: [0, 0.2, -0.5],
      open: hinge([0, 1.51, -1.3], [1, 0, 0], (69 * PI) / 180, {
        min: (57 * PI) / 180,
        look: { dir: [0.5, 0.6, -1] },
      }),
    },
    [
      P(
        "Achterruit",
        bodPanel([
          [-0.76, 1.51, -1.31],
          [0.76, 1.51, -1.31],
          [0.84, 1.085, -2.15],
          [-0.84, 1.085, -2.15],
        ]),
        MAT.bodGlass,
        { d: "Aflopende achterruit onder de dakspoiler.", ex: [0, 0.2, -0.1] },
      ),
      P("Klepplaat", G.rbox(1.67, 0.28, 0.045, 0.015), MAT.bodPaint, {
        d: "Gelakte onderste klepplaat tussen achterruit en bumper.",
        p: [0, 0.93, -2.19],
        ex: [0, 0, -0.18],
      }),
      P("Derde remlicht", G.rbox(0.48, 0.016, 0.018, 0.004), MAT.lensRed, {
        d: "Smal remlicht bovenaan de achterruit.",
        p: [0, 1.508, -1.335],
        ex: [0, 0.1, -0.1],
      }),
    ],
  );
}
function buildBodLights() {
  return [-1, 1].flatMap((s) => [
    P(
      "Koplamp " + sideName(s),
      G.rbox(0.49, 0.055, 0.055, 0.018),
      MAT.blackGloss,
      {
        d: "Smalle donkere LED-koplamp bovenaan de neus.",
        p: [s * 0.615, 0.989, 2.2],
        ex: [s * 0.1, 0, 0.2],
      },
    ),
    P(
      "LED-signatuur boven " + sideName(s),
      G.rbox(0.43, 0.012, 0.015, 0.004),
      MAT.bodLight,
      {
        d: "Horizontale witte lichtsignatuur van de koplamp.",
        p: [s * 0.635, 1.006, 2.23],
        ex: [s * 0.1, 0.04, 0.2],
      },
    ),
    bodBar(
      "Dagrijlicht " + sideName(s),
      [s * 0.84, 0.88, 2.222],
      [s * 0.69, 0.64, 2.222],
      0.011,
      MAT.bodLight,
      "Schuine lichtsignatuur in de voorbumper.",
      [s * 0.1, 0, 0.25],
    ),
    P(
      "Achterlicht " + sideName(s),
      G.rbox(0.47, 0.045, 0.035, 0.012),
      MAT.lensRed,
      {
        d: "Smalle rode achterlichtstrip aan de buitenzijde.",
        p: [s * 0.65, 1.065, -2.22],
        ex: [s * 0.15, 0, -0.2],
      },
    ),
    bodBar(
      "Achterlicht flank " + sideName(s),
      [s * 0.89, 1.06, -2.18],
      [s * 0.9, 0.9, -1.98],
      0.019,
      MAT.lensRed,
      "Schuin zijsegment van de achterlichtsignatuur.",
      [s * 0.15, 0, -0.2],
    ),
  ]);
}
function buildBodChargeFlap() {
  return A(
    "Laadklep",
    {
      d: "Laadklep aan het rechter voorscherm; plaatsing volgens de buitenaanzichten. Scharnierstand geschat.",
      ex: [-0.25, 0, 0],
      open: hinge([-0.92, 0.94, 1.05], [0, 1, 0], (-80 * PI) / 180, {
        min: (65 * PI) / 180,
        look: { dir: [-1, 0.3, 0.5] },
      }),
    },
    [
      P("Klepplaat laadpoort", G.rbox(0.014, 0.15, 0.19, 0.005), MAT.bodPaint, {
        d: "Gelakte afdekking over de CCS-laadconnector.",
        p: [-0.924, 0.94, 1.15],
        ex: [-0.15, 0, 0],
      }),
    ],
  );
}
