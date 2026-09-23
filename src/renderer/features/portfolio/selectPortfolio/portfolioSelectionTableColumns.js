// src/renderer/features/SELECT_PORTFOLIO/portTableColumns.js

export const ALL_PORT_COLUMN_KEYS = [
  // Tenor/KRD buckets (1_BASE..30_LOCAL) entfernt: lagen nur als leere
  // Alt-Spalten in der Portfolios-Tabelle; die echten Werte stehen in
  // PortfolioRiskSensitivities (Long-Format).
  'adjusted_rating',
  'BASE_CCY',
  'C_SPREAD',
  'C_SPREAD_BASE',
  'C_SPREAD_DELTA',
  'CATEGORY',
  'CCY',
  'clean_price',
  'COUPON',
  'CouponType',
  'CPV01',
  'CPV01_BASE',
  'CPV01_LOCAL',
  'CPV01rel',
  'CS_SPREAD_OVERRIDE_BP',
  'Depotbank',
  'DESCRIPTION',
  'FINLIB',
  'FX_PAIR',
  'FX_RATE',
  'FX_TO_BASE',
  'INCLUDE',
  'ISSUER',
  'MATURITY',
  'MATURITY_YEAR',
  'METHODE',
  'MODEL',
  'NAV',
  'NAV_BASE',
  'NAV_LOCAL',
  'NOTIONAL',
  'port_name',
  'PRICE_BUY',
  'PROD_ID',
  'PV_BASE',
  'PV_LOCAL',
  'PV01',
  'PV01_BASE',
  'PV01_LOCAL',
  'PV01rel',
  'RANK',
  'RATING',
  'RATING_PROD',
  'RATINGres',
  'ratings_numeric',
  'START_DATE',
  'TICKER',
  'TRADE_DATE',
  'TRADE_ID',
  'TtM',
  'ytm',
  'ytm_BUY',
  'ytmPort',
  'ytmPortA',
];

export const SELECTABLE_PORT_COLUMNS = [
  { key: 'CATEGORY', label: 'Category' },
  { key: 'clean_price', label: 'Current Price' },
  { key: 'COUPON', label: 'Coupon' },
  { key: 'CouponType', label: 'Coupon Type' },
  { key: 'CS_SPREAD_OVERRIDE_BP', label: 'Credit Spread Override' },
  { key: 'Depotbank', label: 'Depot Bank' },
  { key: 'DESCRIPTION', label: 'Description' },
  { key: 'ISSUER', label: 'Issuer' },
  { key: 'MATURITY', label: 'Maturity' },
  { key: 'MATURITY_YEAR', label: 'Maturity Year' },
  { key: 'NAV', label: 'NAV' },
  { key: 'NOTIONAL', label: 'Notional' },
  { key: 'PRICE_BUY', label: 'Buy Price' },
  { key: 'PROD_ID', label: 'ISIN' },
  { key: 'RANK', label: 'Rank' },
  { key: 'RATING', label: 'Issuer Rating' },
  { key: 'RATING_PROD', label: 'Product Rating' },
  { key: 'RATINGres', label: 'Rating' },
  { key: 'START_DATE', label: 'Start Date' },
  { key: 'TICKER', label: 'Ticker' },
  { key: 'TRADE_DATE', label: 'Trade Date' },
  { key: 'TRADE_ID', label: 'Trade ID' },
  { key: 'TtM', label: 'Time to Maturity' },
  { key: 'ytm', label: 'Yield to Maturity' },
  { key: 'ytm_BUY', label: 'YTM Buy' },
];

export const SELECTABLE_PORT_COLUMN_KEYS = SELECTABLE_PORT_COLUMNS.map(col => col.key);

// export const DEFAULT_VISIBLE_PORT_COLUMN_KEYS = [...SELECTABLE_PORT_COLUMN_KEYS];
export const DEFAULT_VISIBLE_PORT_COLUMN_KEYS = [
  // Trade ID + Product ID bleiben (vorerst) fix links (LOCKED) und stehen daher
  // NICHT hier. Clean Price/Credit Spread/Notional/NAV sind jetzt normal waehlbar
  // und per Default sichtbar (in dieser Reihenfolge nach den fixen ID-Spalten).
  // INCLUDE zuerst -> die Ein-/Ausschalt-Checkbox steht gleich vorne (wie in Change Portfolio).
  'INCLUDE',
  'clean_price',
  'C_SPREAD',
  'NOTIONAL',
  'NAV',
  'CATEGORY',
  'Depotbank',
  'ISSUER',
  'MATURITY',
  'RATINGres',
];

// Nur noch die beiden ID-Spalten sind fix links (sticky). Clean Price, Credit Spread,
// Notional und NAV wurden aufgeloest -> normal ein-/ausblendbar und per Drag sortierbar.
export const LOCKED_PORT_COLUMN_KEYS = [
  'TRADE_ID',
  'PROD_ID',
];

export function getPortColumnLabel(columnKey) {
  const column = SELECTABLE_PORT_COLUMNS.find(col => col.key === columnKey);
  return column ? column.label : columnKey;
}

export const ALL_PORT_COLUMNS = ALL_PORT_COLUMN_KEYS.map((key) => ({
  key,
  label: getPortColumnLabel(key),
}));

// Gruppierung der Spalten-Checkboxen im Column-Selector der Portfolio-Tabelle.
// Nur ueber KEYS definiert (Labels kommen aus dem columnLabelMap der Tabelle).
// Spalten, die in keiner Gruppe stehen, landen automatisch in einer "Other"-Sektion.
export const PORT_COLUMN_GROUPS = [
  { title: 'Portfolio & Instrument', keys: ['port_name', 'ISSUER', 'DESCRIPTION', 'TICKER', 'CATEGORY', 'RANK', 'Depotbank', 'INCLUDE'] },
  { title: 'Currency & FX',          keys: ['CCY', 'BASE_CCY', 'FX_PAIR', 'FX_RATE', 'FX_TO_BASE'] },
  { title: 'Notional & Valuation',   keys: ['NOTIONAL', 'NAV', 'clean_price', 'NAV_LOCAL', 'NAV_BASE', 'PV_LOCAL', 'PV_BASE', 'PRICE_BUY'] },
  { title: 'Coupon & Yield',         keys: ['COUPON', 'CouponType', 'ytm', 'ytm_BUY', 'ytmPort', 'ytmPortA'] },
  { title: 'Maturity & Dates',       keys: ['START_DATE', 'TRADE_DATE', 'MATURITY', 'MATURITY_YEAR', 'TtM'] },
  { title: 'Interest Rate Risk',     keys: ['PV01rel', 'PV01', 'PV01_LOCAL', 'PV01_BASE'] },
  { title: 'Credit Spread',          keys: ['C_SPREAD', 'C_SPREAD_BASE', 'CS_SPREAD_OVERRIDE_BP', 'C_SPREAD_DELTA'] },
  { title: 'Credit Spread Risk',     keys: ['CPV01rel', 'CPV01', 'CPV01_LOCAL', 'CPV01_BASE'] },
  { title: 'Rating',                 keys: ['RATING', 'RATINGres', 'RATING_PROD', 'ratings_numeric'] },
  { title: 'Model & Calculation',    keys: ['MODEL', 'METHODE', 'FINLIB'] },
];