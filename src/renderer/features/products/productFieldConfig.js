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

  // Optional legacy / alias field.
  // FRN_PAYMENT_FREQ is the canonical simple-FRN frequency field.
  PAYMENT_TENOR: {
    type: 'select',
    options: ['1M', '3M', '6M', '12M'],
    defaultValueFrom: 'INDEX_TENOR',
    defaultValue: '6M',
  },

  FRN_PAYMENT_FREQ: {
    type: 'select',
    options: ['1', '2', '4', '12'],
    defaultValue: '2',
  },

  GEARING: {
    type: 'number',
    defaultValue: 1,
  },

  SPREADS: {
    type: 'number',
    defaultValue: 0,
  },

  CAP: {
    type: 'text',
    defaultValue: '',
    placeholder: 'z.B. 0.06 für 6%',
  },

  FLOOR: {
    type: 'text',
    defaultValue: '',
    placeholder: 'z.B. 0.02 für 2%',
  },

  DAY_COUNT: {
    type: 'select',
    defaultValue: 'Actual/360',
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
    defaultValue: 'Modified Following',
    options: [
      'Unadjusted',
      'Following',
      'Modified Following',
      'Preceding',
    ],
  },

  SETTLEMENT_DAYS: {
    type: 'number',
    defaultValue: 2,
  },
};


function isProductTableName(tableName) {
  return (
    tableName === 'v_PRODUCTS_APP' ||
    tableName === 'v_PRODUCTS_CANONICAL' ||
    tableName === 'PRODUCTS_MASTER'
  );
}

export function getFieldConfig(tableName, fieldName) {
  if (!isProductTableName(tableName)) return null;

  return PRODUCT_FIELD_CONFIG[fieldName] || null;
}