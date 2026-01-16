// FRONT_END/MARKET_DATA/FORWARDS/forwardsHandlers.js

export function createForwardsHandlers({ appState } = {}) {
  if (!appState) throw new Error('[createForwardsHandlers] appState missing');

  /**
   * IPC forward data handler
   * Stores raw forward data in appState for later rendering.
   */
  function handleForwardData(receivedData) {
    // If your AppState uses a different setter name, adjust here:
    // common patterns: setForwardData, setFWDData, setAllForwardData ...
    if (typeof appState.setForwardData === 'function') {
      appState.setForwardData(receivedData);
    } else {
      // fallback store
      appState.forwardData = receivedData;
    }

    // optional signal if you want panels/charts to react
    try {
      document.dispatchEvent(new CustomEvent('forwards:data:ready'));
    } catch {}
  }

  return { handleForwardData };
}
