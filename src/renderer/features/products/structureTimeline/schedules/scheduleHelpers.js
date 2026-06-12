'use strict';

import {
  buildBaseTimelineDates,
} from '../complexTimelineUtils.js';

import {
  getProductRow,
  getProductStartDate,
  getProductMaturityDate,
  getProductFrequency,
} from '../complexTimelineData.js';

export function asFiniteNumber(value, fallback = null) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getExistingRowsByType(rows = [], type) {
  const needle = String(type || '').toUpperCase();

  return rows.filter((r) =>
    String(r.eventType || '').toUpperCase() === needle
  );
}

export function getExistingRowsByTypeAndDate(rows = [], type) {
  const map = new Map();

  getExistingRowsByType(rows, type).forEach((row) => {
    map.set(String(row.eventDate || ''), row);
  });

  return map;
}

export function buildGeneratedCouponDateRows(
  prodId,
  paymentFrequency = null,
  options = {}
) {
  const product = getProductRow(prodId);

  const startDate =
    options.startDate ||
    getProductStartDate(product);

  const maturity =
    options.maturityDate ||
    getProductMaturityDate(product);

  const frequency =
    Number.isFinite(Number(paymentFrequency)) && Number(paymentFrequency) > 0
      ? Number(paymentFrequency)
      : getProductFrequency(product);

  const dates = buildBaseTimelineDates(
    startDate,
    maturity,
    frequency
  );

  return dates.map((date, index) => ({
    productId: prodId,
    eventDate: date,
    eventType: 'COUPON_FLOATING_BASIS',
    isActive: true,
    index,
    payload: {},
    raw: {
      period_number: index + 1,
      PERIOD_NUMBER: index + 1,
    },
  }));
}

export function getPeriodNumber(row, index) {
  return (
    row?.raw?.period_number ||
    row?.raw?.PERIOD_NUMBER ||
    row?.period_number ||
    row?.PERIOD_NUMBER ||
    index + 1
  );
}