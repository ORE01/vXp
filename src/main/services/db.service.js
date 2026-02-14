// src/main/services/db.service.js
'use strict';

const fs = require('fs');
const path = require('path');
const sqlite3 = require('sqlite3').verbose();

// NICHT electron importieren!
// aber app.getPath('userData') brauchst du für logfile -> das darf NICHT in service.
// Lösung: logfile in index.js oder wir machen fallback.

const { getDatabasePath } = require('../main_path');

let _db = null;
let _logFilePath = null;

function isDevelopmentEnvironment() {
  const env = (process.env.NODE_ENV || '').trim().toLowerCase();
  return env === 'development' || env === 'thomasdev' || env === 'productiontest';
}


/**
 * Optional: Set log file path from outside (index.js), because app.getPath needs electron.app
 */
function setLogFilePath(p) {
  _logFilePath = p;
}

function logToFile(message) {
  if (!_logFilePath) return; // wenn nicht gesetzt, einfach nicht loggen
  try {
    fs.appendFileSync(_logFilePath, new Date().toISOString() + ': ' + message + '\n');
  } catch {}
}

function resolveDbPath() {
  if (isDevelopmentEnvironment()) {
    const p = getDatabasePath(); // ✅ dein dev path
    return p;
  }
  // PROD: genau dein packaged path
  return path.join(process.resourcesPath, 'app.asar.unpacked', 'files', 'UNI.db');
}

function initDb() {
  if (_db) return _db;

  const dbPath = resolveDbPath();
  logToFile('db.service: dbPath: ' + dbPath);

  _db = new sqlite3.Database(dbPath, (err) => {
    if (err) {
      logToFile('Database connection error: ' + err.message);
      console.error(err.message);
    } else {
      logToFile('Connected to the database.');
      console.log('Connected to database! READY to ROCK and ROLL');
    }
  });

  return _db;
}

function getDb() {
  if (!_db) throw new Error('[db.service] DB not initialized. Call initDb() first.');
  return _db;
}

// ============= DB FUNCTIONS (dein Code, nur via getDb) =============

function getAllTableNames(callback) {
  const db = getDb();
  const query = "SELECT name FROM sqlite_master WHERE type='table'";
  db.all(query, (err, rows) => {
    if (err) {
      console.error(err.message);
      callback(err, null);
    } else {
      const tableNames = rows.map(row => row.name);
      callback(null, tableNames);
    }
  });
}

function queryDB(tableName, callback) {
  const db = getDb();
  const query = `SELECT * FROM ${tableName}`;
  db.all(query, (err, rows) => {
    if (err) {
      console.error(err.message);
      callback(err, null);
    } else {
      setTimeout(() => callback(null, rows), 10);
    }
  });
}

function updateRecord(tableName, rowIndex, newData, uniqueIdentifier, callback) {
  const db = getDb();

  const columnNames = Object.keys(newData);
  const setClause = columnNames
    .map(columnName => `${columnName} = '${newData[columnName]}'`)
    .join(', ');

  const query = `
    UPDATE ${tableName}
    SET ${setClause}
    WHERE ${uniqueIdentifier.column} = '${uniqueIdentifier.value}'`;

  db.run(query, (err) => {
    if (err) {
      console.error(err.message);
      callback(err);
    } else {
      console.log('db.service: updateRecord.');
      callback(null);
    }
  });
}

function eraseRowFromDB(tableName, uniqueIdentifier) {
  const db = getDb();
  console.log('row erased from:', tableName);

  return new Promise((resolve, reject) => {
    const query = `DELETE FROM ${tableName} WHERE ${uniqueIdentifier.column} = ?`;
    db.run(query, [uniqueIdentifier.value], function (error) {
      if (error) reject(error);
      else resolve();
    });
  });
}

function closeDatabase() {
  if (!_db) return;
  _db.close((err) => {
    if (err) console.error(err.message);
    else console.log('Database connection closed.');
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
    const db = getDb(); // oder wie du intern an dein sqlite handle kommst
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
    if (ids.length === 0) return resolve(); // bewusst erlaubt (dein Handler)

    // 1) Spalten holen
    db.all(`PRAGMA table_info("DealsMain")`, [], (err, cols) => {
      if (err) return reject(err);

      const colNames = (cols || []).map(c => c.name);

      // TRADE_ID nicht kopieren (sonst UNIQUE fail)
      // port_name und INCLUDE überschreiben wir gezielt
      const copyCols = colNames.filter(c =>
        c !== 'TRADE_ID' &&
        c !== 'port_name' &&
        c !== 'INCLUDE'
      );

      // Ziel-Spalten: port_name, INCLUDE, + alle kopierbaren Spalten
      const insertCols = ['port_name', 'INCLUDE', ...copyCols];

      // SELECT-Teil: port_name als Parameter, INCLUDE=1 fix, + Spalten aus Quelle
      const selectCols = [
        '? as port_name',
        '1 as INCLUDE',
        ...copyCols.map(c => `"${c}"`)
      ];

      const placeholders = ids.map(() => '?').join(', ');

      const sql = `
        INSERT INTO "DealsMain" (${insertCols.map(c => `"${c}"`).join(', ')})
        SELECT ${selectCols.join(', ')}
        FROM "DealsMain"
        WHERE "TRADE_ID" IN (${placeholders})
      `;

      // 2) Ziel zuerst löschen (overwrite)
      db.run(`DELETE FROM "DealsMain" WHERE "port_name" = ?`, [port], function (delErr) {
        if (delErr) return reject(delErr);

        // 3) Copy-Insert
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

  // defensiv: nur simple table names erlauben
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
  // sqliteDb Parameter ignorieren wir bewusst – Service benutzt getDb().
  // Wir behalten ihn aber in der Signatur, damit dein bestehender Call kompatibel bleibt.
  const db = getDb();

  const id = customer_id;
  if (id == null) return Promise.reject(new Error('customer_id missing'));

  // Dynamisch nur die Felder updaten, die gesetzt wurden (wie dein Payload-Pattern)
  const sets = [];
  const params = [];

  if (pdf_header !== undefined) { sets.push('pdf_header = ?'); params.push(pdf_header); }
  if (pdf_footer !== undefined) { sets.push('pdf_footer = ?'); params.push(pdf_footer); }

  if (sets.length === 0) return Promise.resolve(); // nichts zu tun

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

    const db = getDb(); // so wie du es im service bereits machst
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
  // init + logging
  initDb,
  getDb,
  setLogFilePath,

  // db functions
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






};
