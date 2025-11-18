function createBarChart(data, chartName, Type, IndexAxis) {
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

      // 👉 WICHTIG: Resize entlasten
      resizeDelay: 150,          // throttled Resize-Handler
      animation: { duration: 0 },// keine Anim bei (Re-)Render/Resize
      normalized: true,          // numerische Daten normalisieren

      scales: {
        y: {
          beginAtZero: true,
          ticks: {
            autoSkip: false
          }
        }
      }
    }
  });

  return chart;
}

export default createBarChart;
