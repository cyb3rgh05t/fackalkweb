// Verbesserte search.js mit intelligenter Status-Filterung

// Status-Mapping für bessere Filterung
const statusMapping = {
  // Aufträge
  offen: ["offen", "Offen"],
  in_bearbeitung: [
    "in_bearbeitung",
    "in bearbeitung",
    "In Bearbeitung",
    "bearbeitung",
  ],
  abgeschlossen: ["abgeschlossen", "Abgeschlossen", "fertig", "erledigt"],

  // Rechnungen
  bezahlt: ["bezahlt", "Bezahlt", "paid"],
  mahnung: ["mahnung", "Mahnung"],
  storniert: ["storniert", "Storniert", "cancelled"],
};

// Intelligente Such-/Filterfunktion
export function addSearchToTable(tableId, searchInputId) {
  const searchInput = document.getElementById(searchInputId);
  const table = document.getElementById(tableId);
  if (!searchInput || !table) return;

  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase().trim();
    const rows = table.querySelectorAll("tbody tr");

    if (!searchTerm) {
      // Alle Zeilen anzeigen wenn Suchfeld leer
      rows.forEach((row) => (row.style.display = ""));
      return;
    }

    rows.forEach((row) => {
      let shouldShow = false;

      // 1. Prüfe auf Status-spezifische Suche
      if (isStatusSearch(searchTerm, row)) {
        shouldShow = true;
      }
      // 2. Fallback: normale Textsuche
      else {
        const text = row.textContent.toLowerCase();
        shouldShow = text.includes(searchTerm);
      }

      row.style.display = shouldShow ? "" : "none";
    });
  });
}

// Prüft ob es sich um eine Status-basierte Suche handelt
function isStatusSearch(searchTerm, row) {
  // Suche Status-Spalte in der Zeile
  const statusCell = findStatusCell(row);
  if (!statusCell) return false;

  // Hole den aktuellen Status aus der Zeile
  const currentStatus = extractStatusFromCell(statusCell);
  if (!currentStatus) return false;

  // Prüfe ob der Suchterm zu diesem Status passt
  return doesStatusMatch(searchTerm, currentStatus);
}

// Findet die Status-Spalte in einer Tabellenzeile
function findStatusCell(row) {
  const cells = row.querySelectorAll("td");

  // Suche nach Zelle mit Status-Klasse oder Select-Element
  for (let cell of cells) {
    // Prüfe auf Status-Select-Element
    const select = cell.querySelector("select.status");
    if (select) return cell;

    // Prüfe auf Status-Span-Element
    const statusSpan = cell.querySelector("span.status");
    if (statusSpan) return cell;

    // Prüfe auf Status-Klasse direkt auf der Zelle
    if (cell.classList.contains("status")) return cell;
  }

  return null;
}

// Extrahiert den Status-Wert aus einer Zelle
function extractStatusFromCell(cell) {
  // Aus Select-Element
  const select = cell.querySelector("select.status");
  if (select) {
    return select.value.toLowerCase();
  }

  // Aus Span-Element
  const statusSpan = cell.querySelector("span.status");
  if (statusSpan) {
    // Extrahiere aus Klassen (z.B. "status-offen" -> "offen")
    const statusClasses = Array.from(statusSpan.classList);
    for (let className of statusClasses) {
      if (className.startsWith("status-")) {
        return className.replace("status-", "").replace("-", "_");
      }
    }
    // Fallback: Text-Content
    return statusSpan.textContent.toLowerCase().trim();
  }

  return null;
}

// Prüft ob ein Suchterm zu einem Status passt
function doesStatusMatch(searchTerm, currentStatus) {
  // Direkte Übereinstimmung
  if (currentStatus === searchTerm) return true;

  // Prüfe über Status-Mapping
  for (let [key, variations] of Object.entries(statusMapping)) {
    if (variations.some((v) => v.toLowerCase() === searchTerm)) {
      return (
        currentStatus === key ||
        variations.some((v) => v.toLowerCase() === currentStatus)
      );
    }
  }

  return false;
}

// Erweiterte Filterfunktionen für Dashboard-Integration
export function filterTableByStatus(tableId, status) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const statusCell = findStatusCell(row);
    if (!statusCell) {
      row.style.display = "none";
      return;
    }

    const currentStatus = extractStatusFromCell(statusCell);
    const shouldShow = doesStatusMatch(status.toLowerCase(), currentStatus);
    row.style.display = shouldShow ? "" : "none";
  });
}

// Monatliche Filterung für Rechnungen
export function filterTableByMonth(tableId, month = null) {
  const table = document.getElementById(tableId);
  if (!table) return;

  const targetMonth =
    month || new Date().toLocaleDateString("de-DE", { month: "long" });
  const rows = table.querySelectorAll("tbody tr");

  rows.forEach((row) => {
    const cells = row.querySelectorAll("td");
    let dateFound = false;

    // Suche nach Datum in den Zellen
    for (let cell of cells) {
      const text = cell.textContent;
      if (text.includes(targetMonth)) {
        dateFound = true;
        break;
      }
      // Alternativ: Prüfe auf Datumsformat
      if (text.match(/\d{2}\.\d{2}\.\d{4}/)) {
        const cellMonth = new Date(
          text.split(".").reverse().join("-")
        ).toLocaleDateString("de-DE", { month: "long" });
        if (cellMonth === targetMonth) {
          dateFound = true;
          break;
        }
      }
    }

    row.style.display = dateFound ? "" : "none";
  });
}

// Initialization function
export function initializeSearch() {
  addSearchToTable("kunden-table", "kunden-search");
  addSearchToTable("fahrzeuge-table", "fahrzeuge-search");
  addSearchToTable("auftraege-table", "auftraege-search");
  addSearchToTable("rechnungen-table", "rechnungen-search");
}

// Debug-Funktion für Status-Erkennung
export function debugTableStatus(tableId) {
  const table = document.getElementById(tableId);
  if (!table) {
    console.log(`Tabelle ${tableId} nicht gefunden`);
    return;
  }

  const rows = table.querySelectorAll("tbody tr");
  console.log(`Debug für Tabelle ${tableId}:`);

  rows.forEach((row, index) => {
    const statusCell = findStatusCell(row);
    const status = statusCell
      ? extractStatusFromCell(statusCell)
      : "Nicht gefunden";
    console.log(`Zeile ${index + 1}: Status = "${status}"`);
  });
}
