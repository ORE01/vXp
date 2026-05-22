// src/renderer/features/SELECT_PORTFOLIO/portColumnSelector.js

import {
  SELECTABLE_PORT_COLUMNS,
  SELECTABLE_PORT_COLUMN_KEYS,
  DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
} from './portTableColumns.js';

import {
  getVisibleColumns,
  setVisibleColumns,
  resetVisibleColumns,
  getActiveLayoutName,
  setActiveLayout,
  isTableLayoutDirty,
  discardTableLayoutChanges,
  markLayoutSaved,
} from '../CUSTOMER/tableLayouts/tableLayoutStore.js';

const TABLE_ID = 'portTable0';
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

function updateLayoutStatus(container) {
  const statusElement = container.querySelector('[data-role="layout-status"]');

  if (!statusElement) return;

  const dirty = isTableLayoutDirty(TABLE_ID);

  if (dirty) {
    statusElement.textContent = 'Ungespeicherte Änderungen';
    statusElement.style.color = '#b45309';
    return;
  }

  statusElement.textContent = 'Gespeichert';
  statusElement.style.color = '#166534';
}

function updateLayoutSelect(container) {
  const layoutSelect = container.querySelector('[data-role="layout-select"]');

  if (!layoutSelect) return;

  layoutSelect.value = getActiveLayoutName(TABLE_ID);
}

export function renderPortColumnSelector(containerId = 'portColumnSelector') {
  const container = document.getElementById(containerId);

  if (!container) return;

  const selected =
    getVisibleColumns(TABLE_ID) ||
    DEFAULT_VISIBLE_PORT_COLUMN_KEYS;

  container.innerHTML = `
    <div
      class="column-selector-layout"
      style="margin-bottom:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;"
    >
      <label for="portLayoutSelect" style="font-weight:600;">
        Layout
      </label>

      <select id="portLayoutSelect" data-role="layout-select">
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
      ${SELECTABLE_PORT_COLUMNS.map((col) => `
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

  updateLayoutSelect(container);
  updateLayoutStatus(container);
}

export function bindPortColumnSelector(onChange, containerId = 'portColumnSelector') {
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

      setActiveLayout(TABLE_ID, layoutName);

      applySelection(
        container,
        getVisibleColumns(TABLE_ID) || []
      );

      updateLayoutStatus(container);

      if (typeof onChange === 'function') {
        onChange();
      }

      return;
    }

    // Checkboxes
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'checkbox') return;

    const selected = getSelectedKeys(container);

    setVisibleColumns(TABLE_ID, selected);

    updateLayoutSelect(container);
    updateLayoutStatus(container);

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
        TABLE_ID,
        CUSTOM_LAYOUT_NAME,
        {
          visibleColumns: selectedKeys,
        }
      );

      if (result?.success) {
        markLayoutSaved(TABLE_ID, CUSTOM_LAYOUT_NAME);

        updateLayoutSelect(container);
        updateLayoutStatus(container);
      }

      return;
    }

    // Discard
    if (action === 'discard-layout') {
      discardTableLayoutChanges(TABLE_ID);

      applySelection(
        container,
        getVisibleColumns(TABLE_ID) || []
      );

      updateLayoutSelect(container);
      updateLayoutStatus(container);

      if (typeof onChange === 'function') {
        onChange();
      }

      return;
    }

    // Default
    if (action === 'select-default') {
      resetVisibleColumns(TABLE_ID);

      applySelection(
        container,
        getVisibleColumns(TABLE_ID) || []
      );

      updateLayoutSelect(container);
      updateLayoutStatus(container);

      if (typeof onChange === 'function') {
        onChange();
      }

      return;
    }

    let selectedKeys = null;

    if (action === 'select-all') {
      selectedKeys = [...SELECTABLE_PORT_COLUMN_KEYS];
    }

    if (action === 'select-none') {
      selectedKeys = [];
    }

    if (!selectedKeys) return;

    applySelection(container, selectedKeys);

    setVisibleColumns(TABLE_ID, selectedKeys);

    updateLayoutSelect(container);
    updateLayoutStatus(container);

    if (typeof onChange === 'function') {
      onChange();
    }
  });
}