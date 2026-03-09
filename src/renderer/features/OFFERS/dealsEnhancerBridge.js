// FRONT_END/OFFERS/dealsEnhancerBridge.js

import { enhanceDealsIncludeCheckboxes } from '../../core/ui/enhancers/includeToggleEnhancer.js';

/**
 * Deals Enhancer Bridge
 *
 * Exact behavior from renderer:
 * - bind once to "dealsData:ready"
 * - run once after initial paint via requestAnimationFrame
 *
 * Keeps renderer free of DOM-side-effect wiring.
 */
export function installDealsEnhancerBridge({
  appState,
  containerSelector = '#offersDataContainer',
  observe = true,
  idempotent = true,
  globalObj = window,
  doc = document,
} = {}) {
  if (!appState) throw new Error('[dealsEnhancerBridge] appState missing');

  // idempotent (matches your previous renderer guard pattern)
  if (idempotent) {
    if (globalObj.__dealsEnhancerReadyHookBound) return;
    globalObj.__dealsEnhancerReadyHookBound = true;
  }

  // 1) hook: when deals data is ready
  doc.addEventListener(
    'dealsData:ready',
    () => {
      enhanceDealsIncludeCheckboxes(containerSelector, { observe, appState });
    },
    true
  );

  // 2) first attempt after initial DOM paint
  requestAnimationFrame(() => {
    const el = doc.querySelector(containerSelector);
    if (!el) return;
    enhanceDealsIncludeCheckboxes(el, { observe, appState });
  });
}
