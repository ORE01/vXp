// slideIn.js
function initSlideIn() {
  const container = document.querySelector('#SUMMARY_Modal .table-content');
  const backdrop  = document.getElementById('subPanelBackdrop');

  if (!container || !backdrop) return;

  // idempotent guard, falls Modul doppelt geladen wird
  if (container.dataset.slideInInit === '1') return;
  container.dataset.slideInInit = '1';

  function openPanel(id) {
    const panel = document.getElementById(id);
    if (!panel) return;
    panel.hidden = false;
    panel.getBoundingClientRect(); // Layout-Flush für Transition
    panel.classList.add('open');
    backdrop.hidden = false;
    backdrop.classList.add('show');

    const trigger = container.querySelector(`.section-trigger[data-panel="${id}"]`);
    trigger?.setAttribute('aria-expanded', 'true');

    const onDone = (e) => {
      if (e.propertyName !== 'right') return;
      resizeChartsIn(panel);
      panel.removeEventListener('transitionend', onDone);
    };
    panel.addEventListener('transitionend', onDone);

    document.addEventListener('keydown', onEscClose);
  }

  function closePanel(id) {
    const panel = document.getElementById(id);
    if (!panel || panel.hidden) return;
    panel.classList.remove('open');
    backdrop.classList.remove('show');

    const trigger = container.querySelector(`.section-trigger[data-panel="${id}"]`);
    trigger?.setAttribute('aria-expanded', 'false');

    const onDone = (e) => {
      if (e.propertyName !== 'right') return;
      panel.hidden = true;
      const anyOpen = !!container.querySelector('.sub-panel.open');
      if (!anyOpen) backdrop.hidden = true;
      panel.removeEventListener('transitionend', onDone);
    };
    panel.addEventListener('transitionend', onDone);

    document.removeEventListener('keydown', onEscClose);
  }

  function onEscClose(e) {
    if (e.key === 'Escape') {
      const open = container.querySelector('.sub-panel.open');
      if (open) closePanel(open.id);
    }
  }

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.section-trigger');
    if (btn) openPanel(btn.dataset.panel);
  });

  container.addEventListener('click', (e) => {
    const btn = e.target.closest('.sub-panel-close');
    if (btn) closePanel(btn.dataset.close);
  });

  backdrop?.addEventListener('click', () => {
    const open = container.querySelector('.sub-panel.open');
    if (open) closePanel(open.id);
  });

  function resizeChartsIn(root) {
    const canvases = root.querySelectorAll('canvas');
    canvases.forEach((cv) => {
      try {
        const chart =
          (typeof Chart !== 'undefined' && Chart.getChart)
            ? Chart.getChart(cv)
            : (cv._chart || null);
        if (chart?.resize) chart.resize();
        if (chart?.update) chart.update('none');
      } catch (err) {
        console.warn('Chart resize failed for', cv?.id, err);
      }
    });
  }
}

// Auto-Init: wartet, bis DOM vorhanden ist
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initSlideIn, { once: true });
} else {
  initSlideIn();
}

export {}; // explizit als ES-Modul markieren

