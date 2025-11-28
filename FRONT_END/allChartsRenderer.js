import { renderLGDChart } from '../FRONT_END/ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { renderHistoricCreditRiskChart, renderHistoricMarketRiskChart, renderHistoricPortfolioSensChart, renderHistoricPortfolioValueChart, renderHistoricPortfolioYieldChart } from '../FRONT_END/ANALYSE_PORTFOLIO/HISTORIC_RISK_METRICS/historicRiskMetrics.js';
import { renderIRLineChart} from '../FRONT_END/MARKET_DATA/INTEREST_RATES/IR.js';

function safeCall(fn, label) {
  if (typeof fn !== "function") {
    console.warn(`renderAllChartsNow: Renderer fehlt oder ist keine Funktion → ${label}`);
    return;
  }
  try {
    fn();
  } catch (err) {
    console.error(`renderAllChartsNow: Fehler in ${label}`, err);
  }
}



// Beispiel: in allChartsRenderer.js
// Wichtig: die jeweiligen Render-Funktionen oben importieren!

export function renderAllChartsNow() {
  console.groupCollapsed("📊 renderAllChartsNow – full chart refresh");

//   // =========================
//   // 1) PERFORMANCE
//   // =========================
//   // Canvas:
//   // - euswapPortfolioYieldChart
//   // - euswapProductYieldChart
//   // - durationSwapChart
//   // - durationProductYieldChart
//   safeCall(renderEUSwapPortfolioYieldChart,     "Performance / euswapPortfolioYieldChart");
//   safeCall(renderEUSwapProductYieldChart,       "Performance / euswapProductYieldChart");
//   safeCall(renderDurationSwapChart,             "Performance / durationSwapChart");
//   safeCall(renderDurationProductYieldChart,     "Performance / durationProductYieldChart");

//   // =========================
//   // 2) MARKET RISK (aktuelle MVaR-Sicht)
//   // =========================
//   // Canvas:
//   // - tsEU1YChart
//   // - plMvarDistChart
//   // - MVaRChart
//   safeCall(renderTsEU1YChart,                   "Market Risk / tsEU1YChart");
//   safeCall(renderPlMvarDistChart,               "Market Risk / plMvarDistChart");
//   safeCall(renderMVaRChart,                     "Market Risk / MVaRChart");

//   // =========================
//   // 3) SENSITIVITIES (PV01 / CPV01)
//   // =========================
//   // Canvas:
//   // - PV01Chart
//   // - CPV01Chart
//   safeCall(renderPV01Chart,                     "Sensitivities / PV01Chart");
//   safeCall(renderCPV01Chart,                    "Sensitivities / CPV01Chart");

//   // =========================
//   // 4) CREDIT RISK – PROFIT/LOSS DISTRIBUTION
//   // =========================
//   // Canvas:
//   // - LossIssuerCombinedChart
//   // - LossIssuerCombinedESChart
//   safeCall(renderLossIssuerCombinedChart,       "Credit Risk / LossIssuerCombinedChart");
//   safeCall(renderLossIssuerCombinedESChart,     "Credit Risk / LossIssuerCombinedESChart");

  // =========================
  // 5) CREDIT METRICS – EAD / LGD / PD / CVaR
  // =========================
  // Canvas:
  // - LGDChart
  // - LossIssuerChartRating
  // - LossIssuerChartMarket
  // - LossIssuerChartMarketNorm
//   safeCall(renderLGDChart,                      "Credit Metrics / LGDChart");
//   safeCall(renderLossIssuerChartRating,         "Credit Metrics / LossIssuerChartRating");
//   safeCall(renderLossIssuerChartMarket,         "Credit Metrics / LossIssuerChartMarket");
//   safeCall(renderLossIssuerChartMarketNorm,     "Credit Metrics / LossIssuerChartMarketNorm");

//   // =========================
//   // 6) LIQUIDITY
//   // =========================
//   // Canvas:
//   // - liquChart
//   safeCall(renderLiquidityChart,                "Liquidity / liquChart");

  // =========================
  // 7) HISTORIC PERFORMANCE (DEIN NEUER BLOCK)
  // =========================
  // Canvas:
  // - historicPortfolioYieldChart
  // - historicPortfolioValueChart
  // - historicPortfolioSensChart
  // - historicMarketRiskChart
  // - historicCreditRiskChart
  safeCall(renderHistoricPortfolioYieldChart,   "Historic / historicPortfolioYieldChart");
  safeCall(renderHistoricPortfolioValueChart,   "Historic / historicPortfolioValueChart");
  safeCall(renderHistoricPortfolioSensChart,    "Historic / historicPortfolioSensChart");
  safeCall(renderHistoricMarketRiskChart,       "Historic / historicMarketRiskChart");
  safeCall(renderHistoricCreditRiskChart,       "Historic / historicCreditRiskChart");

//   // =========================
//   // 8) MARKET DATA
//   // =========================
//   // Canvas:
//   // - IRLineChart
//   // - FWDlineChart
//   // - FWDforwardCurveChart
//   // - CS_ChartCanvas
//   // - TSlineChart
  safeCall(renderIRLineChart,                   "Market Data / IRLineChart");
//   safeCall(renderFWDlineChart,                  "Market Data / FWDlineChart");
//   safeCall(renderFWDforwardCurveChart,          "Market Data / FWDforwardCurveChart");
//   safeCall(renderCreditSpreadsChart,            "Market Data / CS_ChartCanvas");
//   safeCall(renderTSlineChart,                   "Market Data / TSlineChart");

//   // =========================
//   // 9) MACHINE LEARNING
//   // =========================
//   // Canvas:
//   // - MLTestDataChart
//   // - MLFuturePredictionChart
//   safeCall(renderMLTestDataChart,               "ML / MLTestDataChart");
//   safeCall(renderMLFuturePredictionChart,       "ML / MLFuturePredictionChart");

//   // =========================
//   // 10) COMPARE PORTFOLIOS (falls du eigene Gruppen-Renderer hast)
//   // =========================
//   // Hier gehe ich davon aus, dass du schon Gruppenfunktionen hast.
//   // Falls nicht, kannst du sie später ergänzen oder weglassen.
//   safeCall(renderCompChartsGroup1,              "Compare / Group1 Charts");
//   safeCall(renderCompChartsGroup2,              "Compare / Group2 Charts");
//   safeCall(renderCompChartsGroup3,              "Compare / Group3 Charts");

//   // =========================
//   // 11) EXPORT-CHARTS (für PDF)
//   // =========================
//   // Canvas:
//   // - IRLineChartExport
//   // - ProductCurveExport
//   // - euswapYieldChartExport
//   safeCall(renderIRLineChartExport,             "Export / IRLineChartExport");
//   safeCall(renderProductCurveExport,            "Export / ProductCurveExport");
//   safeCall(renderEuswapYieldChartExport,        "Export / euswapYieldChartExport");

  console.groupEnd();
}
