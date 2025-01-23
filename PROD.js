import processData from './renderer/dataProcessor.js';
import { handleFormAction, handleCouponFormAction , saveChanges} from './renderer/FormButtonHandler.js';
import { convertDateToISO} from './renderer/inputFieldsGenerator.js';
import { filterColumnsInData } from './renderer/dataProcessor.js';
import { addTooltipsForTruncatedText } from './utils/tooltips.js';
import { ensureRendered } from './utils/domHelpers.js';
import { appState } from './renderer.js';

let prodData;

function filterProdData(data, filtersConfig) {
  return data.filter(dataPoint => {
    return Object.entries(filtersConfig).every(([key, valueSet]) => {
      return valueSet.has('ALL') || valueSet.has(dataPoint[key]);
    });
  });
}

export function handleProdData(receivedData, filtersConfig) {
  const prodDataContainer = document.getElementById('prodDataContainer');
  prodData = receivedData;

  if (prodDataContainer && prodData) {
    let columns = ['PROD_ID', 'DESCRIPTION', 'CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING_PROD', 'CS_Szenario'];
    let filteredProdData = filterColumnsInData(filterProdData(prodData, filtersConfig), columns);

    // Generate and set table HTML
    const prodDataHTML = processData(filteredProdData, 'ProdAll');
    prodDataContainer.innerHTML = prodDataHTML;

    // Ensure DOM rendering before processing
    ensureRendered(() => {
      addTooltipsForTruncatedText(prodDataContainer);

      // Attach edit button listeners
      const prodEditButtons = document.querySelectorAll('#prodDataContainer .edit-button');
      prodEditButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();

           const tableName = 'ProdAll';
           const actionType = 'edit';

          const rowIndex = parseInt(button.getAttribute('data-row'), 10);
          const selectedProd = prodData[rowIndex]; // Get the selected product

          // Fetch coupon schedule data for the selected product
          const couponData = appState.getCouponData().filter(
            (item) => String(item.PROD_ID) === String(selectedProd.PROD_ID)
          );

          // Open the combined modal
          displayCombinedModal(prodData, rowIndex, couponData);
          // handleFormAction(event, prodData, rowIndex, tableName, actionType);
        });
      });

      // Attach add button listener
      const prodAddButton = document.getElementById('prodAddButton');
      if (prodAddButton) {
        prodAddButton.addEventListener('click', (event) => {

          event.stopPropagation();

          // Open the combined modal for adding a new product and schedule
          displayCombinedModal({}, null, [], true); // Passing `true` for add mode
        });
      }
    });
  }
}


function displayCombinedModal(selectedProd, rowIndex, couponData, isAddMode = false) {
  console.log('selectedProd:', selectedProd);
  console.log('couponData:', couponData);

  const modal = document.getElementById('modal');
  const modalTitle = modal.querySelector('h2');
  const modalBody = document.getElementById('modalBody');

  if (!modal || !modalBody) {
    console.error('Modal or modal body not found.');
    return;
  }

  // Set title based on mode
  modalTitle.textContent = isAddMode ? 'Add New Product and Schedule' : `Edit Product: ${selectedProd.PROD_ID}`;

  // Clear previous modal content
  modalBody.innerHTML = '';

  // Separate logic for edit and add modes
  if (isAddMode) {
    handleAddMode(modalBody);
  } else {
    handleEditMode(selectedProd, rowIndex, couponData, modalBody);
  }

  // Show modal
  modal.style.display = 'block';

  // Close modal handler
  const closeButton = modal.querySelector('.close');
  closeButton.onclick = () => {
    modal.style.display = 'none';
  };
}

function handleEditMode(selectedProd, rowIndex, couponData, modalBody) {
  // ProdAll section
  const prodAllContainer = document.createElement('div');
  prodAllContainer.classList.add('prodAll-container');
  const prodAllForm = document.createElement('form');
  prodAllForm.id = 'prodAllForm';
  prodAllContainer.appendChild(prodAllForm);
  modalBody.appendChild(prodAllContainer);

  // Handle ProdAll fields
  handleFormAction(null, selectedProd, rowIndex, 'ProdAll', 'edit');

  // CouponSchedules section
  const couponContainer = document.createElement('div');
  couponContainer.classList.add('coupon-container');
  const couponForm = document.createElement('form');
  couponForm.id = 'couponForm';
  couponContainer.appendChild(couponForm);
  modalBody.appendChild(couponContainer);

  // Populate CouponSchedules fields
  if (couponData.length > 0) {
    let couponContent = `
      <h3>Coupon Schedule</h3>
      <table>
        <thead>
          <tr>
            <th>Date</th>
            <th>Fix_CF</th>
          </tr>
        </thead>
        <tbody>
          ${couponData
            .map(
              (row, index) => `
            <tr>
              <td>
                <input type="date" data-field="DATE" value="${convertDateToISO(row.DATE)}" data-row-index="${index}" />
              </td>
              <td>
                <input type="number" step="0.01" data-field="FIX_CF" value="${row.FIX_CF}" data-row-index="${index}" />
              </td>
            </tr>
          `
            )
            .join('')}
        </tbody>
      </table>
    `;
    couponForm.innerHTML = couponContent;

    // Add Save button for CouponSchedules
    const saveCouponButton = document.createElement('button');
    saveCouponButton.textContent = 'Save Coupon Schedule';
    saveCouponButton.type = 'button';
    saveCouponButton.classList.add('save-button');
    saveCouponButton.onclick = () => saveCouponChanges(couponData, couponForm);
    couponContainer.appendChild(saveCouponButton);
  } else {
    couponForm.innerHTML = '<p>No schedule available for this product.</p>';
  }
}








function saveCouponChanges(couponData, couponForm) {
  const updatedData = [];

  // Gather updated data from the couponForm
  const rows = couponForm.querySelectorAll('tr');
  rows.forEach((row, rowIndex) => {
    console.log(`Processing Row: ${rowIndex}`);

    const dateInput = row.querySelector('input[data-field="DATE"]');
    const fixCFInput = row.querySelector('input[data-field="FIX_CF"]');

    // Safeguard and log missing inputs
    if (!dateInput) {
      console.warn(`Row ${rowIndex}: Date input not found.`);
      return;
    }
    if (!fixCFInput) {
      console.warn(`Row ${rowIndex}: Fix_CF input not found.`);
      return;
    }

    const datasetRowIndex = dateInput.dataset.rowIndex;
    if (!datasetRowIndex) {
      console.error(`Row ${rowIndex}: Missing data-row-index attribute on dateInput.`);
      return;
    }

    // Log inputs being processed
    console.log(`Row ${rowIndex}: DATE=${dateInput.value}, FIX_CF=${fixCFInput.value}`);

    // Ensure the data exists for this row
    const rowData = couponData[datasetRowIndex];
    if (!rowData) {
      console.warn(`Row ${datasetRowIndex}: No matching data in couponData. Skipping.`);
      return;
    }

    // Prepare updated row data
    const updatedRow = {
      ID: rowData.ID, // Ensure the correct ID is used
      DATE: dateInput.value,
      FIX_CF: parseFloat(fixCFInput.value),
    };

    // Log the updated row data
    console.log(`Updated Row Data for ID=${updatedRow.ID}:`, updatedRow);

    updatedData.push(updatedRow);
  });

  console.log('Updated Coupon Schedule to Save:', updatedData);

  // Save each updated row
  updatedData.forEach((row) => {
    const uniqueIdentifier = { column: 'ID', value: row.ID }; // Use correct ID
    console.log('Saving row:', row, 'with uniqueIdentifier:', uniqueIdentifier);

    saveChanges(row, 'ProdCouponSchedules', null, uniqueIdentifier);
  });
}

























// export function handleProdData(receivedData, filtersConfig) {
//   const prodDataContainer = document.getElementById('prodDataContainer');
//   prodData = receivedData;

//   if (prodDataContainer && prodData) {
//     let columns = ['PROD_ID', 'DESCRIPTION', 'CouponType', 'MATURITY', 'ISSUER', 'RANK', 'RATING_PROD', 'CS_Szenario'];
//     let filteredProdData = filterColumnsInData(filterProdData(prodData, filtersConfig), columns);

//     // Generate and set table HTML
//     const prodDataHTML = processData(filteredProdData, 'ProdAll');
//     prodDataContainer.innerHTML = prodDataHTML;

//     // Ensure DOM rendering before processing
//     ensureRendered(() => {
//       addTooltipsForTruncatedText(prodDataContainer);

//       // Attach edit button listeners
//       const prodEditButtons = document.querySelectorAll('#prodDataContainer .edit-button');
//       prodEditButtons.forEach((button) => {
//         button.addEventListener('click', (event) => {
//           event.stopPropagation();

//           const tableName = 'ProdAll';
//           const actionType = 'edit';
//           const rowIndex = parseInt(button.getAttribute('data-row'), 10);
//           handleFormAction(event, prodData, rowIndex, tableName, actionType);
//         });
//       });

//       // Attach add button listener
//       const prodAddButton = document.getElementById('prodAddButton');
//       if (prodAddButton) {
//         prodAddButton.addEventListener('click', (event) => {
//           const tableName = 'ProdAll';
//           const actionType = 'add';
//           handleFormAction(event, prodData, null, tableName, actionType);
//         });
//       }
//     });
//   }
// }

















export { prodData };

