// FRONT_END/ANALYSE_PORTFOLIO/analysePortfolioHandlers.js

export function createAnalysePortfolioHandlers({
  appState,

  // view renderers / feature funcs
  handleMVaRData,
  handleCVaRData,
  handleEADData,
  handleLossIssuerMainData,

  // input views
  handleCvarInput,
  handleCvarInputThresholdView,
} = {}) {
  if (!appState) throw new Error('[createAnalysePortfolioHandlers] appState missing');

  // ---------- Market VaR ----------
  function handleAllMVaRData(receivedData) {
    appState.setAllMvarData?.(receivedData);
    // rendert selbst (wie bei dir)
    handleMVaRData?.(receivedData, 0);
  }

  function handleMvarDistData(receivedData) {
    appState.setMvarDistData?.(receivedData);
  }

  function handleMvarProductData(receivedData) {
    appState.setMvarProductData?.(receivedData);
  }

  // ---------- Credit VaR input ----------
  function initHandleCvarInput(receivedData) {
    appState.setCvarInput?.(receivedData);
    handleCvarInput?.();
  }

  function handleCvarInputThreshold(receivedData) {
    appState.setCvarInputThreshold?.(receivedData);
    handleCvarInputThresholdView?.();
  }

  // ---------- Credit VaR results ----------
  function handleAllCVaRData(receivedData) {
    appState.setAllCvarData?.(receivedData);
    handleCVaRData?.(receivedData, 0);
  }

  function handleAllEADData(receivedData) {
    if (!receivedData || receivedData.length === 0) {
      console.warn('⚠️ No EAD data received!');
      appState.setAllEADData?.([]);
      return;
    }
    appState.setAllEADData?.(receivedData);
    handleEADData?.(receivedData);
  }

  function handleAllLossData(receivedData) {
    if (!receivedData || receivedData.length === 0) {
      console.warn('⚠️ No LOSS data received!');
      appState.setAllLossData?.([]);
      return;
    }
    appState.setAllLossData?.(receivedData);
    handleLossIssuerMainData?.(receivedData);
  }

  // ---------- Portfolio history ----------
  function handlePortfolioHistoryData(receivedData) {
    appState.setPortfolioHistoryData?.(receivedData);
    // Nach jedem (Neu-)Laden der PortfolioHistoryMetrics (u.a. nach "Save to Historic
    // Metrics" -> requestTableRefreshAfterMutation -> fetch-table-data) alle darauf
    // basierenden Charts refreshen. Entkoppelt via Event -> historicRiskMetrics.js.
    try { document.dispatchEvent(new CustomEvent('portfolio-history-updated')); } catch {}
  }

  return {
    // Market
    handleAllMVaRData,
    handleMvarDistData,
    handleMvarProductData,

    // Credit inputs
    initHandleCvarInput,
    handleCvarInputThreshold,

    // Credit outputs
    handleAllCVaRData,
    handleAllEADData,
    handleAllLossData,

    // History
    handlePortfolioHistoryData,
  };
}
