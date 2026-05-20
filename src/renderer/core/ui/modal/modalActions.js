'use strict';



import { handleStructureTimelineModal } from '../../../features/products/StructureTimelineModal.js';
import { setupAddOperation } from './modalAddAction.js';
import { setupEditOperation } from './modalEditAction.js';
import { requestTableRefreshAfterMutation } from './modalRefresh.js';
import { generateInputFields } from './modalFields.js';
import { makeModalDraggable } from './draggableModal.js';
import { closeModal } from './modalUI.js';
import { issuerData } from '../../../features/products/ISSUER.js';
import { displayErrorMessage } from './modalFeedback.js';
import { applyProductTemplateDefaults } from '../../../features/products/productTemplateResolver.js';


// =====================================================
// Public entry
// =====================================================


function isProductTableName(tableName) {
  return (
    tableName === 'v_PRODUCTS_APP' ||
    tableName === 'v_PRODUCTS_CANONICAL' ||
    tableName === 'PRODUCTS_MASTER'
  );
}

function resolveProductTemplateName(rowData = {}) {
  const explicit =
    rowData.__PRODUCT_TEMPLATE__ ||
    rowData.__PRODUCT_TEMPLATE_SELECTOR__ ||
    '';

  if (explicit) return explicit;

  const couponType = String(rowData.CouponType || '').trim().toUpperCase();

  if (couponType === 'FIX') return 'FIXED_BOND';
  if (couponType === 'FLOATER' || couponType === 'FRN') return 'FRN';
  if (couponType === 'CUSTOM') return 'COMPLEX_BOND';

  return 'COMPLEX_BOND';
}

function resolveProductUiMode(templateName) {
  if (templateName === 'FIXED_BOND') return 'simple_fixed';
  if (templateName === 'FRN') return 'simple_frn';
  if (templateName === 'COMPLEX_BOND') return 'complex';

  return 'complex';
}

export function handleModalAction(_event, data, rowIndex, selectedTableName, actionType) {
  console.log('[ModalAction] table:', selectedTableName, 'action:', actionType);

  if (isProductTableName(selectedTableName)) {
    if (actionType === 'add') {
      console.log('[PRODUCT MODAL ROUTE BLOCK] Product add uses new Product Editor');

      handleStructureTimelineModal(null, {
        mode: 'create',
        source: 'modalActions-product-add-redirect',
        templateName: null,
      });

      return;
    }

    if (actionType === 'edit') {
      const rowData = (Array.isArray(data) ? data[rowIndex] : data) || {};
      const prodId =
        rowData.PROD_ID ||
        rowData.product_id ||
        rowData.prod_id ||
        '';

      if (!prodId) {
        console.warn('[PRODUCT MODAL ROUTE BLOCK] Missing PROD_ID for product edit', {
          rowIndex,
          rowData,
        });
        return;
      }

      const templateName = resolveProductTemplateName(rowData);
      const uiMode = resolveProductUiMode(templateName);

      console.log('[PRODUCT MODAL ROUTE BLOCK] Product edit uses new Product Editor', {
        prodId,
        templateName,
        uiMode,
      });

      handleStructureTimelineModal(String(prodId).trim(), {
        mode: 'edit',
        source: 'modalActions-product-edit-redirect',
        templateName,
        uiMode,
      });

      return;
    }
  }

  displayModal(actionType, rowIndex);
  setupModalFields(actionType, data, rowIndex, selectedTableName);

  if (actionType === 'add') {
    setupAddOperation(selectedTableName);
  } else if (actionType === 'edit') {
    const rowData = (Array.isArray(data) ? data[rowIndex] : null) || {};
    setupEditOperation(rowData, rowIndex, selectedTableName);
  }

  //removeCouponButton();
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



    generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
  }
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
  const finalData = applyProductTemplateDefaults(newData, cleanTableName);

  console.log('[SAVE MODAL DATA]', {
    cleanTableName,
    template: finalData.__PRODUCT_TEMPLATE__,
    couponType: finalData.CouponType,
    schedule: finalData.SCHEDULE,
    finlib: finalData.FINLIB,
    model: finalData.MODEL,
    methode: finalData.METHODE,
    finalData,
  });

  window.api.send('update-data', {
    newData: finalData,
    cleanTableName,
    rowIndex,
    uniqueIdentifier,
  });
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

