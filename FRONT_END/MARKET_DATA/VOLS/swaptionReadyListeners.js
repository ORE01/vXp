// FRONT_END/MARKET_DATA/VOLS/swaptionReadyListeners.js

import { renderVolSurfacePanel, renderSwaptionSmile } from './swaptionVols.js';
import { renderSwaptionCubeSurface3D, renderSwaptionCubeSummary } from './volCube.js';

/**
 * Bindet Swaption "ready" Listener (ATM/Smile/Cube).
 * Idempotent: bindet nur einmal.
 */
export function bindSwaptionReadyListeners({ appState }) {
  if (window.__swaptionReadyListenersBound) return;
  window.__swaptionReadyListenersBound = true;

  // ATM ready
  document.addEventListener('swaption:atm:ready', () => {
    if (!appState) return;

    const rows = appState.swaptionATM;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const target = document.getElementById('swaption-atm-surface-3d');
    if (!target) return;

    renderVolSurfacePanel();
  });

  // Smile ready
  document.addEventListener('swaption:smile:ready', () => {
    if (!appState) return;

    const rows = appState.swaptionSmile;
    if (!Array.isArray(rows) || rows.length === 0) return;

    const canvas = document.getElementById('swaption-smile-chart');
    if (!canvas) return;

    renderSwaptionSmile();
  });

  // Cube ready
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

  // 1) Wenn DOM schon da: sofort rendern
  if (tryRender()) return;

  // 2) Wenn DOM noch nicht da (lazy panel): einmalig warten
  const mo = new MutationObserver(() => {
    if (tryRender()) {
      mo.disconnect();
    }
  });

  mo.observe(document.body, { childList: true, subtree: true });

  // Safety: falls Panel nie kommt, nach 10s stoppen
  setTimeout(() => mo.disconnect(), 10_000);
});

}
