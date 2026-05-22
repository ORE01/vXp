
// DEBUG HELPER:

// import { installRafDebug } from './core/debug/rafDebug.js';
// import { installChartTrace } from './core/debug/chartTrace.js';

// installRafDebug();
// installChartTrace();




import { bootstrapTriggers } from './core/bootstrap/bootstrapTriggers.js';
import { bootstrapStores } from './core/bootstrap/bootstrapStores.js';
import { bootstrapUIBasics } from './core/bootstrap/bootstrapUIBasics.js';
import { bootstrapHandlers } from './core/bootstrap/bootstrapHandlers.js';
import { bootstrapBridges } from './core/bootstrap/bootstrapBridges.js';
import { bootstrapPython } from './core/bootstrap/bootstrapPython.js';
import { bootstrapIPC } from './core/bootstrap/bootstrapIPC.js';
import { bootstrapBindings } from './core/bootstrap/bootstrapBindings.js';
import { handleCustomerTableLayoutsData } from './features/CUSTOMER/tableLayouts/handleCustomerTableLayoutsData.js';

import { openPanel } from './core/ui/panels/index.js';
import { showMessageBox, showConfirmationBox } from './core/ui/dialogs/confirm.js';

import { initPortfolioPanelsLazyRender } from './core/routing/initAnalysePortfolioPanels.js';
import { initMarketDataPanelsLazyRender } from './core/routing/initMarketDataPanels.js';
import { initMarketDataChartsAutoRefresh } from './core/routing/initMarketDataRefresh.js';
import { initCreditSpreadCurveChartListener } from './features/MARKET_DATA/CREDIT_SPREADS/renderCreditSpreadCurveChart.js';

import { createTSModals, observePanelTsOpen } from './features/MARKET_DATA/HISTORIC_DATA/TS.js';
import { handleExcelComplete } from './features/UPDATES/updatesExcel.js';

import { buildCubeSurfaceGrid, populateSwaptionCubeSelectors } from './features/MARKET_DATA/VOLS/volCube.js';
import { handlePortAggData, handlePortProdData } from './features/SELECT_PORTFOLIO/PORT.js';

import { handleIssuerData } from './features/products/ISSUER.js';
import { renderProductTable }   from './features/products/productTableController.js';
import { handleDealsData }  from './features/CREATE_PORTFOLIO/DEALS.js';

import { marketRiskHandlers } from './features/ANALYSE_PORTFOLIO/MARKET_RISK/marketRiskHandlers.js';


import { handleCVaRData, handleEADData } from './features/ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { handleFWDData } from './features/MARKET_DATA/FORWARDS/forwards.js';
import { handleProviderData } from './features/DATA_PROVIDER/DATAProvider.js';
import { handleFuturePredictions, handleMLTestData, handleMLTrainedModels, handleMLModels } from './features/MARKET_DATA/FORECASTING/ML.js';

import { handleSummaryMarketRiskData, handleMvarProductTable } from './features/ANALYSE_PORTFOLIO/SummaryMarketRisk.js';
import { startOfferImport, handleSubmitMatching, quickImportWithStandardMapping } from './features/products/readOffers.js';

import { setupCustomerReportsPresetUI } from './features/REPORTS/CustomerReportsPresetUI.js';
import { handleHistoricMetricsAddClick } from './features/ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/saveHistoricRiskMetrics.js';

import { tooltips } from './utils/ToolTip.js';
import { AppState } from './core/state/AppState.js';

import { handleModalAction } from './core/ui/modal/modalActions.js';

const APP_ROOT = document.getElementById('app-root');
const REPORT_ROOT = document.getElementById('report-root');

if (!APP_ROOT) throw new Error('[renderer] #app-root missing');

const MINIMAL_UI = document.body?.dataset?.minimalUi === '1';
console.log('[BOOT] MINIMAL_UI =', MINIMAL_UI);



// =========================
// Renderer Bootstrap Sections
// =========================



let appState;


const panelRenderState = Object.create(null);

// ---------------------------------------------------------
// Panel-open hook registry (DI for installReceivers)
// ---------------------------------------------------------
const panelOpenHooks = Object.create(null);


function registerPanelOpenHook(panelId, fn) {
  if (typeof fn !== 'function') return;
  const id = String(panelId || '');
  if (!id) return;

  (panelOpenHooks[id] ||= []).push(fn);
}


function emitPanelOpen(panelId) {
  const id = String(panelId || '');
  const hooks = panelOpenHooks[id] || [];
  for (const fn of hooks) {
    try { fn(); } catch (e) { console.warn('[panelOpenHook] error', e); }
  }
}




document.addEventListener('DOMContentLoaded', () => {

// âœ… STABILITÃ„TSMODUS: App darf nicht hidden bleiben
  const appRoot = document.getElementById('app-root');
  if (appRoot) {
    appRoot.classList.remove('app-hidden');
    appRoot.style.display = 'block';
  }

  appState = bootstrapCreateAppState();

  appState.installHandlers({
    handleIssuerData,
    renderProductTable: renderProductTable,
    handleDealsData,
    ...marketRiskHandlers
  });

  bootstrapStores(appState);

  bootstrapUIBasics(appState);
  bootstrapTriggers(appState, { emitPanelOpen });
  initCreditSpreadCurveChartListener();


    if (MINIMAL_UI) {
    console.log('[BOOT] Minimal UI: skipping heavy renderer bootstraps');
    return;
  }








const {
  issuerProdHandlers,
  customerHandlers,
  dealsActions,
  ratesHandlers,
  forwardsHandlers,
  analyseHandlers,

  handleCSParameterData,
  handleCS_ACTIVEData,
  handleCSBaseData,
  handleCSScenarioData,

  handleSwaptionAtmBaseData,
  handleSwaptionSmileBaseData,
  handleSwaptionAtmScenarioData,
  handleSwaptionSmileScenarioData,
  handleSwaptionActiveData,
  //handleSwaptionCubeData,

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
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,

    handleSwaptionAtmBaseData,
    handleSwaptionSmileBaseData,
    handleSwaptionAtmScenarioData,
    handleSwaptionSmileScenarioData,
    handleSwaptionActiveData,
    //handleSwaptionCubeData,

    onExcelComplete: handleExcelComplete,
  });




  bootstrapIPC({
    api: window.api,
    appState,
    panelRenderState,
    initAllPanelsLazyRender,
    initMarketDataChartsAutoRefresh,

    registerPanelOpenHook: appState.registerPanelOpenHook.bind(appState),

    handleSwaptionAtmBaseData,
    handleSwaptionSmileBaseData,
    handleSwaptionAtmScenarioData,
    handleSwaptionSmileScenarioData,
    handleSwaptionActiveData,
    //handleSwaptionCubeData,

    handleCSParameterData,
    handleCS_ACTIVEData,
    handleCSBaseData,
    handleCSScenarioData,
    handleCustomerTableLayoutsData,


    ...issuerProdHandlers,
    ...customerHandlers,
    ...ratesHandlers,
    ...forwardsHandlers,
    ...dealsActions,
    ...analyseHandlers,
    ...marketRiskHandlers,

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
    ...marketRiskHandlers,
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


