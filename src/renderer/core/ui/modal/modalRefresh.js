import { getCleanTableName } from '../../../utils/tableUtils.js';

function normalizeRefreshTableName(tableName) {
  const clean = getCleanTableName(tableName);

  if (!clean) return '';

  if (
    clean === 'v_PRODUCTS_APP' ||
    clean === 'v_PRODUCTS_CANONICAL' ||
    clean === 'PRODUCTS_MASTER'
  ) {
    return 'v_PRODUCTS_APP';
  }

  return clean;
}

export function requestTableRefreshAfterMutation(selectedTableName) {
  const clean = normalizeRefreshTableName(selectedTableName);

  if (!clean) return;

  if (clean === 'RATES_SCENARIO_DATA') {
    try { window.api.send('fetch-table-data', 'RATES'); } catch {}
    return;
  }

  try { window.api.send('fetch-table-data', clean); } catch {}

  if (clean === 'v_PRODUCTS_APP') {
    try { window.api.send('fetch-table-data', 'v_PRODUCTS_CANONICAL'); } catch {}
    try { window.api.send('fetch-table-data', 'PRODUCT_STRUCTURE'); } catch {}
    try { window.api.send('fetch-table-data', 'Portfolios'); } catch {}
    return;
  }

  if (clean !== 'DealsMain') {
    try { window.api.send('fetch-table-data', 'DealsMain'); } catch {}
  }
}