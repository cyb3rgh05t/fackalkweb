import { apiCall, showNotification } from "./utils.js";
import { addSearchToTable } from "./search.js";
import { createModal, closeModal } from "./modals.js";

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
            })"><i class="fas fa-edit"></i></button>
            <button class="btn btn-sm btn-danger" onclick="deleteKunde(${
              k.id
            })"><i class="fas fa-trash"></i></button>
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

window.showKundenModal = function (kundeId = null) {
  const k = kundeId ? window.kunden.find((k) => k.id === kundeId) : {};
  const isEdit = !!kundeId;
  const content = `
    <form id="kunde-form">
      <div class="form-grid">
        <div class="form-group"><label class="form-label">Name *</label>
        <input type="text" class="form-input" name="name" value="${
          k?.name || ""
        }" required></div>
        <div class="form-group"><label class="form-label">Straße, Hausnummer</label>
        <input type="text" class="form-input" name="strasse" value="${
          k?.strasse || ""
        }"></div>
        <div class="form-group"><label class="form-label">PLZ</label>
        <input type="text" class="form-input" name="plz" value="${
          k?.plz || ""
        }"></div>
        <div class="form-group"><label class="form-label">Ort</label>
        <input type="text" class="form-input" name="ort" value="${
          k?.ort || ""
        }"></div>
        <div class="form-group"><label class="form-label">Telefon</label>
        <input type="tel" class="form-input" name="telefon" value="${
          k?.telefon || ""
        }"></div>
        <div class="form-group"><label class="form-label">E-Mail</label>
        <input type="email" class="form-input" name="email" value="${
          k?.email || ""
        }"></div>
      </div>
    </form>`;
  const footer = `
    <button type="button" class="btn btn-secondary" onclick="closeModal()">Abbrechen</button>
    <button type="button" class="btn btn-primary" onclick="saveKunde(${kundeId})"><i class="fas fa-save"></i> ${
    isEdit ? "Aktualisieren" : "Erstellen"
  }</button>
  `;
  createModal(isEdit ? "Kunde bearbeiten" : "Neuer Kunde", content, footer);
};

window.saveKunde = async function (kundeId = null) {
  const form = document.getElementById("kunde-form");
  const formData = new FormData(form);
  const data = Object.fromEntries(formData);
  try {
    if (kundeId) {
      await apiCall(`/api/kunden/${kundeId}`, "PUT", data);
      showNotification("Kunde erfolgreich aktualisiert", "success");
    } else {
      await apiCall("/api/kunden", "POST", data);
      showNotification("Kunde erfolgreich erstellt", "success");
    }
    closeModal();
    loadKunden();
  } catch (err) {
    showNotification("Fehler beim Speichern des Kunden", "error");
  }
};

window.deleteKunde = async function (id) {
  if (
    confirm(
      "Kunde wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden."
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
