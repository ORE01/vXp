// REPORTS/CustomerReportsPresetUI.js
import { appState } from '../../FRONT_END/renderer.js';
import { ensureRendered } from '../../utils/domHelpers.js';
import { listCustomerReports, loadCustomerReport, saveCustomerReport, deleteCustomerReport } from './CustomerReports.js';

const CHART_STATE_KEY = 'rr-chart-state';

function loadChartToggleState() {
  try { return JSON.parse(localStorage.getItem(CHART_STATE_KEY) || '{}'); }
  catch { return {}; }
}

function applyChartStateToDOM(state = {}) {
  document.querySelectorAll('input[data-chart-section][data-chart-key]').forEach(el => {
    const sec = el.dataset.chartSection;
    const key = el.dataset.chartKey;
    const v = state[`${sec}:${key}`];
    el.checked = (typeof v === 'boolean') ? v : true;
  });

  document.querySelectorAll('input[data-section-key]').forEach(el => {
    const sec = el.dataset.sectionKey;
    const v = state[`${sec}:__section__`];
    el.checked = (typeof v === 'boolean') ? v : true;
  });

  try { localStorage.setItem(CHART_STATE_KEY, JSON.stringify(state)); } catch {}
  try { scheduleRiskPreviewRender(); } catch {}
}

function fillDropdown() {
  const dd = document.getElementById('customerReportsDropdown');
  const nameInput = document.getElementById('customerReportsNameInput');
  if (!dd || !nameInput) return false;

  const rows = appState.getCustomerReportsData() || [];
  dd.innerHTML = rows.length
    ? rows
        .filter(r => r?.name)
        .sort((a,b) => String(a.name).localeCompare(String(b.name)))
        .map(r => `<option value="${String(r.name)}">${String(r.name)}</option>`)
        .join('')
    : `<option value="">(no presets)</option>`;

  if (!nameInput.value && dd.value) nameInput.value = dd.value;
  return true;
}

let __crPresetWired = false;

export function setupCustomerReportsPresetUI() {
  // Guard: diese Funktion darf bei reports:enter öfter aufgerufen werden
  // (weil Panels wechseln), aber Events binden wir nur einmal.
  ensureRendered(async () => {
    const dd        = document.getElementById('customerReportsDropdown');
    const nameInput = document.getElementById('customerReportsNameInput');
    const btnLoad   = document.getElementById('customerReportsLoadButton');
    const btnSave   = document.getElementById('customerReportsSaveButton');
    const btnDel    = document.getElementById('customerReportsDeleteButton');

    if (!dd || !nameInput || !btnLoad || !btnSave || !btnDel) {
      // Risk Panel evtl. noch nicht offen
      return;
    }

    // 1) Daten holen + in AppState speichern + Dropdown füllen
    const rows = await listCustomerReports('risk');
    appState.setCustomerReportsData(rows);
    fillDropdown();

    // 2) Events nur einmal binden
    if (__crPresetWired) return;
    __crPresetWired = true;

    dd.addEventListener('change', () => {
      nameInput.value = dd.value || '';
    });

    btnLoad.addEventListener('click', async () => {
      const name = (dd.value || nameInput.value || '').trim();
      if (!name) return;

      const row = await loadCustomerReport(name);
      if (!row?.state_json) return;

      try {
        const st = JSON.parse(row.state_json);
        applyChartStateToDOM(st);
      } catch (e) {
        console.warn('[CR] invalid state_json', e);
      }
    });

    btnSave.addEventListener('click', async () => {
      const name = (nameInput.value || dd.value || '').trim();
      if (!name) return;

      const ok = await saveCustomerReport(name, loadChartToggleState(), 'risk');
      if (!ok) return;

      // Refresh list + dropdown
      const rows2 = await listCustomerReports('risk');
      appState.setCustomerReportsData(rows2);
      fillDropdown();

      dd.value = name;
      nameInput.value = name;
    });

    btnDel.addEventListener('click', async () => {
      const name = (dd.value || nameInput.value || '').trim();
      if (!name) return;

      const ok = await deleteCustomerReport(name);
      if (!ok) return;

      const rows2 = await listCustomerReports('risk');
      appState.setCustomerReportsData(rows2);
      fillDropdown();

      nameInput.value = '';
    });
  });
}
