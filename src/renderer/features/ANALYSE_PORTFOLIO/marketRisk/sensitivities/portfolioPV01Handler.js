// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioPV01Handler.js

import createBarChart from '../../../../charts/BarChart.js';
import { getIrSensitivityColor } from '../../../../utils/colors.js';

import {
  updateMarketRiskSensitivityKpis,
  notionalByCcyFromHoldings,
  navTotalFromHoldings,
} from './marketRiskSensitivityKpis.js';
import { applyColumnFilters } from '../../../CUSTOMER/tableLayouts/tableColumnFilters.js';
import {
  createContribDrill,
  bindRightClickDrill,
  scheduleHideConcMenu,
} from '../../SummaryBreakdown.js';
import { makeSortableDetailsTable } from './detailsTableSort.js';

// Table id of the SELECT PORTFOLIO table whose per-column header filters drive
// the analyse sections; mirror it here so sensitivities follow the same filter.
const PORT_TABLE_ID = 'portTable0';

// Right-click drill on the PV01 bars: bar (CCY + tenor) -> contributing products.
const _pv01DrillCfg = {
  detailId: 'pv01DrillDetail',
  titleId: 'pv01DrillDetailTitle',
  tableId: 'pv01DrillDetailTable',
  closeId: 'pv01DrillDetailClose',
  menuId: 'pv01DrillCardMenu',
  valueType: '__PV01',
  valueLabel: 'PV01',
  infoCols: [
    { key: 'ISSUER', label: 'Issuer' },
    { key: 'RATINGres', label: 'Rating' },
  ],
};
const pv01Drill = createContribDrill({ var: _pv01DrillCfg, es: _pv01DrillCfg });

// Per-(product, tenor, ccy) contribution rows for the current render, fed to the drill.
let _pv01DrillRows = [];

// Hide/clear the drill detail table + menu (e.g. on portfolio switch / re-render),
// so it never lingers with stale values.
function resetPv01Drill() {
  const d = document.getElementById('pv01DrillDetail');
  if (d) d.style.display = 'none';
  const t = document.getElementById('pv01DrillDetailTable');
  if (t) t.innerHTML = '';
  const m = document.getElementById('pv01DrillCardMenu');
  if (m) m.style.display = 'none';
}


let PV01Chart;
let PV01RenderToken = 0;

/**
 * Render PV01 sensitivity view for the currently selected portfolio.
 *
 * Architecture:
 * - DataRouter stores ALL PortfolioRiskSensitivitiesData via portfolioRiskSensitivitiesStore.
 * - This handler reads from the store.
 * - This handler filters by active portfolio + RISK_TYPE = PV01.
 */
export function handleIRSensData(appState, forcedPortName = null, holdingsOverride = null) {
  if (!appState) {
    console.warn('[IR SENS] skipped render: appState missing');
    return;
  }

  // Reset the drill detail on every (re-)render so it doesn't show stale rows
  // after a portfolio switch / filter change.
  resetPv01Drill();

  const rawPortName =
    forcedPortName ||
    (
      typeof appState.getSelectedPortTableName === 'function'
        ? appState.getSelectedPortTableName()
        : (
            appState.selectedPortfolio ||
            appState.currentPortfolio ||
            appState.portfolioName ||
            appState.selectedPortName ||
            appState.selectedTableName ||
            null
          )
    );

  

const riskRowsAll = appState.getPortfolioRiskSensitivitiesData?.() || [];

const availablePorts = [
  ...new Set(
    riskRowsAll
      .map(r => normalizePortfolioName(r.PORT_NAME ?? r.port_name))
      .filter(Boolean)
  ),
];

const selectedPort = normalizePortfolioName(
  rawPortName ||
  (availablePorts.length === 1 ? availablePorts[0] : null)
);

if (!selectedPort) {
  console.warn('[IR SENS] skipped render: no selected portfolio yet', {
    rawPortName,
    availablePorts,
  });
  return;
}

// console.log('[IR SENS] selected portfolio resolved', {
//   rawPortName,
//   selectedPort,
//   availablePorts,
//   storeRows: riskRowsAll.length,
//   riskTypes: [
//     ...new Set(
//       riskRowsAll
//         .map(r => String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim())
//         .filter(Boolean)
//     ),
//   ],
// });

// -------------------------------------------------------------------------
// PREFERRED PATH: reconstruct PV01 from per-product per-unit sensitivities
// times the CURRENTLY FILTERED holdings, so the portfolio filter (and the
// fixed-value-category exclusion) flow through to the sensitivities view.
// Falls back to the legacy aggregated PortfolioRiskSensitivities store when
// the product table or filtered holdings are not available.
// -------------------------------------------------------------------------
let calcData = null;

const productSens = appState.getProductRiskSensitivitiesData?.() || [];

// Holdings to reconstruct from: the header-filtered set passed by the
// orchestrator, or — for other callers — the port data re-filtered by the
// active header filters, so the portfolio filter always flows through.
const holdings = Array.isArray(holdingsOverride)
  ? holdingsOverride
  : applyColumnFilters(appState.getFilteredPortData?.() || [], PORT_TABLE_ID);

// TRADE_IDs of the filtered holdings — narrows both the legacy fallback rows
// and the per-trade PRS rows behind the KPIs, so everything follows the filter.
const filteredTradeIds = new Set(
  (Array.isArray(holdings) ? holdings : [])
    .map(h => String(h.TRADE_ID ?? h.trade_id ?? '').trim())
    .filter(Boolean)
);

if (productSens.length && holdings.length) {
  calcData = calculateIRSensitivityFromHoldings(
    holdings,
    productSens,
    selectedPort,
    appState
  );
}

if (!calcData || !calcData.filteredRowsCount) {
  // Legacy fallback: per-portfolio PV01 rows, narrowed to the filtered holdings'
  // TRADE_IDs so the fallback chart also follows the filter.
  let pv01Rows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort &&
    String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim() === 'PV01'
  );

  if (filteredTradeIds.size) {
    pv01Rows = pv01Rows.filter(r =>
      filteredTradeIds.has(String(r.TRADE_ID ?? r.trade_id ?? '').trim())
    );
  }

  if (!Array.isArray(pv01Rows) || pv01Rows.length === 0) {
    console.warn('[IR SENS] no PV01 rows for selected portfolio', {
      selectedPort,
      storeRows: riskRowsAll.length,
      availablePorts,
      productSensRows: productSens.length,
      holdings: holdings.length,
    });

    clearPV01Chart();
    clearPV01Details();

    return;
  }

  calcData = calculateIRSensitivity(pv01Rows, selectedPort);
}

  if (!calcData.filteredRowsCount) {
    console.warn('[IR SENS] skipped render: no usable PV01 rows', {
      selectedPort,
    });

    clearPV01Chart();
    clearPV01Details();

    return;
  }

  // KPIs must follow the same filter (PRS is per TRADE_ID; fixed-value trades are
  // already 0 in PRS, so filtered totals stay consistent with the charts).
  let portfolioRows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort
  );

  if (filteredTradeIds.size) {
    portfolioRows = portfolioRows.filter(r =>
      filteredTradeIds.has(String(r.TRADE_ID ?? r.trade_id ?? '').trim())
    );
  }

  updateMarketRiskSensitivityKpis({
    rows: portfolioRows,
    portName: selectedPort,
    pv01CalcData: calcData,
    notionalByCcy: notionalByCcyFromHoldings(holdings),
    navTotal: navTotalFromHoldings(holdings),
  });

  // Feed the right-click drill (empty on the legacy fallback path).
  _pv01DrillRows = Array.isArray(calcData.drillRows) ? calcData.drillRows : [];

  return renderIRSensTableAndChart(calcData, selectedPort);
}

/**
 * Reconstruct PV01-by-CCY from the currently filtered holdings and the
 * per-product per-unit sensitivities (ProductRiskSensitivities).
 *
 * Scale matches the Python trade_sensitivity_scaler:
 *   PV01 = VALUE_PER_UNIT * NOTIONAL / 10000
 *
 * Fixed-value-category holdings are excluded to mirror the Python valuation,
 * which zeroes those trades in PortfolioRiskSensitivities.
 *
 * Returns the same shape as calculateIRSensitivity(), so the existing
 * render/KPI code path is unchanged.
 */
function calculateIRSensitivityFromHoldings(holdings, productSens, portName, appState) {
  const selectedPort = normalizePortfolioName(portName);
  const PV01_SCALE = 10000;

  const fixedValueNames =
    (typeof appState?.getFixedValueCategoryNames === 'function'
      ? appState.getFixedValueCategoryNames()
      : null) || new Set();

  // PROD_ID -> [{ tenor, ccy, vpu }] for RISK_TYPE = PV01.
  const pv01ByProd = new Map();

  productSens.forEach(r => {
    const riskType = String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim();
    if (riskType !== 'PV01') return;

    const prodId = String(r.PROD_ID ?? r.prod_id ?? '').trim();
    if (!prodId) return;

    const tenor = parseInt(r.TENOR ?? r.tenor, 10);
    if (!Number.isFinite(tenor) || tenor < 1 || tenor > 30) return;

    const vpu = parseFloat(r.VALUE_PER_UNIT ?? r.value_per_unit);
    if (!Number.isFinite(vpu)) return;

    const ccy = String(r.CCY ?? r.ccy ?? 'UNKNOWN').toUpperCase().trim() || 'UNKNOWN';

    if (!pv01ByProd.has(prodId)) pv01ByProd.set(prodId, []);
    pv01ByProd.get(prodId).push({ tenor, ccy, vpu });
  });

  const irSensitivityByCcy = {};
  const pv01TotalByCcy = {};
  const pv01PartialPctByCcy = {};

  let contributions = 0;

  // Drill rows keyed by product+tenor+ccy (enriched with the holding attributes).
  const drillByKey = new Map();

  holdings.forEach(row => {
    // Defensive: if a holding carries a portfolio name, keep only the selected one.
    const rowPort = normalizePortfolioName(row.port_name ?? row.PORT_NAME);
    if (rowPort && selectedPort && rowPort !== selectedPort) return;

    // Exclude fixed-value-category holdings (mirrors Python zeroing).
    const category = String(row.CATEGORY ?? row.category ?? '').trim();
    if (category && fixedValueNames.has(category)) return;

    const prodId = String(row.PROD_ID ?? row.prod_id ?? '').trim();
    if (!prodId) return;

    const notional = parseFloat(row.NOTIONAL ?? row.notional);
    if (!Number.isFinite(notional) || notional === 0) return;

    const sensList = pv01ByProd.get(prodId);
    if (!sensList || !sensList.length) return;

    sensList.forEach(({ tenor, ccy, vpu }) => {
      const contrib = (vpu * notional) / PV01_SCALE;

      if (!irSensitivityByCcy[ccy]) {
        irSensitivityByCcy[ccy] = Array(30).fill(0);
      }
      irSensitivityByCcy[ccy][tenor - 1] += contrib;
      contributions += 1;

      const key = `${prodId}|${tenor}|${ccy}`;
      let dr = drillByKey.get(key);
      if (!dr) {
        dr = { ...row, PROD_ID: prodId, CCY: ccy, __TENOR: tenor, __PV01: 0 };
        drillByKey.set(key, dr);
      }
      dr.__PV01 += contrib;
    });
  });

  Object.entries(irSensitivityByCcy).forEach(([ccy, tenorValues]) => {
    const total = tenorValues.reduce((sum, value) => sum + value, 0);
    pv01TotalByCcy[ccy] = total;
    pv01PartialPctByCcy[ccy] = tenorValues.map(value =>
      total ? Number(((value / total) * 100).toFixed(2)) : 0
    );
  });

  return {
    irSensitivityByCcy,
    pv01TotalByCcy,
    pv01PartialPctByCcy,
    filteredRowsCount: contributions,
    // Magnitude value so renderConcView (sorts b.val - a.val) puts the largest
    // PV01 position first — consistent with the other contribution drills.
    drillRows: [...drillByKey.values()].map(r => ({ ...r, __PV01: Math.abs(r.__PV01) })),

    irSensitivitySum: null,
    portPV01: null,
    pv01PartialPct: null,
  };
}

function normalizePortfolioName(portName) {
  return String(portName ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

function calculateIRSensitivity(rows, portName) {
  const selectedPort = normalizePortfolioName(portName);

  // Store already filters by portfolio + RISK_TYPE = PV01.
  // IMPORTANT:
  // Do NOT filter to EUR.
  // Do NOT aggregate different CCYs into one PV01.
  // PV01 belongs to a curve/CCY: EUR PV01, USD PV01, JPY PV01, ...
  const filteredRows = rows.filter(r => {
    const tenor = parseInt(r.TENOR ?? r.tenor, 10);
    const value = parseFloat(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local
    );

    return (
      !Number.isNaN(tenor) &&
      tenor >= 1 &&
      tenor <= 30 &&
      Number.isFinite(value)
    );
  });

  const irSensitivityByCcy = {};
  const pv01TotalByCcy = {};
  const pv01PartialPctByCcy = {};

  filteredRows.forEach(r => {
    const tenor = parseInt(r.TENOR ?? r.tenor, 10);
    const ccy = String(r.CCY ?? r.ccy ?? 'UNKNOWN')
      .toUpperCase()
      .trim() || 'UNKNOWN';

    const value = parseFloat(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local
    ) || 0;

    if (!irSensitivityByCcy[ccy]) {
      irSensitivityByCcy[ccy] = Array(30).fill(0);
    }

    irSensitivityByCcy[ccy][tenor - 1] += value;
  });

  Object.entries(irSensitivityByCcy).forEach(([ccy, tenorValues]) => {
    const total = tenorValues.reduce((sum, value) => sum + value, 0);

    pv01TotalByCcy[ccy] = total;

    pv01PartialPctByCcy[ccy] = tenorValues.map(value => {
      if (!total) return 0;
      return Number(((value / total) * 100).toFixed(2));
    });
  });

  // console.log('[IR SENS] FILTER CHECK:', {
  //   selectedPort,
  //   inputRows: rows.length,
  //   filteredRows: filteredRows.length,
  //   uniquePorts: [
  //     ...new Set(rows.map(r => String(r.PORT_NAME ?? r.port_name ?? '').trim())),
  //   ],
  //   uniqueRiskTypes: [
  //     ...new Set(
  //       rows.map(r =>
  //         String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim()
  //       )
  //     ),
  //   ],
  //   uniqueCcys: [
  //     ...new Set(
  //       rows.map(r => String(r.CCY ?? r.ccy ?? '').toUpperCase().trim())
  //     ),
  //   ],
  //   uniqueTenors: [
  //     ...new Set(filteredRows.map(r => r.TENOR ?? r.tenor)),
  //   ].sort((a, b) => Number(a) - Number(b)),
  //   firstFilteredRow: filteredRows[0],
  // });

  // console.log('[IR SENS] RESULT BY CCY:', {
  //   irSensitivityByCcy,
  //   pv01TotalByCcy,
  //   pv01PartialPctByCcy,
  //   filteredRowsCount: filteredRows.length,
  // });

  return {
    irSensitivityByCcy,
    pv01TotalByCcy,
    pv01PartialPctByCcy,
    filteredRowsCount: filteredRows.length,

    // Keep legacy keys null/empty so no one accidentally treats this as one total.
    irSensitivitySum: null,
    portPV01: null,
    pv01PartialPct: null,
  };
}

function renderIRSensTableAndChart(data, portName) {
  const {
    irSensitivityByCcy = {},
    pv01TotalByCcy = {},
    pv01PartialPctByCcy = {},
  } = data;

  const wrapper = document.createElement('div');
  wrapper.className = 'irsens-wrapper';

  const table = document.createElement('table');
  table.className = 'irsens-table';

  const titleRow = table.insertRow();
  const titleCell = document.createElement('th');
  titleCell.colSpan = 4;
  titleCell.textContent = `PV01 Details by CCY for ${portName}`;
  titleRow.appendChild(titleCell);

  const headerRow = table.insertRow();

  ['CCY', 'Tenor', 'PV01', 'Weight %'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });

  const chartData = [];

  Object.entries(irSensitivityByCcy)
    .sort(([ccyA], [ccyB]) => ccyA.localeCompare(ccyB))
    .forEach(([ccy, tenorValues]) => {
      const totalForCcy = pv01TotalByCcy[ccy] || 0;
      const weightsForCcy = pv01PartialPctByCcy[ccy] || [];

      tenorValues.forEach((sum, index) => {
        if (!sum) return;

        const tenor = `${index + 1}Y`;
        const weight = weightsForCcy[index] ?? (
          totalForCcy ? (sum / totalForCcy) * 100 : 0
        );

        const row = table.insertRow();

        const ccyCell = row.insertCell();
        ccyCell.textContent = ccy;

        const tenorCell = row.insertCell();
        tenorCell.textContent = tenor;
        tenorCell.dataset.sortValue = String(index + 1);

        const pv01Cell = row.insertCell();
        pv01Cell.textContent = Number(sum).toLocaleString('de-DE', {
          maximumFractionDigits: 0,
        });
        pv01Cell.dataset.sortValue = String(Math.abs(Number(sum)));

        const weightCell = row.insertCell();
        weightCell.textContent = `${Number(weight).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
        weightCell.dataset.sortValue = String(Math.abs(Number(weight)));
      });
    });

  wrapper.appendChild(table);

  // Sortable columns (click a header; ▲/▼). Default: PV01 magnitude, largest first.
  makeSortableDetailsTable(table, { defaultCol: 2, defaultDir: -1 });

  mountPV01Details(wrapper);

  // CRITICAL:
  // Cancel stale chart renders.
  // MVaR / Risk refreshes can rebuild the DOM while this RAF is still pending.
  const renderToken = ++PV01RenderToken;

  // Destroy the old chart BEFORE scheduling the new one.
  // Otherwise Chart.js can still run delayed resize/update logic on a removed canvas.
  clearPV01Chart({ preserveRenderToken: true });

  requestAnimationFrame(() => {
    if (renderToken !== PV01RenderToken) {
      console.warn('[PV01 CHART] skipped stale RAF render', {
        renderToken,
        currentToken: PV01RenderToken,
      });
      return;
    }

    const canvas = document.getElementById('PV01Chart');

    if (!canvas || !canvas.isConnected || !canvas.parentNode) {
      console.warn('[PV01 CHART] skipped RAF render: canvas not attached', {
        exists: !!canvas,
        isConnected: canvas?.isConnected,
        hasParentNode: !!canvas?.parentNode,
      });
      return;
    }

    createPV01Chart({
      irSensitivityByCcy,
      pv01PartialPctByCcy,
      expectedRenderToken: renderToken,
    });
  });

  // console.log('[PV01 RENDER] wrapper created by CCY', {
  //   portName,
  //   tableRows: table.rows.length,
  //   chartRows: chartData.length,
  //   pv01TotalByCcy,
  //   canvasExists: !!document.getElementById('PV01Chart'),
  //   detailsContainerExists: !!document.getElementById('IRSensDataContainer'),
  // });

  return wrapper;
}

function createPV01Chart({
  irSensitivityByCcy = {},
  pv01PartialPctByCcy = {},
  expectedRenderToken = PV01RenderToken,
} = {}) {
  if (expectedRenderToken !== PV01RenderToken) {
    console.warn('[PV01 CHART] skipped stale createPV01Chart call', {
      expectedRenderToken,
      currentToken: PV01RenderToken,
    });
    return;
  }

  const canvasId = 'PV01Chart';
  const canvas = document.getElementById(canvasId);

  if (!canvas || !canvas.isConnected || !canvas.parentNode) {
    console.warn('[PV01 CHART] canvas not ready:', {
      canvasId,
      exists: !!canvas,
      isConnected: canvas?.isConnected,
      hasParentNode: !!canvas?.parentNode,
    });
    return;
  }

  const fullLabels = Array.from({ length: 30 }, (_, i) => `${i + 1}Y`);

  const fullDatasets = Object.entries(irSensitivityByCcy)
    .sort(([ccyA], [ccyB]) => ccyA.localeCompare(ccyB))
    .map(([ccy]) => {
      const weights = pv01PartialPctByCcy[ccy] || Array(30).fill(0);

      return {
        label: `${ccy} PV01 Weight by Tenor (%)`,
        data: fullLabels.map((_, index) => Number(weights[index] || 0)),
        borderWidth: 1,
      };
    });

  if (!fullDatasets.length) {
    console.warn('[PV01 CHART] skipped render: no datasets');
    clearPV01Chart({ preserveRenderToken: true });
    return;
  }

  // --------------------------------------------------
  // Trim chart range to the first/last tenor where
  // at least one dataset has a non-zero value.
  // --------------------------------------------------
  const ZERO_EPSILON = 1e-12;

  let firstActiveIndex = -1;
  let lastActiveIndex = -1;

  for (let i = 0; i < fullLabels.length; i += 1) {
    const hasNonZeroAtIndex = fullDatasets.some(ds => {
      const value = Number(ds.data?.[i] || 0);
      return Math.abs(value) > ZERO_EPSILON;
    });

    if (hasNonZeroAtIndex) {
      if (firstActiveIndex === -1) {
        firstActiveIndex = i;
      }
      lastActiveIndex = i;
    }
  }

  // Fallback: if everything is zero, keep the full axis
  const startIndex = firstActiveIndex === -1 ? 0 : firstActiveIndex;
  const endIndex = lastActiveIndex === -1 ? fullLabels.length - 1 : lastActiveIndex;

  const labels = fullLabels.slice(startIndex, endIndex + 1);

  const datasets = fullDatasets.map(ds => ({
    ...ds,
    data: ds.data.slice(startIndex, endIndex + 1),
  }));

  // Final DOM check directly before Chart creation.
  // The canvas can disappear between RAF guard and this point during fast UI refreshes.
  if (!canvas.isConnected || !canvas.parentNode) {
    console.warn('[PV01 CHART] skipped render: canvas detached before createBarChart', {
      canvasId,
      isConnected: canvas.isConnected,
      hasParentNode: !!canvas.parentNode,
    });
    return;
  }

  const chartConfig = {
    labels,
    datasets,
  };

  PV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'x', { interactive: true });

  if (!PV01Chart) {
    console.warn('[PV01 CHART] createBarChart returned null', {
      canvasId,
      labelsCount: labels.length,
      datasetsCount: datasets.length,
    });
    return;
  }

  // ---- Right-click drill: bar (CCY dataset + tenor label) -> contributing products.
  // Datasets are sorted by CCY (same order as fullDatasets), so datasetIndex -> CCY.
  const drillCcys = Object.keys(irSensitivityByCcy).sort((a, b) => a.localeCompare(b));
  PV01Chart.$stepsByDs = {};
  drillCcys.forEach((ccy, dsIndex) => {
    PV01Chart.$stepsByDs[dsIndex] = labels.map((lbl) => {
      const tenor = parseInt(lbl, 10);
      return {
        colKey: '__PV01BUCKET',
        value: `${ccy} ${lbl}`,
        label: 'Tenor',
        match: (r) =>
          String(r.CCY ?? '').toUpperCase().trim() === ccy &&
          Number(r.__TENOR) === tenor,
      };
    });
  });

  try { pv01Drill.setData(_pv01DrillRows); }
  catch (e) { console.warn('[PV01 DRILL] setData failed', e); }

  // Self-guards against double-binding on the same canvas across re-renders.
  bindRightClickDrill(canvas, () => PV01Chart, (el, ch, e) =>
    pv01Drill.hover('var', { native: e }, [el], ch.$stepsByDs?.[el.datasetIndex] || []));

  if (canvas.dataset.pv01LeaveBound !== '1') {
    canvas.dataset.pv01LeaveBound = '1';
    canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
  }

  // console.log('[PV01 CHART] rendered by CCY (trimmed)', {
  //   canvasId,
  //   startLabel: labels[0],
  //   endLabel: labels[labels.length - 1],
  //   labels,
  //   datasetLabels: datasets.map(d => d.label),
  // });
}

function mountPV01Details(wrapper) {
  const target = document.getElementById('IRSensDataContainer');

  if (!target) {
    console.error('[PV01 DETAILS] IRSensDataContainer not found');
    return;
  }

  // console.log('[PV01 DETAILS] target before mount:', {
  //   target,
  //   targetHeight: target.offsetHeight,
  //   wrapperChildren: wrapper.children.length,
  //   tableRows: wrapper.querySelectorAll('tr').length,
  // });

  // Height comes from the flex layout: the container flex-fills the card, which is
  // stretched to the chart height (see marketRiskSensitivities.css); it scrolls
  // internally. No fixed height here, so it always matches the chart.
  target.innerHTML = '';
  target.style.display = 'block';
  target.style.overflowY = 'auto';
  target.style.overflowX = 'auto';
  target.style.padding = '8px';

  wrapper.style.display = 'block';
  wrapper.style.width = '100%';
  wrapper.style.overflow = 'visible';

  const table = wrapper.querySelector('table');

  if (table) {
    table.style.display = 'table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.color = '#fff';
    table.style.fontSize = '13px';
  }

  const headerCells = wrapper.querySelectorAll('th');

  headerCells.forEach((th) => {
    th.style.position = 'sticky';
    th.style.top = '0';
    th.style.zIndex = '2';
    th.style.background = 'var(--surface-raised)';
  });

  target.appendChild(wrapper);

  // console.log('[PV01 DETAILS] mounted:', {
  //   targetHeight: target.offsetHeight,
  //   childCount: target.children.length,
  //   htmlPreview: target.innerHTML.slice(0, 300),
  // });
}

  function clearPV01Details() {
  const target = document.getElementById('IRSensDataContainer');

  if (target) {
    target.innerHTML = '';
  }
}

function clearPV01Chart({ preserveRenderToken = false } = {}) {
  if (!preserveRenderToken) {
    PV01RenderToken += 1;
  }

  if (PV01Chart) {
    try {
      PV01Chart.destroy();
    } catch (e) {
      console.warn('[PV01 CHART] destroy failed', e);
    }

    PV01Chart = null;
  }

  const canvas = document.getElementById('PV01Chart');

  if (
    canvas &&
    typeof Chart !== 'undefined' &&
    typeof Chart.getChart === 'function'
  ) {
    const existingChart = Chart.getChart(canvas);

    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (e) {
        console.warn('[PV01 CHART] Chart.getChart(canvas).destroy failed', e);
      }
    }
  }
}





