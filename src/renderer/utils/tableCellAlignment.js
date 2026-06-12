export function applyTableCellAlignment(container) {
  if (!container) return;

  const numericColumnLabels = new Set([
    'COUPON',
    'Coupon',
    'GEARING',
    'FLOOR',
    'CAP',
    'SPREADS',
    'clean_price',
    'Clean Price',
    'FORWARDS',
    'RATES',
    'EUSWAP',
    'EUSWAP_SZ1',
    'PD',
    'PD_M',
    'PD_M_norm',
    'ytm',
    'ytm_BUY',
    'ytmPort',
    'QUANTIL',
    'Confidence',
    'conf_level',
    'recovery_rate',
    'red_threshold',
    'yellow_threshold',
    'NOTIONAL',
    'Notional',
    'EAD',
    'LGD',
    'LOSS',
    'NAV',
    'PV01',
    'IR Duration',
    'CPV01',
    'CS Duration',
    'PV01rel',
    'CPV01rel',
    'CPV01_EUR',
    'absolute',
    'C_SPREAD',
    'C_SPREAD_BASE',
    'C_SPREAD_DELTA',
    'Credit Spread',
    'Base Credit Spread',
    'Credit Spread Delta',
    'Buy Price',
    'Maturity Year',
  ]);

  const tables = container.querySelectorAll('table');

  tables.forEach(table => {
    const headerCells = Array.from(table.querySelectorAll('thead th'));

    if (!headerCells.length) return;

    headerCells.forEach((th, columnIndex) => {
      const label = String(th.textContent || '').trim();

      if (!numericColumnLabels.has(label)) return;

      th.style.textAlign = 'right';

      const bodyRows = Array.from(table.querySelectorAll('tbody tr'));

      bodyRows.forEach(row => {
        const cells = Array.from(row.children);
        const cell = cells[columnIndex];

        if (!cell) return;

        cell.style.textAlign = 'right';
      });
    });
  });
}