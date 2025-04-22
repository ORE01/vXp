import createBarChart from './charts/BarChart.js';


export function createComparisonCharts(portDataMap, destroyPrevious = false) {
  console.log('portDataMap:', portDataMap)
      // CHARTS: COMPARE
      if (portDataMap.portDataContainer1 && portDataMap.portDataContainer2){
        const containerIds = [
          'compChartContainer1', 'compChartContainer2', 'compChartContainer3',
          'compChartContainer4', 'compChartContainer5', 'compChartContainer6',
          'compChartContainer7', 'compChartContainer8'
        ];
  
        const chartNames = ['PV01', 'CPV01', 'MvarTOT', 'MvarIR', 'MvarCS', 'CvarRating', 'CvarMarket', 'CvarNorm'];
        const chartLabels = Array(chartNames.length).fill(['Portfolio 1', 'Portfolio 2', 'Difference']);
        const chartType = 'bar';
  
        const chartData = extractChartDataFromSavedValues(portDataMap);
        console.log('portDataMap:', portDataMap)

  containerIds.forEach((containerId, index) => {
    const chartName = chartNames[index];
    const chartValues = chartData[chartName];

    if (!chartValues) {
      console.warn(`⚠️ Keine Daten für ${chartName}`);
      return;
    }

    // Destroy previous chart if needed
    const existingChart = Chart.getChart(`compChart${index + 1}`);
    if (destroyPrevious && existingChart) {
      existingChart.destroy();
    }

    const containerElement = document.getElementById(containerId);
    if (!containerElement) return;
    containerElement.innerHTML = '';

    const canvasElement = document.createElement('canvas');
    canvasElement.id = `compChart${index + 1}`;
    containerElement.appendChild(canvasElement);

    const chartConfig = {
      labels: chartLabels[index],
      datasets: [{
        label: chartName,
        data: chartValues,
        backgroundColor: [
          'rgba(255, 99, 132, 0.2)', // Portfolio 1
          'rgba(54, 162, 235, 0.2)', // Portfolio 2
          'rgba(255, 206, 86, 0.2)'  // Difference
        ],
        borderColor: [
          'rgba(255, 99, 132, 1)',
          'rgba(54, 162, 235, 1)',
          'rgba(255, 206, 86, 1)'
        ],
        borderWidth: 1
      }]
    };

    createBarChart(chartConfig, canvasElement.id, chartType, 'x');
  });
}
}

    function extractChartDataFromSavedValues(savedValues, indexA = 1, indexB = 2) {
      const fields = {
        PV01: 'formPortPV01',
        CPV01: 'formPortCPV01',

        MvarTOT: 'formVaR_T_rel',
        MvarIR: 'formVaR_IR_rel',
        MvarCS: 'formVaR_CS_rel',

        CvarRating: 'formVaR_rating_rel',
        CvarMarket: 'formVaR_market_rel',
        CvarNorm: 'formVaR_norm_rel',
      };

      const chartData = {};
      const keyA = `portDataContainer${indexA}`;
      const keyB = `portDataContainer${indexB}`;

      for (const [key, formId] of Object.entries(fields)) {
        const valA = parseFloat((savedValues[keyA]?.[formId] || '').replace(',', '.')) || 0;
        const valB = parseFloat((savedValues[keyB]?.[formId] || '').replace(',', '.')) || 0;
        const diff = +(valA - valB).toFixed(2);
        chartData[key] = [valA, valB, diff];
      }

      return chartData;
    }






