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
  // ipcMain.on('save-deals-selection', async (_event, selectionData = {}) => {
  //   console.log('save-deals-selection: STARTED')
  //   const { port_name, selectedTradeIDs } = selectionData || {};
  //   try {
  //     const port = String(port_name || '').trim();
  //     const ids = Array.isArray(selectedTradeIDs) ? selectedTradeIDs : [];

  //     if (!port) throw new Error('port_name missing');
  //     // ids darf leer sein (dann speichert insertSelection evtl. "none")

  //     await insertSelection(port, ids);
  //     refreshTable('DealsMain');
  //   } catch (error) {
  //     console.error('[dealsSelection] save-deals-selection error:', error?.message || error);
  //   }
  // });

  ipcMain.on('save-deals-selection', async (event, selectionData = {}) => {
    console.log('save-deals-selection: STARTED')
  const { port_name, selectedTradeIDs } = selectionData || {};
  try {
    const port = String(port_name || '').trim();

    const ids = Array.isArray(selectedTradeIDs)
      ? selectedTradeIDs
          .map(x => Number(String(x).trim()))
          .filter(n => Number.isFinite(n))
      : [];

    if (!port) throw new Error('port_name missing');
    if (!ids.length) throw new Error('selectedTradeIDs empty');

    await insertSelection(port, ids);
    refreshTable('DealsMain');

    try { event.sender.send('save-deals-selection-success', { port, count: ids.length }); } catch {}
  } catch (error) {
    console.error('[dealsSelection] save-deals-selection error:', error?.message || error);
    try { event.sender.send('save-deals-selection-error', { message: error?.message || String(error) }); } catch {}
  }
});


try { ipcMain.removeAllListeners('delete-deals-selection'); } catch {}

ipcMain.on('delete-deals-selection', async (event, payload = {}) => {
  const rawPort = payload?.port_name;
  const port = String(rawPort ?? '').trim();

  console.log('[DELETE DEALS] START');
  console.log('[DELETE DEALS] raw port_name:', rawPort);
  console.log('[DELETE DEALS] normalized port_name:', `"${port}"`);

  try {
    if (!port) throw new Error('port_name missing');

    // 🔍 COUNT BEFORE
    const before = await dbApi.selectAll?.(
      `SELECT COUNT(*) AS cnt FROM "DealsMain" WHERE TRIM(port_name) = ?`,
      [port]
    );
    console.log('[DELETE DEALS] rows BEFORE delete:', before?.[0]?.cnt);

    // 🧨 DELETE
    const res = await dbApi.runSQL?.(
      `DELETE FROM "DealsMain" WHERE TRIM(port_name) = ?`,
      [port]
    );
    console.log('[DELETE DEALS] sqlite changes:', res?.changes);

    // 🔍 COUNT AFTER
    const after = await dbApi.selectAll?.(
      `SELECT COUNT(*) AS cnt FROM "DealsMain" WHERE TRIM(port_name) = ?`,
      [port]
    );
    console.log('[DELETE DEALS] rows AFTER delete:', after?.[0]?.cnt);

    refreshTable('DealsMain');

    console.log('[DELETE DEALS] DONE');
    try {
      event.sender.send('delete-deals-selection-success', {
        port,
        deleted: res?.changes ?? 0,
      });
    } catch {}

  } catch (error) {
    console.error('[DELETE DEALS] ERROR:', error?.message || error);
    try {
      event.sender.send('delete-deals-selection-error', {
        message: error?.message || String(error)
      });
    } catch {}
  }
});



};
