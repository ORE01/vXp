// src/renderer/features/SELECT_PORTFOLIO/portColumnSelector.js

import {
  SELECTABLE_PORT_COLUMNS,
  SELECTABLE_PORT_COLUMN_KEYS,
  DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
} from './portTableColumns.js';

const TABLE_ID = 'portTable0';

async function persistTableLayout(columnKeys) {
  try {
    await window.api.tableLayouts.save(TABLE_ID, {
      visibleColumns: columnKeys,
    });
  } catch (error) {
    console.error('[PORT COLUMN SELECTOR] Failed to save table layout:', error);
  }
}

function applySelection(container, columnKeys) {
  const checkboxes = container.querySelectorAll('input[type="checkbox"]');

  checkboxes.forEach((checkbox) => {
    checkbox.checked = columnKeys.includes(checkbox.value);
  });
}

export function renderPortColumnSelector(appState, containerId = 'portColumnSelector') {
  const container = document.getElementById(containerId);
  if (!container) return;

  const selected =
    appState.getVisibleColumns(TABLE_ID) ||
    DEFAULT_VISIBLE_PORT_COLUMN_KEYS;

  container.innerHTML = `
  <div class="column-selector-actions" style="margin-bottom:8px; display:flex; gap:8px; flex-wrap:wrap;">
    <button type="button" data-action="select-all">Alle auswählen</button>
    <button type="button" data-action="select-none">Alle abwählen</button>
    <button type="button" data-action="select-default">Standard</button>
  </div>

  <div class="column-selector">
    ${SELECTABLE_PORT_COLUMNS.map(col => `
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
}

export function bindPortColumnSelector(appState, onChange, containerId = 'portColumnSelector') {
  const container = document.getElementById(containerId);
  if (!container || container.dataset.bound === 'true') return;

  container.dataset.bound = 'true';

  container.addEventListener('click', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    const actionButton = target.closest('button[data-action]');
    if (!actionButton) return;

    const action = actionButton.dataset.action;

    let selectedKeys = null;

    if (action === 'select-all') {
      selectedKeys = [...SELECTABLE_PORT_COLUMN_KEYS];
    }

    if (action === 'select-none') {
      selectedKeys = [];
    }

    if (action === 'select-default') {
      selectedKeys = [...DEFAULT_VISIBLE_PORT_COLUMN_KEYS];
    }

    if (!selectedKeys) return;

    console.log('[PORT COLUMN SELECTOR] bulk action:', {
      action,
      selectedKeys,
    });

    applySelection(container, selectedKeys);
    appState.setVisibleColumns(TABLE_ID, selectedKeys);
    persistTableLayout(selectedKeys);

    if (typeof onChange === 'function') {
      onChange();
    }
  });

  container.addEventListener('change', (event) => {
    const target = event.target;
    if (!(target instanceof HTMLInputElement)) return;
    if (target.type !== 'checkbox') return;

    console.log('[PORT COLUMN SELECTOR] checkbox changed:', {
      value: target.value,
      checked: target.checked,
    });

    const selected = Array.from(
      container.querySelectorAll('input[type="checkbox"]:checked')
    ).map((el) => el.value);

    console.log('[PORT COLUMN SELECTOR] selected after DOM read:', selected);

    appState.setVisibleColumns(TABLE_ID, selected);
    persistTableLayout(selected);

    if (typeof onChange === 'function') {
      onChange();
    }
  });
}