//import { handleModalAction } from '../../../core/ui/modal/modalActionHandler.js';


function buildTable(rows, activeScenario) {

  if (!rows.length) return '<p>No data</p>';

  const headers = Object.keys(rows[0]);

  let html = '<table class="cs-parameter-table">';
  html += '<thead><tr>';

  html += '<th>Active</th>';

  headers.forEach(h => {
    html += `<th>${h}</th>`;
  });

  html += '<th>Actions</th>';
  html += '</tr></thead><tbody>';

  rows.forEach((row, index) => {

    const scenario = row.scenario_name;

    html += '<tr>';

    // 🔥 STATE DRIVEN CHECKBOX
    html += `
      <td>
        <input 
          type="radio"
          name="cs-active"
          class="select-scenario"
          data-scenario="${scenario}"
          ${scenario === activeScenario ? 'checked' : ''}
        >
      </td>
    `;

    Object.values(row).forEach(val => {
      html += `<td>${val ?? ''}</td>`;
    });

    html += `
      <td>
        <button class="edit-button" data-row="${index}">Edit</button>
      </td>
    `;

    html += '</tr>';
  });

  html += '</tbody></table>';

  return html;
}


// ============================================================
// SCENARIO SELECTION → IPC
// ============================================================
function bindScenarioSelection(container) {

  container.querySelectorAll('.select-scenario').forEach(el => {

    el.addEventListener('change', async (e) => {

      const scenario = e.target.dataset.scenario;
      if (!scenario) return;

      console.log('[CS][UI] set active scenario:', scenario);

      try {
        await window.electronAPI.invoke('cs:set-active-scenario', {
          scenario_name: scenario
        });
      } catch (err) {
        console.error('[CS][UI] failed to set scenario:', err);
      }

    });

  });
}


// ============================================================
// EDIT BUTTONS
// ============================================================
function bindEditButtons(container, rows) {

  container.querySelectorAll('.edit-button').forEach(btn => {

    btn.addEventListener('click', (event) => {

      event.stopPropagation();

      const rowIndex = parseInt(btn.dataset.row, 10);

      handleModalAction(
        event,
        rows,
        rowIndex,
        'CSParameter',
        'edit'
      );

    });

  });

}


// ============================================================
// ADD BUTTON
// ============================================================
function bindAddButton(rows) {

  const btn = document.getElementById('CSParameterAddButton');
  if (!btn) return;

  btn.onclick = (event) => {

    handleModalAction(
      event,
      rows,
      null,
      'CSParameter',
      'add'
    );

  };

}















