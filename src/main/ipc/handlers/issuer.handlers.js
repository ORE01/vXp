// src/main/ipc/handlers/issuer.handlers.js
'use strict';

module.exports = function registerIssuerHandlers({
  ipcMain,
  dbApi,
  sqliteDb,
  refreshTable,
}) {
  if (!ipcMain) throw new Error('[issuer.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[issuer.handlers] dbApi missing');
  if (!sqliteDb) throw new Error('[issuer.handlers] sqliteDb missing');
  if (typeof refreshTable !== 'function') throw new Error('[issuer.handlers] refreshTable missing');

  const { runSQL } = dbApi;
  if (typeof runSQL !== 'function') throw new Error('[issuer.handlers] dbApi.runSQL missing');

  // Airbag gegen doppelte Registrierung
  try { ipcMain.removeHandler('check-and-insert-issuers'); } catch {}

  ipcMain.handle('check-and-insert-issuers', async (_event, { tableName, columnMap } = {}) => {
    try {
      const tickerCol = columnMap?.find(m => m.to === 'TICKER')?.from;
      const issuerCol = columnMap?.find(m => m.to === 'ISSUER')?.from;
      const ratingCol = columnMap?.find(m => m.to === 'RATING')?.from;

      if (!tickerCol || !issuerCol || !ratingCol) {
        throw new Error('Erforderliche Spalten für den Issuer-Check wurden nicht vollständig zugeordnet.');
      }

      const sql = `
        SELECT DISTINCT "${tickerCol}" AS TICKER, "${issuerCol}" AS ISSUER, "${ratingCol}" AS RATING
        FROM "${tableName}"
        WHERE "${tickerCol}" IS NOT NULL
      `;

      const rows = await new Promise((resolve, reject) => {
        sqliteDb.all(sql, [], (err, r) => (err ? reject(err) : resolve(r || [])));
      });

      let inserted = false;

      for (const row of rows) {
        const { TICKER, ISSUER, RATING } = row;

        const existing = await new Promise((resolve, reject) => {
          sqliteDb.get(
            `SELECT 1 FROM Issuer WHERE TICKER = ?`,
            [TICKER],
            (err, res) => (err ? reject(err) : resolve(res))
          );
        });

        if (!existing) {
          const insertSQL = `
            INSERT INTO Issuer
            ("INCLUDE", "ISSUER", "TICKER", "RATING", "senior_unsecured")
            VALUES (?, ?, ?, ?, ?)
          `;
          await runSQL(insertSQL, [1, ISSUER, TICKER, RATING, RATING]);
          inserted = true;
        }
      }

      if (inserted) refreshTable('Issuer');
      return { success: true };
    } catch (err) {
      console.error('❌ Fehler beim Prüfen/Einfügen der Issuer:', err);
      return { success: false, error: err?.message || String(err) };
    }
  });
};
