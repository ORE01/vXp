// PYTHON/execution/fetch.js

export function createPythonExecutionFetch(ctx) {
  const {
    appState,
    once,
    handlePortAggData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handlePortfolioRiskSensitivitiesData,
    openPortAnalyseAndFocus,
  } = ctx;

  function fetchAndUpdateFairValueData(port_name) {
    console.log('[FETCH] fetchAndUpdateFairValueData START', {
      port_name,
      hasHandlePortfolioRiskSensitivitiesData:
        typeof handlePortfolioRiskSensitivitiesData === 'function',
    });

    const onData = (receivedData) => {
      const enhancedData = Array.isArray(receivedData) ? receivedData : [];

      console.log('[FETCH] PortfoliosData received in fetchAndUpdateFairValueData', {
        rows: enhancedData.length,
        port_name,
        sample: enhancedData[0],
      });

      if (!enhancedData.length) {
        appState.setAllPortfolioData?.([]);
        return;
      }

      if (!port_name) {
        console.warn('[FETCH] FairValue refresh skipped: no port_name');
        return;
      }

      appState.setAllPortfolioData?.(enhancedData);

      const filteredData = enhancedData.filter(e => e.port_name === port_name);

      appState.setSelectedPortTableName?.(port_name);
      appState.setSelectedDealsTableName?.(port_name);

      console.log('[FETCH] Portfolio context set before PRS reload', {
        port_name,
        selectedPort: appState.getSelectedPortTableName?.(),
        filteredRows: filteredData.length,
      });

      // Wichtig:
      // Erst PortfolioRiskSensitivities neu in den Store laden.
      // Erst DANACH darf updatePortDataTable laufen, weil das den
      // portfolioUIOrchestrator und damit PV01/CPV01/Vega triggert.
      fetchAndUpdatePortfolioRiskSensitivitiesData({
        afterStoreUpdate: () => {
          console.log('[FETCH] PRS store update completed -> now rendering portfolio UI', {
            port_name,
            selectedPort: appState.getSelectedPortTableName?.(),
            filteredRows: filteredData.length,
          });

          appState.updatePortDataTable?.(filteredData);

          ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdownId, index) => {
            appState.updateDropdownOptions?.({
              dropdownElementId: dropdownId,
              getDataFunction: appState.getPortNameList.bind(appState),
              updateDataFunction: appState.getPortfolioData?.bind(appState),
              selectedTableName: index === 0 ? port_name : undefined,
            });
          });

          handlePortAggData?.(filteredData, 3, port_name);
          openPortAnalyseAndFocus?.(port_name);
        },
      });
    };

    once('PortfoliosData', onData);
    window.api.send('fetch-table-data', 'Portfolios');
  }

  function fetchAndUpdatePortfolioRiskSensitivitiesData(options = {}) {
    const { afterStoreUpdate } = options;

    console.log('[FETCH] requesting PortfolioRiskSensitivitiesData', {
      selectedPort: appState.getSelectedPortTableName?.(),
      hasHandlePortfolioRiskSensitivitiesData:
        typeof handlePortfolioRiskSensitivitiesData === 'function',
    });

    once('PortfolioRiskSensitivitiesData', (rows) => {
      const safeRows = Array.isArray(rows) ? rows : [];

      console.log('[FETCH] PortfolioRiskSensitivitiesData received after python run', {
        rows: safeRows.length,
        sample: safeRows[0],
        selectedPort: appState.getSelectedPortTableName?.(),
      });

      if (typeof handlePortfolioRiskSensitivitiesData === 'function') {
        handlePortfolioRiskSensitivitiesData(safeRows);
      } else {
        console.warn('[FETCH] handlePortfolioRiskSensitivitiesData missing - store not updated');
      }

      if (typeof afterStoreUpdate === 'function') {
        afterStoreUpdate();
      }
    });

    window.api.send('fetch-table-data', 'PortfolioRiskSensitivities');
  }

  function fetchAndUpdateIRSensData() {
    fetchAndUpdatePortfolioRiskSensitivitiesData();
  }

  function fetchAndUpdateFairValueOffersData(port_name) {
    const onData = (receivedData) => {
      const enhancedData = Array.isArray(receivedData) ? receivedData : [];

      if (!enhancedData.length) {
        appState.setAllPortfolioData?.([]);
        return;
      }

      if (!port_name) return;

      appState.setAllPortfolioData?.(enhancedData);

      const filteredData = enhancedData.filter(e => e.port_name === port_name);

      appState.offersData = filteredData;
      appState.updateOffersDataTable?.(filteredData, { viewOnly: true });
      appState.applyFiltersAndUpdateDropdowns?.('offers');
      appState.setSelectedPortTableName?.(port_name);
    };

    once('PortfoliosData', onData);
    window.api.send('fetch-table-data', 'Portfolios');
  }

  function fetchAndUpdateMVarData(port_name) {
    let gotHeader = false;
    let gotDist = false;

    const maybeRenderSummary = () => {
      if (!gotHeader || !gotDist) return;

      const scen = appState.selectedMvarInterval;
      if (!scen) return;

      handleSummaryMarketRiskData?.(port_name, scen, null);
      handleMvarProductTable?.(port_name, scen, null);
    };

    once('MarketVaRData', (receivedData) => {
      if (!receivedData || receivedData.length === 0) {
        appState.updateMvarDataTable?.([]);
      } else {
        appState.updateMvarDataTable?.(receivedData);
      }

      gotHeader = true;
      maybeRenderSummary();
    });

    once('MarketVaR_DistData', (receivedData) => {
      if (!receivedData || receivedData.length === 0) {
        appState.setMvarDistData?.([]);
      } else {
        appState.setMvarDistData?.(receivedData);
      }

      gotDist = true;
      maybeRenderSummary();
    });

    window.api.send('fetch-table-data', 'MarketVaR');
    window.api.send('fetch-table-data', 'MarketVaR_Dist');
  }

  function fetchAndUpdateCVarData() {
    once('CreditVaRData', (receivedData) => {
      if (!receivedData || receivedData.length === 0) {
        appState.setAllCvarData?.([]);
        return;
      }

      appState.setAllCvarData?.(receivedData);
    });

    window.api.send('fetch-table-data', 'CreditVaR');
  }

  function fetchAndUpdateHistData() {
    once('tblTSData', (receivedData) => {
      if (!receivedData || receivedData.length === 0) return;

      const latest = receivedData[receivedData.length - 1];
      console.log('📊 Latest HIST row:', latest);
    });

    window.api.send('fetch-table-data', 'tblTS');
  }

  return {
    fetchAndUpdateFairValueData,
    fetchAndUpdateFairValueOffersData,
    fetchAndUpdatePortfolioRiskSensitivitiesData,
    fetchAndUpdateIRSensData,
    fetchAndUpdateMVarData,
    fetchAndUpdateCVarData,
    fetchAndUpdateHistData,
  };
}