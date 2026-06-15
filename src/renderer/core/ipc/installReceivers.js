'use strict';

import { routeTableData } from '../data/dataRouter.js';


export function installReceivers(deps = {}) {
  const {
    api,
    appState,
    panelRenderState,
    initAllPanelsLazyRender,
    initMarketDataChartsAutoRefresh,

    // handlers
    handleSwaptionAtmBaseData,
    handleSwaptionSmileBaseData,
    handleSwaptionAtmScenarioData,
    handleSwaptionSmileScenarioData,
    handleSwaptionActiveData,
    //handleSwaptionCubeData,

    handleCustomerData,
    handleCustomerTSData,
    handleCustomerTableLayoutsData,
    handleRATESData,
    handleRatesScenarioData,
    handleRatesActiveData,
    handleForwardData,

    handleIssuerDataInit,
    handleIssuerRankRatingData,
    handleCountryLookupDataInit,

    handleCS_ACTIVEData,
    handleCSBaseData,
    handleCSParameterData,
    handleCSScenarioData,

    handleRankData,

    renderProductTableInit,

    handleDealsMainData,
    handlePortNameList,
    handlePortfolioData,
    handlePortfolioRiskSensitivitiesData,
    handleIRSensData,
    handleCSSensData,
    handleVegaSensData,

    handleMvarInputData,
    handleAllMVaRData,
    handleMvarDistData,
    handleMvarProductData,
    handleMarketVarFactorSeriesMapData,
    handleMVaRFactorPLData,
    handleMVaRProductPLData,
    handleAllEADData,

    initHandleCvarInput,
    handleCvarInputThreshold,
    handleAllCVaRData,

    handleAllLossData,

    handleFuturePredictions,
    handleMLTestData,
    handleMLTrainedModels,
    handleMLModels,

    createTSModals,
    observePanelTsOpen,

    handlePortfolioHistoryData,

    // panel hooks / deals UI
    registerPanelOpenHook,
    bindDealsUIOnce,
    renderDealsPanel,
  } = deps;

  console.log('[BOOT RECEIVERS] installReceivers called');
  console.log('[BOOT RECEIVERS] handleSwaptionAtmScenarioData:', typeof handleSwaptionAtmScenarioData);
  console.log('[BOOT RECEIVERS] handleSwaptionSmileScenarioData:', typeof handleSwaptionSmileScenarioData);
  console.log('[BOOT RECEIVERS] handleSwaptionActiveData:', typeof handleSwaptionActiveData);
  console.log(
    '[BOOT RECEIVERS] handleCustomerTableLayoutsData:',
    typeof handleCustomerTableLayoutsData
  );

  console.log(
  '[BOOT RECEIVERS] handlePortfolioRiskSensitivitiesData:',
  typeof handlePortfolioRiskSensitivitiesData
);

  if (!api) throw new Error('[installReceivers] api missing');

  // hard "bind once"
  if (window.__listenersBoundOnce) {
    console.warn('installReceivers() already bound – skipping');
    return;
  }
  window.__listenersBoundOnce = true;


  const safeReceive = (channel, fn, { required = false } = {}) => {

  if (typeof fn !== 'function') {
    if (required) {
      throw new Error(`[IPC] REQUIRED handler missing: ${channel}`);
    }
    return;
  }

  let receivedOnce = false;

// api.receive(channel, (data) => {

//   // console.log("CHANNEL:", channel);
//   // console.log("RAW DATA:", data);
//   // console.log("IS ARRAY:", Array.isArray(data));
//   // console.log("DATA.ROWS:", data?.rows);

//   receivedOnce = true;

//   const normalized =
//     Array.isArray(data) ? data :
//     Array.isArray(data?.rows) ? data.rows :
//     [];

//   // console.log("NORMALIZED:", normalized);

//   fn(normalized);

// });

api.receive(channel, (data) => {

  if (channel === 'CustomerTableLayoutsData') {
    console.log(
      '[RECEIVER] CustomerTableLayoutsData received raw:',
      data
    );
  }

  receivedOnce = true;

  const normalized =
    Array.isArray(data) ? data :
    Array.isArray(data?.rows) ? data.rows :
    [];

  fn(normalized);

});




  // ✅ watchdog only for REQUIRED channels
  if (required) {
    setTimeout(() => {
      if (!receivedOnce) {
        console.warn(
          `[IPC WATCHDOG] ${channel} not received yet`
        );
      }
    }, 8000);
  }
};

  // Panels + auto refresh
  initAllPanelsLazyRender?.({ panelRenderState });
  initMarketDataChartsAutoRefresh?.();

  // Panel-open hooks: render feature UIs only on user intent
  if (typeof registerPanelOpenHook === 'function') {
    registerPanelOpenHook('panel-deals', () => {
      try { bindDealsUIOnce?.(appState); } catch (e) { console.warn('[DEALS hook] bind failed', e); }
      try { renderDealsPanel?.(appState); } catch (e) { console.warn('[DEALS hook] render failed', e); }
    });
  } else {
    console.warn('[installReceivers] registerPanelOpenHook missing');
  }

  // --- Central table-data routing (DataPump channels) ---
  // Important: do NOT render UI here except via handlers; keep it predictable.
  const handlers = {

    handleSwaptionAtmBaseData,
    handleSwaptionSmileBaseData,
    handleSwaptionAtmScenarioData,
    handleSwaptionSmileScenarioData,
    handleSwaptionActiveData,
    //handleSwaptionCubeData,

    handleCustomerData,
    handleCustomerTSData,
    handleCustomerTableLayoutsData,
    handleRATESData,
    handleRatesScenarioData,
    handleRatesActiveData,
    handleForwardData,

    handleIssuerDataInit,
    handleIssuerRankRatingData,
    handleCountryLookupDataInit,

    handleCS_ACTIVEData,
    handleCSBaseData,
    handleCSParameterData,
    handleCSScenarioData,
    handleRankData,

    renderProductTableInit,

    handleDealsMainData,
    handlePortNameList,
    handlePortfolioData,
    handlePortfolioRiskSensitivitiesData,
    handleIRSensData,
    handleCSSensData,
    handleVegaSensData,

    handleMvarInputData,
    handleAllMVaRData,
    handleMvarDistData,
    handleMvarProductData,
    handleMarketVarFactorSeriesMapData,
    handleMVaRFactorPLData,
    handleMVaRProductPLData,

    handleAllEADData,

    initHandleCvarInput,
    handleCvarInputThreshold,
    handleAllCVaRData,

    handleAllLossData,

    handleFuturePredictions,
    handleMLTestData,
    handleMLTrainedModels,
    handleMLModels,

    createTSModals,
    handlePortfolioHistoryData,
  };

  // console.log("IRSens handler:", handlers.handleIRSensData);
  // console.log("IRSens handler type:", typeof handlers.handleIRSensData);
  

  // Single helper: one line per channel, all go through router
  const route = (channel, { required = false } = {}) =>
    safeReceive(
      channel,
      (data) => routeTableData({ appState }, channel, data, handlers),
      { required }
    );

  // CUSTOMER
  route('CustomerData', { required: true });
  route('CustomerTSSelectionData');
  route('CustomerTableLayoutsData');

  // MARKET DATA
  route('RATES_ACTIVEData');
  route('RATES_BASEData', { required: true });
  route('RATES_SCENARIO_DATAData');
    
  route('FWDData');

  // CS
  route('CS_BASEData');
  route('CS_SCENARIO_DATAData');
  route('CS_ACTIVEData');
  
  route('CSParameterData');

  route('RankData');

  // SWAPTION
  route('SWAPTION_ACTIVEData');
  route('SWAPTION_ATM_BASEData');
  route('SWAPTION_SMILE_BASEData');
  route('SWAPTION_ATM_SCENARIO_DATAData');
  route('SWAPTION_SMILE_SCENARIO_DATAData');
  
  //route('SWAPTION_CUBEData');

  // ISSUER
  route('IssuerData');
  route('IssuerRankRatingData');
  route('CountryLookupData');

  // PRODUCTS
  route('v_PRODUCTS_CANONICALData');
  route('v_PRODUCTS_APPData');
  route('PRODUCT_STRUCTUREData');
 

  // DEALS
  // ✅ Do not directly call renderDealsPanel here.
  // Rendering is triggered via panel-open hook and/or inside handleDealsMainData/dealsUI.
  route('DealsMainData', { required: true });

  // PORTFOLIO
  route('PortfoliosData');
  route('PortfolioRiskSensitivitiesData');

  // MVaR
  route('MVaRInputData');
  route('MarketVaRData');
  route('MarketVaR_DistData');
  route('MarketVaR_ProductData');
  route('MarketVaR_FactorSeriesMapData');
  route('MarketVaR_FactorPLData');
  route('MarketVaR_ProductPLData');

  // EAD
  route('EADData');

  // CVaR
  route('CreditVaRInputData');
  route('CreditVaRInputThresholdData');
  route('CreditVaRData');

  // LOSSES
  route('sortedLossesIssuerMainData');

  // ML
  route('ML_FuturePredictionsData');
  route('ML_MergedDataData');
  route('ML_TrainedModelsData');
  route('ML_ModelsData');

  // TS
  route('tblTSData');
  observePanelTsOpen?.();

  // HISTORY
  route('PortfolioHistoryMetricsData');
}


