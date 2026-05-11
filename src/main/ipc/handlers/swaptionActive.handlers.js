'use strict';

const { getDb } = require('../../services/db.service');
const { logger } = require('../../utils/logger');

logger.debug('IPC', 'swaptionActive.handlers loaded');

module.exports = function registerSwaptionActiveHandlers({
  ipcMain,
  refreshTable
}) {
  if (!ipcMain) throw new Error('[swaptionActive.handlers] ipcMain missing');
  if (typeof refreshTable !== 'function') throw new Error('[swaptionActive.handlers] refreshTable missing');

  const db = getDb();

  try {
    ipcMain.removeHandler('swaption:set-active-scenario');
  } catch {}

  ipcMain.handle('swaption:set-active-scenario', async (_event, payload) => {
    try {
      const scenario_id = String(payload?.scenario_id || 'BASE').trim() || 'BASE';
      const ccy = String(payload?.ccy || 'EUR').trim().toUpperCase() || 'EUR';
      const active_run_id = String(payload?.active_run_id || 'ACTIVE').trim() || 'ACTIVE';

      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          db.run(
            `
            DELETE FROM SWAPTION_ACTIVE
            WHERE ccy = ?
            `,
            [ccy],
            function (deleteErr) {
              if (deleteErr) {
                db.run('ROLLBACK');
                return reject(deleteErr);
              }

              db.run(
                `
                INSERT INTO SWAPTION_ACTIVE
                (
                  ccy,
                  scenario_id,
                  active_run_id,
                  activated_at
                )
                VALUES (?, ?, ?, CURRENT_TIMESTAMP)
                `,
                [ccy, scenario_id, active_run_id],
                function (insertErr) {
                  if (insertErr) {
                    db.run('ROLLBACK');
                    return reject(insertErr);
                  }

                  db.run('COMMIT', (commitErr) => {
                    if (commitErr) {
                      db.run('ROLLBACK');
                      return reject(commitErr);
                    }
                    resolve();
                  });
                }
              );
            }
          );
        });
      });

      await new Promise((resolve, reject) => {
        refreshTable('SWAPTION_ACTIVE', (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      return {
        success: true,
        scenario_id,
        ccy,
        active_run_id
      };

    } catch (err) {
      console.error('[swaption:set-active-scenario]', err);

      return {
        success: false,
        error: err.message
      };
    }
  });
};