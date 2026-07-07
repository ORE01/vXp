'use strict';

// Issuer-Beitrag zum Market VaR/ES. MarketVaR_Product enthaelt nur prod_id +
// var_contrib_total/es_contrib_total (keine Emittenten-Spalte). Da es sich um
// CONTRIBUTIONS handelt (additiv), summieren wir die Produktbeitraege pro Emittent.
// prod_id -> ISSUER kommt aus den Portfolio-Daten (dieselbe Quelle wie Overview/Structure).

import { appState } from '../../../../renderer.js';
import { formatNumber } from '../../../../utils/tableCellFormats.js';

import { getCurrentMvarContext, rowMatchesMvarContext } from './mvarSelectors.js';
import { toNumber } from './mvarTransforms.js';

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

// prod_id -> Emittent aus den Portfolio-Daten (PROD_ID/ISSUER).
function buildProdIssuerMap() {
  const rows = appState.getAllPortfolioData?.() || [];
  const map = new Map();
  for (const r of rows) {
    const pid = firstValue(r, ['PROD_ID', 'prod_id', 'product_id', 'PRODUCT_ID'], null);
    if (pid == null) continue;
    const key = String(pid);
    if (map.has(key)) continue;
    const iss = firstValue(r, ['ISSUER', 'issuer', 'Issuer'], null);
    map.set(key, iss != null && String(iss).trim() ? String(iss).trim() : 'Unknown');
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
function aggregateByIssuer(rows, prodIssuer) {
  const agg = new Map();
  for (const row of rows) {
    const pid = String(firstValue(row, ['prod_id', 'PROD_ID', 'product_id', 'PRODUCT_ID'], ''));
    const issuer = prodIssuer.get(pid) || 'Unknown';
    const varAbs = toNumber(firstValue(row, ['var_contrib_total', 'VAR_CONTRIB_TOTAL', 'var_abs', 'VaR_abs'], 0), 0);
    const esAbs  = toNumber(firstValue(row, ['es_contrib_total', 'ES_CONTRIB_TOTAL', 'es_abs', 'ES_abs'], 0), 0);
    const cur = agg.get(issuer) || { issuer, var_abs: 0, es_abs: 0, n: 0 };
    cur.var_abs += varAbs;
    cur.es_abs += esAbs;
    cur.n += 1;
    agg.set(issuer, cur);
  }
  const list = [...agg.values()];
  const totVar = list.reduce((s, x) => s + x.var_abs, 0);
  const totEs  = list.reduce((s, x) => s + x.es_abs, 0);
  list.forEach(x => {
    x.var_rel = totVar ? x.var_abs / totVar : null;
    x.es_rel  = totEs ? x.es_abs / totEs : null;
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

let _issuerPdfChart = null;

// Versteckter Chart.js-Balken auf dem mvarIssuerVarContribChart-Canvas — nur fuer
// den PDF-Export (canvas.toDataURL). responsive:false + feste Groesse -> malt auch
// bei display:none; die Live-Ansicht zeigt weiter den DOM-Chart.
function renderIssuerPdfCanvas(labels, values) {
  const canvas = document.getElementById('mvarIssuerVarContribChart');
  if (_issuerPdfChart) { try { _issuerPdfChart.destroy(); } catch {} _issuerPdfChart = null; }
  if (!canvas || !window.Chart || !labels.length) return;
  canvas.width = 760;
  canvas.height = 380;
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  _issuerPdfChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ data: values, backgroundColor: 'rgba(46,204,113,0.85)', borderColor: 'rgba(46,204,113,0.85)', borderWidth: 1, maxBarThickness: 16 }] },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      plugins: { legend: { display: false } },
      scales: {
        x: { ticks: { color: chartColor, font: { family: chartFont } }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 10 } }, grid: { display: false } },
      },
    },
  });
}

// DOM-Balken (VaR-Beitrag Top 15), responsiv per % (wie beim Produkt-Panel).
function renderIssuerChart(rows) {
  const canvas = document.getElementById('mvarIssuerVarContribChart');
  const chartBox = canvas?.parentElement
    || document.querySelector('#panel-mvar-issuers .mvar-prod-chart');
  if (!chartBox) return;

  chartBox.querySelectorAll('.mvar-product-dom-chart, .mvar-product-chart-message').forEach(el => el.remove());
  if (canvas) canvas.style.display = 'none';

  const chartRows = (Array.isArray(rows) ? rows : [])
    .filter(r => Math.abs(toNumber(r.var_abs, 0)) > 0)
    .slice(0, 15);

  if (!chartRows.length) {
    const message = document.createElement('div');
    message.classList.add('empty-state', 'mvar-product-chart-message');
    message.textContent = 'No non-zero issuer VaR contribution data.';
    chartBox.appendChild(message);
    renderIssuerPdfCanvas([], []);
    return;
  }

  const values = chartRows.map(r => toNumber(r.var_abs, 0));
  const maxAbs = Math.max(...values.map(v => Math.abs(v)), 1);

  const wrapper = document.createElement('div');
  wrapper.classList.add('mvar-product-dom-chart');
  Object.assign(wrapper.style, {
    display: 'flex', flexDirection: 'column', gap: '10px',
    padding: '14px', boxSizing: 'border-box', width: '100%', minHeight: '220px',
  });

  chartRows.forEach((row, index) => {
    const value = values[index];
    const widthPct = Math.max(3, Math.abs(value) / maxAbs * 48);

    const line = document.createElement('div');
    Object.assign(line.style, {
      display: 'grid', gridTemplateColumns: '150px 1fr 110px', alignItems: 'center', gap: '10px',
    });

    const label = document.createElement('div');
    label.textContent = row.issuer || '-';
    label.title = row.issuer || '';
    Object.assign(label.style, {
      color: 'var(--text-primary)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
    });

    const axis = document.createElement('div');
    Object.assign(axis.style, {
      position: 'relative', height: '18px', background: 'var(--surface-overlay)',
      borderRadius: '999px', overflow: 'hidden',
    });

    const zeroLine = document.createElement('div');
    Object.assign(zeroLine.style, {
      position: 'absolute', left: '50%', top: '0', bottom: '0', width: '1px', background: 'var(--border)',
    });

    const bar = document.createElement('div');
    Object.assign(bar.style, {
      position: 'absolute', top: '2px', bottom: '2px', width: `${widthPct}%`,
      borderRadius: '999px', background: 'rgba(46, 204, 113, 0.9)',
    });
    if (value < 0) bar.style.right = '50%'; else bar.style.left = '50%';

    const valueEl = document.createElement('div');
    valueEl.textContent = fmtMaybeAbs(value);
    Object.assign(valueEl.style, {
      textAlign: 'right', color: 'var(--text-primary)', fontVariantNumeric: 'tabular-nums',
    });

    axis.appendChild(zeroLine);
    axis.appendChild(bar);
    line.appendChild(label);
    line.appendChild(axis);
    line.appendChild(valueEl);
    wrapper.appendChild(line);
  });

  chartBox.appendChild(wrapper);

  // Verstecktes Canvas fuer den PDF-Export mitzeichnen.
  try { renderIssuerPdfCanvas(chartRows.map(r => r.issuer || '-'), values); }
  catch (e) { console.warn('[MVaR IssuerPL] hidden PDF canvas failed', e); }
}

export function renderMvarIssuerPLPanel() {
  const tableContainer = document.getElementById('mvarIssuerTableContainer');
  const topContainer = document.getElementById('mvarIssuerVarContribTable');
  const canvas = document.getElementById('mvarIssuerVarContribChart');

  if (!tableContainer && !topContainer && !canvas) return;

  const rows = getStoredProductRows();

  if (!rows.length) {
    if (tableContainer) renderTable(tableContainer, [], [], 'No MVaR issuer data.');
    if (topContainer) renderTable(topContainer, [], [], 'No top issuer VaR contribution data.');
    renderIssuerChart([]);
    return;
  }

  const issuerRows = aggregateByIssuer(rows, buildProdIssuerMap());

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

  const topRows = issuerRows.filter(r => Math.abs(toNumber(r.var_abs, 0)) > 0).slice(0, 15);

  if (topContainer) {
    renderTable(topContainer, topRows, [
      { label: 'Issuer', value: r => r.issuer },
      { label: 'VaR abs', value: r => fmtMaybeAbs(r.var_abs), alignRight: true },
      { label: 'ES abs', value: r => fmtMaybeAbs(r.es_abs), alignRight: true },
    ], 'No non-zero issuer VaR contribution data.');
  }

  requestAnimationFrame(() => renderIssuerChart(issuerRows));
}
