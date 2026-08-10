import { appState } from '../../renderer.js';
import {
  getColorFromPalette,
  getColorForPieChart,
  getPortfolioColor,
  getEuswCurveColor
} from '../../utils/colors.js';
import { createContribDrill, scheduleHideConcMenu } from './SummaryBreakdown.js';
import { enrichPortfolioRowsWithRisk } from '../portfolio/shared/portfolioRiskEnrichment.js';

// Drill-down fuer die Produkt-Yield-Scatter (Klick auf Bubble -> Position(en) des
// Produkts). Gleiche Engine wie die anderen Panels. Nur die 'var'-Schiene noetig.
const _perfDrillCfg = {
  detailId: 'perfProdDetail', titleId: 'perfProdDetailTitle',
  tableId: 'perfProdDetailTable', closeId: 'perfProdDetailClose',
  menuId: 'perfProdCardMenu', valueType: 'NAV', valueLabel: 'NAV',
  columns: [
    { key: 'PROD_ID', label: 'Product ID' },
    { key: 'DESCRIPTION', label: 'Description' },
    { key: 'RATINGres', label: 'Rating' },
    { key: 'NOTIONAL', label: 'Notional', align: 'right', fmt: 'num' },
    { key: 'NAV', label: 'NAV', align: 'right', fmt: 'num' },
    { key: '__YTM', label: 'Current yield', align: 'right', fmt: 'pctval' },
    { key: '__YTM_BUY', label: 'Yield (buy)', align: 'right', fmt: 'pctval' },
  ],
};
const perfDrill = createContribDrill({ var: _perfDrillCfg, es: _perfDrillCfg });
function perfProdStep(pid) {
  const s = String(pid ?? '').trim();
  return s ? { colKey: 'PROD_ID', value: s, label: 'Product' } : null;
}
function bindPerfCanvasLeave(canvas) {
  if (!canvas || canvas.dataset.perfLeaveBound) return;
  canvas.dataset.perfLeaveBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}
// Drill per RECHTSKLICK: unterdrueckt das native Kontextmenue und oeffnet – wenn
// auf einer Produkt-Bubble geklickt wurde – das Drill-Menue am Cursor. Rechtsklick
// auf den PORTFOLIO-Punkt (pink) listet ALLE Positionen in der Detail-Tabelle
// (dort per Spaltenkopf sortierbar, z.B. nach Yield). Liest die aktuelle
// Chart-Instanz zur Klickzeit, uebersteht also jedes Neuzeichnen.
function bindPerfContextDrill(canvas, targetId, showAllFallback = false) {
  if (!canvas || canvas.dataset.perfCtxBound) return;
  canvas.dataset.perfCtxBound = '1';
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    try {
      const chart = window[targetId + '_chartInstance'];
      if (!chart) return;
      const els = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || [];
      const el = els.find(x => {
        const ds = chart.data.datasets[x.datasetIndex];
        return ds?.isProduct || ds?.isPortfolio;
      });
      const ds = el ? chart.data.datasets[el.datasetIndex] : null;
      if (ds?.isProduct) { perfDrill.hover('var', { native: e }, [el], [perfProdStep(ds.label)]); return; }
      // Portfolio-Punkt getroffen ODER Rechtsklick irgendwo im Portfolio-Chart
      // (showAllFallback): alle Positionen listen — der kleine Punkt muss nicht
      // pixelgenau getroffen werden.
      if (ds?.isPortfolio || showAllFallback) {
        perfDrill.setData(buildPerfDrillRows());
        perfDrill.showAll('var');
        return;
      }
      scheduleHideConcMenu();
    } catch (err) { console.warn('[Perf] context drill failed', targetId, err); }
  });
}
// Zoom-Toolbar oben rechts in der .chart-box des Produkt-Charts: schnelle
// Maturity-Intervalle (1Y/5Y/10Y auf der X-Achse) + Reset Zoom.
// Idempotent (nur einmal erzeugt); liest die aktuelle Chart-Instanz zur Klickzeit,
// uebersteht also jedes Neuzeichnen.
function ensurePerfZoomResetButton(canvas, targetId) {
  const box = canvas?.parentElement;
  if (!box) return;
  if (getComputedStyle(box).position === 'static') box.style.position = 'relative';
  if (box.querySelector('.perf-zoom-tools')) return;

  const bar = document.createElement('div');
  bar.className = 'perf-zoom-tools';
  bar.style.cssText = 'position:absolute;top:4px;right:4px;z-index:5;display:flex;gap:3px;';

  const mkBtn = (label, title, onClick) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.title = title;
    b.style.cssText =
      'font-size:10px;padding:2px 7px;border:1px solid #cbd5e1;border-radius:4px;' +
      'background:#f8fafc;color:#334155;cursor:pointer;';
    b.addEventListener('click', onClick);
    return b;
  };

  // Schnelle Maturity-Intervalle: X-Achse auf [0, N] Jahre.
  [1, 5, 10].forEach((yrs) => {
    bar.appendChild(mkBtn(`${yrs}Y`, `Show 0–${yrs} years`, () => {
      try { window[targetId + '_chartInstance']?.zoomScale?.('x', { min: 0, max: yrs }, 'default'); } catch {}
    }));
  });

  bar.appendChild(mkBtn('Reset Zoom', 'Reset zoom', () => {
    try { window[targetId + '_chartInstance']?.resetZoom?.(); } catch {}
  }));

  box.appendChild(bar);
}
// Drill-Datenquelle: Positionen des gewaehlten Portfolios, angereichert mit den
// normalisierten Yields (current + buy) in Prozent.
function buildPerfDrillRows() {
  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();
  const norm = (raw) => { let v = parseNumberLike(raw); if (Number.isFinite(v) && Math.abs(v) <= 1) v = v * 100; return Number.isFinite(v) ? v : null; };
  return (appState.getAllPortfolioData?.() || [])
    .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === port)
    .map(r => ({ ...r, __YTM: norm(r.ytm ?? r.YTM), __YTM_BUY: norm(r.ytm_BUY ?? r.YTM_BUY ?? r.ytm ?? r.YTM) }));
}


let lastSummaryYieldArgs = null;
let summaryYieldRatesListenerBound = false;
let summaryYieldRefreshTimer = null;

// Gewählte historische Kurve für die Performance-Charts (Wert = Options-Key).
let _yieldSel = 'y5';            // Default: 5 Years Back
let _yieldYearsBackBound = false;

let _yieldBasis = 'buy';         // Yield-Basis: 'buy' = Kaufpreis (Default), 'act' = aktuell
let _yieldBasisBound = false;

// Mögliche Vergleichszeiträume (Monate + Jahre) als Handelstage zurück
// (~21 Tage/Monat, 252 Tage/Jahr), gefiltert nach verfügbarer Historie.
// Zahl aus "€"/"%"/"," bereinigt parsen. Modul-Ebene, damit sie ueberall
// (auch in chosenYtmPct ausserhalb des Chart-if-Blocks) im Scope ist.
function parseNumberLike(value) {
  if (typeof value === 'number') return value;
  return parseFloat(
    String(value ?? '')
      .replace(/€/g, '')
      .replace(/,/g, '')
      .replace(/%/g, '')
      .trim()
  );
}

function buildYieldHistoryOptions(tsLen) {
  const opts = [
    { value: 'm1', days: 21,  label: '1 Month Back'  },
    { value: 'm3', days: 63,  label: '3 Months Back' },
    { value: 'm6', days: 126, label: '6 Months Back' },
  ];
  const maxYears = Math.min(15, Math.max(1, Math.floor((tsLen - 1) / 252)));
  for (let y = 1; y <= maxYears; y++) {
    opts.push({ value: `y${y}`, days: 252 * y, label: `${y} Year${y > 1 ? 's' : ''} Back` });
  }
  // nur Optionen, für die genug Historie vorhanden ist
  return opts.filter(o => o.days <= tsLen - 1);
}

// Befüllt das "Historical curve"-Dropdown und re-rendert die Charts bei Auswahl.
function setupYieldYearsBackDropdown(options) {
  const sel = document.getElementById('yieldYearsBackSelect');
  if (!sel) return;

  // Optionen nur neu aufbauen, wenn sich die Liste geändert hat.
  const sig = options.map(o => o.value).join(',');
  if (sel.dataset.sig !== sig) {
    sel.dataset.sig = sig;
    sel.innerHTML = '';
    for (const o of options) {
      const opt = document.createElement('option');
      opt.value = o.value;
      opt.textContent = o.label;
      sel.appendChild(opt);
    }
  }

  // Auswahl validieren (fällt auf 5 Jahre bzw. letzte verfügbare zurück).
  if (!options.some(o => o.value === _yieldSel)) {
    _yieldSel = options.some(o => o.value === 'y5') ? 'y5' : (options[options.length - 1]?.value || 'm1');
  }
  sel.value = _yieldSel;

  if (!_yieldYearsBackBound) {
    _yieldYearsBackBound = true;
    sel.addEventListener('change', () => {
      _yieldSel = sel.value;
      if (lastSummaryYieldArgs) {
        handleSummaryYieldData(
          lastSummaryYieldArgs.filteredData,
          lastSummaryYieldArgs.index,
          lastSummaryYieldArgs.port_name
        );
      }
    });
  }
}

function setupYieldBasisDropdown() {
  const sel = document.getElementById('yieldBasisSelect');
  if (!sel) return;

  // Wert mit dem Modul-State synchronisieren (Default: 'buy' = Kaufpreis).
  if (sel.value !== _yieldBasis) sel.value = _yieldBasis;

  if (!_yieldBasisBound) {
    _yieldBasisBound = true;
    sel.addEventListener('change', () => {
      _yieldBasis = sel.value === 'act' ? 'act' : 'buy';
      if (lastSummaryYieldArgs) {
        handleSummaryYieldData(
          lastSummaryYieldArgs.filteredData,
          lastSummaryYieldArgs.index,
          lastSummaryYieldArgs.port_name
        );
      }
    });
  }
}

function bindSummaryYieldRatesRefresh() {
  if (summaryYieldRatesListenerBound) return;
  summaryYieldRatesListenerBound = true;

  const refresh = () => {
    if (!lastSummaryYieldArgs) return;

    clearTimeout(summaryYieldRefreshTimer);

    summaryYieldRefreshTimer = setTimeout(() => {
      handleSummaryYieldData(
        lastSummaryYieldArgs.filteredData,
        lastSummaryYieldArgs.index,
        lastSummaryYieldArgs.port_name
      );
    }, 50);
  };

  document.addEventListener('rates:active-data:ready', refresh);
  document.addEventListener('rates:scenario-data:ready', refresh);
  document.addEventListener('interestRates:updated', refresh);
  document.addEventListener('theme:changed', refresh); // Farben theme-aware neu zeichnen
}


export function handleSummaryYieldData(filteredData, index, port_name) {
  lastSummaryYieldArgs = { filteredData, index, port_name };
  bindSummaryYieldRatesRefresh();

  console.log('[SUMMARY YIELD CALLED]', {
    index,
    port_name,
    filteredRows: Array.isArray(filteredData) ? filteredData.length : null,
  });

  const elementId = `portDataContainer${0}`;


  
  // =========================
  // DATA
  // =========================
const portfolioData = appState.getPortAggData(elementId) || {};

// KPI-Band oben im Panel: aktueller Portfolio-Yield (formPortYieldA), Yield bei Kauf
// (formPortYield) und Differenz in Basispunkten. Beide Felder liegen als "x%"-Strings vor.
(() => {
  const _pctNum = (s) => {
    let v = parseNumberLike(s);
    if (Number.isFinite(v) && Math.abs(v) <= 1) v = v * 100; // dezimal -> Prozent
    return Number.isFinite(v) ? v : null;
  };
  const _set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const cur = _pctNum(portfolioData.formPortYieldA ?? portfolioData.formPortYield);
  const buy = _pctNum(portfolioData.formPortYield);
  _set('yieldKpiCurrent', cur == null ? '–' : `${cur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`);
  _set('yieldKpiBuy',     buy == null ? '–' : `${buy.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`);
  _set('yieldKpiDelta', (cur != null && buy != null)
    ? `${cur - buy >= 0 ? '+' : ''}${Math.round((cur - buy) * 100)} bp`
    : '–');

  // TtM (Restlaufzeit in Jahren) + IR-Duration (Jahre = abs(PV01)/NAV×10000, wie im
  // Overview-Slider). Beide auf Portfolio-Ebene aus portAgg.
  const _num = (s) => { const v = parseNumberLike(s); return Number.isFinite(v) ? v : null; };
  const ttm  = _num(portfolioData.formPortTtM);
  // IR Duration EXAKT wie Overview-Slider & Sensitivities-Panel: aus den Risk-
  // angereicherten Zeilen (PV01_BASE), NICHT aus der Holdings-Spalte PV01 /
  // formPortPV01(abs) — die haben eine andere Basis und ergeben einen falschen Wert.
  //   IR Duration (Jahre) = |Σ PV01_BASE| / Σ NAV × 10000
  let dur = null;
  try {
    const _pn = port_name || appState.getSelectedPortTableName?.() || '';
    const _normP = (s) => String(s ?? '').replace(/^Portfolios[_-]?/i, '').trim().toUpperCase();
    const _p = _normP(_pn);
    const _rows = (appState.getAllPortfolioData?.() || []).filter(r => _normP(r?.port_name) === _p);
    const _enr = enrichPortfolioRowsWithRisk(_rows, _pn);
    let _pv01Base = 0, _navSum = 0;
    for (const r of _enr) { _pv01Base += Number(r.PV01_BASE) || 0; _navSum += (_num(r.NAV) || 0); }
    dur = _navSum ? Math.abs(_pv01Base) / _navSum * 10000 : null;
  } catch (e) { console.warn('[Yield KPI] IR-Duration-Berechnung fehlgeschlagen', e); }
  _set('yieldKpiTtm',      ttm == null ? '–' : `${ttm.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Y`);
  _set('yieldKpiDuration', dur == null ? '–' : `${dur.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Y`);

  // KPI 1 (Portfolio Yield current) und 3 (Δ vs buy) ausblenden — angezeigt bleiben nur
  // "Portfolio Yield (at buy)", "Time to maturity (Ø)" und "IR duration".
  ['yieldKpiCurrent', 'yieldKpiDelta'].forEach(id => {
    const tile = document.getElementById(id)?.closest('.conc-kpi');
    if (tile) tile.style.display = 'none';
  });

  // Report-Spiegel: die 3 sichtbaren KPIs als data-kpi-band-Tabelle fuer Preview/PDF.
  const _ykTbl = document.getElementById('yieldKpiTable');
  if (_ykTbl) {
    const _fmt = (v, unit) => (v == null ? '–' : `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unit}`);
    const _escK = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const _rows = [
      ['Portfolio Yield (at buy)', _fmt(buy, '%')],
      ['Time to maturity (Ø)',     _fmt(ttm, 'Y')],
      ['IR duration',              _fmt(dur, 'Y')],
    ];
    _ykTbl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      _rows.map(([k, v]) => `<tr><td>${_escK(k)}</td><td>${_escK(v)}</td></tr>`).join('')
    }</tbody></table>`;
  }
})();

const currency = 'EUR';
const curveId = 'EUR:SWAP:6M';

const rawBaseRates = appState._RATESDataCacheByCcy?.[currency] || [];
const rawScenarioRates = appState.getRatesScenarioData?.() || [];
const rawTSData = appState.getTblTSData();

  // =========================
  // ACTIVE SCENARIO
  // =========================
  const activeRow = (appState.getRatesActive() || [])
    .filter(r => r.ccy === currency && r.curve_id === curveId)
    .sort((a, b) =>
      new Date(b.activated_at) - new Date(a.activated_at)
    )[0];

  const activeScenario = activeRow?.scenario_id || 'BASE';

console.log('[YIELD CHART RATE SOURCES CHECK]', {
  activeScenario,
  curveId,
  baseRows: rawBaseRates.length,
  scenarioRows: rawScenarioRates.length,
  baseScenarios: Array.from(new Set(rawBaseRates.map(r => r.scenario_id || 'BASE'))),
  scenarioScenarios: Array.from(new Set(rawScenarioRates.map(r => r.scenario_id || r.scenario_name || 'BASE'))),
  scenarioCurveIds: Array.from(new Set(rawScenarioRates.map(r => r.curve_id))),
  sampleScenario6M: rawScenarioRates
    .filter(r => String(r.curve_id || '').trim() === curveId)
    .slice(0, 5),
});

  // =========================
  // RATES → FILTER + DEDUP + TRANSFORM
  // =========================


// BASE lives in rawBaseRates.
// Scenario curves like FLAT_3% live in rawScenarioRates.
const sourceRates =
  activeScenario === 'BASE'
    ? rawBaseRates
    : rawScenarioRates;

let filteredRates = sourceRates.filter(r =>
  String(r.ccy || '').trim() === String(currency).trim() &&
  String(r.curve_id || '').trim() === String(curveId).trim() &&
  String(r.scenario_id || r.scenario_name || 'BASE').trim() === String(activeScenario).trim()
);

if (!filteredRates.length) {
  console.warn('[YIELD CHART] No rates for active scenario/curve. Chart skipped.', {
    activeScenario,
    curveId,
    sourceRatesRows: sourceRates.length,
    baseRows: rawBaseRates.length,
    scenarioRows: rawScenarioRates.length,
    availableCurveIds: Array.from(new Set(sourceRates.map(r => r.curve_id))),
    availableScenarios: Array.from(new Set(sourceRates.map(r => r.scenario_id || r.scenario_name || 'BASE'))),
    sampleForCurve: sourceRates
      .filter(r => String(r.curve_id || '').trim() === String(curveId).trim())
      .slice(0, 10),
  });

  return;
}

  const dedupedRates = Object.values(
    filteredRates.reduce((acc, r) => {
      const key = r.tenor;
      acc[key] = r;
      return acc;
    }, {})
  );

const EUSWData = dedupedRates.map(r => {
  const rawRate = r.rate ?? r.value ?? r.RATES ?? r.VALUE;

  let n = parseFloat(
    String(rawRate ?? '')
      .replace('%', '')
      .replace(',', '.')
      .trim()
  );

  if (!Number.isFinite(n)) return null;

  // If rate is stored as decimal, e.g. 0.03, convert to percent 3.00
  if (Math.abs(n) <= 1) {
    n = n * 100;
  }

  return {
    YEAR: r.tenor ?? r.YEAR,
    RATES: `${n}%`
  };
}).filter(Boolean);

console.log('[SUMMARY YIELD ACTIVE CURVE FINAL]', {
  currency,
  curveId,
  activeScenario,
  filteredRatesRows: filteredRates.length,
  EUSWDataRows: EUSWData.length,
  EUSWDataFirst10: EUSWData.slice(0, 10),
});

  // =========================
  // TS DATA (optional gefiltert)
  // =========================
  const TSData = (rawTSData || []).filter(r =>
    !r.scenario_id || r.scenario_id === activeScenario
  );

  const latestRow = TSData[TSData.length - 1];

  // Historische Kurve: wählbar über das Dropdown (Monate/Jahre zurück).
  const histOptions = buildYieldHistoryOptions(TSData.length);
  setupYieldYearsBackDropdown(histOptions);
  setupYieldBasisDropdown();

  // Yield-Basis-abhaengiger Wert je Produkt: 'buy' = Kaufpreis (ytm_BUY, Fallback ytm),
  // 'act' = aktueller Yield (ytm). Rueckgabe in % (×100 falls dezimal).
  const chosenYtmPct = (entry) => {
    const raw = (_yieldBasis === 'act')
      ? (entry?.ytm ?? entry?.YTM)
      : (entry?.ytm_BUY ?? entry?.YTM_BUY ?? entry?.ytm ?? entry?.YTM);
    let v = parseNumberLike(raw);
    if (Number.isFinite(v) && Math.abs(v) <= 1) v = v * 100;
    return v;
  };
  const selOpt =
    histOptions.find(o => o.value === _yieldSel) ||
    histOptions[histOptions.length - 1] ||
    { days: 252 * 5, label: '5 Years Back' };
  const pastIdx = TSData.length - 1 - selOpt.days;
  const pastRow = pastIdx >= 0 ? TSData[pastIdx] : undefined;
  // Kurzform fuer die Legende: "5 Years Back" -> "5Y Back", "6 Months Back" -> "6M Back"
  const shortBack = String(selOpt.label || '')
    .replace(/\s*Years?\b/i, 'Y')
    .replace(/\s*Months?\b/i, 'M');
  const pastLabel = `EU ${shortBack}`;

  const yieldCurve = transformTSDataToEUSWFormat(latestRow);
  const pastYieldCurve = transformTSDataToEUSWFormat(pastRow);

  // =========================
  // PORTFOLIO
  // =========================
  const portfolioYield = (_yieldBasis === 'act')
    ? (portfolioData.formPortYieldA ?? portfolioData.formPortYield)
    : portfolioData.formPortYield;
  const portTtM = parseFloat(portfolioData.formPortTtM);

  console.log('[YIELD CHART GATE]', {
  portfolioYield,
  portTtM,
  baseRatesRows: rawBaseRates?.length,
  scenarioRatesRows: rawScenarioRates?.length,
  sourceRatesRows: sourceRates?.length,
  activeScenario,
  filteredRatesRows: filteredRates?.length,
  EUSWDataRows: EUSWData?.length,
  rawTSRows: rawTSData?.length,
  TSDataRows: TSData?.length,
  latestRowExists: !!latestRow,
  yieldCurveRows: yieldCurve?.length,
  filteredDataRows: filteredData?.length,
});


  if (portfolioYield && Array.isArray(EUSWData) && EUSWData.length > 0) {

    insertHeadingIntoExistingChartBox({ canvasId: 'euswapPortfolioYieldChart', title: 'Portfolio Yield vs reference curve', subtitle: 'Maturity' });
    insertHeadingIntoExistingChartBox({ canvasId: 'euswapProductYieldChart', title: 'Product Yield vs reference curve', subtitle: 'Maturity' });
    insertHeadingIntoExistingChartBox({ canvasId: 'durationSwapChart', title: 'Portfolio Yield vs reference curve', subtitle: 'Duration' });
    insertHeadingIntoExistingChartBox({ canvasId: 'durationProductYieldChart', title: 'Product Yield vs reference curve', subtitle: 'Duration' });

    // =========================
    // 1) Portfolio vs Maturity
    // =========================
const sharedXMax = drawYieldVsTimeChart({
  targetId: 'euswapPortfolioYieldChart',
  heading: 'Portfolio Yield vs Maturity',
  yieldCurve: EUSWData,
  pastYieldCurve,
  pastLabel,
  euswDataOriginal: [],
  points: [{ x: portTtM, y: parseFloat(portfolioYield.replace('%', '')) }],
  ctxDrill: perfDrill
});

    // =========================
    // 2) Products vs Maturity
    // =========================
const productMaturityPoints = (filteredData || []).map(e => ({
  x: parseNumberLike(e.TtM),
  y: chosenYtmPct(e),
  PROD_ID: e.PROD_ID,
})).filter(p => Number.isFinite(p.x) && Number.isFinite(p.y));

// Drill-Datenquelle (Positionen + Yields) fuer beide Produkt-Scatter setzen.
try { perfDrill.setData(buildPerfDrillRows()); } catch (e) { console.warn('[Perf] drill data failed', e); }

drawYieldVsTimeChart({
  targetId: 'euswapProductYieldChart',
  heading: 'Product Yields vs Maturity',
  yieldCurve: EUSWData,
  pastYieldCurve,
  pastLabel,
  euswDataOriginal: [],
  points: productMaturityPoints,
  xMaxOverride: sharedXMax,
  drill: perfDrill
});

    // =========================
    // Duration curves
    // =========================
const durationCurve = EUSWData.map(swapPointToDurationAsYearRate).filter(Boolean);
const durationCurvePast = pastYieldCurve.map(swapPointToDurationAsYearRate).filter(Boolean);
const durationEUSWData = [];

    let chartSection = document.getElementById('yieldChartSection');
    let durationSection = document.getElementById('durationChartSection');

    if (!durationSection) {
      durationSection = document.createElement('div');
      durationSection.id = 'durationChartSection';
      durationSection.style.marginTop = '40px';
      chartSection.parentElement.appendChild(durationSection);
    }

    const portfolioDuration = Math.abs(parseFloat(portfolioData.formPortPV01));
    const portfolioYieldValue = parseFloat(portfolioYield.replace('%', ''));

    const durationPoints = (!isNaN(portfolioDuration) && !isNaN(portfolioYieldValue)) ? [{
      x: portfolioDuration,
      y: portfolioYieldValue
    }] : [];

    // =========================
    // 3) Portfolio vs Duration
    // =========================
    drawYieldVsTimeChart({
      targetId: 'durationSwapChart',
      heading: 'Portfolio Yield vs Duration',
      yieldCurve: durationCurve,
      pastYieldCurve: durationCurvePast,
      pastLabel,
      euswDataOriginal: durationEUSWData,
      points: durationPoints,
      xMaxOverride: sharedXMax,
      ctxDrill: perfDrill
    });

    // =========================
    // Product Duration Points
    // =========================
const productDurationPoints = filteredData.map(entry => {
  let ytm = chosenYtmPct(entry);

let duration = parseNumberLike(entry.IR_DURATION);

console.log('[SUMMARY YIELD PRODUCT IR_DURATION]', {
  TRADE_ID: entry.TRADE_ID,
  PROD_ID: entry.PROD_ID,
  IR_DURATION_raw: entry.IR_DURATION,
  PV01_TOTAL_BASE: entry.PV01_TOTAL_BASE,
  NAV: entry.NAV,
  parsed_duration: duration,
  ytm,
});

if (!Number.isFinite(duration) || !Number.isFinite(ytm)) {
  console.log('[SUMMARY YIELD PRODUCT SKIPPED]', {
    TRADE_ID: entry.TRADE_ID,
    PROD_ID: entry.PROD_ID,
    IR_DURATION: entry.IR_DURATION,
    PV01_TOTAL_BASE: entry.PV01_TOTAL_BASE,
    NAV: entry.NAV,
    ytm,
    keys: Object.keys(entry),
  });

  return null;
}

return {
  x: Math.abs(duration),
  y: ytm,
  PROD_ID: entry.PROD_ID
};







}).filter(Boolean);

console.log('[PRODUCT DURATION POINTS CHECK]', {
  filteredRows: filteredData.length,
  productDurationPointsRows: productDurationPoints.length,
  samplePoints: productDurationPoints.slice(0, 10),
});


    let durationProductSection = document.getElementById('durationProductChartSection');
    if (!durationProductSection) {
      durationProductSection = document.createElement('div');
      durationProductSection.id = 'durationProductChartSection';
      durationProductSection.style.marginTop = '40px';
      chartSection.parentElement.appendChild(durationProductSection);
    }

    // =========================
    // 4) Products vs Duration
    // =========================
    drawYieldVsTimeChart({
      targetId: 'durationProductYieldChart',
      heading: 'Product Yields vs Duration',
      yieldCurve: durationCurve,
      pastYieldCurve: durationCurvePast,
      pastLabel,
      xMaxOverride: sharedXMax,
      euswDataOriginal: durationEUSWData,
      points: productDurationPoints,
      drill: perfDrill
    });
  }
}

export function drawYieldVsTimeChart({
  targetId = 'euswapYieldChart',
  heading = 'Yield vs EU Yield Curve',
  yieldCurve = [],
  pastYieldCurve = [],
  pastLabel = 'EU Yield Curve 5 Years Back', // Label der historischen Kurve (wählbar)
  euswDataOriginal = [],
  points = [], // entweder Array {x,y} ODER EintrÃ¤ge mit .TtM/.ytm
  xMaxOverride = null, // gemeinsame x-Achsen-Skalierung (von Chart 1 vorgegeben)
  drill = null, // createContribDrill-Instanz: macht die Produkt-Bubbles klickbar
  ctxDrill = null, // nur Rechtsklick-Drill binden (Portfolio-Punkt), ohne Zoom-Toolbar
}) {
  let canvas = document.getElementById(targetId);

  // passender Container
  const targetContainerId =
    targetId === 'durationSwapChart' || targetId === 'durationProductYieldChart'
      ? 'durationChartSection'
      : 'yieldChartSection';

  let container = document.getElementById(targetContainerId);

  // Container notfalls anlegen
  if (!container) {
    container = document.createElement('div');
    container.id = targetContainerId;
    container.style.marginTop = '40px';
    document.body.appendChild(container);
  }

  // Canvas notfalls anlegen
  if (!canvas) {
    const headingElem = document.createElement('h3');
    headingElem.textContent = heading;

    const chartCanvas = document.createElement('canvas');
    chartCanvas.id = targetId;
    chartCanvas.className = 'lineChart';
    chartCanvas.style.maxWidth = '600px';
    chartCanvas.style.height = '190px';

    container.appendChild(headingElem);
    container.appendChild(chartCanvas);
    canvas = chartCanvas;
  }

  const ctx = setupHiDPICanvas(canvas, 600, 190, true); // true = an tatsächliche Anzeigegröße anpassen (Tooltip-Koordinaten)

  if (drill || ctxDrill) { bindPerfCanvasLeave(canvas); bindPerfContextDrill(canvas, targetId, !drill && !!ctxDrill); }

  // Vorherigen Chart zerstÃ¶ren
  if (window[targetId + '_chartInstance']) {
    window[targetId + '_chartInstance'].destroy();
  }

  // ---- Parsing ----
  const parsePoints = (data) =>
    (Array.isArray(data) ? data : []).map(p => {
      const x = parseFloat(String(p.YEAR ?? '').replace('Y', ''));
      const y = parseFloat(String(p.RATES ?? '').replace('%', ''));
      return (Number.isFinite(x) && Number.isFinite(y)) ? { x, y } : null;
    }).filter(Boolean);

  const euswPoints     = parsePoints(yieldCurve);
  const pastPoints     = parsePoints(pastYieldCurve);
  const originalPoints = parsePoints(euswDataOriginal);

  // Produktpunkte (Scatter-DatensÃ¤tze oder einzelner Portfolio-Punkt)
  const isSinglePoint =
    points.length === 1 &&
    points[0] &&
    ('x' in points[0]) && ('y' in points[0]) &&
    !('TtM' in points[0]) && !('ytm' in points[0]) &&
    !('PROD_ID' in points[0]); // wenn PROD_ID da ist: KEIN Portfolio-Point

  const portfolioPoint = isSinglePoint ? points[0] : null;

  // Farb-Index-Plan: Produkte sollen nicht mit semantischen Farben kollidieren
  const COLOR_IDX = {
    swap: 2,
    productStart: 4,
  };

  const productDatasets = !isSinglePoint
    ? points.map((entry, index) => {
        const x = entry.x ?? parseFloat(entry.TtM);
        const y = entry.y ?? (typeof entry.ytm === 'number' ? entry.ytm * 100 : parseFloat(entry.ytm));
        if (!Number.isFinite(x) || !Number.isFinite(y)) return null;

        const c = getColorForPieChart(COLOR_IDX.productStart + index); // {backgroundColor, borderColor}
        return {
          label: entry.PROD_ID || `Produkt ${index + 1}`,
          type: 'scatter',
          data: [{ x, y }],
          backgroundColor: c.backgroundColor,
          borderColor: c.borderColor,
          borderWidth: 1,
          pointRadius: 5,
          pointHoverRadius: 7,
          isProduct: true,
          order: 1, // Punkte über den Kurven (niedrigerer order = oben)
        };
      }).filter(Boolean)
    : [];

  // ---- Datasets nur hinzufÃ¼gen, wenn data.length > 0 ----
  const datasets = [];

  // Semantische Farben: EU Yield Curve (blau) + Portfolio (pink)
  const euswSolid = getEuswCurveColor(1);
  const euswFill  = getEuswCurveColor(0.2);

  // EU Yield Curve (blau, solid)
  if (euswPoints.length) {
    datasets.push({
      label: 'EUR Swap Curve',
      data: euswPoints,
      showLine: true,
      borderColor: euswSolid.borderColor,
      backgroundColor: euswFill.backgroundColor,
      pointBackgroundColor: euswSolid.borderColor,
      pointBorderColor: euswSolid.borderColor,
      tension: 0.3,
      pointRadius: 3,
      order: 3 // Kurven hinter den Punkten (höherer order = unten)
    });
  }

  // EU Yield Curve 5 Years Back (gleiches Blau, gestrichelt)
  // Ja: geht exakt so mit borderDash
  if (pastPoints.length) {
    // Gestrichelte Vergleichskurve: fein + grau, Punkte in derselben Farbe (voll gefuellt).
    const dashGrey = 'rgba(148,150,158,0.9)';
    datasets.push({
      label: pastLabel,
      data: pastPoints,
      showLine: true,
      borderColor: dashGrey,
      backgroundColor: dashGrey,
      pointBackgroundColor: dashGrey,
      pointBorderColor: dashGrey,
      borderDash: [3, 3],
      borderWidth: 1,
      tension: 0.3,
      pointRadius: 2.5,
      order: 3 // Kurven hinter den Punkten
    });
  }
  

  const SHOW_SWAP = false;
  // EU Swap (bleibt indexbasiert aus Palette)
  if (SHOW_SWAP && originalPoints.length) {
    datasets.push({
      label: 'EU Swap',
      data: originalPoints,
      showLine: true,
      borderColor: getColorFromPalette(COLOR_IDX.swap, 1),
      backgroundColor: getColorFromPalette(COLOR_IDX.swap, 0.2),
      borderDash: [2, 4],
      tension: 0.3,
      pointRadius: 3,
      order: 3 // Kurven hinter den Punkten
    });
  }

 

  // Produkt-Scatter
  datasets.push(...productDatasets);

  // Portfolio-Einzelpunkt (GARMIN-PINK)
  if (portfolioPoint && Number.isFinite(portfolioPoint.x) && Number.isFinite(portfolioPoint.y)) {
    const pCol = getPortfolioColor(1);

    datasets.push({
      label: 'Portfolio Yield',
      type: 'scatter',
      pointStyle: 'circle',
      data: [portfolioPoint],
      backgroundColor: pCol.backgroundColor,
      borderColor: pCol.borderColor,
      borderWidth: 0,
      pointRadius: 8,
      pointHoverRadius: 10,
      isPortfolio: true, // Rechtsklick -> alle Positionen (bindPerfContextDrill)
      order: 0 // Portfolio-Punkt ganz oben (niedrigster order = oberste Ebene)
    });
  }

  // ---- Achsen-Skalierung robust berechnen ----
  const xVals = [
    ...euswPoints.map(p => p.x),
    ...originalPoints.map(p => p.x),
    ...pastPoints.map(p => p.x),
    ...productDatasets.flatMap(d => d.data.map(p => p.x)),
    ...(portfolioPoint ? [portfolioPoint.x] : [])
  ].filter(Number.isFinite);

  const yVals = [
    ...euswPoints.map(p => p.y),
    ...originalPoints.map(p => p.y),
    ...pastPoints.map(p => p.y),
    ...productDatasets.flatMap(d => d.data.map(p => p.y)),
    ...(portfolioPoint ? [portfolioPoint.y] : [])
  ].filter(Number.isFinite);

  const xMax = xVals.length ? Math.max(...xVals) : 10;
  const yMax = yVals.length ? Math.max(...yVals) : 5;
  const yMin = yVals.length ? Math.min(...yVals) : 0;

  // Puffer um den Datenbereich, damit Kurve/Punkte nicht am oberen/unteren Rand
  // kleben (z. B. EU Yield Curve am Top), sondern mittiger im Chart liegen.
  const yRange = (yMax - yMin) || 1;
  const yPad = Math.max(0.5, yRange * 0.18);

  // ---- Legend anzeigen? Nur wenn es mind. ein Dataset mit Daten gibt ----
  const showLegend = datasets.some(ds => Array.isArray(ds.data) && ds.data.length > 0);

  // Achsentitel je Chart-Typ: Maturity- vs Duration-Varianten (englisch, wie Zielbild).
  const isDurationChart = /duration/i.test(targetId);
  const xAxisTitle = isDurationChart ? 'Duration (years)' : 'Time to maturity (years)';

  // Render
  window[targetId + '_chartInstance'] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: false,
      maintainAspectRatio: false,

      // Produkt-Bubbles interaktiv: Der Drill wird per RECHTSKLICK ausgeloest
      // (siehe bindPerfContextDrill). Kein Hover-Pop / Linksklick-Drill, damit
      // normales Ziehen (Zoom) und Hovern das Menue nicht ungewollt oeffnen.

      // Tooltip NUR in der Nähe eines Punktes (intersect:true → nicht überall).
      // axis:'xy' ist entscheidend: "nearest" wird in 2D (x UND y) berechnet, so
      // dass beim Draufstehen genau dieser Punkt gewählt wird statt des
      // x-nächsten Nachbarn (Default ohne axis ist oft nur 'x').
      interaction: {
        mode: 'nearest',
        intersect: true,
        axis: 'xy'
      },
      hover: {
        mode: 'nearest',
        intersect: true,
        axis: 'xy'
      },

      // âœ… Punkte leichter treffen (ohne anderes Verhalten zu Ã¤ndern)
      elements: {
        point: {
          hitRadius: 8,
          hoverRadius: 7
        }
      },

      scales: {
        x: {
          type: 'linear',
          title: { display: true, text: xAxisTitle, align: 'end', font: { size: 11 } },
          grid: { borderDash: [2, 3], color: 'rgba(128,128,128,0.14)', lineWidth: 1 },
          ticks: { font: { size: 11 } },
          min: 0,
          max: Math.min(20, (Number.isFinite(xMaxOverride) ? xMaxOverride : xMax + 1))
        },
        y: {
          title: { display: true, text: 'Yield p.a.', font: { size: 11 } },
          grid: { borderDash: [2, 3], color: 'rgba(128,128,128,0.14)', lineWidth: 1 },
          ticks: {
            font: { size: 11 },
            callback: val => `${Number(val).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`
          },
          min: Math.floor(yMin - yPad),
          max: Math.ceil(yMax + yPad)
        }
      },

      plugins: {
        title: {
          display: false,
          text: heading,
          font: { size: 16, weight: 'bold' },
          color: '#fff',
          padding: { top: 10, bottom: 15 }
        },

        legend: {
          display: showLegend,
          position: 'bottom',
          align: 'center',
          labels: {
            usePointStyle: true,   // Marker je Dataset via pointStyle (Punkt vs. Linie)
            font: { size: 10 },
            boxWidth: 18,
            boxHeight: 10,
            padding: 14,
            // Marker je Dataset: Kurven als (ggf. gestrichelte) Linie, Portfolio als Punkt.
            // Entkoppelt vom On-Chart-pointStyle (dort sollen es gefuellte Kreise sein).
            generateLabels: (chart) => {
              const base = Chart.defaults.plugins.legend.labels.generateLabels(chart);
              base.forEach(item => {
                const ds = chart.data.datasets[item.datasetIndex];
                if (!ds) return;
                if (ds.isPortfolio || ds.label === 'Portfolio Yield') {
                  item.pointStyle = 'circle';
                } else if (ds.showLine) {
                  item.pointStyle = 'line';
                  item.lineWidth = ds.borderWidth ?? 2;
                  item.lineDash = ds.borderDash || [];
                }
              });
              return base;
            },
            filter: (legendItem, data) => {
              const ds = data.datasets?.[legendItem.datasetIndex];
              if (!ds || !Array.isArray(ds.data) || ds.data.length === 0) return false;

              const productCount = (data.datasets || []).filter(d => d && d.isProduct).length;
              if (ds.isProduct && productCount > 1) return false;

              return true;
            }
          }
        },

        tooltip: {
          callbacks: {
            label: context =>
              context.dataset.label === 'Portfolio Yield'
                ? `Portfolio Yield: ${context.raw.y.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% at ${context.raw.x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}Y`
                : `${context.dataset.label}: ${context.raw.y.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% at ${context.raw.x.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}Y`
          },
          bodyFont: { size: 13 }
        },

        // Portfolio-Punkt beschriften (nur bei Einzelpunkt) — Label rechts neben dem
        // Punkt, wie im Zielbild ("Portfolio X,X%"). chartjs-plugin-annotation ist global geladen.
        annotation: (portfolioPoint && Number.isFinite(portfolioPoint.x) && Number.isFinite(portfolioPoint.y)) ? {
          annotations: {
            portfolioLabel: {
              type: 'label',
              xValue: portfolioPoint.x,
              yValue: portfolioPoint.y,
              content: [`Portfolio ${Number(portfolioPoint.y).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%`],
              color: getPortfolioColor(1).borderColor,
              font: { size: 12, weight: 'bold' },
              position: 'center',
              xAdjust: 72,
              backgroundColor: 'transparent',
            }
          }
        } : undefined,

        // Zoom nur auf den interaktiven Produkt-Charts (chartjs-plugin-zoom, global geladen).
        // Normales Ziehen = Rechteck-Auswahl (Intervall), Wheel = Zoom, Ctrl+Drag = verschieben.
        zoom: drill ? {
          pan:  { enabled: true, mode: 'xy', modifierKey: 'ctrl' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            drag:  {
              enabled: true,
              backgroundColor: 'rgba(75,150,225,0.15)',
              borderColor: 'rgba(75,150,225,0.6)',
              borderWidth: 1,
            },
            mode: 'xy', // Scatter: in X UND Y zoomen
          },
        } : undefined
      }
    }
  });

  // Reset-Zoom-Button (nur interaktive Produkt-Charts).
  if (drill) ensurePerfZoomResetButton(canvas, targetId);

  // Effektiver x-Achsen-Max zurueckgeben, damit alle Charts dieselbe Skalierung
  // (die von Chart 1) uebernehmen koennen.
  return Number.isFinite(xMaxOverride) ? xMaxOverride : (xMax + 1);
}


      /**
       * Setzt ein Canvas fÃ¼r HiDPI-Rendering mit einheitlicher GrÃ¶ÃŸe auf.
       * @param {HTMLCanvasElement} canvas - Das Canvas-Element
       * @param {number} widthPx - Sichtbare Breite in Pixel (z.â€¯B. 600)
       * @param {number} heightPx - Sichtbare HÃ¶he in Pixel (z.â€¯B. 300)
       */
      export function setupHiDPICanvas(canvas, widthPx, heightPx, useActualSize = false) {
        const dpr = window.devicePixelRatio || 2;

        let w = widthPx, h = heightPx;

        // useActualSize: die TATSÄCHLICHE Anzeigegröße verwenden. Nötig wenn CSS
        // die Canvas-Größe erzwingt (width:100% !important / height per !important).
        // Weicht der Logikraum (z. B. 600×400) von der Darstellung ab, stimmen
        // Maus- und Zeichen-Koordinaten nicht überein → Tooltip-Offset (man muss
        // neben den Punkt zeigen). Fällt auf die übergebenen Maße zurück, falls
        // (noch) nicht im Layout.
        if (useActualSize) {
          const rect = canvas.getBoundingClientRect();
          w = Math.round(rect.width)  || widthPx;
          h = Math.round(rect.height) || heightPx;
        }

        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = `${w}px`;
        canvas.style.height = `${h}px`;

        const ctx = canvas.getContext('2d');
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

        return ctx;
      }

      // export function transformTSDataToEUSWFormat(tsRow) {
      // const maturityMap = {
      //     EU_1Y: '1Y',
      //     EU_5Y: '5Y',
      //     EU_10Y: '10Y',
      //     EU_20Y: '20Y'
      // };

      // return Object.entries(maturityMap)
      //     .map(([key, yearLabel]) => {
      //     const rawValue = tsRow[key];
      //     const cleanValue = rawValue?.trim();

      //     if (!cleanValue || isNaN(parseFloat(cleanValue))) return null;

      //     return {
      //         YEAR: yearLabel,
      //         RATES: cleanValue.includes('%') ? cleanValue : `${cleanValue}%`
      //     };
      //     })
      //     .filter(Boolean);
      // }
      export function transformTSDataToEUSWFormat(tsRow) {
  const maturityMap = {
    EU_1Y: '1Y',
    EU_5Y: '5Y',
    EU_10Y: '10Y',
    EU_20Y: '20Y'
  };

  return Object.entries(maturityMap)
    .map(([key, yearLabel]) => {
      const rawValue = tsRow[key];

      // âœ… rawValue kann jetzt number sein -> immer sicher zu String
      const cleanValue = String(rawValue ?? '').trim();

      if (!cleanValue || isNaN(parseFloat(cleanValue))) return null;

      return {
        YEAR: yearLabel,
        RATES: cleanValue.includes('%') ? cleanValue : `${cleanValue}%`
      };
    })
    .filter(Boolean);
}



      export function swapPointToDurationAsYearRate(point) {
        const T = parseFloat(point.YEAR?.replace('Y', ''));
        const r = parseFloat(point.RATES?.replace('%', '')) / 100;

        if (isNaN(T) || isNaN(r) || r === 0) return null;

        const duration = (1 - Math.pow(1 + r, -T)) / r;
        const rate = (r * 100).toFixed(2) + '%';

        return {
          YEAR: duration.toFixed(2) + 'Y',
          RATES: rate
        };
      }
      

function insertHeadingIntoExistingChartBox({ canvasId, title, subtitle }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const chartBox = canvas.closest('.chart-box');
  if (!chartBox) return;

  // PrÃ¼fe, ob ein Titel schon existiert
  const existingHeading = chartBox.querySelector('h3');
  if (existingHeading) return;

  // Titel + optionaler Untertitel (2-zeilig, linksbuendig wie im Zielbild).
  const wrap = document.createElement('div');
  wrap.style.marginBottom = '10px';

  const heading = document.createElement('h3');
  heading.textContent = title;
  heading.style.textAlign = 'left';
  heading.style.margin = '0';

  wrap.appendChild(heading);

  if (subtitle) {
    const sub = document.createElement('div');
    sub.textContent = subtitle;
    sub.style.textAlign = 'left';
    sub.style.fontSize = '12px';
    sub.style.opacity = '0.7';
    sub.style.marginTop = '2px';
    wrap.appendChild(sub);
  }

  chartBox.insertBefore(wrap, canvas);
}



