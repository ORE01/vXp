'use strict';

module.exports = function registerCSActiveHandlers({ ipcMain, dbApi, refreshTable }) {

  if (!ipcMain) throw new Error('[csActive] ipcMain missing');

  if (!dbApi || typeof dbApi.runSQL !== 'function') {
    throw new Error('[csActive] dbApi invalid');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[csActive] refreshTable missing');
  }

  // ============================================================
  // 1️⃣ SET ACTIVE CS SCENARIO
  // ============================================================
ipcMain.handle('cs:set-active-scenario', async (_evt, payload) => {
  try {
    const { scenario_name } = payload || {};

    if (!scenario_name) {
      throw new Error('scenario_name missing');
    }

    await dbApi.runSQL(`DELETE FROM CS_ACTIVE`);

    await dbApi.runSQL(
      `
      INSERT INTO CS_ACTIVE (scenario_name, activated_at)
      VALUES (?, datetime('now'))
      `,
      [scenario_name]
    );

    refreshTable('CS_ACTIVE');

    return { success: true };

  } catch (err) {
    return {
      success: false,
      error: err.message
    };
  }
});

};