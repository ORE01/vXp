import { getColorFromPalette, getPortfolioColor } from '../../utils/colors.js';
import { appState } from '../renderer.js';

export function handleSummaryMarketRiskData(port_name) {
  console.log('port_name:', port_name);

  const elementId = `portDataContainer${0}`;

  // get Portfolio aggregate Data
  const portfolioData = appState.getPortAggData(elementId) || {};
  console.log('portfolioData:', portfolioData);

  let portValueRel = 1;
  let portfolioEndValue = 100;

  const num = (x) => Number(String(x ?? '').replace(/[^\d.-]/g, '').replace(',', ''));

  const portValue    = num(portfolioData.formPortValue);
  const portNotional = num(portfolioData.formPortNotional);
  const portPV01     = num(portfolioData.formPortPV01);

  if (Number.isFinite(portValue) && Number.isFinite(portNotional) && portNotional !== 0) {
    portValueRel = portValue / portNotional;
    portfolioEndValue = portValueRel * 100;
  } else {
    console.warn("Missing or invalid data for portValueRel calculation", { portValue, portNotional });
  }

  // --- VaR source may not be ready yet ---
  const mvarAggData = appState.getAllMvarData() || [];
  const matchingEntry = mvarAggData.find(item => item && item.port_name === port_name);
  const varTRel = Number(matchingEntry?.VaR_T_rel) || 0; // default to 0 if missing
  if (!matchingEntry) {
    console.warn(`No matching MVaR aggregate for port_name=${port_name}; using VaR_T_rel=0`);
  }

  // --- Distribution data + NAV guard ---
  const mvarDistData = appState.getMvarDistData() || [];
  if (!Array.isArray(mvarDistData) || mvarDistData.length === 0) {
    console.warn("No MVaR distribution data available yet");
    return;
  }

  // für NAV
  const OriPortData = appState.getAllPortfolioData() || [];
  const portNav = OriPortData
    .filter(item => item && item.port_name === port_name)
    .reduce((sum, item) => sum + num(item.NAV), 0);

  if (!Number.isFinite(portNav) || portNav === 0) {
    console.warn(`Invalid or zero NAV for port_name=${port_name}; cannot compute P/L%`, { portNav });
    return;
  }

  const plValues = mvarDistData
    .map(row => Number(row?.["P/L"]))
    .filter(v => Number.isFinite(v))
    .map(v => (v / portNav) * 100);

  if (plValues.length === 0) {
    console.warn("No numeric P/L values in distribution data");
    return;
  }

  // --- Ensure canvas exists before drawing ---
  const canvas = document.getElementById('plMvarDistChart');
  if (!canvas) {
    console.warn("Canvas #plMvarDistChart not found in DOM");
    return;
  }
  const ctx = canvas.getContext('2d');
  if (window.plMvarDistChartInstance) window.plMvarDistChartInstance.destroy();

  const { data, options } = drawMvarHistogram(plValues, portValueRel, varTRel);
  window.plMvarDistChartInstance = new Chart(ctx, { type: 'bar', data, options });

  // CMB chart (guard PV01)
  if (Number.isFinite(portPV01)) {
    drawSyntheticPortfolioChart(portfolioEndValue, portPV01, 5);
  } else {
    console.warn("portPV01 not available; skipping CMB chart");
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






