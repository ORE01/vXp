// src/renderer/features/CUSTOMER/tableLayouts/tableColumnFilters.js
'use strict';

/**
 * Data-driven per-column value filters for configurable tables.
 *
 * One multi-select per (visible) column, populated with the distinct values
 * from the data. The set of filters follows the visible columns automatically,
 * because configurableTable re-renders them on every column-layout change.
 *
 * State is kept in-memory per tableId. No dependency on the hard-coded
 * AppState filter config.
 */

import { getFormatRules } from '../../../utils/tableCellFormats.js';

const filterState = new Map(); // tableId -> { [columnKey]: Set<string> }

// Format a raw cell value the SAME way the table column does, so the filter
// list shows e.g. "99.000%" / "1,000,000" instead of 0.99 / 1000000.
// IMPORTANT: only the displayed LABEL is formatted; the stored filter value
// stays raw so applyColumnFilters() still matches row[key].
let _formatRules = null;
function formatFilterLabel(columnKey, rawValue) {
  if (!_formatRules) _formatRules = getFormatRules();
  const fn = _formatRules[columnKey];
  if (typeof fn !== 'function') return rawValue;
  const out = fn(rawValue);
  // formatNumber() yields '-' for non-numeric input; keep the raw value then.
  return (out === '-' && String(rawValue).trim() !== '-') ? rawValue : out;
}

function getState(tableId) {
  if (!filterState.has(tableId)) filterState.set(tableId, {});
  return filterState.get(tableId);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

export function clearColumnFilters(tableId) {
  filterState.set(tableId, {});
}

export function hasActiveColumnFilters(tableId) {
  const state = getState(tableId);
  return Object.values(state).some((set) => set && set.size);
}

// Keep only rows that match every active column filter.
export function applyColumnFilters(rows, tableId) {
  const state = getState(tableId);
  const active = Object.entries(state).filter(([, set]) => set && set.size);
  if (!active.length) return rows;

  return (rows || []).filter((row) =>
    active.every(([key, set]) => set.has(String(row?.[key] ?? '')))
  );
}

export function renderColumnFilters({ tableId, containerId, columns, allRows, onChange }) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const state = getState(tableId);
  const keysSig = columns.map((c) => c.key).join('|');

  // Bind the change handler once (delegated).
  if (container.dataset.tcfBound !== '1') {
    container.dataset.tcfBound = '1';
    container.addEventListener('change', (event) => {
      const sel = event.target;
      if (!(sel instanceof HTMLSelectElement) || !sel.classList.contains('tcf-select')) return;

      const col = sel.getAttribute('data-col');
      const chosen = Array.from(sel.selectedOptions).map((o) => o.value);

      const st = getState(tableId);
      // "ALL" (or nothing) selected -> this column's filter is cleared,
      // independently of the other columns.
      if (chosen.includes('__ALL__') || chosen.length === 0) {
        delete st[col];
      } else {
        st[col] = new Set(chosen);
      }

      if (typeof onChange === 'function') onChange();
    });
  }

  // Only rebuild the DOM when the column SET changed (e.g. a column was toggled
  // in the selector). On a plain filter change the columns are identical, so we
  // skip the rebuild and keep the user's open/scrolled selects intact.
  if (container.dataset.tcfCols === keysSig) return;
  container.dataset.tcfCols = keysSig;

  container.innerHTML = columns.map((col) => {
    const values = [...new Set((allRows || []).map((r) => String(r?.[col.key] ?? '')))]
      .filter((v) => v !== '')
      .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

    const selected = state[col.key] || new Set();
    const noFilter = selected.size === 0;

    // "ALL" resets just this column's filter (selected when no filter is active).
    const allOpt = `<option value="__ALL__"${noFilter ? ' selected' : ''}>ALL</option>`;

    const opts = values
      .map((v) => `<option value="${escapeHtml(v)}"${selected.has(v) ? ' selected' : ''}>${escapeHtml(v)}</option>`)
      .join('');

    return `
      <div>
        <p>${escapeHtml(col.label)}:</p>
        <select multiple class="select-dropdown tcf-select" data-col="${escapeHtml(col.key)}">${allOpt}${opts}</select>
      </div>`;
  }).join('');
}

// =====================================================
// Header-integrated filters: a funnel button per column header that opens a
// value-picker popover. Reuses the same filter state as the bar variant.
// =====================================================

let _openPopover = null;       // { el, btn, onChange }
let _headerEventsBound = false;

function closeOpenPopover(apply) {
  if (!_openPopover) return;
  const { el, btn, onChange } = _openPopover;
  _openPopover = null;
  el.remove();
  btn.classList.remove('is-open');
  if (apply && typeof onChange === 'function') onChange();
}

function openPopover(btn, { tableId, col, allRows, onChange }) {
  closeOpenPopover(false);

  const state = getState(tableId);
  const selected = state[col.key] || new Set();

  const values = [...new Set((allRows || []).map((r) => String(r?.[col.key] ?? '')))]
    .filter((v) => v !== '')
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: 'base' }));

  const el = document.createElement('div');
  el.className = 'tcf-h-popover';
  el.innerHTML = `
    <input type="text" class="tcf-h-search" placeholder="Search…">
    <label class="tcf-h-all"><input type="checkbox" class="tcf-h-allcb"${selected.size === 0 ? ' checked' : ''}> ALL</label>
    <div class="tcf-h-list">
      ${values.map((v) => `<label><input type="checkbox" class="tcf-h-cb" value="${escapeHtml(v)}"${selected.has(v) ? ' checked' : ''}> ${escapeHtml(formatFilterLabel(col.key, v))}</label>`).join('')}
    </div>`;

  document.body.appendChild(el);

  const rect = btn.getBoundingClientRect();
  el.style.top = `${Math.max(4, Math.min(rect.bottom + 4, window.innerHeight - 340))}px`;
  el.style.left = `${Math.max(4, Math.min(rect.left, window.innerWidth - 252))}px`;

  el.addEventListener('mousedown', (e) => e.stopPropagation());
  el.addEventListener('click', (e) => e.stopPropagation());

  const st = getState(tableId);
  const allCb = el.querySelector('.tcf-h-allcb');

  allCb.addEventListener('change', () => {
    if (allCb.checked) {
      delete st[col.key];
      el.querySelectorAll('.tcf-h-cb').forEach((cb) => { cb.checked = false; });
    }
  });

  el.querySelector('.tcf-h-list').addEventListener('change', (e) => {
    if (!e.target.classList.contains('tcf-h-cb')) return;
    const chosen = new Set(Array.from(el.querySelectorAll('.tcf-h-cb:checked')).map((cb) => cb.value));
    if (chosen.size) st[col.key] = chosen;
    else delete st[col.key];
    allCb.checked = chosen.size === 0;
  });

  el.querySelector('.tcf-h-search').addEventListener('input', (e) => {
    const q = e.target.value.trim().toLowerCase();
    el.querySelectorAll('.tcf-h-list label').forEach((lab) => {
      const t = (lab.textContent || '').trim().toLowerCase();
      lab.style.display = (q === '' || t.includes(q)) ? '' : 'none';
    });
  });

  el.querySelector('.tcf-h-search').focus();
  btn.classList.add('is-open');
  _openPopover = { el, btn, onChange };
}

function ensureHeaderFilterEvents() {
  if (_headerEventsBound) return;
  _headerEventsBound = true;

  document.addEventListener('click', (e) => {
    const btn = e.target.closest && e.target.closest('.tcf-h-btn');
    if (btn) {
      e.preventDefault();
      e.stopPropagation();
      if (_openPopover && _openPopover.btn === btn) closeOpenPopover(true);
      else if (btn.__tcfCtx) openPopover(btn, btn.__tcfCtx);
      return;
    }
    if (_openPopover && !(e.target.closest && e.target.closest('.tcf-h-popover'))) {
      closeOpenPopover(true);
    }
  }, true);

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _openPopover) closeOpenPopover(true);
  });
}

export function attachHeaderColumnFilters({ tableId, tableContainer, columns, allRows, onChange }) {
  ensureHeaderFilterEvents();
  closeOpenPopover(false); // drop any orphaned popover from a previous render

  const table = tableContainer.querySelector('table');
  if (!table) return;

  const state = getState(tableId);

  table.querySelectorAll('thead th').forEach((th, i) => {
    const col = columns[i];
    if (!col || th.querySelector('.tcf-h')) return;

    const active = !!(state[col.key] && state[col.key].size);
    if (active) th.classList.add('tcf-filtered');

    // Wrap the header label so truncation happens on the label (not the whole
    // cell) -> the funnel button stays visible even for long/active headers.
    // textContent is unchanged, so header-label detection keeps working.
    if (!th.querySelector('.tcf-h-label')) {
      const label = document.createElement('span');
      label.className = 'tcf-h-label';
      while (th.firstChild) label.appendChild(th.firstChild);
      th.appendChild(label);
    }

    const wrap = document.createElement('span');
    wrap.className = 'tcf-h';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tcf-h-btn' + (active ? ' is-active' : '');
    btn.title = 'Filter';
    btn.setAttribute('aria-label', 'Filter');
    // Glyph comes from CSS ::before so it is NOT part of th.textContent
    // (keeps header-label detection like attachIdLinks working).
    btn.__tcfCtx = { tableId, col, allRows, onChange };

    wrap.appendChild(btn);
    th.appendChild(wrap);
  });
}
