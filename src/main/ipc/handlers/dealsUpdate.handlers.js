'use strict';

// src/main/ipc/handlers/dealsUpdate.handlers.js

/**
 * Batch-update editable trade fields for a portfolio's deals.
 * - update-deals-fields -> UPDATE DealsMain SET <fields> WHERE TRADE_ID = ?
 *   for each row, in a single transaction. Then refresh DealsMain.
 *
 * Only a fixed allowlist of columns is writable. No schema changes.
 */
const ALLOWED_FIELDS = ['NOTIONAL', 'TRADE_DATE', 'CATEGORY', 'Depotbank', 'PRICE_BUY'];

module.exports = function registerDealsUpdateHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[dealsUpdate.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[dealsUpdate.handlers] dbApi missing');
  if (typeof dbApi.runSQL !== 'function') throw new Error('[dealsUpdate.handlers] dbApi.runSQL missing');
  if (typeof refreshTable !== 'function') throw new Error('[dealsUpdate.handlers] refreshTable missing');

  console.log('[IPC] dealsUpdate.handlers registered');

  try { ipcMain.removeAllListeners('update-deals-fields'); } catch {}

  ipcMain.on('update-deals-fields', async (event, payload = {}) => {
    const port = String(payload?.port_name ?? '').trim();
    const updates = Array.isArray(payload?.updates) ? payload.updates : [];

    console.log('[UPDATE DEALS FIELDS] START', { port, rows: updates.length });

    try {
      if (!updates.length) throw new Error('no updates provided');

      await dbApi.runSQL('BEGIN');

      let updated = 0;
      for (const u of updates) {
        const tradeId = String(u?.TRADE_ID ?? '').trim();
        if (!tradeId) continue;

        const cols = ALLOWED_FIELDS.filter((f) =>
          Object.prototype.hasOwnProperty.call(u, f)
        );
        if (!cols.length) continue;

        const setClause = cols.map((c) => `"${c}" = ?`).join(', ');
        const params = cols.map((c) => {
          const v = u[c];
          return v === '' ? null : v;
        });
        params.push(tradeId);

        const res = await dbApi.runSQL(
          `UPDATE "DealsMain" SET ${setClause} WHERE "TRADE_ID" = ?`,
          params
        );

        updated += res?.changes ?? 0;
      }

      await dbApi.runSQL('COMMIT');

      refreshTable('DealsMain');

      console.log('[UPDATE DEALS FIELDS] DONE', { port, updated });
      event.sender.send('update-deals-fields-success', { port, updated });
    } catch (error) {
      try { await dbApi.runSQL('ROLLBACK'); } catch {}
      console.error('[UPDATE DEALS FIELDS] ERROR', error?.message || error);
      event.sender.send('update-deals-fields-error', {
        message: error?.message || String(error),
      });
    }
  });
};
