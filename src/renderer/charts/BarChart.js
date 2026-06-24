

function createBarChart(data, chartName, Type = 'bar', IndexAxis = 'y') {
  const canvas = document.getElementById(chartName);

  // CRITICAL:
  // Chart.js responsive mode reads canvas.parentNode internally.
  // If the canvas was removed/rebuilt by the UI, Chart.js crashes with:
  // Cannot read properties of null (reading 'parentNode')
  if (!canvas || !canvas.isConnected || !canvas.parentNode) {
    console.warn(`[BarChart] Canvas "${chartName}" nicht stabil im DOM – Chart wird nicht gerendert.`, {
      exists: !!canvas,
      isConnected: canvas?.isConnected,
      hasParentNode: !!canvas?.parentNode,
    });
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

  // Nach destroy() nochmals prüfen.
  // Bei schnellen UI-Rebuilds kann der Canvas zwischen Guard und Chart-Erstellung entfernt werden.
  if (!canvas.isConnected || !canvas.parentNode) {
    console.warn(`[BarChart] Canvas "${chartName}" wurde während der Chart-Erstellung entfernt – Chart wird nicht gerendert.`);
    return null;
  }

  try {
    // CRITICAL:
    // Since responsive=false, we set the canvas size from its parent container.
    // This keeps the chart visible without letting Chart.js bind async resize events.
    const canvasRect = canvas.getBoundingClientRect();

    if (canvasRect?.width && canvasRect?.height) {
      canvas.width = Math.floor(canvasRect.width);
      canvas.height = Math.floor(canvasRect.height);
    } else {
      const parent = canvas.parentNode;
      const parentRect = parent?.getBoundingClientRect?.();
      canvas.width = Math.floor(parentRect?.width || 800);
      canvas.height = Math.floor(parentRect?.height || 300);
    }

    const chart = new Chart(ctx, {
      type: Type,
      data: {
        labels: Array.isArray(data?.labels) ? data.labels : [],
        // Default-Obergrenze für die Balkenbreite: Bei wenigen Kategorien (z.B.
        // CPV01 mit 2 Rating-Buckets) skaliert Chart.js die Balken sonst extrem
        // breit. maxBarThickness kappt nur zu breite Balken; Charts mit vielen/
        // dünnen Balken bleiben unberührt. Pro Dataset überschreibbar.
        datasets: (Array.isArray(data?.datasets) ? data.datasets : []).map((ds) => ({
          maxBarThickness: 64,
          ...ds,
        })),
      },
      options: {
        // CRITICAL:
        // Dashboard charts are rebuilt often during MVaR / Risk refreshes.
        // Chart.js responsive mode schedules async resize work and can crash
        // if the canvas is removed before the resize callback runs.
        responsive: false,
        maintainAspectRatio: false,
        indexAxis: IndexAxis,

        animation: false,
        normalized: true,

        // Dashboard-BarCharts brauchen keine Mouse-/Touch-Events.
        // Das reduziert Event-Binding-Probleme bei UI-Rebuilds.
        events: [],

        plugins: {
          legend: {
            display: true,
          },

          // Falls chartjs-plugin-annotation global registriert ist,
          // soll es auf simplen BarCharts nicht laufen.
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