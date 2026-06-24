// captureAdapter.js
// ─────────────────────────────────────────────────────────────────────────
// SINGLE source of truth for WHERE the app renders the content the REPORTS
// module captures. The reports aggregate charts/tables that OTHER feature
// modules have already rendered into the live DOM:
//   • ANALYSE ▸ Breakdown   → #panel-breakdown
//   • RISK ▸ Market Risk     → #panel-market   (MVaR summary, market traffic light)
//   • RISK ▸ Credit Risk     → #panel-credit   (CVaR pair, credit traffic lights)
//
// Instead of scattering getElementById('panel-…') across the report builders,
// every cross-module DOM lookup goes through this adapter. If a source module
// renames or moves a panel / traffic-light element, ONLY this file changes —
// the report builders stay untouched. This is the one place where REPORTS is
// (intentionally) coupled to the rest of the app's DOM.
// ─────────────────────────────────────────────────────────────────────────

/** ANALYSE ▸ Breakdown panel — source of the breakdown charts. */
export function getBreakdownPanel() {
  return document.getElementById('panel-breakdown');
}

/** RISK ▸ Market Risk panel — source of the MVaR summary + market traffic light. */
export function getMarketPanel() {
  return document.getElementById('panel-market');
}

/** RISK ▸ Credit Risk panel — source of the CVaR pair + credit traffic lights. */
export function getCreditPanel() {
  return document.getElementById('panel-credit');
}

/**
 * A single traffic-light element by id, e.g. 'traffic-mvar',
 * 'traffic-credit-cvar', 'traffic-credit-tsi', 'traffic-credit-msd'.
 */
export function getTrafficLight(id) {
  return document.getElementById(id);
}

/** True if any CREDIT traffic-light element is present in the DOM. */
export function hasCreditTrafficDom() {
  return typeof document !== 'undefined' && !!(
    document.getElementById('traffic-credit-cvar') ||
    document.getElementById('traffic-credit-tsi')  ||
    document.getElementById('traffic-credit-msd')
  );
}

/** True if the MARKET traffic-light element is present in the DOM. */
export function hasMarketTrafficDom() {
  return typeof document !== 'undefined' && !!document.getElementById('traffic-mvar');
}

/** OFFERS ▸ offers table container — the offers report parses this table. */
export const OFFERS_TABLE_CONTAINER_ID = 'portDataContainer4';

/** Host element of the OFFERS table the offers report reads from. */
export function getOffersTableHost(containerId = OFFERS_TABLE_CONTAINER_ID) {
  return document.getElementById(containerId);
}

/**
 * Generic in-app element lookup by id. Used by the risk PDF export as a
 * last-resort fallback AFTER its scoped `ctx.getById` resolver. The ids here are
 * chart / table-container elements rendered by the source modules (Breakdown /
 * Market / Credit), discovered dynamically while building the report sections —
 * hence no fixed id to centralise, only the act of reaching into the app DOM.
 */
export function getInAppById(id) {
  return document.getElementById(id);
}
