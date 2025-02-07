import { appState } from './renderer.js';
import { handleFormAction, handleCouponFormAction , saveChanges, addSaveButtonHandler} from './renderer/FormButtonHandler.js';
import { convertDateToISO, formatDisplayValue } from './utils/format.js';


export function handleCouponData(prodId, couponSchedule, startDate, maturity, couponfreq) {
  const receivedData = appState.getCouponData();

  // Filter the data using the PROD_ID
  const filteredData = receivedData.filter(item => String(item.PROD_ID) === String(prodId));
  console.log(`Filtered Coupon Data for PROD_ID '${prodId}':`, filteredData);

  // Remove existing modal if present
  const existingModal = document.getElementById('coupon-modal');
  if (existingModal) {
    existingModal.remove();
  }

  // Create the modal
  const modal = document.createElement('div');
  modal.id = 'coupon-modal';
  modal.classList.add('modal');

  // Modal content
  const modalContent = document.createElement('div');
  modalContent.classList.add('modal-content', 'draggable');

  // Add Close button
  const closeButton = document.createElement('span');
  closeButton.classList.add('close');
  closeButton.innerHTML = '&times;';
  closeButton.onclick = () => document.body.removeChild(modal);
  modalContent.appendChild(closeButton);

  // Add a title
  const title = document.createElement('h2');
  title.textContent = `Coupon Schedule for PROD_ID: ${prodId}`;
  modalContent.appendChild(title);

  let couponForm;
  let generatedData = []; // Declare at the top level to ensure it's accessible

  // Decide which form to generate
  // console.log('couponSchedule:', couponSchedule);
  if (couponSchedule === 1 && filteredData.length === 0) {
    console.log("No existing entries found for SCHEDULE. Generating new schedule...");

    generatedData = generateNewCouponSchedule(prodId, startDate, maturity, couponfreq);
    console.log("generatedData.", generatedData);

    couponForm = generateCouponForm(generatedData);

    // Add Save button for adding new rows
    const saveButton = document.createElement('button');
    saveButton.id = 'saveButton';
    saveButton.textContent = 'Save Changes';

    saveButton.addEventListener('click', () => {
      const rows = couponForm.querySelectorAll('.coupon-row'); // Select all rows within the coupon form
      console.log('Coupon Rows:', rows); // Log the rows for debugging
    
      const selectedTableName = 'ProdCouponSchedules';
    
      rows.forEach((row, rowIndex) => {
        const form = document.createElement('form'); // Create a temporary form
        form.id = `coupon-form-row-${rowIndex}`; // Give it a unique ID
    
        // Clone inputs from the row into the temporary form
        row.querySelectorAll('input').forEach(input => {
          const clonedInput = input.cloneNode(true); // Clone the input to preserve attributes
          form.appendChild(clonedInput); // Append the cloned input to the temporary form
        });
    
        console.log(`Form for row ${rowIndex}:`, form);
    
        // Invoke addSaveButtonHandler with the temporary form
        addSaveButtonHandler(form, null, selectedTableName);
      });
    
      console.log('Finished saving all rows.');
      document.body.removeChild(modal); // Close modal after saving
    });

    modalContent.appendChild(saveButton);

  } else {
    console.log("Displaying existing data...");
    couponForm = generateCouponForm(filteredData);

    // Add Save button for saving existing changes
    const saveButton = document.createElement('button');
    saveButton.id = 'saveButton';
    saveButton.textContent = 'Save Changes';

    saveButton.onclick = () => {
      saveCouponChanges(filteredData, couponForm);
      document.body.removeChild(modal); // Close modal after saving
    };

    modalContent.appendChild(saveButton);
  }


  modalContent.appendChild(couponForm);

  // Append modal content to modal
  modal.appendChild(modalContent);

  // Add the modal to the DOM
  document.body.appendChild(modal);

  // Display the modal
  modal.style.display = 'block';

  
}

// Utility function to generate the editable form
// function generateCouponForm(data) {
//   const form = document.createElement('form');
//   form.id = 'coupon-form';

//   // Add a header row with column names
//   const headerRow = document.createElement('div');
//   headerRow.classList.add('coupon-header');
//   headerRow.style.display = 'flex';
//   headerRow.style.marginBottom = '5px';
//   headerRow.style.fontWeight = 'bold'; // Make the header stand out
//   headerRow.style.justifyContent = 'flex-start'; // Align headers to the left

//   // Column names
//   const dateHeader = document.createElement('div');
//   dateHeader.textContent = 'DATE';
//   dateHeader.style.width = '120px'; // Set fixed width for columns
//   dateHeader.style.marginRight = '10px';

//   const fixCFHeader = document.createElement('div');
//   fixCFHeader.textContent = 'FIX_CF';
//   fixCFHeader.style.width = '80px'; // Set fixed width for columns

//   // Append headers to the header row
//   headerRow.appendChild(dateHeader);
//   headerRow.appendChild(fixCFHeader);

//   // Add the header row to the form
//   form.appendChild(headerRow);

//   // Add rows for data
//   data.forEach((item, index) => {
//     const row = document.createElement('div');
//     row.classList.add('coupon-row');
//     row.style.display = 'flex';
//     row.style.marginBottom = '5px';
//     row.style.justifyContent = 'flex-start'; // Align inputs to the left

//     // Format the date using convertDateToISO
//     const formattedDate = convertDateToISO(item.DATE);

//     // Hidden ID input
//     const idInput = document.createElement('input');
//     idInput.type = 'hidden';
//     idInput.value = item.ID;
//     idInput.dataset.field = 'ID';
//     idInput.dataset.rowIndex = index;

//     // Hidden PROD_ID input
//     const prodIdInput = document.createElement('input');
//     prodIdInput.type = 'hidden';
//     prodIdInput.value = item.PROD_ID;
//     prodIdInput.dataset.field = 'PROD_ID';
//     prodIdInput.dataset.rowIndex = index;

//     // DATE input
//     const dateInput = document.createElement('input');
//     dateInput.type = 'date';
//     dateInput.value = formattedDate; // Use formatted value
//     dateInput.dataset.field = 'DATE';
//     dateInput.dataset.rowIndex = index;
//     dateInput.style.width = '120px'; // Match header width
//     dateInput.style.marginRight = '10px';

//     // FIX_CF input
//     const fixCFInput = document.createElement('input');
//     fixCFInput.type = 'number';
//     fixCFInput.step = '0.01';
//     fixCFInput.value = item.FIX_CF; // Pre-fill with existing value
//     fixCFInput.dataset.field = 'FIX_CF';
//     fixCFInput.dataset.rowIndex = index;
//     fixCFInput.style.width = '80px'; // Match header width

//     // Append inputs to row
//     row.appendChild(idInput);
//     row.appendChild(prodIdInput);
//     row.appendChild(dateInput);
//     row.appendChild(fixCFInput);

//     // Add row to form
//     form.appendChild(row);
//   });

//   return form;
// }
function generateCouponForm(data) {
  const form = document.createElement('form');
  form.id = 'coupon-form';

  // Add a header row with column names
  const headerRow = document.createElement('div');
  headerRow.classList.add('coupon-header');
  headerRow.style.display = 'flex';
  headerRow.style.marginBottom = '5px';
  headerRow.style.fontWeight = 'bold';
  headerRow.style.justifyContent = 'flex-start';

  // Column names
  const dateHeader = document.createElement('div');
  dateHeader.textContent = 'DATE';
  dateHeader.style.width = '120px';
  dateHeader.style.marginRight = '10px';

  const fixCFHeader = document.createElement('div');
  fixCFHeader.textContent = 'FIX_CF';
  fixCFHeader.style.width = '80px';

  // Append headers to the header row
  headerRow.appendChild(dateHeader);
  headerRow.appendChild(fixCFHeader);

  // Add the header row to the form
  form.appendChild(headerRow);

  // Add rows for data
  data.forEach((item, index) => {
    const row = document.createElement('div');
    row.classList.add('coupon-row');
    row.style.display = 'flex';
    row.style.marginBottom = '5px';
    row.style.justifyContent = 'flex-start';

    // Format the date using convertDateToISO
    const formattedDate = convertDateToISO(item.DATE);

    // Hidden ID input
    const idInput = document.createElement('input');
    idInput.type = 'hidden';
    idInput.value = item.ID;
    idInput.dataset.field = 'ID';
    idInput.dataset.rowIndex = index;

    // Hidden PROD_ID input
    const prodIdInput = document.createElement('input');
    prodIdInput.type = 'hidden';
    prodIdInput.value = item.PROD_ID;
    prodIdInput.dataset.field = 'PROD_ID';
    prodIdInput.dataset.rowIndex = index;

    // DATE input
    const dateInput = document.createElement('input');
    dateInput.type = 'date';
    dateInput.value = formattedDate;
    dateInput.dataset.field = 'DATE';
    dateInput.dataset.rowIndex = index;
    dateInput.style.width = '120px';
    dateInput.style.marginRight = '10px';

    // FIX_CF input (formatted as a percentage)
    // const formattedFixCF = formatInputFieldValue('FIX_CF', item.FIX_CF); // Apply formatting
    // Format FIX_CF manually to display as percentage (e.g., 0.04 → "4.00%")
    // const formattedFixCF = item.FIX_CF ? (parseFloat(item.FIX_CF) * 100).toFixed(2) + '%' : '';
    const formattedFixCF = formatDisplayValue('FIX_CF', item.FIX_CF);



    const fixCFInput = document.createElement('input');
    fixCFInput.type = 'text'; // Change from 'number' to 'text' to allow the '%' sign
    fixCFInput.value = formattedFixCF; // Use the formatted value
    fixCFInput.dataset.field = 'FIX_CF';
    fixCFInput.dataset.rowIndex = index;
    fixCFInput.style.width = '80px';

    // Ensure the user can only input numbers but keeps the % formatting
    fixCFInput.addEventListener('input', (event) => {
      let rawValue = event.target.value.replace('%', ''); // Remove the %
    
      if (!isNaN(rawValue) && rawValue !== '') {
        const cursorPosition = event.target.selectionStart;  // Get current cursor position
    
        // Only append '%' without adding decimals
        event.target.value = rawValue + '%';
    
        // Restore cursor position before the '%'
        event.target.setSelectionRange(cursorPosition, cursorPosition);
      } else {
        // Clear if input is invalid
        event.target.value = '';
      }
    });
    
    

    // Append inputs to row
    row.appendChild(idInput);
    row.appendChild(prodIdInput);
    row.appendChild(dateInput);
    row.appendChild(fixCFInput);

    // Add row to form
    form.appendChild(row);
  });

  return form;
}


function generateNewCouponSchedule(prodId, startDate, maturity, couponfreq) {
  const schedule = [];
  const start = new Date(convertDateToISO(startDate)); // Convert start date
  const end = new Date(convertDateToISO(maturity)); // Convert maturity date

  if (isNaN(start) || isNaN(end) || couponfreq <= 0) {
    console.error("Invalid dates or frequency provided.");
    return schedule;
  }

  const intervalInMonths = Math.round((1 / couponfreq) * 12); // Convert frequency to months
  let currentDate = new Date(start);
  let rowCounter = 1; // Counter for generating unique IDs

  // ⚠️ Move to the first actual coupon payment date
  //currentDate.setMonth(currentDate.getMonth() + intervalInMonths);

  while (currentDate <= end) {
    // Generate a numeric ID by combining prodId and rowCounter
    const numericProdId = prodId.replace(/\D/g, ''); // Remove non-numeric characters from prodId
    const uniqueId = parseInt(`${numericProdId}${rowCounter}`, 10); // Concatenate and parse as an integer

    schedule.push({
      ID: uniqueId, // Numeric unique ID
      PROD_ID: String(prodId), // Ensure PROD_ID is stored as a string
      DATE: convertDateToISO(currentDate.toISOString().split("T")[0]), // Format as YYYY-MM-DD
      FIX_CF: "", // Default value for FIX_CF
    });

    currentDate.setMonth(currentDate.getMonth() + intervalInMonths); // Move to next coupon date
    rowCounter++; // Increment counter for the next row
  }

  console.log("Generated new coupon schedule with IDs:", schedule);
  return schedule;
}

  

function saveCouponChanges(couponData, couponForm) {
  const updatedData = [];

  // Loop through all rows
  const rows = couponForm.querySelectorAll(".coupon-row");
  rows.forEach((row, rowIndex) => {
      console.log(`Processing Row: ${rowIndex}`);

      const dateInput = row.querySelector("input[data-field='DATE']");
      const fixCFInput = row.querySelector("input[data-field='FIX_CF']");

      // Validation: Check if inputs exist
      if (!dateInput || !fixCFInput) {
          console.warn(`Row ${rowIndex}: Missing input fields.`);
          return;
      }

      const datasetRowIndex = dateInput.dataset.rowIndex;
      if (!datasetRowIndex) {
          console.error(`Row ${rowIndex}: Missing data-row-index attribute.`);
          return;
      }

      // ✅ Correct FIX_CF value extraction (removes % and converts)
      let fixCFValue = fixCFInput.value.replace('%', '').trim(); // Remove % and spaces
      fixCFValue = parseFloat(fixCFValue); // Convert to number
      if (!isNaN(fixCFValue)) {
          fixCFValue = fixCFValue / 100; // Convert to decimal (e.g., 4 → 0.04)
          console.log(`fixCFValue:`, fixCFValue);
      } else {
          console.error(`Row ${rowIndex}: Invalid FIX_CF value '${fixCFInput.value}'`);
          fixCFValue = null; // Handle invalid cases
      }

      // Prepare updated row data
      const rowData = couponData[datasetRowIndex];
      if (!rowData) {
          console.warn(`Row ${datasetRowIndex}: No matching data in couponData. Skipping.`);
          return;
      }

      const updatedRow = {
          ID: rowData.ID,
          PROD_ID: rowData.PROD_ID,
          DATE: dateInput.value,
          FIX_CF: fixCFValue, // ✅ Now stored as a decimal
      };

      console.log(`Updated Row Data for ID=${updatedRow.ID}:`, updatedRow);
      updatedData.push(updatedRow);
  });

  console.log("Updated Coupon Schedule to Save:", updatedData);

  // Save updated data
  updatedData.forEach((row) => {
      const uniqueIdentifier = { column: "ID", value: row.ID };
      console.log("Saving row:", row, "with uniqueIdentifier:", uniqueIdentifier);

      saveChanges(row, "ProdCouponSchedules", null, uniqueIdentifier);
  });
}



  
