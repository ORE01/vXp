import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';
import { filterColumnsInData } from './renderer/dataProcessor.js';

let prodData;

export function handleProdData(receivedData) {
  const prodDataContainer = document.getElementById('prodDataContainer');
  prodData = receivedData;

  if (prodDataContainer && prodData) {
    let columns = ['PROD_ID', 'DESCRIPTION', 'CouponType', 'MATURITY', 'ISSUER', 'RATING', 'C_SPREAD'];
    let filteredProdData = filterColumnsInData(prodData, columns);

    const prodDataHTML = processData(filteredProdData);
    prodDataContainer.innerHTML = prodDataHTML;

    // Edit Buttons
    const prodEditButtons = document.querySelectorAll('#prodDataContainer .edit-button');
    prodEditButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation();
        const tableName = 'ProdAll';
        const actionType = 'edit';
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleFormAction(event, prodData, rowIndex, tableName, actionType);
      });
    });

    // Add Button
    const prodAddButton = document.getElementById('prodaddButton');
    prodAddButton.addEventListener('click', (event) => {
      const tableName = 'ProdAll';
      const actionType = 'add';
      handleFormAction(event, prodData, null, tableName, actionType);
    });
  }
}

export { prodData };

