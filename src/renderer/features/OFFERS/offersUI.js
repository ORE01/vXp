// src/renderer/features/OFFERS/offersUI.js
import processData from '../../core/ui/modal/modalData.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { attachIdLinks } from '../../utils/linksToTables.js';
import { handlePortProdData } from '../SELECT_PORTFOLIO/PORT.js';

let isBound = false;

/**
 * OFFERS Filter = Single Source of Truth:
 * appState.dropdownConfig.offers
 *
 * Example:
 * offers: {
 *   'offersIssuerDropdown': { dataKey:'ISSUER', selection:['ALL'] },
 *   ...
 * }
 */
function getOffersFilterConfig(appState) {
  return appState?.dropdownConfig?.offers || {};
}

function getOffersFilterDropdownIds(appState) {
  return Object.keys(getOffersFilterConfig(appState));
}

function panelIsOpen() {
  const panel = document.getElementById('panel-offers-np');
  return panel && panel.hidden === false;
}

/**
 * Resolve special cases where DB/UI keys differ
 */
function resolveValue(row, dataKey) {
  if (!row) return '';

  // MATURITY_YEAR can be derived from MATURITY
  if (dataKey === 'MATURITY_YEAR') {
    const direct = row.MATURITY_YEAR;
    if (direct !== undefined && direct !== null && String(direct).trim() !== '') {
      return String(direct).trim();
    }
    const m = row.MATURITY;
    return m ? String(m).slice(0, 4).trim() : '';
  }

  // Depotbank aliases
  if (dataKey === 'Depotbank') {
    return String(
      row.Depotbank ?? row.DEPOTBANK ?? row.DEPOT ?? ''
    ).trim();
  }

  // Default
  return String(row?.[dataKey] ?? '').trim();
}

/* =========================================================
   Bind UI once
   ========================================================= */

export function bindOffersUIOnce(appState) {
  if (isBound) return;
  isBound = true;

  const offersDD = document.getElementById('createdOffersDropdown');
  const resetBtn = document.getElementById('offersResetFiltersButton');

  // Portfolio dropdown
  offersDD?.addEventListener('change', () => {
    renderOffersPanel(appState);
  });

  // Filter dropdown listeners (dynamic from AppState)
  getOffersFilterDropdownIds(appState).forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('change', () => renderOffersPanel(appState));
  });

  // Reset filters
  resetBtn?.addEventListener('click', () => {
    resetOffersFilters(appState);
    renderOffersPanel(appState);
  });

  console.log('[OFFERS] UI bound (dropdown + filters + reset)');
}

/* =========================================================
   Main render
   ========================================================= */

export function renderOffersPanel(appState) {
  if (!panelIsOpen()) return;

  const norm = (v) => String(v ?? '').trim();
  const normKey = (v) => norm(v).toLowerCase();

  // RAW source (DealsMain precalc)
  const allRaw = appState.getOffersData?.() || [];
  fillOffersDropdown(allRaw);

  // Selected offer name
  const dd = document.getElementById('createdOffersDropdown');
  const offerName = norm(dd?.value ?? '');
  const hasOffer = !!offerName;

  // -----------------------------
  // A) LEFT TABLE: RAW DealsMain
  // -----------------------------
  const rawRows = hasOffer
    ? allRaw.filter(r => normKey(r?.port_name) === normKey(offerName))
    : [];

  renderOffersTable(rawRows, 'OFFERS_DATA');

  // -----------------------------------------
  // B) RIGHT TABLE: ONLY Portfolios calculated
  // -----------------------------------------
  const allPorts = appState.getAllPortfolioData?.() || [];

  const portfolioRows = hasOffer
    ? allPorts.filter(r => normKey(r?.port_name) === normKey(offerName))
    : [];

  // If portfolio not calculated yet → show nothing
  if (!portfolioRows.length) {
    fillOffersFilters(appState, []);
    renderOffersPortfolio([], offerName);
    return;
  }

  // Apply filters
  const portfolioFiltered = applyOffersFilters(appState, portfolioRows);

  // Preview slice
  const previewRows = portfolioFiltered.slice(0, 30);

  // Filters reflect visible preview
  fillOffersFilters(appState, previewRows);

  // Render portfolio preview
  renderOffersPortfolio(portfolioFiltered, offerName);
}

/* =========================================================
   Render Tables
   ========================================================= */

export function renderOffersTable(rows, tableName = 'OFFERS_DATA') {
  const container = document.getElementById('offersDataContainer');
  if (!container) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = processData(rows, tableName);
  addTooltipsForTruncatedText(container);
  addProdIdTooltips(container);
  attachIdLinks(container);
}

export function renderOffersPortfolio(rows, offerName) {
  const container = document.getElementById('portDataContainer4');
  if (!container) return;

  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Preview slice (keep behavior)
  const previewRows = rows.slice(0, 30);

  handlePortProdData(previewRows, 4, offerName || 'OFFERS');
}

/* =========================================================
   Offers Dropdown (portfolio names)
   ========================================================= */

export function fillOffersDropdown(offers) {
  const dd = document.getElementById('createdOffersDropdown');
  if (!dd) return;

  const prev = String(dd.value || '').trim();

  const names = Array.from(new Set(
    (Array.isArray(offers) ? offers : [])
      .map(r => String(r?.port_name ?? '').trim())
      .filter(Boolean)
  )).sort();

  dd.innerHTML = '';

  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    dd.appendChild(opt);
  });

  if (prev && names.includes(prev)) dd.value = prev;
  else dd.value = '';
}

/* =========================================================
   Filter Helpers (dynamic)
   ========================================================= */

function fillOffersFilters(appState, rows) {
  const cfg = getOffersFilterConfig(appState);
  const ids = Object.keys(cfg);

  // Clear dropdowns
  if (!Array.isArray(rows) || rows.length === 0) {
    ids.forEach(id => fillMulti(id, []));
    return;
  }

  ids.forEach((dropdownId) => {
    const dataKey = cfg?.[dropdownId]?.dataKey;
    if (!dataKey) return;

    const values = uniqByKey(rows, dataKey);
    fillMulti(dropdownId, values);
  });
}

function applyOffersFilters(appState, rows) {
  const cfg = getOffersFilterConfig(appState);
  const ids = Object.keys(cfg);

  // Collect selections
  const selById = {};
  let any = false;

  ids.forEach((dropdownId) => {
    const s = selectedSet(dropdownId);
    selById[dropdownId] = s;
    if (s.size) any = true;
  });

  if (!any) return rows;

  return rows.filter((r) => {
    for (const dropdownId of ids) {
      const dataKey = cfg?.[dropdownId]?.dataKey;
      if (!dataKey) continue;

      const sel = selById[dropdownId];
      if (!sel || !sel.size) continue;

      const v = resolveValue(r, dataKey);
      if (!sel.has(String(v))) return false;
    }
    return true;
  });
}

export function resetOffersFilters(appState) {
  const ids = getOffersFilterDropdownIds(appState);

  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    Array.from(el.options).forEach(o => (o.selected = false));
  });
}

/* =========================================================
   DOM Utilities
   ========================================================= */

function fillMulti(id, values) {
  const el = document.getElementById(id);
  if (!el) return;

  const prev = new Set(Array.from(el.selectedOptions).map(o => o.value));

  el.innerHTML = '';
  (Array.isArray(values) ? values : []).forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    if (prev.has(v)) opt.selected = true;
    el.appendChild(opt);
  });
}

function selectedSet(id) {
  const el = document.getElementById(id);
  if (!el) return new Set();
  return new Set(Array.from(el.selectedOptions).map(o => String(o.value)));
}

function uniqByKey(rows, dataKey) {
  const set = new Set();
  (Array.isArray(rows) ? rows : []).forEach(r => {
    const v = resolveValue(r, dataKey);
    if (v) set.add(v);
  });
  return Array.from(set).sort();
}


