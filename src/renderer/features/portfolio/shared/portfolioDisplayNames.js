export const PORTFOLIO_DISPLAY_NAMES = {
  TRADE_ID: 'Trade ID',
  PROD_ID: 'Product ID',
  DESCRIPTION: 'Description',
  CATEGORY: 'Category',
  COUPON: 'Coupon',
  Depotbank: 'Depot Bank',
  CouponType: 'Coupon Type',
  MATURITY: 'Maturity',
  ISSUER: 'Issuer',
  RANK: 'Rank',
  RATING: 'Rating',
  RATINGres: 'Resolved Rating',

  clean_price: 'Clean Price',
  C_SPREAD: 'Credit Spread',
  C_SPREAD_BASE: 'Base Credit Spread',
  C_SPREAD_DELTA: 'Credit Spread Delta',
  CS_SPREAD_OVERRIDE_BP: 'Credit Spread Override',

  NOTIONAL: 'Notional',
  PRICE_BUY: 'Buy Price',
  NAV: 'NAV',

  PV01rel: 'IR Duration',
  CPV01rel: 'CS Duration',

  ytm_BUY: 'ytm_BUY',
  ytm: 'ytm',
  ytmPort: 'Portfolio YTM',
  ytmPortA: 'Portfolio YTM Actual',

  MATURITY_YEAR: 'Maturity Year',
  TtM: 'Time to Maturity',

  PV01: 'PV01',
  CPV01: 'CPV01',
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