'use strict';

import processData from '../../../../core/ui/modal/modalData.js';
import { handleModalAction } from '../../../../core/ui/modal/modalActions.js';
import { appState } from '../../../../renderer.js';
import { ensureRendered } from '../../../../utils/domHelpers.js';

const TABLE_MVAR = 'MVaRInput';

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

  while (container.firstChild) {
    container.removeChild(container.firstChild);
  }

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

  container.innerHTML = processData(tableData, TABLE_MVAR);

  appState.setMvarInputData(receivedData);

  ensureRendered(() => {
    const reloadMVar = async () => {
      await fetchAndUpdateMVarDataInputData(TABLE_MVAR);
    };

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

    const radios = container.querySelectorAll('input.scenario-radio');

    if (!radios.length) {
      console.warn('[MVaRInput] No radios found. Check class="scenario-radio" and data attributes.');
      console.log('[MVaRInput] container HTML snippet:', container.innerHTML.slice(0, 500));
      return;
    }

    const applySelection = (radio) => {
      if (!radio) return;

      radios.forEach(other => {
        if (other !== radio) {
          other.checked = false;
        }
      });

      radio.checked = true;

      const idAttr = radio.getAttribute('data-id');
      const selectedId = idAttr != null ? parseInt(idAttr, 10) : null;
      const interval = radio.getAttribute('data-interval');

      if (!Number.isNaN(selectedId) && selectedId != null) {
        appState.selectedMvarId = selectedId;
      }

      if (interval) {
        appState.selectedMvarInterval = interval;
      }

      if (typeof appState.refreshMarketRiskUI === 'function') {
        appState.refreshMarketRiskUI(0);
      } else {
        console.warn('[MVaRInput] refreshMarketRiskUI not a function on appState');
      }
    };

    radios.forEach((radio) => {
      radio.addEventListener('click', () => applySelection(radio));
      radio.addEventListener('change', () => {
        if (radio.checked) {
          applySelection(radio);
        }
      });
    });

    const initiallyChecked =
      container.querySelector('input.scenario-radio[name="scenario-select"]:checked') ||
      container.querySelector('input.scenario-radio:checked') ||
      radios[0];

    applySelection(initiallyChecked);
  });
}

function fetchAndUpdateMVarDataInputData(tableName = TABLE_MVAR) {
  window.api.send('fetch-table-data', tableName);
}