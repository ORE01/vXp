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
      const scenario_name = String(payload?.scenario_name || '').trim();
      const data = Array.isArray(payload?.data) ? payload.data : [];

      if (!scenario_name) {
        throw new Error('scenario_name missing');
      }

      if (!data.length) {
        throw new Error('data missing');
      }

      const asof_date = new Date().toISOString().slice(0, 10);
      const run_id = `CS_${Date.now()}`;
      const ccy = 'EUR';

      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          db.run(
            `
            DELETE FROM CS_SNAPSHOTS
            WHERE scenario_id = ?
              AND ccy = ?
            `,
            [scenario_name, ccy]
          );

          const stmt = db.prepare(`
            INSERT INTO CS_SNAPSHOTS
            (
              asof_date,
              run_id,
              scenario_id,
              ccy,
              rating,
              tenor,
              value
            )
            VALUES (?, ?, ?, ?, ?, ?, ?)
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
                scenario_name,
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
        refreshTable('CS_SNAPSHOTS', (err, rows) => {
          if (err) return reject(err);
          console.log('[CS_SNAPSHOTS REFRESHED]', rows?.length || 0);
          resolve(rows || []);
        });
      });

      return {
        success: true,
        scenario_name
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
    const scenario_name = String(payload?.scenario_name || '').trim();
    const ccy = 'EUR';

    if (!scenario_name) {
      throw new Error('scenario_name missing');
    }

    if (scenario_name === 'BASE') {
      throw new Error('BASE cannot be deleted');
    }

    await new Promise((resolve, reject) => {
      db.run(
        `
        DELETE FROM CS_SNAPSHOTS
        WHERE scenario_id = ?
          AND ccy = ?
        `,
        [scenario_name, ccy],
        function (err) {
          if (err) return reject(err);
          resolve(this.changes || 0);
        }
      );
    });

    await new Promise((resolve, reject) => {
      refreshTable('CS_SNAPSHOTS', (err, rows) => {
        if (err) return reject(err);
        console.log('[CS_SNAPSHOTS REFRESHED AFTER DELETE]', rows?.length || 0);
        resolve(rows || []);
      });
    });

    return {
      success: true,
      scenario_name
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