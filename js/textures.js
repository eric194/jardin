import * as THREE from "three";

function makeCanvas(w, h) {
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  return [canvas, canvas.getContext("2d")];
}

function makeSeeded(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function configureRepeatingTexture(tex, rx, ry, maxAniso = 8) {
  tex.wrapS = THREE.RepeatWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.repeat.set(rx, ry);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = maxAniso;
  return tex;
}

export function createThiesMapTexture() {
  const size = 2048;
  const [canvas, ctx] = makeCanvas(size, size);

  const bgGrad = ctx.createRadialGradient(1024, 1024, 80, 1024, 1024, 1000);
  bgGrad.addColorStop(0, "#ede6da");
  bgGrad.addColorStop(0.82, "#eee8dd");
  bgGrad.addColorStop(1, "#f8f6f2");
  ctx.fillStyle = bgGrad;
  ctx.fillRect(0, 0, size, size);

  // Silhouette simplifiée centrée sur Thiès (1024, 1024) en repli local
  ctx.fillStyle = "#faf7f0";
  ctx.strokeStyle = "#8d7f6e";
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(1160, 290);
  ctx.lineTo(1320, 480);
  ctx.lineTo(1520, 420);
  ctx.lineTo(1810, 740);
  ctx.lineTo(1310, 810);
  ctx.lineTo(1360, 1180);
  ctx.lineTo(1230, 1520);
  ctx.lineTo(1110, 1810);
  ctx.lineTo(960, 1500);
  ctx.lineTo(790, 1220);
  ctx.lineTo(770, 860);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();

  // Axes vers Thiès (1024, 1024)
  ctx.strokeStyle = "#a64234";
  ctx.lineWidth = 4;
  ctx.beginPath();
  ctx.moveTo(520, 1070);
  ctx.quadraticCurveTo(800, 1090, 1024, 1024);
  ctx.lineTo(1740, 1040);
  ctx.stroke();

  ctx.strokeStyle = "#ba6d5e";
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(1024, 1024);
  ctx.lineTo(1280, 620);
  ctx.moveTo(1024, 1024);
  ctx.lineTo(980, 1460);
  ctx.stroke();

  // Point de Thiès sobre en (1024, 1024)
  ctx.fillStyle = "#a64234";
  ctx.beginPath();
  ctx.arc(1024, 1024, 6, 0, Math.PI * 2);
  ctx.fill();

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

export { createThiesMapTexture as createSenegalSatelliteTexture };

export function createGrassTexture(maxAniso = 8) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = "#c4ceb1";
  ctx.fillRect(0, 0, 256, 256);

  const rng = makeSeeded(9182);
  for (let i = 0; i < 1900; i++) {
    const x = rng() * 256;
    const y = rng() * 256;
    const shade = rng() > 0.5 ? "rgba(154, 171, 127, 0.34)" : "rgba(218, 226, 200, 0.3)";
    ctx.fillStyle = shade;
    ctx.fillRect(x, y, 2 + rng() * 2, 1 + rng() * 2);
  }
  // Traces légères de tonte
  ctx.fillStyle = "rgba(255, 255, 255, 0.045)";
  for (let x = 0; x < 256; x += 32) {
    ctx.fillRect(x, 0, 16, 256);
  }

  return configureRepeatingTexture(new THREE.CanvasTexture(canvas), 0.08, 0.08, maxAniso);
}

export function createStonePavingTexture(maxAniso = 8) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = "#efe7da";
  ctx.fillRect(0, 0, 256, 256);

  const rng = makeSeeded(4412);
  const step = 32;
  for (let row = 0; row < 8; row++) {
    const offset = (row % 2) * (step / 2);
    for (let col = -1; col < 9; col++) {
      const x = col * step + offset;
      const y = row * step;
      const tone = Math.floor((rng() - 0.5) * 10);
      ctx.fillStyle = `rgb(${238 + tone}, ${230 + tone}, ${217 + tone})`;
      ctx.fillRect(x + 1, y + 1, step - 2, step - 2);
    }
  }

  return configureRepeatingTexture(new THREE.CanvasTexture(canvas), 0.18, 0.18, maxAniso);
}

export function createRoadTexture(maxAniso = 8) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = "#e8e1d5";
  ctx.fillRect(0, 0, 256, 256);

  const rng = makeSeeded(7031);
  for (let i = 0; i < 1600; i++) {
    ctx.fillStyle = rng() > 0.5 ? "rgba(188, 180, 168, 0.25)" : "rgba(255, 255, 255, 0.2)";
    ctx.fillRect(rng() * 256, rng() * 256, 2, 2);
  }

  return configureRepeatingTexture(new THREE.CanvasTexture(canvas), 0.09, 0.09, maxAniso);
}

export function createSportTexture(maxAniso = 8) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = "#e3d6c4";
  ctx.fillRect(0, 0, 256, 256);

  const rng = makeSeeded(5519);
  for (let i = 0; i < 1500; i++) {
    ctx.fillStyle = rng() > 0.5 ? "rgba(198, 182, 162, 0.28)" : "rgba(248, 243, 236, 0.25)";
    ctx.fillRect(rng() * 256, rng() * 256, 2, 2);
  }

  return configureRepeatingTexture(new THREE.CanvasTexture(canvas), 0.14, 0.14, maxAniso);
}

export function createCantineTexture(maxAniso = 8) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = "#dfd2bd";
  ctx.fillRect(0, 0, 256, 256);

  // Ondulation discrète type tôle de conteneur architectural
  for (let x = 0; x < 256; x += 16) {
    ctx.fillStyle = "rgba(155, 140, 118, 0.14)";
    ctx.fillRect(x, 0, 7, 256);
    ctx.fillStyle = "rgba(255, 255, 255, 0.14)";
    ctx.fillRect(x + 7, 0, 3, 256);
  }

  return configureRepeatingTexture(new THREE.CanvasTexture(canvas), 0.25, 0.25, maxAniso);
}

export function createWaterNormalTexture(maxAniso = 8) {
  const [canvas, ctx] = makeCanvas(256, 256);
  ctx.fillStyle = "#c8dedd";
  ctx.fillRect(0, 0, 256, 256);

  const rng = makeSeeded(3088);
  for (let i = 0; i < 95; i++) {
    const cx = rng() * 256;
    const cy = rng() * 256;
    const r = 10 + rng() * 28;
    const grad = ctx.createRadialGradient(cx, cy, 1, cx, cy, r);
    grad.addColorStop(0, "rgba(255, 255, 255, 0.26)");
    grad.addColorStop(0.5, "rgba(182, 214, 214, 0.18)");
    grad.addColorStop(1, "rgba(200, 222, 221, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fill();
  }

  return configureRepeatingTexture(new THREE.CanvasTexture(canvas), 0.14, 0.14, maxAniso);
}

export function createSandTexture(maxAniso = 8) {
  const [canvas, ctx] = makeCanvas(512, 512);
  ctx.fillStyle = "#e8d6b2";
  ctx.fillRect(0, 0, 512, 512);

  // Ondulations douces de sable fin de plage balayé par le vent
  for (let y = 0; y < 512; y += 6) {
    const wave = Math.sin((y / 512) * Math.PI * 12) * 0.5 + 0.5;
    ctx.fillStyle = `rgba(216, 192, 148, ${0.06 + wave * 0.08})`;
    ctx.fillRect(0, y, 512, 3);
  }

  const rng = makeSeeded(7421);
  for (let i = 0; i < 6500; i++) {
    const x = rng() * 512;
    const y = rng() * 512;
    const bright = rng() > 0.45;
    ctx.fillStyle = bright ? "rgba(252, 245, 229, 0.34)" : "rgba(186, 160, 118, 0.24)";
    ctx.fillRect(x, y, 1.5, 1.5);
  }

  return configureRepeatingTexture(new THREE.CanvasTexture(canvas), 0.14, 0.14, maxAniso);
}

export function createLightPoolTexture() {
  const [canvas, ctx] = makeCanvas(128, 128);
  const grad = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  grad.addColorStop(0, "rgba(255, 224, 158, 0.92)");
  grad.addColorStop(0.35, "rgba(255, 206, 126, 0.44)");
  grad.addColorStop(0.72, "rgba(255, 188, 98, 0.12)");
  grad.addColorStop(1, "rgba(255, 180, 90, 0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, 128, 128);

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function createCloudTexture() {
  const [canvas, ctx] = makeCanvas(512, 256);
  const puffs = [
    [256, 128, 120, 0.34],
    [165, 138, 86, 0.28],
    [348, 136, 90, 0.28],
    [215, 102, 74, 0.26],
    [300, 104, 72, 0.24],
    [118, 150, 56, 0.18],
    [396, 148, 56, 0.18],
  ];
  for (const [x, y, r, a] of puffs) {
    const grad = ctx.createRadialGradient(x, y, r * 0.12, x, y, r);
    grad.addColorStop(0, `rgba(255, 253, 248, ${a})`);
    grad.addColorStop(0.55, `rgba(250, 247, 240, ${a * 0.48})`);
    grad.addColorStop(1, "rgba(250, 247, 240, 0)");
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export function applyWindShader(material, windUniforms, amplitude = 0.22) {
  material.onBeforeCompile = (shader) => {
    shader.uniforms.uWindTime = windUniforms.uWindTime;
    shader.uniforms.uWindStrength = windUniforms.uWindStrength;
    shader.uniforms.uWindAmp = { value: amplitude };

    shader.vertexShader = shader.vertexShader.replace(
      "#include <common>",
      `#include <common>
      uniform float uWindTime;
      uniform float uWindStrength;
      uniform float uWindAmp;`
    );

    shader.vertexShader = shader.vertexShader.replace(
      "#include <begin_vertex>",
      `#include <begin_vertex>
      #ifdef USE_INSTANCING
        float windPhase = instanceMatrix[3][0] * 0.11 + instanceMatrix[3][2] * 0.17;
      #else
        float windPhase = position.x * 0.21 + position.z * 0.19;
      #endif
      float windHeight = clamp((position.y + 0.8) * 0.45, 0.0, 1.4);
      transformed.x += sin(uWindTime * 1.85 + windPhase) * uWindStrength * uWindAmp * windHeight;
      transformed.z += cos(uWindTime * 1.38 + windPhase * 1.27) * uWindStrength * uWindAmp * 0.65 * windHeight;`
    );
  };
}
