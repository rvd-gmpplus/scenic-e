/* Solarbay is vast glas met regelbare ondoorzichtigheid, geen schuifdak. */
function buildPanorama() {
  return A(
    "Solarbay panoramadak",
    {
      d: "Vast panoramisch glasdak met elektrisch regelbare ondoorzichtigheid. Deze uitvoering toont de donkere stand; de segmentering is schematisch.",
      ex: [0, 0.4, 0],
    },
    [
      P("Dakrand", G.rbox(1.56, 0.025, 1.82, 0.012), MAT.bodRoof, {
        d: "Zwart dakpaneel rond het glasdak.",
        p: [0, 1.548, -0.34],
        ex: [0, 0.15, 0],
      }),
      P("Vast panoramaglas", G.rbox(1.38, 0.012, 1.38, 0.005), MAT.bodGlass, {
        d: "Vast Solarbay-glas; het dak kantelt of schuift niet open.",
        p: [0, 1.568, -0.34],
        ex: [0, 0.3, 0],
      }),
    ],
  );
}
