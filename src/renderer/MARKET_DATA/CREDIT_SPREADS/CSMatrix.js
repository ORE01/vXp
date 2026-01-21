import { createCSLineChart } from '../../../charts/LineChart.js';
import { getCSColors } from '../../../utils/colors.js'; 

export function handleCSMatrixData(receivedData) {
 console.log('handleCSMatrixData:', receivedData )


  const ratings = ['AAA', 'AA+', 'AA', 'AA-', 'A+', 'A', 'A-', 'BBB+', 'BBB', 'BBB-', 'BB+', 'BB'];

  const dataArrayWithRating = receivedData.map((data, index) => ({
    RATING: ratings[index],
    ...data,
  }));

  // Extract numeric data (alle Keys außer RATING)
  const dataArray = dataArrayWithRating.map(obj => {
    return Object.keys(obj)
      .filter(key => key !== 'RATING')
      .map(key => obj[key]);
  });

  // X-Achse: Years
  const years = Object.keys(dataArrayWithRating[0]).filter(key => key !== 'RATING');

  // Chart Data (mit getCSColors statt lineColors)
  const chartData = {
    labels: years,
    datasets: ratings.map((rating, index) => {
      const cs = getCSColors(index, 0.6); // index=0 => True Red, danach BASE_COLORS weiter

      return {
        label: rating,
        data: dataArray[index],
        borderColor: cs.borderColor,
        backgroundColor: cs.backgroundColor, // Legend-Kästchen gefüllt
        borderWidth: 1,
        fill: false,
        hidden: !['AAA', 'AA', 'A', 'BBB', 'BB'].includes(rating),
      };
    }),
  };

  const chartOptions = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      title: {
        display: true,
        text: 'Credit Spreads in Basis Points',
        fontSize: 16,
      },
    },
    scales: {
      x: { beginAtZero: true },
      y: {
        suggestedMin: 0,
        suggestedMax: 300,
      },
    },
  };

  // Canvas holen + bestehendes Chart zerstören
  const canvas = document.getElementById('CS_ChartCanvas');
  const existingChart = Chart.getChart(canvas);
  if (existingChart) existingChart.destroy();

  // Render
  createCSLineChart(chartData, chartOptions);
}

