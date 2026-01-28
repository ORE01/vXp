let __lastPanelOpener = null;

/* ============================================================
   OPEN PANEL – MASTER ENTRY POINT
   ============================================================ */
export function openPanel(panelId) {

  // ============================================================
  // PHASE 1: GLOBAL SLIDE-LAYER (Market Data)
  // ============================================================
  const slideLayer = document.querySelector('.slide-layer[data-slide-layer="marketdata"]');
  if (slideLayer) {
    const panelSL = slideLayer.querySelector(`#${panelId}--sl`);
    const backdrop = slideLayer.querySelector('[data-backdrop]');

    if (panelSL && backdrop) {
      __lastPanelOpener = document.activeElement;

      // alle Slide-Panels schließen
// alle Slide-Panels HARD schließen
slideLayer.querySelectorAll('.sub-panel').forEach(p => {
  p.classList.remove('open');
  p.removeAttribute('aria-modal');
});


      slideLayer.setAttribute('aria-hidden', 'false');
      backdrop.classList.add('show');

      panelSL.classList.add('open');
      panelSL.setAttribute('aria-modal', 'true');
      if (!panelSL.hasAttribute('tabindex')) {
        panelSL.setAttribute('tabindex', '-1');
      }
      panelSL.focus();

      console.log('[PANEL] opened via SLIDE-LAYER:', panelId);
      return; // <<< WICHTIG: Legacy wird NICHT ausgeführt
    }
  }

  // ============================================================
  // LEGACY SYSTEM (unverändert, dein bisheriges Verhalten)
  // ============================================================
  const panel = document.getElementById(panelId);
  if (!panel) return;

  __lastPanelOpener = document.activeElement;

  const modal =
    panel.closest('#ANALYSE_Modal, #REPORTS_Modal, #DATA_Modal, #COMP_Modal') ||
    panel.closest('.table');

  // Nur Panels im gleichen Modal schließen
  if (modal) {
    modal.querySelectorAll('.sub-panel').forEach(p => {
      if (p === panel) return;
      p.classList.remove('open');
      p.hidden = true;
      p.removeAttribute('aria-modal');
    });

    const bd =
      modal.querySelector('#subPanelBackdrop_ANALYSE') ||
      modal.querySelector('#subPanelBackdrop_REPORTS') ||
      modal.querySelector('.sub-panel-backdrop');

    if (bd) {
      bd.hidden = false;
      bd.classList.add('show');
    }
  }

  panel.hidden = false;
  panel.classList.add('open');
  panel.setAttribute('aria-modal', 'true');
  if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
  panel.focus();
}

/* ============================================================
   CLOSE PANEL – MASTER
   ============================================================ */
export function closePanel(panelId) {

  // ============================================================
  // PHASE 1: SLIDE-LAYER
  // ============================================================
  const slideLayer = document.querySelector('.slide-layer[data-slide-layer="marketdata"]');
  if (slideLayer) {
    const panelSL = slideLayer.querySelector(`#${panelId}--sl`);
    const backdrop = slideLayer.querySelector('[data-backdrop]');

    if (panelSL && backdrop) {
      panelSL.classList.remove('open');
      panelSL.removeAttribute('aria-modal');

      const anyOpen = slideLayer.querySelector('.sub-panel.open');
      if (!anyOpen) {
        backdrop.classList.remove('show');
        slideLayer.setAttribute('aria-hidden', 'true');
      }

      if (__lastPanelOpener && document.body.contains(__lastPanelOpener)) {
        __lastPanelOpener.focus();
      }

      console.log('[PANEL] closed via SLIDE-LAYER:', panelId);
      return;
    }
  }

  // ============================================================
  // LEGACY SYSTEM
  // ============================================================
  const panel = document.getElementById(panelId);
  if (!panel) return;

  const modal =
    panel.closest('#ANALYSE_Modal, #REPORTS_Modal, #DATA_Modal, #COMP_Modal') ||
    panel.closest('.table');

  panel.classList.remove('open');
  panel.hidden = true;
  panel.removeAttribute('aria-modal');

  if (modal) {
    const anyOpen = [...modal.querySelectorAll('.sub-panel')].some(p => !p.hidden);
    if (!anyOpen) {
      const bd =
        modal.querySelector('#subPanelBackdrop_ANALYSE') ||
        modal.querySelector('#subPanelBackdrop_REPORTS') ||
        modal.querySelector('.sub-panel-backdrop');
      if (bd) {
        bd.classList.remove('show');
        bd.hidden = true;
      }
    }
  }

  if (__lastPanelOpener && document.body.contains(__lastPanelOpener)) {
    __lastPanelOpener.focus();
  }
}





