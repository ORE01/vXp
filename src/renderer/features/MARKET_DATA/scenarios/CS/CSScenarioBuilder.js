'use strict';

import {
  showSuccess,
  showError,
  showInfo
} from '../../../../core/ui/notifications/notifications.js';

let csScenarioBuilderListenersInstalled = false;
let fillRightBound = false;

export function renderCSScenarioBuilder() {
  console.log('🔥 CS BUILDER RENDER');

  if (!csScenarioBuilderListenersInstalled) {
    document.addEventListener('cs:scenario:ready', () => {
      renderCSScenarioBuilder();
    });

    document.addEventListener('cs:base:ready', () => {
      renderCSScenarioBuilder();
    });

    document.addEventListener('ccy:changed', () => {
      renderCSScenarioBuilder();
    });

    csScenarioBuilderListenersInstalled = true;
  }

  const container = document.getElementById('csScenarioTableData');
  if (!container) {
    console.log('❌ csScenarioTableData not found');
    return;
  }

  const appState = window.appState;
  if (!appState) {
    console.log('❌ appState missing');
    return;
  }

  const selectedCcy =
    appState.getSelectedCcy?.() ||
    appState.selectedCcy ||
    'EUR';

  const ccy = String(selectedCcy).trim().toUpperCase();

  bindCcySelect(ccy);

  const baseLongRows = appState.getCSBaseData?.() || [];

  const baseFiltered = baseLongRows.filter(r =>
    String(r?.ccy || '').trim().toUpperCase() === ccy &&
    String(r?.scenario_id || 'BASE').trim() === 'BASE' &&
    String(r?.run_id || 'BASE').trim() === 'BASE'
  );

  const baseRows = pivotCreditSpreadRowsByRating(baseFiltered);

  if (!baseRows.length) {
    container.innerHTML = `<p>No CS_BASE data loaded for ${ccy}</p>`;
  } else {
    renderTable(baseRows);
  }

  bindScenarioDropdown();
  bindScenarioSelection();
  bindSave();
  bindDelete();
  bindShift();
  bindFillRight();

  
  function renderTable(data) {
    if (!Array.isArray(data) || !data.length) {
      container.innerHTML = `<p>No CS scenario data available for ${ccy}</p>`;
      return;
    }

    const headers = buildHeaders(data);

    let html = `
      <div class="table-card">
        <h4>CS Matrix Builder (${getCurvePackage(ccy)})</h4>

        <div style="overflow:auto; max-width:100%;">
          <table class="ml-table">
            <thead>
              <tr>
    `;

    headers.forEach(h => {
      html += `<th>${h}</th>`;
    });

    html += `
              </tr>
            </thead>
            <tbody>
    `;

    data.forEach(row => {
      html += `<tr>`;

      headers.forEach(header => {
        if (header === 'RATING') {
          html += `<td>${row[header] ?? ''}</td>`;
          return;
        }

        html += `
          <td>
            <div style="display:flex; gap:4px; align-items:center;">
              <input
                type="number"
                step="0.01"
                value="${row[header] ?? ''}"
                data-rating="${row.RATING}"
                data-tenor="${header}"
                style="width:75px;"
              />

              <button
                class="fill-right-btn"
                style="
                  padding:2px 6px;
                  cursor:pointer;
                  border:1px solid #888;
                  border-radius:4px;
                  background:#222;
                  color:#fff;
                "
              >→</button>
            </div>
          </td>
        `;
      });

      html += `</tr>`;
    });

    html += `
            </tbody>
          </table>
        </div>
      </div>
    `;

    container.innerHTML = html;
  }

  function buildHeaders(data) {
    const metaKeys = new Set(['curve_id', 'ccy', 'RATING', 'rating', 'rank']);

    const tenorSet = new Set();

    data.forEach(row => {
      Object.keys(row || {}).forEach(key => {
        if (!metaKeys.has(key)) tenorSet.add(key);
      });
    });

    const tenors = Array.from(tenorSet).sort((a, b) => Number(a) - Number(b));
    return ['RATING', ...tenors];
  }

  function bindScenarioDropdown() {
    const select = document.getElementById('csScenarioSelect');
    if (!select) return;

    // 👉 DAS ist der Fix
    const previousValue = String(select.value || '').trim();

    const snapshots = appState.getCSScenarioData?.() || [];

    const names = snapshots
      .filter(r => String(r?.ccy || '').trim().toUpperCase() === ccy)
      .map(r => String(r?.scenario_id || '').trim())
      .filter(Boolean);

    const scenarioNames = [...new Set(['BASE', ...names])].sort((a, b) => {
      if (a === 'BASE') return -1;
      if (b === 'BASE') return 1;
      return a.localeCompare(b);
    });

    select.innerHTML = `
      <option value="">+ Create New Scenario</option>
      ${scenarioNames.map(n => `<option value="${n}">${n}</option>`).join('')}
    `;

    // 👉 UND DAS ist der zweite Teil vom Fix
    if (previousValue && scenarioNames.includes(previousValue)) {
      select.value = previousValue;
    }

    updateDeleteButtonState();
  }

  function bindScenarioSelection() {
    const select = document.getElementById('csScenarioSelect');
    const nameInput = document.getElementById('csScenarioName');

    if (!select) return;

    select.onchange = () => {
      const selected = String(select.value || '').trim();
      const snapshots = appState.getCSScenarioData?.() || [];

      if (!selected) {
        if (nameInput) nameInput.value = '';
        renderTable(baseRows);
        updateDeleteButtonState();
        return;
      }

      if (selected === 'BASE') {
        if (nameInput) nameInput.value = 'BASE';
        renderTable(baseRows);
        updateDeleteButtonState();
        return;
      }

      const filtered = snapshots.filter(r =>
        String(r?.ccy || '').trim().toUpperCase() === ccy &&
        String(r?.scenario_id || '').trim() === selected
      );

      const pivoted = pivotCreditSpreadRowsByRating(filtered);

      if (!pivoted.length) {
        showError(`No data found for ${ccy}`);
        return;
      }

      if (nameInput) nameInput.value = selected;

      renderTable(pivoted);
      updateDeleteButtonState();
    };
  }

  function getCurvePackage(ccy, rank = 'senior_unsecured') {
    return `${ccy}:RATING:${rank}`;
  }

  function buildCurveId(ccy, rating, rank = 'senior_unsecured') {
    return `${ccy}:RATING:${rating}:${rank}`;
  }

  function pivotCreditSpreadRowsByRating(rows) {
    const rowMap = new Map();

    rows.forEach(row => {
      const rating = String(row?.rating || row?.RATING || '').trim();
      const tenor = String(row?.tenor || '').trim();
      const value = parseFloat(String(row?.value ?? '').replace(',', '.'));
      const rank = String(row?.rank || 'senior_unsecured').trim();

      if (!rating || !tenor || Number.isNaN(value)) return;

      const curve_id =
        String(row?.curve_id || '').trim() ||
        buildCurveId(ccy, rating, rank);

      if (!rowMap.has(rating)) {
        rowMap.set(rating, {
          curve_id,
          ccy,
          RATING: rating,
          rank,
        });
      }

      rowMap.get(rating)[tenor] = value;
    });

    return Array.from(rowMap.values());
  }

  function bindSave() {
    const saveBtn = document.getElementById('csSaveScenarioBtn');
    const nameInput = document.getElementById('csScenarioName');

    if (!saveBtn || !nameInput) return;

    saveBtn.onclick = async () => {
      const scenario_id = String(nameInput.value || '').trim();

      if (!scenario_id) {
        showError('Name missing');
        return;
      }

      if (scenario_id === 'BASE') {
        showError('BASE scenario cannot be saved');
        return;
      }

      const rank = 'senior_unsecured';
      const inputs = container.querySelectorAll('input[data-rating][data-tenor]');
      const rowMap = new Map();

      for (const input of inputs) {
        const rating = String(input.dataset.rating || '').trim();
        const tenor = String(input.dataset.tenor || '').trim();
        const value = parseFloat(String(input.value || '').replace(',', '.'));

        if (!rating || !tenor) continue;

        if (Number.isNaN(value)) {
          showError('Invalid value');
          return;
        }

        if (!rowMap.has(rating)) {
          rowMap.set(rating, {
            curve_id: buildCurveId(ccy, rating, rank),
            ccy,
            RATING: rating,
            rating,
            rank,
          });
        }

        rowMap.get(rating)[tenor] = value;
      }

      const data = Array.from(rowMap.values());

      const result = await window.api.invoke('cs:create-scenario', {
        scenario_id,
        ccy,
        rank,
        curve_package: getCurvePackage(ccy, rank), // nur Info, falls Handler es ignoriert auch ok
        data
      });

      if (result?.success) {
        showSuccess(`CS scenario saved (${ccy})`);
        bindScenarioDropdown();

        const select = document.getElementById('csScenarioSelect');
        if (select) select.value = scenario_id;

        updateDeleteButtonState();
      } else {
        showError(result?.error || 'Failed to save scenario');
      }
    };
  }

  function bindDelete() {
    const deleteBtn = document.getElementById('csDeleteScenarioBtn');
    const select = document.getElementById('csScenarioSelect');
    const nameInput = document.getElementById('csScenarioName');

    if (!deleteBtn) return;

    deleteBtn.onclick = async () => {
      const selected = String(select?.value || '').trim();
      const scenario_id = selected || String(nameInput?.value || '').trim();

      if (!scenario_id) {
        showError('No scenario selected');
        return;
      }

      if (scenario_id === 'BASE') {
        showError('BASE scenario cannot be deleted');
        return;
      }

      const result = await window.api.invoke('cs:delete-scenario', {
        scenario_id,
        ccy
      });

      if (result?.success) {
        showSuccess(`Scenario deleted (${ccy})`);

        bindScenarioDropdown();

        if (select) select.value = '';
        if (nameInput) nameInput.value = '';

        renderTable(baseRows);
        updateDeleteButtonState();
      } else {
        showError(result?.error || 'Failed to delete scenario');
      }
    };

    updateDeleteButtonState();
  }

  function updateDeleteButtonState() {
    const btn = document.getElementById('csDeleteScenarioBtn');
    const select = document.getElementById('csScenarioSelect');

    if (!btn) return;

    const selected = String(select?.value || '').trim();
    btn.disabled = !selected || selected === 'BASE';
  }

  function bindShift() {
    const shiftBtn = document.getElementById('csApplyShiftBtn');
    const shiftInput = document.getElementById('csShiftInput');

    if (!shiftBtn || !shiftInput) return;

    shiftBtn.onclick = () => {
      const shift = parseFloat(String(shiftInput.value || '').replace(',', '.'));

      if (Number.isNaN(shift)) {
        showError('Invalid shift');
        return;
      }

      const inputs = container.querySelectorAll('input[data-rating][data-tenor]');

      inputs.forEach(input => {
        const current = parseFloat(String(input.value || '').replace(',', '.'));
        if (Number.isNaN(current)) return;

        input.value = (current + shift).toFixed(2);
      });

      showSuccess('Shift applied');
    };
  }

  function bindFillRight() {
    if (fillRightBound) return;

    fillRightBound = true;

    container.addEventListener('click', (e) => {
      if (!e.target.classList.contains('fill-right-btn')) return;

      const btn = e.target;
      const cell = btn.closest('td');

      if (!cell) return;

      const input = cell.querySelector('input[data-tenor]');
      if (!input) return;

      const value = input.value;

      let nextCell = cell.nextElementSibling;

      while (nextCell) {
        const nextInput = nextCell.querySelector('input[data-tenor]');
        if (nextInput) {
          nextInput.value = value;
        }
        nextCell = nextCell.nextElementSibling;
      }

      showInfo('Values filled to the right');
    });
  }

  function bindCcySelect(currentCcy) {
    const select = document.getElementById('csScenarioCcySelect');
    if (!select) return;

    select.value = currentCcy;

    if (select.dataset.bound === '1') return;
    select.dataset.bound = '1';

    select.onchange = () => {
      const nextCcy = String(select.value || 'EUR').trim().toUpperCase();

      if (appState.setSelectedCcy) {
        appState.setSelectedCcy(nextCcy);
      } else {
        appState.selectedCcy = nextCcy;
      }

      document.dispatchEvent(
        new CustomEvent('ccy:changed', { detail: { ccy: nextCcy } })
      );

      renderCSScenarioBuilder();
    };
  }
}