import createBarChart from './charts/BarChart.js';
import { appState } from './renderer.js';
import { formatNumber, formatNumberWithCommas } from './utils/format.js';

let MVaRChart;
//INPUT!
export function handleMVarInputData(receivedData) {
  // console.log('MVaR.js, receivedData:', receivedData);
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

export function handleMVaRData(receivedData) {
  appState.setMvarData(receivedData);

  let port_name = appState.getSelectedPortTableName();
  //console.log('handleMVaRData:', receivedData);
  //console.log('🔍 port_name:', port_name);

  if (!receivedData || receivedData.length === 0) return null;

  // 1️⃣ Versuche, Daten für das aktuelle Portfolio zu finden
  let filteredData = receivedData.find(dataPoint => dataPoint.port_name === port_name);

  // 2️⃣ Wenn nicht gefunden → versuche 'DEFAULT'
  if (!filteredData) {
    console.warn(`⚠️ Kein Datensatz für "${port_name}" gefunden. Versuche Fallback auf 'DEFAULT'.`);
    filteredData = receivedData.find(dataPoint => dataPoint.port_name === 'DEFAULT');
  }

  // 3️⃣ Wenn auch 'DEFAULT' fehlt → Dummy-Datensatz mit 0
  if (!filteredData) {
    console.warn(`⚠️ Auch kein 'DEFAULT'-Eintrag gefunden. Verwende leere 0-Werte.`);
    filteredData = {
      port_name: 'DEFAULT',
      VaR_T_abs: 0,
      VaR_T_rel: 0,
      VaR_IR_abs: 0,
      VaR_IR_rel: 0,
      VaR_CS_abs: 0,
      VaR_CS_rel: 0,
      ES_T_rel: 0,
      ES_IR_rel: 0,
      ES_CS_rel: 0,
      index: 'n/a'
    };
  }

  const MVaRDataContainer = document.getElementById('MVaRDataContainer');
  let table = document.createElement('table');

  if (MVaRDataContainer) {
    MVaRDataContainer.innerHTML = '';
    table.classList.add('MVaRTable');

    updateMVaRChart(filteredData);

    const tableHeaders = ['Portfolio', 'VaR_T_abs', 'VaR_T_rel', 'VaR_IR_abs', 'VaR_IR_rel', 'VaR_CS_abs', 'VaR_CS_rel'];
    const headerRow = table.insertRow(0);
    tableHeaders.forEach((headerText, index) => {
      const cell = headerRow.insertCell(index);
      cell.textContent = headerText;
    });

    const row = table.insertRow(1);
    row.insertCell(0).textContent = filteredData.port_name;
    row.insertCell(1).textContent = formatNumber(0)(filteredData.VaR_T_abs);
    row.insertCell(2).textContent = formatNumberWithCommas(filteredData.VaR_T_rel);
    row.insertCell(3).textContent = formatNumber(0)(filteredData.VaR_IR_abs);
    row.insertCell(4).textContent = formatNumberWithCommas(filteredData.VaR_IR_rel);
    row.insertCell(5).textContent = formatNumber(0)(filteredData.VaR_CS_abs);
    row.insertCell(6).textContent = formatNumberWithCommas(filteredData.VaR_CS_rel);

    MVaRDataContainer.appendChild(table);
  }

  return table;
}
    function updateMVaRChart(MVaRData) {
      //console.log('MVaRData:', MVaRData);

      // Immer ein Array draus machen
      const filteredData = Array.isArray(MVaRData) ? MVaRData : [MVaRData];

      if (!filteredData.length) {
        console.warn('⚠️ Keine Daten für das Portfolio gefunden.');
        return;
      }

      //console.log('filteredData:', filteredData);

      if (MVaRChart) {
        MVaRChart.destroy();
      }
      
      const MVaRLabels = filteredData.map(data => data.index || '');

      const MVaRValues = {
        Total:  filteredData.map(d => d.VaR_T_rel),
        Interest_Rate: filteredData.map(d => d.VaR_IR_rel),
        Credit_Spread: filteredData.map(d => d.VaR_CS_rel),
      };
      
      const data = {
        labels: MVaRLabels,
        MVaRValues
      };
      
      
      //console.log('BarChartData:', data);

      //MVaRChart = createBarChart({ labels: MVaRLabels, datasets: [{ data: MVaRValues, backgroundColor: 'rgba(70, 192, 230, 0.7)', borderColor: 'rgba(70, 192, 230, 0.7)' }] }, 'MVaRChart', 'bar', 'x');
      MVaRChart = createBarChart({
        labels: MVaRLabels,
        datasets: [
          {
            label: 'Total VaR',
            data: MVaRValues.Total,
            backgroundColor: 'rgba(255, 206, 86, 0.2)',
            borderColor: 'rgba(255, 206, 86, 1)',
            borderWidth: 1
          },
          {
            label: 'Interest Rate VaR',
            data: MVaRValues.Interest_Rate,
            backgroundColor: 'rgba(70, 192, 230, 0.2)',
            borderColor: 'rgba(70, 192, 230, 1)',
            borderWidth: 1
          },
          {
            label: 'Credit Spread VaR',
            data: MVaRValues.Credit_Spread,
            backgroundColor: 'rgba(255, 99, 132, 0.2)',
            borderColor: 'rgba(255, 99, 132, 1)',
            borderWidth: 1
          }
        ]
      }, 'MVaRChart', 'bar', 'x');
      
      

    }






