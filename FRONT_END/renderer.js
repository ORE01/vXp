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


let appState;


const panelRenderState = Object.create(null);



document.addEventListener('DOMContentLoaded', () => {
  appState = new AppState();

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

  // ✅ Swaption Handler sofort erzeugen (vor jeder Nutzung!)
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


  // Für GLOBALE SZENARIEN!
  bindGlobalChangeDelegation({
    appState,
    handleEUSWData: ratesHandlers.handleEUSWData,
  });

  bindClearCSScenario({
    appState,
    api: window.api,
    handlePortProdData,
  });

  installMarketProvidersBridge({
    api: window.api,
    handleProviderData,
  });

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

    onExcelComplete: handleExcelComplete,

    // optional: später wenn du UI mapping komplett rausziehst
    // onAIColumnComplete: handleAIColumnComplete,

    exposeGlobal: true, // kannst du später auf false setzen, wenn alles DI-only ist
  });

  // Debug (optional): remove later
  window.appState = appState;

  bindSwaptionReadyListeners({ appState });

  installIpcBridge({
    api: window.api,
    appState,
    panelRenderState,
    initAllPanelsLazyRender,
    initMarketDataChartsAutoRefresh,

    // Swaption
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    // Customer / Rates / Forwards
    handleCustomerData: customerHandlers.handleCustomerData,
    handleCustomerTSData: customerHandlers.handleCustomerTSData,
    handleEUSWData: ratesHandlers.handleEUSWData,
    handleForwardData: forwardsHandlers.handleForwardData,

    // Issuer / Product
    handleIssuerDataInit: issuerProdHandlers.handleIssuerDataInit,
    handleCountryLookupDataInit: issuerProdHandlers.handleCountryLookupDataInit,
    handleCSMatrixData: issuerProdHandlers.handleCSMatrixData,
    handleCSParameterData: issuerProdHandlers.handleCSParameterData,
    handleRankData: issuerProdHandlers.handleRankData,
    handleProdDataInit: issuerProdHandlers.handleProdDataInit,

    // Deals
    handleDealsNameList: dealsActions.handleDealsNameList,
    handleOffersNameList: dealsActions.handleOffersNameList,
    handleDealsMainData: dealsActions.handleDealsMainData,

    // Portfolio
    handlePortNameList: dealsActions.handlePortNameList,
    handlePortfolioData: dealsActions.handlePortfolioData,

    // MVaR
    handleMvarInputData,
    handleAllMVaRData: analyseHandlers.handleAllMVaRData,
    handleMvarDistData: analyseHandlers.handleMvarDistData,
    handleMvarProductData: analyseHandlers.handleMvarProductData,

    // EAD
    handleAllEADData: analyseHandlers.handleAllEADData,

    // CVaR
    initHandleCvarInput: analyseHandlers.initHandleCvarInput,
    handleCvarInputThreshold: analyseHandlers.handleCvarInputThreshold,
    handleAllCVaRData: analyseHandlers.handleAllCVaRData,

    // Losses
    handleAllLossData: analyseHandlers.handleAllLossData,

    // ML
    handleFuturePredictions,
    handleMLTestData,
    handleMLTrainedModels,
    handleMLModels,

    // TS
    createTSModals,
    observePanelTsOpen,

    // PortfolioHistory
    handlePortfolioHistoryData: analyseHandlers.handlePortfolioHistoryData,
  });

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

  
  handleSubmitMatchedColumns: (typeof handleSubmitMatchedColumns === 'function') ? handleSubmitMatchedColumns : null,
  startOfferImport,
  handleSubmitMatching,
  quickImportWithStandardMapping,

  updateTooltipsFn: updateTooltips, // deine bestehende Funktion
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

  installPythonProgressBarsBridge();


  installDealsEnhancerBridge({ appState });

});


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
