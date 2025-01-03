

import { formPortValue, formPortNotional, formFiltPortNotional, formPortYield, formPortYieldA, formPortPV01, formPortCPV01 } from './PORT.js';
import { handleTSData } from './TS.js';
import { handleMVaRData, handleMVarInputData, updateMVaRChart } from './MVaR.js'; 
import { handleLossIssuerMainData, setupLossIssuerUI } from './LossIssuer.js'; 
import { AppState } from './AppState.js';


let selectedTableName = 'DealsMain';
let appState;
let selectedDealsTableName;
let currentActiveTable = 'PortMain'; // Default to 'port' or set based on the initial display




document.addEventListener('DOMContentLoaded', () => {
  appState = new AppState();
  window.appState = appState;




  // CreatedDealsData:
  window.api.receive('createdDealsData', (receivedData) => {
    try {
      console.log('Received createdDealsData:', receivedData);
     
      appState.setCreatedDealsData(receivedData, 'createdDealsDropdown');
      appState.applyFiltersAndUpdateDropdowns('dealsTables');
    
    } catch (error) {
      console.error("Error processing created tables data:", error);
    }
  });

  // CreatedPortData:
  window.api.receive('createdPortData', (receivedData) => {
    try {
      appState.setCreatedPortData(receivedData, 'createdPortDropdown');
      console.log('createdPortData:', appState.getCreatedPortData());

      

      appState.setCreatedPortData2(receivedData, 'createdPortDropdown2');
      console.log('createdPortData2:', appState.getCreatedPortData2());
      appState.applyFiltersAndUpdateDropdowns('portTables');
      //appState.applyFiltersAndUpdateDropdowns('portTables2');

    } catch (error) {
      console.error("Error processing created tables data:", error);
    }
  });

    // // CreatedPortData2:
    // window.api.receive('createdPortData', (receivedData) => {
    //   try {
    //     appState.setCreatedPortData2(receivedData, 'createdPortDropdown2');
    //     console.log('createdPortData2:', appState.getCreatedPortData2());
  
    //     appState.applyFiltersAndUpdateDropdowns('portTables');
  
    //   } catch (error) {
    //     console.error("Error processing created tables data:", error);
    //   }
    // });


  // DealsDropdown component
  let createdDealsDropdown = document.getElementById('createdDealsDropdown');
  if (createdDealsDropdown) {
    createdDealsDropdown.addEventListener('change', event => {
      const selectedDealsTableName = event.target.value;
      console.log('selectedDealsTableName:', selectedDealsTableName);
      appState.setSelectedDealsTableName(selectedDealsTableName);
      // Update the dropdown options
      appState.updateDropdownOptions({
        dropdownElementId: 'createdDealsDropdown',
        getDataFunction: appState.getCreatedDealsData.bind(appState),
        updateDataFunction: appState.updateDealsDataTable.bind(appState),
        selectedTableName: selectedDealsTableName,
      });
    });
  }

  // PortDropdown component
  let createdPortDropdown = document.getElementById('createdPortDropdown');
  if (createdPortDropdown) {
    createdPortDropdown.addEventListener('change', event => {
      const selectedPortTableName = event.target.value;
      console.log('selectedPortTableName:', selectedPortTableName);
      appState.setSelectedPortTableName(selectedPortTableName);
    // Update the dropdown options
      appState.updateDropdownOptions({
        dropdownElementId: 'createdPortDropdown',
        getDataFunction: appState.getCreatedPortData.bind(appState),
        updateDataFunction: appState.updatePortDataTable.bind(appState),
        selectedTableName: selectedPortTableName,
      });
    });
  }
  // PortDropdown2 component
   let createdPortDropdown2 = document.getElementById('createdPortDropdown2');
  if (createdPortDropdown) {
    createdPortDropdown2.addEventListener('change', event => {
      const SelectedPortTableName2 = event.target.value;
      console.log('selectedPortTableName2:', SelectedPortTableName2);
      appState.setSelectedPortTableName2(SelectedPortTableName2);
    // Update the dropdown options
      appState.updateDropdownOptions({
        dropdownElementId: 'createdPortDropdown2',
        getDataFunction: appState.getCreatedPortData2.bind(appState),
        updateDataFunction: appState.updatePortDataTable2.bind(appState),
        selectedTableName: SelectedPortTableName2,
      });
    });
  }

  // CSMatrix:
  window.api.receive('CSMatrixData', (receivedData) => {
    console.log('CSMatrixData', receivedData);
    appState.handleCSMatrixData(receivedData);
  });

  // CSParameter:
  window.api.receive('CSParameterData', (receivedData) => {
    appState.handleCSParameterData(receivedData);
  });

  // Rank:
  window.api.receive('RankData', (receivedData) => {
    console.log('RankData', receivedData);
    appState.setRankData(receivedData)
    console.log('RankData set in appState', appState.getRankData());
    // appState.handleCSParameterData(receivedData);
  });

  // ISSUER:
  window.api.receive('IssuerData', (receivedData) => {
    console.log('IssuerData', receivedData);
    appState.setActiveTable('issuer');
    appState.setIssuerData(receivedData)
    appState.applyFiltersAndUpdateDropdowns('issuer');
    appState.tableConfigs[appState.currentActiveTable];

    const issuerResetButton = document.getElementById('issuerResetFiltersButton');

    if (issuerResetButton) {
      issuerResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'issuer'));
    }

  });


  // PROD:
  window.api.receive('ProdAllData', (receivedData) => {
    console.log('ProdAllData', receivedData);

    appState.setActiveTable('prod');
    appState.setProdData(receivedData)
    appState.applyFiltersAndUpdateDropdowns('prod');
    appState.tableConfigs[appState.currentActiveTable];

    const prodResetButton = document.getElementById('prodResetFiltersButton');

    if (prodResetButton) {
      prodResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'prod'));
    }
    
  // DEALS:
  window.api.receive('DealsMainData', (receivedData) => {
    console.log('DealsMain', receivedData);

    appState.setActiveTable('deals');
    appState.setDealsData(receivedData)
    appState.applyFiltersAndUpdateDropdowns('deals');
    appState.tableConfigs[appState.currentActiveTable];


  });


  // Save selection button
  document.getElementById('saveSelectionButton').addEventListener('click', () => {
    console.log('saveSelectionButton');
    const nameInputValue = document.getElementById('nameInput').value;
    const selectionName = 'Deals' + nameInputValue;
    const tagValues = document.getElementById('tagInputField').value.split(',').map(tag => tag.trim());

    console.log('nameInputValue, selectionName, tagValues:', nameInputValue, selectionName, tagValues);

    if (!selectionName || tagValues.length === 0) {
      alert('Please enter a name and select at least one trade ID.');
      return;
    }

    // Send a message to the main process to save the selection
    const filteredData = appState.getFilteredData('deals'); // Assuming 'deals' is the table type
    const selectedTradeIDs = filteredData.map(entry => entry.TRADE_ID);

    console.log('selectedTradeIDs:', selectedTradeIDs);
    window.api.send('save-deals-selection', {
      selectionName,
      tagValues,
      selectedTradeIDs
    });

    // Show success message
    alert(`Portfolio "${selectionName}"successfully created`);

    // Update the available portfolios in the app state
    const newPortfolio = { table_name: selectionName }; // Assuming the portfolio object structure
    appState.setCreatedDealsData([...appState.getCreatedDealsData(), newPortfolio]);

    // Update the dropdown options
    updateDealsDropdownOptions(selectionName);
  });

  // Delete selection button
  document.getElementById('deleteTableButton').addEventListener('click', () => {
    const selectedTableName = appState.getSelectedDealsTableName();
    if (selectedTableName !== 'Select a table') {
      // Confirm with the user before deleting the table
      const confirmation = window.confirm(`Are you sure you want to delete the table "${selectedTableName}"?`);
      
      if (confirmation) {
        // Send a message to the main process to delete the selected table
        window.api.send('delete-selected-table', selectedTableName);

        // Update appState to exclude the deleted portfolio
        const portfolios = appState.getCreatedDealsData().filter(portfolio => portfolio.table_name !== selectedTableName);

        appState.setCreatedDealsData(portfolios);

        // Update the dropdown options after deletion
        updateDealsDropdownOptions();
      }
    } else {
      // Notify the user to select a table before attempting to delete
      alert('Please select a table to delete.');
    }
  });


  });

  //COMP
  // window.api.receive('PortMainData', (receivedData) => {
  //   console.log('receivedData:', receivedData );
  //   appState.setActiveTable('comp');
  //   appState.setPortData(receivedData)
  //   appState.applyFiltersAndUpdateDropdowns('comp');
  //   appState.tableConfigs[appState.currentActiveTable];

    
    // appState.setPortData(receivedData)

    // document.getElementById('formPortValue').textContent = formPortValue;
    // document.getElementById('formPortNotional1').textContent = formFiltPortNotional;
    // document.getElementById('formPortYield').textContent = formPortYield;
    // document.getElementById('formPortYieldA').textContent = formPortYieldA;
    // document.getElementById('formPortPV01').textContent = formPortPV01;
    // document.getElementById('formPortCPV01').textContent = formPortCPV01;

  // const portResetButton = document.getElementById('portResetFiltersButton');

  //   if (portResetButton) {
  //     portResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'port'));
  //   }

  // //IRSENS
  //   const IRSensTable = appState.handleIRSensData(receivedData);

  //   // Update IRSens Data Container
  //   const IRSensDataContainer = document.getElementById('IRSensDataContainer');
  //   if (IRSensDataContainer) {
  //     IRSensDataContainer.innerHTML = ''; // Clear existing contents
  //     IRSensDataContainer.appendChild(IRSensTable); // Append the new table
  //   }

  // //CSSENS
  //   const CSSensTable = appState.handleCSSensData(receivedData);

  //   // Update CSSens Data Container
  //   const CSSensDataContainer = document.getElementById('CSSensDataContainer');
  //   if (CSSensDataContainer) {
  //     CSSensDataContainer.innerHTML = ''; // Clear existing contents
  //     CSSensDataContainer.appendChild(CSSensTable); // Append the new table
  //   }
  // });
  
  //TS
  window.api.receive('tblTSData', (receivedData) => {
    handleTSData(receivedData);
  });
  //IR
  window.api.receive('EUSWData', (receivedData) => {
    appState.handleIRData(receivedData);
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
  window.api.receive('EADMainData', appState.handleEADMainData);

  //CVaR (Verbindung zur DB und den tabellen via main.js)
  window.api.receive('sortedLossesMainData', appState.handleCVaRData);

  //LossIssuer
  window.api.receive('sortedLossesIssuerMainData', handleLossIssuerMainData);

  //setupLossIssuerUI();

  setTimeout(() => {
    setupLossIssuerUI(); // Call your function after a delay
  }, 1000); // Wait for 3 seconds

});


//ALL PYTHON PROJECTS:

//Python general START:
function handleProjectButtonClick(buttonElement, projectName) {
  buttonElement.disabled = true;
  buttonElement.textContent = 'Executing...';

  selectedDealsTableName = appState.getSelectedDealsTableName();



  // Send the start event to the main process
   console.log('projectName', projectName);
   console.log('selectedTableName', selectedDealsTableName);
  window.api.send(`start-${projectName}`, selectedDealsTableName);
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
// Python-PROJECTS:

// Py-fairValue project
const fairValueButton = document.getElementById('fairValueButton');
fairValueButton.addEventListener('click', () => {
  handleProjectButtonClick(fairValueButton, 'py-fairValue', selectedTableName);
});
window.api.receive('py-fairValue-complete', (data) => {
  if (data.projectName === 'py-fairValue') {
    console.log('handleProjectResponse', data);

    // const Name = appState.getSelectedPortTableName();
    const Name1 = appState.getSelectedDealsTableName();
    const Name = Name1.replace('Deals', 'Port');
    console.log('selectedPortTableName', Name);
    window.api.receive(Name + 'Data', (receivedData) => {
      // console.log('selectedTableName:', selectedTableName );
      //es müssen die deals neu gesetzt werden. Das stimmt so!
      appState.updatePortDataTable(receivedData);
      appState.handlePortMainData(receivedData);
      appState.applyFiltersAndUpdateDropdowns('port');
      // appState.setPortData(receivedData)

      document.getElementById('formPortValue').textContent = formPortValue;
      document.getElementById('formPortNotional').textContent = formPortNotional;
      document.getElementById('formPortYield').textContent = formPortYield;
      document.getElementById('formPortYieldA').textContent = formPortYieldA;
      document.getElementById('formPortPV01').textContent = formPortPV01;
      document.getElementById('formPortCPV01').textContent = formPortCPV01;

      const portResetButton = document.getElementById('portResetFiltersButton');

        if (portResetButton) {
          portResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'port'));
        }

    //IRSENS
      const IRSensTable = appState.handleIRSensData(receivedData);

      // Update IRSens Data Container
      const IRSensDataContainer = document.getElementById('IRSensDataContainer');
      if (IRSensDataContainer) {
        IRSensDataContainer.innerHTML = ''; // Clear existing contents
        IRSensDataContainer.appendChild(IRSensTable); // Append the new table
      }

    //CSSENS
      const CSSensTable = appState.handleCSSensData(receivedData);

      // Update CSSens Data Container
      const CSSensDataContainer = document.getElementById('CSSensDataContainer');
      if (CSSensDataContainer) {
        CSSensDataContainer.innerHTML = ''; // Clear existing contents
        CSSensDataContainer.appendChild(CSSensTable); // Append the new table
      }
    });
    
    handleProjectResponse(fairValueButton, data.projectName, data);
  }
});

// Py-MVaR project
const MVaRButton = document.getElementById('MVaRButton');
MVaRButton.addEventListener('click', () => {
  handleProjectButtonClick(MVaRButton, 'py-MVaR', selectedTableName);
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
  handleProjectButtonClick(CVaRButton, 'py-CVaR', selectedTableName);
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
    //console.log('handleProjectResponse', data);
    handleProjectResponse(updateHistoricDataButton, data.projectName, data);
  }
});

//Py-CS-Parameter project
const CSParButton = document.getElementById('CSParButton');
CSParButton.addEventListener('click', () => {
  handleProjectButtonClick(CSParButton, 'py-cspar', 'CSMatrix');
});
window.api.receive('project-finished', (data) => {
  if (data.projectName === 'py-cspar') {
    console.log('handleProjectResponse', data);
    handleProjectResponse(CSParButton, data.projectName, data);
  }
});

export { appState };


