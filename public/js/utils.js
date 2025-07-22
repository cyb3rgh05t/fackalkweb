// Globale State-Objekte als window-Property, damit Eventhandler aus anderen Modulen Zugriff haben
export let kunden = window.kunden || [];
export let fahrzeuge = window.fahrzeuge || [];
export let auftraege = window.auftraege || [];
export let rechnungen = window.rechnungen || [];
export let einstellungen = window.einstellungen || {};

export async function apiCall(url, method = "GET", data = null) {
  try {
    const options = {
      method,
      headers: { "Content-Type": "application/json" },
    };
    if (data) options.body = JSON.stringify(data);
    const response = await fetch(url, options);
    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(
        errorData.error || "HTTP error! status: " + response.status
      );
    }
    return await response.json();
  } catch (error) {
    console.error("API call failed:", error);
    showNotification(
      "Fehler bei der Serververbindung: " + error.message,
      "error"
    );
    throw error;
  }
}

export function showNotification(message, type = "info") {
  return window.showNotification(message, type);
}

export function formatDate(dateString) {
  if (!dateString) return "";
  const date = new Date(dateString);
  return date.toLocaleDateString("de-DE");
}

export function formatCurrency(amount) {
  if (!amount) return "0,00 €";
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}

export function showSection(sectionId, fromDashboardCard = false) {
  document
    .querySelectorAll(".section")
    .forEach((s) => s.classList.remove("active"));
  document
    .querySelectorAll(".nav-item")
    .forEach((i) => i.classList.remove("active"));

  const section = document.getElementById(sectionId);
  if (section) {
    section.classList.add("active");
    section.classList.add("fade-in");
  }

  const navItem = Array.from(document.querySelectorAll(".nav-item")).find(
    (item) => item.onclick && item.onclick.toString().includes(sectionId)
  );
  if (navItem) navItem.classList.add("active");

  // Je nach Section die passenden Daten laden
  switch (sectionId) {
    case "dashboard":
      import("./dashboard.js").then((m) => m.loadDashboard());
      break;
    case "auftraege":
      import("./auftraege.js").then((m) => m.loadAuftraege());
      break;
    case "rechnungen":
      import("./rechnungen.js").then((m) => m.loadRechnungen());
      break;
    case "kunden":
      import("./kunden.js").then((m) => m.loadKunden());
      break;
    case "fahrzeuge":
      import("./fahrzeuge.js").then((m) => m.loadFahrzeuge());
      break;
    case "einstellungen":
      import("./einstellungen.js").then((m) => m.loadEinstellungen());
      break;
  }
}
