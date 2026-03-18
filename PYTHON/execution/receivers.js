// PYTHON/execution/receivers.js

export function createPythonExecutionReceivers(ctx) {
  const {
    appState,
    on,
    fetch,
    handleProjectResponse,

    handleMVaRData,
    handleSummaryMarketRiskData,
    handleMvarProductTable,
    handleCVaRData,

    handleSwaptionATMData,
    handleSwaptionSmileData,
    handleSwaptionCubeSurfaceData,

    getLastHistButton,
    clearLastHistButton,
  } = ctx;

  let _installed = false;

  function handleFairValueComplete(data) {
    if (data.projectName !== 'py-fairValue') return;

    let port_name = appState.getSelectedPortTableName?.();
    const isOffer = /^OFFERS?_/i.test(String(port_name || ''));

    if (isOffer) {
      appState.setActiveTable?.('offers');
      appState.setActiveElementId?.('offersDataContainer');
      fetch.fetchAndUpdateFairValueOffersData(port_name);
    } else {
      appState.setActiveTable?.('deals');
      appState.setActiveElementId?.('portDataContainer0');
      fetch.fetchAndUpdateFairValueData(port_name);
      fetch.fetchAndUpdateIRSensData(); 
    }

    const btn = document.getElementById('fairValueButton2') || document.getElementById('fairValueButton');
    handleProjectResponse(btn, data.projectName, data);
  }

  function handleMVaRComplete(data) {
    appState.setActiveTable?.('port');

    const port_name = appState.getSelectedPortTableName?.();
    const scenario_name =
      appState.selectedMvarInterval ||
      document.querySelector('.scenario-radio:checked')?.getAttribute('data-interval');

    if (!scenario_name) return;

    handleProjectResponse(document.getElementById('mvaRDistButton'), 'py-MVaR', data);

    fetch.fetchAndUpdateMVarData(port_name);

    const mvarData = appState.getAllMvarData?.();
    handleMVaRData?.(mvarData, 0);

    handleSummaryMarketRiskData?.(port_name, scenario_name, null);
    handleMvarProductTable?.(port_name, scenario_name, null);
  }

  function handleCVaRComplete(data) {
    if (data.projectName !== 'py-CVaR') return;

    appState.setActiveTable?.('port');

    handleProjectResponse(document.getElementById('CVaRButton'), data.projectName, data);

    fetch.fetchAndUpdateCVarData();

    const cvarData = appState.getAllCvarData?.();
    handleCVaRData?.(cvarData);
  }

  function handleHistComplete(data) {
    if (data.projectName !== 'py-historicData') return;

    const btn = getLastHistButton?.();
    if (btn) {
      handleProjectResponse(btn, data.projectName, data);
      clearLastHistButton?.();
    }

    fetch.fetchAndUpdateHistData();
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

    if (Array.isArray(core.atmSurface)) {
      handleSwaptionATMData?.(core.atmSurface);
    } else {
      console.warn('[py-swaption] atmSurface missing');
    }

    if (Array.isArray(core.smileGrid)) {
      handleSwaptionSmileData?.(core.smileGrid);
    } else {
      console.warn('[py-swaption] smileGrid missing');
    }

    if (core.cubeSurfaceFixedK) {
      handleSwaptionCubeSurfaceData?.(core.cubeSurfaceFixedK);
    } else if (core.cubeSurface) {
      handleSwaptionCubeSurfaceData?.(core.cubeSurface);
    } else {
      console.warn('[py-swaption] cube surface missing (cubeSurfaceFixedK/cubeSurface)');
    }
  }

  function handleAIColumnComplete(data) {
    console.log('[AIColumnComplete]', data);
  }

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

  function installPythonReceivers({ onExcelComplete, onAIColumnComplete } = {}) {
    if (_installed) return; // ✅ critical guard
    _installed = true;

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
  };
}
