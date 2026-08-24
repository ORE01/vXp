//initAnalysePortfolioPanels.js
import { initLazyPanels, refreshOpenPanels as refreshCore } from "./panelOrchestrator.js";
import { rerenderHistoricCharts } from "../../features/ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/historicRiskMetrics.js";
import { renderCreditIssuerScenarioBuilder, renderCreditIssuerScenarioSetPanel } from "../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CreditIssuerScenarioBuilder.js";


/**
 * HIER Ã¤nderst du spÃ¤ter nur noch diese eine Funktion.
 * Alles andere bleibt stabil.
 */
export function getHistoricPortfolioChartRenderers() {
  return {
    "PORTFOLIO_HISTORY_Modal": () => rerenderHistoricCharts({ scope: "yield" }),
    "panel-portfolio-value": () => rerenderHistoricCharts({ scope: "value" }),
    "panel-hist-sensitivities": () => rerenderHistoricCharts({ scope: "sens" }),
    "panel-market-risk": () => rerenderHistoricCharts({ scope: "market" }),
    "panel-credit-risk": () => rerenderHistoricCharts({ scope: "credit" }),

    // Credit-Issuer-Szenario: Builder + Set (jeweils beim Panel-Open rendern).
    "panel-create-credit-scenario": () => renderCreditIssuerScenarioBuilder(),
    "panel-credit-scenario-set": () => renderCreditIssuerScenarioSetPanel(),
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


