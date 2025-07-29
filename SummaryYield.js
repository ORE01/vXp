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
  heading: 'Portfolio Yield vs EU Yield Curve',
  yieldCurve,
  pastYieldCurve,
  euswDataOriginal: EUSWData, // ✅ korrekter Parametername!
  points: [{ x: portTtM, y: parseFloat(portfolioYield.replace('%', '')) }]
});




drawYieldVsEUSWChart({
  targetId: 'euswapProductYieldChart',
  heading: 'Product Yields vs EU Yield Curve',
  yieldCurve,
  pastYieldCurve,
  euswDataOriginal: EUSWData,
  points: filteredData // mit .TtM, .ytm, .PROD_ID
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
  if (!canvas) {
    const container = document.getElementById('yieldChartSection');

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
    const x = typeof entry.TtM === 'number' ? entry.TtM : parseFloat(entry.TtM);
    const y = typeof entry.ytm === 'number' ? entry.ytm * 100 : parseFloat(entry.ytm);

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
            text: 'Maturity (Years)',
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
                ? `Portfolio Yield: ${context.raw.y.toFixed(2)}% at ${context.raw.x}Y`
                : `${context.dataset.label}: ${context.raw.y.toFixed(2)}% bei ${context.raw.x.toFixed(2)}J`
          },
          bodyFont: { size: 13 }
        }
      }
    }
  });
}



        // function drawPortfolioVsEUSWChart(portfolioYield, portTtM, euswData, euswPastData) {
        // // Ensure canvas exists
        // let canvas = document.getElementById('euswapYieldChart');
        // if (!canvas) {
        //     const container = document.getElementById('yieldChartSection');

        //     const heading = document.createElement('h3');
        //     heading.textContent = 'Portfolio Yield vs EU Yield Curve';

        //     const chartCanvas = document.createElement('canvas');
        //     chartCanvas.id = 'euswapYieldChart';
        //     chartCanvas.className = 'lineChart';
        //     chartCanvas.style.maxWidth = '600px';
        //     chartCanvas.style.height = '500px';

        //     container.appendChild(heading);
        //     container.appendChild(chartCanvas);
        //     canvas = chartCanvas;
        // }

        // const ctx = canvas.getContext('2d');

        // // Destroy old chart
        // if (euswapChart) {
        //     euswapChart.destroy();
        // }

        // // ✅ Take only the first 5 entries and convert to { x, y }
        // const euswPoints = euswData
        //     .slice(0, 5)
        //     .map(point => {
        //     const x = parseFloat(point.YEAR?.replace('Y', ''));
        //     const y = parseFloat(point.RATES?.replace('%', ''));
        //     return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
        //     })
        //     .filter(Boolean);

        // const euswPastPoints = euswPastData
        //     .slice(0, 5)
        //     .map(point => {
        //     const x = parseFloat(point.YEAR?.replace('Y', ''));
        //     const y = parseFloat(point.RATES?.replace('%', ''));
        //     return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
        //     })
        //     .filter(Boolean); 

        // // Convert portfolio yield string to float
        // const yieldValue = parseFloat(portfolioYield?.replace('%', ''));


        // // Create chart
        // euswapChart = new Chart(ctx, {
        //     type: 'scatter',
        //     data: {
        //     datasets: [
        //         {
        //         label: 'EU Yield Curve',
        //         data: euswPoints,
        //         showLine: true,
        //         borderColor: 'rgba(54, 162, 235, 1)',
        //         backgroundColor: 'rgba(54, 162, 235, 0.2)',
        //         tension: 0.3,
        //         pointRadius: 3
        //         },
        //         {
        //         label: 'EU Yield Curve 5 Years Back',
        //         data: euswPastPoints,
        //         showLine: true,
        //         borderColor: 'rgba(255, 159, 64, 1)',           // Optional: make it stand out
        //         backgroundColor: 'rgba(255, 159, 64, 0.2)',     // Optional fill
        //         borderDash: [5, 5],                             // ← Dashed line
        //         tension: 0.3,
        //         pointRadius: 3
        //         },

        //         {
        //         label: 'Portfolio Yield',
        //         type: 'scatter',
        //         data: [{ x: portTtM, y: yieldValue }],
        //         backgroundColor: 'rgba(255, 99, 132, 1)',
        //         pointRadius: 6,
        //         pointHoverRadius: 8
        //         }
        //     ]
        //     },
        //     options: {
        //     responsive: true,
        //     maintainAspectRatio: false,
        //     scales: {
        //         x: {
        //         type: 'linear',
        //         title: {
        //             display: true,
        //             text: 'Years'
        //         },
        //         min: 0,
        //         max: Math.max(...euswPoints.map(p => p.x), portTtM) + 1
        //         },
        //         y: {
        //         title: {
        //             display: true,
        //             text: 'Yield (%)'
        //         },
        //         ticks: {
        //             callback: val => `${val.toFixed(2)}%`
        //         }
        //         }
        //     },
        //     plugins: {
        //         legend: { position: 'top' },
        //         tooltip: {
        //         callbacks: {
        //             label: context =>
        //             context.dataset.label === 'Portfolio Yield'
        //                 ? `Portfolio Yield: ${context.raw.y.toFixed(2)}% at ${context.raw.x}Y`
        //                 : `EUSW: ${context.raw.y.toFixed(2)}%`
        //         }
        //         }
        //     }
        //     }
        // });
        // }



// function drawPortfolioVsYieldCurvesChart(portfolioYield, portTtM, yieldCurve, pastYieldCurve, euswDataOriginal) {
//   let canvas = document.getElementById('euswapPortfolioYieldChart');
//   if (!canvas) {
//     const container = document.getElementById('yieldChartSection');

//     const heading = document.createElement('h3');
//     heading.textContent = 'Portfolio Yield vs EU Yield Curve';

//     const chartCanvas = document.createElement('canvas');
//     chartCanvas.id = 'euswapPortfolioYieldChart';
//     chartCanvas.className = 'lineChart';
//     chartCanvas.style.maxWidth = '600px';
//     chartCanvas.style.height = '400px';

//     container.appendChild(heading);
//     container.appendChild(chartCanvas);
//     canvas = chartCanvas;
//   }

//   const ctx = setupHiDPICanvas(canvas, 600, 400);

//   // Vorherigen Chart zerstören
//   if (window.euswapPortfolioChartInstance) {
//     window.euswapPortfolioChartInstance.destroy();
//   }

//   // Umwandlung der 3 Yields
//   const parsePoints = (data) =>
//     data.map(p => {
//       const x = parseFloat(p.YEAR?.replace('Y', ''));
//       const y = parseFloat(p.RATES?.replace('%', ''));
//       return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
//     }).filter(Boolean);

//   const euswPoints = parsePoints(yieldCurve);
//   const pastPoints = parsePoints(pastYieldCurve);
//   const originalPoints = parsePoints(euswDataOriginal);

//   const yVal = parseFloat(portfolioYield?.replace('%', '')) || 0;
//   const allYields = [...euswPoints, ...pastPoints, ...originalPoints, { y: yVal }];
//   const maxY = Math.ceil(Math.max(...allYields.map(p => p.y || 0)));
//   const minY = Math.floor(Math.min(...allYields.map(p => p.y || 0)));

//   window.euswapPortfolioChartInstance = new Chart(ctx, {
//     type: 'scatter',
//     data: {
//       datasets: [
//         {
//           label: 'EU Yield Curve',
//           data: euswPoints,
//           showLine: true,
//           borderColor: 'rgba(54, 162, 235, 1)',
//           backgroundColor: 'rgba(54, 162, 235, 0.2)',
//           tension: 0.3,
//           pointRadius: 3
//         },
//         {
//           label: 'EU Yield Curve 5 Years Back',
//           data: pastPoints,
//           showLine: true,
//           borderColor: 'rgba(255, 159, 64, 1)',
//           backgroundColor: 'rgba(255, 159, 64, 0.2)',
//           borderDash: [5, 5],
//           tension: 0.3,
//           pointRadius: 3
//         },
//         {
//           label: 'Original EU SW Data',
//           data: originalPoints,
//           showLine: true,
//           borderColor: 'rgba(0, 200, 140, 1)',
//           backgroundColor: 'rgba(0, 200, 140, 0.2)',
//           borderDash: [2, 4],
//           tension: 0.3,
//           pointRadius: 3
//         },
//         {
//           label: 'Portfolio Yield',
//           type: 'scatter',
//           data: [{ x: portTtM, y: yVal }],
//           backgroundColor: 'rgba(255, 99, 132, 1)',
//           pointRadius: 6,
//           pointHoverRadius: 8
//         }
//       ]
//     },
//     options: {
//       responsive: false,
//       maintainAspectRatio: false,
//       scales: {
//         x: {
//           type: 'linear',
//           title: {
//             display: true,
//             text: 'Laufzeit (Jahre)',
//             font: { size: 16 }
//           },
//           ticks: {
//             font: { size: 14 }
//           },
//           min: 0,
//           max: Math.max(...euswPoints.map(p => p.x), portTtM) + 1
//         },
//         y: {
//           title: {
//             display: true,
//             text: 'Rendite (%)',
//             font: { size: 16 }
//           },
//           ticks: {
//             font: { size: 14 },
//             callback: val => `${val.toFixed(2)}%`
//           },
//           min: minY,
//           max: maxY
//         }
//       },
//       plugins: {
//         legend: {
//           position: 'top',
//           labels: {
//             font: { size: 14 }
//           }
//         },
//         tooltip: {
//           callbacks: {
//             label: context =>
//               context.dataset.label === 'Portfolio Yield'
//                 ? `Portfolio Yield: ${context.raw.y.toFixed(2)}% at ${context.raw.x}Y`
//                 : `${context.dataset.label}: ${context.raw.y.toFixed(2)}%`
//           },
//           bodyFont: { size: 14 }
//         }
//       }
//     }
//   });
// }


//         function drawProductYieldVsEUSWChart(filteredData, euswData, euswPastData) {
//         let canvas = document.getElementById('euswapProductYieldChart');
//         if (!canvas) {
//             const container = document.getElementById('yieldChartSection');

//             const heading = document.createElement('h3');
//             heading.textContent = 'Product Yield vs EU Yield Curve';

//             const chartCanvas = document.createElement('canvas');
//             chartCanvas.id = 'euswapProductYieldChart';
//             chartCanvas.className = 'lineChart';
//             chartCanvas.style.maxWidth = '600px';
//             chartCanvas.style.height = '300px';

//             container.appendChild(heading);
//             container.appendChild(chartCanvas);
//             canvas = chartCanvas;
//         }

//         const dpr = window.devicePixelRatio || 2;
//         canvas.width = 600 * dpr;
//         canvas.height = 300 * dpr;
//         canvas.style.width = '600px';
//         canvas.style.height = '300px';

//         const ctx = setupHiDPICanvas(canvas, 600, 400);

//         ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

//         // Vorherigen Chart zerstören, falls vorhanden
//         if (window.euswapProductYieldChartInstance) {
//             window.euswapProductYieldChartInstance.destroy();
//         }

//         const euswPoints = euswData.map(p => {
//             const x = parseFloat(p.YEAR?.replace('Y', ''));
//             const y = parseFloat(p.RATES?.replace('%', ''));
//             return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
//         }).filter(Boolean);

//         const euswPastPoints = euswPastData.map(p => {
//             const x = parseFloat(p.YEAR?.replace('Y', ''));
//             const y = parseFloat(p.RATES?.replace('%', ''));
//             return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
//         }).filter(Boolean);

//         const productDatasets = filteredData.map((entry, index) => {
//             const ttm = typeof entry.TtM === 'number' ? entry.TtM : parseFloat(entry.TtM);
//             const ytm = typeof entry.ytm === 'number' ? entry.ytm : parseFloat(entry.ytm);

//             if (isNaN(ttm) || isNaN(ytm)) return null;

//             const hue = (index * 47) % 360;
//             const color = `hsl(${hue}, 80%, 50%)`;

//             return {
//             label: entry.PROD_ID || `Produkt ${index + 1}`,
//             type: 'scatter',
//             data: [{ x: ttm, y: ytm * 100 }],
//             backgroundColor: color,
//             borderColor: color,
//             pointRadius: 5,
//             pointHoverRadius: 7
//             };
//         }).filter(Boolean);

//         const allX = [...euswPoints, ...productDatasets.map(d => d.data[0])].map(p => p.x);
//         const allY = [...euswPoints, ...productDatasets.map(d => d.data[0])].map(p => p.y);

//         const maxX = Math.max(...allX);
//         const minY = Math.min(...allY);
//         const maxY = Math.max(...allY);

//         window.euswapProductYieldChartInstance = new Chart(ctx, {
//             type: 'scatter',
//             data: {
//             datasets: [
//                 {
//                 label: 'EU Yield Curve',
//                 data: euswPoints,
//                 showLine: true,
//                 borderColor: 'rgba(54, 162, 235, 1)',
//                 backgroundColor: 'rgba(54, 162, 235, 0.2)',
//                 tension: 0.3,
//                 pointRadius: 3
//                 },
//                 {
//                 label: 'EU Yield Curve 5 Years Back',
//                 data: euswPastPoints,
//                 showLine: true,
//                 borderColor: 'rgba(255, 159, 64, 1)',
//                 backgroundColor: 'rgba(255, 159, 64, 0.2)',
//                 borderDash: [5, 5],
//                 tension: 0.3,
//                 pointRadius: 3
//                 },
//                 ...productDatasets
//             ]
//             },
//             options: {
//             responsive: false,
//             maintainAspectRatio: false,
//             scales: {
//                 x: {
//                 type: 'linear',
//                 title: {
//                     display: true,
//                     text: 'Laufzeit (Jahre)',
//                     font: { size: 14 }
//                 },
//                 ticks: {
//                     font: { size: 12 }
//                 },
//                 min: 0,
//                 max: maxX + 1
//                 },
//                 y: {
//                 title: {
//                     display: true,
//                     text: 'Rendite (%)',
//                     font: { size: 14 }
//                 },
//                 ticks: {
//                     font: { size: 12 },
//                     callback: val => `${val.toFixed(2)}%`
//                 },
//                 min: Math.floor(minY - 0.5),
//                 max: Math.ceil(maxY + 0.5)
//                 }
//             },
//         plugins: {
//         legend: {
//             position: 'top',
//             labels: {
//             font: { size: 12 },
//             filter: function (legendItem) {
//                 const label = legendItem.text;
//                 return !(filteredData.some(entry => entry.PROD_ID === label));
//             }
//             }
//         },
//         tooltip: {
//             callbacks: {
//             label: context =>
//                 `${context.dataset.label}: ${context.raw.y.toFixed(2)}% bei ${context.raw.x.toFixed(2)}J`
//             },
//             bodyFont: { size: 11 }
//         }
//         }

//             }
//         });
//         }




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



                

