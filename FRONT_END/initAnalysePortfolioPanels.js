//initAnalysePortfolioPanels.js
import { initLazyPanels, refreshOpenPanels as refreshCore } from "./lazyPanelsCore.js";
import { rerenderHistoricCharts } from "./ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/historicRiskMetrics.js";


/**
 * HIER änderst du später nur noch diese eine Funktion.
 * Alles andere bleibt stabil.
 */
export function getHistoricPortfolioChartRenderers() {
  return {
    "PORTFOLIO_HISTORY_Modal": () => rerenderHistoricCharts({ scope: "yield" }),
    "panel-portfolio-value": () => rerenderHistoricCharts({ scope: "value" }),
    "panel-hist-sensitivities": () => rerenderHistoricCharts({ scope: "sens" }),
    "panel-market-risk": () => rerenderHistoricCharts({ scope: "market" }),
    "panel-credit-risk": () => rerenderHistoricCharts({ scope: "credit" }),
  };
}


export function initPortfolioPanelsLazyRender({ panelRenderState } = {}) {
  initLazyPanels({
    key: "portfolio",
    panelRenderState,
    panelRenderers: getHistoricPortfolioChartRenderers(),
    triggerSelector: ".section-trigger"   // bleibt gleich
  });
}

export function refreshOpenPortfolioPanels() {
  refreshCore("portfolio");
}

