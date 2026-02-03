// // src/renderer/features/OFFERS/offersUI.js

// import processData from '../../core/ui/MODAL_HELPER/dataProcessor.js';
// import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
// import { attachIdLinks } from '../../utils/linksToTables.js';

// let isBound = false;

// /* =========================================================
//    PUBLIC API
//    ========================================================= */

// export function bindOffersUIOnce(appState) {
//   if (isBound) return;
//   isBound = true;

//   const dropdown = document.getElementById('createdOffersDropdown');
//   if (!dropdown) {
//     console.warn('[OFFERS] createdOffersDropdown not found');
//     return;
//   }

//   dropdown.addEventListener('change', () => {
//     const offers = appState.getOffersData?.() || [];
//     const selected = getSelectedOffers(offers);
//     renderOffersTable(selected.length ? selected : offers, 'OFFERS_DATA');
//   });

//   console.log('[OFFERS] UI bound');
// }

// export function renderOffersTable(rows, tableName = 'OFFERS_DATA') {
//   const container = document.getElementById('offersDataContainer');
//   if (!container) return;

//   container.innerHTML = processData(rows, tableName);

//   addTooltipsForTruncatedText(container);
//   addProdIdTooltips(container);
//   attachIdLinks(container);
// }

// export function fillOffersDropdown(offers) {
//   const dropdown = document.getElementById('createdOffersDropdown');
//   if (!dropdown) return;

//   dropdown.innerHTML = '';

//   const allOpt = document.createElement('option');
//   allOpt.value = '__ALL__';
//   allOpt.textContent = 'All Offers';
//   dropdown.appendChild(allOpt);

//   const names = [...new Set(
//     offers.map(o => o.port_name).filter(Boolean)
//   )];

//   names.forEach(name => {
//     const opt = document.createElement('option');
//     opt.value = name;
//     opt.textContent = name;
//     dropdown.appendChild(opt);
//   });

//   dropdown.value = '__ALL__';
// }

// export function getSelectedOffers(offers) {
//   const dropdown = document.getElementById('createdOffersDropdown');
//   if (!dropdown) return [];

//   const val = dropdown.value;
//   if (!val || val === '__ALL__') return [];

//   return offers.filter(o => o.port_name === val);
// }



// src/renderer/features/OFFERS/offersUI.js
import processData from '../../core/ui/MODAL_HELPER/dataProcessor.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { attachIdLinks } from '../../utils/linksToTables.js';

let isBound = false;

const FILTER_IDS = {
  issuer:   'offersIssuerDropdown',
  prodId:   'offersProdIdDropdown',
  cpnType:  'offersCouponTypeDropdown',
  category: 'offersCategoryDropdown',
  rating:   'offersRatingDropdown',
  rank:     'offersRankDropdown',
  matYear:  'offersMaturityDropdown',
  depot:    'offersDepotbankDropdown',
};

function panelIsOpen() {
  const panel = document.getElementById('panel-offers-np');
  return panel && panel.hidden === false;
}

export function bindOffersUIOnce(appState) {
  if (isBound) return;
  isBound = true;

  const offersDD = document.getElementById('createdOffersDropdown');
  const resetBtn = document.getElementById('offersResetFiltersButton');

  // 1) Offers Dropdown (port_name)
  offersDD?.addEventListener('change', () => {
    renderOffersPanel(appState);
  });

  // 2) Multi-select filters
  Object.values(FILTER_IDS).forEach((id) => {
    const el = document.getElementById(id);
    el?.addEventListener('change', () => renderOffersPanel(appState));
  });

  // 3) Reset
  resetBtn?.addEventListener('click', () => {
    resetOffersFilters();
    renderOffersPanel(appState);
  });

  console.log('[OFFERS] UI bound (dropdown + filters + reset)');
}

export function renderOffersPanel(appState) {
  if (!panelIsOpen()) return;

  const allOffers = appState.getOffersData?.() || [];
  fillOffersDropdown(allOffers);

  // Basis: nach port_name selektieren (oder ALL)
  const base = getSelectedOffers(allOffers);
  const baseRows = base.length ? base : allOffers;

  // Filter-Optionen aus baseRows füllen (damit Dropdowns “kontextsensitiv” sind)
  fillOffersFilters(baseRows);

  // Filter anwenden
  const filtered = applyOffersFilters(baseRows);

  // Render links: Offers
  renderOffersTable(filtered, 'OFFERS_DATA');

  // Optional Preview rechts
  renderOffersPreview(filtered, 'OFFERS_DATA');
}

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

export function renderOffersPreview(rows, tableName = 'OFFERS_DATA') {
  const container = document.getElementById('portDataContainer4');
  if (!container) return;

  // Preview kann leer sein, dann einfach leeren
  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = '';
    return;
  }

  // Für Preview evtl. nur Top N (sonst zu groß)
  const previewRows = rows.slice(0, 30);

  container.innerHTML = processData(previewRows, tableName);
  addTooltipsForTruncatedText(container);
  addProdIdTooltips(container);
  attachIdLinks(container);
}

export function fillOffersDropdown(offers) {
  const dd = document.getElementById('createdOffersDropdown');
  if (!dd) return;

  // wenn bereits Optionen existieren, nicht jedes Mal komplett resetten
  // aber wir wollen sicherstellen, dass ALL existiert
  const prev = String(dd.value || '').trim();

  const names = Array.from(new Set(
    (Array.isArray(offers) ? offers : [])
      .map(r => String(r?.port_name ?? '').trim())
      .filter(Boolean)
  )).sort();

  dd.innerHTML = '';

  const allOpt = document.createElement('option');
  allOpt.value = '__ALL__';
  allOpt.textContent = 'All Offers';
  dd.appendChild(allOpt);

  names.forEach(name => {
    const opt = document.createElement('option');
    opt.value = name;
    opt.textContent = name;
    dd.appendChild(opt);
  });

  // restore
  if (prev && (prev === '__ALL__' || names.includes(prev))) dd.value = prev;
  else dd.value = '__ALL__';
}

export function getSelectedOffers(offers) {
  const dd = document.getElementById('createdOffersDropdown');
  const val = String(dd?.value ?? '__ALL__').trim();
  if (!val || val === '__ALL__') return [];
  return (Array.isArray(offers) ? offers : []).filter(r => String(r?.port_name ?? '').trim() === val);
}

/* =========================
   Filter helpers
   ========================= */

function fillOffersFilters(rows) {
  // wir füllen die Multi-selects mit Unique-Werten aus "rows"
  fillMulti(FILTER_IDS.issuer,   uniq(rows, r => r.ISSUER));
  fillMulti(FILTER_IDS.prodId,   uniq(rows, r => r.PROD_ID));
  fillMulti(FILTER_IDS.cpnType,  uniq(rows, r => r.CouponType ?? r.COUPON_TYPE));
  fillMulti(FILTER_IDS.category, uniq(rows, r => r.CATEGORY));
  fillMulti(FILTER_IDS.rating,   uniq(rows, r => r.RATING ?? r.RTG_SP));
  fillMulti(FILTER_IDS.rank,     uniq(rows, r => r.RANK ?? r.PAYMENT_RANK));
  fillMulti(FILTER_IDS.matYear,  uniq(rows, r => r.MATURITY_YEAR ?? (String(r.MATURITY || '').slice(0, 4))));
  fillMulti(FILTER_IDS.depot,    uniq(rows, r => r.DEPOTBANK ?? r.DEPOT));
}

function applyOffersFilters(rows) {
  const sel = {
    issuer:   selectedSet(FILTER_IDS.issuer),
    prodId:   selectedSet(FILTER_IDS.prodId),
    cpnType:  selectedSet(FILTER_IDS.cpnType),
    category: selectedSet(FILTER_IDS.category),
    rating:   selectedSet(FILTER_IDS.rating),
    rank:     selectedSet(FILTER_IDS.rank),
    matYear:  selectedSet(FILTER_IDS.matYear),
    depot:    selectedSet(FILTER_IDS.depot),
  };

  // wenn überall nichts selektiert ist -> original
  const any = Object.values(sel).some(s => s.size);
  if (!any) return rows;

  return rows.filter(r => {
    if (sel.issuer.size   && !sel.issuer.has(String(r.ISSUER ?? '').trim())) return false;
    if (sel.prodId.size   && !sel.prodId.has(String(r.PROD_ID ?? '').trim())) return false;
    if (sel.cpnType.size  && !sel.cpnType.has(String((r.CouponType ?? r.COUPON_TYPE) ?? '').trim())) return false;
    if (sel.category.size && !sel.category.has(String(r.CATEGORY ?? '').trim())) return false;
    if (sel.rating.size   && !sel.rating.has(String((r.RATING ?? r.RTG_SP) ?? '').trim())) return false;
    if (sel.rank.size     && !sel.rank.has(String((r.RANK ?? r.PAYMENT_RANK) ?? '').trim())) return false;

    const my = String(r.MATURITY_YEAR ?? (String(r.MATURITY || '').slice(0, 4)) ?? '').trim();
    if (sel.matYear.size  && !sel.matYear.has(my)) return false;

    const dep = String((r.DEPOTBANK ?? r.DEPOT) ?? '').trim();
    if (sel.depot.size    && !sel.depot.has(dep)) return false;

    return true;
  });
}

export function resetOffersFilters() {
  Object.values(FILTER_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    Array.from(el.options).forEach(o => (o.selected = false));
  });
}

function fillMulti(id, values) {
  const el = document.getElementById(id);
  if (!el) return;

  const prev = new Set(Array.from(el.selectedOptions).map(o => o.value));

  el.innerHTML = '';
  values.forEach(v => {
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
  return new Set(Array.from(el.selectedOptions).map(o => o.value));
}

function uniq(rows, getter) {
  const set = new Set();
  (Array.isArray(rows) ? rows : []).forEach(r => {
    const v = String(getter(r) ?? '').trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort();
}



