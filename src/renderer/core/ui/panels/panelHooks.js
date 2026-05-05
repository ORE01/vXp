const panelOpenHooks = new Map();

export function registerPanelOpenHook(panelId, fn) {
  if (!panelId || typeof fn !== 'function') return;
  panelOpenHooks.set(panelId, fn);
}

export function runPanelOpenHook(panelId) {
  try {
    panelOpenHooks.get(panelId)?.();
  } catch (err) {
    console.warn('panel open hook failed', panelId, err);
  }
}