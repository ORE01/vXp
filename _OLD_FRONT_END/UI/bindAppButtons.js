// FRONT_END/UI/bindAppButtons.js

/**
 * Central UI button bindings for the app.
 * Renderer should only call: bindAppButtons({ ...deps })
 *
 * NOTE: This module contains ONLY UI binding (DOM events),
 * no IPC receiver wiring.
 */

export function bindAppButtons({
  dealsActions,
  py, // window.__py
  
  updateTooltipsFn, // function(language) { ... }  (optional)
  handleHistoricMetricsAddClick,

  // excel / import
  handleExcelImport,

  // AI mapping / matching
  
  handleSubmitMatchedColumns,
  startOfferImport,
  handleSubmitMatching,
  quickImportWithStandardMapping,

  // provider (tabs are already moved out, so NOT here)

  // optional: you can pass a callback to toggle theme
} = {}) {
  if (!dealsActions) {
    console.warn('[bindAppButtons] dealsActions missing');
    return;
  }

  // idempotent
  if (window.__appButtonsBoundOnce) return;
  window.__appButtonsBoundOnce = true;

  // ---------- Deals / Portfolio ----------
  document.getElementById('savePortfolioButton')
    ?.addEventListener('click', dealsActions.handleSaveNewPortfolio);

  document.getElementById('saveSelectionButton')
    ?.addEventListener('click', dealsActions.handleSaveSelection);

  document.getElementById('deleteTableButton')
    ?.addEventListener('click', dealsActions.handleDeleteSelection);

  document.getElementById('portfolioDealsAddButton')
    ?.addEventListener('click', dealsActions.handleAddDealsToNewPortfolio);

  // ---------- Historic Metrics ----------
  document.getElementById('historicMetricsAddButton')
    ?.addEventListener('click', handleHistoricMetricsAddClick);

  // ---------- Excel Import ----------
  document.getElementById('importExcelButtonVXP')
    ?.addEventListener('click', handleExcelImport);

  document.getElementById('importEUSWButton')
    ?.addEventListener('click', () => handleExcelImport?.(['EUSW']));

  // ---------- Matching / Offers ----------

  document.getElementById('submitToProductsBtn')
    ?.addEventListener('click', () => handleSubmitMatchedColumns?.('productMatchesOutput', 'ProdAll'));

  document.getElementById('submitToOffersBtn')
    ?.addEventListener('click', () => handleSubmitMatchedColumns?.('offerMatchesOutput', 'DealsMain', { port_name: 'LGT' }));

  document.getElementById('importOffersBtn')
    ?.addEventListener('click', () => startOfferImport?.());

  document.getElementById('submitMatchingBtn')
    ?.addEventListener('click', () => handleSubmitMatching?.());

  document.getElementById('btnQuickImport')
    ?.addEventListener('click', () => quickImportWithStandardMapping?.());

  // ---------- Python execution buttons ----------
  const projectButtons = [
    { buttonId: 'fairValueButton', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton1', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton2', projectName: 'py-fairValue' },
    { buttonId: 'fairValueButton3', projectName: 'py-fairValue' },

    { buttonId: 'CSParButton', projectName: 'py-cspar' },
    { buttonId: 'MLButton', projectName: 'py-ml' },

    { buttonId: 'matchColumnsButton', projectName: 'py-matchColumns' },
    { buttonId: 'updateHistoricDataButton', projectName: 'py-historicData' },

    // Excel-Import
    { buttonId: 'updateExcelAllButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelIssuerButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelProductsButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelDealsButton', projectName: 'py-excel' },
    { buttonId: 'updateExcelEuswButton', projectName: 'py-excel' },

    // Hist
    { buttonId: 'histEcbButton', projectName: 'py-hist' },
    { buttonId: 'histFedButton', projectName: 'py-hist' },
    { buttonId: 'histYahooButton', projectName: 'py-hist' },

    // Swaption cube runner
    { buttonId: 'swaptionCubeRunButton', projectName: 'py-swaption' },
  ];

  projectButtons.forEach(({ buttonId, projectName, extraParam }) => {
    const button = document.getElementById(buttonId);
    button?.addEventListener('click', () => {
      if (!py || typeof py.handleProjectButtonClick !== 'function') {
        console.warn('[bindAppButtons] py missing or invalid');
        return;
      }
      py.handleProjectButtonClick(button, projectName, extraParam);
    });
  });

  // ---------- Radio-based python project buttons (MVaR / CVaR) ----------
  function setupRadioProjectButton({
    buttonId,
    projectName,
    radioSelector,
    valueAttr,
    payloadKey,
    emptyMessage,
  }) {
    const button = document.getElementById(buttonId);
    if (!button) return;

    button.addEventListener('click', (event) => {
      const selectedRadio = document.querySelector(`${radioSelector}:checked`);
      if (!selectedRadio) {
        alert(emptyMessage || 'Please select an option!');
        return;
      }

      const value = selectedRadio.getAttribute(valueAttr);
      if (!value) {
        alert(`Selected row has no ${valueAttr} attribute.`);
        return;
      }

      if (!py || typeof py.handleProjectButtonClick !== 'function') {
        console.warn('[bindAppButtons] py missing or invalid');
        return;
      }

      py.handleProjectButtonClick(event.target, projectName, { [payloadKey]: value });
    });
  }

  setupRadioProjectButton({
    buttonId: 'mvaRDistButton',
    projectName: 'py-MVaR',
    radioSelector: '.scenario-radio',
    valueAttr: 'data-interval',
    payloadKey: 'selectedInterval',
    emptyMessage: 'Select a Timeperiode!',
  });

  setupRadioProjectButton({
    buttonId: 'CVaRButton',
    projectName: 'py-CVaR',
    radioSelector: '.cvar-radio',
    valueAttr: 'data-name',
    payloadKey: 'cvarName',
    emptyMessage: 'Select a CVaR configuration!',
  });

  // ---------- Language / tooltips ----------
  // If you pass updateTooltipsFn, we use it. Otherwise we do nothing here.
  if (typeof updateTooltipsFn === 'function') {
    updateTooltipsFn('en');

    [
      { buttonId: 'lang-en', lang: 'en' },
      { buttonId: 'lang-de', lang: 'de' },
    ].forEach(({ buttonId, lang }) => {
      document.getElementById(buttonId)?.addEventListener('click', () => updateTooltipsFn(lang));
    });
  }

  // ---------- Theme toggle ----------
  document.getElementById('themeToggle')?.addEventListener('click', () => {
    document.body.classList.toggle('light-theme');
  });
}
