import {
  apiCall,
  showNotification,
  formatDate,
  formatCurrency,
} from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";
import { getSetting } from "./einstellungen.js";

export async function loadFahrzeuge() {
  try {
    window.fahrzeuge = await apiCall("/api/fahrzeuge");
    const tbody = document.querySelector("#fahrzeuge-table tbody");
    tbody.innerHTML = window.fahrzeuge
      .map(
        (f) => `
        <tr onclick="viewFahrzeugDetails(${
          f.id
        })" style="cursor: pointer;" onmouseover="this.style.backgroundColor='var(--clr-surface-a10)'" onmouseout="this.style.backgroundColor=''">
          <td>
            <strong>${f.kennzeichen}</strong>
            ${
              f.baujahr
                ? `<br><small style="color: var(--text-muted);">Bj. ${f.baujahr}</small>`
                : ""
            }
          </td>
          <td>
            <div>${f.marke || ""} ${f.modell || ""}</div>
            ${
              f.vin
                ? `<small style="color: var(--text-muted);">VIN: ${f.vin}</small>`
                : ""
            }
          </td>
          <td>
            <div>${f.kunde_name || "-"}</div>
            ${
              f.kunde_name
                ? `<small style="color: var(--text-muted);">Kunde</small>`
                : ""
            }
          </td>
          <td>
            <div>${f.vin || ""}</div>
            ${
              f.vin
                ? `<small style="color: var(--text-muted);">VIN</small>`
                : ""
            }
          </td>
          <td>
            <div>${f.farbe || "-"}</div>
            ${
              f.farbcode
                ? `<small style="color: var(--text-muted); font-family: monospace;">${f.farbcode}</small>`
                : ""
            }
          </td>
          <td onclick="event.stopPropagation()">
            <button class="btn btn-sm btn-secondary" onclick="event.stopPropagation(); editFahrzeug(${
              f.id
            })" title="Bearbeiten">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-primary" onclick="event.stopPropagation(); viewFahrzeugDetails(${
              f.id
            })" title="Details anzeigen">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-success" onclick="event.stopPropagation(); createAuftragForFahrzeug(${
              f.id
            })" title="Neuen Auftrag erstellen">
              <i class="fas fa-plus-circle"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="event.stopPropagation(); deleteFahrzeug(${
              f.id
            })" title="Löschen">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `
      )
      .join("");
    setTimeout(
      () => addSearchToTable("fahrzeuge-table", "fahrzeuge-search"),
      100
    );
  } catch (err) {
    console.error("Failed to load vehicles:", err);
  }
}

window.editFahrzeug = function (id) {
  showFahrzeugModal(id);
};

window.viewFahrzeug = function (id) {
  viewFahrzeugDetails(id);
};

window.createAuftragForFahrzeug = function (id) {
  const fahrzeug = window.fahrzeuge.find((f) => f.id === id);
  if (fahrzeug) {
    // Weiterleitung zu Aufträge mit vorausgewähltem Fahrzeug
    window.showSection("auftraege");
    setTimeout(() => {
      window.showAuftragModal();
      // Kunde und Fahrzeug vorauswählen
      setTimeout(() => {
        const kundenSelect = document.querySelector('[name="kunden_id"]');
        if (kundenSelect) {
          kundenSelect.value = fahrzeug.kunden_id;
          kundenSelect.dispatchEvent(new Event("change"));

          // Fahrzeug nach Laden der Fahrzeuge vorauswählen
          setTimeout(() => {
            const fahrzeugSelect = document.querySelector(
              '[name="fahrzeug_id"]'
            );
            if (fahrzeugSelect) {
              fahrzeugSelect.value = id;
            }
          }, 200);
        }
      }, 100);
    }, 300);
  }
};

window.showFahrzeugModal = async function (fahrzeugId = null) {
  if (!window.kunden || window.kunden.length === 0) {
    window.kunden = await apiCall("/api/kunden");
  }

  const fahrzeug = fahrzeugId
    ? window.fahrzeuge.find((f) => f.id === fahrzeugId)
    : {};
  const isEdit = !!fahrzeugId;

  const kundenOptions = window.kunden
    .map(
      (k) =>
        `<option value="${k.id}" ${
          k.id === fahrzeug.kunden_id ? "selected" : ""
        }>${k.name}</option>`
    )
    .join("");

  // Vorschläge für Marken
  const markenSuggestions = [
    "Audi",
    "BMW",
    "Mercedes-Benz",
    "Volkswagen",
    "Opel",
    "Ford",
    "Peugeot",
    "Renault",
    "Fiat",
    "Toyota",
    "Honda",
    "Nissan",
    "Hyundai",
    "Kia",
    "Skoda",
    "Seat",
    "Citroen",
    "Mazda",
    "Volvo",
  ];
  const markenDatalist = markenSuggestions
    .map((marke) => `<option value="${marke}">`)
    .join("");

  const content = `
    <form id="fahrzeug-form">
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="form-group">
          <label class="form-label">Kunde *</label>
          <select class="form-select" name="kunden_id" required>
            <option value="">Kunde auswählen</option>${kundenOptions}
          </select>
        </div>
        <div class="form-group">
          <label class="form-label">Kennzeichen *</label>
          <input type="text" class="form-input" name="kennzeichen" value="${
            fahrzeug.kennzeichen || ""
          }" required style="text-transform: uppercase;" placeholder="z.B. M-AB-123">
        </div>
        <div class="form-group">
          <label class="form-label">Marke</label>
          <input type="text" class="form-input" name="marke" value="${
            fahrzeug.marke || ""
          }" list="marken-suggestions" placeholder="z.B. BMW">
          <datalist id="marken-suggestions">${markenDatalist}</datalist>
        </div>
        <div class="form-group">
          <label class="form-label">Modell</label>
          <input type="text" class="form-input" name="modell" value="${
            fahrzeug.modell || ""
          }" placeholder="z.B. 3er Touring">
        </div>
        <div class="form-group">
          <label class="form-label">VIN/Fahrgestellnummer</label>
          <input type="text" class="form-input" name="vin" value="${
            fahrzeug.vin || ""
          }" maxlength="17" placeholder="17-stellige Fahrzeugidentifikationsnummer">
        </div>
        <div class="form-group">
          <label class="form-label">Baujahr</label>
          <input type="number" class="form-input" name="baujahr" value="${
            fahrzeug.baujahr || ""
          }" min="1900" max="${
    new Date().getFullYear() + 1
  }" placeholder="${new Date().getFullYear()}">
        </div>
        <div class="form-group">
          <label class="form-label">Farbe</label>
          <input type="text" class="form-input" name="farbe" value="${
            fahrzeug.farbe || ""
          }" placeholder="z.B. Schwarz Metallic">
        </div>
        <div class="form-group">
          <label class="form-label">Farbcode</label>
          <input type="text" class="form-input" name="farbcode" value="${
            fahrzeug.farbcode || ""
          }" placeholder="z.B. A96, LY9C">
        </div>
      </div>
      ${
        !isEdit
          ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="create-order-checkbox">
          <span>Direkt Auftrag für dieses Fahrzeug erstellen</span>
        </label>
        <small class="text-muted">Nach dem Speichern wird automatisch ein neuer Auftrag erstellt</small>
      </div>
      `
          : ""
      }
    </form>`;

  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button type="button" class="btn btn-primary" onclick="saveFahrzeug(${fahrzeugId})">
      <i class="fas fa-save"></i> ${isEdit ? "Aktualisieren" : "Erstellen"}
    </button>
  `;

  createModal(
    isEdit ? "Fahrzeug bearbeiten" : "Neues Fahrzeug",
    content,
    footer
  );

  // Kennzeichen-Formatierung beim Tippen
  const kennzeichenInput = document.querySelector('[name="kennzeichen"]');
  if (kennzeichenInput) {
    kennzeichenInput.addEventListener("input", function (e) {
      e.target.value = e.target.value.toUpperCase();
    });
  }
};

window.saveFahrzeug = async function (fahrzeugId = null) {
  const form = document.getElementById("fahrzeug-form");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  // VIN validieren falls angegeben
  if (data.vin && data.vin.length !== 17) {
    showNotification("VIN muss genau 17 Zeichen haben", "warning");
    return;
  }

  const createOrder =
    document.getElementById("create-order-checkbox")?.checked && !fahrzeugId;

  try {
    let result;
    if (fahrzeugId) {
      await apiCall(`/api/fahrzeuge/${fahrzeugId}`, "PUT", data);
      showNotification("Fahrzeug erfolgreich aktualisiert", "success");
    } else {
      result = await apiCall("/api/fahrzeuge", "POST", data);
      showNotification("Fahrzeug erfolgreich erstellt", "success");

      // Direkt Auftrag erstellen falls gewünscht
      if (createOrder && result.id) {
        closeModal();
        loadFahrzeuge();

        setTimeout(() => {
          createAuftragForFahrzeug(result.id);
        }, 500);
        return;
      }
    }

    closeModal();
    loadFahrzeuge();
  } catch (err) {
    showNotification("Fehler beim Speichern des Fahrzeugs", "error");
  }
};

async function viewFahrzeugDetails(id) {
  try {
    const fahrzeug = await apiCall(`/api/fahrzeuge/${id}`);
    const auftraege = await apiCall("/api/auftraege");
    const rechnungen = await apiCall("/api/rechnungen");

    // Aufträge und Rechnungen für dieses Fahrzeug filtern
    const fahrzeugAuftraege = auftraege.filter((a) => a.fahrzeug_id === id);
    const fahrzeugRechnungen = rechnungen.filter((r) => r.fahrzeug_id === id);

    // Statistiken berechnen
    const letzterAuftrag = fahrzeugAuftraege.sort(
      (a, b) => new Date(b.datum) - new Date(a.datum)
    )[0];
    const gesamtAuftraege = fahrzeugAuftraege.length;
    const offeneAuftraege = fahrzeugAuftraege.filter(
      (a) => a.status === "offen" || a.status === "in-bearbeitung"
    ).length;
    const gesamtUmsatz = fahrzeugRechnungen
      .filter((r) => r.status === "bezahlt")
      .reduce((sum, r) => sum + (r.gesamtbetrag || 0), 0);

    // Letzte Aufträge HTML (für die rechte Spalte)
    const letzteAuftraegeHtml =
      fahrzeugAuftraege.length > 0
        ? fahrzeugAuftraege
            .sort((a, b) => new Date(b.datum) - new Date(a.datum))
            .slice(0, 5)
            .map(
              (a) => `
            <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem; border-left: 3px solid var(--accent-primary);">
              <div style="display: flex; justify-content: space-between; align-items: start;">
                <div>
                  <strong>${a.auftrag_nr}</strong>
                  <br><small style="color: var(--text-muted);">${formatDate(
                    a.datum
                  )}</small>
                </div>
                <div style="text-align: right;">
                  <span class="status status-${a.status}">${a.status}</span>
                  <br><small>${formatCurrency(a.gesamt_kosten || 0)}</small>
                </div>
              </div>
              ${
                a.bemerkungen
                  ? `<div style="margin-top: 0.5rem; font-size: 0.85rem; color: var(--text-secondary);">${a.bemerkungen}</div>`
                  : ""
              }
            </div>
          `
            )
            .join("")
        : `<div style="text-align: center; color: var(--text-muted); padding: 2rem;">
           <i class="fas fa-info-circle" style="font-size: 2rem; opacity: 0.5; margin-bottom: 1rem;"></i>
           <div>Noch keine Aufträge für dieses Fahrzeug</div>
         </div>`;

    // Fahrzeugdaten HTML (für die linke Spalte)
    const fahrzeugdatenHtml = `
      <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Kennzeichen:</span>
          <strong>${fahrzeug.kennzeichen || "-"}</strong>
        </div>
      </div>
      <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Marke:</span>
          <strong>${fahrzeug.marke || "-"}</strong>
        </div>
      </div>
      <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Modell:</span>
          <strong>${fahrzeug.modell || "-"}</strong>
        </div>
      </div>
      <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Baujahr:</span>
          <strong>${fahrzeug.baujahr || "-"}</strong>
        </div>
      </div>
      <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">VIN:</span>
          <strong style="font-family: monospace; font-size: 0.9rem;">${
            fahrzeug.vin || "-"
          }</strong>
        </div>
      </div>
      <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Farbe:</span>
          <strong>${fahrzeug.farbe || "-"} ${
      fahrzeug.farbcode ? `(${fahrzeug.farbcode})` : ""
    }</strong>
        </div>
      </div>
      <div style="background: var(--clr-surface-a10); padding: 0.75rem; border-radius: 6px; margin-bottom: 0.5rem;">
        <div style="display: flex; justify-content: space-between;">
          <span style="color: var(--text-muted);">Kunde:</span>
          <strong>${fahrzeug.kunde_name || "-"}</strong>
        </div>
      </div>
    `;

    // MAIN CONTENT mit Grid-Layout wie beim Kundendetails-Modal
    const content = `
      <!-- Grid-Layout wie im Screenshot -->
      <div style="display: grid; grid-template-columns: auto auto; gap: 2rem; margin-bottom: 2rem;">
        
        <div>
          <label class="form-label">Fahrzeug seit:</label>
          <div>${
            fahrzeug.erstellt_am
              ? new Date(fahrzeug.erstellt_am).toLocaleDateString("de-DE")
              : "-"
          }</div>
        </div>
        <div>
          <label class="form-label">Letzter Auftrag:</label>
          <div>${
            letzterAuftrag
              ? formatDate(letzterAuftrag.datum)
              : "Noch kein Auftrag"
          }</div>
        </div>
      </div>
      
      <!-- Statistiken (wie im Kundendetails) -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div style="background: var(--accent-primary); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;">${gesamtAuftraege}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Aufträge</div>
        </div>
        <div style="background: var(--accent-danger); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;">${offeneAuftraege}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Offene Aufträge</div>
        </div>
        <div style="background: var(--accent-success); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.2rem; font-weight: bold;">${new Intl.NumberFormat(
            "de-DE",
            { style: "currency", currency: "EUR" }
          ).format(gesamtUmsatz)}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Gesamtumsatz</div>
        </div>
        <div style="background: var(--accent-warning); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.2rem; font-weight: bold;">${
            fahrzeug.baujahr || "???"
          }</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Baujahr</div>
        </div>
      </div>
      
      <!-- Zwei-Spalten Layout für Fahrzeugdaten und Letzte Aufträge -->
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <div>
          <h4><i class="fas fa-car"></i> Fahrzeugdaten</h4>
          ${fahrzeugdatenHtml}
        </div>
        <div>
          <h4><i class="fas fa-history"></i> Letzte Aufträge</h4>
          ${letzteAuftraegeHtml}
        </div>
      </div>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Schließen</button>
      <button type="button" class="btn btn-primary" onclick="editFahrzeug(${id})">
        <i class="fas fa-edit"></i> Bearbeiten
      </button>
      <button type="button" class="btn btn-success" onclick="createAuftragForFahrzeug(${id})">
        <i class="fas fa-plus"></i> Neuer Auftrag
      </button>
    `;

    createModal(`Fahrzeugdetails: ${fahrzeug.kennzeichen}`, content, footer);
  } catch (error) {
    showNotification("Fehler beim Laden der Fahrzeugdetails", "error");
    console.error("Fehler:", error);
  }
}
window.viewFahrzeugDetails = viewFahrzeugDetails;

window.deleteFahrzeug = async function (id) {
  const fahrzeug = window.fahrzeuge.find((f) => f.id === id);

  // Prüfen ob Aufträge existieren
  try {
    const auftraege = await apiCall("/api/auftraege");
    const fahrzeugAuftraege = auftraege.filter((a) => a.fahrzeug_id === id);

    let confirmMessage;
    let dialogTitle;

    if (fahrzeugAuftraege.length > 0) {
      // Warnung bei vorhandenen Aufträgen
      confirmMessage = `Fahrzeug "${fahrzeug?.kennzeichen}" wirklich löschen?

⚠️ ACHTUNG: DATEN GEHEN VERLOREN!

Dieses Fahrzeug hat ${fahrzeugAuftraege.length} verknüpfte Aufträge:
• Alle Aufträge werden gelöscht
• Alle zugehörigen Rechnungen werden gelöscht
• Alle Reparatur-Historie geht verloren

Diese Aktion kann NICHT rückgängig gemacht werden!

Trotzdem löschen?`;
      dialogTitle = "⚠️ Fahrzeug mit Aufträgen löschen";
    } else {
      // Standard-Löschung ohne Aufträge
      confirmMessage = `Fahrzeug "${fahrzeug?.kennzeichen}" wirklich löschen?

Fahrzeug-Details:
• Kennzeichen: ${fahrzeug?.kennzeichen || "Unbekannt"}
• Marke: ${fahrzeug?.marke || "Unbekannt"}
• Modell: ${fahrzeug?.modell || "Unbekannt"}

Diese Aktion kann nicht rückgängig gemacht werden.`;
      dialogTitle = "Fahrzeug löschen";
    }

    const confirmed = await customConfirm(confirmMessage, dialogTitle);

    if (confirmed) {
      // Loading-Notification während Löschung
      if (typeof showNotification === "function") {
        showNotification("Fahrzeug wird gelöscht...", "info");
      }

      await apiCall(`/api/fahrzeuge/${id}`, "DELETE");

      // Erfolgs-Dialog und Notification
      await customAlert(
        `Fahrzeug "${fahrzeug?.kennzeichen}" wurde erfolgreich gelöscht!${
          fahrzeugAuftraege.length > 0
            ? `\n\n${fahrzeugAuftraege.length} Aufträge wurden ebenfalls entfernt.`
            : ""
        }`,
        "success",
        "Fahrzeug gelöscht"
      );

      if (typeof showNotification === "function") {
        showNotification("Fahrzeug erfolgreich gelöscht", "success");
      }

      loadFahrzeuge();
    }
  } catch (err) {
    console.error("Fehler beim Löschen des Fahrzeugs:", err);

    // Fehler-Dialog mit Details
    await customAlert(
      `Fehler beim Löschen des Fahrzeugs "${fahrzeug?.kennzeichen}":

${err.message || "Unbekannter Fehler"}

Mögliche Ursachen:
• Netzwerk-Problem
• Server-Fehler
• Fahrzeug wird noch verwendet

Versuchen Sie es erneut oder kontaktieren Sie den Support.`,
      "error",
      "Löschung fehlgeschlagen"
    );

    if (typeof showNotification === "function") {
      showNotification("Fehler beim Löschen des Fahrzeugs", "error");
    }
  }
};

// Bulk-Aktionen hinzufügen
window.exportFahrzeugeCSV = async function () {
  try {
    const fahrzeuge = await apiCall("/api/fahrzeuge");

    const csv = [
      "Kennzeichen,Marke,Modell,Kunde,VIN,Baujahr,Farbe,Farbcode",
      ...fahrzeuge.map(
        (f) =>
          `"${f.kennzeichen}","${f.marke || ""}","${f.modell || ""}","${
            f.kunde_name || ""
          }","${f.vin || ""}","${f.baujahr || ""}","${f.farbe || ""}","${
            f.farbcode || ""
          }"`
      ),
    ].join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fahrzeuge_${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);

    showNotification("Fahrzeugliste wurde heruntergeladen", "success");
  } catch (error) {
    showNotification("Fehler beim Exportieren der Fahrzeugliste", "error");
  }
};

// Event Listener für Einstellungsänderungen
window.addEventListener("settingsUpdated", () => {
  console.log("Einstellungen wurden aktualisiert - Fahrzeuge-Modul reagiert");
});
