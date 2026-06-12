// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioRiskSensitivitiesHandler.js

import portfolioRiskSensitivitiesStore from '../../../../core/state/portfolioRiskSensitivitiesStore.js';

/**
 * Handles fresh PortfolioRiskSensitivitiesData from the DataRouter.
 *
 * Responsibility:
 * - Accept raw rows from DataRouter/DataPump
 * - Normalize to safe array
 * - Replace portfolioRiskSensitivitiesStore rows
 *
 * Not responsible for:
 * - UI rendering
 * - Dispatching UI refresh events directly
 *
 * The store dispatches:
 * - portfolio-risk-sensitivities-data-refreshed
 * after rows have actually been replaced.
 */
export function handlePortfolioRiskSensitivitiesData(rows) {
  const safeRows = Array.isArray(rows) ? rows : [];

  portfolioRiskSensitivitiesStore.setRows(safeRows, {
    source: 'PortfolioRiskSensitivitiesData',
  });

  console.log('[PRS HANDLER] PortfolioRiskSensitivitiesData handled', {
    incomingRows: safeRows.length,
    storeRows: portfolioRiskSensitivitiesStore.getRows().length,
    ports: portfolioRiskSensitivitiesStore.getPorts(),
    riskTypes: portfolioRiskSensitivitiesStore.getRiskTypes(),
    sample: safeRows[0],
  });
}