import { getColorForPieChart, getColorFromPalette} from '../../utils/colors.js';
import processData from '../../modal_HELPER/dataProcessor.js';
import { appState } from '../renderer.js';
import { setupHiDPICanvas } from './SummaryYield.js';
import { getFormatRules } from '../../utils/format.js';

const { jsPDF } = window.jspdf;

let tableName = 'Portfolio';

export function handleSummaryNotionalData(filteredData, index, port_name) {
  const elementId = `portDataContainer${0}`;
  const aggContainerId = `portAggDataContainer${5}`;

  const portfolioData = appState.getPortAggData(elementId) || {};
  const tableData = mapPortDataToTableRows(portfolioData);
  const html = processData(tableData, tableName);

  const summaryContainer = document.getElementById(aggContainerId);
  if (summaryContainer) summaryContainer.innerHTML = html;

  // === Zentraler Grid-Container ===
  const pieChartGridId = 'pieChartGrid';
  const chartGrid = document.getElementById(pieChartGridId);
  if (!chartGrid) return;
  chartGrid.innerHTML = ''; // leeren

  // === Spalten + Anzeigenamen ===
  const columnsToChart = ['ISSUER', 'RATING', 'RANK', 'RATINGres', 'CATEGORY', 'CouponType', 'Depotbank'];

  const columnDisplayNames = {
    ISSUER:     "Issuer",
    RATING:     "Issuer General Rating",
    RANK:       "Issuer Capital Structure",
    RATINGres:  "Product Ratings",
    CATEGORY:   "Product Categories",
    CouponType: "Product Coupon Type",
    Depotbank:  "Depot Bank"
  };

  // === Gruppierung: Issuer (3), Product (3), General (1) ===
  const groups = {
    Issuer:  ['ISSUER', 'RATING', 'RANK'],
    Product: ['RATINGres', 'CATEGORY', 'CouponType'],
    General: ['Depotbank']
  };

  // Helper: Section erzeugen (Titel + inneres Grid)
  const ensureSection = (title, sectionId) => {
    const section = document.createElement('section');
    section.className = 'pie-section';
    section.id = sectionId;

    const h = document.createElement('h2');
    h.className = 'pie-section-title';
    h.textContent = title;

    const inner = document.createElement('div');
    inner.className = 'pie-section-grid';

    section.appendChild(h);
    section.appendChild(inner);
    chartGrid.appendChild(section);
    return inner;
  };

  // Sektionen bauen
  const issuerGrid  = ensureSection('Issuer',  'pie-section-issuer');
  const productGrid = ensureSection('Product', 'pie-section-product');
  const generalGrid = ensureSection('General', 'pie-section-general');

  // Mapping: Spalte -> Ziel-Container
  const targetMap = new Map();
  groups.Issuer.forEach(c  => targetMap.set(c, issuerGrid));
  groups.Product.forEach(c => targetMap.set(c, productGrid));
  groups.General.forEach(c => targetMap.set(c, generalGrid));

  // Charts rendern
  columnsToChart.forEach((column) => {
    const canvasId = `${column.toLowerCase()}PieChart`;
    const displayName = columnDisplayNames[column] || column;
    const container = targetMap.get(column) || chartGrid;

    const section = document.createElement('div');
    section.className = 'chart-block';

    const heading = document.createElement('h3');
    heading.textContent = displayName;
    heading.className = 'chart-block-title';

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

  // Value-Selector: nur 1x binden
  const valueSel = document.getElementById('valueSelector');
  if (valueSel && !valueSel.dataset.bound) {
    valueSel.addEventListener('change', () => {
      columnsToChart.forEach(column => drawPieChartByColumn(filteredData, column));
    });
    valueSel.dataset.bound = '1';
  }
}

// === Unverändert: deine Funktion, nur zur Vollständigkeit hier ===
function drawPieChartByColumn(filteredData, columnName) {
  const valueType = document.getElementById('valueSelector').value;

  const { labels: rawLabels, values } = getValuesByColumn(filteredData, columnName, valueType);
  const canvasId = `${columnName.toLowerCase()}PieChart`;

  const oldCanvas = document.getElementById(canvasId);
  if (!oldCanvas) {
    console.warn(`Canvas with ID ${canvasId} not found.`);
    return;
  }

  const container = oldCanvas.parentNode;
  oldCanvas.remove();

  const newCanvas = document.createElement('canvas');
  newCanvas.id = canvasId;
  newCanvas.className = 'pieChart';
  container.appendChild(newCanvas);

  const ctx = setupHiDPICanvas(newCanvas, 420, 250);

  const colors = rawLabels.map((_, index) => getColorForPieChart(index));
  const total = values.reduce((a, b) => a + b, 0);
  const labels = rawLabels;

  new Chart(ctx, {
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
          position: 'right',
          align: 'center',
          labels: {
            color: '#666',
            boxWidth: 10,
            font: { size: 9, weight: 'normal' },
            padding: 6,
            generateLabels: function (chart) {
              const data = chart.data;
              const dataset = data.datasets[0];
              const total = dataset.data.reduce((a, b) => a + b, 0);
              return data.labels.map((label, i) => {
                const value = dataset.data[i];
                const percentage = ((value / total) * 100).toFixed(1);
                return {
                  text: `${label}: ${percentage}%`,
                  fillStyle: dataset.backgroundColor[i],
                  strokeStyle: dataset.borderColor[i],
                  fontColor: '#666',
                  color: '#666',
                  lineWidth: dataset.borderWidth,
                  hidden: chart.getDataVisibility(i) === false,
                  index: i
                };
              }).slice(0, 15);
            }
          }
        },
        tooltip: {
          bodyFont: { size: 10 },
          callbacks: {
            label: function (context) {
              const value = context.parsed;
              const percentage = ((value / total) * 100).toFixed(2);
              return `${labels[context.dataIndex]}: ${getFormatRules()[valueType]?.(value)} € (${percentage}%)`;
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























