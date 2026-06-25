import createBarChart from '../../charts/BarChart.js';
import { getColorForPieChart } from '../../utils/colors.js';

// Interner Key -> lesbarer Anzeige-Name (Legenden-Label im Chart).
const CHART_DISPLAY_NAMES = {
  PV01:       'PV01',
  CPV01:      'CPV01',
  MvarTOT:    'MVaR Total',
  MvarIR:     'MVaR IR',
  MvarCS:     'MVaR Credit Spread',
  CvarRating: 'CVaR Rating',
  CvarMarket: 'CVaR Market',
  CvarNorm:   'CVaR Norm',
};

// Theme-Wechsel: Vergleichs-Charts mit den neuen (theme-aware) Farben neu zeichnen.
let __compThemeBound = false;
function bindCompThemeRerender() {
  if (__compThemeBound) return;
  __compThemeBound = true;
  document.addEventListener('theme:changed', () => {
    const map = window.appState?.portDataMap;
    if (map) createComparisonCharts(map, true);
  });
}


export function createComparisonCharts(portDataMap, destroyPrevious = false) {

  bindCompThemeRerender();

  if (portDataMap.portDataContainer1 && portDataMap.portDataContainer2) {

    const compareNames =
      window.appState?.getComparePortNames?.() || {};

    console.log('🔍 COMPARE – comparePortNames:', compareNames);

    const portNameA = compareNames[1] || 'Portfolio 1';
    const portNameB = compareNames[2] || 'Portfolio 2';

    console.log('🧾 COMPARE – resolved names:', { portNameA, portNameB });

        const containerIds = [
          'compChartContainer1', 'compChartContainer2', 'compChartContainer3',
          'compChartContainer4', 'compChartContainer5', 'compChartContainer6',
          'compChartContainer7', 'compChartContainer8'
        ];
  
        const chartNames = ['PV01', 'CPV01', 'MvarTOT', 'MvarIR', 'MvarCS', 'CvarRating', 'CvarMarket', 'CvarNorm'];
        const chartLabels = Array(chartNames.length).fill([
            portNameA,
            portNameB,
            'Difference'
          ]);

        const chartType = 'bar';
  
        const chartData = extractChartDataFromSavedValues(portDataMap);
        // console.log('portDataMap2:', portDataMap)

        // Theme-aware Serienfarben (Portfolio 1 / Portfolio 2 / Difference) aus der
        // zentralen Palette -> passt sich automatisch an Light/Dark an.
        // Standard-Palette (Blau/Orange/Grün), voll deckend wie die Breakdown-Pies
        // -> gleiche Farben und gleiche Durchsichtigkeit überall.
        const seriesColors = [0, 1, 2].map((i) => getColorForPieChart(i));
        const seriesBg = seriesColors.map((c) => c.backgroundColor);
        const seriesBorder = seriesColors.map((c) => c.borderColor);

  containerIds.forEach((containerId, index) => {
    const chartName = chartNames[index];
    const chartValues = chartData[chartName];

    if (!chartValues) {
      console.warn(`No data for ${chartName}`);
      return;
    }

    // Destroy previous chart if needed
    const existingChart = Chart.getChart(`compChart${index + 1}`);
    if (destroyPrevious && existingChart) {
      existingChart.destroy();
    }

    const containerElement = document.getElementById(containerId);
    if (!containerElement) return;
    containerElement.innerHTML = '';

    const canvasElement = document.createElement('canvas');
    canvasElement.id = `compChart${index + 1}`;
    containerElement.appendChild(canvasElement);

    const chartConfig = {
      labels: chartLabels[index],
      datasets: [{
        label: CHART_DISPLAY_NAMES[chartName] || chartName,
        data: chartValues,
        backgroundColor: seriesBg,
        borderColor: seriesBorder,
        borderWidth: 1
      }]
    };

    createBarChart(chartConfig, canvasElement.id, chartType, 'x');
  });
}
}

function normalizePortName(value) {
  return String(value ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

function normalizeScenarioName(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

function parseUiNumber(value) {
  if (value === null || value === undefined || value === '') return 0;

  const normalized = String(value)
    .replace('%', '')
    .replace(/\s/g, '')
    .replace(',', '.');

  const n = Number.parseFloat(normalized);

  return Number.isFinite(n) ? n : 0;
}

function getLatestMvarRowForPort(portName, scenarioName) {
  const rows = window.appState?.getAllMvarData?.() || [];
  const selectedPort = normalizePortName(portName);
  const selectedScenario = normalizeScenarioName(scenarioName);

  const matches = rows.filter(row => {
    const rowPort = normalizePortName(row.port_name ?? row.PORT_NAME);
    const rowScenario = normalizeScenarioName(
      row.scenario_name ??
      row.SCENARIO_NAME ??
      row.interval_name ??
      row.INTERVAL_NAME
    );

    return (
      rowPort === selectedPort &&
      (!selectedScenario || rowScenario === selectedScenario)
    );
  });

  if (!matches.length) {
    console.warn('[COMPARE MVAR] no MVaR row found', {
      portName,
      scenarioName,
      available: rows.slice(0, 10).map(r => ({
        port_name: r.port_name ?? r.PORT_NAME,
        scenario_name: r.scenario_name ?? r.SCENARIO_NAME,
        ASOF_DATE: r.ASOF_DATE ?? r.asof_date,
      })),
    });

    return null;
  }

  return matches
    .slice()
    .sort((a, b) =>
      String(a.ASOF_DATE ?? a.asof_date ?? '')
        .localeCompare(String(b.ASOF_DATE ?? b.asof_date ?? ''))
    )
    .at(-1);
}

function getMvarRelValue(row, key) {
  if (!row) return 0;

  const raw = row?.[key];

  const n = Number(raw);

  if (!Number.isFinite(n)) return 0;

  // MVaR rel is usually stored as decimal, e.g. -0.014 = -1.4%.
  // Chart displays percentage points.
  return +(n * 100).toFixed(2);
}

function extractChartDataFromSavedValues(savedValues, indexA = 1, indexB = 2) {
  const compareNames =
    window.appState?.getComparePortNames?.() || {};

  const portNameA = compareNames[indexA] || 'Portfolio 1';
  const portNameB = compareNames[indexB] || 'Portfolio 2';
  const scenarioName = window.appState?.selectedMvarInterval ?? null;

  const keyA = `portDataContainer${indexA}`;
  const keyB = `portDataContainer${indexB}`;

  const mvarRowA = getLatestMvarRowForPort(portNameA, scenarioName);
  const mvarRowB = getLatestMvarRowForPort(portNameB, scenarioName);

  const chartData = {};

  const uiFields = {
    PV01: 'formPortPV01',
    CPV01: 'formPortCPV01',

    CvarRating: 'formVaR_rating_rel',
    CvarMarket: 'formVaR_market_rel',
    CvarNorm: 'formVaR_norm_rel',
  };

  for (const [key, formId] of Object.entries(uiFields)) {
    const valA = parseUiNumber(savedValues[keyA]?.[formId]);
    const valB = parseUiNumber(savedValues[keyB]?.[formId]);
    const diff = +(valA - valB).toFixed(2);

    chartData[key] = [valA, valB, diff];
  }

  chartData.MvarTOT = buildDiffValues(
    getMvarRelValue(mvarRowA, 'VaR_T_rel'),
    getMvarRelValue(mvarRowB, 'VaR_T_rel')
  );

  chartData.MvarIR = buildDiffValues(
    getMvarRelValue(mvarRowA, 'VaR_IR_rel'),
    getMvarRelValue(mvarRowB, 'VaR_IR_rel')
  );

  chartData.MvarCS = buildDiffValues(
    getMvarRelValue(mvarRowA, 'VaR_CS_rel'),
    getMvarRelValue(mvarRowB, 'VaR_CS_rel')
  );

  console.log('[COMPARE CHART DATA]', {
    portNameA,
    portNameB,
    scenarioName,
    mvarRowA,
    mvarRowB,
    MvarTOT: chartData.MvarTOT,
    MvarIR: chartData.MvarIR,
    MvarCS: chartData.MvarCS,
  });

  return chartData;
}

function buildDiffValues(valA, valB) {
  const diff = +(valA - valB).toFixed(2);
  return [valA, valB, diff];
}



    








