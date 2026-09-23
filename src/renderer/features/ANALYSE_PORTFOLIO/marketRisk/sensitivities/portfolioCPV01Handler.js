'use strict';

// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioCPV01Handler.js

import processData from '../../../../core/ui/modal/modalData.js';
import createBarChart from '../../../../charts/BarChart.js';

import { formatNumberWithGrouping } from '../../../../utils/tableCellFormats.js';

import {
  updateMarketRiskSensitivityKpis,
  notionalByCcyFromHoldings,
  navTotalFromHoldings,
  navValuedFromHoldings,
} from './marketRiskSensitivityKpis.js';
import { applyColumnFilters } from '../../../CUSTOMER/tableLayouts/tableColumnFilters.js';
import {
  createContribDrill,
  bindRightClickDrill,
  scheduleHideConcMenu,
} from '../../SummaryBreakdown.js';
import { wireSortableDetails } from './detailsTableSort.js';
import { renderSensHistorySingle } from '../../HISTORIC_RISK_METRICS/historicRiskMetrics.js';

// Table id of the SELECT PORTFOLIO table whose header filters drive the
// analyse sections; mirror it so CPV01 follows the same portfolio filter.
const PORT_TABLE_ID = 'portTable0';

// Right-click drill on the CPV01 bars: bar (CCY + rating bucket) -> products.
const _cpv01DrillCfg = {
  detailId: 'cpv01DrillDetail',
  titleId: 'cpv01DrillDetailTitle',
  tableId: 'cpv01DrillDetailTable',
  closeId: 'cpv01DrillDetailClose',
  menuId: 'cpv01DrillCardMenu',
  valueType: '__CPV01',
  valueLabel: 'CPV01',
  infoCols: [
    { key: 'ISSUER', label: 'Issuer' },
    { key: 'RATINGres', label: 'Rating' },
  ],
};
const cpv01Drill = createContribDrill({ var: _cpv01DrillCfg, es: _cpv01DrillCfg });

// Per-(product, bucket, ccy) contribution rows for the current render.
let _cpv01DrillRows = [];

// Hide/clear the drill detail table + menu (e.g. on portfolio switch / re-render).
function resetCpv01Drill() {
  const d = document.getElementById('cpv01DrillDetail');
  if (d) d.style.display = 'none';
  const t = document.getElementById('cpv01DrillDetailTable');
  if (t) t.innerHTML = '';
  const m = document.getElementById('cpv01DrillCardMenu');
  if (m) m.style.display = 'none';
}

let CPV01Chart;

/**
 * Sets the "Weighted Rating" card (Sensitivities/CPV01 tab) from the CURRENTLY FILTERED
 * holdings, so it follows the header filter. NAV-weighted average rating notch mapped back
 * to a rating label. Two rows: Total NAV (all rated positions) and Valued NAV (only valued,
 * i.e. non-cash, rated positions). The bar shows rating quality (AAA = full, worse = shorter).
 */
function updateCpv01WeightedRatingCard(holdings, fixedCats, ratingOrder) {
  const order = Array.isArray(ratingOrder) ? ratingOrder : [];
  const cats = fixedCats instanceof Set ? fixedCats : new Set(fixedCats || []);
  const norm = (s) => String(s ?? '').trim().toUpperCase();

  let notchNavAll = 0, navAll = 0, notchNavValued = 0, navValued = 0;
  (Array.isArray(holdings) ? holdings : []).forEach((h) => {
    const rt = norm(h.RATINGres ?? h.ratingres ?? h.RATING ?? h.rating);
    const notch = order.findIndex((x) => norm(x) === rt);
    if (notch < 0) return;                        // unrated -> ignore
    const nav = Number(h.NAV ?? h.nav ?? h.NAV_BASE ?? h.nav_base) || 0;
    if (nav <= 0) return;
    notchNavAll += notch * nav; navAll += nav;
    const cat = String(h.CATEGORY ?? h.category ?? '').trim();
    if (!(cat && cats.has(cat))) { notchNavValued += notch * nav; navValued += nav; } // valued = non-cash
  });

  const labelOf = (nw, w) => (w > 0 && order.length)
    ? order[Math.max(0, Math.min(order.length - 1, Math.round(nw / w)))]
    : '–';
  const barOf = (nw, w) => {
    if (!(w > 0) || order.length < 2) return 0;
    const notch = nw / w;                          // 0 = AAA (best)
    return Math.max(0, Math.min(100, (1 - notch / (order.length - 1)) * 100));
  };

  const setRow = (barId, valId, nw, w) => {
    const bar = document.getElementById(barId);
    if (bar) bar.style.width = `${barOf(nw, w)}%`;
    const el = document.getElementById(valId);
    if (el) el.textContent = labelOf(nw, w);
  };
  setRow('sensWRatingTotalBar', 'sensWRatingTotal', notchNavAll, navAll);
  setRow('sensWRatingValuedBar', 'sensWRatingValued', notchNavValued, navValued);

  // Fraktionale Notches (fuer den Chart-Marker "Valued NAV Rating").
  return {
    notchTotal:  navAll > 0 ? notchNavAll / navAll : null,
    notchValued: navValued > 0 ? notchNavValued / navValued : null,
  };
}

/**
 * Sets the "Credit Spread Duration" and "Average Maturity" cards (Sensitivities/CPV01 tab)
 * from the CURRENTLY FILTERED holdings, so both follow the header filter.
 *  - CS Duration = |Σ CPV01| / NAV * 10000 (years), Total NAV vs Valued NAV.
 *  - Average Maturity = NAV-weighted mean TtM over valued (non-cash) holdings, SAME NAV
 *    denominators as the duration -> Total/Valued ratios line up (like the PV01 tab).
 */
function updateCpv01DurationMaturityCards({
  holdings,
  fixedCats,
  navTotal,
  navValued,
  totalCpv01,
} = {}) {
  const cats = fixedCats instanceof Set ? fixedCats : new Set(fixedCats || []);

  const absCpv01 = Math.abs(Number(totalCpv01) || 0);
  const csDurTotal  = navTotal  ? (absCpv01 / navTotal)  * 10000 : null;
  const csDurValued = navValued ? (absCpv01 / navValued) * 10000 : null;

  // WAM numerator: Σ(TtM · NAV) over valued (non-cash) holdings with TtM >= 0.
  let ttmNavValued = 0;
  (Array.isArray(holdings) ? holdings : []).forEach((h) => {
    const cat = String(h.CATEGORY ?? h.category ?? '').trim();
    if (cat && cats.has(cat)) return;
    const ttm = Number(h.TtM ?? h.ttm);
    if (!Number.isFinite(ttm) || ttm < 0) return;
    const nav = Number(h.NAV ?? h.nav ?? h.NAV_BASE ?? h.nav_base) || 0;
    ttmNavValued += ttm * nav;
  });
  const wamTotal  = navTotal  ? ttmNavValued / navTotal  : null;
  const wamValued = navValued ? ttmNavValued / navValued : null;

  const csScale  = Math.max(csDurTotal || 0, csDurValued || 0) || 1;
  const wamScale = Math.max(wamTotal || 0, wamValued || 0) || 1;

  const setBar = (barId, valId, v, scale) => {
    const bar = document.getElementById(barId);
    if (bar) bar.style.width = `${Number.isFinite(v) ? Math.max(0, Math.min(100, (v / scale) * 100)) : 0}%`;
    const el = document.getElementById(valId);
    if (el) el.textContent = Number.isFinite(v) ? `${v.toFixed(2).replace('.', ',')}Y` : '–';
  };
  setBar('sensCsDurTotalBar', 'sensCsDurTotal', csDurTotal, csScale);
  setBar('sensCsDurValuedBar', 'sensCsDurValued', csDurValued, csScale);
  setBar('sensCsWamTotalBar', 'sensCsWamTotal', wamTotal, wamScale);
  setBar('sensCsWamValuedBar', 'sensCsWamValued', wamValued, wamScale);
}

function normalizePortfolioName(portName) {
  return String(portName ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

function normalizeRiskType(riskType) {
  return String(riskType ?? '')
    .toUpperCase()
    .trim();
}

function getAvailablePorts(rows = []) {
  return [
    ...new Set(
      rows
        .map(r => normalizePortfolioName(r.PORT_NAME ?? r.port_name))
        .filter(Boolean)
    ),
  ];
}

function getAvailableRiskTypes(rows = []) {
  return [
    ...new Set(
      rows
        .map(r => normalizeRiskType(r.RISK_TYPE ?? r.risk_type))
        .filter(Boolean)
    ),
  ];
}

function normalizeCreditBucket(value) {
  const raw = String(value ?? '').trim();

  if (!raw) return 'UNKNOWN';

  // CS:EUR:A+   -> A+
  // CS:EUR:AA-  -> AA-
  // CS:EUR:BBB+ -> BBB+
  if (raw.includes(':')) {
    const parts = raw.split(':');
    return String(parts[parts.length - 1] ?? raw).trim();
  }

  return raw;
}

const RATINGS_ORDER = [
  'AAA',
  'AA+', 'AA', 'AA-',
  'A+', 'A', 'A-',
  'BBB+', 'BBB', 'BBB-',
  'BB+', 'BB', 'BB-',
  'B+', 'B', 'B-',
  'CCC+', 'CCC', 'CCC-',
  'CC', 'C', 'D',
];

function sortCreditBuckets(a, b) {
  const ia = RATINGS_ORDER.indexOf(a);
  const ib = RATINGS_ORDER.indexOf(b);

  if (ia !== -1 && ib !== -1) return ia - ib;
  if (ia !== -1) return -1;
  if (ib !== -1) return 1;

  return String(a).localeCompare(String(b));
}

export function handleCSSensData(appState, forcedPortName = null, holdingsOverride = null) {
  if (!appState) {
    console.warn('[CP SENS] skipped render: appState missing');
    return;
  }

  // Reset the drill detail on every (re-)render (avoid stale rows after switch/filter).
  resetCpv01Drill();

  const rawPortName =
    forcedPortName ||
    (
      typeof appState.getSelectedPortTableName === 'function'
        ? appState.getSelectedPortTableName()
        : (
            appState.selectedPortfolio ||
            appState.currentPortfolio ||
            appState.portfolioName ||
            appState.selectedPortName ||
            appState.selectedTableName ||
            null
          )
    );

  const riskRowsAll = appState.getPortfolioRiskSensitivitiesData?.() || [];

  const availablePorts = getAvailablePorts(riskRowsAll);
  const availableRiskTypes = getAvailableRiskTypes(riskRowsAll);

  const selectedPort = normalizePortfolioName(
    rawPortName ||
    (availablePorts.length === 1 ? availablePorts[0] : null)
  );

  if (!selectedPort) {
    console.warn('[CP SENS] skipped render: no selected portfolio yet', {
      rawPortName,
      availablePorts,
    });

    clearCPV01Chart();
    clearCPV01Details();

    return;
  }

  // CPV01-Verlauf (Portfolio-History, bp) unter Graph + Details zeichnen — unabhaengig vom
  // Bar-Chart-Datenpfad (auch bei leeren CPV01-Rows aktualisieren/leeren).
  try {
    const _hist = (appState.getPortfolioHistoryData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === selectedPort);
    renderSensHistorySingle('sensCpv01HistChart', _hist, {
      keys: ['CPV01bp', 'CPV01_BP', 'CPV01_BP_BASIS'],
      label: 'CPV01 (bp)',
      borderColor: 'rgba(54, 162, 235, 1)',
      backgroundColor: 'rgba(54, 162, 235, 0.15)',
    });
  } catch (e) { console.warn('[CP SENS] CPV01 history chart failed', e); }

  // console.log('[CP SENS] selected portfolio resolved', {
  //   rawPortName,
  //   selectedPort,
  //   availablePorts,
  //   storeRows: riskRowsAll.length,
  //   riskTypes: availableRiskTypes,
  // });

  // Authoritative: aggregierte PortfolioRiskSensitivities-Rows (per TRADE_ID, exakt
  // das, was Python gerechnet hat). Diese werden nach den TRADE_IDs der (header-)
  // gefilterten Holdings eingeschraenkt -> der Portfolio-/Header-Filter laeuft genauso
  // durch -, und in calculateCreditSensitivity() nach der RESOLVED-Rating (RATINGres)
  // neu gebucketet.
  // Fallback: Rekonstruktion aus per-Unit-Sensitivitaeten (ProductRiskSensitivities)
  // NUR wenn keine autoritativen Rows verfuegbar sind. Die Rekonstruktion
  // (VALUE_PER_UNIT * NOTIONAL) weicht von den gebuchten Werten ab und darf die
  // autoritativen Zahlen nicht ueberschreiben.
  let calcData = null;

  const productSens = appState.getProductRiskSensitivitiesData?.() || [];
  const holdings = Array.isArray(holdingsOverride)
    ? holdingsOverride
    : applyColumnFilters(appState.getFilteredPortData?.() || [], PORT_TABLE_ID);

  // TRADE_IDs of the filtered holdings — narrows the authoritative PRS rows so
  // everything follows the filter.
  const filteredTradeIds = new Set(
    (Array.isArray(holdings) ? holdings : [])
      .map(h => String(h.TRADE_ID ?? h.trade_id ?? '').trim())
      .filter(Boolean)
  );

  let cpv01Rows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort &&
    normalizeRiskType(r.RISK_TYPE ?? r.risk_type) === 'CPV01'
  );

  if (filteredTradeIds.size) {
    cpv01Rows = cpv01Rows.filter(r =>
      filteredTradeIds.has(String(r.TRADE_ID ?? r.trade_id ?? '').trim())
    );
  }

  if (cpv01Rows.length) {
    calcData = calculateCreditSensitivity(cpv01Rows, selectedPort, holdings);
  }

  // Fallback nur, wenn die autoritativen Rows nichts Brauchbares ergeben haben.
  if ((!calcData || !calcData.filteredRowsCount) && productSens.length && holdings.length) {
    calcData = calculateCreditSensitivityFromHoldings(
      holdings,
      productSens,
      selectedPort,
      appState
    );
  }

  if (!calcData || !calcData.filteredRowsCount) {
    console.warn('[CP SENS] no CPV01 rows for selected portfolio', {
      selectedPort,
      storeRows: riskRowsAll.length,
      availablePorts,
      availableRiskTypes,
      productSensRows: productSens.length,
      holdings: holdings.length,
    });

    clearCPV01Chart();
    clearCPV01Details();

    return;
  }

  const hasAnyCPV01 =
    Object.values(calcData.cpv01TotalByCcy || {}).some(value => {
      const n = Number(value);
      return Number.isFinite(n) && Math.abs(n) > 1e-12;
    });

  if (!calcData.filteredRowsCount || !hasAnyCPV01) {
    console.warn('[CP SENS] skipped render: no usable CPV01 rows', {
      selectedPort,
      inputRows: cpv01Rows.length,
      firstRow: cpv01Rows[0],
      cpv01TotalByCcy: calcData.cpv01TotalByCcy,
    });

    clearCPV01Chart();
    clearCPV01Details();
    return;
  }

  // KPIs must follow the same filter (PRS is per TRADE_ID; fixed-value trades are
  // already 0 in PRS, so filtered totals stay consistent with the charts).
  let portfolioRows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort
  );

  if (filteredTradeIds.size) {
    portfolioRows = portfolioRows.filter(r =>
      filteredTradeIds.has(String(r.TRADE_ID ?? r.trade_id ?? '').trim())
    );
  }

  // NAV-Basen + Σ CPV01 einmal aus den GEFILTERTEN Holdings/Daten (Nenner fuer Duration/WAM).
  const fixedCats = appState.getFixedValueCategoryNames?.();
  const navTotal = navTotalFromHoldings(holdings);
  const navValued = navValuedFromHoldings(holdings, fixedCats);
  const totalCpv01 = Object.values(calcData.cpv01TotalByCcy || {})
    .reduce((s, v) => s + (Number(v) || 0), 0);

  // KPI-Update isoliert: ein KPI-Fehler darf den CPV01-Chart-Render nicht blockieren.
  try {
    updateMarketRiskSensitivityKpis({
      rows: portfolioRows,
      portName: selectedPort,
      cpv01CalcData: {
        cpv01TotalByCcy: calcData.cpv01TotalByCcy,
        groupedCPV01ByCcy: calcData.groupedCPV01ByCcy,
        sortedCPV01ByCcy: calcData.sortedCPV01ByCcy,
        filteredRowsCount: calcData.filteredRowsCount,
      },
      notionalByCcy: notionalByCcyFromHoldings(holdings),
      navTotal,
      navValued,
    });
  } catch (e) {
    console.error('[CS SENS] KPI update threw — chart/table still rendered', e);
  }

  // CPV01-Kacheln aus den GEFILTERTEN Holdings (folgen dem Header-Filter):
  // Weighted Rating, Credit Spread Duration (2 Balken) und Average Maturity (2 Balken).
  let cpv01Ratings = {};
  try {
    cpv01Ratings = updateCpv01WeightedRatingCard(holdings, fixedCats, appState.ratingOrder) || {};
  } catch (e) { console.warn('[CS SENS] weighted rating card failed', e); }
  try {
    updateCpv01DurationMaturityCards({ holdings, fixedCats, navTotal, navValued, totalCpv01 });
  } catch (e) { console.warn('[CS SENS] CS duration/maturity cards failed', e); }

  // Feed the right-click drill (empty on the legacy fallback path).
  _cpv01DrillRows = Array.isArray(calcData.drillRows) ? calcData.drillRows : [];

  return renderCPV01TableAndChart(
    {
      ...calcData,
      ratingNotchValued: cpv01Ratings.notchValued,
      ratingNotchTotal: cpv01Ratings.notchTotal,
      ratingOrder: appState.ratingOrder,
    },
    selectedPort,
  );
}

function calculateCreditSensitivity(rows, portName, holdings = []) {
  const selectedPort = normalizePortfolioName(portName);

  // Join the per-trade PRS rows to the holdings (by TRADE_ID) so we can bucket by
  // the product's RESOLVED rating (RATINGres) instead of the issuer base rating
  // that Python stored, and enrich the drill rows with product attributes.
  const holdingByTrade = new Map(
    (Array.isArray(holdings) ? holdings : []).map(h =>
      [String(h.TRADE_ID ?? h.trade_id ?? '').trim(), h])
  );

  // IMPORTANT: do NOT aggregate different CCYs into one CPV01.
  const filteredRows = rows.filter(r => {
    const value = Number(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local ?? 0
    );

    return Number.isFinite(value);
  });

  const groupedCPV01ByCcy = {};
  const cpv01TotalByCcy = {};
  const drillByKey = new Map();

  filteredRows.forEach(r => {
    const ccy = String(r.CCY ?? r.ccy ?? 'UNKNOWN')
      .toUpperCase()
      .trim() || 'UNKNOWN';

    const tradeId = String(r.TRADE_ID ?? r.trade_id ?? '').trim();
    const h = holdingByTrade.get(tradeId) || {};

    // Resolved product rating first; only fall back to the stored issuer bucket
    // when no resolved rating is available (never use issuer base as resolved).
    const resolved = normalizeCreditBucket(
      h.RATINGres ?? h.ratingres ?? h.RATING_PROD ?? h.rating_prod ?? ''
    );
    const storedBucket = normalizeCreditBucket(
      r.RISK_FACTOR_ID ?? r.risk_factor_id ?? r.RATING ?? r.rating ?? r.TENOR ?? r.tenor ?? 'UNKNOWN'
    );
    const bucket = (resolved && resolved !== 'UNKNOWN') ? resolved : storedBucket;

    const value = Number(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local ?? 0
    );

    if (!bucket || bucket === 'UNKNOWN' || !Number.isFinite(value) || value === 0) return;

    if (!groupedCPV01ByCcy[ccy]) groupedCPV01ByCcy[ccy] = {};
    groupedCPV01ByCcy[ccy][bucket] = (groupedCPV01ByCcy[ccy][bucket] || 0) + value;
    cpv01TotalByCcy[ccy] = (cpv01TotalByCcy[ccy] || 0) + value;

    const prodId = String(h.PROD_ID ?? h.prod_id ?? '').trim();
    const key = `${prodId || tradeId}|${bucket}|${ccy}`;
    let dr = drillByKey.get(key);
    if (!dr) {
      dr = { ...h, PROD_ID: prodId, CCY: ccy, __BUCKET: bucket, __CPV01: 0 };
      drillByKey.set(key, dr);
    }
    dr.__CPV01 += value;
  });

  const sortedCPV01ByCcy = Object.fromEntries(
    Object.entries(groupedCPV01ByCcy).map(([ccy, grouped]) => {
      const sorted = Object.entries(grouped)
        .filter(([, value]) => Number.isFinite(value) && value !== 0)
        .sort((a, b) => sortCreditBuckets(a[0], b[0]));

      return [ccy, sorted];
    })
  );

  return {
    cpv01TotalByCcy,
    groupedCPV01ByCcy,
    sortedCPV01ByCcy,
    filteredRowsCount: filteredRows.length,
    // Magnitude value so the largest CPV01 position sorts first.
    drillRows: [...drillByKey.values()].map(r => ({ ...r, __CPV01: Math.abs(r.__CPV01) })),

    // Legacy keys intentionally disabled.
    totalCPV01: null,
    groupedCPV01: null,
    sortedCPV01: [],
  };
}

/**
 * Reconstruct CPV01-by-CCY (bucketed by product rating) from the header-filtered
 * holdings and the per-product per-unit sensitivities.
 *
 * Scale matches Python trade_sensitivity_scaler: CPV01 = VALUE_PER_UNIT * NOTIONAL / 10000.
 * Rating bucket is the one Python assigned (TENOR/RATING of the CPV01 product row).
 * Fixed-value-category holdings are excluded (mirrors Python zeroing).
 * Returns the same shape as calculateCreditSensitivity().
 */
function calculateCreditSensitivityFromHoldings(holdings, productSens, portName, appState) {
  const selectedPort = normalizePortfolioName(portName);
  const CPV01_SCALE = 10000;

  const fixedValueNames =
    (typeof appState?.getFixedValueCategoryNames === 'function'
      ? appState.getFixedValueCategoryNames()
      : null) || new Set();

  // PROD_ID -> [{ bucket, ccy, vpu }] for RISK_TYPE = CPV01.
  const cpv01ByProd = new Map();

  productSens.forEach(r => {
    if (normalizeRiskType(r.RISK_TYPE ?? r.risk_type) !== 'CPV01') return;

    const prodId = String(r.PROD_ID ?? r.prod_id ?? '').trim();
    if (!prodId) return;

    const vpu = Number(r.VALUE_PER_UNIT ?? r.value_per_unit);
    if (!Number.isFinite(vpu)) return;

    const bucket = normalizeCreditBucket(
      r.TENOR ?? r.tenor ?? r.RATING ?? r.rating ??
      r.RISK_FACTOR_ID ?? r.risk_factor_id
    );
    if (!bucket || bucket === 'UNKNOWN') return;

    const ccy = String(r.CCY ?? r.ccy ?? 'UNKNOWN').toUpperCase().trim() || 'UNKNOWN';

    if (!cpv01ByProd.has(prodId)) cpv01ByProd.set(prodId, []);
    cpv01ByProd.get(prodId).push({ bucket, ccy, vpu });
  });

  const groupedCPV01ByCcy = {};
  const cpv01TotalByCcy = {};
  let contributions = 0;

  // Drill rows keyed by product+bucket+ccy (enriched with holding attributes).
  const drillByKey = new Map();

  holdings.forEach(row => {
    const rowPort = normalizePortfolioName(row.port_name ?? row.PORT_NAME);
    if (rowPort && selectedPort && rowPort !== selectedPort) return;

    const category = String(row.CATEGORY ?? row.category ?? '').trim();
    if (category && fixedValueNames.has(category)) return;

    const prodId = String(row.PROD_ID ?? row.prod_id ?? '').trim();
    if (!prodId) return;

    const notional = Number(row.NOTIONAL ?? row.notional);
    if (!Number.isFinite(notional) || notional === 0) return;

    const list = cpv01ByProd.get(prodId);
    if (!list || !list.length) return;

    // Aggregate by the product's RESOLVED rating (RATINGres), NOT the issuer base
    // rating that Python stored as the bucket. A AAA product of a BBB issuer must
    // sit in the AAA bucket. Only fall back to the stored bucket if no resolved
    // rating is available (never use the issuer base as the resolved value).
    const resolvedBucket = normalizeCreditBucket(
      row.RATINGres ?? row.ratingres ?? row.RATING_PROD ?? row.rating_prod ?? ''
    );

    list.forEach(({ bucket: storedBucket, ccy, vpu }) => {
      const value = (vpu * notional) / CPV01_SCALE;
      if (!Number.isFinite(value) || value === 0) return;

      const bucket = (resolvedBucket && resolvedBucket !== 'UNKNOWN')
        ? resolvedBucket
        : storedBucket;
      if (!bucket || bucket === 'UNKNOWN') return;

      if (!groupedCPV01ByCcy[ccy]) groupedCPV01ByCcy[ccy] = {};
      groupedCPV01ByCcy[ccy][bucket] = (groupedCPV01ByCcy[ccy][bucket] || 0) + value;
      cpv01TotalByCcy[ccy] = (cpv01TotalByCcy[ccy] || 0) + value;
      contributions += 1;

      const key = `${prodId}|${bucket}|${ccy}`;
      let dr = drillByKey.get(key);
      if (!dr) {
        dr = { ...row, PROD_ID: prodId, CCY: ccy, __BUCKET: bucket, __CPV01: 0 };
        drillByKey.set(key, dr);
      }
      dr.__CPV01 += value;
    });
  });

  const sortedCPV01ByCcy = Object.fromEntries(
    Object.entries(groupedCPV01ByCcy).map(([ccy, grouped]) => {
      const sorted = Object.entries(grouped)
        .filter(([, value]) => Number.isFinite(value) && value !== 0)
        .sort((a, b) => sortCreditBuckets(a[0], b[0]));
      return [ccy, sorted];
    })
  );

  return {
    cpv01TotalByCcy,
    groupedCPV01ByCcy,
    sortedCPV01ByCcy,
    filteredRowsCount: contributions,
    // Magnitude value so the largest CPV01 position sorts first.
    drillRows: [...drillByKey.values()].map(r => ({ ...r, __CPV01: Math.abs(r.__CPV01) })),
    totalCPV01: null,
    groupedCPV01: null,
    sortedCPV01: [],
  };
}

function renderCPV01TableAndChart(data, portName) {
  const {
    cpv01TotalByCcy = {},
    sortedCPV01ByCcy = {},
    ratingNotchValued = null,
    ratingNotchTotal = null,
    ratingOrder = [],
  } = data;

  const wrapper = document.createElement('div');
  wrapper.className = 'csens-wrapper';

  const tableData = [];
  const rawVals = [];

  Object.entries(sortedCPV01ByCcy)
    .sort(([ccyA], [ccyB]) => ccyA.localeCompare(ccyB))
    .forEach(([ccy, rows]) => {
      const totalForCcy = cpv01TotalByCcy[ccy] || 0;

      // Tabelle nach Beitrag (|CPV01|) absteigend, damit die Zeilenreihenfolge zu den
      // %-Zahlen passt (groesster Anteil oben). rawVals bleibt synchron. Der Chart nutzt
      // weiterhin die Rating-Reihenfolge aus sortedCPV01ByCcy (hier nicht mutiert).
      [...rows]
        .sort((a, b) => Math.abs(Number(b[1])) - Math.abs(Number(a[1])))
        .forEach(([bucket, cpv01]) => {
          const weight = totalForCcy ? (cpv01 / totalForCcy) * 100 : 0;

          tableData.push({
            CCY: ccy,
            Bucket: bucket,
            // Bereits gruppiert vorformatiert ("-13,775"). Key BEWUSST nicht "CPV01":
            // sonst wendet processData die CPV01-Zahlenregel (getFormatRules) erneut an
            // und re-parst den Tausender-Komma-String falsch ("-13,775" -> parseFloat
            // stoppt am Komma -> -13 -> "-13.0"). Label via columnLabelMap = "CPV01".
            CPV01_display: formatNumberWithGrouping(cpv01),
            'Weight %': `${weight.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`,
          });
          rawVals.push({ value: cpv01, weight });
        });
    });

  // Stabiler Tabellen-Key (wird nicht angezeigt) -> steht in excludeEditColumnTables
  // (modalData.js), damit die CPV01-Details KEINE Edit-Spalte bekommen.
  wrapper.innerHTML = processData(tableData, 'CPV01_Details', { CPV01_display: 'CPV01' });
  wireSortableDetails(wrapper, rawVals, 'CPV01');

  mountCPV01Details(wrapper);

  requestAnimationFrame(() => {
    createCPV01Chart({
      sortedCPV01ByCcy,
      cpv01TotalByCcy,
      ratingNotchValued,
      ratingNotchTotal,
      ratingOrder,
    });
  });

  // console.log('[CP SENS] rendered from PortfolioRiskSensitivities by CCY', {
  //   portName,
  //   cpv01TotalByCcy,
  //   tableRows: tableData.length,
  //   canvasExists: !!document.getElementById('CPV01Chart'),
  //   detailsContainerExists: !!document.getElementById('CSSensDataContainer'),
  // });

  return wrapper;
}

function mountCPV01Details(wrapper) {
  const target = document.getElementById('CSSensDataContainer');

  if (!target) {
    console.warn('[CPV01 DETAILS] CSSensDataContainer not found');
    return;
  }

  // Height comes from the flex layout (card stretched to the chart height); scrolls
  // internally. No fixed height so the table always matches the chart.
  target.innerHTML = '';
  target.style.display = 'block';
  target.style.overflowY = 'auto';
  target.style.overflowX = 'auto';
  target.style.padding = '8px';

  wrapper.style.display = 'block';
  wrapper.style.width = '100%';
  wrapper.style.overflow = 'visible';

  const table = wrapper.querySelector('table');

  if (table) {
    table.style.display = 'table';
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.color = '#fff';
    table.style.fontSize = '13px';
  }

  const headerCells = wrapper.querySelectorAll('th');

  headerCells.forEach((th) => {
    th.style.position = 'sticky';
    th.style.top = '0';
    th.style.zIndex = '2';
    th.style.background = 'var(--surface-raised)';
  });

  target.appendChild(wrapper);

  // console.log('[CPV01 DETAILS] mounted', {
  //   rows: wrapper.querySelectorAll('tr').length,
  // });
}

function createCPV01Chart({
  sortedCPV01ByCcy = {},
  cpv01TotalByCcy = {},
  ratingNotchValued = null,
  ratingNotchTotal = null,
  ratingOrder = [],
} = {}) {
  const canvasId = 'CPV01Chart';

  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.warn('[CPV01 CHART] canvas not found:', canvasId);
    return;
  }

  const allBuckets = Array.from(
    new Set(
      Object.values(sortedCPV01ByCcy)
        .flat()
        .map(([bucket]) => bucket)
    )
  ).sort(sortCreditBuckets);

  const datasets = Object.entries(sortedCPV01ByCcy)
    .sort(([ccyA], [ccyB]) => ccyA.localeCompare(ccyB))
    .map(([ccy, rows]) => {
      const totalForCcy = cpv01TotalByCcy[ccy] || 0;
      const valueByBucket = Object.fromEntries(rows);

      return {
        label: `${ccy} CPV01 Weight by Bucket (%)`,
        data: allBuckets.map((bucket) => {
          const value = Number(valueByBucket[bucket] || 0);
          return totalForCcy ? (value / totalForCcy) * 100 : 0;
        }),
        borderColor: 'rgba(54, 162, 235, 1)',
        backgroundColor: 'rgba(54, 162, 235, 0.6)',
        borderWidth: 1,
      };
    });

  if (CPV01Chart) {
    CPV01Chart.destroy();
    CPV01Chart = null;
  }

  const chartConfig = {
    labels: allBuckets,
    datasets,
  };

  // Drei vertikale Marker auf der Rating-Achse (Linien ohne eigene Labels; die Werte stehen
  // im lateralen Label-Stapel, jeder in eigener Zeile). Alle liegen auf der SAEULE ihres
  // (gerundeten) Ratings (Saeulenmitte); nur wenn die Saeule fehlt, wird interpoliert.
  //  - RED "Total NAV Rating" = NAV-gewichtetes Ø-Rating ueber ALLE gerateten Positionen.
  //  - BLUE "Valued NAV Rating" = NAV-gewichtetes Ø-Rating der BEWERTETEN (Nicht-Cash) Positionen.
  //  - ORANGE "CPV01 Weighted Rating" = Schwerpunkt der CPV01-Verteilung (netto-CPV01-
  //    gewichteter Bucket), analog zur "PV01 Weighted Tenor"-Linie.
  const pv01Annotations = {};
  {
    const ORANGE = 'rgba(245, 130, 32, 0.95)';
    const BLUE = 'rgba(33, 150, 243, 0.95)';
    const RED = 'rgba(211, 47, 47, 0.95)';
    const order = Array.isArray(ratingOrder) ? ratingOrder : [];
    const N = allBuckets.length;

    // CPV01-gewichteter Bucket-Index (Chart-Position direkt).
    const rawByBucket = {};
    Object.values(sortedCPV01ByCcy).forEach((rows) => {
      (Array.isArray(rows) ? rows : []).forEach(([bucket, value]) => {
        rawByBucket[bucket] = (rawByBucket[bucket] || 0) + (Number(value) || 0);
      });
    });
    let wNum = 0;
    let wDen = 0;
    allBuckets.forEach((bucket, idx) => {
      const v = rawByBucket[bucket] || 0;
      wNum += idx * v;
      wDen += v;
    });
    const cpv01Idx = Math.abs(wDen) > 1e-12 ? wNum / wDen : null;

    // Full-scale Notch -> fraktionaler Chart-Index (Interpolation ueber die Bucket-Notches).
    const bucketNotches = allBuckets.map((b) => order.findIndex(
      (x) => String(x).trim().toUpperCase() === String(b).trim().toUpperCase()));
    const notchToChartX = (notch) => {
      if (!Number.isFinite(notch) || bucketNotches.length === 0) return null;
      if (notch <= bucketNotches[0]) return 0;
      if (notch >= bucketNotches[bucketNotches.length - 1]) return bucketNotches.length - 1;
      for (let i = 0; i < bucketNotches.length - 1; i += 1) {
        const a = bucketNotches[i];
        const b = bucketNotches[i + 1];
        if (notch >= a && notch <= b) return i + (b > a ? (notch - a) / (b - a) : 0);
      }
      return null;
    };
    const inRange = (cv) => cv != null && cv >= -0.5 && cv <= N - 0.5;
    const mkLine = (value, color) => ({
      type: 'line', scaleID: 'x', value,
      borderColor: color, borderWidth: 2, borderDash: [6, 4], drawTime: 'afterDatasetsDraw',
    });

    // Beide Marker sitzen auf der SAEULE ihres (gerundeten) Ratings (Saeulenmitte), nicht an
    // einer fraktionalen Zwischenposition. Nur wenn die Saeule fehlt, wird interpoliert.
    // ORANGE (CPV01-Schwerpunkt): der gewichtete Bucket-Index gerundet -> vorhandene Saeule.
    const cpv01BarIdx = (cpv01Idx != null) ? Math.max(0, Math.min(N - 1, Math.round(cpv01Idx))) : null;

    // NAV-Rating-Notch (volle Skala) -> Saeule GENAU des gerundeten Ratings; fehlt sie -> interpoliert.
    const notchToBar = (notch) => {
      if (!Number.isFinite(notch) || !order.length) return { idx: null, label: '' };
      const rn = Math.max(0, Math.min(order.length - 1, Math.round(notch)));
      const label = order[rn];
      const exact = allBuckets.findIndex(
        (b) => String(b).trim().toUpperCase() === String(label).trim().toUpperCase());
      return { idx: exact >= 0 ? exact : notchToChartX(rn), label };
    };
    // BLUE (Valued NAV Rating) und RED (Total NAV Rating).
    const { idx: valuedBarIdx, label: valuedLabel } = notchToBar(ratingNotchValued);
    const { idx: totalBarIdx, label: totalLabel } = notchToBar(ratingNotchTotal);

    // Zeichenreihenfolge: blau/rot zuerst, orange (CPV01-Schwerpunkt) zuletzt/oben.
    if (inRange(totalBarIdx))  pv01Annotations.totalRatingLine  = mkLine(totalBarIdx, RED);
    if (inRange(valuedBarIdx)) pv01Annotations.valuedRatingLine = mkLine(valuedBarIdx, BLUE);
    if (inRange(cpv01BarIdx))  pv01Annotations.cpv01WeightedLine = mkLine(cpv01BarIdx, ORANGE);

    // Label-Stapel: jede Zeile eigen, lateral ueber ihrer Linie; Anker haelt sie im Plot.
    let yTop = 0;
    datasets.forEach((ds) => (ds.data || []).forEach((v) => {
      const n = Number(v) || 0;
      if (n > yTop) yTop = n;
    }));
    if (!(yTop > 0)) yTop = 100;

    const stack = [];
    if (inRange(totalBarIdx))  stack.push([`Total NAV Rating ${totalLabel}`, RED, totalBarIdx]);
    if (inRange(valuedBarIdx)) stack.push([`Valued NAV Rating ${valuedLabel}`, BLUE, valuedBarIdx]);
    if (inRange(cpv01BarIdx))  stack.push([`CPV01 Weighted Rating ${allBuckets[cpv01BarIdx]}`, ORANGE, cpv01BarIdx]);

    const span = Math.max(1, N - 1);
    stack.forEach(([content, color, cv], i) => {
      const f = cv / span;
      const xPos = f > 0.6 ? 'end' : (f < 0.4 ? 'start' : 'center');
      pv01Annotations[`lbl${i}`] = {
        type: 'label', xValue: cv, yValue: yTop,
        position: { x: xPos, y: 'start' },
        xAdjust: xPos === 'end' ? -4 : (xPos === 'start' ? 4 : 0),
        yAdjust: 6 + i * 21,
        content, backgroundColor: color, color: '#fff', borderRadius: 3,
        font: { size: 10, weight: 'bold' },
        padding: { top: 3, bottom: 3, left: 6, right: 6 },
        textAlign: 'left', drawTime: 'afterDatasetsDraw',
      };
    });
  }

  CPV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'x', {
    interactive: true,
    annotations: Object.keys(pv01Annotations).length ? pv01Annotations : undefined,
  });

  if (CPV01Chart) {
    // Right-click drill: bar (CCY dataset + rating bucket) -> contributing products.
    const drillCcys = Object.keys(sortedCPV01ByCcy).sort((a, b) => a.localeCompare(b));
    CPV01Chart.$stepsByDs = {};
    drillCcys.forEach((ccy, dsIndex) => {
      CPV01Chart.$stepsByDs[dsIndex] = allBuckets.map((bucket) => ({
        colKey: '__CPV01BUCKET',
        value: `${ccy} ${bucket}`,
        label: 'Rating',
        match: (r) =>
          String(r.CCY ?? '').toUpperCase().trim() === ccy &&
          String(r.__BUCKET ?? '') === bucket,
      }));
    });

    try { cpv01Drill.setData(_cpv01DrillRows); }
    catch (e) { console.warn('[CPV01 DRILL] setData failed', e); }

    bindRightClickDrill(canvas, () => CPV01Chart, (el, ch, e) =>
      cpv01Drill.hover('var', { native: e }, [el], ch.$stepsByDs?.[el.datasetIndex] || []));

    if (canvas.dataset.cpv01LeaveBound !== '1') {
      canvas.dataset.cpv01LeaveBound = '1';
      canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
    }
  }

  // console.log('[CPV01 CHART] rendered by CCY', {
  //   canvasId,
  //   labels: allBuckets,
  //   datasetLabels: datasets.map(d => d.label),
  // });
}

function clearCPV01Details() {
  const target = document.getElementById('CSSensDataContainer');

  if (target) {
    target.innerHTML = '';
  }
}

function clearCPV01Chart() {
  if (CPV01Chart) {
    try {
      CPV01Chart.destroy();
    } catch (e) {
      console.warn('[CPV01 CHART] destroy failed', e);
    }

    CPV01Chart = null;
  }
}