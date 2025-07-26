let activeModal = null;

export function createModal(title, content, footer = "") {
  console.log(`🚀 Erstelle Modal: "${title}"`);

  // Alte Modal entfernen
  closeModal();

  // Modal direkt an body anhängen - NICHT an modal-container
  const modal = document.createElement("div");
  modal.className = "modal-direct";

  // Genau wie dein funktionierender Test
  modal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background: rgba(0, 0, 0, 0.8);
    display: flex;
    align-items: center;
    justify-content: center;
    z-index: 999999;
  `;

  // Modal-Content
  const modalContent = `
    <div style="
      background: #3f3f3f;
      padding: 2rem;
      border-radius: 12px;
      color: #caf1cd;
      max-width: 90vw;
      max-height: 90vh;
      overflow-y: auto;
      border: 1px solid #575757;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
    ">
      <div style="
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 1.5rem;
        padding-bottom: 1rem;
        border-bottom: 1px solid #575757;
      ">
        <h2 style="
          font-size: 1.5rem;
          font-weight: 600;
          color: #caf1cd;
          margin: 0;
        ">${title}</h2>
        <button onclick="closeModal()" style="
          background: none;
          border: none;
          color: #a1e6a8;
          font-size: 1.5rem;
          cursor: pointer;
          padding: 0.5rem;
          line-height: 1;
          border-radius: 4px;
        ">&times;</button>
      </div>
      
      <div style="color: #caf1cd; line-height: 1.6;">
        ${content}
      </div>
      
      ${
        footer
          ? `
        <div style="
          display: flex;
          justify-content: flex-end;
          gap: 1rem;
          margin-top: 2rem;
          padding-top: 1rem;
          border-top: 1px solid #575757;
        ">
          ${footer}
        </div>
      `
          : ""
      }
    </div>
  `;

  modal.innerHTML = modalContent;

  // DIREKT an body anhängen - wie dein Test
  document.body.appendChild(modal);
  activeModal = modal;

  // Focus setzen
  setTimeout(() => {
    const firstInput = modal.querySelector(
      'input, select, textarea, button:not([onclick*="closeModal"])'
    );
    if (firstInput) {
      firstInput.focus();
    }
  }, 100);

  console.log(
    `✅ Modal "${title}" direkt an body angehängt - sollte ÜBERALL sichtbar sein`
  );
  return modal;
}

// Modal schließen
export function closeModal() {
  if (activeModal) {
    console.log("🗑️ Modal wird geschlossen");
    activeModal.remove();
    activeModal = null;
  }

  // Fallback: alle direkten Modals entfernen
  document.querySelectorAll(".modal-direct").forEach((m) => {
    m.remove();
  });
}

// Hilfsfunktionen
export function isModalOpen() {
  return activeModal !== null;
}

export function getCurrentModal() {
  return activeModal;
}

// Event-Handler
document.addEventListener("keydown", (e) => {
  if (e.key === "Escape" && activeModal) {
    e.preventDefault();
    closeModal();
  }
});

// Click outside to close
document.addEventListener("click", (e) => {
  if (activeModal && e.target === activeModal) {
    closeModal();
  }
});

// Global verfügbar machen
window.closeModal = closeModal;
window.createModal = createModal;
window.isModalOpen = isModalOpen;

// Modal-Container entfernen falls vorhanden (nicht mehr benötigt)
document.addEventListener("DOMContentLoaded", () => {
  const oldContainer = document.getElementById("modal-container");
  if (oldContainer) {
    console.log("🗑️ Alter modal-container entfernt - wird nicht mehr benötigt");
    // oldContainer.remove(); // Auskommentiert, falls andere Teile ihn brauchen
  }
});
