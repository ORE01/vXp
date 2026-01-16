// FRONT_END/MARKET_DATA/INTEREST_RATES/ratesHandlers.js

export function createRatesHandlers({ appState } = {}) {
  if (!appState) {
    throw new Error('[createRatesHandlers] appState missing');
  }

  /**
   * EUSW (EUR Swap Curve) – Rohdaten aus IPC
   */
  function handleEUSWData(data) {
    // 1) zentral speichern
    appState.setEUSWData?.(data);

    // 2) Event für Panels / Charts / Lazy Renderer
    try {
      document.dispatchEvent(new CustomEvent('eusw:data:ready'));
    } catch {}
  }

  return {
    handleEUSWData,
  };
}
