'use strict';

import { PRODUCT_TEMPLATES } from './productTemplates.js';

export function isProductTableName(tableName) {
  return (
    tableName === 'v_PRODUCTS_APP' ||
    tableName === 'v_PRODUCTS_CANONICAL' ||
    tableName === 'PRODUCTS_MASTER'
  );
}

export function resolveProductTemplateName(data = {}) {
  const explicitTemplate =
    data.__PRODUCT_TEMPLATE_SELECTOR__ ||
    data.__PRODUCT_TEMPLATE__ ||
    '';

  if (explicitTemplate && PRODUCT_TEMPLATES[explicitTemplate]) {
    return explicitTemplate;
  }

  const couponType = String(data.CouponType || '').trim().toUpperCase();

  if (couponType === 'FIX') return 'FIXED_BOND';
  if (couponType === 'FLOATER' || couponType === 'FRN') return 'FRN';
  if (couponType === 'CUSTOM') return 'COMPLEX_BOND';

  return 'COMPLEX_BOND';
}

export function applyProductTemplateDefaults(data = {}, tableName) {
  if (!isProductTableName(tableName)) {
    return data;
  }

  const templateName = resolveProductTemplateName(data);
  const template = PRODUCT_TEMPLATES[templateName];

  if (!template) {
    return data;
  }

  const todayIso = new Date().toISOString().slice(0, 10);

  const merged = {
    ...(template.defaults || {}),
    ...data,

    __PRODUCT_TEMPLATE__: templateName,
    __UI_MODE__: template.uiMode || data.__UI_MODE__ || '',
  };

  delete merged.__PRODUCT_TEMPLATE_SELECTOR__;

  // --------------------------------------------------
  // Product identity / naming
  // --------------------------------------------------

  const prodId =
    merged.PROD_ID ||
    merged.prod_id ||
    merged.product_id ||
    '';

  if (!merged.PROD_ID || String(merged.PROD_ID).trim() === '') {
    merged.PROD_ID = prodId;
  }

  if (!merged.prod_id || String(merged.prod_id).trim() === '') {
    merged.prod_id = prodId;
  }

  if (!merged.product_name || String(merged.product_name).trim() === '') {
    merged.product_name =
      merged.DESCRIPTION ||
      merged.description ||
      prodId;
  }

  if (!merged.DESCRIPTION || String(merged.DESCRIPTION).trim() === '') {
    merged.DESCRIPTION = merged.product_name;
  }

  // --------------------------------------------------
  // Seniority / rank
  // --------------------------------------------------

  if (!merged.seniority || String(merged.seniority).trim() === '') {
    merged.seniority =
      merged.RANK ||
      merged.rank ||
      'senior_unsecured';
  }

  if (!merged.RANK || String(merged.RANK).trim() === '') {
    merged.RANK = merged.seniority;
  }

  // --------------------------------------------------
  // Dates required by PRODUCTS_MASTER
  // --------------------------------------------------

  if (!merged.START_DATE || String(merged.START_DATE).trim() === '') {
    merged.START_DATE = todayIso;
  }

  if (!merged.issue_date || String(merged.issue_date).trim() === '') {
    merged.issue_date = merged.START_DATE;
  }

  if (!merged.MATURITY || String(merged.MATURITY).trim() === '') {
    // Safe temporary default: 10Y after issue date.
    const d = new Date(merged.START_DATE);
    d.setFullYear(d.getFullYear() + 10);
    merged.MATURITY = d.toISOString().slice(0, 10);
  }

  if (!merged.maturity_date || String(merged.maturity_date).trim() === '') {
    merged.maturity_date = merged.MATURITY;
  }

  // --------------------------------------------------
  // Common master/canonical fields
  // --------------------------------------------------

  if (!merged.CCY || String(merged.CCY).trim() === '') {
    merged.CCY = 'EUR';
  }

  if (!merged.currency || String(merged.currency).trim() === '') {
    merged.currency = merged.CCY;
  }

  if (!merged.notional || String(merged.notional).trim() === '') {
    merged.notional = 100;
  }

  return merged;
}