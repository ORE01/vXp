// FRONT_END/UI/marketRiskRefresh.js
// UI-Orchestrierung fÃ¼r "MarketRisk refresh" (Summary + ProductTable + MVaR UI).
// KEIN global appState â€” alles Ã¼ber DI.

import { handleMVaRData } from '../../features/ANALYSE_PORTFOLIO/MARKET_RISK/MVaR.js';
import { handleSummaryMarketRiskData, handleMvarProductTable } from '../../features/ANALYSE_PORTFOLIO/SummaryMarketRisk.js';

export function createMarketRiskRefresh({ appState } = {}) {
  if (!appState) throw new Error('[marketRiskRefresh] appState fehlt');

  function refreshMarketRiskUI(index = 0) {
    const port = appState.getSelectedPortTableName?.();
    if (!port) return;

    const allMvar = appState.getAllMvarData?.() || [];
    if (!Array.isArray(allMvar) || !allMvar.length) return;

    // 1) MVaR charts/tables
    handleMVaRData(allMvar, index);

    // 2) Summary + ProductTable (scenario)
    const scenario = appState.selectedMvarInterval ?? null;
    handleSummaryMarketRiskData(port, scenario, null);
    handleMvarProductTable(port, scenario, null);
  }

  return { refreshMarketRiskUI };
}

