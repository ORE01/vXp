import { generateInputFields} from './inputFieldsGenerator.js';
import { generateCouponInputFields } from './couponInputFieldsGenerator.js';
import { formatInputFieldValue } from '../utils/format.js';
import { issuerData } from '../FRONT_END/NEW_PRODUCTS/ISSUER.js';
import { appState } from '../FRONT_END/renderer.js';
import { handleDealsData } from '../FRONT_END/CREATE_PORTFOLIO/DEALS.js';

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



export function handleFormAction(event, data, rowIndex, selectedTableName, actionType) {
  console.log('selectedTableName:', selectedTableName);

  displayModal(actionType, rowIndex);
  setupFormFields(actionType, data, rowIndex, selectedTableName);

  //EDIT:
  if (actionType === 'add') {
        //console.log('data, rowIndex, selectedTableName', data, selectedTableName)
    setupAddOperation(data, selectedTableName);

  //ADD:
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

          //makeModalDraggable(modalContent);
        }
        function setupFormFields(actionType, data, rowIndex, selectedTableName) {
          // console.log('actionType_if:', actionType, data, rowIndex, selectedTableName);
          const form = modal.querySelector(actionType === 'add' ? 'form' : '#editForm');
          form.innerHTML = ''; // Clear the form fields

          
          if (actionType === 'add') {
            // Handle the add operation
            // console.log('actionType_if:', actionType);
            const emptyRowData = Object.keys(data[0]).reduce((acc, fieldName) => {
                acc[fieldName] = '';
                return acc;
            }, {});
            // console.log('emptyRowData:', emptyRowData);
            const uniqueIssuers = [...new Set(issuerData.map((item) => item.ISSUER))];
            emptyRowData['ISSUER'] = uniqueIssuers.length > 0 ? uniqueIssuers[0] : '';
          
            generateInputFields(emptyRowData, form, uniqueIssuers, selectedTableName);
          }
          
          if (actionType === 'edit' && data && data.length > rowIndex) {

            const rowData = data[rowIndex];
            const uniqueIssuers = [...new Set(issuerData.map((item) => item.ISSUER))];
            // console.log("selectedTableName, rowData", selectedTableName,rowData);

            generateInputFields(rowData, form, uniqueIssuers, selectedTableName);
          }
        }
        function makeModalDraggable(modalContent) {
          const dragElement = modalContent; // ✅ Now only modal-content is draggable
          let isDragging = false, offsetX = 0, offsetY = 0;

          dragElement.onmousedown = (e) => {
            isDragging = true;
            modalContent.style.transition = 'none'; // Prevent smooth transitions while dragging
            modalContent.style.position = 'fixed'; // ✅ Ensure modal-content stays fixed on screen

            const rect = modalContent.getBoundingClientRect();

            // Remove centering transform to avoid jumps
            if (modalContent.style.transform.includes('translate')) {
              modalContent.style.left = `${rect.left}px`;
              modalContent.style.top = `${rect.top}px`;
              modalContent.style.transform = 'none'; // ✅ Fix jumping issue
            }

            offsetX = e.clientX - rect.left;
            offsetY = e.clientY - rect.top;

            const onMouseMove = (moveEvent) => {
              if (isDragging) {
                modalContent.style.left = `${moveEvent.clientX - offsetX}px`;
                modalContent.style.top = `${moveEvent.clientY - offsetY}px`;
              }
            };

            const onMouseUp = () => {
              isDragging = false;
              document.removeEventListener('mousemove', onMouseMove);
              document.removeEventListener('mouseup', onMouseUp);
            };

            document.addEventListener('mousemove', onMouseMove);
            document.addEventListener('mouseup', onMouseUp);
          };
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
      //console.log('data, selectedTableName', data, selectedTableName);
      const modal = document.getElementById('modal');
      const modalTitle = modal.querySelector('h2');
      const form = document.getElementById('editForm'); // Ensure this ID matches your Add Form

      // Reset the form and modal for a new addition
      form.innerHTML = '';
      modalTitle.textContent = 'Add New Row';

      // Preparing a template based on the structure of `data`
      const emptyRowData = data.length > 0 
        ? Object.keys(data[0]).reduce((acc, fieldName) => {
            acc[fieldName] = data[0][fieldName] ?? ''; // Retain original data structure and values
            return acc;
          }, {}) 
        : {};

      // Additional setup for specific tables
      const uniqueIssuers = [...new Set(data.map(item => item.ISSUER))];
      emptyRowData['ISSUER'] = uniqueIssuers.length > 0 ? uniqueIssuers[0] : '';

      // Generate input fields based on the data template
      generateInputFields(emptyRowData, form, uniqueIssuers, selectedTableName);

      // Cloning the saveButton without redefining it
      const saveButton = document.getElementById('saveButton');
      const saveButtonClone = saveButton.cloneNode(true);
      saveButton.parentNode.replaceChild(saveButtonClone, saveButton);

      //console.log('Attaching event listener to saveButton');

      saveButtonClone.addEventListener('click', () => addSaveButtonHandler(form, modal, selectedTableName));

    }
        // export const addSaveButtonHandler = async (form, modal, selectedTableName, onReload) => {
        //   if (isAddingRow) return;
        //   isAddingRow = true;

        //   try {
        //     const newRowData = gatherFormData(form);
        //     delete newRowData.ID; // Autoincrement

        //     // wartet sauber auf Erfolg/Fehler (deine reqId-Version von addNewRow!)
        //     await addNewRow(newRowData, selectedTableName);

        //     // Modal zu, danach gezielt reloaden
        //     closeModal();
        //     if (typeof onReload === 'function') {
        //       await onReload(selectedTableName);
        //     }
        //     console.log(`✅ New row added to ${selectedTableName}.`);
        //   } catch (error) {
        //     displayErrorMessage(`Failed to add new row: ${error.message}`);
        //   } finally {
        //     isAddingRow = false;
        //   }
        // };
        export const addSaveButtonHandler = async (form, modal, selectedTableName, onReload) => {
  if (isAddingRow) return;
  isAddingRow = true;

  try {
    // 0) aktuelle Auswahl merken (Dropdown/State)
    const dd = document.getElementById('createdDealsDropdown');
    const prev = (window.appState?.getSelectedDealsTableName?.() || dd?.value || '').trim();

    const newRowData = gatherFormData(form);
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

            function gatherFormData(form) {
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
      if (data && data.length > rowIndex) {
        const rowData = data[rowIndex];
        const uniqueIssuers = [...new Set(issuerData.map((item) => item.ISSUER))];
        // Correctly select the form element
        const form = document.getElementById('editForm');
        form.innerHTML = '';
        generateInputFields(rowData, form, uniqueIssuers, selectedTableName);
      }
      // Configuring Save Button
      const saveButton = document.getElementById('saveButton');
      // Remove existing event listeners by cloning the button
      const newSaveButton = saveButton.cloneNode(true);
      saveButton.parentNode.replaceChild(newSaveButton, saveButton);

      // Add event listener to the new save button
      
      newSaveButton.addEventListener('click', editSaveButtonHandler(selectedTableName, rowIndex, data));

        // Configuring Erase Button
        const eraseButton = document.getElementById('eraseButton');
        const newEraseButton = eraseButton.cloneNode(true); // Clone to remove existing listeners
        newEraseButton.addEventListener('click', eraseButtonHandler(selectedTableName, rowIndex, data));
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
          const formData = form ? gatherFormData(form) : {};
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

console.log('newData:', newData);


          try {
            const cleanTableName = getCleanTableName(selectedTableName);
            const uniqueIdentifier = getUniqueIdentifier(newData, selectedTableName);
            await saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier);
            closeModal();
          } catch (error) {
            displayErrorMessage(`Failed to save changes: ${error.message}`);
          }
        };


// COUPON FORM:
export function handleCouponFormAction(event, data, rowIndex, actionType) {
  console.log('handleCouponFormAction',  data)
  displayModal(actionType, rowIndex);
  setupCouponEditOperation(data);
}
    function setupCouponEditOperation(rowData) {
      if (!rowData) {
        console.error('setupCouponEditOperation: rowData is undefined or null.');
        return;
      }

      // console.log('setupCouponEditOperation data', rowData);
      const modal = document.getElementById('modal');
      const form = document.getElementById('editForm');
      const modalTitle = modal.querySelector('h2');

      // Reset form and modal title
      form.innerHTML = '';
      modalTitle.textContent = `Edit Coupon Data`;

      // TERMSTRUCTURE of COUPONS:
      generateCouponInputFields(rowData, form);

      // Configure save button
      const saveButton = document.getElementById('saveButton');
      const newSaveButton = saveButton.cloneNode(true);
      saveButton.parentNode.replaceChild(newSaveButton, saveButton);

      newSaveButton.addEventListener('click', () => {
        editSaveButtonHandler('ProdCouponSchedules', rowData)();
      });

    }


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
              case 'EUSW': 
                uniqueIdentifierColumn = 'YEAR'; 
              case 'MVaRInput_2': 
                uniqueIdentifierColumn = 'id';   
              case 'Customer': 
                uniqueIdentifierColumn = 'id';   
              case 'PortfolioHistoryMetrics': 
                uniqueIdentifierColumn = 'DATE';   
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
        console.log('Available rows in Deals:', dealsData);




        // Find matching rows by PROD_ID
        const matchingRows = dealsData.filter(row => {
          console.log('Checking row in Portfolios:', row);
          return row.PROD_ID && String(row.PROD_ID).trim() === uniqueValue;
        });

        // If matches are found, erase them
        if (matchingRows.length > 0) {
          console.log(`Found ${matchingRows.length} matching rows in Portfolios. Deleting...`);

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





window.api.receive('erase-data-success', ({ cleanTableName }) => {
  // aktuelle Auswahl merken
  const ddDeals = document.getElementById('createdDealsDropdown');
  const prevSel = (appState.getSelectedDealsTableName?.() || ddDeals?.value || '').trim();

  // Deals neu laden (ungefiltert), danach UI + Dropdown wiederherstellen
  window.api.once('DealsMainData', (rows) => {
    // vollständigen Dump in State, dann gefiltert rendern
    appState.updateDealsDataTable?.(rows, { isFull: true });

    if (prevSel) {
      // Dropdown-Option wieder setzen
      if (typeof restoreDropdownSelection === 'function') {
  restoreDropdownSelection('createdOffersDropdown', prevSel);
}

      appState.setSelectedDealsTableName?.(prevSel);

      // gefilterte Sicht rendern (nur wenn deine handleDealsData das so erwartet)
      const filtered = Array.isArray(rows)
        ? rows.filter(r => String(r.port_name || r.PORT_NAME || '') === prevSel)
        : rows;

      handleDealsData?.(filtered, 'DealsMain');
    } else {
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
















