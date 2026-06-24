// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/mvar/mvarModelSelectionHandler.js
//
// DataPump READ-flow handler for the Model Selection read model
// (view v_MVAR_MODEL_SELECTION_APP). Raw view rows -> marketRiskStore (AppState).
// Read-only: never writes back to the view.

import { appState } from '../../../../renderer.js';
import { renderModelSelectionTable } from './mvarInputPanel.js';

export function handleMvarModelSelectionAppData(rows) {
  const list = Array.isArray(rows) ? rows : [];

  // Normalise numeric-ish fields; keep all view columns intact.
  const normalized = list.map((r) => ({
    ...r,
    is_customer_default: Number(r.is_customer_default ?? 0) === 1 ? 1 : 0,
    risk_warning_profile: r.risk_warning_profile ?? 'BALANCED',
  }));

  appState.setMvarModelSelectionAppRows?.(normalized);

  const defaultRow = normalized.find((r) => r.is_customer_default === 1) || null;
  console.log('[MVAR MODEL SELECTION APP STATE]', {
    count: normalized.length,
    customerDefaultInterval: defaultRow ? defaultRow.INTERVAL_NAME : null,
    riskWarningProfile: normalized[0]?.risk_warning_profile ?? null,
    hasVarThresholds: normalized.some((r) => r.var_yellow_loss_limit != null || r.var_red_loss_limit != null),
    hasEsThresholds: normalized.some((r) => r.es_yellow_loss_limit != null || r.es_red_loss_limit != null),
  });

  // Re-render the Model Selection table from the fresh store rows (if present).
  renderModelSelectionTable();

  window.dispatchEvent(
    new CustomEvent('mvar-model-selection-app-data-refreshed', { detail: { count: normalized.length } }),
  );
}
