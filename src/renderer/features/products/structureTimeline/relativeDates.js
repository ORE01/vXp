// src/renderer/features/products/structureTimeline/relativeDates.js
//
// Relative Datums-Tokens fuer Produkt-Editoren (Variante a: Token ist die Quelle der
// Wahrheit, wird bei JEDER Nutzung frisch aus "heute" berechnet):
//   START_DATE: "today" | "today+N"   -> heute [+ N Tage]
//   MATURITY  : "Ny"                   -> START_DATE + N Jahre
// Absolute Werte (YYYY-MM-DD / DD.MM.YYYY) bleiben unveraendert.
// Dieselbe Logik existiert server-seitig in FairValue/portfolios/portfolio_instrument_builder.py
// (env VXP_RESOLVE_RELATIVE_DATES), damit auch das Pricing die Tokens aufloest.

'use strict';

// Datum aus LOKALEN Komponenten als ISO (YYYY-MM-DD) formatieren. Wichtig: NICHT
// .toISOString() nutzen – das rechnet nach UTC um und verschiebt lokal-Mitternacht
// bei positiver UTC-Verschiebung (z. B. CEST) auf den Vortag (Off-by-one).
function fmtLocalISO(d) {
  if (!d || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function todayISO() {
  return fmtLocalISO(new Date());
}

export function isStartToken(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'today' || /^today\s*\+\s*\d+$/.test(s);
}

export function isMaturityToken(v) {
  return /^\s*\d+\s*y\s*$/i.test(String(v ?? ''));
}

// Tages-Token fuer TRADE_DATE: "today" | "today+N" | "today-N" (Kalendertage).
// Kein "Ny" (fuer ein Handelsdatum sinnlos).
export function isDayToken(v) {
  const s = String(v ?? '').trim().toLowerCase();
  return s === 'today' || /^today\s*[+-]\s*\d+$/.test(s);
}

// Tages-Token oder absolut -> absolutes ISO-Datum.
export function resolveDayISO(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'today') return todayISO();
  const m = /^today\s*([+-])\s*(\d+)$/.exec(s);
  if (m) {
    const n = Number(m[2]) * (m[1] === '-' ? -1 : 1);
    return addDaysISO(todayISO(), n);
  }
  return normalizeToISO(v);
}

export function isRelativeToken(v) {
  return isStartToken(v) || isMaturityToken(v);
}

function normalizeToISO(v) {
  const raw = String(v ?? '').trim();
  if (!raw) return '';
  if (/^\d{4}-\d{2}-\d{2}/.test(raw)) return raw.slice(0, 10);          // ISO
  const m = /^(\d{2})[.\/](\d{2})[.\/](\d{4})$/.exec(raw);              // DD.MM.YYYY
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  return raw;
}

function addDaysISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  d.setDate(d.getDate() + Number(n || 0));
  return fmtLocalISO(d);
}

function addYearsISO(iso, n) {
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return '';
  const day = d.getDate();
  d.setFullYear(d.getFullYear() + Number(n || 0));
  // 29.02 -> 28.02 in Nicht-Schaltjahren (setFullYear rollt sonst auf 01.03).
  if (d.getDate() !== day) d.setDate(0);
  return fmtLocalISO(d);
}

// START_DATE-Wert (Token oder absolut) -> absolutes ISO-Datum.
export function resolveStartISO(v) {
  const s = String(v ?? '').trim().toLowerCase();
  if (s === 'today') return todayISO();
  const m = /^today\s*\+\s*(\d+)$/.exec(s);
  if (m) return addDaysISO(todayISO(), Number(m[1]));
  return normalizeToISO(v);
}

// MATURITY-Wert (Token "Ny" oder absolut) -> absolutes ISO-Datum. Fuer "Ny" wird der
// (ebenfalls aufgeloeste) START_DATE-Wert als Basis genutzt.
export function resolveMaturityISO(maturityVal, startVal) {
  const m = /^\s*(\d+)\s*y\s*$/i.exec(String(maturityVal ?? ''));
  if (m) {
    const startISO = resolveStartISO(startVal);
    if (!startISO) return '';
    return addYearsISO(startISO, Number(m[1]));
  }
  return normalizeToISO(maturityVal);
}
