// FRONT_END/MARKET_DATA/PROVIDERS/providerUI.js

/**
 * Bind provider triggers to open panels.
 * Matches HTML:
 *  <button class="section-trigger" data-panel="panel-fed" ...>
 *
 * Important:
 * - uses event delegation (survives re-render)
 * - does NOT touch aria-expanded
 * - does NOT preventDefault / stopPropagation
 * - does NOT toggle display of containers/buttons
 */

// ====================================================================
// Provider-Auswahl (DATA PROVIDER tab)
//  - Historical Market Data: Mehrfachauswahl (Checkboxen ECB/Fed/Yahoo)
//  - Current Market Data:    genau EIN Provider (Radios); derzeit fix ERSTE,
//                            RLB ist vorgesehen aber deaktiviert.
//  Auswahl wird (renderer-only) in localStorage gehalten. Die Verdrahtung an
//  den tatsaechlichen Datenbezug (Get Market Data / Historic) erfolgt SPAETER;
//  dann wandert der Store nach valuexpro-settings.json (Main liest ihn).
// ====================================================================
const PROVIDER_LS_KEY = 'vxp.providerSelection';
const HIST_PROVIDERS = ['ECB', 'FED', 'YAHOO'];
const CURRENT_FIXED = 'ERSTE'; // derzeit einziger verfuegbarer Current-Provider

let _providerSelection = { hist: HIST_PROVIDERS.slice(), current: CURRENT_FIXED };

function _loadProviderSelection() {
  try {
    const raw = JSON.parse(localStorage.getItem(PROVIDER_LS_KEY) || 'null');
    if (raw && typeof raw === 'object') {
      const hist = Array.isArray(raw.hist)
        ? HIST_PROVIDERS.filter((id) => raw.hist.includes(id))
        : HIST_PROVIDERS.slice();
      // current bleibt derzeit fix ERSTE (RLB nicht auswaehlbar).
      return { hist, current: CURRENT_FIXED };
    }
  } catch (_) {}
  return { hist: HIST_PROVIDERS.slice(), current: CURRENT_FIXED };
}

function _saveProviderSelection() {
  try { localStorage.setItem(PROVIDER_LS_KEY, JSON.stringify(_providerSelection)); } catch (_) {}
}

function _applyProviderSelectionToControls() {
  HIST_PROVIDERS.forEach((id) => {
    const el = document.getElementById('provChk-' + id);
    if (el) el.checked = _providerSelection.hist.includes(id);
  });
  const er = document.getElementById('provRad-ERSTE');
  if (er) er.checked = true; // fix
}

/** Aktuelle Provider-Auswahl (fuer die spaetere Fetch-Verdrahtung). */
export function getProviderSelection() {
  return { hist: _providerSelection.hist.slice(), current: _providerSelection.current };
}

export function initProviderSelection() {
  if (window.__providerSelectionInit) return;
  window.__providerSelectionInit = true;

  _providerSelection = _loadProviderSelection();
  _applyProviderSelectionToControls();

  // Checkbox-Aenderungen (Historical) persistieren. Current-Radios sind derzeit
  // deaktiviert -> keine Aenderung moeglich.
  document.addEventListener('change', (e) => {
    const t = e.target;
    if (!t || !t.classList || !t.classList.contains('provider-toggle')) return;
    const id = t.getAttribute('data-provider');
    if (!HIST_PROVIDERS.includes(id)) return;
    const set = new Set(_providerSelection.hist);
    if (t.checked) set.add(id); else set.delete(id);
    _providerSelection.hist = HIST_PROVIDERS.filter((x) => set.has(x));
    _saveProviderSelection();
  });

  // Beim Oeffnen des DATA-PROVIDER-Tabs die Controls aus dem Store spiegeln.
  document.getElementById('DataProvider_Tab')
    ?.addEventListener('click', () => { setTimeout(_applyProviderSelectionToControls, 0); });
}

export function bindProviderPanelTriggers({ openPanel } = {}) {
  if (typeof openPanel !== 'function') {
    console.warn('[bindProviderPanelTriggers] openPanel missing');
    return;
  }

  if (window.__providerPanelTriggersBoundOnce) return;
  window.__providerPanelTriggersBoundOnce = true;

  document.addEventListener(
    'click',
    (e) => {
      const btn = e.target?.closest?.('.provider-triggers .section-trigger[data-panel]');
      if (!btn) return;

      const panelId = btn.getAttribute('data-panel');
      if (!panelId) return;

      // only open the panel; do not mutate the trigger UI
      openPanel(panelId);
    },
    true
  );
}

