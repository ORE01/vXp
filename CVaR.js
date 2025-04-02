import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';
import { formatNumber, isValidNumber, formatNumberWithCommas } from './utils/format.js';

let EADChart;
let LGDChart;
let filteredEADMainData = [];

export function handleEADMainData(receivedData) {
  const port_name = appState.getSelectedPortTableName(); // z. B. "UNI"
  ////console.log('port_name:', port_name);




  const EADMainDataContainer = document.getElementById('EADMainDataContainer');

  // 🔍 Daten vorher filtern
  const filtered = receivedData.filter(
    row => row.port_name === port_name && row.pd_flag === 'RATING'
  );


  ////console.log('filtered:', filtered);


  const EADMainData = filtered;

  if (EADMainDataContainer && EADMainData) {
    let columns = ['ISSUER', 'RANK', 'RATING', 'NOTIONAL', 'LGD', 'PD', 'PD_M', 'PD_M_norm'];
    filteredEADMainData = filterColumnsInData(EADMainData, columns);
    if (EADChart) {EADChart.destroy();}
    if (LGDChart) {LGDChart.destroy();}

    // Sort the data by the "NOTIONAL" in descending order
    filteredEADMainData.sort((a, b) => parseFloat(b.NOTIONAL.replace(/\s/g, '')) - parseFloat(a.NOTIONAL.replace(/\s/g, '')));

    const EADMainDataHTML = processData(filteredEADMainData, port_name, 'EAD');
    EADMainDataContainer.innerHTML = EADMainDataHTML;

    // CHARTS:

    // Format the data for the EAD bar chart
    const EADLabels = filteredEADMainData.map(data => data.ISSUER);
    //NOTIONAL is a string!
    const EADValues = filteredEADMainData.map(data => parseFloat(data.NOTIONAL.replace(/\s/g, '')));

    // Call createBarChart with the formatted data for EAD chart
    EADChart = createBarChart({ labels: EADLabels, datasets: [{ label: 'EAD', data: EADValues, backgroundColor: 'rgba(70, 192, 230, 0.7)', borderColor: 'rgba(70, 192, 230, 0.7)' }] }, 'EADChart', 'bar', 'y');
    
    // Format the data for the LGD bar chart
    const LGDValues = filteredEADMainData.map(data => parseFloat(data.LGD.toString().replace(/\s/g, '')));
    //////console.log('LGDvalues:', LGDValues);

    // Create the combined dataset for EAD and LGD
    const combinedDataset = [
      {
        label: 'EAD',
        data: EADValues,
        backgroundColor: 'rgba(70, 192, 230, 0.7)',
        borderColor: 'rgba(70, 192, 230, 0.7)',
        borderWidth: 1,
      },
      {
        label: 'LGD',
        data: LGDValues,
        backgroundColor: 'rgba(255, 0, 0)',
        borderColor: 'rgba(255, 0, 0)',
        borderWidth: 1,
      },
    ];
    //console.log('combinedDatasets:', combinedDataset);
    
    // Call createBarChart with the combined datasets for EAD and LGD chart
    const combinedLabels = EADLabels;
    LGDChart = createBarChart({ labels: combinedLabels, datasets: combinedDataset }, 'LGDChart', 'bar', 'y');
    //LGDChart = createBarChart({ labels: combinedLabels, datasets: combinedDataset }, 'LGDChart', 'bar', 'y');

    //console.log('EADMain:', EADMainData);
  }
}

export function handleCVaRData(receivedData) {
  //console.log(`📌 CVaR Data received:`, receivedData);

  let port_name = appState.getSelectedPortTableName();
  //console.log(`🔍 Filtering for port_name:`, port_name);

  // Filter by port_name
  const filteredByPort = receivedData.filter(item => item.port_name === port_name);

  appState.setCvarData(filteredByPort);

  const containerMapping = {
      rating: ['CVaR_ratingDataContainer'],
      market: ['CVaR_marketDataContainer'],
      norm: ['CVaR_normDataContainer'],
  };

  Object.keys(containerMapping).forEach(pd_flag => {
      const filteredData = filteredByPort.filter(item => 
          item.pd_flag && item.pd_flag.toLowerCase() === pd_flag
      );
      //console.log(`✅ Filtered Data for ${pd_flag}:`, filteredData);

      const containerIds = containerMapping[pd_flag];
      if (!containerIds || filteredData.length === 0) return;

      const primaryContainer = document.getElementById(containerIds[0]);
      if (!primaryContainer) {
          console.error(`❌ Container "${containerIds[0]}" not found.`);
          return;
      }

      // Populate the first container with a formatted table
      populateCVaRTable(primaryContainer, filteredData, port_name);

      // Clone content into additional containers
      if (containerIds.length > 1) {
          containerIds.slice(1).forEach(containerId => {
              const secondaryContainer = document.getElementById(containerId);
              if (!secondaryContainer) return;
              secondaryContainer.innerHTML = "";
              secondaryContainer.appendChild(primaryContainer.firstElementChild.cloneNode(true));
          });
      }
  });
}


    function populateCVaRTable(container, CVaRData, port_name) {
      if (!CVaRData || CVaRData.length === 0) {
          console.warn("⚠️ No CVaR data available.");
          container.innerHTML = "<p>No data available</p>";
          return;
      }

      // Create a new table
      const table = document.createElement("table");
      table.border = "1"; // Add border for visibility

      // Create table headers
      const headers = [`Metric for ${port_name}`, "Absolute", "Relative"];
      const headerRow = table.insertRow();
      headers.forEach(headerText => {
          const cell = headerRow.insertCell();
          cell.textContent = headerText;
          cell.style.fontWeight = "bold"; // Make headers bold
      });

      // Process and insert data rows
      const metrics = [
          { label: "VaR", absKey: "VaR_abs", relKey: "VaR_rel" },
          { label: "ES", absKey: "ES_abs", relKey: "ES_rel" }
      ];

      metrics.forEach(metric => {
          const row = table.insertRow();
          row.insertCell().textContent = metric.label; // First column: Metric name
          row.insertCell().textContent = formatNumber(0)(CVaRData[0][metric.absKey]); // ✅
          row.insertCell().textContent = formatPercentage(CVaRData[0][metric.relKey]); // ✅ (wenn korrekt definiert)

      });

      // Clear previous content and append the new table
      container.innerHTML = "";
      container.appendChild(table);
    }
    function formatPercentage(value) {
      return value !== undefined ? (value * 100).toFixed(2) + "%" : "N/A";
    }


export { filteredEADMainData};

