// ./MARKET_DATA/VOLS/swaptionDataHandlers.js

import { populateSwaptionCubeSelectors } from './volCube.js';

let swaptionCubeSelectorPopulateScheduled = false;

function schedulePopulateSwaptionCubeSelectors() {
  if (swaptionCubeSelectorPopulateScheduled) return;

  swaptionCubeSelectorPopulateScheduled = true;

  setTimeout(() => {
    swaptionCubeSelectorPopulateScheduled = false;

    try {
      populateSwaptionCubeSelectors();
    } catch (e) {
      console.warn('[swaptionDataHandlers] populateSwaptionCubeSelectors failed', e);
    }
  }, 0);
}

function parseTenorToYears(value) {
  if (typeof value !== 'string') return Number.POSITIVE_INFINITY;

  const match = value.trim().match(/^(\d+)\s*([MDWY])?$/i);
  if (!match) return Number.POSITIVE_INFINITY;

  const amount = Number.parseInt(match[1], 10);
  const unit = (match[2] || 'Y').toUpperCase();

  if (!Number.isFinite(amount)) return Number.POSITIVE_INFINITY;

  switch (unit) {
    case 'D': return amount / 365;
    case 'W': return (amount * 7) / 365;
    case 'M': return amount / 12;
    case 'Y':
    default: return amount;
  }
}

function sortTenors(tenors) {
  const safe = Array.isArray(tenors) ? tenors.filter(Boolean).map(String) : [];
  return [...new Set(safe)].sort((a, b) => parseTenorToYears(a) - parseTenorToYears(b));
}

function getSafeArray(rows) {
  return Array.isArray(rows) ? rows : [];
}

function replaceSelectOptions(selectEl, values) {
  if (!selectEl) return;

  const previousValue = selectEl.value;
  const safeValues = Array.isArray(values) ? values : [];

  selectEl.innerHTML = '';

  for (const value of safeValues) {
    const opt = document.createElement('option');
    opt.value = value;
    opt.textContent = value;
    selectEl.appendChild(opt);
  }

  if (previousValue && safeValues.includes(previousValue)) {
    selectEl.value = previousValue;
  } else if (safeValues.length > 0) {
    selectEl.value = safeValues[0];
  }
}

function extractUniqueSortedTenors(rows) {
  const optionSet = new Set();
  const swapSet = new Set();

  for (const row of getSafeArray(rows)) {
    if (row?.option_tenor != null && row.option_tenor !== '') {
      optionSet.add(String(row.option_tenor));
    }
    if (row?.swap_tenor != null && row.swap_tenor !== '') {
      swapSet.add(String(row.swap_tenor));
    }
  }

  return {
    optionTenors: sortTenors([...optionSet]),
    swapTenors: sortTenors([...swapSet]),
  };
}

function fillSwaptionDropdowns(optionTenors, swapTenors) {
  const optionSelect = document.getElementById('swaptionOptionTenorSelect');
  const swapSelect = document.getElementById('swaptionSwapTenorSelect');

  if (!optionSelect || !swapSelect) return;

  replaceSelectOptions(optionSelect, optionTenors);
  replaceSelectOptions(swapSelect, swapTenors);
}

function dispatchSwaptionEvent(eventName, detail = {}) {
  document.dispatchEvent(new CustomEvent(eventName, { detail }));
}

function normalizeAtmRows(rows) {
  return getSafeArray(rows)
    .map(row => ({
      ...row,
      ccy: String(row.ccy || 'EUR').trim().toUpperCase(),
      option_tenor: String(row.option_tenor || '').trim().toUpperCase(),
      swap_tenor: String(row.swap_tenor || '').trim().toUpperCase(),
      atm_vol: Number(row.atm_vol ?? row.vol),
      run_id: String(row.run_id || 'BASE').trim(),
      scenario_id: String(row.scenario_id || 'BASE').trim(),
    }))
    .filter(row =>
      row.ccy &&
      row.option_tenor &&
      row.swap_tenor &&
      Number.isFinite(row.atm_vol)
    );
}

function normalizeSmileRows(rows) {
  return getSafeArray(rows)
    .map(row => ({
      ...row,
      ccy: String(row.ccy || 'EUR').trim().toUpperCase(),
      strike_spread_bp: Number(
        row.strike_spread_bp ??
        row.StrikeSpreadBP ??
        row.strike_spread ??
        row.smile_key ??
        row.basispunkte_shift ??
        row.BasispunkteShift ??
        row.bp_shift ??
        row.BPShift ??
        row.shift_bp ??
        row.Shift_bp ??
        row.ShiftBP
      ),
      vol_spread: Number(
        row.vol_spread ??
        row.VolSpread ??
        row.adjustment ??
        row.vol_adjustment ??
        row.value ??
        row.vol_shift ??
        row.VolShift ??
        row.shift_vol ??
        row.ShiftVol
      ),
      run_id: String(row.run_id || 'BASE').trim(),
      scenario_id: String(row.scenario_id || 'BASE').trim(),
    }))
    .filter(row =>
      row.ccy &&
      Number.isFinite(row.strike_spread_bp) &&
      Number.isFinite(row.vol_spread)
    );
}

function buildAtmSurfaceGridFromRows(rows) {
  const safeRows = normalizeAtmRows(rows);
  if (!safeRows.length) return null;

  const optionTenors = sortTenors(safeRows.map(r => r.option_tenor));
  const swapTenors = sortTenors(safeRows.map(r => r.swap_tenor));

  const volMatrix = swapTenors.map(() => optionTenors.map(() => null));

  for (const r of safeRows) {
    const rowIdx = swapTenors.indexOf(r.swap_tenor);
    const colIdx = optionTenors.indexOf(r.option_tenor);

    if (rowIdx < 0 || colIdx < 0) continue;

    volMatrix[rowIdx][colIdx] = r.atm_vol;
  }

  return {
    isATM: true,
    strikeLabel: 'ATM',
    optionTenors,
    swapTenors,
    volMatrix,
    rows: safeRows,
  };
}

function buildCubeSurfaceGridFromActiveRows(atmRows, smileRows, meta = {}) {
  const atm = normalizeAtmRows(atmRows);
  const smile = normalizeSmileRows(smileRows);

  if (!atm.length || !smile.length) return null;

  const ccy = String(meta.ccy || 'EUR').trim().toUpperCase();
  const activeAtm = atm.filter(r => r.ccy === ccy);
  const activeSmile = smile.filter(r => r.ccy === ccy);

  if (!activeAtm.length || !activeSmile.length) return null;

  const optionTenors = sortTenors(activeAtm.map(r => r.option_tenor));
  const swapTenors = sortTenors(activeAtm.map(r => r.swap_tenor));

  const atmMap = new Map();

  for (const row of activeAtm) {
    atmMap.set(`${row.option_tenor}|${row.swap_tenor}`, row.atm_vol);
  }

  const surfaces = activeSmile
    .map(smileRow => {
      const strikeSpreadBp = Number(smileRow.strike_spread_bp);
      const volSpread = Number(smileRow.vol_spread);

      const volMatrix = swapTenors.map(swapTenor =>
        optionTenors.map(optionTenor => {
          const atmVol = atmMap.get(`${optionTenor}|${swapTenor}`);
          if (!Number.isFinite(atmVol) || !Number.isFinite(volSpread)) return null;
          return atmVol + volSpread;
        })
      );

      const rows = [];

      for (const swapTenor of swapTenors) {
        for (const optionTenor of optionTenors) {
          const atmVol = atmMap.get(`${optionTenor}|${swapTenor}`);
          if (!Number.isFinite(atmVol)) continue;

          rows.push({
            scenario_id: meta.scenario_id || 'BASE',
            ccy,
            run_id: meta.run_id || 'ACTIVE',
            option_tenor: optionTenor,
            swap_tenor: swapTenor,
            strike_spread_bp: strikeSpreadBp,
            vol_spread: volSpread,
            atm_vol: atmVol,
            vol: atmVol + volSpread,
          });
        }
      }

      return {
        strike: strikeSpreadBp,
        strike_spread_bp: strikeSpreadBp,
        strikeLabel: `${strikeSpreadBp}bp`,
        vol_spread: volSpread,
        optionTenors,
        swapTenors,
        volMatrix,
        rows,
      };
    })
    .sort((a, b) => a.strike - b.strike);

  return {
    run_id: meta.run_id || 'ACTIVE',
    scenario_id: meta.scenario_id || 'BASE',
    ccy,
    source: 'active-scenario-builder',
    atmSurface: buildAtmSurfaceGridFromRows(activeAtm),
    surfaces,
    rows: surfaces.flatMap(surface => surface.rows || []),
  };
}

export function createSwaptionDataHandlers({ appState } = {}) {
  if (!appState) {
    console.warn('[swaptionDataHandlers] createSwaptionDataHandlers called without appState.');
  }

  function getActiveSwaptionRow() {
    const rows = appState?.getSwaptionActive?.() || [];

    return [...rows].sort(
      (a, b) => new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
    )[0] || null;
  }

  function applyActiveSwaptionScenarioFromState() {
    if (!appState) return;

    const active = getActiveSwaptionRow();

    const activeScenario = String(active?.scenario_id || 'BASE').trim() || 'BASE';
    const ccy = String(active?.ccy || 'EUR').trim().toUpperCase() || 'EUR';
    const run_id = String(active?.active_run_id || 'ACTIVE').trim() || 'ACTIVE';

    const baseAtmRows = appState.getSwaptionAtmBase?.() || appState._SWAPTION_ATM_BASE || [];
    const baseSmileRows = appState.getSwaptionSmileBase?.() || appState._SWAPTION_SMILE_BASE || [];

    const atmScenarioRows = appState.getSwaptionAtmScenarioData?.() || [];
    const smileScenarioRows = appState.getSwaptionSmileScenarioData?.() || [];

    const selectedAtmRows =
      activeScenario === 'BASE'
        ? baseAtmRows
        : atmScenarioRows.filter(row =>
            String(row.scenario_id || '').trim() === activeScenario &&
            String(row.ccy || 'EUR').trim().toUpperCase() === ccy &&
            (!run_id || run_id === 'ACTIVE' || String(row.run_id || '').trim() === run_id)
          );

    const selectedSmileRows =
      activeScenario === 'BASE'
        ? baseSmileRows
        : smileScenarioRows.filter(row =>
            String(row.scenario_id || '').trim() === activeScenario &&
            String(row.ccy || 'EUR').trim().toUpperCase() === ccy &&
            (!run_id || run_id === 'ACTIVE' || String(row.run_id || '').trim() === run_id)
          );

    if (!selectedAtmRows.length) {
      console.info('[swaptionDataHandlers] ATM data not ready yet:', activeScenario);
      return;
    }

    if (!selectedSmileRows.length) {
      console.info('[swaptionDataHandlers] Smile data not ready yet:', activeScenario);
      return;
    }

    const normalizedAtm = normalizeAtmRows(selectedAtmRows);
    const normalizedSmile = normalizeSmileRows(selectedSmileRows);

    appState.setSwaptionAtmBase?.(normalizedAtm);
    appState.setSwaptionSmileBase?.(normalizedSmile);

    const cubeGrid = buildCubeSurfaceGridFromActiveRows(normalizedAtm, normalizedSmile, {
      scenario_id: activeScenario,
      ccy,
      run_id,
    });

    if (cubeGrid) {
      appState.setSwaptionCubeSurface?.(cubeGrid);
      schedulePopulateSwaptionCubeSelectors();

      dispatchSwaptionEvent('swaption:cube:ready', {
        run_id: cubeGrid.run_id,
        scenario_id: activeScenario,
        source: 'active-scenario',
        strikeCount: cubeGrid.surfaces?.length || 0,
        count: cubeGrid.rows?.length || 0,
      });
    }

    dispatchSwaptionEvent('swaption:active-scenario:applied', {
      scenario_id: activeScenario,
      atmCount: normalizedAtm.length,
      smileCount: normalizedSmile.length,
      cubeCount: cubeGrid?.rows?.length || 0,
    });

    dispatchSwaptionEvent('swaption:atm:ready', {
      source: 'active-scenario',
      scenario_id: activeScenario,
      count: normalizedAtm.length,
    });

    dispatchSwaptionEvent('swaption:smile:ready', {
      source: 'active-scenario',
      scenario_id: activeScenario,
      count: normalizedSmile.length,
    });
  }

  function handleSwaptionAtmBaseData(rows) {
    if (!appState) return;

    // 🔍 DEBUG: was kommt wirklich rein?
    console.log('[ATM BASE RAW]', {
      len: rows?.length,
      sample: rows?.[0],
    });

    const safeRows = normalizeAtmRows(rows);

    // 🔍 DEBUG: nach Normalisierung
    console.log('[ATM BASE NORMALIZED]', {
      len: safeRows.length,
      sample: safeRows[0],
    });

    // 🚨 HARTE VALIDIERUNG (kein stilles Failen mehr)
    if (!safeRows.length) {
      console.warn('[ATM BASE] ❌ EMPTY AFTER NORMALIZE');
      return;
    }

    appState._SWAPTION_ATM_BASE = safeRows;
    appState.setSwaptionAtmBase?.(safeRows);

    const { optionTenors, swapTenors } = extractUniqueSortedTenors(safeRows);

    console.log('[ATM BASE TENORS]', {
      optionTenors,
      swapTenors,
    });

    fillSwaptionDropdowns(optionTenors, swapTenors);

    dispatchSwaptionEvent('swaption:atm-base:ready', {
      count: safeRows.length,
      optionTenorCount: optionTenors.length,
      swapTenorCount: swapTenors.length,
    });

    // 🔥 CRITICAL: danach wird Scenario angewendet
    applyActiveSwaptionScenarioFromState();
  }

  function handleSwaptionSmileBaseData(rows) {
    if (!appState) return;

    console.log('[SMILE BASE RAW]', {
      len: rows?.length,
      sample: rows?.[0],
    });

    const safeRows = normalizeSmileRows(rows);

    console.log('[SMILE NORMALIZED CHECK]', safeRows.slice(0, 5));

    console.log('[SMILE BASE NORMALIZED]', {
      len: safeRows.length,
      sample: safeRows[0],
    });

    if (!safeRows.length) {
      console.warn('[SMILE BASE] ❌ EMPTY AFTER NORMALIZE');
      return;
    }

    appState._SWAPTION_SMILE_BASE = safeRows;
    appState.setSwaptionSmileBase?.(safeRows);

    dispatchSwaptionEvent('swaption:smile-base:ready', {
      count: safeRows.length,
    });

    applyActiveSwaptionScenarioFromState();
  }

  function handleSwaptionAtmScenarioData(rows) {
    if (!appState?.setSwaptionAtmScenarioData) {
      console.warn('[handleSwaptionAtmScenarioData] appState fehlt');
      return;
    }

    const safeRows = normalizeAtmRows(rows);

    appState.setSwaptionAtmScenarioData(safeRows);

    dispatchSwaptionEvent('swaption:atm-scenario-data:ready', {
      count: safeRows.length,
    });

    applyActiveSwaptionScenarioFromState();
  }

  function handleSwaptionSmileScenarioData(rows) {
    if (!appState?.setSwaptionSmileScenarioData) {
      console.warn('[handleSwaptionSmileScenarioData] appState fehlt');
      return;
    }

    const safeRows = normalizeSmileRows(rows);

    appState.setSwaptionSmileScenarioData(safeRows);

    dispatchSwaptionEvent('swaption:smile-scenario-data:ready', {
      count: safeRows.length,
    });

    applyActiveSwaptionScenarioFromState();
  }

  function handleSwaptionActiveData(rows) {
    if (!appState?.setSwaptionActive) {
      console.warn('[handleSwaptionActiveData] appState fehlt');
      return;
    }

    const safeRows = getSafeArray(rows);

    appState.setSwaptionActive(safeRows);

    dispatchSwaptionEvent('swaption:active:ready', {
      count: safeRows.length,
    });
  }

    document.addEventListener('swaption:rebuild-active-scenario', () => {
      applyActiveSwaptionScenarioFromState();
    });

  return {
    handleSwaptionAtmBaseData,
    handleSwaptionSmileBaseData,
    handleSwaptionAtmScenarioData,
    handleSwaptionSmileScenarioData,
    handleSwaptionActiveData,

    // temporary legacy aliases
    handleSwaptionATMData: handleSwaptionAtmBaseData,
    handleSwaptionSmileData: handleSwaptionSmileBaseData,
    handleSwaptionSnapshotsData: handleSwaptionAtmScenarioData,
    handleSwaptionSmileSnapshotsData: handleSwaptionSmileScenarioData,
  };
}