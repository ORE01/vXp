import { openPanel } from '../ui/panels.js';

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

export function bootstrapTriggers(appState) {
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
        applyBreakdownFocus(group);
      }

      // aria nur Hauptpunkt (Chevron kommt aus CSS, nicht aus JS)
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

    if (!isSub) {
      const isOpen = btn.getAttribute('aria-expanded') === 'true';
      btn.setAttribute('aria-expanded', String(!isOpen));
    }

  });

  console.log('[BOOT] bootstrapTriggers active');
}







