import { generateInputFields } from './HandleInputFields.js';
import { formatInputFieldValue } from '../../../utils/format.js';
import { makeModalDraggable } from './DraggableModal.js';
import { issuerData } from '../../NEW_PRODUCTS/ISSUER.js';

import { appState } from '../../renderer.js';
import { handleDealsData } from '../../CREATE_PORTFOLIO/DEALS.js';
import { buildOrderedFieldsForModal } from '../../NEW_PRODUCTS/PROD.js';



let isAddingRow;

// --- helpers to normalize dates for DB (YYYY-MM-DD) ---
function toISO(d) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${dd}`;
}
function addYearsISO(isoYMD, years) {
  if (!isoYMD) return '';
  const [y, m, d] = isoYMD.split('-').map(Number);
  const base = new Date(y, m - 1, d);
  base.setFullYear(base.getFullYear() + Number(years || 0));
  return toISO(base);
}
// --- helpers END



export function handleModalAction(event, data, rowIndex, selectedTableName, actionType) {
  console.log('selectedTableName:', selectedTableName);

  displayModal(actionType, rowIndex);
  setupModalFields(actionType, data, rowIndex, selectedTableName);

  //ADD:
  if (actionType === 'add') {
        console.log('add_TEST:')
    setupAddOperation(data, selectedTableName);

  //EDIT:
  } else if (actionType === 'edit') {
    const rowData = data[rowIndex];
    console.log('data',data)
        // console.log('Row Index:', rowIndex);
        // console.log('Data Length:', data.length);
        // console.log('Selected Row Data:', data[rowIndex]); // This should NOT be undefined
    setupEditOperation(rowData, rowIndex, selectedTableName);
  }
  removeCouponButton();
}
        function displayModal(actionType, rowIndex = null) {
          const modal = document.getElementById('modal');
          const modalContent = modal.querySelector('.modal-content');
          const modalTitle = modal.querySelector('h2');

          // Set the modal title based on the action type
          if (actionType === 'add') {
            modalTitle.textContent = 'Add New Row';
          } else if (actionType === 'edit' && rowIndex !== null) {
            modalTitle.textContent = `Edit Row ${rowIndex + 1}`;
          }

          // Clear specific sections for ProdAll and ProdCouponSchedules
          const prodSection = document.getElementById('prodSection');
          const couponSection = document.getElementById('couponSection');

          if (prodSection) prodSection.innerHTML = ''; // Clear only ProdAll section
          if (couponSection) couponSection.innerHTML = ''; // Clear only CouponSchedules section

          // Show the modal
          modal.style.display = 'block';
        
          // Close button handler
          const closeButton = modal.querySelector('.close');
          closeButton.onclick = () => {
            modal.style.display = 'none'; // Hide the modal
          };

          makeModalDraggable(modalContent);
        }
        function setupModalFields(actionType, data, rowIndex, selectedTableName) {
          const modal = document.getElementById('modal');
          const form = modal.querySelector('#editForm');
          form.innerHTML = '';

          // Issuer-Liste
          const uniqueIssuers = [...new Set(issuerData.map((item) => item.ISSUER))];

          // ADD:
          if (actionType === 'add') {
            console.log('addTEST2');

            // 🔹 Basis: immer die LETZTE Zeile aus den vorhandenen Daten
            const baseRow = (data && data.length > 0)
              ? data[data.length - 1]   // letzte Zeile
              : {};

            let rowDataForForm = {};

            if (selectedTableName === 'ProdAll') {
              // Für ProdAll: Reihenfolge über Helper, aber Werte der letzten Zeile behalten
              const orderedTemplate = buildOrderedFieldsForModal(baseRow) || {};
              rowDataForForm = { ...orderedTemplate };
            } else {
              // Für alle anderen Tabellen: Werte der letzten Zeile übernehmen
              rowDataForForm = { ...baseRow };
            }

            // Primärschlüssel-Felder beim ADD leeren (id soll neu vergeben werden)
            if ('id' in rowDataForForm) {
              rowDataForForm.id = '';
            }
            if ('ID' in rowDataForForm) {
              rowDataForForm.ID = '';
            }

            // Optional: für bestimmte Tabellen Defaults setzen/anpassen
            if (selectedTableName === 'CreditVaRInput') {
              // Name z.B. leer lassen oder mit Prefix füllen
              // rowDataForForm.name = '';
              // is_active nicht im Modal, wird in DB/Backend gesetzt
              // updated_at wird im Handler als hidden field überschrieben
            }

            // ISSUER-Default nur setzen, wenn Feld existiert und leer ist
            if ('ISSUER' in rowDataForForm && !rowDataForForm['ISSUER']) {
              rowDataForForm['ISSUER'] = uniqueIssuers.length > 0 ? uniqueIssuers[0] : '';
            }

            generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
            return;
          }

          // EDIT:
          if (actionType === 'edit' && data && data.length > rowIndex) {
            const rawRowData = data[rowIndex];
            let rowDataForForm = rawRowData;

            if (selectedTableName === 'ProdAll') {
              // Für ProdAll: Feldreihenfolge über Helper
              rowDataForForm = buildOrderedFieldsForModal(rawRowData);
            }

            generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
          }
        }
        function removeCouponButton() {
          const couponButton = document.getElementById('coupon-button');
          if (couponButton) {
              couponButton.remove();
              // console.log("Coupon button removed.");
          }
        }



// **Attach event to close button to remove coupon button**
document.addEventListener("DOMContentLoaded", () => {
  const closeButton = document.querySelector(".close"); 
  if (closeButton) {
      closeButton.addEventListener("click", removeCouponButton);
  }
});


// ADD:

    function setupAddOperation(data, selectedTableName) {
      const modal = document.getElementById('modal');
      const modalTitle = modal.querySelector('h2');
      const form = document.getElementById('editForm');

      // WICHTIG: Felder wurden bereits in setupFormFields erzeugt.
      // Hier NICHT nochmal form.innerHTML leeren oder generateInputFields aufrufen.

      modalTitle.textContent = 'Add New Row';

      // Save-Button neu verdrahten
      const saveButton = document.getElementById('saveButton');
      const saveButtonClone = saveButton.cloneNode(true);
      saveButton.parentNode.replaceChild(saveButtonClone, saveButton);

      saveButtonClone.addEventListener('click', () =>
        addSaveButtonHandler(form, modal, selectedTableName)
      );
    }
        export const addSaveButtonHandler = async (form, modal, selectedTableName, onReload) => {
          if (isAddingRow) return;
          isAddingRow = true;

          try {
            // 0) aktuelle Auswahl merken (Dropdown/State)
            const dd = document.getElementById('createdDealsDropdown');
            const prev = (window.appState?.getSelectedDealsTableName?.() || dd?.value || '').trim();

            const newRowData = gatherModalData(form);
            delete newRowData.ID;

            await addNewRow(newRowData, selectedTableName);

            // 1) Modal schließen
            closeModal();

            // 2) DealsMain frisch holen
            window.api.once('DealsMainData', (rows) => {
              // deine bestehende Update-Funktion
              window.appState?.updateDealsDataTable?.(rows, { isFull: true });

              // 3) Auswahl wiederherstellen (Dropdown + State)
              if (prev) {
                const d = document.getElementById('createdDealsDropdown');
                if (d) {
                  const opt = Array.from(d.options).find(o => o.value === prev);
                  if (opt) d.value = prev;
                }
                window.appState?.setSelectedDealsTableName?.(prev);
              }
            });
            window.api.send('fetch-table-data', 'DealsMain');

            // (optional) zusätzlicher Hook des Callers
            if (typeof onReload === 'function') await onReload(selectedTableName);

            console.log(`✅ New row added to ${selectedTableName}.`);
          } catch (error) {
            displayErrorMessage(`Failed to add new row: ${error.message}`);
          } finally {
            isAddingRow = false;
          }
        };
            function gatherModalData(form) {
          if (!form) {
            console.error('Form not found in gatherFormData.');
            return {};
          }

          const newRowData = {};
          const inputFields = form.querySelectorAll('input, select');

          // Merker, welche Felder im Form tatsächlich existieren
          const presentFields = new Set();

          // 1) Alle regulären Inputs einsammeln (nur die mit data-field)
          inputFields.forEach((input) => {
            const fieldName = input.getAttribute('data-field');
            if (!fieldName) return;

            presentFields.add(fieldName);

            let rawVal;
            if (input.type === 'checkbox') {
              rawVal = input.checked ? '1' : '0';
            } else {
              rawVal = (input.value ?? '').toString().trim();
            }

            const value = formatInputFieldValue(fieldName, rawVal);
            if (value != null && String(value).toLowerCase() !== 'null') {
              newRowData[fieldName] = value;
            } else {
              // nur setzen, wenn das Feld wirklich existiert – optional: nicht setzen = NULL/DEFAULT
              newRowData[fieldName] = '';
            }
          });

          // 2) START_DATE / MATURITY nur überschreiben, wenn diese Felder im Form existieren
          const hasStart   = presentFields.has('START_DATE');
          const hasMat     = presentFields.has('MATURITY');

          const startToken = (hasStart ? (form.querySelector('#start_dateToken')?.value || '') : '').trim();
          const matToken   = (hasMat   ? (form.querySelector('#maturityToken')?.value   || '') : '').trim();

          const startISO = (hasStart ? (form.querySelector('#start_dateDate')?.value || '') : '').trim();
          const matISO   = (hasMat   ? (form.querySelector('#maturityDate')?.value   || '') : '').trim();

          if (hasStart) {
            if (startToken) {
              newRowData.START_DATE = startToken; // z. B. "today"
            } else if (startISO) {
              newRowData.START_DATE = startISO;   // YYYY-MM-DD
            }
            // kein else -> nicht künstlich '' setzen
          }

          if (hasMat) {
            if (matToken) {
              newRowData.MATURITY = matToken;     // z. B. "11y"
            } else if (matISO) {
              newRowData.MATURITY = matISO;       // YYYY-MM-DD
            }
          }

          return newRowData;
        }
            export function addNewRow(newRowData, cleanTableName, { timeoutMs = 15000 } = {}) {
          const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
          const successCh = `add-new-row-success:${requestId}`;
          const errorCh   = `add-new-row-error:${requestId}`;

          return new Promise((resolve, reject) => {
            let timer;

            const cleanup = () => {
              if (timer) clearTimeout(timer);
              if (window.api?.removeAllListeners) {
                window.api.removeAllListeners(successCh);
                window.api.removeAllListeners(errorCh);
              }
            };

            const onSuccess = () => {
              console.log('✅ Neue Zeile erfolgreich hinzugefügt.');
              cleanup();
              resolve();
            };

            const onError = (error) => {
              const msg = error?.message || String(error || 'Unknown error');
              console.error('❌ Fehler beim Hinzufügen:', msg);
              cleanup();
              reject(new Error(msg));
            };

            // 1) Listener registrieren
            window.api.once(successCh, onSuccess);
            window.api.once(errorCh, onError);

            // 2) Senden – mit requestId
            window.api.send('add-new-row', { newRowData, cleanTableName, requestId });

            // 3) Optionaler Timeout
            if (timeoutMs > 0) {
              timer = setTimeout(() => {
                cleanup();
                reject(new Error(`addNewRow timeout (${requestId})`));
              }, timeoutMs);
            }
          });
        }

// EDIT:

    function setupEditOperation(data, rowIndex, selectedTableName) {
      console.log('selectedTableName', selectedTableName);

      // WICHTIG:
      // Die Input-Felder wurden bereits in setupFormFields generiert
      // (inkl. buildOrderedFieldsForModal für ProdAll).
      // Hier NICHT nochmal form.innerHTML leeren oder generateInputFields aufrufen.

      // Save-Button
      const saveButton = document.getElementById('saveButton');
      const newSaveButton = saveButton.cloneNode(true);
      saveButton.parentNode.replaceChild(newSaveButton, saveButton);
      newSaveButton.addEventListener(
        'click',
        editSaveButtonHandler(selectedTableName, rowIndex, data)
      );

      // Erase-Button
      const eraseButton = document.getElementById('eraseButton');
      const newEraseButton = eraseButton.cloneNode(true);
      newEraseButton.addEventListener(
        'click',
        eraseButtonHandler(selectedTableName, rowIndex, data)
      );
      eraseButton.parentNode.replaceChild(newEraseButton, eraseButton);
    }
        const editSaveButtonHandler = (selectedTableName, rowIndex, data) => async () => {
          console.log("selectedTableName", selectedTableName);
          if (!selectedTableName) {
            console.error("selectedTableName is undefined.");
            displayErrorMessage("Error: No table selected.");
            return;
          }

          const form = document.getElementById('editForm');
          const formData = form ? gatherModalData(form) : {};
          // 👉 Fallback: merge mit übergebenem data (z.B. aus Preview)
          let newData = { ...(data || {}), ...(formData || {}) };

// Customer TABELLE: inline aus der Preview speichern
if (String(selectedTableName).trim() === 'Customer') {
  // Falls kein PK vorhanden, aus appState holen
  if (newData.id == null) {
    try {
      const arr = window.appState?.getCustomerData?.();
      const customer = Array.isArray(arr) ? arr[0] : arr;
      if (customer?.id != null) newData.id = customer.id;
    } catch {}
  }

  // Falls kein Header im Payload, Preview-Input lesen
  if (newData.pdf_header == null) {
    const inputH = document.getElementById('or-headerText');
    if (inputH) newData.pdf_header = (inputH.value || '').trim();
  }

  // >>> NEU: Footer nur nachziehen, wenn der Aufrufer "pdf_footer" wirklich speichern will
  // (also wenn im data-Payload der Key vorhanden ist). So fasst der Header-Save den Footer NICHT an.
  if ((data && Object.prototype.hasOwnProperty.call(data, 'pdf_footer')) && newData.pdf_footer == null) {
    const inputF = document.getElementById('or-footerText');
    if (inputF) newData.pdf_footer = (inputF.value || '').trim();
  }
}

// console.log('newData:', newData);


          try {
            const cleanTableName = getCleanTableName(selectedTableName);
            const uniqueIdentifier = getUniqueIdentifier(newData, selectedTableName);
            await saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier);
            closeModal();
          } catch (error) {
            displayErrorMessage(`Failed to save changes: ${error.message}`);
          }
        };


//-----------------------------------SAVE, ERASE -----------------------------------------------------//    

// SAVE
export function saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier) {
  //console.log('saveChanges tableName:', newData, cleanTableName, rowIndex, uniqueIdentifier);
  window.api.send('update-data', { newData, cleanTableName, rowIndex, uniqueIdentifier });
}

// ERASE:
let isErasing = false;

export const eraseButtonHandler = (selectedTableName, rowIndex, data) => async () => {
  console.log('Erase attempt for:', data);
  if (isErasing) return;
  isErasing = true;

  try {
    const cleanTableName = getCleanTableName(selectedTableName);
    let uniqueIdentifier = getUniqueIdentifier(data, selectedTableName);
    console.log('selectedTableName, uniqueIdentifier:', selectedTableName, uniqueIdentifier);

    // ✅ Erase from the primary table
    await eraseRow(cleanTableName, uniqueIdentifier);

    // ✅ Erase from ProdCouponSchedules
    await eraseProdIDFromProdCouponSchedules(uniqueIdentifier);

    // ✅ Erase from Portfolios
    await eraseProdIDFromDeals(uniqueIdentifier);

    // Close modal after all deletions
    closeModal();
  } catch (error) {
    console.error('❌ Error in eraseButtonHandler:', error);
    displayErrorMessage(`Failed to erase row: ${error.message}`);
  } finally {
    isErasing = false;
  }
};

    function getCleanTableName(tableName) {
      // Additional check to ensure tableName is not undefined
      if (typeof tableName === 'string') {
        return tableName.endsWith('Data') ? tableName.slice(0, -4) : tableName;
      } else {
        console.error("tableName is not a string.");
        return ''; // Return an empty string or handle this case as needed
      }
    }

    function getUniqueIdentifier(newData, selectedTableName) {
      console.log('newData, selectedTableName:', newData, selectedTableName);
      // Determine the column name based on the selected table name
      let uniqueIdentifierColumn;
      
      // Check if selectedTableName starts with "Deals"
    const name = String(selectedTableName || '');
    const upper = name.toUpperCase();

    if (upper.startsWith('DEALS') || upper.startsWith('OFFERS_') || upper.startsWith('OFFER_')) {
      uniqueIdentifierColumn = 'TRADE_ID';
    } else {
          switch (selectedTableName) {
              case 'Issuer':
                  uniqueIdentifierColumn = 'TICKER';
                  break;
              case 'ProdAll':
                  uniqueIdentifierColumn = 'PROD_ID';
                  break;
              case 'CSParameter':
                uniqueIdentifierColumn = 'CSSzenario';
                break;    
              case 'ecb':
                uniqueIdentifierColumn = 'ID';
                break;    
              case 'fed':
                uniqueIdentifierColumn = 'ID';
                break;   
              case 'yahoo':
                uniqueIdentifierColumn = 'ID';
                break;  
              case 'ProdCouponSchedules': 
                uniqueIdentifierColumn = 'ID'; 
                break; 
              case 'EUSW': 
                uniqueIdentifierColumn = 'YEAR'; 
                break; 
              case 'MVaRInput': 
                uniqueIdentifierColumn = 'id';  
                break;  
              case 'Customer': 
                uniqueIdentifierColumn = 'id';   
                break; 
              case 'PortfolioHistoryMetrics': 
                uniqueIdentifierColumn = 'DATE';   
                break;   
              case 'CreditVaRInputThreshold': 
                uniqueIdentifierColumn = 'id';   
                break; 
              case 'CreditVaRInput': 
                uniqueIdentifierColumn = 'id';   
                break;    
              // Add more cases as needed for different tables
              default:
                  console.error('Unknown table:', selectedTableName);
                  return null; // Or handle this situation as appropriate
          }
      }

      // Assuming uniqueIdentifierColumn is correctly determined
      if (uniqueIdentifierColumn && newData.hasOwnProperty(uniqueIdentifierColumn)) {
          return {
              column: uniqueIdentifierColumn,
              value: newData[uniqueIdentifierColumn]
          };
      } else {
          console.error('Unable to determine the unique identifier for:', selectedTableName);
          return null;
      }
    }


    // Function to handle erasing related rows from ProdCouponSchedules
    const eraseProdIDFromProdCouponSchedules = async (uniqueIdentifier) => {
      try {
        // console.log('Checking existence in ProdCouponSchedules for:', uniqueIdentifier);

        // Ensure uniqueIdentifier is a string
        let uniqueValue = (typeof uniqueIdentifier === 'object' && uniqueIdentifier !== null)
          ? uniqueIdentifier.value
          : String(uniqueIdentifier).trim();

        // Get all coupon data
        const couponData = appState.getCouponData();
        // console.log('Available rows in ProdCouponSchedules:', couponData);

        // Find matching rows
        const matchingRows = couponData.filter(row => {
          // console.log('Checking row:', row);
          return row.PROD_ID && String(row.PROD_ID).trim() === uniqueValue;
        });

        // If matches are found, erase them
        if (matchingRows.length > 0) {
          // console.log(`Found ${matchingRows.length} matching rows in ProdCouponSchedules. Deleting...`);
          
          for (const row of matchingRows) {
            if (!row.ID) {
              console.error('❌ ERROR: Row missing ID:', row);
              continue;
            }

            const numericID = Number(String(row.ID).replace(/,/g, ''));
            // console.log(`Deleting row from ProdCouponSchedules where ID = ${numericID}`);

            await eraseRow('ProdCouponSchedules', { column: 'ID', value: numericID });
          }
        } else {
          console.log('❌ No matching rows found in ProdCouponSchedules.');
        }
      } catch (error) {
        console.error('❌ Error while erasing from ProdCouponSchedules:', error);
        displayErrorMessage(`Failed to erase from ProdCouponSchedules: ${error.message}`);
      }
    };

    // Function to handle erasing PROD_ID entries from Portfolios: GEHT NOCH NICHT!!!!!
    const eraseProdIDFromDeals = async (uniqueIdentifier) => {
      try {
        console.log('Checking existence in Deals for:', uniqueIdentifier);

        // Ensure uniqueIdentifier is a string
        let uniqueValue = (typeof uniqueIdentifier === 'object' && uniqueIdentifier !== null)
          ? uniqueIdentifier.value
          : String(uniqueIdentifier).trim();





        // Get all created portfolio data
        const dealsData = appState.getDealsData();  
        // console.log('Available rows in Deals:', dealsData);




        // Find matching rows by PROD_ID
        const matchingRows = dealsData.filter(row => {
          // console.log('Checking row in Portfolios:', row);
          return row.PROD_ID && String(row.PROD_ID).trim() === uniqueValue;
        });

        // If matches are found, erase them
        if (matchingRows.length > 0) {
          // console.log(`Found ${matchingRows.length} matching rows in Portfolios. Deleting...`);

          for (const row of matchingRows) {
            if (!row.ID) {
              console.error('❌ ERROR: Portfolio row missing ID:', row);
              continue;
            }

            const numericID = Number(String(row.ID).replace(/,/g, ''));
            console.log(`Deleting row from Portfolios where ID = ${numericID}`);

            await eraseRow('DealsMain', { column: 'ID', value: numericID });
          }
        } else {
          console.log('❌ No matching rows found in Portfolios.');
        }
      } catch (error) {
        console.error('❌ Error while erasing from Portfolios:', error);
        displayErrorMessage(`Failed to erase from Portfolios: ${error.message}`);
      }
    };






export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) {
    modal.style.display = 'none';
  }
}



document.querySelectorAll('.deleteButton').forEach(button => {
  button.addEventListener('click', async (event) => {
    //const rowIndex = getRowIndex(event.target); // Implement getRowIndex according to your UI structure
    const uniqueIdentifier = getUniqueIdentifier(newData, selectedTableName); // Implement this according to your data structure
    const cleanTableName = getCleanTableName(selectedTableName);

    try {
      await eraseRow(cleanTableName, uniqueIdentifier);
      console.log(`Row erased from ${cleanTableName} successfully.`);
      refreshUI(); // Implement a function to refresh your UI to reflect the changes
    } catch (error) {
      displayErrorMessage(`Failed to erase row: ${error.message}`);
    }
  });
});

    function eraseRow(cleanTableName, uniqueIdentifier) {
      console.log('eraseRowFct:', uniqueIdentifier);
      // Send the erase request to the main process
      window.api.send('erase-data', { cleanTableName, uniqueIdentifier });
    }

    function displayErrorMessage(message) {
      // This example assumes you have a div or some element with the ID 'errorMessage' in your HTML
      const errorMessageDiv = document.getElementById('errorMessage');
      if(errorMessageDiv) {
        errorMessageDiv.textContent = message;
        errorMessageDiv.style.display = 'block'; // Make sure it's visible
      } else {
        console.error("Error message container not found");
      }
    }

window.api.receive('erase-data-success', ({ cleanTableName, uniqueIdentifier }) => {
  console.log('[erase-data-success] for table:', cleanTableName, 'id:', uniqueIdentifier);

  // 1) Kontext bestimmen: Offer vs. Deal
  const isOfferTable = /^OFFERS?/i.test(cleanTableName); 
  // matcht: OFFER_..., OFFERS_..., offers_xyz etc.

  // IDs der Dropdowns
  const dropdownId = isOfferTable
    ? 'createdOffersDropdown'
    : 'createdDealsDropdown';

  // State-Getter/Setter je nach Kontext
  const getSelectedTableName = isOfferTable
    ? appState.getSelectedOffersTableName?.bind(appState)
    : appState.getSelectedDealsTableName?.bind(appState);

  const setSelectedTableName = isOfferTable
    ? appState.setSelectedOffersTableName?.bind(appState)
    : appState.setSelectedDealsTableName?.bind(appState);

  // 2) aktuelle Auswahl merken
  const dd = document.getElementById(dropdownId);
  const prevSel = (getSelectedTableName?.() || dd?.value || '').trim();
  console.log('[erase-data-success] prevSel =', prevSel, 'isOfferTable =', isOfferTable);

  // 3) DealsMain neu laden
  window.api.once('DealsMainData', (rows) => {
    console.log('[DealsMainData] received after erase, rows:', Array.isArray(rows) ? rows.length : typeof rows);

    // vollständigen Dump in State
    appState.updateDealsDataTable?.(rows, { isFull: true });

    if (prevSel) {
      // Dropdown-Option wieder setzen
      if (typeof restoreDropdownSelection === 'function') {
        restoreDropdownSelection(dropdownId, prevSel);
      }

      // State aktualisieren
      setSelectedTableName?.(prevSel);

      // gefilterte Sicht rendern (wie bisher)
      const filtered = Array.isArray(rows)
        ? rows.filter(r => String(r.port_name || r.PORT_NAME || '') === prevSel)
        : rows;

      handleDealsData?.(filtered, 'DealsMain');
    } else {
      // keine vorherige Auswahl -> alles zeigen
      handleDealsData?.(rows, 'DealsMain');
    }
  });

  window.api.send('fetch-table-data', 'DealsMain');
});


function restoreDropdownSelection(id, value) {
  const dd = document.getElementById(id);
  if (!dd || !value) return;
  dd.value = value;
  // optional Change-Event feuern, falls deine Logik darauf hört
  dd.dispatchEvent(new Event('change', { bubbles: true }));
}

















