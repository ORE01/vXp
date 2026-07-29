// src/renderer/core/state/stores/productRiskSensitivitiesStore.js
//
// Per-PRODUCT, per-unit-notional sensitivities (portfolio-independent).
// Source table: ProductRiskSensitivities (PROD_ID, RISK_TYPE, TENOR, CCY,
// RATING, VALUE_PER_UNIT, RISK_FACTOR_ID, ASOF_DATE).
//
// The renderer reconstructs a portfolio/filtered sensitivity from these by
// multiplying VALUE_PER_UNIT with each holding's NOTIONAL (see PV01 handler).

function normalizeProdId(prodId) {
  return String(prodId ?? '').trim();
}

function normalizeRiskType(riskType) {
  return String(riskType ?? '')
    .toUpperCase()
    .trim();
}

const productRiskSensitivitiesStore = {
  rows: [],
  lastUpdatedAt: null,

  setRows(rows, meta = {}) {
    this.rows = Array.isArray(rows) ? rows : [];
    this.lastUpdatedAt = new Date().toISOString();

    const detail = {
      rows: this.rows.length,
      products: this.getProducts().length,
      riskTypes: this.getRiskTypes(),
      lastUpdatedAt: this.lastUpdatedAt,
      source: meta.source ?? 'productRiskSensitivitiesStore.setRows',
    };

    console.log('[PROD RS STORE] rows replaced', detail);

    document.dispatchEvent(
      new CustomEvent('product-risk-sensitivities-data-refreshed', { detail })
    );
  },

  clear(meta = {}) {
    this.rows = [];
    this.lastUpdatedAt = new Date().toISOString();

    document.dispatchEvent(
      new CustomEvent('product-risk-sensitivities-data-refreshed', {
        detail: {
          rows: 0,
          products: 0,
          riskTypes: [],
          lastUpdatedAt: this.lastUpdatedAt,
          source: meta.source ?? 'productRiskSensitivitiesStore.clear',
        },
      })
    );
  },

  getRows() {
    return this.rows || [];
  },

  getLastUpdatedAt() {
    return this.lastUpdatedAt;
  },

  getProducts() {
    return [
      ...new Set(
        this.getRows()
          .map(r => normalizeProdId(r.PROD_ID ?? r.prod_id))
          .filter(Boolean)
      ),
    ];
  },

  getRiskTypes() {
    return [
      ...new Set(
        this.getRows()
          .map(r => normalizeRiskType(r.RISK_TYPE ?? r.risk_type))
          .filter(Boolean)
      ),
    ];
  },

  getByType(riskType) {
    const target = normalizeRiskType(riskType);

    if (!target) {
      return this.getRows();
    }

    return this.getRows().filter(
      r => normalizeRiskType(r.RISK_TYPE ?? r.risk_type) === target
    );
  },
};

export function installProductRiskSensitivitiesStore({ appState } = {}) {
  if (!appState) {
    throw new Error('[installProductRiskSensitivitiesStore] appState missing');
  }

  appState.setProductRiskSensitivitiesData = (rows, meta = {}) =>
    productRiskSensitivitiesStore.setRows(rows, meta);

  appState.getProductRiskSensitivitiesData = () =>
    productRiskSensitivitiesStore.getRows();

  return productRiskSensitivitiesStore;
}

export default productRiskSensitivitiesStore;
