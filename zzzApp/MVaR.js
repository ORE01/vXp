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
export function handleMVaRData(receivedData) {
  const MVaRData = receivedData;
  const MVaRDataRel = [];

  // Divide all values with PortValue and store in MVaRDataRel
  if (PortValue !== 0) {
    MVaRData.forEach((dataPoint) => {
      const vaRValue = parseFloat(dataPoint.VaR.replace(/\s/g, ''));
      const esValue = parseFloat(dataPoint.ES.replace(/\s/g, ''));

      const relativeVaR = ((vaRValue / PortValue) * 100).toFixed(2) + '%'; // Format as percentage
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


  // Get the container element
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


