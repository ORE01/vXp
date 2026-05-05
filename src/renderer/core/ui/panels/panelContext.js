function getLegacyModal(panel) {
  return (
    panel.closest('#ANALYSE_Modal, #REPORTS_Modal, #DATA_Modal, #COMP_Modal') ||
    panel.closest('.table')
  );
}

function getLegacyBackdrop(modal) {
  if (!modal) return null;
  return (
    modal.querySelector('#subPanelBackdrop_ANALYSE') ||
    modal.querySelector('#subPanelBackdrop_REPORTS') ||
    modal.querySelector('.sub-panel-backdrop')
  );
}

export function resolvePanelContext(panelId) {
  const slideLayer = document.querySelector('.slide-layer[data-slide-layer="marketdata"]');

  if (slideLayer) {
    const panel = slideLayer.querySelector(`#${panelId}--sl`);
    const backdrop = slideLayer.querySelector('[data-backdrop]');

    if (panel && backdrop) {
      return {
        type: 'slide',
        panelId,
        panel,
        container: slideLayer,
        backdrop,
      };
    }
  }

  const panel = document.getElementById(panelId);
  if (!panel) return null;

  const container = getLegacyModal(panel);
  const backdrop = getLegacyBackdrop(container);

  return {
    type: 'legacy',
    panelId,
    panel,
    container,
    backdrop,
  };
}