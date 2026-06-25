'use strict';

import processData from '../../../core/ui/modal/modalData.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../../utils/tooltips.js';
import { attachIdLinks } from '../../../utils/linksToTables.js';
import { handleModalAction } from '../../../core/ui/modal/modalActions.js';

let _bound = false;
let _t = null;

// UI-only sentinel values (nur für Dropdown-UX)
const NONE = '__NONE__';
const ALL  = 'ALL';

const DEALS_PANEL_ID = 'panel-deals';
const DEALS_TABLE_NAME = 'DealsMain';

function panelIsOpen() {
  const panel = document.getElementById(DEALS_PANEL_ID);
  return !!(panel && panel.hidden === false);
}

/**
 * Minimal-invasive: UI löst nur einen "recompute deals" aus.
 * (Engine bleibt Owner für Filter/Dropdown-Repopulate/Render)
 */
function scheduleRecomputeDeals(appState) {
  clearTimeout(_t);
  _t = setTimeout(() => {
    // 1) Deals (Tabelle/Filter) neu berechnen
    appState?.applyFiltersAndUpdateDropdowns?.('deals');

    // 2) createdDealsDropdown Optionen aus dem *aktualisierten* allDealsData neu bauen
    //    (entfernt gelöschte port_names sofort, auch ohne Panel-Open)
    populateCreatedDealsDropdownFallback(appState);
  }, 60);
}


// Für Add-Modal brauchen wir aktuell sichtbare Rows.
// Quelle: appState.filteredData.deals wird von dropdownFilterEngine gepflegt.
function getVisibleDealsRows(appState) {
  const rows = appState?.filteredData?.deals;
  return Array.isArray(rows) ? rows : [];
}

/**
 * DealsUI bindet UI-Events (minimal-invasive).
 * KEINE Filterlogik hier.
 */
export function bindDealsUIOnce(appState) {
  if (_bound) return;
  _bound = true;

  // createdDealsDropdown (Portfolio/Table selection)
  document.getElementById('createdDealsDropdown')?.addEventListener('change', () => {
    scheduleRecomputeDeals(appState);
  });

  // TRADE_ID-Auswahl (Edit-Drawer) -> Deals neu berechnen.
  // Die früheren Filter-Dropdowns sind entfernt; gefiltert wird jetzt über die
  // Spaltenköpfe der Deals-Tabelle (renderConfigurableTable, mode 'header').
  document.getElementById('tradeDropdown')?.addEventListener('change', () => {
    scheduleRecomputeDeals(appState);
  });

  // ADD Button: nutzt die aktuell sichtbaren (gefilterten) Deals
  document.getElementById('dealsAddButton')?.addEventListener('click', (event) => {
    const visible = getVisibleDealsRows(appState);

    // Source of truth fürs Save
    appState.__filteredDealsUI = visible;

    handleModalAction(event, visible, null, DEALS_TABLE_NAME, 'add');
  });

  console.log('[DEALS UI] bound (minimal-invasive)');
}

/**
 * Beim Panel-open:
 * 1) ensure createdDealsDropdown options (engine-first, fallback)
 * 2) wenn Auswahl ok -> deals render triggern
 */
export function renderDealsPanel(appState) {
  if (!panelIsOpen()) return;

  // ✅ FIX 1: Panel bleibt im DOM -> ensure darf bei jedem Open wieder laufen
  const dd = document.getElementById('createdDealsDropdown');
  if (dd) {
    delete dd.dataset.ensureDone;
  }

  ensureDealsTablesDropdown(appState);

  const sel = String(dd?.value ?? NONE).trim();

  // UX: solange NONE selektiert ist, leeren wir die Tabelle
  if (sel === NONE) {
    renderDealsTable([], DEALS_TABLE_NAME);
    return;
  }

  // Deals neu rendern (Engine)
  appState?.applyFiltersAndUpdateDropdowns?.('deals');
}

/**
 * Optionaler Render-Helper (bleibt kompatibel).
 * Primär rendert bei dir aber handleDealsData() in dealsDataContainer.
 */
export function renderDealsTable(rows, tableName = DEALS_TABLE_NAME) {
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

/* -------------------------
   createdDealsDropdown options:
   engine-first + fallback
   ------------------------- */
function ensureDealsTablesDropdown(appState) {
  const dd = document.getElementById('createdDealsDropdown');
  if (!dd) return;

  // Guard: nur pro "renderDealsPanel call"
  if (dd.dataset.ensureDone === '1') return;
  dd.dataset.ensureDone = '1';

  const prev =
    appState?.getSelectedDealsTableName?.() ||
    dd.value ||
    NONE;

  // ✅ FIX 2: Wenn Dropdown zwar Optionen hat, aber prev nicht vorhanden ist -> trotzdem refreshen
  const optionsArr = Array.from(dd.options || []);
  const hasEnoughOptions = optionsArr.length > 2;
  const hasPrev = optionsArr.some(o => String(o.value) === String(prev));

  // Wenn Dropdown schon gut gefüllt ist UND prev existiert, müssen wir nichts tun
  if (hasEnoughOptions && hasPrev) return;

  // 1) Engine soll options bauen (source: appState.getDealsNameList())
  // (ja, das ist bei dir aktuell der schnellste Weg, weil Timing/Panel-Open)
  appState?.applyFiltersAndUpdateDropdowns?.('dealsTables', { preselect: prev });

  // 2) Fallback: wenn Engine noch nichts liefern konnte -> aus allDealsData befüllen
  queueMicrotask(() => {
    const after = Array.from(dd.options || []);
    const hasEnoughAfter = after.length > 2;
    const hasPrevAfter = after.some(o => String(o.value) === String(prev));

    if (!hasEnoughAfter || !hasPrevAfter) {
      populateCreatedDealsDropdownFallback(appState);
    }

    // selection restore
    const wanted = String(prev ?? '').trim();
    const finalOpts = Array.from(dd.options || []);
    
    if (wanted && finalOpts.some(o => String(o.value) === wanted)) {
      dd.value = wanted;
    } else if (finalOpts.some(o => String(o.value) === NONE)) {
      dd.value = NONE;
    } else if (finalOpts.some(o => String(o.value) === ALL)) {
      dd.value = ALL;
    } else if (finalOpts.length) {
      dd.value = finalOpts[0].value;
    }


    // Change feuern, damit engine/state synced (optional – aber hilft bei Timing)
    dd.dispatchEvent(new Event('change', { bubbles: true }));
  });
}

/**
 * Fallback: Dropdown aus allDealsData aufbauen
 * (nur wenn nameListsStore/engine noch leer ist)
 */
function populateCreatedDealsDropdownFallback(appState) {
  const dd = document.getElementById('createdDealsDropdown');
  if (!dd) return;

  const rows = appState?.getAllDealsData?.() || appState?.dealsData || [];
  const names = Array.from(new Set(
    (Array.isArray(rows) ? rows : [])
      .map(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim())
      .filter(Boolean)
  )).sort();

  const prev = String(dd.value || '').trim();

  // Signatur, um unnötige Rebuilds zu vermeiden
  const sig = `${NONE}|${ALL}|${names.join('|')}`;

  // ✅ Rebuild auch wenn Dropdown leer/kaputt ist
  const needsRebuild = (dd.dataset.sig !== sig) || ((dd.options?.length ?? 0) < 2);

  if (!needsRebuild) {
    if ([NONE, ALL].includes(prev) || names.includes(prev)) dd.value = prev;
    return;
  }

  dd.dataset.sig = sig;
  dd.innerHTML = '';

  dd.appendChild(new Option('— Select Portfolio —', NONE));
  dd.appendChild(new Option('All Portfolios', ALL));

  names.forEach(n => dd.appendChild(new Option(n, n)));

  // pick previous if possible, else NONE
  if ([NONE, ALL].includes(prev) || names.includes(prev)) dd.value = prev;
  else dd.value = NONE;
}








