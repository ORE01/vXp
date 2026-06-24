// src/main/ipc/handlers/customerCreditRiskSetting.handlers.js
'use strict';

// CUSTOMER SETUP -> Risk -> Credit Risk -> General Settings.
// WRITE/READ command handlers for CustomerCreditRiskSetting. Manual UPSERT (one
// active row per customer_id + setting_scope). customer_id may be NULL, so no
// ON CONFLICT. After a write, refreshTable re-pushes via the normal DataPump flow.
// Mirrors customerMarketRiskSetting.handlers.js.

const TBL = 'CustomerCreditRiskSetting';
const TBL_THRESHOLDS = 'CustomerCreditRiskThresholdSetting';

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

function num(value, fallback) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

module.exports = function registerCustomerCreditRiskSettingHandlers({ ipcMain, dbApi, refreshTable }) {
  if (!ipcMain) throw new Error('[customerCreditRiskSetting.handlers] ipcMain missing');

  if (!dbApi || typeof dbApi.runSQL !== 'function' || typeof dbApi.getAllRowsFromTable !== 'function') {
    throw new Error('[customerCreditRiskSetting.handlers] dbApi invalid');
  }

  if (typeof refreshTable !== 'function') {
    throw new Error('[customerCreditRiskSetting.handlers] refreshTable missing');
  }

  try { ipcMain.removeHandler('customer-cr-setting.save'); } catch {}
  try { ipcMain.removeHandler('customer-cr-setting.get'); } catch {}
  try { ipcMain.removeHandler('customer-cr-thresholds.save'); } catch {}
  try { ipcMain.removeHandler('customer-cr-thresholds.get'); } catch {}

  // WRITE: upsert the active credit-risk general settings for (customer_id, scope).
  ipcMain.handle('customer-cr-setting.save', async (_event, payload = {}) => {
    try {
      const customerId = normalizeCustomerId(payload.customer_id);
      const settingScope = String(payload.setting_scope || 'DEFAULT');

      const defaultConfigName =
        payload.default_credit_config_name != null ? String(payload.default_credit_config_name) : null;
      const crModel =
        payload.cr_model && String(payload.cr_model).trim() !== '' ? String(payload.cr_model) : 'ASRF';
      const description = payload.description != null ? String(payload.description) : null;

      const confLevel = num(payload.conf_level, 0.999);
      const corr = num(payload.corr, 0.2);
      const recoveryRate = num(payload.recovery_rate, 0.4);
      const horizonDays = Math.trunc(num(payload.horizon_days, 256));
      const nSimulations = Math.trunc(num(payload.n_simulations, 10000));

      // Validation (server-side guard; the UI validates too).
      if (!(confLevel > 0 && confLevel < 1)) throw new Error('conf_level must be between 0 and 1');
      if (!(corr >= 0 && corr <= 1)) throw new Error('corr must be between 0 and 1');
      if (!(recoveryRate >= 0 && recoveryRate <= 1)) throw new Error('recovery_rate must be between 0 and 1');
      if (!(horizonDays > 0)) throw new Error('horizon_days must be a positive integer');
      if (!(nSimulations > 0)) throw new Error('n_simulations must be a positive integer');

      console.log('[CUSTOMER CR SETTING SAVE PAYLOAD]', {
        default_credit_config_name: defaultConfigName,
        conf_level: confLevel,
        corr,
        recovery_rate: recoveryRate,
        horizon_days: horizonDays,
        n_simulations: nSimulations,
        cr_model: crModel,
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
             SET default_credit_config_name = ?,
                 conf_level = ?,
                 corr = ?,
                 recovery_rate = ?,
                 horizon_days = ?,
                 n_simulations = ?,
                 description = ?,
                 cr_model = ?,
                 is_active = 1,
                 updated_at = CURRENT_TIMESTAMP
           WHERE id = ?`,
          [defaultConfigName, confLevel, corr, recoveryRate, horizonDays, nSimulations, description, crModel, existing.id]
        );
      } else {
        await dbApi.runSQL(
          `INSERT INTO ${TBL}
             (customer_id, setting_scope, default_credit_config_name,
              conf_level, corr, recovery_rate, horizon_days, n_simulations,
              description, cr_model, is_active, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
          [customerId, settingScope, defaultConfigName, confLevel, corr, recoveryRate, horizonDays, nSimulations, description, crModel]
        );
      }

      refreshTable(TBL);

      return { success: true };
    } catch (err) {
      console.error('[customerCreditRiskSetting] save error:', err);
      return { success: false, error: err.message };
    }
  });

  // READ (on demand, optional): active setting for (customer_id, scope).
  ipcMain.handle('customer-cr-setting.get', async (_event, payload = {}) => {
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
      console.error('[customerCreditRiskSetting] get error:', err);
      return { success: false, error: err.message };
    }
  });

  // WRITE: upsert credit-risk warning thresholds (CVAR / TSI / MSD). Manual UPSERT
  // keyed by (customer_id, setting_scope, metric_code). No ON CONFLICT (NULL
  // customer_id). One row per key, no duplicates.
  ipcMain.handle('customer-cr-thresholds.save', async (_event, payload = {}) => {
    try {
      const customerId = normalizeCustomerId(payload.customer_id);
      const settingScope = String(payload.setting_scope || 'DEFAULT');
      const thresholds = Array.isArray(payload.thresholds) ? payload.thresholds : [];

      console.log('[CUSTOMER CR THRESHOLDS SAVE PAYLOAD]', {
        setting_scope: settingScope,
        thresholds,
      });

      const rows = await dbApi.getAllRowsFromTable(TBL_THRESHOLDS);

      for (const t of thresholds) {
        const metricCode = String(t.metric_code || '').trim();
        if (!metricCode) continue;

        const yellow = Number(t.yellow_threshold);
        const red = Number(t.red_threshold);
        if (!Number.isFinite(yellow) || !Number.isFinite(red)) {
          throw new Error(`Invalid threshold for ${metricCode}`);
        }

        const description = t.description != null ? String(t.description) : null;
        const isActive = Number(t.is_active ?? 1) === 0 ? 0 : 1;
        const sortOrder =
          t.sort_order === undefined || t.sort_order === null || t.sort_order === ''
            ? null
            : Number(t.sort_order);

        const existing = (Array.isArray(rows) ? rows : []).find(
          (r) =>
            String(r.setting_scope ?? 'DEFAULT') === settingScope &&
            sameCustomer(r.customer_id, customerId) &&
            String(r.metric_code) === metricCode
        );

        if (existing) {
          await dbApi.runSQL(
            `UPDATE ${TBL_THRESHOLDS}
               SET yellow_threshold = ?,
                   red_threshold = ?,
                   description = ?,
                   is_active = ?,
                   sort_order = ?,
                   updated_at = CURRENT_TIMESTAMP
             WHERE id = ?`,
            [yellow, red, description, isActive, sortOrder, existing.id]
          );
        } else {
          await dbApi.runSQL(
            `INSERT INTO ${TBL_THRESHOLDS}
               (customer_id, setting_scope, metric_code, yellow_threshold, red_threshold,
                description, is_active, sort_order, created_at, updated_at)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`,
            [customerId, settingScope, metricCode, yellow, red, description, isActive, sortOrder]
          );
        }
      }

      refreshTable(TBL_THRESHOLDS);

      return { success: true };
    } catch (err) {
      console.error('[customerCreditRiskSetting] thresholds save error:', err);
      return { success: false, error: err.message };
    }
  });

  // READ (on demand, optional): active thresholds sorted by sort_order.
  ipcMain.handle('customer-cr-thresholds.get', async (_event, payload = {}) => {
    try {
      const customerId = normalizeCustomerId(payload.customer_id);
      const settingScope = String(payload.setting_scope || 'DEFAULT');

      const rows = await dbApi.getAllRowsFromTable(TBL_THRESHOLDS);
      const thresholds = (Array.isArray(rows) ? rows : [])
        .filter(
          (r) =>
            String(r.setting_scope ?? 'DEFAULT') === settingScope &&
            sameCustomer(r.customer_id, customerId) &&
            Number(r.is_active ?? 1) === 1
        )
        .sort((a, b) => Number(a.sort_order ?? 0) - Number(b.sort_order ?? 0));

      return { success: true, thresholds };
    } catch (err) {
      console.error('[customerCreditRiskSetting] thresholds get error:', err);
      return { success: false, error: err.message };
    }
  });
};
