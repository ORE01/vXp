// src/renderer/features/products/structureTimeline/structureProductValuationDrawer.js

'use strict';

import { appState } from '../../../renderer.js';

function getProductRow(prodId) {
  const prodDataArr = appState.getProdData?.() || [];
  const needle = String(prodId ?? '').trim();

  return prodDataArr.find(
    row => String(row?.PROD_ID ?? '').trim() === needle
  ) || null;
}

function formatValue(value) {
  if (value === null || value === undefined || value === '') return '-';
  return String(value);
}

function formatNumber(value, digits = 6) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return formatValue(value);
  }

  return n.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits,
  });
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function gatherValuationInput(container, prodId) {
  const notionalRaw =
    container.querySelector('#productValuationNotional')?.value || '100';

  const asofDate =
    container.querySelector('#productValuationAsofDate')?.value || '';

  const notional = Number(String(notionalRaw).replace(',', '.'));

  return {
    prodId: String(prodId || '').trim(),
    notional: Number.isFinite(notional) ? notional : 100,
    asofDate: asofDate || null,
  };
}

function renderLoading(container) {
  const resultBox = container.querySelector('#productValuationResult');
  if (!resultBox) return;

  resultBox.innerHTML = `
    <div class="structure-valuation-status">
      Calculating product valuation...
    </div>
  `;
}

function renderError(container, error) {
  const resultBox = container.querySelector('#productValuationResult');
  if (!resultBox) return;

  const message =
    error?.message ||
    error?.error ||
    String(error || 'Unknown valuation error');

  resultBox.innerHTML = `
    <div class="structure-valuation-error">
      <strong>Valuation failed</strong>
      <pre>${escapeHtml(message)}</pre>
    </div>
  `;
}

function unwrapValuationResult(payload) {
  // Electron reply:
  // { success: true, prodId, result: { status, message, result: {...realResult} } }
  if (payload?.result?.result) {
    return payload.result.result;
  }

  // Alternative:
  // { status, message, result: {...realResult} }
  if (payload?.result) {
    return payload.result;
  }

  return payload || {};
}

function formatPercent(value, digits = 4) {
  const n = Number(value);

  if (!Number.isFinite(n)) {
    return formatValue(value);
  }

  return `${(n * 100).toFixed(digits)}%`;
}

function renderResult(container, payload) {
  const resultBox = container.querySelector('#productValuationResult');
  if (!resultBox) return;

  const result = unwrapValuationResult(payload);

  resultBox.innerHTML = `
    <div class="structure-valuation-result-card">
      <h4 class="structure-valuation-result-title">
        ✅ Valuation completed
      </h4>

      <div class="structure-drawer-note" style="margin-bottom:12px;">
        This product was valued as a standalone instrument using the current market snapshot.
      </div>

      <div class="structure-valuation-result-grid">
        <div>
          <span>Clean Price</span>
          <strong>${formatNumber(result.clean_price, 6)}</strong>
        </div>

        <div>
          <span>Present Value</span>
          <strong>${formatNumber(result.pv, 6)}</strong>
        </div>

        <div>
          <span>Yield</span>
          <strong>${formatPercent(result.yield, 4)}</strong>
        </div>

        <div>
          <span>PV01</span>
          <strong>${formatNumber(result.pv01, 6)}</strong>
        </div>

        <div>
          <span>CPV01</span>
          <strong>${formatNumber(result.cpv01, 6)}</strong>
        </div>

        <div>
          <span>Notional</span>
          <strong>${formatNumber(result.notional, 2)}</strong>
        </div>

        <div>
          <span>As of Date</span>
          <strong>${escapeHtml(formatValue(result.asof_date))}</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>${escapeHtml(formatValue(result.status || payload?.status || 'ok')).toUpperCase()}</strong>
        </div>
      </div>

      <details class="structure-valuation-raw">
        <summary>Technical raw result</summary>
        <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
      </details>
    </div>
  `;
}

function bindValuationEvents(container, prodId) {
  const button = container.querySelector('#calculateProductValuation');
  if (!button) return;

  button.addEventListener('click', () => {
    const request = gatherValuationInput(container, prodId);

    if (!request.prodId) {
      renderError(container, 'Missing PROD_ID. Save the product first.');
      return;
    }

    console.log('[PRODUCT VALUATION REQUEST]', request);

    renderLoading(container);

    if (!window.api?.send) {
      renderError(container, 'IPC bridge not available.');
      return;
    }

    window.api.send('price-product', request);
  });

  if (window.api?.receive) {
    window.api.receive('price-product-success', (payload) => {
      console.log('[PRODUCT VALUATION SUCCESS]', payload);
      renderResult(container, payload);
    });

    window.api.receive('price-product-error', (error) => {
      console.error('[PRODUCT VALUATION ERROR]', error);
      renderError(container, error);
    });
  }
}

export function renderProductValuationDrawer(container, prodId, options = {}) {
  if (!container) return;

  const row = getProductRow(prodId);

  if (!prodId) {
    container.innerHTML = `
      <section class="structure-drawer-card structure-drawer-error">
        Save the product first before running valuation.
      </section>
    `;
    return;
  }

  container.innerHTML = `
    <section class="structure-drawer-card">
      <div class="structure-drawer-header">
        <h3 class="structure-drawer-title">
          Product Valuation
        </h3>

        <span class="structure-drawer-prod-id">
          ${escapeHtml(prodId)}
        </span>

        <button
          id="closeProductValuationDrawer"
          type="button"
          class="structure-drawer-close"
          aria-label="Close drawer"
        >
          &times;
        </button>
      </div>

      <div class="structure-valuation-summary">
        <div>
          <span>Product</span>
          <strong>${escapeHtml(formatValue(row?.PROD_ID || prodId))}</strong>
        </div>

        <div>
          <span>Type</span>
          <strong>${escapeHtml(formatValue(row?.CouponType || row?.coupon_type))}</strong>
        </div>

        <div>
          <span>CCY</span>
          <strong>${escapeHtml(formatValue(row?.CCY || row?.currency_code))}</strong>
        </div>

        <div>
          <span>Model</span>
          <strong>${escapeHtml(formatValue(row?.MODEL || row?.pricing_model))}</strong>
        </div>
      </div>

      <div class="structure-drawer-grid">
        <label class="structure-drawer-field">
          <span class="structure-drawer-label">Notional</span>
          <input
            id="productValuationNotional"
            class="structure-drawer-input"
            value="${escapeHtml(options.notional || '100')}"
          />
        </label>

        <label class="structure-drawer-field">
          <span class="structure-drawer-label">As of Date</span>
          <input
            id="productValuationAsofDate"
            type="date"
            class="structure-drawer-input"
            value="${escapeHtml(options.asofDate || '')}"
          />
        </label>
      </div>

      <div class="structure-drawer-actions">
        <button
          id="calculateProductValuation"
          type="button"
          class="structure-action-button"
        >
          Calculate Product
        </button>
      </div>

      <div
        id="productValuationResult"
        class="structure-valuation-result"
      >
        <div class="structure-drawer-note">
          Click Calculate Product to run a standalone product valuation.
        </div>
      </div>
    </section>
  `;

  bindValuationEvents(container, prodId);

    container
    .querySelector('#closeProductValuationDrawer')
    ?.addEventListener('click', () => {
        container.style.display = 'none';

        if (typeof options.onClose === 'function') {
        options.onClose();
        }
    });
}