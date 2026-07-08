// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/marketRiskRefresh.js

import {
  handleMVaRData,
  handleMVaRFactorPLData,
  handleMVaRProductPLData,
} from './mvar/index.js';

import {
  handleSummaryMarketRiskData,
} from '../SummaryMarketRisk.js';

import { handleIRSensData } from './sensitivities/portfolioPV01Handler.js';
import { handleCSSensData } from './sensitivities/portfolioCPV01Handler.js';
import { handleVegaSensData } from './sensitivities/portfolioVegaHandler.js';

import { initMarketRiskSensitivityTabs } from './sensitivities/marketRiskSensitivityTabs.js';
import { renderMarketRiskDashboard } from './marketRiskDashboard.js';

let sensitivitiesListenerInstalled = false;
let sensitivityTabsInitialized = false;
let marketRiskBackingTablesFetchRequested = false;

function normalizePortfolioName(portName) {
  return String(portName ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

function normalizeRiskType(riskType) {
  return String(riskType ?? '')
    .toUpperCase()
    .trim();
}

function getRiskRows(appState) {
  return appState.getPortfolioRiskSensitivitiesData?.() || [];
}

function getAvailablePorts(rows = []) {
  return [
    ...new Set(
      rows
        .map(r => normalizePortfolioName(r.PORT_NAME ?? r.port_name))
        .filter(Boolean)
    ),
  ];
}

function getAvailableRiskTypes(rows = []) {
  return [
    ...new Set(
      rows
        .map(r => normalizeRiskType(r.RISK_TYPE ?? r.risk_type))
        .filter(Boolean)
    ),
  ];
}

export function createMarketRiskRefresh({ appState } = {}) {
  if (!appState) {
    throw new Error('[marketRiskRefresh] appState fehlt');
  }

  function ensureSensitivityTabsInitialized() {
    if (sensitivityTabsInitialized) {
      return;
    }

    initMarketRiskSensitivityTabs();
    sensitivityTabsInitialized = true;

    console.log('[marketRiskRefresh] sensitivity tabs initialized');
  }

  function resolveSelectedPortfolioForSensitivities() {
    const rawPort = appState.getSelectedPortTableName?.();
    const normalizedPort = normalizePortfolioName(rawPort);

    if (normalizedPort) {
      return normalizedPort;
    }

    const riskRows = getRiskRows(appState);
    const ports = getAvailablePorts(riskRows);

    // Fallback nur für ersten Render erlaubt:
    // Wenn eindeutig nur ein Portfolio in den Risk Rows ist, darf dieses verwendet werden.
    if (ports.length === 1) {
      return normalizePortfolioName(ports[0]);
    }

    return null;
  }

  function refreshMarketRiskUI(index = 0) {
    const port = appState.getSelectedPortTableName?.();

    // Diagnostic only: capture whether existing store data + chart containers are
    // present at (re)open time, BEFORE the port guard, so the empty-tile-on-open
    // case is observable even when no portfolio is selected yet.
    {
      const factorRows = appState.getMvarFactorPLData?.() || [];
      const productRows = appState.getMvarProductData?.() || [];

      console.log('[MVAR CHART REHYDRATE CHECK]', {
        selectedPort: appState.getSelectedPortTableName?.(),
        selectedScenario: appState.selectedMvarInterval,
        factorRows: factorRows?.length,
        productRows: productRows?.length,
        factorContainerExists: !!document.getElementById('MVaRFactorPLContainer'),
        productContainerExists: !!document.getElementById('mvarProductTableContainer'),
        productChartCanvasExists: !!document.getElementById('mvarProdIdVarContribChart'),
      });
    }

    if (!port) {
      console.warn('[marketRiskRefresh] market risk UI skipped: no selected portfolio');
      return;
    }

    // Load backing tables from DB only once per renderer session.
    // Important: refreshMarketRiskUI is a render function. If it fetches on every render,
    // the async data response can trigger another render and create a render/fetch loop.
    if (!marketRiskBackingTablesFetchRequested) {
      marketRiskBackingTablesFetchRequested = true;

      window.api?.send?.('fetch-table-data', 'MarketVaR_FactorPL');
      window.api?.send?.('fetch-table-data', 'MarketVaR_Product');

      console.log('[marketRiskRefresh] backing table fetch requested once');
    }

    const allMvar = appState.getAllMvarData?.() || [];
    const factorRows = appState.getMvarFactorPLData?.() || [];
    const productRows = appState.getMvarProductData?.() || [];
    const scenario = appState.selectedMvarInterval ?? null;

    console.log('[marketRiskRefresh] refreshMarketRiskUI START', {
      port,
      index,
      allMvarRows: Array.isArray(allMvar) ? allMvar.length : 0,
      factorRows: Array.isArray(factorRows) ? factorRows.length : 0,
      productRows: Array.isArray(productRows) ? productRows.length : 0,
      selectedScenario: scenario,
    });

    if (Array.isArray(allMvar) && allMvar.length) {
      handleMVaRData(allMvar, index);
    } else {
      console.warn('[marketRiskRefresh] no aggregate MVaR data in store', {
        port,
      });
    }

    handleMVaRFactorPLData(
      Array.isArray(factorRows) ? factorRows : []
    );

    // Legacy / summary renderers first.
    // Important: these may touch product containers.
    handleSummaryMarketRiskData(port, scenario, null);

    // ProductPL must render LAST.
    // It owns the Product VaR detail panel chart/table after refresh.
    handleMVaRProductPLData(
      Array.isArray(productRows) ? productRows : []
    );

    // Market-Risk-Dashboard (KPI-Karten) aus derselben Aggregat-Zeile aktualisieren.
    try { renderMarketRiskDashboard(); } catch (e) { console.warn('[marketRiskRefresh] dashboard render failed', e); }

    console.log('[marketRiskRefresh] refreshMarketRiskUI DONE', {
      port,
      scenario,
    });

    // Decisive one-shot: report the REAL final DOM state of every MVaR container a
    // few frames after render, so we can tell "never rendered" vs "rendered then
    // cleared" vs "wrong tile" vs "drawn but empty". Diagnostic only.
    setTimeout(() => {
      const snap = (id) => {
        const el = document.getElementById(id);
        if (!el) return { exists: false };
        const r = el.getBoundingClientRect?.() || {};
        return {
          exists: true,
          childCount: el.childElementCount,
          htmlLen: el.innerHTML.length,
          w: Math.round(r.width || 0),
          h: Math.round(r.height || 0),
          visible: !!(el.offsetParent || (r.width && r.height)),
        };
      };

      const mvarChartEl = document.getElementById('MVaRChart');
      const prodCanvas = document.getElementById('mvarProdIdVarContribChart');
      const prodBox = prodCanvas?.parentElement || null;
      const prodBoxRect = prodBox?.getBoundingClientRect?.() || {};

      console.log('[MVAR FINAL DOM SNAPSHOT]', {
        panelMvarHidden: document.getElementById('panel-mvar')?.hidden ?? null,
        panelProductsHidden: document.getElementById('panel-mvar-products')?.hidden ?? null,

        MVaRRiskTypePLContainer: snap('MVaRRiskTypePLContainer'),
        MVaRFactorPLContainer: snap('MVaRFactorPLContainer'),

        MVaRChart: snap('MVaRChart'),
        MVaRChartHasChartInstance: !!(window.Chart?.getChart && mvarChartEl && window.Chart.getChart(mvarChartEl)),

        mvarProductTableContainer: snap('mvarProductTableContainer'),
        mvarProdDomChartWrapperCount: prodBox
          ? prodBox.querySelectorAll('.mvar-product-dom-chart').length
          : null,
        mvarProdBoxSize: prodBox
          ? { w: Math.round(prodBoxRect.width || 0), h: Math.round(prodBoxRect.height || 0) }
          : null,
      });
    }, 300);
  }

  function refreshMarketRiskSensitivitiesUI(reason = 'manual') {
    ensureSensitivityTabsInitialized();

    const riskRows = getRiskRows(appState);
    const availablePorts = getAvailablePorts(riskRows);
    const availableRiskTypes = getAvailableRiskTypes(riskRows);

    const port = resolveSelectedPortfolioForSensitivities();

    if (!port) {
      console.warn('[marketRiskRefresh] sensitivities skipped: no selected portfolio', {
        reason,
        availablePorts,
        storeRows: riskRows.length,
        availableRiskTypes,
      });

      return;
    }

    console.log('[marketRiskRefresh] refresh sensitivities UI START', {
      reason,
      port,
      storeRows: riskRows.length,
      availablePorts,
      availableRiskTypes,
    });

    // Wichtig:
    // Alle Handler werden IMMER aufgerufen.
    // Jeder Handler ist selbst dafür verantwortlich:
    // - eigene Daten zu filtern
    // - eigenes UI zu rendern
    // - eigenes UI zu clearen, wenn keine Daten vorhanden sind
    handleIRSensData(appState, port);
    handleCSSensData(appState, port);
    handleVegaSensData(appState, port);

    console.log('[marketRiskRefresh] refresh sensitivities UI DONE', {
      reason,
      port,
    });
  }

  function installMarketRiskSensitivityRefreshListener() {
    if (sensitivitiesListenerInstalled) {
      return;
    }

    sensitivitiesListenerInstalled = true;

    ensureSensitivityTabsInitialized();

    document.addEventListener('portfolio-risk-sensitivities-data-refreshed', (event) => {
      const riskRows = getRiskRows(appState);
      const availablePorts = getAvailablePorts(riskRows);
      const availableRiskTypes = getAvailableRiskTypes(riskRows);

      console.log('[marketRiskRefresh] portfolio-risk-sensitivities-data-refreshed received', {
        detail: event?.detail,
        selectedPort: appState.getSelectedPortTableName?.(),
        storeRows: riskRows.length,
        availablePorts,
        availableRiskTypes,
      });

      refreshMarketRiskSensitivitiesUI('portfolio-risk-sensitivities-data-refreshed');
    });

document.addEventListener('portfolio-context-changed', (event) => {
  const riskRows = getRiskRows(appState);
  const availablePorts = getAvailablePorts(riskRows);
  const availableRiskTypes = getAvailableRiskTypes(riskRows);

  console.log('[marketRiskRefresh] portfolio-context-changed received', {
    detail: event?.detail,
    selectedPort: appState.getSelectedPortTableName?.(),
    selectedScenario: appState.selectedMvarInterval,
    storeRows: riskRows.length,
    availablePorts,
    availableRiskTypes,
  });

  // MVaR Overview / Factor P&L / Product P&L must also re-render
  // when the selected portfolio changes.
  refreshMarketRiskUI(0);

  // Sensitivities use their own Risk rows and handlers.
  refreshMarketRiskSensitivitiesUI('portfolio-context-changed');
});
    console.log('[marketRiskRefresh] sensitivity refresh listener installed');
  }

  return {
    refreshMarketRiskUI,
    refreshMarketRiskSensitivitiesUI,
    installMarketRiskSensitivityRefreshListener,
  };
}