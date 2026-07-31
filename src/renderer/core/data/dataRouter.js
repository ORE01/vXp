'use strict';

/**
 * Central router for DataPump table events.
 * Goal: keep installReceivers thin and avoid duplicated table-specific logic.
 */

// Home-Overview nach diesen Tabellen neu rendern (Portfolio/Marktrisiko/Kreditrisiko
// + Default-Portfolio). Deferred, damit der Store-Update davor durch ist.
const HOME_RELEVANT_CHANNELS = new Set([
  'PortfoliosData',
  'PortfolioRiskSensitivitiesData',
  'MarketVaRData',
  'CreditVaRData',
  'CustomerDefaultPortfolioData',
]);
let _homeRenderTimer = null;
function scheduleHomeOverviewRender() {
  if (_homeRenderTimer) return;
  _homeRenderTimer = setTimeout(() => {
    _homeRenderTimer = null;
    try { window.renderHomeOverview?.(); } catch (_) {}
  }, 80);
}

export function routeTableData({ appState }, channel, data, handlers = {}) {

  //console.log("ROUTER CHANNEL:", channel);

  const rows = Array.isArray(data) ? data : [];

  if (HOME_RELEVANT_CHANNELS.has(channel)) scheduleHomeOverviewRender();

  switch (channel) {
    // CUSTOMER
    case 'CustomerData':
      return handlers.handleCustomerData?.(rows);

    case 'CustomerTSSelectionData':
      return handlers.handleCustomerTSData?.(rows);

    case 'CustomerTableLayoutsData':
      return handlers.handleCustomerTableLayoutsData?.(rows);

    case 'CUSTOMER_PRODUCT_CATEGORY_SETUPData':
      return handlers.handleCustomerProductCategorySetupData?.(rows);

    case 'CustomerDefaultPortfolioData':
      return handlers.handleCustomerDefaultPortfolioData?.(rows);

    case 'ScenarioDefinitionData':
      return handlers.handleScenarioDefinitionData?.(rows);

    case 'CustomerMarketRiskSettingData':
      return handlers.handleCustomerMarketRiskSettingData?.(rows);

    case 'CustomerOverviewTileSettingData':
      return handlers.handleCustomerOverviewTileSettingData?.(rows);

    case 'CustomerPortfolioDurationLimitData':
      return handlers.handleCustomerPortfolioDurationLimitData?.(rows);

    case 'CustomerMarketRiskThresholdSettingData':
      return handlers.handleCustomerMarketRiskThresholdSettingData?.(rows);

    case 'CustomerCreditRiskSettingData':
      return handlers.handleCustomerCreditRiskSettingData?.(rows);

    case 'CustomerCreditRiskThresholdSettingData':
      return handlers.handleCustomerCreditRiskThresholdSettingData?.(rows);

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

    // PD HISTORICAL (Track A) — direkt in den Store + Ready-Event für den Builder.
    case 'PD_RATING_HISTORICALData':
      appState?.setPDHistBaseData?.(rows);
      document.dispatchEvent(new Event('pdhist:base:ready'));
      return;

    case 'PD_HIST_SCENARIO_DATAData':
      appState?.setPDHistScenarioData?.(rows);
      document.dispatchEvent(new Event('pdhist:scenario:ready'));
      return;

    case 'PD_HIST_ACTIVEData':
      appState?.setPDHistActive?.(rows);
      document.dispatchEvent(new Event('pdhist:active:ready'));
      return;

    case 'PD_NORM_SETTINGSData':
      appState?.setPdNormSettings?.(rows);
      document.dispatchEvent(new Event('pdnorm:ready'));
      return;

    case 'CSParameterData':
      return handlers.handleCSParameterData?.(rows);

    case 'RankData':
      return handlers.handleRankData?.(rows);

    // PRODUCTS
    case 'v_PRODUCTS_CANONICALData':
      window.__canonicalProductsLoaded = true;
      console.log('[dataRouter] v_PRODUCTS_CANONICAL loaded', rows.length);
      return;

    case 'v_PRODUCTS_APPData':
      window.__productsAppLoaded = true;
      console.log('[dataRouter] v_PRODUCTS_APP loaded', rows.length);
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
      handlers.handlePortNameList?.(rows);
      handlers.handlePortfolioData?.(rows);
      return;

    case 'PortfolioRiskSensitivitiesData': {
      const rows = Array.isArray(data) ? data : [];

      console.log('[DATA ROUTER] PortfolioRiskSensitivitiesData received', {
        rows: rows.length,
        hasHandler: typeof handlers.handlePortfolioRiskSensitivitiesData === 'function',
        sample: rows[0],
        ports: [...new Set(rows.map(r => r.PORT_NAME ?? r.port_name))],
        riskTypes: [...new Set(rows.map(r => r.RISK_TYPE ?? r.risk_type))],
      });

      if (typeof handlers.handlePortfolioRiskSensitivitiesData === 'function') {
        handlers.handlePortfolioRiskSensitivitiesData(rows);
      } else {
        console.warn('[DATA ROUTER] handlePortfolioRiskSensitivitiesData missing');
      }

      return;
    }

    case 'ProductRiskSensitivitiesData': {
      const rows = Array.isArray(data) ? data : [];

      if (typeof handlers.handleProductRiskSensitivitiesData === 'function') {
        handlers.handleProductRiskSensitivitiesData(rows);
      } else {
        console.warn('[DATA ROUTER] handleProductRiskSensitivitiesData missing');
      }

      return;
    }


    // MVaR

    case 'MarketVaR_FactorSeriesMapData':
      console.log('[dataRouter] MarketVaR_FactorSeriesMapData received', {
        rows: rows.length,
        hasStore: typeof appState?.setMarketVarFactorSeriesMap === 'function',
        hasHandler: typeof handlers.handleMarketVarFactorSeriesMapData === 'function',
        sample: rows[0],
      });

      appState?.setMarketVarFactorSeriesMap?.(rows);
      return handlers.handleMarketVarFactorSeriesMapData?.(rows, appState);


    case 'MVaRInputData':
      // Feed the Customer Setup interval dropdown (source of truth for intervals),
      // then keep the existing Market Risk input render.
      handlers.handleCustomerMarketRiskIntervalOptions?.(rows);
      return handlers.handleMvarInputData?.(data);

    case 'v_MVAR_MODEL_SELECTION_APPData':
      return handlers.handleMvarModelSelectionAppData?.(rows);

    case 'MarketVaRData':
      return handlers.handleAllMVaRData?.(data);

    case 'MarketVaR_DistData':
      return handlers.handleMvarDistData?.(data);

    case 'MarketVaR_FactorPLData':
      console.log('[dataRouter] MarketVaR_FactorPLData received', {
        rows: rows.length,
        hasStore: typeof appState?.setMvarFactorPLData === 'function',
        hasHandler: typeof handlers.handleMVaRFactorPLData === 'function',
        sample: rows[0],
      });

      appState?.setMvarFactorPLData?.(rows);
      return handlers.handleMVaRFactorPLData?.(rows);

    case 'MarketVaR_ProductData':
      return handlers.handleMVaRProductPLData(rows);

    // EAD
    case 'EADData':
      return handlers.handleAllEADData?.(data);

    // CVaR
    case 'lossHistogramMainData':
      appState?.setLossHistogram?.(rows);
      document.dispatchEvent(new Event('losshist:ready'));
      return;

    case 'CreditVaRInputData':
      return handlers.initHandleCvarInput?.(data);

    case 'CreditVaRInputThresholdData':
      return handlers.handleCvarInputThreshold?.(data);

    case 'CreditVaRData':
      return handlers.handleAllCVaRData?.(data);

    // LOSSES
    case 'sortedLossesIssuerMainData':
      return handlers.handleAllLossData?.(data);

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
