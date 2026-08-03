// electron_app/src/renderer/features/products/structureTimeline/structureTimelineUtils.js

'use strict';

export function safeJsonParse(value) {
  if (!value) return {};

  if (typeof value === 'object') return value;

  try {
    return JSON.parse(value);
  } catch (err) {
    console.warn('[STRUCTURE TIMELINE] payload parse failed', value, err);
    return {};
  }
}

export function toIsoDate(date) {
  if (!(date instanceof Date) || Number.isNaN(date.getTime())) return '';

  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');

  return `${y}-${m}-${d}`;
}

export function addMonthsClamped(date, months) {
  const d = new Date(date.getTime());
  const originalDay = d.getDate();

  d.setMonth(d.getMonth() + months);

  if (d.getDate() !== originalDay) {
    d.setDate(0);
  }

  return d;
}

export function buildBaseTimelineDates(startDateRaw, maturityRaw, frequencyRaw) {
  const startDate = new Date(startDateRaw);
  const maturity = new Date(maturityRaw);

  if (
    Number.isNaN(startDate.getTime()) ||
    Number.isNaN(maturity.getTime()) ||
    maturity <= startDate
  ) {
    return [];
  }

  const frequency = Number(frequencyRaw || 1);

  const monthsPerPeriod =
    frequency > 0
      ? Math.max(1, Math.round(12 / frequency))
      : 12;

  const dates = [];
  let current = addMonthsClamped(startDate, monthsPerPeriod);

  let guard = 0;

  while (current <= maturity && guard < 1000) {
    dates.push(toIsoDate(current));
    current = addMonthsClamped(current, monthsPerPeriod);
    guard += 1;
  }

  const maturityIso = toIsoDate(maturity);

  if (!dates.includes(maturityIso)) {
    dates.push(maturityIso);
  }

  return dates;
}

export function formatNumber(value, digits = 6) {
  if (value === null || value === undefined || value === '') return '';

  const n = Number(value);

  if (!Number.isFinite(n)) return String(value);

  return n.toLocaleString('de-DE', { maximumFractionDigits: digits });
}

export function formatRate(value) {
  if (value === null || value === undefined || value === '') return '';

  const n = Number(value);

  if (!Number.isFinite(n)) return String(value);

  return `${(n * 100).toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}%`;
}

export function getProductId(row = {}) {
  return row.product_id || row.PROD_ID || row.prod_id || '';
}

export function getEventDate(row = {}) {
  return (
    row.structure_date ||
    row.STRUCTURE_DATE ||
    row.event_date ||
    row.EVENT_DATE ||
    row.date ||
    row.DATE ||
    ''
  );
}

export function getEventType(row = {}) {
  return (
    row.structure_type ||
    row.STRUCTURE_TYPE ||
    row.event_type ||
    row.EVENT_TYPE ||
    row.type ||
    row.TYPE ||
    ''
  );
}

export function getEventPayload(row = {}) {
  return safeJsonParse(
    row.structure_payload ||
    row.STRUCTURE_PAYLOAD ||
    row.event_payload ||
    row.EVENT_PAYLOAD ||
    row.payload ||
    row.PAYLOAD ||
    '{}'
  );
}

export function getIsActive(row = {}) {
  const value =
    row.is_active ??
    row.IS_ACTIVE ??
    row.active ??
    row.ACTIVE ??
    1;

  return Number(value) !== 0;
}

export function summarizePayload(payload = {}) {
  const parts = [];

  if (payload.rate !== undefined) {
    parts.push(`Rate ${formatRate(payload.rate)}`);
  }

  if (payload.coupon_rate !== undefined) {
    parts.push(`Coupon ${formatRate(payload.coupon_rate)}`);
  }

  if (payload.notional_factor !== undefined) {
    parts.push(`Notional ${formatNumber(payload.notional_factor)}`);
  }

  if (payload.call_price !== undefined) {
    parts.push(`Call ${formatNumber(payload.call_price)}`);
  }

  if (payload.redemption !== undefined) {
    parts.push(`Redemption ${formatNumber(payload.redemption)}`);
  }

  if (payload.index !== undefined) {
    parts.push(`Index ${payload.index}`);
  }

  if (payload.index_tenor !== undefined) {
    parts.push(`Tenor ${payload.index_tenor}`);
  }

  if (payload.tenor !== undefined) {
    parts.push(`Tenor ${payload.tenor}`);
  }

  if (payload.gearing !== undefined) {
    parts.push(`Gearing ${formatNumber(payload.gearing)}`);
  }

  if (payload.spread !== undefined) {
    parts.push(`Spread ${formatNumber(payload.spread)}`);
  }

  if (payload.cap !== undefined && payload.cap !== null && payload.cap !== '') {
    parts.push(`Cap ${formatRate(payload.cap)}`);
  }

  if (payload.floor !== undefined && payload.floor !== null && payload.floor !== '') {
    parts.push(`Floor ${formatRate(payload.floor)}`);
  }

  return parts.join(' · ');
}