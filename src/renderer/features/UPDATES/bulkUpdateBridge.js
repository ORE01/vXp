// FRONT_END/UI/bulkUpdateBridge.js

function lockRender() {
  window.__uiLocked = true;
  document.body.dataset.uiLocked = '1';
}

function unlockRender() {
  window.__uiLocked = false;
  delete document.body.dataset.uiLocked;
}

/**
 * Installiert IPC-Bridge für Bulk-Updates + Fallback DOM-Events.
 * Idempotent: kann mehrfach aufgerufen werden, installiert aber nur einmal.
 */
export function installBulkUpdateBridge() {
  if (window.__bulkUpdateBridgeInstalled) return;
  window.__bulkUpdateBridgeInstalled = true;

  // a) Falls preload/bridge existiert
  if (window.api?.on) {
    window.api.on('ui:bulk-update-start', () => {
      lockRender();
      window.dispatchEvent(new Event('ui:bulk-update-start'));
    });

    window.api.on('ui:bulk-update-end', () => {
      unlockRender();
      window.dispatchEvent(new Event('ui:bulk-update-end'));
    });
  }

  // b) Fallback: falls jemand direkt DOM-Events feuert
  window.addEventListener('ui:bulk-update-start', () => lockRender());
  window.addEventListener('ui:bulk-update-end',   () => unlockRender());
}
