'use strict';

// src/main/ipc/handlers/portfolioDelete.handlers.js

module.exports = function registerPortfolioDeleteHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[portfolioDelete.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[portfolioDelete.handlers] dbApi missing');
  if (typeof refreshTable !== 'function') throw new Error('[portfolioDelete.handlers] refreshTable missing');

  if (typeof dbApi.runSQL !== 'function') throw new Error('[portfolioDelete.handlers] dbApi.runSQL missing');
  // selectAll ist optional – nur für table-exists check
  const hasSelectAll = typeof dbApi.selectAll === 'function';

  console.log('[IPC] portfolioDelete.handlers registered');

  // Airbag gegen doppelte Registrierung
  try { ipcMain.removeAllListeners('delete-portfolio-everywhere'); } catch {}

  ipcMain.on('delete-portfolio-everywhere', async (event, payload = {}) => {
    const raw = payload?.port_name;
    const port = String(raw ?? '').trim();

    console.log('[DELETE PORTFOLIO] START', { raw, port });

    try {
      if (!port) throw new Error('port_name missing');

      // ⚠️ ACHTUNG: Tabelle heißt bei dir evtl. "Portfolio" (singular) statt "Portfolios"
      const ops = [
        { table: 'DealsMain', col: 'port_name' },
        { table: 'Portfolios', col: 'port_name' }, // <-- ggf. auf 'Portfolios' ändern, falls das wirklich so heißt

        { table: 'MarketVaR', col: 'port_name' },
        { table: 'MarketVaR_Dist', col: 'port_name' },
        { table: 'MarketVaR_Product', col: 'port_name' },

        { table: 'CreditVaR', col: 'port_name' },
        { table: 'CreditVaRInput', col: 'port_name' },
        { table: 'CreditVaRInputThreshold', col: 'port_name' },

        { table: 'EAD', col: 'port_name' },
        { table: 'sortedLossesIssuerMain', col: 'port_name' },
        { table: 'PortfolioHistoryMetrics', col: 'port_name' },
      ];

      await dbApi.runSQL('BEGIN');

      const deleted = {};
      for (const { table, col } of ops) {
        if (hasSelectAll) {
          const exists = await dbApi.selectAll(
            `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
            [table]
          );
          if (Array.isArray(exists) && exists.length === 0) continue;
        }

        const res = await dbApi.runSQL(
          `DELETE FROM "${table}" WHERE TRIM("${col}") = ?`,
          [port]
        );

        deleted[table] = res?.changes ?? 0;
      }

      await dbApi.runSQL('COMMIT');

      // Refresh: nur Tabellen refreshen, die dein Pump wirklich kennt
      refreshTable('DealsMain');
      refreshTable('Portfolios');
      refreshTable('MarketVaR');
      refreshTable('CreditVaR');
      refreshTable('EAD');

      console.log('[DELETE PORTFOLIO] DONE', { port, deleted });

      event.sender.send('delete-portfolio-everywhere-success', { port, deleted });
    } catch (error) {
      try { await dbApi.runSQL('ROLLBACK'); } catch {}
      console.error('[DELETE PORTFOLIO] ERROR', error?.message || error);
      event.sender.send('delete-portfolio-everywhere-error', { message: error?.message || String(error) });
    }
  });
};
