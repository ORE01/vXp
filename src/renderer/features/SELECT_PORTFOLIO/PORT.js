// src/renderer/features/SELECT_PORTFOLIO/PORT.js

import {
  filterColumnsInData,
} from '../../core/ui/modal/modalData.js';

import processData from '../../core/ui/modal/modalData.js';

import { appState } from '../../renderer.js';

import {
  addTooltipsForTruncatedText,
  addProdIdTooltips,
} from '../../utils/tooltips.js';

import {
  formatNumberWithGrouping,
} from '../../utils/tableCellFormats.js';

import {
  attachIdLinks,
} from '../../utils/linksToTables.js';

import {
  applyPortfolioTableColoring,
} from '../../utils/tableCellColorize.js';

import {
  ALL_PORT_COLUMN_KEYS,
  DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
} from '../portfolio/portTableColumns.js';

import {
  PORTFOLIO_DISPLAY_NAMES,
} from '../portfolio/portfolioDisplayNames.js';

import {
  renderConfigurableTable,
} from '../../core/ui/tables/configurableTable.js';

import {
  clearColumnFilters,
  applyColumnFilters,
} from '../CUSTOMER/tableLayouts/tableColumnFilters.js';

// The active aggregate renderer for the "filtered:" summary box.
import {
  handlePortAggData as renderFilteredAgg,
} from '../portfolio/portfolioAggregates.js';

let tableName = 'Portfolios';

const TABLE_ID = 'portTable0';

const portDataMap = {};

// Last data rendered into the port table (for the "reset filters" button).
let lastPortRender = null;

// Raw (un-column-reduced) rows + portfolio name of the current selection, so the
// "filtered:" summary box can be recomputed from the active header filters.
let lastPortRawRows = null;
let lastPortName = null;

// Recompute the "filtered:" summary (portAggDataContainer<index>) from the rows
// that pass the current per-column header filters.
function updateFilteredAgg(index) {
  if (!Array.isArray(lastPortRawRows) || !lastPortName) return;

  const filteredRows = applyColumnFilters(lastPortRawRows, TABLE_ID);
  renderFilteredAgg(filteredRows, index, lastPortName);
}

function bindPortResetFiltersOnce() {
  const btn = document.getElementById('portResetFiltersButton');
  if (!btn || btn.dataset.tcfResetBound === '1') return;
  btn.dataset.tcfResetBound = '1';

  btn.addEventListener('click', () => {
    clearColumnFilters(TABLE_ID);

    // Re-run the full pipeline so the analyse sections reset to the full
    // portfolio too (not just the table + agg box).
    const index = lastPortRender?.index ?? 0;
    if (typeof appState.handlePortTable === 'function') {
      appState.handlePortTable(appState.getAllPortfolioData?.() || [], index);
    } else if (lastPortRender) {
      renderPortTableOnly(lastPortRender.rows, index);
      updateFilteredAgg(index);
    }
  });
}

const pf = (v) => {
  if (v == null) return 0;

  const n = parseFloat(
    String(v).replace(/\s/g, '')
  );

  return Number.isFinite(n) ? n : 0;
};

const safeDiv = (num, den) => (
  den ? num / den : 0
);

// =============================
// 🔹 TABLE RENDER
// =============================

function renderPortTableOnly(portData, index) {
  lastPortRender = { rows: portData, index };
  bindPortResetFiltersOnce();

  renderConfigurableTable({
    tableId: TABLE_ID,

    rows: portData,

    tableContainerId: `portDataContainer${index}`,
    selectorContainerId: 'portColumnSelector',

    selectedTableName: tableName,

    // Always shown first, not toggleable, hidden from the column selector.
    lockedColumns: ['TRADE_ID', 'PROD_ID', 'DESCRIPTION', 'clean_price', 'C_SPREAD', 'NOTIONAL', 'NAV'],

    defaultVisibleColumns: DEFAULT_VISIBLE_PORT_COLUMN_KEYS,

    columnLabelMap: PORTFOLIO_DISPLAY_NAMES,

    sorting: {
      enabled: true,
    },

    // Dynamic per-column value filters, integrated into the column headers.
    filtering: {
      enabled: true,
      mode: 'header',
    },

    // Column-visibility change: light re-render of just the table + agg box.
    onLayoutChange: () => {
      const currentFilteredPortData =
        appState.getFilteredPortData?.() || portData;

      renderPortTableOnly(currentFilteredPortData, index);
      updateFilteredAgg(index);
    },

    // Header value-filter change: re-run the whole portfolio render pipeline so
    // the analyse sections (Breakdown / Performance / Liquidity / sums) follow
    // the filter — just like the former AppState filter path did. The
    // orchestrator now applies the same header filters (applyColumnFilters).
    onFilterChange: () => {
      const all = appState.getAllPortfolioData?.() || [];
      if (typeof appState.handlePortTable === 'function') {
        appState.handlePortTable(all, index);
      } else {
        renderPortTableOnly(appState.getFilteredPortData?.() || portData, index);
        updateFilteredAgg(index);
      }
    },

    afterRender: (container) => {
      applyPortfolioTableColoring(container);
      attachIdLinks(container);

      addTooltipsForTruncatedText(container);
      addProdIdTooltips(container);
    },
  });
}

// =============================
// 🔹 MAIN TABLE HANDLER
// =============================

console.log('[PORT MODULE] loaded');

export function handlePortProdData(receivedData, index, port_name) {
  const elementId = `portDataContainer${index}`;
  const portDataContainer = document.getElementById(elementId);

  if (!portDataContainer || !Array.isArray(receivedData)) return;

  // The Portfolios table doesn't carry the per-product Credit Spread Override;
  // it lives in the product data (keyed by PROD_ID). Enrich each row from there.
  const enriched = receivedData.map((row) => {
    const prodId = row?.PROD_ID ?? row?.product_id;
    const override = appState.getProdById?.(prodId)?.CS_SPREAD_OVERRIDE_BP;
    return {
      ...row,
      CS_SPREAD_OVERRIDE_BP: override ?? row?.CS_SPREAD_OVERRIDE_BP ?? null,
    };
  });

  // Keep the raw rows + name so the "filtered:" box can be recomputed from the
  // header filters (the sums need fields that the reduced view drops).
  lastPortRawRows = enriched;
  lastPortName = port_name;

  const filteredPortData = filterColumnsInData(
    enriched,
    ALL_PORT_COLUMN_KEYS
  );

  appState.setFilteredPortData(filteredPortData);

  renderPortTableOnly(filteredPortData, index);
}

// =============================
// 🔹 AGG DATA
// =============================

export function handlePortAggData(receivedData, index, port_name) {
  const elementId = `portDataContainer${index}`;
  const aggContainerId = `portAggDataContainer${index}`;

  if (!portDataMap[elementId]) {
    portDataMap[elementId] = {};
  }

  const portData = filterColumnsInData(
    receivedData,
    ALL_PORT_COLUMN_KEYS
  );

  let PortValue = 0;
  let PortValueBuy = 0;
  let PortNotional = 0;
  let PortYield = 0;
  let PortYieldA = 0;
  let PortPV01 = 0;
  let PortCPV01 = 0;
  let PortTtM = 0;

  for (let i = 0; i < portData.length; i++) {
    const r = portData[i];

    const nav = pf(r.NAV);
    const notional = pf(r.NOTIONAL);
    const priceBuy = pf(r.PRICE_BUY);

    PortValueBuy += (priceBuy / 100) * notional;

    PortValue += nav;
    PortNotional += notional;
    PortYield += pf(r.ytmPort);
    PortYieldA += pf(r.ytmPortA);
    PortPV01 += pf(r.PV01);
    PortCPV01 += pf(r.CPV01);
    PortTtM += pf(r.TtM) * notional;
  }

  const aggData = {
    formPortValue: formatNumberWithGrouping(PortValue) + ' EUR',
    formPortValueBuy: formatNumberWithGrouping(PortValueBuy) + ' EUR',
    formPortNotional: formatNumberWithGrouping(PortNotional) + ' EUR',
    formPortPV01abs: formatNumberWithGrouping(PortPV01) + ' EUR',
    formPortCPV01abs: formatNumberWithGrouping(PortCPV01) + ' EUR',
    formPortYield: (safeDiv(PortYield, PortNotional) * 100).toFixed(2) + '%',
    formPortYieldA: (safeDiv(PortYieldA, PortNotional) * 100).toFixed(2) + '%',
    formPortPV01: (safeDiv(PortPV01, PortNotional) * 10000).toFixed(2),
    formPortCPV01: (safeDiv(PortCPV01, PortNotional) * 10000).toFixed(2),
    formPortTtM: safeDiv(PortTtM, PortNotional).toFixed(2),
  };

  appState.setPortAggData(elementId, aggData);

  const aggKeysToShow = [
    'formPortValue',
    'formPortValueBuy',
    'formPortNotional',
    'formPortYield',
    'formPortYieldA',
    'formPortPV01',
    'formPortCPV01',
    'formPortTtM',
  ];

  const portDataAggContainer =
    document.getElementById(aggContainerId);

  if (!portDataAggContainer) return;

  requestAnimationFrame(() => {
    const filteredAggData = Object.fromEntries(
      Object.entries(aggData).filter(([key]) =>
        aggKeysToShow.includes(key)
      )
    );

    const tableData =
      mapPortDataToTableRows(filteredAggData);

    const portDataHTML =
      processData(tableData, tableName);

    portDataAggContainer.innerHTML = portDataHTML;

    requestAnimationFrame(() => {
      addTooltipsForTruncatedText(portDataAggContainer);
      addProdIdTooltips?.(portDataAggContainer);
      attachIdLinks?.(portDataAggContainer);
    });
  });
}

function mapPortDataToTableRows(data) {
  return [
    {
      label: 'Notional',
      value: data.formPortNotional,
    },
    {
      label: 'NetAssetValue',
      value: data.formPortValue,
    },
    {
      label: 'NetAssetValueBuy',
      value: data.formPortValueBuy,
    },
    {
      label: 'Portfolio Yield',
      value: data.formPortYield,
    },
    {
      label: 'Portfolio Yield (act)',
      value: data.formPortYieldA,
    },
    {
      label: 'Interest Rate Sensitivity (PV01)',
      value: data.formPortPV01,
    },
    {
      label: 'Credit Spread Sensitivity (CPV01)',
      value: data.formPortCPV01,
    },
  ];
}