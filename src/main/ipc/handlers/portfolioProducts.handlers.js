'use strict';

// src/main/ipc/handlers/portfolioProducts.handlers.js

/**
 * Add Products to a portfolio.
 * - add-products-to-portfolio -> insert one DealsMain row per PROD_ID
 *   (port_name, INCLUDE=1, PROD_ID). Other trade fields stay empty and are
 *   filled later via the Change-Portfolio Edit flow.
 * - Afterwards the empty-portfolio placeholder/dummy row is removed.
 *
 * No schema changes. No pricing logic.
 */
module.exports = function registerPortfolioProductsHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[portfolioProducts.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[portfolioProducts.handlers] dbApi missing');
  if (typeof dbApi.runSQL !== 'function') throw new Error('[portfolioProducts.handlers] dbApi.runSQL missing');
  if (typeof refreshTable !== 'function') throw new Error('[portfolioProducts.handlers] refreshTable missing');

  console.log('[IPC] portfolioProducts.handlers registered');

  // Airbag against double registration
  try { ipcMain.removeAllListeners('add-products-to-portfolio'); } catch {}

  ipcMain.on('add-products-to-portfolio', async (event, payload = {}) => {
    const port = String(payload?.port_name ?? '').trim();
    const rawIds = Array.isArray(payload?.prodIds) ? payload.prodIds : [];
    const prodIds = [...new Set(
      rawIds.map((x) => String(x ?? '').trim()).filter(Boolean)
    )];

    console.log('[ADD PRODUCTS] START', { port, count: prodIds.length });

    try {
      if (!port) throw new Error('port_name missing');
      if (!prodIds.length) throw new Error('no products selected');

      await dbApi.runSQL('BEGIN');

      let inserted = 0;
      for (const prodId of prodIds) {
        await dbApi.runSQL(
          `INSERT INTO "DealsMain" ("port_name", "INCLUDE", "PROD_ID") VALUES (?, 1, ?)`,
          [port, prodId]
        );
        inserted++;
      }

      // Real products now exist -> drop the empty-portfolio placeholder rows.
      await dbApi.runSQL(
        `DELETE FROM "DealsMain"
           WHERE TRIM("port_name") = ?
             AND ("PROD_ID" IS NULL OR TRIM("PROD_ID") = '')`,
        [port]
      );

      await dbApi.runSQL('COMMIT');

      refreshTable('DealsMain');

      console.log('[ADD PRODUCTS] DONE', { port, inserted });
      event.sender.send('add-products-to-portfolio-success', { port, inserted });
    } catch (error) {
      try { await dbApi.runSQL('ROLLBACK'); } catch {}
      console.error('[ADD PRODUCTS] ERROR', error?.message || error);
      event.sender.send('add-products-to-portfolio-error', {
        message: error?.message || String(error),
      });
    }
  });
};
