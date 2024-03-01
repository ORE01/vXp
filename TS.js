import processData from './renderer/dataProcessor.js';
import createLineChart from './charts/LineChart.js';

let TSlineChart;

export function handleTSData(receivedData) {
  const TSDataContainer = document.getElementById('TSDataContainer');
  const TSData = receivedData;

  // Destroy the existing TS line chart before creating a new one
  if (TSlineChart) {
    TSlineChart.destroy();
  }

  if (TSDataContainer && TSData) {
    const TSDataHTML = processData(TSData, 'tblTS');
    TSDataContainer.innerHTML = TSDataHTML;

    // Retrieve the data from the TSDataContainer
    const table = TSDataContainer.querySelector('#dataTable');
    const rows = Array.from(table.rows);
    const headers = Array.from(rows.shift().cells).map((cell) => cell.textContent.trim());

    const datasets = headers.slice(1).map((header) => ({
      label: header,
      data: [],
    }));

    rows.forEach((row, index) => {
      const rowData = Array.from(row.cells).map((cell) => cell.textContent.trim());
      const xValue = rowData[0]; // Assuming the DATE values are in the first column
      rowData.slice(1).forEach((value, columnIndex) => {
        datasets[columnIndex].data.push({ x: xValue, y: parseFloat(value) });
      });
    });

    // Generate an array of random colors
    const colors = datasets.map(() => {
      const r = Math.floor(Math.random() * 256);
      const g = Math.floor(Math.random() * 256);
      const b = Math.floor(Math.random() * 256);
      return `rgba(${r}, ${g}, ${b}, 1)`;
    });

    datasets.forEach((dataset, index) => {
      dataset.borderColor = colors[index];
    });

    // Create the TS line chart using the datasets
    TSlineChart = createLineChart(datasets, 'TSlineChart', 'Timeseries', 0);

    // Hide the TSDataContainer
    //TSDataContainer.style.display = 'none';
  }
}


