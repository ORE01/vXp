'use strict';

import { PRODUCT_TEMPLATES } from '../../../features/NEW_PRODUCTS/productTemplates.js';

import { setupAddOperation } from './modalAddAction.js';
import { setupEditOperation } from './modalEditAction.js';

import { requestTableRefreshAfterMutation } from './modalRefresh.js';

import { generateInputFields } from './modalFields.js';

import { makeModalDraggable } from './draggableModal.js';
import { closeModal } from './modalUI.js';


import { issuerData } from '../../../features/NEW_PRODUCTS/ISSUER.js';
import { buildOrderedFieldsForModal } from '../../../features/NEW_PRODUCTS/PROD.js';

import { displayErrorMessage } from './modalFeedback.js';


// =====================================================
// Public entry
// =====================================================

export function handleModalAction(_event, data, rowIndex, selectedTableName, actionType) {
  console.log('[ModalAction] table:', selectedTableName, 'action:', actionType);

  displayModal(actionType, rowIndex);
  setupModalFields(actionType, data, rowIndex, selectedTableName);

  if (actionType === 'add') {
    setupAddOperation(selectedTableName);
  } else if (actionType === 'edit') {
    const rowData = (Array.isArray(data) ? data[rowIndex] : null) || {};
    setupEditOperation(rowData, rowIndex, selectedTableName);
  }

  removeCouponButton();
}

// =====================================================
// Modal UI
// =====================================================

function displayModal(actionType, rowIndex = null) {
  const modal = document.getElementById('modal');
  if (!modal) return;

  const modalContent = modal.querySelector('.modal-content');
  const modalTitle = modal.querySelector('h2');

  if (modalTitle) {
    if (actionType === 'add') modalTitle.textContent = 'Add New Row';
    if (actionType === 'edit' && rowIndex != null) modalTitle.textContent = `Edit Row ${rowIndex + 1}`;
  }

  const prodSection = document.getElementById('prodSection');
  const couponSection = document.getElementById('couponSection');
  if (prodSection) prodSection.innerHTML = '';
  if (couponSection) couponSection.innerHTML = '';

  modal.style.display = 'block';

  const closeButton = modal.querySelector('.close');
  if (closeButton) closeButton.onclick = closeModal;

  if (modalContent) makeModalDraggable(modalContent);
}

function setupModalFields(actionType, data, rowIndex, selectedTableName) {
  const modal = document.getElementById('modal');
  if (!modal) return;

  const form = modal.querySelector('#editForm');
  if (!form) return;

  form.innerHTML = '';

  const uniqueIssuers = [...new Set((issuerData || []).map((item) => item.ISSUER).filter(Boolean))];

  if (actionType === 'add') {
    const baseRow = (Array.isArray(data) && data.length > 0)
      ? data[data.length - 1]
      : {};

    let rowDataForForm;

    if (selectedTableName === 'ProdAll') {
      const initialTemplateName = 'FIXED_BOND';

      rowDataForForm = {
        ...(buildOrderedFieldsForModal(baseRow, initialTemplateName) || {}),
      };

      if ('id' in rowDataForForm) rowDataForForm.id = '';
      if ('ID' in rowDataForForm) rowDataForForm.ID = '';

      if ('ISSUER' in rowDataForForm && !rowDataForForm.ISSUER) {
        rowDataForForm.ISSUER = uniqueIssuers[0] || '';
      }

      renderProductTemplateSelector(
        form,
        baseRow,
        uniqueIssuers,
        selectedTableName,
        initialTemplateName
      );

      generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
      return;
    }

    rowDataForForm = { ...(baseRow || {}) };

    if ('id' in rowDataForForm) rowDataForForm.id = '';
    if ('ID' in rowDataForForm) rowDataForForm.ID = '';

    if ('ISSUER' in rowDataForForm && !rowDataForForm.ISSUER) {
      rowDataForForm.ISSUER = uniqueIssuers[0] || '';
    }

    generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
    return;
  }

  if (actionType === 'edit') {
    const raw = (Array.isArray(data) && data[rowIndex]) ? data[rowIndex] : data;
    let rowDataForForm = raw || {};

    if (selectedTableName === 'ProdAll') {
      const couponType = String(raw?.CouponType || '').trim().toUpperCase();

      const initialTemplateName =
        raw?.__PRODUCT_TEMPLATE__
        || (
          couponType === 'FLOATER'
            ? 'FRN'
            : couponType === 'FIX'
              ? 'FIXED_BOND'
              : 'COMPLEX_BOND'
        );

      rowDataForForm = {
        ...(buildOrderedFieldsForModal(raw, initialTemplateName) || raw || {}),
      };

      renderProductTemplateSelector(
        form,
        raw,
        uniqueIssuers,
        selectedTableName,
        initialTemplateName
      );

      generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
      return;
    }

    generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
  }
}

function renderProductTemplateSelector(
  form,
  baseRow,
  uniqueIssuers,
  selectedTableName,
  initialTemplateName
) {
  if (selectedTableName !== 'ProdAll') return;

  const selectorRow = document.createElement('div');
  selectorRow.classList.add('form-row', 'product-template-selector-row');

  const label = document.createElement('label');
  label.textContent = 'Product Type';
  label.classList.add('label');

  const select = document.createElement('select');
  select.classList.add('input-field');
  select.setAttribute('data-field', '__PRODUCT_TEMPLATE_SELECTOR__');

  Object.entries(PRODUCT_TEMPLATES).forEach(([templateName, template]) => {
    const option = document.createElement('option');
    option.value = templateName;
    option.textContent = template.label || templateName;
    select.appendChild(option);
  });

  select.value = initialTemplateName;

  select.addEventListener('change', () => {
    const templateName = select.value;

    const rowDataForForm = {
      ...(buildOrderedFieldsForModal(baseRow, templateName) || {}),
    };

    form.innerHTML = '';

    renderProductTemplateSelector(
      form,
      baseRow,
      uniqueIssuers,
      selectedTableName,
      templateName
    );

    generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
  });

  selectorRow.appendChild(label);
  selectorRow.appendChild(select);
  form.appendChild(selectorRow);
}



function removeCouponButton() {
  const couponButton = document.getElementById('coupon-button');
  if (couponButton) couponButton.remove();
}

document.addEventListener('DOMContentLoaded', () => {
  const closeButton = document.querySelector('.close');
  if (closeButton) closeButton.addEventListener('click', removeCouponButton);
});





// SAVE
export function saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier) {
  window.api.send('update-data', { newData, cleanTableName, rowIndex, uniqueIdentifier });
}

// =====================================================
// IPC Success Hooks (Action-only)
// =====================================================

window.api.receive('erase-data-success', ({ cleanTableName }) => {
  console.log('[erase-data-success]', cleanTableName);
  requestTableRefreshAfterMutation(cleanTableName);
});

window.api.receive('update-data-success', ({ cleanTableName }) => {
  console.log('[update-data-success]', cleanTableName);
  requestTableRefreshAfterMutation(cleanTableName);
});

window.api.receive('erase-data-error', (e) => {
  const msg = e?.message || e?.error || String(e || 'erase failed');
  displayErrorMessage(msg);
});

window.api.receive('update-data-error', (e) => {
  const msg = e?.message || e?.error || String(e || 'update failed');
  displayErrorMessage(msg);
});

