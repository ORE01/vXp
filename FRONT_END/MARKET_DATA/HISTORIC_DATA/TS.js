import processData from '../../../modal_HELPER/dataProcessor.js';
import createLineChart from '../../../charts/LineChart.js';
import { calculateSMA, calculateRSI } from './ChartAnalyses.js';
//import { normalizeDataset } from './charts/LineChart.js';

// Store chart instances in an object with modalIndex as key
const chartInstances = {};



        // export function handleTSData(receivedData, modalIndex) {
        //   //console.log('receivedData', receivedData);
        //   appState.setTblTSData(receivedData);

        //   const checkboxContainer = document.getElementById(`checkboxContainer_${modalIndex}`);
        //   const targetCheckboxContainer = document.getElementById('targetCheckboxContainer'); // Single target container
        //   const loadButton = document.getElementById(`loadButton_${modalIndex}`);
        //   const TSData = receivedData;

        //   if (TSData && checkboxContainer && targetCheckboxContainer && loadButton) {
        //     // Process the TSData but do not display it yet
        //     const TSDataHTML = processData(TSData, 'tblTS');
        //     const tempDiv = document.createElement('div');
        //     tempDiv.innerHTML = TSDataHTML;

        //     // Retrieve the table rows and headers without displaying them
        //     const table = tempDiv.querySelector('#dataTable');
        //     const rows = Array.from(table.rows);
        //     const headers = Array.from(rows.shift().cells).map((cell) => cell.textContent.trim());

        //     // Clear the checkboxes
        //     checkboxContainer.innerHTML = '';
        //     targetCheckboxContainer.innerHTML = '';

        //     // Define default selected checkboxes for each modalIndex
        //     const defaultCheckedIndices = {
        //       1: [0, 1], // For modal 1, select dataset 0 and 1
        //       2: [7, 8], // For modal 2, select dataset 8 and 9
        //       3: [17],
        //       4: [15],    // For modal 3, select dataset 17
        //     };

        //     // Create the checkboxes for the dataset selection
        //     const checkboxes = headers.slice(1).map((header, index) => {
        //       const checkbox = document.createElement('input');
        //       checkbox.type = 'checkbox';
        //       checkbox.id = `checkbox-${modalIndex}-${index}`;
        //       checkbox.value = header;

        //       // Preselect the checkboxes based on defaultCheckedIndices
        //       checkbox.checked = defaultCheckedIndices[modalIndex]?.includes(index) || false;

        //       checkboxContainer.appendChild(checkbox);

        //       const label = document.createElement('label');
        //       label.htmlFor = checkbox.id;
        //       label.textContent = header;
        //       checkboxContainer.appendChild(label);
        //       checkboxContainer.appendChild(document.createElement('br'));

        //       return checkbox;
        //     });

        //     // Create the checkboxes for the target selection
        //     headers.slice(1).forEach((header, index) => {
        //       const targetCheckbox = document.createElement('input');
        //       targetCheckbox.type = 'checkbox';
        //       targetCheckbox.id = `target-checkbox-${index}`;
        //       targetCheckbox.value = header;

        //       targetCheckboxContainer.appendChild(targetCheckbox);

        //       const label = document.createElement('label');
        //       label.htmlFor = targetCheckbox.id;
        //       label.textContent = header;
        //       targetCheckboxContainer.appendChild(label);
        //       targetCheckboxContainer.appendChild(document.createElement('br'));

        //       // Add event listener to ensure only one target checkbox is selected at a time
        //       targetCheckbox.addEventListener('change', (event) => {
        //         if (event.target.checked) {
        //           // Uncheck all other checkboxes
        //           const targetCheckboxes = targetCheckboxContainer.querySelectorAll('input[type="checkbox"]');
        //           targetCheckboxes.forEach((cb) => {
        //             if (cb !== event.target) cb.checked = false;
        //           });

        //           console.log(`Selected Target: ${event.target.value}`);
        //         }
        //       });
        //     });

        //     // Ensure that the LoadData button manually loads the selected datasets
        //     loadButton.replaceWith(loadButton.cloneNode(true)); // Remove previous event listeners
        //     const newLoadButton = document.getElementById(`loadButton_${modalIndex}`);

        //     newLoadButton.onclick = () => {
        //       const chartContainer = document.querySelector(`#TSlineChart_${modalIndex}`).parentElement;
        //       const mainTableContainer = document.getElementById(`TSDataContainer_${modalIndex}`);
        //       console.log(mainTableContainer); // Check if this logs the correct container.

        //       if (chartContainer && mainTableContainer) {
        //         chartContainer.style.display = 'block'; // Show the chart
        //         mainTableContainer.style.display = 'none'; // Hide the table
        //       } else {
        //         console.error('Chart or Table container not found');
        //       }

        //       // Manually load and display the selected datasets
        //       refreshTableAndChart(rows, headers, checkboxes, modalIndex);
        //     };

        //     loadButton.style.display = 'block'; // Ensure the load button is visible
        //   }
        // }

        // ===== Renderer-Helper: Customer-ID aus appState =====
        function getCurrentCustomerId() {
          // Variante A: knallhart testen
          return 1;
        }

        function waitForCustomerTSData(timeoutMs = 5000) {
          // sofort da?
          const existing = window.appState?.getCustomerTSData?.();
          if (existing !== undefined && existing !== null) return Promise.resolve(existing);
          if (window.__tsSelectionsReady) return Promise.resolve(window.appState?.getCustomerTSData?.());

          return new Promise((resolve) => {
            let done = false;
            const finish = (val) => { if (!done) { done = true; resolve(val); } };

            const t = setTimeout(() => finish(undefined), timeoutMs);

            // auf unser Custom-Event warten
            const onReady = () => {
              clearTimeout(t);
              window.removeEventListener('ts-selections-ready', onReady);
              finish(window.appState?.getCustomerTSData?.());
            };
            window.addEventListener('ts-selections-ready', onReady, { once: true });
          });
        }

        function parseSelectionUnknown(sel) {
          if (sel == null) return [];
          if (Array.isArray(sel)) return sel;
          if (typeof sel === 'string') {
            try { const p = JSON.parse(sel); return Array.isArray(p) ? p : []; } catch { return []; }
          }
          return [];
        }

// ===== Renderer-Helper: TS-Auswahl aus DB/appState laden =====
// ===== Renderer-Helper: TS-Auswahl aus DB/appState laden =====
async function loadTSSelectionFromDB(modalIndex, headers) {
  const customer_id = getCurrentCustomerId();
  const seriesNames = (headers || []).slice(1);

  let appRows = window.appState?.getCustomerTSData?.();
  if (appRows === undefined || appRows === null) {
    appRows = await waitForCustomerTSData(5000);
  }
  if (!Array.isArray(appRows)) {
    return {
      indices: [],
      normalization_type: 'none',
      show_daily_volatility: 0,
      apply_sma1: 0, sma1_period: 20,
      apply_sma2: 0, sma2_period: 50,
      apply_sma3: 0, sma3_period: 200,
    };
  }

  const row = appRows.find(r =>
    Number(r?.customer_id) === Number(customer_id) &&
    Number(r?.ts_modal_index) === Number(modalIndex) &&
    (r?.ts_key || 'ts_selected') === 'ts_selected'
  );

  if (!row) {
    return {
      indices: [],
      normalization_type: 'none',
      show_daily_volatility: 0,
      apply_sma1: 0, sma1_period: 20,
      apply_sma2: 0, sma2_period: 50,
      apply_sma3: 0, sma3_period: 200,
    };
  }

  // Indizes/Labels parsen
  const raw = parseSelectionUnknown(row.ts_selection ?? row.indices ?? row.labels);
  const indices = (raw.length && typeof raw[0] === 'string')
    ? raw.map(lbl => seriesNames.indexOf(lbl)).filter(i => i >= 0)
    : raw.map(n => Number(n)).filter(n => Number.isInteger(n) && n >= 0 && n < seriesNames.length);

  // <-- WICHTIG: Normalization + Volatility + SMA zurückgeben
  return {
    indices,
    normalization_type: (row.normalization_type ?? 'none').toString(),
    show_daily_volatility: Number(row.show_daily_volatility ?? 0),

    apply_sma1: Number(row.apply_sma1 ?? 0),
    sma1_period: Number(row.sma1_period ?? 20),

    apply_sma2: Number(row.apply_sma2 ?? 0),
    sma2_period: Number(row.sma2_period ?? 50),

    apply_sma3: Number(row.apply_sma3 ?? 0),
    sma3_period: Number(row.sma3_period ?? 200),
  };
}






// ===== Renderer-Helper: TS-Auswahl in DB speichern =====
// Speichert sowohl indices als auch labels (robust gegen Main-Implementierung).
function saveTSSelectionToDB(modalIndex, headers, checkboxes) {
  const customer_id = 1; // dein Test
  if (!customer_id) return Promise.resolve();

  const seriesNames = (headers || []).slice(1);
  const indices = [];
  checkboxes.forEach((cb, i) => { if (cb.checked) indices.push(i); });

  // UI lesen
  const normalization_type = document.getElementById(`normalizationTypeSelector_${modalIndex}`)?.value || 'none';
  const show_daily_volatility = document.getElementById(`showDailyVolatility_${modalIndex}`)?.checked ? 1 : 0;

  const apply_sma1 = document.getElementById(`applySMA1_${modalIndex}`)?.checked ? 1 : 0;
  const sma1_period = parseInt(document.getElementById(`movingAveragePeriod1_${modalIndex}`)?.value,10) || 20;

  const apply_sma2 = document.getElementById(`applySMA2_${modalIndex}`)?.checked ? 1 : 0;
  const sma2_period = parseInt(document.getElementById(`movingAveragePeriod2_${modalIndex}`)?.value,10) || 50;

  const apply_sma3 = document.getElementById(`applySMA3_${modalIndex}`)?.checked ? 1 : 0;
  const sma3_period = parseInt(document.getElementById(`movingAveragePeriod3_${modalIndex}`)?.value,10) || 200;

  return new Promise((resolve) => {
    const requestId = `save_${modalIndex}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    window.api.once(`ts-selection:save-success:${requestId}`, () => resolve());
    window.api.once(`ts-selection:save-error:${requestId}`, (_e, msg) => { console.warn(msg); resolve(); });

    window.api.send('ts-selection:save', {
      requestId, customer_id, ts_modal_index: modalIndex, ts_key: 'ts_selected',
      indices,
      normalization_type,
      show_daily_volatility,
      apply_sma1, sma1_period,
      apply_sma2, sma2_period,
      apply_sma3, sma3_period,
    });
  });
}



// ===== Deine Funktion: jetzt mit Persistenz (async wegen Lade-Prozess) =====
export async function handleTSData(receivedData, modalIndex) {
  // 1) State & DOM
  appState.setTblTSData(receivedData);

  const checkboxContainer       = document.getElementById(`checkboxContainer_${modalIndex}`);
  const targetCheckboxContainer = document.getElementById('targetCheckboxContainer');
  const loadButton              = document.getElementById(`loadButton_${modalIndex}`);
  const TSData                  = receivedData;

  if (!(TSData && checkboxContainer && targetCheckboxContainer && loadButton)) return;

  // 2) Hidden-Table bauen, Headers/Rows
  const TSDataHTML = processData(TSData, 'tblTS');
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = TSDataHTML;

  const table   = tempDiv.querySelector('#dataTable');
  const rows    = Array.from(table.rows);
  const headers = Array.from(rows.shift().cells).map((c) => c.textContent.trim());

  // 3) UI-Container leeren
  checkboxContainer.innerHTML = '';
  targetCheckboxContainer.innerHTML = '';

  // 4) Defaults, wenn nichts gespeichert
  const defaultCheckedIndices = { 1:[0,1], 2:[7,8], 3:[17], 4:[15] };

  // 5) Gespeicherte Auswahl + Settings laden
  const saved = await loadTSSelectionFromDB(modalIndex, headers) || {};
  const savedIndices = Array.isArray(saved.indices) ? saved.indices : [];

  // 6) Controls referenzieren
  const selNormalization = document.getElementById(`normalizationTypeSelector_${modalIndex}`);
  const chkVolatility    = document.getElementById(`showDailyVolatility_${modalIndex}`);

  const chkSMA1 = document.getElementById(`applySMA1_${modalIndex}`);
  const perSMA1 = document.getElementById(`movingAveragePeriod1_${modalIndex}`);
  const chkSMA2 = document.getElementById(`applySMA2_${modalIndex}`);
  const perSMA2 = document.getElementById(`movingAveragePeriod2_${modalIndex}`);
  const chkSMA3 = document.getElementById(`applySMA3_${modalIndex}`);
  const perSMA3 = document.getElementById(`movingAveragePeriod3_${modalIndex}`);

  // 7) Gespeicherte Settings → UI
  if (selNormalization) selNormalization.value = saved.normalization_type ?? 'none';
  if (chkVolatility)    chkVolatility.checked  = !!saved.show_daily_volatility;

  if (chkSMA1) chkSMA1.checked = !!saved.apply_sma1;
  if (perSMA1) perSMA1.value   = saved.sma1_period ?? 20;

  if (chkSMA2) chkSMA2.checked = !!saved.apply_sma2;
  if (perSMA2) perSMA2.value   = saved.sma2_period ?? 50;

  if (chkSMA3) chkSMA3.checked = !!saved.apply_sma3;
  if (perSMA3) perSMA3.value   = saved.sma3_period ?? 200;

  // 8) Daten-Checkboxen erstellen
  const checkboxes = headers.slice(1).map((header, index) => {
    const cb = document.createElement('input');
    cb.type  = 'checkbox';
    cb.id    = `checkbox-${modalIndex}-${index}`;
    cb.value = header;

    const isSaved   = savedIndices.includes(index);
    const isDefault = defaultCheckedIndices[modalIndex]?.includes(index) || false;
    cb.checked = isSaved || (!savedIndices.length && isDefault);

    checkboxContainer.appendChild(cb);
    const label = document.createElement('label');
    label.htmlFor = cb.id; label.textContent = header;
    checkboxContainer.appendChild(label);
    checkboxContainer.appendChild(document.createElement('br'));
    return cb;
  });

  // 9) Target-Checkboxen (exklusiv)
  headers.slice(1).forEach((header, index) => {
    const tcb = document.createElement('input');
    tcb.type = 'checkbox';
    tcb.id   = `target-checkbox-${index}`;
    tcb.value = header;

    targetCheckboxContainer.appendChild(tcb);
    const label = document.createElement('label');
    label.htmlFor = tcb.id; label.textContent = header;
    targetCheckboxContainer.appendChild(label);
    targetCheckboxContainer.appendChild(document.createElement('br'));

    tcb.addEventListener('change', (e) => {
      if (e.target.checked) {
        const all = targetCheckboxContainer.querySelectorAll('input[type="checkbox"]');
        all.forEach(cb => { if (cb !== e.target) cb.checked = false; });
      }
    });
  });

  // 10) Persist (Indices + Settings)
  const persistNow = () => saveTSSelectionToDB(modalIndex, headers, checkboxes);

  // 11) Live speichern bei Änderungen
  checkboxes.forEach(cb => cb.addEventListener('change', persistNow));
  if (selNormalization) selNormalization.addEventListener('change', persistNow);
  if (chkVolatility)    chkVolatility.addEventListener('change', persistNow);

  [chkSMA1, chkSMA2, chkSMA3].forEach(el => el && el.addEventListener('change', persistNow));
  [perSMA1, perSMA2, perSMA3].forEach(el => el && el.addEventListener('input', persistNow));

  // 12) Load-Button neu binden
  loadButton.replaceWith(loadButton.cloneNode(true));
  const newLoadButton = document.getElementById(`loadButton_${modalIndex}`);
  newLoadButton.onclick = async () => {
    await persistNow(); // vor Rendern speichern
    const chartContainer = document.querySelector(`#TSlineChart_${modalIndex}`).parentElement;
    const mainTableContainer = document.getElementById(`TSDataContainer_${modalIndex}`);
    if (chartContainer && mainTableContainer) {
      chartContainer.style.display = 'block';
      mainTableContainer.style.display = 'none';
    }
    refreshTableAndChart(rows, headers, checkboxes, modalIndex);
  };

  loadButton.style.display = 'block';
}






    function refreshTableAndChart(rows, headers, checkboxes, modalIndex, containerId = 'modal-content-container') {
      const normalizationTypeSelector = document.getElementById(`normalizationTypeSelector_${modalIndex}`);
      const normalizationType = normalizationTypeSelector ? normalizationTypeSelector.value : 'none';
      const showDailyVolatility = document.getElementById(`showDailyVolatility_${modalIndex}`)?.checked ?? false;

      // ✅ Get moving averages only for TS modals
      let movingAverages = { period1: null, period2: null, period3: null };
      if (containerId === 'modal-content-container') {
        try {
          movingAverages = getMovingAverages(modalIndex); // Use getMovingAverages function instead of duplicating logic
          console.log(`🎉 Moving Averages Retrieved:`, movingAverages);
        } catch (error) {
          console.warn(`❌ Failed to retrieve moving averages for modalIndex ${modalIndex}:`, error);
        }
      } else {
        console.log(`Skipping Moving Averages for modal ${modalIndex} (container: ${containerId})`);
      }

      console.log('Normalization type selected:', normalizationType);

      const selectedDatasets = checkboxes
        .map((checkbox, index) => checkbox.checked ? {
          label: headers[index + 1], // Add +1 to skip the date column
          data: [],
          index: index + 1 // Save the index to match with the table columns
        } : null)
        .filter(Boolean);

      if (selectedDatasets.length === 0) {
        console.warn('⚠️ No datasets selected. Skipping chart update.');
        return;
      }

      selectedDatasets.forEach((dataset) => {
        dataset.data = [];

        rows.slice(1).forEach((row) => {
          const rowData = Array.from(row.cells).map((cell) => cell.textContent.trim());
          const xValue = rowData[0];
          const yValue = parseFloat(rowData[dataset.index]);

          dataset.data.push({
            x: xValue,
            y: isNaN(yValue) ? null : yValue,
            originalY: isNaN(yValue) ? null : yValue
          });
        });

        console.log(`Dataset before normalization [${dataset.label}]:`, dataset.data);

        applyNormalization(dataset, normalizationType);
        
        if (containerId === 'modal-content-container') {
          try {
            applyMovingAverages(dataset, movingAverages);
          } catch (error) {
            console.warn(`❌ Failed to apply moving averages for modalIndex ${modalIndex}:`, error);
          }
        }

        if (showDailyVolatility) {
          applyDailyVolatility(dataset);
        }
      });

      if (chartInstances[modalIndex]) {
        chartInstances[modalIndex].destroy();
      }

      console.log("Parsed data with normalization type:", normalizationType, selectedDatasets);

      chartInstances[modalIndex] = createLineChart(
        selectedDatasets, 
        `TSlineChart_${modalIndex}`, 
        'Timeseries', 
        0, 
        modalIndex, 
        { 
          sma1: movingAverages?.period1, 
          sma2: movingAverages?.period2, 
          sma3: movingAverages?.period3 
        }  
      );
    }

    // MAs
    function getMovingAverages(modalIndex) {
      return {
        applySMA1: document.getElementById(`applySMA1_${modalIndex}`)?.checked ?? false, 
        applySMA2: document.getElementById(`applySMA2_${modalIndex}`)?.checked ?? false, 
        applySMA3: document.getElementById(`applySMA3_${modalIndex}`)?.checked ?? false, 
        period1: parseInt(document.getElementById(`movingAveragePeriod1_${modalIndex}`)?.value, 10) || 20, 
        period2: parseInt(document.getElementById(`movingAveragePeriod2_${modalIndex}`)?.value, 10) || 50, 
        period3: parseInt(document.getElementById(`movingAveragePeriod3_${modalIndex}`)?.value, 10) || 200 
      };
    }

    function applyMovingAverages(dataset, movingAverages) {
      if (movingAverages.applySMA1) {
        const sma1 = calculateSMA(dataset.data, movingAverages.period1);
        if (sma1 && sma1.length > 0) {
          dataset.smaData1 = dataset.data.map((point, idx) => ({
            x: point.x,
            y: sma1[idx]
          }));
          console.log(`Calculated SMA 20 for dataset [${dataset.label}]:`, dataset.smaData1);
        } else {
          console.error(`Error calculating SMA 20 for dataset [${dataset.label}]`);
        }
      }
      
      if (movingAverages.applySMA2) {
        const sma2 = calculateSMA(dataset.data, movingAverages.period2);
        if (sma2 && sma2.length > 0) {
          dataset.smaData2 = dataset.data.map((point, idx) => ({
            x: point.x,
            y: sma2[idx]
          }));
          console.log(`Calculated SMA 50 for dataset [${dataset.label}]`, dataset.smaData2);
        } else {
          console.error(`Error calculating SMA 50 for dataset [${dataset.label}]`);
        }
      }

      if (movingAverages.applySMA3) {
        const sma3 = calculateSMA(dataset.data, movingAverages.period3);
        if (sma3 && sma3.length > 0) {
          dataset.smaData3 = dataset.data.map((point, idx) => ({
            x: point.x,
            y: sma3[idx]
          }));
          console.log(`Calculated SMA 200 for dataset [${dataset.label}]`, dataset.smaData3);
        } else {
          console.error(`Error calculating SMA 200 for dataset [${dataset.label}]`);
        }
      }
    }
    // NORMALIZATION
    function applyNormalization(dataset, normalizationType) {
      switch (normalizationType) {
        case 'dynamic':
          if (typeof dynamicNormalization === 'function') {
            dataset.data = dynamicNormalization(dataset).data;  
            console.log('Applied dynamicNormalization:', dataset.data);
          } else {
            console.error('dynamicNormalization function is not defined.');
          }
          break;
        case 'normalize':
          if (typeof normalizeDataset === 'function') {
            dataset.data = normalizeDataset(dataset).data;  
            console.log('Applied normalizeDataset:', dataset.data);
          } else {
            console.error('normalizeDataset function is not defined.');
          }
          break;
        case 'none':
        default:
          console.log(`Using original data for dataset [${dataset.label}]`);
          break;
      }
    }

    function normalizeDataset(dataset) {
        console.log("Before normalizeDataset:", dataset.data);
      
        // Find the first non-NaN and non-null value for normalization
        const firstValidIndex = dataset.data.findIndex(({ y }) => y !== null && !isNaN(y));
      
        // If no valid data points, return the dataset as-is
        if (firstValidIndex === -1) {
          console.warn("No valid data found for normalization.");
          return dataset;
        }
      
        const startingValue = dataset.data[firstValidIndex].y;
      
        // If the starting value is 0, return the dataset as-is
        if (startingValue === 0) {
          console.warn("Starting value for normalization is 0, skipping normalization.");
          return dataset;
        }
      
        // Normalize the data based on the first valid value
        const normalizedData = dataset.data.map(({ x, y, originalY }) => ({
          x,
          y: y !== null && !isNaN(y) ? (y / startingValue) * 100 : null, // Normalize to 100
          originalY // Preserve original value
        }));
      
        console.log("After normalizeDataset:", normalizedData);
      
        // Return a new dataset with normalized data
        return { ...dataset, data: normalizedData };
    }
      
    function dynamicNormalization(dataset) {
        console.log("Before dynamicNormalization:", dataset.data);
        const validData = dataset.data.filter(({ y }) => y !== null && !isNaN(y));
        const minValue = Math.min(...validData.map(({ y }) => y));
        const maxValue = Math.max(...validData.map(({ y }) => y));

        if (minValue === maxValue) {
            return dataset.data.map(({ x, y, originalY }) => ({ x, y, originalY }));
        }

        const normalizedData = dataset.data.map(({ x, y, originalY }) => ({
            x,
            y: y !== null && !isNaN(y) ? ((y - minValue) / (maxValue - minValue)) * 100 : null,
            originalY // Preserve original
        }));

        console.log("After dynamicNormalization:", normalizedData);
        return { ...dataset, data: normalizedData };
    }

    // DAILY VOL
    function applyDailyVolatility(dataset) {
      dataset.data = dataset.data.map((point, idx, array) => {
        if (idx === 0) return { x: point.x, y: null }; // No previous day to compare to
        const previousPoint = array[idx - 1].y;
        const currentPoint = point.y;
        const volatility = (previousPoint && currentPoint) ? ((currentPoint - previousPoint) / previousPoint) * 100 : null; // Calculate relative change in percentage
        return { x: point.x, y: volatility };
      });
      console.log(`Calculated daily volatility for dataset [${dataset.label}]`, dataset.data);
    }


// TIMESERIES:Modal Hier wird die Anzahl bestimmt!
export function createTSModals(data) {
  const modalContentContainer = document.getElementById('modal-content-container');
  if (!modalContentContainer) {
    console.error('modal-content-container not found in the DOM.');
    return;
  }

  // Clear existing modals
  modalContentContainer.innerHTML = '';

  // Add new modals
  const sectionCount = 4;
  for (let i = 1; i <= sectionCount; i++) {
    insertModal(i, data);
  }
}

function insertModal(modalIndex, receivedData) {
  const template = document.getElementById('TS_Modal_Template');
  if (!template) {
    console.error('Template not found');
    return;
  }

  const clone = document.importNode(template.content, true);

  // Assign unique IDs to the cloned elements (nur Indizes ergänzt)
  const elementsToUpdate = [
    // Root hilft beim Scoping pro Instanz
    { selector: '.table-content', id: `tsRoot_${modalIndex}` },

    // ✅ Toolbox & Toggle mit Index
    { selector: '#tsTools', id: `tsTools_${modalIndex}` },
    { selector: '#tsToolsToggle', id: `tsToolsToggle_${modalIndex}` },

    { selector: '#checkboxContainer', id: `checkboxContainer_${modalIndex}` },
    { selector: '#loadButton', id: `loadButton_${modalIndex}` },
    { selector: '#TSDataContainer', id: `TSDataContainer_${modalIndex}` },
    { selector: '#TSlineChart', id: `TSlineChart_${modalIndex}` },
    { selector: '#oneYearButton', id: `oneYearButton_${modalIndex}` },
    { selector: '#fiveYearButton', id: `fiveYearButton_${modalIndex}` },
    { selector: '#tenYearButton', id: `tenYearButton_${modalIndex}` },
    { selector: '#maxButton', id: `maxButton_${modalIndex}` },
    { selector: '#normalizationTypeSelector', id: `normalizationTypeSelector_${modalIndex}` },
    { selector: '#applySMA1', id: `applySMA1_${modalIndex}` },
    { selector: '#movingAveragePeriod1', id: `movingAveragePeriod1_${modalIndex}` },
    { selector: '#applySMA2', id: `applySMA2_${modalIndex}` },
    { selector: '#movingAveragePeriod2', id: `movingAveragePeriod2_${modalIndex}` },
    { selector: '#applySMA3', id: `applySMA3_${modalIndex}` },
    { selector: '#movingAveragePeriod3', id: `movingAveragePeriod3_${modalIndex}` }
  ];

  elementsToUpdate.forEach(({ selector, id }) => {
    const element = clone.querySelector(selector);
    if (element) {
      element.id = id;
    } else {
      console.warn(`Element with selector '${selector}' not found in the template.`);
    }
  });

  // Append the cloned modal to the modal-content-container inside TS_Modal
  const modalContentContainer = document.getElementById('modal-content-container');
  if (modalContentContainer) {
    modalContentContainer.appendChild(clone);
  } else {
    console.error('modal-content-container not found in the DOM.');
    return;
  }

  // Call handleTSData for this modal and pass the modal index and received data
  handleTSData(receivedData, modalIndex);
}


// ---- TS Tools Toggle (Historic Data) -------------------------------
const TS_TOOLS_STATE_KEY = 'tsToolsCollapsed';

// Header mit Tools-Button einfügen, falls nicht vorhanden
function ensureTsToolsHeader() {
  // In deinem Template ist der Header schon drin.
  // Falls du ältere Strukturen hast, hier nur minimaler Guard:
  const panel = document.getElementById('panel-ts');
  if (!panel) return;
  const anyHeader = panel.querySelector('.ts-tools-header, .tools-header');
  if (anyHeader) return; // nichts einfügen, alles vorhanden
}

// State anwenden (klappen ein/aus) – optionaler root für pro-Instanz Toggle
function applyTsToolsState(collapsed, rootEl) {
  if (rootEl) {
    rootEl.classList.toggle('tools-collapsed', !!collapsed);
    return;
  }
  // Fallback: auf alle tsRoot_* anwenden (kompatibel zu altem Aufruf)
  document
    .querySelectorAll('#panel-ts .table-content')
    .forEach(el => el.classList.toggle('tools-collapsed', !!collapsed));
}

// Click-Delegation für den Toggle (mit Index-Unterstützung)
function wireTsToggle() {
  const root = document.getElementById('panel-ts');
  if (!root || root.__tsToggleWired) return;
  root.__tsToggleWired = true;

  root.addEventListener('click', (e) => {
    // Matcht Buttons wie #tsToolsToggle_1, _2, ...
    const btn = e.target.closest('[id^="tsToolsToggle_"]');
    if (!btn) return;

    const current = !!window.localStorage.getItem(TS_TOOLS_STATE_KEY);
    const next = !current;
    window.localStorage.setItem(TS_TOOLS_STATE_KEY, next ? '1' : '');

    // Nur die betroffene Instanz kollabieren/expandieren:
    const instanceRoot = btn.closest('.table-content');
    applyTsToolsState(next, instanceRoot);
  });
}

export function observePanelTsOpen() {
  const panel = document.getElementById('panel-ts');
  if (!panel) return;

  const run = () => {
    ensureTsToolsHeader();
    wireTsToggle();
    const collapsed = !!window.localStorage.getItem(TS_TOOLS_STATE_KEY);
    // Beim Öffnen den gespeicherten State auf alle Instanzen anwenden
    document.querySelectorAll('#panel-ts .table-content').forEach(rootEl => {
      applyTsToolsState(collapsed, rootEl);
    });
  };

  // Einmal direkt probieren (falls schon offen/gebaut)
  run();

  // Beobachte Attributänderungen (z.B. wenn Slide-in geöffnet wird)
  new MutationObserver((recs) => {
    for (const r of recs) {
      if (r.type === 'attributes' && r.attributeName === 'hidden') {
        if (!panel.hidden) {
          requestAnimationFrame(run);
        }
      }
    }
  }).observe(panel, { attributes: true });
}






export function loadTrendlines(modalIndex, chartName) {
  return new Promise((resolve) => {
    const requestId = `load_${modalIndex}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const okCh  = `ts-trendlines:load-success:${requestId}`;
    const errCh = `ts-trendlines:load-error:${requestId}`;

    console.log(`[TS-TL][LOAD->SEND] req=${requestId} modal_index=${modalIndex} chart_name=${chartName}`);

    // ⬇️ WICHTIG: nur EIN Argument (payload)
    window.api.once(okCh, (payload) => {
      console.log('[TS-TL][LOAD<-RAW]', payload);
      const lines = Array.isArray(payload?.lines) ? payload.lines : [];
      console.log(`[TS-TL][LOAD<-OK] req=${requestId} | lines.count=${lines.length} | sample=${lines.length ? JSON.stringify(lines[0]) : 'null'}`);
      resolve(lines);
    });

    // ⬇️ hier auch nur EIN Argument (msg)
    window.api.once(errCh, (msg) => {
      console.warn(`[TS-TL][LOAD<-ERR] req=${requestId} | ${msg}`);
      resolve([]);
    });

    window.api.send('ts-trendlines:load', {
      requestId,
      customer_id: getCurrentCustomerId(),
      modal_index: Number(modalIndex),
      chart_name: chartName
    });
  });
}






export function saveTrendlines(modalIndex, chartName, lines) {
  return new Promise((resolve) => {
    const requestId = `save_${modalIndex}_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    console.log(
      `[TS-TL][SAVE->SEND] req=%s modal_index=%s chart_name=%s lines.count=%d sample=%o`,
      requestId, Number(modalIndex), chartName, Array.isArray(lines) ? lines.length : -1, lines?.[0] ?? null
    );

    window.api.once(`ts-trendlines:save-success:${requestId}`, () => {
      console.log(`[TS-TL][SAVE<-OK] req=%s`, requestId);
      resolve(true);
    });
    window.api.once(`ts-trendlines:save-error:${requestId}`, (_e, msg) => {
      console.warn(`[TS-TL][SAVE<-ERR] req=%s msg=%s`, requestId, msg);
      resolve(false);
    });

    window.api.send('ts-trendlines:save', {
      requestId,
      customer_id: getCurrentCustomerId(),
      modal_index: Number(modalIndex),
      chart_name: chartName,
      lines: Array.isArray(lines) ? lines : []
    });
  });
}






