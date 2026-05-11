'use strict';

function parseTenorToYears(value) {
  if (typeof value !== 'string') return Number.POSITIVE_INFINITY;

  const match = value.trim().match(/^(\d+)\s*([MDWY])?$/i);
  if (!match) return Number.POSITIVE_INFINITY;

  const amount = Number.parseInt(match[1], 10);
  const unit = (match[2] || 'Y').toUpperCase();

  switch (unit) {
    case 'D': return amount / 365;
    case 'W': return (amount * 7) / 365;
    case 'M': return amount / 12;
    case 'Y':
    default: return amount;
  }
}

function sortTenors(values) {
  return [...new Set((values || []).filter(Boolean).map(String))]
    .sort((a, b) => parseTenorToYears(a) - parseTenorToYears(b));
}

export function renderVolATMScenarioTable(rows) {
  const container = document.getElementById('volScenarioTableData');
  if (!container) return;

  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeRows.length) {
    container.innerHTML = '<p>No Vol scenario data available</p>';
    return;
  }

  const optionTenors = sortTenors(safeRows.map(r => r.option_tenor));
  const swapTenors = sortTenors(safeRows.map(r => r.swap_tenor));

  const valueMap = new Map();

  safeRows.forEach(row => {
    const optionTenor = String(row.option_tenor || '').trim();
    const swapTenor = String(row.swap_tenor || '').trim();
    const value = Number(row.atm_vol ?? row.vol);

    if (!optionTenor || !swapTenor) return;

    valueMap.set(`${optionTenor}|${swapTenor}`, Number.isFinite(value) ? value : '');
  });

  let html = `
    <div class="table-card">
      <h4>Swaption ATM Vol Scenario Builder</h4>

      <div style="overflow:auto; max-width:100%;">
        <table class="ml-table">
          <thead>
            <tr>
              <th>OPTION \\ SWAP</th>
  `;

  swapTenors.forEach(swapTenor => {
    html += `<th>${swapTenor}</th>`;
  });

  html += `
            </tr>
          </thead>
          <tbody>
  `;

  optionTenors.forEach(optionTenor => {
    html += `<tr>`;
    html += `<td><strong>${optionTenor}</strong></td>`;

    swapTenors.forEach(swapTenor => {
      const key = `${optionTenor}|${swapTenor}`;
      const value = valueMap.get(key) ?? '';

      html += `
        <td>
          <div style="display:flex; gap:4px; align-items:center;">
            <input
              type="number"
              step="0.01"
              value="${value}"
              data-option-tenor="${optionTenor}"
              data-swap-tenor="${swapTenor}"
              style="width:75px;"
            />

            <button
              class="vol-fill-right-btn"
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

export function bindVolATMFillRight(showMessage) {
  const container = document.getElementById('volScenarioTableData');
  if (!container) return;

  container.onclick = (e) => {
    if (!e.target.classList.contains('vol-fill-right-btn')) return;

    const cell = e.target.closest('td');
    if (!cell) return;

    const input = cell.querySelector('input[data-swap-tenor]');
    if (!input) return;

    const value = input.value;
    let nextCell = cell.nextElementSibling;

    while (nextCell) {
      const nextInput = nextCell.querySelector('input[data-swap-tenor]');
      if (nextInput) nextInput.value = value;
      nextCell = nextCell.nextElementSibling;
    }

    showMessage?.('Nach rechts gefüllt', 'success');
  };
}