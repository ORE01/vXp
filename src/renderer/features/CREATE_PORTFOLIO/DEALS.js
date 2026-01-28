import processData from '../UI/MODAL_HELPER/dataProcessor.js';
import { handleModalAction } from '../UI/MODAL_HELPER/ModalActionHandler.js';
import { appState } from '../../renderer.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { attachIdLinks } from '../../utils/linksToTables.js';

let filteredDealsData;

// ADD-Button (Add braucht keinen RowIndex â†’ null)
export function dealsAddButtonHandler (event, selectedTableName) {
  console.log('Start Add Deal', selectedTableName)
  handleModalAction(event, filteredDealsData, null, selectedTableName, 'add');
}




// export function handleDealsData(receivedData, dealsTableName, opts = {}) {
//   console.log('Deals Data', receivedData, dealsTableName);

//   const tableName = dealsTableName || '';
//   const norm = String(tableName).trim().toUpperCase();

//   // âœ… NEW: allow orchestrator to force the container
//   const forced = opts.forceTarget; // 'offers' | 'deals' | null
//   const isOffer = forced === 'offers' ? true : forced === 'deals' ? false : /^OFFERS?_/.test(norm);

//   // kleine Helper nur fÃ¼r dieses Restore-Feature
//   const snapSelect = (id) => {
//     const el = document.getElementById(id);
//     if (!el) return null;
//     const i = el.selectedIndex;
//     return { id, value: el.value, index: i, text: i >= 0 ? el.options[i]?.text : null };
//   };

//   const restoreSelect = (snap) => {
//     if (!snap) return;
//     const el = document.getElementById(snap.id);
//     if (!el) return;

//     if (snap.value && el.querySelector(`option[value="${CSS.escape(snap.value)}"]`)) {
//       el.value = snap.value;
//     } else if (snap.text) {
//       const opt = Array.from(el.options).find(o => o.text === snap.text);
//       if (opt) el.value = opt.value;
//       else if (snap.index >= 0 && snap.index < el.options.length) el.selectedIndex = snap.index;
//     }

//     el.dispatchEvent(new Event('change', { bubbles: true }));
//   };

//   // Ziel-Container wÃ¤hlen
//   const targetId = isOffer ? 'offersDataContainer' : 'dealsDataContainer';
//   const otherId  = isOffer ? 'dealsDataContainer'  : 'offersDataContainer';
//   const targetContainer = document.getElementById(targetId);
//   if (!targetContainer || !receivedData) return;

//   // âœ… NEW: optionally disable dropdown restore when called from orchestrator
//   const doRestore = opts.restoreDropdown !== false;

//   const dropdownId = isOffer ? 'reportsOffersDropdown' : 'dealsDropdown';
//   const snap = doRestore ? snapSelect(dropdownId) : null;

//   const otherContainer = document.getElementById(otherId);
//   if (otherContainer) otherContainer.innerHTML = '';

//   filteredDealsData = receivedData;
//   targetContainer.innerHTML = processData(filteredDealsData, tableName);

//   addTooltipsForTruncatedText(targetContainer);
//   addProdIdTooltips(targetContainer);
//   attachIdLinks(targetContainer);

//   if (!isOffer) {
//     const mirrorContainer = document.getElementById('newPortfolioDealsDataContainer');
//     if (mirrorContainer) {
//       mirrorContainer.innerHTML = processData(filteredDealsData, tableName);
//       addTooltipsForTruncatedText(mirrorContainer);
//       addProdIdTooltips(mirrorContainer);
//       attachIdLinks(mirrorContainer);
//     }
//   }

//   const buttonId = isOffer ? 'offersAddButton' : 'dealsAddButton';
//   const addButton = document.getElementById(buttonId);
//   if (addButton && addButton.dataset.bound !== '1') {
//     addButton.dataset.bound = '1';
//     addButton.addEventListener('click', (event) => {
//       console.log('Start Add Deal', tableName);
//       handleModalAction(event, filteredDealsData, null, tableName, 'add');
//     });
//   }

//   if (doRestore) restoreSelect(snap);
// }

// export function handleDealsData(receivedData, dealsTableName, opts = {}) {
//   console.log('Deals Data', receivedData, dealsTableName);

//   const tableName = dealsTableName || '';

//   // âœ… Kontext kommt vom Orchestrator (oder default = deals)
//   const forced = opts.forceTarget; // 'offers' | 'deals' | undefined
//   const isOffer = forced === 'offers';

//   // kleine Helper nur fÃ¼r dieses Restore-Feature
//   const snapSelect = (id) => {
//     const el = document.getElementById(id);
//     if (!el) return null;
//     const i = el.selectedIndex;
//     return { id, value: el.value, index: i, text: i >= 0 ? el.options[i]?.text : null };
//   };

//   const restoreSelect = (snap) => {
//     if (!snap) return;
//     const el = document.getElementById(snap.id);
//     if (!el) return;

//     // zuerst per value
//     if (snap.value && el.querySelector(`option[value="${CSS.escape(snap.value)}"]`)) {
//       el.value = snap.value;
//     } else if (snap.text) {
//       // fallback per Text
//       const opt = Array.from(el.options).find(o => o.text === snap.text);
//       if (opt) el.value = opt.value;
//       else if (snap.index >= 0 && snap.index < el.options.length) el.selectedIndex = snap.index;
//     }

//     el.dispatchEvent(new Event('change', { bubbles: true }));
//   };

//   // Ziel-Container wÃ¤hlen
//   const targetId = isOffer ? 'offersDataContainer' : 'dealsDataContainer';
//   const otherId  = isOffer ? 'dealsDataContainer'  : 'offersDataContainer';
//   const targetContainer = document.getElementById(targetId);
//   if (!targetContainer || !receivedData) return;

//   // optional: disable dropdown restore when called from orchestrator
//   const doRestore = opts.restoreDropdown !== false;

//   // âœ… Dropdown-Handling: nur wenn wirklich gewÃ¼nscht
//   // (und IDs bleiben wie bisher, damit nichts bricht)
//   const dropdownId = isOffer ? 'reportsOffersDropdown' : 'dealsDropdown';
//   const snap = doRestore ? snapSelect(dropdownId) : null;

//   // anderen Container leeren
//   const otherContainer = document.getElementById(otherId);
//   if (otherContainer) otherContainer.innerHTML = '';

//   // Daten setzen & rendern
//   filteredDealsData = receivedData;
//   targetContainer.innerHTML = processData(filteredDealsData, tableName);

//   // UX-Extras
//   addTooltipsForTruncatedText(targetContainer);
//   addProdIdTooltips(targetContainer);
//   attachIdLinks(targetContainer);

//   // Spiegel-Render nur fÃ¼r Deals (nicht Offers)
//   if (!isOffer) {
//     const mirrorContainer = document.getElementById('newPortfolioDealsDataContainer');
//     if (mirrorContainer) {
//       mirrorContainer.innerHTML = processData(filteredDealsData, tableName);
//       addTooltipsForTruncatedText(mirrorContainer);
//       addProdIdTooltips(mirrorContainer);
//       attachIdLinks(mirrorContainer);
//     }
//   }

//   // Add-Button binden (einmal pro Button)
//   const buttonId = isOffer ? 'offersAddButton' : 'dealsAddButton';
//   const addButton = document.getElementById(buttonId);
//   if (addButton && addButton.dataset.bound !== '1') {
//     addButton.dataset.bound = '1';
//     addButton.addEventListener('click', (event) => {
//       console.log('Start Add Deal', tableName);
//       handleModalAction(event, filteredDealsData, null, tableName, 'add');
//     });
//   }

//   // Auswahl nach dem Rendern wiederherstellen
//   if (doRestore) restoreSelect(snap);
// }

export function handleDealsData(receivedData, dealsTableName, opts = {}) {
  // âœ… Exit early if no portfolio selected (no render, no clear, no log)
  const port_name = appState?.getSelectedPortTableName?.();
  if (!port_name) return;

  // (optional: keep the log only when useful)
  // console.log('Deals Data', receivedData, dealsTableName);

  const tableName = dealsTableName || '';

  const ctx = resolveDealsContext(opts);
  const { targetId, otherId, dropdownId, buttonId, isOffer } = ctx;

  const targetContainer = document.getElementById(targetId);
  if (!targetContainer) return;

  // Treat missing/empty payload as "clear UI"
  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    targetContainer.innerHTML = '';
    const otherContainer = document.getElementById(otherId);
    if (otherContainer) otherContainer.innerHTML = '';
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
    dropdownId: isOffer ? 'reportsOffersDropdown' : 'dealsDropdown',
    buttonId: isOffer ? 'offersAddButton' : 'dealsAddButton',
  };
}

/* =========================================================
   Rendering
   ========================================================= */
function renderDealsTableIntoContainer(container, rows, tableName) {
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
      dd.dispatchEvent(new Event('change', { bubbles: true }));
    }
  };
}












