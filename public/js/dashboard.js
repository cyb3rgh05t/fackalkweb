import { apiCall, formatCurrency, formatDate } from "./utils.js";

export async function loadDashboard() {
  try {
    const [auftraege, rechnungen, kunden] = await Promise.all([
      apiCall("/api/auftraege"),
      apiCall("/api/rechnungen"),
      apiCall("/api/kunden"),
    ]);
    document.getElementById("stat-auftraege").textContent = auftraege.filter(
      (a) => a.status === "offen"
    ).length;
    document.getElementById("stat-rechnungen").textContent = rechnungen.filter(
      (r) => r.status === "offen"
    ).length;
    document.getElementById("stat-kunden").textContent = kunden.length;
    const currentMonth = new Date().getMonth(),
      currentYear = new Date().getFullYear();
    const monthlyRevenue = rechnungen
      .filter((r) => {
        const d = new Date(r.rechnungsdatum);
        return d.getMonth() === currentMonth && d.getFullYear() === currentYear;
      })
      .reduce((sum, r) => sum + (r.gesamtbetrag || 0), 0);
    document.getElementById("stat-umsatz").textContent =
      formatCurrency(monthlyRevenue);
    const recent = auftraege.slice(0, 5);
    const tbody = document.querySelector("#dashboard-auftraege tbody");
    tbody.innerHTML = recent
      .map(
        (auftrag) => `
      <tr>
        <td>${auftrag.auftrag_nr}</td>
        <td>${auftrag.kunde_name || "-"}</td>
        <td>${auftrag.kennzeichen || ""} ${auftrag.marke || ""}</td>
        <td>${formatDate(auftrag.datum)}</td>
        <td><span class="status status-${auftrag.status}">${
          auftrag.status
        }</span></td>
        <td>${formatCurrency(auftrag.gesamt_kosten)}</td>
      </tr>
    `
      )
      .join("");
  } catch (err) {
    console.error("Failed to load dashboard:", err);
  }
}
