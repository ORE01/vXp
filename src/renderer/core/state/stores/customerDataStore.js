// src/renderer/core/state/stores/customerDataStore.js
//
// Customer client state, moved out of AppState. Follows the existing store
// pattern (installXStore({ appState }) -> defines functions, keeps the data on
// appState fields, attaches the functions to appState, returns them). Existing
// appState.* callers keep working because the methods are re-attached here.
//
// Owns: customerData, customerTSData, customerMarketRiskSetting,
//       customerMarketRiskThresholds.

export function installCustomerDataStore({ appState } = {}) {
  if (!appState) throw new Error('[customerDataStore] appState fehlt');

  // ---- Customer master / TS selection ----
  function setCustomerData(data) {
    appState.customerData = data;
  }
  function getCustomerData() {
    return appState.customerData;
  }

  function setCustomerTSData(data) {
    appState.customerTSData = data;
  }
  function getCustomerTSData() {
    return appState.customerTSData;
  }

  // ---- Market Risk setting (default interval + warning profile) ----
  function setCustomerMarketRiskSetting(setting) {
    appState.customerMarketRiskSetting = setting || null;
  }
  function getCustomerMarketRiskSetting() {
    return appState.customerMarketRiskSetting || null;
  }

  // ---- Market Risk thresholds (loss-tolerance limits per profile) ----
  function setCustomerMarketRiskThresholds(rows) {
    appState.customerMarketRiskThresholds = Array.isArray(rows) ? rows : [];
  }
  function getCustomerMarketRiskThresholds() {
    return Array.isArray(appState.customerMarketRiskThresholds)
      ? appState.customerMarketRiskThresholds
      : [];
  }

  function getCustomerMarketRiskThresholdsByProfile(profile) {
    const wanted = String(profile || 'BALANCED');
    return getCustomerMarketRiskThresholds()
      .filter((r) => String(r.risk_warning_profile) === wanted && Number(r.is_active ?? 1) === 1)
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  }

  function getActiveCustomerMarketRiskThreshold(metricCode) {
    const profile = getCustomerMarketRiskSetting()?.risk_warning_profile || 'BALANCED';
    return getCustomerMarketRiskThresholdsByProfile(profile)
      .find((r) => String(r.metric_code) === String(metricCode)) || null;
  }

  // ---- Credit Risk general settings ----
  function setCustomerCreditRiskSetting(setting) {
    appState.customerCreditRiskSetting = setting || null;
  }
  function getCustomerCreditRiskSetting() {
    return appState.customerCreditRiskSetting || null;
  }

  function setCustomerCreditRiskSettings(rows) {
    appState.customerCreditRiskSettings = Array.isArray(rows) ? rows : [];
  }
  function getCustomerCreditRiskSettings() {
    return Array.isArray(appState.customerCreditRiskSettings) ? appState.customerCreditRiskSettings : [];
  }

  // ---- Credit Risk thresholds (CVAR / TSI / MSD warning limits) ----
  function setCustomerCreditRiskThresholds(rows) {
    const arr = Array.isArray(rows) ? rows : [];
    appState.customerCreditRiskThresholds = [...arr]
      .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));
  }
  function getCustomerCreditRiskThresholds() {
    return Array.isArray(appState.customerCreditRiskThresholds) ? appState.customerCreditRiskThresholds : [];
  }
  function getCustomerCreditRiskThreshold(metricCode) {
    return getCustomerCreditRiskThresholds()
      .find((r) => String(r.metric_code) === String(metricCode)) || null;
  }
  function getActiveCustomerCreditRiskThreshold(metricCode) {
    return getCustomerCreditRiskThresholds()
      .find((r) => String(r.metric_code) === String(metricCode) && Number(r.is_active ?? 1) === 1) || null;
  }

  // ---- expose on appState (facade) ----
  appState.setCustomerData = setCustomerData;
  appState.getCustomerData = getCustomerData;

  appState.setCustomerTSData = setCustomerTSData;
  appState.getCustomerTSData = getCustomerTSData;

  appState.setCustomerMarketRiskSetting = setCustomerMarketRiskSetting;
  appState.getCustomerMarketRiskSetting = getCustomerMarketRiskSetting;

  appState.setCustomerMarketRiskThresholds = setCustomerMarketRiskThresholds;
  appState.getCustomerMarketRiskThresholds = getCustomerMarketRiskThresholds;
  appState.getCustomerMarketRiskThresholdsByProfile = getCustomerMarketRiskThresholdsByProfile;
  appState.getActiveCustomerMarketRiskThreshold = getActiveCustomerMarketRiskThreshold;

  appState.setCustomerCreditRiskSetting = setCustomerCreditRiskSetting;
  appState.getCustomerCreditRiskSetting = getCustomerCreditRiskSetting;
  appState.setCustomerCreditRiskSettings = setCustomerCreditRiskSettings;
  appState.getCustomerCreditRiskSettings = getCustomerCreditRiskSettings;

  appState.setCustomerCreditRiskThresholds = setCustomerCreditRiskThresholds;
  appState.getCustomerCreditRiskThresholds = getCustomerCreditRiskThresholds;
  appState.getCustomerCreditRiskThreshold = getCustomerCreditRiskThreshold;
  appState.getActiveCustomerCreditRiskThreshold = getActiveCustomerCreditRiskThreshold;

  return {
    setCustomerData,
    getCustomerData,
    setCustomerTSData,
    getCustomerTSData,
    setCustomerMarketRiskSetting,
    getCustomerMarketRiskSetting,
    setCustomerMarketRiskThresholds,
    getCustomerMarketRiskThresholds,
    getCustomerMarketRiskThresholdsByProfile,
    getActiveCustomerMarketRiskThreshold,
    setCustomerCreditRiskSetting,
    getCustomerCreditRiskSetting,
    setCustomerCreditRiskSettings,
    getCustomerCreditRiskSettings,
    setCustomerCreditRiskThresholds,
    getCustomerCreditRiskThresholds,
    getCustomerCreditRiskThreshold,
    getActiveCustomerCreditRiskThreshold,
  };
}
