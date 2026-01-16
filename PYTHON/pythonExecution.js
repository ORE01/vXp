// renderer/PYTHON/pythonExecution.js

export function bindPythonExecution(ctx) {
  const {
    appState,

    // ---- UI / handler funcs ----
    handlePortAggData,
    handlePortProdData,
    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    // ✅ Swaption Router-Handler (NEU)
    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    // Cube helpers (dürfen bleiben, werden aber durch handleSwaptionCubeSurfaceData im Renderer eh genutzt)
    buildCubeSurfaceGrid,
    populateSwaptionCubeSelectors,

    // optional helpers that exist in renderer scope today:
    openPortAnalyseAndFocus,
  } = ctx;

  // local state that used to live in renderer globals:
  let lastHistButton = null;

  // ------------- tiny helper: once/receive fallback -------------
  const once = (channel, cb) => (window.api?.once ? window.api.once(channel, cb) : window.api.receive(channel, cb));
  const on   = (channel, cb) => (window.api?.on   ? window.api.on(channel, cb)   : window.api.receive(channel, cb));

  // =============================================================
  // 1) Generic click handler (the big switch)
  // =============================================================
  function handleProjectButtonClick(buttonElement, projectName, extraParam = {}) {
    if (!buttonElement) return;

    const originalLabel = buttonElement.dataset.originalLabel || buttonElement.textContent;
    buttonElement.dataset.originalLabel = originalLabel;
    buttonElement.disabled = true;
    buttonElement.textContent = 'Executing...';

    try {
      switch (projectName) {
        case 'py-matchColumns':
          handleAIColumnProject(extraParam);
          break;

        case 'py-ml':
          handleMLProject(extraParam);
          break;

        case 'py-cspar':
          handleCSParProject(buttonElement, extraParam);
          break;

        case 'py-fairValue': {
          const isOffersBtn = (buttonElement.id === 'fairValueButton2');
          handleFairValueProject(buttonElement, {
            ...extraParam,
            calibrate: isOffersBtn,
            cal_iters: 2,
          });
          break;
        }

        case 'py-CVaR':
          handleCVaRProject(buttonElement, extraParam);
          break;

        case 'py-MVaR':
          handleMVaRProject(buttonElement, extraParam);
          break;

        case 'py-hist': {
          const apiMap = { histEcbButton: 'ECB', histFedButton: 'FED', histYahooButton: 'Yahoo' };
          const apiSource = apiMap[buttonElement.id];
          if (apiSource) extraParam.api = apiSource;
          handleHistProject(buttonElement, extraParam);
          break;
        }

        case 'py-excel': {
          const modeMap = {
            updateExcelAllButton:       'ALL',
            updateExcelIssuerButton:    'ISSUER',
            updateExcelProductsButton:  'PRODUCTS',
            updateExcelDealsButton:     'DEALS',
            updateExcelEuswButton:      'EUSW',
          };
          const mode = modeMap[buttonElement.id] || 'ALL';
          sendPayloadToAPI(projectName, mode, extraParam);
          break;
        }

        case 'py-swaption':
          handleSwaptionProject(buttonElement, extraParam);
          break;

        default: {
          const selectedTableName = appState.getSelectedDealsTableName?.() || 'DealsMain';
          sendPayloadToAPI(projectName, selectedTableName, extraParam);
          break;
        }
      }

      // UI reset when complete (generic)
      const handler = () => {
        buttonElement.disabled = false;
        buttonElement.textContent = originalLabel || 'Run';
      };

      // ⚠️ Many of your complete channels are NOT `${projectName}-complete` (case mismatch).
      // Keep this, but it’s only a fallback safety net.
      const fallbackCompleteChannel = `${projectName}-complete`;
      once(fallbackCompleteChannel, handler);

    } catch (error) {
      console.error(`Error handling project "${projectName}":`, error);
      alert('An error occurred while executing the project.');
      buttonElement.disabled = false;
      buttonElement.textContent = originalLabel || 'Run';
    }
  }

  // =============================================================
  // 2) Project-specific START functions
  // =============================================================

  function sendPayloadToAPI(projectName, tableName, extraParam) {
    const payload = { tableName, ...extraParam };
    window.api.send(`start-${projectName}`, payload);
  }

  function handleFairValueProject(buttonElement, extraParam = {}) {
    const id = buttonElement?.id || '';
    const preferredSource =
      id === 'fairValueButton2' ? 'offers' :
      id === 'fairValueButton'  ? 'port' :
      'deals';

    const dealsName  = appState.getSelectedDealsTableName?.();
    const portName   = appState.getSelectedPortTableName?.();
    const offersName = appState.getSelectedOffersTableName?.();

    const pickBySource = (src) => {
      switch (src) {
        case 'offers': return offersName || dealsName || portName || '';
        case 'port':   return portName   || dealsName || offersName || '';
        default:       return dealsName  || portName  || offersName || '';
      }
    };

    const tableName = String(pickBySource(preferredSource)).trim();
    if (!tableName) return console.warn('⚠️ Kein Name ausgewählt (deals/port/offers).');

    if (!dealsName && appState.setSelectedDealsTableName) {
      appState.setSelectedDealsTableName(tableName);
    }

    const CSSzenario    = appState.getCSSzenarioData?.();
    const selectedCurve = appState.getSelectedCurve?.();
    if (!CSSzenario) return console.warn('⚠️ Kein CSSzenario gesetzt. Bitte zuerst Szenario wählen.');

    const payload = {
      tableName,
      source: preferredSource,
      CSSzenario,
      selectedCurve,
      selectedDealsTableName:  dealsName  || '',
      selectedPortTableName:   portName   || '',
      selectedOffersTableName: offersName || '',
      ...extraParam,
    };

    window.api?.send?.('start-py-fairValue', payload);
  }

  function handleMVaRProject(buttonElement, extraParam) {
    const selectedTableName = appState.getSelectedPortTableName?.();
    if (!selectedTableName) throw new Error('No table selected for MVaR processing.');

    const interval = extraParam?.selectedInterval;
    if (!interval) throw new Error('No scenario selected. Bitte wähle ein Szenario mit dem Radio-Button aus.');

    appState.selectedMvarInterval = interval;

    const checked = document.querySelector('.scenario-radio:checked');
    const idAttr = checked?.getAttribute('data-id');
    const selectedId = idAttr != null ? parseInt(idAttr, 10) : null;
    if (!Number.isNaN(selectedId) && selectedId != null) appState.selectedMvarId = selectedId;

    const payload = { tableName: selectedTableName, selectedInterval: interval };
    window.api.send('start-py-MVaR', payload);
  }

  function handleCVaRProject(buttonElement, extraParam = {}) {
    const port_name = appState.getSelectedPortTableName?.();
    const CSSzenario = appState.getCSSzenarioData?.();
    if (!CSSzenario) throw new Error('No scenario data available. Please set a scenario first.');
    if (!extraParam.cvarName) throw new Error('No CVaR configuration name (cvarName) provided.');

    const payload = { tableName: port_name, CSSzenario, cvarName: extraParam.cvarName };
    window.api.send('start-py-CVaR', payload);
  }

  function handleHistProject(buttonElement, extraParam) {
    lastHistButton = buttonElement;
    window.api.send('start-py-historicData', { ...extraParam });
  }

  function handleSwaptionProject(buttonElement, extraParam = {}) {
    const selectedCurve = appState.getSelectedCurve?.() || 'EUSWAP';
    window.api?.send?.('start-py-swaption', { selectedCurve, ...extraParam });
  }

  // ML / CSPar / MatchColumns: keep your existing logic here later if you want;
  // for now we leave placeholders that you can paste 1:1 from renderer.
  function handleMLProject(extraParam) {
    // NOTE: paste your existing handleMLProject here (unchanged)
    // This function is big; keeping it out of renderer is the point.
    // For now: call the same channel as before.
    const selectedTableName = 'tblTS';

    const targetCheckboxContainer = document.getElementById('targetCheckboxContainer');
    const selectedTargetCheckbox = targetCheckboxContainer?.querySelector('input[type="checkbox"]:checked');
    extraParam.target = selectedTargetCheckbox ? selectedTargetCheckbox.value : 'NVDA';

    const epochsInput = document.getElementById('epochsInput')?.value;
    const batchSizeInput = document.getElementById('batchSizeInput')?.value;
    extraParam.epochs = epochsInput ? parseInt(epochsInput, 10) : 1;
    extraParam.batch_size = batchSizeInput ? parseInt(batchSizeInput, 10) : 32;

    const payload = { tableName: selectedTableName, ...extraParam };
    window.api.send(`start-py-ml`, payload);
  }

  function handleCSParProject(buttonElement, extraParam) {
    const selectedTableName = 'CSParameter';
    const selectedRows = [];
    const checkboxes = document.querySelectorAll('#CSParameterDataContainer .select-scenario:checked');
    if (checkboxes.length === 0) throw new Error('Please select at least one scenario.');

    checkboxes.forEach((checkbox) => {
      const row = checkbox.closest('tr');
      if (!row) return;
      const cells = row.querySelectorAll('td');
      const nameColumn = cells.length > 1 ? cells[cells.length - 2] : null;
      const CSSzenario = nameColumn ? nameColumn.textContent.trim() : null;
      if (CSSzenario) selectedRows.push(CSSzenario);
    });

    if (selectedRows.length === 0) throw new Error('Please select at least one scenario.');
    const CSSzenario = selectedRows[0];
    appState.setCSSzenarioData?.(CSSzenario);

    const payload = { tableName: selectedTableName, ...extraParam, CSSzenario, selectedRows };
    window.api.send(`start-py-cspar`, payload);
  }

  function handleAIColumnProject(extraParam = {}) {
    const port_name = appState.getSelectedDealsTableName?.();
    const offerData = appState.getOfferData?.();
    const inputColumns = offerData && offerData.length > 0 ? Object.keys(offerData[0]) : [];

    const productTargetColumns = [
      'PROD_ID', 'DESCRIPTION', 'START_DATE', 'MATURITY',
      'COUPON', 'GEARING', 'SPREADS', 'CAP', 'FLOOR', 'TENOR',
      'ISSUER', 'TICKER', 'RATING_PROD', 'RANK'
    ];
    const offerTargetColumns = ['PROD_ID', 'PRICE_BUY', 'TRADE_DATE'];

    const payload = { tableName: port_name, inputColumns, productTargetColumns, offerTargetColumns };
    window.api.send('start-py-matchColumns', payload);
  }

  // =============================================================
  // 3) Project COMPLETE handlers (registered once)
  // =============================================================

  function handleFairValueComplete(data) {
    if (data.projectName !== 'py-fairValue') return;

    let port_name = appState.getSelectedPortTableName?.();
    const isOffer = /^OFFERS?_/i.test(String(port_name || ''));

    if (isOffer) {
      appState.setActiveTable?.('offers');
      appState.setActiveElementId?.('offersDataContainer');
      fetchAndUpdateFairValueOffersData(port_name);
    } else {
      appState.setActiveTable?.('deals');
      appState.setActiveElementId?.('portDataContainer0');
      fetchAndUpdateFairValueData(port_name);
    }

    const btn = document.getElementById('fairValueButton2') || document.getElementById('fairValueButton');
    handleProjectResponse(btn, data.projectName, data);
  }

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

      appState.updateOffersDataTable?.(filteredData);

      appState.updateDropdownOptions?.({
        dropdownElementId: 'createdOffersDropdown',
        getDataFunction: (appState.getOffersNameList || appState.getDealsNameList).bind(appState),
        updateDataFunction: appState.updateOffersDataTable?.bind(appState),
        selectedTableName: port_name
      });

      appState.setSelectedDealsTableName?.(port_name);
      appState.setSelectedPortTableName?.(port_name);
    };

    once('PortfoliosData', onData);
    window.api.send('fetch-table-data', 'Portfolios');
  }

  function handleMVaRComplete(data) {
    // NOTE: your main sends `py-mvar-complete` with projectName maybe 'py-MVaR'
    // Keep both checks permissive:
    const pn = data?.projectName;
    if (pn !== 'py-MVaR' && pn !== 'py-mvar' && pn !== 'py-mvar') {
      // allow
    }

    appState.setActiveTable?.('port');

    const port_name = appState.getSelectedPortTableName?.();
    const scenario_name =
      appState.selectedMvarInterval ||
      document.querySelector('.scenario-radio:checked')?.getAttribute('data-interval');

    if (!scenario_name) return;

    handleProjectResponse(document.getElementById('mvaRDistButton'), 'py-MVaR', data);

    fetchAndUpdateMVarData(port_name);

    const mvarData = appState.getAllMvarData?.();
    handleMVaRData?.(mvarData, 0);

    handleSummaryMarketRiskData?.(port_name, scenario_name, null);
    handleMvarProductTable?.(port_name, scenario_name, null);
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

  function handleCVaRComplete(data) {
    if (data.projectName !== 'py-CVaR') return;

    appState.setActiveTable?.('port');

    handleProjectResponse(document.getElementById('CVaRButton'), data.projectName, data);

    fetchAndUpdateCVarData();

    const cvarData = appState.getAllCvarData?.();
    handleCVaRData?.(cvarData);
  }

  function fetchAndUpdateCVarData() {
    // ✅ BUGFIX: use ONCE (you had receive -> listener leak)
    once('CreditVaRData', (receivedData) => {
      if (!receivedData || receivedData.length === 0) {
        appState.setAllCvarData?.([]);
        return;
      }
      appState.setAllCvarData?.(receivedData);
    });

    window.api.send('fetch-table-data', 'CreditVaR');
  }

  function handleHistComplete(data) {
    if (data.projectName !== 'py-historicData') return;

    if (lastHistButton) {
      handleProjectResponse(lastHistButton, data.projectName, data);
      lastHistButton = null;
    }

    fetchAndUpdateHistData();
  }

  function fetchAndUpdateHistData() {
    // ✅ also use ONCE, not receive
    once('tblTSData', (receivedData) => {
      if (!receivedData || receivedData.length === 0) return;
      const latest = receivedData[receivedData.length - 1];
      console.log('📊 Latest HIST row:', latest);
    });

    window.api.send('fetch-table-data', 'tblTS');
  }

function handleSwaptionComplete(data) {
  if (data.projectName !== 'py-swaption') return;

  if (!data.success) {
    console.error('❌ Swaption-Run fehlgeschlagen:', data.error);
    return;
  }

  const outer = data.result || {};
  if (outer.status !== 'ok') {
    console.error('❌ Swaption status != ok:', outer.message || outer.error);
    return;
  }

  const core = outer.result || {};

  // ✅ 1) ATM Surface routen (State+Event im Renderer)
  if (Array.isArray(core.atmSurface)) {
    handleSwaptionATMData?.(core.atmSurface);
  } else {
    console.warn('[py-swaption] atmSurface missing');
  }

  // ✅ 2) Smile Grid routen
  if (Array.isArray(core.smileGrid)) {
    handleSwaptionSmileData?.(core.smileGrid);
  } else {
    console.warn('[py-swaption] smileGrid missing');
  }

  // ✅ 3) Cube Surface routen (wichtig: nicht rendern, nur handler!)
  if (core.cubeSurfaceFixedK) {
    handleSwaptionCubeSurfaceData?.(core.cubeSurfaceFixedK);
  } else if (core.cubeSurface) {
    handleSwaptionCubeSurfaceData?.(core.cubeSurface);
  } else {
    console.warn('[py-swaption] cube surface missing (cubeSurfaceFixedK/cubeSurface)');
  }
}


  function handleAIColumnComplete(data) {
    // Keep your existing renderer logic for UI tables; here only the hook exists.
    // If you want, you can move that entire UI-table rendering here too.
    console.log('[AIColumnComplete]', data);
  }

  // =============================================================
  // 4) project-finished + response mapping (UI labels)
  // =============================================================

  function handleProjectFinished(data) {
    const projectButtonMap = {
      'py-MVaR':         'mvaRDistButton',
      'py-CVaR':         'CVaRButton',
      'py-historicData': 'updateHistoricDataButton',
      'py-cspar':        'CSParButton',
      'py-ml':           'MLButton'
    };

    if (data.projectName === 'py-fairValue') {
      const sourceToId = { deals: 'fairValueButton1', port: 'fairValueButton', offers: 'fairValueButton2' };
      let buttonId = sourceToId[data?.source];

      if (!buttonId) {
        buttonId = ['fairValueButton', 'fairValueButton1', 'fairValueButton2']
          .find(id => document.getElementById(id)?.disabled);
      }

      const btn = document.getElementById(buttonId || '');
      if (btn) handleProjectResponse(btn, data.projectName, data);
      return;
    }

    if (data.projectName === 'py-excel') {
      const excelIds = [
        'updateExcelAllButton',
        'updateExcelIssuerButton',
        'updateExcelProductsButton',
        'updateExcelDealsButton',
        'updateExcelEuswButton',
      ];
      const buttonId = excelIds.find(id => document.getElementById(id)?.disabled);
      const btn = buttonId ? document.getElementById(buttonId) : null;
      if (btn) handleProjectResponse(btn, data.projectName, data);
      return;
    }

    const buttonId = projectButtonMap[data.projectName];
    if (buttonId) handleProjectResponse(document.getElementById(buttonId), data.projectName, data);
  }

  function handleProjectResponse(buttonElement, projectName, response) {
    const projectLabels = {
      'py-fairValue':    'Fair Value',
      'py-MVaR':         'P/L Dist',
      'py-CVaR':         'Credit VaR',
      'py-ml':           'Machine Learning',
      'py-excel':        'Excel Update',
      'py-cspar':        'CS Parser',
      'py-matchColumns': 'Match Columns',
      'py-historicData': 'Historic Data',
      'py-hist':         'Historical Update',
    };

    if (response && response.sent) return;

    if (buttonElement) {
      buttonElement.disabled = false;
      const originalLabel = buttonElement.dataset.originalLabel;
      buttonElement.textContent = originalLabel || projectLabels[projectName] || 'Run';
    }

    if (response && response.success === false) {
      console.error(`Error starting ${projectName}:`, response.error);
    }
  }

  // =============================================================
  // 5) Public API returned to renderer.js
  // =============================================================

function installPythonReceivers({ onExcelComplete, onAIColumnComplete } = {}) {
    on('py-fairValue-complete', handleFairValueComplete);
    on('py-mvar-complete',      handleMVaRComplete);
    on('py-cvar-complete',      handleCVaRComplete);
    on('py-historicData-complete', handleHistComplete);
    on('py-swaption-complete',  handleSwaptionComplete);

    if (typeof onAIColumnComplete === 'function') {
      on('py-matchColumns-complete', onAIColumnComplete);
    } else {
      on('py-matchColumns-complete', handleAIColumnComplete);
    }

    if (typeof onExcelComplete === 'function') {
      on('py-excel-complete', onExcelComplete);
    }

    on('project-finished', handleProjectFinished);
  }

  return {
    installPythonReceivers,
    handleProjectButtonClick,
  };
}
