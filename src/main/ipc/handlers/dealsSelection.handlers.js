// src/main/ipc/handlers/dealsSelection.handlers.js
'use strict';

/**
 * Deals Selection (technisch: DealsMain)
 * - save-deals-selection  -> dbApi.insertSelection(port_name, selectedTradeIDs)
 * - delete-selected-table -> dbApi.deleteTable(selectedTableName, sender)
 *
 * Keine neuen Tabellen. Keine DB-Änderungen.
 */
module.exports = function registerDealsSelectionHandlers({
  ipcMain,
  dbApi,        // { insertSelection, deleteTable }
  refreshTable, // function(tableName, cb?)
}) {
  if (!ipcMain) throw new Error('[dealsSelection.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[dealsSelection.handlers] dbApi missing');
  if (typeof refreshTable !== 'function') throw new Error('[dealsSelection.handlers] refreshTable missing');

  const { insertSelection, deleteTable } = dbApi;

  if (typeof insertSelection !== 'function') {
    throw new Error('[dealsSelection.handlers] dbApi.insertSelection missing');
  }
  if (typeof deleteTable !== 'function') {
    throw new Error('[dealsSelection.handlers] dbApi.deleteTable missing');
  }

  // Avoid double registration during refactors
  try { ipcMain.removeAllListeners('save-deals-selection'); } catch {}
  try { ipcMain.removeAllListeners('delete-selected-table'); } catch {}

  // SAVE DEALS SELECTION
  ipcMain.on('save-deals-selection', async (_event, selectionData = {}) => {
    const { port_name, selectedTradeIDs } = selectionData || {};
    try {
      const port = String(port_name || '').trim();
      const ids = Array.isArray(selectedTradeIDs) ? selectedTradeIDs : [];

      if (!port) throw new Error('port_name missing');
      // ids darf leer sein (dann speichert insertSelection evtl. "none")

      await insertSelection(port, ids);
      refreshTable('DealsMain');
    } catch (error) {
      console.error('[dealsSelection] save-deals-selection error:', error?.message || error);
    }
  });

  // DELETE DEALS SELECTION / TABLE
  ipcMain.on('delete-selected-table', async (event, selectedTableName) => {
    try {
      await deleteTable(selectedTableName);
      // optional: UI Feedback
      try { event.sender.send('delete-selected-table-success', { tableName: selectedTableName }); } catch {}
    } catch (error) {
      console.error('[dealsSelection] delete-selected-table error:', error?.message || error);
      try { event.sender.send('delete-selected-table-error', { message: error?.message || String(error) }); } catch {}
    }
  });

};
