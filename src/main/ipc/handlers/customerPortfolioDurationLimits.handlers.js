// src/main/ipc/handlers/customerPortfolioDurationLimits.handlers.js
'use strict';

// CUSTOMER SETUP -> Portfolio -> Duration Limits.
// WRITE handler for CustomerPortfolioDurationLimit: yellow/red warning limits (in
// years) for the Overview interest-rate / credit-spread duration sliders. One row
// per metric_code (ir_duration | cs_duration). Single set (no profile). The table
// is created on demand (no db.schema.js change). After a write, refreshTable
// re-pushes it through the normal DataPump READ flow.

const TBL = 'CustomerPortfolioDurationLimit';

module.exports = function registerCustomerPortfolioDurationLimitsHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[customerPortfolioDurationLimits.handlers] ipcMain missing');
  if (!dbApi || typeof dbApi.runSQL !== 'function' || typeof dbApi.getAllRowsFromTable !== 'function') {
    throw new Error('[customerPortfolioDurationLimits.handlers] dbApi invalid');
  }
  if (typeof refreshTable !== 'function') {
    throw new Error('[customerPortfolioDurationLimits.handlers] refreshTable missing');
  }

  async function ensureTable() {
    await dbApi.runSQL(
      `CREATE TABLE IF NOT EXISTS ${TBL} (
        id           INTEGER PRIMARY KEY AUTOINCREMENT,
        metric_code  TEXT NOT NULL,
        yellow_limit REAL,
        red_limit    REAL,
        updated_at   TEXT
      )`,
      []
    );
  }

  try { ipcMain.removeHandler('customer-portfolio-limits.save'); } catch {}

  ipcMain.handle('customer-portfolio-limits.save', async (_event, payload = {}) => {
    try {
      await ensureTable();

      const limits = Array.isArray(payload.limits) ? payload.limits : [];
      const existing = await dbApi.getAllRowsFromTable(TBL);
      const byMetric = new Map(
        (Array.isArray(existing) ? existing : []).map((r) => [String(r.metric_code), r])
      );

      for (const l of limits) {
        const code = String(l.metric_code || '').trim();
        if (!code) continue;
        const yellow = Number.isFinite(Number(l.yellow_limit)) ? Number(l.yellow_limit) : null;
        const red = Number.isFinite(Number(l.red_limit)) ? Number(l.red_limit) : null;
        const row = byMetric.get(code);

        if (row) {
          await dbApi.runSQL(
            `UPDATE ${TBL} SET yellow_limit = ?, red_limit = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?`,
            [yellow, red, row.id]
          );
        } else {
          await dbApi.runSQL(
            `INSERT INTO ${TBL} (metric_code, yellow_limit, red_limit, updated_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)`,
            [code, yellow, red]
          );
        }
      }

      console.log('[customerPortfolioDurationLimits] saved', limits);

      // Re-push through the normal READ flow (DataPump -> installReceivers -> ...).
      refreshTable(TBL);

      return { success: true };
    } catch (err) {
      console.error('[customerPortfolioDurationLimits] save error:', err);
      return { success: false, error: err.message };
    }
  });
};
