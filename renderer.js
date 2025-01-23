import { handleTSData } from './TS.js';
import { handleMVaRData, handleMVarInputData, updateMVaRChart } from './MVaR.js'; 
import { handleSwapForwardCurve, handleFWDData } from './FORWARDS.js';
import { handleProviderData } from './DATAProvider.js'; 
import { handleFuturePredictions, handleMLTestData, handleMLTrainedModels, handleMLModels} from './ML.js'; 
import { handleLossIssuerMainData, setupLossIssuerUI } from './LossIssuer.js'; 
import { tooltips } from './ToolTip.js';
import { AppState } from './AppState.js';
import { initializeTabs } from './utils/tabs.js';

let appState;

document.addEventListener('DOMContentLoaded', () => {
  appState = new AppState();
  window.appState = appState;

  setupEventListeners();
  setupPortDropdowns();// Deals
  setupButtons();
  initializeTabs();

});



function setupEventListeners() {
  window.api.receive('EUSWData', handleEUSWData);
  
  window.api.receive('IssuerData', handleIssuerData);
  window.api.receive('CSMatrixData', handleCSMatrixData);
  window.api.receive('CSParameterData', handleCSParameterData);
  window.api.receive('RankData', handleRankData);
  
  window.api.receive('ProdAllData', handleProdData);
  window.api.receive('ProdCouponSchedulesData', handleCouponData);

  window.api.receive('createdDealsData', handleCreatedDealsData);
  window.api.receive('createdPortData', handleCreatedPortData);
  // window.api.receive('CSMatrixData', handleCSMatrixData);
  // window.api.receive('CSParameterData', handleCSParameterData);
  // window.api.receive('RankData', handleRankData);
  // window.api.receive('IssuerData', handleIssuerData);
  // window.api.receive('ProdAllData', handleProdData);
  window.api.receive('DealsMainData', handleDealsMainData);
  // window.api.receive('EUSWData', handleEUSWData);

  // MVaR
  window.api.receive('MVaRMainData', handleMVaRMainData);
  window.api.receive('MVaRInput_2Data', handleMVarInputData);

  // CVaR
  window.api.receive('EADMain_marketData', (data) => {appState.handleEADMainData.call(appState, data, 'EADMain_market'); });
  setupCvarLossesData('sortedLossesMain', appState.handleCVaRData.bind(appState), ['rating', 'market', 'norm']);
  setupCvarLossesData('sortedLossesIssuerMain', handleLossIssuerMainData, ['rating', 'market', 'norm']);
  
  // ML
  window.api.receive('ML_FuturePredictionsData', (data) => handleFuturePredictions(data));
  window.api.receive('ML_MergedDataData', (data) => handleMLTestData(data));
  window.api.receive('ML_TrainedModelsData', handleMLTrainedModels); 
  window.api.receive('ML_ModelsData', handleMLModels);

  // DATA PROVIDER: ecb, fed, yahoo
  setupDataProvider(
    [
      ['ecbData', 'ecb'],
      ['fedData', 'fed'],
      ['yahooData', 'yahoo'],
    ],
    handleProviderData
  );

  // PYTHON PROJECTS: helper
  window.api.receive('py-fairValue-complete', handleFairValueComplete);
  window.api.receive('project-finished', handleProjectFinished);

  // TS CLONED
  window.api.receive('tblTSData', (data) => {createTSModals(data);});
  
  setTimeout(() => {
    setupLossIssuerUI(); // Call your function after a delay
  }, 300); // Wait for 0.3 seconds

  // CSSzenario EventListener check box:
  document.addEventListener('change', (event) => {
    if (event.target.classList.contains('select-scenario')) {
      const checkboxes = document.querySelectorAll('.select-scenario');
      checkboxes.forEach((checkbox) => {
        if (checkbox !== event.target) {
          checkbox.checked = false; // Uncheck all other checkboxes
        }
      });
    }
  });
}
    function setupDataProvider(eventNames, handler) {
      eventNames.forEach(([eventName, type]) => {
        window.api.receive(eventName, (data) => handler(data, type));
      });
    }
    function setupCvarLossesData(eventPrefix, handler, types) {
      types.forEach((type) => {
        const eventName = `${eventPrefix}_${type}Data`;
        window.api.receive(eventName, (data) => handler(data, type));
      });
    }
    function createTSModals(data) {
      const modalContentContainer = document.getElementById('modal-content-container');
      if (!modalContentContainer) {
        console.error('modal-content-container not found in the DOM.');
        return;
      }

      // Clear existing modals
      modalContentContainer.innerHTML = '';

      // Add new modals
      const sectionCount = 3;
      for (let i = 1; i <= sectionCount; i++) {
        insertModal(i, data);
      }
    }
    function insertModal(modalIndex, receivedData) {
      const template = document.getElementById('TS_Modal_Template');
      if (!template) {
        console.error('Template not found');
        return;
      }

      const clone = document.importNode(template.content, true);

      // Assign unique IDs to the cloned elements
      const elementsToUpdate = [
        { selector: '#checkboxContainer', id: `checkboxContainer_${modalIndex}` },
        { selector: '#loadButton', id: `loadButton_${modalIndex}` },
        { selector: '#TSDataContainer', id: `TSDataContainer_${modalIndex}` },
        { selector: '#TSlineChart', id: `TSlineChart_${modalIndex}` },
        { selector: '#oneYearButton', id: `oneYearButton_${modalIndex}` },
        { selector: '#fiveYearButton', id: `fiveYearButton_${modalIndex}` },
        { selector: '#tenYearButton', id: `tenYearButton_${modalIndex}` },
        { selector: '#maxButton', id: `maxButton_${modalIndex}` },
        { selector: '#normalizationTypeSelector', id: `normalizationTypeSelector_${modalIndex}` },
        { selector: '#applySMA1', id: `applySMA1_${modalIndex}` },
        { selector: '#movingAveragePeriod1', id: `movingAveragePeriod1_${modalIndex}` },
        { selector: '#applySMA2', id: `applySMA2_${modalIndex}` },
        { selector: '#movingAveragePeriod2', id: `movingAveragePeriod2_${modalIndex}` },
        { selector: '#applySMA3', id: `applySMA3_${modalIndex}` },
        { selector: '#movingAveragePeriod3', id: `movingAveragePeriod3_${modalIndex}` }
      ];

      elementsToUpdate.forEach(({ selector, id }) => {
        const element = clone.querySelector(selector);
        if (element) {
          element.id = id;
        } else {
          console.warn(`Element with selector '${selector}' not found in the template.`);
        }
      });

      // Append the cloned modal to the modal-content-container inside TS_Modal
      const modalContentContainer = document.getElementById('modal-content-container');
      if (modalContentContainer) {
        modalContentContainer.appendChild(clone);
      } else {
        console.error('modal-content-container not found in the DOM.');
        return;
      }

      // Attach event listeners after cloning
      //attachEventListeners(modalIndex);

      // Call handleTSData for this modal and pass the modal index and received data
      handleTSData(receivedData, modalIndex);
    }
function setupPortDropdowns() {
  // Setup Deals Dropdown
  setupDropdown({
    dropdownId: 'createdDealsDropdown',
    getDataFunction: appState.getCreatedDealsData,
    updateDataFunction: appState.updateDealsDataTable,
    setSelectedDealsTableName: appState.setSelectedDealsTableName,
    setActiveTable: () => appState.setActiveElementId('dealsDataContainer')
  });

  // Setup Port Dropdown 0
  setupDropdown({
    dropdownId: 'createdPortDropdown0',
    getDataFunction: appState.getCreatedPortData,
    updateDataFunction: appState.updatePortDataTable,
    updateMvarDataFunction: appState.updateMvarDataTable,
    updateCvarDataFunction: appState.updateCvarDataTable,
    setSelectedDealsTableName: appState.setSelectedPortTableName,
    setActiveTable: () => appState.setActiveElementId('portDataContainer')
  });

  // Setup Port Dropdown
  setupDropdown({
    dropdownId: 'createdPortDropdown',
    getDataFunction: appState.getCreatedPortData,
    updateDataFunction: appState.updatePortDataTable,
    updateMvarDataFunction: appState.updateMvarDataTable,
    updateCvarDataFunction: appState.updateCvarDataTable,
    setSelectedDealsTableName: appState.setSelectedPortTableName,
    setActiveTable: () => appState.setActiveElementId('compPortDataContainer')
  });

  // Setup Port Dropdown 2
  setupDropdown({
    dropdownId: 'createdPortDropdown2',
    getDataFunction: appState.getCreatedPortData,
    updateDataFunction: appState.updatePortDataTable,
    updateMvarDataFunction: appState.updateMvarDataTable,
    updateCvarDataFunction: appState.updateCvarDataTable,
    setSelectedDealsTableName: appState.setSelectedPortTableName,
    setActiveTable: () => appState.setActiveElementId('compPortDataContainer2')
  });
}
    function setupDropdown(options) {
      const {
          dropdownId,
          getDataFunction,
          updateDataFunction,
          updateMvarDataFunction,
          updateCvarDataFunction,
          setSelectedDealsTableName,
          setActiveTable
      } = options;

      let dropdown = document.getElementById(dropdownId);
      if (dropdown) {
          dropdown.addEventListener('change', event => {
              const selectedTableName = event.target.value;
              console.log(`selectedTableName for ${dropdownId}:`, selectedTableName);

              if (setSelectedDealsTableName) {
                  appState.setSelectedDealsTableName(selectedTableName);
              }

              if (setActiveTable) setActiveTable();

              // Update the dropdown options
              appState.updateDropdownOptions({
                  dropdownElementId: dropdownId,
                  getDataFunction: getDataFunction.bind(appState),
                  updateDataFunction: updateDataFunction.bind(appState),
                  updateMvarDataFunction: updateMvarDataFunction ? updateMvarDataFunction.bind(appState) : undefined,
                  updateCvarDataFunction: updateCvarDataFunction ? updateCvarDataFunction.bind(appState) : undefined,
                  selectedTableName: selectedTableName,
              });

              // Fetch and display the data for the selected table
            appState.fetchAndHandlePortData(selectedTableName, dropdownId);
          });
      }
    }
    function updatePortDropdowns(selectedPortTableName) {
      // zusammenfassen des codes hat nicht funktioniert, haben sich immer wieder gegenseitig beeinflusst
      
        // Update createdPortDropdown0
        appState.updateDropdownOptions({
            dropdownElementId: 'createdPortDropdown0',
            getDataFunction: appState.getCreatedPortData.bind(appState),
            updateDataFunction: appState.updatePortDataTable.bind(appState),
            updateMvarDataFunction: appState.updateMvarDataTable.bind(appState),
            updateCvarDataFunction: appState.updateCvarDataTable.bind(appState),
            selectedTableName: selectedPortTableName
        });
      
        // Update createdPortDropdown
        appState.updateDropdownOptions({
            dropdownElementId: 'createdPortDropdown',
            getDataFunction: appState.getCreatedPortData.bind(appState),
            updateDataFunction: appState.updatePortDataTable.bind(appState),
            updateMvarDataFunction: appState.updateMvarDataTable.bind(appState),
            updateCvarDataFunction: appState.updateCvarDataTable.bind(appState),
            selectedTableName: selectedPortTableName
        });
      
        // Update createdPortDropdown2
        appState.updateDropdownOptions({
            dropdownElementId: 'createdPortDropdown2',
            getDataFunction: appState.getCreatedPortData.bind(appState),
            updateDataFunction: appState.updatePortDataTable.bind(appState),
            updateMvarDataFunction: appState.updateMvarDataTable.bind(appState),
            updateCvarDataFunction: appState.updateCvarDataTable.bind(appState),
            selectedTableName: selectedPortTableName
        });
    }
  //START PYTHON PROJECTS and so on...:
function setupButtons() {
  document.getElementById('saveSelectionButton').addEventListener('click', handleSaveSelection);
  document.getElementById('deleteTableButton').addEventListener('click', handleDeleteSelection);
  document.getElementById('inputMVaRSave-button').addEventListener('click', handleSaveClick, { once: true });
  document.getElementById('applyYearsForwardButton').addEventListener('click', handleSwapForwardCurve);


//PROVIDERS
  const providers = [
    { id: 'ecbTab', container: 'inputEcb-container', button: 'ecbAddButton' },
    { id: 'fedTab', container: 'inputFed-container', button: 'fedAddButton' },
    { id: 'yahooTab', container: 'inputYahoo-container', button: 'yahooAddButton' },
  ];

  providers.forEach(({ id }) => {
    const providerTab = document.getElementById(id);
    providerTab.addEventListener('click', () => handleProviderClick(id, providers));
  });



// PYTHON EXECUTION: Buttons
  const projectButtons = [
    { buttonId: 'fairValueButton', projectName: 'py-fairValue' },
    { buttonId: 'MVaRButton', projectName: 'py-MVaR' },
    { buttonId: 'CVaRButton', projectName: 'py-CVaR' },
    { buttonId: 'updateDataExcelButton', projectName: 'py-excel' },
    { buttonId: 'updateHistoricDataButton', projectName: 'py-historicData' },
    { buttonId: 'CSParButton', projectName: 'py-cspar' },
    { buttonId: 'MLButton', projectName: 'py-ml' },
  ];
  
  projectButtons.forEach(({ buttonId, projectName, extraParam }) => {
    const button = document.getElementById(buttonId);
    button.addEventListener('click', () =>
      handleProjectButtonClick(button, projectName, extraParam)
    );
  });


// CMS buttons
    applyCMSForwardRate('CMSButton1');
    applyCMSForwardRate('CMSButton2');
  

// LANGUAGE toggle buttons
    updateTooltips('en'); // Set EN as the default language on load
  
    const langButtons = [
      { buttonId: 'lang-en', lang: 'en' },
      { buttonId: 'lang-de', lang: 'de' },
    ];
  
    langButtons.forEach(({ buttonId, lang }) => {
      const button = document.getElementById(buttonId);
      button.addEventListener('click', () => {
        updateTooltips(lang);
      });
    });
}

  function handleProviderClick(activeProviderId, providers) {
    providers.forEach(({ id, container, button }) => {
      const providerTab = document.getElementById(id);
      const providerContainer = document.getElementById(container);
      const providerButton = document.getElementById(button);

      const isActive = id === activeProviderId;

      // Toggle active class
      providerTab.classList.toggle('active', isActive);

      // Show/hide container and button
      providerContainer.style.display = isActive ? 'block' : 'none';
      providerButton.style.display = isActive ? 'block' : 'none';
    });
  }

  // PORTFOLIO
  function handleCreatedDealsData(receivedData) {
    try {
      console.log('Received createdDealsData:', receivedData);
      appState.setCreatedDealsData(receivedData, 'createdDealsDropdown');
      appState.applyFiltersAndUpdateDropdowns('dealsTables');
    } catch (error) {
      console.error("Error processing created tables data:", error);
    }
  }
  // created PORT data
  function handleCreatedPortData(receivedData) {
    try {
      appState.setCreatedPortData(receivedData, 'createdPortDropdown0');
      console.log('createdPortData0:', appState.getCreatedPortData());
      appState.applyFiltersAndUpdateDropdowns('portTables0');

      appState.setCreatedPortData(receivedData, 'createdPortDropdown');
      console.log('createdPortData:', appState.getCreatedPortData());
      appState.applyFiltersAndUpdateDropdowns('portTables');

      appState.setCreatedPortData(receivedData, 'createdPortDropdown2');
      console.log('createdPortData2:', appState.getCreatedPortData());
      appState.applyFiltersAndUpdateDropdowns('portTables2');
    } catch (error) {
      console.error("Error processing created tables data:", error);
    }
  }

  function handleSaveSelection() {
    console.log('saveSelectionButton');
    const nameInputValue = document.getElementById('nameInput').value;
    const selectionName = 'Deals' + nameInputValue;
    const tagValues = document.getElementById('tagInputField').value.split(',').map(tag => tag.trim());

    console.log('nameInputValue, selectionName, tagValues:', nameInputValue, selectionName, tagValues);

    if (!selectionName || tagValues.length === 0) {
      alert('Please enter a name and select at least one trade ID.');
      return;
    }

    const filteredData = appState.getFilteredData('deals');
    const selectedTradeIDs = filteredData.map(entry => entry.TRADE_ID);

    console.log('selectedTradeIDs:', selectedTradeIDs);
    window.api.send('save-deals-selection', {
      selectionName,
      tagValues,
      selectedTradeIDs
    });

    alert(`Portfolio "${selectionName}" successfully created`);

    const newPortfolio = { table_name: selectionName };
    appState.setCreatedDealsData([...appState.getCreatedDealsData(), newPortfolio]);
    appState.updateDealsDataTable.bind(appState);

    appState.updateDealsDropdownOptions(selectionName);
    appState.applyFiltersAndUpdateDropdowns('deals');
  }

  function handleDeleteSelection() {
    console.log('Delete button clicked');
    const selectedTableName = appState.getSelectedDealsTableName();
    if (selectedTableName !== 'Select a table') {
      const portTableName = selectedTableName.replace(/^Deals/, 'Port');
      const confirmation = window.confirm(`Are you sure you want to delete the tables "${selectedTableName}" and "${portTableName}"?`);

      if (confirmation) {
        console.log(`Confirmed deletion of ${selectedTableName} and ${portTableName}`);
        window.api.send('delete-selected-table', selectedTableName);

        setTimeout(() => {
          console.log('Message sent to main process to delete the selected table');
          
          // Update createdDealsData
          const dealsData = appState.getCreatedDealsData().filter(deal => deal.table_name !== selectedTableName);
          appState.setCreatedDealsData(dealsData);
          appState.updateDealsDropdownOptions();

          // Update createdPortData
          const portData = appState.getCreatedPortData().filter(port => port.table_name !== portTableName);
          appState.setCreatedPortData(portData);

          // Refresh port dropdowns
          ['createdPortDropdown0', 'createdPortDropdown', 'createdPortDropdown2'].forEach(dropdownId => {
            appState.updateDropdownOptions({
              dropdownElementId: dropdownId,
              getDataFunction: appState.getCreatedPortData.bind(appState),
              updateDataFunction: appState.updatePortDataTable.bind(appState),
              updateMvarDataFunction: appState.updateMvarDataTable.bind(appState),
              updateCvarDataFunction: appState.updateCvarDataTable.bind(appState),
              selectedTableName: null // No table selected after deletion
            });
          });

          requestAnimationFrame(() => {
            const nameInput = document.getElementById('nameInput');
            if (nameInput) {
              nameInput.focus();
              const length = nameInput.value.length;
              nameInput.setSelectionRange(length, length);
              console.log('Cursor set at the end of nameInput:', nameInput.selectionStart, nameInput.selectionEnd);
            } else {
              console.log('nameInput not found');
            }
          });
        }, 100);
      }
    } else {
      alert('Please select a table to delete.');
    }
  }

  // PYTHON EXECUTION:
  function handleProjectButtonClick(buttonElement, projectName, extraParam = {}) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Executing...';
  
    // Define the selected table name dynamically
    let selectedTableName;
  
    try {
      switch (projectName) {
        case 'py-ml':
          handleMLProject(extraParam);
          break;
  
        case 'py-cspar':
          handleCSParProject(buttonElement, extraParam);
          break;
  
        case 'py-fairValue':
          handleFairValueProject(buttonElement, extraParam);
          break;

        case 'py-CVaR':
          handleCVaRProject(buttonElement, extraParam);
          break;  
  
        default://ALL other projects which do not need Payload!
          selectedTableName = appState.getSelectedDealsTableName();
          sendPayloadToAPI(projectName, selectedTableName, extraParam);
          break;
      }
    } catch (error) {
      console.error(`Error handling project "${projectName}":`, error);
      alert('An error occurred while executing the project.');
      buttonElement.disabled = false;
      buttonElement.textContent = 'Run';
    }
  }

  //py-Projects
  function handleMLProject(extraParam) {
    const selectedTableName = 'tblTS';
  
    // Fetch selected target
    const targetCheckboxContainer = document.getElementById('targetCheckboxContainer');
    const selectedTargetCheckbox = targetCheckboxContainer.querySelector('input[type="checkbox"]:checked');
    extraParam.target = selectedTargetCheckbox ? selectedTargetCheckbox.value : 'NVDA'; // Default target
  
    // Fetch epochs and batch size
    const epochsInput = document.getElementById('epochsInput').value;
    const batchSizeInput = document.getElementById('batchSizeInput').value;
    extraParam.epochs = epochsInput ? parseInt(epochsInput, 10) : 1;
    extraParam.batch_size = batchSizeInput ? parseInt(batchSizeInput, 10) : 32;
  
    // Handle model selection
    handleMLModelSelection(extraParam);
  
    const payload = {
      tableName: selectedTableName,
      ...extraParam,
    };
  
    console.log('🚀 Sending payload for py-ml:', payload);
    window.api.send(`start-py-ml`, payload);
  }
  function handleMLModelSelection(extraParam) {
    const newModelCheckbox = document.getElementById('newModelCheckbox').checked;
    extraParam.newModel = newModelCheckbox;
  
    if (newModelCheckbox) {
      const selectedModelType = appState.getMLModelType();
      if (!selectedModelType) {
        throw new Error('Please select a model type for the new model.');
      }
      extraParam.modelType = selectedModelType;
      console.log(`✅ Selected model type for new model: ${selectedModelType}`);
    } else {
      const selectedModel = appState.getMLTrainedModel();
      if (selectedModel) {
        extraParam.modelName = selectedModel.modelName || '';
        extraParam.modelType = selectedModel.modelType || '';
        extraParam.optimizer = selectedModel.optimizer || null;
        extraParam.loss = selectedModel.loss || null;
        extraParam.metrics = selectedModel.metrics || [];
      }
    }
  }
  function handleCSParProject(buttonElement, extraParam) {
    const selectedTableName = 'CSParameter';
    const selectedRows = [];
    const checkboxes = document.querySelectorAll('#CSParameterDataContainer .select-scenario:checked');
  
    if (checkboxes.length === 0) {
      throw new Error('Please select at least one scenario.');
    }
  
    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest('tr');
      if (!row) return;
  
      const cells = row.querySelectorAll('td');
      const nameColumn = cells.length > 1 ? cells[cells.length - 2] : null; // Second-to-last column
      const CSSzenario = nameColumn ? nameColumn.textContent.trim() : null;
  
      if (CSSzenario) {
        selectedRows.push(CSSzenario);
      }
    });
  
    if (selectedRows.length === 0) {
      throw new Error('Please select at least one scenario.');
    }
  
    const CSSzenario = selectedRows[0];
    appState.setCSSzenarioData(CSSzenario);
  
    extraParam.CSSzenario = CSSzenario;
    extraParam.selectedRows = selectedRows;
  
    const payload = {
      tableName: selectedTableName,
      ...extraParam,
    };
  
    console.log('🚀 Sending payload for py-cspar:', payload);
    window.api.send(`start-py-cspar`, payload);
  }
  function handleFairValueProject(buttonElement, extraParam) {
    const selectedTableName = appState.getSelectedDealsTableName();
    const CSSzenario = appState.getCSSzenarioData();
  
    if (!CSSzenario) {
      throw new Error('No scenario data available. Please set a scenario first.');
    }
  
    extraParam.CSSzenario = CSSzenario;
  
    const payload = {
      tableName: selectedTableName,
      ...extraParam,
    };
  
    console.log('🚀 Sending payload for py-fairValue:', payload);
    window.api.send(`start-py-fairValue`, payload);
  }
  function handleCVaRProject(buttonElement, extraParam) {
    const selectedTableName = appState.getSelectedDealsTableName();
    const CSSzenario = appState.getCSSzenarioData();
  
    if (!CSSzenario) {
      throw new Error('No scenario data available. Please set a scenario first.');
    }
  
    extraParam.CSSzenario = CSSzenario;
  
    const payload = {
      tableName: selectedTableName,
      ...extraParam,
    };
  
    console.log('🚀 Sending payload for py-CVaR:', payload);
    window.api.send(`start-py-CVaR`, payload);
  }

  function sendPayloadToAPI(projectName, tableName, extraParam) {
    const payload = {
      tableName,
      ...extraParam,
    };
  
    console.log(`🚀 Sending payload for ${projectName}:`, payload);
    window.api.send(`start-${projectName}`, payload);
  }
  function handleProjectResponse(buttonElement, projectName, response) {
    console.log('handleProjectResponse', projectName);
    buttonElement.disabled = false;
    buttonElement.textContent = projectName;

    if (response.success) {
      console.log(`${projectName} executed successfully.`);
    } else {
      console.error(`Error starting ${projectName}:`, response.error);
    }
  }

  function handleFairValueComplete(data) {
    if (data.projectName === 'py-fairValue') {
        console.log('handleProjectResponse', data);
        appState.setActiveTable('deals');
        const selectedDealsTableName = appState.getSelectedDealsTableName();
        const selectedPortTableName = selectedDealsTableName.replace('Deals', 'Port');
        console.log('selectedPortTableName', selectedPortTableName);

        // Fetch and handle port data
        appState.fetchAndHandlePortData(selectedPortTableName, 'portDataContainer');
        handleProjectResponse(document.getElementById('fairValueButton'), data.projectName, data);

        // Add the new entry to createdPortData
        const newPortDataEntry = { table_name: selectedPortTableName };
        appState.setCreatedPortData(newPortDataEntry);

        // Refresh the dropdown options after updating createdPortData
        updatePortDropdowns(selectedPortTableName);
    }
  }

  function handleProjectFinished(data) {
    const projectButtonMap = {
      'py-MVaR': 'MVaRButton',
      'py-CVaR': 'CVaRButton',
      'py-excel': 'updateDataExcelButton',
      'py-historicData': 'updateHistoricDataButton',
      'py-cspar': 'CSParButton',
      'py-ml': 'MLButton'
    };

    const buttonId = projectButtonMap[data.projectName];
    if (buttonId) {
      console.log('handleProjectResponse', data);
      handleProjectResponse(document.getElementById(buttonId), data.projectName, data);
    }
  }



  // DEALS
  function handleDealsMainData(receivedData) {
    console.log('DealsMain', receivedData);
    appState.setActiveTable('deals');
    appState.setDealsData(receivedData);
    appState.applyFiltersAndUpdateDropdowns('deals');
    appState.tableConfigs[appState.currentActiveTable];

    const dealsResetButton = document.getElementById('dealsResetFiltersButton');
    if (dealsResetButton) {
      dealsResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'deals'));
    }
  }
  // ISSUER
  function handleIssuerData(receivedData) {
    console.log('IssuerData', receivedData);
    appState.setActiveTable('issuer');
    appState.setIssuerData(receivedData);
    appState.applyFiltersAndUpdateDropdowns('issuer');
    appState.tableConfigs[appState.currentActiveTable];

    const issuerResetButton = document.getElementById('issuerResetFiltersButton');
    if (issuerResetButton) {
      issuerResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'issuer'));
    }
  }
  // PROD
  function handleProdData(receivedData) {
    console.log('ProdAllData', receivedData);
    appState.setActiveTable('prod');
    appState.setProdData(receivedData);
    appState.applyFiltersAndUpdateDropdowns('prod');
    appState.tableConfigs[appState.currentActiveTable];

    const prodResetButton = document.getElementById('prodResetFiltersButton');
    if (prodResetButton) {
      prodResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'prod'));
    }
  }
  // CouponSchedule
  function handleCouponData(receivedData) {
    console.log('CouponData', receivedData);
    appState.setCouponData(receivedData);
  }
  // IR
  function handleEUSWData(data) {
    console.log("Received data in handleEUSWData:", data);  // Log to verify data content
    appState.handleIRData.call(appState, data);
    appState.handleFWDData.call(appState, data);  // This should cache receivedData in cachedReceivedData
    appState.handleSwapForwardCurve.call(appState, data);
  }
  // CSMatrix
  function handleCSMatrixData(receivedData) {
    console.log('CSMatrixData', receivedData);
    appState.handleCSMatrixData(receivedData);
  }
  // CSParameter
  function handleCSParameterData(receivedData) {
    appState.handleCSParameterData(receivedData);
  }
  // RANK
  function handleRankData(receivedData) {
    console.log('RankData', receivedData);
    appState.setRankData(receivedData);
    console.log('RankData set in appState', appState.getRankData());
  }
  // MVaR
  function handleMVaRMainData(receivedData) {
    console.log('handleMVaRMainData:', receivedData)
    const MVaRTable = handleMVaRData(receivedData);
    const MVaRDataContainer = document.getElementById('MVaRDataContainer');
    if (MVaRDataContainer) {
      MVaRDataContainer.innerHTML = '';
      MVaRDataContainer.appendChild(MVaRTable);
    }

    const portMVaRDataContainer = document.getElementById('portMVaRDataContainer');
    if (portMVaRDataContainer) {
      portMVaRDataContainer.innerHTML = '';
      portMVaRDataContainer.appendChild(MVaRTable.cloneNode(true));
    }
    updateMVaRChart(receivedData);
  }
  // MVaR Input
  function handleSaveClick() {
    console.log('handleSaveClick called');
    const editedData = extractEditedData();
    console.log('Edited Data:', editedData);
    const cleanTableName = 'MVaRInput_2';
    const uniqueIdentifier = { column: 'id', value: editedData[0]['id'] };
    const newData = {
      START: editedData[0]['START'],
      END: editedData[0]['END'],
      VaR_Days: editedData[0]['VaR_Days'],
      Confidence: editedData[0]['Confidence']
    };
    saveEditedData(newData, cleanTableName, uniqueIdentifier);
  }
  // MVaR Input
  function extractEditedData() {
    const editedData = [];
    const table = document.getElementById('inputMVaR-container');
    const rows = table.querySelectorAll('tr');
    for (let i = 1; i < rows.length; i++) {
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




  function applyCMSForwardRate(buttonId, applyCubicSpline = false) {
    document.getElementById(buttonId).addEventListener('click', () => {
      const cachedData = appState.getForwardData();

      console.log(`Applying CMS Rate with cached data from appState for button ${buttonId}:`, cachedData);
      if (cachedData) {
        handleFWDData(cachedData, applyCubicSpline);
      } else {
        console.error(`No cached data in appState available for ${buttonId}.`);
      }
    });
  }

  function updateTooltips(language) {
    console.log(`Updating tooltips to language: ${language}`);

    const tooltipEpochs = document.getElementById("tooltip-epochs");
    const tooltipBatchSize = document.getElementById("tooltip-batch-size");

    if (tooltipEpochs) {
      tooltipEpochs.setAttribute("data-tooltip", tooltips[language].epochs);
    } else {
      console.warn("Element with ID 'tooltip-epochs' not found.");
    }

    if (tooltipBatchSize) {
      tooltipBatchSize.setAttribute("data-tooltip", tooltips[language].batchSize);
    } else {
      console.warn("Element with ID 'tooltip-batch-size' not found.");
    }
  }

  function saveEditedData(newData, cleanTableName, uniqueIdentifier) {
    console.log('FBH saveChanges tableName:', newData, cleanTableName, uniqueIdentifier);
    window.api.send('update-data', { newData, cleanTableName, uniqueIdentifier });
  }

export { appState };
