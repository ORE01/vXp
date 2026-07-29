// src/renderer/features/CUSTOMER_SETUP/portfolioDurationLimitsPanel.js
//
// Customer Setup -> Portfolio -> Duration Limits. Editable yellow/red warning
// limits (in years) for the Overview interest-rate / credit-spread duration
// sliders. Replaces the former display-only sliders. Persisted in
// CustomerPortfolioDurationLimit (one row per metric_code) via the channel
// 'customer-portfolio-limits.save'. Single set (no profile).
//
// Direction: higher duration = more risk -> RED limit must be greater than YELLOW.
// getPortfolioDurationLimits() feeds the Overview slider colouring (homeOverview.js).

'use strict';

const LIMITS_CONTAINER_ID = 'portfolioDurationLimitsDisplay';
const SAVE_BUTTON_ID = 'portfolioDurationLimitsSaveBtn';
const STATUS_ID = 'portfolioDurationLimitsStatus';
const SAVE_CHANNEL = 'customer-portfolio-limits.save';

// Editable metrics (order = display order). yellow < red (years).
const METRICS = [
  { code: 'ir_duration', label: 'Interest Rate Duration' },
  { code: 'cs_duration', label: 'Credit Spread Duration' },
];

// App default limits (years); used until the customer saves a value.
const DEFAULTS = {
  ir_duration: { yellow: 5, red: 8 },
  cs_duration: { yellow: 5, red: 8 },
};

// metric_code -> { yellow, red }. null = not loaded yet -> defaults.
let _limits = null;

function limitFor(code) {
  const stored = _limits && _limits.get(code);
  const def = DEFAULTS[code] || { yellow: 0, red: 0 };
  const yellow = stored && Number.isFinite(stored.yellow) ? stored.yellow : def.yellow;
  const red = stored && Number.isFinite(stored.red) ? stored.red : def.red;
  return { yellow, red };
}

// Effective limits for the Overview sliders: { ir_duration:{yellow,red}, cs_duration:{...} }.
export function getPortfolioDurationLimits() {
  const out = {};
  METRICS.forEach((m) => { out[m.code] = limitFor(m.code); });
  return out;
}

const numOrEmpty = (v) => (Number.isFinite(v) ? String(v) : '');

// ---- editable Duration Limits table --------------------------------------
export function renderPortfolioDurationLimits() {
  const el = document.getElementById(LIMITS_CONTAINER_ID);
  if (!el) return;

  const body = METRICS.map((m) => {
    const lim = limitFor(m.code);
    return `
      <tr>
        <td class="cmr-metric">${m.label}</td>
        <td>
          <span class="customer-mr-input-unit">
            <input type="text" class="customer-mr-input-num" data-metric="${m.code}" data-field="yellow" value="${numOrEmpty(lim.yellow)}">
            <span class="customer-mr-unit">y</span>
          </span>
        </td>
        <td>
          <span class="customer-mr-input-unit">
            <input type="text" class="customer-mr-input-num" data-metric="${m.code}" data-field="red" value="${numOrEmpty(lim.red)}">
            <span class="customer-mr-unit">y</span>
          </span>
        </td>
      </tr>`;
  }).join('');

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
    </table>`;
}

// Read the edited limits back from the inputs.
function readInputs() {
  const container = document.getElementById(LIMITS_CONTAINER_ID);
  if (!container) return [];

  const parse = (t) => {
    const n = parseFloat(String(t ?? '').replace(',', '.').trim());
    return Number.isFinite(n) ? n : NaN;
  };

  return METRICS.map((m) => {
    const yEl = container.querySelector(`input[data-metric="${m.code}"][data-field="yellow"]`);
    const rEl = container.querySelector(`input[data-metric="${m.code}"][data-field="red"]`);
    return { metric_code: m.code, yellow_limit: parse(yEl?.value), red_limit: parse(rEl?.value) };
  });
}

// Both numbers finite, non-negative, and RED > YELLOW (higher duration = worse).
function validate(rows) {
  for (const r of rows) {
    const label = METRICS.find((m) => m.code === r.metric_code)?.label || r.metric_code;
    if (!Number.isFinite(r.yellow_limit) || !Number.isFinite(r.red_limit)) {
      return { ok: false, message: `Invalid number for ${label}.` };
    }
    if (r.yellow_limit < 0 || r.red_limit < 0) {
      return { ok: false, message: `${label}: limits must be ≥ 0.` };
    }
    if (!(r.red_limit > r.yellow_limit)) {
      return { ok: false, message: `${label}: Red (${r.red_limit}y) must be greater than Yellow (${r.yellow_limit}y).` };
    }
  }
  return { ok: true };
}

function setStatus(text, ok = true) {
  const status = document.getElementById(STATUS_ID);
  if (!status) return;
  status.textContent = text || '';
  status.style.color = ok ? 'var(--accent)' : 'var(--danger-hover)';
}

// DataPump READ: fresh CustomerPortfolioDurationLimit rows -> re-render + recolour Overview.
export function handleCustomerPortfolioDurationLimitData(rows) {
  const map = new Map();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const code = String(r.metric_code ?? r.METRIC_CODE ?? '').trim();
    if (!code) return;
    map.set(code, {
      yellow: Number(r.yellow_limit ?? r.YELLOW_LIMIT),
      red: Number(r.red_limit ?? r.RED_LIMIT),
    });
  });
  _limits = map;

  renderPortfolioDurationLimits();
  // Overview-Slider mit den neuen Schwellen neu einfaerben.
  try { window.renderHomeOverview?.(); } catch (_) {}
}

// Render table + wire the Save button (once).
export function initPortfolioDurationLimitsPanel() {
  renderPortfolioDurationLimits();

  const btn = document.getElementById(SAVE_BUTTON_ID);
  if (btn && btn.dataset.bound !== '1') {
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const limits = readInputs();
      const v = validate(limits);
      if (!v.ok) { setStatus(v.message, false); return; }

      setStatus('Saving…');
      try {
        const res = await window.api.invoke(SAVE_CHANNEL, { limits });
        setStatus(res?.success ? 'Saved.' : `Error: ${res?.error || 'unknown'}`, !!res?.success);
      } catch (e) {
        setStatus(`Error: ${e?.message || e}`, false);
      }
    });
  }
}
