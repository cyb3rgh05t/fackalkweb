import { apiCall, formatCurrency, formatDate } from "./utils.js";
import { getSetting } from "./einstellungen.js";
import { showSection } from "./utils.js";
import {
  filterTableByStatus,
  filterTableByMonth,
  clearTableFilters,
} from "./search.js";

export async function loadDashboard() {
  try {
    const [auftraege, rechnungen, kunden, settings] = await Promise.all([
      apiCall("/api/auftraege"),
      apiCall("/api/rechnungen"),
      apiCall("/api/kunden"),
      apiCall("/api/einstellungen"),
    ]);

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

  // Zusätzliche Statistiken hinzufügen (ERST!)
  addExtendedStatistics(auftraege, rechnungen);

  // DANN Cards klickbar machen (für alle Cards)
  setTimeout(() => makeAllCardsClickable(), 100);
}

/**
 * Erweiterte Funktion für ALLE klickbaren Dashboard-Cards (Standard + Erweiterte)
 */
function makeAllCardsClickable() {
  // Warte kurz bis alle Cards geladen sind
  setTimeout(() => {
    const allCards = document.querySelectorAll(".stat-card");
    console.log(`🎯 Mache ${allCards.length} Dashboard-Cards klickbar...`);

    allCards.forEach((card, index) => {
      // Skip wenn bereits klickbar gemacht
      if (card._clickHandlerAdded) return;

      card.style.cursor = "pointer";
      card.style.transition = "all 0.3s ease";
      card.style.userSelect = "none";

      // Verbesserte Hover-Effekte
      card.addEventListener("mouseenter", function () {
        this.style.transform = "translateY(-5px) scale(1.02)";
        this.style.boxShadow = "0 10px 25px rgba(0,0,0,0.15)";
      });

      card.addEventListener("mouseleave", function () {
        this.style.transform = "translateY(0) scale(1)";
        this.style.boxShadow = "var(--shadow)";
      });

      // Erweiterte Click-Handler für alle Cards
      card.addEventListener("click", function () {
        // Visual Feedback
        this.style.transform = "translateY(-2px) scale(0.98)";
        setTimeout(() => {
          this.style.transform = "translateY(-5px) scale(1.02)";
        }, 150);

        // Navigation basierend auf Card-Position und Inhalt
        handleExtendedCardClick(index, this);
      });

      // Tooltips für alle Cards
      setCardTooltip(card, index);

      // Accessibility-Verbesserungen
      card.setAttribute("role", "button");
      card.setAttribute("tabindex", "0");

      // Keyboard-Support
      card.addEventListener("keydown", function (e) {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleExtendedCardClick(index, this);
        }
      });

      // Markiere als verarbeitet
      card._clickHandlerAdded = true;
    });

    console.log(`✅ ${allCards.length} Dashboard-Cards sind jetzt klickbar`);
  }, 100);
}

/**
 * Behandelt Klicks auf alle Dashboard-Cards (Standard + Erweiterte)
 * @param {number} index - Index der geklickten Card
 * @param {HTMLElement} cardElement - Das Card-Element
 */
function handleExtendedCardClick(index, cardElement) {
  console.log(`🎯 Dashboard Card ${index} geklickt`);

  // Versuche Card-Typ über Text-Inhalt zu identifizieren
  const cardText = cardElement.textContent.toLowerCase();

  // Visuelles Feedback
  showCardClickFeedback(index, cardText);

  // Standard-Cards (Index 0-3)
  if (index <= 3) {
    handleStandardCard(index);
  }
  // Erweiterte Cards (Index 4+)
  else {
    handleExtendedCard(index, cardText, cardElement);
  }
}

/**
 * Behandelt Standard-Cards (die ersten 4)
 * @param {number} index - Card-Index (0-3)
 */
function handleStandardCard(index) {
  switch (index) {
    case 0: // Offene Aufträge
      navigateToSectionWithFilter(
        "auftraege",
        "offen",
        "Offene Aufträge werden geladen..."
      );
      break;

    case 1: // Offene Rechnungen
      navigateToSectionWithFilter(
        "rechnungen",
        "offen",
        "Offene Rechnungen werden geladen..."
      );
      break;

    case 2: // Kunden
      navigateToSection("kunden", "Kundenverwaltung wird geladen...");
      break;

    case 3: // Monatsumsatz
      navigateToSectionWithMonthFilter(
        "rechnungen",
        "Rechnungen des aktuellen Monats werden geladen..."
      );
      break;
  }
}

/**
 * Behandelt erweiterte Cards (ab Index 4)
 * @param {number} index - Card-Index (4+)
 * @param {string} cardText - Text-Inhalt der Card
 * @param {HTMLElement} cardElement - Das Card-Element
 */
function handleExtendedCard(index, cardText, cardElement) {
  // Intelligente Erkennung basierend auf Card-Inhalt
  if (cardText.includes("bearbeitung") || cardText.includes("progress")) {
    // Aufträge in Bearbeitung
    navigateToSectionWithFilter(
      "auftraege",
      "in_bearbeitung",
      "Aufträge in Bearbeitung werden geladen..."
    );
  } else if (
    cardText.includes("überfällig") ||
    cardText.includes("overdue") ||
    cardText.includes("mahnung")
  ) {
    // Überfällige Rechnungen
    navigateToOverdueInvoices("Überfällige Rechnungen werden geladen...");
  } else if (
    cardText.includes("auftragswert") ||
    cardText.includes("durchschnitt")
  ) {
    // Durchschnittlicher Auftragswert - zeige alle Aufträge mit Kosten
    navigateToSectionWithFilter(
      "auftraege",
      "abgeschlossen",
      "Abgeschlossene Aufträge werden geladen..."
    );
  } else if (cardText.includes("jahresumsatz") || cardText.includes("umsatz")) {
    // Jahresumsatz - zeige bezahlte Rechnungen des aktuellen Jahres
    navigateToYearlyRevenue("Jahresumsatz wird geladen...");
  } else {
    // Fallback für unbekannte erweiterte Cards
    console.log(`🤷 Unbekannte erweiterte Card: ${cardText}`);
    navigateToSection("dashboard", "Dashboard wird aktualisiert...");
  }
}

/**
 * Navigiert zu überfälligen Rechnungen
 * @param {string} message - Feedback-Nachricht
 */
function navigateToOverdueInvoices(message) {
  console.log("🚨 Navigation zu überfälligen Rechnungen");

  if (window.showNotification) {
    window.showNotification(message, "warning", 2000);
  }

  if (window.showSection) {
    window.showSection("rechnungen", true);
  }

  // Spezial-Filter für überfällige Rechnungen
  setTimeout(() => applyOverdueFilter(), 400);
  setTimeout(() => applyOverdueFilter(), 1000); // Backup
}

/**
 * Navigiert zu Jahresumsatz (bezahlte Rechnungen des aktuellen Jahres)
 * @param {string} message - Feedback-Nachricht
 */
function navigateToYearlyRevenue(message) {
  console.log("📊 Navigation zu Jahresumsatz");

  if (window.showNotification) {
    window.showNotification(message, "info", 2000);
  }

  if (window.showSection) {
    window.showSection("rechnungen", true);
  }

  // Filter für bezahlte Rechnungen des aktuellen Jahres
  setTimeout(() => applyYearlyRevenueFilter(), 400);
  setTimeout(() => applyYearlyRevenueFilter(), 1000); // Backup
}

/**
 * Wendet Filter für überfällige Rechnungen an
 */
function applyOverdueFilter() {
  const tableId = "rechnungen-table";
  const searchInputId = "rechnungen-search";

  console.log("🚨 Wende Überfällig-Filter an");

  const table = document.getElementById(tableId);
  if (!table) {
    console.warn("⚠️ Rechnungen-Tabelle nicht gefunden");
    return;
  }

  // Hole Zahlungsziel aus Einstellungen (Standard: 14 Tage)
  const zahlungszielTage = parseInt(
    window.getSetting?.("zahlungsziel_tage", "14") || "14"
  );
  const today = new Date();

  const rows = table.querySelectorAll("tbody tr");
  let matchCount = 0;

  rows.forEach((row) => {
    let isOverdue = false;
    const cells = row.querySelectorAll("td");

    // Suche Status-Zelle (muss "offen" sein)
    let statusCell = null;
    let dateCell = null;

    cells.forEach((cell) => {
      const text = cell.textContent.toLowerCase().trim();

      // Status-Zelle finden
      if (
        text === "offen" ||
        cell.querySelector(".status") ||
        cell.querySelector("select.status")
      ) {
        statusCell = cell;
      }

      // Datum-Zelle finden (DD.MM.YYYY Format)
      if (text.match(/\d{1,2}\.\d{1,2}\.\d{4}/)) {
        dateCell = cell;
      }
    });

    // Prüfe ob Rechnung überfällig ist
    if (statusCell && dateCell) {
      const statusText = statusCell.textContent.toLowerCase().trim();
      const dateMatch = dateCell.textContent.match(
        /(\d{1,2})\.(\d{1,2})\.(\d{4})/
      );

      if (statusText === "offen" && dateMatch) {
        const [, day, month, year] = dateMatch;
        const rechnungsDatum = new Date(year, month - 1, day);
        const diffTime = today - rechnungsDatum;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays > zahlungszielTage) {
          isOverdue = true;
        }
      }
    }

    row.style.display = isOverdue ? "" : "none";
    if (isOverdue) {
      matchCount++;
      row.classList.add("overdue-filtered");
    } else {
      row.classList.remove("overdue-filtered");
    }
  });

  // Suchfeld aktualisieren
  const searchInput = document.getElementById(searchInputId);
  if (searchInput) {
    searchInput.value = `Überfällig (>${zahlungszielTage} Tage)`;
    searchInput.style.backgroundColor = "var(--danger-color)";
    searchInput.style.color = "white";
    searchInput.style.fontWeight = "bold";

    setTimeout(() => {
      searchInput.style.backgroundColor = "";
      searchInput.style.color = "";
      searchInput.style.fontWeight = "";
    }, 3000);
  }

  console.log(
    `🚨 Überfällig-Filter: ${matchCount}/${rows.length} Zeilen für >${zahlungszielTage} Tage`
  );
}

/**
 * Wendet Filter für Jahresumsatz an (bezahlte Rechnungen des aktuellen Jahres)
 */
function applyYearlyRevenueFilter() {
  const tableId = "rechnungen-table";
  const searchInputId = "rechnungen-search";

  console.log("📊 Wende Jahresumsatz-Filter an");

  const table = document.getElementById(tableId);
  if (!table) {
    console.warn("⚠️ Rechnungen-Tabelle nicht gefunden");
    return;
  }

  const currentYear = new Date().getFullYear();
  const rows = table.querySelectorAll("tbody tr");
  let matchCount = 0;

  rows.forEach((row) => {
    let matches = false;
    const cells = row.querySelectorAll("td");

    let statusIsPaid = false;
    let dateIsCurrentYear = false;

    cells.forEach((cell) => {
      const text = cell.textContent.toLowerCase().trim();

      // Status-Prüfung
      if (text === "bezahlt") {
        statusIsPaid = true;
      }

      // Datum-Prüfung (DD.MM.YYYY Format)
      const dateMatch = text.match(/\d{1,2}\.\d{1,2}\.(\d{4})/);
      if (dateMatch && parseInt(dateMatch[1]) === currentYear) {
        dateIsCurrentYear = true;
      }
    });

    matches = statusIsPaid && dateIsCurrentYear;

    row.style.display = matches ? "" : "none";
    if (matches) {
      matchCount++;
      row.classList.add("yearly-filtered");
    } else {
      row.classList.remove("yearly-filtered");
    }
  });

  // Suchfeld aktualisieren
  const searchInput = document.getElementById(searchInputId);
  if (searchInput) {
    searchInput.value = `Jahresumsatz ${currentYear} (Bezahlt)`;
    searchInput.style.backgroundColor = "var(--success-color)";
    searchInput.style.color = "white";
    searchInput.style.fontWeight = "bold";

    setTimeout(() => {
      searchInput.style.backgroundColor = "";
      searchInput.style.color = "";
      searchInput.style.fontWeight = "";
    }, 3000);
  }

  console.log(
    `📊 Jahresumsatz-Filter: ${matchCount}/${rows.length} bezahlte Rechnungen für ${currentYear}`
  );
}

/**
 * Setzt die richtigen Tooltips für alle Cards
 * @param {HTMLElement} card - Card-Element
 * @param {number} index - Card-Index
 */
function setCardTooltip(card, index) {
  const cardText = card.textContent.toLowerCase();
  let tooltip = "Klicken für Details";

  // Standard-Cards (0-3)
  if (index === 0) tooltip = "Klicken um zu offenen Aufträgen zu gelangen";
  else if (index === 1)
    tooltip = "Klicken um zu offenen Rechnungen zu gelangen";
  else if (index === 2) tooltip = "Klicken um zur Kundenverwaltung zu gelangen";
  else if (index === 3)
    tooltip = "Klicken um zu Rechnungen des aktuellen Monats zu gelangen";
  // Erweiterte Cards (4+) - basierend auf Inhalt
  else if (cardText.includes("bearbeitung")) {
    tooltip = "Klicken um zu Aufträgen in Bearbeitung zu gelangen";
  } else if (cardText.includes("überfällig")) {
    tooltip = "Klicken um zu überfälligen Rechnungen zu gelangen";
  } else if (cardText.includes("auftragswert")) {
    tooltip = "Klicken um zu abgeschlossenen Aufträgen zu gelangen";
  } else if (cardText.includes("jahresumsatz")) {
    tooltip = "Klicken um zum Jahresumsatz zu gelangen";
  }

  card.title = tooltip;
  card.setAttribute("aria-label", tooltip);
}

/**
 * Zeigt verbessertes visuelles Feedback beim Card-Klick
 * @param {number} cardIndex - Index der geklickten Card
 * @param {string} cardText - Text-Inhalt der Card
 */
function showCardClickFeedback(cardIndex, cardText) {
  let message = "📊 Lade Daten...";
  let type = "info";

  // Spezifische Nachrichten basierend auf Card-Inhalt
  if (cardText.includes("bearbeitung")) {
    message = "⚙️ Lade Aufträge in Bearbeitung...";
    type = "info";
  } else if (cardText.includes("überfällig")) {
    message = "🚨 Lade überfällige Rechnungen...";
    type = "warning";
  } else if (cardText.includes("auftragswert")) {
    message = "💰 Lade Auftragswerte...";
    type = "info";
  } else if (cardText.includes("jahresumsatz")) {
    message = "📈 Lade Jahresumsatz...";
    type = "success";
  }
  // Standard-Cards
  else if (cardIndex === 0) {
    message = "📋 Lade offene Aufträge...";
  } else if (cardIndex === 1) {
    message = "💰 Lade offene Rechnungen...";
  } else if (cardIndex === 2) {
    message = "👥 Öffne Kundenverwaltung...";
  } else if (cardIndex === 3) {
    message = "📊 Filtere Monatsumsatz...";
  }

  if (window.showNotification) {
    window.showNotification(message, type, 1500);
  }
}

/**
 * Navigiert zu einer Section mit Status-Filter
 * @param {string} sectionId - Ziel-Section
 * @param {string} status - Status zum Filtern
 * @param {string} message - Feedback-Nachricht
 */
function navigateToSectionWithFilter(sectionId, status, message) {
  console.log(`🧭 Navigation zu ${sectionId} mit Status-Filter: ${status}`);

  // Feedback anzeigen
  if (window.showNotification) {
    window.showNotification(message, "info", 2000);
  }

  // Zur Section navigieren
  if (window.showSection) {
    window.showSection(sectionId, true);
  }

  // Filter nach kurzer Verzögerung anwenden (für sicheres Laden)
  setTimeout(() => applyStatusFilter(sectionId, status), 400);

  // Backup-Filter nach längerer Verzögerung falls erste Anwendung fehlschlägt
  setTimeout(() => applyStatusFilter(sectionId, status), 1000);
}

/**
 * Navigiert zu einer Section mit Monats-Filter
 * @param {string} sectionId - Ziel-Section
 * @param {string} message - Feedback-Nachricht
 */
function navigateToSectionWithMonthFilter(sectionId, message) {
  console.log(`🧭 Navigation zu ${sectionId} mit Monats-Filter`);

  // Feedback anzeigen
  if (window.showNotification) {
    window.showNotification(message, "info", 2000);
  }

  // Zur Section navigieren
  if (window.showSection) {
    window.showSection(sectionId, true);
  }

  // Filter nach kurzer Verzögerung anwenden
  setTimeout(() => applyMonthFilter(sectionId), 400);

  // Backup-Filter
  setTimeout(() => applyMonthFilter(sectionId), 1000);
}

/**
 * Navigiert zu einer Section ohne Filter
 * @param {string} sectionId - Ziel-Section
 * @param {string} message - Feedback-Nachricht
 */
function navigateToSection(sectionId, message) {
  console.log(`🧭 Navigation zu ${sectionId}`);

  // Feedback anzeigen
  if (window.showNotification) {
    window.showNotification(message, "info", 2000);
  }

  // Zur Section navigieren
  if (window.showSection) {
    window.showSection(sectionId, true);
  }
}

/**
 * Wendet Status-Filter auf eine Section an
 * @param {string} sectionId - Section ID
 * @param {string} status - Status zum Filtern
 */
function applyStatusFilter(sectionId, status) {
  const tableId = `${sectionId}-table`;
  const searchInputId = `${sectionId}-search`;

  console.log(`🎯 Wende Status-Filter an: ${tableId} -> ${status}`);

  // Filter anwenden
  filterTableByStatus(tableId, status);

  // Suchfeld visuell aktualisieren
  updateSearchInputForStatus(searchInputId, status);
}

/**
 * Wendet Monats-Filter auf eine Section an
 * @param {string} sectionId - Section ID
 */
function applyMonthFilter(sectionId) {
  const tableId = `${sectionId}-table`;
  const searchInputId = `${sectionId}-search`;

  console.log(`📅 Wende Monats-Filter an: ${tableId}`);

  // Filter anwenden
  filterTableByMonth(tableId);

  // Suchfeld visuell aktualisieren
  updateSearchInputForMonth(searchInputId);
}

/**
 * Aktualisiert das Suchfeld für Status-Filter
 * @param {string} searchInputId - Such-Input ID
 * @param {string} status - Status
 */
function updateSearchInputForStatus(searchInputId, status) {
  const searchInput = document.getElementById(searchInputId);
  if (!searchInput) return;

  const displayText = getDisplayTextForStatus(status);
  searchInput.value = displayText;

  // Visuelles Feedback
  searchInput.style.backgroundColor = "var(--accent-color)";
  searchInput.style.color = "white";
  searchInput.style.fontWeight = "bold";

  // Nach 3 Sekunden zurücksetzen
  setTimeout(() => {
    searchInput.style.backgroundColor = "";
    searchInput.style.color = "";
    searchInput.style.fontWeight = "";
  }, 3000);
}

/**
 * Aktualisiert das Suchfeld für Monats-Filter
 * @param {string} searchInputId - Such-Input ID
 */
function updateSearchInputForMonth(searchInputId) {
  const searchInput = document.getElementById(searchInputId);
  if (!searchInput) return;

  const currentMonth = new Date().toLocaleDateString("de-DE", {
    month: "long",
  });
  searchInput.value = `${currentMonth} (Monat)`;

  // Visuelles Feedback
  searchInput.style.backgroundColor = "var(--success-color)";
  searchInput.style.color = "white";
  searchInput.style.fontWeight = "bold";

  setTimeout(() => {
    searchInput.style.backgroundColor = "";
    searchInput.style.color = "";
    searchInput.style.fontWeight = "";
  }, 3000);
}

/**
 * Hilfsfunktion für bessere Anzeige der Status-Werte
 * @param {string} status - Status-Wert
 * @returns {string} - Anzeige-Text
 */
function getDisplayTextForStatus(status) {
  const statusDisplayMap = {
    // Aufträge
    offen: "Offen",
    in_bearbeitung: "In Bearbeitung",
    abgeschlossen: "Abgeschlossen",
    storniert: "Storniert",

    // Rechnungen
    bezahlt: "Bezahlt",
    mahnung: "Mahnung",
    teilbezahlt: "Teilbezahlt",

    // Fahrzeughandel (falls vorhanden)
    verkauft: "Verkauft",
    reserviert: "Reserviert",
  };

  return (
    statusDisplayMap[status] || status.charAt(0).toUpperCase() + status.slice(1)
  );
}

// Hilfsfunktionen für Filterung (optional)
/**
 * Filtert Aufträge nach Status (für Dashboard-Buttons)
 * @param {string} status - Status zum Filtern
 */
function filterAuftraege(status) {
  console.log(`🔍 Filtere Aufträge nach Status: ${status}`);

  // Sichere Anwendung des Filters
  const tableId = "auftraege-table";
  const searchInputId = "auftraege-search";

  // Prüfen ob Tabelle existiert
  const table = document.getElementById(tableId);
  if (!table) {
    console.warn(`⚠️ Tabelle ${tableId} nicht gefunden`);
    return;
  }

  // Filter anwenden
  filterTableByStatus(tableId, status);
  updateSearchInputForStatus(searchInputId, status);

  console.log(`✅ Aufträge-Filter "${status}" angewendet`);
}

/**
 * Filtert Rechnungen nach Status (für Dashboard-Buttons)
 * @param {string} status - Status zum Filtern
 */
function filterRechnungen(status) {
  console.log(`🔍 Filtere Rechnungen nach Status: ${status}`);

  const tableId = "rechnungen-table";
  const searchInputId = "rechnungen-search";

  const table = document.getElementById(tableId);
  if (!table) {
    console.warn(`⚠️ Tabelle ${tableId} nicht gefunden`);
    return;
  }

  filterTableByStatus(tableId, status);
  updateSearchInputForStatus(searchInputId, status);

  console.log(`✅ Rechnungen-Filter "${status}" angewendet`);
}

function filterRechnungenByMonth() {
  console.log(`🔍 Filtere Rechnungen nach aktuellem Monat`);

  const tableId = "rechnungen-table";
  const searchInputId = "rechnungen-search";

  const table = document.getElementById(tableId);
  if (!table) {
    console.warn(`⚠️ Tabelle ${tableId} nicht gefunden`);
    return;
  }

  filterTableByMonth(tableId);
  updateSearchInputForMonth(searchInputId);

  console.log(`✅ Rechnungen-Monatsfilter angewendet`);
}

/**
 * Setzt alle Filter für eine Tabelle zurück
 * @param {string} tableId - Tabellen-ID
 */
function clearAllFilters(tableId) {
  console.log(`🧹 Setze Filter für ${tableId} zurück`);

  const table = document.getElementById(tableId);
  if (!table) {
    console.warn(`⚠️ Tabelle ${tableId} nicht gefunden`);
    return;
  }

  clearTableFilters(tableId);
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

/**
 * Fügt erweiterte Filter-Controls zum Dashboard hinzu
 */
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
    <h3 style="margin: 0 0 1rem 0; color: var(--text-primary);">
      <i class="fas fa-filter"></i> Schnellfilter
    </h3>
    <div style="display: flex; gap: 1rem; flex-wrap: wrap;">
      <div class="filter-group">
        <label style="font-weight: 600; margin-right: 0.5rem;">Aufträge:</label>
        <button class="btn btn-sm btn-secondary" onclick="clearAllFilters('auftraege-table')">
          <i class="fas fa-times"></i> Alle
        </button>
        <button class="btn btn-sm btn-warning" onclick="filterAuftraege('offen')">
          <i class="fas fa-clock"></i> Offen
        </button>
        <button class="btn btn-sm btn-info" onclick="filterAuftraege('in_bearbeitung')">
          <i class="fas fa-cog"></i> In Bearbeitung
        </button>
        <button class="btn btn-sm btn-success" onclick="filterAuftraege('abgeschlossen')">
          <i class="fas fa-check"></i> Abgeschlossen
        </button>
      </div>
      <div class="filter-group">
        <label style="font-weight: 600; margin-right: 0.5rem;">Rechnungen:</label>
        <button class="btn btn-sm btn-secondary" onclick="clearAllFilters('rechnungen-table')">
          <i class="fas fa-times"></i> Alle
        </button>
        <button class="btn btn-sm btn-warning" onclick="filterRechnungen('offen')">
          <i class="fas fa-clock"></i> Offen
        </button>
        <button class="btn btn-sm btn-success" onclick="filterRechnungen('bezahlt')">
          <i class="fas fa-check-circle"></i> Bezahlt
        </button>
        <button class="btn btn-sm btn-danger" onclick="filterRechnungen('mahnung')">
          <i class="fas fa-exclamation-triangle"></i> Mahnung
        </button>
        <button class="btn btn-sm btn-info" onclick="filterRechnungenByMonth()">
          <i class="fas fa-calendar"></i> Aktueller Monat
        </button>
      </div>
    </div>
  `;

  dashboardContainer.insertBefore(
    filterContainer,
    dashboardContainer.firstChild
  );
  console.log("✅ Erweiterte Filter-Controls hinzugefügt");
}

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
      <tr onclick="viewAuftrag(${
        auftrag.id
      })" style="cursor: pointer;" title="Klicken zum Öffnen">
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
          : auftrag.status === "storniert"
          ? "Storniert"
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

    if (window.showNotification) {
      window.showNotification("Monatsbericht wurde heruntergeladen", "success");
    }
  } catch (error) {
    if (window.showNotification) {
      window.showNotification(
        "Fehler beim Erstellen des Monatsberichts",
        "error"
      );
    }
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

    if (window.showNotification) {
      window.showNotification("Kundenliste wurde heruntergeladen", "success");
    }
  } catch (error) {
    if (window.showNotification) {
      window.showNotification(
        "Fehler beim Exportieren der Kundenliste",
        "error"
      );
    }
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

    if (window.showNotification) {
      window.showNotification(
        "Einstellungen wurden heruntergeladen",
        "success"
      );
    }
  } catch (error) {
    if (window.showNotification) {
      window.showNotification(
        "Fehler beim Exportieren der Einstellungen",
        "error"
      );
    }
  }
};

// Exportiere die Funktionen für globale Verwendung
window.filterAuftraege = filterAuftraege;
window.filterRechnungen = filterRechnungen;
window.filterRechnungenByMonth = filterRechnungenByMonth;
window.clearAllFilters = clearAllFilters;
window.debugCurrentFilters = debugCurrentFilters;
window.addFilterControls = addFilterControls;
window.makeCardsClickable = makeAllCardsClickable; // Überschrieben mit erweiterter Version
window.makeAllCardsClickable = makeAllCardsClickable;
window.applyOverdueFilter = applyOverdueFilter;
window.applyYearlyRevenueFilter = applyYearlyRevenueFilter;

// Auto-Setup beim Laden
document.addEventListener("DOMContentLoaded", () => {
  console.log("🎛️ Dashboard-Filter-System wird initialisiert...");

  // Filter-Controls nach kurzer Verzögerung hinzufügen
  setTimeout(() => {
    if (window.location.hash === "#dashboard" || !window.location.hash) {
      addFilterControls();
    }
  }, 1000);

  // Mehrfache Versuche um sicherzustellen dass alle Cards erfasst werden
  setTimeout(() => makeAllCardsClickable(), 1500); // Nach addExtendedStatistics
  setTimeout(() => makeAllCardsClickable(), 2500); // Fallback
});

// Bei Section-Wechsel zum Dashboard erweiterte Cards erneut klickbar machen
window.addEventListener("sectionChanged", (event) => {
  if (event.detail.sectionId === "dashboard") {
    setTimeout(() => makeAllCardsClickable(), 500);
  }
});

// Event Listener für Einstellungsänderungen
window.addEventListener("settingsUpdated", () => {
  console.log("Einstellungen wurden aktualisiert - Dashboard reagiert");
  updateFirmenLogo();
  updateFirmenInfo();
});

console.log(
  "✅ Erweiterte Dashboard-Filter mit allen klickbaren Cards geladen"
);
