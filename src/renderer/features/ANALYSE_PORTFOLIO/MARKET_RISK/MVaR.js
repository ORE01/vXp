import processData from '../../../core/ui/MODAL_HELPER/dataProcessor.js';
import { handleModalAction } from '../../../core/ui/MODAL_HELPER/ModalActionHandler.js';

import createBarChart from '../../../charts/BarChart.js';
import { appState } from '../../../renderer.js';

import { formatNumber, formatNumberWithCommas } from '../../../utils/format.js';
import { ensureRendered } from '../../../utils/domHelpers.js';
import { getMarketMvarColors } from '../../../utils/colors.js';



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
  if (!container) {
    console.warn('[MVaRInput] #inputMvarContainer not found');
    return;
  }

  // reset
  while (container.firstChild) container.removeChild(container.firstChild);

  // Nur gewÃ¼nschte Spalten fÃ¼r die TABELLE aufbereiten â€“ in definierter Reihenfolge
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

  // State speichern (Originaldaten)
  appState.setMvarInputData(receivedData);

  // Nach DOM-Rendern Buttons & Radios binden
  ensureRendered(() => {
    // console.log('[MVaRInput] ensureRendered done');
    // console.log('[MVaRInput] refreshMarketRiskUI type:', typeof appState.refreshMarketRiskUI);
    // console.log('[MVaRInput] appState identity:', appState);

    const reloadMVar = async () => {
      await fetchAndUpdateMVarDataInputData(TABLE_MVAR);
    };

    // ADD
    const mvarAddButton = document.getElementById('mvarAddButton');
    if (mvarAddButton) {
      mvarAddButton.onclick = (event) => {
        handleModalAction(
          event,
          appState.mvarInputData,
          null,
          TABLE_MVAR,
          'add',
          { modalId: 'editModal', onReload: reloadMVar }
        );
      };
    }

    // EDIT (pro Zeile)
    const mvarEditButtons = container.querySelectorAll('.edit-button');
    mvarEditButtons.forEach((button) => {
      button.onclick = (event) => {
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleModalAction(
          event,
          appState.mvarInputData,
          rowIndex,
          TABLE_MVAR,
          'edit',
          { modalId: 'editModal', onReload: reloadMVar }
        );
      };
    });

    // Radios finden (debug: zeig mal, was wirklich im DOM ist)
    const radios = container.querySelectorAll('input.scenario-radio');
    // console.log('[MVaRInput] radios found:', radios.length);

    if (!radios.length) {
      // Das ist der hÃ¤ufigste Grund, warum "nichts passiert"
      console.warn('[MVaRInput] No radios found. Check your HTML: class="scenario-radio" and data attributes.');
      // hilfreich: ein peek ins HTML
      console.log('[MVaRInput] container HTML snippet:', container.innerHTML.slice(0, 500));
      return;
    }

    // Helper: selection Ã¼bernehmen + refresh
    const applySelection = (radio) => {
      if (!radio) return;

      // ausschlieÃŸliches Verhalten
      radios.forEach(other => { if (other !== radio) other.checked = false; });
      radio.checked = true;

      const idAttr = radio.getAttribute('data-id');
      const selectedId = idAttr != null ? parseInt(idAttr, 10) : null;
      const interval = radio.getAttribute('data-interval');

      // console.log('[MVAR APPLY]', { idAttr, selectedId, interval });

      if (!Number.isNaN(selectedId) && selectedId != null) {
        appState.selectedMvarId = selectedId;
      }
      if (interval) {
        appState.selectedMvarInterval = interval;
      }

      // console.log('[MVAR STATE AFTER]', {
      //   selectedMvarId: appState.selectedMvarId,
      //   selectedMvarInterval: appState.selectedMvarInterval
      // });

      if (typeof appState.refreshMarketRiskUI === 'function') {
        appState.refreshMarketRiskUI(0);
      } else {
        console.warn('[MVaRInput] refreshMarketRiskUI not a function on THIS appState instance');
      }
    };

    // Bind: click + change (robust)
    radios.forEach((radio) => {
      radio.addEventListener('click', () => applySelection(radio));
      radio.addEventListener('change', () => { if (radio.checked) applySelection(radio); });
    });

    // Initial selection: checked oder erster
    const initiallyChecked =
      container.querySelector('input.scenario-radio[name="scenario-select"]:checked') ||
      container.querySelector('input.scenario-radio:checked') ||
      radios[0];

    // console.log('[MVaRInput] initial radio:', initiallyChecked);
    applySelection(initiallyChecked);
  });
}




// String-only IPC wie gehabt
function fetchAndUpdateMVarDataInputData(tableName = TABLE_MVAR) {
  window.api.send('fetch-table-data', tableName);
}


export function handleMVaRData(receivedData, index) {
  const port_name = appState.getSelectedPortTableName();

  // ðŸ”’ ABSOLUTER EXIT: solange kein Portfolio existiert, NICHTS tun
  if (!port_name) return;

  const scenario_name = appState.selectedMvarInterval;

  const containerIds = ['MVaRDataContainer'];
  if (index !== undefined && index !== null) {
    containerIds.push(`MVaRDataContainer${index}`);
  }

  // Wenn wirklich keine Daten vorhanden sind â†’ UI leeren
  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    containerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    return;
  }

  // 1) Port + Scenario filtern
  const matches = receivedData.filter(r =>
    r &&
    r.port_name === port_name &&
    (!scenario_name || r.scenario_name === scenario_name)
  );

  if (matches.length === 0) {
    containerIds.forEach(id => {
      const el = document.getElementById(id);
      if (el) el.innerHTML = '';
    });
    return;
  }

  // 2) Neuestes asof_date
  const filteredData = matches
    .slice()
    .sort((a, b) =>
      String(a.asof_date).slice(0, 10).localeCompare(
        String(b.asof_date).slice(0, 10)
      )
    )
    .at(-1);

  if (!filteredData) return;

  // --- Render ---
  renderMVaRFullTable(filteredData, 'MVaRDataContainer');
  renderMVaRRiskParaContainers(filteredData);
  renderMVaRRelativeTableWithIndex(filteredData, index);
  updateMVaRChart(filteredData);

  let thresholds = getMVaRThresholdsFromInputUsingState();
  if (!thresholds) thresholds = { RED_THRESHOLD: -3, YELLOW_THRESHOLD: -1 };

  const { RED_THRESHOLD, YELLOW_THRESHOLD } = thresholds;
  const state = trafficLightStateForMVaR(
    filteredData,
    RED_THRESHOLD,
    YELLOW_THRESHOLD
  );

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
  
    // ðŸ”µ Absolute Werte â€“ ES
    { label: 'ES_T_abs', value: typeof data.ES_T_abs === 'string' ? data.ES_T_abs : formatNumber()(data.ES_T_abs) },
    { label: 'ES_IR_abs', value: typeof data.ES_IR_abs === 'string' ? data.ES_IR_abs : formatNumber()(data.ES_IR_abs) },
    { label: 'ES_CS_abs', value: typeof data.ES_CS_abs === 'string' ? data.ES_CS_abs : formatNumber()(data.ES_CS_abs) },
  
    // ðŸŸ¢ Relative Werte â€“ VaR
    { label: 'VaR_T_rel', value: typeof data.VaR_T_rel === 'string' ? data.VaR_T_rel : formatNumberWithCommas(data.VaR_T_rel) },
    { label: 'VaR_IR_rel', value: typeof data.VaR_IR_rel === 'string' ? data.VaR_IR_rel : formatNumberWithCommas(data.VaR_IR_rel) },
    { label: 'VaR_CS_rel', value: typeof data.VaR_CS_rel === 'string' ? data.VaR_CS_rel : formatNumberWithCommas(data.VaR_CS_rel) },
  
    // ðŸŸ¢ Relative Werte â€“ ES
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

    // ðŸ”¹ Kopfzeile in <thead>: Label | Value_abs | Value_rel
    const thead = document.createElement('thead');
    const headRow = document.createElement('tr');
    ['Label', 'Value_abs', 'Value_rel'].forEach(text => {
      const th = document.createElement('th');
      th.textContent = text;
      headRow.appendChild(th);
    });
    thead.appendChild(headRow);
    table.appendChild(thead);

    // ðŸ”¹ Body in <tbody>
    const tbody = document.createElement('tbody');

    // 1) Portfolio-Zeile
    {
      const row = document.createElement('tr');

      const c0 = document.createElement('td');
      c0.textContent = 'Portfolio';
      row.appendChild(c0);

      const c1 = document.createElement('td');
      c1.textContent = data.port_name || '';
      row.appendChild(c1);

      const c2 = document.createElement('td');
      c2.textContent = ''; // bewusst leer, damit 3 Spalten konsistent bleiben
      row.appendChild(c2);

      tbody.appendChild(row);
    }

    // 2) VaR- und ES-Zeilen
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
      const row = document.createElement('tr');

      const c0 = document.createElement('td');
      c0.textContent = label;
      row.appendChild(c0);

      const c1 = document.createElement('td');
      c1.textContent = abs;
      row.appendChild(c1);

      const c2 = document.createElement('td');
      c2.textContent = rel;
      row.appendChild(c2);

      tbody.appendChild(row);
    });

    table.appendChild(tbody);
    container.appendChild(table);
  });
}

    function renderMVaRRelativeTableWithIndex(data, index) {
      const containerId = `MVaRDataContainer${index}`;
      const container = document.getElementById(containerId);
      if (!container) return;
    
      // â— PrÃ¼fen, ob Ã¼berhaupt sinnvolle Daten vorhanden sind
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
        console.warn('âš ï¸ Keine Daten fÃ¼r das Portfolio gefunden.');
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
            ...getMarketMvarColors('TOTAL', 1),
            borderWidth: 1
          },
          {
            label: 'Interest Rate VaR',
            data: MVaRValues.Interest_Rate,
            ...getMarketMvarColors('IR', 1),
            borderWidth: 1
          },
          {
            label: 'Credit Spread VaR',
            data: MVaRValues.Credit_Spread,
            ...getMarketMvarColors('CS', 1),
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

      // 1) Ã¼ber die im State gespeicherte ID
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

      // const redRel = typeof row.red_threshold_rel === 'number' ? row.red_threshold_rel : null;
      // const yellowRel = typeof row.yellow_threshold === 'number' ? row.yellow_threshold : null;

      const redRel = typeof row.red_threshold === 'number' ? row.red_threshold : null;
      const yellowRel = typeof row.yellow_threshold === 'number' ? row.yellow_threshold : null;


      if (redRel == null || yellowRel == null) {
        console.warn('getMVaRThresholdsFromInputUsingState: Thresholds fehlen in row:', row);
        return null;
      }

      const RED_THRESHOLD = redRel * 100;
      const YELLOW_THRESHOLD = yellowRel * 100;

      //console.log('RED_THRESHOLD, YELLOW_THRESHOLD, row.id:', RED_THRESHOLD, YELLOW_THRESHOLD, row.id);

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


    
    






