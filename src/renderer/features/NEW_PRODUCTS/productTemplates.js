export const PRODUCT_TEMPLATES = {
  FIXED_BOND: {
    label: 'Simple Fixed Bond',
    couponType: 'FIX',
    uiMode: 'FIX',

    fields: [
      'INCLUDE',
      'PROD_ID',
      'DESCRIPTION',
      'ISSUER',
      'TICKER',
      'RANK',
      'RATING_PROD',

      'START_DATE',
      'MATURITY',

      'COUPON',
      'TENOR',

      'DAY_COUNT',
      'CALENDAR',
      'BUSINESS_DAY_CONVENTION',
      'SETTLEMENT_DAYS',

      'SCHEDULE',
      'FINLIB',
      'MODEL',
      'METHODE',
      'CS_Szenario',
    ],

    sections: {
      GENERAL: [
        'INCLUDE',
        'PROD_ID',
        'DESCRIPTION',
        'ISSUER',
        'TICKER',
        'RANK',
        'RATING_PROD',
      ],

      DATES: [
        'START_DATE',
        'MATURITY',
      ],

      FIXED_COUPON: [
        'COUPON',
        'TENOR',
      ],

      CONVENTIONS: [
        'DAY_COUNT',
        'CALENDAR',
        'BUSINESS_DAY_CONVENTION',
        'SETTLEMENT_DAYS',
      ],

      PRICING: [
        'SCHEDULE',
        'FINLIB',
        'MODEL',
        'METHODE',
        'CS_Szenario',
      ],
    },
  },

  FRN: {
    label: 'Simple FRN',
    couponType: 'FLOATER',
    uiMode: 'FLOATER',

    fields: [
      'INCLUDE',
      'PROD_ID',
      'DESCRIPTION',
      'ISSUER',
      'TICKER',
      'RANK',
      'RATING_PROD',

      'START_DATE',
      'MATURITY',

      'REFERENCE_INDEX',
      'INDEX_TENOR',
      'RESET_TENOR',
      'PAYMENT_TENOR',

      'GEARING',
      'SPREADS',
      'CAP',
      'FLOOR',

      'SCHEDULE',
      'FINLIB',
      'MODEL',
      'METHODE',
      'CS_Szenario',
    ],

    sections: {
      GENERAL: [
        'INCLUDE',
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
        'PAYMENT_TENOR',
      ],

      COUPON_MECHANICS: [
        'GEARING',
        'SPREADS',
        'CAP',
        'FLOOR',
      ],

      PRICING: [
        'SCHEDULE',
        'FINLIB',
        'MODEL',
        'METHODE',
        'CS_Szenario',
      ],
    },
  },

  COMPLEX_BOND: {
    label: 'Complex Bond',
    couponType: 'CUSTOM',
    uiMode: 'CUSTOM',

    fields: [
      'INCLUDE',
      'PROD_ID',
      'DESCRIPTION',
      'ISSUER',
      'TICKER',
      'RANK',
      'RATING_PROD',

      'START_DATE',
      'MATURITY',

      'SCHEDULE',

      'FINLIB',
      'MODEL',
      'METHODE',
      'CS_Szenario',
    ],

    sections: {
      GENERAL: [
        'INCLUDE',
        'PROD_ID',
        'DESCRIPTION',
        'ISSUER',
        'TICKER',
        'RANK',
        'RATING_PROD',
      ],

      DATES: [
        'START_DATE',
        'MATURITY',
      ],

      SCHEDULE_BUILDER: [
        'SCHEDULE',
      ],

      PRICING: [
        'FINLIB',
        'MODEL',
        'METHODE',
        'CS_Szenario',
      ],
    },
  },
};


export function getTemplateFieldSection(templateName, fieldName) {
  const template = PRODUCT_TEMPLATES[templateName];

  if (!template?.sections) return null;

  for (const [sectionName, fields] of Object.entries(template.sections)) {
    if (fields.includes(fieldName)) {
      return sectionName;
    }
  }

  return null;
}