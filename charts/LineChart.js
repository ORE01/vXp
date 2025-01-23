let chartInstance = null;
let futurePredictionsChartInstance = null;
let FWDlineChartInstance;
let isDrawing = false; // Variable to track if the mouse is being pressed
let debounceTimeout;


export default function createLineChart(datasets, chartName, chartTitle, pointRadius, modalIndex, smaPeriods) {
  const canvasElement = document.getElementById(chartName);

  if (!canvasElement) {
    console.error(`Canvas element with ID "${chartName}" not found.`);
    return null;
  }

  const ctx = canvasElement.getContext("2d");

  if (!ctx) {
    console.error(`Failed to get 2D context for canvas with ID "${chartName}".`);
    return null;
  }

  // Array to store both original datasets and their corresponding MAs
  const allDatasets = [];

  // Iterate over all selected datasets
  datasets.forEach((dataset, index) => {
    console.log(`Processing dataset [${dataset.label}] with data:`, dataset.data);

    // Original dataset (solid line)
    const originalDataset = {
      label: dataset.label,  // Original dataset label
      data: dataset.data.map(dataPoint => ({
        x: dataPoint.x,
        y: dataPoint.y,
        originalY: dataPoint.originalY
      })),
      fill: false,
      borderColor: getColorFromPalette(index),  // Assign unique color for each dataset
      tension: 0.1,
      pointRadius: pointRadius,
      borderWidth: 1,
      spanGaps: false,
      borderDash: []  // Solid line for original dataset
    };

    // Add the original dataset to the array
    allDatasets.push(originalDataset);

    // Check and add multiple SMAs if the data exists
    ['smaData1', 'smaData2', 'smaData3'].forEach((smaKey, smaIndex) => {
      if (dataset[smaKey] && dataset[smaKey].length > 0) {
        const period = smaPeriods[`sma${smaIndex + 1}`]; // Use the respective period (e.g., 20, 50, 200)
        console.log(`Adding SMA ${period} for dataset [${dataset.label}]`);

        const maDataset = {
          label: `${dataset.label} (SMA ${period})`,  // MA dataset label
          data: dataset[smaKey].map(dataPoint => ({
            x: dataPoint.x,
            y: dataPoint.y
          })),
          fill: false,
          borderColor: `rgba(${255 - (smaIndex * 50)}, 0, 0, 0.5)`,  // Different red shades for each SMA
          borderDash: [5, 5],  // Dotted line for MA
          tension: 0.1,
          pointRadius: 0,  // No points for MA
          borderWidth: 2,
          spanGaps: false,
        };

        allDatasets.push(maDataset);
        console.log(`Added SMA ${period} dataset for [${dataset.label}]`);
      }
    });
  });

  // Create the chart
  let chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: datasets[0].data.map(dataPoint => dataPoint.x), // Use x-values from the first dataset
      datasets: allDatasets // Pass the original datasets and MAs
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Year",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Value",
          },
        },
      },
      plugins: {
        tooltip: {
          enabled: true,
          callbacks: {
            label: function(context) {
              if (context.dataset.label.includes('SMA')) {
                // If the dataset is a moving average (SMA), display its y value directly
                return `${context.dataset.label}: ${context.raw.y !== null ? context.raw.y.toFixed(2) : 'N/A'}`;
              } else {
                // For the original dataset, use the originalY value to avoid normalized data
                const originalValue = context.raw ? context.raw.originalY : null;
                return `${context.dataset.label}: ${typeof originalValue === 'number' ? originalValue.toFixed(2) : 'N/A'}`;
              }
            }
          }
        },
        
        zoom: {
          pan: {
            enabled: true,
            mode: 'x', // Pan along the x-axis
          },
          zoom: {
            drag: {
              enabled: true, // Enable drag-to-zoom feature
            },
            wheel: {
              enabled: true, // Enable zooming with the mouse wheel
            },
            pinch: {
              enabled: true, // Enable zooming by pinching on touch devices
            },
            mode: 'x', // Zoom along the x-axis
          },
        },
      }
    }
  });

  setupChartButtons(chartInstance, datasets, modalIndex);

  return chartInstance;
}



function setupChartButtons(chartInstance, datasets, modalIndex) {
  const filteredDatasetsCopy = JSON.parse(JSON.stringify(datasets));

  function getMaxYearsAvailable() {
    let maxYearsAvailable = 0;
    filteredDatasetsCopy.forEach((dataset) => {
      if (!dataset || !dataset.data) return;

      const firstValidIndex = dataset.data.findIndex(({ y }) => y !== null && !isNaN(y));
      const lastValidIndex = dataset.data.length - 1 - [...dataset.data].reverse().findIndex(({ y }) => y !== null && !isNaN(y));

      if (firstValidIndex !== -1 && lastValidIndex !== -1) {
        const firstDate = parseDateString(dataset.data[firstValidIndex].x);
        const lastDate = parseDateString(dataset.data[lastValidIndex].x);
        const yearsAvailable = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365.25);

        maxYearsAvailable = Math.max(maxYearsAvailable, yearsAvailable);
      }
    });

    return maxYearsAvailable;
  }

  function filterDataByTimeRange(yearsBack) {
    const maxYearsAvailable = getMaxYearsAvailable();
    const actualYearsBack = Math.min(yearsBack, maxYearsAvailable);

    const today = new Date();
    const targetDate = new Date(today.setFullYear(today.getFullYear() - actualYearsBack));

    console.log(`Target date for ${actualYearsBack} years back:`, targetDate);

    const filteredDatasets = JSON.parse(JSON.stringify(filteredDatasetsCopy));

    filteredDatasets.forEach((dataset) => {
      if (!dataset || !dataset.data) return;

      dataset.data = dataset.data.filter(dataPoint => {
        const dataDate = parseDateString(dataPoint.x);
        return dataDate >= targetDate;
      });

      // Filter each SMA data set if it exists (SMA 1, SMA 2, SMA 3)
      ['smaData1', 'smaData2', 'smaData3'].forEach(smaKey => {
        if (dataset[smaKey]) {
          dataset[smaKey] = dataset[smaKey].filter(dataPoint => {
            const dataDate = parseDateString(dataPoint.x);
            return dataDate >= targetDate;
          });
        }
      });
    });

    // Check which SMA is selected
    const applySMA1 = document.getElementById(`applySMA1_${modalIndex}`).checked;
    const applySMA2 = document.getElementById(`applySMA2_${modalIndex}`).checked;
    const applySMA3 = document.getElementById(`applySMA3_${modalIndex}`).checked;

    // Always load original dataset(s)
    chartInstance.data.labels = filteredDatasets[0]?.data.map(dataPoint => dataPoint.x) || [];
    
    const finalDatasets = [];
    filteredDatasets.forEach((dataset, index) => {
      finalDatasets.push({
        label: dataset.label,
        data: dataset.data,
        borderColor: getColorFromPalette(index),
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2
      });

      // Push SMA datasets only if they are selected
      if (applySMA1 && dataset.smaData1) {
        finalDatasets.push({
          label: `${dataset.label} (SMA 1)`,
          data: dataset.smaData1,
          borderColor: 'rgba(255, 0, 0, 0.8)',  // Bright orange
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        });
      }
      if (applySMA2 && dataset.smaData2) {
        finalDatasets.push({
          label: `${dataset.label} (SMA 2)`,
          data: dataset.smaData2,
          borderColor: 'rgba(50, 205, 50, 0.8)',  // Bright lime green
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        });
      }
      if (applySMA3 && dataset.smaData3) {
        finalDatasets.push({
          label: `${dataset.label} (SMA 3)`,
          data: dataset.smaData3,
          borderColor: 'rgba(57, 255, 255, 0.8)',  // light blue
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        });
      }
    });

    chartInstance.data.datasets = finalDatasets;
    chartInstance.update();
  }

  function bindButton(buttonId, yearsBack) {
    const button = document.getElementById(buttonId);
    if (!button) {
      console.error(`Button with ID ${buttonId} not found.`);
      return;
    }
    button.replaceWith(button.cloneNode(true)); // Replace to reset event listeners
    const newButton = document.getElementById(buttonId);
    newButton.addEventListener('click', () => {
      chartInstance.resetZoom();
      filterDataByTimeRange(yearsBack);
    });
  }

  // Bind buttons with the appropriate year ranges
  bindButton(`oneYearButton_${modalIndex}`, 1);
  bindButton(`fiveYearButton_${modalIndex}`, 5);
  bindButton(`tenYearButton_${modalIndex}`, 10);
  bindButton(`maxButton_${modalIndex}`, 50);

  // Default to a 5-year view
  filterDataByTimeRange(5);
}




// Function to parse 'dd-mm-yyyy' format into a valid Date object
function parseDateString(dateString) {
  const [day, month, year] = dateString.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed in JS Date
}

// Function to get color from the color palette based on the index
function getColorFromPalette(index) {
  const colorPalette = [
    "rgba(255, 255, 0, 1)",     // Bright Yellow
    "rgba(255, 87, 34, 1)",     // Bright Red-Orange
    "rgba(255, 193, 7, 1)",     // Bright Yellow-Orange
    "rgba(0, 255, 255, 1)",     // Bright Cyan
    "rgba(173, 255, 47, 1)",    // Bright Green
    "rgba(255, 105, 180, 1)",   // Hot Pink
    "rgba(75, 0, 130, 1)",      // Indigo
    "rgba(255, 140, 0, 1)",     // Dark Orange
    "rgba(0, 191, 255, 1)",     // Deep Sky Blue
    "rgba(50, 205, 50, 1)",     // Lime Green
  ];

  // Wrap around the palette if the index exceeds its length
  return colorPalette[index % colorPalette.length];
}

export function createFWDLineChart(datasets, chartName, chartTitle, pointRadius) {
  const canvas = document.getElementById(chartName);

  // Clear existing event listeners and destroy the previous chart instance, if it exists
  if (FWDlineChartInstance) {
    FWDlineChartInstance.destroy();
  }

  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);

  var ctx = newCanvas.getContext("2d");
  Chart.defaults.font.color = "rgb(161, 160, 160)";

  // Define a color palette with brighter colors for a dark gray background
  const colorPalette = [
    "rgba(255, 255, 0, 1)",     // Bright Yellow
    "rgba(255, 87, 34, 1)",     // Bright Red-Orange
    "rgba(255, 193, 7, 1)",     // Bright Yellow-Orange
    "rgba(0, 255, 255, 1)",     // Bright Cyan
    "rgba(173, 255, 47, 1)",    // Bright Green
    "rgba(255, 105, 180, 1)",   // Hot Pink
    "rgba(75, 0, 130, 1)",      // Indigo
    "rgba(255, 140, 0, 1)",     // Dark Orange
    "rgba(0, 191, 255, 1)",     // Deep Sky Blue
    "rgba(50, 205, 50, 1)",     // Lime Green
  ];

  const xValues = datasets[0].data.map((dataPoint) => dataPoint.x);

  // Create the chart
  FWDlineChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: xValues,
      datasets: datasets.map((dataset, index) => ({
        label: dataset.label,
        data: dataset.data,
        fill: false,
        borderColor: colorPalette[index % colorPalette.length], // Assign a color from the color palette
        tension: 0.1,
        pointRadius: pointRadius,
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true,
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Year",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Rate (%)",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
      },
      plugins: {
        annotation: {},  // Ensure annotations are disabled completely
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',  // Enable panning on the x-axis
          },
          zoom: {
            wheel: {
              enabled: true,  // Enable zooming with mouse wheel
            },
            pinch: {
              enabled: true,  // Enable zooming with pinch gestures
            },
            mode: 'x',  // Zoom in only on the x-axis
          }
        }
      },
    },
  });

  return FWDlineChartInstance; // Return the created chart instance
}

export function createCSLineChart(data, chartConfig) {
  const ctx = document.getElementById('CS_ChartCanvas').getContext('2d');
  const lineChart = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      ...chartConfig,
      plugins: {
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            threshold: 10,
          },
          zoom: {
            drag:{
              enabled: true
            },
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x',
          },
          limits: {
            x: { minRange: 1 },
          },
        },
      },
    },
  });
}


export function createForwardSwapChart(datasets, chartName, chartTitle, pointRadius) {
  const canvas = document.getElementById(chartName);

  // Clear existing event listeners and destroy the previous chart instance, if it exists
  if (window.forwardSwapChartInstance) {
    window.forwardSwapChartInstance.destroy();
  }

  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);

  var ctx = newCanvas.getContext("2d");
  Chart.defaults.font.color = "rgb(161, 160, 160)";

  // Define a color palette for the forward swap curve chart
  const colorPalette = [
    "rgba(255, 255, 0, 1)",     // Bright Yellow
    "rgba(255, 87, 34, 1)",     // Bright Red-Orange
    "rgba(255, 193, 7, 1)",     // Bright Yellow-Orange
    "rgba(0, 255, 255, 1)",     // Bright Cyan
    "rgba(173, 255, 47, 1)",    // Bright Green
    "rgba(255, 105, 180, 1)",   // Hot Pink
    "rgba(75, 0, 130, 1)",      // Indigo
    "rgba(255, 140, 0, 1)",     // Dark Orange
    "rgba(0, 191, 255, 1)",     // Deep Sky Blue
    "rgba(50, 205, 50, 1)",     // Lime Green
  ];

  // Create the forward swap chart
  window.forwardSwapChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: datasets[0].data.map(dataPoint => dataPoint.x),  // Use the years for the labels from the first dataset
      datasets: datasets.map((dataset, index) => ({
        label: dataset.label,
        data: dataset.data,
        fill: false,
        borderColor: colorPalette[index % colorPalette.length], // Assign a color from the color palette
        tension: 0.1,
        pointRadius: pointRadius,
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true,
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Year",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Rate (%)",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
      },
      plugins: {
        annotation: {},  // Ensure annotations are disabled completely
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',  // Enable panning on the x-axis
          },
          zoom: {
            wheel: {
              enabled: true,  // Enable zooming with mouse wheel
            },
            pinch: {
              enabled: true,  // Enable zooming with pinch gestures
            },
            mode: 'x',  // Zoom in only on the x-axis
          }
        }
      },
    },
  });

  return window.forwardSwapChartInstance; // Return the created chart instance
}

export function createRatesLineChart(datasets, chartName, chartTitle, pointRadius) {
  var ctx = document.getElementById(chartName).getContext("2d");
  Chart.defaults.font.color = "rgb(161, 160, 160)";

  // Define a color palette with fixed colors
  const colorPalette = [
    "rgba(255, 255, 0, 1)",     // Bright Yellow
    "rgba(255, 87, 34, 1)",     // Bright Red-Orange
    "rgba(255, 193, 7, 1)",     // Bright Yellow-Orange
    "rgba(0, 255, 255, 1)",     // Bright Cyan
    "rgba(173, 255, 47, 1)",    // Bright Green
    "rgba(255, 105, 180, 1)",   // Hot Pink
    "rgba(75, 0, 130, 1)",      // Indigo
    "rgba(255, 140, 0, 1)",     // Dark Orange
    "rgba(0, 191, 255, 1)",     // Deep Sky Blue
    "rgba(50, 205, 50, 1)",     // Lime Green
  ];
  

  const xValues = datasets[0].data.map((dataPoint) => dataPoint.x);

  // Create the chart and store it in a variable
  const chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: xValues,
      datasets: datasets.map((dataset, index) => ({
        label: dataset.label,
        data: dataset.data,
        fill: false,
        borderColor: colorPalette[index % colorPalette.length], // Assign a color from the color palette
        tension: 0.1,
        pointRadius: pointRadius,
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true,
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Year",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Rate (%)",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
          legend: {
            labels: {
              color: "rgb(161, 160, 160)",
            },
          },
        },
      },
      plugins: {
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            threshold: 10,
          },
          zoom: {
            drag:{
              enabled: true
            },
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x',
          },
          limits: {
            x: { minRange: 1 },
          },
        },
      },
    },
  });
  return chart; // Return the created chart instance
}

export function futurePredictionsChart(datasets, chartName, chartTitle, pointRadius) {
  const canvas = document.getElementById(chartName);

  if (!canvas) {
    console.error(`Canvas with ID ${chartName} not found`);
    return;
  }

  const ctx = canvas.getContext("2d");

  // Destroy the previous chart instance if it exists
  if (futurePredictionsChartInstance) {
    futurePredictionsChartInstance.destroy();
    console.log("Previous chart instance for future predictions destroyed");
  }

  // Extract x-values for the labels
  const xValues = datasets[0].data.map((dataPoint) => dataPoint.x);

  // Create the chart and store the instance globally
  futurePredictionsChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: xValues,  // Use x values as labels
      datasets: datasets.map((dataset, index) => ({
        label: dataset.label,
        data: dataset.data.map(point => point.y),  // Use y values as the dataset
        fill: false,
        borderColor: "rgba(75, 192, 192, 1)",  // Example color
        tension: 0.1,
        pointRadius: pointRadius,
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "rgb(161, 160, 160)"
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Index",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Predictions",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
      },
    },
  });
}

export function MLTestDataChart(datasets, chartName, chartTitle, pointRadius) {
  
  const canvas = document.getElementById(chartName);
  if (!canvas) {
    console.error(`Canvas with ID ${chartName} not found`);
    return;
  }

  const ctx = canvas.getContext("2d");

  // Destroy the previous chart instance if it exists
  if (window.chartInstance) {
    window.chartInstance.destroy();
    console.log("Previous chart instance destroyed");
  }

  if (!datasets || !datasets.length || !datasets[0].data || !datasets[0].data.length) {
    console.error("Invalid dataset provided for chart:", datasets);
    return;
  }

  // Convert x-values (dates) to timestamps for the chart
  const xValues = datasets[0].data.map(dataPoint => new Date(dataPoint.x).getTime()); // Convert dates to timestamps

  const colors = {
    train: "rgba(0, 123, 255, 1)",  // Blue for Train Data
    test: "rgba(75, 192, 192, 1)",  // Cyan for Test Data
    predictions: "rgba(255, 99, 132, 1)",  // Red for Predictions
    future: "rgba(255, 206, 86, 1)",  // Yellow for Future Predictions
  };

  const lineStyles = {
    solid: [],  // Solid line
    dashed: [5, 5],  // Dashed line for future predictions
  };

  const allDatasets = datasets.map((dataset) => {
    let color, borderDash;
    if (dataset.label === 'Train Data') {
      color = colors.train;
      borderDash = lineStyles.solid;
    } else if (dataset.label === 'Test Data') {
      color = colors.test;
      borderDash = lineStyles.solid;
    } else if (dataset.label === 'Predictions') {
      color = colors.predictions;
      borderDash = lineStyles.solid;
    } else if (dataset.label === 'Future Predictions') {
      color = colors.future;
      borderDash = lineStyles.dashed;
    }

    return {
      label: dataset.label,
      data: dataset.data.map(point => ({ x: new Date(point.x).getTime(), y: point.y })),  // Use timestamps for x values
      fill: false,
      borderColor: color,
      borderDash: borderDash,
      tension: 0.1,
      pointRadius: pointRadius,
      borderWidth: 1,
    };
  });

  window.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: xValues,  // Use timestamps for labels
      datasets: allDatasets
    },
    options: {
      responsive: true,
      plugins: {
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            threshold: 10,
          },
          zoom: {
            drag:{
              enabled: true
            },
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x',
          },
          limits: {
            x: { minRange: 1 },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',  // Linear scale instead of 'time'
          position: 'bottom',
          title: {
            display: true,
            text: 'Date',
            color: 'rgb(161, 160, 160)',
          },
          ticks: {
            color: 'rgb(161, 160, 160)',
            callback: function(value, index, ticks) {
              // Format the timestamp back into a readable date for the x-axis ticks
              const date = new Date(value);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
          },
          grid: {
            color: 'rgb(90, 90, 90)',
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Values',
            color: 'rgb(161, 160, 160)',
          },
          ticks: {
            color: 'rgb(161, 160, 160)',
          },
          grid: {
            color: 'rgb(90, 90, 90)',
          },
        },
      },
    },
  });

  return window.chartInstance;
}
