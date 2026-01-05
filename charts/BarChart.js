function createBarChart(data, chartName, Type = 'bar', IndexAxis = 'y') {
  // 🔹 Canvas robust holen
  const canvas = document.getElementById(chartName);
  if (!canvas) {
    console.warn(`[BarChart] Canvas mit ID "${chartName}" nicht gefunden – Chart wird nicht gerendert.`);
    return null;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn(`[BarChart] getContext('2d') für "${chartName}" ist null – Chart wird nicht gerendert.`);
    return null;
  }

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
