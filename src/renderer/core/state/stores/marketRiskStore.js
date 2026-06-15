// src/renderer/core/state/marketRiskStore.js
// State-only: MVaR input/agg + Dist cache + Product cache (with filtering helpers)

export function installMarketRiskStore({ appState } = {}) {
  if (!appState) throw new Error('[marketRiskStore] appState fehlt');

  // IR Sensitivities (PV01 Tenor Risk)

  // function setIRSensData(rows) {
  //   appState.irSensDataAll = Array.isArray(rows) ? rows : [];
  // }

function setIRSensData(rows) {

  if (!Array.isArray(rows) || rows.length === 0) {
    appState.irSensDataAll = [];
    return;
  }

  // 🔑 Wenn Daten schon transformiert sind → direkt speichern
  if ('TENOR' in rows[0] && 'VALUE_LOCAL' in rows[0]) {
    appState.irSensDataAll = rows;
    return;
  }

  const result = [];

  rows.forEach(row => {

    for (let i = 1; i <= 30; i++) {

      const value = Number(row[`${i}_LOCAL`]) || 0;

      if (value !== 0) {

        result.push({
          port_name: row.port_name,
          ASOF_DATE: row.ASOF_DATE,
          TENOR: i,
          VALUE_LOCAL: value
        });

      }

    }

  });

  appState.irSensDataAll = result;
}

  function getIRSensData({ port_name, asof_date } = {}) {

    const all = Array.isArray(appState.irSensDataAll)
      ? appState.irSensDataAll
      : [];

    if (!port_name && !asof_date) return all;

    const port = String(port_name ?? '').trim();
    const asof = asof_date ? String(asof_date).slice(0,10) : null;

    let matches = all.filter(r =>
      r &&
      (!port || r.port_name === port)
    );

    if (!matches.length) return [];

    if (asof) {
      return matches.filter(r => String(r.ASOF_DATE).slice(0,10) === asof);
    }

    // latest snapshot
    let latest = null;
    for (const r of matches) {
      const d = String(r.ASOF_DATE ?? '').slice(0,10);
      if (!d) continue;
      if (latest === null || d > latest) latest = d;
    }

    if (!latest) return [];

    return matches.filter(r => String(r.ASOF_DATE).slice(0,10) === latest);
  }

  // basic
  function setMvarInputData(data) { appState.mvarInputData = data; }
  function getMvarInputData() { return appState.mvarInputData; }

  function setMvarData(data) { appState.mvarData = data; }
  function getMvarData() { return appState.mvarData; }

  function setAllMvarData(data) { appState.AllMvarData = Array.isArray(data) ? data : []; }
  function getAllMvarData() { return Array.isArray(appState.AllMvarData) ? appState.AllMvarData : []; }

  // Dist cache
  function setMvarDistData(rows) {
    const arr = Array.isArray(rows) ? rows : [];
    if (!Array.isArray(appState.mvarDistDataAll)) appState.mvarDistDataAll = [];
    appState.mvarDistDataAll = appState.mvarDistDataAll.concat(arr);
  }

  function getMvarDistData({ port_name, scenario_name, asof_date } = {}) {
    const all = Array.isArray(appState.mvarDistDataAll) ? appState.mvarDistDataAll : [];
    if (!port_name && !scenario_name && !asof_date) return all;

    const port = String(port_name ?? '').trim();
    const scen = String(scenario_name ?? '').trim();
    const asof = asof_date ? String(asof_date).slice(0, 10) : null;

    let matches = all.filter(r =>
      r &&
      (!port || r.port_name === port) &&
      (!scen || r.scenario_name === scen)
    );
    if (!matches.length) return [];

    if (asof) {
      return matches.filter(r => String(r.asof_date).slice(0, 10) === asof);
    }

    let latestAsof = null;
    for (const r of matches) {
      const d = String(r.asof_date ?? '').slice(0, 10);
      if (!d) continue;
      if (latestAsof === null || d > latestAsof) latestAsof = d;
    }
    if (!latestAsof) return [];
    return matches.filter(r => String(r.asof_date).slice(0, 10) === latestAsof);
  }

  // Product cache (upsert)
  function setMvarProductData(rows) {
    appState.mvarProductDataAll = Array.isArray(rows) ? rows : [];

    console.log('[marketRiskStore] setMvarProductData REPLACED', {
      rows: appState.mvarProductDataAll.length,
      sample: appState.mvarProductDataAll[0],
    });
  }

  function getMvarProductData({ port_name, scenario_name, asof_date } = {}) {
    const all = Array.isArray(appState.mvarProductDataAll) ? appState.mvarProductDataAll : [];
    if (!port_name && !scenario_name && !asof_date) return all;

    const port = String(port_name ?? '').trim();
    const scen = String(scenario_name ?? '').trim();
    const asof = asof_date ? String(asof_date).slice(0, 10) : null;

    let matches = all.filter(r =>
      r &&
      (!port || r.port_name === port) &&
      (!scen || r.scenario_name === scen)
    );
    if (!matches.length) return [];

    if (asof) {
      return matches.filter(r => String(r.asof_date).slice(0, 10) === asof);
    }

    let latestAsof = null;
    for (const r of matches) {
      const d = String(r.asof_date ?? '').slice(0, 10);
      if (!d) continue;
      if (latestAsof === null || d > latestAsof) latestAsof = d;
    }
    if (!latestAsof) return [];
    return matches.filter(r => String(r.asof_date).slice(0, 10) === latestAsof);
  }

  // Factor P/L cache (upsert)
  function setMvarFactorPLData(rows) {
    const arr = Array.isArray(rows) ? rows : [];

    if (!Array.isArray(appState.mvarFactorPLDataAll)) {
      appState.mvarFactorPLDataAll = [];
    }

    const getRowDate = (r) => {
      return String(
        r?.dt ??
        r?.DT ??
        r?.DATE ??
        r?.date ??
        r?.scenario_date ??
        r?.SCENARIO_DATE ??
        ''
      ).slice(0, 10);
    };

    const makeKey = (r) => {
      const port = String(r?.port_name ?? r?.PORT_NAME ?? '').trim();
      const scen = String(r?.scenario_name ?? r?.SCENARIO_NAME ?? '').trim();
      const asof = String(r?.asof_date ?? r?.ASOF_DATE ?? '').slice(0, 10);

      const date = getRowDate(r);

      const factor = String(
        r?.factor_id ??
        r?.FACTOR_ID ??
        r?.risk_factor_id ??
        r?.RISK_FACTOR_ID ??
        ''
      ).trim();

      return `${port}||${scen}||${asof}||${date}||${factor}`;
    };

    const existing = appState.mvarFactorPLDataAll;
    const idxByKey = new Map();

    for (let i = 0; i < existing.length; i++) {
      const k = makeKey(existing[i]);

      if (!idxByKey.has(k)) {
        idxByKey.set(k, i);
      }
    }

    let inserted = 0;
    let updated = 0;
    let skipped = 0;

    for (const r of arr) {
      if (!r) {
        skipped += 1;
        continue;
      }

      const k = makeKey(r);

      const hasValidKey =
        k &&
        !k.includes('||||') &&
        getRowDate(r);

      if (!hasValidKey) {
        skipped += 1;

        console.warn('[marketRiskStore] setMvarFactorPLData skipped row with invalid key', {
          row: r,
          key: k,
          rowDate: getRowDate(r),
        });

        continue;
      }

      const idx = idxByKey.get(k);

      if (idx === undefined) {
        existing.push(r);
        idxByKey.set(k, existing.length - 1);
        inserted += 1;
      } else {
        existing[idx] = r;
        updated += 1;
      }
    }

    appState.mvarFactorPLDataAll = existing;

    const allDates = new Set(
      existing.map(r => getRowDate(r)).filter(Boolean)
    );

    const allAsofDates = new Set(
      existing.map(r => String(r?.asof_date ?? r?.ASOF_DATE ?? '').slice(0, 10)).filter(Boolean)
    );

    const allFactors = new Set(
      existing.map(r =>
        String(
          r?.factor_id ??
          r?.FACTOR_ID ??
          r?.risk_factor_id ??
          r?.RISK_FACTOR_ID ??
          ''
        ).trim()
      ).filter(Boolean)
    );

    const allPorts = new Set(
      existing.map(r =>
        String(r?.port_name ?? r?.PORT_NAME ?? '').trim()
      ).filter(Boolean)
    );

    const allScenarios = new Set(
      existing.map(r =>
        String(r?.scenario_name ?? r?.SCENARIO_NAME ?? '').trim()
      ).filter(Boolean)
    );

    console.log('[marketRiskStore] setMvarFactorPLData UPSERTED', {
      receivedRows: arr.length,
      inserted,
      updated,
      skipped,

      storeRows: appState.mvarFactorPLDataAll.length,

      uniquePorts: allPorts.size,
      uniqueScenarios: allScenarios.size,
      uniqueAsofDates: allAsofDates.size,
      uniqueDates: allDates.size,
      uniqueFactors: allFactors.size,

      sampleReceived: arr[0],
      sampleStored: appState.mvarFactorPLDataAll[0],
    });
  }

  function getMvarFactorPLData({ port_name, scenario_name, asof_date } = {}) {
    const all = Array.isArray(appState.mvarFactorPLDataAll)
      ? appState.mvarFactorPLDataAll
      : [];

    if (!port_name && !scenario_name && !asof_date) return all;

    const port = String(port_name ?? '').trim();
    const scen = String(scenario_name ?? '').trim();
    const asof = asof_date ? String(asof_date).slice(0, 10) : null;

    let matches = all.filter(r => {
      const rowPort = String(r?.port_name ?? r?.PORT_NAME ?? '').trim();
      const rowScen = String(r?.scenario_name ?? r?.SCENARIO_NAME ?? '').trim();

      return (
        r &&
        (!port || rowPort === port) &&
        (!scen || rowScen === scen)
      );
    });

    if (!matches.length) return [];

    if (asof) {
      return matches.filter(r =>
        String(r?.asof_date ?? r?.ASOF_DATE ?? '').slice(0, 10) === asof
      );
    }

    let latestAsof = null;

    for (const r of matches) {
      const d = String(r?.asof_date ?? r?.ASOF_DATE ?? '').slice(0, 10);
      if (!d) continue;
      if (latestAsof === null || d > latestAsof) latestAsof = d;
    }

    if (!latestAsof) return [];

    return matches.filter(r =>
      String(r?.asof_date ?? r?.ASOF_DATE ?? '').slice(0, 10) === latestAsof
    );
  }

    // Factor Series Map cache
  function setMarketVarFactorSeriesMap(rows) {
    appState.marketVarFactorSeriesMap = Array.isArray(rows) ? rows : [];

    console.log('[marketRiskStore] setMarketVarFactorSeriesMap', {
      rows: appState.marketVarFactorSeriesMap.length,
      sample: appState.marketVarFactorSeriesMap[0],
    });
  }

  function getMarketVarFactorSeriesMap() {
    return Array.isArray(appState.marketVarFactorSeriesMap)
      ? appState.marketVarFactorSeriesMap
      : [];
  }










  // expose

  appState.setIRSensData = setIRSensData;
  appState.getIRSensData = getIRSensData;

  appState.setMvarInputData = setMvarInputData;
  appState.getMvarInputData = getMvarInputData;

  appState.setMvarData = setMvarData;
  appState.getMvarData = getMvarData;

  appState.setAllMvarData = setAllMvarData;
  appState.getAllMvarData = getAllMvarData;

  appState.setMvarDistData = setMvarDistData;
  appState.getMvarDistData = getMvarDistData;

  appState.setMvarProductData = setMvarProductData;
  appState.getMvarProductData = getMvarProductData;

  appState.setMvarFactorPLData = setMvarFactorPLData;
  appState.getMvarFactorPLData = getMvarFactorPLData;

  appState.setMarketVarFactorSeriesMap = setMarketVarFactorSeriesMap;
  appState.getMarketVarFactorSeriesMap = getMarketVarFactorSeriesMap;

  return {
    setIRSensData,
    getIRSensData,
    setAllMvarData,
    getAllMvarData,
    setMvarDistData,
    getMvarDistData,
    setMvarProductData,
    getMvarProductData,
    setMvarFactorPLData,
    getMvarFactorPLData,
    setMarketVarFactorSeriesMap,
    getMarketVarFactorSeriesMap,
  };
}
