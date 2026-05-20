// src/main/index.js
'use strict';

require('dotenv').config();

const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

// =====================================================
// Paths
// =====================================================

const ROOT = path.join(__dirname, '../..');

// =====================================================
// Core modules
// =====================================================

const registerAllIpcHandlers = require('./ipc/registerAllIpcHandlers');
const mainFct = require('./main.gateway.js');
const dbService = require('./services/db.service');

mainFct.syncProductScheduleToProductEvents =
  dbService.syncProductScheduleToProductEvents;

mainFct.eraseCouponScheduleAndSync =
  dbService.eraseCouponScheduleAndSync;

const { logger } = require('./utils/logger');
const { installCspHeaders } = require('./security/cspHeaders');
const { createAppWindows } = require('./bootstrap/windows.bootstrap');
const { createDataCollectorBootstrap } = require('./bootstrap/dataCollector.bootstrap');

// =====================================================
// IPC Handlers
// =====================================================

const registerIpcMetaHandlers = require('./ipc/handlers/ipcMeta.handlers');
const registerCouponWindowHandlers = require('./ipc/handlers/couponWindow.handlers');
const registerBondFetchHandlers = require('./ipc/handlers/bondFetch.handlers');

// =====================================================
// Windows / Pump
// =====================================================

const createRendererDataPump = require('./rendererDataPump');
const createCouponWindowController = require('./windows/couponWindow');
const createMainWindowController = require('./windows/mainWindow');

// =====================================================
// Legacy / Features
// =====================================================

const {
  createDataCollector,
  createCrawlerResolver,
  createContentMatchingResolver,
  createSitemapResolver,
} = require('../legacy/legacyProspectusCollector.js');

const {
  bootstrapBondProspectusFinder,
} = require('./features/BOND_PROSPECTUS/bondProspectusFinder.bootstrap.js');

// =====================================================
// Boot Logs + Global Error Handling
// =====================================================

logger.debug('BOOT', `cwd = ${process.cwd()}`);
logger.debug('BOOT', `__dirname = ${__dirname}`);
logger.debug('BOOT', `NODE_ENV = ${process.env.NODE_ENV}`);

process.on('unhandledRejection', (reason) => {
  logger.error('PROCESS', 'Unhandled promise rejection', reason);
});

process.on('uncaughtException', (error) => {
  logger.error('PROCESS', 'Uncaught exception', error);
});

// =====================================================
// State
// =====================================================

let mainWindow = null;
let dc = null;

const sqliteDb = initDbOnce();

// =====================================================
// Helpers
// =====================================================

function isDevelopmentEnvironment() {
  const env = (process.env.NODE_ENV || '').trim().toLowerCase();
  return env === 'development' || env === 'thomasdev';
}

function initDbOnce() {
  const logFilePath = isDevelopmentEnvironment()
    ? path.join(__dirname, 'logfile.txt')
    : path.join(app.getPath('userData'), 'logfile.txt');

  dbService.setLogFilePath(logFilePath);

  try {
    dbService.initDb();
  } catch (e) {
    logger.warn('main', 'initDb failed', e);
  }

  try {
    return dbService.getDb();
  } catch (e) {
    logger.warn('main', 'getDb failed', e);
    return null;
  }
}

function getMainWindow() {
  return mainWindow;
}

function setMainWindow(win) {
  mainWindow = win;
}

function createHttpGet() {
  if (typeof fetch !== 'function') {
    throw new Error('global fetch not available');
  }

  return async (url, opts = {}) => {
    const timeoutMs = Number(opts.timeoutMs || 12000);

    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        method: 'GET',
        signal: ctrl.signal,
      });

      const text = await res.text();

      return {
        status: res.status,
        text,
      };
    } finally {
      clearTimeout(timer);
    }
  };
}

function registerAllHandlers({ pump }) {
  registerAllIpcHandlers({
    ipcMain,
    mainFct,
    sqliteDb,
    refreshTable: pump.refreshTable,
    emitToRenderer: pump.emitToRenderer,
    services: {
      startPythonScriptWithEvent: mainFct.startPythonScriptWithEvent,
    },
  });
}

function bootstrapFeatures() {
  try {
    const httpGet = createHttpGet();

    bootstrapBondProspectusFinder({
      ipcMain,
      httpGet,
      log: (payload) => logger.info('BondProspectusFinder', 'event', payload),
    });
  } catch (e) {
    logger.warn('main', 'BondProspectusFinder init failed', e);
  }
}

// =====================================================
// App Lifecycle
// =====================================================

app.whenReady().then(() => {
  installCspHeaders({ session });

  registerIpcMetaHandlers({ ipcMain });

  try {
    const dataCollector = createDataCollectorBootstrap({
      createDataCollector,
      createCrawlerResolver,
      createContentMatchingResolver,
      createSitemapResolver,
    });

    dc = dataCollector.init();

    registerBondFetchHandlers({
      ipcMain,
      dc,
    });
  } catch (e) {
    logger.warn('main', 'DataCollector init failed', e);
  }

  bootstrapFeatures();

  const pump = createRendererDataPump({
    app,
    getMainWindow,
    mainFct,
  });

  pump.installWindowDidFinishLoadSend();

  const windows = createAppWindows({
    app,
    BrowserWindow,
    ROOT,
    preloadPath: path.join(__dirname, '../preload/index.js'),
    createMainWindowController,
    createCouponWindowController,
    registerCouponWindowHandlers,
    ipcMain,
    pump,
    getMainWindow,
    setMainWindow,
  });

  windows.createMainWindow();

  pump.initTableNamesAndFirstSend();

  registerAllHandlers({ pump });

  windows.initCouponWindow();
  windows.installActivateHandler();
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  try {
    dbService.closeDatabase();
  } catch (e) {
    logger.warn('main', 'closeDatabase failed', e);
  }
});





