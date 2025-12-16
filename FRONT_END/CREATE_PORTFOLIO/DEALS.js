import processData from '../../MODAL_HELPER/dataProcessor.js';
import { handleModalAction } from '../../MODAL_HELPER/ModalActionHandler.js';
import { appState } from '../renderer.js';
import { addTooltipsForTruncatedText, addProdIdTooltips } from '../../utils/tooltips.js';
import { attachIdLinks } from '../../utils/linksToTables.js';

let filteredDealsData;

// ADD-Button (Add braucht keinen RowIndex → null)
export function dealsAddButtonHandler (event, selectedTableName) {
  console.log('Start Add Deal', selectedTableName)
  handleModalAction(event, filteredDealsData, null, selectedTableName, 'add');
}

// export function handleDealsData(receivedData, dealsTableName) {
//   console.log('Deals Data', receivedData, dealsTableName)
//   const tableName = dealsTableName || '';
//   const norm = String(tableName).trim().toUpperCase();
//   const isOffer = /^OFFERS?_/.test(norm); // OFFER_ oder OFFERS_

//   // kleine Helper nur für dieses Restore-Feature
//   const snapSelect = (id) => {
//     const el = document.getElementById(id);
//     if (!el) return null;
//     const i = el.selectedIndex;
//     return {
//       id,
//       value: el.value,
//       index: i,
//       text: i >= 0 ? el.options[i]?.text : null,
//     };
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

//     // Event feuern, damit abhängige UI reagiert
//     el.dispatchEvent(new Event('change', { bubbles: true }));
//   };

//   // Ziel-Container wählen
//   const targetId = isOffer ? 'offersDataContainer' : 'dealsDataContainer';
//   const otherId  = isOffer ? 'dealsDataContainer'  : 'offersDataContainer';
//   const targetContainer = document.getElementById(targetId);
//   if (!targetContainer || !receivedData) return;

//   // 👉 aktuelle Auswahl vorm Rendern merken
//   const dropdownId = isOffer ? 'reportsOffersDropdown' : 'dealsDropdown';
//   const snap = snapSelect(dropdownId);

//   // anderen Container leeren
//   const otherContainer = document.getElementById(otherId);
//   if (otherContainer) otherContainer.innerHTML = '';

//   // Daten setzen & rendern
//   filteredDealsData = receivedData;
//   targetContainer.innerHTML = processData(filteredDealsData, tableName);

//   // UX-Extras
//   addTooltipsForTruncatedText(targetContainer);
//   addProdIdTooltips(targetContainer);

//   // IDs als Links binden (einmal pro Container)
//   attachIdLinks(targetContainer);

//   // Add-Button binden (einmal pro Button)
//   const buttonId = isOffer ? 'offersAddButton' : 'dealsAddButton';
//   const addButton = document.getElementById(buttonId);
//   if (addButton && addButton.dataset.bound !== '1') {
//     addButton.dataset.bound = '1';
//     addButton.addEventListener('click', (event) => {
//       console.log('Start Add Deal', tableName)
//       handleFormAction(event, filteredDealsData, null, tableName, 'add');
//     });
//   }

//   // 👉 Auswahl nach dem Rendern wiederherstellen
//   restoreSelect(snap);
// }
export function handleDealsData(receivedData, dealsTableName) {
  console.log('Deals Data', receivedData, dealsTableName);
  const tableName = dealsTableName || '';
  const norm = String(tableName).trim().toUpperCase();
  const isOffer = /^OFFERS?_/.test(norm); // OFFER_ oder OFFERS_

  // kleine Helper nur für dieses Restore-Feature
  const snapSelect = (id) => {
    const el = document.getElementById(id);
    if (!el) return null;
    const i = el.selectedIndex;
    return {
      id,
      value: el.value,
      index: i,
      text: i >= 0 ? el.options[i]?.text : null,
    };
  };

  const restoreSelect = (snap) => {
    if (!snap) return;
    const el = document.getElementById(snap.id);
    if (!el) return;

    // zuerst per value
    if (snap.value && el.querySelector(`option[value="${CSS.escape(snap.value)}"]`)) {
      el.value = snap.value;
    } else if (snap.text) {
      // fallback per Text
      const opt = Array.from(el.options).find(o => o.text === snap.text);
      if (opt) el.value = opt.value;
      else if (snap.index >= 0 && snap.index < el.options.length) el.selectedIndex = snap.index;
    }

    // Event feuern, damit abhängige UI reagiert
    el.dispatchEvent(new Event('change', { bubbles: true }));
  };

  // Ziel-Container wählen
  const targetId = isOffer ? 'offersDataContainer' : 'dealsDataContainer';
  const otherId  = isOffer ? 'dealsDataContainer'  : 'offersDataContainer';
  const targetContainer = document.getElementById(targetId);
  if (!targetContainer || !receivedData) return;

  // 👉 aktuelle Auswahl vorm Rendern merken
  const dropdownId = isOffer ? 'reportsOffersDropdown' : 'dealsDropdown';
  const snap = snapSelect(dropdownId);

  // anderen Container leeren
  const otherContainer = document.getElementById(otherId);
  if (otherContainer) otherContainer.innerHTML = '';

  // Daten setzen & im Haupt-Container rendern
  filteredDealsData = receivedData;
  targetContainer.innerHTML = processData(filteredDealsData, tableName);

  // UX-Extras im Haupt-Container
  addTooltipsForTruncatedText(targetContainer);
  addProdIdTooltips(targetContainer);

  // IDs als Links binden (einmal pro Container)
  attachIdLinks(targetContainer);

  // 🆕 Spiegel-Render: Deals auch im NEW-PORTFOLIO-Panel anzeigen (nur für Deals, nicht Offers)
  if (!isOffer) {
    const mirrorContainer = document.getElementById('newPortfolioDealsDataContainer');
    if (mirrorContainer) {
      mirrorContainer.innerHTML = processData(filteredDealsData, tableName);
      addTooltipsForTruncatedText(mirrorContainer);
      addProdIdTooltips(mirrorContainer);
      attachIdLinks(mirrorContainer);
    }
  }

  // Add-Button binden (einmal pro Button)
  const buttonId = isOffer ? 'offersAddButton' : 'dealsAddButton';
  const addButton = document.getElementById(buttonId);
  if (addButton && addButton.dataset.bound !== '1') {
    addButton.dataset.bound = '1';
    addButton.addEventListener('click', (event) => {
      console.log('Start Add Deal', tableName);
      handleModalAction(event, filteredDealsData, null, tableName, 'add');
    });
  }

  // 👉 Auswahl nach dem Rendern wiederherstellen
  restoreSelect(snap);
}





