// src/main/index.js
'use strict';

require('dotenv').config();
const { app, BrowserWindow, ipcMain, session } = require('electron');
const path = require('path');

// Projektroot (wo index.html liegt)
const ROOT = path.join(__dirname, '../..');

// Core
const registerIpc = require('./ipc/registerIpc');
const mainFct = require('./main_fct');

// ===============================
// DB Service (Phase 1)
// ===============================
const dbService = require('./services/db.service');

// Handlers (modular)
const registerIpcMetaHandlers = require('./ipc/handlers/ipcMeta.handlers');
const registerIssuerHandlers = require('./ipc/handlers/issuer.handlers');
const registerProductsHandlers = require('./ipc/handlers/products.handlers');
const registerDealsImportHandlers = require('./ipc/handlers/dealsImport.handlers');
const registerCrudHandlers = require('./ipc/handlers/crud.handlers');
const registerDealsSelectionHandlers = require('./ipc/handlers/dealsSelection.handlers');
const registerCustomerHandlers = require('./ipc/handlers/customer.handlers');
const registerTrainingHandlers = require('./ipc/handlers/training.handlers');
const registerColumnImportHandlers = require('./ipc/handlers/columnImport.handlers');
const registerCSParameterHandlers = require('./ipc/handlers/csParameter.handlers');

// ✅ Data Pump (ausgelagert)
const createRendererDataPump = require('./rendererDataPump');

const createCouponWindowController = require('./windows/couponWindow');
const registerCouponWindowHandlers = require('./ipc/handlers/couponWindow.handlers');


// ========================= DATA COLLECTOR =========================
const {
  createDataCollector,
  createCrawlerResolver,
  createContentMatchingResolver,
  createSitemapResolver
} = require('./main_DataCollector.js');

let dc;

// -------------------------------
// Env helpers
// -------------------------------
function isDevelopmentEnvironment() {
  const env = (process.env.NODE_ENV || '').trim().toLowerCase();
  return env === 'development' || env === 'thomasdev';
}

// -------------------------------
// Logging path for dbService
// -------------------------------
const logFilePath = isDevelopmentEnvironment()
  ? path.join(__dirname, 'logfile.txt')                 // dev: neben main/index.js
  : path.join(app.getPath('userData'), 'logfile.txt');  // prod: userData

dbService.setLogFilePath(logFilePath);

// DB beim Boot öffnen (damit main_fct.js kein eigenes sqlite3 mehr öffnen muss)
try { dbService.initDb(); } catch (e) { console.warn('[main] initDb failed', e); }
const sqliteDb = dbService.getDb();

// -------------------------------
// Window state
// -------------------------------
let mainWindow;


function getMainWindow() {
  return mainWindow;
}

// -------------------------------
// DataCollector boot
// -------------------------------
function buildResolver() {
  const domains = [
    // Issuer & Regulator
    'bngbank.com', 'afm.nl', 'esma.europa.eu',
    // Listings
    'bourse.lu', 'luxse.com', 'euronext.com', 'ise.ie', 'londonstockexchange.com',
    // AT optional
    'oebfa.at', 'wienerborse.at',
  ];

  const crawler  = createCrawlerResolver(domains, { maxDepth: 2, maxPagesPerDomain: 60, maxPdfChecksPerDomain: 40 });
  const content  = createContentMatchingResolver(domains, { maxCandidatesPerDomain: 40 });
  const sitemaps = createSitemapResolver(domains);

  return async (isin) =>
    (await crawler(isin)) || (await content(isin)) || (await sitemaps(isin)) || null;
}

function initDataCollector() {
  const resolver = buildResolver();
  dc = createDataCollector({ resolvePdf: resolver });
}

function registerBondFetchIpc() {
  ipcMain.handle('bonds:fetch', async (_evt, isins) => {
    try {
      if (!Array.isArray(isins) || isins.length === 0) return [];
      const res = await dc.fetchTermsAndSchedule(isins);
      return res.map(r => ({
        isin: r.isin,
        terms: r.terms || {},
        rows: Array.isArray(r.rows) ? r.rows : [],
        error: r.error
      }));
    } catch (err) {
      console.error('bonds:fetch error', err);
      return [{ isin: null, terms: {}, rows: [], error: err?.message || String(err) }];
    }
  });

  ipcMain.handle('bonds:fetchTermsOnly', async (_evt, isins) => {
    try {
      if (!Array.isArray(isins) || isins.length === 0) return [];
      const res = await dc.fetchTermsOnly(isins);
      return res.map(r => ({
        isin: r.isin,
        terms: r.terms || {},
        error: r.error
      }));
    } catch (err) {
      console.error('bonds:fetchTermsOnly error', err);
      return [{ isin: null, terms: {}, error: err?.message || String(err) }];
    }
  });

  ipcMain.handle('bonds:parsePdfUrl', async (_evt, { url, isin }) => {
    try {
      if (!url) return { ok: false, error: 'pdf url required' };
      const r = await dc.parseSinglePdf(url, isin || null);
      return { ok: true, ...r };
    } catch (err) {
      return { ok: false, error: err?.message || String(err) };
    }
  });
}

// -------------------------------
// CSP
// -------------------------------
function installCspHeaders() {
  session.defaultSession.webRequest.onHeadersReceived((details, cb) => {
    const csp = [
      "default-src 'self'",
      "script-src 'self' https://cdn.jsdelivr.net https://cdnjs.cloudflare.com",
      "style-src 'self' 'unsafe-inline'",
      "img-src 'self' data: blob:",
      "font-src 'self' data:",
      "connect-src 'self' ws://localhost:* http://localhost:*",
      "worker-src 'self' blob:",
      "base-uri 'self'",
      "form-action 'self'",
      "frame-ancestors 'none'"
    ].join('; ');

    cb({
      responseHeaders: {
        ...details.responseHeaders,
        'Content-Security-Policy': [csp],
      }
    });
  });
}

// -------------------------------
// Windows
// -------------------------------
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 800,
    height: 700,
    icon: path.join(__dirname, 'vXp.ico'),
    webPreferences: {
      preload: path.join(__dirname, '../preload/index.js'),
      devTools: true,
    },
  });

  mainWindow.loadFile(path.join(ROOT, 'index.html'));
  //mainWindow.loadFile(path.join(ROOT, 'minimal.html'));
  mainWindow.webContents.openDevTools();

  // ✅ wichtig: Referenz sauber nullen, wenn geschlossen
  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}


// -------------------------------
// Handler registrations
// -------------------------------
function registerAllHandlers({ pump }) {
  const refreshTable = pump.refreshTable;
  const emitToRenderer = pump.emitToRenderer;
  const fetchDataAndSendEvent = pump.fetchDataAndSendEvent;

  registerIssuerHandlers({
    ipcMain,
    dbApi: { runSQL: mainFct.runSQL },
    sqliteDb,
    refreshTable,
  });

  registerProductsHandlers({
    ipcMain,
    dbApi: { runSQL: mainFct.runSQL },
    sqliteDb,
    refreshTable,
  });

  registerDealsImportHandlers({
    ipcMain,
    sqliteDb,
    dbApi: {
      getAllRowsFromTable: mainFct.getAllRowsFromTable,
      insertRowInTable: mainFct.insertRowInTable,
    },
    refreshTable,
  });

  registerCrudHandlers({
    ipcMain,
    dbApi: {
      updateRecord: mainFct.updateRecord,
      insertRowInTable: mainFct.insertRowInTable,
      eraseRowFromDB: mainFct.eraseRowFromDB,
    },
    refreshTable,
  });

  registerDealsSelectionHandlers({
    ipcMain,
    dbApi: {
      insertSelection: mainFct.insertSelection,
      deleteTable: mainFct.deleteTable,
    },
    refreshTable,
  });

  registerCustomerHandlers({
    ipcMain,
    sqliteDb,
    dbApi: {
      runSQL: mainFct.runSQL,
      updateCustomerTexts: mainFct.updateCustomerTexts,
    },
    refreshTable,
    emitToRenderer,
  });

  registerTrainingHandlers({ ipcMain });

  registerCSParameterHandlers({
    ipcMain,
    dbApi: { insertCSParameter: mainFct.insertCSParameter },
    refreshTable,
  });

  registerColumnImportHandlers({
    ipcMain,
    dbApi: {
      getAllRowsFromTable: mainFct.getAllRowsFromTable,
      insertRowInTable: mainFct.insertRowInTable,
    },
    refreshTable,
  });

  registerIpc({
    ipcMain,
    services: {
      startPythonScriptWithEvent: mainFct.startPythonScriptWithEvent,
      dbApi: {
        selectAll: mainFct.selectAll,
      },
      refreshTable,
    }
  });



}

// -------------------------------
// App lifecycle
// -------------------------------
app.whenReady().then(() => {
  installCspHeaders();

  // ✅ IPC Meta (Allowlist) – muss VOR preload-use stehen
  // (Voraussetzung: du hast registerIpcMetaHandlers({ ipcMain }) eingebunden)
  registerIpcMetaHandlers({ ipcMain });

  // DataCollector + bond handlers
  try {
    initDataCollector();
    registerBondFetchIpc();
  } catch (e) {
    console.warn('[main] DataCollector init failed', e);
  }

  // ✅ Data Pump zuerst (damit browser-window-created sicher erfasst wird)
  const pump = createRendererDataPump({ app, getMainWindow, mainFct });
  pump.installWindowDidFinishLoadSend();

  // ✅ Main Window erstellen (nur einmal)
  createWindow();

  // ✅ TableNames laden + initial send
  pump.initTableNamesAndFirstSend();

  // ✅ Handler erst nachdem pump existiert
  registerAllHandlers({ pump });

  // ✅ Coupon Window Controller + IPC Handler
  const couponWindow = createCouponWindowController({
    ROOT,
    preloadPath: path.join(__dirname, '../preload/index.js'),
    devTools: true,
  });

  registerCouponWindowHandlers({
    ipcMain,
    couponWindow,
  });

  // ✅ Sauberer activate: fokussieren statt neu erstellen (und nur neu, wenn wirklich weg)
  app.on('activate', () => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.show();
      mainWindow.focus();
      return;
    }

    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();

      // Safety: nach dem Recreate Daten wieder pushen
      mainWindow.webContents.on('did-finish-load', () => {
        pump.initTableNamesAndFirstSend();
      });
    }
  });
});


app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});

app.on('before-quit', () => {
  try { dbService.closeDatabase(); } catch {}
});





