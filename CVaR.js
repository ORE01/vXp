import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';
import { PortValue } from './PORT.js';

let EADChart;
let LGDChart;
let filteredEADMainData = [];

export function handleEADMainData(receivedData) {
  const EADMainDataContainer = document.getElementById('EADMainDataContainer');
  const EADMainData = receivedData;

  if (EADMainDataContainer && EADMainData) {
    let columns = ['ISSUER', 'RANK', 'RATING', 'NOTIONAL', 'LGD', 'PD'];
    filteredEADMainData = filterColumnsInData(EADMainData, columns);
    if (EADChart) {EADChart.destroy();}
    if (LGDChart) {LGDChart.destroy();}

    // Sort the data by the "NOTIONAL" in descending order
    filteredEADMainData.sort((a, b) => parseFloat(b.NOTIONAL.replace(/\s/g, '')) - parseFloat(a.NOTIONAL.replace(/\s/g, '')));

    const EADMainDataHTML = processData(filteredEADMainData, 'EADMain');
    EADMainDataContainer.innerHTML = EADMainDataHTML;

    // CHARTS:

    // Format the data for the EAD bar chart
    const EADLabels = filteredEADMainData.map(data => data.ISSUER);
    //NOTIONAL is a string!
    const EADValues = filteredEADMainData.map(data => parseFloat(data.NOTIONAL.replace(/\s/g, '')));

    // Call createBarChart with the formatted data for EAD chart
    EADChart = createBarChart({ labels: EADLabels, datasets: [{ label: 'EAD', data: EADValues, backgroundColor: 'rgba(70, 192, 230, 0.7)', borderColor: 'rgba(70, 192, 230, 0.7)' }] }, 'EADChart', 'bar', 'y');
    
    // Format the data for the LGD bar chart
    const LGDValues = filteredEADMainData.map(data => parseFloat(data.LGD.toString().replace(/\s/g, '')));
    //console.log('LGDvalues:', LGDValues);

    // Create the combined dataset for EAD and LGD
    const combinedDataset = [
      {
        label: 'EAD',
        data: EADValues,
        backgroundColor: 'rgba(70, 192, 230, 0.7)',
        borderColor: 'rgba(70, 192, 230, 0.7)',
        borderWidth: 1,
      },
      {
        label: 'LGD',
        data: LGDValues,
        backgroundColor: 'rgba(255, 0, 0)',
        borderColor: 'rgba(255, 0, 0)',
        borderWidth: 1,
      },
    ];
    //console.log('combinedDatasets:', combinedDataset);
    
    // Call createBarChart with the combined datasets for EAD and LGD chart
    const combinedLabels = EADLabels;
    LGDChart = createBarChart({ labels: combinedLabels, datasets: combinedDataset }, 'LGDChart', 'bar', 'y');
    //LGDChart = createBarChart({ labels: combinedLabels, datasets: combinedDataset }, 'LGDChart', 'bar', 'y');

    //console.log('EADMain:', EADMainData);
  }
}
// Main Goal: Creation of CVaRDataContainer which holds CVaR and ES as a table
export function handleCVaRData(receivedData) {
  console.log('handleCVaRData:', receivedData);
  const CVaRDataContainer = document.getElementById('CVaRDataContainer');

  // Clear the container before appending new content
  CVaRDataContainer.innerHTML = '';

  const CVaRData = receivedData;
  if (CVaRDataContainer && CVaRData) {
    // Process each row to add column "ConvI".  format ConvI in % and rename the first column to "CVaR"
    CVaRData.forEach((row, index) => {
      const firstColumnName = Object.keys(row)[0];
      row.CVaR = row[firstColumnName];
      delete row[firstColumnName];
      row.ConvI = ((index + 1) / 10000 * 100).toFixed(2) + '%';
    });

    const targetConvI = '0.10%'; // 10/10000 * 100 formatted as %
    const targetRow = CVaRData.find(row => row.ConvI === targetConvI);
    const targetCVaRValue = targetRow ? targetRow.CVaR : 'Not Found';

    // Calculate ES:
    let sumCVaR = 0;
    const targetRowIndex = CVaRData.findIndex(row => row.ConvI === targetConvI);
      for (let i = 0; i <= targetRowIndex; i++) {
        sumCVaR += parseFloat(CVaRData[i].CVaR);
      }
    const y = parseFloat(targetConvI.replace('%', '')) / 100 * 10000;
    const C_ES = sumCVaR / y;

    // Calculate relative values
    const relativeTargetCVaR = (targetCVaRValue / PortValue * 100).toFixed(2) + '%';
    const relativeC_ES = (C_ES / PortValue * 100).toFixed(2) + '%';

    // Round the absolute values
    const roundedTargetCVaRValue = Math.round(targetCVaRValue);
    const roundedC_ES = Math.round(C_ES);

    // Create a new table
    const table = document.createElement('table');

    // Create table headers
    const tableHeaders = ['CREDIT', 'absolute', 'relative'];
    const headerRow = table.insertRow(0);
    tableHeaders.forEach((headerText, index) => {
      const cell = headerRow.insertCell(index);
      cell.textContent = headerText;
    });

    // Create an array of data to populate the table
    const dataPoints = [
      { CREDIT: 'VaR', absolute: roundedTargetCVaRValue, relative: relativeTargetCVaR },
      { CREDIT: 'ES', absolute: roundedC_ES, relative: relativeC_ES }
    ];

    // Populate the table with data
    dataPoints.forEach((dataPoint, rowIndex) => {
      const row = table.insertRow(rowIndex + 1);
      tableHeaders.forEach((header, colIndex) => {
        const cell = row.insertCell(colIndex);
        cell.textContent = dataPoint[header];
      });
    });

    // console.log('table:', table);

    // Append the table to the main container
    CVaRDataContainer.appendChild(table);
  }
}

// für LossIssuer.js
export function getEADMainDataContainer() {
  return document.getElementById('EADMainDataContainer');
}

export { filteredEADMainData};

