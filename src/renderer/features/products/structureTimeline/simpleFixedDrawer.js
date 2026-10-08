// src/renderer/features/products/structureTimeline/simpleFixedDrawer.js

'use strict';

import { appState } from '../../../renderer.js';
import { issuerData } from '../../issuer/issuerPanel.js';
import { applyProductTemplateDefaults } from '../productTemplateResolver.js';
import { parseDeNumber, toDeInput } from '../../../utils/tableCellFormats.js';
import { validateProductBeforeSave } from '../productValidation.js';
import { PRODUCT_FIELD_CONFIG } from '../productFieldConfig.js';
import { isRelativeToken, resolveStartISO, resolveMaturityISO } from './relativeDates.js';


const SIMPLE_FIXED_FIELDS = [
  'PROD_ID',
  'DESCRIPTION',
  'ISSUER',
  'TICKER',
  'RANK',
  'RATING_PROD',
  'CCY',

  'START_DATE',
  'MATURITY',

  'COUPON',
  'COUPON_FREQ',

  'DAY_COUNT',
  'CALENDAR',
  'BUSINESS_DAY_CONVENTION',
  'SETTLEMENT_DAYS',
];

const SIMPLE_FIXED_DEFAULTS = {
  CouponType: 'FIX',
  __PRODUCT_TEMPLATE__: 'FIXED_BOND',
  __UI_MODE__: 'simple_fixed',

  CCY: 'EUR',
  RANK: 'senior_unsecured',

  COUPON: '',
  COUPON_FREQ: '1',

  DAY_COUNT: 'Actual/360',
  CALENDAR: 'TARGET',
  BUSINESS_DAY_CONVENTION: 'Modified Following',
  SETTLEMENT_DAYS: '2',

  SCHEDULE: '',
  FINLIB: 'ql',
  MODEL: 'DCF_ql',
  METHODE: '',
};

function getProductRow(prodId) {
  const prodDataArr = appState.getProdData?.() || [];
  const needle = String(prodId ?? '').trim();

  return prodDataArr.find(
    row => String(row?.PROD_ID ?? '').trim() === needle
  ) || null;
}

function buildCreateRow() {
  return {
    ...SIMPLE_FIXED_DEFAULTS,
    PROD_ID: '',
    DESCRIPTION: '',
    ISSUER: '',
    TICKER: '',
    RATING_PROD: '',
    START_DATE: '',
    MATURITY: '',
  };
}

function buildEditRow(prodId) {
  const row = getProductRow(prodId) || {};

  return {
    ...SIMPLE_FIXED_DEFAULTS,
    ...row,
    __PRODUCT_TEMPLATE__: 'FIXED_BOND',
    __UI_MODE__: 'simple_fixed',
    CouponType: 'FIX',
  };
}

function formatValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
}

function formatPercent(value) {
  const raw = String(value ?? '').trim();
  if (!raw) return '';
  const n = Number(raw);
  if (!Number.isFinite(n)) return raw;
  // Gespeicherter Bruch -> Prozent-Anzeige (immer ×100): 0.005 -> 0,5 ; 0.0353 -> 3,53.
  return toDeInput(String(parseFloat((n * 100).toFixed(10))));
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function getIssuerOptions() {
  return [...new Set(
    (issuerData || [])
      .map(item => item?.ISSUER)
      .filter(Boolean)
      .map(value => String(value).trim())
      .filter(Boolean)
  )].sort();
}

function getTickerForIssuer(issuerName) {
  const needle = String(issuerName || '').trim();
  if (!needle) return '';

  const match = (issuerData || []).find(item =>
    String(item?.ISSUER || '').trim() === needle
  );

  return (
    match?.TICKER ||
    match?.Ticker ||
    match?.ticker ||
    ''
  );
}

function renderSelect(field, options, selectedValue) {
  return `
    <select
      class="structure-drawer-input"
      data-field="${escapeHtml(field)}"
    >
      ${options.map(optionValue => `
        <option
          value="${escapeHtml(optionValue)}"
          ${String(optionValue) === String(selectedValue) ? 'selected' : ''}
        >
          ${escapeHtml(optionValue)}
        </option>
      `).join('')}
    </select>
  `;
}

function renderField(field, row) {
  const value = formatValue(row[field]);

  if (field === 'ISSUER') {
    const options = ['', ...getIssuerOptions()];

    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        ${renderSelect(field, options, value)}
      </label>
    `;
  }

  if (field === 'CCY') {
    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        ${renderSelect(field, ['EUR', 'USD', 'CHF', 'GBP'], value || 'EUR')}
      </label>
    `;
  }

  if (field === 'RANK') {
    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        ${renderSelect(field, [
          'senior_secured',
          'senior_preferred',
          'senior_unsecured',
          'senior_subordinated',
          'junior_subordinated',
        ], value || 'senior_unsecured')}
      </label>
    `;
  }

  const fieldConfig = PRODUCT_FIELD_CONFIG?.[field];

  if (fieldConfig?.type === 'select') {
    const options = fieldConfig.options || [];
    const selectedValue = value || fieldConfig.defaultValue || '';

    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        ${renderSelect(field, options, selectedValue)}
      </label>
    `;
  }

  if (fieldConfig?.type === 'number') {
    const selectedValue = value || fieldConfig.defaultValue || '';

    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        <input
          type="number"
          class="structure-drawer-input"
          value="${escapeHtml(selectedValue)}"
          data-field="${field}"
        />
      </label>
    `;
  }

  if (field === 'COUPON') {
    const displayValue = formatPercent(value);
    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">COUPON (%)</span>
        <input
          type="text"
          class="structure-drawer-input"
          value="${escapeHtml(displayValue)}"
          data-field="COUPON"
          placeholder="e.g. 4.00"
        />
      </label>
    `;
  }

  // Datumsfelder: absolut (Picker) ODER relativ (Token). Token hat Vorrang -> wird
  // gespeichert (Variante a); das Pricing loest ihn frisch auf.
  if (field === 'START_DATE' || field === 'MATURITY') {
    const isStart = field === 'START_DATE';
    const rawVal = String(row[field] ?? '').trim();
    const token = isRelativeToken(rawVal) ? rawVal : '';
    const absISO = isStart
      ? resolveStartISO(rawVal)
      : resolveMaturityISO(rawVal, row.START_DATE);
    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        <div style="display:flex; gap:6px; align-items:center;">
          <input type="date" class="structure-drawer-input" style="flex:1 1 auto; min-width:120px;"
            value="${escapeHtml(absISO)}" data-field="${field}" data-absdate="${field}" />
          <input type="text" class="structure-drawer-input" style="flex:0 0 62px; min-width:0;"
            value="${escapeHtml(token)}" data-reltoken="${field}"
            placeholder="${isStart ? 'today+2' : '10y'}"
            title="Relative (optional): ${isStart ? 'today or today+N days' : 'N years from start, e.g. 10y'}" />
        </div>
        <span data-relpreview="${field}" style="font-size:11px; color:#888; display:block; margin-top:2px;"></span>
      </label>
    `;
  }

  const inputType = 'text';

  return `
    <label class="structure-drawer-field">
      <span class="structure-drawer-label">${field}</span>
      <input
        type="${inputType}"
        class="structure-drawer-input"
        value="${escapeHtml(value)}"
        data-field="${field}"
      />
    </label>
  `;
}

// Wiring der relativen Datums-Tokens: Token tippen -> absolutes Datum berechnen (Picker +
// Vorschau). Picker manuell aendern -> Token leeren (= absoluter Modus).
function bindRelativeDateTokens(container) {
  const startTok = container.querySelector('[data-reltoken="START_DATE"]');
  const startDate = container.querySelector('[data-absdate="START_DATE"]');
  const matTok = container.querySelector('[data-reltoken="MATURITY"]');
  const matDate = container.querySelector('[data-absdate="MATURITY"]');
  const startPrev = container.querySelector('[data-relpreview="START_DATE"]');
  const matPrev = container.querySelector('[data-relpreview="MATURITY"]');

  const startValue = () => {
    const t = String(startTok?.value || '').trim();
    return t || String(startDate?.value || '').trim();
  };

  const recompute = () => {
    const st = String(startTok?.value || '').trim();
    if (st) {
      const iso = resolveStartISO(st);
      if (startDate && iso) startDate.value = iso;
      if (startPrev) startPrev.textContent = iso ? `= ${iso}` : '';
    } else if (startPrev) {
      startPrev.textContent = '';
    }

    const mt = String(matTok?.value || '').trim();
    if (mt) {
      const iso = resolveMaturityISO(mt, startValue());
      if (matDate && iso) matDate.value = iso;
      if (matPrev) matPrev.textContent = iso ? `= ${iso}` : '';
    } else if (matPrev) {
      matPrev.textContent = '';
    }
  };

  [startTok, matTok].forEach((el) => el && el.addEventListener('input', recompute));
  if (startDate) startDate.addEventListener('change', () => { if (startTok) startTok.value = ''; recompute(); });
  if (matDate) matDate.addEventListener('change', () => { if (matTok) matTok.value = ''; recompute(); });

  recompute();
}

function bindIssuerTickerSync(container) {
  const issuerSelect = container.querySelector('[data-field="ISSUER"]');
  const tickerInput = container.querySelector('[data-field="TICKER"]');

  if (!issuerSelect || !tickerInput) return;

  issuerSelect.addEventListener('change', () => {
    const ticker = getTickerForIssuer(issuerSelect.value);
    tickerInput.value = ticker || '';
  });

  if (!String(tickerInput.value || '').trim()) {
    const ticker = getTickerForIssuer(issuerSelect.value);
    if (ticker) tickerInput.value = ticker;
  }
}

function gatherDrawerData(container) {
  const data = {};

  container.querySelectorAll('[data-field]').forEach((el) => {
    const field = el.dataset.field;
    if (!field) return;

    data[field] = el.value;
  });

  return data;
}

function normalizeRate(value) {
  const raw = String(value ?? '').trim();

  if (!raw) return '';

  const n = parseDeNumber(raw);

  if (!Number.isFinite(n)) return raw;

  // Feld ist "COUPON (%)": die Eingabe ist IMMER ein Prozentwert -> /100.
  // 0.5 -> 0,5% -> 0.005 ; 3.53 -> 0.0353 ; 4 -> 0.04. Ein evtl. getipptes "%"
  // wird von parseDeNumber ignoriert; das Ergebnis ist dasselbe.
  return n / 100;
}

function validateSimpleFixedData(data, container) {
  const note = container.querySelector('.structure-drawer-note');

  const requiredFields = [
    'PROD_ID',
    'START_DATE',
    'MATURITY',
    'COUPON',
    'COUPON_FREQ',
  ];

  for (const field of requiredFields) {
    if (!String(data[field] ?? '').trim()) {
      if (note) {
        note.textContent = `Please enter ${field}.`;
        note.classList.add('structure-drawer-note-error');
        }
      return false;
    }
  }

  return true;
}

function saveSimpleFixed(container, prodId, options = {}) {
  let newData = gatherDrawerData(container);

  // Relative-Modus (Variante a): wenn ein Token gesetzt ist, DIESEN speichern (statt des
  // aufgeloesten absoluten Datums). Das Pricing loest ihn bei jedem Lauf frisch auf.
  const _startTok = String(container.querySelector('[data-reltoken="START_DATE"]')?.value || '').trim();
  const _matTok = String(container.querySelector('[data-reltoken="MATURITY"]')?.value || '').trim();
  if (_startTok) newData.START_DATE = _startTok;
  if (_matTok) newData.MATURITY = _matTok;

  const isCreateMode = options.mode === 'create';
  const existingRow = getProductRow(prodId) || {};

  if (!newData.PROD_ID) {
    newData.PROD_ID = prodId || '';
  }

  if (!validateSimpleFixedData(newData, container)) {
    return;
  }

  newData = {
    ...newData,

    CouponType: 'FIX',
    __PRODUCT_TEMPLATE__: 'FIXED_BOND',
    __UI_MODE__: 'simple_fixed',

    SCHEDULE: '',
    FINLIB: existingRow.FINLIB || newData.FINLIB || 'ql',
    MODEL: existingRow.MODEL || newData.MODEL || 'DCF_ql',
    METHODE: existingRow.METHODE || newData.METHODE || '',

    COUPON: normalizeRate(newData.COUPON),

    product_name: newData.DESCRIPTION || newData.PROD_ID,
    DESCRIPTION: newData.DESCRIPTION || newData.PROD_ID,

    seniority: newData.RANK || 'senior_unsecured',
    RANK: newData.RANK || 'senior_unsecured',

    issue_date: newData.START_DATE,
    maturity_date: newData.MATURITY,
    currency: newData.CCY || 'EUR',
    notional: 100,
  };

  newData = applyProductTemplateDefaults(newData, 'v_PRODUCTS_APP');

  // Critical: template defaults must not reset selected pricing model
  newData.FINLIB = existingRow.FINLIB || newData.FINLIB || 'ql';
  newData.MODEL = existingRow.MODEL || newData.MODEL || 'DCF_ql';
  newData.METHODE = existingRow.METHODE || newData.METHODE || '';

  const validation = validateProductBeforeSave(newData);
    const note = container.querySelector('.structure-drawer-note');

    if (!validation.ok) {
    if (note) {
        note.textContent = validation.message;
        note.classList.add('structure-drawer-note-error');
    }

    return;
    }

    if (note) {
    note.classList.remove('structure-drawer-note-error');
    }

  const productIdForSave = String(newData.PROD_ID).trim();

  console.log('[SAVE SIMPLE FIXED DRAWER]', {
    mode: options.mode || 'edit',
    prodId: productIdForSave,
    newData,
  });

  window.api.send('update-data', {
    cleanTableName: 'v_PRODUCTS_APP',
    rowIndex: null,
    newData,
    uniqueIdentifier: {
      column: 'PROD_ID',
      value: productIdForSave,
    },
  });

  
    if (note) {
    note.classList.remove('structure-drawer-note-error');
    note.textContent = isCreateMode
        ? `Create submitted for ${productIdForSave}.`
        : 'Save submitted.';
    }

  if (isCreateMode && typeof options.onCreated === 'function') {
    options.onCreated(productIdForSave);
  }
}

export function renderSimpleFixedDrawer(container, prodId, options = {}) {
  if (!container) return;

  const isCreateMode = options.mode === 'create';

  const row = isCreateMode
    ? buildCreateRow()
    : buildEditRow(prodId);

  container.innerHTML = `
    <section class="structure-drawer-card">
        <div class="structure-drawer-header">
            <h3 class="structure-drawer-title">
                Simple Fixed Bond
            </h3>

            <span class="structure-drawer-prod-id">
                ${isCreateMode ? 'New Product' : escapeHtml(formatValue(row.PROD_ID))}
            </span>
        </div>

      <div class="structure-drawer-grid">
        ${SIMPLE_FIXED_FIELDS.map(field => renderField(field, row)).join('')}
      </div>

      <div class="structure-drawer-actions">
        <button
          id="saveSimpleFixedDrawer"
          type="button"
          class="structure-action-button"
        >
          ${isCreateMode ? 'Create Fixed Bond' : 'Save Fixed Bond'}
        </button>
      </div>

      ${
        isCreateMode
          ? ''
          : `
            <div class="structure-drawer-danger-zone">
              <div class="structure-drawer-danger-title">
                Danger Zone
              </div>

              <button
                id="deleteProductDrawer"
                type="button"
                class="structure-action-button structure-action-button-danger"
              >
                Delete Product
              </button>
            </div>
          `
      }

      <div class="structure-drawer-note">
        ${
          isCreateMode
            ? 'Enter the fixed bond details and click Create Fixed Bond.'
            : 'Unsaved changes stay local until you click Save.'
        }
      </div>
    </section>
  `;

  bindIssuerTickerSync(container);
  bindRelativeDateTokens(container);

    container
    .querySelector('#saveSimpleFixedDrawer')
    ?.addEventListener('click', () => {
        saveSimpleFixed(container, prodId, options);
    });

    container
    .querySelector('#deleteProductDrawer')
    ?.addEventListener('click', () => {
        deleteProductViaExistingFlow(container, row.PROD_ID || prodId);
    });
}


function deleteProductViaExistingFlow(container, prodId) {
  const note = container.querySelector('.structure-drawer-note');

  const productIdForDelete = String(prodId ?? '').trim();

  if (!productIdForDelete) {
    if (note) {
      note.textContent = 'Cannot delete before product is saved.';
      note.classList.add('structure-drawer-note-error');
    }
    return;
  }

  const confirmed =
    container.dataset.confirmDeleteProduct === productIdForDelete;

  if (!confirmed) {
    container.dataset.confirmDeleteProduct = productIdForDelete;

    if (note) {
      note.classList.remove('structure-drawer-note-error');
      note.textContent = `Click Delete Product again to permanently delete ${productIdForDelete}.`;
    }

    return;
  }

  delete container.dataset.confirmDeleteProduct;

  console.log('[DELETE SIMPLE FIXED PRODUCT]', {
    prodId: productIdForDelete,
  });

  window.api.send('erase-data', {
    cleanTableName: 'v_PRODUCTS_APP',
    uniqueIdentifier: {
      column: 'PROD_ID',
      value: productIdForDelete,
    },
  });

  if (note) {
    note.classList.remove('structure-drawer-note-error');
    note.textContent = 'Delete submitted.';
  }
}