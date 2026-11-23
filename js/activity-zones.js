import * as THREE from "three";
import { mergeNormalizedGeoms } from "./garden-assets.js";

/**
 * Build dedicated 3D outdoor apparatus on the hard-surface activity slabs (top y = 0.400 m):
 * - z[71] (x=74.3, z=-15.5): Fitness Doux 3e Âge (Tai-Chi wheels, pedal bikes, air walkers, parallel bars, stretching)
 * - z[45] (x=-26.5, z=-15.5) & z[70] (x=26.5, z=-15.5): Loisirs Enfants Sol Dur (play tower + slide, spring rockers,
 *   stepping stones, geodesic climbing dome, twin swings, inclusive carousel, seesaw, hopscotch & scooter track)
 */
export function buildActivityZones(scene, _data) {
  const baseY = 0.4;

  const buckets = {
    steel: [],
    wood: [],
    terracotta: [],
    teal: [],
    ochre: [],
    white: [],
  };

  const applyXform = (g, cx, cy, cz, rx = 0, ry = 0, rz = 0) => {
    if (rx) g.rotateX(rx);
    if (ry) g.rotateY(ry);
    if (rz) g.rotateZ(rz);
    g.translate(cx, cy, cz);
    return g;
  };

  const addBox = (list, cx, cy, cz, sx, sy, sz, rx = 0, ry = 0, rz = 0) => {
    list.push(applyXform(new THREE.BoxGeometry(sx, sy, sz), cx, cy, cz, rx, ry, rz));
  };

  const addCyl = (list, cx, cy, cz, rt, rb, h, segs = 10, rx = 0, ry = 0, rz = 0) => {
    list.push(applyXform(new THREE.CylinderGeometry(rt, rb, h, segs), cx, cy, cz, rx, ry, rz));
  };

  const addTorus = (list, cx, cy, cz, r, tube, rx = 0, ry = 0, rz = 0) => {
    list.push(applyXform(new THREE.TorusGeometry(r, tube, 8, 20), cx, cy, cz, rx, ry, rz));
  };

  const addSphere = (list, cx, cy, cz, r, segs = 10) => {
    list.push(applyXform(new THREE.SphereGeometry(r, segs, segs), cx, cy, cz));
  };

  const addEpDMFloor = (cx, cz, w, d, colorHex, borderHex = 0xe8dfd1, y0 = baseY) => {
    const outer = new THREE.Mesh(
      new THREE.BoxGeometry(w + 0.24, 0.016, d + 0.24),
      new THREE.MeshStandardMaterial({ color: borderHex, roughness: 0.9, metalness: 0 })
    );
    outer.position.set(cx, y0 + 0.008, cz);
    outer.receiveShadow = true;
    const inner = new THREE.Mesh(
      new THREE.BoxGeometry(w, 0.022, d),
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.88, metalness: 0 })
    );
    inner.position.set(cx, y0 + 0.012, cz);
    inner.receiveShadow = true;
    scene.add(outer, inner);
  };

  const addStrut = (list, p0, p1, r, segs = 8) => {
    const a = new THREE.Vector3(...p0);
    const b = new THREE.Vector3(...p1);
    const diff = b.clone().sub(a);
    const len = diff.length();
    if (len < 0.03) return;
    const mid = a.clone().addScaledVector(diff, 0.5);
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), diff.normalize());
    const g = new THREE.CylinderGeometry(r, r, len, segs);
    g.applyMatrix4(new THREE.Matrix4().compose(mid, q, new THREE.Vector3(1, 1, 1)));
    list.push(g);
  };

  const addRingPad = (cx, cz, r, colorHex, ringCol = true) => {
    const g = new THREE.CylinderGeometry(r, r, 0.014, 28);
    g.translate(cx, baseY + 0.007, cz);
    const m = new THREE.Mesh(
      g,
      new THREE.MeshStandardMaterial({ color: colorHex, roughness: 0.9, metalness: 0 })
    );
    m.receiveShadow = true;
    scene.add(m);
    if (ringCol) {
      const rg = new THREE.RingGeometry(r - 0.14, r - 0.02, 28);
      rg.rotateX(-Math.PI / 2);
      rg.translate(cx, baseY + 0.016, cz);
      const rm = new THREE.Mesh(
        rg,
        new THREE.MeshBasicMaterial({ color: 0xf4efe6, side: THREE.DoubleSide })
      );
      scene.add(rm);
    }
  };

  const addBench = (cx, cz, rotY) => {
    const dx = Math.cos(rotY);
    const dz = -Math.sin(rotY);
    const bx = Math.sin(rotY);
    const bz = Math.cos(rotY);
    for (const sx of [-0.72, 0.72]) {
      addBox(buckets.steel, cx + dx * sx, baseY + 0.2, cz + dz * sx, 0.12, 0.4, 0.44, 0, rotY, 0);
    }
    addBox(buckets.wood, cx, baseY + 0.43, cz, 2.0, 0.09, 0.5, 0, rotY, 0);
    addBox(buckets.wood, cx - bx * 0.22, baseY + 0.68, cz - bz * 0.22, 2.0, 0.28, 0.08, -0.14, rotY, 0);
  };

  const addHopscotch = (cx, cz) => {
    const tileCols = [buckets.ochre, buckets.teal, buckets.terracotta];
    // Classic 1-2-1-2-1-2-1 hopscotch sequence pointing North (-Z), compact so all 10 tiles stay strictly on slab
    const layout = [
      [0, 0],
      [-0.22, -0.42],
      [0.22, -0.42],
      [0, -0.84],
      [-0.22, -1.26],
      [0.22, -1.26],
      [0, -1.68],
      [-0.22, -2.1],
      [0.22, -2.1],
      [0, -2.52],
    ];
    layout.forEach(([ox, oz], idx) => {
      addBox(buckets.white, cx + ox, baseY + 0.009, cz + oz, 0.42, 0.008, 0.39);
      addBox(tileCols[idx % tileCols.length], cx + ox, baseY + 0.012, cz + oz, 0.34, 0.01, 0.31);
    });
  };

  // =========================================================================
  // 1. FITNESS DOUX 3e ÂGE — z[71] (Croix rouge, 436 m², centre 74.3, -15.5)
  // =========================================================================
  {
    addRingPad(74.3, -16.8, 5.4, 0x96ab9e, true);
    addRingPad(64.8, -19.2, 3.2, 0xdba374, false);
    addRingPad(83.8, -19.2, 3.2, 0xdba374, false);
    addRingPad(74.3, -8.8, 2.6, 0x7bb4bc, false);

    // 2 x Tai-Chi Shoulder Wheels (left & right corners)
    for (const [tx, tz] of [
      [64.8, -19.2],
      [83.8, -19.2],
    ]) {
      addCyl(buckets.steel, tx, baseY + 0.04, tz, 0.22, 0.26, 0.06, 12);
      addCyl(buckets.steel, tx, baseY + 0.85, tz, 0.055, 0.065, 1.62, 10);
      addBox(buckets.steel, tx, baseY + 1.32, tz, 0.86, 0.08, 0.08);
      for (const sx of [-0.38, 0.38]) {
        addTorus(buckets.teal, tx + sx, baseY + 1.32, tz + 0.08, 0.34, 0.032, 0, 0, 0);
        addCyl(buckets.ochre, tx + sx + 0.22, baseY + 1.48, tz + 0.13, 0.03, 0.03, 0.12, 8, Math.PI / 2);
      }
    }

    // 2 x Seated Gentle Pedal Exercisers
    for (const [px, pz, rotY] of [
      [70.8, -16.2, 0.22],
      [77.8, -16.2, -0.22],
    ]) {
      const c = Math.cos(rotY);
      const s = Math.sin(rotY);
      const toW = (lx, ly, lz) => [px + lx * c + lz * s, baseY + ly, pz - lx * s + lz * c];
      addStrut(buckets.steel, toW(0, 0.04, -0.45), toW(0, 0.16, 0.55), 0.045, 8);
      addStrut(buckets.steel, toW(0, 0.12, -0.25), toW(0, 0.72, -0.35), 0.045, 8);
      addStrut(buckets.steel, toW(0, 0.16, 0.25), toW(0, 1.05, 0.42), 0.04, 8);
      addBox(buckets.terracotta, ...toW(0, 0.74, -0.32), 0.42, 0.08, 0.4, 0, rotY, 0);
      addBox(buckets.terracotta, ...toW(0, 0.98, -0.5), 0.4, 0.38, 0.07, -0.15, rotY, 0);
      addCyl(buckets.ochre, ...toW(0, 1.08, 0.42), 0.028, 0.028, 0.52, 8, 0, rotY, Math.PI / 2);
      addCyl(buckets.steel, ...toW(0, 0.34, 0.44), 0.16, 0.16, 0.08, 12, 0, rotY, Math.PI / 2);
    }

    // 2 x Air-Walker Elliptical Gliders
    for (const [wx, wz] of [
      [72.2, -19.5],
      [76.4, -19.5],
    ]) {
      addCyl(buckets.steel, wx - 0.36, baseY + 0.04, wz, 0.14, 0.18, 0.06, 10);
      addCyl(buckets.steel, wx + 0.36, baseY + 0.04, wz, 0.14, 0.18, 0.06, 10);
      addStrut(buckets.steel, [wx - 0.36, baseY + 0.06, wz], [wx - 0.36, baseY + 1.38, wz], 0.042, 8);
      addStrut(buckets.steel, [wx + 0.36, baseY + 0.06, wz], [wx + 0.36, baseY + 1.38, wz], 0.042, 8);
      addStrut(buckets.steel, [wx - 0.38, baseY + 1.38, wz], [wx + 0.38, baseY + 1.38, wz], 0.045, 8);
      for (const sx of [-0.15, 0.15]) {
        const swingZ = sx < 0 ? 0.18 : -0.18;
        addStrut(buckets.teal, [wx + sx, baseY + 1.36, wz], [wx + sx, baseY + 0.24, wz + swingZ], 0.03, 6);
        addBox(buckets.ochre, wx + sx, baseY + 0.22, wz + swingZ, 0.16, 0.05, 0.32);
      }
    }

    // Parallel Mobility & Balance Handrails (4.2 m dual rails at h = 0.92 m)
    addBox(buckets.ochre, 74.3, baseY + 0.015, -12.6, 4.4, 0.02, 1.05);
    for (const sz of [-13.02, -12.18]) {
      addStrut(buckets.teal, [72.2, baseY + 0.92, sz], [76.4, baseY + 0.92, sz], 0.036, 8);
      for (const px of [72.3, 74.3, 76.3]) {
        addStrut(buckets.steel, [px, baseY + 0.02, sz], [px, baseY + 0.92, sz], 0.038, 8);
      }
    }

    // Multi-height Stretching & Balance Step Station (74.3, -8.8)
    for (const [px, h] of [
      [73.1, 0.9],
      [74.3, 1.2],
      [75.5, 1.5],
    ]) {
      addStrut(buckets.steel, [px, baseY + 0.02, -8.8], [px, baseY + h, -8.8], 0.045, 8);
    }
    addStrut(buckets.terracotta, [73.1, baseY + 0.88, -8.8], [74.3, baseY + 0.88, -8.8], 0.032, 8);
    addStrut(buckets.teal, [74.3, baseY + 1.18, -8.8], [75.5, baseY + 1.18, -8.8], 0.032, 8);
    addStrut(buckets.ochre, [74.3, baseY + 1.46, -8.8], [75.5, baseY + 1.46, -8.8], 0.032, 8);
    addBox(buckets.wood, 73.7, baseY + 0.14, -7.9, 0.85, 0.24, 0.45);
    addBox(buckets.wood, 74.9, baseY + 0.2, -7.9, 0.85, 0.36, 0.45);

    // Rest Benches & Senior Mobility Info Totem
    addBench(68.2, -21.2, 0.35);
    addBench(80.4, -21.2, -0.35);
    addBox(buckets.steel, 74.3, baseY + 0.9, -5.6, 0.56, 1.75, 0.14);
    addBox(buckets.ochre, 74.3, baseY + 1.25, -5.52, 0.42, 0.72, 0.03);
  }

  // =========================================================================
  // 2. LOISIRS ENFANTS SOL DUR OUEST — z[45] (Croix bleue Ouest, -26.5, -15.5)
  // =========================================================================
  {
    addRingPad(-26.5, -15.5, 4.4, 0xdba374, true);
    addRingPad(-35.8, -19.2, 3.2, 0x7bb4bc, true);
    addRingPad(-19.3, -18.8, 2.5, 0x8ea97c, false);

    // Multi-Activity Play Tower + Angled Terracotta Slide + Access Steps
    for (const sx of [-27.4, -25.6]) {
      for (const sz of [-16.4, -14.6]) {
        addBox(buckets.wood, sx, baseY + 1.48, sz, 0.15, 2.96, 0.15);
      }
    }
    addBox(buckets.wood, -26.5, baseY + 1.45, -15.5, 1.92, 0.14, 1.92);
    // Safety guardrails around upper deck
    addBox(buckets.teal, -26.5, baseY + 2.05, -16.4, 1.76, 0.55, 0.08);
    addBox(buckets.teal, -27.4, baseY + 2.05, -15.5, 0.08, 0.55, 1.76);
    // Pitched roof over tower
    addBox(buckets.terracotta, -26.5, baseY + 3.06, -15.92, 2.25, 0.1, 1.3, -0.38, 0, 0);
    addBox(buckets.terracotta, -26.5, baseY + 3.06, -15.08, 2.25, 0.1, 1.3, 0.38, 0, 0);
    // Wide slide chute toward +Z (-15.5 -> -12.6)
    addStrut(buckets.terracotta, [-26.5, baseY + 1.44, -14.55], [-26.5, baseY + 0.18, -12.55], 0.28, 6);
    addBox(buckets.steel, -26.5, baseY + 0.18, -12.5, 0.62, 0.24, 0.52);
    // Climbing ramp & wooden steps on West (-X) side
    for (let st = 0; st < 4; st++) {
      addBox(buckets.ochre, -27.6 - st * 0.26, baseY + 1.15 - st * 0.28, -15.5, 0.32, 0.1, 0.88);
    }

    // 3 x Spring Rockers (clear of slide chute)
    for (const [rx, rz, matList] of [
      [-23.2, -13.6, buckets.ochre],
      [-29.5, -13.6, buckets.teal],
      [-29.4, -17.4, buckets.terracotta],
    ]) {
      addCyl(buckets.steel, rx, baseY + 0.2, rz, 0.075, 0.09, 0.38, 8);
      addBox(matList, rx, baseY + 0.44, rz, 0.36, 0.18, 0.62);
      addBox(buckets.wood, rx, baseY + 0.62, rz + 0.16, 0.34, 0.22, 0.12);
    }

    // Scooter / Balance-Bike Track Loop Ring (-35.8, -19.2)
    addTorus(buckets.ochre, -35.8, baseY + 0.018, -19.2, 2.25, 0.24, Math.PI / 2, 0, 0);
    addTorus(buckets.white, -35.8, baseY + 0.025, -19.2, 2.25, 0.025, Math.PI / 2, 0, 0);
    // Miniature balance-bike cones around loop
    for (let a = 0; a < 4; a++) {
      const ang = (a / 4) * Math.PI * 2 + 0.4;
      addCyl(buckets.terracotta, -35.8 + Math.cos(ang) * 1.1, baseY + 0.22, -19.2 + Math.sin(ang) * 1.1, 0.04, 0.14, 0.38, 8);
    }

    // Agility Stepping-Stones & Low Balance Beam (-19.3, -18.8)
    const stepCoords = [
      [-20.5, -17.9, 0.24, buckets.terracotta],
      [-19.8, -19.0, 0.34, buckets.ochre],
      [-18.8, -18.0, 0.42, buckets.teal],
      [-18.0, -19.1, 0.32, buckets.terracotta],
      [-19.2, -20.0, 0.26, buckets.ochre],
    ];
    for (const [sx, sz, sh, list] of stepCoords) {
      addCyl(list, sx, baseY + sh * 0.5, sz, 0.3, 0.33, sh, 12);
    }
    addBox(buckets.wood, -19.3, baseY + 0.28, -18.8, 2.0, 0.12, 0.2, 0, 0.45, 0);

    addHopscotch(-26.5, -19.8);
    addBench(-22.5, -21.6, 0);
    addBench(-31.5, -21.6, 0);
  }

  // =========================================================================
  // 3. LOISIRS ENFANTS SOL DUR EST — z[70] (Croix bleue Est, 26.5, -15.5)
  // =========================================================================
  {
    addRingPad(26.5, -15.5, 4.4, 0x7bb4bc, true);
    addRingPad(35.8, -19.0, 3.2, 0xdba374, false);
    addRingPad(19.3, -18.8, 2.5, 0x8ea97c, false);

    // Geodesic Climbing Dome (26.5, -15.5)
    {
      const domeR = 2.15;
      const ico = new THREE.IcosahedronGeometry(domeR, 1).toNonIndexed();
      const posArr = ico.attributes.position.array;
      const seen = new Set();
      const key = (v) => `${Math.round(v.x * 100)},${Math.round(v.y * 100)},${Math.round(v.z * 100)}`;
      for (let i = 0; i < posArr.length; i += 9) {
        const vs = [0, 1, 2].map((k) => new THREE.Vector3(posArr[i + k * 3], posArr[i + k * 3 + 1], posArr[i + k * 3 + 2]));
        for (const [ia, ib] of [
          [0, 1],
          [1, 2],
          [2, 0],
        ]) {
          const va = vs[ia];
          const vb = vs[ib];
          if (va.y < -0.15 || vb.y < -0.15) continue;
          const kA = key(va);
          const kB = key(vb);
          const pair = kA < kB ? `${kA}|${kB}` : `${kB}|${kA}`;
          if (seen.has(pair)) continue;
          seen.add(pair);
          const ya = Math.max(0, va.y) * 0.88 + baseY;
          const yb = Math.max(0, vb.y) * 0.88 + baseY;
          const list = seen.size % 2 === 0 ? buckets.terracotta : buckets.teal;
          addStrut(list, [26.5 + va.x, ya, -15.5 + va.z], [26.5 + vb.x, yb, -15.5 + vb.z], 0.042, 6);
        }
      }
      ico.dispose();
    }

    // Twin-Bay Swing Set (35.8, -19.0)
    {
      const sx = 35.8;
      const sz = -19.0;
      const topH = baseY + 2.52;
      addStrut(buckets.steel, [sx - 1.85, topH, sz], [sx + 1.85, topH, sz], 0.06, 8);
      for (const px of [-1.75, 1.75]) {
        addStrut(buckets.steel, [sx + px, topH, sz], [sx + px + (px < 0 ? -0.18 : 0.18), baseY + 0.02, sz - 0.95], 0.048, 8);
        addStrut(buckets.steel, [sx + px, topH, sz], [sx + px + (px < 0 ? -0.18 : 0.18), baseY + 0.02, sz + 0.95], 0.048, 8);
      }
      for (const ox of [-0.65, 0.65]) {
        for (const chainOff of [-0.22, 0.22]) {
          addStrut(buckets.steel, [sx + ox + chainOff, topH - 0.04, sz], [sx + ox + chainOff, baseY + 0.56, sz + 0.1], 0.016, 5);
        }
        addBox(ox < 0 ? buckets.terracotta : buckets.ochre, sx + ox, baseY + 0.54, sz + 0.1, 0.48, 0.06, 0.24);
      }
    }

    // Flush Inclusive Carousel / Tourniquet (19.3, -18.8)
    addCyl(buckets.ochre, 19.3, baseY + 0.05, -18.8, 1.05, 1.08, 0.08, 20);
    addCyl(buckets.steel, 19.3, baseY + 0.52, -18.8, 0.06, 0.07, 0.88, 10);
    addTorus(buckets.teal, 19.3, baseY + 0.88, -18.8, 0.42, 0.03, Math.PI / 2, 0, 0);
    for (let i = 0; i < 4; i++) {
      const a = (i / 4) * Math.PI * 2;
      addStrut(buckets.steel, [19.3 + Math.cos(a) * 0.92, baseY + 0.08, -18.8 + Math.sin(a) * 0.92], [19.3 + Math.cos(a) * 0.55, baseY + 0.78, -18.8 + Math.sin(a) * 0.55], 0.03, 6);
    }

    // Wooden Seesaw / Tape-cul (26.5, -10.4)
    addCyl(buckets.steel, 26.5, baseY + 0.24, -10.4, 0.14, 0.18, 0.46, 10);
    addBox(buckets.wood, 26.5, baseY + 0.48, -10.4, 3.2, 0.1, 0.34, 0, 0, 0.14);
    addBox(buckets.terracotta, 25.15, baseY + 0.34, -10.4, 0.36, 0.1, 0.34);
    addBox(buckets.ochre, 27.85, baseY + 0.72, -10.4, 0.36, 0.1, 0.34);

    addHopscotch(26.5, -19.8);
    addBench(22.5, -21.6, 0);
    addBench(31.5, -21.6, 0);
  }

  // =========================================================================
  // 4. FITNESS JEUNES & ADULTES (Zone 44: Triangle [-96.6.. -54.8] x [2.15.. 23.0], baseY = 0.425 m)
  // =========================================================================
  {
    const baseY = 0.425;
    // EPDM shock-absorbing athletic pads
    addEpDMFloor(-75.7, 15.8, 12.2, 6.2, 0x3b6e8c, 0xd9dad7, baseY); // Central Calisthenics Rig pad
    addEpDMFloor(-84.8, 19.2, 5.8, 4.0, 0xc25b43, 0xe8dfd1, baseY); // West Strength & Plyo pad
    addEpDMFloor(-66.6, 19.2, 5.8, 4.0, 0x3f7b70, 0xe8dfd1, baseY); // East Core & Dip pad
    addEpDMFloor(-75.7, 8.8, 5.6, 3.6, 0xc88e3e, 0xe8dfd1, baseY); // North Battle Rope & Stretch pad

    // Central Street-Workout Calisthenics Rig (-75.7, 15.8)
    const rx = -75.7;
    const rz = 15.8;
    const rigPosts = [
      [-4.2, -1.6, 2.55],
      [-1.4, -1.6, 2.55],
      [1.4, -1.6, 2.55],
      [4.2, -1.6, 2.55],
      [-4.2, 1.6, 2.55],
      [-1.4, 1.6, 2.55],
      [1.4, 1.6, 2.55],
      [4.2, 1.6, 2.55],
    ];
    for (const [px, pz, ph] of rigPosts) {
      addCyl(buckets.steel, rx + px, baseY + ph * 0.5, rz + pz, 0.058, 0.064, ph, 8);
      addCyl(buckets.ochre, rx + px, baseY + 0.05, rz + pz, 0.11, 0.13, 0.1, 8);
    }
    // High pull-up bars & perimeter beams
    for (const pz of [-1.6, 1.6]) {
      addStrut(buckets.terracotta, [rx - 4.2, baseY + 2.38, rz + pz], [rx + 4.2, baseY + 2.38, rz + pz], 0.036, 8);
    }
    for (const px of [-4.2, -1.4, 1.4, 4.2]) {
      addStrut(buckets.terracotta, [rx + px, baseY + 2.45, rz - 1.6], [rx + px, baseY + 2.45, rz + 1.6], 0.038, 8);
    }
    // Monkey-bar overhead horizontal ladder between x = -4.2 and x = +1.4
    for (const lz of [-0.55, 0.55]) {
      addStrut(buckets.steel, [rx - 4.2, baseY + 2.48, rz + lz], [rx + 1.4, baseY + 2.48, rz + lz], 0.038, 8);
    }
    for (let mx = -3.8; mx <= 1.05; mx += 0.48) {
      addStrut(buckets.ochre, [rx + mx, baseY + 2.48, rz - 0.55], [rx + mx, baseY + 2.48, rz + 0.55], 0.026, 6);
    }
    // Swedish wall bars (espalier) on East bay (x = 1.4..4.2, z = 1.6)
    for (let wy = 0.45; wy <= 2.25; wy += 0.3) {
      addStrut(buckets.ochre, [rx + 1.4, baseY + wy, rz + 1.6], [rx + 4.2, baseY + wy, rz + 1.6], 0.025, 6);
    }
    // Gymnastic rings hanging in East bay
    for (const gx of [2.35, 3.25]) {
      addStrut(buckets.steel, [rx + gx, baseY + 2.45, rz], [rx + gx, baseY + 1.48, rz], 0.015, 6);
      addTorus(buckets.wood, rx + gx, baseY + 1.38, rz, 0.11, 0.022, 0, 0, 0);
    }
    // Punching bag / sac de frappe suspended on West side
    addStrut(buckets.steel, [rx - 2.8, baseY + 2.45, rz], [rx - 2.8, baseY + 1.95, rz], 0.02, 6);
    addCyl(buckets.terracotta, rx - 2.8, baseY + 1.35, rz, 0.22, 0.22, 1.15, 12);

    // West Pad (-84.8, 19.2): Plyometric Jump Boxes + Kettlebell & Dumbbell Rack
    addBox(buckets.terracotta, -86.2, baseY + 0.22, 19.2, 0.75, 0.42, 0.75);
    addBox(buckets.ochre, -84.9, baseY + 0.3, 19.2, 0.82, 0.58, 0.82);
    addBox(buckets.teal, -83.5, baseY + 0.38, 19.2, 0.88, 0.74, 0.88);
    // Weight rack
    addBox(buckets.steel, -84.8, baseY + 0.45, 20.6, 2.2, 0.85, 0.45);
    for (let wx = -0.8; wx <= 0.8; wx += 0.4) {
      addSphere(buckets.terracotta, -84.8 + wx, baseY + 0.96, 20.6, 0.13);
    }

    // East Pad (-66.6, 19.2): Double Parallel Dip Bars & 2 Incline Abs Benches
    for (const dz of [-0.45, 0.45]) {
      for (const dx of [-1.1, 1.1]) {
        addCyl(buckets.steel, -67.8 + dx, baseY + 0.58, 19.2 + dz, 0.036, 0.04, 1.15, 8);
      }
      addStrut(buckets.ochre, [-68.9, baseY + 1.15, 19.2 + dz], [-66.7, baseY + 1.15, 19.2 + dz], 0.034, 8);
    }
    for (const bx of [-65.4, -64.4]) {
      addBox(buckets.terracotta, bx, baseY + 0.36, 19.2, 0.5, 0.08, 1.65, 0.22, 0, 0);
      addCyl(buckets.steel, bx, baseY + 0.28, 18.5, 0.035, 0.04, 0.55, 6);
      addCyl(buckets.steel, bx, baseY + 0.14, 19.9, 0.035, 0.04, 0.26, 6);
      addStrut(buckets.ochre, [bx - 0.28, baseY + 0.52, 18.45], [bx + 0.28, baseY + 0.52, 18.45], 0.035, 6);
    }

    // North Pad (-75.7, 8.8): Push-up / Human-flag triple bars & Battle Ropes anchor
    addCyl(buckets.steel, -75.7, baseY + 0.35, 7.6, 0.14, 0.18, 0.7, 10);
    addTorus(buckets.ochre, -75.7, baseY + 0.45, 7.6, 0.22, 0.035, Math.PI / 2, 0, 0);
    for (const side of [-0.35, 0.35]) {
      addStrut(buckets.steel, [-75.7 + side * 0.4, baseY + 0.1, 7.75], [-75.7 + side * 2.2, baseY + 0.1, 10.1], 0.032, 6);
    }
    addBench(-80.5, 21.8, Math.PI);
    addBench(-70.8, 21.8, Math.PI);
  }

  // =========================================================================
  // 5. LOISIRS ENFANTS ADAPTÉS AU SABLE (Zone 74: [27.1.. 72.9] x [-5.5.. 20.5], baseY = 0.415 m)
  // =========================================================================
  {
    const baseY = 0.415;

    // 5a. Multi-Tower Wooden Sand-Castle Adventure Fort with Suspension Bridge & Twin Slides (50.0, 5.2)
    const fx = 50.0;
    const fz = 5.2;
    for (const tx of [-2.4, 2.4]) {
      const cx = fx + tx;
      // Platform deck & 4 timber corner posts
      addBox(buckets.wood, cx, baseY + 1.38, fz, 2.2, 0.14, 2.2);
      for (const px of [-0.95, 0.95]) {
        for (const pz of [-0.95, 0.95]) {
          addCyl(buckets.wood, cx + px, baseY + 1.55, fz + pz, 0.085, 0.095, 3.1, 8);
        }
      }
      // Pyramid timber roof + flagpole turret
      const roofCone = new THREE.ConeGeometry(1.78, 1.05, 4);
      roofCone.rotateY(Math.PI / 4);
      roofCone.translate(cx, baseY + 3.55, fz);
      buckets[tx < 0 ? "terracotta" : "ochre"].push(roofCone);
      addCyl(buckets.wood, cx, baseY + 4.25, fz, 0.03, 0.03, 0.65, 6);
      addBox(tx < 0 ? buckets.ochre : buckets.teal, cx + 0.22, baseY + 4.42, fz, 0.42, 0.22, 0.04);

      // Guardrails
      addBox(buckets.teal, cx, baseY + 1.82, fz - 1.02, 2.0, 0.56, 0.08);
    }
    // Suspension plank bridge connecting the 2 towers
    addBox(buckets.wood, fx, baseY + 1.34, fz, 2.7, 0.09, 1.15);
    for (const bz of [-0.55, 0.55]) {
      addStrut(buckets.ochre, [fx - 1.35, baseY + 2.02, fz + bz], [fx + 1.35, baseY + 2.02, fz + bz], 0.035, 6);
      for (let rx = -1.1; rx <= 1.1; rx += 0.44) {
        addStrut(buckets.steel, [fx + rx, baseY + 1.38, fz + bz], [fx + rx, baseY + 2.02, fz + bz], 0.018, 5);
      }
    }
    // Twin wave slides exiting South into the sand (+Z)
    for (const [tx, bucket] of [
      [-2.4, buckets.terracotta],
      [2.4, buckets.teal],
    ]) {
      addBox(bucket, fx + tx, baseY + 0.74, fz + 2.1, 0.85, 0.09, 2.45, 0.48, 0, 0);
      addBox(buckets.ochre, fx + tx - 0.44, baseY + 0.84, fz + 2.1, 0.08, 0.24, 2.45, 0.48, 0, 0);
      addBox(buckets.ochre, fx + tx + 0.44, baseY + 0.84, fz + 2.1, 0.08, 0.24, 2.45, 0.48, 0, 0);
    }

    // 5b. Wooden Pirate Ship / Galion de Sable Play Structure (41.2, 0.5)
    {
      const sx = 41.2;
      const sz = 0.5;
      // Hull & bow/stern raised decks
      addBox(buckets.wood, sx, baseY + 0.42, sz, 4.8, 0.78, 1.95, 0, 0.35, 0);
      addBox(buckets.terracotta, sx, baseY + 0.86, sz, 5.1, 0.14, 2.1, 0, 0.35, 0);
      // Mast, crow's nest & twin canvas sails
      addCyl(buckets.wood, sx, baseY + 2.1, sz, 0.09, 0.12, 3.6, 8);
      addCyl(buckets.ochre, sx, baseY + 3.15, sz, 0.42, 0.34, 0.38, 10);
      addBox(buckets.white, sx, baseY + 2.35, sz + 0.12, 2.4, 1.25, 0.06, -0.08, 0.35, 0);
      addBox(buckets.teal, sx, baseY + 3.65, sz, 0.55, 0.28, 0.04, 0, 0.35, 0);
    }

    // 5c. Rope Climbing Pyramid / Pyramide de Cordes (58.8, 0.5)
    {
      const px = 58.8;
      const pz = 0.5;
      const topH = baseY + 3.35;
      addCyl(buckets.steel, px, baseY + 1.68, pz, 0.075, 0.095, 3.35, 8);
      addSphere(buckets.ochre, px, topH + 0.08, pz, 0.2);
      const corners = [
        [-2.4, -2.4],
        [2.4, -2.4],
        [2.4, 2.4],
        [-2.4, 2.4],
      ];
      for (let i = 0; i < 4; i++) {
        const [cx, cz] = corners[i];
        const [nx, nz] = corners[(i + 1) % 4];
        addStrut(buckets.terracotta, [px + cx, baseY + 0.05, pz + cz], [px, topH, pz], 0.032, 6);
        for (const frac of [0.32, 0.58, 0.8]) {
          addStrut(
            buckets.teal,
            [px + cx * frac, baseY + (topH - baseY) * (1 - frac), pz + cz * frac],
            [px + nx * frac, baseY + (topH - baseY) * (1 - frac), pz + nz * frac],
            0.022,
            6
          );
        }
      }
    }

    // 5d. Sand Swing Gantry (50.0, 13.5) & Mechanical Sand Diggers + Spring Rockers
    {
      const sx = 50.0;
      const sz = 13.5;
      const topH = baseY + 2.55;
      addStrut(buckets.wood, [sx - 2.2, topH, sz], [sx + 2.2, topH, sz], 0.075, 8);
      for (const px of [-2.05, 2.05]) {
        addStrut(buckets.wood, [sx + px, topH, sz], [sx + px, baseY + 0.02, sz - 1.0], 0.065, 8);
        addStrut(buckets.wood, [sx + px, topH, sz], [sx + px, baseY + 0.02, sz + 1.0], 0.065, 8);
      }
      for (const ox of [-0.75, 0.75]) {
        for (const ch of [-0.24, 0.24]) {
          addStrut(buckets.steel, [sx + ox + ch, topH - 0.04, sz], [sx + ox + ch, baseY + 0.58, sz], 0.016, 5);
        }
        addBox(ox < 0 ? buckets.terracotta : buckets.teal, sx + ox, baseY + 0.55, sz, 0.52, 0.07, 0.26);
      }
      // Mechanical kids' sand diggers & spring rockers
      for (const [dx, dz, col] of [
        [45.0, 8.6, buckets.ochre],
        [55.0, 8.6, buckets.terracotta],
        [46.5, -1.6, buckets.teal],
        [53.5, -1.6, buckets.ochre],
      ]) {
        addCyl(buckets.steel, dx, baseY + 0.22, dz, 0.12, 0.16, 0.44, 8);
        addBox(col, dx, baseY + 0.48, dz, 0.55, 0.14, 0.36);
        addStrut(buckets.steel, [dx, baseY + 0.52, dz], [dx + 0.65, baseY + 0.85, dz + 0.35], 0.032, 6);
        addBox(buckets.ochre, dx + 0.75, baseY + 0.42, dz + 0.42, 0.32, 0.22, 0.28);
      }
    }
  }

  // =========================================================================
  // 6. LOISIRS 3E ÂGE — PÉTANQUE & DAMES (Zone 72: [54.8.. 96.6] x [2.15.. 23.0], baseY = 0.425 m)
  // =========================================================================
  {
    const baseY = 0.425;

    // 6a. Two Bordered Gravel Pétanque Lanes (Boulodromes: 11.5 m x 3.2 m)
    const addPetanqueCourt = (cx, cz) => {
      const w = 11.4;
      const d = 3.1;
      // Compacted golden-ochre gravel surface
      addEpDMFloor(cx, cz, w, d, 0xd8c39e, 0x8f6b47, baseY);
      // Timber sleeper perimeter curbs
      addBox(buckets.wood, cx, baseY + 0.09, cz - d * 0.5, w + 0.24, 0.16, 0.18);
      addBox(buckets.wood, cx, baseY + 0.09, cz + d * 0.5, w + 0.24, 0.16, 0.18);
      addBox(buckets.wood, cx - w * 0.5, baseY + 0.09, cz, 0.18, 0.16, d);
      addBox(buckets.wood, cx + w * 0.5, baseY + 0.09, cz, 0.18, 0.16, d);
      // Throwing circle (cercle de lancer) + metallic boules & cochonnet
      addTorus(buckets.terracotta, cx - 4.1, baseY + 0.04, cz, 0.28, 0.022, Math.PI / 2, 0, 0);
      addSphere(buckets.ochre, cx + 2.8, baseY + 0.055, cz + 0.15, 0.045); // cochonnet
      for (const [bx, bz] of [
        [2.45, -0.18],
        [2.95, 0.38],
        [3.2, -0.12],
        [2.1, 0.24],
        [-3.5, 0.42],
      ]) {
        addSphere(buckets.steel, cx + bx, baseY + 0.075, cz + bz, 0.075);
      }
      // Scoreboard post at lane end
      addCyl(buckets.wood, cx + w * 0.5 + 0.45, baseY + 0.65, cz, 0.05, 0.06, 1.3, 8);
      addBox(buckets.teal, cx + w * 0.5 + 0.45, baseY + 1.18, cz, 0.12, 0.42, 0.52);
    };

    addPetanqueCourt(75.7, 16.5);
    addPetanqueCourt(75.7, 20.6);

    // 6b. Five Dames & Chess Tables (Tables de Dames & Échecs avec damier et 4 tabourets)
    const addDamesTable = (tx, tz) => {
      // Pedestal & tabletop
      addCyl(buckets.steel, tx, baseY + 0.38, tz, 0.12, 0.22, 0.76, 10);
      addBox(buckets.wood, tx, baseY + 0.78, tz, 1.18, 0.08, 1.18);
      // Checkerboard game inlay (damier)
      addBox(buckets.white, tx, baseY + 0.825, tz, 0.76, 0.02, 0.76);
      for (let ix = -1; ix <= 1; ix += 2) {
        for (let iz = -1; iz <= 1; iz += 2) {
          addBox(buckets.terracotta, tx + ix * 0.18, baseY + 0.836, tz + iz * 0.18, 0.18, 0.015, 0.18);
        }
      }
      addBox(buckets.terracotta, tx, baseY + 0.836, tz, 0.18, 0.015, 0.18);
      // 4 Stools around the table
      for (const [sx, sz] of [
        [-0.86, 0],
        [0.86, 0],
        [0, -0.86],
        [0, 0.86],
      ]) {
        addCyl(buckets.steel, tx + sx, baseY + 0.24, tz + sz, 0.06, 0.1, 0.46, 8);
        addCyl(buckets.ochre, tx + sx, baseY + 0.48, tz + sz, 0.22, 0.22, 0.06, 12);
      }
    };

    addDamesTable(71.5, 11.2);
    addDamesTable(75.7, 11.2);
    addDamesTable(79.9, 11.2);
    addDamesTable(73.6, 7.6);
    addDamesTable(77.8, 7.6);

    // Spectator benches overlooking the Pétanque & Dames courts
    addBench(66.2, 18.5, Math.PI / 2);
    addBench(85.2, 18.5, -Math.PI / 2);
    addBench(69.5, 22.3, Math.PI);
    addBench(81.9, 22.3, Math.PI);
  }

  // =========================================================================
  // 7. ENSEIGNE LUMINEUSE D'ENTRÉE « JARDIN GRAND STANDING » (Arcade Nord, x = 0, z = -17.6, y = 3.74 m)
  // =========================================================================
  let signFaceMat = null;
  let signHaloMat = null;
  const signDayFaceCol = new THREE.Color(0xffffff);
  const signNightFaceCol = new THREE.Color(0xfff6dc);
  const signDayHaloCol = new THREE.Color(0xf6d89e);
  const signNightHaloCol = new THREE.Color(0xffdf94);
  {
    const roofY = 3.74;
    const sz = -21.2;
    const signW = 13.8;
    const signH = 1.75;
    const signCenterY = roofY + 0.85 + signH * 0.5;

    // 4 architectural bronze support pillars anchoring the sign to the Entrance Arcade roof
    for (const px of [-5.6, -1.9, 1.9, 5.6]) {
      addCyl(buckets.steel, px, roofY + 0.44, sz, 0.095, 0.13, 0.88, 10);
      addCyl(buckets.ochre, px, roofY + 0.06, sz, 0.19, 0.23, 0.12, 10);
    }
    // Outer architectural frame & gold crown trim
    addBox(buckets.steel, 0, signCenterY, sz, signW + 0.36, signH + 0.28, 0.34);
    addBox(buckets.ochre, 0, signCenterY + signH * 0.5 + 0.16, sz, signW + 0.52, 0.09, 0.44);
    addBox(buckets.ochre, 0, signCenterY - signH * 0.5 - 0.14, sz, signW + 0.46, 0.08, 0.42);

    // High-resolution double-sided illuminated canvas sign texture
    const canvas = document.createElement("canvas");
    canvas.width = 1024;
    canvas.height = 160;
    const ctx = canvas.getContext("2d");

    // Deep architectural slate-navy backlit background with warm golden inner border
    const bgGrad = ctx.createLinearGradient(0, 0, 1024, 160);
    bgGrad.addColorStop(0, "#151d2a");
    bgGrad.addColorStop(0.5, "#1f2b3d");
    bgGrad.addColorStop(1, "#151d2a");
    ctx.fillStyle = bgGrad;
    ctx.fillRect(0, 0, 1024, 160);

    ctx.strokeStyle = "#f2c678";
    ctx.lineWidth = 5;
    ctx.strokeRect(10, 10, 1004, 140);

    // Warm luminous headline: JARDIN GRAND STANDING
    ctx.save();
    ctx.shadowColor = "rgba(255, 214, 128, 0.95)";
    ctx.shadowBlur = 18;
    ctx.fillStyle = "#fff6e0";
    ctx.font = "800 56px 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("JARDIN GRAND STANDING", 512, 68);
    ctx.restore();

    // Subtitle
    ctx.fillStyle = "#f2c97d";
    ctx.font = "600 22px 'Plus Jakarta Sans', 'Segoe UI', Arial, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText("★   THIÈS  ·  PARC URBAIN & LOISIRS   ★", 512, 124);

    const signTex = new THREE.CanvasTexture(canvas);
    signTex.colorSpace = THREE.SRGBColorSpace;
    signTex.anisotropy = 4;

    signFaceMat = new THREE.MeshBasicMaterial({
      map: signTex,
      color: signDayFaceCol.clone(),
    });
    const faceGeo = new THREE.PlaneGeometry(signW, signH);
    const northFace = new THREE.Mesh(faceGeo, signFaceMat);
    northFace.position.set(0, signCenterY, sz - 0.185);
    northFace.rotation.y = Math.PI; // Faces North avenue & main park entrance
    const southFace = new THREE.Mesh(faceGeo, signFaceMat);
    southFace.position.set(0, signCenterY, sz + 0.185); // Faces South central fountain plaza
    scene.add(northFace, southFace);

    // Continuous glowing LED halo strip framing the sign + 8 warm spotlight pucks along the top cornice
    signHaloMat = new THREE.MeshBasicMaterial({ color: signDayHaloCol.clone() });
    const topStrip = new THREE.Mesh(new THREE.BoxGeometry(signW + 0.22, 0.06, 0.42), signHaloMat);
    topStrip.position.set(0, signCenterY + signH * 0.5 + 0.05, sz);
    const botStrip = new THREE.Mesh(new THREE.BoxGeometry(signW + 0.22, 0.06, 0.42), signHaloMat);
    botStrip.position.set(0, signCenterY - signH * 0.5 - 0.05, sz);
    scene.add(topStrip, botStrip);

    const puckGeo = new THREE.SphereGeometry(0.09, 10, 8);
    for (let px = -6.0; px <= 6.0; px += 1.5) {
      const pN = new THREE.Mesh(puckGeo, signHaloMat);
      pN.position.set(px, signCenterY + signH * 0.5 + 0.16, sz - 0.23);
      const pS = new THREE.Mesh(puckGeo, signHaloMat);
      pS.position.set(px, signCenterY + signH * 0.5 + 0.16, sz + 0.23);
      scene.add(pN, pS);
    }
  }

  // =========================================================================
  // 8. MERGE STATIC MATERIAL BUCKETS INTO SCENE
  // =========================================================================
  const matSpecs = [
    ["steel", 0x363b42, 0.48, 0.38],
    ["wood", 0xb88956, 0.74, 0.04],
    ["terracotta", 0xc4583f, 0.52, 0.15],
    ["teal", 0x4b938c, 0.52, 0.15],
    ["ochre", 0xd89d4a, 0.55, 0.1],
    ["white", 0xf4efe6, 0.85, 0.0],
  ];
  for (const [key, color, roughness, metalness] of matSpecs) {
    const merged = mergeNormalizedGeoms(buckets[key]);
    if (!merged) continue;
    const mat = new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const mesh = new THREE.Mesh(merged, mat);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    scene.add(mesh);
  }

  return {
    applyNightFactor(f) {
      const k = THREE.MathUtils.smoothstep(f, 0.08, 0.92);
      if (signFaceMat) signFaceMat.color.lerpColors(signDayFaceCol, signNightFaceCol, k);
      if (signHaloMat) signHaloMat.color.lerpColors(signDayHaloCol, signNightHaloCol, k);
    },
  };
}
