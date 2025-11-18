// slideIn.js
// Multi-Modal Slide-In Controller (SUMMARY, MARKETDATA, ...)


// function initContainer(container) {
//   if (!container || container.dataset.slideInInit === '1') return;
//   container.dataset.slideInInit = '1';

//   // Backdrop (Klasse ODER ID möglich)
//   const backdrop =
//     container.querySelector('.sub-panel-backdrop') ||
//     container.querySelector('#subPanelBackdrop') ||
//     null;

//   // --- Helpers ---
//   function getOpenPanel() {
//     return container.querySelector('.sub-panel.open');
//   }
//   function setAriaExpanded(id, expanded) {
//     const t =
//       container.querySelector(`.section-trigger[data-panel="${id}"]`) ||
//       container.querySelector(`.section-trigger[aria-controls="${id}"]`);
//     t?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
//   }
//   function showBackdrop() {
//     if (!backdrop) return;
//     backdrop.classList.add('show');
//   }
//   function hideBackdropIfNoneOpen() {
//     if (!backdrop) return;
//     const anyOpen = !!container.querySelector('.sub-panel.open');
//     if (!anyOpen) backdrop.classList.remove('show');
//   }
//   function closeAllImmediate() {
//     // Harter Reset OHNE Transition-Abhängigkeit
//     container.querySelectorAll('.sub-panel.open').forEach(p => p.classList.remove('open'));
//     container.querySelectorAll('.section-trigger[aria-expanded="true"]')
//       .forEach(tr => tr.setAttribute('aria-expanded', 'false'));
//     backdrop?.classList.remove('show');
//   }

//   // ► Init-Zustand immer bereinigen
//   closeAllImmediate();

//   // --- Open/Close (nur Klassen toggeln) ---
//   function openPanel(id) {
//     const panel = container.querySelector('#' + id);
//     if (!panel) return;

//     // 👉 Harter Safe-Mode: VOR JEDEM Öffnen alles schließen
//     closeAllImmediate();

//     panel.classList.add('open');
//     setAriaExpanded(id, true);
//     showBackdrop();

//     // Charts nach einem Tick refreshen (ohne transitionend)
//     queueMicrotask(() => resizeChartsIn(panel));

//     document.dispatchEvent(new CustomEvent('slidein:opened', {
//       detail: { containerId: getContainerId(container), panelId: id }
//     }));
//   }

//   function closePanel(id) {
//     const panel = container.querySelector('#' + id);
//     if (!panel) return;
//     if (!panel.classList.contains('open')) return;

//     panel.classList.remove('open');
//     setAriaExpanded(id, false);
//     hideBackdropIfNoneOpen();

//     document.dispatchEvent(new CustomEvent('slidein:closed', {
//       detail: { containerId: getContainerId(container), panelId: id }
//     }));
//   }

//   // --- Delegierter Click-Handler (einziger) ---
//   container.addEventListener('click', (e) => {
//     const triggerBtn = e.target.closest('.section-trigger');
//     const closeBtn   = e.target.closest('.sub-panel-close');

//     const isBackdrop =
//       (backdrop && e.target === backdrop) ||
//       e.target.matches?.('.sub-panel-backdrop') ||
//       e.target.matches?.('#subPanelBackdrop');

//     if (triggerBtn && container.contains(triggerBtn)) {
//       const id = triggerBtn.dataset.panel || triggerBtn.getAttribute('aria-controls');
//       if (id) openPanel(id);
//       return;
//     }

//     if (closeBtn && container.contains(closeBtn)) {
//       const id = closeBtn.dataset.close;
//       if (id) closePanel(id);
//       return;
//     }

//     if (isBackdrop) {
//       const open = getOpenPanel();
//       if (open) closePanel(open.id);
//       return;
//     }
//   });

//   // --- ESC (einfach & robust) ---
//   function onEsc(e) {
//     if (e.key !== 'Escape') return;
//     const open = getOpenPanel();
//     if (open) {
//       closePanel(open.id);
//       e.stopPropagation();
//     }
//   }
//   document.addEventListener('keydown', onEsc);

//   // optional: API
//   container._slideInAPI = {
//     open: (id) => openPanel(id),
//     close: (id) => closePanel(id),
//     closeAll: () => closeAllImmediate()
//   };

//   // ► Safety: Beim Tab-/View-Wechsel Zombie-States killen
//   // (stört nichts, hilft viel)
//   const visHandler = () => {
//     if (document.visibilityState === 'hidden') closeAllImmediate();
//   };
//   document.addEventListener('visibilitychange', visHandler);

//   // ► Cleanup, falls der Container hart entfernt wird
//   const ro = new ResizeObserver(() => {}); // Dummy, um einen Disconnect-Hook zu haben
//   ro.observe(container);
//   const cleanup = () => {
//     try { document.removeEventListener('keydown', onEsc); } catch {}
//     try { document.removeEventListener('visibilitychange', visHandler); } catch {}
//     try { ro.disconnect(); } catch {}
//   };
//   // Container bekommt eine einfache Destroy-API
//   container._destroySlideIn = cleanup;
// }
function initContainer(container) {
  if (!container || container.dataset.slideInInit === '1') return;
  container.dataset.slideInInit = '1';

  // Backdrop (Klasse ODER ID möglich)
  const backdrop =
    container.querySelector('.sub-panel-backdrop') ||
    container.querySelector('#subPanelBackdrop') ||
    null;

  // --- Helpers ---
  function getOpenPanel() {
    return container.querySelector('.sub-panel.open');
  }

  function setAriaExpanded(id, expanded) {
    const t =
      container.querySelector(`.section-trigger[data-panel="${id}"]`) ||
      container.querySelector(`.section-trigger[aria-controls="${id}"]`);
    t?.setAttribute('aria-expanded', expanded ? 'true' : 'false');
  }

  function showBackdrop() {
    if (!backdrop) return;
    backdrop.classList.add('show');
  }

  function hideBackdropIfNoneOpen() {
    if (!backdrop) return;
    const anyOpen = !!container.querySelector('.sub-panel.open');
    if (!anyOpen) backdrop.classList.remove('show');
  }

  function closeAllImmediate() {
    // Harter Reset OHNE Transition-Abhängigkeit
    container.querySelectorAll('.sub-panel.open').forEach(p => p.classList.remove('open'));
    container.querySelectorAll('.section-trigger[aria-expanded="true"]')
      .forEach(tr => tr.setAttribute('aria-expanded', 'false'));
    backdrop?.classList.remove('show');
  }

  // ► Init-Zustand immer bereinigen
  closeAllImmediate();

  // --- Open/Close (nur Klassen toggeln) ---
  function openPanel(id) {
    const panel = container.querySelector('#' + id);
    if (!panel) return;

    const current = getOpenPanel();

    // 1) Wenn das gewünschte Panel bereits offen ist → nichts tun
    if (current && current === panel) {
      return;
    }

    // 2) Wenn ein anderes Panel offen ist → nur dieses schließen
    if (current && current !== panel) {
      current.classList.remove('open');
      setAriaExpanded(current.id, false);
    }

    // 3) Zielpanel öffnen
    panel.classList.add('open');
    setAriaExpanded(id, true);
    showBackdrop();

    // Charts nach einem Tick refreshen (ohne transitionend)
    queueMicrotask(() => resizeChartsIn(panel));

    document.dispatchEvent(new CustomEvent('slidein:opened', {
      detail: { containerId: getContainerId(container), panelId: id }
    }));
  }

  function closePanel(id) {
    const panel = container.querySelector('#' + id);
    if (!panel) return;
    if (!panel.classList.contains('open')) return;

    panel.classList.remove('open');
    setAriaExpanded(id, false);
    hideBackdropIfNoneOpen();

    document.dispatchEvent(new CustomEvent('slidein:closed', {
      detail: { containerId: getContainerId(container), panelId: id }
    }));
  }

  // --- Delegierter Click-Handler (einziger) ---
  container.addEventListener('click', (e) => {
    const triggerBtn = e.target.closest('.section-trigger');
    const closeBtn   = e.target.closest('.sub-panel-close');

    const isBackdrop =
      (backdrop && e.target === backdrop) ||
      e.target.matches?.('.sub-panel-backdrop') ||
      e.target.matches?.('#subPanelBackdrop');

    if (triggerBtn && container.contains(triggerBtn)) {
      const id = triggerBtn.dataset.panel || triggerBtn.getAttribute('aria-controls');
      if (id) openPanel(id);
      return;
    }

    if (closeBtn && container.contains(closeBtn)) {
      const id = closeBtn.dataset.close;
      if (id) closePanel(id);
      return;
    }

    if (isBackdrop) {
      const open = getOpenPanel();
      if (open) closePanel(open.id);
      return;
    }
  });

  // --- ESC (einfach & robust) ---
  function onEsc(e) {
    if (e.key !== 'Escape') return;
    const open = getOpenPanel();
    if (open) {
      closePanel(open.id);
      e.stopPropagation();
    }
  }
  document.addEventListener('keydown', onEsc);

  // optional: API
  container._slideInAPI = {
    open: (id) => openPanel(id),
    close: (id) => closePanel(id),
    closeAll: () => closeAllImmediate()
  };

  // ► Safety: Beim Tab-/View-Wechsel Zombie-States killen
  const visHandler = () => {
    if (document.visibilityState === 'hidden') closeAllImmediate();
  };
  document.addEventListener('visibilitychange', visHandler);

  // ► Cleanup, falls der Container hart entfernt wird
  const ro = new ResizeObserver(() => {}); // Dummy, um einen Disconnect-Hook zu haben
  ro.observe(container);
  const cleanup = () => {
    try { document.removeEventListener('keydown', onEsc); } catch {}
    try { document.removeEventListener('visibilitychange', visHandler); } catch {}
    try { ro.disconnect(); } catch {}
  };
  container._destroySlideIn = cleanup;
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
 * - containerIds: explizite Liste von Modal-IDs (z. B. ['ANALYSE_Modal','MARKETDATA_Modal'])
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
// if (document.readyState === 'loading') {
//   document.addEventListener('DOMContentLoaded', () => {
//     initSlideIns({ selectors: ['.table .table-content'] });
//   }, { once: true });
// } else {
//   initSlideIns({ selectors: ['.table .table-content'] });
// }

// Auto-Init – aktiv mit observe:true
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    initSlideIns({ selectors: ['.table .table-content'], observe: true });
  }, { once: true });
} else {
  initSlideIns({ selectors: ['.table .table-content'], observe: true });
}




