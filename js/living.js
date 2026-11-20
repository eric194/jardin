import * as THREE from "three";

function makeSeeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

export const VEHICLE_TYPES = [
  {
    id: "citadine",
    bodyW: 1.66,
    bodyH: 0.56,
    bodyL: 3.45,
    cabinW: 1.4,
    cabinH: 0.48,
    cabinL: 1.95,
    cabinZ: -0.18,
    wheelR: 0.28,
    hasBed: false,
  },
  {
    id: "berline",
    bodyW: 1.76,
    bodyH: 0.58,
    bodyL: 4.3,
    cabinW: 1.48,
    cabinH: 0.5,
    cabinL: 2.05,
    cabinZ: -0.1,
    wheelR: 0.3,
    hasBed: false,
  },
  {
    id: "suv",
    bodyW: 1.88,
    bodyH: 0.72,
    bodyL: 4.45,
    cabinW: 1.58,
    cabinH: 0.56,
    cabinL: 2.55,
    cabinZ: -0.25,
    wheelR: 0.34,
    hasBed: false,
  },
  {
    id: "pickup",
    bodyW: 1.84,
    bodyH: 0.66,
    bodyL: 4.65,
    cabinW: 1.54,
    cabinH: 0.56,
    cabinL: 1.55,
    cabinZ: 0.48,
    wheelR: 0.34,
    hasBed: true,
    bedW: 1.58,
    bedH: 0.22,
    bedL: 1.55,
    bedZ: -1.35,
  },
  {
    id: "van",
    bodyW: 1.9,
    bodyH: 0.92,
    bodyL: 4.75,
    cabinW: 1.68,
    cabinH: 0.62,
    cabinL: 3.45,
    cabinZ: -0.2,
    wheelR: 0.32,
    hasBed: false,
  },
];

const VEHICLE_COLORS = [
  0xf7f5f0, // blanc perle
  0xdfd6c7, // beige sable
  0xc6c9cc, // gris argent
  0xd8cab4, // champagne
  0x5d7082, // bleu ardoise
  0x464b52, // gris anthracite
  0x7d6a58, // bronze mat
  0x8c4d43, // bordeaux sobre
  0x687867, // vert sauge foncé
  0xd6b265, // ocre jaune discret
];

export function buildParkedCars(scene, data) {
  const stalls = data.parkingDetails?.stalls || [];
  if (!stalls.length) return;

  const rng = makeSeeded(31243);
  const byType = VEHICLE_TYPES.map(() => []);

  for (let i = 0; i < stalls.length; i++) {
    // Occuper ~62% des stalles avec répartition variée (citadine, berline, SUV, pick-up, van)
    if (rng() > 0.62) continue;
    const poly = stalls[i];
    const cx = poly.reduce((s, p) => s + p[0], 0) / poly.length;
    const cz = poly.reduce((s, p) => s + p[1], 0) / poly.length;

    const r = rng();
    const tIdx = r < 0.24 ? 0 : r < 0.52 ? 1 : r < 0.74 ? 2 : r < 0.9 ? 3 : 4;
    byType[tIdx].push({
      x: cx + (rng() - 0.5) * 0.16,
      z: cz + (rng() - 0.5) * 0.24,
      rotY: rng() > 0.5 ? 0 : Math.PI,
      colorIdx: Math.floor(rng() * VEHICLE_COLORS.length),
    });
  }

  const bodyMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.52, metalness: 0.16 });
  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x353b44, roughness: 0.26, metalness: 0.22 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.85 });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.85 });
  const palette = VEHICLE_COLORS.map((hex) => new THREE.Color(hex));

  // Comptage total des roues pour un seul InstancedMesh
  const allWheels = [];
  const dummy = new THREE.Object3D();

  byType.forEach((items, tIdx) => {
    if (!items.length) return;
    const vt = VEHICLE_TYPES[tIdx];
    const bodyGeo = new THREE.BoxGeometry(vt.bodyW, vt.bodyH, vt.bodyL);
    const cabinGeo = new THREE.BoxGeometry(vt.cabinW, vt.cabinH, vt.cabinL);

    const bodyInst = new THREE.InstancedMesh(bodyGeo, bodyMat, items.length);
    const cabinInst = new THREE.InstancedMesh(cabinGeo, cabinMat, items.length);
    bodyInst.castShadow = true;
    bodyInst.receiveShadow = true;

    let bedInst = null;
    if (vt.hasBed) {
      bedInst = new THREE.InstancedMesh(
        new THREE.BoxGeometry(vt.bedW, vt.bedH, vt.bedL),
        bedMat,
        items.length
      );
    }

    const baseFloor = 0.33;
    const bodyY = baseFloor + vt.wheelR * 0.55 + vt.bodyH * 0.5;
    const cabinY = baseFloor + vt.wheelR * 0.55 + vt.bodyH + vt.cabinH * 0.48;

    items.forEach((c, idx) => {
      const cosR = Math.cos(c.rotY);
      const sinR = Math.sin(c.rotY);

      dummy.position.set(c.x, bodyY, c.z);
      dummy.rotation.set(0, c.rotY, 0);
      dummy.updateMatrix();
      bodyInst.setMatrixAt(idx, dummy.matrix);
      bodyInst.setColorAt(idx, palette[c.colorIdx]);

      dummy.position.set(
        c.x + sinR * vt.cabinZ,
        cabinY,
        c.z + cosR * vt.cabinZ
      );
      dummy.rotation.set(0, c.rotY, 0);
      dummy.updateMatrix();
      cabinInst.setMatrixAt(idx, dummy.matrix);

      if (bedInst) {
        dummy.position.set(
          c.x + sinR * vt.bedZ,
          baseFloor + vt.wheelR * 0.55 + vt.bodyH + 0.03,
          c.z + cosR * vt.bedZ
        );
        dummy.rotation.set(0, c.rotY, 0);
        dummy.updateMatrix();
        bedInst.setMatrixAt(idx, dummy.matrix);
      }

      const wxOff = vt.bodyW * 0.46;
      const wzOff = vt.bodyL * 0.31;
      for (const sx of [-1, 1]) {
        for (const sz of [-1, 1]) {
          allWheels.push({
            x: c.x + cosR * (sx * wxOff) + sinR * (sz * wzOff),
            y: baseFloor + vt.wheelR,
            z: c.z - sinR * (sx * wxOff) + cosR * (sz * wzOff),
            r: vt.wheelR / 0.3,
            rotY: c.rotY,
          });
        }
      }
    });

    bodyInst.instanceColor.needsUpdate = true;
    scene.add(bodyInst, cabinInst);
    if (bedInst) scene.add(bedInst);
  });

  if (allWheels.length) {
    const wGeo = new THREE.CylinderGeometry(0.3, 0.3, 0.22, 10);
    wGeo.rotateZ(Math.PI / 2);
    const wInst = new THREE.InstancedMesh(wGeo, wheelMat, allWheels.length);
    allWheels.forEach((w, idx) => {
      dummy.position.set(w.x, w.y, w.z);
      dummy.rotation.set(0, w.rotY, 0);
      dummy.scale.set(1, w.r, w.r);
      dummy.updateMatrix();
      wInst.setMatrixAt(idx, dummy.matrix);
    });
    scene.add(wInst);
  }
}

function inZone2D(pt, z) {
  if (!pointInPoly2D(pt, z.poly)) return false;
  if (z.holes && z.holes.some((h) => pointInPoly2D(pt, h))) return false;
  return true;
}

export function buildBenches(scene, data) {
  const forbidden = data.zones.filter((z) => {
    const u = z.name.toUpperCase();
    return (
      z.kind === "water" ||
      z.kind === "sport" ||
      z.kind === "play" ||
      z.kind === "track" ||
      z.kind === "gradin" ||
      z.kind === "green" ||
      z.kind === "building" ||
      u.includes("BEACH") ||
      u.includes("SABLE")
    );
  });

  const isClearBench = (bx, bz, rotY) => {
    const tx = Math.cos(rotY);
    const tz = -Math.sin(rotY);
    const fx = Math.sin(rotY);
    const fz = Math.cos(rotY);
    const samples = [
      [bx, bz],
      [bx + tx * 1.15, bz + tz * 1.15],
      [bx - tx * 1.15, bz - tz * 1.15],
      [bx + fx * 0.8, bz + fz * 0.8],
      [bx - fx * 0.45, bz - fz * 0.45],
    ];
    for (const [sx, sz] of samples) {
      if (Math.abs(sx) > 248.5 || Math.abs(sz) > 22.8) return false;
      if (forbidden.some((fzItem) => inZone2D([sx, sz], fzItem))) return false;
    }
    return true;
  };

  const spots = [];
  const tryAddSpot = (bx, bz, rotY) => {
    if (!isClearBench(bx, bz, rotY)) return false;
    if (spots.some(([sx, sz]) => Math.hypot(bx - sx, bz - sz) < 4.8)) return false;
    spots.push([bx, bz, rotY]);
    return true;
  };

  // 1. Bancs alignés le long des bordures des vraies zones AIR DE REPOS (dossier côté massif/pelouse)
  const restZones = data.zones.filter(
    (z) => z.name.toUpperCase().includes("REPOS") && z.area >= 45
  );
  for (const rz of restZones) {
    const pts = rz.poly;
    const edges = [];
    for (let i = 0; i < pts.length; i++) {
      const a = pts[i];
      const b = pts[(i + 1) % pts.length];
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len >= 7.5) edges.push({ len, a, b });
    }
    edges.sort((x, y) => y.len - x.len);

    const maxHere = rz.area > 220 ? 3 : rz.area > 100 ? 2 : 1;
    let placed = 0;
    for (const edge of edges.slice(0, 4)) {
      if (placed >= maxHere) break;
      const { len, a, b } = edge;
      const dx = (b[0] - a[0]) / len;
      const dz = (b[1] - a[1]) / len;
      const mx = (a[0] + b[0]) * 0.5;
      const mz = (a[1] + b[1]) * 0.5;

      let nx = -dz;
      let nz = dx;
      if (!pointInPoly2D([mx + nx * 0.5, mz + nz * 0.5], pts)) {
        nx = -nx;
        nz = -nz;
      }
      if (!pointInPoly2D([mx + nx * 0.5, mz + nz * 0.5], pts)) continue;

      const rotY = Math.atan2(nx, nz);
      const countEdge = len >= 18 && rz.area > 120 ? 2 : 1;
      const fracs = countEdge === 2 ? [0.34, 0.66] : [0.5];
      for (const u of fracs) {
        if (placed >= maxHere) break;
        const bx = a[0] + dx * len * u + nx * 1.25;
        const bz = a[1] + dz * len * u + nz * 1.25;
        if (!pointInPoly2D([bx, bz], pts)) continue;
        if (tryAddSpot(bx, bz, rotY)) placed++;
      }
    }
  }

  // 2. Bancs symétriques vérifiés sur le parvis d'entrée et les promenades du bassin central
  const focalSpots = [
    [-9.5, -17.6, 0],
    [9.5, -17.6, 0],
    [-24.2, 0.8, Math.PI / 2],
    [24.2, 0.8, -Math.PI / 2],
    [-13.8, 10.6, Math.PI],
    [13.8, 10.6, Math.PI],
  ];
  for (const [bx, bz, rotY] of focalSpots) {
    tryAddSpot(bx, bz, rotY);
  }

  if (!spots.length) return { benchCount: 0 };

  const baseY = 0.35;
  const seatGeo = new THREE.BoxGeometry(2.15, 0.11, 0.56);
  const backGeo = new THREE.BoxGeometry(2.15, 0.32, 0.08);
  const legGeo = new THREE.BoxGeometry(0.18, 0.36, 0.48);

  const woodMat = new THREE.MeshStandardMaterial({ color: 0xc5a882, roughness: 0.82 });
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0xded6c8, roughness: 0.9 });

  const seats = new THREE.InstancedMesh(seatGeo, woodMat, spots.length);
  const backs = new THREE.InstancedMesh(backGeo, woodMat, spots.length);
  const legs = new THREE.InstancedMesh(legGeo, stoneMat, spots.length * 2);
  seats.castShadow = true;
  backs.castShadow = true;
  legs.castShadow = true;

  const dummy = new THREE.Object3D();
  spots.forEach(([bx, bz, rotY], idx) => {
    const cosR = Math.cos(rotY);
    const sinR = Math.sin(rotY);

    dummy.position.set(bx, baseY + 0.39, bz);
    dummy.rotation.set(0, rotY, 0);
    dummy.scale.set(1, 1, 1);
    dummy.updateMatrix();
    seats.setMatrixAt(idx, dummy.matrix);

    dummy.position.set(bx - sinR * 0.24, baseY + 0.63, bz - cosR * 0.24);
    dummy.rotation.set(-0.14, rotY, 0);
    dummy.updateMatrix();
    backs.setMatrixAt(idx, dummy.matrix);

    for (const sIdx of [0, 1]) {
      const lxOff = sIdx === 0 ? -0.78 : 0.78;
      dummy.position.set(bx + cosR * lxOff, baseY + 0.18, bz - sinR * lxOff);
      dummy.rotation.set(0, rotY, 0);
      dummy.updateMatrix();
      legs.setMatrixAt(idx * 2 + sIdx, dummy.matrix);
    }
  });

  scene.add(legs, seats, backs);
  return { benchCount: spots.length };
}

export function buildMovingTraffic(scene, textures) {
  const routes = [
    // Avenue Nord (voie Est-Ouest et Ouest-Est entre Parc et Parking)
    { axis: "x", fixed: -32.8, min: -350, max: 350, dir: 1, speed: 9.8 },
    { axis: "x", fixed: -32.8, min: -350, max: 350, dir: 1, speed: 11.4 },
    { axis: "x", fixed: -32.8, min: -350, max: 350, dir: 1, speed: 8.9 },
    { axis: "x", fixed: -32.8, min: -350, max: 350, dir: 1, speed: 10.6 },
    { axis: "x", fixed: -32.8, min: -350, max: 350, dir: 1, speed: 12.1 },
    { axis: "x", fixed: -38.8, min: -350, max: 350, dir: -1, speed: 10.8 },
    { axis: "x", fixed: -38.8, min: -350, max: 350, dir: -1, speed: 9.4 },
    { axis: "x", fixed: -38.8, min: -350, max: 350, dir: -1, speed: 11.6 },
    { axis: "x", fixed: -38.8, min: -350, max: 350, dir: -1, speed: 10.1 },
    // Rue Sud parallèle
    { axis: "x", fixed: 30.6, min: -310, max: 310, dir: 1, speed: 8.6 },
    { axis: "x", fixed: 30.6, min: -310, max: 310, dir: -1, speed: 9.1 },
    { axis: "x", fixed: 30.6, min: -310, max: 310, dir: 1, speed: 9.5 },
    { axis: "x", fixed: 30.6, min: -310, max: 310, dir: -1, speed: 8.2 },
    // Axes transversaux Ouest & Est
    { axis: "z", fixed: -261.5, min: -165, max: 145, dir: 1, speed: 9.2 },
    { axis: "z", fixed: -264.8, min: -165, max: 145, dir: -1, speed: 10.2 },
    { axis: "z", fixed: 265.0, min: -165, max: 145, dir: 1, speed: 9.4 },
    { axis: "z", fixed: 268.2, min: -165, max: 145, dir: -1, speed: 8.7 },
    { axis: "z", fixed: 268.2, min: -165, max: 145, dir: -1, speed: 9.8 },
  ];

  const lampGeo = new THREE.BoxGeometry(0.3, 0.16, 0.12);
  const coneGeo = new THREE.PlaneGeometry(4.2, 8.5);
  coneGeo.rotateX(-Math.PI / 2);

  const cabinMat = new THREE.MeshStandardMaterial({ color: 0x353b44, roughness: 0.25 });
  const wheelMat = new THREE.MeshStandardMaterial({ color: 0x22252a, roughness: 0.85 });
  const bedMat = new THREE.MeshStandardMaterial({ color: 0x2c2f34, roughness: 0.85 });
  const headMat = new THREE.MeshBasicMaterial({ color: 0xfff3cc });
  const tailMat = new THREE.MeshBasicMaterial({ color: 0xe0483a });
  const beamMat = new THREE.MeshBasicMaterial({
    map: textures.lightPool,
    color: 0xffebbd,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });

  const cars = routes.map((r, idx) => {
    const vt = VEHICLE_TYPES[idx % VEHICLE_TYPES.length];
    const group = new THREE.Group();
    const bMat = new THREE.MeshStandardMaterial({
      color: VEHICLE_COLORS[(idx * 3 + 1) % VEHICLE_COLORS.length],
      roughness: 0.45,
      metalness: 0.16,
    });

    const axleGeo = new THREE.CylinderGeometry(vt.wheelR, vt.wheelR, vt.bodyW * 0.95, 8);
    axleGeo.rotateZ(Math.PI / 2);
    for (const sz of [-1, 1]) {
      const w = new THREE.Mesh(axleGeo, wheelMat);
      w.position.set(0, vt.wheelR, sz * vt.bodyL * 0.31);
      group.add(w);
    }

    const bodyY = vt.wheelR * 0.55 + vt.bodyH * 0.5;
    const body = new THREE.Mesh(new THREE.BoxGeometry(vt.bodyW, vt.bodyH, vt.bodyL), bMat);
    body.position.y = bodyY;

    const cabinY = vt.wheelR * 0.55 + vt.bodyH + vt.cabinH * 0.48;
    const cabin = new THREE.Mesh(new THREE.BoxGeometry(vt.cabinW, vt.cabinH, vt.cabinL), cabinMat);
    cabin.position.set(0, cabinY, vt.cabinZ);

    group.add(body, cabin);

    if (vt.hasBed) {
      const bed = new THREE.Mesh(new THREE.BoxGeometry(vt.bedW, vt.bedH, vt.bedL), bedMat);
      bed.position.set(0, vt.wheelR * 0.55 + vt.bodyH + 0.03, vt.bedZ);
      group.add(bed);
    }

    const frontZ = vt.bodyL * 0.5 + 0.03;
    const hlY = vt.wheelR * 0.55 + vt.bodyH * 0.52;
    const lampX = vt.bodyW * 0.34;

    const nightGroup = new THREE.Group();
    nightGroup.visible = false;

    const hlL = new THREE.Mesh(lampGeo, headMat);
    hlL.position.set(-lampX, hlY, frontZ);
    const hlR = new THREE.Mesh(lampGeo, headMat);
    hlR.position.set(lampX, hlY, frontZ);

    const tlL = new THREE.Mesh(lampGeo, tailMat);
    tlL.position.set(-lampX, hlY, -frontZ);
    const tlR = new THREE.Mesh(lampGeo, tailMat);
    tlR.position.set(lampX, hlY, -frontZ);

    const beam = new THREE.Mesh(coneGeo, beamMat);
    beam.position.set(0, 0.12, frontZ + 3.8);

    nightGroup.add(hlL, hlR, tlL, tlR, beam);
    group.add(nightGroup);
    scene.add(group);

    const span = r.max - r.min;
    const progress = (idx / routes.length + 0.13 * idx) % 1;
    const initPos = r.min + progress * span;
    if (r.axis === "x") {
      group.position.set(initPos, 0.08, r.fixed);
      group.rotation.y = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
    } else {
      group.position.set(r.fixed, 0.08, initPos);
      group.rotation.y = r.dir > 0 ? 0 : Math.PI;
    }
    return {
      group,
      nightGroup,
      route: r,
      pos: initPos,
    };
  });

  return {
    update(dt, nightFactor, camY = 126) {
      const showNight = nightFactor > 0.01;
      if (showNight) beamMat.opacity = nightFactor * 0.42;
      if (camY > 460) return;
      for (const c of cars) {
        if (c.nightGroup.visible !== showNight) c.nightGroup.visible = showNight;
        const r = c.route;
        c.pos += r.dir * r.speed * dt;
        if (c.pos > r.max) c.pos = r.min;
        if (c.pos < r.min) c.pos = r.max;

        if (r.axis === "x") {
          c.group.position.set(c.pos, 0.08, r.fixed);
          c.group.rotation.y = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          c.group.position.set(r.fixed, 0.08, c.pos);
          c.group.rotation.y = r.dir > 0 ? 0 : Math.PI;
        }
      }
    },
  };
}

export function buildPedestrians(scene) {
  const rng = makeSeeded(42026);
  const walkers = [];

  // Paramètres exacts de la PISTE rouge extérieure (boucle 500 x 50 m à coins arrondis R = 6,20 m)
  const PISTE_HX = 245.0;
  const PISTE_ZT = -19.97;
  const PISTE_ZB = 20.03;
  const PISTE_R = 6.2;
  const PISTE_SX = PISTE_HX * 2;
  const PISTE_SZ = PISTE_ZB - PISTE_ZT;
  const PISTE_ARC = Math.PI * 0.5 * PISTE_R;
  const PISTE_PERIM = 2 * PISTE_SX + 2 * PISTE_SZ + 4 * PISTE_ARC;

  // 1. 14 coureurs sur la PISTE rouge extérieure à vitesse réaliste (2,1 à 2,95 m/s ≈ 7,5 à 10,5 km/h)
  for (let i = 0; i < 14; i++) {
    walkers.push({
      kind: "loop",
      t: i / 14 + (rng() - 0.5) * 0.02,
      speedMps: 2.1 + rng() * 0.85,
      laneOffset: i % 2 === 0 ? -0.45 : 0.45,
      dir: i % 2 === 0 ? 1 : -1,
      phase: rng() * Math.PI * 2,
      strideSpeed: 5.0 + rng() * 0.9,
      bobAmp: 0.065,
      colorIdx: i % 5,
    });
  }

  // 2. 28 promeneurs à allure de marche naturelle (0,85 à 1,25 m/s ≈ 3,1 à 4,5 km/h) sur allées sûres
  const segments = [
    [[-240, -21.0], [-24, -21.0]],
    [[24, -21.0], [240, -21.0]],
    [[-240, 21.0], [-24, 21.0]],
    [[24, 21.0], [240, 21.0]],
    [[-18, -18.5], [18, -18.5]],
    [[26, -15], [64, 15]],
    [[78, -15], [122, 15]],
    [[138, -15], [198, 15]],
    [[-45, -45.4], [295, -45.4]], // promenade devant cantines nord
    [[10, -45.4], [195, -45.4]],
  ];

  for (let i = 0; i < 28; i++) {
    const seg = segments[i % segments.length];
    const ax = seg[0][0];
    const az = seg[0][1];
    const bx = seg[1][0];
    const bz = seg[1][1];
    const segLen = Math.max(4, Math.hypot(bx - ax, bz - az));
    walkers.push({
      kind: "seg",
      ax,
      az,
      bx,
      bz,
      segLen,
      t: rng(),
      dir: rng() > 0.5 ? 1 : -1,
      speedMps: 0.85 + rng() * 0.4,
      phase: rng() * Math.PI * 2,
      strideSpeed: 3.1 + rng() * 0.6,
      bobAmp: 0.04,
      colorIdx: (i + 2) % 5,
    });
  }

  const torsoGeo = new THREE.CylinderGeometry(0.17, 0.21, 0.94, 8);
  const headGeo = new THREE.SphereGeometry(0.17, 8, 8);

  const torsoMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x4b3d33, roughness: 0.8 });

  const torsos = new THREE.InstancedMesh(torsoGeo, torsoMat, walkers.length);
  const heads = new THREE.InstancedMesh(headGeo, headMat, walkers.length);

  const clothes = [
    new THREE.Color(0xeae4d8),
    new THREE.Color(0xc4b59e),
    new THREE.Color(0x88847c),
    new THREE.Color(0xb66252),
    new THREE.Color(0x7c937e),
  ];
  walkers.forEach((w, idx) => torsos.setColorAt(idx, clothes[w.colorIdx]));
  torsos.instanceColor.needsUpdate = true;

  scene.add(torsos, heads);

  const dummy = new THREE.Object3D();

  function sampleLoopPoint(u, laneOffset = 0) {
    const r = PISTE_R + laneOffset;
    let d = (((u % 1) + 1) % 1) * PISTE_PERIM;

    if (d < PISTE_SX) return [-PISTE_HX + d, PISTE_ZT - r, 1, 0];
    d -= PISTE_SX;

    if (d < PISTE_ARC) {
      const a = -Math.PI * 0.5 + (d / PISTE_ARC) * (Math.PI * 0.5);
      return [PISTE_HX + Math.cos(a) * r, PISTE_ZT + Math.sin(a) * r, -Math.sin(a), Math.cos(a)];
    }
    d -= PISTE_ARC;

    if (d < PISTE_SZ) return [PISTE_HX + r, PISTE_ZT + d, 0, 1];
    d -= PISTE_SZ;

    if (d < PISTE_ARC) {
      const a = (d / PISTE_ARC) * (Math.PI * 0.5);
      return [PISTE_HX + Math.cos(a) * r, PISTE_ZB + Math.sin(a) * r, -Math.sin(a), Math.cos(a)];
    }
    d -= PISTE_ARC;

    if (d < PISTE_SX) return [PISTE_HX - d, PISTE_ZB + r, -1, 0];
    d -= PISTE_SX;

    if (d < PISTE_ARC) {
      const a = Math.PI * 0.5 + (d / PISTE_ARC) * (Math.PI * 0.5);
      return [-PISTE_HX + Math.cos(a) * r, PISTE_ZB + Math.sin(a) * r, -Math.sin(a), Math.cos(a)];
    }
    d -= PISTE_ARC;

    if (d < PISTE_SZ) return [-PISTE_HX - r, PISTE_ZB - d, 0, -1];
    d -= PISTE_SZ;

    const a = Math.PI + (d / PISTE_ARC) * (Math.PI * 0.5);
    return [-PISTE_HX + Math.cos(a) * r, PISTE_ZT + Math.sin(a) * r, -Math.sin(a), Math.cos(a)];
  }

  return {
    update(dt, now, camY = 126) {
      const vis = camY < 380;
      if (torsos.visible !== vis) {
        torsos.visible = vis;
        heads.visible = vis;
      }
      if (!vis) return;
      const tSec = now * 0.001;
      walkers.forEach((w, idx) => {
        let px, pz, dx, dz;

        if (w.kind === "loop") {
          w.t += w.dir * (w.speedMps / PISTE_PERIM) * dt;
          const [lx, lz, vx, vz] = sampleLoopPoint(w.t, w.laneOffset);
          px = lx;
          pz = lz;
          dx = vx * w.dir;
          dz = vz * w.dir;
        } else {
          w.t += w.dir * (w.speedMps / w.segLen) * dt;
          if (w.t > 1) {
            w.t = 1;
            w.dir = -1;
          } else if (w.t < 0) {
            w.t = 0;
            w.dir = 1;
          }
          px = w.ax + (w.bx - w.ax) * w.t;
          pz = w.az + (w.bz - w.az) * w.t;
          dx = (w.bx - w.ax) * w.dir;
          dz = (w.bz - w.az) * w.dir;
        }

        const bob = Math.abs(Math.sin(tSec * w.strideSpeed + w.phase)) * w.bobAmp;
        const rotY = Math.atan2(dx, dz);

        dummy.position.set(px, 0.41 + 0.52 + bob, pz);
        dummy.rotation.set(0, rotY, Math.sin(tSec * w.strideSpeed + w.phase) * 0.04);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        torsos.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(px, 0.41 + 1.18 + bob, pz);
        dummy.rotation.set(0, rotY, 0);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        heads.setMatrixAt(idx, dummy.matrix);
      });
      torsos.instanceMatrix.needsUpdate = true;
      heads.instanceMatrix.needsUpdate = true;
    },
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

export function buildLightingNetwork(scene, data, textures, isMobile = false) {
  const bollards = [];
  const parkPoles = [];
  const sportMasts = [];
  const roadPoles = [];

  const forbiddenZones = data.zones.filter(
    (z) =>
      z.kind === "water" ||
      z.kind === "sport" ||
      z.kind === "play" ||
      z.kind === "track" ||
      z.name.toUpperCase().includes("BEACH") ||
      z.name.toUpperCase().includes("SABLE")
  );
  const isClearOfPoolsAndCourts = (x, z) =>
    !forbiddenZones.some((fz) => inZone2D([x, z], fz));

  // 1. Lampes basses de jardin enrichies (~125 bornes) : 15 DXF + allées, bassin, amphithéâtre, jardins et cantines
  for (const [lx, lz] of data.lights || []) {
    if (isClearOfPoolsAndCourts(lx, lz)) bollards.push([lx, lz]);
  }
  for (let x = -234; x <= 238; x += 14) {
    if (isClearOfPoolsAndCourts(x, -4.5)) bollards.push([x, -4.5]);
    if (isClearOfPoolsAndCourts(x, 4.5)) bollards.push([x, 4.5]);
    if (isClearOfPoolsAndCourts(x, -21.2)) bollards.push([x, -21.2]);
    if (isClearOfPoolsAndCourts(x, 21.2)) bollards.push([x, 21.2]);
  }
  for (let a = 0; a < 14; a++) {
    const ang = (a / 14) * Math.PI * 2;
    const bx = Math.cos(ang) * 20;
    const bz = -1.6 + Math.sin(ang) * 14.5;
    if (isClearOfPoolsAndCourts(bx, bz)) bollards.push([bx, bz]);
  }
  // Bornes autour des cantines nord
  for (let x = -45; x <= 295; x += 18) {
    bollards.push([x, -44.6]);
  }

  // 2. Lampadaires d'allées de parc (~48) + mâts parking & promenade cantines (~34)
  for (let x = -236; x <= 236; x += 18) {
    if (isClearOfPoolsAndCourts(x, -23.6)) parkPoles.push([x, -23.6, 6.0, 0]);
    if (isClearOfPoolsAndCourts(x, 23.6)) parkPoles.push([x, 23.6, 6.0, Math.PI]);
    if (Math.abs(x) < 185 && x > 20 && isClearOfPoolsAndCourts(x, 0)) {
      parkPoles.push([x, 0, 5.4, 0]);
    }
  }
  for (let x = -54; x <= 316; x += 20) {
    parkPoles.push([x, -53.5, 8.0, 0]); // mâts centraux parking nord
  }
  for (let x = -50; x <= 300; x += 24) {
    parkPoles.push([x, -44.2, 5.5, Math.PI]); // lampadaires devant cantines
  }

  // 3. 12 mâts sportifs (11 m) strictly outside courts & Sprint lanes
  [
    [-246.5, -14.8],
    [-191.5, -14.8],
    [-246.5, 17.5],
    [-191.5, 17.5],
    [-187, -21.5],
    [-162, 20.5],
    [-142, -21.5],
    [-139.5, 20.5],
    [-109.5, -18.5],
    [-109.5, 20.5],
    [-64, -20],
    [-64, 18],
  ].forEach(([sx, sz]) => {
    if (isClearOfPoolsAndCourts(sx, sz)) sportMasts.push([sx, sz]);
  });

  // 4. Lampadaires densifiés sur toutes les routes principales
  for (let x = -288; x <= 288; x += 24) {
    roadPoles.push([x, -29.0, 0]);
    roadPoles.push([x, -42.4, Math.PI]);
    roadPoles.push([x, 28.8, Math.PI]);
  }
  for (let z = -128; z <= 112; z += 28) {
    if (Math.abs(z) < 34) continue;
    roadPoles.push([-256, z, Math.PI / 2]);
    roadPoles.push([258, z, -Math.PI / 2]);
  }

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x5d5a54, roughness: 0.72, metalness: 0.25 });
  const bulbMat = new THREE.MeshStandardMaterial({
    color: 0xfff8ea,
    emissive: 0xffc66e,
    emissiveIntensity: 0.0,
    roughness: 0.35,
  });

  const lightPools = []; // { x, y, z, size }
  const dummy = new THREE.Object3D();

  // Instanced bollards
  if (bollards.length) {
    const bPost = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.13, 1.05, 8), poleMat, bollards.length);
    const bHead = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.15, 0.15, 0.22, 8), bulbMat, bollards.length);
    bollards.forEach(([x, z], idx) => {
      dummy.position.set(x, 0.44 + 0.52, z);
      dummy.rotation.set(0, 0, 0);
      dummy.updateMatrix();
      bPost.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, 0.44 + 1.08, z);
      dummy.updateMatrix();
      bHead.setMatrixAt(idx, dummy.matrix);
      lightPools.push({ x, y: z < -30 ? 0.34 : 0.525, z, size: 7.5 });
    });
    scene.add(bPost, bHead);
  }

  // Instanced park & parking poles
  if (parkPoles.length) {
    const pPost = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.1, 0.15, 1, 8), poleMat, parkPoles.length);
    const pHead = new THREE.InstancedMesh(new THREE.BoxGeometry(0.9, 0.22, 0.45), bulbMat, parkPoles.length);
    parkPoles.forEach(([x, z, h, rot], idx) => {
      dummy.position.set(x, 0.36 + h / 2, z);
      dummy.scale.set(1, h, 1);
      dummy.rotation.set(0, rot, 0);
      dummy.updateMatrix();
      pPost.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, 0.36 + h + 0.08, z + Math.cos(rot) * 0.35);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pHead.setMatrixAt(idx, dummy.matrix);
      lightPools.push({ x, y: z < -48 ? 0.455 : z < -30 ? 0.34 : 0.525, z, size: h * 2.2 });
    });
    scene.add(pPost, pHead);
  }

  // Instanced sport floodlights
  if (sportMasts.length) {
    const sPost = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.14, 0.22, 11.0, 8), poleMat, sportMasts.length);
    const sHead = new THREE.InstancedMesh(new THREE.BoxGeometry(1.5, 0.42, 0.65), bulbMat, sportMasts.length);
    sportMasts.forEach(([x, z], idx) => {
      dummy.position.set(x, 0.36 + 5.5, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sPost.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, 0.36 + 11.0, z);
      dummy.updateMatrix();
      sHead.setMatrixAt(idx, dummy.matrix);
      lightPools.push({ x, y: 0.525, z, size: 22 });
    });
    scene.add(sPost, sHead);
  }

  // Instanced main road poles
  if (roadPoles.length) {
    const rPost = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.12, 0.18, 9.0, 8), poleMat, roadPoles.length);
    const rHead = new THREE.InstancedMesh(new THREE.BoxGeometry(1.2, 0.24, 0.5), bulbMat, roadPoles.length);
    roadPoles.forEach(([x, z, rot], idx) => {
      dummy.position.set(x, 0.08 + 4.5, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      rPost.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, 0.08 + 9.0, z + Math.cos(rot) * 0.45);
      dummy.updateMatrix();
      rHead.setMatrixAt(idx, dummy.matrix);
      lightPools.push({ x, y: 0.095, z, size: 17 });
    });
    scene.add(rPost, rHead);
  }

  // Halos lumineux au sol (AdditiveBlending, polygonOffset pour zéro Z-fighting)
  const poolMat = new THREE.MeshBasicMaterial({
    map: textures.lightPool,
    color: 0xffd796,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  const poolGeo = new THREE.PlaneGeometry(1, 1);
  poolGeo.rotateX(-Math.PI / 2);
  const poolInst = new THREE.InstancedMesh(poolGeo, poolMat, lightPools.length);
  poolInst.visible = false;
  lightPools.forEach((p, idx) => {
    dummy.position.set(p.x, p.y, p.z);
    dummy.rotation.set(0, 0, 0);
    dummy.scale.set(p.size, 1, p.size);
    dummy.updateMatrix();
    poolInst.setMatrixAt(idx, dummy.matrix);
  });
  scene.add(poolInst);

  // PointLights couvrant l'ensemble du parc et du parking en mode Nuit (désactivées le jour pour soulager le GPU mobile)
  const lightSpecs = isMobile
    ? [
        [-200, 20, 0, 125],   // Pôle Sportif Ouest
        [-70, 18, -4, 110],   // Arts Martiaux & Piscines
        [0, 18, -2, 115],     // Entrée, Bassin central & Théâtre
        [85, 18, 2, 115],     // Aires de Jeux, Pétanque & Jardins
        [195, 18, 0, 110],    // Fontaine Est & Halle pique-nique
        [120, 18, -52, 130],  // Parking & Cantines
      ]
    : [
        [-219, 18, 0.8, 86],  // Terrain de Football & Sprint
        [-162, 16, 0, 74],    // Padel, Tennis, Basket & Beach Sable
        [-82, 14, -4, 68],    // Arts Martiaux & Fitness
        [-50, 14, -9, 72],    // Piscines
        [0, 14, -20, 76],     // Entrée principale
        [0, 15, -1.6, 92],    // Bassin & Jets d'eau
        [0, 14, 14, 74],      // Théâtre de verdure & kiosques
        [52, 14, 4, 72],      // Aires de Jeux & Pétanque
        [135, 14, 0, 76],     // Promenades & Jardins
        [205, 14, 0, 72],     // Fontaine Est & Halle pique-nique
        [130, 14, -52, 84],   // Parking & Cantines
      ];

  const focalLights = lightSpecs.map(([x, y, z, dist]) => {
    const pl = new THREE.PointLight(0xffcb82, 0, dist, 1.0);
    pl.position.set(x, y, z);
    pl.visible = false;
    scene.add(pl);
    return pl;
  });

  // Maisons voisines, kiosques et cantines éclairés la nuit (fenêtres architecturales sur façades réelles)
  const rng = makeSeeded(8812);
  const winPositions = [];
  const pushFacadeWindows = (poly, yBot, yTop, paneW, stepW, maxWallSkip = false) => {
    if (!poly || poly.length < 3) return;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 1.8) continue;

      const tx = dx / len;
      const tz = dz / len;
      let nx = -tz;
      let nz = tx;
      const mx = (a[0] + b[0]) * 0.5;
      const mz = (a[1] + b[1]) * 0.5;
      if (pointInPoly2D([mx + nx * 0.12, mz + nz * 0.12], poly)) {
        nx = -nx;
        nz = -nz;
      }
      const ox = nx * 0.08;
      const oz = nz * 0.08;
      const margin = Math.min(0.65, len * 0.18);
      const usable = len - margin * 2;
      if (usable < 0.7) continue;

      for (let s = margin; s <= len - margin - Math.min(paneW, usable) + 0.05; s += stepW) {
        if (maxWallSkip && rng() < 0.28) continue;
        const wSpan = Math.min(paneW, len - margin - s);
        if (wSpan < 0.65) continue;
        const x0 = a[0] + tx * s + ox;
        const z0 = a[1] + tz * s + oz;
        const x1 = a[0] + tx * (s + wSpan) + ox;
        const z1 = a[1] + tz * (s + wSpan) + oz;

        winPositions.push(
          x0, yBot, z0,
          x1, yBot, z1,
          x1, yTop, z1,

          x0, yBot, z0,
          x1, yTop, z1,
          x0, yTop, z0
        );
      }
    }
  };

  for (const b of data.buildings) {
    if (rng() > 0.44 || b.h < 3.6) continue;
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [x, z] of b.poly) {
      if (x < minX) minX = x;
      if (x > maxX) maxX = x;
      if (z < minZ) minZ = z;
      if (z > maxZ) maxZ = z;
    }
    if (maxX - minX > 46 || maxZ - minZ > 46) continue;
    const yBot = Math.min(b.h * 0.44, 1.8);
    const yTop = yBot + Math.min(0.9, b.h * 0.24);
    pushFacadeWindows(b.poly, yBot, yTop, 1.35, 2.7, true);
  }
  for (const c of data.parkingDetails?.cantines || []) {
    if (rng() > 0.68) continue;
    pushFacadeWindows(c, 1.35, 2.05, 1.4, 2.2, false);
  }
  for (const z of data.zones) {
    if (z.kind !== "building") continue;
    pushFacadeWindows(z.poly, 1.45, 2.35, 1.3, 2.2, false);
  }

  const winMat = new THREE.MeshBasicMaterial({
    color: 0xffd28a,
    transparent: true,
    opacity: 0,
    side: THREE.DoubleSide,
  });
  let winMesh = null;
  if (winPositions.length) {
    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute("position", new THREE.Float32BufferAttribute(winPositions, 3));
    winGeo.computeVertexNormals();
    winMesh = new THREE.Mesh(winGeo, winMat);
    winMesh.visible = false;
    scene.add(winMesh);
  }

  return {
    applyNightFactor(f, now = 0) {
      const isNightActive = f > 0.005;
      if (poolInst.visible !== isNightActive) poolInst.visible = isNightActive;
      if (winMesh && winMesh.visible !== isNightActive) winMesh.visible = isNightActive;
      const pulse = 0.96 + 0.04 * Math.sin(now * 0.0018);
      const winPulse = 0.97 + 0.03 * Math.sin(now * 0.0012 + 1.1);
      bulbMat.emissiveIntensity = isNightActive ? f * 3.8 * pulse : 0;
      poolMat.opacity = isNightActive ? f * 0.62 * pulse : 0;
      winMat.opacity = isNightActive ? f * 0.82 * winPulse : 0;
      for (const pl of focalLights) {
        if (pl.visible !== isNightActive) pl.visible = isNightActive;
        pl.intensity = isNightActive ? f * (isMobile ? 72 : 58) : 0;
      }
    },
  };
}
