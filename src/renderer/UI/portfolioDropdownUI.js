// FRONT_END/UI/portfolioDropdownUI.js
// UI-Helper für created*Dropdowns (Port/Offers/Deals) + Container Mapping.
// KEIN global appState — alles über DI.

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
    console.log('[portfolioDropdownUI] updateDropdownOptions START:', dropdownElementId);

    if (!dropdownElement) {
      console.error(`⚠️ Dropdown element '${dropdownElementId}' not found.`);
      return;
    }

    const isPortfolio = dropdownElementId.startsWith('createdPortDropdown');
    const isOffers    = dropdownElementId === 'createdOffersDropdown';
    const isDeals     = dropdownElementId === 'createdDealsDropdown';

    // ✅ Restore old behavior: set correct render target container for this dropdown
    const containerId = getContainerIdForDropdown(dropdownElementId);
    if (containerId) appState.setActiveElementId?.(containerId);

    if (isPortfolio && typeof appState.setPortIndex === 'function') appState.setPortIndex(index);

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
   : isOffers ? String(appState.getSelectedOffersTableName?.() ?? '').trim()
   : isDeals  ? String(appState.getSelectedDealsTableName?.() ?? '').trim()
   : '') ||
  prevValue.trim();


    const isValid = [...dropdownElement.options].some(opt => opt.value === wanted);
    dropdownElement.value = isValid ? wanted : (dropdownElement.options[0]?.value ?? '');

    // state sync (avoid offers overwriting portfolio selection)
    if (isPortfolio) {
      appState.setSelectedPortTableName?.(dropdownElement.value);
    } else if (isOffers) {
      appState.setSelectedOffersTableName?.(dropdownElement.value);
    } else if (isDeals) {
      appState.setSelectedDealsTableName?.(dropdownElement.value);
    }

    // choose data source
    // - portfolio dropdowns use portfolio data
    // - deals/offers dropdowns use deals data
const allData = isPortfolio || isOffers
  ? (appState.getAllPortfolioData?.() || [])   // ✅ offers use enriched for filtering
  : (appState.getAllDealsData?.() || []);


    let filteredData = allData.filter(e => String(e?.port_name) === String(dropdownElement.value));

    // Offers: if enriched portfolio rows already exist for the same port_name, prefer them
    // if (isOffers) {
    //   const enriched = (appState.getAllPortfolioData?.() || []).filter(
    //     e => String(e?.port_name) === String(dropdownElement.value)
    //   );
    //   if (enriched.length) filteredData = enriched;
    // }

    if (!filteredData.length) {
      console.warn(`[portfolioDropdownUI] Keine Daten für '${dropdownElement.value}'.`);
      return;
    }

    const safeIndex = isPortfolio ? (index ?? 0) : 0;

    if (typeof updateDataFunction === 'function') {
      updateDataFunction(filteredData, safeIndex);
    }

    // only portfolio dropdowns drive these additional tables
    if (isPortfolio) {
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
        updateCvarDataFunction(c, safeIndex);
      }

      if (typeof updateEADDataFunction === 'function') {
        const ead = (appState.getAllEADData?.() || []).filter(
          e => String(e?.port_name) === String(dropdownElement.value)
        );
        updateEADDataFunction(ead, safeIndex);
      }
    }
  }

  return {
    updateDropdownOptions,
    fetchAndHandlePortData,
    getFormElementsForContainer,
    getContainerIdForDropdown,
  };
}

