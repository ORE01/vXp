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

  renderMVaRRelativeTableWithIndex(filteredData, index);

  let thresholds = getMVaRThresholdsFromInputUsingState();

  if (!thresholds) {
    thresholds = {
      RED_THRESHOLD: -3,
      YELLOW_THRESHOLD: -1,
    };
  }

  const {
    RED_THRESHOLD,
    YELLOW_THRESHOLD,
  } = thresholds;

  const state = trafficLightStateForMVaR(
    filteredData,
    RED_THRESHOLD,
    YELLOW_THRESHOLD
  );

  if (state) {
    updateTrafficLight('#traffic-mvar', state);
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

function renderMVaRRelativeTableWithIndex(data, index) {
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

  ['label', 'value'].forEach(text => {
    const cell = headerRow.insertCell();
    cell.textContent = text;
  });

  const rows = [
    {
      label: 'Total VaR',
      value: formatNumberWithCommas(data.VaR_T_rel),
    },
    {
      label: 'Total ES',
      value: formatNumberWithCommas(data.ES_T_rel),
    },
  ];

  rows.forEach(({ label, value }) => {
    const row = table.insertRow();

    row.insertCell(0).textContent = label;
    row.insertCell(1).textContent = value;
  });

  container.appendChild(table);
}

function getMVaRThresholdsFromInputUsingState() {
  const mvarInputData =
    (
      typeof appState.getMvarInputData === 'function'
        ? appState.getMvarInputData()
        : appState.mvarInputData
    ) || [];

  if (!Array.isArray(mvarInputData) || mvarInputData.length === 0) {
    console.warn('[MVaR Aggregate] no MVaRInput data in state');
    return null;
  }

  let row = null;

  if (typeof appState.selectedMvarId === 'number') {
    row = mvarInputData.find(item =>
      Number(item.id) === Number(appState.selectedMvarId)
    );
  }

  if (!row) {
    const scenarioName = appState.selectedMvarInterval;

    if (scenarioName) {
      row = mvarInputData.find(item =>
        normalizeMvarText(item.INTERVAL_NAME ?? item.interval_name) === normalizeMvarText(scenarioName)
      );
    }
  }

  if (!row) {
    row = mvarInputData[0];
  }

  if (!row) {
    console.warn('[MVaR Aggregate] no matching threshold row found');
    return null;
  }

  const redRel = Number(row.red_threshold);
  const yellowRel = Number(row.yellow_threshold);

  if (!Number.isFinite(redRel) || !Number.isFinite(yellowRel)) {
    console.warn('[MVaR Aggregate] thresholds missing or invalid', row);
    return null;
  }

  return {
    RED_THRESHOLD: redRel * 100,
    YELLOW_THRESHOLD: yellowRel * 100,
  };
}

function trafficLightStateForMVaR(data, redThreshold = -3, yellowThreshold = -1) {
  const value = Number(data?.VaR_T_rel);

  if (!Number.isFinite(value)) {
    console.error('[MVaR Aggregate] VaR_T_rel missing or invalid', data);
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