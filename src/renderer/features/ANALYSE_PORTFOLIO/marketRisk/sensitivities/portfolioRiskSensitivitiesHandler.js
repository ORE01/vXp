// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioRiskSensitivitiesHandler.js

import portfolioRiskSensitivitiesStore from '../../../../core/state/portfolioRiskSensitivitiesStore.js';

/**
 * Handles fresh PortfolioRiskSensitivitiesData from the DataRouter.
 *
 * Responsibility:
 * - Accept raw rows from DataRouter/DataPump
 * - Normalize to safe array
 * - Store rows through appState if available
 * - Keep legacy direct store fallback
 *
 * Not responsible for:
 * - UI rendering
 * - Dispatching UI refresh events directly
 *
 * The store dispatches:
 * - portfolio-risk-sensitivities-data-refreshed
 * after rows have actually been replaced.
 */
export function handlePortfolioRiskSensitivitiesData(rows, { appState } = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const setRows =
    appState?.setPortfolioRiskSensitivitiesData ??
    portfolioRiskSensitivitiesStore.setRows.bind(portfolioRiskSensitivitiesStore);

  const getRows =
    appState?.getPortfolioRiskSensitivitiesData ??
    portfolioRiskSensitivitiesStore.getRows.bind(portfolioRiskSensitivitiesStore);

  setRows(safeRows, {
    source: 'PortfolioRiskSensitivitiesData',
  });

  console.log('[PRS HANDLER] PortfolioRiskSensitivitiesData handled', {
    incomingRows: safeRows.length,
    storeRows: getRows().length,
    ports: portfolioRiskSensitivitiesStore.getPorts(),
    riskTypes: portfolioRiskSensitivitiesStore.getRiskTypes(),
    sample: safeRows[0],
    viaAppState: Boolean(appState?.setPortfolioRiskSensitivitiesData),
  });
}