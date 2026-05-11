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


function bindCSCcySelectorOnce() {
  const selector = document.getElementById('csCcySelector');
  const appState = window.appState;

  if (!selector || !appState) return;

  const currentCcy =
    appState.getSelectedCcy?.() ||
    appState.selectedCcy ||
    'EUR';

  // wichtig: IMMER synchronisieren, auch wenn schon gebunden
  selector.value = String(currentCcy).toUpperCase();

  if (selector.dataset.bound === '1') return;
  selector.dataset.bound = '1';

  selector.addEventListener('change', (event) => {
    const ccy = String(event.target.value || 'EUR').toUpperCase();

    console.log('[CS][CCY] changed from chart selector:', ccy);

    if (appState.setSelectedCcy) {
      appState.setSelectedCcy(ccy);
    } else {
      appState.selectedCcy = ccy;
    }

    document.dispatchEvent(
      new CustomEvent('ccy:changed', { detail: { ccy } })
    );

    renderCreditSpreadCurveChart();
  });
}

export function renderCreditSpreadCurveChart() {
  bindCSCcySelectorOnce();

  const appState = window.appState;
  if (!appState) return;

  const { rows, scenarioLabel, reason, ccy } = getCreditSpreadCurveData(appState);

  if (!rows.length) {
    console.log('[CS CHART] skip:', reason || 'NO_ROWS');
    return;
  }

  const normalizedRows = normalizeRatings(rows);
  const tenors = extractSortedTenors(normalizedRows);

  const ranks = Array.from(
  new Set(
    normalizedRows
      .map(row => row.rank)
      .filter(Boolean)
  )
);

const rankLabel =
  ranks.length === 1
    ? ranks[0]
    : ranks.length > 1
      ? 'multiple ranks'
      : 'rank n/a';

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
        text: `Credit Spreads in Basis Points (${ccy} · ${scenarioLabel} · ${rankLabel})`,
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
  document.addEventListener('ccy:changed', safeRenderCreditSpreadCurveChart);

  document.addEventListener('panel:opened', (event) => {
    const panelId = event?.detail?.panelId;

    if (panelId === 'panel-creditspreads') {
      safeRenderCreditSpreadCurveChart();
    }
  });

  safeRenderCreditSpreadCurveChart();
}