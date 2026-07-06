// CustomerReportsPresetUI.js
import { applyRiskPresetState } from './RiskPDFPreview.js';
import {
  listCustomerReports,
  loadCustomerReport,
  saveCustomerReport,
  deleteCustomerReport
} from './CustomerReports.js';
import { appState } from '../../../renderer/renderer.js';
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

    // Helper: Active report name in AppState (safe)
    const setActiveName = (name) => {
      const t = String(name || '').trim();
      try { appState?.setActiveCustomerReportName?.(t); } catch {}
      return t;
    };

    // âœ… Zentraler Refresh (damit Save/Delete den Dropdown aktualisieren)
    const refreshPresets = async (preferName = '') => {
      const prev = (preferName || dd.value || inp.value || '').trim();

      const rows = await listCustomerReports('risk');

      // Keep existing behavior (rows into appState)
      appState.setCustomerReportsData(rows);

      dd.innerHTML = rows.length
        ? rows.map(r => `<option value="${r.name}">${r.name}</option>`).join('')
        : `<option value="">(no presets)</option>`;

      // Auswahl wiederherstellen (falls mÃ¶glich)
      const names = new Set(rows.map(r => String(r.name)));
      const next = (prev && names.has(prev)) ? prev : (rows[0]?.name || '');

      dd.value = next;
      inp.value = next;

      // âœ… Single Source of Truth for current title
      setActiveName(next);
    };

    // 1) Initial load presets
    await refreshPresets();

    if (!wired) {
      wired = true;

      // âœ… Dropdown selection = active report name
      dd.addEventListener('change', () => {
        const name = (dd.value || '').trim();
        inp.value = name;
        setActiveName(name);
      });

      // âœ… Typing a name should also update active name (useful for export)
      inp.addEventListener('input', () => {
        setActiveName(inp.value);
      });

      btnLoad.addEventListener('click', async () => {
        const name = (dd.value || inp.value || '').trim();
        if (!name) return;

        // âœ… set active title immediately
        setActiveName(name);

        const row = await loadCustomerReport(name);
        if (!row?.state_json) return;

        try {
          applyRiskPresetState(JSON.parse(row.state_json));
        } catch (e) {
          console.warn('Invalid preset JSON', e);
        }

        // âœ… ensure UI reflects loaded preset name
        dd.value = name;
        inp.value = name;
        setActiveName(name);
      });

      btnSave.addEventListener('click', async () => {
        const name = (inp.value || '').trim();
        if (!name) return;

        // âœ… set active title immediately
        setActiveName(name);

        let state = {};
        try {
          state = JSON.parse(localStorage.getItem('rr-chart-state') || '{}');
        } catch (_) {
          state = {};
        }
        // Tabellen-Notizen mit ins Preset buendeln (eigener Key; wird beim Laden via
        // applyRiskPresetState wieder nach rr-table-notes geschrieben).
        try { state.__tableNotes = JSON.parse(localStorage.getItem('rr-table-notes') || '{}'); } catch (_) {}

        const ok = await saveCustomerReport(name, state, 'risk');

        // âœ… NACH SAVE: Dropdown neu laden (damit neuer Eintrag sofort sichtbar ist)
        if (ok) await refreshPresets(name);
      });

      btnDel.addEventListener('click', async () => {
        const name = (dd.value || inp.value || '').trim();
        if (!name) return;

        const ok = await deleteCustomerReport(name);

        // âœ… NACH DELETE: Dropdown neu laden (damit gelÃ¶schter Eintrag verschwindet)
        if (ok) await refreshPresets('');
      });
    }
  });
}





