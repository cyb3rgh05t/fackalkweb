export function createModal(title, content, footer = "") {
  const modal = document.createElement("div");
  modal.className = "modal active";
  modal.innerHTML = `
    <div class="modal-content">
      <div class="modal-header">
        <h2 class="modal-title">${title}</h2>
        <button class="modal-close" onclick="closeModal()">&times;</button>
      </div>
      <div class="modal-body">${content}</div>
      ${footer ? `<div class="modal-footer">${footer}</div>` : ""}
    </div>`;
  document.getElementById("modal-container").appendChild(modal);
  return modal;
}
export function closeModal() {
  const modal = document.querySelector(".modal.active");
  if (modal) modal.remove();
}
window.closeModal = closeModal; // Damit onclick in HTML/Modal funktioniert
