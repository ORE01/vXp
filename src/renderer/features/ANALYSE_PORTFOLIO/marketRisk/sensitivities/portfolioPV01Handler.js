// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioPV01Handler.js

import createBarChart from '../../../../charts/BarChart.js';
import { getIrSensitivityColor } from '../../../../utils/colors.js';

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
import { makeSortableDetailsTable } from './detailsTableSort.js';
import { renderSensHistorySingle } from '../../HISTORIC_RISK_METRICS/historicRiskMetrics.js';

// Table id of the SELECT PORTFOLIO table whose per-column header filters drive
// the analyse sections; mirror it here so sensitivities follow the same filter.
const PORT_TABLE_ID = 'portTable0';

// Right-click drill on the PV01 bars: bar (CCY + tenor) -> contributing products.
const _pv01DrillCfg = {
  detailId: 'pv01DrillDetail',
  titleId: 'pv01DrillDetailTitle',
  tableId: 'pv01DrillDetailTable',
  closeId: 'pv01DrillDetailClose',
  menuId: 'pv01DrillCardMenu',
  valueType: '__PV01',
  valueLabel: 'PV01',
  infoCols: [
    { key: 'ISSUER', label: 'Issuer' },
    { key: 'RATINGres', label: 'Rating' },
  ],
};
const pv01Drill = createContribDrill({ var: _pv01DrillCfg, es: _pv01DrillCfg });

// Per-(product, tenor, ccy) contribution rows for the current render, fed to the drill.
let _pv01DrillRows = [];

// Hide/clear the drill detail table + menu (e.g. on portfolio switch / re-render),
// so it never lingers with stale values.
function resetPv01Drill() {
  const d = document.getElementById('pv01DrillDetail');
  if (d) d.style.display = 'none';
  const t = document.getElementById('pv01DrillDetailTable');
  if (t) t.innerHTML = '';
  const m = document.getElementById('pv01DrillCardMenu');
  if (m) m.style.display = 'none';
}


let PV01Chart;
let PV01RenderToken = 0;

// Schwelle fuer "keine echte IR-Sensitivitaet" (Σ|PV01| je CCY). Floater-Rauschen liegt bei
// ~1e-5 EUR, reale Positionen bei >= ~100 EUR -> 1e-3 trennt sauber. Darunter -> Gewichte 0
// (sonst ergibt winziges Rauschen / winzige Summe irrefuehrende 36%/36%/...).
const PV01_NO_SENS_EPS = 1e-3;

/**
 * Sets the two 2-bar cards in the Sensitivities panel ("Interest Rate Duration" and
 * "Average Maturity") from the CURRENTLY FILTERED holdings, so both follow the header
 * filter. IR duration arrives already filtered via kpiTotals; the maturity is the
 * NAV-weighted mean TtM over the valued (non-cash) holdings, using the SAME NAV
 * denominators as the duration -> Total/Valued ratios line up between the two cards.
 */
function updateSensDurationMaturityCards({
  holdings,
  fixedCats,
  navTotal,
  navValued,
  irDurTotal,
  irDurValued,
} = {}) {
  const cats = fixedCats instanceof Set ? fixedCats : new Set(fixedCats || []);

  // WAM numerator: Σ(TtM · NAV) over valued (non-cash) holdings with TtM >= 0.
  let ttmNavValued = 0;
  (Array.isArray(holdings) ? holdings : []).forEach((h) => {
    const cat = String(h.CATEGORY ?? h.category ?? '').trim();
    if (cat && cats.has(cat)) return; // cash / non-valued
    const ttm = Number(h.TtM ?? h.ttm);
    if (!Number.isFinite(ttm) || ttm < 0) return;
    const nav = Number(h.NAV ?? h.nav ?? h.NAV_BASE ?? h.nav_base) || 0;
    ttmNavValued += ttm * nav;
  });

  const dT = Number.isFinite(irDurTotal) ? irDurTotal : null;
  const dV = Number.isFinite(irDurValued) ? irDurValued : null;
  const wT = navTotal  ? ttmNavValued / navTotal  : null;
  const wV = navValued ? ttmNavValued / navValued : null;

  // Per-card scale (larger of the two bars = 100%), wie zuvor in homeOverview.
  const durScale = Math.max(dT || 0, dV || 0) || 1;
  const wamScale = Math.max(wT || 0, wV || 0) || 1;

  const setBar = (barId, valId, v, scale) => {
    const bar = document.getElementById(barId);
    if (bar) bar.style.width = `${Number.isFinite(v) ? Math.max(0, Math.min(100, (v / scale) * 100)) : 0}%`;
    const el = document.getElementById(valId);
    if (el) el.textContent = Number.isFinite(v) ? `${v.toFixed(2).replace('.', ',')}Y` : '–';
  };

  setBar('sensIrDurTotalBar', 'sensIrDurTotal', dT, durScale);
  setBar('sensIrDurValuedBar', 'sensIrDurValued', dV, durScale);
  setBar('sensWamTotalBar', 'sensWamTotal', wT, wamScale);
  setBar('sensWamValuedBar', 'sensWamValued', wV, wamScale);
}

/**
 * Render PV01 sensitivity view for the currently selected portfolio.
 *
 * Architecture:
 * - DataRouter stores ALL PortfolioRiskSensitivitiesData via portfolioRiskSensitivitiesStore.
 * - This handler reads from the store.
 * - This handler filters by active portfolio + RISK_TYPE = PV01.
 */
export function handleIRSensData(appState, forcedPortName = null, holdingsOverride = null) {
  if (!appState) {
    console.warn('[IR SENS] skipped render: appState missing');
    return;
  }

  // Reset the drill detail on every (re-)render so it doesn't show stale rows
  // after a portfolio switch / filter change.
  resetPv01Drill();

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

const availablePorts = [
  ...new Set(
    riskRowsAll
      .map(r => normalizePortfolioName(r.PORT_NAME ?? r.port_name))
      .filter(Boolean)
  ),
];

const selectedPort = normalizePortfolioName(
  rawPortName ||
  (availablePorts.length === 1 ? availablePorts[0] : null)
);

if (!selectedPort) {
  console.warn('[IR SENS] skipped render: no selected portfolio yet', {
    rawPortName,
    availablePorts,
  });
  return;
}

// PV01-Verlauf (Portfolio-History, bp) unter Graph + Details zeichnen — unabhaengig vom
// Bar-Chart-Datenpfad (auch bei leeren PV01-Rows aktualisieren/leeren).
try {
  const _hist = (appState.getPortfolioHistoryData?.() || [])
    .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === selectedPort);
  renderSensHistorySingle('sensPv01HistChart', _hist, {
    keys: ['MDURATION', 'M_DURATION', 'MOD_DURATION'],
    label: 'PV01 (bp)',
    borderColor: 'rgba(0, 200, 83, 1)',
    backgroundColor: 'rgba(0, 200, 83, 0.15)',
  });
} catch (e) { console.warn('[IR SENS] PV01 history chart failed', e); }

// console.log('[IR SENS] selected portfolio resolved', {
//   rawPortName,
//   selectedPort,
//   availablePorts,
//   storeRows: riskRowsAll.length,
//   riskTypes: [
//     ...new Set(
//       riskRowsAll
//         .map(r => String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim())
//         .filter(Boolean)
//     ),
//   ],
// });

// -------------------------------------------------------------------------
// PREFERRED PATH: reconstruct PV01 from per-product per-unit sensitivities
// times the CURRENTLY FILTERED holdings, so the portfolio filter (and the
// fixed-value-category exclusion) flow through to the sensitivities view.
// Falls back to the legacy aggregated PortfolioRiskSensitivities store when
// the product table or filtered holdings are not available.
// -------------------------------------------------------------------------
let calcData = null;

const productSens = appState.getProductRiskSensitivitiesData?.() || [];

// Holdings to reconstruct from: the header-filtered set passed by the
// orchestrator, or — for other callers — the port data re-filtered by the
// active header filters, so the portfolio filter always flows through.
const holdings = Array.isArray(holdingsOverride)
  ? holdingsOverride
  : applyColumnFilters(appState.getFilteredPortData?.() || [], PORT_TABLE_ID);

// TRADE_IDs of the filtered holdings — narrows both the legacy fallback rows
// and the per-trade PRS rows behind the KPIs, so everything follows the filter.
const filteredTradeIds = new Set(
  (Array.isArray(holdings) ? holdings : [])
    .map(h => String(h.TRADE_ID ?? h.trade_id ?? '').trim())
    .filter(Boolean)
);

if (productSens.length && holdings.length) {
  calcData = calculateIRSensitivityFromHoldings(
    holdings,
    productSens,
    selectedPort,
    appState
  );
}

if (!calcData || !calcData.filteredRowsCount) {
  // Legacy fallback: per-portfolio PV01 rows, narrowed to the filtered holdings'
  // TRADE_IDs so the fallback chart also follows the filter.
  let pv01Rows = riskRowsAll.filter(r =>
    normalizePortfolioName(r.PORT_NAME ?? r.port_name) === selectedPort &&
    String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim() === 'PV01'
  );

  if (filteredTradeIds.size) {
    pv01Rows = pv01Rows.filter(r =>
      filteredTradeIds.has(String(r.TRADE_ID ?? r.trade_id ?? '').trim())
    );
  }

  if (!Array.isArray(pv01Rows) || pv01Rows.length === 0) {
    console.warn('[IR SENS] no PV01 rows for selected portfolio', {
      selectedPort,
      storeRows: riskRowsAll.length,
      availablePorts,
      productSensRows: productSens.length,
      holdings: holdings.length,
    });

    clearPV01Chart();
    clearPV01Details();

    return;
  }

  calcData = calculateIRSensitivity(pv01Rows, selectedPort);
}

  if (!calcData.filteredRowsCount) {
    console.warn('[IR SENS] skipped render: no usable PV01 rows', {
      selectedPort,
    });

    clearPV01Chart();
    clearPV01Details();

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

  // NAV-Basen einmal aus den GEFILTERTEN Holdings bestimmen (Nenner fuer Duration + WAM).
  const fixedCats = appState.getFixedValueCategoryNames?.();
  const navTotal = navTotalFromHoldings(holdings);
  const navValued = navValuedFromHoldings(holdings, fixedCats);

  // KPI-Update ISOLIERT: wirft es (z. B. im gemeinsamen KPI-Schwanz), darf das
  // NICHT den Chart/Tabellen-Render darunter verhindern. Frueher blockierte ein
  // KPI-Fehler den ganzen Sensitivities-Refresh -> Chart/Tabelle blieben stehen,
  // obwohl die KPIs schon aktualisiert waren.
  let kpiTotals;
  try {
    kpiTotals = updateMarketRiskSensitivityKpis({
      rows: portfolioRows,
      portName: selectedPort,
      pv01CalcData: calcData,
      notionalByCcy: notionalByCcyFromHoldings(holdings),
      navTotal,
      navValued,
    });
  } catch (e) {
    console.error('[IR SENS] KPI update threw — chart/table still rendered', e);
  }

  // "Interest Rate Duration" + "Average Maturity"-Kacheln des Sensitivities-Panels aus den
  // GEFILTERTEN Holdings setzen -> sie folgen jetzt dem Header-Filter (frueher aus dem vollen
  // Portfolio via homeOverview -> blieben beim Filtern konstant). Duration kommt gefiltert aus
  // kpiTotals.
  try {
    updateSensDurationMaturityCards({
      holdings,
      fixedCats,
      navTotal,
      navValued,
      irDurTotal: kpiTotals?.duration,
      irDurValued: kpiTotals?.durationValued,
    });
  } catch (e) { console.warn('[IR SENS] duration/maturity cards failed', e); }

  // Feed the right-click drill (empty on the legacy fallback path).
  _pv01DrillRows = Array.isArray(calcData.drillRows) ? calcData.drillRows : [];

  return renderIRSensTableAndChart(
    {
      ...calcData,
      duration: kpiTotals?.duration,
      durationValued: kpiTotals?.durationValued,
    },
    selectedPort
  );
}

/**
 * Reconstruct PV01-by-CCY from the currently filtered holdings and the
 * per-product per-unit sensitivities (ProductRiskSensitivities).
 *
 * Scale matches the Python trade_sensitivity_scaler:
 *   PV01 = VALUE_PER_UNIT * NOTIONAL / 10000
 *
 * Fixed-value-category holdings are excluded to mirror the Python valuation,
 * which zeroes those trades in PortfolioRiskSensitivities.
 *
 * Returns the same shape as calculateIRSensitivity(), so the existing
 * render/KPI code path is unchanged.
 */
function calculateIRSensitivityFromHoldings(holdings, productSens, portName, appState) {
  const selectedPort = normalizePortfolioName(portName);
  const PV01_SCALE = 10000;

  const fixedValueNames =
    (typeof appState?.getFixedValueCategoryNames === 'function'
      ? appState.getFixedValueCategoryNames()
      : null) || new Set();

  // PROD_ID -> [{ tenor, ccy, vpu }] for RISK_TYPE = PV01.
  const pv01ByProd = new Map();

  productSens.forEach(r => {
    const riskType = String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim();
    if (riskType !== 'PV01') return;

    const prodId = String(r.PROD_ID ?? r.prod_id ?? '').trim();
    if (!prodId) return;

    const tenor = parseInt(r.TENOR ?? r.tenor, 10);
    if (!Number.isFinite(tenor) || tenor < 1 || tenor > 30) return;

    const vpu = parseFloat(r.VALUE_PER_UNIT ?? r.value_per_unit);
    if (!Number.isFinite(vpu)) return;

    const ccy = String(r.CCY ?? r.ccy ?? 'UNKNOWN').toUpperCase().trim() || 'UNKNOWN';

    if (!pv01ByProd.has(prodId)) pv01ByProd.set(prodId, []);
    pv01ByProd.get(prodId).push({ tenor, ccy, vpu });
  });

  const irSensitivityByCcy = {};
  const pv01TotalByCcy = {};
  const pv01PartialPctByCcy = {};

  let contributions = 0;

  // Drill rows keyed by product+tenor+ccy (enriched with the holding attributes).
  const drillByKey = new Map();

  holdings.forEach(row => {
    // Defensive: if a holding carries a portfolio name, keep only the selected one.
    const rowPort = normalizePortfolioName(row.port_name ?? row.PORT_NAME);
    if (rowPort && selectedPort && rowPort !== selectedPort) return;

    // Exclude fixed-value-category holdings (mirrors Python zeroing).
    const category = String(row.CATEGORY ?? row.category ?? '').trim();
    if (category && fixedValueNames.has(category)) return;

    const prodId = String(row.PROD_ID ?? row.prod_id ?? '').trim();
    if (!prodId) return;

    const notional = parseFloat(row.NOTIONAL ?? row.notional);
    if (!Number.isFinite(notional) || notional === 0) return;

    const sensList = pv01ByProd.get(prodId);
    if (!sensList || !sensList.length) return;

    sensList.forEach(({ tenor, ccy, vpu }) => {
      const contrib = (vpu * notional) / PV01_SCALE;

      if (!irSensitivityByCcy[ccy]) {
        irSensitivityByCcy[ccy] = Array(30).fill(0);
      }
      irSensitivityByCcy[ccy][tenor - 1] += contrib;
      contributions += 1;

      const key = `${prodId}|${tenor}|${ccy}`;
      let dr = drillByKey.get(key);
      if (!dr) {
        dr = { ...row, PROD_ID: prodId, CCY: ccy, __TENOR: tenor, __PV01: 0 };
        drillByKey.set(key, dr);
      }
      dr.__PV01 += contrib;
    });
  });

  Object.entries(irSensitivityByCcy).forEach(([ccy, tenorValues]) => {
    const total = tenorValues.reduce((sum, value) => sum + value, 0);
    pv01TotalByCcy[ccy] = total;
    // Keine echte IR-Sensitivitaet (z. B. Floater): |PV01| vernachlaessigbar -> Gewichte 0.
    const sumAbs = tenorValues.reduce((s, v) => s + Math.abs(v), 0);
    pv01PartialPctByCcy[ccy] = (!total || sumAbs < PV01_NO_SENS_EPS)
      ? tenorValues.map(() => 0)
      : tenorValues.map(value => Number(((value / total) * 100).toFixed(2)));
  });

  return {
    irSensitivityByCcy,
    pv01TotalByCcy,
    pv01PartialPctByCcy,
    filteredRowsCount: contributions,
    // Magnitude value so renderConcView (sorts b.val - a.val) puts the largest
    // PV01 position first — consistent with the other contribution drills.
    drillRows: [...drillByKey.values()].map(r => ({ ...r, __PV01: Math.abs(r.__PV01) })),

    irSensitivitySum: null,
    portPV01: null,
    pv01PartialPct: null,
  };
}

function normalizePortfolioName(portName) {
  return String(portName ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

function calculateIRSensitivity(rows, portName) {
  const selectedPort = normalizePortfolioName(portName);

  // Store already filters by portfolio + RISK_TYPE = PV01.
  // IMPORTANT:
  // Do NOT filter to EUR.
  // Do NOT aggregate different CCYs into one PV01.
  // PV01 belongs to a curve/CCY: EUR PV01, USD PV01, JPY PV01, ...
  const filteredRows = rows.filter(r => {
    const tenor = parseInt(r.TENOR ?? r.tenor, 10);
    const value = parseFloat(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local
    );

    return (
      !Number.isNaN(tenor) &&
      tenor >= 1 &&
      tenor <= 30 &&
      Number.isFinite(value)
    );
  });

  const irSensitivityByCcy = {};
  const pv01TotalByCcy = {};
  const pv01PartialPctByCcy = {};

  filteredRows.forEach(r => {
    const tenor = parseInt(r.TENOR ?? r.tenor, 10);
    const ccy = String(r.CCY ?? r.ccy ?? 'UNKNOWN')
      .toUpperCase()
      .trim() || 'UNKNOWN';

    const value = parseFloat(
      r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local
    ) || 0;

    if (!irSensitivityByCcy[ccy]) {
      irSensitivityByCcy[ccy] = Array(30).fill(0);
    }

    irSensitivityByCcy[ccy][tenor - 1] += value;
  });

  Object.entries(irSensitivityByCcy).forEach(([ccy, tenorValues]) => {
    const total = tenorValues.reduce((sum, value) => sum + value, 0);

    pv01TotalByCcy[ccy] = total;

    // Keine echte IR-Sensitivitaet (z. B. Floater): |PV01| vernachlaessigbar -> Gewichte 0.
    const sumAbs = tenorValues.reduce((s, v) => s + Math.abs(v), 0);
    pv01PartialPctByCcy[ccy] = (!total || sumAbs < PV01_NO_SENS_EPS)
      ? tenorValues.map(() => 0)
      : tenorValues.map(value => Number(((value / total) * 100).toFixed(2)));
  });

  // console.log('[IR SENS] FILTER CHECK:', {
  //   selectedPort,
  //   inputRows: rows.length,
  //   filteredRows: filteredRows.length,
  //   uniquePorts: [
  //     ...new Set(rows.map(r => String(r.PORT_NAME ?? r.port_name ?? '').trim())),
  //   ],
  //   uniqueRiskTypes: [
  //     ...new Set(
  //       rows.map(r =>
  //         String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim()
  //       )
  //     ),
  //   ],
  //   uniqueCcys: [
  //     ...new Set(
  //       rows.map(r => String(r.CCY ?? r.ccy ?? '').toUpperCase().trim())
  //     ),
  //   ],
  //   uniqueTenors: [
  //     ...new Set(filteredRows.map(r => r.TENOR ?? r.tenor)),
  //   ].sort((a, b) => Number(a) - Number(b)),
  //   firstFilteredRow: filteredRows[0],
  // });

  // console.log('[IR SENS] RESULT BY CCY:', {
  //   irSensitivityByCcy,
  //   pv01TotalByCcy,
  //   pv01PartialPctByCcy,
  //   filteredRowsCount: filteredRows.length,
  // });

  return {
    irSensitivityByCcy,
    pv01TotalByCcy,
    pv01PartialPctByCcy,
    filteredRowsCount: filteredRows.length,

    // Keep legacy keys null/empty so no one accidentally treats this as one total.
    irSensitivitySum: null,
    portPV01: null,
    pv01PartialPct: null,
  };
}

function renderIRSensTableAndChart(data, portName) {
  const {
    irSensitivityByCcy = {},
    pv01TotalByCcy = {},
    pv01PartialPctByCcy = {},
    duration = 0,
    durationValued = 0,
  } = data;

  const wrapper = document.createElement('div');
  wrapper.className = 'irsens-wrapper';

  const table = document.createElement('table');
  table.className = 'irsens-table';

  const titleRow = table.insertRow();
  const titleCell = document.createElement('th');
  titleCell.colSpan = 4;
  titleCell.textContent = `PV01 Details by CCY for ${portName}`;
  titleRow.appendChild(titleCell);

  const headerRow = table.insertRow();

  ['CCY', 'Tenor', 'PV01', 'Weight %'].forEach((label) => {
    const th = document.createElement('th');
    th.textContent = label;
    headerRow.appendChild(th);
  });

  const chartData = [];

  Object.entries(irSensitivityByCcy)
    .sort(([ccyA], [ccyB]) => ccyA.localeCompare(ccyB))
    .forEach(([ccy, tenorValues]) => {
      const totalForCcy = pv01TotalByCcy[ccy] || 0;
      const weightsForCcy = pv01PartialPctByCcy[ccy] || [];

      tenorValues.forEach((sum, index) => {
        if (!sum) return;

        const tenor = `${index + 1}Y`;
        const weight = weightsForCcy[index] ?? (
          totalForCcy ? (sum / totalForCcy) * 100 : 0
        );

        const row = table.insertRow();

        const ccyCell = row.insertCell();
        ccyCell.textContent = ccy;

        const tenorCell = row.insertCell();
        tenorCell.textContent = tenor;
        tenorCell.dataset.sortValue = String(index + 1);

        const pv01Cell = row.insertCell();
        pv01Cell.textContent = Number(sum).toLocaleString('de-DE', {
          maximumFractionDigits: 0,
        });
        pv01Cell.dataset.sortValue = String(Math.abs(Number(sum)));

        const weightCell = row.insertCell();
        weightCell.textContent = `${Number(weight).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`;
        weightCell.dataset.sortValue = String(Math.abs(Number(weight)));
      });
    });

  wrapper.appendChild(table);

  // Sortable columns (click a header; ▲/▼). Default: PV01 magnitude, largest first.
  makeSortableDetailsTable(table, { defaultCol: 2, defaultDir: -1 });

  mountPV01Details(wrapper);

  // CRITICAL:
  // Cancel stale chart renders.
  // MVaR / Risk refreshes can rebuild the DOM while this RAF is still pending.
  const renderToken = ++PV01RenderToken;

  // Destroy the old chart BEFORE scheduling the new one.
  // Otherwise Chart.js can still run delayed resize/update logic on a removed canvas.
  clearPV01Chart({ preserveRenderToken: true });

  requestAnimationFrame(() => {
    if (renderToken !== PV01RenderToken) {
      // Stale-RAF-Skip ist normaler Churn bei schnellen Re-Renders -> stumm, ausser
      // window.__PV01_DEBUG = true. Nicht geloescht.
      if (typeof window !== 'undefined' && window.__PV01_DEBUG) console.warn('[PV01 CHART] skipped stale RAF render', {
        renderToken,
        currentToken: PV01RenderToken,
      });
      return;
    }

    const canvas = document.getElementById('PV01Chart');

    if (!canvas || !canvas.isConnected || !canvas.parentNode) {
      console.warn('[PV01 CHART] skipped RAF render: canvas not attached', {
        exists: !!canvas,
        isConnected: canvas?.isConnected,
        hasParentNode: !!canvas?.parentNode,
      });
      return;
    }

    createPV01Chart({
      irSensitivityByCcy,
      pv01PartialPctByCcy,
      duration,
      durationValued,
      expectedRenderToken: renderToken,
    });
  });

  // console.log('[PV01 RENDER] wrapper created by CCY', {
  //   portName,
  //   tableRows: table.rows.length,
  //   chartRows: chartData.length,
  //   pv01TotalByCcy,
  //   canvasExists: !!document.getElementById('PV01Chart'),
  //   detailsContainerExists: !!document.getElementById('IRSensDataContainer'),
  // });

  return wrapper;
}

function createPV01Chart({
  irSensitivityByCcy = {},
  pv01PartialPctByCcy = {},
  duration = 0,
  durationValued = 0,
  expectedRenderToken = PV01RenderToken,
} = {}) {
  if (expectedRenderToken !== PV01RenderToken) {
    console.warn('[PV01 CHART] skipped stale createPV01Chart call', {
      expectedRenderToken,
      currentToken: PV01RenderToken,
    });
    return;
  }

  const canvasId = 'PV01Chart';
  const canvas = document.getElementById(canvasId);

  if (!canvas || !canvas.isConnected || !canvas.parentNode) {
    console.warn('[PV01 CHART] canvas not ready:', {
      canvasId,
      exists: !!canvas,
      isConnected: canvas?.isConnected,
      hasParentNode: !!canvas?.parentNode,
    });
    return;
  }

  const fullLabels = Array.from({ length: 30 }, (_, i) => `${i + 1}Y`);

  const fullDatasets = Object.entries(irSensitivityByCcy)
    .sort(([ccyA], [ccyB]) => ccyA.localeCompare(ccyB))
    .map(([ccy]) => {
      const weights = pv01PartialPctByCcy[ccy] || Array(30).fill(0);

      return {
        label: `${ccy} PV01 Weight by Tenor (%)`,
        data: fullLabels.map((_, index) => Number(weights[index] || 0)),
        borderColor: 'rgba(0, 200, 83, 1)',
        backgroundColor: 'rgba(0, 200, 83, 0.6)',
        borderWidth: 1,
      };
    });

  if (!fullDatasets.length) {
    console.warn('[PV01 CHART] skipped render: no datasets');
    clearPV01Chart({ preserveRenderToken: true });
    return;
  }

  // --------------------------------------------------
  // Trim chart range to the first/last tenor where
  // at least one dataset has a non-zero value.
  // --------------------------------------------------
  const ZERO_EPSILON = 1e-12;

  let firstActiveIndex = -1;
  let lastActiveIndex = -1;

  for (let i = 0; i < fullLabels.length; i += 1) {
    const hasNonZeroAtIndex = fullDatasets.some(ds => {
      const value = Number(ds.data?.[i] || 0);
      return Math.abs(value) > ZERO_EPSILON;
    });

    if (hasNonZeroAtIndex) {
      if (firstActiveIndex === -1) {
        firstActiveIndex = i;
      }
      lastActiveIndex = i;
    }
  }

  // Fallback: if everything is zero, keep the full axis
  const startIndex = firstActiveIndex === -1 ? 0 : firstActiveIndex;
  const endIndex = lastActiveIndex === -1 ? fullLabels.length - 1 : lastActiveIndex;

  const labels = fullLabels.slice(startIndex, endIndex + 1);

  const datasets = fullDatasets.map(ds => ({
    ...ds,
    data: ds.data.slice(startIndex, endIndex + 1),
  }));

  // Final DOM check directly before Chart creation.
  // The canvas can disappear between RAF guard and this point during fast UI refreshes.
  if (!canvas.isConnected || !canvas.parentNode) {
    console.warn('[PV01 CHART] skipped render: canvas detached before createBarChart', {
      canvasId,
      isConnected: canvas.isConnected,
      hasParentNode: !!canvas.parentNode,
    });
    return;
  }

  const chartConfig = {
    labels,
    datasets,
  };

  // --------------------------------------------------
  // Three vertical markers + the gap band. Passed at construction time
  // (chartjs-plugin-annotation ignores options set after new Chart()).
  //  - RED   "Total NAV Duration"  = |PV01| / Total NAV  * 10000 (`duration`).
  //  - BLUE  "Valued NAV Duration" = |PV01| / Valued NAV * 10000 (NAV without
  //           cash / non-valued positions) (`durationValued`).
  //          Both arrive fresh from the KPI computation in the SAME render cycle
  //          (kpiTotals) -- previously read from the card DOM, which lagged on a
  //          portfolio switch and left stale red/blue lines. Duration = effective
  //          rate sensitivity to a parallel move ("zero-bond-equivalent maturity").
  //  - ORANGE "PV01 Weighted Tenor" = PV01-weighted mean tenor, same signed
  //           weights as the bars: Sum(tenor*PV01) / Sum(PV01). Shows WHERE on
  //           the curve the key-rate sensitivity is concentrated.
  // The lines carry no own labels; all three values are shown as labels placed
  // laterally over the line/region they belong to, each on its own vertical row
  // (top to bottom) so they never overlap. Red is painted last so it covers the
  // blue line where the two coincide.
  // --------------------------------------------------
  const pv01Annotations = {};
  {
    // Durations arrive fresh from the KPI computation (same render cycle) -- NOT
    // read from the card DOM, which lagged on a portfolio switch and left stale
    // red/blue lines until the next recompute.
    const durTotal  = duration > 0 ? duration : null;
    const durValued = durationValued > 0 ? durationValued : null;

    const inRange = (cv) => cv != null && cv >= -0.5 && cv <= labels.length - 0.5;
    const toChartValue = (y) => (y != null && y > 0) ? (y - 1 - startIndex) : null;

    const durTotalCV  = toChartValue(durTotal);
    const durValuedCV = toChartValue(durValued);

    // Orange: PV01-weighted mean tenor (signed weights = the bars).
    let wNum = 0;
    let wDen = 0;
    let wAbs = 0;
    for (let i = 0; i < fullLabels.length; i += 1) {
      let netAtTenor = 0;
      Object.values(irSensitivityByCcy).forEach((tenorValues) => {
        netAtTenor += Number(tenorValues?.[i]) || 0;
      });
      wNum += (i + 1) * netAtTenor;
      wDen += netAtTenor;
      wAbs += Math.abs(netAtTenor);
    }
    // Keine echte IR-Sensitivitaet (z. B. Floater): keine Ø-Tenor-Linie (waere aus Rauschen).
    const wavgTenor = (Math.abs(wDen) > 1e-9 && wAbs >= PV01_NO_SENS_EPS) ? wNum / wDen : null;
    const avgCV = wavgTenor != null ? wavgTenor - 1 - startIndex : null;

    const RED = 'rgba(211, 47, 47, 0.95)';
    const BLUE = 'rgba(33, 150, 243, 0.95)';
    const ORANGE = 'rgba(245, 130, 32, 0.95)';
    const fmtY = (v) => `${v.toFixed(2).replace('.', ',')}Y`;

    // Bare dashed line (no own label -- labels live in the vertical stack below).
    const mkLine = (value, color) => ({
      type: 'line',
      scaleID: 'x',
      value,
      borderColor: color,
      borderWidth: 2,
      borderDash: [6, 4],
      drawTime: 'afterDatasetsDraw',
    });

    // Order matters within the same drawTime: later keys paint on top -> blue
    // first, then RED LAST so the red line covers the blue one when they coincide.
    // (Gap band / shaded area entfernt auf Wunsch.)
    if (inRange(durValuedCV)) pv01Annotations.durationValuedLine = mkLine(durValuedCV, BLUE);
    if (inRange(avgCV))       pv01Annotations.wavgLine           = mkLine(avgCV, ORANGE);
    if (inRange(durTotalCV))  pv01Annotations.durationTotalLine  = mkLine(durTotalCV, RED); // last -> on top

    // Label stack: one row per metric (top to bottom, never overlapping), but each
    // shifted LATERALLY to sit over the line / region it belongs to. Anchored near
    // the top of the plot; x-anchor keeps it inside the area (extends left near the
    // right edge, right near the left edge).
    let yTop = 0;
    datasets.forEach((ds) => (ds.data || []).forEach((v) => {
      const n = Number(v) || 0;
      if (n > yTop) yTop = n;
    }));
    if (!(yTop > 0)) yTop = 100;

    const stack = [];
    if (inRange(durTotalCV))  stack.push([`Total NAV Duration ${fmtY(durTotal)}`, RED, durTotalCV]);
    if (inRange(durValuedCV)) stack.push([`Valued NAV Duration ${fmtY(durValued)}`, BLUE, durValuedCV]);
    if (inRange(avgCV))       stack.push([`PV01 Weighted Tenor ${fmtY(wavgTenor)}`, ORANGE, avgCV]);
    // (Gap-Label sitzt zentriert in der Fläche, siehe Box oben -- nicht im Stapel.)

    const span = Math.max(1, labels.length - 1);
    stack.forEach(([content, color, cv], i) => {
      const f = cv / span;
      const xPos = f > 0.6 ? 'end' : (f < 0.4 ? 'start' : 'center');
      pv01Annotations[`lbl${i}`] = {
        type: 'label',
        xValue: cv,                       // lateral: over its own line/region
        yValue: yTop,
        position: { x: xPos, y: 'start' },
        xAdjust: xPos === 'end' ? -4 : (xPos === 'start' ? 4 : 0),
        yAdjust: 6 + i * 21,              // vertical: own row -> no overlap
        content,
        backgroundColor: color,
        color: '#fff',
        borderRadius: 3,
        font: { size: 10, weight: 'bold' },
        padding: { top: 3, bottom: 3, left: 6, right: 6 },
        textAlign: 'left',
        drawTime: 'afterDatasetsDraw',
      };
    });
  }

  PV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'x', {
    interactive: true,
    annotations: Object.keys(pv01Annotations).length ? pv01Annotations : undefined,
  });

  if (!PV01Chart) {
    console.warn('[PV01 CHART] createBarChart returned null', {
      canvasId,
      labelsCount: labels.length,
      datasetsCount: datasets.length,
    });
    return;
  }

  // ---- Right-click drill: bar (CCY dataset + tenor label) -> contributing products.
  // Datasets are sorted by CCY (same order as fullDatasets), so datasetIndex -> CCY.
  const drillCcys = Object.keys(irSensitivityByCcy).sort((a, b) => a.localeCompare(b));
  PV01Chart.$stepsByDs = {};
  drillCcys.forEach((ccy, dsIndex) => {
    PV01Chart.$stepsByDs[dsIndex] = labels.map((lbl) => {
      const tenor = parseInt(lbl, 10);
      return {
        colKey: '__PV01BUCKET',
        value: `${ccy} ${lbl}`,
        label: 'Tenor',
        match: (r) =>
          String(r.CCY ?? '').toUpperCase().trim() === ccy &&
          Number(r.__TENOR) === tenor,
      };
    });
  });

  try { pv01Drill.setData(_pv01DrillRows); }
  catch (e) { console.warn('[PV01 DRILL] setData failed', e); }

  // Self-guards against double-binding on the same canvas across re-renders.
  bindRightClickDrill(canvas, () => PV01Chart, (el, ch, e) =>
    pv01Drill.hover('var', { native: e }, [el], ch.$stepsByDs?.[el.datasetIndex] || []));

  if (canvas.dataset.pv01LeaveBound !== '1') {
    canvas.dataset.pv01LeaveBound = '1';
    canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
  }

  // console.log('[PV01 CHART] rendered by CCY (trimmed)', {
  //   canvasId,
  //   startLabel: labels[0],
  //   endLabel: labels[labels.length - 1],
  //   labels,
  //   datasetLabels: datasets.map(d => d.label),
  // });
}

function mountPV01Details(wrapper) {
  const target = document.getElementById('IRSensDataContainer');

  if (!target) {
    console.error('[PV01 DETAILS] IRSensDataContainer not found');
    return;
  }

  // console.log('[PV01 DETAILS] target before mount:', {
  //   target,
  //   targetHeight: target.offsetHeight,
  //   wrapperChildren: wrapper.children.length,
  //   tableRows: wrapper.querySelectorAll('tr').length,
  // });

  // Height comes from the flex layout: the container flex-fills the card, which is
  // stretched to the chart height (see marketRiskSensitivities.css); it scrolls
  // internally. No fixed height here, so it always matches the chart.
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

  // console.log('[PV01 DETAILS] mounted:', {
  //   targetHeight: target.offsetHeight,
  //   childCount: target.children.length,
  //   htmlPreview: target.innerHTML.slice(0, 300),
  // });
}

  function clearPV01Details() {
  const target = document.getElementById('IRSensDataContainer');

  if (target) {
    target.innerHTML = '';
  }
}

function clearPV01Chart({ preserveRenderToken = false } = {}) {
  if (!preserveRenderToken) {
    PV01RenderToken += 1;
  }

  if (PV01Chart) {
    try {
      PV01Chart.destroy();
    } catch (e) {
      console.warn('[PV01 CHART] destroy failed', e);
    }

    PV01Chart = null;
  }

  const canvas = document.getElementById('PV01Chart');

  if (
    canvas &&
    typeof Chart !== 'undefined' &&
    typeof Chart.getChart === 'function'
  ) {
    const existingChart = Chart.getChart(canvas);

    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (e) {
        console.warn('[PV01 CHART] Chart.getChart(canvas).destroy failed', e);
      }
    }
  }
}





