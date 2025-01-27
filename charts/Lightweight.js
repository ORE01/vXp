


// Initialize the chart
const chartContainer = document.getElementById('LWlineChart');
const chart = createChart(chartContainer, { width: 800, height: 400 });

// Add a line series
const lineSeries = chart.addLineSeries();

// Set the data for the series
lineSeries.setData([
    { time: '2023-01-01', value: 50 },
    { time: '2023-01-02', value: 53 },
    { time: '2023-01-03', value: 49 },
    { time: '2023-01-04', value: 52 },
]);

// Adjust chart's time scale
chart.timeScale().fitContent();
