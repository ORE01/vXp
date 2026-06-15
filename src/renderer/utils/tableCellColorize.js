// src/renderer/utils/tableColorize.js

// ---------- helpers ----------
function toNumber(txt) {
  const cleaned = String(txt).replace(/[^\d,\-+.]/g, '');
  const norm = cleaned.replace(',', '.');
  const n = parseFloat(norm);
  return Number.isFinite(n) ? n : NaN;
}

// ---------- column colorizers ----------
export function colorizeSpreadDelta(container, headerText = 'C_SPREAD_DELTA') {
  const table = container?.querySelector('table');
  if (!table) return;

  const ths = Array.from(table.querySelectorAll('thead th'));
  const colIdx = ths.findIndex(th => th.textContent.trim() === headerText);
  if (colIdx === -1) return;

  table.querySelectorAll('tbody tr').forEach(tr => {
    const td = tr.children[colIdx];
    if (!td) return;

    const val = toNumber(td.textContent);
    td.classList.remove('delta-pos', 'delta-neg', 'delta-zero');

    if (!Number.isFinite(val)) return;
    if (val > 0) td.classList.add('delta-pos');
    else if (val < 0) td.classList.add('delta-neg');
    else td.classList.add('delta-zero');
  });
}

export function applyCleanPriceHighlight(container) {
  if (!container) return;

  const tables = container.querySelectorAll('table');

  tables.forEach(table => {
    const headerCells = Array.from(table.querySelectorAll('thead th'));

    if (!headerCells.length) return;

    const cleanPriceColumnIndex = headerCells.findIndex(th => {
      const label = String(th.textContent || '').trim();

      return (
        label === 'Clean Price' ||
        label === 'clean_price'
      );
    });

    if (cleanPriceColumnIndex < 0) return;

    const headerCell = headerCells[cleanPriceColumnIndex];
    headerCell.classList.add('clean-price-highlight-header');

    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));

    bodyRows.forEach(row => {
      const cells = Array.from(row.children);
      const cell = cells[cleanPriceColumnIndex];

      if (!cell) return;

      cell.classList.add('clean-price-highlight-cell');
    });
  });
}



export function applyCreditSpreadHighlight(container) {
  if (!container) return;

  const tables = container.querySelectorAll('table');

  tables.forEach(table => {
    const headerCells = Array.from(table.querySelectorAll('thead th'));

    if (!headerCells.length) return;

    // Exact match only: must not catch "Base Credit Spread" / "Credit Spread Delta".
    const columnIndex = headerCells.findIndex(th => {
      const label = String(th.textContent || '').trim();

      return (
        label === 'Credit Spread' ||
        label === 'C_SPREAD'
      );
    });

    if (columnIndex < 0) return;

    headerCells[columnIndex].classList.add('credit-spread-highlight-header');

    const bodyRows = Array.from(table.querySelectorAll('tbody tr'));

    bodyRows.forEach(row => {
      const cell = Array.from(row.children)[columnIndex];

      if (!cell) return;

      cell.classList.add('credit-spread-highlight-cell');
    });
  });
}


// ---------- default bundle ----------
export function applyPortfolioTableColoring(container) {
  if (!container) return;

  colorizeSpreadDelta(container);
  applyCleanPriceHighlight(container);
  applyCreditSpreadHighlight(container);
}
