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

// ASOF_DATE liegt als "August 1st, 2026" vor. Diese Tabelle enthaelt MEHRERE
// Tages-Snapshots (z.B. 28.-31. Juli + 1. Aug). Fuer die aktuelle Sensitivitaet
// darf nur der JUENGSTE Stichtag verwendet werden — sonst summiert der
// Handler-Calc (VALUE_PER_UNIT * NOTIONAL) alle Snapshots auf (~5x zu gross).
const ASOF_MONTHS = {
  january: 1, february: 2, march: 3, april: 4, may: 5, june: 6,
  july: 7, august: 8, september: 9, october: 10, november: 11, december: 12,
};

function asofSortKey(value) {
  const str = String(value ?? '').trim();
  if (!str) return null;
  const m = str.match(/([A-Za-z]+)\s+(\d+)[a-z]*,?\s+(\d{4})/);
  if (!m) return null;
  const month = ASOF_MONTHS[m[1].toLowerCase()];
  const day = parseInt(m[2], 10);
  const year = parseInt(m[3], 10);
  if (!month || !day || !year) return null;
  return year * 10000 + month * 100 + day;
}

function keepLatestAsof(rows) {
  if (!Array.isArray(rows) || rows.length === 0) return rows || [];
  let bestKey = null;
  let bestStr = null;
  for (const r of rows) {
    const raw = r.ASOF_DATE ?? r.asof_date;
    const key = asofSortKey(raw);
    if (key != null && (bestKey == null || key > bestKey)) {
      bestKey = key;
      bestStr = String(raw).trim();
    }
  }
  // Kein parsebares Datum -> Rows unveraendert lassen (nichts wegwerfen).
  if (bestStr == null) return rows;
  return rows.filter(
    r => String(r.ASOF_DATE ?? r.asof_date ?? '').trim() === bestStr
  );
}

const productRiskSensitivitiesStore = {
  rows: [],
  lastUpdatedAt: null,

  setRows(rows, meta = {}) {
    this.rows = keepLatestAsof(Array.isArray(rows) ? rows : []);
    this.lastUpdatedAt = new Date().toISOString();

    const detail = {
      rows: this.rows.length,
      inputRows: Array.isArray(rows) ? rows.length : 0,
      asOf: String(this.rows[0]?.ASOF_DATE ?? this.rows[0]?.asof_date ?? '').trim() || null,
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
