// src/renderer/features/CUSTOMER_SETUP/customerMarketRiskPanel.js
//
// CUSTOMER SETUP -> Risk -> Market Risk slide-in.
//
// READ:  interval options from MVaRInput (DataPump); the saved interval/profile
//        from appState.getCustomerMarketRiskSetting(); warning limits from
//        appState.getCustomerMarketRiskThresholdsByProfile(profile). Never reads DB directly.
// WRITE: Save -> customer-mr-setting.save (interval + profile) AND
//        customer-mr-thresholds.save (warning limits for the selected profile).
//        Manual save only; main handlers upsert + refreshTable -> DataPump -> state -> UI.

import { appState } from '../../renderer.js';

const SELECT_ID = 'customerMarketRiskIntervalSelect';
const PROFILE_SELECT_ID = 'customerRiskWarningProfileSelect';
const VAR_DAYS_INPUT_ID = 'customerVarDaysInput';
const CONFIDENCE_INPUT_ID = 'customerConfidenceInput';
const SAVE_BUTTON_ID = 'customerMarketRiskIntervalSaveButton';
const STATUS_ID = 'customerMarketRiskIntervalStatus';
const LIMITS_CONTAINER_ID = 'customerWarningLimitsDisplay';

const SETTING_SAVE_CHANNEL = 'customer-mr-setting.save';
const THRESHOLDS_SAVE_CHANNEL = 'customer-mr-thresholds.save';

const VALID_WARNING_PROFILES = new Set(['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE']);
const DEFAULT_WARNING_PROFILE = 'BALANCED';
const DEFAULT_VAR_DAYS = 10;
const DEFAULT_CONFIDENCE = 0.95;

// Risk Calculation Settings: load from store (fallback 10 / 0.95). Confidence is
// shown as percent (0.95 -> "95.00") and stored as a decimal.
function renderRiskCalcSettings() {
  const setting = appState.getCustomerMarketRiskSetting() || null;

  const varDaysEl = document.getElementById(VAR_DAYS_INPUT_ID);
  if (varDaysEl) {
    const vd = Number(setting?.var_days);
    varDaysEl.value = Number.isFinite(vd) && vd > 0 ? String(Math.trunc(vd)) : String(DEFAULT_VAR_DAYS);
  }

  const confEl = document.getElementById(CONFIDENCE_INPUT_ID);
  if (confEl) {
    const c = Number(setting?.confidence);
    const dec = Number.isFinite(c) && c > 0 && c < 1 ? c : DEFAULT_CONFIDENCE;
    confEl.value = (dec * 100).toFixed(2);
  }
}

// Editable metrics + UI labels (order = sort_order).
const METRICS = [
  { code: 'VaR_T_rel', label: 'VaR', sort: 10 },
  { code: 'ES_T_rel', label: 'Expected Shortfall', sort: 20 },
];

// App default limits (mirror the DB seed); used only if the store has no row yet.
const THRESHOLD_DEFAULTS = {
  CONSERVATIVE: { VaR_T_rel: { yellow: -0.005, red: -0.010 }, ES_T_rel: { yellow: -0.007, red: -0.015 } },
  BALANCED:     { VaR_T_rel: { yellow: -0.010, red: -0.030 }, ES_T_rel: { yellow: -0.015, red: -0.050 } },
  AGGRESSIVE:   { VaR_T_rel: { yellow: -0.020, red: -0.050 }, ES_T_rel: { yellow: -0.030, red: -0.080 } },
};

// ---- percent <-> decimal -------------------------------------------------
function decimalToPctStr(value) {
  const n = Number(value);
  return Number.isFinite(n) ? (n * 100).toFixed(2) : '';
}

function pctStrToDecimal(text) {
  const cleaned = String(text ?? '').replace('%', '').replace(',', '.').trim();
  const n = parseFloat(cleaned);
  return Number.isFinite(n) ? n / 100 : NaN;
}

// ---- profile + threshold resolution -------------------------------------
function getCurrentProfile() {
  const sel = document.getElementById(PROFILE_SELECT_ID);
  const v = sel?.value;
  if (v && VALID_WARNING_PROFILES.has(String(v))) return String(v);

  const saved = appState.getCustomerMarketRiskSetting()?.risk_warning_profile;
  return saved && VALID_WARNING_PROFILES.has(String(saved)) ? String(saved) : DEFAULT_WARNING_PROFILE;
}

// Rows for the given profile: stored value if present, otherwise the app default.
function getThresholdRowsForProfile(profile) {
  const stored = appState.getCustomerMarketRiskThresholdsByProfile?.(profile) || [];
  const byMetric = {};
  stored.forEach((r) => { byMetric[r.metric_code] = r; });

  return METRICS.map((m) => {
    const r = byMetric[m.code];
    const def = THRESHOLD_DEFAULTS[profile]?.[m.code] || { yellow: 0, red: 0 };
    return {
      metric_code: m.code,
      label: m.label,
      yellow: r ? Number(r.yellow_loss_limit) : def.yellow,
      red: r ? Number(r.red_loss_limit) : def.red,
      sort_order: m.sort,
    };
  });
}

// ---- editable Warning Limits table --------------------------------------
export function renderWarningLimits() {
  const el = document.getElementById(LIMITS_CONTAINER_ID);
  if (!el) return;

  const profile = getCurrentProfile();
  const rows = getThresholdRowsForProfile(profile);

  const body = rows.map((r) => `
    <tr>
      <td class="cmr-metric">${r.label}</td>
      <td>
        <span class="customer-mr-input-unit">
          <input type="text" class="customer-mr-input-num" data-metric="${r.metric_code}" data-field="yellow" value="${decimalToPctStr(r.yellow)}">
          <span class="customer-mr-unit">%</span>
        </span>
      </td>
      <td>
        <span class="customer-mr-input-unit">
          <input type="text" class="customer-mr-input-num" data-metric="${r.metric_code}" data-field="red" value="${decimalToPctStr(r.red)}">
          <span class="customer-mr-unit">%</span>
        </span>
      </td>
    </tr>
  `).join('');

  el.innerHTML = `
    <table class="customer-mr-limits-table">
      <thead>
        <tr>
          <th>Metric</th>
          <th>Yellow Warning</th>
          <th>Red Critical</th>
        </tr>
      </thead>
      <tbody>${body}</tbody>
    </table>
  `;
}

// Read the edited limits back from the inputs (percent -> decimal).
function readThresholdInputs() {
  const container = document.getElementById(LIMITS_CONTAINER_ID);
  if (!container) return [];

  return METRICS.map((m) => {
    const yEl = container.querySelector(`input[data-metric="${m.code}"][data-field="yellow"]`);
    const rEl = container.querySelector(`input[data-metric="${m.code}"][data-field="red"]`);
    return {
      metric_code: m.code,
      yellow_loss_limit: pctStrToDecimal(yEl?.value),
      red_loss_limit: pctStrToDecimal(rEl?.value),
      sort_order: m.sort,
    };
  });
}

// Validation: numbers must be finite and yellow must be greater (less negative)
// than red (yellow_loss_limit > red_loss_limit).
function validateThresholds(rows) {
  for (const r of rows) {
    if (!Number.isFinite(r.yellow_loss_limit) || !Number.isFinite(r.red_loss_limit)) {
      return { ok: false, message: `Invalid number for ${r.metric_code}.` };
    }
    if (!(r.yellow_loss_limit > r.red_loss_limit)) {
      return {
        ok: false,
        message: `${r.metric_code}: Yellow (${decimalToPctStr(r.yellow_loss_limit)}%) must be greater than Red (${decimalToPctStr(r.red_loss_limit)}%).`,
      };
    }
  }
  return { ok: true };
}

// ---- interval dropdown ---------------------------------------------------
let mvarIntervalCodes = [];

function resolveSelectedCode() {
  const codes = new Set(mvarIntervalCodes);
  const saved = appState.getCustomerMarketRiskSetting()?.default_market_risk_interval_code || null;
  const candidates = [saved, 'ROLLING_1', 'STRESSED'];

  for (const c of candidates) {
    if (c && codes.has(String(c))) return String(c);
  }

  return mvarIntervalCodes.length ? mvarIntervalCodes[0] : '';
}

export function renderCustomerMarketRiskDropdown() {
  const select = document.getElementById(SELECT_ID);
  if (!select) return;

  select.innerHTML = '';
  mvarIntervalCodes.forEach((code) => {
    const option = document.createElement('option');
    option.value = code;
    option.textContent = code;
    select.appendChild(option);
  });

  const selected = resolveSelectedCode();
  if (selected) select.value = selected;

  renderWarningProfile();
}

// Preselect the saved Risk Warning Profile from the store (default BALANCED).
function renderWarningProfile() {
  const profileSelect = document.getElementById(PROFILE_SELECT_ID);
  if (!profileSelect) return;

  const saved = appState.getCustomerMarketRiskSetting()?.risk_warning_profile || null;
  const value = saved && VALID_WARNING_PROFILES.has(String(saved))
    ? String(saved)
    : DEFAULT_WARNING_PROFILE;

  profileSelect.value = value;

  renderWarningLimits();
  renderRiskCalcSettings();
}

function setStatus(text, ok = true) {
  const status = document.getElementById(STATUS_ID);
  if (!status) return;
  status.textContent = text || '';
  status.style.color = ok ? 'var(--accent)' : 'var(--danger-hover)';
}

// DataPump handler: MVaRInput rows -> dropdown options (codes = INTERVAL_NAME).
export function handleCustomerMarketRiskIntervalOptions(rows) {
  mvarIntervalCodes = (Array.isArray(rows) ? rows : [])
    .map((r) => r.INTERVAL_NAME)
    .filter((c) => c != null && String(c).trim() !== '')
    .map((c) => String(c));

  renderCustomerMarketRiskDropdown();
}

// Wire the Save button + profile-change reload once.
export function initCustomerMarketRiskSave() {
  const button = document.getElementById(SAVE_BUTTON_ID);
  if (!button || button.dataset.bound === '1') return;
  button.dataset.bound = '1';

  // Profile change -> reload the warning limits for the newly selected profile.
  const profileSelect = document.getElementById(PROFILE_SELECT_ID);
  if (profileSelect && profileSelect.dataset.bound !== '1') {
    profileSelect.dataset.bound = '1';
    profileSelect.addEventListener('change', () => renderWarningLimits());
  }

  button.addEventListener('click', async () => {
    const select = document.getElementById(SELECT_ID);
    if (!select) return;

    const code = select.value;
    if (!code) {
      setStatus('Please select an interval.', false);
      return;
    }

    const riskWarningProfile = getCurrentProfile();

    // Risk calculation settings: VaR horizon days (positive integer) + confidence
    // (entered as percent, stored as a decimal in (0,1)).
    const varDaysRaw = document.getElementById(VAR_DAYS_INPUT_ID)?.value;
    const varDays = Math.trunc(Number(varDaysRaw));
    if (!Number.isFinite(varDays) || varDays <= 0) {
      setStatus('VaR Horizon Days must be a positive integer.', false);
      return;
    }

    const confRaw = String(document.getElementById(CONFIDENCE_INPUT_ID)?.value ?? '')
      .replace('%', '').replace(',', '.').trim();
    const confPct = Number(confRaw);
    const confidence = Number.isFinite(confPct) ? confPct / 100 : NaN;
    if (!(confidence > 0 && confidence < 1)) {
      setStatus('Confidence Level must be between 0 % and 100 %.', false);
      return;
    }

    // Validate the edited warning limits before any DB write.
    const thresholds = readThresholdInputs();
    const validation = validateThresholds(thresholds);
    if (!validation.ok) {
      setStatus(validation.message, false);
      return;
    }

    setStatus('Saving…');

    try {
      // 1) Setting (interval + profile + risk calc settings)
      const settingRes = await window.api.invoke(SETTING_SAVE_CHANNEL, {
        customer_id: null,
        setting_scope: 'DEFAULT',
        default_market_risk_interval_code: code,
        risk_warning_profile: riskWarningProfile,
        var_days: varDays,
        confidence,
      });

      if (!settingRes || !settingRes.success) {
        setStatus(`Save failed: ${settingRes?.error || 'setting error'}`, false);
        return;
      }

      // 2) Thresholds (warning limits for the selected profile)
      const thrRes = await window.api.invoke(THRESHOLDS_SAVE_CHANNEL, {
        customer_id: null,
        setting_scope: 'DEFAULT',
        risk_warning_profile: riskWarningProfile,
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
