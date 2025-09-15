import { handleTSData } from './TS.js';
import { handlePortAggData, handlePortProdData} from './PORT.js';
import { handleMVaRData, handleMVarInputData} from './MVaR.js'; 
import { handleCVaRData, handleEADData} from './CVaR.js'; 
import { handleSwapForwardCurve, handleFWDData } from './FORWARDS.js';
import { handleProviderData } from './DATAProvider.js'; 
import { handleFuturePredictions, handleMLTestData, handleMLTrainedModels, handleMLModels} from './ML.js'; 
import { handleLossIssuerMainData, setupLossIssuerUI } from './LossIssuer.js'; 
import { handleLiquidityData } from './liquidity.js';
import { handleSummaryRMData } from './SummaryMarketRM.js';
import { startOfferImport, handleSubmitMatching, quickImportWithStandardMapping } from './offers.js';
import { generateOfferPDF} from './PDF/OfferPDF.js';
import { generateRiskPDF } from './PDF/RiskPDF.js';
// import { handleSubmitMatching } from './offers.js';
import { createRatesLineChart } from './charts/LineChart.js';



import { tooltips } from './ToolTip.js';
import { AppState } from './AppState.js';
import { initializeTabs } from './utils/tabs.js';

let appState;
let lastHistButton = null;


document.addEventListener('DOMContentLoaded', () => {
  appState = new AppState();
  window.appState = appState;

  setupEventListeners();
  setupDropdowns();
  setupButtons();
  initializeTabs();

});


function setupEventListeners() {

// CUSTOMER-Data
  window.api.receive('CustomerData', handleCustomerData);


  // Market Data: Fixed Income
  window.api.receive('EUSWData', handleEUSWData);

  // ISSUER 
  window.api.receive('IssuerData', handleIssuerData);
  window.api.receive('CSMatrixData', handleCSMatrixData);
  window.api.receive('CSParameterData', handleCSParameterData);
  window.api.receive('RankData', handleRankData);

  // PRODUCTS: Fixed Income-Product Data
  window.api.receive('ProdAllData', handleProdDataInit);
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
    handleOffersNameList(data);

    handleDealsMainData(data);
    
    // console.log('handleDealsMainData:', data);
  });

  window.api.receive('LGTData', (data) => {
    appState.setOfferData(data); // ✅ hier speichern
    // console.log("📥 LGT-Daten empfangen:", data);
  });
  


  // PORTFOLIO
  window.api.receive('PortfoliosData', (data) => {
    handlePortNameList(data);
    handlePortfolioData(data);
    handleLiquidityData(data);
  });


  // MVaR: Input
  window.api.receive('MVaRInput_2Data', handleMVarInputData);

  // MVaR
  window.api.receive('MarketVaRData', handleAllMVaRData);

  // MVaR_Distribution
  //window.api.receive('MVaRMainDistData', handleMvarDistData);
  window.api.receive('MVaRMainDistData', (data) => handleMvarDistData(data));

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
  window.api.receive('py-matchColumns-complete', handleAIColumnComplete);
  window.api.receive('py-historicData-complete', handleHistComplete);

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


//   // Angebot-Export (PDF)
// const offerPDFButton = document.getElementById('offerPDFButton');
// const modal = document.getElementById('pdfTextModal');
// const confirmBtn = document.getElementById('confirmPDF');
// const cancelBtn = document.getElementById('cancelPDF');

// if (offerPDFButton) {
//   offerPDFButton.addEventListener('click', () => {
//     const data = appState.getFilteredPortData();

//     if (!data || data.length === 0) {
//       alert('❌ Keine Angebotsdaten verfügbar!');
//       return;
//     }

//     // Öffne Eingabemaske
//     modal.style.display = 'block';

//     // Bestätigungsbutton: PDF generieren
//     confirmBtn.onclick = () => {
//       const header = document.getElementById('headerText').value;
//       const footer = document.getElementById('footerText').value;
//       modal.style.display = 'none';

//       try {
//         generateOfferPDF(data, header, footer);
//       } catch (error) {
//         console.error('Fehler beim PDF-Export:', error);
//       }
//     };

//     // Abbrechen
//     cancelBtn.onclick = () => {
//       modal.style.display = 'none';
//     };
//   });
// }

// Angebot-Export (PDF)
const offerPDFButton = document.getElementById('offerPDFButton');
const modal = document.getElementById('pdfTextModal');
const confirmBtn = document.getElementById('confirmPDF');
const cancelBtn = document.getElementById('cancelPDF');

if (offerPDFButton) {
  offerPDFButton.addEventListener('click', () => {
    const data = appState.getFilteredPortData();

    if (!data || data.length === 0) {
      alert('❌ Keine Angebotsdaten verfügbar!');
      return;
    }

    const customerArr = appState.getCustomerData();
    const customer = Array.isArray(customerArr) ? customerArr[0] : customerArr;

    if (customer) {
      document.getElementById('headerText').value = customer.pdf_header || '';
      document.getElementById('footerText').value = customer.pdf_footer || '';
    }

    modal.style.display = 'block';

    confirmBtn.onclick = async () => {
      const header = document.getElementById('headerText').value;
      const footer = document.getElementById('footerText').value;
      modal.style.display = 'none';

      const customerArr = appState.getCustomerData();
      const customer = Array.isArray(customerArr) ? customerArr[0] : customerArr;

      if (customer && customer.id) {
        console.log('📤 Sende update-customer-texts:', customer.id, header, footer);
        window.api.send('update-customer-texts', {
          customer_id: customer.id,
          pdf_header: header,
          pdf_footer: footer
        });
      }

      const data = appState.getFilteredPortData();
      await generateOfferPDF(data, header, footer); // Chart wird intern gerendert
    };

    cancelBtn.onclick = () => {
      modal.style.display = 'none';
    };
  });
}






  // RISK-Export (PDF)
const riskPDFButton = document.getElementById('riskPDFButton');
if (riskPDFButton) {
  riskPDFButton.addEventListener('click', () => {
    const data = appState.getFilteredPortData();

    if (!data || data.length === 0) {
      alert('❌ Keine Angebotsdaten verfügbar!');
      return;
    }

    try {
      generateRiskPDF(data);
    } catch (error) {
      console.error('Fehler beim PDF-Export:', error);
    }
  });
}

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

  // Offers Dropdown (NEU)
  setupDropdown({
    dropdownId: 'createdOffersDropdown',
    getDataFunction: appState.getOffersNameList,              // kommt aus deiner Trennung OFFER(S)_
    updateDataFunction: appState.updateOffersDataTable,               // -> ruft handleDealsData(...)
    setSelectedDealsTableName: appState.setSelectedDealsTableName,
    setSelectedPortTableName: appState.setSelectedPortTableName, // (optional)
    setActiveTable: () => appState.setActiveElementId('offersDataContainer')
  });



  // Portfolio Dropdowns (0, 1, 2)
  ['0','1','2'].forEach(num => {
    setupDropdown({
      dropdownId: `createdPortDropdown${num}`,
      getDataFunction: appState.getPortNameList,
      updateDataFunction: appState.updatePortDataTable,
      updateMvarDistDataFunction: appState.updateMvarDistData,
      //updateCvarDataFunction: appState.updateCvarDataTable,
      setSelectedPortTableName: appState.setSelectedPortTableName,
      setActiveTable: () => appState.setActiveElementId(`portDataContainer${num}`),
      index: parseInt(num) // 🆕 übergeben!
    });
  });
}
  //START PYTHON PROJECTS and so on...:

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
          //console.log(`🔄 Portfolio ausgewählt: ${selectedTableName} (Index: ${index})`);

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

// // Debounce helper
// const debounce = (fn, wait = 180) => {
//   let t;
//   return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), wait); };
// };

// // Stale-Work-Dropper (nur letztes Event gewinnt)
// let _dropdownWorkToken = 0;
// // Optional: Busy-Flag, falls du strikt seriell arbeiten willst
// let _dropdownBusy = false;

// export function setupDropdown({
//   dropdownId,
//   getDataFunction,
//   updateDataFunction,
//   updateMvarDataFunction,
//   updateCvarDataFunction,
//   updateEADDataFunction,
//   setSelectedPortTableName,
//   setSelectedDealsTableName,
//   setActiveTable,
//   index
// }) {
//   const dropdown = document.getElementById(dropdownId);
//   if (!dropdown) return;

//   // Doppeltes Binden verhindern
//   if (dropdown.dataset.listenerBound === '1') return;
//   dropdown.dataset.listenerBound = '1';

//   const onChangeLight = (event) => {
//     const selectedTableName = event.target.value;

//     // Leichte State-Updates
//     if (setSelectedDealsTableName) appState.setSelectedDealsTableName(selectedTableName);
//     if (setSelectedPortTableName)  appState.setSelectedPortTableName(selectedTableName);
//     if (setActiveTable)            setActiveTable();

//     const myToken = ++_dropdownWorkToken;
//     debouncedHeavyUpdate({ selectedTableName, dropdownId, myToken, index });
//   };

//   const debouncedHeavyUpdate = debounce(({ selectedTableName, dropdownId, myToken, index }) => {
//     // Falls gerade ein altes Update läuft: Nur den letzten Zustand behalten
//     const run = () => {
//       if (myToken !== _dropdownWorkToken) return;  // stale
//       if (_dropdownBusy) {
//         // in 50ms nochmal probieren; stale-check bleibt aktiv
//         setTimeout(run, 50);
//         return;
//       }
//       _dropdownBusy = true;

//       const opts = {
//         dropdownElementId: dropdownId,
//         getDataFunction: getDataFunction?.bind(appState),
//         updateDataFunction: updateDataFunction ? updateDataFunction.bind(appState) : undefined,
//         updateMvarDataFunction: updateMvarDataFunction ? updateMvarDataFunction.bind(appState) : undefined,
//         updateCvarDataFunction: updateCvarDataFunction ? updateCvarDataFunction.bind(appState) : undefined,
//         updateEADDataFunction: updateEADDataFunction ? updateEADDataFunction.bind(appState) : undefined,
//         selectedTableName,
//         index
//       };

//       // ✨ Schwere Arbeit in Idle-Zeit (kein rAF → keine rAF-Violation)
//       const apply = () => {
//         if (myToken !== _dropdownWorkToken) { _dropdownBusy = false; return; } // stale
//         try {
//           // Optional: Minimale Reflow-Scope-Reduktion während des Writes
//           const root = document.querySelector('.data-container, .table-content, body');
//           const prevContain = root && root.style.contain;
//           if (root) root.style.contain = 'layout paint style';

//           appState.updateDropdownOptions(opts);   // <- heavy DOM work here

//           if (root) root.style.contain = prevContain || '';
//         } finally {
//           _dropdownBusy = false;
//         }
//       };

//       if ('requestIdleCallback' in window) {
//         requestIdleCallback(apply, { timeout: 500 });
//       } else {
//         // Fallback: entkoppeln, aber NICHT im rAF (vermeidet rAF-Logs)
//         setTimeout(apply, 0);
//       }
//     };

//     run();
//   }, 180);

//   dropdown.addEventListener('change', onChangeLight, { passive: true });
// }





    
function setupButtons() {
  document.getElementById('saveSelectionButton').addEventListener('click', handleSaveSelection);
  document.getElementById('deleteTableButton').addEventListener('click', handleDeleteSelection);
  // document.getElementById('inputMVaRSave-button').addEventListener('click', handleSaveClick, { once: true });
  document.getElementById('applyYearsForwardButton').addEventListener('click', handleSwapForwardCurve);

  document.getElementById('importExcelButtonVXP')?.addEventListener('click', handleExcelImport);
  document.getElementById('importEUSWButton').addEventListener('click', () => {handleExcelImport(['EUSW']);});


  document.getElementById('matchColumnsButton')?.addEventListener('click', () => {handleAIColumnProject();});
  
  document.getElementById('submitToProductsBtn')?.addEventListener('click', () => {handleSubmitMatchedColumns('productMatchesOutput', 'ProdAll');});
  document.getElementById('submitToOffersBtn')?.addEventListener('click', () => {handleSubmitMatchedColumns('offerMatchesOutput', 'DealsMain', { port_name: 'LGT' });});
  // document.getElementById('importOffersBtn')?.addEventListener('click', () => {handleSubmitMatchedColumns('offerMatchesOutput', 'DealsMain', { port_name: 'LGT' });});
  document.getElementById('importOffersBtn')?.addEventListener('click', () => {startOfferImport();});
  // document.getElementById('importOffersIssuerBtn')?.addEventListener('click', () => {showIssuerMatching();});
  // document.getElementById('importOffersProdBtn')?.addEventListener('click', () => {checkAndInsertProducts();});
  // document.getElementById('submitMatchingBtn')?.addEventListener('click', () => {checkAndInsertProducts();});
  document.getElementById("submitMatchingBtn")?.addEventListener("click", () => {handleSubmitMatching();});
  document.getElementById("btnQuickImport")?.addEventListener("click", () => {  quickImportWithStandardMapping();});













  

  //PROVIDERS
  const providers = [
    { id: 'ecbTab', container: 'inputEcb-container', button: 'ecbAddButton' },
    { id: 'fedTab', container: 'inputFed-container', button: 'fedAddButton' },
    { id: 'yahooTab', container: 'inputYahoo-container', button: 'yahooAddButton' },
  ];

    providers.forEach(({ id }) => {
      document.getElementById(id)?.addEventListener('click', () => handleProviderClick(id, providers));
    });




  // PYTHON EXECUTION:
  // Standard Buttons
  const projectButtons = [
    { buttonId: 'fairValueButton', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton1', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton2', projectName: 'py-fairValue' },
    // { buttonId: 'MVaRButton', projectName: 'py-MVaR' },
    // { buttonId: 'mvaRDistButton', projectName: 'py-MVaR' },
    { buttonId: 'CVaRButton', projectName: 'py-CVaR' },
    { buttonId: 'updateDataExcelButton', projectName: 'py-excel' },
    { buttonId: 'CSParButton', projectName: 'py-cspar' },
    { buttonId: 'MLButton', projectName: 'py-ml' },
    { buttonId: 'matchColumnsButton', projectName: 'py-matchColumns' },

    { buttonId: 'updateHistoricDataButton', projectName: 'py-historicData' },
    { buttonId: 'histEcbButton', projectName: 'py-hist' },
    { buttonId: 'histFedButton', projectName: 'py-hist' },
    { buttonId: 'histYahooButton', projectName: 'py-hist' },
    // { buttonId: 'histFinnhubButton', projectName: 'py-hist' }
  ];
  
  projectButtons.forEach(({ buttonId, projectName, extraParam }) => {
    const button = document.getElementById(buttonId);
    button.addEventListener('click', () =>
      handleProjectButtonClick(button, projectName, extraParam)
    );
  });
  // Special Buttons: mit Radio-Select (wird im dataProcessor.js dynamisch erzeugt!)
    // MVaR-Buttons: Beide Buttons mit Szenario
    ['mvaRDistButton'].forEach((buttonId) => {
      const button = document.getElementById(buttonId);
      if (button) {
        button.addEventListener('click', (event) => {
          const selectedRadio = document.querySelector('.scenario-radio:checked');
          if (!selectedRadio) {
            alert('Select a Timeperiode!');
            return;
          }
          const selectedInterval = selectedRadio.getAttribute('data-interval');
          console.log('✅ Selected scenario:', selectedInterval);

          handleProjectButtonClick(event.target, 'py-MVaR', { selectedInterval });
        });
      }
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
  // function handleDealsNameList(receivedData) {
  //   try {
  //       //console.log('Received Alle Deals Daten:', receivedData);
        
  //       // Extract unique portfolio names from the port_name column
  //       const uniquePortNames = [...new Set(receivedData.map(entry => entry.port_name).filter(name => name))];

  //       // Transform into dropdown-compatible format
  //       const uniquePortfolios = uniquePortNames.map(name => ({ table_name: name }));

  //       // Save the unique deals portfolios
  //       appState.setDealsNameList(uniquePortfolios, 'createdDealsDropdown');

  //       // Update the dropdown
  //       appState.applyFiltersAndUpdateDropdowns('dealsTables');

  //       //console.log('✅ Unique deals portfolios:', uniquePortfolios);
  //   } catch (error) {
  //       console.error("❌ Error processing created deals data:", error);
  //   }
  // }

  // PORTFOLIO
// // Hilfsfunktion: erkennt OFFER_/OFFERS_ (case-insensitive)
const isOfferName = (name) =>
  typeof name === 'string' && /^OFFERS?_/.test(name.toUpperCase());

/** NUR Namen ohne OFFER(S)_ ins Deals-Dropdown **/
function handleDealsNameList(receivedData) {
  try {
    const names = (receivedData || []).map(e => e.port_name).filter(Boolean);
    const unique = [...new Set(names)];
    const dealsOnly = unique.filter(n => !isOfferName(n));
    const dealsList = dealsOnly.map(name => ({ table_name: name }));

    // Speichern & Dropdown aktualisieren
    if (typeof appState.setDealsNameList === 'function') {
      appState.setDealsNameList(dealsList, 'createdDealsDropdown');
    }
    if (typeof appState.applyFiltersAndUpdateDropdowns === 'function') {
      appState.applyFiltersAndUpdateDropdowns('dealsTables');
    }
  } catch (error) {
    console.error("❌ Error processing deals name list:", error);
  }
}

/** NUR Namen mit OFFER(S)_ ins Offers-Dropdown **/
function handleOffersNameList(receivedData) {
  try {
    const names = (receivedData || []).map(e => e.port_name).filter(Boolean);
    const unique = [...new Set(names)];
    const isOffer = (n) => typeof n === 'string' && /^OFFERS?_/.test(n.toUpperCase());
    const offersList = unique.filter(isOffer).map(name => ({ table_name: name }));

    // nur Liste setzen …
    if (typeof appState.setOffersNameList === 'function') {
      appState.setOffersNameList(offersList, 'createdOffersDropdown');
    }

    // … und deine bestehende Update-Pipeline triggern
    if (typeof appState.applyFiltersAndUpdateDropdowns === 'function') {
      appState.applyFiltersAndUpdateDropdowns('offersTables'); // falls du diese Gruppe nutzt
    }
  } catch (error) {
    console.error("❌ Error processing offers name list:", error);
  }
}






    document.addEventListener('change', (e) => {
  const dd = e.target;
  if (!dd || dd.id !== 'createdOffersDropdown') return;

  const port_name = dd.value;
  appState.setSelectedDealsTableName(port_name);
  appState.setSelectedPortTableName(port_name);

  const all = (appState.getAllDealsData && appState.getAllDealsData()) || [];
  const rows = all.filter(r => r?.port_name === port_name);

  // deine handleDealsData routed OFFER(S)_ automatisch in offersDataContainer
  appState.handleDealsData(rows, port_name);
});





// Created PORT data
  // function handlePortNameList(receivedData) {
  // try {
  //     //console.log('Received Alle Portfolio Daten:', receivedData);

  //     // Extract unique portfolio names from port_name column
  //     const uniquePortNames = [...new Set(receivedData.map(entry => entry.port_name).filter(name => name))];

  //     // Transform into dropdown-compatible format
  //     const uniquePortfolios = uniquePortNames.map(name => ({ table_name: name }));

  //     // Update each dropdown with unique portfolio names
  //     ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdown, index) => {
  //         appState.setPortNameList(uniquePortfolios, dropdown);
  //         appState.applyFiltersAndUpdateDropdowns(`portTables${index}`);
  //     });

  //     //console.log('✅ Unique portfolios for dropdowns:', uniquePortfolios);
  // } catch (error) {
  //     console.error("❌ Error processing created port data:", error);
  // }
  // }
  function handlePortNameList(receivedData) {
  try {
    const isOffer = (n) => typeof n === 'string' && /^OFFERS?_/i.test(n);

    const names = (receivedData || [])
      .map(e => e?.port_name)
      .filter(Boolean)
      .filter(n => !isOffer(n)); // ❗ Angebote rausfiltern

    const uniquePortfolios = [...new Set(names)].map(name => ({ table_name: name }));

    ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdown, index) => {
      appState.setPortNameList(uniquePortfolios, dropdown);
      appState.applyFiltersAndUpdateDropdowns(`portTables${index}`);
    });
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
            case 'py-matchColumns':
                handleAIColumnProject(extraParam);
                break;

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

            case 'py-hist':
              // 💡 Ergänze hier die API je nach Button-ID
              const apiMap = {
                histEcbButton: 'ECB',
                histFedButton: 'FED',
                histYahooButton: 'Yahoo'
              };
              const apiSource = apiMap[buttonElement.id];
              if (apiSource) extraParam.api = apiSource;
        
              handleHistProject(buttonElement, extraParam);
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
          // function handleFairValueComplete(data) {
          //   // console.log('📌 handleFairValueComplete wurde ausgelöst:', data);
          //   if (data.projectName === 'py-fairValue') {
          //     // 🛠 1️⃣ Setzt die aktive Tabelle auf "deals"
          //     appState.setActiveTable('deals');
          //     appState.setActiveElementId('portDataContainer0')
      
          //     // 🛠 2️⃣ Holt den Portfolionamen aus Deals
          //     const port_name = appState.getSelectedDealsTableName();
          //     // console.log('🔹 Neues Portfolio:', port_name);




      
          //    // Antwort nur für Button:
          //     handleProjectResponse(document.getElementById('fairValueButton'), data.projectName, data);

          //     // 🛠 3️⃣ Holt die aktuellsten Portfolio-Daten **vor** dem Update der Dropdowns
          //     fetchAndUpdateFairValueData();
          //   }
          // }

          // function handleFairValueComplete(data) {
          //   console.log('📌 handleFairValueComplete wurde ausgelöst:', data);
          //   if (data.projectName === 'py-fairValue') {

          //     // 🔎 1) Portfolioname holen und auf OFFER(S)_ prüfen (case-insensitive)
          //     const port_name = (appState.getSelectedDealsTableName && appState.getSelectedDealsTableName()) || '';
          //     const isOffer = /^OFFERS?_/.test(String(port_name).toUpperCase());

          //     // 🛠 2) Aktive Ansicht je nach Prefix setzen
          //     if (isOffer) {
          //       appState.setActiveTable('offers');
          //       appState.setActiveElementId('portDataContainer4');
          //       fetchAndUpdateFairValueOffersData();
          //     } else {
          //       appState.setActiveTable('deals');
          //       appState.setActiveElementId('portDataContainer0');
          //       fetchAndUpdateFairValueData();
          //     }

          //     // 👉 3) Antwort nur für Button:
          //     handleProjectResponse(document.getElementById('fairValueButton'), data.projectName, data);

          //     // 🔁 4) Aktuellste Portfolio-Daten laden/aktualisieren
          //     // fetchAndUpdateFairValueData();
          //   }
          // }

          //     function fetchAndUpdateFairValueData() {
          //       window.api.receive('PortfoliosData', (receivedData) => {
          //       // console.log(`✅ Updated PortfoliosData Data:`, receivedData);
          //       // Neue Daten mit MATURITY_YEAR hinzufügen
          //         const enhancedData = receivedData    //addMaturityYearToData(receivedData);

          //         if (!enhancedData || enhancedData.length === 0) {
          //           console.warn("⚠️ No new Portfolios data received!");
          //           appState.setAllPortfolioData([]);
          //           return;
          //         }
              
          //         appState.setAllPortfolioData(enhancedData);
          //         //console.log(`🔄 UI should now update with`, appState.getAllPortfolioData());
              
          //         // 🔹 Jetzt: Verarbeitung erst NACH dem Empfang
          //         const port_name = appState.getSelectedPortTableName(); // oder getSelectedPortTableName(), je nach Kontext
          //           if (!port_name) {
          //             console.warn("⚠️ Kein Portfolio ausgewählt.");
          //             return;
          //           }
                  
          //         const filteredData = enhancedData.filter(entry => entry.port_name === port_name);
          //         //appState.updatePortDataTable(filteredData, 0);
          //         appState.updatePortDataTable(filteredData);
          //         //console.log('✅ Portfolio filteredData:', filteredData, port_name);
              
          //         // 🛠 Dropdowns aktualisieren
          //         ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdownId, index) => {
          //           appState.updateDropdownOptions({
          //             dropdownElementId: dropdownId,
          //             getDataFunction: appState.getPortNameList.bind(appState),
          //             updateDataFunction: appState.getPortfolioData.bind(appState),
          //             selectedTableName: index === 0 ? port_name : undefined
          //           });
          //         });
              
          //         // 🛠 Portfolio setzen
          //         // console.log('port_name', port_name);
          //         appState.setSelectedPortTableName(port_name);
          //         appState.setSelectedDealsTableName(port_name);
          //         //console.log('✅ Portfolio-Daten & Dropdowns aktualisiert.');

          //         handlePortAggData(filteredData, 3, port_name);
          //         openPortAnalyseAndFocus(port_name);
                  
          //       });
              
          //       // 📤 Erst jetzt senden
          //       window.api.send('fetch-table-data', 'Portfolios');
          //     }
          //     function fetchAndUpdateFairValueOffersData() {
          //       window.api.receive('PortfoliosData', (receivedData) => {
          //       // console.log(`✅ Updated PortfoliosData Data:`, receivedData);
          //       // Neue Daten mit MATURITY_YEAR hinzufügen
          //         const enhancedData = receivedData    //addMaturityYearToData(receivedData);

          //         if (!enhancedData || enhancedData.length === 0) {
          //           console.warn("⚠️ No new Portfolios data received!");
          //           appState.setAllPortfolioData([]);
          //           return;
          //         }
              
          //         appState.setAllPortfolioData(enhancedData);
          //         //console.log(`🔄 UI should now update with`, appState.getAllPortfolioData());
              
          //         // 🔹 Jetzt: Verarbeitung erst NACH dem Empfang
          //         const port_name = appState.getSelectedPortTableName(); // oder getSelectedPortTableName(), je nach Kontext
          //           if (!port_name) {
          //             console.warn("⚠️ Kein Portfolio ausgewählt.");
          //             return;
          //           }
                  
          //         const filteredData = enhancedData.filter(entry => entry.port_name === port_name);
          //         //appState.updatePortDataTable(filteredData, 0);
          //         appState.updateOffersDataTable(filteredData);
          //         //console.log('✅ Portfolio filteredData:', filteredData, port_name);
              
          //         // 🛠 Dropdowns aktualisieren
          //         ['createdOffersDropdown'].forEach((dropdownId, index) => {
          //           appState.updateDropdownOptions({
          //             dropdownElementId: dropdownId,
          //             getDataFunction: appState.getPortNameList.bind(appState),
          //             updateDataFunction: appState.getPortfolioData.bind(appState),
          //             selectedTableName: index === 0 ? port_name : undefined
          //           });
          //         });
              
          //         // 🛠 Portfolio setzen
          //         // console.log('port_name', port_name);
          //         appState.setSelectedPortTableName(port_name);
          //         appState.setSelectedDealsTableName(port_name);
          //         //console.log('✅ Portfolio-Daten & Dropdowns aktualisiert.');

          //         //handlePortAggData(filteredData, 3, port_name);
          //         //openPortAnalyseAndFocus(port_name);
                  
          //       });
              
          //       // 📤 Erst jetzt senden
          //       window.api.send('fetch-table-data', 'Portfolios');
          //     }

          function handleFairValueComplete(data) {
            console.log('📌 handleFairValueComplete wurde ausgelöst:', data);
            if (data.projectName !== 'py-fairValue') return;

            const port_name = String(appState.getSelectedDealsTableName?.() || '');
            const isOffer = /^OFFERS?_/i.test(port_name);

            if (isOffer) {
              appState.setActiveTable('offers');
              //appState.setActiveElementId('portDataContainer4');
              appState.setActiveElementId('offersDataContainer'); 
              // pass den Namen durch
              fetchAndUpdateFairValueOffersData(port_name);
            } else {
              appState.setActiveTable('deals');
              appState.setActiveElementId('portDataContainer0');
              fetchAndUpdateFairValueData(port_name);
            }

            // Button-Rückmeldung (nimmt fairValueButton2, wenn vorhanden)
            const btn = document.getElementById('fairValueButton2') || document.getElementById('fairValueButton');
            if (typeof handleProjectResponse === 'function') {
              handleProjectResponse(btn, data.projectName, data);
            }
          }
              function fetchAndUpdateFairValueData(port_name) {
                const onData = (receivedData) => {
                  const enhancedData = receivedData; // ggf. addMaturityYearToData(receivedData)
                  if (!Array.isArray(enhancedData) || !enhancedData.length) {
                    console.warn("⚠️ No new Portfolios data received!");
                    appState.setAllPortfolioData([]);
                    return;
                  }
                  if (!port_name) {
                    console.warn("⚠️ Kein Portfolio ausgewählt.");
                    return;
                  }

                  appState.setAllPortfolioData(enhancedData);
                  const filteredData = enhancedData.filter(e => e.port_name === port_name);

                  appState.updatePortDataTable?.(filteredData);

                  ['createdPortDropdown0','createdPortDropdown1','createdPortDropdown2'].forEach((dropdownId, index) => {
                    appState.updateDropdownOptions?.({
                      dropdownElementId: dropdownId,
                      getDataFunction: appState.getPortNameList.bind(appState),
                      updateDataFunction: appState.getPortfolioData?.bind(appState),
                      selectedTableName: index === 0 ? port_name : undefined
                    });
                  });

                  appState.setSelectedPortTableName?.(port_name);
                  appState.setSelectedDealsTableName?.(port_name);

                  if (typeof handlePortAggData === 'function') handlePortAggData(filteredData, 3, port_name);
                  if (typeof openPortAnalyseAndFocus === 'function') openPortAnalyseAndFocus(port_name);
                };

                if (window.api.once) window.api.once('PortfoliosData', onData);
                else window.api.receive('PortfoliosData', onData); // Fallback

                window.api.send('fetch-table-data', 'Portfolios');
              }
              function fetchAndUpdateFairValueOffersData(port_name) {
                const onData = (receivedData) => {
                  const enhancedData = receivedData;
                  if (!Array.isArray(enhancedData) || !enhancedData.length) {
                    console.warn("⚠️ No new Portfolios data received!");
                    appState.setAllPortfolioData([]);
                    return;
                  }
                  if (!port_name) {
                    console.warn("⚠️ Kein Portfolio ausgewählt.");
                    return;
                  }

                  appState.setAllPortfolioData(enhancedData);
                  const filteredData = enhancedData.filter(e => e.port_name === port_name);

                  // Tabelle rechts aktualisieren
                  appState.updateOffersDataTable?.(filteredData);

                  // Offers-Dropdown mit Offer-Liste (nicht Port-Liste) befüllen
                  appState.updateDropdownOptions?.({
                    dropdownElementId: 'createdOffersDropdown',
                    getDataFunction: (appState.getOffersNameList || appState.getDealsNameList).bind(appState),
                    updateDataFunction: appState.updateOffersDataTable?.bind(appState),
                    selectedTableName: port_name
                  });

                  appState.setSelectedDealsTableName?.(port_name);
                  appState.setSelectedPortTableName?.(port_name);
                };

                if (window.api.once) window.api.once('PortfoliosData', onData);
                else window.api.receive('PortfoliosData', onData); // Fallback

                window.api.send('fetch-table-data', 'Portfolios');
              }
                  function openPortAnalyseAndFocus(portName) {
                    // Tab öffnen (dein Tabs-Init hängt am Button mit id="PORT_Tab")
                    document.getElementById('PORT_Tab')?.click();

                    // Dropdown auswählen + hervorheben
                    setTimeout(() => {
                      const dd = document.getElementById('createdPortDropdown0');
                      if (!dd) return;

                      // Wenn ein Portfolioname übergeben wurde, im Dropdown anwählen
                      if (portName) {
                        const opt = Array.from(dd.options).find(o => o.value === portName || o.text === portName);
                        if (opt) {
                          dd.value = opt.value;
                          // falls deine Logik auf change hört:
                          dd.dispatchEvent(new Event('change', { bubbles: true }));
                        }
                      }

                      dd.scrollIntoView({ behavior: 'smooth', block: 'center' });
                      dd.focus({ preventScroll: true });
                      dd.classList.add('pulse');
                      setTimeout(() => dd.classList.remove('pulse'), 1400);
                    }, 200);
                  }


        
      function handleMVaRProject(buttonElement, extraParam) {
        const selectedTableName = appState.getSelectedPortTableName();

        if (!selectedTableName) {
          throw new Error('No table selected for MVaR processing.');
        }

        if (!extraParam.selectedInterval) {
          throw new Error('No scenario selected. Bitte wähle ein Szenario mit dem Radio-Button aus.');
        }

        const payload = {
          tableName: selectedTableName,
          selectedInterval: extraParam.selectedInterval, // nur der Intervall-Name
        };

        console.log('🚀 Sending payload for py-MVaR:', payload);
        window.api.send('start-py-MVaR', payload);
      }

          function handleMVaRComplete(data) {
            if (data.projectName === 'py-MVaR') {
              appState.setActiveTable('port');
          
              const port_name = appState.getSelectedPortTableName();
              //appState.fetchAndHandlePortData(port_name, 'portDataContainer0');
          
              // handleProjectResponse(document.getElementById('MVaRButton'), data.projectName, data);
              handleProjectResponse(document.getElementById('mvaRDistButton'), data.projectName, data);
              fetchAndUpdateMVarData(port_name);
        
              const mvarData = appState.getAllMvarData();
              handleMVaRData(mvarData, 0);


              const mvarDistData = appState.getMvarDistData();
              handleSummaryRMData(mvarDistData, 0, port_name);
            }
          }
              function fetchAndUpdateMVarData(port_name) {
                console.log(`fetchAndUpdateMVarData`);

                // ✅ Listen for MarketVaR data
                window.api.receive('MarketVaRData', (receivedData) => {
                  console.log(`MVaRData:`, receivedData);
                  if (!receivedData || receivedData.length === 0) {
                    console.warn("⚠️ No new MarketVaR data received!");
                    appState.updateMvarDataTable([]); // Store empty array
                  } else {
                    appState.updateMvarDataTable(receivedData,);
                  }
                });

                // ✅ Listen for MarketVaRMainDist data
                window.api.receive('MVaRMainDistData', (receivedData) => {
                  console.log(`MVaRMainDistData:`, receivedData);
                  if (!receivedData || receivedData.length === 0) {
                    console.warn("⚠️ No new MarketVaRMainDist data received!");
                    appState.updateMvarDistData([]); // Store empty array
                  } else {
                    appState.updateMvarDistData(receivedData, 0, port_name);
                  }
                });

                // ✅ Request both tables from the backend
                window.api.send('fetch-table-data', 'MarketVaR');
                window.api.send('fetch-table-data', 'MVaRMainDist');
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
      //CS    
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
      //AI columns
      function handleAIColumnProject(buttonElement, extraParam = {}) {
        const port_name = appState.getSelectedDealsTableName();
      
        // 🧠 Extract input columns from LLBData (previously set)
        const offerData = appState.getOfferData(); // e.g., from INPUT_LLB
        const inputColumns = offerData && offerData.length > 0
          ? Object.keys(offerData[0])
          : [];
      
        // // 🎯 Extract product target columns
        // const productData = appState.getProdData(); // e.g., from ProdAll
        // const productTargetColumns = productData && productData.length > 0
        //   ? Object.keys(productData[0])
        //   : [];

        const productTargetColumns = [
          'PROD_ID', 'DESCRIPTION', 'START_DATE', 'MATURITY',
          'COUPON', 'GEARING', 'SPREADS', 'CAP', 'FLOOR', 'TENOR',
          'ISSUER', 'TICKER', 'RATING_PROD', 'RANK'
        ]
      
        // // 🎯 Extract offer target columns
        // const dealData = appState.getAllDealsData(); // e.g., from DealsMain
        // const offerTargetColumns = dealData && dealData.length > 0
        //   ? Object.keys(dealData[0])
        //   : [];

        const offerTargetColumns= [
            'PROD_ID', 'PRICE_BUY', 'TRADE_DATE'
          ]

          displayTargetColumns(productTargetColumns, 'productTargetsOverview');
          displayTargetColumns(offerTargetColumns, 'offerTargetsOverview');
      
        // 🔧 Build payload
        const payload = {
          tableName: port_name,
          inputColumns,
          productTargetColumns,
          offerTargetColumns
        };
      
        console.log("📤 Sending payload for py-matchColumns:", payload);
        window.api.send('start-py-matchColumns', payload);
      }
          function handleAIColumnComplete(data) {
            if (data.projectName === 'py-matchColumns') {
              const button = document.getElementById('matchColumnsButton');
              handleProjectResponse(button, data.projectName, data);
          
              if (data.success) {
                console.log('✅ Full match data:', data); // ✅ Log the structure
          
                const product_matches = data.product_matches || [];
                const offer_matches = data.offer_matches || [];

                displayMatchTable(product_matches, 'productMatchesOutput');
                displayMatchTable(offer_matches, 'offerMatchesOutput');

                markPerfectMatches(product_matches, 'productTargetsOverview');
                markPerfectMatches(offer_matches, 'offerTargetsOverview');
          
                fetchAndUpdateColumnMatchResults();
              } else {
                alert('⚠️ AI column matching failed: ' + (data.error || 'Unknown error'));
              }
            }
          }
          function fetchAndUpdateColumnMatchResults() {
            window.api.receive('ColumnMatchesData', (receivedData) => {
              if (!receivedData || receivedData.length === 0) {
                console.warn("⚠️ No column match data received.");
                return;
              }
          
              console.log('✅ Column match result:', receivedData);
              // You could render this into a table/modal
            });
          
            window.api.send('fetch-table-data', 'ColumnMatches'); // if you use a table for matches
          }
          function displayMatchTable(matches, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
          
            const rows = matches.map((match, index) => {
              const checked = match.similarity === 1.0 ? 'checked' : '';
              const checkboxId = `match-checkbox-${containerId}-${index}`;
              return `
                <tr>
                  <td>${match.from}</td>
                  <td>→</td>
                  <td>${match.to}</td>
                  <td>${(match.similarity * 100).toFixed(1)}%</td>
                  <td>
                    <input type="checkbox" id="${checkboxId}" data-target="${match.to}" data-target-container="${containerId.includes('product') ? 'productTargetsOverview' : 'offerTargetsOverview'}" ${checked}>
                  </td>
                </tr>
              `;
            }).join('');
          
            container.innerHTML = `
              <table border="1" cellpadding="5">
                <thead><tr><th>Input</th><th></th><th>Target</th><th>Similarity</th><th>✔</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            `;
          
            // Add checkbox syncing
            const checkboxes = container.querySelectorAll('input[type="checkbox"]');
            checkboxes.forEach(cb => {
              cb.addEventListener('change', () => {
                const targetId = `target-${cb.dataset.target}`;
                const targetContainer = document.getElementById(cb.dataset.targetContainer);
                const targetCheckbox = targetContainer?.querySelector(`input[id="${targetId}"]`);
                if (targetCheckbox) {
                  targetCheckbox.checked = cb.checked;
                }
              });
            });
          }        
          function displayTargetColumns(targets, containerId) {
            const container = document.getElementById(containerId);
            if (!container) return;
          
            const rows = targets.map(target => `
              <tr>
                <td>${target}</td>
                    <td><input type="checkbox" id="target-${target}"></td>
              </tr>
            `).join('');
          
            container.innerHTML = `
              <table border="1" cellpadding="5">
                <thead><tr><th>Target Column</th><th>Assigned?</th></tr></thead>
                <tbody>${rows}</tbody>
              </table>
            `;
          }
          function markPerfectMatches(matches, containerId) {
            matches
              .filter(m => m.similarity === 1.0)
              .forEach(m => {
                const checkbox = document.querySelector(`#${containerId} input[id="target-${m.to}"]`);
                if (checkbox) checkbox.checked = true;
              });
          }
          function handleSubmitMatchedColumns(matchContainerId, targetTable, additionalFields = {}) {
            const matches = collectConfirmedMatches(matchContainerId);
          
            // Bei Offers zusätzliche Felder ergänzen
            if (targetTable === 'DealsMain') {
              additionalFields = {
                ...additionalFields,
                INCLUDE: 1,
                CATEGORY: '2_lgfr_Anlagevermögen',
                NOTIONAL: 1000000,
                Depotbank: additionalFields.port_name || 'LGT'
              };
            }
          
            window.api.send('import-matched-columns', {
              sourceTable: 'LGT',
              targetTable,
              columnMap: matches,
              additionalFields
            });
          }
          function collectConfirmedMatches(containerId) {
            const container = document.getElementById(containerId);
            if (!container) return [];
          
            const checkboxes = container.querySelectorAll('input[type="checkbox"]:checked');
            return Array.from(checkboxes).map(cb => {
              const row = cb.closest('tr');
              return {
                from: row.cells[0].textContent.trim(),
                to: row.cells[2].textContent.trim()
              };
            });
          }
      //HIST    
      function handleHistProject(buttonElement, extraParam) {

        lastHistButton = buttonElement;

        const payload = {
          //tableName: null, // oder ein tatsächlicher Tabellenname
          ...extraParam,   // z. B. { api: 'ECB' }
        };
      
        window.api.send('start-py-historicData', payload);
      }
          function handleHistComplete(data) {
            if (data.projectName === 'py-historicData') {
              if (lastHistButton) {
                handleProjectResponse(lastHistButton, data.projectName, data);
                lastHistButton = null;  // Optional: aufräumen
              }

              fetchAndUpdateHistData();
            }
          }
              function fetchAndUpdateHistData() {
                window.api.receive('tblTSData', (receivedData) => {
                  if (!receivedData || receivedData.length === 0) {
                    console.warn("⚠️ No HIST data received!");
                    return;
                  }
              
                  // Update deiner AppState z. B.
                  //appState.setAllHistData(receivedData);
              
                  // Tabelle aktualisieren oder weiterleiten an UI
                  const latest = receivedData[receivedData.length - 1];
                  console.log('📊 Latest HIST row:', latest);
                });
              
                window.api.send('fetch-table-data', 'tblTS');
              }
          
      
  //py-Projects SEND DATA to main       
  function sendPayloadToAPI(projectName, tableName, extraParam) {
        const payload = {
          tableName,
          ...extraParam,
        };
      
        //console.log(`🚀 Sending payload for ${projectName}:`, payload);
        window.api.send(`start-${projectName}`, payload);
      }
  //py-Projects FINISH
  function handleProjectFinished(data) {
    const projectButtonMap = {
      // 'py-MVaR': 'MVaRButton',
      'py-MVaR': 'mvaRDistButton',
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
      function handleProjectResponse(buttonElement, projectName, response) {
        //console.log('handleProjectResponse', projectName);

      const projectLabels = {
        'py-fairValue': 'Fair Value',
        'py-MVaR': 'P/L Dist',
        'py-CVaR': 'Credit VaR',
        'py-ml': 'Machine Learning',
        'py-excel': 'Excel Update',
        'py-cspar': 'CS Parser',
        'py-matchColumns': 'Match Columns',
        'py-historicData': 'Historic Data',
        'py-hist': 'Historical Update',
        // add more mappings as needed
      };




        buttonElement.disabled = false;
        buttonElement.textContent = projectLabels[projectName] || 'Unknown';

        if (response.success) {
          //console.log(`${projectName} executed successfully.`);
        } else {
          console.error(`Error starting ${projectName}:`, response.error);
        }
      }


  //CUSTOMER
    function handleCustomerData(data) {
      //console.log('Empfangene Kundendaten:', data);
      appState.setCustomerData(data);
      
    }
  // DEALS
  function handleDealsMainData(receivedData) {
    appState.setAllDealsData(receivedData);
    // console.log('📌 Alle Deals Daten: DealsMain:', receivedData);
    appState.setActiveTable('deals');

    const dealsResetButton = document.getElementById('dealsResetFiltersButton');
    if (dealsResetButton) {
      dealsResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'deals'));
    }
  }
  // PORT: Portfolios
  function handlePortfolioData(receivedData) {
    //Daten in AppState speichern
    appState.setAllPortfolioData(receivedData);
    // Aktive Tabelle setzen
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
  function handleProdDataInit(receivedData) {
  // TICKER → ISSUER Zuordnung holen
  const issuerData = appState.getIssuerData(); // enthält z. B. [{ TICKER: "TAAA", ISSUER: "Tesla Inc." }, ...]

  // Mapping erstellen
  const tickerToIssuerMap = {};
  issuerData.forEach(entry => {
    tickerToIssuerMap[entry.TICKER] = entry.ISSUER;
  });

  // Produkte durchgehen und ISSUER aktualisieren
  const updatedData = receivedData.map(prod => {
    const matchedIssuer = tickerToIssuerMap[prod.TICKER] || null;
    return {
      ...prod,
      ISSUER: matchedIssuer  // ersetzt alten ISSUER
    };
  });

  // Weiter wie bisher
  appState.setActiveTable('prod');
  appState.setProdData(updatedData);
  appState.applyFiltersAndUpdateDropdowns('prod');

  const prodResetButton = document.getElementById('prodResetFiltersButton');
  if (prodResetButton) {
    prodResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(updatedData, 'prod'));
  }
}
  // IR
  function handleEUSWData(data) {
    appState.setEUSWData(data);
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

    // MVaR
  function handleMvarDistData(receivedData) {
      //console.log('handleMvarDistData:', receivedData)
    appState.setMvarDistData(receivedData); 
  }

  //CVaR
  function handleAllCVaRData(receivedData) {
    // console.log("📊 Received full CVaR Data (new storage):", receivedData);
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

//EXCEL IMPORT
  async function handleExcelImport() {
  try {
    const result = await window.api.invoke('import-excel-dialog');

    if (result.success) {
      window.api.send('show-message-box', {
        type: 'info',
        title: 'Import erfolgreich',
        message: 'Die Excel-Daten wurden erfolgreich importiert.',
      });
    } else {
      window.api.send('show-message-box', {
        type: 'error',
        title: 'Import fehlgeschlagen',
        message: result.error || 'Unbekannter Fehler beim Import.',
      });
    }
  } catch (error) {
    window.api.send('show-message-box', {
      type: 'error',
      title: 'Fehler',
      message: 'Fehler beim Import: ' + error.message,
    });
  }
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
