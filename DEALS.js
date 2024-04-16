import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';
import { appState } from './renderer.js'; 

let filteredDealsData;
// ADD Button
export function dealsAddButtonHandler (event, selectedTableName) {
  // dealsAddButton.removeEventListener('click', dealsAddButtonHandler);
  const actionType = 'add';
  handleFormAction(event, filteredDealsData, null, selectedTableName, actionType);
};
export function handleDealsData(receivedData, dealsTableName) {
  console.log('DEALS receivedData:', receivedData);
  console.log('DEALS selectedTableName:', dealsTableName);
  const dealsDataContainer = document.getElementById('dealsDataContainer');
  const dealsData = receivedData;
  const tableName = dealsTableName;

  if (dealsDataContainer && dealsData) {
    // Filter the prodData for specific columns
    let columns = ['TRADE_ID', 'PROD_ID', 'PRICE_BUY', 'TRADE_DATE', 'CATEGORY', 'NOTIONAL'];

    // if (selectedTradeIDs.includes('ALL')) {
    //   filteredDealsData = filterColumnsInData(dealsData, columns);
    //   // console.log('filteredDealsDataALL:', filteredDealsData);
    // } else {
    //   filteredDealsData = filterColumnsInData(
    //     dealsData.filter(dataPoint => selectedTradeIDs.includes(String(dataPoint.TRADE_ID))),
    //     columns
    //   );
    // }

    filteredDealsData = appState.getFilteredData('deals');
    console.log('appState.getDealsData():', filteredDealsData);
    // filteredDealsData = dealsData

    const dealsDataHTML = processData(filteredDealsData, dealsTableName);
    dealsDataContainer.innerHTML = dealsDataHTML;

    // Edit Buttons
    const dealsEditButtons = document.querySelectorAll('#dealsDataContainer .edit-button');
    dealsEditButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        event.stopPropagation(); // Stop event propagation
        //const tableName = dealsTableName;
        const actionType = 'edit';
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);
        handleFormAction(event, filteredDealsData, rowIndex, tableName, actionType);
      });
    });

    // Add Button
    const dealsAddButton = document.getElementById('dealsAddButton');
    dealsAddButton.addEventListener('click', (event) => {
      //const tableName = dealsTableName;
      console.log('tableName:', tableName)
      const actionType = 'add';
      handleFormAction(event, filteredDealsData, null, tableName, actionType);
    });
  }
}

export function handleCreatedPortData(Data, dropdownId) {
//   console.log('createdPortData:', Data);
//   console.log('dropdownId:', dropdownId);
//   const dropdown = document.getElementById(dropdownId); // Use the passed dropdownId

//   // Clear existing options
//  dropdown.innerHTML = '';

//   // Create an empty default option
//   const defaultOption = document.createElement('option');
//   defaultOption.value = ''; // You can set this to any default value
//   defaultOption.text = 'Select a table'; // Display text for the default option
//   dropdown.appendChild(defaultOption);

//   // Populate the dropdown with fetched data
//   Data.forEach(row => {
//     const option = document.createElement('option');
//     option.value = row.table_name; // Assuming the table_name column stores the table names
//     option.text = row.table_name;
//     dropdown.appendChild(option);
//   });
}

