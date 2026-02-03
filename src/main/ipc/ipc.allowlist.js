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
    'start-py-ml',

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

    // Deals selection (create portfolio from deals)
    'save-deals-selection',
    'delete-deals-selection',
    'delete-portfolio-everywhere',

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
    'import-excel-offer-sheet',
    'import-excel-offer-sheet-quick',

    // -------------------------------------------------
    // DB helpers
    // -------------------------------------------------
    'get-table-columns',
    'get-table-rows',

    // -------------------------------------------------
    // Insert / normalize helpers
    // -------------------------------------------------
    'check-and-insert-issuers',
    'check-and-insert-products',
    'create-deals-from-import',
    'normalize-rank',

    



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
    'py-matchColumns-complete',
    'py-cspar-complete',
    'py-ml-complete',
    'py-MVaR-complete',
    'py-CVaR-complete',

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

    // Deals portfolio deletion feedback
    'delete-portfolio-everywhere-success',
    'delete-portfolio-everywhere-error',
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



