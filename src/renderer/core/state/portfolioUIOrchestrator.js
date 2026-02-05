// core/state/portfolioUIOrchestrator.js
// Enthält UI-Render-Orchestrierung für Portfolios + Offers.
// AppState bleibt State-only.

import { handlePortAggData, handlePortProdData } from '../../features/SELECT_PORTFOLIO/PORT.js';
import { handleLiquidityData } from '../../features/ANALYSE_PORTFOLIO/liquidity.js';
import { handleSummaryNotionalData } from '../../features/ANALYSE_PORTFOLIO/SummaryBreakdown.js';
import { handleSummaryYieldData } from '../../features/ANALYSE_PORTFOLIO/SummaryYield.js';
import { handleSummaryMarketRiskData, handleMvarProductTable } from '../../features/ANALYSE_PORTFOLIO/SummaryMarketRisk.js';
import { handleMVaRData } from '../../features/ANALYSE_PORTFOLIO/MARKET_RISK/MVaR.js';
import { handleCVaRData } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { handleLossIssuerMainData } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js';
import { createComparisonCharts } from '../../features/COMPARE_PORTFOLIOS/COMP.js';
import { formatPercentage } from '../../utils/format.js';
import { handleDealsData } from '../../features/CREATE_PORTFOLIO/DEALS.js';

export function createPortfolioUIOrchestrator({ appState } = {}) {
  if (!appState) throw new Error('[portfolioUIOrchestrator] appState fehlt');

  /* =========================================================
     DEALS / OFFERS (PRE-CALCULATED SPLIT)
     ========================================================= */

  function splitDealsAndOffers(allDeals = []) {
    const isOffer = (r) =>
      String(r?.port_name ?? r?.PORT_NAME ?? '')
        .toUpperCase()
        .startsWith('OFFER');

    return {
      deals: allDeals,
      offers: allDeals.filter(isOffer),
    };
  }

  function renderDealsAndOffers() {
    const allDeals = appState.getAllDealsData?.() || [];
    if (!allDeals.length) return;

    const { deals, offers } = splitDealsAndOffers(allDeals);

    // A) DEALS = gesamtes pre-calculated Portfolio
    handleDealsData(deals, 'ALL', {
      forceTarget: 'deals',
      restoreDropdown: true,
    });

    // B) OFFERS = Subset der Deals (OFFER*)
    handleDealsData(offers, 'OFFERS', {
      forceTarget: 'offers',
      restoreDropdown: false,
    });
  }

  /* =========================================================
     OFFERS ORCHESTRATOR (ENRICHED VIEW – UNVERÄNDERT)
     ========================================================= */

  function renderOffersTable(data, opts = {}) {
    const norm = (v) => String(v ?? '').trim();
    const normKey = (v) => norm(v).toLowerCase();

    const selectedOfferName =
      appState.getSelectedOffersTableName?.() ||
      document.getElementById('createdOffersDropdown')?.value ||
      '';

    const offerName = norm(selectedOfferName);

    const offersEl = document.getElementById('offersDataContainer');
    if (!offerName) {
      if (offersEl) {
        offersEl.innerHTML = '';
        offersEl.style.cssText =
          'display:none;visibility:hidden;height:0;overflow:hidden;';
      }
      const p4 = document.getElementById('portDataContainer4');
      if (p4) p4.innerHTML = '';
      return;
    } else {
      if (offersEl) {
        offersEl.style.cssText =
          'display:block;visibility:visible;height:auto;overflow:auto;';
      }
    }

    // RAW Deals (immer aus DealsMain)
    const allDeals = appState.getAllDealsData?.() || [];
    const baseRows = allDeals.filter(
      (r) => normKey(r?.port_name ?? r?.PORT_NAME) === normKey(offerName)
    );

    // ENRICHED rows (Filter-Engine oder Fallback)
    let enriched = Array.isArray(data) ? data : [];

    if (enriched.length) {
      enriched = enriched.filter(
        (r) => normKey(r?.port_name ?? r?.PORT_NAME) === normKey(offerName)
      );
    }

    if (!enriched.length) {
      const allPorts = appState.getAllPortfolioData?.() || [];
      enriched = allPorts.filter(
        (r) => normKey(r?.port_name ?? r?.PORT_NAME) === normKey(offerName)
      );
    }

    // Orchestrate rendering
    renderOffersRawDealsTable({ offerName, baseRows });
    renderOffersEnrichedPortfolio({ offerName, enriched });
    renderOffersSensTables({ baseRows, enriched });
  }

  function renderOffersRawDealsTable({ offerName, baseRows } = {}) {
    if (!offerName || !Array.isArray(baseRows)) return;
    handleDealsData(baseRows, offerName, {
      forceTarget: 'offers',
      restoreDropdown: false,
    });
  }

  function renderOffersEnrichedPortfolio({ offerName, enriched } = {}) {
    if (Array.isArray(enriched) && enriched.length) {
      handlePortProdData(enriched, 4, offerName);
    } else {
      const p4 = document.getElementById('portDataContainer4');
      if (p4) p4.innerHTML = '';
    }
  }

  function renderOffersSensTables({ baseRows, enriched } = {}) {
    const sensRows =
      Array.isArray(enriched) && enriched.length ? enriched : baseRows;

    const IRSensTable = appState.handleIRSensData?.(sensRows);
    const irEl = document.getElementById('IRSensDataContainer');
    if (IRSensTable && irEl) {
      irEl.innerHTML = '';
      irEl.appendChild(IRSensTable);
    }

    const CSSensTable = appState.handleCSSensData?.(sensRows);
    const csEl = document.getElementById('CSSensDataContainer');
    if (CSSensTable && csEl) {
      csEl.innerHTML = '';
      csEl.appendChild(CSSensTable);
    }
  }

  /* =========================================================
     PORTFOLIO ORCHESTRATOR (UNVERÄNDERT)
     ========================================================= */

  function renderPortTable(data, index) {
    if (!Array.isArray(data) || data.length === 0) return;

    const port_name = appState.getSelectedPortTableName?.();
    if (!port_name) return;

    const filteredData = data.filter(
      (item) => String(item?.port_name) === String(port_name)
    );
    if (!filteredData.length) return;

    handlePortAggData(filteredData, index, port_name);
    handlePortProdData(filteredData, index, port_name);
    handleLiquidityData(filteredData, { appState });

    handleSummaryNotionalData(filteredData, index, port_name);
    handleSummaryYieldData(filteredData, index, port_name);

    const scenario_name = appState.selectedMvarInterval ?? null;
    handleSummaryMarketRiskData(port_name, scenario_name, '2021-01-03');
    handleMvarProductTable(port_name, scenario_name, null);

    const mvarData = appState.getAllMvarData?.() || [];
    handleMVaRData(mvarData, index);

    const cvarData = appState.getAllCvarData?.() || [];
    handleCVaRData(cvarData, index);

    const elementId = `portDataContainer${index}`;

    const filteredMvarData = mvarData.filter(
      (item) => String(item?.port_name) === String(port_name)
    );
    if (filteredMvarData.length) {
      const mvar = filteredMvarData[0];
      appState.setPortAggData?.(elementId, {
        formVaR_T_rel: formatPercentage(mvar?.VaR_T_rel),
        formVaR_IR_rel: formatPercentage(mvar?.VaR_IR_rel),
        formVaR_CS_rel: formatPercentage(mvar?.VaR_CS_rel),
      });
    }

    const filteredCvarData = cvarData.filter(
      (item) => String(item?.port_name) === String(port_name)
    );
    if (filteredCvarData.length) {
      const cvarValues = {};
      for (const entry of filteredCvarData) {
        if (!entry?.pd_flag || entry?.VaR_rel == null) continue;
        const key = `formVaR_${String(entry.pd_flag).toLowerCase()}_rel`;
        cvarValues[key] = formatPercentage(entry.VaR_rel);
      }
      appState.setPortAggData?.(elementId, cvarValues);
    }

    createComparisonCharts(appState.portDataMap, false);

    const ori = appState.getAllPortfolioData?.() || [];
    const filteredOriginal = ori.filter(
      (item) => String(item?.port_name) === String(port_name)
    );
    if (filteredOriginal.length)
      handlePortAggData(filteredOriginal, 3, port_name);

    const IRSensTable = appState.handleIRSensData?.(filteredOriginal);
    const irEl = document.getElementById('IRSensDataContainer');
    if (irEl && IRSensTable) {
      irEl.innerHTML = '';
      irEl.appendChild(IRSensTable);
    }

    const CSSensTable = appState.handleCSSensData?.(filteredOriginal);
    const csEl = document.getElementById('CSSensDataContainer');
    if (csEl && CSSensTable) {
      csEl.innerHTML = '';
      csEl.appendChild(CSSensTable);
    }

    const EADData = appState.getAllEADData?.() || [];
    appState.handleEADData?.(EADData);

    const LossData = appState.getAllLossData?.() || [];
    handleLossIssuerMainData(LossData);
  }

  return {
    renderPortTable,
    renderOffersTable,
    renderDealsAndOffers,
  };
}






