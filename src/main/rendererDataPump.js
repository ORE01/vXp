'use strict';

const { logger } = require('./utils/logger');

const DEBUG_DATAPUMP = false;

function log(...args) {
  if (DEBUG_DATAPUMP) console.log(...args);
}

function warn(...args) {
  if (DEBUG_DATAPUMP) console.warn(...args);
}

module.exports = function createRendererDataPump({ app, getMainWindow, mainFct }) {
  if (!app) throw new Error('[rendererDataPump] app missing');
  if (typeof getMainWindow !== 'function') throw new Error('[rendererDataPump] getMainWindow missing');
  if (!mainFct?.queryDB) throw new Error('[rendererDataPump] mainFct.queryDB missing');
  if (!mainFct?.getAllTableNames) throw new Error('[rendererDataPump] mainFct.getAllTableNames missing');

  let tableNames = [];
  let tableNamesReady = false;
  let tableNamesLoading = false;

  const excluded = new Set([
    'sqlite_sequence',
    'Instruments',
    'PDMain',
    'sortedLossesIndicesMain',
  ]);

  function safeSend(channel, payload) {
    try {
      const win = getMainWindow();

      if (!win || win.isDestroyed() || !win.webContents) {
        warn('[DATAPUMP] safeSend skipped, window missing:', channel);
        return;
      }

      const count = Array.isArray(payload) ? payload.length : 'NOT_ARRAY';

      if (
        channel.includes('SWAPTION') ||
        channel.includes('EUSWAPTION') ||
        channel.includes('RATES') ||
        channel.includes('CS_')
      ) {
        log('[DATAPUMP] SEND:', channel, 'rows:', count);
        if (Array.isArray(payload) && payload.length) {
          log('[DATAPUMP] SAMPLE:', payload[0]);
        }
      }

      win.webContents.send(channel, payload);
    } catch (err) {
      warn('[DATAPUMP] safeSend error:', channel, err);
    }
  }

  function resolveTableName(tableName) {
    if (tableName === 'Portfolios') {
      return 'v_Portfolios_enriched';
    }
    return tableName;
  }

  function fetchDataAndSendEvent(queryOrTable, eventName, cb) {
    if (
      String(queryOrTable).includes('SWAPTION') ||
      String(eventName).includes('SWAPTION')
    ) {
      log('[DATAPUMP] FETCH:', {
        queryOrTable,
        eventName,
      });
    }

    mainFct.queryDB(queryOrTable, (err, rows) => {
      if (err) {
        logger.error('rendererDataPump', 'Error fetching data', err);
        warn('[DATAPUMP] FETCH ERROR:', queryOrTable, eventName, err);
        cb?.(err);
        return;
      }

      if (
        String(queryOrTable).includes('SWAPTION') ||
        String(eventName).includes('SWAPTION')
      ) {
        log('[DATAPUMP] FETCH OK:', eventName, 'rows:', rows?.length || 0);
      }

      safeSend(eventName, rows || []);
      cb?.(null, rows || []);
    });
  }

  function sendAllTablesToRenderer() {
    if (!Array.isArray(tableNames) || tableNames.length === 0) {
      warn('[DATAPUMP] sendAllTablesToRenderer skipped: no tableNames');
      return;
    }

    log('[DATAPUMP] sendAllTablesToRenderer table count:', tableNames.length);

    const swaptionTables = tableNames.filter(t =>
      String(t).toUpperCase().includes('SWAPTION')
    );

    log('[DATAPUMP] SWAPTION TABLES FOUND:', swaptionTables);

    for (const tableName of tableNames) {
      const resolved = resolveTableName(tableName);
      const eventName = `${tableName}Data`;

      if (String(tableName).toUpperCase().includes('SWAPTION')) {
        log('[DATAPUMP] SWAPTION SEND LOOP:', {
          tableName,
          resolved,
          eventName,
        });
      }

      fetchDataAndSendEvent(resolved, eventName);
    }
  }

  function refreshTable(tableName, callback) {
    const eventIdentifier = `${tableName}Data`;
    const resolved = resolveTableName(tableName);

    log('[DATAPUMP] refreshTable:', {
      tableName,
      resolved,
      eventIdentifier,
    });

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
        logger.error('rendererDataPump', 'Error retrieving table names', err);
        warn('[DATAPUMP] getAllTableNames error:', err);
        cb?.(err);
        return;
      }

      log('[DATAPUMP] RAW TABLE NAMES:', received);

      tableNames = (received || []).filter(t => !excluded.has(t));
      tableNamesReady = true;

      log('[DATAPUMP] FILTERED TABLE NAMES:', tableNames);

      log(
        '[DATAPUMP] HAS SWAPTION_ATM_SCENARIO_DATA:',
        tableNames.includes('SWAPTION_ATM_SCENARIO_DATA')
      );

      log(
        '[DATAPUMP] HAS SWAPTION_ACTIVE:',
        tableNames.includes('SWAPTION_ACTIVE')
      );

      cb?.(null, tableNames);
    });
  }

  function initTableNamesAndFirstSend() {
    loadTableNames();
  }

  function installWindowDidFinishLoadSend() {
    app.on('browser-window-created', (_event, window) => {
      window.webContents.on('did-finish-load', () => {
        log('[DATAPUMP] did-finish-load');

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