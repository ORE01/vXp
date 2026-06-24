// portfolio/tradeEditor/bindTradeButtons.js
// DOM-Button-Verdrahtung für den Trade-Editor (Create / Change Portfolio).
// Aus der globalen bindAppButtons.js herausgelöst – Verhalten unverändert.

export function bindTradeButtons({ dealsActions, py } = {}) {
  if (!dealsActions) {
    console.warn('[bindTradeButtons] dealsActions missing');
    return;
  }

  document.getElementById('saveSelectionButton')
    ?.addEventListener('click', dealsActions.handleSaveSelection);

  document.getElementById('deleteTableButton')
    ?.addEventListener('click', dealsActions.handleDeleteSelection);

  document.getElementById('deletePortfolioButton')
    ?.addEventListener('click', dealsActions.handleDeleteSelection);

  document.getElementById('addProductsButtonCreate')
    ?.addEventListener('click', dealsActions.handleAddProductsCreate);

  document.getElementById('addProductsButtonChange')
    ?.addEventListener('click', dealsActions.handleAddProductsChange);

  document.getElementById('fillDetailsButtonCreate')
    ?.addEventListener('click', dealsActions.handleFillDetailsCreate);

  document.getElementById('fillDetailsButtonChange')
    ?.addEventListener('click', dealsActions.handleFillDetailsChange);

  // Calculate Portfolio from the Create panel: same flow as the Change-panel
  // Calculate button (source 'deals' -> auto-switch to SELECT PORTFOLIO tab).
  document.getElementById('fairValueButtonCreate')
    ?.addEventListener('click', (e) => {
      const port = dealsActions.prepareCalculateCreate?.();
      if (!port) return;

      if (!py || typeof py.handleProjectButtonClick !== 'function') {
        console.warn('[bindTradeButtons] py missing or invalid');
        return;
      }
      py.handleProjectButtonClick(e.currentTarget, 'py-fairValue');
    });

  document.getElementById('portfolioDealsAddButton')
    ?.addEventListener('click', dealsActions.handleAddTradeToNewPortfolio);
}
