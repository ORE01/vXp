// FRONT_END/SELECT_PORTFOLIO/dealsPortfolioActions.js

const USE_NEW_DEALS_UI = true;
const ALL = '__ALL__';

export function createDealsPortfolioActions({
  appState,
  api,
  showMessageBox,
  showConfirmationBox,
  handleModalAction,
} = {}) {
  if (!appState) throw new Error('[createDealsPortfolioActions] appState missing');
  if (!api) throw new Error('[createDealsPortfolioActions] api missing');


  // one-time IPC listeners for delete feedback (avoid duplicate bindings)
  if (!window.__dealsDeleteEverywhereListenersBound) {
    window.__dealsDeleteEverywhereListenersBound = true;

    api.receive?.('delete-portfolio-everywhere-success', ({ port, deleted } = {}) => {
      console.log('[UI] delete-portfolio-everywhere-success', { port, deleted });

      showMessageBox?.(`Portfolio "${port}" deleted.`, () => {});

      // reset deals dropdown to NONE
      const dd = document.getElementById('createdDealsDropdown');
      if (dd) {
        dd.value = '__NONE__';
        dd.dispatchEvent(new Event('change', { bubbles: true }));
      }

      // optional: clear inputs
      const nameEl = document.getElementById('nameInput');
      if (nameEl) nameEl.value = '';

      const tagEl = document.getElementById('tagInputField');
      if (tagEl) tagEl.value = '';
    });

    api.receive?.('delete-portfolio-everywhere-error', ({ message } = {}) => {
      console.error('[UI] delete-portfolio-everywhere-error', message);
      alert(message || 'Delete failed.');
    });
  }








  /* ============================================================
     NAME LISTS (LEGACY) – gated off for NEW Deals UI
     ============================================================ */

  function handleDealsNameList(_receivedData) {
    if (USE_NEW_DEALS_UI) return; // DealsUI owns createdDealsDropdown
    // legacy code intentionally disabled
  }

  function handleOffersNameList(receivedData) {
    // Offers is separate; keep as-is if you still use legacy offers dropdown.
    try {
      const dropdownId = 'createdOffersDropdown';
      const dd = document.getElementById(dropdownId);

      const prevValue = String(dd?.value ?? appState.getSelectedOffersTableName?.() ?? '').trim();

      const names = (receivedData || []).map(e => e?.port_name).filter(Boolean);
      const unique = [...new Set(names)];

      const isOffer = (n) => typeof n === 'string' && /^OFFERS?_/.test(n.toUpperCase());
      const filteredOffers = unique.filter(isOffer);

      let offersListRaw = filteredOffers.length ? filteredOffers : unique;
      if (!offersListRaw.length) return;

      const offersList = offersListRaw.map(name => ({ table_name: name }));

      if (typeof appState.setOffersNameList === 'function') {
        appState.setOffersNameList(offersList, dropdownId);
      }
      if (typeof appState.applyFiltersAndUpdateDropdowns === 'function') {
        appState.applyFiltersAndUpdateDropdowns('offersTables');
      }

      setTimeout(() => {
        const dropdown = document.getElementById(dropdownId);
        if (!dropdown) return;

        const hasValue = Array.from(dropdown.options || []).some(
          opt => String(opt.value) === String(prevValue)
        );

        if (prevValue && hasValue) {
          dropdown.value = prevValue;
          dropdown.dispatchEvent(new Event('change', { bubbles: true }));
        }
      }, 0);
    } catch (error) {
      console.error('❌ Error processing offers name list:', error);
    }
  }

  function handlePortNameList(receivedData) {
    // Portfolio dropdowns belong to Portfolio panel; keep as-is.
    try {
      const names = (receivedData || []).map(e => e?.port_name).filter(Boolean);
      const uniquePortfolios = [...new Set(names)].map(name => ({ table_name: name }));

      ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdown, index) => {
        appState.setPortNameList?.(uniquePortfolios, dropdown);
        appState.applyFiltersAndUpdateDropdowns?.(`portTables${index}`);
      });
    } catch (error) {
      console.error('❌ Error processing created port data:', error);
    }
  }

  /* ============================================================
     ACTIONS
     ============================================================ */

  function handleSaveNewPortfolio() {
    const inputEl = document.getElementById('PortfolioNameInput');
    const port_name = String(inputEl?.value ?? '').trim();
    if (!port_name) {
      alert('Please enter a portfolio name.');
      inputEl?.focus?.();
      return;
    }

    try {
      api.send('save-portfolio-name', { port_name });
    } catch (e) {
      console.warn('save-portfolio-name IPC failed:', e);
    }

    appState.setSelectedDealsTableName?.(port_name);
    appState.setSelectedPortTableName?.(port_name);

    showMessageBox?.(`Portfolio "${port_name}" successfully saved!`, () => {});
  }

  /**
   * NEW Deals UI save:
   * - Name comes from #nameInput
   * - Trade IDs come primarily from #tradeDropdown selection
   * - If tradeDropdown is ALL => take IDs from appState.__filteredDealsUI
   * - No tags
   */
  function handleSaveSelection() {
    const nameEl = document.getElementById('nameInput');
    const port_name = String(nameEl?.value ?? '').trim();

    if (!port_name) {
      alert('Please enter a portfolio name.');
      nameEl?.focus?.();
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

    // 2) If tradeDropdown is ALL (or missing selection), fall back to filtered rows (from DealsUI)
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
      alert('Please select at least one TRADE_ID.');
      tradeEl?.focus?.();
      return;
    }

    // Main handler expects exactly { port_name, selectedTradeIDs }
    api.send('save-deals-selection', { port_name, selectedTradeIDs });

    showMessageBox?.(`Portfolio "${port_name}" successfully created!`, () => {});
  }

  function handleDeleteSelection() {
    const port =
      String(appState.getSelectedDealsTableName?.() ?? '').trim() ||
      String(document.getElementById('createdDealsDropdown')?.value ?? '').trim();

    if (!port || port === '__NONE__' || port === '__ALL__' || port === 'Select a table') {
      alert('Please select a specific portfolio to delete.');
      return;
    }

    const doDelete = () => {
      console.log('[UI] delete portfolio everywhere:', port);

      api.send('delete-portfolio-everywhere', { port_name: port });
    };

    if (typeof showConfirmationBox === 'function') {
      showConfirmationBox(
        `Are you sure you want to delete the portfolio "${port}"?\n\nThis will remove ALL related data (Deals, Risk, History).`,
        doDelete,
        () => {}
      );
    } else {
      if (confirm(`Delete portfolio "${port}" everywhere?`)) doDelete();
    }
  }


  function handleAddDealsToNewPortfolio(event) {
    // Keep as a modal helper: uses current deals context as source
    const inputEl = document.getElementById('PortfolioNameInput');
    const port_name = String(inputEl?.value ?? '').trim();

    if (!port_name) {
      alert('Please enter a portfolio name first.');
      inputEl?.focus?.();
      return;
    }

    let dealsData =
      appState.__filteredDealsUI ||
      appState.getDealsData?.() ||
      [];

    if (!Array.isArray(dealsData) || dealsData.length === 0) {
      alert('No deals available.');
      return;
    }

    handleModalAction?.(event, dealsData, null, 'DealsMain', 'add');

    // Optional: prefill PORT_NAME in modal
    setTimeout(() => {
      const form = document.getElementById('editForm') || document.querySelector('#modal form');
      if (!form) return;

      const portField =
        form.querySelector('[data-field="PORT_NAME"]') ||
        form.querySelector('[data-field="port_name"]');

      if (portField) {
        portField.value = port_name;
        portField.dispatchEvent(new Event('input', { bubbles: true }));
      }
    }, 0);
  }


  function handleDealsMainData(receivedData) {
    const rows = Array.isArray(receivedData) ? receivedData : [];

    const isOfferRow = (r) => String(r?.port_name ?? '').toUpperCase().startsWith('OFFERS');

    const offers = rows.filter(isOfferRow);
    const deals  = rows.filter(r => !isOfferRow(r));

    appState.setDealsData?.(deals);
    appState.setOffersData?.(offers);
    appState.setAllDealsData?.(rows);

    // ✅ IMPORTANT: rebuild createdDealsDropdown options from updated data
    // (NEW Deals UI owns createdDealsDropdown, so we must trigger dealsTables recompute)
    const dd = document.getElementById('createdDealsDropdown');
    if (dd) {
      const prev = String(dd.value ?? '__NONE__').trim();
      setTimeout(() => {
        appState.applyFiltersAndUpdateDropdowns?.('dealsTables', { preselect: prev });
      }, 0);
    }
  }


  function handlePortfolioData(receivedData) {
    // Keep existing behavior (other panel).
    appState.setAllPortfolioData?.(receivedData);
    appState.setActiveTable?.('deals');
  }

  return {
    handleDealsNameList,
    handleOffersNameList,
    handlePortNameList,
    handleSaveNewPortfolio,
    handleSaveSelection,
    handleDeleteSelection,
    handleAddDealsToNewPortfolio,
    handleDealsMainData,
    handlePortfolioData,
  };
}

