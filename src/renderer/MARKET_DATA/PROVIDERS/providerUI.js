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

