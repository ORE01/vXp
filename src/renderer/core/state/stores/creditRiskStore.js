
// State-only: CVaR inputs + thresholds + agg data + EAD + Loss

export function installCreditRiskStore({ appState } = {}) {
  if (!appState) throw new Error('[creditRiskStore] appState fehlt');

  // Inputs
  function setCvarInput(data) { appState.cvarInputData = data; }
  function getCvarInput() { return appState.cvarInputData; }

  function setCvarInputThreshold(data) { appState.cvarInputThresholdData = data; }
  function getCvarInputThreshold() { return appState.cvarInputThresholdData; }

  // PD_M_norm-Normalisierung (PD_NORM_SETTINGS, eine Zeile)
  function setPdNormSettings(data) { appState.pdNormSettingsData = Array.isArray(data) ? data : []; }
  function getPdNormSettings() { return Array.isArray(appState.pdNormSettingsData) ? appState.pdNormSettingsData : []; }

  // Loss-Histogramm (volle Verlustverteilung, lossHistogramMain)
  function setLossHistogram(data) { appState.lossHistogramData = Array.isArray(data) ? data : []; }
  function getLossHistogram() { return Array.isArray(appState.lossHistogramData) ? appState.lossHistogramData : []; }

  // Aggregates
  function setCvarData(data) { appState.cvarData = data; }
  function getCvarData() { return appState.cvarData; }

  function setAllCvarData(data) { appState.AllCvarData = Array.isArray(data) ? data : []; }
  function getAllCvarData() { return Array.isArray(appState.AllCvarData) ? appState.AllCvarData : []; }

  // EAD
  function setAllEADData(data) { appState.AllEADData = Array.isArray(data) ? data : []; }
  function getAllEADData() { return Array.isArray(appState.AllEADData) ? appState.AllEADData : []; }

  // Loss
  function setAllLossData(data) { appState.AllLossData = Array.isArray(data) ? data : []; }
  function getAllLossData() { return Array.isArray(appState.AllLossData) ? appState.AllLossData : []; }

  // expose
  appState.setCvarInput = setCvarInput;
  appState.getCvarInput = getCvarInput;

  appState.setCvarInputThreshold = setCvarInputThreshold;
  appState.getCvarInputThreshold = getCvarInputThreshold;

  appState.setPdNormSettings = setPdNormSettings;
  appState.getPdNormSettings = getPdNormSettings;

  appState.setLossHistogram = setLossHistogram;
  appState.getLossHistogram = getLossHistogram;

  appState.setCvarData = setCvarData;
  appState.getCvarData = getCvarData;

  appState.setAllCvarData = setAllCvarData;
  appState.getAllCvarData = getAllCvarData;

  appState.setAllEADData = setAllEADData;
  appState.getAllEADData = getAllEADData;

  appState.setAllLossData = setAllLossData;
  appState.getAllLossData = getAllLossData;

  return {
    setAllCvarData,
    getAllCvarData,
    setAllEADData,
    getAllEADData,
    setAllLossData,
    getAllLossData,
  };
}
