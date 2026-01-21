// FRONT_END/STATE/portfolioUIOrchestrator.js
// Enthält UI-Render-Orchestrierung für Portfolios + Offers.
// AppState bleibt State-only.

import { handlePortAggData, handlePortProdData } from '../SELECT_PORTFOLIO/PORT.js';
import { handleLiquidityData } from '../ANALYSE_PORTFOLIO/liquidity.js';
import { handleSummaryNotionalData } from '../ANALYSE_PORTFOLIO/SummaryBreakdown.js';
import { handleSummaryYieldData } from '../ANALYSE_PORTFOLIO/SummaryYield.js';
import { handleSummaryMarketRiskData, handleMvarProductTable } from '../ANALYSE_PORTFOLIO/SummaryMarketRisk.js';
import { handleMVaRData } from '../ANALYSE_PORTFOLIO/MARKET_RISK/MVaR.js';
import { handleCVaRData } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { handleLossIssuerMainData } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js';
import { createComparisonCharts } from '../COMPARE_PORTFOLIOS/COMP.js';
import { formatPercentage } from '../../utils/format.js';
import { handleDealsData } from '../CREATE_PORTFOLIO/DEALS.js';

export function createPortfolioUIOrchestrator({ appState } = {}) {
  if (!appState) throw new Error('[portfolioUIOrchestrator] appState fehlt');

  // =====================================================================
  // OFFERS ORCHESTRATOR
  // =====================================================================
function renderOffersTable(data, opts = {}) {
  const norm = (v) => String(v ?? '').trim();
  const normKey = (v) => norm(v).toLowerCase();

  // A) Resolve selected offer name
  const selectedOfferName =
    appState.getSelectedOffersTableName?.() ||
    document.getElementById('createdOffersDropdown')?.value ||
    '';

  const offerName = norm(selectedOfferName);

  // UI-Steuerung
  const offersEl = document.getElementById('offersDataContainer');
  if (!offerName) {
    if (offersEl) {
      offersEl.innerHTML = '';
      offersEl.style.cssText = 'display:none;visibility:hidden;height:0;overflow:hidden;';
    }
    // optional: clear enriched view too
    const p4 = document.getElementById('portDataContainer4');
    if (p4) p4.innerHTML = '';
    return;
  } else {
    if (offersEl) {
      offersEl.style.cssText = 'display:block;visibility:visible;height:auto;overflow:auto;';
    }
  }

  // B1) RAW DealsMain rows (ALWAYS from DealsMain; not filter-engine)
  const allDeals = appState.getAllDealsData?.() || [];
  const baseRows = allDeals.filter((r) =>
    normKey(r?.port_name ?? r?.PORT_NAME) === normKey(offerName)
  );

  // B2) ENRICHED rows:
  // ✅ If filter-engine passed rows in `data`, use them (this is the missing link!)
  let enriched = Array.isArray(data) ? data : [];

  // safety: if data isn't for the current offerName (edge case), filter it
  if (enriched.length) {
    enriched = enriched.filter((r) =>
      normKey(r?.port_name ?? r?.PORT_NAME) === normKey(offerName)
    );
  }

  // fallback if nothing came in
  if (!enriched.length) {
    const allPorts = appState.getAllPortfolioData?.() || [];
    enriched = allPorts.filter((r) =>
      normKey(r?.port_name ?? r?.PORT_NAME) === normKey(offerName)
    );
  }

  // C) Orchestrate rendering
  renderOffersRawDealsTable({ offerName, baseRows });         // -> handleDealsData(... forceTarget:'offers')
  renderOffersEnrichedPortfolio({ offerName, enriched });     // -> handlePortProdData(enriched, 4, offerName)
  renderOffersSensTables({ baseRows, enriched });             // -> IRSens/CSSens
}


        // 1) DealsMain (RAW) -> offersDataContainer
        function renderOffersRawDealsTable({ offerName, baseRows } = {}) {
          if (!offerName) return;
          if (!Array.isArray(baseRows)) return;

          // NOTE:
          // - handleDealsData rendert via processData in den Ziel-Container
          // - forceTarget:'offers' setzt offersDataContainer
          // - restoreDropdown:false verhindert, dass irgendwelche Dropdowns "zurück-geklickt" werden
          handleDealsData(baseRows, offerName, { forceTarget: 'offers', restoreDropdown: false });
        }

        // 2) Portfolio (ENRICHED) -> portDataContainer4
        function renderOffersEnrichedPortfolio({ offerName, enriched } = {}) {
          if (Array.isArray(enriched) && enriched.length) {
            handlePortProdData(enriched, 4, offerName);
          } else {
            // optional: leeren, damit keine alten Daten stehen bleiben
            const p4 = document.getElementById('portDataContainer4');
            if (p4) p4.innerHTML = '';
          }
        }

        // 3) IRSens / CSSens
        function renderOffersSensTables({ baseRows, enriched } = {}) {
          const sensRows = (Array.isArray(enriched) && enriched.length) ? enriched : baseRows;

          const IRSensTable = appState.handleIRSensData?.(sensRows);
          const irEl = document.getElementById('IRSensDataContainer');
          if (IRSensTable && irEl) { irEl.innerHTML = ''; irEl.appendChild(IRSensTable); }

          const CSSensTable = appState.handleCSSensData?.(sensRows);
          const csEl = document.getElementById('CSSensDataContainer');
          if (CSSensTable && csEl) { csEl.innerHTML = ''; csEl.appendChild(CSSensTable); }
        }

  // =====================================================================
  // PORTFOLIO ORCHESTRATOR (unchanged)
  // =====================================================================
  function renderPortTable(data, index) {
    if (!Array.isArray(data) || data.length === 0) return;

    const port_name = appState.getSelectedPortTableName?.();
    if (!port_name) return;

    const filteredData = data.filter(item => String(item?.port_name) === String(port_name));
    if (!filteredData.length) return;

    // 1) Portfolio Standard
    handlePortAggData(filteredData, index, port_name);
    handlePortProdData(filteredData, index, port_name);
    handleLiquidityData(filteredData, { appState });

    handleSummaryNotionalData(filteredData, index, port_name);
    handleSummaryYieldData(filteredData, index, port_name);

    // 2) MarketRisk Summary + ProductTable (scenario)
    const scenario_name = appState.selectedMvarInterval ?? null;
    handleSummaryMarketRiskData(port_name, scenario_name, '2021-01-03');
    handleMvarProductTable(port_name, scenario_name, null);

    // 3) MVaR/CVaR UI
    const mvarData = appState.getAllMvarData?.() || [];
    const filteredMvarData = mvarData.filter(item => String(item?.port_name) === String(port_name));
    handleMVaRData(mvarData, index);

    const cvarData = appState.getAllCvarData?.() || [];
    const filteredCvarData = cvarData.filter(item => String(item?.port_name) === String(port_name));
    handleCVaRData(cvarData, index);

    // 4) Aggregation in portDataMap
    const elementId = `portDataContainer${index}`;

    if (filteredMvarData.length > 0) {
      const mvar = filteredMvarData[0];
      appState.setPortAggData?.(elementId, {
        formVaR_T_rel:  formatPercentage(mvar?.VaR_T_rel),
        formVaR_IR_rel: formatPercentage(mvar?.VaR_IR_rel),
        formVaR_CS_rel: formatPercentage(mvar?.VaR_CS_rel),
      });
    }

    if (filteredCvarData.length > 0) {
      const cvarValues = {};
      for (const entry of filteredCvarData) {
        if (!entry?.pd_flag || entry?.VaR_rel == null) continue;
        const key = `formVaR_${String(entry.pd_flag).toLowerCase()}_rel`;
        cvarValues[key] = formatPercentage(entry.VaR_rel);
      }
      appState.setPortAggData?.(elementId, cvarValues);
    }

    // 5) Comparison charts
    createComparisonCharts(appState.portDataMap, false);

    // 6) Special: original data for container 3
    const ori = appState.getAllPortfolioData?.() || [];
    const filteredOriginal = ori.filter(item => String(item?.port_name) === String(port_name));
    if (filteredOriginal.length) handlePortAggData(filteredOriginal, 3, port_name);

    // 7) IRSens/CSSens tables
    const IRSensTable = appState.handleIRSensData?.(filteredOriginal);
    const irEl = document.getElementById('IRSensDataContainer');
    if (irEl && IRSensTable) { irEl.innerHTML = ''; irEl.appendChild(IRSensTable); }

    const CSSensTable = appState.handleCSSensData?.(filteredOriginal);
    const csEl = document.getElementById('CSSensDataContainer');
    if (csEl && CSSensTable) { csEl.innerHTML = ''; csEl.appendChild(CSSensTable); }

    // 8) EAD + Loss
    const EADData = appState.getAllEADData?.() || [];
    appState.handleEADData?.(EADData);

    const LossData = appState.getAllLossData?.() || [];
    handleLossIssuerMainData(LossData);
  }

  return {
    renderPortTable,
    renderOffersTable,
  };
}
