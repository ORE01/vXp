export function installReceivers(deps = {}) {
  const {
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
  } = deps;

  if (!api) throw new Error('[installReceivers] api missing');

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
      console.warn(`[IPC] Missing handler for ${channel}`);
    }
  };

  // Panels + auto refresh
  initAllPanelsLazyRender?.({ panelRenderState });
  initMarketDataChartsAutoRefresh?.();

  // CUSTOMER
  safeReceive('CustomerData', handleCustomerData, { required: true });
  safeReceive('CustomerTSSelectionData', handleCustomerTSData);

  // MARKET DATA
  safeReceive('EUSWData', handleEUSWData, { required: true });
  safeReceive('FWDData', handleForwardData);

  // SWAPTION
  safeReceive('EUSWAPTION_ATMData', handleSwaptionATMData);
  safeReceive('EUSWAPTION_SMILEData', handleSwaptionSmileData);
  // optional cube...

  // ISSUER
  safeReceive('IssuerData', handleIssuerDataInit);
  safeReceive('CountryLookupData', handleCountryLookupDataInit);
  safeReceive('CSMatrixData', handleCSMatrixData);
  safeReceive('CSParameterData', handleCSParameterData);
  safeReceive('RankData', handleRankData);

  // PRODUCTS
  safeReceive('ProdAllData', handleProdDataInit);
  api.receive('ProdCouponSchedulesData', (receivedData) => {
    if (appState && typeof appState.setCouponData === 'function') {
      appState.setCouponData(receivedData);
    } else {
      console.error('[IPC] appState.setCouponData missing');
    }
  });

  // DEALS
  // DEALS (includes OFFERS via port_name prefix)
  api.receive('DealsMainData', (data) => {
    const rows = Array.isArray(data) ? data : [];

    // robust: port_name may be missing or not string
    const isOfferRow = (r) => String(r?.port_name ?? '').toUpperCase().startsWith('OFFERS');

    const offers = rows.filter(isOfferRow);
    const deals  = rows.filter(r => !isOfferRow(r));

    // Store it in state for UI consumers (IMPORTANT: match the keys your UI expects)
    if (appState) {
      // pick ONE pattern that matches your existing codebase:
      appState.OFFERS_DATA = offers;
      appState.DEALS_DATA = deals;

      // if you have setters, even better:
      appState.setOffersData?.(offers);
      appState.setDealsData?.(deals);
    }

    // Keep your existing handlers working (no behavior loss)
    handleDealsNameList?.(deals);       // deals-only
    handleOffersNameList?.(offers);     // offers-only
    handleDealsMainData?.(rows);        // full raw if you still need it somewhere
  });


  // OFFERS
  //api.receive('LGTData', (data) => appState?.setOfferData?.(data));

  // PORTFOLIO
  api.receive('PortfoliosData', (data) => {
    handlePortNameList?.(data);
    handlePortfolioData?.(data);
  });

  // MVaR
  safeReceive('MVaRInputData', handleMvarInputData);
  safeReceive('MarketVaRData', handleAllMVaRData);
  api.receive('MarketVaR_DistData', (data) => handleMvarDistData?.(data));
  api.receive('MarketVaR_ProductData', (data) => handleMvarProductData?.(data));

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
  safeReceive('ML_TrainedModelsData', handleMLTrainedModels);
  safeReceive('ML_ModelsData', handleMLModels);

  // TS
  api.receive('tblTSData', (data) => createTSModals?.(data));
  observePanelTsOpen?.();

  // HISTORY
  api.receive('PortfolioHistoryMetricsData', (data) => handlePortfolioHistoryData?.(data));
}

