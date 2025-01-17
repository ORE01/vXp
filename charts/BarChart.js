function createBarChart(data, chartName, Type, IndexAxis) {
    //console.log('data.datasets:', data.datasets);
    const ctx = document.getElementById(chartName).getContext('2d');
    
    const chart = new Chart(ctx, {
      type: Type,
      data: {
        labels: data.labels,
        datasets: data.datasets
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: IndexAxis,
        scales: {
          y: {
            beginAtZero: true, // Start the Y-axis from 0
            ticks: {
              autoSkip: false, // Do not skip labels
              //maxTicksLimit: 200 // Set the maximum number of ticks to display
            }
          }
        }
      }
    });
    return chart;
  }
  
  export default createBarChart;
