import * as THREE from "three";
import {
  makeSeeded,
  makeWoodSlatsTexture,
  mergeNormalizedGeoms,
  makeTransformedPosUvBuf,
  makeTransform,
  pushTri,
  pushQuad,
  appendConvexPrism,
  appendRibbonStrip,
  addLocalBox,
  regularPoly2D,
  createClearanceChecker,
  dominantEdgeYaw,
  sampleCandidatesInZone,
  createBotanicalInstancedMeshes,
  createSitterInstancedMeshes,
} from "./garden-assets.js";

/** Add a 3D surface grid of quads (double-sided capable) into a pos/uv bucket. */
function appendGridSurface(bucket, grid, tr, uScale = 1.0, vScale = 1.0) {
  const nu = grid.length - 1;
  const nv = grid[0].length - 1;
  for (let i = 0; i < nu; i++) {
    for (let j = 0; j < nv; j++) {
      const a = tr(grid[i][j][0], grid[i][j][1], grid[i][j][2]);
      const b = tr(grid[i + 1][j][0], grid[i + 1][j][1], grid[i + 1][j][2]);
      const c = tr(grid[i + 1][j + 1][0], grid[i + 1][j + 1][1], grid[i + 1][j + 1][2]);
      const d = tr(grid[i][j + 1][0], grid[i][j + 1][1], grid[i][j + 1][2]);
      pushQuad(
        bucket.pos,
        bucket.uv,
        a,
        b,
        c,
        d,
        [(i / nu) * uScale, (j / nv) * vScale],
        [((i + 1) / nu) * uScale, (j / nv) * vScale],
        [((i + 1) / nu) * uScale, ((j + 1) / nv) * vScale],
        [(i / nu) * uScale, ((j + 1) / nv) * vScale]
      );
    }
  }
}

/** Add a solid thick circular annulus sector prism (used for oculus roof rings & skylight panels). */
function appendAnnulusPrism(bucket, rInner, rOuter, yBot, yTop, steps, tr, uvScale = 1.0) {
  for (let i = 0; i < steps; i++) {
    const a0 = (i / steps) * Math.PI * 2;
    const a1 = ((i + 1) / steps) * Math.PI * 2;
    const c0 = Math.cos(a0), s0 = Math.sin(a0);
    const c1 = Math.cos(a1), s1 = Math.sin(a1);
    const pIn0 = [c0 * rInner, s0 * rInner];
    const pIn1 = [c1 * rInner, s1 * rInner];
    const pOut0 = [c0 * rOuter, s0 * rOuter];
    const pOut1 = [c1 * rOuter, s1 * rOuter];

    const i0T = tr(pIn0[0], yTop, pIn0[1]), i1T = tr(pIn1[0], yTop, pIn1[1]);
    const o0T = tr(pOut0[0], yTop, pOut0[1]), o1T = tr(pOut1[0], yTop, pOut1[1]);
    const i0B = tr(pIn0[0], yBot, pIn0[1]), i1B = tr(pIn1[0], yBot, pIn1[1]);
    const o0B = tr(pOut0[0], yBot, pOut0[1]), o1B = tr(pOut1[0], yBot, pOut1[1]);

    // Check cross product for upward top normal
    const ux = o0T[0] - i0T[0], uz = o0T[2] - i0T[2];
    const vx = i1T[0] - i0T[0], vz = i1T[2] - i0T[2];
    const cy = uz * vx - ux * vz;
    if (cy > 0) {
      pushQuad(bucket.pos, bucket.uv, i0T, o0T, o1T, i1T, [0, 0], [uvScale, 0], [uvScale, uvScale], [0, uvScale]);
      pushQuad(bucket.pos, bucket.uv, i0B, i1B, o1B, o0B, [0, 0], [0, uvScale], [uvScale, uvScale], [uvScale, 0]);
      pushQuad(bucket.pos, bucket.uv, o0B, o1B, o1T, o0T, [0, 0], [1, 0], [1, 1], [0, 1]);
      pushQuad(bucket.pos, bucket.uv, i1B, i0B, i0T, i1T, [0, 0], [1, 0], [1, 1], [0, 1]);
    } else {
      pushQuad(bucket.pos, bucket.uv, i0T, i1T, o1T, o0T, [0, 0], [0, uvScale], [uvScale, uvScale], [uvScale, 0]);
      pushQuad(bucket.pos, bucket.uv, i0B, o0B, o1B, i1B, [0, 0], [uvScale, 0], [uvScale, uvScale], [0, uvScale]);
      pushQuad(bucket.pos, bucket.uv, o0B, o0T, o1T, o1B, [0, 0], [0, 1], [1, 1], [1, 0]);
      pushQuad(bucket.pos, bucket.uv, i1B, i1T, i0T, i0B, [0, 0], [0, 1], [1, 1], [1, 0]);
    }
  }
}

/** Add a solid rectangular-section curved arch rib spanning z in [-halfSpanZ, +halfSpanZ] up to yPeak. */
function appendArchedRib(bucket, xCenter, halfThickX, halfDepthR, yBase, yPeak, halfSpanZ, steps, tr) {
  const spine = [];
  for (let i = 0; i <= steps; i++) {
    const u = -1 + (2 * i) / steps;
    const z = u * halfSpanZ;
    const y = yBase + (yPeak - yBase) * Math.max(0, 1 - u * u);
    spine.push([z, y]);
  }
  const rings = [];
  for (let i = 0; i < spine.length; i++) {
    const prev = spine[Math.max(0, i - 1)];
    const next = spine[Math.min(spine.length - 1, i + 1)];
    const tz = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tz, ty) || 1;
    // Unit outward normal in (Z, Y) plane pointing up/outward from arch interior
    const nz = -ty / len;
    const ny = tz / len;
    const p = spine[i];
    rings.push({
      loL: tr(xCenter - halfThickX, p[1] - ny * halfDepthR, p[0] - nz * halfDepthR),
      loR: tr(xCenter + halfThickX, p[1] - ny * halfDepthR, p[0] - nz * halfDepthR),
      hiR: tr(xCenter + halfThickX, p[1] + ny * halfDepthR, p[0] + nz * halfDepthR),
      hiL: tr(xCenter - halfThickX, p[1] + ny * halfDepthR, p[0] + nz * halfDepthR),
    });
  }
  for (let i = 0; i < rings.length - 1; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    const u0 = i / steps;
    const u1 = (i + 1) / steps;
    pushQuad(bucket.pos, bucket.uv, a.hiL, a.hiR, b.hiR, b.hiL, [u0, 0], [u0, 1], [u1, 1], [u1, 0]);
    pushQuad(bucket.pos, bucket.uv, a.loR, a.loL, b.loL, b.loR, [u0, 0], [u0, 1], [u1, 1], [u1, 0]);
    pushQuad(bucket.pos, bucket.uv, a.loL, a.hiL, b.hiL, b.loL, [u0, 0], [u0, 1], [u1, 1], [u1, 0]);
    pushQuad(bucket.pos, bucket.uv, a.hiR, a.loR, b.loR, b.hiR, [u0, 0], [u0, 1], [u1, 1], [u1, 0]);
  }
}

/** Add an angled cylindrical or square strut connecting two local 3D endpoints. */
function appendLocalCylStrut(geomList, p0, p1, rTop, rBot, segs, trWorldObj) {
  const a = new THREE.Vector3(...trWorldObj(p0[0], p0[1], p0[2]));
  const b = new THREE.Vector3(...trWorldObj(p1[0], p1[1], p1[2]));
  const diff = b.clone().sub(a);
  const len = diff.length();
  if (len < 0.05) return;
  const mid = a.clone().addScaledVector(diff, 0.5);
  const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
  const m4 = new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1));
  const g = new THREE.CylinderGeometry(rTop, rBot, len, segs);
  g.applyMatrix4(m4);
  geomList.push(g);
}

/**
 * Build 6 architectural timber shade pavilion archetypes across West, Center & East sectors of the park.
 */
export function buildGardenPavilions(scene, data, obstacles = {}) {
  const rng = makeSeeded(20261129);

  const woodBucket = { pos: [], uv: [] };
  const timberBucket = { pos: [], uv: [] };
  const stoneBucket = { pos: [], uv: [] };
  const soilBucket = { pos: [], uv: [] };
  const darkMetalBucket = { pos: [], uv: [] };
  const glassBucket = { pos: [], uv: [] };
  const sailBucket = { pos: [], uv: [] };
  const soffitLedBucket = { pos: [], uv: [] };

  const darkMastGeoms = [];
  const oculusTrees = []; // { x, y, z, scale }
  const plantPlacements = [];
  const sitters = [];

  const pushPlant = (kind, lx, ly, lz, scale, tr) => {
    const [wx, wy, wz] = tr(lx, ly, lz);
    plantPlacements.push({ kind, x: wx, y: wy, z: wz, scale, rotY: rng() * Math.PI * 2 });
  };

  const pushSitter = (lx, ySeat, lz, localFacingYaw, tr, baseRotY) => {
    const [wx, wy, wz] = tr(lx, ySeat, lz);
    sitters.push({
      x: wx,
      y: wy,
      z: wz,
      rotY: baseRotY + localFacingYaw,
      colorIdx: sitters.length % 5,
    });
  };

  const addPlanterBox = (lx, yBot, yBedTop, lz, w, d, yaw, tr, plantList) => {
    addLocalBox(stoneBucket, lx, yBot, yBedTop, lz, w, d, yaw, tr, 1.0);
    // Slightly proud dark mulch soil above the concrete curb edge avoids any coplanar z-fighting
    addLocalBox(soilBucket, lx, yBedTop - 0.04, yBedTop + 0.025, lz, Math.max(0.24, w - 0.16), Math.max(0.24, d - 0.16), yaw, tr, 1.0);
    for (const [kind, ox, oz, sc] of plantList) {
      pushPlant(kind, lx + ox, yBedTop + 0.02, lz + oz, sc, tr);
    }
  };

  const makePavTransform = (cx, baseY, cz, rotY) => {
    const baseTr = makeTransform(cx, baseY, cz, rotY);
    return (lx, ly, lz) => baseTr(lx * 0.92, ly, lz * 0.92);
  };

  // --- 6 Signature Architectural Pavilion Builders ---

  // 1. Slatted Timber Pergola Lounge
  const addSlattedPergola = (cx, baseY, cz, rotY) => {
    const tr = makePavTransform(cx, baseY, cz, rotY);
    addLocalBox(stoneBucket, 0, 0.0, 0.14, 0, 4.6, 2.8, 0, tr, 1.0);
    addLocalBox(woodBucket, 0, 0.14, 0.22, 0, 4.32, 2.52, 0, tr, 1.5);

    // Corner recessed stone planters with proud dark mulch & lush ferns
    for (const sx of [-1.72, 1.72]) {
      addPlanterBox(sx, 0.14, 0.5, -0.74, 0.92, 0.92, 0, tr, [
        ["fern", -0.14, 0.05, 0.95],
        ["broad", 0.18, -0.12, 0.85],
        ["shrub", 0.0, 0.22, 0.78],
      ]);
    }

    // 4 heavy cedar posts & dual longitudinal header beams
    for (const px of [-2.04, 2.04]) {
      for (const pz of [-1.1, 1.1]) {
        addLocalBox(timberBucket, px, 0.22, 2.82, pz, 0.14, 0.14, 0, tr, 1.0);
      }
    }
    for (const bz of [-1.1, 1.1]) {
      addLocalBox(timberBucket, 0, 2.74, 2.9, bz, 4.56, 0.16, 0, tr, 1.0);
    }
    // 11 overhead louvers casting crisp rhythmic striped shadows
    for (let i = 0; i < 11; i++) {
      const rx = -2.0 + (i / 10) * 4.0;
      addLocalBox(timberBucket, rx, 2.86, 3.01, 0, 0.08, 2.72, 0, tr, 1.0);
    }
    // Rear vertical privacy timber screen slats
    for (let i = 0; i < 13; i++) {
      const sx = -1.2 + (i / 12) * 2.4;
      addLocalBox(timberBucket, sx, 0.56, 2.74, -1.12, 0.06, 0.09, 0, tr, 1.0);
    }
    // Warm recessed under-beam soffit LED bar
    addLocalBox(soffitLedBucket, 0, 2.71, 2.74, -1.0, 3.6, 0.08, 0, tr, 1.0);

    // Continuous slatted lounge bench
    addLocalBox(darkMetalBucket, 0, 0.22, 0.44, -0.78, 2.34, 0.44, 0, tr, 1.0);
    addLocalBox(woodBucket, 0, 0.44, 0.56, -0.78, 2.5, 0.62, 0, tr, 1.5);

    pushSitter(-0.62, 0.56, -0.76, 0, tr, rotY);
    pushSitter(0.65, 0.56, -0.76, 0, tr, rotY);
  };

  // 2. Circular Oculus Tree-Pergola
  const addOculusTreePergola = (cx, baseY, cz, rotY) => {
    const tr = makePavTransform(cx, baseY, cz, rotY);
    const terracePts = regularPoly2D(0, 0, 2.45, 20);
    const woodDeckPts = regularPoly2D(0, 0, 2.26, 20);
    appendConvexPrism(stoneBucket, terracePts, 0.0, 0.14, tr, 1.0);
    appendConvexPrism(woodBucket, woodDeckPts, 0.14, 0.2, tr, 1.45, rotY);

    // Central round stone planter + wrapped circular wood seat
    const benchPts = regularPoly2D(0, 0, 0.86, 16);
    const rimPts = regularPoly2D(0, 0, 0.66, 16);
    const soilPts = regularPoly2D(0, 0, 0.56, 16);
    appendConvexPrism(darkMetalBucket, benchPts, 0.2, 0.42, tr, 1.0);
    appendConvexPrism(woodBucket, regularPoly2D(0, 0, 0.92, 16), 0.42, 0.52, tr, 1.45);
    appendConvexPrism(stoneBucket, rimPts, 0.5, 0.66, tr, 1.0);
    appendConvexPrism(soilBucket, soilPts, 0.62, 0.685, tr, 1.0);

    // Central ornamental tree trunk + lush greenery rising out through the oculus
    oculusTrees.push({ x: cx, y: baseY + 0.66, z: cz, scale: 1.0 });
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + 0.35;
      pushPlant("fern", Math.cos(a) * 0.34, 0.67, Math.sin(a) * 0.34, 0.65, tr);
    }

    // 6 cedar posts & radial oculus ring pergola roof
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
      addLocalBox(timberBucket, Math.cos(a) * 1.98, 0.2, 2.72, Math.sin(a) * 1.98, 0.14, 0.14, -a, tr, 1.0);
    }
    appendAnnulusPrism(timberBucket, 2.22, 2.4, 2.68, 2.86, 20, tr, 1.0);
    appendAnnulusPrism(timberBucket, 0.88, 1.02, 2.68, 2.86, 16, tr, 1.0);
    for (let i = 0; i < 16; i++) {
      const a = (i / 16) * Math.PI * 2;
      addLocalBox(timberBucket, Math.cos(a) * 1.62, 2.74, 2.85, Math.sin(a) * 1.62, 1.24, 0.08, -a, tr, 1.0);
    }
    appendAnnulusPrism(glassBucket, 1.0, 2.24, 2.855, 2.89, 20, tr, 1.0);
    appendAnnulusPrism(soffitLedBucket, 0.9, 0.96, 2.66, 2.685, 16, tr, 1.0);

    // Curved rear perimeter lounge bench + outer planters
    const cArcPts = [];
    for (let i = 0; i <= 14; i++) {
      const a = Math.PI * 0.62 + (i / 14) * Math.PI * 0.76;
      cArcPts.push([Math.cos(a) * 1.72, Math.sin(a) * 1.72]);
    }
    appendRibbonStrip(darkMetalBucket, cArcPts, 0.42, 0.2, 0.42, false, tr, 1.0);
    appendRibbonStrip(woodBucket, cArcPts, 0.56, 0.42, 0.54, false, tr, 3.2);

    pushSitter(-1.68, 0.54, 0.25, Math.PI * 0.55, tr, rotY);
    pushSitter(0.75, 0.52, 0.45, Math.PI * 0.32, tr, rotY);
  };

  // 3. Tensile Shade Sail Stepped Deck
  const addTensileSailDeck = (cx, baseY, cz, rotY) => {
    const tr = makePavTransform(cx, baseY, cz, rotY);
    addLocalBox(stoneBucket, 0, 0.0, 0.12, 0, 4.2, 4.2, 0, tr, 1.0);
    addLocalBox(woodBucket, 0, 0.12, 0.24, 0, 3.84, 3.84, 0, tr, 1.5);

    // Stepped lounge seating blocks (L-tier) & low central coffee table
    addLocalBox(woodBucket, -0.88, 0.24, 0.52, -0.78, 1.85, 1.7, 0, tr, 1.5);
    addLocalBox(woodBucket, 0.78, 0.24, 0.52, -1.06, 1.5, 1.12, 0, tr, 1.5);
    addLocalBox(woodBucket, -1.06, 0.24, 0.52, 0.72, 1.12, 1.35, 0, tr, 1.5);
    addLocalBox(darkMetalBucket, 0.22, 0.24, 0.36, 0.35, 0.65, 0.65, 0, tr, 1.0);
    addLocalBox(woodBucket, 0.22, 0.36, 0.46, 0.35, 0.88, 0.88, 0, tr, 1.6);

    // 2 lush corner side planters
    addPlanterBox(1.42, 0.12, 0.5, 1.32, 0.92, 0.92, 0, tr, [
      ["fern", -0.1, 0.08, 0.95],
      ["broad", 0.18, -0.15, 0.86],
    ]);
    addPlanterBox(-1.42, 0.12, 0.48, -1.42, 0.88, 0.88, 0, tr, [
      ["shrub", 0.05, 0.04, 0.9],
      ["fern", -0.15, -0.1, 0.84],
    ]);

    // 4 outward-tilted charcoal masts anchoring the asymmetric hyperbolic shade sail
    const masts = [
      [[-1.8, 0.22, -1.8], [-1.98, 3.15, -1.98]],
      [[1.8, 0.22, -1.8], [1.98, 2.38, -1.98]],
      [[1.8, 0.22, 1.8], [1.98, 3.22, 1.98]],
      [[-1.8, 0.22, 1.8], [-1.98, 2.42, 1.98]],
    ];
    for (const [p0, p1] of masts) {
      appendLocalCylStrut(darkMastGeoms, p0, p1, 0.05, 0.075, 8, tr);
    }

    // 8x8 double-curved hyperbolic-paraboloid tensioned fabric sail
    const sailN = 8;
    const grid = [];
    for (let i = 0; i <= sailN; i++) {
      const row = [];
      const u = i / sailN;
      const lx = -1.96 + u * 3.92;
      for (let j = 0; j <= sailN; j++) {
        const v = j / sailN;
        const lz = -1.96 + v * 3.92;
        const yLin =
          (1 - u) * (1 - v) * 3.12 +
          u * (1 - v) * 2.35 +
          (1 - u) * v * 2.39 +
          u * v * 3.18;
        const sag = 0.14 * Math.sin(u * Math.PI) * Math.sin(v * Math.PI);
        row.push([lx, yLin - sag, lz]);
      }
      grid.push(row);
    }
    appendGridSurface(sailBucket, grid, tr, 1, 1);

    // Subtle recessed deck riser accent light
    addLocalBox(soffitLedBucket, 0.22, 0.23, 0.26, 0.35, 0.72, 0.72, 0, tr, 1.0);

    pushSitter(-0.55, 0.52, -0.92, 0, tr, rotY);
    pushSitter(-1.02, 0.52, 0.72, Math.PI * 0.5, tr, rotY);
  };

  // 4. Stepped Amphitheater Canopy Pavilion
  const addAmphitheaterCanopy = (cx, baseY, cz, rotY) => {
    const tr = makePavTransform(cx, baseY, cz, rotY);
    addLocalBox(stoneBucket, 0, 0.0, 0.12, 0, 4.5, 3.4, 0, tr, 1.0);

    // 3 ascending timber bleacher tiers + cascading stepped stone planters on both flanks
    const tiers = [
      { z: 0.78, d: 0.74, yTop: 0.48 },
      { z: 0.0, d: 0.74, yTop: 0.84 },
      { z: -0.78, d: 0.78, yTop: 1.2 },
    ];
    for (const tier of tiers) {
      addLocalBox(woodBucket, 0, 0.12, tier.yTop, tier.z, 2.66, tier.d, 0, tr, 1.45);
      for (const sx of [-1.74, 1.74]) {
        addPlanterBox(sx, 0.12, tier.yTop + 0.02, tier.z, 0.76, tier.d, 0, tr, [
          [sx < 0 ? "fern" : "broad", 0, 0, 0.82],
        ]);
      }
    }

    // Rear colonnade + cantilevered upward-pitched timber & glass skylight canopy
    for (const px of [-1.62, 0.0, 1.62]) {
      addLocalBox(timberBucket, px, 0.12, 2.74, -1.36, 0.15, 0.15, 0, tr, 1.0);
      appendLocalCylStrut(darkMastGeoms, [px, 1.85, -1.36], [px, 2.94, -0.45], 0.04, 0.045, 6, tr);
    }
    addLocalBox(timberBucket, 0, 2.66, 2.82, -1.36, 3.8, 0.18, 0, tr, 1.0);

    // Pitched skylight beams + translucent roof glazing
    for (let i = 0; i < 7; i++) {
      const rx = -1.8 + (i / 6) * 3.6;
      appendLocalCylStrut(darkMastGeoms, [rx, 2.75, -1.48], [rx, 3.22, 0.56], 0.045, 0.045, 4, tr);
    }
    const roofGrid = [
      [[-1.92, 2.78, -1.52], [-1.92, 3.24, 0.58]],
      [[1.92, 2.78, -1.52], [1.92, 3.24, 0.58]],
    ];
    appendGridSurface(glassBucket, roofGrid, tr, 1, 1);
    addLocalBox(timberBucket, 0, 3.16, 3.28, 0.56, 3.86, 0.12, 0, tr, 1.0);
    addLocalBox(soffitLedBucket, 0, 2.63, 2.66, -1.24, 3.4, 0.08, 0, tr, 1.0);

    pushSitter(-0.68, 0.48, 0.78, 0, tr, rotY);
    pushSitter(0.25, 0.84, 0.0, 0, tr, rotY);
    pushSitter(0.85, 1.2, -0.78, 0, tr, rotY);
  };

  // 5. Sculptural Wave-Arch Laminated Timber Pavilion
  const addWaveArchPavilion = (cx, baseY, cz, rotY) => {
    const tr = makePavTransform(cx, baseY, cz, rotY);
    addLocalBox(stoneBucket, 0, 0.0, 0.12, 0, 4.6, 3.2, 0, tr, 1.0);
    addLocalBox(woodBucket, 0, 0.12, 0.2, 0, 4.1, 2.8, 0, tr, 1.45);

    // Two facing lounge benches + corner planted beds
    for (const sz of [-1.05, 1.05]) {
      addLocalBox(darkMetalBucket, 0, 0.2, 0.42, sz, 2.3, 0.38, 0, tr, 1.0);
      addLocalBox(woodBucket, 0, 0.42, 0.54, sz, 2.48, 0.54, 0, tr, 1.5);
    }
    for (const px of [-1.72, 1.72]) {
      for (const pz of [-0.98, 0.98]) {
        addPlanterBox(px, 0.12, 0.48, pz, 0.74, 0.74, 0, tr, [["fern", 0, 0, 0.86]]);
      }
    }

    // 13 sinusoidal arched timber portal ribs forming a double-curved undulating canopy
    const ribCount = 13;
    const archSteps = 14;
    const canopyGrid = [];
    for (let i = 0; i < ribCount; i++) {
      const u = i / (ribCount - 1);
      const rx = -2.02 + u * 4.04;
      const yPeak = 2.86 + 0.36 * Math.sin(u * Math.PI * 1.45 - 0.3);
      appendArchedRib(timberBucket, rx, 0.055, 0.1, 0.2, yPeak, 1.38, archSteps, tr);

      const row = [];
      for (let j = 2; j <= archSteps - 2; j++) {
        const t = -1 + (2 * j) / archSteps;
        const gz = t * 1.38;
        const gy = 0.2 + (yPeak - 0.2) * Math.max(0, 1 - t * t) + 0.095;
        row.push([rx, gy, gz]);
      }
      canopyGrid.push(row);
    }
    appendGridSurface(woodBucket, canopyGrid, tr, 2.5, 4.0);
    addLocalBox(soffitLedBucket, 0, 2.66, 2.7, 0, 3.6, 0.1, 0, tr, 1.0);

    pushSitter(-0.52, 0.54, -1.04, 0, tr, rotY);
    pushSitter(0.6, 0.54, 1.04, Math.PI, tr, rotY);
  };

  // 6. Circular Radial-Ribbed Mushroom Umbrella Pavilion
  const addUmbrellaKiosk = (cx, baseY, cz, rotY) => {
    const tr = makePavTransform(cx, baseY, cz, rotY);
    const terracePts = regularPoly2D(0, 0, 2.38, 20);
    const stonePlinth = regularPoly2D(0, 0, 0.36, 12);
    appendConvexPrism(stoneBucket, terracePts, 0.0, 0.14, tr, 1.0);
    appendConvexPrism(stoneBucket, stonePlinth, 0.14, 0.65, tr, 1.0);

    // Central core column + warm glowing lantern band below canopy
    const colPts = regularPoly2D(0, 0, 0.26, 12);
    const lanternPts = regularPoly2D(0, 0, 0.28, 12);
    appendConvexPrism(timberBucket, colPts, 0.65, 1.65, tr, 1.0);
    appendConvexPrism(soffitLedBucket, lanternPts, 1.65, 2.28, tr, 1.0);
    appendConvexPrism(timberBucket, colPts, 2.28, 3.24, tr, 1.0);

    // 360-degree circular slatted wood seat around the core
    appendConvexPrism(darkMetalBucket, regularPoly2D(0, 0, 0.88, 18), 0.14, 0.4, tr, 1.0);
    appendConvexPrism(woodBucket, regularPoly2D(0, 0, 0.94, 18), 0.4, 0.52, tr, 1.45);

    // 4 outer quarter-arc planter pockets
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2 + Math.PI * 0.25;
      addPlanterBox(Math.cos(a) * 1.76, 0.14, 0.48, Math.sin(a) * 1.76, 0.78, 0.78, -a, tr, [
        [i % 2 === 0 ? "fern" : "broad", 0, 0, 0.88],
        ["shrub", 0.14, 0.12, 0.7],
      ]);
    }

    // 16-ribbed conical timber umbrella roof + upper glazed skylight cone
    const segs = 16;
    const outerR = 2.26;
    const midR = 0.86;
    const peakR = 0.24;
    const yEave = 2.48;
    const yMid = 3.04;
    const yPeak = 3.28;

    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      const c0 = Math.cos(a0), s0 = Math.sin(a0);
      const c1 = Math.cos(a1), s1 = Math.sin(a1);

      // Slatted timber lower umbrella apron
      pushQuad(
        woodBucket.pos,
        woodBucket.uv,
        tr(c0 * outerR, yEave, s0 * outerR),
        tr(c0 * midR, yMid, s0 * midR),
        tr(c1 * midR, yMid, s1 * midR),
        tr(c1 * outerR, yEave, s1 * outerR),
        [0, 0],
        [0, 2],
        [2, 2],
        [2, 0]
      );
      // Translucent glass upper skylight cone panels
      pushQuad(
        glassBucket.pos,
        glassBucket.uv,
        tr(c0 * midR, yMid, s0 * midR),
        tr(c0 * peakR, yPeak, s0 * peakR),
        tr(c1 * peakR, yPeak, s1 * peakR),
        tr(c1 * midR, yMid, s1 * midR),
        [0, 0],
        [0, 1],
        [1, 1],
        [1, 0]
      );
      // Radial cedar umbrella ribs protruding past eave
      appendLocalCylStrut(
        darkMastGeoms,
        [c0 * peakR, yPeak - 0.02, s0 * peakR],
        [c0 * (outerR + 0.12), yEave - 0.04, s0 * (outerR + 0.12)],
        0.042,
        0.048,
        6,
        tr
      );
    }

    pushSitter(0.74, 0.52, 0.0, Math.PI * 0.5, tr, rotY);
    pushSitter(-0.52, 0.52, 0.52, -Math.PI * 0.25, tr, rotY);
    if (rng() > 0.35) pushSitter(-0.52, 0.52, -0.52, -Math.PI * 0.75, tr, rotY);
  };

  const PAVILIONS = {
    slattedPergola: { r: 2.35, fn: addSlattedPergola },
    oculusTreePergola: { r: 2.35, fn: addOculusTreePergola },
    tensileSailDeck: { r: 2.35, fn: addTensileSailDeck },
    amphitheaterCanopy: { r: 2.35, fn: addAmphitheaterCanopy },
    waveArchPavilion: { r: 2.35, fn: addWaveArchPavilion },
    umbrellaKiosk: { r: 2.25, fn: addUmbrellaKiosk },
  };
  const ARCHETYPE_ORDER = [
    "slattedPergola",
    "oculusTreePergola",
    "tensileSailDeck",
    "amphitheaterCanopy",
    "waveArchPavilion",
    "umbrellaKiosk",
  ];

  // --- Distribution Across West, Center & East ---
  const placed = []; // { kind, x, z, r, baseY, rotY }
  const isClear = createClearanceChecker(data, obstacles, placed);

  const sectorOf = (z) => (z.centroid[0] < -55 ? 0 : z.centroid[0] <= 55 ? 1 : 2);
  const candidateZones = data.zones
    .filter((z) => {
      if (z.holes && z.holes.length && !z.name.toUpperCase().includes("KIOSQUE")) return false;
      const u = z.name.toUpperCase();
      if (z.kind === "paving") {
        return z.area >= 48 && (u.includes("REPOS") || u.includes("KIOSQUE"));
      }
      if (z.kind === "green") {
        return z.area >= 95 && z.area < 800 && (u.includes("PELOUSE") || u.includes("JARDIN PLANT"));
      }
      return false;
    })
    .sort((a, b) => {
      // Give West & Center priority, and within each sector favor large paving plazas before lawns
      const sa = sectorOf(a);
      const sb = sectorOf(b);
      if (sa !== sb && (sa < 2 || sb < 2)) return sa - sb;
      const aPri = a.kind === "paving" && a.area >= 200 ? 1 : 0;
      const bPri = b.kind === "paving" && b.area >= 200 ? 1 : 0;
      if (aPri !== bPri) return bPri - aPri;
      return b.area - a.area;
    });

  let kindIdx = 0;
  const maxPavilions = 18;
  for (const z of candidateZones) {
    if (placed.length >= maxPavilions) break;
    const isPaving = z.kind === "paving";
    const baseY = isPaving ? 0.35 : 0.455;
    const targetHere = z.area >= 320 ? 2 : 1;
    const alignYaw = dominantEdgeYaw(z.poly);
    const cands = sampleCandidatesInZone(z, 10, 8, rng);
    let added = 0;

    for (const [cx, cz] of cands) {
      if (added >= targetHere || placed.length >= maxPavilions) break;
      const chosen = ARCHETYPE_ORDER[kindIdx % ARCHETYPE_ORDER.length];
      const spec = PAVILIONS[chosen];
      if (
        isClear(cx, cz, spec.r, z, {
          requireNoGreen: isPaving,
          roofPad: 0.5,
          archPad: 1.5,
          walkPad: 0.85,
          treePad: 1.05,
          bushPad: 0.45,
          benchPad: 0.95,
          planterPad: 1.2,
          selfGap: 4.8,
        })
      ) {
        const rotY = alignYaw + (rng() - 0.5) * 0.25;
        spec.fn(cx, baseY, cz, rotY);
        placed.push({ kind: chosen, x: cx, z: cz, r: spec.r, baseY, rotY });
        added++;
        kindIdx++;
      }
    }
  }

  // --- Merge & Attach Scene Meshes ---
  const woodTex = makeWoodSlatsTexture();
  if (woodBucket.pos.length) {
    const geo = makeTransformedPosUvBuf(woodBucket.pos, woodBucket.uv);
    const mat = new THREE.MeshStandardMaterial({ map: woodTex, color: 0xffffff, roughness: 0.72, metalness: 0.04 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  if (timberBucket.pos.length) {
    const geo = makeTransformedPosUvBuf(timberBucket.pos, timberBucket.uv);
    const mat = new THREE.MeshStandardMaterial({ color: 0x9c6e3f, roughness: 0.68, metalness: 0.04 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  if (stoneBucket.pos.length) {
    const geo = makeTransformedPosUvBuf(stoneBucket.pos, stoneBucket.uv);
    const mat = new THREE.MeshStandardMaterial({ color: 0xdfd7c9, roughness: 0.86, metalness: 0.02 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  if (soilBucket.pos.length) {
    const geo = makeTransformedPosUvBuf(soilBucket.pos, soilBucket.uv);
    const mat = new THREE.MeshStandardMaterial({ color: 0x46392c, roughness: 0.95, metalness: 0 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  if (darkMetalBucket.pos.length) {
    const geo = makeTransformedPosUvBuf(darkMetalBucket.pos, darkMetalBucket.uv);
    const mat = new THREE.MeshStandardMaterial({ color: 0x32363c, roughness: 0.55, metalness: 0.35 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }
  if (darkMastGeoms.length) {
    const mergedMasts = mergeNormalizedGeoms(darkMastGeoms);
    if (mergedMasts) {
      const mat = new THREE.MeshStandardMaterial({ color: 0x423a33, roughness: 0.62, metalness: 0.25 });
      const mesh = new THREE.Mesh(mergedMasts, mat);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      scene.add(mesh);
    }
  }
  if (glassBucket.pos.length) {
    const geo = makeTransformedPosUvBuf(glassBucket.pos, glassBucket.uv);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xdff3f8,
      transparent: true,
      opacity: 0.36,
      roughness: 0.16,
      metalness: 0.12,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);
  }
  if (sailBucket.pos.length) {
    const geo = makeTransformedPosUvBuf(sailBucket.pos, sailBucket.uv);
    const mat = new THREE.MeshStandardMaterial({
      color: 0xf6f0e4,
      roughness: 0.84,
      side: THREE.DoubleSide,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  const dayLedCol = new THREE.Color(0xeae3d6);
  const nightLedCol = new THREE.Color(0xfff0c8);
  let soffitLedMat = null;
  if (soffitLedBucket.pos.length) {
    const geo = makeTransformedPosUvBuf(soffitLedBucket.pos, soffitLedBucket.uv);
    soffitLedMat = new THREE.MeshBasicMaterial({ color: dayLedCol.clone() });
    scene.add(new THREE.Mesh(geo, soffitLedMat));
  }

  // Ornamental central mini-trees rising through Oculus Tree-Pergolas
  if (oculusTrees.length) {
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0x7b634b, roughness: 0.88 });
    const leafMat = new THREE.MeshStandardMaterial({ color: 0x628546, roughness: 0.84 });
    const trunkGeo = new THREE.CylinderGeometry(0.11, 0.17, 2.2, 8);
    trunkGeo.translate(0, 1.1, 0);
    const leafParts = [
      [0.0, 2.45, 0.0, 0.62, 0.5, 0.62],
      [-0.36, 2.25, 0.25, 0.44, 0.38, 0.44],
      [0.36, 2.3, -0.22, 0.46, 0.4, 0.46],
      [0.05, 2.8, 0.05, 0.45, 0.4, 0.45],
    ].map(([px, py, pz, sx, sy, sz]) => {
      const g = new THREE.IcosahedronGeometry(1, 1);
      g.scale(sx, sy, sz);
      g.translate(px, py, pz);
      return g;
    });
    const mergedCrown = mergeNormalizedGeoms(leafParts);
    const tInst = new THREE.InstancedMesh(trunkGeo, trunkMat, oculusTrees.length);
    const cInst = new THREE.InstancedMesh(mergedCrown, leafMat, oculusTrees.length);
    cInst.castShadow = true;
    cInst.receiveShadow = true;
    const td = new THREE.Object3D();
    oculusTrees.forEach((ot, idx) => {
      td.position.set(ot.x, ot.y, ot.z);
      td.rotation.set(0, idx * 1.1, 0);
      td.scale.set(ot.scale, ot.scale, ot.scale);
      td.updateMatrix();
      tInst.setMatrixAt(idx, td.matrix);
      cInst.setMatrixAt(idx, td.matrix);
    });
    scene.add(tInst, cInst);
  }

  createBotanicalInstancedMeshes(scene, plantPlacements);
  createSitterInstancedMeshes(scene, sitters);

  return {
    count: placed.length,
    placed,
    footprints: placed.map((p) => [p.x, p.z, p.r, p.baseY]),
    applyNightFactor(f) {
      if (soffitLedMat) {
        soffitLedMat.color.lerpColors(dayLedCol, nightLedCol, THREE.MathUtils.smoothstep(f, 0.1, 0.9));
      }
    },
  };
}
