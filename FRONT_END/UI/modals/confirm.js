// FRONT_END/UI/modals/confirm.js

/**
 * Simple modal helpers (DOM-only).
 * No appState, no IPC, no feature logic.
 */

export function showMessageBox(message, onClose) {
  const overlay = document.createElement('div');
  overlay.classList.add('confirmation-overlay');

  const modal = document.createElement('div');
  modal.classList.add('confirmation-modal', 'confirmation-success');

  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  messageElement.classList.add('confirmation-message');
  modal.appendChild(messageElement);

  const okButton = document.createElement('button');
  okButton.textContent = 'OK';
  okButton.classList.add('confirmation-button', 'confirmation-button-green');

  const close = () => {
    try { document.body.removeChild(overlay); } catch {}
    if (typeof onClose === 'function') onClose();
  };

  okButton.addEventListener('click', close);

  overlay.addEventListener('click', (e) => {
    // click outside closes (optional behavior – remove if you don't want it)
    if (e.target === overlay) close();
  });

  modal.appendChild(okButton);
  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // ESC closes
  const onKey = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      close();
    }
  };
  document.addEventListener('keydown', onKey);
}

export function showConfirmationBox(message, onConfirm, onCancel) {
  const overlay = document.createElement('div');
  overlay.classList.add('confirmation-overlay');

  const modal = document.createElement('div');
  modal.classList.add('confirmation-modal');

  const messageElement = document.createElement('p');
  messageElement.textContent = message;
  messageElement.classList.add('confirmation-message');
  modal.appendChild(messageElement);

  const buttonContainer = document.createElement('div');
  buttonContainer.classList.add('confirmation-button-container');

  const confirmButton = document.createElement('button');
  confirmButton.textContent = 'Yes';
  confirmButton.classList.add('confirmation-button', 'confirmation-button-red');

  const cancelButton = document.createElement('button');
  cancelButton.textContent = 'No';
  cancelButton.classList.add('confirmation-button', 'confirmation-button-grey');

  const close = () => {
    try { document.body.removeChild(overlay); } catch {}
  };

  confirmButton.addEventListener('click', () => {
    close();
    if (typeof onConfirm === 'function') onConfirm();
  });

  cancelButton.addEventListener('click', () => {
    close();
    if (typeof onCancel === 'function') onCancel();
  });

  // click outside = cancel (optional)
  overlay.addEventListener('click', (e) => {
    if (e.target === overlay) {
      close();
      if (typeof onCancel === 'function') onCancel();
    }
  });

  buttonContainer.appendChild(confirmButton);
  buttonContainer.appendChild(cancelButton);
  modal.appendChild(buttonContainer);

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  // ESC = cancel
  const onKey = (e) => {
    if (e.key === 'Escape') {
      document.removeEventListener('keydown', onKey);
      close();
      if (typeof onCancel === 'function') onCancel();
    }
  };
  document.addEventListener('keydown', onKey);
}
