export const PORTFOLIO_DISPLAY_NAMES = {
  // Portfolio & Instrument
  port_name: 'Portfolio',
  TRADE_ID: 'Trade ID',
  PROD_ID: 'Product ID',
  ISSUER: 'Issuer',
  DESCRIPTION: 'Description',
  TICKER: 'Ticker',
  CATEGORY: 'Category',
  RANK: 'Rank',
  Depotbank: 'Depot Bank',
  INCLUDE: 'Include',

  // Currency & FX
  CCY: 'Currency',
  BASE_CCY: 'Base Currency',
  FX_PAIR: 'FX Pair',
  FX_RATE: 'FX Rate',
  FX_TO_BASE: 'FX to Base',

  // Notional & Valuation
  NOTIONAL: 'Notional',
  NAV: 'NAV',
  clean_price: 'Clean Price',
  NAV_LOCAL: 'NAV (Local)',
  NAV_BASE: 'NAV (Base)',
  PV_LOCAL: 'PV (Local)',
  PV_BASE: 'PV (Base)',
  PRICE_BUY: 'Buy Price',

  // Coupon & Yield
  COUPON: 'Coupon',
  CouponType: 'Coupon Type',
  ytm: 'YTM',
  ytm_BUY: 'YTM Buy',
  ytmPort: 'Portfolio YTM',
  ytmPortA: 'Portfolio YTM Actual',

  // Maturity & Dates
  START_DATE: 'Start Date',
  TRADE_DATE: 'Trade Date',
  MATURITY: 'Maturity',
  MATURITY_YEAR: 'Maturity Year',
  TtM: 'Time to Maturity',

  // Interest Rate Risk
  PV01rel: 'IR Duration',
  PV01: 'PV01',
  PV01_LOCAL: 'PV01 (Local)',
  PV01_BASE: 'PV01 (Base)',

  // Credit Spread
  C_SPREAD: 'Credit Spread',
  C_SPREAD_BASE: 'Base Credit Spread',
  CS_SPREAD_OVERRIDE_BP: 'Credit Spread Override',
  C_SPREAD_DELTA: 'Credit Spread Delta',

  // Credit Spread Risk
  CPV01rel: 'CS Duration',
  CPV01: 'CPV01',
  CPV01_LOCAL: 'CPV01 (Local)',
  CPV01_BASE: 'CPV01 (Base)',

  // Rating
  RATING: 'Rating',
  RATINGres: 'Resolved Rating',
  RATING_PROD: 'Product Rating',
  ratings_numeric: 'Rating (Numeric)',

  // Model & Calculation
  MODEL: 'Model',
  METHODE: 'Method',
  FINLIB: 'Pricing Library',
};

export function applyPortfolioDisplayNames(rows) {
  if (!Array.isArray(rows)) return [];

  return rows.map((row) => {
    const out = {};

    Object.entries(row || {}).forEach(([key, value]) => {
      const displayKey = PORTFOLIO_DISPLAY_NAMES[key] || key;
      out[displayKey] = value;
    });

    return out;
  });
}