'use strict';

// Credit-Risk-Dashboard analog zum Market-Risk-Dashboard: KPI-Karten (CVaR + ES CVaR)
// mit relativem Wert + Ampel + Deltas + absolutem Wert, plus Limit-Auslastungsleiste.
// Nutzt dieselben CSS-Klassen (mr-kpi-card / mr-limit / mr-amp) -> gleiches Aussehen.
// TSI / MSD folgen spaeter.

import { appState } from '../../../renderer.js';
import { fmtEurCompact } from '../../../utils/tableCellFormats.js';
import { sumNavForPort, buildPositionLoss, issuersFromRank, lossDefaultStep, lossDefaultStepRanked, getRunConfQuantil, creditVarEsForFlag } from './LossIssuer.js';
import { createContribDrill, scheduleHideConcMenu } from '../SummaryBreakdown.js';

// Drill-down fuer den Tail-Zoom-Chart: Klick auf ein Quantil -> Positionen der in diesem
// Szenario ausfallenden Emittenten (ISSUER_RANK), mit NAV + Loss + Rating. Gleiche Engine
// wie der Loss-Chart (LossIssuer); eigene Detail-/Menue-Container unter dem Tail-Chart.
const _crTailDrillCfg = {
  detailId: 'crTailDetail', titleId: 'crTailDetailTitle',
  tableId: 'crTailDetailTable', closeId: 'crTailDetailClose',
  menuId: 'crTailCardMenu', valueType: 'NAV', valueLabel: 'NAV',
  extraCol: { key: '__LOSS', label: 'Loss' },
  // Issuer + Rating als Info-Spalten: bei mehreren ausfallenden Emittenten je Szenario
  // ist so erkennbar, zu welchem Emittenten eine Position gehoert.
  infoCols: [{ key: 'ISSUER', label: 'Issuer' }, { key: 'RATINGres', label: 'Rating' }],
};
const crTailDrill = createContribDrill({ var: _crTailDrillCfg, es: _crTailDrillCfg });

// Eigene Drill-Instanzen je Tail-Zoom-Chart (Original + TSI/MSD-Panel) mit eigenen
// Detail-/Menue-Containern (Suffix), damit der Drill im jeweiligen Panel erscheint.
function _mkTailDrill(sfx) {
  const cfg = {
    detailId: `crTailDetail${sfx}`, titleId: `crTailDetailTitle${sfx}`,
    tableId: `crTailDetailTable${sfx}`, closeId: `crTailDetailClose${sfx}`,
    menuId: `crTailCardMenu${sfx}`, valueType: 'NAV', valueLabel: 'NAV',
    extraCol: { key: '__LOSS', label: 'Loss' },
    infoCols: [{ key: 'ISSUER', label: 'Issuer' }, { key: 'RATINGres', label: 'Rating' }],
  };
  return createContribDrill({ var: cfg, es: cfg });
}
const _crTailDrills = {
  crTailZoomChart: crTailDrill,
  crTailZoomChartTsi: _mkTailDrill('Tsi'),
  crTailZoomChartMsd: _mkTailDrill('Msd'),
};

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
      const chart = window[canvas.id];
      if (!chart) return;
      const drill = _crTailDrills[canvas.id] || crTailDrill;
      const el = (chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || [])[0];
      if (!el) { scheduleHideConcMenu(); return; }
      const steps = chart.$crTailSteps?.[el.datasetIndex] || chart.$crTailSteps?.[0] || [];
      const step = steps[el.index];
      if (!step) { scheduleHideConcMenu(); return; }
      drill.hover('var', { native: e }, [{ index: 0 }], [step]);
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
      const chart = window[canvas.id];
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

// Drill per RECHTSKLICK auf einen Top-Tail-Drivers-Balken (= Emittent) -> dessen Positionen.
// Steps je Balken = lossDefaultStep([issuer]) in chart.$crContribSteps. Rendert wie der Loss-Chart
// in crTailDrill/crTailDetail (gemeinsamer Detailbereich).
function _bindCrContribContextDrill(canvas) {
  if (!canvas || canvas.dataset.crContribCtxBound) return;
  canvas.dataset.crContribCtxBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    try {
      const chart = window[canvas.id];
      if (!chart) return;
      const el = (chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || [])[0];
      if (!el) { scheduleHideConcMenu(); return; }
      const step = chart.$crContribSteps?.[el.index];
      if (!step) { scheduleHideConcMenu(); return; }
      crTailDrill.hover('var', { native: e }, [{ index: 0 }], [step]);
    } catch {}
  });
}

// Drill per RECHTSKLICK auf einen Scatter-Punkt (= Emittent) -> dessen Positionen. Steps je Punkt
// = lossDefaultStep([issuer]) in chart.$crScatterSteps (Issuers-Dataset = Index 1).
function _bindCrScatterContextDrill(canvas) {
  if (!canvas || canvas.dataset.crScatterCtxBound) return;
  canvas.dataset.crScatterCtxBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    try {
      const chart = window[canvas.id];
      if (!chart) return;
      const el = (chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || []).find((x) => x.datasetIndex === 1);
      if (!el) { scheduleHideConcMenu(); return; }
      const step = chart.$crScatterSteps?.[el.index];
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
    // Referenzlinien zeichnen; die Labels werden GESAMMELT und ganz am Ende gezeichnet
    // (immer im Vordergrund, jede in eigener Zeile -> kein Ueberlappen von EL/VaR/ES).
    const vLabels = [];
    if (opts) {
      (opts.v || []).forEach(o => {
        const x = chart.scales.x.getPixelForValue(o.at);
        if (!Number.isFinite(x)) return;
        stroke(x, true, o);
        if (o.label) vLabels.push({ label: o.label, color: o.color || '#ccc', x });
      });
      (opts.h || []).forEach(o => { const y = chart.scales.y.getPixelForValue(o.at); if (Number.isFinite(y)) stroke(y, false, o); });
    }
    const ec = (opts && opts.ec) || chart.$ecArrow;
    // EC-Band + Tail-Risk-Schattierung nur, wenn die zugehoerige (Default/Historic) Serie eingeblendet ist.
    const _ecVisible = (chart.$ecDsIdx == null) || (typeof chart.isDatasetVisible !== 'function') || chart.isDatasetVisible(chart.$ecDsIdx);
    // Economic-Capital-Flaeche (violett) zwischen EL- und VaR-Linie. Die POSITION (ecMidX)
    // wird IMMER bestimmt, auch wenn die Flaeche 0 breit ist (EL/VaR im selben Bin) -> die
    // "Economic Capital"-Beschriftung verschwindet nie.
    let ecMidX = NaN, ecBandXa = NaN, ecBandXb = NaN;
    const ecBandY = area.top + (area.bottom - area.top) * 0.60;
    if (_ecVisible && ec && ec.elIdx >= 0 && ec.varIdx >= 0) {
      const x1 = chart.scales.x.getPixelForValue(ec.elIdx), x2 = chart.scales.x.getPixelForValue(ec.varIdx);
      if (Number.isFinite(x1) && Number.isFinite(x2)) {
        ecBandXa = Math.min(x1, x2); ecBandXb = Math.max(x1, x2);
        ecMidX = (ecBandXa + ecBandXb) / 2;
        if (ecBandXb - ecBandXa > 1) {   // Flaeche nur fuellen, wenn sichtbar breit
          ctx.save();
          ctx.fillStyle = 'rgba(150,110,220,0.20)';                     // Flaeche violett (wie TSI)
          ctx.fillRect(ecBandXa, area.top, ecBandXb - ecBandXa, area.bottom - area.top);
          ctx.restore();
        }
      }
    }
    // Tail-Risk-Bereich: rechts der VaR-Linie zart rot + "Tail Risk".
    let tailMidX = (area.left + area.right) / 2;
    if (_ecVisible && ec && ec.varIdx >= 0) {
      const xv = chart.scales.x.getPixelForValue(ec.varIdx);
      if (Number.isFinite(xv) && xv < area.right - 4) {
        tailMidX = (xv + area.right) / 2;
        ctx.save();
        ctx.fillStyle = 'rgba(220,70,70,0.08)';                       // ganz zartes Rot
        ctx.fillRect(xv, area.top, area.right - xv, area.bottom - area.top);
        ctx.textAlign = 'center';
        ctx.fillStyle = 'rgba(224,120,120,0.95)';                     // dezente rote Schrift
        ctx.font = 'bold 12px sans-serif';
        ctx.fillText('Tail', tailMidX, area.top + 20);
        ctx.fillText('Risk', tailMidX, area.top + 33);
        ctx.restore();
      }
    }
    // "Economic Capital" — WIRD IMMER GEZEICHNET (verschwindet nie):
    //  - passt der Text zwischen EL- und VaR-Linie -> dort hinein (2-zeilig, zentriert),
    //  - sonst unter "Tail Risk" + gestrichelter Strich auf die EC-Stelle (ecMidX).
    if (_ecVisible && Number.isFinite(ecMidX)) {
      ctx.save();
      ctx.font = 'bold 12px sans-serif'; ctx.textBaseline = 'alphabetic';
      const ecCol = 'rgba(180,145,238,0.98)';                          // violett (wie EC-Band)
      const ecTextW = Math.max(ctx.measureText('Economic').width, ctx.measureText('Capital').width);
      const bandW = (Number.isFinite(ecBandXa) && Number.isFinite(ecBandXb)) ? (ecBandXb - ecBandXa) : 0;
      if (bandW >= ecTextW + 8) {
        // Passt: zwischen EL und VaR (2-zeilig, zentriert).
        ctx.fillStyle = ecCol; ctx.textAlign = 'center';
        ctx.fillText('Economic', ecMidX, area.top + 28);
        ctx.fillText('Capital', ecMidX, area.top + 41);
      } else {
        // Passt nicht: unter "Tail Risk" + Leader-Strich auf die EC-Stelle.
        const ecY = area.top + 56;
        ctx.strokeStyle = 'rgba(180,145,238,0.9)'; ctx.lineWidth = 1; ctx.setLineDash([4, 3]);
        ctx.beginPath(); ctx.moveTo(tailMidX, ecY + 6); ctx.lineTo(ecMidX, ecBandY); ctx.stroke();
        ctx.setLineDash([]);
        ctx.fillStyle = ecCol;
        ctx.beginPath(); ctx.arc(ecMidX, ecBandY, 2.5, 0, Math.PI * 2); ctx.fill();
        ctx.textAlign = 'center';
        ctx.fillText('Economic', tailMidX, ecY);
        ctx.fillText('Capital', tailMidX, ecY + 13);
      }
      ctx.restore();
    }
    // OBERHALB der Plotflaeche (reservierte Zone = layout.padding.top), auf dem Canvas
    // gezeichnet -> skaliert mit dem Chart, ragt NICHT in den Plot:
    //   links  = EL/VaR/ES-Reihe,
    //   rechts = Serien-Legende (Historic/Market/Market adjusted), gestapelt, klickbar.
    // EL/VaR/ES OBERHALB der Plotflaeche: bevorzugt ZENTRIERT ueber der jeweiligen Linie.
    // Wuerden sich zwei Labels ueberlappen (Linien zu nah), Fallback auf eine Reihe
    // nebeneinander (von links).
    const SHOW_LOSS_LINE_LABELS = true;
    if (SHOW_LOSS_LINE_LABELS && vLabels.length) {
      ctx.save();
      ctx.font = 'bold 11px sans-serif'; ctx.textBaseline = 'middle';
      const y = 13;
      // Zentren an den Linien, in die Plotbreite geklemmt.
      const spans = vLabels
        .filter((l) => Number.isFinite(l.x))
        .map((l) => {
          const w = ctx.measureText(l.label).width;
          const cx = Math.max(area.left + w / 2 + 1, Math.min(area.right - w / 2 - 1, l.x));
          return { l, cx, w, left: cx - w / 2, right: cx + w / 2 };
        })
        .sort((a, b) => a.left - b.left);
      let overlap = spans.length !== vLabels.length;
      for (let i = 1; !overlap && i < spans.length; i++) {
        if (spans[i].left < spans[i - 1].right + 4) overlap = true;
      }
      if (!overlap) {
        // Ueber den Linien, zentriert.
        ctx.textAlign = 'center';
        spans.forEach((s) => { ctx.fillStyle = s.l.color; ctx.fillText(s.l.label, s.cx, y); });
      } else {
        // Fallback: Reihe nebeneinander von links (farbiger Marker + Text).
        ctx.textAlign = 'left';
        const sw = 9, gap = 5, itemGap = 16;
        let x = area.left + 2;
        vLabels.forEach((l) => {
          ctx.fillStyle = l.color;
          ctx.fillRect(x, y - sw / 2, sw, sw);
          x += sw + gap;
          ctx.fillText(l.label, x, y);
          x += ctx.measureText(l.label).width + itemGap;
        });
      }
      ctx.restore();
    }
    // Serien-Legende (Historic/Market/Market adjusted) AUSGEBLENDET (Code bleibt erhalten).
    const SHOW_SERIES_LEGEND = false;
    if (SHOW_SERIES_LEGEND) {
      const dss = chart.data.datasets || [];
      const boxes = [];
      ctx.save();
      ctx.font = '11px sans-serif'; ctx.textBaseline = 'middle'; ctx.textAlign = 'left';
      const lsw = 10, lgap = 5, rowH = 15;
      let maxTw = 0;
      dss.forEach((d) => { maxTw = Math.max(maxTw, ctx.measureText(String(d.label ?? '')).width); });
      const boxW = lsw + lgap + maxTw;
      const bx = area.right - boxW - 6;
      const tCol = chart.$legendTextCol || 'rgba(220,220,220,0.95)';
      dss.forEach((d, i) => {
        const yy = area.top + 8 + i * rowH;
        const vis = (typeof chart.isDatasetVisible === 'function') ? chart.isDatasetVisible(i) : !d.hidden;
        ctx.fillStyle = vis ? (d._legendColor || '#888') : 'rgba(140,140,140,0.4)';
        ctx.fillRect(bx, yy - lsw / 2, lsw, lsw);
        ctx.fillStyle = vis ? tCol : 'rgba(150,150,150,0.5)';
        ctx.fillText(String(d.label ?? ''), bx + lsw + lgap, yy);
        if (!vis) {
          const w = ctx.measureText(String(d.label ?? '')).width;
          ctx.strokeStyle = 'rgba(150,150,150,0.5)'; ctx.lineWidth = 1;
          ctx.beginPath(); ctx.moveTo(bx + lsw + lgap, yy); ctx.lineTo(bx + lsw + lgap + w, yy); ctx.stroke();
        }
        boxes.push({ x: bx - 2, y: yy - rowH / 2, w: boxW + 6, h: rowH, ds: i });
      });
      ctx.restore();
      chart.$legendHit = boxes;
    } else { chart.$legendHit = []; }
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
// Serie "Market": eigene Palette (nicht Blau wie Historic) -> Gruen fuer die
// normalen Saeulen, Violett fuer die ES-Saeulen (>= VaR).
const LINE_GREEN = 'rgba(40,150,85,0.95)';
const BAR_GREEN = 'rgba(70,175,110,0.85)';
const BAR_VIOLET = 'rgba(150,110,220,0.85)';
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
function renderCreditLossDist(canvasId = 'crLossDistChart', defaultKey = 'rating') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;
  _destroyCrChart(canvasId);
  const port = appState.getSelectedPortTableName?.();
  const all = (appState.getLossHistogram?.() || []).filter(r => String(r.port_name) === String(port));
  if (!all.length) { canvas.style.display = 'none'; return; }

  // Nach pd_flag gruppieren; gemeinsame Bins -> Labels aus einer Basis-Serie (rating bevorzugt).
  const byFlag = { rating: [], market: [], norm: [] };
  all.forEach(r => { const f = String(r.pd_flag || '').toLowerCase(); if (byFlag[f]) byFlag[f].push(r); });
  const baseFlag = byFlag.rating.length ? 'rating' : byFlag.market.length ? 'market' : 'norm';
  let base = byFlag[baseFlag].slice().sort((a, b) => Number(a.bin_center) - Number(b.bin_center));
  if (!base.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  // x-Achse GENAU am letzten Balken der DEFAULT-sichtbaren Serie enden lassen: leere Bins
  // rechts abschneiden -> der Chart nutzt den Platz, und das Economic-Capital-Band/Label
  // (laeuft bis zum rechten Rand) wird wieder sichtbar. NUR Graphik, keine Datenaenderung.
  // (Blendet man eine Serie mit laengerem Tail ein, wird deren Ueberhang mitgekuerzt.)
  {
    const visFlag = (byFlag[defaultKey] && byFlag[defaultKey].length) ? defaultKey : baseFlag;
    const nz = new Set();
    byFlag[visFlag].forEach(r => { if (Number(r.count) > 0) nz.add(Number(r.bin_center)); });
    let lastIdx = -1;
    base.forEach((r, i) => { if (nz.has(Number(r.bin_center))) lastIdx = i; });
    if (lastIdx >= 0 && lastIdx + 1 < base.length) base = base.slice(0, lastIdx + 1);
  }

  const labels = base.map(r => (Number(r.bin_center) * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }));
  const cvarByFlag = creditRowsByFlag();
  // Index des Bins, DURCH DAS die VaR/ES-Linie geht (naechstes Bin-Zentrum zum Wert).
  const nearestIdx = (pct) => { let idx = 0, best = Infinity; base.forEach((r, i) => { const d = Math.abs(Number(r.bin_center) * 100 - pct); if (d < best) { best = d; idx = i; } }); return idx; };

  // EL-Linie + Economic-Capital-Flaeche passend zur Default-Serie: rating -> historic (PD),
  // norm -> market adjusted (PD_M_norm), market -> market (PD_M). VaR aus der gleichen Serie.
  const _elCfg = ({
    rating: { pdField: 'PD',        flag: 'rating' },
    market: { pdField: 'PD_M',      flag: 'market' },
    norm:   { pdField: 'PD_M_norm', flag: 'norm' },
  })[defaultKey] || { pdField: 'PD', flag: 'rating' };
  const _elPct = (() => {
    const rr = cvarByFlag[_elCfg.flag] || {};
    const vAbs = Math.abs(num(rr.VaR_abs)), vRel = Math.abs(num(rr.VaR_rel));
    const b = (vRel > 0) ? vAbs / vRel : NaN;
    if (!Number.isFinite(b)) return NaN;
    let elAbs = 0;
    for (const r of (appState.getAllEADData?.() || [])) {
      if (String(r.port_name) !== String(port)) continue;
      if (String(r.pd_flag || '').toUpperCase() !== 'RATING') continue;   // Basiszeilen (haben alle PD-Varianten)
      const lgd = Number(r.LGD), pd = Number(r[_elCfg.pdField]);
      if (Number.isFinite(lgd) && Number.isFinite(pd)) elAbs += lgd * pd;
    }
    return (elAbs / b) * 100;
  })();
  const _elIdx = Number.isFinite(_elPct) ? nearestIdx(_elPct) : -1;
  const _defVarPct = Math.abs(num((cvarByFlag[_elCfg.flag] || {}).VaR_rel)) * 100;
  const _defVarIdx = Number.isFinite(_defVarPct) ? nearestIdx(_defVarPct) : -1;
  // Prozent-Label (de-DE) fuer die EL/VaR/ES-Linienbeschriftung, z.B. "0,03 %".
  const pctLbl = (v) => Number.isFinite(v) ? `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '';

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
    // Farben je Serie: Historic = Blau/Rot, "Market adjusted" (norm) = helleres
    // Blau/Rot, "Market" = Gruen (normal) / Violett (ES-Saeulen >= VaR).
    // barBlue = Saeule unter VaR, barRed = Saeule ab VaR (ES-Bereich).
    let barBlue, barRed, lineCol;
    if (f.key === 'market') {
      barBlue = BAR_GREEN; barRed = BAR_VIOLET; lineCol = LINE_GREEN;
    } else if (f.key === 'norm') {
      barBlue = BAR_BLUE_LIGHT; barRed = BAR_RED_LIGHT; lineCol = LINE_BLUE_LIGHT;
    } else {
      barBlue = BAR_BLUE; barRed = BAR_RED; lineCol = LINE_BLUE;
    }
    const colors = base.map((r, i) => (i >= varIdx ? barRed : barBlue));
    const lines = [];
    if (Number.isFinite(varPct)) lines.push({ at: nearestIdx(varPct), color: '#f08c00', width: 2, label: `VaR ${pctLbl(varPct)}` });
    if (Number.isFinite(esPct)) lines.push({ at: nearestIdx(esPct), color: '#e03131', width: 2, dash: [6, 4], label: `ES ${pctLbl(esPct)}` });
    // EL-Linie nur bei der Default-Serie dieses Charts (rating bzw. norm/market adjusted).
    if (f.key === defaultKey && _elIdx >= 0) lines.unshift({ at: _elIdx, color: 'rgba(235,235,235,0.92)', width: 1.5, label: `EL ${pctLbl(_elPct)}` });
    lineMap.push(lines);
    // Drill-Steps je Bin: das Quantil-Szenario dieser Serie, dessen Loss der Bin-Hoehe
    // am naechsten kommt -> dessen ausfallende Emittenten (ISSUER_RANK).
    const flagLoss = (lossByFlag[f.key] && lossByFlag[f.key].length) ? lossByFlag[f.key] : lossByFlag.rating;
    const nearestLossRow = (binPct) => {
      if (!flagLoss?.length || !(sumNav > 0)) return null;
      return flagLoss.reduce((best, r) =>
        (Math.abs(Number(r.LOSS) / sumNav * 100 - binPct) < Math.abs(Number(best.LOSS) / sumNav * 100 - binPct) ? r : best), flagLoss[0]);
    };
    const steps = base.map(r => { const row = nearestLossRow(Number(r.bin_center) * 100); return row ? lossDefaultStepRanked(row.ISSUER_RANK) : null; });
    stepsByDs.push(steps);
    return { label: f.label, data, backgroundColor: colors, borderColor: colors, maxBarThickness: 22, hidden: f.key !== defaultKey, _legendColor: barBlue };
  });
  // Index der initial sichtbaren Serie -> passende VaR/ES-Linien (statt fix Dataset 0).
  const defaultIdx = Math.max(0, CR_FLAG_SERIES.findIndex(f => f.key === defaultKey));

  const col = _crChartColor();
  canvas.width = Math.max(320, Math.floor((canvas.parentElement?.clientWidth || 540) - 28)); canvas.height = 300;
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: [_crLinePlugin],
    data: { labels, datasets },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: col,
      layout: { padding: { left: 12, top: 22 } },   // links: EL-Linie nicht an der y-Achse; oben: schmales Band fuer die EL/VaR/ES-Reihe UEBER dem Plot
      plugins: {
        legend: { display: false },   // Serien-Legende als HTML-Overlay oben rechts (renderCrLossLegend), schrumpft den Plot nicht
        subtitle: { display: false },
        crLines: { v: lineMap[defaultIdx], ec: { elIdx: _elIdx, varIdx: _defVarIdx } },
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
  chart.$ecArrow = { elIdx: _elIdx, varIdx: _defVarIdx };   // Economic-Capital-Flaeche (EL..VaR der Default-Serie)
  chart.$ecDsIdx = defaultIdx;   // EC-Band + Tail-Risk nur zeigen, solange DIESE Serie (Historic) eingeblendet ist
  chart.$legendTextCol = col;    // Textfarbe fuer die Canvas-Serien-Legende (im _crLinePlugin)
  window[canvasId] = chart;
  _bindCrLossCanvasLeave(canvas);
  _bindCrLossContextDrill(canvas);
  _bindCrLossLegendClick(canvas);   // Klick auf die (Canvas-)Serien-Legende toggelt die Serie
}

// Klick auf die auf dem Canvas gezeichnete Serien-Legende (chart.$legendHit, Canvas-Koords):
// blendet die Serie aus/ein und baut die VaR/ES-Linien passend zu den sichtbaren Serien neu.
function _bindCrLossLegendClick(canvas) {
  if (!canvas || canvas.__crLegendClickBound) return;
  canvas.__crLegendClickBound = true;
  canvas.addEventListener('click', (e) => {
    const ch = window[canvas.id];
    if (!ch || !Array.isArray(ch.$legendHit)) return;
    const rect = canvas.getBoundingClientRect();
    if (!(rect.width > 0) || !(rect.height > 0)) return;
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    const hit = ch.$legendHit.find((b) => x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h);
    if (!hit) return;
    ch.setDatasetVisibility(hit.ds, !ch.isDatasetVisible(hit.ds));
    try { _crRebuildLines(ch, 'v'); } catch {}
    ch.update();
  });
}

// RECHTS: Tail-Zoom — Verlust (% vom NAV) je Quantil im Extrem-Tail (sortedLossesIssuer,
// RATING). Balken >= VaR rot; horizontale VaR (solid) + ES (dashed) Linien.
function renderCreditTailZoom(canvasId = 'crTailZoomChart') {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;
  _destroyCrChart(canvasId);
  const port = appState.getSelectedPortTableName?.();
  const all = (appState.getAllLossData?.() || [])
    .filter(r => String(r.port_name) === String(port) && Number.isFinite(Number(r.QUANTIL)));
  if (!all.length) { canvas.style.display = 'none'; return; }

  const byFlag = { rating: [], market: [], norm: [] };
  all.forEach(r => { const f = String(r.pd_flag || '').toLowerCase(); if (byFlag[f]) byFlag[f].push(r); });
  const baseFlag = byFlag.rating.length ? 'rating' : byFlag.market.length ? 'market' : 'norm';
  if (!byFlag[baseFlag].length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  // Welche Baender dieser Chart zeigt: TSI-Panel nur TSI, MSD-Panel nur MSD, sonst beide.
  const _bands = canvasId === 'crTailZoomChartTsi' ? { tsi: true, msd: false }
    : canvasId === 'crTailZoomChartMsd' ? { tsi: false, msd: true }
    : { tsi: true, msd: true };
  const _bandTxt = _bands.tsi && _bands.msd ? 'TSI/MSD bands' : _bands.tsi ? 'TSI band' : 'MSD band';
  // MSD-Panel: nur Historic + Market adjusted (kein "Market"), beide sichtbar, keine
  // fixen VaR/ES-Referenzlinien (die MSD-Divergenz liegt zwischen den ES-Niveaus).
  // TSI-Panel: nur Historic (TSI = (ES-VaR)/VaR ist rein Historic).
  const _isMsd = canvasId === 'crTailZoomChartMsd';
  const _isTsi = canvasId === 'crTailZoomChartTsi';

  const sumNav = sumNavForPort(port);
  const targets = [99.0, 99.2, 99.4, 99.5, 99.6, 99.7, 99.8, 99.9, 99.95, 99.99];
  const labels = targets.map(q => q.toLocaleString('de-DE', { minimumFractionDigits: q >= 99.9 ? 2 : 1, maximumFractionDigits: q >= 99.9 ? 2 : 1 }));
  const cvarByFlag = creditRowsByFlag();

  // Drill-Datenquelle: Positionen des gewaehlten Portfolios (mit ISSUER/__LOSS/RATINGres).
  try {
    const portRows = (appState.getAllPortfolioData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === String(port).trim());
    (_crTailDrills[canvasId] || crTailDrill).setData(buildPositionLoss(portRows, port));
  } catch (e) { console.warn('[CreditTail] drill data failed', e); }

  // Je pd_flag eine Serie (Historic/Market/Market adjusted); nur Historic initial sichtbar.
  // stepsByDs[dsIndex][barIndex] = Drill-Schritt (ausfallende Emittenten im Quantil-Szenario).
  const lineMap = [];
  const stepsByDs = [];
  const _series = _isTsi ? CR_FLAG_SERIES.filter(f => f.key === 'rating')
    : _isMsd ? CR_FLAG_SERIES.filter(f => f.key !== 'market')
    : CR_FLAG_SERIES;
  const datasets = _series.map((f, di) => {
    const sorted = byFlag[f.key].slice().sort((a, b) => Number(a.QUANTIL) - Number(b.QUANTIL));
    let data;
    let steps;
    if (sorted.length) {
      const nearest = (q) => sorted.reduce((best, r) => (Math.abs(Number(r.QUANTIL) - q) < Math.abs(Number(best.QUANTIL) - q) ? r : best), sorted[0]);
      const picks = targets.map(q => nearest(q));
      data = picks.map(row => (sumNav > 0 ? Number(row.LOSS) / sumNav * 100 : 0));
      steps = picks.map(row => lossDefaultStepRanked(row?.ISSUER_RANK));
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
    return { label: f.label, data, backgroundColor: colors, borderColor: colors, maxBarThickness: 30, hidden: _isMsd ? false : (di !== 0) };
  });
  // MSD: je Serie nur die gestrichelte ES-Linie behalten (keine VaR-Linien) -> die beiden
  // ES-Niveaus (Historic + Market adjusted) sind die MSD-Bandgrenzen.
  const lineMapEs = lineMap.map(ls => ls.filter(l => l.dash));

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
              if (_bands.tsi) items.push({ text: 'TSI', fillStyle: 'rgba(150,110,220,0.9)', strokeStyle: 'rgba(150,110,220,0.9)', hidden: !ch.$showTSI, datasetIndex: -1, $band: 'tsi' });
              if (_bands.msd) items.push({ text: 'MSD', fillStyle: 'rgba(230,170,60,0.9)', strokeStyle: 'rgba(230,170,60,0.9)', hidden: !ch.$showMSD, datasetIndex: -1, $band: 'msd' });
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
        subtitle: { display: true, text: `Loss > VaR red · VaR (solid) · ES (dashed) · ${_bandTxt}`, color: col, align: 'start', font: { size: 10 } },
        crLines: { h: _isMsd ? lineMapEs.flat() : lineMap[0] },
        tooltip: { callbacks: { title: (c) => `Quantile ${labels[c[0].dataIndex]}`, label: (c) => `${c.dataset.label}: ${Number(c.parsed.y).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% of NAV` } },
      },
      scales: {
        x: { title: { display: true, text: 'Quantile', color: col }, ticks: { color: col }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Loss (% of NAV)', color: col }, ticks: { color: col } },
      },
    },
  });
  chart.$crLineMap = _isMsd ? lineMapEs : lineMap;   // MSD: nur die gestrichelten ES-Linien (auch beim Toggle)
  chart.$crTailSteps = stepsByDs;
  chart.$bandVals = { ratingVar: ratingBand.varPct, ratingEs: ratingBand.esPct, normEs: normBand.esPct };
  chart.$showTSI = _bands.tsi;   // je Panel nur das relevante Band (Legende toggelt es)
  chart.$showMSD = _bands.msd;
  try { chart.update(); } catch {}
  window[canvasId] = chart;
  _bindCrTailCanvasLeave(canvas);
  // Drill (Rechtsklick) an jedem Chart — je Canvas eigene Drill-Instanz (_crTailDrills)
  // mit eigenen Detail-/Menue-Containern.
  _bindCrTailContextDrill(canvas);
}

// ── TOP TAIL DRIVERS: Emittenten mit dem groessten Beitrag zum Tail-Verlust ──
// Zwei GETRENNTE Ansichten untereinander: Historic (pd_flag RATING) und Market adjusted
// (pd_flag NORM). Metrik "Verlustanteil im Tail": Summe des Emittenten-Verlusts
// (NOTIONAL x LGD-Rate) ueber die Tail-Szenarien (Quantil >= VaR-Konfidenzquantil) des
// jeweiligen pd_flags, in denen er ausfaellt; je PD auf 100 % normiert. Nur Top 8.
// Credit-Palette (Purpur): Historic dunkelbasis, Market adjusted hell.
const CR_TAIL_VIEWS = [
  { flag: 'RATING', chartId: 'crTailContribChartHist', tableId: 'crTailContribTableHist', tcmTableId: 'crTailTcmTableHist', scatterId: 'crTailTcmScatterHist', title: 'Top tail drivers — Historic', fill: 'rgba(210,70,70,0.85)', border: 'rgba(210,70,70,0.95)' },
  { flag: 'NORM',   chartId: 'crTailContribChartNorm', tableId: 'crTailContribTableNorm', tcmTableId: 'crTailTcmTableNorm', scatterId: 'crTailTcmScatterNorm', title: 'Top tail drivers — Market adjusted', fill: 'rgba(178,152,200,0.85)', border: 'rgba(178,152,200,0.95)' },
];

// Rank-GENAUER Drill-Schritt aus einem rankKeys-Set ("issuer||rank" der im Tail
// ausfallenden Tranchen): matcht NUR diese Tranchen, nicht pauschal alle Positionen des
// Emittenten (z.B. AAA nicht anzeigen, wenn im Tail nur die BBB+-Tranche ausfaellt).
// Fallback (leeres Set) = nach ISSUER (bisheriges Verhalten).
function crRankStep(name, rankKeys) {
  if (rankKeys && rankKeys.size) {
    return {
      colKey: 'ISSUER', value: name, label: 'Issuer',
      match: (r) => rankKeys.has(`${String(r?.ISSUER ?? '').trim().toLowerCase()}||${String(r?.RANK ?? '').trim().toLowerCase()}`),
    };
  }
  return lossDefaultStep([name]);
}

// Top-8-Emittenten nach Tail-Verlustanteil fuer EIN pd_flag.
// Exportiert: auch die HOME-Overview-Kachel nutzt diese Logik (Top tail drivers).
// Jedes Item traegt rankKeys = Set der im Tail tatsaechlich ausfallenden "issuer||rank"
// (fuer rank-genaue Drills; harmlos fuer andere Nutzer).
export function crTailTopForFlag(flag, issuerLoss, issuerRating, allLoss, confQ) {
  const rows = allLoss.filter(r => String(r?.pd_flag ?? '').toUpperCase() === flag);
  let tail = rows.filter(r => Number(r.QUANTIL) >= confQ);
  if (tail.length < 3) {
    const sorted = rows.slice().sort((a, b) => Number(b.LOSS) - Number(a.LOSS));
    tail = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.05)));
  }
  const c = new Map();
  const rk = new Map();   // key -> Set("issuer||rank") der im Tail ausfallenden Tranchen
  for (const s of tail) {
    for (const nm of issuersFromRank(s.ISSUER_RANK)) {
      const key = String(nm).trim().toLowerCase();
      c.set(key, (c.get(key) || 0) + (issuerLoss.get(key)?.loss || 0));
    }
    for (const part of String(s?.ISSUER_RANK ?? '').split(',')) {
      const p = part.trim(); if (!p) continue;
      const us = p.indexOf('_');
      const nm = (us >= 0 ? p.slice(0, us) : p).trim().toLowerCase();
      const rank = (us >= 0 ? p.slice(us + 1) : '').trim().toLowerCase();
      if (!nm) continue;
      if (!rk.has(nm)) rk.set(nm, new Set());
      rk.get(nm).add(`${nm}||${rank}`);
    }
  }
  const total = [...c.values()].reduce((a, b) => a + b, 0);
  return [...c.entries()]
    .map(([k, v]) => ({ name: issuerLoss.get(k)?.name || k, rating: issuerRating.get(k) || '', pct: total > 0 ? v / total * 100 : 0, rankKeys: rk.get(k) || new Set() }))
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

  // EAD-Anteil je Emittent (= Exposure-Anteil, Notional-basiert) fuer den Tail Concentration
  // Multiplier: TCM = Tail-Loss-Anteil / EAD-Anteil (>1 = ueberproportional im Tail).
  const issuerEad = new Map(); let totalEad = 0;
  for (const r of portRows) {
    const name = String(r?.ISSUER ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const n = Number(r?.NOTIONAL) || 0;
    issuerEad.set(key, (issuerEad.get(key) || 0) + n);
    totalEad += n;
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
          top.map((it, i) => `<tr><td>${i + 1}</td><td>${esc(it.name)}</td><td style="text-align:right;">${it.pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %</td><td>${esc(it.rating)}</td></tr>`).join('')
        }</tbody></table>`;
      }
    }

    // Tail Concentration Multiplier: Tail-Loss-Anteil vs EAD-Anteil je Emittent.
    // TCM = Tail-Loss-% / EAD-% (>1 = ueberproportionaler Tail-Beitrag).
    const tcmRows = top.map((it) => {
      const ead = issuerEad.get(String(it.name).toLowerCase()) || 0;
      const eadShare = totalEad > 0 ? ead / totalEad * 100 : NaN;
      const tcm = (Number.isFinite(eadShare) && eadShare > 0) ? it.pct / eadShare : NaN;
      return { name: it.name, rating: it.rating, pct: it.pct, eadShare, tcm, rankKeys: it.rankKeys };
    });
    // Tabelle nach TCM absteigend sortieren (hoechste Schieflage zuerst; NaN ans Ende).
    tcmRows.sort((a, b) => (Number.isFinite(b.tcm) ? b.tcm : -Infinity) - (Number.isFinite(a.tcm) ? a.tcm : -Infinity));
    const tcmEl = document.getElementById(v.tcmTableId);
    if (tcmEl) {
      if (!tcmRows.length) {
        tcmEl.innerHTML = '<table class="conc-report-table"><tbody><tr><td>No tail data.</td></tr></tbody></table>';
      } else {
        const p1 = (x) => `${Number(x).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
        tcmEl.innerHTML = `<div class="cr-tcm-scroll"><table class="conc-report-table"><thead><tr><th>Issuer</th><th style="text-align:right;">Tail loss</th><th style="text-align:right;">EAD</th><th style="text-align:right;" title="Tail Concentration Multiplier = Tail loss share / EAD share">TCM</th></tr></thead><tbody>${
          tcmRows.map((it) => {
            const tcmStyle = !Number.isFinite(it.tcm) ? '' : (it.tcm >= 1.5 ? 'color:#d9534f;font-weight:700;' : it.tcm > 1 ? 'color:#e0a533;font-weight:600;' : '');
            const tcmStr = Number.isFinite(it.tcm) ? `${it.tcm.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×` : '–';
            return `<tr><td>${esc(it.name)}</td><td style="text-align:right;">${p1(it.pct)}</td><td style="text-align:right;">${Number.isFinite(it.eadShare) ? p1(it.eadShare) : '–'}</td><td style="text-align:right;${tcmStyle}">${tcmStr}</td></tr>`;
          }).join('')
        }</tbody></table></div>`;
        // Max 5 Zeilen sichtbar; bei mehr scrollt der Container (Zeilen bereits nach TCM
        // absteigend -> die staerksten oben). Hoehe = Kopf + 5 Zeilen (gemessen).
        if (tcmRows.length > 5) {
          const scroll = tcmEl.querySelector('.cr-tcm-scroll');
          const thead = tcmEl.querySelector('thead');
          const bodyRows = tcmEl.querySelectorAll('tbody tr');
          if (scroll && thead && bodyRows.length > 5) {
            let h = thead.offsetHeight || 0;
            for (let i = 0; i < 5; i++) h += (bodyRows[i].offsetHeight || 0);
            if (h > 0) { scroll.style.maxHeight = (h + 2) + 'px'; scroll.style.overflowY = 'auto'; }
          }
        }
      }
    }
    // Scatter: x = EAD-Anteil, y = Tail-Loss-Anteil; 45deg-Diagonale = TCM 1. Ueber der Linie -> TCM>1.
    renderCrTcmScatter(v.scatterId, tcmRows);
  }

  // Portfolio-Ebene: kompakte Summary ueber der Historic-TCM-Tabelle. Gleiche Werte wie der
  // Concentration-Risk-Slider (_tailConcentrationIndex) + gleiche Schwellen (CONC_GREEN/YELLOW_MAX).
  // Keine Neuberechnung, keine Tabellenaenderung.
  const _cSum = document.getElementById('crTcmSummaryHist');
  const _cFunnel = document.getElementById('crTcmFunnelHist');
  if (_cSum || _cFunnel) {
    const conc = tailConcentrationIndex();
    if (conc && Number.isFinite(conc.pct)) {
      const f1 = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
      const status = conc.pct >= CONC_YELLOW_MAX ? 'HIGH' : conc.pct >= CONC_GREEN_MAX ? 'ELEVATED' : 'LOW';
      const col = conc.pct >= CONC_YELLOW_MAX ? '#d9534f' : conc.pct >= CONC_GREEN_MAX ? '#e0a533' : '#2f9e5f';
      // K aus den vorhandenen Effective Tail Drivers (NICHT aus TCM), N + topKShare dynamisch.
      const K = Math.max(1, Math.round(conc.eff));
      const topKShare = (conc.shares || []).slice(0, K).reduce((a, b) => a + b, 0);
      const sentence = (Number.isFinite(conc.eff) && conc.n >= 1)
        ? `${K} out of ${conc.n} issuers drive <b style="color:var(--text-bright);">${f1(topKShare)} %</b> of tail losses.`
        : '';
      if (_cSum) _cSum.innerHTML =
        `<span style="color:var(--text-muted);">Portfolio concentration: <b style="color:var(--text-bright);">${f1(conc.pct)} %</b> &middot; <b style="color:${col};">${status}</b></span>` +
        (sentence ? `<span style="color:var(--text-muted);">${sentence}</span>` : '');
      // Funnel in EINER Kachel als 2 Spalten (issuers | iss+rank). Jede Spalte hat eigene
      // KPI-Boxen (Label + Zahl IN der Box) und eigene ↓-Pfeile dazwischen.
      const box = (label, v) => `<div style="border:1px solid var(--border-subtle); border-radius:6px; padding:5px 9px; background:var(--surface-overlay); text-align:center;"><div style="font-size:9.5px; color:var(--text-muted); line-height:1.2;">${label}</div><div style="font-size:17px; font-weight:700; color:var(--text-bright); line-height:1.1; margin-top:1px;">${v}</div></div>`;
      const arrow = `<div style="color:var(--text-bright); font-size:15px; line-height:1; text-align:center; margin:2px 0;">&darr;</div>`;
      const steps = [
        ['total', conc.totalIssuers, conc.totalRanks],
        ['contribute to the loss distribution', conc.defaultedIssuers, conc.defaultedRanks],
        ['enter the extreme tail', conc.n, conc.n],
      ];
      // Letzte Box mit spaltenspezifischem Nomen: "issuers" links, "combinations" rechts.
      const mkCol = (title, idx, noun) => {
        const boxes = steps.map((s) => box(s[0], s[idx]));
        boxes.push(box(`${noun} drive ${f1(topKShare)} % of tail loss`, K));
        return `<div style="flex:1; display:flex; flex-direction:column; justify-content:space-between;"><div style="font-size:9px; color:var(--text-muted); text-transform:uppercase; letter-spacing:.04em; margin-bottom:2px;">${title}</div>${boxes.join(arrow)}</div>`;
      };
      if (_cFunnel) _cFunnel.innerHTML = `<div style="display:flex; gap:14px; flex:1; min-height:0;">${mkCol('issuers', 1, 'issuers')}${mkCol('issuer–rank combinations', 2, 'combinations')}</div>`;
    } else {
      if (_cSum) _cSum.innerHTML = '';
      if (_cFunnel) _cFunnel.innerHTML = '';
    }
  }
}

// State fuer die Credit-Scatter: volle Daten + Show-Limit (Top-N nach Tail-Loss-Anteil) je Canvas.
const _crScatterRows = new Map();
const _crScatterLimit = new Map();

// Reset-Zoom-Button + "Show N"-Dropdown + Hinweis oben im Scatter-Container (wie mvarIssuerScatterChart).
function ensureCrScatterTools(canvas, canvasId) {
  const box = canvas?.parentElement;
  if (!box) return;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  if (!box.querySelector('.cr-scatter-reset')) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'cr-scatter-reset'; btn.textContent = 'Reset Zoom'; btn.title = 'Reset zoom';
    btn.style.cssText = 'position:absolute;top:4px;right:4px;z-index:5;font-size:10px;padding:2px 8px;border:1px solid var(--border-subtle);border-radius:4px;background:var(--surface-overlay);color:var(--text-bright);cursor:pointer;';
    btn.addEventListener('click', () => { try { window[canvasId]?.resetZoom?.(); } catch {} });
    box.appendChild(btn);
  }
  if (!box.querySelector('.cr-scatter-count')) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;top:4px;right:84px;z-index:5;display:flex;align-items:center;gap:4px;';
    const lbl = document.createElement('span'); lbl.textContent = 'Show'; lbl.style.cssText = 'font-size:10px;color:var(--text-muted);';
    const sel = document.createElement('select'); sel.className = 'cr-scatter-count';
    sel.style.cssText = 'font-size:10px;padding:1px 4px;border:1px solid var(--border-subtle);border-radius:4px;background:var(--surface-overlay);color:var(--text-bright);cursor:pointer;';
    [['3', '3'], ['5', '5'], ['all', 'All']].forEach(([val, t]) => { const o = document.createElement('option'); o.value = val; o.textContent = t; sel.appendChild(o); });
    const cur = _crScatterLimit.get(canvasId);
    sel.value = (cur == null ? '3' : String(cur));
    sel.addEventListener('change', () => {
      const val = sel.value === 'all' ? 'all' : parseInt(sel.value, 10);
      _crScatterLimit.set(canvasId, val);
      try { renderCrTcmScatter(canvasId, _crScatterRows.get(canvasId) || []); } catch {}
    });
    wrap.appendChild(lbl); wrap.appendChild(sel);
    box.appendChild(wrap);
  }
  if (!box.querySelector('.cr-scatter-hint')) {
    const hint = document.createElement('div');
    hint.className = 'cr-scatter-hint';
    hint.textContent = 'drag to zoom';
    hint.style.cssText = 'position:absolute;top:6px;left:10px;z-index:5;font-size:10px;color:var(--text-muted);pointer-events:none;white-space:nowrap;';
    box.appendChild(hint);
  }
  if (!box.querySelector('.cr-scatter-legend')) {
    const lg = document.createElement('div');
    lg.className = 'cr-scatter-legend';
    lg.style.cssText = 'position:absolute;top:42px;right:6px;z-index:5;display:flex;flex-direction:column;gap:8px;font-size:9.5px;color:var(--text-muted);pointer-events:none;white-space:nowrap;';
    const row = (border, label) => `<div style="display:flex;align-items:center;gap:6px;"><span style="display:inline-block;width:22px;height:0;border-top:${border};"></span>${label}</div>`;
    lg.innerHTML =
      row('1.5px dashed rgba(150,165,185,0.85)', 'TCM = 1') +
      row('1.5px solid rgba(150,140,170,0.75)', 'Highest TCM') +
      row('1px dashed rgba(150,140,170,0.5)', 'Issuer TCM slope');
    box.appendChild(lg);
  }
}

// Zeichnet je Emittenten-Punkt NAME + TCM mit einfacher Kollisionsvermeidung: der TCM
// kommt zuerst UNTER den Namen (default), sonst DARUEBER, sonst DAHINTER (rechts daneben) —
// es wird die erste Position gewaehlt, die nichts Bereits-Gezeichnetes ueberlappt (Punkte,
// Namen, andere TCMs). Ersetzt die ChartDataLabels-Beschriftung des Issuers-Datasets.
const _crScatterLabelPlugin = {
  id: 'crScatterLabels',
  afterDatasetsDraw(chart) {
    const meta = chart.getDatasetMeta(1);   // Issuers-Dataset
    const ds = chart.data.datasets[1];
    if (!meta || !ds || !meta.data) return;
    const ctx = chart.ctx;
    const area = chart.chartArea || { left: 0, right: chart.width, top: 0, bottom: chart.height };
    const css = getComputedStyle(document.body);
    const nameCol = (css.getPropertyValue('--text-primary') || '').trim() || '#333';
    const tcmCol = 'rgba(170,150,200,0.98)';
    const fam = (css.fontFamily || 'system-ui, sans-serif').trim();
    const NAME_PX = 10.5, TCM_PX = 9.5, GAP = 2, PR = 7;
    const overlaps = (a, b) => !(a.x2 <= b.x1 || a.x1 >= b.x2 || a.y2 <= b.y1 || a.y1 >= b.y2);
    const placed = [];
    meta.data.forEach((el) => placed.push({ x1: el.x - PR, y1: el.y - PR, x2: el.x + PR, y2: el.y + PR }));
    ctx.save();
    ctx.textBaseline = 'middle';
    meta.data.forEach((el, i) => {
      const r = ds.data[i];
      if (!r || !r.issuer) return;
      const px = el.x, py = el.y;
      // Name: rechts vom Punkt, bei Ueberlauf am rechten Rand nach links.
      ctx.font = `${NAME_PX}px ${fam}`;
      const name = String(r.issuer);
      const nameW = ctx.measureText(name).width;
      let nameX = px + PR + 4, nameAlign = 'left';
      let nameL = nameX, nameR = nameX + nameW;
      if (nameR > area.right - 2) { nameX = px - PR - 4; nameAlign = 'right'; nameR = nameX; nameL = nameX - nameW; }
      const nameRect = { x1: nameL, y1: py - NAME_PX / 2, x2: nameR, y2: py + NAME_PX / 2 };
      ctx.textAlign = nameAlign;
      ctx.fillStyle = nameCol;
      ctx.fillText(name, nameX, py);
      placed.push(nameRect);
      if (!Number.isFinite(r.tcm) || !r.isMaxTcm) return;   // TCM nur beim groessten
      // TCM: 3 Kandidaten relativ zum Namen — unter (default) / darueber / dahinter.
      ctx.font = `bold ${TCM_PX}px ${fam}`;
      const tcm = `TCM ${r.tcm.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×`;
      const tcmW = ctx.measureText(tcm).width;
      const cands = [
        { x: nameRect.x1, y: nameRect.y2 + GAP + TCM_PX / 2 },   // darunter (default)
        { x: nameRect.x1, y: nameRect.y1 - GAP - TCM_PX / 2 },   // darueber
        { x: nameRect.x2 + 6, y: py },                            // dahinter
      ];
      let chosen = cands[0];
      for (const c of cands) {
        const rect = { x1: c.x, y1: c.y - TCM_PX / 2, x2: c.x + tcmW, y2: c.y + TCM_PX / 2 };
        if (!placed.some((p) => overlaps(rect, p))) { chosen = c; break; }
      }
      ctx.textAlign = 'left';
      ctx.fillStyle = tcmCol;
      ctx.fillText(tcm, chosen.x, chosen.y);
      placed.push({ x1: chosen.x, y1: chosen.y - TCM_PX / 2, x2: chosen.x + tcmW, y2: chosen.y + TCM_PX / 2 });
    });
    ctx.restore();
  },
};

// Konzentrations-Scatter (wie mvarIssuerScatterChart): x = EAD-Anteil %, y = Tail-Loss-Anteil %,
// gestrichelte 45deg-Diagonale (TCM = 1). Punkte darueber tragen ueberproportional zum Tail bei
// (amber > 1, rot >= 1,5). Mit "Show"-Dropdown (Top-N) und Zoom.
function renderCrTcmScatter(canvasId, rows) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || !window.Chart) return;
  if (Array.isArray(rows)) _crScatterRows.set(canvasId, rows);   // volle Daten fuer Re-Render (Show)
  const allRows = _crScatterRows.get(canvasId) || rows || [];
  const limit = _crScatterLimit.has(canvasId) ? _crScatterLimit.get(canvasId) : 3;   // Standard: Top 3
  const sorted = allRows.slice().sort((a, b) => (Number(b.pct) || 0) - (Number(a.pct) || 0)); // Top-N nach Tail-Loss
  const shown = (limit === 'all') ? sorted : sorted.slice(0, limit);
  _destroyCrChart(canvasId);
  const pts = shown.filter((r) => Number.isFinite(r.eadShare))
    .map((r) => ({ x: +Number(r.eadShare).toFixed(2), y: +Number(r.pct).toFixed(2), issuer: r.name, tcm: r.tcm, rankKeys: r.rankKeys }));
  if (!pts.length) { ensureCrScatterTools(canvas, canvasId); return; }
  // Bitmap = tatsaechliche Anzeigebreite (offsetWidth aus CSS width:100%) x Hoehe 240 -> 1:1, scharf.
  canvas.width = Math.max(320, Math.floor(canvas.offsetWidth || canvas.parentElement?.clientWidth || 560));
  canvas.height = 240;
  const bodyCss = getComputedStyle(document.body);
  const col = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const font = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const axMax = Math.max(5, Math.ceil(Math.max(...pts.map((p) => Math.max(p.x, p.y))) * 1.1));
  const ptCol = pts.map((p) => (p.tcm >= 1.5 ? 'rgba(217,83,79,0.85)' : p.tcm > 1 ? 'rgba(224,165,51,0.85)' : 'rgba(122,92,145,0.8)'));
  // Groessten TCM markieren: dessen Linie DURCHGEZOGEN (+ einziges TCM-Label), die uebrigen strichliert.
  let _maxI = -1, _maxV = -Infinity;
  pts.forEach((p, i) => { if (Number.isFinite(p.tcm) && p.tcm > _maxV) { _maxV = p.tcm; _maxI = i; } });
  pts.forEach((p, i) => { p.isMaxTcm = (i === _maxI); });
  // Je Emittent eine ZARTE Gerade durch den Ursprung: Steigung m = y/x = TCM des Punkts
  // (auf y = m·x hat jeder Punkt die Steigung = seinen TCM). Endpunkt im Sichtbereich halten.
  const tcmLines = pts.map((p) => {
    const m = p.x > 0 ? p.y / p.x : NaN;
    let ex = axMax, ey = Number.isFinite(m) ? m * axMax : NaN;
    if (Number.isFinite(m) && m > 0 && ey > axMax) { ey = axMax; ex = axMax / m; }
    return {
      type: 'line', label: `TCM ${p.issuer}`, order: 4, pointRadius: 0, fill: false,
      borderColor: 'rgba(150,140,170,0.30)',
      borderWidth: 1,
      borderDash: p.isMaxTcm ? [] : [4, 4],   // groesster TCM durchgezogen, Rest strichliert — gleich zart
      data: (Number.isFinite(m) && m > 0) ? [{ x: 0, y: 0 }, { x: ex, y: ey }] : [],
    };
  });
  window[canvasId] = new window.Chart(canvas.getContext('2d'), {
    type: 'scatter',
    plugins: [...(window.ChartDataLabels ? [window.ChartDataLabels] : []), _crScatterLabelPlugin],
    data: {
      datasets: [
        { type: 'line', label: 'proportional (TCM = 1)', data: [{ x: 0, y: 0 }, { x: axMax, y: axMax }], borderColor: 'rgba(150,165,185,0.7)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, fill: false, order: 2 },
        { label: 'Issuers', data: pts, backgroundColor: ptCol, borderColor: ptCol, pointRadius: 6, pointHoverRadius: 8, order: 1,
          datalabels: { display: false } },   // Name + TCM zeichnet _crScatterLabelPlugin (mit Kollisionsvermeidung)
        ...tcmLines,
      ],
    },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: col,
      plugins: {
        legend: { display: false },
        title: { display: false },
        tooltip: { callbacks: { label: (ctx) => ctx.raw?.issuer ? `${ctx.raw.issuer}: EAD ${ctx.raw.x}% / Tail ${ctx.raw.y}%${Number.isFinite(ctx.raw.tcm) ? ` (TCM ${ctx.raw.tcm.toFixed(1)}×)` : ''}` : '' } },
        datalabels: window.ChartDataLabels ? { align: 'right', anchor: 'center', offset: 6, color: col, font: { family: font, size: 10 }, formatter: (val) => (val && val.issuer) ? val.issuer : '' } : undefined,
        zoom: {
          pan:  { enabled: true, mode: 'xy', modifierKey: 'ctrl' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, drag: { enabled: true, backgroundColor: 'rgba(75,150,225,0.15)', borderColor: 'rgba(75,150,225,0.6)', borderWidth: 1 }, mode: 'xy' },
        },
      },
      scales: {
        x: { beginAtZero: true, max: axMax, title: { display: true, text: 'EAD share %', color: col, font: { family: font } }, ticks: { color: col, font: { family: font }, callback: (val) => `${Math.round(Number(val) * 100) / 100}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { beginAtZero: true, max: axMax, title: { display: true, text: 'Tail loss share %', color: col, font: { family: font } }, ticks: { color: col, font: { family: font }, callback: (val) => `${Math.round(Number(val) * 100) / 100}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
      },
    },
  });
  // Drill: je Punkt die Positionen des Emittenten (Rechtsklick). Aligned mit pts.
  window[canvasId].$crScatterSteps = pts.map((p) => crRankStep(p.issuer, p.rankKeys));
  _bindCrScatterContextDrill(canvas);
  ensureCrScatterTools(canvas, canvasId);
}

function renderCrTailContribChart(canvas, winKey, items, title, colors) {
  if (!canvas || !window.Chart) return;
  _destroyCrChart(winKey);
  if (!items || !items.length) return;

  // Bitmap = tatsaechliche Anzeigebreite (offsetWidth; Fallback 560 bei verstecktem Panel/
  // Report-Erfassung), Hoehe 240 -> 1:1, keine CSS-Skalierung, scharfe Schrift.
  canvas.width = Math.max(320, Math.floor(canvas.offsetWidth || canvas.parentElement?.clientWidth || 560));
  canvas.height = 240;
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
        title: { display: false },
        datalabels: window.ChartDataLabels ? {
          anchor: 'end', align: 'right', clamp: true, color: col, font: { family: font, size: 10 },
          formatter: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 0 })}%`,
        } : undefined,
        tooltip: { callbacks: { label: (ctx) => `${Number(ctx.parsed.x).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` } },
      },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: 'Contribution to tail loss (%)', color: col, font: { family: font } }, ticks: { color: col, font: { family: font }, callback: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { ticks: { color: col, font: { family: font }, autoSkip: false }, grid: { display: false } },
      },
    },
  });
  // Drill: je Balken die Positionen des Emittenten (Rechtsklick).
  window[winKey].$crContribSteps = items.map((it) => crRankStep(it.name, it.rankKeys));
  _bindCrContribContextDrill(canvas);
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
  // Override (z.B. Report-Snapshot) hat Vorrang; sonst VaR/ES beim gewaehlten
  // Konfidenzniveau aus der Verteilung neu berechnen (keine Simulation, keine
  // Abhaengigkeit von der gespeicherten CreditVaR-Tabelle).
  if (rowsIn) {
    const byFlag = {};
    for (const r of rowsIn) { const f = String(r?.pd_flag ?? '').toLowerCase(); if (f && !byFlag[f]) byFlag[f] = r; }
    return byFlag;
  }
  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();
  const byFlag = {};
  for (const flag of ['rating', 'market', 'norm']) {
    const v = creditVarEsForFlag(port, flag);
    if (v) byFlag[flag] = { pd_flag: flag.toUpperCase(), ...v };
  }
  return byFlag;
}

function fmtEur(v) {
  return fmtEurCompact(v, { risk: true });
}
function fmtEurSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return fmtEurCompact(n, { risk: true, signed: true });
}
function fmtPpSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : '-'}${Math.abs(n).toLocaleString('de-DE', { maximumFractionDigits: 3 })}%`;
}
// Credit-rel ist eine Fraktion (-0.05) -> Prozent fuer die Anzeige.
function fmtRelPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  return `${(n * 100).toLocaleString('de-DE', { maximumFractionDigits: 3 })}%`;
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
      desc: '(ES - VaR) / VaR', state: tsiState, limit: Number.isFinite(tsiVal) ? computeLimitModel(tsiVal, tsiTh, tsiState) : null,
      // Rohwert (Betrag) + Schwellen fuer den Overview-Slider (homeOverview.js).
      val: Number.isFinite(tsiVal) ? Math.abs(tsiVal) : null, thYellow: tsiTh.yellow, thRed: tsiTh.red },
    { label: 'Market Stress (MSD)', full: 'Market Stress Divergence', abs: null, rel: fmtRelPct(msdVal), dRel: null, dAbs: null,
      desc: '(Adjusted - Historic ES) / Historic ES', state: msdState, limit: Number.isFinite(msdVal) ? computeLimitModel(msdVal, msdTh, msdState) : null,
      val: Number.isFinite(msdVal) ? Math.abs(msdVal) : null, thYellow: msdTh.yellow, thRed: msdTh.red },
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
    utilStr: `${(util * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
    limitRelStr: `${redPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`,
    bufferRelStr: `${(redPct - curPct).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`,
  };
}

// Zentrale Schwellen fuer den Concentration-Risk-Slider (Prozent): gruen <40 / gelb 40-60 / rot >60.
const CONC_GREEN_MAX = 40;    // 0..40 = low concentration
const CONC_YELLOW_MAX = 60;   // 40..60 = elevated, >60 = high

// Portfolioweiter Management-Concentration-Score auf Basis der Effective Tail Drivers (NICHT
// "normalized HHI"). Liefert { pct: 0..100, eff: 1/HHI } oder null.
//   tailShare_i = issuerTailLoss_i / totalTailLoss ;  HHI = Sum(tailShare_i^2) ;  eff = 1/HHI
//   concentrationScore = ((N - eff) / (N - 1)) * 100  (0 = gleichverteilt, 100 = ein Emittent)
export function tailConcentrationIndex() {
  try {
    const port = String(appState.getSelectedPortTableName?.() ?? '').trim();
    const portRows = (appState.getAllPortfolioData?.() || [])
      .filter((r) => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === port);
    if (!portRows.length) return null;
    // Verlust-bei-Ausfall je Emittent (wie in der Tail-Driver-Rechnung).
    const issuerLoss = new Map();
    for (const r of buildPositionLoss(portRows, port)) {
      const name = String(r?.ISSUER ?? '').trim(); if (!name) continue;
      const key = name.toLowerCase();
      issuerLoss.set(key, (issuerLoss.get(key) || 0) + (Number(r.__LOSS) || 0));
    }
    // Tail-Szenarien (Quantil >= Konfidenz) -> Tail-Loss je Emittent aufsummieren (ALLE Emittenten).
    const allLoss = (appState.getAllLossData?.() || []).filter((r) => String(r?.port_name ?? '') === port);
    const rows = allLoss.filter((r) => String(r?.pd_flag ?? '').toUpperCase() === 'RATING');
    const confQ = getRunConfQuantil();
    let tail = rows.filter((r) => Number(r.QUANTIL) >= confQ);
    if (tail.length < 3) {
      const sorted = rows.slice().sort((a, b) => Number(b.LOSS) - Number(a.LOSS));
      tail = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.05)));
    }
    const perIssuer = new Map();
    for (const s of tail) {
      for (const nm of issuersFromRank(s.ISSUER_RANK)) {
        const key = String(nm).trim().toLowerCase();
        perIssuer.set(key, (perIssuer.get(key) || 0) + (issuerLoss.get(key) || 0));
      }
    }
    const losses = [...perIssuer.values()].filter((v) => v > 0);
    const total = losses.reduce((a, b) => a + b, 0);
    // N = Anzahl ALLER bereits aggregierten Emittenten mit positivem Tail-Loss-Beitrag
    // (tailLossShare > 0). KEIN Top-N, NICHT die sichtbaren Tabellenzeilen, keine Zusatz-Aggregation.
    const N = losses.length;
    if (!(total > 0) || N < 1) return null;
    const hhi = losses.reduce((a, v) => { const sh = v / total; return a + sh * sh; }, 0);   // in [1/N, 1]
    const eff = hhi > 0 ? 1 / hhi : NaN;
    // Management-Concentration-Score aus den Effective Tail Drivers (KEIN normalized HHI):
    // ((N - eff) / (N - 1)) * 100. N=1 -> nur ein Emittent -> 100%.
    const score = (N > 1 && Number.isFinite(eff)) ? ((N - eff) / (N - 1)) * 100 : 100;
    const pct = Math.max(0, Math.min(100, score));
    // Tail-Loss-Anteile (%) absteigend + Gesamtzahl der Tail-Emittenten — fuer den Satz
    // "K out of N issuers drive topK% of tail losses" (K = round(eff), keine feste Top-N-Logik).
    const shares = losses.map((v) => (v / total) * 100).sort((a, b) => b - a);
    // Funnel-Kennzahlen: alle Portfolio-Emittenten -> ausgefallene (irgendein Szenario) -> im Tail (N).
    const totalIssuers = issuerLoss.size;
    const defaultedSet = new Set();       // distinct Emittenten in der Distribution
    const defaultedRankSet = new Set();   // distinct Emittent+Rank in der Distribution
    for (const s of rows) {
      for (const nm of issuersFromRank(s.ISSUER_RANK)) {
        const k = String(nm).trim().toLowerCase(); if (k) defaultedSet.add(k);
      }
      for (const part of String(s?.ISSUER_RANK ?? '').split(',')) {
        const p = part.trim().toLowerCase(); if (p) defaultedRankSet.add(p);
      }
    }
    const rankSet = new Set();             // distinct Emittent+Rank im Portfolio
    for (const r of portRows) {
      const iss = String(r?.ISSUER ?? '').trim().toLowerCase();
      if (iss) rankSet.add(`${iss}||${String(r?.RANK ?? '').trim().toLowerCase()}`);
    }
    return {
      pct, eff, n: N, shares,
      totalIssuers, defaultedIssuers: defaultedSet.size,
      totalRanks: rankSet.size, defaultedRanks: defaultedRankSet.size,
    };
  } catch { return null; }
}

export function renderCreditRiskDashboard() {
  bindListeners();

  const host = document.getElementById('crDashKpi');
  const introEl = document.getElementById('crDashIntro');
  const tblEl = document.getElementById('crDashKpiTable');
  if (!host && !tblEl) return;

  const { cards } = getCreditDashboardModel();

  // Concentration Risk = Tail-Loss-Anteil der Top-3-Emittenten (aus der TCM-/Tail-Driver-Tabelle)
  // gegen ein angenommenes Limit (Warnung 75% / Limit 90%). VOR "Cluster Risk" einschieben — nur
  // fuer die Anzeige im Limits-Panel (getCreditDashboardModel bleibt unveraendert, damit die
  // HOME-Overview-Slider nicht verrutschen).
  // Concentration Risk: portfolioweiter Tail Concentration Index (normalisierter HHI). Eigener
  // 3-Zonen-Slider (Schwellen CONC_GREEN_MAX/CONC_YELLOW_MAX) mit Marker; keine Limit-Auslastung.
  const _conc = tailConcentrationIndex();
  const concPct = _conc ? _conc.pct : NaN;
  const concEff = _conc ? _conc.eff : NaN;
  const _f1c = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const concState = Number.isFinite(concPct)
    ? (concPct >= CONC_YELLOW_MAX ? 'red' : concPct >= CONC_GREEN_MAX ? 'yellow' : 'green') : null;
  const concCard = {
    label: 'Concentration Risk', full: 'Tail loss concentration',
    abs: Number.isFinite(concEff) ? `Effective tail drivers: ${_f1c(concEff)}` : null,
    rel: Number.isFinite(concPct) ? `${_f1c(concPct)}%` : '–',
    dRel: null, dAbs: null, desc: '', state: concState,
    limit: null, concPct, concEff,
  };
  const _tsiIdx = cards.findIndex((c) => /cluster risk|tsi/i.test(c.label || ''));
  cards.splice(_tsiIdx >= 0 ? _tsiIdx : cards.length, 0, concCard);

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
      const limitCol = Number.isFinite(c.concPct) ? concLimitHtml(c.concPct) : limitBarHtml(c.limit);
      return `<div class="cr-metric-row">${cardHtml}<div class="cr-metric-limit">${limitCol}</div></div>`;
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
// TSI-/MSD-Panels (Credit-Risk-Trigger): je eigene Tabelle (aus dem Profit/Loss-Container
// geklont -> Profit/Loss bleibt Quelle) + eigener Tail-Zoom-Chart. Aufruf beim Panel-Open
// (bootstrapTriggers). Voraussetzung: "Calculate PL" gelaufen (Tabellen + Loss-Daten da).
export function renderCreditTsiPanel() {
  const src = document.getElementById('creditTsiTableContainer0');
  const dst = document.getElementById('creditTsiTablePanel');
  if (src && dst) dst.innerHTML = src.innerHTML;
  try { renderCreditTailZoom('crTailZoomChartTsi'); } catch (e) { console.warn('[CreditTSI] tail zoom failed', e); }
}
export function renderCreditMsdPanel() {
  const src = document.getElementById('creditMsdTableContainer0');
  const dst = document.getElementById('creditMsdTablePanel');
  if (src && dst) dst.innerHTML = src.innerHTML;
  try { renderCreditTailZoom('crTailZoomChartMsd'); } catch (e) { console.warn('[CreditMSD] tail zoom failed', e); }
}

export function renderCreditOverviewCharts() {
  try { renderCreditLossDist('crLossDistChart', 'rating'); } catch (e) { console.warn('[CreditOverview] loss dist failed', e); }
  try { renderCreditLossDist('crLossDistChartNorm', 'norm'); } catch (e) { console.warn('[CreditOverview] loss dist (norm) failed', e); }
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

// Concentration Risk: gleicher .mr-limit-Rahmen (Kopf/Balken/Skala), KEINE Limit-Auslastung und
// KEINE unteren Boxen (Concentration % + Effective tail drivers stehen bereits links). Balken =
// 3 Zonen (gruen 0..GREEN_MAX / gelb GREEN_MAX..YELLOW_MAX / rot YELLOW_MAX..100) + Marker.
function concLimitHtml(pct) {
  if (!Number.isFinite(pct)) return '<div class="mr-dash-intro">No concentration data.</div>';
  const p = Math.max(0, Math.min(100, pct));
  const state = pct >= CONC_YELLOW_MAX ? 'red' : pct >= CONC_GREEN_MAX ? 'yellow' : 'green';
  const f1 = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return `
    <div class="mr-limit">
      <div class="mr-limit__head">
        <span class="mr-limit__title">Concentration level</span>
        <span class="mr-limit__util mr-amp--${state}">${f1(pct)}%</span>
      </div>
      <div class="mr-limit__bar">
        <div class="mr-limit__zone" style="left:0;width:${CONC_GREEN_MAX}%;background:rgba(76,175,80,.45)"></div>
        <div class="mr-limit__zone" style="left:${CONC_GREEN_MAX}%;width:${CONC_YELLOW_MAX - CONC_GREEN_MAX}%;background:rgba(224,176,0,.50)"></div>
        <div class="mr-limit__zone" style="left:${CONC_YELLOW_MAX}%;width:${100 - CONC_YELLOW_MAX}%;background:rgba(211,47,47,.50)"></div>
        <div class="cr-conc-mk" style="left:${p}%"></div>
      </div>
      <div class="mr-limit__scale cr-conc-scale2">
        <span style="left:0%">0%</span>
        <span style="left:${CONC_GREEN_MAX}%">${CONC_GREEN_MAX}%</span>
        <span style="left:${CONC_YELLOW_MAX}%">${CONC_YELLOW_MAX}%</span>
        <span style="left:100%">100%</span>
      </div>
    </div>`;
}

function limitBarHtml(m) {
  if (!m) return '<div class="mr-dash-intro">No limit data.</div>';
  const amp = `mr-amp--${m.state || 'neutral'}`;
  const fillW = Math.min(100, m.util * 100);
  return `
    <div class="mr-limit">
      <div class="mr-limit__head">
        <span class="mr-limit__title">Limit utilization</span>
        <span class="mr-limit__util ${amp}">${(m.util * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%</span>
      </div>
      <div class="mr-limit__bar">
        <div class="mr-limit__zone mr-limit__zone--green" style="left:0;width:${m.yellowRatio}%"></div>
        <div class="mr-limit__zone mr-limit__zone--amber" style="left:${m.yellowRatio}%;width:${100 - m.yellowRatio}%"></div>
        <div class="mr-limit__fill mr-limit__fill--${m.state || 'neutral'}" style="width:${fillW}%"></div>
      </div>
      <div class="mr-limit__scale">
        <span>0%</span>
        <span>Warning ${m.yellowPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%</span>
        <span>Limit ${m.redPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%</span>
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
