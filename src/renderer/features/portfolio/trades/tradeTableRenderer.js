import processData from '../../../core/ui/modal/modalData.js';
import { handleModalAction } from '../../../core/ui/modal/modalActions.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../../utils/tooltips.js';
import { attachIdLinks } from '../../../utils/linksToTables.js';
import { enhanceIncludeCheckboxes } from '../../../core/ui/enhancers/includeToggleEnhancer.js';

let filteredDealsData;

/**
 * Deals table display columns only.
 *
 * Important:
 * - State keeps the full enriched view rows.
 * - The table renders only these selected columns.
 * - Internal keys remain unchanged; labels are only UI names.
 */
const DEALS_VISIBLE_COLUMNS = [
  'TRADE_ID',
  'INCLUDE',
  'PORT_NAME',
  'DEPOT_BANK',
  'PROD_ID',
  'TRADE_DATE',
  'CATEGORY',
  'NOTIONAL',
  'PRICE_BUY',
  'product_name',
  'product_type',
  'coupon_type',
  'currency_code',
  'maturity_date',
  'PRODUCT_EXISTS',
  'VALIDATION_STATUS',
];

const DEALS_COLUMN_LABELS = {
  TRADE_ID: 'Trade ID',
  INCLUDE: 'Include',
  PORT_NAME: 'Portfolio',
  DEPOT_BANK: 'Depot Bank',
  PROD_ID: 'Product ID',
  TRADE_DATE: 'Trade Date',
  CATEGORY: 'Category',
  NOTIONAL: 'Notional',
  PRICE_BUY: 'Buy Price',
  product_name: 'Product Name',
  product_type: 'Product Type',
  coupon_type: 'Coupon Type',
  currency_code: 'CCY',
  maturity_date: 'Maturity',
  PRODUCT_EXISTS: 'Product Exists',
  VALIDATION_STATUS: 'Status',
};

function filterDealsColumnsForDisplay(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    return DEALS_VISIBLE_COLUMNS.reduce((obj, key) => {
      obj[key] = row?.[key] ?? '';
      return obj;
    }, {});
  });
}

function mapDealViewRowToDealsMainRow(row = {}) {
  return {
    TRADE_ID: row.TRADE_ID ?? '',
    INCLUDE: row.INCLUDE ?? 1,

    port_name: row.port_name ?? row.PORT_NAME ?? '',
    Depotbank: row.Depotbank ?? row.DEPOT_BANK ?? '',

    PROD_ID: row.PROD_ID ?? row.product_id ?? '',
    TRADE_DATE: row.TRADE_DATE ?? '',
    CATEGORY: row.CATEGORY ?? '',
    NOTIONAL: row.NOTIONAL ?? '',
    PRICE_BUY: row.PRICE_BUY ?? '',
  };
}

function buildDealsMainModalRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(mapDealViewRowToDealsMainRow);
}

export function handleDealsData(receivedData, dealsTableName, opts = {}) {
  const tableName = dealsTableName || '';

  const ctx = resolveDealsContext(opts);
  const { targetId, dropdownId, buttonId, isOffer } = ctx;

  const targetContainer = document.getElementById(targetId);
  if (!targetContainer) return;

  // Gate: If we're rendering the main deals container and no portfolio is selected, render nothing.
  // This prevents showing ALL portfolios on reload / initial state.
  if (!isOffer && targetId === 'dealsDataContainer') {
    const dd = dropdownId ? document.getElementById(dropdownId) : null;
    const sel = String(dd?.value ?? '').trim();

    const isNone =
      !sel ||
      sel === '__NONE__' ||
      sel === 'Select a table';

    if (isNone) {
      if (opts.allowClear === true) targetContainer.innerHTML = '';
      return;
    }
  }

  // Empty payload = no-op, unless explicitly allowed.
  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    if (opts.allowClear === true) targetContainer.innerHTML = '';
    return;
  }

  // 1) Dropdown snapshot only for Deals
  const snap =
    !isOffer &&
    preserveAndRestoreFilterDropdown({
      dropdownId,
      enabled: opts.restoreDropdown !== false,
    });

  // 2) Render
  // Keep full rows for Add/Edit logic.
  filteredDealsData = receivedData;

  renderDealsTableIntoContainer(targetContainer, filteredDealsData, tableName);

  // 3) UI Enhancements
  applyDealsUIEnhancements(targetContainer);
  enhanceIncludeCheckboxes(targetContainer);

  // 4) Mirror only when explicitly requested.
  if (!isOffer && opts.mirrorToNewPortfolio === true) {
    mirrorDealsToNewPortfolioPanel(filteredDealsData, tableName);
  }

  // 5) Add button only for Deals
  if (!isOffer) {
    bindDealsAddButtonOnce(buttonId, tableName);
  }

  // 6) Restore dropdown only for Deals
  if (snap) snap.restore();
}

/* =========================================================
   Context (offers vs deals)
   ========================================================= */
function resolveDealsContext(opts = {}) {
  const forced = opts.forceTarget; // 'offers' | 'deals' | 'newPortfolio' | undefined

  const isOffer = forced === 'offers';
  const isNewPortfolio = forced === 'newPortfolio';

  return {
    isOffer,
    targetId: isOffer
      ? 'offersDataContainer'
      : isNewPortfolio
        ? 'newPortfolioDealsDataContainer'
        : 'dealsDataContainer',

    dropdownId: isOffer || isNewPortfolio ? null : 'createdDealsDropdown',
    buttonId: isOffer || isNewPortfolio ? null : 'dealsAddButton',
  };
}

/* =========================================================
   Rendering
   ========================================================= */
function renderDealsTableIntoContainer(container, rows, tableName) {
  const displayRows = filterDealsColumnsForDisplay(rows);

  container.innerHTML = processData(
    displayRows,
    tableName,
    DEALS_COLUMN_LABELS
  );
}

/* =========================================================
   UI enhancements
   ========================================================= */
function applyDealsUIEnhancements(container) {
  addTooltipsForTruncatedText(container);
  addProdIdTooltips(container);
  attachIdLinks(container);
}

/* =========================================================
   Mirror (Deals only)
   ========================================================= */
function mirrorDealsToNewPortfolioPanel(rows, tableName) {
  const mirrorContainer = document.getElementById('newPortfolioDealsDataContainer');
  if (!mirrorContainer) return;

  const displayRows = filterDealsColumnsForDisplay(rows);

  mirrorContainer.innerHTML = processData(
    displayRows,
    tableName,
    DEALS_COLUMN_LABELS
  );

  addTooltipsForTruncatedText(mirrorContainer);
  addProdIdTooltips(mirrorContainer);
  attachIdLinks(mirrorContainer);
}

/* =========================================================
   Add button binding (once, Deals only)
   ========================================================= */
function bindDealsAddButtonOnce(buttonId, tableName) {
  const addButton = document.getElementById(buttonId);
  if (!addButton || addButton.dataset.bound === '1') return;

  addButton.dataset.bound = '1';
  addButton.addEventListener('click', (event) => {
    console.log('Start Add Deal', tableName);

    // Important: use full rows, not display-filtered rows.
    handleModalAction(
      event,
      buildDealsMainModalRows(filteredDealsData),
      null,
      tableName,
      'add'
    );
  });
}

/* =========================================================
   Filter / Dropdown: snapshot + restore (Deals only)
   ========================================================= */
function preserveAndRestoreFilterDropdown({ dropdownId, enabled = true } = {}) {
  if (!enabled || !dropdownId) return null;

  const el = document.getElementById(dropdownId);
  if (!el) return null;

  const snap = {
    id: dropdownId,
    value: el.value,
    index: el.selectedIndex,
    text: el.selectedIndex >= 0 ? el.options[el.selectedIndex]?.text : null,
  };

  return {
    restore() {
      const dd = document.getElementById(snap.id);
      if (!dd) return;

      if (snap.value && dd.querySelector(`option[value="${CSS.escape(snap.value)}"]`)) {
        dd.value = snap.value;
      } else if (snap.text) {
        const opt = Array.from(dd.options).find((o) => o.text === snap.text);
        if (opt) dd.value = opt.value;
        else if (snap.index >= 0 && snap.index < dd.options.length)
          dd.selectedIndex = snap.index;
      }
    },
  };
}