'use strict';

// Make a small "details" table sortable by clicking its column headers, with a
// ▲/▼ direction indicator. Sort value comes from cell.dataset.sortValue when
// present (robust against de-DE formatting like "1.234" / "12,34%"); otherwise
// it falls back to the cell text (locale + numeric aware).
//
// Works for both <thead>/<tbody> tables (processData) and manual tables that
// carry a title row + a header row of <th> in the body.
export function makeSortableDetailsTable(table, { defaultCol = null, defaultColLabel = null, defaultDir = -1 } = {}) {
  if (!table) return;

  const headerRow =
    table.querySelector('thead tr') ||
    Array.from(table.rows).find(r => r.querySelectorAll('th').length > 1);
  if (!headerRow) return;

  const headers = Array.from(headerRow.cells);
  const baseLabels = headers.map(h => h.textContent.replace(/[▲▼]/g, '').trim());

  // Resolve the default sort column from a header label when no index is given.
  if (defaultCol == null && defaultColLabel != null) {
    const idx = baseLabels.indexOf(String(defaultColLabel).trim());
    if (idx >= 0) defaultCol = idx;
  }

  const dataRows = () => {
    const tb = table.querySelector('tbody');
    const all = tb ? Array.from(tb.rows) : Array.from(table.rows);
    return all.slice(all.indexOf(headerRow) + 1); // -1 (header in thead) -> all body rows
  };

  const valOf = (row, i) => {
    const c = row.cells[i];
    if (!c) return { n: NaN, s: '' };
    const dv = c.dataset ? c.dataset.sortValue : undefined;
    if (dv !== undefined && dv !== '') return { n: Number(dv), s: c.textContent };
    let s = String(c.textContent ?? '').replace(/[%\s€]/g, '');
    if (s.includes('.') && s.includes(',')) s = s.replace(/\./g, '').replace(',', '.');
    else if (s.includes(',')) s = s.replace(',', '.');
    return { n: parseFloat(s), s: c.textContent };
  };

  let sortCol = defaultCol;
  let sortDir = defaultDir;

  const apply = () => {
    if (sortCol == null) return;
    const rows = dataRows();
    if (!rows.length) return;

    rows.sort((a, b) => {
      const av = valOf(a, sortCol);
      const bv = valOf(b, sortCol);
      const cmp = (Number.isFinite(av.n) && Number.isFinite(bv.n))
        ? av.n - bv.n
        : String(av.s).localeCompare(String(bv.s), 'de', { numeric: true });
      return cmp * sortDir;
    });

    const parent = rows[0].parentNode;
    rows.forEach(r => parent.appendChild(r));

    headers.forEach((h, i) => {
      h.textContent = baseLabels[i] + (i === sortCol ? (sortDir < 0 ? ' ▼' : ' ▲') : '');
    });
  };

  headers.forEach((h, i) => {
    h.style.cursor = 'pointer';
    h.style.userSelect = 'none';
    if (!h.title) h.title = 'Sortieren';
    h.addEventListener('click', () => {
      if (sortCol === i) sortDir = -sortDir;
      else { sortCol = i; sortDir = -1; }
      apply();
    });
  });

  apply(); // default sort (e.g. value column, largest first)
}

// Post-process a processData()-rendered table (CPV01/Vega details): attach raw
// magnitude sort values to the value + "Weight %" columns (matched by header
// label so it survives any Select/Edit columns), then make it sortable with the
// value column as the default (largest first). rawVals[i] = { value, weight }
// aligned with the tbody rows.
export function wireSortableDetails(wrapper, rawVals, valueLabel) {
  const table = wrapper.querySelector('table');
  if (!table) return;

  const headerCells = Array.from(table.querySelectorAll('thead th'));
  const colOf = (label) => headerCells.findIndex(th => th.textContent.trim() === label);
  const vCol = colOf(valueLabel);
  const wCol = colOf('Weight %');

  const bodyRows = Array.from(table.querySelectorAll('tbody tr'));
  bodyRows.forEach((tr, i) => {
    const rv = rawVals[i];
    if (!rv) return;
    if (vCol >= 0 && tr.cells[vCol]) {
      tr.cells[vCol].dataset.sortValue = String(Math.abs(Number(rv.value)));
    }
    if (wCol >= 0 && tr.cells[wCol]) {
      tr.cells[wCol].dataset.sortValue = String(Math.abs(Number(rv.weight)));
    }
  });

  makeSortableDetailsTable(table, { defaultCol: vCol >= 0 ? vCol : null, defaultDir: -1 });
}
