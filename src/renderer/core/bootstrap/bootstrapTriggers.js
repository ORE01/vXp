import { openPanel } from '../ui/panels/index.js';
import { bindOffersUIOnce, renderOffersPanel, renderOffersTable } from '../../features/OFFERS/offersUI.js';
import { bindDealsUIOnce, renderDealsPanel, renderDealsTable } from '../../features/CREATE_PORTFOLIO/dealsUI.js';

// ------------------------------------------------------------
// Panel open hook registry (fix for installReceivers warning)
// ------------------------------------------------------------
function ensurePanelOpenHookRegistry(appState) {
  if (!appState) return;

  if (!appState.__panelOpenHooks) appState.__panelOpenHooks = [];

  if (typeof appState.registerPanelOpenHook !== 'function') {
    appState.registerPanelOpenHook = (fn) => {
      if (typeof fn !== 'function') return;
      appState.__panelOpenHooks.push(fn);
    };
  }

  if (typeof appState.emitPanelOpen !== 'function') {
    appState.emitPanelOpen = (panelId) => {
      const hooks = Array.isArray(appState.__panelOpenHooks) ? appState.__panelOpenHooks : [];
      for (const fn of hooks) {
        try { fn(panelId); } catch (e) { console.warn('[panelOpenHook] error', e); }
      }
    };
  }

  // ✅ ADD THIS: window shim for installReceivers
  window.registerPanelOpenHook = appState.registerPanelOpenHook;
  window.emitPanelOpen = appState.emitPanelOpen;
}


function applyBreakdownFocus(groupOrNone) {
  if (typeof window?.focusBreakdownGroup !== 'function') {
    console.warn('[TRIGGER] window.focusBreakdownGroup not available');
    return;
  }

  queueMicrotask(() => {
    requestAnimationFrame(() => {
      try {
        window.focusBreakdownGroup(groupOrNone);
        console.log('[TRIGGER] focusBreakdownGroup applied:', groupOrNone);
      } catch (e) {
        console.warn('[TRIGGER] focusBreakdownGroup failed:', e);
      }
    });
  });
}

export function bootstrapTriggers(appState, { emitPanelOpen } = {}) {
  document.addEventListener('click', (e) => {
    const btn = e.target.closest?.('button.section-trigger');
    if (!btn) return;

    e.preventDefault();

    const panelId = btn.dataset.panel || btn.getAttribute('aria-controls');
    if (!panelId) {
      console.warn('[TRIGGER] missing data-panel / aria-controls', btn);
      return;
    }

    const isSub = btn.classList.contains('section-trigger--sub');
    const section = btn.closest('.chart-section');
    const group = btn.dataset.breakdownGroup || null;

    // ----------------------------
    // 1) Haupt-Trigger → Subpunkte ein/aus
    // ----------------------------
    if (section && !isSub) {
      section.classList.toggle('is-open');

      const next = section.nextElementSibling;
      if (next?.classList?.contains('chart-section--sub')) {
        next.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }

    // ----------------------------
    // 2) AppState (nur Sub)
    // ----------------------------
    if (group) {
      appState.activeBreakdownGroup = group;
    }

    console.log('[TRIGGER] clicked', {
      panelId,
      breakdownGroup: group,
      isSub,
      wrapperIsOpen: section ? section.classList.contains('is-open') : null,
    });

    // ============================
    // BREAKDOWN – Sonderfall
    // ============================
    if (panelId === 'panel-breakdown') {
      if (!isSub) {
        // Hauptpunkt → Overview
        applyBreakdownFocus('__NONE__');
      } else {
        // Subpunkt → Panel + Fokus
        openPanel(panelId);

        // ✅ DI Hook feuern
        emitPanelOpen?.(panelId);

        applyBreakdownFocus(group);
      }

      // aria nur Hauptpunkt
      if (!isSub) {
        const isOpen = btn.getAttribute('aria-expanded') === 'true';
        btn.setAttribute('aria-expanded', String(!isOpen));
      }

      return;
    }

    // ============================
    // DEFAULT – alle anderen Panels
    // ============================
    openPanel(panelId);

    // ✅ DI Hook feuern (statt appState.emitPanelOpen)
    emitPanelOpen?.(panelId);


    if (panelId === 'panel-issuer-np') {
      setTimeout(() => {
        appState.applyFiltersAndUpdateDropdowns?.('issuer');
      }, 0);
    }

    if (panelId === 'panel-products-np') {
      setTimeout(() => {
        appState.applyFiltersAndUpdateDropdowns?.('prod');
      }, 0);
    }

    // Panel specific UI init/render (minimal-invasive)
    if (panelId === 'panel-deals') {
      appState.dealsUI = { renderDealsTable, renderDealsPanel };
      bindDealsUIOnce(appState);
      renderDealsPanel(appState);
    }

    if (panelId === 'panel-offers-np') {
      appState.offersUI = { renderOffersTable, renderOffersPanel };
      bindOffersUIOnce(appState);
      renderOffersPanel(appState);
    }

    if (!isSub) {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
    }
  });

  console.log('[BOOT] bootstrapTriggers active');
}








