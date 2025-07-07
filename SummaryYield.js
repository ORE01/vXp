import { appState } from './renderer.js';

let euswapChart;


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

  console.log('EUSWData:', EUSWData);
  console.log('yieldCurve:', yieldCurve);
  console.log('pastYieldCurve:', pastYieldCurve);
  
  
// CHART: line chart
    const portfolioYield = portfolioData.formPortYield; // e.g., "1.91%"
    const portTtM = -portfolioData.formPortPV01;
    if (portfolioYield && Array.isArray(EUSWData) && EUSWData.length > 0) {
      drawPortfolioVsEUSWChart(portfolioYield, portTtM, yieldCurve, pastYieldCurve);
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
        function drawPortfolioVsEUSWChart(portfolioYield, portTtM, euswData, euswPastData) {
        // Ensure canvas exists
        let canvas = document.getElementById('euswapYieldChart');
        if (!canvas) {
            const container = document.getElementById('yieldChartSection');

            const heading = document.createElement('h3');
            heading.textContent = 'Portfolio Yield vs EU Yield Curve';

            const chartCanvas = document.createElement('canvas');
            chartCanvas.id = 'euswapYieldChart';
            chartCanvas.className = 'lineChart';
            chartCanvas.style.maxWidth = '600px';
            chartCanvas.style.height = '500px';

            container.appendChild(heading);
            container.appendChild(chartCanvas);
            canvas = chartCanvas;
        }

        const ctx = canvas.getContext('2d');

        // Destroy old chart
        if (euswapChart) {
            euswapChart.destroy();
        }

        // ✅ Take only the first 5 entries and convert to { x, y }
        const euswPoints = euswData
            .slice(0, 5)
            .map(point => {
            const x = parseFloat(point.YEAR?.replace('Y', ''));
            const y = parseFloat(point.RATES?.replace('%', ''));
            return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
            })
            .filter(Boolean);

        const euswPastPoints = euswPastData
            .slice(0, 5)
            .map(point => {
            const x = parseFloat(point.YEAR?.replace('Y', ''));
            const y = parseFloat(point.RATES?.replace('%', ''));
            return (!isNaN(x) && !isNaN(y)) ? { x, y } : null;
            })
            .filter(Boolean); 

        // Convert portfolio yield string to float
        const yieldValue = parseFloat(portfolioYield?.replace('%', ''));

        // Create chart
        euswapChart = new Chart(ctx, {
            type: 'scatter',
            data: {
            datasets: [
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
                data: euswPastPoints,
                showLine: true,
                borderColor: 'rgba(255, 159, 64, 1)',           // Optional: make it stand out
                backgroundColor: 'rgba(255, 159, 64, 0.2)',     // Optional fill
                borderDash: [5, 5],                             // ← Dashed line
                tension: 0.3,
                pointRadius: 3
                },

                {
                label: 'Portfolio Yield',
                type: 'scatter',
                data: [{ x: portTtM, y: yieldValue }],
                backgroundColor: 'rgba(255, 99, 132, 1)',
                pointRadius: 6,
                pointHoverRadius: 8
                }
            ]
            },
            options: {
            responsive: true,
            maintainAspectRatio: false,
            scales: {
                x: {
                type: 'linear',
                title: {
                    display: true,
                    text: 'Years'
                },
                min: 0,
                max: Math.max(...euswPoints.map(p => p.x), portTtM) + 1
                },
                y: {
                title: {
                    display: true,
                    text: 'Yield (%)'
                },
                ticks: {
                    callback: val => `${val.toFixed(2)}%`
                }
                }
            },
            plugins: {
                legend: { position: 'top' },
                tooltip: {
                callbacks: {
                    label: context =>
                    context.dataset.label === 'Portfolio Yield'
                        ? `Portfolio Yield: ${context.raw.y.toFixed(2)}% at ${context.raw.x}Y`
                        : `EUSW: ${context.raw.y.toFixed(2)}%`
                }
                }
            }
            }
        });
        }
