import { createRatesLineChart } from '../../../charts/LineChart.js';
import { tenorToMonths } from './interestRateTransforms.js';

// Mehrere Kurven überlagern: jede Kurve = ein Dataset, an die Vereinigung der
// Laufzeiten ausgerichtet (fehlende Punkte = Lücke). Farben/Legende kommen aus
// createRatesLineChart (Legende = curve_id, z. B. "EUR:SWAP:OIS").
export function renderInterestRateCurvesChart(curves, opts = {}) {
  const {
    canvasId = 'IRLineChart',
    storeKey = '_IRLineChart',
    title = 'Interest Rates',
  } = opts;

  const appState = window.appState;
  if (!appState) return;

  const canvas = document.getElementById(canvasId);
  if (!canvas || !canvas.isConnected) return;

  if (appState[storeKey]) {
    try { appState[storeKey].destroy(); } catch {}
    appState[storeKey] = null;
  }

  const valid = (curves || []).filter(c => c && Array.isArray(c.rows) && c.rows.length);
  if (!valid.length) return;

  // Vereinigung der Laufzeiten, nach Maturity sortiert.
  const tenors = [...new Set(valid.flatMap(c => c.rows.map(r => r.tenor)))]
    .sort((a, b) => tenorToMonths(a) - tenorToMonths(b));

  const datasets = valid.map(c => {
    const byTenor = new Map(c.rows.map(r => [r.tenor, parseFloat(r.value) * 100]));
    return {
      label: c.label,
      data: tenors.map(t => ({ x: t, y: byTenor.has(t) ? byTenor.get(t) : null })),
    };
  });

  const chart = createRatesLineChart(datasets, canvasId, title, 3);
  if (chart) appState[storeKey] = chart;
}

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