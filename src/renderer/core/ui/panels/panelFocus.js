let lastPanelOpener = null;

export function rememberPanelOpener() {
  lastPanelOpener = document.activeElement;
}

export function restorePanelOpener() {
  if (lastPanelOpener && document.body.contains(lastPanelOpener)) {
    lastPanelOpener.focus();
  }
}

export function preparePanelFocus(panel) {
  if (!panel) return;
  if (!panel.hasAttribute('tabindex')) {
    panel.setAttribute('tabindex', '-1');
  }
  panel.focus();
}
