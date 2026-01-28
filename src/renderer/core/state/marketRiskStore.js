// FRONT_END/STATE/marketRiskStore.js
// State-only: MVaR input/agg + Dist cache + Product cache (with filtering helpers)

export function installMarketRiskStore({ appState } = {}) {
  if (!appState) throw new Error('[marketRiskStore] appState fehlt');

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
    const arr = Array.isArray(rows) ? rows : [];
    if (!Array.isArray(appState.mvarProductDataAll)) appState.mvarProductDataAll = [];

    const makeKey = (r) => {
      const port = String(r?.port_name ?? '').trim();
      const scen = String(r?.scenario_name ?? '').trim();
      const asof = String(r?.asof_date ?? '').slice(0, 10);
      const pid =
        r?.prod_id ??
        r?.product_id ??
        r?.instrument_id ??
        r?.isin ??
        r?.ric ??
        r?.ticker ??
        r?.name ??
        '';
      return `${port}||${scen}||${asof}||${String(pid).trim()}`;
    };

    const existing = appState.mvarProductDataAll;
    const idxByKey = new Map();
    for (let i = 0; i < existing.length; i++) {
      const k = makeKey(existing[i]);
      if (!idxByKey.has(k)) idxByKey.set(k, i);
    }

    for (const r of arr) {
      if (!r) continue;
      const k = makeKey(r);
      const idx = idxByKey.get(k);
      if (idx === undefined) {
        existing.push(r);
        idxByKey.set(k, existing.length - 1);
      } else {
        existing[idx] = r;
      }
    }

    appState.mvarProductDataAll = existing;
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

  // expose
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

  return {
    setAllMvarData,
    getAllMvarData,
    setMvarDistData,
    getMvarDistData,
    setMvarProductData,
    getMvarProductData,
  };
}
