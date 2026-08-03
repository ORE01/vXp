'use strict';

// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioCPV01Handler.js

import processData from '../../../../core/ui/modal/modalData.js';
import createBarChart from '../../../../charts/BarChart.js';

import { formatNumberWithGrouping } from '../../../../utils/tableCellFormats.js';

import {
  updateMarketRiskSensitivityKpis,
  notionalByCcyFromHoldings,
  navTotalFromHoldings,
} from './marketRiskSensitivityKpis.js';
import { applyColumnFilters } from '../../../CUSTOMER/tableLayouts/tableColumnFilters.js';
import {
  createContribDrill,
  bindRightClickDrill,
  scheduleHideConcMenu,
} from '../../SummaryBreakdown.js';
import { wireSortableDetails } from './detailsTableSort.js';

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
    navTotal: navTotalFromHoldings(holdings),
  });

  // Feed the right-click drill (empty on the legacy fallback path).
  _cpv01DrillRows = Array.isArray(calcData.drillRows) ? calcData.drillRows : [];

  return renderCPV01TableAndChart(calcData, selectedPort);
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

  CPV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'x', { interactive: true });

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