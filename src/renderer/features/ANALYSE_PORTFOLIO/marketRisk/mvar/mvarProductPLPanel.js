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
import { createContribDrill, scheduleHideConcMenu, bindRightClickDrill } from '../../SummaryBreakdown.js';
import { setupHiDPICanvas } from '../../SummaryYield.js';


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
    data: { labels, datasets: [{ data: values, backgroundColor: 'rgba(42,127,127,0.9)', borderColor: 'rgba(42,127,127,0.9)', borderWidth: 1, maxBarThickness: 16 }] },
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
// Eigener Drill-Kontext fuer das Yield-Panel (#panel-mvar-yield) — gleiche Werte,
// eigene Detail-/Menue-Container, damit beide Panels unabhaengig drillen koennen.
const yieldDrill = createContribDrill({
  var: { detailId: 'mrYieldVarDetail', titleId: 'mrYieldVarDetailTitle', tableId: 'mrYieldVarDetailTable', closeId: 'mrYieldVarDetailClose', menuId: 'mrYieldVarCardMenu', valueType: '__VAR_CONTRIB', valueLabel: 'VaR contrib' },
  es:  { detailId: 'mrYieldEsDetail',  titleId: 'mrYieldEsDetailTitle',  tableId: 'mrYieldEsDetailTable',  closeId: 'mrYieldEsDetailClose',  menuId: 'mrYieldEsCardMenu',  valueType: '__ES_CONTRIB',  valueLabel: 'ES contrib' },
});
function productStep(prodId) { return { colKey: 'PROD_ID', value: String(prodId || ''), label: 'Product' }; }

const _prodContribCharts = new Map();
function destroyProdContribChart(id) { const c = _prodContribCharts.get(id); if (c) { try { c.destroy(); } catch {} _prodContribCharts.delete(id); } }

// Anzahl im Scatter gezeigter Produkte je Scatter-Canvas (3/5/10/'all'); Default 5.
const _prodScatterLimit = new Map();
// Letzte Chart-Rows -> Re-Render des Scatters beim Wechsel der Anzahl.
let _lastProdChartRows = [];
function bindProdCanvasLeave(canvas) { if (!canvas || canvas.dataset.prodLeaveBound) return; canvas.dataset.prodLeaveBound = '1'; canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} }); }
// Kleiner "Reset Zoom"-Button oben rechts ueber dem Scatter. Idempotent; liest die
// aktuelle Chart-Instanz aus _prodContribCharts, uebersteht also jedes Neuzeichnen.
function ensureProdScatterZoomTools(canvas, scatterId) {
  const box = canvas?.parentElement;
  if (!box) return;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  if (box.querySelector('.prod-zoom-reset')) return;
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'prod-zoom-reset';
  btn.textContent = 'Reset Zoom';
  btn.title = 'Reset zoom';
  btn.style.cssText =
    'position:absolute;top:6px;right:6px;z-index:5;font-size:10px;padding:2px 8px;' +
    'border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;color:#334155;cursor:pointer;';
  btn.addEventListener('click', () => { try { _prodContribCharts.get(scatterId)?.resetZoom?.(); } catch {} });
  box.appendChild(btn);

  // Bedienhinweis, damit Zoom + Rechtsklick-Drill auffindbar sind.
  if (!box.querySelector('.prod-zoom-hint')) {
    const hint = document.createElement('div');
    hint.className = 'prod-zoom-hint';
    hint.textContent = 'Drag to zoom · right-click a point to drill';
    hint.style.cssText =
      'position:absolute;top:8px;left:10px;z-index:5;font-size:10px;color:#94a3b8;pointer-events:none;';
    box.appendChild(hint);
  }
}
// Auswahl "Show: 3 / 5 / 10 / All" oben im Scatter -> begrenzt die Anzahl der
// gezeigten Produkte (Top-N nach Beitrag). Idempotent; Wert je Scatter gemerkt.
function ensureProdScatterEntryPicker(canvas, cfg) {
  const box = canvas?.parentElement;
  if (!box) return;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  if (box.querySelector('.prod-entry-count')) return;

  const wrap = document.createElement('div');
  wrap.className = 'prod-entry-wrap';
  wrap.style.cssText = 'position:absolute;top:6px;right:86px;z-index:5;display:flex;align-items:center;gap:4px;';
  const lbl = document.createElement('span');
  lbl.textContent = 'Show';
  lbl.style.cssText = 'font-size:10px;color:#94a3b8;';
  const sel = document.createElement('select');
  sel.className = 'prod-entry-count';
  sel.style.cssText = 'font-size:10px;padding:1px 4px;border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;color:#334155;cursor:pointer;';
  [['3', '3'], ['5', '5'], ['10', '10'], ['all', 'All']].forEach(([v, t]) => {
    const o = document.createElement('option'); o.value = v; o.textContent = t; sel.appendChild(o);
  });
  const cur = _prodScatterLimit.get(cfg.scatterId);
  sel.value = (cur == null ? '5' : String(cur));
  sel.addEventListener('change', () => {
    const v = sel.value === 'all' ? 'all' : parseInt(sel.value, 10);
    _prodScatterLimit.set(cfg.scatterId, v);
    try { renderProductScatter(_lastProdChartRows, cfg); } catch {}
  });
  wrap.appendChild(lbl); wrap.appendChild(sel);
  box.appendChild(wrap);
}

// Drill per RECHTSKLICK auf einen Produkt-Punkt: unterdrueckt das native Kontextmenue
// und oeffnet das Drill-Menue am Cursor. Liest Instanz + Punkte zur Klickzeit neu.
function bindProdScatterContextDrill(canvas, cfg) {
  if (!canvas || canvas.dataset.prodCtxBound) return;
  canvas.dataset.prodCtxBound = '1';
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    try {
      const chart = _prodContribCharts.get(cfg.scatterId);
      if (!chart) return;
      const el = (chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || [])
        .find(x => x.datasetIndex === 1);
      if (!el) { scheduleHideConcMenu(); return; }
      // Steps passend zum aktuellen Punkt-Index aufbauen (Products-Dataset = Index 1).
      const steps = chart.data.datasets[1].data.map(p => productStep(p?.prod_id));
      (cfg.drill || productDrill).hover(cfg.kind, { native: e }, [el], steps);
    } catch {}
  });
}

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

// Chart-Entities je Produkt: NAV-/Yield-/VaR-/ES-Anteil (Share of total, Magnitude).
// yield_w = ytmPortA (bereits NAV-gewichtete Yield aus der Portfolio-View, wie im
// Yield-Dashboard); yield_rel = Anteil an der Portfolio-Yield.
function buildProductChartRows(productRows, baseMap) {
  const rows = (Array.isArray(productRows) ? productRows : []).map(r => {
    const pid = String(r.prod_id || '');
    const base = baseMap.get(pid) || {};
    return {
      prod_id: pid,
      // Description bevorzugt aus der MVaR-Zeile, sonst aus der Portfolio-Basiszeile
      // (MVaR-Ergebniszeilen fuehren oft keine description mit).
      label: (r.description || firstValue(base, ['DESCRIPTION', 'description', 'PRODUCT_NAME', 'product_name'], '') || pid || '-'),
      nav: toNumber(firstValue(base, ['NAV', 'nav'], 0), 0),
      yield_buy: toNumber(firstValue(base, ['ytm_BUY', 'YTM_BUY', 'ytm_buy'], null), null),
      yield_act: toNumber(firstValue(base, ['ytm', 'YTM'], null), null),
      yield_w: toNumber(firstValue(base, ['ytmPortA', 'ytmporta', 'YTMPORTA'], 0), 0),
      var_abs: toNumber(r.var_abs, 0),
      es_abs: toNumber(r.es_abs, 0),
    };
  });
  const totVar = rows.reduce((s, x) => s + Math.abs(x.var_abs), 0);
  const totEs = rows.reduce((s, x) => s + Math.abs(x.es_abs), 0);
  const totNav = rows.reduce((s, x) => s + x.nav, 0);
  const totYield = rows.reduce((s, x) => s + x.yield_w, 0);
  rows.forEach(x => {
    x.var_rel = totVar ? Math.abs(x.var_abs) / totVar : null;
    x.es_rel = totEs ? Math.abs(x.es_abs) / totEs : null;
    x.nav_rel = totNav ? x.nav / totNav : null;
    x.yield_rel = totYield ? x.yield_w / totYield : null;
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

function escKpi(s) { return String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c])); }
function relPct1(v) { return Number.isFinite(v) ? `${(v * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : '–'; }

// Gesamt-VaR/ES aus dem AGGREGAT (MarketVaR) fuer den aktuellen (port, scenario) — DIE EINE
// Quelle fuer den Total-VaR. Die Summe der Produkt-/Issuer-Beitraege reconciled nicht exakt
// (Euler-Allokation) und zeigt sonst eine andere Zahl als Factors/Dashboard.
function aggregateTotalForMetric(metric) {
  const context = getCurrentMvarContext(appState);
  const rows = (appState.getAllMvarData?.() || []).filter((r) => rowMatchesMvarContext(r, context));
  if (!rows.length) return null;
  const asof = (r) => String(r?.asof_date ?? r?.ASOF_DATE ?? '').slice(0, 10);
  const row = rows.slice().sort((a, b) => asof(a).localeCompare(asof(b))).at(-1);
  const isEs = String(metric).toUpperCase() === 'ES';
  const abs = Math.abs(toNumber(row?.[isEs ? 'ES_T_abs' : 'VaR_T_abs'], 0));
  const rel = Math.abs(toNumber(row?.[isEs ? 'ES_T_rel' : 'VaR_T_rel'], 0));
  return {
    abs,
    relStr: `${rel.toLocaleString('de-DE', { maximumFractionDigits: 3 })}%`,
  };
}

// KPI-Band ueber den Charts einer Metrik (VaR/ES): Total, Top-Produkt (% vom Total),
// Top-5-Konzentration (%), staerkster ueberproportionaler Beitrag (Risk vs. weight).
function renderProductKpis(chartRows, cfg, hostId, tableId) {
  const host = document.getElementById(hostId);
  const tblEl = tableId ? document.getElementById(tableId) : null;
  if (!host && !tblEl) return;
  const rows = (Array.isArray(chartRows) ? chartRows : [])
    .slice()
    .sort((a, b) => Math.abs(toNumber(b[cfg.absKey], 0)) - Math.abs(toNumber(a[cfg.absKey], 0)));
  if (!rows.length) { if (host) host.innerHTML = ''; if (tblEl) tblEl.innerHTML = ''; return; }

  const shareKey = cfg.shareKey || 'nav_rel';
  const total = rows.reduce((s, r) => s + Math.abs(toNumber(r[cfg.absKey], 0)), 0);
  // Relativer Gesamt-VaR = Summe der relativen Beitraege (erste KPI-Karte: absolut + relativ).
  const totalRel = rows.reduce((s, r) => s + toNumber(r[cfg.relKey], 0), 0);
  const top = rows[0];
  const top5 = rows.slice(0, 5).reduce((s, r) => s + (r[cfg.relKey] || 0), 0);
  // Staerkster ueberproportionaler Beitrag: max(Risikobeitrag% - Share-Anteil%).
  let over = null;
  for (const r of rows) {
    if (r[cfg.relKey] == null || r[shareKey] == null) continue;
    const d = r[cfg.relKey] - r[shareKey];
    if (!over || d > over.d) over = { label: r.label, d };
  }
  const overVal = over ? `${over.d >= 0 ? '+' : ''}${(over.d * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} pp` : '–';

  const aggTot = aggregateTotalForMetric(cfg.metric);
  const totalCard = aggTot
    ? { label: `Total ${cfg.metric}`, value: `${fmtAbs(aggTot.abs)} (${aggTot.relStr})`, sub: 'portfolio total',        desc: `Portfolio ${cfg.metric} (all products)` }
    : { label: `Total ${cfg.metric}`, value: `${fmtAbs(total)} (${relPct1(totalRel)})`,   sub: 'sum of contributions',   desc: `Portfolio ${cfg.metric} (all products)` };
  const cards = [
    totalCard,
    { label: 'Top product',             value: relPct1(top[cfg.relKey]), sub: top.label || '–',         desc: `Largest ${cfg.metric} contributor` },
    { label: 'Top-5 concentration',     value: relPct1(top5),            sub: `of total ${cfg.metric}`, desc: '5 largest products combined' },
    { label: cfg.overLabel || 'Highest risk vs. weight', value: overVal, sub: over ? over.label : '–',  desc: cfg.overDesc || 'Contribution above NAV weight' },
  ];

  if (host) {
    host.innerHTML = cards.map((c) => `
      <div class="mr-kpi-card">
        <div class="mr-kpi-card__label">${escKpi(c.label)}</div>
        <div class="mr-kpi-card__value">${escKpi(c.value)}</div>
        <div class="mr-kpi-card__sub">${escKpi(c.sub)}</div>
        <div class="mr-kpi-card__desc">${escKpi(c.desc)}</div>
      </div>`).join('');
  }

  // Gespiegelte Label/Wert-Tabelle fuer Preview/PDF (data-kpi-band -> Kachel-Band).
  if (tblEl) {
    tblEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      cards.map((c) => `<tr><td>${escKpi(c.label)}</td><td>${escKpi(c.value)}</td></tr>`).join('')
    }</tbody></table>`;
  }
}

// shareKey/-Labels bestimmen die Vergleichsachse (x): Products = NAV-Anteil,
// Yield = Anteil an der Portfolio-Yield (buy, ytmPortA-basiert). drill = Drill-Kontext.
const PROD_VAR_CFG = { kind: 'var', absKey: 'var_abs', relKey: 'var_rel', metric: 'VaR', barId: 'mvarProductVarContribChart', scatterId: 'mvarProductVarScatterChart', shareKey: 'nav_rel', shareLabel: 'Portfolio share (NAV)', shareAxisTitle: 'Portfolio share % (NAV)', shareShort: 'NAV', overLabel: 'Highest risk vs. weight', overDesc: 'Contribution above NAV weight', drill: productDrill };
const PROD_ES_CFG  = { kind: 'es',  absKey: 'es_abs',  relKey: 'es_rel',  metric: 'ES',  barId: 'mvarProductEsContribChart',  scatterId: 'mvarProductEsScatterChart',  shareKey: 'nav_rel', shareLabel: 'Portfolio share (NAV)', shareAxisTitle: 'Portfolio share % (NAV)', shareShort: 'NAV', overLabel: 'Highest risk vs. weight', overDesc: 'Contribution above NAV weight', drill: productDrill };

const YIELD_VAR_CFG = { kind: 'var', absKey: 'var_abs', relKey: 'var_rel', metric: 'VaR', barId: 'mvarYieldVarContribChart', scatterId: 'mvarYieldVarScatterChart', shareKey: 'yield_rel', shareLabel: 'Yield share (buy)', shareAxisTitle: 'Yield share % (buy)', shareShort: 'Yield', overLabel: 'Highest risk vs. yield share', overDesc: 'Contribution above yield share', drill: yieldDrill };
const YIELD_ES_CFG  = { kind: 'es',  absKey: 'es_abs',  relKey: 'es_rel',  metric: 'ES',  barId: 'mvarYieldEsContribChart',  scatterId: 'mvarYieldEsScatterChart',  shareKey: 'yield_rel', shareLabel: 'Yield share (buy)', shareAxisTitle: 'Yield share % (buy)', shareShort: 'Yield', overLabel: 'Highest risk vs. yield share', overDesc: 'Contribution above yield share', drill: yieldDrill };

// Gruppierter horizontaler Balken je Produkt (Top 15): Share-Anteil (cfg.shareKey:
// NAV- oder Yield-Anteil) vs. Risikobeitrag %.
function renderProductContribChart(rows, cfg) {
  const canvas = document.getElementById(cfg.barId);
  destroyProdContribChart(cfg.barId);
  if (!canvas || !window.Chart) return;
  const shareKey = cfg.shareKey || 'nav_rel';
  const chartRows = (Array.isArray(rows) ? rows : [])
    .filter(r => Math.abs(toNumber(r[cfg.absKey], 0)) > 0 || Math.abs(toNumber(r[shareKey], 0)) > 0)
    .slice().sort((a, b) => Math.abs(toNumber(b[cfg.absKey], 0)) - Math.abs(toNumber(a[cfg.absKey], 0)))
    .slice(0, 15);
  if (!chartRows.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  bindProdCanvasLeave(canvas);
  const labels = chartRows.map(r => r.label || '-');
  const steps = chartRows.map(r => productStep(r.prod_id));
  const navPct = chartRows.map(r => (r[shareKey] != null ? +(r[shareKey] * 100).toFixed(2) : 0));
  const contribPct = chartRows.map(r => (r[cfg.relKey] != null ? +(r[cfg.relKey] * 100).toFixed(2) : 0));
  canvas.width = 760; canvas.height = Math.max(300, chartRows.length * 26 + 70);
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      // Palette: Portfolio-Anteil = Portfolio-Blau; Risiko-Beitrag = Market-Teal
      // (VaR) bzw. gelblichere Nuance (ES), damit beide Metriken unterscheidbar sind.
      { label: cfg.shareLabel || 'Portfolio share (NAV)', data: navPct, backgroundColor: 'rgba(108,155,209,0.9)', borderColor: 'rgba(108,155,209,0.9)', borderWidth: 1, maxBarThickness: 10 },
      { label: `Risk contribution (${cfg.metric})`, data: contribPct,
        backgroundColor: cfg.metric === 'ES' ? 'rgba(122,158,74,0.9)' : 'rgba(42,127,127,0.9)',
        borderColor: cfg.metric === 'ES' ? 'rgba(122,158,74,0.9)' : 'rgba(42,127,127,0.9)',
        borderWidth: 1, maxBarThickness: 10 },
    ] },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      // Drill per RECHTSKLICK (bindRightClickDrill unten) — konsistent mit den Scatter-Charts.
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartColor, font: { family: chartFont } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.x).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Math.round(Number(v) * 100) / 100}%` }, grid: { color: 'rgba(128,128,128,0.15)' }, title: { display: true, text: `% of ${cfg.shareShort || 'NAV'}  /  % of total ${cfg.metric}`, color: chartColor, font: { family: chartFont } } },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 10 } }, grid: { display: false } },
      },
    },
  });
  chart.$barSteps = steps;
  _prodContribCharts.set(cfg.barId, chart);
  bindRightClickDrill(canvas, () => _prodContribCharts.get(cfg.barId),
    (el, ch, e) => (cfg.drill || productDrill).hover(cfg.kind, { native: e }, [el], ch.$barSteps || []));
}

// Streudiagramm je Produkt: x = Share-Anteil % (cfg.shareKey: NAV oder Yield),
// y = Risikobeitrag %, 45°-Diagonale.
function renderProductScatter(rows, cfg) {
  const canvas = document.getElementById(cfg.scatterId);
  destroyProdContribChart(cfg.scatterId);
  if (!canvas || !window.Chart) return;
  const shareKey = cfg.shareKey || 'nav_rel';
  // Nach Beitragsgroesse (aktuelle Metrik) sortieren und optional auf Top-N begrenzen
  // (Auswahl 3/5/10/All ueber den Entry-Picker). Default: Top 5.
  const sorted = (Array.isArray(rows) ? rows.slice() : [])
    .filter(r => r[shareKey] != null && r[cfg.relKey] != null)
    .sort((a, b) => Math.abs(toNumber(b[cfg.absKey], 0)) - Math.abs(toNumber(a[cfg.absKey], 0)));
  const limit = _prodScatterLimit.has(cfg.scatterId) ? _prodScatterLimit.get(cfg.scatterId) : 5;
  const limited = (limit === 'all') ? sorted : sorted.slice(0, limit);
  const pts = limited.map(r => ({ x: +(r[shareKey] * 100).toFixed(2), y: +(r[cfg.relKey] * 100).toFixed(2), issuer: r.label || '-', prod_id: r.prod_id }));
  if (!pts.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  bindProdCanvasLeave(canvas);
  const scatterSteps = pts.map(p => productStep(p.prod_id));
  const labelSet = new Set([...pts].sort((a, b) => b.y - a.y).slice(0, 8).map(p => p.issuer));
  // Achse nicht von einzelnen Ausreissern (z. B. eine sehr grosse Position) sprengen
  // lassen: 95%-Perzentil der Punkt-Maxima als Obergrenze (min. 5 %). Der dichte Cluster
  // wird so lesbar; der/die extremsten Punkte werden ausserhalb der Achse beschnitten.
  const maxima = pts.map(p => Math.max(p.x, p.y)).sort((a, b) => a - b);
  const pctl = (arr, q) => (arr.length ? arr[Math.min(arr.length - 1, Math.floor(q * (arr.length - 1)))] : 0);
  // Bei begrenzter Auswahl ALLE gewaehlten Punkte zeigen (kein 95%-Clipping, das sonst
  // den groessten Punkt abschneidet); bei "All" das 95%-Perzentil gegen Ausreisser.
  const axBasis = (limit === 'all') ? pctl(maxima, 0.95) : (maxima[maxima.length - 1] || 0);
  const axMax = Math.max(5, Math.ceil(axBasis * 1.1));
  // Zeichenpuffer an die TATSAECHLICHE Anzeigegroesse koppeln (CSS erzwingt width:100%/
  // height per !important). Sonst weichen Logik- und Darstellungsraum ab und die
  // Hover-/Klick-Koordinaten liegen neben dem sichtbaren Punkt (Tooltip-/Drill-Offset).
  const scatterCtx = setupHiDPICanvas(canvas, 520, 400, true);
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chart = new window.Chart(scatterCtx, {
    type: 'scatter',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: { datasets: [
      { type: 'line', label: 'proportional', data: [{ x: 0, y: 0 }, { x: axMax, y: axMax }], borderColor: 'rgba(150,165,185,0.7)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, fill: false, order: 2 },
      { label: 'Products', data: pts, backgroundColor: 'rgba(46,88,130,0.75)', borderColor: 'rgba(46,88,130,0.9)', pointRadius: 6, pointHoverRadius: 7, order: 1 },
    ] },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      // Punkte leichter treffen: nearest in 2D (x UND y), etwas groesserer Trefferradius.
      interaction: { mode: 'nearest', intersect: true, axis: 'xy' },
      hover:       { mode: 'nearest', intersect: true, axis: 'xy' },
      elements:    { point: { hitRadius: 8, hoverRadius: 8 } },
      // Drill wird per RECHTSKLICK ausgeloest (bindProdScatterContextDrill), damit
      // Hovern und Ziehen (Box-Zoom) das Menue nicht ungewollt oeffnen.
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw?.issuer ?? ''}: ${cfg.shareShort || 'NAV'} ${ctx.raw?.x}% / ${cfg.metric} ${ctx.raw?.y}%` } },
        datalabels: window.ChartDataLabels ? { align: 'right', anchor: 'center', offset: 6, color: chartColor, font: { family: chartFont, size: 10 }, formatter: (v) => (v && labelSet.has(v.issuer) ? v.issuer : '') } : undefined,
        // Zoom/Box-Zoom (chartjs-plugin-zoom, global geladen): Ziehen = Rechteck-Auswahl,
        // Wheel = Zoom, Ctrl+Ziehen = Pan. Reset ueber den Button (ensureProdScatterZoomTools).
        zoom: {
          pan:  { enabled: true, mode: 'xy', modifierKey: 'ctrl' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag:  { enabled: true, backgroundColor: 'rgba(75,150,225,0.15)', borderColor: 'rgba(75,150,225,0.6)', borderWidth: 1 },
            mode: 'xy',
          },
        },
      },
      scales: {
        x: { beginAtZero: true, max: axMax, title: { display: true, text: cfg.shareAxisTitle || 'Portfolio share % (NAV)', color: chartColor, font: { family: chartFont } }, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Math.round(Number(v) * 100) / 100}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { beginAtZero: true, max: axMax, title: { display: true, text: `Risk contribution % (${cfg.metric})`, color: chartColor, font: { family: chartFont } }, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Math.round(Number(v) * 100) / 100}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
      },
    },
  });
  _prodContribCharts.set(cfg.scatterId, chart);
  ensureProdScatterZoomTools(canvas, cfg.scatterId);
  ensureProdScatterEntryPicker(canvas, cfg);
  bindProdScatterContextDrill(canvas, cfg);
}

// Volle Yield-Tabelle unten im Yield-Panel: Yields + Anteile + Risikobeitraege.
// Nach Yield (buy) absteigend sortiert — Zeile 1 = renditestaerkstes Produkt, dessen
// Portfolio- (NAV) und Risiko-Anteile direkt ablesbar sind.
function renderYieldTable(chartRows) {
  const container = document.getElementById('mvarYieldTableContainer');
  if (!container) return;
  const rows = (Array.isArray(chartRows) ? chartRows.slice() : [])
    .sort((a, b) => toNumber(b.yield_buy, -Infinity) - toNumber(a.yield_buy, -Infinity));
  const pct2 = (v) => (v != null && Number.isFinite(v) ? `${(v * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '-');
  renderTable(
    container,
    rows,
    [
      { label: 'Product ID',            value: r => r.prod_id },
      { label: 'Description',           value: r => r.label },
      { label: 'Yield (buy)',           value: r => pct2(r.yield_buy), alignRight: true },
      { label: 'Yield (current)',       value: r => pct2(r.yield_act), alignRight: true },
      { label: 'Yield share',           value: r => relPct1(r.yield_rel), alignRight: true },
      { label: 'Portfolio share (NAV)', value: r => relPct1(r.nav_rel), alignRight: true },
      { label: 'VaR abs',               value: r => formatMaybeAbs(r.var_abs), alignRight: true },
      { label: 'VaR share',             value: r => relPct1(r.var_rel), alignRight: true },
      { label: 'ES abs',                value: r => formatMaybeAbs(r.es_abs), alignRight: true },
      { label: 'ES share',              value: r => relPct1(r.es_rel), alignRight: true },
    ],
    'No MVaR yield data.'
  );
  attachIdLinks(container, { prodHeader: 'Product ID' });
}

function renderProductContribCharts(productRows) {
  const baseMap = buildProdBaseMap();
  const chartRows = buildProductChartRows(productRows, baseMap);
  _lastProdChartRows = chartRows;   // fuer Re-Render des Scatters bei Anzahl-Wechsel
  renderProductKpis(chartRows, PROD_VAR_CFG, 'mvarProductVarKpis', 'mvarProductVarKpisTable');
  renderProductKpis(chartRows, PROD_ES_CFG, 'mvarProductEsKpis', 'mvarProductEsKpisTable');
  renderProductContribChart(chartRows, PROD_VAR_CFG); renderProductScatter(chartRows, PROD_VAR_CFG);
  renderProductContribChart(chartRows, PROD_ES_CFG);  renderProductScatter(chartRows, PROD_ES_CFG);
  // Yield-Panel (#panel-mvar-yield): gleiche Daten, x-Achse = Yield-Anteil (buy).
  renderProductKpis(chartRows, YIELD_VAR_CFG, 'mvarYieldVarKpis', 'mvarYieldVarKpisTable');
  renderProductKpis(chartRows, YIELD_ES_CFG, 'mvarYieldEsKpis', 'mvarYieldEsKpisTable');
  renderProductContribChart(chartRows, YIELD_VAR_CFG); renderProductScatter(chartRows, YIELD_VAR_CFG);
  renderProductContribChart(chartRows, YIELD_ES_CFG);  renderProductScatter(chartRows, YIELD_ES_CFG);
  renderYieldTable(chartRows);
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
    try { yieldDrill.setData([]); } catch {}
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

  // Drill-Datenquelle (Produkte + Portfolio-Felder + Beitraege) fuer beide Metriken
  // und beide Panels (Products + Yield).
  try {
    const drillRows = buildProductDrillRows(filteredRows, buildProdBaseMap());
    productDrill.setData(drillRows);
    yieldDrill.setData(drillRows);
  } catch (e) { console.warn('[MVaR ProductPL] drill data failed', e); }

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