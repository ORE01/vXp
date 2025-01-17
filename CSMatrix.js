import { createCSLineChart } from './charts/LineChart.js';

export function handleCSMatrixData(receivedData) {
  const ratings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB'];

  const dataArrayWithRating = receivedData.map((data, index) => ({
    RATING: ratings[index],
    ...data,
  }));

  // console.log(dataArrayWithRating);

  // Extract and format the numerical data from the numeric keys (1 to 30)
  const dataArray = dataArrayWithRating.map(obj => {
    return Object.keys(obj)
      .filter(key => key !== 'RATING')
      .map(key => obj[key]); // Divide by 100 to scale the data
  });

  // Extract the column names (years) as labels
  const years = Object.keys(dataArrayWithRating[0]).filter(key => key !== 'RATING');

  // Define fixed colors for the lines
  const lineColors = [
    'rgba(75, 192, 192, 1)',
    'rgba(54, 162, 235, 1)',
    'rgba(255, 206, 86, 1)',
    'rgba(255, 99, 132, 1)',
    'rgba(153, 102, 255, 1)',
    'rgba(0, 255, 0, 1)',
    'rgba(255, 159, 64, 1)',
    'rgba(0, 0, 255, 1)',
    'rgba(255, 0, 0, 1)',
    'rgba(128, 0, 128, 1)',
    'rgba(255, 165, 0, 1)',
    'rgba(0, 128, 128, 1)',
    'rgba(128, 128, 0, 1)',
    // Add more colors as needed
  ];

  // Define chart data and options
  const chartData = {
    labels: years, // Use the years as x-axis labels
    datasets: ratings.map((rating, index) => ({
      label: rating,
      data: dataArray[index], // Use the corresponding data for each rating
      borderColor: lineColors[index], // Assign a fixed color to each line
      borderWidth: 1, // Set the line width to 1 (slim)
      fill: false,
      hidden: !['AAA', 'AA', 'A', 'BBB', 'BB'].includes(rating), // Hide all curves except for 'AAA', 'AA', 'A', 'BBB', 'BB'
    })),
  };

  const chartOptions = {
    responsive: true, // Make the chart responsive
    maintainAspectRatio: false, // Don't maintain the aspect ratio
    plugins: {
      title: {
        display: true,
        text: 'Credit Spreads in Basis Points',
        fontSize: 16,
      },
    },
    scales: {
      x: {
        beginAtZero: true,
      },
      y: {
        suggestedMin: 0,  // Set the minimum y-axis value
        suggestedMax: 300, // Adjust if needed; original suggestedMax was 30, which might be too low for basis points
      },
    },
  };

  // Get the canvas element
  const canvas = document.getElementById('CS_ChartCanvas');

  // Get the Chart.js instance associated with the canvas
  const existingChart = Chart.getChart(canvas);

  // Check if there is an existing chart and destroy it
  if (existingChart) {
    existingChart.destroy();
  }

  // Call the createCSLineChart function with the chartData and chartOptions
  createCSLineChart(chartData, chartOptions);
}

