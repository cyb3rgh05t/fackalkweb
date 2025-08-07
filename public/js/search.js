const statusMapping = {
  // Aufträge - ERWEITERT um "storniert"
  offen: ["offen", "Offen", "open"],
  in_bearbeitung: [
    "in_bearbeitung",
    "in bearbeitung",
    "In Bearbeitung",
    "bearbeitung",
    "in-bearbeitung",
    "progress",
    "in progress",
    "wip",
  ],
  abgeschlossen: [
    "abgeschlossen",
    "Abgeschlossen",
    "fertig",
    "erledigt",
    "completed",
    "done",
    "finished",
  ],
  storniert: [
    "storniert",
    "Storniert",
    "cancelled",
    "canceled",
    "cancel",
    "abgebrochen",
    "abbruch",
    "void",
    "invalid",
  ],

  // Rechnungen (bestehend)
  bezahlt: ["bezahlt", "Bezahlt", "paid", "bezahlen", "payment"],
  mahnung: ["mahnung", "Mahnung", "reminder", "mahnen", "overdue"],
  teilbezahlt: ["teilbezahlt", "partial", "teilweise", "angezahlt"],

  // Gemeinsame Status-Begriffe
  offen: ["offen", "Offen", "open", "pending", "new"],
};

// Debug-Flag für erweiterte Logs
const DEBUG_SEARCH = false;

/**
 * Hauptfunktion: Fügt intelligente Suchfunktionalität zu einer Tabelle hinzu
 * @param {string} tableId - ID der Tabelle
 * @param {string} searchInputId - ID des Such-Inputs
 */
export function addSearchToTable(tableId, searchInputId) {
  const searchInput = document.getElementById(searchInputId);
  const table = document.getElementById(tableId);

  if (!searchInput || !table) {
    console.warn(
      `⚠️ Search-Setup fehlgeschlagen: ${tableId} oder ${searchInputId} nicht gefunden`
    );
    return;
  }

  if (DEBUG_SEARCH) {
    console.log(`🔍 Initialisiere Search für: ${tableId} -> ${searchInputId}`);
  }

  // Event-Listener für Eingabe
  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase().trim();
    performTableSearch(table, searchTerm, tableId);
  });

  // Enter-Taste für bessere UX
  searchInput.addEventListener("keydown", function (e) {
    if (e.key === "Enter") {
      e.preventDefault();
      this.blur(); // Focus entfernen
    }
  });

  if (DEBUG_SEARCH) {
    console.log(`✅ Search aktiviert für: ${tableId}`);
  }
}

/**
 * Führt die eigentliche Suche in der Tabelle durch
 * @param {HTMLElement} table - Tabellen-Element
 * @param {string} searchTerm - Suchbegriff
 * @param {string} tableId - Tabellen-ID für Debug
 */
function performTableSearch(table, searchTerm, tableId) {
  const rows = table.querySelectorAll("tbody tr");
  let visibleCount = 0;

  if (!searchTerm) {
    // Alle Zeilen anzeigen wenn Suchfeld leer
    rows.forEach((row) => {
      row.style.display = "";
      row.classList.remove("search-highlight");
    });
    if (DEBUG_SEARCH) {
      console.log(
        `🔍 ${tableId}: Alle ${rows.length} Zeilen angezeigt (Suche geleert)`
      );
    }
    return;
  }

  rows.forEach((row, index) => {
    let shouldShow = false;

    // 1. Prüfe auf Status-spezifische Suche
    if (isStatusSearch(searchTerm, row)) {
      shouldShow = true;
      if (DEBUG_SEARCH) {
        console.log(`🎯 Status-Match in Zeile ${index + 1}: ${searchTerm}`);
      }
    }
    // 2. Prüfe auf Datum/Monats-Suche
    else if (isDateSearch(searchTerm, row)) {
      shouldShow = true;
      if (DEBUG_SEARCH) {
        console.log(`📅 Datum-Match in Zeile ${index + 1}: ${searchTerm}`);
      }
    }
    // 3. Fallback: normale Textsuche
    else if (isTextSearch(searchTerm, row)) {
      shouldShow = true;
      if (DEBUG_SEARCH) {
        console.log(`📝 Text-Match in Zeile ${index + 1}: ${searchTerm}`);
      }
    }

    // Zeile anzeigen/verstecken
    row.style.display = shouldShow ? "" : "none";

    // Highlight-Klasse für gefundene Zeilen
    if (shouldShow) {
      row.classList.add("search-highlight");
      visibleCount++;
    } else {
      row.classList.remove("search-highlight");
    }
  });

  if (DEBUG_SEARCH) {
    console.log(
      `🔍 ${tableId}: ${visibleCount}/${rows.length} Zeilen gefunden für "${searchTerm}"`
    );
  }
}

/**
 * Prüft ob es sich um eine Status-basierte Suche handelt
 * @param {string} searchTerm - Suchbegriff
 * @param {HTMLElement} row - Tabellen-Zeile
 * @returns {boolean}
 */
function isStatusSearch(searchTerm, row) {
  const statusCell = findStatusCell(row);
  if (!statusCell) return false;

  const currentStatus = extractStatusFromCell(statusCell);
  if (!currentStatus) return false;

  return doesStatusMatch(searchTerm, currentStatus);
}

/**
 * Prüft ob es sich um eine Datum/Monats-Suche handelt
 * @param {string} searchTerm - Suchbegriff
 * @param {HTMLElement} row - Tabellen-Zeile
 * @returns {boolean}
 */
function isDateSearch(searchTerm, row) {
  const cells = row.querySelectorAll("td");

  // Deutsche Monatsnamen für Suche
  const germanMonths = [
    "januar",
    "februar",
    "märz",
    "april",
    "mai",
    "juni",
    "juli",
    "august",
    "september",
    "oktober",
    "november",
    "dezember",
  ];

  // Prüfe ob Suchterm ein Monat ist
  const isMonthSearch = germanMonths.some(
    (month) => searchTerm.includes(month) || month.includes(searchTerm)
  );

  if (!isMonthSearch && !searchTerm.includes("monat")) {
    return false;
  }

  // Suche nach Datumsfeldern in der Zeile
  for (let cell of cells) {
    const text = cell.textContent.toLowerCase();

    // Direkter Monatsname-Match
    if (
      germanMonths.some(
        (month) => text.includes(month) && searchTerm.includes(month)
      )
    ) {
      return true;
    }

    // Datumsformat DD.MM.YYYY prüfen
    const dateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
    if (dateMatch) {
      const [, day, month, year] = dateMatch;
      const monthIndex = parseInt(month) - 1;

      if (monthIndex >= 0 && monthIndex < 12) {
        const monthName = germanMonths[monthIndex];
        if (searchTerm.includes(monthName)) {
          return true;
        }
      }
    }
  }

  return false;
}

/**
 * Prüft normale Textsuche
 * @param {string} searchTerm - Suchbegriff
 * @param {HTMLElement} row - Tabellen-Zeile
 * @returns {boolean}
 */
function isTextSearch(searchTerm, row) {
  const text = row.textContent.toLowerCase();
  return text.includes(searchTerm);
}

/**
 * Findet die Status-Spalte in einer Tabellenzeile (VERBESSERT)
 * @param {HTMLElement} row - Tabellen-Zeile
 * @returns {HTMLElement|null}
 */
function findStatusCell(row) {
  const cells = row.querySelectorAll("td");

  // Mehrere Erkennungsstrategien
  for (let cell of cells) {
    // 1. Status-Select-Element
    if (cell.querySelector("select.status, select[name*='status']")) {
      return cell;
    }

    // 2. Status-Span-Element mit Klasse
    if (cell.querySelector("span.status, span[class*='status-']")) {
      return cell;
    }

    // 3. Zelle selbst hat Status-Klasse
    if (
      cell.classList.contains("status") ||
      Array.from(cell.classList).some((cls) => cls.includes("status"))
    ) {
      return cell;
    }

    // 4. Text-basierte Erkennung (deutsche Status-Wörter)
    const text = cell.textContent.toLowerCase().trim();
    const statusKeywords = [
      "offen",
      "bearbeitung",
      "abgeschlossen",
      "bezahlt",
      "mahnung",
      "storniert",
      "fertig",
      "erledigt",
    ];

    if (
      statusKeywords.some(
        (keyword) => text === keyword || text.includes(keyword)
      )
    ) {
      return cell;
    }
  }

  return null;
}

/**
 * Extrahiert den Status-Wert aus einer Zelle (VERBESSERT)
 * @param {HTMLElement} cell - Status-Zelle
 * @returns {string|null}
 */
function extractStatusFromCell(cell) {
  // 1. Aus Select-Element
  const select = cell.querySelector("select");
  if (select && select.value) {
    return select.value.toLowerCase().replace("-", "_");
  }

  // 2. Aus Span-Element mit Status-Klassen
  const statusSpan = cell.querySelector("span[class*='status']");
  if (statusSpan) {
    // Extrahiere aus CSS-Klassen (z.B. "status-offen" -> "offen")
    const statusClasses = Array.from(statusSpan.classList);
    for (let className of statusClasses) {
      if (className.startsWith("status-")) {
        return className.replace("status-", "").replace("-", "_");
      }
    }

    // Fallback: Text-Content verwenden
    const text = statusSpan.textContent.toLowerCase().trim();
    return normalizeStatusText(text);
  }

  // 3. Direkter Text aus Zelle
  const text = cell.textContent.toLowerCase().trim();
  return normalizeStatusText(text);
}

/**
 * Normalisiert Status-Text für Vergleiche
 * @param {string} text - Rohtext
 * @returns {string}
 */
function normalizeStatusText(text) {
  // Mapping für deutsche Status-Begriffe
  const normalizations = {
    "in bearbeitung": "in_bearbeitung",
    "in-bearbeitung": "in_bearbeitung",
    bearbeitung: "in_bearbeitung",
    wip: "in_bearbeitung",
    progress: "in_bearbeitung",
    fertig: "abgeschlossen",
    erledigt: "abgeschlossen",
    done: "abgeschlossen",
    finished: "abgeschlossen",
    completed: "abgeschlossen",
    abgebrochen: "storniert",
    abbruch: "storniert",
    cancelled: "storniert",
    canceled: "storniert",
    cancel: "storniert",
    void: "storniert",
    invalid: "storniert",
    paid: "bezahlt",
    payment: "bezahlt",
    bezahlen: "bezahlt",
    reminder: "mahnung",
    mahnen: "mahnung",
    overdue: "mahnung",
    partial: "teilbezahlt",
    teilweise: "teilbezahlt",
    angezahlt: "teilbezahlt",
    pending: "offen",
    new: "offen",
  };

  return normalizations[text] || text.replace(/\s+/g, "_").replace(/-/g, "_");
}

/**
 * Prüft ob ein Suchterm zu einem Status passt
 * @param {string} searchTerm - Suchbegriff
 * @param {string} currentStatus - Aktueller Status
 * @returns {boolean}
 */
function doesStatusMatch(searchTerm, currentStatus) {
  // Direkte Übereinstimmung
  if (currentStatus === searchTerm) return true;

  // Normalisierte Übereinstimmung
  const normalizedSearch = normalizeStatusText(searchTerm);
  const normalizedCurrent = normalizeStatusText(currentStatus);

  if (normalizedCurrent === normalizedSearch) return true;

  // Status-Mapping prüfen
  for (let [key, variations] of Object.entries(statusMapping)) {
    if (variations.some((v) => v.toLowerCase() === searchTerm)) {
      return (
        currentStatus === key ||
        normalizedCurrent === key ||
        variations.some((v) => v.toLowerCase() === currentStatus)
      );
    }
  }

  return false;
}

// ERWEITERTE FILTER-FUNKTIONEN FÜR DASHBOARD-INTEGRATION

/**
 * Filtert Tabelle nach Status (für Dashboard-Cards)
 * @param {string} tableId - Tabellen-ID
 * @param {string} status - Status zum Filtern
 */
export function filterTableByStatus(tableId, status) {
  const table = document.getElementById(tableId);
  if (!table) {
    console.warn(`⚠️ filterTableByStatus: Tabelle ${tableId} nicht gefunden`);
    return;
  }

  // Warte falls Tabelle noch lädt
  if (table.querySelector("tbody").children.length === 0) {
    console.log(`⏳ Tabelle ${tableId} lädt noch, wiederhole in 500ms...`);
    setTimeout(() => filterTableByStatus(tableId, status), 500);
    return;
  }

  const rows = table.querySelectorAll("tbody tr");
  let matchCount = 0;

  if (DEBUG_SEARCH) {
    console.log(`🎯 Filtere ${tableId} nach Status: ${status}`);
  }

  rows.forEach((row, index) => {
    const statusCell = findStatusCell(row);
    if (!statusCell) {
      row.style.display = "none";
      return;
    }

    const currentStatus = extractStatusFromCell(statusCell);
    const shouldShow = doesStatusMatch(status.toLowerCase(), currentStatus);

    row.style.display = shouldShow ? "" : "none";

    if (shouldShow) {
      matchCount++;
      row.classList.add("status-filtered");
    } else {
      row.classList.remove("status-filtered");
    }

    if (DEBUG_SEARCH && shouldShow) {
      console.log(
        `✅ Zeile ${index + 1}: Status "${currentStatus}" matched "${status}"`
      );
    }
  });

  console.log(
    `🎯 Status-Filter ${tableId}: ${matchCount}/${rows.length} Zeilen für "${status}"`
  );
}

/**
 * Filtert Tabelle nach Monat (für Rechnungen)
 * @param {string} tableId - Tabellen-ID
 * @param {string} month - Monat (optional, Standard: aktueller Monat)
 */
export function filterTableByMonth(tableId, month = null) {
  const table = document.getElementById(tableId);
  if (!table) {
    console.warn(`⚠️ filterTableByMonth: Tabelle ${tableId} nicht gefunden`);
    return;
  }

  const targetMonth =
    month || new Date().toLocaleDateString("de-DE", { month: "long" });
  const rows = table.querySelectorAll("tbody tr");
  let matchCount = 0;

  if (DEBUG_SEARCH) {
    console.log(`📅 Filtere ${tableId} nach Monat: ${targetMonth}`);
  }

  rows.forEach((row, index) => {
    const cells = row.querySelectorAll("td");
    let dateFound = false;

    // Suche nach Datum in den Zellen
    for (let cell of cells) {
      const text = cell.textContent.toLowerCase();

      // Direkter Monatsname-Match
      if (text.includes(targetMonth.toLowerCase())) {
        dateFound = true;
        break;
      }

      // Datumsformat DD.MM.YYYY prüfen
      const dateMatch = text.match(/(\d{1,2})\.(\d{1,2})\.(\d{4})/);
      if (dateMatch) {
        try {
          const [, day, month, year] = dateMatch;
          const date = new Date(year, month - 1, day);
          const cellMonth = date.toLocaleDateString("de-DE", { month: "long" });

          if (cellMonth.toLowerCase() === targetMonth.toLowerCase()) {
            dateFound = true;
            break;
          }
        } catch (e) {
          // Ignore invalid dates
        }
      }
    }

    row.style.display = dateFound ? "" : "none";

    if (dateFound) {
      matchCount++;
      row.classList.add("month-filtered");
    } else {
      row.classList.remove("month-filtered");
    }
  });

  console.log(
    `📅 Monats-Filter ${tableId}: ${matchCount}/${rows.length} Zeilen für "${targetMonth}"`
  );
}

/**
 * Entfernt alle Filter von einer Tabelle
 * @param {string} tableId - Tabellen-ID
 */
export function clearTableFilters(tableId) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const rows = table.querySelectorAll("tbody tr");
  rows.forEach((row) => {
    row.style.display = "";
    row.classList.remove(
      "search-highlight",
      "status-filtered",
      "month-filtered"
    );
  });

  // Such-Input leeren
  const searchInputId = tableId.replace("-table", "-search");
  const searchInput = document.getElementById(searchInputId);
  if (searchInput) {
    searchInput.value = "";
    searchInput.style.backgroundColor = "";
    searchInput.style.color = "";
  }

  console.log(`🧹 Filter für ${tableId} zurückgesetzt`);
}

/**
 * Initialisiert die Suchfunktionalität für alle Tabellen
 */
export function initializeSearch() {
  console.log("🔍 Initialisiere Search-System...");

  const searchConfigs = [
    ["kunden-table", "kunden-search"],
    ["fahrzeuge-table", "fahrzeuge-search"],
    ["auftraege-table", "auftraege-search"],
    ["rechnungen-table", "rechnungen-search"],
  ];

  let initializedCount = 0;

  searchConfigs.forEach(([tableId, searchId]) => {
    // Retry-Mechanismus für noch nicht geladene Tabellen
    const attemptInit = (attempts = 0) => {
      const table = document.getElementById(tableId);
      const searchInput = document.getElementById(searchId);

      if (table && searchInput) {
        addSearchToTable(tableId, searchId);
        initializedCount++;
        console.log(`✅ Search aktiviert: ${tableId}`);
      } else if (attempts < 10) {
        // Retry nach 300ms, max 10x
        setTimeout(() => attemptInit(attempts + 1), 300);
      } else {
        console.warn(
          `⚠️ Search-Init fehlgeschlagen: ${tableId} (nach ${attempts} Versuchen)`
        );
      }
    };

    attemptInit();
  });

  // Status nach kurzer Verzögerung loggen
  setTimeout(() => {
    console.log(
      `🔍 Search-System: ${initializedCount}/${searchConfigs.length} Tabellen aktiviert`
    );
  }, 2000);
}

// DEBUG-FUNKTIONEN

/**
 * Debug-Funktion für Status-Erkennung
 * @param {string} tableId - Tabellen-ID
 */
export function debugTableStatus(tableId) {
  const table = document.getElementById(tableId);
  if (!table) {
    console.log(`❌ Tabelle ${tableId} nicht gefunden`);
    return;
  }

  const rows = table.querySelectorAll("tbody tr");
  console.log(`🔍 Debug für Tabelle ${tableId} (${rows.length} Zeilen):`);

  rows.forEach((row, index) => {
    const statusCell = findStatusCell(row);
    const status = statusCell
      ? extractStatusFromCell(statusCell)
      : "❌ Nicht gefunden";
    const allText = row.textContent.replace(/\s+/g, " ").trim();

    console.log(
      `Zeile ${index + 1}: Status="${status}" | Text="${allText.substring(
        0,
        80
      )}..."`
    );
  });
}

/**
 * Test-Funktion für Status-Matching
 * @param {string} searchTerm - Test-Suchbegriff
 * @param {string} tableId - Tabellen-ID
 */
export function testStatusMatching(searchTerm, tableId) {
  console.log(`🧪 Teste Status-Matching für "${searchTerm}" in ${tableId}`);

  const table = document.getElementById(tableId);
  if (!table) {
    console.log("❌ Tabelle nicht gefunden");
    return;
  }

  const rows = table.querySelectorAll("tbody tr");
  let matches = 0;

  rows.forEach((row, index) => {
    if (isStatusSearch(searchTerm, row)) {
      matches++;
      const statusCell = findStatusCell(row);
      const currentStatus = extractStatusFromCell(statusCell);
      console.log(
        `✅ Match Zeile ${index + 1}: "${currentStatus}" ~ "${searchTerm}"`
      );
    }
  });

  console.log(
    `🧪 Ergebnis: ${matches}/${rows.length} Matches für "${searchTerm}"`
  );
}
function debugStatusSearch(searchTerm) {
  console.log(`🔍 Debug Status-Suche: "${searchTerm}"`);

  const tables = ["auftraege-table", "rechnungen-table"];

  tables.forEach((tableId) => {
    const table = document.getElementById(tableId);
    if (!table) return;

    const rows = table.querySelectorAll("tbody tr");
    let matches = 0;

    rows.forEach((row, index) => {
      const statusCell = findStatusCell(row);
      if (statusCell) {
        const currentStatus = extractStatusFromCell(statusCell);
        const matches = doesStatusMatch(
          searchTerm.toLowerCase(),
          currentStatus
        );

        if (matches) {
          console.log(
            `✅ ${tableId} Zeile ${
              index + 1
            }: "${currentStatus}" passt zu "${searchTerm}"`
          );
          matches++;
        }
      }
    });

    console.log(`📊 ${tableId}: ${matches} Treffer für "${searchTerm}"`);
  });
}

window.debugStatusSearch = debugStatusSearch;
window.normalizeStatusText = normalizeStatusText;

// Export für globale Nutzung
export default {
  initializeSearch,
  addSearchToTable,
  filterTableByStatus,
  filterTableByMonth,
  clearTableFilters,
  debugTableStatus,
  testStatusMatching,
};
