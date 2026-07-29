'use strict';

// Central allowlist used by preload.
// Keep it as data only.

module.exports = {
  // =====================================================
  // SEND (renderer -> main, fire-and-forget)
  // =====================================================
  send: [
    'open-coupon-window',

    // Python starters
    'start-py-fairValue',
    'start-py-MVaR',
    'start-py-CVaR',
    'start-py-excel',
    'start-py-historicData',
    'start-py-cspar',
    'start-py-matchColumns',
    'start-py-swaption',
    'start-py-volcube',
    'start-py-ml',
    'start-py-erste',
    'start-py-erste-rebuild',
    'price-product',

    // UI / bulk ops
    'import-matched-columns',
    'csparameter-update',

    // Customer reports
    'customerReports:list',
    'customerReports:load',
    'customerReports:save',
    'customerReports:delete',

    // Tables / CRUD
    'fetch-table-data',
    'update-data',
    'erase-data',
    'add-new-row',
    'show-message-box',
    'update-customer-texts',

    // TS modules
    'ts-selection:save',
    'ts-trendlines:load',
    'ts-trendlines:save',

    // Deals selection / portfolio creation
    'save-deals-selection',
    'create-empty-portfolio',
    'delete-deals-selection',
    'delete-portfolio-everywhere',
    'add-products-to-portfolio',
    'update-deals-fields',


  ],

  // =====================================================
  // INVOKE (renderer -> main, request/response)
  // =====================================================
  invoke: [
    // Meta
    'ipc:get-allowlist',

    // -------------------------------------------------
    // Bond Prospectus Finder
    // -------------------------------------------------
    'bondProspectusFinder:ping',
    'bondProspectusFinder:find',

    // -------------------------------------------------
    // Bonds (PDF parsing only – NEW clean API)
    // -------------------------------------------------
    'bonds:parsePdf',
    'bonds:parsePdfBatch',

    // -------------------------------------------------
    // Bond Pipeline (Prospectus -> Bonds)
    // -------------------------------------------------
    'bondPipeline:resolveAndParse',

    // -------------------------------------------------
    // Excel / import flows
    // -------------------------------------------------
    'import-excel-dialog',
    'select-excel-file',

    // Data Sources (SETUP): Speicherort der Input-Workbooks
    'data-inputs:get-paths',
    'data-inputs:select',
    'data-inputs:reset',

    // ERSTE market-data target workbook (Browse)
    'erste:get-target',
    'erste:select-target',
    'erste:reset-target',

    // Curve Construction (curve_spreads editor)
    'curve-spreads:currencies',
    'curve-spreads:get',
    'curve-spreads:save',
    'import-excel-offer-sheet',
    'import-excel-offer-sheet-quick',

    // -------------------------------------------------
    // DB helpers
    // -------------------------------------------------
    'get-table-columns',
    'get-table-rows',
    'table-layout:save-one',

    // Customer Setup -> Portfolio -> Overview Tiles
    'customer-overview-tiles.save',

    // Customer Setup -> Portfolio -> Duration Limits
    'customer-portfolio-limits.save',

    // Customer Setup -> Risk -> Market Risk -> Interval
    'customer-mr-setting.save',
    'customer-mr-setting.get',
    'customer-mr-thresholds.get',
    'customer-mr-thresholds.save',

    // Customer Setup -> Risk -> Credit Risk -> General Settings
    'customer-cr-setting.save',
    'customer-cr-setting.get',
    'customer-cr-thresholds.save',
    'customer-cr-thresholds.get',

    // -------------------------------------------------
    // Insert / normalize helpers
    // -------------------------------------------------
    'check-and-insert-issuers',
    'check-and-insert-products',
    'create-deals-from-import',
    'normalize-rank',

    'save-portfolio-name',

    // Rates / Scenarios
    'rates:set-active-scenario',
    'rates:get-active-curve',
    'rates:create-scenario',
    'rates:get-base-curve',
    'rates:get-available-curves',
    'rates:get-scenarios',
    'rates:get-scenario',
    'rates:update-scenario-row',

    // cs / Scenarios
    'cs:set-active-scenario',
    'cs:create-scenario',
    'cs:delete-scenario',
    'cs:get-base-matrix',
    'cs:get-scenarios',
    'cs:get-scenario',

    // swaption / Scenarios
    'swaption:set-active-scenario',
    'swaption:create-scenario',

    // generic table helpers
    'fetch-table-data',

    'update-product-cs-spread-override',

    



  ],

  // =====================================================
  // LISTEN (main -> renderer)
  // =====================================================
  listen: [
    'py-progress',
    'project-finished',

    // Python completion events
    'py-fairValue-complete',
    'py-mvar-complete',
    'py-cvar-complete',
    'py-excel-progress',
    'py-excel-complete',
    'py-historicData-complete',
    'py-swaption-complete',
    'py-volcube-complete',
    'py-matchColumns-complete',
    'py-cspar-complete',
    'py-ml-complete',
    'py-MVaR-complete',
    'py-CVaR-complete',
    'py-erste-complete',
    'py-erste-progress',
    'py-erste-rebuild-complete',
    'py-erste-rebuild-progress',

    'price-product-success',
    'price-product-error',

    // Import / CRUD feedback
    'import-matched-columns-complete',
    'erase-data-success',
    'erase-data-error',

    'ui:bulk-update-start',
    'ui:bulk-update-end',

    'csparameter-update-success',
    'csparameter-update-error',

    'update-data-success',
    'update-data-error',
    'update-customer-texts-success',
    'update-customer-texts-error',

    // Deals portfolio creation feedback
    'create-empty-portfolio-success',
    'create-empty-portfolio-error',

    // Deals portfolio deletion feedback
    'delete-portfolio-everywhere-success',
    'delete-portfolio-everywhere-error',

    // Add products to portfolio feedback
    'add-products-to-portfolio-success',
    'add-products-to-portfolio-error',

    // Fill trade details feedback
    'update-deals-fields-success',
    'update-deals-fields-error',
  ],

  // =====================================================
  // LISTEN PREFIXES (dynamic response channels)
  // =====================================================
  listenPrefixes: [
    'customerReports:list-success:',
    'customerReports:list-error:',
    'customerReports:load-success:',
    'customerReports:load-error:',
    'customerReports:save-success:',
    'customerReports:save-error:',
    'customerReports:delete-success:',
    'customerReports:delete-error:',

    // ✅ add-new-row dynamic reply channels
    'add-new-row-success:',
    'add-new-row-error:',
  ],

  // =====================================================
  // Pattern-based allowed listen channels
  // =====================================================
  allowDataEventsEndingWith: 'Data',
};



