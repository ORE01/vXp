'use strict';

import { appState } from '../../../../renderer.js';
import { formatNumberWithCommas } from '../../../../utils/tableCellFormats.js';
import { updateTrafficLight } from '../../../../utils/trafficLight.js';

import {
  getAvailableMvarPorts,
  getAvailableMvarScenarios,
  getMvarRowAsofDate,
  normalizeMvarText,
  rowMatchesMvarContext,
} from './mvarSelectors.js';

export function handleMVaRData(receivedData, index) {
  const portName = appState.getSelectedPortTableName?.();

  // Solange kein Portfolio existiert, nichts rendern.
  if (!portName) {
    return;
  }

  const scenarioName = appState.selectedMvarInterval;

  const containerIds = ['MVaRDataContainer'];

  if (index !== undefined && index !== null) {
    containerIds.push(`MVaRDataContainer${index}`);
  }

  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    clearContainers(containerIds);
    return;
  }

    const matches = receivedData.filter(row =>
    rowMatchesMvarContext(row, {
        portName,
        scenarioName,
    })
    );

  if (!matches.length) {
    clearContainers(containerIds);

    console.warn('[MVaR Aggregate] no rows for current context', {
      portName,
      scenarioName,
      receivedRows: receivedData.length,
      availablePorts: getAvailableMvarPorts(receivedData),
      availableScenarios: getAvailableMvarScenarios(receivedData),
    });

    return;
  }

  const filteredData = matches
    .slice()
    .sort((a, b) =>
    getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b))
    )
    .at(-1);

  if (!filteredData) {
    return;
  }

  // Zusaetzlich die juengste ROLLING_1-Zeile desselben Portfolios (wird bei jedem
  // MVaR-Lauf mitgerechnet) -> eigene Spalte neben dem gewaehlten Szenario.
  let rollingData = null;
  if (normalizeMvarText(scenarioName) !== 'ROLLING_1') {
    const rollMatches = receivedData.filter(row =>
      rowMatchesMvarContext(row, { portName, scenarioName: 'ROLLING_1' })
    );
    rollingData = rollMatches
      .slice()
      .sort((a, b) => getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b)))
      .at(-1) || null;
  }

  renderMVaRRelativeTableWithIndex(filteredData, index, { rollingData, scenarioName });

let thresholds = getMVaRThresholdsFromInputUsingState();

if (!thresholds) {
  console.warn('[MVaR Aggregate] no thresholds available - traffic light set to neutral', {
    selectedMvarInterval: appState.selectedMvarInterval,
    selectedMvarId: appState.selectedMvarId,
  });

  applyMvarTrafficStateToTable(index, null);
  return;
}







const {
  RED_THRESHOLD,
  YELLOW_THRESHOLD,
  ES_RED_THRESHOLD,
  ES_YELLOW_THRESHOLD,
} = thresholds;

console.log('[MVAR TRAFFIC LIGHT INPUT CHECK]', {
  selectedMvarInterval: appState.selectedMvarInterval,
  selectedMvarId: appState.selectedMvarId,

  thresholdsObject: thresholds,
  redThresholdPassedToAmpel: RED_THRESHOLD,
  yellowThresholdPassedToAmpel: YELLOW_THRESHOLD,

  valuePassedToAmpel: filteredData?.VaR_T_rel,
  valueType: typeof filteredData?.VaR_T_rel,

  redType: typeof RED_THRESHOLD,
  yellowType: typeof YELLOW_THRESHOLD,

  isUsingFallbackDefaults:
    RED_THRESHOLD === -3 && YELLOW_THRESHOLD === -1,

  // New source (Customer / Risk Config) for comparison vs the old MVaRInput source.
  modelSelectionRows:
    typeof appState.getMvarModelSelectionAppRows === 'function'
      ? appState.getMvarModelSelectionAppRows()
      : appState.mvarModelSelectionAppRows,

  filteredDataSample: filteredData,
});

const state = trafficLightStateForMVaR(
  filteredData,
  RED_THRESHOLD,
  YELLOW_THRESHOLD
);

  if (state) {
    applyMvarTrafficStateToTable(index, state, 'totalVar');
  }

  // Total ES: same source, same state logic, same colouring — just the ES limits and
  // the ES_T_rel value. Skipped only if ES limits are absent in the customer row.
  if (ES_RED_THRESHOLD != null && ES_YELLOW_THRESHOLD != null) {
    const esState = trafficLightStateForMVaR(
      filteredData,
      ES_RED_THRESHOLD,
      ES_YELLOW_THRESHOLD,
      'ES_T_rel'
    );

    if (esState) {
      applyMvarTrafficStateToTable(index, esState, 'totalEs');
    }
  }

  console.log('[MVaR Aggregate] rendered', {
    portName,
    scenarioName,
    selectedAsofDate: getMvarRowAsofDate(filteredData),
    receivedRows: receivedData.length,
    matchedRows: matches.length,
    state,
    sample: filteredData,
  });
}

function clearContainers(containerIds) {
  containerIds.forEach(id => {
    const el = document.getElementById(id);

    if (el) {
      el.innerHTML = '';
    }
  });
}

function renderMVaRRelativeTableWithIndex(data, index, { rollingData = null, scenarioName = '' } = {}) {
  const containerId = `MVaRDataContainer${index}`;
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  const hasValidData = data && (
    data.VaR_T_rel !== undefined ||
    data.VaR_IR_rel !== undefined ||
    data.VaR_CS_rel !== undefined ||
    data.ES_T_rel !== undefined
  );

  if (!hasValidData) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  const table = document.createElement('table');
  table.classList.add('MVaRTable');

  const headerRow = table.insertRow();

  // Mit Rolling-Spalte: Spaltenkoepfe = Szenario-Namen; sonst wie bisher.
  const withRolling = !!rollingData;
  const headers = withRolling
    ? ['label', String(scenarioName || 'value'), 'ROLLING_1']
    : ['label', 'value'];
  headers.forEach(text => {
    const cell = headerRow.insertCell();
    cell.textContent = text;
  });

  const rows = [
    {
      label: 'Total VaR',
      value: formatNumberWithCommas(data.VaR_T_rel),
      rolling: withRolling ? formatNumberWithCommas(rollingData.VaR_T_rel) : null,
      metric: 'totalVar',
    },
    {
      label: 'Total ES',
      value: formatNumberWithCommas(data.ES_T_rel),
      rolling: withRolling ? formatNumberWithCommas(rollingData.ES_T_rel) : null,
      metric: 'totalEs',
    },
  ];

  rows.forEach(({ label, value, rolling, metric }) => {
    const row = table.insertRow();
    // Tag the row so the traffic-light state can colour its cells later
    // (replaces the separate traffic-light widget for Total VaR).
    row.dataset.metric = metric;

    row.insertCell(0).textContent = label;
    row.insertCell(1).textContent = value;
    if (withRolling) row.insertCell(2).textContent = rolling ?? '';
  });

  container.appendChild(table);
}

// Show the traffic-light state as a small coloured dot AFTER the value (instead of
// colouring the whole row / the separate widget). Same colours as the ampel
// (green -> --accent, yellow, red). Pass null to clear the dot.
function applyMvarTrafficStateToTable(index, state, metric = 'totalVar') {
  const container = document.getElementById(`MVaRDataContainer${index}`);
  if (!container) return;

  const row = container.querySelector(`tr[data-metric="${metric}"]`);
  if (!row) return;

  const valueCell = row.cells[1];
  if (!valueCell) return;

  // Drop any previous dot so re-renders don't stack them.
  const existingDot = valueCell.querySelector('.mvar-status-dot');
  if (existingDot) existingDot.remove();

  // Konkrete Farben statt theme-var: --accent ist #4CAF50 (identische Optik im
  // Live-Panel), löst aber auch im geklonten Report-HTML zuverlässig auf.
  const colorMap = {
    green: '#4CAF50',
    yellow: 'yellow',
    red: 'red',
  };
  const color = colorMap[state] || null;
  if (!color) return;

  const dot = document.createElement('span');
  // mvar-status-dot bleibt (Remove-Selektor oben); zusätzlich generische, im Report
  // erkennbare Klassen + data-Attribut.
  dot.className = `mvar-status-dot risk-dot risk-dot--${state}`;
  dot.setAttribute('data-risk-status', state);
  dot.style.display = 'inline-block';
  dot.style.width = '10px';
  dot.style.height = '10px';
  dot.style.borderRadius = '50%';
  dot.style.backgroundColor = color;
  dot.style.marginLeft = '8px';
  dot.style.verticalAlign = 'middle';

  valueCell.appendChild(dot);
}

export function getMVaRThresholdsFromInputUsingState() {
  // Source switched to the Customer / Risk Config model-selection rows
  // (v_MVAR_MODEL_SELECTION_APP) instead of the old MVaRInput red/yellow_threshold.
  const modelSelectionRows =
    (
      typeof appState.getMvarModelSelectionAppRows === 'function'
        ? appState.getMvarModelSelectionAppRows()
        : appState.mvarModelSelectionAppRows
    ) || [];

  if (!Array.isArray(modelSelectionRows) || modelSelectionRows.length === 0) {
    console.warn('[MVaR Aggregate] no model-selection rows in state');
    return null;
  }

  let row = null;

  // 1) Match by selected interval (INTERVAL_NAME).
  const scenarioName = appState.selectedMvarInterval;
  if (scenarioName) {
    row = modelSelectionRows.find(item =>
      normalizeMvarText(item.INTERVAL_NAME ?? item.interval_name) === normalizeMvarText(scenarioName)
    );
  }

  // 2) Fallback within the same source: customer default row.
  if (!row) {
    row = modelSelectionRows.find(item => Number(item.is_customer_default) === 1);
  }

  // 3) Fallback within the same source: first row.
  if (!row) {
    row = modelSelectionRows[0];
  }

  if (!row) {
    console.warn('[MVaR Aggregate] no matching model-selection row found');
    return null;
  }

  const redRel = Number(row.var_red_loss_limit);
  const yellowRel = Number(row.var_yellow_loss_limit);

  if (!Number.isFinite(redRel) || !Number.isFinite(yellowRel)) {
    console.warn('[MVaR Aggregate] var loss limits missing or invalid', row);
    return null;
  }

  // ES limits from the SAME customer/risk-config row (may be absent -> null).
  const esRedRel = Number(row.es_red_loss_limit);
  const esYellowRel = Number(row.es_yellow_loss_limit);
  const esRedOk = Number.isFinite(esRedRel);
  const esYellowOk = Number.isFinite(esYellowRel);

  console.log('[MVAR THRESHOLD ROW USED]', {
    source: 'v_MVAR_MODEL_SELECTION_APP / getMvarModelSelectionAppRows',
    selectedMvarInterval: appState.selectedMvarInterval,
    selectedMvarId: appState.selectedMvarId,
    row,
    var_red_loss_limit_raw: row.var_red_loss_limit,
    var_yellow_loss_limit_raw: row.var_yellow_loss_limit,
    redThresholdFinal: redRel * 100,
    yellowThresholdFinal: yellowRel * 100,
    es_red_loss_limit_raw: row.es_red_loss_limit,
    es_yellow_loss_limit_raw: row.es_yellow_loss_limit,
    esRedThresholdFinal: esRedOk ? esRedRel * 100 : null,
    esYellowThresholdFinal: esYellowOk ? esYellowRel * 100 : null,
  });

  return {
    RED_THRESHOLD: redRel * 100,
    YELLOW_THRESHOLD: yellowRel * 100,
    ES_RED_THRESHOLD: esRedOk ? esRedRel * 100 : null,
    ES_YELLOW_THRESHOLD: esYellowOk ? esYellowRel * 100 : null,
  };
}

export function trafficLightStateForMVaR(data, redThreshold = -3, yellowThreshold = -1, valueKey = 'VaR_T_rel') {
  const value = Number(data?.[valueKey]);

  if (!Number.isFinite(value)) {
    console.error(`[MVaR Aggregate] ${valueKey} missing or invalid`, data);
    return null;
  }

  if (redThreshold >= yellowThreshold) {
    console.warn('[MVaR Aggregate] redThreshold should be smaller than yellowThreshold', {
      redThreshold,
      yellowThreshold,
    });
  }

  if (value < redThreshold) {
    return 'red';
  }

  if (value < yellowThreshold) {
    return 'yellow';
  }

  return 'green';
}