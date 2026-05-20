// src/renderer/features/products/structureTimeline/structureModelSetupDrawer.js

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
  ql: ['DCF_ql'],
  vxp: ['DCF_vxp', 'LMM_vxp'],
};

const DEFAULT_MODEL_BY_FINLIB = {
  ql: 'DCF_ql',
  vxp: 'LMM_vxp',
};

const DEFAULT_METHOD_BY_MODEL = {
  DCF_ql: '',
  DCF_vxp: 'tree_structure',
  LMM_vxp: 'tree_structure',
};

function getProductRow(prodId) {
  const prodDataArr = appState.getProdData?.() || [];
  const needle = String(prodId ?? '').trim();

  return prodDataArr.find(
    row => String(row?.PROD_ID ?? '').trim() === needle
  ) || null;
}

function getModelSetupDrawerConfig() {
  return PRODUCT_TEMPLATES
    ?.COMPLEX_BOND
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
        <input
          class="structure-drawer-input"
          value="${escapeHtml(modelState.methode)}"
          data-field="${field}"
        />
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
  const methodeInput = container.querySelector('[data-field="METHODE"]');

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

    if (methodeInput) {
      methodeInput.value = DEFAULT_METHOD_BY_MODEL[model] || '';
    }
  });

  modelSelect.addEventListener('change', () => {
    const model = modelSelect.value;

    if (methodeInput) {
      methodeInput.value = DEFAULT_METHOD_BY_MODEL[model] || '';
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

  // Critical: drawer save must preserve Complex Bond routing.
  newData.__PRODUCT_TEMPLATE__ = 'COMPLEX_BOND';
  newData.CouponType = 'CUSTOM';

  newData = applyProductTemplateDefaults(newData, 'v_PRODUCTS_APP');

  console.log('[SAVE MODEL SETUP DRAWER]', {
    prodId,
    newData,
  });

  window.api.send('update-data', {
    cleanTableName: 'v_PRODUCTS_APP',
    rowIndex: null,
    newData,
    uniqueIdentifier: {
      column: 'PROD_ID',
      value: prodId,
    },
  });

  const note = container.querySelector('.structure-drawer-note');
  if (note) {
    note.textContent = 'Save submitted.';
  }
}

export function renderModelSetupDrawer(container, prodId) {
  if (!container) return;

  const row = getProductRow(prodId);
  const drawerConfig = getModelSetupDrawerConfig();

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
  const methode =
    formatValue(row.METHODE) ||
    DEFAULT_METHOD_BY_MODEL[model] ||
    '';

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