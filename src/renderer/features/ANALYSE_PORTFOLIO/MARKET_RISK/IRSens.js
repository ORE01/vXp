import createBarChart from '../../../charts/BarChart.js';
import { getIrSensitivityColor } from '../../../utils/colors.js';

let PV01Chart;

export function handleIRSensData(rows) {

  if (!Array.isArray(rows) || rows.length === 0) {
    console.warn("IRSens: no rows received", rows);
    return;
  }

  // console.log("========== IRSens RAW DATA ==========");
  // console.log("Row count:", rows.length);
  // console.log("First row:", rows[0]);
  // console.log("All rows:", rows);
  // console.log("Columns:", Object.keys(rows[0]));
  // console.log("=====================================");

  appState?.setIRSensData?.(rows);

  const port_name = appState.getSelectedPortTableName();

  // console.log("Selected portfolio:", port_name);

  const calcData = calculateIRSensitivity(rows, port_name);

  // console.log("========== IRSens CALC DATA ==========");
  // console.log(calcData);
  // console.log("======================================");

  return renderIRSensTableAndChart(calcData, port_name);
}

function calculateIRSensitivity(rows, port_name) {

  const filteredRows = rows.filter(r => r.port_name === port_name);

  const irSensitivitySum = Array(30).fill(0);

  filteredRows.forEach(r => {

    const tenor = parseInt(r.TENOR);
    const value = parseFloat(r.VALUE_LOCAL) || 0;

    if (!isNaN(tenor) && tenor >= 1 && tenor <= 30) {
      irSensitivitySum[tenor - 1] += value;
    }

  });

  const portPV01 = irSensitivitySum.reduce((a,b)=>a+b,0);
  

  const pv01PartialPct = irSensitivitySum.map(v => {

    if (!portPV01) return 0;

    return (v / portPV01 * 100).toFixed(2);

  });

  return {
    irSensitivitySum,
    portPV01,
    pv01PartialPct
  };

}

function renderIRSensTableAndChart(data, port_name) {

  const { irSensitivitySum, portPV01, pv01PartialPct } = data;

  let table = document.createElement('table');
  table.className = 'irsens-table';

  let titleRow = table.insertRow();
  let titleCell = document.createElement('th');
  titleCell.colSpan = 33;
  titleCell.textContent = `Interest Rate Sensitivity Data for ${port_name}`;
  titleRow.appendChild(titleCell);

  let headerRow = table.insertRow();

  let labelCell = headerRow.insertCell();
  labelCell.textContent = 'Year';

  let sumHeaderCell = headerRow.insertCell();
  sumHeaderCell.textContent = 'Sum';

  for (let i = 1; i <= 30; i++) {

    let cell = headerRow.insertCell();
    cell.textContent = `${i}y`;

  }

  let sumsRow = table.insertRow();

  let sumHeader = sumsRow.insertCell();
  sumHeader.textContent = 'PV01_EUR';

  let totalSumCell = sumsRow.insertCell();
  totalSumCell.textContent = portPV01.toFixed(0);

  irSensitivitySum.forEach(sum => {

    let cell = sumsRow.insertCell();
    cell.textContent = sum.toFixed(0);

  });

  let pv01PctRow = table.insertRow();

  let pv01PctHeader = pv01PctRow.insertCell();
  pv01PctHeader.textContent = 'weighted_years';

  let totalPv01PctCell = pv01PctRow.insertCell();
  totalPv01PctCell.textContent = '100%';

  pv01PartialPct.forEach(pct => {

    let cell = pv01PctRow.insertCell();
    cell.textContent = pct + '%';

  });

  const weightedYearsData = pv01PartialPct.map((value, index) => ({

    YEARS: `${index + 1}y`,
    PV01: parseFloat(value)

  }));

  createPV01Chart(weightedYearsData);

  return table;

}

function createPV01Chart(data){

  const limitedData = data.slice(0,10);

  const labels = limitedData.map(d => d.YEARS);
  const values = limitedData.map(d => d.PV01);

  const irColors = getIrSensitivityColor(1);

  const chartConfig = {

    labels,

    datasets:[{

      label:'PV01 Weighted Years (%)',
      data:values,
      ...irColors

    }]

  };

  const canvasId='PV01Chart';

  if(PV01Chart) PV01Chart.destroy();

  PV01Chart=createBarChart(chartConfig,canvasId,'bar','y');

}