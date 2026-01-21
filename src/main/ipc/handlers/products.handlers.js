// src/main/ipc/handlers/products.handlers.js
'use strict';

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

  const { runSQL } = dbApi;
  if (typeof runSQL !== 'function') throw new Error('[products.handlers] dbApi.runSQL missing');

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

      if (!prodIdCol || !descCol || !tickerCol) {
        throw new Error('Erforderliche Spalten (PROD_ID, DESCRIPTION, TICKER) wurden nicht vollständig zugeordnet.');
      }

      const safeCol = (col, alias) => (col ? `"${col}" AS ${alias}` : `'' AS ${alias}`);

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
          ${safeCol(startDateCol,  'START_DATE')}
        FROM "${tableName}"
        WHERE "${prodIdCol}" IS NOT NULL
      `;

      const rows = await new Promise((resolve, reject) => {
        sqliteDb.all(sql, [], (err, r) => (err ? reject(err) : resolve(r || [])));
      });

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

      const unmappedRanks = new Set();
      const unmappedProdIds = new Map();
      let insertedCount = 0;

      const formatDate = (val) => {
        if (!val) return '';
        if (typeof val === 'string' && /^\d{2}\.\d{2}\.\d{4}$/.test(val)) {
          const [d, m, y] = val.split('.');
          return `${y}-${m}-${d}`;
        }
        if (val instanceof Date) return val.toISOString().split('T')[0];
        return val;
      };

      for (const row of rows) {
        const { PROD_ID, TICKER } = row;

        const matchedIssuer = await new Promise((resolve, reject) => {
          sqliteDb.get(
            `SELECT ISSUER FROM Issuer WHERE TICKER = ?`,
            [TICKER],
            (err, res) => (err ? reject(err) : resolve(res?.ISSUER || null))
          );
        });

        row.MATURITY = formatDate(row.MATURITY);
        row.START_DATE = formatDate(row.START_DATE);

        if (typeof row.COUPON === 'string') row.COUPON = parseFloat(row.COUPON.replace(',', '.'));
        if (typeof row.COUPON === 'number') row.COUPON = row.COUPON / 100;

        const rawRank = row.RANK?.toLowerCase().trim() || '';
        const normalizedRank = rankMapping[rawRank] || null;

        if (!normalizedRank && rawRank) {
          unmappedRanks.add(rawRank);
          if (!unmappedProdIds.has(rawRank)) unmappedProdIds.set(rawRank, []);
          unmappedProdIds.get(rawRank).push(PROD_ID);
        }

        row.DESCRIPTION = row.DESCRIPTION ?? '';
        row.MATURITY = row.MATURITY ?? '';
        row.START_DATE = row.START_DATE ?? '';
        row.COUPON = row.COUPON ?? '';
        row.TICKER = row.TICKER ?? '';
        row.RATING_PROD =
          (row.RATING_PROD === undefined || row.RATING_PROD === null || row.RATING_PROD === 'Product_Rating')
            ? ''
            : row.RATING_PROD;
        row.TENOR = row.TENOR ?? '';

        const exists = await new Promise((resolve, reject) => {
          sqliteDb.get(
            `SELECT 1 FROM ProdAll WHERE PROD_ID = ?`,
            [PROD_ID],
            (err, found) => (err ? reject(err) : resolve(!!found))
          );
        });

        if (!exists) {
          const insertSQL = `
            INSERT INTO ProdAll
            ("INCLUDE","PROD_ID","DESCRIPTION","ISSUER","MATURITY","START_DATE","COUPON","RANK","TICKER","RATING_PROD","TENOR","CouponType")
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `;

          await runSQL(insertSQL, [
            1,
            PROD_ID || '',
            row.DESCRIPTION,
            matchedIssuer || '',
            row.MATURITY,
            row.START_DATE,
            row.COUPON,
            normalizedRank,
            row.TICKER,
            row.RATING_PROD,
            row.TENOR,
            'FIX',
          ]);

          insertedCount++;
        }
      }

      if (insertedCount > 0) refreshTable('ProdAll');

      if (unmappedRanks.size > 0) {
        const details = Array.from(unmappedProdIds.entries())
          .map(([rank, prodIds]) => `❓ "${rank}" → ${prodIds.join(', ')}`)
          .join('\n');

        event.sender.send(
          'show-rank-warning',
          `⚠️ Unbekannte RANK-Werte erkannt!\nDiese Produkte wurden mit leerem RANK importiert:\n\n${details}`
        );
      }

      return { success: true, insertedCount };
    } catch (err) {
      console.error('❌ Fehler beim Einfügen der Produkte:', err);
      return { success: false, error: err?.message || String(err) };
    }
  });
};
