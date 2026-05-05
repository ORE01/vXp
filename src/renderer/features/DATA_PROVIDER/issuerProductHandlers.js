// FRONT_END/DATA_PROVIDER/issuerProductHandlers.js

export function createIssuerProductHandlers({ appState } = {}) {
  if (!appState) throw new Error('[createIssuerProductHandlers] appState missing');

  function handleIssuerDataInit(receivedData) {
    appState.setActiveTable?.('issuer');
    appState.setIssuerData?.(receivedData);
    appState.applyFiltersAndUpdateDropdowns?.('issuer');

    const issuerResetButton = document.getElementById('issuerResetFiltersButton');
    issuerResetButton?.addEventListener('click', () => {
      // ✅ Issuer-Filter Selections zurücksetzen
      const cfg = appState?.dropdownConfig?.issuer;
      if (cfg) {
        Object.keys(cfg).forEach((dropdownId) => {
          cfg[dropdownId].selection = ['ALL'];
        });
      }

      // optional: falls filtersConfig noch aktiv verwendet wird
      const fcfg = appState?.filtersConfig?.issuer;
      if (fcfg) {
        Object.keys(fcfg).forEach((k) => {
          fcfg[k] = new Set(['ALL']);
        });
      }

      appState.applyFiltersAndUpdateDropdowns?.('issuer');
    });
  }


  function handleCountryLookupDataInit(receivedData) {
    if (typeof appState.setCountryLookup === 'function') {
      appState.setCountryLookup(receivedData);
    } else {
      appState.countryLookup = receivedData;
    }
  }

  function handleRankData(receivedData) {
    appState.setRankData?.(receivedData);
  }

  function handleProdDataInit(receivedData) {
    const issuerData = appState.getIssuerData?.() || [];

    const tickerToIssuerMap = {};
    issuerData.forEach((entry) => {
      if (entry?.TICKER != null) tickerToIssuerMap[entry.TICKER] = entry.ISSUER;
    });

    const updatedData = (Array.isArray(receivedData) ? receivedData : []).map((prod) => {
      // const matchedIssuer = tickerToIssuerMap[prod?.TICKER] || null;
      // return { ...prod, ISSUER: matchedIssuer };

      const matchedIssuer = tickerToIssuerMap[prod?.TICKER] || prod?.ISSUER || null;
      return { ...prod, ISSUER: matchedIssuer };


    });

    appState.setActiveTable?.('prod');
    appState.setProdData?.(updatedData);
    appState.applyFiltersAndUpdateDropdowns?.('prod');

    const prodResetButton = document.getElementById('prodResetFiltersButton');
    prodResetButton?.addEventListener('click', () => {
      // ✅ Dropdown-Selections zurücksetzen
      const cfg = appState?.dropdownConfig?.prod;
      if (cfg) {
        Object.keys(cfg).forEach((dropdownId) => {
          cfg[dropdownId].selection = ['ALL'];
        });
      }

      // optional – falls filtersConfig noch relevant ist
      const fcfg = appState?.filtersConfig?.prod;
      if (fcfg) {
        Object.keys(fcfg).forEach((k) => {
          fcfg[k] = new Set(['ALL']);
        });
      }

      appState.applyFiltersAndUpdateDropdowns?.('prod');
    });
  }


  return {
    handleIssuerDataInit,
    handleCountryLookupDataInit,
    handleRankData,
    handleProdDataInit,
  };
}
