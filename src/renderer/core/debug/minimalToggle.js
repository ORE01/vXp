'use strict';

document.addEventListener('click', (e) => {
  const btn = e.target.closest('button.section-trigger');
  if (!btn) return;

  // nur Parent-Trigger
  if (btn.classList.contains('section-trigger--sub')) return;

  const section = btn.closest('.chart-section');
  if (!section) return;

  section.classList.toggle('is-open');

  console.log('[MINIMAL]', {
    wrapper: section.className,
    nextSibling: section.nextElementSibling?.className,
    subDisplay: section.nextElementSibling
      ? getComputedStyle(section.nextElementSibling).display
      : null
  });
});
