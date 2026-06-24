import { appState } from '../../renderer.js';
import {
  getColorFromPalette,
  getColorForPieChart,
  getPortfolioColor,
  getEuswCurveColor
} from '../../utils/colors.js';


let lastSummaryYieldArgs = null;
let summaryYieldRatesListenerBound = false;
let summaryYieldRefreshTimer = null;

// Gewählte historische Kurve für die Performance-Charts (Wert = Options-Key).
let _yieldSel = 'y5';            // Default: 5 Years Back
let _yieldYearsBackBound = false;

// Mögliche Vergleichszeiträume (Monate + Jahre) als Handelstage zurück
// (~21 Tage/Monat, 252 Tage/Jahr), gefiltert nach verfügbarer Historie.
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
  const portfolioYield = portfolioData.formPortYield;
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

    insertHeadingIntoExistingChartBox({ canvasId: 'euswapPortfolioYieldChart', title: 'Portfolio Yield vs Maturity' });
    insertHeadingIntoExistingChartBox({ canvasId: 'euswapProductYieldChart', title: 'Product Yields vs Maturity' });
    insertHeadingIntoExistingChartBox({ canvasId: 'durationSwapChart', title: 'Portfolio Yield vs Duration' });
    insertHeadingIntoExistingChartBox({ canvasId: 'durationProductYieldChart', title: 'Product Yields vs Duration' });

    // =========================
    // 1) Portfolio vs Maturity
    // =========================
drawYieldVsTimeChart({
  targetId: 'euswapPortfolioYieldChart',
  heading: 'Portfolio Yield vs Maturity',
  yieldCurve: EUSWData,
  pastYieldCurve,
  pastLabel,
  euswDataOriginal: [],
  points: [{ x: portTtM, y: parseFloat(portfolioYield.replace('%', '')) }]
});

    // =========================
    // 2) Products vs Maturity
    // =========================
drawYieldVsTimeChart({
  targetId: 'euswapProductYieldChart',
  heading: 'Product Yields vs Maturity',
  yieldCurve: EUSWData,
  pastYieldCurve,
  pastLabel,
  euswDataOriginal: [],
  points: filteredData
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
      points: durationPoints
    });

    // =========================
    // Product Duration Points
    // =========================
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

const productDurationPoints = filteredData.map(entry => {
  const rawYtm = entry.ytm ?? entry.YTM;

  let ytm = parseNumberLike(rawYtm);

  // Falls ytm als Dezimal kommt, z. B. 0.021 statt 2.1
  if (Number.isFinite(ytm) && Math.abs(ytm) <= 1) {
    ytm = ytm * 100;
  }

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
      euswDataOriginal: durationEUSWData,
      points: productDurationPoints
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
      label: 'EU Yield Curve',
      data: euswPoints,
      showLine: true,
      borderColor: euswSolid.borderColor,
      backgroundColor: euswFill.backgroundColor,
      tension: 0.3,
      pointRadius: 3,
      order: 3 // Kurven hinter den Punkten (höherer order = unten)
    });
  }

  // EU Yield Curve 5 Years Back (gleiches Blau, gestrichelt)
  // Ja: geht exakt so mit borderDash
  if (pastPoints.length) {
    datasets.push({
      label: pastLabel,
      data: pastPoints,
      showLine: true,
      borderColor: euswSolid.borderColor,
      backgroundColor: euswFill.backgroundColor,
      borderDash: [6, 6],
      tension: 0.3,
      pointRadius: 3,
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
      data: [portfolioPoint],
      backgroundColor: pCol.backgroundColor,
      borderColor: pCol.borderColor,
      borderWidth: 3,
      pointRadius: 8,
      pointHoverRadius: 10,
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

  // Render
  window[targetId + '_chartInstance'] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: false,
      maintainAspectRatio: false,

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
          title: { display: true, text: 'Years', align: 'end', font: { size: 11 } },
          ticks: { font: { size: 11 } },
          min: 0,
          max: xMax + 1
        },
        y: {
          title: { display: true, text: 'Yield (%)', font: { size: 11 } },
          ticks: {
            font: { size: 11 },
            callback: val => `${Number(val).toFixed(2)}%`
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
          position: 'right',
          labels: {
            font: { size: 10 },
            boxWidth: 18,
            boxHeight: 10,
            padding: 14,
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
                ? `Portfolio Yield: ${context.raw.y.toFixed(2)}% at ${context.raw.x.toFixed(2)}Y`
                : `${context.dataset.label}: ${context.raw.y.toFixed(2)}% at ${context.raw.x.toFixed(2)}Y`
          },
          bodyFont: { size: 13 }
        }
      }
    }
  });
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
      

function insertHeadingIntoExistingChartBox({ canvasId, title }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const chartBox = canvas.closest('.chart-box');
  if (!chartBox) return;

  // PrÃ¼fe, ob ein Titel schon existiert
  const existingHeading = chartBox.querySelector('h3');
  if (existingHeading) return;

  const heading = document.createElement('h3');
  heading.textContent = title;
  heading.style.textAlign = 'center';
  heading.style.marginBottom = '10px';

  chartBox.insertBefore(heading, canvas);
}



