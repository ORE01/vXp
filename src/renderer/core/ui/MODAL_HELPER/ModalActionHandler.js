'use strict';

import { generateInputFields } from './HandleInputFields.js';
import { formatInputFieldValue } from '../../../utils/format.js';
import { makeModalDraggable } from './DraggableModal.js';

import { issuerData } from '../../../features/NEW_PRODUCTS/ISSUER.js';
import { buildOrderedFieldsForModal } from '../../../features/NEW_PRODUCTS/PROD.js';

import { appState } from '../../../renderer.js';

let isAddingRow = false;
let isErasing = false;

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

  // Clear specific sections (ProdAll/CouponSchedules)
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

  // ADD: default from last row
  if (actionType === 'add') {
    const baseRow = (Array.isArray(data) && data.length > 0) ? data[data.length - 1] : {};
    let rowDataForForm;

    if (selectedTableName === 'ProdAll') {
      rowDataForForm = { ...(buildOrderedFieldsForModal(baseRow) || {}) };
    } else {
      rowDataForForm = { ...(baseRow || {}) };
    }

    // clear id fields on add
    if ('id' in rowDataForForm) rowDataForForm.id = '';
    if ('ID' in rowDataForForm) rowDataForForm.ID = '';

    // issuer default
    if ('ISSUER' in rowDataForForm && !rowDataForForm.ISSUER) {
      rowDataForForm.ISSUER = uniqueIssuers[0] || '';
    }

    generateInputFields(rowDataForForm, form, uniqueIssuers, selectedTableName);
    return;
  }

  // EDIT:
  if (actionType === 'edit') {
    const raw = (Array.isArray(data) && data[rowIndex]) ? data[rowIndex] : data;
    let rowDataForForm = raw || {};

    if (selectedTableName === 'ProdAll') {
      rowDataForForm = buildOrderedFieldsForModal(raw) || raw || {};
    }

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

// =====================================================
// ADD
// =====================================================

function setupAddOperation(selectedTableName) {
  const saveButton = document.getElementById('saveButton');
  if (!saveButton) return;

  // Rebind save click cleanly
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
    const newRowData = gatherModalData(form);
    delete newRowData.ID; // keep old behavior

    await addNewRow(newRowData, selectedTableName);

    closeModal();

    // ✅ trigger central refresh (NO local once('DealsMainData'))
    requestTableRefreshAfterMutation(selectedTableName);

    if (typeof onReload === 'function') await onReload(selectedTableName);

    console.log(`[ModalAction] New row added to ${selectedTableName}`);
  } catch (error) {
    displayErrorMessage(`Failed to add new row: ${error?.message || String(error)}`);
  } finally {
    isAddingRow = false;
  }
}

// =====================================================
// EDIT
// =====================================================

function setupEditOperation(rowData, rowIndex, selectedTableName) {
  // Save button
  const saveButton = document.getElementById('saveButton');
  if (saveButton) {
    const clone = saveButton.cloneNode(true);
    saveButton.parentNode.replaceChild(clone, saveButton);
    clone.addEventListener('click', editSaveButtonHandler(selectedTableName, rowIndex, rowData));
  }

  // Erase button
  const eraseButton = document.getElementById('eraseButton');
  if (eraseButton) {
    const clone = eraseButton.cloneNode(true);
    eraseButton.parentNode.replaceChild(clone, eraseButton);
    clone.addEventListener('click', eraseButtonHandler(selectedTableName, rowIndex, rowData));
  }
}

const editSaveButtonHandler = (selectedTableName, rowIndex, data) => async () => {
  if (!selectedTableName) {
    displayErrorMessage('Error: No table selected.');
    return;
  }

  try {
    const form = document.getElementById('editForm');
    const formData = form ? gatherModalData(form) : {};
    let newData = { ...(data || {}), ...(formData || {}) };

    // Customer special handling (keep your behavior)
    if (String(selectedTableName).trim() === 'Customer') {
      if (newData.id == null) {
        try {
          const arr = window.appState?.getCustomerData?.();
          const customer = Array.isArray(arr) ? arr[0] : arr;
          if (customer?.id != null) newData.id = customer.id;
        } catch {}
      }

      if (newData.pdf_header == null) {
        const inputH = document.getElementById('or-headerText');
        if (inputH) newData.pdf_header = (inputH.value || '').trim();
      }

      if ((data && Object.prototype.hasOwnProperty.call(data, 'pdf_footer')) && newData.pdf_footer == null) {
        const inputF = document.getElementById('or-footerText');
        if (inputF) newData.pdf_footer = (inputF.value || '').trim();
      }
    }

    const cleanTableName = getCleanTableName(selectedTableName);
    const uniqueIdentifier = getUniqueIdentifier(newData, selectedTableName);

    await saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier);

    // Close immediately; UI refresh arrives via DataPump after update success + fetch refresh
    closeModal();
  } catch (error) {
    displayErrorMessage(`Failed to save changes: ${error?.message || String(error)}`);
  }
};

// SAVE
export function saveChanges(newData, cleanTableName, rowIndex, uniqueIdentifier) {
  window.api.send('update-data', { newData, cleanTableName, rowIndex, uniqueIdentifier });
}

// =====================================================
// ERASE
// =====================================================

export const eraseButtonHandler = (selectedTableName, _rowIndex, data) => async () => {
  if (isErasing) return;
  isErasing = true;

  try {
    const cleanTableName = getCleanTableName(selectedTableName);
    const uniqueIdentifier = getUniqueIdentifier(data, selectedTableName);

    await eraseRow(cleanTableName, uniqueIdentifier);

    // NOTE: extra deletions are still here; consider moving to main later
    await eraseProdIDFromProdCouponSchedules(uniqueIdentifier);
    await eraseProdIDFromDeals(uniqueIdentifier);

    closeModal();

    // ✅ trigger central refresh (NO local once('DealsMainData'))
    requestTableRefreshAfterMutation(selectedTableName);
  } catch (error) {
    displayErrorMessage(`Failed to erase row: ${error?.message || String(error)}`);
  } finally {
    isErasing = false;
  }
};

function eraseRow(cleanTableName, uniqueIdentifier) {
  window.api.send('erase-data', { cleanTableName, uniqueIdentifier });
}

// =====================================================
// IPC Success Hooks (Action-only)
// =====================================================

window.api.receive('erase-data-success', ({ cleanTableName }) => {
  console.log('[erase-data-success]', cleanTableName);
  // Keep it minimal: modal already closed by handler, but safe:
  // closeModal();
  requestTableRefreshAfterMutation(cleanTableName);
});

window.api.receive('update-data-success', ({ cleanTableName }) => {
  console.log('[update-data-success]', cleanTableName);
  requestTableRefreshAfterMutation(cleanTableName);
});

// Optional: If you have error channels for erase/update, bind them too
window.api.receive('erase-data-error', (e) => {
  const msg = e?.message || e?.error || String(e || 'erase failed');
  displayErrorMessage(msg);
});
window.api.receive('update-data-error', (e) => {
  const msg = e?.message || e?.error || String(e || 'update failed');
  displayErrorMessage(msg);
});

// =====================================================
// Refresh helper (central approach)
// =====================================================

function requestTableRefreshAfterMutation(selectedTableName) {
  const clean = getCleanTableName(selectedTableName);

  if (!clean) return;

  if (clean === 'RATES_SNAPSHOTS') {
    try { window.api.send('fetch-table-data', 'RATES'); } catch {}
    return;
  }

  try { window.api.send('fetch-table-data', clean); } catch {}

  if (clean !== 'DealsMain') {
    try { window.api.send('fetch-table-data', 'DealsMain'); } catch {}
  }
}

// =====================================================
// Data gathering + utilities
// =====================================================

function gatherModalData(form) {
  if (!form) return {};

  const newRowData = {};
  const inputFields = form.querySelectorAll('input, select');
  const presentFields = new Set();

  inputFields.forEach((input) => {
    const fieldName = input.getAttribute('data-field');
    if (!fieldName) return;

    presentFields.add(fieldName);

    let rawVal;
    if (input.type === 'checkbox') rawVal = input.checked ? '1' : '0';
    else rawVal = (input.value ?? '').toString().trim();

    const value = formatInputFieldValue(fieldName, rawVal);
    newRowData[fieldName] = (value != null && String(value).toLowerCase() !== 'null') ? value : '';
  });

  // Optional: START_DATE / MATURITY tokens only if field exists
  const hasStart = presentFields.has('START_DATE');
  const hasMat = presentFields.has('MATURITY');

  const startToken = (hasStart ? (form.querySelector('#start_dateToken')?.value || '') : '').trim();
  const matToken = (hasMat ? (form.querySelector('#maturityToken')?.value || '') : '').trim();

  const startISO = (hasStart ? (form.querySelector('#start_dateDate')?.value || '') : '').trim();
  const matISO = (hasMat ? (form.querySelector('#maturityDate')?.value || '') : '').trim();

  if (hasStart) {
    if (startToken) newRowData.START_DATE = startToken;
    else if (startISO) newRowData.START_DATE = startISO;
  }

  if (hasMat) {
    if (matToken) newRowData.MATURITY = matToken;
    else if (matISO) newRowData.MATURITY = matISO;
  }

  return newRowData;
}

export function addNewRow(newRowData, cleanTableName, { timeoutMs = 15000 } = {}) {
  const requestId = `req_${Date.now()}_${Math.random().toString(36).slice(2)}`;
  const successCh = `add-new-row-success:${requestId}`;
  const errorCh = `add-new-row-error:${requestId}`;

  return new Promise((resolve, reject) => {
    let timer;

    const cleanup = () => {
      if (timer) clearTimeout(timer);
      if (window.api?.removeAllListeners) {
        window.api.removeAllListeners(successCh);
        window.api.removeAllListeners(errorCh);
      }
    };

    const onSuccess = () => { cleanup(); resolve(); };
    const onError = (error) => {
      const msg = error?.message || String(error || 'Unknown error');
      cleanup();
      reject(new Error(msg));
    };

    window.api.once(successCh, onSuccess);
    window.api.once(errorCh, onError);

    window.api.send('add-new-row', { newRowData, cleanTableName, requestId });

    if (timeoutMs > 0) {
      timer = setTimeout(() => {
        cleanup();
        reject(new Error(`addNewRow timeout (${requestId})`));
      }, timeoutMs);
    }
  });
}

function getCleanTableName(tableName) {
  if (typeof tableName === 'string') return tableName.endsWith('Data') ? tableName.slice(0, -4) : tableName;
  return '';
}

function getUniqueIdentifier(newData, selectedTableName) {
  const name = String(selectedTableName || '');
  const upper = name.toUpperCase();

  let uniqueIdentifierColumn;

  // Deals / Offers tables -> TRADE_ID
  if (upper.startsWith('DEALS') || upper.startsWith('OFFERS_') || upper.startsWith('OFFER_')) {
    uniqueIdentifierColumn = 'TRADE_ID';
  } else {
    switch (selectedTableName) {
      case 'Issuer': uniqueIdentifierColumn = 'TICKER'; break;
      case 'ProdAll': uniqueIdentifierColumn = 'PROD_ID'; break;
      case 'CSParameter': uniqueIdentifierColumn = 'CSSzenario'; break;
      case 'ecb':
      case 'fed':
      case 'yahoo':
      case 'ProdCouponSchedules':
        uniqueIdentifierColumn = 'ID'; break;
      case 'EUSW': uniqueIdentifierColumn = 'YEAR'; break;
case 'RATES_SNAPSHOTS':
  return {
    composite: true,
    columns: {
      asof_date: newData.asof_date,
      run_id: newData.run_id,
      scenario_id: newData.scenario_id,
      ccy: newData.ccy,
      curve_id: newData.curve_id,
      instrument: newData.instrument,
      tenor: newData.tenor
    }
  };
      case 'MVaRInput':
      case 'Customer':
      case 'CreditVaRInputThreshold':
      case 'CreditVaRInput':
        uniqueIdentifierColumn = 'id'; break;
      case 'PortfolioHistoryMetrics':
        uniqueIdentifierColumn = 'DATE'; break;
      default:
        console.error('[ModalAction] Unknown table:', selectedTableName);
        return null;
    }
  }

  if (uniqueIdentifierColumn && newData && Object.prototype.hasOwnProperty.call(newData, uniqueIdentifierColumn)) {
    return { column: uniqueIdentifierColumn, value: newData[uniqueIdentifierColumn] };
  }

  console.error('[ModalAction] Unable to determine unique identifier for:', selectedTableName);
  return null;
}

async function eraseProdIDFromProdCouponSchedules(uniqueIdentifier) {
  try {
    let uniqueValue = (typeof uniqueIdentifier === 'object' && uniqueIdentifier !== null)
      ? uniqueIdentifier.value
      : String(uniqueIdentifier).trim();

    const couponData = appState.getCouponData?.() || [];
    const matchingRows = couponData.filter(row => row?.PROD_ID && String(row.PROD_ID).trim() === uniqueValue);

    for (const row of matchingRows) {
      if (!row?.ID) continue;
      const numericID = Number(String(row.ID).replace(/,/g, ''));
      await eraseRow('ProdCouponSchedules', { column: 'ID', value: numericID });
    }
  } catch (error) {
    console.error('[ModalAction] eraseProdIDFromProdCouponSchedules error', error);
  }
}

async function eraseProdIDFromDeals(uniqueIdentifier) {
  // NOTE: this was marked as not working in your code; kept but safe-guarded
  try {
    let uniqueValue = (typeof uniqueIdentifier === 'object' && uniqueIdentifier !== null)
      ? uniqueIdentifier.value
      : String(uniqueIdentifier).trim();

    const dealsData = appState.getDealsData?.() || [];
    const matchingRows = dealsData.filter(row => row?.PROD_ID && String(row.PROD_ID).trim() === uniqueValue);

    for (const row of matchingRows) {
      if (!row?.ID) continue;
      const numericID = Number(String(row.ID).replace(/,/g, ''));
      await eraseRow('DealsMain', { column: 'ID', value: numericID });
    }
  } catch (error) {
    console.error('[ModalAction] eraseProdIDFromDeals error', error);
  }
}

export function closeModal() {
  const modal = document.getElementById('modal');
  if (modal) modal.style.display = 'none';
}

function displayErrorMessage(message) {
  const div = document.getElementById('errorMessage');
  if (div) {
    div.textContent = message;
    div.style.display = 'block';
  } else {
    console.error('[ModalAction] Error message container not found:', message);
  }
}
























