
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

  // ASRF-Issuer-Analyse (analytisches Modell, ASRF_IssuerAnalysis). Nur bei ASRF-Laeufen
  // befuellt; MF_GC schreibt diese Tabelle nicht -> bleibt leer, kein Einfluss auf MF_GC.
  function setAsrfIssuerAnalysis(data) { appState.asrfIssuerAnalysisData = Array.isArray(data) ? data : []; }
  function getAsrfIssuerAnalysis() { return Array.isArray(appState.asrfIssuerAnalysisData) ? appState.asrfIssuerAnalysisData : []; }

  // ASRF-Portfolio-Summary (ASRF_Summary): EL/VaR/ES/EC + rel + Confidence/Z fuers KPI-Band.
  function setAsrfSummary(data) { appState.asrfSummaryData = Array.isArray(data) ? data : []; }
  function getAsrfSummary() { return Array.isArray(appState.asrfSummaryData) ? appState.asrfSummaryData : []; }

  // ASRF-Tail-Loss-Kurve (ASRF_TailCurve): Loss je Standard-Quantil, je pd_flag.
  function setAsrfTailCurve(data) { appState.asrfTailCurveData = Array.isArray(data) ? data : []; }
  function getAsrfTailCurve() { return Array.isArray(appState.asrfTailCurveData) ? appState.asrfTailCurveData : []; }

  // ASRF-Loss-Verteilung (ASRF_LossHistogram): analytisches Histogramm, je pd_flag.
  function setAsrfLossHistogram(data) { appState.asrfLossHistogramData = Array.isArray(data) ? data : []; }
  function getAsrfLossHistogram() { return Array.isArray(appState.asrfLossHistogramData) ? appState.asrfLossHistogramData : []; }

  // MF-GC Importance-Sampling: gewichtete Tail-/ES-Contributions je Issuer (MFGC_IssuerTail).
  // Nur im IS-Pfad befuellt; Standard-MF_GC schreibt diese Tabelle nicht -> bleibt leer.
  function setMfgcIssuerTail(data) { appState.mfgcIssuerTailData = Array.isArray(data) ? data : []; }
  function getMfgcIssuerTail() { return Array.isArray(appState.mfgcIssuerTailData) ? appState.mfgcIssuerTailData : []; }

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

  appState.setAsrfIssuerAnalysis = setAsrfIssuerAnalysis;
  appState.getAsrfIssuerAnalysis = getAsrfIssuerAnalysis;

  appState.setMfgcIssuerTail = setMfgcIssuerTail;
  appState.getMfgcIssuerTail = getMfgcIssuerTail;

  appState.setAsrfSummary = setAsrfSummary;
  appState.getAsrfSummary = getAsrfSummary;

  appState.setAsrfTailCurve = setAsrfTailCurve;
  appState.getAsrfTailCurve = getAsrfTailCurve;

  appState.setAsrfLossHistogram = setAsrfLossHistogram;
  appState.getAsrfLossHistogram = getAsrfLossHistogram;

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
