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

        resolve();
      });
    });
  });
}

module.exports = {
  ensureAppSchema,
};