import processData from '../renderer/dataProcessor.js';
import { handleFormAction } from '../renderer/FormButtonHandler.js';
import { filterColumnsInData } from '../renderer/dataProcessor.js';
import { AppState } from '../AppState.js';

let issuerData;
let filteredIssuerData;


export async function handleIssuerData(receivedData, appState) {
  const issuerDataContainer = document.getElementById('issuerDataContainer');
  issuerData = receivedData;


  let rank;
  try {
    rank = await appState.getRankData();
    console.log('rank', rank);
  } catch (error) {
    console.log('Error retrieving rank data:', error.message);
    console.log('rankData not available yet');
    // Optionally handle the error by setting rank to a default value or returning early
    rank = {}; // Set default rank data or handle as needed
  }
  



  // issuerData  = AppState.filteredData['issuer'];
   console.log('issuerData:', issuerData); 
   //console.log('filtersConfig:', filtersConfig); 
  if (issuerDataContainer && issuerData) {
    let columns = ['ISSUER', 'TICKER', 'RATING'];
    // filteredIssuerData  = issuerData// appState.getFilteredDataForTable(issuerData, 'issuer');
    filteredIssuerData = appState.filteredData['issuer']
    
    // filteredIssuerData  = receivedData;
    // console.log('issuerData:', issuerData);
    
    
    const issuerDataHTML = processData(filteredIssuerData, 'Issuer');
    issuerDataContainer.innerHTML = issuerDataHTML;

    // Edit Buttons
    const issuerEditButtons = document.querySelectorAll('#issuerDataContainer .edit-button');
    issuerEditButtons.forEach((button) => {
      button.addEventListener('click', (event) => {
        console.log('filteredIssuerData:', filteredIssuerData);
        event.stopPropagation(); // Stop event propagation
        const tableName = 'Issuer';
        const actionType = 'edit';
        const rowIndex = parseInt(button.getAttribute('data-row'), 10);

        handleFormAction(event, filteredIssuerData, rowIndex, tableName, actionType);
      });
    });

    // Add Button
    const issueraddButton = document.getElementById('issuerAddButton');
    issueraddButton.addEventListener('click', (event) => {
      const tableName = 'Issuer';
      const actionType = 'add';
      console.log('AddButton')
      handleFormAction(event, issuerData, null, tableName, actionType);
    });
  }

  
}



export { issuerData, filteredIssuerData };


