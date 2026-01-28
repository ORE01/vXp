import processData from '../../UI/MODAL_HELPER/dataProcessor.js';
import { appState } from '../../../renderer.js';
import { handleModalAction } from '../../UI/MODAL_HELPER/ModalActionHandler.js';
import { ensureRendered } from '../../../utils/domHelpers.js';

// Spalten der CreditVaRInput-Tabelle â€“ ggf. an dein Schema anpassen
const CVAR_CONFIG_COLUMNS = [
  'name',
  'conf_level',
  'corr',
  'recovery_rate',
  'horizon_days',
  'n_simulations',
  'description',
  'cr_model',
  'updated_at'
];

// Tabellen-Name im generischen Table-/Form-System
const TABLE_CVAR_CONFIG = 'CreditVaRInput';

export function handleCvarInput() {
  //console.log('handleCvarInputConfigView');

  const container = document.getElementById('inputCreditVaRConfigContainer');
  if (!container) {
    console.warn('âš ï¸ Container #inputCreditVaRConfigContainer nicht gefunden.');
    return;
  }

  // Container leeren
  while (container.firstChild) container.removeChild(container.firstChild);

  // Daten ausschlieÃŸlich aus appState holen
  const receivedData = appState.getCvarInput() || [];

  // Daten in definierter Spaltenreihenfolge fÃ¼r processData vorbereiten
  const tableData = Array.isArray(receivedData)
    ? receivedData.map(row => {
        const newRow = {};
        CVAR_CONFIG_COLUMNS.forEach(col => {
          if (Object.prototype.hasOwnProperty.call(row, col)) {
            newRow[col] = row[col];
          }
        });
        return newRow;
      })
    : [];

  // Tabelle rendern
  container.innerHTML = processData(tableData, TABLE_CVAR_CONFIG);

  // Sicherheitshalber wieder in den State schreiben
  appState.setCvarInput(receivedData);

  // Buttons nach Rendern binden
  ensureRendered(async () => {
    const reloadConfig = async () => {
      // Wenn du eine eigene Fetch-Funktion hast, kannst du sie hier aufrufen
      // await fetchAndUpdateCreditVaRInputData(TABLE_CVAR_CONFIG);
      // oder einfach nur neu rendern, wenn handleFormAction den State aktualisiert:
      handleCvarInputConfigView();
    };

    // ðŸ”¹ ADD-Button
    const addButton = document.getElementById('cvarConfigAddButton');
    if (addButton) {
      addButton.addEventListener('click', (event) => {
        handleModalAction(
          event,
          appState.getCvarInput() || [],
          null,                     // kein rowIndex â†’ ADD
          TABLE_CVAR_CONFIG,
          'add',
          { modalId: 'editModal', onReload: reloadConfig }
        );
      });
    }

    // ðŸ”¹ EDIT-Buttons in der Tabelle
    const editButtons = container.querySelectorAll('.edit-button');
    editButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleModalAction(
          event,
          appState.getCvarInput() || [],
          rowIndex,
          TABLE_CVAR_CONFIG,
          'edit',
          { modalId: 'editModal', onReload: reloadConfig }
        );
      });
    });
  });
}





