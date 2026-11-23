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

function buildSpatialContext(
  camPos,
  targetPos,
  hour,
  spaces,
  ambienceKey,
  extraNotes,
  lang = "en",
  twoPointEye = false
) {
  const tx = targetPos[0];
  const tz = targetPos[1];
  const camY = camPos[1];

  const ranked = (spaces || [])
    .map((sp) => ({
      sp,
      d: Math.hypot((sp.pos?.[0] || 0) - tx, (sp.pos?.[1] || 0) - tz),
    }))
    .sort((a, b) => a.d - b.d)
    .slice(0, 4);

  const nearbySpaces = ranked.filter((r) => r.d < 95).map((r) => r.sp);
  const nearbyNames = nearbySpaces.map((s) => `${s.title} (${s.category})`).join(", ");

  const featuresEn = [];
  const featuresFr = [];

  if (tx > -48 && tx < 48 && tz > -34 && tz < 26) {
    featuresEn.push(
      "the semicircular white travertine Entrance Arcade crowned by the dark navy-bronze portal sign spanning between its two front wings with warm backlit gold-trimmed letters reading EXACTLY 'JARDIN GRAND STANDING' (no subtitle)",
      "the semicircular welcome fountain on the warm golden sandstone tiled entrance esplanade",
      "the large reflective turquoise Central Fountain Basin (Bassin Central) with foaming vertical water jets",
      "the two diagonal walkways lined with sculptural black twisted geometric portal arches with warm-white LED strips inside their frames",
      "the curved twin water channels with 12 glowing electric-cyan laminar arching water jets jumping cleanly from one channel to the other"
    );
    featuresFr.push(
      "l'arcade d'entrée semi-circulaire en travertin blanc surmontée du grand portique lumineux bleu nuit et or affichant exactement « JARDIN GRAND STANDING » (sans sous-titre)",
      "la fontaine d'accueil semi-circulaire sur le parvis dallé en pierre dorée",
      "le grand Bassin Central turquoise animé de jets d'eau verticaux",
      "les deux allées diagonales bordées d'arches géométriques noires torsadées à éclairage LED blanc chaud intégré",
      "les deux canaux courbes reliés par 12 jets d'eau laminaires en arc bleu cyan lumineux"
    );
  }
  if (tx <= -88) {
    featuresEn.push(
      "the West Sports Complex featuring the striped synthetic-turf football pitch with crisp white lines, the terracotta-red athletic Tartan sprint track, the sunken two-tone outdoor acrylic basketball court with terracotta keys, the US Open-style blue/green acrylic tennis court, the glass-walled blue padel court, and the sunken golden-sand beach soccer/volleyball arena"
    );
    featuresFr.push(
      "le Pôle Sportif Ouest : terrain de football en gazon synthétique rayé, piste de sprint en Tartan rouge-terracotta, terrain de basket enterré en résine bicolore (bleu/ocre/raquettes terracotta), court de tennis bleu/vert, terrain de padel vitré et arène de beach soccer/volley en sable doré"
    );
  }
  if (tx > -100 && tx < -22) {
    featuresEn.push(
      "the open-air adult lap pool and children's swimming pool with crystal turquoise water, outdoor martial arts tatami platform, and the street-workout calisthenics fitness zone on EPDM pads"
    );
    featuresFr.push(
      "les piscines adulte et enfant à eau turquoise cristalline, le tatami extérieur d'arts martiaux et l'aire de fitness & street-workout sur dalles EPDM"
    );
  }
  if (tx >= 22) {
    featuresEn.push(
      "the East landscaped gardens (Jardin Planté) lush with Senegalese tropical trees, coconut palms, cypresses, sculptural slatted-timber shade pavilions (oculus tree-pergola, tensile sail deck, wave-arch timber canopy, umbrella kiosks), modular timber planter-benches with tropical ferns, golden-sand children's playground with twin-tower wooden castle fort and pirate ship, senior gentle-fitness station, and framed gravel pétanque & checkers courts"
    );
    featuresFr.push(
      "les jardins paysagers Est (Jardin Planté) densément arborés de palmiers et d'essences tropicales, les pavillons d'ombrage en bois sculpté (pergola oculus, voile tendue, arche ondulante, kiosques parapluie), les bancs-jardinières bois avec fougères, l'aire de jeux enfants sur sable (château en bois à double tour, galion pirate, pyramide de cordes), le fitness 3e âge et les terrains de pétanque & tables de dames"
    );
  }
  if (tz < -28) {
    featuresEn.push(
      "the North public parking boulevard lined with 47 modern container commercial cantines featuring striped terracotta/ochre/teal awnings, timber service counters, café umbrellas, solar parking pergolas, EV charging bollards, and access gates"
    );
    featuresFr.push(
      "le parking public Nord et ses 47 cantines commerciales en conteneurs aménagés avec auvents rayés (terracotta, ocre, turquoise), comptoirs bois, terrasses à parasols, pergolas solaires, bornes de recharge et guérites d'accès"
    );
  }

  const camDescEn = twoPointEye
    ? "strict 2-point architectural perspective photograph taken at human eye level (1.70m standing height, perfectly level horizon, strictly parallel vertical lines)"
    : camY < 4.5
    ? "eye-level pedestrian architectural photograph"
    : camY < 32
    ? "elevated architectural perspective photograph (drone / terrace height)"
    : "high-altitude aerial masterplan architectural photograph";

  const camDescFr = twoPointEye
    ? "photographie architecturale en perspective stricte à 2 points de fuite prise à hauteur d'yeux d'une personne debout (1,70 m, horizon parfaitement horizontal, verticales 100 % parallèles)"
    : camY < 4.5
    ? "photographie architecturale à hauteur d'homme"
    : camY < 32
    ? "photographie architecturale en perspective surélevée (vue drone basse altitude)"
    : "photographie aérienne architecturale d'ensemble";

  const lightingEn =
    ambienceKey === "auto"
      ? describeTimeFromHour(hour)
      : AMBIENCE_PRESETS[ambienceKey]?.prompt || describeTimeFromHour(hour);

  if (lang === "fr") {
    const promptFr = [
      `Transforme cette capture 3D du « Jardin Grand Standing de Thiès » (parc urbain et de loisirs de 500 m × 50 m au cœur de Thiès, Sénégal) en une ${camDescFr} ultra-réaliste de qualité concours d'architecture.`,
      "",
      "FIDÉLITÉ GÉOMÉTRIQUE STRICTE À LA CAPTURE :",
      "- Conserve EXACTEMENT le même angle de caméra, la ligne d'horizon, le cadrage, les proportions et l'emplacement de chaque bâtiment, toiture, allée, bassin, arbre, pavillon, terrain de sport et mobilier présents sur l'image de référence.",
      "- N'invente aucun nouveau bâtiment, ne déplace aucun élément et respecte strictement les textes : si l'enseigne d'entrée est visible, elle doit afficher exactement « JARDIN GRAND STANDING ».",
      "",
      "CONTEXTE DU SITE ET MATÉRIAUX (THIÈS, SÉNÉGAL) :",
      nearbyNames ? `- Espaces principaux dans le cadre : ${nearbyNames}.` : "- Vue d'ensemble du Jardin Grand Standing de Thiès.",
      featuresFr.length ? `- Éléments architecturaux à sublimer de manière photoréaliste : ${featuresFr.join(" ; ")}.` : "",
      "- Sols réels : allées de circulation en béton minéral gris clair bien distinctes des placettes dallées en pierre dorée/grès chaud, piste périphérique en Tartan rouge-terracotta, sable fin doré sur les zones plage/jeux, pelouses tropicales denses.",
      "- Vie et atmosphère : végétation tropicale sénégalaise réaliste (palmiers cocotiers, flamboyants, arbustes, fougères), eau réelle avec reflets, caustiques et brume fine sur les jets, quelques visiteurs et familles sénégalaises à l'échelle naturelle profitant du parc.",
      "",
      `AMBIANCE LUMINEUSE : ${lightingEn}`,
      extraNotes?.trim() ? `\nINSTRUCTIONS COMPLÉMENTAIRES : ${extraNotes.trim()}` : "",
      "",
      "STYLE PHOTO : Prise de vue réelle au boîtier plein format objectif 24mm tilt-shift, textures micro-détaillées (lames de bois, travertin, acier brossé, reflets naturels), aucun aspect plastique 3D/CGI.",
    ]
      .filter(Boolean)
      .join("\n");

    return {
      prompt: promptFr,
      nearbySummary: nearbyNames || "Vue d'ensemble · Jardin Grand Standing de Thiès",
    };
  }

  const promptEn = [
    `Transform this 3D architectural model capture of "Jardin Grand Standing de Thiès" (a flagship 500m × 50m urban leisure park in Thiès, Senegal) into an ultra-realistic, award-winning ${camDescEn}.`,
    "",
    "STRICT GEOMETRIC & PERSPECTIVE FIDELITY:",
    "- Preserve the EXACT camera angle, horizon line, composition, proportions, and spatial placement of every single building, canopy, walkway, basin, tree, pavilion, sport court, and piece of furniture shown in the reference 3D capture.",
    "- Do NOT invent extra buildings, do NOT relocate structures, and do NOT alter any signage text. If the entrance sign is visible, it MUST read exactly 'JARDIN GRAND STANDING'.",
    "",
    "SITE & ARCHITECTURAL CONTEXT (THIÈS, SENEGAL):",
    nearbyNames ? `- Primary spaces in view: ${nearbyNames}.` : "- Primary view: Jardin Grand Standing de Thiès urban park.",
    featuresEn.length ? `- Key architectural elements to render photorealistically: ${featuresEn.join("; ")}.` : "",
    "- Ground materials: cool mineral-grey concrete walkways distinctly contrasted with warm golden-sandstone tiled plazas, realistic terracotta-red athletic Tartan perimeter running track, natural fine golden sand in beach/playground zones, lush manicured tropical lawns.",
    "- Atmosphere & Life: realistic West African tropical flora (coconut palms, flamboyant trees, lush shrubs, ferns), natural water ripples, caustics and fine fountain mist, realistic shadows and global illumination, and a few naturally scaled Senegalese visitors and families strolling or relaxing.",
    "",
    `LIGHTING & MOOD: ${lightingEn}`,
    extraNotes?.trim() ? `\nADDITIONAL DIRECTION: ${extraNotes.trim()}` : "",
    "",
    "OUTPUT STYLE: Real architectural photography shot on a 24mm tilt-shift full-frame lens, natural colors, crisp material micro-textures (wood slats, travertine stone, brushed steel, water reflections), zero CGI plastic look.",
  ]
    .filter(Boolean)
    .join("\n");

  return {
    prompt: promptEn,
    nearbySummary: nearbyNames || "Vue d'ensemble · Jardin Grand Standing de Thiès",
  };
}

export function createAiStudioController({
  captureClean3D,
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
  let currentPerspective = "two-point"; // "two-point" (vue personne normale 2 pts de fuite) ou "current" (angle libre actuel)

  function renderModalSkeleton() {
    modal.innerHTML = `
      <div class="ai-studio-shell" role="document">
        <header class="ai-studio-head">
          <div>
            <p class="ai-studio-kicker">CAPTURE 3D + CONTEXTE · NANO BANANA / GOOGLE FLOW</p>
            <h2 class="ai-studio-title">Exporter la capture & le prompt architectural</h2>
          </div>
          <div class="ai-studio-head-actions">
            <button type="button" id="ai-btn-recapture" class="ai-sec-btn" title="Refaire une capture de l'angle actuel">
              Nouvelle capture
            </button>
            <button type="button" id="ai-btn-close" class="icon-btn" aria-label="Fermer la fenêtre de capture">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
                <path d="M3.5 3.5l9 9m0-9l-9 9" stroke="currentColor" stroke-width="1.5" stroke-linecap="round"/>
              </svg>
            </button>
          </div>
        </header>

        <div class="ai-studio-grid">
          <div class="ai-stage-col">
            <div class="ai-stage" id="ai-stage">
              <img id="ai-img-before" class="ai-img-base" alt="Capture 3D propre de la maquette sans interface" />
              <span id="ai-badge-mode" class="ai-badge ai-badge-left">Vue personne (1,70 m) · 2 points de fuite</span>
            </div>

            <div class="ai-stage-bar">
              <span id="ai-context-chip" class="ai-context-chip">Contexte détecté…</span>
              <div class="ai-download-group">
                <button type="button" id="ai-btn-eye-nav" class="ai-sec-btn" title="Placer directement la caméra 3D à hauteur d'yeux (1,70 m)">
                  Naviguer à 1,70 m
                </button>
                <button type="button" id="ai-btn-copy-img" class="ai-sec-btn" title="Copier l'image dans le presse-papiers pour Ctrl+V dans Google Flow">
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
              <label class="ai-label">Perspective de la capture</label>
              <div class="ai-pills" id="ai-persp-pills">
                <button type="button" class="ai-pill is-active" data-persp="two-point">Vue personne · 2 pts de fuite</button>
                <button type="button" class="ai-pill" data-persp="current">Angle actuel exact</button>
              </div>
            </div>

            <div class="ai-field">
              <label class="ai-label">Ambiance souhaitée sur le rendu final</label>
              <div class="ai-pills" id="ai-ambience-pills">
                <button type="button" class="ai-pill is-active" data-amb="auto">Auto (heure 3D)</button>
                <button type="button" class="ai-pill" data-amb="golden">Heure dorée</button>
                <button type="button" class="ai-pill" data-amb="day">Plein jour</button>
                <button type="button" class="ai-pill" data-amb="night">Nuit LED</button>
              </div>
            </div>

            <div class="ai-field">
              <label class="ai-label">Langue du prompt</label>
              <div class="ai-pills" id="ai-lang-pills">
                <button type="button" class="ai-pill is-active" data-lang="en">Anglais (recommandé Nano Banana)</button>
                <button type="button" class="ai-pill" data-lang="fr">Français</button>
              </div>
            </div>

            <div class="ai-field">
              <label class="ai-label" for="ai-extra-notes">Détails à ajouter au prompt (optionnel)</label>
              <input type="text" id="ai-extra-notes" class="ai-input" placeholder="Ex. : beaucoup de visiteurs, ciel légèrement nuageux, reflets d'eau…" />
            </div>

            <div class="ai-field">
              <label class="ai-label" for="ai-prompt-preview">Prompt + Contexte du Jardin (modifiable)</label>
              <textarea id="ai-prompt-preview" class="ai-textarea ai-textarea--code" rows="9"></textarea>
            </div>

            <p id="ai-status" class="ai-status" role="status" aria-live="polite"></p>

            <div class="ai-action-row">
              <button type="button" id="ai-btn-copy-prompt" class="ai-gen-btn">
                <svg width="16" height="16" viewBox="0 0 18 18" fill="none" aria-hidden="true">
                  <rect x="6" y="6" width="9" height="9" rx="1.6" stroke="currentColor" stroke-width="1.4"/>
                  <path d="M12 6V4.6A1.6 1.6 0 0 0 10.4 3H4.6A1.6 1.6 0 0 0 3 4.6v5.8A1.6 1.6 0 0 0 4.6 12H6" stroke="currentColor" stroke-width="1.4"/>
                </svg>
                <span>Copier le prompt + contexte</span>
              </button>
              <a href="https://labs.google/fx/tools/flow" target="_blank" rel="noopener noreferrer" class="ai-sec-btn ai-flow-link">
                Ouvrir Google Flow ↗
              </a>
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

    modal.querySelectorAll("#ai-ambience-pills .ai-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentAmbience = btn.dataset.amb;
        modal.querySelectorAll("#ai-ambience-pills .ai-pill").forEach((b) =>
          b.classList.toggle("is-active", b === btn)
        );
        updatePromptPreview();
      });
    });

    modal.querySelectorAll("#ai-lang-pills .ai-pill").forEach((btn) => {
      btn.addEventListener("click", () => {
        currentLang = btn.dataset.lang;
        modal.querySelectorAll("#ai-lang-pills .ai-pill").forEach((b) =>
          b.classList.toggle("is-active", b === btn)
        );
        updatePromptPreview();
      });
    });

    modal.querySelector("#ai-extra-notes").addEventListener("input", updatePromptPreview);

    modal.querySelector("#ai-btn-copy-prompt").addEventListener("click", async () => {
      const txt = modal.querySelector("#ai-prompt-preview")?.value || "";
      try {
        await navigator.clipboard.writeText(txt);
        setStatus("Prompt + contexte copiés ! Collez-le dans Google Flow avec la capture.");
      } catch (_) {
        const area = modal.querySelector("#ai-prompt-preview");
        area?.select();
        document.execCommand("copy");
        setStatus("Prompt + contexte copiés dans le presse-papiers.");
      }
    });

    modal.querySelector("#ai-btn-copy-img").addEventListener("click", async () => {
      if (!lastCaptureUrl) return;
      try {
        const res = await fetch(lastCaptureUrl);
        const blob = await res.blob();
        await navigator.clipboard.write([new ClipboardItem({ [blob.type]: blob })]);
        setStatus("Capture 3D copiée ! Vous pouvez faire Ctrl+V directement dans Google Flow.");
      } catch (_) {
        setStatus("Copie d'image directe bloquée par le navigateur : cliquez sur « Télécharger PNG ».", true);
      }
    });
  }

  function updatePromptPreview() {
    const isTwoPoint = currentPerspective === "two-point";
    const snap = getViewSnapshot(isTwoPoint);
    const notes = modal.querySelector("#ai-extra-notes")?.value || "";
    const { prompt, nearbySummary } = buildSpatialContext(
      snap.camPos,
      snap.targetPos,
      snap.hour,
      snap.spaces,
      currentAmbience,
      notes,
      currentLang,
      isTwoPoint
    );
    const preview = modal.querySelector("#ai-prompt-preview");
    const chip = modal.querySelector("#ai-context-chip");
    const badge = modal.querySelector("#ai-badge-mode");
    if (preview) preview.value = prompt;
    if (chip) chip.textContent = `Zone cadrée : ${nearbySummary}`;
    if (badge) {
      badge.textContent = isTwoPoint
        ? "Vue personne (1,70 m) · 2 points de fuite"
        : "Angle actuel exact (sans repères)";
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
    const dataUrl = captureClean3D({ twoPointEye: isTwoPoint, eyeHeight: 2.05 });
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
    setStatus("Capture 3D prête ! Téléchargez ou copiez l'image + le prompt pour Google Flow / Nano Banana.");
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
