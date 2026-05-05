'use strict';

const { getDb } = require('../../services/db.service');
const { logger } = require('../../utils/logger');

logger.debug('IPC', 'swaptionScenario.handlers loaded');

module.exports = function registerSwaptionScenarioHandlers({
  ipcMain,
  refreshTable
}) {
  if (!ipcMain) throw new Error('[swaptionScenario.handlers] ipcMain missing');
  if (typeof refreshTable !== 'function') throw new Error('[swaptionScenario.handlers] refreshTable missing');

  const db = getDb();

  try {
    ipcMain.removeHandler('swaption:create-scenario');
  } catch {}

  ipcMain.handle('swaption:create-scenario', async (_event, payload) => {
    try {
      const scenario_id = String(payload?.scenario_id || '').trim();
      const data = Array.isArray(payload?.data) ? payload.data : [];
      const smileData = Array.isArray(payload?.smileData) ? payload.smileData : [];

      if (!scenario_id) throw new Error('scenario_id missing');
      if (scenario_id === 'BASE') throw new Error('BASE cannot be saved');
      if (!data.length) throw new Error('data missing');

      const ccy = String(payload?.ccy || 'EUR').trim() || 'EUR';
      const cube_id = String(payload?.cube_id || 'BASE').trim() || 'BASE';
      const run_id = `VOL_${Date.now()}`;

      await new Promise((resolve, reject) => {
        db.serialize(() => {
          db.run('BEGIN TRANSACTION');

          db.run(
            `
            DELETE FROM SWAPTION_ATM_SCENARIO_DATA
            WHERE scenario_id = ?
              AND ccy = ?
              AND cube_id = ?
            `,
            [scenario_id, ccy, cube_id]
          );

          db.run(
            `
            DELETE FROM SWAPTION_SMILE_SCENARIO_DATA
            WHERE scenario_id = ?
            `,
            [scenario_id]
          );

          const stmt = db.prepare(`
            INSERT INTO SWAPTION_ATM_SCENARIO_DATA
            (
              scenario_id,
              ccy,
              option_tenor,
              swap_tenor,
              vol,
              cube_id,
              run_id,
              created_at
            )
            VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
          `);

          for (const row of data) {
            const option_tenor = String(row.option_tenor || '').trim();
            const swap_tenor = String(row.swap_tenor || '').trim();
            const vol = Number(row.vol);

            if (!option_tenor || !swap_tenor || !Number.isFinite(vol)) continue;

            stmt.run([
              scenario_id,
              ccy,
              option_tenor,
              swap_tenor,
              vol,
              cube_id,
              run_id
            ]);
          }

          stmt.finalize((err) => {
            if (err) {
              db.run('ROLLBACK');
              return reject(err);
            }

            const smileStmt = db.prepare(`
              INSERT INTO SWAPTION_SMILE_SCENARIO_DATA
              (
                scenario_id,
                smile_key,
                adjustment,
                run_id,
                created_at
              )
              VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
            `);

            for (const row of smileData) {
              const smile_key = String(row.smile_key || '').trim();
              const adjustment = Number(row.adjustment);

              if (!smile_key || !Number.isFinite(adjustment)) continue;

              smileStmt.run([
                scenario_id,
                smile_key,
                adjustment,
                run_id
              ]);
            }

            smileStmt.finalize((smileErr) => {
              if (smileErr) {
                db.run('ROLLBACK');
                return reject(smileErr);
              }

              db.run('COMMIT', (err2) => {
                if (err2) {
                  db.run('ROLLBACK');
                  return reject(err2);
                }
                resolve();
              });
            });
          });
        });
      });

      await new Promise((resolve, reject) => {
        refreshTable('SWAPTION_ATM_SCENARIO_DATA', (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      await new Promise((resolve, reject) => {
        refreshTable('SWAPTION_SMILE_SCENARIO_DATA', (err, rows) => {
          if (err) return reject(err);
          resolve(rows || []);
        });
      });

      return {
        success: true,
        scenario_id,
        ccy,
        cube_id,
        run_id
      };

    } catch (err) {
      console.error('[swaption:create-scenario]', err);

      return {
        success: false,
        error: err.message
      };
    }
  });
};