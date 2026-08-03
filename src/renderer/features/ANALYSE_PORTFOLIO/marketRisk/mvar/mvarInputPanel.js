'use strict';

import { handleModalAction } from '../../../../core/ui/modal/modalActions.js';
import { appState } from '../../../../renderer.js';
import { ensureRendered } from '../../../../utils/domHelpers.js';
import { renderMvarFactorChart } from './mvarFactorChartPanel.js';

const TABLE_MVAR = 'MVaRInput';
const CONTAINER_ID = 'inputMvarContainer';

// Kept for the re-export in mvar/index.js (MVaRInput edit/add modal field set).
export const MVAR_COLUMNS = [
  'INTERVAL_NAME',
  'START',
  'END',
  'VaR_Days',
  'Confidence',
  'red_threshold',
  'yellow_threshold',
];

// ---- formatting ----------------------------------------------------------
function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Loss limits: -0.010 -> "-1.00 %"; null/undefined -> "-".
function fmtLossPct(value) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '-';
}

// Confidence as percent (0.95 -> "95.00 %"), as before.
function fmtConfidencePct(value) {
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  return Number.isFinite(n) ? `${(n * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : escapeHtml(value);
}

function reloadMVar() {
  // Re-fetch MVaRInput; REFRESH_DEPENDENCIES['MVaRInput'] also refreshes the view.
  window.api.send('fetch-table-data', TABLE_MVAR);
}

// ---- Model Selection table (read model = v_MVAR_MODEL_SELECTION_APP) ------
export function renderModelSelectionTable() {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  const rows = appState.getMvarModelSelectionAppRows?.() || [];

  if (!rows.length) {
    console.log('[MVAR MODEL SELECTION UI] no view rows available');
    container.innerHTML =
      '<table id="dataTable"><thead><tr><th>No data available</th></tr></thead><tbody></tbody></table>';
    try { renderMvarFactorChart(); } catch (e) { console.warn('[mvarFactorChart] render failed', e); }
    return;
  }

  const headers = [
    'Select', 'Customer Default', 'INTERVAL_NAME', 'START', 'END', 'VaR_Days',
    'Confidence', 'Risk Warning Profile', 'VaR Yellow', 'VaR Red', 'ES Yellow', 'ES Red', 'Edit',
  ];

  let html = '<table id="dataTable"><thead><tr>';
  headers.forEach((h) => { html += `<th class="table-header">${h}</th>`; });
  html += '</tr></thead><tbody>';

  rows.forEach((r, i) => {
    const isDefault = Number(r.is_customer_default) === 1;
    const interval = escapeHtml(r.INTERVAL_NAME);
    const idAttr = r.id ?? '';

    html += '<tr>';
    // Select = session single-select (kept). data-interval / data-id read by the run.
    html += `<td><input type="checkbox" name="scenario-select" class="scenario-radio scenario-checkbox" data-interval="${interval}" data-id="${escapeHtml(idAttr)}"></td>`;
    // Customer Default badge driven by the view column is_customer_default.
    html += `<td>${isDefault ? '<span class="customer-default-badge">Customer Default</span>' : ''}</td>`;
    html += `<td>${interval}</td>`;
    html += `<td>${escapeHtml(r.START)}</td>`;
    html += `<td>${escapeHtml(r.END)}</td>`;
    html += `<td>${escapeHtml(r.VaR_Days)}</td>`;
    html += `<td>${fmtConfidencePct(r.Confidence)}</td>`;
    html += `<td>${escapeHtml(r.risk_warning_profile ?? 'BALANCED')}</td>`;
    html += `<td>${fmtLossPct(r.var_yellow_loss_limit)}</td>`;
    html += `<td>${fmtLossPct(r.var_red_loss_limit)}</td>`;
    html += `<td>${fmtLossPct(r.es_yellow_loss_limit)}</td>`;
    html += `<td>${fmtLossPct(r.es_red_loss_limit)}</td>`;
    // Edit operates on MVaRInput only (START/END/VaR_Days/Confidence), never the view.
    html += `<td><button class="edit-button" data-id="${escapeHtml(idAttr)}">Edit</button></td>`;
    html += '</tr>';
  });

  html += '</tbody></table>';
  container.innerHTML = html;

  wireSelection(container);
  wireEditButtons(container);

  // Risk-Factor-Viewer (Checklist + Multi-Line-Chart aus tblTS) unter der Tabelle.
  try { renderMvarFactorChart(); } catch (e) { console.warn('[mvarFactorChart] render failed', e); }

  console.log('[MVAR MODEL SELECTION UI]', {
    source: 'v_MVAR_MODEL_SELECTION_APP',
    count: rows.length,
    customerDefaultRows: rows.filter((r) => Number(r.is_customer_default) === 1).length,
    selectedSessionInterval: appState.sessionSelectedMvarInterval || null,
  });
}

// Single-select + session/touched logic (unchanged behaviour).
function wireSelection(container) {
  const checkboxes = container.querySelectorAll('input.scenario-radio');
  if (!checkboxes.length) return;

  const intervalOf = (el) => el?.getAttribute('data-interval') || null;
  const findByInterval = (name) =>
    name ? Array.from(checkboxes).find((c) => intervalOf(c) === String(name)) : null;

  const names = Array.from(checkboxes).map(intervalOf).filter(Boolean);
  const nameSet = new Set(names);
  appState.mvarFallbackInterval =
    (nameSet.has('ROLLING_1') && 'ROLLING_1') ||
    (nameSet.has('STRESSED') && 'STRESSED') ||
    names[0] || null;

  const applySelection = (el, { userInitiated = false } = {}) => {
    if (!el) return;
    checkboxes.forEach((other) => { if (other !== el) other.checked = false; });
    el.checked = true;

    const idAttr = el.getAttribute('data-id');
    const selectedId = idAttr != null ? parseInt(idAttr, 10) : null;
    const interval = intervalOf(el);

    if (!Number.isNaN(selectedId) && selectedId != null) appState.selectedMvarId = selectedId;
    if (interval) appState.selectedMvarInterval = interval;

    if (userInitiated) {
      appState.marketRiskIntervalTouched = true;
      appState.sessionSelectedMvarInterval = interval || null;
      appState.mvarSelectedSource = 'USER_SELECTION';
    }

    if (typeof appState.refreshMarketRiskUI === 'function') {
      appState.refreshMarketRiskUI(0);
    }
  };

  checkboxes.forEach((cb) => {
    cb.addEventListener('click', () => applySelection(cb, { userInitiated: true }));
  });

  // Init: keep a touched session selection; otherwise customer default -> fallback.
  let target = null;
  if (appState.marketRiskIntervalTouched && appState.sessionSelectedMvarInterval) {
    target = findByInterval(appState.sessionSelectedMvarInterval);
  }
  if (!target) {
    const customerDefault =
      appState.getCustomerMarketRiskSetting?.()?.default_market_risk_interval_code || null;
    target =
      findByInterval(customerDefault) ||
      findByInterval('ROLLING_1') ||
      findByInterval('STRESSED') ||
      checkboxes[0];
    appState.mvarSelectedSource = customerDefault ? 'CUSTOMER_SETTING' : 'FALLBACK';
  }
  applySelection(target, { userInitiated: false });
}

// Edit buttons -> edit the matching MVaRInput row (model params only).
function wireEditButtons(container) {
  container.querySelectorAll('.edit-button[data-id]').forEach((button) => {
    button.onclick = (event) => {
      const id = button.getAttribute('data-id');
      const mvarRows = appState.getMvarInputData?.() || appState.mvarInputData || [];
      const rowIndex = mvarRows.findIndex((r) => String(r.id) === String(id));

      if (rowIndex < 0) {
        console.warn('[MVAR MODEL SELECTION UI] MVaRInput row not found for id', id);
        return;
      }

      handleModalAction(
        event,
        mvarRows,
        rowIndex,
        TABLE_MVAR,
        'edit',
        { modalId: 'editModal', onReload: reloadMVar },
      );
    };
  });
}

// MVaRInputData handler: keep the raw rows (for Add/Edit modal), wire Add, and
// re-render the view-based table.
export function handleMvarInputData(receivedData) {
  appState.setMvarInputData(receivedData);

  ensureRendered(() => {
    const mvarAddButton = document.getElementById('mvarAddButton');
    if (mvarAddButton) {
      mvarAddButton.onclick = (event) => {
        handleModalAction(
          event,
          appState.getMvarInputData?.() || appState.mvarInputData,
          null,
          TABLE_MVAR,
          'add',
          { modalId: 'editModal', onReload: reloadMVar },
        );
      };
    }

    renderModelSelectionTable();
  });
}
