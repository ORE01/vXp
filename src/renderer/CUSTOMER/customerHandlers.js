// FRONT_END/CUSTOMER/customerHandlers.js

export function createCustomerHandlers({ appState } = {}) {
  if (!appState) throw new Error('[createCustomerHandlers] appState missing');

  function handleCustomerData(data) {
    appState.setCustomerData?.(data);
  }

  function handleCustomerTSData(data) {
    appState.setCustomerTSData?.(data);
    window.__tsSelectionsReady = true;
    window.dispatchEvent(new Event('ts-selections-ready'));
  }

  function handleCustomerReportsData(payload) {
    try {
      const data =
        Array.isArray(payload) ? payload :
        Array.isArray(payload?.data) ? payload.data :
        Array.isArray(payload?.rows) ? payload.rows :
        [];
      appState.setCustomerReportsData?.(data);
    } catch (e) {
      console.warn('[CustomerReports] handleCustomerReportsData failed', e);
    }
  }

  return {
    handleCustomerData,
    handleCustomerTSData,
    handleCustomerReportsData,
  };
}
