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

export function handleMVaRData(receivedData, index) {
  console.log('MVaRData, index:', receivedData, index);
  const port_name = appState.getSelectedPortTableName();

  console.log('port_name:', port_name);

  const containerIds = [
    'MVaRDataContainer',
    `MVaRDataContainer${index}`
  ];

  if (!receivedData || receivedData.length === 0) {
    containerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    return;
  }

  let filteredData = receivedData.find(dataPoint => dataPoint.port_name === port_name);

  if (!filteredData) {
    containerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    return;
  }

  renderMVaRFullTable(filteredData, 'MVaRDataContainer');
  renderMVaRRelativeTableWithIndex(filteredData, index);
  updateMVaRChart(filteredData);
}
    function renderMVaRFullTable(data, containerId) {
    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = '';
    const table = document.createElement('table');
    table.classList.add('MVaRTable');

    const headerRow = table.insertRow();
    ['Label', 'Value'].forEach(text => {
    const cell = headerRow.insertCell();
    cell.textContent = text;
    });

    const rows = [
    { label: 'VaR_T_abs', value: typeof data.VaR_T_abs === 'string' ? data.VaR_T_abs : formatNumber()(data.VaR_T_abs) },
    { label: 'VaR_IR_abs', value: typeof data.VaR_IR_abs === 'string' ? data.VaR_IR_abs : formatNumber()(data.VaR_IR_abs) },
    { label: 'VaR_CS_abs', value: typeof data.VaR_CS_abs === 'string' ? data.VaR_CS_abs : formatNumber()(data.VaR_CS_abs) },
  
    // 🔵 Absolute Werte – ES
    { label: 'ES_T_abs', value: typeof data.ES_T_abs === 'string' ? data.ES_T_abs : formatNumber()(data.ES_T_abs) },
    { label: 'ES_IR_abs', value: typeof data.ES_IR_abs === 'string' ? data.ES_IR_abs : formatNumber()(data.ES_IR_abs) },
    { label: 'ES_CS_abs', value: typeof data.ES_CS_abs === 'string' ? data.ES_CS_abs : formatNumber()(data.ES_CS_abs) },
  
    // 🟢 Relative Werte – VaR
    { label: 'VaR_T_rel', value: typeof data.VaR_T_rel === 'string' ? data.VaR_T_rel : formatNumberWithCommas(data.VaR_T_rel) },
    { label: 'VaR_IR_rel', value: typeof data.VaR_IR_rel === 'string' ? data.VaR_IR_rel : formatNumberWithCommas(data.VaR_IR_rel) },
    { label: 'VaR_CS_rel', value: typeof data.VaR_CS_rel === 'string' ? data.VaR_CS_rel : formatNumberWithCommas(data.VaR_CS_rel) },
  
    // 🟢 Relative Werte – ES
    { label: 'ES_T_rel', value: typeof data.ES_T_rel === 'string' ? data.ES_T_rel : formatNumberWithCommas(data.ES_T_rel) },
    { label: 'ES_IR_rel', value: typeof data.ES_IR_rel === 'string' ? data.ES_IR_rel : formatNumberWithCommas(data.ES_IR_rel) },
    { label: 'ES_CS_rel', value: typeof data.ES_CS_rel === 'string' ? data.ES_CS_rel : formatNumberWithCommas(data.ES_CS_rel) }
    ];

    rows.forEach(({ label, value }) => {
    const row = table.insertRow();
    row.insertCell(0).textContent = label;
    row.insertCell(1).textContent = value;
    });

    container.appendChild(table);
    }
    function renderMVaRRelativeTableWithIndex(data, index) {
      const containerId = `MVaRDataContainer${index}`;
      const container = document.getElementById(containerId);
      if (!container) return;
    
      // ❗ Prüfen, ob überhaupt sinnvolle Daten vorhanden sind
      const hasValidData = data && (
        data.VaR_T_rel !== undefined ||
        data.VaR_IR_rel !== undefined ||
        data.VaR_CS_rel !== undefined
      );
    
      if (!hasValidData) {
        container.innerHTML = ''; // Kein Header, keine Tabelle
        return;
      }
    
      container.innerHTML = '';
      const table = document.createElement('table');
      table.classList.add('MVaRTable');
    
      const headerRow = table.insertRow();
      ['label', 'value'].forEach(text => {
        const cell = headerRow.insertCell();
        cell.textContent = text;
      });
    
      const rows = [
        { label: 'VaR_T_rel', value: formatNumberWithCommas(data.VaR_T_rel) },
        { label: 'VaR_IR_rel', value: formatNumberWithCommas(data.VaR_IR_rel) },
        { label: 'VaR_CS_rel', value: formatNumberWithCommas(data.VaR_CS_rel) }
      ];
    
      rows.forEach(({ label, value }) => {
        const row = table.insertRow();
        row.insertCell(0).textContent = label;
        row.insertCell(1).textContent = value;
      });
    
      container.appendChild(table);
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
