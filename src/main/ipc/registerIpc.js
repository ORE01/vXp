'use strict';

const registerPythonHandlers = require('./handlers/python.handlers');
const registerDbHandlers = require('./handlers/db.handlers');

module.exports = function registerIpc({ ipcMain, services }) {
  // Python handlers
  registerPythonHandlers({
    ipcMain,
    startPythonScriptWithEvent: services.startPythonScriptWithEvent,
    refreshTable: services.refreshTable,
    dbApi: services.dbApi,
  });

  // DB handlers (disabled stub)
  registerDbHandlers({ ipcMain });
};




