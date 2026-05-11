// src/main/ipc/handlers/tableLayout.handlers.js
'use strict';

const TBL_CUSTOMER_TABLE_LAYOUTS = 'CustomerTableLayouts';

module.exports = function registerTableLayoutHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[tableLayout.handlers] ipcMain missing');

  if (!dbApi || typeof dbApi.runSQL !== 'function') {
    throw new Error('[tableLayout.handlers] dbApi invalid');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[tableLayout.handlers] refreshTable missing');
  }

  try {
    ipcMain.removeHandler('table-layout:save-one');
  } catch {}

  ipcMain.handle('table-layout:save-one', async (_event, tableId, layoutName, layout) => {

    console.log('[tableLayout] save-one received', {
      tableId,
      layoutName,
      layout,
    });

    try {
      if (!tableId) throw new Error('tableId missing');
      if (!layoutName) throw new Error('layoutName missing');
      if (!layout || typeof layout !== 'object') throw new Error('layout missing/invalid');

      const sql = `
        INSERT INTO ${TBL_CUSTOMER_TABLE_LAYOUTS}
          (table_id, layout_name, layout_json, updated_at)
        VALUES
          (?, ?, ?, datetime('now'))
        ON CONFLICT(table_id, layout_name)
        DO UPDATE SET
          layout_json = excluded.layout_json,
          updated_at = datetime('now')
      `;

      await dbApi.runSQL(sql, [
        tableId,
        layoutName,
        JSON.stringify(layout),
      ]);

      console.log('[tableLayout] save-one DB write ok');

      refreshTable(TBL_CUSTOMER_TABLE_LAYOUTS);

      return { success: true };
    } catch (err) {
      console.error('[tableLayout] save-one error:', err);
      return { success: false, error: err.message };
    }
  });
};