// FRONT_END/SELECT_PORTFOLIO/dealsPortfolioActions.js

export function createDealsPortfolioActions({ appState, api, showMessageBox, showConfirmationBox, handleModalAction } = {}) {
  if (!appState) throw new Error('[createDealsPortfolioActions] appState missing');
  if (!api) throw new Error('[createDealsPortfolioActions] api missing');

  function handleDealsNameList(receivedData) {
    try {
      const names = (receivedData || []).map(e => e.port_name).filter(Boolean);
      const unique = [...new Set(names)];
      const dealsList = unique.map(name => ({ table_name: name }));

      if (typeof appState.setDealsNameList === 'function') {
        appState.setDealsNameList(dealsList, 'createdDealsDropdown');
      }
      if (typeof appState.applyFiltersAndUpdateDropdowns === 'function') {
        appState.applyFiltersAndUpdateDropdowns('dealsTables');
      }
    } catch (error) {
      console.error('❌ Error processing deals name list:', error);
    }
  }

  function handleOffersNameList(receivedData) {
    try {
      const names = (receivedData || []).map(e => e.port_name).filter(Boolean);
      const unique = [...new Set(names)];
      const isOffer = (n) => typeof n === 'string' && /^OFFERS?_/.test(n.toUpperCase());
      const offersList = unique.filter(isOffer).map(name => ({ table_name: name }));

      if (typeof appState.setOffersNameList === 'function') {
        appState.setOffersNameList(offersList, 'createdOffersDropdown');
      }
      if (typeof appState.applyFiltersAndUpdateDropdowns === 'function') {
        appState.applyFiltersAndUpdateDropdowns('offersTables');
      }
    } catch (error) {
      console.error('❌ Error processing offers name list:', error);
    }
  }

  function handlePortNameList(receivedData) {
    try {
      const names = (receivedData || []).map(e => e?.port_name).filter(Boolean);
      const uniquePortfolios = [...new Set(names)].map(name => ({ table_name: name }));

      ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdown, index) => {
        appState.setPortNameList(uniquePortfolios, dropdown);
        appState.applyFiltersAndUpdateDropdowns(`portTables${index}`);
      });
    } catch (error) {
      console.error('❌ Error processing created port data:', error);
    }
  }

  function handleSaveNewPortfolio() {
    const inputEl = document.getElementById('PortfolioNameInput');
    const port_name = (inputEl?.value || '').trim();
    if (!port_name) {
      alert('Please enter a portfolio name.');
      return;
    }

    const dealsNameList = appState.getDealsNameList?.() || [];
    const exists = dealsNameList.some(p => (p.table_name || p.name) === port_name);
    if (!exists) {
      appState.setDealsNameList?.([...dealsNameList, { table_name: port_name }]);
    }

    try {
      api.send('save-portfolio-name', { port_name });
    } catch (e) {
      console.warn('save-portfolio-name IPC failed:', e);
    }

    appState.setSelectedDealsTableName?.(port_name);
    appState.setSelectedPortTableName?.(port_name);

    if (typeof showMessageBox === 'function') {
      showMessageBox(`Portfolio "${port_name}" successfully saved!`, () => {});
    }
  }

  function handleSaveSelection() {
    const port_name = document.getElementById('nameInput')?.value;
    const tagValues = (document.getElementById('tagInputField')?.value || '')
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean);

    if (!port_name || tagValues.length === 0) {
      alert('Please enter a name and select at least one trade ID.');
      return;
    }

    const filteredData = appState.getFilteredData?.('deals') || [];
    const selectedFromTableName = appState.getSelectedDealsTableName?.();
    const selectedTradeIDs = filteredData.map(entry => Number(entry.TRADE_ID));

    api.send('save-deals-selection', {
      selectedFromTableName,
      port_name,
      tagValues,
      selectedTradeIDs,
    });

    if (typeof showMessageBox === 'function') {
      showMessageBox(`Portfolio "${port_name}" successfully created!`, () => {});
    }

    const newPortfolio = { table_name: port_name };
    appState.setDealsNameList?.([...(appState.getDealsNameList?.() || []), newPortfolio]);

    // Dropdown intern + UI refresh
    try {
      appState.dropdownConfig['dealsTables']['createdDealsDropdown'].selection = [port_name];
      appState.applyFiltersAndUpdateDropdowns('dealsTables');

      appState.updateDropdownOptions({
        dropdownElementId: 'createdDealsDropdown',
        getDataFunction: appState.getDealsNameList.bind(appState),
        updateDataFunction: appState.updateDealsDataTable.bind(appState),
        selectedTableName: port_name
      });

      setTimeout(() => {
        const dropdown = document.getElementById('createdDealsDropdown');
        if (dropdown) {
          dropdown.value = port_name;
          dropdown.dispatchEvent(new Event('change'));
        }
      }, 100);

      appState.setSelectedDealsTableName?.(port_name);
      appState.setSelectedPortTableName?.(port_name);

      document.getElementById('dealsResetFiltersButton')?.click();
    } catch (e) {
      console.warn('[handleSaveSelection] post steps failed', e);
    }
  }

  function handleDeleteSelection() {
    const selectedTableName = appState.getSelectedDealsTableName?.();

    if (!selectedTableName || selectedTableName === 'Select a table') {
      alert('Please select a table to delete.');
      return;
    }

    const portTableName = selectedTableName.replace(/^Deals/, 'Port');

    const doDelete = () => {
      api.send('delete-selected-table', selectedTableName);

      setTimeout(() => {
        const dealsData = (appState.getDealsNameList?.() || []).filter(deal => deal.table_name !== selectedTableName);
        appState.setDealsNameList?.(dealsData);

        appState.updateDropdownOptions?.({
          dropdownElementId: 'createdDealsDropdown',
          getDataFunction: appState.getDealsNameList.bind(appState),
          updateDataFunction: appState.updateDealsDataTable.bind(appState),
          selectedTableName
        });

        const portData = (appState.getPortNameList?.() || []).filter(port => port.table_name !== portTableName);
        appState.setPortNameList?.(portData);

        ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach(dropdownId => {
          appState.updateDropdownOptions?.({
            dropdownElementId: dropdownId,
            getDataFunction: appState.getPortNameList.bind(appState),
            updateDataFunction: appState.updatePortDataTable.bind(appState),
            updateMvarDataFunction: appState.updateMvarDataTable?.bind(appState),
            updateCvarDataFunction: appState.updateCvarDataTable?.bind(appState),
            updateLiquidityDataFunction: appState.updateLiquidityDataFunction?.bind(appState),
            selectedTableName: null
          });
        });

        requestAnimationFrame(() => {
          const nameInput = document.getElementById('nameInput');
          if (nameInput) {
            nameInput.focus();
            const len = nameInput.value.length;
            nameInput.setSelectionRange(len, len);
          }
        });
      }, 100);
    };

    if (typeof showConfirmationBox === 'function') {
      showConfirmationBox(
        `Are you sure you want to delete the tables "${selectedTableName}" and "${portTableName}"?`,
        doDelete,
        () => {}
      );
    } else {
      // fallback
      if (confirm(`Delete "${selectedTableName}" and "${portTableName}"?`)) doDelete();
    }
  }

  function handleAddDealsToNewPortfolio(event) {
    const inputEl = document.getElementById('PortfolioNameInput');
    const port_name = (inputEl?.value || '').trim();

    if (!port_name) {
      alert('Please enter a portfolio name first.');
      return;
    }

    let dealsData =
      appState.getDealsData?.() ||
      appState.getFilteredData?.('deals') ||
      [];

    if (!Array.isArray(dealsData) || dealsData.length === 0) {
      const allDeals = appState.getAllDealsData?.() || appState.getAllDeals?.() || [];
      if (Array.isArray(allDeals) && allDeals.length > 0) dealsData = allDeals;
      else {
        dealsData = [{ TRADE_ID: '', PORT_NAME: '', PROD_ID: '' }];
        console.warn('handleAddDealsToNewPortfolio: using fallback template row.');
      }
    }

    const selectedTableName = 'DealsMain';
    handleModalAction?.(event, dealsData, null, selectedTableName, 'add');

    setTimeout(() => {
      const form = document.getElementById('editForm') || document.querySelector('#modal form');
      if (!form) return;

      const portField =
        form.querySelector('[data-field="PORT_NAME"]') ||
        form.querySelector('[data-field="port_name"]');

      if (portField) {
        portField.value = port_name;
        portField.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 0);
  }

  function handleDealsMainData(receivedData) {
    appState.setAllDealsData?.(receivedData);
    appState.setActiveTable?.('deals');

    const btn = document.getElementById('dealsResetFiltersButton');
    if (btn) {
      btn.onclick = () => appState.resetFiltersForActiveTable?.(receivedData, 'deals');
    }
  }

  function handlePortfolioData(receivedData) {
    appState.setAllPortfolioData?.(receivedData);
    appState.setActiveTable?.('deals');

    const portBtn = document.getElementById('portResetFiltersButton');
    if (portBtn) {
      portBtn.onclick = () => appState.resetFiltersForActiveTable?.(receivedData, 'port');
    }

    const offersBtn = document.getElementById('offersResetFiltersButton');
    if (offersBtn) {
      offersBtn.onclick = () => appState.resetFiltersForActiveTable?.(receivedData, 'offers');
    }
  }




  return {
    handleDealsNameList,
    handleOffersNameList,
    handlePortNameList,
    handleSaveNewPortfolio,
    handleSaveSelection,
    handleDeleteSelection,
    handleAddDealsToNewPortfolio,
    handleDealsMainData,
    handlePortfolioData,
  };
}
