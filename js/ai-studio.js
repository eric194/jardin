/**
 * Studio Capture & Prompt — Google Flow / Nano Banana 2 & Pro
 * Capture instantanément la vue 3D exacte (sans menus ni points rouges)
 * et génère le contexte architectural + description complète prêts à être
 * collés dans Google Flow / Nano Banana pour un rendu ultra-réaliste fidèle.
 */

const AMBIENCE_PRESETS = {
  auto: { label: "Auto (heure 3D)", prompt: "" },
  golden: {
    label: "Heure dorée · Thiès",
    prompt:
      "Warm golden hour late-afternoon sunlight in Thiès, Senegal, low amber sun rays casting long soft shadows, warm twilight gradient sky, architectural LEDs, portal sign, and cyan water jets softly illuminated.",
  },
  day: {
    label: "Plein jour ensoleillé",
    prompt:
      "Bright crisp West African sunny afternoon in Thiès, Senegal, clear blue sky with soft white cumulus clouds, crisp natural shadows, vibrant tropical foliage, sparkling turquoise water, ultra-sharp architectural photography.",
  },
  night: {
    label: "Nuit architecturale",
    prompt:
      "Dramatic architectural night photography in Thiès, Senegal, deep midnight indigo sky, glowing warm-gold backlit entrance sign 'JARDIN GRAND STANDING', radiant warm LED twisted portal arches, electric-cyan laminar arching water jets, recessed lawn uplights, and warm glowing light points embedded in timber furniture.",
  },
};

function describeTimeFromHour(hour) {
  if (hour >= 19.2 || hour < 6.4) return AMBIENCE_PRESETS.night.prompt;
  if ((hour >= 17.2 && hour < 19.2) || (hour >= 6.4 && hour < 8.4)) {
    return AMBIENCE_PRESETS.golden.prompt;
  }
  return AMBIENCE_PRESETS.day.prompt;
}

const SPACE_VISUAL_GLOSSARY = {
  "entree-principale":
    "semicircular white travertine Entrance Arcade crowned by the dark navy-blue and gold portal sign reading EXACTLY 'JARDIN GRAND STANDING' (no subtitle), with a semicircular welcome fountain on the warm sandstone plaza",
  "bassin-central":
    "large turquoise Central Fountain Basin with foaming vertical water jets, flanked on its NW and NE diagonal walkways by black sculptural twisted geometric portal arches with warm-white inner LED strips, plus curved twin water channels with 12 glowing electric-cyan laminar arching water jets",
  "theatre-verdure":
    "curved amphitheater lawn steps and modern white architectural kiosks/pavilion buildings",
  "piscine-adulte":
    "open-air turquoise adult lap swimming pool with lane lines, submerged steps, stainless steel ladders, and warm sandstone sun decks",
  "piscine-enfant":
    "shallow turquoise children's paddling pool with wide safe steps beside the main pool",
  "arts-martiaux":
    "outdoor martial arts wooden-framed tatami mat with white competition circle on slate-grey EPDM surface",
  "fitness-musculation":
    "outdoor street-workout and calisthenics fitness park on colorful EPDM pads (blue, terracotta, green, ochre) with pull-up rig, monkey bars, dip bars, abs benches, and jump boxes",
  "fitness-senior":
    "gentle senior outdoor fitness plaza on sage-green, ochre, and turquoise EPDM circles with Tai-Chi shoulder wheels, pedal stations, and stretching bars",
  "jeux-enfants-ouest":
    "hard-surface children's playground on bright EPDM circles with climbing dome, play tower and slide, swings, carousel, seesaw, and hopscotch",
  "jeux-enfants-est":
    "hard-surface children's playground on bright EPDM circles with geodesic climbing dome, twin swings, carousel, seesaw, and hopscotch",
  "jeux-enfants-sable":
    "large golden-sand children's adventure playground featuring a twin-tower wooden castle fort (red and ochre pyramid roofs, suspension bridge, twin slides), a wooden pirate ship with sail, a rope climbing pyramid, and wooden swings",
  "petanque-dames":
    "senior leisure area on slate-grey surface with 2 timber-framed compacted gravel pétanque courts (boules, scoreboards) and 5 checkerboard checkers/chess tables with stools",
  football:
    "professional striped green synthetic-turf football pitch (50×30m) with crisp white pitch markings and full netted goals",
  sprint:
    "6-lane terracotta-red athletic Tartan sprint track with white lane lines",
  basketball:
    "sunken outdoor pro acrylic basketball court (-0.35m) with steel-blue perimeter, warm ochre court floor, terracotta painted keys and center circle, and 2 hoops",
  "beach-sports":
    "sunken golden-sand beach soccer, beach handball, and beach volleyball arena (-0.35m) with goals and central net, linked to the basketball court by a stepped light-stone central grandstand",
  tennis:
    "diagonal US Open-style acrylic tennis court (blue playing area, green outer surround, crisp white lines and net)",
  padel:
    "diagonal blue acrylic padel court enclosed by transparent panoramic glass walls and net",
  "jardins-arbustes":
    "lush Senegalese tropical landscaped gardens (coconut palms, flamboyant trees, cypresses, flowering shrubs, ferns) with sculptural slatted-timber shade pavilions (oculus pergola, tensile white sail deck, wave-arch timber canopy, umbrella kiosks) and organic slatted-wood planter-benches",
  "fontaine-est":
    "circular East ornamental water fountain surrounded by sandstone plazas and shaded timber pavilions",
  "pique-nique":
    "shaded outdoor family picnic hall and landscaped rest area",
  "piste-cyclable":
    "perimeter terracotta-red Tartan running and cycling track with white center dashes and low white-and-anthracite fence",
  "cantines-parking":
    "North commercial boulevard with 47 modern container cantines (striped terracotta/ochre/teal awnings, timber counters, café umbrellas, rooftop solar panels) and a 192-space tree-shaded parking lot with solar pergolas and access gates",
};

function buildSpatialContext(
  camPos,
  targetPos,
  hour,
  spaces,
  ambienceKey,
  extraNotes,
  lang = "en",
  twoPointEye = false,
  facing = "North",
  visibleSpaces = []
) {
  const camY = camPos[1];

  // Si on a les espaces réellement visibles dans le frustum, on les utilise en priorité !
  const inFrame = (visibleSpaces || []).slice(0, 7);
  let nearbySummary = inFrame.slice(0, 4).map((v) => v.title).join(", ");

  if (!inFrame.length) {
    const tx = targetPos[0];
    const tz = targetPos[1];
    const fallback = (spaces || [])
      .map((sp) => ({
        id: sp.id,
        title: sp.title,
        category: sp.category,
        horiz: "center",
        depth: "midground",
        dist: Math.round(Math.hypot((sp.pos?.[0] || 0) - tx, (sp.pos?.[1] || 0) - tz)),
      }))
      .sort((a, b) => a.dist - b.dist)
      .slice(0, 4);
    inFrame.push(...fallback);
    nearbySummary = fallback.map((v) => v.title).join(", ");
  }

  // Construire l'inventaire visuel exact de ce qui est dans CETTE image (position dans le cadre + description réelle)
  const frameInventory = inFrame.map((v) => {
    const detail = SPACE_VISUAL_GLOSSARY[v.id];
    const loc = `${v.depth}, ${v.horiz}`;
    return detail
      ? `- [${loc}] ${v.title}: ${detail}.`
      : `- [${loc}] ${v.title} (${v.category}).`;
  });

  // Décrire automatiquement ce qu'on voit à l'arrière-plan selon la direction du regard
  const backdropByDir = {
    North:
      "Beyond the park fence to the North: the main urban avenue of Thiès with natural West African traffic, the row of 47 container commercial cantines with colorful awnings, the tree-shaded public parking lot, and the sunlit sand-colored buildings of Thiès city stretching to the horizon.",
    Northeast:
      "Beyond the park to the Northeast: the North avenue, container commercial cantines, shaded parking lot, and low-rise urban neighborhoods of Thiès, Senegal.",
    Northwest:
      "Beyond the park to the Northwest: the North urban avenue, commercial cantines, parking lot, and sunlit urban architecture of Thiès, Senegal.",
    South:
      "Beyond the park fence to the South: a quiet residential street lined with tropical trees and low-rise sand-colored Senegalese buildings of Thiès under the open sky.",
    Southeast:
      "Beyond the park to the Southeast: lush park gardens continuing East and residential buildings of Thiès in the distance.",
    Southwest:
      "Beyond the park to the Southwest: the West sports complex, palm trees, and sunlit residential buildings of Thiès in the distance.",
    East:
      "Looking East along the 500-meter linear park: continuous landscaped tropical gardens, sculptural timber shade pavilions, stone plazas, and the city of Thiès on the horizon.",
    West:
      "Looking West along the 500-meter linear park: pools, central fountain basin, sports courts, and the city of Thiès on the horizon.",
  };

  const camDescEn = twoPointEye
    ? "strict 2-point architectural perspective photograph taken at human eye level (1.70m standing height, perfectly level horizon, strictly parallel vertical lines, 24mm tilt-shift lens)"
    : camY < 4.5
    ? "eye-level pedestrian architectural photograph (1.70m height, 24mm lens)"
    : camY < 32
    ? "elevated architectural drone photograph (low-altitude perspective)"
    : "high-altitude aerial masterplan architectural photograph";

  const lightingEn =
    ambienceKey === "auto"
      ? describeTimeFromHour(hour)
      : AMBIENCE_PRESETS[ambienceKey]?.prompt || describeTimeFromHour(hour);

  const promptEn = [
    `Convert this exact 3D architectural model capture of "Jardin Grand Standing de Thiès" (a modern 500m × 50m flagship urban leisure park in Thiès, Senegal) into a breathtaking, ultra-realistic ${camDescEn}.`,
    "",
    "1. ABSOLUTE GEOMETRIC & CAMERA FIDELITY (DO NOT ALTER LAYOUT):",
    "- Keep the EXACT same camera viewpoint, framing, horizon line, proportions, and spatial position of EVERY single structure, path, basin, pavilion, playground, sport court, tree, and bench visible in the attached 3D reference capture.",
    "- Do NOT invent extra buildings inside the park, do NOT move objects, and preserve exact spelling on any visible signage: the entrance portal sign MUST read EXACTLY 'JARDIN GRAND STANDING' (never misspelled, no subtitle).",
    "",
    `2. EXACT ELEMENTS VISIBLE IN THIS CAPTURE (camera facing ${facing}, altitude ${camPos[1]}m):`,
    ...frameInventory,
    `- [distant background] ${backdropByDir[facing] || backdropByDir.North}`,
    "",
    "3. PHOTOREALISTIC MATERIALS & ARCHITECTURAL DETAILS (ZERO CGI / ZERO TOY LOOK):",
    "- Clearly distinct ground surfaces: smooth cool mineral-grey concrete walkways vs. warm golden-sandstone tiled plazas with natural stone joints, terracotta-red athletic Tartan running track, fine golden beach sand, lush dense tropical grass lawns.",
    "- Realistic natural materials: grained cedar/iroko wood slats on pavilions and planter-benches, matte white travertine architectural concrete, brushed anthracite steel, crystal-clear turquoise water with natural ripples, caustics, and fine water mist from the fountains.",
    "- Lighting & furniture details: NO tall streetlamps on interior park walkways; warm recessed LED spots in lawns, low garden bollards at lawn edges, and tiny warm light points flush on benches and pavilions.",
    "- Authentic Senegalese life & flora: realistic tropical coconut palms, flamboyant trees, lush ferns and shrubs, and naturally scaled Senegalese visitors and families (1.70m scale) strolling, relaxing, and playing.",
    "",
    `4. LIGHTING & ATMOSPHERE: ${lightingEn}`,
    extraNotes?.trim() ? `\n5. EXTRA DIRECTION: ${extraNotes.trim()}` : "",
    "",
    "PHOTOGRAPHY STYLE: Real architectural photograph shot on a full-frame camera, natural West African daylight/twilight dynamic range, rich micro-textures, crisp depth, completely indistinguishable from a real photograph taken in Thiès, Senegal.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    prompt: promptEn,
    nearbySummary: nearbySummary || "Jardin Grand Standing de Thiès",
  };
}

const STORAGE_KEY_PRESETS = "jgs_thies_camera_presets_v1";

const DEFAULT_PRESETS = [
  {
    id: "entree-eye",
    name: "1. Entrée (1,70 m · 2 pts)",
    pos: [-11.5, 2.05, -36.5],
    target: [0, 2.05, -18.0],
    hour: 18.2,
    twoPoint: true,
  },
  {
    id: "arches-nuit",
    name: "2. Arches LED & Bassin (Nuit)",
    pos: [10.5, 2.05, -13.2],
    target: [22.0, 2.05, -1.6],
    hour: 21.5,
    twoPoint: true,
  },
  {
    id: "drone-centre",
    name: "3. Drone Centre & Piscines",
    pos: [18.0, 22.0, 38.0],
    target: [-6.0, 0.5, -4.0],
    hour: 15.0,
    twoPoint: false,
  },
  {
    id: "pole-sportif",
    name: "4. Pôle Sportif Ouest",
    pos: [-182.0, 34.0, 44.0],
    target: [-182.0, 0.5, -1.0],
    hour: 14.5,
    twoPoint: false,
  },
  {
    id: "jardins-est",
    name: "5. Jardins Est & Jeux Sable",
    pos: [64.0, 24.0, 36.0],
    target: [56.0, 0.5, 4.0],
    hour: 16.5,
    twoPoint: false,
  },
  {
    id: "cantines-parking",
    name: "6. Cantines & Parking Nord",
    pos: [72.0, 18.0, -28.0],
    target: [76.0, 0.5, -52.0],
    hour: 14.5,
    twoPoint: false,
  },
];

function loadPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_PRESETS);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length) return parsed;
    }
  } catch (_) {}
  return DEFAULT_PRESETS.map((p) => ({ ...p, pos: [...p.pos], target: [...p.target] }));
}

function savePresets(list) {
  try {
    localStorage.setItem(STORAGE_KEY_PRESETS, JSON.stringify(list));
  } catch (_) {}
}

export function createAiStudioController({
  captureClean3D,
  applyCameraPreset,
  getCurrentCameraState,
  applyEyeLevelView,
  getViewSnapshot,
  onOpenChange,
}) {
  const modal = document.getElementById("ai-studio-modal");
  if (!modal) return null;

  let isOpen = false;
  let lastCaptureUrl = "";
  let currentAmbience = "auto";
  let currentLang = "en";
  let currentPerspective = "two-point";
  let presets = loadPresets();
  let activePresetId = null;

  function renderModalSkeleton() {
    modal.innerHTML = `
      <div class="ai-studio-shell" role="document">
        <header class="ai-studio-head">
          <div>
            <p class="ai-studio-kicker">CAPTURE HD 16:9 · 1920×1080</p>
            <h2 class="ai-studio-title">Capture & description de la vue</h2>
          </div>
          <div class="ai-studio-head-actions">
            <button type="button" id="ai-btn-recapture" class="ai-sec-btn" title="Refaire la capture">
              Recapturer
            </button>
            <button type="button" id="ai-btn-close" class="icon-btn" aria-label="Fermer la fenêtre de capture">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        <div class="ai-presets-bar">
          <div class="ai-presets-head">
            <span class="ai-label">Angles enregistrés</span>
            <div class="ai-presets-tools">
              <button type="button" id="ai-preset-add" class="ai-mini-btn">+ Enregistrer</button>
              <button type="button" id="ai-preset-update" class="ai-mini-btn" hidden>Mettre à jour</button>
              <button type="button" id="ai-preset-rename" class="ai-mini-btn" hidden>Renommer</button>
              <button type="button" id="ai-preset-delete" class="ai-mini-btn ai-mini-btn--danger" hidden>Supprimer</button>
              <button type="button" id="ai-preset-reset" class="ai-mini-btn">Réinitialiser</button>
            </div>
          </div>
          <div id="ai-presets-list" class="ai-pills"></div>
        </div>

        <div class="ai-studio-grid">
          <div class="ai-stage-col">
            <div class="ai-stage" id="ai-stage">
              <img id="ai-img-before" class="ai-img-base" alt="Capture 3D HD de la maquette" />
              <span id="ai-badge-mode" class="ai-badge ai-badge-left">1920×1080 · Vue personne 1,70 m</span>
            </div>

            <div class="ai-stage-bar">
              <span id="ai-context-chip" class="ai-context-chip">Zone cadrée…</span>
              <div class="ai-download-group">
                <button type="button" id="ai-btn-eye-nav" class="ai-sec-btn" title="Descendre la caméra à hauteur d'yeux (1,70 m)">
                  Vue 1,70 m
                </button>
                <button type="button" id="ai-btn-copy-img" class="ai-sec-btn">
                  Copier l'image
                </button>
                <a id="ai-dl-3d" class="ai-pri-btn" download="jardin-grand-standing-thies-capture.png">
                  Télécharger PNG
                </a>
              </div>
            </div>
          </div>

          <aside class="ai-controls-col">
            <div class="ai-field">
              <label class="ai-label">Perspective</label>
              <div class="ai-pills" id="ai-persp-pills">
                <button type="button" class="ai-pill is-active" data-persp="two-point">Vue personne · 2 pts</button>
                <button type="button" class="ai-pill" data-persp="current">Angle actuel</button>
              </div>
            </div>

            <div class="ai-field">
              <label class="ai-label" for="ai-prompt-preview">Description & contexte de la vue</label>
              <textarea id="ai-prompt-preview" class="ai-textarea ai-textarea--code" rows="11"></textarea>
            </div>

            <p id="ai-status" class="ai-status" role="status" aria-live="polite"></p>

            <div class="ai-action-row">
              <button type="button" id="ai-btn-copy-prompt" class="ai-gen-btn">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <rect x="6" y="6" width="9" height="9" rx="1.6" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M12 6V4.6A1.6 1.6 0 0 0 10.4 3H4.6A1.6 1.6 0 0 0 3 4.6v5.8A1.6 1.6 0 0 0 4.6 12H6" stroke="currentColor" stroke-width="1.4"/>
                </svg>
                <span>Copier la description</span>
              </button>
            </div>
          </aside>
        </div>
      </div>
    `;

    modal.querySelector("#ai-btn-close").addEventListener("click", close);
    modal.addEventListener("click", (e) => {
      if (e.target === modal) close();
    });
    modal.querySelector("#ai-btn-recapture").addEventListener("click", refreshCapture);
    modal.querySelector("#ai-btn-eye-nav")?.addEventListener("click", () => {
      applyEyeLevelView?.();
      close();
    });

    modal.querySelectorAll("#ai-persp-pills .ai-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentPerspective = btn.dataset.persp;
        modal.querySelectorAll("#ai-persp-pills .ai-pill").forEach((b) =>
          b.classList.toggle("is-active", b === btn)
        );
        refreshCapture();
      });
    });

    // Gestion complète des angles prédéfinis (ajouter, modifier, renommer, supprimer, réinitialiser)
    modal.querySelector("#ai-preset-add")?.addEventListener("click", () => {
      const cam = getCurrentCameraState?.();
      if (!cam) return;
      const defaultName = `Angle ${presets.length + 1}`;
      const name = window.prompt("Nom du nouvel angle photo :", defaultName);
      if (!name || !name.trim()) return;
      const newPreset = {
        id: `custom-${Date.now()}`,
        name: name.trim(),
        pos: cam.pos,
        target: cam.target,
        hour: cam.hour,
        twoPoint: currentPerspective === "two-point",
      };
      presets.push(newPreset);
      activePresetId = newPreset.id;
      savePresets(presets);
      renderPresetsList();
      setStatus(`Angle « ${newPreset.name} » enregistré dans vos favoris.`);
    });

    modal.querySelector("#ai-preset-update")?.addEventListener("click", () => {
      const idx = presets.findIndex((p) => p.id === activePresetId);
      const cam = getCurrentCameraState?.();
      if (idx < 0 || !cam) return;
      presets[idx] = {
        ...presets[idx],
        pos: cam.pos,
        target: cam.target,
        hour: cam.hour,
        twoPoint: currentPerspective === "two-point",
      };
      savePresets(presets);
      renderPresetsList();
      setStatus(`Angle « ${presets[idx].name} » mis à jour avec votre cadrage actuel.`);
    });

    modal.querySelector("#ai-preset-rename")?.addEventListener("click", () => {
      const idx = presets.findIndex((p) => p.id === activePresetId);
      if (idx < 0) return;
      const name = window.prompt("Nouveau nom de cet angle :", presets[idx].name);
      if (!name || !name.trim()) return;
      presets[idx].name = name.trim();
      savePresets(presets);
      renderPresetsList();
      setStatus(`Angle renommé en « ${presets[idx].name} ».`);
    });

    modal.querySelector("#ai-preset-delete")?.addEventListener("click", () => {
      const idx = presets.findIndex((p) => p.id === activePresetId);
      if (idx < 0) return;
      const removed = presets[idx].name;
      presets.splice(idx, 1);
      activePresetId = null;
      savePresets(presets);
      renderPresetsList();
      setStatus(`Angle « ${removed} » supprimé.`);
    });

    modal.querySelector("#ai-preset-reset")?.addEventListener("click", () => {
      presets = DEFAULT_PRESETS.map((p) => ({ ...p, pos: [...p.pos], target: [...p.target] }));
      activePresetId = null;
      savePresets(presets);
      renderPresetsList();
      setStatus("Les 6 angles par défaut ont été restaurés.");
    });

    renderPresetsList();

    modal.querySelector("#ai-btn-copy-prompt").addEventListener("click", async () => {
      const txt = modal.querySelector("#ai-prompt-preview")?.value || "";
      try {
        await navigator.clipboard.writeText(txt);
        setStatus("Description copiée dans le presse-papiers.");
      } catch (_) {
        const area = modal.querySelector("#ai-prompt-preview");
        area?.select();
        document.execCommand("copy");
        setStatus("Description copiée dans le presse-papiers.");
      }
    });

    modal.querySelector("#ai-btn-copy-img").addEventListener("click", async () => {
      if (!lastCaptureUrl) return;
      try {
        const res = await fetch(lastCaptureUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setStatus("Image copiée dans le presse-papiers.");
      } catch (_) {
        setStatus("Copie directe non supportée : cliquez sur « Télécharger PNG ».", true);
      }
    });
  }

  function renderPresetsList() {
    const listEl = modal.querySelector("#ai-presets-list");
    if (!listEl) return;
    listEl.innerHTML = "";
    presets.forEach((p) => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = `ai-pill${p.id === activePresetId ? " is-active" : ""}`;
      btn.textContent = p.name;
      btn.addEventListener("click", () => {
        activePresetId = p.id;
        currentPerspective = p.twoPoint ? "two-point" : "current";
        modal.querySelectorAll("#ai-persp-pills .ai-pill").forEach((b) =>
          b.classList.toggle("is-active", b.dataset.persp === currentPerspective)
        );
        applyCameraPreset?.(p);
        renderPresetsList();
        refreshCapture();
        setStatus(`Angle « ${p.name} » capturé en 1920×1080 (16:9 HD).`);
      });
      listEl.appendChild(btn);
    });
    const hasSel = Boolean(activePresetId && presets.some((p) => p.id === activePresetId));
    const updBtn = modal.querySelector("#ai-preset-update");
    const renBtn = modal.querySelector("#ai-preset-rename");
    const delBtn = modal.querySelector("#ai-preset-delete");
    if (updBtn) updBtn.hidden = !hasSel;
    if (renBtn) renBtn.hidden = !hasSel;
    if (delBtn) delBtn.hidden = !hasSel;
  }

  function updatePromptPreview() {
    const isTwoPoint = currentPerspective === "two-point";
    const snap = getViewSnapshot(isTwoPoint);
    const { prompt, nearbySummary } = buildSpatialContext(
      snap.camPos,
      snap.targetPos,
      snap.hour,
      snap.spaces,
      currentAmbience,
      "",
      currentLang,
      isTwoPoint,
      snap.facing,
      snap.visibleSpaces
    );
    const preview = modal.querySelector("#ai-prompt-preview");
    const chip = modal.querySelector("#ai-context-chip");
    const badge = modal.querySelector("#ai-badge-mode");
    if (preview) preview.value = prompt;
    if (chip) chip.textContent = `Zone cadrée : ${nearbySummary}`;
    if (badge) {
      badge.textContent = isTwoPoint
        ? "1920×1080 (16:9) · Vue personne 1,70 m (2 pts de fuite)"
        : "1920×1080 (16:9) · Angle actuel exact";
    }
  }

  function setStatus(msg, isError = false) {
    const el = modal.querySelector("#ai-status");
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle("is-error", Boolean(isError));
  }

  function refreshCapture() {
    const isTwoPoint = currentPerspective === "two-point";
    const dataUrl = captureClean3D({ twoPointEye: isTwoPoint, eyeHeight: 2.05, fixed16x9: true });
    if (!dataUrl) {
      setStatus("Impossible de capturer la scène 3D.", true);
      return;
    }
    lastCaptureUrl = dataUrl;
    const beforeImg = modal.querySelector("#ai-img-before");
    const dl3d = modal.querySelector("#ai-dl-3d");
    if (beforeImg) beforeImg.src = dataUrl;
    if (dl3d) dl3d.href = dataUrl;
    updatePromptPreview();
    setStatus("Capture 1920×1080 prête.");
  }

  function open() {
    if (!modal.innerHTML.trim()) renderModalSkeleton();
    isOpen = true;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    refreshCapture();
    onOpenChange?.(true);
  }

  function close() {
    isOpen = false;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    onOpenChange?.(false);
  }

  return {
    open,
    close,
    isOpen: () => isOpen,
  };
}
