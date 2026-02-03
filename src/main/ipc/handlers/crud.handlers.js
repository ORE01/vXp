// src/main/ipc/handlers/crud.handlers.js
'use strict';

/**
 * CRUD IPC handlers:
 * - update-data
 * - add-new-row
 * - erase-data
 *
 * Rules:
 * - No direct imports of main_fct or db.service here
 * - Everything injected (dbApi + refreshTable + optional bulk lock)
 * - DealsMain: never accept TRADE_ID from UI (avoid UNIQUE constraint collisions)
 */
module.exports = function registerCrudHandlers({
  ipcMain,
  dbApi,               // { updateRecord, insertRowInTable, eraseRowFromDB }
  refreshTable,         // function(tableName, cb?)
  bulkUpdateStart,      // optional
  bulkUpdateEnd,        // optional
}) {
  if (!ipcMain) throw new Error('[crud.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[crud.handlers] dbApi missing');
  if (typeof refreshTable !== 'function') throw new Error('[crud.handlers] refreshTable missing');

  const { updateRecord, insertRowInTable, eraseRowFromDB } = dbApi;

  if (typeof updateRecord !== 'function') throw new Error('[crud.handlers] dbApi.updateRecord missing');
  if (typeof insertRowInTable !== 'function') throw new Error('[crud.handlers] dbApi.insertRowInTable missing');
  if (typeof eraseRowFromDB !== 'function') throw new Error('[crud.handlers] dbApi.eraseRowFromDB missing');

  const _bulkStart = typeof bulkUpdateStart === 'function' ? bulkUpdateStart : () => {};
  const _bulkEnd   = typeof bulkUpdateEnd === 'function' ? bulkUpdateEnd : () => {};

  // ------------------------------------------------------------
  // Refresh rules (aus index.js übernommen)
  // ------------------------------------------------------------
  const REFRESH_DEPENDENCIES = {
    ProdAll:             ['ProdAll'],
    DealsMain:           ['DealsMain'],
    ProdCouponSchedules: ['ProdCouponSchedules', 'ProdAll'],
    Issuer:              ['Issuer'],
    Portfolios:          ['Portfolios'],
    MVaRInput:           ['MVaRInput'],
    ecb:                 ['ecb'],
    fed:                 ['fed'],
    yahoo:               ['yahoo'],
  };

  const PORTFOLIO_RELEVANT_FIELDS = new Set([
    'PROD_ID','INCLUDE','NOTIONAL','PRICE','PRICE_BUY',
    'COUPON','START_DATE','MATURITY','TENOR',
    'CouponType','GEARING','CAP','FLOOR','SPREADS',
    'C_SPREAD','RANK','RATING','CATEGORY'
  ]);

  function affectsPortfolio(newData = {}) {
    return Object.keys(newData || {}).some(k => PORTFOLIO_RELEVANT_FIELDS.has(k));
  }

  async function refreshTablesSequential(tables = []) {
    for (const t of tables) {
      try {
        await refreshTable(t);
      } catch (e) {
        console.error('[crud.handlers] refresh failed:', t, e);
      }
    }
  }

  function computeRefreshList(cleanTableName, deltaObj) {
    const base = REFRESH_DEPENDENCIES[cleanTableName] || [cleanTableName];
    const toRefresh = new Set(base);

    // Prod/Deals/Schedules + portfolios-relevant change -> refresh Portfolios
    if (
      (cleanTableName === 'ProdAll' ||
       cleanTableName === 'DealsMain' ||
       cleanTableName === 'ProdCouponSchedules') &&
      affectsPortfolio(deltaObj)
    ) {
      toRefresh.add('Portfolios');
    }

    // Issuer changes can affect Portfolios (ratings/rank logic)
    if (cleanTableName === 'Issuer' && affectsPortfolio({ RATING: 1, RANK: 1 })) {
      toRefresh.add('Portfolios');
    }

    return [...toRefresh];
  }

  function needsBulkLock(refreshList) {
    return (
      refreshList.length > 1 ||
      refreshList.includes('Portfolios') ||
      refreshList.includes('ProdAll') ||
      refreshList.includes('DealsMain')
    );
  }

  // ------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------
  ipcMain.on('update-data', async (event, { cleanTableName, rowIndex, newData, uniqueIdentifier } = {}) => {
    try {
      updateRecord(cleanTableName, rowIndex, newData, uniqueIdentifier, async (err) => {
        if (err) {
          event.reply('update-data-error', err?.message || String(err));
          return;
        }

        event.reply('update-data-success', { cleanTableName });

        const refreshList = computeRefreshList(cleanTableName, newData);
        const lock = needsBulkLock(refreshList);

        if (lock) _bulkStart();
        try {
          await refreshTablesSequential(refreshList);
        } finally {
          if (lock) _bulkEnd();
        }
      });
    } catch (error) {
      event.reply('update-data-error', error?.message || String(error));
    }
  });

  // ------------------------------------------------------------
  // ADD NEW ROW
  // ------------------------------------------------------------
  ipcMain.on('add-new-row', (event, { newRowData, cleanTableName, requestId } = {}) => {
    // Defensive copy + DealsMain auto-ID protection
    const row = { ...(newRowData || {}) };

    // ✅ Critical fix: Never accept TRADE_ID from UI for DealsMain
    // Otherwise you hit: SQLITE_CONSTRAINT UNIQUE constraint failed: DealsMain.TRADE_ID
    if (cleanTableName === 'DealsMain' && Object.prototype.hasOwnProperty.call(row, 'TRADE_ID')) {
      delete row.TRADE_ID;
    }

    insertRowInTable(row, cleanTableName, async (err, insertedId) => {
      if (err) {
        event.reply(`add-new-row-error:${requestId}`, { message: err?.message || String(err) });
        return;
      }

      event.reply(`add-new-row-success:${requestId}`, { insertedId });

      try {
        const refreshList = computeRefreshList(cleanTableName, row);
        await refreshTablesSequential(refreshList);
      } catch (e) {
        console.warn('[crud.handlers] add-new-row refresh warning:', e?.message || e);
      }
    });
  });

  // ------------------------------------------------------------
  // ERASE
  // ------------------------------------------------------------
  ipcMain.on('erase-data', async (event, { cleanTableName, uniqueIdentifier } = {}) => {
    try {
      await eraseRowFromDB(cleanTableName, uniqueIdentifier);
      event.reply('erase-data-success', { cleanTableName, uniqueIdentifier });

      const base = REFRESH_DEPENDENCIES?.[cleanTableName] || [cleanTableName];
      await refreshTablesSequential(base);
    } catch (error) {
      event.reply('erase-data-error', error?.message || String(error));
    }
  });
};

