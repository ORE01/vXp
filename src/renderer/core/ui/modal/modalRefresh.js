import { getCleanTableName } from '../../../utils/tableUtils.js';

export function requestTableRefreshAfterMutation(selectedTableName) {
  const clean = getCleanTableName(selectedTableName);

  if (!clean) return;

  if (clean === 'RATES_SCENARIO_DATA') {
    try { window.api.send('fetch-table-data', 'RATES'); } catch {}
    return;
  }

  try { window.api.send('fetch-table-data', clean); } catch {}

  if (clean !== 'DealsMain') {
    try { window.api.send('fetch-table-data', 'DealsMain'); } catch {}
  }
}