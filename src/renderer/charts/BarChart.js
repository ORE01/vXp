// function createBarChart(data, chartName, Type = 'bar', IndexAxis = 'y') {
//   // 🔹 Canvas robust holen
//   const canvas = document.getElementById(chartName);
//   if (!canvas) {
//     console.warn(`[BarChart] Canvas mit ID "${chartName}" nicht gefunden – Chart wird nicht gerendert.`);
//     return null;
//   }

//   const ctx = canvas.getContext('2d');
//   if (!ctx) {
//     console.warn(`[BarChart] getContext('2d') für "${chartName}" ist null – Chart wird nicht gerendert.`);
//     return null;
//   }

//   const chart = new Chart(ctx, {
//     type: Type,
//     data: {
//       labels: data.labels,
//       datasets: data.datasets
//     },
//     options: {
//       responsive: true,
//       maintainAspectRatio: false,
//       indexAxis: IndexAxis,

//       // 👉 WICHTIG: Resize entlasten
//       resizeDelay: 150,          // throttled Resize-Handler
//       animation: { duration: 0 },// keine Anim bei (Re-)Render/Resize
//       normalized: true,          // numerische Daten normalisieren

//       scales: {
//         y: {
//           beginAtZero: true,
//           ticks: {
//             autoSkip: false
//           }
//         }
//       }
//     }
//   });

//   return chart;
// }


// export default createBarChart;




function createBarChart(data, chartName, Type = 'bar', IndexAxis = 'y') {
  const canvas = document.getElementById(chartName);

  if (!canvas) {
    console.warn(`[BarChart] Canvas mit ID "${chartName}" nicht gefunden – Chart wird nicht gerendert.`);
    return null;
  }

  if (!canvas.isConnected) {
    console.warn(`[BarChart] Canvas "${chartName}" ist nicht im DOM verbunden – Chart wird nicht gerendert.`);
    return null;
  }

  const ctx = canvas.getContext('2d');

  if (!ctx) {
    console.warn(`[BarChart] getContext('2d') für "${chartName}" ist null – Chart wird nicht gerendert.`);
    return null;
  }

  // CRITICAL:
  // Chart.js erlaubt nur eine aktive Chart-Instanz pro Canvas.
  // Deshalb zuerst vorhandene Instanz zerstören.
  if (typeof Chart !== 'undefined' && typeof Chart.getChart === 'function') {
    const existingChart = Chart.getChart(canvas);

    if (existingChart) {
      try {
        existingChart.destroy();
      } catch (error) {
        console.warn(`[BarChart] Alter Chart auf "${chartName}" konnte nicht zerstört werden.`, error);
      }
    }
  }

  try {
    const chart = new Chart(ctx, {
      type: Type,
      data: {
        labels: Array.isArray(data?.labels) ? data.labels : [],
        datasets: Array.isArray(data?.datasets) ? data.datasets : [],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        indexAxis: IndexAxis,

        resizeDelay: 150,
        animation: false,
        normalized: true,

        // CRITICAL:
        // Verhindert addEventListener-null-Crashes bei reinen Dashboard-Charts.
        events: [],

        plugins: {
          legend: {
            display: true,
          },

          // CRITICAL:
          // Wenn chartjs-plugin-annotation global registriert ist,
          // darf es auf diesen simplen BarCharts nicht laufen.
          annotation: false,
        },

        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              autoSkip: false,
            },
          },
        },
      },
    });

    return chart;
  } catch (error) {
    console.error(`[BarChart] Chart "${chartName}" konnte nicht erstellt werden.`, error);
    return null;
  }
}

export default createBarChart;