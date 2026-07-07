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

    showChartMessage('No MVaR product chart data.');

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
  renderProductChartWhenReady(productRows);

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