import { getColorForPieChart, getColorFromPalette} from './utils/colors.js';
import processData from './renderer/dataProcessor.js';
import { appState } from './renderer.js';
//import { setupHiDPICanvas } from './utils/chartUtils.js'; // Pfad anpassen!
import { setupHiDPICanvas } from './SummaryYield.js'; // Pfad anpassen!
import { getFormatRules } from './utils/format.js';




const { jsPDF } = window.jspdf;

let tableName = 'Portfolio';

export function handleSummaryNotionalData(filteredData, index, port_name) {
  console.log('summaryData:', filteredData);

  const elementId = `portDataContainer${0}`;
  const aggContainerId = `portAggDataContainer${5}`;

  const portfolioData = appState.getPortAggData(elementId) || {};
  const tableData = mapPortDataToTableRows(portfolioData);
  const html = processData(tableData, tableName);

  const summaryContainer = document.getElementById(aggContainerId);
  if (summaryContainer) {
    summaryContainer.innerHTML = html;
  }

  // Neue zentrale Chart-Grid-ID
  const pieChartGridId = 'pieChartGrid';
  const chartGrid = document.getElementById(pieChartGridId);
  if (chartGrid) {
    chartGrid.innerHTML = ''; // Grid leeren
  }

  const columnsToChart = ['ISSUER', 'RATING', 'RANK', 'RATINGres', 'CATEGORY', 'CouponType', 'Depotbank'];

  const columnDisplayNames = {
    ISSUER: "Issuer",
    RATING: "Issuer General Rating",
    RANK: "Issuer Capital Structure",
    RATINGres: "Product Ratings",
    CATEGORY: "Product Categories",
    Depotbank: "Depot Bank",
    CouponType: "General Coupon Type"
  };

  columnsToChart.forEach((column) => {
    const canvasId = `${column.toLowerCase()}PieChart`;
    const displayName = columnDisplayNames[column] || column;

    // Neue zentrale Container-Nutzung
    const container = chartGrid;
    if (!container) return;

    const section = document.createElement('div');
    section.className = 'chart-block';

    const heading = document.createElement('h3');
    heading.textContent = displayName;
    heading.style.textAlign = 'center';

    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.className = 'pieChart';
    canvas.width = 500;
    canvas.height = 500;

    section.appendChild(heading);
    section.appendChild(canvas);
    container.appendChild(section);

    drawPieChartByColumn(filteredData, column);
  });

  // Value-Selector reagiert neu zeichnen
  document.getElementById('valueSelector').addEventListener('change', () => {
    columnsToChart.forEach(column => {
      drawPieChartByColumn(filteredData, column);
    });
  });
}

function drawPieChartByColumn(filteredData, columnName) {
  const valueType = document.getElementById('valueSelector').value;

  const { labels, values } = getValuesByColumn(filteredData, columnName, valueType);
  const canvasId = `${columnName.toLowerCase()}PieChart`;

  const oldCanvas = document.getElementById(canvasId);
  if (!oldCanvas) {
    console.warn(`Canvas with ID ${canvasId} not found.`);
    return;
  }

  const container = oldCanvas.parentNode;

  // altes Canvas entfernen
  oldCanvas.remove();

  // neues Canvas erzeugen
  const newCanvas = document.createElement('canvas');
  newCanvas.id = canvasId;
  newCanvas.className = 'pieChart';
  container.appendChild(newCanvas);

  // HiDPI-Skalierung
  const ctx = setupHiDPICanvas(newCanvas, 250, 250);
  const colors = labels.map((_, index) => getColorForPieChart(index));

  newCanvas.chartInstance = new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        label: `${valueType} by ${columnName}`,
        data: values,
        backgroundColor: colors.map(c => c.backgroundColor),
        borderColor: colors.map(c => c.borderColor),
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      devicePixelRatio: 1,
      plugins: {
        legend: {
          position: 'left',
          labels: {
            boxWidth: 10,
            font: {
              size: 9,
              weight: 'normal'
            },
            padding: 4
          }
        },
        tooltip: {
          bodyFont: { size: 10 },
          callbacks: {
            label: function (context) {
              const total = values.reduce((a, b) => a + b, 0);
              const value = context.parsed;
              const percentage = ((value / total) * 100).toFixed(2);
              return `${context.label}: ${getFormatRules()[valueType]?.(value)} € (${percentage}%)`;

            }
          }
        }
      }
    }
  });
}





      function getValuesByColumn(data, columnName, valueType = 'NAV') {
        const map = {};

        data.forEach(entry => {
          const key = entry[columnName] || 'Unknown';
          const value = parseFloat(entry[valueType]) || 0;
          map[key] = (map[key] || 0) + value;
        });

        // Einträge sortieren (absteigend nach Wert)
        const sorted = Object.entries(map)
          .sort((a, b) => b[1] - a[1]);

        return {
          labels: sorted.map(([key]) => key),
          values: sorted.map(([, value]) => value)
        };
      }




    function mapPortDataToTableRows(data) {
        return [
        { label: 'Notional', value: data.formPortNotional },
        { label: 'NetAssetValue', value: data.formPortValue },
        // { label: 'Portfolio Yield', value: data.formPortYield },
        // { label: 'Portfolio Yield (act)', value: data.formPortYieldA },
        // { label: 'Interest Rate Sensitivity (PV01)', value: data.formPortPV01 },
        // { label: 'Credit Spread Sensitivity (CPV01)', value: data.formPortCPV01 },
        ];
    }


    function drawProdSummaryChart(filteredData) {
      const prodMap = {};

      filteredData.forEach(entry => {
        const prodId = entry.PROD_ID || 'Unknown';
        const notional = parseFloat(entry.NOTIONAL) || 0;
        const nav = parseFloat(entry.NAV) || 0;

        if (!prodMap[prodId]) {
          prodMap[prodId] = { notional: 0, nav: 0 };
        }

        prodMap[prodId].notional += notional;
        prodMap[prodId].nav += nav;
      });

        // 🔥 Mapping in Array konvertieren und nach NOTIONAL absteigend sortieren
        const sortedData = Object.entries(prodMap)
          .sort((a, b) => b[1].notional - a[1].notional)
          .slice(0, 5); // 👈 Nur die Top 5

        const prodIds = sortedData.map(([prodId]) => prodId);
        const notionals = sortedData.map(([, values]) => values.notional);
        const navs = sortedData.map(([, values]) => values.nav);

        const notionalColor = getColorForPieChart(0);
        const navColor = getColorForPieChart(1);

        const canvas = document.getElementById('prodSummaryChart');
        const ctx = setupHiDPICanvas(canvas, 600, 400); // oder was auch immer du brauchst


        if (ctx.chartInstance) {
          ctx.chartInstance.destroy();
        }

      ctx.chartInstance = new Chart(ctx, {
        type: 'bar',
        data: {
          labels: prodIds,
          datasets: [
            {
              label: 'Notional',
              data: notionals,
              backgroundColor: notionalColor.backgroundColor,
              borderColor: notionalColor.borderColor,
              borderWidth: 1
            },
            {
              label: 'NAV',
              data: navs,
              backgroundColor: navColor.backgroundColor,
              borderColor: navColor.borderColor,
              borderWidth: 1
            }
          ]
        },
        options: {
          plugins: {
            legend: { position: 'top' },
            tooltip: {
              callbacks: {
                label: function (context) {
                  return `${context.dataset.label}: ${context.parsed.y}`;
                }
              }
            }
          },
          responsive: true,
          scales: {
            x: {
              title: { display: true, text: 'PROD_ID' }
            },
            y: {
              title: { display: true, text: 'Value' },
              beginAtZero: true
            }
          }
        }
      });
    }





















