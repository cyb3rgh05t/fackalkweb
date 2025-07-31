class NotificationManager {
  constructor() {
    this.container = null;
    this.notifications = new Map();
    this.init();
  }

  init() {
    // Container erstellen falls nicht vorhanden
    this.container = document.querySelector(".notification-container");
    if (!this.container) {
      this.container = document.createElement("div");
      this.container.className = "notification-container";
      document.body.appendChild(this.container);
    }
  }

  show(message, type = "info", options = {}) {
    const config = {
      duration: 3000,
      closable: true,
      persistent: false,
      showProgress: true,
      ...options,
    };

    // Eindeutige ID für die Notification
    const id =
      "notification-" +
      Date.now() +
      "-" +
      Math.random().toString(36).substr(2, 9);

    // Notification Element erstellen
    const notification = this.createElement(message, type, config, id);

    // Container sicherstellen
    this.init();

    // Notification zum Container hinzufügen
    this.container.appendChild(notification);
    this.notifications.set(id, notification);

    // Animation starten
    requestAnimationFrame(() => {
      notification.classList.add("show");
    });

    // Progress Bar Animation
    if (config.showProgress && !config.persistent) {
      const progressBar = notification.querySelector(".notification-progress");
      if (progressBar) {
        progressBar.style.width = "100%";
        setTimeout(() => {
          progressBar.style.width = "0%";
          progressBar.style.transition = `width ${config.duration}ms linear`;
        }, 50);
      }
    }

    // Auto-close wenn nicht persistent
    if (!config.persistent) {
      setTimeout(() => {
        this.hide(id);
      }, config.duration);
    }

    return id;
  }

  createElement(message, type, config, id) {
    const notification = document.createElement("div");
    notification.className = `notification notification-${type}`;
    notification.setAttribute("data-id", id);

    let html = `<div class="notification-content">${message}</div>`;

    // Close Button hinzufügen
    if (config.closable) {
      html += `<button class="notification-close" aria-label="Schließen">&times;</button>`;
    }

    // Progress Bar hinzufügen
    if (config.showProgress && !config.persistent) {
      html += `<div class="notification-progress"></div>`;
    }

    notification.innerHTML = html;

    // Event Listener für Close Button
    if (config.closable) {
      const closeBtn = notification.querySelector(".notification-close");
      closeBtn.addEventListener("click", () => {
        this.hide(id);
      });
    }

    // Hover Events für Progress Bar
    notification.addEventListener("mouseenter", () => {
      const progressBar = notification.querySelector(".notification-progress");
      if (progressBar) {
        progressBar.style.animationPlayState = "paused";
      }
    });

    notification.addEventListener("mouseleave", () => {
      const progressBar = notification.querySelector(".notification-progress");
      if (progressBar) {
        progressBar.style.animationPlayState = "running";
      }
    });

    return notification;
  }

  hide(id) {
    const notification = this.notifications.get(id);
    if (!notification) return;

    notification.classList.remove("show");
    notification.classList.add("hide");

    // Element nach Animation entfernen
    setTimeout(() => {
      if (notification.parentNode) {
        notification.parentNode.removeChild(notification);
      }
      this.notifications.delete(id);
    }, 300);
  }

  clear() {
    // Alle Notifications entfernen
    this.notifications.forEach((_, id) => {
      this.hide(id);
    });
  }

  // Vordefinierte Methoden für verschiedene Types
  success(message, options = {}) {
    return this.show(message, "success", options);
  }

  error(message, options = {}) {
    return this.show(message, "error", { duration: 3000, ...options });
  }

  warning(message, options = {}) {
    return this.show(message, "warning", options);
  }

  info(message, options = {}) {
    return this.show(message, "info", options);
  }
}

// Globale Instanz erstellen
window.notificationManager = new NotificationManager();

// Globale showNotification Funktion für Rückwärtskompatibilität
window.showNotification = function (message, type = "info", options = {}) {
  return window.notificationManager.show(message, type, options);
};

// Erweiterte globale Funktionen
window.showSuccessNotification = function (message, options = {}) {
  return window.notificationManager.success(message, options);
};

window.showErrorNotification = function (message, options = {}) {
  return window.notificationManager.error(message, options);
};

window.showWarningNotification = function (message, options = {}) {
  return window.notificationManager.warning(message, options);
};

window.showInfoNotification = function (message, options = {}) {
  return window.notificationManager.info(message, options);
};

window.clearNotifications = function () {
  return window.notificationManager.clear();
};

// Debug-Funktionen für Tests
window.testNotifications = function () {
  console.log("Testing notifications...");

  setTimeout(
    () => showNotification("Das ist eine Info-Notification", "info"),
    500
  );
  setTimeout(
    () => showNotification("Das ist eine Erfolgs-Notification", "success"),
    1000
  );
  setTimeout(
    () => showNotification("Das ist eine Warn-Notification", "warning"),
    1500
  );
  setTimeout(
    () => showNotification("Das ist eine Fehler-Notification", "error"),
    2000
  );
  setTimeout(
    () =>
      showNotification("Das ist eine persistente Notification", "info", {
        persistent: true,
        closable: true,
      }),
    2500
  );
};

// Export für Module
if (typeof module !== "undefined" && module.exports) {
  module.exports = NotificationManager;
}
