// src/main/ipc/handlers/customer.handlers.js
'use strict';

/**
 * Customer / TS / CustomerReports handlers (ex-index.js)
 * - update-customer-texts
 * - ts-selection:save / ts-selection:load
 * - ts-trendlines:save / ts-trendlines:load
 * - customerReports:save/load/list/delete
 *
 * No new tables. No channel renames. Only moved + DI.
 */
module.exports = function registerCustomerHandlers({
  ipcMain,
  sqliteDb,
  dbApi,            // { runSQL, updateCustomerTexts }
  refreshTable,      // function(tableName, cb?)
  emitToRenderer,    // function(channel, payload) -> mainWindow.webContents.send(...)
}) {
  if (!ipcMain) throw new Error('[customer.handlers] ipcMain missing');
  if (!sqliteDb) throw new Error('[customer.handlers] sqliteDb missing');
  if (!dbApi) throw new Error('[customer.handlers] dbApi missing');
  if (typeof refreshTable !== 'function') throw new Error('[customer.handlers] refreshTable missing');
  if (typeof emitToRenderer !== 'function') throw new Error('[customer.handlers] emitToRenderer missing');

  const { runSQL, updateCustomerTexts } = dbApi;

  if (typeof runSQL !== 'function') throw new Error('[customer.handlers] dbApi.runSQL missing');
  if (typeof updateCustomerTexts !== 'function') throw new Error('[customer.handlers] dbApi.updateCustomerTexts missing');

  // ---------------------------
  // Airbags (avoid double reg)
  // ---------------------------
  try { ipcMain.removeAllListeners('update-customer-texts'); } catch {}

  try { ipcMain.removeAllListeners('ts-selection:save'); } catch {}
  try { ipcMain.removeAllListeners('ts-selection:load'); } catch {}
  try { ipcMain.removeAllListeners('ts-trendlines:save'); } catch {}
  try { ipcMain.removeAllListeners('ts-trendlines:load'); } catch {}

  try { ipcMain.removeAllListeners('customerReports:save'); } catch {}
  try { ipcMain.removeAllListeners('customerReports:load'); } catch {}
  try { ipcMain.removeAllListeners('customerReports:list'); } catch {}
  try { ipcMain.removeAllListeners('customerReports:delete'); } catch {}

  // ============================================================
  // CUSTOMER TEXTS
  // ============================================================
  ipcMain.on('update-customer-texts', async (event, payload = {}) => {
    const { customer_id } = payload;

    const hasHeader = Object.prototype.hasOwnProperty.call(payload, 'pdf_header');
    const hasFooter = Object.prototype.hasOwnProperty.call(payload, 'pdf_footer');

    const pdf_header = hasHeader ? payload.pdf_header : undefined;
    const pdf_footer = hasFooter ? payload.pdf_footer : undefined;

    try {
      await updateCustomerTexts(sqliteDb, customer_id, pdf_header, pdf_footer);

      refreshTable('Customer', () => {
        event.reply('update-customer-texts-success');
      });
    } catch (err) {
      event.reply('update-customer-texts-error', err?.message || String(err));
    }
  });

  // ============================================================
  // TS_SELECTION (Indices + Settings)
  // ============================================================

  // SAVE
  ipcMain.on('ts-selection:save', async (event, payload = {}) => {
    const {
      requestId, customer_id, ts_modal_index, ts_key = 'ts_selected',
      indices = [],
      normalization_type = 'none',
      show_daily_volatility = 0,
      apply_sma1 = 0, sma1_period = 20,
      apply_sma2 = 0, sma2_period = 50,
      apply_sma3 = 0, sma3_period = 200,
    } = payload;

    const okCh  = `ts-selection:save-success:${requestId}`;
    const errCh = `ts-selection:save-error:${requestId}`;

    try {
      if (!customer_id || !Number.isInteger(ts_modal_index)) {
        throw new Error('customer_id oder ts_modal_index fehlt/ungültig');
      }

      const ts_selection = JSON.stringify(Array.isArray(indices) ? indices : []);

      const existing = await new Promise((resolve, reject) => {
        sqliteDb.get(
          `SELECT id FROM CustomerTSSelection
           WHERE customer_id=? AND ts_modal_index=? AND ts_key=?`,
          [customer_id, ts_modal_index, ts_key],
          (e, row) => e ? reject(e) : resolve(row)
        );
      });

      const params = [
        ts_selection, normalization_type,
        Number(!!show_daily_volatility),
        Number(!!apply_sma1), Number(sma1_period || 20),
        Number(!!apply_sma2), Number(sma2_period || 50),
        Number(!!apply_sma3), Number(sma3_period || 200),
      ];

      if (existing?.id) {
        await runSQL(
          `UPDATE CustomerTSSelection
           SET ts_selection=?,
               normalization_type=?,
               show_daily_volatility=?,
               apply_sma1=?, sma1_period=?,
               apply_sma2=?, sma2_period=?,
               apply_sma3=?, sma3_period=?,
               updated_at=datetime('now')
           WHERE id=?`,
          [...params, existing.id]
        );
      } else {
        await runSQL(
          `INSERT INTO CustomerTSSelection
           (customer_id, ts_modal_index, ts_key, ts_selection,
            normalization_type, show_daily_volatility,
            apply_sma1, sma1_period, apply_sma2, sma2_period, apply_sma3, sma3_period,
            updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))`,
          [customer_id, ts_modal_index, ts_key, ...params]
        );
      }

      event.reply(okCh);
    } catch (err) {
      event.reply(errCh, err?.message || String(err));
    }
  });

  // LOAD
  ipcMain.on('ts-selection:load', async (event, query = {}) => {
    const { requestId, customer_id, ts_modal_index, ts_key = 'ts_selected' } = query;

    const okCh  = `ts-selection:load-success:${requestId}`;
    const errCh = `ts-selection:load-error:${requestId}`;

    try {
      if (!customer_id || !Number.isInteger(ts_modal_index)) {
        throw new Error('customer_id oder ts_modal_index fehlt/ungültig');
      }

      const row = await new Promise((resolve, reject) => {
        sqliteDb.get(
          `SELECT ts_selection, normalization_type, show_daily_volatility,
                  apply_sma1, sma1_period, apply_sma2, sma2_period, apply_sma3, sma3_period
           FROM CustomerTSSelection
           WHERE customer_id=? AND ts_modal_index=? AND ts_key=?`,
          [customer_id, ts_modal_index, ts_key],
          (e, r) => e ? reject(e) : resolve(r)
        );
      });

      let indices = [];
      if (row?.ts_selection) {
        try {
          const parsed = JSON.parse(row.ts_selection);
          if (Array.isArray(parsed)) indices = parsed.filter(n => Number.isInteger(n));
        } catch {}
      }

      event.reply(okCh, {
        indices,
        normalization_type: row?.normalization_type ?? 'none',
        show_daily_volatility: row?.show_daily_volatility ?? 0,
        apply_sma1: row?.apply_sma1 ?? 0, sma1_period: row?.sma1_period ?? 20,
        apply_sma2: row?.apply_sma2 ?? 0, sma2_period: row?.sma2_period ?? 50,
        apply_sma3: row?.apply_sma3 ?? 0, sma3_period: row?.sma3_period ?? 200,
      });
    } catch (err) {
      event.reply(errCh, err?.message || String(err));
    }
  });

  // ============================================================
  // TS_TRENDLINES
  // ============================================================

  // SAVE
  ipcMain.on('ts-trendlines:save', async (event, payload = {}) => {
    const {
      requestId,
      customer_id,
      modal_index,     // important: modal_index (not ts_modal_index)
      chart_name,
      lines = [],
    } = payload;

    const okCh  = `ts-trendlines:save-success:${requestId}`;
    const errCh = `ts-trendlines:save-error:${requestId}`;

    try {
      if (!customer_id || !Number.isInteger(modal_index) || !chart_name) {
        throw new Error('customer_id, modal_index oder chart_name fehlt/ungültig');
      }

      const lines_json = JSON.stringify(Array.isArray(lines) ? lines : []);

      const existing = await new Promise((resolve, reject) => {
        sqliteDb.get(
          `SELECT id
             FROM CustomerTSTrendLines
            WHERE customer_id = ? AND modal_index = ? AND chart_name = ?`,
          [customer_id, modal_index, chart_name],
          (e, row) => e ? reject(e) : resolve(row)
        );
      });

      if (existing?.id) {
        await runSQL(
          `UPDATE CustomerTSTrendLines
              SET lines_json = ?,
                  updated_at = datetime('now')
            WHERE id = ?`,
          [lines_json, existing.id]
        );
      } else {
        await runSQL(
          `INSERT INTO CustomerTSTrendLines
             (customer_id, modal_index, chart_name, lines_json, updated_at)
           VALUES (?, ?, ?, ?, datetime('now'))`,
          [customer_id, modal_index, chart_name, lines_json]
        );
      }

      event.reply(okCh);
    } catch (err) {
      event.reply(errCh, err?.message || String(err));
    }
  });

  // LOAD
  ipcMain.on('ts-trendlines:load', async (event, query = {}) => {
    const { requestId, customer_id, modal_index, chart_name } = query;

    const okCh  = `ts-trendlines:load-success:${requestId}`;
    const errCh = `ts-trendlines:load-error:${requestId}`;

    try {
      if (!customer_id || !Number.isInteger(modal_index) || !chart_name) {
        throw new Error('customer_id, modal_index oder chart_name fehlt/ungültig');
      }

      const row = await new Promise((resolve, reject) => {
        sqliteDb.get(
          `SELECT id, lines_json
             FROM CustomerTSTrendLines
            WHERE customer_id = ? AND modal_index = ? AND chart_name = ?`,
          [customer_id, modal_index, chart_name],
          (e, r) => e ? reject(e) : resolve(r)
        );
      });

      let lines = [];
      if (row?.lines_json) {
        try {
          const parsed = JSON.parse(row.lines_json);
          if (Array.isArray(parsed)) lines = parsed;
        } catch {}
      }

      event.reply(okCh, { lines });
    } catch (err) {
      event.reply(errCh, err?.message || String(err));
    }
  });

  // ============================================================
  // CUSTOMER REPORTS (Presets)
  // ============================================================

  ipcMain.on('customerReports:save', async (event, payload = {}) => {
    const { requestId, name, report_type = 'risk', state = null, state_json = null } = payload;

    const okCh  = `customerReports:save-success:${requestId}`;
    const errCh = `customerReports:save-error:${requestId}`;

    try {
      const presetName = String(name || '').trim();
      if (!presetName) throw new Error('name fehlt/ungültig');

      const json = typeof state_json === 'string'
        ? state_json
        : JSON.stringify(state || {});

      const existing = await new Promise((resolve, reject) => {
        sqliteDb.get(
          `SELECT id FROM CustomerReports WHERE name=?`,
          [presetName],
          (e, row) => e ? reject(e) : resolve(row)
        );
      });

      if (existing?.id) {
        await runSQL(
          `UPDATE CustomerReports
           SET report_type=?, state_json=?, updated_at=datetime('now')
           WHERE id=?`,
          [String(report_type || 'risk'), json, existing.id]
        );
      } else {
        await runSQL(
          `INSERT INTO CustomerReports (name, report_type, state_json, created_at, updated_at)
           VALUES (?, ?, ?, datetime('now'), datetime('now'))`,
          [presetName, String(report_type || 'risk'), json]
        );
      }

      // UI Refresh: send list for this report_type
      sqliteDb.all(
        `SELECT id, name, report_type, state_json, created_at, updated_at
         FROM CustomerReports
         WHERE report_type=?
         ORDER BY name COLLATE NOCASE`,
        [String(report_type || 'risk')],
        (e, rows) => {
          if (e) console.warn('[CR] refresh after save failed:', e.message);
          emitToRenderer('CustomerReportsData', rows || []);
          event.reply(okCh);
        }
      );
    } catch (err) {
      event.reply(errCh, err?.message || String(err));
    }
  });

  ipcMain.on('customerReports:load', async (event, query = {}) => {
    const { requestId, name } = query;

    const okCh  = `customerReports:load-success:${requestId}`;
    const errCh = `customerReports:load-error:${requestId}`;

    try {
      const presetName = String(name || '').trim();
      if (!presetName) throw new Error('name fehlt/ungültig');

      const row = await new Promise((resolve, reject) => {
        sqliteDb.get(
          `SELECT id, name, report_type, state_json, created_at, updated_at
           FROM CustomerReports
           WHERE name=?`,
          [presetName],
          (e, r) => e ? reject(e) : resolve(r)
        );
      });

      if (!row) throw new Error('Preset nicht gefunden');
      event.reply(okCh, row);
    } catch (err) {
      event.reply(errCh, err?.message || String(err));
    }
  });

  ipcMain.on('customerReports:list', async (event, query = {}) => {
    const { requestId, report_type = 'risk' } = query;

    const okCh  = `customerReports:list-success:${requestId}`;
    const errCh = `customerReports:list-error:${requestId}`;

    try {
      const rows = await new Promise((resolve, reject) => {
        sqliteDb.all(
          `SELECT id, name, report_type, created_at, updated_at
           FROM CustomerReports
           WHERE report_type=?
           ORDER BY name COLLATE NOCASE`,
          [String(report_type || 'risk')],
          (e, r) => e ? reject(e) : resolve(r)
        );
      });

      event.reply(okCh, rows || []);
    } catch (err) {
      event.reply(errCh, err?.message || String(err));
    }
  });

  ipcMain.on('customerReports:delete', async (event, payload = {}) => {
    const { requestId, name } = payload;

    const okCh  = `customerReports:delete-success:${requestId}`;
    const errCh = `customerReports:delete-error:${requestId}`;

    try {
      const presetName = String(name || '').trim();
      if (!presetName) throw new Error('name fehlt/ungültig');

      await runSQL(`DELETE FROM CustomerReports WHERE name=?`, [presetName]);
      event.reply(okCh);
    } catch (err) {
      event.reply(errCh, err?.message || String(err));
    }
  });
};
