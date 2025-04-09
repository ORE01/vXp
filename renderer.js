import { handleTSData } from './TS.js';
import { handlePortAggData, handlePortProdData} from './PORT.js';
import { handleMVaRData, handleMVarInputData} from './MVaR.js'; 
import { handleCVaRData, handleEADData} from './CVaR.js'; 
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
  setupDropdowns();
  setupButtons();
  initializeTabs();

});



function setupEventListeners() {

  // FI-Market Data
  window.api.receive('EUSWData', handleEUSWData);

  // ISSUER 
  window.api.receive('IssuerData', handleIssuerData);
  window.api.receive('CSMatrixData', handleCSMatrixData);
  window.api.receive('CSParameterData', handleCSParameterData);
  window.api.receive('RankData', handleRankData);

  // FI-Product Data
  window.api.receive('ProdAllData', handleProdData);
  window.api.receive('ProdCouponSchedulesData', (receivedData) => {
    //console.log('Received ProdCouponSchedulesData:', receivedData);

    // Speichern der Daten in appState
    if (appState && typeof appState.setCouponData === 'function') {
      appState.setCouponData(receivedData);
      //console.log('Coupon data saved in appState.');
    } else {
      console.error('appState or setCouponData is not defined!');
    }
  });

  // DEALS:
  window.api.receive('DealsMainData', (data) => {
    handleDealsNameList(data);
    handleDealsMainData(data);
  });

  // PORTFOLIO
  window.api.receive('PortfoliosData', (data) => {
    handlePortNameList(data);
    handlePortfolioData(data);
  });


  // MVaR: Input
  window.api.receive('MVaRInput_2Data', handleMVarInputData);

  // MVaR
  window.api.receive('MarketVaRData', handleAllMVaRData);

  // EAD
  window.api.receive('EADData', (data) => handleAllEADData(data));

  // CVaR
  window.api.receive('CreditVaRData', (data) => handleAllCVaRData(data));

  // LOSSES sorted
  window.api.receive('sortedLossesIssuerMainData', (data) => handleAllLossData(data));

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
  window.api.receive('py-mvar-complete', handleMVaRComplete);
  window.api.receive('py-cvar-complete', handleCVaRComplete);
  window.api.receive('project-finished', handleProjectFinished);

  // TS CLONED
  window.api.receive('tblTSData', (data) => {createTSModals(data);});
  
  setTimeout(() => {
    setupLossIssuerUI(); // Call your function after a delay
  }, 300); // Wait for 0.3 seconds

  // CSSzenario EventListener für Checkboxen
  document.addEventListener('change', (event) => {
    // console.log("📢 Event ausgelöst:", event.target); // Logge das auslösende Element

    if (event.target.classList.contains('select-scenario')) {
        // console.log("✅ Eine Szenario-Checkbox wurde geändert!");

        const checkboxes = document.querySelectorAll('.select-scenario');
        let isDefaultSelected = false;

        checkboxes.forEach((checkbox) => {
            // console.log(`🔍 Checkbox: ${checkbox.dataset.row}, Checked: ${checkbox.checked}`);

            if (checkbox !== event.target) {
                checkbox.checked = false; // Deaktiviere alle anderen Checkboxen
            }
            // Prüfe, ob die CSSzenario-Spalte den Wert "default" enthält
            if (checkbox.checked && checkbox.dataset.row === "0") { 
                isDefaultSelected = true;
            }
        });

        // console.log("📊 Ist 'default' aktiv?", isDefaultSelected);

        // Warnung in der Toolbar anzeigen/verstecken
        const creditWarningContainer = document.getElementById("creditWarningContainer");
        const creditWarningLight = document.getElementById("creditWarning");

        if (!isDefaultSelected) {
            // console.log("🚨 Rote Ampel AN!");
            creditWarningLight.style.backgroundColor = "red";
            creditWarningContainer.style.visibility = "visible";
        } else {
            // console.log("✅ Standard-Szenario aktiv, Ampel AUS!");
            creditWarningLight.style.backgroundColor = "transparent";
            creditWarningContainer.style.visibility = "hidden";
        }
    }
  });

  // IRCurveSzenario
  document.getElementById("ratesSelector").addEventListener("change", (event) => {
      const selectedCurve = event.target.value;
      appState.setSelectedCurve(selectedCurve); // Speichere die Auswahl
      handleEUSWData(appState.getForwardData()); // Aktualisiere die Graphen

      // Warnung in der Toolbar anzeigen, wenn nicht EUSWAP
      const warningContainer = document.getElementById("curveWarningContainer");
      const warningLight = document.getElementById("curveWarning");

      if (selectedCurve !== "EUSWAP") {
          warningLight.style.backgroundColor = "red";
          warningContainer.style.visibility = "visible"; // Falls es unsichtbar ist
      } else {
          warningLight.style.backgroundColor = "transparent";
          warningContainer.style.visibility = "hidden"; // Verstecke die Warnung
      }
  });
}
    function setupDataProvider(eventNames, handler) {
      eventNames.forEach(([eventName, type]) => {
        window.api.receive(eventName, (data) => handler(data, type));
      });
    }
    // function setupCvarLossesData(eventPrefix, handler, types) {
    //   types.forEach((type) => {
    //     const eventName = `${eventPrefix}_${type}Data`;
    //     window.api.receive(eventName, (data) => handler(data, type));
    //   });
    // }
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

    function setupDropdowns() {
      // Deals Dropdown
      setupDropdown({
          dropdownId: 'createdDealsDropdown',
          getDataFunction: appState.getDealsNameList,
          updateDataFunction: appState.updateDealsDataTable,
          setSelectedDealsTableName: appState.setSelectedDealsTableName,
          setActiveTable: () => appState.setActiveElementId('dealsDataContainer')
      });
  
      // Portfolio Dropdowns (0, 1, 2)
      ['0','1', '2'].forEach(num => {
          setupDropdown({
              dropdownId: `createdPortDropdown${num}`,
              getDataFunction: appState.getPortNameList,
              updateDataFunction: appState.updatePortDataTable,
              //updateMvarDataFunction: appState.updateMvarDataTable,
              //updateCvarDataFunction: appState.updateCvarDataTable,
              setSelectedPortTableName: appState.setSelectedPortTableName,
              setActiveTable: () => appState.setActiveElementId(`portDataContainer${num}`),
              index: parseInt(num) // 🆕 übergeben!
          });
      });
  }
  

  //START PYTHON PROJECTS and so on...:

//   function setupDropdown(options) {
//     const {
//         dropdownId,
//         getDataFunction,
//         updateDataFunction,
//         updateMvarDataFunction,
//         updateCvarDataFunction,
//         setSelectedPortTableName,
//         setSelectedDealsTableName, // ✅ Ergänzt
//         setActiveTable,
//         index
//     } = options;

//     let dropdown = document.getElementById(dropdownId);
//     if (dropdown) {
//         dropdown.addEventListener('change', event => {
//             const selectedTableName = event.target.value;
//             console.log(`🔄 Portfolio ausgewählt: ${selectedTableName} (Index: ${index})`);

//             // ✅ DealsTableName setzen
//             if (setSelectedDealsTableName) {
//                 appState.setSelectedDealsTableName(selectedTableName);
//                 //console.log('📌 DealsTableName gesetzt auf:', appState.getSelectedDealsTableName());
//             }

//             // ✅ PortTableName setzen
//             if (setSelectedPortTableName) {
//                 appState.setSelectedPortTableName(selectedTableName);
//                 //console.log('port_name:', appState.getSelectedPortTableName());

//                 // 🛠 EAD-Daten aktualisieren
//                 const EADData = appState.getAllEADData();
//                 if (EADData && EADData.length > 0) {
//                     handleEADData(EADData);
//                 } else {
//                     console.warn('⚠️ Keine gespeicherten EAD-Daten gefunden.');
//                 }

//                 // 🛠 LOSS-Daten aktualisieren
//                 const LossData = appState.getAllLossData();
//                 if (LossData && LossData.length > 0) {
//                     handleLossIssuerMainData(LossData);
//                 } else {
//                     console.warn('⚠️ Keine gespeicherten CVaR-Daten gefunden.');
//                 }
//             }

//             if (setActiveTable) setActiveTable();

// // 🛠 Gültigkeit des ausgewählten Namens prüfen
// const isValid = [...dropdown.options].some(opt => opt.value === selectedTableName);
// const validTableName = isValid ? selectedTableName : dropdown.options[0].value;

// if (!isValid) {
//     console.warn(`⚠️ '${selectedTableName}' nicht gefunden – verwende stattdessen '${validTableName}'`);
//     dropdown.value = validTableName;
// }

// // 🛠 Update the dropdown options mit korrigiertem Wert
// appState.updateDropdownOptions({
//     dropdownElementId: dropdownId,
//     getDataFunction: getDataFunction.bind(appState),
//     updateDataFunction: updateDataFunction.bind(appState),
//     updateMvarDataFunction: updateMvarDataFunction ? updateMvarDataFunction.bind(appState) : undefined,
//     updateCvarDataFunction: updateCvarDataFunction ? updateCvarDataFunction.bind(appState) : undefined,
//     selectedTableName: validTableName,
//     index
// });


//             // 🛠 Fetch and display the data for the selected portfolio
//             //appState.fetchAndHandlePortData(selectedTableName, dropdownId);
//         });
//     }
// }
function setupDropdown({
  dropdownId,
  getDataFunction,
  updateDataFunction,
  updateMvarDataFunction,
  updateCvarDataFunction,
  updateEADDataFunction,
  setSelectedPortTableName,
  setSelectedDealsTableName,
  setActiveTable,
  index // 🆕 Hier aufnehmen
}) {
  const dropdown = document.getElementById(dropdownId);
  if (dropdown) {
    dropdown.addEventListener('change', event => {
      const selectedTableName = event.target.value;
      console.log(`🔄 Portfolio ausgewählt: ${selectedTableName} (Index: ${index})`);

      if (setSelectedDealsTableName) {
        appState.setSelectedDealsTableName(selectedTableName);
      }
      if (setSelectedPortTableName) {
        appState.setSelectedPortTableName(selectedTableName);
      }
      if (setActiveTable) {
        setActiveTable();
      }

      // 🧠 Jetzt wird der Index korrekt weitergegeben!
      appState.updateDropdownOptions({
        dropdownElementId: dropdownId,
        getDataFunction: getDataFunction.bind(appState),
        updateDataFunction: updateDataFunction ? updateDataFunction.bind(appState) : undefined,
        updateMvarDataFunction: updateMvarDataFunction ? updateMvarDataFunction.bind(appState) : undefined,
        updateCvarDataFunction: updateCvarDataFunction ? updateCvarDataFunction.bind(appState) : undefined,
        updateEADDataFunction: updateEADDataFunction ? updateEADDataFunction.bind(appState) : undefined,
        selectedTableName,
        index // 🧠 Das war vorher nicht da!
      });
    });
  }
}



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

// THEME TOGGLE button
    const themeToggleButton = document.getElementById('themeToggle');
    if (themeToggleButton) {
      themeToggleButton.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');  // Toggles between dark and light themes
    });
  }
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
  function handleDealsNameList(receivedData) {
    try {
        //console.log('Received Alle Deals Daten:', receivedData);
        
        // Extract unique portfolio names from the port_name column
        const uniquePortNames = [...new Set(receivedData.map(entry => entry.port_name).filter(name => name))];

        // Transform into dropdown-compatible format
        const uniquePortfolios = uniquePortNames.map(name => ({ table_name: name }));

        // Save the unique deals portfolios
        appState.setDealsNameList(uniquePortfolios, 'createdDealsDropdown');

        // Update the dropdown
        appState.applyFiltersAndUpdateDropdowns('dealsTables');

        //console.log('✅ Unique deals portfolios:', uniquePortfolios);
    } catch (error) {
        console.error("❌ Error processing created deals data:", error);
    }
}

// Created PORT data
  function handlePortNameList(receivedData) {
  try {
      //console.log('Received Alle Portfolio Daten:', receivedData);

      // Extract unique portfolio names from port_name column
      const uniquePortNames = [...new Set(receivedData.map(entry => entry.port_name).filter(name => name))];

      // Transform into dropdown-compatible format
      const uniquePortfolios = uniquePortNames.map(name => ({ table_name: name }));

      // Update each dropdown with unique portfolio names
      ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdown, index) => {
          appState.setPortNameList(uniquePortfolios, dropdown);
          appState.applyFiltersAndUpdateDropdowns(`portTables${index}`);
      });

      //console.log('✅ Unique portfolios for dropdowns:', uniquePortfolios);
  } catch (error) {
      console.error("❌ Error processing created port data:", error);
  }
}

function handleSaveSelection() {
  const port_name = document.getElementById('nameInput').value;
  const tagValues = document.getElementById('tagInputField').value.split(',').map(tag => tag.trim());

  //console.log('port_name, tagValues:', port_name, tagValues);

  if (!port_name || tagValues.length === 0) {
    alert('Please enter a name and select at least one trade ID.');
    return;
  }

  const filteredData = appState.getFilteredData('deals');
  const selectedFromTableName = appState.getSelectedDealsTableName();
  const selectedTradeIDs = filteredData.map(entry => Number(entry.TRADE_ID));

  window.api.send('save-deals-selection', {
    selectedFromTableName,
    port_name,
    tagValues,
    selectedTradeIDs
  });

  showMessageBox(`Portfolio "${port_name}" successfully created!`, () => {
    //console.log('User closed the success confirmation modal.');
  });

  const newPortfolio = { table_name: port_name };
  appState.setDealsNameList([...appState.getDealsNameList(), newPortfolio]);

  // ✅ 1. Setze das Dropdown-Filter-Kriterium für applyFilters...
  appState.dropdownConfig['dealsTables']['createdDealsDropdown'].selection = [port_name];

  // ✅ 2. Filtere und aktualisiere UI
  appState.applyFiltersAndUpdateDropdowns('dealsTables');

  // ✅ 3. Aktualisiere Dropdown (enthält nun neue Optionen)
  appState.updateDropdownOptions({
    dropdownElementId: 'createdDealsDropdown',
    getDataFunction: appState.getDealsNameList.bind(appState),
    updateDataFunction: appState.updateDealsDataTable.bind(appState),
    selectedTableName: port_name
  });

  // ✅ 4. Setze aktiv die Auswahl im Dropdown im DOM
  setTimeout(() => {
    const dropdown = document.getElementById('createdDealsDropdown');
    if (dropdown) {
      dropdown.value = port_name;
      dropdown.dispatchEvent(new Event('change'));
      //console.log(`🎯 Manuell ausgewählt: '${port_name}' im Dropdown.`);
    }
  }, 100);

  // ✅ 5. Setze intern die Auswahl für appState
  appState.setSelectedDealsTableName(port_name);
  appState.setSelectedPortTableName(port_name);

  // ✅ 6. Reset-Button klicken
  const resetButton = document.getElementById('dealsResetFiltersButton');
  if (resetButton) resetButton.click();
}

  function showMessageBox(message, onClose) {
          // Create the overlay
          const overlay = document.createElement('div');
          overlay.classList.add('confirmation-overlay');

          // Create the modal box
          const modal = document.createElement('div');
          modal.classList.add('confirmation-modal', 'confirmation-success');

          // Add success message
          const messageElement = document.createElement('p');
          messageElement.textContent = message;
          messageElement.classList.add('confirmation-message');
          modal.appendChild(messageElement);

          // OK button
          const okButton = document.createElement('button');
          okButton.textContent = 'OK';
          okButton.classList.add('confirmation-button', 'confirmation-button-green');

          okButton.addEventListener('click', () => {
              document.body.removeChild(overlay);  // Close the modal
              if (onClose) onClose();  // Trigger callback if provided
          });

          // Append button to modal
          modal.appendChild(okButton);
          overlay.appendChild(modal);
          document.body.appendChild(overlay);
      }

  function handleDeleteSelection() {
    // console.log('Delete button clicked');
    const selectedTableName = appState.getSelectedDealsTableName();
  
    if (selectedTableName !== 'Select a table') {
      const portTableName = selectedTableName.replace(/^Deals/, 'Port');
  
      // ✅ Use the custom confirmation modal
      showConformationBox(
        `Are you sure you want to delete the tables "${selectedTableName}" and "${portTableName}"?`,
        
        // On Confirm
        () => {
          //console.log(`Confirmed deletion of ${selectedTableName} and ${portTableName}`);
          window.api.send('delete-selected-table', selectedTableName);
  
          setTimeout(() => {
            //console.log('Message sent to main process to delete the selected table');
  
            // Update createdDealsData
            const dealsData = appState.getDealsNameList().filter(deal => deal.table_name !== selectedTableName);
            appState.setDealsNameList(dealsData);
            
            appState.updateDropdownOptions({
              dropdownElementId: 'createdDealsDropdown',
              getDataFunction: appState.getDealsNameList.bind(appState),
              updateDataFunction: appState.updateDealsDataTable.bind(appState),
              selectedTableName: selectedTableName
          });
          
  
            // Update createdPortData
            const portData = appState.getPortNameList().filter(port => port.table_name !== portTableName);
            appState.setPortNameList(portData);
  
            // Refresh port dropdowns
            ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach(dropdownId => {
              appState.updateDropdownOptions({
                dropdownElementId: dropdownId,
                getDataFunction: appState.getPortNameList.bind(appState),
                updateDataFunction: appState.updatePortDataTable.bind(appState),
                updateMvarDataFunction: appState.updateMvarDataTable.bind(appState),
                updateCvarDataFunction: appState.updateCvarDataTable.bind(appState),
                selectedTableName: null
              });
            });
  
            requestAnimationFrame(() => {
              const nameInput = document.getElementById('nameInput');
              if (nameInput) {
                nameInput.focus();
                const length = nameInput.value.length;
                nameInput.setSelectionRange(length, length);
                //console.log('Cursor set at the end of nameInput:', nameInput.selectionStart, nameInput.selectionEnd);
              } else {
                //console.log('nameInput not found');
              }
            });
          }, 100);
        },
  
        // On Cancel
        () => {
          console.log('Deletion canceled by user.');
        }
      );
    } else {
      alert('Please select a table to delete.');
    }
  }
        function showConformationBox(message, onConfirm, onCancel) {
          // Create the overlay
          const overlay = document.createElement('div');
          overlay.classList.add('confirmation-overlay');

          // Create the modal box
          const modal = document.createElement('div');
          modal.classList.add('confirmation-modal');

          // Add message
          const messageElement = document.createElement('p');
          messageElement.textContent = message;
          messageElement.classList.add('confirmation-message');
          modal.appendChild(messageElement);

          // Create buttons container
          const buttonContainer = document.createElement('div');
          buttonContainer.classList.add('confirmation-button-container');

          // Confirm button (Now Red)
          const confirmButton = document.createElement('button');
          confirmButton.textContent = 'Yes';
          confirmButton.classList.add('confirmation-button', 'confirmation-button-red'); // 🔴 CHANGED TO RED
          confirmButton.addEventListener('click', () => {
              document.body.removeChild(overlay);
              onConfirm();
          });

          // Cancel button
          const cancelButton = document.createElement('button');
          cancelButton.textContent = 'No';
          cancelButton.classList.add('confirmation-button', 'confirmation-button-grey');
          cancelButton.addEventListener('click', () => {
              document.body.removeChild(overlay);
              if (onCancel) onCancel();
          });

          // Append buttons to container and modal
          buttonContainer.appendChild(confirmButton);
          buttonContainer.appendChild(cancelButton);
          modal.appendChild(buttonContainer);

          // Append modal to overlay
          overlay.appendChild(modal);
          document.body.appendChild(overlay);
      }


  // PYTHON EXECUTION:
  function handleProjectButtonClick(buttonElement, projectName, extraParam = {}) {
    buttonElement.disabled = true;
    buttonElement.textContent = 'Executing...';

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

            case 'py-MVaR':
                handleMVaRProject(buttonElement, extraParam);
                break;

            default:
              let selectedTableName = appState.getSelectedDealsTableName() || 'DealsMain';
              sendPayloadToAPI(projectName, selectedTableName, extraParam);
              break;
              
        }

        // ✅ Event-Listener für den Abschluss setzen
        window.api.receive(`${projectName}-complete`, () => {
            //console.log(`✅ ${projectName} finished, resetting button.`);
            buttonElement.disabled = false;
            buttonElement.textContent = 'Run';
        });

    } catch (error) {
        console.error(`Error handling project "${projectName}":`, error);
        alert('An error occurred while executing the project.');
        buttonElement.disabled = false;
        buttonElement.textContent = 'Run';
    }
  }


  //py-Projects
      //fairvalue
      function handleFairValueProject(buttonElement, extraParam) {
        const port_name = appState.getSelectedDealsTableName();
        //console.log('🚀 Sending payload for py-fairValue:', port_name);
        const CSSzenario = appState.getCSSzenarioData();
        const selectedCurve = appState.getSelectedCurve();
      
        if (!CSSzenario) {
          throw new Error('No scenario data available. Please set a scenario first.');
        }
      
        extraParam.CSSzenario = CSSzenario;
        extraParam.selectedCurve = selectedCurve;
      
        const payload = {
          tableName: port_name,
          ...extraParam,
        };
      
        //console.log('🚀 Sending payload for py-fairValue:', payload);
        window.api.send(`start-py-fairValue`, payload);
      }
          function handleFairValueComplete(data) {
            //console.log('📌 handleFairValueComplete wurde ausgelöst:', data);
            if (data.projectName === 'py-fairValue') {
              // 🛠 1️⃣ Setzt die aktive Tabelle auf "deals"
              appState.setActiveTable('deals');
              appState.setActiveElementId('portDataContainer0')
      
              // 🛠 2️⃣ Holt den Portfolionamen aus Deals
              const port_name = appState.getSelectedDealsTableName();
              //console.log('🔹 Neues Portfolio:', port_name);
      
             // Antwort nur für Button:
              handleProjectResponse(document.getElementById('fairValueButton'), data.projectName, data);

              // 🛠 3️⃣ Holt die aktuellsten Portfolio-Daten **vor** dem Update der Dropdowns
              fetchAndUpdateFairValueData();
            }
          }
        function fetchAndUpdateFairValueData() {
          window.api.receive('PortfoliosData', (receivedData) => {
            //console.log(`✅ Updated PortfoliosData Data:`, receivedData);
        
            if (!receivedData || receivedData.length === 0) {
              console.warn("⚠️ No new Portfolios data received!");
              appState.setAllPortfolioData([]);
              return;
            }
        
            appState.setAllPortfolioData(receivedData);
            //console.log(`🔄 UI should now update with`, appState.getAllPortfolioData());
        
            // 🔹 Jetzt: Verarbeitung erst NACH dem Empfang
            const port_name = appState.getSelectedPortTableName(); // oder getSelectedPortTableName(), je nach Kontext
              if (!port_name) {
                console.warn("⚠️ Kein Portfolio ausgewählt.");
                return;
              }
            
            const filteredData = receivedData.filter(entry => entry.port_name === port_name);
            appState.updatePortDataTable(filteredData, 0);
            //console.log('✅ Portfolio filteredData:', filteredData, port_name);
        
            // 🛠 Dropdowns aktualisieren
            ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdownId, index) => {
              appState.updateDropdownOptions({
                dropdownElementId: dropdownId,
                getDataFunction: appState.getPortNameList.bind(appState),
                updateDataFunction: appState.getPortfolioData.bind(appState),
                selectedTableName: index === 0 ? port_name : undefined
              });
            });
        
            // 🛠 Portfolio setzen
            appState.setSelectedPortTableName(port_name);
            //console.log('✅ Portfolio-Daten & Dropdowns aktualisiert.');

            handlePortAggData(filteredData, 3, port_name);
            
          });
        
          // 📤 Erst jetzt senden
          window.api.send('fetch-table-data', 'Portfolios');
        }
        
      //MVaR
      function handleMVaRProject(buttonElement, extraParam) {
        const selectedTableName = appState.getSelectedPortTableName();
      
        if (!selectedTableName) {
          throw new Error('No table selected for MVaR processing.');
        }
      
        const payload = {
          tableName: selectedTableName,
          ...extraParam,
        };
      
        //console.log('🚀 Sending payload for py-MVaR:', payload);
        window.api.send('start-py-MVaR', payload);
      }
      function handleMVaRComplete(data) {
        if (data.projectName === 'py-MVaR') {
          appState.setActiveTable('port');
      
          const port_name = appState.getSelectedPortTableName();
          //appState.fetchAndHandlePortData(port_name, 'portDataContainer0');
      
          handleProjectResponse(document.getElementById('MVaRButton'), data.projectName, data);
          fetchAndUpdateMVarData();
    
          const mvarDara = appState.getAllMvarData();
          handleMVaRData(mvarDara, 0);
        }
      }
          function fetchAndUpdateMVarData() {
            //console.log(`fetchAndUpdateMVarData`);
            //window.api.send('fetch-table-data', 'MarketVaR'); 
            window.api.receive('MarketVaRData', (receivedData) => {
                //console.log(`MVaRData:`, receivedData);
                if (!receivedData || receivedData.length === 0) {
                    console.warn("⚠️ No new CVaR data received!");
                    appState.updateMvarDataTable([]);  // Store empty array to avoid stale data
                    return;
                }
                //appState.setAllMvarData(receivedData);
                appState.updateMvarDataTable(receivedData);
        

            });
            window.api.send('fetch-table-data', 'MarketVaR'); 
          }
      //CVaR
      function handleCVaRProject(buttonElement, extraParam) {
        const port_name = appState.getSelectedPortTableName();
        const CSSzenario = appState.getCSSzenarioData();
      
        if (!CSSzenario) {
          throw new Error('No scenario data available. Please set a scenario first.');
        }
      
        extraParam.CSSzenario = CSSzenario;
      
        const payload = {
          tableName: port_name,
          ...extraParam,
        };
      
        console.log('🚀 Sending payload for py-CVaR:', payload);
        window.api.send(`start-py-CVaR`, payload);
      }
          function handleCVaRComplete(data) {
            if (data.projectName === 'py-CVaR') {
              appState.setActiveTable('port'); // Set the active table
          
              const port_name = appState.getSelectedPortTableName();
          
              // 1️⃣ Fetch and update the main portfolio data
              //appState.fetchAndHandlePortData(port_name, 'portDataContainer0');
          
              
              handleProjectResponse(document.getElementById('CVaRButton'), data.projectName, data);
              fetchAndUpdateCVarData();

              const cvarData = appState.getAllCvarData();
              handleCVaRData(cvarData);

              
            }
          }
          function fetchAndUpdateCVarData() {
            
            window.api.receive('CreditVaRData', (receivedData) => {
                //console.log(`✅ Updated CVaR Data:`, receivedData);
        
                if (!receivedData || receivedData.length === 0) {
                    console.warn("⚠️ No new CVaR data received!");
                    appState.setAllCvarData([]);  // Store empty array to avoid stale data
                    return;
                }
        
                appState.setAllCvarData(receivedData);
                //console.log(`AllCvarData`, appState.getAllCvarData());
        

            });
            window.api.send('fetch-table-data', 'CreditVaR'); 
          }
    
      //ML
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
      
        //console.log('🚀 Sending payload for py-ml:', payload);
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
          //console.log(`✅ Selected model type for new model: ${selectedModelType}`);
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
      
        //console.log('🚀 Sending payload for py-cspar:', payload);
        window.api.send(`start-py-cspar`, payload);
      }


      

      function sendPayloadToAPI(projectName, tableName, extraParam) {
        const payload = {
          tableName,
          ...extraParam,
        };
      
        //console.log(`🚀 Sending payload for ${projectName}:`, payload);
        window.api.send(`start-${projectName}`, payload);
      }
      function handleProjectResponse(buttonElement, projectName, response) {
        //console.log('handleProjectResponse', projectName);
        buttonElement.disabled = false;
        buttonElement.textContent = projectName;

        if (response.success) {
          //console.log(`${projectName} executed successfully.`);
        } else {
          console.error(`Error starting ${projectName}:`, response.error);
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
          //console.log('handleProjectResponse', data);
          handleProjectResponse(document.getElementById(buttonId), data.projectName, data);
        }
      }



  // DEALS
  function handleDealsMainData(receivedData) {
    appState.setAllDealsData(receivedData);
    //console.log('📌 Alle Deals Daten: DealsMain:', receivedData);

    appState.setActiveTable('deals');

    const dealsResetButton = document.getElementById('dealsResetFiltersButton');
    if (dealsResetButton) {
      dealsResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'deals'));
    }
  }
  
  // PORT: Portfolios
  function handlePortfolioData(receivedData) {
    appState.setAllPortfolioData(receivedData);
      //console.log('📌 Alle Portfolio Daten: Portfolios', receivedData);
    appState.setActiveTable('deals');

  // Reset Button
  const portResetButton = document.getElementById('portResetFiltersButton');
  if (portResetButton) {
    portResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'port'));
  }


  }

  // ISSUER
  function handleIssuerData(receivedData) {
    //console.log('IssuerData', receivedData);
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
    //console.log('ProdAllData', receivedData);
    appState.setActiveTable('prod');
    appState.setProdData(receivedData);
    appState.applyFiltersAndUpdateDropdowns('prod');
    appState.tableConfigs[appState.currentActiveTable];

    const prodResetButton = document.getElementById('prodResetFiltersButton');
    if (prodResetButton) {
      prodResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'prod'));
    }
  }
  // PRODCouponData
  // function handleCouponData(receivedData) {
  //   console.log('CouponData', receivedData);
  //   appState.setCouponData(receivedData);
  // }
  // IR
  function handleEUSWData(data) {
    const selectedCurve = document.getElementById("ratesSelector").value;

    // Setze RATES auf die gewählte Spalte
    data.forEach(row => {
        if (selectedCurve in row) {
            row.RATES = row[selectedCurve]; 
        }
    });

    // Graphen direkt aktualisieren
    appState.handleIRData.call(appState, data);
    appState.handleFWDData.call(appState, data);
    appState.handleSwapForwardCurve.call(appState, data);
}


// Event-Listener für das Dropdown hinzufügen
document.getElementById("ratesSelector").addEventListener("change", () => {
    const selectedCurve = document.getElementById("ratesSelector").value;

    //console.log(`🔄 Neue Auswahl: ${selectedCurve} → Daten werden aktualisiert`);

    // Sende ein Event an `main.js`, um die Daten mit der neuen Spalte zu aktualisieren
    window.api.send('EUSWData-refresh', selectedCurve);
});




  // CSMatrix
  function handleCSMatrixData(receivedData) {
    //console.log('CSMatrixData', receivedData);
    appState.handleCSMatrixData(receivedData);
  }
  // CSParameter
  function handleCSParameterData(receivedData) {
    appState.handleCSParameterData(receivedData);
  }
  // RANK
  function handleRankData(receivedData) {
    //console.log('RankData', receivedData);
    appState.setRankData(receivedData);
    // console.log('RankData set in appState', appState.getRankData());
  }
  // MVaR
  function handleAllMVaRData(receivedData) {
      //console.log('handleAllMVaRData:', receivedData)
    appState.setAllMvarData(receivedData); 

    
    const MVaRTable = handleMVaRData(receivedData, 0);

    const portMVaRDataContainer = document.getElementById('portMVaRDataContainer');
    if (portMVaRDataContainer) {
      portMVaRDataContainer.innerHTML = '';
      portMVaRDataContainer.appendChild(MVaRTable.cloneNode(true));
    }
    // updateMVaRChart(receivedData);
    //appState.updateMvarDataTable(receivedData);
  }

  //CVaR
  function handleAllCVaRData(receivedData) {
    console.log("📊 Received full CVaR Data (new storage):", receivedData);

    // if (!receivedData || receivedData.length === 0) {
    //     console.warn("⚠️ No CVaR data received!");
    //     appState.setAllCvarData([]);  // Store empty array
    //     return;
    // }

    appState.setAllCvarData(receivedData);  // ✅ Store in AllCvarData
    
    handleCVaRData(receivedData, 0) 

}
  // EAD
  function handleAllEADData(receivedData) {
    //console.log("📊 Received all EAD Data:", receivedData);

    if (!receivedData || receivedData.length === 0) {
        console.warn("⚠️ No EAD data received!");
        appState.setAllEADData([]);  // Store empty array
        return;
    }

    appState.setAllEADData(receivedData);  // ✅ Store in AllCvarData
    handleEADData(receivedData)

}

  //LOSS
  function handleAllLossData(receivedData) {
    //console.log("📊 Received full LOSS Data:", receivedData);

    if (!receivedData || receivedData.length === 0) {
        console.warn("⚠️ No CVaR data received!");
        appState.setAllLossData([]);  // Store empty array
        return;
    }

    appState.setAllLossData(receivedData);  // ✅ Store in AllCvarData
    handleLossIssuerMainData(receivedData)

}


  // MVaR Input
  function handleSaveClick() {
    //console.log('handleSaveClick called');
    const editedData = extractEditedData();
    //console.log('Edited Data:', editedData);
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

      //console.log(`Applying CMS Rate with cached data from appState for button ${buttonId}:`, cachedData);
      if (cachedData) {
        handleFWDData(cachedData, applyCubicSpline);
      } else {
        console.error(`No cached data in appState available for ${buttonId}.`);
      }
    });
  }

  function updateTooltips(language) {
    //console.log(`Updating tooltips to language: ${language}`);

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
    //console.log('FBH saveChanges tableName:', newData, cleanTableName, uniqueIdentifier);
    window.api.send('update-data', { newData, cleanTableName, uniqueIdentifier });
  }

export { appState };
