import { generateInputFields, formatInputFieldValue } from './inputFieldsGenerator.js';
import { issuerData } from '../r_tab/ISSUER.js';

let isSaving = false;
//let tableName;

export function handleFormAction(event, data, rowIndex, selectedTableName, actionType) {
  //console.log('FBH actionType:', actionType);
  console.log('FBH handleFormAction tableName:', selectedTableName);
  const modal = document.getElementById('modal');
  const modalTitle = modal.querySelector('h2');
  const form = modal.querySelector(actionType === 'add' ? 'form' : '#editForm');
  const saveButton = modal.querySelector('#saveButton');
  const eraseButton = modal.querySelector('#eraseButton');

  // Set the modal title
  modalTitle.textContent = actionType === 'add' ? 'Add New Row' : `Edit Row ${rowIndex + 1}`;

  // Clear the form fields
  form.innerHTML = '';


  if (data && data.length > rowIndex && actionType === 'edit') {
    const rowData = data[rowIndex];

    const uniqueIssuers = [...new Set(issuerData.map((item) => item.ISSUER))];
    generateInputFields(rowData, form, uniqueIssuers, selectedTableName);
  }

  // Show the modal
  modal.style.display = 'block';

  // Close the modal when the close button is clicked
  const closeButton = modal.querySelector('.close');
  closeButton.addEventListener('click', () => {
    // Hide the modal without saving changes
    modal.style.display = 'none';
  });

  if (actionType === 'add') {
    // Handle the add operation
    console.log('actionType_if:', actionType);
    const emptyRowData = Object.keys(data[0]).reduce((acc, fieldName) => {
        acc[fieldName] = '';
        return acc;
    }, {});

    const uniqueIssuers = [...new Set(issuerData.map((item) => item.ISSUER))];
    emptyRowData['ISSUER'] = uniqueIssuers.length > 0 ? uniqueIssuers[0] : '';

    generateInputFields(emptyRowData, form, uniqueIssuers, selectedTableName);

    const addSaveButtonHandler = async () => {
      saveButton.removeEventListener('click', addSaveButtonHandler);
          if (isSaving) {
            return;
          }
          isSaving = true;

        const newRowData = {};
        const inputFields = form.querySelectorAll('input, select');
        inputFields.forEach((input) => {
            const fieldName = input.getAttribute('data-field');
            const value = formatInputFieldValue(fieldName, input.value);
            newRowData[fieldName] = value;
            saveButton.removeEventListener('click', addSaveButtonHandler);
        });
        //saveButton.removeEventListener('click', addSaveButtonHandler);
        
        const cleanTableName = selectedTableName.endsWith('Data') ? selectedTableName.slice(0, -4) : selectedTableName;
        
        addNewRow(newRowData, cleanTableName)
        .then(() => {
            saveButton.removeEventListener('click', addSaveButtonHandler);
            console.log('FBH addNewRow cleanTableName:', cleanTableName);
            modal.style.display = 'none';
            })
            .catch((error) => {
            console.error(error.message);
            const errorMessageDiv = document.getElementById('errorMessage');
            errorMessageDiv.textContent = error.message;
            //saveButton.removeEventListener('click', addSaveButtonHandler);
            })
            .finally(() => {
            isSaving = false;
            //saveButton.addEventListener('click', addSaveButtonHandler);
            //saveButton.removeEventListener('click', addSaveButtonHandler);
        });
        //saveButton.removeEventListener('click', addSaveButtonHandler);
        // saveButton.addEventListener('click', addSaveButtonHandler);
    };

// saveButton.removeEventListener('click', addSaveButtonHandler);
 saveButton.addEventListener('click', addSaveButtonHandler); 



  } else if (actionType === 'edit') {
    console.log('actionType_if:', actionType);
        //SAVE BUTTON HANDLER

        const saveButtonHandler = async () => {
            // if (isSaving) {
            //     return;
            // }
            isSaving = true;
            try {
                const newRowData = {};
                const inputFields = form.querySelectorAll('input, select');
                inputFields.forEach((input) => {
                    const fieldName = input.getAttribute('data-field');
                    const value = formatInputFieldValue(fieldName, input.value);
                    newRowData[fieldName] = value;
                    saveButton.removeEventListener('click', saveButtonHandler);
                });
                saveButton.removeEventListener('click', saveButtonHandler);
                // Define uniqueIdentifier here for both add and update
                const newData = newRowData;
                console.log('newData:', newData);
                let uniqueIdentifierColumn = selectedTableName.startsWith('Deals') ? 'TRADE_ID' : selectedTableName === 'Issuer' ? 'TICKER' : selectedTableName === 'EUSW' ? 'YEAR' : 'PROD_ID';

                const uniqueIdentifierValue = newData[uniqueIdentifierColumn];
                const uniqueIdentifier = { column: uniqueIdentifierColumn, value: uniqueIdentifierValue };
                console.log('uniqueIdentifierColumnEdit:', uniqueIdentifierColumn);

                const cleanTableName = selectedTableName.endsWith('Data') ? selectedTableName.slice(0, -4) :selectedTableName;

                await saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier);
                console.log('tableName_afterSC:', cleanTableName);
                modal.style.display = 'none'; // Hide the modal after saving
                // Remove the event listener to prevent accumulation
                saveButton.removeEventListener('click', saveButtonHandler);
            } catch (error) {
                console.error(error.message);
                const errorMessageDiv = document.getElementById('errorMessage');
                errorMessageDiv.textContent = error.message;
            } finally {
                isSaving = false;
                saveButton.removeEventListener('click', saveButtonHandler);
            }
            saveButton.removeEventListener('click', saveButtonHandler);
        };

        saveButton.addEventListener('click', saveButtonHandler);// hier auch weg
        

        //ERASE BUTTON HANDLER

        let isErasing = false;


        const eraseButtonHandler = async () => {
        if (isErasing) {
          // If already erasing, return to prevent multiple erases
          return;
        }
        isErasing = true;
    
        try {
          const newData = {};
          const inputFields = form.querySelectorAll('input');
          inputFields.forEach((input) => {
            const fieldName = input.getAttribute('data-field');
            const value = input.value;
            newData[fieldName] = value;
            eraseButton.removeEventListener('click', eraseButtonHandler); 
          });
    
          let uniqueIdentifierColumn = selectedTableName.startsWith('Deals') ? 'TRADE_ID' : selectedTableName === 'Issuer' ? 'TICKER' : 'PROD_ID';
          const uniqueIdentifierValue = newData[uniqueIdentifierColumn];
          const uniqueIdentifier = { column: uniqueIdentifierColumn, value: uniqueIdentifierValue };
          console.log('uniqueIdentifier.column:', uniqueIdentifier.column);
          console.log('uniqueIdentifier.value:', uniqueIdentifier.value);
          const cleanTableName = selectedTableName.endsWith('Data') ? selectedTableName.slice(0, -4) : selectedTableName;

          await eraseRow(cleanTableName, uniqueIdentifier);
            console.log('erasedRow:', uniqueIdentifier.value);
            console.log('FBH eraseRow cleanTableName:', cleanTableName);
            modal.style.display = 'none'; // Hide the modal after erasing
            eraseButton.removeEventListener('click', eraseButtonHandler); // Remove the event listener
        } catch (error) {
            console.error(error.message);
            const errorMessageDiv = document.getElementById('errorMessage');
            errorMessageDiv.textContent = error.message;
            eraseButton.removeEventListener('click', eraseButtonHandler); // Remove the event listener
        } finally {
            isErasing = false;
            eraseButton.removeEventListener('click', eraseButtonHandler); // Remove the event listener
          }
      };
      eraseButton.addEventListener('click', eraseButtonHandler);
  }
  
}


function addNewRow(newRowData, cleanTableName) {
  return new Promise((resolve, reject) => {
    console.log('FBH in addNewRow newRowData:', newRowData);
    console.log('FBH in addNewRow cleanTableName:', cleanTableName);
    
    // Send the new row data and table name to the main.js process
    window.api.send('add-new-row', { newRowData, cleanTableName });
    newRowData = {}; 
    // Listen for the response from the main process
    window.api.receive('add-new-row-success', () => {
      newRowData = {}; 
      resolve(); // Resolve the promise after successful addition
    });
    // Handle any errors from the main process
    window.api.receive('add-new-row-error', (error) => {
      reject(new Error(error.message)); // Reject the promise with the error
    });
  });
}

function saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier) {
  console.log('FBH saveChanges tableName:', newData, cleanTableName, rowIndex, uniqueIdentifier);
  // Send the update request to the main process
  window.api.send('update-data', { newData, cleanTableName, rowIndex, uniqueIdentifier });
}

function eraseRow(cleanTableName, uniqueIdentifier) {
  console.log('eraseRowFct:', uniqueIdentifier.value);
  // Send the erase request to the main process
  window.api.send('erase-data', { cleanTableName, uniqueIdentifier });
}