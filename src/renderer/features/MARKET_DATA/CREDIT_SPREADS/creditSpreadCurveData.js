// creditSpreadCurveData.js

import { pivotCreditSpreadRowsByRating } from './creditSpreadTransforms.js';

export function getCreditSpreadCurveData(appState) {
  const selectedCcy =
    appState.getSelectedCcy?.() ||
    appState.selectedCcy ||
    appState.getSelectedCurrency?.() ||
    'EUR';

  const ccy = String(selectedCcy).trim().toUpperCase();

  const baseLongRows = appState.getCSBaseData?.() || [];
  const scenarioLongRows = appState.getCSScenarioData?.() || [];
  const activeRows = appState.getCSActive?.() || [];

  const activeForCcy =
    activeRows.find(row => String(row?.ccy || '').trim().toUpperCase() === ccy) ||
    null;

  const activeScenario =
    String(activeForCcy?.scenario_id || 'BASE').trim() || 'BASE';

  const activeRunId =
    String(activeForCcy?.active_run_id || activeForCcy?.run_id || 'BASE').trim() || 'BASE';

  const baseFiltered = baseLongRows.filter(row =>
    String(row?.ccy || '').trim().toUpperCase() === ccy &&
    String(row?.scenario_id || 'BASE').trim() === 'BASE' &&
    String(row?.run_id || 'BASE').trim() === 'BASE'
  );

  const baseMatrix = pivotCreditSpreadRowsByRating(baseFiltered);

  if (!baseMatrix.length) {
    return {
      rows: [],
      scenarioLabel: 'BASE',
      ccy,
      reason: 'BASE_NOT_READY',
    };
  }

  let rows = [];
  let scenarioLabel = activeScenario;

  if (activeScenario === 'BASE') {
    rows = baseMatrix;
  } else {
    const filtered = scenarioLongRows.filter(row =>
      String(row?.ccy || '').trim().toUpperCase() === ccy &&
      String(row?.scenario_id || '').trim() === activeScenario &&
      String(row?.run_id || row?.active_run_id || '').trim() === activeRunId
    );

    const pivoted = pivotCreditSpreadRowsByRating(filtered);

    if (pivoted.length) {
      rows = pivoted;
    } else {
      rows = baseMatrix;
      scenarioLabel = 'BASE';
    }
  }

  return {
    rows,
    scenarioLabel,
    ccy,
  };
}