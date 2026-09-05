'use strict';

module.exports = function registerDbHandlers({ ipcMain, refreshTable, dbApi }) {
  if (!ipcMain) {
    throw new Error('[db.handlers] ipcMain missing');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[db.handlers] refreshTable missing');
  }

  const msg = 'Legacy DB IPC is disabled (migrated to modular handlers).';

  // Still disabled legacy invoke channels.
  ipcMain.handle('get-all-table-names', async () => {
    throw new Error(msg);
  });

  ipcMain.handle('run-sql', async () => {
    throw new Error(msg);
  });

  // Active read-model refresh channel.
  // Used by renderer fetch.js:
  // window.api.send('fetch-table-data', '<TableName>')
  ipcMain.on('fetch-table-data', (_event, tableName) => {
    const safeTableName = String(tableName || '').trim();

    if (!safeTableName) {
      console.warn('[DB HANDLER] fetch-table-data skipped: tableName missing');
      return;
    }

    console.log('[DB HANDLER] fetch-table-data', {
      tableName: safeTableName,
    });

    refreshTable(safeTableName);
  });

  // Gefilterter Fetch fuer die grosse MarketVaR_FactorPL-Zeitreihe: NUR die Zeilen des
  // aktuellen (port, scenario, juengstes asof) laden statt der ganzen Tabelle (~208k Zeilen).
  // Antwort geht ueber den bestehenden Kanal 'MarketVaR_FactorPLData' zurueck -> gleicher
  // Renderer-Flow (dataRouter -> setMvarFactorPLData).
  ipcMain.on('fetch-mvar-factorpl', async (event, { port_name, scenario_name } = {}) => {
    try {
      const port = String(port_name || '').trim();
      const scen = String(scenario_name || '').trim();
      if (!port || !scen || !dbApi || typeof dbApi.selectAll !== 'function') {
        event.sender.send('MarketVaR_FactorPLData', []);
        return;
      }
      const rows = await dbApi.selectAll(
        `SELECT * FROM MarketVaR_FactorPL
         WHERE port_name = ? AND scenario_name = ?
           AND asof_date = (
             SELECT MAX(asof_date) FROM MarketVaR_FactorPL
             WHERE port_name = ? AND scenario_name = ?
           )`,
        [port, scen, port, scen]
      );
      console.log('[DB HANDLER] fetch-mvar-factorpl', { port, scen, rows: Array.isArray(rows) ? rows.length : 0 });
      event.sender.send('MarketVaR_FactorPLData', Array.isArray(rows) ? rows : []);
    } catch (e) {
      console.warn('[DB HANDLER] fetch-mvar-factorpl failed:', e?.message || e);
      try { event.sender.send('MarketVaR_FactorPLData', []); } catch {}
    }
  });

  // Optional stubs for older channels.
  ipcMain.on('update-record', (event) => {
    try {
      event.reply('update-record-response', {
        success: false,
        error: msg,
      });
    } catch {}
  });

  ipcMain.handle('erase-row', async () => {
    throw new Error(msg);
  });

  ipcMain.handle('get-all-rows', async () => {
    throw new Error(msg);
  });

  ipcMain.on('delete-table', (event) => {
    try {
      event.sender.send('delete-table-response', {
        success: false,
        message: msg,
      });
    } catch {}
  });
};