'use strict';

// src/main/ipc/handlers/portfolioDelete.handlers.js
//
// Löscht ein Portfolio aus ALLEN Tabellen, die eine port_name-Spalte besitzen.
// Die Tabellenliste wird dynamisch aus dem DB-Schema ermittelt (sqlite_master +
// PRAGMA table_info), damit auch neue/zusätzliche Tabellen automatisch erfasst
// werden. Alles in EINER Transaktion (Rollback bei Fehler).

module.exports = function registerPortfolioDeleteHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[portfolioDelete.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[portfolioDelete.handlers] dbApi missing');
  if (typeof refreshTable !== 'function') throw new Error('[portfolioDelete.handlers] refreshTable missing');
  if (typeof dbApi.runSQL !== 'function') throw new Error('[portfolioDelete.handlers] dbApi.runSQL missing');
  if (typeof dbApi.selectAll !== 'function') {
    throw new Error('[portfolioDelete.handlers] dbApi.selectAll missing (für dynamische Tabellensuche nötig)');
  }

  console.log('[IPC] portfolioDelete.handlers registered');

  // Airbag gegen doppelte Registrierung
  try { ipcMain.removeAllListeners('delete-portfolio-everywhere'); } catch {}

  // Tabellen, die das Frontend nach dem Löschen aktualisieren soll (nur die,
  // die der Daten-Pump kennt).
  const FRONTEND_REFRESH_TABLES = ['DealsMain', 'Portfolios', 'MarketVaR', 'CreditVaR', 'EAD'];

  // Alle Tabellen finden, die eine port_name-Spalte haben (case-insensitive,
  // trifft also auch PORT_NAME).
  async function findPortNameTables() {
    const tables = await dbApi.selectAll(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'`
    );

    const targets = [];
    for (const row of (Array.isArray(tables) ? tables : [])) {
      const table = row?.name;
      if (!table) continue;

      const cols = await dbApi.selectAll(`PRAGMA table_info("${table}")`);
      const portCol = (Array.isArray(cols) ? cols : []).find(
        (c) => String(c?.name ?? '').toLowerCase() === 'port_name'
      );
      if (portCol) targets.push({ table, col: portCol.name });
    }
    return targets;
  }

  ipcMain.on('delete-portfolio-everywhere', async (event, payload = {}) => {
    const raw = payload?.port_name;
    const port = String(raw ?? '').trim();

    console.log('[DELETE PORTFOLIO] START', { raw, port });

    try {
      if (!port) throw new Error('port_name missing');

      const targets = await findPortNameTables();

      await dbApi.runSQL('BEGIN');

      const deleted = {};      // { table: removedRowCount } – nur Tabellen mit >0
      let total = 0;
      for (const { table, col } of targets) {
        const res = await dbApi.runSQL(
          `DELETE FROM "${table}" WHERE TRIM("${col}") = ?`,
          [port]
        );
        const changes = res?.changes ?? 0;
        if (changes > 0) {
          deleted[table] = changes;
          total += changes;
        }
      }

      await dbApi.runSQL('COMMIT');

      FRONTEND_REFRESH_TABLES.forEach((t) => {
        try { refreshTable(t); } catch { /* Tabelle evtl. nicht im Pump */ }
      });

      console.log('[DELETE PORTFOLIO] DONE', { port, total, deleted, scannedTables: targets.length });

      event.sender.send('delete-portfolio-everywhere-success', {
        port,
        deleted,
        total,
        scannedTables: targets.length,
      });
    } catch (error) {
      try { await dbApi.runSQL('ROLLBACK'); } catch {}
      console.error('[DELETE PORTFOLIO] ERROR', error?.message || error);
      event.sender.send('delete-portfolio-everywhere-error', { message: error?.message || String(error) });
    }
  });
};
