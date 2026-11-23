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
  return { benchCount: spots.length, spots };
}

export function buildMovingTraffic(scene, textures) {
  // Voies de circulation strictement séparées à droite (code de la route Sénégal), hors piste rouge et hors bordures
  const routes = [
    // Avenue Nord (chaussée large z in [-40..-29]) : Est->Ouest au Nord (-37.2), Ouest->Est au Sud (-32.2)
    { axis: "x", fixed: -32.2, min: -350, max: 350, dir: 1, speed: 9.8 },
    { axis: "x", fixed: -32.2, min: -350, max: 350, dir: 1, speed: 11.2 },
    { axis: "x", fixed: -32.2, min: -350, max: 350, dir: 1, speed: 9.1 },
    { axis: "x", fixed: -32.2, min: -350, max: 350, dir: 1, speed: 10.6 },
    { axis: "x", fixed: -37.2, min: -350, max: 350, dir: -1, speed: 10.8 },
    { axis: "x", fixed: -37.2, min: -350, max: 350, dir: -1, speed: 9.4 },
    { axis: "x", fixed: -37.2, min: -350, max: 350, dir: -1, speed: 11.5 },
    { axis: "x", fixed: -37.2, min: -350, max: 350, dir: -1, speed: 10.1 },
    // Rue Sud (strictement au Sud de la bande gazon z=28.43 et au Nord des îlots z=32.6) : Est->Ouest (-dir à z=29.7), Ouest->Est (+dir à z=31.6)
    { axis: "x", fixed: 31.6, min: -310, max: 310, dir: 1, speed: 8.6 },
    { axis: "x", fixed: 31.6, min: -310, max: 310, dir: 1, speed: 9.4 },
    { axis: "x", fixed: 29.7, min: -310, max: 310, dir: -1, speed: 9.1 },
    { axis: "x", fixed: 29.7, min: -310, max: 310, dir: -1, speed: 8.3 },
    // Axe Ouest : Sud (+dir à x=-264.6) / Nord (-dir à x=-260.4)
    { axis: "z", fixed: -264.6, min: -165, max: 145, dir: 1, speed: 9.2 },
    { axis: "z", fixed: -264.6, min: -165, max: 145, dir: 1, speed: 10.0 },
    { axis: "z", fixed: -260.4, min: -165, max: 145, dir: -1, speed: 10.2 },
    // Axe Est : Sud (+dir à x=263.4) / Nord (-dir à x=267.6)
    { axis: "z", fixed: 263.4, min: -165, max: 145, dir: 1, speed: 9.4 },
    { axis: "z", fixed: 267.6, min: -165, max: 145, dir: -1, speed: 8.7 },
    { axis: "z", fixed: 267.6, min: -165, max: 145, dir: -1, speed: 9.8 },
  ];

  // Compter les véhicules par file pour un espacement initial sans collision
  const laneBuckets = new Map();
  routes.forEach((r, idx) => {
    const key = `${r.axis}_${r.fixed}_${r.dir}`;
    if (!laneBuckets.has(key)) laneBuckets.set(key, []);
    laneBuckets.get(key).push(idx);
  });

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
    const key = `${r.axis}_${r.fixed}_${r.dir}`;
    const bucket = laneBuckets.get(key);
    const slot = bucket.indexOf(idx);
    const initPos = r.min + ((slot + 0.35 + (idx % 3) * 0.12) / bucket.length) * span;
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
      laneKey: key,
      pos: initPos,
      curSpeed: r.speed,
      wx: r.axis === "x" ? initPos : r.fixed,
      wz: r.axis === "x" ? r.fixed : initPos,
    };
  });

  // Carrefours où la priorité à droite / détection de croisement s'applique
  const intersections = [
    [-262.5, -34.7],
    [265.5, -34.7],
    [-262.5, 30.6],
    [265.5, 30.6],
  ];

  return {
    update(dt, nightFactor, camY = 126) {
      const showNight = nightFactor > 0.01;
      if (showNight) beamMat.opacity = nightFactor * 0.42;
      if (camY > 460) return;

      for (let i = 0; i < cars.length; i++) {
        const c = cars[i];
        const r = c.route;
        const span = r.max - r.min;
        let targetSpeed = r.speed;

        // 1. Distance de sécurité sur la même voie (jamais deux voitures ne se rentrent dedans)
        for (let j = 0; j < cars.length; j++) {
          if (i === j || cars[j].laneKey !== c.laneKey) continue;
          let fwd = (cars[j].pos - c.pos) * r.dir;
          if (fwd <= 0) fwd += span;
          if (fwd > 0 && fwd < 16.0) {
            const safeFactor = THREE.MathUtils.clamp((fwd - 8.0) / 8.0, 0, 1);
            targetSpeed = Math.min(targetSpeed, r.speed * safeFactor);
          }
        }

        // 2. Détection de collision aux 4 carrefours Nord/Sud ↔ Ouest/Est
        for (const [jx, jz] of intersections) {
          const toJunc = ((r.axis === "x" ? jx : jz) - c.pos) * r.dir;
          const crossErr = Math.abs((r.axis === "x" ? jz : jx) - r.fixed);
          if (crossErr < 6.0 && toJunc > 6.5 && toJunc < 16.5) {
            for (let j = 0; j < cars.length; j++) {
              const o = cars[j];
              if (o.route.axis === r.axis) continue;
              const dOther = Math.hypot(o.wx - jx, o.wz - jz);
              if (dOther < 11.5 && dOther < toJunc + 1.5) {
                targetSpeed = 0;
                break;
              }
            }
          }
        }

        const rate = targetSpeed < c.curSpeed ? 14.0 : 6.5;
        c.curSpeed += (targetSpeed - c.curSpeed) * Math.min(1, rate * dt);
        c.pos += r.dir * c.curSpeed * dt;
        if (c.pos > r.max) c.pos -= span;
        if (c.pos < r.min) c.pos += span;

        if (c.nightGroup.visible !== showNight) c.nightGroup.visible = showNight;
        if (r.axis === "x") {
          c.wx = c.pos;
          c.wz = r.fixed;
          c.group.position.set(c.pos, 0.08, r.fixed);
          c.group.rotation.y = r.dir > 0 ? Math.PI / 2 : -Math.PI / 2;
        } else {
          c.wx = r.fixed;
          c.wz = c.pos;
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

  // 1. 14 coureurs sur la PISTE rouge extérieure : sens de marche séparés (droite = intérieur horaire -0.52 / extérieur anti-horaire +0.52)
  for (let i = 0; i < 14; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    walkers.push({
      kind: "loop",
      t: i / 14 + (rng() - 0.5) * 0.02,
      baseSpeed: 2.0 + rng() * 0.85,
      laneOffset: dir > 0 ? -0.52 : 0.52,
      passOffset: 0,
      dir,
      phase: rng() * Math.PI * 2,
      strideSpeed: 5.0 + rng() * 0.9,
      bobAmp: 0.065,
      colorIdx: i % 5,
      px: 0,
      pz: 0,
      vx: 0,
      vz: 0,
    });
  }

  // 2. 28 promeneurs strictement cantonnés aux allées dallées vérifiées sans aucun obstacle ni bassin/terrain
  const segments = [
    [[-168, -21.8], [-104, -21.8]], // promenade Nord-Ouest
    [[-166, 21.8], [-102, 21.8]],   // promenade Sud-Ouest
    [[-68, 4.0], [-26, 4.0]],       // promenade Sud des piscines
    [[-18, -19.5], [18, -19.5]],    // parvis Entrée Principale
    [[-22, 6.2], [22, 6.2]],        // promenade Théâtre / Bassin central
    [[24, 9.8], [46, 19.6]],        // allée Kiosques Est -> Jeux
    [[72, 5.0], [134, 2.5]],        // promenade Pétanque -> Pelouses
    [[136, 2.2], [200, 2.2]],       // allée centrale Jardins Est -> Fontaine
    [[-44, -45.5], [118, -45.5]],   // esplanade Cantines Nord Ouest/Centre
    [[145, -45.5], [295, -45.5]],   // esplanade Cantines Nord Est
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
      dir: i % 2 === 0 ? 1 : -1,
      baseSpeed: 0.85 + rng() * 0.4,
      passOffset: 0,
      phase: rng() * Math.PI * 2,
      strideSpeed: 3.1 + rng() * 0.6,
      bobAmp: 0.04,
      colorIdx: (i + 2) % 5,
      px: ax,
      pz: az,
      vx: 0,
      vz: 0,
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
        let speedScale = 1.0;
        let targetPass = 0.0;

        if (w.kind === "loop") {
          // Détection de collision entre coureurs sur la même file de la piste
          for (let j = 0; j < walkers.length; j++) {
            const o = walkers[j];
            if (j === idx || o.kind !== "loop" || o.dir !== w.dir) continue;
            let du = (((o.t - w.t) * w.dir) % 1 + 1) % 1;
            const arcDist = du * PISTE_PERIM;
            if (arcDist > 0 && arcDist < 2.2) {
              speedScale = Math.min(speedScale, THREE.MathUtils.clamp((arcDist - 0.8) / 1.4, 0.35, 1));
              targetPass = w.dir > 0 ? -0.28 : 0.28;
            }
          }
          w.passOffset += (targetPass - w.passOffset) * Math.min(1, 4 * dt);
          w.t += w.dir * ((w.baseSpeed * speedScale) / PISTE_PERIM) * dt;
          const [lx, lz, vx, vz] = sampleLoopPoint(w.t, w.laneOffset + w.passOffset);
          w.px = lx;
          w.pz = lz;
          w.vx = vx * w.dir;
          w.vz = vz * w.dir;
        } else {
          // Détection d'approche + écart latéral sur allées piétonnes (marche à droite)
          for (let j = 0; j < walkers.length; j++) {
            const o = walkers[j];
            if (j === idx || o.kind !== "seg") continue;
            const relX = o.px - w.px;
            const relZ = o.pz - w.pz;
            const distSq = relX * relX + relZ * relZ;
            if (distSq < 2.4 && distSq > 1e-4) {
              const fwdDot = (relX * w.vx + relZ * w.vz) / Math.sqrt(distSq);
              if (fwdDot > 0.25) {
                speedScale = Math.min(speedScale, 0.45);
                targetPass = 0.35;
              }
            }
          }
          w.passOffset += (targetPass - w.passOffset) * Math.min(1, 5 * dt);
          w.t += w.dir * ((w.baseSpeed * speedScale) / w.segLen) * dt;
          if (w.t > 1) {
            w.t = 1;
            w.dir = -1;
          } else if (w.t < 0) {
            w.t = 0;
            w.dir = 1;
          }
          const tx = (w.bx - w.ax) / w.segLen;
          const tz = (w.bz - w.az) / w.segLen;
          w.vx = tx * w.dir;
          w.vz = tz * w.dir;
          // Tenir sa droite sur l'allée : normale droite = (-vz, vx)
          const laneShift = 0.42 + w.passOffset;
          w.px = w.ax + (w.bx - w.ax) * w.t + -w.vz * laneShift;
          w.pz = w.az + (w.bz - w.az) * w.t + w.vx * laneShift;
        }

        const bob = Math.abs(Math.sin(tSec * w.strideSpeed + w.phase)) * w.bobAmp;
        const rotY = Math.atan2(w.vx, w.vz);

        dummy.position.set(w.px, 0.41 + 0.52 + bob, w.pz);
        dummy.rotation.set(0, rotY, Math.sin(tSec * w.strideSpeed + w.phase) * 0.04);
        dummy.scale.set(1, 1, 1);
        dummy.updateMatrix();
        torsos.setMatrixAt(idx, dummy.matrix);

        dummy.position.set(w.px, 0.41 + 1.18 + bob, w.pz);
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

function pointNearPoly2D(pt, poly, margin) {
  if (pointInPoly2D(pt, poly)) return true;
  return pointNearPolyEdge2D(pt, poly, margin);
}

export function buildLightingNetwork(
  scene,
  data,
  textures,
  isMobile = false,
  excludeDisks = [],
  furniturePlaced = [],
  benchSpots = []
) {
  const bollards = [];
  const parkPoles = [];
  const sportMasts = [];
  const roadPoles = [];

  const nearExcludeDisk = (x, z, extra = 0.75) =>
    excludeDisks.some(([dx, dz, dr]) => Math.hypot(dx - x, dz - z) < dr + extra);

  const greenZonesList = data.zones.filter((z) => z.kind === "green");
  const isNearGreenZone = (x, z, margin = 0.65) =>
    greenZonesList.some(
      (gz) =>
        inZone2D([x, z], gz) ||
        pointNearPolyEdge2D([x, z], gz.poly, margin)
    );

  const forbiddenZones = data.zones.filter(
    (z) =>
      z.kind === "water" ||
      z.kind === "sport" ||
      z.kind === "play" ||
      z.kind === "track" ||
      z.kind === "gradin" ||
      z.kind === "building" ||
      z.name.toUpperCase().includes("BEACH") ||
      z.name.toUpperCase().includes("SABLE")
  );
  const isNearZone2D = (pt, z, margin) => {
    if (inZone2D(pt, z)) return true;
    if (margin <= 0) return false;
    if (pointNearPolyEdge2D(pt, z.poly, margin)) return true;
    if (z.holes && z.holes.some((h) => pointNearPolyEdge2D(pt, h, margin))) return true;
    return false;
  };
  const isClearOfPoolsAndCourts = (x, z, margin = 1.4) => {
    // Dégager la boucle rouge semi-circulaire au Sud du Théâtre de Verdure
    if (Math.abs(x) < 15.5 && z > 18.5 && z < 28.0) return false;
    return !forbiddenZones.some((fz) => isNearZone2D([x, z], fz, margin));
  };

  // Deux allées diagonales (NO et NE) longeant le Bassin Central réservées aux arches lumineuses torsadées
  const ARCH_CORRIDORS = [
    {
      ox: -10.16 - Math.SQRT1_2 * 2.15,
      oz: -11.98 - Math.SQRT1_2 * 2.15,
      dx: -Math.SQRT1_2,
      dz: Math.SQRT1_2,
      nx: -Math.SQRT1_2,
      nz: -Math.SQRT1_2,
    },
    {
      ox: 10.17 + Math.SQRT1_2 * 2.15,
      oz: -11.98 - Math.SQRT1_2 * 2.15,
      dx: Math.SQRT1_2,
      dz: Math.SQRT1_2,
      nx: Math.SQRT1_2,
      nz: -Math.SQRT1_2,
    },
  ];
  const isInArchCorridor = (x, z, pad = 2.55) =>
    ARCH_CORRIDORS.some(
      (c) =>
        distToSegment2D(
          x,
          z,
          c.ox + c.dx * 0.6,
          c.oz + c.dz * 0.6,
          c.ox + c.dx * 17.0,
          c.oz + c.dz * 17.0
        ) < pad
    );

  // Registres d'espacement unifiés pour éviter toute redondance ou superposition visuelle
  const placedTallPoles = [];
  const placedBollards = [];
  const nearAny = (arr, x, z, minDist) =>
    arr.some(([ax, az]) => Math.hypot(ax - x, az - z) < minDist);

  // 1. Mâts sportifs (11 m) — priorité n° 1 sur le pôle sportif Ouest
  [
    [-246.5, -14.8],
    [-191.5, -14.8],
    [-246.5, 17.5],
    [-191.5, 17.5],
    [-187, -21.5],
    [-162, 20.5],
    [-142, -21.5],
    [-156, 20.6],
    [-109.5, -18.5],
    [-109.5, 20.5],
    [-64, -20],
    [-64, 18],
  ].forEach(([sx, sz]) => {
    if (isClearOfPoolsAndCourts(sx, sz, 0.9) && !nearAny(placedTallPoles, sx, sz, 11.0)) {
      sportMasts.push([sx, sz]);
      placedTallPoles.push([sx, sz]);
    }
  });

  // 2. Lampadaires d'avenues principales (pas régulier de 34 m sans surdensité)
  const addRoadPole = (x, z, rot) => {
    if (nearAny(placedTallPoles, x, z, 12.0)) return;
    roadPoles.push([x, z, rot]);
    placedTallPoles.push([x, z]);
  };
  for (let x = -272; x <= 272; x += 34) {
    if (Math.abs(x) >= 12) addRoadPole(x, -29.0, 0);
    addRoadPole(x, -42.4, Math.PI);
    addRoadPole(x, 28.8, Math.PI);
  }
  for (let z = -126; z <= 112; z += 36) {
    if (Math.abs(z) < 34) continue;
    addRoadPole(-256, z, Math.PI / 2);
    addRoadPole(258, z, -Math.PI / 2);
  }

  // 3. Lampadaires de parking & équipements périphériques (aucun lampadaire sur les allées intérieures du parc)
  const addParkPole = (x, z, h, rot, checkZones = true, minSep = 13.5) => {
    if (isInArchCorridor(x, z) || nearExcludeDisk(x, z, 0.9)) return;
    if (checkZones && !isClearOfPoolsAndCourts(x, z, 1.8)) return;
    if (nearAny(placedTallPoles, x, z, minSep)) return;
    parkPoles.push([x, z, h, rot]);
    placedTallPoles.push([x, z]);
  };
  for (let x = -50; x <= 316; x += 28) {
    addParkPole(x, -53.5, 8.0, 0, false, 16.0); // mâts centraux parking nord (sans double rangée devant cantines)
  }
  // Lampadaires dédiés sur le parvis de la Banque et les pistes des 2 Stations-service
  [
    [-133.2, -64.2, 6.2, 0],
    [-108.0, -64.2, 6.2, 0],
    [-251.5, -52.5, 5.4, 0],
    [-220.5, -52.5, 6.4, 0],
    [-277.5, -1.2, 6.0, 0],
    [-298.5, -1.2, 6.0, 0],
  ].forEach(([px, pz, ph, prot]) => addParkPole(px, pz, ph, prot, false, 10.0));

  // 4. Petits postes / bornes architecturales de jardin & abords des pelouses (aucune borne sur les allées de circulation)
  const addBollard = (x, z, checkZones = true, minPoleDist = 6.5, minBollardDist = 8.5) => {
    if (isInArchCorridor(x, z) || nearExcludeDisk(x, z, 0.75)) return;
    if (checkZones && !isClearOfPoolsAndCourts(x, z, 1.1)) return;
    if (nearAny(placedTallPoles, x, z, minPoleDist)) return;
    if (nearAny(placedBollards, x, z, minBollardDist)) return;
    bollards.push([x, z]);
    placedBollards.push([x, z]);
  };
  for (const [lx, lz] of data.lights || []) {
    // Exclure tout point lumineux du DXF qui tomberait sur une allée intérieure hors jardin/pelouse
    if (Math.abs(lx) < 248 && Math.abs(lz) < 25 && !isNearGreenZone(lx, lz, 0.8)) continue;
    addBollard(lx, lz, true, 6.5, 8.0);
  }
  // Pourtour de la fontaine Est (hors allées du bassin central)
  for (let a = 0; a < 6; a++) {
    const ang = (a / 6) * Math.PI * 2;
    addBollard(213.2 + Math.cos(ang) * 10.5, 1.9 + Math.sin(ang) * 9.0, true, 6.5, 8.2);
  }

  // Petits postes de jardin répartis en lisière des pelouses et massifs fleuris
  const gardenZones = data.zones.filter(
    (z) =>
      z.kind === "green" &&
      z.area > 15 &&
      z.area < 3600 &&
      !z.name.toUpperCase().includes("BANDE DE GAZON") &&
      !(z.holes && z.holes.length)
  );
  for (const gz of gardenZones) {
    const poly = gz.poly;
    if (!poly || poly.length < 3) continue;
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
      const len = Math.hypot(b[0] - a[0], b[1] - a[1]);
      if (len < 7.5) continue;
      const steps = len > 24 ? 2 : 1;
      for (let k = 1; k <= steps; k++) {
        const u = k / (steps + 1);
        const mx = a[0] + (b[0] - a[0]) * u;
        const mz = a[1] + (b[1] - a[1]) * u;
        const dx = b[0] - a[0];
        const dz = b[1] - a[1];
        let nx = -dz / len;
        let nz = dx / len;
        if ((cx - mx) * nx + (cz - mz) * nz < 0) {
          nx = -nx;
          nz = -nz;
        }
        const bx = mx + nx * 0.72;
        const bz = mz + nz * 0.72;
        if (pointInPoly2D([bx, bz], poly)) {
          addBollard(bx, bz, true, 6.5, 9.0);
        }
      }
    }
  }

  for (let x = -42; x <= 298; x += 34) {
    addBollard(x, -44.6, false, 9.0, 14.0);
  }
  [
    [-131.5, -62.5],
    [-109.7, -62.5],
    [-131.5, -83.6],
    [-109.7, -83.6],
  ].forEach(([bx, bz]) => addBollard(bx, bz, false, 7.0, 8.0));

  // 4c. Spots encastrés au sol sur les pelouses, jardins d'arbustes et parterres fleuris
  const spotRng = makeSeeded(91426);
  const groundSpots = []; // [x, z, yBase]
  const addGroundSpot = (x, z, gy = 0.455, minSpotSep = 6.0) => {
    if (isInArchCorridor(x, z) || nearExcludeDisk(x, z, 0.75)) return false;
    if (groundSpots.some(([sx, sz]) => Math.hypot(sx - x, sz - z) < minSpotSep)) return false;
    if (nearAny(placedBollards, x, z, 3.4)) return false;
    if (nearAny(placedTallPoles, x, z, 4.0)) return false;
    groundSpots.push([x, z, gy]);
    return true;
  };
  for (const gz of gardenZones) {
    let minX = Infinity, maxX = -Infinity, minZ = Infinity, maxZ = -Infinity;
    for (const [px, pz] of gz.poly) {
      if (px < minX) minX = px;
      if (px > maxX) maxX = px;
      if (pz < minZ) minZ = pz;
      if (pz > maxZ) maxZ = pz;
    }
    const target = Math.min(8, Math.max(1, Math.round(gz.area / 75)));
    let added = 0;
    if (
      gz.centroid &&
      inZone2D(gz.centroid, gz) &&
      isClearOfPoolsAndCourts(gz.centroid[0], gz.centroid[1], 0.85) &&
      addGroundSpot(gz.centroid[0], gz.centroid[1], 0.455, 6.0)
    ) {
      added++;
    }
    for (let tries = 0; tries < target * 14 && added < target; tries++) {
      const px = minX + spotRng() * (maxX - minX);
      const pz = minZ + spotRng() * (maxZ - minZ);
      if (!inZone2D([px, pz], gz)) continue;
      if (!isClearOfPoolsAndCourts(px, pz, 0.85)) continue;
      if (addGroundSpot(px, pz, 0.455, 6.0)) added++;
    }
  }
  // Spots architecturaux autour du flamboyant sur le sommet du gradin triangulaire & parvis Entrée
  for (let a = 0; a < 4; a++) {
    const ang = (a / 4) * Math.PI * 2 + Math.PI * 0.25;
    addGroundSpot(-146.27 + Math.cos(ang) * 2.15, 10.02 + Math.sin(ang) * 2.15, 0.96, 1.5);
  }
  [
    [-16.5, -21.0, 0.455],
    [16.5, -21.0, 0.455],
    [-18.0, 12.8, 0.455],
    [18.0, 12.8, 0.455],
  ].forEach(([sx, sz, sy]) => addGroundSpot(sx, sz, sy, 4.0));

  // 4b. Quelques lampadaires à faible luminosité dans les rues secondaires des quartiers voisins
  const streetPoles = [];
  const nearBlds = data.buildings || [];
  const cantines = data.parkingDetails?.cantines || [];
  const isClearStreetPole = (x, z) => {
    if (x > -256 && x < 256 && z > -31 && z < 31) return false;
    if (x > -68 && x < 328 && z > -66 && z < -41) return false;
    if (x > -136 && x < -105 && z > -86 && z < -60) return false;
    if (x > -276 && x < -198 && z > -98 && z < -42) return false;
    if (x > -320 && x < -270 && z > -17 && z < 1) return false;
    if (roadPoles.some(([rx, rz]) => Math.hypot(x - rx, z - rz) < 17)) return false;
    if (parkPoles.some(([px, pz]) => Math.hypot(x - px, z - pz) < 16)) return false;
    if (streetPoles.some(([sx, sz]) => Math.hypot(x - sx, z - sz) < 28)) return false;
    if (cantines.some((c) => pointNearPoly2D([x, z], c, 2.0))) return false;
    if (nearBlds.some((b) => !b.isContextSkip && pointNearPoly2D([x, z], b.poly, 1.8))) return false;
    return true;
  };

  // Trottoirs des îlots des rues Sud (data.roads.slice(1))
  const roadBlocks = (data.roads || []).slice(1);
  for (const blk of roadBlocks) {
    if (!blk || blk.length < 3) continue;
    for (let i = 0; i < blk.length; i++) {
      const a = blk[i];
      const b = blk[(i + 1) % blk.length];
      const dx = b[0] - a[0];
      const dz = b[1] - a[1];
      const len = Math.hypot(dx, dz);
      if (len < 24) continue;
      const tx = dx / len;
      const tz = dz / len;
      let nx = -tz;
      let nz = tx;
      const mx = (a[0] + b[0]) * 0.5;
      const mz = (a[1] + b[1]) * 0.5;
      if (pointInPoly2D([mx + nx * 0.4, mz + nz * 0.4], blk)) {
        nx = -nx;
        nz = -nz;
      }
      const rot = Math.atan2(nx, nz);
      const fracs = len > 68 ? [0.28, 0.72] : [0.5];
      for (const u of fracs) {
        const px = a[0] + dx * u + nx * 0.7;
        const pz = a[1] + dz * u + nz * 0.7;
        if (Math.abs(px) > 385 || Math.abs(pz) > 175) continue;
        if (pz < 35 && pz > -45) continue;
        if (isClearStreetPole(px, pz)) {
          streetPoles.push([px, pz, rot]);
        }
      }
    }
  }

  // Rues secondaires Nord et transversales Ouest/Est
  for (let x = -320; x <= 300; x += 38) {
    for (const z of [-68, -94, 66, 108]) {
      if (isClearStreetPole(x, z)) {
        streetPoles.push([x, z, z < 0 ? 0 : Math.PI]);
      }
    }
  }

  const mergeUnitGeoms = (geoms) => {
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

  const poleMat = new THREE.MeshStandardMaterial({ color: 0x4b4f56, roughness: 0.52, metalness: 0.24 });
  const bulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const dimBulbMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const dayBulbCol = new THREE.Color(0xdad2c6);
  const darkBulbCol = new THREE.Color(0x464d59);
  const litBulbCol = new THREE.Color(0xfff0c2);
  const litDimBulbCol = new THREE.Color(0xffcf8b);
  const _tmpBulbCol = new THREE.Color();

  const lightPools = []; // { x, y, z, size, delay }
  const dimLightPools = []; // { x, y, z, size, delay }
  const lampHeads = []; // { mesh, idx, x, y, z, rot, delay, isDim }
  const dummy = new THREE.Object3D();
  const calcWaveDelay = (x, z, extra = 0) =>
    Math.min(0.72, extra + Math.hypot(x, z * 1.4) / 440);

  // 1. Bornes architecturales de jardin (socle étagé + fût + cage à colonnettes + chapeau débordant + lanterne)
  if (bollards.length) {
    const bParts = [];
    const plinth = new THREE.CylinderGeometry(0.18, 0.21, 0.1, 10);
    plinth.translate(0, 0.05, 0);
    bParts.push(plinth);
    const shaft = new THREE.CylinderGeometry(0.11, 0.14, 0.86, 10);
    shaft.translate(0, 0.52, 0);
    bParts.push(shaft);
    const midCollar = new THREE.CylinderGeometry(0.165, 0.155, 0.05, 12);
    midCollar.translate(0, 0.96, 0);
    bParts.push(midCollar);
    for (let r = 0; r < 3; r++) {
      const ang = (r / 3) * Math.PI * 2;
      const rib = new THREE.CylinderGeometry(0.014, 0.014, 0.24, 5);
      rib.translate(Math.cos(ang) * 0.155, 1.09, Math.sin(ang) * 0.155);
      bParts.push(rib);
    }
    const cap = new THREE.CylinderGeometry(0.09, 0.27, 0.085, 12);
    cap.translate(0, 1.24, 0);
    bParts.push(cap);

    const bPost = new THREE.InstancedMesh(mergeUnitGeoms(bParts), poleMat, bollards.length);
    const bHead = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.125, 0.125, 0.21, 12), bulbMat, bollards.length);
    bollards.forEach(([x, z], idx) => {
      dummy.position.set(x, 0.44, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      bPost.setMatrixAt(idx, dummy.matrix);

      const hy = 0.44 + 1.09;
      dummy.position.set(x, hy, z);
      dummy.updateMatrix();
      bHead.setMatrixAt(idx, dummy.matrix);
      const delay = calcWaveDelay(x, z, 0.0);
      lightPools.push({ x, y: z < -30 ? 0.34 : 0.525, z, size: 7.5, delay });
      lampHeads.push({ mesh: bHead, idx, x, y: hy, z, rot: 0, delay, isDim: false });
    });
    scene.add(bPost, bHead);
  }

  // 1b. Spots encastrés au sol sur pelouses et jardins (collerette métallique + optique lumineuse + halo doux au sol)
  if (groundSpots.length) {
    const gsBezelMat = new THREE.MeshStandardMaterial({ color: 0x52565d, roughness: 0.42, metalness: 0.35 });
    const gsFrame = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.26, 0.30, 0.045, 12), gsBezelMat, groundSpots.length);
    const gsHead = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.18, 0.18, 0.048, 12), bulbMat, groundSpots.length);
    groundSpots.forEach(([x, z, gy], idx) => {
      dummy.position.set(x, gy + 0.018, z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      gsFrame.setMatrixAt(idx, dummy.matrix);

      const hy = gy + 0.028;
      dummy.position.set(x, hy, z);
      dummy.updateMatrix();
      gsHead.setMatrixAt(idx, dummy.matrix);

      const delay = calcWaveDelay(x, z, 0.03);
      lightPools.push({ x, y: gy + 0.032, z, size: 7.4, delay });
      lampHeads.push({ mesh: gsHead, idx, x, y: hy, z, rot: 0, delay, isDim: false });
    });
    scene.add(gsFrame, gsHead);
  }

  // 1c. Portiques sculpturaux lumineux en torsion géométrique (exclusivement sur les 2 allées NO & NE du Bassin Central)
  const archDayLedCol = new THREE.Color(0xede6da);
  const archDarkLedCol = new THREE.Color(0x555c69);
  const archLitLedCol = new THREE.Color(0xfff4d4);
  const archLedEntries = []; // { mat, delay }
  {
    const buildArchPolyline = (deg) => {
      const rx = 1.9;
      const ry = 1.92;
      const cy = 2.12;
      const halfW = 1.56;
      const th = (deg * Math.PI) / 180;
      const raw = [0, 1, 2, 3].map((j) => {
        const a = ((j * 90 + 45) * Math.PI) / 180 + th;
        return { u: rx * Math.cos(a), y: cy + ry * Math.sin(a) };
      });
      const upper = raw
        .filter((p) => p.y >= 1.45)
        .sort((a, b) => Math.atan2(b.y, b.u) - Math.atan2(a.y, a.u));
      return [[-halfW, 0], ...upper.map((p) => [p.u, p.y]), [halfW, 0]];
    };

    const computeMiterOffsets = (pts, halfT) => {
      const m = pts.length - 1;
      const segs = [];
      for (let i = 0; i < m; i++) {
        const du = pts[i + 1][0] - pts[i][0];
        const dy = pts[i + 1][1] - pts[i][1];
        const len = Math.hypot(du, dy) || 1;
        const tx = du / len;
        const ty = dy / len;
        segs.push({ tx, ty, ox: -ty, oy: tx });
      }
      const outer = new Array(pts.length);
      const inner = new Array(pts.length);
      const ty0 = Math.max(0.4, Math.abs(segs[0].ty)) * Math.sign(segs[0].ty || 1);
      outer[0] = [pts[0][0] - halfT / ty0, 0];
      inner[0] = [pts[0][0] + halfT / ty0, 0];
      const tyL = Math.max(0.4, Math.abs(segs[m - 1].ty)) * Math.sign(segs[m - 1].ty || -1);
      outer[m] = [pts[m][0] - halfT / tyL, 0];
      inner[m] = [pts[m][0] + halfT / tyL, 0];
      for (let i = 1; i < m; i++) {
        const bx = segs[i - 1].ox + segs[i].ox;
        const by = segs[i - 1].oy + segs[i].oy;
        const bl = Math.hypot(bx, by) || 1;
        const ux = bx / bl;
        const uy = by / bl;
        const denom = Math.max(0.45, ux * segs[i - 1].ox + uy * segs[i - 1].oy);
        outer[i] = [pts[i][0] + ux * (halfT / denom), pts[i][1] + uy * (halfT / denom)];
        inner[i] = [pts[i][0] - ux * (halfT / denom), pts[i][1] - uy * (halfT / denom)];
      }
      return { outer, inner, segs };
    };

    const pushQuadWorld = (arr, a, b, c, d, flip) => {
      if (flip) {
        arr.push(
          a[0], a[1], a[2], c[0], c[1], c[2], b[0], b[1], b[2],
          a[0], a[1], a[2], d[0], d[1], d[2], c[0], c[1], c[2]
        );
      } else {
        arr.push(
          a[0], a[1], a[2], b[0], b[1], b[2], c[0], c[1], c[2],
          a[0], a[1], a[2], c[0], c[1], c[2], d[0], d[1], d[2]
        );
      }
    };

    const halfT = 0.13;
    const halfDepth = 0.13;
    const baseY = 0.35;
    const archFramePos = [];
    const ledPosByIndex = Array.from({ length: 8 }, () => []);

    for (const cor of ARCH_CORRIDORS) {
      const flip = cor.nx * cor.dz - cor.nz * cor.dx < 0;
      for (let k = 0; k < 8; k++) {
        const s = 1.25 + k * 2.1;
        const deg = -22 + k * 10;
        const cx = cor.ox + cor.dx * s;
        const cz = cor.oz + cor.dz * s;
        const toW = (u, y, w) => [
          cx + cor.nx * u + cor.dx * w,
          baseY + y,
          cz + cor.nz * u + cor.dz * w,
        ];

        const pts = buildArchPolyline(deg);
        const { outer, inner, segs } = computeMiterOffsets(pts, halfT);
        const m = pts.length - 1;
        const ledArr = ledPosByIndex[k];
        const revealStripFrac = 0.042 / (2 * halfT);

        for (let i = 0; i < m; i++) {
          const iF0 = toW(inner[i][0], inner[i][1], halfDepth);
          const iF1 = toW(inner[i + 1][0], inner[i + 1][1], halfDepth);
          const oF1 = toW(outer[i + 1][0], outer[i + 1][1], halfDepth);
          const oF0 = toW(outer[i][0], outer[i][1], halfDepth);

          const iB0 = toW(inner[i][0], inner[i][1], -halfDepth);
          const iB1 = toW(inner[i + 1][0], inner[i + 1][1], -halfDepth);
          const oB1 = toW(outer[i + 1][0], outer[i + 1][1], -halfDepth);
          const oB0 = toW(outer[i][0], outer[i][1], -halfDepth);

          // Caisson acier anthracite : faces avant/arrière, extrados et intrados
          pushQuadWorld(archFramePos, iF0, iF1, oF1, oF0, flip);
          pushQuadWorld(archFramePos, oB0, oB1, iB1, iB0, flip);
          pushQuadWorld(archFramePos, oF0, oF1, oB1, oB0, flip);
          pushQuadWorld(archFramePos, iB0, iB1, iF1, iF0, flip);

          // Bandeau LED continu encastré en intrados (orienté vers le passage intérieur)
          const inNx = -segs[i].ox;
          const inNy = -segs[i].oy;
          const suf = 0.008;
          const lSuf0F = toW(inner[i][0] + inNx * suf, inner[i][1] + inNy * suf, 0.048);
          const lSuf1F = toW(inner[i + 1][0] + inNx * suf, inner[i + 1][1] + inNy * suf, 0.048);
          const lSuf0B = toW(inner[i][0] + inNx * suf, inner[i][1] + inNy * suf, -0.048);
          const lSuf1B = toW(inner[i + 1][0] + inNx * suf, inner[i + 1][1] + inNy * suf, -0.048);
          pushQuadWorld(ledArr, lSuf0B, lSuf1B, lSuf1F, lSuf0F, flip);

          // Liserés LED lumineux sur les arêtes internes avant et arrière (visibles en perspective & vue aérienne)
          const r0u = inner[i][0] + (outer[i][0] - inner[i][0]) * revealStripFrac;
          const r0y = inner[i][1] + (outer[i][1] - inner[i][1]) * revealStripFrac;
          const r1u = inner[i + 1][0] + (outer[i + 1][0] - inner[i + 1][0]) * revealStripFrac;
          const r1y = inner[i + 1][1] + (outer[i + 1][1] - inner[i + 1][1]) * revealStripFrac;

          pushQuadWorld(
            ledArr,
            toW(inner[i][0], inner[i][1], halfDepth + 0.004),
            toW(inner[i + 1][0], inner[i + 1][1], halfDepth + 0.004),
            toW(r1u, r1y, halfDepth + 0.004),
            toW(r0u, r0y, halfDepth + 0.004),
            flip
          );
          pushQuadWorld(
            ledArr,
            toW(r0u, r0y, -halfDepth - 0.004),
            toW(r1u, r1y, -halfDepth - 0.004),
            toW(inner[i + 1][0], inner[i + 1][1], -halfDepth - 0.004),
            toW(inner[i][0], inner[i][1], -halfDepth - 0.004),
            flip
          );
        }

        const delay = calcWaveDelay(cx, cz, 0.02 + k * 0.022);
        lightPools.push({ x: cx, y: 0.372, z: cz, size: 5.8, delay });
        for (const uFoot of [-1.48, 1.48]) {
          lightPools.push({
            x: cx + cor.nx * uFoot,
            y: 0.372,
            z: cz + cor.nz * uFoot,
            size: 2.8,
            delay,
          });
        }
      }
    }

    if (archFramePos.length) {
      const archFrameGeo = new THREE.BufferGeometry();
      archFrameGeo.setAttribute("position", new THREE.Float32BufferAttribute(archFramePos, 3));
      archFrameGeo.computeVertexNormals();
      const archFrameMat = new THREE.MeshStandardMaterial({
        color: 0x262a31,
        roughness: 0.46,
        metalness: 0.36,
      });
      const archFrameMesh = new THREE.Mesh(archFrameGeo, archFrameMat);
      archFrameMesh.castShadow = true;
      archFrameMesh.receiveShadow = true;
      scene.add(archFrameMesh);
    }

    ledPosByIndex.forEach((posArr, k) => {
      if (!posArr.length) return;
      const ledGeo = new THREE.BufferGeometry();
      ledGeo.setAttribute("position", new THREE.Float32BufferAttribute(posArr, 3));
      ledGeo.computeVertexNormals();
      const mat = new THREE.MeshBasicMaterial({ color: archDayLedCol.clone() });
      const mesh = new THREE.Mesh(ledGeo, mat);
      scene.add(mesh);
      archLedEntries.push({
        mat,
        delay: calcWaveDelay(16, -9, 0.02 + k * 0.022),
      });
    });
  }

  // 2. Lampadaires d'allées de parc & parking (socle mouluré + mât fuselé + crosse galbée + abat-jour disque + globe chaud)
  if (parkPoles.length) {
    const baseParts = [];
    const bp1 = new THREE.CylinderGeometry(0.21, 0.27, 0.24, 10);
    bp1.translate(0, 0.12, 0);
    baseParts.push(bp1);
    const bp2 = new THREE.CylinderGeometry(0.15, 0.21, 0.28, 10);
    bp2.translate(0, 0.38, 0);
    baseParts.push(bp2);

    const armParts = [];
    const collar = new THREE.CylinderGeometry(0.115, 0.105, 0.16, 10);
    collar.translate(0, 0.04, 0);
    armParts.push(collar);
    // Bras oblique + tirant vers +Z
    const arm = new THREE.CylinderGeometry(0.045, 0.06, 0.66, 8);
    arm.rotateX(1.06);
    arm.translate(0, 0.18, 0.28);
    armParts.push(arm);
    const brace = new THREE.CylinderGeometry(0.024, 0.028, 0.42, 6);
    brace.rotateX(1.42);
    brace.translate(0, 0.05, 0.22);
    armParts.push(brace);
    // Abat-jour architectural en chapeau conique
    const shade = new THREE.CylinderGeometry(0.14, 0.48, 0.13, 14);
    shade.translate(0, 0.32, 0.56);
    armParts.push(shade);
    const finial = new THREE.CylinderGeometry(0.03, 0.14, 0.07, 10);
    finial.translate(0, 0.41, 0.56);
    armParts.push(finial);

    const pBase = new THREE.InstancedMesh(mergeUnitGeoms(baseParts), poleMat, parkPoles.length);
    const pPost = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.085, 0.145, 1, 10), poleMat, parkPoles.length);
    const pArm = new THREE.InstancedMesh(mergeUnitGeoms(armParts), poleMat, parkPoles.length);
    const pGlobeGeo = new THREE.SphereGeometry(0.22, 12, 8);
    pGlobeGeo.scale(1.0, 0.62, 1.0);
    const pHead = new THREE.InstancedMesh(pGlobeGeo, bulbMat, parkPoles.length);
    pPost.castShadow = true;

    parkPoles.forEach(([x, z, h, rot], idx) => {
      dummy.position.set(x, 0.36, z);
      dummy.scale.set(1, 1, 1);
      dummy.rotation.set(0, rot, 0);
      dummy.updateMatrix();
      pBase.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, 0.36 + h / 2, z);
      dummy.scale.set(1, h, 1);
      dummy.updateMatrix();
      pPost.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(x, 0.36 + h, z);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      pArm.setMatrixAt(idx, dummy.matrix);

      const hx = x + Math.sin(rot) * 0.56;
      const hy = 0.36 + h + 0.2;
      const hz = z + Math.cos(rot) * 0.56;
      dummy.position.set(hx, hy, hz);
      dummy.updateMatrix();
      pHead.setMatrixAt(idx, dummy.matrix);
      const delay = calcWaveDelay(x, z, 0.05);
      lightPools.push({ x, y: z < -48 ? 0.455 : z < -30 ? 0.34 : 0.525, z, size: h * 2.2, delay });
      lampHeads.push({ mesh: pHead, idx, x: hx, y: hy, z: hz, rot, delay, isDim: false });
    });
    scene.add(pBase, pPost, pArm, pHead);
  }

  // 3. Mâts sportifs (11 m) avec socle lourd, traverse T contreventée et triple rampe de projecteurs orientée
  if (sportMasts.length) {
    const sParts = [];
    const sBase = new THREE.CylinderGeometry(0.24, 0.34, 0.75, 10);
    sBase.translate(0, 0.375, 0);
    sParts.push(sBase);
    const sCol = new THREE.CylinderGeometry(0.13, 0.22, 11.0, 10);
    sCol.translate(0, 5.5, 0);
    sParts.push(sCol);
    const sBar = new THREE.BoxGeometry(2.5, 0.14, 0.16);
    sBar.translate(0, 11.02, 0);
    sParts.push(sBar);
    for (const bx of [-0.65, 0.65]) {
      const strut = new THREE.CylinderGeometry(0.035, 0.04, 1.05, 6);
      strut.rotateZ(bx > 0 ? -0.64 : 0.64);
      strut.translate(bx * 0.55, 10.6, 0);
      sParts.push(strut);
    }
    const lensParts = [];
    for (const fx of [-0.95, 0, 0.95]) {
      const brk = new THREE.BoxGeometry(0.1, 0.22, 0.14);
      brk.translate(fx, 11.16, 0.06);
      sParts.push(brk);
      const hs = new THREE.BoxGeometry(0.5, 0.28, 0.26);
      hs.rotateX(0.36);
      hs.translate(fx, 11.32, 0.12);
      sParts.push(hs);

      const lens = new THREE.BoxGeometry(0.42, 0.22, 0.07);
      lens.rotateX(0.36);
      lens.translate(fx, -0.02, 0.13);
      lensParts.push(lens);
    }

    const sPost = new THREE.InstancedMesh(mergeUnitGeoms(sParts), poleMat, sportMasts.length);
    const sHead = new THREE.InstancedMesh(mergeUnitGeoms(lensParts), bulbMat, sportMasts.length);
    sPost.castShadow = true;

    sportMasts.forEach(([x, z], idx) => {
      const rot = z < 0 ? 0 : Math.PI;
      dummy.position.set(x, 0.36, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      sPost.setMatrixAt(idx, dummy.matrix);

      const hx = x + Math.sin(rot) * 0.12;
      const hy = 0.36 + 11.3;
      const hz = z + Math.cos(rot) * 0.12;
      dummy.position.set(hx, hy, hz);
      dummy.updateMatrix();
      sHead.setMatrixAt(idx, dummy.matrix);
      const delay = calcWaveDelay(x, z, 0.1);
      lightPools.push({ x, y: 0.525, z, size: 22, delay });
      lampHeads.push({ mesh: sHead, idx, x: hx, y: hy, z: hz, rot, delay, isDim: false });
    });
    scene.add(sPost, sHead);
  }

  // Helper pour lampadaires urbains à crosse aérodynamique (avenues principales & rues secondaires)
  const buildUrbanLuminaire = (list, h, armReach, hoodW, hoodL, rTop, rBot, yBase, matBulb, poolArr, poolY, poolSize, delayBase, isDimFlag) => {
    if (!list.length) return;
    const uParts = [];
    const plinth = new THREE.CylinderGeometry(rBot * 1.35, rBot * 1.65, 0.68, 10);
    plinth.translate(0, 0.34, 0);
    uParts.push(plinth);
    const mast = new THREE.CylinderGeometry(rTop, rBot, h, 10);
    mast.translate(0, h * 0.5, 0);
    uParts.push(mast);
    // Crosse inclinée vers +Z
    const armLen = Math.hypot(armReach, 0.44);
    const armSlope = new THREE.CylinderGeometry(rTop * 0.72, rTop * 0.92, armLen, 8);
    armSlope.rotateX(Math.atan2(armReach, 0.44));
    armSlope.translate(0, h + 0.18, armReach * 0.46);
    uParts.push(armSlope);
    // Tête profilée / capot LED sombre au bout de la crosse
    const hood = new THREE.BoxGeometry(hoodW, 0.12, hoodL);
    hood.translate(0, h + 0.42, armReach);
    uParts.push(hood);
    const hoodNose = new THREE.CylinderGeometry(0.06, 0.06, hoodW * 0.92, 8);
    hoodNose.rotateZ(Math.PI / 2);
    hoodNose.translate(0, h + 0.42, armReach + hoodL * 0.48);
    uParts.push(hoodNose);

    const uPost = new THREE.InstancedMesh(mergeUnitGeoms(uParts), poleMat, list.length);
    uPost.castShadow = true;
    const lensGeo = new THREE.BoxGeometry(hoodW * 0.78, 0.08, hoodL * 0.74);
    const uHead = new THREE.InstancedMesh(lensGeo, matBulb, list.length);

    list.forEach(([x, z, rot], idx) => {
      dummy.position.set(x, yBase, z);
      dummy.rotation.set(0, rot, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      uPost.setMatrixAt(idx, dummy.matrix);

      const hx = x + Math.sin(rot) * armReach;
      const hy = yBase + h + 0.35;
      const hz = z + Math.cos(rot) * armReach;
      dummy.position.set(hx, hy, hz);
      dummy.updateMatrix();
      uHead.setMatrixAt(idx, dummy.matrix);
      const delay = calcWaveDelay(x, z, delayBase);
      poolArr.push({ x, y: poolY, z, size: poolSize, delay });
      lampHeads.push({ mesh: uHead, idx, x: hx, y: hy, z: hz, rot, delay, isDim: isDimFlag });
    });
    scene.add(uPost, uHead);
  };

  // 4. Lampadaires d'avenues principales (9 m, grande crosse LED)
  buildUrbanLuminaire(roadPoles, 9.0, 0.96, 0.44, 1.12, 0.1, 0.18, 0.08, bulbMat, lightPools, 0.095, 17, 0.14, false);

  // 4b. Lampadaires de rues secondaires (6,6 m, crosse fine à faible luminosité)
  buildUrbanLuminaire(streetPoles, 6.6, 0.68, 0.34, 0.84, 0.08, 0.14, 0.08, dimBulbMat, dimLightPools, 0.092, 12.5, 0.22, true);

  // Halos lumineux directs sous les auvents des 2 Stations-service et la colonnade de la Banque
  [
    // Station-service Nord-Ouest (3 îlots de pompes + débord lumineux auvent + boutique + totem)
    [-243.5, 0.22, -58.5, 19.5],
    [-236.0, 0.22, -58.5, 21.5],
    [-228.5, 0.22, -58.5, 19.5],
    [-236.0, 0.22, -71.0, 16.5],
    [-255.0, 0.14, -46.0, 11.5],
    // Station-service Ouest (3 îlots de pompes + débord lumineux auvent + boutique + totem)
    [-293.4, 0.22, -6.5, 16.5],
    [-288.0, 0.22, -6.5, 18.5],
    [-282.6, 0.22, -6.5, 16.5],
    [-301.0, 0.22, -7.5, 15.0],
    [-274.0, 0.14, -12.5, 11.0],
    // Banque (colonnade Sud, entrée & façades latérales)
    [-127.4, 0.38, -63.5, 14.5],
    [-120.6, 0.38, -62.5, 17.5],
    [-113.8, 0.38, -63.5, 14.5],
    [-120.6, 0.38, -82.5, 13.0],
  ].forEach(([x, y, z, size]) => {
    lightPools.push({ x, y, z, size, delay: calcWaveDelay(x, z, 0.08) });
  });

  // Points lumineux architecturaux encastrés exactement sur les surfaces réelles des mobiliers (zéro lampe flottante)
  const furnitureLightPts = []; // { x, y, z, poolY, poolSize }
  const PAVILION_LIGHT_LOCAL = {
    slattedPergola: [
      [-1.12, 0.565, -0.78],
      [1.12, 0.565, -0.78],
      [-2.12, 0.145, 1.22],
      [2.12, 0.145, 1.22],
    ],
    oculusTreePergola: [
      [0.0, 0.545, -1.72],
      [-1.48, 0.545, -0.88],
      [1.48, 0.545, -0.88],
      [0.0, 0.525, 0.84],
    ],
    tensileSailDeck: [
      [-0.88, 0.525, -0.78],
      [0.78, 0.525, -1.06],
      [-1.06, 0.525, 0.72],
      [0.22, 0.465, 0.35],
    ],
    amphitheaterCanopy: [
      [-1.18, 0.485, 0.78],
      [1.18, 0.485, 0.78],
      [-1.18, 0.845, 0.0],
      [1.18, 0.845, 0.0],
    ],
    waveArchPavilion: [
      [-1.05, 0.545, -1.05],
      [1.05, 0.545, -1.05],
      [-1.05, 0.545, 1.05],
      [1.05, 0.545, 1.05],
    ],
    umbrellaKiosk: [
      [0.84, 0.525, 0.0],
      [-0.84, 0.525, 0.0],
      [0.0, 0.525, 0.84],
      [0.0, 0.525, -0.84],
    ],
  };

  const PLANTER_LIGHT_LOCAL = {
    oval: [
      [-1.08, 0.465, 0.84],
      [1.08, 0.465, 0.84],
      [-1.08, 0.465, -0.84],
      [1.08, 0.465, -0.84],
    ],
    serpentine: [
      [-2.5, 0.475, -0.88],
      [-0.84, 0.475, 0.92],
      [0.84, 0.475, -0.92],
      [2.5, 0.475, 0.88],
    ],
    xcross: [
      [0.9, 0.465, 0.9],
      [-0.9, 0.465, 0.9],
      [-0.9, 0.465, -0.9],
      [0.9, 0.465, -0.9],
    ],
    square: [
      [1.05, 0.465, 1.05],
      [-1.05, 0.465, 1.05],
      [-1.05, 0.465, -1.05],
      [1.05, 0.465, -1.05],
    ],
    curvedC: [
      [0.0, 0.475, -1.56],
      [1.1, 0.475, -1.1],
      [1.56, 0.475, 0.0],
      [1.1, 0.475, 1.1],
    ],
    hex: [
      [-1.25, 0.445, 0.0],
      [1.25, 0.485, 0.0],
      [0.62, 0.455, -1.08],
      [-0.62, 0.445, 1.08],
    ],
    linear: [
      [-1.85, 0.465, -0.45],
      [-1.85, 0.465, 0.45],
      [1.85, 0.465, -0.45],
      [1.85, 0.465, 0.45],
    ],
  };

  for (const item of furniturePlaced) {
    const { kind, x: fx, z: fz, baseY: fby = 0.35, rotY: frot = 0, isPavilion = false } = item;
    const scaleXZ = isPavilion ? 0.92 : 1.0;
    const localAnchors = isPavilion
      ? PAVILION_LIGHT_LOCAL[kind] || PAVILION_LIGHT_LOCAL.slattedPergola
      : PLANTER_LIGHT_LOCAL[kind] || PLANTER_LIGHT_LOCAL.square;
    const c = Math.cos(frot);
    const s = Math.sin(frot);
    for (const [lx0, ly, lz0] of localAnchors) {
      const lx = lx0 * scaleXZ;
      const lz = lz0 * scaleXZ;
      const wx = fx + lx * c + lz * s;
      const wz = fz - lx * s + lz * c;
      furnitureLightPts.push({
        x: wx,
        y: fby + ly,
        z: wz,
        poolY: fby + 0.025,
        poolSize: 2.1,
      });
    }
  }
  for (const [bx, bz, brot = 0] of benchSpots) {
    const cosR = Math.cos(brot);
    const sinR = Math.sin(brot);
    for (const side of [-0.88, 0.88]) {
      furnitureLightPts.push({
        x: bx + cosR * side,
        y: 0.35 + 0.445,
        z: bz - sinR * side,
        poolY: 0.372,
        poolSize: 1.85,
      });
    }
  }

  if (furnitureLightPts.length) {
    const fCollarGeo = new THREE.CylinderGeometry(0.085, 0.1, 0.026, 12);
    const fBulbGeo = new THREE.SphereGeometry(0.062, 10, 8);
    fBulbGeo.scale(1.0, 0.55, 1.0);
    const fCollarInst = new THREE.InstancedMesh(fCollarGeo, poleMat, furnitureLightPts.length);
    const fBulbInst = new THREE.InstancedMesh(fBulbGeo, bulbMat, furnitureLightPts.length);
    furnitureLightPts.forEach((fp, idx) => {
      dummy.position.set(fp.x, fp.y + 0.008, fp.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1, 1, 1);
      dummy.updateMatrix();
      fCollarInst.setMatrixAt(idx, dummy.matrix);

      dummy.position.set(fp.x, fp.y + 0.022, fp.z);
      dummy.updateMatrix();
      fBulbInst.setMatrixAt(idx, dummy.matrix);

      const delay = calcWaveDelay(fp.x, fp.z, 0.03);
      lightPools.push({
        x: fp.x,
        y: fp.poolY,
        z: fp.z,
        size: fp.poolSize,
        delay,
      });
      lampHeads.push({
        mesh: fBulbInst,
        idx,
        x: fp.x,
        y: fp.y + 0.022,
        z: fp.z,
        rot: 0,
        delay,
        isDim: false,
      });
    });
    scene.add(fCollarInst, fBulbInst);
  }

  // Lueur chaude rasante centrale sous les bancs-jardinières et pavillons en bois à travers le parc
  for (const [dx, dz, dr, dBaseY = 0.35] of excludeDisks) {
    lightPools.push({
      x: dx,
      y: dBaseY + 0.025,
      z: dz,
      size: dr * 2.4,
      delay: calcWaveDelay(dx, dz, 0.04),
    });
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

  const dimPoolMat = new THREE.MeshBasicMaterial({
    map: textures.lightPool,
    color: 0xffc67a,
    transparent: true,
    opacity: 0,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -3,
    polygonOffsetUnits: -3,
  });
  let dimPoolInst = null;
  if (dimLightPools.length) {
    dimPoolInst = new THREE.InstancedMesh(poolGeo, dimPoolMat, dimLightPools.length);
    dimPoolInst.visible = false;
    dimLightPools.forEach((p, idx) => {
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(p.size, 1, p.size);
      dummy.updateMatrix();
      dimPoolInst.setMatrixAt(idx, dummy.matrix);
    });
    scene.add(dimPoolInst);
  }

  // 6 PointLights couvrant l'ensemble du parc et du parking (toujours attachées pour éviter toute recompilation shader au clic Jour/Nuit)
  const lightSpecs = [
    [-200, 20, 0, 128],   // Pôle Sportif Ouest
    [-70, 18, -4, 112],   // Arts Martiaux & Piscines
    [0, 18, -2, 118],     // Entrée, Bassin central & Théâtre
    [85, 18, 2, 118],     // Aires de Jeux, Pétanque & Jardins
    [195, 18, 0, 112],    // Fontaine Est & Halle pique-nique
    [120, 18, -52, 132],  // Parking & Cantines
  ];

  const focalLights = lightSpecs.map(([x, y, z, dist]) => {
    const pl = new THREE.PointLight(0xffcb82, 0, dist, 1.0);
    pl.position.set(x, y, z);
    pl.userData.delay = Math.min(0.55, Math.abs(x) / 390);
    scene.add(pl);
    return pl;
  });

  // Bâtiments extérieurs (3m = 1 niveau, 6m = 2 niveaux, 9m = 3 niveaux + 1 porte éclairée sur chaque bâtiment),
  // kiosques et cantines éclairés la nuit
  const rng = makeSeeded(8812);
  const winPositions = [];
  const pushQuad = (x0, z0, x1, z1, yBot, yTop) => {
    winPositions.push(
      x0, yBot, z0,
      x1, yBot, z1,
      x1, yTop, z1,

      x0, yBot, z0,
      x1, yTop, z1,
      x0, yTop, z0
    );
  };

  const pushFacadeWindows = (poly, yBot, yTop, paneW, stepW, maxWallSkip = false, doorExclude = null) => {
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
        const wSpan = Math.min(paneW, len - margin - s);
        if (wSpan < 0.65) continue;
        if (
          doorExclude &&
          doorExclude.edgeIdx === i &&
          Math.abs(s + wSpan * 0.5 - doorExclude.sCenter) < doorExclude.clearHalf
        ) {
          continue;
        }
        if (maxWallSkip && usable > stepW && rng() < 0.18) continue;
        const x0 = a[0] + tx * s + ox;
        const z0 = a[1] + tz * s + oz;
        const x1 = a[0] + tx * (s + wSpan) + ox;
        const z1 = a[1] + tz * (s + wSpan) + oz;
        pushQuad(x0, z0, x1, z1, yBot, yTop);
      }
    }
  };

  const bldBaseY = 0.055;
  for (const b of data.buildings) {
    if (b.isContextSkip || !b.poly || b.poly.length < 3) continue;
    const levels = b.levels || (b.h < 5.2 ? 1 : b.h < 6.8 ? 2 : 3);

    // 1. Choisir la façade principale du bâtiment pour y placer une porte éclairée au RDC
    let bestEdgeIdx = -1;
    let bestLen = 0;
    for (let i = 0; i < b.poly.length; i++) {
      const pA = b.poly[i];
      const pB = b.poly[(i + 1) % b.poly.length];
      const l = Math.hypot(pB[0] - pA[0], pB[1] - pA[1]);
      if (l > bestLen) {
        bestLen = l;
        bestEdgeIdx = i;
      }
    }

    let doorExclude = null;
    if (bestEdgeIdx >= 0 && bestLen >= 1.5) {
      const pA = b.poly[bestEdgeIdx];
      const pB = b.poly[(bestEdgeIdx + 1) % b.poly.length];
      const dx = pB[0] - pA[0];
      const dz = pB[1] - pA[1];
      const tx = dx / bestLen;
      const tz = dz / bestLen;
      let nx = -tz;
      let nz = tx;
      const mx = (pA[0] + pB[0]) * 0.5;
      const mz = (pA[1] + pB[1]) * 0.5;
      if (pointInPoly2D([mx + nx * 0.12, mz + nz * 0.12], b.poly)) {
        nx = -nx;
        nz = -nz;
      }
      const ox = nx * 0.085;
      const oz = nz * 0.085;
      const doorW = Math.min(1.2, bestLen * 0.44);
      const sCenter = bestLen * 0.5;
      const s0 = sCenter - doorW * 0.5;
      const s1 = sCenter + doorW * 0.5;
      pushQuad(
        pA[0] + tx * s0 + ox,
        pA[1] + tz * s0 + oz,
        pA[0] + tx * s1 + ox,
        pA[1] + tz * s1 + oz,
        bldBaseY + 0.05,
        bldBaseY + 2.15
      );
      doorExclude = { edgeIdx: bestEdgeIdx, sCenter, clearHalf: doorW * 0.5 + 0.85 };
    }

    // 2. Fenêtres par niveau : 1 niveau (3 m), 2 niveaux (6 m) ou 3 niveaux (9 m)
    for (let lv = 0; lv < levels; lv++) {
      const floorBase = bldBaseY + lv * 3.0;
      const yBot = floorBase + 1.15;
      const yTop = floorBase + 2.10;
      pushFacadeWindows(b.poly, yBot, yTop, 1.28, 2.7, true, lv === 0 ? doorExclude : null);
    }
  }
  for (const c of data.parkingDetails?.cantines || []) {
    if (rng() > 0.68) continue;
    pushFacadeWindows(c, 1.35, 2.05, 1.4, 2.2, false);
  }
  for (const z of data.zones) {
    if (z.kind !== "building") continue;
    pushFacadeWindows(z.poly, 1.45, 2.35, 1.3, 2.2, false);
  }

  // Fenêtres architecturales sur les façades de la Banque (3 niveaux Est/Ouest/Nord) et des boutiques des 2 Stations-service
  const bankPoly = [
    [-129.85, -81.35],
    [-111.35, -81.35],
    [-111.35, -64.85],
    [-129.85, -64.85],
  ];
  for (let lv = 0; lv < 3; lv++) {
    const floorBase = 0.36 + lv * 2.8;
    // Ignorer la façade Sud (edgeIdx === 2) qui possède déjà sa grande verrière et son portique
    pushFacadeWindows(bankPoly, floorBase + 0.9, floorBase + 1.85, 1.4, 2.8, false, {
      edgeIdx: 2,
      sCenter: 9.25,
      clearHalf: 12.0,
    });
  }
  // Boutiques des 2 Stations-service (façades arrière et latérales)
  pushFacadeWindows(
    [
      [-246.0, -82.75],
      [-226.0, -82.75],
      [-226.0, -73.25],
      [-246.0, -73.25],
    ],
    1.35,
    2.35,
    1.45,
    2.9,
    false
  );
  pushFacadeWindows(
    [
      [-314.0, -11.6],
      [-302.0, -11.6],
      [-302.0, -3.4],
      [-314.0, -3.4],
    ],
    1.35,
    2.35,
    1.35,
    2.6,
    false
  );

  const dayWinCol = new THREE.Color(0x7c7367);
  const nightWinCol = new THREE.Color(0xffd28a);
  const winMat = new THREE.MeshBasicMaterial({
    color: dayWinCol.clone(),
    transparent: true,
    opacity: 0.74,
    side: THREE.DoubleSide,
  });
  let winMesh = null;
  if (winPositions.length) {
    const winGeo = new THREE.BufferGeometry();
    winGeo.setAttribute("position", new THREE.Float32BufferAttribute(winPositions, 3));
    winGeo.computeVertexNormals();
    winMesh = new THREE.Mesh(winGeo, winMat);
    winMesh.visible = true;
    scene.add(winMesh);
  }

  const headMeshes = new Set(lampHeads.map((h) => h.mesh));
  for (let i = 0; i < lampHeads.length; i++) {
    const h = lampHeads[i];
    h.mesh.setColorAt(h.idx, dayBulbCol);
  }
  headMeshes.forEach((m) => {
    if (m.instanceColor) m.instanceColor.needsUpdate = true;
  });
  let lastWaveF = -1;

  return {
    applyNightFactor(f, now = 0) {
      const isNightActive = f > 0.002;
      if (poolInst.visible !== isNightActive) poolInst.visible = isNightActive;
      if (dimPoolInst && dimPoolInst.visible !== isNightActive) dimPoolInst.visible = isNightActive;
      const pulse = 0.96 + 0.04 * Math.sin(now * 0.0018);
      const winPulse = 0.97 + 0.03 * Math.sin(now * 0.0012 + 1.1);

      // Animation en vague progressive des lampadaires, bornes et halos lors du passage Jour <-> Nuit
      if (Math.abs(f - lastWaveF) > 0.0005) {
        lastWaveF = f;
        for (let i = 0; i < lightPools.length; i++) {
          const p = lightPools[i];
          const span = Math.max(0.26, 1 - p.delay);
          const lf = THREE.MathUtils.clamp((f - p.delay) / span, 0, 1);
          const sCurve = lf * lf * (3 - 2 * lf);
          const bloom = sCurve + Math.sin(lf * Math.PI) * 0.24 * lf;
          const sc = Math.max(0.001, p.size * bloom);
          dummy.position.set(p.x, p.y, p.z);
          dummy.rotation.set(0, 0, 0);
          dummy.scale.set(sc, 1, sc);
          dummy.updateMatrix();
          poolInst.setMatrixAt(i, dummy.matrix);
        }
        poolInst.instanceMatrix.needsUpdate = true;

        if (dimPoolInst) {
          for (let i = 0; i < dimLightPools.length; i++) {
            const p = dimLightPools[i];
            const span = Math.max(0.24, 1 - p.delay);
            const lf = THREE.MathUtils.clamp((f - p.delay) / span, 0, 1);
            const sCurve = lf * lf * (3 - 2 * lf);
            const bloom = sCurve + Math.sin(lf * Math.PI) * 0.2 * lf;
            const sc = Math.max(0.001, p.size * bloom);
            dummy.position.set(p.x, p.y, p.z);
            dummy.rotation.set(0, 0, 0);
            dummy.scale.set(sc, 1, sc);
            dummy.updateMatrix();
            dimPoolInst.setMatrixAt(i, dummy.matrix);
          }
          dimPoolInst.instanceMatrix.needsUpdate = true;
        }

        // Allumage/extinction individuel en vague de chaque tête de lampe (couleur + pulsation)
        for (let i = 0; i < lampHeads.length; i++) {
          const h = lampHeads[i];
          const span = Math.max(0.26, 1 - h.delay);
          const lf = THREE.MathUtils.clamp((f - h.delay) / span, 0, 1);
          const sCurve = lf * lf * (3 - 2 * lf);
          const pop = 1 + Math.sin(lf * Math.PI) * 0.26;
          dummy.position.set(h.x, h.y, h.z);
          dummy.rotation.set(0, h.rot || 0, 0);
          dummy.scale.set(pop, pop, pop);
          dummy.updateMatrix();
          h.mesh.setMatrixAt(h.idx, dummy.matrix);

          // Tant que l'onde n'a pas atteint la lampe, elle s'assombrit avec le crépuscule puis s'allume franchement au passage de l'onde
          _tmpBulbCol.lerpColors(dayBulbCol, darkBulbCol, Math.min(1, f * 1.4));
          _tmpBulbCol.lerp(h.isDim ? litDimBulbCol : litBulbCol, sCurve);
          h.mesh.setColorAt(h.idx, _tmpBulbCol);
        }
        headMeshes.forEach((m) => {
          m.instanceMatrix.needsUpdate = true;
          if (m.instanceColor) m.instanceColor.needsUpdate = true;
        });
      }

      poolMat.opacity = isNightActive ? Math.min(1, f * 1.35) * 0.62 * pulse : 0;
      dimPoolMat.opacity = isNightActive ? Math.min(1, f * 1.25) * 0.22 * pulse : 0;

      // Allumage progressif des arches LED torsadées du bassin central
      for (let i = 0; i < archLedEntries.length; i++) {
        const entry = archLedEntries[i];
        const span = Math.max(0.24, 1 - entry.delay);
        const lf = THREE.MathUtils.clamp((f - entry.delay) / span, 0, 1);
        const sCurve = lf * lf * (3 - 2 * lf);
        entry.mat.color.lerpColors(archDayLedCol, archDarkLedCol, Math.min(1, f * 1.35));
        entry.mat.color.lerp(archLitLedCol, sCurve);
      }

      // Allumage progressif des portes et fenêtres des bâtiments
      const winF = THREE.MathUtils.smoothstep(f, 0.15, 0.96);
      winMat.color.lerpColors(dayWinCol, nightWinCol, winF);
      winMat.opacity = THREE.MathUtils.lerp(0.74, 0.86 * winPulse, winF);

      for (const pl of focalLights) {
        const d = pl.userData.delay || 0;
        const lf = THREE.MathUtils.clamp((f - d) / Math.max(0.3, 1 - d), 0, 1);
        const sCurve = lf * lf * (3 - 2 * lf);
        pl.intensity = isNightActive ? sCurve * 68 * pulse : 0;
      }
    },
  };
}
