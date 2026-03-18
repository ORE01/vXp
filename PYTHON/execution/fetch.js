// PYTHON/execution/fetch.js

export function createPythonExecutionFetch(ctx) {
  const {
    appState,
    once,
    handlePortAggData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    openPortAnalyseAndFocus,
  } = ctx;

  function fetchAndUpdateFairValueData(port_name) {
    const onData = (receivedData) => {
      const enhancedData = receivedData;
      if (!Array.isArray(enhancedData) || !enhancedData.length) {
        appState.setAllPortfolioData?.([]);
        return;
      }
      if (!port_name) return;

      appState.setAllPortfolioData?.(enhancedData);
      const filteredData = enhancedData.filter(e => e.port_name === port_name);

      appState.updatePortDataTable?.(filteredData);

      ['createdPortDropdown0','createdPortDropdown1','createdPortDropdown2'].forEach((dropdownId, index) => {
        appState.updateDropdownOptions?.({
          dropdownElementId: dropdownId,
          getDataFunction: appState.getPortNameList.bind(appState),
          updateDataFunction: appState.getPortfolioData?.bind(appState),
          selectedTableName: index === 0 ? port_name : undefined
        });
      });

      appState.setSelectedPortTableName?.(port_name);
      appState.setSelectedDealsTableName?.(port_name);

      handlePortAggData?.(filteredData, 3, port_name);
      openPortAnalyseAndFocus?.(port_name);
    };

    once('PortfoliosData', onData);
    window.api.send('fetch-table-data', 'Portfolios');
    window.api.send('fetch-table-data', 'PortfolioRiskSensitivities');
  }

  function fetchAndUpdateFairValueOffersData(port_name) {
    const onData = (receivedData) => {
      const enhancedData = receivedData;
      if (!Array.isArray(enhancedData) || !enhancedData.length) {
        appState.setAllPortfolioData?.([]);
        return;
      }
      if (!port_name) return;

      appState.setAllPortfolioData?.(enhancedData);
      const filteredData = enhancedData.filter(e => e.port_name === port_name);

      // ✅ DAS ist entscheidend, weil dropdownFilterEngine 'offers' aus appState.offersData liest
      appState.offersData = filteredData;

      // (optional aber sinnvoll) UI table render
      appState.updateOffersDataTable?.(filteredData, { viewOnly: true });

      // ✅ triggert Dropdown-Engine für Offers-Filter
      appState.applyFiltersAndUpdateDropdowns?.('offers');

      appState.setSelectedPortTableName?.(port_name);
    };

    once('PortfoliosData', onData);
    window.api.send('fetch-table-data', 'Portfolios');
  }

  function fetchAndUpdateIRSensData() {

    once('PortfolioRiskSensitivitiesData', (rows) => {

      if (!rows || rows.length === 0) return;

      appState.setIRSensData?.(rows);

    });

    window.api.send('fetch-table-data', 'PortfolioRiskSensitivities');

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
    fetchAndUpdateIRSensData, 
    fetchAndUpdateMVarData,
    fetchAndUpdateCVarData,
    fetchAndUpdateHistData,
  };
}
