'use strict';

module.exports = function registerDbHandlers({ ipcMain }) {
  if (!ipcMain) throw new Error('[db.handlers] ipcMain missing');

  const msg = 'Legacy DB IPC is disabled (migrated to modular handlers).';

  // If something still calls these, fail loudly:
  ipcMain.handle('get-all-table-names', async () => {
    throw new Error(msg);
  });

  ipcMain.handle('run-sql', async () => {
    throw new Error(msg);
  });

  ipcMain.on('fetch-table-data', (event) => {
    try {
      event.sender.send('fetch-table-data-error', { success: false, error: msg });
    } catch {}
  });

  // Optional stubs for older channels (only if you suspect they might still exist)
  ipcMain.on('update-record', (event) => {
    try { event.reply('update-record-response', { success: false, error: msg }); } catch {}
  });

  ipcMain.handle('erase-row', async () => {
    throw new Error(msg);
  });

  ipcMain.handle('get-all-rows', async () => {
    throw new Error(msg);
  });

  ipcMain.on('delete-table', (event) => {
    try { event.sender.send('delete-table-response', { success: false, message: msg }); } catch {}
  });
};




