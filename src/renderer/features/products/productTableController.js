import processData, { filterColumnsInData } from '../../core/ui/modal/modalData.js';
import { addTooltipsForTruncatedText } from '../../utils/tooltips.js';
import { appState } from '../../renderer.js';
import { openProdEditorByProdId } from '../../utils/linksToTables.js';
import { updateProductCSWarningUI } from '../../core/ui/warnings.js';
import { handleStructureTimelineModal } from './productSetupModal.js';
import { renderConfigurableTable } from '../../core/ui/tables/configurableTable.js';
import { clearColumnFilters } from '../CUSTOMER/tableLayouts/tableColumnFilters.js';





// 1) Spalten, die in der Tabelle angezeigt werden sollen
const PROD_TABLE_COLUMNS = [
  'PROD_ID',
  'DESCRIPTION',
  'CouponType',
  'SCHEDULE',
  'MATURITY',
  'ISSUER',
  'RANK',
  'RATING_PROD',
  'CS_SPREAD_OVERRIDE_BP',
  'FINLIB',
  'MODEL',
  'METHODE',
];

// ======================================================

let prodData;

const PROD_TABLE_ID = 'prodTable0';

export function renderProductTable() {
  // Sidebar-Subtrigger "Products > Add Products" IMMER verdrahten (auch ohne Produktdaten,
  // damit man in ein leeres Setup Produkte anlegen kann). Delegierter, idempotenter Listener.
  bindProdAddTypeTriggersOnce();

  const prodDataContainer = document.getElementById('prodDataContainer');
  if (!prodDataContainer) return;

  prodData = appState.getProdData();
  if (!Array.isArray(prodData) || prodData.length === 0) {
    prodDataContainer.innerHTML = '';
    return;
  }

  bindProdResetFiltersOnce();
  bindProdAddButtonOnce();

  // Only the product display columns are offered (selector/filter use this set).
  const rows = filterColumnsInData(prodData, PROD_TABLE_COLUMNS);
  appState.setFilteredProdData(rows);
  try { updateProductCSWarningUI?.(rows); } catch {}

  renderConfigurableTable({
    tableId: PROD_TABLE_ID,
    rows,

    tableContainerId: 'prodDataContainer',
    selectorContainerId: 'prodColumnSelector',
    selectedTableName: 'v_PRODUCTS_APP',

    // PROD_ID is the identity + edit link -> always first, not toggleable.
    lockedColumns: ['PROD_ID'],

    defaultVisibleColumns: PROD_TABLE_COLUMNS,

    sorting: { enabled: true },
    filtering: { enabled: true, mode: 'header' },

    onLayoutChange: () => renderProductTable(),

    afterRender: (container) => {
      try { addTooltipsForTruncatedText(container); } catch (e) { console.warn('Tooltips fail:', e); }
      makeProdIdButtons(container);
      bindProdIdLinkClicks(container);
    },
  });
}

function bindProdIdLinkClicks(container) {
  if (container.dataset.prodLinksBound === '1') return;
  container.dataset.prodLinksBound = '1';

  container.addEventListener('click', (ev) => {
    const btn = ev.target.closest('.prod-id-link');
    if (!btn) return;

    ev.preventDefault();
    ev.stopPropagation();

    const prodId = (btn.dataset.prodId || btn.textContent || '').trim();
    if (prodId) openProdEditorByProdId(prodId);
  });
}

function bindProdAddButtonOnce() {
  const prodAddButton = document.getElementById('prodAddButton');
  if (!prodAddButton || prodAddButton.dataset.bound) return;
  prodAddButton.dataset.bound = '1';

  prodAddButton.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();

    handleStructureTimelineModal(null, {
      mode: 'create',
      source: 'prod-add-button',
      templateName: null,
    });
  });
}

// Sidebar-Subtrigger "Add Products" (Simple Fixed Bond / Simple FRN / Complex Bond):
// oeffnet das New-Product-Modal mit vorgewaehltem Typ (ersetzt das alte Typ-Dropdown).
function bindProdAddTypeTriggersOnce() {
  if (window.__prodAddTypeBound) return;
  window.__prodAddTypeBound = true;

  document.addEventListener('click', (event) => {
    const btn = event.target.closest?.('[data-prod-add]');
    if (!btn) return;
    event.preventDefault();
    event.stopPropagation();

    const templateName = btn.dataset.prodAdd || 'COMPLEX_BOND';
    handleStructureTimelineModal(null, {
      mode: 'create',
      source: 'prod-add-subtrigger',
      templateName,
    });
  });
}

function bindProdResetFiltersOnce() {
  const btn = document.getElementById('prodResetFiltersButton');
  if (!btn || btn.dataset.tcfResetBound === '1') return;
  btn.dataset.tcfResetBound = '1';

  btn.addEventListener('click', () => {
    clearColumnFilters(PROD_TABLE_ID);

    renderProductTable();
  });
}

function filterProdData(data, filtersConfig) {
  return data.filter((dp) =>
    Object.entries(filtersConfig || {}).every(([key, set]) =>
      set?.has('ALL') || set?.has(dp[key])
    )
  );
}

function makeProdIdButtons(container) {
  const table =
    container.querySelector('table') ||
    container.querySelector('.data-container table');
  if (!table) return;

  const norm = (s) =>
    String(s || '')
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '_');

  const ths = table.querySelectorAll('thead th');
  let prodIdx = -1;
  ths.forEach((th, i) => {
    if (norm(th.textContent) === 'PROD_ID') prodIdx = i;
  });
  if (prodIdx === -1) return;

  table.querySelectorAll('tbody tr').forEach((row) => {
    const cell = row.cells?.[prodIdx];
    if (!cell) return;

    if (!cell.querySelector('.prod-id-link')) {
      const txt = (cell.textContent || '').trim();
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prod-id-link link-button';
      btn.textContent = txt || 'â€”';
      btn.dataset.prodId = txt || '';
      btn.setAttribute('aria-label', `Produkt Ã¶ffnen: ${txt || 'â€”'}`);
      btn.setAttribute('role', 'link');
      btn.tabIndex = 0;

      cell.textContent = '';
      cell.appendChild(btn);
    }
  });
}



export { prodData };


