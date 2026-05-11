'use strict';

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

  const baseLongRows = appState.getCSBaseData?.() || [];
  const baseRows = pivotCreditSpreadRowsByRating(baseLongRows);

  if (!baseRows.length) {
    container.innerHTML = '<p>No CS_BASE data loaded</p>';
  } else {
    renderTable(baseRows);
  }

  bindScenarioDropdown();
  bindScenarioSelection();
  bindSave();
  bindDelete();
  bindShift();
  bindFillRight();

  // =====================================================
  // MESSAGE BOX
  // =====================================================
  function showMessage(text, type = 'info') {
    let box = document.getElementById('csMessageBox');

    if (!box) {
      box = document.createElement('div');
      box.id = 'csMessageBox';
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

    if (type === 'error') {
      box.style.background = '#c62828';
      box.style.color = '#fff';
    } else if (type === 'success') {
      box.style.background = '#2e7d32';
      box.style.color = '#fff';
    } else {
      box.style.background = '#1565c0';
      box.style.color = '#fff';
    }

    box.style.opacity = '1';

    clearTimeout(box._timer);
    box._timer = setTimeout(() => {
      box.style.opacity = '0';
    }, 2500);
  }

  // =====================================================
  // TABLE
  // =====================================================
  function renderTable(data) {
    if (!Array.isArray(data) || !data.length) {
      container.innerHTML = '<p>No CS scenario data available</p>';
      return;
    }

    const headers = buildHeaders(data);

    let html = `
      <div class="table-card">
        <h4>CS Matrix Builder</h4>

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
    const tenorSet = new Set();

    data.forEach(row => {
      Object.keys(row || {}).forEach(key => {
        if (key !== 'RATING') tenorSet.add(key);
      });
    });

    const tenors = Array.from(tenorSet).sort((a, b) => Number(a) - Number(b));

    return ['RATING', ...tenors];
  }

  // =====================================================
  // DROPDOWN
  // =====================================================
  function bindScenarioDropdown() {
    const select = document.getElementById('csScenarioSelect');
    if (!select) return;

    const snapshots = appState.getCSScenarioData?.() || [];

    const names = snapshots
      .map(r => r?.scenario_id)
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

    updateDeleteButtonState();
  }

  // =====================================================
  // SELECT SCENARIO
  // =====================================================
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

      const filtered = snapshots.filter(r => r?.scenario_id === selected);
      const pivoted = pivotCreditSpreadRowsByRating(filtered);

      if (!pivoted.length) {
        showMessage('Keine Daten gefunden', 'error');
        return;
      }

      if (nameInput) nameInput.value = selected;

      renderTable(pivoted);
      updateDeleteButtonState();
    };
  }

  function pivotCreditSpreadRowsByRating(rows) {
    const rowMap = new Map();

    rows.forEach(row => {
      const rating = String(row?.rating || '').trim();
      const tenor = String(row?.tenor || '').trim();
      const value = parseFloat(String(row?.value ?? '').replace(',', '.'));

      if (!rating || !tenor || Number.isNaN(value)) return;

      if (!rowMap.has(rating)) {
        rowMap.set(rating, { RATING: rating });
      }

      rowMap.get(rating)[tenor] = value;
    });

    return Array.from(rowMap.values());
  }

  // =====================================================
  // SAVE
  // =====================================================
  function bindSave() {
    const saveBtn = document.getElementById('csSaveScenarioBtn');
    const nameInput = document.getElementById('csScenarioName');

    if (!saveBtn || !nameInput) return;

    saveBtn.onclick = async () => {
      const scenario_name = String(nameInput.value || '').trim();

      if (!scenario_name) {
        showMessage('Name fehlt', 'error');
        return;
      }

      if (scenario_name === 'BASE') {
        showMessage('BASE kann nicht gespeichert werden', 'error');
        return;
      }

      const inputs = container.querySelectorAll('input[data-rating][data-tenor]');
      const rowMap = new Map();

      for (const input of inputs) {
        const rating = input.dataset.rating;
        const tenor = input.dataset.tenor;
        const value = parseFloat(String(input.value || '').replace(',', '.'));

        if (Number.isNaN(value)) {
          showMessage('Ungültiger Wert', 'error');
          return;
        }

        if (!rowMap.has(rating)) {
          rowMap.set(rating, { RATING: rating });
        }

        rowMap.get(rating)[tenor] = value;
      }

      const data = Array.from(rowMap.values());

      const result = await window.api.invoke('cs:create-scenario', {
        scenario_name,
        data
      });

      if (result?.success) {
        showMessage('CS Scenario gespeichert', 'success');
        bindScenarioDropdown();

        const select = document.getElementById('csScenarioSelect');
        if (select) select.value = scenario_name;

        updateDeleteButtonState();
      } else {
        showMessage(result?.error || 'Fehler beim Speichern', 'error');
      }
    };
  }

  // =====================================================
  // DELETE
  // =====================================================
  function bindDelete() {
    const deleteBtn = document.getElementById('csDeleteScenarioBtn');
    const select = document.getElementById('csScenarioSelect');
    const nameInput = document.getElementById('csScenarioName');

    if (!deleteBtn) return;

    deleteBtn.onclick = async () => {
      const selected = String(select?.value || '').trim();
      const scenario_name = selected || String(nameInput?.value || '').trim();

      if (!scenario_name) {
        showMessage('Kein Szenario gewählt', 'error');
        return;
      }

      if (scenario_name === 'BASE') {
        showMessage('BASE kann nicht gelöscht werden', 'error');
        return;
      }

      const result = await window.api.invoke('cs:delete-scenario', {
        scenario_name
      });

      if (result?.success) {
        showMessage('Szenario gelöscht', 'success');

        bindScenarioDropdown();

        if (select) select.value = '';
        if (nameInput) nameInput.value = '';

        renderTable(baseRows);
        updateDeleteButtonState();
      } else {
        showMessage(result?.error || 'Fehler beim Löschen', 'error');
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

  // =====================================================
  // SHIFT
  // =====================================================
  function bindShift() {
    const shiftBtn = document.getElementById('csApplyShiftBtn');
    const shiftInput = document.getElementById('csShiftInput');

    if (!shiftBtn || !shiftInput) return;

    shiftBtn.onclick = () => {
      const shift = parseFloat(String(shiftInput.value || '').replace(',', '.'));

      if (Number.isNaN(shift)) {
        showMessage('Ungültiger Shift', 'error');
        return;
      }

      const inputs = container.querySelectorAll('input[data-rating][data-tenor]');

      inputs.forEach(input => {
        const current = parseFloat(String(input.value || '').replace(',', '.'));
        if (Number.isNaN(current)) return;

        input.value = (current + shift).toFixed(2);
      });

      showMessage('Shift angewendet', 'success');
    };
  }

  // =====================================================
  // FILL RIGHT
  // =====================================================
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

      showMessage('Nach rechts gefüllt', 'success');
    });
  }
}