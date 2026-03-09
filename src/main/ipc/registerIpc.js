'use strict';

const registerPythonHandlers = require('./handlers/python.handlers');
const registerDbHandlers = require('./handlers/db.handlers');
const registerRatesActiveHandlers = require('./handlers/ratesActive.handlers');   // ← NEU

module.exports = function registerIpc({ ipcMain, services }) {

  // ======================================================
  // Python Handlers
  // ======================================================
  registerPythonHandlers({
    ipcMain,
    startPythonScriptWithEvent: services.startPythonScriptWithEvent,
    refreshTable: services.refreshTable,
    dbApi: services.dbApi,
  });

  // ======================================================
  // DB Legacy (disabled stub)
  // ======================================================
  registerDbHandlers({ ipcMain });

  // ======================================================
  // RATES_ACTIVE Scenario Handler (NEW)
  // ======================================================
  registerRatesActiveHandlers({
  ipcMain,
  dbApi: services.dbApi
});

};



