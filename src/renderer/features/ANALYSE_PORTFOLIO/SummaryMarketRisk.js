import { getColorFromPalette, getPortfolioColor } from '../../utils/colors.js';
import { appState } from '../../renderer.js';
import { renderMvarProductPLPanel } from './marketRisk/mvar/mvarProductPLPanel.js';




export function handleSummaryMarketRiskData(port_name, scenario_name, asof_date = null) {
  //console.log('port_name:', port_name, 'scenario_name:', scenario_name, 'asof_date:', asof_date);

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

  // --- Synthetic Bond vs. Portfolio line chart (tsEU1YChart) ---
  // Drawn HERE, independently of the distribution-data early-returns below: this chart
  // only needs the time series (tblTS) + portfolio PV01, NOT the MVaR distribution.
  // Previously it sat after the '[DIST] No distribution' return, so it stayed blank on
  // initial open (no dist rows yet) and only appeared after a recalc.
  console.log('[TS EU1Y CHART] reached synthetic-chart gate (early)', {
    portPV01,
    portPV01IsFinite: Number.isFinite(portPV01),
  });

  if (Number.isFinite(portPV01)) {
    drawSyntheticPortfolioChart(portfolioEndValue, portPV01, 5);
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
  const esTRel = Number(chosenAgg?.ES_T_rel ?? chosenAgg?.ES_rel ?? chosenAgg?.es_t_rel) || 0;

  // --- Distribution data: try exact (port, scenario, asof) first ---
let mvarDistData = appState.getMvarDistData({
  port_name,
  scenario_name,
  asof_date: chosenAsof,
}) || [];

// Fallback: if the EXACT aggregate asof has no distribution rows (common at initial
// open / test mode, where the aggregate asof and the stored distribution asof differ),
// fall back to the LATEST available distribution for this port+scenario instead of
// rendering nothing. The histogram only needs SOME distribution for the selection;
// the store getter returns the latest asof when asof_date is omitted.
if (!Array.isArray(mvarDistData) || mvarDistData.length === 0) {
  const anyAsofDist = appState.getMvarDistData({ port_name, scenario_name }) || [];

  console.warn('[DIST] no dist for exact asof; falling back to latest available', {
    port_name,
    scenario_name,
    chosenAsof,
    exactCount: 0,
    fallbackCount: anyAsofDist.length,
  });

  mvarDistData = anyAsofDist;
}

if (!Array.isArray(mvarDistData) || mvarDistData.length === 0) {
  console.warn(
    '[DIST] No distribution for selection (any asof) - nothing rendered',
    { port_name, scenario_name }
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

  const { data, options, veLines } = drawMvarHistogram(plValues, portValueRel, varTRel, esTRel);
  const chart = new Chart(ctx, { type: 'bar', data, options, plugins: [_mvarVELinePlugin] });
  chart.$veLines = veLines;
  try { chart.update(); } catch {}
  window.plMvarDistChartInstance = chart;

  // NOTE: the synthetic line chart (tsEU1YChart) is now drawn earlier in this function
  // (before the distribution-data early-returns), so it is not redrawn here.
}

// HISTOGRAMM:

// Vertikale VaR/ES-Linien am jeweiligen P/L-Bin (chart.$veLines = [{at,label,color,dash}]).
const _mvarVELinePlugin = {
  id: 'mvarVELines',
  afterDatasetsDraw(chart) {
    const lines = chart.$veLines;
    if (!Array.isArray(lines) || !chart.chartArea || !chart.scales?.x) return;
    const { ctx, chartArea } = chart;
    lines.forEach((ln) => {
      if (!Number.isFinite(ln.at)) return;
      const x = chart.scales.x.getPixelForValue(ln.at);
      if (!Number.isFinite(x)) return;
      ctx.save();
      ctx.beginPath();
      ctx.setLineDash(ln.dash || []);
      ctx.lineWidth = 2;
      ctx.strokeStyle = ln.color || 'rgba(255,0,0,0.95)';
      ctx.moveTo(x, chartArea.top);
      ctx.lineTo(x, chartArea.bottom);
      ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = ln.color || 'rgba(255,0,0,0.95)';
      ctx.font = 'bold 11px sans-serif';
      ctx.fillText(ln.label || '', x + 3, chartArea.top + 11);
      ctx.restore();
    });
  },
};

function createHistogramDataAdjusted(values, portValueRel = 1, numBins = 50) {
  // 1. In absolute Performance umrechnen
  const adjusted = values;   // P/L% direkt (KEIN Bond-Preis) -> P&L-konforme x-Achse // z. B. -2% â†’ 0.97

  // 2. Basiswerte
  const avg = adjusted.reduce((sum, v) => sum + v, 0) / adjusted.length;
  const spread = Math.max(...adjusted) - Math.min(...adjusted);
  const padding = spread * 0.2; // â¬…ï¸ Optional: Padding fÃ¼r Symmetrie

  // 3. Symmetrischer Bereich um avg
  const min = avg - spread / 2 - padding;
  const max = avg + spread / 2 + padding;
  const binWidth = (max - min) / numBins;

  const bins = Array(numBins).fill(0);

  // 4. ZÃ¤hlen
  adjusted.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[binIndex]++;
  });

  // 5. Labels generieren als Prozent (% vom NAV)
  const labels = bins.map((_, i) => {
    const start = (min + i * binWidth).toFixed(2);
    const end = (min + (i + 1) * binWidth).toFixed(2);
    return `${start}% - ${end}%`;
  });

  // 6. Normalverteilungs-Parameter (in adjusted-Einheiten) + Bin-Zentren fuer die Kurve.
  const mu = avg;
  const variance = adjusted.reduce((s, v) => s + (v - avg) * (v - avg), 0) / Math.max(1, adjusted.length);
  const sigma = Math.sqrt(variance);
  const centers = bins.map((_, i) => min + (i + 0.5) * binWidth);

  return { labels, bins, min, binWidth, mu, sigma, centers, total: adjusted.length };
}

function drawMvarHistogram(plValues, portValueRel, varTRel, esTRel = 0) {
  const histogram = createHistogramDataAdjusted(plValues, portValueRel);

  // VaR/ES sind bereits in % (P/L vom NAV), gleiche Einheit wie die Balken -> Bin-Index
  // direkt ueber die Bin-Kanten (robust auch bei negativen Werten).
  const binIndexOf = (value) => {
    if (!Number.isFinite(value) || !(histogram.binWidth > 0)) return -1;
    const idx = Math.floor((value - histogram.min) / histogram.binWidth);
    return (idx >= 0 && idx < histogram.bins.length) ? idx : -1;
  };

  // âœ… Robust: entfernt ALLE Prozentzeichen, normalisiert Dash-Varianten, parst sauber
  const findBinIndexForValue = (value, labels) =>
    labels.findIndex(label => {
      // Beispiel-Label: "95.12% - 96.34%"
      const cleaned = String(label)
        .replace(/%/g, '')          // <- ALLE % entfernen (dein Bug)
        .replace(/[-â€”]/g, '-')      // <- En-Dash/Em-Dash auf normales '-' normalisieren
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

      // Wichtig: include hi, weil dein Label "start - end" inkl. Endpunkt wirken soll
      return value >= lo && value <= hi;
    });

  const thresholdBinIndex = binIndexOf(varTRel);
  const esBinIndex = binIndexOf(esTRel);

  // Normalverteilung ueber das Histogramm (gleiche Frequenz-Skala): total * binWidth * pdf.
  const { mu, sigma, binWidth, centers, total } = histogram;
  const normal = (sigma > 0)
    ? centers.map(c => total * binWidth * (1 / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((c - mu) ** 2) / (2 * sigma * sigma)))
    : centers.map(() => 0);

  // VaR/ES-Linien (vertikal am jeweiligen P/L-Bin).
  const veLines = [];
  if (thresholdBinIndex !== -1 && Number.isFinite(varTRel) && varTRel !== 0) veLines.push({ at: thresholdBinIndex, label: 'VaR', color: 'rgba(255,0,0,0.95)', dash: [] });
  if (esBinIndex !== -1 && Number.isFinite(esTRel) && esTRel !== 0) veLines.push({ at: esBinIndex, label: 'ES', color: 'rgba(255,150,0,0.98)', dash: [6, 4] });

  const pCol = getPortfolioColor(1); // Garmin-Pink fÃ¼r Portfolio-Bin

  // Tail rot: ALLE Bins ab dem VaR-Bin abwaerts (schlechteres P/L = kleinerer Index),
  // inklusive VaR-Bin. Rest blau (Portfolio-Bin bleibt pink). Nur bei echtem VaR-Wert.
  const varRedUpTo = (Number.isFinite(varTRel) && varTRel !== 0 && thresholdBinIndex !== -1) ? thresholdBinIndex : -1;

  // Kein Pink-/Portfolio-Bin mehr (das war der Durchschnitt). Tail ab VaR rot, Rest blau.
  const backgroundColor = histogram.bins.map((_, i) =>
    (varRedUpTo !== -1 && i <= varRedUpTo) ? 'rgba(255, 0, 0, 0.55)' : 'rgba(54, 162, 235, 0.5)'
  );

  const borderColor = histogram.bins.map((_, i) =>
    (varRedUpTo !== -1 && i <= varRedUpTo) ? 'rgba(255, 0, 0, 0.9)' : 'rgba(54, 162, 235, 1)'
  );

  return {
    data: {
      labels: histogram.labels,
      datasets: [
        {
          label: 'Frequency',
          data: histogram.bins,
          backgroundColor,
          borderColor,
          borderWidth: 1,
          order: 2,
        },
        {
          type: 'line',
          label: 'Normal',
          data: normal,
          borderColor: 'rgba(255,255,255,0.9)',
          borderWidth: 2,
          pointRadius: 0,
          fill: false,
          tension: 0.35,
          order: 1,
        },
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'x', // um 90 Grad gedreht -> vertikale Balken (P/L auf x, Frequency auf y)
      scales: {
        x: {
          title: { display: true, text: 'P/L as % of NAV' },
          ticks: { maxRotation: 90, minRotation: 90, autoSkip: true, maxTicksLimit: 16 }
        },
        y: {
          beginAtZero: true,
          title: { display: true, text: 'Frequency' }
        }
      },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: context => `${context.label}: ${context.raw}`
          }
        }
      }
    },
    veLines,
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

  console.log('[TS EU1Y CHART] drawSyntheticPortfolioChart called', {
    tsDataLen: Array.isArray(tsData) ? tsData.length : null,
    targetEndValue,
    portPV01,
    canvasExists: !!document.getElementById('tsEU1YChart'),
  });

  // Guard: without a usable time-series, tsData[last] is undefined and the
  // interpolation below would THROW (Object.entries(undefined)), which previously
  // also aborted the product render that runs after this in refreshMarketRiskUI.
  if (!Array.isArray(tsData) || tsData.length < 2) {
    console.warn('[TS EU1Y CHART] skipped: tblTS time-series empty/too short', {
      tsDataLen: Array.isArray(tsData) ? tsData.length : null,
    });
    return;
  }

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

  // âœ… Synthetic Portfolio = Garmin-Pink, gestrichelt
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

  // Current Portfolio Value Marker = Garmin-Pink
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

  // Chart generieren
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

// NOTE: createSimpleLineChart bleibt bei dir unverÃ¤ndert nutzbar,
// weil wir die Farben im Dataset selbst setzen (inkl. borderDash fÃ¼r Synthetic Portfolio).
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

  // 1) Strings: immer versuchen sauber auf YYYY-MM-DD zu kÃ¼rzen
  if (typeof val === 'string') {
    const s = val.trim();

    // Wenn es mit YYYY-MM-DD beginnt â†’ IMMER auf die ersten 10 Zeichen kÃ¼rzen
    // (deckt "YYYY-MM-DD", "YYYY-MM-DD 00:00:00", "YYYY-MM-DDTHH:MM:SS..." ab)
    if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);

    // Fallback: Date parse versuchen
    const d = new Date(s);
    if (!isNaN(d)) return d.toISOString().slice(0, 10);

    // Wenn gar nichts geht: original zurÃ¼ck
    return s;
  }

  // 2) Date/Number: normal parsen
  const d = new Date(val);
  if (!isNaN(d)) return d.toISOString().slice(0, 10);

  return String(val);
}

//MarketVaR_Product
// Delegiert an den kuratierten Product-VaR-Renderer, damit der INITIAL-Feed
// dieselbe Tabelle zeigt wie nach einer Berechnung (Product ID / Description /
// VaR / ES / Obs) — kein Roh-DB-Dump (id, asof_date, var_contrib_* …) mehr.
// Die Daten stehen bereits im Store (setMvarProductData lief davor).
export function handleMvarProductTable(/* port_name, scenario_name, asof_date */) {
  try {
    renderMvarProductPLPanel();
  } catch (e) {
    console.warn('[PRODUCT] renderMvarProductPLPanel delegation failed', e);
  }
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

// export function renderMvarProdIdVarContribChart(rows) {
//   console.warn('[SummaryMarketRisk] renderMvarProdIdVarContribChart is deprecated. Product VaR chart is owned by mvarProductPLPanel.js.');

//   const series = buildProdIdVarContribSeries(rows, {
//     valueKey: 'var_contrib_total',
//     idKey: 'prod_id',
//     topN: 20,
//     sortByAbs: true,
//   });

//   renderProdContribMiniTable(series, {
//     containerId: 'mvarProdIdVarContribTable',
//     valueLabel: 'var_contrib_total',
//   });

//   bindProdIdClicksForDetailsTable();
// }

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
    container.innerHTML = `<div class="muted">No product details found for PROD_ID: ${id}</div>`;
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





















