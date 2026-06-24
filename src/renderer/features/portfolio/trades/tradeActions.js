// portfolio/trades/tradeActions.js
// Aktions-Handler des Trade-Editors (Create / Change Portfolio):
// Save/Delete Selection, Add Products, Fill Trade Details, Calculate, Add Trade.

import {
  getPortfolioCreationName,
  focusPortfolioCreationName,
} from '../createPortfolio/portfolioCreationPanel.js';

import { openAddProductsDrawer } from '../tradeEntry/addProductsDrawer.js';
import { openFillTradeDetailsDrawer } from '../tradeEntry/fillTradeDetailsDrawer.js';

const ALL = '__ALL__';

export function createTradeActions({
  appState,
  api,
  showMessageBox,
  showConfirmationBox,
} = {}) {
  if (!appState) throw new Error('[createTradeActions] appState missing');
  if (!api) throw new Error('[createTradeActions] api missing');

  function showInfo(message, afterClose) {
    if (typeof showMessageBox === 'function') {
      showMessageBox(message, () => {
        requestAnimationFrame(() => {
          afterClose?.();
        });
      });
      return;
    }

    console.warn('[TradeActions] showMessageBox missing:', message);
    afterClose?.();
  }

  function showConfirm(message, onConfirm, onCancel) {
    if (typeof showConfirmationBox === 'function') {
      showConfirmationBox(
        message,
        () => {
          requestAnimationFrame(() => {
            onConfirm?.();
          });
        },
        () => {
          requestAnimationFrame(() => {
            onCancel?.();
          });
        }
      );
      return;
    }

    console.warn('[TradeActions] showConfirmationBox missing:', message);
    onCancel?.();
  }

  function focusAndSelect(el) {
    requestAnimationFrame(() => {
      setTimeout(() => {
        el?.focus?.();
        el?.select?.();
      }, 50);
    });
  }

  function handleSaveSelection() {
    const nameEl = document.getElementById('nameInput');
    const port_name = String(nameEl?.value ?? '').trim();

    if (!port_name) {
      showInfo('Please enter a portfolio name first.', () => {
        focusAndSelect(nameEl);
      });

      return;
    }

    // 1) Try tradeDropdown (preferred)
    const tradeEl = document.getElementById('tradeDropdown');
    let selectedTradeIDs = [];

    if (tradeEl) {
      const selectedVals = Array.from(tradeEl.selectedOptions).map(o => String(o.value ?? '').trim());
      const hasAll = selectedVals.includes(ALL);

      if (!hasAll) {
        selectedTradeIDs = selectedVals
          .filter(v => v && v !== ALL)
          .map(v => Number(v))
          .filter(n => Number.isFinite(n));
      }
    }

    // 2) If tradeDropdown is ALL (or missing selection), fall back to filtered rows
    if (!selectedTradeIDs.length) {
      const rows = Array.isArray(appState.__filteredDealsUI) ? appState.__filteredDealsUI : [];
      selectedTradeIDs = rows
        .map(r => Number(r?.TRADE_ID))
        .filter(n => Number.isFinite(n));
    }

    console.log('[UI] save-deals-selection payload', {
      port_name,
      selectedTradeIDsCount: selectedTradeIDs.length,
      preview: selectedTradeIDs.slice(0, 5),
    });

    if (!selectedTradeIDs.length) {
      showInfo('Please select at least one TRADE_ID.', () => {
        tradeEl?.focus?.();
      });
      return;
    }

    // Main handler expects exactly { port_name, selectedTradeIDs }
    api.send('save-deals-selection', { port_name, selectedTradeIDs });

    appState.__lastCreatedPortfolioName = port_name;

    showMessageBox?.(`Portfolio "${port_name}" successfully created!`, () => {});
  }

  function handleDeleteSelection() {
    const port =
      String(appState.getSelectedDealsTableName?.() ?? '').trim() ||
      String(document.getElementById('createdDealsDropdown')?.value ?? '').trim();

    if (!port || port === '__NONE__' || port === '__ALL__' || port === 'Select a table') {
      showInfo('Please select a specific portfolio to delete.');
      return;
    }

    const doDelete = () => {
      console.log('[UI] delete portfolio everywhere:', port);
      api.send('delete-portfolio-everywhere', { port_name: port });
    };

    showConfirm(
      `Are you sure you want to delete the portfolio "${port}"?\n\nThis will remove ALL related data (Deals, Risk, History).`,
      doDelete,
      () => {}
    );
  }

  function handleAddProductsCreate() {
    const port =
      String(getPortfolioCreationName?.() ?? '').trim() ||
      String(appState.__lastCreatedPortfolioName ?? '').trim();

    if (!port) {
      showInfo('Please enter a portfolio name and click "Create Portfolio" first.', () => {
        focusPortfolioCreationName?.();
      });
      return;
    }

    openAddProductsDrawer({ appState, api, portName: port });
  }

  function handleAddProductsChange() {
    const port =
      String(appState.getSelectedDealsTableName?.() ?? '').trim() ||
      String(document.getElementById('createdDealsDropdown')?.value ?? '').trim();

    if (!port || port === '__NONE__' || port === '__ALL__' || port === 'Select a table') {
      showInfo('Please select a specific portfolio first.');
      return;
    }

    openAddProductsDrawer({ appState, api, portName: port });
  }

  // Prepare a "Calculate Portfolio" run from the Create panel: point the deals
  // selection at the just-created portfolio so the fair-value flow (and the
  // auto-switch to the SELECT PORTFOLIO tab) targets it. Returns '' if invalid.
  function prepareCalculateCreate() {
    const port =
      String(getPortfolioCreationName?.() ?? '').trim() ||
      String(appState.__lastCreatedPortfolioName ?? '').trim();

    if (!port) {
      showInfo('Please enter a portfolio name and click "Create Portfolio" first.', () => {
        focusPortfolioCreationName?.();
      });
      return '';
    }

    appState.setSelectedDealsTableName?.(port);
    return port;
  }

  function handleFillDetailsCreate() {
    const port =
      String(getPortfolioCreationName?.() ?? '').trim() ||
      String(appState.__lastCreatedPortfolioName ?? '').trim();

    if (!port) {
      showInfo('Please enter a portfolio name and click "Create Portfolio" first.', () => {
        focusPortfolioCreationName?.();
      });
      return;
    }

    openFillTradeDetailsDrawer({ appState, api, portName: port });
  }

  function handleFillDetailsChange() {
    const port =
      String(appState.getSelectedDealsTableName?.() ?? '').trim() ||
      String(document.getElementById('createdDealsDropdown')?.value ?? '').trim();

    if (!port || port === '__NONE__' || port === '__ALL__' || port === 'Select a table') {
      showInfo('Please select a specific portfolio first.');
      return;
    }

    openFillTradeDetailsDrawer({ appState, api, portName: port });
  }

  function handleAddTradeToNewPortfolio(event) {
    const port_name = getPortfolioCreationName();

    if (!port_name) {
      showInfo('Please enter a portfolio name first.', () => {
        focusPortfolioCreationName();
      });
      return;
    }

    appState.__lastCreatedPortfolioName = port_name;

    console.log('[UI] create-empty-portfolio', { port_name });

    api.send('create-empty-portfolio', { port_name });
  }

  return {
    handleSaveSelection,
    handleDeleteSelection,
    handleAddProductsCreate,
    handleAddProductsChange,
    handleFillDetailsCreate,
    handleFillDetailsChange,
    prepareCalculateCreate,
    handleAddTradeToNewPortfolio,
  };
}
