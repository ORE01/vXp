// FRONT_END/REPORTS/reportsUIBridge.js

import { initIssuerModalUI } from '../UI/modals/issuerModalUI.js';
import { wireOffersReportUI } from './offersReportUI.js';
import { wireRiskReportUI } from './riskReportUI.js';

// NOTE:
// This bridge wires REPORTS-related UI once.
// Keep it idempotent to avoid double event bindings.

export function installReportsUIBridge({
  openPanel,
  appState,
  handleIRSensData,
  handleCSSensData,
} = {}) {
  if (typeof openPanel !== 'function') {
    throw new Error('[reportsUIBridge] openPanel must be a function');
  }
  if (!appState) {
    throw new Error('[reportsUIBridge] appState missing');
  }

  // idempotent
  if (window.__reportsUIWiredOnce) return;
  window.__reportsUIWiredOnce = true;

  // 1) Modal UI
  initIssuerModalUI();

  // 2) Offers report UI
  wireOffersReportUI({ openPanel });

  // 3) Risk report UI
  wireRiskReportUI({ appState, handleIRSensData, handleCSSensData });
}
