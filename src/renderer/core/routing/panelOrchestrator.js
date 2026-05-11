// panelOrchestrator.js
const registry = new Map();

/**
 * Generic lazy panel renderer.
 * - listens to clicks on triggerSelector
 * - sets panelRenderState[panelId] = true
 * - calls renderer mapped to panelId
 */
export function initLazyPanels({
  key = "default",
  panelRenderState,
  panelRenderers,
  triggerSelector = ".section-trigger",
  panelAttr = "data-panel"
} = {}) {

  if (registry.has(key)) return; // already registered for this key

  if (!panelRenderState) {
    console.error(`[LazyRender] panelRenderState missing for key=${key}`);
    return;
  }
  if (!panelRenderers || typeof panelRenderers !== "object") {
    console.error(`[LazyRender] panelRenderers missing/invalid for key=${key}`);
    return;
  }

  const onClick = (e) => {
    const btn = e.target.closest(triggerSelector);
    if (!btn) return;

    const panelId = btn.getAttribute(panelAttr) || btn.dataset.panel;
    if (!panelId) return;

    panelRenderState[panelId] = true;

    const fn = panelRenderers[panelId];
    if (typeof fn !== "function") return;

    requestAnimationFrame(() => {
      console.log("[LazyRender] calling renderer for panelId =", panelId);

      try {
        fn();
      } catch (err) {
        console.error(`[LazyRender] renderer for ${panelId} failed`, err);
      }

      try {
        document.dispatchEvent(new Event('risk:refresh-thumbnails'));
      } catch (e) {
        console.warn('[LazyRender] dispatch risk:refresh-thumbnails failed', e);
      }
    });
  };

  document.addEventListener("click", onClick);
  registry.set(key, { onClick, panelRenderState, panelRenderers });
}

/**
 * Re-rendert nur Panels, die schon offen waren.
 */
export function refreshOpenPanels(key = "default") {
  const entry = registry.get(key);
  if (!entry) return;

  const { panelRenderState, panelRenderers } = entry;

  for (const id of Object.keys(panelRenderState)) {
    if (!panelRenderState[id]) continue;

    const fn = panelRenderers[id];
    if (typeof fn === "function") {

      try {
        fn(); // Panel refresh
      } catch (err) {
        console.error(`[LazyRender] refresh renderer for ${id} failed`, err);
      }

      // 🔹 Preview ebenfalls aktualisieren
      try {
        document.dispatchEvent(new Event('risk:refresh-thumbnails'));
      } catch (e) {
        console.warn('[LazyRender] dispatch risk:refresh-thumbnails (refreshOpenPanels) failed', e);
      }
    }
  }
}

export function refreshPanel(panelId, key = "default") {
  const entry = registry.get(key);
  if (!entry || !panelId) return;

  const { panelRenderState, panelRenderers } = entry;

  if (!panelRenderState[panelId]) return;

  const fn = panelRenderers[panelId];
  if (typeof fn !== "function") return;

  requestAnimationFrame(() => {
    try {
      fn();
    } catch (err) {
      console.error(`[LazyRender] refresh renderer for ${panelId} failed`, err);
    }

    try {
      document.dispatchEvent(new Event('risk:refresh-thumbnails'));
    } catch (e) {
      console.warn('[LazyRender] dispatch risk:refresh-thumbnails failed', e);
    }
  });
}

