// csParameterHandlers.js

const CS_PARAMETER_DEBUG = false;

function log(...args) {
  if (CS_PARAMETER_DEBUG) console.log(...args);
}

function warn(...args) {
  console.warn(...args);
}

export function handleCSParameterData(data) {
  log('[CS PARAMETER] received:', data);

  const appState = window.appState;
  if (!appState) {
    throw new Error('[CS PARAMETER] appState missing');
  }

  if (!appState.setCSData) {
    throw new Error('[CS PARAMETER] setCSData missing');
  }

  if (!Array.isArray(data)) {
    warn('[CS PARAMETER] received non-array', data);
  }

  const rows = Array.isArray(data) ? data : [];

  if (rows.length && typeof rows[0] !== 'object') {
    warn('[CS PARAMETER] Unexpected format', rows[0]);
  }

  log('[CS PARAMETER][STORE] rows:', rows.length);

  appState.setCSData(rows);

  document.dispatchEvent(new Event('cs:parameter:ready'));
}