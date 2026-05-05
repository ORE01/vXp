// FRONT_END/MARKET_DATA/VOLS/swaptionReadyListeners.js

import {
  renderVolSurfacePanel,
  renderSwaptionSmile,
  renderSwaptionActiveScenarioInfo
} from './swaptionVols.js';

import { renderSwaptionCubeSurface3D, renderSwaptionCubeSummary } from './volCube.js';

let activeVolScenarioApplied = false;

function getLatestActiveScenario(appState) {
  const activeRows =
    appState.getSwaptionActive?.()
    || appState.getSwaptionActiveData?.()
    || appState._SWAPTION_ACTIVE
    || appState._swaptionActive
    || [];

  if (!Array.isArray(activeRows) || !activeRows.length) return 'BASE';

  const latest = [...activeRows].sort(
    (a, b) => new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
  )[0];

  return String(latest?.scenario_id || 'BASE').trim() || 'BASE';
}

function getSwaptionSnapshots(appState) {
  const snapshots =
    appState.getSwaptionSnapshotsData?.()
    || appState.getSwaptionSnapshots?.()
    || appState._SWAPTION_SNAPSHOTS
    || appState._swaptionSnapshots
    || [];

  return Array.isArray(snapshots) ? snapshots : [];
}



function tryApplyActiveVolScenario(appState) {
  if (!appState || activeVolScenarioApplied) return;

  const activeScenario = getLatestActiveScenario(appState);
  if (!activeScenario || activeScenario === 'BASE') return;

  const snapshots = getSwaptionSnapshots(appState);
  if (!snapshots.length) return;

  const selectedRows = snapshots
    .filter(row => String(row.scenario_id || '').trim() === activeScenario)
    .map(row => ({
      ...row,
      atm_vol: Number(row.atm_vol ?? row.vol)
    }));

  if (!selectedRows.length) return;

  activeVolScenarioApplied = true;

  appState.setSwaptionATMBase?.(selectedRows);

  document.dispatchEvent(new CustomEvent('swaption:atm:ready', {
    detail: {
      source: 'startup-active-scenario',
      scenario_id: activeScenario,
      count: selectedRows.length
    }
  }));
}

/**
 * Bindet Swaption "ready" Listener (ATM/Smile/Cube).
 * Idempotent: bindet nur einmal.
 */
export function bindSwaptionReadyListeners({ appState }) {
  if (window.__swaptionReadyListenersBound) return;
  window.__swaptionReadyListenersBound = true;

  document.addEventListener('swaption:active:ready', () => {
    tryApplyActiveVolScenario(appState);
    renderSwaptionActiveScenarioInfo();
  });

  document.addEventListener('swaption:snapshots:ready', () => {
    tryApplyActiveVolScenario(appState);
  });

  document.addEventListener('swaption:atm:ready', () => {
    renderSwaptionActiveScenarioInfo();
      if (!appState) return;

    const rows = appState.swaptionATM;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const panel = document.getElementById('panel-swaption');
    if (!panel || panel.hidden) return;

    const target = document.getElementById('swaption-atm-surface-3d');
    if (!target) return;

    renderVolSurfacePanel();
  });

  document.addEventListener('swaption:smile:ready', () => {
    if (!appState) return;

    const rows = appState.swaptionSmile;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const panel = document.getElementById('panel-swaption-smile');
    if (!panel || panel.hidden) return;

    const canvas = document.getElementById('swaption-smile-chart');
    if (!canvas) return;

    renderSwaptionSmile();
  });

  document.addEventListener('swaption:cube:ready', () => {
    if (!appState) return;

    const cube = appState.getSwaptionCubeSurface
      ? appState.getSwaptionCubeSurface()
      : appState.swaptionCubeSurface;

    if (!cube) return;

    const tryRender = () => {
      const target = document.getElementById('swaption-cube-surface-3d');
      if (!target) return false;

      renderSwaptionCubeSurface3D();
      renderSwaptionCubeSummary();
      return true;
    };

    if (tryRender()) return;

    const mo = new MutationObserver(() => {
      if (tryRender()) {
        mo.disconnect();
      }
    });

    mo.observe(document.body, { childList: true, subtree: true });
    setTimeout(() => mo.disconnect(), 10_000);
  });

  document.addEventListener('panel:opened', (event) => {
    const panelId = event?.detail?.panelId;

    if (panelId === 'panel-swaption') {
      renderSwaptionActiveScenarioInfo();
    }

    if (panelId === 'panel-swaption-smile') {
      renderSwaptionSmile();
    }

    if (panelId === 'panel-swaption-cube') {
      renderSwaptionCubeSurface3D();
      renderSwaptionCubeSummary();
    }
  });
}