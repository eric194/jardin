// Lecteur audio de l'enregistrement d'ambiance du parc (assets/audio/park-ambience.mp3)
// avec modulation spatiale directe selon le niveau de zoom (altitude de la caméra).

export function createParkAudioController({ onStateChange } = {}) {
  let audioEl = null;
  let enabled = false;

  function ensureAudio() {
    if (audioEl) return audioEl;
    audioEl = new Audio("assets/audio/park-ambience.mp3");
    audioEl.loop = true;
    audioEl.preload = "auto";
    audioEl.volume = 0.65;
    return audioEl;
  }

  async function setEnabled(next) {
    const target = Boolean(next);
    const el = ensureAudio();
    if (target) {
      enabled = true;
      if (onStateChange) onStateChange(enabled);
      try {
        await el.play();
      } catch (_) {}
    } else {
      enabled = false;
      if (onStateChange) onStateChange(enabled);
      try {
        el.pause();
      } catch (_) {}
    }
    return enabled;
  }

  return {
    isEnabled: () => enabled,
    setEnabled,
    toggle: () => setEnabled(!enabled),
    update(_now, cameraPos, nightFactor = 0) {
      if (!audioEl || !enabled) return;
      // Modulation continue selon le zoom (camY de ~18 m au sol jusqu'à ~650 m en vue éloignée) :
      // - Proche du sol (camY <= 25 m) : volume fort et immersif (~0.95)
      // - Vue d'ensemble (camY ~ 126 m) : volume modéré (~0.52)
      // - Vue plan / haute altitude (camY ~ 300 m) : volume discret (~0.18)
      // - Très haute altitude (camY >= 600 m) : quasi silencieux (~0.02)
      const camY = cameraPos ? cameraPos.y : 126;
      const t = Math.max(0, Math.min(1, (camY - 22) / 420));
      const zoomCurve = Math.pow(1 - t, 1.85);
      const nightScale = 1 - nightFactor * 0.15;
      const targetVol = (0.02 + 0.93 * zoomCurve) * nightScale;
      audioEl.volume = Math.max(0.02, Math.min(0.95, targetVol));
    },
  };
}
