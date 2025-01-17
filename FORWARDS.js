import processData from './renderer/dataProcessor.js';
import { createFWDLineChart, createForwardSwapChart } from './charts/LineChart.js';


let FWDlineChart;
let forwardSwapChart;

// Function to linearly interpolate swap rates between known points



// Global variable for caching data
let cachedReceivedData = null;

export function handleFWDData(receivedData, applyCubicSpline) { 
  const FWDDataContainer = document.getElementById('FWDDataContainer');
  if (!FWDDataContainer) {
    console.error('FWDDataContainer element is not found.');
    return;
  }

  let dataToUse;
  if (Array.isArray(receivedData) && receivedData.length > 0) {
    appState.setForwardData(receivedData);
    dataToUse = receivedData;
  } else {
    dataToUse = appState.getForwardData();
  }

  if (!Array.isArray(dataToUse) || dataToUse.length === 0) {
    console.error("No valid data available for processing in handleFWDData.");
    return;
  }

  const cms1Length = parseInt(document.getElementById('cmsForwardInput1').value, 10) || 1;
  const cms2Length = parseInt(document.getElementById('cmsForwardInput2').value, 10) || 1;

  // const applyCubicSpline = false

  // Clear and populate FWDDataContainer
  FWDDataContainer.innerHTML = ''; 
  const FWDDataHTML = processData(dataToUse);  
  FWDDataContainer.innerHTML = FWDDataHTML;

  const table = FWDDataContainer.querySelector('#dataTable');
  if (!table) {
    console.error("No table element found in FWDDataContainer after updating with processed data.");
    return;
  }

  const rows = Array.from(table.rows);

  // Extract swap rates and years
  let swapRates = rows.slice(1).map((row) => {
    const rowData = Array.from(row.cells).map((cell) => cell.textContent.trim());
    return parseFloat(rowData[2].replace('%', '')); 
  });

  let swapYears = rows.slice(1).map((row) => {
    const rowData = Array.from(row.cells).map((cell) => cell.textContent.trim());
    return parseInt(rowData[1].replace('Y', '')); 
  });

  if (!swapRates.length || !swapYears.length) {
    console.error("Failed to extract swap rates or years from data table.");
    return;
  }

  // Define interpolation points explicitly with indices for swapRates
  const interpolationPoints = [
    { startYear: 15, endYear: 20, startIndex: 14, endIndex: 15 }, // 15Y und 20Y Indizes
    { startYear: 20, endYear: 25, startIndex: 19, endIndex: 20 }, // 20Y und 25Y Indizes
    { startYear: 25, endYear: 30, startIndex: 24, endIndex: 25 }  // 25Y und 30Y Indizes
  ];

  // Linear interpolation to fill missing swap rates
  interpolationPoints.forEach(({ startYear, endYear, startIndex, endIndex }) => {
    const interpolatedRates = linearInterpolateRates(swapRates, startYear, endYear, startIndex, endIndex);

    interpolatedRates.forEach(({ year, rate }, i) => {
      swapYears.splice(startIndex + 1 + i, 0, year);
      swapRates.splice(startIndex + 1 + i, 0, rate);
    });
  });

// Apply monotonic cubic interpolation if the flag is true
if (applyCubicSpline) {
  const cubicSplineRates = monotonicCubicInterpolate(swapRates, 1, 30);

  // Replace the original swap rates with monotonic cubic interpolated values
  cubicSplineRates.forEach(({ year, rate }, i) => {
    const index = year - 1; // Adjusting for zero-based indexing
    swapRates[index] = rate;
  });
}


  // Sort swapYears and swapRates to maintain chronological order
  const sortedData = swapYears.map((year, index) => ({ year, rate: swapRates[index] }))
                               .sort((a, b) => a.year - b.year);
  swapYears = sortedData.map(item => item.year);
  swapRates = sortedData.map(item => item.rate);

  // Calculate forward rates for both CMS lengths
  const forwardRatesCMS1 = calculateDynamicCMSForwardRates(swapRates, cms1Length).forwardRates;
  const forwardRatesCMS2 = calculateDynamicCMSForwardRates(swapRates, cms2Length).forwardRates;

  // Table headers and data update
  let headerRow = table.querySelector('tr');
  if (headerRow) {
    while (headerRow.cells.length < 5) {
      const newCell = document.createElement('th');
      headerRow.appendChild(newCell);
    }
    headerRow.cells[3].textContent = `CMS1 (${cms1Length})`;
    headerRow.cells[4].textContent = `CMS2 (${cms2Length})`;
  } else {
    console.error("Table header row is missing.");
    return;
  }

  // Clear existing rows and insert new data
  while (table.rows.length > 1) {
    table.deleteRow(1);
  }

  swapYears.forEach((year, index) => {
    const cms1Value = forwardRatesCMS1[index - 1] ? forwardRatesCMS1[index - 1].toFixed(3) + '%' : 'N/A';
    const cms2Value = forwardRatesCMS2[index - 1] ? forwardRatesCMS2[index - 1].toFixed(3) + '%' : 'N/A';

    const newRow = document.createElement('tr');
    newRow.innerHTML = `
      <td>swap</td>
      <td>${year}Y</td>
      <td>${swapRates[index].toFixed(3)}%</td>
      <td>${cms1Value}</td>
      <td>${cms2Value}</td>
    `;
    table.appendChild(newRow);
  });

  // Chart datasets
  const originalSwapDataset = {
    label: 'Original Swap Rates',
    data: swapYears.map((year, index) => ({ x: `${year}Y`, y: swapRates[index] })),
    fill: false,
    borderColor: 'rgba(99, 132, 255, 1)',
    tension: 0.1,
  };

  const cms1Dataset = {
    label: `CMS1 (Length ${cms1Length})`,
    data: forwardRatesCMS1.map((rate, index) => ({
      x: `${swapYears[index + 1]}Y`,
      y: rate
    })),
    fill: false,
    borderColor: 'rgba(75, 192, 192, 1)',
    tension: 0.1,
  };

  const cms2Dataset = {
    label: `CMS2 (Length ${cms2Length})`,
    data: forwardRatesCMS2.map((rate, index) => ({
      x: `${swapYears[index + 1]}Y`,
      y: rate
    })),
    fill: false,
    borderColor: 'rgba(255, 99, 132, 1)',
    tension: 0.1,
  };

  if (typeof FWDlineChart !== 'undefined') {
    FWDlineChart.destroy();
  }
  FWDlineChart = createFWDLineChart([originalSwapDataset, cms1Dataset, cms2Dataset], 'FWDlineChart', 'Interest Rates and Forwards', 3);
  FWDlineChart.update();
}



function linearInterpolateRates(swapRates, startYear, endYear, startIndex, endIndex) {
  const interpolatedRates = [];

  const x1 = startYear;
  const y1 = swapRates[startIndex];
  const x2 = endYear;
  const y2 = swapRates[endIndex];

  // Log der Start- und Endwerte für die Interpolation
  // console.log(`Start Year: ${x1}, Rate: ${y1}`);
  // console.log(`End Year: ${x2}, Rate: ${y2}`);
  // console.log(`Interpolating for years between ${x1} and ${x2}`);

  // Interpolation nur für die Jahre zwischen startYear und endYear
  for (let i = startYear + 1; i < endYear; i++) {
    const interpolatedRate = y1 + ((i - x1) / (x2 - x1)) * (y2 - y1);
    interpolatedRates.push({ year: i, rate: interpolatedRate });

    // Log der interpolierten Werte für jedes Jahr
    // console.log(`Year: ${i}, Interpolated Rate: ${interpolatedRate}`);
  }

  return interpolatedRates;
}
function piecewiseLinearInterpolate(swapRates, startYear, endYear, startIndex, endIndex) {
  const interpolatedRates = [];

  const x1 = startYear;
  const y1 = swapRates[startIndex];
  const x2 = endYear;
  const y2 = swapRates[endIndex];

  // Perform linear interpolation for each year in the interval
  for (let i = startYear + 1; i < endYear; i++) {
    const rate = y1 + ((i - x1) / (x2 - x1)) * (y2 - y1);
    interpolatedRates.push({ year: i, rate: parseFloat(rate.toFixed(3)) });
  }

  return interpolatedRates;
}




// Function for cubic spline interpolation 
function monotonicCubicInterpolate(swapRates, startYear, endYear) {
  const n = endYear - startYear;
  const a = swapRates.slice(startYear - 1, endYear); // Slicing swapRates based on the range
  const b = Array(n).fill(0);
  const d = Array(n).fill(0);
  const c = Array(n + 1).fill(0);

  console.log("Starting monotonic cubic interpolation");
  console.log(`Range of years: ${startYear} to ${endYear}`);
  console.log("Initial swap rates (a):", a);

  // Slopes between points
  const slopes = [];
  for (let i = 0; i < n; i++) {
    slopes[i] = a[i + 1] - a[i];
    console.log(`Slope between ${startYear + i}Y and ${startYear + i + 1}Y:`, slopes[i]);
  }

  // Initialize tangents to prevent overshooting
  const tangents = [slopes[0]];
  for (let i = 1; i < n - 1; i++) {
    const slope = slopes[i];
    if (slope * slopes[i - 1] <= 0) {
      tangents[i] = 0; // Flat if change in slope direction
      console.log(`Tangent set to 0 at ${startYear + i}Y due to slope direction change`);
    } else {
      tangents[i] = (slopes[i - 1] + slope) / 2;
      console.log(`Tangent at ${startYear + i}Y (average of adjacent slopes):`, tangents[i]);
    }
  }
  tangents.push(slopes[n - 2]);

  // Calculate the coefficients
  for (let i = 0; i < n; i++) {
    const t = tangents[i];
    const t1 = tangents[i + 1];
    b[i] = a[i];
    c[i] = t;
    d[i] = (3 * slopes[i] - 2 * t - t1);
    c[i] = (t + t1 - 2 * slopes[i]);

    console.log(`Coefficients for interval starting at ${startYear + i}Y:`);
    console.log(`  a: ${a[i]}`);
    console.log(`  b: ${b[i]}`);
    console.log(`  c: ${c[i]}`);
    console.log(`  d: ${d[i]}`);
  }

  // Generate interpolated values, with direct assignment for known years
  const interpolatedRates = [];
  const knownYears = [1,2,3,4,5,6,7,8,9, 10,11,12,13,14,15, 20, 25, 30];

  for (let i = 0; i < n; i++) {
    const year = startYear + i;

    // Directly assign known rates for 15Y, 20Y, 25Y, and 30Y
    const rate = knownYears.includes(year) ? swapRates[year - 1] : b[i] + c[i] * (year - startYear) + d[i] * Math.pow(year - startYear, 2);
    
    interpolatedRates.push({ year, rate: parseFloat(rate.toFixed(3)) });
    console.log(`Interpolated rate for ${year}Y:`, rate);
  }

  console.log("Completed monotonic cubic interpolation\n");
  return interpolatedRates;
}






// Function to bootstrap discount factors and calculate forward rates
function calculateForwardRates(swapRates) {
  const discountFactors = [];
  const forwardRates = [];

  // Loop through each swap rate and calculate the discount factor and forward rate
  swapRates.forEach((swapRate, n) => {
    const S_n = swapRate / 100; // Convert percentage to decimal
    let sumDiscountFactors = 0;

    // Calculate the sum of previous discount factors
    for (let i = 0; i < n; i++) {
      sumDiscountFactors += discountFactors[i];
    }

    // Calculate the discount factor for year n+1
    const D_n = (1 - S_n * sumDiscountFactors) / (1 + S_n);
    discountFactors.push(D_n);

    // If there's a previous discount factor, calculate the forward rate
    if (n > 0) {
      const fwdRate = (discountFactors[n - 1] / D_n) - 1;
      forwardRates.push(fwdRate * 100); // Convert back to percentage
    }
  });

  return { forwardRates };
}
// CMS
function calculateDynamicCMSForwardRates(swapRates, forward_length) {
  // Validate inputs
  if (!Array.isArray(swapRates) || swapRates.length === 0) {
    throw new Error("swapRates must be a non-empty array");
  }
  if (typeof forward_length !== "number" || forward_length < 1) {
    throw new Error("forward_length must be a positive integer");
  }

  const discountFactors = [];
  const forwardSwapRates = [];

  // First pass: Calculate all discount factors
  swapRates.forEach((swapRate, n) => {
    if (typeof swapRate !== "number" || isNaN(swapRate)) {
      console.warn(`Invalid swap rate at index ${n}:`, swapRate);
      return;
    }

    const S_n = swapRate / 100; // Convert percentage to decimal
    let sumDiscountFactors = 0;

    // Calculate the sum of previous discount factors
    for (let i = 0; i < n; i++) {
      if (typeof discountFactors[i] === "number") {
        sumDiscountFactors += discountFactors[i];
      } else {
        console.warn(`Invalid discount factor at index ${i}:`, discountFactors[i]);
      }
    }

    // Calculate the discount factor for year n+1
    const D_n = (1 - S_n * sumDiscountFactors) / (1 + S_n);
    if (isNaN(D_n)) {
      console.warn(`NaN discount factor calculated for year ${n + 1}`);
    }
    discountFactors.push(D_n);

    // Log each calculated discount factor
    //console.log(`Discount factor for year ${n + 1}:`, D_n);
  });

  // Second pass: Calculate forward swap rates using the precomputed discount factors
  swapRates.forEach((swapRate, n) => {
    // Only calculate the forward swap rate if there are enough years left
    if (n + forward_length < swapRates.length) {
      // Corrected slice to start from n + 1 to n + forward_length
      const sliceStart = n + 1;
      const sliceEnd = n + forward_length + 1;
      const discountFactorsSlice = discountFactors.slice(sliceStart, sliceEnd);

      // Check contents of the slice
      // console.log(`Discount factors from year ${n + 2} to ${n + forward_length + 1}:`, discountFactorsSlice);

      // Calculate the sum of discount factors for the forward period
      const sumOfDiscountFactors = discountFactorsSlice.reduce((a, b) => a + b, 0);

      if (sumOfDiscountFactors === 0) {
        console.warn(`Sum of discount factors is zero for period starting at year ${n + 1}`);
      } else {
        //console.log(`Sum of discount factors from year ${n + 2} to ${n + forward_length + 1}:`, sumOfDiscountFactors);
      }

      // Calculate forward swap rate for the specified forward length
      const forwardSwapRate = ((discountFactors[n] - discountFactors[n + forward_length]) / sumOfDiscountFactors) * 100;
      forwardSwapRates.push(forwardSwapRate);
    }
  });

  // Log the full array of discount factors for inspection
  //console.log("All discount factors:", discountFactors);

  //console.log(`Forward Swap Rates for ${forward_length}-Year Periods:`, forwardSwapRates);
  return { forwardRates: forwardSwapRates };
}



// Function to handle the forward curve data and use the years_forward value
export function handleSwapForwardCurve(receivedData) {
  const FWDData = receivedData;

  const yearsForwardInput = document.getElementById('yearsForwardInput').value;
  const yearsForwardValue = parseInt(yearsForwardInput, 10);  // Parse the value as an integer

  // Extract the original swap rates and years
  const table = document.getElementById('FWDDataContainer').querySelector('#dataTable');
  const rows = Array.from(table.rows);

  let swapRates = rows.slice(1).map((row) => {
    const rowData = Array.from(row.cells).map((cell) => cell.textContent.trim());
    return parseFloat(rowData[2].replace('%', '')); // Extract swap rate values and remove %
  });

  let swapYears = rows.slice(1).map((row) => {
    const rowData = Array.from(row.cells).map((cell) => cell.textContent.trim());
    return rowData[1]; // Extract year values (e.g., "1Y", "2Y", etc.)
  });

  // **Ensure both arrays have the same length** (safeguard)
  if (swapRates.length !== swapYears.length) {
    console.error('Mismatch between swap rates and years. Cannot proceed with calculation.');
    return;
  }

  // Calculate the forward rates using the provided yearsForwardValue
  const forwardRates = calculateSwapForwardCurve(swapRates, yearsForwardValue);

  // Create a dataset for the forward swap curve
  const forwardSwapDataset = {
    label: `Forward Swap Rates (from year ${yearsForwardValue})`,
    data: forwardRates.map((rate, index) => ({
      x: swapYears[index + yearsForwardValue],  // Align with the correct forward years
      y: rate,
    })),
    fill: false,
    borderColor: 'rgba(255, 159, 64, 1)',  // Orange color for the forward curve
    tension: 0.1,
  };

  // Create a dataset for the original swap rates
  const originalSwapDataset = {
    label: 'Original Swap Rates',
    data: swapRates.map((rate, index) => ({
      x: swapYears[index],
      y: rate,
    })),
    fill: false,
    borderColor: 'rgba(75, 192, 192, 1)',  // Blue color for the original swap curve
    tension: 0.1,
  };

  // Create the forward swap chart using the forwardSwapChart
  forwardSwapChart = createForwardSwapChart(
    [originalSwapDataset, forwardSwapDataset],  // Pass both datasets
    'FWDforwardCurveChart',
    'Swap and Forward Curves',
    3
  );
}

function calculateSwapForwardCurve(swapRates, years_forward) {
  const discountFactors = [];
  const forwardSwapRates = [];

  // Loop through each swap rate and calculate discount factors
  swapRates.forEach((swapRate, n) => {
    const S_n = swapRate / 100; // Convert percentage to decimal
    let sumDiscountFactors = 0;

    // Calculate the sum of previous discount factors
    for (let i = 0; i < n; i++) {
      sumDiscountFactors += discountFactors[i];
    }

    // Calculate the discount factor for year n+1
    const D_n = (1 - S_n * sumDiscountFactors) / (1 + S_n);
    discountFactors.push(D_n);

    // Only calculate the forward swap rate if we are beyond the input start year
    if (n >= years_forward) {
      // Calculate the sum of discount factors from D_(years_forward+1) to D_n
      const sumOfDiscountFactors = discountFactors.slice(years_forward, n + 1).reduce((a, b) => a + b, 0);

      // Calculate forward swap rate using the correct formula
      const forwardSwapRate = ((discountFactors[years_forward - 1] - D_n) / sumOfDiscountFactors) * 100; // Convert back to percentage
      forwardSwapRates.push(forwardSwapRate);
    }
  });

  //console.log(`Forward Swap Rates (starting from year ${years_forward}):`, forwardSwapRates);
  return forwardSwapRates;
}


