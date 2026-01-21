import { getColorFromPalette, getPortfolioColor } from '../../utils/colors.js';
import { appState } from '../renderer.js';
import { openPanel } from '../../FRONT_END/UI/panels.js'; 



export function handleSummaryMarketRiskData(port_name, scenario_name, asof_date = null) {
  console.log('port_name:', port_name, 'scenario_name:', scenario_name, 'asof_date:', asof_date);

  const elementId = `portDataContainer${0}`;
  const portfolioData = appState.getPortAggData(elementId) || {};

  const num = (x) => Number(String(x ?? '').replace(/[^\d.-]/g, '').replace(',', ''));

  // --- Portfolio ratios ---
  let portValueRel = 1;
  let portfolioEndValue = 100;

  const portValue    = num(portfolioData.formPortValue);
  const portNotional = num(portfolioData.formPortNotional);
  const portPV01     = num(portfolioData.formPortPV01);

  if (Number.isFinite(portValue) && Number.isFinite(portNotional) && portNotional !== 0) {
    portValueRel = portValue / portNotional;
    portfolioEndValue = portValueRel * 100;
  }

  // --- NAV ---
  const OriPortData = appState.getAllPortfolioData() || [];
  const portNav = OriPortData
    .filter(item => item && item.port_name === port_name)
    .reduce((sum, item) => sum + num(item.NAV), 0);

  if (!Number.isFinite(portNav) || portNav === 0) {
    console.warn(`Invalid or zero NAV for port_name=${port_name}; cannot compute P/L%`, { portNav });
    return;
  }

  // --- VaR aggregate (header): pick latest if asof_date not provided ---
  const mvarAggData = appState.getAllMvarData() || [];
  const aggMatches = mvarAggData.filter(item =>
    item &&
    item.port_name === port_name &&
    (!scenario_name || item.scenario_name === scenario_name)
  );

  let chosenAgg = null;
  if (asof_date) {
    chosenAgg = aggMatches.find(x => String(x.asof_date) === String(asof_date)) || null;
  } else if (aggMatches.length) {
    const sorted = aggMatches
      .slice()
      .sort((a, b) => String(a.asof_date).localeCompare(String(b.asof_date)));
    chosenAgg = sorted[sorted.length - 1] || null;
  }

  const chosenAsof = asof_date || chosenAgg?.asof_date || null;
  const varTRel = Number(chosenAgg?.VaR_T_rel) || 0;

  // --- Distribution data: try exact (port, scenario, asof) first ---
const mvarDistData = appState.getMvarDistData({
  port_name,
  scenario_name,
  asof_date: chosenAsof,
}) || [];

// console.log('[DBG] dist lookup:', {
//   port_name,
//   scenario_name,
//   chosenAsof,
//   len: Array.isArray(mvarDistData) ? mvarDistData.length : null,
// });

if (!Array.isArray(mvarDistData) || mvarDistData.length === 0) {
  console.warn(
    '[DIST] No distribution for EXACT selection – nothing rendered (expected in test mode)',
    { port_name, scenario_name, chosenAsof }
  );
  return;
}


  // console.log('mvarDistData sample keys:', mvarDistData[0] ? Object.keys(mvarDistData[0]) : null);
  // console.log('mvarDistData sample row:', mvarDistData[0] || null);

  // --- Robust P/L field handling (supports new + old schemas) ---
  const plValues = mvarDistData
    .map(row => {
      const raw =
        row?.pl_total ??
        row?.PL_TOTAL ??
        row?.["P/L"] ??
        row?.pl ??
        row?.PL ??
        null;
      return Number(raw);
    })
    .filter(v => Number.isFinite(v))
    .map(v => (v / portNav) * 100);

  if (plValues.length === 0) {
    console.warn("No numeric P/L values found in distribution data. Check column name mapping.", {
      sample_keys: mvarDistData?.[0] ? Object.keys(mvarDistData[0]) : null,
      sample_row: mvarDistData?.[0] || null,
    });
    return;
  }

  // --- Render chart ---
  const canvas = document.getElementById('plMvarDistChart');
  if (!canvas) return console.warn("Canvas #plMvarDistChart not found in DOM");

  const ctx = canvas.getContext('2d');
  if (window.plMvarDistChartInstance) window.plMvarDistChartInstance.destroy();

  const { data, options } = drawMvarHistogram(plValues, portValueRel, varTRel);
  window.plMvarDistChartInstance = new Chart(ctx, { type: 'bar', data, options });

  if (Number.isFinite(portPV01)) {
    drawSyntheticPortfolioChart(portfolioEndValue, portPV01, 5);
  }
}

// HISTOGRAMM:

function createHistogramDataAdjusted(values, portValueRel = 1, numBins = 50) {
  // 1. In absolute Performance umrechnen
  const adjusted = values.map(v => portValueRel * (1 + v / 100)); // z. B. -2% → 0.97

  // 2. Basiswerte
  const avg = adjusted.reduce((sum, v) => sum + v, 0) / adjusted.length;
  const spread = Math.max(...adjusted) - Math.min(...adjusted);
  const padding = spread * 0.2; // ⬅️ Optional: Padding für Symmetrie

  // 3. Symmetrischer Bereich um avg
  const min = avg - spread / 2 - padding;
  const max = avg + spread / 2 + padding;
  const binWidth = (max - min) / numBins;

  const bins = Array(numBins).fill(0);

  // 4. Zählen
  adjusted.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[binIndex]++;
  });

  // 5. Labels generieren als Prozent (% vom NAV)
  const labels = bins.map((_, i) => {
    const start = ((min + i * binWidth) * 100).toFixed(2);
    const end = ((min + (i + 1) * binWidth) * 100).toFixed(2);
    return `${start}% – ${end}%`;
  });

  return { labels, bins };
}

function drawMvarHistogram(plValues, portValueRel, varTRel) {
  const histogram = createHistogramDataAdjusted(plValues, portValueRel);

  const toPercent = v => v * 100;

  const portPercent = toPercent(portValueRel);
  const varPercent = toPercent(varTRel) / 100;

  const thresholdPercent = portPercent + varPercent;

  // ✅ Robust: entfernt ALLE Prozentzeichen, normalisiert Dash-Varianten, parst sauber
  const findBinIndexForValue = (value, labels) =>
    labels.findIndex(label => {
      // Beispiel-Label: "95.12% – 96.34%"
      const cleaned = String(label)
        .replace(/%/g, '')          // <- ALLE % entfernen (dein Bug)
        .replace(/[–—]/g, '-')      // <- En-Dash/Em-Dash auf normales '-' normalisieren
        .replace(/\s+/g, ' ')       // <- Whitespace normalisieren
        .trim();

      const parts = cleaned.split('-').map(s => s.trim());
      if (parts.length < 2) return false;

      const start = Number.parseFloat(parts[0]);
      const end   = Number.parseFloat(parts[1]);

      if (!Number.isFinite(start) || !Number.isFinite(end)) return false;

      // Sicherheit: falls start/end vertauscht (sollte nicht passieren, aber robust)
      const lo = Math.min(start, end);
      const hi = Math.max(start, end);

      // Wichtig: include hi, weil dein Label "start – end" inkl. Endpunkt wirken soll
      return value >= lo && value <= hi;
    });

  const portBinIndex = findBinIndexForValue(portPercent, histogram.labels);
  const thresholdBinIndex = findBinIndexForValue(thresholdPercent, histogram.labels);

  const pCol = getPortfolioColor(1); // Garmin-Pink für Portfolio-Bin

  const backgroundColor = histogram.bins.map((_, i) => {
    if (thresholdBinIndex !== -1 && i === thresholdBinIndex) {
      return 'rgba(255, 0, 0, 1)'; // Threshold-Bin: True Red
    }
    if (portBinIndex !== -1 && i === portBinIndex) {
      return pCol.backgroundColor;  // Portfolio-Bin: Garmin-Pink
    }
    return 'rgba(54, 162, 235, 0.5)'; // Standard
  });

  const borderColor = histogram.bins.map((_, i) => {
    if (thresholdBinIndex !== -1 && i === thresholdBinIndex) {
      return 'rgba(255, 0, 0, 1)';
    }
    if (portBinIndex !== -1 && i === portBinIndex) {
      return pCol.borderColor; // Portfolio-Bin Rand: Garmin-Pink
    }
    return 'rgba(54, 162, 235, 1)';
  });

  return {
    data: {
      labels: histogram.labels,
      datasets: [
        {
          label: 'Frequency',
          data: histogram.bins,
          backgroundColor,
          borderColor,
          borderWidth: 1
        }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y', // horizontaler Chart
      scales: {
        x: {
          title: { display: true, text: 'Frequency' },
          ticks: { beginAtZero: true }
        },
        y: {
          title: { display: true, text: 'P/L as % of NAV' },
          reverse: true
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => {
              const freq = context.raw;
              const label = context.label;
              return `${label}: ${freq}`;
            }
          }
        }
      }
    }
  };
}


// SYNTHETIC PORTFOLIO &  CMB CHART:

function createAllProductData(tsData, testTtM, pv01, startValue = 100) {
  const result = [];
  let currentValue = startValue;

  for (let i = 1; i < tsData.length; i++) {
    const prev = tsData[i - 1];
    const curr = tsData[i];

    const prevRate = interpolateSwapRateDynamic(prev, testTtM);
    const currRate = interpolateSwapRateDynamic(curr, testTtM);
    if (prevRate == null || currRate == null) continue;

    const diff = currRate - prevRate;
    const impact = diff * pv01;
    currentValue *= (1 + impact / 100);

    result.push({
      x: curr.DATE || curr.date,
      y: currentValue,
      originalY: currentValue
    });
  }

  return result;
}

function drawSyntheticPortfolioChart(targetEndValue = 100, portPV01 = 1, testTtM = 5) {
  const tsData = appState.getTblTSData();

  const testCurr = tsData[tsData.length - 1];
  const testCurrRate = interpolateSwapRateDynamic(testCurr, testTtM) / 100;

  const testPV01 = -testTtM / (1 + testCurrRate);
  const portfolioPV01 = portPV01;

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const tsFiltered = tsData.filter(d => new Date(d.DATE || d.date) >= threeYearsAgo);

  const rawSynthetic = createAllProductData(tsFiltered, testTtM, testPV01);
  const rawPortfolio = createAllProductData(tsFiltered, testTtM, portfolioPV01);

  const syntheticData = normalizeCurveToEndValue(rawSynthetic, targetEndValue);
  const portfolioData = normalizeCurveToEndValue(rawPortfolio, targetEndValue);

  const allYValues = [...syntheticData, ...portfolioData].map(p => p.y);
  const ySpread = Math.max(...allYValues) - Math.min(...allYValues);
  const yPadding = ySpread * 0.1;
  const yMax = targetEndValue + ySpread / 2 + yPadding;
  const yMin = targetEndValue - ySpread / 2 - yPadding;

  const cmbValueDataset = {
    label: `Synthetic CMB (${testTtM}Y)`,
    data: syntheticData,
    borderColor: 'rgba(45, 212, 191, 0.9)',
    backgroundColor: 'rgba(45, 212, 191, 0.4)',
    tension: 0.1,
    pointRadius: 0
  };

  // ✅ Synthetic Portfolio = Garmin-Pink, gestrichelt
  const pCol = getPortfolioColor(1);
  const portfolioValueDataset = {
    label: `Synthetic Portfolio`,
    data: portfolioData,
    borderColor: pCol.borderColor,
    backgroundColor: 'transparent',
    borderDash: [8, 6],
    tension: 0.1,
    pointRadius: 0
  };

  const lastPoint = syntheticData[syntheticData.length - 1];

  // ✅ Current Portfolio Value Marker = Garmin-Pink
  const endMarker = {
    label: `Current Portfolio Value (${targetEndValue.toFixed(2)}%)`,
    data: [{ x: lastPoint.x, y: targetEndValue }],
    pointRadius: 6,
    pointStyle: 'circle',
    pointBackgroundColor: pCol.backgroundColor,
    pointBorderColor: pCol.borderColor,
    showLine: false,
    borderColor: pCol.borderColor,
    backgroundColor: pCol.backgroundColor,
  };

  // 🔄 Chart generieren
  window.tsEU1YChartInstance = createSimpleLineChart(
    [cmbValueDataset, portfolioValueDataset, endMarker],
    'tsEU1YChart',
    'Synthetic Bond vs. Portfolio',
    0,
    { // optionsOverride
      scales: {
        y: {
          min: yMin,
          max: yMax,
          title: { display: true, text: 'Normalized Value (%)' },
        }
      }
    }
  );
}

function interpolateSwapRateDynamic(row, targetYear) {
  const points = Object.entries(row)
    .filter(([key, val]) => key.startsWith('EU_') && !isNaN(parseFloat(val)))
    .map(([key, val]) => {
      const match = key.match(/^EU_(\d+(\.\d+)?)Y$/);
      if (!match) return null;
      return { year: parseFloat(match[1]), rate: parseFloat(val) };
    })
    .filter(p => p && !isNaN(p.year) && !isNaN(p.rate))
    .sort((a, b) => a.year - b.year);

  if (points.length < 2) return null;

  let lower = null, upper = null;
  for (let i = 0; i < points.length - 1; i++) {
    if (targetYear >= points[i].year && targetYear <= points[i + 1].year) {
      lower = points[i];
      upper = points[i + 1];
      break;
    }
  }

  if (!lower || !upper) {
    if (targetYear < points[0].year) return points[0].rate;
    if (targetYear > points[points.length - 1].year) return points[points.length - 1].rate;
    return null;
  }

  const t = (targetYear - lower.year) / (upper.year - lower.year);
  return lower.rate + t * (upper.rate - lower.rate);
}

function normalizeCurveToEndValue(curve, targetEndValue) {
  if (!curve.length) return curve;

  const lastY = curve[curve.length - 1].y;
  const factor = targetEndValue / lastY;

  return curve.map(point => ({
    ...point,
    y: point.y * factor
  }));
}

// NOTE: createSimpleLineChart bleibt bei dir unverändert nutzbar,
// weil wir die Farben im Dataset selbst setzen (inkl. borderDash für Synthetic Portfolio).
function createSimpleLineChart(datasets, chartName, chartTitle = 'Line Chart', pointRadius = 0) {
  const canvasElement = document.getElementById(chartName);
  if (!canvasElement) {
    console.error(`Canvas element with ID "${chartName}" not found.`);
    return null;
  }

  if (window[chartName + 'Instance']) {
    window[chartName + 'Instance'].destroy();
  }

  const ctx = canvasElement.getContext("2d");
  if (!ctx) {
    console.error(`Failed to get 2D context for canvas with ID "${chartName}".`);
    return null;
  }

  const markerDatasets = datasets.filter(d => d.pointStyle === 'circle');
  const regularDatasets = datasets.filter(d => d.pointStyle !== 'circle');

  const allDatasets = [
    ...regularDatasets.map((dataset, index) => ({
      label: dataset.label,
data: dataset.data.map(dataPoint => ({
  x: formatDateLabel(dataPoint.x),   // <-- entscheidend
  y: dataPoint.y,
  originalY: dataPoint.originalY
})),

      fill: false,
      borderColor: dataset.borderColor || getColorFromPalette(index),
      backgroundColor: dataset.backgroundColor || 'transparent',
      tension: dataset.tension ?? 0.1,
      pointRadius: dataset.pointRadius ?? pointRadius,
      borderWidth: dataset.borderWidth ?? 1,
      spanGaps: false,
      borderDash: dataset.borderDash || [],
      yAxisID: 'y'
    })),
    ...markerDatasets.map(marker => ({
      label: marker.label,
      data: marker.data,
      showLine: false,
      pointRadius: marker.pointRadius ?? 5,
      pointStyle: marker.pointStyle ?? 'circle',
      pointBackgroundColor: marker.pointBackgroundColor ?? 'red',
      pointBorderColor: marker.pointBorderColor ?? 'red',
      borderColor: 'transparent',
      backgroundColor: 'transparent',
      yAxisID: 'y'
    }))
  ];

  const targetMarker = markerDatasets.find(m => m.data?.[0]?.y != null);
  const targetY = targetMarker?.data?.[0]?.y ?? 100;

  const allYValues = regularDatasets.flatMap(ds => ds.data.map(p => p.y));
  const minY = Math.min(...allYValues);
  const maxY = Math.max(...allYValues);
  const spread = Math.max(Math.abs(targetY - minY), Math.abs(targetY - maxY));
  const padding = spread * 0.15;

  const yMin = targetY - spread - padding;
  const yMax = targetY + spread + padding;

  const newChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: datasets[0].data.map(d => formatDateLabel(d.x)),
      datasets: allDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        x: {
          display: true,
          title: { display: true, text: "Date" },
          type: 'category',
        },
        y: {
          title: { display: true, text: "Value Development (%)" },
          ticks: { callback: val => `${val.toFixed(2)}%` },
          min: yMin,
          max: yMax
        }
      },
      plugins: {
        tooltip: {
          filter: context => !context.dataset.label?.includes('Current Portfolio Value'),
          callbacks: {
            label: context => {
              const val = context.raw?.y;
              return `${context.dataset.label}: ${val.toFixed(2)}%`;
            }
          }
        },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            drag: { enabled: true },
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x'
          }
        }
      }
    }
  });

  window[chartName + 'Instance'] = newChart;
  return newChart;
}

function formatDateLabel(val) {
  if (val == null) return '';

  // 1) Strings: immer versuchen sauber auf YYYY-MM-DD zu kürzen
  if (typeof val === 'string') {
    const s = val.trim();

    // Wenn es mit YYYY-MM-DD beginnt → IMMER auf die ersten 10 Zeichen kürzen
    // (deckt "YYYY-MM-DD", "YYYY-MM-DD 00:00:00", "YYYY-MM-DDTHH:MM:SS..." ab)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    // Fallback: Date parse versuchen
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);

    // Wenn gar nichts geht: original zurück
    return s;
  }

  // 2) Date/Number: normal parsen
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);

  return String(val);
}

//MarketVaR_Product
export function handleMvarProductTable(port_name, scenario_name, asof_date = null) {
  const container = document.getElementById('mvarProductTableContainer');
  if (!container) {
    console.warn('[PRODUCT] Container #mvarProductTableContainer not found');
    return;
  }

  // Daten holen (latest asof_date, wenn null -> übernimmt get() Logik)
  const rows = appState.getMvarProductData({
    port_name,
    scenario_name,
    asof_date
  }) || [];

  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = `<div class="muted">No product VaR data for selection.</div>`;
    return;
  }

  // Optional: sortiere nach größtem Risiko zuerst (passende Key-Reihenfolge)
  const riskKeyCandidates = [
  'var_contrib_total',   // ✅ neu
  'var_contrib',
  'VaR_Contrib',
  'var', 'VaR',
  'pl_var', 'PL_VaR'
];

  const riskKey = riskKeyCandidates.find(k => k in (rows[0] || {})) || null;

  const sorted = rows.slice().sort((a, b) => {
    if (!riskKey) return 0;
    const av = Number(a?.[riskKey]);
    const bv = Number(b?.[riskKey]);
    if (!Number.isFinite(av) || !Number.isFinite(bv)) return 0;
    return Math.abs(bv) - Math.abs(av);
  });

  // Spalten: robuste Default-Auswahl + Fallback auf alle Keys
  const columns = pickProductColumns(sorted);

  // Render
  container.innerHTML = '';
  container.appendChild(renderHtmlTable(sorted, columns));

  renderMvarProdIdVarContribChart(rows);
  //renderMvarProdIdEsContribChart(rows);



}

function pickProductColumns(rows) {
  const sample = rows?.[0] || {};
  const keys = Object.keys(sample);

  // Diese Spalten sind typischerweise sinnvoll (falls vorhanden)
  const preferred = [
    'prod_id',  
    'product_id', 'instrument_id', 'isin', 'ric', 'ticker', 'name',
    'currency', 'ccy',
    'notional', 'qty', 'position',
    'pv', 'value', 'price',
    'var_contrib_total', 'var_contrib', 'VaR_Contrib', 'VaR', 'var',
    'es_contrib_total', 'es_contrib', 'ES_Contrib', 'ES', 'es'

  ].filter(k => keys.includes(k));

  // Wenn preferred leer ist: nimm einfach die ersten 10 Keys
  if (preferred.length < 4) {
  const base = keys.slice(0, 12);
  if (keys.includes('prod_id')) {
    return ['prod_id', ...base.filter(k => k !== 'prod_id')].slice(0, 12);
  }
  return base;
}



  // Stelle sicher: nicht zu viele Spalten (UI)
  return preferred.slice(0, 12);
}

function renderHtmlTable(rows, columns) {
  const table = document.createElement('table');
  table.className = 'risk-table';

  const thead = document.createElement('thead');
  const trh = document.createElement('tr');
  for (const c of columns) {
    const th = document.createElement('th');
    th.textContent = c;
    trh.appendChild(th);
  }
  thead.appendChild(trh);

  const tbody = document.createElement('tbody');
  for (const r of rows) {
    const tr = document.createElement('tr');
    for (const c of columns) {
      const td = document.createElement('td');
      td.textContent = formatCell(r?.[c]);
      tr.appendChild(td);
    }
    tbody.appendChild(tr);
  }

  table.appendChild(thead);
  table.appendChild(tbody);
  return table;
}

function formatCell(v) {
  if (v == null) return '';
  if (typeof v === 'number') {
    // klein & robust: max 6 decimals, keine scientific notation
    return Number.isFinite(v) ? v.toLocaleString(undefined, { maximumFractionDigits: 6 }) : '';
  }
  return String(v);
}

function buildProdIdVarContribSeries(rows, {
  valueKey = 'var_contrib_total',
  idKey = 'prod_id',
  topN = 20,
  sortByAbs = true,
} = {}) {
  const arr = Array.isArray(rows) ? rows : [];

  const series = arr
    .map(r => {
      const id = String(r?.[idKey] ?? '').trim();
      const v = Number(r?.[valueKey]);
      const value = Number.isFinite(v) ? v : null;
      return { id, value };
    })
    .filter(x => x.id && x.value != null);

  series.sort((a, b) => {
    const av = sortByAbs ? Math.abs(a.value) : a.value;
    const bv = sortByAbs ? Math.abs(b.value) : b.value;
    return bv - av;
  });

  return series.slice(0, topN);
}

let __mvarProdIdChart = null;

export function renderMvarProdIdVarContribChart(rows) {
  const canvas = document.getElementById('mvarProdIdVarContribChart');
  if (!canvas) {
    console.warn('[MVAR-PROD-CHART] canvas #mvarProdIdVarContribChart not found');
    return;
  }



  // nur var_contrib_total verwenden (wie gewünscht)
  const series = buildProdIdVarContribSeries(rows, {
    valueKey: 'var_contrib_total',
    idKey: 'prod_id',
    topN: 20,
    sortByAbs: true,
  });

    // ... series ist schon sortiert (Top-N)
  renderProdContribMiniTable(series, {
    containerId: 'mvarProdIdVarContribTable',
    valueLabel: 'var_contrib_total',
  });

  bindProdIdClicksForDetailsTable();


  const labels = series.map(x => x.id);
  const values = series.map(x => x.value);

  // optional: Farben nach Vorzeichen
  const bg = values.map(v => v >= 0 ? 'rgba(34,197,94,0.75)' : 'rgba(239,68,68,0.75)');
  const br = values.map(v => v >= 0 ? 'rgba(34,197,94,1)' : 'rgba(239,68,68,1)');

  if (__mvarProdIdChart) { __mvarProdIdChart.destroy(); __mvarProdIdChart = null; }

  __mvarProdIdChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Top Product VaR Contribution (var_contrib_total)',
        data: values,
        backgroundColor: bg,
        borderColor: br,
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) => ` ${Number(ctx.raw).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
          }
        }
      }
    }
  });
}

function buildProdIdEsContribSeries(rows, {
  valueKey = 'es_contrib_total',
  idKey = 'prod_id',
  topN = 20,
  sortByAbs = true,
} = {}) {
  const arr = Array.isArray(rows) ? rows : [];

  const series = arr
    .map(r => {
      const id = String(r?.[idKey] ?? '').trim();
      const v = Number(r?.[valueKey]);
      const value = Number.isFinite(v) ? v : null;
      return { id, value };
    })
    .filter(x => x.id && x.value != null);

  series.sort((a, b) => {
    const av = sortByAbs ? Math.abs(a.value) : a.value;
    const bv = sortByAbs ? Math.abs(b.value) : b.value;
    return bv - av;
  });

  return series.slice(0, topN);
}

let __mvarProdIdESChart = null;

export function renderMvarProdIdEsContribChart(rows) {
  const canvas = document.getElementById('mvarProdIdEsContribChart');
  if (!canvas) {
    console.warn('[MVAR-PROD-ES-CHART] canvas #mvarProdIdEsContribChart not found');
    return;
  }



  const series = buildProdIdEsContribSeries(rows, {
    valueKey: 'es_contrib_total',
    idKey: 'prod_id',
    topN: 20,
    sortByAbs: true,
  });

  const labels = series.map(x => x.id);
  const values = series.map(x => x.value);

  const bg = values.map(v => v >= 0 ? 'rgba(59,130,246,0.75)' : 'rgba(239,68,68,0.75)');
  const br = values.map(v => v >= 0 ? 'rgba(59,130,246,1)' : 'rgba(239,68,68,1)');

  if (__mvarProdIdESChart) { __mvarProdIdESChart.destroy(); __mvarProdIdESChart = null; }

  __mvarProdIdESChart = new Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        label: 'Top Product ES Contribution (es_contrib_total)',
        data: values,
        backgroundColor: bg,
        borderColor: br,
        borderWidth: 1,
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
      plugins: {
        legend: { display: true },
        tooltip: {
          callbacks: {
            label: (ctx) =>
              ` ${Number(ctx.raw).toLocaleString(undefined, { maximumFractionDigits: 2 })}`
          }
        }
      },
      scales: {
        x: {
          ticks: {
            callback: (v) =>
              Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 })
          }
        }
      }
    }
  });
}




function renderProdContribMiniTable(series, {
  containerId,
  valueLabel = 'var_contrib_total',
} = {}) {
  const el = document.getElementById(containerId);
  if (!el) {
    console.warn('[MVAR-MINI-TABLE] container not found:', containerId);
    return;
  }

  if (!Array.isArray(series) || series.length === 0) {
    el.innerHTML = `<div class="muted">No data.</div>`;
    return;
  }

  const fmt = (v) => Number(v).toLocaleString(undefined, { maximumFractionDigits: 2 });

  el.innerHTML = `
    <table class="mvar-mini-table">
      <thead>
        <tr>
          <th>#</th>
          <th>prod_id</th>
          <th>${valueLabel}</th>
        </tr>
      </thead>
      <tbody>
        ${series.map((x, i) => `
          <tr>
            <td>${i + 1}</td>
            <td><span class="clickable" data-prod-id="${x.id}">${x.id}</span></td>
            <td>${fmt(x.value)}</td>
          </tr>
        `).join('')}
      </tbody>
    </table>
  `;
}


export function showProdDetailsSidepanel(prod_id) {
  const meta = document.getElementById('prodDetailsMeta');
  const container = document.getElementById('prodDetailsContainer');

  if (!meta || !container) {
    console.warn('[PROD-DETAILS] panel containers missing');
    return;
  }

  const id = String(prod_id ?? '').trim();
  meta.innerHTML = `PROD_ID: <b>${id}</b>`;

  const row = appState.getProdById?.(id);

  if (!row) {
    container.innerHTML = `<div class="muted">No details found in ProdAll for PROD_ID: ${id}</div>`;
  } else {
    const entries = Object.entries(row);
    container.innerHTML = `
      <table class="risk-table">
        <tbody>
          ${entries.map(([k, v]) => `
            <tr>
              <td style="opacity:.7; padding-right:12px; white-space:nowrap;">${k}</td>
              <td>${v == null ? '' : String(v)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

const panel = document.getElementById('panel-prod-details');
if (!panel) {
  console.warn('[PROD-DETAILS] panel #panel-prod-details not found');
  return;
}
panel.hidden = false;

}

let __prodDetailsClickBound = false;

export function bindProdIdClicksForDetailsTable() {
  if (__prodDetailsClickBound) return;

  const root = document.getElementById('mvarProdIdVarContribTable');
  if (!root) return;

  root.addEventListener('click', (e) => {
    const prodId = e?.target?.dataset?.prodId;
    if (!prodId) return;
    showProdDetailsSidepanel(prodId);
  });

  __prodDetailsClickBound = true;
}


















