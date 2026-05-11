'use strict';

const { getDb } = require('../../services/db.service');
const { logger } = require('../../utils/logger');

logger.debug('IPC', 'csScenario.handlers loaded');

module.exports = function registerCSScenarioHandlers({
  ipcMain,
  dbApi,
  refreshTable
}) {
  if (!ipcMain) {
    throw new Error('[csScenario.handlers] ipcMain missing');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[csScenario.handlers] refreshTable missing');
  }

  const db = getDb();

  logger.debug('IPC', 'registering cs:create-scenario');

  try {
    ipcMain.removeHandler('cs:create-scenario');
  } catch {}

  ipcMain.handle('cs:create-scenario', async (_event, payload) => {
    try {
      const scenario_id = String(payload?.scenario_id || payload?.scenario_name || '').trim();
      const ccy = String(payload?.ccy || 'EUR').trim().toUpperCase();
      const data = Array.isArray(payload?.data) ? payload.data : [];

      if (!scenario_id) {
        throw new Error('scenario_id missing');
      }

      if (!ccy) {
        throw new Error('ccy missing');
      }

      if (!data.length) {
        throw new Error('data missing');
      }

      const asof_date = new Date().toISOString().slice(0, 10);
      const run_id = `CS_${Date.now()}`;

      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          db.run(
            `
            DELETE FROM CS_SCENARIO_DATA
            WHERE scenario_id = ?
              AND ccy = ?
            `,
            [scenario_id, ccy]
          );

          const stmt = db.prepare(`
            INSERT INTO CS_SCENARIO_DATA
            (
              asof_date,
              run_id,
              scenario_id,
              ccy,
              rating,
              tenor,
              value,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, datetime('now'))
          `);

          for (const row of data) {
            const rating = String(row.RATING || '').trim();
            if (!rating) continue;

            Object.keys(row).forEach((key) => {
              if (key === 'RATING') return;

              const value = parseFloat(row[key]);

              stmt.run([
                asof_date,
                run_id,
                scenario_id,
                ccy,
                rating,
                key,
                isNaN(value) ? null : value
              ]);
            });
          }

          stmt.finalize((err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            db.run('COMMIT', (err2) => {
              if (err2) return reject(err2);
              resolve();
            });
          });
        });
      });

      await new Promise((resolve, reject) => {
        refreshTable('CS_SCENARIO_DATA', (err, rows) => {
          if (err) return reject(err);
          console.log('[CS_SCENARIO_DATA REFRESHED]', rows?.length || 0);
          resolve(rows || []);
        });
      });

      return {
        success: true,
        scenario_id,
        ccy
      };

    } catch (err) {
      console.error('[cs:create-scenario]', err);

      return {
        success: false,
        error: err.message
      };
    }
  });

  try {
  ipcMain.removeHandler('cs:delete-scenario');
} catch {}

  ipcMain.handle('cs:delete-scenario', async (_event, payload) => {
    try {
      const scenario_id = String(payload?.scenario_id || payload?.scenario_name || '').trim();
      const ccy = String(payload?.ccy || 'EUR').trim().toUpperCase();

      if (!scenario_id) {
        throw new Error('scenario_id missing');
      }

      if (!ccy) {
        throw new Error('ccy missing');
      }

      if (scenario_id === 'BASE') {
        throw new Error('BASE cannot be deleted');
      }

      await new Promise((resolve, reject) => {
        db.run(
          `
          DELETE FROM CS_SCENARIO_DATA
          WHERE scenario_id = ?
            AND ccy = ?
          `,
          [scenario_id, ccy],
          function (err) {
            if (err) return reject(err);
            resolve(this.changes || 0);
          }
        );
      });

      await new Promise((resolve, reject) => {
        refreshTable('CS_SCENARIO_DATA', (err, rows) => {
          if (err) return reject(err);
          console.log('[CS_SCENARIO_DATA REFRESHED AFTER DELETE]', rows?.length || 0);
          resolve(rows || []);
        });
      });

      return {
        success: true,
        scenario_id,
        ccy
      };

    } catch (err) {
      console.error('[cs:delete-scenario]', err);

      return {
        success: false,
        error: err.message
      };
    }
  });
};