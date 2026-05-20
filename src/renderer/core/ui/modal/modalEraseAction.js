import {
  closeModal,
  bindModalCloseCleanup
} from './modalUI.js';

import {
  getCleanTableName,
  getUniqueIdentifier
} from '../../../utils/tableUtils.js';

import { displayErrorMessage } from './modalFeedback.js';

let isErasing = false;

export const eraseButtonHandler = (selectedTableName, rowIndex, data) => async () => {
  console.log('[MODAL ERASE] attempt:', {
    selectedTableName,
    rowIndex,
    data,
  });

  if (isErasing) return;
  isErasing = true;

  try {
    const cleanTableName = getCleanTableName(selectedTableName);
    const uniqueIdentifier = getUniqueIdentifier(data, selectedTableName);

    console.log('[MODAL ERASE] resolved:', {
      cleanTableName,
      uniqueIdentifier,
    });

    await eraseRow(cleanTableName, uniqueIdentifier);

    closeModal();
  } catch (error) {
    console.error('[MODAL ERASE] failed:', error);
    displayErrorMessage(`Failed to erase row: ${error?.message || error}`);
  } finally {
    isErasing = false;
  }
};

bindModalCloseCleanup();

function eraseRow(cleanTableName, uniqueIdentifier) {
  window.api.send('erase-data', {
    cleanTableName,
    uniqueIdentifier,
  });
}