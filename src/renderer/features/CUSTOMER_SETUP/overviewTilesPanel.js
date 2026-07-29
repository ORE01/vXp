// src/renderer/features/CUSTOMER_SETUP/overviewTilesPanel.js
//
// Customer Setup: choose which tiles the Overview cards show, and — for tiles that
// carry both an absolute and a relative value — whether the absolute or the
// relative value is displayed large. Persisted in CustomerOverviewTileSetting
// (one row per tile_key: is_visible 0/1, value_mode 'abs'|'rel') via the
// key-agnostic channel 'customer-overview-tiles.save' (UPSERT per key, so each
// panel can save only its own group without touching the others).
//
//   - Portfolio    tiles -> Customer Setup / Portfolio
//   - Market Risk  tiles -> Customer Setup / Risk / Market Risk
//   - Credit Risk  tiles -> Customer Setup / Risk / Credit Risk
//
// Each Overview tile is marked with data-tile="<key>"; unchecked tiles are hidden.

'use strict';

export const OVERVIEW_TILES = [
  { key: 'notional',        label: 'Notional' },
  { key: 'nav',             label: 'Net Asset Value' },
  { key: 'yield',           label: 'Yield' },
  { key: 'ir_duration',     label: 'Interest Rate Duration' },
  { key: 'cs_duration',     label: 'Credit Spread Duration' },
  { key: 'pv01',            label: 'PV01' },
  { key: 'cpv01',           label: 'CPV01' },
  { key: 'vega',            label: 'Vega' },
  { key: 'largest_issuers', label: 'Largest Issuers Chart' },
];

export const MARKET_RISK_TILES = [
  { key: 'mkt_var',      label: 'Normal Risk (VaR)' },
  { key: 'mkt_es',       label: 'Extreme Risk (ES)' },
  { key: 'mkt_scen_var', label: 'Normal Risk (VaR) · Scenario' },
  { key: 'mkt_scen_es',  label: 'Extreme Risk (ES) · Scenario' },
  { key: 'mkt_chart',    label: 'Top Product Contributions Chart' },
];

export const CREDIT_RISK_TILES = [
  { key: 'cr_var',   label: 'Normal Risk (VaR)' },
  { key: 'cr_es',    label: 'Extreme Risk (ES)' },
  { key: 'cr_tsi',   label: 'Cluster Risk (TSI)' },
  { key: 'cr_msd',   label: 'Market Stress (MSD)' },
  { key: 'cr_chart', label: 'Top Tail Drivers Chart' },
];

const ALL_TILES = [...OVERVIEW_TILES, ...MARKET_RISK_TILES, ...CREDIT_RISK_TILES];

// Tiles that show BOTH an absolute and a relative value and therefore support the
// "which value is large" switch.
//   primaryIsAbs = the .home-kpi-val span (styled large by default) holds the
//                  absolute value (Portfolio tiles) vs. the relative value (Market
//                  scenario tiles, where the large span is the rolling % figure).
//   defaultMode  = which value is large when the customer has not saved a choice yet;
//                  chosen to preserve each tile's existing look.
const TILE_VALUE_MODE = {
  nav:          { primaryIsAbs: true,  defaultMode: 'abs' },
  pv01:         { primaryIsAbs: true,  defaultMode: 'abs' },
  cpv01:        { primaryIsAbs: true,  defaultMode: 'abs' },
  vega:         { primaryIsAbs: true,  defaultMode: 'abs' },
  mkt_scen_var: { primaryIsAbs: false, defaultMode: 'rel' },
  mkt_scen_es:  { primaryIsAbs: false, defaultMode: 'rel' },
};

// tile_key -> boolean. null = not loaded yet -> everything visible by default.
let _visible = null;
// tile_key -> 'abs' | 'rel'. null = not loaded yet -> 'abs' default.
let _mode = null;

function isVisible(key) {
  if (!_visible) return true;
  return _visible.get(key) !== false; // default visible when a key is missing
}

function currentMode(key) {
  // Saved choice wins; otherwise fall back to the tile's default (preserves look).
  if (_mode && _mode.has(key)) return _mode.get(key) === 'rel' ? 'rel' : 'abs';
  return TILE_VALUE_MODE[key]?.defaultMode === 'rel' ? 'rel' : 'abs';
}

// Apply to the Overview cards: hide unchecked tiles + set the large/small value.
export function applyOverviewTileVisibility() {
  ALL_TILES.forEach(({ key }) => {
    document.querySelectorAll(`[data-tile="${key}"]`).forEach((el) => {
      el.style.display = isVisible(key) ? '' : 'none';
    });
  });
  applyTileValueModes();
}

// Toggle the swap class per applicable tile. `home-tile-swap` makes the .home-kpi-abs
// span large and the .home-kpi-val span small (CSS handles style + order). We swap
// whenever the value the user wants large does not already sit in the primary span.
function applyTileValueModes() {
  Object.entries(TILE_VALUE_MODE).forEach(([key, cfg]) => {
    const bigIsPrimary = (currentMode(key) === 'abs') === cfg.primaryIsAbs;
    const swap = !bigIsPrimary;
    document.querySelectorAll(`[data-tile="${key}"]`).forEach((el) => {
      el.classList.toggle('home-tile-swap', swap);
    });
  });
}

// --- generic checkbox list rendering --------------------------------------
function renderTilesCheckboxes(hostId, group) {
  const host = document.getElementById(hostId);
  if (!host) return;

  host.innerHTML = group.map(({ key, label }) => {
    const modeSel = TILE_VALUE_MODE[key] ? `
      <select class="overview-tile-mode" data-tile-key="${key}" title="Which value is shown large">
        <option value="abs" ${currentMode(key) === 'abs' ? 'selected' : ''}>Absolute large</option>
        <option value="rel" ${currentMode(key) === 'rel' ? 'selected' : ''}>Relative large</option>
      </select>` : '';
    return `
      <div style="display:flex; align-items:center; gap:8px;">
        <label style="display:flex; align-items:center; gap:8px; cursor:pointer; flex:0 0 200px;">
          <input type="checkbox" class="overview-tile-cb" data-tile-key="${key}" ${isVisible(key) ? 'checked' : ''}>
          <span>${label}</span>
        </label>
        ${modeSel}
      </div>`;
  }).join('');
}

function renderAllTilesCheckboxes() {
  renderTilesCheckboxes('overviewTilesList', OVERVIEW_TILES);
  renderTilesCheckboxes('marketRiskTilesList', MARKET_RISK_TILES);
  renderTilesCheckboxes('creditRiskTilesList', CREDIT_RISK_TILES);
}

// Kept for backward compatibility (Portfolio panel entry point).
export function renderOverviewTilesCheckboxes() {
  renderTilesCheckboxes('overviewTilesList', OVERVIEW_TILES);
}

// DataPump READ: fresh CustomerOverviewTileSetting rows (all groups in one table).
export function handleCustomerOverviewTileSettingData(rows) {
  const vis = new Map();
  const mode = new Map();
  (Array.isArray(rows) ? rows : []).forEach((r) => {
    const key = String(r.tile_key ?? r.TILE_KEY ?? '').trim();
    if (!key) return;
    vis.set(key, Number(r.is_visible ?? r.IS_VISIBLE ?? 1) !== 0);
    mode.set(key, String(r.value_mode ?? r.VALUE_MODE ?? 'abs').toLowerCase() === 'rel' ? 'rel' : 'abs');
  });
  _visible = vis;
  _mode = mode;

  renderAllTilesCheckboxes();
  applyOverviewTileVisibility();
}

// --- generic panel wiring: render checkboxes + bind Save (once) -----------
function initTilesPanel(hostId, btnId, statusId, group) {
  renderTilesCheckboxes(hostId, group);

  const btn = document.getElementById(btnId);
  if (btn && btn.dataset.bound !== '1') {
    btn.dataset.bound = '1';
    btn.addEventListener('click', async () => {
      const host = document.getElementById(hostId);
      const status = document.getElementById(statusId);

      const tiles = group.map(({ key }) => {
        const cb = host?.querySelector(`.overview-tile-cb[data-tile-key="${key}"]`);
        const sel = host?.querySelector(`.overview-tile-mode[data-tile-key="${key}"]`);
        return {
          tile_key: key,
          is_visible: cb && cb.checked ? 1 : 0,
          value_mode: sel ? sel.value : 'abs',
        };
      });

      try {
        const res = await window.api.invoke('customer-overview-tiles.save', { tiles });
        if (status) status.textContent = res?.success ? 'Saved.' : `Error: ${res?.error || 'unknown'}`;
      } catch (e) {
        if (status) status.textContent = `Error: ${e?.message || e}`;
      }
    });
  }
}

export function initOverviewTilesPanel() {
  initTilesPanel('overviewTilesList', 'overviewTilesSaveBtn', 'overviewTilesStatus', OVERVIEW_TILES);
}

export function initMarketRiskTilesPanel() {
  initTilesPanel('marketRiskTilesList', 'marketRiskTilesSaveBtn', 'marketRiskTilesStatus', MARKET_RISK_TILES);
}

export function initCreditRiskTilesPanel() {
  initTilesPanel('creditRiskTilesList', 'creditRiskTilesSaveBtn', 'creditRiskTilesStatus', CREDIT_RISK_TILES);
}
