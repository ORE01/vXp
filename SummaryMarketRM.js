import { getColorFromPalette } from './utils/colors.js';

export function handleSummaryRMData(filteredData, index, port_name) {
  const elementId = `portDataContainer${0}`;
  const portfolioData = appState.getPortAggData(elementId) || {};

  let portValueRel = 1;
  let portfolioEndValue = 100;

  const portValue = parseFloat(portfolioData.formPortValue.replace(/[^\d.-]/g, '').replace(',', ''));
  const portNotional = parseFloat(portfolioData.formPortNotional.replace(/[^\d.-]/g, '').replace(',', ''));
  const portPV01 = parseFloat(portfolioData.formPortPV01.replace(/[^\d.-]/g, '').replace(',', ''));
  //console.log(`📊 portPV01 = ${portPV01}`);

  if (!isNaN(portValue) && !isNaN(portNotional) && portNotional !== 0) {
    portValueRel = portValue / portNotional;
    portfolioEndValue = portValueRel * 100;
    //console.log(`📊 portValueRel = ${portValueRel.toFixed(4)} (${portfolioEndValue.toFixed(2)}%)`);
  } else {
    console.warn("Missing or invalid data for portValueRel calculation");
  }

  const mvarAggData = appState.getAllMvarData();
  const matchingEntry = mvarAggData.find(item => item.port_name === port_name);
  if (!matchingEntry || typeof matchingEntry.VaR_T_rel !== 'number') {
    console.warn(`No valid VaR data for portfolio: ${port_name}`);
    return;
  }
  const varTRel = matchingEntry.VaR_T_rel;

  const mvarDistData = appState.getMvarDistData();
  const OriPortData = appState.getAllPortfolioData();
  const portNav = OriPortData.filter(item => item.port_name === port_name)
    .reduce((sum, item) => sum + parseFloat(item.NAV?.toString().replace(/[^\d.-]/g, '') || 0), 0);

  const plValues = mvarDistData.map(row => row["P/L"] / portNav * 100);
  if (plValues.length === 0) return console.warn("No P/L data");

  // 🧱 DOM sicherstellen
  ensureChartContainerExists(
    'riskDistChartSection',
    'plMvarDistChart',
    'Market P/L Distribution',
    'mvaRDistButton',
    'Update MVaR',
    () => handleSummaryRMData(filteredData, index, port_name)
  );

  // 📊 HISTOGRAM:
  const { data, options } = createMvarHistogramConfig(plValues, portValueRel, varTRel);
  const ctx = document.getElementById('plMvarDistChart').getContext('2d');
  if (window.plMvarDistChartInstance) window.plMvarDistChartInstance.destroy();

  window.plMvarDistChartInstance = new Chart(ctx, {
    type: 'bar',
    data,
    options
  });

  // 📈 CMBChart:
  drawCMBChart(portfolioEndValue, portPV01, 5);
}

export function ensureChartContainerExists(containerId, canvasId, title, buttonId, buttonText, onClick) {
  let chartContainer = document.getElementById(containerId);
  if (!chartContainer) {
    const parent = document.getElementById('SUMMARY_Modal') || document.body;

    chartContainer = document.createElement('div');
    chartContainer.id = containerId;
    chartContainer.className = 'chart-section';

    const heading = document.createElement('h3');
    heading.className = 'section-header';
    heading.textContent = title;

    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'button-wrapper';

    const button = document.createElement('button');
    button.id = buttonId;
    button.className = 'edit-button';
    button.textContent = buttonText;
    button.addEventListener('click', onClick);

    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.width = 900;
    canvas.height = 500;

    buttonWrapper.appendChild(button);
    chartContainer.appendChild(heading);
    chartContainer.appendChild(buttonWrapper);
    chartContainer.appendChild(canvas);
    parent.appendChild(chartContainer);
  }
}


export function createMvarHistogramConfig(plValues, portValueRel, varTRel) {
  const histogram = createHistogramDataAdjusted(plValues, portValueRel);
  const targetValue = portValueRel * 100;

  const highlightedBinIndex = histogram.labels.findIndex(label => {
    const [startStr, endStr] = label.replace('%', '').split('–').map(s => parseFloat(s.trim()));
    return targetValue >= startStr && targetValue <= endStr;
  });

  const backgroundColor = histogram.bins.map((_, i) =>
    i === highlightedBinIndex ? 'rgba(255, 99, 132, 0.8)' : 'rgba(54, 162, 235, 0.5)'
  );
  const borderColor = histogram.bins.map((_, i) =>
    i === highlightedBinIndex ? 'rgba(255, 99, 132, 1)' : 'rgba(54, 162, 235, 1)'
  );

  return {
    data: {
      labels: histogram.labels,
      datasets: [{
        label: 'Frequency',
        data: histogram.bins,
        backgroundColor,
        borderColor,
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      indexAxis: 'y',
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
              const val = context.raw?.y;
              return `${context.dataset.label}: ${val?.toFixed(2)}%`;
            }
          }
        },
        annotation: {
          annotations: {
            varLine: {
              type: 'line',
              yMin: varTRel,
              yMax: varTRel,
              borderColor: 'red',
              borderWidth: 2,
              label: {
                display: true,
                content: `VaR (${varTRel.toFixed(2)}%)`,
                color: 'red',
                position: 'start',
                font: { weight: 'bold' }
              }
            }
          }
        }
      }
    }
  };
}

export function createHistogramDataAdjusted(values, portValueRel = 1, numBins = 50) {
  // 1. In absolute Performance umrechnen
  const adjusted = values.map(v => portValueRel * (1 + v / 100)); // z. B. -2% → 0.97

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



export function createSimpleLineChart(datasets, chartName, chartTitle = 'Line Chart', pointRadius = 0) {
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
        x: dataPoint.x,
        y: dataPoint.y,
        originalY: dataPoint.originalY
      })),
      fill: false,
      borderColor: dataset.borderColor || getColorFromPalette(index),
      backgroundColor: dataset.backgroundColor || 'transparent',
      tension: dataset.tension ?? 0.1,
      pointRadius: dataset.pointRadius ?? pointRadius,
      borderWidth: 1,
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

  // 🧠 Zielwert aus Marker-Dataset holen (z. B. 100)
  const targetMarker = markerDatasets.find(m => m.data?.[0]?.y != null);
  const targetY = targetMarker?.data?.[0]?.y ?? 100;

  // 📊 Alle Y-Werte extrahieren (ohne Marker)
  const allYValues = regularDatasets.flatMap(ds => ds.data.map(p => p.y));
  const minY = Math.min(...allYValues);
  const maxY = Math.max(...allYValues);
  const spread = Math.max(Math.abs(targetY - minY), Math.abs(targetY - maxY));
  const padding = spread * 0.15;

  const yMin = targetY - spread - padding;
  const yMax = targetY + spread + padding;

  // ✅ Neuen Chart erstellen
  const newChart = new Chart(ctx, {
    type: "line",
    data: {
      labels: datasets[0].data.map(d => d.x),
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
          title: {
            display: true,
            text: "Date"
          },
          type: 'category',
        },
        y: {
          title: {
            display: true,
            text: "Value Development (%)"
          },
          ticks: {
            callback: val => `${val.toFixed(2)}%`
          },
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



export function computeCMBValueCurve(tsData, testTtM, pv01, startValue = 100) {
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



// 📉 Main chart function for synthetic bond value
export function drawCMBChart(targetEndValue = 100, portPV01 = 1, testTtM = 5)  {
  const tsData = appState.getTblTSData();
  // console.log('tsData:', tsData)
  // const testTtM = 5;

    
    const testCurr = tsData[tsData.length - 1];
    const testCurrRate = interpolateSwapRateDynamic(testCurr, testTtM)/100;
    //console.log('testCurrRate:', testCurrRate)
  
  const testPV01 = -testTtM/(1 + testCurrRate);
  const portfolioPV01 = portPV01;

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);
  const tsFiltered = tsData.filter(d => new Date(d.DATE || d.date) >= threeYearsAgo);

  const rawSynthetic = computeCMBValueCurve(tsFiltered, testTtM, testPV01);
  const rawPortfolio = computeCMBValueCurve(tsFiltered, testTtM, portfolioPV01);

  const syntheticData = normalizeCurveToEndValue(rawSynthetic, targetEndValue);
  const portfolioData = normalizeCurveToEndValue(rawPortfolio, targetEndValue);

  const allYValues = [...syntheticData, ...portfolioData].map(p => p.y);
  const ySpread = Math.max(...allYValues) - Math.min(...allYValues);
  const yPadding = ySpread * 0.1; // etwas Luft
  const yMax = targetEndValue + ySpread / 2 + yPadding;
  const yMin = targetEndValue - ySpread / 2 - yPadding;

  const cmbValueDataset = {
    label: `Synthetic CMB (${testTtM}Y)`,
    data: syntheticData,
    borderColor: 'purple',
    backgroundColor: 'rgba(128, 0, 128, 0.2)',
    tension: 0.1,
    pointRadius: 0
  };

  const portfolioValueDataset = {
    label: `Portfolio (CMB ${testTtM}Y)`,
    data: portfolioData,
    borderColor: 'teal',
    backgroundColor: 'rgba(0, 128, 128, 0.2)',
    tension: 0.1,
    pointRadius: 0
  };

  const lastPoint = syntheticData[syntheticData.length - 1];

  const endMarker = {
    label: `Current Portfolio Value (${targetEndValue.toFixed(2)}%)`,
    data: [{ x: lastPoint.x, y: targetEndValue }],
    pointRadius: 5,
    pointStyle: 'circle',
    pointBackgroundColor: 'red',
    pointBorderColor: 'red',
    showLine: false,
    borderColor: 'red',
    backgroundColor: 'red',
  };

  // 🔄 Chart generieren
  window.tsEU1YChartInstance = createSimpleLineChart(
    [cmbValueDataset, portfolioValueDataset, endMarker],
    'tsEU1YChart',
    'Synthetic Bond vs. Portfolio',
    0,
    { // 👉 Neuer Parameter: optionsOverride
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






// 🔍 Dynamic linear interpolation for swap rate at any maturity
export function interpolateSwapRateDynamic(row, targetYear) {
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






