// src/main/ipc/handlers/products.handlers.js
'use strict';

const {
  createProductCanonicalService,
} = require('../../services/productCanonical.service');

module.exports = function registerProductsHandlers({
  ipcMain,
  dbApi,
  sqliteDb,
  refreshTable,
}) {
  if (!ipcMain) throw new Error('[products.handlers] ipcMain missing');
  if (!dbApi) throw new Error('[products.handlers] dbApi missing');
  if (!sqliteDb) throw new Error('[products.handlers] sqliteDb missing');
  if (typeof refreshTable !== 'function') throw new Error('[products.handlers] refreshTable missing');

  let productCanonicalService = null;

  function getProductCanonicalService() {
    if (productCanonicalService) {
      return productCanonicalService;
    }

    if (
      typeof dbApi.updateRecord !== 'function' ||
      typeof dbApi.insertRowInTable !== 'function' ||
      typeof dbApi.eraseRowFromDB !== 'function'
    ) {
      throw new Error(
        '[products.handlers] canonical product service unavailable: dbApi.updateRecord / insertRowInTable / eraseRowFromDB missing'
      );
    }

    productCanonicalService = createProductCanonicalService(dbApi);
    return productCanonicalService;
  }

  const PRODUCT_REFRESH_LIST = [
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

  async function refreshProductTables() {
    for (const tableName of PRODUCT_REFRESH_LIST) {
      try {
        await refreshTable(tableName);
      } catch (err) {
        console.warn(
          '[products.handlers] refresh warning:',
          tableName,
          err?.message || err
        );
      }
    }
  }

  function formatDate(val) {
    if (!val) return '';

    if (typeof val === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
      const [d, m, y] = val.split('.');
      return `${y}-${m}-${d}`;
    }

    if (val instanceof Date) {
      return val.toISOString().split('T')[0];
    }

    return val;
  }

  function parseCoupon(value) {
    if (value === null || value === undefined || value === '') {
      return '';
    }

    let parsed = value;

    if (typeof parsed === 'string') {
      parsed = parseFloat(parsed.replace(',', '.'));
    }

    if (!Number.isFinite(parsed)) {
      return '';
    }

    if (parsed > 1) {
      return parsed / 100;
    }

    return parsed;
  }

  function normalizeRank(value) {
    const raw = String(value || '').toLowerCase().trim();

    const rankMapping = {
      'senior secured': 'senior_secured',
      'secured': 'senior_secured',

      'senior preferred': 'senior_preferred',
      'senior pref.': 'senior_preferred',
      'sr preferred': 'senior_preferred',

      'senior unsecured': 'senior_unsecured',
      'sr unsecured': 'senior_unsecured',
      'unsecured': 'senior_unsecured',
      'senior': 'senior_unsecured',
      'plain vanilla': 'senior_unsecured',

      'senior subordinated': 'senior_subordinated',
      'subordinated': 'senior_subordinated',
      'subord.': 'senior_subordinated',

      'junior subordinated': 'junior_subordinated',
    };

    return {
      raw,
      normalized: rankMapping[raw] || null,
    };
  }

  function cleanRating(value) {
    if (
      value === undefined ||
      value === null ||
      value === 'Product_Rating'
    ) {
      return '';
    }

    return value;
  }

  async function productExists(productId) {
    return new Promise((resolve, reject) => {
      sqliteDb.get(
        `
        SELECT 1
        FROM PRODUCTS_MASTER
        WHERE TRIM(product_id) = TRIM(?)
        LIMIT 1
        `,
        [productId],
        (err, found) => (err ? reject(err) : resolve(!!found))
      );
    });
  }

  async function findIssuerByTicker(ticker) {
    return new Promise((resolve, reject) => {
      sqliteDb.get(
        `
        SELECT ISSUER
        FROM Issuer
        WHERE TICKER = ?
        `,
        [ticker],
        (err, res) => (err ? reject(err) : resolve(res?.ISSUER || null))
      );
    });
  }

  // Airbag gegen doppelte Registrierung
  try { ipcMain.removeHandler('check-and-insert-products'); } catch {}

  ipcMain.handle('check-and-insert-products', async (event, { tableName, columnMap } = {}) => {
    try {
      const prodIdCol     = columnMap?.find(m => m.to === 'PROD_ID')?.from;
      const descCol       = columnMap?.find(m => m.to === 'DESCRIPTION')?.from;
      const tickerCol     = columnMap?.find(m => m.to === 'TICKER')?.from;
      const maturityCol   = columnMap?.find(m => m.to === 'MATURITY')?.from;
      const couponCol     = columnMap?.find(m => m.to === 'COUPON')?.from;
      const rankCol       = columnMap?.find(m => m.to === 'RANK')?.from;
      const ratingProdCol = columnMap?.find(m => m.to === 'RATING_PROD')?.from;
      const tenorCol      = columnMap?.find(m => m.to === 'TENOR')?.from;
      const startDateCol  = columnMap?.find(m => m.to === 'START_DATE')?.from;
      const ccyCol        = columnMap?.find(m => m.to === 'CCY')?.from;

      if (!prodIdCol || !descCol || !tickerCol) {
        throw new Error(
          'Erforderliche Spalten (PROD_ID, DESCRIPTION, TICKER) wurden nicht vollständig zugeordnet.'
        );
      }

      const safeCol = (col, alias) => (
        col ? `"${col}" AS ${alias}` : `'' AS ${alias}`
      );

      const sql = `
        SELECT DISTINCT
          ${safeCol(prodIdCol,     'PROD_ID')},
          ${safeCol(descCol,       'DESCRIPTION')},
          ${safeCol(tickerCol,     'TICKER')},
          ${safeCol(maturityCol,   'MATURITY')},
          ${safeCol(couponCol,     'COUPON')},
          ${safeCol(rankCol,       'RANK')},
          ${safeCol(ratingProdCol, 'RATING_PROD')},
          ${safeCol(tenorCol,      'TENOR')},
          ${safeCol(startDateCol,  'START_DATE')},
          ${safeCol(ccyCol,        'CCY')}
        FROM "${tableName}"
        WHERE "${prodIdCol}" IS NOT NULL
      `;

      const rows = await new Promise((resolve, reject) => {
        sqliteDb.all(sql, [], (err, r) => (
          err ? reject(err) : resolve(r || [])
        ));
      });

      const unmappedRanks = new Set();
      const unmappedProdIds = new Map();
      let insertedCount = 0;

      for (const row of rows) {
        const productId = String(row.PROD_ID || '').trim();

        if (!productId) {
          continue;
        }

        const exists = await productExists(productId);

        if (exists) {
          continue;
        }

        const ticker = String(row.TICKER || '').trim().toUpperCase();
        const matchedIssuer = await findIssuerByTicker(ticker);

        row.MATURITY = formatDate(row.MATURITY);
        row.START_DATE = formatDate(row.START_DATE);
        row.COUPON = parseCoupon(row.COUPON);

        const { raw: rawRank, normalized: normalizedRank } = normalizeRank(row.RANK);

        if (!normalizedRank && rawRank) {
          unmappedRanks.add(rawRank);

          if (!unmappedProdIds.has(rawRank)) {
            unmappedProdIds.set(rawRank, []);
          }

          unmappedProdIds.get(rawRank).push(productId);
        }

        const productData = {
          INCLUDE: 1,
          PROD_ID: productId,
          DESCRIPTION: row.DESCRIPTION || productId,
          PRODUCT_TYPE: 'BOND',
          CouponType: 'FIX',

          ISSUER: matchedIssuer || '',
          TICKER: ticker,

          MATURITY: row.MATURITY || '',
          START_DATE: row.START_DATE || '',

          COUPON: row.COUPON,
          RANK: normalizedRank || 'senior_unsecured',
          RATING_PROD: cleanRating(row.RATING_PROD),

          TENOR: row.TENOR || '1Y',
          CCY: String(row.CCY || 'EUR').trim().toUpperCase(),

          DAY_COUNT: '30/360',
          CALENDAR: 'TARGET',
          BUSINESS_DAY_CONVENTION: 'Modified Following',
          SETTLEMENT_DAYS: 2,

          FINLIB: 'ql',
          MODEL: 'DCF_ql',
          METHODE: 'discounted_cashflow',
        };

        await getProductCanonicalService().saveCanonicalProduct(
          productData,
          {
            column: 'PROD_ID',
            value: productId,
          }
        );

        insertedCount++;
      }

      if (insertedCount > 0) {
        await refreshProductTables();
      }

      if (unmappedRanks.size > 0) {
        const details = Array.from(unmappedProdIds.entries())
          .map(([rank, prodIds]) => `❓ "${rank}" → ${prodIds.join(', ')}`)
          .join('\n');

        event.sender.send(
          'show-rank-warning',
          `⚠️ Unbekannte RANK-Werte erkannt!\nDiese Produkte wurden mit senior_unsecured importiert:\n\n${details}`
        );
      }

      return {
        success: true,
        insertedCount,
        target: 'canonical',
      };
    } catch (err) {
      console.error('❌ Fehler beim Einfügen der Produkte:', err);

      return {
        success: false,
        error: err?.message || String(err),
      };
    }
  });

  // Airbag gegen doppelte Registrierung
  try { ipcMain.removeHandler('update-product-cs-spread-override'); } catch {}

  ipcMain.handle('update-product-cs-spread-override', async (event, { prodId, csSpreadOverrideBp } = {}) => {
    try {
      const productId = String(prodId || '').trim();

      if (!productId) {
        throw new Error('[update-product-cs-spread-override] Missing prodId');
      }

      const raw = csSpreadOverrideBp;

      const normalizedOverride =
        raw === null ||
        raw === undefined ||
        String(raw).trim() === '' ||
        String(raw).trim().toLowerCase() === 'default'
          ? null
          : Number(String(raw).replace(',', '.'));

      if (
        normalizedOverride !== null &&
        !Number.isFinite(normalizedOverride)
      ) {
        throw new Error(
          `[update-product-cs-spread-override] Invalid csSpreadOverrideBp: ${raw}`
        );
      }

      await new Promise((resolve, reject) => {
        sqliteDb.run(
          `
          INSERT INTO PRODUCTS_PRICING_CONFIG (
            product_id,
            cs_spread_override_bp,
            updated_at
          )
          VALUES (?, ?, CURRENT_TIMESTAMP)
          ON CONFLICT(product_id) DO UPDATE SET
            cs_spread_override_bp = excluded.cs_spread_override_bp,
            updated_at = CURRENT_TIMESTAMP
          `,
          [productId, normalizedOverride],
          (err) => {
            if (err) reject(err);
            else resolve();
          }
        );
      });

      await refreshProductTables();

      return {
        success: true,
        prodId: productId,
        csSpreadOverrideBp: normalizedOverride,
      };
    } catch (err) {
      console.error('[update-product-cs-spread-override] failed:', err);

      return {
        success: false,
        error: err?.message || String(err),
      };
    }
  });
};