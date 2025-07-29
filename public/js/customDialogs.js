class CustomDialogs {
  constructor() {
    this.currentDialog = null;
    this.setupKeyboardHandling();
  }

  // Alert Dialog
  alert(message, type = "info", title = null) {
    return new Promise((resolve) => {
      this.closeCurrentDialog();
      const overlay = this.createOverlay();
      const dialog = this.createDialog();

      const icons = {
        info: "ℹ️",
        success: "✅",
        warning: "⚠️",
        error: "❌",
      };

      const titles = {
        info: title || "Information",
        success: title || "Erfolgreich",
        warning: title || "Warnung",
        error: title || "Fehler",
      };

      dialog.innerHTML = `
                <div class="dialog-header">
                    <div class="dialog-icon ${type}">${icons[type]}</div>
                    <h3 class="dialog-title">${titles[type]}</h3>
                </div>
                <div class="dialog-body">${this.escapeHtml(message)}</div>
                <div class="dialog-footer">
                    <button class="dialog-btn dialog-btn-primary" data-action="ok">OK</button>
                </div>
            `;

      this.attachEventListeners(dialog, overlay, (action) => {
        this.closeDialog(overlay);
        resolve(true);
      });

      this.showDialog(overlay, dialog);
    });
  }

  // Confirm Dialog
  confirm(message, title = "Bestätigung") {
    return new Promise((resolve) => {
      this.closeCurrentDialog();
      const overlay = this.createOverlay();
      const dialog = this.createDialog();

      dialog.innerHTML = `
                <div class="dialog-header">
                    <div class="dialog-icon confirm">❓</div>
                    <h3 class="dialog-title">${this.escapeHtml(title)}</h3>
                </div>
                <div class="dialog-body">${this.escapeHtml(message)}</div>
                <div class="dialog-footer">
                    <button class="dialog-btn dialog-btn-secondary" data-action="cancel">Abbrechen</button>
                    <button class="dialog-btn dialog-btn-primary" data-action="ok">OK</button>
                </div>
            `;

      this.attachEventListeners(dialog, overlay, (action) => {
        this.closeDialog(overlay);
        resolve(action === "ok");
      });

      this.showDialog(overlay, dialog);
    });
  }

  // Prompt Dialog
  prompt(message, defaultValue = "", title = "Eingabe") {
    return new Promise((resolve) => {
      this.closeCurrentDialog();
      const overlay = this.createOverlay();
      const dialog = this.createDialog();

      dialog.innerHTML = `
                <div class="dialog-header">
                    <div class="dialog-icon info">✏️</div>
                    <h3 class="dialog-title">${this.escapeHtml(title)}</h3>
                </div>
                <div class="dialog-body">
                    ${this.escapeHtml(message)}
                    <input type="text" class="dialog-input" value="${this.escapeHtml(
                      defaultValue
                    )}" />
                </div>
                <div class="dialog-footer">
                    <button class="dialog-btn dialog-btn-secondary" data-action="cancel">Abbrechen</button>
                    <button class="dialog-btn dialog-btn-primary" data-action="ok">OK</button>
                </div>
            `;

      const input = dialog.querySelector(".dialog-input");

      this.attachEventListeners(dialog, overlay, (action) => {
        const value = action === "ok" ? input.value : null;
        this.closeDialog(overlay);
        resolve(value);
      });

      this.showDialog(overlay, dialog);

      setTimeout(() => {
        input.focus();
        input.select();
      }, 100);
    });
  }

  // Hilfsmethoden
  createOverlay() {
    const overlay = document.createElement("div");
    overlay.className = "custom-dialog-overlay";
    return overlay;
  }

  createDialog() {
    const dialog = document.createElement("div");
    dialog.className = "custom-dialog";
    return dialog;
  }

  attachEventListeners(dialog, overlay, callback) {
    // Button-Clicks
    dialog.addEventListener("click", (e) => {
      const action = e.target.getAttribute("data-action");
      if (action) {
        callback(action);
      }
    });

    // Enter-Taste für Input
    const input = dialog.querySelector(".dialog-input");
    if (input) {
      input.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          callback("ok");
        }
        if (e.key === "Escape") {
          callback("cancel");
        }
      });
    }

    // Overlay-Click zum Schließen
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        callback("cancel");
      }
    });
  }

  showDialog(overlay, dialog) {
    overlay.appendChild(dialog);
    document.body.appendChild(overlay);
    this.currentDialog = overlay;

    requestAnimationFrame(() => {
      overlay.classList.add("show");
    });
  }

  closeDialog(overlay) {
    overlay.classList.remove("show");
    setTimeout(() => {
      if (overlay.parentNode) {
        overlay.parentNode.removeChild(overlay);
      }
      if (this.currentDialog === overlay) {
        this.currentDialog = null;
      }
    }, 300);
  }

  closeCurrentDialog() {
    if (this.currentDialog) {
      this.closeDialog(this.currentDialog);
    }
  }

  setupKeyboardHandling() {
    document.addEventListener("keydown", (e) => {
      if (this.currentDialog && e.key === "Escape") {
        const cancelBtn = this.currentDialog.querySelector(
          '[data-action="cancel"]'
        );
        const okBtn = this.currentDialog.querySelector('[data-action="ok"]');

        if (cancelBtn) {
          cancelBtn.click();
        } else if (okBtn) {
          okBtn.click();
        }
      }
    });
  }

  escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }
}

// ========================================
// GLOBALE INSTANZ UND FUNKTIONEN
// ========================================

// Globale Instanz erstellen
window.customDialogs = new CustomDialogs();

// Einfache globale Funktionen
window.customAlert = (message, type = "info", title = null) => {
  return window.customDialogs.alert(message, type, title);
};

window.customConfirm = (message, title = "Bestätigung") => {
  return window.customDialogs.confirm(message, title);
};

window.customPrompt = (message, defaultValue = "", title = "Eingabe") => {
  return window.customDialogs.prompt(message, defaultValue, title);
};

// ========================================
// INTEGRATION MIT NOTIFICATION SYSTEM
// ========================================

// Warten bis das Notification-System geladen ist
document.addEventListener("DOMContentLoaded", () => {
  // Integration mit bestehendem NotificationManager
  if (window.notificationManager) {
    // Dialog-Funktionen zum NotificationManager hinzufügen
    window.notificationManager.dialog = {
      alert: customAlert,
      confirm: customConfirm,
      prompt: customPrompt,
    };

    console.log("✅ Custom Dialogs mit NotificationManager verbunden");
  }

  // Integration mit showNotification Funktion
  if (typeof window.showNotification === "function") {
    const originalShowNotification = window.showNotification;

    window.showNotification = function (message, type = "info", options = {}) {
      // Für wichtige Nachrichten Dialog verwenden
      if (options.useDialog || options.modal) {
        return customAlert(message, type);
      }

      // Sonst normale Notification verwenden
      return originalShowNotification(message, type, options);
    };

    console.log("✅ showNotification erweitert mit Dialog-Support");
  }
});

// ========================================
// ERWEITERTE NOTIFICATION-DIALOG-FUNKTIONEN
// ========================================

// Kombination aus Notification und Dialog
window.showNotificationDialog = async function (
  message,
  type = "info",
  options = {}
) {
  // Zuerst normale Notification zeigen
  if (typeof window.showNotification === "function") {
    window.showNotification(message, type, { duration: 2000 });
  }

  // Dann Dialog für wichtige Sachen
  if (options.requireConfirmation) {
    return await customAlert(message, type, options.title);
  }

  return true;
};

// Erfolg mit Dialog
window.showSuccessDialog = function (message, title = "Erfolgreich") {
  return customAlert(message, "success", title);
};

// Fehler mit Dialog
window.showErrorDialog = function (message, title = "Fehler") {
  return customAlert(message, "error", title);
};

// Warnung mit Bestätigung
window.showWarningConfirm = function (message, title = "Warnung") {
  return customConfirm(message, title);
};

console.log("🎨 Custom Dialog System geladen");
