'use strict';

const ipcRegistry = require('./ipc.registry');

module.exports = function registerAllIpcHandlers({
  ipcMain,
  mainFct,
  sqliteDb,
  refreshTable,
  emitToRenderer,
  services = {},
}) {
  const dbApi = {
    selectAll: mainFct.selectAll,
    runSQL: mainFct.runSQL,
    insertRowInTable: mainFct.insertRowInTable,
    getAllRowsFromTable: mainFct.getAllRowsFromTable,
    updateRecord: mainFct.updateRecord,
    eraseRowFromDB: mainFct.eraseRowFromDB,
    insertSelection: mainFct.insertSelection,
    deleteTable: mainFct.deleteTable,
    updateCustomerTexts: mainFct.updateCustomerTexts,
    insertCSParameter: mainFct.insertCSParameter,
  };

  const baseCtx = {
    ipcMain,
    mainFct,
    sqliteDb,
    refreshTable,
    emitToRenderer,
    services,
    dbApi,
  };

  for (const entry of ipcRegistry) {
    if (typeof entry.register !== 'function') {
      throw new Error(`[IPC Registry] register missing for ${entry.name}`);
    }

    const ctx = entry.getCtx(baseCtx);
    entry.register(ctx);
  }

  console.log(`[IPC] Registered ${ipcRegistry.length} handler modules`);
};