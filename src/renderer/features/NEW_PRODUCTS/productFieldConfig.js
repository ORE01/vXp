export const PRODUCT_FIELD_CONFIG = {
  REFERENCE_INDEX: {
    type: 'select',
    options: ['EURIBOR', 'SOFR', 'SONIA', 'ESTR'],
    defaultValue: 'EURIBOR',
  },

  INDEX_TENOR: {
    type: 'select',
    options: ['1M', '3M', '6M', '12M'],
    defaultValue: '6M',
  },

  RESET_TENOR: {
    type: 'select',
    options: ['1M', '3M', '6M', '12M'],
    defaultValueFrom: 'INDEX_TENOR',
    defaultValue: '6M',
  },

  PAYMENT_TENOR: {
    type: 'select',
    options: ['1M', '3M', '6M', '12M'],
    defaultValueFrom: 'INDEX_TENOR',
    defaultValue: '6M',
  },

  DAY_COUNT: {
    type: 'select',
    defaultValue: 'Actual/Actual ISDA',
    options: [
        'Actual/Actual ISDA',
        'Actual/360',
        'Actual/365 Fixed',
        '30/360',
    ],
    },

    CALENDAR: {
    type: 'select',
    defaultValue: 'TARGET',
    options: [
        'TARGET',
        'NullCalendar',
    ],
    },

    BUSINESS_DAY_CONVENTION: {
    type: 'select',
    defaultValue: 'Unadjusted',
    options: [
        'Unadjusted',
        'Following',
        'Modified Following',
        'Preceding',
    ],
    },

    SETTLEMENT_DAYS: {
    type: 'number',
    defaultValue: 0,
    },
};


export function getFieldConfig(tableName, fieldName) {
  if (tableName !== 'ProdAll') return null;

  return PRODUCT_FIELD_CONFIG[fieldName] || null;
}