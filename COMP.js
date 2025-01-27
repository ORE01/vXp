import createBarChart from './charts/BarChart.js';
// elementId wird in PORT angesprochen
export function displayValuesForElementId(elementId, savedValues) {
  // console.log('elementId', elementId);
  // console.log('savedValues', savedValues);

  const values = savedValues[elementId];

  if (!values) {
    // console.log(`No saved values for ${elementId}`);
    return;
  }

  switch (elementId) {
    case 'portDataContainer':
      {
        const elements = {
          formFiltPortValue: 'formFiltPortValue',
          formFiltPortNotional: 'formFiltPortNotional',

          formFiltPortYield: 'formFiltPortYield',
          formFiltPortYieldA: 'formFiltPortYieldA',

          formFiltPortPV01: 'formFiltPortPV01',
          formFiltPortCPV01: 'formFiltPortCPV01',

          formMvarTOT:'formPortMvarTOT',
          formMvarIR:'formPortMvarIR',
          formMvarCS:'formPortMvarCS',

          formCvarTOT:'formPortCvarTOT',
        };

        for (const id of Object.values(elements)) {
          const element = document.getElementById(id);
          if (element) {
            element.textContent = values[id] || '';
          }
        }
      }
      break;

    case 'compPortDataContainer':
      {
        const elements = {
          formFiltPortValue: 'formPortValue1',
          formFiltPortNotional: 'formPortNotional1',
          
          formFiltPortYield: 'formPortYield1',
          formFiltPortYieldA: 'formPortYieldA1',

          formFiltPortPV01: 'formPortPV011',
          formFiltPortCPV01: 'formPortCPV011',

          formMvarTOT:'formPortMvarTOT1',
          formMvarIR:'formPortMvarIR1',
          formMvarCS:'formPortMvarCS1',

          formCvarTOT:'formPortCvarTOT1',
        };

        for (const id of Object.values(elements)) {
          const element = document.getElementById(id);
          if (element) {
            element.textContent = values[id] || '';
          }
        }
      }
      break;

    case 'compPortDataContainer2':
      {
        const elements = {
          formFiltPortValue: 'formPortValue2',
          formFiltPortNotional: 'formPortNotional2',

          formFiltPortYield: 'formPortYield2',
          formFiltPortYieldA: 'formPortYieldA2',

          formFiltPortPV01: 'formPortPV012',
          formFiltPortCPV01: 'formPortCPV012',

          formMvarTOT:'formPortMvarTOT2',
          formMvarIR:'formPortMvarIR2',
          formMvarCS:'formPortMvarCS2',

          formCvarTOT:'formPortCvarTOT2',
        };

        for (const id of Object.values(elements)) {
          const element = document.getElementById(id);
          if (element) {
            element.textContent = values[id] || '';
          }
        }
      }
      break;

    default:
      // console.log(`No handler for elementId: ${elementId}`);
  }


// ComparisonCharts
const containerIds = ['compChartContainer1', 'compChartContainer2', 'compChartContainer3', 'compChartContainer4', 'compChartContainer5', 'compChartContainer6']; // Include the ID for the third chart container
const chartNames = ['PV01', 'CPV01', 'MvarTOT', 'MvarIR', 'MvarCS', 'CvarTOT'];
const chartLabels = [
  ['Portfolio 1', 'Portfolio 2', 'Difference'], 
  ['Portfolio 1', 'Portfolio 2', 'Difference'], 
  ['Portfolio 1', 'Portfolio 2', 'Difference'],
  ['Portfolio 1', 'Portfolio 2', 'Difference'],
  ['Portfolio 1', 'Portfolio 2', 'Difference'],
  ['Portfolio 1', 'Portfolio 2', 'Difference']
];
const chartType = 'bar';

  
  createComparisonCharts(savedValues, containerIds, chartNames, chartLabels, chartType);
  
}

function createComparisonCharts(savedValues, containerIds, chartNames, chartLabels, chartType, destroyPrevious = false) {
  // Check if both sets of data are available
  const isFirstSetPresent = savedValues['compPortDataContainer'];
  const isSecondSetPresent = savedValues['compPortDataContainer2'];

  if (isFirstSetPresent && isSecondSetPresent) {
    // Loop through each container and create a chart
    containerIds.forEach((containerId, index) => {

      // Destroy the previous chart if specified
      const existingChart = Chart.getChart(`compChart${index + 1}`);
      if (existingChart) {
        existingChart.destroy();
      }

      // Clear existing canvas elements in the container
      const containerElement = document.getElementById(containerId);
      containerElement.innerHTML = '';

      const chartData = {
        labels: chartLabels[index],
        datasets: [{
          label: chartNames[index],
          data: [
            parseFloat(savedValues['compPortDataContainer'][`formPort${chartNames[index]}1`]) || 0,
            parseFloat(savedValues['compPortDataContainer2'][`formPort${chartNames[index]}2`]) || 0,
            parseFloat(savedValues['compPortDataContainer'][`formPort${chartNames[index]}1`]) - parseFloat(savedValues['compPortDataContainer2'][`formPort${chartNames[index]}2`]) || 0
          ],
          backgroundColor: [
            'rgba(255, 99, 132, 0.2)', // Red
            'rgba(54, 162, 235, 0.2)', // Blue
            'rgba(255, 206, 86, 0.2)'   // Yellow
          ],
          borderColor: [
            'rgba(255, 99, 132, 1)',
            'rgba(54, 162, 235, 1)',
            'rgba(255, 206, 86, 1)'
          ],
          borderWidth: 1
        }]
      };

      // Check if both datasets contain the necessary data before calculating the difference
      if (savedValues['compPortDataContainer'][`formPort${chartNames[index]}1`] && savedValues['compPortDataContainer2'][`formPort${chartNames[index]}2`]) {
        const difference = parseFloat(savedValues['compPortDataContainer'][`formPort${chartNames[index]}1`]) - parseFloat(savedValues['compPortDataContainer2'][`formPort${chartNames[index]}2`]);
        chartData.datasets[0].data.push(difference);
      } else {
        // If data is missing for either dataset, push 0 as the difference
        chartData.datasets[0].data.push(0);
      }

      const canvasElement = document.createElement('canvas');
      canvasElement.id = `compChart${index + 1}`;
      containerElement.appendChild(canvasElement);

      createBarChart(chartData, `compChart${index + 1}`, chartType, 'x');
    });
  }
}




