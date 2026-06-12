// src/renderer/features/products/structureTimeline/complexModelSetupDrawer.js

'use strict';

import { appState } from '../../../renderer.js';
import { PRODUCT_TEMPLATES } from '../productTemplates.js';
import { applyProductTemplateDefaults } from '../productTemplateResolver.js';

const FALLBACK_MODEL_SETUP_FIELDS = [
  'FINLIB',
  'MODEL',
  'METHODE',
];

const MODEL_OPTIONS_BY_FINLIB = {
  ql: ['DCF_ql', 'BOND_SWAP_REPLICATION_QL'],
  vxp: ['LMM_vxp'],
};

const DEFAULT_MODEL_BY_FINLIB = {
  ql: 'DCF_ql',
  vxp: 'LMM_vxp',
};

const DEFAULT_METHOD_BY_MODEL = {
  DCF_ql: '',
  //DCF_vxp: '',
  LMM_vxp: 'tree_structure',
};

const METHOD_OPTIONS_BY_MODEL = {
  DCF_ql: [''],
  BOND_SWAP_REPLICATION_QL: [''],
  LMM_vxp: ['tree_structure', 'mc_normal'],
};

function getProductRow(prodId) {
  const prodDataArr = appState.getProdData?.() || [];
  const needle = String(prodId ?? '').trim();

  return prodDataArr.find(
    row => String(row?.PROD_ID ?? '').trim() === needle
  ) || null;
}

function getModelSetupDrawerConfig(row = {}) {
  const templateKey =
    row.__PRODUCT_TEMPLATE__ ||
    row.product_template ||
    (
      String(row.CouponType || '').toUpperCase() === 'FIX'
        ? 'FIXED_BOND'
        : 'COMPLEX_BOND'
    );

  return PRODUCT_TEMPLATES
    ?.[templateKey]
    ?.drawers
    ?.MODEL_SETUP || {
      label: 'Model & Pricing',
      fields: FALLBACK_MODEL_SETUP_FIELDS,
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

function normalizeFinlib(value) {
  const v = String(value || '').trim().toLowerCase();
  return v === 'vxp' ? 'vxp' : 'ql';
}

function normalizeModel(finlib, model) {
  const options = MODEL_OPTIONS_BY_FINLIB[finlib] || MODEL_OPTIONS_BY_FINLIB.ql;
  const candidate = String(model || '').trim();

  return options.includes(candidate)
    ? candidate
    : DEFAULT_MODEL_BY_FINLIB[finlib];
}

function normalizeMethode(model, methode) {
  const options = METHOD_OPTIONS_BY_MODEL[model] || [''];
  const candidate = String(methode || '').trim();

  return options.includes(candidate)
    ? candidate
    : (DEFAULT_METHOD_BY_MODEL[model] || options[0] || '');
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
          ${optionValue === selectedValue ? 'selected' : ''}
        >
          ${escapeHtml(optionValue)}
        </option>
      `).join('')}
    </select>
  `;
}

function renderModelField(field, row, modelState) {
  const rawValue = formatValue(row[field]);

  if (field === 'FINLIB') {
    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        ${renderSelect('FINLIB', ['ql', 'vxp'], modelState.finlib)}
      </label>
    `;
  }

  if (field === 'MODEL') {
    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        ${renderSelect(
          'MODEL',
          MODEL_OPTIONS_BY_FINLIB[modelState.finlib] || MODEL_OPTIONS_BY_FINLIB.ql,
          modelState.model
        )}
      </label>
    `;
  }

  if (field === 'METHODE') {
    return `
      <label class="structure-drawer-field">
        <span class="structure-drawer-label">${field}</span>
        ${renderSelect(
          'METHODE',
          METHOD_OPTIONS_BY_MODEL[modelState.model] || [''],
          modelState.methode
        )}
      </label>
    `;
  }

  return `
    <label class="structure-drawer-field">
      <span class="structure-drawer-label">${field}</span>
      <input
        class="structure-drawer-input"
        value="${escapeHtml(rawValue)}"
        data-field="${field}"
      />
    </label>
  `;
}

function bindModelDropdownSync(container) {
  const finlibSelect = container.querySelector('[data-field="FINLIB"]');
  const modelSelect = container.querySelector('[data-field="MODEL"]');
  const methodeSelect = container.querySelector('[data-field="METHODE"]');

  if (!finlibSelect || !modelSelect) return;

  finlibSelect.addEventListener('change', () => {
    const finlib = normalizeFinlib(finlibSelect.value);
    const model = DEFAULT_MODEL_BY_FINLIB[finlib];

    modelSelect.innerHTML = '';

    (MODEL_OPTIONS_BY_FINLIB[finlib] || []).forEach((modelName) => {
      const option = document.createElement('option');
      option.value = modelName;
      option.textContent = modelName;
      modelSelect.appendChild(option);
    });

    modelSelect.value = model;

    if (methodeSelect) {
      methodeSelect.innerHTML = '';

      (METHOD_OPTIONS_BY_MODEL[model] || ['']).forEach((methodName) => {
        const option = document.createElement('option');
        option.value = methodName;
        option.textContent = methodName;
        methodeSelect.appendChild(option);
      });

      methodeSelect.value = DEFAULT_METHOD_BY_MODEL[model] || '';
    }

  });

  modelSelect.addEventListener('change', () => {
    const model = modelSelect.value;

    if (methodeSelect) {
      methodeSelect.innerHTML = '';

      (METHOD_OPTIONS_BY_MODEL[model] || ['']).forEach((methodName) => {
        const option = document.createElement('option');
        option.value = methodName;
        option.textContent = methodName;
        methodeSelect.appendChild(option);
      });

      methodeSelect.value = DEFAULT_METHOD_BY_MODEL[model] || '';
    }
  });
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

function saveModelSetup(container, prodId) {
  let newData = gatherDrawerData(container);

  if (!newData.PROD_ID) {
    newData.PROD_ID = prodId;
  }

  const row = getProductRow(prodId) || {};

  newData = {
    ...row,
    ...newData,

    PROD_ID: prodId,

    __PRODUCT_TEMPLATE__:
      row.__PRODUCT_TEMPLATE__ ||
      row.product_template ||
      'FIXED_BOND',

    __UI_MODE__:
      row.__UI_MODE__ ||
      row.ui_mode ||
      '',

    CouponType:
      row.CouponType ||
      row.coupon_type ||
      'FIX',
  };

  newData = applyProductTemplateDefaults(newData, 'v_PRODUCTS_APP');

  console.log('[SAVE MODEL SETUP DRAWER]', {
    prodId,
    newData,
  });

  const note = container.querySelector('.structure-drawer-note');
  if (note) {
    note.textContent = 'Saving model setup...';
  }

  window.__preserveStructureValuationOnNextProductRefresh = {
    source: 'modelSetupSave',
    productId: String(prodId || '').trim(),
  };

    const productIdForModelSave = String(prodId || '').trim();

  if (!window.__productValuationStaleByProdId) {
    window.__productValuationStaleByProdId = {};
  }

  window.__productValuationStaleByProdId[productIdForModelSave] = true;

  window.api.send('update-data', {
    cleanTableName: 'v_PRODUCTS_APP',
    rowIndex: null,
    newData,
    uniqueIdentifier: {
      column: 'PROD_ID',
      value: prodId,
    },
  });
}

export function renderModelSetupDrawer(container, prodId) {
  if (!container) return;

  const row = getProductRow(prodId);

  if (!row) {
    container.innerHTML = `
      <section class="structure-drawer-card structure-drawer-error">
        Product not found: ${escapeHtml(prodId)}
      </section>
    `;
    return;
  }

  const drawerConfig = getModelSetupDrawerConfig(row);

  const fields = Array.isArray(drawerConfig.fields)
    ? drawerConfig.fields
    : FALLBACK_MODEL_SETUP_FIELDS;

  if (!row) {
    container.innerHTML = `
      <section class="structure-drawer-card structure-drawer-error">
        Product not found: ${escapeHtml(prodId)}
      </section>
    `;
    return;
  }

  const finlib = normalizeFinlib(row.FINLIB);
  const model = normalizeModel(finlib, formatValue(row.MODEL));
  const methode = normalizeMethode(model, row.METHODE);

  const modelState = {
    finlib,
    model,
    methode,
  };

  container.innerHTML = `
    <section class="structure-drawer-card">
      <div class="structure-drawer-header">
        <h3 class="structure-drawer-title">
          ${escapeHtml(drawerConfig.label || 'Model & Pricing')}
        </h3>

        <span class="structure-drawer-prod-id">
          ${escapeHtml(formatValue(row.PROD_ID))}
        </span>
      </div>

      <div class="structure-drawer-grid">
        ${fields.map(field => renderModelField(field, row, modelState)).join('')}
      </div>

      <div class="structure-drawer-actions">
        <button
          id="saveModelSetupDrawer"
          type="button"
          class="structure-action-button"
        >
          Save Model Setup
        </button>
      </div>

      <div class="structure-drawer-note">
        Unsaved changes stay local until you click Save.
      </div>
    </section>
  `;

  bindModelDropdownSync(container);

  container
    .querySelector('#saveModelSetupDrawer')
    ?.addEventListener('click', () => {
      saveModelSetup(container, prodId);
    });


}