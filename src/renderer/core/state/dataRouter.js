'use strict';

/**
 * Central router for DataPump table events.
 * Goal: keep installReceivers thin and avoid duplicated table-specific logic.
 */
export function routeTableData({ appState }, channel, data, handlers = {}) {
  const rows = Array.isArray(data) ? data : [];

  switch (channel) {
    // CUSTOMER
    case 'CustomerData':
      return handlers.handleCustomerData?.(rows);

    case 'CustomerTSSelectionData':
      return handlers.handleCustomerTSData?.(rows);

    // MARKET DATA
    case 'EUSWData':
      return handlers.handleEUSWData?.(rows);

    case 'FWDData':
      return handlers.handleForwardData?.(rows);

    // SWAPTION
    case 'EUSWAPTION_ATMData':
      return handlers.handleSwaptionATMData?.(rows);

    case 'EUSWAPTION_SMILEData':
      return handlers.handleSwaptionSmileData?.(rows);

    // ISSUER
    case 'IssuerData':
      return handlers.handleIssuerDataInit?.(rows);

    case 'CountryLookupData':
      return handlers.handleCountryLookupDataInit?.(rows);

    case 'CSMatrixData':
      return handlers.handleCSMatrixData?.(rows);

    case 'CSParameterData':
      return handlers.handleCSParameterData?.(rows);

    case 'RankData':
      return handlers.handleRankData?.(rows);

    // PRODUCTS
    case 'ProdAllData':
      return handlers.handleProdDataInit?.(rows);

    case 'ProdCouponSchedulesData':
      if (appState?.setCouponData) return appState.setCouponData(data);
      return console.warn('[dataRouter] appState.setCouponData missing');

    // DEALS (DealsMain contains deals + offers; handling is in handleDealsMainData)
    case 'DealsMainData':
      return handlers.handleDealsMainData?.(data);

    // PORTFOLIOS list + portfolio data
    case 'PortfoliosData':
      handlers.handlePortNameList?.(data);
      return handlers.handlePortfolioData?.(data);

    // MVaR
    case 'MVaRInputData':
      return handlers.handleMvarInputData?.(data);

    case 'MarketVaRData':
      return handlers.handleAllMVaRData?.(data);

    case 'MarketVaR_DistData':
      return handlers.handleMvarDistData?.(data);

    case 'MarketVaR_ProductData':
      return handlers.handleMvarProductData?.(data);

    // EAD
    case 'EADData':
      return handlers.handleAllEADData?.(data);

    // CVaR
    case 'CreditVaRInputData':
      return handlers.initHandleCvarInput?.(data);

    case 'CreditVaRInputThresholdData':
      return handlers.handleCvarInputThreshold?.(data);

    case 'CreditVaRData':
      return handlers.handleAllCVaRData?.(data);

    // LOSSES
    case 'sortedLossesIssuerMainData':
      return handlers.handleAllLossData?.(data);

    // ML
    case 'ML_FuturePredictionsData':
      return handlers.handleFuturePredictions?.(data);

    case 'ML_MergedDataData':
      return handlers.handleMLTestData?.(data);

    case 'ML_TrainedModelsData':
      return handlers.handleMLTrainedModels?.(data);

    case 'ML_ModelsData':
      return handlers.handleMLModels?.(data);

    // TS
    case 'tblTSData':
      return handlers.createTSModals?.(data);

    // HISTORY
    case 'PortfolioHistoryMetricsData':
      return handlers.handlePortfolioHistoryData?.(data);

    default:
      // Keep quiet-ish; enable for debugging if needed
      // console.log('[dataRouter] Unmapped channel:', channel);
      return;
  }
}
