import { appState } from './renderer.js';

let euswapChart;

//import { setupHiDPICanvas, getMaxYieldFromChartData } from './chartUtils.js'; // falls ausgelagert


export function handleSummaryYieldData(filteredData, index, port_name) {
  console.log('summaryData:', filteredData);

  // You intentionally use hardcoded values here
  const elementId = `portDataContainer${0}`;
  
  //DATA:
  const portfolioData = appState.getPortAggData(elementId) || {};
  const EUSWData = appState.getEUSWData();
  const TSData = appState.getTblTSData();

  // lates Curve 
  const latestRow = TSData[TSData.length - 1];
  // past Curve
  const fiveYearsAgoRow = TSData[TSData.length - 1 - (252 * 5)];

  const yieldCurve = transformTSDataToEUSWFormat(latestRow);
  const pastYieldCurve = transformTSDataToEUSWFormat(fiveYearsAgoRow);

//   console.log('EUSWData:', EUSWData);
//   console.log('yieldCurve:', yieldCurve);
//   console.log('pastYieldCurve:', pastYieldCurve);
  
  
// CHART: line chart
    const portfolioYield = portfolioData.formPortYield; // e.g., "1.91%"
    const portTtM = -portfolioData.formPortPV01;
    if (portfolioYield && Array.isArray(EUSWData) && EUSWData.length > 0) {
    //   drawPortfolioVsYieldCurvesChart(portfolioYield, portTtM, yieldCurve, pastYieldCurve, EUSWData);
    //   drawProductYieldVsEUSWChart(filteredData, yieldCurve, pastYieldCurve) 

drawYieldVsEUSWChart({
  targetId: 'euswapPortfolioYieldChart',
  heading: 'Portfolio Yield vs Maturity',
  yieldCurve,
  pastYieldCurve,
  euswDataOriginal: EUSWData, // ✅ korrekter Parametername!
  points: [{ x: portTtM, y: parseFloat(portfolioYield.replace('%', '')) }]
});




drawYieldVsEUSWChart({
  targetId: 'euswapProductYieldChart',
  heading: 'Product Yields vs Maturity',
  yieldCurve,
  pastYieldCurve,
  euswDataOriginal: EUSWData,
  points: filteredData // mit .TtM, .ytm, .PROD_ID
});

const durationCurve = yieldCurve.map(swapPointToDurationAsYearRate).filter(Boolean);
const durationCurvePast = pastYieldCurve.map(swapPointToDurationAsYearRate).filter(Boolean);
const durationEUSWData = EUSWData.map(swapPointToDurationAsYearRate).filter(Boolean);


// 📦 Neuen Container unter den oberen beiden Charts erzeugen
let chartSection = document.getElementById('yieldChartSection');
let durationSection = document.getElementById('durationChartSection');

if (!durationSection) {
  durationSection = document.createElement('div');
  durationSection.id = 'durationChartSection';
  durationSection.style.marginTop = '40px'; // Abstand zu den oberen Charts
  chartSection.parentElement.appendChild(durationSection); // füge es unterhalb ein
}

// Ziel-ID für dritten ChartContainer auf den neuen Bereich setzen
const durationTargetId = 'durationSwapChart';
const portfolioPoint = {
  YEAR: portTtM + 'Y',
  RATES: portfolioYield
};

const durationPortfolioPoint = swapPointToDurationAsYearRate(portfolioPoint);
const durationPoints = durationPortfolioPoint
  ? [{
      x: parseFloat(durationPortfolioPoint.YEAR.replace('Y', '')),
      y: parseFloat(durationPortfolioPoint.RATES.replace('%', ''))
    }]
  : [];





drawYieldVsEUSWChart({
  targetId: durationTargetId,
  heading: 'Portfolio Yield vs Duration',
  yieldCurve: durationCurve,
  pastYieldCurve: durationCurvePast,
  euswDataOriginal: durationEUSWData,
  points: durationPoints
});

// 📌 Dauer-basierte Produktpunkte aus filteredData ableiten
const productDurationPoints = filteredData.map(entry => {
  const duration = Math.abs(parseFloat(entry.PV01rel));
  const ytm = typeof entry.ytm === 'number' ? entry.ytm * 100 : parseFloat(entry.ytm);

  if (isNaN(duration) || isNaN(ytm)) {
    console.warn('⚠️ Ungültiger Datenpunkt:', { duration, ytm, entry });
    return null;
  }

  return {
    x: duration,
    y: ytm,
    PROD_ID: entry.PROD_ID
  };
}).filter(Boolean);


// 📦 Neuen Container erstellen (falls noch nicht vorhanden)
let durationProductSection = document.getElementById('durationProductChartSection');
if (!durationProductSection) {
  durationProductSection = document.createElement('div');
  durationProductSection.id = 'durationProductChartSection';
  durationProductSection.style.marginTop = '40px';
  chartSection.parentElement.appendChild(durationProductSection);
}

// 🔍 Chart anzeigen
drawYieldVsEUSWChart({
  targetId: 'durationProductYieldChart',
  heading: 'Product Yields vs Duration',
  yieldCurve: durationCurve,
  pastYieldCurve: durationCurvePast,
  euswDataOriginal: durationEUSWData,
  points: productDurationPoints // enthält x, y, PROD_ID
});



    }
}




        function transformTSDataToEUSWFormat(tsRow) {
        const maturityMap = {
            EU_1Y: '1Y',
            EU_5Y: '5Y',
            EU_10Y: '10Y',
            EU_20Y: '20Y'
        };

        return Object.entries(maturityMap)
            .map(([key, yearLabel]) => {
            const rawValue = tsRow[key];
            const cleanValue = rawValue?.trim();

            if (!cleanValue || isNaN(parseFloat(cleanValue))) return null;

            return {
                YEAR: yearLabel,
                RATES: cleanValue.includes('%') ? cleanValue : `${cleanValue}%`
            };
            })
            .filter(Boolean);
        }

function drawYieldVsEUSWChart({
  targetId = 'euswapYieldChart',
  heading = 'Yield vs EU Yield Curve',
  yieldCurve = [],
  pastYieldCurve = [],
  euswDataOriginal = [],
  points = [] // entweder: Array von { x, y } ODER filteredData mit .TtM & .ytm
}) {
  let canvas = document.getElementById(targetId);

  // Dynamisch richtigen Container ermitteln
  const targetContainerId = targetId === 'durationSwapChart'
    ? 'durationChartSection'
    : 'yieldChartSection';

  let container = document.getElementById(targetContainerId);

  // Falls Container noch nicht existiert → erstellen
  if (!container) {
    container = document.createElement('div');
    container.id = targetContainerId;
    container.style.marginTop = '40px';
    document.body.appendChild(container);
  }

  // Falls Canvas noch nicht vorhanden → erzeugen und anhängen
  if (!canvas) {
    const headingElem = document.createElement('h3');
    headingElem.textContent = heading;

    const chartCanvas = document.createElement('canvas');
    chartCanvas.id = targetId;
    chartCanvas.className = 'lineChart';
    chartCanvas.style.maxWidth = '600px';
    chartCanvas.style.height = '400px';

    container.appendChild(headingElem);
    container.appendChild(chartCanvas);
    canvas = chartCanvas;
  }


  const ctx = setupHiDPICanvas(canvas, 600, 400);

  // Vorherigen Chart zerstören
  if (window[targetId + '_chartInstance']) {
    window[targetId + '_chartInstance'].destroy();
  }

  const parsePoints = (data) =>
    data.map(p => {
      const x = parseFloat(p.YEAR?.replace('Y', ''));
      const y = parseFloat(p.RATES?.replace('%', ''));
      return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
    }).filter(Boolean);

  const euswPoints = parsePoints(yieldCurve);
  const pastPoints = parsePoints(pastYieldCurve);
  const originalPoints = parsePoints(euswDataOriginal);

  // Unterscheidung: Produktdaten vs. ein einzelner Portfolio-Punkt
  const isSinglePoint = points.length === 1 && 'x' in points[0] && 'y' in points[0] &&
                        !('TtM' in points[0]) && !('ytm' in points[0]);

  const portfolioPoint = isSinglePoint ? points[0] : null;

const productDatasets = !isSinglePoint ? points.map((entry, index) => {
  const x = entry.x ?? parseFloat(entry.TtM);
  const y = entry.y ?? (typeof entry.ytm === 'number' ? entry.ytm * 100 : parseFloat(entry.ytm));


    if (isNaN(x) || isNaN(y)) return null;

    const color = `hsl(${(index * 47) % 360}, 80%, 50%)`;

    return {
      label: entry.PROD_ID || `Produkt ${index + 1}`,
      type: 'scatter',
      data: [{ x, y }],
      backgroundColor: color,
      borderColor: color,
      pointRadius: 5,
      pointHoverRadius: 7
    };
  }).filter(Boolean) : [];

  // Y-Achsen-Skalierung
  const allYields = [
    ...euswPoints, ...pastPoints, ...originalPoints,
    ...productDatasets.map(d => d.data[0]),
    ...(portfolioPoint ? [portfolioPoint] : [])
  ];
  const maxY = Math.ceil(Math.max(...allYields.map(p => p.y || 0)));
  const minY = Math.floor(Math.min(...allYields.map(p => p.y || 0)));

  // Datasets zusammenbauen
  const datasets = [
    {
      label: 'EU Yield Curve',
      data: euswPoints,
      showLine: true,
      borderColor: 'rgba(54, 162, 235, 1)',
      backgroundColor: 'rgba(54, 162, 235, 0.2)',
      tension: 0.3,
      pointRadius: 3
    },
    {
      label: 'EU Yield Curve 5 Years Back',
      data: pastPoints,
      showLine: true,
      borderColor: 'rgba(255, 159, 64, 1)',
      backgroundColor: 'rgba(255, 159, 64, 0.2)',
      borderDash: [5, 5],
      tension: 0.3,
      pointRadius: 3
    },
    {
      label: 'EU Swap',
      data: originalPoints,
      showLine: true,
      borderColor: 'rgba(0, 200, 140, 1)',
      backgroundColor: 'rgba(0, 200, 140, 0.2)',
      borderDash: [2, 4],
      tension: 0.3,
      pointRadius: 3
    },
    ...productDatasets
  ];

  if (portfolioPoint) {
    datasets.push({
      label: 'Portfolio Yield',
      type: 'scatter',
      data: [portfolioPoint],
      backgroundColor: 'rgba(255, 99, 132, 1)',
      pointRadius: 6,
      pointHoverRadius: 8
    });
  }

  // Chart rendern
  window[targetId + '_chartInstance'] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      scales: {
        x: {
          type: 'linear',
          title: {
            display: true,
            text: 'Years',
            font: { size: 16 }
          },
          ticks: {
            font: { size: 14 }
          },
          min: 0,
          max: Math.max(...euswPoints.map(p => p.x), ...productDatasets.map(d => d.data[0].x)) + 1
        },
        y: {
          title: {
            display: true,
            text: 'Yield (%)',
            font: { size: 16 }
          },
          ticks: {
            font: { size: 14 },
            callback: val => `${val.toFixed(2)}%`
          },
          min: minY,
          max: maxY
        }
      },
      plugins: {
        legend: {
          position: 'top',
          labels: {
            font: { size: 14 },
            filter: legendItem => {
              const label = legendItem.text;
              return !(points?.some?.(entry => entry.PROD_ID === label));
            }
          }
        },
        tooltip: {
        callbacks: {
            label: context =>
            context.dataset.label === 'Portfolio Yield'
                ? `Portfolio Yield: ${context.raw.y.toFixed(2)}% at ${context.raw.x.toFixed(2)}Y`
                : `${context.dataset.label}: ${context.raw.y.toFixed(2)}% at ${context.raw.x.toFixed(2)}Y`
        },
        bodyFont: { size: 13 }
        }

      }
    }
  });
}

/**
 * Setzt ein Canvas für HiDPI-Rendering mit einheitlicher Größe auf.
 * @param {HTMLCanvasElement} canvas - Das Canvas-Element
 * @param {number} widthPx - Sichtbare Breite in Pixel (z. B. 600)
 * @param {number} heightPx - Sichtbare Höhe in Pixel (z. B. 300)
 */
export function setupHiDPICanvas(canvas, widthPx, heightPx) {
  const dpr = window.devicePixelRatio || 2;

  canvas.width = widthPx * dpr;
  canvas.height = heightPx * dpr;
  canvas.style.width = `${widthPx}px`;
  canvas.style.height = `${heightPx}px`;

  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

  return ctx;
}


function swapPointToDurationAsYearRate(point) {
  const T = parseFloat(point.YEAR?.replace('Y', ''));
  const r = parseFloat(point.RATES?.replace('%', '')) / 100;

  if (isNaN(T) || isNaN(r) || r === 0) return null;

  const duration = (1 - Math.pow(1 + r, -T)) / r;
  const rate = (r * 100).toFixed(2) + '%';

  return {
    YEAR: duration.toFixed(2) + 'Y',
    RATES: rate
  };
}






                

