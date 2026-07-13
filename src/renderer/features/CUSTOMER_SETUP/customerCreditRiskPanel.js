// src/renderer/features/CUSTOMER_SETUP/customerCreditRiskPanel.js
//
// CUSTOMER SETUP -> Risk -> Credit Risk -> General Settings slide-in.
//
// READ:  appState.getCustomerCreditRiskSetting() (filled by the feature handler
//        via the DataPump flow). Never reads the DB directly.
// WRITE: Save -> customer-cr-setting.save (UPSERT) -> refreshTable -> DataPump ->
//        state -> UI. Manual save only. Mirrors the Market Risk panel.

import { appState } from '../../renderer.js';

const CONFIG_NAME_ID = 'customerCrConfigNameInput';
const CR_MODEL_ID = 'customerCrModelSelect';
const DESCRIPTION_ID = 'customerCrDescriptionInput';
const CONF_LEVEL_ID = 'customerCrConfLevelInput';
const HORIZON_ID = 'customerCrHorizonInput';
// corr, recovery_rate and n_simulations are intentionally NOT rendered/edited in
// Customer Setup because they belong to Risk Configuration / effective run settings.
// The DB columns and appState are kept; Save preserves their existing values.
const SAVE_BUTTON_ID = 'customerCrSaveButton';
const STATUS_ID = 'customerCrStatus';

const SAVE_CHANNEL = 'customer-cr-setting.save';
const THRESHOLDS_SAVE_CHANNEL = 'customer-cr-thresholds.save';

const DEFAULTS = {
  default_credit_config_name: 'default',
  conf_level: 0.999,
  corr: 0.2,
  recovery_rate: 0.4,
  horizon_days: 256,
  n_simulations: 10000,
  cr_model: 'MF_GC',
  description: '',
};

function setVal(id, value) {
  const el = document.getElementById(id);
  if (el) el.value = value;
}
function getVal(id) {
  return document.getElementById(id)?.value;
}

function pctToStr(decimal) {
  const n = Number(decimal);
  return Number.isFinite(n) ? (n * 100).toFixed(2) : '';
}
function strPctToDecimal(text) {
  const cleaned = String(text ?? '').replace('%', '').replace(',', '.').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n / 100 : NaN;
}

function setStatus(text, ok = true) {
  const status = document.getElementById(STATUS_ID);
  if (!status) return;
  status.textContent = text || '';
  status.style.color = ok ? 'var(--accent)' : 'var(--danger-hover)';
}

// Load the saved settings from the store into the form (fallback to defaults).
export function renderCreditRiskSettings() {
  const s = appState.getCustomerCreditRiskSetting() || {};

  setVal(CONFIG_NAME_ID, s.default_credit_config_name ?? DEFAULTS.default_credit_config_name);

  const model = document.getElementById(CR_MODEL_ID);
  if (model) model.value = s.cr_model ?? DEFAULTS.cr_model;

  setVal(DESCRIPTION_ID, s.description ?? DEFAULTS.description);

  const conf = Number(s.conf_level);
  setVal(CONF_LEVEL_ID, pctToStr(Number.isFinite(conf) ? conf : DEFAULTS.conf_level));

  const horizon = Number(s.horizon_days);
  setVal(HORIZON_ID, String(Number.isFinite(horizon) && horizon > 0 ? Math.trunc(horizon) : DEFAULTS.horizon_days));

  // corr, recovery_rate and n_simulations are intentionally not rendered here
  // (Risk Configuration / effective run settings). Their values stay in appState/DB.
}

// ---- Threshold Settings (CVAR / TSI / MSD) -------------------------------
const THRESHOLDS_CONTAINER_ID = 'customerCrThresholdsDisplay';

// dir = validation direction: 'neg' -> red < yellow (CVAR); 'pos' -> red > yellow.
const METRICS_CR = [
  { code: 'CVAR', label: 'CVaR', sort: 10, dir: 'neg' },
  { code: 'TSI', label: 'TSI', sort: 20, dir: 'pos' },
  { code: 'MSD', label: 'MSD', sort: 30, dir: 'pos' },
];

// App defaults (mirror the DB seed); used only if the store has no row yet.
// TSI/MSD sind relative Kennzahlen: TSI = (ES-VaR)/VaR, MSD = (adjES-histES)/histES.
const THRESHOLD_DEFAULTS_CR = {
  CVAR: { yellow: -0.050, red: -0.052, description: 'Historic VaR%' },
  TSI: { yellow: 0.20, red: 0.30, description: '(Historic ES - Historic VaR) / Historic VaR' },
  MSD: { yellow: 0.20, red: 0.60, description: '(Adjusted ES - Historic ES) / Historic ES' },
};

function escapeHtml(value) {
  if (value === null || value === undefined) return '';
  return String(value)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

// Rows for the table: stored value if present, otherwise the app default.
function getCrThresholdRows() {
  const stored = appState.getCustomerCreditRiskThresholds?.() || [];
  const byMetric = {};
  stored.forEach((r) => { byMetric[r.metric_code] = r; });

  return METRICS_CR.map((m) => {
    const r = byMetric[m.code];
    const def = THRESHOLD_DEFAULTS_CR[m.code];
    return {
      metric_code: m.code,
      label: m.label,
      dir: m.dir,
      yellow: r ? Number(r.yellow_threshold) : def.yellow,
      red: r ? Number(r.red_threshold) : def.red,
      description: (r && r.description != null) ? r.description : def.description,
      sort_order: m.sort,
    };
  });
}

// Editable Yellow/Red (percent), read-only Description.
export function renderCreditRiskThresholds() {
  const el = document.getElementById(THRESHOLDS_CONTAINER_ID);
  if (!el) return;

  const stored = appState.getCustomerCreditRiskThresholds?.() || [];
  if (!stored.length) {
    console.log('[CUSTOMER CR PANEL] no thresholds in store');
  }

  const rows = getCrThresholdRows();

  const body = rows.map((r) => `
    <tr>
      <td class="cmr-metric">${escapeHtml(r.label)}</td>
      <td>
        <span class="customer-mr-input-unit">
          <input type="text" class="customer-mr-input-num" data-metric="${r.metric_code}" data-field="yellow" value="${pctToStr(r.yellow)}">
          <span class="customer-mr-unit">%</span>
        </span>
      </td>
      <td>
        <span class="customer-mr-input-unit">
          <input type="text" class="customer-mr-input-num" data-metric="${r.metric_code}" data-field="red" value="${pctToStr(r.red)}">
          <span class="customer-mr-unit">%</span>
        </span>
      </td>
      <td class="cmr-desc">${escapeHtml(r.description ?? '')}</td>
    </tr>
  `).join('');

  el.innerHTML = `
    <table class="customer-mr-limits-table">
      <thead>
        <tr><th>Metric</th><th>Yellow Warning</th><th>Red Critical</th><th>Description</th></tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

// Read edited Yellow/Red back (percent -> decimal); description/sort from the rows.
function readCrThresholdInputs() {
  const container = document.getElementById(THRESHOLDS_CONTAINER_ID);
  const byMetric = {};
  getCrThresholdRows().forEach((r) => { byMetric[r.metric_code] = r; });

  return METRICS_CR.map((m) => {
    const yEl = container?.querySelector(`input[data-metric="${m.code}"][data-field="yellow"]`);
    const rEl = container?.querySelector(`input[data-metric="${m.code}"][data-field="red"]`);
    return {
      metric_code: m.code,
      yellow_threshold: strPctToDecimal(yEl?.value),
      red_threshold: strPctToDecimal(rEl?.value),
      description: byMetric[m.code]?.description ?? null,
      is_active: 1,
      sort_order: m.sort,
    };
  });
}

// Validation: CVAR -> red more critical (more negative) than yellow (red < yellow);
// TSI / MSD -> red greater than yellow (red > yellow).
function validateCrThresholds(rows) {
  for (const t of rows) {
    if (!Number.isFinite(t.yellow_threshold) || !Number.isFinite(t.red_threshold)) {
      return { ok: false, message: `Invalid number for ${t.metric_code}.` };
    }
    const m = METRICS_CR.find((x) => x.code === t.metric_code);
    if (m && m.dir === 'neg' && !(t.red_threshold < t.yellow_threshold)) {
      return { ok: false, message: `${t.metric_code}: Red must be more critical (more negative) than Yellow.` };
    }
    if (m && m.dir === 'pos' && !(t.red_threshold > t.yellow_threshold)) {
      return { ok: false, message: `${t.metric_code}: Red must be greater than Yellow.` };
    }
  }
  return { ok: true };
}

// Wire the Save button once (manual save only). Saves General Settings + Thresholds.
export function initCustomerCreditRiskSave() {
  const button = document.getElementById(SAVE_BUTTON_ID);
  if (!button || button.dataset.bound === '1') return;
  button.dataset.bound = '1';

  button.addEventListener('click', async () => {
    const confLevel = strPctToDecimal(getVal(CONF_LEVEL_ID));
    const horizonDays = Math.trunc(Number(getVal(HORIZON_ID)));

    // corr, recovery_rate and n_simulations are no longer edited in Customer Setup
    // (Risk Configuration owns them). Preserve their existing values so the UPSERT
    // keeps the DB columns intact; fall back to defaults only if the row is empty.
    const existing = appState.getCustomerCreditRiskSetting() || {};
    const corrNum = Number(existing.corr);
    const corr = Number.isFinite(corrNum) ? corrNum : DEFAULTS.corr;
    const recoveryNum = Number(existing.recovery_rate);
    const recoveryRate = Number.isFinite(recoveryNum) ? recoveryNum : DEFAULTS.recovery_rate;
    const simsNum = Math.trunc(Number(existing.n_simulations));
    const nSimulations = Number.isFinite(simsNum) && simsNum > 0 ? simsNum : DEFAULTS.n_simulations;

    if (!(confLevel > 0 && confLevel < 1)) {
      setStatus('Confidence Level must be between 0 % and 100 %.', false);
      return;
    }
    if (!(Number.isFinite(horizonDays) && horizonDays > 0)) {
      setStatus('Horizon Days must be a positive integer.', false);
      return;
    }

    // Validate the threshold settings before any DB write.
    const thresholds = readCrThresholdInputs();
    const thrValidation = validateCrThresholds(thresholds);
    if (!thrValidation.ok) {
      setStatus(thrValidation.message, false);
      return;
    }

    setStatus('Saving…');

    try {
      // 1) General settings
      const settingRes = await window.api.invoke(SAVE_CHANNEL, {
        customer_id: null,
        setting_scope: 'DEFAULT',
        default_credit_config_name: getVal(CONFIG_NAME_ID) ?? '',
        conf_level: confLevel,
        corr,
        recovery_rate: recoveryRate,
        horizon_days: horizonDays,
        n_simulations: nSimulations,
        description: getVal(DESCRIPTION_ID) ?? '',
        cr_model: getVal(CR_MODEL_ID) ?? DEFAULTS.cr_model,
      });

      if (!settingRes || !settingRes.success) {
        setStatus(`Save failed: ${settingRes?.error || 'setting error'}`, false);
        return;
      }

      // 2) Threshold settings (CVAR / TSI / MSD)
      const thrRes = await window.api.invoke(THRESHOLDS_SAVE_CHANNEL, {
        customer_id: null,
        setting_scope: 'DEFAULT',
        thresholds,
      });

      if (thrRes && thrRes.success) {
        setStatus('Saved ✓');
      } else {
        setStatus(`Save failed: ${thrRes?.error || 'thresholds error'}`, false);
      }
    } catch (err) {
      setStatus(`Save failed: ${err?.message || err}`, false);
    }
  });
}
