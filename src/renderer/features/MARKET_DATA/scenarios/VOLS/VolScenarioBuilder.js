'use strict';

import {
  renderVolATMScenarioTable,
  bindVolATMFillRight
} from './VolATMScenarioBuilder.js';

import {
  renderVolSmileScenarioTable
} from './VolSmileScenarioBuilder.js';

export function renderVolScenarioBuilder() {
  console.log('🔥 VOL BUILDER RENDER');

  const appState = window.appState;
  if (!appState) return;

  const atmRows =
    appState.getSwaptionAtmBase?.() ||
    appState._SWAPTION_ATM_BASE ||
    appState.swaptionATM ||
    [];

  const smileRows =
    appState.getSwaptionSmileBase?.() ||
    appState._SWAPTION_SMILE_BASE ||
    appState.swaptionSmile ||
    [];

  renderVolATMScenarioTable(atmRows);
  renderVolSmileScenarioTable(smileRows);

  bindScenarioDropdown(appState);
  bindScenarioSelection(appState, atmRows, smileRows);
  bindSave(appState);
  bindShift();
  bindVolATMFillRight(showMessage);
}

function showMessage(text, type = 'info') {
  let box = document.getElementById('volMessageBox');

  if (!box) {
    box = document.createElement('div');
    box.id = 'volMessageBox';
    box.style.position = 'fixed';
    box.style.top = '20px';
    box.style.right = '20px';
    box.style.zIndex = '9999';
    box.style.padding = '10px 14px';
    box.style.borderRadius = '8px';
    box.style.fontSize = '14px';
    box.style.fontWeight = '600';
    box.style.boxShadow = '0 6px 18px rgba(0,0,0,0.2)';
    box.style.transition = 'opacity 0.25s ease';
    box.style.opacity = '0';
    box.style.pointerEvents = 'none';
    document.body.appendChild(box);
  }

  box.textContent = text;
  box.style.background =
    type === 'error' ? '#c62828' :
    type === 'success' ? '#2e7d32' :
    '#1565c0';

  box.style.color = '#fff';
  box.style.opacity = '1';

  clearTimeout(box._timer);
  box._timer = setTimeout(() => {
    box.style.opacity = '0';
  }, 2500);
}

function getAtmScenarioRows(appState) {
  return (
    appState.getSwaptionAtmScenarioData?.() ||
    appState._SWAPTION_ATM_SCENARIO_DATA ||
    []
  );
}

function getSmileScenarioRows(appState) {
  return (
    appState.getSwaptionSmileScenarioData?.() ||
    appState._SWAPTION_SMILE_SCENARIO_DATA ||
    []
  );
}

function bindScenarioDropdown(appState) {
  const select = document.getElementById('volBuilderScenarioSelect');
  if (!select) return;

  const atmScenarioData = getAtmScenarioRows(appState);
  const smileScenarioData = getSmileScenarioRows(appState);

  const names = [
    ...atmScenarioData.map(r => r?.scenario_id),
    ...smileScenarioData.map(r => r?.scenario_id)
  ].filter(Boolean);

  const scenarioNames = [...new Set(['BASE', ...names])].sort((a, b) => {
    if (a === 'BASE') return -1;
    if (b === 'BASE') return 1;
    return a.localeCompare(b);
  });

  select.innerHTML = `
    <option value="">+ Create New Scenario</option>
    ${scenarioNames.map(n => `<option value="${n}">${n}</option>`).join('')}
  `;
}

function bindScenarioSelection(appState, baseAtmRows, baseSmileRows) {
  const select = document.getElementById('volBuilderScenarioSelect');
  const nameInput = document.getElementById('volScenarioName');

  if (!select) return;

  select.onchange = () => {
    const selected = String(select.value || '').trim();

    const atmScenarioData = getAtmScenarioRows(appState);
    const smileScenarioData = getSmileScenarioRows(appState);

    if (!selected) {
      if (nameInput) nameInput.value = '';
      renderVolATMScenarioTable(baseAtmRows);
      renderVolSmileScenarioTable(baseSmileRows);
      bindVolATMFillRight(showMessage);
      return;
    }

    if (selected === 'BASE') {
      if (nameInput) nameInput.value = 'BASE';
      renderVolATMScenarioTable(baseAtmRows);
      renderVolSmileScenarioTable(baseSmileRows);
      bindVolATMFillRight(showMessage);
      return;
    }

    const atmFiltered = atmScenarioData.filter(r => r?.scenario_id === selected);
    const smileFiltered = smileScenarioData.filter(r => r?.scenario_id === selected);

    if (!atmFiltered.length) {
      showMessage('Keine ATM-Szenariodaten gefunden', 'error');
      return;
    }

    if (nameInput) nameInput.value = selected;

    renderVolATMScenarioTable(atmFiltered);

    if (smileFiltered.length) {
      renderVolSmileScenarioTable(smileFiltered);
    } else {
      renderVolSmileScenarioTable(baseSmileRows);
      showMessage('Smile bleibt BASE, weil kein Smile-Szenario gefunden wurde', 'info');
    }

    bindVolATMFillRight(showMessage);
  };
}

function bindSave(appState) {
  const saveBtn = document.getElementById('volSaveScenarioBtn');
  const nameInput = document.getElementById('volScenarioName');
  const atmContainer = document.getElementById('volScenarioTableData');
  const smileContainer = document.getElementById('volSmileScenarioTableData');

  if (!saveBtn || !nameInput || !atmContainer) return;

  saveBtn.onclick = async () => {
    const scenario_id = String(nameInput.value || '').trim();

    if (!scenario_id) {
      showMessage('Name fehlt', 'error');
      return;
    }

    if (scenario_id === 'BASE') {
      showMessage('BASE kann nicht gespeichert werden', 'error');
      return;
    }

    const atmInputs = atmContainer.querySelectorAll(
      'input[data-option-tenor][data-swap-tenor]'
    );

    const atmData = [];

    for (const input of atmInputs) {
      const option_tenor = String(input.dataset.optionTenor || '').trim();
      const swap_tenor = String(input.dataset.swapTenor || '').trim();
      const vol = parseFloat(String(input.value || '').replace(',', '.'));

      if (!option_tenor || !swap_tenor) {
        showMessage('ATM-Tenor fehlt', 'error');
        return;
      }

      if (Number.isNaN(vol)) {
        showMessage('Ungültiger ATM-Vol-Wert', 'error');
        return;
      }

      atmData.push({
        ccy: 'EUR',
        option_tenor,
        swap_tenor,
        vol
      });
    }

    const smileInputs = smileContainer
      ? smileContainer.querySelectorAll('input[data-strike-spread-bp]')
      : [];

    const smileDataMap = new Map();

    for (const input of smileInputs) {
      const strike_spread_bp = Number(input.dataset.strikeSpreadBp);
      const vol_spread = parseFloat(String(input.value || '').replace(',', '.'));

      if (!Number.isFinite(strike_spread_bp)) {
        showMessage('Strike Spread fehlt', 'error');
        return;
      }

      if (Number.isNaN(vol_spread)) {
        showMessage('Ungültiger Smile-Wert', 'error');
        return;
      }

      smileDataMap.set(strike_spread_bp, {
        ccy: 'EUR',
        strike_spread_bp,
        vol_spread
      });
    }

    const smileData = [...smileDataMap.values()];

    const result = await window.api.invoke('swaption:create-scenario', {
      scenario_id,
      ccy: 'EUR',
      data: atmData,
      smileData
    });

    if (result?.success) {
      showMessage('Vol Scenario gespeichert', 'success');

      const currentAtmScenarioData = appState.getSwaptionAtmScenarioData?.() || [];
      const currentSmileScenarioData = appState.getSwaptionSmileScenarioData?.() || [];

      const newAtmRows = atmData.map(row => ({
        ...row,
        scenario_id,
        ccy: result.ccy || row.ccy || 'EUR',
        run_id: result.run_id || null,
      }));

      const newSmileRows = smileData.map(row => ({
        ...row,
        scenario_id,
        ccy: result.ccy || row.ccy || 'EUR',
        run_id: result.run_id || null,
      }));

      appState.setSwaptionAtmScenarioData?.([
        ...currentAtmScenarioData.filter(r => r.scenario_id !== scenario_id),
        ...newAtmRows,
      ]);

      appState.setSwaptionSmileScenarioData?.([
        ...currentSmileScenarioData.filter(r => r.scenario_id !== scenario_id),
        ...newSmileRows,
      ]);

      document.dispatchEvent(new CustomEvent('swaption:atm-scenario-data:ready'));
      document.dispatchEvent(new CustomEvent('swaption:smile-scenario-data:ready'));

      bindScenarioDropdown(appState);

      const select = document.getElementById('volBuilderScenarioSelect');
      if (select) select.value = scenario_id;

    } else {
      showMessage(result?.error || 'Fehler beim Speichern', 'error');
    }
  };
}

function bindShift() {
  const shiftBtn = document.getElementById('volApplyShiftBtn');
  const shiftInput = document.getElementById('volShiftInput');
  const atmContainer = document.getElementById('volScenarioTableData');

  if (!shiftBtn || !shiftInput || !atmContainer) return;

  shiftBtn.onclick = () => {
    const shift = parseFloat(String(shiftInput.value || '').replace(',', '.'));

    if (Number.isNaN(shift)) {
      showMessage('Ungültiger Shift', 'error');
      return;
    }

    const inputs = atmContainer.querySelectorAll(
      'input[data-option-tenor][data-swap-tenor]'
    );

    inputs.forEach(input => {
      const current = parseFloat(String(input.value || '').replace(',', '.'));
      if (Number.isNaN(current)) return;

      input.value = (current + shift).toFixed(4);
    });

    showMessage('Shift angewendet', 'success');
  };
}