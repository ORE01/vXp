// FRONT_END/STATE/dataUpdatePipeline.js
// Orchestriert "received data" -> AppState speichern -> UI refresh / dropdown filter triggern
// Minimal-invasiv: wir hängen die Methoden wieder an appState, damit bestehende Calls weiterlaufen.

function runIdle(fn, timeout = 200) {
  if ('requestIdleCallback' in window) return window.requestIdleCallback(fn, { timeout });
  return setTimeout(fn, 0);
}

export function installDataUpdatePipeline({ appState } = {}) {
  if (!appState) throw new Error('[dataUpdatePipeline] appState fehlt');

  // -----------------------------
  // DEALS
  // -----------------------------
  const updateDealsDataTableCore = (receivedData, { isFull = false } = {}) => {
    if (!Array.isArray(receivedData)) return;

    if (isFull && typeof appState.setAllDealsData === 'function') {
      appState.setAllDealsData(receivedData.map(r => ({ ...r })));
    }

    if (typeof appState.setDealsData === 'function') {
      const prev =
        appState.getSelectedDealsTableName?.() ||
        document.getElementById('createdDealsDropdown')?.value ||
        '';

      const norm = s => String(s ?? '').trim().toLowerCase();
      const filtered = prev
        ? receivedData.filter(r => norm(r.port_name || r.PORT_NAME) === norm(prev))
        : receivedData;

      appState.setDealsData(filtered.map(r => ({ ...r })));
    }

    const prev =
      appState.getSelectedDealsTableName?.() ||
      document.getElementById('createdDealsDropdown')?.value ||
      '';

    appState.applyFiltersAndUpdateDropdowns?.('deals', { preselect: prev });
    document.dispatchEvent(new Event('dealsData:ready'));
  };

  // Backward compatible Aliase (du hattest beide)
  const updateDealsDataTable = (receivedData, opts) => updateDealsDataTableCore(receivedData, opts);
  const updatePortfolioDealsDataTable = (receivedData, opts) => updateDealsDataTableCore(receivedData, opts);

  // -----------------------------
  // OFFERS
  // -----------------------------
  const updateOffersDataTable = (receivedData) => {
    appState.setOffersData?.(receivedData);

    const filtered = appState.applyFiltersAndUpdateDropdowns?.('offers') || receivedData;

    const targetEl = document.getElementById('offersDataContainer');
    if (!targetEl) { console.warn('[offers] container fehlt'); return; }

    targetEl.style.cssText = 'display:block;visibility:visible;height:auto;overflow:visible;';

    if (!Array.isArray(filtered) || filtered.length === 0) {
      targetEl.innerHTML = '<div style="padding:8px;opacity:.7;">No offers data.</div>';
      return;
    }

    const prevActive = appState.getActiveElementId?.();
    appState.setActiveElementId?.('offersDataContainer');

    try {
      appState.handleOffersTable?.(filtered);
    } finally {
      if (prevActive) appState.setActiveElementId?.(prevActive);
    }

    runIdle(() => {
      if (typeof enhanceDealsIncludeCheckboxes === 'function') {
        enhanceDealsIncludeCheckboxes(targetEl);
      }
      document.dispatchEvent(new Event('offersData:ready'));
    });
  };

  // -----------------------------
  // PORT
  // -----------------------------
  const updatePortDataTable = (receivedData) => {
    appState.setPortData?.(receivedData);
    appState.applyFiltersAndUpdateDropdowns?.('port');
  };

  // -----------------------------
  // MVaR / CVaR / EAD
  // -----------------------------
  const updateMvarDataTable = (receivedData, index) => {
    appState.setMvarData?.(receivedData);
    appState.setAllMvarData?.(receivedData);

    const mvarData = appState.getAllMvarData?.() || [];
    // UI render (legacy)
    try { window.handleMVaRData?.(mvarData, index); } catch {}
  };

  const updateMvarDistData = (receivedData, index, port_name) => {
    appState.setMvarDistData?.(receivedData);
    const scenario_name = appState.selectedMvarInterval ?? null;
    // legacy UI
    try { window.handleSummaryMarketRiskData?.(port_name, scenario_name); } catch {}
  };

  const updateMvarProductData = (receivedData, index, port_name) => {
    appState.setMvarProductData?.(receivedData);
    const scenario_name = appState.selectedMvarInterval ?? null;
    try { window.handleMvarProductTable?.(port_name, scenario_name); } catch {}
  };

  const updateCvarDataTable = (receivedData) => {
    appState.setCvarData?.(receivedData);
    appState.setAllCvarData?.(receivedData);
  };

  const updateEADDataTable = (receivedData) => {
    appState.setAllEADData?.(receivedData);
  };

  // -----------------------------
  // Expose on appState
  // -----------------------------
  appState.updateDealsDataTable = updateDealsDataTable;
  appState.updatePortfolioDealsDataTable = updatePortfolioDealsDataTable;

  appState.updateOffersDataTable = updateOffersDataTable;
  appState.updatePortDataTable = updatePortDataTable;

  appState.updateMvarDataTable = updateMvarDataTable;
  appState.updateMvarDistData = updateMvarDistData;
  appState.updateMvarProductData = updateMvarProductData;

  appState.updateCvarDataTable = updateCvarDataTable;
  appState.updateEADDataTable = updateEADDataTable;

  return {
    updateDealsDataTable,
    updateOffersDataTable,
    updatePortDataTable,
    updateMvarDataTable,
    updateMvarDistData,
    updateMvarProductData,
    updateCvarDataTable,
    updateEADDataTable,
  };
}
