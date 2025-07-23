import { apiCall, formatCurrency, formatDate } from "./utils.js";
import { getSetting } from "./einstellungen.js";
import { showSection } from "./utils.js";
import { filterTableByStatus, filterTableByMonth } from "./search.js";

export async function loadDashboard() {
  try {
    const [auftraege, rechnungen, kunden, settings] = await Promise.all([
      apiCall("/api/auftraege"),
      apiCall("/api/rechnungen"),
      apiCall("/api/kunden"),
      apiCall("/api/einstellungen"),
    ]);

    // KRITISCH: Bestehende Einstellungen NICHT überschreiben!
    if (!window.einstellungen) {
      window.einstellungen = {};
    }

    // Nur neue Einstellungen hinzufügen, bestehende behalten
    settings.forEach((setting) => {
      // Nur setzen wenn noch nicht vorhanden (oder explizit überschreiben gewünscht)
      if (window.einstellungen[setting.key] === undefined) {
        window.einstellungen[setting.key] = setting.value;
      }
    });

    console.log(
      "🖼️ Logo nach Dashboard-Load:",
      window.einstellungen?.firmen_logo?.length || "NICHT VORHANDEN"
    );

    updateFirmenLogo();
    updateStatistics(auftraege, rechnungen, kunden);
    updateAuftraegeTable(auftraege);
    updateFirmenInfo();
    updateQuickActions();
  } catch (err) {
    console.error("Failed to load dashboard:", err);
  }
}

function updateFirmenLogo() {
  const logo = getSetting("firmen_logo", "");
  const firmenname = getSetting("firmenname", "Meine Firma");

  // Logo im Header-Bereich aktualisieren
  const logoElement = document.querySelector(".logo");
  if (logoElement && logo) {
    // Wenn Logo vorhanden, ersetze Icon durch Bild
    logoElement.innerHTML = `
      <img src="${logo}" alt="${firmenname}" style="height: 32px; max-width: 120px; object-fit: contain;">
      <span style="margin-left: 8px;">${firmenname}</span>
    `;
  } else if (logoElement) {
    // Fallback zum Standard-Icon
    logoElement.innerHTML = `
      <i class="fas fa-paint-brush"></i>
      ${firmenname}
    `;
  }
}

function updateStatistics(auftraege, rechnungen, kunden) {
  // Offene Aufträge
  const offeneAuftraege = auftraege.filter((a) => a.status === "offen").length;
  document.getElementById("stat-auftraege").textContent = offeneAuftraege;

  // Offene Rechnungen
  const offeneRechnungen = rechnungen.filter(
    (r) => r.status === "offen"
  ).length;
  document.getElementById("stat-rechnungen").textContent = offeneRechnungen;

  // Gesamtzahl Kunden
  document.getElementById("stat-kunden").textContent = kunden.length;

  // Monatsumsatz
  const currentMonth = new Date().getMonth();
  const currentYear = new Date().getFullYear();
  const monthlyRevenue = rechnungen
    .filter((r) => {
      const d = new Date(r.rechnungsdatum);
      return (
        d.getMonth() === currentMonth &&
        d.getFullYear() === currentYear &&
        r.status === "bezahlt"
      );
    })
    .reduce((sum, r) => sum + (r.gesamtbetrag || 0), 0);

  document.getElementById("stat-umsatz").textContent =
    formatCurrency(monthlyRevenue);

  // Cards klickbar machen
  makeCardsClickable();

  // Zusätzliche Statistiken hinzufügen
  addExtendedStatistics(auftraege, rechnungen);
}

// Neue Funktion: Cards klickbar machen
function makeCardsClickable() {
  // Alle stat-cards finden und Click-Handler hinzufügen
  const cards = document.querySelectorAll(".stat-card");

  cards.forEach((card, index) => {
    // Card-Styles für bessere Hover-Effekte
    card.style.cursor = "pointer";
    card.style.transition = "all 0.3s ease";
    card.style.userSelect = "none";

    // Hover-Effekte
    card.addEventListener("mouseenter", function () {
      this.style.transform = "translateY(-5px) scale(1.02)";
      this.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
    });

    card.addEventListener("mouseleave", function () {
      this.style.transform = "translateY(0) scale(1)";
      this.style.boxShadow = "var(--shadow)";
    });

    // Click-Handler basierend auf Card-Position
    card.addEventListener("click", function () {
      // Visual Feedback
      this.style.transform = "translateY(-2px) scale(0.98)";
      setTimeout(() => {
        this.style.transform = "translateY(-5px) scale(1.02)";
      }, 150);

      // Navigation basierend auf Index
      switch (index) {
        case 0: // Offene Aufträge
          showSection("auftraege", true);
          // Optional: Filter auf offene Aufträge setzen
          setTimeout(() => filterAuftraege("offen"), 300);
          break;
        case 1: // Offene Rechnungen
          showSection("rechnungen", true);
          // Optional: Filter auf offene Rechnungen setzen
          setTimeout(() => filterRechnungen("offen"), 300);
          break;
        case 2: // Kunden
          showSection("kunden", true);
          break;
        case 3: // Monatsumsatz
          showSection("rechnungen", true);
          // Optional: Filter auf bezahlte Rechnungen des aktuellen Monats
          setTimeout(() => filterRechnungenByMonth(), 300);
          break;
        default:
          console.log("Unbekannte Card geklickt");
      }
    });

    // Tooltip für bessere UX hinzufügen
    const tooltips = [
      "Klicken um zu Aufträgen zu gelangen",
      "Klicken um zu Rechnungen zu gelangen",
      "Klicken um zu Kunden zu gelangen",
      "Klicken um zu Rechnungen zu gelangen",
    ];

    card.title = tooltips[index] || "Klicken für Details";
  });

  console.log("✅ Dashboard Cards sind jetzt klickbar");
}

// Hilfsfunktionen für Filterung (optional)
function filterAuftraege(status) {
  console.log(`🔍 Filtere Aufträge nach Status: ${status}`);

  // Verwende die neue intelligente Filterfunktion
  filterTableByStatus("auftraege-table", status);

  // Optional: Suchfeld entsprechend setzen für visuelles Feedback
  const searchInput = document.getElementById("auftraege-search");
  if (searchInput) {
    searchInput.value = getDisplayTextForStatus(status);
    // Markiere das Suchfeld als aktiv gefiltert
    searchInput.style.backgroundColor = "var(--accent-color)";
    searchInput.style.color = "white";

    // Nach 3 Sekunden zurücksetzen
    setTimeout(() => {
      searchInput.style.backgroundColor = "";
      searchInput.style.color = "";
    }, 3000);
  }
}

function filterRechnungen(status) {
  console.log(`🔍 Filtere Rechnungen nach Status: ${status}`);

  filterTableByStatus("rechnungen-table", status);

  const searchInput = document.getElementById("rechnungen-search");
  if (searchInput) {
    searchInput.value = getDisplayTextForStatus(status);
    searchInput.style.backgroundColor = "var(--accent-color)";
    searchInput.style.color = "white";

    setTimeout(() => {
      searchInput.style.backgroundColor = "";
      searchInput.style.color = "";
    }, 3000);
  }
}

function filterRechnungenByMonth() {
  console.log(`🔍 Filtere Rechnungen nach aktuellem Monat`);

  filterTableByMonth("rechnungen-table");

  const searchInput = document.getElementById("rechnungen-search");
  if (searchInput) {
    const currentMonth = new Date().toLocaleDateString("de-DE", {
      month: "long",
    });
    searchInput.value = `${currentMonth} (Monat)`;
    searchInput.style.backgroundColor = "var(--success-color)";
    searchInput.style.color = "white";

    setTimeout(() => {
      searchInput.style.backgroundColor = "";
      searchInput.style.color = "";
    }, 3000);
  }
}

// Hilfsfunktion für bessere Anzeige der Status-Werte
function getDisplayTextForStatus(status) {
  const statusDisplayMap = {
    offen: "Offen",
    in_bearbeitung: "In Bearbeitung",
    abgeschlossen: "Abgeschlossen",
    bezahlt: "Bezahlt",
    mahnung: "Mahnung",
    storniert: "Storniert",
  };

  return statusDisplayMap[status] || status;
}

// Erweiterte Filter-Optionen für Dashboard
function addFilterControls() {
  // Prüfe ob Filter-Controls bereits existieren
  if (document.getElementById("dashboard-filters")) return;

  const dashboardContainer = document.querySelector(".dashboard-container");
  if (!dashboardContainer) return;

  const filterContainer = document.createElement("div");
  filterContainer.id = "dashboard-filters";
  filterContainer.style.cssText = `
    margin-bottom: 2rem;
    padding: 1rem;
    background: var(--bg-secondary);
    border-radius: 8px;
    border: 1px solid var(--border-color);
  `;

  filterContainer.innerHTML = `
    <h3 style="margin: 0 0 1rem 0;">Schnellfilter</h3>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
      <div class="filter-group">
        <label>Aufträge:</label>
        <button class="btn btn-sm btn-secondary" onclick="clearAllFilters('auftraege-table')">Alle</button>
        <button class="btn btn-sm btn-warning" onclick="filterAuftraege('offen')">Offen</button>
        <button class="btn btn-sm btn-info" onclick="filterAuftraege('in_bearbeitung')">In Bearbeitung</button>
        <button class="btn btn-sm btn-success" onclick="filterAuftraege('abgeschlossen')">Abgeschlossen</button>
      </div>
      <div class="filter-group">
        <label>Rechnungen:</label>
        <button class="btn btn-sm btn-secondary" onclick="clearAllFilters('rechnungen-table')">Alle</button>
        <button class="btn btn-sm btn-warning" onclick="filterRechnungen('offen')">Offen</button>
        <button class="btn btn-sm btn-success" onclick="filterRechnungen('bezahlt')">Bezahlt</button>
        <button class="btn btn-sm btn-danger" onclick="filterRechnungen('mahnung')">Mahnung</button>
        <button class="btn btn-sm btn-secondary" onclick="filterRechnungenByMonth()">Aktueller Monat</button>
      </div>
    </div>
  `;

  dashboardContainer.insertBefore(
    filterContainer,
    dashboardContainer.firstChild
  );
}

// Filter zurücksetzen
function clearAllFilters(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  // Alle Zeilen anzeigen
  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row) => (row.style.display = ""));

  // Suchfeld leeren
  const searchInputId = tableId.replace("-table", "-search");
  const searchInput = document.getElementById(searchInputId);
  if (searchInput) {
    searchInput.value = "";
    searchInput.style.backgroundColor = "";
    searchInput.style.color = "";
  }

  console.log(`✅ Filter für ${tableId} zurückgesetzt`);
}

// Debug-Funktionen für Troubleshooting
function debugCurrentFilters() {
  console.log("🔍 Debug: Aktuelle Filter-Status");

  const tables = [
    "auftraege-table",
    "rechnungen-table",
    "kunden-table",
    "fahrzeuge-table",
  ];

  tables.forEach((tableId) => {
    const table = document.getElementById(tableId);
    if (!table) {
      console.log(`❌ Tabelle ${tableId} nicht gefunden`);
      return;
    }

    const allRows = table.querySelectorAll("tbody tr");
    const visibleRows = Array.from(allRows).filter(
      (row) => row.style.display !== "none"
    );

    console.log(
      `📊 ${tableId}: ${visibleRows.length}/${allRows.length} Zeilen sichtbar`
    );

    const searchInputId = tableId.replace("-table", "-search");
    const searchInput = document.getElementById(searchInputId);
    if (searchInput && searchInput.value) {
      console.log(`🔍 Aktiver Filter: "${searchInput.value}"`);
    }
  });
}

// Exportiere die Funktionen für globale Verwendung
window.filterAuftraege = filterAuftraege;
window.filterRechnungen = filterRechnungen;
window.filterRechnungenByMonth = filterRechnungenByMonth;
window.clearAllFilters = clearAllFilters;
window.debugCurrentFilters = debugCurrentFilters;
window.addFilterControls = addFilterControls;

// Auto-Setup beim Laden
document.addEventListener("DOMContentLoaded", () => {
  // Filter-Controls nach kurzer Verzögerung hinzufügen
  setTimeout(() => {
    if (window.location.hash === "#dashboard" || !window.location.hash) {
      addFilterControls();
    }
  }, 1000);
});

console.log("✅ Verbesserte Dashboard-Filter geladen");

function addExtendedStatistics(auftraege, rechnungen) {
  // Prüfen ob erweiterte Statistiken bereits existieren
  let extendedStatsContainer = document.getElementById("extended-stats");
  if (!extendedStatsContainer) {
    // Container für erweiterte Statistiken erstellen
    const dashboardGrid = document.querySelector(".dashboard-grid");

    extendedStatsContainer = document.createElement("div");
    extendedStatsContainer.id = "extended-stats";
    extendedStatsContainer.className = "dashboard-grid";
    extendedStatsContainer.style.marginTop = "2rem";

    dashboardGrid.parentNode.insertBefore(
      extendedStatsContainer,
      dashboardGrid.nextSibling
    );
  }

  // 🔧 FIX: Aufträge in Bearbeitung - korrekter Status "in_bearbeitung"
  const auftraegeInBearbeitung = auftraege.filter(
    (a) => a.status === "in_bearbeitung"
  ).length;

  // Zusätzliche Debug-Info
  console.log("📊 Dashboard-Statistiken:");
  console.log("- Alle Aufträge:", auftraege.length);
  console.log("- Aufträge in Bearbeitung:", auftraegeInBearbeitung);
  console.log(
    "- Status-Verteilung:",
    auftraege.reduce((acc, a) => {
      acc[a.status] = (acc[a.status] || 0) + 1;
      return acc;
    }, {})
  );

  // Überfällige Rechnungen (älter als Zahlungsziel)
  const zahlungszielTage = parseInt(getSetting("zahlungsziel_tage", "14"));
  const today = new Date();
  const ueberfaelligeRechnungen = rechnungen.filter((r) => {
    if (r.status !== "offen") return false;
    const rechnungsDatum = new Date(r.rechnungsdatum);
    const diffTime = today - rechnungsDatum;
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return diffDays > zahlungszielTage;
  }).length;

  // 💡 VERBESSERT: Durchschnittlicher Auftragswert mit besserer Berechnung
  const auftraegeWithCosts = auftraege.filter(
    (a) => a.gesamt_kosten && a.gesamt_kosten > 0
  );
  const durchschnittAuftragswert =
    auftraegeWithCosts.length > 0
      ? auftraegeWithCosts.reduce((sum, a) => sum + (a.gesamt_kosten || 0), 0) /
        auftraegeWithCosts.length
      : 0;

  // Jahresumsatz
  const currentYear = new Date().getFullYear();
  const jahresUmsatz = rechnungen
    .filter((r) => {
      const d = new Date(r.rechnungsdatum);
      return d.getFullYear() === currentYear && r.status === "bezahlt";
    })
    .reduce((sum, r) => sum + (r.gesamtbetrag || 0), 0);

  // 🎨 VERBESSERTE Karten mit besseren Tooltips und Farben
  extendedStatsContainer.innerHTML = `
    <div class="stat-card" style="background: linear-gradient(135deg, #8b5cf6, #7c3aed);" title="Aufträge mit Status 'in_bearbeitung'">
      <div class="stat-number">${auftraegeInBearbeitung}</div>
      <div class="stat-label">In Bearbeitung</div>
      <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">
        aktuelle Arbeiten
      </div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #ef4444, #dc2626);" title="Rechnungen älter als ${zahlungszielTage} Tage">
      <div class="stat-number">${ueberfaelligeRechnungen}</div>
      <div class="stat-label">Überfällige Rechnungen</div>
      <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">
        > ${zahlungszielTage} Tage alt
      </div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #06b6d4, #0891b2);" title="Durchschnittswert aller Aufträge mit Kosten (${
      auftraegeWithCosts.length
    } von ${auftraege.length})">
      <div class="stat-number">${formatCurrency(durchschnittAuftragswert)}</div>
      <div class="stat-label">⌀ Auftragswert</div>
      <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">
        aus ${auftraegeWithCosts.length} Aufträgen
      </div>
    </div>
    <div class="stat-card" style="background: linear-gradient(135deg, #10b981, #059669);" title="Summe aller bezahlten Rechnungen in ${currentYear}">
      <div class="stat-number">${formatCurrency(jahresUmsatz)}</div>
      <div class="stat-label">Jahresumsatz ${currentYear}</div>
      <div style="font-size: 0.75rem; opacity: 0.8; margin-top: 0.25rem;">
        nur bezahlte Rechnungen
      </div>
    </div>
  `;
}

function updateAuftraegeTable(auftraege) {
  // Die neuesten 5 Aufträge anzeigen
  const recent = auftraege.slice(0, 5);
  const tbody = document.querySelector("#dashboard-auftraege tbody");

  tbody.innerHTML = recent
    .map(
      (auftrag) => `
      <tr>
        <td>${auftrag.auftrag_nr}</td>
        <td>${auftrag.kunde_name || "-"}</td>
        <td>${auftrag.kennzeichen || ""} ${auftrag.marke || ""}</td>
        <td>${formatDate(auftrag.datum)}</td>
        <td><span class="status status-${auftrag.status.replace("_", "-")}">${
        auftrag.status === "in_bearbeitung"
          ? "In Bearbeitung"
          : auftrag.status === "offen"
          ? "Offen"
          : auftrag.status === "abgeschlossen"
          ? "Abgeschlossen"
          : auftrag.status
      }</span></td>
        <td>${formatCurrency(auftrag.gesamt_kosten)}</td>
      </tr>
    `
    )
    .join("");
}

function updateFirmenInfo() {
  // Firmeninformationen in einem zusätzlichen Widget anzeigen
  let firmenInfoCard = document.getElementById("firmen-info-card");

  if (!firmenInfoCard) {
    // Karte für Firmeninformationen erstellen
    const mainContainer = document.querySelector(".main .container");
    firmenInfoCard = document.createElement("div");
    firmenInfoCard.id = "firmen-info-card";
    firmenInfoCard.className = "card";
    firmenInfoCard.style.marginBottom = "2rem";

    // Nach den Statistiken einfügen
    const extendedStats = document.getElementById("extended-stats");
    if (extendedStats) {
      extendedStats.parentNode.insertBefore(
        firmenInfoCard,
        extendedStats.nextSibling
      );
    }
  }

  const firmenname = getSetting("firmenname", "Meine Firma");
  const firmenStrasse = getSetting("firmen_strasse", "");
  const firmenOrt = getSetting("firmen_ort", "");
  const firmenTelefon = getSetting("firmen_telefon", "");
  const firmenEmail = getSetting("firmen_email", "");
  const basisStundenpreis = getSetting("basis_stundenpreis", "110.00");
  const mwstSatz = getSetting("mwst_satz", "19");

  firmenInfoCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">
        <i class="fas fa-building"></i>
        Firmeninformationen
      </h2>
      <button class="btn btn-sm btn-secondary" onclick="window.showSection('einstellungen')">
        <i class="fas fa-cog"></i> Bearbeiten
      </button>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); gap: 2rem;">
      <div>
        <h4 style="color: var(--accent-primary); margin-bottom: 1rem;">Kontaktdaten</h4>
        <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">
          <strong>${firmenname}</strong><br>
          ${firmenStrasse}<br>
          ${firmenOrt}<br>
          ${
            firmenTelefon
              ? `<i class="fas fa-phone"></i> ${firmenTelefon}<br>`
              : ""
          }
          ${firmenEmail ? `<i class="fas fa-envelope"></i> ${firmenEmail}` : ""}
        </div>
      </div>
      <div>
        <h4 style="color: var(--accent-primary); margin-bottom: 1rem;">Preise & Konditionen</h4>
        <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span>Basis-Stundenpreis:</span>
            <strong>${formatCurrency(parseFloat(basisStundenpreis))}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 0.5rem;">
            <span>MwSt-Satz:</span>
            <strong>${mwstSatz}%</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span>Zahlungsziel:</span>
            <strong>${getSetting("zahlungsziel_tage", "14")} Tage</strong>
          </div>
        </div>
      </div>
    </div>
  `;
}

function updateQuickActions() {
  // Quick-Actions-Widget hinzufügen
  let quickActionsCard = document.getElementById("quick-actions-card");

  if (!quickActionsCard) {
    const auftraegeCard = document
      .querySelector("#dashboard-auftraege")
      .closest(".card");
    quickActionsCard = document.createElement("div");
    quickActionsCard.id = "quick-actions-card";
    quickActionsCard.className = "card";
    quickActionsCard.style.marginBottom = "2rem";

    auftraegeCard.parentNode.insertBefore(quickActionsCard, auftraegeCard);
  }

  quickActionsCard.innerHTML = `
    <div class="card-header">
      <h2 class="card-title">
        <i class="fas fa-bolt"></i>
        Schnellaktionen
      </h2>
    </div>
    <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem;">
      <button class="btn btn-primary" onclick="window.showSection('auftraege'); setTimeout(() => window.showAuftragModal(), 100);" style="padding: 1rem; height: auto; flex-direction: column; gap: 8px;">
        <i class="fas fa-plus-circle" style="font-size: 1.5rem;"></i>
        <span>Neuer Auftrag</span>
      </button>
      <button class="btn btn-success" onclick="window.showSection('rechnungen'); setTimeout(() => window.showRechnungModal(), 100);" style="padding: 1rem; height: auto; flex-direction: column; gap: 8px;">
        <i class="fas fa-file-invoice" style="font-size: 1.5rem;"></i>
        <span>Neue Rechnung</span>
      </button>
      <button class="btn btn-secondary" onclick="window.showSection('kunden'); setTimeout(() => window.showKundenModal(), 100);" style="padding: 1rem; height: auto; flex-direction: column; gap: 8px;">
        <i class="fas fa-user-plus" style="font-size: 1.5rem;"></i>
        <span>Neuer Kunde</span>
      </button>
      <button class="btn btn-warning" onclick="window.showSection('fahrzeuge'); setTimeout(() => window.showFahrzeugModal(), 100);" style="padding: 1rem; height: auto; flex-direction: column; gap: 8px;">
        <i class="fas fa-car" style="font-size: 1.5rem;"></i>
        <span>Neues Fahrzeug</span>
      </button>
    </div>
    
    <div style="margin-top: 2rem; padding-top: 1rem; border-top: 1px solid var(--border-color);">
      <h4 style="margin-bottom: 1rem;">Berichte & Export</h4>
      <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
        <button class="btn btn-sm btn-primary" onclick="exportMonthlyReport()">
          <i class="fas fa-chart-bar"></i> Monatsbericht
        </button>
        <button class="btn btn-sm btn-secondary" onclick="exportCustomerList()">
          <i class="fas fa-users"></i> Kundenliste
        </button>
        <button class="btn btn-sm btn-success" onclick="exportSettings()">
          <i class="fas fa-download"></i> Einstellungen exportieren
        </button>
      </div>
    </div>
  `;
}

// Quick-Action-Funktionen
window.exportMonthlyReport = async function () {
  try {
    const currentMonth = new Date().getMonth() + 1;
    const currentYear = new Date().getFullYear();

    const [auftraege, rechnungen] = await Promise.all([
      apiCall("/api/auftraege"),
      apiCall("/api/rechnungen"),
    ]);

    const monthlyAuftraege = auftraege.filter((a) => {
      const d = new Date(a.datum);
      return (
        d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear
      );
    });

    const monthlyRechnungen = rechnungen.filter((r) => {
      const d = new Date(r.rechnungsdatum);
      return (
        d.getMonth() + 1 === currentMonth && d.getFullYear() === currentYear
      );
    });

    const report = {
      zeitraum: `${currentMonth.toString().padStart(2, "0")}/${currentYear}`,
      auftraege: {
        gesamt: monthlyAuftraege.length,
        offen: monthlyAuftraege.filter((a) => a.status === "offen").length,
        abgeschlossen: monthlyAuftraege.filter(
          (a) => a.status === "abgeschlossen"
        ).length,
        gesamtvolumen: monthlyAuftraege.reduce(
          (sum, a) => sum + (a.gesamt_kosten || 0),
          0
        ),
      },
      rechnungen: {
        gesamt: monthlyRechnungen.length,
        bezahlt: monthlyRechnungen.filter((r) => r.status === "bezahlt").length,
        offen: monthlyRechnungen.filter((r) => r.status === "offen").length,
        umsatz: monthlyRechnungen
          .filter((r) => r.status === "bezahlt")
          .reduce((sum, r) => sum + (r.gesamtbetrag || 0), 0),
      },
      erstellt_am: new Date().toISOString(),
    };

    const blob = new Blob([JSON.stringify(report, null, 2)], {
      type: "application/json",
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `monatsbericht_${currentMonth
      .toString()
      .padStart(2, "0")}_${currentYear}.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("Monatsbericht wurde heruntergeladen", "success");
  } catch (error) {
    showNotification("Fehler beim Erstellen des Monatsberichts", "error");
  }
};

window.exportCustomerList = async function () {
  try {
    const kunden = await apiCall("/api/kunden");

    const csv = [
      "Kunden-Nr,Name,Straße,PLZ,Ort,Telefon,E-Mail,Erstellt am",
      ...kunden.map(
        (k) =>
          `"${k.kunden_nr}","${k.name}","${k.strasse || ""}","${
            k.plz || ""
          }","${k.ort || ""}","${k.telefon || ""}","${
            k.email || ""
          }","${formatDate(k.erstellt_am)}"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `kundenliste_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("Kundenliste wurde heruntergeladen", "success");
  } catch (error) {
    showNotification("Fehler beim Exportieren der Kundenliste", "error");
  }
};

window.exportSettings = async function () {
  try {
    const response = await fetch("/api/einstellungen/export");
    const blob = await response.blob();

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `einstellungen_export_${
      new Date().toISOString().split("T")[0]
    }.json`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("Einstellungen wurden heruntergeladen", "success");
  } catch (error) {
    showNotification("Fehler beim Exportieren der Einstellungen", "error");
  }
};

// Event Listener für Einstellungsänderungen
window.addEventListener("settingsUpdated", () => {
  console.log("Einstellungen wurden aktualisiert - Dashboard reagiert");
  updateFirmenLogo();
  updateFirmenInfo();
});
