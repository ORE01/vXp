import processData from '../../core/ui/modal/modalData.js';
import { handleModalAction } from '../../core/ui/modal/modalActions.js';
import { addTooltipsForTruncatedText } from '../../utils/tooltips.js';
import { ensureRendered } from '../../utils/domHelpers.js';
import { attachIssuerRankRatingDrawer } from './issuerRankRatingDrawer.js';

import {
  ISSUER_COLUMN_LABELS,
  filterIssuerColumnsForDisplay,
} from './issuerTableView.js';

import {
  buildIssuerModalRows,
} from './issuerModalMapper.js';

let issuerData;
let filteredIssuerData;

const ISSUER_TABLE_NAME = 'Issuer';

function bindIssuerEditButtons(container) {
  const issuerEditButtons = container.querySelectorAll('.edit-button');

  issuerEditButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();

      const rowIndex = parseInt(button.getAttribute('data-row'), 10);

      /**
       * IMPORTANT:
       * We render filtered/display rows,
       * but edit must still use the full original row data.
       */
      handleModalAction(
        event,
        buildIssuerModalRows(filteredIssuerData),
        rowIndex,
        ISSUER_TABLE_NAME,
        'edit'
      );
    });
  });
}

function bindIssuerAddButton() {
  const issuerAddButton = document.getElementById('issuerAddButton');
  if (!issuerAddButton || issuerAddButton.dataset.bound === '1') return;

  issuerAddButton.dataset.bound = '1';

  issuerAddButton.addEventListener('click', (event) => {
    handleModalAction(
      event,
      buildIssuerModalRows([{}]),
      null,
      ISSUER_TABLE_NAME,
      'add'
    );
  });
}

export async function handleIssuerData(receivedData, appState) {
  const issuerDataContainer = document.getElementById('issuerDataContainer');
  if (!issuerDataContainer) return;

  issuerData = Array.isArray(receivedData) ? receivedData : [];
  filteredIssuerData = issuerData;

  // Keep rank load for compatibility if other code expects this side-effect later.
  try {
    await appState?.getRankData?.();
  } catch (_error) {
    // Rank data is not required for v_ISSUER_APP display.
  }

  if (!issuerData.length) {
    issuerDataContainer.innerHTML = '';
    return;
  }

  const displayRows = filterIssuerColumnsForDisplay(filteredIssuerData);

  issuerDataContainer.innerHTML = processData(
    displayRows,
    ISSUER_TABLE_NAME,
    ISSUER_COLUMN_LABELS
  );

  ensureRendered(() => {
    addTooltipsForTruncatedText(issuerDataContainer);
    bindIssuerEditButtons(issuerDataContainer);
    bindIssuerAddButton();

    attachIssuerRankRatingDrawer({
      container: issuerDataContainer,
      issuerRows: filteredIssuerData,
      ratingsRows: appState?.getIssuerRankRatingData?.() || [],
    });
  });
}

export { issuerData, filteredIssuerData };