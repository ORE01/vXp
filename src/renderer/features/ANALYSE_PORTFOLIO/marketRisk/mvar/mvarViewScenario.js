'use strict';

// Ansichts-Szenario-Dropdown fuer die Market-Risk-Panels (Factors/Products/Issuers/
// Dashboard/Profit-Loss). Alle Panels rendern fuer appState.selectedMvarInterval; dieses
// Dropdown setzt es + refresht -> die Ansicht wird umgeschaltet, OHNE neu zu rechnen (alle
// ausgewaehlten Szenarien liegen nach "Calculate Market Risk" aktuell vor). Default ROLLING_1.
// Alle <select.mvar-view-scenario> werden synchron gehalten (in jedem Panel dasselbe Szenario).

const SELECT_SELECTOR = 'select.mvar-view-scenario';

// Verfuegbare (gerechnete) Szenarien = distinct scenario_name der Aggregat-Daten des
// aktuell gewaehlten Portfolios. ROLLING immer zuerst.
function availableScenarios(appState) {
  const norm = (s) => String(s ?? '').replace(/^Portfolios[_-]?/i, '').trim();
  const port = norm(appState.getSelectedPortTableName?.());
  const agg = appState.getAllMvarData?.() || [];

  const names = [...new Set(
    agg
      .filter((r) => !port || norm(r?.port_name) === port)
      .map((r) => String(r?.scenario_name ?? r?.SCENARIO_NAME ?? '').trim())
      .filter(Boolean)
  )];

  names.sort((a, b) => {
    const ar = /^ROLLING/i.test(a) ? 0 : 1;
    const br = /^ROLLING/i.test(b) ? 0 : 1;
    return ar - br || a.localeCompare(b);
  });
  return names;
}

export function syncMvarViewDropdowns() {
  const appState = window.appState;
  if (!appState) return;

  const selects = document.querySelectorAll(SELECT_SELECTOR);
  if (!selects.length) return;

  const scenarios = availableScenarios(appState);

  // Aktuelles View-Szenario: selectedMvarInterval, sonst ROLLING_1, sonst erstes.
  let current = String(appState.selectedMvarInterval ?? '').trim();
  if (!current || !scenarios.includes(current)) {
    current = scenarios.find((s) => /^ROLLING/i.test(s)) || scenarios[0] || current;
    if (current) appState.selectedMvarInterval = current;
  }

  const optsKey = scenarios.join('|');
  const optsHtml = scenarios.length
    ? scenarios.map((s) => `<option value="${s}">${s}</option>`).join('')
    : '<option value="">(no scenarios)</option>';

  selects.forEach((sel) => {
    // Optionen nur bei Aenderung neu setzen (kein Flackern/Fokusverlust).
    if (sel.dataset.opts !== optsKey) {
      sel.innerHTML = optsHtml;
      sel.dataset.opts = optsKey;
    }
    if (current) sel.value = current;

    if (sel.dataset.bound !== '1') {
      sel.dataset.bound = '1';
      sel.addEventListener('change', () => {
        const v = String(sel.value ?? '').trim();
        if (!v) return;
        appState.selectedMvarInterval = v;
        // Alle anderen Dropdowns nachziehen (gemeinsames View-Szenario).
        document.querySelectorAll(SELECT_SELECTOR).forEach((o) => { if (o !== sel) o.value = v; });
        try { appState.refreshMarketRiskUI?.(0); } catch (_) {}
      });
    }
  });
}
