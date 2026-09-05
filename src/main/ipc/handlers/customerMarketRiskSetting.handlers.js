// src/main/ipc/handlers/customerMarketRiskSetting.handlers.js
'use strict';

// CUSTOMER SETUP -> Risk -> Market Risk -> Interval.
// WRITE command handlers for CustomerMarketRiskSetting. Manual UPSERT (one active
// row per customer_id + setting_scope). customer_id may be NULL, so an ON CONFLICT
// upsert is not used (SQLite treats NULLs as distinct in unique indexes). After a
// write, refreshTable re-pushes the table through the normal DataPump READ flow.
// Thresholds (CustomerMarketRiskThresholdSetting) are intentionally NOT handled here.

const TBL = 'CustomerMarketRiskSetting';
const TBL_THRESHOLDS = 'CustomerMarketRiskThresholdSetting';

function normalizeCustomerId(value) {
  if (value === undefined || value === null || value === '') return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function sameCustomer(a, b) {
  const an = normalizeCustomerId(a);
  const bn = normalizeCustomerId(b);
  if (an === null && bn === null) return true;
  return an === bn;
}

module.exports = function registerCustomerMarketRiskSettingHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[customerMarketRiskSetting.handlers] ipcMain missing');

  if (!dbApi || typeof dbApi.runSQL !== 'function' || typeof dbApi.getAllRowsFromTable !== 'function') {
    throw new Error('[customerMarketRiskSetting.handlers] dbApi invalid');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[customerMarketRiskSetting.handlers] refreshTable missing');
  }

  try { ipcMain.removeHandler('customer-mr-setting.save'); } catch {}
  try { ipcMain.removeHandler('customer-mr-setting.set-baseline-rolling'); } catch {}
  try { ipcMain.removeHandler('customer-mr-setting.get'); } catch {}
  try { ipcMain.removeHandler('customer-mr-thresholds.get'); } catch {}
  try { ipcMain.removeHandler('customer-mr-thresholds.save'); } catch {}

  // WRITE: upsert the active default Market Risk interval for (customer_id, scope).
  ipcMain.handle('customer-mr-setting.save', async (_event, payload = {}) => {
    console.log('[customerMarketRiskSetting] save received', payload);

    try {
      const customerId = normalizeCustomerId(payload.customer_id);
      const settingScope = String(payload.setting_scope || 'DEFAULT');
      const code = payload.default_market_risk_interval_code;

      if (code == null || String(code).trim() === '') {
        throw new Error('default_market_risk_interval_code missing');
      }

      // Risk Warning Profile / Loss Tolerance Profile. Default BALANCED when missing.
      const warningProfile =
        payload.risk_warning_profile && String(payload.risk_warning_profile).trim() !== ''
          ? String(payload.risk_warning_profile)
          : 'BALANCED';

      // Risk calculation settings. Defaults: var_days = 10, confidence = 0.95.
      // var_days must be a positive integer; confidence must be in (0, 1).
      let varDays = Number(payload.var_days);
      if (!Number.isFinite(varDays)) varDays = 10;
      varDays = Math.trunc(varDays);
      if (varDays <= 0) throw new Error('var_days must be a positive integer');

      let confidence = Number(payload.confidence);
      if (!Number.isFinite(confidence)) confidence = 0.95;
      if (!(confidence > 0 && confidence < 1)) throw new Error('confidence must be between 0 and 1');

      console.log('[CUSTOMER MR SETTING SAVE PAYLOAD]', {
        default_market_risk_interval_code: String(code),
        risk_warning_profile: warningProfile,
        var_days: varDays,
        confidence,
      });

      const rows = await dbApi.getAllRowsFromTable(TBL);
      const existing = (Array.isArray(rows) ? rows : []).find(
        (r) =>
          String(r.setting_scope ?? 'DEFAULT') === settingScope &&
          sameCustomer(r.customer_id, customerId)
      );

      if (existing) {
        await dbApi.runSQL(
          `UPDATE ${TBL}
             SET default_market_risk_interval_code = ?,
                 risk_warning_profile = ?,
                 var_days = ?,
                 confidence = ?,
                 is_active = 1,
                 updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [String(code), warningProfile, varDays, confidence, existing.id]
        );
      } else {
        await dbApi.runSQL(
          `INSERT INTO ${TBL}
             (customer_id, setting_scope, default_market_risk_interval_code, risk_warning_profile, var_days, confidence, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [customerId, settingScope, String(code), warningProfile, varDays, confidence]
        );
      }

      console.log('[customerMarketRiskSetting] DB write ok');

      // Re-push through the normal READ flow (DataPump -> installReceivers -> ...).
      refreshTable(TBL);
      // The Model Selection read model derives from this setting -> refresh it too.
      refreshTable('v_MVAR_MODEL_SELECTION_APP');

      return { success: true };
    } catch (err) {
      console.error('[customerMarketRiskSetting] save error:', err);
      return { success: false, error: err.message };
    }
  });

  // WRITE: das aktive Baseline-Rolling (default_mvar_interval_id/_name) umstellen. Damit
  // laesst sich die "Always calculated"-Baseline auf ein bestehendes ROLLING_n-Szenario
  // umschalten, ohne loeschen/neu anlegen. Die Model-Selection-Klassifizierung (Baseline vs.
  // Szenario) leitet sich aus diesem Default ab -> nach dem Write die View mitrefreshen.
  ipcMain.handle('customer-mr-setting.set-baseline-rolling', async (_event, payload = {}) => {
    try {
      const customerId = normalizeCustomerId(payload.customer_id);
      const settingScope = String(payload.setting_scope || 'DEFAULT');
      const intervalName = String(payload.interval_name || '').trim();
      const intervalId = (payload.interval_id === undefined || payload.interval_id === null || payload.interval_id === '')
        ? null : Number(payload.interval_id);
      if (!intervalName) throw new Error('interval_name missing');

      const rows = await dbApi.getAllRowsFromTable(TBL);
      const existing = (Array.isArray(rows) ? rows : []).find(
        (r) =>
          String(r.setting_scope ?? 'DEFAULT') === settingScope &&
          sameCustomer(r.customer_id, customerId)
      );

      if (existing) {
        await dbApi.runSQL(
          `UPDATE ${TBL}
             SET default_mvar_interval_id = ?,
                 default_mvar_interval_name = ?,
                 is_active = 1,
                 updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [intervalId, intervalName, existing.id]
        );
      } else {
        await dbApi.runSQL(
          `INSERT INTO ${TBL}
             (customer_id, setting_scope, default_mvar_interval_id, default_mvar_interval_name, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [customerId, settingScope, intervalId, intervalName]
        );
      }

      // Setting zuerst re-pushen, dann die abgeleitete Model-Selection-View -> Reihenfolge
      // sorgt dafuer, dass die Neu-Klassifizierung den neuen Default sieht.
      refreshTable(TBL);
      refreshTable('v_MVAR_MODEL_SELECTION_APP');

      return { success: true };
    } catch (err) {
      console.error('[customerMarketRiskSetting] set-baseline-rolling error:', err);
      return { success: false, error: err.message };
    }
  });

  // READ (on demand, optional): active setting for (customer_id, scope).
  ipcMain.handle('customer-mr-setting.get', async (_event, payload = {}) => {
    try {
      const customerId = normalizeCustomerId(payload.customer_id);
      const settingScope = String(payload.setting_scope || 'DEFAULT');

      const rows = await dbApi.getAllRowsFromTable(TBL);
      const setting =
        (Array.isArray(rows) ? rows : []).find(
          (r) =>
            String(r.setting_scope ?? 'DEFAULT') === settingScope &&
            sameCustomer(r.customer_id, customerId) &&
            Number(r.is_active ?? 1) === 1
        ) || null;

      return { success: true, setting };
    } catch (err) {
      console.error('[customerMarketRiskSetting] get error:', err);
      return { success: false, error: err.message };
    }
  });

  // READ (on demand, optional): active loss-tolerance thresholds for a profile.
  // The normal UI reads via DataPump/state; this is just a convenience handler.
  ipcMain.handle('customer-mr-thresholds.get', async (_event, payload = {}) => {
    try {
      const customerId = normalizeCustomerId(payload.customer_id);
      const settingScope = String(payload.setting_scope || 'DEFAULT');
      const profile =
        payload.risk_warning_profile && String(payload.risk_warning_profile).trim() !== ''
          ? String(payload.risk_warning_profile)
          : 'BALANCED';

      const rows = await dbApi.getAllRowsFromTable(TBL_THRESHOLDS);
      const thresholds = (Array.isArray(rows) ? rows : [])
        .filter(
          (r) =>
            String(r.setting_scope ?? 'DEFAULT') === settingScope &&
            sameCustomer(r.customer_id, customerId) &&
            String(r.risk_warning_profile) === profile &&
            Number(r.is_active ?? 1) === 1
        )
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

      console.log('[CUSTOMER MR THRESHOLDS GET]', {
        risk_warning_profile: profile,
        count: thresholds.length,
      });

      return { success: true, thresholds };
    } catch (err) {
      console.error('[customerMarketRiskSetting] thresholds get error:', err);
      return { success: false, error: err.message };
    }
  });

  // WRITE: upsert warning limits for a profile. Manual UPSERT keyed by
  // (customer_id, setting_scope, risk_warning_profile, metric_code) — customer_id
  // may be NULL, so no ON CONFLICT. One row per key, no duplicates.
  ipcMain.handle('customer-mr-thresholds.save', async (_event, payload = {}) => {
    try {
      const customerId = normalizeCustomerId(payload.customer_id);
      const settingScope = String(payload.setting_scope || 'DEFAULT');
      const profile =
        payload.risk_warning_profile && String(payload.risk_warning_profile).trim() !== ''
          ? String(payload.risk_warning_profile)
          : 'BALANCED';
      const thresholds = Array.isArray(payload.thresholds) ? payload.thresholds : [];

      console.log('[CUSTOMER MR THRESHOLDS SAVE PAYLOAD]', {
        risk_warning_profile: profile,
        thresholds,
      });

      const rows = await dbApi.getAllRowsFromTable(TBL_THRESHOLDS);

      for (const t of thresholds) {
        const metricCode = String(t.metric_code || '').trim();
        if (!metricCode) continue;

        const yellow = Number(t.yellow_loss_limit);
        const red = Number(t.red_loss_limit);
        if (!Number.isFinite(yellow) || !Number.isFinite(red)) {
          throw new Error(`Invalid loss limit for ${metricCode}`);
        }

        const sortOrder =
          t.sort_order === undefined || t.sort_order === null || t.sort_order === ''
            ? null
            : Number(t.sort_order);

        const existing = (Array.isArray(rows) ? rows : []).find(
          (r) =>
            String(r.setting_scope ?? 'DEFAULT') === settingScope &&
            sameCustomer(r.customer_id, customerId) &&
            String(r.risk_warning_profile) === profile &&
            String(r.metric_code) === metricCode
        );

        if (existing) {
          await dbApi.runSQL(
            `UPDATE ${TBL_THRESHOLDS}
               SET yellow_loss_limit = ?,
                   red_loss_limit = ?,
                   sort_order = ?,
                   is_active = 1,
                   updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [yellow, red, sortOrder, existing.id]
          );
        } else {
          await dbApi.runSQL(
            `INSERT INTO ${TBL_THRESHOLDS}
               (customer_id, setting_scope, risk_warning_profile, metric_code,
                yellow_loss_limit, red_loss_limit, is_active, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, 1, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [customerId, settingScope, profile, metricCode, yellow, red, sortOrder]
          );
        }
      }

      // Re-push through the normal READ flow (DataPump).
      refreshTable(TBL_THRESHOLDS);
      // The Model Selection read model derives from these thresholds -> refresh it.
      refreshTable('v_MVAR_MODEL_SELECTION_APP');

      return { success: true };
    } catch (err) {
      console.error('[customerMarketRiskSetting] thresholds save error:', err);
      return { success: false, error: err.message };
    }
  });
};
