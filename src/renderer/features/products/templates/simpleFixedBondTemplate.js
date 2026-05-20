export const SIMPLE_FIXED_BOND_TEMPLATE = {
  label: 'Simple Fixed Bond',
  couponType: 'FIX',
  uiMode: 'FIX',

  defaults: {
    CouponType: 'FIX',
    COUPON_FREQ: '1',

    // technical defaults — not shown in modal
    SCHEDULE: '',
    FINLIB: 'ql',
    MODEL: 'DCF_ql',
    METHODE: '',

    CCY: 'EUR',
    DAY_COUNT: 'Actual/360',
    CALENDAR: 'TARGET',
    BUSINESS_DAY_CONVENTION: 'Modified Following',
    SETTLEMENT_DAYS: '2',
  },

  fields: [
    'PROD_ID',
    'DESCRIPTION',
    'ISSUER',
    'TICKER',
    'RANK',
    'RATING_PROD',
    'CCY',

    'START_DATE',
    'MATURITY',

    'COUPON',
    'COUPON_FREQ',

    'DAY_COUNT',
    'CALENDAR',
    'BUSINESS_DAY_CONVENTION',
    'SETTLEMENT_DAYS',
  ],

  sections: {
    GENERAL: [
      'PROD_ID',
      'DESCRIPTION',
      'ISSUER',
      'TICKER',
      'RANK',
      'RATING_PROD',
      'CCY',
    ],

    DATES: [
      'START_DATE',
      'MATURITY',
    ],

    FIXED_COUPON: [
      'COUPON',
      'COUPON_FREQ',
    ],

    CONVENTIONS: [
      'DAY_COUNT',
      'CALENDAR',
      'BUSINESS_DAY_CONVENTION',
      'SETTLEMENT_DAYS',
    ],
  },
};