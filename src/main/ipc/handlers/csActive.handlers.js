'use strict';

module.exports = function registerCSActiveHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[csActive] ipcMain missing');

  if (
    !dbApi ||
    typeof dbApi.runSQL !== 'function' ||
    typeof dbApi.selectAll !== 'function'
  ) {
    throw new Error('[csActive] dbApi invalid');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[csActive] refreshTable missing');
  }

  try {
    ipcMain.removeHandler('cs:set-active-scenario');
  } catch {}

  ipcMain.handle('cs:set-active-scenario', async (_evt, payload) => {
    try {
      const scenario_id = String(payload?.scenario_id || payload?.scenario_name || 'BASE').trim();
      const ccy = String(payload?.ccy || 'EUR').trim().toUpperCase();

      if (!scenario_id) throw new Error('scenario_id missing');
      if (!ccy) throw new Error('ccy missing');

      const asof_date = new Date().toISOString().slice(0, 10);
      let active_run_id = 'BASE';

      if (scenario_id !== 'BASE') {
        const rows = await dbApi.selectAll(
          `
          SELECT run_id
          FROM CS_SCENARIO_DATA
          WHERE TRIM(scenario_id) = TRIM(?)
            AND UPPER(TRIM(ccy)) = UPPER(TRIM(?))
          ORDER BY created_at DESC, asof_date DESC, run_id DESC
          LIMIT 1
          `,
          [scenario_id, ccy]
        );

        const row = rows?.[0];

        if (!row?.run_id) {
          throw new Error(`No run_id found for ${scenario_id} / ${ccy}`);
        }

        active_run_id = row.run_id;
      }

      await dbApi.runSQL(
        `
        DELETE FROM CS_ACTIVE
        WHERE UPPER(TRIM(ccy)) = UPPER(TRIM(?))
        `,
        [ccy]
      );

      await dbApi.runSQL(
        `
        INSERT INTO CS_ACTIVE (
          asof_date,
          scenario_id,
          active_run_id,
          activated_at,
          ccy
        )
        VALUES (?, ?, ?, datetime('now'), ?)
        `,
        [asof_date, scenario_id, active_run_id, ccy]
      );

      await refreshTable('CS_ACTIVE');

      return {
        success: true,
        scenario_id,
        ccy,
        active_run_id
      };
    } catch (err) {
      console.error('[cs:set-active-scenario]', err);

      return {
        success: false,
        error: err.message
      };
    }
  });
};