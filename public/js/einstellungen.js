import { apiCall, showNotification, einstellungen } from "./utils.js";

export async function loadEinstellungen() {
  try {
    const settings = await apiCall("/api/einstellungen");
    window.einstellungen = {};
    settings.forEach(
      (setting) => (window.einstellungen[setting.key] = setting.value)
    );
    const form = document.getElementById("einstellungen-form");
    Object.keys(window.einstellungen).forEach((key) => {
      const input = form.querySelector(`[name="${key}"]`);
      if (input) input.value = window.einstellungen[key];
    });
  } catch (err) {
    console.error("Failed to load settings:", err);
  }
}

document.addEventListener("DOMContentLoaded", function () {
  const settingsForm = document.getElementById("einstellungen-form");
  if (settingsForm) {
    settingsForm.addEventListener("submit", async function (e) {
      e.preventDefault();
      const formData = new FormData(settingsForm);
      const updates = [];
      for (const [key, value] of formData.entries()) {
        updates.push(apiCall(`/api/einstellungen/${key}`, "PUT", { value }));
      }
      try {
        await Promise.all(updates);
        showNotification("Einstellungen erfolgreich gespeichert", "success");
        loadEinstellungen();
      } catch (err) {
        showNotification("Fehler beim Speichern der Einstellungen", "error");
      }
    });
  }
});
