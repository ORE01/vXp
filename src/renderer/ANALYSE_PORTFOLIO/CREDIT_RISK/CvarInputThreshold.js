import processData from '../../UI/MODAL_HELPER/dataProcessor.js';
import { appState } from '../../renderer.js';
import { handleModalAction } from '../../UI/MODAL_HELPER/ModalActionHandler.js';
import { ensureRendered } from '../../../utils/domHelpers.js';





const CVAR_THRESHOLD_COLUMNS = [
  'metric',
  'yellow_threshold',
  'red_threshold',
  'is_percent',
  'description'
];

const TABLE_CVAR_THRESHOLD = 'CreditVaRInputThreshold';

export function handleCvarInputThresholdView() {
    //console.log('cvarINput')
  const container = document.getElementById('inputCreditVaRThresholdContainer');
  if (!container) {
    console.warn('⚠️ Container #inputCreditVaRThresholdContainer nicht gefunden.');
    return;
  }

  while (container.firstChild) container.removeChild(container.firstChild);

  const receivedData = appState.getCvarInputThreshold() || [];

  const tableData = Array.isArray(receivedData)
    ? receivedData.map(row => {
        const newRow = {};
        CVAR_THRESHOLD_COLUMNS.forEach(col => {
          if (Object.prototype.hasOwnProperty.call(row, col)) {
            newRow[col] = row[col];
          }
        });
        return newRow;
      })
    : [];

  container.innerHTML = processData(tableData, TABLE_CVAR_THRESHOLD);

  appState.setCvarInputThreshold(receivedData);

  ensureRendered(async () => {
    const reloadThresholds = async () => {
      // falls du eine eigene Fetch-Funktion hast:
      // await fetchAndUpdateCreditVaRInputThresholdData(TABLE_CVAR_THRESHOLD);
      handleCvarInputThresholdView();
    };

    const addButton = document.getElementById('cvarThresholdAddButton');
    if (addButton) {
      addButton.addEventListener('click', (event) => {
        handleModalAction(
          event,
          appState.getCvarInputThreshold() || [],
          null,
          TABLE_CVAR_THRESHOLD,
          'add',
          { modalId: 'editModal', onReload: reloadThresholds }
        );
      });
    }

    const editButtons = container.querySelectorAll('.edit-button');
    editButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleModalAction(
          event,
          appState.getCvarInputThreshold() || [],
          rowIndex,
          TABLE_CVAR_THRESHOLD,
          'edit',
          { modalId: 'editModal', onReload: reloadThresholds }
        );
      });
    });
  });
}

