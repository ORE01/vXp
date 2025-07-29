import { getColorForPieChart, getColorFromPalette} from './utils/colors.js';
import processData from './renderer/dataProcessor.js';
import { appState } from './renderer.js';

const { jsPDF } = window.jspdf;

let tableName = 'Portfolio';

export function handleSummaryNotionalData(filteredData, index, port_name) {
  console.log('summaryData:', filteredData);

  // You intentionally use hardcoded values here
  const elementId = `portDataContainer${0}`;
  const aggContainerId = `portAggDataContainer${5}`;

  //DATA:
  const portfolioData = appState.getPortAggData(elementId) || {};
    // console.log('portfolioData:', portfolioData);

  //TABLE:  Notional and NAV:
  const tableData = mapPortDataToTableRows(portfolioData);
  const html = processData(tableData, tableName);

  const summaryContainer = document.getElementById(aggContainerId);
  if (summaryContainer) {
    summaryContainer.innerHTML = html;
  }

  //CHARTS:
  const columnsToChart = ['ISSUER', 'RATING', 'RANK', 'RATINGres', 'CATEGORY', 'CouponType', 'Depotbank'];

  const columnDisplayNames = {
    ISSUER: "Issuer",
    RATING: "Issuer General Rating",
    RANK: "Issuer Capital Structure",
    RATINGres: "Product Ratings ",
    CATEGORY: "Product Categories",
    Depotbank: "Depot Bank",
    CouponType: "General Coupon Type"
  };

  // Clear each group container
  document.getElementById('issuerCharts').innerHTML = '';
  document.getElementById('productCharts').innerHTML = '';
  document.getElementById('generalCharts').innerHTML = '';


  columnsToChart.forEach((column) => {
    const canvasId = `${column.toLowerCase()}PieChart`;
    const displayName = columnDisplayNames[column] || column;

    // Determine which group to use
    let groupContainerId;
        if (['ISSUER', 'RATING', 'RANK'].includes(column)) {
          groupContainerId = 'issuerCharts';
        } else if (['RATINGres', 'CATEGORY', 'CouponType'].includes(column)) {
          groupContainerId = 'productCharts';
        } else {
          groupContainerId = 'generalCharts';
        }

    const container = document.getElementById(groupContainerId);

    // Create section
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
    drawProdSummaryChart(filteredData);
  });

    // ⬇️ Hier Event-Listener ergänzen:
    document.getElementById('valueSelector').addEventListener('change', () => {
      columnsToChart.forEach(column => {
        drawPieChartByColumn(filteredData, column);
    });
  });
}
    function drawPieChartByColumn(filteredData, columnName) {
      const valueType = document.getElementById('valueSelector').value; // NAV oder NOTIONAL

      const { labels, values } = getValuesByColumn(filteredData, columnName, valueType);

      const canvasId = `${columnName.toLowerCase()}PieChart`;
      const canvas = document.getElementById(canvasId);
      if (!canvas) {
        console.warn(`Canvas with ID ${canvasId} not found.`);
        return;
      }

      if (canvas.chartInstance) {
        canvas.chartInstance.destroy();
      }

      canvas.width = 250;
      canvas.height = 250;
      canvas.style.width = '250px';
      canvas.style.height = '250px';

      const ctx = canvas.getContext('2d');
      const colors = labels.map((_, index) => getColorForPieChart(index));

      canvas.chartInstance = new Chart(ctx, {
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
          plugins: {
            legend: {
              position: 'left',
              labels: { boxWidth: 10, font: { size: 9 }, maxWidth: 280, padding: 4 }
            },
            tooltip: {
              callbacks: {
                label: function (context) {
                  const total = values.reduce((a, b) => a + b, 0);
                  const value = context.parsed;
                  const percentage = ((value / total) * 100).toFixed(2);
                  return `${context.label}: ${value} (${percentage}%)`;
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
            const value = parseFloat(entry[valueType]) || 0;  // dynamisch: NAV oder NOTIONAL
            map[key] = (map[key] || 0) + value;
          });

          return {
            labels: Object.keys(map),
            values: Object.values(map)
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

        const ctx = document.getElementById('prodSummaryChart').getContext('2d');

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





















