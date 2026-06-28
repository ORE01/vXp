import processData from '../../../core/ui/modal/modalData.js';
import { createFWDLineChart, createForwardSwapChart } from '../../../charts/LineChart.js';
import { notifyRiskPreview } from '../../REPORTS/RiskPDFPreview.js';
import { getInterestRateCurveData } from '../interestRates/interestRateCurveData.js';

let FWDlineChart;
let forwardSwapChart;



// -----------------------------------------------------
// HILFSFUNKTIONEN handleFWDData (Refactoring)
// -----------------------------------------------------

function normalizeRateValue(value) {
  if (value === null || value === undefined || value === '') return null;

  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : null;
  }

  const cleaned = String(value)
    .trim()
    .replace('%', '')
    .replace(',', '.');

  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

function getActiveScenarioForCurve(appState, selectedCurrency, selectedCurveId) {
  const activeRows = appState.getRatesActive?.() || [];

  const active = activeRows
    .filter(r =>
      String(r.ccy || '').trim() === String(selectedCurrency || '').trim() &&
      String(r.curve_id || '').trim() === String(selectedCurveId || '').trim()
    )
    .sort((a, b) =>
      new Date(b.activated_at || 0) - new Date(a.activated_at || 0)
    )[0];

  return active?.scenario_id || 'BASE';
}

function prepareForwardData(receivedData) {
  console.log("========== [FWD prepareForwardData] ==========");

  const selectedCurrency =
    appState?.selectedCurrency ||
    appState?.getSelectedCurrency?.() ||
    document.getElementById("currencySelector")?.value ||
    "EUR";

  const selectedCurveId =
    appState?.selectedCurveId ||
    appState?.getSelectedCurve?.() ||
    document.getElementById("ratesSelector")?.value;

  const domSelectedCurve =
    document.getElementById("ratesSelector")?.value ||
    selectedCurveId;

  console.log("[FWD] selectedCurrency:", selectedCurrency);
  console.log("[FWD] selectedCurveId:", selectedCurveId);
  console.log("[FWD] domSelectedCurve:", domSelectedCurve);

  // --------------------------------------------------
  // WICHTIG:
  // Nicht direkt _RATESDataCacheByCcy verwenden.
  // Das zieht BASE.
  //
  // Stattdessen dieselbe zentrale Logik wie Interest Rates:
  // active scenario falls vorhanden, sonst BASE.
  // --------------------------------------------------
  const { IRData, curve } = getInterestRateCurveData(
    appState,
    selectedCurrency,
    selectedCurveId,
    domSelectedCurve
  );

  console.log("[FWD] resolved curve:", curve);
  console.log("[FWD] IRData len:", IRData?.length);
  console.table(IRData?.slice?.(0, 10));

  if (!Array.isArray(IRData) || IRData.length === 0) {
    console.error("[FWD] No valid active IRData found for forward calculation.");
    return null;
  }

  // --------------------------------------------------
  // IRData auf Forward-Shape normalisieren
  // --------------------------------------------------
  const dataToUse = IRData
    .map(r => {
      const year =
        r.YEAR ??
        r.year ??
        r.TENOR ??
        r.tenor ??
        r.maturity ??
        r.MATURITY;

      const rateValue =
        r.RATES ??
        r.rates ??
        r.RATE ??
        r.rate ??
        r.value ??
        r.VALUE ??
        r.EUSWAP;

      return {
        instrument: "swap",   // Instrument-Typ (swap / bund), nicht währungsspezifisch
        YEAR: year,
        RATES: normalizeRateValue(rateValue)
      };
    })
    .filter(r =>
      r.YEAR &&
      Number.isFinite(r.RATES)
    );

  console.log("[FWD] normalized dataToUse len:", dataToUse.length);
  console.table(dataToUse.slice(0, 10));

  if (dataToUse.length === 0) {
    console.error("[FWD] No usable rows after normalization.");
    return null;
  }

  return dataToUse;
}

function readCmsLengths() {
  const cms1Length = parseInt(document.getElementById('cmsForwardInput1')?.value, 10) || 1;
  const cms2Length = parseInt(document.getElementById('cmsForwardInput2')?.value, 10) || 1;
  return { cms1Length, cms2Length };
}

function renderForwardBaseTable(container, dataToUse) {
  container.innerHTML = '';
  // Nur die Anzeige-Header umbenennen (Keys bleiben YEAR/RATES für CMS-Logik).
  const FWDDataHTML = processData(dataToUse, undefined, {
    instrument: 'Instrument',
    YEAR: 'Maturity',
    RATES: 'Rates',
  });
  container.innerHTML = FWDDataHTML;

  const table = container.querySelector('#dataTable');
  if (!table) {
    console.error('Table not found in FWDDataContainer.');
    return null;
  }

  if (table.rows.length < 2) {
    console.error('No data rows found in the table.');
    return null;
  }

  return table;
}

function extractSwapCurveFromTable(table) {
  const rows = Array.from(table.rows);
  const headers = Array.from(rows[0].cells).map(cell => cell.textContent.trim());

  // Header-Anzeige ist jetzt "Rates"/"Maturity" (Keys intern weiter RATES/YEAR);
  // beide Schreibweisen akzeptieren, damit die Kurvenextraktion robust bleibt.
  const ratesIndex = headers.findIndex(h => h === 'Rates' || h === 'RATES');
  const yearIndex  = headers.findIndex(h => h === 'Maturity' || h === 'YEAR');

  if (ratesIndex === -1 || yearIndex === -1) {
    console.error("Column 'RATES' or 'YEAR' not found in the table!");
    return { swapRates: [], swapYears: [] };
  }

  const dataRows = rows.slice(1);

  const swapRates = [];
  const swapYears = [];
  const seenYears = new Set();

  dataRows.forEach(row => {
    const rowData = Array.from(row.cells).map(cell => cell.textContent.trim());

    const year = parseInt(rowData[yearIndex].replace('Y',''),10);

    if (!seenYears.has(year)) {
      seenYears.add(year);

      swapYears.push(year);
      const parsedRate = normalizeRateValue(rowData[ratesIndex]);

      if (!Number.isFinite(parsedRate)) {
        console.warn("[FWD] invalid parsed rate:", rowData[ratesIndex]);
        return;
      }

      swapRates.push(parsedRate);
    }
  });

  return { swapRates, swapYears };
}

const INTERPOLATION_POINTS = [
  { startYear: 15, endYear: 20, startIndex: 14, endIndex: 15 },
  { startYear: 20, endYear: 25, startIndex: 19, endIndex: 20 },
  { startYear: 25, endYear: 30, startIndex: 24, endIndex: 25 },
];

function enrichSwapCurve(swapRates, swapYears, applyCubicSpline) {
  // lineare EinfÃ¼gung der Zwischenjahre
  INTERPOLATION_POINTS.forEach(({ startYear, endYear, startIndex, endIndex }) => {
    const interpolatedRates = linearInterpolateRates(
      swapRates,
      startYear,
      endYear,
      startIndex,
      endIndex
    );

    interpolatedRates.forEach(({ year, rate }, i) => {
      swapYears.splice(startIndex + 1 + i, 0, year);
      swapRates.splice(startIndex + 1 + i, 0, rate);
    });
  });

  if (applyCubicSpline) {
    const cubicSplineRates = monotonicCubicInterpolate(swapYears,swapRates,1,30)
    cubicSplineRates.forEach(({ year, rate }) => {
      const index = year - 1;
      swapRates[index] = rate;
    });
  }

  const sortedData = swapYears
    .map((year, index) => ({ year, rate: swapRates[index] }))
    .sort((a, b) => a.year - b.year);

  return {
    swapYears: sortedData.map((item) => item.year),
    swapRates: sortedData.map((item) => item.rate),
  };
}

function computeCmsForwards(swapRates, cmsLength1, cmsLength2) {

  const maxYear = swapRates.length;

  const discountFactors = [];

  // -----------------------------
  // 1 Bootstrapping DF
  // -----------------------------

  swapRates.forEach((swapRate, n) => {

    const S = swapRate / 100;

    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += discountFactors[i];
    }

    const D = (1 - S * sum) / (1 + S);

    discountFactors.push(D);

    //console.log(`DF ${n + 1}Y =`, D, 'swapRate =', swapRate);
  });

  // -----------------------------
  // 2 Smooth DF with spline
  // -----------------------------

  const logDF = discountFactors.map(d => Math.log(d));

  const smoothLogDF = cubicSpline(logDF);

  const smoothedDF = smoothLogDF.map(x => Math.exp(x));

  // -----------------------------
  // 3 CMS forwards
  // -----------------------------

  const forwardRatesCMS1 = [];
  const forwardRatesCMS2 = [];

  for (let year = 0; year < maxYear; year++) {

    if (year + cmsLength1 < maxYear) {

      const numerator =
        smoothedDF[year] - smoothedDF[year + cmsLength1];

      const denom =
        smoothedDF
          .slice(year + 1, year + cmsLength1 + 1)
          .reduce((a, b) => a + b, 0);

      forwardRatesCMS1.push((numerator / denom) * 100);

    } else {
      forwardRatesCMS1.push(null);
    }

    if (year + cmsLength2 < maxYear) {

      const numerator =
        smoothedDF[year] - smoothedDF[year + cmsLength2];

      const denom =
        smoothedDF
          .slice(year + 1, year + cmsLength2 + 1)
          .reduce((a, b) => a + b, 0);

      forwardRatesCMS2.push((numerator / denom) * 100);

    } else {
      forwardRatesCMS2.push(null);
    }
  }

  return {
    forwardRatesCMS1,
    forwardRatesCMS2
  };
}


function rebuildForwardTableWithCms(
  table,
  swapYears,
  swapRates,
  forwardRatesCMS1,
  forwardRatesCMS2,
  cms1Length,
  cms2Length
) {
  // 1) Header sauber holen: zuerst thead, sonst erste tr im table
  let headerRow =
    table.querySelector('thead tr') ||
    table.querySelector('tr');

  if (!headerRow) {
    console.error('Table header row is missing.');
    return;
  }

  // Header auf 5 Spalten erweitern
  while (headerRow.cells.length < 5) {
    headerRow.appendChild(document.createElement('th'));
  }
  headerRow.cells[3].textContent = `CMS1 (${cms1Length})`;
  headerRow.cells[4].textContent = `CMS2 (${cms2Length})`;

  // 2) Body-Teil gezielt bearbeiten
  let tbody = table.querySelector('tbody');
  if (!tbody) {
    // falls processData keinen tbody angelegt hat, einen erzeugen
    tbody = document.createElement('tbody');
    table.appendChild(tbody);
  }

  // alte Datenzeilen im tbody lÃ¶schen
  while (tbody.firstChild) {
    tbody.removeChild(tbody.firstChild);
  }

  // 3) Neue Datenzeilen ins tbody einfÃ¼gen
  swapYears.forEach((year, index) => {
const cms1Value = forwardRatesCMS1[index] != null
  ? forwardRatesCMS1[index].toFixed(3) + '%'
  : 'N/A';

const cms2Value = forwardRatesCMS2[index] != null
  ? forwardRatesCMS2[index].toFixed(3) + '%'
  : 'N/A';

    const newRow = document.createElement('tr');
    newRow.innerHTML = `
      <td>swap</td>
      <td>${year}Y</td>
      <td>${swapRates[index].toFixed(3)}%</td>
      <td>${cms1Value}</td>
      <td>${cms2Value}</td>
    `;
    tbody.appendChild(newRow);
  });
}


function createForwardDatasets(
  swapYears,
  swapRates,
  forwardRatesCMS1,
  forwardRatesCMS2,
  cms1Length,
  cms2Length
) {
  const originalSwapDataset = {
    label: 'Original Swap Rates',
    data: swapYears.map((year, index) => ({ x: `${year}Y`, y: swapRates[index] })),
    fill: false,
    borderColor: 'rgba(99, 132, 255, 1)',
    tension: 0,
  };

const cms1Dataset = {
  label: `CMS1 (Length ${cms1Length})`,
  data: forwardRatesCMS1
    .map((rate, index) =>
      rate != null ? { x: `${swapYears[index]}Y`, y: rate } : null
    )
    .filter(Boolean),
  fill: false,
  borderColor: 'rgba(75, 192, 192, 1)',
  tension: 0,
};

const cms2Dataset = {
  label: `CMS2 (Length ${cms2Length})`,
  data: forwardRatesCMS2
    .map((rate, index) =>
      rate != null ? { x: `${swapYears[index]}Y`, y: rate } : null
    )
    .filter(Boolean),
  fill: false,
  borderColor: 'rgba(255, 99, 132, 1)',
  tension: 0,
};

  return [originalSwapDataset, cms1Dataset, cms2Dataset];
}

export function renderFWDChart(datasets) {
  if (typeof FWDlineChart !== 'undefined' && FWDlineChart) {
    FWDlineChart.destroy();
  }

  FWDlineChart = createFWDLineChart(
    datasets,
    'FWDlineChart',
    'Interest Rates and Forwards',
    3
  );
  FWDlineChart.update();
}

// -----------------------------------------------------
// REFACTORED: handleFWDData (Top-Level-Flow)
// -----------------------------------------------------
export function handleFWDData(receivedData, applyCubicSpline) {
  const FWDDataContainer = document.getElementById('FWDDataContainer');
  if (!FWDDataContainer) {
    console.error('FWDDataContainer element is not found.');
    return;
  }

  // 1) Daten vorbereiten (Cache + selectedCurve)
  const dataToUse = prepareForwardData(receivedData);
  if (!dataToUse) return;

  // 2) CMS-LÃ¤ngen einlesen
  const { cms1Length, cms2Length } = readCmsLengths();

  // 3) Basistabelle rendern
  const table = renderForwardBaseTable(FWDDataContainer, dataToUse);
  if (!table) return;

  // 4) Swap-Kurve aus Tabelle ziehen
  let { swapRates, swapYears } = extractSwapCurveFromTable(table);
  if (!swapRates.length || !swapYears.length) return;

  // 5) Interpolation + optional Spline
  //({ swapRates, swapYears } = enrichSwapCurve(swapRates, swapYears, true));
  //swapRates = interpolateSwapCurve(swapYears, swapRates, 30);

  ({ swapYears, swapRates } = interpolateSwapCurve(swapYears, swapRates, 30));

  swapYears = Array.from({ length: 30 }, (_, i) => i + 1);

  // 6) CMS-Forwards berechnen
  const { forwardRatesCMS1, forwardRatesCMS2 } = computeCmsForwards(
    swapRates,
    cms1Length,
    cms2Length
  );

  // 7) Tabelle inkl. CMS-Spalten neu aufbauen
  rebuildForwardTableWithCms(
    table,
    swapYears,
    swapRates,
    forwardRatesCMS1,
    forwardRatesCMS2,
    cms1Length,
    cms2Length
  );

  // 8) Datasets fÃ¼r Chart erstellen
  const datasets = createForwardDatasets(
    swapYears,
    swapRates,
    forwardRatesCMS1,
    forwardRatesCMS2,
    cms1Length,
    cms2Length
  );

  // 9) Chart rendern
  renderFWDChart(datasets);

  // 10) Preview informieren
  notifyRiskPreview();
}

// -----------------------------------------------------
// Bestehende Helper-Funktionen (unverÃ¤ndert)
// -----------------------------------------------------

function linearInterpolateRates(swapRates, startYear, endYear, startIndex, endIndex) {
  const interpolatedRates = [];

  const x1 = startYear;
  const y1 = swapRates[startIndex];
  const x2 = endYear;
  const y2 = swapRates[endIndex];

  for (let i = startYear + 1; i < endYear; i++) {
    const interpolatedRate = y1 + ((i - x1) / (x2 - x1)) * (y2 - y1);
    interpolatedRates.push({ year: i, rate: interpolatedRate });
  }

  return interpolatedRates;
}

function interpolateSwapCurve(swapYears, swapRates, maxYear = 30) {
  const years = swapYears.filter(y => y <= maxYear);
  const rates = swapRates.slice(0, years.length);

  const discount = years.map((t, i) => {
    const r = rates[i] / 100;
    return Math.exp(-r * t);
  });

  const fullYears = [];
  const fullRates = [];

  for (let year = 1; year <= maxYear; year++) {
    fullYears.push(year);

    const exactIdx = years.indexOf(year);
    if (exactIdx !== -1) {
      fullRates.push(rates[exactIdx]);
      continue;
    }

    let left = -1;
    for (let i = 0; i < years.length - 1; i++) {
      if (years[i] < year && years[i + 1] > year) {
        left = i;
        break;
      }
    }

    if (left === -1) {
      fullRates.push(null);
      continue;
    }

    const x0 = years[left];
    const x1 = years[left + 1];
    const d0 = discount[left];
    const d1 = discount[left + 1];

    const w = (year - x0) / (x1 - x0);
    const logD = Math.log(d0) + w * (Math.log(d1) - Math.log(d0));
    const d = Math.exp(logD);
    const r = -Math.log(d) / year;

    fullRates.push(r * 100);
  }

  return {
    swapYears: fullYears,
    swapRates: fullRates
  };
}

function piecewiseLinearInterpolate(swapRates, startYear, endYear, startIndex, endIndex) {
  const interpolatedRates = [];

  const x1 = startYear;
  const y1 = swapRates[startIndex];
  const x2 = endYear;
  const y2 = swapRates[endIndex];

  for (let i = startYear + 1; i < endYear; i++) {
    const rate = y1 + ((i - x1) / (x2 - x1)) * (y2 - y1);
    interpolatedRates.push({ year: i, rate: parseFloat(rate.toFixed(3)) });
  }

  return interpolatedRates;
}


function monotonicCubicInterpolate(swapYears, swapRates, startYear, endYear) {

  const n = swapYears.length;
  if (n < 2) return swapRates;

  const slopes = [];
  for (let i = 0; i < n - 1; i++) {
    const dx = swapYears[i+1] - swapYears[i];
    const dy = swapRates[i+1] - swapRates[i];
    slopes.push(dy/dx);
  }

  const tangents = new Array(n);
  tangents[0] = slopes[0];
  tangents[n-1] = slopes[n-2];

  for (let i = 1; i < n-1; i++) {
    if (slopes[i-1] * slopes[i] <= 0) {
      tangents[i] = 0;
    } else {
      tangents[i] = (slopes[i-1] + slopes[i]) / 2;
    }
  }

  const result = new Array(endYear).fill(null);

  for (let i = 0; i < n-1; i++) {

    const x0 = swapYears[i];
    const x1 = swapYears[i+1];

    const y0 = swapRates[i];
    const y1 = swapRates[i+1];

    const m0 = tangents[i];
    const m1 = tangents[i+1];

    const dx = x1 - x0;

    result[x0-1] = y0;

    for (let year = x0+1; year < x1; year++) {

      const t = (year-x0)/dx;

      const h00 = 2*t**3 - 3*t**2 + 1;
      const h10 = t**3 - 2*t**2 + t;
      const h01 = -2*t**3 + 3*t**2;
      const h11 = t**3 - t**2;

      const value =
        h00*y0 +
        h10*dx*m0 +
        h01*y1 +
        h11*dx*m1;

      result[year-1] = value;
    }
  }

  result[swapYears[n-1]-1] = swapRates[n-1];

  return result;
}

// Function to bootstrap discount factors and calculate forward rates
function calculateForwardRates(swapRates) {
  const discountFactors = [];
  const forwardRates = [];

  swapRates.forEach((swapRate, n) => {
    const S_n = swapRate / 100; // Convert percentage to decimal
    let sumDiscountFactors = 0;

    for (let i = 0; i < n; i++) {
      sumDiscountFactors += discountFactors[i];
    }

    const D_n = (1 - S_n * sumDiscountFactors) / (1 + S_n);
    discountFactors.push(D_n);


    //console.log("DF year", n + 1, "=", D_n);

    if (n > 0) {
      const fwdRate = discountFactors[n - 1] / D_n - 1;
      forwardRates.push(fwdRate * 100); // Convert back to percentage
    }
  });

  return { forwardRates };
}

// CMS
function calculateDynamicCMSForwardRates(swapRates, forward_length) {
  if (!Array.isArray(swapRates) || swapRates.length === 0) {
    throw new Error('swapRates must be a non-empty array');
  }
  if (typeof forward_length !== 'number' || forward_length < 1) {
    throw new Error('forward_length must be a positive integer');
  }

  const discountFactors = [];
  const forwardSwapRates = [];

  // First pass: Calculate all discount factors
  swapRates.forEach((swapRate, n) => {
    if (typeof swapRate !== 'number' || isNaN(swapRate)) {
      console.warn(`Invalid swap rate at index ${n}:`, swapRate);
      return;
    }

    const S_n = swapRate / 100; // Convert percentage to decimal
    let sumDiscountFactors = 0;

    for (let i = 0; i < n; i++) {
      if (typeof discountFactors[i] === 'number') {
        sumDiscountFactors += discountFactors[i];
      } else {
        console.warn(`Invalid discount factor at index ${i}:`, discountFactors[i]);
      }
    }

    const D_n = (1 - S_n * sumDiscountFactors) / (1 + S_n);
    if (isNaN(D_n)) {
      console.warn(`NaN discount factor calculated for year ${n + 1}`);
    }
    discountFactors.push(D_n);

    //console.log("DF year", n + 1, "=", D_n);
  });

  // Second pass: Calculate forward swap rates using the precomputed discount factors
  swapRates.forEach((swapRate, n) => {
    if (n + forward_length < swapRates.length) {
      const sliceStart = n + 1;
      const sliceEnd = n + forward_length + 1;
      const discountFactorsSlice = discountFactors.slice(sliceStart, sliceEnd);

      const sumOfDiscountFactors = discountFactorsSlice.reduce((a, b) => a + b, 0);

      if (sumOfDiscountFactors === 0) {
        console.warn(
          `Sum of discount factors is zero for period starting at year ${n + 1}`
        );
      }

      const forwardSwapRate =
        ((discountFactors[n] - discountFactors[n + forward_length]) /
          sumOfDiscountFactors) *
        100;
      forwardSwapRates.push(forwardSwapRate);
    }
  });

  return { forwardRates: forwardSwapRates };
}

export function handleSwapForwardCurve() {
  const yearsForwardInputEl = document.getElementById('yearsForwardInput');
  if (!yearsForwardInputEl) {
    console.warn('handleSwapForwardCurve: #yearsForwardInput not found');
    return;
  }

  const yearsForwardValue = parseInt(yearsForwardInputEl.value, 10);
  if (isNaN(yearsForwardValue) || yearsForwardValue < 1) {
    console.warn('handleSwapForwardCurve: invalid yearsForwardValue', yearsForwardInputEl.value);
    return;
  }

  const container = document.getElementById('FWDDataContainer');
  if (!container) {
    console.warn('handleSwapForwardCurve: #FWDDataContainer not found');
    return;
  }

  const table = container.querySelector('#dataTable');
  if (!table) {
    console.warn('handleSwapForwardCurve: #dataTable not found in FWDDataContainer');
    return;
  }

  const rows = Array.from(table.rows);
  if (rows.length < 2) {
    console.warn('handleSwapForwardCurve: no data rows in table');
    return;
  }

  // swapRates aus Spalte 3, swapYears aus Spalte 2
  const swapRates = rows.slice(1).map(row => {
    const rowData = Array.from(row.cells).map(c => c.textContent.trim());
    return parseFloat(rowData[2].replace('%', ''));
  });

  const swapYears = rows.slice(1).map(row => {
    const rowData = Array.from(row.cells).map(c => c.textContent.trim());
    return rowData[1]; // e.g. "1Y", "2Y"
  });

  if (swapRates.length !== swapYears.length) {
    console.error('handleSwapForwardCurve: Mismatch between swap rates and years.');
    return;
  }

  const forwardRates = calculateSwapForwardCurve(swapRates, yearsForwardValue);
  if (!Array.isArray(forwardRates) || !forwardRates.length) {
    console.warn('handleSwapForwardCurve: no forwardRates calculated');
    return;
  }

  const forwardSwapDataset = {
    label: `Forward Swap Rates (from year ${yearsForwardValue})`,
    data: forwardRates.map((rate, index) => ({
      x: swapYears[index + yearsForwardValue],  // align to forward years
      y: rate,
    })),
    fill: false,
    borderColor: 'rgba(255, 159, 64, 1)',
    tension: 0,
  };

  const originalSwapDataset = {
    label: 'Original Swap Rates',
    data: swapRates.map((rate, index) => ({
      x: swapYears[index],
      y: rate,
    })),
    fill: false,
    borderColor: 'rgba(75, 192, 192, 1)',
    tension: 0,
  };

  // alten Chart ggf. zerstÃ¶ren
  if (typeof forwardSwapChart !== 'undefined' && forwardSwapChart) {
    forwardSwapChart.destroy();
  }

  forwardSwapChart = createForwardSwapChart(
    [originalSwapDataset, forwardSwapDataset],
    'FWDforwardCurveChart',
    'Swap and Forward Curves',
    3
  );

  notifyRiskPreview('forwardCurve');
}


function calculateSwapForwardCurve(swapRates, years_forward) {
  const discountFactors = [];
  const forwardSwapRates = [];

  swapRates.forEach((swapRate, n) => {
    const S_n = swapRate / 100;
    let sumDiscountFactors = 0;

    for (let i = 0; i < n; i++) {
      sumDiscountFactors += discountFactors[i];
    }

    const D_n = (1 - S_n * sumDiscountFactors) / (1 + S_n);
    discountFactors.push(D_n);

    if (n >= years_forward) {
      const sumOfDiscountFactors = discountFactors
        .slice(years_forward, n + 1)
        .reduce((a, b) => a + b, 0);

      const forwardSwapRate =
        ((discountFactors[years_forward - 1] - D_n) / sumOfDiscountFactors) *
        100;
      forwardSwapRates.push(forwardSwapRate);
    }
  });

  //console.log('swapRates input =', swapRates);
  //console.log('discountFactors bootstrapped =', discountFactors);

  return forwardSwapRates;
}


function bootstrapDiscountFactors(swapRates) {

  const df = [];

  swapRates.forEach((swapRate, n) => {

    const S = swapRate / 100;

    let sum = 0;
    for (let i = 0; i < n; i++) {
      sum += df[i];
    }

    const D = (1 - S * sum) / (1 + S);

    df.push(D);

  });

  return df;
}

function smoothDiscountCurve(years, discountFactors) {

  const logDF = discountFactors.map(d => Math.log(d));

  const spline = cubicSpline(years, logDF);

  const smoothed = years.map(t => Math.exp(spline(t)));

  return smoothed;
}

function forwardRate(df, start, length) {

  const numerator = df[start] - df[start + length];

  let denom = 0;

  for (let i = start + 1; i <= start + length; i++) {
    denom += df[i];
  }

  return (numerator / denom) * 100;
}

function cubicSpline(values) {

  const n = values.length;
  const result = new Array(n).fill(0);

  for (let i = 0; i < n; i++) {

    if (i === 0 || i === n - 1) {
      result[i] = values[i];
      continue;
    }

    const prev = values[i - 1];
    const curr = values[i];
    const next = values[i + 1];

    result[i] =
      (prev + 4 * curr + next) / 6;
  }

  return result;
}

