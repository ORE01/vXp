'use strict';

const allowlist = require('../ipc.allowlist');

module.exports = function registerIpcMetaHandlers({ ipcMain }) {
  if (!ipcMain) throw new Error('[ipcMeta.handlers] ipcMain missing');

  ipcMain.handle('ipc:get-allowlist', async () => {
    // Return plain JSON (no functions)
    return JSON.parse(JSON.stringify(allowlist));
  });
};
