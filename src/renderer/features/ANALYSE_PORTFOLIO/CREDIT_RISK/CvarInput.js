import { appState } from '../../../renderer.js';
import { handleModalAction } from '../../../core/ui/modal/modalActions.js';
import { ensureRendered } from '../../../utils/domHelpers.js';

// Data columns of the CVaR General Settings table (CreditVaRInput). Select /
// Customer Default / Edit are control columns added directly in the renderer.
const CVAR_CONFIG_COLUMNS = [
  'name',
  'conf_level',
  'corr',
  'recovery_rate',
  'horizon_days',
  'n_simulations',
  'description',
  'cr_model',
];

// Table name in the generic table-/form-system (Edit/Add modal field set).
const TABLE_CVAR_CONFIG = 'CreditVaRInput';
const CONTAINER_ID = 'inputCreditVaRConfigContainer';

// ---- formatting ----------------------------------------------------------
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// conf_level / recovery_rate as percent (0.999 -> "99.90%"), matching the
// previous processData formatting (decimals: 2, multiplyBy100).
function fmtPct(value) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : escapeHtml(value);
}

// Plain numeric / text value (corr, horizon_days, n_simulations).
function fmtNum(value) {
  if (value === null || value === undefined || value === '') return '-';
  return escapeHtml(value);
}

// ---- CVaR General Settings table (Model-Selection style, like Market Risk) --
export function handleCvarInput() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) {
    console.warn('⚠️ Container #inputCreditVaRConfigContainer nicht gefunden.');
    return;
  }

  while (container.firstChild) container.removeChild(container.firstChild);

  // Edit/Add modal flow stays untouched: keep the old CreditVaRInput store populated
  // so the (unchanged) Add/Edit modal below keeps working exactly as before.
  // Anzeige-, Edit- und Engine-Quelle sind dieselbe Risk-Config-Tabelle:
  // CreditVaRInput. Hier lebt u.a. n_simulations — bewusst NICHT im Customer Setup.
  const rows = appState.getCvarInput() || [];
  appState.setCvarInput(rows);

  // Customer-Default-Kennzeichnung kommt weiterhin aus dem Customer Setup
  // (default_credit_config_name); die editierbaren Config-Werte selbst stammen
  // aus CreditVaRInput (Risk Config).
  const customerSetting = appState.getCustomerCreditRiskSetting?.() || null;
  const customerDefaultConfigName = customerSetting?.default_credit_config_name ?? null;

  // Default-selected config (kept from the previous radio behaviour): the active
  // row (is_active = 1), otherwise the last row.
  let activeIndex = rows.findIndex((r) => r.is_active === 1 || r.is_active === true);
  if (activeIndex === -1 && rows.length > 0) activeIndex = rows.length - 1;

  const selectedConfigName = activeIndex >= 0 ? (rows[activeIndex]?.name ?? null) : null;

  console.log('[CVAR GENERAL SETTINGS RENDER]', {
    customerSetting: appState.getCustomerCreditRiskSetting?.(),
    tableDataCount: rows.length,
  });

  console.log('[CREDIT RISK GENERAL SETTINGS DISPLAY]', {
    selectedConfigName,
    customerDefaultConfigName,
    rows,
  });

  if (!rows.length) {
    container.innerHTML =
      '<table id="dataTable"><thead><tr><th>No data available</th></tr></thead><tbody></tbody></table>';
    return;
  }

  const headers = [
    'Select', 'Customer Default', 'name', 'conf_level', 'corr', 'recovery_rate',
    'horizon_days', 'n_simulations', 'description', 'cr_model', 'Edit',
  ];

  let html = '<table id="dataTable"><thead><tr>';
  headers.forEach((h) => { html += `<th class="table-header">${h}</th>`; });
  html += '</tr></thead><tbody>';

  rows.forEach((r, i) => {
    const name = escapeHtml(r.name ?? '');
    const idAttr = r.id ?? '';
    const isDefault =
      customerDefaultConfigName != null &&
      String(r.name) === String(customerDefaultConfigName);
    const checkedAttr = i === activeIndex ? 'checked' : '';

    html += '<tr>';
    // Select = session single-select. Class .cvar-radio + data-name are kept so the
    // existing run logic (CVaRButton -> '.cvar-radio:checked' -> data-name) keeps
    // working unchanged; only radio -> checkbox changed.
    html += `<td><input type="checkbox" name="cvar-config" class="cvar-radio cvar-checkbox" data-name="${name}" data-id="${escapeHtml(idAttr)}" ${checkedAttr}></td>`;
    // Customer Default badge where row.name === default_credit_config_name.
    html += `<td>${isDefault ? '<span class="customer-default-badge">Customer Default</span>' : ''}</td>`;
    html += `<td>${name}</td>`;
    html += `<td>${fmtPct(r.conf_level)}</td>`;
    html += `<td>${fmtNum(r.corr)}</td>`;
    html += `<td>${fmtPct(r.recovery_rate)}</td>`;
    html += `<td>${fmtNum(r.horizon_days)}</td>`;
    html += `<td>${fmtNum(r.n_simulations)}</td>`;
    html += `<td>${escapeHtml(r.description ?? '')}</td>`;
    html += `<td>${escapeHtml(r.cr_model ?? '')}</td>`;
    // Edit operates on the CreditVaRInput row at this index (unchanged modal flow).
    html += `<td><button class="edit-button" data-row="${i}">Edit</button></td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  wireCvarSelection(container);
  wireCvarButtons(container);
}

// Single-select: activating one checkbox deactivates all others in this table.
function wireCvarSelection(container) {
  const checkboxes = container.querySelectorAll('input.cvar-radio');
  if (!checkboxes.length) return;

  const applySelection = (el) => {
    if (!el) return;
    checkboxes.forEach((other) => { if (other !== el) other.checked = false; });
    el.checked = true;
  };

  checkboxes.forEach((cb) => {
    cb.addEventListener('click', () => applySelection(cb));
  });
}

// Add / Edit buttons -> existing modal flow (unchanged).
function wireCvarButtons(container) {
  ensureRendered(async () => {
    const reloadConfig = async () => { handleCvarInput(); };

    const addButton = document.getElementById('cvarConfigAddButton');
    if (addButton) {
      addButton.onclick = (event) => {
        handleModalAction(
          event,
          appState.getCvarInput() || [],
          null,                     // kein rowIndex -> ADD
          TABLE_CVAR_CONFIG,
          'add',
          { modalId: 'editModal', onReload: reloadConfig },
        );
      };
    }

    container.querySelectorAll('.edit-button').forEach((button) => {
      button.onclick = (event) => {
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleModalAction(
          event,
          appState.getCvarInput() || [],
          rowIndex,
          TABLE_CVAR_CONFIG,
          'edit',
          { modalId: 'editModal', onReload: reloadConfig },
        );
      };
    });
  });
}
