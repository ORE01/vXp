import { generateInputFields, generateCouponInputFields } from './inputFieldsGenerator.js';
import { formatInputFieldValue } from '../utils/format.js';
import { issuerData } from '../r_tab/ISSUER.js';

export function handleFormAction(event, data, rowIndex, selectedTableName, actionType) {
  displayModal(actionType, rowIndex);
  setupFormFields(actionType, data, rowIndex, selectedTableName);

  if (actionType === 'add') {
    console.log('data, rowIndex, selectedTableName', data, selectedTableName)

    setupAddOperation(data, selectedTableName);
  } else if (actionType === 'edit') {
    console.log('data',data)
    const rowData = data[rowIndex];
    
    setupEditOperation(rowData, rowIndex, selectedTableName);
  }
}

export function handleCouponFormAction(event, data, rowIndex, actionType) {
  console.log('handleCouponFormAction',  data)
  displayModal(actionType, rowIndex);

  if (actionType === 'add') {
    setupCouponAddOperation(data);
  } else if (actionType === 'edit') {
    const rowData = data[rowIndex];
    setupCouponEditOperation(data);
  }
}





// let isAddingRow = false;
let isAddingRow;
const addSaveButtonHandler = (form, modal, selectedTableName) => {
  console.log('Save button clicked');
  if (isAddingRow) return;
  isAddingRow = true;
  const newRowData = gatherFormData(form);
  
  try {
    const newSelectedTableName = selectedTableName;
    console.log('selectedTableName', newSelectedTableName);
    const cleanTableName = newSelectedTableName;
    addNewRow(newRowData, cleanTableName);
    console.log(`New row added to ${cleanTableName} successfully.`);
    closeModal();
  } catch (error) {
    displayErrorMessage(`Failed to add new row: ${error.message}`);
  }
  isAddingRow = false;
};


// function setupAddOperation(data, selectedTableName) {
//   console.log('data, selectedTableName', data, selectedTableName)
//   const modal = document.getElementById('modal');
//   const modalTitle = modal.querySelector('h2');
//   const form = document.getElementById('editForm'); // Ensure this ID matches your Add Form
  
//   // Reset the form and modal for a new addition
//   form.innerHTML = '';
//   modalTitle.textContent = 'Add New Row';

//   // Preparing an empty template based on the structure of `data`
//   const emptyRowData = data.length > 0 ? Object.keys(data[0]).reduce((acc, fieldName) => {
//       acc[fieldName] = '';
//       return acc;
//   }, {}) : {};

//   // Additional setup for specific tables
//   // if (selectedTableName === 'Issuer') {
//   // Assume issuerData is available globally or passed as a parameter
//   const uniqueIssuers = [...new Set(data.map(item => item.ISSUER))];
//   emptyRowData['ISSUER'] = uniqueIssuers.length > 0 ? uniqueIssuers[0] : '';
//   // }
//   //console.log('uniqueIssuers:', uniqueIssuers);
//   // Generate input fields based on the empty data template
//   generateInputFields(emptyRowData, form, uniqueIssuers, selectedTableName); // Adjust if your function signature differs

//   // Cloning the saveButton without redefining it
//   const saveButton = document.getElementById('saveButton');
//   const saveButtonClone = saveButton.cloneNode(true);
//   saveButton.parentNode.replaceChild(saveButtonClone, saveButton);

//   console.log('Attaching event listener to saveButton');

//   saveButtonClone.addEventListener('click', () => addSaveButtonHandler(form, modal, selectedTableName));
// }

function setupAddOperation(data, selectedTableName) {
  console.log('data, selectedTableName', data, selectedTableName);
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

  console.log('Attaching event listener to saveButton');

  saveButtonClone.addEventListener('click', () => addSaveButtonHandler(form, modal, selectedTableName));
}

function setupEditOperation(data, rowIndex, selectedTableName) {
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



function gatherFormData(form) {
  // Log the form being passed to verify it's the expected one
  console.log('Form passed to gatherFormData:', form);

  if (!form) {
    console.error('Form not found in gatherFormData function.');
    return {}; // Return an empty object if the form isn't found
  }

  const newRowData = {};
  // Ensure we're querying only within the form element
  const inputFields = form.querySelectorAll('input, select');
  console.log('Input Fields:', inputFields); // Log to verify the fields are being selected

  inputFields.forEach(input => {
    const fieldName = input.getAttribute('data-field');
    // Check if formatInputFieldValue function needs the original value or formatted
    const value = formatInputFieldValue(fieldName, input.value);
    newRowData[fieldName] = value;
  });

  return newRowData;
}

// function displayModal(actionType, rowIndex = null) {
//   const modal = document.getElementById('modal');
//   const modalTitle = modal.querySelector('h2');

//   // Set the modal title based on the action type
//   if (actionType === 'add') {
//     modalTitle.textContent = 'Add New Row';
//   } else if (actionType === 'edit' && rowIndex !== null) {
//     modalTitle.textContent = `Edit Row ${rowIndex + 1}`;
//   }

//   // Show the modal
//   modal.style.display = 'block';

//   // Close button handler
//   const closeButton = modal.querySelector('.close');
//   closeButton.onclick = () => {
//     modal.style.display = 'none'; // Hide the modal
//   };

//   // Ensure the form within the modal is cleared when displaying
//   const form = modal.querySelector('#editForm');
//   form.innerHTML = '';
// }

// function displayModal(actionType, rowIndex = null) {
//   const modal = document.getElementById('modal');
//   const modalContent = modal.querySelector('.modal-content');
//   const modalTitle = modal.querySelector('h2');

//   // Set the modal title based on the action type
//   if (actionType === 'add') {
//     modalTitle.textContent = 'Add New Row';
//   } else if (actionType === 'edit' && rowIndex !== null) {
//     modalTitle.textContent = `Edit Row ${rowIndex + 1}`;
//   }

//   // Show the modal
//   modal.style.display = 'block';

//   // Close button handler
//   const closeButton = modal.querySelector('.close');
//   closeButton.onclick = () => {
//     modal.style.display = 'none'; // Hide the modal
//   };

//   // Drag functionality
//   const dragElement = modal.querySelector('.draggable'); // Draggable area
//   let isDragging = false;
//   let offsetX = 0, offsetY = 0;

//   // Mouse down event
//   dragElement.onmousedown = (e) => {
//     isDragging = true;
//     offsetX = e.clientX - modalContent.offsetLeft;
//     offsetY = e.clientY - modalContent.offsetTop;

//     // Mouse move event
//     document.onmousemove = (moveEvent) => {
//       if (isDragging) {
//         modalContent.style.left = `${moveEvent.clientX - offsetX}px`;
//         modalContent.style.top = `${moveEvent.clientY - offsetY}px`;
//         modalContent.style.transform = "none"; // Disable centering during drag
//       }
//     };
//   };

//   // Mouse up event
//   document.onmouseup = () => {
//     isDragging = false;
//     document.onmousemove = null;
//   };
// }

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

  // Drag functionality
  const dragElement = modal.querySelector('.draggable'); // Draggable area
  let isDragging = false;
  let offsetX = 0, offsetY = 0;

  // Mouse down event
  dragElement.onmousedown = (e) => {
    isDragging = true;
    offsetX = e.clientX - modalContent.offsetLeft;
    offsetY = e.clientY - modalContent.offsetTop;

    // Mouse move event
    document.onmousemove = (moveEvent) => {
      if (isDragging) {
        modalContent.style.left = `${moveEvent.clientX - offsetX}px`;
        modalContent.style.top = `${moveEvent.clientY - offsetY}px`;
        modalContent.style.transform = "none"; // Disable centering during drag
      }
    };
  };

  // Mouse up event
  document.onmouseup = () => {
    isDragging = false;
    document.onmousemove = null;
  };
}




function setupFormFields(actionType, data, rowIndex, selectedTableName) {
  console.log('actionType_if:', actionType, data, rowIndex, selectedTableName);
  const form = modal.querySelector(actionType === 'add' ? 'form' : '#editForm');
  form.innerHTML = ''; // Clear the form fields

  
  if (actionType === 'add') {
    // Handle the add operation
    console.log('actionType_if:', actionType);
    const emptyRowData = Object.keys(data[0]).reduce((acc, fieldName) => {
        acc[fieldName] = '';
        return acc;
    }, {});
    console.log('emptyRowData:', emptyRowData);
    const uniqueIssuers = [...new Set(issuerData.map((item) => item.ISSUER))];
    emptyRowData['ISSUER'] = uniqueIssuers.length > 0 ? uniqueIssuers[0] : '';
   
    generateInputFields(emptyRowData, form, uniqueIssuers, selectedTableName);
  }
  
  if (actionType === 'edit' && data && data.length > rowIndex) {

    const rowData = data[rowIndex];
    const uniqueIssuers = [...new Set(issuerData.map((item) => item.ISSUER))];
    console.log("selectedTableName, rowData", selectedTableName,rowData);

    generateInputFields(rowData, form, uniqueIssuers, selectedTableName);
  }
}




const editSaveButtonHandler = (selectedTableName, rowIndex, data) => async () => {
  console.log("selectedTableName", selectedTableName);
  // Check if selectedTableName is defined
  if (!selectedTableName) {
    console.error("selectedTableName is undefined.");
    displayErrorMessage("Error: No table selected.");
    return; // Exit the function to prevent further execution
  }

  const form = document.getElementById('editForm');
  const newData = gatherFormData(form);

  try {
    // Assuming getCleanTableName correctly handles the case where selectedTableName might be undefined
    const cleanTableName = getCleanTableName(selectedTableName);
    const uniqueIdentifier = getUniqueIdentifier(newData, selectedTableName);
    await saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier);
    console.log(`Changes saved to ${cleanTableName} successfully.`);
    closeModal();
  } catch (error) {
    displayErrorMessage(`Failed to save changes: ${error.message}`);
  }
};

let isErasing = false;
const eraseButtonHandler = (selectedTableName, rowIndex, data) => async () => {
  console.log('selectedTableName, uniqueIdentifier', data)
  if (isErasing) return;
  isErasing = true;

  try {
    const cleanTableName = getCleanTableName(selectedTableName);
    const uniqueIdentifier = getUniqueIdentifier(data, selectedTableName);
    console.log('selectedTableName, uniqueIdentifier', selectedTableName, uniqueIdentifier)
    await eraseRow(cleanTableName, uniqueIdentifier);
    closeModal();
  } catch (error) {
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
  if (selectedTableName.startsWith('Deals')) {
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


function closeModal() {
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

export function saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier) {
  console.log('FBH saveChanges tableName:', newData, cleanTableName, rowIndex, uniqueIdentifier);
  // Send the update request to the main process
  window.api.send('update-data', { newData, cleanTableName, rowIndex, uniqueIdentifier });
}


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





function setupCouponAddOperation(data) {
  const modal = document.getElementById('modal');
  const form = document.getElementById('editForm');
  const modalTitle = modal.querySelector('h2');

  // Reset form and modal title
  form.innerHTML = '';
  modalTitle.textContent = 'Add New Coupon Row';

  // Create an empty template for a new row
  const emptyRow = { DATE: '', FIX_CF: '' };

  generateInputFields(emptyRow, form, [], 'ProdCouponSchedules');

  // Configure save button
  const saveButton = document.getElementById('saveButton');
  const newSaveButton = saveButton.cloneNode(true);
  saveButton.parentNode.replaceChild(newSaveButton, saveButton);
  newSaveButton.addEventListener('click', () => addSaveButtonHandler(form, modal, 'ProdCouponSchedules'));
}

function setupCouponEditOperation(rowData) {
  if (!rowData) {
    console.error('setupCouponEditOperation: rowData is undefined or null.');
    return;
  }

  console.log('setupCouponEditOperation data', rowData);
  const modal = document.getElementById('modal');
  const form = document.getElementById('editForm');
  const modalTitle = modal.querySelector('h2');

  // Reset form and modal title
  form.innerHTML = '';
  modalTitle.textContent = `Edit Coupon Data`;

  // Use the new generateCouponInputFields for coupon-specific data
  generateCouponInputFields(rowData, form);

  // Configure save button
  const saveButton = document.getElementById('saveButton');
  const newSaveButton = saveButton.cloneNode(true);
  saveButton.parentNode.replaceChild(newSaveButton, saveButton);

  newSaveButton.addEventListener('click', () => {
    editSaveButtonHandler('ProdCouponSchedules', rowData)();
  });

  // Configure erase button
  const eraseButton = document.getElementById('eraseButton');
  const newEraseButton = eraseButton.cloneNode(true);
  eraseButton.parentNode.replaceChild(newEraseButton, eraseButton);

  newEraseButton.addEventListener('click', () => {
    eraseButtonHandler('ProdCouponSchedules', rowData)();
  });
}




