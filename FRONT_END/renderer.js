import { bootstrapStores } from './bootstrap/bootstrapStores.js';
import { bootstrapUIBasics } from './bootstrap/bootstrapUIBasics.js';



import { installDropdownFilterEngine } from './STATE/dropdownFilterEngine.js';
import { installDataUpdatePipeline } from './STATE/dataUpdatePipeline.js';
import { createPortfolioUIOrchestrator } from './STATE/portfolioUIOrchestrator.js';
import { installMarketDataStore } from './STATE/marketDataStore.js';
import { installCustomerReportsStore } from './STATE/customerReportsStore.js';
import { installProductsStore } from './STATE/productsStore.js';
import { installNameListsStore } from './STATE/nameListsStore.js';
import { installPortfolioDataStore } from './STATE/portfolioDataStore.js';
import { installMarketRiskStore } from './STATE/marketRiskStore.js';
import { installCreditRiskStore } from './STATE/creditRiskStore.js';
import { installUIStateStore } from './STATE/uiStateStore.js';

import { createPortfolioDropdownUI } from './UI/portfolioDropdownUI.js';
import { createMarketRiskRefresh } from './UI/marketRiskRefresh.js';



import { openPanel} from './UI/panels.js';
import { installBulkUpdateBridge } from './UI/bulkUpdateBridge.js';
import { bindGlobalChangeDelegation } from './UI/globalChangeDelegation.js';
import { bindSwaptionReadyListeners } from './MARKET_DATA/VOLS/swaptionReadyListeners.js';
import { bindSwaptionDropdownListeners } from './MARKET_DATA/VOLS/swaptionDropdownListeners.js';

import { installReportsUIBridge } from './REPORTS/reportsUIBridge.js';


import { createSwaptionDataHandlers } from './MARKET_DATA/VOLS/swaptionDataHandlers.js';

import { installIpcBridge } from './IPC/ipcBridge.js';

import { bindDropdowns } from './UI/bindDropdowns.js';
import { showMessageBox, showConfirmationBox } from './UI/modals/confirm.js';
import { createDealsPortfolioActions } from './SELECT_PORTFOLIO/dealsPortfolioActions.js';

import { createIssuerProductHandlers } from './DATA_PROVIDER/issuerProductHandlers.js';

import { handleCSMatrixData } from './MARKET_DATA/CREDIT_SPREADS/CSMatrix.js';
import { handleCSParameterData } from './MARKET_DATA/CREDIT_SPREADS/CSParameter.js';



import { createCustomerHandlers } from './CUSTOMER/customerHandlers.js';
import { createAnalysePortfolioHandlers } from './ANALYSE_PORTFOLIO/analysePortfolioHandlers.js';
import { createRatesHandlers } from './MARKET_DATA/INTEREST_RATES/ratesHandlers.js';

import { bindClearCSScenario } from './OFFERS/csScenarioUI.js';
import { bindForwardsButtons } from './MARKET_DATA/FORWARDS/forwardsUI.js';
import { createForwardsHandlers } from './MARKET_DATA/FORWARDS/forwardsHandlers.js';
import { bindAppButtons } from './UI/bindAppButtons.js';
import { setupReportsEnterLeaveBridge } from './REPORTS/reportsEnterLeaveBridge.js';

import { installPythonBridge } from '../PYTHON/pythonBridge.js';
import { installPythonProgressBarsBridge } from '../PYTHON/pythonProgressBarsBridge.js';
import { installMarketProvidersBridge } from './MARKET_DATA/PROVIDERS/marketProvidersBridge.js';
import { installDealsEnhancerBridge } from './OFFERS/dealsEnhancerBridge.js';






import { initPortfolioPanelsLazyRender} from './initAnalysePortfolioPanels.js';
import { initMarketDataPanelsLazyRender} from './initMarketDataPanels.js';
import { initMarketDataChartsAutoRefresh} from './initMarketDataRefresh.js';
import { createTSModals, observePanelTsOpen} from './MARKET_DATA/HISTORIC_DATA/TS.js';
import { handleExcelComplete } from './UPDATES/updatesExcel.js';
import { buildCubeSurfaceGrid, populateSwaptionCubeSelectors} from './MARKET_DATA/VOLS/volCube.js';
import { handlePortAggData, handlePortProdData} from './SELECT_PORTFOLIO/PORT.js';
import { handleMVaRData, handleMvarInputData} from './ANALYSE_PORTFOLIO/MARKET_RISK/MVaR.js'; 
import { handleIRSensData } from './ANALYSE_PORTFOLIO/MARKET_RISK/IRSens.js';
import { handleCSSensData } from './ANALYSE_PORTFOLIO/MARKET_RISK/CSSens.js';
import { handleCvarInput} from './ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInput.js'; 
import { handleCvarInputThresholdView} from './ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInputThreshold.js'; 
import { handleCVaRData, handleEADData} from './ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js'; 
import { handleFWDData } from './MARKET_DATA/FORWARDS/forwards.js';
import { handleProviderData } from './DATA_PROVIDER/DATAProvider.js'; 
import { handleFuturePredictions, handleMLTestData, handleMLTrainedModels, handleMLModels} from './MARKET_DATA/FORCASTING/ML.js'; 
import { handleLossIssuerMainData,} from './ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js'; 

import { handleSummaryMarketRiskData, handleMvarProductTable} from './ANALYSE_PORTFOLIO/SummaryMarketRisk.js';
import { startOfferImport, handleSubmitMatching, quickImportWithStandardMapping } from './NEW_PRODUCTS/offers.js';

//REPORT:
import { setupCustomerReportsPresetUI} from './REPORTS/CustomerReportsPresetUI.js';
import { handleHistoricMetricsAddClick} from './ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/saveHistoricRiskMetrics.js';

import { tooltips } from '../utils/ToolTip.js';
import { AppState } from '../AppState.js';
import { initializeTabs } from '../utils/tabs.js';


import { handleModalAction } from '../MODAL_HELPER/ModalActionHandler.js';

// =========================
// Renderer Bootstrap Sections
// =========================



let appState;


const panelRenderState = Object.create(null);



document.addEventListener('DOMContentLoaded', () => {

  appState = bootstrapCreateAppState();

  bootstrapStores(appState);

  bootstrapUIBasics(appState);






const {
  issuerProdHandlers,
  customerHandlers,
  dealsActions,
  ratesHandlers,
  forwardsHandlers,
  analyseHandlers,
  handleSwaptionATMData,
  handleSwaptionSmileData,
  handleSwaptionCubeSurfaceData,
} = bootstrapHandlers(appState);



  bootstrapBridges(appState, {
    api: window.api,
    ratesHandlers,
    handlePortProdData,
    handleProviderData,
  });


  const { py } = bootstrapPython(appState, {
    handlePortAggData,
    handlePortProdData,
    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    onExcelComplete: handleExcelComplete,
  });




  bootstrapIPC({
    api: window.api,
    appState,
    panelRenderState,
    initAllPanelsLazyRender,
    initMarketDataChartsAutoRefresh,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    customerHandlers,
    ratesHandlers,
    forwardsHandlers,
    issuerProdHandlers,
    dealsActions,
    analyseHandlers,

    handleFuturePredictions,
    handleMLTestData,
    handleMLTrainedModels,
    handleMLModels,

    createTSModals,
    observePanelTsOpen,
  });


  bootstrapBindings(appState, {
    dealsActions,
    py,

    handleFWDData,
    handleIRSensData,
    handleCSSensData,

    handleHistoricMetricsAddClick,
    handleExcelImport,

    startOfferImport,
    handleSubmitMatching,
    quickImportWithStandardMapping,

    updateTooltipsFn: updateTooltips,

    openPanel,

    setupCustomerReportsPresetUI,
  });


});

function bootstrapCreateAppState() {
  return new AppState();
}

function bootstrapHandlers(appState) {
  const issuerProdHandlers = createIssuerProductHandlers({ appState });
  const customerHandlers = createCustomerHandlers({ appState });

  const dealsActions = createDealsPortfolioActions({
    appState,
    api: window.api,
    showMessageBox,
    showConfirmationBox,
    handleModalAction,
  });

  const ratesHandlers = createRatesHandlers({ appState });

  // Backwards compatibility
  appState.handleCSMatrixData = handleCSMatrixData;
  appState.handleCSParameterData = handleCSParameterData;

  const {
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,
  } = createSwaptionDataHandlers({ appState });

  const forwardsHandlers = createForwardsHandlers({ appState });

  const analyseHandlers = createAnalysePortfolioHandlers({
    appState,

    handleMVaRData,
    handleCVaRData,
    handleEADData,
    handleLossIssuerMainData,

    handleCvarInput,
    handleCvarInputThresholdView,
  });

  return {
    issuerProdHandlers,
    customerHandlers,
    dealsActions,
    ratesHandlers,
    forwardsHandlers,
    analyseHandlers,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,
  };
}

function bootstrapIPC(deps) {
  const {
    api,
    appState,
    panelRenderState,
    initAllPanelsLazyRender,
    initMarketDataChartsAutoRefresh,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    customerHandlers,
    ratesHandlers,
    forwardsHandlers,
    issuerProdHandlers,
    dealsActions,
    analyseHandlers,

    handleFuturePredictions,
    handleMLTestData,
    handleMLTrainedModels,
    handleMLModels,

    createTSModals,
    observePanelTsOpen,
  } = deps;

  installIpcBridge({
    api: window.api,
    appState,
    panelRenderState,
    initAllPanelsLazyRender,
    initMarketDataChartsAutoRefresh,

    // Swaption (kommt NICHT aus Handler-Objekten)
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    // MVaR Input (kommt bei dir als Import)
    handleMvarInputData,

    // ✅ Handler-Objekte 1:1 reinspreadden (keine zweite Liste pflegen!)
    ...issuerProdHandlers,
    ...customerHandlers,
    ...ratesHandlers,
    ...forwardsHandlers,
    ...dealsActions,
    ...analyseHandlers,

    // ML (freie Imports/Funktionen)
    handleFuturePredictions,
    handleMLTestData,
    handleMLTrainedModels,
    handleMLModels,

    // TS (freie Imports/Funktionen)
    createTSModals,
    observePanelTsOpen,
  });

}

function bootstrapPython(appState, deps) {
  const {
    handlePortAggData,
    handlePortProdData,
    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    onExcelComplete,
  } = deps;

  const { py } = installPythonBridge({
    appState,

    handlePortAggData,
    handlePortProdData,
    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    openPortAnalyseAndFocus: (typeof openPortAnalyseAndFocus === 'function') ? openPortAnalyseAndFocus : null,

    onExcelComplete,

    exposeGlobal: true,
  });

  installPythonProgressBarsBridge();

  return { py };
}

function bootstrapBindings(appState, deps) {
  const {
    dealsActions,
    py,

    handleFWDData,
    handleIRSensData,
    handleCSSensData,

    handleHistoricMetricsAddClick,
    handleExcelImport,

    startOfferImport,
    handleSubmitMatching,
    quickImportWithStandardMapping,

    updateTooltipsFn,

    openPanel,

    setupCustomerReportsPresetUI,
  } = deps;

  bindDropdowns({ appState });

  bindForwardsButtons({
    appState,
    handleFWDData,
    bindings: [
      { buttonId: 'applyCMSButton', applyCubicSpline: false },
      { buttonId: 'applyCMSCubicButton', applyCubicSpline: true },
    ],
  });

  bindSwaptionDropdownListeners();

  bindAppButtons({
    dealsActions,
    py,

    handleHistoricMetricsAddClick,
    handleExcelImport,

    handleSubmitMatchedColumns:
      (typeof handleSubmitMatchedColumns === 'function') ? handleSubmitMatchedColumns : null,

    startOfferImport,
    handleSubmitMatching,
    quickImportWithStandardMapping,

    updateTooltipsFn,
  });

  installReportsUIBridge({
    openPanel,
    appState,
    handleIRSensData,
    handleCSSensData,
  });

  initializeTabs();
  setupReportsEnterLeaveBridge({ setupCustomerReportsPresetUI });

  installBulkUpdateBridge();

  installDealsEnhancerBridge({ appState });
}

function bootstrapBridges(appState, deps) {
  const {
    api,
    ratesHandlers,
    handlePortProdData,
    handleProviderData,
  } = deps;

  // Für GLOBALE SZENARIEN!
  bindGlobalChangeDelegation({
    appState,
    handleEUSWData: ratesHandlers.handleEUSWData,
  });

  bindClearCSScenario({
    appState,
    api,
    handlePortProdData,
  });

  installMarketProvidersBridge({
    api,
    handleProviderData,
  });

  // Debug (optional)
  window.appState = appState;

  bindSwaptionReadyListeners({ appState });
}











function initAllPanelsLazyRender() {
  initPortfolioPanelsLazyRender({ panelRenderState });
  initMarketDataPanelsLazyRender({ panelRenderState });
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

export { appState };
