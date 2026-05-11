import { createRatesLineChart } from '../../../charts/LineChart.js';

export function renderInterestRateCurveChart(IRData) {
  const appState = window.appState;
  if (!appState) return;

  const canvas = document.getElementById('IRLineChart');
  if (!canvas || !canvas.isConnected) return;

  if (appState._IRLineChart) {
    try { appState._IRLineChart.destroy(); } catch {}
    appState._IRLineChart = null;
  }

  const dataset = {
    label: 'RATES',
    data: IRData.map(r => ({
      x: r.tenor,
      y: parseFloat(r.value) * 100
    })),
    fill: false,
    tension: 0.1,
  };

  const chart = createRatesLineChart(
    [dataset],
    'IRLineChart',
    'Interest Rates',
    3
  );

  if (chart) {
    appState._IRLineChart = chart;
  }
}