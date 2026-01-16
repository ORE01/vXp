

export function installReceivers({
  api,
  appState,
  panelRenderState,
  initAllPanelsLazyRender,
  initMarketDataChartsAutoRefresh,

  
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

  handleDealsNameList,
  handleOffersNameList,
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
} = {}) {
  if (!api) throw new Error('[installReceivers] api missing');

  if (window.__listenersBoundOnce) {
    console.warn('installReceivers() already bound – skipping');
    return;
  }
  window.__listenersBoundOnce = true;

  // Panels + auto refresh
  initAllPanelsLazyRender?.({ panelRenderState });
  initMarketDataChartsAutoRefresh?.();

  // CUSTOMER
  api.receive('CustomerData', handleCustomerData);
  api.receive('CustomerTSSelectionData', handleCustomerTSData);

  // MARKET DATA (Rates)
  api.receive('EUSWData', handleEUSWData);
  
  if (typeof handleForwardData === 'function') {
  api.receive('FWDData', handleForwardData);
} else {
  console.warn('[IPC] Missing handleForwardData');
}


  // SWAPTION
  if (typeof handleSwaptionATMData === 'function') {
    api.receive('EUSWAPTION_ATMData', handleSwaptionATMData);
  } else {
    console.warn('[IPC] Missing handleSwaptionATMData');
  }

  if (typeof handleSwaptionSmileData === 'function') {
    api.receive('EUSWAPTION_SMILEData', handleSwaptionSmileData);
  } else {
    console.warn('[IPC] Missing handleSwaptionSmileData');
  }

  // optional: Cube channel (nur wenn du einen Channel hast)
  // if (typeof handleSwaptionCubeSurfaceData === 'function') {
  //   api.receive('EUSWAPTION_CUBEData', handleSwaptionCubeSurfaceData);
  // }

  // ISSUER
  api.receive('IssuerData', handleIssuerDataInit);
  api.receive('CountryLookupData', handleCountryLookupDataInit);
  api.receive('CSMatrixData', handleCSMatrixData);
  api.receive('CSParameterData', handleCSParameterData);
  api.receive('RankData', handleRankData);

  // PRODUCTS
  api.receive('ProdAllData', handleProdDataInit);
  api.receive('ProdCouponSchedulesData', (receivedData) => {
    if (appState && typeof appState.setCouponData === 'function') {
      appState.setCouponData(receivedData);
    } else {
      console.error('appState or setCouponData is not defined!');
    }
  });

  // DEALS
  api.receive('DealsMainData', (data) => {
    handleDealsNameList?.(data);
    handleOffersNameList?.(data);
    handleDealsMainData?.(data);
  });

  // OFFERS / LGT
  api.receive('LGTData', (data) => {
    appState?.setOfferData?.(data);
  });

  // PORTFOLIO
  api.receive('PortfoliosData', (data) => {
    console.log('PortfoliosData', data);
    handlePortNameList?.(data);
    handlePortfolioData?.(data);
  });

  // MVaR
  api.receive('MVaRInputData', handleMvarInputData);
  api.receive('MarketVaRData', handleAllMVaRData);
  api.receive('MarketVaR_DistData', (data) => handleMvarDistData?.(data));
  
  api.receive('MarketVaR_ProductData', (data) => {
  console.log('[RECV] MarketVaR_ProductData len=', Array.isArray(data) ? data.length : 'non-array', data?.[0]);
  handleMvarProductData?.(data);
});

  // EAD
  api.receive('EADData', (data) => handleAllEADData?.(data));

  // CVaR
  api.receive('CreditVaRInputData', (data) => initHandleCvarInput?.(data));
  api.receive('CreditVaRInputThresholdData', (data) => handleCvarInputThreshold?.(data));
  api.receive('CreditVaRData', (data) => handleAllCVaRData?.(data));

  // LOSSES
  api.receive('sortedLossesIssuerMainData', (data) => handleAllLossData?.(data));

  // ML
  api.receive('ML_FuturePredictionsData', (data) => handleFuturePredictions?.(data));
  api.receive('ML_MergedDataData', (data) => handleMLTestData?.(data));
  api.receive('ML_TrainedModelsData', handleMLTrainedModels);
  api.receive('ML_ModelsData', handleMLModels);

  // TS cloned + panel observer
  api.receive('tblTSData', (data) => { createTSModals?.(data); });
  observePanelTsOpen?.();

  // PortfolioHistoryMetrics
  api.receive('PortfolioHistoryMetricsData', (data) => {
    handlePortfolioHistoryData?.(data);
  });
}
