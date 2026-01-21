'use strict';

/**
 * rendererDataPump.js
 * Centralized "send tables to renderer" + refreshTable helper.
 *
 * Inject:
 * - app (electron app)
 * - getMainWindow(): returns BrowserWindow | null
 * - mainFct.queryDB(queryOrTable, cb)
 * - mainFct.getAllTableNames(cb)
 */

module.exports = function createRendererDataPump({ app, getMainWindow, mainFct }) {
  if (!app) throw new Error('[rendererDataPump] app missing');
  if (typeof getMainWindow !== 'function') throw new Error('[rendererDataPump] getMainWindow missing');
  if (!mainFct?.queryDB) throw new Error('[rendererDataPump] mainFct.queryDB missing');
  if (!mainFct?.getAllTableNames) throw new Error('[rendererDataPump] mainFct.getAllTableNames missing');

  let tableNames = [];

  const excluded = new Set(['sqlite_sequence', 'Instruments', 'PDMain', 'sortedLossesIndicesMain']);

  function safeSend(channel, payload) {
    try {
      const win = getMainWindow();
      if (!win || win.isDestroyed() || !win.webContents) return;
      win.webContents.send(channel, payload);
    } catch {}
  }

  function resolveTableName(tableName) {
    return (tableName === 'Portfolios') ? 'v_Portfolios_enriched' : tableName;
  }

  function fetchDataAndSendEvent(queryOrTable, eventName, cb) {
    mainFct.queryDB(queryOrTable, (err, rows) => {
      if (err) {
        console.error('[rendererDataPump] Error fetching data:', err.message);
        cb?.(err);
        return;
      }
      safeSend(eventName, rows || []);
      cb?.(null, rows || []);
    });
  }

  function sendAllTablesToRenderer() {
    if (!Array.isArray(tableNames) || tableNames.length === 0) return;

    for (const tableName of tableNames) {
      const resolved = resolveTableName(tableName);
      const eventName = `${tableName}Data`;
      fetchDataAndSendEvent(resolved, eventName);
    }
  }

  function refreshTable(tableName, callback) {
    const eventIdentifier = `${tableName}Data`;
    const resolved = resolveTableName(tableName);

    fetchDataAndSendEvent(resolved, eventIdentifier, (err, rows) => {
      if (typeof callback === 'function') callback(err, rows);
    });
  }

  function initTableNamesAndFirstSend() {
    mainFct.getAllTableNames((err, received) => {
      if (err) {
        console.error('[rendererDataPump] Error retrieving table names:', err.message);
        return;
      }
      tableNames = (received || []).filter(t => !excluded.has(t));
      sendAllTablesToRenderer();
    });
  }

  function installWindowDidFinishLoadSend() {
    app.on('browser-window-created', (_event, window) => {
      window.webContents.on('did-finish-load', () => {
        sendAllTablesToRenderer();
      });
    });
  }

  return {
    installWindowDidFinishLoadSend,
    initTableNamesAndFirstSend,
    fetchDataAndSendEvent,
    refreshTable,
    sendAllTablesToRenderer,
    emitToRenderer: safeSend,
  };
};

