import processData from './renderer/dataProcessor.js';
import createLineChart from './charts/LineChart.js';
import { calculateSMA, calculateRSI } from './ChartAnalyses.js';
//import { normalizeDataset } from './charts/LineChart.js';

// Store chart instances in an object with modalIndex as key
const chartInstances = {};



export function handleTSData(receivedData, modalIndex) {
  //console.log('receivedData', receivedData);
  const checkboxContainer = document.getElementById(`checkboxContainer_${modalIndex}`);
  const targetCheckboxContainer = document.getElementById('targetCheckboxContainer'); // Single target container
  const loadButton = document.getElementById(`loadButton_${modalIndex}`);
  const TSData = receivedData;

  if (TSData && checkboxContainer && targetCheckboxContainer && loadButton) {
    // Process the TSData but do not display it yet
    const TSDataHTML = processData(TSData, 'tblTS');
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = TSDataHTML;

    // Retrieve the table rows and headers without displaying them
    const table = tempDiv.querySelector('#dataTable');
    const rows = Array.from(table.rows);
    const headers = Array.from(rows.shift().cells).map((cell) => cell.textContent.trim());

    // Clear the checkboxes
    checkboxContainer.innerHTML = '';
    targetCheckboxContainer.innerHTML = '';

    // Define default selected checkboxes for each modalIndex
    const defaultCheckedIndices = {
      1: [0, 1], // For modal 1, select dataset 0 and 1
      2: [9, 10], // For modal 2, select dataset 8 and 9
      3: [18]    // For modal 3, select dataset 17
    };

    // Create the checkboxes for the dataset selection
    const checkboxes = headers.slice(1).map((header, index) => {
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.id = `checkbox-${modalIndex}-${index}`;
      checkbox.value = header;

      // Preselect the checkboxes based on defaultCheckedIndices
      checkbox.checked = defaultCheckedIndices[modalIndex]?.includes(index) || false;

      checkboxContainer.appendChild(checkbox);

      const label = document.createElement('label');
      label.htmlFor = checkbox.id;
      label.textContent = header;
      checkboxContainer.appendChild(label);
      checkboxContainer.appendChild(document.createElement('br'));

      return checkbox;
    });

    // Create the checkboxes for the target selection
    headers.slice(1).forEach((header, index) => {
      const targetCheckbox = document.createElement('input');
      targetCheckbox.type = 'checkbox';
      targetCheckbox.id = `target-checkbox-${index}`;
      targetCheckbox.value = header;

      targetCheckboxContainer.appendChild(targetCheckbox);

      const label = document.createElement('label');
      label.htmlFor = targetCheckbox.id;
      label.textContent = header;
      targetCheckboxContainer.appendChild(label);
      targetCheckboxContainer.appendChild(document.createElement('br'));

      // Add event listener to ensure only one target checkbox is selected at a time
      targetCheckbox.addEventListener('change', (event) => {
        if (event.target.checked) {
          // Uncheck all other checkboxes
          const targetCheckboxes = targetCheckboxContainer.querySelectorAll('input[type="checkbox"]');
          targetCheckboxes.forEach((cb) => {
            if (cb !== event.target) cb.checked = false;
          });

          console.log(`Selected Target: ${event.target.value}`);
        }
      });
    });

    // Ensure that the LoadData button manually loads the selected datasets
    loadButton.replaceWith(loadButton.cloneNode(true)); // Remove previous event listeners
    const newLoadButton = document.getElementById(`loadButton_${modalIndex}`);

    newLoadButton.onclick = () => {
      const chartContainer = document.querySelector(`#TSlineChart_${modalIndex}`).parentElement;
      const mainTableContainer = document.getElementById(`TSDataContainer_${modalIndex}`);
      console.log(mainTableContainer); // Check if this logs the correct container.

      if (chartContainer && mainTableContainer) {
        chartContainer.style.display = 'block'; // Show the chart
        mainTableContainer.style.display = 'none'; // Hide the table
      } else {
        console.error('Chart or Table container not found');
      }

      // Manually load and display the selected datasets
      refreshTableAndChart(rows, headers, checkboxes, modalIndex);
    };

    loadButton.style.display = 'block'; // Ensure the load button is visible
  }
}

function refreshTableAndChart(rows, headers, checkboxes, modalIndex, containerId = 'modal-content-container') {
  const normalizationTypeSelector = document.getElementById(`normalizationTypeSelector_${modalIndex}`);
  const normalizationType = normalizationTypeSelector ? normalizationTypeSelector.value : 'none';
  const showDailyVolatility = document.getElementById(`showDailyVolatility_${modalIndex}`)?.checked ?? false;

  // ✅ Get moving averages only for TS modals
  let movingAverages = { period1: null, period2: null, period3: null };
  if (containerId === 'modal-content-container') {
    try {
      movingAverages = getMovingAverages(modalIndex); // Use getMovingAverages function instead of duplicating logic
      console.log(`🎉 Moving Averages Retrieved:`, movingAverages);
    } catch (error) {
      console.warn(`❌ Failed to retrieve moving averages for modalIndex ${modalIndex}:`, error);
    }
  } else {
    console.log(`Skipping Moving Averages for modal ${modalIndex} (container: ${containerId})`);
  }

  console.log('Normalization type selected:', normalizationType);

  const selectedDatasets = checkboxes
    .map((checkbox, index) => checkbox.checked ? {
      label: headers[index + 1], // Add +1 to skip the date column
      data: [],
      index: index + 1 // Save the index to match with the table columns
    } : null)
    .filter(Boolean);

  if (selectedDatasets.length === 0) {
    console.warn('⚠️ No datasets selected. Skipping chart update.');
    return;
  }

  selectedDatasets.forEach((dataset) => {
    dataset.data = [];

    rows.slice(1).forEach((row) => {
      const rowData = Array.from(row.cells).map((cell) => cell.textContent.trim());
      const xValue = rowData[0];
      const yValue = parseFloat(rowData[dataset.index]);

      dataset.data.push({
        x: xValue,
        y: isNaN(yValue) ? null : yValue,
        originalY: isNaN(yValue) ? null : yValue
      });
    });

    console.log(`Dataset before normalization [${dataset.label}]:`, dataset.data);

    applyNormalization(dataset, normalizationType);
    
    if (containerId === 'modal-content-container') {
      try {
        applyMovingAverages(dataset, movingAverages);
      } catch (error) {
        console.warn(`❌ Failed to apply moving averages for modalIndex ${modalIndex}:`, error);
      }
    }

    if (showDailyVolatility) {
      applyDailyVolatility(dataset);
    }
  });

  if (chartInstances[modalIndex]) {
    chartInstances[modalIndex].destroy();
  }

  console.log("Parsed data with normalization type:", normalizationType, selectedDatasets);

  chartInstances[modalIndex] = createLineChart(
    selectedDatasets, 
    `TSlineChart_${modalIndex}`, 
    'Timeseries', 
    0, 
    modalIndex, 
    { 
      sma1: movingAverages?.period1, 
      sma2: movingAverages?.period2, 
      sma3: movingAverages?.period3 
    }  
  );
}

// MAs
function getMovingAverages(modalIndex) {
  return {
    applySMA1: document.getElementById(`applySMA1_${modalIndex}`)?.checked ?? false, 
    applySMA2: document.getElementById(`applySMA2_${modalIndex}`)?.checked ?? false, 
    applySMA3: document.getElementById(`applySMA3_${modalIndex}`)?.checked ?? false, 
    period1: parseInt(document.getElementById(`movingAveragePeriod1_${modalIndex}`)?.value, 10) || 20, 
    period2: parseInt(document.getElementById(`movingAveragePeriod2_${modalIndex}`)?.value, 10) || 50, 
    period3: parseInt(document.getElementById(`movingAveragePeriod3_${modalIndex}`)?.value, 10) || 200 
  };
}

function applyMovingAverages(dataset, movingAverages) {
  if (movingAverages.applySMA1) {
    const sma1 = calculateSMA(dataset.data, movingAverages.period1);
    if (sma1 && sma1.length > 0) {
      dataset.smaData1 = dataset.data.map((point, idx) => ({
        x: point.x,
        y: sma1[idx]
      }));
      console.log(`Calculated SMA 20 for dataset [${dataset.label}]:`, dataset.smaData1);
    } else {
      console.error(`Error calculating SMA 20 for dataset [${dataset.label}]`);
    }
  }
  
  if (movingAverages.applySMA2) {
    const sma2 = calculateSMA(dataset.data, movingAverages.period2);
    if (sma2 && sma2.length > 0) {
      dataset.smaData2 = dataset.data.map((point, idx) => ({
        x: point.x,
        y: sma2[idx]
      }));
      console.log(`Calculated SMA 50 for dataset [${dataset.label}]`, dataset.smaData2);
    } else {
      console.error(`Error calculating SMA 50 for dataset [${dataset.label}]`);
    }
  }

  if (movingAverages.applySMA3) {
    const sma3 = calculateSMA(dataset.data, movingAverages.period3);
    if (sma3 && sma3.length > 0) {
      dataset.smaData3 = dataset.data.map((point, idx) => ({
        x: point.x,
        y: sma3[idx]
      }));
      console.log(`Calculated SMA 200 for dataset [${dataset.label}]`, dataset.smaData3);
    } else {
      console.error(`Error calculating SMA 200 for dataset [${dataset.label}]`);
    }
  }
}
 // NORMALIZATION
function applyNormalization(dataset, normalizationType) {
  switch (normalizationType) {
    case 'dynamic':
      if (typeof dynamicNormalization === 'function') {
        dataset.data = dynamicNormalization(dataset).data;  
        console.log('Applied dynamicNormalization:', dataset.data);
      } else {
        console.error('dynamicNormalization function is not defined.');
      }
      break;
    case 'normalize':
      if (typeof normalizeDataset === 'function') {
        dataset.data = normalizeDataset(dataset).data;  
        console.log('Applied normalizeDataset:', dataset.data);
      } else {
        console.error('normalizeDataset function is not defined.');
      }
      break;
    case 'none':
    default:
      console.log(`Using original data for dataset [${dataset.label}]`);
      break;
  }
}

function normalizeDataset(dataset) {
    console.log("Before normalizeDataset:", dataset.data);
  
    // Find the first non-NaN and non-null value for normalization
    const firstValidIndex = dataset.data.findIndex(({ y }) => y !== null && !isNaN(y));
  
    // If no valid data points, return the dataset as-is
    if (firstValidIndex === -1) {
      console.warn("No valid data found for normalization.");
      return dataset;
    }
  
    const startingValue = dataset.data[firstValidIndex].y;
  
    // If the starting value is 0, return the dataset as-is
    if (startingValue === 0) {
      console.warn("Starting value for normalization is 0, skipping normalization.");
      return dataset;
    }
  
    // Normalize the data based on the first valid value
    const normalizedData = dataset.data.map(({ x, y, originalY }) => ({
      x,
      y: y !== null && !isNaN(y) ? (y / startingValue) * 100 : null, // Normalize to 100
      originalY // Preserve original value
    }));
  
    console.log("After normalizeDataset:", normalizedData);
  
    // Return a new dataset with normalized data
    return { ...dataset, data: normalizedData };
}
  
function dynamicNormalization(dataset) {
    console.log("Before dynamicNormalization:", dataset.data);
    const validData = dataset.data.filter(({ y }) => y !== null && !isNaN(y));
    const minValue = Math.min(...validData.map(({ y }) => y));
    const maxValue = Math.max(...validData.map(({ y }) => y));

    if (minValue === maxValue) {
        return dataset.data.map(({ x, y, originalY }) => ({ x, y, originalY }));
    }

    const normalizedData = dataset.data.map(({ x, y, originalY }) => ({
        x,
        y: y !== null && !isNaN(y) ? ((y - minValue) / (maxValue - minValue)) * 100 : null,
        originalY // Preserve original
    }));

    console.log("After dynamicNormalization:", normalizedData);
    return { ...dataset, data: normalizedData };
}

// DAILY VOL
function applyDailyVolatility(dataset) {
  dataset.data = dataset.data.map((point, idx, array) => {
    if (idx === 0) return { x: point.x, y: null }; // No previous day to compare to
    const previousPoint = array[idx - 1].y;
    const currentPoint = point.y;
    const volatility = (previousPoint && currentPoint) ? ((currentPoint - previousPoint) / previousPoint) * 100 : null; // Calculate relative change in percentage
    return { x: point.x, y: volatility };
  });
  console.log(`Calculated daily volatility for dataset [${dataset.label}]`, dataset.data);
}
