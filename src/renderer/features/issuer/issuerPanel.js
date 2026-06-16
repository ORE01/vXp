import { renderConfigurableTable } from '../../core/ui/tables/configurableTable.js';
import { clearColumnFilters } from '../CUSTOMER/tableLayouts/tableColumnFilters.js';

import { handleModalAction } from '../../core/ui/modal/modalActions.js';
import { addTooltipsForTruncatedText } from '../../utils/tooltips.js';
import { ensureRendered } from '../../utils/domHelpers.js';
import { attachIssuerRankRatingDrawer } from './issuerRankRatingDrawer.js';

import {
  ISSUER_COLUMN_LABELS,
  ISSUER_VISIBLE_COLUMNS,
  // filterIssuerColumnsForDisplay,
} from './issuerTableView.js';

import {
  buildIssuerModalRows,
} from './issuerModalMapper.js';

let issuerData;
let filteredIssuerData;

const ISSUER_TABLE_NAME = 'Issuer';
const ISSUER_TABLE_ID = 'issuerTable0';

// const ISSUER_VISIBLE_COLUMNS = [
//   'INCLUDE',
//   'ISSUER',
//   'TICKER',
//   'BASE_RATING',
//   'Country',
//   'RANK_RATING_COUNT',
//   'EXPLICIT_COUNT',
//   'GENERATED_COUNT',
//   'RATING_STATUS',
// ];

// const ISSUER_COLUMN_LABELS = {
//   INCLUDE: 'Include',
//   ISSUER: 'Issuer',
//   TICKER: 'Ticker',
//   BASE_RATING: 'Base Rating',
//   Country: 'Country',
//   RANK_RATING_COUNT: 'Ranks',
//   EXPLICIT_COUNT: 'Explicit',
//   GENERATED_COUNT: 'Generated',
//   RATING_STATUS: 'Status',
// };

// function mapIssuerViewRowToIssuerTableRow(row = {}) {
//   const baseRating = row.RATING ?? row.BASE_RATING ?? '';

//   return {
//     INCLUDE: row.INCLUDE ?? 1,
//     ISSUER: row.ISSUER ?? '',
//     TICKER: row.TICKER ?? '',
//     RATING: baseRating,

//     senior_secured: row.senior_secured ?? '',
//     senior_preferred: row.senior_preferred ?? '',
//     senior_unsecured: row.senior_unsecured ?? baseRating,
//     senior_subordinated: row.senior_subordinated ?? '',
//     junior_subordinated: row.junior_subordinated ?? '',

//     Country: row.Country ?? '',
//   };
// }

// function buildIssuerModalRows(rows) {
//   return (Array.isArray(rows) ? rows : []).map(mapIssuerViewRowToIssuerTableRow);
// }

// Make the "Issuer" cell a clickable link that opens the edit modal
// (replaces the former Edit column — same pattern as the Portfolios ID links).
function bindIssuerNameLinks(container) {
  const table = container.querySelector('table');
  if (!table) return;

  let issuerIdx = -1;
  table.querySelectorAll('thead th').forEach((th, i) => {
    if (String(th.textContent || '').trim().toLowerCase() === 'issuer') issuerIdx = i;
  });
  if (issuerIdx === -1) return;

  table.querySelectorAll('tbody tr').forEach((row) => {
    const cell = row.cells?.[issuerIdx];
    if (!cell || cell.querySelector('.issuer-name-link')) return;

    const name = (cell.textContent || '').trim();
    if (!name) return;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'issuer-name-link link-button';
    btn.textContent = name;
    btn.setAttribute('role', 'link');

    btn.addEventListener('click', (event) => {
      event.stopPropagation();

      const rowIndex = filteredIssuerData.findIndex(
        (r) => String(r?.ISSUER ?? '').trim() === name
      );
      if (rowIndex < 0) return;

      handleModalAction(
        event,
        buildIssuerModalRows(filteredIssuerData),
        rowIndex,
        ISSUER_TABLE_NAME,
        'edit'
      );
    });

    cell.textContent = '';
    cell.appendChild(btn);
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

function bindIssuerResetFiltersOnce(appState) {
  const btn = document.getElementById('issuerResetFiltersButton');
  if (!btn || btn.dataset.tcfResetBound === '1') return;
  btn.dataset.tcfResetBound = '1';

  btn.addEventListener('click', () => {
    clearColumnFilters(ISSUER_TABLE_ID);

    renderIssuerTable(appState);
  });
}

function renderIssuerTable(appState) {
  bindIssuerResetFiltersOnce(appState);

  renderConfigurableTable({
    tableId: ISSUER_TABLE_ID,
    rows: filteredIssuerData,

    tableContainerId: 'issuerDataContainer',
    selectorContainerId: 'issuerColumnSelector',

    selectedTableName: ISSUER_TABLE_NAME,

    // Always shown first, not toggleable, hidden from the column selector.
    // ("Details" is the Ratings action column added after render — inherently
    // always shown and not selectable.)
    lockedColumns: ['ISSUER', 'TICKER', 'BASE_RATING', 'Country'],

    defaultVisibleColumns: ISSUER_VISIBLE_COLUMNS,
    columnLabelMap: ISSUER_COLUMN_LABELS,

    // No Edit column — the Issuer cell itself opens the edit modal.
    processDataOptions: { includeEditColumn: false },

    sorting: {
      enabled: true,
    },

    // Dynamic per-column value filters, integrated into the column headers.
    filtering: {
      enabled: true,
      mode: 'header',
    },

    onLayoutChange: () => {
      renderIssuerTable(appState);
    },

    afterRender: (container) => {
      ensureRendered(() => {
        addTooltipsForTruncatedText(container);
        bindIssuerNameLinks(container);
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