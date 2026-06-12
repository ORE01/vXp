import { filterColumnsInData } from '../../core/ui/modal/modalData.js';
import processData from '../../core/ui/modal/modalData.js';

import { appState } from '../../renderer.js';

import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { formatNumberWithGrouping } from '../../utils/format.js';
import { attachIdLinks } from '../../utils/linksToTables.js';
import { applyPortfolioTableColoring } from '../../utils/tableColorize.js';

import {
  ALL_PORT_COLUMN_KEYS,
  DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
  getPortColumnLabel,
} from './portTableColumns.js';

import {
  renderPortColumnSelector,
  bindPortColumnSelector,
} from './portColumnSelector.js';

import {
  ensureTableLayout,
  getVisibleColumns,
} from '../CUSTOMER/tableLayouts/tableLayoutStore.js';

import { renderConfigurableTable }
  from '../../core/ui/tables/configurableTable.js';

let tableName = 'Portfolios';

const TABLE_ID = 'portTable0';

const portDataMap = {};

const pf = (v) => {
  if (v == null) return 0;
  const n = parseFloat(String(v).replace(/\s/g, ''));
  return Number.isFinite(n) ? n : 0;
};

const safeDiv = (num, den) => (den ? num / den : 0);

// =============================
// 🔹 TABLE RENDER
// =============================
// function renderPortTableOnly(portData, index) {
//   const elementId = `portDataContainer${index}`;
//   const portDataContainer = document.getElementById(elementId);

//   if (!portDataContainer) return;

//   const visibleColumns =
//     getVisibleColumns(TABLE_ID) ||
//     DEFAULT_VISIBLE_PORT_COLUMN_KEYS;

//   const filteredColumnsPortData = filterColumnsInData(portData, visibleColumns);

//   const displayPortData = mapPortDataForDisplay(filteredColumnsPortData);

//   const portDataHTML = processData(displayPortData, tableName);
//   portDataContainer.innerHTML = portDataHTML;

//   applyPortfolioTableColoring(portDataContainer);
//   attachIdLinks(portDataContainer);

//   addTooltipsForTruncatedText(portDataContainer);
//   addProdIdTooltips(portDataContainer);
// }

function renderPortTableOnly(portData, index) {

  renderConfigurableTable({
    tableId: TABLE_ID,

    rows: portData,

    tableContainerId: `portDataContainer${index}`,
    selectorContainerId: 'portColumnSelector',

    selectedTableName: tableName,

    sorting: {
    enabled: true,
    },

    defaultVisibleColumns:
      DEFAULT_VISIBLE_PORT_COLUMN_KEYS,

    columnLabelMap: Object.fromEntries(
      ALL_PORT_COLUMN_KEYS.map((key) => [
        key,
        getPortColumnLabel(key),
      ])
    ),

    mapDisplayRows: null,

    onLayoutChange: () => {
      renderPortTableOnly(portData, index);
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

function mapPortDataForDisplay(rows) {
  return rows.map((row) => {
    const displayRow = {};

    Object.entries(row).forEach(([key, value]) => {
      displayRow[getPortColumnLabel(key)] = value;
    });

    return displayRow;
  });
}

// =============================
// 🔹 MAIN TABLE HANDLER
// =============================

export function handlePortProdData(receivedData, index, port_name) {
  const elementId = `portDataContainer${index}`;
  const portDataContainer = document.getElementById(elementId);

  if (!portDataContainer || !Array.isArray(receivedData)) return;

  ensureTableLayout(TABLE_ID, {
    visibleColumns: DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
  });

  renderPortColumnSelector('portColumnSelector');

  bindPortColumnSelector(() => {
    const currentFilteredPortData =
      appState.getFilteredPortData?.() || receivedData;

    renderPortTableOnly(currentFilteredPortData, index);
  }, 'portColumnSelector');

  const filteredPortData = filterColumnsInData(receivedData, ALL_PORT_COLUMN_KEYS);
  appState.setFilteredPortData(filteredPortData);

  renderPortTableOnly(filteredPortData, index);
}

// =============================
// 🔹 AGG DATA
// =============================

export function handlePortAggData(receivedData, index, port_name) {
  const elementId = `portDataContainer${index}`;
  const aggContainerId = `portAggDataContainer${index}`;

  if (!portDataMap[elementId]) portDataMap[elementId] = {};

  const portData = filterColumnsInData(receivedData, ALL_PORT_COLUMN_KEYS);

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
    formPortTtM: (safeDiv(PortTtM, PortNotional)).toFixed(2),
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

  const portDataAggContainer = document.getElementById(aggContainerId);
  if (!portDataAggContainer) return;

  requestAnimationFrame(() => {
    const filteredAggData = Object.fromEntries(
      Object.entries(aggData).filter(([key]) => aggKeysToShow.includes(key))
    );

    const tableData = mapPortDataToTableRows(filteredAggData);

    const portDataHTML = processData(tableData, tableName);
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
    { label: 'Notional', value: data.formPortNotional },
    { label: 'NetAssetValue', value: data.formPortValue },
    { label: 'NetAssetValueBuy', value: data.formPortValueBuy },
    { label: 'Portfolio Yield', value: data.formPortYield },
    { label: 'Portfolio Yield (act)', value: data.formPortYieldA },
    { label: 'Interest Rate Sensitivity (PV01)', value: data.formPortPV01 },
    { label: 'Credit Spread Sensitivity (CPV01)', value: data.formPortCPV01 },
  ];
}