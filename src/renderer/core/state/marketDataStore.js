// FRONT_END/STATE/marketDataStore.js
// Verantwortlich für MarketData State (EUSW, Curve Selection, Swaption, TS).
// Minimal-invasiv: hängt Methoden an appState (Backwards compatible).

export function installMarketDataStore({ appState } = {}) {
  if (!appState) throw new Error('[marketDataStore] appState fehlt');

  // -----------------------------
  // EUSW (robuster Cache)
  // -----------------------------
  function setEUSWData(data) {
    if (Array.isArray(data) && data.length > 0) {
      appState._EUSWDataCache = data;
      appState._EUSWLastGoodCache = data;
    }
  }

  function getEUSWData() {
    if (Array.isArray(appState._EUSWDataCache) && appState._EUSWDataCache.length > 0) {
      return appState._EUSWDataCache;
    }
    if (Array.isArray(appState._EUSWLastGoodCache) && appState._EUSWLastGoodCache.length > 0) {
      return appState._EUSWLastGoodCache;
    }
    return [];
  }

  // -----------------------------
  // Selected Curve (nur EIN Mechanismus!)
  // -----------------------------
  function setSelectedCurve(curve) {
    appState._selectedCurveCache = String(curve || 'EUSWAP');
  }

  function getSelectedCurve() {
    return String(appState._selectedCurveCache || 'EUSWAP');
  }

  function getEUSWDataWithSelectedCurve() {
    const curve = getSelectedCurve();
    return getEUSWData().map(row => {
      const r = { ...row };
      r.RATES = r[curve];
      return r;
    });
  }

  // -----------------------------
  // TS Data
  // -----------------------------
  function setTblTSData(data) {
    appState.tblTSData = Array.isArray(data) ? data : [];
  }

  function getTblTSData() {
    return Array.isArray(appState.tblTSData) ? appState.tblTSData : [];
  }

  // -----------------------------
  // Swaption
  // -----------------------------
  function setSwaptionATM(rows) {
    appState.swaptionATM = Array.isArray(rows) ? rows : [];
  }

  function setSwaptionSmile(rows) {
    appState.swaptionSmile = Array.isArray(rows) ? rows : [];
  }

  function getSwaptionATMByTenor(optionTenor, swapTenor) {
    const arr = Array.isArray(appState.swaptionATM) ? appState.swaptionATM : [];
    return arr.filter(r => r.option_tenor === optionTenor && r.swap_tenor === swapTenor);
  }

  function getSwaptionSmileByNode(optionTenor, swapTenor) {
    const arr = Array.isArray(appState.swaptionSmile) ? appState.swaptionSmile : [];
    return arr.filter(r => r.option_tenor === optionTenor && r.swap_tenor === swapTenor);
  }

  function setSwaptionCubeSurface(cubeGrid) {
    if (
      !cubeGrid ||
      !Array.isArray(cubeGrid.optionTenors) ||
      !Array.isArray(cubeGrid.swapTenors) ||
      !Array.isArray(cubeGrid.volMatrix)
    ) {
      console.warn('[marketDataStore.setSwaptionCubeSurface] Ungültiges cubeGrid:', cubeGrid);
      appState.swaptionCubeSurface = null;
      return;
    }
    appState.swaptionCubeSurface = cubeGrid;
  }

  function getSwaptionCubeSurface() {
    return appState.swaptionCubeSurface || null;
  }

  // -----------------------------
  // Expose on appState
  // -----------------------------
  appState.setEUSWData = setEUSWData;
  appState.getEUSWData = getEUSWData;
  appState.setSelectedCurve = setSelectedCurve;
  appState.getSelectedCurve = getSelectedCurve;
  appState.getEUSWDataWithSelectedCurve = getEUSWDataWithSelectedCurve;

  appState.setTblTSData = setTblTSData;
  appState.getTblTSData = getTblTSData;

  appState.setSwaptionATM = setSwaptionATM;
  appState.setSwaptionSmile = setSwaptionSmile;
  appState.getSwaptionATMByTenor = getSwaptionATMByTenor;
  appState.getSwaptionSmileByNode = getSwaptionSmileByNode;
  appState.setSwaptionCubeSurface = setSwaptionCubeSurface;
  appState.getSwaptionCubeSurface = getSwaptionCubeSurface;

  // Default setzen, falls noch nicht vorhanden
  if (!appState._selectedCurveCache) appState._selectedCurveCache = 'EUSWAP';

  return {
    setEUSWData,
    getEUSWData,
    setSelectedCurve,
    getSelectedCurve,
    getEUSWDataWithSelectedCurve,
    setTblTSData,
    getTblTSData,
    setSwaptionATM,
    setSwaptionSmile,
    getSwaptionATMByTenor,
    getSwaptionSmileByNode,
    setSwaptionCubeSurface,
    getSwaptionCubeSurface,
  };
}
