'use strict';

const {
  IPC_BONDS_PARSE_PDF,
  IPC_BONDS_PARSE_PDF_BATCH,
  IPC_BONDS_PARSE_PDF_LEGACY,
} = require('./bonds.domains');

function registerBondsIPC({ ipcMain, service, log }) {
  log = log || (() => {});
  if (!ipcMain || typeof ipcMain.handle !== 'function') throw new Error('BONDS.ipc: ipcMain missing');
  if (!service) throw new Error('BONDS.ipc: service missing');

  // NEW
  ipcMain.handle(IPC_BONDS_PARSE_PDF, async (_evt, payload) => {
    log({ level: 'debug', msg: 'IPC bonds:parsePdf', payload: safePreview(payload) });
    return service.parsePdf(payload || {});
  });

  ipcMain.handle(IPC_BONDS_PARSE_PDF_BATCH, async (_evt, items) => {
    log({ level: 'debug', msg: 'IPC bonds:parsePdfBatch', count: Array.isArray(items) ? items.length : 0 });
    return service.parsePdfBatch(items || []);
  });

  // LEGACY alias: bonds:parsePdfUrl -> bonds:parsePdf
  ipcMain.handle(IPC_BONDS_PARSE_PDF_LEGACY, async (_evt, payload) => {
    log({ level: 'debug', msg: 'IPC legacy bonds:parsePdfUrl -> bonds:parsePdf' });
    return service.parsePdf(payload || {});
  });
}

function safePreview(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const { isin, url } = payload;
  return { isin, url: url ? String(url).slice(0, 80) + (String(url).length > 80 ? '…' : '') : null };
}

module.exports = { registerBondsIPC };
