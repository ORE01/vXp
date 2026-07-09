'use strict';

import { appState } from '../../../../renderer.js';
import { formatNumber, formatNumberWithCommas } from '../../../../utils/tableCellFormats.js';
import { attachIdLinks } from '../../../../utils/linksToTables.js';

import {
  getAvailableMvarPorts,
  getAvailableMvarScenarios,
  getCurrentMvarContext,
  normalizeMvarText,
  normalizePortfolioName,
  rowMatchesMvarContext,
} from './mvarSelectors.js';

import {
  toNumber,
} from './mvarTransforms.js';

import { renderMvarIssuerPLPanel } from './mvarIssuerPLPanel.js';
import { renderMvarScenarioPanel } from './mvarScenarioPanel.js';
import { createContribDrill, scheduleHideConcMenu } from '../../SummaryBreakdown.js';


let mvarProdIdVarContribChart = null;


function fmtAbs(value) {
  return formatNumber()(value);
}

function fmtRel(value) {
  return formatNumberWithCommas(value);
}

function formatMaybeAbs(value) {
  return value == null ? '-' : fmtAbs(value);
}

function formatMaybeRel(value) {
  return value == null ? '-' : fmtRel(value);
}

function firstValue(row, keys, fallback = null) {
  for (const key of keys) {
    if (row?.[key] !== undefined && row?.[key] !== null && row?.[key] !== '') {
      return row[key];
    }
  }

  return fallback;
}

function destroyMvarProdIdVarContribChart() {
  const canvas = document.getElementById('mvarProdIdVarContribChart');

  try {
    if (typeof Chart !== 'undefined') {
      const chartByCanvas = canvas ? Chart.getChart(canvas) : null;
      const chartById = typeof Chart.getChart === 'function'
        ? Chart.getChart('mvarProdIdVarContribChart')
        : null;

      if (chartByCanvas) {
        chartByCanvas.destroy();
      }

      if (chartById && chartById !== chartByCanvas) {
        chartById.destroy();
      }

      if (Chart.instances) {
        Object.values(Chart.instances).forEach(chart => {
          if (chart?.canvas?.id === 'mvarProdIdVarContribChart') {
            chart.destroy();
          }
        });
      }
    }

    if (mvarProdIdVarContribChart) {
      mvarProdIdVarContribChart.destroy();
    }
  } catch (err) {
    console.warn('[MVaR ProductPL] chart destroy warning', err);
  } finally {
    mvarProdIdVarContribChart = null;
  }
}

function getStoredProductRowsForCurrentContext() {
  const context = getCurrentMvarContext(appState);
  const { portName, scenarioName } = context;

  if (!portName) {
    return [];
  }

  const allRows = appState.getMvarProductData?.() || [];

  if (!Array.isArray(allRows) || !allRows.length) {
    return [];
  }

  const filteredRows = allRows.filter(row =>
    rowMatchesMvarContext(row, context)
  );

  // console.log('[MVaR ProductPL] local context filter', {
  //   selectedPort: normalizePortfolioName(portName),
  //   selectedScenario: normalizeMvarText(scenarioName),
  //   allRows: allRows.length,
  //   filteredRows: filteredRows.length,
  //   availablePorts: getAvailableMvarPorts(allRows),
  //   availableScenarios: getAvailableMvarScenarios(allRows),
  //   sample: filteredRows[0] || allRows[0],
  // });

  // Diagnostic only: raw vs context-matched rows, with field-name variants so we can
  // tell whether the filter drops existing data (port/scenario field/spelling).
  // console.log('[MVAR PRODUCT FILTER CHECK]', {
  //   selectedPort: appState.getSelectedPortTableName?.(),
  //   selectedScenario: appState.selectedMvarInterval,

  //   inputRowsCount: Array.isArray(allRows) ? allRows.length : null,
  //   matchedRowsCount: Array.isArray(filteredRows) ? filteredRows.length : null,

  //   sampleBeforeFilter: Array.isArray(allRows) ? allRows[0] : null,
  //   sampleAfterFilter: Array.isArray(filteredRows) ? filteredRows[0] : null,

  //   availablePorts: Array.isArray(allRows)
  //     ? [...new Set(allRows.map(r => r.PORT_NAME ?? r.portName ?? r.port_name ?? r.PORT).filter(Boolean))].slice(0, 20)
  //     : [],

  //   availableScenarios: Array.isArray(allRows)
  //     ? [...new Set(allRows.map(r =>
  //         r.SCENARIO_NAME ??
  //         r.scenarioName ??
  //         r.scenario_name ??
  //         r.INTERVAL_NAME ??
  //         r.interval_name
  //       ).filter(Boolean))].slice(0, 20)
  //     : [],
  // });

  return filteredRows;
}

function sumContributionComponents(row, prefix) {
  if (!row || typeof row !== 'object') {
    return 0;
  }

  const normalizedPrefix = String(prefix || '').toLowerCase();

  return Object.entries(row).reduce((sum, [key, value]) => {
    const k = String(key || '').toLowerCase();

    const isContributionColumn =
      k.startsWith(normalizedPrefix) &&
      !k.endsWith('_total') &&
      !k.endsWith('_abs') &&
      !k.endsWith('_rel') &&
      !k.endsWith('_pct') &&
      !k.endsWith('_percentage');

    if (!isContributionColumn) {
      return sum;
    }

    return sum + toNumber(value, 0);
  }, 0);
}

function getEffectiveContribution(row, totalKeys, componentPrefix) {
  const total = toNumber(firstValue(row, totalKeys, null), null);

  if (Number.isFinite(total) && total !== 0) {
    return total;
  }

  const componentSum = sumContributionComponents(row, componentPrefix);

  if (Number.isFinite(componentSum) && componentSum !== 0) {
    return componentSum;
  }

  return total ?? 0;
}

function buildProductRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows
    .map(row => {
      const prodId = firstValue(row, [
        'prod_id',
        'PROD_ID',
        'product_id',
        'PRODUCT_ID',
      ], '');

      const description = firstValue(row, [
        'description',
        'DESCRIPTION',
        'product_name',
        'PRODUCT_NAME',
      ], '');

      const varAbs = getEffectiveContribution(
        row,
        [
          'var_contrib_total',
          'VAR_CONTRIB_TOTAL',
          'var_contrib_abs',
          'VAR_CONTRIB_ABS',
          'VaR_contrib_total',
          'var_abs',
          'VaR_abs',
          'VAR_ABS',
        ],
        'var_contrib_'
      );

      const esAbs = getEffectiveContribution(
        row,
        [
          'es_contrib_total',
          'ES_CONTRIB_TOTAL',
          'es_contrib_abs',
          'ES_CONTRIB_ABS',
          'es_abs',
          'ES_abs',
          'ES_ABS',
        ],
        'es_contrib_'
      );

      const varRel = toNumber(firstValue(row, [
        'var_contrib_rel',
        'VAR_CONTRIB_REL',
        'var_rel',
        'VaR_rel',
        'VAR_REL',
      ], null), null);

      const esRel = toNumber(firstValue(row, [
        'es_contrib_rel',
        'ES_CONTRIB_REL',
        'es_rel',
        'ES_rel',
        'ES_REL',
      ], null), null);

      const obs = toNumber(firstValue(row, [
        'obs',
        'OBS',
        'observations',
        'OBSERVATIONS',
      ], 1), 1);

      return {
        prod_id: String(prodId || ''),
        description: String(description || ''),

        // canonical display fields
        var_abs: varAbs,
        var_rel: varRel,
        es_abs: esAbs,
        es_rel: esRel,

        // compatibility fields for old/top table renderers
        var_contrib_total: varAbs,
        es_contrib_total: esAbs,
        var_contrib_rel: varRel,
        es_contrib_rel: esRel,

        obs,
        raw: row,
      };
    })
    .sort((a, b) => Math.abs(b.var_abs || 0) - Math.abs(a.var_abs || 0));
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

    if (col.alignRight) {
      th.style.textAlign = 'right';
    }

    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((row) => {
    const tr = document.createElement('tr');

    columns.forEach((col) => {
      const td = document.createElement('td');
      const value = col.value(row);

      td.textContent = value ?? '';

      if (col.alignRight) {
        td.style.textAlign = 'right';
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function clearChartMessage(chartBox) {
  if (!chartBox) return;

  const existing = chartBox.querySelector('.mvar-product-chart-message');

  if (existing) {
    existing.remove();
  }
}

function showChartMessage(text) {
  destroyMvarProdIdVarContribChart();

  const canvas = document.getElementById('mvarProdIdVarContribChart');
  const chartBox = canvas?.parentElement;

  if (!chartBox) return;

  clearChartMessage(chartBox);

  const existingDomChart = chartBox.querySelector('.mvar-product-dom-chart');

  if (existingDomChart) {
    existingDomChart.remove();
  }

  if (canvas) {
    canvas.style.display = 'none';
  }

  const message = document.createElement('div');
  message.classList.add('empty-state', 'mvar-product-chart-message');
  message.textContent = text;

  chartBox.appendChild(message);
}

function showChartCanvas() {
  const oldCanvas = document.getElementById('mvarProdIdVarContribChart');
  const chartBox = oldCanvas?.parentElement;

  if (!oldCanvas || !chartBox) {
    return null;
  }

  destroyMvarProdIdVarContribChart();
  clearChartMessage(chartBox);

  const freshCanvas = oldCanvas.cloneNode(false);
  freshCanvas.id = 'mvarProdIdVarContribChart';
  freshCanvas.style.display = 'block';

  oldCanvas.replaceWith(freshCanvas);

  return freshCanvas;
}

function renderMvarProductChart(productRows) {
  // IMPORTANT:
  // This function must only touch the chart area.
  // It must NOT clear product tables, NOT replace panel HTML, NOT depend on recalculation.

  destroyMvarProdIdVarContribChart();

  const canvas = document.getElementById('mvarProdIdVarContribChart');
  const chartBox =
    canvas?.parentElement ||
    document.querySelector('#panel-mvar-products .mvar-prod-chart') ||
    document.querySelector('.mvar-prod-chart');

  if (!chartBox) {
    console.warn('[MVaR ProductPL] chart box missing');
    return;
  }

  // Remove only chart-owned DOM elements.
  // Do NOT use chartBox.innerHTML = '' because that may remove the canvas permanently.
  chartBox
    .querySelectorAll('.mvar-product-dom-chart, .mvar-product-chart-message')
    .forEach(el => el.remove());

  if (canvas) {
    canvas.style.display = 'none';
  }

  const safeRows = Array.isArray(productRows) ? productRows : [];

  const chartRows = safeRows
    .filter(row => {
      const value = toNumber(
        row.var_contrib_total ??
        row.var_abs ??
        0,
        0
      );

      return Math.abs(value) > 0;
    })
    .slice(0, 15);

  if (!chartRows.length) {
    const message = document.createElement('div');
    message.classList.add('empty-state', 'mvar-product-chart-message');
    message.textContent = 'No non-zero product VaR contribution data.';
    chartBox.appendChild(message);

    console.warn('[MVaR ProductPL] chart skipped: no non-zero values', {
      productRows: safeRows.length,
      sample: safeRows[0],
    });

    return;
  }

  const values = chartRows.map(row =>
    toNumber(
      row.var_contrib_total ??
      row.var_abs ??
      0,
      0
    )
  );

  const maxAbs = Math.max(
    ...values.map(value => Math.abs(value)),
    1
  );

  const wrapper = document.createElement('div');
  wrapper.classList.add('mvar-product-dom-chart');
  wrapper.style.display = 'flex';
  wrapper.style.flexDirection = 'column';
  wrapper.style.gap = '10px';
  wrapper.style.padding = '14px';
  wrapper.style.boxSizing = 'border-box';
  wrapper.style.width = '100%';
  wrapper.style.minHeight = '220px';

  chartRows.forEach((row, index) => {
    const value = values[index];
    const widthPct = Math.max(3, Math.abs(value) / maxAbs * 48);

    const line = document.createElement('div');
    line.style.display = 'grid';
    line.style.gridTemplateColumns = '90px 1fr 110px';
    line.style.alignItems = 'center';
    line.style.gap = '10px';

    const label = document.createElement('div');
    label.textContent = row.prod_id || '-';
    label.style.fontSize = 'inherit';
    label.style.color = 'var(--text-primary)';
    label.style.overflow = 'hidden';
    label.style.textOverflow = 'ellipsis';
    label.style.whiteSpace = 'nowrap';

    const axis = document.createElement('div');
    axis.style.position = 'relative';
    axis.style.height = '18px';
    axis.style.background = 'var(--surface-overlay)';
    axis.style.borderRadius = '999px';
    axis.style.overflow = 'hidden';

    const zeroLine = document.createElement('div');
    zeroLine.style.position = 'absolute';
    zeroLine.style.left = '50%';
    zeroLine.style.top = '0';
    zeroLine.style.bottom = '0';
    zeroLine.style.width = '1px';
    zeroLine.style.background = 'var(--border)';

    const bar = document.createElement('div');
    bar.style.position = 'absolute';
    bar.style.top = '2px';
    bar.style.bottom = '2px';
    bar.style.width = `${widthPct}%`;
    bar.style.borderRadius = '999px';
    bar.style.background = 'rgba(46, 204, 113, 0.9)';

    if (value < 0) {
      bar.style.right = '50%';
    } else {
      bar.style.left = '50%';
    }

    const valueEl = document.createElement('div');
    valueEl.textContent = formatMaybeAbs(value);
    valueEl.style.textAlign = 'right';
    valueEl.style.fontSize = 'inherit';
    valueEl.style.color = 'var(--text-primary)';
    valueEl.style.fontVariantNumeric = 'tabular-nums';

    axis.appendChild(zeroLine);
    axis.appendChild(bar);

    line.appendChild(label);
    line.appendChild(axis);
    line.appendChild(valueEl);

    wrapper.appendChild(line);
  });

  chartBox.appendChild(wrapper);

  // Zusaetzlich einen VERSTECKTEN Chart.js-Balken auf den (display:none) Canvas
  // zeichnen, damit der PDF-Export (canvas.toDataURL) ein Bild bekommt. Die Live-
  // Ansicht zeigt weiter den DOM-Chart oben; responsive:false + feste Groesse malt
  // das Bitmap auch bei verstecktem Canvas.
  try {
    renderProductPdfCanvas(
      chartRows.map(r => r.prod_id || '-'),
      values,
    );
  } catch (e) { console.warn('[MVaR ProductPL] hidden PDF canvas failed', e); }

  // console.log('[MVaR ProductPL] DOM chart rendered', {
  //   rows: chartRows.length,
  //   labels: chartRows.map(row => row.prod_id),
  //   values,
  //   maxAbs,
  //   productRows: safeRows.length,
  // });
}

// Versteckter Chart.js-Balken auf dem mvarProdIdVarContribChart-Canvas — nur fuer
// den PDF-Export. responsive:false + feste Canvas-Groesse -> malt auch bei
// display:none. Instanz in mvarProdIdVarContribChart -> wird beim naechsten Render
// via destroyMvarProdIdVarContribChart() sauber zerstoert.
function renderProductPdfCanvas(labels, values) {
  const canvas = document.getElementById('mvarProdIdVarContribChart');
  if (!canvas || !window.Chart || !labels.length) return;
  canvas.width = 760;
  canvas.height = 380;
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  mvarProdIdVarContribChart = new window.Chart(canvas.getContext('2d'), {
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

// Deferred product-chart render: only draw once the chart CONTAINER has a real width.
// NOTE: the product chart is a DOM bar chart drawn into the canvas's PARENT box; the
// <canvas> itself is intentionally display:none (always 0x0), so we must measure the
// container (.mvar-prod-chart), not the canvas. Gate on width only (height grows with
// content via min-height). Max 3 retries, no interval; last attempt renders anyway.
function renderProductChartWhenReady(productRows, attempt = 0) {
  const canvas = document.getElementById('mvarProdIdVarContribChart');
  const chartBox =
    canvas?.parentElement ||
    document.querySelector('#panel-mvar-products .mvar-prod-chart') ||
    document.querySelector('.mvar-prod-chart');

  const width = chartBox?.clientWidth ?? 0;
  const height = chartBox?.clientHeight ?? 0;

  // console.log('[MVAR PRODUCT CHART READY CHECK]', {
  //   attempt,
  //   canvasExists: !!canvas,
  //   chartBoxExists: !!chartBox,
  //   width,
  //   height,
  //   rows: Array.isArray(productRows) ? productRows.length : null,
  // });

  if (!chartBox || width <= 0) {
    if (attempt < 3) {
      requestAnimationFrame(() => {
        setTimeout(() => renderProductChartWhenReady(productRows, attempt + 1), 50);
      });
      return;
    }

    // Last resort: render anyway. The DOM chart uses width:100% / min-height:220px and
    // does not depend on the canvas, so a final render is safe and avoids a blank tile.
    console.warn('[MVAR PRODUCT CHART] container not sized after retries, rendering anyway', {
      chartBoxExists: !!chartBox,
      width,
      height,
    });
  }

  renderMvarProductChart(productRows);
}

// ===== Products: Balken+Scatter (VaR/ES) + metrik-getrennter Drill (wie Issuers) =====
// Getrennte Drill-Kontexte je Metrik; Drill nach PROD_ID (ein Produkt -> seine Position).
const productDrill = createContribDrill({
  var: { detailId: 'mrProductVarDetail', titleId: 'mrProductVarDetailTitle', tableId: 'mrProductVarDetailTable', closeId: 'mrProductVarDetailClose', menuId: 'mrProductVarCardMenu', valueType: '__VAR_CONTRIB', valueLabel: 'VaR contrib' },
  es:  { detailId: 'mrProductEsDetail',  titleId: 'mrProductEsDetailTitle',  tableId: 'mrProductEsDetailTable',  closeId: 'mrProductEsDetailClose',  menuId: 'mrProductEsCardMenu',  valueType: '__ES_CONTRIB',  valueLabel: 'ES contrib' },
});
function productStep(prodId) { return { colKey: 'PROD_ID', value: String(prodId || ''), label: 'Product' }; }

const _prodContribCharts = new Map();
function destroyProdContribChart(id) { const c = _prodContribCharts.get(id); if (c) { try { c.destroy(); } catch {} _prodContribCharts.delete(id); } }
function bindProdCanvasLeave(canvas) { if (!canvas || canvas.dataset.prodLeaveBound) return; canvas.dataset.prodLeaveBound = '1'; canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} }); }

// prod_id -> Portfolio-Basiszeile (fuer NAV/ISSUER/CATEGORY/... im Chart + Drill).
function buildProdBaseMap() {
  const m = new Map();
  for (const r of (appState.getAllPortfolioData?.() || [])) {
    const pid = firstValue(r, ['PROD_ID', 'prod_id', 'product_id', 'PRODUCT_ID'], null);
    if (pid == null) continue;
    const k = String(pid);
    if (!m.has(k)) m.set(k, r);
  }
  return m;
}

// Chart-Entities je Produkt: NAV-/VaR-/ES-Anteil (Share of total, Magnitude).
function buildProductChartRows(productRows, baseMap) {
  const rows = (Array.isArray(productRows) ? productRows : []).map(r => {
    const pid = String(r.prod_id || '');
    const base = baseMap.get(pid) || {};
    return {
      prod_id: pid,
      label: (r.description || pid || '-'),
      nav: toNumber(firstValue(base, ['NAV', 'nav'], 0), 0),
      var_abs: toNumber(r.var_abs, 0),
      es_abs: toNumber(r.es_abs, 0),
    };
  });
  const totVar = rows.reduce((s, x) => s + Math.abs(x.var_abs), 0);
  const totEs = rows.reduce((s, x) => s + Math.abs(x.es_abs), 0);
  const totNav = rows.reduce((s, x) => s + x.nav, 0);
  rows.forEach(x => {
    x.var_rel = totVar ? Math.abs(x.var_abs) / totVar : null;
    x.es_rel = totEs ? Math.abs(x.es_abs) / totEs : null;
    x.nav_rel = totNav ? x.nav / totNav : null;
  });
  return rows;
}

// Enrichte Drill-Rows: Produkte + Portfolio-Felder + Beitraege (Magnitude).
function buildProductDrillRows(filteredRows, baseMap) {
  const out = [];
  for (const row of (Array.isArray(filteredRows) ? filteredRows : [])) {
    const pid = String(firstValue(row, ['prod_id', 'PROD_ID', 'product_id', 'PRODUCT_ID'], ''));
    const b = baseMap.get(pid) || {};
    out.push({
      ...b, PROD_ID: pid,
      __VAR_CONTRIB: Math.abs(toNumber(firstValue(row, ['var_contrib_total', 'VAR_CONTRIB_TOTAL', 'var_contrib_abs', 'var_abs', 'VaR_abs'], 0), 0)),
      __ES_CONTRIB:  Math.abs(toNumber(firstValue(row, ['es_contrib_total', 'ES_CONTRIB_TOTAL', 'es_contrib_abs', 'es_abs', 'ES_abs'], 0), 0)),
    });
  }
  return out;
}

const PROD_VAR_CFG = { kind: 'var', absKey: 'var_abs', relKey: 'var_rel', metric: 'VaR', barId: 'mvarProductVarContribChart', scatterId: 'mvarProductVarScatterChart' };
const PROD_ES_CFG  = { kind: 'es',  absKey: 'es_abs',  relKey: 'es_rel',  metric: 'ES',  barId: 'mvarProductEsContribChart',  scatterId: 'mvarProductEsScatterChart' };

// Gruppierter horizontaler Balken je Produkt (Top 15): NAV-Anteil vs. Risikobeitrag %.
function renderProductContribChart(rows, cfg) {
  const canvas = document.getElementById(cfg.barId);
  destroyProdContribChart(cfg.barId);
  if (!canvas || !window.Chart) return;
  const chartRows = (Array.isArray(rows) ? rows : [])
    .filter(r => Math.abs(toNumber(r[cfg.absKey], 0)) > 0 || Math.abs(toNumber(r.nav, 0)) > 0)
    .slice().sort((a, b) => Math.abs(toNumber(b[cfg.absKey], 0)) - Math.abs(toNumber(a[cfg.absKey], 0)))
    .slice(0, 15);
  if (!chartRows.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  bindProdCanvasLeave(canvas);
  const labels = chartRows.map(r => r.label || '-');
  const steps = chartRows.map(r => productStep(r.prod_id));
  const navPct = chartRows.map(r => (r.nav_rel != null ? +(r.nav_rel * 100).toFixed(2) : 0));
  const contribPct = chartRows.map(r => (r[cfg.relKey] != null ? +(r[cfg.relKey] * 100).toFixed(2) : 0));
  canvas.width = 760; canvas.height = Math.max(300, chartRows.length * 26 + 70);
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Portfolio share (NAV)', data: navPct, backgroundColor: 'rgba(88,121,160,0.85)', borderColor: 'rgba(88,121,160,0.85)', borderWidth: 1, maxBarThickness: 10 },
      { label: `Risk contribution (${cfg.metric})`, data: contribPct, backgroundColor: 'rgba(46,204,113,0.85)', borderColor: 'rgba(46,204,113,0.85)', borderWidth: 1, maxBarThickness: 10 },
    ] },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      onHover: (evt, els) => { try { productDrill.hover(cfg.kind, evt, els, steps); } catch {} },
      onClick: (evt, els) => { try { productDrill.click(cfg.kind, els, steps); } catch {} },
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartColor, font: { family: chartFont } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.x).toFixed(2)}%` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${v}%` }, grid: { color: 'rgba(128,128,128,0.15)' }, title: { display: true, text: `% of NAV  /  % of total ${cfg.metric}`, color: chartColor, font: { family: chartFont } } },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 10 } }, grid: { display: false } },
      },
    },
  });
  _prodContribCharts.set(cfg.barId, chart);
}

// Streudiagramm je Produkt: x = NAV-Anteil %, y = Risikobeitrag %, 45°-Diagonale.
function renderProductScatter(rows, cfg) {
  const canvas = document.getElementById(cfg.scatterId);
  destroyProdContribChart(cfg.scatterId);
  if (!canvas || !window.Chart) return;
  const pts = (Array.isArray(rows) ? rows : [])
    .filter(r => r.nav_rel != null && r[cfg.relKey] != null)
    .map(r => ({ x: +(r.nav_rel * 100).toFixed(2), y: +(r[cfg.relKey] * 100).toFixed(2), issuer: r.label || '-', prod_id: r.prod_id }));
  if (!pts.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  bindProdCanvasLeave(canvas);
  const scatterSteps = pts.map(p => productStep(p.prod_id));
  const labelSet = new Set([...pts].sort((a, b) => b.y - a.y).slice(0, 8).map(p => p.issuer));
  const axMax = Math.ceil(Math.max(2, ...pts.map(p => Math.max(p.x, p.y))) * 1.1);
  canvas.width = 520; canvas.height = 400;
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'scatter',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: { datasets: [
      { type: 'line', label: 'proportional', data: [{ x: 0, y: 0 }, { x: axMax, y: axMax }], borderColor: 'rgba(150,165,185,0.7)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, fill: false, order: 2 },
      { label: 'Products', data: pts, backgroundColor: 'rgba(46,88,130,0.75)', borderColor: 'rgba(46,88,130,0.9)', pointRadius: 6, pointHoverRadius: 7, order: 1 },
    ] },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      onHover: (evt, els) => { try { productDrill.hover(cfg.kind, evt, (els || []).filter(e => e.datasetIndex === 1), scatterSteps); } catch {} },
      onClick: (evt, els) => { try { productDrill.click(cfg.kind, (els || []).filter(e => e.datasetIndex === 1), scatterSteps); } catch {} },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw?.issuer ?? ''}: NAV ${ctx.raw?.x}% / ${cfg.metric} ${ctx.raw?.y}%` } },
        datalabels: window.ChartDataLabels ? { align: 'right', anchor: 'center', offset: 6, color: chartColor, font: { family: chartFont, size: 10 }, formatter: (v) => (v && labelSet.has(v.issuer) ? v.issuer : '') } : undefined,
      },
      scales: {
        x: { beginAtZero: true, max: axMax, title: { display: true, text: 'Portfolio share % (NAV)', color: chartColor, font: { family: chartFont } }, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${v}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { beginAtZero: true, max: axMax, title: { display: true, text: `Risk contribution % (${cfg.metric})`, color: chartColor, font: { family: chartFont } }, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${v}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
      },
    },
  });
  _prodContribCharts.set(cfg.scatterId, chart);
}

function renderProductContribCharts(productRows) {
  const baseMap = buildProdBaseMap();
  const chartRows = buildProductChartRows(productRows, baseMap);
  renderProductContribChart(chartRows, PROD_VAR_CFG); renderProductScatter(chartRows, PROD_VAR_CFG);
  renderProductContribChart(chartRows, PROD_ES_CFG);  renderProductScatter(chartRows, PROD_ES_CFG);
}

export function renderMvarProductPLPanel() {
  const productTableContainer = document.getElementById('mvarProductTableContainer');
  const topProductTableContainer = document.getElementById('mvarProdIdVarContribTable');
  const chartCanvas = document.getElementById('mvarProdIdVarContribChart');

  if (!productTableContainer && !topProductTableContainer && !chartCanvas) {
    console.warn('[MVaR ProductPL] containers missing', {
      productTableContainer: !!productTableContainer,
      topProductTableContainer: !!topProductTableContainer,
      chartCanvas: !!chartCanvas,
    });
    return;
  }

  // Issuer-Beitrags-Panel (aggregiert dieselben Produktbeitraege pro Emittent) im
  // selben Zug rendern -> immer synchron mit dem Produkt-Panel (Daten/Portfolio/Szenario).
  try { renderMvarIssuerPLPanel(); } catch (e) { console.warn('[MVaR IssuerPL] render failed', e); }
  // Scenario-Sensitivities ebenfalls mitziehen (zuverlaessiger Portfolio-Wechsel-Hook).
  try { renderMvarScenarioPanel(); } catch (e) { console.warn('[MVaR ScenarioPL] render failed', e); }

  const { portName, scenarioName } = getCurrentMvarContext(appState);
  const filteredRows = getStoredProductRowsForCurrentContext();

  if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
    destroyMvarProdIdVarContribChart();

    if (productTableContainer) {
      renderTable(
        productTableContainer,
        [],
        [],
        'No MVaR product P/L data.'
      );
    }

    if (topProductTableContainer) {
      renderTable(
        topProductTableContainer,
        [],
        [],
        'No top product VaR contribution data.'
      );
    }

    try { productDrill.setData([]); } catch {}
    renderProductContribCharts([]);

    console.warn('[MVaR ProductPL] no rows for current context', {
      portName,
      scenarioName,
      storeRows: appState.getMvarProductData?.()?.length || 0,
      availablePorts: [
        ...new Set((appState.getMvarProductData?.() || []).map(r => r.port_name ?? r.PORT_NAME)),
      ],
      availableScenarios: [
        ...new Set((appState.getMvarProductData?.() || []).map(r => r.scenario_name ?? r.SCENARIO_NAME)),
      ],
    });

    return;
  }

  const productRows = buildProductRows(filteredRows);

  // Drill-Datenquelle (Produkte + Portfolio-Felder + Beitraege) fuer beide Metriken.
  try { productDrill.setData(buildProductDrillRows(filteredRows, buildProdBaseMap())); }
  catch (e) { console.warn('[MVaR ProductPL] drill data failed', e); }

  if (productTableContainer) {
    renderTable(
      productTableContainer,
      productRows,
      [
        {
          label: 'Product ID',
          value: r => r.prod_id,
        },
        {
          label: 'Description',
          value: r => r.description,
        },
        {
          label: 'VaR abs',
          value: r => formatMaybeAbs(r.var_abs),
          alignRight: true,
        },
        {
          label: 'VaR rel',
          value: r => formatMaybeRel(r.var_rel),
          alignRight: true,
        },
        {
          label: 'ES abs',
          value: r => formatMaybeAbs(r.es_abs),
          alignRight: true,
        },
        {
          label: 'ES rel',
          value: r => formatMaybeRel(r.es_rel),
          alignRight: true,
        },
        {
          label: 'Obs',
          value: r => r.obs,
          alignRight: true,
        },
      ],
      'No MVaR product P/L data.'
    );

    // Make the "Product" column (prod_id) clickable -> opens the product editor,
    // same as in the other tables.
    attachIdLinks(productTableContainer, { prodHeader: 'Product ID' });
  }

  const topRows = productRows
    .filter(row => Math.abs(toNumber(row.var_abs, 0)) > 0)
    .slice(0, 15);

  if (topProductTableContainer) {
    renderTable(
      topProductTableContainer,
      topRows,
        [
        {
            label: 'Product ID',
            value: r => r.prod_id,
        },
        {
            label: 'VaR abs',
            value: r => formatMaybeAbs(r.var_abs),
            alignRight: true,
        },
        {
            label: 'ES abs',
            value: r => formatMaybeAbs(r.es_abs),
            alignRight: true,
        },
        ],
      'No non-zero product VaR contribution data.'
    );
  }

  // Initial-open fix: the product canvas can still be 0x0 while the layout settles,
  // so a direct render draws into a zero-size canvas and stays blank. Defer until the
  // canvas has a real size (max 3 retries; no interval / no endless loop).
  renderProductContribCharts(productRows);

  // console.log('[MVaR ProductPL] rendered', {
  //   portName,
  //   scenarioName,
  //   storeRows: appState.getMvarProductData?.()?.length || 0,
  //   filteredRows: filteredRows.length,
  //   productRows: productRows.length,
  //   topRows: topRows.length,
  //   sample: filteredRows[0],
  // });
}

function normalizeProductContributionRows(rows) {
  if (!Array.isArray(rows)) {
    return [];
  }

  return rows.map(row => {
    const varAbs = getEffectiveContribution(
      row,
      [
        'var_contrib_total',
        'VAR_CONTRIB_TOTAL',
        'var_contrib_abs',
        'VAR_CONTRIB_ABS',
        'VaR_contrib_total',
        'var_abs',
        'VaR_abs',
        'VAR_ABS',
      ],
      'var_contrib_'
    );

    const esAbs = getEffectiveContribution(
      row,
      [
        'es_contrib_total',
        'ES_CONTRIB_TOTAL',
        'es_contrib_abs',
        'ES_CONTRIB_ABS',
        'es_abs',
        'ES_abs',
        'ES_ABS',
      ],
      'es_contrib_'
    );

    const varRel = toNumber(firstValue(row, [
      'var_contrib_rel',
      'VAR_CONTRIB_REL',
      'var_rel',
      'VaR_rel',
      'VAR_REL',
    ], null), null);

    const esRel = toNumber(firstValue(row, [
      'es_contrib_rel',
      'ES_CONTRIB_REL',
      'es_rel',
      'ES_rel',
      'ES_REL',
    ], null), null);

    return {
      ...row,

      // canonical lowercase fields used by this panel
      var_contrib_total: varAbs,
      es_contrib_total: esAbs,
      var_contrib_rel: varRel,
      es_contrib_rel: esRel,

      // compatibility/display fields
      var_abs: varAbs,
      es_abs: esAbs,
      var_rel: varRel,
      es_rel: esRel,
    };
  });
}

export function handleMVaRProductPLData(receivedData) {
  const rawRows = Array.isArray(receivedData) ? receivedData : [];
  const rows = normalizeProductContributionRows(rawRows);

  if (typeof appState.setMvarProductData !== 'function') {
    throw new Error('[MVaR ProductPL] Missing store: appState.setMvarProductData');
  }

  appState.setMvarProductData(rows);

  // console.log('[MVaR ProductPL] handler called', {
  //   receivedRows: rawRows.length,
  //   normalizedRows: rows.length,
  //   receivedSample: rawRows[0],
  //   normalizedSample: rows[0],
  //   storeRows: appState.getMvarProductData?.()?.length || 0,
  //   hasStoreGetter: typeof appState.getMvarProductData === 'function',
  // });

  renderMvarProductPLPanel();
}