'use strict';

const tableSortState = new Map();

export function getTableSort(tableId) {
  return tableSortState.get(tableId) || {
    columnKey: null,
    direction: null,
  };
}

export function setTableSort(
  tableId,
  columnKey,
  direction
) {
  tableSortState.set(tableId, {
    columnKey,
    direction,
  });
}

export function toggleTableSort(
  tableId,
  columnKey
) {
  const current = getTableSort(tableId);

  if (current.columnKey !== columnKey) {
    setTableSort(
      tableId,
      columnKey,
      'asc'
    );

    return;
  }

  if (current.direction === 'asc') {
    setTableSort(
      tableId,
      columnKey,
      'desc'
    );

    return;
  }

  setTableSort(
    tableId,
    null,
    null
  );
}

export function clearTableSort(tableId) {
  setTableSort(
    tableId,
    null,
    null
  );
}