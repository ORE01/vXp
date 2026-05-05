export function closeSiblingPanels(ctx) {
  if (!ctx?.container || !ctx?.panel) return;

  if (ctx.type === 'slide') {
    ctx.container.querySelectorAll('.sub-panel').forEach((panel) => {
      panel.classList.remove('open');
      panel.removeAttribute('aria-modal');
    });
    return;
  }

  ctx.container.querySelectorAll('.sub-panel').forEach((panel) => {
    if (panel === ctx.panel) return;
    panel.classList.remove('open');
    panel.hidden = true;
    panel.removeAttribute('aria-modal');
  });
}

export function showPanel(ctx) {
  if (!ctx?.panel) return;

  if (ctx.type === 'legacy') {
    ctx.panel.hidden = false;
  }

  ctx.panel.classList.add('open');
  ctx.panel.setAttribute('aria-modal', 'true');

  document.dispatchEvent(new CustomEvent('panel:opened', {
    detail: {
      panelId: ctx.panel.id,
      panel: ctx.panel,
      type: ctx.type,
    }
  }));
}

export function hidePanel(ctx) {
  if (!ctx?.panel) return;

  ctx.panel.classList.remove('open');
  ctx.panel.removeAttribute('aria-modal');

  if (ctx.type === 'legacy') {
    ctx.panel.hidden = true;
  }
}

export function hasOpenPanels(ctx) {
  if (!ctx?.container) return false;

  if (ctx.type === 'slide') {
    return !!ctx.container.querySelector('.sub-panel.open');
  }

  return [...ctx.container.querySelectorAll('.sub-panel')].some((panel) => !panel.hidden);
}