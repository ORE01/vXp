// src/main/services/db.schema.js
'use strict';

function ensureAppSchema(db) {
  return new Promise((resolve, reject) => {
    db.serialize(() => {
      db.run(`
        CREATE TABLE IF NOT EXISTS table_layouts (
          table_id TEXT PRIMARY KEY,
          layout_json TEXT NOT NULL,
          updated_at TEXT NOT NULL
        )
      `, (err) => {
        if (err) {
          reject(err);
          return;
        }

        db.run(`
          CREATE TABLE IF NOT EXISTS table_layouts_v2 (
            table_id TEXT NOT NULL,
            layout_name TEXT NOT NULL,
            layout_json TEXT NOT NULL,
            updated_at TEXT NOT NULL,
            PRIMARY KEY (table_id, layout_name)
          )
        `, (err2) => {
          if (err2) {
            reject(err2);
            return;
          }

          resolve();
        });
      });
    });
  });
}

module.exports = {
  ensureAppSchema,
};