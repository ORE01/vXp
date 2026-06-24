// src/renderer/features/portfolio/addProductsDrawer.js
'use strict';

/**
 * Reusable "Add Products" drawer.
 *
 * Lists all known products (appState.getProdData()) with checkboxes.
 * On confirm it sends the selected PROD_IDs + target portfolio to the main
 * process (`add-products-to-portfolio`), which creates one DealsMain row per
 * product (PROD_ID only — other trade fields are filled later via Edit) and
 * removes the empty-portfolio placeholder/dummy row.
 *
 * Usage:
 *   openAddProductsDrawer({ appState, api, portName });
 */

import { showMessageBox } from '../../../core/ui/dialogs/confirm.js';

const DRAWER_ID = 'addProductsDrawer';

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
  drawer.className = 'add-products-drawer';
  document.body.appendChild(drawer);
  return drawer;
}

export function closeAddProductsDrawer() {
  const drawer = document.getElementById(DRAWER_ID);
  if (drawer) drawer.classList.remove('is-open');
}

function getProductRows(appState) {
  const rows = appState?.getProdData?.() || [];

  return rows
    .map((r) => ({
      prodId: String(r?.PROD_ID ?? r?.product_id ?? '').trim(),
      name: String(r?.DESCRIPTION ?? r?.product_name ?? '').trim(),
      type: String(r?.PRODUCT_TYPE ?? r?.product_type ?? '').trim(),
      issuer: String(r?.ISSUER ?? '').trim(),
      ccy: String(r?.CCY ?? r?.currency_code ?? '').trim(),
      maturity: String(r?.MATURITY ?? r?.maturity_date ?? '').trim(),
    }))
    .filter((r) => r.prodId)
    .sort((a, b) => a.prodId.localeCompare(b.prodId));
}

function rowHtml(p) {
  const search = `${p.prodId} ${p.name} ${p.type} ${p.issuer}`.toLowerCase();

  return `
    <label class="apd-row" data-search="${escapeHtml(search)}">
      <input type="checkbox" class="apd-check" value="${escapeHtml(p.prodId)}">
      <span class="apd-cell apd-prodid">${escapeHtml(p.prodId)}</span>
      <span class="apd-cell apd-name">${escapeHtml(p.name || '—')}</span>
      <span class="apd-cell apd-meta">${escapeHtml(p.issuer || '')}</span>
      <span class="apd-cell apd-meta">${escapeHtml(p.type || '')}</span>
      <span class="apd-cell apd-meta">${escapeHtml(p.ccy || '')}</span>
      <span class="apd-cell apd-meta">${escapeHtml(p.maturity || '')}</span>
    </label>`;
}

function renderDrawerHtml(port, products) {
  const list = products.length
    ? products.map(rowHtml).join('')
    : `<div class="apd-empty">No products available.</div>`;

  return `
    <div class="apd-header">
      <div class="apd-header-text">
        <div class="apd-eyebrow">Add Products</div>
        <h2 class="apd-title">${escapeHtml(port)}</h2>
        <div class="apd-subtitle">Select products to add to this portfolio.</div>
      </div>
      <div class="apd-actions">
        <button type="button" class="edit-button apd-add" data-apd-add disabled>Add selected</button>
        <button type="button" class="edit-button" data-apd-cancel>Cancel</button>
        <button type="button" class="apd-close" data-apd-close aria-label="close">&times;</button>
      </div>
    </div>

    <div class="apd-toolbar">
      <input type="text" class="apd-search" placeholder="Search PROD_ID, name, issuer…">
      <label class="apd-selectall">
        <input type="checkbox" class="apd-check-all"> Select all
      </label>
      <span class="apd-count">0 selected</span>
    </div>

    <div class="apd-list-head">
      <span></span>
      <span>PROD_ID</span>
      <span>Description</span>
      <span>Issuer</span>
      <span>Type</span>
      <span>CCY</span>
      <span>Maturity</span>
    </div>

    <div class="apd-list">${list}</div>

    <div class="apd-footer">
      <span class="apd-count">0 selected</span>
      <div class="apd-actions">
        <button type="button" class="edit-button" data-apd-cancel>Cancel</button>
        <button type="button" class="edit-button apd-add" data-apd-add disabled>Add selected</button>
      </div>
    </div>`;
}

function wireDrawer(drawer, { api, port }) {
  const listEl = drawer.querySelector('.apd-list');
  const searchEl = drawer.querySelector('.apd-search');
  const selectAllEl = drawer.querySelector('.apd-check-all');
  const countEls = Array.from(drawer.querySelectorAll('.apd-count'));
  const addBtns = Array.from(drawer.querySelectorAll('[data-apd-add]'));

  const getChecks = () => Array.from(drawer.querySelectorAll('.apd-check'));
  const getVisibleChecks = () =>
    getChecks().filter((c) => !c.closest('.apd-row')?.classList.contains('apd-hidden'));

  function refreshCount() {
    const checked = getChecks().filter((c) => c.checked);
    countEls.forEach((el) => { el.textContent = `${checked.length} selected`; });
    addBtns.forEach((btn) => { btn.disabled = checked.length === 0; });
  }

  // Search filter
  searchEl?.addEventListener('input', () => {
    const q = searchEl.value.trim().toLowerCase();
    drawer.querySelectorAll('.apd-row').forEach((row) => {
      const hay = row.getAttribute('data-search') || '';
      row.classList.toggle('apd-hidden', q !== '' && !hay.includes(q));
    });
    // keep "select all" in sync with what is visible
    if (selectAllEl) selectAllEl.checked = false;
  });

  // Select all (visible)
  selectAllEl?.addEventListener('change', () => {
    const on = selectAllEl.checked;
    getVisibleChecks().forEach((c) => { c.checked = on; });
    refreshCount();
  });

  // Per-row check
  listEl?.addEventListener('change', (e) => {
    if (e.target.classList.contains('apd-check')) refreshCount();
  });

  // Close / Cancel
  drawer.querySelector('[data-apd-close]')?.addEventListener('click', closeAddProductsDrawer);
  drawer.querySelectorAll('[data-apd-cancel]').forEach((b) =>
    b.addEventListener('click', closeAddProductsDrawer)
  );

  // Add selected (header + footer buttons share this handler)
  function onAdd() {
    const prodIds = getChecks().filter((c) => c.checked).map((c) => c.value);
    if (!prodIds.length) return;

    addBtns.forEach((btn) => {
      btn.disabled = true;
      btn.textContent = 'Adding…';
    });

    api?.send?.('add-products-to-portfolio', { port_name: port, prodIds });
    closeAddProductsDrawer();
  }

  addBtns.forEach((btn) => btn.addEventListener('click', onAdd));

  refreshCount();
}

export function openAddProductsDrawer({ appState, api, portName } = {}) {
  const port = String(portName ?? '').trim();

  if (!port || port === '__NONE__' || port === '__ALL__' || port === 'Select a table') {
    const msg = 'Please select or create a specific portfolio first.';
    if (typeof showMessageBox === 'function') showMessageBox(msg);
    else console.warn('[AddProductsDrawer]', msg);
    return;
  }

  const drawer = ensureDrawer();
  const products = getProductRows(appState);

  drawer.innerHTML = renderDrawerHtml(port, products);
  drawer.classList.add('is-open');

  wireDrawer(drawer, { appState, api, port });
}
