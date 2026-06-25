// src/renderer/features/CUSTOMER_SETUP/customerCategoryPanel.js
//
// CUSTOMER SETUP -> Category slide-in (panel-customer-category).
// Renders CUSTOMER_PRODUCT_CATEGORY_SETUP with the existing app table framework
// (processData) and wires Add/Edit through the generic CRUD modal
// (handleModalAction), exactly like DATAProvider.js. No custom DOM row logic.
//
// CRUD framework hooks used:
//   - getUniqueIdentifier: PK 'id' registered for this table (Edit needs it).
//   - hiddenFieldsByTable: id/created_at/updated_at hidden in the modal form.
//   - update-data / add-new-row IPC -> generic updateRecord / insertRowInTable.
//   - After mutation, the framework refreshes the table -> DataPump re-sends
//     CUSTOMER_PRODUCT_CATEGORY_SETUPData -> this render handler runs again.
//
// Delete: hard delete is blocked for this table (eraseButton suppressed in the
// edit modal). Deactivation = edit is_active to 0 and Save (a normal update).

import processData from '../../core/ui/modal/modalData.js';
import { handleModalAction } from '../../core/ui/modal/modalActions.js';

const CONTAINER_ID = 'customerCategoryTableContainer';
const ADD_BUTTON_ID = 'customerCategoryAddButton';
const TABLE_NAME = 'CUSTOMER_PRODUCT_CATEGORY_SETUP';

// Fallback only — mirrors the DB seed; used if the DB load is empty/unavailable.
const DEFAULT_ROWS = [
  { id: null, category_name: '1_Kontokorrentkonten', category_type: 'FIXED_VALUE', is_active: 1, sort_order: 10 },
  { id: null, category_name: '5_Termineinlagen', category_type: 'FIXED_VALUE', is_active: 1, sort_order: 20 },
];

// Full raw DB rows kept for CRUD (the Edit form needs id and all columns).
// The displayed table is a filtered/labelled view of these, in the same order.
let currentRows = [];

function sortRows(rows) {
  return [...rows].sort((a, b) => {
    const sa = Number(a.sort_order ?? 0);
    const sb = Number(b.sort_order ?? 0);
    if (sa !== sb) return sa - sb;
    return String(a.category_name ?? '').localeCompare(String(b.category_name ?? ''));
  });
}

// Display view: nice headers + Active as Yes/No. Edits still use currentRows (raw).
function toDisplayRows(rows) {
  return rows.map((r) => ({
    'Category Name': r.category_name ?? '',
    // Only an explicit FIXED_VALUE means "no valuation"; empty/NULL is normal.
    'Category Type': String(r.category_type ?? '').trim().toUpperCase() === 'FIXED_VALUE'
      ? 'No valuation'
      : 'Valuation active',
    'Active': Number(r.is_active) === 1 ? 'Yes' : 'No',
    'Sort Order': r.sort_order ?? '',
  }));
}

// DataPump render handler. Called at bootstrap (no rows -> defaults) and again on
// every CUSTOMER_PRODUCT_CATEGORY_SETUPData push (including after Add/Edit).
export function renderCustomerCategoryPanel(rows) {
  const container = document.getElementById(CONTAINER_ID);
  if (!container) return;

  const source = Array.isArray(rows) && rows.length > 0 ? rows : DEFAULT_ROWS;
  currentRows = sortRows(source);

  // processData adds the Edit column for this (non-excluded) table name.
  container.innerHTML = processData(toDisplayRows(currentRows), TABLE_NAME);

  // Wire each Edit button to the generic CRUD modal using the full raw row.
  container.querySelectorAll('.edit-button[data-row]').forEach((button) => {
    button.addEventListener('click', (event) => {
      event.stopPropagation();
      const rowIndex = parseInt(button.getAttribute('data-row'), 10);
      const row = currentRows[rowIndex];

      // Fallback-Zeile (DEFAULT_ROWS, id=null): DB ist noch nicht geladen. Ein Edit
      // würde ins Leere laufen (Update WHERE id=null). Stattdessen echte Daten holen.
      if (!row || row.id == null) {
        window.api?.send?.('fetch-table-data', TABLE_NAME);
        return;
      }

      handleModalAction(event, currentRows, rowIndex, TABLE_NAME, 'edit');
    });
  });
}

// Wire the Add button once (it lives outside the re-rendered table container).
export function initCustomerCategoryCrud() {
  const addButton = document.getElementById(ADD_BUTTON_ID);
  if (!addButton || addButton.dataset.bound === '1') return;
  addButton.dataset.bound = '1';

  addButton.addEventListener('click', (event) => {
    handleModalAction(event, currentRows, null, TABLE_NAME, 'add');
  });
}
