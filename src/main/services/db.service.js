// src/main/services/db.service.js
'use strict';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

const { getDatabasePath } = require('../main.path');
const { logger } = require('../utils/logger');

let _db = null;
let _logFilePath = null;

function isDevelopmentEnvironment() {
  const env = (process.env.NODE_ENV || '').trim().toLowerCase();
  return env === 'development' || env === 'thomasdev' || env === 'productiontest';
}

function setLogFilePath(p) {
  _logFilePath = p;
}

function logToFile(message) {
  if (!_logFilePath) return;

  try {
    fs.appendFileSync(_logFilePath, `${new Date().toISOString()}: ${message}\n`);
  } catch {}
}

function resolveDbPath() {
  if (isDevelopmentEnvironment()) {
    return getDatabasePath();
  }

  return path.join(process.resourcesPath, 'app.asar.unpacked', 'files', 'UNI.db');
}

function initDb() {
  if (_db) return _db;

  const dbPath = resolveDbPath();

  logToFile(`db.service: dbPath: ${dbPath}`);
  logger.info('DB', `expected path: ${dbPath}`);

  if (!fs.existsSync(dbPath)) {
    const msg = `DATABASE NOT FOUND at path: ${dbPath}`;
    logToFile(msg);
    logger.error('DB', msg);
    throw new Error(msg);
  }

  _db = new sqlite3.Database(
    dbPath,
    sqlite3.OPEN_READWRITE,
    (err) => {
      if (err) {
        logToFile(`Database connection error: ${err.message}`);
        logger.error('DB', 'connection error', err);
      } else {
        logToFile('Connected to the database.');
        logger.info('DB', 'connected');
      }
    }
  );

  return _db;
}

function getDb() {
  if (!_db) throw new Error('[db.service] DB not initialized. Call initDb() first.');
  return _db;
}

function getAllTableNames(callback) {
  const db = getDb();

  const query = `
    SELECT name
    FROM sqlite_master
    WHERE type IN ('table','view')
  `;

  db.all(query, (err, rows) => {
    if (err) {
      logger.error('DB', 'getAllTableNames failed', err);
      callback(err, null);
      return;
    }

    const tableNames = rows.map(row => row.name);
    callback(null, tableNames);
  });
}

function queryDB(tableName, callback) {
  const db = getDb();
  const query = `SELECT * FROM ${tableName}`;

  db.all(query, (err, rows) => {
    if (err) {
      logger.error('DB', `queryDB failed for ${tableName}`, err);
      callback(err, null);
      return;
    }

    setTimeout(() => callback(null, rows), 10);
  });
}

function updateRecord(tableName, rowIndex, newData, uniqueIdentifier, callback) {
  const db = getDb();

  const cleanData = Object.fromEntries(
    Object.entries(newData).filter(([key]) => !key.startsWith('__'))
  );

  const columnNames = Object.keys(cleanData);

  const setClause = columnNames
    .map(columnName => `${columnName} = ?`)
    .join(', ');

  const setValues = columnNames.map(c => cleanData[c]);

  let whereClause;
  let whereValues;

  if (uniqueIdentifier && uniqueIdentifier.composite) {
    const cols = uniqueIdentifier.columns;

    whereClause = Object.keys(cols)
      .map(k => `${k} = ?`)
      .join(' AND ');

    whereValues = Object.values(cols);
  } else {
    whereClause = `${uniqueIdentifier.column} = ?`;
    whereValues = [uniqueIdentifier.value];
  }

  const query = `
    UPDATE ${tableName}
    SET ${setClause}
    WHERE ${whereClause}
  `;

  const params = [...setValues, ...whereValues];

  db.run(query, params, (err) => {
    if (err) {
      logger.error('DB', `updateRecord failed for ${tableName}`, err);
      callback(err);
      return;
    }

    logger.debug('DB', `updateRecord ok for ${tableName}`);
    callback(null);
  });
}

function eraseRowFromDB(tableName, uniqueIdentifier) {
  const db = getDb();

  logger.debug('DB', `erase row from ${tableName}`);

  return new Promise((resolve, reject) => {
    const query = `DELETE FROM ${tableName} WHERE ${uniqueIdentifier.column} = ?`;

    db.run(query, [uniqueIdentifier.value], function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
}
//------------------------
//----PRDUCT_EVENTS delete
//-------------------------
async function syncProductScheduleToProductEvents(productId) {
  if (!productId) return;

  await runSQL(
    `
      DELETE FROM "PRODUCT_STRUCTURE"
      WHERE "product_id" = ?
        AND (
          "source_table" = 'ProdCouponSchedules'
          OR "source_id" LIKE 'COUPON_%'
          OR "source_id" LIKE 'CALL_%'
          OR "source_id" LIKE 'ZERO_%'
        )
    `,
    [productId]
  );

  await runSQL(
    `
      INSERT INTO "PRODUCT_STRUCTURE" (
        "product_id", "leg_id", "structure_type", "structure_date",
        "structure_payload", "notional_factor", "sort_order",
        "is_active", "source_table", "source_id"
      )
      SELECT
        s."PROD_ID",
        1,
        'FIXED_COUPON',
        s."DATE",
        json_object(
          'rate', COALESCE(s."FIX_CF", 0),
          'notional_factor', COALESCE(s."Notional_Factor", 1)
        ),
        COALESCE(s."Notional_Factor", 1),
        ROW_NUMBER() OVER (ORDER BY s."DATE"),
        1,
        'ProdCouponSchedules',
        'COUPON_' || s.rowid
      FROM "ProdCouponSchedules" s
      WHERE s."PROD_ID" = ?
        AND s."FIX_CF" IS NOT NULL
    `,
    [productId]
  );

  await runSQL(
    `
      INSERT INTO "PRODUCT_STRUCTURE" (
        "product_id", "leg_id", "structure_type", "structure_date",
        "structure_payload", "notional_factor", "sort_order",
        "is_active", "source_table", "source_id"
      )
      SELECT
        s."PROD_ID",
        1,
        'CALL',
        s."DATE",
        json_object(
          'call_price', 100,
          'notional_factor', COALESCE(s."Notional_Factor", 1)
        ),
        COALESCE(s."Notional_Factor", 1),
        10000 + ROW_NUMBER() OVER (ORDER BY s."DATE"),
        1,
        'ProdCouponSchedules',
        'CALL_' || s.rowid
      FROM "ProdCouponSchedules" s
      WHERE s."PROD_ID" = ?
        AND COALESCE(s."CALL", 0) = 1
    `,
    [productId]
  );

  await runSQL(
    `
      INSERT INTO "PRODUCT_STRUCTURE" (
        "product_id", "leg_id", "structure_type", "structure_date",
        "structure_payload", "notional_factor", "sort_order",
        "is_active", "source_table", "source_id"
      )
      SELECT
        s."PROD_ID",
        1,
        'ZERO',
        s."DATE",
        json_object(
          'notional_factor', COALESCE(s."Notional_Factor", 1)
        ),
        COALESCE(s."Notional_Factor", 1),
        20000 + ROW_NUMBER() OVER (ORDER BY s."DATE"),
        1,
        'ProdCouponSchedules',
        'ZERO_' || s.rowid
      FROM "ProdCouponSchedules" s
      WHERE s."PROD_ID" = ?
        AND COALESCE(s."ZERO", 0) = 1
    `,
    [productId]
  );
}

async function eraseCouponScheduleAndSync(uniqueIdentifier) {
  const rows = await selectAll(
    `
      SELECT "PROD_ID"
      FROM "ProdCouponSchedules"
      WHERE "${uniqueIdentifier.column}" = ?
      LIMIT 1
    `,
    [uniqueIdentifier.value]
  );

  const productId = rows?.[0]?.PROD_ID;

  await eraseRowFromDB('ProdCouponSchedules', uniqueIdentifier);

  if (productId) {
    await syncProductScheduleToProductEvents(productId);
  }
}

function closeDatabase() {
  if (!_db) return;

  _db.close((err) => {
    if (err) logger.error('DB', 'close failed', err);
    else logger.info('DB', 'connection closed');
  });

  _db = null;
}

function runSQL(sql, params = []) {
  const db = getDb();

  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

async function getAllRowsFromTable(tableName) {
  const db = getDb();

  return new Promise((resolve, reject) => {
    db.all(`SELECT * FROM ${tableName}`, [], (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function insertRowInTable(rowObj, tableName, cb) {
  try {
    const db = getDb();
    if (!db) return cb?.(new Error('DB not initialized'));

    const cleanTable = String(tableName || '').trim();
    if (!cleanTable) return cb?.(new Error('tableName missing'));

    if (!rowObj || typeof rowObj !== 'object') {
      return cb?.(new Error('rowObj missing/invalid'));
    }

    const keys = Object.keys(rowObj);
    if (keys.length === 0) return cb?.(new Error('rowObj empty'));

    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => rowObj[k]);

    const sql = `INSERT INTO "${cleanTable}" (${cols}) VALUES (${placeholders})`;

    db.run(sql, values, function (err) {
      if (err) return cb?.(err);
      cb?.(null, this.lastID);
    });
  } catch (e) {
    cb?.(e);
  }
}

function insertSelection(port_name, selectedTradeIDs = []) {
  const db = getDb();

  return new Promise((resolve, reject) => {
    const port = String(port_name || '').trim();
    if (!port) return reject(new Error('port_name missing'));

    const ids = Array.isArray(selectedTradeIDs) ? selectedTradeIDs : [];
    if (ids.length === 0) return resolve();

    db.all(`PRAGMA table_info("DealsMain")`, [], (err, cols) => {
      if (err) return reject(err);

      const colNames = (cols || []).map(c => c.name);

      const copyCols = colNames.filter(c =>
        c !== 'TRADE_ID' &&
        c !== 'port_name' &&
        c !== 'INCLUDE'
      );

      const insertCols = ['port_name', 'INCLUDE', ...copyCols];

      const selectCols = [
        '? as port_name',
        '1 as INCLUDE',
        ...copyCols.map(c => `"${c}"`),
      ];

      const placeholders = ids.map(() => '?').join(', ');

      const sql = `
        INSERT INTO "DealsMain" (${insertCols.map(c => `"${c}"`).join(', ')})
        SELECT ${selectCols.join(', ')}
        FROM "DealsMain"
        WHERE "TRADE_ID" IN (${placeholders})
      `;

      db.run(`DELETE FROM "DealsMain" WHERE "port_name" = ?`, [port], function (delErr) {
        if (delErr) return reject(delErr);

        db.run(sql, [port, ...ids], function (insErr) {
          if (insErr) return reject(insErr);
          resolve();
        });
      });
    });
  });
}

function deleteTable(tableName) {
  const db = getDb();
  const t = String(tableName || '').trim();

  if (!t) return Promise.reject(new Error('tableName missing'));

  if (!/^[A-Za-z0-9_]+$/.test(t)) {
    return Promise.reject(new Error('invalid tableName'));
  }

  return new Promise((resolve, reject) => {
    db.run(`DROP TABLE IF EXISTS "${t}"`, [], function (err) {
      if (err) reject(err);
      else resolve();
    });
  });
}

function updateCustomerTexts(sqliteDb, customer_id, pdf_header, pdf_footer) {
  const db = getDb();

  const id = customer_id;
  if (id == null) return Promise.reject(new Error('customer_id missing'));

  const sets = [];
  const params = [];

  if (pdf_header !== undefined) {
    sets.push('pdf_header = ?');
    params.push(pdf_header);
  }

  if (pdf_footer !== undefined) {
    sets.push('pdf_footer = ?');
    params.push(pdf_footer);
  }

  if (sets.length === 0) return Promise.resolve();

  params.push(id);

  const sql = `UPDATE Customer SET ${sets.join(', ')} WHERE customer_id = ?`;

  return new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      if (err) reject(err);
      else resolve(this);
    });
  });
}

function selectAll(sql, params = []) {
  const db = getDb();

  return new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows || []);
    });
  });
}

function insertCSParameter(newRowData, cleanTableName, cb) {
  try {
    if (!cleanTableName || typeof cleanTableName !== 'string') {
      return cb?.(new Error('cleanTableName missing/invalid'));
    }

    if (!newRowData || typeof newRowData !== 'object') {
      return cb?.(new Error('newRowData missing/invalid'));
    }

    const db = getDb();
    if (!db) return cb?.(new Error('DB not initialized'));

    const keys = Object.keys(newRowData);
    if (keys.length === 0) return cb?.(new Error('newRowData has no columns'));

    const cols = keys.map(k => `"${k}"`).join(', ');
    const placeholders = keys.map(() => '?').join(', ');
    const values = keys.map(k => newRowData[k]);

    const sql = `INSERT INTO "${cleanTableName}" (${cols}) VALUES (${placeholders})`;

    db.run(sql, values, function (err) {
      if (err) return cb?.(err);
      cb?.(null, { ok: true, changes: this.changes, lastID: this.lastID });
    });
  } catch (e) {
    cb?.(e);
  }
}


module.exports = {
  initDb,
  getDb,
  setLogFilePath,

  getAllTableNames,
  queryDB,
  updateRecord,
  eraseRowFromDB,
  closeDatabase,
  runSQL,
  getAllRowsFromTable,
  insertRowInTable,
  insertSelection,
  deleteTable,
  updateCustomerTexts,
  selectAll,
  insertCSParameter,
  eraseCouponScheduleAndSync,
  syncProductScheduleToProductEvents,
};