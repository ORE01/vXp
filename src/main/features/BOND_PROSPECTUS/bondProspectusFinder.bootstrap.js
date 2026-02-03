'use strict';

const { createBondProspectusFinderService } = require('./bondProspectusFinder.service.js');
const { createBondProspectusFinderResolver } = require('./bondProspectusFinder.resolver.js');
const { registerBondProspectusFinderIPC } = require('./bondProspectusFinder.ipc.js');

function bootstrapBondProspectusFinder(deps) {
  const log = deps && deps.log ? deps.log : (() => {});
  const service = createBondProspectusFinderService({ httpGet: deps.httpGet, log });
  const resolver = createBondProspectusFinderResolver({ service, log });

  registerBondProspectusFinderIPC({ ipcMain: deps.ipcMain, resolver, log });

  log({ level: 'info', msg: 'BondProspectusFinder bootstrapped' });
  return { service, resolver };
}

module.exports = { bootstrapBondProspectusFinder };

