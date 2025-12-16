import { getColorFromPalette } from '../../../utils/colors.js';
import { appState } from '../../renderer.js';


export function handleSummaryMarketRiskData(port_name) {
  console.log('port_name:',port_name)

  const elementId = `portDataContainer${0}`;

  //get Portfolio aggregate Data
  const portfolioData = appState.getPortAggData(elementId) || {};
  console.log('portfolioData:',portfolioData)

  let portValueRel = 1;
  let portfolioEndValue = 100;

  const num = (x) => Number(String(x ?? '').replace(/[^\d.-]/g, '').replace(',', ''));

  const portValue   = num(portfolioData.formPortValue);
  const portNotional= num(portfolioData.formPortNotional);
  const portPV01    = num(portfolioData.formPortPV01);

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

function drawMvarHistogram(plValues, portValueRel, varTRel) {
  const histogram = createHistogramDataAdjusted(plValues, portValueRel);

  // Wenn portValueRel / varTRel schon in % sind (z.B. -4.23), ändere hier auf: v => v;
  const toPercent = v => v * 100;

  const portPercent = toPercent(portValueRel);
  // deine Variante: varPercent = varTRel selbst (so wie du es gerade hast)
  const varPercent = toPercent(varTRel) / 100;

  // Dein Wunsch: Bin für "Portfolio-Wert minus VaR"
  const thresholdPercent = portPercent + varPercent;

  console.log('portPercent:', portPercent);
  console.log('varPercent:', varPercent);
  console.log('thresholdPercent:', thresholdPercent);

  // Hilfsfunktion: findet den Index des Bins, in dem ein Wert liegt
  const findBinIndexForValue = (value, labels) =>
    labels.findIndex(label => {
      // Erwartetes Format: "-5.00 – -4.00%"
      const cleaned = label.replace('%', '');
      const [startStr, endStr] = cleaned
        .split('–')
        .map(s => parseFloat(s.trim()));

      return value >= startStr && value <= endStr;
    });

  const portBinIndex = findBinIndexForValue(portPercent, histogram.labels);
  const thresholdBinIndex = findBinIndexForValue(thresholdPercent, histogram.labels);

  const backgroundColor = histogram.bins.map((_, i) => {
    if (thresholdBinIndex !== -1 && i === thresholdBinIndex) {
      // Threshold-Bin (Portfoliowert - VaR) → jetzt KNALLROT, ohne Transparenz
      return 'rgba(247, 18, 68, 1)';
    }
    if (portBinIndex !== -1 && i === portBinIndex) {
      // Bin des Portfoliowerts → bleibt wie davor
      return 'rgba(255, 99, 132, 1)';
    }
    return 'rgba(54, 162, 235, 0.5)'; // Standard
  });

  const borderColor = histogram.bins.map((_, i) => {
    if (thresholdBinIndex !== -1 && i === thresholdBinIndex) {
      return 'rgba(247, 18, 68, 1)';
    }
    if (portBinIndex !== -1 && i === portBinIndex) {
      return 'rgba(75, 192, 192, 1)'; // Portfolio-Bin-Rand bleibt wie er war
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

function drawSyntheticPortfolioChart(targetEndValue = 100, portPV01 = 1, testTtM = 5)  {
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

  const rawSynthetic = createAllProductData(tsFiltered, testTtM, testPV01);
  const rawPortfolio = createAllProductData(tsFiltered, testTtM, portfolioPV01);

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
  borderColor: 'rgba(45, 212, 191, 0.9)',       // neues Türkis-Grün
  backgroundColor: 'rgba(45, 212, 191, 0.4)',   // etwas transparenter für die Fläche
  tension: 0.1,
  pointRadius: 0
};


  const portfolioValueDataset = {
    label: `Synthetic Portfolio`,
    data: portfolioData,
    borderColor: ' rgba(255, 99, 132, 1)',
    backgroundColor: ' rgba(255, 99, 132, 1)',
    tension: 0.1,
    pointRadius: 0
  };

  const lastPoint = syntheticData[syntheticData.length - 1];

  const endMarker = {
    label: `Current Portfolio Value (${targetEndValue.toFixed(2)}%)`,
    data: [{ x: lastPoint.x, y: targetEndValue }],
    pointRadius: 5,
    pointStyle: 'circle',
    pointBackgroundColor: ' rgba(255, 99, 132, 1)',
    pointBorderColor: ' rgba(255, 99, 132, 1)',
    showLine: false,
    borderColor: ' rgba(255, 99, 132, 1)',
    backgroundColor: ' rgba(255, 99, 132, 1)',
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




