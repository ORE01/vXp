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

/**
 * Hebt den TRADE_ID-Filter auf, indem #tradeDropdown auf ALL gesetzt und ein
 * change ausgelöst wird. Nutzt die bestehende Filter-Verdrahtung
 * (dropdownFilterEngine + tradeUI), kein direkter appState-Zugriff nötig.
 */
function resetTradeFilter() {
  const td = document.getElementById('tradeDropdown');
  if (!td) return;
  const opts = Array.from(td.options);
  const hasAll = opts.some((o) => o.value === 'ALL');
  // nur die ALL-Option markieren (bzw. alles abwählen, falls keine ALL-Option existiert)
  opts.forEach((o) => { o.selected = hasAll ? (o.value === 'ALL') : false; });
  td.dispatchEvent(new Event('change', { bubbles: true }));
}

export function closeEditPortfolioDrawer() {
  const drawer = document.getElementById(DRAWER_ID);
  if (drawer) drawer.classList.remove('is-open');
  resetTradeFilter();

  // "New Portfolio Name" beim Schließen immer leeren.
  const nameEl = document.getElementById('nameInput');
  if (nameEl) nameEl.value = '';
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

  // #tradeDropdown beim Öffnen an den aktuellen Spaltenkopf-Filter angleichen,
  // damit nur die aktuell sichtbaren (gefilterten) Trades angeboten werden.
  window.appState?.repopulateDropdownsForTableType?.(
    'deals',
    window.appState?.filteredData?.deals
  );
}
