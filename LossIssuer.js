import { filterColumnsInData } from './renderer/dataProcessor.js';
import processData from './renderer/dataProcessor.js';
import createBarChart from './charts/BarChart.js';
// import {handleTrafficLight} from './trafficLight.js';

// Global scope — this runs as soon as the file is loaded
if (!window.charts) window.charts = {}; 

// Global objects to store datasets
let ratingData = [];
let marketData = [];
let marketNormData = [];

export function handleLossIssuerMainData(receivedData, type) {
  // console.log('LossIssuer receivedData:', receivedData);
  
  // 🔥 Define the type map for dynamic access
  const typeMap = {
    'rating': {
      dataContainerId: 'LossIssuerDataContainerRating',
      chartId: 'LossIssuerChartRating',
      tableName: 'sortedLossesIssuerMain_rating'
    },
    'market': {
      dataContainerId: 'LossIssuerDataContainerMarket',
      chartId: 'LossIssuerChartMarket',
      tableName: 'sortedLossesIssuerMain_market'
    },
    'norm': {
      dataContainerId: 'LossIssuerDataContainerMarketNorm',
      chartId: 'LossIssuerChartMarketNorm',
      tableName: 'sortedLossesIssuerMain_marketNorm'
    }
  };

  // 🔥 Get the data for the current type
  const { dataContainerId, chartId, tableName } = typeMap[type] || {}; // Destructure the mapped data
  
  if (!dataContainerId || !chartId || !tableName) {
    console.error(`Invalid type "${type}" provided for handleLossIssuerMainData.`);
    return; // If the type is invalid, stop execution
  }

  const LossIssuerDataContainer = document.getElementById(dataContainerId);

  if (LossIssuerDataContainer && receivedData) {
    let sortedData = processAndSortLossIssuerData(receivedData);
    const LossIssuerDataHTML = processData(sortedData, tableName); 
    LossIssuerDataContainer.innerHTML = LossIssuerDataHTML;
  
    // 🔥 Highlight the 10th row (index 9 since it is zero-indexed)
    const allRows = LossIssuerDataContainer.querySelectorAll('tr'); 
    if (allRows.length > 10) {
      allRows[10].classList.add('highlight'); 
    }

    // Save the datasets globally to be used in combined chart
    if (type === 'rating') {
      ratingData = sortedData;
      createLossIssuerChart(ratingData, 'LossIssuerChartRating', 'rating'); 
    } else if (type === 'market') {
      marketData = sortedData;
      createLossIssuerChart(marketData, 'LossIssuerChartMarket', 'market'); 
    } else if (type === 'norm') {
      marketNormData = sortedData; 
      createLossIssuerChart(marketNormData, 'LossIssuerChartMarketNorm', 'norm'); 
    }

    // Call the combined chart after all datasets are available
    if (ratingData.length > 0 && marketData.length > 0 && marketNormData.length > 0) {
      createCombinedLossIssuerChart(ratingData, marketData, marketNormData, 'LossIssuerCombinedChart');
      createCombinedLossIssuerESChart(ratingData, marketData, marketNormData, 'LossIssuerCombinedESChart'); 
    }

    const fetchRatingData = () => new Promise(resolve => {
      // Simulate async data fetch for rating
      setTimeout(() => resolve(ratingData), 1000);
    });
    
    const fetchNormData = () => new Promise(resolve => {
      // Simulate async data fetch for norm
      setTimeout(() => resolve(marketNormData), 2000);
    });
    
    Promise.all([fetchRatingData(), fetchNormData()]).then(([ratingData, marketNormData]) => {
      // console.log("Rating Data Before Mapping:", ratingData);
      // console.log("Market Norm Data Before Mapping:", marketNormData);
  
      // Safely map LOSS values
      const extractedRatingLosses = ratingData.map(item => item.LOSS || 0); // Default to 0 if LOSS is undefined
      const extractedNormLosses = marketNormData.map(item => item.LOSS || 0);
  
      // console.log("Extracted Rating Losses:", extractedRatingLosses);
      // console.log("Extracted Norm Losses:", extractedNormLosses);
  
      handleTrafficLight(extractedRatingLosses, extractedNormLosses);
  });
  
  
  }
}



export function setupLossIssuerUI() {
  let EADMainDataContainer = document.getElementById('EADMainDataContainer');
  const LossIssuerDataContainerRating = document.getElementById('LossIssuerDataContainerRating');
  const LossIssuerDataContainerMarket = document.getElementById('LossIssuerDataContainerMarket');
  const LossIssuerCombinedChartContainer = document.getElementById('LossIssuerCombinedChartContainer'); // NEW
  const LossIssuerCombinedESChartContainer = document.getElementById('LossIssuerCombinedESChartContainer'); // NEW

  // Set all containers visible except the combined chart (it stays visible)
  if (EADMainDataContainer) EADMainDataContainer.style.display = 'block';
  if (LossIssuerDataContainerRating) LossIssuerDataContainerRating.style.display = 'block';
  if (LossIssuerDataContainerMarket) LossIssuerDataContainerMarket.style.display = 'block';

  // 🔥 Always ensure combined chart is visible
  if (LossIssuerCombinedChartContainer) LossIssuerCombinedChartContainer.style.display = 'block';
  if (LossIssuerCombinedESChartContainer) LossIssuerCombinedESChartContainer.style.display = 'block';

  setupEventListeners();
}


function setupEventListeners() {
  const lossIssuerRatingButton = document.querySelector('.chart-button[data-chart="LossIssuerChartRating"]');
  const lossIssuerMarketButton = document.querySelector('.chart-button[data-chart="LossIssuerChartMarket"]');
  const lossIssuerMarketNormButton = document.querySelector('.chart-button[data-chart="LossIssuerChartMarketNorm"]');
  const eadButton = document.querySelector('.chart-button[data-chart="EADChart"]');
  const lgdButton = document.querySelector('.chart-button[data-chart="LGDChart"]');
  
  toggleDisplay('EAD');

  lossIssuerRatingButton.addEventListener('click', () => toggleDisplay('LossIssuerRating'));
  lossIssuerMarketButton.addEventListener('click', () => toggleDisplay('LossIssuerMarket'));
  lossIssuerMarketNormButton.addEventListener('click', () => toggleDisplay('LossIssuerMarketNorm'));
  eadButton.addEventListener('click', () => toggleDisplay('EAD'));
  lgdButton.addEventListener('click', () => toggleDisplay('LGD'));
}

function toggleDisplay(chartType) {
  const dataContainers = {
    'EAD': 'EADMainDataContainer',
    'LossIssuerRating': 'LossIssuerDataContainerRating',
    'LossIssuerMarket': 'LossIssuerDataContainerMarket',
    'LossIssuerMarketNorm': 'LossIssuerDataContainerMarketNorm'
  };

  const chartContainers = {
    'EAD': 'EADChartContainer',
    'LGD': 'LGDChartContainer', 
    'LossIssuerRating': 'LossIssuerChartContainerRating',
    'LossIssuerMarket': 'LossIssuerChartContainerMarket',
    'LossIssuerMarketNorm': 'LossIssuerChartContainerMarketNorm'
  };

  Object.keys(dataContainers).forEach(key => {
    const containerId = dataContainers[key];
    const container = document.getElementById(containerId);
    if (!container) {
      console.error('Container not found for key:', key, 'ID:', containerId);
    } else {
      container.style.display = (key === chartType || (key === 'EAD' && chartType === 'LGD')) ? 'block' : 'none';
    }
  });

  Object.keys(chartContainers).forEach(key => {
    const chartContainerId = chartContainers[key];
    const chartContainer = document.getElementById(chartContainerId);
    if (!chartContainer) {
      console.error('Chart container not found for key:', key, 'ID:', chartContainerId);
    } else {
      // 🔥 Do not hide the combined chart
      if (chartContainerId !== 'LossIssuerCombinedChartContainer' && chartContainerId !== 'LossIssuerCombinedESChartContainer') {
        // Your logic here
      }
       {
        chartContainer.style.display = key === chartType ? 'block' : 'none';
      }
    }
  });
}



export function processAndSortLossIssuerData(receivedData) {
  let columns = ['CONVI', 'DEFAULTS', 'ISSUER_RANK', 'LOSS'];
  let filteredData = filterColumnsInData(receivedData, columns);

  // Sort the data
  return filteredData;
}

export function createLossIssuerChart(data, chartId, type) {
  // 🔥 Destroy the old chart if it exists
  if (window[chartId] && typeof window[chartId].destroy === 'function') {
    window[chartId].destroy();
  }

  // 🔥 Limit the data to the first 15 rows
  const limitedData = data.slice(0, 15);
  const labels = limitedData.map(d => d.DEFAULTS);
  const values = limitedData.map(d => d.LOSS);

  // 🔥 Set the color based on the type ('rating' = blue, 'market' = orange, 'norm' = green)
  let barColor;
  if (type === 'market') {
    barColor = 'rgba(255, 165, 0, 0.7)'; // Orange
  } else if (type === 'norm') {
    barColor = 'rgba(144, 238, 144, 0.7)'; // Light Green (semi-transparent)
  } else {
    barColor = 'rgba(70, 192, 230, 0.7)'; // Blue for Rating
  }

  // 🔥 Create color array and highlight the 10th bar in red
  const barColors = limitedData.map((_, index) => 
    index === 9 ? '#ff6666' : barColor
  );

  // 🔥 Create the new chart and store it in `window`
  window[chartId] = createBarChart({ 
    labels: labels, 
    datasets: [{ 
      label: type === 'market' ? 'Market Losses' : type === 'norm' ? 'Norm Losses' : 'Rating Losses',
      data: values, 
      backgroundColor: barColors, 
      borderColor: barColors 
    }] 
  }, chartId, 'bar', 'y');
}


//VaR
export function createCombinedLossIssuerChart(ratingData, marketData, marketNormData, chartId) {
  if (!window.charts) window.charts = {}; 
  if (window.charts[chartId] && typeof window.charts[chartId].destroy === 'function') {
    window.charts[chartId].destroy();
  }

  const chartElement = document.getElementById(chartId);
  if (!chartElement) {
    console.error(`Chart element with ID "${chartId}" not found.`);
    return; 
  }

  // 🔥 Combine the CONVI labels from all datasets (remove duplicates)
  const allConvIValues = Array.from(new Set([
    ...ratingData.map(d => d.CONVI), 
    ...marketData.map(d => d.CONVI),
    ...marketNormData.map(d => d.CONVI)
  ])).sort((a, b) => a - b);

  // 🔥 Map the LOSS and ISSUER_RANK for each CONVI in all datasets
  const ratingValues = allConvIValues.map(convI => {
    const found = ratingData.find(d => d.CONVI === convI);
    return found ? found.LOSS : 0; 
  });

  const marketValues = allConvIValues.map(convI => {
    const found = marketData.find(d => d.CONVI === convI);
    return found ? found.LOSS : 0; 
  });

  const marketNormValues = allConvIValues.map(convI => {
    const found = marketNormData.find(d => d.CONVI === convI);
    return found ? found.LOSS : 0; 
  });

  const issuerRanksRating = allConvIValues.map(convI => {
    const found = ratingData.find(d => d.CONVI === convI);
    return found ? found.ISSUER_RANK : 'N/A';
  });

  const issuerRanksMarket = allConvIValues.map(convI => {
    const found = marketData.find(d => d.CONVI === convI);
    return found ? found.ISSUER_RANK : 'N/A';
  });

  const issuerRanksMarketNorm = allConvIValues.map(convI => {
    const found = marketNormData.find(d => d.CONVI === convI);
    return found ? found.ISSUER_RANK : 'N/A';
  });

  // 🔥 Colors for the chart bars
  const highlightColor = 'rgba(255, 0, 0, 0.9)'; // Red for highlight
  const defaultRatingColor = 'rgba(0, 191, 255, 1)'; // Bright Blue for Rating 
  const defaultMarketColor = 'rgba(255, 165, 0, 0.7)'; // Light Orange (semi-transparent)
  const defaultMarketNormColor = 'rgba(144, 238, 144, 0.7)'; // Light Green (semi-transparent)

  const ratingBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor : defaultRatingColor);
  const marketBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor : defaultMarketColor);
  const marketNormBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor : defaultMarketNormColor);

  // 🔥 Create the new chart with 3 datasets
  window.charts[chartId] = new Chart(chartElement.getContext('2d'), {
    type: 'bar',
    data: { 
      labels: allConvIValues, 
      datasets: [
        { 
          label: 'Losses from Rating',
          data: ratingValues, 
          backgroundColor: ratingBarColors, 
          borderColor: ratingBarColors, 
        },
        { 
          label: 'Losses from Market',
          data: marketValues, 
          backgroundColor: marketBarColors, 
          borderColor: marketBarColors, 
        },
        { 
          label: 'Losses from Market Norm',
          data: marketNormValues, 
          backgroundColor: marketNormBarColors, 
          borderColor: marketNormBarColors, 
        }
      ] 
    }, 
    options: {
      indexAxis: 'x', 
      scales: {
        x: {
          reverse: true, 
          title: {
            display: true,
            text: 'CONVI'
          },
        },
        y: {
          title: {
            display: true,
            text: 'Loss Amount'
          }
        }
      },
      plugins: {
        zoom: {
          pan: {
            enabled: true, 
            mode: 'x', 
          },
          zoom: {
            drag: {
              enabled: true 
            },
            wheel: {
              enabled: true, 
            },
            pinch: {
              enabled: true, 
            },
            mode: 'x', 
            onZoomComplete: ({chart}) => {
              const minIndex = chart.scales.x.min;
              const maxIndex = chart.scales.x.max;

              const fullRangeMin = 0;
              const fullRangeMax = allConvIValues.length// - 1;

              if (minIndex === fullRangeMin && maxIndex === fullRangeMax) {
                // console.log('Already at full zoom-out, no further action.');
                return; 
              }

              if ((maxIndex - minIndex) < 0) {
                chart.resetZoom();
              }

              // console.log('Zoom Complete:', minIndex, maxIndex);
            }
          },
          limits: {
            x: { 
              min: 0, 
              max: allConvIValues.length// - 1, 
            },
            y: { 
              min: 0 
            }
          },
        },
        tooltip: {
          callbacks: {
            title: (context) => {
              const index = context[0].dataIndex;
              return `CONVI: ${allConvIValues[index]}`;
            },
            label: (context) => {
              const index = context.dataIndex;
              const datasetLabel = context.dataset.label;

              const lossValue = new Intl.NumberFormat('en-US', { maximumFractionDigits: 0 }).format(context.raw); 

              let issuerRank = 'N/A';
              if (context.datasetIndex === 0) {
                issuerRank = issuerRanksRating[index];
              } else if (context.datasetIndex === 1) {
                issuerRank = issuerRanksMarket[index];
              } else if (context.datasetIndex === 2) {
                issuerRank = issuerRanksMarketNorm[index];
              }

              return `${datasetLabel}: ${lossValue}, Issuer: ${issuerRank}`;
            }
          }
        }
      }
    }
  });
}

//ES
export function createCombinedLossIssuerESChart(ratingData, marketData, marketNormData, chartId) {
  if (!window.charts) window.charts = {}; 
  if (window.charts[chartId] && typeof window.charts[chartId].destroy === 'function') {
    window.charts[chartId].destroy();
  }

  const chartElement = document.getElementById(chartId);
  if (!chartElement) {
    console.error(`Chart element with ID "${chartId}" not found.`);
    return; 
  }

  // 🔥 Filter CONVI values to only include those from 99.9 to 99.89
  const allConvIValues = Array.from(new Set([
    ...ratingData.map(d => d.CONVI), 
    ...marketData.map(d => d.CONVI),
    ...marketNormData.map(d => d.CONVI)
  ])).filter(convI => convI <= 99.99 && convI >= 99.90).sort((a, b) => a - b);

  // 🔥 Map the LOSS and ISSUER_RANK for each CONVI in all datasets
  const ratingValues = allConvIValues.map(convI => {
    const found = ratingData.find(d => d.CONVI === convI);
    return found ? found.LOSS : 0; 
  });

  const marketValues = allConvIValues.map(convI => {
    const found = marketData.find(d => d.CONVI === convI);
    return found ? found.LOSS : 0; 
  });

  const marketNormValues = allConvIValues.map(convI => {
    const found = marketNormData.find(d => d.CONVI === convI);
    return found ? found.LOSS : 0; 
  });

  const issuerRanksRating = allConvIValues.map(convI => {
    const found = ratingData.find(d => d.CONVI === convI);
    return found ? found.ISSUER_RANK : 'N/A';
  });

  const issuerRanksMarket = allConvIValues.map(convI => {
    const found = marketData.find(d => d.CONVI === convI);
    return found ? found.ISSUER_RANK : 'N/A';
  });

  const issuerRanksMarketNorm = allConvIValues.map(convI => {
    const found = marketNormData.find(d => d.CONVI === convI);
    return found ? found.ISSUER_RANK : 'N/A';
  });

  // 🔥 Calculate averages for the first 10 entries in each dataset
  const calculateAverage = (values) => {
    const firstTenValues = values.slice(0, 10);
    // console.log('Values used to calculate average:', firstTenValues);
    const sum = firstTenValues.reduce((acc, val) => acc + val, 0);
    return firstTenValues.length > 0 ? sum / firstTenValues.length : 0;
  };

  const averageRating = calculateAverage(ratingValues);
  const averageMarket = calculateAverage(marketValues);
  const averageMarketNorm = calculateAverage(marketNormValues);

  // 🔥 Colors for the chart bars
  const highlightColor1 = 'rgba(255, 0, 0, 0.9)'; // Red for highlight 1
  const highlightColor2 = 'rgba(200, 0, 0, 0.9)'; // Darker Red for highlight 2
  const highlightColor3 = 'rgba(150, 0, 0, 0.9)'; // Even Darker Red for highlight 3
  const defaultRatingColor = 'rgba(0, 191, 255, 1)'; // Bright Blue for Rating 
  const defaultMarketColor = 'rgba(255, 165, 0, 0.7)'; // Light Orange (semi-transparent)
  const defaultMarketNormColor = 'rgba(144, 238, 144, 0.7)'; // Light Green (semi-transparent)

  const ratingBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor1 : defaultRatingColor);
  const marketBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor2 : defaultMarketColor);
  const marketNormBarColors = allConvIValues.map(convI => convI === 99.9 ? highlightColor3 : defaultMarketNormColor);

  // 🔥 Create the new chart with 3 datasets
  window.charts[chartId] = new Chart(chartElement.getContext('2d'), {
    type: 'bar',
    data: { 
      labels: allConvIValues, 
      datasets: [
        { 
          label: 'VaR Rating',
          data: ratingValues, 
          backgroundColor: ratingBarColors, 
          borderColor: ratingBarColors, 
          borderWidth: 1,
          borderDash: [5, 5],
        },
        { 
          label: 'VaR Market',
          data: marketValues, 
          backgroundColor: marketBarColors, 
          borderColor: marketBarColors, 
          borderWidth: 1,
          borderDash: [10, 5],
        },
        { 
          label: 'VaR Market Norm',
          data: marketNormValues, 
          backgroundColor: marketNormBarColors, 
          borderColor: marketNormBarColors, 
          borderWidth: 1,
          borderDash: [2, 2],
        },
        {
          label: 'ES Rating',
          data: Array(allConvIValues.length).fill(averageRating),
          type: 'line',
          borderColor: 'rgba(0, 191, 255, 1)',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
        },
        {
          label: 'ES Market',
          data: Array(allConvIValues.length).fill(averageMarket),
          type: 'line',
          borderColor: 'rgba(255, 165, 0, 0.7)',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
        },
        {
          label: 'ES Market Norm',
          data: Array(allConvIValues.length).fill(averageMarketNorm),
          type: 'line',
          borderColor: 'rgba(144, 238, 144, 0.7)',
          borderDash: [5, 5],
          borderWidth: 2,
          fill: false,
        }
      ] 
    }, 
    options: {
      indexAxis: 'x', 
      scales: {
        x: {
          reverse: true, 
          title: {
            display: true,
            text: 'CONVI'
          },
        },
        y: {
          title: {
            display: true,
            text: 'Loss Amount'
          }
        }
      },
      plugins: {
        zoom: {
          pan: {
            enabled: true, 
            mode: 'x', 
          },
          zoom: {
            drag: {
              enabled: true 
            },
            wheel: {
              enabled: true, 
            },
            pinch: {
              enabled: true, 
            },
            mode: 'x'
          },
          limits: {
            x: { 
              min: 0, 
              max: allConvIValues.length - 1, 
            },
            y: { 
              min: 0 
            }
          },
        },
        tooltip: {
          callbacks: {
            title: (context) => `CONVI: ${allConvIValues[context[0].dataIndex]}`
          }
        }
      }
    }
  });
}









