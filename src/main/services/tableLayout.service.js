// src/main/services/tableLayout.service.js
'use strict';

const dbService = require('./db.service');

function getTableLayout(tableId) {
  const db = dbService.getDb();

  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT layout_json
        FROM table_layouts
        WHERE table_id = ?
      `,
      [tableId],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row) {
          resolve(null);
          return;
        }

        try {
          const layout = JSON.parse(row.layout_json);
          resolve(layout);
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });
}

function saveTableLayout(tableId, layout) {
  const db = dbService.getDb();

  return new Promise((resolve, reject) => {
    const layoutJson = JSON.stringify(layout);
    const updatedAt = new Date().toISOString();

    db.run(
      `
        INSERT INTO table_layouts (table_id, layout_json, updated_at)
        VALUES (?, ?, ?)
        ON CONFLICT(table_id) DO UPDATE SET
          layout_json = excluded.layout_json,
          updated_at = excluded.updated_at
      `,
      [tableId, layoutJson, updatedAt],
      function (err) {
        if (err) {
          reject(err);
          return;
        }

        resolve({
          ok: true,
          changes: this.changes,
        });
      }
    );
  });
}

module.exports = {
  getTableLayout,
  saveTableLayout,
};