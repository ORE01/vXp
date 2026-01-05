import { refreshOpenPanels} from './lazyPanelsCore.js';
import { initPortfolioPanelsLazyRender} from './initAnalysePortfolioPanels.js';
import { initMarketDataPanelsLazyRender} from './initMarketDataPanels.js';
import { initMarketDataChartsAutoRefresh} from './initMarketDataRefresh.js';

import { createTSModals, observePanelTsOpen} from './MARKET_DATA/HISTORIC_DATA/TS.js';
import { renderVolSurfacePanel, renderSwaptionSmile } from './MARKET_DATA/VOLS/swaptionVols.js';
import { handleExcelComplete } from './UPDATES/updatesExcel.js';

import { buildCubeSurfaceGrid, renderSwaptionCubeSurface3D, populateSwaptionCubeSelectors, renderSwaptionCubeSummary } from './MARKET_DATA/VOLS/volCube.js';

import { handlePortAggData, handlePortProdData} from './SELECT_PORTFOLIO/PORT.js';
import { handleMVaRData, handleMvarInputData} from './ANALYSE_PORTFOLIO/MARKET_RISK/MVaR.js'; 

import { handleIRSensData } from './ANALYSE_PORTFOLIO/MARKET_RISK/IRSens.js';
import { handleCSSensData } from './ANALYSE_PORTFOLIO/MARKET_RISK/CSSens.js';

import { handleCvarInput} from './ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInput.js'; 
import { handleCvarInputThresholdView} from './ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInputThreshold.js'; 

import { handleCVaRData, handleEADData} from './ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js'; 
import { handleSwapForwardCurve, handleFWDData } from './MARKET_DATA/FORWARDS/forwards.js';
import { handleProviderData } from './DATA_PROVIDER/DATAProvider.js'; 
import { handleFuturePredictions, handleMLTestData, handleMLTrainedModels, handleMLModels} from './MARKET_DATA/FORCASTING/ML.js'; 
import { handleLossIssuerMainData, setupLossIssuerUI } from './ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js'; 
import { handleLiquidityData } from './ANALYSE_PORTFOLIO/liquidity.js';

import { rerenderHistoricCharts} from './ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/historicRiskMetrics.js';
import { handleSummaryMarketRiskData } from './ANALYSE_PORTFOLIO/SummaryMarketRisk.js';
import { startOfferImport, handleSubmitMatching, quickImportWithStandardMapping } from './NEW_PRODUCTS/offers.js';
//REPORT:
import { generateOfferPDF} from './REPORTS/OffersPDF.js';
import { getOffersReportData, getOffersReportOptions, renderOffersPreview, rowsAsObjectsFrom, setOffersReportData, wireOffersPreview } from './REPORTS/OffersPDFPreview.js';
import { generateRiskPDF } from './REPORTS/RiskPDF.js';
import { wireRiskPreview } from './REPORTS/RiskPDFPreview.js';
import { setupCustomerReportsPresetUI} from './REPORTS/CustomerReportsPresetUI.js';

import { handleHistoricMetricsAddClick} from './ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/saveHistoricRiskMetrics.js';



import { tooltips } from '../utils/ToolTip.js';
import { AppState } from '../AppState.js';
import { initializeTabs } from '../utils/tabs.js';


import { handleModalAction } from '../MODAL_HELPER/ModalActionHandler.js';

import { refreshOpenPortfolioPanels } from "./initAnalysePortfolioPanels.js";



let appState;
let lastHistButton = null;

const panelRenderState = Object.create(null);



document.addEventListener('DOMContentLoaded', () => {
  appState = new AppState();
  window.appState = appState;

  setupEventListeners();
  setupDropdowns();
  setupButtons();
  initializeTabs();
  setupReportsEnterLeaveBridge();
  setupBulkUpdateBridge();
  // HIST-Progress (APIs)
  setupPythonProgressBars({
    initialProviders: ["ECB", "FED"],
    containerId: "progressBarsContainer",
    globalTextId: "progressText_GLOBAL",
    eventName: "py-progress"
  });

  // EXCEL-Progress – eigener Satz Balken, einer pro Mode
  setupPythonProgressBars({
    initialProviders: ["ALL", "ISSUER", "PRODUCTS", "DEALS", "EUSW"],
    containerId: "excelProgressBarsContainer",
    globalTextId: "progressText_EXCEL",
    eventName: "py-excel-progress"
  });
});

// --- Reports enter/leave Bridge (idempotent) ---
function setupReportsEnterLeaveBridge() {
  if (window.__reportsBridgeInstalled) return;
  window.__reportsBridgeInstalled = true;

  const tabBar = document.querySelector('.tab');
  if (!tabBar) return;

  // ✅ NEW: Reports enter/leave hooks (nur einmal)
  if (!window.__reportsEnterLeaveHooksBound) {
    window.__reportsEnterLeaveHooksBound = true;

    document.addEventListener('reports:enter', () => {
      try {
        // Risk UI existiert jetzt (Panel wird geöffnet) → Preset UI binden + Liste laden
        setupCustomerReportsPresetUI();
      } catch (e) {
        console.warn('[reports:enter] setupCustomerReportsPresetUI failed', e);
      }
    }, true);

    document.addEventListener('reports:leave', () => {
      // optional: nichts nötig
      // Wenn du später mal teardown willst: hier.
    }, true);
  }

  // A) Clicks auf die Tab-Buttons abfangen
  const buttons = tabBar.querySelectorAll('.tablinks');
  for (let i = 0; i < buttons.length; i++) {
    const btn = buttons[i];
    btn.addEventListener('click', () => {
      const id = btn.id || '';
      document.dispatchEvent(new CustomEvent(id === 'REPORTS_Tab' ? 'reports:enter' : 'reports:leave'));
    }, { passive: true });
  }

  // B) Falls Tabs auch programmatic umgeschaltet werden (Klassenwechsel)
  const getActiveTabId = () =>
    (document.querySelector('.tablinks.active')?.id) ||
    (document.querySelector('.tablinks[aria-selected="true"]')?.id) || '';

  const mo = new MutationObserver(() => {
    const id = getActiveTabId();
    if (!id) return;
    document.dispatchEvent(new CustomEvent(id === 'REPORTS_Tab' ? 'reports:enter' : 'reports:leave'));
  });
  mo.observe(tabBar, { attributes: true, subtree: true, attributeFilter: ['class','aria-selected'] });

  // C) Initialen Zustand einmal feuern
  requestAnimationFrame(() => {
    const id = getActiveTabId();
    document.dispatchEvent(new CustomEvent(id === 'REPORTS_Tab' ? 'reports:enter' : 'reports:leave'));
  });
}

// ==== IPC-Bridge zu Bulk-Update-Events (vom Main gesendet) ====
function setupBulkUpdateBridge() {
  // a) Falls preload/bridge existiert
  if (window.api?.on) {
    window.api.on('ui:bulk-update-start', () => {
      lockRender();
      window.dispatchEvent(new Event('ui:bulk-update-start'));
    });
    window.api.on('ui:bulk-update-end', () => {
      unlockRender();
      window.dispatchEvent(new Event('ui:bulk-update-end'));
    });
  }

  // b) Fallback: falls jemand direkt DOM-Events feuert
  window.addEventListener('ui:bulk-update-start', () => lockRender());
  window.addEventListener('ui:bulk-update-end',   () => unlockRender());
}
// renderer.js (oben, global verfügbar)
function lockRender()  {
  window.__uiLocked = true;
  document.body.dataset.uiLocked = '1';
}
function unlockRender(){
  window.__uiLocked = false;
  delete document.body.dataset.uiLocked;
}
// PYTHON PROGRESS BAR
function setupPythonProgressBars({
  initialProviders = ["ECB", "FED"],
  containerId = "progressBarsContainer",
  globalTextId = "progressText_GLOBAL",
  eventName = "py-progress"
} = {}) {
  const container = document.getElementById(containerId);
  const globalTxt = document.getElementById(globalTextId);

  if (!container) {
    console.warn(`[ProgressBars] Container #${containerId} not found.`);
    return;
  }

  function ensureProviderBar(provider) {
    const barId = `progressBar_${provider}`;
    if (document.getElementById(barId)) return;

    const row = document.createElement("div");
    row.className = "provider-progress";

    row.innerHTML = `
      <div class="provider-label">${provider}</div>
      <progress id="${barId}" value="0" max="100"></progress>
      <div id="progressText_${provider}" class="progress-text">Waiting...</div>
    `;

    container.appendChild(row);
  }

  // Initiale Bars erstellen + resetten
  for (const p of initialProviders) {
    ensureProviderBar(p);

    const bar = document.getElementById(`progressBar_${p}`);
    const txt = document.getElementById(`progressText_${p}`);
    if (bar) bar.value = 0;
    if (txt) txt.textContent = "Waiting...";
  }

  if (globalTxt) globalTxt.textContent = "Starting...";

  // Listener registrieren
  window.api.on(eventName, (data) => {
    const provider = data.provider || "GLOBAL";

    // GLOBAL nur als Text anzeigen
    if (provider === "GLOBAL") {
      if (globalTxt) globalTxt.textContent = data.message ?? "";
      return;
    }

    // Neue Provider dynamisch erzeugen
    ensureProviderBar(provider);

    const bar = document.getElementById(`progressBar_${provider}`);
    const txt = document.getElementById(`progressText_${provider}`);

    if (bar) bar.value = data.progress ?? 0;
    if (txt) txt.textContent = data.message ?? "";
  });
}





function initAllPanelsLazyRender() {
  initPortfolioPanelsLazyRender({ panelRenderState });
  initMarketDataPanelsLazyRender({ panelRenderState });
}




function setupEventListeners() {

  if (window.__listenersBoundOnce) {
    console.warn('setupEventListeners() already bound – skipping');
    return;
  }
  window.__listenersBoundOnce = true;

  // 🔁 ALT:
  // initPortfolioPanelsLazyRender({ panelRenderState });
  // initMarketDataPanelsLazyRender({ panelRenderState });

  // ✅ NEU: zentrale Registrierung aller Panels
  initAllPanelsLazyRender({ panelRenderState });

  // bleibt wie gehabt
  initMarketDataChartsAutoRefresh();

// CUSTOMER-Data
  window.api.receive('CustomerData', handleCustomerData);
  window.api.receive('CustomerTSSelectionData', handleCustomerTSData);
  // window.api.receive('CustomerReportsData', handleCustomerReportsData); daten kommen über: setupReportsEnterLeaveBridge!!!!!


  // Market Data: Fixed Income
  window.api.receive('EUSWData', handleEUSWData);
    // --- NEU: Swaption-Vol-Daten aus der DB ---
  window.api.receive('EUSWAPTION_ATMData', handleSwaptionATMData);
  window.api.receive('EUSWAPTION_SMILEData', handleSwaptionSmileData);

  // ISSUER 
  window.api.receive('IssuerData', handleIssuerDataInit);
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
  });


  // MVaR: Input
  window.api.receive('MVaRInputData', handleMvarInputData);

  // MVaR
  window.api.receive('MarketVaRData', handleAllMVaRData);

  // MVaR_Distribution
  //window.api.receive('MVaRMainDistData', handleMvarDistData);
  window.api.receive('MVaRMainDistData', (data) => handleMvarDistData(data));

  // EAD
  window.api.receive('EADData', (data) => handleAllEADData(data));

  // CVaR:Input
    window.api.receive('CreditVaRInputData', (data) => initHandleCvarInput(data));

  // CVaR:Input Thresholds
  window.api.receive('CreditVaRInputThresholdData', (data) => handleCvarInputThreshold(data));  
  
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

    // TS CLONED
  window.api.receive('tblTSData', (data) => {createTSModals(data);});
  
  // TS Tools panel
  observePanelTsOpen();

    // PortfolioHistoryMetrics
  window.api.receive('PortfolioHistoryMetricsData', (data) => {
  handlePortfolioHistoryData(data);

});

  // PYTHON PROJECTS: helper
  window.api.receive('py-fairValue-complete', handleFairValueComplete);
  window.api.receive('py-mvar-complete', handleMVaRComplete);
  window.api.receive('py-cvar-complete', handleCVaRComplete);
  window.api.receive('py-matchColumns-complete', handleAIColumnComplete);
  window.api.receive('py-historicData-complete', handleHistComplete);
  window.api.receive('py-swaption-complete', handleSwaptionComplete);

  window.api.receive('py-excel-complete', handleExcelComplete);

  window.api.receive('project-finished', handleProjectFinished);




  //===================================== END LISTENERS ===============================

}



// ======================================= START Change-Listener (Szenario-Checkboxen, IR-Curve, Offers-Dropdown)
// === einmalige Change-Delegation ===
(function bindGlobalChangeOnce(){
  if (window.__changeBoundOnce) return;
  window.__changeBoundOnce = true;

  // optional: letztes Offers-Port merken
  let lastOffersPort = null;

  document.addEventListener('change', (event) => {
    const t = event.target;
    if (!t) return;

    // 1) Szenario-Checkboxen
    if (t.classList.contains('select-scenario')) {
      const checkboxes = document.querySelectorAll('.select-scenario');
      let isDefaultSelected = false;

      checkboxes.forEach((cb) => {
        if (cb !== t) cb.checked = false;                 // nur eine aktiv
        if (cb.checked && cb.dataset.row === "0") isDefaultSelected = true;
      });

      const creditWarningContainer = document.getElementById("creditWarningContainer");
      const creditWarningLight     = document.getElementById("creditWarning");
      if (creditWarningContainer && creditWarningLight) {
        if (!isDefaultSelected) {
          creditWarningLight.style.backgroundColor = "red";
          creditWarningContainer.style.visibility = "visible";
        } else {
          creditWarningLight.style.backgroundColor = "transparent";
          creditWarningContainer.style.visibility = "hidden";
        }
      }
      return; // fertig
    }

    // 2) IR Curve Selector
    if (t.id === "ratesSelector") {
      const selectedCurve = t.value;
      try { appState?.setSelectedCurve?.(selectedCurve); } catch {}
      try { handleEUSWData?.(appState?.getForwardData?.()); } catch {}

      const warningContainer = document.getElementById("curveWarningContainer");
      const warningLight     = document.getElementById("curveWarning");
      if (warningContainer && warningLight) {
        const off = (selectedCurve === "EUSWAP");
        warningLight.style.backgroundColor = off ? "transparent" : "red";
        warningContainer.style.visibility  = off ? "hidden" : "visible";
      }
      return; // fertig
    }

    // 3) OFFERS: createdOffersDropdown
    if (t.id === 'createdOffersDropdown') {
      const port_name = t.value;
      if (port_name === lastOffersPort) return;  // keine Doppelarbeit
      lastOffersPort = port_name;

      try {
        appState?.setSelectedDealsTableName?.(port_name);
        appState?.setSelectedPortTableName?.(port_name);
        const all  = (appState?.getAllDealsData && appState.getAllDealsData()) || [];
        const rows = all.filter(r => r?.port_name === port_name);
        appState?.handleDealsData?.(rows, port_name);
      } catch (err) {
        console.error('Offers Dropdown handling failed:', err);
      }
      return; // fertig
    }

    // nichts davon? -> ignorieren
  }, false);
})();










    function setupDataProvider(eventNames, handler) {
      eventNames.forEach(([eventName, type]) => {
        window.api.receive(eventName, (data) => handler(data, type));
      });
    }

function setupDropdowns() {
  console.log('dropdown initiated')
  // Deals Dropdown
  setupDropdown({
    dropdownId: 'createdDealsDropdown',
    getDataFunction: appState.getDealsNameList,
    updateDataFunction: appState.updateDealsDataTable,
    setSelectedDealsTableName: appState.setSelectedDealsTableName,
    setSelectedPortTableName: appState.setSelectedPortTableName,
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

// -----------------------------------------------------
// SWAPTION DROPDOWNS (ATM / Smile)
// -----------------------------------------------------
const optSel = document.getElementById("swaptionOptionTenorSelect");
const swpSel = document.getElementById("swaptionSwapTenorSelect");

// Falls Panel nie gerendert wird -> nicht crashen
if (optSel && swpSel) {
  optSel.addEventListener("change", () => {
    console.log("[Swaption] OptionTenor geändert → Re-Render ATM/Smile");
    renderVolSurfacePanel();
    renderSwaptionSmile();
  });

  swpSel.addEventListener("change", () => {
    console.log("[Swaption] SwapTenor geändert → Re-Render ATM/Smile");
    renderVolSurfacePanel();
    renderSwaptionSmile();
  });
}


// -----------------------------------------------------
// SWAPTION DROPDOWNS for CUBE (OptionTenor / SwapTenor)
// -----------------------------------------------------
const cubeOptSel = document.getElementById('swaptionOptionTenorSelectCube');
const cubeSwpSel = document.getElementById('swaptionSwapTenorSelectCube');
const summaryEl  = document.getElementById('SwaptionCubeSummaryContainer');
const cubeTargetId = 'swaption-cube-surface-3d'; // optional, nur wenn du ihn brauchst

if (cubeOptSel && cubeSwpSel) {
  cubeOptSel.addEventListener('change', () => {
    console.log('[SwaptionCube] OptionTenor geändert → Re-Render Cube');
    renderSwaptionCubeSurface3D();
    renderSwaptionCubeSummary();
    
  });

  cubeSwpSel.addEventListener('change', () => {
    console.log('[SwaptionCube] SwapTenor geändert → Re-Render Cube');
    renderSwaptionCubeSurface3D();
    renderSwaptionCubeSummary();
    
  });
}









}
        // einmalig definieren
    const debounce = (fn, ms = 120) => {
      let t;
      return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
    };
    // kombiniert: erst (kurz) debouncen, dann DOM-Writes im nächsten Frame
    const debounceRaf = (fn, ms = 120) => {
      const d = debounce((...args) => {
        requestAnimationFrame(() => fn(...args));
      }, ms);
      return d;
    };

//============================================================DAS IST DIE FUNKTION DIE FÜR DIE ÄNDERUNGEN ZUSTÄNDIG IST===================================


function setupDropdown({
  dropdownId,
  getDataFunction,
  updateDataFunction,
  updateMvarDataFunction,
  updateCvarDataFunction,
  updateEADDataFunction,
  updateLiquidityDataFunction,
  setSelectedPortTableName,
  setSelectedDealsTableName,
  setActiveTable,
  index,
}) {
  const dropdown = document.getElementById(dropdownId);
  if (!dropdown) return;

  const isPortfolioDropdown = dropdownId.startsWith('createdPortDropdown');

  const getData         = getDataFunction?.bind(appState);
  const updateData      = updateDataFunction?.bind(appState);
  const updateMvar      = updateMvarDataFunction?.bind(appState);
  const updateCvar      = updateCvarDataFunction?.bind(appState);
  const updateEAD       = updateEADDataFunction?.bind(appState);
  const updateLiquidity = updateLiquidityDataFunction?.bind(appState);

  const scheduleOptionsUpdate = debounceRaf((selectedTableName) => {
    appState.updateDropdownOptions({
      dropdownElementId: dropdownId,
      getDataFunction: getData,
      updateDataFunction: updateData,
      updateMvarDataFunction: updateMvar,
      updateCvarDataFunction: updateCvar,
      updateEADDataFunction: updateEAD,
      updateLiquidityDataFunction: updateLiquidity,
      selectedTableName,
      index,
    });




  rerenderHistoricCharts({ index, selectedTableName });


    
  }, 120);

  dropdown.addEventListener('change', (event) => {
    const selectedTableName = event.currentTarget.value;

    if (setSelectedDealsTableName) appState.setSelectedDealsTableName(selectedTableName);
    if (setSelectedPortTableName)  appState.setSelectedPortTableName(selectedTableName);
    if (setActiveTable)            setActiveTable();

    scheduleOptionsUpdate(selectedTableName);
  });
}





function setupButtons() {
  // ====== EXISTING BUTTONS ======
  document.getElementById('savePortfolioButton').addEventListener('click', handleSaveNewPortfolio);
    // ✅ NEU: ADD-Button im Portfolio-Panel
  document.getElementById('historicMetricsAddButton')?.addEventListener('click', handleHistoricMetricsAddClick);  

  document.getElementById('portfolioDealsAddButton')?.addEventListener('click', handleAddDealsToNewPortfolio);

  document.getElementById('saveSelectionButton').addEventListener('click', handleSaveSelection);
  document.getElementById('deleteTableButton').addEventListener('click', handleDeleteSelection);
  //document.getElementById('applyYearsForwardButton').addEventListener('click', handleSwapForwardCurve);

  document.getElementById('importExcelButtonVXP')?.addEventListener('click', handleExcelImport);
  document.getElementById('importEUSWButton').addEventListener('click', () => {handleExcelImport(['EUSW']);});

  document.getElementById('matchColumnsButton')?.addEventListener('click', () => {handleAIColumnProject();});
  document.getElementById('submitToProductsBtn')?.addEventListener('click', () => {handleSubmitMatchedColumns('productMatchesOutput', 'ProdAll');});
  document.getElementById('submitToOffersBtn')?.addEventListener('click', () => {handleSubmitMatchedColumns('offerMatchesOutput', 'DealsMain', { port_name: 'LGT' });});
  document.getElementById('importOffersBtn')?.addEventListener('click', () => {startOfferImport();});
  document.getElementById("submitMatchingBtn")?.addEventListener("click", () => {handleSubmitMatching();});
  document.getElementById("btnQuickImport")?.addEventListener("click", () => {quickImportWithStandardMapping();});
//PDF
  document.getElementById('offersGoToReportButton')?.addEventListener('click', handlePreviewPDFClick);
  document.getElementById('offerPDFButton')?.addEventListener('click', handleOffersPDFClick);

  // 👉 NEU: Refresh-Thumbnails für RiskPDF
  document.getElementById('refreshThumbnailsBtn')?.addEventListener('click', handleRefreshThumbnailsClick);
  document.getElementById('riskPDFButton')?.addEventListener('click', handleRiskPDFClick);

  // ====== PROVIDERS (Deins, unverändert) ======
  const providers = [
    { id: 'ecbTab', container: 'inputEcb-container', button: 'ecbAddButton' },
    { id: 'fedTab', container: 'inputFed-container', button: 'fedAddButton' },
    { id: 'yahooTab', container: 'inputYahoo-container', button: 'yahooAddButton' },
  ];
  providers.forEach(({ id }) => {
    document.getElementById(id)?.addEventListener('click', () => handleProviderClick(id, providers));
  });

  // ====== PYTHON EXECUTION (Deins, unverändert) ======
  const projectButtons = [
    { buttonId: 'fairValueButton', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton1', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton2', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton3', projectName: 'py-fairValue' },

    // { buttonId: 'CVaRButton', projectName: 'py-CVaR' },
    { buttonId: 'CSParButton', projectName: 'py-cspar' },
    { buttonId: 'MLButton', projectName: 'py-ml' },

    { buttonId: 'matchColumnsButton', projectName: 'py-matchColumns' },

    { buttonId: 'updateHistoricDataButton', projectName: 'py-historicData' },

      // Excel-Import: neue Buttons
    { buttonId: 'updateExcelAllButton',    projectName: 'py-excel' },
    { buttonId: 'updateExcelIssuerButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelProductsButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelDealsButton',  projectName: 'py-excel' },
    { buttonId: 'updateExcelEuswButton',   projectName: 'py-excel' },

    { buttonId: 'histEcbButton', projectName: 'py-hist' },
    { buttonId: 'histFedButton', projectName: 'py-hist' },
    { buttonId: 'histYahooButton', projectName: 'py-hist' },
      // 🔵 NEU: Swaption Vol Cube
  { buttonId: 'swaptionCubeRunButton', projectName: 'py-swaption' },
  ];
  projectButtons.forEach(({ buttonId, projectName, extraParam }) => {
    const button = document.getElementById(buttonId);
    button?.addEventListener('click', () =>
      handleProjectButtonClick(button, projectName, extraParam)
    );
  });


function setupRadioProjectButton({
  buttonId,
  projectName,
  radioSelector,
  valueAttr,      // z.B. 'data-interval' oder 'data-name'
  payloadKey,     // z.B. 'selectedInterval' oder 'cvarName'
  emptyMessage,
}) {
  const button = document.getElementById(buttonId);
  if (!button) return;

  button.addEventListener('click', (event) => {
    const selectedRadio = document.querySelector(`${radioSelector}:checked`);
    if (!selectedRadio) {
      alert(emptyMessage || 'Please select an option!');
      return;
    }

    const value = selectedRadio.getAttribute(valueAttr);
    if (!value) {
      alert(`Selected row has no ${valueAttr} attribute.`);
      return;
    }

    console.log(`▶️ ${projectName} selected value for ${payloadKey}:`, value);

    // Über deinen generischen Handler gehen → Button wird auf "Executing" gesetzt etc.
    handleProjectButtonClick(event.target, projectName, {
      [payloadKey]: value,
    });
  });
}

// === Konfiguration für MVaR (wie bisher) ======================
setupRadioProjectButton({
  buttonId: 'mvaRDistButton',
  projectName: 'py-MVaR',
  radioSelector: '.scenario-radio',
  valueAttr: 'data-interval',
  payloadKey: 'selectedInterval',
  emptyMessage: 'Select a Timeperiode!',
});

// === Konfiguration für CVaR (neue Variante) ===================
setupRadioProjectButton({
  buttonId: 'CVaRButton',
  projectName: 'py-CVaR',
  radioSelector: '.cvar-radio',
  valueAttr: 'data-name',
  payloadKey: 'cvarName',
  emptyMessage: 'Select a CVaR configuration!',
});



  // ====== CMS (Deins)
  // applyCMSForwardRate('CMSButton1');
  // applyCMSForwardRate('CMSButton2');

  // ====== LANGUAGE (Deins)
  updateTooltips('en');
  const langButtons = [
    { buttonId: 'lang-en', lang: 'en' },
    { buttonId: 'lang-de', lang: 'de' },
  ];
  langButtons.forEach(({ buttonId, lang }) => {
    document.getElementById(buttonId)?.addEventListener('click', () => updateTooltips(lang));
  });

  // ====== THEME (Deins)
  const themeToggleButton = document.getElementById('themeToggle');
  themeToggleButton?.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
  });

// =====================================================================
// === Data Provider Modal – Panels + Issuer (PDF) via Delegation =======
// =====================================================================

// kleine Helfer
  const $$  = (sel, root = document) => Array.from((root && root.querySelectorAll(sel)) || []);
  const $id = (id) => document.getElementById(id);

  // 1) Init robust (läuft, egal wann der Code geladen wird)
  (function initDataProviderUI() {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', bindUI, { once: true });
    } else {
      bindUI();
    }
  })();


  function bindUI() {
    // --- Delegation: Panel öffnen ---
    document.addEventListener('click', (ev) => {
      const trigger = ev.target.closest('.section-trigger');
      if (!trigger) return;

      const id = trigger?.dataset?.panel; // z.B. "panel-issuer"
      // alle Panels zu
      $$('.sub-panel').forEach((p) => { if (p) p.hidden = true; });
      // dieses Panel auf
      const panel = $id(id);
      if (panel) panel.hidden = false;

      // aria-States
      $$('.section-trigger').forEach((b) => b.setAttribute('aria-expanded', 'false'));
      trigger.setAttribute('aria-expanded', 'true');
    });

    // --- Delegation: Panel schließen ---
    document.addEventListener('click', (ev) => {
      const closeBtn = ev.target.closest('.sub-panel-close');
      if (!closeBtn) return;

      const id = closeBtn?.dataset?.close; // z.B. "panel-issuer"
      const panel = $id(id);
      if (panel) panel.hidden = true;

      const trigger = document.querySelector(`.section-trigger[data-panel="${id}"]`);
      if (trigger) trigger.setAttribute('aria-expanded', 'false');
    });

    // --- Delegation: Issuer Fetch ---
    document.addEventListener('click', async (ev) => {
      const fetchBtn = ev.target.closest('#issuerFetchButton');
      if (!fetchBtn) return;

      const input = $id('isinInputIssuer');
      const out   = $id('issuerOut');
      const table = $id('issuerTable');

      const isins = String(input?.value || '')
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter(Boolean);

      if (!isins.length) {
        if (out)   out.textContent = 'Bitte mindestens eine ISIN eingeben.';
        if (table) table.innerHTML = '';
        return;
      }

      if (out)   out.textContent = '⏳ fetching…';
      if (table) table.innerHTML = '';

      try {
        // nur Terms (kein Schedule / keine ProdCoupon-Zeilen)
  const res = await (window.api?.fetchBondsTermsOnly
    ? window.api.fetchBondsTermsOnly(isins)
    : Promise.resolve([]));

        if (out) out.textContent = JSON.stringify(res, null, 2);

        const list = Array.isArray(res) ? res : [];
        const items = list.map(r => ({
          isin: r.isin,
          coupon: r?.terms?.coupon,
          issueDate: r?.terms?.issueDate,
          maturity: r?.terms?.maturity,
          frequency: r?.terms?.frequency,
          pdfUrl: r?.terms?.pdfUrl || ''
        }));

        if (!items.length) {
          if (table) table.innerHTML = '<p>Keine Terms gefunden.</p>';
          return;
        }

        if (table) table.innerHTML = renderIssuerTermsTable(items);

      } catch (err) {
        if (out) out.textContent = '❌ ' + (err?.message || String(err));
        console.error(err);
      }
    });
  }

  // 2) Render-Helper
  function renderIssuerTermsTable(items) {
    const pct = v => (typeof v === 'number' ? (v * 100).toFixed(3) + ' %' : (v ?? '–'));
    const s = v => (v ?? '–');

    const thead = `
      <thead><tr>
        <th>ISIN</th><th>Coupon</th><th>Issue</th>
        <th>Maturity</th><th>Freq</th><th>PDF</th>
      </tr></thead>`;

    const tbody = items.map(i => `
      <tr>
        <td>${s(i.isin)}</td>
        <td>${pct(i.coupon)}</td>
        <td>${s(i.issueDate)}</td>
        <td>${s(i.maturity)}</td>
        <td>${s(i.frequency)}</td>
        <td>${i.pdfUrl ? `<a href="${i.pdfUrl}" target="_blank" rel="noopener">open</a>` : '–'}</td>
      </tr>`
    ).join('');

    return `<table>${thead}<tbody>${tbody}</tbody></table>`;
  }



  // WICHTIG: erst nach DOM bereit initialisieren
  //document.addEventListener('DOMContentLoaded', setupDataProviderPanels);

}












// PORTFOLIO


// Hilfsfunktion: erkennt OFFER_/OFFERS_ (case-insensitive)

const isOfferName = (name) =>
  typeof name === 'string' && /^OFFERS?_/.test(name.toUpperCase());

  /** NUR Namen ohne OFFER(S)_ ins Deals-Dropdown **/
  // function handleDealsNameList(receivedData) {
  //   try {
  //     const names = (receivedData || []).map(e => e.port_name).filter(Boolean);
  //     const unique = [...new Set(names)];
  //     const dealsOnly = unique.filter(n => !isOfferName(n));
  //     const dealsList = dealsOnly.map(name => ({ table_name: name }));

  //     // Speichern & Dropdown aktualisieren
  //     if (typeof appState.setDealsNameList === 'function') {
  //       appState.setDealsNameList(dealsList, 'createdDealsDropdown');
  //     }
  //     if (typeof appState.applyFiltersAndUpdateDropdowns === 'function') {
  //       appState.applyFiltersAndUpdateDropdowns('dealsTables');
  //     }
  //   } catch (error) {
  //     console.error("❌ Error processing deals name list:", error);
  //   }
  // }

  /** ALLE Namen ins Deals-Dropdown (kein OFFERS-Filter) **/
function handleDealsNameList(receivedData) {
  try {
    const names = (receivedData || []).map(e => e.port_name).filter(Boolean);
    const unique = [...new Set(names)];
    const dealsList = unique.map(name => ({ table_name: name }));

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





  // EventListener für createdOffersDropdown!








//   function handlePortNameList(receivedData) {
//   try {
//     const isOffer = (n) => typeof n === 'string' && /^OFFERS?_/i.test(n);

//     const names = (receivedData || [])
//       .map(e => e?.port_name)
//       .filter(Boolean)
//       .filter(n => !isOffer(n)); // ❗ Angebote rausfiltern

//     const uniquePortfolios = [...new Set(names)].map(name => ({ table_name: name }));

//     ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdown, index) => {
//       appState.setPortNameList(uniquePortfolios, dropdown);
//       appState.applyFiltersAndUpdateDropdowns(`portTables${index}`);
//     });
//   } catch (error) {
//     console.error("❌ Error processing created port data:", error);
//   }
// }
function handlePortNameList(receivedData) {
  try {
    const names = (receivedData || [])
      .map(e => e?.port_name)
      .filter(Boolean);

    const uniquePortfolios = [...new Set(names)].map(name => ({ table_name: name }));

    ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdown, index) => {
      appState.setPortNameList(uniquePortfolios, dropdown);
      appState.applyFiltersAndUpdateDropdowns(`portTables${index}`);
    });
  } catch (error) {
    console.error("❌ Error processing created port data:", error);
  }
}







function handleSaveNewPortfolio() {
  // 1) Name holen & validieren
  const inputEl = document.getElementById('PortfolioNameInput');
  const port_name = (inputEl?.value || '').trim();
  if (!port_name) {
    alert('Please enter a portfolio name.');
    return;
  }

  // 2) Optional: duplizierte Namen vermeiden (sanft)
  const dealsNameList = appState.getDealsNameList?.() || [];
  const exists = dealsNameList.some(p => (p.table_name || p.name) === port_name);
  if (!exists) {
    appState.setDealsNameList?.([...dealsNameList, { table_name: port_name }]);
  }

  // 3) Optional: persistieren – eigener IPC-Kanal NUR für Namen
  try {
    if (window.api?.send) {
      window.api.send('save-portfolio-name', { port_name });
    }
  } catch (e) {
    console.warn('save-portfolio-name IPC failed:', e);
  }

  // 4) Optional: interne Auswahl merken, falls du das später brauchst
  appState.setSelectedDealsTableName?.(port_name);
  appState.setSelectedPortTableName?.(port_name);

  // 5) Feedback
  showMessageBox?.(`Portfolio "${port_name}" successfully saved!`, () => {});

  // 6) Felder nicht zwingend zurücksetzen – kannst du machen, wenn du möchtest:
  // inputEl.value = '';
}

function handleAddDealsToNewPortfolio(event) {
  const inputEl = document.getElementById('PortfolioNameInput');
  const port_name = (inputEl?.value || '').trim();

  if (!port_name) {
    alert('Please enter a portfolio name first.');
    return;
  }

  // 1) Template-Daten für das Formular besorgen
  //    Zuerst versuchen wir die aktuelle Deals-View ...
  let dealsData =
    appState.getDealsData?.() ||
    appState.getFilteredData?.('deals') ||
    [];

  //    ... wenn die leer ist (z.B. neues Portfolio ohne Deals),
  //    holen wir den vollen Deals-Dump und nehmen daraus die erste Zeile als Template
  if (!Array.isArray(dealsData) || dealsData.length === 0) {
    const allDeals =
      appState.getAllDealsData?.() ||   // falls du so eine Funktion hast
      appState.getAllDeals?.()      ||   // alternative Namensvariante
      [];

    if (Array.isArray(allDeals) && allDeals.length > 0) {
      // komplette Liste als Basis übergeben – handleFormAction nutzt sowieso nur data[0]
      dealsData = allDeals;
    } else {
      // letzter Fallback: minimaler Template-Row, damit das Formular überhaupt etwas hat
      dealsData = [{
        TRADE_ID: '',
        PORT_NAME: '',
        PROD_ID: '',
      }];
      console.warn('handleAddDealsFromNewPortfolioPanel: using fallback template row.');
    }
  }

  // 2) Modal öffnen – wie beim normalen Deals-Add-Button
  const selectedTableName = 'DealsMain'; // physische Tabelle
  handleModalAction(event, dealsData, null, selectedTableName, 'add');

  // 3) Portfolio-Name im Modal vorbelegen (z.B. PORT_NAME)
  setTimeout(() => {
    const form = document.getElementById('editForm') || document.querySelector('#modal form');
    if (!form) return;

    const portField =
      form.querySelector('[data-field="PORT_NAME"]') ||
      form.querySelector('[data-field="port_name"]');

    if (portField) {
      portField.value = port_name;
      portField.dispatchEvent(new Event('input', { bubbles: true }));
    }
  }, 0);
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
    console.log('Deals filteredData', filteredData);
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
                updateLiquidityDataFunction: appState.updateLiquidityDataFunction.bind(appState),
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




  //CUSTOMER
  function handleCustomerData(data) {
    //console.log('Empfangene Kundendaten:', data);
    appState.setCustomerData(data); 
  }
function handleCustomerTSData(data) {
  appState.setCustomerTSData(data);
  // ✅ Ready-Flag + Event feuern
  window.__tsSelectionsReady = true;
  window.dispatchEvent(new Event('ts-selections-ready'));
}

// CustomerReports


export function handleCustomerReportsData(payload) {
  try {
    // akzeptiere beide gängigen Formen: Array direkt oder { data: [...] } / { rows: [...] }
    const data =
      Array.isArray(payload) ? payload :
      Array.isArray(payload?.data) ? payload.data :
      Array.isArray(payload?.rows) ? payload.rows :
      [];

    appState?.setCustomerReportsData?.(data);
  } catch (e) {
    console.warn('[CustomerReports] handleCustomerReportsData failed', e);
  }
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

    // Reset Button
    const offersResetButton = document.getElementById('offersResetFiltersButton');
    if (offersResetButton) {
      offersResetButton.addEventListener('click', () => appState.resetFiltersForActiveTable(receivedData, 'offers'));
    }
  }
  // ISSUER
  function handleIssuerDataInit(receivedData) {
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
    // 1) nur roh speichern
    appState.setEUSWData(data);

    // 2) optional: falls das Rates-Panel gerade offen ist,
    //    kannst du die offenen MarketData-Panels refreshen
    //    (wenn du den curve:changed Event + lazy refresher schon drin hast,
    //     brauchst du das hier NICHT mehr)
    try {
      document.dispatchEvent(new CustomEvent("eusw:data:ready"));
    } catch {}
  }


export function sortTenors(tenors) {
  function parseTenor(t) {
    if (typeof t !== 'string') return { totalYears: 9999 };

    const match = t.trim().match(/^(\d+)\s*([MDWY])?$/i);
    if (!match) return { totalYears: 9999 };

    const value = parseInt(match[1], 10);
    const unit  = (match[2] || 'Y').toUpperCase();

    let factor;
    switch (unit) {
      case 'D': factor = 1 / 365; break;
      case 'W': factor = 7 / 365; break;
      case 'M': factor = 1 / 12; break;
      case 'Y':
      default:  factor = 1; break;
    }

    return { totalYears: value * factor };
  }

  return [...tenors].sort((a, b) => {
    const A = parseTenor(a);
    const B = parseTenor(b);
    return A.totalYears - B.totalYears;
  });
}

// 🔧 Helper: Swaption-Dropdowns füllen
function fillSwaptionDropdowns(optionTenors, swapTenors) {
  const optSel = document.getElementById("swaptionOptionTenorSelect");
  const swpSel = document.getElementById("swaptionSwapTenorSelect");

  if (!optSel || !swpSel) {
    console.warn('[handleSwaptionATMData] Swaption-Dropdowns im DOM nicht gefunden.');
    return;
  }

  // Dropdowns leeren
  optSel.innerHTML = "";
  swpSel.innerHTML = "";

  // Optionen befüllen
  optionTenors.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    optSel.appendChild(opt);
  });

  swapTenors.forEach(t => {
    const opt = document.createElement("option");
    opt.value = t;
    opt.textContent = t;
    swpSel.appendChild(opt);
  });

  // Wenn noch nichts gewählt → auf ersten Wert setzen
  if (!optSel.value && optionTenors.length > 0) {
    optSel.value = optionTenors[0];
  }
  if (!swpSel.value && swapTenors.length > 0) {
    swpSel.value = swapTenors[0];
  }
}

// Nur setzen der Daten:
// function handleSwaptionATMData(rows) {
//   if (!appState) return console.warn('[handleSwaptionATMData] appState fehlt.');

//   const safeRows = Array.isArray(rows) ? rows : [];
//   appState.setSwaptionATM(safeRows);

//   // Dropdowns füllen (aus rows)
//   const optionSet = new Set();
//   const swapSet = new Set();
//   for (const r of safeRows) {
//     if (r?.option_tenor != null) optionSet.add(String(r.option_tenor));
//     if (r?.swap_tenor   != null) swapSet.add(String(r.swap_tenor));
//   }
//   const optionTenors = sortTenors([...optionSet]);
//   const swapTenors   = sortTenors([...swapSet]);

//   fillSwaptionDropdowns(optionTenors, swapTenors);

//   // ✅ Default setzen, falls leer (sonst opt/swp = '')
//   const optSel = document.getElementById("swaptionOptionTenorSelect");
//   const swpSel = document.getElementById("swaptionSwapTenorSelect");
//   if (optSel && !optSel.value && optionTenors.length) optSel.value = optionTenors[0];
//   if (swpSel && !swpSel.value && swapTenors.length)   swpSel.value = swapTenors[0];

//   // ✅ Signal (kein Render hier)
//   document.dispatchEvent(new CustomEvent("swaption:atm:ready", { detail: { count: safeRows.length } }));
// }

function handleSwaptionATMData(rows) {
  if (!appState) return console.warn('[handleSwaptionATMData] appState fehlt.');

  const safeRows = Array.isArray(rows) ? rows : [];
  appState.setSwaptionATM(safeRows);

  // Dropdowns füllen (aus rows)
  const optionSet = new Set();
  const swapSet = new Set();
  for (const r of safeRows) {
    if (r?.option_tenor != null) optionSet.add(String(r.option_tenor));
    if (r?.swap_tenor   != null) swapSet.add(String(r.swap_tenor));
  }
  const optionTenors = sortTenors([...optionSet]);
  const swapTenors   = sortTenors([...swapSet]);

  fillSwaptionDropdowns(optionTenors, swapTenors);

  // ✅ Default setzen, falls leer (sonst opt/swp = '')
  const optSel = document.getElementById("swaptionOptionTenorSelect");
  const swpSel = document.getElementById("swaptionSwapTenorSelect");
  if (optSel && !optSel.value && optionTenors.length) optSel.value = optionTenors[0];
  if (swpSel && !swpSel.value && swapTenors.length)   swpSel.value = swapTenors[0];

  // ✅ Signal (kein Render hier)
  document.dispatchEvent(
    new CustomEvent("swaption:atm:ready", { detail: { count: safeRows.length } })
  );
}

// 🔔 Sobald ATM-Daten da sind UND der Chart-Container existiert → Surface rendern
document.addEventListener("swaption:atm:ready", (ev) => {
  if (!appState) {
    console.log("[swaption:atm:ready] appState fehlt.");
    return;
  }

  const rows = appState.swaptionATM;
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("[swaption:atm:ready] Keine swaptionATM-Daten im State.");
    return;
  }

  const target = document.getElementById("swaption-atm-surface-3d");
  if (!target) {
    console.log("[swaption:atm:ready] swaption-atm-surface-3d noch nicht im DOM – wird später gerendert.");
    return;
  }

  console.log("[swaption:atm:ready] Daten & DOM vorhanden → renderVolSurfacePanel()");
  renderVolSurfacePanel();  // erzeugt PNG & notifyRiskPreview('interestRates')
});




// Nur setzen der Daten:
// function handleSwaptionSmileData(rows) {
//   if (!appState) return console.warn('[Smile] appState fehlt.');

//   const safeRows = Array.isArray(rows) ? rows : [];
//   appState.setSwaptionSmile(safeRows);

//   document.dispatchEvent(new CustomEvent("swaption:smile:ready", { detail: { count: safeRows.length } }));
// }

function handleSwaptionSmileData(rows) {
  if (!appState) return console.warn('[Smile] appState fehlt.');

  const safeRows = Array.isArray(rows) ? rows : [];
  appState.setSwaptionSmile(safeRows);

  // ✅ Signal: Smile-Daten sind da
  document.dispatchEvent(
    new CustomEvent("swaption:smile:ready", { detail: { count: safeRows.length } })
  );
}

// 🔔 Sobald Smile-Daten da sind UND der Chart-Canvas existiert → Smile rendern
document.addEventListener("swaption:smile:ready", (ev) => {
  if (!appState) {
    console.log("[swaption:smile:ready] appState fehlt.");
    return;
  }

  const rows = appState.swaptionSmile;
  if (!Array.isArray(rows) || rows.length === 0) {
    console.log("[swaption:smile:ready] Keine swaptionSmile-Daten im State.");
    return;
  }

  // Canvas für den Smile-Chart vorhanden?
  const canvas = document.getElementById("swaption-smile-chart");
  if (!canvas) {
    console.log("[swaption:smile:ready] #swaption-smile-chart noch nicht im DOM – wird später gerendert.");
    return;
  }

  console.log("[swaption:smile:ready] Daten & DOM vorhanden → renderSwaptionSmile()");
  renderSwaptionSmile();  // rendert Chart, Summary + notifyRiskPreview("interestRates")
});

// Beispiel: wird vom Python-Bridge aufgerufen, wenn der Cube fertig ist
// window.api.receive('EUSWAPTION_CUBE_SURFACE', handleSwaptionCubeSurfaceData);

export function handleSwaptionCubeSurfaceData(cubeSurfaceFixedK) {
  if (!appState) {
    console.warn('[handleSwaptionCubeSurfaceData] appState fehlt.');
    return;
  }

  const grid = buildCubeSurfaceGrid(cubeSurfaceFixedK);
  if (!grid) {
    console.warn('[handleSwaptionCubeSurfaceData] Grid konnte nicht gebaut werden.');
    return;
  }

  // Im State ablegen (oder Setter verwenden, falls vorhanden)
  if (appState.setSwaptionCubeSurface) {
    appState.setSwaptionCubeSurface(grid);
  } else {
    appState.swaptionCubeSurface = grid;
  }

  // Dropdowns befüllen
  populateSwaptionCubeSelectors();

  // Signal: Cube ist ready
  document.dispatchEvent(
    new CustomEvent("swaption:cube:ready", { detail: { strike: grid.strike } })
  );
}

// 🔔 Wenn Cube-Daten da sind UND der 3D-Chart-Container existiert → rendern
document.addEventListener("swaption:cube:ready", (ev) => {
  if (!appState) {
    console.log("[swaption:cube:ready] appState fehlt.");
    return;
  }

  const cube = appState.getSwaptionCubeSurface
    ? appState.getSwaptionCubeSurface()
    : appState.swaptionCubeSurface;

  if (!cube) {
    console.log("[swaption:cube:ready] Kein swaptionCubeSurface im State.");
    return;
  }

  const target = document.getElementById("swaption-cube-surface-3d");
  if (!target) {
    console.log("[swaption:cube:ready] #swaption-cube-surface-3d noch nicht im DOM – wird später gerendert.");
    return;
  }

  console.log("[swaption:cube:ready] Daten & DOM vorhanden → renderSwaptionCubeSurface3D()");
  renderSwaptionCubeSurface3D();      // erzeugt PNG + notifyRiskPreview('interestRates')
  renderSwaptionCubeSummary();       // Summary-Box aktualisieren
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
  // MVaR- Dist
  function handleMvarDistData(receivedData) {
      //console.log('handleMvarDistData:', receivedData)
    appState.setMvarDistData(receivedData); 
  }

    // CVaR:Input Threshold
  function initHandleCvarInput(receivedData) {
    appState.setCvarInput(receivedData);
    handleCvarInput();
  }
  // CVaR:Input Threshold
  function handleCvarInputThreshold(receivedData) {
    appState.setCvarInputThreshold(receivedData);
    handleCvarInputThresholdView();
  }
  // CVaR
  function handleAllCVaRData(receivedData) {
    // console.log("📊 Received full CVaR Data (new storage):", receivedData);
    appState.setAllCvarData(receivedData);  // ✅ Store in AllCvarData
  
    handleCVaRData(receivedData, 0) 
  }
  // CVaR-EAD
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

  // CVaR-Loss
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


function handlePortfolioHistoryData(receivedData) {
  //console.log("🔥 PortfolioHistoryMetricsData arrived:", receivedData?.length);
  appState.setPortfolioHistoryData(receivedData);
}

  // PROVIDER: ECB, FED...
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
  // EXCEL IMPORT
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
  // REPORTS PDF

// PDF-Button-Handler

function handlePreviewPDFClick() {
  const rows = rowsAsObjectsFrom('portDataContainer4');
  if (!rows.length) { alert('❌ Keine Daten in #portDataContainer4.'); return; }

  setOffersReportData(rows);
  openPanel('panel-reports-offers');
  wireOffersPreview({
    containerPreviewId: 'reportsOffersPreview',
    containerId: 'portDataContainer4',
    dropdownId: 'reportsOffersDropdown'
  });

  // anschließend rendern
  renderOffersPreview?.('reportsOffersPreview', 'portDataContainer4');
}

  // Offers PDF
// function handleOffersPDFClick() {
//   const data = getOffersReportData();
//   if (!data.length) { alert('❌ Bitte zuerst "Go to Report" klicken.'); return; }
//   const opts = getOffersReportOptions();
//   generateOfferPDF(data, opts);
// }
function handleOffersPDFClick() {
  // 1) Canvas -> DataURL merken (falls vorhanden)
  const c = document.getElementById('offersProductYieldChart');
  if (c && c.toDataURL) {
    try {
      window.__offersCharts = window.__offersCharts || {};
      window.__offersCharts.productYieldPNG = c.toDataURL('image/png');
    } catch (e) {
      console.warn('[OffersPDF] Canvas Snapshot fehlgeschlagen:', e);
    }
  }

  // 2) Rest unverändert
  const data = getOffersReportData();
  if (!data.length) { alert('❌ Bitte zuerst "Go to Report" klicken.'); return; }
  const opts = getOffersReportOptions();
  generateOfferPDF(data, opts);
}


// ===== Panel-Helfer (einmal definieren) =====
let __lastPanelOpener = null; // für Fokus-Rückgabe beim Schließen

export function openPanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) {
    console.warn(`openPanel: Panel "${panelId}" nicht gefunden.`);
    return;
  }
  // Opener merken (Element, das den Klick ausgelöst hat)
  __lastPanelOpener = document.activeElement;

  panel.hidden = false;
  panel.setAttribute('aria-modal', 'true');
  if (!panel.hasAttribute('tabindex')) panel.setAttribute('tabindex', '-1');
  panel.focus();
}

export function closePanel(panelId) {
  const panel = document.getElementById(panelId);
  if (!panel) return;
  panel.hidden = true;
  panel.removeAttribute('aria-modal');

  // Fokus zurück an den Opener (wenn noch im DOM)
  if (__lastPanelOpener && document.body.contains(__lastPanelOpener)) {
    __lastPanelOpener.focus();
  }
}





  // Risk PDF

  function sanitizeFileName(name) {
  const s = String(name || '').trim();
  if (!s) return '';
  return s
    .replace(/[<>:"/\\|?*\x00-\x1F]/g, '-')  // verbotene Zeichen (Win/macOS)
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 80);
}

  function getCurrentReportPresetName() {
  return (
    document.getElementById('customerReportsNameInput')?.value ||
    document.getElementById('customerReportsDropdown')?.value ||
    ''
  ).trim();
}
function handleRiskPDFClick() {
  const data = appState.getFilteredPortData?.() || [];
  if (!data.length) {
    alert('❌ Keine Angebotsdaten verfügbar!');
    return;
  }

  try {
    const presetName = getCurrentReportPresetName();
    const safeName = sanitizeFileName(presetName);
    const fileName = safeName ? `Risk - ${safeName}.pdf` : 'Risk.pdf';

    // ✅ PDF baut sich aus DOM + Checkbox-States, aber Dateiname kommt aus Preset
    generateRiskPDF(data, { fileName });
  } catch (e) {
    console.error(e);
    alert('Risk-PDF-Erstellung fehlgeschlagen.');
  }
}



    wireRiskPreview();


export async function handleRefreshThumbnailsClick(e) {
  const btn = e?.currentTarget || document.getElementById('refreshThumbnailsBtn');
  if (!btn) return;

  const original = btn.textContent;
  btn.disabled = true;
  btn.textContent = 'Refreshing…';

  try {
    // Daten holen (aus State)
    const portMainData =
      (window.appState?.getPortMainData?.() ||
       window.appState?.getPortMainTable?.() ||
       []);

    // IR Sensitivity (PV01)
    if (typeof handleIRSensData !== 'function') {
      throw new Error('handleIRSensData is not available (import missing or wrong)');
    }

    const irTable = handleIRSensData(portMainData);
    replaceContent('IRSensDataContainer', irTable);

    // Credit Sensitivity (CPV01)
    if (typeof handleCSSensData === 'function') {
      const crTable = handleCSSensData(portMainData);
      replaceContent('CSSensDataContainer', crTable);
    }

    // Optional: Event für weitere Listener (PDF / Preview etc.)
    document.dispatchEvent(
      new CustomEvent('risk:refresh-thumbnails', {
        detail: { source: 'manual-refresh' }
      })
    );

  } catch (err) {
    console.error('[RiskPDF] refresh failed:', err);
  } finally {
    btn.disabled = false;
    btn.textContent = original;
  }
}


// 3) Mini-Helper zum sicheren Ersetzen von Container-Inhalten
function replaceContent(containerId, node) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (node) el.appendChild(node);
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

// window.api.receive('update-data-success', () => {
//   const ddOffers  = document.getElementById('createdOffersDropdown');
//   const prevOffer = (appState.getSelectedPortTableName?.() || ddOffers?.value || '').trim();
//   console.log('update-data-success')
//   // 1) Deals frisch holen → appState.updateDealsDataTable übernimmt Render & State
//   window.api.once('DealsMainData', (rows) => {
//     appState.updateDealsDataTable?.(rows); // <-- deine Funktion eingebaut

//     // 2) Danach Offers/Portfolios für die gleiche Auswahl refreshen
//     if (prevOffer) {
//       fetchAndUpdateFairValueOffersData(prevOffer);               // lädt Portfolios + updated Offers-Dropdown
//       restoreDropdownSelection('createdOffersDropdown', prevOffer); // falls Optionen async kommen
//       appState.setSelectedPortTableName?.(prevOffer);
//     }
//   });

//   window.api.send('fetch-table-data', 'DealsMain');
// });


// ⬅️ Stell hier den Tabellennamen ein:
const ALL_PRODUCTS_TABLE = 'ProdAll'; // falls deine Tabelle 'ProdAll' heißt: const ALL_PRODUCTS_TABLE = 'ProdAll';

function updateProdAllCSGeneric(prodId, newCS) {
  return new Promise((resolve, reject) => {
    const payload = {
      cleanTableName: ALL_PRODUCTS_TABLE,
      rowIndex: 0, // wird bei dir ignoriert
      newData: { CS_Szenario: '' },   //  → leeren
      uniqueIdentifier: { column: 'PROD_ID', value: prodId }
    };
    const onOk  = () => resolve(true);
    const onErr = (msg) => reject(new Error(msg));

    if (window.api?.once) {
      window.api.once('update-data-success', onOk);
      window.api.once('update-data-error', onErr);
    } else {
      window.api.receive('update-data-success', onOk);
      window.api.receive('update-data-error', onErr);
    }
    window.api.send('update-data', payload);
  });
}

async function clearCSSzenarioForCurrentOffer() {
  // 1) aktuelles port_name ermitteln
  const portName = String(
    appState.getSelectedPortTableName?.() ||
    document.getElementById('createdOffersDropdown')?.value || ''
  ).trim();

  if (!portName) {
    console.warn('⚠️ Kein port_name ausgewählt – Abbruch.');
    return;
  }

  // 2) zugehörige PROD_IDs aus den Portfoliodaten holen
  const ports = appState.getAllPortfolioData?.() || [];
  const prodIds = [...new Set(
    ports.filter(r => String(r.port_name) === portName).map(r => r.PROD_ID)
  )];

  if (!prodIds.length) {
    console.warn(`⚠️ Keine PROD_IDs gefunden für '${portName}'.`);
    return;
  }

  //console.log(`Clear CS_Szenario in ${ALL_PRODUCTS_TABLE} für port='${portName}', #Products=${prodIds.length}`);

  // 3) sequenziell leeren
  for (const id of prodIds) {
    await updateProdAllCSGeneric(id, ''); // oder '' falls DB kein NULL mag
  }

  // 4) Daten refreshen (ProdAll/AllProducts + optional Portfolios)
  const onceIPC = (channel) => new Promise(res => (window.api?.once ? window.api.once(channel, res) : window.api.receive(channel, res)));

  try {
    const prodP = onceIPC('ProdAllData');  // falls deine App 'AllProductsData' sendet, passe den Channel an
    window.api.send('fetch-table-data', ALL_PRODUCTS_TABLE === 'ProdAll' ? 'ProdAll' : 'AllProducts');
    const freshProd = await prodP;
    appState.setAllProdData?.(freshProd);
  } catch (e) {
    console.warn('⚠️ Refresh AllProducts/ProdAll nicht empfangen – bitte Channel prüfen.', e);
  }

  // 5) Offers-Ansicht neu zeichnen (damit die Anzeige sofort leer ist)
  const filtered = ports.filter(r => String(r.port_name) === portName);
  appState.updateOffersDataTable?.(filtered, 0);
  // Optional: deine Preview
  if (typeof handlePortProdData === 'function') handlePortProdData(filtered, 4, portName);

  //console.log('✅ CS_Szenario geleert.');
}

// 6) Button-Handler binden
document.getElementById('clearCSButton')?.addEventListener('click', async (e) => {
  const btn = e.currentTarget;
  const old = btn.textContent;
  btn.disabled = true; btn.textContent = 'Clearing…';
  try { await clearCSSzenarioForCurrentOffer(); }
  finally { btn.disabled = false; btn.textContent = old; }
});





// === Checkboxen im Grid ===

window.enhanceDealsIncludeCheckboxes = enhanceDealsIncludeCheckboxes;

const DEALS_TABLE = 'DealsMain';

// IPC-Helper: setzt INCLUDE per eindeutigem Key in DealsMain
function updateDealsIncludeByKey(keyName, keyValue, includeVal) {
  return new Promise((resolve, reject) => {
    const payload = {
      cleanTableName: DEALS_TABLE,
      rowIndex: 0,
      newData: { INCLUDE: includeVal },
      uniqueIdentifier: { column: keyName, value: keyValue }
    };
    const ok  = () => resolve(true);
    const err = (msg) => reject(new Error(msg));

    if (window.api?.once) {
      window.api.once('update-data-success', ok);
      window.api.once('update-data-error', err);
    } else {
      window.api.receive('update-data-success', ok);
      window.api.receive('update-data-error', err);
    }
    window.api.send('update-data', payload);
  });
}

function enhanceDealsIncludeCheckboxes(container = '#offersDataContainer', opts = {}) {
  const {
    includeColName = 'include',
    observe = true,
    maxScanPerTick = 200,
  } = opts;

  const root = (typeof container === 'string') ? document.querySelector(container) : container;
  if (!root) { console.warn('[enhanceDealsIncludeCheckboxes] container not found:', container); return; }

  // Mehrfach-Mount verhindern
  if (root.dataset.includeEnhancerMounted === '1') return;
  root.dataset.includeEnhancerMounted = '1';

  const norm = v => String(v ?? '').trim().toLowerCase();

  // ----- Helpers
  const getHeaderCells = (host) => {
    const tableLike = host.querySelector('table') || host;
    let cells = Array.from(tableLike.querySelectorAll('thead th, thead td'));
    let rowEl = null;
    if (cells.length) {
      rowEl = cells[0].parentElement || null;
    } else {
      const thRow = tableLike.querySelector('tr:has(th)');
      if (thRow) { cells = Array.from(thRow.children); rowEl = thRow; }
    }
    if (!cells.length) {
      const aria = Array.from(tableLike.querySelectorAll('[role="columnheader"]'));
      if (aria.length) { cells = aria; rowEl = aria[0]?.parentElement || null; }
    }
    return { cells, rowEl, tableLike };
  };

  const getColNameFromCell = (cell) =>
    norm(cell?.getAttribute?.('data-col') || cell?.getAttribute?.('aria-colname') || cell?.textContent || '');

  const findIndexByName = (cells, name) =>
    cells.findIndex(c => getColNameFromCell(c) === norm(name));

  const getDataRows = (host) => {
    const { tableLike } = getHeaderCells(host);
    let rows = Array.from(tableLike.querySelectorAll('tbody tr'));
    if (!rows.length) {
      const headerRow = tableLike.querySelector('thead tr') || tableLike.querySelector('tr:has(th)');
      rows = Array.from(tableLike.querySelectorAll('tr')).filter(tr =>
        tr !== headerRow &&
        !tr.closest('thead') &&
        !Array.from(tr.children).some(c => c.tagName === 'TH') &&
        !/header/i.test(tr.className)
      );
    }
    return rows;
  };

  const keyCandidates = ['TRADE_ID','PROD_ID','row_id','rowid','id','_id','uid'];

  const resolveKeyIndex = (rows, headerCells) => {
    if (headerCells && headerCells.length) {
      for (const k of keyCandidates) {
        const i = findIndexByName(headerCells, k);
        if (i >= 0) return { keyIndex: i, keyName: k };
      }
    }
    const first = rows[0];
    if (first) {
      const cells = Array.from(first.children);
      for (let i = 0; i < cells.length; i++) {
        const name = (cells[i].getAttribute?.('data-col') || cells[i].getAttribute?.('aria-colname') || '').toUpperCase();
        if (keyCandidates.includes(name)) {
          return { keyIndex: i, keyName: name };
        }
      }
    }
    return { keyIndex: -1, keyName: 'PROD_ID' };
  };

  const resolveIncludeIndex = (rows, headerCells) => {
    if (headerCells && headerCells.length) {
      const i = findIndexByName(headerCells, includeColName);
      if (i >= 0) return i;
    }
    const first = rows[0];
    if (!first) return -1;
    const byAttr = first.querySelector('[data-col="include"], [aria-colname="include"], .include-col');
    if (byAttr) {
      const cells = Array.from(first.children);
      const idx = cells.indexOf(byAttr);
      if (idx >= 0) return idx;
    }
    const cb = first.querySelector('input[type="checkbox"][title="Toggle INCLUDE"]');
    if (cb) {
      const td = cb.closest('td,th,div');
      if (td) {
        const cells = Array.from(first.children);
        const idx = cells.indexOf(td);
        if (idx >= 0) return idx;
      }
    }
    return -1;
  };

  // ----- Kern
  const enhanceBatch = () => {
    const { cells: headerCells } = getHeaderCells(root);
    const rows = getDataRows(root);
    if (!rows.length) return false;

    const idxInclude = resolveIncludeIndex(rows, headerCells);
    if (idxInclude < 0) return false;

    const { keyIndex, keyName: keyNameResolved } = resolveKeyIndex(rows, headerCells);
    let keyName = keyNameResolved;

    let enhancedCount = 0;
    for (const tr of rows) {
      if (enhancedCount >= maxScanPerTick) break;

      const cells = Array.from(tr.children);
      let tdInclude = cells[idxInclude] ||
                      tr.querySelector('[data-col="include"], [aria-colname="include"], .include-col');
      if (!tdInclude) continue;

      // Schon enhanced?
      if (tdInclude.querySelector('input[type="checkbox"][title="Toggle INCLUDE"]')) continue;

      // Key
      let keyVal = (keyIndex >= 0 && cells[keyIndex]) ? cells[keyIndex].textContent.trim() : null;
      if (!keyVal && tr.dataset) {
        for (const k of keyCandidates) {
          if (tr.dataset[k] != null) { keyVal = tr.dataset[k]; keyName = k.toUpperCase(); break; }
        }
      }
      if (!keyVal) {
        const guess = tr.querySelector('[data-col="PROD_ID"], [aria-colname="PROD_ID"]');
        if (guess) { keyVal = guess.textContent.trim(); keyName = 'PROD_ID'; }
      }
      if (!keyVal) continue;

      // aktueller Wert
      const rawTxt = String(tdInclude.textContent || '').trim();
      const attrVal = tdInclude.getAttribute?.('data-value');
      const current =
        rawTxt === '1' || norm(rawTxt) === 'true' ||
        attrVal === '1' || norm(attrVal) === 'true';

      // Marker
      tdInclude.setAttribute('data-col', 'include');
      tdInclude.setAttribute('aria-colname', 'include');
      tdInclude.classList.add('include-col', 'enhanced-include');

      // Checkbox Listener==========================================================================================
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = current;
      cb.title = 'Toggle INCLUDE';
      cb.style.transform = 'scale(1.05)';
      cb.style.cursor = 'pointer';

      tdInclude.textContent = '';
      tdInclude.appendChild(cb);

      // 👉 LEICHTGEWICHTIGER TOGGLE (kein Full-Rebuild, kein OFFERS-Filter!)==============================================LISTENER
      cb.addEventListener('change', async () => {
        const newVal = cb.checked ? 1 : 0;
        try {
          cb.disabled = true;
          await updateDealsIncludeByKey(keyName, keyVal, newVal);

          // 1) Globalen Datenbestand patchen (nur Wert ändern)
          const AS = window.appState;
          if (AS?.getAllDealsData && AS?.setAllDealsData) {
            const allDeals = AS.getAllDealsData() || [];
            const idEq = (a,b)=> String(a??'').trim()===String(b??'').trim();
            const row = allDeals.find(r => idEq(r?.[keyName], keyVal));
            if (row) row.INCLUDE = newVal;
            AS.setAllDealsData(allDeals);
          }

          // 2) DOM & Marker aktuell halten – reicht für sichtbaren Toggle
          tdInclude.setAttribute('data-value', String(newVal));

          // 3) Optional: leichtes Signal, aber NICHT updateDealsDataTable(...)
          document.dispatchEvent(new Event('dealsData:ready'));
        } catch (err) {
          console.warn('[enhanceDealsIncludeCheckboxes] INCLUDE update failed, reverting', err);
          cb.checked = !cb.checked;
        } finally {
          cb.disabled = false;
        }
      }, { passive: true });

      enhancedCount++;
    }
    return enhancedCount > 0;
  };

  // Sofort versuchen
  enhanceBatch();

  // Neu hinzukommende Zeilen nach-enhancen (ohne rAF/Timeout Spam)
  if (observe) {
    const mo = new MutationObserver((mlist) => {
      const needs = mlist.some(m =>
        m.addedNodes && Array.from(m.addedNodes).some(n =>
          (n.nodeType === 1) && (
            n.matches?.('tr, tbody, table') ||
            n.querySelector?.('tr, tbody, table, [data-col="include"], [aria-colname="include"]')
          )
        )
      );
      if (needs) enhanceBatch();
    });
    mo.observe(root, { childList: true, subtree: true });
    root.__includeEnhancerMO = mo;
  }
}




  // =================================PYTHON EXECUTION:===============================

function handleProjectButtonClick(buttonElement, projectName, extraParam = {}) {
  if (!buttonElement) return;

  const originalLabel = buttonElement.dataset.originalLabel || buttonElement.textContent;
  buttonElement.dataset.originalLabel = originalLabel;
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

      case 'py-fairValue': {
        const isOffersBtn = (buttonElement.id === 'fairValueButton2');
        // 🔵 Nur Flag/Parameter setzen – Rest macht Python
        handleFairValueProject(buttonElement, {
          ...extraParam,
          calibrate: isOffersBtn,
          cal_iters: 2, // ggf. aus Settings holen
        });
        break;
      }

      case 'py-CVaR':
        handleCVaRProject(buttonElement, extraParam);
        break;

      case 'py-MVaR':
        handleMVaRProject(buttonElement, extraParam);
        break;

      case 'py-hist': {
        const apiMap = { histEcbButton: 'ECB', histFedButton: 'FED', histYahooButton: 'Yahoo' };
        const apiSource = apiMap[buttonElement.id];
        if (apiSource) extraParam.api = apiSource;
        handleHistProject(buttonElement, extraParam);
        break;
        
      }

      // 🔴 NEU: Excel-Import mit Modes (ALL, ISSUER, PRODUCTS, DEALS, EUSW)
      case 'py-excel': {
        const modeMap = {
          updateExcelAllButton:    'ALL',
          updateExcelIssuerButton: 'ISSUER',
          updateExcelProductsButton: 'PRODUCTS',
          updateExcelDealsButton:  'DEALS',
          updateExcelEuswButton:   'EUSW',
        };

        const mode = modeMap[buttonElement.id] || 'ALL';

        // hier wie bei den anderen Projekten: table-Arg = mode
        // sendPayloadToAPI(projectName, tableName, extraParam)
        sendPayloadToAPI(projectName, mode, extraParam);
        break;
      }

          // 🔵 NEU: Swaption-Cube
        case 'py-swaption':
          handleSwaptionProject(buttonElement, extraParam);
        break;

      default: {
        const selectedTableName = appState.getSelectedDealsTableName() || 'DealsMain';
        sendPayloadToAPI(projectName, selectedTableName, extraParam);
        break;
      }
    }

    // ✅ Einheitlicher Done-Listener
    const handler = () => {
      buttonElement.disabled = false;
      buttonElement.textContent = originalLabel || 'Run';
    };
    if (window.api?.once) {
      window.api.once(`${projectName}-complete`, handler);
    } else {
      window.api.receive(`${projectName}-complete`, handler);
    }

  } catch (error) {
    console.error(`Error handling project "${projectName}":`, error);
    alert('An error occurred while executing the project.');
    buttonElement.disabled = false;
    buttonElement.textContent = originalLabel || 'Run';
  }
}

  //fairvalue

      function handleFairValueProject(buttonElement, extraParam = {}) {
        const id = buttonElement?.id || '';
        const preferredSource =
          id === 'fairValueButton2' ? 'offers' :
          id === 'fairValueButton' ? 'port'   :
          'deals';

        const dealsName  = appState.getSelectedDealsTableName?.();
        const portName   = appState.getSelectedPortTableName?.();
        const offersName = appState.getSelectedOffersTableName?.();

        const pickBySource = (src) => {
          switch (src) {
            case 'offers': return offersName || dealsName || portName || '';
            case 'port':   return portName   || dealsName || offersName || '';
            //case 'deals':  return dealsName   || dealsName || offersName || '';
            default:       return dealsName  || portName  || offersName || '';
          }
        };

        const tableName = String(pickBySource(preferredSource)).trim();
        if (!tableName) {
          console.warn('⚠️ Kein Name ausgewählt (deals/port/offers).');
          return;
        }

        if (!dealsName && appState.setSelectedDealsTableName) {
          appState.setSelectedDealsTableName(tableName);
        }

        const CSSzenario    = appState.getCSSzenarioData?.();
        const selectedCurve = appState.getSelectedCurve?.();
        if (!CSSzenario) {
          console.warn('⚠️ Kein CSSzenario gesetzt. Bitte zuerst Szenario wählen.');
          return;
        }

        const payload = {
          tableName,
          source: preferredSource,
          CSSzenario,
          selectedCurve,
          selectedDealsTableName:  dealsName  || '',
          selectedPortTableName:   portName   || '',
          selectedOffersTableName: offersName || '',
          ...extraParam,
        };

        // WICHTIG: hier KEIN handleProjectResponse aufrufen
        window.api?.send?.('start-py-fairValue', payload);
      }
          function handleFairValueComplete(data) {
            console.log('📌 handleFairValueComplete wurde ausgelöst:', data);
            if (data.projectName !== 'py-fairValue') return;

            //const port_name1 = appState.getSelectedPortTableName();
            console.log('port_name:', appState.getSelectedPortTableName());
            let port_name = appState.getSelectedPortTableName();
            //const port_name = String(appState.getSelectedDealsTableName?.() || '');
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
              //port_name = appState.getSelectedPortTableName();
              //console.log('port_name:', port_name);
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
                    console.warn("⚠️ Kein Portfolio ausgewählt.", port_name );
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
                //console.log('fetchAndUpdateFairValueOffersData wird Ausgeführt')
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

              handleProjectResponse(document.getElementById('mvaRDistButton'), data.projectName, data);

              fetchAndUpdateMVarData(port_name);
        
              const mvarData = appState.getAllMvarData();
              handleMVaRData(mvarData, 0);

              handleSummaryMarketRiskData(port_name);
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
      function handleCVaRProject(buttonElement, extraParam = {}) {
        const port_name = appState.getSelectedPortTableName();
        const CSSzenario = appState.getCSSzenarioData();

        if (!CSSzenario) {
          throw new Error('No scenario data available. Please set a scenario first.');
        }

        if (!extraParam.cvarName) {
          throw new Error('No CVaR configuration name (cvarName) provided.');
        }

        const payload = {
          tableName: port_name,
          CSSzenario,
          cvarName: extraParam.cvarName,   // 👈 kommt direkt vom Radio
        };

        console.log('🚀 Sending payload for py-CVaR:', payload);
        window.api.send('start-py-CVaR', payload);
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


// SWAPTION CUBE
      function handleSwaptionProject(buttonElement, extraParam = {}) {
        // Wenn du die Curve schon im State hast:
        const selectedCurve = appState.getSelectedCurve?.() || 'EUSWAP';

        const payload = {
          selectedCurve,
          ...extraParam,
        };

        // Startet den IPC-Call, den wir im Main definiert haben
        window.api?.send?.('start-py-swaption', payload);
      }
// function handleSwaptionComplete(data) {
//   console.log('📌 handleSwaptionComplete:', data);
//   if (data.projectName !== 'py-swaption') return;

//   if (!data.success) {
//     console.error('❌ Swaption-Run fehlgeschlagen:', data.error);
//     return;
//   }

//   const outer = data.result || {};
//   if (outer.status !== 'ok') {
//     console.error('❌ Swaption status != ok:', outer.message || outer.error);
//     return;
//   }

//   const core = outer.result || {};
//   const { cubeSurfaceFixedK } = core;

//   const cubeGrid = buildCubeSurfaceGrid(cubeSurfaceFixedK);
//   if (!cubeGrid) {
//     console.warn('[handleSwaptionComplete] Konnte cubeGrid nicht bauen.');
//     return;
//   }

//   if (appState.setSwaptionCubeSurface) {
//     appState.setSwaptionCubeSurface(cubeGrid);
//   } else {
//     appState.swaptionCubeSurface = cubeGrid;
//   }

//   // 🔹 Selects befüllen + Default (2Y / 5Y) setzen
//   populateSwaptionCubeSelectors();

//   // 🔹 Surface rendern
//   renderSwaptionCubeSurface3D();
// }

function handleSwaptionComplete(data) {
  console.log('📌 handleSwaptionComplete:', data);
  if (data.projectName !== 'py-swaption') return;

  if (!data.success) {
    console.error('❌ Swaption-Run fehlgeschlagen:', data.error);
    return;
  }

  const outer = data.result || {};
  if (outer.status !== 'ok') {
    console.error('❌ Swaption status != ok:', outer.message || outer.error);
    return;
  }

  const core = outer.result || {};
  const { cubeSurfaceFixedK } = core;

  // 🔹 Cube-Grid aus Python-Result bauen
  const cubeGrid = buildCubeSurfaceGrid(cubeSurfaceFixedK);
  if (!cubeGrid) {
    console.warn('[handleSwaptionComplete] Konnte cubeGrid nicht bauen.');
    return;
  }

  // 🔹 Im State ablegen
  if (appState.setSwaptionCubeSurface) {
    appState.setSwaptionCubeSurface(cubeGrid);
  } else {
    appState.swaptionCubeSurface = cubeGrid;
  }

  // 🔹 Selects für Cube befüllen + Default setzen
  populateSwaptionCubeSelectors();

  // 🔹 3D-Cube rendern → erzeugt PNG + notifyRiskPreview("interestRates")
  renderSwaptionCubeSurface3D();

  // 🔹 Summary-Box aktualisieren (optional, aber sinnvoll)
  try {
    renderSwaptionCubeSummary();
  } catch (e) {
    console.warn('[handleSwaptionComplete] renderSwaptionCubeSummary failed', e);
  }

  // (optional) Event für andere Listener
  document.dispatchEvent(
    new CustomEvent("swaption:cube:ready", { detail: { strike: cubeGrid.strike } })
  );
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


  function handleProjectFinished(data) {
    const projectButtonMap = {
      // 'py-MVaR': 'MVaRButton',
      'py-MVaR': 'mvaRDistButton',
      'py-CVaR': 'CVaRButton',
      // 'py-excel' fällt hier raus – mehrere Buttons!
      'py-historicData': 'updateHistoricDataButton',
      'py-cspar': 'CSParButton',
      'py-ml': 'MLButton'
    };

    // 🔹 Spezialrouting für py-fairValue (3 Buttons)
    if (data.projectName === 'py-fairValue') {
      const sourceToId = {
        deals:  'fairValueButton1',
        port:   'fairValueButton',
        offers: 'fairValueButton2'
      };

      // 1) Bevorzugt per data.source (falls du sie mitsendest)
      let buttonId = sourceToId[data?.source];

      // 2) Fallback: der aktuell deaktivierte Fair-Value-Button
      if (!buttonId) {
        buttonId = ['fairValueButton', 'fairValueButton1', 'fairValueButton2']
          .find(id => document.getElementById(id)?.disabled);
      }

      const btn = document.getElementById(buttonId || '');
      if (btn) {
        handleProjectResponse(btn, data.projectName, data);
      }
      return; // fairValue erledigt
    }

    // 🔹 NEU: Spezialrouting für py-excel (5 Buttons)
    if (data.projectName === 'py-excel') {
      const excelIds = [
        'updateExcelAllButton',
        'updateExcelIssuerButton',
        'updateExcelProductsButton',
        'updateExcelDealsButton',
        'updateExcelEuswButton',
      ];

      // Nimm den Button, der gerade disabled ist (der, den der User geklickt hat)
      const buttonId = excelIds.find(id => document.getElementById(id)?.disabled);
      const btn = buttonId ? document.getElementById(buttonId) : null;

      if (btn) {
        handleProjectResponse(btn, data.projectName, data);
      }
      return; // Excel erledigt
    }

    // 🔹 Standard-Zuordnung für Projekte mit EINEM Button
    const buttonId = projectButtonMap[data.projectName];
    if (buttonId) {
      handleProjectResponse(document.getElementById(buttonId), data.projectName, data);
    }
  }


  function handleProjectResponse(buttonElement, projectName, response) {
    const projectLabels = {
      'py-fairValue':    'Fair Value',
      'py-MVaR':         'P/L Dist',
      'py-CVaR':         'Credit VaR',
      'py-ml':           'Machine Learning',
      'py-excel':        'Excel Update',
      'py-cspar':        'CS Parser',
      'py-matchColumns': 'Match Columns',
      'py-historicData': 'Historic Data',
      'py-hist':         'Historical Update',
    };

    // Falls du handleProjectResponse aus Versehen beim Start rufst und {sent:true} mitgibst:
    if (response && response.sent) return;

    if (buttonElement) {
      buttonElement.disabled = false;

      // 🔹 Bevorzugt das Original-Label (wird in handleProjectButtonClick gesetzt)
      const originalLabel = buttonElement.dataset.originalLabel;
      if (originalLabel) {
        buttonElement.textContent = originalLabel;
      } else {
        buttonElement.textContent = projectLabels[projectName] || 'Run';
      }
    }

    if (response && response.success === false) {
      console.error(`Error starting ${projectName}:`, response.error);
    }
  }



//======================================PYTHON FINISH================================




export { appState };
