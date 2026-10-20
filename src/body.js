/* Scénic E-Tech, autoframe in meter: x links, y omhoog, z voor. Alle panelen schematisch. */
const ZF = 2.235,
  ZR = -2.235,
  AXF = 1.393,
  AXR = -1.392;
const BOD_WMAX = 0.932,
  BOD_MIRW = 1.0425,
  BOD_H = 1.571;
std("bodPaint", 0x728b92, 0.65, 0.29);
std("bodRoof", 0x080d13, 0.15, 0.48);
phys("bodGlass", {
  color: 0x20313c,
  metalness: 0.2,
  roughness: 0.12,
  transparent: true,
  opacity: 0.82,
  side: THREE.DoubleSide,
});
std("bodLight", 0xeaf5ff, 0.2, 0.19, {
  emissive: 0xc8e4ff,
  emissiveIntensity: 0.7,
});
// Paneel uit hoekpunten in wereldcoördinaten; dubbelzijdige dunne schaal, dikte geschat.
function bodPanel(pts) {
  const vertices = [];
  pts.forEach((p) => vertices.push(...p));
  const n = V3(0, 0, 0);
  pts.forEach((p, i) => {
    const q = pts[(i + 1) % pts.length];
    n.x += (p[1] - q[1]) * (p[2] + q[2]);
    n.y += (p[2] - q[2]) * (p[0] + q[0]);
    n.z += (p[0] - q[0]) * (p[1] + q[1]);
  });
  const a = [Math.abs(n.x), Math.abs(n.y), Math.abs(n.z)],
    drop = a.indexOf(Math.max(...a));
  const uv = pts.map(
    (p) => new THREE.Vector2(...p.filter((_, i) => i !== drop)),
  );
  const indices = THREE.ShapeUtils.triangulateShape(uv, []).flat();
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(vertices, 3));
  g.setIndex(indices);
  g.computeVertexNormals();
  return g;
}
function HW(z) {
  return lerp(
    0.914,
    z > 0 ? 0.855 : 0.867,
    clamp((Math.abs(z) - 1.8) / 0.435, 0, 1),
  );
}
// Onderverdeling volgt de gebogen huid ook binnen grote driehoeken.
function bodSide(s, pts, holes = []) {
  const poly = pts.map(([z, y]) => new THREE.Vector2(z, y)),
    holePolys = holes.map((h) => h.map(([z, y]) => new THREE.Vector2(z, y))),
    all = pts.concat(holes.flat());
  const triangles = THREE.ShapeUtils.triangulateShape(poly, holePolys),
    v = [],
    N = 4;
  const at = (t, i, j) => {
    const a = 1 - (i + j) / N,
      b = i / N,
      c = j / N,
      z = all[t[0]][0] * a + all[t[1]][0] * b + all[t[2]][0] * c,
      y = all[t[0]][1] * a + all[t[1]][1] * b + all[t[2]][1] * c;
    return [
      s * (y > 1.1 ? lerp(HW(z), 0.775, clamp((y - 1.1) / 0.45, 0, 1)) : HW(z)),
      y,
      z,
    ];
  };
  for (const t of triangles)
    for (let i = 0; i < N; i++)
      for (let j = 0; j < N - i; j++) {
        v.push(...at(t, i, j), ...at(t, i + 1, j), ...at(t, i, j + 1));
        if (i + j < N - 1)
          v.push(
            ...at(t, i + 1, j),
            ...at(t, i + 1, j + 1),
            ...at(t, i, j + 1),
          );
      }
  const g = new THREE.BufferGeometry();
  g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
  return weldAll(g);
}
function bodBar(name, a, b, width, mat, d, ex = [0, 0.1, 0]) {
  const v = V3(...b).sub(V3(...a));
  return P(name, G.cyl("y", width, width, v.length(), 8), mat, {
    d,
    p: V3(...a)
      .add(V3(...b))
      .multiplyScalar(0.5)
      .toArray(),
    q: new THREE.Quaternion().setFromUnitVectors(V3(0, 1, 0), v.normalize()),
    ex,
  });
}
function bodArch(s, z) {
  const pts = [];
  for (let i = 0; i <= 32; i++) {
    const t = (i / 32) * PI;
    pts.push([s * 0.915, 0.365 + 0.415 * Math.sin(t), z + 0.415 * Math.cos(t)]);
  }
  return P(
    "Wielkastrand " + sideName(s) + (z > 0 ? "voor" : "achter"),
    tube(pts, 0.016, 32, 6),
    MAT.plastic,
    {
      d: "Zwarte kunststof rand rondom de wielopening; vorm geschat.",
      ex: [s * 0.12, 0, 0],
    },
  );
}
function bodFender(s, z, front) {
  const z0 = front ? 0.84 : -2.23,
    z1 = front ? 2.23 : -0.84;
  const poly = Array.from({ length: 9 }, (_, i) => [
    lerp(z0, z1, i / 8),
    1.035,
  ]);
  poly.push([z1, 0.46]);
  // Onderzijde volgt de vrije wielboog, zonder een gesloten blok door het wiel.
  const lo = Math.max(z0, z - 0.425),
    hi = Math.min(z1, z + 0.425);
  if (z1 > hi) poly.push([hi, 0.38]);
  for (let i = 0; i <= 32; i++) {
    const a = (i / 32) * PI;
    poly.push([z + 0.425 * Math.cos(a), 0.365 + 0.425 * Math.sin(a)]);
  }
  if (z0 < lo) poly.push([z0, 0.38]);
  return P(
    (front ? "Voorscherm " : "Achterscherm ") + sideName(s),
    bodSide(
      s,
      poly,
      s < 0 && front
        ? [
            [
              [1.052, 0.858],
              [1.252, 0.858],
              [1.252, 1.022],
              [1.052, 1.022],
            ],
          ]
        : [],
    ),
    MAT.bodPaint,
    {
      d: "Gevouwen zijscherm met vrije wielboog; vorm afgeleid van de carrosseriefoto.",
      ex: [s * 0.28, 0.08, front ? 0.1 : -0.1],
    },
  );
}
function buildBody() {
  const kids = [
    A(
      "Bodem en veiligheidskooi",
      {
        d: "Dragende bodem, dorpels en stijlen rond de passagiersruimte; profielmaten geschat.",
        ex: [0, -0.15, 0],
      },
      [
        P("Cabinevloer", G.rbox(1.71, 0.035, 2.33, 0.012), MAT.darkSteel, {
          d: "Vlakke vloer boven het tractieaccupakket.",
          p: [0, 0.48, -0.07],
          ex: [0, -0.18, 0],
        }),
        ...[-1, 1].flatMap((s) => [
          P(
            "Dorpel " + sideName(s),
            G.rbox(0.095, 0.15, 1.73, 0.025),
            MAT.bodPaint,
            {
              d: "Versterkte dorpel onder de portieren.",
              p: [s * 0.865, 0.4, 0],
              ex: [s * 0.2, -0.1, 0],
            },
          ),
          bodBar(
            "A-stijl " + sideName(s),
            [s * 0.89, 1.04, 1.05],
            [s * 0.775, 1.54, 0.54],
            0.033,
            MAT.bodRoof,
            "Schuine voorruitstijl; doorsnede geschat.",
          ),
          bodBar(
            "B-stijl " + sideName(s),
            [s * 0.9, 0.49, -0.08],
            [s * 0.78, 1.55, -0.08],
            0.028,
            MAT.bodRoof,
            "Middelste veiligheidsstijl tussen de portieren.",
          ),
          P(
            "C-stijl " + sideName(s),
            bodSide(s, [
              [-1.78, 1.06],
              [-1.16, 1.53],
              [-0.98, 1.54],
              [-1.28, 1.075],
            ]),
            MAT.bodPaint,
            {
              d: "Brede vlakke schuine achterstijl; profiel geschat.",
              ex: [s * 0.2, 0.2, 0],
            },
          ),
        ]),
      ],
    ),
    ...[-1, 1].flatMap((s) => [
      bodFender(s, AXF, true),
      bodFender(s, AXR, false),
      bodArch(s, AXF),
      bodArch(s, AXR),
    ]),
    ...bodRearBelt(),
    ...bodFixedGlazing(),
    ...bodShoulders(),
    ...bodWheelLiners(),
    ...bodEngineBay(),
    buildBodHood(),
    buildBodTailgate(),
    ...[-1, 1].flatMap((s) => [buildBodDoor(s, true), buildBodDoor(s, false)]),
    P(
      "Voorruit",
      bodPanel([
        [-0.88, 1.065, 1.09],
        [0.88, 1.065, 1.09],
        [0.765, 1.532, 0.548],
        [-0.765, 1.532, 0.548],
      ]),
      MAT.bodGlass,
      {
        d: "Brede voorruit met donkere glasrand; helling geschat.",
        ex: [0, 0.35, 0.2],
      },
    ),
    buildPanorama(),
    P("Dakspoiler", G.rbox(1.56, 0.045, 0.19, 0.015), MAT.bodRoof, {
      d: "Zwarte achterspoiler boven de achterruit.",
      p: [0, 1.525, -1.24],
      ex: [0, 0.25, -0.15],
    }),
    P("Voorbumper", G.rbox(1.79, 0.28, 0.19, 0.055), MAT.bodPaint, {
      d: "Gesloten neus boven de onderste koelluchtopening.",
      p: [0, 0.83, 2.135],
      ex: [0, 0, 0.4],
    }),
    P(
      "Onderste luchtopening",
      G.rbox(1.48, 0.19, 0.06, 0.025),
      MAT.blackGloss,
      {
        d: "Donker koelluchtrooster, zonder verbrandingsmotorgrille.",
        p: [0, 0.56, 2.17],
        ex: [0, -0.1, 0.4],
      },
    ),
    P("Onderlip voor", G.rbox(1.75, 0.065, 0.14, 0.02), MAT.plastic, {
      d: "Beschermende zwarte onderrand van de voorbumper.",
      p: [0, 0.39, 2.13],
      ex: [0, -0.15, 0.3],
    }),
    P("Achterbumper", G.rbox(1.79, 0.26, 0.19, 0.055), MAT.bodPaint, {
      d: "Achterbumper zonder uitlaatopeningen.",
      p: [0, 0.74, -2.13],
      ex: [0, 0, -0.4],
    }),
    P("Onderlip achter", G.rbox(1.75, 0.16, 0.17, 0.035), MAT.plastic, {
      d: "Zwarte onderspoiler; deze elektrische auto heeft geen uitlaat.",
      p: [0, 0.48, -2.12],
      ex: [0, -0.15, -0.25],
    }),
    ...buildBodLights(),
    P("Renault-embleem", G.torus("z", 0.06, 0.009, 4, 4), MAT.satin, {
      d: "Gestileerde open Renault-ruit op de gesloten neus.",
      p: [0, 0.9, 2.234],
      s: [0.7, 1.25, 0.25],
      ex: [0, 0.03, 0.2],
    }),
    buildBodChargeFlap(),
  ];
  return A(
    "Carrosserie",
    {
      d: "Scénic E-Tech electric: korte motorkap, lange wielbasis, hoog interieur en tweekleurig dak. Paneelvormen zijn benaderd.",
      spec: [
        ["Lengte", "4.470 mm"],
        ["Breedte zonder spiegels", "1.864 mm"],
        ["Hoogte", "1.571 mm"],
        ["Wielbasis", "2.785 mm"],
      ],
      ex: [0, 1.8, 0],
    },
    kids,
  );
}

// Afwerking van de motorruimte: kuipen schermen de banden af, bodemplaten sluiten de onderzijde.
function bodWheelLiners() {
  return [-1, 1].flatMap((s) =>
    [AXF, AXR].flatMap((z) => {
      const name = sideName(s) + (z > 0 ? "voor" : "achter"),
        pts = [];
      for (let i = 0; i <= 32; i++) {
        const a = (i / 32) * PI;
        pts.push([
          s * 0.655,
          0.365 + 0.405 * Math.sin(a),
          z + 0.405 * Math.cos(a),
        ]);
      }
      return [
        P("Wielkuip " + name, G.half("x", 0.405, 0.22, PI, 32), MAT.plastic, {
          d: "Schematische gebogen wielkastvoering boven de band, zichtbaar vanuit de wielopening.",
          p: [s * 0.77, 0.365, z],
          ex: [s * 0.18, 0.15, 0],
        }),
        P("Binnenwand wielkuip " + name, bodPanel(pts), MAT.plastic, {
          d: "Schematische binnenwand die de wielopening afsluit naar de cabine of motorruimte.",
          ex: [-s * 0.15, 0, 0],
        }),
      ];
    }),
  );
}
function bodEngineBay() {
  return [
    P("Bodemplaat motorruimte", G.rbox(1.3, 0.018, 1.1, 0.008), MAT.plastic, {
      d: "Schematische onderste afscherming onder de elektrische aandrijving; houdt de wielopeningen vrij.",
      p: [0, 0.235, 1.625],
      ex: [0, -0.2, 0],
    }),
    P("Bodemplaat neus", G.rbox(1.64, 0.018, 0.34, 0.008), MAT.plastic, {
      d: "Schematische voorste onderplaat tussen de bumper en de wielkuipen.",
      p: [0, 0.235, 1.995],
      ex: [0, -0.25, 0.1],
    }),
    P("Schutbord", G.rbox(1.63, 0.48, 0.035, 0.012), MAT.darkSteel, {
      d: "Schematisch schutbord tussen de motorruimte en de voetenruimte.",
      p: [0, 0.74, 1.08],
      ex: [0, 0.2, -0.15],
    }),
  ];
}
function bodShoulders() {
  return [-1, 1]
    .map((s) => {
      const v = [],
        ix = [],
        N = 16;
      for (let j = 0; j <= N; j++) {
        const t = j / N,
          z = lerp(1.11, 2.15, t),
          w = lerp(0.87, 0.84, t) + 0.004,
          y = lerp(1.065, 1.036, t) - 0.004;
        v.push(s * w, y, z, s * HW(z), 1.035, z);
      }
      for (let j = 0; j < N; j++) {
        const k = j * 2;
        ix.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.Float32BufferAttribute(v, 3));
      g.setIndex(ix);
      g.computeVertexNormals();
      return P("Kaprand " + sideName(s), g, MAT.bodPaint, {
        d: "Vaste gelakte rand tussen het voorscherm en de motorkap; een smalle naad laat de kap vrij bewegen.",
        ex: [s * 0.15, 0.12, 0],
      });
    })
    .concat([
      P(
        "Neusrand",
        bodPanel([
          [-0.844, 1.031, 2.156],
          [0.844, 1.031, 2.156],
          [0.858, 0.97, 2.228],
          [-0.858, 0.97, 2.228],
        ]),
        MAT.bodPaint,
        {
          d: "Schematische gelakte verbindingsrand boven de bumper, onder de sluitnaad van de motorkap.",
          ex: [0, 0.1, 0.2],
        },
      ),
    ]);
}

// Vaste driehoeksruiten en de afwerking rondom de portier- en achterklepopeningen.
function bodFixedGlazing() {
  return [-1, 1].flatMap((s) => [
    P(
      "Voorste driehoeksruit " + sideName(s),
      bodSide(s, [
        [1.04, 1.06],
        [0.55, 1.515],
        [0.52, 1.517],
        [0.83, 1.06],
      ]),
      MAT.bodGlass,
      {
        d: "Schematische vaste driehoeksruit tussen de A-stijl en het voorportier; profiel geschat.",
        ex: [s * 0.15, 0.15, 0],
      },
    ),
    P(
      "Voorflank C-stijl " + sideName(s),
      bodSide(s, [
        [-0.83, 1.535],
        [-0.98, 1.54],
        [-1.28, 1.075],
        [-1.165, 1.105],
      ]),
      MAT.bodPaint,
      {
        d: "Schematische afwerking van de vaste stijl langs de achterrand van het achterportier.",
        ex: [s * 0.15, 0.12, 0],
      },
    ),
    P(
      "Vaste achterzijruit " + sideName(s),
      bodSide(s, [
        [-1.18, 1.5],
        [-1.29, 1.5],
        [-2.14, 1.082],
        [-1.78, 1.06],
      ]),
      MAT.bodGlass,
      {
        d: "Schematisch vast glasvlak achter de C-stijl. Geen opener; de contour is benaderd.",
        ex: [s * 0.2, 0.15, -0.1],
      },
    ),
    P(
      "Achterklepstijl " + sideName(s),
      bodPanel([
        [s * 0.76, 1.51, -1.31],
        [s * 0.84, 1.085, -2.15],
        [s * 0.914, 1.035, -2.23],
        [s * 0.78, 1.53, -1.2],
      ]),
      MAT.bodPaint,
      {
        d: "Schematische vaste stijl rond de zijrand van de achterklep; sluit aan op de achterste glasrand.",
        ex: [s * 0.2, 0.1, -0.1],
      },
    ),
  ]);
}

// Doorlopende raamvoet onder het vaste achterste zijglas en de C-stijl.
function bodRearBelt() {
  return [-1, 1].map((s) =>
    P(
      "Raamvoet achterste zijwand " + sideName(s),
      bodSide(s, [
        [-1.17, 1.035],
        [-2.22, 1.035],
        [-2.22, 1.09],
        [-2.14, 1.107],
        [-1.78, 1.085],
        [-1.28, 1.1],
        [-1.17, 1.13],
      ]),
      MAT.bodRoof,
      {
        d: "Zwarte raamvoetafwerking onder het vaste achterste zijglas en de C-stijl; profiel geschat. Sluit aan op de gordellijn van het portier.",
        p: [s * 0.001, 0, 0],
        ex: [s * 0.18, 0.08, -0.1],
      },
    ),
  );
}
