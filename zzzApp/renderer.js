import { handleIssuerData } from './r_tab/ISSUER.js';
import { handleProdData } from './PROD.js';
import { handleDealsData, handlecreated_tablesData, dealsAddButtonHandler } from './DEALS.js';
import { handlePortMainData, handlePortMainFilteredData, PortValue, PortNotional, PortPV01, formPortValue, formPortNotional, formPortPV01, formFiltPortValue, formFiltPortNotional, formFiltPortPV01} from './PORT.js';
import { handleIRData } from './IR.js';
import { handleTSData } from './TS.js';
import { handleMVaRData, handleMVarInputData, updateMVaRChart } from './MVaR.js'; 
import { handleEADMainData } from './CVaR.js'; 
import { handleLossIssuerMainData } from './LossIssuer.js'; 
import {createCSLineChart} from './charts/LineChart.js';


let selectedTradeIDs = ['ALL']; 
let selectedTableName = 'DealsMain';
let currentActiveTable = 'PortMain'; // Default to 'port' or set based on the initial display
let currentReceivedData = null;

let filteredData = null;



window.addEventListener('DOMContentLoaded', () => {

  //Filters and Dropdown for tables
  const prodFiltersConfig = {
    'ISSUER': new Set(['ALL']),
    'PROD_ID': new Set(['ALL']),
    'CouponType': new Set(['ALL']),
    'RATING_PROD': new Set(['ALL']),
    'MATURITY': new Set(['ALL']),
    'RANK': new Set(['ALL']),
  };
  const prodDropdownConfig = {
    'prodIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
    'prodProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
    'prodCouponTypeDropdown': { dataKey: 'CouponType', selection: ['ALL'] },
    'prodRatingProdDropdown': { dataKey: 'RATING_PROD', selection: ['ALL'] },
    'prodMaturityDropdown': { dataKey: 'MATURITY', selection: ['ALL'] },
    'prodRankDropdown': { dataKey: 'RANK', selection: ['ALL'] },
  };
  const issuerFiltersConfig = {
    'ISSUER': new Set(['ALL']),
    'RATING': new Set(['ALL']),

  };
  const issuerDropdownConfig = {
    'issuerIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
    'issuerRatingDropdown': { dataKey: 'RATING', selection: ['ALL'] },
  };
  const portFiltersConfig = {
    'ISSUER': new Set(['ALL']),
    'PROD_ID': new Set(['ALL']),
    'CouponType': new Set(['ALL']),
    'CATEGORY': new Set(['ALL']),
    'RATING': new Set(['ALL']),
    'MATURITY': new Set(['ALL']),
  };
  const portDropdownConfig = {
    'portIssuerDropdown': { dataKey: 'ISSUER', selection: ['ALL'] },
    'portProdIdDropdown': { dataKey: 'PROD_ID', selection: ['ALL'] },
    'portCouponTypeDropdown': { dataKey: 'CouponType', selection: ['ALL'] },
    'portCategoryDropdown': { dataKey: 'CATEGORY', selection: ['ALL'] },
    'portRatingDropdown': { dataKey: 'RATING', selection: ['ALL'] },
    'portMaturityDropdown': { dataKey: 'MATURITY', selection: ['ALL'] },
  };
  const tabToTableNameMapping = {
    'ISSUER_Tab': 'issuer',
    'PROD_Tab': 'prod',
    'DEALS_Tab': 'deals',
    'PORT_Tab': 'port',
    'IR_Tab': 'ir',
    'TS_Tab': 'ts',
    'MVaR_Tab': 'mvar',
    'CVaR_Tab': 'cvar',
    'DATA_Tab': 'data'
};

  //tables Config from Filters and Dropdown
  const tableConfigs = {
    port: {
      dropdownConfig: portDropdownConfig,
      filtersConfig: portFiltersConfig,
      dataHandler: handlePortMainFilteredData,
    },
    prod: {
      dropdownConfig: prodDropdownConfig,
      filtersConfig: prodFiltersConfig,
      dataHandler: handleProdData,
    },
    issuer: {
      dropdownConfig: issuerDropdownConfig,
      filtersConfig: issuerFiltersConfig,
      dataHandler: handleIssuerData,
    },
    //Add more tables here
  };

  function getTableNameFromTabId(tabId) {
    return tabToTableNameMapping[tabId] || null;
}
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

  function sortDates(a, b) {
    // Convert dates from "day-month-year" to "year-month-day"
    const datePartsA = a.split('-');
    const datePartsB = b.split('-');
    const formattedDateA = new Date(`${datePartsA[2]}-${datePartsA[1]}-${datePartsA[0]}`);
    const formattedDateB = new Date(`${datePartsB[2]}-${datePartsB[1]}-${datePartsB[0]}`);

    return formattedDateA - formattedDateB;
  }
  
  // Function to populate a dropdown with options
  function populateDropdown(dropdownId, data, allText, tableType) {
    const config = tableConfigs[tableType].dropdownConfig;
    const dropdown = document.getElementById(dropdownId);
    let uniqueValues = [...new Set(data.map(item => item[config[dropdownId].dataKey]))];

    // Sort unique values based on dropdown ID
    if (dropdownId === 'prodRatingDropdown'|| dropdownId === 'portRatingDropdown'|| dropdownId === 'issuerRatingDropdown') {
        uniqueValues = uniqueValues.sort(sortRatings);
    } else if (dropdownId === 'prodMaturityDropdown' || dropdownId === 'portMaturityDropdown') {
        uniqueValues = uniqueValues.sort(sortDates);
    } else {
        uniqueValues = uniqueValues.sort();
    }

    // Check if the dropdown needs to be repopulated
    const currentOptions = [...dropdown.options].map(option => option.value);
    if (!arraysEqual(currentOptions, ['ALL', ...uniqueValues])) {
        dropdown.innerHTML = '';
        addDropdownOption(dropdown, 'ALL', allText);
        uniqueValues.forEach(value => addDropdownOption(dropdown, value, value));
    }
  }

  // Helper function to check if two arrays are equal
  function arraysEqual(arr1, arr2) {
      if (arr1.length !== arr2.length) return false;
      for (let i = 0; i < arr1.length; i++) {
          if (arr1[i] !== arr2[i]) return false;
      }
      return true;
  }

  // Function to apply filters to data and update dropdown options
  function applyFiltersAndUpdateDropdowns(receivedData, tableType) {
    console.log("receivedData:", receivedData);
    console.log("tableType:", tableType);
    const config = tableConfigs[tableType];

    // Store current selections
    const currentSelections = {};
    Object.keys(config.dropdownConfig).forEach(dropdownId => {
        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            let selections = [...dropdown.selectedOptions].map(option => option.value);
            currentSelections[dropdownId] = selections;
        }
    });

    // Filter the data based on the current selections
    filteredData = receivedData.filter(item => 
        Object.entries(config.filtersConfig).every(([key, valueSet]) => 
            valueSet.has('ALL') || valueSet.has(item[key])
        )
    );

    // Repopulate dropdowns with the filtered data and restore the previous selections
    Object.keys(config.dropdownConfig).forEach(dropdownId => {
        const { dataKey } = config.dropdownConfig[dropdownId];
        populateDropdown(dropdownId, filteredData, `ALL ${dataKey.toUpperCase()}`, tableType);

        const dropdown = document.getElementById(dropdownId);
        if (dropdown) {
            const dropdownOptions = dropdown.options;
            for (let i = 0; i < dropdownOptions.length; i++) {
                const optionValue = dropdownOptions[i].value;
                dropdownOptions[i].selected = currentSelections[dropdownId].includes(optionValue);
            }
            // Special handling for 'ALL' selection
            if (dropdown.multiple && currentSelections[dropdownId].includes('ALL') && dropdownOptions.length > 1) {
                dropdownOptions[0].selected = false; // Deselect 'ALL' if other options are also selected
            }
        }
    });
    currentReceivedData = filteredData;
    return filteredData;
}







  
  // EVENT LISTENER
  function setupDropdownListeners(receivedData, type) {
    const config = tableConfigs[type];

    Object.keys(config.dropdownConfig).forEach(dropdownId => {
        const dropdownElement = document.getElementById(dropdownId);
        if (dropdownElement) {
            const dropdownChangeListener = createDropdownChangeListener(dropdownElement, config, receivedData, type);
            dropdownElement.addEventListener('change', dropdownChangeListener);
        }
    });
}



let isControlKeyPressed = false;

document.addEventListener('keydown', (e) => {
    if (e.key === 'Control') {
        isControlKeyPressed = true;
    }
});

// In your renderer.js or any other external JS file
document.addEventListener('keyup', (e) => {
  if (e.key === 'Control') {
      isControlKeyPressed = false;
      // Access the current active tab ID through the window object
      const tabId = window.currentActiveTabId;
      const tableName = getTableNameFromTabId(tabId);
      console.log('currentActiveTable:', tableName);
      updateDisplayAfterSelection(tableName);
  }
});



function updateDisplayAfterSelection(currentActiveTable) {
  // Assuming 'currentActiveTable' and 'currentReceivedData' are defined and hold the current table type and data respectively
  if (currentActiveTable && currentReceivedData) {
      // Apply the filters and get the filtered data
      console.log('currentActiveTable:', currentActiveTable);
      const filteredData = applyFiltersAndUpdateDropdowns(currentReceivedData, currentActiveTable);

      // Assuming you have a function in your configuration to handle the display update
      const config = tableConfigs[currentActiveTable];
      if (config && config.dataHandler) {
          config.dataHandler(filteredData, config.filtersConfig);
      }
  }
}


function createDropdownChangeListener(dropdownElement, config, receivedData, type) {
    return function(event) {
        event.stopPropagation();
        const newSelection = [...dropdownElement.selectedOptions].map(option => option.value);
        console.log('New Selection:', newSelection);

        config.dropdownConfig[dropdownElement.id].selection = newSelection;
        config.filtersConfig[config.dropdownConfig[dropdownElement.id].dataKey] = new Set(newSelection);

        // Apply filters and update only if the Control key is not pressed
        if (!isControlKeyPressed) {
            const filteredData = applyFiltersAndUpdateDropdowns(receivedData, type);
            config.dataHandler(filteredData, config.filtersConfig);
            currentReceivedData = filteredData;
        }
    };
}


function resetFiltersForActiveTable(receivedData, currentActiveTable) {
  const activeConfig = tableConfigs[currentActiveTable];
  console.log('resetFiltersForActiveTable, tableName:', currentActiveTable);

  Object.keys(activeConfig.dropdownConfig).forEach(dropdownId => {
      const dropdown = document.getElementById(dropdownId);
      if (dropdown && dropdown.multiple) { // Check if it's a multi-select dropdown
          // Deselect all options
          [...dropdown.options].forEach(option => option.selected = false);
          // Select 'ALL' option if it exists
          const allOption = [...dropdown.options].find(option => option.value === 'ALL');
          if (allOption) allOption.selected = true;
      } else if (dropdown) {
          dropdown.value = 'ALL'; // For single-select dropdowns
      }

      // Reset filter configuration
      const dataKey = activeConfig.dropdownConfig[dropdownId].dataKey;
      activeConfig.filtersConfig[dataKey].clear();
      activeConfig.filtersConfig[dataKey].add('ALL');
  });

  const filteredDataAfterReset = applyFiltersAndUpdateDropdowns(receivedData, currentActiveTable);
  activeConfig.dataHandler(filteredDataAfterReset, activeConfig.filtersConfig);
}

  
  //ISSUER
  window.api.receive('IssuerData', (receivedData) => {
    //handleIssuerData(receivedData);
    currentActiveTable = 'issuer';
    setupDropdownListeners(receivedData, currentActiveTable);
    const initialFilteredData = applyFiltersAndUpdateDropdowns(receivedData, currentActiveTable);
    tableConfigs[currentActiveTable].dataHandler(initialFilteredData, tableConfigs[currentActiveTable].filtersConfig);
  
    const prodResetButton = document.getElementById('issuerResetFiltersButton');

    if (prodResetButton) {
      prodResetButton.addEventListener('click', () => resetFiltersForActiveTable(receivedData, 'issuer'));
    }
  });
    
// Assuming you have already imported the createCSLineChart function and defined chartData and chartOptions

window.api.receive('CSMatrixData', (receivedData) => {
  console.log('Received Data:', receivedData);

  const ratings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB'];

  const dataArrayWithRating = receivedData.map((data, index) => ({
    RATING: ratings[index],
    ...data,
  }));
  
  console.log(dataArrayWithRating);

  // Extract and format the numerical data from the numeric keys (1 to 30)
  const dataArray = dataArrayWithRating.map(obj => {
    return Object.keys(obj)
      .filter(key => key !== 'RATING')
      .map(key => obj[key]); // Divide by 100 to scale the data
  });

  // Extract the column names (years) as labels
  const years = Object.keys(dataArrayWithRating[0]).filter(key => key !== 'RATING');

  // Define fixed colors for the lines
  const lineColors = [
    'rgba(75, 192, 192, 1)',
    'rgba(255, 99, 132, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(255, 159, 64, 1)',
    'rgba(255, 0, 0, 1)',
    'rgba(0, 255, 0, 1)',
    'rgba(0, 0, 255, 1)',
    'rgba(128, 0, 128, 1)',
    'rgba(255, 165, 0, 1)',
    'rgba(0, 128, 128, 1)',
    'rgba(128, 128, 0, 1)',
    // Add more colors as needed
  ];

  // Define chart data and options
  const chartData = {
    labels: years, // Use the years as x-axis labels
    datasets: ratings.map((rating, index) => ({
      label: rating,
      data: dataArray[index], // Use the corresponding data for each rating
      borderColor: lineColors[index], // Assign a fixed color to each line
      borderWidth: 1, // Set the line width to 1 (slim)
      fill: false,
      hidden: rating !== 'AAA', // Hide all curves except for 'AAA'
    })),
  };
  

  const chartOptions = {
    plugins: {
      title: {
        display: true,
        text: 'Credit Spreads in Basis Points', // Your desired label
        fontSize: 16,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
      },
      y: {
        suggestedMin: 0,  // Set the minimum y-axis value
        suggestedMax: 30, // Set the maximum y-axis value
      },
    },
  };
  
  
  // Call the createCSLineChart function with the chartData and chartOptions
  createCSLineChart(chartData, chartOptions);
});



  
  //PROD
  window.api.receive('ProdAllData', (receivedData) => {
    currentActiveTable = 'prod';
    setupDropdownListeners(receivedData, currentActiveTable);
    const initialFilteredData = applyFiltersAndUpdateDropdowns(receivedData, currentActiveTable);
    tableConfigs[currentActiveTable].dataHandler(initialFilteredData, tableConfigs[currentActiveTable].filtersConfig);
  
    const prodResetButton = document.getElementById('prodResetFiltersButton');

    if (prodResetButton) {
      prodResetButton.addEventListener('click', () => resetFiltersForActiveTable(receivedData, 'prod'));
    }
  });

  //DEALS

  //verschiedenen PORTFOLIOS im dropdown
  window.api.receive('created_tablesData', handlecreated_tablesData);

  //Fct für dropdown
  function updateTable(selectedTableName, receivedData) {
    console.log('renderer updateTable:', selectedTableName, receivedData);
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

  // CREATE PORTFOLIO made from DEALS
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



  
  window.api.receive('PortMainData', (receivedData) => {
    console.log('Received Data:', receivedData);
    //currentReceivedData = receivedData; 
    handlePortMainData(receivedData);

    document.getElementById('formPortValue').textContent = formPortValue;
    document.getElementById('formPortNotional').textContent = formPortNotional;
    document.getElementById('formPortPV01').textContent = -formPortPV01;

    console.log('formPortValue:', formPortValue);
    console.log('formPortNotional:', formPortNotional);
    console.log('formPortPV01:', formPortPV01);


      // Update current active table
      currentActiveTable = 'port';

      



    // Setup dropdowns
    setupDropdownListeners(receivedData, currentActiveTable);

    // Apply filters and initialize data display
    const initialFilteredData = applyFiltersAndUpdateDropdowns(receivedData, currentActiveTable);
    tableConfigs[currentActiveTable].dataHandler(initialFilteredData, tableConfigs[currentActiveTable].filtersConfig);

    // currentReceivedData = initialFilteredData
    // console.log('currentReceivedData:', currentReceivedData);
    const portResetButton = document.getElementById('portResetFiltersButton');

    if (portResetButton) {
      portResetButton.addEventListener('click', () => resetFiltersForActiveTable(receivedData, 'port'));

    }
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
  window.api.receive('MVaRMainData', (receivedData) => {
    const MVaRTable = handleMVaRData(receivedData);
    // Update MVaR Data Container
    const MVaRDataContainer = document.getElementById('MVaRDataContainer');
    if (MVaRDataContainer) {
      MVaRDataContainer.innerHTML = '';
      MVaRDataContainer.appendChild(MVaRTable);
    }
    // Update Port MVaR Data Container (or any other container)
    const portMVaRDataContainer = document.getElementById('portMVaRDataContainer');
    if (portMVaRDataContainer) {
      portMVaRDataContainer.innerHTML = '';
      portMVaRDataContainer.appendChild(MVaRTable.cloneNode(true)); // Clone the table if needed elsewhere
    }
    updateMVaRChart(receivedData); // Updates the chart with the same data
  });
  
  //MVaRInput_2 ist nur die transponierte form von MVaRInput
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

