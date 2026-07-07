// src/renderer/features/CUSTOMER_SETUP/customerDefaultPortfolioPanel.js
//
// Kundenweites Default-Portfolio (Customer Setup -> Trigger "Portfolio").
//   READ:  CustomerDefaultPortfolio (1 Zeile, id=1) -> DataPump -> installReceivers
//          -> dataRouter -> handleCustomerDefaultPortfolioData -> Store.
//   WRITE: generisches 'update-data' (uniqueIdentifier id=1) -> Pump re-pusht -> Store.
// Der Default wird in portfolioDropdownUI als LETZTER Selektions-Fallback genutzt
// (nur Haupt-Selektoren). Kein Default / kein Portfolio -> alles bleibt wie bisher.

import { appState } from '../../renderer.js';

const TABLE     = 'CustomerDefaultPortfolio';
const SELECT_ID = 'customerDefaultPortfolioSelect';
const SAVE_ID   = 'customerDefaultPortfolioSaveBtn';
const STATUS_ID = 'customerDefaultPortfolioStatus';

// DataPump-Row (id=1) -> Store. Liest NIE direkt aus der DB.
export function handleCustomerDefaultPortfolioData(rows) {
  const list = Array.isArray(rows) ? rows : [];
  const row = list.find((r) => Number(r?.id) === 1) || list[0] || null;
  const name = row && row.port_name != null ? String(row.port_name).trim() : '';
  appState.setDefaultPortfolio?.(name || null);
  renderCustomerDefaultPortfolioPanel();
  // Falls der Default NACH den Portfolios ankommt: jetzt einmalig anwenden.
  // (Kommt er davor, greift die einmalige Vorwahl in portfolioDropdownUI.)
  applyDefaultPortfolioToMainSelector({ force: false });
}

// Default AKTIV in die Haupt-Auswahl (createdPortDropdown0) setzen. Risk/Report
// spiegeln dropdown0, deshalb reicht dropdown0 + change-Event: das loest die
// bestehende Analyse-Pipeline aus und die Spiegel folgen beim Oeffnen.
// Guards: kein Default / nicht in der Liste / bereits einmal angewandt (ausser
// force) -> nichts tun, alles bleibt wie es ist.
export function applyDefaultPortfolioToMainSelector({ force = false } = {}) {
  const def = String(appState.getDefaultPortfolio?.() ?? '').trim();
  if (!def) return false;
  const dd0 = document.getElementById('createdPortDropdown0');
  if (!dd0 || !dd0.options || dd0.options.length === 0) return false;
  if (![...dd0.options].some((o) => o.value === def)) return false;
  if (!force && appState.__defaultPortfolioAppliedOnce) return false;
  appState.__defaultPortfolioAppliedOnce = true;
  if (dd0.value === def) return false; // schon aktiv -> kein unnoetiges Re-Render
  dd0.value = def;
  dd0.dispatchEvent(new Event('change', { bubbles: true }));
  return true;
}

function setStatus(msg, ok = true) {
  const el = document.getElementById(STATUS_ID);
  if (!el) return;
  el.textContent = msg || '';
  el.style.color = ok ? 'var(--text-muted)' : 'var(--danger, #d33)';
}

function escAttr(s) {
  return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
}

// Select mit den verfuegbaren Portfolios befuellen + aktuellen Default vorwaehlen.
export function renderCustomerDefaultPortfolioPanel() {
  const sel = document.getElementById(SELECT_ID);
  if (!sel) return;

  const names = (appState.getPortNameList?.() || [])
    .map((it) => String(it?.port_name ?? it?.table_name ?? '').trim())
    .filter(Boolean);
  const uniq = [...new Set(names)];

  const current = String(appState.getDefaultPortfolio?.() ?? '').trim();

  sel.innerHTML =
    `<option value="">— none —</option>` +
    uniq.map((n) => `<option value="${escAttr(n)}">${escAttr(n)}</option>`).join('');

  sel.value = uniq.includes(current) ? current : '';

  const el = document.getElementById(STATUS_ID);
  if (el && !el.textContent) {
    setStatus(current ? `Default portfolio: ${current}` : 'No default portfolio.');
  }
}

// Save-Button einmalig binden -> generisches update-data (id=1).
export function initCustomerDefaultPortfolioSave() {
  const btn = document.getElementById(SAVE_ID);
  if (!btn || btn.dataset.bound === '1') return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', () => {
    const sel = document.getElementById(SELECT_ID);
    const value = sel ? String(sel.value ?? '').trim() : '';
    setStatus('Saving…');
    try {
      window.api.send('update-data', {
        cleanTableName: TABLE,
        uniqueIdentifier: { column: 'id', value: 1 },
        newData: { port_name: value || null },
      });
    } catch (e) {
      setStatus('Save failed.', false);
      return;
    }
    // Optimistisch sofort in den Store (die Pump re-pusht ohnehin).
    appState.setDefaultPortfolio?.(value || null);
    // Sofort in die Haupt-Auswahl uebernehmen (Risk/Report spiegeln nach).
    // Leerer Wert ("— none —") -> nichts umschalten, alles bleibt wie es ist.
    if (value) applyDefaultPortfolioToMainSelector({ force: true });
    setStatus(value ? `Default portfolio saved: ${value}` : 'Default portfolio cleared.');
  });
}

// Beim Oeffnen des Panels: Liste rendern + Save binden.
export function initCustomerDefaultPortfolioPanel() {
  renderCustomerDefaultPortfolioPanel();
  initCustomerDefaultPortfolioSave();
}
