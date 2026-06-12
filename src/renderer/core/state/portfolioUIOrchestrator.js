// core/state/portfolioUIOrchestrator.js
// Enthält UI-Render-Orchestrierung für Portfolios + Offers.
// AppState bleibt State-only.

import { handlePortAggData, handlePortProdData } from '../../features/portfolio/index.js';
import { handleLiquidityData } from '../../features/ANALYSE_PORTFOLIO/liquidity.js';
import { handleSummaryNotionalData } from '../../features/ANALYSE_PORTFOLIO/SummaryBreakdown.js';
import { handleSummaryYieldData } from '../../features/ANALYSE_PORTFOLIO/SummaryYield.js';
import { handleSummaryMarketRiskData, handleMvarProductTable } from '../../features/ANALYSE_PORTFOLIO/SummaryMarketRisk.js';
import { handleMVaRData } from '../../features/ANALYSE_PORTFOLIO/marketRisk/mvar/index.js';
import { handleCVaRData } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/CVaR.js';
import { handleLossIssuerMainData } from '../../features/ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js';
import { createComparisonCharts } from '../../features/COMPARE_PORTFOLIOS/COMP.js';
import { formatPercentage } from '../../utils/tableCellFormats.js';
import { handleDealsData } from '../../features/portfolio/tradeTableRenderer.js';
import portfolioRiskSensitivitiesStore from './portfolioRiskSensitivitiesStore.js';

export function createPortfolioUIOrchestrator({ appState } = {}) {
  if (!appState) throw new Error('[portfolioUIOrchestrator] appState fehlt');

  let portfolioRenderToken = 0;

  function runPortfolioRenderQueue(tasks = []) {
    const token = ++portfolioRenderToken;
    const queue = [...tasks];
    const startPort = appState.getSelectedPortTableName?.();

    function next() {
      if (token !== portfolioRenderToken) return;

      const currentPort = appState.getSelectedPortTableName?.();
      if (currentPort !== startPort) return;

      const task = queue.shift();
      if (!task) return;

      try {
        task();
      } catch (e) {
        console.warn('[portfolioUIOrchestrator] render task failed', e);
      }

      setTimeout(next, 16);
    }

    setTimeout(next, 16);
  }

  function splitDealsAndOffers(allDeals = []) {
    const isOffer = (r) =>
      String(r?.port_name ?? r?.PORT_NAME ?? '')
        .toUpperCase()
        .startsWith('OFFER');

    return {
      deals: allDeals.filter((r) => !isOffer(r)),
      offers: allDeals.filter(isOffer),
    };
  }

  function renderDealsAndOffers() {
    const allDeals = appState.getAllDealsData?.() || [];

    if (!allDeals.length) {
      handleDealsData([], 'ALL', { forceTarget: 'deals', allowClear: true });
      handleDealsData([], 'OFFERS', { forceTarget: 'offers', allowClear: true });
      return;
    }

    const { deals, offers } = splitDealsAndOffers(allDeals);

    const ddVal = String(document.getElementById('createdDealsDropdown')?.value ?? '').trim();
    const selected = ddVal || String(appState.getSelectedDealsTableName?.() ?? '').trim();

    const isNone =
      !selected ||
      selected === '__NONE__' ||
      selected === 'Select a table';

    if (isNone) {
      handleDealsData([], 'ALL', {
        forceTarget: 'deals',
        allowClear: true,
        restoreDropdown: false,
      });

      handleDealsData([], 'OFFERS', {
        forceTarget: 'offers',
        allowClear: true,
        restoreDropdown: false,
      });

      return;
    }

    const showAll = selected === '__ALL__' || selected === 'ALL';

    const dealsToRender = showAll
      ? deals
      : deals.filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === selected);

    handleDealsData(dealsToRender, selected, {
      forceTarget: 'deals',
      restoreDropdown: true,
      allowClear: true,
    });

    handleDealsData(offers, 'OFFERS', {
      forceTarget: 'offers',
      restoreDropdown: false,
      allowClear: true,
    });
  }

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
    }

    if (offersEl) {
      offersEl.style.cssText =
        'display:block;visibility:visible;height:auto;overflow:auto;';
    }

    const allDeals = appState.getAllDealsData?.() || [];
    const baseRows = allDeals.filter(
      (r) => normKey(r?.port_name ?? r?.PORT_NAME) === normKey(offerName)
    );

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
      return;
    }

    const p4 = document.getElementById('portDataContainer4');
    if (p4) p4.innerHTML = '';
  }

  function renderOffersSensTables({ baseRows, enriched } = {}) {
    const selectedOfferName =
      appState.getSelectedOffersTableName?.() ||
      document.getElementById('createdOffersDropdown')?.value ||
      '';

    const offerName = String(selectedOfferName ?? '').trim();

    const riskRowsAll = appState.getPortfolioRiskSensitivitiesData?.() || [];
    const riskRows = riskRowsAll.filter(r =>
      String(r.PORT_NAME ?? r.port_name ?? '').trim() === offerName
    );

    const IRSensTable = appState.handleIRSensData?.(riskRows);
    const irEl = document.getElementById('IRSensDataContainer');

    if (IRSensTable && irEl) {
      irEl.innerHTML = '';
      irEl.appendChild(IRSensTable);
    }

    const CSSensTable = appState.handleCSSensData?.(riskRows);
    const csEl = document.getElementById('CSSensDataContainer');

    if (CSSensTable && csEl) {
      csEl.innerHTML = '';
      csEl.appendChild(CSSensTable);
    }

    const VegaSensTable = appState.handleVegaSensData?.(riskRows);
    const vegaEl = document.getElementById('VegaSensDataContainer');

    if (VegaSensTable && vegaEl) {
      vegaEl.innerHTML = '';
      vegaEl.appendChild(VegaSensTable);
    }
  }

  function renderPortTable(data, index) {
    if (!Array.isArray(data) || data.length === 0) return;

    const port_name = appState.getSelectedPortTableName?.();
    if (!port_name) return;

    const filteredData = data.filter(
      (item) => String(item?.port_name) === String(port_name)
    );

    const pv01Rows = portfolioRiskSensitivitiesStore.getByPortfolioAndType(port_name, 'PV01');

const pv01TotalByTradeId = new Map();

for (const r of pv01Rows) {
  const tradeId = String(r.TRADE_ID ?? r.trade_id ?? '').trim();
  if (!tradeId) continue;

  const value = Number(
    r.VALUE_BASE ??
    r.value_base ??
    r.VALUE_LOCAL ??
    r.value_local ??
    0
  );

  if (!Number.isFinite(value)) continue;

  pv01TotalByTradeId.set(
    tradeId,
    (pv01TotalByTradeId.get(tradeId) || 0) + value
  );
}

const filteredDataWithRisk = filteredData.map(row => {
  const tradeId = String(row.TRADE_ID ?? row.trade_id ?? '').trim();
  const pv01TotalBase = pv01TotalByTradeId.get(tradeId);

  const nav = Number(
    row.NAV ??
    row.NAV_BASE ??
    row.nav ??
    row.nav_base
  );

  const irDuration =
    Number.isFinite(pv01TotalBase) && Number.isFinite(nav) && nav !== 0
      ? Math.abs(pv01TotalBase) / Math.abs(nav) * 10000
      : null;

  return {
    ...row,
    PV01_TOTAL_BASE: pv01TotalBase ?? null,
    IR_DURATION: irDuration,
  };
});

console.log('[PORTFOLIO ORCHESTRATOR YIELD RISK MERGE]', {
  port_name,
  filteredRows: filteredData.length,
  pv01Rows: pv01Rows.length,
  pv01Trades: Array.from(pv01TotalByTradeId.entries()),
  frn001: filteredDataWithRisk.find(r => r.PROD_ID === 'FRN001'),
});




    if (!filteredData.length) return;

    console.log('[RENDER PORT TABLE FILTERED DATA CHECK]', {
  port_name,
  rows: filteredData.length,
  frn001: filteredData.find(r => r.PROD_ID === 'FRN001'),
  frn001Fields: (() => {
    const r = filteredData.find(r => r.PROD_ID === 'FRN001');
    if (!r) return null;

    return {
      TRADE_ID: r.TRADE_ID,
      PROD_ID: r.PROD_ID,
      PV01: r.PV01,
      PV01rel: r.PV01rel,
      PV01_BASE: r.PV01_BASE,
      NAV: r.NAV,
      ytm: r.ytm,
      TtM: r.TtM,
      keys: Object.keys(r),
    };
  })(),
});




    const elementId = `portDataContainer${index}`;

    // Sofort: leichte Basisdaten
    handlePortAggData(filteredData, index, port_name);
    handlePortProdData(filteredData, index, port_name);

    const mvarData = appState.getAllMvarData?.() || [];
    const cvarData = appState.getAllCvarData?.() || [];
    const scenario_name = appState.selectedMvarInterval ?? null;

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

    const ori = appState.getAllPortfolioData?.() || [];
    const filteredOriginal = ori.filter(
      (item) => String(item?.port_name) === String(port_name)
    );

    const renderTasks = [
      () => handleLiquidityData(filteredData, { appState }),

      () => handleSummaryNotionalData(filteredData, index, port_name),

      () => handleSummaryYieldData(filteredDataWithRisk, index, port_name),

      () => handleSummaryMarketRiskData(port_name, scenario_name, '2021-01-03'),

      () => handleMvarProductTable(port_name, scenario_name, null),

      () => handleMVaRData(mvarData, index),

      () => handleCVaRData(cvarData, index),

      () => createComparisonCharts(appState.portDataMap, false),

      () => {
        if (filteredOriginal.length) {
          handlePortAggData(filteredOriginal, 3, port_name);
        }
      },

      () => {
        appState.handleIRSensData?.(appState, port_name);
      },

      () => {
        appState.handleCSSensData?.(appState, port_name);
      },

      () => {
        appState.handleVegaSensData?.(appState, port_name);
      },

      () => {
        const EADData = appState.getAllEADData?.() || [];
        appState.handleEADData?.(EADData);
      },

      () => {
        const LossData = appState.getAllLossData?.() || [];
        handleLossIssuerMainData(LossData);
      },
    ];

    runPortfolioRenderQueue(renderTasks);
  }

  return {
    renderPortTable,
    renderOffersTable,
    renderDealsAndOffers,
  };
}


