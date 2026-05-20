// electron_app/src/renderer/features/products/structureTimeline/structureTimelineData.js

'use strict';

import {
  getProductId,
  getEventDate,
  getEventType,
  getEventPayload,
  getIsActive,
  summarizePayload,
} from './structureTimelineUtils.js';

export function getProductRows() {
  if (typeof window.appState?.getProductsData === 'function') {
    return window.appState.getProductsData();
  }

  if (typeof window.appState?.getProdData === 'function') {
    return window.appState.getProdData();
  }

  const candidates = [
    window.appState?.productsData,
    window.appState?.productData,
    window.appState?.PROD,
    window.appState?.v_PRODUCTS_APP,
    window.appState?.v_PRODUCTS_CANONICAL,
    window.appState?.tables?.v_PRODUCTS_APP,
    window.appState?.tables?.v_PRODUCTS_CANONICAL,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

export function getProductRow(prodId) {
  const rows = getProductRows();

  return rows.find((row) =>
    String(row.PROD_ID || row.product_id || row.prod_id || '') === String(prodId)
  );
}

export function getProductStartDate(product = {}) {
  return (
    product.START_DATE ||
    product.start_date ||
    product.issue_date ||
    product.ISSUE_DATE ||
    ''
  );
}

export function getProductMaturityDate(product = {}) {
  return (
    product.MATURITY ||
    product.maturity ||
    product.maturity_date ||
    product.MATURITY_DATE ||
    ''
  );
}

export function getProductFrequency(product = {}) {
  const raw =
    product.COUPON_FREQ ??
    product.coupon_frequency ??
    product.fixed_coupon_frequency ??
    product.TENOR ??
    product.tenor ??
    1;

  const text = String(raw).trim().toUpperCase();

  if (!text) return 1;

  if (text.endsWith('Y')) {
    const years = Number(text.replace('Y', ''));
    return Number.isFinite(years) && years > 0 ? 1 / years : 1;
  }

  if (text.endsWith('M')) {
    const months = Number(text.replace('M', ''));
    return Number.isFinite(months) && months > 0 ? 12 / months : 1;
  }

  const n = Number(text);
  return Number.isFinite(n) && n > 0 ? n : 1;
}

export function getProductStructureRows() {
  if (typeof window.appState?.getProductStructureData === 'function') {
    return window.appState.getProductStructureData();
  }

  const candidates = [
    window.appState?.productStructureData,
    window.appState?.PRODUCT_STRUCTURE,
    window.appState?.productStructure,
    window.appState?.PRODUCT_STRUCTUREData,
    window.appState?.tables?.PRODUCT_STRUCTURE,
    window.PRODUCT_STRUCTURE,
  ];

  for (const candidate of candidates) {
    if (Array.isArray(candidate)) return candidate;
  }

  return [];
}

export function normalizeRows(rawRows = [], prodId) {
  return rawRows
    .filter((row) => String(getProductId(row)) === String(prodId))
    .map((row, index) => {
      const payload = getEventPayload(row);

      return {
        raw: row,
        index,
        productId: getProductId(row),
        eventDate: getEventDate(row),
        eventType: getEventType(row),
        isActive: getIsActive(row),
        payload,
        payloadSummary: summarizePayload(payload),
        sourceTable: row.source_table || row.SOURCE_TABLE || '',
        sourceRowId:
          row.source_row_id ||
          row.SOURCE_ROW_ID ||
          row.source_id ||
          row.SOURCE_ID ||
          row.structure_id ||
          row.STRUCTURE_ID ||
          '',
      };
    })
    .sort((a, b) => {
      const dateCompare = String(a.eventDate).localeCompare(String(b.eventDate));

      if (dateCompare !== 0) return dateCompare;

      return String(a.eventType).localeCompare(String(b.eventType));
    });
}

export function getCouponRows(rows = []) {
  return rows.filter((r) => {
    const type = String(r.eventType || '').toUpperCase();
    return type === 'FIXED_COUPON' || type === 'COUPON_FIXED';
  });
}

export function groupRowsByDate(rows = []) {
  const map = new Map();

  rows.forEach((row) => {
    const key = String(row.eventDate || '');

    if (!map.has(key)) {
      map.set(key, {
        eventDate: key,
        rows: [],
      });
    }

    map.get(key).rows.push(row);
  });

  return [...map.values()]
    .map((group) => {
      const sortedRows = group.rows.sort((a, b) => {
        const order = {
          COUPON_FIXED: 10,
          FIXED_COUPON: 10,
          COUPON_FLOATING: 15,
          INDEX_RESET: 20,
          CALL: 30,
          PUT: 40,
          REDEMPTION: 90,
        };

        const aType = String(a.eventType || '').toUpperCase();
        const bType = String(b.eventType || '').toUpperCase();

        return (order[aType] || 50) - (order[bType] || 50);
      });

      const types = [...new Set(
        sortedRows.map((r) => String(r.eventType || '').toUpperCase())
      )].filter(Boolean);

      const payloadSummary = sortedRows
        .map((r) => {
          const type = String(r.eventType || '').toUpperCase();
          const summary = r.payloadSummary || '';

          return summary
            ? `${type}: ${summary}`
            : type;
        })
        .join(' · ');

      return {
        eventDate: group.eventDate,
        rows: sortedRows,
        types,
        typeSummary: types.join(' · '),
        payloadSummary,
        isActive: sortedRows.every((r) => r.isActive),
      };
    })
    .sort((a, b) => String(a.eventDate).localeCompare(String(b.eventDate)));
}