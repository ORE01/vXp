'use strict';

import processData from '../../../../core/ui/modal/modalData.js';
import createBarChart from '../../../../charts/BarChart.js';

import { formatNumberWithGrouping } from '../../../../utils/tableCellFormats.js';
import { getCreditSensitivityColor } from '../../../../utils/colors.js';

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
import { wireSortableDetails } from './detailsTableSort.js';

// Table id of the SELECT PORTFOLIO table whose header filters drive the
// analyse sections; mirror it so Vega follows the same portfolio filter.
const PORT_TABLE_ID = 'portTable0';

// Right-click drill on the Vega bars: bar (surface bucket) -> contributing products.
const _vegaDrillCfg = {
  detailId: 'vegaDrillDetail',
  titleId: 'vegaDrillDetailTitle',
  tableId: 'vegaDrillDetailTable',
  closeId: 'vegaDrillDetailClose',
  menuId: 'vegaDrillCardMenu',
  valueType: '__VEGA',
  valueLabel: 'Vega',
  infoCols: [
    { key: 'ISSUER', label: 'Issuer' },
    { key: 'RATINGres', label: 'Rating' },
  ],
};
const vegaDrill = createContribDrill({ var: _vegaDrillCfg, es: _vegaDrillCfg });

// Per-(product, bucket) contribution rows for the current render.
let _vegaDrillRows = [];

// Hide/clear the drill detail table + menu (e.g. on portfolio switch / re-render).
function resetVegaDrill() {
  const d = document.getElementById('vegaDrillDetail');
  if (d) d.style.display = 'none';
  const t = document.getElementById('vegaDrillDetailTable');
  if (t) t.innerHTML = '';
  const m = document.getElementById('vegaDrillCardMenu');
  if (m) m.style.display = 'none';
}

let VegaChart;

function normalizePortfolioName(portName) {
  return String(portName ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

function normalizeRiskType(riskType) {
  return String(riskType ?? '')
    .toUpperCase()
    .trim();
}

function getAvailablePorts(rows = []) {
  return [
    ...new Set(
      rows
        .map(r => normalizePortfolioName(r.PORT_NAME ?? r.port_name))
        .filter(Boolean)
    ),
  ];
}

function getAvailableRiskTypes(rows = []) {
  return [
    ...new Set(
      rows
        .map(r => normalizeRiskType(r.RISK_TYPE ?? r.risk_type))
        .filter(Boolean)
    ),
  ];
}

function normalizeVegaBucket(row) {
  const raw = String(
    row.RISK_FACTOR_ID ??
    row.risk_factor_id ??
    row.CCY ??
    row.ccy ??
    'VEGA_PARALLEL'
  ).trim();

  return raw || 'VEGA_PARALLEL';
}

export function handleVegaSensData(appState, forcedPortName = null, holdingsOverride = null) {
  if (!appState) {
    console.warn('[VEGA SENS] skipped render: appState missing');
    return;
  }

  // Reset the drill detail on every (re-)render (avoid stale rows after switch/filter).
  resetVegaDrill();

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

  const availablePorts = getAvailablePorts(riskRowsAll);
  const availableRiskTypes = getAvailableRiskTypes(riskRowsAll);

  const selectedPort = normalizePortfolioName(
    rawPortName ||
    (availablePorts.length === 1 ? availablePorts[0] : null)
  );

  if (!selectedPort) {
    console.warn('[VEGA SENS] skipped render: no selected portfolio yet', {
      rawPortName,
      availablePorts,
    });

    clearVegaChart();
    clearVegaDetails();

    return;
  }

  console.log('[VEGA SENS] selected portfolio resolved', {
    rawPortName,
    selectedPort,
    availablePorts,
    storeRows: riskRowsAll.length,
    riskTypes: availableRiskTypes,
  });

  // Preferred: reconstruct Vega from per-product per-unit sensitivities times
  // the header-filtered holdings, so the portfolio filter flows through.
  // Fallback: legacy aggregated PortfolioRiskSensitivities rows.
  let calcData = null;

  const productSens = appState.getProductRiskSensitivitiesData?.() || [];
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
    calcData = calculateVegaSensitivityFromHoldings(
      holdings,
      productSens,
      selectedPort,
      appState
    );
  }

  if (!calcData || !calcData.filteredRowsCount || !calcData.sortedVega.length) {
    let vegaRows = riskRowsAll.filter(r =>
      normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort &&
      normalizeRiskType(r.RISK_TYPE ?? r.risk_type) === 'VEGA_PARALLEL'
    );

    if (filteredTradeIds.size) {
      vegaRows = vegaRows.filter(r =>
        filteredTradeIds.has(String(r.TRADE_ID ?? r.trade_id ?? '').trim())
      );
    }

    if (!Array.isArray(vegaRows) || vegaRows.length === 0) {
      console.warn('[VEGA SENS] no VEGA_PARALLEL rows for selected portfolio', {
        selectedPort,
        storeRows: riskRowsAll.length,
        availablePorts,
        availableRiskTypes,
        productSensRows: productSens.length,
        holdings: holdings.length,
      });

      clearVegaChart();
      clearVegaDetails();
      return;
    }

    calcData = calculateVegaSensitivity(vegaRows, selectedPort);
  }

  if (!calcData.filteredRowsCount || !calcData.sortedVega.length) {
    console.warn('[VEGA SENS] skipped render: no usable EUR VEGA_PARALLEL rows', {
      selectedPort,
      inputRows: vegaRows.length,
      firstRow: vegaRows[0],
    });

    clearVegaChart();
    clearVegaDetails();

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
    vegaCalcData: {
      totalVega: calcData.totalVega,
      filteredRowsCount: calcData.filteredRowsCount,
      groupedVega: calcData.groupedVega,
    },
    notionalByCcy: notionalByCcyFromHoldings(holdings),
    navTotal: navTotalFromHoldings(holdings),
  });

  // Feed the right-click drill. Vega lives per-trade in PortfolioRiskSensitivities;
  // join those rows (already narrowed to the filtered holdings) with the holdings
  // to recover PROD_ID / Issuer / Rating. Works for both the product and legacy paths.
  {
    const holdingByTrade = new Map(
      (Array.isArray(holdings) ? holdings : []).map(h =>
        [String(h.TRADE_ID ?? h.trade_id ?? '').trim(), h])
    );
    const vd = new Map();
    portfolioRows.forEach(r => {
      if (normalizeRiskType(r.RISK_TYPE ?? r.risk_type) !== 'VEGA_PARALLEL') return;
      if (String(r.CCY ?? r.ccy ?? '').toUpperCase().trim() !== 'EUR') return;

      const val = Number(
        r.VALUE_LOCAL ?? r.value_local ?? r.VALUE_BASE ?? r.value_base ?? 0
      );
      if (!Number.isFinite(val) || val === 0) return;

      const tradeId = String(r.TRADE_ID ?? r.trade_id ?? '').trim();
      const h = holdingByTrade.get(tradeId) || {};
      const prodId = String(h.PROD_ID ?? h.prod_id ?? '').trim();
      const bucket = normalizeVegaBucket(r);

      const key = `${prodId || tradeId}|${bucket}`;
      let dr = vd.get(key);
      if (!dr) {
        dr = { ...h, PROD_ID: prodId, __VBUCKET: bucket, __VEGA: 0 };
        vd.set(key, dr);
      }
      dr.__VEGA += val;
    });
    _vegaDrillRows = [...vd.values()].map(r => ({ ...r, __VEGA: Math.abs(r.__VEGA) }));
  }

  return renderVegaTableAndChart(calcData, selectedPort);
}

function calculateVegaSensitivity(rows, portName) {
  const selectedPort = normalizePortfolioName(portName);

  const filteredRows = rows.filter(r => {
    const ccy = String(r.CCY ?? r.ccy ?? '').toUpperCase().trim();
    return ccy === 'EUR';
  });

  const groupedVega = filteredRows.reduce((acc, r) => {
    const bucket = normalizeVegaBucket(r);

    const value = Number(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local ?? 0
    );

    if (!bucket || !Number.isFinite(value) || value === 0) return acc;

    if (!acc[bucket]) acc[bucket] = 0;
    acc[bucket] += value;

    return acc;
  }, {});

  const sortedVega = Object.entries(groupedVega)
    .filter(([, value]) => Number.isFinite(value) && value !== 0)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const totalVega = sortedVega.reduce((sum, [, value]) => sum + value, 0);

  console.log('[VEGA SENS] RESULT:', {
    selectedPort,
    inputRows: rows.length,
    filteredRows: filteredRows.length,
    totalVega,
    buckets: sortedVega.map(([bucket]) => bucket),
    firstFilteredRow: filteredRows[0],
  });

  return {
    totalVega,
    groupedVega,
    sortedVega,
    filteredRowsCount: filteredRows.length,
  };
}

/**
 * Reconstruct Vega from the header-filtered holdings and the per-product
 * per-unit sensitivities. EUR-only, mirroring the existing Vega view.
 *
 * Scale matches Python trade_sensitivity_scaler: VEGA = VALUE_PER_UNIT * NOTIONAL / 100.
 * Fixed-value-category holdings are excluded (mirrors Python zeroing).
 * Returns the same shape as calculateVegaSensitivity().
 */
function calculateVegaSensitivityFromHoldings(holdings, productSens, portName, appState) {
  const selectedPort = normalizePortfolioName(portName);
  const VEGA_SCALE = 100;

  const fixedValueNames =
    (typeof appState?.getFixedValueCategoryNames === 'function'
      ? appState.getFixedValueCategoryNames()
      : null) || new Set();

  // PROD_ID -> [{ bucket, ccy, vpu }] for RISK_TYPE = VEGA_PARALLEL.
  const vegaByProd = new Map();

  productSens.forEach(r => {
    if (normalizeRiskType(r.RISK_TYPE ?? r.risk_type) !== 'VEGA_PARALLEL') return;

    const prodId = String(r.PROD_ID ?? r.prod_id ?? '').trim();
    if (!prodId) return;

    const vpu = Number(r.VALUE_PER_UNIT ?? r.value_per_unit);
    if (!Number.isFinite(vpu)) return;

    const ccy = String(r.CCY ?? r.ccy ?? '').toUpperCase().trim();
    const bucket = normalizeVegaBucket(r);

    if (!vegaByProd.has(prodId)) vegaByProd.set(prodId, []);
    vegaByProd.get(prodId).push({ bucket, ccy, vpu });
  });

  const groupedVega = {};
  let contributions = 0;

  // Drill rows keyed by product+bucket (enriched with holding attributes).
  const drillByKey = new Map();

  holdings.forEach(row => {
    const rowPort = normalizePortfolioName(row.port_name ?? row.PORT_NAME);
    if (rowPort && selectedPort && rowPort !== selectedPort) return;

    const category = String(row.CATEGORY ?? row.category ?? '').trim();
    if (category && fixedValueNames.has(category)) return;

    const prodId = String(row.PROD_ID ?? row.prod_id ?? '').trim();
    if (!prodId) return;

    const notional = Number(row.NOTIONAL ?? row.notional);
    if (!Number.isFinite(notional) || notional === 0) return;

    const list = vegaByProd.get(prodId);
    if (!list || !list.length) return;

    list.forEach(({ bucket, ccy, vpu }) => {
      // The existing Vega view is EUR-only.
      if (ccy !== 'EUR') return;

      const value = (vpu * notional) / VEGA_SCALE;
      if (!Number.isFinite(value) || value === 0) return;

      groupedVega[bucket] = (groupedVega[bucket] || 0) + value;
      contributions += 1;

      const key = `${prodId}|${bucket}`;
      let dr = drillByKey.get(key);
      if (!dr) {
        dr = { ...row, PROD_ID: prodId, __VBUCKET: bucket, __VEGA: 0 };
        drillByKey.set(key, dr);
      }
      dr.__VEGA += value;
    });
  });

  const sortedVega = Object.entries(groupedVega)
    .filter(([, value]) => Number.isFinite(value) && value !== 0)
    .sort((a, b) => String(a[0]).localeCompare(String(b[0])));

  const totalVega = sortedVega.reduce((sum, [, value]) => sum + value, 0);

  return {
    totalVega,
    groupedVega,
    sortedVega,
    filteredRowsCount: contributions,
    // Magnitude value so the largest Vega position sorts first.
    drillRows: [...drillByKey.values()].map(r => ({ ...r, __VEGA: Math.abs(r.__VEGA) })),
  };
}

function renderVegaTableAndChart(data, portName) {
  const { totalVega, sortedVega } = data;

  const wrapper = document.createElement('div');
  wrapper.className = 'vega-sens-wrapper';

  const rawVals = [];
  const tableData = sortedVega.map(([bucket, vega]) => {
    const weight = totalVega ? (vega / totalVega) * 100 : 0;
    rawVals.push({ value: vega, weight });

    return {
      Bucket: bucket,
      Vega_EUR: formatNumberWithGrouping(vega),
      'Weight %': `${weight.toFixed(2)}%`,
    };
  });

  const chartData = sortedVega.map(([bucket, vega]) => ({
    BUCKET: bucket,
    VEGA_WEIGHT_PCT: totalVega ? (vega / totalVega) * 100 : 0,
  }));

  wrapper.innerHTML = processData(tableData, `Vega Details for ${portName}`);
  wireSortableDetails(wrapper, rawVals, 'Vega_EUR');

  mountVegaDetails(wrapper);

  requestAnimationFrame(() => {
    createVegaChart(chartData);
  });

  console.log('[VEGA SENS] rendered from PortfolioRiskSensitivities', {
    portName,
    totalVega,
    tableRows: tableData.length,
    chartRows: chartData.length,
    canvasExists: !!document.getElementById('VegaChart'),
    detailsContainerExists: !!document.getElementById('VegaSensDataContainer'),
  });

  return wrapper;
}

function mountVegaDetails(wrapper) {
  const target = document.getElementById('VegaSensDataContainer');

  if (!target) {
    console.warn('[VEGA DETAILS] VegaSensDataContainer not found');
    return;
  }

  // Height comes from the flex layout (card stretched to the chart height); scrolls
  // internally. No fixed height so the table always matches the chart.
  target.innerHTML = '';
  target.style.display = 'block';
  target.style.overflowY = 'auto';
  target.style.overflowX = 'auto';
  target.style.padding = '8px';

  wrapper.style.display = 'block';
  wrapper.style.width = '100%';
  wrapper.style.overflow = 'visible';

  target.appendChild(wrapper);

  console.log('[VEGA DETAILS] mounted', {
    rows: wrapper.querySelectorAll('tr').length,
  });
}

function createVegaChart(data) {
  const labels = data.map(d => d.BUCKET);
  const values = data.map(d => d.VEGA_WEIGHT_PCT);

  const canvasId = 'VegaChart';

  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn('[VEGA CHART] canvas not found:', canvasId);
    return;
  }

  const colors = getCreditSensitivityColor(0.7);

  const chartConfig = {
    labels,
    datasets: [{
      label: 'Vega Weight by Vol Surface Bucket (%)',
      data: values,
      ...colors,
      borderWidth: 1,
    }],
  };

  if (VegaChart) {
    VegaChart.destroy();
    VegaChart = null;
  }

  VegaChart = createBarChart(chartConfig, canvasId, 'bar', 'x');

  if (VegaChart) {
    // Right-click drill: bar (surface bucket) -> contributing products (single EUR dataset).
    VegaChart.$stepsByDs = {
      0: labels.map((bucket) => ({
        colKey: '__VEGABUCKET',
        value: bucket,
        label: 'Surface',
        match: (r) => String(r.__VBUCKET ?? '') === bucket,
      })),
    };

    try { vegaDrill.setData(_vegaDrillRows); }
    catch (e) { console.warn('[VEGA DRILL] setData failed', e); }

    bindRightClickDrill(canvas, () => VegaChart, (el, ch, e) =>
      vegaDrill.hover('var', { native: e }, [el], ch.$stepsByDs?.[el.datasetIndex] || []));

    if (canvas.dataset.vegaLeaveBound !== '1') {
      canvas.dataset.vegaLeaveBound = '1';
      canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
    }
  }

  console.log('[VEGA CHART] rendered', {
    canvasId,
    labels,
    values,
  });
}

function clearVegaDetails() {
  const target = document.getElementById('VegaSensDataContainer');

  if (target) {
    target.innerHTML = '';
  }
}

function clearVegaChart() {
  if (VegaChart) {
    try {
      VegaChart.destroy();
    } catch (e) {
      console.warn('[VEGA CHART] destroy failed', e);
    }

    VegaChart = null;
  }
}