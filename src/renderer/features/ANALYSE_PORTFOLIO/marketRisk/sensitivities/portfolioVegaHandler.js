'use strict';

import processData from '../../../../core/ui/modal/modalData.js';
import createBarChart from '../../../../charts/BarChart.js';

import { formatNumberWithGrouping } from '../../../../utils/tableCellFormats.js';
import { getCreditSensitivityColor } from '../../../../utils/colors.js';

import { updateMarketRiskSensitivityKpis } from './marketRiskSensitivityKpis.js';

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

export function handleVegaSensData(appState, forcedPortName = null) {
  if (!appState) {
    console.warn('[VEGA SENS] skipped render: appState missing');
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

  const vegaRows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort &&
    normalizeRiskType(r.RISK_TYPE ?? r.risk_type) === 'VEGA_PARALLEL'
  );

  if (!Array.isArray(vegaRows) || vegaRows.length === 0) {
    console.warn('[VEGA SENS] no VEGA_PARALLEL rows for selected portfolio', {
      selectedPort,
      storeRows: riskRowsAll.length,
      availablePorts,
      availableRiskTypes,
    });

    clearVegaChart();
    clearVegaDetails();   
    return;
  }

  const calcData = calculateVegaSensitivity(vegaRows, selectedPort);

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

  const portfolioRows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort
  );

  updateMarketRiskSensitivityKpis({
    rows: portfolioRows,
    portName: selectedPort,
    vegaCalcData: {
      totalVega: calcData.totalVega,
      filteredRowsCount: calcData.filteredRowsCount,
      groupedVega: calcData.groupedVega,
    },
  });

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

function renderVegaTableAndChart(data, portName) {
  const { totalVega, sortedVega } = data;

  const wrapper = document.createElement('div');
  wrapper.className = 'vega-sens-wrapper';

  const tableData = sortedVega.map(([bucket, vega]) => {
    const weight = totalVega ? (vega / totalVega) * 100 : 0;

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