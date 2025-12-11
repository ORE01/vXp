import processData from '../../../MODAL_HELPER/dataProcessor.js';
import { createRatesLineChart } from '../../../charts/LineChart.js';
import { handleModalAction } from '../../../MODAL_HELPER/ModalActionHandler.js';

/**
 * Hilfsfunktion: holt EUSW-Daten aus appState + mapped die aktuelle Curve auf RATES
 */
function getIRDataForSelectedCurve() {
  const raw = (typeof appState.getEUSWData === "function")
    ? appState.getEUSWData()
    : [];

  if (!Array.isArray(raw) || raw.length === 0) {
    return { IRData: [], curve: null };
  }

  const curve =
    (typeof appState.getSelectedCurve === "function" && appState.getSelectedCurve()) ||
    "EUSWAP";

  const IRData = raw.map(row => {
    const r = { ...row };
    if (curve in r) {
      r.RATES = r[curve]; // zentrale Logik
    }
    return r;
  });

  return { IRData, curve };
}

/**
 * Panel-Renderer: Tabelle + Edit-Buttons + Chart
 * (Chart ruft intern renderIRLineChart auf)
 */
export function renderIRPanel() {
  const IRDataContainer = document.getElementById("IRDataContainer");
  const ratesSelector   = document.getElementById("ratesSelector");
  if (!IRDataContainer || !ratesSelector) return;

  const { IRData, curve } = getIRDataForSelectedCurve();

  if (!IRData || IRData.length === 0) {
    console.log("⏳ IRPanel waiting for data – skipping render");
    return;    // NICHTS überschreiben!
  }

  // Selector auf gespeicherte Curve syncen
  if (curve && ratesSelector.value !== curve) {
    ratesSelector.value = curve;
  }

  // ============= 3) Table rendern =============
  IRDataContainer.innerHTML = processData(IRData);

  // ============= 4) Edit-Buttons binden =============
  const IREditButtons = document.querySelectorAll('#IRDataContainer .edit-button');
  IREditButtons.forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const tableName = 'EUSW';
      const rowIndex = parseInt(button.getAttribute('data-row'), 10);
      handleModalAction(event, IRData, rowIndex, tableName, "edit");
    });
  });

  // ============= 5) Chart rendern =============
  renderIRLineChart(IRData);
}

/**
 * Reiner Chart-Renderer für IRLineChart
 * – kann aus renderAllChartsNow, Lazy-Panels etc. aufgerufen werden.
 */
export function renderIRLineChart(optionalIRData) {
  const canvasId = "IRLineChart";
  const IRDataContainer = document.getElementById("IRDataContainer");

  // Sicherheit: ohne Container macht der Chart keinen Sinn
  if (!IRDataContainer) {
    console.warn("renderIRLineChart: IRDataContainer not found");
    return;
  }

  // Datenquelle: entweder vom Aufrufer, oder selbst geholt
  let IRData = Array.isArray(optionalIRData) ? optionalIRData : null;
  if (!IRData) {
    const res = getIRDataForSelectedCurve();
    IRData = res.IRData;
  }

  if (!IRData || IRData.length === 0) {
    console.log("⏳ renderIRLineChart waiting for data – skipping");
    return;
  }

  // Alten Chart killen
  if (appState._IRLineChart) {
    appState._IRLineChart.destroy();
    appState._IRLineChart = null;
  }

  // Versuch 1: aus der Tabelle lesen (falls vorhanden)
  const table = IRDataContainer.querySelector('#dataTable');
  let ratesDataset = {
    label: "RATES",
    data: [],
    fill: false,
    tension: 0.1,
  };

  if (table) {
    const rows = Array.from(table.rows);
    let yearIndex = -1;
    let ratesIndex = -1;

    rows.forEach((row, index) => {
      if (index === 0) {
        const headers = Array.from(row.cells).map(c => c.textContent.trim());
        yearIndex  = headers.indexOf("YEAR");
        ratesIndex = headers.indexOf("RATES");
        return;
      }
      const rowData = Array.from(row.cells).map(c => c.textContent.trim());
      if (yearIndex >= 0 && ratesIndex >= 0) {
        ratesDataset.data.push({
          x: rowData[yearIndex],
          y: parseFloat(rowData[ratesIndex]),
        });
      }
    });
  } else {
    // Fallback: direkt aus IRData (falls kein Table vorhanden)
    ratesDataset.data = IRData.map(r => ({
      x: r.YEAR,
      y: parseFloat(r.RATES),
    }));
  }

  // Chart nur zeichnen, wenn wir wirklich Punkte haben
  if (!ratesDataset.data.length) {
    console.warn("renderIRLineChart: no data points for chart");
    return;
  }

  appState._IRLineChart = createRatesLineChart(
    [ratesDataset],
    canvasId,
    "Interest Rates",
    3
  );
}




// import processData from '../../../modal_HELPER/dataProcessor.js';
// //import createFWDLineChart from './charts/LineChart.js';
// import { createRatesLineChart } from '../../../charts/LineChart.js';
// import { handleFormAction } from '../../../modal_HELPER/FormButtonHandler.js';


// let IRLineChart;

// Function to handle the IR data
// export function handleIRData(receivedData) {
//   const IRData = receivedData;
//   //console.log('EUSW:', receivedData);
//   // console.log('Received prodData callback called.');
//   // console.log('Received prodData callback called.');
//   // console.log('Received prodData callback called.');
//   if (IRDataContainer && IRData) {
//     const IRDataHTML = processData(IRData);
//     IRDataContainer.innerHTML = IRDataHTML;
//   }

//   // Edit Buttons
//   const IREditButtons = document.querySelectorAll('#IRDataContainer .edit-button');
//   IREditButtons.forEach((button) => {
//     button.addEventListener('click', (event) => {
//       event.stopPropagation(); // Stop event propagation
//       const tableName = 'EUSW';
//       const actionType = 'edit';
//       const rowIndex = parseInt(button.getAttribute('data-row'), 10);
//       handleFormAction(event, IRData, rowIndex, tableName, actionType);
//     });
//   });

//   // Destroy the existing IR line chart before creating a new one
//   if (IRLineChart) {IRLineChart.destroy();}

//   //GRAPH
//   // Retrieve the data from the IRDataContainer
//   const table = IRDataContainer.querySelector('#dataTable');
//   const rows = Array.from(table.rows);
//   //const headers = Array.from(rows.shift().cells).map((cell) => cell.textContent.trim());

//   // Get the RATES dataset
//   const ratesDataset = {
//     label: 'RATES',
//     data: [],
//     fill: false,
//     borderColor: 'rgba(75, 192, 192, 1)',
//     tension: 0.1,
//   };

//   let yearIndex = -1;
//   let ratesIndex = -1;
  
//   rows.forEach((row, index) => {
//     if (index === 0) {
//       // Find column indexes dynamically using the header row
//       const headers = Array.from(row.cells).map(cell => cell.textContent.trim());
//       yearIndex = headers.indexOf('YEAR');
//       ratesIndex = headers.indexOf('RATES');
  
//       if (yearIndex === -1 || ratesIndex === -1) {
//         console.error("Error: 'YEAR' or 'RATES' column not found in table.");
//         return;
//       }
//       return; // Skip the header row
//     }
  
//     // Extract data dynamically based on column names
//     const rowData = Array.from(row.cells).map(cell => cell.textContent.trim());
//     const xValue = rowData[yearIndex];  // Get YEAR value
//     const rateValue = parseFloat(rowData[ratesIndex]); // Get RATES value
  
//     ratesDataset.data.push({ x: xValue, y: rateValue });
//   });
  
  

//   // Create the IR line chart using the RATES dataset
//   IRLineChart = createRatesLineChart([ratesDataset], 'IRLineChart', 'Interest Rates', 3);
// }


// Hier wird nur mehr der chart gemacht (render)!
// export function renderIRPanel() {
//   const IRData = appState?.getEUSWData?.() || [];
//   const IRDataContainer = document.getElementById("IRDataContainer");
//   if (!IRDataContainer) return;

//   // 1) Table rendern
//   if (IRData && IRData.length) {
//     IRDataContainer.innerHTML = processData(IRData);
//   } else {
//     IRDataContainer.innerHTML = `<div style="opacity:.7">No IR data loaded.</div>`;
//     return;
//   }

//   // 2) Edit-Buttons binden
//   const IREditButtons = document.querySelectorAll('#IRDataContainer .edit-button');
//   IREditButtons.forEach((button) => {
//     button.addEventListener('click', (event) => {
//       event.stopPropagation();
//       const tableName = 'EUSW';
//       const actionType = 'edit';
//       const rowIndex = parseInt(button.getAttribute('data-row'), 10);
//       handleFormAction(event, IRData, rowIndex, tableName, actionType);
//     });
//   });

//   // 3) Alten Chart zerstören
//   if (IRLineChart) IRLineChart.destroy();

//   // 4) Dataset aus Table bauen (wie bisher)
//   const table = IRDataContainer.querySelector('#dataTable');
//   if (!table) return;

//   const rows = Array.from(table.rows);

//   const ratesDataset = { label: "RATES", data: [], fill: false, tension: 0.1 };

//   let yearIndex = -1;
//   let ratesIndex = -1;

//   rows.forEach((row, index) => {
//     if (index === 0) {
//       const headers = Array.from(row.cells).map(c => c.textContent.trim());
//       yearIndex = headers.indexOf("YEAR");
//       ratesIndex = headers.indexOf("RATES");
//       return;
//     }
//     const rowData = Array.from(row.cells).map(c => c.textContent.trim());
//     ratesDataset.data.push({
//       x: rowData[yearIndex],
//       y: parseFloat(rowData[ratesIndex])
//     });
//   });

//   // 5) Chart erstellen
//   IRLineChart = createRatesLineChart([ratesDataset], "IRLineChart", "Interest Rates", 3);
// }

// IR.js

// renderIRPanel.js
// import processData from '../../../modal_HELPER/dataProcessor.js';
// import { createRatesLineChart } from '../../../charts/LineChart.js';
// import { handleFormAction } from '../../../modal_HELPER/FormButtonHandler.js';

// export function renderIRPanel() {
//   const IRDataContainer = document.getElementById("IRDataContainer");
//   const ratesSelector   = document.getElementById("ratesSelector");
//   if (!IRDataContainer || !ratesSelector) return;

//   // ============= 0) Daten vorhanden? =============
//   const raw = (typeof appState.getEUSWData === "function")
//     ? appState.getEUSWData()
//     : [];

// if (!raw || raw.length === 0) {
//     console.log("⏳ IRPanel waiting for data – skipping render");
//     return;    // NICHTS überschreiben!
// }


//   // ============= 1) Selector state sync =============
//   const storedCurve =
//     (typeof appState.getSelectedCurve === "function" && appState.getSelectedCurve()) ||
//     "EUSWAP";

//   if (ratesSelector.value !== storedCurve) {
//     ratesSelector.value = storedCurve;
//   }

//   // ============= 2) Daten mit gewählter Curve erzeugen =============
//   const IRData = raw.map(row => {
//     const r = { ...row };
//     const curve = storedCurve;
//     if (curve in r) r.RATES = r[curve];  // zentrale Logik
//     return r;
//   });

//   console.log("🔵 IRData used:", IRData);

//   // ============= 3) Table rendern =============
//   IRDataContainer.innerHTML = processData(IRData);

//   // ============= 4) Edit-Buttons binden =============
//   const IREditButtons = document.querySelectorAll('#IRDataContainer .edit-button');
//   IREditButtons.forEach((button) => {
//     button.addEventListener('click', (event) => {
//       event.stopPropagation();
//       const tableName = 'EUSW';
//       const rowIndex = parseInt(button.getAttribute('data-row'), 10);
//       handleFormAction(event, IRData, rowIndex, tableName, "edit");
//     });
//   });

//   // ============= 5) Alten Chart killen =============
//   if (appState._IRLineChart) {
//     appState._IRLineChart.destroy();
//     appState._IRLineChart = null;
//   }

//   // ============= 6) Chart-Dataset =============
//   const table = IRDataContainer.querySelector('#dataTable');
//   if (!table) return;

//   const rows = Array.from(table.rows);
//   const ratesDataset = { label: "RATES", data: [], fill: false, tension: 0.1 };

//   let yearIndex = -1;
//   let ratesIndex = -1;

//   rows.forEach((row, index) => {
//     if (index === 0) {
//       const headers = Array.from(row.cells).map(c => c.textContent.trim());
//       yearIndex  = headers.indexOf("YEAR");
//       ratesIndex = headers.indexOf("RATES");
//       return;
//     }
//     const rowData = Array.from(row.cells).map(c => c.textContent.trim());
//     ratesDataset.data.push({
//       x: rowData[yearIndex],
//       y: parseFloat(rowData[ratesIndex])
//     });
//   });

//   // ============= 7) Chart rendern =============
//   appState._IRLineChart = createRatesLineChart(
//     [ratesDataset],
//     "IRLineChart",
//     "Interest Rates",
//     3
//   );
// }
