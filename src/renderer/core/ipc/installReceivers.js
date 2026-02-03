'use strict';

import { routeTableData } from '../state/dataRouter.js';

export function installReceivers(deps = {}) {
  const {
    api,
    appState,
    panelRenderState,
    initAllPanelsLazyRender,
    initMarketDataChartsAutoRefresh,

    // handlers
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData, // (optional)

    handleCustomerData,
    handleCustomerTSData,
    handleEUSWData,
    handleForwardData,

    handleIssuerDataInit,
    handleCountryLookupDataInit,
    handleCSMatrixData,
    handleCSParameterData,
    handleRankData,

    handleProdDataInit,

    handleDealsMainData,
    handlePortNameList,
    handlePortfolioData,

    handleMvarInputData,
    handleAllMVaRData,
    handleMvarDistData,
    handleMvarProductData,

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

  if (!api) throw new Error('[installReceivers] api missing');

  // hard "bind once"
  if (window.__listenersBoundOnce) {
    console.warn('installReceivers() already bound – skipping');
    return;
  }
  window.__listenersBoundOnce = true;

  const safeReceive = (channel, fn, { required = false } = {}) => {
    if (typeof fn === 'function') {
      api.receive(channel, fn);
    } else if (required) {
      console.warn(`[IPC] Missing REQUIRED handler for ${channel}`);
    } else {
      // keep noise low
      // console.warn(`[IPC] Missing handler for ${channel}`);
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
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    handleCustomerData,
    handleCustomerTSData,
    handleEUSWData,
    handleForwardData,

    handleIssuerDataInit,
    handleCountryLookupDataInit,
    handleCSMatrixData,
    handleCSParameterData,
    handleRankData,

    handleProdDataInit,

    handleDealsMainData,
    handlePortNameList,
    handlePortfolioData,

    handleMvarInputData,
    handleAllMVaRData,
    handleMvarDistData,
    handleMvarProductData,

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

  // MARKET DATA
  route('EUSWData', { required: true });
  route('FWDData');

  // SWAPTION
  route('EUSWAPTION_ATMData');
  route('EUSWAPTION_SMILEData');
  // optional cube:
  route('EUSWAPTION_CUBEData'); // falls du so einen channel hast – sonst entfernen

  // ISSUER
  route('IssuerData');
  route('CountryLookupData');
  route('CSMatrixData');
  route('CSParameterData');
  route('RankData');

  // PRODUCTS
  route('ProdAllData');
  route('ProdCouponSchedulesData');

  // DEALS
  // ✅ Do not directly call renderDealsPanel here.
  // Rendering is triggered via panel-open hook and/or inside handleDealsMainData/dealsUI.
  route('DealsMainData', { required: true });

  // PORTFOLIO
  route('PortfoliosData');

  // MVaR
  route('MVaRInputData');
  route('MarketVaRData');
  route('MarketVaR_DistData');
  route('MarketVaR_ProductData');

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


