export function addSearchToTable(tableId, searchInputId) {
  const searchInput = document.getElementById(searchInputId);
  const table = document.getElementById(tableId);
  if (!searchInput || !table) return;
  searchInput.addEventListener("input", function () {
    const searchTerm = this.value.toLowerCase();
    const rows = table.querySelectorAll("tbody tr");
    rows.forEach((row) => {
      const text = row.textContent.toLowerCase();
      row.style.display = text.includes(searchTerm) ? "" : "none";
    });
  });
}
export function initializeSearch() {
  addSearchToTable("kunden-table", "kunden-search");
  addSearchToTable("fahrzeuge-table", "fahrzeuge-search");
  addSearchToTable("auftraege-table", "auftraege-search");
  addSearchToTable("rechnungen-table", "rechnungen-search");
}
