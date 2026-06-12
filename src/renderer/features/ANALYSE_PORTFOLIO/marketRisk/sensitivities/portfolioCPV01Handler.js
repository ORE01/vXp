'use strict';

// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioCPV01Handler.js

import processData from '../../../../core/ui/modal/modalData.js';
import createBarChart from '../../../../charts/BarChart.js';

import { formatNumberWithGrouping } from '../../../../utils/tableCellFormats.js';

import { updateMarketRiskSensitivityKpis } from './marketRiskSensitivityKpis.js';

let CPV01Chart;

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

function normalizeCreditBucket(value) {
  const raw = String(value ?? '').trim();

  if (!raw) return 'UNKNOWN';

  // CS:EUR:A+   -> A+
  // CS:EUR:AA-  -> AA-
  // CS:EUR:BBB+ -> BBB+
  if (raw.includes(':')) {
    const parts = raw.split(':');
    return String(parts[parts.length - 1] ?? raw).trim();
  }

  return raw;
}

const RATINGS_ORDER = [
  'AAA',
  'AA+', 'AA', 'AA-',
  'A+', 'A', 'A-',
  'BBB+', 'BBB', 'BBB-',
  'BB+', 'BB', 'BB-',
  'B+', 'B', 'B-',
  'CCC+', 'CCC', 'CCC-',
  'CC', 'C', 'D',
];

function sortCreditBuckets(a, b) {
  const ia = RATINGS_ORDER.indexOf(a);
  const ib = RATINGS_ORDER.indexOf(b);

  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;

  return String(a).localeCompare(String(b));
}

export function handleCSSensData(appState, forcedPortName = null) {
  if (!appState) {
    console.warn('[CP SENS] skipped render: appState missing');
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

  const riskRowsAll = appState.getPortfolioRiskSensitivitiesData?.() || [];

  const availablePorts = getAvailablePorts(riskRowsAll);
  const availableRiskTypes = getAvailableRiskTypes(riskRowsAll);

  const selectedPort = normalizePortfolioName(
    rawPortName ||
    (availablePorts.length === 1 ? availablePorts[0] : null)
  );

  if (!selectedPort) {
    console.warn('[CP SENS] skipped render: no selected portfolio yet', {
      rawPortName,
      availablePorts,
    });

    clearCPV01Chart();
    clearCPV01Details();

    return;
  }

  console.log('[CP SENS] selected portfolio resolved', {
    rawPortName,
    selectedPort,
    availablePorts,
    storeRows: riskRowsAll.length,
    riskTypes: availableRiskTypes,
  });

  const cpv01Rows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort &&
    normalizeRiskType(r.RISK_TYPE ?? r.risk_type) === 'CPV01'
  );

  if (!Array.isArray(cpv01Rows) || cpv01Rows.length === 0) {
    console.warn('[CP SENS] no CPV01 rows for selected portfolio', {
      selectedPort,
      storeRows: riskRowsAll.length,
      availablePorts,
      availableRiskTypes,
    });

    clearCPV01Chart();
    clearCPV01Details();

    return;
  }

  const calcData = calculateCreditSensitivity(cpv01Rows, selectedPort);

  const hasAnyCPV01 =
    Object.values(calcData.cpv01TotalByCcy || {}).some(value => {
      const n = Number(value);
      return Number.isFinite(n) && Math.abs(n) > 1e-12;
    });

  if (!calcData.filteredRowsCount || !hasAnyCPV01) {
    console.warn('[CP SENS] skipped render: no usable CPV01 rows', {
      selectedPort,
      inputRows: cpv01Rows.length,
      firstRow: cpv01Rows[0],
      cpv01TotalByCcy: calcData.cpv01TotalByCcy,
    });

    clearCPV01Chart();
    clearCPV01Details();
    return;
  }

  const portfolioRows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort
  );

  updateMarketRiskSensitivityKpis({
    rows: portfolioRows,
    portName: selectedPort,
    cpv01CalcData: {
      cpv01TotalByCcy: calcData.cpv01TotalByCcy,
      groupedCPV01ByCcy: calcData.groupedCPV01ByCcy,
      sortedCPV01ByCcy: calcData.sortedCPV01ByCcy,
      filteredRowsCount: calcData.filteredRowsCount,
    },
  });

  return renderCPV01TableAndChart(calcData, selectedPort);
}

function calculateCreditSensitivity(rows, portName) {
  const selectedPort = normalizePortfolioName(portName);

  // IMPORTANT:
  // Do NOT filter to EUR.
  // Do NOT aggregate different CCYs into one CPV01.
  // CPV01 belongs to a credit spread curve/CCY: EUR CPV01, USD CPV01, JPY CPV01, ...
  const filteredRows = rows.filter(r => {
    const value = Number(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local ?? 0
    );

    return Number.isFinite(value);
  });

  const groupedCPV01ByCcy = {};
  const cpv01TotalByCcy = {};

  filteredRows.forEach(r => {
    const ccy = String(r.CCY ?? r.ccy ?? 'UNKNOWN')
      .toUpperCase()
      .trim() || 'UNKNOWN';

    const bucket = normalizeCreditBucket(
      r.RISK_FACTOR_ID ??
      r.risk_factor_id ??
      r.RATING ??
      r.rating ??
      r.TENOR ??
      r.tenor ??
      'UNKNOWN'
    );

    const value = Number(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local ?? 0
    );

    if (!bucket || !Number.isFinite(value) || value === 0) return;

    if (!groupedCPV01ByCcy[ccy]) {
      groupedCPV01ByCcy[ccy] = {};
    }

    groupedCPV01ByCcy[ccy][bucket] =
      (groupedCPV01ByCcy[ccy][bucket] || 0) + value;

    cpv01TotalByCcy[ccy] =
      (cpv01TotalByCcy[ccy] || 0) + value;
  });

  const sortedCPV01ByCcy = Object.fromEntries(
    Object.entries(groupedCPV01ByCcy).map(([ccy, grouped]) => {
      const sorted = Object.entries(grouped)
        .filter(([, value]) => Number.isFinite(value) && value !== 0)
        .sort((a, b) => sortCreditBuckets(a[0], b[0]));

      return [ccy, sorted];
    })
  );

  console.log('[CP SENS] RESULT BY CCY:', {
    selectedPort,
    inputRows: rows.length,
    filteredRows: filteredRows.length,
    cpv01TotalByCcy,
    groupedCPV01ByCcy,
    sortedCPV01ByCcy,
    uniqueCcys: [
      ...new Set(
        rows.map(r => String(r.CCY ?? r.ccy ?? '').toUpperCase().trim())
      ),
    ],
    firstFilteredRow: filteredRows[0],
  });

  return {
    cpv01TotalByCcy,
    groupedCPV01ByCcy,
    sortedCPV01ByCcy,
    filteredRowsCount: filteredRows.length,

    // Legacy keys intentionally disabled.
    // Do not use one total across currencies/credit curves.
    totalCPV01: null,
    groupedCPV01: null,
    sortedCPV01: [],
  };
}

function renderCPV01TableAndChart(data, portName) {
  const {
    cpv01TotalByCcy = {},
    sortedCPV01ByCcy = {},
  } = data;

  const wrapper = document.createElement('div');
  wrapper.className = 'csens-wrapper';

  const tableData = [];

  Object.entries(sortedCPV01ByCcy)
    .sort(([ccyA], [ccyB]) => ccyA.localeCompare(ccyB))
    .forEach(([ccy, rows]) => {
      const totalForCcy = cpv01TotalByCcy[ccy] || 0;

      rows.forEach(([bucket, cpv01]) => {
        const weight = totalForCcy ? (cpv01 / totalForCcy) * 100 : 0;

        tableData.push({
          CCY: ccy,
          Bucket: bucket,
          CPV01: formatNumberWithGrouping(cpv01),
          'Weight %': `${weight.toFixed(2)}%`,
        });
      });
    });

  const title = `CPV01 Details by CCY for ${portName}`;

  wrapper.innerHTML = processData(tableData, title);

  mountCPV01Details(wrapper);

  requestAnimationFrame(() => {
    createCPV01Chart({
      sortedCPV01ByCcy,
      cpv01TotalByCcy,
    });
  });

  console.log('[CP SENS] rendered from PortfolioRiskSensitivities by CCY', {
    portName,
    cpv01TotalByCcy,
    tableRows: tableData.length,
    canvasExists: !!document.getElementById('CPV01Chart'),
    detailsContainerExists: !!document.getElementById('CSSensDataContainer'),
  });

  return wrapper;
}

function mountCPV01Details(wrapper) {
  const target = document.getElementById('CSSensDataContainer');

  if (!target) {
    console.warn('[CPV01 DETAILS] CSSensDataContainer not found');
    return;
  }

  target.innerHTML = '';
  target.style.display = 'block';
  target.style.minHeight = '120px';
  target.style.maxHeight = '500px';
  target.style.height = '100%';
  target.style.overflowY = 'auto';
  target.style.overflowX = 'auto';
  target.style.padding = '8px';

  wrapper.style.display = 'block';
  wrapper.style.width = '100%';
  wrapper.style.maxHeight = '100%';
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

  console.log('[CPV01 DETAILS] mounted', {
    rows: wrapper.querySelectorAll('tr').length,
  });
}

function createCPV01Chart({
  sortedCPV01ByCcy = {},
  cpv01TotalByCcy = {},
} = {}) {
  const canvasId = 'CPV01Chart';

  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn('[CPV01 CHART] canvas not found:', canvasId);
    return;
  }

  const allBuckets = Array.from(
    new Set(
      Object.values(sortedCPV01ByCcy)
        .flat()
        .map(([bucket]) => bucket)
    )
  ).sort(sortCreditBuckets);

  const datasets = Object.entries(sortedCPV01ByCcy)
    .sort(([ccyA], [ccyB]) => ccyA.localeCompare(ccyB))
    .map(([ccy, rows]) => {
      const totalForCcy = cpv01TotalByCcy[ccy] || 0;
      const valueByBucket = Object.fromEntries(rows);

      return {
        label: `${ccy} CPV01 Weight by Bucket (%)`,
        data: allBuckets.map((bucket) => {
          const value = Number(valueByBucket[bucket] || 0);
          return totalForCcy ? (value / totalForCcy) * 100 : 0;
        }),
        borderWidth: 1,
      };
    });

  if (CPV01Chart) {
    CPV01Chart.destroy();
    CPV01Chart = null;
  }

  const chartConfig = {
    labels: allBuckets,
    datasets,
  };

  CPV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'x');

  console.log('[CPV01 CHART] rendered by CCY', {
    canvasId,
    labels: allBuckets,
    datasetLabels: datasets.map(d => d.label),
  });
}

function clearCPV01Details() {
  const target = document.getElementById('CSSensDataContainer');

  if (target) {
    target.innerHTML = '';
  }
}

function clearCPV01Chart() {
  if (CPV01Chart) {
    try {
      CPV01Chart.destroy();
    } catch (e) {
      console.warn('[CPV01 CHART] destroy failed', e);
    }

    CPV01Chart = null;
  }
}