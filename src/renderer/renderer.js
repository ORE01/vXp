console.log("[BOOT] renderer.js loaded");

import { bootstrapTriggers } from './bootstrap/bootstrapTriggers.js';
import { bootstrapStores } from './bootstrap/bootstrapStores.js';
import { bootstrapUIBasics } from './bootstrap/bootstrapUIBasics.js';
import { bootstrapHandlers } from './bootstrap/bootstrapHandlers.js';
import { bootstrapBridges } from './bootstrap/bootstrapBridges.js';
import { bootstrapPython } from './bootstrap/bootstrapPython.js';
import { bootstrapIPC } from './bootstrap/bootstrapIPC.js';
import { bootstrapBindings } from './bootstrap/bootstrapBindings.js';


import { openPanel} from './UI/panels.js';

import { showMessageBox, showConfirmationBox } from './UI/modals/confirm.js';


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

import { handleCVaRData, handleEADData} from './ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js'; 
import { handleFWDData } from './MARKET_DATA/FORWARDS/forwards.js';
import { handleProviderData } from './DATA_PROVIDER/DATAProvider.js'; 
import { handleFuturePredictions, handleMLTestData, handleMLTrainedModels, handleMLModels} from './MARKET_DATA/FORCASTING/ML.js'; 


import { handleSummaryMarketRiskData, handleMvarProductTable} from './ANALYSE_PORTFOLIO/SummaryMarketRisk.js';
import { startOfferImport, handleSubmitMatching, quickImportWithStandardMapping } from './NEW_PRODUCTS/offers.js';

//REPORT:
import { setupCustomerReportsPresetUI} from './REPORTS/CustomerReportsPresetUI.js';
import { handleHistoricMetricsAddClick} from './ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/saveHistoricRiskMetrics.js';

import { tooltips } from '../utils/ToolTip.js';
import { AppState } from './STATE/AppState.js';

import { handleModalAction } from './UI/MODAL_HELPER/ModalActionHandler.js';

// =========================
// Renderer Bootstrap Sections
// =========================



let appState;


const panelRenderState = Object.create(null);



document.addEventListener('DOMContentLoaded', () => {

// ✅ STABILITÄTSMODUS: App darf nicht hidden bleiben
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.classList.remove('app-hidden');
    appRoot.style.display = 'block';
  }

  appState = bootstrapCreateAppState();

  bootstrapStores(appState);

  bootstrapUIBasics(appState);
  bootstrapTriggers(appState);







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

  handleMvarInputData,
} = bootstrapHandlers(appState, {
  api: window.api,
  showMessageBox,
  showConfirmationBox,
  handleModalAction,
});




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

    handleMvarInputData,

    ...issuerProdHandlers,
    ...customerHandlers,
    ...ratesHandlers,
    ...forwardsHandlers,
    ...dealsActions,
    ...analyseHandlers,

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
