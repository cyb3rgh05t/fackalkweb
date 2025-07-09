import { apiCall, showNotification } from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";

export async function loadFahrzeuge() {
  try {
    window.fahrzeuge = await apiCall("/api/fahrzeuge");
    const tbody = document.querySelector("#fahrzeuge-table tbody");
    tbody.innerHTML = window.fahrzeuge
      .map(
        (f) => `
        <tr>
          <td>${f.kennzeichen}</td>
          <td>${f.marke || ""} ${f.modell || ""}</td>
          <td>${f.kunde_name || "-"}</td>
          <td>${f.vin || "-"}</td>
          <td>${f.farbe || "-"} ${f.farbcode ? "(" + f.farbcode + ")" : ""}</td>
          <td>
            <button class="btn btn-sm btn-secondary" onclick="editFahrzeug(${
              f.id
            })"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteFahrzeug(${
              f.id
            })"><i class="fas fa-trash"></i></button>
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
  const content = `
    <form id="fahrzeug-form">
      <div class="form-grid">
        <div class="form-group">
          <label class="form-label">Kunde *</label>
          <select class="form-select" name="kunden_id" required>
            <option value="">Kunde auswählen</option>${kundenOptions}
          </select>
        </div>
        <div class="form-group"><label class="form-label">Kennzeichen *</label>
        <input type="text" class="form-input" name="kennzeichen" value="${
          fahrzeug.kennzeichen || ""
        }" required></div>
        <div class="form-group"><label class="form-label">Marke</label>
        <input type="text" class="form-input" name="marke" value="${
          fahrzeug.marke || ""
        }"></div>
        <div class="form-group"><label class="form-label">Modell</label>
        <input type="text" class="form-input" name="modell" value="${
          fahrzeug.modell || ""
        }"></div>
        <div class="form-group"><label class="form-label">VIN</label>
        <input type="text" class="form-input" name="vin" value="${
          fahrzeug.vin || ""
        }"></div>
        <div class="form-group"><label class="form-label">Baujahr</label>
        <input type="number" class="form-input" name="baujahr" value="${
          fahrzeug.baujahr || ""
        }"></div>
        <div class="form-group"><label class="form-label">Farbe</label>
        <input type="text" class="form-input" name="farbe" value="${
          fahrzeug.farbe || ""
        }"></div>
        <div class="form-group"><label class="form-label">Farbcode</label>
        <input type="text" class="form-input" name="farbcode" value="${
          fahrzeug.farbcode || ""
        }"></div>
      </div>
    </form>
  `;
  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button type="button" class="btn btn-primary" onclick="saveFahrzeug(${fahrzeugId})"><i class="fas fa-save"></i> ${
    isEdit ? "Aktualisieren" : "Erstellen"
  }</button>
  `;
  createModal(
    isEdit ? "Fahrzeug bearbeiten" : "Neues Fahrzeug",
    content,
    footer
  );
};

window.saveFahrzeug = async function (fahrzeugId = null) {
  const form = document.getElementById("fahrzeug-form");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  try {
    if (fahrzeugId) {
      await apiCall(`/api/fahrzeuge/${fahrzeugId}`, "PUT", data);
      showNotification("Fahrzeug erfolgreich aktualisiert", "success");
    } else {
      await apiCall("/api/fahrzeuge", "POST", data);
      showNotification("Fahrzeug erfolgreich erstellt", "success");
    }
    closeModal();
    loadFahrzeuge();
  } catch (err) {
    showNotification("Fehler beim Speichern des Fahrzeugs", "error");
  }
};

window.deleteFahrzeug = async function (id) {
  if (
    confirm(
      "Fahrzeug wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
    )
  ) {
    try {
      await apiCall(`/api/fahrzeuge/${id}`, "DELETE");
      showNotification("Fahrzeug erfolgreich gelöscht", "success");
      loadFahrzeuge();
    } catch (err) {
      showNotification("Fehler beim Löschen des Fahrzeugs", "error");
    }
  }
};
