'use strict';

let csScenarioPanelListenersInstalled = false;

export function renderCSScenarioPanel() {
  console.log('🔥 renderCSScenarioPanel CALLED');

  if (!csScenarioPanelListenersInstalled) {
    document.addEventListener('cs:scenario:ready', () => {
      renderCSScenarioPanel();
    });

    document.addEventListener('cs:active:ready', () => {
      renderCSScenarioPanel();
    });

    csScenarioPanelListenersInstalled = true;
  }

  const container = document.getElementById('csScenarioContainer');
  if (!container) return;

  const appState = window.appState;
  if (!appState) return;

  const scenariosData = appState.getCSScenarioData?.() || [];
  const activeRows = appState.getCSActive?.() || [];

  const scenarios = [...new Set([
    'BASE',
    ...scenariosData
      .map(r => String(r.scenario_id || '').trim())
      .filter(Boolean)
  ])].sort((a, b) => {
    if (a === 'BASE') return -1;
    if (b === 'BASE') return 1;
    return a.localeCompare(b);
  });

  if (!scenarios.length) {
    container.innerHTML = '<p>No valid CS scenarios</p>';
    return;
  }

  let activeScenario = 'BASE';

  if (activeRows.length) {
    const active = activeRows[0];
    activeScenario = String(active?.scenario_name || 'BASE').trim() || 'BASE';
  }

  if (!scenarios.includes(activeScenario)) {
    activeScenario = 'BASE';
  }

  let html = '<select id="csScenarioSelect">';

  scenarios.forEach(scenario => {
    const selected = scenario === activeScenario ? 'selected' : '';
    html += `<option value="${scenario}" ${selected}>${scenario}</option>`;
  });

  html += '</select>';

  container.innerHTML = html;

  const select = document.getElementById('csScenarioSelect');
  const applyBtn = document.getElementById('applyCSScenarioChanges');

  if (!select || !applyBtn) return;

  applyBtn.onclick = async () => {
    const scenario_name = String(select.value || '').trim();
    if (!scenario_name) return;

    const result = await window.api.invoke('cs:set-active-scenario', {
      scenario_name
    });

    console.log('[CS PANEL] set active result', result);
  };
}