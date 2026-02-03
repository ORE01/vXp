// core/bootstrap/bootstrapuiBasics.js

import { createPortfolioUIOrchestrator } from '../STATE/portfolioUIOrchestrator.js';
import { createPortfolioDropdownUI } from '../../features/SELECT_PORTFOLIO/portfolioDropdownUI.js';
import { createMarketRiskRefresh } from '../../features/ANALYSE_PORTFOLIO/MARKET_RISK/marketRiskRefresh.js';

export function bootstrapUIBasics(appState) {
  const portfolioUI = createPortfolioUIOrchestrator({ appState });

  // ✅ AppState delegiert nur noch (Backwards compatible)
  appState.handlePortTable = portfolioUI.renderPortTable;
  appState.handleOffersTable = portfolioUI.renderOffersTable;

  const portfolioDropdownUI = createPortfolioDropdownUI({ appState });
  const marketRiskRefresh   = createMarketRiskRefresh({ appState });// das portfolio bleicbt gleich aber es ändert sich market, norm, hist

  // Backwards compatible: wenn du irgendwo noch appState.* aufrufst
  appState.updateDropdownOptions = portfolioDropdownUI.updateDropdownOptions;
  appState.fetchAndHandlePortData = portfolioDropdownUI.fetchAndHandlePortData;
  appState.getFormElementsForContainer = portfolioDropdownUI.getFormElementsForContainer;

  appState.refreshMarketRiskUI = marketRiskRefresh.refreshMarketRiskUI;

  return { portfolioUI, portfolioDropdownUI, marketRiskRefresh };
}

