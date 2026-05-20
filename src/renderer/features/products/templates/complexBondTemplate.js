export const COMPLEX_BOND_TEMPLATE = {
  label: 'Complex Bond',
  couponType: 'CUSTOM',
  uiMode: 'STRUCTURE',
  launchMode: 'STRUCTURE_TIMELINE',

  defaults: {
    CouponType: 'CUSTOM',
    COUPON_FREQ: '1',
    SCHEDULE: '1',
    FINLIB: 'vxp',
    MODEL: 'LMM_vxp',
    METHODE: 'tree_structure',

    CCY: 'EUR',
    RANK: 'senior_unsecured',
    seniority: 'senior_unsecured',
    START_DATE: '',
    MATURITY: '',
    product_name: '',

    DAY_COUNT: 'Actual/360',
    CALENDAR: 'TARGET',
    BUSINESS_DAY_CONVENTION: 'Modified Following',
    SETTLEMENT_DAYS: '2',
  },

  drawers: {
    PRODUCT_SETUP: {
      label: 'Product Setup',
      fields: [
        'PROD_ID',
        'DESCRIPTION',
        'ISSUER',
        'TICKER',
        'RANK',
        'RATING_PROD',
        'CCY',
        // 'START_DATE',
        // 'MATURITY',
      ],
    },

    MODEL_SETUP: {
      label: 'Model & Pricing',
      fields: [
        'FINLIB',
        'MODEL',
        'METHODE',
      ],
    },

    CONVENTIONS: {
      label: 'Conventions',
      fields: [
        'DAY_COUNT',
        'CALENDAR',
        'BUSINESS_DAY_CONVENTION',
        'SETTLEMENT_DAYS',
      ],
    },

    SCENARIO_SETUP: {
      label: 'Scenario & Market Data',
      fields: [
        'CS_Szenario',
      ],
    },

  },

  fields: [
    'PROD_ID',
  ],

  sections: {
    GENERAL: [
      'PROD_ID',
    ],
  },
};