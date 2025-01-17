import { PortValue, PortPV01, formPortPV01 } from './PORT.js';
import createBarChart from './charts/BarChart.js';

export function handleIRSensData(portMainData) {
    // console.log('Aggregating IR Sensitivity Data - Received Data:', portMainData);

    let portValue = PortValue;
    let portPV01 = PortPV01;
    let irSensitivitySum = Array(30).fill(0); // Initialize an array to hold the sum of each IR sensitivity column
    

    portMainData.forEach(dataPoint => {
      // Aggregate interest rate sensitivity for columns 1 to 30
      for (let i = 1; i <= 30; i++) {
        if (dataPoint.hasOwnProperty(i)) {
          irSensitivitySum[i - 1] += parseFloat(dataPoint[i] || 0);
        }
      }
    });

    // Calculate percentage of each IR sensitivity relative to portValue
    let irSensitivityPct = irSensitivitySum.map(sensitivity => {
      return portValue !== 0 ? (sensitivity / portValue * 10000).toFixed(2) : '0';
    });

    // Calculate PV01partial/portPV01 in %
    let pv01PartialPct = irSensitivitySum.map(sensitivity => {
      return portPV01 !== 0 ? (sensitivity / portPV01 * 100).toFixed(2) : '0';
    });

    // Create table element
    let table = document.createElement('table');
    table.className = 'irsens-table';

    // Add header row for the title
    let titleRow = table.insertRow();
    let titleCell = document.createElement('th');
    titleCell.colSpan = 33; // Adjust for the new "Sum" column
    titleCell.textContent = 'Interest Rate Sensitivity Data';
    titleRow.appendChild(titleCell);

    // Add header row for column names
    let headerRow = table.insertRow();
    let labelCell = headerRow.insertCell();
    labelCell.textContent = 'Year';
    let sumHeaderCell = headerRow.insertCell(); // "Sum" header cell
    sumHeaderCell.textContent = 'Sum';
    for (let i = 1; i <= 30; i++) {
        let cell = headerRow.insertCell();
        cell.textContent = `${i}y`;
    }

    // Add sums row for PV01partial
    let sumsRow = table.insertRow();
    let sumHeader = sumsRow.insertCell();
    sumHeader.textContent = 'PV01partial';
    let totalSumCell = sumsRow.insertCell(); // Total sum for PV01partial
    totalSumCell.textContent = irSensitivitySum.reduce((a, b) => a + b, 0).toFixed(0);
    irSensitivitySum.forEach(sum => {
        let cell = sumsRow.insertCell();
        cell.textContent = sum.toFixed(0);
    });

    // Add percentages row (PV01partial_%)
    let pctRow = table.insertRow();
    let pctHeader = pctRow.insertCell();
    pctHeader.textContent = 'PV01partial_bp';
    let totalPctCell = pctRow.insertCell(); // Total sum for percentages
    totalPctCell.textContent = `${(formPortPV01 * 1).toFixed(2)}bp`; // Display formPortPV01 as percentage of portPV01
    irSensitivityPct.forEach(pct => {
        let cell = pctRow.insertCell();
        cell.textContent = pct + 'bp';
    });

    // Add PV01partial/portPV01 % row
    let pv01PctRow = table.insertRow();
    let pv01PctHeader = pv01PctRow.insertCell();
    pv01PctHeader.textContent = 'weighted_years';
    let totalPv01PctCell = pv01PctRow.insertCell(); // Total sum for PV01partial/portPV01 %
    totalPv01PctCell.textContent = '100%'; // Assuming the sum of percentages equals 100%
    pv01PartialPct.forEach(pct => {
        let cell = pv01PctRow.insertCell();
        cell.textContent = pct + '%';
    });

    const weightedYearsData = pv01PartialPct.map((value, index) => ({
        YEARS: `${index + 1}y`, // Convert year index to string label
        PV01: parseFloat(value)  // Assuming pv01PartialPct values are strings with percentages, convert them to float
      }));
      // console.log(weightedYearsData);
    createPV01Chart(weightedYearsData);

    // Return the table element for appending to the DOM
    return table;
}



let PV01Chart; // Holds the PV01Chart instance for possible destruction and recreation

export function createPV01Chart(data) {
  // Limit the data to the first 10 entries
  const limitedData = data.slice(0, 10);

  // Prepare the labels and data for the chart using the limited data
  const labels = limitedData.map(d => d.YEARS);
  const values = limitedData.map(d => d.PV01);

  // Configuration for the PV01Chart
  const chartConfig = {
    labels: labels,
    datasets: [{
      label: 'PV01 Weighted Years (%)',
      data: values,
      backgroundColor: 'rgba(70, 192, 230, 0.7)',
      borderColor: 'rgba(70, 192, 230, 0.7)'
    }]
  };

  // Specify the element ID where the PV01Chart should be rendered
  const canvasId = 'PV01Chart';

  // Check if a PV01Chart instance already exists
  if (PV01Chart) {
    PV01Chart.destroy(); // Destroy the existing chart before creating a new one
  }

  // Create a new PV01Chart instance
  PV01Chart = createBarChart(chartConfig, canvasId, 'bar', 'y');
}
