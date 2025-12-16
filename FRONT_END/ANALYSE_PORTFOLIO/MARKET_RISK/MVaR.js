import processData from '../../../MODAL_HELPER/dataProcessor.js';
import createBarChart from '../../../charts/BarChart.js';
import { appState } from '../../renderer.js';
import { formatNumber, formatNumberWithCommas } from '../../../utils/format.js';
import { handleModalAction } from '../../../MODAL_HELPER/ModalActionHandler.js';
import { ensureRendered } from '../../../utils/domHelpers.js';
//import { startOfDay } from 'date-fns';

const TABLE_MVAR = 'MVaRInput';
let MVaRChart = null;
export const MVAR_COLUMNS = [
  'INTERVAL_NAME',
  'START',
  'END',
  'VaR_Days',
  'Confidence',
  'red_threshold',
  'yellow_threshold',
];

export function handleMvarInputData(receivedData) {
  const container = document.getElementById('inputMvarContainer');
  while (container.firstChild) container.removeChild(container.firstChild);

  // Nur gewünschte Spalten für die TABELLE aufbereiten – in definierter Reihenfolge
  const tableData = Array.isArray(receivedData)
    ? receivedData.map(row => {
        const newRow = {};
        MVAR_COLUMNS.forEach(col => {
          if (Object.prototype.hasOwnProperty.call(row, col)) {
            newRow[col] = row[col];
          }
        });
        return newRow;
      })
    : receivedData;

  // Tabelle rendern
  container.innerHTML = processData(tableData, TABLE_MVAR);

  // AppState mit ORIGINAL-Daten aktualisieren (wichtig für Edit/Add)
  appState.setMvarInputData(receivedData);

  // Nach DOM-Rendern Buttons & Radios binden
  ensureRendered(async () => {
    const reloadMVar = async () => {
      await fetchAndUpdateMVarDataInputData(TABLE_MVAR);
    };

    // 🔹 ADD-Button
    const mvarAddButton = document.getElementById('mvarAddButton');
    if (mvarAddButton) {
      mvarAddButton.addEventListener('click', (event) => {
        handleModalAction(
          event,
          appState.mvarInputData,
          null,
          TABLE_MVAR,
          'add',
          { modalId: 'editModal', onReload: reloadMVar }
        );
      });
    }

    // 🔹 EDIT-Buttons (pro Zeile)
    const mvarEditButtons = document.querySelectorAll('#inputMvarContainer .edit-button');
    mvarEditButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleModalAction(
          event,
          appState.mvarInputData,
          rowIndex,
          TABLE_MVAR,
          'edit',
          { modalId: 'editModal', onReload: reloadMVar }
        );
      });
    });

    // 🔹 RADIO: Szenario-Auswahl (schreibt id in appState)
    const radios = container.querySelectorAll('input.scenario-radio[name="scenario-select"]');

    radios.forEach((radio) => {
      radio.addEventListener('change', () => {
        if (!radio.checked) return;

        radios.forEach(other => {
          if (other !== radio) other.checked = false;
        });

        const idAttr = radio.getAttribute('data-id');
        const selectedId = idAttr != null ? parseInt(idAttr, 10) : null;

        if (!Number.isNaN(selectedId) && selectedId != null) {
          appState.selectedMvarId = selectedId;
          appState.selectedMvarInterval = radio.getAttribute('data-interval');
        }
      });
    });

    // Initial: Default-Szenario (z.B. STRESSED) in State übernehmen
    const initiallyChecked = container.querySelector('input.scenario-radio[name="scenario-select"]:checked');
    if (initiallyChecked) {
      const idAttr = initiallyChecked.getAttribute('data-id');
      const selectedId = idAttr != null ? parseInt(idAttr, 10) : null;
      if (!Number.isNaN(selectedId) && selectedId != null) {
        appState.selectedMvarId = selectedId;
        appState.selectedMvarInterval = initiallyChecked.getAttribute('data-interval');
      }
    }
  });
}



// String-only IPC wie gehabt
function fetchAndUpdateMVarDataInputData(tableName = TABLE_MVAR) {
  window.api.send('fetch-table-data', tableName);
}


export function handleMVaRData(receivedData, index) {
  const port_name = appState.getSelectedPortTableName();

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

  // console.log('filteredDataMVaR:', filteredData);

  renderMVaRFullTable(filteredData, 'MVaRDataContainer');
  renderMVaRRiskParaContainers(filteredData);
  renderMVaRRelativeTableWithIndex(filteredData, index);
  updateMVaRChart(filteredData);

  // 🔴🟡 Schwellen aus MVaRInput holen
  let thresholds = getMVaRThresholdsFromInputUsingState();

  // Fallback, falls DB-Werte fehlen
  if (!thresholds) {
    thresholds = { RED_THRESHOLD: -3, YELLOW_THRESHOLD: -1 };
  }

  const { RED_THRESHOLD, YELLOW_THRESHOLD } = thresholds;

  const state = trafficLightStateForMVaR(filteredData, RED_THRESHOLD, YELLOW_THRESHOLD);
  if (state) updateTrafficLight('#traffic-mvar', state);
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
    { label: 'Portfolio', value: data.port_name },
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
    function renderMVaRRiskParaContainers(data) {
      const containers = [
        { containerId: 'MVaRTotalContainer', prefix: 'T' },
        { containerId: 'MVaRIRContainer',    prefix: 'IR' },
        { containerId: 'MVaRCSContainer',    prefix: 'CS' }
      ];

      containers.forEach(({ containerId, prefix }) => {
        const container = document.getElementById(containerId);
        if (!container) return;

        container.innerHTML = '';

        const table = document.createElement('table');
        table.classList.add('MVaRTable');

        // 🔹 Portfolio-Zeile über der Kopfzeile
        const portfolioRow = table.insertRow();
        const portfolioLabelCell = portfolioRow.insertCell();
        portfolioLabelCell.textContent = 'Portfolio';

        const portfolioValueCell = portfolioRow.insertCell();
        portfolioValueCell.colSpan = 2;          // über beide Value-Spalten spannen
        portfolioValueCell.textContent = data.port_name || '';

        // 🔹 Kopfzeile: Label | Value_abs | Value_rel
        const headerRow = table.insertRow();
        ['Label', 'Value_abs', 'Value_rel'].forEach(text => {
          const cell = headerRow.insertCell();
          cell.textContent = text;
        });

        const rows = [
          {
            label: 'VaR',
            abs: typeof data['VaR_' + prefix + '_abs'] === 'string'
              ? data['VaR_' + prefix + '_abs']
              : formatNumber()(data['VaR_' + prefix + '_abs']),
            rel: typeof data['VaR_' + prefix + '_rel'] === 'string'
              ? data['VaR_' + prefix + '_rel']
              : formatNumberWithCommas(data['VaR_' + prefix + '_rel'])
          },
          {
            label: 'ES',
            abs: typeof data['ES_' + prefix + '_abs'] === 'string'
              ? data['ES_' + prefix + '_abs']
              : formatNumber()(data['ES_' + prefix + '_abs']),
            rel: typeof data['ES_' + prefix + '_rel'] === 'string'
              ? data['ES_' + prefix + '_rel']
              : formatNumberWithCommas(data['ES_' + prefix + '_rel'])
          }
        ];

        rows.forEach(({ label, abs, rel }) => {
          const row = table.insertRow();
          row.insertCell(0).textContent = label;
          row.insertCell(1).textContent = abs;
          row.insertCell(2).textContent = rel;
        });

        container.appendChild(table);
      });
    }
    function renderMVaRRelativeTableWithIndex(data, index) {
      const containerId = `MVaRDataContainer${index}`;
      const container = document.getElementById(containerId);
      if (!container) return;
    
      // ❗ Prüfen, ob überhaupt sinnvolle Daten vorhanden sind
      const hasValidData = data && (
        data.VaR_T_rel !== undefined ||
        data.VaR_IR_rel !== undefined ||
        data.VaR_CS_rel !== undefined ||
        data.ES_T_rel !== undefined
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
        { label: 'Total VaR', value: formatNumberWithCommas(data.VaR_T_rel) },
        { label: 'Total ES', value: formatNumberWithCommas(data.ES_T_rel) },
        // { label: 'VaR_IR_rel', value: formatNumberWithCommas(data.VaR_IR_rel) },
        // { label: 'VaR_CS_rel', value: formatNumberWithCommas(data.VaR_CS_rel) }
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
    function getMVaRThresholdsFromInputUsingState() {
      const mvarInputData =
        (typeof appState.getMvarInputData === 'function'
          ? appState.getMvarInputData()
          : appState.mvarInputData) || [];

      if (!Array.isArray(mvarInputData) || mvarInputData.length === 0) {
        console.warn('getMVaRThresholdsFromInputUsingState: keine MVaRInput-Daten im State gefunden');
        return null;
      }

      let row = null;

      // 1) über die im State gespeicherte ID
      if (typeof appState.selectedMvarId === 'number') {
        row = mvarInputData.find(r => r.id === appState.selectedMvarId);
      }

      // 2) Fallback: erste Zeile
      if (!row) {
        row = mvarInputData[0];
      }

      if (!row) {
        console.warn('getMVaRThresholdsFromInputUsingState: keine passende Zeile gefunden');
        return null;
      }

      const redRel = typeof row.red_threshold_rel === 'number' ? row.red_threshold_rel : null;
      const yellowRel = typeof row.yellow_threshold === 'number' ? row.yellow_threshold : null;

      if (redRel == null || yellowRel == null) {
        console.warn('getMVaRThresholdsFromInputUsingState: Thresholds fehlen in row:', row);
        return null;
      }

      const RED_THRESHOLD = redRel * 100;
      const YELLOW_THRESHOLD = yellowRel * 100;

      console.log('RED_THRESHOLD, YELLOW_THRESHOLD, row.id:', RED_THRESHOLD, YELLOW_THRESHOLD, row.id);

      return { RED_THRESHOLD, YELLOW_THRESHOLD };
    }





function trafficLightStateForMVaR(data, redThreshold = -3, yellowThreshold = -1) {
  if (!data || typeof data.VaR_T_rel !== 'number') {
    console.error('trafficLightStateForMVaR: VaR_T_rel fehlt oder ist kein Number', data);
    return null;
  }

  // einfache Plausi: falls jemand die Reihenfolge vertauscht
  if (redThreshold >= yellowThreshold) {
    console.warn(
      'trafficLightStateForMVaR: redThreshold sollte kleiner als yellowThreshold sein.',
      { redThreshold, yellowThreshold }
    );
  }

  const v = data.VaR_T_rel; // z.B. -0.1766, -1.2, -3.5, ...

  if (v < redThreshold)  return 'red';
  if (v < yellowThreshold) return 'yellow';
  return 'green';
}


    
    
