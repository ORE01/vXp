
export function createPortfolioDropdownUI({ appState } = {}) {
  if (!appState) throw new Error('[portfolioDropdownUI] appState fehlt');

function getContainerIdForDropdown(dropdownId) {
  switch (dropdownId) {
    case 'createdPortDropdown0':  return 'portDataContainer0';
    case 'createdPortDropdown1':  return 'portDataContainer1';
    case 'createdPortDropdown2':  return 'portDataContainer2';
    case 'createdDealsDropdown':  return 'dealsDataContainer';

    // ✅ CHANGE: offers dropdown should drive filters from enriched view
    case 'createdOffersDropdown': return 'portDataContainer4';

    default: return 'portDataContainer0';
  }
}


  function getFormElementsForContainer(containerId) {
    switch (containerId) {
      case 'portDataContainer1':
        return {
          formPortValue:    document.getElementById('formPortValue1'),
          formPortNotional: document.getElementById('formPortNotional1'),
          formPortYield:    document.getElementById('formPortYield1'),
          formPortYieldA:   document.getElementById('formPortYieldA1'),
          formPortPV01:     document.getElementById('formPortPV011'),
          formPortCPV01:    document.getElementById('formPortCPV011'),
        };
      case 'portDataContainer2':
        return {
          formPortValue:    document.getElementById('formPortValue2'),
          formPortNotional: document.getElementById('formPortNotional2'),
          formPortYield:    document.getElementById('formPortYield2'),
          formPortYieldA:   document.getElementById('formPortYieldA2'),
          formPortPV01:     document.getElementById('formPortPV012'),
          formPortCPV01:    document.getElementById('formPortCPV012'),
        };
      default:
        return {
          formPortValue:    document.getElementById('formPortValue'),
          formPortNotional: document.getElementById('formPortNotional'),
          formPortYield:    document.getElementById('formPortYield'),
          formPortYieldA:   document.getElementById('formPortYieldA'),
          formPortPV01:     document.getElementById('formPortPV01'),
          formPortCPV01:    document.getElementById('formPortCPV01'),
        };
    }
  }

  function fetchAndHandlePortData(tableName, dropdownId) {
    console.log(`[portfolioDropdownUI] Fetching Portfolio Data for: ${tableName}`);

    const allPortfolios = appState.getAllPortfolioData?.() || [];
    if (!allPortfolios.length) {
      console.warn('[portfolioDropdownUI] No portfolio data available in appState.');
      return { containerId: null, rows: [] };
    }

    const rows = allPortfolios.filter(e => String(e?.port_name) === String(tableName));
    if (!rows.length) {
      console.warn(`[portfolioDropdownUI] Kein Portfolio gefunden für ${tableName}.`);
      return { containerId: null, rows: [] };
    }

    const containerId = getContainerIdForDropdown(dropdownId);
    appState.setActiveElementId?.(containerId);

    return { containerId, rows };
  }

function updateDropdownOptions({
  dropdownElementId,
  getDataFunction,
  selectedTableName,
  index,

  // callbacks (UI-updates)
  updateDataFunction,
  updateLiquidityDataFunction,
  updateMvarDataFunction,
  updateCvarDataFunction,
  updateEADDataFunction,
}) {
  const dropdownElement = document.getElementById(dropdownElementId);

  if (!dropdownElement) {
    console.error(`⚠️ Dropdown element '${dropdownElementId}' not found.`);
    return;
  }

  const isPortfolio = dropdownElementId.startsWith('createdPortDropdown');
  const isOffers    = dropdownElementId === 'createdOffersDropdown';
  const isDeals     = dropdownElementId === 'createdDealsDropdown';

  // ✅ Ownership guard:
  // - Deals-Dropdown wird von dealsUI gemanaged
  // - Offers-Dropdown wird von offersUI gemanaged
  // => diese Engine darf sie NICHT neu aufbauen (sonst "No data available" / leer)
  if (isDeals) return;
  if (isOffers) return;

  // ✅ Restore old behavior: set correct render target container for this dropdown
  const containerId = getContainerIdForDropdown(dropdownElementId);
  if (containerId) appState.setActiveElementId?.(containerId);

  if (isPortfolio && typeof appState.setPortIndex === 'function') {
    appState.setPortIndex(index);
  }

  const data = (typeof getDataFunction === 'function') ? getDataFunction() : [];
  if (!Array.isArray(data) || data.length === 0) {
    dropdownElement.innerHTML = '<option disabled>No data available</option>';
    return;
  }

  // preserve selection before rebuild
  const prevValue = String(dropdownElement.value ?? '');

  dropdownElement.innerHTML = '';
  data.forEach(item => {
    const option = document.createElement('option');
    const name = String(item?.port_name ?? item?.table_name ?? '');
    option.value = name;
    option.textContent = name;
    dropdownElement.appendChild(option);
  });

  // Selection priority: explicit arg > state > previous DOM > first option
  const wanted =
    String(selectedTableName ?? '').trim() ||
    (isPortfolio ? String(appState.getSelectedPortTableName?.() ?? '').trim()
     : '') ||
    prevValue.trim();

const isValid = [...dropdownElement.options].some(opt => opt.value === wanted);
dropdownElement.value = isValid ? wanted : (dropdownElement.options[0]?.value ?? '');

// ✅ Compare selection state (ONLY slot 1 & 2)
const safeIndex = (index ?? 0);
if (isPortfolio && (safeIndex === 1 || safeIndex === 2)) {
  const current = appState.getComparePortNames?.() || {};
  appState.setComparePortNames?.({
    ...current,
    [safeIndex]: dropdownElement.value,
  });

  // console.log(
  //   '[COMPARE][selection]',
  //   'slot=', safeIndex,
  //   'name=', dropdownElement.value,
  //   'state=', appState.getComparePortNames?.()
  // );
}

  let portfolioContextChangeDetail = null;

  // state sync (Portfolio only)
  if (isPortfolio) {
    const previousSelectedPort = String(appState.getSelectedPortTableName?.() ?? '').trim();
    const nextSelectedPort = String(dropdownElement.value ?? '').trim();

    appState.setSelectedPortTableName?.(nextSelectedPort);

    /**
     * System event payload:
     * The active analysis portfolio changed.
     *
     * This is NOT a DB refresh.
     * This is NOT CRUD.
     * This tells portfolio-dependent views to re-render from existing stores.
     *
     * Only slot 0 is the main analysis portfolio.
     * Compare slots 1/2 must not drive the main Market Risk/Sensitivity views.
     */
    if (safeIndex === 0 && previousSelectedPort !== nextSelectedPort) {
      portfolioContextChangeDetail = {
        previousPortName: previousSelectedPort,
        portName: nextSelectedPort,
        dropdownElementId,
        index: safeIndex,
        source: 'portfolioDropdownUI',
      };
    }
  }
  // choose data source:
  // - portfolio dropdowns use portfolio data
  const allData = appState.getAllPortfolioData?.() || [];
  const filteredData = allData.filter(e => String(e?.port_name) === String(dropdownElement.value));

  if (!filteredData.length) {
    console.warn(`[portfolioDropdownUI] Keine Daten für '${dropdownElement.value}'.`);
    return;
  }

  

  if (typeof updateDataFunction === 'function') {
    updateDataFunction(filteredData, safeIndex);
  }

  // only portfolio dropdowns drive these additional tables
  if (typeof updateLiquidityDataFunction === 'function') {
    updateLiquidityDataFunction(filteredData, safeIndex);
  }

  if (typeof updateMvarDataFunction === 'function') {
    const m = (appState.getAllMvarData?.() || []).filter(
      e => String(e?.port_name) === String(dropdownElement.value)
    );
    updateMvarDataFunction(m, safeIndex);
  }

if (typeof updateCvarDataFunction === 'function') {
  const c = (appState.getAllCvarData?.() || []).filter(
    e => String(e?.port_name) === String(dropdownElement.value)
  );

  // console.log('[CVaR] slot=', safeIndex, 'selected=', dropdownElement.value, 'rows=', c.length);
  // console.log('[CVaR] sample=', c[0]);

  //updateCvarDataFunction(c, safeIndex);
  updateCvarDataFunction(c, safeIndex, dropdownElement.value);
}


  if (typeof updateEADDataFunction === 'function') {
    const ead = (appState.getAllEADData?.() || []).filter(
      e => String(e?.port_name) === String(dropdownElement.value)
    );
    updateEADDataFunction(ead, safeIndex);
  }

    if (portfolioContextChangeDetail) {
      document.dispatchEvent(
        new CustomEvent('portfolio-context-changed', {
          detail: portfolioContextChangeDetail,
        })
      );

      console.log('[portfolioDropdownUI] portfolio-context-changed dispatched', portfolioContextChangeDetail);
    }


}

function bindPortResetFiltersButtonOnce() {
  const portResetButton = document.getElementById('portResetFiltersButton');
  if (!portResetButton || portResetButton.dataset.bound === '1') return;

  portResetButton.dataset.bound = '1';

  portResetButton.addEventListener('click', () => {
    const cfg = appState?.dropdownConfig?.port;
    if (cfg) {
      Object.keys(cfg).forEach((dropdownId) => {
        cfg[dropdownId].selection = ['ALL'];
      });
    }

    const fcfg = appState?.filtersConfig?.port;
    if (fcfg) {
      Object.keys(fcfg).forEach((k) => {
        fcfg[k] = new Set(['ALL']);
      });
    }

    appState.applyFiltersAndUpdateDropdowns?.('port');
  });
}


  return {
    updateDropdownOptions,
    fetchAndHandlePortData,
    getFormElementsForContainer,
    getContainerIdForDropdown,
    bindPortResetFiltersButtonOnce,
  };
}

