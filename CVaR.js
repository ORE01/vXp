import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';
import { formatNumber, isValidNumber, formatNumberWithCommas } from './utils/format.js';

let EADChart;
let LGDChart;
let filteredEADMainData = [];

export function handleEADData(receivedData) {
  const port_name = appState.getSelectedPortTableName(); // z. B. "UNI"
  // console.log('port_name:', port_name);

  const EADDataContainer = document.getElementById('EADDataContainer');

  // 🔍 Daten vorher filtern
  const filtered = receivedData.filter(
    row => row.port_name === port_name && row.pd_flag === 'RATING'
  );
  ////console.log('filtered:', filtered);
  const EADMainData = filtered;

  if (EADDataContainer && EADMainData) {
    let columns = ['ISSUER', 'RANK', 'RATING', 'NOTIONAL', 'LGD', 'PD', 'PD_M', 'PD_M_norm'];
    filteredEADMainData = filterColumnsInData(EADMainData, columns);
    if (EADChart) {EADChart.destroy();}
    if (LGDChart) {LGDChart.destroy();}

    // Sort the data by the "NOTIONAL" in descending order
    filteredEADMainData.sort((a, b) => parseFloat(b.NOTIONAL.replace(/\s/g, '')) - parseFloat(a.NOTIONAL.replace(/\s/g, '')));

    const EADMainDataHTML = processData(filteredEADMainData, 'EAD');
    EADDataContainer.innerHTML = EADMainDataHTML;

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

// export function handleCVaRData(receivedData) {
//   //console.log(`📌 CVaR Data received:`, receivedData);

//   let port_name = appState.getSelectedPortTableName();
//   //console.log(`🔍 Filtering for port_name:`, port_name);

//   // Filter by port_name
//   const filteredByPort = receivedData.filter(item => item.port_name === port_name);

//   appState.setCvarData(filteredByPort);

//   const containerMapping = {
//     rating: ['CVaR_ratingDataContainer', 'CVaR_ratingDataContainer1'],
//     market: ['CVaR_marketDataContainer', 'CVaR_marketDataContainer1'],
//     norm: ['CVaR_normDataContainer', 'CVaR_normDataContainer1'],
//   };
  

//   Object.keys(containerMapping).forEach(pd_flag => {
//       const filteredData = filteredByPort.filter(item => 
//           item.pd_flag && item.pd_flag.toLowerCase() === pd_flag
//       );
//       console.log(`✅ Filtered Data for ${pd_flag}:`, filteredData);

//       const containerIds = containerMapping[pd_flag];
//       if (!containerIds || filteredData.length === 0) return;

//       const primaryContainer = document.getElementById(containerIds[0]);
//       if (!primaryContainer) {
//           console.error(`❌ Container "${containerIds[0]}" not found.`);
//           return;
//       }

//       // Populate the first container with a formatted table
//       populateCVaRTable(primaryContainer, filteredData, port_name);


//       if (containerIds.length > 1) {
//         renderCVaRRelativeTable(filteredData, containerIds[1], pd_flag);
//       }
      

//   });
// }

export function handleCVaRData(receivedData, index) {
  const port_name = appState.getSelectedPortTableName();
  const filteredByPort = receivedData.filter(item => item.port_name === port_name);
  appState.setCvarData(filteredByPort);

  const containerMapping = {
    rating: 'CVaR_ratingDataContainer',
    market: 'CVaR_marketDataContainer',
    norm: 'CVaR_normDataContainer',
  };

  const combinedRelData = {};

  Object.keys(containerMapping).forEach(pd_flag => {
    const filteredData = filteredByPort.filter(item =>
      item.pd_flag && item.pd_flag.toLowerCase() === pd_flag
    );

    const containerId = containerMapping[pd_flag];
    const container = document.getElementById(containerId);
    if (container && filteredData.length > 0) {
      populateCVaRTable(container, filteredData, port_name);
      combinedRelData[pd_flag] = filteredData;
    }
  });

  // ✅ Jetzt rendern wir eine kombinierte Übersicht:
  renderCombinedCVaRRelTable(combinedRelData, index);

  // if (Object.keys(combinedRelData).length === 0) {
  //   noCVaRDataFallback("run CVaR");
  // }
  
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
    // function renderCombinedCVaRRelTable(allFilteredDataByPdFlag, index) {
    //   const containerId = `CVaR_allRelativeContainer${index}`;
    //   console.log('containerId:', containerId)

    //   const container = document.getElementById(containerId);
    //   if (!container) return;
    
    //   container.innerHTML = '';
    //   const table = document.createElement('table');
    //   table.classList.add('CVaRTable');
    
    //   const headerRow = table.insertRow();
    //   ['Label', 'Value'].forEach(text => {
    //     const cell = headerRow.insertCell();
    //     cell.textContent = text;
    //   });
    
    //   Object.entries(allFilteredDataByPdFlag).forEach(([pd_flag, data]) => {
    //     const row = data[0];
    //     if (!row || !('VaR_rel' in row)) return;
    
    //     const label = `VaR_${pd_flag.toLowerCase()}_rel`;
    //     const value = typeof row.VaR_rel === 'string'
    //       ? row.VaR_rel
    //       : formatPercentage(row.VaR_rel);
    
    //     const r = table.insertRow();
    //     r.insertCell(0).textContent = label;
    //     r.insertCell(1).textContent = value;
    //   });
    
    //   container.appendChild(table);
    // }
    function renderCombinedCVaRRelTable(allFilteredDataByPdFlag, index) {
      const containerId = `CVaR_allRelativeContainer${index}`;
      // console.log('containerId:', containerId);
    
      const container = document.getElementById(containerId);
      if (!container) return;
    
      // ✅ Prüfen, ob überhaupt sinnvolle Daten vorhanden sind
      const hasValidData = Object.values(allFilteredDataByPdFlag).some(
        (data) => data?.[0]?.VaR_rel !== undefined
      );
    
      if (!hasValidData) {
        container.innerHTML = ''; // Kein Header, keine Tabelle
        return;
      }
    
      // ✅ Jetzt sicher: Es gibt gültige Daten → baue die Tabelle
      container.innerHTML = '';
      const table = document.createElement('table');
      table.classList.add('CVaRTable');
    
      const headerRow = table.insertRow();
      ['label', 'value'].forEach(text => {
        const cell = headerRow.insertCell();
        cell.textContent = text;
      });
      
      const allowedPdFlags = ['rating', 'market' , 'norm']; // ⬅️ Nur "market" anzeigen. Für alle: einfach [] oder null setzen

      Object.entries(allFilteredDataByPdFlag).forEach(([pd_flag, data]) => {
        if (allowedPdFlags.length > 0 && !allowedPdFlags.includes(pd_flag)) return; // ⛔ Überspringen, wenn nicht erlaubt
      
        const row = data[0];
        if (!row || !('VaR_rel' in row)) return;
      
        const label = `VaR_${pd_flag.toLowerCase()}_rel`;
        const value = typeof row.VaR_rel === 'string'
          ? row.VaR_rel
          : formatPercentage(row.VaR_rel);
      
        const r = table.insertRow();
        r.insertCell(0).textContent = label;
        r.insertCell(1).textContent = value;
      });
      
    
      container.appendChild(table);
    }
    


    function noCVaRDataFallback(message) {
      const fallbackData = [
        { label: 'VaR_rating_rel', value: message },
        { label: 'VaR_market_rel', value: message },
        { label: 'VaR_norm_rel', value: message }
      ];
    
      const containerId = `CVaR_allRelativeContainer${index}`;
      const container = document.getElementById(containerId);

      if (!container) return;
    
      container.innerHTML = '';
      const table = document.createElement('table');
      table.classList.add('CVaRTable');
    
      const headerRow = table.insertRow();
      ['Label', 'Value'].forEach(text => {
        const cell = headerRow.insertCell();
        cell.textContent = text;
      });
    
      fallbackData.forEach(({ label, value }) => {
        const row = table.insertRow();
        row.insertCell(0).textContent = label;
        row.insertCell(1).textContent = value;
      });
    
      container.appendChild(table);
    }
    
    
    
    
    
    


export { filteredEADMainData};

