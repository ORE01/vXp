'use strict';

/**
 * columnImport.handlers.js
 * IPC: import-matched-columns
 *
 * Spezieller Import: SourceTable -> TargetTable via columnMap (+ additionalFields)
 *
 * Injected deps:
 * - ipcMain
 * - dbApi.getAllRowsFromTable(sourceTable) -> Promise<rows>
 * - dbApi.insertRowInTable(rowObj, targetTable, cb)
 * - refreshTable(targetTable)
 */

function promisifyInsert(insertRowInTable, row, table) {
  return new Promise((resolve, reject) => {
    try {
      insertRowInTable(row, table, (err) => {
        if (err) return reject(err);
        resolve(true);
      });
    } catch (e) {
      reject(e);
    }
  });
}

function validateArgs(args) {
  const { sourceTable, targetTable, columnMap, additionalFields } = args || {};

  if (!sourceTable || typeof sourceTable !== 'string') {
    return { ok: false, error: 'sourceTable missing/invalid' };
  }
  if (!targetTable || typeof targetTable !== 'string') {
    return { ok: false, error: 'targetTable missing/invalid' };
  }
  if (!Array.isArray(columnMap) || columnMap.length === 0) {
    return { ok: false, error: 'columnMap missing/invalid (expected non-empty array)' };
  }
  for (const m of columnMap) {
    if (!m || typeof m.from !== 'string' || typeof m.to !== 'string') {
      return { ok: false, error: 'columnMap entries must be objects: { from: string, to: string }' };
    }
  }
  if (additionalFields != null && typeof additionalFields !== 'object') {
    return { ok: false, error: 'additionalFields must be an object if provided' };
  }

  return { ok: true };
}

module.exports = function registerColumnImportHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[columnImport.handlers] ipcMain missing');
  if (!dbApi?.getAllRowsFromTable) throw new Error('[columnImport.handlers] dbApi.getAllRowsFromTable missing');
  if (!dbApi?.insertRowInTable) throw new Error('[columnImport.handlers] dbApi.insertRowInTable missing');
  if (typeof refreshTable !== 'function') throw new Error('[columnImport.handlers] refreshTable missing');

  ipcMain.on('import-matched-columns', async (event, args) => {
    const v = validateArgs(args);
    if (!v.ok) {
      return event.reply('import-matched-columns-complete', { success: false, error: v.error });
    }

    const { sourceTable, targetTable, columnMap, additionalFields = {} } = args;

    console.log(`[COLUMN-IMPORT] ${sourceTable} → ${targetTable}`);
    console.log('[COLUMN-IMPORT] columnMap:', columnMap);
    console.log('[COLUMN-IMPORT] additionalFields:', additionalFields);

    try {
      const rows = await dbApi.getAllRowsFromTable(sourceTable);

      if (!rows || rows.length === 0) {
        return event.reply('import-matched-columns-complete', {
          success: false,
          message: `No data in source table: ${sourceTable}`,
          insertedCount: 0,
          failedCount: 0,
        });
      }

      let insertedCount = 0;
      let failedCount = 0;
      const failures = [];

      // Sequenziell = stabil; wenn du später Speed willst, machen wir Transaction/Batch.
      for (const row of rows) {
        const newRow = {};

        // Column mapping
        for (const { from, to } of columnMap) {
          if (Object.prototype.hasOwnProperty.call(row, from)) {
            newRow[to] = row[from];
          }
        }

        // Additional fields (z.B. port_name)
        for (const [k, v] of Object.entries(additionalFields)) {
          newRow[k] = v;
        }

        try {
          await promisifyInsert(dbApi.insertRowInTable, newRow, targetTable);
          insertedCount++;
        } catch (err) {
          failedCount++;
          const msg = err?.message || String(err);
          console.error(`[COLUMN-IMPORT] insert failed (${targetTable}):`, msg);
          failures.push({ error: msg, row: newRow });
        }
      }

      // ✅ erst jetzt Success + refresh (weil Inserts wirklich fertig sind)
      event.reply('import-matched-columns-complete', {
        success: failedCount === 0,
        message:
          failedCount === 0
            ? `✅ ${insertedCount} rows inserted into "${targetTable}".`
            : `⚠️ Import finished: ${insertedCount} ok, ${failedCount} failed.`,
        insertedCount,
        failedCount,
        failures: failures.slice(0, 25), // UI nicht fluten
      });

      refreshTable(targetTable);

    } catch (err) {
      const msg = err?.message || String(err);
      console.error('[COLUMN-IMPORT] fatal error:', msg);
      event.reply('import-matched-columns-complete', {
        success: false,
        error: msg,
      });
    }
  });
};





