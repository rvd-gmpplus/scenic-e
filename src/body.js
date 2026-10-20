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
function bodSide(s, pts) {
  return bodPanel(
    pts.map(([z, y]) => [
      s * (y > 1.1 ? lerp(HW(z), 0.775, clamp((y - 1.1) / 0.45, 0, 1)) : HW(z)),
      y,
      z,
    ]),
  );
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
    bodSide(s, poly),
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
