import { PortValue } from './PORT.js';
import createBarChart from './charts/BarChart.js';

let MVaRChart;
//INPUT!
export function handleMVarInputData(receivedData) {
  console.log('MVaR.js, receivedData:', receivedData);
  // Define a function to create an HTML table from the data
  function createTable(data) {
    const table = document.createElement('table');
    const headers = Object.keys(data[0]);

    // Create the table headers
    const headerRow = document.createElement('tr');
    headers.forEach((header) => {
      const th = document.createElement('th');
      th.textContent = header;
      headerRow.appendChild(th);
    });
    table.appendChild(headerRow);

    // Populate the table with data
    data.forEach((row) => {
      const tableRow = document.createElement('tr');
      headers.forEach((header) => {
        const cell = document.createElement('td');
        const cellValue = row[header];
        cell.textContent = cellValue;
        cell.setAttribute('contentEditable', 'true'); // Make cell editable
        tableRow.appendChild(cell);
      });

      while (container.firstChild) {
        container.removeChild(container.firstChild);
      }
      
      table.appendChild(tableRow);
    });

    return table;
  }
 

  // Get a reference to the table container element
  const container = document.getElementById('inputMVaR-container'); // Replace with your container element's ID

  // Create and append the table to the container
  const table = createTable(receivedData);
  container.appendChild(table);
}
//MVaR Values!
// Function to format number with commas
function formatNumberWithCommas(value) {
  return value.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
export function handleMVaRData(receivedData) {
  const MVaRData = receivedData;
  const MVaRDataRel = [];

  // Divide all values with PortValue and store in MVaRDataRel
  if (PortValue !== 0) {
    MVaRData.forEach((dataPoint) => {
const varValue = parseFloat(dataPoint.VaR.replace(/,/g, ''));
const esValue = parseFloat(dataPoint.ES.replace(/,/g, ''));


      const relativeVaR = ((varValue / PortValue) * 100).toFixed(2) + '%'; // Format as percentage
      const relativeES = ((esValue / PortValue) * 100).toFixed(2) + '%'; // Format as percentage

      MVaRDataRel.push({
        ...dataPoint,
        VaR: relativeVaR,
        ES: relativeES,
      });
    });
  } else {
    // Handle the case when PortValue is 0 to avoid division by zero
    MVaRData.forEach((dataPoint) => {
      MVaRDataRel.push({
        ...dataPoint,
        VaR: 'N/A',
        ES: 'N/A',
      });
    });
  }

  console.log('MVaRDataRel:', MVaRDataRel);


  // MVaRDataContainer: alle VaRs: total, IR, CS
  const MVaRDataContainer = document.getElementById('MVaRDataContainer');
  if (MVaRDataContainer && MVaRData) {
    // Create and update the table content
    const table = document.createElement('table');
    table.classList.add('MVaRTable');

    // Create table headers
    const tableHeaders = ['Componant', 'VaR', 'VaR_%', 'ES', 'ES_%'];
    const headerRow = table.insertRow(0);
    tableHeaders.forEach((headerText, index) => {
      const cell = headerRow.insertCell(index);
      cell.textContent = headerText;
    });

    // Populate the table with MVaRData and MVaRDataRel
    MVaRData.forEach((dataPoint, rowIndex) => {
      const row = table.insertRow(rowIndex + 1);
      const cell1 = row.insertCell(0);
      cell1.textContent = dataPoint.index;
      const cell2 = row.insertCell(1);
      cell2.textContent = dataPoint.VaR;
      const cell3 = row.insertCell(2);
      cell3.textContent = MVaRDataRel[rowIndex].VaR;
      const cell4 = row.insertCell(3);
      cell4.textContent = dataPoint.ES;
      const cell5 = row.insertCell(4);
      cell5.textContent = MVaRDataRel[rowIndex].ES;
    });

  // MVaRMainDataContainer: Nur total
  const MVaRMainDataContainer = document.getElementById('MVaRMainDataContainer');
  if (MVaRMainDataContainer && MVaRData && MVaRDataRel && MVaRData.length > 0) {
    // Clear existing content in MVaRMainDataContainer
    while (MVaRMainDataContainer.firstChild) {
      MVaRMainDataContainer.removeChild(MVaRMainDataContainer.firstChild);
    }
  
    const mvarDataTable = document.createElement('table');
    mvarDataTable.classList.add('MVaRDataTable');
  
    // Create and populate the header row
    const headerRow = mvarDataTable.insertRow(0);
    ['MARKET', 'absolute', 'relative'].forEach((text, index) => {
      let cell = headerRow.insertCell(index);
      cell.textContent = text;
    });
  
// Populate the first data row for MVaR
const firstRowData = MVaRData[0];
const firstRowRelData = MVaRDataRel[0];
const rowMVaR = mvarDataTable.insertRow(1);
rowMVaR.insertCell(0).textContent = 'VaR';
rowMVaR.insertCell(1).textContent = formatNumberWithCommas(firstRowData.VaR);
rowMVaR.insertCell(2).textContent = formatNumberWithCommas(firstRowRelData.VaR);

// Populate the second data row for M_ES
const rowM_ES = mvarDataTable.insertRow(2);
rowM_ES.insertCell(0).textContent = 'ES';
rowM_ES.insertCell(1).textContent = formatNumberWithCommas(firstRowData.ES);
rowM_ES.insertCell(2).textContent = formatNumberWithCommas(firstRowRelData.ES);
  
    // Append the table to the MVaRMainDataContainer
    MVaRMainDataContainer.appendChild(mvarDataTable);
  }
  

  // Optional: return the first table if needed elsewhere
  return table;
}
}
//Chart
export function updateMVaRChart(MVaRData) {
  // Destroy the existing chart before creating a new one
  if (MVaRChart) {MVaRChart.destroy();}
    
  const MVaRLabels = MVaRData.map(data => data.index);
  const MVaRValues = MVaRData.map(data => parseFloat(data.VaR.replace(/\s/g, '')));
  const data = { MVaRLabels, MVaRValues };
  //console.log('BarChartData:', data);

  //MVaRChart = createBarChart(data, 'MVaRChart', 'bar', 'x');
  MVaRChart = createBarChart({ labels: MVaRLabels, datasets: [{ data: MVaRValues, backgroundColor: 'rgba(70, 192, 230, 0.7)', borderColor: 'rgba(70, 192, 230, 0.7)' }] }, 'MVaRChart', 'bar', 'x');
}


