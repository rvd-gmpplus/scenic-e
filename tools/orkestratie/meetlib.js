// Meetbibliotheek voor clash.py en huid.py (generiek: geen onderdeelnamen, alles komt als argument binnen).
// Wordt door de Python-scripts in de pagina geevalueerd en zet window.__meet. Eenheden zijn die van het model (meter);
// de Python-kant rekent om naar millimeter. Alle meetpunten staan in wereldcoordinaten, na updateMatrixWorld in de huidige stand.
// Geen THREE.Raycaster: het binnen-in-test (stralen met paritieit) en de afstanden rekenen op de driehoeken zelf, dus
// de laag van gebundeld tekenen speelt hier geen rol (een eigen Raycaster zou layers.enableAll() nodig hebben).
(() => {
  const L = window.__model;
  const WG = new WeakMap(), GR = new WeakMap(), PR = new WeakMap(), CL = new WeakMap();
  const DIRS = [[0.3714, 0.8281, 0.4157], [-0.6203, 0.2915, 0.7274], [0.1337, -0.5719, 0.8089]].map(d => { const n = Math.hypot(...d); return d.map(x => x / n); });

  function nodePath(n) { const p = []; for (; n; n = n.parent) p.unshift(n.name); return p.slice(1).join('/'); }
  function resolve(naam) {
    const n = L.byPath(naam) || L.byName(naam);
    if (!n) return { fout: 'knoop niet gevonden: ' + naam };
    const dubbel = L.ALL.filter(k => k.name === naam).length;
    return { node: n, pad: nodePath(n), waarschuwing: dubbel > 1 && !String(naam).includes('/') ? `${dubbel} knopen heten "${naam}"; eerste gebruikt (${nodePath(n)}); geef een pad om te kiezen` : null };
  }
  // alleen de meshes van het model zelf (L.MESHES); gebundeld tekenen hangt er samengevoegde meshes bij die geen onderdeel zijn
  const MSET = new Set(L.MESHES);
  function meshesOf(n) { const out = []; n.obj.traverse(o => { if (o.isMesh && MSET.has(o)) out.push(o); }); return out; }
  function prepare() { L.finishAll(); L.ROOT.obj.updateMatrixWorld(true); }

  // wereldgeometrie van een mesh: positie (Float64), index (Uint32), kader. De cache geldt alleen zolang matrixWorld en
  // geometrie gelijk zijn: na een opener of uitklapstand rekent hij opnieuw (een nieuw object, dus ook rooster, punten en
  // geslotenheid worden dan opnieuw bepaald).
  function sameStand(g, mesh) {
    if (g.geo !== mesh.geometry || g.ver !== mesh.geometry.attributes.position.version) return false;
    const e = mesh.matrixWorld.elements; for (let i = 0; i < 16; i++) if (e[i] !== g.mw[i]) return false;
    return true;
  }
  function worldGeo(mesh) {
    let g = WG.get(mesh); if (g && sameStand(g, mesh)) return g;
    const a = mesh.geometry.attributes.position, nv = a.count, e = mesh.matrixWorld.elements, pos = new Float64Array(nv * 3);
    const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    for (let i = 0; i < nv; i++) {
      const x = a.getX(i), y = a.getY(i), z = a.getZ(i), w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]);
      const X = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w, Y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w, Z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
      pos[3 * i] = X; pos[3 * i + 1] = Y; pos[3 * i + 2] = Z;
      if (X < lo[0]) lo[0] = X; if (X > hi[0]) hi[0] = X; if (Y < lo[1]) lo[1] = Y; if (Y > hi[1]) hi[1] = Y; if (Z < lo[2]) lo[2] = Z; if (Z > hi[2]) hi[2] = Z;
    }
    const ix = mesh.geometry.index, nt = ix ? Math.floor(ix.count / 3) : Math.floor(nv / 3), idx = new Uint32Array(nt * 3);
    for (let i = 0; i < nt * 3; i++) idx[i] = ix ? ix.getX(i) : i;
    g = { mesh, pos, idx, nv, nt, lo, hi, pad: nodePath(mesh.userData.node), geo: mesh.geometry, ver: a.version, mw: Float64Array.from(e) };
    WG.set(mesh, g); return g;
  }
  // meerdere meshes als een geometrie (huid.py: een knoop is een verzameling meshes)
  function mergeGeos(gs) {
    let nv = 0, nt = 0; for (const g of gs) { nv += g.nv; nt += g.nt; }
    const pos = new Float64Array(nv * 3), idx = new Uint32Array(nt * 3), lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
    let vo = 0, to = 0;
    for (const g of gs) {
      pos.set(g.pos, vo * 3);
      for (let i = 0; i < g.nt * 3; i++) idx[to * 3 + i] = g.idx[i] + vo;
      for (let k = 0; k < 3; k++) { if (g.lo[k] < lo[k]) lo[k] = g.lo[k]; if (g.hi[k] > hi[k]) hi[k] = g.hi[k]; }
      vo += g.nv; to += g.nt;
    }
    return { pos, idx, nv, nt, lo, hi };
  }

  // dichtstbijzijnde punt op een driehoek (Ericson); kwadraat van de afstand, punt in CX, CY, CZ
  let CX = 0, CY = 0, CZ = 0;
  function ptTri(px, py, pz, ax, ay, az, bx, by, bz, cx, cy, cz) {
    const abx = bx - ax, aby = by - ay, abz = bz - az, acx = cx - ax, acy = cy - ay, acz = cz - az, apx = px - ax, apy = py - ay, apz = pz - az;
    const d1 = abx * apx + aby * apy + abz * apz, d2 = acx * apx + acy * apy + acz * apz;
    if (d1 <= 0 && d2 <= 0) { CX = ax; CY = ay; CZ = az; return apx * apx + apy * apy + apz * apz; }
    const bpx = px - bx, bpy = py - by, bpz = pz - bz, d3 = abx * bpx + aby * bpy + abz * bpz, d4 = acx * bpx + acy * bpy + acz * bpz;
    if (d3 >= 0 && d4 <= d3) { CX = bx; CY = by; CZ = bz; return bpx * bpx + bpy * bpy + bpz * bpz; }
    const vc = d1 * d4 - d3 * d2;
    if (vc <= 0 && d1 >= 0 && d3 <= 0) { const v = d1 / (d1 - d3); CX = ax + v * abx; CY = ay + v * aby; CZ = az + v * abz; const dx = px - CX, dy = py - CY, dz = pz - CZ; return dx * dx + dy * dy + dz * dz; }
    const cpx = px - cx, cpy = py - cy, cpz = pz - cz, d5 = abx * cpx + aby * cpy + abz * cpz, d6 = acx * cpx + acy * cpy + acz * cpz;
    if (d6 >= 0 && d5 <= d6) { CX = cx; CY = cy; CZ = cz; return cpx * cpx + cpy * cpy + cpz * cpz; }
    const vb = d5 * d2 - d1 * d6;
    if (vb <= 0 && d2 >= 0 && d6 <= 0) { const w = d2 / (d2 - d6); CX = ax + w * acx; CY = ay + w * acy; CZ = az + w * acz; const dx = px - CX, dy = py - CY, dz = pz - CZ; return dx * dx + dy * dy + dz * dz; }
    const va = d3 * d6 - d5 * d4;
    if (va <= 0 && d4 - d3 >= 0 && d5 - d6 >= 0) { const w = (d4 - d3) / ((d4 - d3) + (d5 - d6)); CX = bx + w * (cx - bx); CY = by + w * (cy - by); CZ = bz + w * (cz - bz); const dx = px - CX, dy = py - CY, dz = pz - CZ; return dx * dx + dy * dy + dz * dz; }
    const den = va + vb + vc;
    if (!(Math.abs(den) > 1e-300)) { // ontaarde driehoek: dichtstbijzijnde hoekpunt
      CX = ax; CY = ay; CZ = az; let best = apx * apx + apy * apy + apz * apz;
      const db = bpx * bpx + bpy * bpy + bpz * bpz; if (db < best) { best = db; CX = bx; CY = by; CZ = bz; }
      const dc = cpx * cpx + cpy * cpy + cpz * cpz; if (dc < best) { best = dc; CX = cx; CY = cy; CZ = cz; }
      return best;
    }
    const v = vb / den, w = vc / den; CX = ax + abx * v + acx * w; CY = ay + aby * v + acy * w; CZ = az + abz * v + acz * w;
    const dx = px - CX, dy = py - CY, dz = pz - CZ; return dx * dx + dy * dy + dz * dz;
  }

  // uniform rooster van driehoeken voor dichtstbijzijnde-puntvragen
  function buildGrid(g) {
    const { pos, idx, nt, lo, hi } = g;
    let som = 0;
    for (let t = 0; t < nt; t++) {
      const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3; let m = 0;
      for (let k = 0; k < 3; k++) { const mn = Math.min(pos[a + k], pos[b + k], pos[c + k]), mx = Math.max(pos[a + k], pos[b + k], pos[c + k]); if (mx - mn > m) m = mx - mn; }
      som += m;
    }
    const ext = [hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]];
    const h = Math.max(2 * som / Math.max(1, nt), Math.max(...ext) / 128, 1e-5);
    const nx = Math.floor(ext[0] / h) + 1, ny = Math.floor(ext[1] / h) + 1, nz = Math.floor(ext[2] / h) + 1, cells = new Map();
    for (let t = 0; t < nt; t++) {
      const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3, r = [];
      for (let k = 0; k < 3; k++) { r.push(Math.floor((Math.min(pos[a + k], pos[b + k], pos[c + k]) - lo[k]) / h), Math.floor((Math.max(pos[a + k], pos[b + k], pos[c + k]) - lo[k]) / h)); }
      for (let z = r[4]; z <= r[5]; z++) for (let y = r[2]; y <= r[3]; y++) for (let x = r[0]; x <= r[1]; x++) {
        const key = (z * ny + y) * nx + x; let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(t);
      }
    }
    return { g, h, nx, ny, nz, cells, seen: new Int32Array(nt), q: 0 };
  }
  function gridOf(g) { let G = GR.get(g); if (!G) GR.set(g, G = buildGrid(g)); return G; }

  // kwadraat van de afstand van (px,py,pz) tot het oppervlak, hoogstens maxd; Infinity als verder weg. Punt in CX..CZ.
  function nearest(G, px, py, pz, maxd) {
    const { g, h, nx, ny, nz, cells, seen } = G, lo = g.lo, pos = g.pos, idx = g.idx;
    const cl = (v, n) => v < 0 ? 0 : v >= n ? n - 1 : v;
    const cx = cl(Math.floor((px - lo[0]) / h), nx), cy = cl(Math.floor((py - lo[1]) / h), ny), cz = cl(Math.floor((pz - lo[2]) / h), nz);
    let best = maxd * maxd, found = false, bx = 0, by = 0, bz = 0; const st = ++G.q, kmax = Math.max(nx, ny, nz);
    const visit = (x, y, z) => {
      if (x < 0 || y < 0 || z < 0 || x >= nx || y >= ny || z >= nz) return;
      const l = cells.get((z * ny + y) * nx + x); if (!l) return;
      for (let i = 0; i < l.length; i++) {
        const t = l[i]; if (seen[t] === st) continue; seen[t] = st;
        const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
        const d = ptTri(px, py, pz, pos[a], pos[a + 1], pos[a + 2], pos[b], pos[b + 1], pos[b + 2], pos[c], pos[c + 1], pos[c + 2]);
        if (d < best || (!found && d <= best)) { best = d; found = true; bx = CX; by = CY; bz = CZ; }
      }
    };
    for (let k = 0; k <= kmax; k++) {
      if (k === 0) visit(cx, cy, cz);
      else for (let dz = -k; dz <= k; dz++) for (let dy = -k; dy <= k; dy++) {
        if (Math.abs(dz) === k || Math.abs(dy) === k) { for (let dx = -k; dx <= k; dx++) visit(cx + dx, cy + dy, cz + dz); }
        else { visit(cx - k, cy + dy, cz + dz); visit(cx + k, cy + dy, cz + dz); }
      }
      const lim = k * h; if (found ? best <= lim * lim : lim >= maxd) break;
    }
    CX = bx; CY = by; CZ = bz;
    return found ? best : Infinity;
  }

  // oppervlaktepunten van een geometrie op ongeveer h; alleen driehoeken waarvan het kader het kader [lo,hi] raakt
  function sample(g, h, lo, hi, cap) {
    const { pos, idx, nt } = g, sel = [];
    for (let t = 0; t < nt; t++) {
      const a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3; let ok = true;
      if (lo) for (let k = 0; k < 3; k++) { if (Math.max(pos[a + k], pos[b + k], pos[c + k]) < lo[k] || Math.min(pos[a + k], pos[b + k], pos[c + k]) > hi[k]) { ok = false; break; } }
      if (ok) sel.push(t);
    }
    const plan = hh => {
      let n = 0; const P = new Array(sel.length);
      for (let s = 0; s < sel.length; s++) {
        const t = sel[s], v = [idx[3 * t] * 3, idx[3 * t + 1] * 3, idx[3 * t + 2] * 3];
        const e = [Math.hypot(pos[v[1]] - pos[v[2]], pos[v[1] + 1] - pos[v[2] + 1], pos[v[1] + 2] - pos[v[2] + 2]), Math.hypot(pos[v[0]] - pos[v[2]], pos[v[0] + 1] - pos[v[2] + 1], pos[v[0] + 2] - pos[v[2] + 2]), Math.hypot(pos[v[0]] - pos[v[1]], pos[v[0] + 1] - pos[v[1] + 1], pos[v[0] + 2] - pos[v[1] + 2])];
        const m = e[0] >= e[1] && e[0] >= e[2] ? 0 : e[1] >= e[2] ? 1 : 2, o = v[m], u = v[(m + 1) % 3], w = v[(m + 2) % 3]; // o ligt tegenover de langste zijde
        const eu = Math.hypot(pos[u] - pos[o], pos[u + 1] - pos[o + 1], pos[u + 2] - pos[o + 2]), ew = Math.hypot(pos[w] - pos[o], pos[w + 1] - pos[o + 1], pos[w + 2] - pos[o + 2]);
        const na = Math.max(1, Math.ceil(eu / hh)), nb = Math.max(1, Math.ceil(ew / hh));
        let c = 0; for (let i = 0; i <= na; i++) c += Math.floor(nb * (na - i) / na + 1e-9) + 1;
        P[s] = [o, u, w, na, nb]; n += c;
      }
      return { P, n };
    };
    let hh = h, pl = plan(hh);
    for (let r = 0; r < 6 && pl.n > cap; r++) { hh *= Math.max(1.2, Math.sqrt(pl.n / cap)); pl = plan(hh); }
    const out = new Float64Array(pl.n * 3); let q = 0;
    for (const [o, u, w, na, nb] of pl.P) {
      const ux = pos[u] - pos[o], uy = pos[u + 1] - pos[o + 1], uz = pos[u + 2] - pos[o + 2], wx = pos[w] - pos[o], wy = pos[w + 1] - pos[o + 1], wz = pos[w + 2] - pos[o + 2];
      for (let i = 0; i <= na; i++) {
        const jm = Math.floor(nb * (na - i) / na + 1e-9), fi = i / na;
        for (let j = 0; j <= jm; j++) { const fj = j / nb; out[q++] = pos[o] + ux * fi + wx * fj; out[q++] = pos[o + 1] + uy * fi + wy * fj; out[q++] = pos[o + 2] + uz * fi + wz * fj; }
      }
    }
    return { pts: out, h: hh, tris: sel.length };
  }

  // gesloten? elke gelaste rand hoort bij precies twee driehoeken
  function closedInfo(g) {
    let c = CL.get(g); if (c) return c;
    const { pos, idx, nt, nv } = g, id = new Int32Array(nv), map = new Map(); let n = 0;
    for (let i = 0; i < nv; i++) {
      const k = Math.round(pos[3 * i] * 1e6) + ',' + Math.round(pos[3 * i + 1] * 1e6) + ',' + Math.round(pos[3 * i + 2] * 1e6);
      let v = map.get(k); if (v === undefined) map.set(k, v = n++); id[i] = v;
    }
    const em = new Map();
    for (let t = 0; t < nt; t++) for (let e = 0; e < 3; e++) {
      const a = id[idx[3 * t + e]], b = id[idx[3 * t + (e + 1) % 3]]; if (a === b) continue;
      const k = a < b ? a * n + b : b * n + a; em.set(k, (em.get(k) || 0) + 1);
    }
    let open = 0, nonman = 0; for (const v of em.values()) { if (v === 1 || v % 2 === 1) open++; else if (v > 2) nonman++; }
    c = { randen: em.size, open, nietManifold: nonman, gesloten: open === 0 };
    CL.set(g, c); return c;
  }

  // binnen/buiten door stralen: oneven aantal snijpunten = binnen. Per richting een 2D-rooster van de projectie.
  function projOf(g, di) {
    let a = PR.get(g); if (!a) PR.set(g, a = []);
    if (a[di]) return a[di];
    const d = DIRS[di], t0 = Math.abs(d[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    let u = [d[1] * t0[2] - d[2] * t0[1], d[2] * t0[0] - d[0] * t0[2], d[0] * t0[1] - d[1] * t0[0]]; const un = Math.hypot(...u); u = u.map(x => x / un);
    const v = [d[1] * u[2] - d[2] * u[1], d[2] * u[0] - d[0] * u[2], d[0] * u[1] - d[1] * u[0]];
    const { pos, idx, nt, nv } = g, pu = new Float64Array(nv), pv = new Float64Array(nv);
    let u0 = Infinity, u1 = -Infinity, v0 = Infinity, v1 = -Infinity;
    for (let i = 0; i < nv; i++) {
      pu[i] = pos[3 * i] * u[0] + pos[3 * i + 1] * u[1] + pos[3 * i + 2] * u[2]; pv[i] = pos[3 * i] * v[0] + pos[3 * i + 1] * v[1] + pos[3 * i + 2] * v[2];
      if (pu[i] < u0) u0 = pu[i]; if (pu[i] > u1) u1 = pu[i]; if (pv[i] < v0) v0 = pv[i]; if (pv[i] > v1) v1 = pv[i];
    }
    const h = Math.max(Math.sqrt(Math.max(1e-12, (u1 - u0) * (v1 - v0)) / Math.max(1, nt)) * 1.5, (u1 - u0) / 400, (v1 - v0) / 400, 1e-5);
    const nx = Math.floor((u1 - u0) / h) + 1, ny = Math.floor((v1 - v0) / h) + 1, cells = new Map();
    for (let t = 0; t < nt; t++) {
      const i0 = idx[3 * t], i1 = idx[3 * t + 1], i2 = idx[3 * t + 2];
      const xa = Math.floor((Math.min(pu[i0], pu[i1], pu[i2]) - u0) / h), xb = Math.floor((Math.max(pu[i0], pu[i1], pu[i2]) - u0) / h);
      const ya = Math.floor((Math.min(pv[i0], pv[i1], pv[i2]) - v0) / h), yb = Math.floor((Math.max(pv[i0], pv[i1], pv[i2]) - v0) / h);
      for (let y = ya; y <= yb; y++) for (let x = xa; x <= xb; x++) { const key = y * nx + x; let l = cells.get(key); if (!l) cells.set(key, l = []); l.push(t); }
    }
    return a[di] = { d, u, v, u0, v0, h, nx, ny, cells };
  }
  function rayCount(g, di, px, py, pz) {
    const P = projOf(g, di), { d, u, v } = P, pos = g.pos, idx = g.idx;
    const x = Math.floor(((px * u[0] + py * u[1] + pz * u[2]) - P.u0) / P.h), y = Math.floor(((px * v[0] + py * v[1] + pz * v[2]) - P.v0) / P.h);
    if (x < 0 || y < 0 || x >= P.nx || y >= P.ny) return 0;
    const l = P.cells.get(y * P.nx + x); if (!l) return 0; let n = 0;
    for (let i = 0; i < l.length; i++) {
      const t = l[i], a = idx[3 * t] * 3, b = idx[3 * t + 1] * 3, c = idx[3 * t + 2] * 3;
      const e1x = pos[b] - pos[a], e1y = pos[b + 1] - pos[a + 1], e1z = pos[b + 2] - pos[a + 2], e2x = pos[c] - pos[a], e2y = pos[c + 1] - pos[a + 1], e2z = pos[c + 2] - pos[a + 2];
      const qx = d[1] * e2z - d[2] * e2y, qy = d[2] * e2x - d[0] * e2z, qz = d[0] * e2y - d[1] * e2x, det = e1x * qx + e1y * qy + e1z * qz;
      if (Math.abs(det) < 1e-20) continue;
      const inv = 1 / det, tx = px - pos[a], ty = py - pos[a + 1], tz = pz - pos[a + 2], su = (tx * qx + ty * qy + tz * qz) * inv;
      if (su < 0 || su > 1) continue;
      const rx = ty * e1z - tz * e1y, ry = tz * e1x - tx * e1z, rz = tx * e1y - ty * e1x, sv = (d[0] * rx + d[1] * ry + d[2] * rz) * inv;
      if (sv < 0 || su + sv > 1) continue;
      if ((e2x * rx + e2y * ry + e2z * rz) * inv > 1e-9) n++;
    }
    return n;
  }
  function inside(g, px, py, pz) {
    const a = rayCount(g, 0, px, py, pz) & 1, b = rayCount(g, 1, px, py, pz) & 1;
    return a === b ? a === 1 : (rayCount(g, 2, px, py, pz) & 1) === 1;
  }

  // een gericht paar: punten van A tegen het oppervlak van B
  function richting(A, B, R, h, tol, cap) {
    const lo = B.lo.map(v => v - R), hi = B.hi.map(v => v + R);
    const s = sample(A, h, lo, hi, cap), pts = s.pts, G = gridOf(B);
    let nPts = 0, nBin = 0, min = Infinity, minAt = null; const bin = [];
    for (let i = 0; i < pts.length; i += 3) {
      const x = pts[i], y = pts[i + 1], z = pts[i + 2];
      if (x < lo[0] || x > hi[0] || y < lo[1] || y > hi[1] || z < lo[2] || z > hi[2]) continue;
      nPts++;
      const d2 = nearest(G, x, y, z, R);
      if (d2 < min * min || (min === Infinity && d2 < Infinity)) { min = Math.sqrt(d2); minAt = [x, y, z]; }
      if (x >= B.lo[0] && x <= B.hi[0] && y >= B.lo[1] && y <= B.hi[1] && z >= B.lo[2] && z <= B.hi[2] && inside(B, x, y, z)) { nBin++; bin.push(i); }
    }
    // diepte van de binnenpunten: afstand tot het oppervlak van B; hoogstens 400 punten, gelijkmatig gekozen
    let diepte = 0, diepteAt = null;
    const stap = Math.max(1, Math.ceil(bin.length / 400));
    for (let k = 0; k < bin.length; k += stap) {
      const i = bin[k], d2 = nearest(G, pts[i], pts[i + 1], pts[i + 2], Infinity);
      if (d2 !== Infinity && Math.sqrt(d2) > diepte) { diepte = Math.sqrt(d2); diepteAt = [pts[i], pts[i + 1], pts[i + 2]]; }
    }
    return { nPts, nBin, min, minAt, diepte, diepteAt, h: s.h, gesloten: closedInfo(B).gesloten };
  }

  // clash: opties {targets:[naam], tegen:[naam]|null, R, h, tol, cap}; alles in meter
  function clash(o) {
    prepare();
    const fouten = [], waarschuwingen = [], T = [];
    for (const naam of o.targets) { const r = resolve(naam); if (r.fout) fouten.push(r.fout); else { T.push(r); if (r.waarschuwing) waarschuwingen.push(r.waarschuwing); } }
    let tegenMeshes = L.MESHES.slice();
    if (o.tegen && o.tegen.length) {
      tegenMeshes = [];
      for (const naam of o.tegen) { const r = resolve(naam); if (r.fout) fouten.push(r.fout); else { if (r.waarschuwing) waarschuwingen.push(r.waarschuwing); for (const m of meshesOf(r.node)) tegenMeshes.push(m); } }
    }
    if (fouten.length) return { fouten };
    const tegenGeo = [];
    const bbox = m => { const b = m.geometry.boundingBox || (m.geometry.computeBoundingBox(), m.geometry.boundingBox), r = [Infinity, Infinity, Infinity, -Infinity, -Infinity, -Infinity], e = m.matrixWorld.elements;
      for (const x of [b.min.x, b.max.x]) for (const y of [b.min.y, b.max.y]) for (const z of [b.min.z, b.max.z]) {
        const w = 1 / (e[3] * x + e[7] * y + e[11] * z + e[15]), X = (e[0] * x + e[4] * y + e[8] * z + e[12]) * w, Y = (e[1] * x + e[5] * y + e[9] * z + e[13]) * w, Z = (e[2] * x + e[6] * y + e[10] * z + e[14]) * w;
        r[0] = Math.min(r[0], X); r[1] = Math.min(r[1], Y); r[2] = Math.min(r[2], Z); r[3] = Math.max(r[3], X); r[4] = Math.max(r[4], Y); r[5] = Math.max(r[5], Z);
      } return r; };
    const ob = new Map(); for (const m of tegenMeshes) ob.set(m, bbox(m));
    const alleT = new Set(); for (const t of T) for (const m of meshesOf(t.node)) alleT.add(m);
    const klaar = new Set(), res = new Map(); let nPaar = 0;
    for (const t of T) {
      const eigen = new Set(meshesOf(t.node));
      for (const tm of eigen) {
        const tb = bbox(tm);
        for (const om of tegenMeshes) {
          if (om === tm || eigen.has(om)) continue;
          if (alleT.has(om)) { const k = tm.id < om.id ? tm.id + '|' + om.id : om.id + '|' + tm.id; if (klaar.has(k)) continue; klaar.add(k); }
          const b = ob.get(om);
          if (b[0] > tb[3] + o.R || b[3] < tb[0] - o.R || b[1] > tb[4] + o.R || b[4] < tb[1] - o.R || b[2] > tb[5] + o.R || b[5] < tb[2] - o.R) continue;
          const A = worldGeo(tm), B = worldGeo(om); nPaar++;
          const ab = richting(A, B, o.R, o.h, o.tol, o.cap), ba = richting(B, A, o.R, o.h, o.tol, o.cap);
          const key = A.pad + '\n' + B.pad; let r = res.get(key);
          if (!r) res.set(key, r = { a: A.pad, b: B.pad, nAB: 0, nBA: 0, oAB: 0, oBA: 0, ptsAB: 0, ptsBA: 0, min: Infinity, diepte: 0, odiepte: 0, plek: null, oplek: null, minPlek: null, openA: false, openB: false, meshes: 0 });
          r.meshes++; r.ptsAB += ab.nPts; r.ptsBA += ba.nPts;
          for (const [x, kant] of [[ab, 'AB'], [ba, 'BA']]) {
            if (x.min < r.min) { r.min = x.min; r.minPlek = x.minAt; }
            if (!x.nBin) continue;
            if (x.gesloten) { // binnen-oordeel betrouwbaar: het omhullende mesh is gesloten
              r['n' + kant] += x.nBin;
              if (x.diepte > r.diepte) { r.diepte = x.diepte; r.plek = x.diepteAt; }
            } else { // open mesh (schaal, buis): 'binnen' betekent alleen 'achter het oppervlak'; niet als doordringing tellen
              r['o' + kant] += x.nBin; r['open' + (kant === 'AB' ? 'B' : 'A')] = true;
              if (x.diepte > r.odiepte) { r.odiepte = x.diepte; r.oplek = x.diepteAt; }
            }
          }
        }
      }
    }
    const paren = [];
    for (const r of res.values()) {
      const binnen = r.nAB + r.nBA > 0 && r.diepte >= o.tol, onzeker = r.oAB + r.oBA > 0;
      if (!binnen && !onzeker && !(r.min <= o.R)) continue;
      paren.push({ a: r.a, b: r.b, dist: binnen ? -r.diepte : (r.min <= o.R ? r.min : null), binnenAB: r.nAB, binnenBA: r.nBA, onzekerAB: r.oAB, onzekerBA: r.oBA, onzekerDiepte: r.odiepte,
        puntenAB: r.ptsAB, puntenBA: r.ptsBA, openA: r.openA, openB: r.openB, plek: binnen ? r.plek : (r.min <= o.R ? r.minPlek : r.oplek), meshes: r.meshes });
    }
    paren.sort((p, q) => (p.dist === null ? Infinity : p.dist) - (q.dist === null ? Infinity : q.dist));
    let n = 0; for (const t of T) n += meshesOf(t.node).length;
    return { fouten, waarschuwingen, paren, doelen: T.map(t => t.pad), doelMeshes: n, kandidaten: nPaar, andereMeshes: tegenMeshes.length, stand: stand() };
  }

  function stand() { const s = L.state(); return { preset: s.preset, explode: s.explode.value, open: s.open.length, openers: s.openers.length, mode: s.mode }; }

  // huid.py: wereldpunten van de huid van een knoop (vertices, gededupliceerd op 0,1 micrometer)
  function huidBewaar(namen) {
    prepare(); const out = {}, fouten = [];
    for (const naam of namen) {
      const r = resolve(naam); if (r.fout) { fouten.push(r.fout); continue; }
      const meshes = meshesOf(r.node), seen = new Set(), pts = [];
      for (const m of meshes) {
        const g = worldGeo(m), used = new Uint8Array(g.nv); for (let i = 0; i < g.nt * 3; i++) used[g.idx[i]] = 1;
        for (let i = 0; i < g.nv; i++) {
          if (!used[i]) continue;
          const x = g.pos[3 * i], y = g.pos[3 * i + 1], z = g.pos[3 * i + 2], k = Math.round(x * 1e7) + ',' + Math.round(y * 1e7) + ',' + Math.round(z * 1e7);
          if (seen.has(k)) continue; seen.add(k); pts.push(x, y, z);
        }
      }
      out[naam] = { pad: r.pad, meshes: meshes.map(m => nodePath(m.userData.node)), n: pts.length / 3, punten: pts, waarschuwing: r.waarschuwing };
    }
    return { fouten, knopen: out, stand: stand(), model: L.version };
  }
  // huid.py: afstand van elk referentiepunt tot het oppervlak van dezelfde knoop nu
  function huidVergelijk(ref) {
    prepare(); const out = {}, fouten = [];
    for (const [naam, k] of Object.entries(ref.knopen)) {
      const r = resolve(k.pad || naam); if (r.fout) { fouten.push(r.fout); continue; }
      const gs = meshesOf(r.node).map(worldGeo), g = mergeGeos(gs), G = buildGrid(g), n = k.punten.length / 3;
      const d = new Float64Array(n), cp = new Float64Array(n * 3);
      for (let i = 0; i < n; i++) {
        const d2 = nearest(G, k.punten[3 * i], k.punten[3 * i + 1], k.punten[3 * i + 2], Infinity);
        d[i] = Math.sqrt(d2); cp[3 * i] = CX; cp[3 * i + 1] = CY; cp[3 * i + 2] = CZ;
      }
      out[naam] = { pad: r.pad, nieuwTriangles: g.nt, nieuwMeshes: gs.length, d: Array.from(d), cp: Array.from(cp) };
    }
    return { fouten, knopen: out, stand: stand(), model: L.version };
  }

  window.__meet = { clash, huidBewaar, huidVergelijk, resolve, nodePath, meshesOf, worldGeo, gridOf, inside, nearest, closedInfo, prepare };
})();
