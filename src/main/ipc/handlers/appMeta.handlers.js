'use strict';

// AppMeta: kleine Key-Value-Tabelle fuer App-weite Zeitstempel (z. B. wann die
// Portfolio-Daten aus Excel importiert und wann zuletzt gerechnet wurde). Reine
// Metadaten fuer die Overview-Anzeige — KEINE Produkt-/Rechenlogik.

const { getDb } = require('../../services/db.service');

let _ensured = false;
function ensureTable(db) {
  if (_ensured) return;
  db.prepare(`CREATE TABLE IF NOT EXISTS AppMeta (
    key   TEXT PRIMARY KEY,
    value TEXT
  )`).run();
  _ensured = true;
}

// Zeitstempel setzen (im Main-Prozess direkt aufrufbar, nicht nur per IPC).
function setMeta(key, value) {
  try {
    const db = getDb();
    ensureTable(db);
    db.prepare(`INSERT INTO AppMeta (key, value) VALUES (?, ?)
                ON CONFLICT(key) DO UPDATE SET value = excluded.value`)
      .run(String(key), value == null ? null : String(value));
  } catch (e) {
    console.warn('[appMeta] setMeta failed', key, e?.message || e);
  }
}

function getAllMeta() {
  try {
    const db = getDb();
    ensureTable(db);
    const rows = db.prepare('SELECT key, value FROM AppMeta').all();
    const out = {};
    for (const r of rows) out[r.key] = r.value;
    return out;
  } catch (e) {
    console.warn('[appMeta] getAllMeta failed', e?.message || e);
    return {};
  }
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
