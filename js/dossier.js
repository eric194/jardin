function esc(val) {
  return String(val ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function groupThousands(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, "\u00a0");
}

function fmtMoney(n) {
  if (n === null || n === undefined) return "—";
  return `${groupThousands(String(Math.round(n)))} FCFA`;
}

function fmtNum(n) {
  if (n === null || n === undefined) return "—";
  const rounded = Math.abs(n - Math.round(n)) < 1e-6 ? Math.round(n) : Number(n.toFixed(2));
  const [intPart, decPart] = String(rounded).split(".");
  const grouped = groupThousands(intPart);
  return decPart ? `${grouped},${decPart}` : grouped;
}

function renderPartnersStrip() {
  return `
    <div class="dossier-partners" aria-label="Entités du projet">
      <div class="dossier-partner-card">
        <div class="partner-logo-box"><img src="assets/logos/mairie-thies.png" alt="Logo Mairie de Thiès"></div>
        <strong class="partner-name">Mairie de Thiès</strong>
      </div>
      <div class="dossier-partner-card">
        <div class="partner-logo-box"><img src="assets/logos/ert.png" alt="Logo ERT"></div>
        <strong class="partner-name">ERT</strong>
      </div>
      <div class="dossier-partner-card">
        <div class="partner-logo-box"><img src="assets/logos/dieylani.png" alt="Logo DIEYLANI"></div>
        <strong class="partner-name">DIEYLANI</strong>
      </div>
    </div>
  `;
}

export function createDossierController({
  devisModal,
  spacePageModal,
  spaces,
  onCloseAll,
  onShowSpaceIn3D,
}) {
  let devisData = null;
  let loadPromise = null;
  const lineById = new Map();
  const lotById = new Map();

  const viewState = {
    devisOpen: false,
    spacePageId: null,
    lotFilter: "all",
    searchQuery: "",
  };

  async function ensureData() {
    if (devisData) return devisData;
    if (!loadPromise) {
      loadPromise = fetch("data/devis-data.json")
        .then((res) => {
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          return res.json();
        })
        .then((json) => {
          devisData = json;
          for (const sec of json.sections) {
            for (const lot of sec.lots) {
              lotById.set(lot.id, { ...lot, sectionTitle: sec.title });
              for (const line of lot.lines) {
                lineById.set(line.id, { ...line, lotId: lot.id, lotCode: lot.code, lotTitle: lot.title });
              }
            }
          }
          return devisData;
        });
    }
    return loadPromise;
  }

  function exportCsv() {
    if (!devisData) return;
    const q = (v) => `"${String(v ?? "").replaceAll('"', '""')}"`;
    const rows = [
      ["DEVIS ESTIMATIF ET QUANTITATIF", "", "", "", "REF", devisData.meta.ref],
      [devisData.meta.title, "", "", "", "Localisation", devisData.meta.location],
      ["N°", "Lot / Désignation", "Ut.", "Qt.", "Prix U. (FCFA)", "P. Total HT (FCFA)"],
    ];
    for (const sec of devisData.sections) {
      rows.push(["", sec.title, "", "", "", sec.totalHt]);
      for (const lot of sec.lots) {
        rows.push([lot.code, lot.title, "", "", "", ""]);
        for (const l of lot.lines) {
          rows.push([l.id, l.desc, l.unit, l.qty, l.pu ?? "", l.total ?? ""]);
        }
        rows.push(["", `SOUS-TOTAL ${lot.code}`, "", "", "", lot.totalHt]);
      }
    }
    rows.push(["", "TOTAL HT", "", "", "", devisData.totals.ht]);
    rows.push(["", "TVA 18 %", "", "", "", devisData.totals.tva]);
    rows.push(["", "TOTAL TTC", "", "", "", devisData.totals.ttc]);

    const csv = "\uFEFF" + rows.map((r) => r.map(q).join(",")).join("\r\n");
    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${devisData.meta.ref}-devis.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderDevisBody() {
    if (!devisData) return;
    const lotF = viewState.lotFilter;
    const query = viewState.searchQuery.trim().toLowerCase();

    const maxLotHt = Math.max(...Array.from(lotById.values(), (l) => l.totalHt));

    const lotBarsHtml = Array.from(lotById.values())
      .map((lot) => {
        const pct = Math.max(4, Math.round((lot.totalHt / maxLotHt) * 100));
        const activeCls = String(lotF) === String(lot.id) ? "is-active" : "";
        return `
          <button type="button" class="lot-bar-btn ${activeCls}" data-lot-filter="${lot.id}">
            <span class="lot-bar-head">
              <strong>${esc(lot.code)} · ${esc(lot.title)}</strong>
              <span>${fmtMoney(lot.totalHt)}</span>
            </span>
            <span class="lot-bar-track"><span class="lot-bar-fill" style="width:${pct}%"></span></span>
          </button>
        `;
      })
      .join("");

    const chipAllActive = lotF === "all" ? "is-active" : "";
    const lotChipsHtml =
      `<button type="button" class="filter-chip ${chipAllActive}" data-lot-filter="all">Tous (13 lots)</button>` +
      Array.from(lotById.values())
        .map((lot) => {
          const act = String(lotF) === String(lot.id) ? "is-active" : "";
          return `<button type="button" class="filter-chip ${act}" data-lot-filter="${lot.id}">${esc(lot.code)}</button>`;
        })
        .join("");

    let sectionsHtml = "";
    let visibleLines = 0;

    for (const sec of devisData.sections) {
      let lotsHtml = "";
      for (const lot of sec.lots) {
        if (lotF !== "all" && String(lot.id) !== String(lotF)) continue;
        const matched = lot.lines.filter((l) => {
          if (!query) return true;
          return (
            l.id.toLowerCase().includes(query) ||
            l.desc.toLowerCase().includes(query) ||
            lot.title.toLowerCase().includes(query)
          );
        });
        if (!matched.length) continue;
        visibleLines += matched.length;

        const rowsHtml = matched
          .map(
            (l) => `
              <tr class="${l.isSubline ? "is-subline" : ""}">
                <td class="col-code">${esc(l.id)}</td>
                <td class="col-desc">${esc(l.desc)}</td>
                <td class="col-unit">${esc(l.unit)}</td>
                <td class="col-num">${fmtNum(l.qty)}</td>
                <td class="col-num">${l.pu !== null ? fmtNum(l.pu) : "—"}</td>
                <td class="col-total">${l.total !== null ? fmtMoney(l.total) : "Inclus"}</td>
              </tr>
            `
          )
          .join("");

        lotsHtml += `
          <div class="dqe-lot-card">
            <div class="dqe-lot-head">
              <div>
                <span class="dqe-lot-code">${esc(lot.code)}</span>
                <h3>${esc(lot.title)}</h3>
              </div>
              <span class="dqe-lot-total">${fmtMoney(lot.totalHt)}</span>
            </div>
            <div class="dqe-table-wrap">
              <table class="dqe-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Désignation des ouvrages</th>
                    <th>Ut.</th>
                    <th class="is-num">Qté</th>
                    <th class="is-num">P.U. HT</th>
                    <th class="is-num">Total HT</th>
                  </tr>
                </thead>
                <tbody>${rowsHtml}</tbody>
              </table>
            </div>
          </div>
        `;
      }

      if (lotsHtml) {
        sectionsHtml += `
          <section class="dqe-section">
            <div class="dqe-section-head">
              <h2>${esc(sec.title)}</h2>
              <span>Sous-total section : ${fmtMoney(sec.totalHt)}</span>
            </div>
            ${lotsHtml}
          </section>
        `;
      }
    }

    if (!sectionsHtml) {
      sectionsHtml = `
        <div class="dossier-empty">
          <p>Aucun poste ne correspond à « ${esc(viewState.searchQuery)} ».</p>
          <button type="button" class="pill-btn pill-btn--sm" data-reset-filters="1">Réinitialiser les filtres</button>
        </div>
      `;
    }

    const soilRowsHtml = devisData.soilSynthesis
      .map(
        (s) => `
        <tr>
          <td>${esc(s.label)}</td>
          <td class="is-num">${fmtNum(s.area)} m²</td>
          <td class="is-num">${esc(s.share)}</td>
        </tr>
      `
      )
      .join("");

    const exclusionsHtml = devisData.exclusions.map((e) => `<li>${esc(e)}</li>`).join("");

    devisModal.innerHTML = `
      <div class="dossier-shell">
        <header class="dossier-topbar">
          <div class="dossier-topbar-left">
            <button type="button" class="pill-btn pill-btn--sm" data-dossier-close="1">← Retour à la 3D</button>
            <span class="dossier-ref">RÉF. ${esc(devisData.meta.ref)}</span>
          </div>
          <div class="dossier-topbar-actions">
            <button type="button" class="pill-btn pill-btn--sm" data-export-csv="1">Exporter CSV</button>
            <button type="button" class="pill-btn pill-btn--sm" data-print-doc="1">Imprimer / PDF</button>
            <a class="pill-btn pill-btn--sm" href="downloads/DQE202611-THS-PARC.pdf" download="DQE202611-THS-PARC.pdf">DQE PDF</a>
          </div>
        </header>

        <main class="dossier-main">
          <section class="dossier-hero">
            <p class="dossier-kicker">DEVIS ESTIMATIF ET QUANTITATIF · ${esc(devisData.meta.location)}</p>
            <h1 class="dossier-title">${esc(devisData.meta.title)}</h1>
            <p class="dossier-lead">${esc(devisData.meta.subtitle)}</p>

            ${renderPartnersStrip()}

            <div class="dossier-kpi-grid">
              <article class="kpi-card">
                <span class="kpi-label">Total Général HT</span>
                <strong class="kpi-value">${fmtMoney(devisData.totals.ht)}</strong>
                <span class="kpi-sub">${devisData.totals.lotCount} lots · ${devisData.totals.lineCount} postes</span>
              </article>
              <article class="kpi-card">
                <span class="kpi-label">TVA (18 %)</span>
                <strong class="kpi-value">${fmtMoney(devisData.totals.tva)}</strong>
                <span class="kpi-sub">Fiscalité applicable</span>
              </article>
              <article class="kpi-card is-accent">
                <span class="kpi-label">Total Général TTC</span>
                <strong class="kpi-value">${fmtMoney(devisData.totals.ttc)}</strong>
                <span class="kpi-sub">Mairie de Thiès · ERT · DIEYLANI</span>
              </article>
              <article class="kpi-card">
                <span class="kpi-label">Emprise du projet</span>
                <strong class="kpi-value">32 800 m²</strong>
                <span class="kpi-sub">25 000 m² parc · 7 800 m² parking · 43 cantines</span>
              </article>
            </div>
          </section>

          <section class="dossier-panel">
            <div class="panel-head">
              <h2>Répartition budgétaire des 13 lots</h2>
              <span>Cliquez sur un lot pour filtrer le détail</span>
            </div>
            <div class="lot-bars-grid">${lotBarsHtml}</div>
          </section>

          <section class="dossier-toolbar">
            <div class="search-box">
              <label for="devis-search-input" class="sr-only">Rechercher dans le devis</label>
              <input id="devis-search-input" type="search" placeholder="Rechercher un ouvrage, un matériau ou un code (ex. padel, forage, 13.12)..." value="${esc(viewState.searchQuery)}">
              <span class="search-count">${visibleLines} poste(s)</span>
            </div>
            <div class="filter-chips">${lotChipsHtml}</div>
          </section>

          ${sectionsHtml}

          <section class="dossier-split">
            <div class="dossier-panel">
              <h2>Synthèse des surfaces aménagées</h2>
              <table class="dqe-table dqe-table--compact">
                <thead>
                  <tr><th>Nature de sol</th><th class="is-num">Surface</th><th class="is-num">Part</th></tr>
                </thead>
                <tbody>${soilRowsHtml}</tbody>
              </table>
            </div>
            <div class="dossier-panel">
              <h2>Prestations non comprises &amp; arrêté du devis</h2>
              <ul class="dossier-bullets">${exclusionsHtml}</ul>
              <p class="dossier-note-ttc"><strong>Arrêté :</strong> ${esc(devisData.totals.ttcWords)} (${fmtMoney(devisData.totals.ttc)}).</p>
            </div>
          </section>
        </main>
      </div>
    `;
  }

  function renderSpacePage(spaceId) {
    if (!devisData) return;
    const idx = spaces.findIndex((s) => s.id === spaceId);
    const sp = idx >= 0 ? spaces[idx] : spaces[0];
    if (!sp) return;
    viewState.spacePageId = sp.id;

    const detail = devisData.spaceDetails[sp.id] || devisData.spaceDetails[sp.dossierId];
    const dedicatedLines = (detail?.dedicatedLineIds || []).map((id) => lineById.get(id)).filter(Boolean);
    const sharedLines = (detail?.sharedLineIds || []).map((id) => lineById.get(id)).filter(Boolean);
    const dedicatedSum = dedicatedLines.reduce((acc, l) => acc + (l.total || 0), 0);
    const mainLot = detail?.lotIds?.length ? lotById.get(detail.lotIds[0]) : null;

    const prevSp = spaces[(idx - 1 + spaces.length) % spaces.length];
    const nextSp = spaces[(idx + 1) % spaces.length];

    const specsHtml = (detail?.specs || [])
      .map(
        (item) => `
          <div class="spec-item">
            <span class="spec-label">${esc(item.label)}</span>
            <strong class="spec-value">${esc(item.value)}</strong>
          </div>
        `
      )
      .join("");

    const amenitiesHtml = (detail?.amenities || [])
      .map(
        (am) => `
          <article class="amenity-card">
            <h3>${esc(am.title)}</h3>
            <p>${esc(am.detail)}</p>
          </article>
        `
      )
      .join("");

    const dedRowsHtml = dedicatedLines
      .map(
        (l) => `
          <tr>
            <td class="col-code">${esc(l.id)}</td>
            <td class="col-desc">${esc(l.desc)}</td>
            <td class="col-unit">${esc(l.unit)}</td>
            <td class="col-num">${fmtNum(l.qty)}</td>
            <td class="col-num">${l.pu !== null ? fmtNum(l.pu) : "—"}</td>
            <td class="col-total">${l.total !== null ? fmtMoney(l.total) : "Inclus"}</td>
          </tr>
        `
      )
      .join("");

    const sharedRowsHtml = sharedLines
      .map(
        (l) => `
          <tr class="is-subline">
            <td class="col-code">${esc(l.id)}</td>
            <td class="col-desc">${esc(l.desc)} <small>(${esc(l.lotCode)})</small></td>
            <td class="col-unit">${esc(l.unit)}</td>
            <td class="col-num">${fmtNum(l.qty)}</td>
            <td class="col-total">${l.total !== null ? fmtMoney(l.total) : "Inclus"}</td>
          </tr>
        `
      )
      .join("");

    const lotLinksHtml = (detail?.lotIds || [])
      .map((lid) => {
        const lObj = lotById.get(lid);
        if (!lObj) return "";
        return `<button type="button" class="pill-btn pill-btn--sm" data-open-devis-lot="${lid}">Voir ${esc(lObj.code)} (${fmtMoney(lObj.totalHt)})</button>`;
      })
      .join("");

    spacePageModal.innerHTML = `
      <div class="dossier-shell">
        <header class="dossier-topbar">
          <div class="dossier-topbar-left">
            <button type="button" class="pill-btn pill-btn--sm" data-dossier-close="1">← Retour à la 3D</button>
            <button type="button" class="pill-btn pill-btn--sm" data-focus-3d="${esc(sp.id)}">Centrer en 3D</button>
          </div>
          <div class="dossier-topbar-actions">
            <div class="card-steppers">
              <button type="button" class="step-btn" data-nav-space="${esc(prevSp.id)}" aria-label="Espace précédent">←</button>
              <span class="space-counter">${String(idx + 1).padStart(2, "0")} / ${spaces.length}</span>
              <button type="button" class="step-btn" data-nav-space="${esc(nextSp.id)}" aria-label="Espace suivant">→</button>
            </div>
            <button type="button" class="pill-btn pill-btn--sm pill-btn--accent" data-open-devis-lot="${mainLot ? mainLot.id : "all"}">Consulter le devis</button>
          </div>
        </header>

        <main class="dossier-main">
          <section class="dossier-hero">
            <p class="dossier-kicker">${esc(sp.index)} · ${esc(sp.category)} · ${esc(detail?.sector || "Jardin Grand Standing")}</p>
            <h1 class="dossier-title">${esc(sp.title)}</h1>
            <p class="dossier-lead">${esc(sp.summary)}</p>

            <div class="dossier-kpi-grid">
              <article class="kpi-card">
                <span class="kpi-label">Surface &amp; emprise</span>
                <strong class="kpi-value kpi-value--sm">${esc(detail?.surfaceLabel || sp.metric)}</strong>
                <span class="kpi-sub">Métré Archicad vérifié</span>
              </article>
              <article class="kpi-card is-accent">
                <span class="kpi-label">Postes dédiés HT</span>
                <strong class="kpi-value">${fmtMoney(dedicatedSum)}</strong>
                <span class="kpi-sub">${dedicatedLines.length} ligne(s) directe(s) au DQE</span>
              </article>
              <article class="kpi-card">
                <span class="kpi-label">Lot de rattachement</span>
                <strong class="kpi-value kpi-value--sm">${mainLot ? esc(mainLot.code + " — " + mainLot.title) : esc(sp.lot)}</strong>
                <span class="kpi-sub">${mainLot ? "Enveloppe lot : " + fmtMoney(mainLot.totalHt) : ""}</span>
              </article>
              <article class="kpi-card">
                <span class="kpi-label">Capacité &amp; usage</span>
                <strong class="kpi-value kpi-value--sm">${esc(detail?.capacityLabel || sp.metric)}</strong>
                <span class="kpi-sub">Thiès · 14°46'51.2"N 16°56'54.5"W</span>
              </article>
            </div>
          </section>

          <section class="dossier-panel">
            <h2>Chiffres techniques &amp; dimensions</h2>
            <div class="specs-grid">${specsHtml}</div>
          </section>

          <section class="dossier-panel">
            <div class="panel-head">
              <h2>Détail budgétaire direct de l'espace (HT)</h2>
              <span>Total postes dédiés : ${fmtMoney(dedicatedSum)}</span>
            </div>
            <div class="dqe-table-wrap">
              <table class="dqe-table">
                <thead>
                  <tr>
                    <th>N°</th>
                    <th>Désignation des ouvrages</th>
                    <th>Ut.</th>
                    <th class="is-num">Qté</th>
                    <th class="is-num">P.U. HT</th>
                    <th class="is-num">Total HT</th>
                  </tr>
                </thead>
                <tbody>${dedRowsHtml}</tbody>
                <tfoot>
                  <tr>
                    <td colspan="5"><strong>Sous-total postes dédiés à ${esc(sp.title)}</strong></td>
                    <td class="col-total"><strong>${fmtMoney(dedicatedSum)}</strong></td>
                  </tr>
                </tfoot>
              </table>
            </div>
            <div class="lot-chip-links">${lotLinksHtml}</div>
          </section>

          ${
            sharedLines.length
              ? `
            <section class="dossier-panel">
              <div class="panel-head">
                <h2>Ouvrages transversaux associés (lots partagés)</h2>
                <span>Lignes mutualisées sur plusieurs zones du parc</span>
              </div>
              <div class="dqe-table-wrap">
                <table class="dqe-table dqe-table--compact">
                  <thead>
                    <tr><th>N°</th><th>Désignation (Lot)</th><th>Ut.</th><th class="is-num">Qté</th><th class="is-num">Montant lot HT</th></tr>
                  </thead>
                  <tbody>${sharedRowsHtml}</tbody>
                </table>
              </div>
            </section>
          `
              : ""
          }

          <section class="dossier-panel">
            <h2>Commodités, matériaux &amp; équipements</h2>
            <div class="amenities-grid">${amenitiesHtml}</div>
          </section>

          ${renderPartnersStrip()}
        </main>
      </div>
    `;
  }

  async function openDevis({ lotFilter = "all" } = {}) {
    await ensureData();
    viewState.lotFilter = lotFilter;
    viewState.devisOpen = true;
    viewState.spacePageId = null;

    spacePageModal.classList.remove("is-open");
    spacePageModal.setAttribute("aria-hidden", "true");

    renderDevisBody();
    devisModal.classList.add("is-open");
    devisModal.setAttribute("aria-hidden", "false");
    devisModal.scrollTop = 0;
    if (window.location.hash !== "#devis") {
      history.replaceState(null, "", "#devis");
    }
  }

  async function openSpacePage(spaceId) {
    await ensureData();
    viewState.devisOpen = false;
    devisModal.classList.remove("is-open");
    devisModal.setAttribute("aria-hidden", "true");

    renderSpacePage(spaceId);
    spacePageModal.classList.add("is-open");
    spacePageModal.setAttribute("aria-hidden", "false");
    spacePageModal.scrollTop = 0;
    const nextHash = `#espace/${viewState.spacePageId}`;
    if (window.location.hash !== nextHash) {
      history.replaceState(null, "", nextHash);
    }
  }

  function closeAll() {
    const wasOpen = viewState.devisOpen || Boolean(viewState.spacePageId);
    viewState.devisOpen = false;
    viewState.spacePageId = null;
    devisModal.classList.remove("is-open");
    devisModal.setAttribute("aria-hidden", "true");
    spacePageModal.classList.remove("is-open");
    spacePageModal.setAttribute("aria-hidden", "true");
    if (wasOpen && onCloseAll) onCloseAll();
  }

  // Événements délégués pour #devis-modal
  devisModal.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-dossier-close]");
    if (closeBtn) {
      closeAll();
      return;
    }
    const lotBtn = e.target.closest("[data-lot-filter]");
    if (lotBtn) {
      viewState.lotFilter = lotBtn.dataset.lotFilter;
      renderDevisBody();
      return;
    }
    const resetBtn = e.target.closest("[data-reset-filters]");
    if (resetBtn) {
      viewState.lotFilter = "all";
      viewState.searchQuery = "";
      renderDevisBody();
      return;
    }
    const csvBtn = e.target.closest("[data-export-csv]");
    if (csvBtn) {
      exportCsv();
      return;
    }
    const printBtn = e.target.closest("[data-print-doc]");
    if (printBtn) {
      window.print();
    }
  });

  devisModal.addEventListener("input", (e) => {
    if (e.target.id === "devis-search-input") {
      const selStart = e.target.selectionStart;
      viewState.searchQuery = e.target.value;
      renderDevisBody();
      const restored = document.getElementById("devis-search-input");
      if (restored) {
        restored.focus();
        try {
          restored.setSelectionRange(selStart, selStart);
        } catch (_) {}
      }
    }
  });

  // Événements délégués pour #space-page
  spacePageModal.addEventListener("click", (e) => {
    const closeBtn = e.target.closest("[data-dossier-close]");
    if (closeBtn) {
      closeAll();
      return;
    }
    const focusBtn = e.target.closest("[data-focus-3d]");
    if (focusBtn) {
      const id = focusBtn.dataset.focus3d;
      closeAll();
      if (onShowSpaceIn3D) onShowSpaceIn3D(id);
      return;
    }
    const navBtn = e.target.closest("[data-nav-space]");
    if (navBtn) {
      openSpacePage(navBtn.dataset.navSpace);
      spacePageModal.scrollTop = 0;
      return;
    }
    const devisBtn = e.target.closest("[data-open-devis-lot]");
    if (devisBtn) {
      openDevis({ lotFilter: devisBtn.dataset.openDevisLot || "all" });
    }
  });

  return {
    preload: ensureData,
    openDevis,
    openSpacePage,
    closeAll,
    isOpen: () => viewState.devisOpen || Boolean(viewState.spacePageId),
    getState: () => ({
      devisOpen: viewState.devisOpen,
      spacePageId: viewState.spacePageId,
      lotFilter: viewState.lotFilter,
    }),
  };
}
