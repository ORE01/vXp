// src/renderer/features/CUSTOMER_SETUP/customerCreditRiskSettingHandler.js
//
// Feature handler in the DataPump READ flow:
//   SQLite -> rendererDataPump -> IPC -> installReceivers -> dataRouter
//   -> handleCustomerCreditRiskSettingData -> AppState store -> UI.
//
// Raw CustomerCreditRiskSetting rows -> AppState. Never reads the DB directly.

import { appState } from '../../renderer.js';
import { renderCreditRiskSettings, renderCreditRiskThresholds } from './customerCreditRiskPanel.js';
import { refreshCreditRiskTrafficLights } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { handleCvarInputThresholdView } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInputThreshold.js';
import { handleCvarInput } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/CvarInput.js';

export function handleCustomerCreditRiskSettingData(rows) {
  const list = Array.isArray(rows) ? rows : [];

  appState.setCustomerCreditRiskSettings?.(list);

  // The active default settings row (one per customer_id + setting_scope).
  const setting =
    list.find(
      (r) => String(r.setting_scope ?? 'DEFAULT') === 'DEFAULT' && Number(r.is_active ?? 1) === 1,
    ) || list[0] || null;

  appState.setCustomerCreditRiskSetting(setting);

  console.log('[CUSTOMER CR SETTING HANDLER]', {
    rowCount: list.length,
    firstRow: list[0],
    storeValue: appState.getCustomerCreditRiskSetting?.(),
  });

  console.log('[CUSTOMER CR SETTING STATE]', {
    default_credit_config_name: setting?.default_credit_config_name ?? null,
    conf_level: setting?.conf_level ?? null,
    corr: setting?.corr ?? null,
    recovery_rate: setting?.recovery_rate ?? null,
    horizon_days: setting?.horizon_days ?? null,
    n_simulations: setting?.n_simulations ?? null,
    cr_model: setting?.cr_model ?? null,
  });

  renderCreditRiskSettings();

  // Re-render the Risk Configuration "CVaR General Settings" table so it reflects the
  // new customer setting immediately — exactly like the threshold handler re-renders
  // handleCvarInputThresholdView(). No-op if that panel is not currently mounted.
  try {
    handleCvarInput();
  } catch (e) {
    console.warn('[CUSTOMER CR SETTING] general-settings display refresh failed', e);
  }
}

// DataPump READ-flow handler for CustomerCreditRiskThresholdSettingData.
// Raw threshold rows -> AppState store -> UI. No traffic-light / CVaR logic here.
export function handleCustomerCreditRiskThresholdSettingData(rows) {
  if (typeof appState.setCustomerCreditRiskThresholds !== 'function') {
    throw new Error('[Customer CR Thresholds] Missing appState.setCustomerCreditRiskThresholds');
  }

  const list = Array.isArray(rows) ? rows : [];

  appState.setCustomerCreditRiskThresholds(list);

  console.log('[CUSTOMER CR THRESHOLDS STATE]', {
    count: list.length,
    metrics: [...new Set(list.map((r) => r.metric_code))],
  });

  renderCreditRiskThresholds();

  try {
    handleCvarInputThresholdView();
  } catch (e) {
    console.warn('[CUSTOMER CR THRESHOLDS] effective threshold display refresh failed', e);
  }

  // Re-render the Credit-Risk analyse traffic lights so they use the new
  // thresholds immediately (no new CVaR run needed). No-op if not rendered/visible.
  try {
    refreshCreditRiskTrafficLights();
  } catch (e) {
    console.warn('[CUSTOMER CR THRESHOLDS] traffic-light refresh failed', e);
  }
}
