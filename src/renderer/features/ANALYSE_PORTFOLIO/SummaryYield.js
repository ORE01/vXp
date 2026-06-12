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
  const fiveYearsAgoRow = TSData[TSData.length - 1 - (252 * 5)];

  const yieldCurve = transformTSDataToEUSWFormat(latestRow);
  const pastYieldCurve = transformTSDataToEUSWFormat(fiveYearsAgoRow);

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
    chartCanvas.style.height = '400px';

    container.appendChild(headingElem);
    container.appendChild(chartCanvas);
    canvas = chartCanvas;
  }

  const ctx = setupHiDPICanvas(canvas, 600, 400);

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
      pointRadius: 3
    });
  }

  // EU Yield Curve 5 Years Back (gleiches Blau, gestrichelt)
  // Ja: geht exakt so mit borderDash
  if (pastPoints.length) {
    datasets.push({
      label: 'EU Yield Curve 5 Years Back',
      data: pastPoints,
      showLine: true,
      borderColor: euswSolid.borderColor,
      backgroundColor: euswFill.backgroundColor,
      borderDash: [6, 6],
      tension: 0.3,
      pointRadius: 3
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
      pointRadius: 3
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
      pointHoverRadius: 10
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

  // ---- Legend anzeigen? Nur wenn es mind. ein Dataset mit Daten gibt ----
  const showLegend = datasets.some(ds => Array.isArray(ds.data) && ds.data.length > 0);

  // Render
  window[targetId + '_chartInstance'] = new Chart(ctx, {
    type: 'scatter',
    data: { datasets },
    options: {
      responsive: false,
      maintainAspectRatio: false,

      // âœ… NUR Tooltip wenn Cursor wirklich auf einem Punkt ist
      interaction: {
        mode: 'nearest',
        intersect: true
      },
      hover: {
        mode: 'nearest',
        intersect: true
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
          title: { display: true, text: 'Years', font: { size: 16 } },
          ticks: { font: { size: 14 } },
          min: 0,
          max: xMax + 1
        },
        y: {
          title: { display: true, text: 'Yield (%)', font: { size: 16 } },
          ticks: {
            font: { size: 14 },
            callback: val => `${Number(val).toFixed(2)}%`
          },
          min: Math.floor(yMin),
          max: Math.ceil(yMax)
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
          position: 'top',
          labels: {
            font: { size: 14 },
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
      export function setupHiDPICanvas(canvas, widthPx, heightPx) {
        const dpr = window.devicePixelRatio || 2;

        canvas.width = widthPx * dpr;
        canvas.height = heightPx * dpr;
        canvas.style.width = `${widthPx}px`;
        canvas.style.height = `${heightPx}px`;

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



