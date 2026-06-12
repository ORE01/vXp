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

let sensitivitiesListenerInstalled = false;
let sensitivityTabsInitialized = false;

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

    if (!port) {
      console.warn('[marketRiskRefresh] market risk UI skipped: no selected portfolio');
      return;
    }

    // Load backing tables from DB.
    // Existing store data renders immediately below.
    // Async fetch response will render again through dataRouter/handlers.
    window.api?.send?.('fetch-table-data', 'MarketVaR_FactorPL');
    window.api?.send?.('fetch-table-data', 'MarketVaR_Product');

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

    console.log('[marketRiskRefresh] refreshMarketRiskUI DONE', {
      port,
      scenario,
    });
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
        storeRows: riskRows.length,
        availablePorts,
        availableRiskTypes,
      });

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