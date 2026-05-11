export function showBackdrop(ctx) {
  if (!ctx?.backdrop) return;

  if (ctx.type === 'legacy') {
    ctx.backdrop.hidden = false;
  }

  ctx.backdrop.classList.add('show');

  if (ctx.type === 'slide' && ctx.container) {
    ctx.container.setAttribute('aria-hidden', 'false');
  }
}

export function hideBackdrop(ctx) {
  if (!ctx?.backdrop) return;

  ctx.backdrop.classList.remove('show');

  if (ctx.type === 'legacy') {
    ctx.backdrop.hidden = true;
  }

  if (ctx.type === 'slide' && ctx.container) {
    ctx.container.setAttribute('aria-hidden', 'true');
  }
}