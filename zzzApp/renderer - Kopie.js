import { handleIssuerData } from './r_tab/ISSUER.js';
import { handleProdData } from './PROD.js';
import { handleDealsData, handlecreated_tablesData, dealsAddButtonHandler } from './DEALS.js';
import { handlePortMainData} from './PORT.js';
import { handleIRData } from './IR.js';
import { handleTSData } from './TS.js';
import { handleMVaRData, handleMVarInputData } from './MVaR.js'; 
import { handleEADMainData } from './CVaR.js'; 
import { handleLossIssuerMainData } from './LossIssuer.js'; 




let selectedTradeIDs = ['ALL']; 
let selectedTableName = 'DealsMain';


window.addEventListener('DOMContentLoaded', () => {

  // Function to add options to a dropdown
  function addDropdownOption(dropdown, value, text) {
    const option = document.createElement('option');
    option.value = value;
    option.textContent = text;
    dropdown.appendChild(option);
  }
    // Define the order of ratings
  const ratingOrder = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB', 'BB-', , 'B+', 'B', 'B-', , 'CCC+', 'CCC', 'CCC-'];

  // Custom sorting function for ratings
  function sortRatings(a, b) {
      return ratingOrder.indexOf(a) - ratingOrder.indexOf(b);
  }
  // Function to populate a dropdown with options
  function populateDropdown(dropdownId, data, allText) {
    const dropdown = document.getElementById(dropdownId);
    let uniqueValues = [...new Set(data.map(item => item[dropdownConfig[dropdownId].dataKey]))];

    // Apply custom sorting for ratings
    if (dropdownId === 'ratingDropdown') {
        uniqueValues = uniqueValues.sort(sortRatings);
    } else {
        uniqueValues = uniqueValues.sort();
    }

    dropdown.innerHTML = '';
    addDropdownOption(dropdown, 'ALL', allText);
    uniqueValues.forEach(value => addDropdownOption(dropdown, value, value));
}
  // Function to apply filters to data and update dropdown options
  function applyFiltersAndUpdateDropdowns(receivedData) {
    // Capture current selections
    const currentSelections = {};
    Object.keys(dropdownConfig).forEach(dropdownId => {
      currentSelections[dropdownId] = [...document.getElementById(dropdownId).selectedOptions].map(option => option.value);
    });

    // Apply filters and update dropdowns
    const filteredData = receivedData.filter(item => 
      Object.entries(filtersConfig).every(([key, valueSet]) => 
        valueSet.has('ALL') || valueSet.has(item[key])
      )
    );

    // Repopulate each dropdown and restore selection
    Object.keys(dropdownConfig).forEach(dropdownId => {
      const { dataKey } = dropdownConfig[dropdownId];
      populateDropdown(dropdownId, filteredData, `ALL ${dataKey.toUpperCase()}`);

      // Restore the selection
      const dropdown = document.getElementById(dropdownId);
      dropdown.value = currentSelections[dropdownId].length > 0 ? currentSelections[dropdownId] : ['ALL'];
    });

    return filteredData;
  }
 // Function to apply filters to data and update dropdown options
 function applyProdFiltersAndUpdateDropdowns(receivedData) {
  // Capture current selections
  const currentSelections = {};
  Object.keys(prodDropdownConfig).forEach(dropdownId => {
    currentSelections[dropdownId] = [...document.getElementById(dropdownId).selectedOptions].map(option => option.value);
  });

  // Apply filters and update dropdowns
  const filteredData = receivedData.filter(item => 
    Object.entries(prodFiltersConfig).every(([key, valueSet]) => 
      valueSet.has('ALL') || valueSet.has(item[key])
    )
  );

  // Repopulate each dropdown and restore selection
  Object.keys(prodDropdownConfig).forEach(dropdownId => {
    const { dataKey } = dropdownConfig[dropdownId];
    populateDropdown(dropdownId, filteredData, `ALL ${dataKey.toUpperCase()}`);

    // Restore the selection
    const dropdown = document.getElementById(dropdownId);
    dropdown.value = currentSelections[dropdownId].length > 0 ? currentSelections[dropdownId] : ['ALL'];
  });

  return filteredData;
}
  // EVENT LISTENER
  function setupDropdownListeners(receivedData) {
    Object.keys(dropdownConfig).forEach(dropdownId => {
      const dropdownElement = document.getElementById(dropdownId);
      dropdownElement.addEventListener('change', () => {
        // Update dropdownConfig with the new selection

        
        const newSelection = [...dropdownElement.selectedOptions].map(option => option.value);
        

        dropdownConfig[dropdownId].selection = newSelection;
        console.log(`New Selection for ${dropdownId}:`, newSelection);

        // Update filtersConfig to match dropdownConfig
        const dataKey = dropdownConfig[dropdownId].dataKey;
        filtersConfig[dataKey] = new Set(newSelection.length > 0 ? newSelection : ['ALL']);

        // Apply filters to data, update other dropdowns, and display data
        const filteredData = applyFiltersAndUpdateDropdowns(receivedData);
        handlePortMainData(filteredData, filtersConfig);
      });
    });
  }

  function setupProdDropdownListeners(receivedData) {
    Object.keys(prodDropdownConfig).forEach(dropdownId => {
      const dropdownElement = document.getElementById(dropdownId);
      dropdownElement.addEventListener('change', () => {
        // Update dropdownConfig with the new selection

        
        const newSelection = [...dropdownElement.selectedOptions].map(option => option.value);
        

        dropdownConfig[dropdownId].selection = newSelection;
        console.log(`New Selection for ${dropdownId}:`, newSelection);

        // Update filtersConfig to match dropdownConfig
        const dataKey = dropdownConfig[dropdownId].dataKey;
        filtersConfig[dataKey] = new Set(newSelection.length > 0 ? newSelection : ['ALL']);

        // Apply filters to data, update other dropdowns, and display data
        const filteredData = applyFiltersAndUpdateDropdowns(receivedData);
        handleProdData(filteredData, filtersConfig);
      });
    });
  }
  //ISSUER
  window.api.receive('IssuerData', (receivedData) => {
    handleIssuerData(receivedData);
  });
  //PROD

    const prodFiltersConfig = {
      'ISSUER': new Set(['ALL']),

    };
    const prodDropdownConfig = {
      'issuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },

    };
  window.api.receive('ProdAllData', (receivedData) => {
    
    setupProdDropdownListeners(receivedData);

    // Apply filters and initialize data display
    const initialFilteredData = applyProdFiltersAndUpdateDropdowns(receivedData);
    handleProdData(initialFilteredData, prodFiltersConfig);
  });
  //DEALS

  //verschiedenen PORTFOLIOS im dropdown
  window.api.receive('created_tablesData', handlecreated_tablesData);

  //Fct für dropdown
  function updateTable(selectedTableName, receivedData) {
    console.log('renderer updateTable:', selectedTableName);
    const tradeDropdown = document.getElementById('tradeDropdown');
    const uniqueTradeIDs = [...new Set(receivedData.map((item) => item.TRADE_ID))];

    // Sort uniqueTradeIDs array
    uniqueTradeIDs.sort();
    
    // Clear previous options
    tradeDropdown.innerHTML = '';
    
    // Add the "ALL TRADE_ID" option at the top
    const allTradeOption = document.createElement('option');
    allTradeOption.value = 'ALL';
    allTradeOption.textContent = 'ALL TRADE_ID';
    tradeDropdown.appendChild(allTradeOption);
    
    // Add sorted trade ID options
    uniqueTradeIDs.forEach((tradeID) => {
      const option = document.createElement('option');
      option.value = tradeID;
      option.textContent = tradeID;
      tradeDropdown.appendChild(option);
    });
    
    // Update selectedTradeIDs when the dropdown selection changes
    tradeDropdown.addEventListener('change', () => {
      selectedTradeIDs = [...tradeDropdown.selectedOptions].map(option => option.value);
      handleDealsData(selectedTableName, receivedData, selectedTradeIDs);
      //tradeDropdown.removeEventListener('change', handleDealsData); //--------------------------------------------
      
    });
    
    // Initialize selected trade IDs to include "ALL TRADE_ID"
    selectedTradeIDs = ['ALL'];
    handleDealsData(selectedTableName, receivedData, selectedTradeIDs);    
  };

  // PORTFOLIO made from DEALS
  createdTablesDropdown.addEventListener('change', event => {
    selectedTableName = event.target.value;
    console.log('renderer SelectedTableName:', selectedTableName);
    
    // Update the selected option in the dropdown
    const selectOption = createdTablesDropdown.querySelector(`option[value="${selectedTableName}"]`);
    if (selectOption) {
      selectOption.selected = true;
    }
  
    // Send a message to fetch data for the selected table
    window.api.send('fetch-table-data', selectedTableName);
  
    // Display the data for the selected table
    window.api.receive(selectedTableName + 'Data', (receivedData) => {
      updateTable(selectedTableName, receivedData);
    });
  });
  

  //first loading DEALS 
  window.api.receive(selectedTableName +'Data', (receivedData) => {
    updateTable(selectedTableName +'Data', receivedData);
  });

  // SAVE SELECTION BUTTON
  document.getElementById('saveSelectionButton').addEventListener('click', () => {
    const nameInput = document.getElementById('nameInput');
    const selectionName = 'Deals'+ nameInput.value;
    console.log('selectionName:', selectionName);

    const tagInputField = document.getElementById('tagInputField');
    const tagValues = tagInputField.value.split(',').map(tag => tag.trim());
    console.log('tagValues:', tagValues);

    if (!selectionName || tagValues.length === 0) {
      alert('Please enter a name and select at least one trade ID.');
      return;
    }
    // Send a message to the main process to save the selection
    window.api.send('save-deals-selection', {
      selectionName,
      tagValues,
      selectedTradeIDs
    });

  });

  // DELETE SELECTION BUTTON

  const deleteTableButton = document.getElementById('deleteTableButton');
  deleteTableButton.addEventListener('click', () => {
    if (selectedTableName !== 'Select a table') {
      // Confirm with the user before deleting the table
      const confirmation = window.confirm(`Are you sure you want to delete the table "${selectedTableName}"?`);
      
      if (confirmation) {
        // Send a message to the main process to delete the selected table
        window.api.send('delete-selected-table', selectedTableName);
        
        // Optionally, update the dropdown to show "Select a table" again
        const createdTablesDropdown = document.getElementById('createdTablesDropdown');
        createdTablesDropdown.value = 'Select a table';
      }
    } else {
      // Notify the user to select a table before attempting to delete
      alert('Please select a table to delete.');
    }
  });

  // Remove existing event listener for Add button (if it exists)
  const dealsAddButton = document.getElementById('dealsaddButton');
  dealsAddButton.removeEventListener('click', dealsAddButtonHandler);

    // Add Button
    dealsAddButton.addEventListener('click', (event) => {
      dealsAddButtonHandler(event, selectedTableName);
      console.log('Add Button selectedTableName:', selectedTableName);
      dealsAddButton.removeEventListener('click', dealsAddButtonHandler);
    });
    dealsAddButton.removeEventListener('click', dealsAddButtonHandler);

  //PORT

  const filtersConfig = {
    'ISSUER': new Set(['ALL']),
    'PROD_ID': new Set(['ALL']),
    'CouponType': new Set(['ALL']),
    'CATEGORY': new Set(['ALL']),
    'RATING': new Set(['ALL']),
  };
  const dropdownConfig = {
    'issuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
    'prodIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
    'couponTypeDropdown': { dataKey: 'CouponType', selection: ['ALL'] },
    'categoryDropdown': { dataKey: 'CATEGORY', selection: ['ALL'] },
    'ratingDropdown': { dataKey: 'RATING', selection: ['ALL'] },
  };


  // Event handler for PortMainData
  window.api.receive('PortMainData', (receivedData) => {
    console.log('Received Data:', receivedData);

    // Setup dropdowns
    setupDropdownListeners(receivedData);

    // Apply filters and initialize data display
    const initialFilteredData = applyFiltersAndUpdateDropdowns(receivedData);
    handlePortMainData(initialFilteredData, filtersConfig);



    // Reset button functionality
    const resetButton = document.getElementById('resetFiltersButton');
    resetButton.addEventListener('click', () => {
      Object.keys(dropdownConfig).forEach(dropdownId => {
        // Reset dropdown value
        document.getElementById(dropdownId).value = 'ALL';
        dropdownConfig[dropdownId].selection = ['ALL'];

        // Reset corresponding filter in filtersConfig
        const dataKey = dropdownConfig[dropdownId].dataKey;
        filtersConfig[dataKey].clear();
        filtersConfig[dataKey].add('ALL');
      });

      // Reapply filters and update data display
      const filteredDataAfterReset = applyFiltersAndUpdateDropdowns(receivedData);
      handlePortMainData(filteredDataAfterReset, filtersConfig);
    });
  });



  
  //TS
  window.api.receive('tblTSData', (receivedData) => {
    handleTSData(receivedData);
  });
  //IR
  window.api.receive('EUSWData', (receivedData) => {
    handleIRData(receivedData);
  });
  //MVaR
  window.api.receive('MVaRMainData', handleMVaRData);

  window.api.receive('MVaRInput_2Data', handleMVarInputData);

  // Function to extract edited data from the HTML table
  function extractEditedData() {
    const editedData = [];
  
    const table = document.getElementById('inputMVaR-container');
    const rows = table.querySelectorAll('tr');
  
    for (let i = 1; i < rows.length; i++) { // Skip the header row
      const row = rows[i];
      const cells = row.querySelectorAll('td');
  
      const rowData = {};
  
      for (let j = 0; j < cells.length; j++) {
        const header = table.querySelector('th:nth-child(' + (j + 1) + ')').textContent;
        rowData[header] = cells[j].textContent;
      }
  
      editedData.push(rowData);
    }
  
    return editedData;
  }
  


// Event listener for the "Save" button
const saveButton = document.getElementById('inputMVaRSave-button');

// Define the function to handle the click event
function handleSaveClick() {
  console.log('handleSaveClick called');

  // Extract the edited data from the table
  const editedData = extractEditedData();
  console.log('Edited Data:', editedData);

  // Save the edited data to the SQLite database
  const cleanTableName = 'MVaRInput_2'; // Provide your table name

  // Call the function to save the edited data
  const uniqueIdentifier = {
    column: 'id', // Assuming 'id' is the unique identifier for your data
    value: editedData[0]['id'] // Set this according to your data structure
  };

  // Construct the `newData` object with known column names
  const newData = {
    START: editedData[0]['START'],
    END: editedData[0]['END'],
    VaR_Days: editedData[0]['VaR_Days'],
    Confidence: editedData[0]['Confidence']
  };

  saveEditedData(newData, cleanTableName, uniqueIdentifier);

  // Reattach the event listener for the "Save" button
  saveButton.addEventListener('click', handleSaveClick, { once: true });
}

// Attach the event listener for the "Save" button initially
saveButton.addEventListener('click', handleSaveClick, { once: true });

function saveEditedData(newData, cleanTableName, uniqueIdentifier) {
  console.log('FBH saveChanges tableName:', newData, cleanTableName, uniqueIdentifier);
  
  // Send the update request to the main process
  window.api.send('update-data', { newData, cleanTableName, uniqueIdentifier });
}
  //EAD
  window.api.receive('EADMainData', handleEADMainData);
  //LossIssuer
  window.api.receive('sortedLossesIssuerMainData', handleLossIssuerMainData);

  //EAD and LGD buttons
  const chartButtons = document.querySelectorAll('.chart-button');
  chartButtons.forEach((button) => {
    button.addEventListener('click', () => {
    const chartToShow = button.getAttribute('data-chart');
      const chartContainers = document.querySelectorAll('.chart-container-inner');
      chartContainers.forEach((container) => {
        if (container.id === `${chartToShow}Container`) {
          container.classList.add('active');
        } else {
          container.classList.remove('active');
        }
      });
    });
  }); 



});

//ALL PYTHON PROJECTS:

//Python START:
function handleProjectButtonClick(buttonElement, projectName, selectedTableName) {
  buttonElement.disabled = true;
  buttonElement.textContent = 'Executing...';
  // Send the start event to the main process
  console.log('projectName', projectName);
  window.api.send(`start-${projectName}`, selectedTableName);
}
function handleProjectResponse(buttonElement, projectName, response) {
  console.log('handleProjectResponse', projectName);
  buttonElement.disabled = false;
  buttonElement.textContent = projectName;

  if (response.success) {
    console.log(`${projectName} executed successfully_renderer.`);
  } else {
    console.error(`Error starting ${projectName}:`, response.error);
  }

}
//START: Daten Empfang vom index.html mit <document.getElementById> 

// Py-fairValue project
const fairValueButton = document.getElementById('fairValueButton');
fairValueButton.addEventListener('click', () => {
  handleProjectButtonClick(fairValueButton, 'py-fairValue', selectedTableName);
});
window.api.receive('project-finished', (data) => {
  if (data.projectName === 'py-fairValue') {
    console.log('handleProjectResponse', data);
    handleProjectResponse(fairValueButton, data.projectName, data);
  }
});
// Py-MVaR project
const MVaRButton = document.getElementById('MVaRButton');
MVaRButton.addEventListener('click', () => {
  handleProjectButtonClick(MVaRButton, 'py-MVaR');
});
window.api.receive('project-finished', (data) => {
  if (data.projectName === 'py-MVaR') {
    console.log('handleProjectResponse', data);
    handleProjectResponse(MVaRButton, data.projectName, data);
  }
});
// Py-CVaR project
const CVaRButton = document.getElementById('CVaRButton');
CVaRButton.addEventListener('click', () => {
  handleProjectButtonClick(CVaRButton, 'py-CVaR');
});
window.api.receive('project-finished', (data) => {
  if (data.projectName === 'py-CVaR') {
    console.log('handleProjectResponse', data);
    handleProjectResponse(CVaRButton, data.projectName, data);
  }
});
//Py-dataEXCEL project 
const updateDataExcelButton = document.getElementById('updateDataExcelButton');
updateDataExcelButton.addEventListener('click', () => {
  handleProjectButtonClick(updateDataExcelButton, 'py-excel');
});
window.api.receive('project-finished', (data) => {
  if (data.projectName === 'py-excel') {
    console.log('handleProjectResponse', data);
    handleProjectResponse(updateDataExcelButton, data.projectName, data);
  }
});
//Py-HIST_DATA project
const updateHistoricDataButton = document.getElementById('updateHistoricDataButton');
updateHistoricDataButton.addEventListener('click', () => {
  handleProjectButtonClick(updateHistoricDataButton, 'py-historicData');
});
window.api.receive('project-finished', (data) => {
  if (data.projectName === 'py-historicData') {
    console.log('handleProjectResponse', data);
    handleProjectResponse(updateHistoricDataButton, data.projectName, data);
  }
});

