'use strict';

import { closeModal } from './modalUI.js';
import { gatherModalData } from './modalData.js';
import { requestTableRefreshAfterMutation } from './modalRefresh.js';
import { displayErrorMessage } from './modalFeedback.js';
import { applyProductTemplateDefaults } from '../../../features/products/productTemplateResolver.js';

let isAddingRow = false;

// =====================================================
// PRODUCT TABLE DETECTION
// =====================================================

function isProductTableName(tableName) {
  return (
    tableName === 'v_PRODUCTS_APP' ||
    tableName === 'v_PRODUCTS_CANONICAL' ||
    tableName === 'PRODUCTS_MASTER'
  );
}

function sanitizeProductData(row = {}) {
  const clean = { ...(row || {}) };

  // UI-only template fields:
  // Keep __PRODUCT_TEMPLATE_SELECTOR__ / __PRODUCT_TEMPLATE__ for backend routing.
  // The backend service uses them to map Product Type -> CouponType/FINLIB/MODEL.
  // They are not written to DB directly.
  delete clean.__UI_MODE__;

  // technical/generated fields from canonical views — never write back from modal
  delete clean.product_id;
  delete clean.created_at;
  delete clean.updated_at;

  delete clean.PRODUCT_TYPE;
  delete clean.COUPON_FREQ;
  delete clean.PAYMENT_FREQ;
  delete clean.SCHEDULE_RULE;
  delete clean.USES_EVENTS;

  delete clean.fixed_coupon_frequency;
  delete clean.fixed_payment_frequency;
  delete clean.fixed_schedule_generation_rule;
  delete clean.fixed_uses_explicit_events;

  return clean;
}

// =====================================================
// ADD
// =====================================================

export function setupAddOperation(selectedTableName) {
  const saveButton = document.getElementById('saveButton');
  if (!saveButton) return;

  const clone = saveButton.cloneNode(true);
  saveButton.parentNode.replaceChild(clone, saveButton);

  clone.addEventListener('click', async () => {
    const form = document.getElementById('editForm');
    if (!form) return;

    await addSaveButtonHandler(form, selectedTableName);
  });
}

export async function addSaveButtonHandler(form, selectedTableName, onReload) {
  if (isAddingRow) return;
  isAddingRow = true;

  try {
    let newRowData = gatherModalData(form);

    const selectedTemplate =
      form.querySelector('[data-field="__PRODUCT_TEMPLATE_SELECTOR__"]')?.value ||
      form.querySelector('[name="__PRODUCT_TEMPLATE_SELECTOR__"]')?.value ||
      newRowData.__PRODUCT_TEMPLATE_SELECTOR__ ||
      newRowData.__PRODUCT_TEMPLATE__ ||
      null;

    if (selectedTemplate) {
      newRowData.__PRODUCT_TEMPLATE_SELECTOR__ = selectedTemplate;
    }

    delete newRowData.ID;
    delete newRowData.id;

    if (selectedTableName === 'Issuer') {
      // senior_unsecured ist der Notching-Anker und entspricht dem Base-Rating.
      newRowData.senior_unsecured = newRowData.RATING;
    }

    if (selectedTableName === 'DealsMain') {
      if (Object.prototype.hasOwnProperty.call(newRowData, 'DEPOT_BANK')) {
        newRowData.Depotbank = newRowData.DEPOT_BANK;
        delete newRowData.DEPOT_BANK;
      }

      if (Object.prototype.hasOwnProperty.call(newRowData, 'product_id')) {
        newRowData.PROD_ID = newRowData.product_id;
        delete newRowData.product_id;
      }

      delete newRowData.product_name;
    }

    if (isProductTableName(selectedTableName)) {
      newRowData = applyProductTemplateDefaults(newRowData, selectedTableName);

      newRowData = sanitizeProductData(newRowData);

      if (!newRowData.PROD_ID) {
        throw new Error('Missing PROD_ID for new product');
      }

      console.log('[ADD PRODUCT DATA]', {
        table: selectedTableName,
        prodId: newRowData.PROD_ID,
        productName: newRowData.product_name,
        description: newRowData.DESCRIPTION,
        couponType: newRowData.CouponType,
        schedule: newRowData.SCHEDULE,
        finlib: newRowData.FINLIB,
        model: newRowData.MODEL,
        methode: newRowData.METHODE,
        newRowData,
      });

      await addProductViaCanonicalUpdate(newRowData, selectedTableName);
    } else {
      await addNewRow(newRowData, selectedTableName);
    }

    closeModal();
    requestTableRefreshAfterMutation(selectedTableName);

    if (typeof onReload === 'function') {
      await onReload(selectedTableName);
    }

    console.log(`[ModalAddAction] New row added to ${selectedTableName}`);
  } catch (error) {
    displayErrorMessage(`Failed to add new row: ${error?.message || String(error)}`);
  } finally {
    isAddingRow = false;
  }
}

// =====================================================
// PRODUCT ADD: canonical route via update-data
// Important: do NOT insert directly into product views
// =====================================================

function addProductViaCanonicalUpdate(newRowData, selectedTableName, { timeoutMs = 15000 } = {}) {
  return new Promise((resolve, reject) => {
    let done = false;

    const finishOk = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const finishErr = (error) => {
      if (done) return;
      done = true;

      const msg =
        error?.message ||
        error?.error ||
        String(error || 'Unknown product add error');

      reject(new Error(msg));
    };

    window.api.once('update-data-success', finishOk);
    window.api.once('update-data-error', finishErr);

    window.api.send('update-data', {
      cleanTableName: selectedTableName || 'v_PRODUCTS_APP',
      rowIndex: null,
      newData: newRowData,
      uniqueIdentifier: {
        column: 'PROD_ID',
        value: newRowData.PROD_ID,
      },
    });

    if (timeoutMs > 0) {
      setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error(`addProductViaCanonicalUpdate timeout for ${newRowData.PROD_ID}`));
      }, timeoutMs);
    }
  });
}

// =====================================================
// GENERIC ADD: legacy tables
// =====================================================

export function addNewRow(newRowData, cleanTableName, { timeoutMs = 15000 } = {}) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const successCh = `add-new-row-success:${requestId}`;
  const errorCh = `add-new-row-error:${requestId}`;

  return new Promise((resolve, reject) => {
    let done = false;

    const onSuccess = () => {
      if (done) return;
      done = true;
      resolve();
    };

    const onError = (error) => {
      if (done) return;
      done = true;

      const msg = error?.message || String(error || 'Unknown error');
      reject(new Error(msg));
    };

    window.api.once(successCh, onSuccess);
    window.api.once(errorCh, onError);

    window.api.send('add-new-row', {
      newRowData,
      cleanTableName,
      requestId,
    });

    if (timeoutMs > 0) {
      setTimeout(() => {
        if (done) return;
        done = true;
        reject(new Error(`addNewRow timeout (${requestId})`));
      }, timeoutMs);
    }
  });
}