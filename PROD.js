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

export function handleProdData(receivedData, filtersConfig) {
  const prodDataContainer = document.getElementById('prodDataContainer');
  prodData = receivedData;

  if (prodDataContainer && prodData) {
    let columns = ['PROD_ID', 'DESCRIPTION', 'CouponType', 'SCHEDULE', 'MATURITY', 'ISSUER', 'RANK', 'RATING_PROD', 'CS_Szenario'];
    //let filteredProdData = filterColumnsInData((prodData), columns);
    let filteredProdData = filterColumnsInData(filterProdData(prodData, filtersConfig), columns);

    console.log('PROD; handleProdData:', filteredProdData);
    appState.setFilteredProdData(filteredProdData);

    const prodDataHTML = processData(filteredProdData, 'ProdAll');
    prodDataContainer.innerHTML = prodDataHTML;

    // TOOLTIP
    
      addTooltipsForTruncatedText(prodDataContainer);

    // Edit Buttons
    const prodEditButtons = document.querySelectorAll('#prodDataContainer .edit-button');
    prodEditButtons.forEach((button) => {
      button.addEventListener('click', (event) => {

        event.stopPropagation();
        const tableName = 'ProdAll';
        const actionType = 'edit';
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleFormAction(event, prodData, rowIndex, tableName, actionType);

        // Get the correct row data from prodData
        const selectedRow = prodData[rowIndex];
        if (!selectedRow || !selectedRow.PROD_ID) {
          console.warn(`No PROD_ID found for row index: ${rowIndex}`);
          return;
        }
        const prodId = selectedRow.PROD_ID; // Extract PROD_ID
        // console.log(`Editing PROD_ID: ${prodId}`);
        const couponSchedule = selectedRow.SCHEDULE;
        // console.log(`Editing couponSchedule: ${couponSchedule}`);
        const startDate = selectedRow.START_DATE
        // console.log(`Editing startDate: ${startDate}`);
        const maturity = selectedRow.MATURITY
        // console.log(`Editing maturity: ${maturity}`);
        const couponfreq = selectedRow.TENOR
        // console.log(`Editing tenor: ${couponfreq}`);
        
        
        
        
        // Extract SCHEDULE
        // console.log(`Editing couponSchedule: ${couponSchedule}`);
  
        // Call handleCouponData with PROD_ID
        // handleCouponData(prodId);

        // Dynamically add a button to open the Coupon Modal
        //addCouponButton(prodId);
        handleCouponModal(prodId, couponSchedule, startDate, maturity, couponfreq);
      });


    });

    // Add Button
    const prodAddButton = document.getElementById('prodAddButton');
    prodAddButton.addEventListener('click', (event) => {
      const tableName = 'ProdAll';
      const actionType = 'add';
      handleFormAction(event, prodData, null, tableName, actionType);
    });
  }
}



function handleCouponModal(prodId, couponSchedule, startDate, maturity, couponfreq) {

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



export { prodData };