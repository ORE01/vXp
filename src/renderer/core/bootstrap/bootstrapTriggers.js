import { openPanel } from '../ui/panels/index.js';
import { bindOffersUIOnce, renderOffersPanel, renderOffersTable } from '../../features/OFFERS/offersUI.js';
import { bindDealsUIOnce, renderDealsPanel, renderDealsTable } from '../../features/portfolio/trades/tradeUI.js';
import { renderPerformanceHistoryCopies } from '../../features/ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/historicRiskMetrics.js';
import { renderPerformanceDashboard } from '../../features/ANALYSE_PORTFOLIO/performanceDashboard.js';

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

    // console.log('[TRIGGER] clicked', {
    //   panelId,
    //   breakdownGroup: group,
    //   isSub,
    //   wrapperIsOpen: section ? section.classList.contains('is-open') : null,
    // });

    // ============================
    // BREAKDOWN – Sonderfall
    // ============================
    if (panelId === 'panel-breakdown') {
      if (!isSub) {
        // Hauptpunkt → Overview
        // Panel open + ALLE Gruppen zeigen (konsistent mit Portfolio-Wechsel)
        openPanel(panelId);
        emitPanelOpen?.(panelId);
        applyBreakdownFocus('__ALL__');
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

    // ✅ MVaR Panel: beim Öffnen bestehende Daten aus Store/AppState rendern.
    // Wichtig: erst nach openPanel(), damit Chart.js auf sichtbarem Canvas rendert.
    if (panelId === 'panel-mvar') {
      // console.log('[TRIGGER] panel-mvar opened → refreshMarketRiskUI');

      requestAnimationFrame(() => {
        if (typeof window.appState?.refreshMarketRiskUI === 'function') {
          window.appState.refreshMarketRiskUI(0);
        } else if (typeof appState?.refreshMarketRiskUI === 'function') {
          appState.refreshMarketRiskUI(0);
        } else {
          console.warn('[TRIGGER] refreshMarketRiskUI not available');
        }
      });
    }

    // Performance -> History: Kopien der Yield-/Value-History-Charts zeichnen, sobald
    // das Panel sichtbar ist (korrektes Canvas-Sizing).
    if (panelId === 'panel-performance-history') {
      requestAnimationFrame(() => { try { renderPerformanceHistoryCopies(); } catch (_) {} });
    }

    // Performance-Dashboard: Rendite-Verlauf-Chart bei sichtbarem Panel zeichnen.
    if (panelId === 'panel-performance-dashboard') {
      requestAnimationFrame(() => { try { renderPerformanceDashboard(); } catch (_) {} });
    }

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

  // console.log('[BOOT] bootstrapTriggers active');
}








