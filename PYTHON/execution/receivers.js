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
  let _lastFairValueRefreshAt = 0;

  function getFairValueButton(data) {
    const sourceToId = {
      deals: 'fairValueButton1',
      port: 'fairValueButton',
      offers: 'fairValueButton2',
    };

    let buttonId = sourceToId[data?.source];

    if (!buttonId) {
      buttonId = ['fairValueButton', 'fairValueButton1', 'fairValueButton2']
        .find(id => document.getElementById(id)?.disabled);
    }

    return buttonId ? document.getElementById(buttonId) : null;
  }

  function handleFairValueComplete(data) {
    if (data.projectName !== 'py-fairValue') return;

    const now = Date.now();

    if (now - _lastFairValueRefreshAt < 1000) {
      console.warn('[PY RECEIVER] duplicate py-fairValue refresh skipped', {
        projectName: data.projectName,
        source: data.source,
        success: data.success,
      });
      return;
    }

    _lastFairValueRefreshAt = now;

    const btn = getFairValueButton(data);

    if (btn) {
      handleProjectResponse(btn, data.projectName, data);
    }

    if (data.success === false) {
      console.warn('[PY RECEIVER] py-fairValue completed without success - refresh skipped', {
        projectName: data.projectName,
        source: data.source,
        success: data.success,
        error: data.error,
      });
      return;
    }

    const port_name = appState.getSelectedPortTableName?.();

    if (!port_name) {
      console.warn('[PY RECEIVER] py-fairValue refresh skipped: no selected portfolio', {
        projectName: data.projectName,
        source: data.source,
        success: data.success,
      });
      return;
    }

    const isOffer = /^OFFERS?_/i.test(String(port_name || ''));

    console.log('[PY RECEIVER] py-fairValue complete -> refresh start', {
      projectName: data.projectName,
      source: data.source,
      success: data.success,
      port_name,
      isOffer,
    });

    if (isOffer) {
      appState.setActiveTable?.('offers');
      appState.setActiveElementId?.('offersDataContainer');
      fetch.fetchAndUpdateFairValueOffersData(port_name);
      return;
    }

    appState.setActiveTable?.('deals');
    appState.setActiveElementId?.('portDataContainer0');

    console.log('[PY RECEIVER] calling fetchAndUpdateFairValueData', {
      port_name,
      hasFetch: !!fetch,
      hasFetchAndUpdateFairValueData: typeof fetch.fetchAndUpdateFairValueData === 'function',
    });

    fetch.fetchAndUpdateFairValueData?.(port_name);
  }

  function handleMVaRComplete(data) {
    if (data.projectName !== 'py-MVaR') return;

    appState.setActiveTable?.('port');

    const port_name = appState.getSelectedPortTableName?.();
    const scenario_name =
      appState.selectedMvarInterval ||
      document.querySelector('.scenario-radio:checked')?.getAttribute('data-interval');

    handleProjectResponse(document.getElementById('mvaRDistButton'), 'py-MVaR', data);

    if (data.success === false) {
      console.warn('[PY RECEIVER] py-MVaR completed without success - refresh skipped', {
        projectName: data.projectName,
        success: data.success,
        error: data.error,
      });
      return;
    }

    if (!scenario_name) {
      console.warn('[PY RECEIVER] py-MVaR refresh skipped: no scenario selected');
      return;
    }

    fetch.fetchAndUpdateMVarData(port_name);

    // Optional sinnvoll: Wenn MVaR auf Sensitivities basiert und diese sichtbar sein sollen.
    fetch.fetchAndUpdatePortfolioRiskSensitivitiesData?.();

    const mvarData = appState.getAllMvarData?.();
    handleMVaRData?.(mvarData, 0);

    handleSummaryMarketRiskData?.(port_name, scenario_name, null);
    handleMvarProductTable?.(port_name, scenario_name, null);
  }

  function handleCVaRComplete(data) {
    if (data.projectName !== 'py-CVaR') return;

    appState.setActiveTable?.('port');

    handleProjectResponse(document.getElementById('CVaRButton'), data.projectName, data);

    if (data.success === false) {
      console.warn('[PY RECEIVER] py-CVaR completed without success - refresh skipped', {
        projectName: data.projectName,
        success: data.success,
        error: data.error,
      });
      return;
    }

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

    if (data.success === false) {
      console.warn('[PY RECEIVER] py-historicData completed without success - refresh skipped', {
        projectName: data.projectName,
        success: data.success,
        error: data.error,
      });
      return;
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
      'py-MVaR': 'mvaRDistButton',
      'py-CVaR': 'CVaRButton',
      'py-historicData': 'updateHistoricDataButton',
      'py-cspar': 'CSParButton',
      'py-ml': 'MLButton',
    };

    // Wichtig:
    // Manche Runs kommen offenbar nur über project-finished zurück.
    // Deshalb darf py-fairValue hier NICHT nur den Button fertigsetzen.
    // Es muss denselben Refresh-Pfad auslösen wie py-fairValue-complete.
    if (data.projectName === 'py-fairValue') {
      console.log('[PY RECEIVER] project-finished py-fairValue received', {
        projectName: data.projectName,
        source: data.source,
        success: data.success,
        selectedPort: appState.getSelectedPortTableName?.(),
      });

      handleFairValueComplete(data);
      return;
    }

    if (data.projectName === 'py-MVaR') {
      console.log('[PY RECEIVER] project-finished py-MVaR received', {
        projectName: data.projectName,
        success: data.success,
        selectedPort: appState.getSelectedPortTableName?.(),
      });

      handleMVaRComplete(data);
      return;
    }

    if (data.projectName === 'py-CVaR') {
      handleCVaRComplete(data);
      return;
    }

    if (data.projectName === 'py-excel') {
      const excelIds = [
        'updateExcelAllButton',
        'updateExcelIssuerButton',
        'updateExcelProductsButton',
        'updateExcelDealsButton',
        'updateExcelMarketButton',
      ];

      const buttonId = excelIds.find(id => document.getElementById(id)?.disabled);
      const btn = buttonId ? document.getElementById(buttonId) : null;

      if (btn) {
        handleProjectResponse(btn, data.projectName, data);
      }

      return;
    }

    const buttonId = projectButtonMap[data.projectName];

    if (buttonId) {
      handleProjectResponse(document.getElementById(buttonId), data.projectName, data);
    }
  }

  function installPythonReceivers({ onExcelComplete, onAIColumnComplete } = {}) {
    if (_installed) return;
    _installed = true;

    on('py-fairValue-complete', handleFairValueComplete);
    on('py-mvar-complete', handleMVaRComplete);
    on('py-cvar-complete', handleCVaRComplete);
    on('py-historicData-complete', handleHistComplete);
    on('py-swaption-complete', handleSwaptionComplete);

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