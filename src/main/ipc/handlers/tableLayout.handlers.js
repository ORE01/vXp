// src/main/ipc/handlers/tableLayout.handlers.js
'use strict';

const tableLayoutService = require('../../services/tableLayout.service');

function registerTableLayoutHandlers({ ipcMain, db }) {

  // ---------------------------
  // V1 (bestehend)
  // ---------------------------

  ipcMain.handle('table-layout:get', async (_event, tableId) => {
    return tableLayoutService.getTableLayout(db, tableId);
  });

  ipcMain.handle('table-layout:save', async (_event, tableId, layout) => {
    return tableLayoutService.saveTableLayout(db, tableId, layout);
  });

  // ---------------------------
  // V2 (neu)
  // ---------------------------

  ipcMain.handle('table-layout:get-one', async (_event, tableId, layoutName) => {
    return tableLayoutService.getTableLayoutV2(db, tableId, layoutName);
  });

  ipcMain.handle('table-layout:save-one', async (_event, tableId, layoutName, layout) => {
    return tableLayoutService.saveTableLayoutV2(db, tableId, layoutName, layout);
  });

  ipcMain.handle('table-layout:get-all', async (_event, tableId) => {
    return tableLayoutService.getTableLayoutsV2(db, tableId);
  });
}

module.exports = registerTableLayoutHandlers;