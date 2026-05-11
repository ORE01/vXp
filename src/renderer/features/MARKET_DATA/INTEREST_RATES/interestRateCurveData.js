// interestRateCurveData.js

import { sortInterestRateRowsByTenor } from './interestRateTransforms.js';

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

  const instrumentRows = sourceRows.filter(
    r => (r.instrument || '').toLowerCase() === 'swap'
  );

  const scenarioRows = instrumentRows.length ? instrumentRows : sourceRows;

  if (scenarioRows.length === 0) {
    return { IRData: [], curve: selectedCurve };
  }

  const latestDate = scenarioRows.reduce((max, r) => {
    if (!r.asof_date) return max;
    return (!max || new Date(r.asof_date) > new Date(max))
      ? r.asof_date
      : max;
  }, null);

  const finalRows = latestDate
    ? scenarioRows.filter(r => r.asof_date === latestDate)
    : scenarioRows;

  const sortedRows = sortInterestRateRowsByTenor(finalRows);

  const IRData = sortedRows.map(r => ({
    tenor: r.tenor,
    value: Number(r.value ?? 0),
    asof_date: r.asof_date,
    run_id: r.run_id,
    scenario_id: r.scenario_id,
    ccy: r.ccy,
    curve_id: r.curve_id,
    instrument: r.instrument
  }));

  return { IRData, curve: selectedCurve };
}