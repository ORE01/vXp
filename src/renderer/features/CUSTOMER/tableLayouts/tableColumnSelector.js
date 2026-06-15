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
    statusElement.textContent = 'Ungespeicherte Änderungen';
    statusElement.style.color = '#b45309';
    return;
  }

  statusElement.textContent = 'Gespeichert';
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
}) {

  const container = document.getElementById(containerId);

  if (!container) return;

const storedVisibleColumns = getVisibleColumns(tableId);

const selected =
  Array.isArray(storedVisibleColumns)
    ? storedVisibleColumns
    : defaultVisibleColumns;

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
        Alle auswählen
      </button>

      <button type="button" data-action="select-none">
        Alle abwählen
      </button>

      <button type="button" data-action="select-default">
        Standard
      </button>

      <button type="button" data-action="save-layout">
        Layout speichern
      </button>

      <button type="button" data-action="discard-layout">
        Änderungen verwerfen
      </button>
    </div>

    <div class="column-selector">
      ${columns.map((col) => `
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
        </label>
      `).join('')}
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

    const selected = getSelectedKeys(container);

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

      const selectedKeys = getSelectedKeys(container);

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
      selectedKeys = [...allColumnKeys];
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
}