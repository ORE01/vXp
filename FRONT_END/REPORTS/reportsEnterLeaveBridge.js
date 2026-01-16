// FRONT_END/REPORTS/reportsEnterLeaveBridge.js
/**
 * Reports Enter/Leave Bridge (TAB-level)
 *
 * EXACT behavior ported from old renderer-local setupReportsEnterLeaveBridge():
 * - watches the ".tab" bar (clicks + mutation observer)
 * - dispatches document events: "reports:enter" / "reports:leave"
 * - on enter: calls setupCustomerReportsPresetUI()
 *
 * Renderer stays: Boot + Wiring + DI.
 */

export function setupReportsEnterLeaveBridge({
  // required DI: called when entering Reports tab
  setupCustomerReportsPresetUI,

  // optional DI / config (defaults match your old code)
  tabBarSelector = '.tab',
  tabLinkSelector = '.tablinks',
  reportsTabId = 'REPORTS_Tab',

  // event target MUST stay document to preserve old behavior
  eventTarget = document,

  // global flags host
  globalObj = window,
} = {}) {
  if (typeof setupCustomerReportsPresetUI !== 'function') {
    throw new Error('[reportsEnterLeaveBridge] setupCustomerReportsPresetUI must be a function');
  }
  if (!eventTarget || typeof eventTarget.dispatchEvent !== 'function' || typeof eventTarget.addEventListener !== 'function') {
    throw new Error('[reportsEnterLeaveBridge] eventTarget must support addEventListener/dispatchEvent');
  }

  // --- idempotency (EXACT as before) ---
  if (globalObj.__reportsBridgeInstalled) return;
  globalObj.__reportsBridgeInstalled = true;

  const tabBar = document.querySelector(tabBarSelector);
  if (!tabBar) return;

  // ✅ NEW: Reports enter/leave hooks (nur einmal) — EXACT behavior
  if (!globalObj.__reportsEnterLeaveHooksBound) {
    globalObj.__reportsEnterLeaveHooksBound = true;

    eventTarget.addEventListener(
      'reports:enter',
      () => {
        try {
          // Risk UI existiert jetzt (Panel wird geöffnet) → Preset UI binden + Liste laden
          setupCustomerReportsPresetUI();
        } catch (e) {
          console.warn('[reports:enter] setupCustomerReportsPresetUI failed', e);
        }
      },
      true
    );

    eventTarget.addEventListener(
      'reports:leave',
      () => {
        // optional: nichts nötig
        // Wenn du später mal teardown willst: hier.
      },
      true
    );
  }

  const fire = (isReports) => {
    eventTarget.dispatchEvent(new CustomEvent(isReports ? 'reports:enter' : 'reports:leave'));
  };

  // A) Clicks auf die Tab-Buttons abfangen — EXACT behavior
  const buttons = tabBar.querySelectorAll(tabLinkSelector);
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    btn.addEventListener(
      'click',
      () => {
        const id = btn.id || '';
        fire(id === reportsTabId);
      },
      { passive: true }
    );
  }

  // B) Falls Tabs auch programmatic umgeschaltet werden (Klassenwechsel) — EXACT behavior
  const getActiveTabId = () =>
    document.querySelector(`${tabLinkSelector}.active`)?.id ||
    document.querySelector(`${tabLinkSelector}[aria-selected="true"]`)?.id ||
    '';

  const mo = new MutationObserver(() => {
    const id = getActiveTabId();
    if (!id) return;
    fire(id === reportsTabId);
  });

  mo.observe(tabBar, {
    attributes: true,
    subtree: true,
    attributeFilter: ['class', 'aria-selected'],
  });

  // C) Initialen Zustand einmal feuern — EXACT behavior
  requestAnimationFrame(() => {
    const id = getActiveTabId();
    fire(id === reportsTabId);
  });
}

