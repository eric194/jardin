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
  // 4. MERGE STATIC MATERIAL BUCKETS INTO SCENE
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
}
