// portfolio/tradeEditor/tradeDataHandlers.js
// Daten-Handler des Trade-Editors. Diese Keys werden vom IPC-Router/Receiver
// PER NAMEN konsumiert (handlePortNameList, handleDealsMainData,
// handlePortfolioData) → NICHT umbenennen (externer Vertrag bleibt vorerst).

export function createTradeDataHandlers({ appState } = {}) {
  if (!appState) throw new Error('[createTradeDataHandlers] appState missing');

  function handlePortNameList(/* receivedData */) {
    // Port-Dropdowns werden jetzt aus DealsMain befüllt (siehe handleDealsMainData),
    // damit AUCH noch nicht berechnete Portfolios auswählbar sind.
    // Die enriched-View (PortfoliosData) bleibt Datenquelle für die Tabellen-Anzeige
    // (handlePortfolioData → setAllPortfolioData) und für die Enriched-Warnung.
    // Daher hier KEINE Dropdown-Befüllung mehr.
  }

  function handleDealsMainData(receivedData) {
    const rows = Array.isArray(receivedData) ? receivedData : [];

    const isOfferRow = (r) => String(r?.port_name ?? '').toUpperCase().startsWith('OFFERS');

    const offers = rows.filter(isOfferRow);
    const deals  = rows.filter(r => !isOfferRow(r));

    appState.setDealsData?.(deals);
    appState.setOffersData?.(offers);
    appState.setAllDealsData?.(rows);

    // Port-Dropdowns (0/1/2) aus DealsMain befüllen: ALLE Portfolios mit Trades
    // (Offers ausgenommen) — auch noch nicht berechnete. createdPortDropdownRisk
    // spiegelt 0 automatisch (tabs.js).
    try {
      const portNames = deals
        .map(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim())
        .filter(Boolean);
      const uniquePortfolios = [...new Set(portNames)].map(name => ({ table_name: name }));

      ['createdPortDropdown0', 'createdPortDropdown1', 'createdPortDropdown2'].forEach((dropdown, index) => {
        appState.setPortNameList?.(uniquePortfolios, dropdown);
        appState.applyFiltersAndUpdateDropdowns?.(`portTables${index}`);
      });
    } catch (e) {
      console.error('[handleDealsMainData] Port-Dropdown aus DealsMain fehlgeschlagen:', e);
    }

    // rebuild createdDealsDropdown options from updated data
    const dd = document.getElementById('createdDealsDropdown');
    if (dd) {
      const prev = String(dd.value ?? '__NONE__').trim();
      setTimeout(() => {
        appState.applyFiltersAndUpdateDropdowns?.('dealsTables', { preselect: prev });
      }, 0);
    }

    // update New Portfolio preview with ONLY the last created portfolio
    try {
      const last = String(appState.__lastCreatedPortfolioName ?? '').trim();
      if (last) {
        const onlyThis = deals.filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === last);

        appState.handleDealsData?.(onlyThis, last, {
          forceTarget: 'newPortfolio',
          restoreDropdown: false,
          mirrorToNewPortfolio: false,
          allowClear: true,
        });
      }
    } catch (e) {
      console.warn('[handleDealsMainData] newPortfolio preview update failed:', e);
    }
  }

  function handlePortfolioData(receivedData) {
    // Keep existing behavior (other panel).
    appState.setAllPortfolioData?.(receivedData);
    appState.setActiveTable?.('deals');

    // Markieren: die enriched-View (PortfoliosData = v_Portfolios_enriched) wurde
    // mindestens einmal empfangen — auch wenn leer. Nötig, damit die "noch nicht
    // berechnet"-Warnung (portfolioDropdownUI) NICHT fälschlich feuert, solange die
    // enriched-View überhaupt noch nicht geladen war.
    appState.__enrichedReceived = true;
  }

  return {
    handlePortNameList,
    handleDealsMainData,
    handlePortfolioData,
  };
}
