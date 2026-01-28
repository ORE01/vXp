// FRONT_END/bootstrap/bootstrapUIBasics.js

import { createPortfolioUIOrchestrator } from '../STATE/portfolioUIOrchestrator.js';
import { createPortfolioDropdownUI } from '../UI/portfolioDropdownUI.js';
import { createMarketRiskRefresh } from '../UI/marketRiskRefresh.js';

export function bootstrapUIBasics(appState) {
  const portfolioUI = createPortfolioUIOrchestrator({ appState });

  // ✅ AppState delegiert nur noch (Backwards compatible)
  appState.handlePortTable = portfolioUI.renderPortTable;
  appState.handleOffersTable = portfolioUI.renderOffersTable;

  const portfolioDropdownUI = createPortfolioDropdownUI({ appState });
  const marketRiskRefresh   = createMarketRiskRefresh({ appState });

  // Backwards compatible: wenn du irgendwo noch appState.* aufrufst
  appState.updateDropdownOptions = portfolioDropdownUI.updateDropdownOptions;
  appState.fetchAndHandlePortData = portfolioDropdownUI.fetchAndHandlePortData;
  appState.getFormElementsForContainer = portfolioDropdownUI.getFormElementsForContainer;

  appState.refreshMarketRiskUI = marketRiskRefresh.refreshMarketRiskUI;

  return { portfolioUI, portfolioDropdownUI, marketRiskRefresh };
}

