let __lastPanelOpener = null;

export function openPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  __lastPanelOpener = document.activeElement;

  panel.hidden = false;
  panel.setAttribute('aria-modal', 'true');
  if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
  panel.focus();
}

export function closePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;

  panel.hidden = true;
  panel.removeAttribute('aria-modal');

  if (__lastPanelOpener && document.body.contains(__lastPanelOpener)) {
    __lastPanelOpener.focus();
  }
}
