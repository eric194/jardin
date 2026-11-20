import * as THREE from "three";
import { OrbitControls } from "./assets/vendor/OrbitControls.js";
import {
  createThiesMapTexture,
  createGrassTexture,
  createStonePavingTexture,
  createRoadTexture,
  createSportTexture,
  createCantineTexture,
  createWaterNormalTexture,
  createSandTexture,
  createLightPoolTexture,
  createCloudTexture,
} from "./js/textures.js";
import {
  buildThiesBackdrop,
  buildSportCourts,
  buildWaterAndFountains,
  buildVegetation,
  buildDayAtmosphere,
} from "./js/environment.js";
import {
  VEHICLE_TYPES,
  buildParkedCars,
  buildBenches,
  buildMovingTraffic,
  buildPedestrians,
  buildLightingNetwork,
} from "./js/living.js";
import { createDossierController } from "./js/dossier.js";

function getOverviewCam() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (aspect < 0.85) {
    return { pos: [18, 178, 268], target: [0, 0, -6] };
  }
  return { pos: [30, 126, 182], target: [0, 0, -5] };
}

function getPlanCam() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (aspect < 0.85) {
    return { pos: [0, 440, 8], target: [0, 0, -6] };
  }
  return { pos: [0, 295, 5], target: [0, 0, -5] };
}

function getIntroCam() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (aspect < 0.85) {
    return { pos: [0, 290, 185], target: [0, 0, -6] };
  }
  return { pos: [0, 225, 128], target: [0, 0, -6] };
}

function getSatStartCam() {
  const aspect = window.innerWidth / Math.max(1, window.innerHeight);
  if (aspect < 0.85) {
    return { pos: [0, 20500, 1900], target: [0, 0, 0] };
  }
  return { pos: [0, 13200, 1400], target: [0, 0, 0] };
}

function loadTexture(url) {
  return new Promise((resolve) => {
    const loader = new THREE.TextureLoader();
    loader.load(
      url,
      (tex) => {
        tex.colorSpace = THREE.SRGBColorSpace;
        tex.anisotropy = 4;
        resolve(tex);
      },
      undefined,
      () => resolve(null)
    );
  });
}

const state = {
  data: null,
  isIntro: true,
  satDone: false,
  satZoom: null,
  introOrbitStart: null,
  isPlanView: false,
  isNight: false,
  nightFactor: 0,
  targetNight: 0,
  selectedSpaceId: null,
  hoveredSpaceId: null,
  hasInteracted: false,
  guideOpen: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  fly: null,
  pointerDownPos: null,
  pointerWorld: new THREE.Vector2(),
  keysDown: new Set(),
  navVel: new THREE.Vector2(),
  stats: { trees: 0, benches: 0 },
};

const dom = {};
const windUniforms = {
  uWindTime: { value: 0 },
  uWindStrength: { value: 1.0 },
};

function cacheDom() {
  dom.canvas = document.getElementById("scene-canvas");
  dom.cursorRing = document.getElementById("cursor-ring");
  dom.spaceLabels = document.getElementById("space-labels");
  dom.satBanner = document.getElementById("sat-banner");
  dom.satAltitude = document.getElementById("sat-altitude");
  dom.intro = document.getElementById("intro");
  dom.btnExplore = document.getElementById("btn-explore");
  dom.btnIntroDay = document.getElementById("btn-intro-day");
  dom.btnIntroNight = document.getElementById("btn-intro-night");
  dom.header = document.getElementById("site-header");
  dom.btnDevis = document.getElementById("btn-devis");
  dom.btnTheme = document.getElementById("btn-theme");
  dom.btnViewMode = document.getElementById("btn-view-mode");
  dom.btnReset = document.getElementById("btn-reset");
  dom.btnGuide = document.getElementById("btn-guide");
  dom.navGuide = document.getElementById("nav-guide");
  dom.btnCloseGuide = document.getElementById("btn-close-guide");
  dom.btnMenu = document.getElementById("btn-menu");
  dom.gestureHint = document.getElementById("gesture-hint");
  dom.spaceCard = document.getElementById("space-card");
  dom.cardIndex = document.getElementById("card-index");
  dom.cardCategory = document.getElementById("card-category");
  dom.cardTitle = document.getElementById("card-title");
  dom.cardMetric = document.getElementById("card-metric");
  dom.cardSummary = document.getElementById("card-summary");
  dom.cardHighlights = document.getElementById("card-highlights");
  dom.cardLot = document.getElementById("card-lot");
  dom.btnCloseCard = document.getElementById("btn-close-card");
  dom.btnBackToMap = document.getElementById("btn-back-to-map");
  dom.btnSpaceMore = document.getElementById("btn-space-more");
  dom.btnPrevSpace = document.getElementById("btn-prev-space");
  dom.btnNextSpace = document.getElementById("btn-next-space");
  dom.menuOverlay = document.getElementById("menu-overlay");
  dom.btnCloseMenu = document.getElementById("btn-close-menu");
  dom.btnMenuDevis = document.getElementById("btn-menu-devis");
  dom.menuList = document.getElementById("menu-spaces-list");
  dom.spacePageModal = document.getElementById("space-page");
  dom.devisModal = document.getElementById("devis-modal");
  dom.distanceHud = document.getElementById("distance-hud");
  dom.scaleBarLine = document.getElementById("scale-bar-line");
  dom.scaleBarLabel = document.getElementById("scale-bar-label");
  dom.distanceReadout = document.getElementById("distance-readout");
  dom.compassSvg = document.getElementById("compass-svg");
}

function signedArea2D(pts) {
  let sum = 0;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    sum += a[0] * b[1] - b[0] * a[1];
  }
  return sum * 0.5;
}

function makeShapeFromScenePoly(poly, holes = []) {
  const outer = poly.map(([x, z]) => [x, -z]);
  if (signedArea2D(outer) < 0) outer.reverse();

  const shape = new THREE.Shape();
  outer.forEach(([x, y], idx) => {
    if (idx === 0) shape.moveTo(x, y);
    else shape.lineTo(x, y);
  });
  shape.closePath();

  holes.forEach((hPoly) => {
    if (!hPoly || hPoly.length < 3) return;
    const holePts = hPoly.map(([x, z]) => [x, -z]);
    if (signedArea2D(holePts) > 0) holePts.reverse();
    const path = new THREE.Path();
    holePts.forEach(([x, y], idx) => {
      if (idx === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
    path.closePath();
    shape.holes.push(path);
  });

  return shape;
}

function extrudePoly(poly, depth, baseY, holes = []) {
  const shape = makeShapeFromScenePoly(poly, holes);
  const geom = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: false,
    curveSegments: 6,
  });
  geom.rotateX(-Math.PI / 2);
  if (baseY !== 0) {
    geom.translate(0, baseY, 0);
  }
  return geom;
}

function mergeGeometries(geoms) {
  if (!geoms.length) return null;
  const nonIndexed = geoms.map((g) => (g.index ? g.toNonIndexed() : g));
  let totalVerts = 0;
  for (const g of nonIndexed) {
    totalVerts += g.attributes.position.count;
  }

  const posArr = new Float32Array(totalVerts * 3);
  const normArr = new Float32Array(totalVerts * 3);
  const uvArr = new Float32Array(totalVerts * 2);
  let offset = 0;

  for (const g of nonIndexed) {
    if (!g.attributes.normal) g.computeVertexNormals();
    const count = g.attributes.position.count;
    posArr.set(g.attributes.position.array, offset * 3);
    normArr.set(g.attributes.normal.array, offset * 3);
    if (g.attributes.uv) {
      uvArr.set(g.attributes.uv.array, offset * 2);
    }
    offset += count;
    g.dispose();
  }

  const merged = new THREE.BufferGeometry();
  merged.setAttribute("position", new THREE.BufferAttribute(posArr, 3));
  merged.setAttribute("normal", new THREE.BufferAttribute(normArr, 3));
  merged.setAttribute("uv", new THREE.BufferAttribute(uvArr, 2));
  return merged;
}

function easeInOutCubic(t) {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

function easeInOutQuart(t) {
  return t < 0.5 ? 8 * t * t * t * t : 1 - Math.pow(-2 * t + 2, 4) / 2;
}

function easeInOutQuint(t) {
  return t < 0.5 ? 16 * t * t * t * t * t : 1 - Math.pow(-2 * t + 2, 5) / 2;
}

function easeOutExpo(t) {
  return t >= 1 ? 1 : 1 - Math.pow(2, -10 * t);
}

let renderer;
let scene;
let camera;
let controls;
let thiesBackdrop;
let waterCtrl;
let trafficCtrl;
let pedestrianCtrl;
let lightingCtrl;
let atmosphereCtrl;
let dossierCtrl;

const raycaster = new THREE.Raycaster();
const markerGroups = [];
const hitProxies = [];
const clickableZones = [];
const labelButtons = new Map();
const themeTargets = {};
let groundMesh;

function buildScene(data, thiesMapTex) {
  const isMobile =
    window.innerWidth <= 768 || window.matchMedia("(pointer: coarse)").matches;

  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    powerPreference: "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.5 : 2));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.03;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const maxAniso = Math.min(8, renderer.capabilities.getMaxAnisotropy() || 4);

  const textures = {
    senegal: thiesMapTex || createThiesMapTexture(),
    grass: createGrassTexture(maxAniso),
    paving: createStonePavingTexture(maxAniso),
    road: createRoadTexture(maxAniso),
    sport: createSportTexture(maxAniso),
    cantine: createCantineTexture(maxAniso),
    water: createWaterNormalTexture(maxAniso),
    sand: createSandTexture(maxAniso),
    lightPool: createLightPoolTexture(),
    cloud: createCloudTexture(),
  };

  scene = new THREE.Scene();
  scene.background = new THREE.Color(0xf8f6f2);
  scene.fog = new THREE.Fog(0xf8f6f2, 380, 1200);

  const introCam = getIntroCam();
  const satCam = getSatStartCam();
  const startCam = state.reducedMotion ? introCam : satCam;

  camera = new THREE.PerspectiveCamera(
    40,
    window.innerWidth / window.innerHeight,
    1,
    36000
  );
  camera.position.set(...startCam.pos);

  controls = new OrbitControls(camera, dom.canvas);
  controls.target.set(...startCam.target);
  controls.enableDamping = true;
  controls.dampingFactor = 0.06;
  controls.screenSpacePanning = false;
  controls.zoomToCursor = true;
  controls.zoomSpeed = 2.0;
  controls.panSpeed = 1.65;
  controls.rotateSpeed = isMobile ? 0.78 : 0.9;
  controls.minDistance = 16;
  controls.maxDistance = 680;
  controls.minPolarAngle = 0.04;
  controls.maxPolarAngle = Math.PI * 0.44;
  controls.enabled = false;

  // Lumières jour / nuit
  const hemi = new THREE.HemisphereLight(0xffffff, 0xe8dfd0, 1.08);
  scene.add(hemi);

  const shadowSize = isMobile ? 1024 : 2048;
  const sun = new THREE.DirectionalLight(0xfffaf2, 1.15);
  sun.position.set(160, 250, 130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -330;
  sun.shadow.camera.right = 330;
  sun.shadow.camera.top = 210;
  sun.shadow.camera.bottom = -210;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 680;
  sun.shadow.bias = -0.00045;
  sun.shadow.radius = 3;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xf6efe4, 0.28);
  fill.position.set(-180, 140, -160);
  scene.add(fill);

  // Plan macro carte vectorielle de la Région de Thiès (centré sur 0, 0)
  thiesBackdrop = buildThiesBackdrop(scene, textures);

  // Plan de sol local
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xfaf8f3,
    roughness: 0.96,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  groundMesh = new THREE.Mesh(new THREE.PlaneGeometry(2400, 2400), groundMat);
  groundMesh.rotation.x = -Math.PI / 2;
  groundMesh.position.y = -0.05;
  groundMesh.receiveShadow = true;
  scene.add(groundMesh);

  // 1. Voiries DXF (top 0.050)
  let roadMat;
  if (data.roads && data.roads.length) {
    try {
      const roadGeom = extrudePoly(data.roads[0], 0.05, 0.0, data.roads.slice(1));
      roadMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.road,
        roughness: 0.95,
        metalness: 0,
      });
      const roadMesh = new THREE.Mesh(roadGeom, roadMat);
      roadMesh.receiveShadow = true;
      scene.add(roadMesh);
    } catch (err) {
      console.warn("Road extrusion fallback:", err);
    }
  }

  // 2. 352 immeubles voisins de Thiès (base strictement > top routes)
  const buildingGeoms = [];
  for (const b of data.buildings) {
    try {
      buildingGeoms.push(extrudePoly(b.poly, b.h, 0.055));
    } catch (_) {}
  }
  let buildingMat;
  let buildingEdgesMat;
  const mergedBuildings = mergeGeometries(buildingGeoms);
  if (mergedBuildings) {
    buildingMat = new THREE.MeshStandardMaterial({
      color: 0xffffff,
      roughness: 0.92,
      metalness: 0,
    });
    const bMesh = new THREE.Mesh(mergedBuildings, buildingMat);
    bMesh.castShadow = true;
    bMesh.receiveShadow = true;
    scene.add(bMesh);

    buildingEdgesMat = new THREE.LineBasicMaterial({
      color: 0xe3dcd0,
      transparent: true,
      opacity: 0.65,
    });
    scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(mergedBuildings, 28), buildingEdgesMat));
  }

  // 3. Socle du parc linéaire (500 x 50 m, top 0.300)
  const parkMat = new THREE.MeshStandardMaterial({
    color: 0xf2ebe0,
    roughness: 0.92,
    metalness: 0,
  });
  const parkSlab = extrudePoly(
    [
      [-250, -25],
      [250, -25],
      [250, 25],
      [-250, 25],
    ],
    0.245,
    0.055
  );
  const parkSlabMesh = new THREE.Mesh(parkSlab, parkMat);
  parkSlabMesh.receiveShadow = true;
  parkSlabMesh.castShadow = true;
  scene.add(parkSlabMesh);

  // 4. Zones du DXF (strates Y strictement séparées : aucune face coplanaire)
  const kindStyle = {
    parkingZone: { color: 0xebe3d5, map: textures.road, y: 0.06, depth: 0.23 },   // top 0.290
    paving: { color: 0xffffff, map: textures.paving, y: 0.305, depth: 0.045 },   // top 0.350
    track: { color: 0xc67360, map: textures.sport, y: 0.31, depth: 0.07 },       // top 0.380
    play: { color: 0xeaddcb, map: textures.paving, y: 0.315, depth: 0.085 },     // top 0.400
    sand: { color: 0xf4e4c1, map: textures.sand, y: 0.32, depth: 0.095 },        // top 0.415
    sport: { color: 0xf7efe4, map: textures.sport, y: 0.325, depth: 0.1 },       // top 0.425
    green: { color: 0xffffff, map: textures.grass, y: 0.33, depth: 0.125 },      // top 0.455
    gradin: { color: 0xe3dad0, map: null, y: 0.335, depth: 0.92 },               // top 1.255
  };

  const playZones = data.zones.filter((item) => item.kind === "play");
  const mergedByKind = {};
  const kioskGeoms = [];
  const kindMaterials = {};

  for (const z of data.zones) {
    try {
      if (z.kind === "water") continue;
      if (z.kind === "building") {
        kioskGeoms.push(extrudePoly(z.poly, 3.05, 0.355));
        continue;
      }
      // Ignorer tout doublon géométrique exact sport/play (ex. Pétanque / Jeux Enfants 716,1 m²)
      if (
        z.kind === "sport" &&
        playZones.some(
          (pz) =>
            Math.hypot(pz.centroid[0] - z.centroid[0], pz.centroid[1] - z.centroid[1]) < 0.25 &&
            Math.abs(pz.area - z.area) < 1.0
        )
      ) {
        continue;
      }
      // Ignorer les micro-zones paving AIR DE REPOS chevauchées par AIRE DE DEGAGEMENT
      if (z.kind === "paving" && z.area < 25 && z.name.toUpperCase().includes("AIR DE REPOS")) {
        continue;
      }

      const zu = z.name.toUpperCase();
      const effectiveKind = zu.includes("BEACH") || zu.includes("SABLE") ? "sand" : z.kind;
      const st = kindStyle[effectiveKind] || kindStyle.paving;
      const g = extrudePoly(z.poly, st.depth, st.y, z.holes || []);
      if (!mergedByKind[effectiveKind]) mergedByKind[effectiveKind] = [];
      mergedByKind[effectiveKind].push(g);
    } catch (_) {}
  }

  for (const [kind, geoms] of Object.entries(mergedByKind)) {
    const merged = mergeGeometries(geoms);
    if (!merged) continue;
    const st = kindStyle[kind] || kindStyle.paving;
    const mat = new THREE.MeshStandardMaterial({
      color: st.color,
      map: st.map || null,
      roughness: 0.92,
      metalness: 0,
    });
    kindMaterials[kind] = mat;
    const mesh = new THREE.Mesh(merged, mat);
    mesh.receiveShadow = true;
    mesh.castShadow = kind === "gradin";
    scene.add(mesh);
  }

  // Kiosques, accueil, sanitaires
  const mergedKiosks = mergeGeometries(kioskGeoms);
  let kioskMat;
  if (mergedKiosks) {
    kioskMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.88 });
    const kMesh = new THREE.Mesh(mergedKiosks, kioskMat);
    kMesh.castShadow = true;
    kMesh.receiveShadow = true;
    scene.add(kMesh);
  }

  // 5. Toitures (Toit_1..7) + colonnes d'entrée
  const roofGeoms = [];
  for (const rf of data.roofs || []) {
    try {
      roofGeoms.push(extrudePoly(rf.poly, 0.34, 3.4));
    } catch (_) {}
  }
  const mergedRoofs = mergeGeometries(roofGeoms);
  let roofMat;
  if (mergedRoofs) {
    roofMat = new THREE.MeshStandardMaterial({ color: 0xe6dccd, roughness: 0.85 });
    const rMesh = new THREE.Mesh(mergedRoofs, roofMat);
    rMesh.castShadow = true;
    rMesh.receiveShadow = true;
    scene.add(rMesh);
  }

  const canopyCols = [
    [-13.5, -18.5],
    [-7.5, -15.2],
    [7.5, -15.2],
    [13.5, -18.5],
  ];
  const colMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.85 });
  const colGeo = new THREE.CylinderGeometry(0.18, 0.18, 3.1, 10);
  for (const [cx, cz] of canopyCols) {
    const col = new THREE.Mesh(colGeo, colMat);
    col.position.set(cx, 1.9, cz);
    col.castShadow = true;
    scene.add(col);
  }

  // 6. Parking Nord : stalles (192), îlots plantés (16), cantines en conteneurs (47)
  let cantineMat;
  if (data.parkingDetails) {
    const { stalls, cantines, medians } = data.parkingDetails;
    const cantineGeoms = [];
    for (const c of cantines) {
      try {
        cantineGeoms.push(extrudePoly(c, 2.75, 0.295));
      } catch (_) {}
    }
    const mergedCantines = mergeGeometries(cantineGeoms);
    if (mergedCantines) {
      cantineMat = new THREE.MeshStandardMaterial({
        color: 0xffffff,
        map: textures.cantine,
        roughness: 0.88,
      });
      const cMesh = new THREE.Mesh(mergedCantines, cantineMat);
      cMesh.castShadow = true;
      cMesh.receiveShadow = true;
      scene.add(cMesh);

      const cEdges = new THREE.LineSegments(
        new THREE.EdgesGeometry(mergedCantines, 24),
        new THREE.LineBasicMaterial({ color: 0xbcae98, transparent: true, opacity: 0.78 })
      );
      scene.add(cEdges);
    }

    const medianGeoms = [];
    for (const m of medians) {
      try {
        medianGeoms.push(extrudePoly(m, 0.145, 0.295));
      } catch (_) {}
    }
    const mergedMedians = mergeGeometries(medianGeoms);
    if (mergedMedians) {
      const mMesh = new THREE.Mesh(
        mergedMedians,
        new THREE.MeshStandardMaterial({ color: 0xbdcab0, roughness: 0.92 })
      );
      mMesh.receiveShadow = true;
      scene.add(mMesh);
    }

    const stallPts = [];
    for (const s of stalls) {
      for (let i = 0; i < s.length; i++) {
        const a = s[i];
        const b = s[(i + 1) % s.length];
        stallPts.push(a[0], 0.304, a[1], b[0], 0.304, b[1]);
      }
    }
    if (stallPts.length) {
      const stallGeom = new THREE.BufferGeometry();
      stallGeom.setAttribute("position", new THREE.Float32BufferAttribute(stallPts, 3));
      scene.add(
        new THREE.LineSegments(
          stallGeom,
          new THREE.LineBasicMaterial({ color: 0xc9c0b2, transparent: true, opacity: 0.72 })
        )
      );
    }
  }

  // 7. Poteaux de clôture (339)
  if (data.posts && data.posts.length) {
    const postGeo = new THREE.BoxGeometry(0.24, 1.85, 0.24);
    const postMat = new THREE.MeshStandardMaterial({ color: 0xd8cfc2, roughness: 0.88 });
    const postInst = new THREE.InstancedMesh(postGeo, postMat, data.posts.length);
    const dummy = new THREE.Object3D();
    data.posts.forEach(([px, pz], idx) => {
      dummy.position.set(px, 1.15, pz);
      dummy.updateMatrix();
      postInst.setMatrixAt(idx, dummy.matrix);
    });
    postInst.castShadow = true;
    scene.add(postInst);
  }

  // 8. Tracés sportifs 3D visibles, Eau + Jets animés, Arbres périphériques & intérieurs avec vent
  buildSportCourts(scene, data);
  waterCtrl = buildWaterAndFountains(scene, data, textures, extrudePoly, mergeGeometries);
  const vegStats = buildVegetation(scene, data, textures, windUniforms);
  state.stats.trees = vegStats?.treeCount || 0;

  // 9. Vie du jardin : voitures garées, bancs alignés, trafic, piétons, éclairage & fenêtres nuit
  buildParkedCars(scene, data);
  const benchStats = buildBenches(scene, data);
  state.stats.benches = benchStats?.benchCount || 0;
  trafficCtrl = buildMovingTraffic(scene, textures);
  pedestrianCtrl = buildPedestrians(scene);
  lightingCtrl = buildLightingNetwork(scene, data, textures);

  // 10. Zones cliquables + 12 repères terracotta
  for (const sp of data.spaces) {
    const pad = new THREE.Mesh(
      new THREE.CylinderGeometry(16, 16, 1.6, 16),
      new THREE.MeshBasicMaterial({ visible: false })
    );
    pad.position.set(sp.pos[0], 0.9, sp.pos[1]);
    pad.userData.spaceId = sp.id;
    scene.add(pad);
    clickableZones.push(pad);
  }

  buildSpaceMarkers(data.spaces, isMobile);

  // 11. Nuages subtils, papillons et oiseaux diurnes
  atmosphereCtrl = buildDayAtmosphere(scene, textures);

  // Références thème Jour/Nuit
  Object.assign(themeTargets, {
    hemi,
    sun,
    fill,
    groundMat,
    roadMat,
    buildingMat,
    buildingEdgesMat,
    parkMat,
    kioskMat,
    roofMat,
    cantineMat,
    kindMaterials,
  });

  if (!state.reducedMotion) {
    state.satZoom = {
      startTime: null,
      warmed: false,
      holdMs: 1350,
      duration: 3500,
      fromPos: new THREE.Vector3(...satCam.pos),
      fromTarget: new THREE.Vector3(...satCam.target),
      toPos: new THREE.Vector3(...introCam.pos),
      toTarget: new THREE.Vector3(...introCam.target),
    };
  } else {
    finishSatelliteIntro();
  }
}

function buildSpaceMarkers(spaces, isMobile = false) {
  const discGeo = new THREE.CylinderGeometry(2.35, 2.35, 0.42, 32);
  discGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(2.45, 0.14, 8, 32);
  const stemGeo = new THREE.CylinderGeometry(0.08, 0.08, 6.4, 6);
  const baseDotGeo = new THREE.CircleGeometry(0.8, 16);
  baseDotGeo.rotateX(-Math.PI / 2);
  const pulseGeo = new THREE.RingGeometry(1.15, 1.48, 28);
  pulseGeo.rotateX(-Math.PI / 2);
  const hitGeo = new THREE.SphereGeometry(isMobile ? 9.6 : 8.4, 12, 12);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });

  spaces.forEach((sp, idx) => {
    const group = new THREE.Group();
    group.position.set(sp.pos[0], 0.44, sp.pos[1]);
    group.userData = { spaceId: sp.id, phase: idx * 0.55 };

    const discMat = new THREE.MeshStandardMaterial({
      color: 0xa64234,
      emissive: 0x3b120c,
      emissiveIntensity: 0.35,
      roughness: 0.48,
      metalness: 0.04,
    });
    const disc = new THREE.Mesh(discGeo, discMat);
    disc.position.y = 7.2;
    disc.castShadow = true;

    const ring = new THREE.Mesh(ringGeo, new THREE.MeshBasicMaterial({ color: 0xffffff }));
    disc.add(ring);

    const stem = new THREE.Mesh(
      stemGeo,
      new THREE.MeshBasicMaterial({ color: 0x8f887d, transparent: true, opacity: 0.55 })
    );
    stem.position.y = 3.4;

    const baseDot = new THREE.Mesh(baseDotGeo, new THREE.MeshBasicMaterial({ color: 0xa64234 }));
    baseDot.position.y = 0.08;

    const pulseMat = new THREE.MeshBasicMaterial({
      color: 0xa64234,
      transparent: true,
      opacity: 0.35,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const pulseRing = new THREE.Mesh(pulseGeo, pulseMat);
    pulseRing.position.y = 0.1;

    const hitProxy = new THREE.Mesh(hitGeo, hitMat);
    hitProxy.position.y = 6.6;
    hitProxy.userData = { spaceId: sp.id, markerGroup: group };

    group.add(disc, stem, baseDot, pulseRing, hitProxy);
    group.userData.disc = disc;
    group.userData.discMat = discMat;
    group.userData.pulseRing = pulseRing;
    group.userData.pulseMat = pulseMat;

    scene.add(group);
    markerGroups.push(group);
    hitProxies.push(hitProxy);
  });
}

function buildSpaceLabels(spaces) {
  dom.spaceLabels.innerHTML = "";
  labelButtons.clear();

  for (const sp of spaces) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "space-label";
    btn.dataset.spaceId = sp.id;
    btn.textContent = sp.title;
    btn.setAttribute("aria-label", `${sp.index} — ${sp.title}`);
    dom.spaceLabels.appendChild(btn);
    labelButtons.set(sp.id, btn);
  }
}

function finishSatelliteIntro() {
  state.satDone = true;
  state.satZoom = null;
  state.introOrbitStart = performance.now();
  if (dom.satBanner) dom.satBanner.classList.remove("is-visible");
  if (state.isIntro) {
    dom.intro.classList.add("is-visible");
  }
}

function flyTo(toPos, toTarget, duration = 1150) {
  if (state.reducedMotion) {
    camera.position.set(...toPos);
    controls.target.set(...toTarget);
    controls.update();
    state.fly = null;
    return;
  }

  state.fly = {
    startTime: performance.now(),
    duration,
    fromPos: camera.position.clone(),
    toPos: new THREE.Vector3(...toPos),
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(...toTarget),
  };
}

function openNavGuide() {
  if (!dom.navGuide || state.isIntro) return;
  closeMenu();
  state.guideOpen = true;
  dom.navGuide.classList.add("is-open");
  dom.navGuide.setAttribute("aria-hidden", "false");
  dom.btnGuide?.setAttribute("aria-expanded", "true");
  dom.btnGuide?.setAttribute("aria-pressed", "true");
  dismissGestureHint();
}

function closeNavGuide() {
  if (!dom.navGuide || !state.guideOpen) return;
  state.guideOpen = false;
  dom.navGuide.classList.remove("is-open");
  dom.navGuide.setAttribute("aria-hidden", "true");
  dom.btnGuide?.setAttribute("aria-expanded", "false");
  dom.btnGuide?.setAttribute("aria-pressed", "false");
}

function toggleNavGuide() {
  if (state.guideOpen) closeNavGuide();
  else openNavGuide();
}

function dismissGestureHint() {
  if (state.hasInteracted) return;
  state.hasInteracted = true;
  dom.gestureHint.classList.remove("is-visible");
}

function enterExperience() {
  if (!state.isIntro) return;
  state.isIntro = false;
  if (!state.satDone) finishSatelliteIntro();
  dom.intro.classList.remove("is-visible");
  dom.intro.setAttribute("aria-hidden", "true");
  dom.header.classList.add("is-visible");
  dom.header.setAttribute("aria-hidden", "false");
  dom.gestureHint.classList.add("is-visible");
  dom.spaceLabels.classList.add("is-visible");
  dom.spaceLabels.setAttribute("aria-hidden", "false");
  dom.distanceHud.classList.add("is-visible");
  controls.enabled = true;
  const ov = getOverviewCam();
  flyTo(ov.pos, ov.target, 1150);
}

function selectSpace(spaceId) {
  const sp = state.data.spaces.find((s) => s.id === spaceId);
  if (!sp) return;

  if (state.isIntro) {
    state.isIntro = false;
    if (!state.satDone) finishSatelliteIntro();
    dom.intro.classList.remove("is-visible");
    dom.intro.setAttribute("aria-hidden", "true");
    dom.spaceLabels.classList.add("is-visible");
    dom.spaceLabels.setAttribute("aria-hidden", "false");
    dom.distanceHud.classList.add("is-visible");
    controls.enabled = true;
  }

  dismissGestureHint();
  closeNavGuide();
  closeMenu();
  state.selectedSpaceId = sp.id;
  state.isPlanView = false;
  dom.btnViewMode.setAttribute("aria-pressed", "false");

  const idxNum = state.data.spaces.findIndex((s) => s.id === sp.id) + 1;
  dom.cardIndex.textContent = `${String(idxNum).padStart(2, "0")} / ${state.data.spaces.length}`;
  dom.cardCategory.textContent = sp.category;
  dom.cardTitle.textContent = sp.title;
  dom.cardMetric.textContent = sp.metric;
  dom.cardSummary.textContent = sp.summary;
  dom.cardHighlights.innerHTML = sp.highlights.map((h) => `<li>${h}</li>`).join("");
  dom.cardLot.textContent = sp.lot;

  dom.spaceCard.classList.add("is-open");
  dom.spaceCard.setAttribute("aria-hidden", "false");
  dom.header.classList.add("is-hidden");

  markerGroups.forEach((g) => {
    const active = g.userData.spaceId === sp.id;
    g.userData.discMat.color.setHex(active ? 0xc85544 : 0xa64234);
    g.userData.discMat.emissiveIntensity = active ? 0.55 : 0.35;
  });

  const desktopShiftX = window.innerWidth > 768 ? -6 : 0;
  const targetPos = [sp.pos[0] + desktopShiftX, 1.4, sp.pos[1]];
  const camPos = [
    sp.pos[0] + sp.camOffset[0] + desktopShiftX,
    sp.camOffset[1],
    sp.pos[1] + sp.camOffset[2],
  ];
  flyTo(camPos, targetPos, 1000);
}

function closeSpaceCard() {
  if (!state.selectedSpaceId) return;
  state.selectedSpaceId = null;
  dom.spaceCard.classList.remove("is-open");
  dom.spaceCard.setAttribute("aria-hidden", "true");
  dom.header.classList.add("is-visible");
  dom.header.classList.remove("is-hidden");

  markerGroups.forEach((g) => {
    g.userData.discMat.color.setHex(0xa64234);
    g.userData.discMat.emissiveIntensity = 0.35;
  });

  const dest = state.isPlanView ? getPlanCam() : getOverviewCam();
  flyTo(dest.pos, dest.target, 950);
}

function stepSpace(delta) {
  const list = state.data.spaces;
  const cur = list.findIndex((s) => s.id === state.selectedSpaceId);
  const next = cur === -1 ? 0 : (cur + delta + list.length) % list.length;
  selectSpace(list[next].id);
}

function togglePlanView() {
  dismissGestureHint();
  if (state.selectedSpaceId) {
    state.selectedSpaceId = null;
    dom.spaceCard.classList.remove("is-open");
    dom.spaceCard.setAttribute("aria-hidden", "true");
    dom.header.classList.remove("is-hidden");
    markerGroups.forEach((g) => {
      g.userData.discMat.color.setHex(0xa64234);
      g.userData.discMat.emissiveIntensity = 0.35;
    });
  }
  state.isPlanView = !state.isPlanView;
  dom.btnViewMode.setAttribute("aria-pressed", String(state.isPlanView));
  const dest = state.isPlanView ? getPlanCam() : getOverviewCam();
  flyTo(dest.pos, dest.target, 900);
}

function resetView() {
  dismissGestureHint();
  state.isPlanView = false;
  dom.btnViewMode.setAttribute("aria-pressed", "false");
  if (state.selectedSpaceId) {
    closeSpaceCard();
  } else {
    const ov = getOverviewCam();
    flyTo(ov.pos, ov.target, 900);
  }
}

function setNightMode(nextNight) {
  state.isNight = Boolean(nextNight);
  state.targetNight = state.isNight ? 1 : 0;
  state.nightAnim = {
    startTime: performance.now(),
    duration: state.reducedMotion ? 1 : 780,
    from: state.nightFactor,
    to: state.targetNight,
  };
  document.body.classList.toggle("is-night", state.isNight);
  dom.btnTheme.setAttribute("aria-pressed", String(state.isNight));
  dom.btnTheme.setAttribute(
    "aria-label",
    state.isNight ? "Revenir à la vue jour" : "Activer la vue nuit"
  );
  if (dom.btnIntroDay && dom.btnIntroNight) {
    dom.btnIntroDay.classList.toggle("is-active", !state.isNight);
    dom.btnIntroDay.setAttribute("aria-pressed", String(!state.isNight));
    dom.btnIntroNight.classList.toggle("is-active", state.isNight);
    dom.btnIntroNight.setAttribute("aria-pressed", String(state.isNight));
  }
}

function openMenu() {
  state.hoveredSpaceId = null;
  closeNavGuide();
  dom.menuOverlay.classList.add("is-open");
  dom.menuOverlay.setAttribute("aria-hidden", "false");
  dom.btnMenu.setAttribute("aria-expanded", "true");
}

function closeMenu() {
  if (!dom.menuOverlay.classList.contains("is-open")) return;
  dom.menuOverlay.classList.remove("is-open");
  dom.menuOverlay.setAttribute("aria-hidden", "true");
  dom.btnMenu.setAttribute("aria-expanded", "false");
}

function buildMenu() {
  dom.menuList.innerHTML = state.data.spaces
    .map(
      (sp) => `
        <li>
          <button type="button" class="menu-item-btn" data-space-id="${sp.id}">
            <span class="menu-item-num">${sp.index}</span>
            <span>${sp.title}</span>
          </button>
        </li>
      `
    )
    .join("");
}

function pickMarkerAtClientXY(clientX, clientY) {
  const rect = dom.canvas.getBoundingClientRect();
  state.pointerWorld.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  state.pointerWorld.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(state.pointerWorld, camera);
  const markerHits = raycaster.intersectObjects(hitProxies, false);
  return markerHits.length > 0 ? markerHits[0].object.userData.spaceId : null;
}

function pickSpaceAtClientXY(clientX, clientY) {
  const rect = dom.canvas.getBoundingClientRect();
  state.pointerWorld.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  state.pointerWorld.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(state.pointerWorld, camera);

  const markerHits = raycaster.intersectObjects(hitProxies, false);
  if (markerHits.length > 0) {
    return markerHits[0].object.userData.spaceId;
  }

  const zoneHits = raycaster.intersectObjects(clickableZones, false);
  if (zoneHits.length > 0) {
    return zoneHits[0].object.userData.spaceId;
  }
  return null;
}

const _dayColors = {
  sky: new THREE.Color(0xf8f6f2),
  ground: new THREE.Color(0xfaf8f3),
  road: new THREE.Color(0xffffff),
  building: new THREE.Color(0xffffff),
  edge: new THREE.Color(0xe3dcd0),
  park: new THREE.Color(0xf2ebe0),
  kiosk: new THREE.Color(0xffffff),
  roof: new THREE.Color(0xe6dccd),
  cantine: new THREE.Color(0xffffff),
  paving: new THREE.Color(0xffffff),
  green: new THREE.Color(0xffffff),
  sport: new THREE.Color(0xf7efe4),
  sand: new THREE.Color(0xf4e4c1),
  track: new THREE.Color(0xc67360),
  play: new THREE.Color(0xeaddcb),
  gradin: new THREE.Color(0xe3dad0),
  parkingZone: new THREE.Color(0xebe3d5),
  sun: new THREE.Color(0xfffaf2),
  hemiSky: new THREE.Color(0xffffff),
  hemiGround: new THREE.Color(0xe8dfd0),
  senegal: new THREE.Color(0xffffff),
};

const _nightColors = {
  sky: new THREE.Color(0x0d1420),
  ground: new THREE.Color(0x0f1724),
  road: new THREE.Color(0x2a3548),
  building: new THREE.Color(0x253245),
  edge: new THREE.Color(0x3a4962),
  park: new THREE.Color(0x1f2b3d),
  kiosk: new THREE.Color(0x344257),
  roof: new THREE.Color(0x2d3a4e),
  cantine: new THREE.Color(0x3d4859),
  paving: new THREE.Color(0x2d3748),
  green: new THREE.Color(0x2c4237),
  sport: new THREE.Color(0x343b49),
  sand: new THREE.Color(0x4b4232),
  track: new THREE.Color(0x462d2c),
  play: new THREE.Color(0x333c4b),
  gradin: new THREE.Color(0x2a3547),
  parkingZone: new THREE.Color(0x232d3d),
  sun: new THREE.Color(0x90b4e8),
  hemiSky: new THREE.Color(0x3b4d70),
  hemiGround: new THREE.Color(0x121926),
  senegal: new THREE.Color(0x26344b),
};

function applyThemeLerp(f) {
  const t = themeTargets;
  if (!t.sun) return;

  scene.background.lerpColors(_dayColors.sky, _nightColors.sky, f);
  scene.fog.color.copy(scene.background);

  t.groundMat.color.lerpColors(_dayColors.ground, _nightColors.ground, f);
  if (t.roadMat) t.roadMat.color.lerpColors(_dayColors.road, _nightColors.road, f);
  if (t.buildingMat) t.buildingMat.color.lerpColors(_dayColors.building, _nightColors.building, f);
  if (t.buildingEdgesMat) t.buildingEdgesMat.color.lerpColors(_dayColors.edge, _nightColors.edge, f);
  if (t.parkMat) t.parkMat.color.lerpColors(_dayColors.park, _nightColors.park, f);
  if (t.kioskMat) t.kioskMat.color.lerpColors(_dayColors.kiosk, _nightColors.kiosk, f);
  if (t.roofMat) t.roofMat.color.lerpColors(_dayColors.roof, _nightColors.roof, f);
  if (t.cantineMat) t.cantineMat.color.lerpColors(_dayColors.cantine, _nightColors.cantine, f);

  for (const [k, mat] of Object.entries(t.kindMaterials || {})) {
    if (_dayColors[k] && _nightColors[k]) {
      mat.color.lerpColors(_dayColors[k], _nightColors[k], f);
    }
  }

  t.sun.color.lerpColors(_dayColors.sun, _nightColors.sun, f);
  t.sun.intensity = THREE.MathUtils.lerp(1.15, 0.36, f);
  t.hemi.color.lerpColors(_dayColors.hemiSky, _nightColors.hemiSky, f);
  t.hemi.groundColor.lerpColors(_dayColors.hemiGround, _nightColors.hemiGround, f);
  t.hemi.intensity = THREE.MathUtils.lerp(1.08, 0.42, f);
  t.fill.intensity = THREE.MathUtils.lerp(0.28, 0.14, f);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.03, 0.94, f);

  if (thiesBackdrop?.material) {
    thiesBackdrop.material.color.lerpColors(_dayColors.senegal, _nightColors.senegal, f);
  }
  if (lightingCtrl) {
    lightingCtrl.applyNightFactor(f, performance.now());
  }
}

const _projVec = new THREE.Vector3();
const _rightVec = new THREE.Vector3();
const _fwdVec = new THREE.Vector3();

function syncSpaceLabels() {
  if (state.isIntro || !state.data) return;
  const w = window.innerWidth;
  const h = window.innerHeight;

  for (const sp of state.data.spaces) {
    const btn = labelButtons.get(sp.id);
    if (!btn) continue;

    // Afficher le nom de l'espace UNIQUEMENT au survol de son icône 3D (ou lorsqu'il est sélectionné)
    const shouldShow =
      sp.id === state.hoveredSpaceId || sp.id === state.selectedSpaceId;

    if (!shouldShow) {
      btn.style.display = "none";
      btn.classList.remove("is-visible", "is-active");
      continue;
    }

    _projVec.set(sp.pos[0], 11.2, sp.pos[1]);
    _projVec.project(camera);

    const sx = Math.round(((_projVec.x + 1) * 0.5) * w);
    const sy = Math.round(((-_projVec.y + 1) * 0.5) * h);

    const inBounds =
      _projVec.z < 1 &&
      sx >= 24 &&
      sx <= w - 24 &&
      sy >= 48 &&
      sy <= h - 24;

    if (!inBounds) {
      btn.style.display = "none";
      btn.classList.remove("is-visible", "is-active");
      continue;
    }

    btn.style.display = "block";
    btn.style.transform = `translate3d(${sx}px, ${sy}px, 0) translate(-50%, -100%)`;
    btn.classList.add("is-visible");
    btn.classList.toggle("is-active", sp.id === state.selectedSpaceId);
    btn.classList.remove("is-muted");
  }
}

const SCALE_STEPS = [2, 5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000];

function updateDistanceHud() {
  if (state.isIntro || !camera || !controls) return;
  const w = window.innerWidth;

  // Mesurer l'échelle réelle en pixels au niveau du point ciblé
  camera.getWorldDirection(_fwdVec);
  _rightVec.crossVectors(_fwdVec, camera.up).normalize();

  const p0 = controls.target.clone().project(camera);
  const p1 = controls.target.clone().add(_rightVec).project(camera);
  const pxPerMeter = Math.abs((p1.x - p0.x) * 0.5 * w);

  if (pxPerMeter > 0.001) {
    let bestMeters = 50;
    for (const m of SCALE_STEPS) {
      const px = m * pxPerMeter;
      if (px >= 46 && px <= 118) {
        bestMeters = m;
        break;
      }
      if (px > 118) break;
      bestMeters = m;
    }
    const barPx = THREE.MathUtils.clamp(Math.round(bestMeters * pxPerMeter), 36, 128);
    dom.scaleBarLine.style.width = `${barPx}px`;
    dom.scaleBarLabel.textContent = bestMeters >= 1000 ? `${bestMeters / 1000} km` : `${bestMeters} m`;
  }

  const dist = Math.round(camera.position.distanceTo(controls.target));
  const alt = Math.max(4, Math.round(camera.position.y));
  dom.distanceReadout.textContent = state.selectedSpaceId
    ? `Dist. ${dist} m`
    : `Alt. ${alt} m`;
}

function bindEvents() {
  dom.btnExplore.addEventListener("click", enterExperience);
  dom.btnIntroDay?.addEventListener("click", () => setNightMode(false));
  dom.btnIntroNight?.addEventListener("click", () => setNightMode(true));
  dom.btnDevis?.addEventListener("click", () => {
    state.hoveredSpaceId = null;
    closeNavGuide();
    closeMenu();
    dossierCtrl?.openDevis();
  });
  dom.btnMenuDevis?.addEventListener("click", () => {
    state.hoveredSpaceId = null;
    closeNavGuide();
    closeMenu();
    dossierCtrl?.openDevis();
  });
  dom.btnTheme.addEventListener("click", () => setNightMode(!state.isNight));
  dom.btnViewMode.addEventListener("click", togglePlanView);
  dom.btnReset.addEventListener("click", resetView);
  dom.btnGuide?.addEventListener("click", toggleNavGuide);
  dom.btnCloseGuide?.addEventListener("click", closeNavGuide);
  dom.btnMenu.addEventListener("click", () => {
    if (dom.menuOverlay.classList.contains("is-open")) closeMenu();
    else openMenu();
  });
  dom.btnCloseMenu.addEventListener("click", closeMenu);

  // Fermer le guide si clic à l'extérieur du panneau et hors bouton guide
  document.addEventListener("pointerdown", (e) => {
    if (!state.guideOpen || !dom.navGuide) return;
    if (dom.navGuide.contains(e.target) || dom.btnGuide?.contains(e.target)) return;
    closeNavGuide();
  });

  dom.menuList.addEventListener("click", (e) => {
    const btn = e.target.closest(".menu-item-btn");
    if (!btn) return;
    selectSpace(btn.dataset.spaceId);
  });

  dom.btnCloseCard.addEventListener("click", closeSpaceCard);
  dom.btnBackToMap.addEventListener("click", closeSpaceCard);
  dom.btnSpaceMore?.addEventListener("click", () => {
    if (state.selectedSpaceId) {
      state.hoveredSpaceId = null;
      dossierCtrl?.openSpacePage(state.selectedSpaceId);
    }
  });
  dom.btnPrevSpace.addEventListener("click", () => stepSpace(-1));
  dom.btnNextSpace.addEventListener("click", () => stepSpace(1));

  // Double-clic terrain -> avancer vers le point cliqué
  dom.canvas.addEventListener("dblclick", (e) => {
    if (state.isIntro) return;
    const rect = dom.canvas.getBoundingClientRect();
    state.pointerWorld.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    state.pointerWorld.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(state.pointerWorld, camera);
    const hits = raycaster.intersectObject(groundMesh, false);
    if (hits.length) {
      const pt = hits[0].point;
      const clampedX = THREE.MathUtils.clamp(pt.x, -260, 260);
      const clampedZ = THREE.MathUtils.clamp(pt.z, -120, 120);
      const nextCam = camera.position.clone().lerp(new THREE.Vector3(clampedX, 24, clampedZ + 28), 0.45);
      flyTo([nextCam.x, Math.max(18, nextCam.y), nextCam.z], [clampedX, 0.5, clampedZ], 700);
    }
  });

  // Interaction souris / tactile sur le canvas 3D
  dom.canvas.addEventListener("pointerdown", (e) => {
    state.pointerDownPos = { x: e.clientX, y: e.clientY };
    if (state.fly) state.fly = null;
  });

  dom.canvas.addEventListener("pointermove", (e) => {
    if (dom.cursorRing) {
      dom.cursorRing.style.setProperty("--cx", `${e.clientX}px`);
      dom.cursorRing.style.setProperty("--cy", `${e.clientY}px`);
      dom.cursorRing.classList.add("is-visible");
    }

    if (state.pointerDownPos) {
      const dist = Math.hypot(
        e.clientX - state.pointerDownPos.x,
        e.clientY - state.pointerDownPos.y
      );
      if (dist > 6 && !state.isIntro) {
        dismissGestureHint();
        state.hoveredSpaceId = null;
      }
    }

    if (state.isIntro || state.pointerDownPos || e.pointerType !== "mouse") return;
    const hitId = pickMarkerAtClientXY(e.clientX, e.clientY);
    state.hoveredSpaceId = hitId;

    if (hitId) {
      dom.canvas.style.cursor = "pointer";
      dom.cursorRing?.classList.add("is-hovering");
    } else {
      dom.canvas.style.cursor = "grab";
      dom.cursorRing?.classList.remove("is-hovering");
    }
  });

  dom.canvas.addEventListener("pointerleave", () => {
    state.hoveredSpaceId = null;
    dom.cursorRing?.classList.remove("is-hovering");
  });

  dom.canvas.addEventListener("pointerup", (e) => {
    if (!state.pointerDownPos || state.isIntro) {
      state.pointerDownPos = null;
      return;
    }
    const dist = Math.hypot(
      e.clientX - state.pointerDownPos.x,
      e.clientY - state.pointerDownPos.y
    );
    state.pointerDownPos = null;
    if (dist < 6) {
      const hitId = pickSpaceAtClientXY(e.clientX, e.clientY);
      if (hitId) {
        selectSpace(hitId);
      }
    }
  });

  dom.canvas.addEventListener(
    "wheel",
    () => {
      if (!state.isIntro) dismissGestureHint();
    },
    { passive: true }
  );

  document.addEventListener("keydown", (e) => {
    const inInput = e.target?.tagName === "INPUT" || e.target?.tagName === "TEXTAREA";
    if (e.key === "Escape") {
      if (dossierCtrl?.isOpen()) {
        dossierCtrl.closeAll();
      } else if (state.guideOpen) {
        closeNavGuide();
      } else if (dom.menuOverlay.classList.contains("is-open")) {
        closeMenu();
      } else if (state.selectedSpaceId) {
        closeSpaceCard();
      }
      return;
    }

    if (inInput) return;

    if (e.key === "n" || e.key === "N") {
      setNightMode(!state.isNight);
      return;
    }

    if ((e.key === "h" || e.key === "H" || e.key === "?") && !state.isIntro && !dossierCtrl?.isOpen()) {
      toggleNavGuide();
      return;
    }

    if (dossierCtrl?.isOpen()) return;

    if (state.selectedSpaceId) {
      if (e.key === "ArrowRight") stepSpace(1);
      else if (e.key === "ArrowLeft") stepSpace(-1);
      return;
    }

    if (!state.isIntro && !dom.menuOverlay.classList.contains("is-open")) {
      state.keysDown.add(e.key.toLowerCase());
      if (["arrowup", "arrowdown", "arrowleft", "arrowright"].includes(e.key.toLowerCase())) {
        e.preventDefault();
        dismissGestureHint();
      }
    }
  });

  document.addEventListener("keyup", (e) => {
    state.keysDown.delete(e.key.toLowerCase());
  });

  window.addEventListener("blur", () => state.keysDown.clear());

  window.addEventListener("resize", () => {
    if (!camera || !renderer) return;
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
  });

  window.__JARDIN_3D__ = {
    getSpaceScreenPos(spaceId) {
      const sp = state.data?.spaces.find((s) => s.id === spaceId);
      if (!sp || !camera) return null;
      const v = new THREE.Vector3(sp.pos[0], 7.4, sp.pos[1]);
      v.project(camera);
      return {
        x: ((v.x + 1) / 2) * window.innerWidth,
        y: ((-v.y + 1) / 2) * window.innerHeight,
      };
    },
    getSpaceCount: () => state.data?.spaces.length || 0,
    setNightMode,
    skipSatelliteIntro() {
      const introCam = getIntroCam();
      camera.position.set(...introCam.pos);
      controls.target.set(...introCam.target);
      finishSatelliteIntro();
    },
    getState: () => {
      const ds = dossierCtrl?.getState() || { devisOpen: false, spacePageId: null };
      return {
        isIntro: state.isIntro,
        satDone: state.satDone,
        isPlanView: state.isPlanView,
        isNight: state.isNight,
        guideOpen: state.guideOpen,
        nightFactor: Number(state.nightFactor.toFixed(2)),
        selectedSpaceId: state.selectedSpaceId,
        hoveredSpaceId: state.hoveredSpaceId,
        devisOpen: ds.devisOpen,
        spacePageId: ds.spacePageId,
        birdCount: atmosphereCtrl?.birdCount || 0,
        cloudCount: atmosphereCtrl?.cloudCount || 0,
        butterflyCount: atmosphereCtrl?.butterflyCount || 0,
        treeCount: state.stats.trees,
        benchCount: state.stats.benches,
        vehicleTypes: VEHICLE_TYPES.map((v) => v.id),
        camPos: camera ? camera.position.toArray().map((n) => Number(n.toFixed(1))) : null,
        target: controls ? controls.target.toArray().map((n) => Number(n.toFixed(1))) : null,
      };
    },
  };
}

let lastFrameTime = performance.now();

function animate(now) {
  requestAnimationFrame(animate);
  const dt = Math.min(0.05, Math.max(0.001, (now - lastFrameTime) * 0.001));
  lastFrameTime = now;

  // Vent GPU
  if (!state.reducedMotion) {
    windUniforms.uWindTime.value = now * 0.001;
  }

  // Transition fluide Jour <-> Nuit (courbe quintic douce + scintillement continu)
  if (state.nightAnim) {
    const np = Math.min(1, (now - state.nightAnim.startTime) / state.nightAnim.duration);
    const nk = easeInOutQuint(np);
    state.nightFactor = state.nightAnim.from + (state.nightAnim.to - state.nightAnim.from) * nk;
    applyThemeLerp(state.nightFactor);
    if (np >= 1) {
      state.nightFactor = state.nightAnim.to;
      state.nightAnim = null;
    }
  } else if (state.nightFactor > 0.01 && lightingCtrl && !state.reducedMotion) {
    lightingCtrl.applyNightFactor(state.nightFactor, now);
  }

  // Zoom cartographique carte de Thiès (thies40.svg) -> centre-ville (courbe logarithmique fluide)
  if (state.satZoom) {
    if (!state.satZoom.warmed) {
      state.satZoom.warmed = true;
    } else if (state.satZoom.startTime === null) {
      state.satZoom.startTime = now;
    }
    const elapsed =
      state.satZoom.startTime === null
        ? 0
        : Math.max(0, now - state.satZoom.startTime - (state.satZoom.holdMs || 0));
    const p = Math.min(1, elapsed / state.satZoom.duration);
    const k = easeInOutQuart(p);
    const kPan = Math.pow(k, 0.48);

    const tgtX = state.satZoom.fromTarget.x * (1 - kPan) + state.satZoom.toTarget.x * kPan;
    const tgtZ = state.satZoom.fromTarget.z * (1 - kPan) + state.satZoom.toTarget.z * kPan;
    const curX = state.satZoom.fromPos.x * (1 - kPan) + state.satZoom.toPos.x * kPan;
    const curY =
      state.satZoom.fromPos.y *
      Math.pow(state.satZoom.toPos.y / state.satZoom.fromPos.y, k);
    const fromOffZ = state.satZoom.fromPos.z - state.satZoom.fromTarget.z;
    const toOffZ = state.satZoom.toPos.z - state.satZoom.toTarget.z;
    const curZ = tgtZ + fromOffZ * Math.pow(toOffZ / fromOffZ, k);

    camera.position.set(curX, curY, curZ);
    camera.lookAt(tgtX, 0, tgtZ);

    if (dom.satAltitude) {
      if (curY > 4200) {
        dom.satAltitude.textContent = "RÉGION DE THIÈS · CARTE → CENTRE-VILLE";
      } else if (curY > 400) {
        const km = Math.max(1, Math.round((curY / 13200) * 60));
        dom.satAltitude.textContent = `THIÈS · ALT. ${km} KM → JARDIN`;
      } else {
        dom.satAltitude.textContent = `THIÈS · ALT. ${Math.round(curY)} M`;
      }
    }
    if (p >= 0.85) {
      dom.intro.classList.add("is-visible");
    }
    if (p >= 1) {
      finishSatelliteIntro();
    }
  } else if (state.isIntro && !state.reducedMotion) {
    const introCam = getIntroCam();
    if (!state.introOrbitStart) state.introOrbitStart = now;
    const t = (now - state.introOrbitStart) * 0.00016;
    camera.position.x = Math.sin(t) * 24;
    camera.position.y = introCam.pos[1];
    camera.position.z = introCam.pos[2] - 12 + Math.cos(t * 0.8) * 12;
    camera.lookAt(...introCam.target);
  } else if (state.fly) {
    const elapsed = now - state.fly.startTime;
    const p = Math.min(1, elapsed / state.fly.duration);
    const k = easeInOutQuint(p);
    camera.position.lerpVectors(state.fly.fromPos, state.fly.toPos, k);
    controls.target.lerpVectors(state.fly.fromTarget, state.fly.toTarget, k);
    if (p >= 1) state.fly = null;
  }

  // Navigation clavier fluide avant/arrière/latéral (W/S/A/D, Z/Q, Flèches)
  if (!state.isIntro && !state.selectedSpaceId && state.keysDown.size > 0) {
    if (state.fly) state.fly = null;
    let fwd = 0;
    let strafe = 0;
    if (state.keysDown.has("arrowup") || state.keysDown.has("w") || state.keysDown.has("z")) fwd += 1;
    if (state.keysDown.has("arrowdown") || state.keysDown.has("s")) fwd -= 1;
    if (state.keysDown.has("arrowright") || state.keysDown.has("d")) strafe += 1;
    if (state.keysDown.has("arrowleft") || state.keysDown.has("a") || state.keysDown.has("q")) strafe -= 1;

    if (fwd !== 0 || strafe !== 0) {
      camera.getWorldDirection(_fwdVec);
      _fwdVec.y = 0;
      if (_fwdVec.lengthSq() < 1e-4) _fwdVec.set(0, 0, -1);
      _fwdVec.normalize();
      _rightVec.crossVectors(_fwdVec, camera.up).normalize();

      const camDist = camera.position.distanceTo(controls.target);
      const speedPerSec = Math.max(36, camDist * 0.85);
      const vx = (_fwdVec.x * fwd + _rightVec.x * strafe) * speedPerSec;
      const vz = (_fwdVec.z * fwd + _rightVec.z * strafe) * speedPerSec;

      state.navVel.set(vx, vz);
    }
  }

  if (state.navVel.lengthSq() > 0.01) {
    camera.position.x += state.navVel.x * dt;
    camera.position.z += state.navVel.y * dt;
    controls.target.x += state.navVel.x * dt;
    controls.target.z += state.navVel.y * dt;
    state.navVel.multiplyScalar(Math.pow(0.015, dt));
  }

  if (!state.isIntro) {
    controls.update();
    controls.target.x = THREE.MathUtils.clamp(controls.target.x, -260, 260);
    controls.target.z = THREE.MathUtils.clamp(controls.target.z, -120, 120);
  }

  // Adapter la distance de brouillard, la précision Z et l'opacité de la carte de Thiès à l'altitude
  const camY = camera.position.y;
  const targetNear = camY > 400 ? Math.min(80, camY * 0.012) : 1;
  if (Math.abs(camera.near - targetNear) > 0.25) {
    camera.near = targetNear;
    camera.updateProjectionMatrix();
  }
  scene.fog.near = Math.max(420, camY * 2.2);
  scene.fog.far = Math.max(1250, camY * 5.2);
  if (thiesBackdrop?.material) {
    const rawOp = THREE.MathUtils.clamp((camY - 900) / 1400, 0, 1);
    const op = rawOp * rawOp * (3 - 2 * rawOp);
    thiesBackdrop.material.opacity = op;
    thiesBackdrop.mesh.visible = op > 0.01;
    thiesBackdrop.updateBeacon?.(now, op);
    if (groundMesh) groundMesh.visible = op < 0.99;
  }

  // Animations vivantes : eau + jets d'eau, voitures, piétons
  if (waterCtrl) waterCtrl.updateWater(dt, now, state.nightFactor);
  if (!state.reducedMotion) {
    if (trafficCtrl) trafficCtrl.update(dt, state.nightFactor);
    if (pedestrianCtrl) pedestrianCtrl.update(dt, now);
  }

  // Disques 3D terracotta orientés face caméra + anneau pulsant au sol
  const smoothK = state.reducedMotion ? 1 : 1 - Math.exp(-10 * dt);
  markerGroups.forEach((g) => {
    const isSel = g.userData.spaceId === state.selectedSpaceId;
    const isHov = g.userData.spaceId === state.hoveredSpaceId;
    const targetScale = isSel ? 0.76 : isHov ? 1.18 : 1.0;
    const s = g.userData.disc.scale.x + (targetScale - g.userData.disc.scale.x) * smoothK;
    g.userData.disc.scale.set(s, s, s);
    const faceAngle = Math.atan2(
      camera.position.x - g.position.x,
      camera.position.z - g.position.z
    );
    const sway = state.reducedMotion ? 0 : Math.sin(now * 0.0014 + g.userData.phase) * 0.24;
    g.userData.disc.rotation.y = faceAngle + sway;
    const baseY = isSel ? 6.4 : 7.2;
    const bob = state.reducedMotion ? 0 : Math.sin(now * 0.0022 + g.userData.phase) * 0.48;
    g.userData.disc.position.y = baseY + bob;

    if (g.userData.pulseRing && g.userData.pulseMat) {
      const cycle = ((now * 0.00055 + g.userData.phase * 0.25) % 1);
      const rScale = state.reducedMotion ? 1.1 : 0.9 + cycle * (isHov || isSel ? 2.4 : 1.7);
      g.userData.pulseRing.scale.set(rScale, rScale, 1);
      g.userData.pulseMat.opacity = state.reducedMotion
        ? 0.25
        : (1 - cycle) * (isHov || isSel ? 0.62 : 0.34);
    }
  });

  // Nuages subtils, papillons et oiseaux en vue jour
  if (atmosphereCtrl) {
    atmosphereCtrl.update(state.reducedMotion ? 0 : dt, now, state.nightFactor);
  }

  // Étiquettes translucides, indice de distance et boussole
  syncSpaceLabels();
  updateDistanceHud();

  if (dom.compassSvg) {
    const angleRad = Math.atan2(
      camera.position.x - controls.target.x,
      camera.position.z - controls.target.z
    );
    const deg = THREE.MathUtils.radToDeg(angleRad);
    dom.compassSvg.style.transform = `rotate(${(-deg).toFixed(1)}deg)`;
  }

  renderer.render(scene, camera);
}

async function init() {
  cacheDom();
  try {
    const [res, thiesMapTex] = await Promise.all([
      fetch("data/scene-3d.json"),
      loadTexture("assets/thies-map.png"),
    ]);
    if (!res.ok) throw new Error("Impossible de charger scene-3d.json");
    state.data = await res.json();

    buildScene(state.data, thiesMapTex);
    buildSpaceLabels(state.data.spaces);
    buildMenu();
    dossierCtrl = createDossierController({
      devisModal: dom.devisModal,
      spacePageModal: dom.spacePageModal,
      spaces: state.data.spaces,
      onCloseAll: () => {
        if (window.location.hash) {
          history.replaceState(null, "", window.location.pathname + window.location.search);
        }
      },
      onShowSpaceIn3D: (id) => selectSpace(id),
    });
    dossierCtrl.preload().catch(() => {});
    bindEvents();

    const applyHashRoute = () => {
      const h = window.location.hash;
      if (h === "#devis") {
        enterExperience();
        dossierCtrl.openDevis();
      } else if (h.startsWith("#espace/")) {
        const spId = h.slice("#espace/".length);
        if (state.data.spaces.some((s) => s.id === spId)) {
          enterExperience();
          dossierCtrl.openSpacePage(spId);
        }
      }
    };
    window.addEventListener("hashchange", applyHashRoute);
    if (window.location.hash) applyHashRoute();

    requestAnimationFrame(animate);
  } catch (err) {
    console.error(err);
  }
}

document.addEventListener("DOMContentLoaded", init);
