'use strict';

// PD Normalization (Market Implied) — Settings-Panel für PD_M_norm = PD_M / factor.
// Eine Zeile (PD_NORM_SETTINGS, id=1). Speichern läuft über den generischen
// CRUD-Kanal update-data; das Python-Backend (resolve_norm_factor) liest dieselbe
// Tabelle: FIXED -> fixer Faktor, CALIBRATED -> aus ruhiger Basisphase berechnet.

import { appState } from '../../../renderer.js';

const TABLE = 'PD_NORM_SETTINGS';
const CONTAINER_ID = 'inputPdNormContainer';

let listenersInstalled = false;

function esc(v) {
  return String(v == null ? '' : v)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

const DEFAULTS = {
  mode: 'FIXED', fixed_factor: 10, calib_series: 'US_AA',
  calib_rating: 'AA', window_days: 365, series_scale: 100,
};

export function renderPdNormPanel() {
  if (!listenersInstalled) {
    document.addEventListener('pdnorm:ready', renderPdNormPanel);
    listenersInstalled = true;
  }

  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  const rows = appState.getPdNormSettings?.() || [];
  const s = { ...DEFAULTS, ...(rows[0] || {}) };
  const mode = String(s.mode || 'FIXED').toUpperCase();

  container.innerHTML = `
    <div class="pd-norm-form" style="display:flex; flex-direction:column; gap:8px; max-width:520px;">
      <div style="font-size:12px; color:var(--text-muted);">
        Risk Adjusted market-implied PD = PD_M / factor. <b>FIXED</b> = fixer Faktor
        (einfache Version). <b>CALIBRATED</b> = Faktor so, dass die implied PD im
        ruhigsten Fenster der Kalibrierungsserie der historischen PD entspricht.
      </div>

      <label>Mode<br>
        <select id="pdNormMode">
          <option value="FIXED"${mode === 'FIXED' ? ' selected' : ''}>FIXED (simple)</option>
          <option value="CALIBRATED"${mode === 'CALIBRATED' ? ' selected' : ''}>CALIBRATED</option>
        </select>
      </label>

      <label id="pdNormFixedRow">Fixed factor<br>
        <input type="number" step="any" id="pdNormFixed" value="${esc(s.fixed_factor)}" style="width:140px;">
      </label>

      <fieldset id="pdNormCalibFs" style="border:1px solid var(--border-subtle); border-radius:8px; padding:8px; display:flex; flex-direction:column; gap:6px;">
        <legend style="font-size:12px;">Calibration</legend>
        <label>Series (tblTS column)<br>
          <input id="pdNormSeries" value="${esc(s.calib_series)}" style="width:140px;"></label>
        <label>Rating (historical PD anchor)<br>
          <input id="pdNormRating" value="${esc(s.calib_rating)}" style="width:140px;"></label>
        <label>Window (days)<br>
          <input type="number" id="pdNormWindow" value="${esc(s.window_days)}" style="width:140px;"></label>
        <label>Series scale (raw → decimal, % = 100)<br>
          <input type="number" step="any" id="pdNormScale" value="${esc(s.series_scale)}" style="width:140px;"></label>
      </fieldset>

      <div class="button-wrapper" style="margin-top:4px;">
        <button id="pdNormSaveBtn" class="edit-button">Save</button>
      </div>
    </div>
  `;

  const modeSel  = container.querySelector('#pdNormMode');
  const fixedRow = container.querySelector('#pdNormFixedRow');
  const calibFs  = container.querySelector('#pdNormCalibFs');

  const applyMode = () => {
    const m = modeSel.value;
    fixedRow.style.opacity = m === 'FIXED' ? '1' : '0.45';
    calibFs.style.opacity  = m === 'CALIBRATED' ? '1' : '0.45';
  };
  modeSel.addEventListener('change', applyMode);
  applyMode();

  container.querySelector('#pdNormSaveBtn').onclick = () => {
    const newData = {
      mode: modeSel.value,
      fixed_factor: Number(container.querySelector('#pdNormFixed').value) || DEFAULTS.fixed_factor,
      calib_series: container.querySelector('#pdNormSeries').value.trim() || DEFAULTS.calib_series,
      calib_rating: container.querySelector('#pdNormRating').value.trim() || DEFAULTS.calib_rating,
      window_days: parseInt(container.querySelector('#pdNormWindow').value, 10) || DEFAULTS.window_days,
      series_scale: Number(container.querySelector('#pdNormScale').value) || DEFAULTS.series_scale,
    };
    window.api.send('update-data', {
      cleanTableName: TABLE,
      uniqueIdentifier: { column: 'id', value: 1 },
      newData,
    });
  };
}
