import processData from '../renderer/dataProcessor.js';
import { handleFormAction } from '../renderer/FormButtonHandler.js';
import { filterColumnsInData } from '../renderer/dataProcessor.js';

let issuerData;
let filteredIssuerData;

// Function to filter ProdAllData based on filtersConfig
function filterIssuerData(data, filtersConfig) {
  return data.filter(dataPoint => {
    return Object.entries(filtersConfig).every(([key, valueSet]) => {
      return valueSet.has('ALL') || valueSet.has(dataPoint[key]);
    });
  });
}

export function handleIssuerData(receivedData, filtersConfig) {
  const issuerDataContainer = document.getElementById('issuerDataContainer');
  issuerData = receivedData;
  console.log('handleIssuerData:', issuerData); 

  if (issuerDataContainer && issuerData) {
    let columns = ['ISSUER', 'TICKER', 'RATING'];
    //let filteredProdData = filterColumnsInData((prodData), columns);
    filteredIssuerData = filterColumnsInData(filterIssuerData(issuerData, filtersConfig), columns);
    console.log('issuerData:', issuerData);
    console.log('filteredIssuerData:', filteredIssuerData);
    const issuerDataHTML = processData(filteredIssuerData, 'Issuer');
    issuerDataContainer.innerHTML = issuerDataHTML;

    // Edit Buttons
    const issuerEditButtons = document.querySelectorAll('#issuerDataContainer .edit-button');
    issuerEditButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation(); // Stop event propagation
        const tableName = 'Issuer';
        const actionType = 'edit';
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleFormAction(event, issuerData, rowIndex, tableName, actionType);
      });
    });

    // Add Button
    const issueraddButton = document.getElementById('issueraddButton');
    issueraddButton.addEventListener('click', (event) => {
      const tableName = 'Issuer';
      const actionType = 'add';
      handleFormAction(event, issuerData, null, tableName, actionType);
    });
  }
  
}

export { issuerData, filteredIssuerData };


