// src/main/services/tableLayout.service.js
'use strict';

// -----------------------------------
// V1 (bestehend)
// -----------------------------------

function getTableLayout(db, tableId) {
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

        if (!row || !row.layout_json) {
          resolve(null);
          return;
        }

        try {
          resolve(JSON.parse(row.layout_json));
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });
}

function saveTableLayout(db, tableId, layout) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        INSERT OR REPLACE INTO table_layouts
        (table_id, layout_json, updated_at)
        VALUES (?, ?, datetime('now'))
      `,
      [tableId, JSON.stringify(layout)],
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({ ok: true });
      }
    );
  });
}

// -----------------------------------
// V2 (multi-layout)
// -----------------------------------

function getTableLayoutV2(db, tableId, layoutName) {
  return new Promise((resolve, reject) => {
    db.get(
      `
        SELECT layout_json
        FROM table_layouts_v2
        WHERE table_id = ? AND layout_name = ?
      `,
      [tableId, layoutName],
      (err, row) => {
        if (err) {
          reject(err);
          return;
        }

        if (!row || !row.layout_json) {
          resolve(null);
          return;
        }

        try {
          resolve(JSON.parse(row.layout_json));
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });
}

function saveTableLayoutV2(db, tableId, layoutName, layout) {
  return new Promise((resolve, reject) => {
    db.run(
      `
        INSERT OR REPLACE INTO table_layouts_v2
        (table_id, layout_name, layout_json, updated_at)
        VALUES (?, ?, ?, datetime('now'))
      `,
      [tableId, layoutName, JSON.stringify(layout)],
      (err) => {
        if (err) {
          reject(err);
          return;
        }

        resolve({ ok: true });
      }
    );
  });
}

function getTableLayoutsV2(db, tableId) {
  return new Promise((resolve, reject) => {
    db.all(
      `
        SELECT layout_name, layout_json
        FROM table_layouts_v2
        WHERE table_id = ?
        ORDER BY layout_name
      `,
      [tableId],
      (err, rows) => {
        if (err) {
          reject(err);
          return;
        }

        try {
          const result = (rows || []).map((row) => ({
            layoutName: row.layout_name,
            layout: row.layout_json ? JSON.parse(row.layout_json) : null,
          }));

          resolve(result);
        } catch (parseError) {
          reject(parseError);
        }
      }
    );
  });
}

module.exports = {
  // V1
  getTableLayout,
  saveTableLayout,

  // V2
  getTableLayoutV2,
  saveTableLayoutV2,
  getTableLayoutsV2,
};