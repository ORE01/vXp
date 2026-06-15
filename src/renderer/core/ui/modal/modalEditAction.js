'use strict';

import { closeModal } from './modalUI.js';
import { gatherModalData } from './modalData.js';
import { eraseButtonHandler } from './modalEraseAction.js';
import { getCleanTableName, getUniqueIdentifier } from '../../../utils/tableUtils.js';
import { displayErrorMessage } from './modalFeedback.js';

export function setupEditOperation(rowData, rowIndex, selectedTableName) {
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    const clone = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(clone, saveButton);
    clone.addEventListener('click', editSaveButtonHandler(selectedTableName, rowIndex, rowData));
  }

  const eraseButton = document.getElementById('eraseButton');
  if (eraseButton) {
    const clone = eraseButton.cloneNode(true);
    eraseButton.parentNode.replaceChild(clone, eraseButton);
    clone.addEventListener('click', eraseButtonHandler(selectedTableName, rowIndex, rowData));
  }
}

const editSaveButtonHandler = (selectedTableName, rowIndex, data) => async () => {
  if (!selectedTableName) {
    displayErrorMessage('Error: No table selected.');
    return;
  }

  try {
    const form = document.getElementById('editForm');
    const formData = form ? gatherModalData(form) : {};
    let newData = { ...(data || {}), ...(formData || {}) };

    if (String(selectedTableName).trim() === 'Customer') {
      if (newData.id == null) {
        try {
          const arr = window.appState?.getCustomerData?.();
          const customer = Array.isArray(arr) ? arr[0] : arr;
          if (customer?.id != null) newData.id = customer.id;
        } catch {}
      }

      if (newData.pdf_header == null) {
        const inputH = document.getElementById('or-headerText');
        if (inputH) newData.pdf_header = (inputH.value || '').trim();
      }

      if ((data && Object.prototype.hasOwnProperty.call(data, 'pdf_footer')) && newData.pdf_footer == null) {
        const inputF = document.getElementById('or-footerText');
        if (inputF) newData.pdf_footer = (inputF.value || '').trim();
      }
    }

    if (String(selectedTableName).trim() === 'Issuer') {
      // senior_unsecured ist der Notching-Anker und entspricht dem Base-Rating.
      newData.senior_unsecured = newData.RATING;
    }

    const cleanTableName = getCleanTableName(selectedTableName);
    const uniqueIdentifier = getUniqueIdentifier(newData, selectedTableName);

    await saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier);
    closeModal();
  } catch (error) {
    displayErrorMessage(`Failed to save changes: ${error?.message || String(error)}`);
  }
};

function saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier) {
  window.api.send('update-data', { newData, cleanTableName, rowIndex, uniqueIdentifier });
}
