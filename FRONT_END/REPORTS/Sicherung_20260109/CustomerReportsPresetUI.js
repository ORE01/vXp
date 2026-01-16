import { applyRiskPresetState } from './RiskPDFPreview.js';
import {
  listCustomerReports,
  loadCustomerReport,
  saveCustomerReport,
  deleteCustomerReport
} from './CustomerReports.js';
import { appState } from '../../FRONT_END/renderer.js';
import { ensureRendered } from '../../utils/domHelpers.js';

let wired = false;

export function setupCustomerReportsPresetUI() {
  ensureRendered(async () => {
    const dd  = document.getElementById('customerReportsDropdown');
    const inp = document.getElementById('customerReportsNameInput');
    const btnLoad = document.getElementById('customerReportsLoadButton');
    const btnSave = document.getElementById('customerReportsSaveButton');
    const btnDel  = document.getElementById('customerReportsDeleteButton');

    if (!dd || !inp || !btnLoad || !btnSave || !btnDel) return;

    // ✅ Zentraler Refresh (damit Save/Delete den Dropdown aktualisieren)
    const refreshPresets = async (preferName = '') => {
      const prev = (preferName || dd.value || inp.value || '').trim();

      const rows = await listCustomerReports('risk');
      appState.setCustomerReportsData(rows);

      dd.innerHTML = rows.length
        ? rows.map(r => `<option value="${r.name}">${r.name}</option>`).join('')
        : `<option value="">(no presets)</option>`;

      // Auswahl wiederherstellen (falls möglich)
      const names = new Set(rows.map(r => String(r.name)));
      const next = (prev && names.has(prev)) ? prev : (rows[0]?.name || '');
      dd.value = next;
      inp.value = next;
    };

    // 1) Initial load presets
    await refreshPresets();

    if (!wired) {
      wired = true;

      dd.addEventListener('change', () => {
        inp.value = dd.value || '';
      });

      btnLoad.addEventListener('click', async () => {
        const name = (dd.value || inp.value || '').trim();
        if (!name) return;

        const row = await loadCustomerReport(name);
        if (!row?.state_json) return;

        try {
          applyRiskPresetState(JSON.parse(row.state_json));
        } catch (e) {
          console.warn('Invalid preset JSON', e);
        }
      });

      btnSave.addEventListener('click', async () => {
        const name = (inp.value || '').trim();
        if (!name) return;

        let state = {};
        try {
          state = JSON.parse(localStorage.getItem('rr-chart-state') || '{}');
        } catch (_) {
          state = {};
        }

        const ok = await saveCustomerReport(name, state, 'risk');

        // ✅ NACH SAVE: Dropdown neu laden (damit neuer Eintrag sofort sichtbar ist)
        if (ok) await refreshPresets(name);
      });

      btnDel.addEventListener('click', async () => {
        const name = (dd.value || inp.value || '').trim();
        if (!name) return;

        const ok = await deleteCustomerReport(name);

        // ✅ NACH DELETE: Dropdown neu laden (damit gelöschter Eintrag verschwindet)
        if (ok) await refreshPresets('');
      });
    }
  });
}

