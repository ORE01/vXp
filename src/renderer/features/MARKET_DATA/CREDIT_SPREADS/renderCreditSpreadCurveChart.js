import { createCSLineChart } from '../../../charts/LineChart.js';
import { getCSColors } from '../../../utils/colors.js';

import {
  extractSortedTenors,
  normalizeRatings,
  buildCreditSpreadCurveChartData
} from './creditSpreadTransforms.js';

import {
  getCreditSpreadCurveData
} from './creditSpreadCurveData.js';

export function renderCreditSpreadCurveChart() {
  const appState = window.appState;
  if (!appState) return;

  const { rows, scenarioLabel, reason } = getCreditSpreadCurveData(appState);

  if (!rows.length) {
    console.log('[CS CHART] skip:', reason || 'NO_ROWS');
    return;
  }

  const normalizedRows = normalizeRatings(rows);
  const tenors = extractSortedTenors(normalizedRows);

  if (!tenors.length) {
    console.warn('[CS CHART] No tenor columns found');
    return;
  }

  const chartData = buildCreditSpreadCurveChartData(
    normalizedRows,
    tenors,
    getCSColors
  );

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: `Credit Spreads in Basis Points (${scenarioLabel})`,
      },
    },
    scales: {
      x: { beginAtZero: true },
      y: {
        suggestedMin: 0,
        suggestedMax: 300,
      },
    },
  };

  const canvas = document.getElementById('CS_ChartCanvas');
  if (!canvas) return;

  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  createCSLineChart(chartData, chartOptions);
}

export function initCreditSpreadCurveChartListener() {
  if (window.__creditSpreadCurveChartListenerInstalled) return;
  window.__creditSpreadCurveChartListenerInstalled = true;

  const safeRenderCreditSpreadCurveChart = () => {
    requestAnimationFrame(() => {
      setTimeout(() => {
        renderCreditSpreadCurveChart();
      }, 0);
    });
  };

  document.addEventListener('cs:active:ready', safeRenderCreditSpreadCurveChart);
  document.addEventListener('cs:base:ready', safeRenderCreditSpreadCurveChart);
  document.addEventListener('cs:scenario:ready', safeRenderCreditSpreadCurveChart);

  document.addEventListener('panel:opened', (event) => {
    const panelId = event?.detail?.panelId;

    if (panelId === 'panel-creditspreads') {
      safeRenderCreditSpreadCurveChart();
    }
  });

  safeRenderCreditSpreadCurveChart();
}