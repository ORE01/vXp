'use strict';

// Liquidity Dashboard (erste, einfache Version): Faelligkeiten-Balken (Notional pro
// Maturity-Bucket, EUR mn) + KPI-Band. Nutzt MATURITY_YEAR + NOTIONAL der Portfolio-
// Rows (wie liquidity.js). Echte Cashflows (Kupons) + Reserve/Risikolimit folgen.

import { getColorFromPalette, getContrastColor } from '../../utils/colors.js';
import {
  setLiqDrillData, liqChartHoverMenu, liqChartClickDrill, scheduleHideConcMenu,
} from './SummaryBreakdown.js';

let _liqDashChart = null;
let _lastRows = [];
let _listenerBound = false;
// Aktuelle Balken-Segmentierung: null = ein Balken (Total, navy); '__POSITIONS' =
// eine Schicht je Position; sonst ein Datenfeld (ISSUER/CATEGORY/...) -> Schicht je Wert.
// Wird durch die Menue-Wahl im Floating-Menue gesetzt ('liq:chart-group'-Event).
let _chartField = null;

// Ein Bucket je tatsaechlich vorhandenem Faelligkeitsjahr (aufsteigend, kein "+"-Sammel-
// bucket) -> alle Maturities werden einzeln angefuehrt.
function bucketize(rows) {
  const set = new Set();
  for (const r of rows) {
    const y = parseInt(r?.MATURITY_YEAR, 10);
    if (Number.isFinite(y)) set.add(y);
  }
  const years = [...set].sort((a, b) => a - b);
  const labels = years.map(String);
  const pos = new Map(years.map((y, i) => [y, i]));
  const idxOf = (year) => (Number.isFinite(year) && pos.has(year)) ? pos.get(year) : -1;
  return { labels, idxOf };
}

// Notional je Maturity-Bucket + Drill-Schritte (mit match-Praedikat je Bucket, damit
// ein Balken-Klick den Bucket exakt filtert — analog zu den Rating-Buckets in Overview).
function bucketMaturities(rows) {
  const { labels, idxOf } = bucketize(rows);
  const sums = new Array(labels.length).fill(0);
  for (const r of rows) {
    const i = idxOf(parseInt(r?.MATURITY_YEAR, 10));
    if (i >= 0) sums[i] += Number.parseFloat(r?.NOTIONAL) || 0;
  }
  const steps = labels.map((lab, i) => ({
    colKey: '__MAT_BUCKET', value: lab, label: 'Maturity',
    match: (r) => idxOf(parseInt(r?.MATURITY_YEAR, 10)) === i,
  }));
  return { labels, sums, steps, idxOf };
}

function normVal(raw) {
  const empty = raw === undefined || raw === null || String(raw).trim() === '';
  return empty ? 'Unknown' : String(raw).trim();
}

// Balken-Datasets je nach Segmentierung bauen.
//   field null        -> ein Dataset (Total pro Bucket, navy).
//   field '__POSITIONS' -> ein Dataset je Position (duenne Schichten, im eigenen Bucket).
//   field '<col>'     -> ein Dataset je distinktem Feldwert (kontrast-Palette).
function buildSegments(rows, labels, idxOf, sums, field) {
  const toMn = (v) => +(v / 1e6).toFixed(2);
  const navy = getColorFromPalette(0, 0.9);

  if (!field) {
    return {
      stacked: false,
      datasets: [{
        data: sums.map(v => +(v / 1e6).toFixed(1)),
        backgroundColor: navy, borderColor: navy, borderWidth: 0,
        maxBarThickness: 48, borderRadius: 3,
      }],
    };
  }

  if (field === '__POSITIONS') {
    const entries = rows.map((r, k) => ({
      bi: idxOf(parseInt(r?.MATURITY_YEAR, 10)),
      notional: Number.parseFloat(r?.NOTIONAL) || 0,
      label: (r?.DESCRIPTION || (r?.PROD_ID != null ? `#${r.PROD_ID}` : `#${k}`)).toString(),
    })).filter(e => e.bi >= 0 && e.notional > 0);
    entries.sort((a, b) => (a.bi - b.bi) || (b.notional - a.notional));
    const datasets = entries.map((e, i) => {
      const arr = new Array(labels.length).fill(0);
      arr[e.bi] = toMn(e.notional);
      return {
        label: e.label, data: arr,
        backgroundColor: getColorFromPalette(i, 0.9),
        borderColor: 'rgba(255,255,255,0.5)', borderWidth: 0.5,
        maxBarThickness: 48, stack: 'liq',
      };
    });
    return { stacked: true, datasets };
  }

  const totals = {};
  rows.forEach(r => { const v = normVal(r?.[field]); totals[v] = (totals[v] || 0) + (Number.parseFloat(r?.NOTIONAL) || 0); });
  const values = Object.keys(totals).sort((a, b) => totals[b] - totals[a]);
  const datasets = values.map((val, vi) => {
    const arr = new Array(labels.length).fill(0);
    rows.forEach(r => {
      if (normVal(r?.[field]) !== val) return;
      const bi = idxOf(parseInt(r?.MATURITY_YEAR, 10));
      if (bi >= 0) arr[bi] += Number.parseFloat(r?.NOTIONAL) || 0;
    });
    return {
      label: val, data: arr.map(toMn),
      backgroundColor: getContrastColor(vi, 0.88),
      borderColor: 'rgba(255,255,255,0.4)', borderWidth: 0.5,
      maxBarThickness: 48, stack: 'liq',
    };
  });
  return { stacked: true, datasets };
}

function renderKpis(rows, labels, sums) {
  const el = document.getElementById('liqDashKpi');
  if (!el) return;
  const total = sums.reduce((s, v) => s + v, 0);
  let maxI = 0;
  for (let i = 1; i < sums.length; i++) if (sums[i] > sums[maxI]) maxI = i;
  const cyIdx = labels.indexOf(String(new Date().getFullYear()));
  const next12 = cyIdx >= 0 ? sums[cyIdx] : 0;
  const fmtMn = (v) => `EUR ${Math.round((v || 0) / 1e6)} mn`;
  const tiles = [
    { v: fmtMn(next12), l: 'Maturing next 12 months' },
    { v: `${labels[maxI]}: ${fmtMn(sums[maxI])}`, l: 'Largest maturity' },
    { v: fmtMn(total), l: 'Total notional' },
    { v: String(rows.length), l: 'Positions' },
  ];
  el.innerHTML = tiles.map(t =>
    `<div class="conc-kpi"><div class="conc-kpi__val">${t.v}</div><div class="conc-kpi__lbl">${t.l}</div></div>`
  ).join('');

  // KPI-Leiste zusaetzlich als versteckte Tabelle spiegeln, damit die Report-Erfassung
  // sie (wie #concKeyFiguresTable) in Preview + PDF uebernimmt.
  const tblEl = document.getElementById('liqDashKpiTable');
  if (tblEl) {
    const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    tblEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      tiles.map(t => `<tr><td>${esc(t.l)}</td><td>${esc(t.v)}</td></tr>`).join('')
    }</tbody></table>`;
  }
}

export function renderLiquidityDashboard(filteredData, opts = {}) {
  const rows = Array.isArray(filteredData) ? filteredData : _lastRows;
  _lastRows = rows;
  bindOpenListener();
  // Bei datengetriebenem Render (Portfolio-Wechsel/Panel-Open) zurueck auf Total-Balken;
  // nur der Menue-getriebene Re-Render (keepGroup) haelt die Segmentierung.
  if (!opts.keepGroup) _chartField = null;

  // Drill-Engine (in SummaryBreakdown) die aktuellen Portfolio-Rows geben.
  try { setLiqDrillData(rows); } catch {}

  const { labels, sums, steps, idxOf } = bucketMaturities(rows);
  renderKpis(rows, labels, sums);

  const canvas = document.getElementById('liqDashMaturityChart');
  if (!canvas || !window.Chart) return;
  if (_liqDashChart) { try { _liqDashChart.destroy(); } catch {} _liqDashChart = null; }

  // Beim Verlassen des Canvas das Floating-Menue planmaessig ausblenden (einmal binden).
  if (!canvas.dataset.liqLeaveBound) {
    canvas.dataset.liqLeaveBound = '1';
    canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
  }

  // Feste Canvas-Groesse + responsive:false -> malt auch bei verstecktem Panel
  // (Preview/PDF), analog zu Structure/Scenario.
  canvas.width = 720;
  canvas.height = 320;

  const bodyCss = getComputedStyle(document.body);
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';

  const seg = buildSegments(rows, labels, idxOf, sums, _chartField);

  _liqDashChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: seg.datasets },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      // Nur das Segment unter dem Cursor treffen (sonst riesiger Tooltip bei vielen Schichten).
      interaction: { mode: 'nearest', intersect: true },
      // Klick auf einen Balken -> Drill (Positionen dieser Faelligkeit); Hover ->
      // Floating-Menue (Positions / By Issuer / By Category / ...), wie in Overview.
      onHover: (evt, els) => { try { liqChartHoverMenu(evt, els, steps); } catch {} },
      onClick: (evt, els) => { try { liqChartClickDrill(els, steps); } catch {} },
      plugins: {
        legend: { display: false },
        tooltip: {
          mode: 'nearest', intersect: true,
          callbacks: {
            label: (ctx) => {
              const v = Number(ctx.parsed.y) || 0;
              const lbl = ctx.dataset?.label;
              return (seg.stacked && lbl) ? `${lbl}: EUR ${v.toFixed(1)} mn` : `EUR ${v.toFixed(1)} mn`;
            },
          },
        },
      },
      scales: {
        x: { stacked: seg.stacked, ticks: { color: chartColor, font: { family: chartFont, size: 11 } }, grid: { display: false } },
        y: {
          stacked: seg.stacked,
          title: { display: true, text: 'EUR mn', color: chartColor, font: { family: chartFont } },
          ticks: { color: chartColor, font: { family: chartFont } },
          grid: { color: 'rgba(128,128,128,0.15)' }, beginAtZero: true,
        },
      },
    },
  });
}

function bindOpenListener() {
  if (_listenerBound) return;
  _listenerBound = true;
  document.addEventListener('panel:opened', (e) => {
    if (e?.detail?.panelId === 'panel-liquidity-dash') {
      requestAnimationFrame(() => renderLiquidityDashboard(_lastRows));
    }
  });
  // Menue-Wahl im Floating-Menue (SummaryBreakdown) -> Balken entsprechend segmentieren.
  document.addEventListener('liq:chart-group', (e) => {
    _chartField = e?.detail?.field || null;
    renderLiquidityDashboard(_lastRows, { keepGroup: true });
  });
}
