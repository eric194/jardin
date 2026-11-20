// Lecteur audio de l'enregistrement d'ambiance du parc (assets/audio/park-ambience.mp3)
// diffusé à volume normal lors de la visite du jardin.

export function createParkAudioController({ onStateChange } = {}) {
  let audioEl = null;
  let enabled = false;

  function ensureAudio() {
    if (audioEl) return audioEl;
    audioEl = new Audio("assets/audio/park-ambience.mp3");
    audioEl.loop = true;
    audioEl.preload = "auto";
    audioEl.volume = 0.82;
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
      // Volume normal (0.72 à 0.85 dans le jardin, atténuation douce uniquement à très haute altitude)
      const camY = cameraPos ? cameraPos.y : 126;
      const altScale = Math.max(0.45, Math.min(1, 1 - Math.max(0, camY - 260) / 900));
      const nightScale = 1 - nightFactor * 0.15;
      audioEl.volume = Math.max(0.32, Math.min(0.85, 0.82 * altScale * nightScale));
    },
  };
}
