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

          // Table actually used by the save handler + data pump
          // (src/main/ipc/handlers/tableLayout.handlers.js -> CustomerTableLayouts).
          db.run(`
            CREATE TABLE IF NOT EXISTS CustomerTableLayouts (
              table_id    TEXT NOT NULL,
              layout_name TEXT NOT NULL,
              layout_json TEXT NOT NULL,
              updated_at  TEXT NOT NULL,
              PRIMARY KEY (table_id, layout_name)
            )
          `, (err3) => {
            if (err3) {
              reject(err3);
              return;
            }

            // Customer-wide product category setup (CUSTOMER SETUP -> Category).
            // App-config table; read-only display for now (no pricing/risk use).
            db.run(`
              CREATE TABLE IF NOT EXISTS CUSTOMER_PRODUCT_CATEGORY_SETUP (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                category_name TEXT NOT NULL UNIQUE,
                category_type TEXT NOT NULL,
                is_active     INTEGER NOT NULL DEFAULT 1,
                sort_order    INTEGER,
                created_at    TEXT,
                updated_at    TEXT
              )
            `, (err4) => {
              if (err4) {
                reject(err4);
                return;
              }

              // Idempotent seed: INSERT OR IGNORE keeps the two defaults without
              // duplicating on repeated app starts (category_name is UNIQUE).
              db.run(`
                INSERT OR IGNORE INTO CUSTOMER_PRODUCT_CATEGORY_SETUP
                  (category_name, category_type, is_active, sort_order, created_at, updated_at)
                VALUES
                  ('1_Kontokorrentkonten', 'FIXED_VALUE', 1, 10, datetime('now'), datetime('now')),
                  ('5_Termineinlagen',     'FIXED_VALUE', 1, 20, datetime('now'), datetime('now'))
              `, (err5) => {
                if (err5) {
                  reject(err5);
                  return;
                }

                // Customer market-risk setup (CUSTOMER SETUP -> Risk -> Market Risk
                // -> Interval). One active row per (customer_id, setting_scope)
                // holds the default Market Risk interval code (-> MVaRInput.INTERVAL_NAME).
                // Extensible later (default_curve_scenario_set, ...). Thresholds NOT here.
                db.run(`
                  CREATE TABLE IF NOT EXISTS CustomerMarketRiskSetting (
                    id                                INTEGER PRIMARY KEY AUTOINCREMENT,
                    customer_id                       INTEGER,
                    setting_scope                     TEXT NOT NULL DEFAULT 'DEFAULT',
                    default_market_risk_interval_code TEXT,
                    risk_warning_profile              TEXT DEFAULT 'BALANCED',
                    var_days                          INTEGER DEFAULT 10,
                    confidence                        REAL DEFAULT 0.95,
                    is_active                         INTEGER NOT NULL DEFAULT 1,
                    created_at                        TEXT,
                    updated_at                        TEXT
                  )
                `, (err6) => {
                  if (err6) {
                    reject(err6);
                    return;
                  }

                  // Non-destructive migration: upgrade a pre-existing table (older
                  // schema) to the new columns. Duplicate-column errors are ignored.
                  const migrations = [
                    "ALTER TABLE CustomerMarketRiskSetting ADD COLUMN customer_id INTEGER",
                    "ALTER TABLE CustomerMarketRiskSetting ADD COLUMN setting_scope TEXT DEFAULT 'DEFAULT'",
                    "ALTER TABLE CustomerMarketRiskSetting ADD COLUMN default_market_risk_interval_code TEXT",
                    "ALTER TABLE CustomerMarketRiskSetting ADD COLUMN risk_warning_profile TEXT DEFAULT 'BALANCED'",
                    "ALTER TABLE CustomerMarketRiskSetting ADD COLUMN var_days INTEGER DEFAULT 10",
                    "ALTER TABLE CustomerMarketRiskSetting ADD COLUMN confidence REAL DEFAULT 0.95",
                    "ALTER TABLE CustomerMarketRiskSetting ADD COLUMN is_active INTEGER DEFAULT 1",
                  ];

                  let mi = 0;
                  const runNextMigration = () => {
                    if (mi >= migrations.length) {
                      // Chain into the threshold table + idempotent seed.
                      ensureMarketRiskThresholds(db, resolve, reject);
                      return;
                    }
                    const sql = migrations[mi++];
                    db.run(sql, () => runNextMigration()); // ignore duplicate-column errors
                  };

                  runNextMigration();
                });
              });
            });
          });
        });
      });
    });
  });
}

// Customer market-risk loss-tolerance thresholds per warning profile.
// Idempotent: table via CREATE IF NOT EXISTS, defaults via INSERT ... WHERE NOT
// EXISTS (no ON CONFLICT, so the NULL customer_id case is handled cleanly and no
// duplicates are created on restart).
function ensureMarketRiskThresholds(db, resolve, reject) {
  db.run(`
    CREATE TABLE IF NOT EXISTS CustomerMarketRiskThresholdSetting (
      id                   INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id          INTEGER,
      setting_scope        TEXT NOT NULL DEFAULT 'DEFAULT',
      risk_warning_profile TEXT NOT NULL,
      metric_code          TEXT NOT NULL,
      yellow_loss_limit    REAL NOT NULL,
      red_loss_limit       REAL NOT NULL,
      is_active            INTEGER NOT NULL DEFAULT 1,
      sort_order           INTEGER,
      created_at           TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at           TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (errCreate) => {
    if (errCreate) {
      reject(errCreate);
      return;
    }

    // [profile, metric_code, yellow_loss_limit, red_loss_limit, sort_order]
    const seeds = [
      ['CONSERVATIVE', 'VaR_T_rel', -0.005, -0.010, 10],
      ['CONSERVATIVE', 'ES_T_rel',  -0.007, -0.015, 20],
      ['BALANCED',     'VaR_T_rel', -0.010, -0.030, 10],
      ['BALANCED',     'ES_T_rel',  -0.015, -0.050, 20],
      ['AGGRESSIVE',   'VaR_T_rel', -0.020, -0.050, 10],
      ['AGGRESSIVE',   'ES_T_rel',  -0.030, -0.080, 20],
    ];

    const insertSql = `
      INSERT INTO CustomerMarketRiskThresholdSetting
        (customer_id, setting_scope, risk_warning_profile, metric_code,
         yellow_loss_limit, red_loss_limit, is_active, sort_order, created_at, updated_at)
      SELECT NULL, 'DEFAULT', ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1 FROM CustomerMarketRiskThresholdSetting
        WHERE setting_scope = 'DEFAULT'
          AND customer_id IS NULL
          AND risk_warning_profile = ?
          AND metric_code = ?
      )
    `;

    let si = 0;
    const runNextSeed = () => {
      if (si >= seeds.length) {
        // Chain: read-model view -> customer credit risk tables -> resolve.
        ensureMarketRiskViews(
          db,
          () => ensureCreditRiskTables(db, resolve, reject),
          reject,
        );
        return;
      }
      const [profile, metric, yellow, red, sort] = seeds[si++];
      db.run(insertSql, [profile, metric, yellow, red, sort, profile, metric], (errSeed) => {
        if (errSeed) {
          reject(errSeed);
          return;
        }
        runNextSeed();
      });
    };

    runNextSeed();
  });
}

// Read model for Risk -> Market Risk -> Model Selection. One row per MVaRInput
// interval, enriched with the customer's saved default + warning profile and the
// active profile's VaR/ES loss limits. Idempotent (DROP VIEW IF EXISTS + CREATE).
// View = read-only UI model; never written to.
function ensureMarketRiskViews(db, resolve, reject) {
  const profileExpr = `
    COALESCE((
      SELECT s.risk_warning_profile
      FROM CustomerMarketRiskSetting s
      WHERE s.setting_scope = 'DEFAULT' AND s.customer_id IS NULL AND s.is_active = 1
      LIMIT 1
    ), 'BALANCED')`;

  const thresholdExpr = (metric, field) => `
    (SELECT t.${field}
       FROM CustomerMarketRiskThresholdSetting t
      WHERE t.setting_scope = 'DEFAULT'
        AND t.customer_id IS NULL
        AND t.is_active = 1
        AND t.metric_code = '${metric}'
        AND t.risk_warning_profile = ${profileExpr}
      LIMIT 1)`;

  const createSql = `
    CREATE VIEW v_MVAR_MODEL_SELECTION_APP AS
    SELECT
      m.id                AS id,
      m.INTERVAL_NAME     AS INTERVAL_NAME,
      m."START"           AS "START",
      m."END"             AS "END",
      COALESCE((
        SELECT s.var_days
        FROM CustomerMarketRiskSetting s
        WHERE s.setting_scope = 'DEFAULT' AND s.customer_id IS NULL AND s.is_active = 1
        LIMIT 1
      ), m.VaR_Days, 10)        AS VaR_Days,
      COALESCE((
        SELECT s.confidence
        FROM CustomerMarketRiskSetting s
        WHERE s.setting_scope = 'DEFAULT' AND s.customer_id IS NULL AND s.is_active = 1
        LIMIT 1
      ), m.Confidence, 0.95)    AS Confidence,
      CASE
        WHEN m.INTERVAL_NAME = (
          SELECT s.default_market_risk_interval_code
          FROM CustomerMarketRiskSetting s
          WHERE s.setting_scope = 'DEFAULT' AND s.customer_id IS NULL AND s.is_active = 1
          LIMIT 1
        ) THEN 1 ELSE 0
      END                 AS is_customer_default,
      ${profileExpr}      AS risk_warning_profile,
      ${thresholdExpr('VaR_T_rel', 'yellow_loss_limit')} AS var_yellow_loss_limit,
      ${thresholdExpr('VaR_T_rel', 'red_loss_limit')}    AS var_red_loss_limit,
      ${thresholdExpr('ES_T_rel', 'yellow_loss_limit')}  AS es_yellow_loss_limit,
      ${thresholdExpr('ES_T_rel', 'red_loss_limit')}     AS es_red_loss_limit
    FROM MVaRInput m
  `;

  console.log('[DB SCHEMA] ensureMarketRiskViews start');

  db.run(`DROP VIEW IF EXISTS v_MVAR_MODEL_SELECTION_APP`, (errDrop) => {
    if (errDrop) {
      // Do not swallow: log loudly. Resolve so a view problem does not abort the
      // rest of schema init (the failure is clearly visible in the main log).
      console.error('[DB SCHEMA] ensureMarketRiskViews failed (DROP VIEW):', errDrop.message);
      resolve();
      return;
    }

    db.run(createSql, (errCreate) => {
      if (errCreate) {
        console.error('[DB SCHEMA] ensureMarketRiskViews failed:', errCreate.message);
        resolve();
        return;
      }

      console.log('[DB SCHEMA] v_MVAR_MODEL_SELECTION_APP created');
      resolve();
    });
  });
}

// Customer credit-risk general settings (CUSTOMER SETUP -> Risk -> Credit Risk).
// One active row per (customer_id, setting_scope). Idempotent: CREATE IF NOT
// EXISTS + non-destructive ALTER migration + seed via INSERT ... WHERE NOT EXISTS
// (no ON CONFLICT; NULL customer_id handled cleanly; no duplicates on restart).
function ensureCreditRiskTables(db, resolve, reject) {
  db.run(`
    CREATE TABLE IF NOT EXISTS CustomerCreditRiskSetting (
      id                         INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id                INTEGER,
      setting_scope              TEXT NOT NULL DEFAULT 'DEFAULT',
      default_credit_config_name TEXT,
      conf_level                 REAL DEFAULT 0.999,
      corr                       REAL DEFAULT 0.2,
      recovery_rate              REAL DEFAULT 0.4,
      horizon_days               INTEGER DEFAULT 256,
      n_simulations              INTEGER DEFAULT 10000,
      description                TEXT,
      cr_model                   TEXT DEFAULT 'ASRF',
      is_active                  INTEGER NOT NULL DEFAULT 1,
      created_at                 TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at                 TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (errCreate) => {
    if (errCreate) {
      reject(errCreate);
      return;
    }

    const migrations = [
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN customer_id INTEGER",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN setting_scope TEXT DEFAULT 'DEFAULT'",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN default_credit_config_name TEXT",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN conf_level REAL DEFAULT 0.999",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN corr REAL DEFAULT 0.2",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN recovery_rate REAL DEFAULT 0.4",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN horizon_days INTEGER DEFAULT 256",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN n_simulations INTEGER DEFAULT 10000",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN description TEXT",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN cr_model TEXT DEFAULT 'ASRF'",
      "ALTER TABLE CustomerCreditRiskSetting ADD COLUMN is_active INTEGER DEFAULT 1",
    ];

    let mi = 0;
    const runNextMigration = () => {
      if (mi >= migrations.length) {
        seedCreditRiskDefault();
        return;
      }
      db.run(migrations[mi++], () => runNextMigration()); // ignore duplicate-column errors
    };

    const seedCreditRiskDefault = () => {
      // Idempotent: insert one DEFAULT/NULL-customer row only if none exists.
      db.run(`
        INSERT INTO CustomerCreditRiskSetting
          (customer_id, setting_scope, default_credit_config_name,
           conf_level, corr, recovery_rate, horizon_days, n_simulations,
           description, cr_model, is_active, created_at, updated_at)
        SELECT NULL, 'DEFAULT', 'default',
               0.999, 0.2, 0.4, 256, 10000,
               NULL, 'MF_GC', 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        WHERE NOT EXISTS (
          SELECT 1 FROM CustomerCreditRiskSetting
          WHERE setting_scope = 'DEFAULT' AND customer_id IS NULL
        )
      `, (errSeed) => {
        if (errSeed) {
          reject(errSeed);
          return;
        }
        // Chain into the credit-risk threshold table + seed.
        ensureCreditRiskThresholds(db, resolve, reject);
      });
    };

    runNextMigration();
  });
}

// Customer credit-risk warning thresholds (CUSTOMER SETUP -> Risk -> Credit Risk
// -> Threshold Settings). One active row per (customer_id, setting_scope,
// metric_code) for CVAR / TSI / MSD. Idempotent (CREATE IF NOT EXISTS + ALTER
// migration + seed via INSERT ... WHERE NOT EXISTS; NULL customer_id handled
// cleanly; no duplicates on restart).
function ensureCreditRiskThresholds(db, resolve, reject) {
  db.run(`
    CREATE TABLE IF NOT EXISTS CustomerCreditRiskThresholdSetting (
      id               INTEGER PRIMARY KEY AUTOINCREMENT,
      customer_id      INTEGER,
      setting_scope    TEXT NOT NULL DEFAULT 'DEFAULT',
      metric_code      TEXT NOT NULL,
      yellow_threshold REAL NOT NULL,
      red_threshold    REAL NOT NULL,
      description      TEXT,
      is_active        INTEGER NOT NULL DEFAULT 1,
      sort_order       INTEGER,
      created_at       TEXT DEFAULT CURRENT_TIMESTAMP,
      updated_at       TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `, (errCreate) => {
    if (errCreate) {
      reject(errCreate);
      return;
    }

    const migrations = [
      "ALTER TABLE CustomerCreditRiskThresholdSetting ADD COLUMN customer_id INTEGER",
      "ALTER TABLE CustomerCreditRiskThresholdSetting ADD COLUMN setting_scope TEXT DEFAULT 'DEFAULT'",
      "ALTER TABLE CustomerCreditRiskThresholdSetting ADD COLUMN description TEXT",
      "ALTER TABLE CustomerCreditRiskThresholdSetting ADD COLUMN is_active INTEGER DEFAULT 1",
      "ALTER TABLE CustomerCreditRiskThresholdSetting ADD COLUMN sort_order INTEGER",
    ];

    // [metric_code, yellow_threshold, red_threshold, description, sort_order]
    const seeds = [
      ['CVAR', -0.050, -0.052, 'Historic VaR%', 10],
      ['TSI', 0.010, 0.014, 'Historic ES - Historic VaR', 20],
      ['MSD', 0.010, 0.030, 'Adjusted ES - Historic ES', 30],
    ];

    const insertSql = `
      INSERT INTO CustomerCreditRiskThresholdSetting
        (customer_id, setting_scope, metric_code, yellow_threshold, red_threshold,
         description, is_active, sort_order, created_at, updated_at)
      SELECT NULL, 'DEFAULT', ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      WHERE NOT EXISTS (
        SELECT 1 FROM CustomerCreditRiskThresholdSetting
        WHERE setting_scope = 'DEFAULT' AND customer_id IS NULL AND metric_code = ?
      )
    `;

    let mi = 0;
    const runNextMigration = () => {
      if (mi >= migrations.length) {
        runNextSeed();
        return;
      }
      db.run(migrations[mi++], () => runNextMigration()); // ignore duplicate-column errors
    };

    let si = 0;
    const runNextSeed = () => {
      if (si >= seeds.length) {
        resolve();
        return;
      }
      const [metric, yellow, red, desc, sort] = seeds[si++];
      db.run(insertSql, [metric, yellow, red, desc, sort, metric], (errSeed) => {
        if (errSeed) {
          reject(errSeed);
          return;
        }
        runNextSeed();
      });
    };

    runNextMigration();
  });
}

module.exports = {
  ensureAppSchema,
};