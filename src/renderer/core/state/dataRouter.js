'use strict';

/**
 * Central router for DataPump table events.
 * Goal: keep installReceivers thin and avoid duplicated table-specific logic.
 */
export function routeTableData({ appState }, channel, data, handlers = {}) {

  //console.log("ROUTER CHANNEL:", channel);

  const rows = Array.isArray(data) ? data : [];

  switch (channel) {
    // CUSTOMER
    case 'CustomerData':
      return handlers.handleCustomerData?.(rows);

    case 'CustomerTSSelectionData':
      return handlers.handleCustomerTSData?.(rows);

    // MARKET DATA
    case 'RATES_BASEData':
      return handlers.handleRATES_BASEData?.(rows);

    case 'RATES_SCENARIO_DATAData':
      return handlers.handleRatesScenarioData?.(rows);  

    case 'RATES_ACTIVEData':
      return handlers.handleRatesActiveData?.(rows);  

    case 'FWDData':
      return handlers.handleForwardData?.(rows);

    // SWAPTION
    case 'SWAPTION_ATM_BASEData':
      return handlers.handleSwaptionAtmBaseData?.(rows);

    case 'SWAPTION_SMILE_BASEData':
      return handlers.handleSwaptionSmileBaseData?.(rows);

    case 'SWAPTION_ATM_SCENARIO_DATAData':
      return handlers.handleSwaptionAtmScenarioData?.(rows);

    case 'SWAPTION_SMILE_SCENARIO_DATAData':
      return handlers.handleSwaptionSmileScenarioData?.(rows);

    case 'SWAPTION_ACTIVEData':
      return handlers.handleSwaptionActiveData?.(rows);

    // case 'SWAPTION_CUBEData':
    //   return handlers.handleSwaptionCubeData?.(rows);

    // ISSUER
    case 'IssuerData':
      if (typeof handlers.handleIssuerDataInit !== 'function') {
        throw new Error('[dataRouter] Missing handler: handleIssuerDataInit for IssuerData');
      }

      return handlers.handleIssuerDataInit(rows);

    case 'IssuerRankRatingData':
      if (typeof handlers.handleIssuerRankRatingData !== 'function') {
        throw new Error('[dataRouter] Missing handler: handleIssuerRankRatingData for IssuerRankRatingData');
      }

      return handlers.handleIssuerRankRatingData(rows);

    // COUNTRY

    case 'CountryLookupData':
      return handlers.handleCountryLookupDataInit?.(rows);

    // CREDIT SPREAD  

    case 'CS_ACTIVEData':
      return handlers.handleCS_ACTIVEData?.(rows);

    case 'CS_BASEData':
      return handlers.handleCSBaseData?.(rows);

    case 'CS_SCENARIO_DATAData':
      return handlers.handleCSScenarioData?.(rows);

    case 'CSParameterData':
      return handlers.handleCSParameterData?.(rows);

    case 'RankData':
      return handlers.handleRankData?.(rows);

    // PRODUCTS
    case 'v_PRODUCTS_CANONICALData':
    case 'v_PRODUCTS_APPData':
      window.__canonicalProductsLoaded = true;
      return handlers.renderProductTableInit(rows);

    case 'PRODUCT_STRUCTUREData':
      if (appState) {
        appState.productStructureData = rows;

        if (typeof appState.getProductStructureData !== 'function') {
          appState.getProductStructureData = function () {
            return this.productStructureData || [];
          };
        }

        console.log('[dataRouter] PRODUCT_STRUCTURE loaded', rows.length);
        return;
      }

      return console.warn('[dataRouter] appState missing for PRODUCT_STRUCTURE');

    // DEALS
    // Frontend event stays DealsMainData.
    // DataPump may read from v_PORTFOLIO_TRADES_ENRICHED internally.
    case 'DealsMainData':
      if (typeof handlers.handleDealsMainData !== 'function') {
        throw new Error('[dataRouter] Missing handler: handleDealsMainData for DealsMainData');
      }

      return handlers.handleDealsMainData(rows);

    // PortfoliosData ist die v_Portfolios_enriched!!!!!
    case 'PortfoliosData':
      handlers.handlePortNameList?.(data);
      handlers.handlePortfolioData?.(data);
      handlers.handleIRSensData?.(data);
      return;

    // PORTFOLIO IR SENS
    // case 'PortfolioRiskSensitivitiesData':
    //   return handlers.handleIRSensData?.(rows);

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
