export function installChartTrace() {
  const tryPatch = () => {
    if (!window.Chart || window.__chartTraceInstalled) return false;

    window.__chartTraceInstalled = true;

    const OriginalChart = window.Chart;

    window.Chart = function tracedChart(ctx, config) {
      console.warn('[CHART CREATED]', {
        type: config?.type,
        canvasId: ctx?.canvas?.id,
        stack: new Error().stack,
      });

      return new OriginalChart(ctx, config);
    };

    Object.assign(window.Chart, OriginalChart);
    window.Chart.prototype = OriginalChart.prototype;

    console.log('[CHART TRACE] installed');
    return true;
  };

  if (tryPatch()) return;

  const timer = setInterval(() => {
    if (tryPatch()) clearInterval(timer);
  }, 50);

  setTimeout(() => clearInterval(timer), 5000);
}