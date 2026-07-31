'use strict';

// Liquidity Dashboard (erste, einfache Version): Faelligkeiten-Balken (Notional pro
// Maturity-Bucket, EUR mn) + KPI-Band. Nutzt MATURITY_YEAR + NOTIONAL der Portfolio-
// Rows (wie liquidity.js). Echte Cashflows (Kupons) + Reserve/Risikolimit folgen.

import { getColorFromPalette } from '../../utils/colors.js';
import {
  setLiqDrillData, liqChartHoverMenu, scheduleHideConcMenu, bindRightClickDrill,
} from './SummaryBreakdown.js';

let _liqDashChart = null;
let _lastRows = [];
let _listenerBound = false;
// Aktuelle Bucket-Steps fuer den (einmalig gebundenen) Rechtsklick-Drill. Wird bei
// jedem Render neu gesetzt, damit der Handler nach Portfolio-/Segmentwechsel die
// richtigen Faelligkeits-Buckets trifft.
let _liqSteps = [];
// Aktuelle Balken-Segmentierung: null = ein Balken (Total, navy); '__POSITIONS' =
// eine Schicht je Position; sonst ein Datenfeld (ISSUER/CATEGORY/...) -> Schicht je Wert.
// Wird durch die Menue-Wahl im Floating-Menue gesetzt ('liq:chart-group'-Event).
let _chartField = null;
// Pivot-Tabelle (Category x alle Laufzeiten) NUR sichtbar, wenn der "By Category"-
// Button gedrueckt wurde. Unabhaengig von der Chart-Segmentierung (_chartField).
let _showCategoryPivot = false;

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

// Lesbare, dezente Label-Farbe fuer ein Segment: dunkelgrau auf hellen Flaechen,
// weiches Weiss auf dunklen. Akzeptiert rgb(a)/#hex.
function __segTextColor(col) {
  let r = 128, g = 128, b = 128;
  if (typeof col === 'string') {
    const m = col.match(/rgba?\(([^)]+)\)/i);
    if (m) { const p = m[1].split(',').map(s => parseFloat(s)); r = p[0]; g = p[1]; b = p[2]; }
    else if (col[0] === '#') {
      const h = col.slice(1);
      const s = h.length === 3 ? h.replace(/(.)/g, '$1$1') : h;
      r = parseInt(s.slice(0, 2), 16); g = parseInt(s.slice(2, 4), 16); b = parseInt(s.slice(4, 6), 16);
    }
  }
  const lum = 0.299 * r + 0.587 * g + 0.114 * b;
  return lum > 150 ? '#333333' : 'rgba(255,255,255,0.9)';
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
      backgroundColor: getColorFromPalette(vi, 0.88),
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

// Pivot-Tabelle: Zeilen = CATEGORY, Spalten = Faelligkeitsjahre (labels) + "Summ"
// (Zeilensumme); letzte Zeile "Gesamtergebnis" = Spaltensummen + Gesamtsumme. Werte
// = summiertes NOTIONAL. Wie im Screenshot; nur sichtbar bei Gruppierung "By Category".
function renderLiqCategoryPivot(rows, labels, show) {
  const panel = document.getElementById('liqDashCategoryPivot');
  const tblEl = document.getElementById('liqDashCategoryPivotTable');
  if (!panel || !tblEl) return;
  // Nur wenn by-category aktiv: Tabelle als report-erfassbaren .data-container
  // markieren (sonst wandert keine leere Tabelle in Preview/PDF).
  if (!show) {
    panel.style.display = 'none';
    tblEl.classList.remove('data-container');
    tblEl.innerHTML = '';
    return;
  }
  panel.style.display = '';

  const cats = [...new Set((rows || []).map(r => normVal(r?.CATEGORY)))].sort((a, b) => String(a).localeCompare(String(b)));
  const yearIdx = new Map(labels.map((l, i) => [l, i]));
  const matrix = new Map(cats.map(c => [c, new Array(labels.length).fill(0)]));
  const colTot = new Array(labels.length).fill(0);
  let grand = 0;
  for (const r of (rows || [])) {
    const c = normVal(r?.CATEGORY);
    const y = String(parseInt(r?.MATURITY_YEAR, 10));
    const ci = yearIdx.has(y) ? yearIdx.get(y) : -1;
    if (ci < 0 || !matrix.has(c)) continue;
    const v = Number.parseFloat(r?.NOTIONAL) || 0;
    matrix.get(c)[ci] += v;
    colTot[ci] += v;
    grand += v;
  }
  // Werte in EUR mn (1 Nachkommastelle) — sonst brechen die vollen Betraege in den
  // schmalen PDF-Spalten mitten in der Zahl um.
  const fmt = (v) => ((Number(v) || 0) / 1e6).toLocaleString('de-DE', { maximumFractionDigits: 1 });
  const esc = (s) => String(s ?? '').replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
  const head = `<tr><th>Maturity/Category (EUR mn)</th>${labels.map(l => `<th style="text-align:right;">${esc(l)}</th>`).join('')}<th style="text-align:right;">Sum</th></tr>`;
  const bodyRows = cats.map(c => {
    const arr = matrix.get(c);
    const rowSum = arr.reduce((s, v) => s + v, 0);
    return `<tr><td>${esc(c)}</td>${arr.map(v => `<td style="text-align:right;">${fmt(v)}</td>`).join('')}<td class="liq-pivot-sum" style="text-align:right;">${fmt(rowSum)}</td></tr>`;
  }).join('');
  const totalRow = `<tr class="liq-pivot-total"><td>Total</td>${colTot.map(v => `<td style="text-align:right;">${fmt(v)}</td>`).join('')}<td style="text-align:right;">${fmt(grand)}</td></tr>`;
  tblEl.innerHTML = `<table class="conc-detail-tbl liq-pivot-tbl"><thead>${head}</thead><tbody>${bodyRows}${totalRow}</tbody></table>`;
  // Fuer die Report-Erfassung (discoverTablesFromPanel liest .data-container[id]).
  // maxCols hoch, damit die breite Pivot-Tabelle (viele Jahre) in der Preview nicht
  // auf 8 Spalten gekappt wird.
  tblEl.classList.add('data-container');
  tblEl.dataset.label = 'Maturity — Category (annual cash flows, EUR mn)';
  tblEl.dataset.maxCols = String(labels.length + 2);
}

export function renderLiquidityDashboard(filteredData, opts = {}) {
  const rows = Array.isArray(filteredData) ? filteredData : _lastRows;
  _lastRows = rows;
  bindOpenListener();
  // Bei datengetriebenem Render (Portfolio-Wechsel/Panel-Open) zurueck auf Total-Balken
  // und Pivot-Tabelle aus (wie zuvor). Nur der Menue-/Button-getriebene Re-Render
  // (keepGroup) haelt Segmentierung bzw. Pivot-Anzeige.
  if (!opts.keepGroup) { _chartField = null; _showCategoryPivot = false; }

  // Drill-Engine (in SummaryBreakdown) die aktuellen Portfolio-Rows geben.
  try { setLiqDrillData(rows); } catch {}

  const { labels, sums, steps, idxOf } = bucketMaturities(rows);
  _liqSteps = steps;   // fuer den Rechtsklick-Drill (Handler liest sie zur Klickzeit)
  renderKpis(rows, labels, sums);
  // Pivot-Tabelle Category x Jahr NUR wenn per "By Category"-Button angefordert.
  renderLiqCategoryPivot(rows, labels, _showCategoryPivot);

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

  // %-Anteile in die Segmente schreiben — NUR bei Gruppierung "By Category" (wenige
  // Segmente). Bei Issuer/Positions waeren es zu viele/duenne Schichten (unlesbar).
  const wantSegPct = !!(window.ChartDataLabels && seg.stacked && _chartField === 'CATEGORY');

  _liqDashChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: wantSegPct ? [window.ChartDataLabels] : [],
    data: { labels, datasets: seg.datasets },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      // Nur das Segment unter dem Cursor treffen (sonst riesiger Tooltip bei vielen Schichten).
      interaction: { mode: 'nearest', intersect: true },
      // Drill NUR per Rechtsklick (unten via bindRightClickDrill gebunden) — wie in
      // allen anderen Charts. Kein Hover-/Linksklick-Menue mehr.
      plugins: {
        // Legende oben NUR bei "By Category" (wenige Kategorien); bei Issuer/Positions
        // waeren es zu viele Eintraege.
        legend: (_chartField === 'CATEGORY') ? {
          display: true, position: 'top',
          labels: { color: chartColor, font: { family: chartFont, size: 11 }, boxWidth: 12, usePointStyle: true, pointStyle: 'rectRounded' },
        } : { display: false },
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
        // Anteil des Segments am jeweiligen Jahresbalken (Segmente je Balken = 100 %).
        datalabels: wantSegPct ? {
          // Farbe je Segment an die Hintergrundhelligkeit anpassen; Schrift dezent
          // (nicht fett), ohne Rand -> ruhiger Look.
          color: (dctx) => {
            const bg = dctx.dataset?.backgroundColor;
            return __segTextColor(Array.isArray(bg) ? bg[dctx.dataIndex] : bg);
          },
          font: { family: chartFont, size: 10, weight: '400' },
          anchor: 'center', align: 'center', clamp: true,
          formatter: (value, dctx) => {
            const v = Number(value) || 0;
            if (v <= 0) return '';
            const ds = dctx.chart.data.datasets;
            let barTotal = 0;
            for (const d of ds) barTotal += Number(d.data[dctx.dataIndex]) || 0;
            if (barTotal <= 0) return '';
            const pct = v / barTotal * 100;
            if (pct < 5) return '';   // zu kleine Segmente nicht beschriften (Platz)
            return `${pct.toFixed(pct < 10 ? 1 : 0)}%`;
          },
        } : { display: false },
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

  // Drill NUR per Rechtsklick (contextmenu) — einmalig gebunden, liest Chart + Steps
  // zur Klickzeit. Rechtsklick auf einen Balken oeffnet das Floating-Menue (Positions /
  // By Issuer / By Category / ...) am Cursor, konsistent mit allen anderen Drill-Charts.
  bindRightClickDrill(canvas, () => _liqDashChart, (el, ch, e) => {
    try { liqChartHoverMenu({ native: e, chart: ch }, [el], _liqSteps); } catch {}
  });
}

// Hook fuer die Report-Erzeugung: erzwingt den by-category-Zustand (Chart nach
// Kategorie + Pivot-Tabelle), damit Preview/PDF das Dashboard immer so zeigen —
// unabhaengig davon, ob der Nutzer es vorher aktiviert/geoeffnet hat.
export function prepareLiquidityDashboardForReport() {
  _chartField = 'CATEGORY';
  _showCategoryPivot = true;
  renderLiquidityDashboard(_lastRows, { keepGroup: true });
}

function bindOpenListener() {
  if (_listenerBound) return;
  _listenerBound = true;

  // "By Category"-Button (oben rechts in der Maturities-Karte): stellt die Kategorie-
  // Segmentierung + Pivot-Tabelle jederzeit wieder her.
  const catBtn = document.getElementById('liqCategoryBtn');
  if (catBtn) {
    catBtn.addEventListener('click', () => {
      _chartField = 'CATEGORY';
      _showCategoryPivot = true;   // Pivot NUR ueber diesen Button anzeigen
      renderLiquidityDashboard(_lastRows, { keepGroup: true });
    });
  }

  document.addEventListener('panel:opened', (e) => {
    if (e?.detail?.panelId === 'panel-liquidity-dash') {
      // Beim Oeffnen die "By Category"-Ansicht (Chart nach Kategorie + Pivot-Tabelle)
      // voreinstellen, wie sie der Button liefert. keepGroup haelt den Zustand.
      _chartField = 'CATEGORY';
      _showCategoryPivot = true;
      requestAnimationFrame(() => renderLiquidityDashboard(_lastRows, { keepGroup: true }));
    }
  });
  // Menue-Wahl im Floating-Menue (SummaryBreakdown) -> Balken entsprechend segmentieren.
  document.addEventListener('liq:chart-group', (e) => {
    _chartField = e?.detail?.field || null;
    _showCategoryPivot = false;   // Menue-Wahl -> im Chart zeigen, Pivot-Tabelle aus
    renderLiquidityDashboard(_lastRows, { keepGroup: true });
  });
}
