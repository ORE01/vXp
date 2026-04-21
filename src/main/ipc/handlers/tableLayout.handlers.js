// src/main/ipc/handlers/tableLayout.handlers.js
'use strict';

const tableLayoutService = require('../../services/tableLayout.service');

function registerTableLayoutHandlers({ ipcMain }) {
  ipcMain.handle('table-layout:get', async (_event, tableId) => {
    return tableLayoutService.getTableLayout(tableId);
  });

  ipcMain.handle('table-layout:save', async (_event, tableId, layout) => {
    return tableLayoutService.saveTableLayout(tableId, layout);
  });
}

module.exports = registerTableLayoutHandlers;