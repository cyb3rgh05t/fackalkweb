class LicenseUI {
  constructor() {
    this.init();
  }

  async init() {
    await this.checkLicenseStatus();
  }

  async checkLicenseStatus() {
    try {
      const response = await fetch("/api/license/status");
      const status = await response.json();

      if (!status.valid) {
        if (status.needsActivation) {
          this.showActivationDialog();
        } else if (status.needsReactivation) {
          this.showReactivationDialog();
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error("Lizenz-Status-Prüfung fehlgeschlagen:", error);
      this.showActivationDialog();
      return false;
    }
  }

  showActivationDialog() {
    // Komplett ohne Inline-Styles, alles über CSS-Klassen!
    const dialog = `
      <div id="license-modal" class="license-modal-bg">
        <div class="license-modal-content">
          <h2>🔐 Lizenz-Aktivierung</h2>
          <p>Bitte geben Sie Ihren Lizenzschlüssel ein, um die KFZ-App zu aktivieren:</p>
          <form id="license-form">
          </br>
            <div>
              <label for="license-key">Lizenzschlüssel:</label>
              </br></br>
              <input type="text" id="license-key" placeholder="DEMO1-23456-ABCDE-78901" required>
            </div>
            <div class="license-support">
              <small>
                <strong>🔧 Support-Information:</strong><br>
                Hardware-ID: <code id="hardware-id">Wird geladen...</code><br>
                <em>Diese ID benötigen Sie bei Supportanfragen.</em>
              </small>
            </div>
            <div style="text-align: right;">
              <button type="submit">🔓 Aktivieren</button>
            </div>
          </form>
          <div id="license-status"></div>
        </div>
      </div>
    `;
    document.body.insertAdjacentHTML("beforeend", dialog);
    this.loadHardwareInfo();
    this.setupLicenseForm();
  }

  async loadHardwareInfo() {
    try {
      const response = await fetch("/api/license/hardware-info");
      const info = await response.json();
      document.getElementById("hardware-id").textContent = info.hardware_id;
    } catch (error) {
      document.getElementById("hardware-id").textContent = "Fehler beim Laden";
    }
  }

  setupLicenseForm() {
    const form = document.getElementById("license-form");
    const statusDiv = document.getElementById("license-status");

    form.addEventListener("submit", async (e) => {
      e.preventDefault();

      const licenseKey = document.getElementById("license-key").value.trim();
      const submitBtn = form.querySelector('button[type="submit"]');
      submitBtn.disabled = true;
      submitBtn.textContent = "🔄 Aktiviere...";

      statusDiv.innerHTML = `<div class="license-status-message info">⏳ Lizenz wird überprüft...</div>`;

      try {
        const response = await fetch("/api/license/activate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ licenseKey }),
        });

        const result = await response.json();

        if (result.success) {
          statusDiv.innerHTML = `<div class="license-status-message success">✅ Lizenz erfolgreich aktiviert!</div>`;
          setTimeout(() => {
            document.getElementById("license-modal").remove();
            window.location.reload();
          }, 2000);
        } else {
          statusDiv.innerHTML = `<div class="license-status-message error">❌ ${result.error}</div>`;
        }
      } catch (error) {
        statusDiv.innerHTML = `<div class="license-status-message error">❌ Fehler: ${error.message}</div>`;
      } finally {
        submitBtn.disabled = false;
        submitBtn.textContent = "🔓 Aktivieren";
      }
    });
  }

  // AKTUALISIERT: Verwende Custom Dialog statt alert()
  async showReactivationDialog() {
    await customAlert(
      `🔄 Lizenz-Reaktivierung erforderlich

Ihre Lizenz muss erneut validiert werden.

Mögliche Ursachen:
• Internetverbindung unterbrochen
• Lizenz-Server nicht erreichbar
• Hardware-Änderung erkannt

Bitte überprüfen Sie Ihre Internetverbindung.`,
      "warning",
      "Reaktivierung erforderlich"
    );
    this.showActivationDialog();
  }
}

document.addEventListener("DOMContentLoaded", () => {
  new LicenseUI();

  // Prüfen ob Custom Dialogs verfügbar sind
  if (typeof customAlert === "undefined") {
    console.error("❌ Custom Dialogs nicht geladen in license.js!");
  } else {
    console.log("✅ Custom Dialogs in license.js verfügbar");
  }
});
