import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';
import { filterColumnsInData } from './renderer/dataProcessor.js';

let prodData;

// Function to filter ProdAllData based on filtersConfig
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
    //let filteredProdData = filterColumnsInData((prodData), columns);
    let filteredProdData = filterColumnsInData(filterProdData(prodData, filtersConfig), columns);
    console.log('PROD; handleProdData:', filteredProdData);
    const prodDataHTML = processData(filteredProdData, 'ProdAll');
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

