import { resolvePanelContext } from './panelContext.js';
import { showBackdrop, hideBackdrop } from './panelBackdrop.js';
import { closeSiblingPanels, showPanel, hidePanel, hasOpenPanels } from './panelVisibility.js';
import { rememberPanelOpener, restorePanelOpener, preparePanelFocus } from './panelFocus.js';
import { registerPanelOpenHook, runPanelOpenHook } from './panelHooks.js';

export { registerPanelOpenHook };

export function openPanel(panelId) {
  const ctx = resolvePanelContext(panelId);
  if (!ctx) return;

  rememberPanelOpener();
  closeSiblingPanels(ctx);
  showBackdrop(ctx);
  showPanel(ctx);
  runPanelOpenHook(panelId);
  preparePanelFocus(ctx.panel);

  if (ctx.type === 'slide') {
    console.log('[PANEL] opened via SLIDE-LAYER:', panelId);
  }
}

export function closePanel(panelId) {
  const ctx = resolvePanelContext(panelId);
  if (!ctx) return;

  hidePanel(ctx);

  if (!hasOpenPanels(ctx)) {
    hideBackdrop(ctx);
  }

  restorePanelOpener();

  if (ctx.type === 'slide') {
    console.log('[PANEL] closed via SLIDE-LAYER:', panelId);
  }
}





