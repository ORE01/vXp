import processData from '../../core/ui/MODAL_HELPER/dataProcessor.js';
import { handleModalAction } from '../../core/ui/MODAL_HELPER/ModalActionHandler.js';
import { appState } from '../../renderer.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { attachIdLinks } from '../../utils/linksToTables.js';

let filteredDealsData;

// ADD-Button (Add braucht keinen RowIndex â†’ null)
export function dealsAddButtonHandler (event, selectedTableName) {
  console.log('Start Add Deal', selectedTableName)
  handleModalAction(event, filteredDealsData, null, selectedTableName, 'add');
}

export function handleDealsData(receivedData, dealsTableName, opts = {}) {
  // console.log('[handleDealsData] CALL', {
  //   table: dealsTableName,
  //   rows: Array.isArray(receivedData) ? receivedData.length : 'n/a',
  //   forceTarget: opts.forceTarget,
  //   restoreDropdown: opts.restoreDropdown
  // });
  // console.trace('[handleDealsData] stack');

// Deals Tab soll NICHT vom PORT-Selection-State abhängen.
const dealsSel = appState?.getSelectedDealsTableName?.() 
  || document.getElementById('createdDealsDropdown')?.value 
  || 'ALL';

// optional: wenn du bei "ALL" wirklich NICHT rendern willst, dann:
// if (dealsSel === 'ALL') return;


  // (optional: keep the log only when useful)
  // console.log('Deals Data', receivedData, dealsTableName);

  const tableName = dealsTableName || '';

  const ctx = resolveDealsContext(opts);
  const { targetId, otherId, dropdownId, buttonId, isOffer } = ctx;

  if (isOffer) return;//____________________________________________________________________OFFERS AUS____________________________


  const targetContainer = document.getElementById(targetId);
  if (!targetContainer) return;

// Treat missing/empty payload as "no-op" (nicht löschen!)
// Sonst gewinnt ein späterer ALL/0-Call und macht dir die Tabelle leer.
if (!Array.isArray(receivedData) || receivedData.length === 0) {
  // nur löschen, wenn du es explizit willst:
  if (opts.allowClear === true) targetContainer.innerHTML = '';
  return;
}


  // 1) Filter/Dropdown snapshot (optional)
  const snap = preserveAndRestoreFilterDropdown({
    dropdownId,
    enabled: opts.restoreDropdown !== false,
  });

  // 2) clear other container
  const otherContainer = document.getElementById(otherId);
  if (otherContainer) otherContainer.innerHTML = '';

  // 3) render main table
  filteredDealsData = receivedData;
  renderDealsTableIntoContainer(targetContainer, filteredDealsData, tableName);

  // 4) UI enhancements
  applyDealsUIEnhancements(targetContainer);

  // 5) mirror only for deals (not offers)
  if (!isOffer) {
    mirrorDealsToNewPortfolioPanel(filteredDealsData, tableName);
  }

  // 6) bind add button
  bindDealsAddButtonOnce(buttonId, tableName);

  // 7) restore dropdown selection (after DOM rebuild)
  if (snap) snap.restore();
}


/* =========================================================
   Context (offers vs deals)
   ========================================================= */
function resolveDealsContext(opts = {}) {
  const forced = opts.forceTarget; // 'offers' | 'deals' | undefined
  const isOffer = forced === 'offers';

  return {
    isOffer,
    targetId: isOffer ? 'offersDataContainer' : 'dealsDataContainer',
    otherId:  isOffer ? 'dealsDataContainer'  : 'offersDataContainer',
    dropdownId: isOffer ? 'createdOffersDropdown' : 'createdDealsDropdown',
    buttonId: isOffer ? 'offersAddButton' : 'dealsAddButton',
  };
}

/* =========================================================
   Rendering
   ========================================================= */
function renderDealsTableIntoContainer(container, rows, tableName) {
  console.log('[renderDealsTableIntoContainer]', {
    container: container?.id,
    tableName,
    rows: rows?.length
  });
  container.innerHTML = processData(rows, tableName);
}


/* =========================================================
   UI enhancements
   ========================================================= */
function applyDealsUIEnhancements(container) {
  addTooltipsForTruncatedText(container);
  addProdIdTooltips(container);
  attachIdLinks(container);
}

/* =========================================================
   Mirror (Deals only)
   ========================================================= */
function mirrorDealsToNewPortfolioPanel(rows, tableName) {
  const mirrorContainer = document.getElementById('newPortfolioDealsDataContainer');
  if (!mirrorContainer) return;

  mirrorContainer.innerHTML = processData(rows, tableName);
  addTooltipsForTruncatedText(mirrorContainer);
  addProdIdTooltips(mirrorContainer);
  attachIdLinks(mirrorContainer);
}

/* =========================================================
   Add button binding (once)
   ========================================================= */
function bindDealsAddButtonOnce(buttonId, tableName) {
  const addButton = document.getElementById(buttonId);
  if (!addButton || addButton.dataset.bound === '1') return;

  addButton.dataset.bound = '1';
  addButton.addEventListener('click', (event) => {
    console.log('Start Add Deal', tableName);
    handleModalAction(event, filteredDealsData, null, tableName, 'add');
  });
}

/* =========================================================
   Filter / Dropdown: snapshot + restore
   (isoliert, damit wir hier gezielt debuggen kÃ¶nnen)
   ========================================================= */
function preserveAndRestoreFilterDropdown({ dropdownId, enabled = true } = {}) {
  if (!enabled) return null;

  const el = document.getElementById(dropdownId);
  if (!el) return null;

  const snap = {
    id: dropdownId,
    value: el.value,
    index: el.selectedIndex,
    text: el.selectedIndex >= 0 ? el.options[el.selectedIndex]?.text : null,
  };

  return {
    restore() {
      const dd = document.getElementById(snap.id);
      if (!dd) return;

      // restore by value first
      if (snap.value && dd.querySelector(`option[value="${CSS.escape(snap.value)}"]`)) {
        dd.value = snap.value;
      } else if (snap.text) {
        // fallback by text
        const opt = Array.from(dd.options).find(o => o.text === snap.text);
        if (opt) dd.value = opt.value;
        else if (snap.index >= 0 && snap.index < dd.options.length) dd.selectedIndex = snap.index;
      }

      // IMPORTANT:
      // If your dropdown filters depend on change event, keep it.
      // If you get loops, weâ€™ll gate it with a "silent" flag.
      // dd.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
}












