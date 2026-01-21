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
  ],

  invoke: [
    'bonds:fetch',
    'bonds:fetchTermsOnly',
    'bonds:parsePdfUrl',

    // If you have invoke-based CRUD etc., add here ONCE.
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

    'import-matched-columns-complete',
    'erase-data-success',
    'ui:bulk-update-start',
    'ui:bulk-update-end',

    'csparameter-update-success',
    'csparameter-update-error',
  ],


  // pattern-based allowed listen channels
  allowDataEventsEndingWith: 'Data',
};
