import processData from '../../core/ui/MODAL_HELPER/dataProcessor.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { attachIdLinks } from '../../utils/linksToTables.js';
import { handleModalAction } from '../../core/ui/MODAL_HELPER/ModalActionHandler.js';

let _bound = false;
let _t = null;

const ALL  = '__ALL__';
const NONE = '__NONE__';

const TRADE_DD_ID = 'tradeDropdown';

const FILTER_IDS = {
  prodId:   'dealsProdIdDropdown',
  category: 'dealsCategoryDropdown',
  notional: 'dealsNotionalDropdown',
  depot:    'dealsDepotbankDropdown',
};

function panelIsOpen() {
  const panel = document.getElementById('panel-deals');
  return !!(panel && panel.hidden === false);
}

function getDealsFromState(appState) {
  const rows =
  appState?.getAllDealsData?.() ||
  appState?.getDealsData?.() ||
  appState?.DEALS_DATA ||
  [];

  return Array.isArray(rows) ? rows : [];
}

function scheduleRender(appState) {
  clearTimeout(_t);
  _t = setTimeout(() => renderDealsPanel(appState), 60);
}

function selectedDealsDropdownValue() {
  const dd = document.getElementById('createdDealsDropdown');
  return String(dd?.value ?? NONE).trim();
}

function clearFiltersUI() {
  Object.values(FILTER_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (el) el.innerHTML = '';
  });
  const trade = document.getElementById(TRADE_DD_ID);
  if (trade) trade.innerHTML = '';
}

/**
 * Einmalig Listener binden:
 * - createdDealsDropdown
 * - Multi-filter dropdowns (inkl. ALL-Verhalten)
 * - tradeDropdown (filter)
 * - Reset button
 * - Add button
 */
export function bindDealsUIOnce(appState) {
  if (_bound) return;
  _bound = true;

  const dealsDD = document.getElementById('createdDealsDropdown');
  dealsDD?.addEventListener('change', () => scheduleRender(appState));

  // Multi-selects: ALL-Logik + render trigger
  Object.values(FILTER_IDS).forEach((id) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.addEventListener('change', (e) => {
      enforceAllBehavior(e.target);
      scheduleRender(appState);
    });
  });

  // Trade dropdown: ALL-Logik + render trigger
  const tradeDD = document.getElementById(TRADE_DD_ID);
  tradeDD?.addEventListener('change', (e) => {
    enforceAllBehavior(e.target);
    scheduleRender(appState);
  });

  document.getElementById('dealsResetFiltersButton')?.addEventListener('click', () => {
    resetDealsFilters();
    scheduleRender(appState);
  });

  // ADD Button: nutzt die aktuell sichtbaren (gefilterten) Deals als Kontext
  document.getElementById('dealsAddButton')?.addEventListener('click', (event) => {
    const allDeals = getDealsFromState(appState);
    const baseRows = getBaseRowsFromSelection(allDeals);

    // apply ALL filters incl. trade
    const filtered = applyDealsFilters(baseRows);

    appState.__filteredDealsUI = filtered;   // ✅ Source of truth für Save


    handleModalAction(event, filtered, null, 'DealsMain', 'add');
  });

  console.log('[DEALS UI] bound');
}

/**
 * Render beim Öffnen des Deals Panels:
 * - DealsDropdown Optionen
 * - Filter Optionen (inkl ALL)
 * - TradeDropdown Optionen (abhängig von anderen Filtern)
 * - Tabelle (abhängig von allen Filtern inkl Trade)
 */
export function renderDealsPanel(appState) {
  if (!panelIsOpen()) return;

  const deals = getDealsFromState(appState);

  fillDealsDropdown(deals);

  const sel = selectedDealsDropdownValue();

  // ✅ Wenn nichts ausgewählt: alles leer
  if (sel === NONE) {
    clearFiltersUI();
    renderDealsTable([], 'DealsMain');
    return;
  }

  const baseRows = getBaseRowsFromSelection(deals);

  // Filter-Optionen aus baseRows füllen
  fillDealsFilters(baseRows);

  // ALL-Defaults sicherstellen
  Object.values(FILTER_IDS).forEach((id) => enforceAllBehavior(document.getElementById(id)));

  // TradeDropdown soll NICHT von seiner eigenen Selektion schrumpfen:
  // -> Optionen aus rows, die nur mit den 4 Filters (ohne trade) gefiltert sind
  const preTrade = applyDealsFilters(baseRows, { skipTrade: true });
  fillTradeDropdown(preTrade);
  enforceAllBehavior(document.getElementById(TRADE_DD_ID));

  // Final: alle Filter inkl Trade anwenden
  const filtered = applyDealsFilters(baseRows);

  renderDealsTable(filtered, 'DealsMain');
}

/* =========================
   Deals Dropdown (Portfolio)
   ========================= */

export function fillDealsDropdown(deals) {
  const dd = document.getElementById('createdDealsDropdown');
  if (!dd) return;

  const prev = String(dd.value || '').trim();

  const names = Array.from(new Set(
    (Array.isArray(deals) ? deals : [])
      .map(r => String(r?.port_name ?? '').trim())
      .filter(Boolean)
  )).sort();

  const sig = `${NONE}|${ALL}|${names.join('|')}`;
  if (dd.dataset.sig === sig) {
    if (prev && (prev === NONE || prev === ALL || names.includes(prev))) dd.value = prev;
    return;
  }

  dd.dataset.sig = sig;
  dd.innerHTML = '';

  const noneOpt = document.createElement('option');
  noneOpt.value = NONE;
  noneOpt.textContent = '— Select Portfolio —';
  dd.appendChild(noneOpt);

  const allOpt = document.createElement('option');
  allOpt.value = ALL;
  allOpt.textContent = 'All Portfolios';
  dd.appendChild(allOpt);

  names.forEach(n => {
    const opt = document.createElement('option');
    opt.value = n;
    opt.textContent = n;
    dd.appendChild(opt);
  });

  // Default: NONE
  if (prev && (prev === NONE || prev === ALL || names.includes(prev))) dd.value = prev;
  else dd.value = NONE;
}

function getBaseRowsFromSelection(deals) {
  const sel = selectedDealsDropdownValue();

  if (sel === NONE) return [];
  if (sel === ALL) return Array.isArray(deals) ? deals : [];

  return (Array.isArray(deals) ? deals : [])
    .filter(r => String(r?.port_name ?? '').trim() === sel);
}

/* =========================
   Multi Filters + Trade Filter
   ========================= */

function fillDealsFilters(rows) {
  fillMulti(FILTER_IDS.prodId,   uniq(rows, r => r.PROD_ID));
  fillMulti(FILTER_IDS.category, uniq(rows, r => r.CATEGORY));
  fillMulti(FILTER_IDS.notional, uniq(rows, r => normalizeNotional(r.NOTIONAL ?? r.TOTAL_NOTIONAL)));
  fillMulti(FILTER_IDS.depot,    uniq(rows, r => r.DEPOTBANK ?? r.Depotbank ?? r.DEPOT));
}

/**
 * applyDealsFilters(rows, { skipTrade })
 * - liest Selections aus Multi-Selects
 * - ALL => leeres Set => Filter aus
 * - wenn skipTrade=true wird tradeDropdown ignoriert (nur Options-Build)
 */
function applyDealsFilters(rows, opts = {}) {
  const { skipTrade = false } = opts;

  const sel = {
    prodId:   selectedSet(FILTER_IDS.prodId),
    category: selectedSet(FILTER_IDS.category),
    notional: selectedSet(FILTER_IDS.notional),
    depot:    selectedSet(FILTER_IDS.depot),
    trade:    skipTrade ? new Set() : selectedSet(TRADE_DD_ID),
  };

  const any = Object.values(sel).some(s => s.size);
  if (!any) return rows;

  return (Array.isArray(rows) ? rows : []).filter(r => {
    if (sel.prodId.size && !sel.prodId.has(String(r.PROD_ID ?? '').trim())) return false;
    if (sel.category.size && !sel.category.has(String(r.CATEGORY ?? '').trim())) return false;

    const n = normalizeNotional(r.NOTIONAL ?? r.TOTAL_NOTIONAL);
    if (sel.notional.size && !sel.notional.has(n)) return false;

    const d = String((r.DEPOTBANK ?? r.Depotbank ?? r.DEPOT) ?? '').trim();
    if (sel.depot.size && !sel.depot.has(d)) return false;

    if (!skipTrade) {
      const tid = String(r.TRADE_ID ?? r.trade_id ?? r.Trade_ID ?? '').trim();
      if (sel.trade.size && !sel.trade.has(tid)) return false;
    }

    return true;
  });
}

/**
 * Reset = ALL in allen Filter-Dropdowns + tradeDropdown
 */
export function resetDealsFilters() {
  Object.values(FILTER_IDS).forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    Array.from(el.options).forEach(o => (o.selected = (o.value === ALL)));
  });

  const trade = document.getElementById(TRADE_DD_ID);
  if (trade) Array.from(trade.options).forEach(o => (o.selected = (o.value === ALL)));
}

function fillMulti(id, values) {
  const el = document.getElementById(id);
  if (!el) return;

  const prev = new Set(Array.from(el.selectedOptions).map(o => o.value));
  const sig = `${ALL}|${values.join('|')}`;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;

  el.innerHTML = '';

  const allOpt = document.createElement('option');
  allOpt.value = ALL;
  allOpt.textContent = 'ALL';
  el.appendChild(allOpt);

  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    if (prev.has(v)) opt.selected = true;
    el.appendChild(opt);
  });

  const hadAnyReal = [...prev].some(x => x && x !== ALL);
  if (!hadAnyReal) allOpt.selected = true;

  enforceAllBehavior(el);
}

function fillTradeDropdown(rows) {
  const el = document.getElementById(TRADE_DD_ID);
  if (!el) return;

  const prev = new Set(Array.from(el.selectedOptions).map(o => o.value));

  const ids = uniq(rows, r => String(r.TRADE_ID ?? r.trade_id ?? r.Trade_ID ?? '').trim());
  const sig = `${ALL}|${ids.join('|')}`;
  if (el.dataset.sig === sig) return;
  el.dataset.sig = sig;

  el.innerHTML = '';

  const allOpt = document.createElement('option');
  allOpt.value = ALL;
  allOpt.textContent = 'ALL';
  el.appendChild(allOpt);

  ids.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = v;
    if (prev.has(v)) opt.selected = true;
    el.appendChild(opt);
  });

  const hadAnyReal = [...prev].some(x => x && x !== ALL);
  if (!hadAnyReal) allOpt.selected = true;

  enforceAllBehavior(el);
}

/**
 * ✅ EXKLUSIV:
 * - wenn echte Werte selektiert => ALL raus
 * - wenn ALL selektiert => alle anderen raus
 * - wenn nichts selektiert => ALL rein
 */
function enforceAllBehavior(el) {
  if (!el) return;

  const selected = new Set(Array.from(el.selectedOptions).map(o => o.value));
  const hasAll = selected.has(ALL);
  const hasReal = [...selected].some(v => v !== ALL);

  if (hasAll && hasReal) {
    // echte Werte haben Priorität => ALL raus
    Array.from(el.options).forEach(o => { if (o.value === ALL) o.selected = false; });
    return;
  }

  if (hasAll) {
    // ALL => alles andere AUS
    Array.from(el.options).forEach(o => { if (o.value !== ALL) o.selected = false; });
    return;
  }

  if (selected.size === 0) {
    // nichts => ALL
    const allOpt = Array.from(el.options).find(o => o.value === ALL);
    if (allOpt) allOpt.selected = true;
  }
}

/**
 * Gibt Set der selektierten Werte zurück.
 * Wenn ALL selektiert ist => leeres Set (= kein Filter)
 */
function selectedSet(id) {
  const el = document.getElementById(id);
  if (!el) return new Set();

  const vals = new Set(Array.from(el.selectedOptions).map(o => o.value));
  if (vals.has(ALL)) return new Set();
  return vals;
}

function uniq(rows, getter) {
  const set = new Set();
  (Array.isArray(rows) ? rows : []).forEach(r => {
    const v = String(getter(r) ?? '').trim();
    if (v) set.add(v);
  });
  return Array.from(set).sort();
}

function normalizeNotional(x) {
  if (x == null) return '';
  const s = String(x).replace(/\s/g, '').replace(/,/g, '');
  const num = Number(s);
  if (!Number.isFinite(num)) return String(x).trim();
  return String(Math.round(num));
}

/* =========================
   Render
   ========================= */

export function renderDealsTable(rows, tableName = 'DealsMain') {
  const container = document.getElementById('dealsDataContainer');
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






