// PYTHON/execution/router.js

export function createPythonExecutionRouter(ctx) {
  const { appState, once, setLastHistButton } = ctx;

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
        case 'offers':
          return offersName || dealsName || portName || '';
        case 'port':
          return portName || dealsName || offersName || '';
        default:
          return dealsName || portName || offersName || '';
      }
    };

    const tableName = String(pickBySource(preferredSource)).trim();
    if (!tableName) {
      console.warn('⚠️ Kein Name ausgewählt (deals/port/offers).');
      return;
    }

    if (!dealsName && appState.setSelectedDealsTableName) {
      appState.setSelectedDealsTableName(tableName);
    }


    const selectedCurve = appState.getSelectedCurve?.();

    const payload = {
      tableName,
      source: preferredSource,
      selectedCurve,
      selectedDealsTableName: dealsName || '',
      selectedPortTableName: portName || '',
      selectedOffersTableName: offersName || '',
      ...extraParam,
    };

   
    console.log('[FV] selectedCurve =', selectedCurve);
    console.log('[FV] payload =', payload);

    window.api?.send?.('start-py-fairValue', payload);
  }

  function handleMVaRProject(buttonElement, extraParam = {}) {
    const selectedTableName = appState.getSelectedPortTableName?.();
    if (!selectedTableName) throw new Error('No table selected for MVaR processing.');

    // Interval priority: an explicit user selection this session wins; otherwise
    // the customer default (CustomerMarketRiskSetting), otherwise the fallback.
    const customerDefaultIntervalFromStore =
      appState.getCustomerMarketRiskSetting?.()?.default_market_risk_interval_code || null;
    const sessionSelectedInterval = appState.sessionSelectedMvarInterval || null;
    const marketRiskIntervalTouched = !!appState.marketRiskIntervalTouched;
    const fallbackInterval = appState.mvarFallbackInterval || null;

    // Batch-Lauf ("Calculate all selected"): eine explizit uebergebene Intervall-LISTE
    // gewinnt immer (Python rechnet ROLLING + alle Szenarien in EINEM Job, Setup einmal).
    // intervalOverride (Einzel) bleibt fuer die Einzel-Panel-Laeufe erhalten.
    const intervalsOverride = Array.isArray(extraParam?.intervalsOverride) && extraParam.intervalsOverride.length
      ? extraParam.intervalsOverride.map(String)
      : null;
    const intervalOverride = extraParam && extraParam.intervalOverride
      ? String(extraParam.intervalOverride)
      : null;
    const finalIntervalUsed = (intervalsOverride ? intervalsOverride[0] : intervalOverride) || (marketRiskIntervalTouched
      ? sessionSelectedInterval
      : (customerDefaultIntervalFromStore || fallbackInterval));

    const source = marketRiskIntervalTouched
      ? 'USER_SELECTION'
      : (customerDefaultIntervalFromStore ? 'CUSTOMER_SETTING' : 'FALLBACK');

    if (!finalIntervalUsed) {
      throw new Error('No scenario selected. Bitte wähle ein Market-Risk-Intervall aus.');
    }

    // VaR horizon (var_days) and confidence are customer settings now, NOT taken
    // silently from MVaRInput. Fallback 10 / 0.95 if no customer setting.
    const setting = appState.getCustomerMarketRiskSetting?.() || null;

    let varDays = Math.trunc(Number(setting?.var_days));
    const varDaysFromSetting = Number.isFinite(varDays) && varDays > 0;
    if (!varDaysFromSetting) varDays = 10;
    const varDaysSource = varDaysFromSetting ? 'CUSTOMER_SETTING' : 'FALLBACK';

    let confidence = Number(setting?.confidence);
    const confidenceFromSetting = Number.isFinite(confidence) && confidence > 0 && confidence < 1;
    if (!confidenceFromSetting) confidence = 0.95;
    const confidenceSource = confidenceFromSetting ? 'CUSTOMER_SETTING' : 'FALLBACK';

    // START/END come from the read model row of the chosen interval.
    const viewRows = appState.getMvarModelSelectionAppRows?.() || [];
    const intervalRow = viewRows.find((r) => String(r.INTERVAL_NAME) === String(finalIntervalUsed)) || null;
    const start = intervalRow ? (intervalRow.START ?? null) : null;
    const end = intervalRow ? (intervalRow.END ?? null) : null;

    console.log('[MVAR RUN CONFIG - BEFORE SPAWN]', {
      finalIntervalUsed,
      start,
      end,
      varDaysSource,
      varDays,
      confidenceSource,
      confidence,
      intervalSource: source,
    });

    appState.selectedMvarInterval = finalIntervalUsed;

    const checked = document.querySelector('.scenario-radio:checked');
    const idAttr = checked?.getAttribute('data-id');
    const selectedId = idAttr != null ? parseInt(idAttr, 10) : null;
    if (!Number.isNaN(selectedId) && selectedId != null) appState.selectedMvarId = selectedId;

    const payload = {
      tableName: selectedTableName,
      selectedInterval: finalIntervalUsed,          // Einzel / Back-compat
      var_days: varDays,
      confidence,
    };
    // Batch: alle Intervalle mitgeben -> EIN py-Job. START/END pro Szenario loest
    // Python via resolve_interval auf, daher hier keine per-Intervall-Fenster noetig.
    if (intervalsOverride) payload.selectedIntervals = intervalsOverride;
    window.api.send('start-py-MVaR', payload);
  }

  function handleCVaRProject(buttonElement, extraParam = {}) {
    const port_name = appState.getSelectedPortTableName?.();

    // Aktives CS-Szenario aus CS_ACTIVE (Set CS Scenario) statt der statischen
    // 'default'. Der Credit-Implied-Rebuild laeuft mit ccy='EUR' -> EUR-Aktivzeile.
    const activeCsRows = appState.getCSActive?.() || [];
    const eurActive = activeCsRows.find(
      (r) => String(r?.ccy || '').trim().toUpperCase() === 'EUR'
    );
    const CSSzenario = String(eurActive?.scenario_id || 'BASE').trim() || 'BASE';

    if (!extraParam.cvarName) throw new Error('No CVaR configuration name (cvarName) provided.');

    const payload = { tableName: port_name, CSSzenario, cvarName: extraParam.cvarName };
    window.api.send('start-py-CVaR', payload);
  }

  function handleHistProject(buttonElement, extraParam) {
    setLastHistButton?.(buttonElement);
    window.api.send('start-py-historicData', { ...extraParam });
  }

  function handleSwaptionProject(buttonElement, extraParam = {}) {
    const selectedCurve = appState.getSelectedCurve?.() || 'EUSWAP';
    window.api?.send?.('start-py-swaption', { selectedCurve, ...extraParam });
  }

  function handleMLProject(extraParam) {
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



  function handleCSParProject(buttonElement, extraParam = {}) {
    const selectedTableName = 'CSParameter';

    const CSSzenario = 'BASE';
    const selectedRows = ['BASE'];

    const payload = {
      tableName: selectedTableName,
      ...extraParam,
      CSSzenario,
      selectedRows,
      mode: 'BASE',
    };

    console.log('[py-cspar] BASE rebuild payload =', payload);

    window.api.send('start-py-cspar', payload);
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

  function handleProjectResponse(buttonElement, projectName, response) {
    console.log('handleProjectResponse: wird ausgeführt')
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
      'py-erste':        'Get Market Data',
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
            updateExcelRankButton:      'RANK',
            updateExcelMarketButton:    'MARKET',

          };

          const mode = modeMap[buttonElement.id] || 'ALL';

          console.log('[PY EXCEL] button id =', buttonElement.id);
          console.log('[PY EXCEL] mode =', mode);

          sendPayloadToAPI(projectName, mode, extraParam);
          break;
        }

        case 'py-swaption':
          handleSwaptionProject(buttonElement, extraParam);
          break;

        case 'py-erste': {
          // Get Market Data: Erste-Snapshot -> MARKET_DATA.xlsm (kein table-Arg).
          // Drawer-Auswahl lesen: angehakte Konventionen (= market_data_type).
          const mdSel = document.getElementById('marketDataSelector');
          if (mdSel) {
            // Base-per-Tenor-Matrix: alle angehakten Zellen -> genutzte Konventionen
            // (dedupliziert). Eine Spalte mit >=1 Haken wird geholt. Leerer Drawer
            // (Curve-Construction-Panel noch nicht geöffnet) -> keine types ->
            // der Handler holt dann alle INCLUDE=1-Konventionen (altes Default).
            const types = Array.from(new Set(
              Array.from(
                mdSel.querySelectorAll('input[type="checkbox"][value]:checked')
              ).map((cb) => cb.value)
            ));
            extraParam.types = types;
          }
          sendPayloadToAPI('py-erste', '', extraParam);
          break;
        }

        default: {
          const selectedTableName = appState.getSelectedDealsTableName?.() || 'DealsMain';
          sendPayloadToAPI(projectName, selectedTableName, extraParam);
          break;
        }
      }

      const handler = () => {
        buttonElement.disabled = false;
        buttonElement.textContent = originalLabel || 'Run';
      };

      const fallbackCompleteChannel = `${projectName}-complete`;
      once?.(fallbackCompleteChannel, handler);

    } catch (error) {
      console.error(`Error handling project "${projectName}":`, error);
      alert('An error occurred while executing the project.');
      buttonElement.disabled = false;
      buttonElement.textContent = originalLabel || 'Run';
    }
  }

  return {
    handleProjectButtonClick,
    handleProjectResponse,
  };
}
