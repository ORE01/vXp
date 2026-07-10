'use strict';

// Loss-Histogramm (Dichte-Sicht der Verlustverteilung): Verlust (% vom NAV) auf x,
// Haeufigkeit ("wie oft") auf y. Datenquelle: lossHistogramMain (vom Backend
// gebinnt, gemeinsame Bins fuer alle pd_flags). Drei Serien:
// Historic (rating) / Implied (market) / Implied adjusted (norm).

import { appState } from '../../../renderer.js';
import { getColorFromPalette } from '../../../utils/colors.js';

const CHART_ID = 'lossHistogramChart';
let listenersInstalled = false;
let fetchRequested = false;   // lossHistogramMain nur einmal explizit nachfordern

function fmtPct(frac) {
  const n = Number(frac);
  return Number.isFinite(n) ? `${(n * 100).toFixed(1)}%` : '';
}

export function renderLossHistogram() {
  if (!listenersInstalled) {
    document.addEventListener('losshist:ready', renderLossHistogram);
    listenersInstalled = true;
  }

  // Store leer? Tabelle einmal explizit anfordern — UNABHAENGIG vom (entfernten)
  // Histogramm-Canvas, da auch das Credit-Dashboard-Loss-Chart (crLossDistChart) diese
  // Daten nutzt. Antwort landet als lossHistogramMainData -> setzt Store -> feuert
  // 'losshist:ready' -> beide Charts rendern.
  if (!(appState.getLossHistogram?.() || []).length && !fetchRequested) {
    fetchRequested = true;
    try { window.api?.send?.('fetch-table-data', 'lossHistogramMain'); } catch (_) {}
    return;
  }

  const canvas = document.getElementById(CHART_ID);
  if (!canvas || !window.Chart) return;

  const port = appState.getSelectedPortTableName?.();
  const allRows = appState.getLossHistogram?.() || [];

  const rows = allRows.filter((r) => String(r.port_name) === String(port));
  if (!rows.length) return;

  // Nach pd_flag gruppieren; gemeinsame Bins -> Labels aus einer Serie (rating bevorzugt).
  // pd_flag kommt vom Backend GROSS (RATING/MARKET/NORM) -> auf lowercase normalisieren.
  const byFlag = { rating: [], market: [], norm: [] };
  rows.forEach((r) => {
    const f = String(r.pd_flag || '').toLowerCase();
    if (byFlag[f]) byFlag[f].push(r);
  });

  const baseFlag = byFlag.rating.length ? 'rating'
    : byFlag.market.length ? 'market'
    : 'norm';
  const base = byFlag[baseFlag]
    .slice()
    .sort((a, b) => Number(a.bin_center) - Number(b.bin_center));
  if (!base.length) return;

  const labels = base.map((r) => fmtPct(r.bin_center));

  // Relative Haeufigkeit in % = count / n_simulations. Summe der Counts je Serie
  // = n_simulations (jede Simulation faellt in genau einen Bin). 0-Count-Bins -> null
  // (kein Balken), damit die Log-y-Achse nicht an log(0) scheitert.
  const totalFor = (flag) => byFlag[flag].reduce((s, r) => s + Number(r.count || 0), 0) || 1;
  const seriesFor = (flag) => {
    const total = totalFor(flag);
    const m = new Map(byFlag[flag].map((r) => [Number(r.bin_center), Number(r.count)]));
    return base.map((r) => {
      const c = m.get(Number(r.bin_center));
      return c ? (c / total) * 100 : null;
    });
  };

  // VaR-Bin je Serie rot einfaerben (wie der rote Balken im Total-Loss-Chart).
  // VaR_rel (aus CreditVaR) ist negativ (Verlust) -> |VaR_rel| = Verlust-Anteil vom
  // NAV; die Bins sind ebenfalls Anteile vom NAV.
  const RED = 'rgba(255, 0, 0, 0.9)';
  const varAbsFor = (flag) => {
    const r = (appState.getAllCvarData?.() || []).find(
      (x) => String(x.port_name) === String(port) && String(x.pd_flag).toUpperCase() === flag
    );
    const v = r ? Number(r.VaR_rel) : NaN;
    return Number.isFinite(v) ? Math.abs(v) : null;
  };
  const varBinIndex = (varAbs) => {
    if (varAbs == null) return -1;
    for (let i = 0; i < base.length; i++) {
      if (varAbs >= Number(base[i].bin_low) && varAbs < Number(base[i].bin_high)) return i;
    }
    let idx = -1, best = Infinity;
    base.forEach((r, i) => {
      const d = Math.abs(Number(r.bin_center) - varAbs);
      if (d < best) { best = d; idx = i; }
    });
    return idx;
  };
  const barColorsFor = (flag, baseColor) => {
    const vb = varBinIndex(varAbsFor(flag));
    return base.map((_, i) => (i === vb ? RED : baseColor));
  };

  const datasets = [
    { label: 'Historic',        data: seriesFor('rating'), backgroundColor: barColorsFor('RATING', getColorFromPalette(0, 0.7)) },
    { label: 'Market',          data: seriesFor('market'), backgroundColor: barColorsFor('MARKET', getColorFromPalette(1, 0.7)), hidden: true },
    { label: 'Market adjusted', data: seriesFor('norm'),   backgroundColor: barColorsFor('NORM', getColorFromPalette(2, 0.7)), hidden: true },
  ];

  if (window[CHART_ID] && typeof window[CHART_ID].destroy === 'function') {
    window[CHART_ID].destroy();
  }

  window[CHART_ID] = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12, padding: 8, font: { size: 12 },
            // Zusatz-Eintrag "VaR" (rot) unter den 3 Serien-Labels.
            generateLabels: (chart) => {
              const items = window.Chart.defaults.plugins.legend.labels.generateLabels(chart);
              items.push({ text: 'VaR', fillStyle: 'rgba(255,0,0,0.9)', strokeStyle: 'rgba(255,0,0,0.9)', lineWidth: 0, hidden: false, datasetIndex: -1 });
              return items;
            },
          },
          onClick: (e, item, legend) => {
            if (item.datasetIndex == null || item.datasetIndex < 0) return; // Pseudo-Eintrag "VaR"
            window.Chart.defaults.plugins.legend.onClick(e, item, legend);
          },
        },
        tooltip: {
          callbacks: {
            title: (ctx) => `Loss ${labels[ctx[0].dataIndex]}`,
            label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.y).toFixed(3)} %`,
          },
        },
      },
      scales: {
        x: {
          title: { display: true, text: 'Loss (% of NAV)' },
          ticks: { maxTicksLimit: 14, autoSkip: true },
          grid: { display: false },
        },
        y: {
          // Log-Skala: die Verteilung ist stark konzentriert (fast alle Szenarien
          // bei ~0 Verlust) -> linear waere nur EIN Balken sichtbar. Log macht den
          // Tail (seltene grosse Verluste) sichtbar.
          type: 'logarithmic',
          title: { display: true, text: 'Relative frequency (% of simulations, log)' },
        },
      },
    },
  });
}
