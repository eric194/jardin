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
  // Trois strates dédiées (terrains hauts 0.425 -> 0.432, terrains enterrés Basket & Beach -0.35 -> -0.338, piste/sprint 0.380 -> 0.389)
  const rbSport = new RibbonBuilder(0.432);
  const rbBeach = new RibbonBuilder(-0.338);
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
    const depthBarGeo = new THREE.CylinderGeometry(0.045, 0.045, depth, 6);
    depthBarGeo.rotateX(Math.PI / 2);
    const rearPostGeo = new THREE.CylinderGeometry(0.045, 0.045, height, 6);

    const pL = new THREE.Mesh(postGeo, propMat);
    pL.position.set(-width / 2, height / 2, 0);
    const pR = new THREE.Mesh(postGeo, propMat);
    pR.position.set(width / 2, height / 2, 0);
    const top = new THREE.Mesh(barGeo, propMat);
    top.position.set(0, height, 0);

    // Cage arrière complète reliant la barre frontale aux filets extérieurs
    for (const sx of [-width / 2, width / 2]) {
      for (const sy of [0.04, height]) {
        const dBar = new THREE.Mesh(depthBarGeo, propMat);
        dBar.position.set(sx, sy, -depth / 2);
        g.add(dBar);
      }
      const rPost = new THREE.Mesh(rearPostGeo, propMat);
      rPost.position.set(sx, height / 2, -depth);
      g.add(rPost);
    }
    const rearTop = new THREE.Mesh(barGeo, propMat);
    rearTop.position.set(0, height, -depth);
    rearTop.scale.set(1, 0.72, 0.72);
    const rearBot = new THREE.Mesh(barGeo, propMat);
    rearBot.position.set(0, 0.04, -depth);
    rearBot.scale.set(1, 0.72, 0.72);
    g.add(rearTop, rearBot);

    const netBack = new THREE.Mesh(new THREE.PlaneGeometry(width, height), netMat);
    netBack.position.set(0, height / 2, -depth);
    const netTop = new THREE.Mesh(new THREE.PlaneGeometry(width, depth), netMat);
    netTop.rotation.x = -Math.PI / 2;
    netTop.position.set(0, height, -depth / 2);
    const netL = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), netMat);
    netL.rotation.y = Math.PI / 2;
    netL.position.set(-width / 2, height / 2, -depth / 2);
    const netR = new THREE.Mesh(new THREE.PlaneGeometry(depth, height), netMat);
    netR.rotation.y = Math.PI / 2;
    netR.position.set(width / 2, height / 2, -depth / 2);

    g.add(pL, pR, top, netBack, netTop, netL, netR);
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
  addGoalFrame(fx - 24.0, fz, 5.2, 2.1, 1.3, Math.PI / 2, 0.425);
  addGoalFrame(fx + 24.0, fz, 5.2, 2.1, 1.3, -Math.PI / 2, 0.425);

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

  // 3. Arène en sable fin enterrée (-0.35 m, sans gradin interne) : Beach Soccer / Beach Handball / Beach Volleyball
  const hx = -124.0;
  const hz = 0.85;
  const bw = 20.0;
  const bd = 33.6;
  const sunkenY = -0.35;
  // Bordure de retenue du sable + lignes souples pleine largeur
  rbBeach.addRect(hx, hz, 24.6, 35.4, 0.2);
  rbBeach.addRect(hx, hz, bw, bd, 0.14);
  rbBeach.addSegment(hx - bw / 2, hz, hx + bw / 2, hz, 0.14);
  rbBeach.addSegment(hx - bw / 2, hz - 11.2, hx + bw / 2, hz - 11.2, 0.12);
  rbBeach.addSegment(hx - bw / 2, hz + 11.2, hx + bw / 2, hz + 11.2, 0.12);
  addGoalFrame(hx, hz - bd / 2, 3.0, 2.0, 0.9, 0, sunkenY);
  addGoalFrame(hx, hz + bd / 2, 3.0, 2.0, 0.9, Math.PI, sunkenY);

  // Filet central de Beach Volleyball (12 m de large, posé à -0.35 m)
  const bvPoleGeo = new THREE.CylinderGeometry(0.06, 0.06, 2.45, 8);
  const bvPoleMat = new THREE.MeshStandardMaterial({ color: 0x353b42, roughness: 0.55 });
  const bvPoleL = new THREE.Mesh(bvPoleGeo, bvPoleMat);
  bvPoleL.position.set(hx - 6.1, sunkenY + 1.22, hz);
  const bvPoleR = new THREE.Mesh(bvPoleGeo, bvPoleMat);
  bvPoleR.position.set(hx + 6.1, sunkenY + 1.22, hz);
  const bvNet = new THREE.Mesh(new THREE.PlaneGeometry(12.0, 0.95), netMat);
  bvNet.position.set(hx, sunkenY + 1.9, hz);
  const bvTopBand = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.08, 0.06), propMat);
  bvTopBand.position.set(hx, sunkenY + 2.38, hz);
  const bvBotBand = new THREE.Mesh(new THREE.BoxGeometry(12.0, 0.06, 0.05), propMat);
  bvBotBand.position.set(hx, sunkenY + 1.44, hz);
  scene.add(bvPoleL, bvPoleR, bvNet, bvTopBand, bvBotBand);

  // 4. Basketball enterré (-0.35 m, sans gradin interne, pleine largeur)
  const basketZone = data.zones.find((z) => z.name.toUpperCase() === "BASKET");
  if (basketZone) {
    const b = makeLocalBasisFromQuad(basketZone.poly);
    const hl = b.longLen * 0.44;
    const hw = b.shortLen * 0.44;
    const courtAngle = Math.atan2(-b.uz, b.ux);

    // Dalle centrale bicolore en résine acrylique pro (parquet/ocre intérieur + raquettes terracotta + cercle central)
    const courtFloorMat = new THREE.MeshStandardMaterial({
      color: 0xd29554,
      roughness: 0.78,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const keyPaintMat = new THREE.MeshStandardMaterial({
      color: 0xb84734,
      roughness: 0.76,
      polygonOffset: true,
      polygonOffsetFactor: -2,
      polygonOffsetUnits: -2,
    });
    const innerFloor = new THREE.Mesh(new THREE.PlaneGeometry(hl * 2, hw * 2), courtFloorMat);
    innerFloor.rotation.x = -Math.PI / 2;
    innerFloor.rotation.z = courtAngle;
    innerFloor.position.set(b.cx, sunkenY + 0.005, b.cz);
    innerFloor.receiveShadow = true;

    const centerCirclePaint = new THREE.Mesh(new THREE.CircleGeometry(1.78, 28), keyPaintMat);
    centerCirclePaint.rotation.x = -Math.PI / 2;
    centerCirclePaint.position.set(b.cx, sunkenY + 0.008, b.cz);
    scene.add(innerFloor, centerCirclePaint);

    for (const dir of [-1, 1]) {
      const kCenter = b.pt(dir * (hl - 2.55), 0);
      const keyMesh = new THREE.Mesh(new THREE.PlaneGeometry(5.1, 4.5), keyPaintMat);
      keyMesh.rotation.x = -Math.PI / 2;
      keyMesh.rotation.z = courtAngle;
      keyMesh.position.set(kCenter[0], sunkenY + 0.008, kCenter[1]);
      keyMesh.receiveShadow = true;
      scene.add(keyMesh);
    }

    const p1 = b.pt(-hl, -hw);
    const p2 = b.pt(hl, -hw);
    const p3 = b.pt(hl, hw);
    const p4 = b.pt(-hl, hw);
    rbBeach.addSegment(p1[0], p1[1], p2[0], p2[1], 0.18);
    rbBeach.addSegment(p2[0], p2[1], p3[0], p3[1], 0.18);
    rbBeach.addSegment(p3[0], p3[1], p4[0], p4[1], 0.18);
    rbBeach.addSegment(p4[0], p4[1], p1[0], p1[1], 0.18);
    const m1 = b.pt(0, -hw);
    const m2 = b.pt(0, hw);
    rbBeach.addSegment(m1[0], m1[1], m2[0], m2[1], 0.16);
    rbBeach.addArc(b.cx, b.cz, 1.8, 0, Math.PI * 2, 24, 0.15);
    // Raquettes et arcs à 3 points au fond du terrain enterré
    for (const dir of [-1, 1]) {
      const k0 = b.pt(dir * hl, -2.25);
      const k1 = b.pt(dir * (hl - 5.1), -2.25);
      const k2 = b.pt(dir * (hl - 5.1), 2.25);
      const k3 = b.pt(dir * hl, 2.25);
      rbBeach.addSegment(k0[0], k0[1], k1[0], k1[1], 0.15);
      rbBeach.addSegment(k1[0], k1[1], k2[0], k2[1], 0.15);
      rbBeach.addSegment(k2[0], k2[1], k3[0], k3[1], 0.15);
      const baseAngle = Math.atan2(-dir * b.uz, -dir * b.ux);
      const hoopPt = b.pt(dir * (hl - 1.15), 0);
      rbBeach.addArc(hoopPt[0], hoopPt[1], 5.4, baseAngle - 1.22, baseAngle + 1.22, 20, 0.15);

      // Panier 3D ancré à -0.35 m
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.08, 0.1, 3.05, 8), propMat);
      post.position.set(hoopPt[0], sunkenY + 1.525, hoopPt[1]);
      const board = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.05, 1.65), propMat);
      board.position.set(hoopPt[0], sunkenY + 2.75, hoopPt[1]);
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

    // Aire de jeu centrale bicolore en résine acrylique pro (bleu US Open sur dégagement vert pour Tennis, bleu/terracotta pour Padel)
    const inCourtMat = new THREE.MeshStandardMaterial({
      color: isPadel ? 0x1e5685 : 0x2b6592,
      roughness: 0.78,
      polygonOffset: true,
      polygonOffsetFactor: -1,
      polygonOffsetUnits: -1,
    });
    const inCourtMesh = new THREE.Mesh(new THREE.PlaneGeometry(hl * 2, hw * 2), inCourtMat);
    inCourtMesh.rotation.x = -Math.PI / 2;
    inCourtMesh.rotation.z = longAngle;
    inCourtMesh.position.set(c.cx, 0.428, c.cz);
    inCourtMesh.receiveShadow = true;
    scene.add(inCourtMesh);

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

  // 5b. Espace Arts Martiaux (-75.7, -15.5) : tatami encadré bois & cercle de compétition
  const amZone = data.zones.find((z) => z.name.toUpperCase() === "ART MARTIAUX");
  if (amZone) {
    const dx = -75.7;
    const dz = -16.8;
    const deckFrame = new THREE.Mesh(
      new THREE.BoxGeometry(12.6, 0.08, 10.6),
      new THREE.MeshStandardMaterial({ color: 0xb99d7c, roughness: 0.85 })
    );
    deckFrame.position.set(dx, 0.45, dz);
    deckFrame.receiveShadow = true;

    const matRim = new THREE.Mesh(
      new THREE.BoxGeometry(11.8, 0.085, 9.8),
      new THREE.MeshStandardMaterial({ color: 0x9c5548, roughness: 0.88 })
    );
    matRim.position.set(dx, 0.458, dz);
    matRim.receiveShadow = true;

    const tatamiCenter = new THREE.Mesh(
      new THREE.BoxGeometry(9.6, 0.09, 7.6),
      new THREE.MeshStandardMaterial({ color: 0xdfd0ba, roughness: 0.9 })
    );
    tatamiCenter.position.set(dx, 0.464, dz);
    tatamiCenter.receiveShadow = true;

    const amRing = new THREE.Mesh(
      new THREE.RingGeometry(2.85, 3.0, 32),
      new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide })
    );
    amRing.rotation.x = -Math.PI / 2;
    amRing.position.set(dx, 0.514, dz);

    const benchMat = new THREE.MeshStandardMaterial({ color: 0xc2a886, roughness: 0.82 });
    const bWest = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.44, 4.2), benchMat);
    bWest.position.set(dx - 7.1, 0.64, dz);
    bWest.castShadow = true;
    const bEast = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.44, 4.2), benchMat);
    bEast.position.set(dx + 7.1, 0.64, dz);
    bEast.castShadow = true;
    scene.add(deckFrame, matRim, tatamiCenter, amRing, bWest, bEast);
  }

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

export function buildWaterAndFountains(scene, data, textures, extrudePoly, mergeGeometries, isMobile = false) {
  const waterGeoms = [];
  const poolWaterGeoms = [];
  const poolTileGeoms = [];
  const poolDetailGeoms = [];
  const poolWhiteGeoms = [];
  const rimPositions = [];
  const poolWallPositions = [];
  const poolTrimPositions = [];
  const fountains = [];
  const poolGlows = [];

  const pushVerticalBand = (poly, yBot, yTop, inset = 0, outArr) => {
    let cx = 0;
    let cz = 0;
    for (const [px, pz] of poly) {
      cx += px;
      cz += pz;
    }
    cx /= poly.length;
    cz /= poly.length;

    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      let ax = a[0];
      let az = a[1];
      let bx = b[0];
      let bz = b[1];
      if (inset !== 0) {
        const dx = bx - ax;
        const dz = bz - az;
        const len = Math.hypot(dx, dz) || 1;
        let nx = -dz / len;
        let nz = dx / len;
        const mx = (ax + bx) * 0.5;
        const mz = (az + bz) * 0.5;
        // Orienter (nx, nz) vers l'intérieur du polygone
        if ((cx - mx) * nx + (cz - mz) * nz < 0) {
          nx = -nx;
          nz = -nz;
        }
        ax += nx * inset;
        az += nz * inset;
        bx += nx * inset;
        bz += nz * inset;
      }
      outArr.push(
        ax, yBot, az,
        bx, yBot, bz,
        bx, yTop, bz,
        ax, yBot, az,
        bx, yTop, bz,
        ax, yTop, az
      );
    }
  };

  for (const z of data.zones) {
    if (z.kind !== "water") continue;
    try {
      const nu = z.name.toUpperCase();
      const isPool = nu.includes("PISICNE") || nu.includes("PISCINE");

      if (isPool) {
        const isChild = nu.includes("ENFANT");
        const yDeck = 0.3; // arasé à la dalle supérieure du parc (parkSlab top = 0.300)
        const poolDepth = isChild ? 0.5 : 1.5;
        const yFloor = yDeck - poolDepth; // -1.20 m adulte, -0.20 m enfant
        const yWater = 0.19;

        // Margelle périphérique en pierre naturelle (déborde de 2 cm sur le bassin, 40 cm sur la plage)
        addOutwardCopingRim(z.poly, -0.02, 0.4, 0.285, 0.415, rimPositions);

        // Radier carrelé excavé (-1.20 m adulte / -0.20 m enfant)
        poolTileGeoms.push(extrudePoly(z.poly, 0.14, yFloor - 0.14));

        // Parois verticales carrelées du bassin + liseré blanc à la ligne d'eau
        pushVerticalBand(z.poly, yFloor, yDeck + 0.01, 0, poolWallPositions);
        pushVerticalBand(z.poly, yWater - 0.04, yDeck + 0.005, 0.015, poolTrimPositions);

        // Eau cristalline translucide (renderOrder = 3 pour laisser apparaître les marches et le fond)
        poolWaterGeoms.push(extrudePoly(z.poly, 0.04, yWater - 0.04));

        if (!isChild) {
          // Piscine Adulte (profondeur 1,50 m) : 5 marches immergées épousant EXACTEMENT toute la largeur jusqu'aux parois obliques à 45°
          const treadD = 0.5;
          const stepCx = -50.0;
          const riser = 1.5 / 6; // 0.25 m par marche sur 1.50 m de dénivelé total
          // Fonction exacte de la demi-largeur interne du bassin adulte à une coordonnée z (bord Nord z=-10.12, congé jusqu'à z=-9.53, puis oblique exact x = -38.09 + (z + 9.53))
          const adultHalfWAtZ = (zVal) => {
            if (zVal <= -9.53) {
              const t = Math.max(0, Math.min(1, (zVal + 10.12) / 0.59));
              return 10.49 + (11.91 - 10.49) * Math.sqrt(t);
            }
            return 11.91 + (zVal + 9.53);
          };
          for (let k = 0; k < 5; k++) {
            const stepTop = yDeck - (k + 1) * riser; // +0.05, -0.20, -0.45, -0.70, -0.95
            const h = stepTop - yFloor;
            const zFront = -10.12 + k * treadD;
            const zBack = zFront + treadD;
            const halfW0 = adultHalfWAtZ(zFront);
            const halfW1 = adultHalfWAtZ(zBack);
            const stepPoly = [
              [stepCx - halfW0, zFront],
              [stepCx + halfW0, zFront],
              [stepCx + halfW1, zBack],
              [stepCx - halfW1, zBack],
            ];
            poolTileGeoms.push(extrudePoly(stepPoly, h, yFloor));

            // Nez de marche antidérapant blanc pleine largeur jusqu'aux parois
            const ng = new THREE.BoxGeometry(halfW1 * 2 - 0.04, 0.042, 0.075);
            ng.translate(stepCx, stepTop - 0.01, zBack - 0.036);
            poolWhiteGeoms.push(ng);
          }

          // Lignes de nage sombres au fond du grand bassin
          for (const lz of [-5.6, -1.8]) {
            const lg = new THREE.BoxGeometry(27.0, 0.025, 0.22);
            lg.translate(-50.0, yFloor + 0.012, lz);
            poolDetailGeoms.push(lg);
            for (const tx of [-63.2, -36.8]) {
              const tg = new THREE.BoxGeometry(0.24, 0.025, 1.35);
              tg.translate(tx, yFloor + 0.012, lz);
              poolDetailGeoms.push(tg);
            }
          }

          // Deux échelles inox sur la paroi Sud (z = +2.61)
          const ladderGeoms = [];
          for (const lx of [-58.5, -41.5]) {
            for (const dx of [-0.26, 0.26]) {
              const rail = new THREE.CylinderGeometry(0.026, 0.026, 1.65, 8);
              rail.translate(lx + dx, 0.22, 2.48);
              ladderGeoms.push(rail);
              const topBar = new THREE.CylinderGeometry(0.026, 0.026, 0.42, 8);
              topBar.rotateX(Math.PI / 2);
              topBar.translate(lx + dx, 1.03, 2.66);
              ladderGeoms.push(topBar);
              const deckPost = new THREE.CylinderGeometry(0.026, 0.026, 0.65, 8);
              deckPost.translate(lx + dx, 0.72, 2.86);
              ladderGeoms.push(deckPost);
            }
            for (let r = 0; r < 4; r++) {
              const ry = -0.75 + r * 0.26;
              const rung = new THREE.CylinderGeometry(0.02, 0.02, 0.52, 8);
              rung.rotateZ(Math.PI / 2);
              rung.translate(lx, ry, 2.48);
              ladderGeoms.push(rung);
            }
          }
          const mergedLadder = mergeGeometries(ladderGeoms);
          if (mergedLadder) {
            const ladderMesh = new THREE.Mesh(
              mergedLadder,
              new THREE.MeshStandardMaterial({ color: 0xe6eef2, roughness: 0.18, metalness: 0.88 })
            );
            ladderMesh.castShadow = true;
            scene.add(ladderMesh);
          }

          // Spots subaquatiques de nuit le long du grand bassin
          for (const px of [-63, -56.5, -50, -43.5, -37]) {
            poolGlows.push([px, -3.7, 13.5, yFloor + 0.06]);
          }
        } else {
          // Piscine Enfant (profondeur 0,50 m) : 3 marches peu profondes épousant la pointe Nord (z = -19.99 -> -17.15) de paroi à paroi
          const riser = 0.5 / 4; // 0.125 m par marche sur 0.50 m de profondeur totale
          const stepCx = -50.0;
          // Demi-largeur interne exacte de la Piscine Enfant à une coordonnée z (sommet arrondi z=-19.99, puis obliques à 45° jusqu'à z=-13.26)
          const childHalfWAtZ = (zVal) => {
            if (zVal <= -18.96) {
              const t = Math.max(0, Math.min(1, (zVal + 19.99) / 1.03));
              return 2.48 * Math.sqrt(t);
            }
            return 2.48 + (zVal + 18.96);
          };
          const zEdges = [-19.99, -18.85, -18.0, -17.15];
          for (let k = 0; k < 3; k++) {
            const stepTop = yDeck - (k + 1) * riser;
            const h = stepTop - yFloor;
            const z0 = zEdges[k];
            const z1 = zEdges[k + 1];
            let stepPoly;
            if (k === 0) {
              // Marche 1 épousant exactement l'arc arrondi de la pointe Nord
              const hw1 = childHalfWAtZ(z1);
              stepPoly = [
                [-50.0, -19.99],
                [-49.09, -19.87],
                [-48.25, -19.52],
                [-47.52, -18.96],
                [stepCx + hw1, z1],
                [stepCx - hw1, z1],
                [-52.47, -18.96],
                [-51.75, -19.52],
                [-50.9, -19.87],
              ];
            } else {
              const hw0 = childHalfWAtZ(z0);
              const hw1 = childHalfWAtZ(z1);
              stepPoly = [
                [stepCx - hw0, z0],
                [stepCx + hw0, z0],
                [stepCx + hw1, z1],
                [stepCx - hw1, z1],
              ];
            }
            poolTileGeoms.push(extrudePoly(stepPoly, h, yFloor));

            // Nez de marche antidérapant blanc pleine largeur
            const hw1 = childHalfWAtZ(z1);
            const ng = new THREE.BoxGeometry(hw1 * 2 - 0.04, 0.038, 0.075);
            ng.translate(stepCx, stepTop - 0.008, z1 - 0.036);
            poolWhiteGeoms.push(ng);
          }
          poolGlows.push([-52.8, -15.3, 8.8, yFloor + 0.06], [-47.2, -15.3, 8.8, yFloor + 0.06]);
        }
        continue;
      }

      // Eau des bassins & fontaines décoratifs (top 0.480)
      waterGeoms.push(extrudePoly(z.poly, 0.12, 0.36));
      // Margelle en pierre décalée vers l'extérieur (+0.02..+0.30 m, y 0.34..0.505) : zéro face coplanaire !
      addOutwardCopingRim(z.poly, 0.02, 0.3, 0.34, 0.505, rimPositions);
      if (nu.includes("BASSIN") || nu.includes("FONTAINE")) {
        fountains.push({
          pos: z.centroid,
          isMain: nu.includes("BASSIN"),
          area: z.area,
          poly: z.poly,
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

  // Maillages carrelés & détails des piscines excavées (avec émissivité subaquatique douce la nuit)
  if (poolWallPositions.length) {
    const wallGeo = new THREE.BufferGeometry();
    wallGeo.setAttribute("position", new THREE.Float32BufferAttribute(poolWallPositions, 3));
    wallGeo.computeVertexNormals();
    poolTileGeoms.push(wallGeo);
  }
  const poolTileMat = new THREE.MeshStandardMaterial({
    color: 0x8fd2dc,
    roughness: 0.32,
    metalness: 0.05,
    emissive: new THREE.Color(0x288ca6),
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
  });
  const mergedPoolTiles = mergeGeometries(poolTileGeoms);
  if (mergedPoolTiles) {
    const ptMesh = new THREE.Mesh(mergedPoolTiles, poolTileMat);
    ptMesh.receiveShadow = true;
    ptMesh.castShadow = true;
    scene.add(ptMesh);
  }

  if (poolTrimPositions.length) {
    const trimGeo = new THREE.BufferGeometry();
    trimGeo.setAttribute("position", new THREE.Float32BufferAttribute(poolTrimPositions, 3));
    trimGeo.computeVertexNormals();
    poolWhiteGeoms.push(trimGeo);
  }
  const poolWhiteMat = new THREE.MeshStandardMaterial({
    color: 0xf7fbfc,
    roughness: 0.28,
    metalness: 0.04,
    emissive: new THREE.Color(0x70d0e0),
    emissiveIntensity: 0,
    side: THREE.DoubleSide,
  });
  const mergedPoolWhite = mergeGeometries(poolWhiteGeoms);
  if (mergedPoolWhite) {
    const pwMesh = new THREE.Mesh(mergedPoolWhite, poolWhiteMat);
    pwMesh.receiveShadow = true;
    scene.add(pwMesh);
  }

  const mergedPoolDetails = mergeGeometries(poolDetailGeoms);
  if (mergedPoolDetails) {
    const pdMesh = new THREE.Mesh(
      mergedPoolDetails,
      new THREE.MeshStandardMaterial({ color: 0x246b82, roughness: 0.4 })
    );
    pdMesh.receiveShadow = true;
    scene.add(pdMesh);
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

  const poolWaterMat = new THREE.MeshStandardMaterial({
    color: 0x5cc7d6,
    map: waterTexA,
    bumpMap: waterTexB,
    bumpScale: 0.09,
    roughness: 0.1,
    metalness: 0.1,
    transparent: true,
    opacity: 0.48,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
  });
  const mergedPoolWater = mergeGeometries(poolWaterGeoms);
  if (mergedPoolWater) {
    const pwSurf = new THREE.Mesh(mergedPoolWater, poolWaterMat);
    pwSurf.receiveShadow = true;
    pwSurf.renderOrder = 3;
    scene.add(pwSurf);
  }

  // Gouttelettes animées (jets d'eau paraboliques chorégraphiés), buses et éclairages subaquatiques
  const droplets = [];
  const rings = [];
  const nozzles = [];
  const underGlows = [...poolGlows];
  const twinArcBasins = [];
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
    } else if (f.area > 15 && f.poly && f.poly.length >= 12) {
      // Deux bassins courbes jumelés au Sud du Bassin Central : réservés aux jets laminaires en arche lumineuse
      twinArcBasins.push(f);
    } else if (f.area > 15) {
      // Fontaines cintrées amphithéâtre : rampe chorégraphiée de 5 jets (repli)
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
      const effCount = isMobile ? Math.max(6, Math.round(js.count * 0.55)) : js.count;
      for (let i = 0; i < effCount; i++) {
        const angle = (i / effCount) * Math.PI * 2 * 4.3 + js.phaseShift;
        droplets.push({
          bx: jx,
          bz: jz,
          h: js.h,
          vx: Math.cos(angle) * js.spread * (0.3 + ((i * 17) % 10) * 0.07),
          vz: Math.sin(angle) * js.spread * (0.3 + ((i * 13) % 10) * 0.07),
          phase: i / effCount + js.phaseShift + fIdx * 0.11,
          choreoPhase,
          speed: 0.72 + ((i * 7) % 5) * 0.07,
        });
      }
    }
  });

  // Jets d'eau laminaires en arche lumineuse reliant les deux bassins courbes jumelés
  let laminarTex = null;
  let laminarCoreMat = null;
  let laminarAuraMat = null;
  let laminarBloomMat = null;
  let laminarBloomMesh = null;
  let laminarGlowInst = null;
  let laminarGlowMat = null;
  if (twinArcBasins.length === 2) {
    twinArcBasins.sort((a, b) => a.pos[1] - b.pos[1]);
    const midCurve = (poly) => {
      const pts = [];
      for (let j = 0; j < 6; j++) {
        const a = poly[6 - j];
        const b = poly[(7 + j) % 12];
        pts.push([(a[0] + b[0]) * 0.5, (a[1] + b[1]) * 0.5]);
      }
      return pts;
    };
    const sampleCurve = (pts, u) => {
      const segLens = [0];
      for (let i = 0; i < pts.length - 1; i++) {
        segLens.push(segLens[i] + Math.hypot(pts[i + 1][0] - pts[i][0], pts[i + 1][1] - pts[i][1]));
      }
      const target = u * segLens[segLens.length - 1];
      for (let i = 0; i < pts.length - 1; i++) {
        if (target <= segLens[i + 1] || i === pts.length - 2) {
          const t = (target - segLens[i]) / (segLens[i + 1] - segLens[i] || 1);
          return [pts[i][0] + (pts[i + 1][0] - pts[i][0]) * t, pts[i][1] + (pts[i + 1][1] - pts[i][1]) * t];
        }
      }
      return pts[0];
    };

    const curveN = midCurve(twinArcBasins[0].poly);
    const curveS = midCurve(twinArcBasins[1].poly);
    const coreGeoms = [];
    const auraGeoms = [];
    const bloomGeoms = [];
    const laminarNozzles = []; // [x, z, ux, uz]
    const laminarGlows = [];   // [x, y, z, size]
    const arcCount = 12;
    const tubSegs = isMobile ? 20 : 28;

    for (let k = 0; k < arcCount; k++) {
      const u = 0.04 + (k / (arcCount - 1)) * 0.92;
      const a = sampleCurve(curveN, u);
      const b = sampleCurve(curveS, u);
      const [p0, p2] = k % 2 === 0 ? [a, b] : [b, a];
      const y0 = 0.45;
      const arcH = 2.25;
      const curve = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(p0[0], y0, p0[1]),
        new THREE.Vector3((p0[0] + p2[0]) * 0.5, y0 + 2 * arcH, (p0[1] + p2[1]) * 0.5),
        new THREE.Vector3(p2[0], y0, p2[1])
      );

      coreGeoms.push(new THREE.TubeGeometry(curve, tubSegs, 0.038, 7, false));
      auraGeoms.push(new THREE.TubeGeometry(curve, tubSegs, 0.095, 7, false));
      bloomGeoms.push(new THREE.TubeGeometry(curve, tubSegs, 0.185, 7, false));

      const dx = p2[0] - p0[0];
      const dz = p2[1] - p0[1];
      const len = Math.hypot(dx, dz) || 1;
      laminarNozzles.push([p0[0], p0[1], dx / len, dz / len]);
      laminarNozzles.push([p2[0], p2[1], -dx / len, -dz / len]);

      // Ondes concentriques serrées & éclaboussures à l'impact du jet dans le bassin receveur
      const lRing = new THREE.Mesh(ringGeo, ringMat.clone());
      lRing.position.set(p2[0], 0.492, p2[1]);
      lRing.userData = { phase: k * 0.14, maxScale: 1.05 };
      scene.add(lRing);
      rings.push(lRing);

      const splashCount = isMobile ? 3 : 5;
      for (let i = 0; i < splashCount; i++) {
        const ang = (i / splashCount) * Math.PI * 2 + k * 0.5;
        droplets.push({
          bx: p2[0],
          bz: p2[1],
          h: 0.24,
          vx: Math.cos(ang) * 0.22,
          vz: Math.sin(ang) * 0.22,
          phase: i / splashCount + k * 0.09,
          choreoPhase: k * 0.4,
          speed: 1.15 + (i % 3) * 0.15,
        });
      }

      laminarGlows.push([p0[0], 0.488, p0[1], 2.6]);
      laminarGlows.push([p2[0], 0.488, p2[1], 2.6]);
      laminarGlows.push([(p0[0] + p2[0]) * 0.5, 0.372, (p0[1] + p2[1]) * 0.5, 3.2]);
    }

    // Texture d'écoulement laminaire animée le long du tube
    const ltCanvas = document.createElement("canvas");
    ltCanvas.width = 256;
    ltCanvas.height = 16;
    const ltCtx = ltCanvas.getContext("2d");
    const ltGrad = ltCtx.createLinearGradient(0, 0, 256, 0);
    ltGrad.addColorStop(0.0, "#7deeff");
    ltGrad.addColorStop(0.22, "#e8ffff");
    ltGrad.addColorStop(0.45, "#a6f6ff");
    ltGrad.addColorStop(0.7, "#ffffff");
    ltGrad.addColorStop(1.0, "#7deeff");
    ltCtx.fillStyle = ltGrad;
    ltCtx.fillRect(0, 0, 256, 16);
    laminarTex = new THREE.CanvasTexture(ltCanvas);
    laminarTex.wrapS = THREE.RepeatWrapping;
    laminarTex.wrapT = THREE.ClampToEdgeWrapping;
    laminarTex.repeat.set(2.5, 1);

    const mergedCore = mergeGeometries(coreGeoms);
    if (mergedCore) {
      laminarCoreMat = new THREE.MeshBasicMaterial({
        map: laminarTex,
        color: 0xc8f0ff,
        transparent: true,
        opacity: 0.85,
      });
      const coreMesh = new THREE.Mesh(mergedCore, laminarCoreMat);
      coreMesh.renderOrder = 4;
      scene.add(coreMesh);
    }

    const mergedAura = mergeGeometries(auraGeoms);
    if (mergedAura) {
      laminarAuraMat = new THREE.MeshBasicMaterial({
        color: 0x1ee6ff,
        transparent: true,
        opacity: 0.14,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const auraMesh = new THREE.Mesh(mergedAura, laminarAuraMat);
      auraMesh.renderOrder = 5;
      scene.add(auraMesh);
    }

    const mergedBloom = mergeGeometries(bloomGeoms);
    if (mergedBloom) {
      laminarBloomMat = new THREE.MeshBasicMaterial({
        color: 0x0bc8ff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      laminarBloomMesh = new THREE.Mesh(mergedBloom, laminarBloomMat);
      laminarBloomMesh.visible = false;
      laminarBloomMesh.renderOrder = 5;
      scene.add(laminarBloomMesh);
    }

    if (laminarNozzles.length) {
      const lNozGeo = new THREE.CylinderGeometry(0.055, 0.08, 0.2, 8);
      const lNozMat = new THREE.MeshStandardMaterial({
        color: 0xd6dce2,
        roughness: 0.34,
        metalness: 0.55,
      });
      const lNozInst = new THREE.InstancedMesh(lNozGeo, lNozMat, laminarNozzles.length);
      const nd = new THREE.Object3D();
      const upVec = new THREE.Vector3(0, 1, 0);
      const aimVec = new THREE.Vector3();
      laminarNozzles.forEach(([x, z, ux, uz], idx) => {
        aimVec.set(ux * 0.38, 0.925, uz * 0.38).normalize();
        nd.position.set(x, 0.465, z);
        nd.quaternion.setFromUnitVectors(upVec, aimVec);
        nd.scale.set(1, 1, 1);
        nd.updateMatrix();
        lNozInst.setMatrixAt(idx, nd.matrix);
      });
      scene.add(lNozInst);
    }

    if (laminarGlows.length) {
      const lgGeo = new THREE.PlaneGeometry(1, 1);
      lgGeo.rotateX(-Math.PI / 2);
      laminarGlowMat = new THREE.MeshBasicMaterial({
        map: textures.lightPool,
        color: 0x26dcff,
        transparent: true,
        opacity: 0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        polygonOffset: true,
        polygonOffsetFactor: -3,
        polygonOffsetUnits: -3,
      });
      laminarGlowInst = new THREE.InstancedMesh(lgGeo, laminarGlowMat, laminarGlows.length);
      laminarGlowInst.visible = false;
      const gd = new THREE.Object3D();
      laminarGlows.forEach(([x, y, z, sz], idx) => {
        gd.position.set(x, y, z);
        gd.scale.set(sz, 1, sz);
        gd.updateMatrix();
        laminarGlowInst.setMatrixAt(idx, gd.matrix);
      });
      scene.add(laminarGlowInst);
    }
  }

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
  let ugInst = null;
  if (underGlows.length) {
    const ugGeo = new THREE.PlaneGeometry(1, 1);
    ugGeo.rotateX(-Math.PI / 2);
    ugInst = new THREE.InstancedMesh(ugGeo, underGlowMat, underGlows.length);
    ugInst.visible = false;
    const d = new THREE.Object3D();
    underGlows.forEach(([x, z, sz, gy], idx) => {
      d.position.set(x, gy !== undefined ? gy : 0.488, z);
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
    size: isMobile ? 1.04 : 0.85,
    map: new THREE.CanvasTexture(spCanvas),
    transparent: true,
    opacity: 0.88,
    depthWrite: false,
    color: 0xf4fafc,
  });
  const pointsMesh = new THREE.Points(ptsGeo, ptsMat);
  scene.add(pointsMesh);

  const dayWaterCol = new THREE.Color(0xcce2e4);
  const nightWaterCol = new THREE.Color(0x244252);
  const dayPoolCol = new THREE.Color(0x5cc7d6);
  const nightPoolCol = new THREE.Color(0x1f6c82);
  const dayLaminarCol = new THREE.Color(0xc8f0ff);
  const nightLaminarCol = new THREE.Color(0xe8ffff);

  return {
    updateWater(dt, now, nightFactor, camY = 126) {
      waterTexA.offset.x = (now * 0.000018) % 1;
      waterTexA.offset.y = (now * 0.000012) % 1;
      waterTexB.offset.x = -(now * 0.000014) % 1;
      waterTexB.offset.y = (now * 0.000021) % 1;

      const tSec = now * 0.001;
      waterMat.color.lerpColors(dayWaterCol, nightWaterCol, nightFactor);
      poolWaterMat.color.lerpColors(dayPoolCol, nightPoolCol, nightFactor);
      poolWaterMat.opacity = 0.48 + nightFactor * 0.1;
      poolTileMat.emissiveIntensity = nightFactor * 0.24;
      poolWhiteMat.emissiveIntensity = nightFactor * 0.28;
      ptsMat.color.setHex(nightFactor > 0.4 ? 0xffe4b8 : 0xf4fafc);

      if (laminarTex) {
        laminarTex.offset.x = (laminarTex.offset.x - dt * 0.95) % 1;
      }
      if (laminarCoreMat) {
        laminarCoreMat.color.lerpColors(dayLaminarCol, nightLaminarCol, nightFactor);
        laminarCoreMat.opacity = THREE.MathUtils.lerp(0.82, 0.98, nightFactor);
      }
      if (laminarAuraMat) {
        laminarAuraMat.opacity = 0.12 + nightFactor * (0.44 + 0.05 * Math.sin(tSec * 2.6));
      }
      if (laminarBloomMesh && laminarBloomMat) {
        const showBloom = nightFactor > 0.02;
        if (laminarBloomMesh.visible !== showBloom) laminarBloomMesh.visible = showBloom;
        if (showBloom) {
          laminarBloomMat.opacity = nightFactor * (0.2 + 0.03 * Math.sin(tSec * 2.1 + 0.8));
        }
      }

      const showGlow = nightFactor > 0.01;
      if (ugInst && ugInst.visible !== showGlow) ugInst.visible = showGlow;
      if (showGlow) {
        underGlowMat.opacity = nightFactor * (0.44 + 0.06 * Math.sin(tSec * 2.1));
      }
      if (laminarGlowInst && laminarGlowMat) {
        if (laminarGlowInst.visible !== showGlow) laminarGlowInst.visible = showGlow;
        if (showGlow) {
          laminarGlowMat.opacity = nightFactor * (0.48 + 0.05 * Math.sin(tSec * 2.3));
        }
      }

      const showSpray = camY < 420;
      if (pointsMesh.visible !== showSpray) pointsMesh.visible = showSpray;
      if (!showSpray) return;

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

  const isClearOuter = (x, z, bldMargin = 3.8) => {
    if (isOnRoad(x, z)) return false;
    // Hors emprises de la Banque et des 2 Stations-service
    if (x > -136 && x < -105 && z > -86 && z < -60) return false;
    if (x > -276 && x < -198 && z > -98 && z < -42) return false;
    if (x > -320 && x < -270 && z > -17 && z < 1) return false;
    // Dégager les toits des 43 cantines le long du parking Nord
    if (cantines.some((c) => pointNearPoly2D([x, z], c, 3.8))) return false;
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

  // 1a. Jardins d'arbustes (JARDIN PLANTÉ — densité d'arbres renforcée) & pelouses intérieures
  const roofPolys = (data.roofs || []).map((r) => r.poly).filter((p) => p && p.length >= 3);
  const isUnderRoof = (x, z) =>
    roofPolys.some((poly) => pointInPoly2D([x, z], poly)) ||
    (Math.abs(x) < 15.8 && z > -25.2 && z < -11.8);

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
    const isJardinPlante = gz.name.toUpperCase().includes("JARDIN PLANT");
    const targetCount = isJardinPlante
      ? Math.min(28, Math.max(4, Math.round(gz.area / 28)))
      : Math.min(18, Math.max(2, Math.round(gz.area / 72)));
    const minSep = isJardinPlante ? 3.5 : 4.6;
    let added = 0;
    for (let tries = 0; tries < targetCount * 14 && added < targetCount; tries++) {
      const px = minX + rng() * (maxX - minX);
      const pz = minZ + rng() * (maxZ - minZ);
      if (!pointInPoly2D([px, pz], gz.poly)) continue;
      if (!isClearInner(px, pz)) continue;
      if (isUnderRoof(px, pz)) continue;
      if (addTreeIfClear(px, pz, 0.78 + rng() * 0.58, 0.42, minSep)) added++;
    }
  }

  // 1b. Îlots du parking Nord (arbres décalés à ±5,6 m sur les îlots équipés d'une pergola centrale pour zéro collision)
  (data.parkingDetails?.medians || []).forEach((med, mIdx) => {
    let sx = 0, sz = 0;
    for (const [x, z] of med) {
      sx += x;
      sz += z;
    }
    const cx = sx / med.length;
    const cz = sz / med.length;
    const offset = mIdx % 2 === 1 ? 5.6 : 4.2;
    addTreeIfClear(cx - offset, cz, 0.84, 0.42, 4.0);
    addTreeIfClear(cx + offset, cz, 0.84, 0.42, 4.0);
  });

  // 1c. Ceinture périphérique tout autour du jardin (Nord, Sud, Est, Ouest & avenues riveraines)
  for (let x = -246; x <= 246; x += 13.5) {
    // Dégager l'axe du parvis d'entrée Nord & arrière Théâtre Sud
    if (Math.abs(x) < 15.5) continue;
    // Bordure Nord extérieure à la piste rouge (BANDE DE GAZON Nord)
    if (isClearOuter(x, -28.05, 3.4) && isClearInner(x, -28.05)) {
      addTreeIfClear(x + (rng() - 0.5) * 0.6, -28.05, 0.88 + rng() * 0.34, 0.36, 7.5);
    }
    // Bordure Sud extérieure à la piste rouge (trottoir Sud longeant le parc)
    if (isClearOuter(x, 28.85, 3.4) && isClearInner(x, 28.85)) {
      addTreeIfClear(x + (rng() - 0.5) * 0.6, 28.85, 0.88 + rng() * 0.36, 0.14, 7.5);
    }
  }

  // Alignements de boulevards entourant le parc et le parking
  for (let x = -242; x <= 296; x += 16.5) {
    if (Math.abs(x) < 16) continue;
    // Entre avenue Nord et parking Nord (uniquement hors emprise des cantines)
    if (isClearOuter(x, -42.0, 3.8)) {
      addTreeIfClear(x, -42.0, 0.92 + rng() * 0.32, 0.12, 7.5);
    }
    // Bordure Nord au-dessus des 43 cantines
    if (x >= -56 && isClearOuter(x, -65.2, 3.8)) {
      addTreeIfClear(x, -65.2, 0.9 + rng() * 0.32, 0.12, 8.0);
    }
    // Promenade ombragée côté Sud de l'avenue Sud
    if (x <= 242 && isClearOuter(x, 34.8, 3.8)) {
      addTreeIfClear(x, 34.8, 0.86 + rng() * 0.32, 0.12, 8.0);
    }
  }

  // Flancs Ouest et Est autour des extrémités du jardin
  for (let z = -72; z <= 72; z += 14.0) {
    for (const wx of [-255.2, -270.0]) {
      if (isClearOuter(wx, z, 3.8)) {
        addTreeIfClear(wx, z, 0.88 + rng() * 0.3, 0.12, 7.5);
      }
    }
    for (const ex of [255.8, 273.5]) {
      if (isClearOuter(ex, z, 3.8)) {
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
    if (!isClearOuter(ux, uz, 4.0)) continue;
    if (addTreeIfClear(ux, uz, 0.78 + rng() * 0.52, 0.1, 8.2)) urbanAdded++;
  }

  // 1e. Arbre d'ornement et jardinière monumentale au sommet du gradin triangulaire (entre Basket et Beach)
  const heroGradinTreeIdx = treePositions.length;
  treePositions.push([-146.27, 10.02, 0.92, 1.1]);
  const planterRing = new THREE.Mesh(
    new THREE.CylinderGeometry(1.75, 1.85, 0.36, 20),
    new THREE.MeshStandardMaterial({ color: 0xe6ddd0, roughness: 0.88 })
  );
  planterRing.position.set(-146.27, 1.08, 10.02);
  planterRing.castShadow = true;
  planterRing.receiveShadow = true;
  const planterSoil = new THREE.Mesh(
    new THREE.CylinderGeometry(1.48, 1.48, 0.4, 18),
    new THREE.MeshStandardMaterial({ color: 0x8d9f73, roughness: 0.92 })
  );
  planterSoil.position.set(-146.27, 1.09, 10.02);
  scene.add(planterRing, planterSoil);

  if (treePositions.length) {
    const mergeLocalGeoms = (geoms) => {
      const nonIdx = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
      let total = 0;
      for (const g of nonIdx) total += g.attributes.position.count;
      const pos = new Float32Array(total * 3);
      const norm = new Float32Array(total * 3);
      const uv = new Float32Array(total * 2);
      let off = 0;
      for (const g of nonIdx) {
        if (!g.attributes.normal) g.computeVertexNormals();
        const cnt = g.attributes.position.count;
        pos.set(g.attributes.position.array, off * 3);
        norm.set(g.attributes.normal.array, off * 3);
        if (g.attributes.uv) uv.set(g.attributes.uv.array, off * 2);
        off += cnt;
        g.dispose();
      }
      const out = new THREE.BufferGeometry();
      out.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      out.setAttribute("normal", new THREE.BufferAttribute(norm, 3));
      out.setAttribute("uv", new THREE.BufferAttribute(uv, 2));
      return out;
    };

    // --- 4 essences botaniques sculpturales (Palmier, Acacia/Flamboyant parasol, Feuillu multi-houppiers, Cyprès élancé) ---
    // 1) Palmier : stipe élancé légèrement courbé + 8 palmes arquées + cœur central
    const buildPalmGeoms = () => {
      const tParts = [];
      const segs = [
        { rT: 0.21, rB: 0.29, h: 1.25, y: 0.62, x: 0.02, rz: -0.04 },
        { rT: 0.17, rB: 0.21, h: 1.25, y: 1.82, x: 0.08, rz: -0.05 },
        { rT: 0.14, rB: 0.17, h: 1.2, y: 2.98, x: 0.15, rz: -0.04 },
        { rT: 0.13, rB: 0.14, h: 1.05, y: 4.02, x: 0.2, rz: -0.02 },
      ];
      for (const s of segs) {
        const c = new THREE.CylinderGeometry(s.rT, s.rB, s.h, 7);
        c.rotateZ(s.rz);
        c.translate(s.x, s.y, 0);
        tParts.push(c);
      }
      const heart = new THREE.CylinderGeometry(0.22, 0.14, 0.34, 7);
      heart.translate(0.22, 4.58, 0);
      tParts.push(heart);

      const cParts = [];
      // 3 grappes de dattes/fruits sous le cœur du palmier
      for (let d = 0; d < 3; d++) {
        const ang = (d / 3) * Math.PI * 2 + 0.3;
        const dg = new THREE.SphereGeometry(0.16, 6, 5);
        dg.scale(0.9, 1.35, 0.9);
        dg.translate(0.22 + Math.cos(ang) * 0.22, 4.46, Math.sin(ang) * 0.22);
        tParts.push(dg);
      }

      const addFrond = (yaw, len1, len2, len3, p1, p2, p3, w, baseY) => {
        const segsDef = [
          [len1, p1, w * 0.85, w],
          [len2, p2, w, w * 0.65],
          [len3, p3, w * 0.55, 0.03],
        ];
        let curR = 0.08;
        let curY = baseY;
        for (const [len, pitch, rB, rT] of segsDef) {
          const g = new THREE.CylinderGeometry(rT, rB, len, 6);
          g.scale(1.0, 1.0, 0.14);
          g.translate(0, len * 0.5, 0);
          g.rotateX(pitch);
          g.rotateY(yaw);
          g.translate(0.22 + Math.sin(yaw) * curR, curY, Math.cos(yaw) * curR);
          cParts.push(g);
          curR += Math.sin(pitch) * len * 0.94;
          curY += Math.cos(pitch) * len * 0.94;
        }
      };
      // Couronne externe : 7 grandes palmes retombantes en arc souple
      for (let k = 0; k < 7; k++) {
        const yaw = (k / 7) * Math.PI * 2 + (k % 2) * 0.11;
        const alt = k % 2 === 0;
        addFrond(
          yaw,
          alt ? 0.88 : 0.82,
          alt ? 0.96 : 0.88,
          alt ? 0.85 : 0.78,
          alt ? 0.84 : 0.96,
          alt ? 1.42 : 1.54,
          alt ? 1.98 : 2.08,
          alt ? 0.27 : 0.24,
          4.62
        );
      }
      // Couronne haute : 4 jeunes palmes dressées
      for (let k = 0; k < 4; k++) {
        const yaw = (k / 4) * Math.PI * 2 + 0.42;
        addFrond(yaw, 0.72, 0.74, 0.62, 0.42, 0.82, 1.24, 0.21, 4.72);
      }
      return { trunk: mergeLocalGeoms(tParts), crown: mergeLocalGeoms(cParts) };
    };

    // 2) Acacia / Flamboyant parasol : tronc ramifié en Y + cime tabulaire en strates larges
    const buildAcaciaGeoms = () => {
      const tParts = [];
      const stem = new THREE.CylinderGeometry(0.18, 0.28, 2.1, 7);
      stem.translate(0, 1.05, 0);
      tParts.push(stem);
      [
        [0, 1.25, 0.48, 0.52, 0],
        [(Math.PI * 2) / 3, 1.3, 0.52, 0.48, 0.04],
        [(Math.PI * 4) / 3, 1.22, 0.5, -0.46, 0.02],
      ].forEach(([yaw, bLen, tilt]) => {
        const br = new THREE.CylinderGeometry(0.08, 0.14, bLen, 6);
        br.translate(0, bLen * 0.5, 0);
        br.rotateX(tilt);
        br.rotateY(yaw);
        br.translate(0, 1.85, 0);
        tParts.push(br);
      });

      const cParts = [];
      const pads = [
        [0, 3.45, 0, 1.85, 0.58, 1.82],
        [-0.95, 3.18, 0.55, 1.42, 0.5, 1.35],
        [1.02, 3.24, -0.42, 1.38, 0.48, 1.42],
        [0.1, 3.12, -0.92, 1.28, 0.45, 1.22],
      ];
      for (const [px, py, pz, sx, sy, sz] of pads) {
        const g = new THREE.IcosahedronGeometry(1.0, 1);
        g.scale(sx, sy, sz);
        g.translate(px, py, pz);
        cParts.push(g);
      }
      return { trunk: mergeLocalGeoms(tParts), crown: mergeLocalGeoms(cParts) };
    };

    // 3) Feuillu sculpté : tronc fuselé + houppier multi-lobes organique (jamais une simple sphère)
    const buildShadeGeoms = () => {
      const tParts = [];
      const stem = new THREE.CylinderGeometry(0.17, 0.29, 2.55, 7);
      stem.translate(0, 1.275, 0);
      tParts.push(stem);
      const fork = new THREE.CylinderGeometry(0.09, 0.14, 0.95, 6);
      fork.rotateZ(0.45);
      fork.translate(-0.24, 2.35, 0.1);
      tParts.push(fork);

      const cParts = [];
      const lobes = [
        [0.0, 3.65, 0.0, 1.38, 1.24, 1.35],
        [-0.88, 3.05, 0.6, 1.05, 0.92, 1.02],
        [0.86, 3.18, -0.5, 1.02, 0.94, 0.98],
        [0.52, 2.95, 0.85, 0.92, 0.84, 0.92],
        [-0.48, 3.25, -0.8, 0.94, 0.88, 0.96],
      ];
      for (const [lx, ly, lz, sx, sy, sz] of lobes) {
        const g = new THREE.IcosahedronGeometry(1.0, 1);
        g.scale(sx, sy, sz);
        g.translate(lx, ly, lz);
        cParts.push(g);
      }
      return { trunk: mergeLocalGeoms(tParts), crown: mergeLocalGeoms(cParts) };
    };

    // 4) Cyprès / Colonne ornementale : feuillage élancé en grappes organiques effilées (silhouette botanique)
    const buildCypressGeoms = () => {
      const stem = new THREE.CylinderGeometry(0.14, 0.21, 1.25, 7);
      stem.translate(0, 0.625, 0);
      const cParts = [];
      const tiers = [
        [0.0, 1.72, 0.0, 0.82, 0.95, 0.8, 0.2],
        [0.06, 2.52, -0.05, 0.74, 0.98, 0.72, 0.8],
        [-0.05, 3.32, 0.04, 0.62, 0.96, 0.6, 1.5],
        [0.04, 4.1, -0.03, 0.46, 0.9, 0.46, 2.1],
        [-0.02, 4.82, 0.02, 0.3, 0.82, 0.3, 0.4],
      ];
      for (const [cx, cy, cz, sx, sy, sz, ry] of tiers) {
        const g = new THREE.IcosahedronGeometry(1.0, 1);
        g.scale(sx, sy, sz);
        g.rotateY(ry);
        g.translate(cx, cy, cz);
        cParts.push(g);
      }
      return { trunk: stem, crown: mergeLocalGeoms(cParts) };
    };

    const speciesSpecs = {
      palm: {
        geoms: buildPalmGeoms(),
        trunkCol: 0xa69680,
        map: null,
        wind: 0.22,
        radialAnchor: true,
        palette: [0x6f944e, 0x7ea15b, 0x628545, 0x89aa64],
      },
      acacia: {
        geoms: buildAcaciaGeoms(),
        trunkCol: 0x8d7b66,
        map: textures.grass,
        wind: 0.11,
        radialAnchor: false,
        palette: [0x7e955f, 0x8ea36c, 0x6f8754, 0x839962, 0xd4623f, 0xde784b],
      },
      shade: {
        geoms: buildShadeGeoms(),
        trunkCol: 0x978671,
        map: textures.grass,
        wind: 0.12,
        radialAnchor: false,
        palette: [0x6d8e59, 0x7c9c67, 0x8aa773, 0x5f7e4d, 0x93ae78],
      },
      cypress: {
        geoms: buildCypressGeoms(),
        trunkCol: 0x847462,
        map: null,
        wind: 0.09,
        radialAnchor: false,
        palette: [0x4f6f44, 0x5a7b4e, 0x45633c, 0x648356],
      },
    };

    const buckets = { palm: [], acacia: [], shade: [], cypress: [] };
    treePositions.forEach((tp, idx) => {
      const [tx, tz] = tp;
      if (idx === heroGradinTreeIdx) {
        buckets.acacia.push({ tp, forceCol: 0xd4623f }); // Flamboyant parasol sur le gradin central
        return;
      }
      const nearPools = tx > -86 && tx < -18 && tz > -28 && tz < 16;
      const nearBasin = Math.abs(tx) < 34 && Math.abs(tz) < 28;
      const onFormalAxis = Math.abs(tx) > 15 && Math.abs(tx) < 52 && Math.abs(tz) > 6 && Math.abs(tz) < 24;
      const inPark = Math.abs(tx) < 252 && Math.abs(tz) < 30;
      const rRoll = rng();

      let sp = "shade";
      if (nearPools || nearBasin) {
        sp = rRoll < 0.62 ? "palm" : rRoll < 0.85 ? "acacia" : "cypress";
      } else if (onFormalAxis) {
        sp = rRoll < 0.45 ? "cypress" : rRoll < 0.78 ? "palm" : "acacia";
      } else if (inPark) {
        if (rRoll < 0.2) sp = "palm";
        else if (rRoll < 0.5) sp = "acacia";
        else if (rRoll < 0.66) sp = "cypress";
        else sp = "shade";
      } else {
        // Quartiers & avenues extérieures : acacias parasols, feuillus, et quelques palmiers
        if (rRoll < 0.14) sp = "palm";
        else if (rRoll < 0.46) sp = "acacia";
        else if (rRoll < 0.56) sp = "cypress";
        else sp = "shade";
      }
      buckets[sp].push({ tp });
    });

    const dummy = new THREE.Object3D();
    for (const [spName, list] of Object.entries(buckets)) {
      if (!list.length) continue;
      const spec = speciesSpecs[spName];
      const trunkMat = new THREE.MeshStandardMaterial({ color: spec.trunkCol, roughness: 0.93 });
      const crownMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: spec.map || null,
        roughness: 0.86,
      });
      applyWindShader(crownMat, windUniforms, spec.wind, Boolean(spec.radialAnchor));

      const trunks = new THREE.InstancedMesh(spec.geoms.trunk, trunkMat, list.length);
      const crowns = new THREE.InstancedMesh(spec.geoms.crown, crownMat, list.length);
      trunks.castShadow = true;
      crowns.castShadow = true;
      crowns.receiveShadow = true;

      const tmpCol = new THREE.Color();
      list.forEach(({ tp, forceCol }, idx) => {
        const [tx, tz, sc, gy] = tp;
        const rotY = rng() * Math.PI * 2;
        const sY = sc * (0.94 + rng() * 0.14);
        const sXZ = sc * (0.94 + rng() * 0.14);
        dummy.position.set(tx, gy, tz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(sXZ, sY, sXZ);
        dummy.updateMatrix();
        trunks.setMatrixAt(idx, dummy.matrix);
        crowns.setMatrixAt(idx, dummy.matrix);

        let colHex = forceCol;
        if (!colHex) {
          if (spName === "acacia") {
            // ~18% de flamboyants corail-terre cuite parmi les acacias parasols
            colHex = rng() < 0.18 ? spec.palette[4 + (idx % 2)] : spec.palette[idx % 4];
          } else {
            colHex = spec.palette[idx % spec.palette.length];
          }
        }
        tmpCol.setHex(colHex);
        crowns.setColorAt(idx, tmpCol);
      });
      crowns.instanceColor.needsUpdate = true;
      scene.add(trunks, crowns);
    }
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
      bushPositions.push([px, pz, 0.55 + rng() * 0.6, 0.44]);
      added++;
    }
  }

  // Parterre sous la toiture de l'Arcade d'Entrée (z[46]) : uniquement des buissons bas bien dégagés sous la couverture
  [
    [-5.8, -14.8, 0.78],
    [-3.6, -15.6, 0.92],
    [-1.4, -14.2, 0.72],
    [1.6, -14.4, 0.85],
    [3.8, -15.5, 0.9],
    [5.8, -14.6, 0.74],
    [0.0, -16.1, 0.68],
  ].forEach(([bx, bz, sc]) => {
    bushPositions.push([bx, bz, sc, 0.45]);
  });

  // Décorations végétales (arbustes taillés) sur les paliers engazonnés du gradin triangulaire (entre Basket et Beach)
  const triGradin = data.zones.find((z) => z.kind === "gradin" && z.centroid[0] > -180);
  if (triGradin) {
    const ix = -146.27;
    const iz = 10.02;
    const scales = [0.91, 0.73, 0.55, 0.37];
    const tierYs = [-0.17, 0.11, 0.39, 0.67];
    scales.forEach((scRing, tIdx) => {
      const ringPts = triGradin.poly.map(([x, z]) => [ix + (x - ix) * scRing, iz + (z - iz) * scRing]);
      for (let i = 0; i < ringPts.length; i++) {
        const a = ringPts[i];
        const b = ringPts[(i + 1) % ringPts.length];
        const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (segLen < 3.5) continue;
        const steps = Math.max(1, Math.floor(segLen / 5.5));
        for (let k = 1; k <= steps; k++) {
          const u = k / (steps + 1);
          const bx = a[0] + (b[0] - a[0]) * u;
          const bz = a[1] + (b[1] - a[1]) * u;
          // Laisser dégagés les 2 escaliers d'accès (Est et Nord-Ouest)
          if (bx > -139.8 && bz > 5.4 && bz < 8.6) continue;
          if (Math.hypot(bx + 149.2, bz - 1.5) < 2.2) continue;
          bushPositions.push([bx, bz, 0.48 + (k % 2) * 0.16, tierYs[tIdx]]);
        }
      }
    });
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
    bushPositions.forEach(([bx, bz, sc, by = 0.44], idx) => {
      dummy.position.set(bx, by + 0.35 * sc, bz);
      dummy.scale.set(sc * 1.25, sc * 0.72, sc * 1.15);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      bushInst.setMatrixAt(idx, dummy.matrix);
      bushInst.setColorAt(idx, bushPalette[idx % bushPalette.length]);
    });
    bushInst.instanceColor.needsUpdate = true;
    scene.add(bushInst);
  }

  // 3. Fleurs (~460 bouquets sobres) dans les PARTERRE FLEURI, massifs et sur les terrasses du gradin triangulaire
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
      flowerPositions.push([px, pz, 0.7 + rng() * 0.55, 0.5]);
      added++;
    }
  }

  if (triGradin) {
    const ix = -146.27;
    const iz = 10.02;
    const scales = [0.91, 0.73, 0.55, 0.37];
    const tierYs = [-0.17, 0.11, 0.39, 0.67];
    scales.forEach((scRing, tIdx) => {
      const ringPts = triGradin.poly.map(([x, z]) => [ix + (x - ix) * scRing, iz + (z - iz) * scRing]);
      for (let i = 0; i < ringPts.length; i++) {
        const a = ringPts[i];
        const b = ringPts[(i + 1) % ringPts.length];
        const segLen = Math.hypot(b[0] - a[0], b[1] - a[1]);
        if (segLen < 2.8) continue;
        const steps = Math.max(2, Math.floor(segLen / 3.2));
        for (let k = 1; k <= steps; k++) {
          const u = (k - 0.35) / steps;
          const fx = a[0] + (b[0] - a[0]) * u;
          const fz = a[1] + (b[1] - a[1]) * u;
          if (fx > -139.8 && fz > 5.4 && fz < 8.6) continue;
          if (Math.hypot(fx + 149.2, fz - 1.5) < 2.2) continue;
          flowerPositions.push([fx, fz, 0.85 + (k % 3) * 0.2, tierYs[tIdx]]);
        }
      }
    });
    // Couronne fleurie autour de l'arbre central au sommet du gradin
    for (let a = 0; a < 8; a++) {
      const ang = (a / 8) * Math.PI * 2;
      flowerPositions.push([ix + Math.cos(ang) * 1.15, iz + Math.sin(ang) * 1.15, 0.95, 1.26]);
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
    flowerPositions.forEach(([fx, fz, sc, fy = 0.5], idx) => {
      dummy.position.set(fx, fy + 0.18 * sc, fz);
      dummy.scale.set(sc * 1.1, sc * 0.8, sc * 1.1);
      dummy.rotation.y = rng() * Math.PI * 2;
      dummy.updateMatrix();
      flInst.setMatrixAt(idx, dummy.matrix);
      flInst.setColorAt(idx, flColors[idx % flColors.length]);
    });
    flInst.instanceColor.needsUpdate = true;
    scene.add(flInst);
  }

  return {
    treeCount: treePositions.length,
    trees: treePositions,
    bushes: bushPositions,
  };
}

export function buildDayAtmosphere(scene, textures, isMobile = false) {
  const clouds = [];
  const cloudMat = new THREE.MeshBasicMaterial({
    map: textures.cloud,
    transparent: true,
    opacity: 0.0,
    depthWrite: false,
    side: THREE.DoubleSide,
    fog: false,
  });

  // Nuages légers et hauts en altitude (y = 320..520 m) : visibles uniquement en altitude ou à l'horizon lointain,
  // jamais devant le jardin lorsqu'on consulte ou parcourt les espaces.
  const cloudSpecs = [
    [-420, 340, -290, 240, 125, 2.2, 0.2],
    [-160, 380, -340, 270, 140, 1.8, 1.1],
    [110, 355, -310, 255, 132, 2.1, 2.3],
    [380, 395, -330, 280, 145, 1.7, 3.0],
    [-310, 440, -450, 310, 160, 1.5, 4.1],
    [40, 465, -480, 330, 170, 1.9, 5.2],
    [340, 430, -440, 295, 152, 1.6, 0.8],
    [-360, 360, 310, 250, 130, 2.0, 1.9],
    [-40, 410, 360, 285, 148, 1.7, 2.7],
    [290, 375, 325, 260, 135, 2.1, 3.8],
  ];

  for (const [x, y, z, w, h, speed, phase] of cloudSpecs) {
    const billGeo = new THREE.PlaneGeometry(w, h);
    const billMesh = new THREE.Mesh(billGeo, cloudMat);
    billMesh.rotation.x = -Math.PI / 2;
    billMesh.position.set(x, y, z);
    scene.add(billMesh);
    clouds.push({ mesh: billMesh, baseY: y, speed, phase });
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
  const bfMats = bfPalette.map((hex) => {
    const m = bfMat.clone();
    m.color.setHex(hex);
    return m;
  });
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
  const bfTotal = isMobile ? 12 : 24;
  for (let i = 0; i < bfTotal; i++) {
    const anc = bfAnchors[i % bfAnchors.length];
    const g = new THREE.Group();
    const wMat = bfMats[i % bfMats.length];
    const wL = new THREE.Mesh(bfWingGeo, wMat);
    wL.scale.x = -1;
    const wR = new THREE.Mesh(bfWingGeo, wMat);
    g.add(wL, wR);
    butterflyGroup.add(g);
    butterflies.push({
      group: g,
      wL,
      wR,
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
    update(dt, now, nightFactor, camY = 126) {
      const dayFactor = Math.max(0, 1 - nightFactor);
      const tSec = now * 0.001;
      // Invisibles quand on consulte le jardin (< 190 m), apparaissent subtilement uniquement en haute altitude
      const altFactor = THREE.MathUtils.clamp((camY - 190) / 240, 0, 1) *
                        THREE.MathUtils.clamp(1 - (camY - 1400) / 1600, 0, 1);
      cloudMat.opacity = dayFactor * altFactor * 0.48;
      const showClouds = cloudMat.opacity > 0.015;
      for (const c of clouds) {
        c.mesh.visible = showClouds;
        if (!showClouds) continue;
        c.mesh.position.x += c.speed * dt;
        if (c.mesh.position.x > 520) c.mesh.position.x = -520;
        c.mesh.position.y = c.baseY + Math.sin(tSec * 0.3 + c.phase) * 1.2;
      }

      const birdAlpha = THREE.MathUtils.clamp(1 - nightFactor * 1.6, 0, 0.85);
      birdMat.opacity = birdAlpha;
      birdGroup.visible = birdAlpha > 0.02 && camY < 340;
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
      butterflyGroup.visible = bfAlpha > 0.02 && camY < 185;
      if (butterflyGroup.visible) {
        for (const m of bfMats) m.opacity = bfAlpha;
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
        }
      }
    },
  };
}

export function buildUrbanContextLandmarks(scene) {
  const group = new THREE.Group();

  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xf4eee4, roughness: 0.86 });
  const roofTrimMat = new THREE.MeshStandardMaterial({ color: 0xe2d8c8, roughness: 0.82 });
  const padMat = new THREE.MeshStandardMaterial({ color: 0xe6dfd3, roughness: 0.92 });
  const redAccentMat = new THREE.MeshStandardMaterial({
    color: 0xa64234,
    emissive: 0xc84b38,
    emissiveIntensity: 0.18,
    roughness: 0.52,
  });
  const darkSlateMat = new THREE.MeshStandardMaterial({
    color: 0x26292e,
    roughness: 0.5,
    metalness: 0.18,
  });
  const glassMat = new THREE.MeshBasicMaterial({
    color: 0x7c7367,
    transparent: true,
    opacity: 0.76,
  });
  const ledCanopyMat = new THREE.MeshBasicMaterial({
    color: 0xe8e2d8,
  });
  const colMat = new THREE.MeshStandardMaterial({ color: 0xded7cb, roughness: 0.78 });
  const pumpBodyMat = new THREE.MeshStandardMaterial({ color: 0xfbf9f5, roughness: 0.7 });

  // Constructeur d'une station-service architecturale sobre (auvent sur colonnes, plafonniers LED, bandeau terracotta, îlots de pompes, totem éclairé)
  const addServiceStation = ({ cx, cz, canopyW, canopyD, canopyY = 5.4, shopX, shopZ, shopW, shopD, totemX, totemZ }) => {
    const st = new THREE.Group();

    // Dalle piste de distribution (top strictement à 0.19 m, sous les îlots à 0.20 m)
    const pad = new THREE.Mesh(
      new THREE.BoxGeometry(canopyW + 4, 0.14, canopyD + 3),
      padMat
    );
    pad.position.set(cx, 0.12, cz);
    pad.receiveShadow = true;
    st.add(pad);

    // Auvent principal (dalle centrale crème + 4 bandeaux périmétriques terracotta sans aucun chevauchement 3D)
    const rimT = 0.38;
    const canopyH = 0.46;
    const fasciaH = 0.54;
    const canopy = new THREE.Mesh(
      new THREE.BoxGeometry(canopyW - rimT * 2, canopyH, canopyD - rimT * 2),
      stoneMat
    );
    canopy.position.set(cx, canopyY, cz);
    canopy.castShadow = true;
    canopy.receiveShadow = true;

    const fasciaN = new THREE.Mesh(new THREE.BoxGeometry(canopyW, fasciaH, rimT), redAccentMat);
    fasciaN.position.set(cx, canopyY, cz - (canopyD - rimT) * 0.5);
    const fasciaS = new THREE.Mesh(new THREE.BoxGeometry(canopyW, fasciaH, rimT), redAccentMat);
    fasciaS.position.set(cx, canopyY, cz + (canopyD - rimT) * 0.5);
    const fasciaW = new THREE.Mesh(
      new THREE.BoxGeometry(rimT, fasciaH, canopyD - rimT * 2),
      redAccentMat
    );
    fasciaW.position.set(cx - (canopyW - rimT) * 0.5, canopyY, cz);
    const fasciaE = new THREE.Mesh(
      new THREE.BoxGeometry(rimT, fasciaH, canopyD - rimT * 2),
      redAccentMat
    );
    fasciaE.position.set(cx + (canopyW - rimT) * 0.5, canopyY, cz);
    st.add(canopy, fasciaN, fasciaS, fasciaW, fasciaE);

    // Colonnes porteuses, plafonniers LED sous auvent et îlots de pompes à essence
    const colH = canopyY - canopyH * 0.5 - 0.2;
    const colGeo = new THREE.CylinderGeometry(0.24, 0.26, colH, 10);
    const islandGeo = new THREE.BoxGeometry(4.4, 0.22, 1.35);
    const pumpGeo = new THREE.BoxGeometry(0.95, 1.5, 0.65);
    const pumpTopGeo = new THREE.BoxGeometry(1.0, 0.26, 0.7);
    const ledGeo = new THREE.BoxGeometry(2.6, 0.08, 1.15);

    const xOffsets = [-canopyW * 0.34, 0, canopyW * 0.34];
    for (const ox of xOffsets) {
      for (const sz of [-1, 1]) {
        const col = new THREE.Mesh(colGeo, colMat);
        col.position.set(cx + ox, 0.2 + colH * 0.5, cz + sz * (canopyD * 0.34));
        col.castShadow = true;
        st.add(col);
      }

      // Plafonnier LED lumineux sous l'auvent au-dessus de chaque îlot de pompe
      const ceilingLed = new THREE.Mesh(ledGeo, ledCanopyMat);
      ceilingLed.position.set(cx + ox, canopyY - canopyH * 0.5 - 0.05, cz);
      st.add(ceilingLed);

      const isl = new THREE.Mesh(islandGeo, roofTrimMat);
      isl.position.set(cx + ox, 0.31, cz);
      const pump = new THREE.Mesh(pumpGeo, pumpBodyMat);
      pump.position.set(cx + ox, 1.17, cz);
      pump.castShadow = true;
      const pTop = new THREE.Mesh(pumpTopGeo, redAccentMat);
      pTop.position.set(cx + ox, 2.05, cz);
      const pScreen = new THREE.Mesh(new THREE.BoxGeometry(0.55, 0.42, 0.72), ledCanopyMat);
      pScreen.position.set(cx + ox, 1.42, cz);
      st.add(isl, pump, pTop, pScreen);
    }

    // Boutique / bâtiment de station avec vitrine et porte éclairées
    if (shopW && shopD) {
      const shop = new THREE.Mesh(new THREE.BoxGeometry(shopW, 4.0, shopD), stoneMat);
      shop.position.set(shopX, 2.2, shopZ);
      shop.castShadow = true;
      shop.receiveShadow = true;
      const sideBySide = Math.abs(cz - shopZ) < 1.5;
      const shopGlass = new THREE.Mesh(
        new THREE.BoxGeometry(sideBySide ? 0.12 : shopW * 0.72, 2.3, sideBySide ? shopD * 0.72 : 0.12),
        glassMat
      );
      if (sideBySide) {
        shopGlass.position.set(
          shopX + (cx > shopX ? shopW * 0.5 + 0.08 : -shopW * 0.5 - 0.08),
          1.65,
          shopZ
        );
      } else {
        shopGlass.position.set(
          shopX,
          1.65,
          shopZ + (cz > shopZ ? shopD * 0.5 + 0.08 : -shopD * 0.5 - 0.08)
        );
      }
      st.add(shop, shopGlass);
    }

    // Totem prix en bordure de voie avec afficheurs LED lumineux
    const totemBody = new THREE.Mesh(new THREE.BoxGeometry(1.45, 4.4, 0.48), darkSlateMat);
    totemBody.position.set(totemX, 2.3, totemZ);
    totemBody.castShadow = true;
    const totemCap = new THREE.Mesh(new THREE.BoxGeometry(1.5, 1.3, 0.54), redAccentMat);
    totemCap.position.set(totemX, 5.15, totemZ);
    const totemDisplay = new THREE.Mesh(new THREE.BoxGeometry(1.05, 1.85, 0.56), ledCanopyMat);
    totemDisplay.position.set(totemX, 3.15, totemZ);
    st.add(totemBody, totemCap, totemDisplay);

    group.add(st);
  };

  // 1. Station-service Nord-Ouest (sur la grande parcelle d'angle X=-236, Z=-68)
  addServiceStation({
    cx: -236,
    cz: -60,
    canopyW: 22,
    canopyD: 12.5,
    canopyY: 5.5,
    shopX: -236,
    shopZ: -78,
    shopW: 20,
    shopD: 9.5,
    totemX: -255,
    totemZ: -46,
  });

  // 2. Station-service Ouest (en face du terrain de football, parcelle Nord-Sud z=[-15..-1], X=-292, Z=-7.5)
  addServiceStation({
    cx: -288,
    cz: -7.5,
    canopyW: 16,
    canopyD: 9.2,
    canopyY: 5.3,
    shopX: -308,
    shopZ: -7.5,
    shopW: 12,
    shopD: 8.2,
    totemX: -274,
    totemZ: -12.5,
  });

  // 3. Banque (parcelle Nord face à la boucle d'accès, X=-121, Z=-73 : édifice sobre à façade anthracite & colonnade)
  const bankGroup = new THREE.Group();
  const bx = -120.6;
  const bz = -73.1;

  // Parvis et marches de la banque (strates Y strictement disjointes)
  const bankPlinth = new THREE.Mesh(new THREE.BoxGeometry(24, 0.32, 22), roofTrimMat);
  bankPlinth.position.set(bx, 0.2, bz);
  bankPlinth.receiveShadow = true;

  // Volume architectural principal + corniche et bandeau anthracite (sans chevauchement)
  const bankCore = new THREE.Mesh(new THREE.BoxGeometry(18.5, 8.8, 16.5), stoneMat);
  bankCore.position.set(bx, 4.76, bz);
  bankCore.castShadow = true;
  bankCore.receiveShadow = true;

  const bankCrown = new THREE.Mesh(new THREE.BoxGeometry(19.4, 0.7, 17.4), darkSlateMat);
  bankCrown.position.set(bx, 9.51, bz);
  bankCrown.castShadow = true;

  const bankRoofTop = new THREE.Mesh(new THREE.BoxGeometry(17.8, 0.3, 15.8), roofTrimMat);
  bankRoofTop.position.set(bx, 10.01, bz);
  bankRoofTop.receiveShadow = true;

  // Façade vitrée Sud face à la demi-lune et au jardin + portique anthracite + porte éclairée et bandeau lumineux sous corniche
  const bankGlass = new THREE.Mesh(new THREE.BoxGeometry(14.8, 6.8, 0.14), glassMat);
  bankGlass.position.set(bx, 4.2, bz + 8.35);

  const portalFrame = new THREE.Mesh(new THREE.BoxGeometry(7.6, 5.2, 0.9), darkSlateMat);
  portalFrame.position.set(bx, 2.96, bz + 8.9);
  portalFrame.castShadow = true;

  const bankDoorLight = new THREE.Mesh(new THREE.BoxGeometry(2.4, 2.8, 0.12), ledCanopyMat);
  bankDoorLight.position.set(bx, 1.76, bz + 9.38);

  const bankCorniceLight = new THREE.Mesh(new THREE.BoxGeometry(18.8, 0.14, 16.8), ledCanopyMat);
  bankCorniceLight.position.set(bx, 9.1, bz);

  // 4 colonnes de façade + spots au pied des colonnes
  const bColGeo = new THREE.CylinderGeometry(0.28, 0.3, 7.6, 12);
  const bSpotGeo = new THREE.CylinderGeometry(0.36, 0.38, 0.14, 10);
  for (const ox of [-6.8, -2.6, 2.6, 6.8]) {
    const c = new THREE.Mesh(bColGeo, colMat);
    c.position.set(bx + ox, 4.0, bz + 8.75);
    c.castShadow = true;
    const sp = new THREE.Mesh(bSpotGeo, ledCanopyMat);
    sp.position.set(bx + ox, 0.42, bz + 8.75);
    bankGroup.add(c, sp);
  }

  bankGroup.add(bankPlinth, bankCore, bankCrown, bankRoofTop, bankGlass, portalFrame, bankDoorLight, bankCorniceLight);
  group.add(bankGroup);

  scene.add(group);

  const dayStone = new THREE.Color(0xf4eee4);
  const nightStone = new THREE.Color(0x28364a);
  const dayTrim = new THREE.Color(0xe2d8c8);
  const nightTrim = new THREE.Color(0x232f42);
  const dayPad = new THREE.Color(0xe6dfd3);
  const nightPad = new THREE.Color(0x222c3c);
  const dayGlass = new THREE.Color(0x7c7367);
  const nightGlass = new THREE.Color(0xffd28a);
  const dayLed = new THREE.Color(0xdad2c6);
  const nightLed = new THREE.Color(0xfff1c4);

  return {
    group,
    updateNight(f) {
      stoneMat.color.lerpColors(dayStone, nightStone, f);
      roofTrimMat.color.lerpColors(dayTrim, nightTrim, f);
      padMat.color.lerpColors(dayPad, nightPad, f);
      colMat.color.lerpColors(dayTrim, nightStone, f);
      pumpBodyMat.color.lerpColors(dayStone, nightTrim, f);
      const winF = THREE.MathUtils.smoothstep(f, 0.12, 0.92);
      glassMat.color.lerpColors(dayGlass, nightGlass, winF);
      glassMat.opacity = THREE.MathUtils.lerp(0.76, 0.9, winF);
      ledCanopyMat.color.lerpColors(dayLed, nightLed, winF);
      redAccentMat.emissiveIntensity = THREE.MathUtils.lerp(0.18, 1.15, winF);
    },
  };
}
