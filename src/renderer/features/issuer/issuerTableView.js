'use strict';

const ISSUER_VISIBLE_COLUMNS = [
  'INCLUDE',
  'ISSUER',
  'TICKER',
  'BASE_RATING',
  'Country',
  'RANK_RATING_COUNT',
  'EXPLICIT_COUNT',
  'GENERATED_COUNT',
  'RATING_STATUS',
];

const ISSUER_COLUMN_LABELS = {
  INCLUDE: 'Include',
  ISSUER: 'Issuer',
  TICKER: 'Ticker',
  BASE_RATING: 'Base Rating',
  Country: 'Country',
  RANK_RATING_COUNT: 'Ranks',
  EXPLICIT_COUNT: 'Explicit',
  GENERATED_COUNT: 'Generated',
  RATING_STATUS: 'Status',
};

function filterIssuerColumnsForDisplay(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    return ISSUER_VISIBLE_COLUMNS.reduce((obj, key) => {
      obj[key] = row?.[key] ?? '';
      return obj;
    }, {});
  });
}

export {
  ISSUER_VISIBLE_COLUMNS,
  ISSUER_COLUMN_LABELS,
  filterIssuerColumnsForDisplay,
};