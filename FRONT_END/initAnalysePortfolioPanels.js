// initPanelsByClick.js
import { initLazyPanels, refreshOpenPanels as refreshCore } from "./lazyPanelsCore.js";

import {
  renderPortfolioHistoryYieldChart,
  renderPortfolioValueChartLine,
  renderMarketRiskChartLine,
  renderPortfolioSensChartLine,
  renderCreditMetricsChartLine,
} from "./ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/historicRiskMetrics.js";

/**
 * HIER änderst du später nur noch diese eine Funktion.
 * Alles andere bleibt stabil.
 */
export function getPortfolioPanelRenderers() {
  return {
    "PORTFOLIO_HISTORY_Modal": () => renderPortfolioHistoryYieldChart(),
    "panel-portfolio-value": () => renderPortfolioValueChartLine(),
    "panel-hist-sensitivities": () => renderPortfolioSensChartLine(),
    "panel-market-risk": () => renderMarketRiskChartLine(),
    "panel-credit-risk": () => renderCreditMetricsChartLine(),
  };
}

export function initPortfolioPanelsLazyRender({ panelRenderState } = {}) {
  initLazyPanels({
    key: "portfolio",
    panelRenderState,
    panelRenderers: getPortfolioPanelRenderers(),
    triggerSelector: ".section-trigger"   // bleibt gleich
  });
}

export function refreshOpenPortfolioPanels() {
  refreshCore("portfolio");
}

