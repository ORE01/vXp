import {
  getTableSort,
} from '../../state/tableSortStore.js';

function normalizeValue(value) {
  if (value == null) return '';

  const numeric =
    Number(
      String(value)
        .replace(/,/g, '')
        .replace(/%/g, '')
        .trim()
    );

  if (!Number.isNaN(numeric)) {
    return numeric;
  }

  return String(value).toLowerCase();
}

export function sortRows(
  rows,
  tableId
) {
  const {
    columnKey,
    direction,
  } = getTableSort(tableId);

  if (!columnKey || !direction) {
    return rows;
  }

  const sorted = [...rows];

  sorted.sort((a, b) => {
    const A = normalizeValue(a?.[columnKey]);
    const B = normalizeValue(b?.[columnKey]);

    if (A < B) {
      return direction === 'asc'
        ? -1
        : 1;
    }

    if (A > B) {
      return direction === 'asc'
        ? 1
        : -1;
    }

    return 0;
  });

  return sorted;
}