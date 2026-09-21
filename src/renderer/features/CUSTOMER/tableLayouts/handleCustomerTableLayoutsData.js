'use strict';

import {
  setStoredLayoutsFromRows,
} from './tableLayoutStore.js';

export function handleCustomerTableLayoutsData(rows) {
 
    if (false) console.log('[CustomerTableLayoutsData received]', rows);

  if (!Array.isArray(rows)) {
    if (false) console.warn('[CustomerTableLayouts] expected rows array');
    return;
  }

  setStoredLayoutsFromRows(rows);
}