'use strict';

function mapIssuerViewRowToIssuerTableRow(row = {}) {
  const baseRating = row.RATING ?? row.BASE_RATING ?? '';

  return {
    INCLUDE: row.INCLUDE ?? 1,
    ISSUER: row.ISSUER ?? '',
    TICKER: row.TICKER ?? '',
    RATING: baseRating,

    // Keep compatibility with current Issuer table.
    // senior_unsecured is the explicit base rank rating.
    senior_secured: row.senior_secured ?? '',
    senior_preferred: row.senior_preferred ?? '',
    senior_unsecured: row.senior_unsecured ?? baseRating,
    senior_subordinated: row.senior_subordinated ?? '',
    junior_subordinated: row.junior_subordinated ?? '',

    Country: row.Country ?? '',
  };
}

function buildIssuerModalRows(rows) {
  return (Array.isArray(rows) ? rows : []).map(mapIssuerViewRowToIssuerTableRow);
}

export {
  mapIssuerViewRowToIssuerTableRow,
  buildIssuerModalRows,
};