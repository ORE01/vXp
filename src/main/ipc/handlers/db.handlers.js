'use strict';

module.exports = function registerDbHandlers({ ipcMain, refreshTable }) {
  if (!ipcMain) {
    throw new Error('[db.handlers] ipcMain missing');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[db.handlers] refreshTable missing');
  }

  const msg = 'Legacy DB IPC is disabled (migrated to modular handlers).';

  // Still disabled legacy invoke channels.
  ipcMain.handle('get-all-table-names', async () => {
    throw new Error(msg);
  });

  ipcMain.handle('run-sql', async () => {
    throw new Error(msg);
  });

  // Active read-model refresh channel.
  // Used by renderer fetch.js:
  // window.api.send('fetch-table-data', '<TableName>')
  ipcMain.on('fetch-table-data', (_event, tableName) => {
    const safeTableName = String(tableName || '').trim();

    if (!safeTableName) {
      console.warn('[DB HANDLER] fetch-table-data skipped: tableName missing');
      return;
    }

    console.log('[DB HANDLER] fetch-table-data', {
      tableName: safeTableName,
    });

    refreshTable(safeTableName);
  });

  // Optional stubs for older channels.
  ipcMain.on('update-record', (event) => {
    try {
      event.reply('update-record-response', {
        success: false,
        error: msg,
      });
    } catch {}
  });

  ipcMain.handle('erase-row', async () => {
    throw new Error(msg);
  });

  ipcMain.handle('get-all-rows', async () => {
    throw new Error(msg);
  });

  ipcMain.on('delete-table', (event) => {
    try {
      event.sender.send('delete-table-response', {
        success: false,
        message: msg,
      });
    } catch {}
  });
};