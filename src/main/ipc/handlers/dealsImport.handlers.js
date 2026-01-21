// src/main/ipc/handlers/dealsImport.handlers.js
'use strict';

/**
 * DealsFromImport (semantisch) — technisch weiterhin DealsMain.
 * Keine neuen Tabellen. Keine Migration.
 */
module.exports = function registerDealsImportHandlers({
  ipcMain,
  sqliteDb,
  dbApi,        // { getAllRowsFromTable, insertRowInTable }
  refreshTable, // function(tableName, cb?)
}) {
  if (!ipcMain) throw new Error('[dealsImport.handlers] ipcMain missing');
  if (!sqliteDb) throw new Error('[dealsImport.handlers] sqliteDb missing');
  if (!dbApi) throw new Error('[dealsImport.handlers] dbApi missing');
  if (typeof refreshTable !== 'function') throw new Error('[dealsImport.handlers] refreshTable missing');

  const { getAllRowsFromTable, insertRowInTable } = dbApi;
  if (typeof getAllRowsFromTable !== 'function') throw new Error('[dealsImport.handlers] dbApi.getAllRowsFromTable missing');
  if (typeof insertRowInTable !== 'function') throw new Error('[dealsImport.handlers] dbApi.insertRowInTable missing');

  function extractDepotbank(fileName) {
    if (!fileName || typeof fileName !== 'string') return '';
    return fileName.split('_')[0];
  }

  // Ensure we don't accidentally double-register during refactors
  try { ipcMain.removeHandler('create-deals-from-import'); } catch {}

  /**
   * Creates "DealsFromImport" in DealsMain (same table).
   * - Deletes existing DealsMain rows for port_name = tableName
   * - Inserts new rows derived from the import table
   */
  ipcMain.handle('create-deals-from-import', async (_event, { tableName, columnMap } = {}) => {
    try {
      const portName = String(tableName || '').trim();
      if (!portName) throw new Error('tableName missing');

      // 🧼 Delete old imported deals for this port_name
      await new Promise((resolve, reject) => {
        sqliteDb.run(`DELETE FROM DealsMain WHERE port_name = ?`, [portName], function (err) {
          if (err) return reject(err);
          resolve();
        });
      });

      const priceBuyCol = columnMap?.find(m => m.to === 'PRICE_BUY')?.from;

      const rows = await getAllRowsFromTable(portName);
      const validRows = (rows || []).filter(r => r && r.PROD_ID);

      let insertedCount = 0;

      for (const r of validRows) {
        const newRow = {
          INCLUDE: 1,
          PROD_ID: r.PROD_ID,
          TRADE_DATE: new Date().toISOString().split('T')[0],
          CATEGORY: '2_lgfr_Anlagevermögen',
          NOTIONAL: 1000000,
          PRICE_BUY: priceBuyCol ? r[priceBuyCol] : null,
          Depotbank: extractDepotbank(portName),
          port_name: portName,
        };

        // Critical: never accept TRADE_ID from derived/import rows
        delete newRow.TRADE_ID;

        await new Promise((resolve, reject) => {
          insertRowInTable(newRow, 'DealsMain', (err) => (err ? reject(err) : resolve()));
        });

        insertedCount++;
      }

      if (insertedCount > 0) refreshTable('DealsMain');

      return { success: true, insertedCount };
    } catch (err) {
      console.error('[dealsImport] create-deals-from-import error:', err);
      return { success: false, error: err?.message || String(err) };
    }
  });
};

