'use strict';

import {
  setStoredLayoutsFromRows,
} from './tableLayoutStore.js';

export function handleCustomerTableLayoutsData(rows) {
 
    console.log('[CustomerTableLayoutsData received]', rows);

  if (!Array.isArray(rows)) {
    console.warn('[CustomerTableLayouts] expected rows array');
    return;
  }

  setStoredLayoutsFromRows(rows);
}