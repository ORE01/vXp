'use strict';

export function renderVolSmileScenarioTable(rows) {
  const container = document.getElementById('volSmileScenarioTableData');
  if (!container) return;

  const safeRows = Array.isArray(rows) ? rows : [];

  if (!safeRows.length) {
    container.innerHTML = '<p>No Smile / Skew scenario data available</p>';
    return;
  }

  let html = `
    <div class="table-card">
      <h4>Swaption Smile / Skew Scenario Builder</h4>

      <div style="overflow:auto; max-width:100%;">
        <table class="ml-table">
          <thead>
            <tr>
              <th>Strike Spread BP</th>
              <th>Vol Spread</th>
            </tr>
          </thead>
          <tbody>
  `;

  safeRows.forEach(row => {
    const strikeSpreadBp = Number(
      row.strike_spread_bp ??
      row.StrikeSpreadBP ??
      row.smile_key
    );

    const volSpread = Number(
      row.vol_spread ??
      row.VolSpread ??
      row.adjustment
    );

    if (!Number.isFinite(strikeSpreadBp)) return;

    html += `
      <tr>
        <td><strong>${strikeSpreadBp}</strong></td>
        <td>
          <input
            type="number"
            step="0.0001"
            value="${Number.isFinite(volSpread) ? volSpread : ''}"
            data-strike-spread-bp="${strikeSpreadBp}"
            style="width:90px;"
          />
        </td>
      </tr>
    `;
  });

  html += `
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}