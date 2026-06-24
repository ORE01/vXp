// initCustomerSetupPanels.js
// Lazy-Render-Registrierung der CUSTOMER-SETUP-Panels. Damit rendert der
// Report-Warmup (renderAllRegisteredPanels) ihre Inhalte aus dem Store in die
// (off-screen, voll dimensionierten) Panels — generisch über DIESELBE Registry
// wie MARKET DATA. Kein Spezialfall pro Panel; die Tabellen/Charts der CUSTOMER-
// SETUP-Panels stehen damit im DOM bereit und werden im Report erfasst.

import { initLazyPanels } from './panelOrchestrator.js';

import { renderCustomerCategoryPanel } from '../../features/CUSTOMER_SETUP/customerCategoryPanel.js';
import {
  renderCustomerMarketRiskDropdown,
  renderWarningLimits,
} from '../../features/CUSTOMER_SETUP/customerMarketRiskPanel.js';
import {
  renderCreditRiskSettings,
  renderCreditRiskThresholds,
} from '../../features/CUSTOMER_SETUP/customerCreditRiskPanel.js';

function safe(label, fn) {
  try {
    fn();
  } catch (err) {
    console.warn(`[CustomerSetupLazy] ${label} render failed`, err);
  }
}

export function getCustomerSetupPanelRenderers() {
  return {
    'panel-customer-category': () =>
      safe('category', () => renderCustomerCategoryPanel()),

    'panel-customer-market-risk-interval': () =>
      safe('market-risk-interval', () => {
        renderCustomerMarketRiskDropdown();
        renderWarningLimits();
      }),

    'panel-customer-credit-risk': () =>
      safe('credit-risk', () => {
        renderCreditRiskSettings();
        renderCreditRiskThresholds();
      }),
  };
}

export function initCustomerSetupPanelsLazyRender({ panelRenderState } = {}) {
  initLazyPanels({
    key: 'customerSetup',
    panelRenderState,
    panelRenderers: getCustomerSetupPanelRenderers(),
    triggerSelector: '#CUSTOMER_SETUP_Modal .section-trigger',
  });
}
