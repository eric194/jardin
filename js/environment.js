import * as THREE from "three";
import { applyWindShader } from "./textures.js";

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

function pointNearPoly2D(pt, poly, margin) {
  if (pointInPoly2D(pt, poly)) return true;
  const [x, z] = pt;
  const mSq = margin * margin;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const l2 = dx * dx + dz * dz;
    const t = l2 < 1e-9 ? 0 : Math.max(0, Math.min(1, ((x - a[0]) * dx + (z - a[1]) * dz) / l2));
    const px = a[0] + t * dx;
    const pz = a[1] + t * dz;
    const dSq = (x - px) * (x - px) + (z - pz) * (z - pz);
    if (dSq < mSq) return true;
  }
  return false;
}

export function buildThiesBackdrop(scene, textures) {
  const geo = new THREE.PlaneGeometry(11000, 11000);
  geo.rotateX(-Math.PI / 2);
  const mat = new THREE.MeshBasicMaterial({
    map: textures.senegal,
    color: 0xffffff,
    transparent: true,
    opacity: 1,
    depthWrite: false,
    toneMapped: false,
    fog: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(0, 0.002, 0);
  scene.add(mesh);

  return {
    mesh,
    material: mat,
    updateBeacon(_now, mapOpacity) {
      const overlayTop = mapOpacity >= 0.72;
      mat.depthTest = !overlayTop;
      mesh.renderOrder = overlayTop ? 50 : 0;
    },
  };
}

export { buildThiesBackdrop as buildSenegalBackdrop };

class RibbonBuilder {
  constructor(y = 0.465) {
    this.y = y;
    this.positions = [];
  }
  addSegment(x1, z1, x2, z2, width = 0.2) {
    const dx = x2 - x1;
    const dz = z2 - z1;
    const len = Math.hypot(dx, dz);
    if (len < 1e-4) return;
    const nx = (-dz / len) * (width * 0.5);
    const nz = (dx / len) * (width * 0.5);
    const y = this.y;

    this.positions.push(
      x1 + nx, y, z1 + nz,
      x2 + nx, y, z2 + nz,
      x1 - nx, y, z1 - nz,

      x1 - nx, y, z1 - nz,
      x2 + nx, y, z2 + nz,
      x2 - nx, y, z2 - nz
    );
  }
  addRect(cx, cz, w, d, width = 0.2) {
    const hw = w / 2;
    const hd = d / 2;
    this.addSegment(cx - hw, cz - hd, cx + hw, cz - hd, width);
    this.addSegment(cx + hw, cz - hd, cx + hw, cz + hd, width);
    this.addSegment(cx + hw, cz + hd, cx - hw, cz + hd, width);
    this.addSegment(cx - hw, cz + hd, cx - hw, cz - hd, width);
  }
  addArc(cx, cz, radius, a0, a1, steps = 24, width = 0.2) {
    for (let i = 0; i < steps; i++) {
      const t0 = a0 + ((a1 - a0) * i) / steps;
      const t1 = a0 + ((a1 - a0) * (i + 1)) / steps;
      this.addSegment(
        cx + Math.cos(t0) * radius,
        cz + Math.sin(t0) * radius,
        cx + Math.cos(t1) * radius,
        cz + Math.sin(t1) * radius,
        width
      );
    }
  }
  addDot(cx, cz, r = 0.25) {
    const segs = 10;
    const y = this.y;
    for (let i = 0; i < segs; i++) {
      const a0 = (i / segs) * Math.PI * 2;
      const a1 = ((i + 1) / segs) * Math.PI * 2;
      this.positions.push(
        cx, y, cz,
        cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r,
        cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r
      );
    }
  }
  toGeometry() {
    const geom = new THREE.BufferGeometry();
    geom.setAttribute("position", new THREE.Float32BufferAttribute(this.positions, 3));
    geom.computeVertexNormals();
    return geom;
  }
}

function makeLocalBasisFromQuad(poly) {
  const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
  const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;
  const e01 = [poly[1][0] - poly[0][0], poly[1][1] - poly[0][1]];
  const e12 = [poly[2][0] - poly[1][0], poly[2][1] - poly[1][1]];
  const l01 = Math.hypot(e01[0], e01[1]);
  const l12 = Math.hypot(e12[0], e12[1]);
  const longEdge = l12 >= l01 ? e12 : e01;
  const shortEdge = l12 >= l01 ? e01 : e12;
  const longLen = Math.max(l01, l12);
  const shortLen = Math.min(l01, l12);
  const ux = longEdge[0] / longLen;
  const uz = longEdge[1] / longLen;
  const vx = shortEdge[0] / shortLen;
  const vz = shortEdge[1] / shortLen;
  return {
    cx,
    cz,
    longLen,
    shortLen,
    ux,
    uz,
    vx,
    vz,
    pt: (u, v) => [cx + ux * u + vx * v, cz + uz * u + vz * v],
  };
}

export function buildSportCourts(scene, data) {
  // Trois strates dédiées (terrains 0.425 -> 0.432, sable beach 0.415 -> 0.423, piste/sprint 0.380 -> 0.389)
  const rbSport = new RibbonBuilder(0.432);
  const rbBeach = new RibbonBuilder(0.423);
  const rbTrack = new RibbonBuilder(0.389);
  const propMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.72 });
  const netMat = new THREE.MeshBasicMaterial({
    color: 0xd8d3c9,
    transparent: true,
    opacity: 0.75,
    side: THREE.DoubleSide,
  });

  const addGoalFrame = (cx, cz, width, height, depth, rotY, baseY = 0.425) => {
    const g = new THREE.Group();
    g.position.set(cx, baseY, cz);
    g.rotation.y = rotY;
    const postGeo = new THREE.CylinderGeometry(0.07, 0.07, height, 6);
    const barGeo = new THREE.CylinderGeometry(0.07, 0.07, width, 6);
    barGeo.rotateZ(Math.PI / 2);

    const pL = new THREE.Mesh(postGeo, propMat);
    pL.position.set(-width / 2, height / 2, 0);
    const pR = new THREE.Mesh(postGeo, propMat);
    pR.position.set(width / 2, height / 2, 0);
    const top = new THREE.Mesh(barGeo, propMat);
    top.position.set(0, height, 0);

    const netBack = new THREE.Mesh(new THREE.PlaneGeometry(width, height), netMat);
    netBack.position.set(0, height / 2, -depth);
    g.add(pL, pR, top, netBack);
    scene.add(g);
  };

  // 1. Football (X: -244..-194, Z: -14.2..15.8 -> 50x30m)
  const fx = -219.0;
  const fz = 0.8;
  rbSport.addRect(fx, fz, 48.0, 28.0, 0.24);
  rbSport.addSegment(fx, fz - 14.0, fx, fz + 14.0, 0.22);
  rbSport.addArc(fx, fz, 4.2, 0, Math.PI * 2, 32, 0.22);
  rbSport.addDot(fx, fz, 0.35);
  // Surfaces de réparation
  rbSport.addRect(fx - 24.0 + 4.2, fz, 8.4, 15.6, 0.2);
  rbSport.addRect(fx + 24.0 - 4.2, fz, 8.4, 15.6, 0.2);
  rbSport.addRect(fx - 24.0 + 1.6, fz, 3.2, 7.6, 0.18);
  rbSport.addRect(fx + 24.0 - 1.6, fz, 3.2, 7.6, 0.18);
  rbSport.addArc(fx - 24.0 + 6.2, fz, 4.0, -0.75, 0.75, 14, 0.18);
  rbSport.addArc(fx + 24.0 - 6.2, fz, 4.0, Math.PI - 0.75, Math.PI + 0.75, 14, 0.18);
  addGoalFrame(fx - 24.0, fz, 5.2, 2.1, 1.3, -Math.PI / 2, 0.425);
  addGoalFrame(fx + 24.0, fz, 5.2, 2.1, 1.3, Math.PI / 2, 0.425);

  // 2. Piste de Sprint (6 couloirs nets de 1,20 m, lignes de départ et d'arrivée)
  const spX0 = -244.0;
  const spX1 = -194.0;
  const spZ0 = -22.66;
  const spZ1 = -15.46;
  rbTrack.addRect((spX0 + spX1) * 0.5, (spZ0 + spZ1) * 0.5, spX1 - spX0, spZ1 - spZ0, 0.15);
  for (let lane = 1; lane < 6; lane++) {
    const lz = spZ0 + (lane * (spZ1 - spZ0)) / 6;
    rbTrack.addSegment(spX0, lz, spX1, lz, 0.11);
  }
  rbTrack.addSegment(-242.0, spZ0, -242.0, spZ1, 0.16); // ligne départ
  rbTrack.addSegment(-196.0, spZ0, -196.0, spZ1, 0.18); // ligne arrivée
  for (let lane = 0; lane < 6; lane++) {
    const cz = spZ0 + ((lane + 0.5) * (spZ1 - spZ0)) / 6;
    rbTrack.addDot(-242.7, cz, 0.16);
  }

  // 3. Arène en sable fin : Beach Soccer / Beach Handball / Beach Volleyball (X: -137..-111, Z: -17.6..19.3)
  const hx = -124.0;
  const hz = 0.85;
  const bw = 20.0;
  const bd = 34.0;
  // Bordure de retenue du sable + lignes souples
  rbBeach.addRect(hx, hz, 25.4, 36.2, 0.22);
  rbBeach.addRect(hx, hz, bw, bd, 0.14);
  rbBeach.addSegment(hx - bw / 2, hz, hx + bw / 2, hz, 0.14);
  rbBeach.addSegment(hx - bw / 2, hz - 11.5, hx + bw / 2, hz - 11.5, 0.12);
  rbBeach.addSegment(hx - bw / 2, hz + 11.5, hx + bw / 2, hz + 11.5, 0.12);
  addGoalFrame(hx, hz - bd / 2, 3.0, 2.0, 0.9, Math.PI, 0.415);
  addGoalFrame(hx, hz + bd / 2, 3.0, 2.0, 0.9, 0, 0.415);

  // Filet central de Beach Volleyball (12 m de large)
  const bvPoleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.45, 8);
  const bvPoleMat = new THREE.MeshStandardMaterial({ color: 0x353b42, roughness: 0.55 });
  const bvPoleL = new THREE.Mesh(bvPoleGeo, bvPoleMat);
  bvPoleL.position.set(hx - 6.1, 0.415 + 1.22, hz);
  const bvPoleR = new THREE.Mesh(bvPoleGeo, bvPoleMat);
  bvPoleR.position.set(hx + 6.1, 0.415 + 1.22, hz);
  const bvNet = new THREE.Mesh(new THREE.PlaneGeometry(12.0, 0.95), netMat);
  bvNet.position.set(hx, 0.415 + 1.9, hz);
  const bvTopBand = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.08, 0.06), propMat);
  bvTopBand.position.set(hx, 0.415 + 2.38, hz);
  const bvBotBand = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.06, 0.05), propMat);
  bvBotBand.position.set(hx, 0.415 + 1.44, hz);
  scene.add(bvPoleL, bvPoleR, bvNet, bvTopBand, bvBotBand);

  // 4. Basketball (tourné ~45°, extrait exact du polygone DXF)
  const basketZone = data.zones.find((z) => z.name.toUpperCase() === "BASKET");
  if (basketZone) {
    const b = makeLocalBasisFromQuad(basketZone.poly);
    const hl = b.longLen * 0.45;
    const hw = b.shortLen * 0.45;
    const p1 = b.pt(-hl, -hw);
    const p2 = b.pt(hl, -hw);
    const p3 = b.pt(hl, hw);
    const p4 = b.pt(-hl, hw);
    rbSport.addSegment(p1[0], p1[1], p2[0], p2[1], 0.2);
    rbSport.addSegment(p2[0], p2[1], p3[0], p3[1], 0.2);
    rbSport.addSegment(p3[0], p3[1], p4[0], p4[1], 0.2);
    rbSport.addSegment(p4[0], p4[1], p1[0], p1[1], 0.2);
    const m1 = b.pt(0, -hw);
    const m2 = b.pt(0, hw);
    rbSport.addSegment(m1[0], m1[1], m2[0], m2[1], 0.18);
    rbSport.addArc(b.cx, b.cz, 1.8, 0, Math.PI * 2, 24, 0.16);
    // Raquettes et arcs à 3 points
    for (const dir of [-1, 1]) {
      const k0 = b.pt(dir * hl, -2.3);
      const k1 = b.pt(dir * (hl - 5.2), -2.3);
      const k2 = b.pt(dir * (hl - 5.2), 2.3);
      const k3 = b.pt(dir * hl, 2.3);
      rbSport.addSegment(k0[0], k0[1], k1[0], k1[1], 0.16);
      rbSport.addSegment(k1[0], k1[1], k2[0], k2[1], 0.16);
      rbSport.addSegment(k2[0], k2[1], k3[0], k3[1], 0.16);
      const baseAngle = Math.atan2(-dir * b.uz, -dir * b.ux);
      const hoopPt = b.pt(dir * (hl - 1.2), 0);
      rbSport.addArc(hoopPt[0], hoopPt[1], 5.6, baseAngle - 1.22, baseAngle + 1.22, 20, 0.16);

      // Panier 3D
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.05, 8), propMat);
      post.position.set(hoopPt[0], 0.425 + 1.525, hoopPt[1]);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 1.65), propMat);
      board.position.set(hoopPt[0], 0.425 + 2.75, hoopPt[1]);
      board.rotation.y = Math.atan2(-b.uz, b.ux);
      scene.add(post, board);
    }
  }

  // 5. Tennis & Padel (tournés ~45°, extraits exacts du DXF)
  const addRacketCourt = (zoneName, isPadel) => {
    const z = data.zones.find((item) => item.name.toUpperCase() === zoneName);
    if (!z) return;
    const c = makeLocalBasisFromQuad(z.poly);
    const hl = c.longLen * 0.44;
    const hw = c.shortLen * 0.43;
    const shortAngle = Math.atan2(-c.vz, c.vx);
    const longAngle = Math.atan2(-c.uz, c.ux);
    const corners = [c.pt(-hl, -hw), c.pt(hl, -hw), c.pt(hl, hw), c.pt(-hl, hw)];
    for (let i = 0; i < 4; i++) {
      const a = corners[i];
      const b = corners[(i + 1) % 4];
      rbSport.addSegment(a[0], a[1], b[0], b[1], 0.18);
    }
    // Ligne centrale sous le filet
    const netL = c.pt(0, -hw);
    const netR = c.pt(0, hw);
    rbSport.addSegment(netL[0], netL[1], netR[0], netR[1], 0.14);

    if (!isPadel) {
      const s1 = c.pt(-hl, -hw * 0.76);
      const s2 = c.pt(hl, -hw * 0.76);
      const s3 = c.pt(-hl, hw * 0.76);
      const s4 = c.pt(hl, hw * 0.76);
      rbSport.addSegment(s1[0], s1[1], s2[0], s2[1], 0.14);
      rbSport.addSegment(s3[0], s3[1], s4[0], s4[1], 0.14);
    }
    const svL1 = c.pt(-hl * 0.56, -hw * (isPadel ? 1 : 0.76));
    const svL2 = c.pt(-hl * 0.56, hw * (isPadel ? 1 : 0.76));
    const svR1 = c.pt(hl * 0.56, -hw * (isPadel ? 1 : 0.76));
    const svR2 = c.pt(hl * 0.56, hw * (isPadel ? 1 : 0.76));
    const cs1 = c.pt(-hl * 0.56, 0);
    const cs2 = c.pt(hl * 0.56, 0);
    rbSport.addSegment(svL1[0], svL1[1], svL2[0], svL2[1], 0.14);
    rbSport.addSegment(svR1[0], svR1[1], svR2[0], svR2[1], 0.14);
    rbSport.addSegment(cs1[0], cs1[1], cs2[0], cs2[1], 0.14);

    // Filet 3D tendu à l'horizontale sur la largeur du court + bande supérieure et poteaux
    const netMeshMat = new THREE.MeshBasicMaterial({
      color: 0xe8e2d8,
      transparent: true,
      opacity: 0.72,
      side: THREE.DoubleSide,
    });
    const netMesh = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 0.92), netMeshMat);
    netMesh.position.set(c.cx, 0.905, c.cz);
    netMesh.rotation.y = shortAngle;

    const topTape = new THREE.Mesh(new THREE.BoxGeometry(hw * 2, 0.08, 0.06), propMat);
    topTape.position.set(c.cx, 1.375, c.cz);
    topTape.rotation.y = shortAngle;

    const postGeo = new THREE.CylinderGeometry(0.06, 0.06, 1.05, 8);
    const postMat = new THREE.MeshStandardMaterial({ color: 0x353b42, roughness: 0.55 });
    const postL = new THREE.Mesh(postGeo, postMat);
    postL.position.set(netL[0], 0.95, netL[1]);
    const postR = new THREE.Mesh(postGeo, postMat);
    postR.position.set(netR[0], 0.95, netR[1]);
    scene.add(netMesh, topTape, postL, postR);

    if (isPadel) {
      const glassMat = new THREE.MeshStandardMaterial({
        color: 0xdce8eb,
        transparent: true,
        opacity: 0.24,
        roughness: 0.15,
        side: THREE.DoubleSide,
      });
      for (const dir of [-1, 1]) {
        const endPt = c.pt(dir * hl, 0);
        const backWall = new THREE.Mesh(new THREE.PlaneGeometry(hw * 2, 2.8), glassMat);
        backWall.position.set(endPt[0], 1.825, endPt[1]);
        backWall.rotation.y = shortAngle;
        scene.add(backWall);

        for (const side of [-1, 1]) {
          const sidePt = c.pt(dir * hl * 0.72, side * hw);
          const sideWall = new THREE.Mesh(new THREE.PlaneGeometry(hl * 0.56, 2.8), glassMat);
          sideWall.position.set(sidePt[0], 1.825, sidePt[1]);
          sideWall.rotation.y = longAngle;
          scene.add(sideWall);
        }
      }
    }
  };

  addRacketCourt("TENNIS", false);
  addRacketCourt("PADEL", true);

  // 6. Piste périphérique rouge extérieure (pointillés blancs sur l'axe exact DXF)
  for (let x = -242; x <= 238; x += 12) {
    rbTrack.addSegment(x, -26.17, x + 5.5, -26.17, 0.16);
    rbTrack.addSegment(x, 26.23, x + 5.5, 26.23, 0.16);
  }
  for (let z = -18; z <= 14; z += 8) {
    rbTrack.addSegment(-251.2, z, -251.2, z + 4.0, 0.16);
    rbTrack.addSegment(251.2, z, 251.2, z + 4.0, 0.16);
  }
  rbTrack.addArc(-245.0, -19.97, 6.2, Math.PI, Math.PI * 1.5, 10, 0.16);
  rbTrack.addArc(245.0, -19.97, 6.2, -Math.PI * 0.5, 0, 10, 0.16);
  rbTrack.addArc(245.0, 20.03, 6.2, 0, Math.PI * 0.5, 10, 0.16);
  rbTrack.addArc(-245.0, 20.03, 6.2, Math.PI * 0.5, Math.PI, 10, 0.16);

  const lineMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  scene.add(
    new THREE.Mesh(rbSport.toGeometry(), lineMat),
    new THREE.Mesh(rbBeach.toGeometry(), lineMat),
    new THREE.Mesh(rbTrack.toGeometry(), lineMat)
  );
}

function addOutwardCopingRim(poly, innerOff, outerOff, yBot, yTop, posOut) {
  if (!poly || poly.length < 3) return;
  const n = poly.length;
  const normals = [];
  for (let i = 0; i < n; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    const dx = b[0] - a[0];
    const dz = b[1] - a[1];
    const len = Math.hypot(dx, dz) || 1;
    let nx = dz / len;
    let nz = -dx / len;
    const mx = (a[0] + b[0]) * 0.5;
    const mz = (a[1] + b[1]) * 0.5;
    if (pointInPoly2D([mx + nx * 0.08, mz + nz * 0.08], poly)) {
      nx = -nx;
      nz = -nz;
    }
    normals.push([nx, nz]);
  }

  const miterOffset = (idx, dist) => {
    const prevN = normals[(idx - 1 + n) % n];
    const currN = normals[idx];
    let sx = prevN[0] + currN[0];
    let sz = prevN[1] + currN[1];
    const sl = Math.hypot(sx, sz);
    if (sl < 0.25) {
      return [poly[idx][0] + currN[0] * dist, poly[idx][1] + currN[1] * dist];
    }
    sx /= sl;
    sz /= sl;
    const dot = Math.max(0.45, sx * currN[0] + sz * currN[1]);
    const scale = Math.min(dist / dot, dist * 1.65);
    return [poly[idx][0] + sx * scale, poly[idx][1] + sz * scale];
  };

  const pushTri = (ax, ay, az, bx, by, bz, cx, cy, cz) => {
    posOut.push(ax, ay, az, bx, by, bz, cx, cy, cz);
  };
  const pushQuad = (a, b, c, d) => {
    pushTri(a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2]);
    pushTri(a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]);
  };

  for (let i = 0; i < n; i++) {
    const j = (i + 1) % n;
    const inA = miterOffset(i, innerOff);
    const inB = miterOffset(j, innerOff);
    const outA = miterOffset(i, outerOff);
    const outB = miterOffset(j, outerOff);

    // Face supérieure (+Y)
    pushQuad(
      [inA[0], yTop, inA[1]],
      [outA[0], yTop, outA[1]],
      [outB[0], yTop, outB[1]],
      [inB[0], yTop, inB[1]]
    );
    // Paroi extérieure
    pushQuad(
      [outA[0], yBot, outA[1]],
      [outB[0], yBot, outB[1]],
      [outB[0], yTop, outB[1]],
      [outA[0], yTop, outA[1]]
    );
    // Paroi intérieure face à l'eau
    pushQuad(
      [inB[0], yBot, inB[1]],
      [inA[0], yBot, inA[1]],
      [inA[0], yTop, inA[1]],
      [inB[0], yTop, inB[1]]
    );
  }
}

export function buildWaterAndFountains(scene, data, textures, extrudePoly, mergeGeometries) {
  const waterGeoms = [];
  const rimPositions = [];
  const fountains = [];

  for (const z of data.zones) {
    if (z.kind !== "water") continue;
    try {
      // Eau extrudée strictement sur polygone DXF (top 0.480)
      waterGeoms.push(extrudePoly(z.poly, 0.12, 0.36));
      // Margelle en pierre décalée vers l'extérieur (+0.02..+0.30 m, y 0.34..0.505) : zéro face coplanaire !
      addOutwardCopingRim(z.poly, 0.02, 0.3, 0.34, 0.505, rimPositions);
      const nu = z.name.toUpperCase();
      if (nu.includes("BASSIN") || nu.includes("FONTAINE")) {
        fountains.push({
          pos: z.centroid,
          isMain: nu.includes("BASSIN"),
          area: z.area,
        });
      }
    } catch (_) {}
  }

  if (rimPositions.length) {
    const rimGeo = new THREE.BufferGeometry();
    rimGeo.setAttribute("position", new THREE.Float32BufferAttribute(rimPositions, 3));
    rimGeo.computeVertexNormals();
    const rimMesh = new THREE.Mesh(
      rimGeo,
      new THREE.MeshStandardMaterial({
        color: 0xffffff,
        roughness: 0.84,
        side: THREE.DoubleSide,
      })
    );
    rimMesh.receiveShadow = true;
    scene.add(rimMesh);
  }

  const waterTexA = textures.water;
  const waterTexB = textures.water.clone();
  waterTexB.needsUpdate = true;
  waterTexB.repeat.set(0.1, 0.1);

  const waterMat = new THREE.MeshStandardMaterial({
    color: 0xd4e6e6,
    map: waterTexA,
    bumpMap: waterTexB,
    bumpScale: 0.14,
    roughness: 0.14,
    metalness: 0.08,
  });

  const mergedWater = mergeGeometries(waterGeoms);
  if (mergedWater) {
    const wMesh = new THREE.Mesh(mergedWater, waterMat);
    wMesh.receiveShadow = true;
    scene.add(wMesh);
  }

  // Gouttelettes animées (jets d'eau paraboliques chorégraphiés), buses et éclairages subaquatiques
  const droplets = [];
  const rings = [];
  const nozzles = [];
  const underGlows = [];
  const ringGeo = new THREE.RingGeometry(0.45, 0.7, 24);
  ringGeo.rotateX(-Math.PI / 2);
  const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.58,
    side: THREE.DoubleSide,
  });

  fountains.forEach((f, fIdx) => {
    let jetSpecs = [];
    if (f.isMain) {
      // Bassin central : panache central 6,6 m + couronne interne 6 jets + couronne elliptique 10 jets
      jetSpecs.push({ ox: 0, oz: 0, h: 6.6, spread: 0.85, count: 90, phaseShift: 0 });
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        jetSpecs.push({
          ox: Math.cos(a) * 4.6,
          oz: Math.sin(a) * 4.2,
          h: 4.3,
          spread: 1.15,
          count: 38,
          phaseShift: k * 0.16,
        });
      }
      for (let k = 0; k < 10; k++) {
        const a = (k / 10) * Math.PI * 2 + 0.15;
        jetSpecs.push({
          ox: Math.cos(a) * 11.4,
          oz: Math.sin(a) * 5.8,
          h: 3.0,
          spread: 1.05,
          count: 26,
          phaseShift: k * 0.1,
        });
      }
      for (let r = 0; r < 4; r++) {
        const rMesh = new THREE.Mesh(ringGeo, ringMat.clone());
        rMesh.position.set(f.pos[0] + (r - 1.5) * 4.8, 0.492, f.pos[1]);
        rMesh.userData = { phase: r * 0.25, maxScale: r === 1 || r === 2 ? 7.8 : 5.0 };
        scene.add(rMesh);
        rings.push(rMesh);
      }
    } else if (f.area > 55) {
      // Grandes fontaines jardins : 1 jet central + 4 jets latéraux
      jetSpecs.push({ ox: 0, oz: 0, h: 3.6, spread: 0.72, count: 34, phaseShift: 0 });
      for (let k = 0; k < 4; k++) {
        const a = (k / 4) * Math.PI * 2 + Math.PI * 0.25;
        jetSpecs.push({
          ox: Math.cos(a) * 2.6,
          oz: Math.sin(a) * 2.6,
          h: 2.3,
          spread: 0.65,
          count: 20,
          phaseShift: k * 0.2,
        });
      }
      const rMesh = new THREE.Mesh(ringGeo, ringMat.clone());
      rMesh.position.set(f.pos[0], 0.492, f.pos[1]);
      rMesh.userData = { phase: fIdx * 0.3, maxScale: 4.2 };
      scene.add(rMesh);
      rings.push(rMesh);
    } else if (f.area > 15) {
      // Fontaines cintrées amphithéâtre : rampe chorégraphiée de 5 jets
      [-5.6, -2.8, 0, 2.8, 5.6].forEach((ox, idx) => {
        jetSpecs.push({
          ox,
          oz: (idx % 2 === 0 ? -0.35 : 0.35),
          h: 2.5 + (idx === 2 ? 0.8 : 0),
          spread: 0.55,
          count: 20,
          phaseShift: idx * 0.18,
        });
      });
      const rMesh = new THREE.Mesh(ringGeo, ringMat.clone());
      rMesh.position.set(f.pos[0], 0.492, f.pos[1]);
      rMesh.userData = { phase: fIdx * 0.35, maxScale: 3.8 };
      scene.add(rMesh);
      rings.push(rMesh);
    } else {
      // Fontaine d'accueil : 3 jets en gerbe
      [-1.1, 0, 1.1].forEach((ox, idx) => {
        jetSpecs.push({
          ox,
          oz: 0,
          h: idx === 1 ? 2.4 : 1.7,
          spread: 0.42,
          count: 16,
          phaseShift: idx * 0.2,
        });
      });
    }

    for (const js of jetSpecs) {
      const jx = f.pos[0] + js.ox;
      const jz = f.pos[1] + js.oz;
      nozzles.push([jx, jz, js.h]);
      underGlows.push([jx, jz, js.h > 4 ? 7.5 : 4.2]);
      const choreoPhase = js.phaseShift * Math.PI * 2 + fIdx * 0.65;
      for (let i = 0; i < js.count; i++) {
        const angle = (i / js.count) * Math.PI * 2 * 4.3 + js.phaseShift;
        droplets.push({
          bx: jx,
          bz: jz,
          h: js.h,
          vx: Math.cos(angle) * js.spread * (0.3 + ((i * 17) % 10) * 0.07),
          vz: Math.sin(angle) * js.spread * (0.3 + ((i * 13) % 10) * 0.07),
          phase: i / js.count + js.phaseShift + fIdx * 0.11,
          choreoPhase,
          speed: 0.72 + ((i * 7) % 5) * 0.07,
        });
      }
    }
  });

  // Buses visibles + halos subaquatiques doux en mode nuit
  if (nozzles.length) {
    const nozGeo = new THREE.CylinderGeometry(0.18, 0.28, 0.32, 8);
    const nozMat = new THREE.MeshStandardMaterial({ color: 0xdad5cc, roughness: 0.4, metalness: 0.45 });
    const nozInst = new THREE.InstancedMesh(nozGeo, nozMat, nozzles.length);
    const d = new THREE.Object3D();
    nozzles.forEach(([x, z], idx) => {
      d.position.set(x, 0.495, z);
      d.updateMatrix();
      nozInst.setMatrixAt(idx, d.matrix);
    });
    scene.add(nozInst);
  }

  const underGlowMat = new THREE.MeshBasicMaterial({
    map: textures.lightPool,
    color: 0xa6e8f0,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  if (underGlows.length) {
    const ugGeo = new THREE.PlaneGeometry(1, 1);
    ugGeo.rotateX(-Math.PI / 2);
    const ugInst = new THREE.InstancedMesh(ugGeo, underGlowMat, underGlows.length);
    const d = new THREE.Object3D();
    underGlows.forEach(([x, z, sz], idx) => {
      d.position.set(x, 0.488, z);
      d.scale.set(sz, 1, sz);
      d.updateMatrix();
      ugInst.setMatrixAt(idx, d.matrix);
    });
    scene.add(ugInst);
  }

  // Sprite doux pour particules d'eau
  const spCanvas = document.createElement("canvas");
  spCanvas.width = 32;
  spCanvas.height = 32;
  const spCtx = spCanvas.getContext("2d");
  const spGrad = spCtx.createRadialGradient(16, 16, 1, 16, 16, 15);
  spGrad.addColorStop(0, "rgba(255, 255, 255, 0.96)");
  spGrad.addColorStop(0.55, "rgba(220, 244, 248, 0.7)");
  spGrad.addColorStop(1, "rgba(220, 244, 248, 0)");
  spCtx.fillStyle = spGrad;
  spCtx.fillRect(0, 0, 32, 32);

  const ptsPos = new Float32Array(droplets.length * 3);
  const ptsGeo = new THREE.BufferGeometry();
  ptsGeo.setAttribute("position", new THREE.BufferAttribute(ptsPos, 3));
  const ptsMat = new THREE.PointsMaterial({
    size: 0.85,
    map: new THREE.CanvasTexture(spCanvas),
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    color: 0xf4fafc,
  });
  const pointsMesh = new THREE.Points(ptsGeo, ptsMat);
  scene.add(pointsMesh);

  const dayWaterCol = new THREE.Color(0xd4e6e6);
  const nightWaterCol = new THREE.Color(0x284352);

  return {
    updateWater(dt, now, nightFactor) {
      waterTexA.offset.x = (now * 0.000018) % 1;
      waterTexA.offset.y = (now * 0.000012) % 1;
      waterTexB.offset.x = -(now * 0.000014) % 1;
      waterTexB.offset.y = (now * 0.000021) % 1;

      const tSec = now * 0.001;
      waterMat.color.lerpColors(dayWaterCol, nightWaterCol, nightFactor);
      ptsMat.color.setHex(nightFactor > 0.4 ? 0xffe4b8 : 0xf4fafc);
      underGlowMat.opacity = nightFactor * (0.44 + 0.06 * Math.sin(tSec * 2.1));

      const arr = ptsGeo.attributes.position.array;
      for (let i = 0; i < droplets.length; i++) {
        const d = droplets[i];
        const cycle = (tSec * d.speed + d.phase) % 1;
        const hMod = d.h * (0.86 + 0.16 * Math.sin(tSec * 1.45 + d.choreoPhase));
        const arcY = 0.51 + 4 * hMod * cycle * (1 - cycle);
        arr[i * 3] = d.bx + d.vx * cycle;
        arr[i * 3 + 1] = arcY;
        arr[i * 3 + 2] = d.bz + d.vz * cycle;
      }
      ptsGeo.attributes.position.needsUpdate = true;

      for (const r of rings) {
        const c = (tSec * 0.42 + r.userData.phase) % 1;
        const sc = 0.6 + c * r.userData.maxScale;
        r.scale.set(sc, 1, sc);
        r.material.opacity = (1 - c) * (0.48 + nightFactor * 0.16);
      }
    },
  };
}

function inZone2D(pt, z) {
  if (!pointInPoly2D(pt, z.poly)) return false;
  if (z.holes && z.holes.some((h) => pointInPoly2D(pt, h))) return false;
  return true;
}

export function buildVegetation(scene, data, textures, windUniforms) {
  const rng = makeSeeded(202611);

  const forbiddenInnerZones = data.zones.filter((z) => {
    const u = z.name.toUpperCase();
    return (
      z.kind === "water" ||
      z.kind === "sport" ||
      z.kind === "play" ||
      z.kind === "track" ||
      z.kind === "building" ||
      z.kind === "gradin" ||
      u.includes("BEACH") ||
      u.includes("SABLE")
    );
  });
  const isClearInner = (x, z) =>
    !forbiddenInnerZones.some((fz) => inZone2D([x, z], fz));

  const roadOuter = data.roads?.[0] || null;
  const roadHoles = data.roads?.slice(1) || [];
  const isOnRoad = (x, z) => {
    if (!roadOuter || !pointInPoly2D([x, z], roadOuter)) return false;
    return !roadHoles.some((h) => pointInPoly2D([x, z], h));
  };

  const cantines = data.parkingDetails?.cantines || [];
  const nearBuildings = (data.buildings || []).filter((b) => {
    const p = b.poly?.[0];
    return p && Math.abs(p[0]) < 365 && Math.abs(p[1]) < 160;
  });

  const isClearOuter = (x, z, bldMargin = 2.6) => {
    if (isOnRoad(x, z)) return false;
    if (cantines.some((c) => pointNearPoly2D([x, z], c, 2.0))) return false;
    if (nearBuildings.some((b) => pointNearPoly2D([x, z], b.poly, bldMargin))) return false;
    return true;
  };

  // 1. Arbres intérieurs, périphériques autour du jardin et îlots voisins
  const treePositions = [];
  const addTreeIfClear = (x, z, sc, groundY, minDist = 4.6) => {
    if (treePositions.some(([tx, tz]) => Math.hypot(tx - x, tz - z) < minDist)) return false;
    treePositions.push([x, z, sc, groundY]);
    return true;
  };

  // 1a. Jardins & pelouses intérieurs
  const treeZones = data.zones.filter((z) => {
    const n = z.name.toUpperCase();
    return z.area > 35 && (n.includes("JARDIN PLANT") || n.includes("PELOUSE"));
  });
  for (const gz of treeZones) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of gz.poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const targetCount = Math.min(18, Math.max(2, Math.round(gz.area / 80)));
    let added = 0;
    for (let tries = 0; tries < targetCount * 8 && added < targetCount; tries++) {
      const px = minX + rng() * (maxX - minX);
      const pz = minZ + rng() * (maxZ - minZ);
      if (!pointInPoly2D([px, pz], gz.poly)) continue;
      if (!isClearInner(px, pz)) continue;
      if (addTreeIfClear(px, pz, 0.8 + rng() * 0.55, 0.42, 4.8)) added++;
    }
  }

  // 1b. Îlots du parking Nord
  for (const med of data.parkingDetails?.medians || []) {
    let sx = 0, sz = 0;
    for (const [x, z] of med) {
      sx += x;
      sz += z;
    }
    const cx = sx / med.length;
    const cz = sz / med.length;
    addTreeIfClear(cx - 4.2, cz, 0.84, 0.42, 4.0);
    addTreeIfClear(cx + 4.2, cz, 0.84, 0.42, 4.0);
  }

  // 1c. Ceinture périphérique tout autour du jardin (Nord, Sud, Est, Ouest & avenues riveraines)
  for (let x = -246; x <= 246; x += 13.5) {
    // Dégager l'axe du parvis d'entrée Nord & arrière Théâtre Sud
    if (Math.abs(x) < 15.5) continue;
    // Bordure Nord extérieure à la piste rouge (BANDE DE GAZON Nord)
    if (isClearOuter(x, -28.05, 2.2) && isClearInner(x, -28.05)) {
      addTreeIfClear(x + (rng() - 0.5) * 0.6, -28.05, 0.88 + rng() * 0.34, 0.36, 7.5);
    }
    // Bordure Sud extérieure à la piste rouge (trottoir Sud longeant le parc)
    if (isClearOuter(x, 28.85, 2.2) && isClearInner(x, 28.85)) {
      addTreeIfClear(x + (rng() - 0.5) * 0.6, 28.85, 0.88 + rng() * 0.36, 0.14, 7.5);
    }
  }

  // Alignements de boulevards entourant le parc et le parking
  for (let x = -242; x <= 296; x += 16.5) {
    if (Math.abs(x) < 16) continue;
    // Entre avenue Nord et parking Nord
    if (isClearOuter(x, -42.0, 2.4)) {
      addTreeIfClear(x, -42.0, 0.92 + rng() * 0.32, 0.12, 7.5);
    }
    // Bordure Nord au-dessus des 43 cantines
    if (x >= -56 && isClearOuter(x, -65.2, 2.4)) {
      addTreeIfClear(x, -65.2, 0.9 + rng() * 0.32, 0.12, 8.0);
    }
    // Promenade ombragée côté Sud de l'avenue Sud
    if (x <= 242 && isClearOuter(x, 34.8, 2.4)) {
      addTreeIfClear(x, 34.8, 0.86 + rng() * 0.32, 0.12, 8.0);
    }
  }

  // Flancs Ouest et Est autour des extrémités du jardin
  for (let z = -72; z <= 72; z += 14.0) {
    for (const wx of [-255.2, -270.0]) {
      if (isClearOuter(wx, z, 2.4)) {
        addTreeIfClear(wx, z, 0.88 + rng() * 0.3, 0.12, 7.5);
      }
    }
    for (const ex of [255.8, 273.5]) {
      if (isClearOuter(ex, z, 2.4)) {
        addTreeIfClear(ex, z, 0.88 + rng() * 0.3, 0.12, 7.5);
      }
    }
  }

  // 1d. ~90 arbres urbains dans les cours et abords des îlots voisins de Thiès
  let urbanAdded = 0;
  for (let tries = 0; tries < 950 && urbanAdded < 90; tries++) {
    const ux = (rng() - 0.5) * 660;
    const uz = (rng() - 0.5) * 250;
    // Hors emprise parc + piste + parking
    if (ux > -256 && ux < 256 && uz > -31 && uz < 31) continue;
    if (ux > -68 && ux < 328 && uz > -66 && uz < -41) continue;
    if (!isClearOuter(ux, uz, 2.8)) continue;
    if (addTreeIfClear(ux, uz, 0.78 + rng() * 0.52, 0.1, 8.2)) urbanAdded++;
  }

  if (treePositions.length) {
    const trunkGeo = new THREE.CylinderGeometry(0.18, 0.25, 2.2, 6);
    const trunkMat = new THREE.MeshStandardMaterial({ color: 0xc5b8a4, roughness: 0.94 });
    const crownGeo = new THREE.IcosahedronGeometry(1.9, 1);
    const crownMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      map: textures.grass,
      roughness: 0.88,
    });
    applyWindShader(crownMat, windUniforms, 0.24);

    const trunks = new THREE.InstancedMesh(trunkGeo, trunkMat, treePositions.length);
    const crowns = new THREE.InstancedMesh(crownGeo, crownMat, treePositions.length);
    trunks.castShadow = true;
    crowns.castShadow = true;
    crowns.receiveShadow = true;

    const treePalette = [
      new THREE.Color(0xa6b58f), // sauge claire
      new THREE.Color(0x93a67a), // olivier
      new THREE.Color(0xb2bf99), // eucalyptus doré
      new THREE.Color(0x83966d), // acacia doux
      new THREE.Color(0x9ead86), // vert jardin
    ];

    const dummy = new THREE.Object3D();
    treePositions.forEach(([tx, tz, sc, gy], idx) => {
      dummy.position.set(tx, gy + 1.1 * sc, tz);
      dummy.scale.set(sc, sc, sc);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      trunks.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(tx, gy + 3.1 * sc, tz);
      dummy.scale.set(sc * 1.06, sc * 0.92, sc * 1.06);
      dummy.updateMatrix();
      crowns.setMatrixAt(idx, dummy.matrix);
      crowns.setColorAt(idx, treePalette[idx % treePalette.length]);
    });
    crowns.instanceColor.needsUpdate = true;
    scene.add(trunks, crowns);
  }

  // 2. Buissons (~340) dans les jardins, bordures et parterres
  const bushPositions = [];
  const bushZones = data.zones.filter((z) => z.kind === "green" && z.area > 12 && z.area < 4000);
  for (const bz of bushZones) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of bz.poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const target = Math.min(14, Math.max(2, Math.round(bz.area / 36)));
    let added = 0;
    for (let tries = 0; tries < target * 7 && added < target; tries++) {
      const px = minX + rng() * (maxX - minX);
      const pz = minZ + rng() * (maxZ - minZ);
      if (!pointInPoly2D([px, pz], bz.poly)) continue;
      if (!isClearInner(px, pz)) continue;
      bushPositions.push([px, pz, 0.55 + rng() * 0.6]);
      added++;
    }
  }

  if (bushPositions.length) {
    const bushGeo = new THREE.DodecahedronGeometry(0.75, 1);
    const bushMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.9 });
    applyWindShader(bushMat, windUniforms, 0.18);

    const bushInst = new THREE.InstancedMesh(bushGeo, bushMat, bushPositions.length);
    bushInst.castShadow = true;
    bushInst.receiveShadow = true;
    const bushPalette = [
      new THREE.Color(0x90a674),
      new THREE.Color(0x7f9665),
      new THREE.Color(0xa0b584),
    ];
    const dummy = new THREE.Object3D();
    bushPositions.forEach(([bx, bz, sc], idx) => {
      dummy.position.set(bx, 0.44 + 0.35 * sc, bz);
      dummy.scale.set(sc * 1.25, sc * 0.72, sc * 1.15);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      bushInst.setMatrixAt(idx, dummy.matrix);
      bushInst.setColorAt(idx, bushPalette[idx % bushPalette.length]);
    });
    bushInst.instanceColor.needsUpdate = true;
    scene.add(bushInst);
  }

  // 3. Fleurs (~460 bouquets sobres) dans les PARTERRE FLEURI et massifs
  const flowerPositions = [];
  const flowerZones = data.zones.filter((z) => {
    const n = z.name.toUpperCase();
    return n.includes("PARTERRE") || n.includes("BORDURE PLANT");
  });
  for (const fz of flowerZones) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of fz.poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    const target = Math.min(28, Math.max(6, Math.round(fz.area / 4.2)));
    let added = 0;
    for (let tries = 0; tries < target * 8 && added < target; tries++) {
      const px = minX + rng() * (maxX - minX);
      const pz = minZ + rng() * (maxZ - minZ);
      if (!pointInPoly2D([px, pz], fz.poly)) continue;
      if (!isClearInner(px, pz)) continue;
      flowerPositions.push([px, pz, 0.7 + rng() * 0.55]);
      added++;
    }
  }

  if (flowerPositions.length) {
    const flGeo = new THREE.IcosahedronGeometry(0.28, 0);
    const flMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
    applyWindShader(flMat, windUniforms, 0.14);

    const flInst = new THREE.InstancedMesh(flGeo, flMat, flowerPositions.length);
    const flColors = [
      new THREE.Color(0xf2e7cf), // crème
      new THREE.Color(0xe5c1a9), // blush beige
      new THREE.Color(0xd8a35a), // ocre doux
      new THREE.Color(0xc97b68), // terracotta pastel
      new THREE.Color(0xcfc0d6), // lavande douce
    ];
    const dummy = new THREE.Object3D();
    flowerPositions.forEach(([fx, fz, sc], idx) => {
      dummy.position.set(fx, 0.5 + 0.18 * sc, fz);
      dummy.scale.set(sc * 1.1, sc * 0.8, sc * 1.1);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      flInst.setMatrixAt(idx, dummy.matrix);
      flInst.setColorAt(idx, flColors[idx % flColors.length]);
    });
    flInst.instanceColor.needsUpdate = true;
    scene.add(flInst);
  }

  return { treeCount: treePositions.length };
}

export function buildDayAtmosphere(scene, textures) {
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({
    map: textures.cloud,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  // Ombre nuageuse très douce portée au sol + nuages volumétriques légers autour du parc (sans masquer le cœur du jardin)
  const cloudShadowMat = new THREE.MeshBasicMaterial({
    map: textures.cloud,
    color: 0x8f8575,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
  });

  const puffBodyMat = new THREE.MeshStandardMaterial({
    color: 0xffffff,
    emissive: 0xeae3d7,
    emissiveIntensity: 0.28,
    roughness: 0.96,
    metalness: 0,
    transparent: true,
    opacity: 0.46,
    depthWrite: false,
  });

  const puffUnderMat = new THREE.MeshStandardMaterial({
    color: 0xd8cfc1,
    roughness: 0.98,
    metalness: 0,
    transparent: true,
    opacity: 0.28,
    depthWrite: false,
  });

  const sphereGeo = new THREE.IcosahedronGeometry(1, 2);

  const cloudSpecs = [
    [-195, 52, -72, 112, 58, 2.0, 0.2],
    [-95, 56, -84, 124, 62, 1.7, 1.1],
    [-12, 58, -94, 118, 60, 2.2, 2.3],
    [82, 54, -76, 126, 64, 1.6, 3.0],
    [185, 52, -68, 114, 58, 2.1, 4.1],
    [-255, 62, -128, 136, 70, 1.5, 5.2],
    [-45, 64, -142, 142, 72, 1.9, 0.8],
    [135, 61, -124, 134, 68, 1.8, 1.9],
    [-165, 48, 56, 102, 52, 2.1, 2.7],
    [-25, 50, 74, 110, 56, 1.7, 3.8],
    [105, 48, 58, 106, 54, 2.0, 4.6],
    [225, 52, 68, 116, 60, 1.8, 5.5],
  ];

  const puffOffsets = [
    [0, 0, 0, 0.9, 0.28, 0.56],
    [-0.26, -0.03, 0.06, 0.68, 0.24, 0.48],
    [0.28, -0.02, -0.05, 0.7, 0.25, 0.48],
    [-0.12, 0.06, -0.08, 0.58, 0.26, 0.44],
    [0.14, 0.05, 0.09, 0.56, 0.25, 0.42],
  ];

  for (const [x, y, z, w, h, speed, phase] of cloudSpecs) {
    const group = new THREE.Group();
    group.position.set(x, y, z);

    // Nappe vaporeuse texturée principale
    const billGeo = new THREE.PlaneGeometry(w, h);
    const billMesh = new THREE.Mesh(billGeo, cloudMat);
    billMesh.rotation.x = -Math.PI / 2;
    group.add(billMesh);

    // Volumes 3D doux (cumulus aplatis + base ombrée beige)
    for (const [ox, oy, oz, sx, sy, sz] of puffOffsets) {
      const pTop = new THREE.Mesh(sphereGeo, puffBodyMat);
      pTop.position.set(ox * w * 0.52, oy * 11 + 0.9, oz * h * 0.48);
      pTop.scale.set(w * 0.2 * sx, 9 * sy, h * 0.24 * sz);
      group.add(pTop);

      const pBot = new THREE.Mesh(sphereGeo, puffUnderMat);
      pBot.position.set(ox * w * 0.52, oy * 8 - 0.5, oz * h * 0.48);
      pBot.scale.set(w * 0.21 * sx, 5 * sy, h * 0.25 * sz);
      group.add(pBot);
    }

    // Ombre portée très légère au sol qui glisse avec le nuage
    const shadowMesh = new THREE.Mesh(new THREE.PlaneGeometry(w * 0.8, h * 0.8), cloudShadowMat);
    shadowMesh.rotation.x = -Math.PI / 2;
    shadowMesh.position.set(x + 14, 0.52, z + 10);
    scene.add(group, shadowMesh);

    clouds.push({ mesh: group, shadowMesh, baseY: y, speed, phase });
  }

  // Oiseaux discrets planant en petites formations de jour
  const birdGroup = new THREE.Group();
  const birdMat = new THREE.MeshBasicMaterial({
    color: 0x4b443b,
    transparent: true,
    opacity: 0.85,
    side: THREE.DoubleSide,
  });
  const wingGeo = new THREE.BufferGeometry();
  wingGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [
        0, 0, 0.14,
        0.58, 0.04, -0.06,
        0, 0, -0.16,
      ],
      3
    )
  );
  const bodyGeo = new THREE.ConeGeometry(0.08, 0.42, 5);
  bodyGeo.rotateX(Math.PI / 2);

  const birds = [];
  const flockDefs = [
    { cx: -75, cz: -10, y: 26, rx: 68, rz: 24, speed: 0.14, count: 4 },
    { cx: 45, cz: 4, y: 31, rx: 78, rz: 28, speed: -0.11, count: 3 },
    { cx: 155, cz: -8, y: 28, rx: 56, rz: 22, speed: 0.16, count: 3 },
  ];

  flockDefs.forEach((fl, fIdx) => {
    for (let i = 0; i < fl.count; i++) {
      const b = new THREE.Group();
      const body = new THREE.Mesh(bodyGeo, birdMat);
      const wingL = new THREE.Mesh(wingGeo, birdMat);
      wingL.scale.x = -1;
      const wingR = new THREE.Mesh(wingGeo, birdMat);
      b.add(body, wingL, wingR);
      birdGroup.add(b);
      birds.push({
        group: b,
        wingL,
        wingR,
        cx: fl.cx + i * 3.5,
        cz: fl.cz + (i % 2 === 0 ? -1.8 : 1.8),
        y: fl.y + i * 1.4,
        rx: fl.rx,
        rz: fl.rz,
        speed: fl.speed,
        angle: fIdx * 2.1 + i * 0.24,
        flapPhase: i * 1.3 + fIdx,
      });
    }
  });
  scene.add(birdGroup);

  // Papillons pastel voletant le jour au-dessus des parterres fleuris et jardins
  const butterflyGroup = new THREE.Group();
  const bfMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.9,
    side: THREE.DoubleSide,
  });
  const bfWingGeo = new THREE.BufferGeometry();
  bfWingGeo.setAttribute(
    "position",
    new THREE.Float32BufferAttribute(
      [0, 0, 0.08, 0.22, 0.02, -0.05, 0, 0, -0.1],
      3
    )
  );
  const bfPalette = [0xf2e7cf, 0xe5b899, 0xd8a35a, 0xcfcfdc, 0xf6f0e4];
  const butterflies = [];
  const bfRng = makeSeeded(9012);
  const bfAnchors = [
    [-192, 0],
    [-98, -8],
    [-50, 12],
    [104, -10],
    [128, 10],
    [164, -10],
    [188, 10],
    [224, 12],
  ];
  for (let i = 0; i < 24; i++) {
    const anc = bfAnchors[i % bfAnchors.length];
    const g = new THREE.Group();
    const wMat = bfMat.clone();
    wMat.color.setHex(bfPalette[i % bfPalette.length]);
    const wL = new THREE.Mesh(bfWingGeo, wMat);
    wL.scale.x = -1;
    const wR = new THREE.Mesh(bfWingGeo, wMat);
    g.add(wL, wR);
    butterflyGroup.add(g);
    butterflies.push({
      group: g,
      wL,
      wR,
      mat: wMat,
      cx: anc[0] + (bfRng() - 0.5) * 14,
      cz: anc[1] + (bfRng() - 0.5) * 12,
      yBase: 1.45 + bfRng() * 1.4,
      rx: 2.2 + bfRng() * 3.8,
      rz: 1.8 + bfRng() * 3.2,
      speed: (0.45 + bfRng() * 0.45) * (i % 2 === 0 ? 1 : -1),
      angle: bfRng() * Math.PI * 2,
      phase: bfRng() * Math.PI * 2,
    });
  }
  scene.add(butterflyGroup);

  return {
    birdCount: birds.length,
    cloudCount: clouds.length,
    butterflyCount: butterflies.length,
    update(dt, now, nightFactor) {
      const dayFactor = Math.max(0, 1 - nightFactor);
      const tSec = now * 0.001;
      cloudMat.opacity = dayFactor * 0.72;
      puffBodyMat.opacity = dayFactor * 0.46;
      puffUnderMat.opacity = dayFactor * 0.28;
      cloudShadowMat.opacity = dayFactor * 0.1;
      const showClouds = dayFactor > 0.02;
      for (const c of clouds) {
        c.mesh.visible = showClouds;
        c.shadowMesh.visible = showClouds;
        if (!showClouds) continue;
        c.mesh.position.x += c.speed * dt;
        if (c.mesh.position.x > 360) c.mesh.position.x = -360;
        c.mesh.position.y = c.baseY + Math.sin(tSec * 0.35 + c.phase) * 0.9;
        c.shadowMesh.position.x = c.mesh.position.x + 14;
      }

      const birdAlpha = THREE.MathUtils.clamp(1 - nightFactor * 1.6, 0, 0.85);
      birdMat.opacity = birdAlpha;
      birdGroup.visible = birdAlpha > 0.02;
      if (birdGroup.visible) {
        const t = now * 0.001;
        for (const b of birds) {
          b.angle += b.speed * dt;
          const x = b.cx + Math.cos(b.angle) * b.rx;
          const z = b.cz + Math.sin(b.angle) * b.rz;
          const vx = -Math.sin(b.angle) * b.rx * b.speed;
          const vz = Math.cos(b.angle) * b.rz * b.speed;

          b.group.position.set(x, b.y + Math.sin(t * 0.9 + b.flapPhase) * 1.1, z);
          b.group.rotation.y = Math.atan2(vx, vz);

          const glideMod = Math.sin(t * 0.6 + b.flapPhase) > 0.35 ? 0.15 : 1.0;
          const flap = Math.sin(t * 7.2 + b.flapPhase) * 0.48 * glideMod + 0.12;
          b.wingL.rotation.z = -flap;
          b.wingR.rotation.z = flap;
        }
      }

      const bfAlpha = THREE.MathUtils.clamp(1 - nightFactor * 1.8, 0, 0.92);
      butterflyGroup.visible = bfAlpha > 0.02;
      if (butterflyGroup.visible) {
        const t = now * 0.001;
        for (const bf of butterflies) {
          bf.angle += bf.speed * dt;
          const x = bf.cx + Math.cos(bf.angle) * bf.rx;
          const z = bf.cz + Math.sin(bf.angle * 1.3) * bf.rz;
          const vx = -Math.sin(bf.angle) * bf.rx * bf.speed;
          const vz = 1.3 * Math.cos(bf.angle * 1.3) * bf.rz * bf.speed;
          bf.group.position.set(x, bf.yBase + Math.sin(t * 2.4 + bf.phase) * 0.32, z);
          bf.group.rotation.y = Math.atan2(vx, vz);
          const flap = Math.sin(t * 14.5 + bf.phase) * 0.72 + 0.15;
          bf.wL.rotation.z = -flap;
          bf.wR.rotation.z = flap;
          bf.mat.opacity = bfAlpha;
        }
      }
    },
  };
}
