import {
  closeModal,
  bindModalCloseCleanup
} from './modalUI.js';

import {
  getCleanTableName,
  getUniqueIdentifier
} from '../../../utils/tableUtils.js';

import { displayErrorMessage } from './modalFeedback.js';
import { showConfirmationBox } from '../dialogs/confirm.js';

let isErasing = false;

// Provider-Mappings: Löschen der Zeile soll auch die zugehörige tblTS-Spalte
// (Name = ID) entfernen. Das ist destruktiv -> Bestätigungsdialog (Englisch).
const PROVIDER_TABLES = new Set(['ecb', 'fed', 'yahoo']);

export const eraseButtonHandler = (selectedTableName, rowIndex, data) => async () => {
  console.log('[MODAL ERASE] attempt:', { selectedTableName, rowIndex, data });

  if (isErasing) return;

  const cleanTableName = getCleanTableName(selectedTableName);

  const runErase = async (dropTsColumn) => {
    isErasing = true;
    try {
      const uniqueIdentifier = getUniqueIdentifier(data, selectedTableName);
      console.log('[MODAL ERASE] resolved:', { cleanTableName, uniqueIdentifier, dropTsColumn });
      await eraseRow(cleanTableName, uniqueIdentifier, dropTsColumn);
      closeModal();
    } catch (error) {
      console.error('[MODAL ERASE] failed:', error);
      displayErrorMessage(`Failed to erase row: ${error?.message || error}`);
    } finally {
      isErasing = false;
    }
  };

  // Provider-Zeile -> Bestätigung inkl. Hinweis auf die tblTS-Spalte.
  if (PROVIDER_TABLES.has(cleanTableName)) {
    const col = data && data.ID != null ? String(data.ID).trim() : '';
    const name = data && data.NAME ? String(data.NAME) : (col || 'this series');
    const message = col
      ? `Delete "${name}" and its full history from tblTS (column "${col}")? This cannot be undone.`
      : `Delete "${name}"? This cannot be undone.`;

    showConfirmationBox(message, () => runErase(col), () => { /* cancel: keep row */ });
    return;
  }

  // Alle anderen Tabellen: unverändertes Verhalten (kein Kaskaden-Drop).
  await runErase(null);
};

bindModalCloseCleanup();

function eraseRow(cleanTableName, uniqueIdentifier, dropTsColumn) {
  window.api.send('erase-data', {
    cleanTableName,
    uniqueIdentifier,
    dropTsColumn: dropTsColumn || null,
  });
}