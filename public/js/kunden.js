import { apiCall, showNotification } from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";
import { getSetting } from "./einstellungen.js";

export async function loadKunden() {
  try {
    window.kunden = await apiCall("/api/kunden");
    const tbody = document.querySelector("#kunden-table tbody");
    tbody.innerHTML = window.kunden
      .map(
        (k) => `
        <tr>
          <td>${k.kunden_nr}</td>
          <td>${k.name}</td>
          <td>${k.strasse || ""} ${k.plz || ""} ${k.ort || ""}</td>
          <td>${k.telefon || "-"}</td>
          <td>${k.email || "-"}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="editKunde(${
              k.id
            })" title="Bearbeiten">
              <i class="fas fa-edit"></i>
            </button>
            <button class="btn btn-sm btn-primary" onclick="viewKunde(${
              k.id
            })" title="Details anzeigen">
              <i class="fas fa-eye"></i>
            </button>
            <button class="btn btn-sm btn-success" onclick="createAuftragForKunde(${
              k.id
            })" title="Neuen Auftrag erstellen">
              <i class="fas fa-plus-circle"></i>
            </button>
            <button class="btn btn-sm btn-danger" onclick="deleteKunde(${
              k.id
            })" title="Löschen">
              <i class="fas fa-trash"></i>
            </button>
          </td>
        </tr>
      `
      )
      .join("");
    setTimeout(() => addSearchToTable("kunden-table", "kunden-search"), 100);
  } catch (err) {
    console.error("Failed to load customers:", err);
  }
}

window.editKunde = function (id) {
  showKundenModal(id);
};

window.viewKunde = function (id) {
  viewKundenDetails(id);
};

window.createAuftragForKunde = function (id) {
  // Weiterleitung zu Aufträge mit vorausgewähltem Kunden
  window.showSection("auftraege");
  setTimeout(() => {
    window.showAuftragModal();
    // Kunde vorauswählen
    setTimeout(() => {
      const kundenSelect = document.querySelector('[name="kunden_id"]');
      if (kundenSelect) {
        kundenSelect.value = id;
        kundenSelect.dispatchEvent(new Event("change"));
      }
    }, 100);
  }, 300);
};

function showKundenModal(kundeId = null) {
  const k = kundeId ? window.kunden.find((k) => k.id === kundeId) : {};
  const isEdit = !!kundeId;

  // Standard-Werte aus Einstellungen für neue Kunden
  const defaultPlz = getSetting("firmen_plz", "");
  const defaultOrt = getSetting("firmen_ort", "");

  const content = `
    <form id="kunde-form">
      <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1.5rem;">
        <div class="form-group">
          <label class="form-label">Name *</label>
          <input type="text" class="form-input" name="name" value="${
            k?.name || ""
          }" required>
        </div>
        <div class="form-group">
          <label class="form-label">Straße, Hausnummer</label>
          <input type="text" class="form-input" name="strasse" value="${
            k?.strasse || ""
          }">
        </div>
        <div class="form-group">
          <label class="form-label">PLZ</label>
          <input type="text" class="form-input" name="plz" value="${
            k?.plz || (isEdit ? "" : defaultPlz)
          }" placeholder="${defaultPlz}">
        </div>
        <div class="form-group">
          <label class="form-label">Ort</label>
          <input type="text" class="form-input" name="ort" value="${
            k?.ort || (isEdit ? "" : defaultOrt)
          }" placeholder="${defaultOrt}">
        </div>
        <div class="form-group">
          <label class="form-label">Telefon</label>
          <input type="tel" class="form-input" name="telefon" value="${
            k?.telefon || ""
          }">
        </div>
        <div class="form-group">
          <label class="form-label">E-Mail</label>
          <input type="email" class="form-input" name="email" value="${
            k?.email || ""
          }">
        </div>
      </div>
      ${
        !isEdit
          ? `
      <div class="form-group" style="margin-top: 2rem;">
        <label style="display: flex; align-items: center; gap: 8px;">
          <input type="checkbox" id="create-vehicle-checkbox" onchange="toggleVehicleForm()">
          <span>Gleichzeitig Fahrzeug anlegen</span>
        </label>
      </div>
      <div id="vehicle-form-section" style="display: none; margin-top: 1rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
        <h4 style="margin-bottom: 1rem;">Fahrzeugdaten</h4>
        <div class="form-grid" style="grid-template-columns: 1fr 1fr; gap: 1.5rem;">
          <div class="form-group">
            <label class="form-label">Kennzeichen *</label>
            <input type="text" class="form-input" name="vehicle_kennzeichen">
          </div>
          <div class="form-group">
            <label class="form-label">Marke</label>
            <input type="text" class="form-input" name="vehicle_marke">
          </div>
          <div class="form-group">
            <label class="form-label">Modell</label>
            <input type="text" class="form-input" name="vehicle_modell">
          </div>
          <div class="form-group">
            <label class="form-label">VIN</label>
            <input type="text" class="form-input" name="vehicle_vin">
          </div>
          <div class="form-group">
            <label class="form-label">Baujahr</label>
            <input type="number" class="form-input" name="vehicle_baujahr" min="1900" max="${
              new Date().getFullYear() + 1
            }">
          </div>
          <div class="form-group">
            <label class="form-label">Farbe</label>
            <input type="text" class="form-input" name="vehicle_farbe">
          </div>
        </div>
      </div>
      `
          : ""
      }
    </form>`;

  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button type="button" class="btn btn-primary" onclick="saveKunde(${kundeId})">
      <i class="fas fa-save"></i> ${isEdit ? "Aktualisieren" : "Erstellen"}
    </button>
  `;

  createModal(isEdit ? "Kunde bearbeiten" : "Neuer Kunde", content, footer);
}

// Toggle-Funktion für Fahrzeugformular
window.toggleVehicleForm = function () {
  const checkbox = document.getElementById("create-vehicle-checkbox");
  const vehicleSection = document.getElementById("vehicle-form-section");
  vehicleSection.style.display = checkbox.checked ? "block" : "none";

  // Required-Attribut für Kennzeichen setzen/entfernen
  const kennzeichenInput = document.querySelector(
    '[name="vehicle_kennzeichen"]'
  );
  if (kennzeichenInput) {
    if (checkbox.checked) {
      kennzeichenInput.setAttribute("required", "required");
    } else {
      kennzeichenInput.removeAttribute("required");
    }
  }
};

window.saveKunde = async function (kundeId = null) {
  const form = document.getElementById("kunde-form");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);

  // Fahrzeugdaten separieren
  const vehicleData = {};
  const createVehicle = document.getElementById(
    "create-vehicle-checkbox"
  )?.checked;

  if (createVehicle && !kundeId) {
    Object.keys(data).forEach((key) => {
      if (key.startsWith("vehicle_")) {
        vehicleData[key.replace("vehicle_", "")] = data[key];
        delete data[key];
      }
    });
  }

  try {
    let result;
    if (kundeId) {
      await apiCall(`/api/kunden/${kundeId}`, "PUT", data);
      showNotification("Kunde erfolgreich aktualisiert", "success");
    } else {
      result = await apiCall("/api/kunden", "POST", data);
      showNotification("Kunde erfolgreich erstellt", "success");

      // Fahrzeug erstellen falls gewünscht
      if (createVehicle && result.id && vehicleData.kennzeichen) {
        try {
          vehicleData.kunden_id = result.id;
          await apiCall("/api/fahrzeuge", "POST", vehicleData);
          showNotification(
            "Fahrzeug wurde ebenfalls erfolgreich erstellt",
            "success"
          );
        } catch (vehicleError) {
          showNotification(
            "Kunde erstellt, aber Fehler beim Fahrzeug: " +
              vehicleError.message,
            "warning"
          );
        }
      }
    }

    closeModal();
    loadKunden();
  } catch (err) {
    showNotification("Fehler beim Speichern des Kunden", "error");
  }
};

async function viewKundenDetails(id) {
  try {
    const kunde = await apiCall(`/api/kunden/${id}`);
    const fahrzeuge = await apiCall(`/api/fahrzeuge?kunden_id=${id}`);
    const auftraege = await apiCall("/api/auftraege");
    const rechnungen = await apiCall("/api/rechnungen");

    // Aufträge und Rechnungen für diesen Kunden filtern
    const kundenAuftraege = auftraege.filter((a) => a.kunden_id === id);
    const kundenRechnungen = rechnungen.filter((r) => r.kunden_id === id);

    // Statistiken berechnen
    const offeneAuftraege = kundenAuftraege.filter(
      (a) => a.status === "offen"
    ).length;
    const offeneRechnungen = kundenRechnungen.filter(
      (r) => r.status === "offen"
    ).length;
    const gesamtumsatz = kundenRechnungen
      .filter((r) => r.status === "bezahlt")
      .reduce((sum, r) => sum + (r.gesamtbetrag || 0), 0);

    const fahrzeugeHtml =
      fahrzeuge.length > 0
        ? fahrzeuge
            .map(
              (f) => `
        <div style="background: var(--bg-tertiary); padding: 1rem; border-radius: 8px; margin-bottom: 0.5rem;">
          <strong>${f.kennzeichen}</strong> - ${f.marke} ${f.modell}<br>
          <small>${f.vin ? `VIN: ${f.vin} | ` : ""}${
                f.farbe || "Farbe nicht angegeben"
              }</small>
        </div>
      `
            )
            .join("")
        : '<div style="color: var(--text-muted); font-style: italic;">Keine Fahrzeuge registriert</div>';

    const letzteAuftraegeHtml =
      kundenAuftraege
        .slice(0, 5)
        .map(
          (a) => `
      <div style="background: var(--bg-tertiary); padding: 0.5rem; border-radius: 4px; margin-bottom: 0.25rem; display: flex; justify-content: space-between;">
        <span>${a.auftrag_nr} - ${new Date(a.datum).toLocaleDateString(
            "de-DE"
          )}</span>
        <span class="status status-${a.status}">${a.status}</span>
      </div>
    `
        )
        .join("") ||
      '<div style="color: var(--text-muted); font-style: italic;">Keine Aufträge vorhanden</div>';

    const content = `
      <div class="form-grid" style="margin-bottom: 2rem;">
        <div class="form-group">
          <label class="form-label">Kunden-Nr.:</label>
          <div>${kunde.kunden_nr}</div>
        </div>
        <div class="form-group">
          <label class="form-label">Name:</label>
          <div><strong>${kunde.name}</strong></div>
        </div>
        <div class="form-group">
          <label class="form-label">Adresse:</label>
          <div>${kunde.strasse || ""}<br>${kunde.plz || ""} ${
      kunde.ort || ""
    }</div>
        </div>
        <div class="form-group">
          <label class="form-label">Kontakt:</label>
          <div>
            ${kunde.telefon ? `Tel: ${kunde.telefon}<br>` : ""}
            ${kunde.email ? `E-Mail: ${kunde.email}` : ""}
          </div>
        </div>
        <div class="form-group">
          <label class="form-label">Kunde seit:</label>
          <div>${new Date(kunde.erstellt_am).toLocaleDateString("de-DE")}</div>
        </div>
      </div>
      
      <!-- Statistiken -->
      <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); gap: 1rem; margin-bottom: 2rem;">
        <div style="background: var(--accent-primary); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;">${
            fahrzeuge.length
          }</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Fahrzeuge</div>
        </div>
        <div style="background: var(--accent-warning); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;">${offeneAuftraege}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Offene Aufträge</div>
        </div>
        <div style="background: var(--accent-danger); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.5rem; font-weight: bold;">${offeneRechnungen}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Offene Rechnungen</div>
        </div>
        <div style="background: var(--accent-success); color: white; padding: 1rem; border-radius: 8px; text-align: center;">
          <div style="font-size: 1.2rem; font-weight: bold;">${new Intl.NumberFormat(
            "de-DE",
            { style: "currency", currency: "EUR" }
          ).format(gesamtumsatz)}</div>
          <div style="font-size: 0.9rem; opacity: 0.9;">Gesamtumsatz</div>
        </div>
      </div>
      
      <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 2rem;">
        <div>
          <h4>Fahrzeuge</h4>
          ${fahrzeugeHtml}
        </div>
        <div>
          <h4>Letzte Aufträge</h4>
          ${letzteAuftraegeHtml}
        </div>
      </div>
    `;

    const footer = `
      <button type="button" class="btn btn-secondary" onclick="closeModal()">Schließen</button>
      <button type="button" class="btn btn-primary" onclick="editKunde(${id})">
        <i class="fas fa-edit"></i> Bearbeiten
      </button>
      <button type="button" class="btn btn-success" onclick="createAuftragForKunde(${id})">
        <i class="fas fa-plus"></i> Neuer Auftrag
      </button>
    `;

    createModal(`Kundendetails: ${kunde.name}`, content, footer);
  } catch (error) {
    showNotification("Fehler beim Laden der Kundendetails", "error");
  }
}

window.deleteKunde = async function (id) {
  const kunde = window.kunden.find((k) => k.id === id);
  if (
    confirm(
      `Kunde "${kunde?.name}" wirklich löschen?\n\nAlle zugehörigen Fahrzeuge, Aufträge und Rechnungen werden ebenfalls gelöscht!\n\nDiese Aktion kann nicht rückgängig gemacht werden.`
    )
  ) {
    try {
      await apiCall(`/api/kunden/${id}`, "DELETE");
      showNotification("Kunde erfolgreich gelöscht", "success");
      loadKunden();
    } catch (err) {
      showNotification("Fehler beim Löschen des Kunden", "error");
    }
  }
};

window.showKundenModal = showKundenModal;
