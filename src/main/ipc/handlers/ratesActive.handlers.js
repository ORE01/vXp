'use strict';

const TBL_RATES_BASE = 'RATES_BASE';
const TBL_RATES_SCENARIO_DATA = 'RATES_SCENARIO_DATA';
const TBL_RATES_ACTIVE = 'RATES_ACTIVE';

module.exports = function registerRatesActiveHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[ratesActive] ipcMain missing');

  if (!dbApi || typeof dbApi.runSQL !== 'function' || typeof dbApi.selectAll !== 'function') {
    throw new Error('[ratesActive] dbApi invalid');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[ratesActive] refreshTable missing');
  }

  ipcMain.handle('rates:set-active-scenario', async (_evt, payload) => {
    try {
      const { scenario_id, ccy, curve_id, active_run_id } = payload || {};
      let { asof_date } = payload || {};

      if (!scenario_id || !ccy || !curve_id || !active_run_id) {
        throw new Error('missing fields');
      }

      // BASE lives in RATES_BASE, scenario rows live in RATES_SCENARIO_DATA
      if (!asof_date) asof_date = new Date().toISOString().slice(0, 10);

      const sql = `
        INSERT INTO ${TBL_RATES_ACTIVE}
          (asof_date, scenario_id, ccy, curve_id, active_run_id, activated_at)
        VALUES
          (?, ?, ?, ?, ?, datetime('now'))
        ON CONFLICT(ccy, curve_id)
        DO UPDATE SET
          asof_date = excluded.asof_date,
          scenario_id = excluded.scenario_id,
          active_run_id = excluded.active_run_id,
          activated_at = datetime('now')
      `;

      await dbApi.runSQL(sql, [asof_date, scenario_id, ccy, curve_id, active_run_id]);

      refreshTable(TBL_RATES_ACTIVE);
      refreshTable('RATES');

      return { success: true };

    } catch (err) {
      console.error('[ratesActive] set-active error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('rates:get-active-curve', async (_evt, payload) => {
    try {
      const { ccy, curve_id } = payload || {};
      if (!ccy || !curve_id) throw new Error('missing fields');

      const activeRows = await dbApi.selectAll(`
        SELECT *
        FROM ${TBL_RATES_ACTIVE}
        WHERE ccy = ?
          AND curve_id = ?
        LIMIT 1
      `, [ccy, curve_id]);

      const active = activeRows?.[0] || null;
      const scenario_id = active?.scenario_id || 'BASE';
      const active_run_id = active?.active_run_id || 'BASE';

      let rows = [];

      if (scenario_id === 'BASE') {
        rows = await dbApi.selectAll(`
          SELECT
            date('now') AS asof_date,
            'BASE' AS run_id,
            'BASE' AS scenario_id,
            ccy,
            curve_id,
            instrument,
            tenor,
            value,
            source_table,
            source_col,
            updated_at
          FROM ${TBL_RATES_BASE}
          WHERE ccy = ?
            AND curve_id = ?
          ORDER BY 
            CASE 
              WHEN tenor LIKE '%Y' THEN CAST(REPLACE(tenor,'Y','') AS INTEGER) * 12
              WHEN tenor LIKE '%M' THEN CAST(REPLACE(tenor,'M','') AS INTEGER)
              ELSE 0
            END
        `, [ccy, curve_id]);
      } else {
        rows = await dbApi.selectAll(`
          SELECT *
          FROM ${TBL_RATES_SCENARIO_DATA}
          WHERE scenario_id = ?
            AND ccy = ?
            AND curve_id = ?
            AND run_id = ?
          ORDER BY 
            CASE 
              WHEN tenor LIKE '%Y' THEN CAST(REPLACE(tenor,'Y','') AS INTEGER) * 12
              WHEN tenor LIKE '%M' THEN CAST(REPLACE(tenor,'M','') AS INTEGER)
              ELSE 0
            END
        `, [scenario_id, ccy, curve_id, active_run_id]);
      }

      if (!rows || rows.length === 0) {
        throw new Error(`no curve found for ${ccy} ${curve_id} ${scenario_id}`);
      }

      return { success: true, scenario_id, active_run_id, rows };

    } catch (err) {
      console.error('[ratesActive] get-active-curve error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('rates:create-scenario', async (_evt, payload) => {
    try {
      const { ccy, curve_id, scenario_id, data } = payload || {};

      if (!ccy || !curve_id || !scenario_id || !Array.isArray(data)) {
        throw new Error('missing fields');
      }

      if (scenario_id === 'BASE') {
        throw new Error(`BASE scenario must not be written to ${TBL_RATES_SCENARIO_DATA}`);
      }

      const asof_date = new Date().toISOString().slice(0, 10);
      const run_id = Date.now().toString();

      await dbApi.runSQL(`
        DELETE FROM ${TBL_RATES_SCENARIO_DATA}
        WHERE ccy = ?
          AND curve_id = ?
          AND scenario_id = ?
      `, [ccy, curve_id, scenario_id]);

      for (const point of data) {
        const { tenor, value } = point;

        await dbApi.runSQL(`
          INSERT INTO ${TBL_RATES_SCENARIO_DATA}
            (asof_date, run_id, scenario_id, ccy, curve_id, instrument, tenor, value)
          VALUES
            (?, ?, ?, ?, ?, ?, ?, ?)
        `, [
          asof_date,
          run_id,
          scenario_id,
          ccy,
          curve_id,
          point.instrument || 'SWAP',
          tenor,
          value
        ]);
      }

      refreshTable(TBL_RATES_SCENARIO_DATA);

      return { success: true, asof_date, run_id };

    } catch (err) {
      console.error('[rates] create-scenario error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('rates:get-base-curve', async (_evt, payload) => {
    try {
      const { ccy, curve_id } = payload || {};
      if (!ccy || !curve_id) throw new Error('missing fields');

      const rows = await dbApi.selectAll(`
        SELECT
          date('now') AS asof_date,
          'BASE' AS run_id,
          'BASE' AS scenario_id,
          ccy,
          curve_id,
          instrument,
          tenor,
          value,
          source_table,
          source_col,
          updated_at
        FROM ${TBL_RATES_BASE}
        WHERE ccy = ?
          AND curve_id = ?
        ORDER BY 
          CASE 
            WHEN tenor LIKE '%Y' THEN CAST(REPLACE(tenor,'Y','') AS INTEGER) * 12
            WHEN tenor LIKE '%M' THEN CAST(REPLACE(tenor,'M','') AS INTEGER)
            ELSE 0
          END
      `, [ccy, curve_id]);

      if (!rows.length) throw new Error(`no BASE curve found in ${TBL_RATES_BASE}`);

      return {
        success: true,
        asof_date: new Date().toISOString().slice(0, 10),
        rows
      };

    } catch (err) {
      console.error('[rates] get-base-curve error:', err);
      return { success: false, error: err.message };
    }
  });

  ipcMain.handle('rates:get-available-curves', async () => {
    try {
      return await dbApi.selectAll(`
        SELECT DISTINCT ccy, curve_id
        FROM ${TBL_RATES_BASE}
        ORDER BY ccy, curve_id
      `);
    } catch (err) {
      console.error('[rates] get-available-curves error:', err);
      return [];
    }
  });

  ipcMain.handle('rates:get-scenarios', async (_evt, payload) => {
    try {
      const { ccy, curve_id } = payload || {};
      if (!ccy || !curve_id) throw new Error('missing fields');

      const rows = await dbApi.selectAll(`
        SELECT DISTINCT scenario_id
        FROM ${TBL_RATES_SCENARIO_DATA}
        WHERE ccy = ?
          AND curve_id = ?
          AND scenario_id != 'BASE'
        ORDER BY scenario_id
      `, [ccy, curve_id]);

      return rows.map(r => r.scenario_id);

    } catch (err) {
      console.error('[rates] get-scenarios error:', err);
      return [];
    }
  });

  ipcMain.handle('rates:get-scenario', async (_evt, payload) => {
    try {
      const { ccy, curve_id, scenario_id } = payload || {};
      if (!ccy || !curve_id || !scenario_id) throw new Error('missing fields');

      if (scenario_id === 'BASE') {
        const baseRows = await dbApi.selectAll(`
          SELECT
            date('now') AS asof_date,
            'BASE' AS run_id,
            'BASE' AS scenario_id,
            ccy,
            curve_id,
            instrument,
            tenor,
            value,
            source_table,
            source_col,
            updated_at
          FROM ${TBL_RATES_BASE}
          WHERE ccy = ?
            AND curve_id = ?
          ORDER BY 
            CASE 
              WHEN tenor LIKE '%Y' THEN CAST(REPLACE(tenor,'Y','') AS INTEGER) * 12
              WHEN tenor LIKE '%M' THEN CAST(REPLACE(tenor,'M','') AS INTEGER)
              ELSE 0
            END
        `, [ccy, curve_id]);

        return { success: true, rows: baseRows };
      }

      const latestRows = await dbApi.selectAll(`
        SELECT asof_date, run_id
        FROM ${TBL_RATES_SCENARIO_DATA}
        WHERE ccy = ?
          AND curve_id = ?
          AND scenario_id = ?
        ORDER BY asof_date DESC, run_id DESC
        LIMIT 1
      `, [ccy, curve_id, scenario_id]);

      if (!latestRows.length) throw new Error('no scenario found');

      const { asof_date, run_id } = latestRows[0];

      const scenarioRows = await dbApi.selectAll(`
        SELECT *
        FROM ${TBL_RATES_SCENARIO_DATA}
        WHERE asof_date = ?
          AND run_id = ?
          AND scenario_id = ?
          AND ccy = ?
          AND curve_id = ?
        ORDER BY 
          CASE 
            WHEN tenor LIKE '%Y' THEN CAST(REPLACE(tenor,'Y','') AS INTEGER) * 12
            WHEN tenor LIKE '%M' THEN CAST(REPLACE(tenor,'M','') AS INTEGER)
            ELSE 0
          END
      `, [asof_date, run_id, scenario_id, ccy, curve_id]);

      return { success: true, asof_date, run_id, rows: scenarioRows };

    } catch (err) {
      console.error('[rates] get-scenario error:', err);
      return { success: false, error: err.message };
    }
  });
};