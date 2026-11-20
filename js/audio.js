// Ambiance sonore procédurale Web Audio API du Jardin Grand Standing de Thiès
// (Zéro fichier audio externe : brise dans les arbres, jets d'eau spatialisés, chants d'oiseaux le jour, grillons subtils la nuit)

export function createParkAudioController({ onStateChange } = {}) {
  let ctx = null;
  let masterGain = null;
  let windFilter = null;
  let windGain = null;
  let waterGain = null;
  let nightCricketGain = null;
  let birdTimer = null;
  let enabled = false;
  let currentNight = 0;

  function makeNoiseBuffer(audioCtx, seconds = 3) {
    const len = audioCtx.sampleRate * seconds;
    const buf = audioCtx.createBuffer(1, len, audioCtx.sampleRate);
    const data = buf.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < len; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.045;
      b6 = white * 0.115926;
    }
    return buf;
  }

  function ensureContext() {
    if (ctx) return ctx;
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;

    ctx = new AudioCtx();
    masterGain = ctx.createGain();
    masterGain.gain.value = 0.0001;
    masterGain.connect(ctx.destination);

    const pinkBuf = makeNoiseBuffer(ctx, 4);

    // 1. Brise douce dans les feuillages
    const windSrc = ctx.createBufferSource();
    windSrc.buffer = pinkBuf;
    windSrc.loop = true;

    windFilter = ctx.createBiquadFilter();
    windFilter.type = "bandpass";
    windFilter.frequency.value = 340;
    windFilter.Q.value = 1.8;

    windGain = ctx.createGain();
    windGain.gain.value = 0.16;

    windSrc.connect(windFilter);
    windFilter.connect(windGain);
    windGain.connect(masterGain);
    windSrc.start();

    // 2. Murmure cristallin des jets d'eau et fontaines
    const waterSrc = ctx.createBufferSource();
    waterSrc.buffer = pinkBuf;
    waterSrc.loop = true;

    const waterBand = ctx.createBiquadFilter();
    waterBand.type = "bandpass";
    waterBand.frequency.value = 1350;
    waterBand.Q.value = 0.9;

    const waterHigh = ctx.createBiquadFilter();
    waterHigh.type = "highpass";
    waterHigh.frequency.value = 620;

    waterGain = ctx.createGain();
    waterGain.gain.value = 0.14;

    waterSrc.connect(waterBand);
    waterBand.connect(waterHigh);
    waterHigh.connect(waterGain);
    waterGain.connect(masterGain);
    waterSrc.start();

    // 3. Ambiance nocturne très douce (grillons lointains)
    const cricketOsc = ctx.createOscillator();
    cricketOsc.type = "sine";
    cricketOsc.frequency.value = 4150;

    const cricketLfo = ctx.createOscillator();
    cricketLfo.type = "sine";
    cricketLfo.frequency.value = 5.5;

    const lfoDepth = ctx.createGain();
    lfoDepth.gain.value = 0.012;

    nightCricketGain = ctx.createGain();
    nightCricketGain.gain.value = 0.0;

    cricketLfo.connect(lfoDepth);
    lfoDepth.connect(nightCricketGain.gain);
    cricketOsc.connect(nightCricketGain);
    nightCricketGain.connect(masterGain);

    cricketOsc.start();
    cricketLfo.start();

    scheduleNextBird();
    return ctx;
  }

  function playBirdChirp() {
    if (!ctx || !enabled || ctx.state !== "running") return;
    // Les oiseaux chantent en journée et s'apaisent la nuit
    if (currentNight > 0.65) return;

    const now = ctx.currentTime;
    const notes = 2 + Math.floor(Math.random() * 3);
    const baseFreq = 2100 + Math.random() * 1150;
    const dayScale = Math.max(0.15, 1 - currentNight * 1.3);

    for (let i = 0; i < notes; i++) {
      const t0 = now + i * (0.11 + Math.random() * 0.05);
      const dur = 0.075 + Math.random() * 0.045;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      const pan = ctx.createStereoPanner ? ctx.createStereoPanner() : null;

      osc.type = "sine";
      const fStart = baseFreq * (0.95 + Math.random() * 0.18);
      const fEnd = fStart * (1.12 + (Math.random() - 0.35) * 0.28);
      osc.frequency.setValueAtTime(fStart, t0);
      osc.frequency.exponentialRampToValueAtTime(Math.max(900, fEnd), t0 + dur);

      const peak = (0.022 + Math.random() * 0.016) * dayScale;
      g.gain.setValueAtTime(0.0001, t0);
      g.gain.linearRampToValueAtTime(peak, t0 + 0.014);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);

      if (pan) {
        pan.pan.value = (Math.random() - 0.5) * 1.4;
        osc.connect(g);
        g.connect(pan);
        pan.connect(masterGain);
      } else {
        osc.connect(g);
        g.connect(masterGain);
      }

      osc.start(t0);
      osc.stop(t0 + dur + 0.01);
    }
  }

  function scheduleNextBird() {
    if (birdTimer) clearTimeout(birdTimer);
    const delay = 1800 + Math.random() * 3400;
    birdTimer = setTimeout(() => {
      playBirdChirp();
      scheduleNextBird();
    }, delay);
  }

  async function setEnabled(next) {
    const target = Boolean(next);
    if (target) {
      enabled = true;
      if (onStateChange) onStateChange(enabled);
      const audioCtx = ensureContext();
      if (!audioCtx) return enabled;
      if (audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
      }
      const now = audioCtx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), now);
      masterGain.gain.linearRampToValueAtTime(0.85, now + 0.45);
      setTimeout(() => playBirdChirp(), 260);
    } else if (ctx && masterGain) {
      enabled = false;
      if (onStateChange) onStateChange(enabled);
      const now = ctx.currentTime;
      masterGain.gain.cancelScheduledValues(now);
      masterGain.gain.setValueAtTime(Math.max(0.0001, masterGain.gain.value), now);
      masterGain.gain.linearRampToValueAtTime(0.0001, now + 0.3);
    } else {
      enabled = false;
      if (onStateChange) onStateChange(enabled);
    }
    return enabled;
  }

  return {
    isEnabled: () => enabled,
    setEnabled,
    toggle: () => setEnabled(!enabled),
    update(now, cameraPos, nightFactor = 0) {
      currentNight = nightFactor;
      if (!ctx || !enabled || ctx.state !== "running") return;

      const tSec = now * 0.001;
      // Respiration naturelle de la brise dans les arbres
      if (windFilter && windGain) {
        windFilter.frequency.value = 310 + Math.sin(tSec * 0.37) * 85 + Math.cos(tSec * 0.83) * 40;
        windGain.gain.value = 0.14 + Math.sin(tSec * 0.42) * 0.04;
      }

      // Intensité de l'eau selon la proximité avec le bassin central (0, -1.6) et les fontaines Est/Ouest
      if (waterGain && cameraPos) {
        const dMain = Math.hypot(cameraPos.x - 0, cameraPos.z + 1.6);
        const dWest = Math.hypot(cameraPos.x + 82, cameraPos.z - 0.8);
        const dEast = Math.hypot(cameraPos.x - 160, cameraPos.z - 1.2);
        const minHorizontal = Math.min(dMain, dWest * 1.15, dEast * 1.15);
        const dist3D = Math.hypot(minHorizontal, Math.max(0, cameraPos.y - 2));
        const prox = Math.max(0.04, Math.min(1, 1 - (dist3D - 18) / 210));
        waterGain.gain.value = 0.04 + prox * 0.22;
      }

      if (nightCricketGain) {
        nightCricketGain.gain.value = nightFactor * 0.016;
      }
    },
  };
}
