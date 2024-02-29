import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';

let filteredDealsData;
// ADD Button
export function dealsAddButtonHandler (event, selectedTableName) {
  // dealsAddButton.removeEventListener('click', dealsAddButtonHandler);
  const actionType = 'add';
  handleFormAction(event, filteredDealsData, null, selectedTableName, actionType);
};
export function handleDealsData(selectedTableName, receivedData, selectedTradeIDs) {
  console.log('DEALS handleDealsData selectedTableName:', selectedTableName, receivedData);
  const dealsDataContainer = document.getElementById('dealsDataContainer');
  const dealsData = receivedData;

  if (dealsDataContainer && dealsData) {
    // Filter the prodData for specific columns
    let columns = ['TRADE_ID', 'PROD_ID', 'PRICE_BUY', 'TRADE_DATE', 'CATEGORY', 'NOTIONAL'];

    if (selectedTradeIDs.includes('ALL')) {
      filteredDealsData = filterColumnsInData(dealsData, columns);
      console.log('filteredDealsDataALL:', filteredDealsData);
    } else {
      filteredDealsData = filterColumnsInData(
        dealsData.filter(dataPoint => selectedTradeIDs.includes(String(dataPoint.TRADE_ID))),
        columns
      );
    }

    const dealsDataHTML = processData(filteredDealsData, selectedTableName);
    dealsDataContainer.innerHTML = dealsDataHTML;

    // Edit Buttons
    const dealsEditButtons = document.querySelectorAll('#dealsDataContainer .edit-button');
    dealsEditButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation(); // Stop event propagation
        const actionType = 'edit';
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleFormAction(event, dealsData, rowIndex, selectedTableName, actionType);
      });
    });
  }
}

export function handlecreated_tablesData(Data) {
  console.log('DEALS handlecreated_tablesData:', Data)
  const createdTablesDropdown = document.getElementById('createdTablesDropdown');

  // Clear existing options
  createdTablesDropdown.innerHTML = '';

  // Create an empty default option
  const defaultOption = document.createElement('option');
  defaultOption.value = ''; // You can set this to any default value
  defaultOption.text = 'Select a table'; // Display text for the default option
  createdTablesDropdown.appendChild(defaultOption);

  // Populate the dropdown with fetched data
  Data.forEach(row => {
    const option = document.createElement('option');
    option.value = row.table_name; // Assuming the table_name column stores the table names
    option.text = row.table_name;
    createdTablesDropdown.appendChild(option);
  });
}


