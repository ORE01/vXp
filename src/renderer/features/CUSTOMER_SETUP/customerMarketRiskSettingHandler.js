// src/renderer/features/CUSTOMER_SETUP/customerMarketRiskSettingHandler.js
//
// Feature handler in the DataPump READ flow:
//   SQLite -> rendererDataPump -> IPC -> installReceivers -> dataRouter
//   -> handleCustomerMarketRiskSettingData -> AppState store -> UI.
//
// Raw CustomerMarketRiskSetting rows -> AppState. Never reads the DB directly.

import { appState } from '../../renderer.js';
import { renderCustomerMarketRiskDropdown, renderWarningLimits } from './customerMarketRiskPanel.js';

export function handleCustomerMarketRiskSettingData(rows) {
  const list = Array.isArray(rows) ? rows : [];

  // The active default setting (one row per customer_id + setting_scope).
  const setting =
    list.find(
      (r) => String(r.setting_scope ?? 'DEFAULT') === 'DEFAULT' && Number(r.is_active ?? 1) === 1,
    ) || list[0] || null;

  appState.setCustomerMarketRiskSetting(setting);

  console.log('[CUSTOMER MR SETTING STATE]', {
    default_market_risk_interval_code: setting?.default_market_risk_interval_code ?? null,
    risk_warning_profile: setting?.risk_warning_profile ?? null,
  });

  // Expose the saved default interval code for the Market Risk radio default
  // (resolved in modalData.js). null/empty -> radio resolver falls back.
  const code =
    setting && setting.default_market_risk_interval_code
      ? String(setting.default_market_risk_interval_code)
      : null;
  window.__customerMarketRiskDefaultInterval = code && code.trim() !== '' ? code : null;

  // Reflect the new store value in the Customer Setup dropdown.
  renderCustomerMarketRiskDropdown();

  // Notify other screens (e.g. Risk -> Model Selection) so they can re-read the
  // current default from the store and refresh their Customer-Default marking.
  window.dispatchEvent(
    new CustomEvent('customer-market-risk-setting-updated', { detail: setting }),
  );
}

// DataPump READ-flow handler for CustomerMarketRiskThresholdSettingData.
// Raw threshold rows -> AppState store. Loss-tolerance limits only; no traffic
// light / MVaR logic here.
export function handleCustomerMarketRiskThresholdSettingData(rows) {
  const list = Array.isArray(rows) ? rows : [];

  appState.setCustomerMarketRiskThresholds(list);

  console.log('[CUSTOMER MR THRESHOLDS STATE]', {
    count: list.length,
    profiles: [...new Set(list.map((r) => r.risk_warning_profile))],
    metrics: [...new Set(list.map((r) => r.metric_code))],
  });

  // Refresh the read-only "Current Warning Limits" summary if visible.
  renderWarningLimits();
}
