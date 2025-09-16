import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';
import { appState } from './renderer.js'; 
import { addTooltipsForTruncatedText, addProdIdTooltips } from './utils/tooltips.js';
import { handleCouponModal } from './PROD.js'; // Pfad ggf. anpassen


let filteredDealsData;
// ADD Button
export function dealsAddButtonHandler (event, selectedTableName) {
  // dealsAddButton.removeEventListener('click', dealsAddButtonHandler);
  const actionType = 'add';
  handleFormAction(event, filteredDealsData, null, selectedTableName, actionType);
};


// export function handleDealsData(receivedData, dealsTableName) {
//   //console.log('DEALS receivedData:', receivedData);
//   //console.log('DEALS selectedTableName:', dealsTableName);

//   const dealsDataContainer = document.getElementById('dealsDataContainer');
//   const dealsData = receivedData;
//   const tableName = dealsTableName;

//   if (dealsDataContainer && dealsData) {
//     const filteredDealsData = receivedData    //appState.getFilteredData('deals');
//     //console.log('appState.getDealsData():', filteredDealsData);

//     const dealsDataHTML = processData(filteredDealsData, dealsTableName);

//     dealsDataContainer.innerHTML = dealsDataHTML; // Render HTML first
//     //console.log('Deals Data Container HTML:', dealsDataContainer.innerHTML);



//       addTooltipsForTruncatedText(dealsDataContainer);
//       addProdIdTooltips(dealsDataContainer); 

      
      

//       // Edit Button
//       const dealsEditButtons = document.querySelectorAll('#dealsDataContainer .edit-button'); // Now query the buttons
//       dealsEditButtons.forEach((button) => {
//         button.addEventListener('click', (event) => {
//           event.stopPropagation();
//           const actionType = 'edit';
//           const rowIndex = parseInt(button.getAttribute('data-row'), 10);
//           handleFormAction(event, filteredDealsData, rowIndex, tableName, actionType);
//         });
//       });

//       // Add Button
//       const dealsAddButton = document.getElementById('dealsAddButton');
//       dealsAddButton.addEventListener('click', (event) => {
//         const actionType = 'add';
//         // console.log('DEALS filteredDealsData:', filteredDealsData);
//         handleFormAction(event, filteredDealsData, null, tableName, actionType);
//       });

// enableDealsProdIdLink(dealsDataContainer);

//   }
// }

// export function handleDealsData(receivedData, dealsTableName) {
//   const dealsDataContainer = document.getElementById('dealsDataContainer');
//   if (!dealsDataContainer || !receivedData) return;

//   // Daten setzen
//   filteredDealsData = receivedData;
//   const tableName = dealsTableName;

//   // Render
//   const dealsDataHTML = processData(filteredDealsData, dealsTableName);
//   dealsDataContainer.innerHTML = dealsDataHTML;

//   // UX-Extras
//   addTooltipsForTruncatedText(dealsDataContainer);
//   addProdIdTooltips(dealsDataContainer);

//   // 👉 NEU: TRADE_ID klickbar → öffnet Deals-Modal (statt Edit-Button)
//   attachTradeIdOpensDealsModal(dealsDataContainer, tableName, filteredDealsData);

//   // (Optional/bereits vorhanden) PROD_ID → Produkt-Modal
//   if (typeof enableDealsProdIdLink === 'function') {
//     enableDealsProdIdLink(dealsDataContainer);
//   }

//   // Add-Button bleibt
//   const dealsAddButton = document.getElementById('dealsAddButton');
//   if (dealsAddButton) {
//     dealsAddButton.addEventListener('click', (event) => {
//       const actionType = 'add';
//       handleFormAction(event, filteredDealsData, null, tableName, actionType);
//     });
//   }
// }

export function handleDealsData(receivedData, dealsTableName) {
  console.log('dealsTableName:', dealsTableName)
  const tableName = dealsTableName || '';
  const norm = String(tableName).trim().toUpperCase();
  const isOffer = /^OFFERS?_/.test(norm); // OFFER_ oder OFFERS_

  // Ziel-Container wählen
  const targetId = isOffer ? 'offersDataContainer' : 'dealsDataContainer';
  const otherId  = isOffer ? 'dealsDataContainer'  : 'offersDataContainer';
  const targetContainer = document.getElementById(targetId);
  if (!targetContainer || !receivedData) return;

  // Den jeweils anderen Container leeren, damit nichts doppelt angezeigt wird
  const otherContainer = document.getElementById(otherId);
  if (otherContainer) otherContainer.innerHTML = '';

  // Daten setzen & rendern
  filteredDealsData = receivedData;
  const dealsDataHTML = processData(filteredDealsData, tableName);
  targetContainer.innerHTML = dealsDataHTML;

  // UX-Extras
  addTooltipsForTruncatedText(targetContainer);
  addProdIdTooltips(targetContainer);

  // TRADE_ID klickbar → öffnet Deals-Modal (statt Edit-Button)
  attachTradeIdOpensDealsModal(targetContainer, tableName, filteredDealsData);

  // PROD_ID → Produkt-Modal (falls vorhanden)
  if (typeof enableDealsProdIdLink === 'function') {
    enableDealsProdIdLink(targetContainer);
  }

  // Add-Button (getrennt für OFFERS/DEALS)
  const buttonId = isOffer ? 'offersAddButton' : 'dealsAddButton';
  const addButton = document.getElementById(buttonId);
  if (addButton && !addButton.dataset.bound) {
    addButton.dataset.bound = '1'; // Doppel-Listener vermeiden
    addButton.addEventListener('click', (event) => {
      const actionType = 'add';
      
      handleFormAction(event, filteredDealsData, null, tableName, actionType);
    });
  }
}




function enableDealsProdIdLink(container) {
  if (!container) return;

  // PROD_ID-Spaltenindex ermitteln
  const ths = container.querySelectorAll('thead th');
  let prodIdx = -1;
  ths.forEach((th, i) => {
    if ((th.textContent || '').trim().toUpperCase() === 'PROD_ID') prodIdx = i;
  });
  if (prodIdx === -1) return;

  // Optik: Zellen als Link markieren
  container.querySelectorAll('tbody tr').forEach(tr => {
    const cell = tr.cells?.[prodIdx];
    if (cell) cell.classList.add('prod-id-cell'); // nutzt dein CSS, s. unten
  });

  // Listener nur einmal binden
  if (container.dataset.prodIdBound === '1') return;
  container.dataset.prodIdBound = '1';

  // Frühzeitig abfangen (gegen Panel-Trigger/Hash)
  ['pointerdown','mousedown','click'].forEach((type) => {
    container.addEventListener(type, (e) => {
      const td = e.target.closest('td');
      if (!td || td.cellIndex !== prodIdx) return;

      const prodId =
        td.querySelector('[data-prod-id]')?.getAttribute('data-prod-id')?.trim() ||
        (td.textContent || '').trim();
      if (!prodId) return;

      // *Alles* stoppen, damit kein Products-Panel aufgeht
      e.preventDefault();
      e.stopPropagation();
      e.stopImmediatePropagation();

      if (type === 'click') openProdEditorByProdId(prodId);
    }, true); // capture
  });
}

function openProdEditorByProdId(prodId) {
  const prodDataArr = appState.getProdData() || [];
  const rowIndex = prodDataArr.findIndex(r => String(r?.PROD_ID).trim() === String(prodId).trim());
  if (rowIndex < 0) { console.warn('PROD_ID nicht gefunden:', prodId); return; }

  const fakeEvt = new Event('click', { bubbles: true });
  handleFormAction(fakeEvt, prodDataArr, rowIndex, 'ProdAll', 'edit');

  // Nach dem Öffnen direkt dein Coupon-Modal aufrufen
  const row = prodDataArr[rowIndex];
  requestAnimationFrame(() => {
    if (row) {
      handleCouponModal(row.PROD_ID, row.SCHEDULE, row.START_DATE, row.MATURITY, row.TENOR);
    }
  });
}

function attachTradeIdOpensDealsModal(container, tableName, dataArr) {
  if (!container || !Array.isArray(dataArr)) return;

  // TRADE_ID-Spaltenindex ermitteln
  const ths = container.querySelectorAll('thead th');
  let tradeIdx = -1;
  ths.forEach((th, i) => {
    if ((th.textContent || '').trim().toUpperCase() === 'TRADE_ID') tradeIdx = i;
  });
  if (tradeIdx === -1) return;

  // Zeilen durchgehen und Button im Link-Look einbauen
  const rows = container.querySelectorAll('tbody tr');
  rows.forEach((row) => {
    const cell = row.cells?.[tradeIdx];
    if (!cell) return;

    const tradeIdText = (cell.textContent || '').trim();
    if (!tradeIdText) return;

    // Bereits vorhanden? Dann nicht doppeln
    let trigger = cell.querySelector('.trade-id-link');
    if (!trigger) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'trade-id-link link-button'; // nutzt deinen Link-Style
      btn.textContent = tradeIdText;
      cell.textContent = '';
      cell.appendChild(btn);
      trigger = btn;
    }

    // Row-Index robust bestimmen (data-row bevorzugt, sonst Lookup über TRADE_ID)
    const dataRowIdxAttr = row.getAttribute('data-row');
    let rowIndex = (dataRowIdxAttr != null)
      ? parseInt(dataRowIdxAttr, 10)
      : dataArr.findIndex(r => String(r?.TRADE_ID).trim() === tradeIdText);

    trigger.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      // Falls sich die Daten geändert haben: RowIndex frisch bestimmen
      if (rowIndex == null || rowIndex < 0) {
        rowIndex = dataArr.findIndex(r => String(r?.TRADE_ID).trim() === tradeIdText);
        if (rowIndex < 0) {
          console.warn('TRADE_ID nicht gefunden:', tradeIdText);
          return;
        }
      }

      // 👉 exakt der gleiche Edit-Flow wie der alte Edit-Button
      
      handleFormAction(ev, dataArr, rowIndex, 'DealsMain', 'edit');
    });
  });
}

