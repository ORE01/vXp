// src/renderer/core/state/marketDataStore.js

// Verantwortlich für MarketData State (EUSW, Curve Selection, Swaption, TS).
// Minimal-invasiv: hängt Methoden an appState (Backwards compatible).

// =====================================================
// DEBUG SWITCH
// =====================================================
const MARKET_DATA_STORE_DEBUG = false; // true = Logs EIN / false = Logs AUS

function log(...args) {
  if (MARKET_DATA_STORE_DEBUG) console.log(...args);
}

function warn(...args) {
  console.warn(...args); // Warnungen bleiben sichtbar
}

function error(...args) {
  console.error(...args); // Errors bleiben sichtbar
}

export function installMarketDataStore({ appState } = {}) {
  if (!appState) throw new Error('[marketDataStore] appState fehlt');

  if (!appState._RATESDataCacheByCcy) {
    appState._RATESDataCacheByCcy = {};
  }

  if (!appState._scenarioDefinitions) {
    appState._scenarioDefinitions = {
      BASE: { type: 'BASE' },
    };
  }

  // =====================================================
  // STORAGE
  // =====================================================

  function setEUSWData(data) {
    if (Array.isArray(data) && data.length > 0) {
      warn('[MarketDataStore] LEGACY EUSW received');
      appState._EUSWDataCache = data;
      appState._EUSWLastGoodCache = data;
    }
  }

  function setRATESData(data) {
    log('✅ setRATESData called');
    log('rows:', Array.isArray(data) ? data.length : 'NOT ARRAY');
    log('sample:', data?.[0]);

    if (!Array.isArray(data) || data.length === 0) {
      warn('[MarketDataStore] empty RATES dataset');
      return;
    }

    appState._RATESDataCacheByCcy = {};
    appState._RATESDataCache = data;

    for (const row of data) {
      const ccy = row.ccy;

      if (!ccy) {
        warn('[MarketDataStore] Missing ccy in RATES row', row);
        continue;
      }

      if (!appState._RATESDataCacheByCcy[ccy]) {
        appState._RATESDataCacheByCcy[ccy] = [];
      }

      appState._RATESDataCacheByCcy[ccy].push(row);
    }

    document.dispatchEvent(new CustomEvent('interestRates:updated'));

    log('Buckets:', appState._RATESDataCacheByCcy);
  }

  // =====================================================
  // ADAPTER
  // RATES → OLD EUSW STRUCTURE
  // =====================================================

  function adaptRatesToEUSW(rates) {
    const sample = rates?.[0];

    if (!sample) {
      warn('[MarketDataStore] RATES empty');
      return [];
    }

    if (!('tenor' in sample) && !('YEAR' in sample)) {
      error('[MarketDataStore] Invalid RATES structure', sample);
      return [];
    }

    return rates.map((r) => ({
      YEAR: r.tenor ?? r.YEAR,
      EUSWAP: Number(r.rate ?? r.RATES ?? r.value ?? 0),
    }));
  }

  // =====================================================
  // SINGLE PUBLIC ACCESS POINT
  // =====================================================

  function getEUSWData(ccy) {
    const currency = ccy || 'EUR';

    if (
      appState._RATESDataCacheByCcy &&
      Array.isArray(appState._RATESDataCacheByCcy[currency]) &&
      appState._RATESDataCacheByCcy[currency].length > 0
    ) {
      log(`[MarketDataStore] Using RATES adapter for ${currency}`);

      const activeScenario =
        appState._RATES_ACTIVE?.find((r) => r.ccy === currency)?.scenario_id ||
        'BASE';

      const filtered = appState._RATESDataCacheByCcy[currency].filter(
        (r) => (r.scenario_id || 'BASE') === activeScenario
      );

      return adaptRatesToEUSW(filtered);
    }

    if (
      Array.isArray(appState._RATESDataCache) &&
      appState._RATESDataCache.length > 0
    ) {
      log('[MarketDataStore] Using global fallback');
      return adaptRatesToEUSW(appState._RATESDataCache);
    }

    if (
      Array.isArray(appState._EUSWDataCache) &&
      appState._EUSWDataCache.length > 0
    ) {
      return appState._EUSWDataCache;
    }

    log('[MarketDataStore] IR data not ready');
    return [];
  }

  function setRatesScenarioData(data) {
    appState._RATES_SCENARIO_DATA = Array.isArray(data) ? data : [];
  }

  function getRatesScenarioData() {
    return appState._RATES_SCENARIO_DATA || [];
  }

  function setRatesActive(data) {
    appState._RATES_ACTIVE = Array.isArray(data) ? data : [];
  }

  function getRatesActive() {
    return appState._RATES_ACTIVE || [];
  }

  // -----------------------------
  // Scenario Definitions
  // -----------------------------

  function addScenarioDefinition(name, config) {
    if (!name || !config) return;
    appState._scenarioDefinitions[name] = config;
  }

  function getScenarioDefinitions() {
    return appState._scenarioDefinitions || {};
  }

  // -----------------------------
  // Selected Curve
  // -----------------------------

  function setSelectedCurve(curve) {
    appState._selectedCurveCache = String(curve || 'EUSWAP');
  }

  function getSelectedCurve() {
    return String(appState._selectedCurveCache || 'EUSWAP');
  }

  function getEUSWDataWithSelectedCurve() {
    const curve = getSelectedCurve();

    return getEUSWData().map((row) => {
      const r = { ...row };
      r.RATES = r[curve];
      return r;
    });
  }

  // -----------------------------
  // CS_PARAMETER
  // -----------------------------

  function setCSData(data) {
    const rows = Array.isArray(data) ? data : [];

    log('[CSParameter][STORE] setCSData called');
    log('[CSParameter][STORE] rows:', rows.length);

    if (rows.length > 0) {
      log('[CSParameter][STORE] sample:', rows[0]);
    } else {
      warn('[CSParameter][STORE] ⚠️ EMPTY DATA RECEIVED');
    }

    appState._CSData = rows;
  }

  function getCSData() {
    return appState._CSData || [];
  }

  function setCSActive(data) {
    const rows = Array.isArray(data) ? data : [];

    log('[CS][STORE] setCSActive rows:', rows.length);
    log('[CS][STORE] ACTIVE raw:', rows);

    appState._CS_ACTIVE = rows;

    const latest = [...rows].sort(
      (a, b) => new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
    )[0];

    log('[CS][STORE] ACTIVE scenario:', latest?.scenario_name);
  }

  function getCSActive() {
    return appState._CS_ACTIVE || [];
  }

  // -----------------------------
  // CS_DATA
  // -----------------------------

  function setCSBaseData(data) {
  appState._CS_BASE = Array.isArray(data) ? data : [];
  }

  function getCSBaseData() {
    return appState._CS_BASE || [];
  }

  function setCSScenarioData(data) {
    appState._CS_SCENARIO_DATA = Array.isArray(data) ? data : [];
  }

  function getCSScenarioData() {
    return appState._CS_SCENARIO_DATA || [];
  }

  // -----------------------------
  // PD HISTORICAL (Track A: BASE = PD_RATING_HISTORICAL, Szenarien, Active)
  // -----------------------------
  function setPDHistBaseData(data) {
    appState._PD_RATING_HISTORICAL = Array.isArray(data) ? data : [];
  }
  function getPDHistBaseData() {
    return appState._PD_RATING_HISTORICAL || [];
  }

  function setPDHistScenarioData(data) {
    appState._PD_HIST_SCENARIO_DATA = Array.isArray(data) ? data : [];
  }
  function getPDHistScenarioData() {
    return appState._PD_HIST_SCENARIO_DATA || [];
  }

  function setPDHistActive(data) {
    appState._PD_HIST_ACTIVE = Array.isArray(data) ? data : [];
  }
  function getPDHistActive() {
    return appState._PD_HIST_ACTIVE || [];
  }

  // -----------------------------
  // TS Data
  // -----------------------------

  function setTblTSData(data) {
    appState.tblTSData = Array.isArray(data) ? data : [];
    // Signal: tblTS-Faktoren sind (neu) verfügbar — Panels mit Faktor-Dropdowns/
    // -Charts (z.B. MVaR Factor Series Mapping) können sich nachladen.
    try {
      if (appState.tblTSData.length && typeof document !== 'undefined') {
        document.dispatchEvent(new Event('tblts:ready'));
      }
    } catch {}
  }

  function getTblTSData() {
    return Array.isArray(appState.tblTSData) ? appState.tblTSData : [];
  }

  // -----------------------------
  // Swaption
  // -----------------------------

  function setSwaptionAtmBase(rows) {
    appState._SWAPTION_ATM_BASE = Array.isArray(rows) ? rows : [];
  }

  function getSwaptionAtmBase() {
    return appState._SWAPTION_ATM_BASE || [];
  }

  function setSwaptionSmileBase(rows) {
    appState._SWAPTION_SMILE_BASE = Array.isArray(rows) ? rows : [];
  }

  function getSwaptionSmileBase() {
    return appState._SWAPTION_SMILE_BASE || [];
  }

  function setSwaptionAtmScenarioData(rows) {
    appState._SWAPTION_ATM_SCENARIO_DATA = Array.isArray(rows) ? rows : [];
  }

  function getSwaptionAtmScenarioData() {
    return appState._SWAPTION_ATM_SCENARIO_DATA || [];
  }

  function setSwaptionSmileScenarioData(rows) {
    appState._SWAPTION_SMILE_SCENARIO_DATA = Array.isArray(rows) ? rows : [];
  }

  function getSwaptionSmileScenarioData() {
    return appState._SWAPTION_SMILE_SCENARIO_DATA || [];
  }

  function setSwaptionActive(rows) {
    appState._SWAPTION_ACTIVE = Array.isArray(rows) ? rows : [];
  }

  function getSwaptionActive() {
    return appState._SWAPTION_ACTIVE || [];
  }

  function getSwaptionATMByTenor(optionTenor, swapTenor) {
    const arr = Array.isArray(appState.swaptionATM)
      ? appState.swaptionATM
      : [];

    return arr.filter(
      (r) => r.option_tenor === optionTenor && r.swap_tenor === swapTenor
    );
  }

  function getSwaptionSmileByNode(optionTenor, swapTenor) {
    const arr = Array.isArray(appState.swaptionSmile)
      ? appState.swaptionSmile
      : [];

    return arr.filter(
      (r) => r.option_tenor === optionTenor && r.swap_tenor === swapTenor
    );
  }

function setSwaptionCubeSurface(cubeGrid) {
  const isLegacy =
    cubeGrid &&
    Array.isArray(cubeGrid.optionTenors) &&
    Array.isArray(cubeGrid.swapTenors) &&
    Array.isArray(cubeGrid.volMatrix);

  const isMulti =
    cubeGrid &&
    Array.isArray(cubeGrid.surfaces) &&
    cubeGrid.surfaces.length > 0;

  if (!isLegacy && !isMulti) {
    warn('[marketDataStore.setSwaptionCubeSurface] Ungültiges cubeGrid:', cubeGrid);
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

  appState.setRATESData = setRATESData;
  appState.setRatesScenarioData = setRatesScenarioData;
  appState.getRatesScenarioData = getRatesScenarioData;
  appState.getEUSWData = getEUSWData;

  appState.setRatesActive = setRatesActive;
  appState.getRatesActive = getRatesActive;

  appState.setSelectedCurve = setSelectedCurve;
  appState.getSelectedCurve = getSelectedCurve;
  appState.getEUSWDataWithSelectedCurve = getEUSWDataWithSelectedCurve;

  appState.setCSData = setCSData;
  appState.getCSData = getCSData;

  
  appState.setCSActive = setCSActive;
  appState.getCSActive = getCSActive;

  appState.setCSBaseData = setCSBaseData;
  appState.getCSBaseData = getCSBaseData;

  appState.setCSScenarioData = setCSScenarioData;
  appState.getCSScenarioData = getCSScenarioData;

  appState.setPDHistBaseData = setPDHistBaseData;
  appState.getPDHistBaseData = getPDHistBaseData;
  appState.setPDHistScenarioData = setPDHistScenarioData;
  appState.getPDHistScenarioData = getPDHistScenarioData;
  appState.setPDHistActive = setPDHistActive;
  appState.getPDHistActive = getPDHistActive;





  appState.setTblTSData = setTblTSData;
  appState.getTblTSData = getTblTSData;

  appState.setSwaptionAtmBase = setSwaptionAtmBase;
  appState.getSwaptionAtmBase = getSwaptionAtmBase;
  appState.setSwaptionSmileBase = setSwaptionSmileBase;
  appState.getSwaptionSmileBase = getSwaptionSmileBase;

  appState.setSwaptionAtmScenarioData = setSwaptionAtmScenarioData;
  appState.getSwaptionAtmScenarioData = getSwaptionAtmScenarioData;
  appState.setSwaptionSmileScenarioData = setSwaptionSmileScenarioData;
  appState.getSwaptionSmileScenarioData = getSwaptionSmileScenarioData;

  appState.setSwaptionActive = setSwaptionActive;
  appState.getSwaptionActive = getSwaptionActive;
  appState.getSwaptionATMByTenor = getSwaptionATMByTenor;
  appState.getSwaptionSmileByNode = getSwaptionSmileByNode;
  appState.setSwaptionCubeSurface = setSwaptionCubeSurface;
  appState.getSwaptionCubeSurface = getSwaptionCubeSurface;

  appState.addScenarioDefinition = addScenarioDefinition;
  appState.getScenarioDefinitions = getScenarioDefinitions;



  if (!appState._selectedCurveCache) {
    appState._selectedCurveCache = 'EUSWAP';
  }



    return {
    setEUSWData,

    setRATESData,
    setRatesScenarioData,
    getRatesScenarioData,
    getEUSWData,

    setSelectedCurve,
    getSelectedCurve,
    getEUSWDataWithSelectedCurve,

    setCSData,
    getCSData,

    setCSActive,
    getCSActive,
    setCSBaseData,
    getCSBaseData,
    setCSScenarioData,
    getCSScenarioData,

    setPDHistBaseData,
    getPDHistBaseData,
    setPDHistScenarioData,
    getPDHistScenarioData,
    setPDHistActive,
    getPDHistActive,

    setTblTSData,
    getTblTSData,

    setSwaptionAtmBase,
    getSwaptionAtmBase,
    setSwaptionSmileBase,
    getSwaptionSmileBase,

    setSwaptionAtmScenarioData,
    getSwaptionAtmScenarioData,
    setSwaptionSmileScenarioData,
    getSwaptionSmileScenarioData,

    setSwaptionActive,
    getSwaptionActive,

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







