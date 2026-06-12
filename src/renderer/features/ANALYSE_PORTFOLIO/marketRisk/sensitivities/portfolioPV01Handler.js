// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioPV01Handler.js

import createBarChart from '../../../../charts/BarChart.js';
import { getIrSensitivityColor } from '../../../../utils/colors.js';

import { updateMarketRiskSensitivityKpis } from './marketRiskSensitivityKpis.js';

import portfolioRiskSensitivitiesStore from '../../../../core/state/portfolioRiskSensitivitiesStore.js';

let PV01Chart;

/**
 * Render PV01 sensitivity view for the currently selected portfolio.
 *
 * Architecture:
 * - DataRouter stores ALL PortfolioRiskSensitivitiesData via portfolioRiskSensitivitiesStore.
 * - This handler reads from the store.
 * - This handler filters by active portfolio + RISK_TYPE = PV01.
 */
export function handleIRSensData(appState, forcedPortName = null) {
  if (!appState) {
    console.warn('[IR SENS] skipped render: appState missing');
    return;
  }

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

  

const availablePorts = portfolioRiskSensitivitiesStore.getPorts();

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

console.log('[IR SENS] selected portfolio resolved', {
  rawPortName,
  selectedPort,
  availablePorts,
  storeRows: portfolioRiskSensitivitiesStore.getRows().length,
  riskTypes: portfolioRiskSensitivitiesStore.getRiskTypes(),
});

  const pv01Rows = portfolioRiskSensitivitiesStore.getByPortfolioAndType(
    selectedPort,
    'PV01'
  );

  if (!Array.isArray(pv01Rows) || pv01Rows.length === 0) {
    console.warn('[IR SENS] no PV01 rows for selected portfolio', {
      selectedPort,
      storeRows: portfolioRiskSensitivitiesStore.getRows().length,
      availablePorts: portfolioRiskSensitivitiesStore.getPorts(),
      availableRiskTypes: portfolioRiskSensitivitiesStore.getRiskTypes(),
    });

    clearPV01Details();
    clearPV01Chart();

    return;
  }


  const calcData = calculateIRSensitivity(pv01Rows, selectedPort);

  if (!calcData.filteredRowsCount) {
    console.warn('[IR SENS] skipped render: no usable PV01 rows', {
      selectedPort,
      inputRows: pv01Rows.length,
      firstRow: pv01Rows[0],
      uniqueCcys: [
        ...new Set(
          pv01Rows.map(r => String(r.CCY ?? r.ccy ?? '').toUpperCase().trim())
        ),
      ],
      sampleKeys: pv01Rows[0] ? Object.keys(pv01Rows[0]) : [],
    });

    clearPV01Details();
    clearPV01Chart();

    return;
  }

  const portfolioRows = portfolioRiskSensitivitiesStore.getByPortfolio(selectedPort);

  updateMarketRiskSensitivityKpis({
    rows: portfolioRows,
    portName: selectedPort,
    pv01CalcData: calcData,
  });

  return renderIRSensTableAndChart(calcData, selectedPort);
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

  console.log('[IR SENS] FILTER CHECK:', {
    selectedPort,
    inputRows: rows.length,
    filteredRows: filteredRows.length,
    uniquePorts: [
      ...new Set(rows.map(r => String(r.PORT_NAME ?? r.port_name ?? '').trim())),
    ],
    uniqueRiskTypes: [
      ...new Set(
        rows.map(r =>
          String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim()
        )
      ),
    ],
    uniqueCcys: [
      ...new Set(
        rows.map(r => String(r.CCY ?? r.ccy ?? '').toUpperCase().trim())
      ),
    ],
    uniqueTenors: [
      ...new Set(filteredRows.map(r => r.TENOR ?? r.tenor)),
    ].sort((a, b) => Number(a) - Number(b)),
    firstFilteredRow: filteredRows[0],
  });

  console.log('[IR SENS] RESULT BY CCY:', {
    irSensitivityByCcy,
    pv01TotalByCcy,
    pv01PartialPctByCcy,
    filteredRowsCount: filteredRows.length,
  });

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

        const pv01Cell = row.insertCell();
        pv01Cell.textContent = Number(sum).toLocaleString('de-DE', {
          maximumFractionDigits: 0,
        });

        const weightCell = row.insertCell();
        weightCell.textContent = `${Number(weight).toFixed(2)}%`;
      });
    });

  wrapper.appendChild(table);

  mountPV01Details(wrapper);

  requestAnimationFrame(() => {
    createPV01Chart({
      irSensitivityByCcy,
      pv01PartialPctByCcy,
    });
  });

  console.log('[PV01 RENDER] wrapper created by CCY', {
    portName,
    tableRows: table.rows.length,
    chartRows: chartData.length,
    pv01TotalByCcy,
    canvasExists: !!document.getElementById('PV01Chart'),
    detailsContainerExists: !!document.getElementById('IRSensDataContainer'),
  });

  return wrapper;
}

function createPV01Chart({ irSensitivityByCcy = {}, pv01PartialPctByCcy = {} } = {}) {
  const canvasId = 'PV01Chart';
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    console.warn('[PV01 CHART] canvas not found:', canvasId);
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

  if (PV01Chart) {
    PV01Chart.destroy();
    PV01Chart = null;
  }

  const chartConfig = {
    labels,
    datasets,
  };

  PV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'x');

  console.log('[PV01 CHART] rendered by CCY (trimmed)', {
    canvasId,
    startLabel: labels[0],
    endLabel: labels[labels.length - 1],
    labels,
    datasetLabels: datasets.map(d => d.label),
  });
}

function mountPV01Details(wrapper) {
  const target = document.getElementById('IRSensDataContainer');

  if (!target) {
    console.error('[PV01 DETAILS] IRSensDataContainer not found');
    return;
  }

  console.log('[PV01 DETAILS] target before mount:', {
    target,
    targetHeight: target.offsetHeight,
    wrapperChildren: wrapper.children.length,
    tableRows: wrapper.querySelectorAll('tr').length,
  });

  // Hard reset, damit kein altes CSS/Layout die Tabelle "verschluckt"
function mountPV01Details(wrapper) {
  const target = document.getElementById('IRSensDataContainer');

  if (!target) {
    console.error('[PV01 DETAILS] IRSensDataContainer not found');
    return;
  }

  console.log('[PV01 DETAILS] target before mount:', {
    target,
    targetHeight: target.offsetHeight,
    wrapperChildren: wrapper.children.length,
    tableRows: wrapper.querySelectorAll('tr').length,
  });

  // Hard reset, damit kein altes CSS/Layout die Tabelle "verschluckt"
    target.innerHTML = '';
    target.style.display = 'block';
    target.style.minHeight = '120px';
    target.style.height = 'auto';
    target.style.overflow = 'visible';
    target.style.padding = '8px';

    wrapper.style.display = 'block';
    wrapper.style.width = '100%';
    wrapper.style.height = 'auto';
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
    th.style.background = '#3a3a3a';
  });

  target.appendChild(wrapper);

  console.log('[PV01 DETAILS] mounted:', {
    targetHeight: target.offsetHeight,
    childCount: target.children.length,
    htmlPreview: target.innerHTML.slice(0, 300),
  });

  }

  const table = wrapper.querySelector('table');

  if (table) {
    table.style.display = 'table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.color = '#fff';
    table.style.fontSize = '13px';
  }

  target.appendChild(wrapper);

  console.log('[PV01 DETAILS] mounted:', {
    targetHeight: target.offsetHeight,
    childCount: target.children.length,
    htmlPreview: target.innerHTML.slice(0, 300),
  });

  }

  function clearPV01Details() {
  const target = document.getElementById('IRSensDataContainer');

  if (target) {
    target.innerHTML = '';
  }
}

function clearPV01Chart() {
  if (PV01Chart) {
    PV01Chart.destroy();
    PV01Chart = null;
  }
}





