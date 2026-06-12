// src/renderer/features/SELECT_PORTFOLIO/portColumnSelector.js

import {
  ALL_PORT_COLUMNS,
  ALL_PORT_COLUMN_KEYS,
  DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
} from './portTableColumns.js';

import {
  renderTableColumnSelector,
  bindTableColumnSelector,
} from '../CUSTOMER/tableLayouts/tableColumnSelector.js';

const TABLE_ID = 'portTable0';

export function renderPortColumnSelector(
  containerId = 'portColumnSelector'
) {
  renderTableColumnSelector({
    tableId: TABLE_ID,
    containerId,
    columns: ALL_PORT_COLUMNS,
    defaultVisibleColumns: DEFAULT_VISIBLE_PORT_COLUMN_KEYS,
  });
}

export function bindPortColumnSelector(
  onChange,
  containerId = 'portColumnSelector'
) {
  bindTableColumnSelector({
    tableId: TABLE_ID,
    containerId,
    allColumnKeys: ALL_PORT_COLUMN_KEYS,
    onChange,
  });
}