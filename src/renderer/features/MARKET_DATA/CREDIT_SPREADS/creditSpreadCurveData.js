// creditSpreadCurveData.js

import { pivotCreditSpreadRowsByRating } from './creditSpreadTransforms.js';

export function getCreditSpreadCurveData(appState) {
  const baseLongRows = appState.getCSBaseData?.() || [];
  const scenarioLongRows = appState.getCSScenarioData?.() || [];
  const activeRows = appState.getCSActive?.() || [];

  const baseMatrix = pivotCreditSpreadRowsByRating(baseLongRows);

  if (!baseMatrix.length) {
    return { rows: [], scenarioLabel: 'BASE', reason: 'BASE_NOT_READY' };
  }

  let activeScenario = 'BASE';

  if (activeRows.length) {
    const active = activeRows[0];
    activeScenario = String(active?.scenario_name || 'BASE').trim() || 'BASE';
  }

  let rows = [];
  let scenarioLabel = activeScenario;

  if (activeScenario === 'BASE') {
    rows = baseMatrix;
  } else {
    if (!scenarioLongRows.length) {
      return {
        rows: [],
        scenarioLabel: activeScenario,
        reason: 'SCENARIO_NOT_READY',
      };
    }

    const filtered = scenarioLongRows.filter(
      row => String(row?.scenario_id || '').trim() === activeScenario
    );

    const pivoted = pivotCreditSpreadRowsByRating(filtered);

    if (pivoted.length) {
      rows = pivoted;
    } else {
      rows = baseMatrix;
      scenarioLabel = 'BASE';
    }
  }

  return { rows, scenarioLabel };
}