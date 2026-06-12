import { renderConfigurableTable } from '../../core/ui/tables/configurableTable.js';

import { handleModalAction } from '../../core/ui/modal/modalActions.js';
import { addTooltipsForTruncatedText } from '../../utils/tooltips.js';
import { ensureRendered } from '../../utils/domHelpers.js';
import { attachIssuerRankRatingDrawer } from './issuerRankRatingDrawer.js';

let issuerData;
let filteredIssuerData;

const ISSUER_TABLE_NAME = 'Issuer';
const ISSUER_TABLE_ID = 'issuerTable0';

const ISSUER_VISIBLE_COLUMNS = [
  'INCLUDE',
  'ISSUER',
  'TICKER',
  'BASE_RATING',
  'Country',
  'RANK_RATING_COUNT',
  'EXPLICIT_COUNT',
  'GENERATED_COUNT',
  'RATING_STATUS',
];

const ISSUER_COLUMN_LABELS = {
  INCLUDE: 'Include',
  ISSUER: 'Issuer',
  TICKER: 'Ticker',
  BASE_RATING: 'Base Rating',
  Country: 'Country',
  RANK_RATING_COUNT: 'Ranks',
  EXPLICIT_COUNT: 'Explicit',
  GENERATED_COUNT: 'Generated',
  RATING_STATUS: 'Status',
};

function mapIssuerViewRowToIssuerTableRow(row = {}) {
  const baseRating = row.RATING ?? row.BASE_RATING ?? '';

  return {
    INCLUDE: row.INCLUDE ?? 1,
    ISSUER: row.ISSUER ?? '',
    TICKER: row.TICKER ?? '',
    RATING: baseRating,

    senior_secured: row.senior_secured ?? '',
    senior_preferred: row.senior_preferred ?? '',
    senior_unsecured: row.senior_unsecured ?? baseRating,
    senior_subordinated: row.senior_subordinated ?? '',
    junior_subordinated: row.junior_subordinated ?? '',

    Country: row.Country ?? '',
  };
}

function buildIssuerModalRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(mapIssuerViewRowToIssuerTableRow);
}

function bindIssuerEditButtons(container) {
  const issuerEditButtons = container.querySelectorAll('.edit-button');

  issuerEditButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();

      const rowIndex = parseInt(button.getAttribute('data-row'), 10);

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

function renderIssuerTable(appState) {
  renderConfigurableTable({
    tableId: ISSUER_TABLE_ID,
    rows: filteredIssuerData,

    tableContainerId: 'issuerDataContainer',
    selectorContainerId: 'issuerColumnSelector',

    selectedTableName: ISSUER_TABLE_NAME,

    defaultVisibleColumns: ISSUER_VISIBLE_COLUMNS,
    columnLabelMap: ISSUER_COLUMN_LABELS,

    sorting: {
      enabled: true,
    },

    onLayoutChange: () => {
      renderIssuerTable(appState);
    },

    afterRender: (container) => {
      ensureRendered(() => {
        addTooltipsForTruncatedText(container);
        bindIssuerEditButtons(container);
        bindIssuerAddButton();

        attachIssuerRankRatingDrawer({
          container,
          issuerRows: filteredIssuerData,
          ratingsRows: appState?.getIssuerRankRatingData?.() || [],
        });
      });
    },
  });
}

export async function handleIssuerData(receivedData, appState) {
  const issuerDataContainer = document.getElementById('issuerDataContainer');
  if (!issuerDataContainer) return;

  issuerData = Array.isArray(receivedData) ? receivedData : [];
  filteredIssuerData = issuerData;

  try {
    await appState?.getRankData?.();
  } catch (_error) {
    // Rank data is not required for Issuer display.
  }

  if (!issuerData.length) {
    issuerDataContainer.innerHTML = '';
    return;
  }

  renderIssuerTable(appState);
}

export { issuerData, filteredIssuerData };