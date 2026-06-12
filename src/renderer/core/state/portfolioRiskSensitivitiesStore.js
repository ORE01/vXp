// src/renderer/core/state/portfolioRiskSensitivitiesStore.js

function normalizePortfolioName(portName) {
  return String(portName ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

function normalizeRiskType(riskType) {
  return String(riskType ?? '')
    .toUpperCase()
    .trim();
}

function getNumericValue(row) {
  const value = Number(
    row.VALUE_BASE ??
    row.value_base ??
    row.VALUE_LOCAL ??
    row.value_local ??
    0
  );

  return Number.isFinite(value) ? value : 0;
}

const portfolioRiskSensitivitiesStore = {
  rows: [],
  lastUpdatedAt: null,

  setRows(rows, meta = {}) {
    const nextRows = Array.isArray(rows) ? rows : [];

    this.rows = nextRows;
    this.lastUpdatedAt = new Date().toISOString();

    const detail = {
      rows: this.rows.length,
      ports: this.getPorts(),
      riskTypes: this.getRiskTypes(),
      lastUpdatedAt: this.lastUpdatedAt,
      source: meta.source ?? 'portfolioRiskSensitivitiesStore.setRows',
    };

    console.log('[PRS STORE] rows replaced', detail);

    document.dispatchEvent(
      new CustomEvent('portfolio-risk-sensitivities-data-refreshed', {
        detail,
      })
    );
  },

  clear(meta = {}) {
    this.rows = [];
    this.lastUpdatedAt = new Date().toISOString();

    const detail = {
      rows: 0,
      ports: [],
      riskTypes: [],
      lastUpdatedAt: this.lastUpdatedAt,
      source: meta.source ?? 'portfolioRiskSensitivitiesStore.clear',
    };

    console.log('[PRS STORE] rows cleared', detail);

    document.dispatchEvent(
      new CustomEvent('portfolio-risk-sensitivities-data-refreshed', {
        detail,
      })
    );
  },

  getRows() {
    return this.rows || [];
  },

  getLastUpdatedAt() {
    return this.lastUpdatedAt;
  },

  getPorts() {
    return [
      ...new Set(
        this.getRows()
          .map(r => normalizePortfolioName(r.PORT_NAME ?? r.port_name))
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

  getByPortfolio(portName) {
    const allRows = this.getRows();

    const targetPort = normalizePortfolioName(portName);

    if (!targetPort) {
      return allRows;
    }

    return allRows.filter(r =>
      normalizePortfolioName(r.PORT_NAME ?? r.port_name) === targetPort
    );
  },

  getByPortfolioAndType(portName, riskType) {
    const portfolioRows = this.getByPortfolio(portName);

    const targetRiskType = normalizeRiskType(riskType);

    if (!targetRiskType) {
      return portfolioRows;
    }

    return portfolioRows.filter(r =>
      normalizeRiskType(r.RISK_TYPE ?? r.risk_type) === targetRiskType
    );
  },

  getTotalByPortfolioAndType(portName, riskType) {
    return this.getByPortfolioAndType(portName, riskType).reduce((sum, row) => {
      return sum + getNumericValue(row);
    }, 0);
  },
};

export function installPortfolioRiskSensitivitiesStore({ appState } = {}) {
  if (!appState) {
    throw new Error('[installPortfolioRiskSensitivitiesStore] appState missing');
  }

  appState.setPortfolioRiskSensitivitiesData = (rows, meta = {}) =>
    portfolioRiskSensitivitiesStore.setRows(rows, meta);

  appState.getPortfolioRiskSensitivitiesData = () =>
    portfolioRiskSensitivitiesStore.getRows();

  return portfolioRiskSensitivitiesStore;
}

export default portfolioRiskSensitivitiesStore;