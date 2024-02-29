function createLineChart(datasets, chartName, chartTitle, pointRadius) {
  var ctx = document.getElementById(chartName).getContext("2d");
  Chart.defaults.font.color = "rgb(161, 160, 160)";

  // Define a color palette with fixed colors
  const colorPalette = [
    "rgba(75, 192, 192, 1)",   // Green
    "rgba(233, 30, 99, 1)",    // Pink
    "rgba(0, 150, 136, 1)",    // Teal
    "rgba(255, 152, 0, 1)",    // Orange
    "rgba(156, 39, 176, 1)",   // Purple
    "rgba(0, 188, 212, 1)",    // Cyan
    "rgba(255, 87, 34, 1)",    // Red
    "rgba(255, 193, 7, 1)",    // Yellow
    "rgba(33, 150, 243, 1)",   // Blue
    "rgba(63, 81, 181, 1)",    // Indigo
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

  // Range selector input
  const rangeSelector = document.createElement("input");
  rangeSelector.type = "range";
  rangeSelector.min = 0;
  rangeSelector.max = xValues.length - 1;
  rangeSelector.value = xValues.length - 1;
  rangeSelector.style.width = "100%";
  rangeSelector.addEventListener("input", () => {
    const startIdx = Math.max(0, xValues.length - parseInt(rangeSelector.value, 10));
    const endIdx = xValues.length - 1;
    chart.options.scales.x.min = xValues[startIdx];
    chart.options.scales.x.max = xValues[endIdx];
    chart.update("none");
  });

  // Append the range selector input to the chart container
  document.getElementById(chartName).parentNode.appendChild(rangeSelector);

  return chart; // Return the created chart instance
}

export default createLineChart;








