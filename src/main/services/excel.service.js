// src/main/services/excel.service.js
'use strict';

const fs = require('fs');
const XLSX = require('xlsx');

const dbService = require('./db.service');
const { formatDate } = require('../utils/main_format');

/**
 * Import Excel → SQLite (uses existing sqlite connection from db.service)
 */
async function importExcelToSQLite(
  excelPath,
  sheetName,
  tableName,
  deleteCondition = null,
  allowedColumns = null,
  overwriteExisting = false
) {
  const db = dbService.getDb();

  if (!fs.existsSync(excelPath)) {
    throw new Error('Excel-Datei nicht gefunden: ' + excelPath);
  }

  const workbook = XLSX.readFile(excelPath);
  if (!workbook.SheetNames.includes(sheetName)) {
    throw new Error(`Sheet "${sheetName}" wurde nicht gefunden.`);
  }

  const worksheet = workbook.Sheets[sheetName];
  let data = XLSX.utils.sheet_to_json(worksheet);

  // Fehlende Spalten durch NaN ergänzen
  data = data.map(row => {
    allowedColumns?.forEach(col => {
      if (!(col in row) || row[col] === '') row[col] = NaN;
    });
    return row;
  });

  if (data.length === 0) {
    throw new Error(`Keine Daten in Sheet "${sheetName}".`);
  }

  // Date formatting / normalization
  data = data.map(row => formatDate(row, allowedColumns));

  if (data.length === 0) {
    throw new Error(`Nach dem Filtern keine gültigen Daten mehr in Sheet "${sheetName}".`);
  }

  const columns = Object.keys(data[0]);
  const placeholders = columns.map(() => '?').join(',');
  const insertSQL =
    `INSERT INTO "${tableName}" (${columns.map(col => `"${col}"`).join(',')}) VALUES (${placeholders})`;

  return new Promise((resolve, reject) => {
    db.serialize(() => {
      // Tabelle prüfen und ggf. erstellen
      db.get(
        `SELECT name FROM sqlite_master WHERE type='table' AND name=?`,
        [tableName],
        (err, row) => {
          if (err) return reject(err);

          if (!row) {
            const createSQL =
              `CREATE TABLE IF NOT EXISTS "${tableName}" (${columns.map(col => `"${col}" TEXT`).join(',')})`;

            db.run(createSQL, (err2) => {
              if (err2) return reject(err2);
              proceed();
            });
          } else {
            proceed();
          }
        }
      );

      function proceed() {
        if (deleteCondition) {
          const deleteSQL = `DELETE FROM ${tableName} WHERE ${deleteCondition}`;
          db.run(deleteSQL, function (err) {
            if (err) return reject(err);
            startInsert();
          });
        } else {
          startInsert();
        }
      }

      function startInsert() {
        if (overwriteExisting) {
          // Overwrite: per PROD_ID delete then insert
          data.forEach((row, index) => {
            const prodId = row['PROD_ID'];

            if (prodId) {
              db.run(`DELETE FROM ${tableName} WHERE PROD_ID = ?`, [prodId], function (deleteErr) {
                if (deleteErr) {
                  console.error(`❌ Fehler beim Löschen (PROD_ID: ${prodId}):`, deleteErr.message);
                  return;
                }
                db.run(insertSQL, columns.map(col => row[col]), function (insertErr) {
                  if (insertErr) {
                    console.error(`❌ Fehler beim Einfügen (PROD_ID: ${prodId}):`, insertErr.message);
                  }
                });
              });
            } else {
              console.warn(`⚠️ Zeile ${index + 1} hat keine PROD_ID – wird übersprungen.`);
            }
          });

          resolve();
        } else {
          const stmt = db.prepare(insertSQL);

          data.forEach((row, index) => {
            const values = columns.map(col => row[col]);
            stmt.run(values, function (err) {
              if (err) {
                console.error(`❌ Fehler beim Einfügen (Zeile ${index + 1}):`, err.message);
              }
            });
          });

          stmt.finalize(err => {
            if (err) return reject(err);
            resolve();
          });
        }
      }
    });
  });
}

module.exports = { importExcelToSQLite };
