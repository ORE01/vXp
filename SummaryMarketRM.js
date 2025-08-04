import { getColorFromPalette } from './utils/colors.js';

// 📊 Main function
export function handleSummaryRMData(filteredData, index, port_name) {
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

  const histogram = createHistogramData(plValues);
  
  // Chart container setup
  let chartContainer = document.getElementById('riskDistChartSection');
  if (!chartContainer) {
    const summaryModal = document.getElementById('SUMMARY_Modal') || document.body;
    chartContainer = document.createElement('div');
    chartContainer.id = 'riskDistChartSection';
    chartContainer.className = 'chart-section';

    const heading = document.createElement('h3');
    heading.className = 'section-header';
    heading.textContent = 'Market P/L Distribution';

    const buttonWrapper = document.createElement('div');
    buttonWrapper.className = 'button-wrapper';

    const button = document.createElement('button');
    button.id = 'mvaRDistButton';
    button.className = 'edit-button';
    button.textContent = 'Update MVaR';
    button.addEventListener('click', () => handleSummaryRMData(filteredData, index, port_name));

    const canvas = document.createElement('canvas');
    canvas.id = 'plMvarDistChart';
    canvas.width = 900;
    canvas.height = 500;

    buttonWrapper.appendChild(button);
    chartContainer.appendChild(heading);
    chartContainer.appendChild(buttonWrapper);
    chartContainer.appendChild(canvas);
    summaryModal.appendChild(chartContainer);
  }

  // Chart render
  const ctx = document.getElementById('plMvarDistChart').getContext('2d');
  if (window.plMvarDistChartInstance) window.plMvarDistChartInstance.destroy();

  window.plMvarDistChartInstance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: histogram.labels,
      datasets: [{
        label: 'Frequency',
        data: histogram.bins,
        backgroundColor: 'rgba(54, 162, 235, 0.5)',
        borderColor: 'rgba(54, 162, 235, 1)',
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
            label: context => `Count: ${context.parsed.x}`
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
  });


  drawCMBChart();
}

// 🔧 Utility: Create histogram from P/L values
export function createHistogramData(values, numBins = 50) {
  const min = Math.min(...values);
  const max = Math.max(...values);
  const binWidth = (max - min) / numBins;
  const bins = Array(numBins).fill(0);

  values.forEach(v => {
    const binIndex = Math.min(Math.floor((v - min) / binWidth), numBins - 1);
    bins[binIndex]++;
  });

  const labels = bins.map((_, i) => {
    const start = (min + i * binWidth).toFixed(2) + '%';
    const end = (min + (i + 1) * binWidth).toFixed(2) + '%';
    return `${start} - ${end}`;
  });

  return { labels, bins };
}


export function createSimpleLineChart(datasets, chartName, chartTitle = 'Line Chart', pointRadius = 0) {
  const canvasElement = document.getElementById(chartName);

  if (!canvasElement) {
    console.error(`Canvas element with ID "${chartName}" not found.`);
    return null;
  }

  const ctx = canvasElement.getContext("2d");
  if (!ctx) {
    console.error(`Failed to get 2D context for canvas with ID "${chartName}".`);
    return null;
  }

  const allDatasets = datasets.map((dataset, index) => ({
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
    yAxisID: dataset.yAxisID || 'y' // ➕ Support für sekundäre Achse
  }));

  return new Chart(ctx, {
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
          time: {
            unit: 'month'
          }
        },
        y: {
          title: { display: true, text: "Swap Rate (%)" },
          ticks: {
            callback: val => `${val.toFixed(2)}%`
          }
        },
        yBond: {
          position: 'right',
          title: { display: true, text: "CMB Value (€)" },
          grid: { drawOnChartArea: false },
          ticks: {
            callback: val => `€${val.toFixed(2)}`
          }
        }
      },
      plugins: {
        tooltip: {
          callbacks: {
            label: context => {
              const val = context.raw?.originalY;
              return `${context.dataset.label}: ${typeof val === 'number' ? val.toFixed(2) : 'N/A'}`;
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
    currentValue -= impact; // negative impact = loss → ↓ value

    result.push({
      x: curr.DATE || curr.date,
      y: currentValue,
      originalY: currentValue
    });
  }

  return result;
}

// 📉 Main chart function for synthetic bond value
export function drawCMBChart() {
  if (window.tsEU1YChartInstance instanceof Chart) {
    window.tsEU1YChartInstance.destroy();
  }

  const tsData = appState.getTblTSData();
  const testTtM = 5;
  const testPV01 = 4.7;
  const portfolioPV01 = 5.2;

  const threeYearsAgo = new Date();
  threeYearsAgo.setFullYear(threeYearsAgo.getFullYear() - 3);

  const cmbValueDataset = {
    label: `Synthetic CMB (${testTtM}Y)`,
    data: computeCMBValueCurve(tsData, testTtM, testPV01)
      .filter(d => new Date(d.x) >= threeYearsAgo),
    borderColor: 'purple',
    backgroundColor: 'rgba(128, 0, 128, 0.2)',
    tension: 0.1,
    pointRadius: 0
  };

  const portfolioValueDataset = {
    label: `Portfolio (CMB ${testTtM}Y)`,
    data: computeCMBValueCurve(tsData, testTtM, portfolioPV01)
      .filter(d => new Date(d.x) >= threeYearsAgo),
    borderColor: 'teal',
    backgroundColor: 'rgba(0, 128, 128, 0.2)',
    tension: 0.1,
    pointRadius: 0
  };

  window.tsEU1YChartInstance = createSimpleLineChart(
    [cmbValueDataset, portfolioValueDataset],
    'tsEU1YChart',
    'Synthetic Bond vs. Portfolio',
    0
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




