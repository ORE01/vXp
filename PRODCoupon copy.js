import { appState } from './renderer.js';
import { handleFormAction, handleCouponFormAction , saveChanges, addSaveButtonHandler} from './renderer/FormButtonHandler.js';
import { convertDateToISO, formatDisplayValue } from './utils/format.js';


export function handleCouponData(prodId, couponSchedule, startDate, maturity, couponfreq) {
  const receivedData = appState.getCouponData(); 

  // Check if receivedData is valid before filtering
  if (!Array.isArray(receivedData)) {
      console.error("❌ Error: receivedData is not an array", receivedData);
      return; // Stop execution to prevent further errors
  }
  
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
  title.textContent = `${prodId}`;
  modalContent.appendChild(title);

  let couponForm;
  let generatedData = []; // Declare at the top level to ensure it's accessible

  // EMPTY COUPON MODAL
  
  if (Number(couponSchedule) === 1 && filteredData.length === 0)
    {
    console.log("No SCHEDULE. Generating new schedule...");

    generatedData = generateEmptyCouponFormData(prodId, startDate, maturity, couponfreq);
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


// EXISTIG COUPON MODAL
  } else {
    // console.log("Displaying existing data...");
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
  // modal.classList.add('visible'); // ✅ Show modal by adding class

}

function generateEmptyCouponFormData(prodId, startDate, maturity, couponfreq) {
  const schedule = [];
  const start = new Date(convertDateToISO(startDate));
  const end = new Date(convertDateToISO(maturity));

  if (isNaN(start) || isNaN(end) || couponfreq <= 0) {
    console.error("Invalid dates or frequency provided.");
    return schedule;
  }

  const intervalInMonths = Math.round((1 / couponfreq) * 12);
  let currentDate = new Date(start);
  let rowCounter = 1;

  while (currentDate <= end) {
    const numericProdId = prodId.replace(/\D/g, '');
    const hashedProdId = prodId.split("").reduce((acc, char) => acc + char.charCodeAt(0), "");
    const uniqueId = parseInt(`${hashedProdId}${rowCounter}`, 10);

    schedule.push({
      ID: uniqueId,
      PROD_ID: String(prodId),
      DATE: convertDateToISO(currentDate.toISOString().split("T")[0]),
      FIX_CF: "",
      CALL: 0,
      ZERO: 0, // ✅ NEU: Standardwert für ZERO
      Notional_Factor: ""
    });

    currentDate.setMonth(currentDate.getMonth() + intervalInMonths);
    rowCounter++;
  }

  console.log("Generated new coupon schedule with IDs:", schedule);
  return schedule;
}



        
      function generateCouponForm(data) {
        const form = document.createElement('form');
        form.id = 'coupon-form';
        form.appendChild(createHeaderRow());
    
        data.forEach((item, index) => {
            form.appendChild(createCouponRow(item, index));
        });
    
        return form;
    }


function createHeaderRow() {
  const headerRow = document.createElement('div');
  headerRow.classList.add('coupon-header');
  headerRow.style.display = 'flex';
  headerRow.style.gap = '5px';
  headerRow.style.alignItems = 'center';

  headerRow.innerHTML = `
    <div style="width: 120px; font-weight: bold;">DATE</div>

    <div style="display: flex; flex-direction: column; align-items: center; width: 110px;">
      <span style="font-weight: bold;">FIX_CF</span>
      <span style="font-size: 12px;">🡇 Fill</span>
    </div>

    <div style="display: flex; flex-direction: column; align-items: center; width: 90px;">
      <span style="font-weight: bold;">CALL</span>
      <span style="font-size: 12px;">🡇 Fill</span>
    </div>

    <div style="display: flex; flex-direction: column; align-items: center; width: 90px;">
      <span style="font-weight: bold;">ZERO</span>
      <span style="font-size: 12px;">🡇 Fill</span>
    </div>

    <div style="display: flex; flex-direction: column; align-items: center; width: 90px;">
      <span style="font-weight: bold;">Notional_Factor</span>
      <span style="font-size: 12px;">🡇 Fill</span>
    </div>
  `;

  return headerRow;
}

function createCouponRow(item, index) {
  const formattedFixCF = item.FIX_CF ? `${(parseFloat(item.FIX_CF) * 100).toFixed(2)}%` : '0.00%';

  const row = document.createElement('div');
  row.classList.add('coupon-row');

  row.innerHTML = `
    <input type="hidden" value="${item.ID}" data-field="ID" data-row-index="${index}">
    <input type="hidden" value="${item.PROD_ID}" data-field="PROD_ID" data-row-index="${index}">

    <input type="date" class="col-date" value="${convertDateToISO(item.DATE)}" data-field="DATE" data-row-index="${index}">
    <input type="text" class="col-fixcf" value="${formattedFixCF}" data-field="FIX_CF" data-row-index="${index}">
    <button type="button" class="fill-down-btn fill-down-fixcf">🡇</button>

    <input type="checkbox" class="col-call" ${item.CALL == 1 ? 'checked' : ''} data-field="CALL" data-row-index="${index}">
    <button type="button" class="fill-down-btn fill-down-call">🡇</button>

    <input type="checkbox" class="col-zero" ${item.ZERO == 1 ? 'checked' : ''} data-field="ZERO" data-row-index="${index}">
    <button type="button" class="fill-down-btn fill-down-zero">🡇</button>

    <input type="text" class="col-fixcf" value="${item.Notional_Factor}" data-field="Notional_Factor" data-row-index="${index}">
    <button type="button" class="fill-down-btn fill-down-Notional_Factor">🡇</button>
  `;

  // Formatierung für % bei FIX_CF
  const fixCFInput = row.querySelector('[data-field="FIX_CF"]');
  fixCFInput.addEventListener('input', (event) => {
    let rawValue = event.target.value.replace('%', '');
    if (!isNaN(rawValue) && rawValue !== '') {
      const cursorPosition = event.target.selectionStart;
      event.target.value = `${parseFloat(rawValue).toFixed(2)}%`;
      event.target.setSelectionRange(cursorPosition, cursorPosition);
    } else {
      event.target.value = '';
    }
  });

  // Fill-down für FIX_CF
  const fillDownFixCF = row.querySelector('.fill-down-fixcf');
  fillDownFixCF.addEventListener('click', () => {
    const currentValue = fixCFInput.value;
    const allRows = document.querySelectorAll('.coupon-row');
    for (let i = index + 1; i < allRows.length; i++) {
      const targetInput = allRows[i].querySelector('[data-field="FIX_CF"]');
      if (targetInput) {
        targetInput.value = currentValue;
      }
    }
  });

  // Fill-down für CALL
  const callInput = row.querySelector('[data-field="CALL"]');
  const fillDownCall = row.querySelector('.fill-down-call');
  fillDownCall.addEventListener('click', () => {
    const isChecked = callInput.checked;
    const allRows = document.querySelectorAll('.coupon-row');
    for (let i = index + 1; i < allRows.length; i++) {
      const targetCheckbox = allRows[i].querySelector('[data-field="CALL"]');
      if (targetCheckbox) {
        targetCheckbox.checked = isChecked;
      }
    }
  });

  // Fill-down für ZERO
  const zeroInput = row.querySelector('[data-field="ZERO"]');
  const fillDownZero = row.querySelector('.fill-down-zero');
  fillDownZero.addEventListener('click', () => {
    const isChecked = zeroInput.checked;
    const allRows = document.querySelectorAll('.coupon-row');
    for (let i = index + 1; i < allRows.length; i++) {
      const targetCheckbox = allRows[i].querySelector('[data-field="ZERO"]');
      if (targetCheckbox) {
        targetCheckbox.checked = isChecked;
      }
    }
  });

  const notionalInput = row.querySelector('[data-field="Notional_Factor"]');
  const fillDownBtn = row.querySelector('.fill-down-Notional_Factor');

  fillDownBtn.addEventListener('click', () => {
    const valueToFill = notionalInput.value;
    const allRows = document.querySelectorAll('.coupon-row');
    for (let i = index + 1; i < allRows.length; i++) {
      const targetInput = allRows[i].querySelector('[data-field="Notional_Factor"]');
      if (targetInput) {
        targetInput.value = valueToFill;
      }
    }
});


  return row;
}

function saveCouponChanges(couponData, couponForm) {
  const updatedData = [];

  const rows = couponForm.querySelectorAll(".coupon-row");
  rows.forEach((row, rowIndex) => {
    const dateInput = row.querySelector("input[data-field='DATE']");
    const fixCFInput = row.querySelector("input[data-field='FIX_CF']");
    const callInput = row.querySelector("input[data-field='CALL']");
    const zeroInput = row.querySelector("input[data-field='ZERO']");
    const notionalInput = row.querySelector("input[data-field='Notional_Factor']"); // ✅ NEU

    if (!dateInput || !fixCFInput || !callInput || !zeroInput || !notionalInput) {
      console.warn(`Row ${rowIndex}: Missing input fields.`);
      return;
    }

    const datasetRowIndex = dateInput.dataset.rowIndex;
    if (!datasetRowIndex) {
      console.error(`Row ${rowIndex}: Missing data-row-index attribute.`);
      return;
    }

    let fixCFValue = fixCFInput.value.replace('%', '').trim();
    fixCFValue = parseFloat(fixCFValue);
    if (!isNaN(fixCFValue)) {
      fixCFValue = fixCFValue / 100;
    } else {
      console.error(`Row ${rowIndex}: Invalid FIX_CF value '${fixCFInput.value}'`);
      fixCFValue = null;
    }

    let notionalValue = parseFloat(notionalInput.value);
    if (isNaN(notionalValue)) {
      console.error(`Row ${rowIndex}: Invalid Notional_Factor value '${notionalInput.value}'`);
      notionalValue = null;
    }

    const rowData = couponData[datasetRowIndex];
    if (!rowData) {
      console.warn(`Row ${datasetRowIndex}: No matching data in couponData. Skipping.`);
      return;
    }

    const updatedRow = {
      ID: rowData.ID,
      PROD_ID: rowData.PROD_ID,
      DATE: dateInput.value,
      FIX_CF: fixCFValue,
      CALL: callInput.checked ? 1 : 0,
      ZERO: zeroInput.checked ? 1 : 0,
      Notional_Factor: notionalValue // ✅ NEU gespeichert
    };

    updatedData.push(updatedRow);
  });

  updatedData.forEach((row) => {
    const uniqueIdentifier = { column: "ID", value: row.ID };
    saveChanges(row, "ProdCouponSchedules", null, uniqueIdentifier);
  });
}


          



  
