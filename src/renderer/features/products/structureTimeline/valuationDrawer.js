// src/renderer/features/products/structureTimeline/valuationDrawer.js

'use strict';

import { appState } from '../../../renderer.js';
import { parseDeNumber } from '../../../utils/tableCellFormats.js';

function getValuationResultCache() {
  if (!window.__productValuationResultCache) {
    window.__productValuationResultCache = {};
  }

  return window.__productValuationResultCache;
}

function getValuationStaleMap() {
  if (!window.__productValuationStaleByProdId) {
    window.__productValuationStaleByProdId = {};
  }

  return window.__productValuationStaleByProdId;
}

function getValuationCacheKey(prodId) {
  return String(prodId || '').trim();
}

function cacheValuationResult(prodId, html, payload = null) {
  const key = getValuationCacheKey(prodId);
  if (!key || !html) return;

  getValuationResultCache()[key] = {
    html,
    payload,
    cachedAt: new Date().toISOString(),
  };
}

function getCachedValuationResult(prodId) {
  const key = getValuationCacheKey(prodId);
  if (!key) return null;

  return getValuationResultCache()[key] || null;
}

function restoreCachedValuationResult(container, prodId) {
  const resultBox = container.querySelector('#productValuationResult');
  if (!resultBox) return;

  const key = getValuationCacheKey(prodId);
  const cached = getCachedValuationResult(key);

  if (!cached?.html) return;

  const isStale = getValuationStaleMap()[key] === true;

  resultBox.innerHTML = `
    ${
      isStale
        ? `
          <div class="structure-drawer-note" style="margin-bottom:12px;">
            ⚠️ Previous valuation result preserved. Model setup has changed. Click Calculate Product to update.
          </div>
        `
        : ''
    }
    ${cached.html}
  `;
}

// Leere Bewertungs-Box: gleiche Raster-Optik, alle Werte "–". Bleibt beim Oeffnen UND
// waehrend der Berechnung offen (nur Titel/Hinweis wechseln), bis "Calculate Product"
// die echten Werte einsetzt.
function renderEmptyResult(
  container,
  note = 'Click Calculate Product to run a standalone product valuation.',
  title = 'Valuation'
) {
  const resultBox = container.querySelector('#productValuationResult');
  if (!resultBox) return;
  const d = '–';
  resultBox.innerHTML = `
    <div class="structure-valuation-result-card">
      <h4 class="structure-valuation-result-title">${escapeHtml(title)}</h4>

      <div class="structure-drawer-note" style="margin-bottom:12px;">
        ${escapeHtml(note)}
      </div>

      <div class="structure-valuation-result-grid svr-row--main">
        <div><span>Clean Price</span><strong>${d}</strong></div>
        <div class="cs-spread-tile"><span>Credit Spread</span><strong>${d}</strong></div>
        <div><span>Rating</span><strong>${d}</strong></div>
        <div><span>Yield</span><strong>${d}</strong></div>
        <div><span>Status</span><strong>${d}</strong></div>
      </div>

      <div class="structure-valuation-result-grid svr-row--3">
        <div><span>IR PV01 (price bp)</span><strong>${d}</strong></div>
        <div><span>CS PV01 (price bp)</span><strong>${d}</strong></div>
        <div><span>Vega PV100 (price bp)</span><strong>${d}</strong></div>
      </div>

      <div class="structure-valuation-result-grid svr-row--3">
        <div><span>Present Value (dirty)</span><strong>${d}</strong></div>
        <div><span>Notional</span><strong>${d}</strong></div>
        <div><span>As of Date</span><strong>${d}</strong></div>
      </div>
    </div>
  `;
}

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

  return n.toLocaleString('de-DE', {
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

const FALLBACK_DEFAULT_DISCOUNT_CURVE_BY_CCY = {
  EUR: 'EUR:SWAP:6M',
  USD: 'USD:SWAP:3M',
};

function normalizeCcy(value) {
  return String(value || '').trim().toUpperCase();
}

function getProductCcy(row) {
  return normalizeCcy(
    row?.currency_code ||
    row?.CCY ||
    row?.CURRENCY ||
    row?.Currency
  ) || 'EUR';
}

function getCurveId(curve) {
  return String(
    curve?.curve_id ||
    curve?.CURVE_ID ||
    curve?.CurveId ||
    curve ||
    ''
  ).trim();
}

function getCurveCcy(curveId) {
  const id = String(curveId || '').trim().toUpperCase();

  if (!id) return '';

  if (id === 'EUSWAP') return 'EUR';

  if (id.includes(':')) {
    return id.split(':')[0].trim().toUpperCase();
  }

  if (id.startsWith('EUR')) return 'EUR';
  if (id.startsWith('USD')) return 'USD';
  if (id.startsWith('CHF')) return 'CHF';
  if (id.startsWith('GBP')) return 'GBP';

  return '';
}

function isCurveAllowedForProductCcy(curveId, productCcy) {
  const curveCcy = getCurveCcy(curveId);
  const normalizedProductCcy = normalizeCcy(productCcy);

  return Boolean(curveCcy && normalizedProductCcy && curveCcy === normalizedProductCcy);
}

function getDefaultDiscountCurveIdForCcy(productCcy, discountOptions = []) {
  const ccy = normalizeCcy(productCcy) || 'EUR';

  const allowed = discountOptions.filter(curveId => {
    return isCurveAllowedForProductCcy(curveId, ccy);
  });

  const configuredDefault = FALLBACK_DEFAULT_DISCOUNT_CURVE_BY_CCY[ccy];

  if (configuredDefault && allowed.includes(configuredDefault)) {
    return configuredDefault;
  }

  return (
    allowed.find(curveId => String(curveId).toUpperCase().includes(':SWAP:3M')) ||
    allowed.find(curveId => String(curveId).toUpperCase().includes(':SWAP:6M')) ||
    allowed.find(curveId => String(curveId).toUpperCase().includes(':OIS')) ||
    allowed[0] ||
    configuredDefault ||
    ''
  );
}

function getTodayIsoDate() {
  const now = new Date();
  const tzOffsetMs = now.getTimezoneOffset() * 60 * 1000;
  return new Date(now.getTime() - tzOffsetMs).toISOString().slice(0, 10);
}

function getDiscountCurveOptions() {
  const ratesActive =
    appState.getRATES_ACTIVEData?.() ||
    appState.getRatesActiveData?.() ||
    appState.getRatesActive?.() ||
    appState.getRATES_ACTIVE?.() ||
    [];

  const fromRatesActive = ratesActive
    .map(row => row?.curve_id || row?.CURVE_ID || row?.CurveId)
    .map(value => String(value || '').trim())
    .filter(Boolean);

  return Array.from(new Set(fromRatesActive));
}

function renderInitialDiscountCurveSelector(options = {}, row = null) {
  const productCcy = getProductCcy(row);
  const allDiscountOptions = getDiscountCurveOptions();

  const allowedDiscountOptions = allDiscountOptions.filter(curveId => {
    return isCurveAllowedForProductCcy(curveId, productCcy);
  });

  const storedDiscountCurve =
    options.discount_curve_id ||
    options.discountCurveId ||
    row?.discount_curve_id ||
    row?.DISCOUNT_CURVE_ID ||
    row?.pricing_config?.discount_curve_id ||
    '';

  const selectedDiscountCurve = isCurveAllowedForProductCcy(storedDiscountCurve, productCcy)
    ? storedDiscountCurve
    : getDefaultDiscountCurveIdForCcy(productCcy, allDiscountOptions);

  const optionSet = allowedDiscountOptions.includes(selectedDiscountCurve)
    ? allowedDiscountOptions
    : [selectedDiscountCurve, ...allowedDiscountOptions].filter(Boolean);

  const helpText = optionSet.length
    ? `Only ${productCcy} discount curves are available for this product.`
    : `No ${productCcy} discount curve found. Check RATES_ACTIVE.`;

  return `
    <label class="structure-drawer-field">
      <span class="structure-drawer-label">Discount Curve</span>
      <select
        id="valuationDiscountCurveSelect"
        class="structure-drawer-input"
        data-product-ccy="${escapeHtml(productCcy)}"
      >
        ${optionSet.map((curveId) => {
          const selected = curveId === selectedDiscountCurve ? 'selected' : '';
          return `<option value="${escapeHtml(curveId)}" ${selected}>${escapeHtml(curveId)}</option>`;
        }).join('')}
      </select>
      <span class="structure-drawer-hint">
        ${escapeHtml(helpText)}
      </span>
    </label>
  `;
}

function updateProductCSOverrideWarning(prodId, csValue){
  const warningContainer = document.getElementById('creditWarningContainer');
  const warningLight = document.getElementById('creditWarning');
  const warningText = document.getElementById('creditWarningText');

  if (!warningContainer || !warningLight || !warningText) return;

  const hasOverride =
    csValue !== null &&
    csValue !== undefined &&
    String(csValue).trim() !== '';

  if (hasOverride) {
    warningContainer.style.display = 'flex';
    warningLight.style.backgroundColor = 'red';
    warningText.textContent = `Product CS Override active: ${prodId}`;
    warningText.title = `CS spread override for ${prodId}: ${String(csValue).trim()} bp`;
  } else {
    warningContainer.style.display = 'none';
    warningLight.style.backgroundColor = 'transparent';
    warningText.textContent = '';
    warningText.title = '';
  }
}

function gatherValuationInput(container, prodId) {
  const notionalRaw =
    container.querySelector('#productValuationNotional')?.value || '100';

  const asofDate =
    container.querySelector('#productValuationAsofDate')?.value || '';

  const discountCurveSelect = container.querySelector('#valuationDiscountCurveSelect');

  const discountCurveId =
    discountCurveSelect?.value ||
    getDefaultDiscountCurveIdForCcy(
      discountCurveSelect?.dataset?.productCcy || 'EUR',
      getDiscountCurveOptions()
    );

  const csSpreadOverrideBp =
    container.querySelector('#productValuationCsSpreadOverrideBp')?.value || '';

  const notional = Number(String(notionalRaw).replace(',', '.'));

  return {
    prodId: String(prodId || '').trim(),
    notional: Number.isFinite(notional) ? notional : 100,
    asofDate: asofDate || null,
    discount_curve_id: discountCurveId,
    cs_spread_override_bp: csSpreadOverrideBp || null,
  };
}

function renderLoading(container) {
  // Box offen halten (Raster bleibt, "–"), nur Hinweis auf "calculating" — kein Zuklappen.
  renderEmptyResult(container, '⏳ Calculating product valuation…', 'Valuation — calculating…');
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

  return `${(n * 100).toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;
}

// Cashflow-Tabellen-Formatter: Datum -> YYYY-MM-DD, sonst "-".
function fmtCfDate(value) {
  if (value === null || value === undefined || value === '') return '-';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;                 // bereits YYYY-MM-DD
  const m = s.match(/^(\d{4})(\d{2})(\d{2})$/);                // YYYYMMDD
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  const d = new Date(s);                                       // ISO / parsebar
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const mo = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${mo}-${da}`;
  }
  return s;                                                    // Fallback: roh
}

// Feste Dezimalstellen, "-" falls nicht numerisch/leer.
function formatOptionalNumber(value, digits = 6) {
  // Wichtig: null/undefined/'' VOR Number() abfangen — Number(null) === 0
  // würde sonst fehlende Werte fälschlich als 0.000000 anzeigen.
  if (value === null || value === undefined || value === '') return '-';
  const n = Number(value);
  return Number.isFinite(n) ? n.toLocaleString('de-DE', { minimumFractionDigits: digits, maximumFractionDigits: digits }) : '-';
}

function renderCashflowTable(cashflows = []) {
  if (!Array.isArray(cashflows) || cashflows.length === 0) {
    return `
      <div class="structure-drawer-note" style="margin-top:12px;">
        No cashflows available.
      </div>
    `;
  }

  return `
    <div class="structure-cashflow-section">
      <div class="structure-cashflow-header">
        <h4>Cashflows</h4>
        <span>${cashflows.length} rows</span>
      </div>

      <div class="structure-cashflow-table-wrap">
        <table class="structure-cashflow-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Type</th>
              <th>Start</th>
              <th>End</th>
              <th>Period</th>
              <th>Rate</th>
              <th>Coupon CF</th>
              <th>DF</th>
              <th>PV</th>
            </tr>
          </thead>
          <tbody>
            ${cashflows.map((cf, i) => `
              <tr>
                <td>${escapeHtml(formatValue(cf.cashflow_no ?? i))}</td>
                <td>${escapeHtml(formatValue(cf.cashflow_type ?? cf.type))}</td>
                <td>${escapeHtml(fmtCfDate(cf.start_date))}</td>
                <td>${escapeHtml(fmtCfDate(cf.end_date ?? cf.pay_date))}</td>
                <td>${escapeHtml(formatOptionalNumber(cf.period, 6))}</td>
                <td>${escapeHtml(formatOptionalNumber(cf.rate ?? cf.coupon, 6))}</td>
                <td>${escapeHtml(formatOptionalNumber(cf.coupon_cf ?? cf.amount, 4))}</td>
                <td>${escapeHtml(formatOptionalNumber(cf.df, 6))}</td>
                <td>${escapeHtml(formatOptionalNumber(cf.pv, 4))}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `;
}

// Cashflow-Sektion: bei Swap-Replication (result.cashflows_by_leg) ein Toggle
// Fix/Floating; sonst die normale Einzeltabelle.
function renderCashflowSection(result) {
  const byLeg = result?.cashflows_by_leg;
  const fix = Array.isArray(byLeg?.FIX) ? byLeg.FIX : [];
  const flt = Array.isArray(byLeg?.FLOAT) ? byLeg.FLOAT : [];

  if (!fix.length && !flt.length) {
    return renderCashflowTable(result?.cashflows || []);
  }

  return `
    <div class="structure-cashflow-legs">
      <div class="structure-cashflow-header">
        <h4>Cashflows</h4>
        <div class="cf-leg-toggle" role="tablist">
          <button type="button" class="cf-leg-btn is-active" data-leg="FIX">Fix leg</button>
          <button type="button" class="cf-leg-btn" data-leg="FLOAT">Floating leg</button>
        </div>
      </div>
      <div class="cf-leg-panel" data-leg-panel="FIX">${renderLegTable(fix, 'FIX')}</div>
      <div class="cf-leg-panel" data-leg-panel="FLOAT" style="display:none;">${renderLegTable(flt, 'FLOAT')}</div>
    </div>
  `;
}

// Eine Leg-Tabelle. FLOAT zeigt zusaetzlich Forward-Projektion, Spread (bp) und
// die daraus resultierende All-in-Rate.
function renderLegTable(cashflows, leg) {
  if (!Array.isArray(cashflows) || cashflows.length === 0) {
    return `<div class="structure-cashflow-empty" style="opacity:.7; padding:8px 2px;">No cashflows.</div>`;
  }

  const isFloat = leg === 'FLOAT';
  const head = isFloat
    ? ['#', 'Start', 'End', 'Period', 'Forward', 'Spread (bp)', 'All-in', 'Coupon CF', 'DF', 'PV']
    : ['#', 'Start', 'End', 'Period', 'Rate', 'Coupon CF', 'DF', 'PV'];

  const rows = cashflows.map((cf, i) => {
    const lead = [
      escapeHtml(formatValue(cf.cashflow_no ?? i)),
      escapeHtml(fmtCfDate(cf.start_date)),
      escapeHtml(fmtCfDate(cf.end_date ?? cf.pay_date)),
      escapeHtml(formatOptionalNumber(cf.period, 6)),
    ];
    const mid = isFloat
      ? [
          escapeHtml(cf.forward == null ? '-' : formatPercent(cf.forward, 4)),
          escapeHtml(cf.spread == null ? '-' : (Number(cf.spread) * 10000).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })),
          escapeHtml(cf.rate == null ? '-' : formatPercent(cf.rate, 4)),
        ]
      : [
          escapeHtml(formatOptionalNumber(cf.rate, 6)),
        ];
    const tail = [
      escapeHtml(formatOptionalNumber(cf.coupon_cf ?? cf.amount, 4)),
      escapeHtml(formatOptionalNumber(cf.df, 6)),
      escapeHtml(formatOptionalNumber(cf.pv, 4)),
    ];
    const cells = [...lead, ...mid, ...tail];
    return `<tr>${cells.map((c) => `<td>${c}</td>`).join('')}</tr>`;
  }).join('');

  return `
    <div class="structure-cashflow-table-wrap">
      <table class="structure-cashflow-table">
        <thead><tr>${head.map((h) => `<th>${escapeHtml(h)}</th>`).join('')}</tr></thead>
        <tbody>${rows}</tbody>
      </table>
    </div>
  `;
}

function renderCurveInfo(curveInfo = {}) {
  const discountCurve = curveInfo.discount_curve_id || '—';
  const discountScenario = curveInfo.discount_scenario_id || '—';

  const forwardCurve = curveInfo.forward_curve_id || '—';
  const forwardScenario = curveInfo.forward_scenario_id || '—';

  return `
    <div class="valuation-curve-info">
      <div class="valuation-curve-card">
        <div class="valuation-curve-label">Discount Curve</div>
        <div class="valuation-curve-value">${discountCurve}</div>
        <div class="valuation-curve-scenario">${discountScenario}</div>
      </div>

      <div class="valuation-curve-card">
        <div class="valuation-curve-label">Forward Curve</div>
        <div class="valuation-curve-value">${forwardCurve}</div>
        <div class="valuation-curve-scenario">${forwardScenario}</div>
      </div>
    </div>
  `;
}


function renderResult(container, payload, prodId) {
  const resultBox = container.querySelector('#productValuationResult');
  if (!resultBox) return;

  const result = unwrapValuationResult(payload);
  const cashflows = result?.cashflows || [];
  const curveInfo = result?.curve_info || {};

  // Rating = AUFGELOESTES RATINGres (Produkt-Rating, sonst Issuer-Rating). Kommt aus der
  // enriched portfolio_row des Valuation-Results (Python-aufgeloest); Fallback: Produktzeile.
  const pfRow = result?.portfolio_row || {};
  const prodRow = getProductRow(prodId) || {};
  const ratingValue =
    pfRow.RATINGres ?? pfRow.adjusted_rating ??
    prodRow.RATINGres ?? prodRow.adjusted_rating ?? prodRow.RATING_PROD ?? prodRow.RATING;

  const yieldLabel =
    result?.yield_method === 'vxp_model_yield'
      ? 'Model Yield'
      : 'Yield';

  // Present Value = dirty value (clean + accrued) × Notional, day-count-correct in Python.
  const pvDirty = result.pv_dirty != null ? result.pv_dirty : result.pv;

  const resultHtml = `
    <div class="structure-valuation-result-card">
      <h4 class="structure-valuation-result-title">
        ✅ Valuation completed
      </h4>

      <div class="structure-drawer-note" style="margin-bottom:12px;">
        This product was valued as a standalone instrument using the current market snapshot.
      </div>

      <!-- Reihe 1: Main Valuation -->
      <div class="structure-valuation-result-grid svr-row--main">
        <div>
          <span>Clean Price</span>
          <strong>${formatNumber(result.clean_price, 6)}</strong>
        </div>

        <div class="cs-spread-tile">
          <span>Credit Spread</span>
          <strong>${result.c_spread == null ? '–' : formatNumber(result.c_spread, 2)}</strong>
        </div>

        <div>
          <span>Rating</span>
          <strong>${escapeHtml(formatValue(ratingValue))}</strong>
        </div>

        <div>
          <span>${escapeHtml(yieldLabel)}</span>
          <strong>${formatPercent(result.yield_display ?? result.yield, 4)}</strong>
        </div>

        <div>
          <span>Status</span>
          <strong>${escapeHtml(formatValue(result.status || payload?.status || 'ok')).toUpperCase()}</strong>
        </div>
      </div>

      <!-- Reihe 2: Sensitivities -->
      <div class="structure-valuation-result-grid svr-row--3">
        <div>
          <span>IR PV01 (price bp)</span>
          <strong>${formatNumber(result.pv01, 6)}</strong>
        </div>

        <div>
          <span>CS PV01 (price bp)</span>
          <strong>${formatNumber(result.cpv01, 6)}</strong>
        </div>

        <div>
          <span>Vega PV100 (price bp)</span>
          <strong>${result.vega_parallel == null ? '–' : formatNumber(Number(result.vega_parallel) * 10000, 6)}</strong>
        </div>
      </div>

      <!-- Reihe 3: Economics / Meta -->
      <div class="structure-valuation-result-grid svr-row--3">
        <div>
          <span>Present Value (dirty)</span>
          <strong>${formatNumber(pvDirty, 6)}</strong>
        </div>

        <div>
          <span>Notional</span>
          <strong>${formatNumber(result.notional, 2)}</strong>
        </div>

        <div>
          <span>As of Date</span>
          <strong>${escapeHtml(formatValue(result.asof_date))}</strong>
        </div>
      </div>

       ${renderCurveInfo(curveInfo)}
       ${renderCashflowSection(result)}

      <details class="structure-valuation-raw">
        <summary>Technical raw result</summary>
        <pre>${escapeHtml(JSON.stringify(payload, null, 2))}</pre>
      </details>
    </div>
  `;

  resultBox.innerHTML = resultHtml;

  cacheValuationResult(prodId, resultHtml, payload);

  const key = getValuationCacheKey(prodId);
  delete getValuationStaleMap()[key];
}

async function saveCsSpreadOverride(container, prodId) {
  const input = container.querySelector('#productValuationCsSpreadOverrideBp');
  let rawValue = input?.value || '';
  // Komma-Eingabe -> Punkt-Zahl für die DB (leer bleibt leer = Override löschen).
  if (String(rawValue).trim() !== '') {
    const _n = parseDeNumber(rawValue);
    if (Number.isFinite(_n)) rawValue = _n;
  }

  const productId = String(prodId || '').trim();

  if (!productId) {
    renderError(container, 'Missing PROD_ID. Save the product first.');
    return false;
  }

  if (!window.api?.invoke) {
    renderError(container, 'IPC invoke bridge not available.');
    return false;
  }

  const result = await window.api.invoke('update-product-cs-spread-override', {
    prodId: productId,
    csSpreadOverrideBp: rawValue,
  });

  if (!result?.success) {
    renderError(
      container,
      result?.error || 'Could not save credit spread override.'
    );
    return false;
  }

  updateProductCSOverrideWarning(productId, rawValue);

  const resultBox = container.querySelector('#productValuationResult');
  if (resultBox) {
    resultBox.innerHTML = `
      <div class="structure-valuation-status">
        Credit spread override saved.
      </div>
    `;
  }

  return true;
}

function bindValuationEvents(container, prodId) {
  const button = container.querySelector('#calculateProductValuation');
  if (!button) return;

  const csInput = container.querySelector('#productValuationCsSpreadOverrideBp');
  const saveSpreadButton = container.querySelector('#saveProductCsSpreadOverride');

  // Live warning while typing
  if (csInput) {
    csInput.addEventListener('input', () => {
      updateProductCSOverrideWarning(prodId, csInput.value);
    });

    // Initial warning state when drawer opens
    updateProductCSOverrideWarning(prodId, csInput.value);
  }

  if (saveSpreadButton) {
    saveSpreadButton.addEventListener('click', async () => {
      await saveCsSpreadOverride(container, prodId);
    });
  }

  // Leg-Toggle (Swap-Replication: Fix / Floating). Delegiert + einmalig, da die
  // Buttons erst nach der Bewertung ins Result-Panel gerendert werden.
  if (!container.dataset.cfLegBound) {
    container.dataset.cfLegBound = '1';
    container.addEventListener('click', (e) => {
      const btn = e.target.closest?.('.cf-leg-btn');
      if (!btn) return;
      const wrap = btn.closest('.structure-cashflow-legs');
      if (!wrap) return;
      const leg = btn.dataset.leg;
      wrap.querySelectorAll('.cf-leg-btn').forEach((b) => b.classList.toggle('is-active', b === btn));
      wrap.querySelectorAll('[data-leg-panel]').forEach((p) => {
        p.style.display = (p.dataset.legPanel === leg) ? '' : 'none';
      });
    });
  }

  button.addEventListener('click', () => {
    const request = gatherValuationInput(container, prodId);

    container.dataset.preserveValuationResult = '';
    container.dataset.preserveValuationForProdId = '';

    if (!request.prodId) {
      renderError(container, 'Missing PROD_ID. Save the product first.');
      return;
    }

    console.log('[PRODUCT VALUATION REQUEST]', request);

    updateProductCSOverrideWarning(
      request.prodId,
      request.cs_spread_override_bp
    );

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

      const realResult = unwrapValuationResult(payload);
      const realKeys = Object.keys(realResult || {});

      console.log('[PRODUCT VALUATION REAL RESULT]', realResult);
      console.log('[PRODUCT VALUATION REAL RESULT KEYS]', realKeys);
      console.log('[PRODUCT VALUATION SENS CHECK]', {
        pv01: realResult?.pv01,
        cpv01: realResult?.cpv01,
        vega_parallel: realResult?.vega_parallel,
      });

      const payloadProdId = String(
        payload?.prodId ||
        payload?.result?.prod_id ||
        payload?.result?.result?.prod_id ||
        realResult?.prod_id ||
        ''
      ).trim();

      const currentProdId = String(prodId || '').trim();

      if (payloadProdId && currentProdId && payloadProdId !== currentProdId) {
        console.warn('[PRODUCT VALUATION SUCCESS IGNORED: PROD_ID MISMATCH]', {
          payloadProdId,
          currentProdId,
        });
        return;
      }

      if (!realResult || realKeys.length === 0) {
        console.warn('[PRODUCT VALUATION SUCCESS IGNORED: EMPTY RESULT]', payload);
        return;
      }

      renderResult(container, payload, currentProdId);
    });

    window.api.receive('price-product-error', (error) => {
      console.error('[PRODUCT VALUATION ERROR]', error);
      renderError(container, error);
    });
  }
}

export function renderProductValuationDrawer(container, prodId, options = {}) {
  if (!container) return;
  
  const currentProdId = String(prodId || '').trim();
  const row = getProductRow(prodId);

console.log('[VALUATION HEADER ROW]', {
  prodId,
  model: row?.MODEL,
  pricing_model: row?.pricing_model,
  row,
});



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
      </div>

      <div class="structure-valuation-summary">
        <div>
          <span>Product</span>
          <strong>${escapeHtml(formatValue(row?.PROD_ID || prodId))}</strong>
        </div>

        <div>
          <span>Issuer</span>
          <strong>${escapeHtml(formatValue(row?.ISSUER || row?.issuer))}</strong>
        </div>

        <div>
          <span>Description</span>
          <strong>${escapeHtml(formatValue(row?.DESCRIPTION || row?.description))}</strong>
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
            value="${escapeHtml(options.asofDate || getTodayIsoDate())}"
          />
        </label>

        ${renderInitialDiscountCurveSelector(options, row)}

        <label class="structure-drawer-field">
          <span class="structure-drawer-label">Credit Spread Override (bp)</span>
          <input
            id="productValuationCsSpreadOverrideBp"
            class="structure-drawer-input"
            value="${escapeHtml(options.csSpreadOverrideBp || row?.CS_SPREAD_OVERRIDE_BP || '')}"
            placeholder="e. g. 25 = 25 bp"
          />
        </label>
      </div>

      <div class="structure-drawer-actions">
        <button
          id="saveProductCsSpreadOverride"
          type="button"
          class="structure-action-button"
        >
          Save Spread
        </button>

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
  // Bewertungsbox offen mit "–"; ein gecachtes Live-Ergebnis ueberschreibt es.
  renderEmptyResult(container);
  restoreCachedValuationResult(container, prodId);



  if (container._productDataRefreshedHandler) {
    window.removeEventListener(
      'product-data-refreshed',
      container._productDataRefreshedHandler
    );
  }

  container._productDataRefreshedHandler = (event) => {
    const detail = event.detail || {};
    const changedProdId = String(detail.prodId ?? '').trim();
    const currentProdId = String(prodId ?? '').trim();

    if (changedProdId !== currentProdId) {
      return;
    }

        if (
      container.dataset.preserveValuationResult === 'true' &&
      container.dataset.preserveValuationForProdId === currentProdId
    ) {
      console.log('[VALUATION DRAWER] product data refresh ignored - preserving previous valuation result', {
        prodId: currentProdId,
        detail,
      });
      return;
    }

    console.log('[VALUATION DRAWER REFRESH AFTER PRODUCT DATA REFRESH]', {
      prodId,
      detail,
      currentModel: getProductRow(prodId)?.MODEL,
    });

    renderProductValuationDrawer(container, prodId, {
      ...options,
      notional:
        container.querySelector('#productValuationNotional')?.value ||
        options.notional,
      asofDate:
        container.querySelector('#productValuationAsofDate')?.value ||
        options.asofDate,
      discount_curve_id:
        container.querySelector('#valuationDiscountCurveSelect')?.value ||
        options.discount_curve_id,
      csSpreadOverrideBp:
        container.querySelector('#productValuationCsSpreadOverrideBp')?.value ||
        options.csSpreadOverrideBp,
    });
  };

  window.addEventListener(
    'product-data-refreshed',
    container._productDataRefreshedHandler
  );

}