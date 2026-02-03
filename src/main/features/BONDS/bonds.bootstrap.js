'use strict';

const { createBondsService } = require('./bonds.service');
const { registerBondsIPC } = require('./bonds.ipc');

// We reuse your existing DataCollector implementation ONLY for parsing.
// No PDF search here. No resolver needed.
const { createDataCollector } = require('../../main_DataCollector.js');

function bootstrapBonds({ ipcMain, log }) {
  log = log || (() => {});

  // DataCollector needs resolvePdf for other methods, but for parseSinglePdf it’s not required.
  // Still, we pass a safe stub.
  const dataCollector = createDataCollector({
    resolvePdf: async () => null,
  });

  const service = createBondsService({ dataCollector, log });

  registerBondsIPC({ ipcMain, service, log });

  log({ level: 'info', msg: 'BONDS bootstrapped' });

  return { service };
}

module.exports = { bootstrapBonds };
