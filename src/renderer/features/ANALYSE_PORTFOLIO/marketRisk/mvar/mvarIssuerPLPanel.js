'use strict';

// Issuer-Beitrag zum Market VaR/ES. MarketVaR_Product enthaelt nur prod_id +
// var_contrib_total/es_contrib_total (keine Emittenten-Spalte). Da es sich um
// CONTRIBUTIONS handelt (additiv), summieren wir die Produktbeitraege pro Emittent.
// prod_id -> ISSUER kommt aus den Portfolio-Daten (dieselbe Quelle wie Overview/Structure).

import { appState } from '../../../../renderer.js';
import { formatNumber } from '../../../../utils/tableCellFormats.js';

import { getCurrentMvarContext, rowMatchesMvarContext } from './mvarSelectors.js';
import { toNumber } from './mvarTransforms.js';
import { createContribDrill, scheduleHideConcMenu } from '../../SummaryBreakdown.js';

// Getrennte Drill-Kontexte je Metrik (VaR/ES) fuer das Issuers-Panel.
const issuerDrill = createContribDrill({
  var: { detailId: 'mrIssuerVarDetail', titleId: 'mrIssuerVarDetailTitle', tableId: 'mrIssuerVarDetailTable', closeId: 'mrIssuerVarDetailClose', menuId: 'mrIssuerVarCardMenu', valueType: '__VAR_CONTRIB', valueLabel: 'VaR contrib' },
  es:  { detailId: 'mrIssuerEsDetail',  titleId: 'mrIssuerEsDetailTitle',  tableId: 'mrIssuerEsDetailTable',  closeId: 'mrIssuerEsDetailClose',  menuId: 'mrIssuerEsCardMenu',  valueType: '__ES_CONTRIB',  valueLabel: 'ES contrib' },
});

// Drill-Schritt je Emittent (Dimension ISSUER). renderConcView filtert dann die
// Portfolio-Rows nach diesem Emittenten (Match ueber das ISSUER-Feld).
function issuerStep(name) { return { colKey: 'ISSUER', value: name || 'Unknown', label: 'Issuer' }; }
function bindCanvasLeaveHide(canvas) {
  if (!canvas || canvas.dataset.issLeaveBound) return;
  canvas.dataset.issLeaveBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}

function fmtAbs(v) { return formatNumber()(v); }
function fmtMaybeAbs(v) { return v == null ? '-' : fmtAbs(v); }
function fmtRelPct(v) { return v == null ? '-' : `${(v * 100).toFixed(2)}%`; }

function firstValue(row, keys, fallback = null) {
  for (const key of keys) {
    const v = row?.[key];
    if (v !== undefined && v !== null && v !== '') return v;
  }
  return fallback;
}

// prod_id -> { Emittent, NAV } aus den Portfolio-Daten (PROD_ID/ISSUER/NAV).
function buildProdInfoMap() {
  const rows = appState.getAllPortfolioData?.() || [];
  const map = new Map();
  for (const r of rows) {
    const pid = firstValue(r, ['PROD_ID', 'prod_id', 'product_id', 'PRODUCT_ID'], null);
    if (pid == null) continue;
    const key = String(pid);
    if (map.has(key)) continue;
    const iss = firstValue(r, ['ISSUER', 'issuer', 'Issuer'], null);
    const nav = toNumber(firstValue(r, ['NAV', 'nav'], 0), 0);
    map.set(key, { issuer: iss != null && String(iss).trim() ? String(iss).trim() : 'Unknown', nav });
  }
  return map;
}

// MarketVaR_Product-Zeilen fuer den aktuellen MVaR-Kontext (Portfolio + Szenario).
function getStoredProductRows() {
  const context = getCurrentMvarContext(appState);
  if (!context?.portName) return [];
  const all = appState.getMvarProductData?.() || [];
  if (!Array.isArray(all) || !all.length) return [];
  return all.filter(row => rowMatchesMvarContext(row, context));
}

// Produktbeitraege pro Emittent aggregieren (VaR/ES additiv), rel = Anteil am Total.
// NAV pro Emittent aus der prod->info-Map; nav_rel = Portfolioanteil (% NAV).
function aggregateByIssuer(rows, prodInfo) {
  const agg = new Map();
  for (const row of rows) {
    const pid = String(firstValue(row, ['prod_id', 'PROD_ID', 'product_id', 'PRODUCT_ID'], ''));
    const info = prodInfo.get(pid) || { issuer: 'Unknown', nav: 0 };
    const issuer = info.issuer;
    const varAbs = toNumber(firstValue(row, ['var_contrib_total', 'VAR_CONTRIB_TOTAL', 'var_abs', 'VaR_abs'], 0), 0);
    const esAbs  = toNumber(firstValue(row, ['es_contrib_total', 'ES_CONTRIB_TOTAL', 'es_abs', 'ES_abs'], 0), 0);
    const cur = agg.get(issuer) || { issuer, var_abs: 0, es_abs: 0, nav: 0, n: 0 };
    cur.var_abs += varAbs;
    cur.es_abs += esAbs;
    cur.nav += info.nav || 0;
    cur.n += 1;
    agg.set(issuer, cur);
  }
  const list = [...agg.values()];
  const totVar = list.reduce((s, x) => s + x.var_abs, 0);
  const totEs  = list.reduce((s, x) => s + x.es_abs, 0);
  const totNav = list.reduce((s, x) => s + x.nav, 0);
  list.forEach(x => {
    x.var_rel = totVar ? x.var_abs / totVar : null;
    x.es_rel  = totEs ? x.es_abs / totEs : null;
    x.nav_rel = totNav ? x.nav / totNav : null;
  });
  return list.sort((a, b) => Math.abs(b.var_abs) - Math.abs(a.var_abs));
}

function renderTable(container, rows, columns, emptyText) {
  if (!container) return;
  container.innerHTML = '';
  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }
  const table = document.createElement('table');
  table.classList.add('MVaRTable');
  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');
  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label;
    if (col.alignRight) th.style.textAlign = 'right';
    headRow.appendChild(th);
  });
  thead.appendChild(headRow);
  table.appendChild(thead);
  const tbody = document.createElement('tbody');
  rows.forEach((row) => {
    const tr = document.createElement('tr');
    columns.forEach((col) => {
      const td = document.createElement('td');
      td.textContent = col.value(row) ?? '';
      if (col.alignRight) td.style.textAlign = 'right';
      tr.appendChild(td);
    });
    tbody.appendChild(tr);
  });
  table.appendChild(tbody);
  container.appendChild(table);
}

// Chart-Instanzen je Canvas (VaR + ES) — getrennt zerstoeren.
const _issuerCharts = new Map();
function destroyIssuerChart(id) { const c = _issuerCharts.get(id); if (c) { try { c.destroy(); } catch {} _issuerCharts.delete(id); } }

// Metrik-Konfiguration: VaR und ES teilen dieselbe Darstellung, nur andere Felder/IDs.
const VAR_CFG = { kind: 'var', absKey: 'var_abs', relKey: 'var_rel', metric: 'VaR', barId: 'mvarIssuerVarContribChart', scatterId: 'mvarIssuerScatterChart' };
const ES_CFG  = { kind: 'es',  absKey: 'es_abs',  relKey: 'es_rel',  metric: 'ES',  barId: 'mvarIssuerEsContribChart',  scatterId: 'mvarIssuerEsScatterChart' };

// Gruppiertes horizontales Balkendiagramm pro Emittent (Top 15 nach Beitrag): zwei
// relative Werte — Portfolioanteil (% NAV) und Risikobeitrag zum <Metrik> (%).
// Chart.js responsive:false + feste Groesse -> malt auch bei verstecktem Panel
// (Report-Capture). Interaktiv (Hover-Menue / Drill nach ISSUER).
function renderIssuerChart(rows, cfg) {
  const canvas = document.getElementById(cfg.barId);
  const chartBox = canvas?.parentElement;
  chartBox?.querySelectorAll('.mvar-product-dom-chart, .mvar-product-chart-message').forEach(el => el.remove());
  destroyIssuerChart(cfg.barId);
  if (!canvas || !window.Chart) return;

  const chartRows = (Array.isArray(rows) ? rows : [])
    .filter(r => Math.abs(toNumber(r[cfg.absKey], 0)) > 0 || Math.abs(toNumber(r.nav, 0)) > 0)
    .slice()
    .sort((a, b) => Math.abs(toNumber(b[cfg.absKey], 0)) - Math.abs(toNumber(a[cfg.absKey], 0)))
    .slice(0, 15);

  if (!chartRows.length) {
    canvas.style.display = 'none';
    if (chartBox) {
      const message = document.createElement('div');
      message.classList.add('empty-state', 'mvar-product-chart-message');
      message.textContent = 'No non-zero issuer data.';
      chartBox.appendChild(message);
    }
    return;
  }

  canvas.style.display = 'block';
  bindCanvasLeaveHide(canvas);
  const labels = chartRows.map(r => r.issuer || '-');
  const barSteps = chartRows.map(r => issuerStep(r.issuer));
  const navPct = chartRows.map(r => (r.nav_rel != null ? +(r.nav_rel * 100).toFixed(2) : 0));
  const contribPct = chartRows.map(r => (r[cfg.relKey] != null ? +(r[cfg.relKey] * 100).toFixed(2) : 0));

  canvas.width = 760;
  canvas.height = Math.max(300, chartRows.length * 26 + 70);
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();

  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [
        { label: 'Portfolio share (NAV)', data: navPct, backgroundColor: 'rgba(88,121,160,0.85)', borderColor: 'rgba(88,121,160,0.85)', borderWidth: 1, maxBarThickness: 10 },
        { label: `Risk contribution (${cfg.metric})`, data: contribPct, backgroundColor: 'rgba(46,204,113,0.85)', borderColor: 'rgba(46,204,113,0.85)', borderWidth: 1, maxBarThickness: 10 },
      ],
    },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      onHover: (evt, els) => { try { issuerDrill.hover(cfg.kind, evt, els, barSteps); } catch {} },
      onClick: (evt, els) => { try { issuerDrill.click(cfg.kind, els, barSteps); } catch {} },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartColor, font: { family: chartFont } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.x).toFixed(2)}%` } },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${v}%` },
          grid: { color: 'rgba(128,128,128,0.15)' },
          title: { display: true, text: `% of NAV  /  % of total ${cfg.metric}`, color: chartColor, font: { family: chartFont } },
        },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 10 } }, grid: { display: false } },
      },
    },
  });
  _issuerCharts.set(cfg.barId, chart);
}

// Andere Darstellung derselben Daten (wie VORLAGE S.8, rechts): Streudiagramm
// Portfolioanteil % (x, NAV) vs. Risikobeitrag % (y, <Metrik>) je Emittent, mit
// gestrichelter 45°-Diagonale. Punkte ueber der Linie tragen ueberproportional bei.
function renderIssuerScatter(rows, cfg) {
  const canvas = document.getElementById(cfg.scatterId);
  destroyIssuerChart(cfg.scatterId);
  if (!canvas || !window.Chart) return;

  const pts = (Array.isArray(rows) ? rows : [])
    .filter(r => r.nav_rel != null && r[cfg.relKey] != null)
    .map(r => ({ x: +(r.nav_rel * 100).toFixed(2), y: +(r[cfg.relKey] * 100).toFixed(2), issuer: r.issuer || '-' }));

  if (!pts.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  bindCanvasLeaveHide(canvas);
  const scatterSteps = pts.map(p => issuerStep(p.issuer));

  const labelSet = new Set([...pts].sort((a, b) => b.y - a.y).slice(0, 8).map(p => p.issuer));
  const axMax = Math.ceil(Math.max(2, ...pts.map(p => Math.max(p.x, p.y))) * 1.1);

  canvas.width = 520;
  canvas.height = 400;
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();

  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'scatter',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: {
      datasets: [
        { type: 'line', label: 'proportional', data: [{ x: 0, y: 0 }, { x: axMax, y: axMax }], borderColor: 'rgba(150,165,185,0.7)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, fill: false, order: 2 },
        { label: 'Issuers', data: pts, backgroundColor: 'rgba(46,88,130,0.75)', borderColor: 'rgba(46,88,130,0.9)', pointRadius: 6, pointHoverRadius: 7, order: 1 },
      ],
    },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      onHover: (evt, els) => { try { issuerDrill.hover(cfg.kind, evt, (els || []).filter(e => e.datasetIndex === 1), scatterSteps); } catch {} },
      onClick: (evt, els) => { try { issuerDrill.click(cfg.kind, (els || []).filter(e => e.datasetIndex === 1), scatterSteps); } catch {} },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw?.issuer ?? ''}: NAV ${ctx.raw?.x}% / ${cfg.metric} ${ctx.raw?.y}%` } },
        datalabels: window.ChartDataLabels ? {
          align: 'right', anchor: 'center', offset: 6, color: chartColor,
          font: { family: chartFont, size: 10 },
          formatter: (v) => (v && labelSet.has(v.issuer) ? v.issuer : ''),
        } : undefined,
      },
      scales: {
        x: { beginAtZero: true, max: axMax, title: { display: true, text: 'Portfolio share % (NAV)', color: chartColor, font: { family: chartFont } }, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${v}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { beginAtZero: true, max: axMax, title: { display: true, text: `Risk contribution % (${cfg.metric})`, color: chartColor, font: { family: chartFont } }, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${v}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
      },
    },
  });
  _issuerCharts.set(cfg.scatterId, chart);
}

// Enrichte Drill-Rows: je Produkt (Beitrag) mit Portfolio-Feldern (ISSUER/CATEGORY/
// RATING/DESCRIPTION/NAV) + VaR-/ES-Beitrag. Basis fuer den metrik-spezifischen Drill.
function buildIssuerDrillRows(productRows) {
  const base = new Map();
  for (const r of (appState.getAllPortfolioData?.() || [])) {
    const pid = firstValue(r, ['PROD_ID', 'prod_id', 'product_id', 'PRODUCT_ID'], null);
    if (pid == null) continue;
    const key = String(pid);
    if (!base.has(key)) base.set(key, r);
  }
  const out = [];
  for (const row of (Array.isArray(productRows) ? productRows : [])) {
    const pid = String(firstValue(row, ['prod_id', 'PROD_ID', 'product_id', 'PRODUCT_ID'], ''));
    const b = base.get(pid) || {};
    out.push({
      ...b,
      PROD_ID: pid,
      // Magnitude des Beitrags (wie in den Charts) -> Positionsliste sortiert nach
      // groesstem Beitrag, Shares positiv.
      __VAR_CONTRIB: Math.abs(toNumber(firstValue(row, ['var_contrib_total', 'VAR_CONTRIB_TOTAL', 'var_abs', 'VaR_abs'], 0), 0)),
      __ES_CONTRIB:  Math.abs(toNumber(firstValue(row, ['es_contrib_total', 'ES_CONTRIB_TOTAL', 'es_abs', 'ES_abs'], 0), 0)),
    });
  }
  return out;
}

export function renderMvarIssuerPLPanel() {
  const tableContainer = document.getElementById('mvarIssuerTableContainer');
  const canvas = document.getElementById('mvarIssuerVarContribChart');

  if (!tableContainer && !canvas) return;

  const rows = getStoredProductRows();

  if (!rows.length) {
    if (tableContainer) renderTable(tableContainer, [], [], 'No MVaR issuer data.');
    try { issuerDrill.setData([]); } catch {}
    renderIssuerChart([], VAR_CFG); renderIssuerScatter([], VAR_CFG);
    renderIssuerChart([], ES_CFG);  renderIssuerScatter([], ES_CFG);
    return;
  }

  // Drill-Datenquelle (Produkte + Beitraege) fuer beide Metriken setzen.
  try { issuerDrill.setData(buildIssuerDrillRows(rows)); } catch (e) { console.warn('[MVaR IssuerPL] drill data failed', e); }

  const issuerRows = aggregateByIssuer(rows, buildProdInfoMap());

  if (tableContainer) {
    renderTable(tableContainer, issuerRows, [
      { label: 'Issuer', value: r => r.issuer },
      { label: 'VaR abs', value: r => fmtMaybeAbs(r.var_abs), alignRight: true },
      { label: 'VaR rel', value: r => fmtRelPct(r.var_rel), alignRight: true },
      { label: 'ES abs', value: r => fmtMaybeAbs(r.es_abs), alignRight: true },
      { label: 'ES rel', value: r => fmtRelPct(r.es_rel), alignRight: true },
      { label: 'Products', value: r => r.n, alignRight: true },
    ], 'No MVaR issuer data.');
  }

  requestAnimationFrame(() => {
    renderIssuerChart(issuerRows, VAR_CFG); renderIssuerScatter(issuerRows, VAR_CFG);
    renderIssuerChart(issuerRows, ES_CFG);  renderIssuerScatter(issuerRows, ES_CFG);
  });
}
