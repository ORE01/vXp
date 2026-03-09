'use strict';

module.exports = function registerRatesActiveHandlers({ ipcMain, dbApi, refreshTable }) {

  if (!ipcMain) throw new Error('[ratesActive] ipcMain missing');

  if (!dbApi || typeof dbApi.runSQL !== 'function' || typeof dbApi.selectAll !== 'function') {
    throw new Error('[ratesActive] dbApi invalid');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[ratesActive] refreshTable missing');
  }

  // ============================================================
  // 1️⃣ SET ACTIVE SCENARIO (UPSERT per curve)
  // ============================================================
  ipcMain.handle('rates:set-active-scenario', async (_evt, payload) => {

    try {

      const {
        asof_date,
        scenario_id,
        ccy,
        curve_id,
        active_run_id
      } = payload || {};

      if (!asof_date || !scenario_id || !ccy || !curve_id || !active_run_id) {
        throw new Error('missing fields');
      }

      const sql = `
        INSERT INTO RATES_ACTIVE
        (asof_date, scenario_id, ccy, curve_id, active_run_id)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(asof_date, ccy, curve_id)
        DO UPDATE SET
          scenario_id = excluded.scenario_id,
          active_run_id = excluded.active_run_id,
          activated_at = datetime('now')
      `;

      await dbApi.runSQL(sql, [
        asof_date,
        scenario_id,
        ccy,
        curve_id,
        active_run_id
      ]);

      console.log('[ratesActive] scenario updated', {
        asof_date,
        ccy,
        curve_id,
        scenario_id
      });

      // 🔥 WICHTIG: Renderer aktualisieren
      refreshTable('RATES_ACTIVE');

      return { success: true };

    } catch (err) {

      console.error('[ratesActive] set-active error:', err);

      return {
        success: false,
        error: err.message
      };
    }

  });


  // ============================================================
  // 2️⃣ GET ACTIVE CURVE
  // ============================================================
  ipcMain.handle('rates:get-active-curve', async (_evt, payload) => {

    try {

      const { asof_date, ccy, curve_id } = payload || {};

      if (!asof_date || !ccy || !curve_id) {
        throw new Error('missing fields');
      }

      // --------------------------------------------------------
      // Determine active scenario
      // --------------------------------------------------------
      const activeRows = await dbApi.selectAll(`
        SELECT scenario_id
        FROM RATES_ACTIVE
        WHERE asof_date = ?
          AND ccy = ?
          AND curve_id = ?
        LIMIT 1
      `, [asof_date, ccy, curve_id]);

      let scenario_id = 'BASE';

      if (activeRows.length > 0 && activeRows[0].scenario_id) {
        scenario_id = activeRows[0].scenario_id;
      }

      // --------------------------------------------------------
      // Fetch snapshot rows
      // --------------------------------------------------------
      const snapshotRows = await dbApi.selectAll(`
        SELECT *
        FROM RATES_SNAPSHOTS
        WHERE asof_date = ?
          AND scenario_id = ?
          AND ccy = ?
          AND curve_id = ?
        ORDER BY tenor
      `, [asof_date, scenario_id, ccy, curve_id]);

      if (!snapshotRows || snapshotRows.length === 0) {
        throw new Error(`no snapshot found for ${scenario_id}`);
      }

      return {
        success: true,
        scenario_id,
        rows: snapshotRows
      };

    } catch (err) {

      console.error('[ratesActive] get-active-curve error:', err);

      return {
        success: false,
        error: err.message
      };
    }

  });

};