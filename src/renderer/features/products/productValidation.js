// src/renderer/features/products/productValidation.js

'use strict';

export function validateProductDates(data = {}) {
  const startRaw = data.START_DATE || data.issue_date || '';
  const maturityRaw = data.MATURITY || data.maturity_date || '';

  if (!startRaw || !maturityRaw) {
    return {
      ok: false,
      message: 'START_DATE and MATURITY are required.',
    };
  }

  const start = new Date(startRaw);
  const maturity = new Date(maturityRaw);

  if (Number.isNaN(start.getTime()) || Number.isNaN(maturity.getTime())) {
    return {
      ok: false,
      message: 'START_DATE or MATURITY is not a valid date.',
    };
  }

  if (maturity <= start) {
    return {
      ok: false,
      message: 'MATURITY must be after START_DATE.',
    };
  }

  return { ok: true, message: '' };
}

export function validateProductBeforeSave(data = {}) {
  const dateValidation = validateProductDates(data);
  if (!dateValidation.ok) return dateValidation;

  return { ok: true, message: '' };
}