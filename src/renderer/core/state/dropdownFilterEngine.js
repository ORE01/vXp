import { applyColumnFilters } from '../../features/CUSTOMER/tableLayouts/tableColumnFilters.js';

export function installDropdownFilterEngine({ appState, root = document } = {}) {
  if (!appState) throw new Error('[dropdownFilterEngine] appState fehlt');

  // ------------------------------------------------------------
  // Helpers
  // ------------------------------------------------------------
  const arraysEqual = (arr1, arr2) => {
    if (!Array.isArray(arr1) || !Array.isArray(arr2)) return false;
    if (arr1.length !== arr2.length) return false;
    for (let i = 0; i < arr1.length; i++) {
      if (String(arr1[i]) !== String(arr2[i])) return false;
    }
    return true;
  };

  const getAllDropdownElements = () => root.querySelectorAll('.select-dropdown, .deals-dropdown');


  const addDropdownOption = (dropdown, value, text) => {
    const option = root.createElement('option');
    option.value = String(value);
    option.textContent = String(text);
    dropdown.appendChild(option);
  };

  const sortRatings = (a, b) => {
    const order = appState.ratingOrder || [];
    return order.indexOf(a) - order.indexOf(b);
  };

  const sortDates = (a, b) => {
    // behalten wie in deinem AppState – robust genug
    const dateA = new Date(String(a).replace(/(\d{2})-(\d{2})-(\d{4})/, '$2/$1/$3'));
    const dateB = new Date(String(b).replace(/(\d{2})-(\d{2})-(\d{4})/, '$2/$1/$3'));
    return dateA - dateB;
  };

  const sortNotionals = (a, b) => {
    const notionalA = parseFloat((a && a.NOTIONAL) || 0);
    const notionalB = parseFloat((b && b.NOTIONAL) || 0);
    return notionalA - notionalB;
  };

  const isAllSelected = (selArr) =>
    Array.isArray(selArr) && selArr.some(v => v === 'ALL' || v === 'ALL_TABLE_NAME' || v === '*');

  const getTableTypeFromDropdownId = (dropdownId) => {
    const mapping = {
      // prod
      'prodIssuerDropdown': 'prod',
      'prodProdIdDropdown': 'prod',
      'prodCouponTypeDropdown': 'prod',
      'prodRatingProdDropdown': 'prod',
      'prodMaturityDropdown': 'prod',
      'prodRankDropdown': 'prod',

      // issuer
      'issuerIssuerDropdown': 'issuer',
      'issuerRatingDropdown': 'issuer',

      // deals (Filter laufen jetzt über die Spaltenköpfe; nur TRADE_ID-Auswahl bleibt)
      'tradeDropdown': 'deals',

      // port
      'portIssuerDropdown': 'port',
      'portProdIdDropdown': 'port',
      'portCouponTypeDropdown': 'port',
      'portCategoryDropdown': 'port',
      'portRatingDropdown': 'port',
      'portMaturityDropdown': 'port',
      'portRankDropdown': 'port',
      'portDepotbankDropdown': 'port',
      'liquMaturityDropdown': 'port',
      'portCountryDropdown': 'port',
      'portRegionDropdown': 'port',

      // offers
      'offersIssuerDropdown': 'offers',
      'offersProdIdDropdown': 'offers',
      'offersCouponTypeDropdown': 'offers',
      'offersCategoryDropdown': 'offers',
      'offersRatingDropdown': 'offers',
      'offersRankDropdown': 'offers',
      'offersMaturityDropdown': 'offers',
      'offersDepotbankDropdown': 'offers',

      // table dropdowns
      'createdDealsDropdown': 'dealsTables',
      'createdOffersDropdown': 'offersTables',
      'createdPortDropdown0': 'portTables0',
      'createdPortDropdown1': 'portTables1',
      'createdPortDropdown2': 'portTables2',
    };
    return mapping[dropdownId] || null;
  };

  const updateDropdownSelection = (tableType, dropdownId, selectedOptions) => {
    const cfg = appState.dropdownConfig?.[tableType]?.[dropdownId];
    if (cfg) {
      cfg.selection = selectedOptions;
    } else {
      console.warn(`[dropdownFilterEngine] Kein Eintrag für ${dropdownId} in dropdownConfig[${tableType}]`);
    }
  };

  // ------------------------------------------------------------
  // populateDropdown (mit Selection-Restore)  ✅
  // ------------------------------------------------------------
  const populateDropdown = (dropdownId, data, allText, tableType) => {
    const dropdown = root.getElementById(dropdownId);
    if (!dropdown) return;

    const cfgByType = appState.dropdownConfig?.[tableType];
    const cfgEntry  = cfgByType?.[dropdownId];
    const dataKey   = cfgEntry?.dataKey;
    if (!dataKey) return;

    // Selection sichern
    const prevSelected = [...dropdown.selectedOptions].map(o => String(o.value));
    const prevValue = String(dropdown.value ?? '');

    if (!Array.isArray(data) || data.length === 0) return;

    let uniqueValues = [...new Set(
      data
        .map(item => (item && item[dataKey]) ?? null)
        .filter(v => v !== null && v !== undefined && v !== '')
        .map(v => String(v))
    )];

    if (uniqueValues.length === 0) {
      dropdown.innerHTML = '';
      addDropdownOption(dropdown, 'ALL', allText || 'ALL');
      dropdown.value = 'ALL';
      return;
    }

    // Sortierung
    try {
      if (dropdownId.endsWith('RatingDropdown')) {
        uniqueValues.sort((a, b) => sortRatings(a, b));
      } else if (dropdownId.endsWith('MaturityDropdown')) {
        uniqueValues.sort((a, b) => sortDates(a, b));
      } else if (dropdownId.endsWith('NotionalDropdown')) {
        uniqueValues.sort((a, b) => sortNotionals(a, b));
      } else {
        uniqueValues.sort();
      }
    } catch (e) {
      console.warn(`[dropdownFilterEngine] Sortierung fehlgeschlagen für ${dropdownId}`, e);
    }

    // Nur neu bauen, wenn wirklich anders
    const targetValues = ['ALL', ...uniqueValues.map(String)];
    const currentValues = [...dropdown.options].map(o => String(o.value));
    if (arraysEqual(currentValues, targetValues)) return;

    // Rebuild
    dropdown.innerHTML = '';
    addDropdownOption(dropdown, 'ALL', allText || 'ALL');
    uniqueValues.forEach(v => addDropdownOption(dropdown, v, v));

    // Restore: state > prevSelected > prevValue > ALL
    const fromState = Array.isArray(cfgEntry.selection) ? cfgEntry.selection.map(String) : [];
    const wanted = fromState.length
      ? fromState
      : (prevSelected.length ? prevSelected : (prevValue ? [prevValue] : ['ALL']));

    const wantedSet = new Set(wanted.map(String));
    let anyMatched = false;

    [...dropdown.options].forEach(opt => {
      const sel = wantedSet.has(String(opt.value));
      if (sel) anyMatched = true;
      opt.selected = sel;
    });

    if (!anyMatched) {
      dropdown.value = 'ALL';
      cfgEntry.selection = ['ALL'];
    }
  };

  const repopulateDropdownsForTableType = (tableType, filteredData) => {
    const config = appState.tableConfigs?.[tableType];
    if (!config?.dropdownConfig) return;

    // Deals: Dropdown-Optionen (z.B. #tradeDropdown im Edit-Drawer) sollen den
    // Spaltenkopf-Filtern der Deals-Tabelle folgen. Ohne aktiven Spaltenfilter
    // gibt applyColumnFilters die Daten unverändert zurück (No-op).
    const data = (tableType === 'deals')
      ? applyColumnFilters(filteredData, 'dealsMainTable')
      : filteredData;

    Object.keys(config.dropdownConfig).forEach(dropdownId => {
      const key = config.dropdownConfig[dropdownId].dataKey;
      populateDropdown(dropdownId, data, `ALL ${String(key || '').toUpperCase()}`, tableType);
    });
  };

  const updateUIWithFilteredData = (tableType, filteredData) => {
    const config = appState.tableConfigs?.[tableType];
    if (config && typeof config.dataHandler === 'function') {
      config.dataHandler(filteredData, config.filtersConfig);
    }
  };

  const applyFiltersAndUpdateDropdowns = (tableType, opts = {}) => {
  // console.log(
  //   '[applyFiltersAndUpdateDropdowns]',
  //   tableType,
  //   'opts=', opts,
  //   'caller=',
  //   new Error().stack?.split('\n')[2]?.trim()
  // );

    const { preselect } = (typeof opts === 'string') ? { preselect: opts } : opts;

    let receivedData;
    switch (tableType) {
      case 'issuer': receivedData = appState.issuerData; break;
      case 'prod':   receivedData = appState.prodData; break;
      case 'deals':  receivedData = appState.dealsData; break;
      case 'port':   receivedData = appState.portData; break;
      case 'offers': receivedData = appState.offersData; break;

      case 'offersTables': receivedData = appState.getOffersNameList?.() || []; break;
      case 'dealsTables':  receivedData = appState.getDealsNameList?.() || []; break;
      case 'portTables0':
      case 'portTables1':
      case 'portTables2':  receivedData = appState.getPortNameList?.() || []; break;

      default:
        console.error('[dropdownFilterEngine] Unknown tableType:', tableType);
        return;
    }

    if (!Array.isArray(receivedData)) return;

    const dropdownConfig = appState.dropdownConfig?.[tableType];
    if (!dropdownConfig) return;

    // ✅ Table-Name Dropdowns NIE filtern (sonst bleibt nach Auswahl nur noch 1 Option übrig)
    const isTableNameDropdown =
      tableType === 'dealsTables' ||
      tableType === 'offersTables' ||
      tableType === 'portTables0' ||
      tableType === 'portTables1' ||
      tableType === 'portTables2';

const filteredData = isTableNameDropdown
  ? receivedData
  : receivedData.filter(item => {
      return Object.entries(dropdownConfig).every(([_, { selection, dataKey }]) => {
        if (isAllSelected(selection)) return true;

        // ✅ Normalisieren: dropdown selections sind Strings,
        // daher item-value ebenfalls als String vergleichen
        const v = item?.[dataKey];
        return Array.isArray(selection) && selection.includes(String(v ?? ''));
      });
    });


    appState.filteredData = appState.filteredData || {};
    appState.filteredData[tableType] = filteredData;

    repopulateDropdownsForTableType(tableType, filteredData);

    // Preselect (nur dealsTables/offersTables – wie bei dir)
    if (preselect && (tableType === 'dealsTables' || tableType === 'offersTables')) {
      const ddId = (tableType === 'dealsTables') ? 'createdDealsDropdown' : 'createdOffersDropdown';
      const dd = root.getElementById(ddId);
      if (dd) {
        const norm = s => String(s || '').trim();
        const opt = Array.from(dd.options).find(o =>
          norm(o.value) === norm(preselect) || norm(o.textContent) === norm(preselect)
        );
        if (opt) {
          dd.value = opt.value;
          dd.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }
    }

    updateUIWithFilteredData(tableType, filteredData);
  };

  // ------------------------------------------------------------
  // Change handler + Control-Key Multi-select (wie in AppState)
  // ------------------------------------------------------------
  const accumulateControlKeySelections = (dropdownId, selections) => {
    appState.tempSelections = appState.tempSelections || {};
    appState.tempSelections[dropdownId] = selections;
  };

const handleDropdownChange = (event) => {
  const dropdownId = event.target.id;
  const tableType = getTableTypeFromDropdownId(dropdownId);
  if (!tableType) return;

  // 1) selectedOptions bestimmen (immer als Strings)
  let selectedOptions;

  if (event.target.value === 'ALL') {
    selectedOptions = ['ALL'];
  } else if (
    appState.tempSelections?.hasOwnProperty(dropdownId) &&
    appState.tempSelections[dropdownId]?.length
  ) {
    selectedOptions = appState.tempSelections[dropdownId];
    delete appState.tempSelections[dropdownId];
  } else {
    selectedOptions = [...event.target.selectedOptions].map(opt => String(opt.value));
  }

  // 2) Selection im config-State speichern
  updateDropdownSelection(tableType, dropdownId, selectedOptions);

  // 3) Spezielle State-Syncs (Source-of-truth)
  if (dropdownId.startsWith('createdPortDropdown') || dropdownId === 'createdOffersDropdown') {
    appState.setSelectedPortTableName?.(event.target.value);
  }

  if (dropdownId === 'createdDealsDropdown') {
    // Portfolio/Deals-Table Auswahl
    appState.setSelectedDealsTableName?.(event.target.value);

    // dealsData aus allDealsData neu schneiden
    appState.refreshDealsDataFromSelectedTable?.();

    // ✅ WICHTIG: nur deals neu anwenden/rendern (nicht dealsTables nochmal)
    applyFiltersAndUpdateDropdowns('deals');
    return;
  }

  if (dropdownId === 'tradeDropdown') {
    // ✅ Trade selection als Source-of-truth für "Create Portfolio"
    appState.setSelectedTradeIDs?.(selectedOptions);
  }

  // 4) Normalfall: Filter+Dropdowns+Render anwenden
  // Wichtig: nur anwenden wenn nicht Control gedrückt oder ALL
  if (!appState.isControlKeyPressed || event.target.value === 'ALL') {
    applyFiltersAndUpdateDropdowns(tableType);
  }
};


  const initDropdownListeners = () => {
    const dropdowns = getAllDropdownElements();
    dropdowns.forEach(dropdown => {
      if (dropdown.hasAttribute('data-listener-attached')) return;

      dropdown.addEventListener('change', (event) => {
        if (!appState.isControlKeyPressed) {
          handleDropdownChange(event);
        } else {
          accumulateControlKeySelections(
            event.target.id,
            [...event.target.selectedOptions].map(opt => String(opt.value))
          );
        }
      });

      dropdown.setAttribute('data-listener-attached', 'true');
    });
  };

  // Control-Key Listener (aus AppState raus)
  if (!appState.__controlKeyListenersInstalled) {
    appState.__controlKeyListenersInstalled = true;

    root.addEventListener('keydown', (e) => {
      if (e.key === 'Control') appState.isControlKeyPressed = true;
    });

    root.addEventListener('keyup', (e) => {
      if (e.key !== 'Control') return;
      appState.isControlKeyPressed = false;

      const entries = Object.entries(appState.tempSelections || {});
      for (const [dropdownId, selections] of entries) {
        const dropdown = root.getElementById(dropdownId);
        if (!dropdown) continue;

        [...dropdown.options].forEach(option => {
          option.selected = selections.includes(String(option.value));
        });

        dropdown.dispatchEvent(new Event('change', { bubbles: true }));
      }

      appState.tempSelections = {};
    });
  }

  // ------------------------------------------------------------
  // Expose API on appState (Backwards compatible)
  // ------------------------------------------------------------
  appState.initDropdownListeners = initDropdownListeners;
  appState.handleDropdownChange = handleDropdownChange;
  appState.applyFiltersAndUpdateDropdowns = applyFiltersAndUpdateDropdowns;
  appState.populateDropdown = populateDropdown;
  appState.repopulateDropdownsForTableType = repopulateDropdownsForTableType;
  appState.updateUIWithFilteredData = updateUIWithFilteredData;
  appState.getTableTypeFromDropdownId = getTableTypeFromDropdownId;
  appState.updateDropdownSelection = updateDropdownSelection;

  // install now
  initDropdownListeners();

  return {
    initDropdownListeners,
    applyFiltersAndUpdateDropdowns,
  };
}
