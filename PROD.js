import processData from './renderer/dataProcessor.js';
import { handleFormAction, handleCouponFormAction , saveChanges} from './renderer/FormButtonHandler.js';
import { filterColumnsInData } from './renderer/dataProcessor.js';
import { addTooltipsForTruncatedText } from './utils/tooltips.js';
import { appState } from './renderer.js';
import { handleCouponData } from './PRODCoupon.js';


let prodData;

function filterProdData(data, filtersConfig) {
  return data.filter(dataPoint => {
    return Object.entries(filtersConfig).every(([key, valueSet]) => {
      return valueSet.has('ALL') || valueSet.has(dataPoint[key]);
    });
  });
}

// export function handleProdData(receivedData, filtersConfig) {
//   const prodDataContainer = document.getElementById('prodDataContainer');
//   prodData = receivedData;

//   if (prodDataContainer && prodData) {
//     let columns = ['PROD_ID', 'DESCRIPTION', 'CouponType', 'SCHEDULE', 'MATURITY', 'ISSUER', 'RANK', 'RATING_PROD', 'CS_Szenario', 'FINLIB', 'MODEL','METHODE'];
    
//     let filteredProdData = filterColumnsInData(filterProdData(prodData, filtersConfig), columns);

//     // console.log('PROD; handleProdData:', filteredProdData);
//     appState.setFilteredProdData(filteredProdData);

//     checkCSSzenarioFlag(filteredProdData);



//     const prodDataHTML = processData(filteredProdData, 'ProdAll');
//     prodDataContainer.innerHTML = prodDataHTML;

//     // TOOLTIP
    
//       addTooltipsForTruncatedText(prodDataContainer);

//     // Edit Buttons
//     const prodEditButtons = document.querySelectorAll('#prodDataContainer .edit-button');
//     prodEditButtons.forEach((button) => {
//       button.addEventListener('click', (event) => {

//         event.stopPropagation();
//         const tableName = 'ProdAll';
//         const actionType = 'edit';
//         const rowIndex = parseInt(button.getAttribute('data-row'), 10);
//         handleFormAction(event, prodData, rowIndex, tableName, actionType);

//         // Get the correct row data from prodData
//         const selectedRow = prodData[rowIndex];
//         if (!selectedRow || !selectedRow.PROD_ID) {
//           console.warn(`No PROD_ID found for row index: ${rowIndex}`);
//           return;
//         }
//         const prodId = selectedRow.PROD_ID; // Extract PROD_ID
//         // console.log(`Editing PROD_ID: ${prodId}`);
//         const couponSchedule = selectedRow.SCHEDULE;
//         // console.log(`Editing couponSchedule: ${couponSchedule}`);
//         const startDate = selectedRow.START_DATE
//         // console.log(`Editing startDate: ${startDate}`);
//         const maturity = selectedRow.MATURITY
//         // console.log(`Editing maturity: ${maturity}`);
//         const couponfreq = selectedRow.TENOR
//         // console.log(`Editing tenor: ${couponfreq}`);
        
//         handleCouponModal(prodId, couponSchedule, startDate, maturity, couponfreq);
//       });


//     });

//     // Add Button
//     const prodAddButton = document.getElementById('prodAddButton');
//     prodAddButton.addEventListener('click', (event) => {
//       const tableName = 'ProdAll';
//       const actionType = 'add';
//       handleFormAction(event, prodData, null, tableName, actionType);
//     });
//   }
// }

// ── Deine Funktion: jetzt mit PROD_ID-Klickverhalten ───────────────────────

// export function handleProdData(filtersConfig) {
//   const prodDataContainer = document.getElementById('prodDataContainer');
 
//   prodData = appState.getProdData();
//   console.log('prodData', prodData)

//   if (!(prodDataContainer && prodData)) return;

//   const columns = [
//     'PROD_ID','DESCRIPTION','CouponType','SCHEDULE','MATURITY','ISSUER',
//     'RANK','RATING_PROD','CS_Szenario','FINLIB','MODEL','METHODE'
//   ];

//   const filteredProdData = filterColumnsInData(
//     filterProdData(prodData, filtersConfig),
//     columns
//   );

//   appState.setFilteredProdData(filteredProdData);
//   checkCSSzenarioFlag(filteredProdData);

//   const prodDataHTML = processData(filteredProdData, 'ProdAll');
//   prodDataContainer.innerHTML = prodDataHTML;

//   // Tooltips
//   addTooltipsForTruncatedText(prodDataContainer);

//   // Edit-Buttons (wie bisher)
//   const prodEditButtons = document.querySelectorAll('#prodDataContainer .edit-button');
//   prodEditButtons.forEach((button) => {
//     button.addEventListener('click', (event) => {
//       event.stopPropagation();
//       const tableName = 'ProdAll';
//       const actionType = 'edit';
//       const rowIndex = parseInt(button.getAttribute('data-row'), 10);
//       handleFormAction(event, prodData, rowIndex, tableName, actionType);

//       const selectedRow = prodData[rowIndex];
//       if (!selectedRow || !selectedRow.PROD_ID) return;

//       const prodId         = selectedRow.PROD_ID;
//       const couponSchedule = selectedRow.SCHEDULE;
//       const startDate      = selectedRow.START_DATE;
//       const maturity       = selectedRow.MATURITY;
//       const couponfreq     = selectedRow.TENOR;

//       handleCouponModal(prodId, couponSchedule, startDate, maturity, couponfreq);
//     });
//   });

//   // 👉 Neu: PROD_ID klickbar machen (ruft intern den Edit-Button der gleichen Zeile auf)
//   attachProdIdAsEdit(prodDataContainer);
  

//   // Add-Button (wie bisher)
//   const prodAddButton = document.getElementById('prodAddButton');
//   if (prodAddButton) {
//     prodAddButton.addEventListener('click', (event) => {
//       const tableName = 'ProdAll';
//       const actionType = 'add';
//       handleFormAction(event, prodData, null, tableName, actionType);
//     });
//   }
// }

export function handleProdData(filtersConfig) {
  const prodDataContainer = document.getElementById('prodDataContainer');
  if (!prodDataContainer) return;

  // Daten holen
  prodData = appState.getProdData();
  if (!Array.isArray(prodData) || prodData.length === 0) {
    console.warn('handleProdData: prodData leer/ungültig');
    prodDataContainer.innerHTML = '';
    return;
  }

  // Spalten filtern
  const columns = [
    'PROD_ID','DESCRIPTION','CouponType','SCHEDULE','MATURITY','ISSUER',
    'RANK','RATING_PROD','CS_Szenario','FINLIB','MODEL','METHODE'
  ];

  const filteredProdData = filterColumnsInData(
    filterProdData(prodData, filtersConfig || {}),
    columns
  );

  appState.setFilteredProdData(filteredProdData);
  checkCSSzenarioFlag(filteredProdData);

  // Render
  const prodDataHTML = processData(filteredProdData, 'ProdAll');
  prodDataContainer.innerHTML = prodDataHTML;

  // Tooltips
  try { addTooltipsForTruncatedText(prodDataContainer); } catch (e) { console.warn('Tooltips fail:', e); }

  // ---------- PROD_ID klickbar machen (ohne Edit-Buttons) ----------
  const table =
    prodDataContainer.querySelector('table') ||
    prodDataContainer.querySelector('.data-container table');

  if (!table) {
    console.warn('handleProdData: keine Tabelle gefunden – aktiviere Fallback-Delegation');
    attachProdIdDelegationFallback(prodDataContainer, prodData);
    return;
  }

  // Header finden
  const headerRow = (table.tHead && table.tHead.rows && table.tHead.rows[0]) || table.querySelector('thead tr');
  if (!headerRow) {
    console.warn('handleProdData: kein thead/header – aktiviere Fallback-Delegation');
    attachProdIdDelegationFallback(prodDataContainer, prodData);
    return;
  }

  const headerCells = Array.from(headerRow?.cells ?? []);
  const prodColIndex = headerCells.findIndex(th => (th.textContent || '').trim().toUpperCase() === 'PROD_ID');
  if (prodColIndex === -1) {
    console.warn('handleProdData: PROD_ID-Spalte nicht gefunden – aktiviere Fallback-Delegation');
    attachProdIdDelegationFallback(prodDataContainer, prodData);
    return;
  }

  const tbody = (table.tBodies && table.tBodies[0]) || table.querySelector('tbody');
  if (!tbody) {
    console.warn('handleProdData: kein tbody – aktiviere Fallback-Delegation');
    attachProdIdDelegationFallback(prodDataContainer, prodData);
    return;
  }

  const rows = Array.from(tbody.rows || []);
  // Wichtig: rows ist ein Array (nie null) → .forEach sicher.
  rows.forEach((row) => {
    const cell = row.cells?.[prodColIndex];
    if (!cell) return;

    const prodIdText = (cell.textContent || '').trim();

    // Falls schon ein Trigger in der Zelle steckt, nicht doppeln
    let trigger = cell.querySelector('.prod-id-link');
    if (!trigger) {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'prod-id-link link-button';
      btn.textContent = prodIdText || '—';
      cell.textContent = '';
      cell.appendChild(btn);
      trigger = btn;
    }

    trigger.addEventListener('click', (ev) => {
      ev.preventDefault();
      ev.stopPropagation();

      // Mapping über PROD_ID (robust gegen Filter/Reihenfolge)
      const rowIndex = prodData.findIndex(r => String(r?.PROD_ID).trim() === prodIdText);
      if (rowIndex < 0) {
        console.warn('PROD_ID nicht in prodData gefunden:', prodIdText);
        return;
      }

      const tableName = 'ProdAll';
      handleFormAction(ev, prodData, rowIndex, tableName, 'edit');

      const selectedRow = prodData[rowIndex];
      if (selectedRow?.PROD_ID) {
        // 1 Frame warten, damit das Modal-DOM steht
        requestAnimationFrame(() => {
          handleCouponModal(
            selectedRow.PROD_ID,
            selectedRow.SCHEDULE,
            selectedRow.START_DATE,
            selectedRow.MATURITY,
            selectedRow.TENOR
          );
        });
      }
    });
  });

  // Add-Button (optional)
  const prodAddButton = document.getElementById('prodAddButton');
  if (prodAddButton) {
    prodAddButton.addEventListener('click', (event) => {
      event.preventDefault();
      event.stopPropagation();
      const tableName = 'ProdAll';
      handleFormAction(event, prodData, null, tableName, 'add');
    });
  }
}

// ---------- Fallback: Event-Delegation auf Container, falls table/thead/tbody fehlen ----------
function attachProdIdDelegationFallback(container, prodDataArr) {
  // Doppelte Bindung vermeiden
  if (container.dataset.prodIdDelegation === '1') return;
  container.dataset.prodIdDelegation = '1';

  // Wir versuchen, dynamisch die PROD_ID-Spalte zu lokalisieren – oder per data-col
  container.addEventListener('click', (e) => {
    const td = e.target.closest('td,[data-col="PROD_ID"]');
    if (!td || !container.contains(td)) return;

    // wenn data-col vorhanden → okay; sonst prüfen, ob die Zelle in einer PROD_ID-Spalte ist
    let isProdIdCol = td.matches('[data-col="PROD_ID"]');
    if (!isProdIdCol) {
      // Versuch über Header-Textausrichtung
      const table = td.closest('table');
      const headerRow = table?.tHead?.rows?.[0] || table?.querySelector('thead tr');
      if (headerRow) {
        const headerCells = Array.from(headerRow.cells || []);
        const idx = headerCells.findIndex(th => (th.textContent || '').trim().toUpperCase() === 'PROD_ID');
        if (idx > -1) isProdIdCol = (td.cellIndex === idx);
      }
    }
    if (!isProdIdCol) return;

    const prodId = (td.textContent || '').trim();
    if (!prodId) return;

    e.preventDefault();
    e.stopPropagation();

    // Lookup und öffnen
    const rowIndex = prodDataArr.findIndex(r => String(r?.PROD_ID).trim() === prodId);
    if (rowIndex < 0) {
      console.warn('Fallback: PROD_ID nicht in prodData gefunden:', prodId);
      return;
    }

    const tableName = 'ProdAll';
    const fakeEvt = new Event('click', { bubbles: true });
    handleFormAction(fakeEvt, prodDataArr, rowIndex, tableName, 'edit');

    const row = prodDataArr[rowIndex];
    if (row?.PROD_ID) {
      requestAnimationFrame(() => {
        handleCouponModal(row.PROD_ID, row.SCHEDULE, row.START_DATE, row.MATURITY, row.TENOR);
      });
    }
  }, true); // capture hilft gegen globale Listener
}


    export function handleCouponModal(prodId, couponSchedule, startDate, maturity, couponfreq) {

      const modalContent = document.querySelector('.modal-content');
      if (!modalContent) {
        console.warn('Modal content container not found!');
        return;
      }
    // COUPON BUTTON:

      // COUPON button: Check exists to prevent duplicates
      let couponButton = document.getElementById('coupon-button');
      if (!couponButton) {
        // Create the button
        couponButton = document.createElement('button');
        couponButton.id = 'coupon-button';
        couponButton.textContent = 'Coupon Schedule';
        couponButton.classList.add('chart-button'); // Use the same style class as your other buttons

        // COUPON button: Append to the modal (next to Save/Delete buttons)
        const saveButton = document.getElementById('saveButton');
        if (saveButton) {
          saveButton.parentElement.appendChild(couponButton);
        } else {
          console.warn('Save button not found! Adding the coupon button at the end.');
          modalContent.appendChild(couponButton);
        }
      }

      // COUPON SCHEDULE: EVENT LISTENER with the current prodId

      couponButton.onclick = () => {
        console.log(`Opening Coupon Modal for PROD_ID: ${prodId}`); // Debug log
        handleCouponData(prodId, couponSchedule, startDate, maturity, couponfreq); // Ensure the current prodId is passed
      };
      
    }



    // ── Helper: PROD_ID klickbar machen → Edit-Button der Zeile auslösen ───────
    export function attachProdIdAsEdit(container) {
      // Tabelle suchen
      const table =
        container.querySelector('table') ||
        container.querySelector('.data-container table');
      if (!table) return;

      // Header-Zellen ermitteln
      const headerRow =
        (table.tHead && table.tHead.rows && table.tHead.rows[0]) ||
        table.querySelector('thead tr');
      if (!headerRow) return;

      const headers = Array.from(headerRow.cells || []);
      // Spalte "PROD_ID" finden
      let prodColIndex = headers.findIndex(th =>
        (th.textContent || '').trim().toUpperCase() === 'PROD_ID'
      );
      if (prodColIndex === -1) return;

      // Tabellenkörper-Zeilen
      const tbody = table.tBodies && table.tBodies[0] ? table.tBodies[0] : table.querySelector('tbody');
      if (!tbody) return;

      const rows = Array.from(tbody.rows || []);
      rows.forEach((row) => {
        const cell = row.cells && row.cells[prodColIndex];
        if (!cell) return;

        const currentText = (cell.textContent || '').trim();

        // Falls schon ein Link/Button drin ist, nicht doppeln
        let trigger = cell.querySelector('.prod-id-link');
        if (!trigger) {
          // Button im Link-Stil erzeugen
          const btn = document.createElement('button');
          btn.type = 'button';
          btn.className = 'prod-id-link link-button';
          btn.textContent = currentText || '—';
          // Zelle säubern & Button einsetzen
          cell.textContent = '';
          cell.appendChild(btn);
          trigger = btn;
        }

        // passenden Edit-Button in der *gleichen Zeile* suchen
        // (robuster als über data-row – funktioniert mit dem HTML aus processData)
        const editBtn = row.querySelector('.edit-button');

        // Fallback: im gesamten Container nach data-row aus der Zeile suchen
        // (nur falls `editBtn` nicht gefunden wurde)
        let dataRowIdx = row.getAttribute('data-row');
        if (!editBtn && dataRowIdx != null) {
          const candidate = container.querySelector(`.edit-button[data-row="${dataRowIdx}"]`);
          if (candidate) {
            trigger.addEventListener('click', (ev) => {
              ev.preventDefault();
              ev.stopPropagation();
              candidate.click();
            });
            return;
          }
        }

        // Normalfall: Edit-Button in der Zeile gefunden
        if (editBtn) {
          trigger.addEventListener('click', (ev) => {
            ev.preventDefault();
            ev.stopPropagation();
            editBtn.click();
          });
        }
      });
    }







      function checkCSSzenarioFlag(filteredProdData) {
        // console.log('🔍 CS Szenario Check läuft...');

        const csWarningContainer = document.getElementById('csWarningContainer');
        const csWarningLight = document.getElementById('csWarning'); 

        if (!csWarningContainer || !csWarningLight) {
            console.error("⚠️ Fehler: 'csWarningContainer' oder 'csWarning' nicht gefunden!");
            return;
        }

        // Finde alle betroffenen Zeilen
        const affectedRows = filteredProdData.filter(row =>
          row.CS_Szenario !== null &&
          row.CS_Szenario !== undefined &&
          (
            typeof row.CS_Szenario === 'number' ||
            (typeof row.CS_Szenario === 'string' && row.CS_Szenario.trim() !== '')
          )
        );
        
        
        const affectedProdIds = affectedRows.map(row => row.PROD_ID);

        if (affectedProdIds.length > 0) {
            csWarningContainer.style.visibility = 'visible'; // Warnung sichtbar machen
            csWarningLight.style.backgroundColor = 'red';  // Warnleuchte aktivieren

            // 🆕 PROD_IDs als Text hinzufügen, aber Warnleuchte beibehalten
            const idsText = affectedProdIds.join(', ');
            document.getElementById('csWarningText').textContent = idsText;

            // console.log(`🚨 CS Szenario aktiv für folgende PROD_IDs:`, affectedProdIds);
        } else {
            csWarningContainer.style.visibility = 'hidden'; // Warnung verstecken
            csWarningLight.style.backgroundColor = 'gray';  // Standardfarbe zurücksetzen

            // console.log('✅ Kein CS Szenario gesetzt.');
        }
      }



















export { prodData };