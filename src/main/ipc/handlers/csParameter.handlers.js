'use strict';

/**
 * csParameter.handlers.js
 * IPC: csparameter-update
 *
 * Injected deps:
 * - dbApi.insertCSParameter(newRowData, cleanTableName, cb)
 * - refreshTable(cleanTableName)
 */

module.exports = function registerCSParameterHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[csParameter.handlers] ipcMain missing');
  if (!dbApi?.insertCSParameter) throw new Error('[csParameter.handlers] dbApi.insertCSParameter missing');
  if (typeof refreshTable !== 'function') throw new Error('[csParameter.handlers] refreshTable missing');

  const handleCSParameterUpdate = (event, payload) => {
    const { newRowData, cleanTableName } = payload || {};

    if (!cleanTableName || typeof cleanTableName !== 'string') {
      return event.reply('csparameter-update-error', 'cleanTableName missing/invalid');
    }
    if (!newRowData || typeof newRowData !== 'object') {
      return event.reply('csparameter-update-error', 'newRowData missing/invalid');
    }

    dbApi.insertCSParameter(newRowData, cleanTableName, (err) => {
      if (err) {
        console.error('Error inserting CSParameter row:', err.message);
        event.reply('csparameter-update-error', err.message);
      } else {
        event.reply('csparameter-update-success');
        refreshTable(cleanTableName);
      }
    });
  };

  ipcMain.on('csparameter-update', handleCSParameterUpdate);
};
