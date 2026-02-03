'use strict';

const {
  IPC_BOND_PROSPECTUS_FIND,
  IPC_BOND_PROSPECTUS_PING,
} = require('./bondProspectusFinder.domains.js');

function registerBondProspectusFinderIPC(deps) {
  const ipcMain = deps && deps.ipcMain;
  const resolver = deps && deps.resolver;
  const log = deps && deps.log ? deps.log : (() => {});

  if (!ipcMain || typeof ipcMain.handle !== 'function') throw new Error('BondProspectusFinderIPC: ipcMain missing');
  if (!resolver || typeof resolver.resolveFind !== 'function') throw new Error('BondProspectusFinderIPC: resolver missing');

  ipcMain.handle(IPC_BOND_PROSPECTUS_PING, async () => resolver.ping());

  ipcMain.handle(IPC_BOND_PROSPECTUS_FIND, async (_event, payload) => {
    log({ level: 'debug', msg: 'IPC bondProspectusFinder:find', payload: safePreview(payload) });
    return resolver.resolveFind(payload);
  });
}

function safePreview(payload) {
  if (!payload || typeof payload !== 'object') return payload;
  const { isin, wkn, issuerName, bondName } = payload;
  return { isin, wkn, issuerName, bondName };
}

module.exports = { registerBondProspectusFinderIPC };
