// src/renderer/core/ui/tables/configurableTable.js

import processData, {
  filterColumnsInData,
} from '../modal/modalData.js';

import {
  ensureTableLayout,
  getVisibleColumns,
} from '../../../features/CUSTOMER/tableLayouts/tableLayoutStore.js';

import {
  renderTableColumnSelector,
  bindTableColumnSelector,
} from '../../../features/CUSTOMER/tableLayouts/tableColumnSelector.js';

import { sortRows } from './tableSorting.js';

import {
  renderColumnFilters,
  applyColumnFilters,
  attachHeaderColumnFilters,
} from '../../../features/CUSTOMER/tableLayouts/tableColumnFilters.js';

function createColumnsFromRows(rows = [], columnLabelMap = {}) {
  const firstRow = rows.find(
    (row) => row && typeof row === 'object'
  );

  if (!firstRow) return [];

  return Object.keys(firstRow).map((key) => ({
    key,
    label: columnLabelMap[key] || key,
  }));
}

function normalizeTableFeatures({
  selectorContainerId,
  defaultVisibleColumns = [],
  columnLabelMap = {},
  onLayoutChange,
  columns,
  sorting,
  filtering,
  filterContainerId,
}) {
  return {
    columns: {
      enabled:
        columns?.enabled ??
        Boolean(selectorContainerId),

      selectorContainerId:
        columns?.selectorContainerId ??
        selectorContainerId,

      defaultVisibleColumns:
        columns?.defaultVisibleColumns ??
        defaultVisibleColumns,

      columnLabelMap:
        columns?.columnLabelMap ??
        columnLabelMap,

      onChange:
        columns?.onChange ??
        onLayoutChange,
    },

    sorting: {
      enabled: sorting?.enabled ?? false,
    },

    filtering: {
      enabled: filtering?.enabled ?? false,
      containerId: filtering?.containerId ?? filterContainerId,
      mode: filtering?.mode ?? 'bar', // 'bar' | 'header'
    },
  };
}

export function renderConfigurableTable({
  tableId,
  rows = [],

  tableContainerId,

  selectedTableName,

  // legacy args, still supported
  selectorContainerId,
  defaultVisibleColumns = [],
  columnLabelMap = {},
  onLayoutChange,

  // new feature args
  columns,
  sorting,
  filtering,

  // Optional: separate callback fired only when a VALUE FILTER changes (not on
  // column-visibility changes). Lets a host re-run heavier work (e.g. the whole
  // portfolio analyse pipeline) on filter changes only. Falls back to the
  // column onChange when not provided.
  onFilterChange,

  // container for the dynamic per-column filter bar
  filterContainerId,

  // columns that are always shown first and cannot be toggled
  // (they are not offered in the selector)
  lockedColumns = [],

  mapDisplayRows,

  afterRender,

  processDataOptions = {},
}) {
  const tableContainer =
    document.getElementById(tableContainerId);

console.log('[CONFIG TABLE]', {
  tableId,
  tableContainerId,
  selectorContainerId,
  rowCount: rows?.length,
  firstRow: rows?.[0],
});

  if (!tableContainer) return;

  const features = normalizeTableFeatures({
    selectorContainerId,
    defaultVisibleColumns,
    columnLabelMap,
    onLayoutChange,
    columns,
    sorting,
    filtering,
    filterContainerId,
  });

  const effectiveColumnLabelMap =
    features.columns.columnLabelMap || {};

  // =====================================
  // Column definitions
  // =====================================

  const allColumns = createColumnsFromRows(
    rows,
    effectiveColumnLabelMap
  );

  const allColumnKeys = allColumns.map((col) => col.key);

  // Locked columns: always shown first, never toggleable, never offered in the
  // selector. Order is preserved as given in lockedColumns.
  const lockedKeys = (lockedColumns || []).filter((k) => allColumnKeys.includes(k));

  // Columns the user can actually pick (everything except the locked ones).
  const selectableColumns = allColumns.filter((c) => !lockedKeys.includes(c.key));
  const selectableColumnKeys = selectableColumns.map((c) => c.key);

  // =====================================
  // Column layout feature
  // =====================================

  let visibleColumns = selectableColumnKeys;

  if (features.columns.enabled) {
    const defaultVisible = (
      features.columns.defaultVisibleColumns?.length
        ? features.columns.defaultVisibleColumns
        : selectableColumnKeys
    ).filter((k) => !lockedKeys.includes(k));

    ensureTableLayout(tableId, {
      visibleColumns: defaultVisible,
    });

    if (features.columns.selectorContainerId) {
      renderTableColumnSelector({
        tableId,
        containerId: features.columns.selectorContainerId,
        columns: selectableColumns,
        defaultVisibleColumns: defaultVisible,
      });

      bindTableColumnSelector({
        tableId,
        containerId: features.columns.selectorContainerId,
        allColumnKeys: selectableColumnKeys,
        onChange: () => {
          if (typeof features.columns.onChange === 'function') {
            features.columns.onChange();
          }
        },
      });
    }

    const storedVisibleColumns = getVisibleColumns(tableId);

    visibleColumns =
      Array.isArray(storedVisibleColumns)
        ? storedVisibleColumns.filter((k) => !lockedKeys.includes(k))
        : defaultVisible;
  }

  // Final column order: locked columns first, then the selected ones.
  const orderedColumns = features.columns.enabled
    ? [...lockedKeys, ...visibleColumns.filter((k) => !lockedKeys.includes(k))]
    : allColumnKeys;

  // =====================================
  // Future hooks
  // =====================================

  let workingRows = rows;

  // filtering: one value-filter per visible column, derived from the data.
  // Follows the visible columns automatically (re-rendered on layout change).
  if (features.filtering.enabled) {
    if (features.filtering.mode === 'bar' && features.filtering.containerId) {
      renderColumnFilters({
        tableId,
        containerId: features.filtering.containerId,
        columns: orderedColumns.map((k) => ({
          key: k,
          label: effectiveColumnLabelMap[k] || k,
        })),
        allRows: rows,
        onChange: onFilterChange ?? features.columns.onChange,
      });
    }

    workingRows = applyColumnFilters(workingRows, tableId);
  }

  // sorting
  if (features.sorting.enabled) {
    workingRows = sortRows(
      workingRows,
      tableId
    );
  }


  // =====================================
  // Visible columns
  // =====================================

  const rowsWithVisibleColumns =
    features.columns.enabled
      ? filterColumnsInData(workingRows, orderedColumns)
      : workingRows;

  // =====================================
  // Optional display mapping
  // =====================================

  const displayRows =
    typeof mapDisplayRows === 'function'
      ? mapDisplayRows(rowsWithVisibleColumns)
      : rowsWithVisibleColumns;

  // =====================================
  // Render HTML
  // =====================================

  const html = processData(
    displayRows,
    selectedTableName,
    effectiveColumnLabelMap,
    processDataOptions
  );

  tableContainer.innerHTML = html;

  // =====================================
  // Post render hooks
  // =====================================

  if (typeof afterRender === 'function') {
    afterRender(tableContainer);
  }

  // Header-integrated filters: a funnel button per column header.
  // Added AFTER afterRender so header-label-based helpers (e.g. attachIdLinks,
  // which detects the PROD_ID/TRADE_ID columns by header text) see clean
  // headers first.
  if (features.filtering.enabled && features.filtering.mode === 'header') {
    attachHeaderColumnFilters({
      tableId,
      tableContainer,
      columns: orderedColumns.map((k) => ({
        key: k,
        label: effectiveColumnLabelMap[k] || k,
      })),
      allRows: rows,
      onChange: onFilterChange ?? features.columns.onChange,
    });
  }
}