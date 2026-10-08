// src/renderer/features/products/structureTimeline/structureProductSetupDrawer.js

'use strict';

import { appState } from '../../../renderer.js';
import { PRODUCT_TEMPLATES } from '../productTemplates.js';
import { issuerData } from '../../issuer/issuerPanel.js';
import { applyProductTemplateDefaults } from '../productTemplateResolver.js';
import { validateProductBeforeSave } from '../productValidation.js';
import { getFieldConfig } from '../productFieldConfig.js';
import { isRelativeToken, resolveStartISO, resolveMaturityISO } from './relativeDates.js';

const FALLBACK_PRODUCT_SETUP_FIELDS = [
  'PROD_ID',
  'DESCRIPTION',
  'ISSUER',
  'TICKER',
  'RANK',
  'RATING_PROD',
  'CCY',
];

function getProductRow(prodId) {
  const prodDataArr = appState.getProdData?.() || [];
  const needle = String(prodId ?? '').trim();

  return prodDataArr.find(
    row => String(row?.PROD_ID ?? '').trim() === needle
  ) || null;
}

function getProductSetupDrawerConfig() {
  return PRODUCT_TEMPLATES
    ?.COMPLEX_BOND
    ?.drawers
    ?.PRODUCT_SETUP || {
      label: 'Product Setup',
      fields: FALLBACK_PRODUCT_SETUP_FIELDS,
    };
}

function buildCreateRow(templateName = 'COMPLEX_BOND') {
  const template =
    PRODUCT_TEMPLATES[templateName] ||
    PRODUCT_TEMPLATES.COMPLEX_BOND;

  return {
    ...(template.defaults || {}),
    __PRODUCT_TEMPLATE__: templateName,
    __UI_MODE__: template.uiMode || 'STRUCTURE',

    PROD_ID: '',
    DESCRIPTION: '',
    ISSUER: '',
    TICKER: '',
    RANK: template.defaults?.RANK || 'senior_unsecured',
    RATING_PROD: '',
    CCY: template.defaults?.CCY || 'EUR',
  };
}

function formatValue(value) {
  if (value === null || value === undefined) return '';
  return String(value);
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

function renderField(field, row) {
  const config = getFieldConfig('v_PRODUCTS_APP', field);
  const rawValue = row[field];

  const value = formatValue(
    rawValue !== undefined && rawValue !== null && rawValue !== ''
      ? rawValue
      : config?.defaultValue ?? ''
  );

  if (field === 'ISSUER') {
    const options = getIssuerOptions();

    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        <select
          class="structure-drawer-input"
          data-field="${field}"
        >
          <option value=""></option>
          ${options.map(optionValue => `
            <option
              value="${escapeHtml(optionValue)}"
              ${optionValue === value ? 'selected' : ''}
            >
              ${escapeHtml(optionValue)}
            </option>
          `).join('')}
        </select>
      </label>
    `;
  }

  if (config?.type === 'select') {
    const options = Array.isArray(config.options)
      ? config.options
      : [];

    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        <select
          class="structure-drawer-input"
          data-field="${field}"
        >
          <option value=""></option>
          ${options.map(optionValue => {
            const optionText = String(optionValue);
            return `
              <option
                value="${escapeHtml(optionText)}"
                ${optionText === value ? 'selected' : ''}
              >
                ${escapeHtml(optionText)}
              </option>
            `;
          }).join('')}
        </select>
      </label>
    `;
  }

  // Datumsfelder: absolut (Picker) ODER relativ (Token). Token hat Vorrang (Variante a).
  if (field === 'START_DATE' || field === 'MATURITY') {
    const isStart = field === 'START_DATE';
    const relRaw = String(rawValue ?? '').trim();
    const token = isRelativeToken(relRaw) ? relRaw : '';
    const absISO = isStart
      ? resolveStartISO(relRaw)
      : resolveMaturityISO(relRaw, row.START_DATE);
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

  const inputType =
    config?.type === 'number'
      ? 'number'
      : 'text';

  return `
    <label class="structure-drawer-field">
      <span class="structure-drawer-label">${field}</span>
      <input
        type="${inputType}"
        class="structure-drawer-input"
        value="${escapeHtml(value)}"
        data-field="${field}"
        ${config?.placeholder ? `placeholder="${escapeHtml(config.placeholder)}"` : ''}
      />
    </label>
  `;
}

// Wiring der relativen Datums-Tokens (identisch zu Simple Fixed/FRN).
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

  // Initial sync only if TICKER is empty.
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

function saveProductSetup(container, prodId, options = {}) {
  let newData = gatherDrawerData(container);

  // Relative-Modus (Variante a): Token speichern statt des aufgeloesten Datums.
  const _startTok = String(container.querySelector('[data-reltoken="START_DATE"]')?.value || '').trim();
  const _matTok = String(container.querySelector('[data-reltoken="MATURITY"]')?.value || '').trim();
  if (_startTok) newData.START_DATE = _startTok;
  if (_matTok) newData.MATURITY = _matTok;

  const isCreateMode = options.mode === 'create';

  if (!newData.PROD_ID) {
    newData.PROD_ID = prodId || '';
  }

  if (!newData.PROD_ID || String(newData.PROD_ID).trim() === '') {
    const note = container.querySelector('.structure-drawer-note');
    if (note) {
      note.textContent = 'Please enter PROD_ID before saving.';
    }
    return;
  }

  const templateName =
    options.templateName ||
    newData.__PRODUCT_TEMPLATE__ ||
    'COMPLEX_BOND';

  newData.__PRODUCT_TEMPLATE__ = templateName;

  if (templateName === 'COMPLEX_BOND') {
    newData.CouponType = 'CUSTOM';
  }

  newData = applyProductTemplateDefaults(newData, 'v_PRODUCTS_APP');

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

  console.log('[SAVE PRODUCT SETUP DRAWER]', {
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
    note.textContent = isCreateMode
      ? `Create submitted for ${productIdForSave}.`
      : 'Save submitted.';
  }

  if (isCreateMode && typeof options.onCreated === 'function') {
    options.onCreated(productIdForSave);
  }
}

function deleteProductViaExistingFlow(container, prodId) {
  const note = container.querySelector('.structure-drawer-note');

  if (!prodId) {
    if (note) {
      note.textContent = 'Cannot delete before product is saved.';
    }
    return;
  }

  const confirmed =
    container.dataset.confirmDeleteProduct === String(prodId);

  if (!confirmed) {
    container.dataset.confirmDeleteProduct = String(prodId);

    if (note) {
      note.textContent = `Click Delete Product again to permanently delete ${prodId}.`;
    }

    return;
  }

  delete container.dataset.confirmDeleteProduct;

  console.log('[DELETE PRODUCT FROM PRODUCT SETUP DRAWER]', {
    prodId,
  });

  window.api.send('erase-data', {
    cleanTableName: 'v_PRODUCTS_APP',
    uniqueIdentifier: {
      column: 'PROD_ID',
      value: prodId,
    },
  });

  if (note) {
    note.textContent = 'Delete submitted.';
  }
}

export function renderProductSetupDrawer(container, prodId, options = {}) {
  if (!container) return;

  const isCreateMode = options.mode === 'create';

  const row = isCreateMode
    ? buildCreateRow(options.templateName || 'COMPLEX_BOND')
    : getProductRow(prodId);

  const drawerConfig = getProductSetupDrawerConfig();

  const fields = Array.isArray(drawerConfig.fields)
    ? drawerConfig.fields
    : FALLBACK_PRODUCT_SETUP_FIELDS;

  if (!row) {
    container.innerHTML = `
      <section class="structure-drawer-card structure-drawer-error">
        Product not found: ${escapeHtml(prodId)}
      </section>
    `;
    return;
  }

  const headerProdId = isCreateMode
    ? 'New Product'
    : formatValue(row.PROD_ID);

  container.innerHTML = `
    <section class="structure-drawer-card">
      <div class="structure-drawer-header">
        <h3 class="structure-drawer-title">
          ${escapeHtml(drawerConfig.label || 'Product Setup')}
        </h3>

        <span class="structure-drawer-prod-id">
          ${escapeHtml(headerProdId)}
        </span>
      </div>

      <div class="structure-drawer-grid">
        ${fields.map(field => renderField(field, row)).join('')}
      </div>

      <div class="structure-drawer-actions">
        <button
          id="saveProductSetupDrawer"
          type="button"
          class="structure-action-button"
        >
          ${isCreateMode ? 'Create Product' : 'Save Product Setup'}
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
            ? 'Enter PROD_ID and click Create Product.'
            : 'Unsaved changes stay local until you click Save.'
        }
      </div>
    </section>
  `;

  bindIssuerTickerSync(container);
  bindRelativeDateTokens(container);

  container
    .querySelector('#saveProductSetupDrawer')
    ?.addEventListener('click', () => {
      saveProductSetup(container, prodId, options);
    });

  container
    .querySelector('#deleteProductDrawer')
    ?.addEventListener('click', () => {
      deleteProductViaExistingFlow(container, prodId);
    });
}