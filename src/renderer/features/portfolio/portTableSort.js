// src/renderer/features/SELECT_PORTFOLIO/portTableSort.js

const DEFAULT_SORT_STATE = {
  column: null,
  direction: 'asc',
};

let portSortState = { ...DEFAULT_SORT_STATE };

export function getPortSortState() {
  return { ...portSortState };
}

export function resetPortSortState() {
  portSortState = { ...DEFAULT_SORT_STATE };
}

export function sortPortData(rows) {
  if (!Array.isArray(rows)) return [];
  if (!portSortState.column) return rows;

  const { column, direction } = portSortState;
  const factor = direction === 'desc' ? -1 : 1;

  return [...rows].sort((a, b) => {
    const av = normalizeSortValue(a?.[column]);
    const bv = normalizeSortValue(b?.[column]);

    if (av < bv) return -1 * factor;
    if (av > bv) return 1 * factor;
    return 0;
  });
}

export function attachPortSortHandlers({
  container,
  currentData,
  visibleColumns,
  render,
}) {
  if (!container) return;
  if (!Array.isArray(visibleColumns)) return;
  if (typeof render !== 'function') return;

  const headers = container.querySelectorAll('thead th.table-header');

  headers.forEach((header, columnIndex) => {
    const columnKey = visibleColumns[columnIndex];
    if (!columnKey) return;

    header.style.cursor = 'pointer';

    const baseLabel = header.textContent.trim().replace(/\s*[▲▼]$/, '');

    if (portSortState.column === columnKey) {
      header.textContent = `${baseLabel} ${portSortState.direction === 'asc' ? '▲' : '▼'}`;
    } else {
      header.textContent = baseLabel;
    }

    header.title = `${baseLabel} - click to sort`;

    header.addEventListener('click', () => {
      updatePortSortState(columnKey);

      render(currentData);
    });
  });
}

function updatePortSortState(columnKey) {
  if (portSortState.column === columnKey) {
    portSortState = {
      column: columnKey,
      direction: portSortState.direction === 'asc' ? 'desc' : 'asc',
    };
    return;
  }

  portSortState = {
    column: columnKey,
    direction: 'asc',
  };
}

function normalizeSortValue(value) {
  if (value == null) return '';

  const raw = String(value).trim();

  if (raw === '') return '';

  const numeric = Number(
    raw
      .replace(/\s/g, '')
      .replace('%', '')
      .replace(',', '.')
  );

  if (Number.isFinite(numeric)) {
    return numeric;
  }

  const time = Date.parse(raw);
  if (!Number.isNaN(time)) {
    return time;
  }

  return raw.toLowerCase();
}