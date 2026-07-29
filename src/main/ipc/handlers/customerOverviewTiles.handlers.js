// src/main/ipc/handlers/customerOverviewTiles.handlers.js
'use strict';

// CUSTOMER SETUP -> Portfolio -> Overview Tiles.
// WRITE handler for CustomerOverviewTileSetting: which tiles the Overview
// "Portfolio" card shows. One row per tile_key (is_visible 0/1). The table is
// created on demand (no db.schema.js change). After a write, refreshTable
// re-pushes it through the normal DataPump READ flow.

const TBL = 'CustomerOverviewTileSetting';

module.exports = function registerCustomerOverviewTilesHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[customerOverviewTiles.handlers] ipcMain missing');
  if (!dbApi || typeof dbApi.runSQL !== 'function' || typeof dbApi.getAllRowsFromTable !== 'function') {
    throw new Error('[customerOverviewTiles.handlers] dbApi invalid');
  }
  if (typeof refreshTable !== 'function') {
    throw new Error('[customerOverviewTiles.handlers] refreshTable missing');
  }

  async function ensureTable() {
    await dbApi.runSQL(
      `CREATE TABLE IF NOT EXISTS ${TBL} (
        id         INTEGER PRIMARY KEY AUTOINCREMENT,
        tile_key   TEXT NOT NULL,
        is_visible INTEGER NOT NULL DEFAULT 1,
        value_mode TEXT NOT NULL DEFAULT 'abs',
        updated_at TEXT
      )`,
      []
    );
    // Migration fuer bereits bestehende Tabellen ohne value_mode-Spalte.
    try {
      await dbApi.runSQL(`ALTER TABLE ${TBL} ADD COLUMN value_mode TEXT NOT NULL DEFAULT 'abs'`, []);
    } catch (e) { /* Spalte existiert bereits – ok */ }
  }

  try { ipcMain.removeHandler('customer-overview-tiles.save'); } catch {}

  ipcMain.handle('customer-overview-tiles.save', async (_event, payload = {}) => {
    try {
      await ensureTable();

      const tiles = Array.isArray(payload.tiles) ? payload.tiles : [];
      const existing = await dbApi.getAllRowsFromTable(TBL);
      const byKey = new Map(
        (Array.isArray(existing) ? existing : []).map((r) => [String(r.tile_key), r])
      );

      for (const t of tiles) {
        const key = String(t.tile_key || '').trim();
        if (!key) continue;
        const vis = Number(t.is_visible) ? 1 : 0;
        const mode = String(t.value_mode || 'abs').toLowerCase() === 'rel' ? 'rel' : 'abs';
        const row = byKey.get(key);

        if (row) {
          await dbApi.runSQL(
            `UPDATE ${TBL} SET is_visible = ?, value_mode = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [vis, mode, row.id]
          );
        } else {
          await dbApi.runSQL(
            `INSERT INTO ${TBL} (tile_key, is_visible, value_mode, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [key, vis, mode]
          );
        }
      }

      console.log('[customerOverviewTiles] saved', tiles);

      // Re-push through the normal READ flow (DataPump -> installReceivers -> ...).
      refreshTable(TBL);

      return { success: true };
    } catch (err) {
      console.error('[customerOverviewTiles] save error:', err);
      return { success: false, error: err.message };
    }
  });
};
