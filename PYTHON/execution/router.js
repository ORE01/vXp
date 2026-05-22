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

    const CSSzenario = String(appState.getCSSzenarioData?.() || 'default').trim();



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



  function handleCSParProject(buttonElement, extraParam) {
  const selectedTableName = 'CSParameter';

  const latestCSActive = (appState.getCSActive?.() || [])
    .sort((a, b) => new Date(b.activated_at || 0) - new Date(a.activated_at || 0))[0];

  const CSSzenario = String(latestCSActive?.scenario_name || '').trim();

  if (!CSSzenario) {
    throw new Error('Please select at least one scenario.');
  }

  

  const selectedRows = [CSSzenario];
  const payload = { tableName: selectedTableName, ...extraParam, CSSzenario, selectedRows };

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
