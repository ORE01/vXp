export const SIMPLE_FRN_TEMPLATE = {
  label: 'Simple FRN',
  couponType: 'FLOATER',
  uiMode: 'FLOATER',

  defaults: {
    CouponType: 'FLOATER',

    REFERENCE_INDEX: 'EURIBOR',
    INDEX_TENOR: '6M',
    RESET_TENOR: '6M',
    FRN_PAYMENT_FREQ: '2',
    FIXING_LAG_DAYS: '0',

    GEARING: '1',
    SPREADS: '0',
    CAP: '',
    FLOOR: '',

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

    'REFERENCE_INDEX',
    'INDEX_TENOR',
    'FRN_PAYMENT_FREQ',
    'FIXING_LAG_DAYS',

    'SPREADS',
    'CAP',
    'FLOOR',

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

    FRN_SETTINGS: [
      'REFERENCE_INDEX',
      'INDEX_TENOR',
      'RESET_TENOR',
      'FRN_PAYMENT_FREQ',
      'FIXING_LAG_DAYS',
    ],

    COUPON_MECHANICS: [
      'GEARING',
      'SPREADS',
      'CAP',
      'FLOOR',
    ],

    CONVENTIONS: [
      'DAY_COUNT',
      'CALENDAR',
      'BUSINESS_DAY_CONVENTION',
      'SETTLEMENT_DAYS',
    ],
  },
};