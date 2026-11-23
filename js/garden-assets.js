import * as THREE from "three";

function makeSeeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function pointInPoly2D(pt, poly) {
  const [x, z] = pt;
  let inside = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, zi] = poly[i];
    const [xj, zj] = poly[j];
    const intersect =
      zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi + 1e-10) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function inZone2D(pt, z) {
  if (!pointInPoly2D(pt, z.poly)) return false;
  if (z.holes && z.holes.some((h) => pointInPoly2D(pt, h))) return false;
  return true;
}

function distToSegment2D(px, pz, ax, az, bx, bz) {
  const dx = bx - ax;
  const dz = bz - az;
  const l2 = dx * dx + dz * dz;
  if (l2 < 1e-8) return Math.hypot(px - ax, pz - az);
  const t = Math.max(0, Math.min(1, ((px - ax) * dx + (pz - az) * dz) / l2));
  return Math.hypot(px - (ax + t * dx), pz - (az + t * dz));
}

function pointNearPolyEdge2D(pt, poly, margin) {
  if (margin <= 0) return false;
  const [px, pz] = pt;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    if (distToSegment2D(px, pz, a[0], a[1], b[0], b[1]) < margin) return true;
  }
  return false;
}

function isNearZone2D(pt, z, margin) {
  if (inZone2D(pt, z)) return true;
  if (margin <= 0) return false;
  if (pointNearPolyEdge2D(pt, z.poly, margin)) return true;
  if (z.holes && z.holes.some((h) => pointNearPolyEdge2D(pt, h, margin))) return true;
  return false;
}

/** Procedural warm honey-teak slatted wood texture with dark plank shadow grooves. */
function makeWoodSlatsTexture() {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext("2d");

  const slats = ["#b68957", "#c39662", "#ab7e4d", "#bd915f", "#b28452", "#c69b67"];
  const slatH = 16;
  for (let i = 0; i < 16; i++) {
    const y = i * slatH;
    ctx.fillStyle = slats[i % slats.length];
    ctx.fillRect(0, y, 256, slatH);
    // Crisp dark shadow groove between timber slats
    ctx.fillStyle = "#563e26";
    ctx.fillRect(0, y, 256, 2.5);
    // Subtle wood grain highlights
    ctx.fillStyle = "rgba(255, 240, 214, 0.09)";
    ctx.fillRect((i * 47) % 180, y + 6, 72, 2);
    ctx.fillStyle = "rgba(70, 44, 22, 0.08)";
    ctx.fillRect((i * 89 + 20) % 170, y + 11, 64, 1.5);
  }
  // Fine perpendicular deck butt-joint seams
  ctx.fillStyle = "rgba(72, 50, 28, 0.38)";
  ctx.fillRect(0, 0, 1.5, 256);
  ctx.fillRect(128, 0, 1.5, 256);

  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

/** Ensure every geometry is non-indexed and owns position, normal, and uv before merge. */
function mergeNormalizedGeoms(geoms) {
  const list = [];
  for (const g of geoms) {
    if (!g) continue;
    const ng = g.index ? g.toNonIndexed() : g;
    if (!ng.attributes.normal) ng.computeVertexNormals();
    if (!ng.attributes.uv) {
      const cnt = ng.attributes.position.count;
      ng.setAttribute("uv", new THREE.BufferAttribute(new Float32Array(cnt * 2), 2));
    }
    list.push(ng);
  }
  if (!list.length) return null;
  let total = 0;
  for (const g of list) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const norm = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let off = 0;
  for (const g of list) {
    const cnt = g.attributes.position.count;
    pos.set(g.attributes.position.array, off * 3);
    norm.set(g.attributes.normal.array, off * 3);
    uv.set(g.attributes.uv.array, off * 2);
    off += cnt;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  out.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
  out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
  return out;
}

function makeTransformedPosUvBuf(posArr, uvArr) {
  const geo = new THREE.BufferGeometry();
  geo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
  geo.setAttribute("uv", new THREE.Float32BufferAttribute(uvArr, 2));
  geo.computeVertexNormals();
  return geo;
}

function makeTransform(cx, baseY, cz, rotY) {
  const c = Math.cos(rotY);
  const s = Math.sin(rotY);
  return (lx, ly, lz) => [cx + lx * c + lz * s, baseY + ly, cz - lx * s + lz * c];
}

function pushTri(posArr, uvArr, a, b, c, uva, uvb, uvc) {
  posArr.push(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
  uvArr.push(uva[0], uva[1], uvb[0], uvb[1], uvc[0], uvc[1]);
}

function pushQuad(posArr, uvArr, a, b, c, d, uva, uvb, uvc, uvd) {
  pushTri(posArr, uvArr, a, b, c, uva, uvb, uvc);
  pushTri(posArr, uvArr, a, c, d, uva, uvc, uvd);
}

/**
 * Extrude a star-convex 2D polygon (relative to center [pcx, pcz]) in local [lx, lz] into world buckets.
 * Handles winding automatically so top cap faces +Y and sides face outward.
 */
function appendConvexPrism(bucket, pts2d, yBot, yTop, tr, uvScale = 1.4, uvAngle = 0, center = null) {
  if (pts2d.length < 3) return;
  let area2 = 0;
  for (let i = 0; i < pts2d.length; i++) {
    const a = pts2d[i];
    const b = pts2d[(i + 1) % pts2d.length];
    area2 += a[0] * b[1] - b[0] * a[1];
  }
  // Reverse if area2 > 0 so pts are clockwise in (x, z), guaranteeing (+Y) upward top cap normals
  const poly = area2 > 0 ? [...pts2d].reverse() : pts2d;

  let pcx = 0;
  let pcz = 0;
  if (center) {
    pcx = center[0];
    pcz = center[1];
  } else {
    for (const [x, z] of poly) {
      pcx += x;
      pcz += z;
    }
    pcx /= poly.length;
    pcz /= poly.length;
  }

  const uc = Math.cos(uvAngle) * uvScale;
  const us = Math.sin(uvAngle) * uvScale;
  const uvOf = (x, z) => [x * uc - z * us, x * us + z * uc];

  const cTop = tr(pcx, yTop, pcz);
  const cBot = tr(pcx, yBot, pcz);
  const uvC = uvOf(pcx, pcz);

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const aT = tr(a[0], yTop, a[1]);
    const bT = tr(b[0], yTop, b[1]);
    const aB = tr(a[0], yBot, a[1]);
    const bB = tr(b[0], yBot, b[1]);
    const uvA = uvOf(a[0], a[1]);
    const uvB = uvOf(b[0], b[1]);

    pushTri(bucket.pos, bucket.uv, cTop, aT, bT, uvC, uvA, uvB);
    pushTri(bucket.pos, bucket.uv, cBot, bB, aB, uvC, uvB, uvA);
    pushQuad(
      bucket.pos,
      bucket.uv,
      aB,
      bB,
      bT,
      aT,
      [0, 0],
      [1, 0],
      [1, (yTop - yBot) * 2.5],
      [0, (yTop - yBot) * 2.5]
    );
  }
}

/**
 * Extrude an open or closed 2D centerline curve as a thick slatted ribbon with UVs following the curve.
 */
function appendRibbonStrip(bucket, pts2d, width, yBot, yTop, closed, tr, slatRows = 3.5) {
  const n = pts2d.length;
  if (n < 2) return;
  const segCount = closed ? n : n - 1;
  const hw = width * 0.5;
  const cumLen = [0];
  for (let i = 0; i < segCount; i++) {
    const a = pts2d[i];
    const b = pts2d[(i + 1) % n];
    cumLen.push(cumLen[i] + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }

  // Compute unit normals at every vertex
  const left = [];
  const right = [];
  for (let i = 0; i < n; i++) {
    const prev = pts2d[(i - 1 + n) % n];
    const curr = pts2d[i];
    const next = pts2d[(i + 1) % n];
    let tx = 0;
    let tz = 0;
    if (closed || (i > 0 && i < n - 1)) {
      const dx1 = curr[0] - prev[0];
      const dz1 = curr[1] - prev[1];
      const l1 = Math.hypot(dx1, dz1) || 1;
      const dx2 = next[0] - curr[0];
      const dz2 = next[1] - curr[1];
      const l2 = Math.hypot(dx2, dz2) || 1;
      tx = dx1 / l1 + dx2 / l2;
      tz = dz1 / l1 + dz2 / l2;
    } else if (i === 0) {
      tx = next[0] - curr[0];
      tz = next[1] - curr[1];
    } else {
      tx = curr[0] - prev[0];
      tz = curr[1] - prev[1];
    }
    const tl = Math.hypot(tx, tz) || 1;
    tx /= tl;
    tz /= tl;
    const nx = -tz;
    const nz = tx;
    // Miter scale clamped neatly
    let miter = 1.0;
    if (closed || (i > 0 && i < n - 1)) {
      const dx2 = next[0] - curr[0];
      const dz2 = next[1] - curr[1];
      const l2 = Math.hypot(dx2, dz2) || 1;
      const snx = -dz2 / l2;
      const snz = dx2 / l2;
      miter = Math.min(1.5, 1 / Math.max(0.55, nx * snx + nz * snz));
    }
    left.push([curr[0] + nx * hw * miter, curr[1] + nz * hw * miter]);
    right.push([curr[0] - nx * hw * miter, curr[1] - nz * hw * miter]);
  }

  const uScale = 0.42;
  for (let i = 0; i < segCount; i++) {
    const i0 = i;
    const i1 = (i + 1) % n;
    const u0 = cumLen[i] * uScale;
    const u1 = cumLen[i + 1] * uScale;

    const l0T = tr(left[i0][0], yTop, left[i0][1]);
    const r0T = tr(right[i0][0], yTop, right[i0][1]);
    const r1T = tr(right[i1][0], yTop, right[i1][1]);
    const l1T = tr(left[i1][0], yTop, left[i1][1]);

    const l0B = tr(left[i0][0], yBot, left[i0][1]);
    const r0B = tr(right[i0][0], yBot, right[i0][1]);
    const r1B = tr(right[i1][0], yBot, right[i1][1]);
    const l1B = tr(left[i1][0], yBot, left[i1][1]);

    // Determine triangle winding dynamically using top quad cross product so +Y faces upward
    const ex = r0T[0] - l0T[0];
    const ez = r0T[2] - l0T[2];
    const fx = l1T[0] - l0T[0];
    const fz = l1T[2] - l0T[2];
    const crossY = ez * fx - ex * fz; // (r0-l0) x (l1-l0) Y-component

    if (crossY > 0) {
      pushQuad(bucket.pos, bucket.uv, l0T, r0T, r1T, l1T, [u0, slatRows], [u0, 0], [u1, 0], [u1, slatRows]);
      pushQuad(bucket.pos, bucket.uv, l0B, l1B, r1B, r0B, [u0, slatRows], [u1, slatRows], [u1, 0], [u0, 0]);
      pushQuad(bucket.pos, bucket.uv, l0B, l0T, l1T, l1B, [u0, 0], [u0, 0.8], [u1, 0.8], [u1, 0]);
      pushQuad(bucket.pos, bucket.uv, r0T, r0B, r1B, r1T, [u0, 0.8], [u0, 0], [u1, 0], [u1, 0.8]);
    } else {
      pushQuad(bucket.pos, bucket.uv, l0T, l1T, r1T, r0T, [u0, slatRows], [u1, slatRows], [u1, 0], [u0, 0]);
      pushQuad(bucket.pos, bucket.uv, l0B, r0B, r1B, l1B, [u0, slatRows], [u0, 0], [u1, 0], [u1, slatRows]);
      pushQuad(bucket.pos, bucket.uv, l0B, l1B, l1T, l0T, [u0, 0], [u1, 0], [u1, 0.8], [u0, 0.8]);
      pushQuad(bucket.pos, bucket.uv, r0B, r0T, r1T, r1B, [u0, 0], [u0, 0.8], [u1, 0.8], [u1, 0]);
    }

    if (!closed && i === 0) {
      pushQuad(bucket.pos, bucket.uv, l0B, r0B, r0T, l0T, [0, 0], [1, 0], [1, 0.8], [0, 0.8]);
    }
    if (!closed && i === segCount - 1) {
      pushQuad(bucket.pos, bucket.uv, r1B, l1B, l1T, r1T, [0, 0], [1, 0], [1, 0.8], [0, 0.8]);
    }
  }
}

function addLocalBox(bucket, lx, yBot, yTop, lz, sx, sz, yaw, tr, uvScale = 1.4) {
  const c = Math.cos(yaw);
  const s = Math.sin(yaw);
  const hx = sx * 0.5;
  const hz = sz * 0.5;
  const corners = [
    [-hx, -hz],
    [hx, -hz],
    [hx, hz],
    [-hx, hz],
  ].map(([px, pz]) => [lx + px * c + pz * s, lz - px * s + pz * c]);
  appendConvexPrism(bucket, corners, yBot, yTop, tr, uvScale, yaw, [lx, lz]);
}

function regularPoly2D(cx, cz, r, sides, rot = 0) {
  const pts = [];
  for (let i = 0; i < sides; i++) {
    const a = rot + (i / sides) * Math.PI * 2;
    pts.push([cx + Math.cos(a) * r, cz + Math.sin(a) * r]);
  }
  return pts;
}

function stadiumPoly2D(cx, cz, straightHalf, rad, arcSteps = 12) {
  const pts = [];
  for (let i = 0; i <= arcSteps; i++) {
    const a = -Math.PI * 0.5 + (i / arcSteps) * Math.PI;
    pts.push([cx + straightHalf + Math.cos(a) * rad, cz + Math.sin(a) * rad]);
  }
  for (let i = 0; i <= arcSteps; i++) {
    const a = Math.PI * 0.5 + (i / arcSteps) * Math.PI;
    pts.push([cx - straightHalf + Math.cos(a) * rad, cz + Math.sin(a) * rad]);
  }
  return pts;
}

function roundedRectPoly2D(cx, cz, hx, hz, r, steps = 5) {
  const rr = Math.min(r, hx * 0.9, hz * 0.9);
  const ix = hx - rr;
  const iz = hz - rr;
  const corners = [
    [cx + ix, cz - iz, -Math.PI * 0.5],
    [cx + ix, cz + iz, 0],
    [cx - ix, cz + iz, Math.PI * 0.5],
    [cx - ix, cz - iz, Math.PI],
  ];
  const pts = [];
  for (const [qx, qz, a0] of corners) {
    for (let i = 0; i <= steps; i++) {
      const a = a0 + (i / steps) * (Math.PI * 0.5);
      pts.push([qx + Math.cos(a) * rr, qz + Math.sin(a) * rr]);
    }
  }
  return pts;
}

/** 10-frond lush star-shaped tropical fern geometry. */
function buildFernStarGeo() {
  const pos = [];
  const uv = [];
  const tiers = [
    { count: 6, r0: 0.06, r1: 0.54, yMid: 0.34, yTip: 0.17, hw: 0.095, rotOff: 0 },
    { count: 4, r0: 0.04, r1: 0.38, yMid: 0.44, yTip: 0.30, hw: 0.08, rotOff: 0.38 },
  ];
  for (const tier of tiers) {
    for (let i = 0; i < tier.count; i++) {
      const a = (i / tier.count) * Math.PI * 2 + tier.rotOff;
      const ca = Math.cos(a);
      const sa = Math.sin(a);
      const nx = -sa;
      const nz = ca;
      const rMid = (tier.r0 + tier.r1) * 0.48;
      const pBase = [ca * tier.r0, 0.03, sa * tier.r0];
      const pL = [ca * rMid + nx * tier.hw, tier.yMid, sa * rMid + nz * tier.hw];
      const pR = [ca * rMid - nx * tier.hw, tier.yMid, sa * rMid - nz * tier.hw];
      const pTip = [ca * tier.r1, tier.yTip, sa * tier.r1];
      pushTri(pos, uv, pBase, pL, pTip, [0, 0], [0.5, 1], [1, 0.5]);
      pushTri(pos, uv, pBase, pTip, pR, [0, 0], [1, 0.5], [0.5, 0]);
    }
  }
  return makeTransformedPosUvBuf(pos, uv);
}

/** 7-leaf cupped broad-leaf tropical plant geometry. */
function buildBroadLeafGeo() {
  const pos = [];
  const uv = [];
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * Math.PI * 2 + (i % 2) * 0.2;
    const ca = Math.cos(a);
    const sa = Math.sin(a);
    const nx = -sa;
    const nz = ca;
    const reach = 0.36 + (i % 2) * 0.09;
    const midR = reach * 0.55;
    const hw = 0.145;
    const yPeak = 0.33 + (i % 3) * 0.06;
    const pBase = [ca * 0.04, 0.04, sa * 0.04];
    const pMid = [ca * midR, yPeak + 0.04, sa * midR];
    const pL = [ca * midR + nx * hw, yPeak, sa * midR + nz * hw];
    const pR = [ca * midR - nx * hw, yPeak, sa * midR - nz * hw];
    const pTip = [ca * reach, yPeak - 0.08, sa * reach];
    pushTri(pos, uv, pBase, pL, pMid, [0, 0], [0.5, 1], [0.5, 0.5]);
    pushTri(pos, uv, pBase, pMid, pR, [0, 0], [0.5, 0.5], [0.5, 0]);
    pushTri(pos, uv, pMid, pL, pTip, [0.5, 0.5], [0.5, 1], [1, 0.5]);
    pushTri(pos, uv, pMid, pTip, pR, [0.5, 0.5], [1, 0.5], [0.5, 0]);
  }
  return makeTransformedPosUvBuf(pos, uv);
}

/** Clustered leafy botanical cushion tuft. */
function buildShrubTuftGeo() {
  const parts = [
    [0, 0.19, 0, 0.34, 0.24, 0.34, 0.2],
    [0.14, 0.16, 0.1, 0.24, 0.2, 0.24, 1.1],
    [-0.13, 0.17, -0.09, 0.25, 0.2, 0.23, 2.3],
  ];
  const geoms = parts.map(([px, py, pz, sx, sy, sz, ry]) => {
    const g = new THREE.IcosahedronGeometry(1.0, 1);
    g.scale(sx, sy, sz);
    g.rotateY(ry);
    g.translate(px, py, pz);
    return g;
  });
  return mergeNormalizedGeoms(geoms);
}

/**
 * Build rich timber-slat architectural planter benches, lush tropical botanical beds,
 * and relaxed seated visitors across the park's plazas, esplanades, and open lawns.
 */
export function buildGardenPlanterBenches(scene, data, obstacles = {}) {
  const rng = makeSeeded(20261123);

  const woodBucket = { pos: [], uv: [] };
  const plinthBucket = { pos: [], uv: [] };
  const rimBucket = { pos: [], uv: [] };
  const soilBucket = { pos: [], uv: [] };

  const plantPlacements = []; // { kind: 'fern'|'broad'|'shrub', x, y, z, scale, rotY }
  const sitters = [];         // { x, y, z, rotY, colorIdx }

  const pushPlant = (kind, lx, ly, lz, scale, tr, rotY = rng() * Math.PI * 2) => {
    const [wx, wy, wz] = tr(lx, ly, lz);
    plantPlacements.push({ kind, x: wx, y: wy, z: wz, scale, rotY });
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

  // --- 7 Architectural Planter-Bench Archetypes (matching media_1795436057466_b7cf3311.jpg) ---

  const addOvalPlanterBench = (cx, baseY, cz, rotY) => {
    const tr = makeTransform(cx, baseY, cz, rotY);
    const soilPts = stadiumPoly2D(0, 0, 1.08, 0.5, 10);
    const rimPts = stadiumPoly2D(0, 0, 1.08, 0.59, 10);
    const benchCurve = stadiumPoly2D(0, 0, 1.08, 0.84, 12);
    const plinthPts = stadiumPoly2D(0, 0, 1.08, 0.94, 12);

    appendConvexPrism(plinthBucket, plinthPts, 0.0, 0.34, tr, 1.0);
    appendConvexPrism(rimBucket, rimPts, 0.34, 0.49, tr, 1.0);
    appendConvexPrism(soilBucket, soilPts, 0.35, 0.46, tr, 1.0);
    appendRibbonStrip(woodBucket, benchCurve, 0.52, 0.34, 0.46, true, tr, 3.2);

    const plantSpecs = [
      ["fern", -1.25, -0.05, 0.95],
      ["broad", -0.62, 0.14, 0.88],
      ["shrub", 0.0, -0.06, 0.92],
      ["broad", 0.62, 0.1, 0.9],
      ["fern", 1.25, -0.04, 0.95],
    ];
    for (const [kind, px, pz, sc] of plantSpecs) pushPlant(kind, px, 0.45, pz, sc, tr);

    pushSitter(-0.55, 0.46, 0.86, 0, tr, rotY);
    if (rng() > 0.3) pushSitter(0.65, 0.46, -0.86, Math.PI, tr, rotY);
  };

  const addSerpentineBench = (cx, baseY, cz, rotY) => {
    const tr = makeTransform(cx, baseY, cz, rotY);
    const steps = 28;
    const wavePts = [];
    for (let i = 0; i <= steps; i++) {
      const u = i / steps;
      const lx = -3.35 + u * 6.7;
      const lz = Math.sin(u * Math.PI * 2) * 0.92;
      wavePts.push([lx, lz]);
    }
    appendRibbonStrip(plinthBucket, wavePts, 0.48, 0.0, 0.34, false, tr, 1.0);
    appendRibbonStrip(woodBucket, wavePts, 0.64, 0.34, 0.47, false, tr, 3.6);

    // 2 lush oval planter islands nested inside the S-curve concavities
    for (const [ix, iz] of [
      [-1.58, -0.95],
      [1.58, 0.95],
    ]) {
      const rimPts = stadiumPoly2D(ix, iz, 0.52, 0.54, 10);
      const soilPts = stadiumPoly2D(ix, iz, 0.52, 0.45, 10);
      appendConvexPrism(rimBucket, rimPts, 0.0, 0.35, tr, 1.0, 0, [ix, iz]);
      appendConvexPrism(soilBucket, soilPts, 0.04, 0.33, tr, 1.0, 0, [ix, iz]);
      pushPlant("fern", ix - 0.48, 0.32, iz, 0.94, tr);
      pushPlant("broad", ix + 0.04, 0.32, iz + 0.1, 0.9, tr);
      pushPlant("shrub", ix + 0.5, 0.32, iz - 0.06, 0.85, tr);
    }

    pushSitter(-1.55, 0.47, 0.92, 0, tr, rotY);
    pushSitter(1.55, 0.47, -0.92, Math.PI, tr, rotY);
  };

  const addXCrossBench = (cx, baseY, cz, rotY) => {
    const tr = makeTransform(cx, baseY, cz, rotY);
    const armAngles = [Math.PI * 0.25, (Math.PI * 3) / 4, -(Math.PI * 3) / 4, -Math.PI * 0.25];
    for (const ang of armAngles) {
      const midR = 1.28;
      const ax = Math.cos(ang) * midR;
      const az = Math.sin(ang) * midR;
      addLocalBox(plinthBucket, ax, 0.0, 0.34, az, 1.38, 0.72, -ang, tr, 1.0);
      addLocalBox(woodBucket, ax, 0.34, 0.46, az, 1.5, 0.88, -ang, tr, 1.5);
    }
    const rimPts = roundedRectPoly2D(0, 0, 0.82, 0.82, 0.16, 4);
    const soilPts = roundedRectPoly2D(0, 0, 0.7, 0.7, 0.12, 4);
    appendConvexPrism(rimBucket, rimPts, 0.0, 0.5, tr, 1.0);
    appendConvexPrism(soilBucket, soilPts, 0.1, 0.47, tr, 1.0);

    pushPlant("fern", 0, 0.46, 0, 1.15, tr);
    pushPlant("broad", -0.34, 0.46, 0.28, 0.8, tr);
    pushPlant("shrub", 0.34, 0.46, -0.28, 0.78, tr);
    pushPlant("broad", 0.3, 0.46, 0.32, 0.76, tr);
    pushPlant("fern", -0.32, 0.46, -0.3, 0.75, tr);

    pushSitter(0.95, 0.46, 0.95, Math.PI * 0.25, tr, rotY);
  };

  const addSquareWrapBench = (cx, baseY, cz, rotY) => {
    const tr = makeTransform(cx, baseY, cz, rotY);
    const plinthPts = roundedRectPoly2D(0, 0, 1.32, 1.32, 0.32, 5);
    const rimPts = roundedRectPoly2D(0, 0, 0.96, 0.96, 0.2, 4);
    const soilPts = roundedRectPoly2D(0, 0, 0.86, 0.86, 0.16, 4);
    const wrapCurve = roundedRectPoly2D(0, 0, 1.22, 1.22, 0.28, 5);

    appendConvexPrism(plinthBucket, plinthPts, 0.0, 0.34, tr, 1.0);
    appendConvexPrism(rimBucket, rimPts, 0.34, 0.49, tr, 1.0);
    appendConvexPrism(soilBucket, soilPts, 0.35, 0.46, tr, 1.0);
    appendRibbonStrip(woodBucket, wrapCurve, 0.5, 0.34, 0.46, true, tr, 3.2);

    const plants = [
      ["fern", -0.4, -0.4, 0.9],
      ["broad", 0.4, -0.35, 0.88],
      ["shrub", 0.0, 0.0, 0.95],
      ["fern", 0.38, 0.4, 0.86],
      ["broad", -0.38, 0.36, 0.84],
    ];
    for (const [kind, px, pz, sc] of plants) pushPlant(kind, px, 0.45, pz, sc, tr);

    pushSitter(0.3, 0.46, 1.24, 0, tr, rotY);
    if (rng() > 0.35) pushSitter(-1.24, 0.46, -0.25, -Math.PI * 0.5, tr, rotY);
  };

  const addCurvedCArcBench = (cx, baseY, cz, rotY) => {
    const tr = makeTransform(cx, baseY, cz, rotY);
    const arcPts = [];
    const backPts = [];
    const segs = 18;
    const aStart = -Math.PI * 0.58;
    const aEnd = Math.PI * 0.58;
    for (let i = 0; i <= segs; i++) {
      const a = aStart + (i / segs) * (aEnd - aStart);
      arcPts.push([Math.cos(a) * 1.56, Math.sin(a) * 1.56]);
      backPts.push([Math.cos(a) * 1.84, Math.sin(a) * 1.84]);
    }
    appendRibbonStrip(plinthBucket, arcPts, 0.52, 0.0, 0.34, false, tr, 1.0);
    appendRibbonStrip(woodBucket, arcPts, 0.66, 0.34, 0.47, false, tr, 3.6);
    appendRibbonStrip(woodBucket, backPts, 0.14, 0.47, 0.64, false, tr, 1.2);

    const islandRim = regularPoly2D(-0.18, 0, 1.0, 14);
    const islandSoil = regularPoly2D(-0.18, 0, 0.9, 14);
    appendConvexPrism(rimBucket, islandRim, 0.0, 0.34, tr, 1.0, 0, [-0.18, 0]);
    appendConvexPrism(soilBucket, islandSoil, 0.04, 0.32, tr, 1.0, 0, [-0.18, 0]);

    pushPlant("fern", -0.45, 0.31, -0.25, 0.96, tr);
    pushPlant("broad", 0.15, 0.31, 0.25, 0.9, tr);
    pushPlant("shrub", -0.25, 0.31, 0.38, 0.88, tr);
    pushPlant("fern", 0.2, 0.31, -0.35, 0.82, tr);

    pushSitter(1.42, 0.47, 0.62, Math.PI * 0.35, tr, rotY);
    if (rng() > 0.35) pushSitter(1.42, 0.47, -0.62, Math.PI * 0.65, tr, rotY);
  };

  const addHexClusterBench = (cx, baseY, cz, rotY) => {
    const tr = makeTransform(cx, baseY, cz, rotY);
    const hr = 0.68;
    const dx = Math.sqrt(3) * (hr + 0.04);
    const dz = 1.5 * (hr + 0.04);
    const cells = [
      { x: 0, z: 0, type: "soil", h: 0.46 },
      { x: -dx, z: 0, type: "wood", h: 0.44 },
      { x: dx, z: 0, type: "wood", h: 0.48 },
      { x: -dx * 0.5, z: -dz, type: "soil", h: 0.42 },
      { x: dx * 0.5, z: -dz, type: "wood", h: 0.45 },
      { x: -dx * 0.5, z: dz, type: "wood", h: 0.44 },
      { x: dx * 0.5, z: dz, type: "soil", h: 0.4 },
    ];
    for (const c of cells) {
      if (c.type === "wood") {
        const baseHex = regularPoly2D(c.x, c.z, hr * 0.9, 6, Math.PI / 6);
        const topHex = regularPoly2D(c.x, c.z, hr, 6, Math.PI / 6);
        appendConvexPrism(plinthBucket, baseHex, 0.0, c.h - 0.1, tr, 1.0, 0, [c.x, c.z]);
        appendConvexPrism(woodBucket, topHex, c.h - 0.1, c.h, tr, 1.55, 0.52, [c.x, c.z]);
      } else {
        const rimHex = regularPoly2D(c.x, c.z, hr, 6, Math.PI / 6);
        const soilHex = regularPoly2D(c.x, c.z, hr * 0.85, 6, Math.PI / 6);
        appendConvexPrism(rimBucket, rimHex, 0.0, c.h + 0.03, tr, 1.0, 0, [c.x, c.z]);
        appendConvexPrism(soilBucket, soilHex, 0.08, c.h, tr, 1.0, 0, [c.x, c.z]);
        pushPlant("fern", c.x, c.h - 0.01, c.z, 0.88, tr);
        pushPlant("broad", c.x + 0.22, c.h - 0.01, c.z - 0.18, 0.72, tr);
        pushPlant("shrub", c.x - 0.2, c.h - 0.01, c.z + 0.16, 0.7, tr);
      }
    }
    pushSitter(-dx, 0.44, 0, 0, tr, rotY);
  };

  const addLinearSplitBench = (cx, baseY, cz, rotY) => {
    const tr = makeTransform(cx, baseY, cz, rotY);
    // 3 solid slatted wood bench segments framing 2 dark recessed planter pockets cleanly without z-fighting
    for (const [bx, w] of [
      [-1.85, 0.9],
      [0.0, 0.8],
      [1.85, 0.9],
    ]) {
      addLocalBox(plinthBucket, bx, 0.0, 0.34, 0, w - 0.08, 1.05, 0, tr, 1.0);
      addLocalBox(woodBucket, bx, 0.34, 0.46, 0, w, 1.24, 0, tr, 1.6);
    }
    for (const pzSide of [-0.52, 0.52]) {
      addLocalBox(plinthBucket, 0, 0.0, 0.34, pzSide, 2.8, 0.16, 0, tr, 1.0);
      addLocalBox(woodBucket, 0, 0.34, 0.46, pzSide, 2.9, 0.2, 0, tr, 1.6);
    }
    for (const px of [-0.9, 0.9]) {
      addLocalBox(rimBucket, px, 0.04, 0.48, 0, 0.96, 0.82, 0, tr, 1.0);
      addLocalBox(soilBucket, px, 0.08, 0.46, 0, 0.82, 0.68, 0, tr, 1.0);
      pushPlant("fern", px - 0.14, 0.45, 0.06, 0.85, tr);
      pushPlant("broad", px + 0.16, 0.45, -0.06, 0.82, tr);
    }
    pushSitter(-1.85, 0.46, 0.15, 0, tr, rotY);
  };

  const BUILDERS = {
    oval: { r: 2.35, fn: addOvalPlanterBench },
    serpentine: { r: 3.55, fn: addSerpentineBench },
    xcross: { r: 2.25, fn: addXCrossBench },
    square: { r: 2.15, fn: addSquareWrapBench },
    curvedC: { r: 2.25, fn: addCurvedCArcBench },
    hex: { r: 2.45, fn: addHexClusterBench },
    linear: { r: 2.55, fn: addLinearSplitBench },
  };

  // --- Collision & Clearance Checks ---
  const forbiddenZones = data.zones.filter((z) => {
    const u = z.name.toUpperCase();
    return (
      z.kind === "water" ||
      z.kind === "sport" ||
      z.kind === "play" ||
      z.kind === "track" ||
      z.kind === "gradin" ||
      z.kind === "building" ||
      u.includes("BEACH") ||
      u.includes("SABLE")
    );
  });
  const greenZones = data.zones.filter((z) => z.kind === "green");
  const roofs = data.roofs || [];

  const ARCH_CORRIDORS = [
    [-11.68, -13.5, -23.38, -1.8],
    [11.69, -13.5, 23.39, -1.8],
  ];

  // Match walkway centerlines in js/living.js buildPedestrians
  const WALK_SEGMENTS = [
    [-168, -21.8, -104, -21.8],
    [-166, 21.8, -102, 21.8],
    [-68, 4.0, -26, 4.0],
    [-18, -19.5, 18, -19.5],
    [-22, 6.2, 22, 6.2],
    [24, 9.8, 46, 19.6],
    [72, 5.0, 134, 2.5],
    [136, 2.2, 200, 2.2],
  ];

  const trees = obstacles.trees || [];
  const bushes = obstacles.bushes || [];
  const existingBenches = obstacles.benches || [];
  const placed = []; // { kind, x, z, r, baseY, rotY }

  const isZonePerimeterClear = (x, z, r, targetZone, requireNoGreen) => {
    if (!inZone2D([x, z], targetZone)) return false;
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      const sx = x + Math.cos(a) * r;
      const sz = z + Math.sin(a) * r;
      if (!inZone2D([sx, sz], targetZone)) return false;
      if (requireNoGreen && greenZones.some((gz) => inZone2D([sx, sz], gz))) return false;
    }
    if (requireNoGreen && greenZones.some((gz) => inZone2D([x, z], gz))) return false;
    if (forbiddenZones.some((fz) => isNearZone2D([x, z], fz, r + 0.55))) return false;
    if (roofs.some((rf) => pointInPoly2D([x, z], rf.poly) || pointNearPolyEdge2D([x, z], rf.poly, r + 0.6))) {
      return false;
    }
    if (ARCH_CORRIDORS.some(([ax, az, bx, bz]) => distToSegment2D(x, z, ax, az, bx, bz) < r + 1.5)) {
      return false;
    }
    if (WALK_SEGMENTS.some(([ax, az, bx, bz]) => distToSegment2D(x, z, ax, az, bx, bz) < r + 1.15)) {
      return false;
    }
    if (trees.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < r + 1.5)) return false;
    if (bushes.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < r + 0.9)) return false;
    if (existingBenches.some(([bx, bz]) => Math.hypot(bx - x, bz - z) < r + 1.45)) return false;
    if (placed.some((p) => Math.hypot(p.x - x, p.z - z) < r + p.r + 2.0)) return false;
    return true;
  };

  const dominantEdgeYaw = (poly) => {
    let bestLen = 0;
    let yaw = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len > bestLen) {
        bestLen = len;
        yaw = -Math.atan2(b[1] - a[1], b[0] - a[0]);
      }
    }
    return yaw;
  };

  const sampleCandidatesInZone = (zone, countX = 5, countZ = 4) => {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [px, pz] of zone.poly) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
    }
    const pts = [];
    if (zone.centroid) pts.push([zone.centroid[0], zone.centroid[1]]);
    for (let ix = 1; ix <= countX; ix++) {
      for (let iz = 1; iz <= countZ; iz++) {
        pts.push([
          minX + ((ix - 0.35 + rng() * 0.3) / (countX + 0.3)) * (maxX - minX),
          minZ + ((iz - 0.35 + rng() * 0.3) / (countZ + 0.3)) * (maxZ - minZ),
        ]);
      }
    }
    return pts;
  };

  // --- Tier 1: Paved Plazas (AIR DE REPOS & BUVETTE / KIOSQUES) ---
  const plazaZones = data.zones
    .filter((z) => {
      if (z.kind !== "paving" || z.area < 45) return false;
      const u = z.name.toUpperCase();
      return u.includes("REPOS") || u.includes("KIOSQUE");
    })
    .sort((a, b) => b.area - a.area);

  const largeCycle = ["serpentine", "xcross", "hex", "square", "curvedC", "oval", "linear"];
  const medCycle = ["oval", "square", "curvedC", "xcross", "hex", "linear"];
  let kindCursor = 0;

  for (const pz of plazaZones) {
    const target = pz.area > 280 ? 3 : pz.area > 120 ? 2 : 1;
    const alignYaw = dominantEdgeYaw(pz.poly);
    const cands = sampleCandidatesInZone(pz, 6, 5);
    let added = 0;

    for (const [cx, cz] of cands) {
      if (added >= target) break;
      const palette = pz.area > 200 ? largeCycle : medCycle;
      // Try chosen kind, or fall back to compact square/oval if serpentine is too wide for narrow strip
      const chosenKind = palette[kindCursor % palette.length];
      const tryList =
        BUILDERS[chosenKind].r > 2.6 ? [chosenKind, "square", "oval"] : [chosenKind];

      for (const tk of tryList) {
        const spec = BUILDERS[tk];
        if (isZonePerimeterClear(cx, cz, spec.r, pz, true)) {
          const rotY = alignYaw + (rng() - 0.5) * 0.28;
          spec.fn(cx, 0.35, cz, rotY);
          placed.push({ kind: tk, x: cx, z: cz, r: spec.r, baseY: 0.35, rotY });
          added++;
          kindCursor++;
          break;
        }
      }
    }
  }

  // --- Tier 2: Open Relaxation Lawns & Landscaped Gardens (area >= 180) ---
  const lawnZones = data.zones.filter((z) => {
    if (z.kind !== "green" || z.area < 180 || z.area > 800) return false;
    if (z.holes && z.holes.length) return false;
    const u = z.name.toUpperCase();
    return u.includes("PELOUSE") || u.includes("JARDIN PLANT");
  });

  const lawnCycle = ["curvedC", "oval", "hex", "square", "serpentine", "xcross", "linear"];
  let lawnCursor = 0;
  for (const lz of lawnZones) {
    const alignYaw = dominantEdgeYaw(lz.poly);
    const cands = sampleCandidatesInZone(lz, 5, 5);
    for (const [cx, cz] of cands) {
      const tk = lawnCycle[lawnCursor % lawnCycle.length];
      const spec = BUILDERS[tk];
      if (isZonePerimeterClear(cx, cz, spec.r, lz, false)) {
        const rotY = alignYaw + (rng() - 0.5) * 0.35;
        spec.fn(cx, 0.455, cz, rotY);
        placed.push({ kind: tk, x: cx, z: cz, r: spec.r, baseY: 0.455, rotY });
        lawnCursor++;
        break;
      }
    }
  }

  // --- Build & Merge Scene Meshes ---
  const woodTex = makeWoodSlatsTexture();
  if (woodBucket.pos.length) {
    const woodGeo = makeTransformedPosUvBuf(woodBucket.pos, woodBucket.uv);
    const woodMat = new THREE.MeshStandardMaterial({
      map: woodTex,
      color: 0xffffff,
      roughness: 0.72,
      metalness: 0.04,
    });
    const woodMesh = new THREE.Mesh(woodGeo, woodMat);
    woodMesh.castShadow = true;
    woodMesh.receiveShadow = true;
    scene.add(woodMesh);
  }

  if (plinthBucket.pos.length) {
    const plinthGeo = makeTransformedPosUvBuf(plinthBucket.pos, plinthBucket.uv);
    const plinthMat = new THREE.MeshStandardMaterial({
      color: 0x3b3530,
      roughness: 0.88,
      metalness: 0.06,
    });
    const plinthMesh = new THREE.Mesh(plinthGeo, plinthMat);
    plinthMesh.castShadow = true;
    plinthMesh.receiveShadow = true;
    scene.add(plinthMesh);
  }

  if (rimBucket.pos.length) {
    const rimGeo = makeTransformedPosUvBuf(rimBucket.pos, rimBucket.uv);
    const rimMat = new THREE.MeshStandardMaterial({
      color: 0xddd4c5,
      roughness: 0.86,
      metalness: 0.02,
    });
    const rimMesh = new THREE.Mesh(rimGeo, rimMat);
    rimMesh.castShadow = true;
    rimMesh.receiveShadow = true;
    scene.add(rimMesh);
  }

  if (soilBucket.pos.length) {
    const soilGeo = makeTransformedPosUvBuf(soilBucket.pos, soilBucket.uv);
    const soilMat = new THREE.MeshStandardMaterial({
      color: 0x4b4233,
      roughness: 0.95,
      metalness: 0,
    });
    const soilMesh = new THREE.Mesh(soilGeo, soilMat);
    soilMesh.receiveShadow = true;
    scene.add(soilMesh);
  }

  // --- Botanical Plant InstancedMeshes ---
  const greenPalette = [
    new THREE.Color(0x466638),
    new THREE.Color(0x5f8048),
    new THREE.Color(0x7c9c59),
    new THREE.Color(0x6c874b),
    new THREE.Color(0x8ca46d),
    new THREE.Color(0x3b5930),
  ];
  const plantMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    roughness: 0.84,
    side: THREE.DoubleSide,
  });
  const plantGeos = {
    fern: buildFernStarGeo(),
    broad: buildBroadLeafGeo(),
    shrub: buildShrubTuftGeo(),
  };

  const dummy = new THREE.Object3D();
  for (const kind of ["fern", "broad", "shrub"]) {
    const items = plantPlacements.filter((p) => p.kind === kind);
    if (!items.length || !plantGeos[kind]) continue;
    const inst = new THREE.InstancedMesh(plantGeos[kind], plantMat, items.length);
    inst.castShadow = true;
    inst.receiveShadow = true;
    items.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rotY, 0);
      dummy.scale.set(p.scale, p.scale, p.scale);
      dummy.updateMatrix();
      inst.setMatrixAt(idx, dummy.matrix);
      inst.setColorAt(idx, greenPalette[(idx + (kind === "fern" ? 1 : 3)) % greenPalette.length]);
    });
    inst.instanceColor.needsUpdate = true;
    scene.add(inst);
  }

  // --- Stylized Seated Visitors on Benches ---
  if (sitters.length) {
    const outfitPalette = [
      new THREE.Color(0x283848),
      new THREE.Color(0x8c5142),
      new THREE.Color(0x3a645a),
      new THREE.Color(0xc29252),
      new THREE.Color(0xdcd3c3),
    ];
    const torsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    const legMat = new THREE.MeshStandardMaterial({ color: 0x313842, roughness: 0.88 });
    const headMat = new THREE.MeshStandardMaterial({ color: 0x4b3d33, roughness: 0.8 });

    const torsos = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.15, 0.19, 0.56, 8),
      torsoMat,
      sitters.length
    );
    const legs = new THREE.InstancedMesh(
      new THREE.BoxGeometry(0.3, 0.34, 0.36),
      legMat,
      sitters.length
    );
    const heads = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.155, 8, 8),
      headMat,
      sitters.length
    );
    torsos.castShadow = true;
    heads.castShadow = true;

    sitters.forEach((s, idx) => {
      const fx = Math.sin(s.rotY);
      const fz = Math.cos(s.rotY);

      dummy.position.set(s.x, s.y + 0.28, s.z);
      dummy.rotation.set(0, s.rotY, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      torsos.setMatrixAt(idx, dummy.matrix);
      torsos.setColorAt(idx, outfitPalette[s.colorIdx]);

      dummy.position.set(s.x + fx * 0.16, s.y - 0.14, s.z + fz * 0.16);
      dummy.updateMatrix();
      legs.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(s.x, s.y + 0.68, s.z);
      dummy.updateMatrix();
      heads.setMatrixAt(idx, dummy.matrix);
    });
    torsos.instanceColor.needsUpdate = true;
    scene.add(legs, torsos, heads);
  }

  return {
    count: placed.length,
    placed,
    footprints: placed.map((p) => [p.x, p.z, p.r, p.baseY]),
  };
}
