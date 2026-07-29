// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/productRiskSensitivitiesHandler.js

import productRiskSensitivitiesStore from '../../../../core/state/stores/productRiskSensitivitiesStore.js';

/**
 * Handles fresh ProductRiskSensitivitiesData from the DataRouter/DataPump.
 *
 * Per-product, per-unit-notional sensitivities (portfolio-independent).
 * Stored via appState if available, with a direct-store fallback.
 * The store dispatches `product-risk-sensitivities-data-refreshed`.
 */
export function handleProductRiskSensitivitiesData(rows, { appState } = {}) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const setRows =
    appState?.setProductRiskSensitivitiesData ??
    productRiskSensitivitiesStore.setRows.bind(productRiskSensitivitiesStore);

  setRows(safeRows, { source: 'ProductRiskSensitivitiesData' });

  console.log('[PROD RS HANDLER] ProductRiskSensitivitiesData handled', {
    incomingRows: safeRows.length,
    storeRows: productRiskSensitivitiesStore.getRows().length,
    products: productRiskSensitivitiesStore.getProducts().length,
    riskTypes: productRiskSensitivitiesStore.getRiskTypes(),
    sample: safeRows[0],
    viaAppState: Boolean(appState?.setProductRiskSensitivitiesData),
  });
}
