// RiskConfig.js
export const { jsPDF } = window.jspdf;

// 1) Zentral: Default-Konfiguration der Sections
export const REPORT_DEFAULTS = {
  includeTOC: true,
  sections: {
    portfolioBreakdown: { enabled: true, issuer: true, product: true, general: true },
    performance:        true,
    marketRisk:         { enabled: true, details: true, sensitivities: true },
    creditRisk:         { enabled: true, details: true },
    liquidity:          { enabled: true },
    marketData:         { enabled: true, interestRates: true, creditSpreads: true },
    historic:           { enabled: true },
    appendixProducts:   true,
  },
  fileName: 'Risk.pdf',
  paper: 'a4',
  orientation: 'p',
};

// 2) Portfolio Breakdown: Spalten, Gruppen, Labels
export const BD_COLUMNS = ['ISSUER','RATING','RANK','RATINGres','CATEGORY','CouponType','Depotbank'];

export const BD_DISPLAY = {
  ISSUER:     'Issuer',
  RATING:     'Issuer General Rating',
  RANK:       'Issuer Capital Structure',
  RATINGres:  'Product Ratings',
  CATEGORY:   'Product Categories',
  CouponType: 'Product Coupon Type',
  Depotbank:  'Depot Bank'
};

export const BD_GROUPS_ORDERED = {
  issuer:  ['ISSUER','RATING','RANK'],
  product: ['RATINGres','CATEGORY','CouponType'],
  general: ['Depotbank']
};

// Daraus ableiten: Spalte → Gruppe (issuer|product|general)
export const BD_GROUP_OF = (() => {
  const map = {};
  Object.entries(BD_GROUPS_ORDERED).forEach(([groupName, cols]) => {
    cols.forEach(col => { map[col] = groupName; });
  });
  return map;
})();





// ===========================================================Zentraler Layout-Plan für Preview + PDF==============================================================================================================
export const RISK_LAYOUT = {
  portfolioBreakdown: {
    // Hier brauchst du keine Charts, die Pie-Charts werden aus dem DOM geholt
    breakdown: {
      columns: BD_COLUMNS,
      display: BD_DISPLAY,
      groupsOrdered: BD_GROUPS_ORDERED,
    },
  },

  performance: {
    charts: [
      { key: 'euswapPortfolioYield', section: 'performance', id: 'euswapPortfolioYieldChart', label: 'Portfolio Yield' },
      { key: 'euswapProductYield',   section: 'performance', id: 'euswapProductYieldChart',   label: 'Product Yield' },
      { key: 'durationSwap',         section: 'performance', id: 'durationSwapChart',         label: 'Duration Swap' },
      { key: 'durationProductYield', section: 'performance', id: 'durationProductYieldChart', label: 'Duration vs Yield' },
    ],
  },

  marketRisk: {
    charts: [
      // Basis-Charts
      { key: 'tsEU1Y',     section: 'marketRisk',       id: 'tsEU1YChart',     label: '1Y Time Series' },
      { key: 'plMvarDist', section: 'marketRisk',       id: 'plMvarDistChart', label: 'P/L MVaR Distribution' },

      // Detail-Chart
      { key: 'mvarMain',   section: 'marketRiskDetail', id: 'MVaRChart',       label: 'MVaR Chart' },
    ],

    tables: [
      // Market-Risk Inputs / Summary
      { key: 'input',   group: 'mvarInputs',  containerId: 'inputMvarContainer',  label: 'VaR Input Table',   maxRows: 8,  maxCols: 8,  maxWidth: 520 },
      { key: 'summary', group: 'mvarInputs',  containerId: 'MVaRDataContainer0',  label: 'VaR / ES Summary',   maxRows: 10, maxCols: 4,  maxWidth: 300,
        fallbackContainerId: 'MVaRDataContainer' },
      // Detail-Tabellen
      { key: 'total',   group: 'mvarTables',  containerId: 'MVaRTotalContainer',  label: 'Total (T)',          maxRows: 8,  maxCols: 10, maxWidth: 380 },
      { key: 'ir',      group: 'mvarTables',  containerId: 'MVaRIRContainer',     label: 'Interest Rate (IR)', maxRows: 8,  maxCols: 10, maxWidth: 380 },
      { key: 'cs',      group: 'mvarTables',  containerId: 'MVaRCSContainer',     label: 'Credit Spread (CS)', maxRows: 8,  maxCols: 10, maxWidth: 380 },
    ],

    // Spezieller Block: Traffic-Light – kein Table, sondern DOM-Clone
    specials: [
      { key: 'traffic', group: 'mvarInputs', type: 'trafficLight', elementId: 'traffic-mvar', label: 'VaR Traffic Light' },
    ],
  },

  sensitivities: {
    charts: [
      { key: 'pv01a',  section: 'sensitivities', id: 'PV01Chart0', label: 'PV01' },
      { key: 'cpv01a', section: 'sensitivities', id: 'CPV01Chart0',label: 'CPV01' },
    ],
    tables: [
      { key: 'ir', group: 'sensTables', containerId: 'IRSensDataContainer',     altContainerId: 'IRSensDataContainer0', label: 'PV01 Table', maxRows: 8, maxCols: 10, maxWidth: 380 },
      { key: 'cs', group: 'sensTables', containerId: 'CRSensDataContainer',     altContainerId: 'CRSensDataContainer0', label: 'CPV01 Table',maxRows: 8, maxCols: 10, maxWidth: 380 },
    ],
  },

  creditRisk: {
    charts: [
      { key: 'lossCombined',   section: 'creditRisk',       id: 'LossIssuerCombinedChart',   label: 'Loss Issuer Combined' },
      { key: 'lossCombinedES', section: 'creditRisk',       id: 'LossIssuerCombinedESChart', label: 'Loss Issuer ES' },
      { key: 'lgd',            section: 'creditRiskDetail', id: 'LGDChart',                  label: 'LGD' },
      { key: 'lossHist',       section: 'creditRiskDetail', id: 'LossIssuerChartRating',     label: 'Loss Issuer (Historic)' },
      { key: 'lossMkt',        section: 'creditRiskDetail', id: 'LossIssuerChartMarket',     label: 'Loss Issuer (Market)' },
      { key: 'lossNorm',       section: 'creditRiskDetail', id: 'LossIssuerChartMarketNorm', label: 'Loss Issuer (Risk Adj.)' },
    ],
    tables: [
      // Top-Metriken
      { key: 'topRating', group: 'creditTopTables', containerId: 'CVaR_ratingDataContainer', label: 'Historical',    maxRows: 8,  maxCols: 8,  maxWidth: 300 },
      { key: 'topMarket', group: 'creditTopTables', containerId: 'CVaR_marketDataContainer', label: 'Market Implied',maxRows: 8,  maxCols: 8,  maxWidth: 300 },
      { key: 'topNorm',   group: 'creditTopTables', containerId: 'CVaR_normDataContainer',   label: 'Risk Adjusted', maxRows: 8,  maxCols: 8,  maxWidth: 300 },

      // EAD & Loss Tables
      { key: 'ead',    group: 'creditLossTables', containerId: 'EADDataContainer',                    label: 'EAD Table',                 maxRows: 10, maxCols: 12, maxWidth: 360 },
      { key: 'liHist', group: 'creditLossTables', containerId: 'LossIssuerDataContainerRating',      label: 'Loss Issuer (Historic)',     maxRows: 10, maxCols: 12, maxWidth: 360 },
      { key: 'liMkt',  group: 'creditLossTables', containerId: 'LossIssuerDataContainerMarket',      label: 'Loss Issuer (Market)',       maxRows: 10, maxCols: 12, maxWidth: 360 },
      { key: 'liNorm', group: 'creditLossTables', containerId: 'LossIssuerDataContainerMarketNorm',  label: 'Loss Issuer (Risk Adj.)',    maxRows: 10, maxCols: 12, maxWidth: 360 },
    ],
  },

  liquidity: {
    charts: [
      { key: 'liquMain', section: 'liquidity', id: 'liquChart', label: 'Liquidity' },
    ],
    tables: [
      { key: 'matCat',  group: 'liquidityTables', containerId: 'liquDataContainer',        label: 'Maturities × Categories', maxRows: 10, maxCols: 10, maxWidth: 380 },
      { key: 'issuers', group: 'liquidityTables', containerId: 'issuerDataContainerLiqu',  label: 'Issuers',                 maxRows: 10, maxCols: 10, maxWidth: 380 },
    ],
  },

  historic: {
    charts: [
      { key: 'histPerf',   section: 'historic', id: 'historicPortfolioYieldChart',  label: 'Performance History' },
      { key: 'histValue',  section: 'historic', id: 'historicPortfolioValueChart',  label: 'Portfolio Value' },
      { key: 'histSens',   section: 'historic', id: 'historicPortfolioSensChart',   label: 'Sensitivities' },
      { key: 'histMkt',    section: 'historic', id: 'historicMarketRiskChart',      label: 'Market Risk – Historic' },
      { key: 'histCredit', section: 'historic', id: 'historicCreditRiskChart',      label: 'Credit Risk – Historic' },
    ],
  },

  marketData: {
    charts: [
      { key: 'mdIR', section: 'marketData', id: 'IRLineChart',    label: 'Interest Rates' },
      { key: 'mdCS', section: 'marketData', id: 'CS_ChartCanvas', label: 'Credit Spreads' },
    ],
  },
};

