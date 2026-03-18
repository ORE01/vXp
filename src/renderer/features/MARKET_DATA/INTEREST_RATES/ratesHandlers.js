// src/renderer/features/MARKET_DATA/INTEREST_RATES/ratesHandlers.js

export function createRatesHandlers({ appState } = {}) {
  if (!appState) {
    throw new Error('[createRatesHandlers] appState missing');
  }

  // =====================================================
  // LEGACY EUSW (optional fallback)
  // =====================================================
  function handleEUSWData(data) {

    console.log('🔥 handleEUSWData CALLED');
    console.log('rows:', data?.length);
    console.log('sample:', data?.[0]);

    appState.setEUSWData?.(data);

    document.dispatchEvent(
      new CustomEvent('eusw:data:ready')
    );
  }

  // =====================================================
  // ✅ NEW SYSTEM — RATES
  // =====================================================
  function handleRATESData(data) {

    // console.log('🔥 handleRATESData CALLED');
    // console.log('rows:', data?.length);
    // console.log('sample:', data?.[0]);

    // ⭐ DAS IST DER ENTSCHEIDENDE CALL
    appState.setRATESData?.(data);

    document.dispatchEvent(
      new CustomEvent('rates:data:ready')
    );
  }

  function handleRatesActiveData(data) {

  // console.log('🔥 handleRatesActiveData CALLED');
  // console.log('rows:', data?.length);

  appState.setRatesActive?.(data);

}

  return {
    handleEUSWData,   // optional aber sauber
    handleRATESData,
    handleRatesActiveData,
  };
}
