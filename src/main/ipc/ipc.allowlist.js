'use strict';

// Central allowlist used by preload.
// Keep it as data only.

module.exports = {
  send: [
    'open-coupon-window',

    'start-py-fairValue',
    'start-py-MVaR',
    'start-py-CVaR',
    'start-py-excel',
    'start-py-historicData',
    'start-py-cspar',
    'start-py-matchColumns',
    'start-py-swaption',
    'start-py-ml',

    'import-matched-columns',
    'csparameter-update',

    // ✅ Customer Reports
    'customerReports:list',
    'customerReports:load',
    'customerReports:save',
    'customerReports:delete',

    // ✅ Table fetch / updates / UI
    'fetch-table-data',
    'update-data',
    'erase-data',
    'add-new-row',
    'show-message-box',
    'update-customer-texts',

    // ✅ TS modules
    'ts-selection:save',
    'ts-trendlines:load',
    'ts-trendlines:save',
  ],

  invoke: [
    // ✅ Allowlist bootstrap
    'ipc:get-allowlist',

    // ✅ Bonds / DataCollector
    'bonds:fetch',
    'bonds:fetchTermsOnly',
    'bonds:parsePdfUrl',

    // ✅ Excel / import flows
    'import-excel-dialog',
    'select-excel-file',
    'import-excel-offer-sheet',
    'import-excel-offer-sheet-quick',

    // ✅ DB helper invokes
    'get-table-columns',
    'get-table-rows',

    // ✅ Insert/normalize helpers
    'check-and-insert-issuers',
    'check-and-insert-products',
    'create-deals-from-import',
    'normalize-rank',
  ],

  listen: [
    'py-progress',
    'project-finished',

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


    'import-matched-columns-complete',
    'erase-data-success',
    'erase-data-error',

    'ui:bulk-update-start',
    'ui:bulk-update-end',

    'csparameter-update-success',
    'csparameter-update-error',

    // ✅ update-data / customer-texts feedback
    'update-data-success',
    'update-data-error',
    'update-customer-texts-success',
    'update-customer-texts-error',
  ],

  listenPrefixes: [
    // list replies
    'customerReports:list-success:',
    'customerReports:list-error:',

    // load replies
    'customerReports:load-success:',
    'customerReports:load-error:',

    // save replies (dynamic req ids, if your code uses them)
    'customerReports:save-success:',
    'customerReports:save-error:',

    // delete replies (dynamic req ids, if your code uses them)
    'customerReports:delete-success:',
    'customerReports:delete-error:',
  ],

  // pattern-based allowed listen channels
  allowDataEventsEndingWith: 'Data',
};



