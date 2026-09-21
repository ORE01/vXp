'use strict';

// AppMeta: kleine Key-Value-Tabelle fuer App-weite Zeitstempel (z. B. wann die
// Portfolio-Daten aus Excel importiert und wann zuletzt gerechnet wurde). Reine
// Metadaten fuer die Overview-Anzeige — KEINE Produkt-/Rechenlogik.

const { getDb } = require('../../services/db.service');

// WICHTIG: Die DB ist node-sqlite3 (async, callback-basiert) — NICHT better-sqlite3.
// Daher ausschliesslich db.run(sql, params, cb) / db.all(sql, params, cb) verwenden.
let _ensured = false;
function ensureTable(db, cb) {
  if (_ensured) { cb && cb(); return; }
  db.run(
    `CREATE TABLE IF NOT EXISTS AppMeta (key TEXT PRIMARY KEY, value TEXT)`,
    (err) => {
      if (!err) _ensured = true;
      cb && cb(err);
    }
  );
}

// Zeitstempel setzen (im Main-Prozess direkt aufrufbar, nicht nur per IPC).
function setMeta(key, value) {
  try {
    const db = getDb();
    ensureTable(db, (err) => {
      if (err) { console.warn('[appMeta] setMeta ensure failed', key, err?.message || err); return; }
      db.run(
        `INSERT INTO AppMeta (key, value) VALUES (?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value`,
        [String(key), value == null ? null : String(value)],
        (e) => { if (e) console.warn('[appMeta] setMeta failed', key, e?.message || e); }
      );
    });
  } catch (e) {
    console.warn('[appMeta] setMeta failed', key, e?.message || e);
  }
}

function getAllMeta() {
  return new Promise((resolve) => {
    try {
      const db = getDb();
      ensureTable(db, (err) => {
        if (err) { console.warn('[appMeta] getAllMeta ensure failed', err?.message || err); resolve({}); return; }
        db.all('SELECT key, value FROM AppMeta', [], (e, rows) => {
          if (e) { console.warn('[appMeta] getAllMeta failed', e?.message || e); resolve({}); return; }
          const out = {};
          for (const r of (rows || [])) out[r.key] = r.value;
          resolve(out);
        });
      });
    } catch (e) {
      console.warn('[appMeta] getAllMeta failed', e?.message || e);
      resolve({});
    }
  });
}

function register(ctx = {}) {
  const ipcMain = ctx.ipcMain;
  if (!ipcMain) { console.warn('[appMeta] ipcMain missing'); return; }

  ipcMain.handle('meta:get', () => getAllMeta());
}

// setMeta fuer den Main-Prozess mit-exportieren (python.handlers nutzt es direkt).
register.setMeta = setMeta;
register.getAllMeta = getAllMeta;

module.exports = register;
