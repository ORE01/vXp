// interestRateCurveData.js

import { sortInterestRateRowsByTenor } from './interestRateTransforms.js';

// =====================================================
// RATE ROW NORMALIZATION
// DB rows can come from RATES_BASE or RATES_SCENARIO_DATA.
// This function creates one stable UI shape.
// =====================================================

function normalizeRateRow(r) {
  return {
    tenor: r.tenor || r.maturity || '',
    value: Number(r.value ?? 0),
    asof_date: r.asof_date || r.updated_at || '',
    run_id: r.run_id || 'BASE',
    scenario_id: r.scenario_id || 'BASE',
    ccy: r.ccy || '',
    curve_id: r.curve_id || '',
    instrument: r.instrument || ''
  };
}

export function getInterestRateCurveData(appState, selectedCurrency, selectedCurveId, domSelectedCurve) {
  const raw = appState._RATESDataCacheByCcy?.[selectedCurrency] || [];

  if (!Array.isArray(raw) || raw.length === 0) {
    return { IRData: [], curve: null };
  }

  const curves = [...new Set(raw.map(r => r.curve_id).filter(Boolean))];
  if (curves.length === 0) return { IRData: [], curve: null };

  const appSelectedCurve = appState.getSelectedCurve();

  const candidateCurve =
    domSelectedCurve ||
    selectedCurveId ||
    appSelectedCurve;

  const selectedCurve =
    candidateCurve && curves.includes(candidateCurve)
      ? candidateCurve
      : curves[0];

  const curveRows = raw.filter(r => r.curve_id === selectedCurve);
  if (curveRows.length === 0) return { IRData: [], curve: selectedCurve };

  const activeEntry = appState.getRatesActive()
    .filter(r =>
      r.ccy === selectedCurrency &&
      r.curve_id === selectedCurve
    )
    .sort((a, b) =>
      new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
    )[0];

  const activeScenario = activeEntry?.scenario_id || 'BASE';
  const activeRunId = activeEntry?.active_run_id;

  let sourceRows;

  if (activeScenario === 'BASE') {
    sourceRows = curveRows;
  } else {
    const snapshots = appState.getRatesScenarioData() || [];

    const snapshotUniverse = snapshots.filter(r =>
      r.ccy === selectedCurrency &&
      r.curve_id === selectedCurve &&
      r.scenario_id === activeScenario
    );

    const exactRunRows = activeRunId
      ? snapshotUniverse.filter(r => r.run_id === activeRunId)
      : [];

    sourceRows = exactRunRows.length
      ? exactRunRows
      : snapshotUniverse;
  }

  const scenarioRows = sourceRows;

  if (scenarioRows.length === 0) {
    return { IRData: [], curve: selectedCurve };
  }

  const latestDate = scenarioRows.reduce((max, r) => {
    const rowDate = r.asof_date || r.updated_at;
    if (!rowDate) return max;

    return (!max || new Date(rowDate) > new Date(max))
      ? rowDate
      : max;
  }, null);

  const finalRows = latestDate
    ? scenarioRows.filter(r => (r.asof_date || r.updated_at) === latestDate)
    : scenarioRows;

  const normalizedRows = finalRows.map(normalizeRateRow);
  const IRData = sortInterestRateRowsByTenor(normalizedRows);

  return { IRData, curve: selectedCurve };
}