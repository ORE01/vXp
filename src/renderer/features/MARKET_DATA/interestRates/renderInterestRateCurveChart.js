import { createRatesLineChart } from '../../../charts/LineChart.js';
import { tenorToMonths } from './interestRateTransforms.js';

// "Reset Zoom"-Button (oben links) fuer den IR-Chart. Idempotent; liest die Chart-
// Instanz zur Klickzeit, uebersteht also jedes Neuzeichnen.
function ensureIRResetZoom(canvasId) {
  const canvas = document.getElementById(canvasId);
  const box = canvas?.parentElement;
  if (!box) return;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  if (box.querySelector('.ir-zoom-reset')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'ir-zoom-reset';
  btn.textContent = 'Reset Zoom';
  btn.style.cssText =
    'position:absolute;top:4px;left:4px;z-index:6;font-size:10px;padding:2px 8px;' +
    'border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;color:#334155;cursor:pointer;';
  btn.addEventListener('click', () => {
    try { window.Chart.getChart(document.getElementById(canvasId))?.resetZoom?.(); } catch {}
  });
  box.appendChild(btn);
}

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
      // x numerisch in Jahren -> lineare, proportionale Achse (kein "verzogen").
      data: tenors.map(t => ({ x: tenorToMonths(t) / 12, y: byTenor.has(t) ? byTenor.get(t) : null })),
      // Kurve glaetten (statt eckig): moderate Spline-Tension.
      tension: 0.35,
      fill: false,
    };
  });

  const chart = createRatesLineChart(datasets, canvasId, title, 0);
  if (chart) {
    appState[storeKey] = chart;
    ensureIRResetZoom(canvasId);
  }
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
      x: tenorToMonths(r.tenor) / 12,
      y: parseFloat(r.value) * 100
    })),
    fill: false,
    tension: 0.35,
  };

  const chart = createRatesLineChart(
    [dataset],
    'IRLineChart',
    'Interest Rates',
    0
  );

  if (chart) {
    appState._IRLineChart = chart;
  }
}