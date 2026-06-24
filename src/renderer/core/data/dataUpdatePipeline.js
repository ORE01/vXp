// core/state/dataUpdatePipeline.js
// Orchestriert "received data" -> AppState speichern -> UI refresh / dropdown filter triggern

function runIdle(fn, timeout = 200) {
  if ('requestIdleCallback' in window) return window.requestIdleCallback(fn, { timeout });
  return setTimeout(fn, 0);
}

// helpers (local, pipeline-owned)
const norm = (s) => String(s ?? '').trim();
const normLower = (s) => norm(s).toLowerCase();

function buildDealsNameListFromDealsRows(rows) {
  const names = Array.from(
    new Set(
      (Array.isArray(rows) ? rows : [])
        .map(r => norm(r?.port_name ?? r?.PORT_NAME ?? ''))
        .filter(Boolean)
    )
  ).sort();
  return names.map(n => ({ table_name: n }));
}

function sliceDealsBySelectedTableName(allRows, selectedTableName) {
  const sel = normLower(selectedTableName);
  if (!sel || sel === 'all') return Array.isArray(allRows) ? allRows : [];

  return (Array.isArray(allRows) ? allRows : []).filter(r => {
    const p = normLower(r?.port_name ?? r?.PORT_NAME ?? '');
    return p === sel;
  });
}

export function installDataUpdatePipeline({ appState } = {}) {
  if (!appState) throw new Error('[dataUpdatePipeline] appState fehlt');

  // -----------------------------
  // DEALS (NEW, system-konform)
  // -----------------------------
const updateDealsDataTableCore = (receivedData, { isFull = false } = {}) => {
  if (!Array.isArray(receivedData)) return;

  // 1) Source of truth speichern
  const allRows = receivedData.map(r => ({ ...r }));
  appState.setAllDealsData?.(allRows);

  // 2) Portfolio-Liste aus port_name derivieren -> NameListsStore (als {table_name})
  const names = Array.from(new Set(
    allRows
      .map(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim())
      .filter(Boolean)
  )).sort();

  appState.setDealsNameList?.(names.map(n => ({ table_name: n })));

  // 3) gewünschte Auswahl bestimmen (State > DOM > ALL)
  const dd = document.getElementById('createdDealsDropdown');
  const wanted =
    appState.getSelectedDealsTableName?.() ||
    dd?.value ||
    'ALL';

  // 4) Dropdown via Engine befüllen + preselect (kein DOM-Build hier!)
  appState.applyFiltersAndUpdateDropdowns?.('dealsTables', { preselect: wanted });

  // 5) dealsData aus allDealsData anhand selectedDealsTableName slicen
  //    (createdDealsDropdown change handler setzt selectedDealsTableName;
  //     falls preselect gegriffen hat, kommt der change automatisch)
  if (typeof appState.refreshDealsDataFromSelectedTable === 'function') {
    appState.refreshDealsDataFromSelectedTable();
  }

  // 6) Restliche Deals-Filter anwenden + Render
  appState.applyFiltersAndUpdateDropdowns?.('deals');

  document.dispatchEvent(new Event('dealsData:ready'));
};



  // Backward compatible Aliase (du hattest beide)
  const updateDealsDataTable = (receivedData, opts) => updateDealsDataTableCore(receivedData, opts);
  const updatePortfolioDealsDataTable = (receivedData, opts) => updateDealsDataTableCore(receivedData, opts);

  // -----------------------------
  // OFFERS
  // -----------------------------
  const updateOffersDataTable = (receivedData, opts = {}) => {
    // ✅ Master-Liste NICHT überschreiben, wenn es nur View/Subset ist
    if (!opts.viewOnly) {
      appState.setOffersData?.(receivedData);
    }

    const filtered =
      appState.applyFiltersAndUpdateDropdowns?.('offers') || receivedData;

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
    try { window.handleMVaRData?.(mvarData, index); } catch {}
  };

  const updateMvarDistData = (receivedData, index, port_name) => {
    appState.setMvarDistData?.(receivedData);
    const scenario_name = appState.selectedMvarInterval ?? null;
    try { window.handleSummaryMarketRiskData?.(port_name, scenario_name); } catch {}
  };

  const updateMvarProductData = (receivedData, index, port_name) => {
    appState.setMvarProductData?.(receivedData);
    const scenario_name = appState.selectedMvarInterval ?? null;
    try { window.handleMvarProductTable?.(port_name, scenario_name); } catch {}
  };

  const updateCvarDataTable = (receivedData, index, port_name) => {
    appState.setCvarData?.(receivedData);

    try { window.handleCVaRData?.(receivedData, index, port_name); } catch {}
  };


const updateEADDataTable = (receivedData, index, port_name) => {
  const rows = Array.isArray(receivedData) ? receivedData : [];

  if (rows.length > 0) {
    appState.setAllEADData?.(rows);
  }

  const sourceRows = rows.length > 0
    ? rows
    : (appState.getAllEADData?.() || []);

  try {
    (window.handleEADData || appState.handleEADData)?.(sourceRows, index, port_name);
  } catch (err) {
    console.warn('[dataUpdatePipeline] updateEADDataTable render failed:', err);
  }
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

