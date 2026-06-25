// src/renderer/features/portfolio/tradeEntry/editPortfolioDrawer.js
'use strict';

/**
 * Edit Portfolio drawer (slide-in like Add Products).
 *
 * The form (#tradeDropdown, #nameInput, #tagInputField, #saveSelectionButton,
 * #deleteTableButton) lives statically inside <aside id="editPortfolioDrawer">
 * in index.html, so all existing handlers stay wired by ID. This module only
 * opens/closes the drawer.
 *
 * Usage:
 *   openEditPortfolioDrawer();
 */

const DRAWER_ID = 'editPortfolioDrawer';

export function closeEditPortfolioDrawer() {
  const drawer = document.getElementById(DRAWER_ID);
  if (drawer) drawer.classList.remove('is-open');
}

let __epdWired = false;

function wireOnce(drawer) {
  if (__epdWired) return;
  __epdWired = true;

  drawer.querySelector('[data-epd-close]')
    ?.addEventListener('click', closeEditPortfolioDrawer);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') closeEditPortfolioDrawer();
  });
}

export function openEditPortfolioDrawer() {
  const drawer = document.getElementById(DRAWER_ID);
  if (!drawer) {
    console.warn('[EditPortfolioDrawer] aside #editPortfolioDrawer missing');
    return;
  }

  wireOnce(drawer);
  drawer.classList.add('is-open');
}
