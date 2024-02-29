import processData from './renderer/dataProcessor.js';
import createLineChart from './charts/LineChart.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';


let IRlineChart;

// Function to handle the IR data
export function handleIRData(receivedData) {
  const IRData = receivedData;
  // console.log('Received prodData callback called.');
  if (IRDataContainer && IRData) {
    const IRDataHTML = processData(IRData);
    IRDataContainer.innerHTML = IRDataHTML;
  }

  // Edit Buttons
  const IREditButtons = document.querySelectorAll('#IRDataContainer .edit-button');
  IREditButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation(); // Stop event propagation
      const tableName = 'EUSW';
      const actionType = 'edit';
      const rowIndex = parseInt(button.getAttribute('data-row'), 10);
      handleFormAction(event, IRData, rowIndex, tableName, actionType);
    });
  });

  // Destroy the existing IR line chart before creating a new one
  if (IRlineChart) {IRlineChart.destroy();}

  //GRAPH
  // Retrieve the data from the IRDataContainer
  const table = IRDataContainer.querySelector('#dataTable');
  const rows = Array.from(table.rows);
  //const headers = Array.from(rows.shift().cells).map((cell) => cell.textContent.trim());

  // Get the RATES dataset
  const ratesDataset = {
    label: 'RATES',
    data: [],
    fill: false,
    borderColor: 'rgba(75, 192, 192, 1)',
    tension: 0.1,
  };

  rows.forEach((row) => {
    const rowData = Array.from(row.cells).map((cell) => cell.textContent.trim());
    const xValue = rowData[1]; // Assuming the YEAR values are in the first column
    const rateValue = parseFloat(rowData[2]); // Assuming the RATES values are in the second column
    ratesDataset.data.push({ x: xValue, y: rateValue });
  });

  // Create the IR line chart using the RATES dataset
  IRlineChart = createLineChart([ratesDataset], 'IRlineChart', 'Interest Rates', 3);
}

// In the window's event listener
window.addEventListener('DOMContentLoaded', () => {
  // Your existing code for event listeners and data processing
});
