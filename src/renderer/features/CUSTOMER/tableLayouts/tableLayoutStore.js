// src/renderer/features/CUSTOMER/tableLayouts/tableLayoutStore.js

'use strict';

const tableLayouts = new Map();
const tableLayoutListeners = new Map();

function cloneArray(value) {
  return Array.isArray(value) ? [...value] : [];
}

function areColumnKeysEqual(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return false;
  if (a.length !== b.length) return false;

  return a.every((value, index) => value === b[index]);
}

function notifyTableLayoutListeners(tableId) {
  const listeners = tableLayoutListeners.get(tableId) || [];

  for (const listener of listeners) {
    try {
      listener();
    } catch (error) {
      console.warn('[tableLayoutStore] listener failed', error);
    }
  }
}

export function subscribeTableLayout(tableId, listener) {
  if (typeof listener !== 'function') return () => {};

  const existing = tableLayoutListeners.get(tableId) || [];
  existing.push(listener);
  tableLayoutListeners.set(tableId, existing);

  return () => {
    const next = (tableLayoutListeners.get(tableId) || [])
      .filter((fn) => fn !== listener);

    tableLayoutListeners.set(tableId, next);
  };
}

// export function ensureTableLayout(tableId, { visibleColumns = [] } = {}) {
//   const defaultColumns = cloneArray(visibleColumns);
//   const existing = tableLayouts.get(tableId);

//   if (!existing) {
//     tableLayouts.set(tableId, {
//       defaultVisibleColumns: defaultColumns,
//       visibleColumns: defaultColumns,
//       savedVisibleColumns: defaultColumns,
//       storedLayouts: {},
//       activeLayoutName: 'default',
//     });

//     return;
//   }

//   existing.defaultVisibleColumns = defaultColumns;

//   const customLayout = existing.storedLayouts?.custom;

//   if (Array.isArray(customLayout?.visibleColumns)) {
//     existing.visibleColumns = cloneArray(customLayout.visibleColumns);
//     existing.savedVisibleColumns = cloneArray(customLayout.visibleColumns);
//     existing.activeLayoutName = 'custom';

//     notifyTableLayoutListeners(tableId);
//     return;
//   }

//   if (
//     !Array.isArray(existing.visibleColumns) ||
//     existing.visibleColumns.length === 0
//   ) {
//     existing.visibleColumns = defaultColumns;
//     existing.savedVisibleColumns = defaultColumns;
//     existing.activeLayoutName = 'default';

//     notifyTableLayoutListeners(tableId);
//   }
// }

export function ensureTableLayout(tableId, { visibleColumns = [] } = {}) {
  const defaultColumns = cloneArray(visibleColumns);
  const existing = tableLayouts.get(tableId);

  if (!existing) {
    tableLayouts.set(tableId, {
      defaultVisibleColumns: defaultColumns,
      visibleColumns: defaultColumns,
      savedVisibleColumns: defaultColumns,
      storedLayouts: {},
      activeLayoutName: 'default',
    });

    return;
  }

  const hadDefaultColumns =
    Array.isArray(existing.defaultVisibleColumns) &&
    existing.defaultVisibleColumns.length > 0;

  existing.defaultVisibleColumns = defaultColumns;

  // Nur beim ersten echten Initialisieren gespeichertes Custom übernehmen.
  // Nicht bei jedem Re-Render, sonst werden Checkbox-Änderungen sofort zurückgesetzt.
  if (!hadDefaultColumns) {
    const customLayout = existing.storedLayouts?.custom;

    if (Array.isArray(customLayout?.visibleColumns)) {
      existing.visibleColumns = cloneArray(customLayout.visibleColumns);
      existing.savedVisibleColumns = cloneArray(customLayout.visibleColumns);
      existing.activeLayoutName = 'custom';

      notifyTableLayoutListeners(tableId);
      return;
    }
  }

  // if (
  //   !Array.isArray(existing.visibleColumns) ||
  //   existing.visibleColumns.length === 0
  // ) {
  //   existing.visibleColumns = defaultColumns;
  //   existing.savedVisibleColumns = defaultColumns;
  //   existing.activeLayoutName = 'default';

  //   notifyTableLayoutListeners(tableId);
  // }

if (!Array.isArray(existing.visibleColumns)) {
  existing.visibleColumns = defaultColumns;
  existing.savedVisibleColumns = defaultColumns;
  existing.activeLayoutName = 'default';

  notifyTableLayoutListeners(tableId);
}

}

export function getVisibleColumns(tableId) {
  return tableLayouts.get(tableId)?.visibleColumns ?? null;
}

export function getActiveLayoutName(tableId) {
  return tableLayouts.get(tableId)?.activeLayoutName ?? 'default';
}

export function getStoredLayout(tableId, layoutName) {
  const existing = tableLayouts.get(tableId);

  if (layoutName === 'default') {
    return {
      visibleColumns: cloneArray(existing?.defaultVisibleColumns),
    };
  }

  return existing?.storedLayouts?.[layoutName] ?? null;
}

export function setActiveLayout(tableId, layoutName) {
  const existing = tableLayouts.get(tableId);
  if (!existing) return;

  if (layoutName === 'default') {
    existing.visibleColumns = cloneArray(existing.defaultVisibleColumns);
    existing.savedVisibleColumns = cloneArray(existing.defaultVisibleColumns);
    existing.activeLayoutName = 'default';

    notifyTableLayoutListeners(tableId);
    return;
  }

  const storedLayout = existing.storedLayouts?.[layoutName];

  if (Array.isArray(storedLayout?.visibleColumns)) {
    existing.visibleColumns = cloneArray(storedLayout.visibleColumns);
    existing.savedVisibleColumns = cloneArray(storedLayout.visibleColumns);
    existing.activeLayoutName = layoutName;

    notifyTableLayoutListeners(tableId);
  }
}

export function setVisibleColumns(tableId, visibleColumns) {
  const nextVisibleColumns = cloneArray(visibleColumns);
  const existing = tableLayouts.get(tableId);

  if (!existing) {
    tableLayouts.set(tableId, {
      defaultVisibleColumns: nextVisibleColumns,
      visibleColumns: nextVisibleColumns,
      savedVisibleColumns: nextVisibleColumns,
      storedLayouts: {},
      activeLayoutName: 'custom',
    });

    notifyTableLayoutListeners(tableId);
    return;
  }

  existing.visibleColumns = nextVisibleColumns;

  if (existing.activeLayoutName === 'default') {
    existing.activeLayoutName = 'custom';
  }

  notifyTableLayoutListeners(tableId);
}

export function resetVisibleColumns(tableId) {
  setActiveLayout(tableId, 'default');
}

export function isTableLayoutDirty(tableId) {
  const existing = tableLayouts.get(tableId);
  if (!existing) return false;

  return !areColumnKeysEqual(
    existing.visibleColumns,
    existing.savedVisibleColumns
  );
}

export function discardTableLayoutChanges(tableId) {
  const existing = tableLayouts.get(tableId);
  if (!existing) return;

  existing.visibleColumns = cloneArray(existing.savedVisibleColumns);

  notifyTableLayoutListeners(tableId);
}

export function markLayoutSaved(tableId, layoutName = 'custom') {
  const existing = tableLayouts.get(tableId);
  if (!existing) return;

  const savedColumns = cloneArray(existing.visibleColumns);

  existing.storedLayouts = {
    ...(existing.storedLayouts || {}),
    [layoutName]: {
      visibleColumns: savedColumns,
    },
  };

  existing.savedVisibleColumns = savedColumns;
  existing.activeLayoutName = layoutName;

  notifyTableLayoutListeners(tableId);
}

export function setStoredLayoutsFromRows(rows) {
  if (!Array.isArray(rows)) return;

  rows.forEach((row) => {
    const tableId = row?.table_id;
    const layoutName = row?.layout_name;
    const rawLayoutJson = row?.layout_json;

    if (!tableId || !layoutName || !rawLayoutJson) return;

    let parsedLayout = null;

    try {
      parsedLayout = JSON.parse(rawLayoutJson);
    } catch (error) {
      console.warn('[tableLayoutStore] invalid layout_json', {
        tableId,
        layoutName,
        error,
      });

      return;
    }

    if (!Array.isArray(parsedLayout?.visibleColumns)) return;

    const existing = tableLayouts.get(tableId);

    if (!existing) {
      const visibleColumns =
        layoutName === 'custom'
          ? cloneArray(parsedLayout.visibleColumns)
          : [];

      tableLayouts.set(tableId, {
        defaultVisibleColumns: [],
        visibleColumns,
        savedVisibleColumns: visibleColumns,
        storedLayouts: {
          [layoutName]: parsedLayout,
        },
        activeLayoutName:
          layoutName === 'custom'
            ? 'custom'
            : 'default',
      });

      notifyTableLayoutListeners(tableId);
      return;
    }

    existing.storedLayouts = {
      ...(existing.storedLayouts || {}),
      [layoutName]: parsedLayout,
    };

    if (layoutName === 'custom') {
      existing.visibleColumns = cloneArray(parsedLayout.visibleColumns);
      existing.savedVisibleColumns = cloneArray(parsedLayout.visibleColumns);
      existing.activeLayoutName = 'custom';

      notifyTableLayoutListeners(tableId);
    }
  });
}