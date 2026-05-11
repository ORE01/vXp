

// DraggableModal.js
export function makeModalDraggable(modalContent) {
  if (!modalContent) return;

  // 1) Bevorzugter Drag-Handle:
  //    - Wenn es ein Element mit .modal-drag-handle gibt, dieses nehmen
  //    - sonst fallback: gesamte modalContent
  const dragHandle =
    modalContent.querySelector('.modal-drag-handle') || modalContent;

  let isDragging = false;
  let offsetX = 0;
  let offsetY = 0;

  dragHandle.onmousedown = (e) => {
    // Nur linke Maustaste
    if (e.button !== 0) return;

    // ❗ NICHT draggen, wenn auf Inputs, Textareas, Selects, Buttons etc. geklickt wird
    if (e.target.closest('input, textarea, select, button, label, .no-drag')) {
      return;
    }

    // WICHTIG: kein preventDefault → Fokus & Texteingabe bleiben intakt
    // e.preventDefault();

    isDragging = true;

    // Position einfrieren
    const rect = modalContent.getBoundingClientRect();
    modalContent.style.position = 'fixed';
    modalContent.style.transition = 'none';
    modalContent.style.left = `${rect.left}px`;
    modalContent.style.top = `${rect.top}px`;
    modalContent.style.transform = 'none';

    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;

    const onMouseMove = (moveEvent) => {
      if (!isDragging) return;

      // Wenn Vollbild aktiv, Drag ignorieren
      if (modalContent.classList.contains('fullscreen')) return;

      modalContent.style.left = `${moveEvent.clientX - offsetX}px`;
      modalContent.style.top = `${moveEvent.clientY - offsetY}px`;
    };

    const onMouseUp = () => {
      isDragging = false;
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };
}
