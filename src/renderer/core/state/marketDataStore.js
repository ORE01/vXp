// src/renderer/core/state/marketDataStore.js
// Verantwortlich für MarketData State (EUSW, Curve Selection, Swaption, TS).
// Minimal-invasiv: hängt Methoden an appState (Backwards compatible).

export function installMarketDataStore({ appState } = {}) {
  if (!appState) throw new Error('[marketDataStore] appState fehlt');

  if (!appState._RATESDataCacheByCcy) {
  appState._RATESDataCacheByCcy = {};
}

// =====================================================
// SCENARIO DEFINITIONS (Central Truth)
// =====================================================



  // =====================================================
  // STORAGE
  // =====================================================

  function setEUSWData(data) {
    if (Array.isArray(data) && data.length > 0) {
      console.warn('[MarketDataStore] LEGACY EUSW received');
      appState._EUSWDataCache = data;
      appState._EUSWLastGoodCache = data;
    }
  }

  function setRATESData(data) {
    console.log('✅ setRATESData called');
    console.log('rows:', Array.isArray(data) ? data.length : 'NOT ARRAY');
    console.log('sample:', data?.[0]);

    if (!Array.isArray(data) || data.length === 0) {
      console.warn('[MarketDataStore] empty RATES dataset');
      return;
    }

    // 🔄 Reset currency buckets
    appState._RATESDataCacheByCcy = {};

    // ✅ DATA ENTERS LEGACY STATE (backwards compatible)
    appState._RATESDataCache = data;

    // 🔎 Segment by currency
    for (const row of data) {
      const ccy = row.ccy;

      if (!ccy) {
        console.warn('[MarketDataStore] Missing ccy in RATES row', row);
        continue;
      }

      if (!appState._RATESDataCacheByCcy[ccy]) {
        appState._RATESDataCacheByCcy[ccy] = [];
      }

      if (!appState._scenarioDefinitions) {
        appState._scenarioDefinitions = {
          BASE: { type: "BASE" }
        };
      }

      appState._RATESDataCacheByCcy[ccy].push(row);
    }

    // ✅ SYSTEM EVENT — DATA IS NOW READY (unchanged)
    document.dispatchEvent(
      new CustomEvent('interestRates:updated')
    );

    console.log('Buckets:', appState._RATESDataCacheByCcy);
  }

  // =====================================================
  // ADAPTER
  // RATES → OLD EUSW STRUCTURE
  // =====================================================

  function adaptRatesToEUSW(rates) {

    const sample = rates?.[0];

    if (!sample) {
      console.warn('[MarketDataStore] RATES empty');
      return [];
    }

    if (!('tenor' in sample) && !('YEAR' in sample)) {
      console.error('[MarketDataStore] Invalid RATES structure', sample);
      return [];
    }

    return rates.map(r => ({
      YEAR: r.tenor ?? r.YEAR,
      EUSWAP: Number(
        r.rate ??
        r.RATES ??
        r.value ??
        0
      )
    }));
  }

  // =====================================================
  // SINGLE PUBLIC ACCESS POINT
  // =====================================================

function getEUSWData(ccy) {

  const currency = ccy || 'EUR';

  // ✅ NEW WORLD (currency segmented)
  if (
    appState._RATESDataCacheByCcy &&
    Array.isArray(appState._RATESDataCacheByCcy[currency]) &&
    appState._RATESDataCacheByCcy[currency].length > 0
  ) {
    console.warn(`[MarketDataStore] Using RATES adapter for ${currency}`);



const activeScenario =
  appState._RATES_ACTIVE?.find(r => r.ccy === currency)?.scenario_id
  || 'BASE';

const filtered =
  appState._RATESDataCacheByCcy[currency]
    .filter(r => (r.scenario_id || 'BASE') === activeScenario);




    return adaptRatesToEUSW(filtered);
  }

  // ✅ LEGACY FALLBACK
  if (
    Array.isArray(appState._RATESDataCache) &&
    appState._RATESDataCache.length > 0
  ) {
    console.warn('[MarketDataStore] Using global fallback');
    return adaptRatesToEUSW(appState._RATESDataCache);
  }

  if (
    Array.isArray(appState._EUSWDataCache) &&
    appState._EUSWDataCache.length > 0
  ) {
    return appState._EUSWDataCache;
  }

  console.warn('[MarketDataStore] IR data not ready');
  return [];
}

function setRatesActive(data) {
  appState._RATES_ACTIVE = Array.isArray(data) ? data : [];
}

function getRatesActive() {
  return appState._RATES_ACTIVE || [];
}

// -----------------------------
// Scenario Definitions (Central Truth)
// -----------------------------
function addScenarioDefinition(name, config) {
  if (!name || !config) return;
  appState._scenarioDefinitions[name] = config;
}

function getScenarioDefinitions() {
  return appState._scenarioDefinitions || {};
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
  appState.setRATESData = setRATESData;
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
  appState.addScenarioDefinition = addScenarioDefinition;
  appState.getScenarioDefinitions = getScenarioDefinitions;
  appState.setRatesActive = setRatesActive;
  appState.getRatesActive = getRatesActive;

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
    addScenarioDefinition,
    getScenarioDefinitions,
    setRatesActive,
    getRatesActive,
  };
}
