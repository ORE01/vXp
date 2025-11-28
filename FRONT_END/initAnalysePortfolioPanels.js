// initPanelsByClick.js
import { initLazyPanels, refreshOpenPanels as refreshCore } from "./lazyPanelsCore.js";

import {
  renderHistoricPortfolioYieldChart,
  renderHistoricPortfolioValueChart,
  renderHistoricMarketRiskChart,
  renderHistoricPortfolioSensChart,
  renderHistoricCreditRiskChart,
} from "./ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/historicRiskMetrics.js";

/**
 * HIER änderst du später nur noch diese eine Funktion.
 * Alles andere bleibt stabil.
 */
export function getPortfolioPanelRenderers() {
  return {
    "PORTFOLIO_HISTORY_Modal": () => renderHistoricPortfolioYieldChart(),
    "panel-portfolio-value": () => renderHistoricPortfolioValueChart(),
    "panel-hist-sensitivities": () => renderHistoricPortfolioSensChart(),
    "panel-market-risk": () => renderHistoricMarketRiskChart(),
    "panel-credit-risk": () => renderHistoricCreditRiskChart(),
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

