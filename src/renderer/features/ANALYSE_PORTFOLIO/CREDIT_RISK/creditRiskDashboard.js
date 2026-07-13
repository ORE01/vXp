'use strict';

// Credit-Risk-Dashboard analog zum Market-Risk-Dashboard: KPI-Karten (CVaR + ES CVaR)
// mit relativem Wert + Ampel + Deltas + absolutem Wert, plus Limit-Auslastungsleiste.
// Nutzt dieselben CSS-Klassen (mr-kpi-card / mr-limit / mr-amp) -> gleiches Aussehen.
// TSI / MSD folgen spaeter.

import { appState } from '../../../renderer.js';
import { sumNavForPort, buildPositionLoss, issuersFromRank, lossDefaultStep, getRunConfQuantil } from './LossIssuer.js';
import { createContribDrill, scheduleHideConcMenu } from '../SummaryBreakdown.js';

// Drill-down fuer den Tail-Zoom-Chart: Klick auf ein Quantil -> Positionen der in diesem
// Szenario ausfallenden Emittenten (ISSUER_RANK), mit NAV + Loss + Rating. Gleiche Engine
// wie der Loss-Chart (LossIssuer); eigene Detail-/Menue-Container unter dem Tail-Chart.
const _crTailDrillCfg = {
  detailId: 'crTailDetail', titleId: 'crTailDetailTitle',
  tableId: 'crTailDetailTable', closeId: 'crTailDetailClose',
  menuId: 'crTailCardMenu', valueType: 'NAV', valueLabel: 'NAV',
  extraCol: { key: '__LOSS', label: 'Loss' },
  infoCol: { key: 'RATINGres', label: 'Rating' },
};
const crTailDrill = createContribDrill({ var: _crTailDrillCfg, es: _crTailDrillCfg });

function _bindCrTailCanvasLeave(canvas) {
  if (!canvas || canvas.dataset.crTailLeaveBound) return;
  canvas.dataset.crTailLeaveBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}

// Drill per RECHTSKLICK auf einen Quantil-Balken: unterdrueckt das native Kontextmenue
// und oeffnet das Drill-Menue am Cursor. Liest Chart-Instanz + Steps (je Serie) zur
// Klickzeit neu, uebersteht also jedes Neuzeichnen.
function _bindCrTailContextDrill(canvas) {
  if (!canvas || canvas.dataset.crTailCtxBound) return;
  canvas.dataset.crTailCtxBound = '1';
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    try {
      const chart = window.crTailZoomChart;
      if (!chart) return;
      const el = (chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || [])[0];
      if (!el) { scheduleHideConcMenu(); return; }
      const steps = chart.$crTailSteps?.[el.datasetIndex] || chart.$crTailSteps?.[0] || [];
      const step = steps[el.index];
      if (!step) { scheduleHideConcMenu(); return; }
      crTailDrill.hover('var', { native: e }, [{ index: 0 }], [step]);
    } catch {}
  });
}

// Loss-Distribution-Chart (links): gleiches Drill-Muster wie der Tail-Zoom. Klick auf ein
// Loss-Bin -> Ausfall-Szenario dieser Verlusthoehe (Steps in chart.$crLossSteps). Teilt sich
// crTailDrill + crTailDetail mit dem Tail-Zoom (ein Detailbereich unter beiden Charts).
function _bindCrLossCanvasLeave(canvas) {
  if (!canvas || canvas.dataset.crLossLeaveBound) return;
  canvas.dataset.crLossLeaveBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}
function _bindCrLossContextDrill(canvas) {
  if (!canvas || canvas.dataset.crLossCtxBound) return;
  canvas.dataset.crLossCtxBound = '1';
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    try {
      const chart = window.crLossDistChart;
      if (!chart) return;
      const el = (chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || [])[0];
      if (!el) { scheduleHideConcMenu(); return; }
      const steps = chart.$crLossSteps?.[el.datasetIndex] || chart.$crLossSteps?.[0] || [];
      const step = steps[el.index];
      if (!step) { scheduleHideConcMenu(); return; }
      crTailDrill.hover('var', { native: e }, [{ index: 0 }], [step]);
    } catch {}
  });
}

let _listenersBound = false;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

// VaR-/ES-Referenzlinien (Annotation-Plugin global aus). Konfig via options.plugins.crLines:
//   { v: [{at, color, width, dash}], h: [...] }  (v = vertikal, h = horizontal).
const _crLinePlugin = {
  id: 'crLines',
  afterDatasetsDraw(chart, args, opts) {
    if (!opts) return;
    const ctx = chart.ctx, area = chart.chartArea;
    const stroke = (px, vertical, o) => {
      ctx.save();
      ctx.strokeStyle = o.color || 'rgba(43,108,176,0.95)';
      ctx.lineWidth = o.width || 2;
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath();
      if (vertical) { ctx.moveTo(px, area.top); ctx.lineTo(px, area.bottom); }
      else { ctx.moveTo(area.left, px); ctx.lineTo(area.right, px); }
      ctx.stroke();
      ctx.restore();
    };
    (opts.v || []).forEach(o => { const x = chart.scales.x.getPixelForValue(o.at); if (Number.isFinite(x)) stroke(x, true, o); });
    (opts.h || []).forEach(o => { const y = chart.scales.y.getPixelForValue(o.at); if (Number.isFinite(y)) stroke(y, false, o); });
  },
};

// TSI-Band (VaR Historic -> ES Historic, violett) + MSD-Band (ES Historic -> ES Market
// adjusted, amber), je per chart.$showTSI / chart.$showMSD ein-/ausblendbar. Werte aus
// chart.$bandVals = { ratingVar, ratingEs, normEs } (in % vom NAV).
const _crBandsPlugin = {
  id: 'crBands',
  afterDatasetsDraw(chart) {
    const bv = chart.$bandVals;
    if (!bv || !chart.chartArea || !chart.scales?.y) return;
    const { ctx, chartArea } = chart;
    const ySc = chart.scales.y;
    const drawBand = (v0, v1, fill, textFill, label) => {
      if (!Number.isFinite(v0) || !Number.isFinite(v1)) return;
      const y0 = ySc.getPixelForValue(v0), y1 = ySc.getPixelForValue(v1);
      if (!Number.isFinite(y0) || !Number.isFinite(y1) || Math.abs(y0 - y1) < 1) return;
      const top = Math.min(y0, y1), h = Math.abs(y0 - y1);
      ctx.save();
      ctx.fillStyle = fill;
      ctx.fillRect(chartArea.left, top, chartArea.right - chartArea.left, h);
      ctx.fillStyle = textFill;
      ctx.font = 'bold 12px sans-serif';
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.fillText(label, (chartArea.left + chartArea.right) / 2, top + h / 2);
      ctx.textAlign = 'left'; ctx.textBaseline = 'alphabetic';
      ctx.restore();
    };
    if (chart.$showTSI) drawBand(bv.ratingVar, bv.ratingEs, 'rgba(150,110,220,0.20)', 'rgba(180,145,238,0.98)', 'TSI');
    if (chart.$showMSD) drawBand(bv.ratingEs, bv.normEs, 'rgba(230,170,60,0.20)', 'rgba(240,185,75,0.98)', 'MSD');
  },
};
const LINE_BLUE = 'rgba(43,108,176,0.95)';
const BAR_BLUE = 'rgba(70,120,180,0.85)';
const BAR_RED = 'rgba(210,70,70,0.85)';
// Hellere Varianten fuer die Serie "Market adjusted" (norm) -> optisch von Historic
// unterscheidbar (analog zu den eigenen Serienfarben in LossIssuerCombinedChart).
const LINE_BLUE_LIGHT = 'rgba(120,175,225,0.95)';
const BAR_BLUE_LIGHT = 'rgba(125,180,225,0.85)';
const BAR_RED_LIGHT = 'rgba(235,150,150,0.85)';
function _crChartColor() {
  return (getComputedStyle(document.body).getPropertyValue('--text-primary') || '').trim() || '#333';
}
function _destroyCrChart(id) {
  const c = window[id];
  if (c && typeof c.destroy === 'function') { try { c.destroy(); } catch {} }
  window[id] = null;
}

// pd_flag-Serien fuer die Loss-Charts (wie im Loss-Histogramm ueber die Legende waehlbar).
const CR_FLAG_SERIES = [
  { key: 'rating', label: 'Historic' },
  { key: 'market', label: 'Market' },
  { key: 'norm',   label: 'Market adjusted' },
];

// Sichtbare VaR/ES-Referenzlinien aus den aktuell eingeblendeten Datasets zusammenstellen.
// chart.$crLineMap[i] = Linien der Serie i; axis 'v' (vertikal) oder 'h' (horizontal).
function _crRebuildLines(chart, axis) {
  const map = chart?.$crLineMap;
  if (!map || !chart.options?.plugins?.crLines) return;
  const lines = [];
  map.forEach((ls, i) => { if (chart.isDatasetVisible(i)) lines.push(...ls); });
  chart.options.plugins.crLines[axis] = lines;
}

// Legenden-onClick: Standard-Toggle + Linien passend zu den sichtbaren Serien neu aufbauen.
function _crLegendOnClick(axis) {
  return (e, item, legend) => {
    window.Chart.defaults.plugins.legend.onClick(e, item, legend);
    try { _crRebuildLines(legend.chart, axis); legend.chart.update(); } catch {}
  };
}

// LINKS: Loss-Histogramm (lossHistogramMain, RATING) mit Tail-Highlight + VaR/ES-Linien.
// y = Frequency (log, da die Verteilung stark bei ~0 konzentriert ist). Tail-Bins
// (Verlust >= VaR) rot. Vertikale VaR (solid) + ES (dashed) Linien.
function renderCreditLossDist() {
  const canvas = document.getElementById('crLossDistChart');
  if (!canvas || !window.Chart) return;
  _destroyCrChart('crLossDistChart');
  const port = appState.getSelectedPortTableName?.();
  const all = (appState.getLossHistogram?.() || []).filter(r => String(r.port_name) === String(port));
  if (!all.length) { canvas.style.display = 'none'; return; }

  // Nach pd_flag gruppieren; gemeinsame Bins -> Labels aus einer Basis-Serie (rating bevorzugt).
  const byFlag = { rating: [], market: [], norm: [] };
  all.forEach(r => { const f = String(r.pd_flag || '').toLowerCase(); if (byFlag[f]) byFlag[f].push(r); });
  const baseFlag = byFlag.rating.length ? 'rating' : byFlag.market.length ? 'market' : 'norm';
  const base = byFlag[baseFlag].slice().sort((a, b) => Number(a.bin_center) - Number(b.bin_center));
  if (!base.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  const labels = base.map(r => (Number(r.bin_center) * 100).toFixed(1));
  const cvarByFlag = creditRowsByFlag();
  // Index des Bins, DURCH DAS die VaR/ES-Linie geht (naechstes Bin-Zentrum zum Wert).
  const nearestIdx = (pct) => { let idx = 0, best = Infinity; base.forEach((r, i) => { const d = Math.abs(Number(r.bin_center) * 100 - pct); if (d < best) { best = d; idx = i; } }); return idx; };

  // Drill (wie Tail-Zoom): Loss-Bin -> Ausfall-Szenario dieser Verlusthoehe. Quantil-
  // Loss-Zeilen je Serie (fuer die Bin->Szenario-Zuordnung) + Positions-Drilldaten setzen.
  const sumNav = sumNavForPort(port);
  const lossRows = (appState.getAllLossData?.() || [])
    .filter(r => String(r.port_name) === String(port) && Number.isFinite(Number(r.QUANTIL)));
  const lossByFlag = { rating: [], market: [], norm: [] };
  lossRows.forEach(r => { const f = String(r.pd_flag || '').toLowerCase(); if (lossByFlag[f]) lossByFlag[f].push(r); });
  try {
    const portRows = (appState.getAllPortfolioData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === String(port).trim());
    crTailDrill.setData(buildPositionLoss(portRows, port));
  } catch (e) { console.warn('[CreditLossDist] drill data failed', e); }

  // Je pd_flag eine Serie (Historic/Market/Market adjusted); nur Historic initial sichtbar.
  const lineMap = [];
  const stepsByDs = [];   // stepsByDs[dsIndex][binIndex] = Drill-Schritt (ausfallende Emittenten)
  const datasets = CR_FLAG_SERIES.map((f, di) => {
    const m = new Map(byFlag[f.key].map(r => [Number(r.bin_center), Number(r.count)]));
    const data = base.map(r => { const c = m.get(Number(r.bin_center)); return c > 0 ? c : null; });
    const rr = cvarByFlag[f.key] || {};
    const varPct = Math.abs(num(rr.VaR_rel)) * 100;
    const esPct = Math.abs(num(rr.ES_rel)) * 100;
    // Rot ab dem Bin, DURCH DAS die VaR-Linie geht (nearestIdx) und alle rechts davon —
    // so ist die Saeule unter der VaR-Linie garantiert rot (Blau/Rot-Grenze = Linie).
    const varIdx = Number.isFinite(varPct) ? nearestIdx(varPct) : Infinity;
    // "Market adjusted" (norm) in hellerem Blau/Rot -> von Historic unterscheidbar.
    const isNorm = f.key === 'norm';
    const barBlue = isNorm ? BAR_BLUE_LIGHT : BAR_BLUE;
    const barRed = isNorm ? BAR_RED_LIGHT : BAR_RED;
    const lineCol = isNorm ? LINE_BLUE_LIGHT : LINE_BLUE;
    const colors = base.map((r, i) => (i >= varIdx ? barRed : barBlue));
    const lines = [];
    if (Number.isFinite(varPct)) lines.push({ at: nearestIdx(varPct), color: lineCol, width: 2 });
    if (Number.isFinite(esPct)) lines.push({ at: nearestIdx(esPct), color: lineCol, width: 2, dash: [6, 4] });
    lineMap.push(lines);
    // Drill-Steps je Bin: das Quantil-Szenario dieser Serie, dessen Loss der Bin-Hoehe
    // am naechsten kommt -> dessen ausfallende Emittenten (ISSUER_RANK).
    const flagLoss = (lossByFlag[f.key] && lossByFlag[f.key].length) ? lossByFlag[f.key] : lossByFlag.rating;
    const nearestLossRow = (binPct) => {
      if (!flagLoss?.length || !(sumNav > 0)) return null;
      return flagLoss.reduce((best, r) =>
        (Math.abs(Number(r.LOSS) / sumNav * 100 - binPct) < Math.abs(Number(best.LOSS) / sumNav * 100 - binPct) ? r : best), flagLoss[0]);
    };
    const steps = base.map(r => { const row = nearestLossRow(Number(r.bin_center) * 100); return row ? lossDefaultStep(issuersFromRank(row.ISSUER_RANK)) : null; });
    stepsByDs.push(steps);
    return { label: f.label, data, backgroundColor: colors, borderColor: colors, maxBarThickness: 22, hidden: di !== 0 };
  });

  const col = _crChartColor();
  canvas.width = Math.max(320, Math.floor((canvas.parentElement?.clientWidth || 540) - 28)); canvas.height = 300;
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: [_crLinePlugin],
    data: { labels, datasets },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: col,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: col, boxWidth: 12, font: { size: 11 } }, onClick: _crLegendOnClick('v') },
        subtitle: { display: true, text: 'Tail red · VaR (solid) · ES (dashed)', color: col, align: 'start', font: { size: 10 } },
        crLines: { v: lineMap[0] },
        tooltip: { callbacks: { title: (c) => `Loss ${labels[c[0].dataIndex]}%`, label: (c) => `${c.dataset.label}: ${c.parsed.y}` } },
      },
      scales: {
        x: { title: { display: true, text: 'Loss (% of NAV)', color: col }, ticks: { color: col, maxTicksLimit: 14, autoSkip: true }, grid: { display: false } },
        y: { type: 'logarithmic', title: { display: true, text: 'Frequency (log)', color: col }, ticks: { color: col } },
      },
    },
  });
  chart.$crLineMap = lineMap;
  chart.$crLossSteps = stepsByDs;
  window.crLossDistChart = chart;
  _bindCrLossCanvasLeave(canvas);
  _bindCrLossContextDrill(canvas);
}

// RECHTS: Tail-Zoom — Verlust (% vom NAV) je Quantil im Extrem-Tail (sortedLossesIssuer,
// RATING). Balken >= VaR rot; horizontale VaR (solid) + ES (dashed) Linien.
function renderCreditTailZoom() {
  const canvas = document.getElementById('crTailZoomChart');
  if (!canvas || !window.Chart) return;
  _destroyCrChart('crTailZoomChart');
  const port = appState.getSelectedPortTableName?.();
  const all = (appState.getAllLossData?.() || [])
    .filter(r => String(r.port_name) === String(port) && Number.isFinite(Number(r.QUANTIL)));
  if (!all.length) { canvas.style.display = 'none'; return; }

  const byFlag = { rating: [], market: [], norm: [] };
  all.forEach(r => { const f = String(r.pd_flag || '').toLowerCase(); if (byFlag[f]) byFlag[f].push(r); });
  const baseFlag = byFlag.rating.length ? 'rating' : byFlag.market.length ? 'market' : 'norm';
  if (!byFlag[baseFlag].length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  const sumNav = sumNavForPort(port);
  const targets = [99.0, 99.2, 99.4, 99.5, 99.6, 99.7, 99.8, 99.9, 99.95, 99.99];
  const labels = targets.map(q => q.toFixed(q >= 99.9 ? 2 : 1));
  const cvarByFlag = creditRowsByFlag();

  // Drill-Datenquelle: Positionen des gewaehlten Portfolios (mit ISSUER/__LOSS/RATINGres).
  try {
    const portRows = (appState.getAllPortfolioData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === String(port).trim());
    crTailDrill.setData(buildPositionLoss(portRows, port));
  } catch (e) { console.warn('[CreditTail] drill data failed', e); }

  // Je pd_flag eine Serie (Historic/Market/Market adjusted); nur Historic initial sichtbar.
  // stepsByDs[dsIndex][barIndex] = Drill-Schritt (ausfallende Emittenten im Quantil-Szenario).
  const lineMap = [];
  const stepsByDs = [];
  const datasets = CR_FLAG_SERIES.map((f, di) => {
    const sorted = byFlag[f.key].slice().sort((a, b) => Number(a.QUANTIL) - Number(b.QUANTIL));
    let data;
    let steps;
    if (sorted.length) {
      const nearest = (q) => sorted.reduce((best, r) => (Math.abs(Number(r.QUANTIL) - q) < Math.abs(Number(best.QUANTIL) - q) ? r : best), sorted[0]);
      const picks = targets.map(q => nearest(q));
      data = picks.map(row => (sumNav > 0 ? Number(row.LOSS) / sumNav * 100 : 0));
      steps = picks.map(row => lossDefaultStep(issuersFromRank(row?.ISSUER_RANK)));
    } else {
      data = targets.map(() => null);
      steps = targets.map(() => null);
    }
    stepsByDs.push(steps);
    const rr = cvarByFlag[f.key] || {};
    const varPct = Math.abs(num(rr.VaR_rel)) * 100;
    const esPct = Math.abs(num(rr.ES_rel)) * 100;
    // "Market adjusted" (norm) in hellerem Blau/Rot -> von Historic unterscheidbar.
    const isNorm = f.key === 'norm';
    const barBlue = isNorm ? BAR_BLUE_LIGHT : BAR_BLUE;
    const barRed = isNorm ? BAR_RED_LIGHT : BAR_RED;
    const lineCol = isNorm ? LINE_BLUE_LIGHT : LINE_BLUE;
    const colors = data.map(v => (v != null && v >= varPct ? barRed : barBlue));
    const lines = [];
    if (Number.isFinite(varPct)) lines.push({ at: varPct, color: lineCol, width: 2 });
    if (Number.isFinite(esPct)) lines.push({ at: esPct, color: lineCol, width: 2, dash: [6, 4] });
    lineMap.push(lines);
    return { label: f.label, data, backgroundColor: colors, borderColor: colors, maxBarThickness: 30, hidden: di !== 0 };
  });

  // VaR/ES je Flag (% vom NAV) fuer die TSI/MSD-Baender.
  const _bandOf = (flag) => { const rr = cvarByFlag[flag] || {}; return { varPct: Math.abs(num(rr.VaR_rel)) * 100, esPct: Math.abs(num(rr.ES_rel)) * 100 }; };
  const ratingBand = _bandOf('rating');
  const normBand = _bandOf('norm');

  const col = _crChartColor();
  canvas.width = Math.max(320, Math.floor((canvas.parentElement?.clientWidth || 540) - 28)); canvas.height = 300;
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: [_crBandsPlugin, _crLinePlugin],
    data: { labels, datasets },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: col,
      // Drill wird per RECHTSKLICK ausgeloest (_bindCrTailContextDrill), damit Hovern
      // das Menue nicht ungewollt oeffnet.
      plugins: {
        legend: {
          display: true, position: 'top',
          labels: {
            color: col, boxWidth: 12, font: { size: 11 },
            // Zusatz-Eintraege TSI/MSD zum Ein-/Ausschalten der Baender.
            generateLabels: (ch) => {
              const items = window.Chart.defaults.plugins.legend.labels.generateLabels(ch);
              items.push({ text: 'TSI', fillStyle: 'rgba(150,110,220,0.9)', strokeStyle: 'rgba(150,110,220,0.9)', hidden: !ch.$showTSI, datasetIndex: -1, $band: 'tsi' });
              items.push({ text: 'MSD', fillStyle: 'rgba(230,170,60,0.9)', strokeStyle: 'rgba(230,170,60,0.9)', hidden: !ch.$showMSD, datasetIndex: -1, $band: 'msd' });
              return items;
            },
          },
          onClick: (e, item, legend) => {
            const ch = legend.chart;
            if (item.$band === 'tsi') { ch.$showTSI = !ch.$showTSI; ch.update(); return; }
            if (item.$band === 'msd') { ch.$showMSD = !ch.$showMSD; ch.update(); return; }
            _crLegendOnClick('h')(e, item, legend);
          },
        },
        subtitle: { display: true, text: 'Loss > VaR red · VaR (solid) · ES (dashed) · TSI/MSD bands', color: col, align: 'start', font: { size: 10 } },
        crLines: { h: lineMap[0] },
        tooltip: { callbacks: { title: (c) => `Quantile ${labels[c[0].dataIndex]}`, label: (c) => `${c.dataset.label}: ${Number(c.parsed.y).toFixed(2)}% of NAV` } },
      },
      scales: {
        x: { title: { display: true, text: 'Quantile', color: col }, ticks: { color: col }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Loss (% of NAV)', color: col }, ticks: { color: col } },
      },
    },
  });
  chart.$crLineMap = lineMap;
  chart.$crTailSteps = stepsByDs;
  chart.$bandVals = { ratingVar: ratingBand.varPct, ratingEs: ratingBand.esPct, normEs: normBand.esPct };
  chart.$showTSI = true;   // Standard: Baender an (per Legende TSI/MSD aus-/einschaltbar)
  chart.$showMSD = true;
  try { chart.update(); } catch {}
  window.crTailZoomChart = chart;
  _bindCrTailCanvasLeave(canvas);
  _bindCrTailContextDrill(canvas);
}

// ── TOP TAIL DRIVERS: Emittenten mit dem groessten Beitrag zum Tail-Verlust ──
// Zwei GETRENNTE Ansichten untereinander: Historic (pd_flag RATING) und Market adjusted
// (pd_flag NORM). Metrik "Verlustanteil im Tail": Summe des Emittenten-Verlusts
// (NOTIONAL x LGD-Rate) ueber die Tail-Szenarien (Quantil >= VaR-Konfidenzquantil) des
// jeweiligen pd_flags, in denen er ausfaellt; je PD auf 100 % normiert. Nur Top 8.
// Credit-Palette (Purpur): Historic dunkelbasis, Market adjusted hell.
const CR_TAIL_VIEWS = [
  { flag: 'RATING', chartId: 'crTailContribChartHist', tableId: 'crTailContribTableHist', title: 'Top tail drivers — Historic', fill: 'rgba(122,92,145,0.85)', border: 'rgba(122,92,145,0.95)' },
  { flag: 'NORM',   chartId: 'crTailContribChartNorm', tableId: 'crTailContribTableNorm', title: 'Top tail drivers — Market adjusted', fill: 'rgba(178,152,200,0.85)', border: 'rgba(178,152,200,0.95)' },
];

// Top-8-Emittenten nach Tail-Verlustanteil fuer EIN pd_flag.
// Exportiert: auch die HOME-Overview-Kachel nutzt diese Logik (Top tail drivers).
export function crTailTopForFlag(flag, issuerLoss, issuerRating, allLoss, confQ) {
  const rows = allLoss.filter(r => String(r?.pd_flag ?? '').toUpperCase() === flag);
  let tail = rows.filter(r => Number(r.QUANTIL) >= confQ);
  if (tail.length < 3) {
    const sorted = rows.slice().sort((a, b) => Number(b.LOSS) - Number(a.LOSS));
    tail = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.05)));
  }
  const c = new Map();
  for (const s of tail) {
    for (const nm of issuersFromRank(s.ISSUER_RANK)) {
      const key = String(nm).trim().toLowerCase();
      c.set(key, (c.get(key) || 0) + (issuerLoss.get(key)?.loss || 0));
    }
  }
  const total = [...c.values()].reduce((a, b) => a + b, 0);
  return [...c.entries()]
    .map(([k, v]) => ({ name: issuerLoss.get(k)?.name || k, rating: issuerRating.get(k) || '', pct: total > 0 ? v / total * 100 : 0 }))
    .filter(it => it.pct > 0)
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 8);
}

export function renderCreditTailContributors() {
  const present = CR_TAIL_VIEWS.some(v => document.getElementById(v.chartId) || document.getElementById(v.tableId));
  if (!present) return;

  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();

  // Verlust-bei-Ausfall + Rating je Emittent (PD-unabhaengig: LGD aus EAD).
  const portRows = (appState.getAllPortfolioData?.() || [])
    .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === port);
  const issuerLoss = new Map();     // key -> { name, loss }
  const issuerRating = new Map();   // key -> rating
  for (const r of buildPositionLoss(portRows, port)) {
    const name = String(r?.ISSUER ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = issuerLoss.get(key) || { name, loss: 0 };
    cur.loss += Number(r.__LOSS) || 0;
    issuerLoss.set(key, cur);
    if (!issuerRating.get(key)) issuerRating.set(key, String(r?.RATINGres ?? r?.RATING ?? '').trim());
  }

  const confQ = getRunConfQuantil();
  const allLoss = (appState.getAllLossData?.() || []).filter(r => String(r?.port_name ?? '') === port);

  for (const v of CR_TAIL_VIEWS) {
    const top = crTailTopForFlag(v.flag, issuerLoss, issuerRating, allLoss, confQ);
    renderCrTailContribChart(document.getElementById(v.chartId), v.chartId, top, v.title, { fill: v.fill, border: v.border });
    const tblEl = document.getElementById(v.tableId);
    if (tblEl) {
      if (!top.length) {
        tblEl.innerHTML = '<table class="conc-report-table"><tbody><tr><td>No tail data.</td></tr></tbody></table>';
      } else {
        tblEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>#</th><th>Issuer</th><th style="text-align:right;">Contribution</th><th>Rating</th></tr></thead><tbody>${
          top.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name)}</td><td style="text-align:right;">${it.pct.toFixed(1)} %</td><td>${esc(it.rating)}</td></tr>`).join('')
        }</tbody></table>`;
      }
    }
  }
}

function renderCrTailContribChart(canvas, winKey, items, title, colors) {
  if (!canvas || !window.Chart) return;
  _destroyCrChart(winKey);
  if (!items || !items.length) return;

  // Feste Bitmap-Groesse -> malt auch bei verstecktem Panel (Report-Erfassung).
  canvas.width = 560; canvas.height = 260;
  const bodyCss = getComputedStyle(document.body);
  const col = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const font = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const c = colors?.fill || 'rgba(122,92,145,0.85)';
  const cb = colors?.border || 'rgba(122,92,145,0.95)';

  window[winKey] = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: {
      labels: items.map(it => it.name),
      datasets: [{ label: 'Contribution to tail loss (%)', data: items.map(it => +it.pct.toFixed(1)), backgroundColor: c, borderColor: cb, maxBarThickness: 22 }],
    },
    options: {
      responsive: false, maintainAspectRatio: false, indexAxis: 'y', animation: false,
      layout: { padding: { right: 44 } },
      plugins: {
        legend: { display: false },
        title: { display: true, text: title, color: col, font: { family: font, size: 12, weight: 'bold' } },
        datalabels: window.ChartDataLabels ? {
          anchor: 'end', align: 'right', clamp: true, color: col, font: { family: font, size: 10 },
          formatter: (v) => `${Number(v).toFixed(0)}%`,
        } : undefined,
        tooltip: { callbacks: { label: (ctx) => `${Number(ctx.parsed.x).toFixed(1)} %` } },
      },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: 'Contribution to tail loss (%)', color: col, font: { family: font } }, ticks: { color: col, font: { family: font }, callback: (v) => `${v}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { ticks: { color: col, font: { family: font }, autoSkip: false }, grid: { display: false } },
      },
    },
  });
}

// Headline-CVaR-Zeile: Historic VaR (pd_flag=rating; Fallback erste Zeile).
function currentCvarRow() {
  const rows = appState.getCvarData?.() || [];
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.find(r => String(r.pd_flag ?? '').toLowerCase() === 'rating') || rows[0];
}

// Credit-Warn-/Limit-Schwellen je Metrik (Fraktion); Fallback = App-Defaults.
const CR_DEFAULTS = {
  CVAR: { yellow: -0.050, red: -0.052 },
  // TSI/MSD sind RELATIVE Kennzahlen: TSI = (ES-VaR)/VaR, MSD = (adjES-histES)/histES.
  // Defaults entsprechen den alten %-Punkt-Schwellen bei typischem ES/VaR-Niveau (~5%).
  TSI:  { yellow: 0.20, red: 0.30 },
  MSD:  { yellow: 0.20, red: 0.60 },
};
// Schwellen wie die CVaR-Ampeln (CVaR.js) lesen: DB-Felder heissen
// yellow_threshold/red_threshold (CustomerCreditRiskThresholdSetting);
// alte Prozentwerte (>1) auf Brueche normalisieren, Ergebnis als BETRAG.
function crThreshold(code) {
  const r = appState.getCustomerCreditRiskThreshold?.(code);
  const d = CR_DEFAULTS[code] || CR_DEFAULTS.CVAR;
  let y = Number(r?.yellow_threshold ?? r?.yellow_loss_limit);
  let rd = Number(r?.red_threshold ?? r?.red_loss_limit);
  if (!Number.isFinite(y)) y = d.yellow;
  if (!Number.isFinite(rd)) rd = d.red;
  if (Math.abs(y) > 1 || Math.abs(rd) > 1) { y /= 100; rd /= 100; }
  return { yellow: Math.abs(y), red: Math.abs(rd) };
}
// Ampel exakt wie CVaR.js (trafficLightStateForCvar/-Tsi/-Msd): Betrag des
// Werts vs. Betrag der Schwellen — die Verlustseite ist negativ, das
// Vorzeichen traegt keine Information.
function trafficState(valFraction, th) {
  const v = Math.abs(Number(valFraction));
  if (!Number.isFinite(v)) return null;
  if (v >= th.red) return 'red';
  if (v >= th.yellow) return 'yellow';
  return 'green';
}

// pd_flag -> erste Zeile (rating / market / norm). rowsIn: optionale CVaR-Zeilen
// (z.B. von der HOME-Overview), sonst die des gewaehlten Portfolios.
function creditRowsByFlag(rowsIn = null) {
  const rows = rowsIn || appState.getCvarData?.() || [];
  const byFlag = {};
  for (const r of rows) { const f = String(r?.pd_flag ?? '').toLowerCase(); if (f && !byFlag[f]) byFlag[f] = r; }
  return byFlag;
}

function fmtEur(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  const mn = Math.abs(n) / 1e6;
  const dec = mn >= 100 ? 0 : mn >= 10 ? 1 : 2;
  return `EUR ${Number(mn.toFixed(dec)).toLocaleString('en-US')} mn`;
}
function fmtEurSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : '-'}${fmtEur(Math.abs(n))}`;
}
function fmtPpSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : '-'}${Number(Math.abs(n).toFixed(3))}%`;
}
// Credit-rel ist eine Fraktion (-0.05) -> Prozent fuer die Anzeige.
function fmtRelPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  return `${Number((n * 100).toFixed(3))}%`;
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function selectedPortCandidates() {
  const set = new Set();
  const add = (v) => { const s = String(v ?? '').trim().toUpperCase(); if (s) set.add(s); };
  add(appState.getSelectedPortTableName?.());
  const dd = document.getElementById('createdPortDropdown0');
  add(dd?.value);
  if (dd && dd.selectedIndex >= 0) add(dd.options?.[dd.selectedIndex]?.textContent);
  return [...set];
}
function lastHistoryRow() {
  const rows = appState.getPortfolioHistoryData?.() || [];
  if (!Array.isArray(rows) || !rows.length) return null;
  const cands = selectedPortCandidates();
  const match = (pn) => {
    const p = String(pn ?? '').trim().toUpperCase();
    if (!p) return false;
    return cands.some((c) => c === p || c.includes(p) || p.includes(c));
  };
  const filtered = cands.length ? rows.filter((r) => match(r.port_name)) : [];
  const use = filtered.length ? filtered : rows.slice();
  return use.slice().sort((a, b) => new Date(a.DATE) - new Date(b.DATE)).at(-1) || null;
}

// Datenmodell (Karten + Limit) — Basis fuer HTML-Render und PDF-Composed-Renderer.
// rowsOverride: die HOME-Overview uebergibt ihre eigenen CVaR-Zeilen, damit ihre
// Kennzahlen garantiert zum Overview-Portfolio gehoeren.
export function getCreditDashboardModel(rowsOverride = null) {
  const byFlag = creditRowsByFlag(rowsOverride);
  const row = byFlag.rating || byFlag[Object.keys(byFlag)[0]] || null;   // Historic VaR
  const normRow = byFlag.norm || null;

  const cvarTh = crThreshold('CVAR');
  const varState = row ? trafficState(num(row.VaR_rel), cvarTh) : null;
  const esState = row ? trafficState(num(row.ES_rel), cvarTh) : null;

  const hist = lastHistoryRow();
  const magDelta = (cur, last) => (Number.isFinite(cur) && Number.isFinite(last)) ? Math.abs(cur) - Math.abs(last) : null;
  const lastVarAbs = num(hist?.C_VaR);
  const lastEsAbs = num(hist?.C_ES);
  const lastVarRelPct = num(hist?.C_VaR_PCT) * 100;
  const lastEsRelPct = num(hist?.C_ES_PCT) * 100;
  const curVarRelPct = num(row?.VaR_rel) * 100;
  const curEsRelPct = num(row?.ES_rel) * 100;

  // TSI = (Historic ES - Historic VaR) / Historic VaR (rating).
  // MSD = (Adjusted ES - Historic ES) / Historic ES — relative Form.
  const esHist = row ? num(row.ES_rel) : NaN;
  const varHist = row ? num(row.VaR_rel) : NaN;
  const esAdj = normRow ? num(normRow.ES_rel) : NaN;
  const tsiVal = (row && varHist !== 0) ? (esHist - varHist) / varHist : NaN;
  const msdVal = (row && normRow && esHist !== 0) ? (esAdj - esHist) / esHist : NaN;
  const tsiTh = crThreshold('TSI');
  const msdTh = crThreshold('MSD');
  const tsiState = Number.isFinite(tsiVal) ? trafficState(tsiVal, tsiTh) : null;
  const msdState = Number.isFinite(msdVal) ? trafficState(msdVal, msdTh) : null;

  // Jede Kennzahl mit eigener Limitleiste (computeLimitModel je Wert + Schwelle).
  const cards = [
    { label: 'Normal Risk (VaR)', full: 'Value at Risk', abs: fmtEur(row?.VaR_abs), rel: fmtRelPct(row?.VaR_rel),
      dRel: magDelta(curVarRelPct, lastVarRelPct), dAbs: magDelta(num(row?.VaR_abs), lastVarAbs),
      desc: 'Credit VaR', state: varState, limit: computeLimitModel(row?.VaR_rel, cvarTh, varState) },
    { label: 'Extreme Risk (ES)', full: 'Expected Shortfall', abs: fmtEur(row?.ES_abs), rel: fmtRelPct(row?.ES_rel),
      dRel: magDelta(curEsRelPct, lastEsRelPct), dAbs: magDelta(num(row?.ES_abs), lastEsAbs),
      desc: 'beyond CVaR', state: esState, limit: computeLimitModel(row?.ES_rel, cvarTh, esState) },
    { label: 'Cluster Risk (TSI)', full: 'Tail Severity Indicator', abs: null, rel: fmtRelPct(tsiVal), dRel: null, dAbs: null,
      desc: '(ES - VaR) / VaR', state: tsiState, limit: Number.isFinite(tsiVal) ? computeLimitModel(tsiVal, tsiTh, tsiState) : null },
    { label: 'Market Stress (MSD)', full: 'Market Stress Divergence', abs: null, rel: fmtRelPct(msdVal), dRel: null, dAbs: null,
      desc: '(Adjusted - Historic ES) / Historic ES', state: msdState, limit: Number.isFinite(msdVal) ? computeLimitModel(msdVal, msdTh, msdState) : null },
  ];
  cards.forEach((c) => { c.relDeltaStr = fmtPpSigned(c.dRel); c.absDeltaStr = fmtEurSigned(c.dAbs); });

  return { cards, hasRow: !!row };
}

// Limit-Modell je Kennzahl: Auslastung = |Wert%| / Rot-Limit%. th aus der jeweiligen
// Credit-Schwelle (CVAR/TSI/MSD). Risk limit = Rot-Schwelle %, Buffer = Rest bis Limit.
function computeLimitModel(valueFraction, th, state) {
  const redPct = Math.abs(th.red) * 100;
  const yellowPct = Math.abs(th.yellow) * 100;
  const curPct = Math.abs(num(valueFraction)) * 100;
  if (!Number.isFinite(curPct) || !(redPct > 0)) return null;
  const util = curPct / redPct;
  const yellowRatio = Math.min(100, (yellowPct / redPct) * 100);
  return {
    redPct, yellowPct, curPct, util, yellowRatio, state,
    utilStr: `${(util * 100).toFixed(1)}%`,
    limitRelStr: `${Number(redPct.toFixed(2))}%`,
    bufferRelStr: `${Number((redPct - curPct).toFixed(2))}%`,
  };
}

export function renderCreditRiskDashboard() {
  bindListeners();

  const host = document.getElementById('crDashKpi');
  const introEl = document.getElementById('crDashIntro');
  const tblEl = document.getElementById('crDashKpiTable');
  if (!host && !tblEl) return;

  const { cards } = getCreditDashboardModel();

  if (introEl) introEl.textContent = 'Current credit risk position for the selected portfolio.';

  if (host) {
    // Pro Kennzahl eine Zeile: KPI-Karte + eigene Limitleiste (untereinander).
    host.innerHTML = cards.map((c) => {
      const amp = `mr-amp--${c.state || 'neutral'}`;
      const relDeltaHtml = Number.isFinite(c.dRel) ? `<div class="mr-kpi-card__delta">${esc(c.relDeltaStr)}</div>` : '';
      const absDeltaHtml = Number.isFinite(c.dAbs) ? `<div class="mr-kpi-card__delta mr-kpi-card__delta--sub">${esc(c.absDeltaStr)}</div>` : '';
      const absHtml = c.abs ? `<div class="mr-kpi-card__sub">${esc(c.abs)}</div>` : '';
      const cardHtml = `
        <div class="mr-kpi-card">
          <div class="mr-kpi-card__label">${esc(c.label)}</div>
          <div class="mr-kpi-card__value">${esc(c.rel)}<span class="mr-amp-dot ${amp}"></span></div>
          ${c.full ? `<div class="mr-kpi-card__full">${esc(c.full)}</div>` : ''}
          ${relDeltaHtml}
          ${absHtml}
          ${absDeltaHtml}
        </div>`;
      return `<div class="cr-metric-row">${cardHtml}<div class="cr-metric-limit">${limitBarHtml(c.limit)}</div></div>`;
    }).join('');
  }

  if (tblEl) {
    const rows = [];
    cards.forEach((c) => { rows.push([c.label, c.rel]); if (c.abs) rows.push([`${c.label} (abs)`, c.abs]); });
    tblEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
    }</tbody></table>`;
  }
}

// Loss-Charts (Histogramm + Tail, Tail-Zoom) — jetzt im Overview-Panel (panel-credit),
// nicht im Dashboard. Rendert bei Overview-Open und wenn die Loss-Daten eintreffen.
export function renderCreditOverviewCharts() {
  try { renderCreditLossDist(); } catch (e) { console.warn('[CreditOverview] loss dist failed', e); }
  try { renderCreditTailZoom(); } catch (e) { console.warn('[CreditOverview] tail zoom failed', e); }
  try { renderCreditTailContributors(); } catch (e) { console.warn('[CreditOverview] tail contributors failed', e); }
  // KPI-Band der Loss-Distribution-Seite (Report) aus dem Credit-Dashboard-Modell spiegeln.
  try {
    const tblEl = document.getElementById('crLossKpiTable');
    if (tblEl) {
      const { cards } = getCreditDashboardModel();
      const rows = [];
      (cards || []).forEach((c) => { rows.push([c.label, c.rel]); if (c.abs) rows.push([`${c.label} (abs)`, c.abs]); });
      tblEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
        rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
      }</tbody></table>`;
    }
  } catch (e) { console.warn('[CreditOverview] kpi band failed', e); }
}

function limitBarHtml(m) {
  if (!m) return '<div class="mr-dash-intro">No limit data.</div>';
  const amp = `mr-amp--${m.state || 'neutral'}`;
  const fillW = Math.min(100, m.util * 100);
  return `
    <div class="mr-limit">
      <div class="mr-limit__head">
        <span class="mr-limit__title">Limit utilization</span>
        <span class="mr-limit__util ${amp}">${(m.util * 100).toFixed(1)}%</span>
      </div>
      <div class="mr-limit__bar">
        <div class="mr-limit__zone mr-limit__zone--green" style="left:0;width:${m.yellowRatio}%"></div>
        <div class="mr-limit__zone mr-limit__zone--amber" style="left:${m.yellowRatio}%;width:${100 - m.yellowRatio}%"></div>
        <div class="mr-limit__fill mr-limit__fill--${m.state || 'neutral'}" style="width:${fillW}%"></div>
      </div>
      <div class="mr-limit__scale">
        <span>0%</span>
        <span>Warning ${Number(m.yellowPct.toFixed(2))}%</span>
        <span>Limit ${Number(m.redPct.toFixed(2))}%</span>
      </div>
      <div class="mr-limit__cards">
        <div class="mr-limit-card">
          <div class="mr-limit-card__lbl">Risk limit</div>
          <div class="mr-limit-card__val">${esc(m.limitRelStr)}</div>
          <div class="mr-limit-card__sub">threshold</div>
        </div>
        <div class="mr-limit-card">
          <div class="mr-limit-card__lbl">Buffer</div>
          <div class="mr-limit-card__val">${esc(m.bufferRelStr)}</div>
          <div class="mr-limit-card__sub">remaining to limit</div>
        </div>
      </div>
    </div>`;
}

function bindListeners() {
  if (_listenersBound) return;
  _listenersBound = true;
  document.addEventListener('panel:opened', (e) => {
    const id = e?.detail?.panelId;
    if (id === 'panel-credit-dashboard') {
      requestAnimationFrame(() => renderCreditRiskDashboard());
    } else if (id === 'panel-credit') {
      // Overview-Panel: die Loss-Charts (nach den Tabellen) rendern.
      requestAnimationFrame(() => renderCreditOverviewCharts());
    }
  });
  // Loss-Charts nachziehen, wenn die Histogramm-/Loss-Daten (evtl. nach dem ersten
  // Render) eintreffen.
  document.addEventListener('losshist:ready', () => { try { renderCreditOverviewCharts(); } catch {} });
}

bindListeners();
