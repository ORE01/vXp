'use strict';

/**
 * VOL SCENARIO PANEL
 * DEBUG = true  -> logs ON
 * DEBUG = false -> logs OFF
 */
const DEBUG = false;

function log(...args) {
  if (DEBUG) console.log(...args);
}

function warn(...args) {
  if (DEBUG) console.warn(...args);
}

function table(data) {
  if (DEBUG) console.table(data);
}

let volScenarioPanelListenersInstalled = false;
let lastSelectedVolScenario = null;

let originalAtmBaseRows = null;
let originalSmileBaseRows = null;

function getLatestActiveScenario(activeRows) {
  if (!Array.isArray(activeRows) || !activeRows.length) return 'BASE';

  const sortedActive = [...activeRows].sort(
    (a, b) => new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
  );

  return String(sortedActive[0]?.scenario_id || 'BASE').trim() || 'BASE';
}

function getAppStateRows(appState) {
  const atmScenarioRows =
    appState.getSwaptionAtmScenarioData?.()
    || appState._SWAPTION_ATM_SCENARIO_DATA
    || [];

  const smileScenarioRows =
    appState.getSwaptionSmileScenarioData?.()
    || appState._SWAPTION_SMILE_SCENARIO_DATA
    || [];

  const activeRows =
    appState.getSwaptionActive?.()
    || appState.getSwaptionActiveData?.()
    || appState._SWAPTION_ACTIVE
    || appState._swaptionActive
    || [];

  return {
    snapshots: Array.isArray(atmScenarioRows) ? atmScenarioRows : [],
    smileSnapshots: Array.isArray(smileScenarioRows) ? smileScenarioRows : [],
    activeRows: Array.isArray(activeRows) ? activeRows : []
  };
}

function rememberOriginalBaseRows(appState) {
  if (!originalAtmBaseRows) {
    const atmBase =
      appState.getSwaptionAtmBase?.()
      || appState._SWAPTION_ATM_BASE
      || [];

    if (Array.isArray(atmBase) && atmBase.length) {
      originalAtmBaseRows = atmBase.map(row => ({ ...row }));
      log('[VOL PANEL] remembered original ATM BASE:', originalAtmBaseRows.length);
    }
  }

  if (!originalSmileBaseRows) {
    const smileBase =
      appState.getSwaptionSmileBase?.()
      || appState._SWAPTION_SMILE_BASE
      || [];

    if (Array.isArray(smileBase) && smileBase.length) {
      originalSmileBaseRows = smileBase.map(row => ({ ...row }));
      log('[VOL PANEL] remembered original SMILE BASE:', originalSmileBaseRows.length);
    }
  }
}

function buildScenarioList({ snapshots, smileSnapshots, activeScenario }) {
  const atmIds = new Set(
    snapshots
      .map(row => String(row.scenario_id || '').trim())
      .filter(Boolean)
  );

  const smileIds = new Set(
    smileSnapshots
      .map(row => String(row.scenario_id || '').trim())
      .filter(Boolean)
  );

  const sharedScenarioIds = [...atmIds].filter(id => smileIds.has(id));

  return [
    ...new Set([
      'BASE',
      ...sharedScenarioIds,
      activeScenario
    ].filter(Boolean))
  ].sort((a, b) => {
    if (a === 'BASE') return -1;
    if (b === 'BASE') return 1;
    return a.localeCompare(b);
  });
}

async function applyVolScenario({ appState, scenario_id, persist = true }) {
  scenario_id = String(scenario_id || '').trim() || 'BASE';

  log('[VOL PANEL] applyVolScenario:', scenario_id, 'persist:', persist);

  rememberOriginalBaseRows(appState);

  if (persist) {
    const result = await window.api.invoke('swaption:set-active-scenario', {
      scenario_id,
      ccy: 'EUR',
      active_run_id: scenario_id === 'BASE' ? 'BASE' : 'ACTIVE'
    });

    if (!result?.success) {
      warn('[VOL PANEL] set active failed:', result?.error);
      return false;
    }
  }

  if (scenario_id === 'BASE') {
    const atmBaseRows = originalAtmBaseRows || [];
    const smileBaseRows = originalSmileBaseRows || [];

    if (!atmBaseRows.length) {
      warn('[VOL PANEL] no original BASE ATM rows found');
      return false;
    }

    appState.setSwaptionAtmBase?.(
      atmBaseRows.map(row => ({ ...row }))
    );

    if (smileBaseRows.length) {
      appState.setSwaptionSmileBase?.(
        smileBaseRows.map(row => ({ ...row }))
      );
    }

    document.dispatchEvent(new CustomEvent('swaption:atm:ready', {
      detail: {
        source: 'base',
        scenario_id: 'BASE',
        count: atmBaseRows.length
      }
    }));

    document.dispatchEvent(new CustomEvent('swaption:smile:ready', {
      detail: {
        source: 'base',
        scenario_id: 'BASE',
        count: smileBaseRows.length
      }
    }));

    document.dispatchEvent(new CustomEvent('swaption:cube:ready', {
      detail: {
        source: 'base',
        scenario_id: 'BASE'
      }
    }));

    return true;
  }

  const { snapshots, smileSnapshots } = getAppStateRows(appState);

  const selectedRows = snapshots
      .filter(row => String(row.scenario_id || '').trim() === scenario_id)
      .map(row => ({
        ...row,
        atm_vol: Number(row.atm_vol ?? row.vol)
      }));

  const selectedSmileRows = smileSnapshots
    .filter(row => String(row.scenario_id || '').trim() === scenario_id)
    .map(row => ({ ...row }));

  if (!selectedRows.length) {
    warn('[VOL PANEL] no ATM rows found for scenario:', scenario_id);
    return false;
  }

  if (!selectedSmileRows.length) {
    warn('[VOL PANEL] no SMILE rows found for scenario:', scenario_id);
  }

  appState.setSwaptionAtmBase?.(selectedRows);

  if (selectedSmileRows.length) {
    appState.setSwaptionSmileBase?.(selectedSmileRows);
  }

  document.dispatchEvent(new CustomEvent('swaption:atm:ready', {
    detail: {
      source: 'scenario',
      scenario_id,
      count: selectedRows.length
    }
  }));

  document.dispatchEvent(new CustomEvent('swaption:smile:ready', {
    detail: {
      source: 'scenario',
      scenario_id,
      count: selectedSmileRows.length
    }
  }));

  document.dispatchEvent(new CustomEvent('swaption:cube:ready', {
    detail: {
      source: 'scenario',
      scenario_id
    }
  }));

  return true;
}

export function renderVolScenarioPanel() {
  log('================ VOL SCENARIO PANEL ================');

  if (!volScenarioPanelListenersInstalled) {
    document.addEventListener('swaption:snapshots:ready', () => {
      renderVolScenarioPanel();
    });

    document.addEventListener('swaption:active:ready', () => {
      renderVolScenarioPanel();
    });

    volScenarioPanelListenersInstalled = true;
  }

  const container = document.getElementById('volScenarioContainer');

  if (!container) {
    warn('[VOL PANEL] volScenarioContainer not found');
    return;
  }

  const appState = window.appState;

  if (!appState) {
    warn('[VOL PANEL] appState missing');
    return;
  }

  rememberOriginalBaseRows(appState);

  const { snapshots, smileSnapshots, activeRows } = getAppStateRows(appState);

  log('[VOL PANEL] snapshots length:', snapshots.length);
  log('[VOL PANEL] smileSnapshots length:', smileSnapshots.length);
  log('[VOL PANEL] activeRows length:', activeRows.length);

  if (DEBUG && snapshots.length) {
    table(snapshots.map(row => ({
      scenario_id: row.scenario_id,
      ccy: row.ccy,
      option_tenor: row.option_tenor,
      swap_tenor: row.swap_tenor,
      vol: row.vol
    })));
  }

  if (DEBUG && activeRows.length) {
    table(activeRows.map(row => ({
      scenario_id: row.scenario_id,
      ccy: row.ccy,
      active_run_id: row.active_run_id,
      activated_at: row.activated_at
    })));
  }

  const activeScenario =
    lastSelectedVolScenario || getLatestActiveScenario(activeRows);

  const scenarios = buildScenarioList({
    snapshots,
    smileSnapshots,
    activeScenario
  });

  container.innerHTML = `
    <select id="volScenarioSelect">
      ${scenarios.map(scenario => `
        <option value="${scenario}" ${scenario === activeScenario ? 'selected' : ''}>
          ${scenario}
        </option>
      `).join('')}
    </select>
  `;

  const select = document.getElementById('volScenarioSelect');
  const applyBtn = document.getElementById('applyVolScenarioChanges');

  if (!select || !applyBtn) {
    warn('[VOL PANEL] select or apply button missing');
    return;
  }

  applyBtn.onclick = async () => {
    lastSelectedVolScenario = select.value || 'BASE';

    const success = await applyVolScenario({
      appState,
      scenario_id: lastSelectedVolScenario,
      persist: true
    });

    if (success) {
      document.dispatchEvent(new CustomEvent('swaption:rebuild-active-scenario', {
        detail: {
          scenario_id: lastSelectedVolScenario,
          ccy: 'EUR',
          active_run_id: lastSelectedVolScenario === 'BASE' ? 'BASE' : 'ACTIVE'
        }
      }));

      renderVolScenarioPanel();
    }
  };

  log('====================================================');
}