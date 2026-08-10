'use strict';

import { handleModalAction } from '../../../../core/ui/modal/modalActions.js';
import { appState } from '../../../../renderer.js';
import { ensureRendered } from '../../../../utils/domHelpers.js';
import { renderMvarFactorChart, highlightScenarioRow } from './mvarFactorChartPanel.js';

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
// ROLLING-Intervalle (Baseline, werden IMMER gerechnet) in eine eigene Tabelle OBEN;
// darunter die Stress-Szenarien als MEHRFACH-Auswahl (is_selected) -> nur die
// angehakten werden zusaetzlich gerechnet. Die ROLLING-Auswahl (scenario-radio) bleibt
// die View-/Baseline-Quelle (selectedMvarInterval).
const COLUMN_HEADERS = [
  'Customer Default', 'INTERVAL_NAME', 'START', 'END', 'VaR_Days',
  'Confidence', 'Risk Warning Profile', 'VaR Yellow', 'VaR Red', 'ES Yellow', 'ES Red', 'Edit',
];

function scenarioRowHtml(r, mode, scenarioSet) {
  const isDefault = Number(r.is_customer_default) === 1;
  const interval = escapeHtml(r.INTERVAL_NAME);
  const idAttr = r.id ?? '';

  // mode 'rolling' -> Single-Select-Radio (View/Baseline); 'scenario' -> Mehrfach-Checkbox.
  // Der Haken kommt aus der SESSION-Auswahl (scenarioSet), NICHT direkt aus is_selected
  // -> ungespeicherte Aenderungen ueberleben Re-Renders; gespeichert wird erst per Button.
  const checked = mode === 'scenario' && scenarioSet && scenarioSet.has(String(r.INTERVAL_NAME));
  const selCell = mode === 'rolling'
    ? `<input type="checkbox" name="scenario-select" class="scenario-radio scenario-checkbox" data-interval="${interval}" data-id="${escapeHtml(idAttr)}">`
    : `<input type="checkbox" class="scenario-calc-cb" data-interval="${interval}" data-id="${escapeHtml(idAttr)}" ${checked ? 'checked' : ''}>`;

  return '<tr>'
    + `<td>${selCell}</td>`
    + `<td>${isDefault ? '<span class="customer-default-badge">Customer Default</span>' : ''}</td>`
    + `<td>${interval}</td>`
    + `<td>${escapeHtml(r.START)}</td>`
    + `<td>${escapeHtml(r.END)}</td>`
    + `<td>${escapeHtml(r.VaR_Days)}</td>`
    + `<td>${fmtConfidencePct(r.Confidence)}</td>`
    + `<td>${escapeHtml(r.risk_warning_profile ?? 'BALANCED')}</td>`
    + `<td>${fmtLossPct(r.var_yellow_loss_limit)}</td>`
    + `<td>${fmtLossPct(r.var_red_loss_limit)}</td>`
    + `<td>${fmtLossPct(r.es_yellow_loss_limit)}</td>`
    + `<td>${fmtLossPct(r.es_red_loss_limit)}</td>`
    + `<td><button class="edit-button" data-id="${escapeHtml(idAttr)}">Edit</button></td>`
    + '</tr>';
}

function scenarioTableHtml(title, subtitle, rws, mode, firstHeader, scenarioSet) {
  if (!rws.length) return '';
  let h = `<div class="mvar-scenario-block"><h4 class="table-title">${title}</h4>`;
  if (subtitle) h += `<p class="mvar-caption" style="margin:2px 0 6px;">${escapeHtml(subtitle)}</p>`;
  h += (mode === 'rolling' ? '<table id="dataTable">' : '<table class="mvar-scenario-table">') + '<thead><tr>';
  h += `<th class="table-header">${firstHeader}</th>`;
  COLUMN_HEADERS.forEach((hd) => { h += `<th class="table-header">${hd}</th>`; });
  h += '</tr></thead><tbody>';
  rws.forEach((r) => { h += scenarioRowHtml(r, mode, scenarioSet); });
  h += '</tbody></table>';
  // Save-Button unter der Szenario-Tabelle (persistiert die Session-Auswahl).
  if (mode === 'scenario') {
    h += '<div class="mvar-scenario-save" style="margin:8px 0 4px; display:flex; align-items:center; gap:10px;">'
      + '<button id="mvarSelectionSaveBtn" class="edit-button">Save selection</button>'
      + '<span id="mvarSelectionSaveStatus" class="mvar-caption"></span>'
      + '</div>';
  }
  h += '</div>';
  return h;
}

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

  const isRolling = (r) => /^ROLLING/i.test(String(r.INTERVAL_NAME ?? '').trim());
  const rollingRows = rows.filter(isRolling);
  const scenarioRows = rows.filter((r) => !isRolling(r));

  const scenarioSet = ensureSessionScenarioSet(scenarioRows);

  container.innerHTML =
    scenarioTableHtml('Rolling window', 'Always calculated (baseline).', rollingRows, 'rolling', 'View', null) +
    scenarioTableHtml('Stress scenarios', 'Select scenarios to calculate, then Save.', scenarioRows, 'scenario', 'Calculate', scenarioSet);

  wireSelection(container);
  wireScenarioCalcSelection(container);
  wireSaveSelection(container, scenarioRows);
  wireEditButtons(container);
  wireRowHighlight(container);

  // Risk-Factor-Viewer (Checklist + Multi-Line-Chart aus tblTS) unter der Tabelle.
  try { renderMvarFactorChart(); } catch (e) { console.warn('[mvarFactorChart] render failed', e); }

  console.log('[MVAR MODEL SELECTION UI]', {
    source: 'v_MVAR_MODEL_SELECTION_APP',
    rolling: rollingRows.length,
    scenarios: scenarioRows.length,
    selectedForCalc: scenarioRows.filter((r) => Number(r.is_selected) === 1).map((r) => r.INTERVAL_NAME),
  });
}

// Session-Auswahl der zu rechnenden Stress-Szenarien (Set von INTERVAL_NAME). Wird EINMAL
// pro Session aus dem gespeicherten is_selected initialisiert; danach ist SIE die Quelle
// der Wahrheit fuer die Checkboxen -> ungespeicherte Aenderungen ueberleben Re-Renders.
function ensureSessionScenarioSet(scenarioRows) {
  if (!(appState.mvarSelectedScenarios instanceof Set)) {
    const init = (scenarioRows || [])
      .filter((r) => Number(r.is_selected) === 1)
      .map((r) => String(r.INTERVAL_NAME));
    appState.mvarSelectedScenarios = new Set(init);
  }
  return appState.mvarSelectedScenarios;
}

// Anhaken -> nur SESSION (Set aktualisieren), KEIN DB-Write. Gespeichert wird per Button.
function wireScenarioCalcSelection(container) {
  const set = appState.mvarSelectedScenarios instanceof Set ? appState.mvarSelectedScenarios : null;
  if (!set) return;
  container.querySelectorAll('input.scenario-calc-cb').forEach((cb) => {
    cb.addEventListener('change', () => {
      const name = String(cb.getAttribute('data-interval') || '').trim();
      if (!name) return;
      if (cb.checked) set.add(name); else set.delete(name);
      const st = document.getElementById('mvarSelectionSaveStatus');
      if (st) st.textContent = 'Unsaved changes';
    });
  });
}

// Klick auf eine Szenario-Zeile -> deren Zeitraum (START..END) im Factor-Chart schattieren.
// Delegiert und EINMAL pro Container gebunden (der Container bleibt ueber Re-Renders bestehen,
// nur sein innerHTML wird ersetzt), daher ueberlebt der Listener das Neu-Rendern.
function wireRowHighlight(container) {
  if (container.dataset.rowHlBound === '1') return;
  container.dataset.rowHlBound = '1';
  container.addEventListener('click', (e) => {
    const tr = e.target.closest('tr');
    if (!tr || !container.contains(tr)) return;
    const interval = tr.querySelector('[data-interval]')?.dataset.interval;
    if (interval) highlightScenarioRow(interval);
  });
}

// Save-Button -> persistiert die Session-Auswahl nach MVaRInput.is_selected (0/1) je
// Szenario-Zeile ueber den generischen 'update-data'-Kanal (customer-level, ueberlebt Neustart).
function wireSaveSelection(container, scenarioRows) {
  const btn = container.querySelector('#mvarSelectionSaveBtn');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const set = appState.mvarSelectedScenarios instanceof Set ? appState.mvarSelectedScenarios : new Set();
    const st = document.getElementById('mvarSelectionSaveStatus');
    try {
      (scenarioRows || []).forEach((r) => {
        if (r.id == null) return;
        window.api.send('update-data', {
          cleanTableName: TABLE_MVAR,
          uniqueIdentifier: { column: 'id', value: Number(r.id) },
          newData: { is_selected: set.has(String(r.INTERVAL_NAME)) ? 1 : 0 },
        });
      });
      if (st) st.textContent = 'Saved.';
    } catch (e) {
      console.warn('[mvar] save selection failed', e);
      if (st) st.textContent = 'Save failed.';
    }
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
