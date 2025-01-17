import processData from './renderer/dataProcessor.js';
import { handleFormAction } from './renderer/FormButtonHandler.js';
import { appState } from './renderer.js'; 
import { addTooltipsForTruncatedText } from './utils/tooltips.js';
import { ensureRendered } from './utils/domHelpers.js';

let filteredDealsData;
// ADD Button
export function dealsAddButtonHandler (event, selectedTableName) {
  // dealsAddButton.removeEventListener('click', dealsAddButtonHandler);
  const actionType = 'add';
  handleFormAction(event, filteredDealsData, null, selectedTableName, actionType);
};
// export function handleDealsData(receivedData, dealsTableName) {
//   console.log('DEALS receivedData:', receivedData);
//   console.log('DEALS selectedTableName:', dealsTableName);
//   const dealsDataContainer = document.getElementById('dealsDataContainer');
//   const dealsData = receivedData;
//   const tableName = dealsTableName;

//   if (dealsDataContainer && dealsData) {
//     // Filter the prodData for specific columns
//     //let columns = ['TRADE_ID', 'PROD_ID', 'PRICE_BUY', 'TRADE_DATE', 'CATEGORY', 'NOTIONAL'];

//     // if (selectedTradeIDs.includes('ALL')) {
//     //   filteredDealsData = filterColumnsInData(dealsData, columns);
//     //   // console.log('filteredDealsDataALL:', filteredDealsData);
//     // } else {
//     //   filteredDealsData = filterColumnsInData(
//     //     dealsData.filter(dataPoint => selectedTradeIDs.includes(String(dataPoint.TRADE_ID))),
//     //     columns
//     //   );
//     // }

//     filteredDealsData = appState.getFilteredData('deals');
//     console.log('appState.getDealsData():', filteredDealsData);
//     // filteredDealsData = dealsData

//     const dealsDataHTML = processData(filteredDealsData, dealsTableName);

    
//     dealsDataContainer.innerHTML = dealsDataHTML; // Render HTML first
//     // Ensure DOM rendering before processing
//     ensureRendered(() => {
//       addTooltipsForTruncatedText(dealsDataContainer);

// // Edit Button

//     const dealsEditButtons = document.querySelectorAll('#dealsDataContainer .edit-button'); // Now query the buttons
//     dealsEditButtons.forEach((button) => {
//       button.addEventListener('click', (event) => {
//         event.stopPropagation(); 
//         const actionType = 'edit';
//         const rowIndex = parseInt(button.getAttribute('data-row'), 10);
//         handleFormAction(event, filteredDealsData, rowIndex, tableName, actionType);
//       });
//     });
    

//     // Add Button
//     const dealsAddButton = document.getElementById('dealsAddButton');
//     dealsAddButton.addEventListener('click', (event) => {
//       //const tableName = dealsTableName;
//       console.log('tableName:', tableName)
//       const actionType = 'add';
//       handleFormAction(event, filteredDealsData, null, tableName, actionType);
//     });
//   });
//   }
  
// }

export function handleDealsData(receivedData, dealsTableName) {
  //console.log('DEALS receivedData:', receivedData);
  //console.log('DEALS selectedTableName:', dealsTableName);

  const dealsDataContainer = document.getElementById('dealsDataContainer');
  const dealsData = receivedData;
  const tableName = dealsTableName;

  if (dealsDataContainer && dealsData) {
    const filteredDealsData = appState.getFilteredData('deals');
    //console.log('appState.getDealsData():', filteredDealsData);

    const dealsDataHTML = processData(filteredDealsData, dealsTableName);

    dealsDataContainer.innerHTML = dealsDataHTML; // Render HTML first
    //console.log('Deals Data Container HTML:', dealsDataContainer.innerHTML);


    // Ensure DOM rendering before processing
    ensureRendered(() => {
      addTooltipsForTruncatedText(dealsDataContainer);

      // Fetch product data from appState
      const prodAllData = appState.getProdData();
      //console.log('prodAllData:', prodAllData);
          if (!prodAllData || prodAllData.length === 0) {
            console.error('prodAllData is empty or undefined!');
            return; // Exit the function early to prevent errors
          }


      // Add Tooltips for PROD_ID
      const prodIdElements = dealsDataContainer.querySelectorAll('tr > td:nth-child(3)');

      prodIdElements.forEach((element) => {
        const prodId = element.textContent.trim();
      
        // Find matching product in prodAllData
        const productDetails = prodAllData.find((prod) => prod.PROD_ID === prodId);
      
        if (productDetails) {
          const tooltipContent = `
            Product ID: ${productDetails.PROD_ID || 'N/A'}\n
            Description: ${productDetails.DESCRIPTION || 'N/A'}\n
            Coupon Type: ${productDetails.CouponType || 'N/A'}\n
            Maturity: ${productDetails.MATURITY || 'N/A'}\n
            Issuer: ${productDetails.ISSUER || 'N/A'}\n
            Rank: ${productDetails.RANK || 'N/A'}\n
            Rating: ${productDetails.RATING_PROD || 'N/A'}\n
            
          `;
      
          element.setAttribute('title', tooltipContent);
      
          //console.log('Found product details:', productDetails);
        } else {
          console.warn(`No details found for PROD_ID: ${prodId}`);
        }
      });
      
      

      // Edit Button
      const dealsEditButtons = document.querySelectorAll('#dealsDataContainer .edit-button'); // Now query the buttons
      dealsEditButtons.forEach((button) => {
        button.addEventListener('click', (event) => {
          event.stopPropagation();
          const actionType = 'edit';
          const rowIndex = parseInt(button.getAttribute('data-row'), 10);
          handleFormAction(event, filteredDealsData, rowIndex, tableName, actionType);
        });
      });

      // Add Button
      const dealsAddButton = document.getElementById('dealsAddButton');
      dealsAddButton.addEventListener('click', (event) => {
        const actionType = 'add';
        handleFormAction(event, filteredDealsData, null, tableName, actionType);
      });
    });
  }
}
