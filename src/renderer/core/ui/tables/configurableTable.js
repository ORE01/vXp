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

  mapDisplayRows,

  afterRender,

  processDataOptions = {},
}) {
  const tableContainer =
    document.getElementById(tableContainerId);

  if (!tableContainer) return;

  const features = normalizeTableFeatures({
    selectorContainerId,
    defaultVisibleColumns,
    columnLabelMap,
    onLayoutChange,
    columns,
    sorting,
    filtering,
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

  // =====================================
  // Column layout feature
  // =====================================

  let visibleColumns = allColumnKeys;

  if (features.columns.enabled) {
    ensureTableLayout(tableId, {
      visibleColumns:
        features.columns.defaultVisibleColumns?.length
          ? features.columns.defaultVisibleColumns
          : allColumnKeys,
    });

    if (features.columns.selectorContainerId) {
      renderTableColumnSelector({
        tableId,
        containerId: features.columns.selectorContainerId,
        columns: allColumns,
        defaultVisibleColumns:
          features.columns.defaultVisibleColumns?.length
            ? features.columns.defaultVisibleColumns
            : allColumnKeys,
      });

      bindTableColumnSelector({
        tableId,
        containerId: features.columns.selectorContainerId,
        allColumnKeys,
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
    ? storedVisibleColumns
    : (
        features.columns.defaultVisibleColumns?.length
          ? features.columns.defaultVisibleColumns
          : allColumnKeys
      );
  }

  // =====================================
  // Future hooks
  // =====================================

  // filtering.enabled will be applied here later.
  let workingRows = rows;

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
      ? filterColumnsInData(workingRows, visibleColumns)
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
}