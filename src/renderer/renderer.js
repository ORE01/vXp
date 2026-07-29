
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
import { renderCustomerCategoryPanel, initCustomerCategoryCrud } from './features/CUSTOMER_SETUP/customerCategoryPanel.js';
import { initOverviewTilesPanel, initMarketRiskTilesPanel, initCreditRiskTilesPanel, handleCustomerOverviewTileSettingData } from './features/CUSTOMER_SETUP/overviewTilesPanel.js';
import { initPortfolioDurationLimitsPanel, handleCustomerPortfolioDurationLimitData } from './features/CUSTOMER_SETUP/portfolioDurationLimitsPanel.js';
import {
  handleCustomerMarketRiskIntervalOptions,
  initCustomerMarketRiskSave,
} from './features/CUSTOMER_SETUP/customerMarketRiskPanel.js';
import {
  handleCustomerMarketRiskSettingData,
  handleCustomerMarketRiskThresholdSettingData,
} from './features/CUSTOMER_SETUP/customerMarketRiskSettingHandler.js';
import {
  handleCustomerCreditRiskSettingData,
  handleCustomerCreditRiskThresholdSettingData,
} from './features/CUSTOMER_SETUP/customerCreditRiskSettingHandler.js';
import { initCustomerCreditRiskSave } from './features/CUSTOMER_SETUP/customerCreditRiskPanel.js';
import { initDataSourcesPanel } from './features/CUSTOMER_SETUP/dataSourcesPanel.js';
import {
  handleCustomerDefaultPortfolioData,
  initCustomerDefaultPortfolioPanel,
} from './features/CUSTOMER_SETUP/customerDefaultPortfolioPanel.js';
import { handleScenarioDefinitionData } from './features/ANALYSE_PORTFOLIO/marketRisk/mvar/mvarScenarioPanel.js';

import { openPanel } from './core/ui/panels/index.js';
import { showMessageBox, showConfirmationBox } from './core/ui/dialogs/confirm.js';
import { registerFitCanvasPlugin } from './charts/fitCanvasToDisplayPlugin.js';

import { initPortfolioPanelsLazyRender } from './core/routing/initAnalysePortfolioPanels.js';
import { initMarketDataPanelsLazyRender } from './core/routing/initMarketDataPanels.js';
import { initCustomerSetupPanelsLazyRender } from './core/routing/initCustomerSetupPanels.js';
import { initMarketDataChartsAutoRefresh } from './core/routing/initMarketDataRefresh.js';
import { initCreditSpreadCurveChartListener } from './features/MARKET_DATA/CREDIT_SPREADS/renderCreditSpreadCurveChart.js';

import { createTSModals, observePanelTsOpen } from './features/MARKET_DATA/HISTORIC_DATA/TS.js';
import { handleExcelComplete } from './features/UPDATES/updatesExcel.js';

import { buildCubeSurfaceGrid, populateSwaptionCubeSelectors } from './features/MARKET_DATA/VOLS/volCube.js';
import { handlePortAggData, handlePortProdData } from './features/portfolio/index.js';

import { handleIssuerData } from './features/issuer/issuerPanel.js';
import { renderProductTable }   from './features/products/productTableController.js';
import { handleDealsData }  from './features/portfolio/trades/tradeTableRenderer.js';

import { marketRiskHandlers } from './features/ANALYSE_PORTFOLIO/marketRisk/marketRiskHandlers.js';


import { handleCVaRData, handleEADData } from './features/ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { handleFWDData } from './features/MARKET_DATA/forwards/forwardCurvePanel.js';
import { handleProviderData } from './features/DATA_PROVIDER/DATAProvider.js';
import { handleFuturePredictions, handleMLTestData, handleMLTrainedModels, handleMLModels } from './features/MARKET_DATA/FORECASTING/ML.js';

import { handleSummaryMarketRiskData, handleMvarProductTable } from './features/ANALYSE_PORTFOLIO/SummaryMarketRisk.js';
import { renderHomeOverview, initHomeDisclaimer } from './features/HOME/homeOverview.js';
import { startOfferImport, handleSubmitMatching, quickImportWithStandardMapping } from './features/OFFERS/readOffers.js';

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

  // Globales Chart.js-Plugin gegen den Hover-/Klick-Offset (Pilot: nur bei fitDisplay:true).
  registerFitCanvasPlugin();

  appState = bootstrapCreateAppState();

  appState.installHandlers({
    handleIssuerData,
    renderProductTable: renderProductTable,
    handleDealsData,
    ...marketRiskHandlers
  });

  bootstrapStores(appState);

  // Home-Overview global verfuegbar machen (initializeTabs in bootstrapBindings
  // ruft window.renderHomeOverview beim Default-Landing auf; dataRouter re-rendert
  // nach relevanten Table-Updates).
  window.renderHomeOverview = renderHomeOverview;

  // Haftungsausschluss ueber der App, solange die Portfolio-Daten laden.
  initHomeDisclaimer();

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
    handleCustomerProductCategorySetupData: (rows) => {
      // Feed the category-setup store (fixed-value exclusion for sensitivities)
      // in addition to rendering the Customer-Setup category panel.
      try { appState.setCategorySetupData?.(rows); }
      catch (e) { console.warn('[CATEGORY STORE] set failed', e); }
      renderCustomerCategoryPanel(rows);
    },
    handleCustomerOverviewTileSettingData,
    handleCustomerPortfolioDurationLimitData,
    handleCustomerDefaultPortfolioData,
    handleScenarioDefinitionData,
    handleCustomerMarketRiskIntervalOptions,
    handleCustomerMarketRiskSettingData,
    handleCustomerMarketRiskThresholdSettingData,
    handleCustomerCreditRiskSettingData,
    handleCustomerCreditRiskThresholdSettingData,


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

  // Customer Setup -> Category: render the categories table via the app framework
  // and wire the framework Add button (Edit buttons are wired on each render).
  renderCustomerCategoryPanel();
  initCustomerCategoryCrud();

  // Customer Setup -> Portfolio -> Overview Tiles: render checkboxes + wire Save.
  initOverviewTilesPanel();
  initMarketRiskTilesPanel();
  initCreditRiskTilesPanel();
  initPortfolioDurationLimitsPanel();

  // Customer Setup -> Risk -> Market Risk -> Interval: wire the Save button.
  initCustomerMarketRiskSave();

  // Customer Setup -> Risk -> Credit Risk -> General Settings: wire the Save button.
  initCustomerCreditRiskSave();

  // Customer Setup -> Data Sources: wire the Excel-input path pickers.
  initDataSourcesPanel();

});

function bootstrapCreateAppState() {
  return new AppState();
}

function initAllPanelsLazyRender() {
  initPortfolioPanelsLazyRender({ panelRenderState });
  initMarketDataPanelsLazyRender({ panelRenderState });
  initCustomerSetupPanelsLazyRender({ panelRenderState });
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


