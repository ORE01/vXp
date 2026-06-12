// src/renderer/features/MARKET_DATA/INTEREST_RATES/interestRateCurveHandler.js

import { updateCurveWarningUI } from '../../../core/ui/warnings.js';
import { refreshPanel } from '../../../core/routing/panelOrchestrator.js';

export function createRatesHandlers({ appState } = {}) {
  if (!appState) {
    throw new Error('[createRatesHandlers] appState missing');
  }



  function handleRATES_BASEData(data) {
    const rows = Array.isArray(data) ? data : [];

    console.log('🔥 RATES HANDLER CALLED');
    console.log('rows:', rows.length);
    console.log('scenarios:', [...new Set(rows.map(r => r.scenario_id))]);

    appState.setRATESData(rows);

    document.dispatchEvent(new CustomEvent('rates:data:ready', {
      detail: { rows }
    }));

    refreshPanel('panel-rates', 'marketdata');
  }

  function handleRatesScenarioData(data) {
    const rows = Array.isArray(data) ? data : [];

    console.log('🔥 RATES SCENARIO DATA HANDLER CALLED');
    console.log('scenario rows:', rows.length);
    console.log('scenario ids:', [...new Set(rows.map(r => r.scenario_id))]);

    appState.setRatesScenarioData(rows);

    document.dispatchEvent(new CustomEvent('rates:scenario-data:ready'));
  }

function handleRatesActiveData(data) {
  const rows = Array.isArray(data) ? data : [];

  appState.setRatesActive(rows);
  updateCurveWarningUI();

  document.dispatchEvent(new CustomEvent('rates:active-data:ready', {
    detail: { rows }
  }));
}
  return {
    handleRATES_BASEData,
    handleRatesScenarioData,
    handleRatesActiveData,
  };
}




