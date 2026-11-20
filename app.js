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
  buildUrbanContextLandmarks,
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
import { createParkAudioController } from "./js/audio.js";

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
  timeOfDay: 14.5,
  timeAnim: null,
  selectedSpaceId: null,
  hoveredSpaceId: null,
  hasInteracted: false,
  guideOpen: false,
  audioEnabled: false,
  reducedMotion: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
  fly: null,
  pointerDownPos: null,
  pointerWorld: new THREE.Vector2(),
  keysDown: new Set(),
  navVel: new THREE.Vector2(),
  isMobile: false,
  lastActiveTime: 0,
  frameCount: 0,
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
  dom.btnAudio = document.getElementById("btn-audio");
  dom.timeControl = document.getElementById("time-control");
  dom.btnTimePreset = document.getElementById("btn-time-preset");
  dom.timeReadout = document.getElementById("time-readout");
  dom.timeSlider = document.getElementById("time-slider");
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

// Courbe de vol cinématographique ultra-fluide (accélération douce en cosinus + long amorti d'atterrissage)
function easeSmoothFlight(t) {
  const cosPart = 0.5 - 0.5 * Math.cos(Math.PI * t);
  const outPart = 1 - Math.pow(1 - t, 3.2);
  return cosPart * 0.58 + outPart * 0.42;
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
let contextCtrl;
let dossierCtrl;
let audioCtrl;

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
  state.isMobile = isMobile;
  state.lastActiveTime = performance.now();

  renderer = new THREE.WebGLRenderer({
    canvas: dom.canvas,
    antialias: true,
    powerPreference: isMobile ? "default" : "high-performance",
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, isMobile ? 1.25 : 1.75));
  renderer.setSize(window.innerWidth, window.innerHeight);
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.04;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  // Ombre architecturale pré-calculée (soleil fixe) : 0 passe de shadowMap par frame pendant la navigation !
  renderer.shadowMap.autoUpdate = false;
  renderer.shadowMap.needsUpdate = true;

  const maxAniso = Math.min(isMobile ? 4 : 8, renderer.capabilities.getMaxAnisotropy() || 4);

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
  controls.addEventListener("change", () => {
    state.lastActiveTime = performance.now();
  });

  // Lumières jour / nuit calibrées pour un rendu maquette architecturale ciselé
  const hemi = new THREE.HemisphereLight(0xfffdf9, 0xe6ddd0, 1.1);
  scene.add(hemi);

  const shadowSize = isMobile ? 1536 : 2048;
  const sun = new THREE.DirectionalLight(0xfff9ef, 1.18);
  sun.position.set(160, 250, 130);
  sun.castShadow = true;
  sun.shadow.mapSize.set(shadowSize, shadowSize);
  sun.shadow.camera.left = -295;
  sun.shadow.camera.right = 295;
  sun.shadow.camera.top = 135;
  sun.shadow.camera.bottom = -135;
  sun.shadow.camera.near = 40;
  sun.shadow.camera.far = 650;
  sun.shadow.bias = -0.00032;
  sun.shadow.normalBias = 0.018;
  sun.shadow.radius = 2.4;
  scene.add(sun);

  const fill = new THREE.DirectionalLight(0xf2efe9, 0.32);
  fill.position.set(-180, 140, -160);
  scene.add(fill);

  // Plan macro carte vectorielle de la Région de Thiès (centré sur 0, 0)
  thiesBackdrop = buildThiesBackdrop(scene, textures);

  // Emprise unifiée du pôle enterré (Terrain de Basket + son dégagement + Gradin central + Terrain de Beach Sable) :
  // un seul bassin excavé continu, sans aucun mur de séparation interne entre le gradin et les deux terrains !
  const SUNKEN_BOWL_POLY = [
    [-172.88, -0.68],
    [-151.59, -21.96],
    [-139.5, -9.87],
    [-136.99, -9.87],
    [-136.99, -17.58],
    [-110.99, -17.58],
    [-110.99, 19.3],
    [-152.9, 19.3],
  ];
  const sunkenHoles = [SUNKEN_BOWL_POLY];

  // Plan de sol local (découpé sous les 3 arènes/gradins enterrés pour laisser voir les marches en contrebas)
  const groundMat = new THREE.MeshStandardMaterial({
    color: 0xfaf8f3,
    roughness: 0.96,
    metalness: 0,
    polygonOffset: true,
    polygonOffsetFactor: 2,
    polygonOffsetUnits: 2,
  });
  const groundGeom = extrudePoly(
    [
      [-1200, -1200],
      [1200, -1200],
      [1200, 1200],
      [-1200, 1200],
    ],
    0.04,
    -0.09,
    sunkenHoles
  );
  groundMesh = new THREE.Mesh(groundGeom, groundMat);
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

  // 2. 352 immeubles voisins de Thiès : hauteurs normalisées à 3 m (1 niveau), 6 m (2 niveaux) ou 9 m (3 niveaux)
  const buildingGeoms = [];
  for (const b of data.buildings) {
    try {
      const p0 = b.poly?.[0];
      // Éviter de superposer les blocs bruts sur la Station-service Nord-Ouest (b[74]), la Station-service Ouest (b[87]) et la Banque (b[63])
      if (p0) {
        const cx = b.poly.reduce((s, p) => s + p[0], 0) / b.poly.length;
        const cz = b.poly.reduce((s, p) => s + p[1], 0) / b.poly.length;
        if (
          Math.hypot(cx + 241.5, cz + 73.6) < 8 ||
          Math.hypot(cx + 302.9, cz + 6.8) < 6 ||
          Math.hypot(cx + 120.6, cz + 73.1) < 5
        ) {
          b.isContextSkip = true;
          continue;
        }
      }
      const levels = b.h < 5.2 ? 1 : b.h < 6.8 ? 2 : 3;
      b.levels = levels;
      b.h = levels * 3.0;
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

  // 3. Socle du parc linéaire (500 x 50 m, top 0.300, évidé au droit des terrains et gradins enterrés)
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
    0.055,
    sunkenHoles
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
  const pushKindGeom = (k, geom) => {
    if (!geom) return;
    if (!mergedByKind[k]) mergedByKind[k] = [];
    mergedByKind[k].push(geom);
  };
  const scalePolyToward = (poly, cx, cz, s) =>
    poly.map(([x, z]) => [cx + (x - cx) * s, cz + (z - cz) * s]);

  // Dalle de fond continue du pôle enterré (-0.36 m) sous Basket + Gradin central + Beach (zéro mur interne)
  pushKindGeom("paving", extrudePoly(SUNKEN_BOWL_POLY, 0.08, -0.44));

  for (const z of data.zones) {
    try {
      if (z.kind === "water") continue;
      if (z.kind === "building") {
        kioskGeoms.push(extrudePoly(z.poly, 3.05, 0.355));
        continue;
      }
      // Ignorer le cadre AIRE DE DEGAGEMENT haut (+0.35 m) autour du Basket qui formait un muret entre Basket et Gradin
      if (
        z.kind === "paving" &&
        Math.hypot(z.centroid[0] + 156.18, z.centroid[1] + 5.27) < 1.2
      ) {
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

      // A. Gradins :
      // 1) Gradin triangulaire au milieu entre Basket et Beach (cx ~ -145.7) : marches tournées VERS L'EXTÉRIEUR
      //    (descendant du centre vers les deux terrains enterrés), avec bandes de gazon et décorations paysagères.
      // 2) Gradin Sud du Terrain de Foot (cx ~ -219.0) : surélevé en béton et gazon.
      if (z.kind === "gradin") {
        if (z.centroid[0] > -180) {
          const ix = -146.27;
          const iz = 10.02;
          const scales = [1.0, 0.82, 0.64, 0.46, 0.28];
          const topYs = [-0.22, 0.06, 0.34, 0.62, 0.90];
          const baseY = -0.42;
          for (let t = 0; t < scales.length; t++) {
            const outerP = scalePolyToward(z.poly, ix, iz, scales[t]);
            const holes =
              t < scales.length - 1
                ? [scalePolyToward(z.poly, ix, iz, scales[t + 1] * 0.98)]
                : [];
            pushKindGeom("gradin", extrudePoly(outerP, topYs[t] - baseY, baseY, holes));

            // Bandes de gazon sur chaque palier et esplanade engazonnée au sommet central
            if (t < scales.length - 1) {
              const gOuter = scalePolyToward(z.poly, ix, iz, scales[t] * 0.93);
              const gInner = scalePolyToward(z.poly, ix, iz, scales[t + 1] * 1.02);
              pushKindGeom("green", extrudePoly(gOuter, 0.045, topYs[t], [gInner]));
            } else {
              const topLawn = scalePolyToward(z.poly, ix, iz, scales[t] * 0.86);
              pushKindGeom("green", extrudePoly(topLawn, 0.05, topYs[t]));
            }
          }

          // Marches intermédiaires en béton tournées vers l'extérieur (côté Basket NO et côté Beach Est)
          for (let t = 0; t < scales.length; t++) {
            const sOut = scales[t];
            const stepY = topYs[t] - 0.14;
            const xE = ix + (-136.99 - ix) * sOut;
            pushKindGeom(
              "gradin",
              extrudePoly(
                [
                  [xE - 0.35, 5.8],
                  [xE + 0.35, 5.8],
                  [xE + 0.35, 8.2],
                  [xE - 0.35, 8.2],
                ],
                stepY - baseY,
                baseY
              )
            );
            const bx = ix + (-150.0 - ix) * sOut;
            const bz = iz + (0.6 - iz) * sOut;
            pushKindGeom(
              "gradin",
              extrudePoly(
                [
                  [bx - 1.1, bz - 0.3],
                  [bx + 0.5, bz - 1.3],
                  [bx + 1.1, bz - 0.5],
                  [bx - 0.5, bz + 0.5],
                ],
                stepY - baseY,
                baseY
              )
            );
          }
        } else {
          // Gradin Sud Football : non enterré (surélevé), alternance de gradins en béton et terrasses de gazon
          const x0 = -245.03;
          const x1 = -193.03;
          const zStart = 16.84;
          const tierD = (23.03 - 16.84) / 4; // 1.5475 m par niveau
          const baseY = 0.31;
          const stairXs = [
            [-242.8, -240.6],
            [-220.1, -217.9],
            [-197.4, -195.2],
          ];
          const grassSpans = [
            [x0 + 0.35, stairXs[0][0]],
            [stairXs[0][1], stairXs[1][0]],
            [stairXs[1][1], stairXs[2][0]],
            [stairXs[2][1], x1 - 0.35],
          ];
          for (let t = 0; t < 4; t++) {
            const tz0 = zStart + t * tierD;
            const tz1 = tz0 + tierD;
            const yTop = 0.64 + t * 0.34; // 0.64, 0.98, 1.32, 1.66 m
            // Assise et contremarche en béton
            pushKindGeom(
              "gradin",
              extrudePoly(
                [
                  [x0, tz0],
                  [x1, tz0],
                  [x1, tz1],
                  [x0, tz1],
                ],
                yTop - baseY,
                baseY
              )
            );
            // Bande de gazon sur la terrasse de chaque gradin (hors escaliers d'accès en béton)
            const gz0 = tz0 + 0.56;
            const gz1 = tz1 - 0.08;
            for (const [gx0, gx1] of grassSpans) {
              pushKindGeom(
                "green",
                extrudePoly(
                  [
                    [gx0, gz0],
                    [gx1, gz0],
                    [gx1, gz1],
                    [gx0, gz1],
                  ],
                  0.045,
                  yTop
                )
              );
            }
            // Marches d'accès intermédiaires en béton dans les 3 escaliers
            const stepY = yTop - 0.17;
            for (const [sx0, sx1] of stairXs) {
              pushKindGeom(
                "gradin",
                extrudePoly(
                  [
                    [sx0, tz0 - 0.32],
                    [sx1, tz0 - 0.32],
                    [sx1, tz0 + 0.28],
                    [sx0, tz0 + 0.28],
                  ],
                  stepY - baseY,
                  baseY
                )
              );
            }
          }
        }
        continue;
      }

      // B. Terrain de Basket enterré (-0.35 m) ouvert directement sur le gradin central (aucun mur de séparation)
      if (zu === "BASKET") {
        pushKindGeom("sport", extrudePoly(z.poly, 0.08, -0.43)); // top -0.35 m
        continue;
      }

      // C. Terrain de Beach Sable enterré (-0.35 m) ouvert directement sur le gradin central (aucun mur de séparation)
      if (zu.includes("BEACH")) {
        pushKindGeom("sand", extrudePoly(z.poly, 0.08, -0.43)); // top -0.35 m
        continue;
      }

      const effectiveKind = zu.includes("SABLE") ? "sand" : z.kind;
      const st = kindStyle[effectiveKind] || kindStyle.paving;
      const g = extrudePoly(z.poly, st.depth, st.y, z.holes || []);
      pushKindGeom(effectiveKind, g);
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
    if (kind === "gradin" && buildingEdgesMat) {
      scene.add(new THREE.LineSegments(new THREE.EdgesGeometry(merged, 20), buildingEdgesMat));
    }
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
  waterCtrl = buildWaterAndFountains(scene, data, textures, extrudePoly, mergeGeometries, isMobile);
  const vegStats = buildVegetation(scene, data, textures, windUniforms);
  state.stats.trees = vegStats?.treeCount || 0;

  // 9. Vie du jardin : voitures garées, bancs alignés, trafic, piétons, éclairage & fenêtres nuit
  buildParkedCars(scene, data);
  const benchStats = buildBenches(scene, data);
  state.stats.benches = benchStats?.benchCount || 0;
  trafficCtrl = buildMovingTraffic(scene, textures);
  pedestrianCtrl = buildPedestrians(scene);
  lightingCtrl = buildLightingNetwork(scene, data, textures, isMobile);

  // 10. Zones cliquables + 12 repères terracotta
  const zoneHitGeo = new THREE.CylinderGeometry(16, 16, 1.6, 16);
  const zoneHitMat = new THREE.MeshBasicMaterial({ visible: false });
  for (const sp of data.spaces) {
    const pad = new THREE.Mesh(zoneHitGeo, zoneHitMat);
    pad.position.set(sp.pos[0], 0.9, sp.pos[1]);
    pad.userData.spaceId = sp.id;
    scene.add(pad);
    clickableZones.push(pad);
  }

  buildSpaceMarkers(data.spaces, isMobile);

  // 11. Nuages subtils, papillons, oiseaux diurnes et repères urbains voisins (2 stations-service + banque, hors jardin)
  atmosphereCtrl = buildDayAtmosphere(scene, textures, isMobile);
  contextCtrl = buildUrbanContextLandmarks(scene);
  renderer.shadowMap.needsUpdate = true;

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
      holdMs: 900,
      duration: 4500,
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
  const discGeo = new THREE.CylinderGeometry(2.35, 2.35, 0.42, 24);
  discGeo.rotateX(Math.PI / 2);
  const ringGeo = new THREE.TorusGeometry(2.45, 0.14, 8, 24);
  const stemGeo = new THREE.CylinderGeometry(0.08, 0.08, 6.4, 6);
  const baseDotGeo = new THREE.CircleGeometry(0.8, 16);
  baseDotGeo.rotateX(-Math.PI / 2);
  const pulseGeo = new THREE.RingGeometry(1.15, 1.48, 24);
  pulseGeo.rotateX(-Math.PI / 2);
  const hitGeo = new THREE.SphereGeometry(isMobile ? 9.6 : 8.4, 10, 10);
  const hitMat = new THREE.MeshBasicMaterial({ visible: false });
  const sharedRingMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const sharedStemMat = new THREE.MeshBasicMaterial({
    color: 0x8f887d,
    transparent: true,
    opacity: 0.55,
  });
  const sharedDotMat = new THREE.MeshBasicMaterial({ color: 0xa64234 });

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

    const ring = new THREE.Mesh(ringGeo, sharedRingMat);
    disc.add(ring);

    const stem = new THREE.Mesh(stemGeo, sharedStemMat);
    stem.position.y = 3.4;

    const baseDot = new THREE.Mesh(baseDotGeo, sharedDotMat);
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
  if (!state.introOrbitStart) {
    state.introOrbitStart = performance.now();
  }
  if (dom.satBanner) dom.satBanner.classList.remove("is-visible");
  if (state.isIntro) {
    dom.intro.classList.add("is-visible");
  }
}

function flyTo(toPos, toTarget, duration = 1350) {
  if (state.reducedMotion) {
    camera.position.set(...toPos);
    controls.target.set(...toTarget);
    controls.update();
    state.fly = null;
    return;
  }

  const fromPos = camera.position.clone();
  const destPos = new THREE.Vector3(...toPos);
  const horizDist = Math.hypot(destPos.x - fromPos.x, destPos.z - fromPos.z);
  const arcLift = Math.min(34, horizDist * 0.14);

  state.fly = {
    startTime: performance.now(),
    duration,
    fromPos,
    toPos: destPos,
    fromTarget: controls.target.clone(),
    toTarget: new THREE.Vector3(...toTarget),
    arcLift,
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
  audioCtrl?.setEnabled(true);
  const ov = getOverviewCam();
  flyTo(ov.pos, ov.target, 1400);
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
  flyTo(camPos, targetPos, 1350);
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
  flyTo(dest.pos, dest.target, 1300);
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
  flyTo(dest.pos, dest.target, 1280);
}

function resetView() {
  dismissGestureHint();
  state.isPlanView = false;
  dom.btnViewMode.setAttribute("aria-pressed", "false");
  if (state.selectedSpaceId) {
    closeSpaceCard();
  } else {
    const ov = getOverviewCam();
    flyTo(ov.pos, ov.target, 1280);
  }
}

function formatTimeOfDay(hour) {
  const clamped = THREE.MathUtils.clamp(hour, 0, 24);
  const h = Math.floor(clamped);
  const m = Math.round((clamped - h) * 60) % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

function syncTimeUi(hour, isNight) {
  if (dom.timeReadout) {
    dom.timeReadout.textContent = formatTimeOfDay(hour);
  }
  if (dom.timeSlider && Math.abs(Number(dom.timeSlider.value) - hour) > 0.02) {
    dom.timeSlider.value = hour.toFixed(2);
  }
  document.body.classList.toggle("is-night", isNight);
  dom.btnTheme?.setAttribute("aria-pressed", String(isNight));
  dom.btnTheme?.setAttribute(
    "aria-label",
    isNight ? "Revenir à la vue jour" : "Activer la vue nuit"
  );
  if (dom.btnIntroDay && dom.btnIntroNight) {
    dom.btnIntroDay.classList.toggle("is-active", !isNight);
    dom.btnIntroDay.setAttribute("aria-pressed", String(!isNight));
    dom.btnIntroNight.classList.toggle("is-active", isNight);
    dom.btnIntroNight.setAttribute("aria-pressed", String(isNight));
  }
}

function setTimeOfDay(nextHour, animateTransition = false, duration = 1450) {
  const targetH = THREE.MathUtils.clamp(Number(nextHour) || 14.5, 6, 22);
  state.lastActiveTime = performance.now();
  const targetNight = THREE.MathUtils.smoothstep(targetH, 18.0, 20.1);
  state.isNight = targetNight > 0.5;
  state.targetNight = targetNight;

  if (animateTransition && !state.reducedMotion) {
    state.nightAnim = null;
    state.timeAnim = {
      startTime: performance.now(),
      duration,
      fromHour: state.timeOfDay,
      toHour: targetH,
      fromNight: state.nightFactor,
      toNight: targetNight,
    };
    syncTimeUi(targetH, state.isNight);
  } else {
    state.timeAnim = null;
    state.nightAnim = null;
    state.timeOfDay = targetH;
    state.nightFactor = targetNight;
    syncTimeUi(targetH, state.isNight);
    applyThemeLerp(state.nightFactor, state.timeOfDay);
  }
}

const TIME_PRESETS = [8.5, 12.5, 17.5, 21.5]; // 08:30 Matin, 12:30 Midi, 17:30 Heure dorée, 21:30 Nuit

function cycleTimePreset() {
  const cur = state.timeAnim ? state.timeAnim.toHour : state.timeOfDay;
  let nextIdx = TIME_PRESETS.findIndex((p) => p > cur + 0.4);
  if (nextIdx === -1) nextIdx = 0;
  setTimeOfDay(TIME_PRESETS[nextIdx], true, 1550);
}

function setNightMode(nextNight) {
  const targetNight = Boolean(nextNight);
  const targetHour = targetNight ? 21.5 : 14.5;
  setTimeOfDay(targetHour, true, 1750);
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

const _twilightSky = new THREE.Color(0xd8c6b4);
const _twilightSun = new THREE.Color(0xffb46e);
const _lastSunShadowPos = new THREE.Vector3(160, 250, 130);

function applyThemeLerp(f, hour = state.timeOfDay) {
  const t = themeTargets;
  if (!t.sun) return;

  // Calcul de la trajectoire solaire 3D selon l'heure de la journée (06h00 Est -> 12h30 Zénith -> 19h00 Ouest)
  const clampedDayHour = THREE.MathUtils.clamp(hour, 6.0, 19.2);
  const solarAngle = ((clampedDayHour - 12.5) / 6.5) * (Math.PI * 0.45);
  const sx = Math.sin(solarAngle) * 265;
  const syDay = Math.max(38, Math.cos(solarAngle) * 268);
  const sy = THREE.MathUtils.lerp(syDay, 68, f);
  const sz = 92 + Math.cos(solarAngle) * 44;

  t.sun.position.set(sx, sy, sz);
  if (t.fill) {
    t.fill.position.set(-sx * 0.72, Math.max(75, sy * 0.55), -sz);
  }

  // Recalculer l'ombre portée uniquement lorsque le soleil se déplace (0 coût par frame au repos !)
  if (renderer && _lastSunShadowPos.distanceToSquared(t.sun.position) > 0.35) {
    _lastSunShadowPos.copy(t.sun.position);
    renderer.shadowMap.needsUpdate = true;
  }

  // Chaleur dorée du matin (06h-09h) et de fin d'après-midi / crépuscule (16h15-19h30)
  const lowSunWarmth =
    (1 - f) *
    Math.max(
      0,
      Math.max(1 - Math.max(0, hour - 6.2) / 2.8, Math.max(0, hour - 15.8) / 3.0)
    );
  const twilight = Math.max(Math.sin(f * Math.PI) * 0.3, lowSunWarmth * 0.38);

  scene.background.lerpColors(_dayColors.sky, _nightColors.sky, f);
  if (twilight > 0.005) {
    scene.background.lerp(_twilightSky, twilight);
  }
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
  if (twilight > 0.005) {
    t.sun.color.lerp(_twilightSun, Math.min(0.85, twilight * 1.55));
  }
  const zenithBoost = Math.cos(solarAngle) * 0.14 * (1 - f);
  t.sun.intensity = THREE.MathUtils.lerp(1.12 + zenithBoost, 0.36, f);
  t.hemi.color.lerpColors(_dayColors.hemiSky, _nightColors.hemiSky, f);
  t.hemi.groundColor.lerpColors(_dayColors.hemiGround, _nightColors.hemiGround, f);
  t.hemi.intensity = THREE.MathUtils.lerp(1.08, 0.42, f);
  t.fill.intensity = THREE.MathUtils.lerp(0.32, 0.14, f);
  renderer.toneMappingExposure = THREE.MathUtils.lerp(1.04, 0.95, f);

  if (thiesBackdrop?.material) {
    thiesBackdrop.material.color.lerpColors(_dayColors.senegal, _nightColors.senegal, f);
  }
  if (lightingCtrl) {
    lightingCtrl.applyNightFactor(f, performance.now());
  }
  if (contextCtrl) {
    contextCtrl.updateNight(f);
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
  dom.btnTimePreset?.addEventListener("click", cycleTimePreset);
  dom.timeSlider?.addEventListener("input", (e) => {
    setTimeOfDay(parseFloat(e.target.value), false);
  });
  dom.btnAudio?.addEventListener("click", () => audioCtrl?.toggle());
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

    if (e.key === "m" || e.key === "M") {
      audioCtrl?.toggle();
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
        audioEnabled: state.audioEnabled,
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

  if (document.hidden) {
    lastFrameTime = now;
    return;
  }

  // Régulation thermique intelligente sur téléphone : 60 FPS pleins pendant toute transition (zoom carte, vol, Jour/Nuit, heure du soleil),
  // économie d'énergie uniquement au repos
  const rawElapsed = now - lastFrameTime;
  const inTransition =
    Boolean(state.satZoom) ||
    Boolean(state.fly) ||
    Boolean(state.nightAnim) ||
    Boolean(state.timeAnim);
  if (state.isMobile && !inTransition) {
    const isInteracting = now - state.lastActiveTime < 1800;
    const minInterval = isInteracting ? 20 : 34;
    if (rawElapsed < minInterval) return;
  }

  const dt = Math.min(0.05, Math.max(0.001, rawElapsed * 0.001));
  lastFrameTime = now;
  state.frameCount++;

  // Vent GPU
  if (!state.reducedMotion) {
    windUniforms.uWindTime.value = now * 0.001;
  }

  // Transition fluide de l'heure de la journée (Course du Soleil) et Jour <-> Nuit avec allumage en vague des lampadaires
  if (state.timeAnim) {
    const tp = Math.min(1, (now - state.timeAnim.startTime) / state.timeAnim.duration);
    const tk = 0.5 - 0.5 * Math.cos(Math.PI * tp);
    state.timeOfDay = state.timeAnim.fromHour + (state.timeAnim.toHour - state.timeAnim.fromHour) * tk;
    state.nightFactor =
      state.timeAnim.fromNight + (state.timeAnim.toNight - state.timeAnim.fromNight) * tk;
    syncTimeUi(state.timeOfDay, state.isNight);
    applyThemeLerp(state.nightFactor, state.timeOfDay);
    if (tp >= 1) {
      state.timeOfDay = state.timeAnim.toHour;
      state.nightFactor = state.timeAnim.toNight;
      syncTimeUi(state.timeOfDay, state.isNight);
      applyThemeLerp(state.nightFactor, state.timeOfDay);
      state.timeAnim = null;
    }
  } else if (state.nightAnim) {
    const np = Math.min(1, (now - state.nightAnim.startTime) / state.nightAnim.duration);
    const nk = 0.5 - 0.5 * Math.cos(Math.PI * np);
    state.nightFactor = state.nightAnim.from + (state.nightAnim.to - state.nightAnim.from) * nk;
    applyThemeLerp(state.nightFactor, state.timeOfDay);
    if (np >= 1) {
      state.nightFactor = state.nightAnim.to;
      applyThemeLerp(state.nightFactor, state.timeOfDay);
      state.nightAnim = null;
    }
  } else if (state.nightFactor > 0.01 && lightingCtrl && !state.reducedMotion) {
    lightingCtrl.applyNightFactor(state.nightFactor, now);
  }

  // Zoom cartographique carte de Thiès (thies40.svg) -> arrivée amortie et fondue dans l'orbite du jardin
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

    // Courbe C-infini en cosinus avec long coussin d'atterrissage (décélération progressive sur les 2 dernières secondes)
    const s = 0.5 - 0.5 * Math.cos(Math.PI * p);
    const kAlt = 1 - Math.pow(1 - s, 1.85);
    const kPan = 1 - Math.pow(1 - s, 2.2);

    const tgtX = state.satZoom.fromTarget.x * (1 - kPan) + state.satZoom.toTarget.x * kPan;
    const tgtZ = state.satZoom.fromTarget.z * (1 - kPan) + state.satZoom.toTarget.z * kPan;
    let curX = state.satZoom.fromPos.x * (1 - kPan) + state.satZoom.toPos.x * kPan;
    const curY =
      state.satZoom.fromPos.y *
      Math.pow(state.satZoom.toPos.y / state.satZoom.fromPos.y, kAlt);
    const fromOffZ = state.satZoom.fromPos.z - state.satZoom.fromTarget.z;
    const toOffZ = state.satZoom.toPos.z - state.satZoom.toTarget.z;
    let curZ = tgtZ + fromOffZ * Math.pow(toOffZ / fromOffZ, kAlt);

    // Fondu progressif dans l'orbite d'accueil dès p = 0.72 pour une arrivée sans aucune rupture de vitesse
    if (p > 0.72 && !state.reducedMotion) {
      if (!state.introOrbitStart) state.introOrbitStart = now;
      const orbitBlend = THREE.MathUtils.smoothstep(p, 0.72, 1.0);
      const t = (now - state.introOrbitStart) * 0.00016;
      curX += Math.sin(t) * 24 * orbitBlend;
      curZ += (-12 + Math.cos(t * 0.8) * 12) * orbitBlend;
    }

    camera.position.set(curX, curY, curZ);
    controls.target.set(tgtX, 0, tgtZ);
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
    if (p >= 0.78) {
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
    controls.target.set(...introCam.target);
    camera.lookAt(...introCam.target);
  } else if (state.fly) {
    const elapsed = now - state.fly.startTime;
    const p = Math.min(1, elapsed / state.fly.duration);
    const k = easeSmoothFlight(p);
    camera.position.lerpVectors(state.fly.fromPos, state.fly.toPos, k);
    if (state.fly.arcLift) {
      camera.position.y += Math.sin(Math.PI * k) * state.fly.arcLift;
    }
    controls.target.lerpVectors(state.fly.fromTarget, state.fly.toTarget, k);
    controls.update();
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
  if (waterCtrl) waterCtrl.updateWater(dt, now, state.nightFactor, camY);
  if (!state.reducedMotion) {
    if (trafficCtrl) trafficCtrl.update(dt, state.nightFactor, camY);
    if (pedestrianCtrl) pedestrianCtrl.update(dt, now, camY);
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

  // Nuages subtils, papillons et oiseaux en vue jour + ambiance sonore spatialisée
  if (atmosphereCtrl) {
    atmosphereCtrl.update(state.reducedMotion ? 0 : dt, now, state.nightFactor, camY);
  }
  if (audioCtrl && camera) {
    audioCtrl.update(now, camera.position, state.nightFactor);
  }

  // Étiquettes translucides, indice de distance et boussole (cadencés sur mobile pour éviter les reflows DOM)
  if (!state.isMobile || state.frameCount % 2 === 0) {
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
    audioCtrl = createParkAudioController({
      onStateChange: (on) => {
        state.audioEnabled = on;
        dom.btnAudio?.setAttribute("aria-pressed", String(on));
        dom.btnAudio?.setAttribute(
          "aria-label",
          on ? "Couper l'ambiance sonore du parc" : "Activer l'ambiance sonore du parc"
        );
      },
    });
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
