// src/renderer/features/portfolio/fillTradeDetailsDrawer.js
'use strict';

/**
 * "Fill Trade Details" drawer.
 *
 * Shows every deal of a portfolio in an editable grid so the still-empty trade
 * fields (Notional, Trade Date, Category, Depot Bank, Buy Price) can be filled
 * in for all products at once. PROD_ID is shown read-only as a reference.
 *
 * On save it sends one batch to the main process (`update-deals-fields`), which
 * updates DealsMain per TRADE_ID in a transaction and refreshes the table.
 *
 * Usage:
 *   openFillTradeDetailsDrawer({ appState, api, portName });
 */

import { convertDateToISO } from '../../../utils/tableCellFormats.js';
import { isDayToken, resolveDayISO } from '../../products/structureTimeline/relativeDates.js';
import { showMessageBox } from '../../../core/ui/dialogs/confirm.js';

const DRAWER_ID = 'fillTradeDetailsDrawer';

const CATEGORIES = ['1_Kontokorrentkonten', '5_Termineinlagen', '2_lgfr_Anlagevermögen'];

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function ensureDrawer() {
  let drawer = document.getElementById(DRAWER_ID);
  if (drawer) return drawer;

  drawer = document.createElement('aside');
  drawer.id = DRAWER_ID;
  drawer.className = 'ftd-drawer';
  document.body.appendChild(drawer);
  return drawer;
}

export function closeFillTradeDetailsDrawer() {
  const drawer = document.getElementById(DRAWER_ID);
  if (drawer) drawer.classList.remove('is-open');
}

function getPortfolioDeals(appState, port) {
  const rows = appState?.getAllDealsData?.() || [];
  const target = String(port).trim();

  return rows
    .filter((r) => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === target)
    .map((r) => ({
      tradeId: String(r?.TRADE_ID ?? '').trim(),
      prodId: String(r?.PROD_ID ?? r?.product_id ?? '').trim(),
      notional: r?.NOTIONAL ?? '',
      tradeDate: r?.TRADE_DATE ?? '',
      category: r?.CATEGORY ?? '',
      depotBank: r?.DEPOT_BANK ?? r?.Depotbank ?? '',
      priceBuy: r?.PRICE_BUY ?? '',
    }))
    .filter((r) => r.tradeId);
}

function categoryOptions(selected) {
  const sel = String(selected ?? '').trim();
  const opts = ['<option value=""></option>']
    .concat(
      CATEGORIES.map((c) => {
        const isSel = c === sel ? ' selected' : '';
        return `<option value="${escapeHtml(c)}"${isSel}>${escapeHtml(c)}</option>`;
      })
    );

  // Keep an unknown existing value selectable
  if (sel && !CATEGORIES.includes(sel)) {
    opts.push(`<option value="${escapeHtml(sel)}" selected>${escapeHtml(sel)}</option>`);
  }
  return opts.join('');
}

function rowHtml(d) {
  const emptyCls = (v) => (String(v ?? '').trim() === '' ? ' ftd-empty' : '');

  // TRADE_DATE kann absolut ODER als relativer Token (today / today+-N) vorliegen.
  // Token hat Vorrang und wird gespeichert; das Datumsfeld zeigt den aufgeloesten Wert.
  const rawTd = String(d.tradeDate ?? '').trim();
  const tdIsTok = isDayToken(rawTd);
  const tdToken = tdIsTok ? rawTd : '';
  const tdIso = tdIsTok ? resolveDayISO(rawTd) : convertDateToISO(rawTd);
  const tdOrig = tdIsTok ? rawTd : tdIso; // gespeicherter Originalwert (fuer Diff)

  const cat = String(d.category ?? '').trim();

  return `
    <div class="ftd-row" data-trade-id="${escapeHtml(d.tradeId)}">
      <span class="ftd-cell ftd-prodid" title="${escapeHtml(d.prodId)}">${escapeHtml(d.prodId || '—')}</span>
      <input class="ftd-input${emptyCls(d.notional)}"  data-field="NOTIONAL"   data-original="${escapeHtml(d.notional)}"  type="text" value="${escapeHtml(d.notional)}"  placeholder="Notional">
      <div class="ftd-td-wrap" data-td-original="${escapeHtml(tdOrig)}" style="display:flex; gap:4px; align-items:center;">
        <input class="ftd-input ftd-td-date${emptyCls(rawTd)}" data-td-date="1" type="date" value="${escapeHtml(tdIso)}" style="flex:1 1 auto; min-width:0;">
        <input class="ftd-input ftd-td-token" data-td-token="1" type="text" value="${escapeHtml(tdToken)}" placeholder="today-5" title="Relative: today / today+N / today-N" style="flex:0 0 58px; min-width:0;">
      </div>
      <select class="ftd-input${emptyCls(d.category)}" data-field="CATEGORY"   data-original="${escapeHtml(cat)}">${categoryOptions(d.category)}</select>
      <input class="ftd-input${emptyCls(d.depotBank)}" data-field="Depotbank"  data-original="${escapeHtml(d.depotBank)}" type="text" value="${escapeHtml(d.depotBank)}" placeholder="Depot Bank">
      <input class="ftd-input${emptyCls(d.priceBuy)}"  data-field="PRICE_BUY"  data-original="${escapeHtml(d.priceBuy)}"  type="text" value="${escapeHtml(d.priceBuy)}"  placeholder="Buy Price">
    </div>`;
}

function renderDrawerHtml(port, deals) {
  const list = deals.length
    ? deals.map(rowHtml).join('')
    : `<div class="ftd-empty-msg">No deals in this portfolio yet. Use "Add Products" first.</div>`;

  return `
    <div class="ftd-header">
      <div class="ftd-header-text">
        <div class="ftd-eyebrow">Fill Trade Details</div>
        <h2 class="ftd-title">${escapeHtml(port)}</h2>
        <div class="ftd-subtitle">Complete the trade fields for each product.</div>
      </div>
      <div class="ftd-actions">
        <button type="button" class="edit-button ftd-save" data-ftd-save ${deals.length ? '' : 'disabled'}>Save all</button>
        <button type="button" class="edit-button" data-ftd-cancel>Cancel</button>
        <button type="button" class="ftd-close" data-ftd-close aria-label="close">&times;</button>
      </div>
    </div>

    <div class="ftd-list-head">
      <span>PROD_ID</span>
      <span>Notional</span>
      <span>Trade Date</span>
      <span>Category</span>
      <span>Depot Bank</span>
      <span>Buy Price</span>
    </div>

    <div class="ftd-list">${list}</div>

    <div class="ftd-footer">
      <span class="ftd-hint">Empty fields are highlighted.</span>
      <button type="button" class="edit-button ftd-save" data-ftd-save ${deals.length ? '' : 'disabled'}>Save all</button>
    </div>`;
}

function wireDrawer(drawer, { api, port }) {
  const listEl = drawer.querySelector('.ftd-list');
  const saveBtns = Array.from(drawer.querySelectorAll('[data-ftd-save]'));

  // Live empty-highlight + relatives TRADE_DATE-Token-Wiring
  listEl?.addEventListener('input', (e) => {
    const el = e.target;
    if (!el.classList?.contains('ftd-input')) return;
    if (el.hasAttribute('data-td-token')) {
      // Token tippen -> Datumsfeld frisch berechnen (Token selbst nicht als "leer" markieren)
      const wrap = el.closest('.ftd-td-wrap');
      const dateEl = wrap?.querySelector('[data-td-date]');
      const t = String(el.value || '').trim();
      if (t && dateEl) { const iso = resolveDayISO(t); if (iso) dateEl.value = iso; }
      if (dateEl) dateEl.classList.toggle('ftd-empty', String(dateEl.value ?? '').trim() === '');
      return;
    }
    el.classList.toggle('ftd-empty', String(el.value ?? '').trim() === '');
  });
  listEl?.addEventListener('change', (e) => {
    const el = e.target;
    if (!el.classList?.contains('ftd-input')) return;
    if (el.hasAttribute('data-td-date')) {
      // Datum manuell geaendert -> Token leeren (= absoluter Modus)
      const wrap = el.closest('.ftd-td-wrap');
      const tokEl = wrap?.querySelector('[data-td-token]');
      if (tokEl && String(tokEl.value || '').trim()) tokEl.value = '';
      el.classList.toggle('ftd-empty', String(el.value ?? '').trim() === '');
      return;
    }
    if (el.hasAttribute('data-td-token')) return;
    el.classList.toggle('ftd-empty', String(el.value ?? '').trim() === '');
  });

  // Close / Cancel
  drawer.querySelector('[data-ftd-close]')?.addEventListener('click', closeFillTradeDetailsDrawer);
  drawer.querySelectorAll('[data-ftd-cancel]').forEach((b) =>
    b.addEventListener('click', closeFillTradeDetailsDrawer)
  );

  function onSave() {
    // Diff-based: only send fields the user actually changed, so untouched
    // values (incl. dates we couldn't pre-fill) are never overwritten.
    const updates = [];

    drawer.querySelectorAll('.ftd-row').forEach((row) => {
      const changed = {};
      let hasChange = false;

      row.querySelectorAll('.ftd-input').forEach((inp) => {
        const field = inp.getAttribute('data-field');
        if (!field) return; // TRADE_DATE-Composite (Date/Token) hat kein data-field -> separat unten
        const cur = String(inp.value ?? '').trim();
        const orig = String(inp.getAttribute('data-original') ?? '').trim();
        if (cur !== orig) {
          changed[field] = cur;
          hasChange = true;
        }
      });

      // TRADE_DATE: Token hat Vorrang, sonst absolutes Datum. Gegen gespeicherten Originalwert diffen.
      const tdWrap = row.querySelector('.ftd-td-wrap');
      if (tdWrap) {
        const tok = String(tdWrap.querySelector('[data-td-token]')?.value ?? '').trim();
        const dateVal = String(tdWrap.querySelector('[data-td-date]')?.value ?? '').trim();
        const cur = tok || dateVal;
        const orig = String(tdWrap.getAttribute('data-td-original') ?? '').trim();
        if (cur !== orig) {
          changed['TRADE_DATE'] = cur;
          hasChange = true;
        }
      }

      if (hasChange) {
        updates.push({ TRADE_ID: row.getAttribute('data-trade-id'), ...changed });
      }
    });

    if (!updates.length) {
      closeFillTradeDetailsDrawer();
      return;
    }

    saveBtns.forEach((b) => { b.disabled = true; b.textContent = 'Saving…'; });
    api?.send?.('update-deals-fields', { port_name: port, updates });
    closeFillTradeDetailsDrawer();
  }

  saveBtns.forEach((b) => b.addEventListener('click', onSave));
}

export function openFillTradeDetailsDrawer({ appState, api, portName } = {}) {
  const port = String(portName ?? '').trim();

  if (!port || port === '__NONE__' || port === '__ALL__' || port === 'Select a table') {
    const msg = 'Please select or create a specific portfolio first.';
    if (typeof showMessageBox === 'function') showMessageBox(msg);
    else console.warn('[FillTradeDetailsDrawer]', msg);
    return;
  }

  const drawer = ensureDrawer();
  const deals = getPortfolioDeals(appState, port);

  drawer.innerHTML = renderDrawerHtml(port, deals);
  drawer.classList.add('is-open');

  wireDrawer(drawer, { appState, api, port });
}
