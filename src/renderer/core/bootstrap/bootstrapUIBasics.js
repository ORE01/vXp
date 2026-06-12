// src/renderer/core/bootstrap/bootstrapUIBasics.js

import { createPortfolioUIOrchestrator } from '../state/portfolioUIOrchestrator.js';
import { createPortfolioDropdownUI } from '../../features/portfolio/portfolioDropdownUI.js';
import { createMarketRiskRefresh } from '../../features/ANALYSE_PORTFOLIO/marketRisk/marketRiskRefresh.js';

// ✅ central UI enhancer (INCLUDE checkbox)
import { enhanceIncludeCheckboxes } from '../ui/enhancers/includeToggleEnhancer.js';

export function bootstrapUIBasics(appState) {
  const portfolioUI = createPortfolioUIOrchestrator({ appState });

  // ✅ AppState delegiert nur noch (Backwards compatible)
  appState.handlePortTable   = portfolioUI.renderPortTable;
  appState.handleOffersTable = portfolioUI.renderOffersTable;

  const portfolioDropdownUI = createPortfolioDropdownUI({ appState });
  portfolioDropdownUI.bindPortResetFiltersButtonOnce();

  const marketRiskRefresh = createMarketRiskRefresh({ appState }); // das portfolio bleibt gleich aber es ändert sich market, norm, hist

  marketRiskRefresh.installMarketRiskSensitivityRefreshListener?.();

  // Backwards compatible: wenn du irgendwo noch appState.* aufrufst
  appState.updateDropdownOptions      = portfolioDropdownUI.updateDropdownOptions;
  appState.fetchAndHandlePortData     = portfolioDropdownUI.fetchAndHandlePortData;
  appState.getFormElementsForContainer = portfolioDropdownUI.getFormElementsForContainer;

  appState.refreshMarketRiskUI =
    marketRiskRefresh.refreshMarketRiskUI;

  appState.refreshMarketRiskSensitivitiesUI =
    marketRiskRefresh.refreshMarketRiskSensitivitiesUI;

  // ✅ Run once after DOM is ready: auto-discovers all containers with data-enhance-include="1"
  document.addEventListener(
    'DOMContentLoaded',
    () => {
      enhanceIncludeCheckboxes();
    },
    { once: true }
  );

  // ✅ Optional safety: if your app re-renders deals later, this keeps it alive (idempotent)
  document.addEventListener('dealsData:ready', () => {
    enhanceIncludeCheckboxes('#dealsDataContainer');
  });

  return { portfolioUI, portfolioDropdownUI, marketRiskRefresh };
}

