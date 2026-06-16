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
    // The clicked button was disabled by handleProjectButtonClick; re-enable
    // exactly that one (covers fairValueButton1, the Create-panel button, etc.).
    const ids = [
      'fairValueButton',
      'fairValueButton1',
      'fairValueButton2',
      'fairValueButton3',
      'fairValueButtonCreate',
    ];

    const disabledId = ids.find((id) => document.getElementById(id)?.disabled);
    if (disabledId) return document.getElementById(disabledId);

    const sourceToId = {
      deals: 'fairValueButton1',
      port: 'fairValueButton',
      offers: 'fairValueButton2',
    };

    const buttonId = sourceToId[data?.source];
    return buttonId ? document.getElementById(buttonId) : null;
  }

  // Resolve the portfolio that was actually calculated, based on the trigger
  // source. For the Change-Portfolio "Calculate" button (source 'deals') the
  // selection lives in the deals dropdown, NOT in the SELECT PORTFOLIO dropdown.
  function resolveFairValuePortName(data) {
    // Prefer the portfolio that was actually calculated — it is echoed back in
    // the py-fairValue-complete event as `tableName`. Re-reading the live
    // selection is unreliable: the post-calc refreshTable('Portfolios') rebuilds
    // the port dropdown BEFORE this event fires and can reset the selection to
    // the previously calculated portfolio.
    const fromEvent = String(data?.tableName ?? '').trim();
    if (fromEvent) return fromEvent;

    const bySource =
      data?.source === 'offers' ? appState.getSelectedOffersTableName?.() :
      data?.source === 'port'   ? appState.getSelectedPortTableName?.() :
                                  appState.getSelectedDealsTableName?.();

    return String(
      bySource
      || appState.getSelectedPortTableName?.()
      || appState.getSelectedDealsTableName?.()
      || ''
    ).trim();
  }

  // Switch to the ANALYSE PORTFOLIO tab, open the "Select Portfolio" sub-panel
  // and select the portfolio in its dropdown, so the freshly calculated results
  // become visible there.
  function activatePortfolioResultTab(port_name) {
    document.getElementById('ANALYSE_Tab')?.click();

    // Open the Select Portfolio sub-panel (only if not already open, so a
    // re-calculation doesn't toggle it shut).
    const selectPanel = document.getElementById('panel-selectPort');
    if (selectPanel && (selectPanel.hidden || !selectPanel.classList.contains('open'))) {
      document.querySelector('.section-trigger[data-panel="panel-selectPort"]')?.click();
    }

    // Persist the wanted selection in the dropdown-engine config so any later
    // (async) rebuild of the port dropdown keeps it selected instead of
    // resetting to "ALL".
    try {
      appState.updateDropdownSelection?.('portTables0', 'createdPortDropdown0', [port_name]);
      appState.setSelectedPortTableName?.(port_name);
    } catch {}

    // The port dropdown may still be repopulating after the refresh, so retry
    // until the option exists, then select it (and re-assert a few times to
    // survive late rebuilds).
    selectPortfolioInDropdown(port_name, 0);
  }

  function selectPortfolioInDropdown(port_name, attempt) {
    const dd = document.getElementById('createdPortDropdown0');
    if (!dd) return;

    const norm = (s) => String(s ?? '').trim();
    const wanted = norm(port_name);

    const hasOption = Array.from(dd.options).some((o) => norm(o.value) === wanted);

    if (hasOption) {
      if (norm(dd.value) !== wanted) {
        dd.value = port_name;
        dd.dispatchEvent(new Event('change', { bubbles: true }));
      }
      // Re-assert a few times in case a late refresh rebuilds the dropdown.
      if (attempt < 4) {
        setTimeout(() => selectPortfolioInDropdown(port_name, attempt + 1), 250);
      }
      return;
    }

    if (attempt < 15) {
      setTimeout(() => selectPortfolioInDropdown(port_name, attempt + 1), 200);
    }
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

    const port_name = resolveFairValuePortName(data);

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

    // Results live in the SELECT PORTFOLIO tab. Switch there and select the
    // calculated portfolio so the user immediately sees the results.
    appState.setSelectedPortTableName?.(port_name);
    appState.setActiveTable?.('port');
    appState.setActiveElementId?.('portDataContainer0');

    activatePortfolioResultTab(port_name);

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