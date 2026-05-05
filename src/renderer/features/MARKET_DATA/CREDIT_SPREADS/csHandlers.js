// csHandlers.js

import { updateCSScenarioWarningUI } from '../../../core/ui/warnings.js';

// ======================================================
// DEBUG SWITCH
// ======================================================
const CS_DEBUG = false; // <<< true = EIN / false = AUS

function log(...args) {
  if (CS_DEBUG) console.log(...args);
}

function warn(...args) {
  console.warn(...args); // warnings immer sichtbar
}

// ======================================================
// CS_ACTIVE
// ======================================================
export function handleCS_ACTIVEData(data) {
  log('[CS] active received:', data);

  const appState = window.appState;
  if (!appState) {
    throw new Error('[CS] appState missing');
  }

  if (!appState.setCSActive) {
    throw new Error('[CS] setCSActive missing');
  }

  if (!Array.isArray(data)) {
    warn('[CS] active received non-array', data);
  }

  const rows = Array.isArray(data) ? data : [];

  if (rows.length && !('scenario_name' in rows[0])) {
    warn('[CS] Unexpected CS_ACTIVE format', rows[0]);
  }

  log('[CS][STORE] active rows:', rows.length);
  log('[CS][STORE] raw active table:', rows);

  appState.setCSActive(rows);
  updateCSScenarioWarningUI();

  const latest = [...rows].sort(
    (a, b) => new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
  )[0];

  log('[CS][STORE] active scenario:', latest?.scenario_name || 'default');

  document.dispatchEvent(new Event('cs:active:ready'));
}

// ======================================================
// CS_BASE
// ======================================================
export function handleCSBaseData(data) {
  log('[CS] base received:', data);

  const appState = window.appState;
  if (!appState) {
    throw new Error('[CS] appState missing');
  }

  if (!appState.setCSBaseData) {
    throw new Error('[CS] setCSBaseData missing');
  }

  if (!Array.isArray(data)) {
    warn('[CS] base received non-array', data);
  }

  const rows = Array.isArray(data) ? data : [];

  // optional: Struktur-Check (long format)
  if (rows.length && !('rating' in rows[0])) {
    warn('[CS] Unexpected CS_BASE format', rows[0]);
  }

  appState.setCSBaseData(rows);

  document.dispatchEvent(new Event('cs:base:ready'));
}

// ======================================================
// CS_SCENARIO_DATA
// ======================================================
export function handleCSScenarioData(data) {
  log('[CS] scenario received:', data);

  const appState = window.appState;
  if (!appState) {
    throw new Error('[CS] appState missing');
  }

  if (!appState.setCSScenarioData) {
    throw new Error('[CS] setCSScenarioData missing');
  }

  if (!Array.isArray(data)) {
    warn('[CS] scenario received non-array', data);
  }

  const rows = Array.isArray(data) ? data : [];

  // optional: Struktur-Check (long format)
  if (rows.length && !('rating' in rows[0])) {
    warn('[CS] Unexpected CS_SCENARIO_DATA format', rows[0]);
  }

  appState.setCSScenarioData(rows);

  log('[CS][STORE] scenario rows:', rows.length);

  document.dispatchEvent(new Event('cs:scenario:ready'));
}