// FRONT_END/DATA_PROVIDER/issuerProductHandlers.js

export function createIssuerProductHandlers({ appState } = {}) {
  if (!appState) throw new Error('[createIssuerProductHandlers] appState missing');

  function handleIssuerDataInit(receivedData) {
    appState.setActiveTable?.('issuer');
    appState.setIssuerData?.(receivedData);
    appState.applyFiltersAndUpdateDropdowns?.('issuer');

    const issuerResetButton = document.getElementById('issuerResetFiltersButton');
    issuerResetButton?.addEventListener('click', () => {
      const cfg = appState?.dropdownConfig?.issuer;
      if (cfg) {
        Object.keys(cfg).forEach((dropdownId) => {
          cfg[dropdownId].selection = ['ALL'];
        });
      }

      const fcfg = appState?.filtersConfig?.issuer;
      if (fcfg) {
        Object.keys(fcfg).forEach((k) => {
          fcfg[k] = new Set(['ALL']);
        });
      }

      appState.applyFiltersAndUpdateDropdowns?.('issuer');
    });
  }

  function handleIssuerRankRatingData(receivedData) {
    const rows = Array.isArray(receivedData) ? receivedData : [];

    appState.issuerRankRatingData = rows;

    if (typeof appState.getIssuerRankRatingData !== 'function') {
      appState.getIssuerRankRatingData = function () {
        return this.issuerRankRatingData || [];
      };
    }

    console.log('[ISSUER RANK RATINGS] loaded', rows.length);
  }

  function handleCountryLookupDataInit(receivedData) {
    if (typeof appState.setCountryLookup === 'function') {
      appState.setCountryLookup(receivedData);
    } else {
      appState.countryLookup = receivedData;
    }
  }

  function handleRankData(receivedData) {
    appState.setRankData?.(receivedData);
  }

  function normalizeProductRowForUi(prod = {}) {
    return {
      ...prod,

      // Master
      PROD_ID: prod.PROD_ID ?? prod.product_id ?? '',
      DESCRIPTION: prod.DESCRIPTION ?? prod.product_name ?? '',
      PRODUCT_TYPE: prod.PRODUCT_TYPE ?? prod.product_type ?? '',
      CouponType: prod.CouponType ?? prod.coupon_type ?? '',

      ISSUER: prod.ISSUER ?? prod.issuer_id ?? '',
      TICKER: prod.TICKER ?? prod.issuer_ticker ?? '',
      RANK: prod.RANK ?? prod.seniority ?? '',
      RATING_PROD: prod.RATING_PROD ?? prod.product_rating ?? '',

      CCY: prod.CCY ?? prod.currency_code ?? '',
      START_DATE: prod.START_DATE ?? prod.issue_date ?? '',
      MATURITY: prod.MATURITY ?? prod.maturity_date ?? '',

      // Fixed / frequency
      COUPON: prod.COUPON ?? prod.fixed_coupon_rate ?? '',
      COUPON_FREQUENCY: prod.COUPON_FREQUENCY ?? prod.coupon_frequency ?? '',
      TENOR: prod.TENOR ?? prod.COUPON_FREQUENCY ?? prod.coupon_frequency ?? '',
      PAYMENT_TENOR: prod.PAYMENT_TENOR ?? prod.payment_frequency ?? '',

      // FRN
      REFERENCE_INDEX: prod.REFERENCE_INDEX ?? prod.reference_index ?? '',
      INDEX_TENOR: prod.INDEX_TENOR ?? prod.index_tenor ?? '',
      RESET_TENOR: prod.RESET_TENOR ?? prod.reset_frequency ?? '',
      GEARING: prod.GEARING ?? prod.gearing ?? '',
      SPREADS: prod.SPREADS ?? prod.spread_margin ?? '',
      CAP: prod.CAP ?? prod.cap_rate ?? '',
      FLOOR: prod.FLOOR ?? prod.floor_rate ?? '',

      // Pricing config
      FINLIB: prod.FINLIB ?? prod.pricing_library ?? '',
      MODEL: prod.MODEL ?? prod.pricing_model ?? '',
      METHODE: prod.METHODE ?? prod.pricing_method ?? '',
    };
  }

  function renderProductTableInit(receivedData) {
    const issuerData = appState.getIssuerData?.() || [];

    const tickerToIssuerMap = {};
    issuerData.forEach((entry) => {
      if (entry?.TICKER != null) {
        tickerToIssuerMap[String(entry.TICKER).trim()] = entry.ISSUER;
      }
    });

    const updatedData = (Array.isArray(receivedData) ? receivedData : []).map((prod) => {
      const uiProd = normalizeProductRowForUi(prod);
      const ticker = String(uiProd?.TICKER ?? '').trim();

      const matchedIssuer =
        tickerToIssuerMap[ticker] ||
        uiProd?.ISSUER ||
        null;

      return {
        ...uiProd,
        ISSUER: matchedIssuer,
      };
    });

    appState.setActiveTable?.('prod');

console.log('[PRODUCT HANDLER SET PROD DATA]', {
  rows: updatedData.length,
  fix007: updatedData.find(
    r => String(r.PROD_ID ?? '').trim() === 'FIX007'
  ),
  fixIds: updatedData
    .map(r => String(r.PROD_ID ?? '').trim())
    .filter(id => id.includes('FIX'))
    .slice(0, 20),
});


    appState.setProdData?.(updatedData);
    appState.applyFiltersAndUpdateDropdowns?.('prod');

    window.dispatchEvent(new CustomEvent('products-app-data-refreshed', {
      detail: {
        source: 'renderProductTableInit',
        rows: updatedData,
      },
    }));

    const prodResetButton = document.getElementById('prodResetFiltersButton');
    prodResetButton?.addEventListener('click', () => {
      const cfg = appState?.dropdownConfig?.prod;
      if (cfg) {
        Object.keys(cfg).forEach((dropdownId) => {
          cfg[dropdownId].selection = ['ALL'];
        });
      }

      const fcfg = appState?.filtersConfig?.prod;
      if (fcfg) {
        Object.keys(fcfg).forEach((k) => {
          fcfg[k] = new Set(['ALL']);
        });
      }

      appState.applyFiltersAndUpdateDropdowns?.('prod');
    });
  }

  return {
    handleIssuerDataInit,
    handleIssuerRankRatingData,
    handleCountryLookupDataInit,
    handleRankData,
    renderProductTableInit,
  };
}