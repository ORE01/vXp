// src/renderer/features/CUSTOMER/tableLayouts/tableColumnSelector.js

import {
  getVisibleColumns,
  setVisibleColumns,
  resetVisibleColumns,
  getActiveLayoutName,
  setActiveLayout,
  isTableLayoutDirty,
  discardTableLayoutChanges,
  markLayoutSaved,
} from './tableLayoutStore.js';

const DEFAULT_LAYOUT_NAME = 'default';
const CUSTOM_LAYOUT_NAME = 'custom';

function getSelectedKeys(container) {
  return Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked')
  ).map((el) => el.value);
}

function applySelection(container, columnKeys) {
  const safeColumnKeys = Array.isArray(columnKeys)
    ? columnKeys
    : [];

  const checkboxes = container.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    checkbox.checked = safeColumnKeys.includes(checkbox.value);
  });
}

function updateLayoutStatus(container, tableId) {
  const statusElement = container.querySelector('[data-role="layout-status"]');

  if (!statusElement) return;

  const dirty = isTableLayoutDirty(tableId);

  if (dirty) {
    statusElement.textContent = 'Unsaved changes';
    statusElement.style.color = '#b45309';
    return;
  }

  statusElement.textContent = 'Saved';
  statusElement.style.color = '#166534';
}

function updateLayoutSelect(container, tableId) {
  const layoutSelect = container.querySelector('[data-role="layout-select"]');

  if (!layoutSelect) return;

  layoutSelect.value = getActiveLayoutName(tableId);
}

export function renderTableColumnSelector({
  tableId,
  containerId,
  columns = [],
  defaultVisibleColumns = [],
  // Optional: [{ title, keys: [...] }]. Wenn gesetzt, werden die Checkboxen in
  // benannte Gruppen unterteilt (Reihenfolge wie hier); Spalten ohne Gruppe kommen
  // in eine "Other"-Sektion. Ohne groups bleibt die flache Liste (rueckwaertskompatibel).
  groups = null,
}) {

  const container = document.getElementById(containerId);

  if (!container) return;

const storedVisibleColumns = getVisibleColumns(tableId);

const selected =
  Array.isArray(storedVisibleColumns)
    ? storedVisibleColumns
    : defaultVisibleColumns;

  const checkboxItem = (col) => `
        <label
          class="column-selector-item"
          style="display:inline-flex; align-items:center; gap:6px; margin:4px 10px 4px 0;"
        >
          <input
            type="checkbox"
            value="${col.key}"
            ${selected.includes(col.key) ? 'checked' : ''}
          />

          <span>${col.label}</span>
        </label>`;

  const groupSection = (title, cols) => `
      <div class="column-selector-group" style="margin-bottom:6px;">
        <div class="column-selector-group-title"
             style="font-weight:700; font-size:11px; letter-spacing:.03em; text-transform:uppercase; color:var(--text-bright); margin:10px 0 3px;">
          ${title}
        </div>
        <div class="column-selector-group-items" style="display:flex; flex-wrap:wrap; padding-left:16px;">
          ${cols.map(checkboxItem).join('')}
        </div>
      </div>`;

  let columnsHtml;
  if (Array.isArray(groups) && groups.length) {
    const byKey = new Map(columns.map((c) => [c.key, c]));
    const used = new Set();
    const sections = groups.map((g) => {
      const cols = (g.keys || []).map((k) => byKey.get(k)).filter(Boolean);
      cols.forEach((c) => used.add(c.key));
      return cols.length ? groupSection(g.title, cols) : '';
    }).join('');
    const leftovers = columns.filter((c) => !used.has(c.key));
    columnsHtml = sections + (leftovers.length ? groupSection('Other', leftovers) : '');
  } else {
    columnsHtml = columns.map(checkboxItem).join('');
  }

  // "Column Order": nur die aktuell sichtbaren Spalten, in aktueller Reihenfolge,
  // per Drag&Drop sortierbar (unabhaengig von den fachlichen Gruppen; die Reihenfolge
  // lebt in visibleColumns = `selected`).
  const byKeyAll = new Map(columns.map((c) => [c.key, c]));
  const orderList = (Array.isArray(selected) ? selected : [])
    .filter((k) => byKeyAll.has(k))
    .map((k) => byKeyAll.get(k));
  const columnOrderHtml = orderList.length
    ? orderList.map((col) => `
        <div class="column-order-item" draggable="true" data-col-key="${col.key}">
          <span class="column-order-grip" aria-hidden="true">⠿</span>
          <span class="column-order-label">${col.label}</span>
        </div>`).join('')
    : `<div class="column-order-empty" style="opacity:.6; font-size:12px;">No visible columns</div>`;

  container.innerHTML = `
    <div
      class="column-selector-layout"
      style="margin-bottom:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;"
    >
      <label style="font-weight:600;">
        Layout
      </label>

      <select data-role="layout-select">
        <option value="${DEFAULT_LAYOUT_NAME}">Default</option>
        <option value="${CUSTOM_LAYOUT_NAME}">Custom</option>
      </select>

      <span
        data-role="layout-status"
        style="font-size:12px;"
      ></span>
    </div>

    <div
      class="column-selector-actions"
      style="margin-bottom:8px; display:flex; gap:8px; flex-wrap:wrap;"
    >
      <button type="button" data-action="select-all">
        Select all
      </button>

      <button type="button" data-action="select-none">
        Deselect all
      </button>

      <button type="button" data-action="select-default">
        Default
      </button>

      <button type="button" data-action="save-layout">
        Save layout
      </button>

      <button type="button" data-action="discard-layout">
        Discard changes
      </button>
    </div>

    <div class="column-selector-split">
      <div class="column-selector">
        ${columnsHtml}
      </div>

      <div class="column-order-section">
        <div class="column-order-title"
             style="font-weight:700; font-size:11px; letter-spacing:.03em; text-transform:uppercase; opacity:.75; margin:0 0 4px;">
          Column Order
        </div>
        <div class="column-order-list" data-role="column-order">
          ${columnOrderHtml}
        </div>
      </div>
    </div>
  `;

  updateLayoutSelect(container, tableId);
  updateLayoutStatus(container, tableId);
}

export function bindTableColumnSelector({
  tableId,
  containerId,
  allColumnKeys = [],
  onChange,
}) {

  const container = document.getElementById(containerId);

  if (!container || container.dataset.bound === 'true') return;

  container.dataset.bound = 'true';

  container.addEventListener('change', async (event) => {

    const target = event.target;

    if (!(target instanceof HTMLElement)) return;

    // Layout select
    if (
      target instanceof HTMLSelectElement &&
      target.matches('[data-role="layout-select"]')
    ) {

      const layoutName = target.value;

      setActiveLayout(tableId, layoutName);

      applySelection(
        container,
        getVisibleColumns(tableId) || []
      );

      updateLayoutStatus(container, tableId);

      if (typeof onChange === 'function') {
        onChange();
      }

      return;
    }

    // Checkboxes
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'checkbox') return;

    // Order-erhaltend: bestehende Reihenfolge der weiterhin angehakten Spalten
    // beibehalten, neu angehakte hinten anhaengen. So zerstoert ein Toggle NICHT
    // die per Drag gesetzte Reihenfolge (Gruppen = nur Ein-/Ausblenden).
    const checkedKeys = getSelectedKeys(container);
    const checkedSet = new Set(checkedKeys);
    const currentOrder = getVisibleColumns(tableId) || [];
    const kept = currentOrder.filter((k) => checkedSet.has(k));
    const added = checkedKeys.filter((k) => !currentOrder.includes(k));
    const selected = [...kept, ...added];

    setVisibleColumns(tableId, selected);

    updateLayoutSelect(container, tableId);
    updateLayoutStatus(container, tableId);

    if (typeof onChange === 'function') {
      onChange();
    }
  });

  container.addEventListener('click', async (event) => {

    const target = event.target;

    if (!(target instanceof HTMLElement)) return;

    const actionButton = target.closest('button[data-action]');

    if (!actionButton) return;

    const action = actionButton.dataset.action;

    // Save
    if (action === 'save-layout') {

      // visibleColumns aus dem Store nehmen (traegt die aktuelle Reihenfolge),
      // Fallback auf die Checkbox-Auswahl.
      const selectedKeys = getVisibleColumns(tableId) || getSelectedKeys(container);

      const result = await window.api.tableLayouts.saveOne(
        tableId,
        CUSTOM_LAYOUT_NAME,
        {
          visibleColumns: selectedKeys,
        }
      );

      if (result?.success) {

        markLayoutSaved(tableId, CUSTOM_LAYOUT_NAME);

        updateLayoutSelect(container, tableId);
        updateLayoutStatus(container, tableId);
      }

      return;
    }

    // Discard
    if (action === 'discard-layout') {

      discardTableLayoutChanges(tableId);

      applySelection(
        container,
        getVisibleColumns(tableId) || []
      );

      updateLayoutSelect(container, tableId);
      updateLayoutStatus(container, tableId);

      if (typeof onChange === 'function') {
        onChange();
      }

      return;
    }

    // Default
    if (action === 'select-default') {

      resetVisibleColumns(tableId);

      applySelection(
        container,
        getVisibleColumns(tableId) || []
      );

      updateLayoutSelect(container, tableId);
      updateLayoutStatus(container, tableId);

      if (typeof onChange === 'function') {
        onChange();
      }

      return;
    }

    let selectedKeys = null;

    if (action === 'select-all') {
      // Order-erhaltend: aktuelle Reihenfolge behalten, fehlende hinten anhaengen.
      const current = getVisibleColumns(tableId) || [];
      const addedAll = allColumnKeys.filter((k) => !current.includes(k));
      selectedKeys = [...current, ...addedAll];
    }

    if (action === 'select-none') {
      selectedKeys = [];
    }

    if (!selectedKeys) return;

    applySelection(container, selectedKeys);

    setVisibleColumns(tableId, selectedKeys);

    updateLayoutSelect(container, tableId);
    updateLayoutStatus(container, tableId);

    if (typeof onChange === 'function') {
      onChange();
    }
  });

  // ---- "Column Order": Drag & Drop zum Umsortieren der sichtbaren Spalten ----
  // Delegiert am Container (drag-Events bubbeln), damit es Re-Render uebersteht.
  let orderDragKey = null;

  const clearOrderTargets = () => container
    .querySelectorAll('.column-order-item.col-drop-target')
    .forEach((el) => el.classList.remove('col-drop-target'));

  container.addEventListener('dragstart', (event) => {
    const item = event.target.closest?.('.column-order-item');
    if (!item) return;
    orderDragKey = item.dataset.colKey;
    try {
      event.dataTransfer.effectAllowed = 'move';
      event.dataTransfer.setData('text/plain', orderDragKey);
    } catch {}
    item.classList.add('col-dragging');
  });

  container.addEventListener('dragend', (event) => {
    const item = event.target.closest?.('.column-order-item');
    item?.classList.remove('col-dragging');
    clearOrderTargets();
    orderDragKey = null;
  });

  container.addEventListener('dragover', (event) => {
    const item = event.target.closest?.('.column-order-item');
    if (!item || !orderDragKey) return;
    event.preventDefault();
    try { event.dataTransfer.dropEffect = 'move'; } catch {}
    clearOrderTargets();
    if (item.dataset.colKey !== orderDragKey) item.classList.add('col-drop-target');
  });

  container.addEventListener('drop', (event) => {
    const item = event.target.closest?.('.column-order-item');
    if (!item || !orderDragKey) return;
    event.preventDefault();
    clearOrderTargets();
    const targetKey = item.dataset.colKey;
    const moved = orderDragKey;
    orderDragKey = null;
    if (!moved || moved === targetKey) return;

    const order = [...(getVisibleColumns(tableId) || [])];
    const from = order.indexOf(moved);
    const to = order.indexOf(targetKey);
    if (from < 0 || to < 0) return;
    order.splice(from, 1);
    order.splice(to, 0, moved);

    setVisibleColumns(tableId, order);
    updateLayoutSelect(container, tableId);
    updateLayoutStatus(container, tableId);
    if (typeof onChange === 'function') onChange();
  });
}