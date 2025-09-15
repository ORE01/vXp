// slideIn.js
// Multi-Modal Slide-In Controller (SUMMARY, MARKETDATA, ...)

function initContainer(container) {
  if (!container || container.dataset.slideInInit === '1') return;
  container.dataset.slideInInit = '1';

  // Backdrop: erlaubt ID (#subPanelBackdrop) ODER Klasse (.sub-panel-backdrop)
  const backdrop =
    container.querySelector('.sub-panel-backdrop') ||
    container.querySelector('#subPanelBackdrop') ||
    null;

  // Öffnen
  function openPanel(id) {
    const panel = container.querySelector('#' + id);
    if (!panel) return;

    panel.hidden = false;
    // Layout flush für Transition
    panel.getBoundingClientRect();
    panel.classList.add('open');

    if (backdrop) {
      backdrop.hidden = false;
      backdrop.classList.add('show');
    }

    const trigger = container.querySelector(`.section-trigger[data-panel="${id}"]`);
    trigger?.setAttribute('aria-expanded', 'true');

    // Nach Slide-In Charts resizen + Event feuern
    const onDone = (e) => {
      if (e.propertyName !== 'right') return; // Ende der right-Transition
      resizeChartsIn(panel);
      document.dispatchEvent(new CustomEvent('slidein:opened', {
        detail: { containerId: getContainerId(container), panelId: id }
      }));
      panel.removeEventListener('transitionend', onDone);
    };
    panel.addEventListener('transitionend', onDone);

    document.addEventListener('keydown', onEscClose);
  }

  // Schließen
  function closePanel(id) {
    const panel = container.querySelector('#' + id);
    if (!panel || panel.hidden) return;

    panel.classList.remove('open');
    const trigger = container.querySelector(`.section-trigger[data-panel="${id}"]`);
    trigger?.setAttribute('aria-expanded', 'false');

    const onDone = (e) => {
      if (e.propertyName !== 'right') return;
      panel.hidden = true;

      const anyOpen = !!container.querySelector('.sub-panel.open');
      if (backdrop && !anyOpen) {
        backdrop.classList.remove('show');
        backdrop.hidden = true;
      }

      document.dispatchEvent(new CustomEvent('slidein:closed', {
        detail: { containerId: getContainerId(container), panelId: id }
      }));
      panel.removeEventListener('transitionend', onDone);
    };
    panel.addEventListener('transitionend', onDone);

    document.removeEventListener('keydown', onEscClose);
  }

  function getOpenPanel() {
    return container.querySelector('.sub-panel.open');
  }

  function onEscClose(e) {
    if (e.key === 'Escape') {
      const open = getOpenPanel();
      if (open) closePanel(open.id);
    }
  }

  // Clicks: Trigger öffnen
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.section-trigger');
    if (btn && container.contains(btn)) {
      openPanel(btn.dataset.panel);
    }
  });

  // Clicks: Panel schließen
  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.sub-panel-close');
    if (btn && container.contains(btn)) {
      closePanel(btn.dataset.close);
    }
  });

  // Backdrop klick → aktuell offenes Panel schließen
  backdrop?.addEventListener('click', () => {
    const open = getOpenPanel();
    if (open) closePanel(open.id);
  });

  // API an Container hängen (optional nützlich)
  container._slideInAPI = {
    open: openPanel,
    close: closePanel,
    closeAll: () => {
      container.querySelectorAll('.sub-panel.open').forEach(p => closePanel(p.id));
    }
  };
}

function resizeChartsIn(root) {
  const canvases = root.querySelectorAll('canvas');
  canvases.forEach((cv) => {
    try {
      // Chart.js v3/v4
      const chart = (typeof Chart !== 'undefined' && Chart.getChart)
        ? Chart.getChart(cv)
        : (cv._chart || null);
      if (chart?.resize) chart.resize();
      if (chart?.update) chart.update('none');
    } catch (err) {
      console.warn('Chart resize failed for', cv?.id, err);
    }
  });
}

function getContainerId(container) {
  // Versuche ID der .table zu liefern (Eltern), sonst id der .table-content, sonst 'unknown'
  const tbl = container.closest('.table');
  return (tbl && tbl.id) || container.id || 'unknown';
}

/**
 * Init für mehrere Modals:
 * - containerIds: explizite Liste von Modal-IDs (z. B. ['SUMMARY_Modal','MARKETDATA_Modal'])
 * - selectors: CSS-Selector(s), die .table .table-content matchen (Default)
 * - observe: automatisch neu hinzugefügte Container initieren (MutationObserver)
 */
export function initSlideIns({ containerIds = [], selectors = ['.table .table-content'], observe = false } = {}) {
  const set = new Set();

  // 1) Per ID-Liste
  containerIds.forEach(id => {
    const el = document.getElementById(id);
    const content = el?.querySelector('.table-content') || null;
    if (content) set.add(content);
  });

  // 2) Per Selector(s)
  selectors.forEach(sel => {
    document.querySelectorAll(sel).forEach(el => set.add(el));
  });

  // Init
  set.forEach(initContainer);

  // Optional: automatisch neue Container initialisieren
  if (observe) {
    const mo = new MutationObserver((muts) => {
      muts.forEach(m => {
        m.addedNodes.forEach(node => {
          if (!(node instanceof HTMLElement)) return;
          if (node.matches?.('.table .table-content')) {
            initContainer(node);
          } else {
            node.querySelectorAll?.('.table .table-content').forEach(initContainer);
          }
        });
      });
    });
    mo.observe(document.body, { childList: true, subtree: true });
  }
}

// Auto-Init – passt für SUMMARY + MARKETDATA out-of-the-box
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initSlideIns({ selectors: ['.table .table-content'] });
  }, { once: true });
} else {
  initSlideIns({ selectors: ['.table .table-content'] });
}



