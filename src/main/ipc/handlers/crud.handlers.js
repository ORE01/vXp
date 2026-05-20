// src/main/ipc/handlers/crud.handlers.js
'use strict';

const {
  createProductCanonicalService,
} = require('../../services/productCanonical.service');

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
  dbApi,
  refreshTable,
  bulkUpdateStart,
  bulkUpdateEnd,
}) {
  if (!ipcMain) throw new Error('[crud.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[crud.handlers] dbApi missing');
  if (typeof refreshTable !== 'function') throw new Error('[crud.handlers] refreshTable missing');

  const {
    updateRecord,
    insertRowInTable,
    eraseRowFromDB,
  } = dbApi;

  if (typeof updateRecord !== 'function') throw new Error('[crud.handlers] dbApi.updateRecord missing');
  if (typeof insertRowInTable !== 'function') throw new Error('[crud.handlers] dbApi.insertRowInTable missing');
  if (typeof eraseRowFromDB !== 'function') throw new Error('[crud.handlers] dbApi.eraseRowFromDB missing');

  const productCanonicalService = createProductCanonicalService(dbApi);

  const _bulkStart = typeof bulkUpdateStart === 'function' ? bulkUpdateStart : () => {};
  const _bulkEnd = typeof bulkUpdateEnd === 'function' ? bulkUpdateEnd : () => {};

  // ------------------------------------------------------------
  // Refresh rules
  // ------------------------------------------------------------
  const REFRESH_DEPENDENCIES = {
    DealsMain:           ['DealsMain'],
    PRODUCT_STRUCTURE:   ['PRODUCT_STRUCTURE', 'v_PRODUCTS_CANONICAL', 'v_PRODUCTS_APP'],
    PRODUCTS_MASTER:     ['PRODUCTS_MASTER', 'v_PRODUCTS_CANONICAL', 'v_PRODUCTS_APP'],
    PRODUCTS_CONVENTIONS:['PRODUCTS_CONVENTIONS', 'v_PRODUCTS_CANONICAL', 'v_PRODUCTS_APP'],
    PRODUCTS_FIXED_TERMS:['PRODUCTS_FIXED_TERMS', 'v_PRODUCTS_CANONICAL', 'v_PRODUCTS_APP'],
    PRODUCTS_FRN_TERMS:  ['PRODUCTS_FRN_TERMS', 'v_PRODUCTS_CANONICAL', 'v_PRODUCTS_APP'],
    PRODUCTS_PRICING_CONFIG: ['PRODUCTS_PRICING_CONFIG', 'v_PRODUCTS_CANONICAL', 'v_PRODUCTS_APP'],
    Issuer:              ['Issuer', 'IssuerRankRating'],
    Portfolios:          ['Portfolios'],
    MVaRInput:           ['MVaRInput'],
    ecb:                 ['ecb'],
    fed:                 ['fed'],
    yahoo:               ['yahoo'],

    // MARKET DATA
    RATES_SCENARIO_DATA: ['RATES'],
    RATES:               ['RATES'],
    RATES_ACTIVE:        ['RATES_ACTIVE'],
  };

  const PORTFOLIO_RELEVANT_FIELDS = new Set([
    'PROD_ID',
    'INCLUDE',
    'NOTIONAL',
    'PRICE',
    'PRICE_BUY',
    'COUPON',
    'START_DATE',
    'MATURITY',
    'TENOR',
    'COUPON_FREQUENCY',
    'CouponType',
    'GEARING',
    'CAP',
    'FLOOR',
    'SPREADS',
    'C_SPREAD',
    'RANK',
    'RATING',
    'CATEGORY',
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

  function computeRefreshList(cleanTableName, deltaObj = {}) {
    const base = REFRESH_DEPENDENCIES[cleanTableName] || [cleanTableName];
    const toRefresh = new Set(base);

    if (
      (
        cleanTableName === 'v_PRODUCTS_APP' ||
        cleanTableName === 'v_PRODUCTS_CANONICAL' ||
        cleanTableName === 'PRODUCTS_MASTER' ||
        cleanTableName === 'PRODUCTS_CONVENTIONS' ||
        cleanTableName === 'PRODUCTS_FIXED_TERMS' ||
        cleanTableName === 'PRODUCTS_FRN_TERMS' ||
        cleanTableName === 'PRODUCTS_PRICING_CONFIG' ||
        cleanTableName === 'PRODUCT_STRUCTURE' ||
        cleanTableName === 'DealsMain'
      ) &&
      affectsPortfolio(deltaObj)
    ) {
      toRefresh.add('Portfolios');
    }

    return [...toRefresh];
  }

  function needsBulkLock(refreshList = []) {
    return (
      refreshList.length > 1 ||
      refreshList.includes('Portfolios') ||
      refreshList.includes('v_PRODUCTS_APP') ||
      refreshList.includes('v_PRODUCTS_CANONICAL') ||
      refreshList.includes('PRODUCTS_MASTER') ||
      refreshList.includes('PRODUCT_STRUCTURE') ||
      refreshList.includes('DealsMain')
    );
  }

  async function refreshWithOptionalLock(refreshList = []) {
    const lock = needsBulkLock(refreshList);

    if (lock) _bulkStart();

    try {
      await refreshTablesSequential(refreshList);
    } finally {
      if (lock) _bulkEnd();
    }
  }

  function isProductTableName(tableName) {
    return (
      tableName === 'v_PRODUCTS_APP' ||
      tableName === 'v_PRODUCTS_CANONICAL' ||
      tableName === 'PRODUCTS_MASTER'
    );
  }

  function productRefreshList() {
    return [
      'PRODUCTS_MASTER',
      'PRODUCTS_CONVENTIONS',
      'PRODUCTS_FIXED_TERMS',
      'PRODUCTS_FRN_TERMS',
      'PRODUCTS_PRICING_CONFIG',
      'PRODUCT_STRUCTURE',
      'v_PRODUCTS_CANONICAL',
      'v_PRODUCTS_APP',
      'Portfolios',
    ];
  }

  // ------------------------------------------------------------
  // UPDATE
  // ------------------------------------------------------------

  ipcMain.on('update-data', async (event, {
    cleanTableName,
    rowIndex,
    newData,
    uniqueIdentifier,
  } = {}) => {
    try {
      const tableName = String(cleanTableName || '');
      const isProductTable = isProductTableName(tableName);

      // --------------------------------------------------------
      // PRODUCT UPDATE: Canonical path
      // --------------------------------------------------------
      if (isProductTable) {
        await productCanonicalService.saveCanonicalProduct(newData, uniqueIdentifier);

        const refreshList = productRefreshList();

        await refreshWithOptionalLock(refreshList);

        event.reply('update-data-success', {
          cleanTableName: 'v_PRODUCTS_APP',
          refreshList,
        });

        return;
      }

      // --------------------------------------------------------
      // NORMAL UPDATE
      // --------------------------------------------------------
      updateRecord(cleanTableName, rowIndex, newData, uniqueIdentifier, async (err) => {
        if (err) {
          event.reply('update-data-error', err?.message || String(err));
          return;
        }

        try {
          const refreshList = computeRefreshList(cleanTableName, newData);

          await refreshWithOptionalLock(refreshList);

          event.reply('update-data-success', {
            cleanTableName,
            refreshList,
          });
        } catch (e) {
          event.reply('update-data-error', e?.message || String(e));
        }
      });
    } catch (error) {
      event.reply('update-data-error', error?.message || String(error));
    }
  });

  // ------------------------------------------------------------
  // ADD NEW ROW
  // ------------------------------------------------------------

  ipcMain.on('add-new-row', async (event, {
    newRowData,
    newData,
    cleanTableName,
    requestId,
  } = {}) => {
    try {
      const tableName = String(cleanTableName || '');
      const isProductTable = isProductTableName(tableName);

      const row = { ...(newRowData || newData || {}) };

      console.log('[CRUD add-new-row RECEIVED]', {
        cleanTableName,
        requestId,
        row,
      });

      // --------------------------------------------------------
      // PRODUCT ADD: Canonical path
      // --------------------------------------------------------
      if (isProductTable) {
        await productCanonicalService.saveCanonicalProduct(row, {
          column: 'PROD_ID',
          value: row.PROD_ID || row.product_id,
        });

        const refreshList = productRefreshList();

        await refreshWithOptionalLock(refreshList);

        event.reply(`add-new-row-success:${requestId}`, {
          insertedId: row.PROD_ID || row.product_id,
          refreshList,
        });

        return;
      }

      // --------------------------------------------------------
      // NORMAL ADD: Generic table insert
      // --------------------------------------------------------

      if (
        cleanTableName === 'DealsMain' &&
        Object.prototype.hasOwnProperty.call(row, 'TRADE_ID')
      ) {
        delete row.TRADE_ID;
      }

      insertRowInTable(row, cleanTableName, async (err, insertedId) => {
        if (err) {
          event.reply(`add-new-row-error:${requestId}`, {
            message: err?.message || String(err),
          });
          return;
        }

        try {
          const refreshList = computeRefreshList(cleanTableName, row);

          await refreshWithOptionalLock(refreshList);

          event.reply(`add-new-row-success:${requestId}`, {
            insertedId,
            refreshList,
          });
        } catch (e) {
          console.warn(
            '[crud.handlers] add-new-row refresh warning:',
            e?.message || e
          );

          event.reply(`add-new-row-error:${requestId}`, {
            message: e?.message || String(e),
          });
        }
      });
    } catch (error) {
      event.reply(`add-new-row-error:${requestId}`, {
        message: error?.message || String(error),
      });
    }
  });

  // ------------------------------------------------------------
  // ERASE
  // ------------------------------------------------------------

  ipcMain.on('erase-data', async (event, {
    cleanTableName,
    uniqueIdentifier,
  } = {}) => {
    try {
      const tableName = String(cleanTableName || '');
      const isProductTable = isProductTableName(tableName);

      if (isProductTable) {
        const productId =
          uniqueIdentifier?.value ||
          uniqueIdentifier?.PROD_ID ||
          uniqueIdentifier?.product_id;

        if (!productId) {
          throw new Error('[canonical product delete] Missing product id');
        }

        await productCanonicalService.deleteCanonicalProduct(productId);

        const refreshList = productRefreshList();

        await refreshWithOptionalLock(refreshList);

        event.reply('erase-data-success', {
          cleanTableName,
          uniqueIdentifier,
          refreshList,
        });

        return;
      }

      await eraseRowFromDB(cleanTableName, uniqueIdentifier);

      const refreshList = computeRefreshList(cleanTableName, uniqueIdentifier || {});

      await refreshWithOptionalLock(refreshList);

      event.reply('erase-data-success', {
        cleanTableName,
        uniqueIdentifier,
        refreshList,
      });
    } catch (error) {
      event.reply(
        'erase-data-error',
        error?.message || String(error)
      );
    }
  });
};