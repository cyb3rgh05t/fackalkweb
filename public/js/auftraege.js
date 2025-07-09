import {
  apiCall,
  showNotification,
  formatDate,
  formatCurrency,
} from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";

// Aufträge laden und in die Tabelle einfügen
export async function loadAuftraege() {
  try {
    window.auftraege = await apiCall("/api/auftraege");
    const tableBody = document.querySelector("#auftraege-table tbody");
    tableBody.innerHTML = window.auftraege
      .map(
        (auftrag) => `
            <tr>
                <td>${auftrag.auftrag_nr}</td>
                <td>${auftrag.kunde_name || "-"}</td>
                <td>${auftrag.kennzeichen || ""} ${auftrag.marke || ""}</td>
                <td>${formatDate(auftrag.datum)}</td>
                <td>
                    <select class="status status-${
                      auftrag.status
                    }" onchange="updateAuftragStatus(${
          auftrag.id
        }, this.value)" style="background: transparent; border: none; color: inherit;">
                        <option value="offen" ${
                          auftrag.status === "offen" ? "selected" : ""
                        }>Offen</option>
                        <option value="bearbeitung" ${
                          auftrag.status === "bearbeitung" ? "selected" : ""
                        }>In Bearbeitung</option>
                        <option value="abgeschlossen" ${
                          auftrag.status === "abgeschlossen" ? "selected" : ""
                        }>Abgeschlossen</option>
                    </select>
                </td>
                <td>${formatCurrency(auftrag.gesamt_kosten)}</td>
                <td>
                    <button class="btn btn-sm btn-secondary" onclick="viewAuftrag(${
                      auftrag.id
                    })" title="Anzeigen">
                        <i class="fas fa-eye"></i>
                    </button>
                    <button class="btn btn-sm btn-primary" onclick="editAuftrag(${
                      auftrag.id
                    })" title="Bearbeiten">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-success" onclick="createRechnungFromAuftrag(${
                      auftrag.id
                    })" title="Rechnung erstellen">
                        <i class="fas fa-file-invoice"></i>
                    </button>
                    <button class="btn btn-sm btn-danger" onclick="deleteAuftrag(${
                      auftrag.id
                    })" title="Löschen">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `
      )
      .join("");
    setTimeout(
      () => addSearchToTable("auftraege-table", "auftraege-search"),
      100
    );
  } catch (error) {
    console.error("Failed to load orders:", error);
  }
}

// Für Inline-Events im HTML:
window.editAuftrag = showAuftragModal;
window.viewAuftrag = viewAuftrag;
window.deleteAuftrag = deleteAuftrag;
window.updateAuftragStatus = updateAuftragStatus;
window.createRechnungFromAuftrag = createRechnungFromAuftrag;

export async function showAuftragModal(auftragId = null) {
  // Kunden laden falls nicht vorhanden
  if (!window.kunden || window.kunden.length === 0) {
    window.kunden = await apiCall("/api/kunden");
  }
  if (auftragId) {
    loadAuftragForEdit(auftragId);
  } else {
    displayAuftragModal(null);
  }
}

async function loadAuftragForEdit(auftragId) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${auftragId}`);
    displayAuftragModal(auftrag);
  } catch (error) {
    showNotification("Fehler beim Laden des Auftrags", "error");
  }
}

function displayAuftragModal(auftrag = null) {
  const isEdit = !!auftrag;
  const kundenOptions = window.kunden
    .map(
      (k) =>
        `<option value="${k.id}" ${
          k.id === auftrag?.kunden_id ? "selected" : ""
        }>${k.name}</option>`
    )
    .join("");
  const arbeitsschritte = [
    "Demontage/Vorbereitung",
    "Schleifen/Spachteln",
    "Grundierung",
    "Zwischenschliff",
    "Basislack",
    "Klarlack",
    "Polieren/Finish",
    "Montage",
  ];
  const arbeitsschritteRows = arbeitsschritte
    .map((schritt, index) => {
      const position = auftrag?.positionen?.[index] || {};
      return `
        <tr>
            <td><input type="text" class="form-input" value="${
              position.beschreibung || schritt
            }" name="beschreibung_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.stundenpreis || 110
            }" name="stundenpreis_${index}"></td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.zeit || 0
            }" name="zeit_${index}" onchange="calculateAuftragRow(${index})"></td>
            <td>Std.</td>
            <td><input type="number" step="0.01" class="form-input" value="${
              position.gesamt || 0
            }" name="gesamt_${index}" readonly></td>
        </tr>
      `;
    })
    .join("");
  const content = `
        <form id="auftrag-form">
            <div class="form-grid">
                <div class="form-group">
                    <label class="form-label">Kunde *</label>
                    <select class="form-select" name="kunden_id" required onchange="loadKundenFahrzeuge(this.value)">
                        <option value="">Kunde auswählen</option>
                        ${kundenOptions}
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Fahrzeug *</label>
                    <select class="form-select" name="fahrzeug_id" required>
                        <option value="">Erst Kunde auswählen</option>
                    </select>
                </div>
                <div class="form-group">
                    <label class="form-label">Auftragsdatum *</label>
                    <input type="date" class="form-input" name="datum" value="${
                      auftrag?.datum || new Date().toISOString().split("T")[0]
                    }" required>
                </div>
                <div class="form-group">
                    <label class="form-label">Status</label>
                    <select class="form-select" name="status">
                        <option value="offen" ${
                          auftrag?.status === "offen" ? "selected" : ""
                        }>Offen</option>
                        <option value="bearbeitung" ${
                          auftrag?.status === "bearbeitung" ? "selected" : ""
                        }>In Bearbeitung</option>
                        <option value="abgeschlossen" ${
                          auftrag?.status === "abgeschlossen" ? "selected" : ""
                        }>Abgeschlossen</option>
                    </select>
                </div>
            </div>
            <h3 style="margin: 2rem 0 1rem 0;">Arbeitszeiten</h3>
            <div class="table-container">
                <table class="table">
                    <thead>
                        <tr>
                            <th>Beschreibung</th>
                            <th>Stundenpreis (€)</th>
                            <th>Zeit</th>
                            <th>Einheit</th>
                            <th>Gesamt (€)</th>
                        </tr>
                    </thead>
                    <tbody id="arbeitszeiten-tbody">
                        ${arbeitsschritteRows}
                    </tbody>
                </table>
            </div>
            <div style="margin-top: 2rem; padding: 1rem; background: var(--bg-tertiary); border-radius: 8px;">
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <strong>Gesamt Zeit:</strong>
                    <span id="gesamt-zeit">0.00 Std.</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.5rem;">
                    <strong>Gesamt Kosten:</strong>
                    <span id="gesamt-kosten">0,00 €</span>
                </div>
                <div style="display: flex; justify-content: space-between; align-items: center;">
                    <strong>Mit 19% MwSt:</strong>
                    <span id="gesamt-mwst">0,00 €</span>
                </div>
            </div>
            <div class="form-group" style="margin-top: 2rem;">
                <label class="form-label">Bemerkungen</label>
                <textarea class="form-textarea" name="bemerkungen" rows="3">${
                  auftrag?.bemerkungen || ""
                }</textarea>
            </div>
        </form>
    `;
  const footer = `
        <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
        <button type="button" class="btn btn-primary" onclick="saveAuftrag(${
          auftrag?.id || null
        })">
            <i class="fas fa-save"></i> ${
              isEdit ? "Aktualisieren" : "Erstellen"
            }
        </button>
    `;
  createModal(isEdit ? "Auftrag bearbeiten" : "Neuer Auftrag", content, footer);

  if (auftrag?.kunden_id) {
    loadKundenFahrzeuge(auftrag.kunden_id, auftrag.fahrzeug_id);
  }
  setTimeout(() => {
    for (let i = 0; i < 8; i++) {
      calculateAuftragRow(i);
    }
  }, 100);
}

window.loadKundenFahrzeuge = async function (
  kundenId,
  selectedFahrzeugId = null
) {
  if (!kundenId) return;
  try {
    const kundenFahrzeuge = await apiCall(
      `/api/fahrzeuge?kunden_id=${kundenId}`
    );
    const select = document.querySelector('[name="fahrzeug_id"]');
    select.innerHTML =
      '<option value="">Fahrzeug auswählen</option>' +
      kundenFahrzeuge
        .map(
          (f) =>
            `<option value="${f.id}" ${
              f.id == selectedFahrzeugId ? "selected" : ""
            }>${f.kennzeichen} - ${f.marke} ${f.modell}</option>`
        )
        .join("");
  } catch (error) {
    console.error("Failed to load customer vehicles:", error);
  }
};

window.calculateAuftragRow = function (index) {
  const stundenpreis =
    parseFloat(
      document.querySelector(`[name="stundenpreis_${index}"]`)?.value
    ) || 0;
  const zeit =
    parseFloat(document.querySelector(`[name="zeit_${index}"]`)?.value) || 0;
  const gesamt = stundenpreis * zeit;
  const gesamtInput = document.querySelector(`[name="gesamt_${index}"]`);
  if (gesamtInput) gesamtInput.value = gesamt.toFixed(2);
  let gesamtZeit = 0,
    gesamtKosten = 0;
  for (let i = 0; i < 8; i++) {
    const zeitInput = document.querySelector(`[name="zeit_${i}"]`);
    const gesamtInput = document.querySelector(`[name="gesamt_${i}"]`);
    if (zeitInput && gesamtInput) {
      gesamtZeit += parseFloat(zeitInput.value) || 0;
      gesamtKosten += parseFloat(gesamtInput.value) || 0;
    }
  }
  const gesamtZeitEl = document.getElementById("gesamt-zeit");
  const gesamtKostenEl = document.getElementById("gesamt-kosten");
  const gesamtMwstEl = document.getElementById("gesamt-mwst");
  if (gesamtZeitEl) gesamtZeitEl.textContent = gesamtZeit.toFixed(2) + " Std.";
  if (gesamtKostenEl) gesamtKostenEl.textContent = formatCurrency(gesamtKosten);
  if (gesamtMwstEl)
    gesamtMwstEl.textContent = formatCurrency(gesamtKosten * 1.19);
};

window.saveAuftrag = async function (auftragId = null) {
  const form = document.getElementById("auftrag-form");
  const formData = new FormData(form);
  const positionen = [];
  for (let i = 0; i < 8; i++) {
    const beschreibung = formData.get(`beschreibung_${i}`);
    const stundenpreis = parseFloat(formData.get(`stundenpreis_${i}`)) || 0;
    const zeit = parseFloat(formData.get(`zeit_${i}`)) || 0;
    const gesamt = parseFloat(formData.get(`gesamt_${i}`)) || 0;
    if (beschreibung && (zeit > 0 || gesamt > 0)) {
      positionen.push({
        beschreibung,
        stundenpreis,
        zeit,
        einheit: "Std.",
        gesamt,
      });
    }
  }
  const data = {
    kunden_id: parseInt(formData.get("kunden_id")),
    fahrzeug_id: parseInt(formData.get("fahrzeug_id")),
    datum: formData.get("datum"),
    status: formData.get("status"),
    positionen,
    bemerkungen: formData.get("bemerkungen"),
  };
  try {
    if (auftragId) {
      await apiCall(`/api/auftraege/${auftragId}`, "PUT", data);
      showNotification("Auftrag erfolgreich aktualisiert", "success");
    } else {
      await apiCall("/api/auftraege", "POST", data);
      showNotification("Auftrag erfolgreich erstellt", "success");
    }
    closeModal();
    loadAuftraege();
  } catch (error) {
    showNotification("Fehler beim Speichern des Auftrags", "error");
  }
};

async function deleteAuftrag(id) {
  if (
    confirm(
      "Auftrag wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    )
  ) {
    try {
      await apiCall(`/api/auftraege/${id}`, "DELETE");
      showNotification("Auftrag erfolgreich gelöscht", "success");
      loadAuftraege();
    } catch (error) {
      showNotification("Fehler beim Löschen des Auftrags", "error");
    }
  }
}

// Status Update Funktion
async function updateAuftragStatus(id, status) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${id}`);
    auftrag.status = status;
    await apiCall(`/api/auftraege/${id}`, "PUT", auftrag);
    showNotification("Status erfolgreich aktualisiert", "success");
    loadAuftraege();
  } catch (error) {
    showNotification("Fehler beim Aktualisieren des Status", "error");
    loadAuftraege();
  }
}

// Modal zum Anzeigen (View)
async function viewAuftrag(id) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${id}`);
    const positionenHtml =
      auftrag.positionen
        ?.map(
          (pos) => `
      <tr>
        <td>${pos.beschreibung}</td>
        <td>${pos.zeit} ${pos.einheit}</td>
        <td>${formatCurrency(pos.stundenpreis)}</td>
        <td>${formatCurrency(pos.gesamt)}</td>
      </tr>
    `
        )
        .join("") || '<tr><td colspan="4">Keine Positionen</td></tr>';
    const content = `
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Auftrag-Nr.:</label><div>${
          auftrag.auftrag_nr
        }</div></div>
        <div class="form-group"><label class="form-label">Kunde:</label><div>${
          auftrag.name
        }</div></div>
        <div class="form-group"><label class="form-label">Fahrzeug:</label><div>${
          auftrag.kennzeichen
        } - ${auftrag.marke} ${auftrag.modell}</div></div>
        <div class="form-group"><label class="form-label">Datum:</label><div>${formatDate(
          auftrag.datum
        )}</div></div>
        <div class="form-group"><label class="form-label">Status:</label><div><span class="status status-${
          auftrag.status
        }">${auftrag.status}</span></div></div>
        <div class="form-group"><label class="form-label">Gesamt:</label><div>${formatCurrency(
          auftrag.gesamt_kosten
        )}</div></div>
      </div>
      <h3>Positionen</h3>
      <table class="table">
        <thead>
          <tr>
            <th>Beschreibung</th>
            <th>Zeit</th>
            <th>Stundenpreis</th>
            <th>Gesamt</th>
          </tr>
        </thead>
        <tbody>${positionenHtml}</tbody>
      </table>
      ${
        auftrag.bemerkungen
          ? `<div class="form-group"><label class="form-label">Bemerkungen:</label><div>${auftrag.bemerkungen}</div></div>`
          : ""
      }
    `;
    createModal(`Auftrag ${auftrag.auftrag_nr}`, content);
  } catch (error) {
    showNotification("Fehler beim Laden des Auftrags", "error");
  }
}

// Rechnung aus Auftrag erzeugen (wie bisher)
async function createRechnungFromAuftrag(auftragId) {
  try {
    const auftrag = await apiCall(`/api/auftraege/${auftragId}`);
    // Auftrag in Rechnung umwandeln
    const rechnungsData = {
      auftrag_id: auftrag.id,
      kunden_id: auftrag.kunden_id,
      fahrzeug_id: auftrag.fahrzeug_id,
      rechnungsdatum: new Date().toISOString().split("T")[0],
      auftragsdatum: auftrag.datum,
      positionen: (auftrag.positionen || []).map((pos) => ({
        kategorie: "ARBEITSZEITEN",
        beschreibung: pos.beschreibung,
        menge: pos.zeit,
        einheit: pos.einheit,
        einzelpreis: pos.stundenpreis,
        mwst_prozent: 19,
        gesamt: pos.gesamt,
      })),
      rabatt_prozent: 0,
      status: "offen",
    };
    const result = await apiCall("/api/rechnungen", "POST", rechnungsData);
    showNotification(
      `Rechnung ${result.rechnung_nr} erfolgreich aus Auftrag erstellt`,
      "success"
    );
    auftrag.status = "abgeschlossen";
    await apiCall(`/api/auftraege/${auftragId}`, "PUT", auftrag);
    loadAuftraege();
    // Du kannst optional hier loadRechnungen(); aufrufen
    window.showSection("rechnungen");
  } catch (error) {
    showNotification("Fehler beim Erstellen der Rechnung aus Auftrag", "error");
  }
}
