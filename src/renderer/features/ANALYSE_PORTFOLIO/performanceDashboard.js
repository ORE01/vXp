'use strict';

// Performance-Dashboard (#panel-performance-dashboard) mit ECHTEN Daten:
//  - Rendite-Verlauf + KPIs (Portfoliorendite / Vorperiode / Ertrag) aus
//    PortfolioHistoryMetrics (appState.getPortfolioHistoryData(), Feld RETURN/PROFIT_LOSS).
//  - Attribution (Beitrag je CATEGORY + Top/Flop je Position) aus den Positionsdaten
//    (appState.getAllPortfolioData(): NAV, PRICE_BUY, NOTIONAL, CATEGORY, DESCRIPTION):
//      Positions-P&L = NAV - NOTIONAL*PRICE_BUY/100 ; Beitrag %-Pkt = P&L / Summe-Kaufwert.
//      Skaliert, damit die Summe der Beitraege der aktuellen Rendite (RETURN) entspricht.
// Themebar: Chart-Farben aus CSS-Variablen (Dark/Light), Serienfarbe markenneutrales Gruen.

import { appState } from '../../renderer.js';
import { createContribDrill, scheduleHideConcMenu } from './SummaryBreakdown.js';

// Standard-Drill (wie ueberall: Rechtsklick -> Menue "Positions / By Category / By Issuer /
// ..." -> Detailtabelle mit Breadcrumb). Eigener Detail-/Menue-Container unter den Listen.
// valueType = __PERF_PNL (P&L je Position); Rating als Info-Spalte in der Positions-Sicht.
const _perfDrillCfg = {
  detailId: 'perfDrillDetail', titleId: 'perfDrillDetailTitle', tableId: 'perfDrillDetailTable',
  closeId: 'perfDrillDetailClose', menuId: 'perfDrillCardMenu',
  valueType: '__PERF_WYIELD', valueLabel: 'Yield contrib %',
  infoCol: { key: 'RATINGres', label: 'Rating' },
};
const perfDrill = createContribDrill({ var: _perfDrillCfg, es: _perfDrillCfg });

let _perfReturnChart = null;

function _cssVar(name, fallback) {
  const v = getComputedStyle(document.body).getPropertyValue(name);
  return (v && v.trim()) || fallback;
}
function _num(v) { const n = parseFloat(v); return Number.isFinite(n) ? n : null; }
function _setText(id, txt) { const el = document.getElementById(id); if (el) el.textContent = txt; }
function _esc(s) { return String(s ?? '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
// Vorzeichen-Prozent aus Fraktion (0.048 -> "+4,8 %"). d = Nachkommastellen.
function _pctFrac(frac, d = 1) {
  if (frac == null) return '–';
  const p = frac * 100;
  return `${p >= 0 ? '+' : '−'}${Math.abs(p).toFixed(d)} %`;
}
// Prozentpunkte (bereits in %-Einheiten) mit Vorzeichen -> "ppt".
function _ppt(pt, d = 2) {
  return `${pt >= 0 ? '+' : '−'}${Math.abs(pt).toFixed(d)} ppt`;
}
function _eur(v) {
  if (v == null) return '–';
  const a = Math.abs(v);
  if (a >= 1e9) return `EUR ${(v / 1e9).toFixed(1)} bn`;
  if (a >= 1e6) return `EUR ${(v / 1e6).toFixed(1)} M`;
  if (a >= 1e3) return `EUR ${Math.round(v / 1e3).toLocaleString('en-US')} K`;
  return `EUR ${Math.round(v).toLocaleString('en-US')}`;
}

export function renderPerformanceDashboard() {
  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();

  // --- History (portfolio-weit) ---
  const allHist = (typeof appState.getPortfolioHistoryData === 'function') ? (appState.getPortfolioHistoryData() || []) : [];
  const hist = (Array.isArray(allHist) ? allHist : [])
    .filter(r => !port || String(r?.port_name ?? '').trim() === port)
    .slice().sort((a, b) => new Date(a.DATE) - new Date(b.DATE));

  const dates = hist.map(r => r.DATE);
  const returnsFrac = hist.map(r => _num(r.RETURN));          // Fraktionen (0.048)
  const lastRow = hist[hist.length - 1] || {};
  const curRet = _num(lastRow.RETURN);
  const ertrag = _num(lastRow.PROFIT_LOSS);

  // Portfolio-Yield LIVE aus den Positionen: Σ ytmPort / Σ Notional (nominalgewichtete
  // Kauf-Yield, ytmPort = ytm_BUY × Notional), konsistent mit der Home-Overview-Kachel.
  // Das ist NICHT der letzte Historic-RETURN — der gehoert in "Previous period".
  const posRows = (typeof appState.getAllPortfolioData === 'function') ? (appState.getAllPortfolioData() || []) : [];
  let sumYtmPort = 0, sumNotional = 0;
  for (const r of (Array.isArray(posRows) ? posRows : [])) {
    const p = String(r?.port_name ?? r?.PORT_NAME ?? '').trim();
    if (port && p && p !== port) continue;
    sumYtmPort += _num(r.ytmPort ?? r.ytmport ?? r.YTMPORT) || 0;
    sumNotional += _num(r.NOTIONAL ?? r.notional) || 0;
  }
  const portYield = sumNotional ? (sumYtmPort / sumNotional) : null;
  const _yieldTxt = portYield != null ? `${(portYield * 100).toFixed(2)} %` : '–';

  // --- KPIs ---
  // PORTFOLIO YIELD = live gewichtete Yield (ytmPortA/Notional); PREVIOUS PERIOD YIELD
  // = juengster Historic-Eintrag (RETURN).
  _setText('perfKpiReturn', _yieldTxt);
  _setText('perfKpiPrev', _pctFrac(curRet));
  _setText('perfKpiErtrag', _eur(ertrag));
  const badge = document.getElementById('perfKpiBadge');
  if (badge) {
    if (portYield != null && curRet != null) {
      const dPt = (portYield - curRet) * 100;
      badge.textContent = `${dPt >= 0 ? '↑ ' : '↓ '}${_ppt(dPt, 1)} vs. previous period`;
      badge.style.display = '';
    } else {
      badge.style.display = 'none';
    }
  }

  // --- Report-Spiegel: KPI-Band-Tabelle (data-kpi-band) fuer Preview/PDF ---
  const kpiTbl = document.getElementById('perfKpiTable');
  if (kpiTbl) {
    const kpiRows = [
      ['Portfolio yield', _yieldTxt],
      ['Previous period yield', _pctFrac(curRet)],
      ['Profit / Loss', _eur(ertrag)],
    ];
    kpiTbl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      kpiRows.map(([k, v]) => `<tr><td>${_esc(k)}</td><td>${_esc(v)}</td></tr>`).join('')
    }</tbody></table>`;
  }

  // --- Attribution (gewichtete Yield je Position) ---
  renderPerfAttribution(port);

  // --- Rendite-Verlauf (in % darstellen) ---
  renderPerfReturnChart(dates, returnsFrac.map(v => (v == null ? null : v * 100)));

  ensurePerfListDrillBound();
  bindPerformanceDashboardTheme();
}

// ---- Attribution: GEWICHTETE YIELD je Position (Gewicht x Yield) ----
function renderPerfAttribution(port) {
  const topEl = document.getElementById('perfTopList');
  const flopEl = document.getElementById('perfFlopList');

  const rows = (typeof appState.getAllPortfolioData === 'function') ? (appState.getAllPortfolioData() || []) : [];
  const pos = (Array.isArray(rows) ? rows : []).filter(r => {
    const p = String(r?.port_name ?? r?.PORT_NAME ?? '').trim();
    return !port || !p || p === port;
  });

  let totalNav = 0;
  const items = [];
  const drillRows = [];
  for (const r of pos) {
    const nav = _num(r.NAV ?? r.nav ?? r.NAV_BASE);
    const yieldBuy = _num(r.ytm_BUY ?? r.YTM_BUY ?? r.ytm_buy);      // Bruch (0.0399)
    const wyRaw = _num(r.ytmPortA ?? r.ytmporta ?? r.YTMPORTA);      // bereits NAV-gewichtete Yield
    if (nav == null || !(nav > 0)) continue;
    totalNav += nav;
    const prodId = r.PROD_ID ?? r.prod_id ?? null;
    items.push({
      prodId,
      issuer: String(r.ISSUER ?? r.issuer ?? '').trim(),
      yieldBuy,
      wyRaw,
      name: String(r.PROD_ID ?? r.prod_id ?? r.DESCRIPTION ?? r.description ?? '-'),
      nav,
    });
    drillRows.push({ ...r, PROD_ID: prodId });
  }

  if (!items.length || !(totalNav > 0)) {
    if (topEl) topEl.innerHTML = '<li><span class="perf-list__name">No data.</span></li>';
    if (flopEl) flopEl.innerHTML = '<li><span class="perf-list__name">No data.</span></li>';
    _reportListTable([], 'perfTopTable');
    _reportListTable([], 'perfFlopTable');
    renderPerfScatter([]);
    return;
  }

  // Gewichtete Yield je Position = View-Spalte ytmPortA (bereits NAV-gewichtet).
  // Summe ueber alle Positionen = Portfolio-Yield-Basis.
  let totalWY = 0;
  items.forEach((it) => {
    it.weight = it.nav / totalNav;                     // NAV-Anteil (fuer x-Achse)
    it.wyield = (it.wyRaw != null) ? it.wyRaw : 0;     // ytmPortA (fertig gewichtet)
    totalWY += it.wyield;
  });
  items.forEach((it, i) => {
    it.yShare = totalWY ? it.wyield / totalWY * 100 : 0;  // Anteil an der Portfolio-Yield %
    drillRows[i].__PERF_WYIELD = +it.yShare.toFixed(3);   // %-Wert fuer den Drill
  });

  try { perfDrill.setData(drillRows); } catch (e) { console.warn('[perf] drill data failed', e); }

  // Scatter: x = Portfolioanteil % (NAV), y = Anteil an der Portfolio-Yield %
  //   (ytmPortA der Position / Summe). Diagonale = proportional (= Durchschnittsyield).
  const points = items.map(it => ({
    x: +(it.weight * 100).toFixed(3),
    y: +it.yShare.toFixed(3),
    name: it.name,
    prodId: it.prodId != null ? String(it.prodId) : '',
  }));
  renderPerfScatter(points);

  // Listen nach gewichteter Yield (hoechster/niedrigster Beitrag); Wert = Yield (buy).
  const sorted = items.slice().sort((a, b) => b.wyield - a.wyield);
  const topItems = sorted.slice(0, 3);
  const flopItems = sorted.slice(-3).reverse();
  if (topEl) topEl.innerHTML = _listHtml(topItems, 'pos');
  if (flopEl) flopEl.innerHTML = _listHtml(flopItems, 'neg');
  // Report-Spiegel: dieselben Listen als Tabellen (Preview/PDF erfassen .data-container).
  _reportListTable(topItems, 'perfTopTable');
  _reportListTable(flopItems, 'perfFlopTable');
}

// Spiegelt eine Top/Flop-Liste als report-erfassbare Tabelle (versteckter .data-container).
function _reportListTable(items, elId) {
  const el = document.getElementById(elId);
  if (!el) return;
  if (!items || !items.length) {
    el.innerHTML = '<table class="conc-report-table"><tbody><tr><td>No data.</td></tr></tbody></table>';
    return;
  }
  const body = items.map((it, i) => {
    const y = (it.yieldBuy != null) ? `${(it.yieldBuy * 100).toFixed(2)} %` : '–';
    return `<tr><td>${i + 1}</td><td>${_esc(it.name)}</td><td>${_esc(it.issuer || '')}</td><td style="text-align:right;">${y}</td></tr>`;
  }).join('');
  el.innerHTML = `<table class="conc-report-table"><thead><tr><th>#</th><th>Product</th><th>Issuer</th><th style="text-align:right;">Yield (buy)</th></tr></thead><tbody>${body}</tbody></table>`;
}

// ---- Scatter "Where does the yield come from?" (wie MVaR-Contribution) ----
let _perfScatterChart = null;
let _perfScatterLimit = 5;      // Show (beste): 3/5/10/All
let _perfScatterWorst = 0;      // Worst (schlechteste): 0(off)/5/10/All
let _perfScatterPoints = [];

function renderPerfScatter(points) {
  _perfScatterPoints = Array.isArray(points) ? points : [];
  const canvas = document.getElementById('perfYieldScatter');
  if (!canvas || !window.Chart) return;
  if (_perfScatterChart) { try { _perfScatterChart.destroy(); } catch {} _perfScatterChart = null; }

  // Beste (hoechste y) und optional schlechteste (niedrigste y) auswaehlen + vereinen.
  const sortedDesc = _perfScatterPoints.slice().sort((a, b) => b.y - a.y);
  const top = (_perfScatterLimit === 'all') ? sortedDesc.slice() : sortedDesc.slice(0, _perfScatterLimit);
  let worst = [];
  if (_perfScatterWorst === 'all') worst = sortedDesc.slice();
  else if (_perfScatterWorst > 0) worst = sortedDesc.slice(-_perfScatterWorst);
  const seen = new Set();
  const limited = [];
  for (const p of [...top, ...worst]) {
    const k = p.prodId || `${p.name}|${p.x}|${p.y}`;
    if (!seen.has(k)) { seen.add(k); limited.push(p); }
  }
  if (!limited.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  const labelSet = new Set(limited.map(p => p.name));
  const maxima = limited.map(p => Math.max(p.x, p.y)).sort((a, b) => a - b);
  const axMax = Math.max(1, Math.ceil((maxima[maxima.length - 1] || 0) * 1.1));

  const text = _cssVar('--chart-text', '#888');
  const grid = _cssVar('--chart-grid', 'rgba(120,120,120,0.25)');
  const font = _cssVar('--font-family', 'Inter, sans-serif');

  // Feste Bitmap-Groesse -> Chart wird auch bei verstecktem Panel gemalt (Report-Erfassung).
  // Sichtbar koppelt fitCanvasToDisplay den Puffer an die Anzeige (Hover/Drill exakt).
  canvas.width = 560; canvas.height = 300;

  _perfScatterChart = new window.Chart(canvas.getContext('2d'), {
    type: 'scatter',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: {
      datasets: [
        { type: 'line', label: 'proportional', data: [{ x: 0, y: 0 }, { x: axMax, y: axMax }], borderColor: 'rgba(150,165,185,0.7)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, fill: false, order: 2 },
        { label: 'Positions', data: limited, backgroundColor: 'rgba(108,155,209,0.75)', borderColor: 'rgba(108,155,209,0.9)', pointRadius: 6, pointHoverRadius: 7, order: 1 },
      ],
    },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: text,
      interaction: { mode: 'nearest', intersect: true, axis: 'xy' },
      hover: { mode: 'nearest', intersect: true, axis: 'xy' },
      elements: { point: { hitRadius: 8, hoverRadius: 8 } },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw?.name ?? ''}: NAV ${Number(ctx.raw?.x).toFixed(1)}% / yield contrib ${Number(ctx.raw?.y).toFixed(1)}%` } },
        datalabels: window.ChartDataLabels ? { align: 'right', anchor: 'center', offset: 6, color: text, font: { family: font, size: 10 }, formatter: (v) => (v && labelSet.has(v.name) ? v.name : '') } : undefined,
        zoom: {
          pan: { enabled: true, mode: 'xy', modifierKey: 'ctrl' },
          zoom: { wheel: { enabled: true }, pinch: { enabled: true }, drag: { enabled: true, backgroundColor: 'rgba(75,150,225,0.15)', borderColor: 'rgba(75,150,225,0.6)', borderWidth: 1 }, mode: 'xy' },
        },
      },
      scales: {
        x: { beginAtZero: true, max: axMax, title: { display: true, text: 'Portfolio share % (NAV)', color: text, font: { family: font } }, ticks: { color: text, font: { family: font }, callback: (v) => `${Math.round(Number(v) * 10) / 10}%` }, grid: { color: grid } },
        y: { beginAtZero: true, max: axMax, title: { display: true, text: 'Weighted yield contribution %', color: text, font: { family: font } }, ticks: { color: text, font: { family: font }, callback: (v) => `${Math.round(Number(v) * 10) / 10}%` }, grid: { color: grid } },
      },
    },
  });

  ensurePerfScatterTools(canvas);
  ensurePerfScatterDrill(canvas);
}

// Reset-Button + "Show N"-Auswahl + Bedienhinweis (idempotent im Chart-Container).
function ensurePerfScatterTools(canvas) {
  const box = canvas?.parentElement;
  if (!box) return;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  if (!box.querySelector('.perf-sc-hint')) {
    const h = document.createElement('div');
    h.className = 'perf-sc-hint';
    h.textContent = 'Drag to zoom · right-click a point to drill';
    h.style.cssText = 'position:absolute;top:2px;left:6px;z-index:5;font-size:10px;color:#94a3b8;pointer-events:none;';
    box.appendChild(h);
  }
  if (!box.querySelector('.perf-sc-reset')) {
    const btn = document.createElement('button');
    btn.type = 'button'; btn.className = 'perf-sc-reset'; btn.textContent = 'Reset Zoom';
    btn.style.cssText = 'position:absolute;top:2px;right:4px;z-index:6;font-size:10px;padding:2px 8px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;color:#334155;cursor:pointer;';
    btn.addEventListener('click', () => { try { _perfScatterChart?.resetZoom?.(); } catch {} });
    box.appendChild(btn);
  }
  if (!box.querySelector('.perf-sc-count')) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;top:2px;right:86px;z-index:6;display:flex;align-items:center;gap:4px;';
    const lbl = document.createElement('span'); lbl.textContent = 'Best'; lbl.style.cssText = 'font-size:10px;color:#94a3b8;';
    const sel = document.createElement('select'); sel.className = 'perf-sc-count';
    sel.style.cssText = 'font-size:10px;padding:1px 4px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;color:#334155;cursor:pointer;';
    [['0', '–'], ['3', '3'], ['5', '5'], ['10', '10'], ['all', 'All']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
    sel.value = String(_perfScatterLimit);
    sel.addEventListener('change', () => { _perfScatterLimit = sel.value === 'all' ? 'all' : parseInt(sel.value, 10); renderPerfScatter(_perfScatterPoints); });
    wrap.appendChild(lbl); wrap.appendChild(sel);
    box.appendChild(wrap);
  }
  // Zweite Auswahl: die SCHLECHTESTEN N (niedrigste Yield-Beitraege) zusaetzlich zeigen.
  if (!box.querySelector('.perf-sc-worst')) {
    const wrap = document.createElement('div');
    wrap.style.cssText = 'position:absolute;top:2px;right:172px;z-index:6;display:flex;align-items:center;gap:4px;';
    const lbl = document.createElement('span'); lbl.textContent = 'Worst'; lbl.style.cssText = 'font-size:10px;color:#94a3b8;';
    const sel = document.createElement('select'); sel.className = 'perf-sc-worst';
    sel.style.cssText = 'font-size:10px;padding:1px 4px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;color:#334155;cursor:pointer;';
    [['0', '–'], ['5', '5'], ['10', '10'], ['all', 'All']].forEach(([v, t]) => { const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o); });
    sel.value = String(_perfScatterWorst);
    sel.addEventListener('change', () => { _perfScatterWorst = sel.value === 'all' ? 'all' : parseInt(sel.value, 10); renderPerfScatter(_perfScatterPoints); });
    wrap.appendChild(lbl); wrap.appendChild(sel);
    box.appendChild(wrap);
  }
}

// Rechtsklick auf einen Punkt -> Standard-Drill (Positions / By ...) fuer diese PROD_ID.
function ensurePerfScatterDrill(canvas) {
  if (!canvas || canvas.dataset.perfScDrill) return;
  canvas.dataset.perfScDrill = '1';
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    try {
      const chart = _perfScatterChart;
      if (!chart) return;
      const el = (chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || []).find(x => x.datasetIndex === 1);
      if (!el) { scheduleHideConcMenu(); return; }
      const p = chart.data.datasets[1].data[el.index];
      const pid = p?.prodId;
      if (!pid) { scheduleHideConcMenu(); return; }
      perfDrill.hover('var', { native: e }, [{ index: 0 }], [{ colKey: 'PROD_ID', value: String(pid), label: 'Product' }]);
    } catch {}
  });
}

function _listHtml(items, kind) {
  if (!items || !items.length) return '<li><span class="perf-list__name">No data.</span></li>';
  return items.map((it, i) => {
    const rcls = kind === 'neg' ? 'perf-rank--neg' : 'perf-rank--pos';
    const pid = it.prodId != null ? String(it.prodId) : '';
    const yld = (it.yieldBuy != null) ? `${(it.yieldBuy * 100).toFixed(2)} %` : '–';
    return `<li class="perf-li" data-prod="${_esc(pid)}" title="Right-click to drill">
      <span class="perf-rank ${rcls}">${i + 1}</span>
      <span class="perf-list__name">
        <span class="perf-li__id" title="${_esc(it.name)}">${_esc(it.name)}</span>
        <span class="perf-li__issuer" title="${_esc(it.issuer)}">${_esc(it.issuer)}</span>
      </span>
      <span class="perf-yield" title="Yield (buy)">${yld}</span>
      <span class="perf-drill-hint">›</span>
    </li>`;
  }).join('');
}

// Standard-Drill: RECHTSKLICK auf einen Contributor -> Drill-Menue am Cursor
// (Positions / By Category / By Issuer / ...). Einmalig delegiert am Panel gebunden.
let _perfListBound = false;
function ensurePerfListDrillBound() {
  if (_perfListBound) return;
  const panel = document.getElementById('panel-performance-dashboard');
  if (!panel) return;
  _perfListBound = true;
  panel.addEventListener('contextmenu', (e) => {
    const li = e.target.closest?.('.perf-li[data-prod]');
    if (!li || !panel.contains(li)) return;
    e.preventDefault();
    const pid = li.getAttribute('data-prod');
    if (!pid) { try { scheduleHideConcMenu(); } catch {} return; }
    const step = { colKey: 'PROD_ID', value: String(pid), label: 'Product' };
    try { perfDrill.hover('var', { native: e }, [{ index: 0 }], [step]); } catch {}
  });
  panel.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}

// ---- Rendite-Verlauf-Chart ----
function renderPerfReturnChart(labels, dataPct) {
  const canvas = document.getElementById('perfReturnChart');
  if (!canvas || !window.Chart) return;
  if (_perfReturnChart) { try { _perfReturnChart.destroy(); } catch {} _perfReturnChart = null; }

  const green = '#6C9BD1'; // Portfolio-Blau (Yield-Primaerfarbe)
  const grid = _cssVar('--chart-grid', 'rgba(120,120,120,0.25)');
  const text = _cssVar('--chart-text', '#888');
  const font = _cssVar('--font-family', 'Inter, sans-serif');

  // Feste Bitmap-Groesse -> wird auch bei verstecktem Panel gemalt (Report-Erfassung);
  // sichtbar koppelt fitCanvasToDisplay den Puffer an die Anzeige.
  canvas.width = 720; canvas.height = 250;

  const ctx = canvas.getContext('2d');
  const fill = ctx.createLinearGradient(0, 0, 0, 250);
  fill.addColorStop(0, 'rgba(108,155,209,0.35)');
  fill.addColorStop(1, 'rgba(108,155,209,0.02)');

  _perfReturnChart = new window.Chart(ctx, {
    type: 'line',
    data: {
      labels: labels && labels.length ? labels : [''],
      datasets: [{
        label: 'Portfolio-Rendite',
        data: dataPct && dataPct.length ? dataPct : [null],
        borderColor: green,
        backgroundColor: fill,
        borderWidth: 3,
        pointRadius: 0,
        pointHoverRadius: 5,
        pointBackgroundColor: green,
        tension: 0.35,
        fill: true,
        spanGaps: true,
      }],
    },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (c) => `${Number(c.parsed.y).toFixed(2)} %` } },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: text, font: { family: font }, maxTicksLimit: 12, autoSkip: true } },
        y: { grid: { color: grid }, ticks: { color: text, font: { family: font }, callback: (v) => `${v} %` } },
      },
    },
  });
}

// Beim Theme-Wechsel neu zeichnen, wenn das Panel sichtbar ist.
let _perfThemeBound = false;
function bindPerformanceDashboardTheme() {
  if (_perfThemeBound) return;
  _perfThemeBound = true;
  document.addEventListener('theme:changed', () => {
    const panel = document.getElementById('panel-performance-dashboard');
    if (panel && !panel.hidden) { try { renderPerformanceDashboard(); } catch {} }
  });
}
