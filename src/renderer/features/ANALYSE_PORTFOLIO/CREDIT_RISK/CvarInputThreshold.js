import processData from '../../../core/ui/modal/modalData.js';
import { appState } from '../../../renderer.js';
import { handleModalAction } from '../../../core/ui/modal/modalActions.js';
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
    console.warn('âš ï¸ Container #inputCreditVaRThresholdContainer nicht gefunden.');
    return;
  }

  while (container.firstChild) container.removeChild(container.firstChild);

  // Edit path stays untouched: keep the old CreditVaRInputThreshold store populated
  // so the (unchanged) Edit/Add modal flow below keeps working exactly as before.
  const receivedData = appState.getCvarInputThreshold() || [];

  // DISPLAY SOURCE (only this changed): show the live customer thresholds from the
  // Customer Store (CustomerCreditRiskThresholdSetting), not the old
  // CreditVaRInputThreshold rows / local defaults. Map metric_code / yellow_threshold
  // / red_threshold / description into the table's column shape. Percent formatting
  // (decimal -> e.g. 0.04 -> 4.00%) is handled by the existing format rules.
  const customerThresholds = appState.getCustomerCreditRiskThresholds?.() || [];

  console.warn('[CREDIT RISK THRESHOLD DISPLAY SOURCE]', {
    source: 'CustomerCreditRiskThresholdSetting/appState',
    thresholds: customerThresholds,
  });

  const tableData = customerThresholds.map(row => ({
    metric: row.metric_code,
    yellow_threshold: Number(row.yellow_threshold),
    red_threshold: Number(row.red_threshold),
    description: row.description ?? '',
  }));

  console.warn('[CVAR THRESHOLD TABLE RENDER]', {
  customerThresholdCount: customerThresholds.length,
  tableDataCount: tableData.length,
  tableData,
  tableName: TABLE_CVAR_THRESHOLD,
});

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




