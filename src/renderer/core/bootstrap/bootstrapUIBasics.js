// src/renderer/core/bootstrap/bootstrapUIBasics.js

import { createPortfolioUIOrchestrator } from '../orchestration/portfolioUIOrchestrator.js';
import { createPortfolioDropdownUI } from '../../features/portfolio/createPortfolio/portfolioDropdownUI.js';
import { createMarketRiskRefresh } from '../../features/ANALYSE_PORTFOLIO/marketRisk/marketRiskRefresh.js';

// ✅ central UI enhancer (INCLUDE checkbox)
import { enhanceIncludeCheckboxes } from '../ui/enhancers/includeToggleEnhancer.js';

// Leisten-Badges für aktive Szenarien (Factor Mapping, Historical PD).
import {
  updateFactorMapScenarioWarningUI,
  updatePdHistScenarioWarningUI,
} from '../ui/warnings.js';

// PD-Market-Implied Normalisierungs-Panel (CREDIT RISK).
import { renderPdNormPanel } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/pdNormPanel.js';

// Loss-Histogramm (Dichte-Sicht der Verlustverteilung).
import { renderLossHistogram } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/lossHistogramChart.js';

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

  // Factor-Mapping-Szenario-Badge: initial anzeigen (aus localStorage) und bei
  // jedem Szenariowechsel / Map-Update aktualisieren (Event feuert Panel + Store).
  updateFactorMapScenarioWarningUI();
  document.addEventListener('mvar:factor-map-changed', updateFactorMapScenarioWarningUI);

  // PD-Historical-Szenario-Badge: initial + bei Änderung von PD_HIST_ACTIVE.
  updatePdHistScenarioWarningUI();
  document.addEventListener('pdhist:active:ready', updatePdHistScenarioWarningUI);

  // PD-Normalisierungs-Panel: initial rendern (installiert 'pdnorm:ready'-Listener;
  // re-rendert bei Datenankunft/Save selbst).
  renderPdNormPanel();

  // Loss-Histogramm: initial rendern (installiert 'losshist:ready'-Listener;
  // zeichnet sich nach dem CVaR-Lauf selbst neu).
  renderLossHistogram();

  return { portfolioUI, portfolioDropdownUI, marketRiskRefresh };
}

