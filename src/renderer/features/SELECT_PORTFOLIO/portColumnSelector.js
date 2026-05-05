// src/renderer/features/SELECT_PORTFOLIO/portColumnSelector.js

import {
  SELECTABLE_PORT_COLUMNS,
  SELECTABLE_PORT_COLUMN_KEYS,
  DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
} from './portTableColumns.js';

const TABLE_ID = 'portTable0';
const DEFAULT_LAYOUT_NAME = 'default';
const CUSTOM_LAYOUT_NAME = 'custom';

function getLayoutSelect(container) {
  return container.querySelector('[data-role="layout-select"]');
}

function getLayoutStatusElement(container) {
  return container.querySelector('[data-role="layout-status"]');
}

function getCurrentLayoutName(container) {
  return container.dataset.currentLayoutName || CUSTOM_LAYOUT_NAME;
}

function setCurrentLayoutName(container, layoutName) {
  container.dataset.currentLayoutName = layoutName;
}

function setSavedColumnsSnapshot(container, columnKeys) {
  container.dataset.savedColumnsSnapshot = JSON.stringify(columnKeys || []);
}

function getSavedColumnsSnapshot(container) {
  try {
    const raw = container.dataset.savedColumnsSnapshot;
    if (!raw) return [...DEFAULT_VISIBLE_PORT_COLUMN_KEYS];

    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [...DEFAULT_VISIBLE_PORT_COLUMN_KEYS];
  } catch {
    return [...DEFAULT_VISIBLE_PORT_COLUMN_KEYS];
  }
}

function getSelectedKeys(container) {
  return Array.from(
    container.querySelectorAll('input[type="checkbox"]:checked')
  ).map((el) => el.value);
}

function areColumnKeysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  return a.every((value, index) => value === b[index]);
}

async function persistTableLayout(layoutName, columnKeys) {
  try {
    await window.api.tableLayouts.saveOne(TABLE_ID, layoutName, {
      visibleColumns: columnKeys,
    });
  } catch (error) {
    console.error('[PORT COLUMN SELECTOR] Failed to save table layout:', error);
  }
}

async function loadTableLayout(layoutName) {
  if (layoutName === DEFAULT_LAYOUT_NAME) {
    return {
      visibleColumns: [...DEFAULT_VISIBLE_PORT_COLUMN_KEYS],
    };
  }

  try {
    const savedLayout = await window.api.tableLayouts.getOne(TABLE_ID, layoutName);

    if (savedLayout?.visibleColumns && Array.isArray(savedLayout.visibleColumns)) {
      return savedLayout;
    }

    return {
      visibleColumns: [...DEFAULT_VISIBLE_PORT_COLUMN_KEYS],
    };
  } catch (error) {
    console.error('[PORT COLUMN SELECTOR] Failed to load table layout:', error);

    return {
      visibleColumns: [...DEFAULT_VISIBLE_PORT_COLUMN_KEYS],
    };
  }
}

function applySelection(container, columnKeys) {
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    checkbox.checked = columnKeys.includes(checkbox.value);
  });
}

function updateLayoutSelectUI(container, layoutName) {
  const layoutSelect = getLayoutSelect(container);
  if (!layoutSelect) return;

  layoutSelect.value = layoutName;
}

function updateLayoutStatusUI(container, { dirty }) {
  const statusElement = getLayoutStatusElement(container);
  if (!statusElement) return;

  if (dirty) {
    statusElement.textContent = 'Ungespeicherte Änderungen';
    statusElement.style.color = '#b45309';
    return;
  }

  statusElement.textContent = 'Gespeichert';
  statusElement.style.color = '#166534';
}

function refreshLayoutDirtyState(container) {
  const currentSelectedKeys = getSelectedKeys(container);
  const savedVisibleColumns = getSavedColumnsSnapshot(container);

  const dirty = !areColumnKeysEqual(currentSelectedKeys, savedVisibleColumns);

  updateLayoutStatusUI(container, { dirty });
}

async function applyLayoutToUIAndState({ container, appState, layoutName, onChange }) {
  const layout = await loadTableLayout(layoutName);
  const visibleColumns = Array.isArray(layout?.visibleColumns)
    ? layout.visibleColumns
    : [...DEFAULT_VISIBLE_PORT_COLUMN_KEYS];

  applySelection(container, visibleColumns);
  appState.setVisibleColumns(TABLE_ID, visibleColumns);
  setCurrentLayoutName(container, layoutName);
  setSavedColumnsSnapshot(container, visibleColumns);
  updateLayoutSelectUI(container, layoutName);
  updateLayoutStatusUI(container, { dirty: false });

  if (typeof onChange === 'function') {
    onChange();
  }
}

export function renderPortColumnSelector(appState, containerId = 'portColumnSelector') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const selected =
    appState.getVisibleColumns(TABLE_ID) ||
    DEFAULT_VISIBLE_PORT_COLUMN_KEYS;

  const currentLayoutName = getCurrentLayoutName(container);

  container.innerHTML = `
  <div class="column-selector-layout" style="margin-bottom:8px; display:flex; gap:8px; align-items:center; flex-wrap:wrap;">
    <label for="portLayoutSelect" style="font-weight:600;">Layout</label>
    <select id="portLayoutSelect" data-role="layout-select">
      <option value="${DEFAULT_LAYOUT_NAME}">Default</option>
      <option value="${CUSTOM_LAYOUT_NAME}">Custom</option>
    </select>
    <span data-role="layout-status" style="font-size:12px;"></span>
  </div>

  <div class="column-selector-actions" style="margin-bottom:8px; display:flex; gap:8px; flex-wrap:wrap;">
    <button type="button" data-action="select-all">Alle auswählen</button>
    <button type="button" data-action="select-none">Alle abwählen</button>
    <button type="button" data-action="select-default">Standard</button>
    <button type="button" data-action="save-layout">Layout speichern</button>
    <button type="button" data-action="discard-layout">Änderungen verwerfen</button>
  </div>

  <div class="column-selector">
    ${SELECTABLE_PORT_COLUMNS.map((col) => `
      <label class="column-selector-item" style="display:inline-flex; align-items:center; gap:6px; margin:4px 10px 4px 0;">
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

  updateLayoutSelectUI(container, currentLayoutName);
  updateLayoutStatusUI(container, { dirty: false });
  // refreshLayoutDirtyState(container);
}

export function bindPortColumnSelector(appState, onChange, containerId = 'portColumnSelector') {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.bound === 'true') return;

  // container.dataset.bound = 'true';
  // setCurrentLayoutName(container, CUSTOM_LAYOUT_NAME);
  // setSavedColumnsSnapshot(container, appState.getVisibleColumns(TABLE_ID) || DEFAULT_VISIBLE_PORT_COLUMN_KEYS);

  container.dataset.bound = 'true';
  setCurrentLayoutName(container, CUSTOM_LAYOUT_NAME);
  setSavedColumnsSnapshot(
  container,
  appState.getVisibleColumns(TABLE_ID) || DEFAULT_VISIBLE_PORT_COLUMN_KEYS
  );
  updateLayoutStatusUI(container, { dirty: false });
  refreshLayoutDirtyState(container);

  container.addEventListener('change', async (event) => {
    const target = event.target;

    if (!(target instanceof HTMLElement)) return;

    // Layout selection
    if (target instanceof HTMLSelectElement && target.matches('[data-role="layout-select"]')) {
      const layoutName = target.value;

      await applyLayoutToUIAndState({
        container,
        appState,
        layoutName,
        onChange,
      });

      return;
    }

    // Checkbox change
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'checkbox') return;

    const selected = getSelectedKeys(container);
    appState.setVisibleColumns(TABLE_ID, selected);

    if (typeof onChange === 'function') {
      onChange();
    }

    refreshLayoutDirtyState(container);
  });

  container.addEventListener('click', async (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionButton = target.closest('button[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;

    // Save current working state explicitly
    if (action === 'save-layout') {
      let currentLayoutName = getCurrentLayoutName(container);

      // Default nicht überschreiben -> beim Speichern auf custom wechseln
      if (currentLayoutName === DEFAULT_LAYOUT_NAME) {
        currentLayoutName = CUSTOM_LAYOUT_NAME;
        setCurrentLayoutName(container, currentLayoutName);
        updateLayoutSelectUI(container, currentLayoutName);
      }

      const selected = getSelectedKeys(container);
      await persistTableLayout(currentLayoutName, selected);
      setSavedColumnsSnapshot(container, selected);
      updateLayoutStatusUI(container, { dirty: false });
      return;
    }

    // Revert to last saved state of current layout
    if (action === 'discard-layout') {
      const currentLayoutName = getCurrentLayoutName(container);

      await applyLayoutToUIAndState({
        container,
        appState,
        layoutName: currentLayoutName,
        onChange,
      });

      return;
    }

    // "Standard" soll wirklich auf das Default-Layout wechseln
    if (action === 'select-default') {
      await applyLayoutToUIAndState({
        container,
        appState,
        layoutName: DEFAULT_LAYOUT_NAME,
        onChange,
      });

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
    appState.setVisibleColumns(TABLE_ID, selectedKeys);

    if (typeof onChange === 'function') {
      onChange();
    }

    refreshLayoutDirtyState(container);
  });
}