// import { filterColumnsInData } from '../../../modal_HELPER/dataProcessor.js';
// import processData from '../../../modal_HELPER/dataProcessor.js';
// import createBarChart from '../../../charts/BarChart.js';
// import { formatNumber, isValidNumber, formatNumberWithCommas } from '../../../utils/format.js';

// // let EADChart;
// let LGDChart;
// let filteredEADMainData = [];

// export function handleEADData(receivedData) {
//   const port_name = appState.getSelectedPortTableName(); // z. B. "UNI"
//   // console.log('port_name:', port_name);

//   const EADDataContainer = document.getElementById('EADDataContainer');

//   // 🔍 Daten vorher filtern
//   const filtered = receivedData.filter(
//     row => row.port_name === port_name && row.pd_flag === 'RATING'
//   );
//   ////console.log('filtered:', filtered);
//   const EADMainData = filtered;

//   if (EADDataContainer && EADMainData) {
//     let columns = ['ISSUER', 'RANK', 'RATING', 'NOTIONAL', 'LGD', 'PD', 'PD_M', 'PD_M_norm'];
//     const eadColumnLabelMap = {
//       ISSUER: 'ISSUER',
//       RANK: 'RANK',
//       RATING: 'RATING',
//       NOTIONAL: 'NOTIONAL',
//       LGD: 'LGD',
//       PD: 'PD-Historic',
//       PD_M: 'PD-Market Implied',
//       PD_M_norm: 'PD-Risk Adjusted',
//     };

//     filteredEADMainData = filterColumnsInData(EADMainData, columns);
//     // if (EADChart) {EADChart.destroy();}
//     if (LGDChart) {LGDChart.destroy();}

//     // Sort the data by the "NOTIONAL" in descending order
//     filteredEADMainData.sort((a, b) => parseFloat(b.NOTIONAL.replace(/\s/g, '')) - parseFloat(a.NOTIONAL.replace(/\s/g, '')));

//     const EADMainDataHTML = processData(filteredEADMainData, 'EAD', eadColumnLabelMap);
//     EADDataContainer.innerHTML = EADMainDataHTML;

//     // CHARTS:

//     // Format the data for the EAD bar chart
//     const EADLabels = filteredEADMainData.map(data => data.ISSUER);
//     //NOTIONAL is a string!
//     const EADValues = filteredEADMainData.map(data => parseFloat(data.NOTIONAL.replace(/\s/g, '')));

//     // Call createBarChart with the formatted data for EAD chart
//     //EADChart = createBarChart({ labels: EADLabels, datasets: [{ label: 'EAD', data: EADValues, backgroundColor: 'rgba(70, 192, 230, 0.7)', borderColor: 'rgba(70, 192, 230, 0.7)' }] }, 'EADChart', 'bar', 'y');
    
//     // Format the data for the LGD bar chart
//     const LGDValues = filteredEADMainData.map(data => parseFloat(data.LGD.toString().replace(/\s/g, '')));
//     //////console.log('LGDvalues:', LGDValues);

//     // Create the combined dataset for EAD and LGD
//     const combinedDataset = [
//       {
//         label: 'EAD',
//         data: EADValues,
//         backgroundColor: 'rgba(70, 192, 230, 0.7)',
//         borderColor: 'rgba(70, 192, 230, 0.7)',
//         borderWidth: 1,
//       },
//       {
//         label: 'LGD',
//         data: LGDValues,
//         backgroundColor: 'rgba(255, 0, 0)',
//         borderColor: 'rgba(255, 0, 0)',
//         borderWidth: 1,
//       },
//     ];
//     //console.log('combinedDatasets:', combinedDataset);
    
//     // Call createBarChart with the combined datasets for EAD and LGD chart
//     const combinedLabels = EADLabels;
//     LGDChart = createBarChart({ labels: combinedLabels, datasets: combinedDataset }, 'LGDChart', 'bar', 'y');
//     //LGDChart = createBarChart({ labels: combinedLabels, datasets: combinedDataset }, 'LGDChart', 'bar', 'y');

//     //console.log('EADMain:', EADMainData);
//   }
// }
// export function handleCVaRData(receivedData, index) {
//   const port_name = appState.getSelectedPortTableName();
//   const filteredByPort = receivedData.filter(item => item.port_name === port_name);
//   appState.setCvarData(filteredByPort);

//   const containerMapping = {
//     rating: 'CVaR_ratingDataContainer',
//     market: 'CVaR_marketDataContainer',
//     norm: 'CVaR_normDataContainer',
//   };

//   const combinedRelData = {};

//   Object.keys(containerMapping).forEach(pd_flag => {
//     const filteredData = filteredByPort.filter(item =>
//       item.pd_flag && item.pd_flag.toLowerCase() === pd_flag
//     );

//     const containerId = containerMapping[pd_flag];
//     const container = document.getElementById(containerId);
//     if (container && filteredData.length > 0) {
//       populateCVaRTable(container, filteredData, port_name);
//       combinedRelData[pd_flag] = filteredData;
//     }
//   });

//   // ✅ Jetzt rendern wir eine kombinierte Übersicht:
//   renderCombinedCVaRRelTable(combinedRelData, index);

//   // if (Object.keys(combinedRelData).length === 0) {
//   //   noCVaRDataFallback("run CVaR");
//   // }
  
// }
//     function populateCVaRTable(container, CVaRData, port_name) {
//       if (!CVaRData || CVaRData.length === 0) {
//           console.warn("⚠️ No CVaR data available.");
//           container.innerHTML = "<p>No data available</p>";
//           return;
//       }

//       // Create a new table
//       const table = document.createElement("table");
//       table.border = "1"; // Add border for visibility

//       // Create table headers
//       const headers = [`Metric for ${port_name}`, "Absolute", "Relative"];
//       const headerRow = table.insertRow();
//       headers.forEach(headerText => {
//           const cell = headerRow.insertCell();
//           cell.textContent = headerText;
//           cell.style.fontWeight = "bold"; // Make headers bold
//       });

//       // Process and insert data rows
//       const metrics = [
//           { label: "VaR", absKey: "VaR_abs", relKey: "VaR_rel" },
//           { label: "ES", absKey: "ES_abs", relKey: "ES_rel" }
//       ];

//       metrics.forEach(metric => {
//           const row = table.insertRow();
//           row.insertCell().textContent = metric.label; // First column: Metric name
//           row.insertCell().textContent = formatNumber(0)(CVaRData[0][metric.absKey]); // ✅
//           row.insertCell().textContent = formatPercentage(CVaRData[0][metric.relKey]); // ✅ (wenn korrekt definiert)

//       });

//       // Clear previous content and append the new table
//       container.innerHTML = "";
//       container.appendChild(table);
//     }
//     function formatPercentage(value) {
//       return value !== undefined ? (value * 100).toFixed(2) + "%" : "N/A";
//     }
//     function renderCombinedCVaRRelTable(allFilteredDataByPdFlag, index) {
//       const containerId = `CVaR_allRelativeContainer${index}`;
//       // console.log('containerId:', containerId);
    
//       const container = document.getElementById(containerId);
//       if (!container) return;
    
//       // ✅ Prüfen, ob überhaupt sinnvolle Daten vorhanden sind
//       const hasValidData = Object.values(allFilteredDataByPdFlag).some(
//         (data) => data?.[0]?.VaR_rel !== undefined
//       );
    
//       if (!hasValidData) {
//         container.innerHTML = ''; // Kein Header, keine Tabelle
//         return;
//       }
    
//       // ✅ Jetzt sicher: Es gibt gültige Daten → baue die Tabelle
//       container.innerHTML = '';
//       const table = document.createElement('table');
//       table.classList.add('CVaRTable');
    
//       const headerRow = table.insertRow();
//       ['label', 'value'].forEach(text => {
//         const cell = headerRow.insertCell();
//         cell.textContent = text;
//       });
      
//       const allowedPdFlags = ['rating', 'market' , 'norm']; // ⬅️ Nur "market" anzeigen. Für alle: einfach [] oder null setzen

//       const labelMap = {
//   rating: 'Historic',
//   market: 'Market Implied',
//   norm: 'Risk Adjusted'
// };


// Object.entries(allFilteredDataByPdFlag).forEach(([pd_flag, data]) => {
//   if (allowedPdFlags.length > 0 && !allowedPdFlags.includes(pd_flag)) return; // ⛔ Skip if not allowed

//   const row = data[0];
//   if (!row || !('VaR_rel' in row)) return;

//   const label = `${labelMap[pd_flag] || pd_flag} VaR`;

//   const value = typeof row.VaR_rel === 'string'
//     ? row.VaR_rel
//     : formatPercentage(row.VaR_rel);

//   const r = table.insertRow();
//   r.insertCell(0).textContent = label;
//   r.insertCell(1).textContent = value;
// });

      
    
//       container.appendChild(table);
//     }
    
// export { filteredEADMainData};


import { filterColumnsInData } from '../../../modal_HELPER/dataProcessor.js';
import processData from '../../../modal_HELPER/dataProcessor.js';
import createBarChart from '../../../charts/BarChart.js';
import { formatNumber, isValidNumber, formatNumberWithCommas } from '../../../utils/format.js';

// === Modul-Scope ===
let LGDChart = null;
// dient als Cache für EAD/LDG-Daten des aktuellen Portfolios
let filteredEADMainData = [];

/**
 * EAD / LGD Daten verarbeiten:
 * - nach aktuellem Portfolio + pd_flag='RATING' filtern
 * - Tabelle in EADDataContainer rendern
 * - Daten in filteredEADMainData cachen
 * - LGD-Chart zeichnen (renderLGDChart)
 */
export function handleEADData(receivedData) {
  const port_name = appState.getSelectedPortTableName(); // z. B. "UNI"
  const EADDataContainer = document.getElementById('EADDataContainer');

  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    console.warn('handleEADData: keine EAD-Daten erhalten');
    if (EADDataContainer) {
      EADDataContainer.innerHTML = '<p>No EAD data available.</p>';
    }
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch (err) {
      console.error('handleEADData: Fehler beim Destroy von LGDChart:', err);
    }
    return;
  }

  if (!EADDataContainer) {
    console.warn('handleEADData: EADDataContainer nicht gefunden');
    return;
  }

  // 🔍 Daten vorher filtern: aktuelles Portfolio + PD-Flag RATING
  const filtered = receivedData.filter(
    row => row.port_name === port_name && row.pd_flag === 'RATING'
  );

  if (filtered.length === 0) {
    console.warn('handleEADData: keine passenden EAD-Zeilen für', port_name);
    EADDataContainer.innerHTML = '<p>No EAD data for selected portfolio.</p>';
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch (err) {
      console.error('handleEADData: Fehler beim Destroy von LGDChart:', err);
    }
    return;
  }

  // Relevante Spalten
  const columns = ['ISSUER', 'RANK', 'RATING', 'NOTIONAL', 'LGD', 'PD', 'PD_M', 'PD_M_norm'];
  const eadColumnLabelMap = {
    ISSUER: 'ISSUER',
    RANK: 'RANK',
    RATING: 'RATING',
    NOTIONAL: 'NOTIONAL',
    LGD: 'LGD',
    PD: 'PD-Historic',
    PD_M: 'PD-Market Implied',
    PD_M_norm: 'PD-Risk Adjusted',
  };

  // Nur relevante Spalten behalten
  filteredEADMainData = filterColumnsInData(filtered, columns);

  // Nach NOTIONAL (numerisch) desc sortieren
  filteredEADMainData.sort(
    (a, b) =>
      parseFloat((b.NOTIONAL || '0').toString().replace(/\s/g, '')) -
      parseFloat((a.NOTIONAL || '0').toString().replace(/\s/g, ''))
  );

  // Tabelle rendern
  const EADMainDataHTML = processData(filteredEADMainData, 'EAD', eadColumnLabelMap);
  EADDataContainer.innerHTML = EADMainDataHTML;

  // 🔁 Direkt nach Daten-Update: Chart zeichnen
  renderLGDChart();
}

/**
 * Reine Render-Funktion für den LGD/EAD-Bar-Chart.
 * Nutzt den Cache filteredEADMainData.
 */
export function renderLGDChart() {
  if (!filteredEADMainData || filteredEADMainData.length === 0) {
    console.warn('renderLGDChart: keine Daten in filteredEADMainData');
    return;
  }

  const canvasId = 'LGDChart';
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    console.warn(`renderLGDChart: Canvas mit ID ${canvasId} nicht gefunden`);
    return;
  }

  // Labels = Issuer
  const labels = filteredEADMainData.map(row => row.ISSUER);

  // EAD (NOTIONAL) → Zahl
  const EADValues = filteredEADMainData.map(row => {
    const raw = (row.NOTIONAL || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  });

  // LGD → Zahl
  const LGDValues = filteredEADMainData.map(row => {
    const raw = (row.LGD || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return isNaN(v) ? 0 : v;
  });

  // alten Chart zerstören
  if (LGDChart) {
    try {
      LGDChart.destroy();
    } catch (err) {
      console.error('renderLGDChart: Fehler beim Destroy von LGDChart:', err);
    }
    LGDChart = null;
  }

  const datasets = [
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
      backgroundColor: 'rgba(255, 0, 0, 0.7)',
      borderColor: 'rgba(255, 0, 0, 1)',
      borderWidth: 1,
    },
  ];

  LGDChart = createBarChart(
    { labels, datasets },
    canvasId,
    'bar',
    'y'
  );
}

/**
 * CVaR-Daten verarbeiten:
 * - nach Portfolio filtern
 * - drei Tabellen (rating / market / norm)
 * - kombinierte Relative-VaR-Tabelle (CVaR_allRelativeContainer{index})
 */
export function handleCVaRData(receivedData, index) {
  const port_name = appState.getSelectedPortTableName();
  const filteredByPort = Array.isArray(receivedData)
    ? receivedData.filter(item => item.port_name === port_name)
    : [];

  appState.setCvarData(filteredByPort);

  const containerMapping = {
    rating: 'CVaR_ratingDataContainer',
    market: 'CVaR_marketDataContainer',
    norm: 'CVaR_normDataContainer',
  };

  const combinedRelData = {};

  Object.keys(containerMapping).forEach(pd_flag => {
    const filteredData = filteredByPort.filter(
      item => item.pd_flag && item.pd_flag.toLowerCase() === pd_flag
    );

    const containerId = containerMapping[pd_flag];
    const container = document.getElementById(containerId);

    if (container && filteredData.length > 0) {
      populateCVaRTable(container, filteredData, port_name);
      combinedRelData[pd_flag] = filteredData;
    } else if (container) {
      container.innerHTML = '<p>No data available</p>';
    }
  });

  // Kombinierte Übersicht (VaR_rel)
  renderCombinedCVaRRelTable(combinedRelData, index);
}

function populateCVaRTable(container, CVaRData, port_name) {
  if (!CVaRData || CVaRData.length === 0) {
    console.warn('⚠️ No CVaR data available.');
    container.innerHTML = '<p>No data available</p>';
    return;
  }

  const row0 = CVaRData[0];

  // Create a new table
  const table = document.createElement('table');
  table.border = '1'; // Add border for visibility

  // Create table headers
  const headers = [`Metric for ${port_name}`, 'Absolute', 'Relative'];
  const headerRow = table.insertRow();
  headers.forEach(headerText => {
    const cell = headerRow.insertCell();
    cell.textContent = headerText;
    cell.style.fontWeight = 'bold'; // Make headers bold
  });

  // Process and insert data rows
  const metrics = [
    { label: 'VaR', absKey: 'VaR_abs', relKey: 'VaR_rel' },
    { label: 'ES', absKey: 'ES_abs', relKey: 'ES_rel' },
  ];

  metrics.forEach(metric => {
    const row = table.insertRow();
    row.insertCell().textContent = metric.label; // First column: Metric name

    const absVal = row0[metric.absKey];
    const relVal = row0[metric.relKey];

    row.insertCell().textContent =
      absVal !== undefined ? formatNumber(0)(absVal) : 'N/A';
    row.insertCell().textContent = formatPercentage(relVal);
  });

  // Clear previous content and append the new table
  container.innerHTML = '';
  container.appendChild(table);
}

function formatPercentage(value) {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return (Number(value) * 100).toFixed(2) + '%';
}

/**
 * Baut die kleine kombinierte Tabelle in:
 *  CVaR_allRelativeContainer{index}
 * mit Zeilen für Historic / Market Implied / Risk Adjusted VaR_rel
 */
function renderCombinedCVaRRelTable(allFilteredDataByPdFlag, index) {
  const containerId = `CVaR_allRelativeContainer${index}`;
  const container = document.getElementById(containerId);
  if (!container) return;

  // Prüfen, ob überhaupt sinnvolle Daten vorhanden sind
  const hasValidData = Object.values(allFilteredDataByPdFlag).some(
    data => data?.[0]?.VaR_rel !== undefined
  );

  if (!hasValidData) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';
  const table = document.createElement('table');
  table.classList.add('CVaRTable');

  const headerRow = table.insertRow();
  ['label', 'value'].forEach(text => {
    const cell = headerRow.insertCell();
    cell.textContent = text;
  });

  // Welche pd_flags zeigen wir an?
  const allowedPdFlags = ['rating', 'market', 'norm'];

  const labelMap = {
    rating: 'Historic',
    market: 'Market Implied',
    norm: 'Risk Adjusted',
  };

  Object.entries(allFilteredDataByPdFlag).forEach(([pd_flag, data]) => {
    if (allowedPdFlags.length > 0 && !allowedPdFlags.includes(pd_flag)) return;

    const row = data[0];
    if (!row || !('VaR_rel' in row)) return;

    const label = `${labelMap[pd_flag] || pd_flag} VaR`;
    const rawVal = row.VaR_rel;

    const value =
      typeof rawVal === 'string'
        ? rawVal
        : formatPercentage(rawVal);

    const r = table.insertRow();
    r.insertCell(0).textContent = label;
    r.insertCell(1).textContent = value;
  });

  container.appendChild(table);
}

// Für andere Module verfügbar lassen
export { filteredEADMainData };


