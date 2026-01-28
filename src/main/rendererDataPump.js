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
 *
 * Key behavior:
 * - Full snapshot is sent ONLY on webContents 'did-finish-load' (covers reloads).
 * - initTableNamesAndFirstSend() is kept for backward compatibility, but NO longer triggers a full send.
 * - If tableNames are not loaded when did-finish-load fires, we load them and then send once.
 */

module.exports = function createRendererDataPump({ app, getMainWindow, mainFct }) {
  if (!app) throw new Error('[rendererDataPump] app missing');
  if (typeof getMainWindow !== 'function') throw new Error('[rendererDataPump] getMainWindow missing');
  if (!mainFct?.queryDB) throw new Error('[rendererDataPump] mainFct.queryDB missing');
  if (!mainFct?.getAllTableNames) throw new Error('[rendererDataPump] mainFct.getAllTableNames missing');

  let tableNames = [];
  let tableNamesReady = false;
  let tableNamesLoading = false;

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

  function loadTableNames(cb) {
    if (tableNamesReady) {
      cb?.(null, tableNames);
      return;
    }
    if (tableNamesLoading) {
      // Simple: retry shortly until ready
      const t = setInterval(() => {
        if (tableNamesReady) {
          clearInterval(t);
          cb?.(null, tableNames);
        }
      }, 25);
      return;
    }

    tableNamesLoading = true;
    mainFct.getAllTableNames((err, received) => {
      tableNamesLoading = false;

      if (err) {
        console.error('[rendererDataPump] Error retrieving table names:', err.message);
        cb?.(err);
        return;
      }

      tableNames = (received || []).filter(t => !excluded.has(t));
      tableNamesReady = true;

      cb?.(null, tableNames);
    });
  }

  /**
   * Backward-compatible name.
   * Now: ONLY loads table names (no full send here).
   */
  function initTableNamesAndFirstSend() {
    loadTableNames();
  }

  /**
   * Full snapshot is sent only here (covers reload).
   * did-finish-load fires on first load AND on reload.
   */
  function installWindowDidFinishLoadSend() {
    app.on('browser-window-created', (_event, window) => {
      window.webContents.on('did-finish-load', () => {
        // On each (re)load: ensure we have names, then send once.
        loadTableNames((err) => {
          if (err) return;
          sendAllTablesToRenderer();
        });
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


