// CustomerReportsPresetUI.js
import { applyRiskPresetState, saveChartToggleStateFromDOM } from './RiskPDFPreview.js';
import {
  listCustomerReports,
  loadCustomerReport,
  saveCustomerReport,
  deleteCustomerReport
} from './CustomerReports.js';
import { appState } from '../../../renderer/renderer.js';
import { ensureRendered } from '../../utils/domHelpers.js';
import { showConfirmationBox } from '../../core/ui/dialogs/confirm.js';

let wired = false;

// Kurzes Bestaetigungs-Feedback direkt am Button: Label wechselt (z.B. "✓ Saved"),
// Button ist waehrenddessen gesperrt (Schutz gegen Mehrfach-Klicks), danach
// automatischer Reset auf das Original-Label.
function flashButton(btn, text, ok = true, ms = 1600) {
  if (!btn || btn.dataset.flashing === '1') return;
  btn.dataset.flashing = '1';
  const orig = btn.textContent;
  btn.textContent = text;
  btn.disabled = true;
  if (!ok) btn.style.opacity = '0.7';
  setTimeout(() => {
    btn.textContent = orig;
    btn.disabled = false;
    btn.style.opacity = '';
    delete btn.dataset.flashing;
  }, ms);
}

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
    const refreshPresets = async (preferName = '', { autoLoad = true } = {}) => {
      const prev = (preferName || dd.value || inp.value || '').trim();

      const rows = await listCustomerReports('risk');

      // Keep existing behavior (rows into appState)
      appState.setCustomerReportsData(rows);

      dd.innerHTML = rows.length
        ? `<option value="">(none)</option>` + rows.map(r => `<option value="${r.name}">${r.name}</option>`).join('')
        : `<option value="">(no presets)</option>`;

      // Auswahl wiederherstellen NUR wenn es eine gab (Session). Sonst LEER lassen
      // (Reload = nichts vorausgewaehlt), NICHT auf den ersten Report springen.
      const names = new Set(rows.map(r => String(r.name)));
      const next = (prev && names.has(prev)) ? prev : '';

      dd.value = next;
      inp.value = next;

      // âœ… Single Source of Truth for current title
      setActiveName(next);

      // Session-Rueckkehr: wenn eine Auswahl wiederhergestellt wurde, den Report AUTOMATISCH
      // aus der DB laden (genau wie der Load-Button) — damit die Haekchen WIRKLICH gesetzt
      // sind und nicht nur der Name im Dropdown steht. Bei frischem Start/Reload ist `next`
      // leer -> kein Auto-Load -> "nichts vorausgewaehlt".
      if (next && autoLoad) {
        try {
          const row = await loadCustomerReport(next);
          if (row?.state_json) applyRiskPresetState(JSON.parse(row.state_json));
        } catch (e) {
          console.warn('[reports] auto-load preset failed', e);
        }
      }
    };

    // 1) Initial load presets — die zuletzt gewaehlte Session-Auswahl BEHALTEN
    //    (statt beim erneuten Betreten des Panels auf den ersten Eintrag zu springen).
    //    Der aktive Report-Name liegt session-persistent im appState.
    await refreshPresets((appState?.getActiveCustomerReportName?.() || '').trim());

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
        if (!row?.state_json) { flashButton(btnLoad, '✗ not found', false); return; }

        try {
          applyRiskPresetState(JSON.parse(row.state_json));
          flashButton(btnLoad, '✓ Loaded');
        } catch (e) {
          console.warn('Invalid preset JSON', e);
          flashButton(btnLoad, '✗ invalid', false);
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

        const doSave = async () => {
          // ABSICHERUNG: erst den AKTUELL sichtbaren Checkbox-Zustand aus dem DOM in
          // rr-chart-state schreiben (merged, verwirft nichts) -> Save speichert GENAU den
          // sichtbaren Stand, nie einen veralteten/leeren. Verhindert Datenverlust.
          try { saveChartToggleStateFromDOM(); } catch (_) {}

          let state = {};
          try {
            state = JSON.parse(localStorage.getItem('rr-chart-state') || '{}');
          } catch (_) {
            state = {};
          }
          // Tabellen-Notizen mit ins Preset buendeln (eigener Key; wird beim Laden via
          // applyRiskPresetState wieder nach rr-table-notes geschrieben).
          try { state.__tableNotes = JSON.parse(localStorage.getItem('rr-table-notes') || '{}'); } catch (_) {}
          // Anzeige-Titel des PDFs mit im Preset speichern (getrennt vom Report-Namen).
          try { state.__reportTitle = (document.getElementById('reportDisplayTitleInput')?.value || '').trim(); } catch (_) {}

          const ok = await saveCustomerReport(name, state, 'risk');
          flashButton(btnSave, ok ? '✓ Saved' : '✗ failed', ok);

          // NACH SAVE: Dropdown aktualisieren, aber NICHT auto-laden — der sichtbare
          // Zustand ist bereits der gespeicherte; ein Re-Apply koennte die Checkboxen
          // ungewollt ueberschreiben (der gemeldete Bug).
          if (ok) await refreshPresets(name, { autoLoad: false });
        };

        // Ueberschreib-Abfrage, wenn bereits ein Report mit diesem Namen existiert.
        const exists = (appState?.getCustomerReportsData?.() || [])
          .some(r => String(r?.name ?? '').trim() === name);
        if (exists) {
          showConfirmationBox(
            `A report named "${name}" already exists. Overwrite it?`,
            () => { doSave(); },
            () => { flashButton(btnSave, 'Cancelled', false); },
          );
        } else {
          await doSave();
        }
      });

      btnDel.addEventListener('click', async () => {
        const name = (dd.value || inp.value || '').trim();
        if (!name) return;

        const ok = await deleteCustomerReport(name);
        flashButton(btnDel, ok ? '✓ Deleted' : '✗ failed', ok);

        // âœ… NACH DELETE: Dropdown neu laden (damit gelÃ¶schter Eintrag verschwindet)
        if (ok) await refreshPresets('');
      });
    }
  });
}





