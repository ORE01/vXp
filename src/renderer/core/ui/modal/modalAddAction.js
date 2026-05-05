'use strict';

import { closeModal } from './modalUI.js';
import { gatherModalData } from './modalData.js';
import { requestTableRefreshAfterMutation } from './modalRefresh.js';
import { displayErrorMessage } from './modalFeedback.js';

let isAddingRow = false;

// =====================================================
// ADD
// =====================================================

export function setupAddOperation(selectedTableName) {
  const saveButton = document.getElementById('saveButton');
  if (!saveButton) return;

  const clone = saveButton.cloneNode(true);
  saveButton.parentNode.replaceChild(clone, saveButton);

  clone.addEventListener('click', async () => {
    const form = document.getElementById('editForm');
    if (!form) return;

    await addSaveButtonHandler(form, selectedTableName);
  });
}

export async function addSaveButtonHandler(form, selectedTableName, onReload) {
  if (isAddingRow) return;
  isAddingRow = true;

  try {
    const newRowData = gatherModalData(form);
    delete newRowData.ID;

    await addNewRow(newRowData, selectedTableName);

    closeModal();
    requestTableRefreshAfterMutation(selectedTableName);

    if (typeof onReload === 'function') {
      await onReload(selectedTableName);
    }

    console.log(`[ModalAddAction] New row added to ${selectedTableName}`);
  } catch (error) {
    displayErrorMessage(`Failed to add new row: ${error?.message || String(error)}`);
  } finally {
    isAddingRow = false;
  }
}

export function addNewRow(newRowData, cleanTableName, { timeoutMs = 15000 } = {}) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const successCh = `add-new-row-success:${requestId}`;
  const errorCh = `add-new-row-error:${requestId}`;

  return new Promise((resolve, reject) => {
    let timer;

    const cleanup = () => {
      if (timer) clearTimeout(timer);

      if (window.api?.removeAllListeners) {
        window.api.removeAllListeners(successCh);
        window.api.removeAllListeners(errorCh);
      }
    };

    const onSuccess = () => {
      cleanup();
      resolve();
    };

    const onError = (error) => {
      const msg = error?.message || String(error || 'Unknown error');
      cleanup();
      reject(new Error(msg));
    };

    window.api.once(successCh, onSuccess);
    window.api.once(errorCh, onError);

    window.api.send('add-new-row', {
      newRowData,
      cleanTableName,
      requestId
    });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`addNewRow timeout (${requestId})`));
      }, timeoutMs);
    }
  });
}
