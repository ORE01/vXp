import { appState } from '../../renderer.js';


// HELPER: 

      // Globale Zoom-Config bleibt wie gehabt
      const zoomPluginConfig = {
        annotation: {},
        zoom: {
          pan: {
            enabled: true,
            mode: "x"
          },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x"
          }
        }
      };

      /**
       * Standard-Options für Zeitreihen-Charts in Prozent.
       * yTitle: Beschriftung der Y-Achse
       */
      function createPercentChartOptions(yTitle) {
        return {
          responsive: true,
          maintainAspectRatio: false,

          interaction: {
            mode: "nearest",
            intersect: false,
            axis: "x"
          },

          scales: {
            x: {
              title: { display: true, text: "Date" }
            },
            y: {
              position: "left",
              title: { display: true, text: yTitle },
              ticks: {
                callback: (val) => {
                  const num = Number(val);
                  if (isNaN(num)) return "";
                  return (num * 100).toFixed(2) + " %";
                }
              }
            }
          },

          plugins: {
            legend: { display: true },
            tooltip: {
              enabled: true,
              callbacks: {
                label: (ctx) => {
                  const label = ctx.dataset.label || "";
                  const v = ctx.parsed.y;
                  if (v == null || isNaN(v)) return label + ": n/a";
                  return label + ": " + (v * 100).toFixed(2) + " %";
                }
              }
            },
            ...zoomPluginConfig
          }
        };
      }

      /**
       * Erzeugt einen Chart.js-Chart für Zeitreihen.
       * baseType: optionaler Chart-Typ (z. B. "line" oder "bar"), default "line".
       */
      function createTimeSeriesChart(canvasId, data, options, baseType = "line") {
        const canvas = document.getElementById(canvasId);
        if (!canvas) {
          console.error(`❌ Canvas #${canvasId} wurde nicht gefunden.`);
          return null;
        }

        const ctx = canvas.getContext("2d");
        if (!ctx) {
          console.error(`❌ Konnte 2D-Context von #${canvasId} nicht holen.`);
          return null;
        }

        return new Chart(ctx, {
          type: baseType,
          data,
          options
        });
      }

// HISORIC CHARTS:      

// ------------------------------------------------------------
// Market Risk Line Chart (MVaR / ES) – robust render + refresh
// ------------------------------------------------------------

let riskMetricsChartLine = null;
let _riskLastData = null;
let _riskLastOptions = null;


export function renderMarketRiskChartLine() {
  const historyData = appState.getPortfolioHistoryData() || [];
  console.log("🎯 renderMarketRiskChartLine CALLED with rows:", historyData.length);

  if (!Array.isArray(historyData) || historyData.length === 0) {
    console.warn("⚠️ Keine PortfolioHistoryMetrics zum Plotten vorhanden.");
    return;
  }

  const sortedData = [...historyData].sort(
    (a, b) => new Date(a.DATE) - new Date(b.DATE)
  );
  console.log(
    "📅 First DATE:", sortedData[0]?.DATE,
    "Last DATE:", sortedData[sortedData.length - 1]?.DATE
  );

  function readPctSeries(row, keys) {
    for (const k of keys) {
      if (k in row && row[k] != null && row[k] !== "") {
        const v = parseFloat(row[k]);
        if (!isNaN(v)) return v;
      }
    }
    return null;
  }

  const mvarAllPct = sortedData.map(row =>
    readPctSeries(row, ["M_VaR_All_PCT", "M_VaR_ALL_PCT", "MVaR_All_PCT"])
  );
  const mvarIrPct = sortedData.map(row =>
    readPctSeries(row, ["M_VaR_IR_PCT", "M_VaR_IR_pct", "MVaR_IR_PCT"])
  );
  const mvarCsPct = sortedData.map(row =>
    readPctSeries(row, ["M_VaR_CS_PCT", "M_VaR_CS_pct", "MVaR_CS_PCT"])
  );

  const mesAllPct = sortedData.map(row =>
    readPctSeries(row, ["M_ES_ALL_PCT", "M_ES_All_PCT", "M_ES_All_pct"])
  );
  const mesIrPct = sortedData.map(row =>
    readPctSeries(row, ["M_ES_IR_PCT", "M_ES_IR_pct", "MES_IR_PCT"])
  );
  const mesCsPct = sortedData.map(row =>
    readPctSeries(row, ["M_ES_CS_PCT", "M_ES_CS_pct", "MES_CS_PCT"])
  );

  console.log(
    "✅ Sample values:",
    "MVaR All[0]:", mvarAllPct[0],
    "M ES All[0]:", mesAllPct[0]
  );

  // destroy old instance
if (riskMetricsChartLine) {
  console.log("♻️ Destroy existing riskMetricsChartLine instance");
  try {
    riskMetricsChartLine.destroy();
  } catch (err) {
    console.error("⚠️ Fehler beim Destroy von riskMetricsChartLine:", err);
  } finally {
    riskMetricsChartLine = null;   // <-- wichtig
  }
}


  const data = {
    labels: sortedData.map(row => row.DATE),
    datasets: [
      {
        label: "MVaR All (%)",
        data: mvarAllPct,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2
      },
      {
        label: "MVaR IR (%)",
        data: mvarIrPct,
        borderColor: "rgba(0, 200, 83, 1)",
        backgroundColor: "rgba(0, 200, 83, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
       
      },
      {
        label: "MVaR CS (%)",
        data: mvarCsPct,
        borderColor: "rgba(255, 159, 64, 1)",
        backgroundColor: "rgba(255, 159, 64, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
       
      },
      {
        label: "M ES All (%)",
        data: mesAllPct,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.0)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        borderDash: [6, 4]
      },
      {
        label: "M ES IR (%)",
        data: mesIrPct,
        borderColor: "rgba(0, 200, 83, 1)",
        backgroundColor: "rgba(0, 200, 83, 0.0)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        borderDash: [6, 4],
       
      },
      {
        label: "M ES CS (%)",
        data: mesCsPct,
        borderColor: "rgba(255, 159, 64, 1)",
        backgroundColor: "rgba(255, 159, 64, 0.0)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        borderDash: [6, 4],
       
      }
    ]
  };

  const options = createPercentChartOptions("MVaR / ES Metrics (%)");

  // remember last successful inputs for refresh
  _riskLastData = data;
  _riskLastOptions = options;

  // ---- Render when canvas exists AND has size ----
  const maxTries = 60; // ~1s @60fps
  let tries = 0;

  const tryRender = () => {
    const canvas = document.getElementById("riskMetricsChartLine");

    if (!canvas) {
      if (++tries < maxTries) return requestAnimationFrame(tryRender);
      console.warn("❌ riskMetricsChartLine canvas not found after retries");
      return;
    }

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (w === 0 || h === 0) {
      if (++tries < maxTries) return requestAnimationFrame(tryRender);
      console.warn("❌ riskMetricsChartLine canvas has 0 size after retries", { w, h });
      return;
    }

    try {
      riskMetricsChartLine = createTimeSeriesChart(
        "riskMetricsChartLine",
        data,
        options,
        "line"
      );

      if (!riskMetricsChartLine) {
        console.warn("❌ createTimeSeriesChart returned null/undefined");
        return;
      }

      riskMetricsChartLine.resize();
      riskMetricsChartLine.update();

      console.log("✅ MarketRiskMetricsChartLine rendered with", sortedData.length, "points");
    } catch (err) {
      console.error("💥 Fehler beim Erzeugen von riskMetricsChartLine:", err);
    }
  };

  requestAnimationFrame(tryRender);
}

let creditMetricsChartLine = null;

export function renderCreditMetricsChartLine() {
  const historyData = appState.getPortfolioHistoryData() || [];
  console.log("🎯 renderCreditMetricsChartLine CALLED with rows:", historyData.length);

  if (!Array.isArray(historyData) || historyData.length === 0) {
    console.warn("⚠️ Keine PortfolioHistoryMetrics zum Plotten vorhanden (Credit Metrics).");
    return;
  }

  const sortedData = [...historyData].sort(
    (a, b) => new Date(a.DATE) - new Date(b.DATE)
  );
  console.log(
    "📅 [CREDIT] First DATE:",
    sortedData[0]?.DATE,
    "Last DATE:",
    sortedData[sortedData.length - 1]?.DATE
  );

  function readPctSeries(row, keys) {
    for (const k of keys) {
      if (k in row && row[k] != null && row[k] !== "") {
        const v = parseFloat(row[k]);
        if (!isNaN(v)) return v;
      }
    }
    return null;
  }

  const cVarPct = sortedData.map(row =>
    readPctSeries(row, ["C_VaR_PCT", "C_VAR_PCT", "C_VaR_pct", "CVAR_PCT"])
  );

  const cEsPct = sortedData.map(row =>
    readPctSeries(row, ["C_ES_PCT", "C_ES_pct", "CES_PCT"])
  );

  console.log(
    "✅ [CREDIT] Sample values:",
    "C_VaR[0]:", cVarPct[0],
    "C_ES[0]:", cEsPct[0]
  );

  if (creditMetricsChartLine) {
    console.log("♻️ Destroy existing creditMetricsChartLine instance");
    try {
      creditMetricsChartLine.destroy();
    } catch (err) {
      console.error("⚠️ Fehler beim Destroy von creditMetricsChartLine:", err);
    }
  }

  const data = {
    labels: sortedData.map(row => row.DATE),
    datasets: [
      {
        label: "C VaR (%)",
        data: cVarPct,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2
      },
      {
        label: "C ES (%)",
        data: cEsPct,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.0)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        borderDash: [6, 4]
      }
    ]
  };

  const options = createPercentChartOptions("Credit VaR / ES (%)");

  try {
    creditMetricsChartLine = createTimeSeriesChart(
      "creditMetricsChartLine",
      data,
      options,
      "line"
    );
    console.log("✅ creditMetricsChartLine rendered with", sortedData.length, "points");
  } catch (err) {
    console.error("💥 Fehler beim Erzeugen von creditMetricsChartLine:", err);
  }
}

let portfolioHistoryChart = null;

export function renderPortfolioHistoryYieldChart() {
  const historyData = appState.getPortfolioHistoryData() || [];
  const tsData = appState.getTblTSData();

  console.log('EU_1Y', tsData)

  if (!Array.isArray(historyData) || historyData.length === 0) {
    console.warn("⚠️ Keine PortfolioHistoryMetrics zum Plotten vorhanden.");
    return;
  }

  const normalizeDateStr = (str) => {
    if (!str || typeof str !== "string") return "";
    return str.split(" ")[0];
  };

  const sortedData = [...historyData].sort(
    (a, b) => new Date(a.DATE) - new Date(b.DATE)
  );

  const labels = sortedData.map(row => row.DATE);
  const returns = sortedData.map(row => parseFloat(row.RETURN));

  const tsMap = new Map();
  tsData.forEach(row => {
    if (!row || !row.DATE) return;
    const normDate = normalizeDateStr(row.DATE);
    const raw = parseFloat(row.EU_1Y);



    if (!isNaN(raw)) {
      tsMap.set(normDate, raw / 100); // 3.5 -> 0.035
    }
  });

  let eu1ySeries = labels.map(dateStr => {
    const normLabel = normalizeDateStr(dateStr);
    const v = tsMap.get(normLabel);
    return typeof v === "number" ? v : null;
  });

  // Lücken-Füll-Logik bleibt unverändert
  const n = eu1ySeries.length;
  let i = 0;
  while (i < n) {
    if (eu1ySeries[i] !== null && !Number.isNaN(eu1ySeries[i])) {
      i++;
      continue;
    }
    const start = i;
    while (i < n && (eu1ySeries[i] === null || Number.isNaN(eu1ySeries[i]))) {
      i++;
    }
    const end = i;
    const leftIdx = start - 1;
    const rightIdx = end;

    const leftVal = leftIdx >= 0 ? eu1ySeries[leftIdx] : null;
    const rightVal = rightIdx < n ? eu1ySeries[rightIdx] : null;

    if (
      leftVal !== null && !Number.isNaN(leftVal) &&
      rightVal !== null && !Number.isNaN(rightVal)
    ) {
      const gap = rightIdx - leftIdx;
      for (let k = start; k < end; k++) {
        const t = (k - leftIdx) / gap;
        eu1ySeries[k] = leftVal + t * (rightVal - leftVal);
      }
    } else if (
      leftVal !== null && !Number.isNaN(leftVal) &&
      (rightVal === null || Number.isNaN(rightVal))
    ) {
      for (let k = start; k < end; k++) {
        eu1ySeries[k] = leftVal;
      }
    } else if (
      (leftVal === null || Number.isNaN(leftVal)) &&
      rightVal !== null && !Number.isNaN(rightVal)
    ) {
      for (let k = start; k < end; k++) {
        eu1ySeries[k] = rightVal;
      }
    }
  }

  if (portfolioHistoryChart) {
    portfolioHistoryChart.destroy();
  }

  const data = {
    labels,
    datasets: [
      {
        label: "Portfolio Return",
        data: returns,
        borderColor: "#4bc0c0",
        backgroundColor: "rgba(75, 192, 192, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        yAxisID: "y"
      },
      {
        label: "EU 1Y",
        data: eu1ySeries,
        borderColor: "#ff9800",
        backgroundColor: "rgba(255, 152, 0, 0.15)",
        borderWidth: 2,
        pointRadius: 1.5,
        tension: 0.2,
        yAxisID: "y"
      }
    ]
  };

  const options = createPercentChartOptions("MVaR / ES Metrics (%)");

  portfolioHistoryChart = createTimeSeriesChart(
    "portfolioHistoryChart",
    data,
    options,
    "line"
  );
}

let portfolioSensChartLine = null;

export function renderPortfolioSensChartLine() {
  const historyData = appState.getPortfolioHistoryData() || [];
  console.log("📈 renderPortfolioSensChartLine CALLED, rows:", historyData.length);

  if (!Array.isArray(historyData) || historyData.length === 0) {
    console.warn("⚠️ Keine PortfolioHistoryMetrics zum Plotten vorhanden.");
    return;
  }

  const sortedData = [...historyData].sort(
    (a, b) => new Date(a.DATE) - new Date(b.DATE)
  );

  const labels = sortedData.map(row => row.DATE);

  function readSeries(row, keys) {
    for (const k of keys) {
      if (k in row && row[k] != null && row[k] !== "") {
        const v = parseFloat(row[k]);
        if (!isNaN(v)) return v;
      }
    }
    return null;
  }

  const mDurationBp = sortedData.map(row =>
    readSeries(row, ["MDURATION", "M_DURATION", "MOD_DURATION"])
  );

  const cpv01Bp = sortedData.map(row =>
    readSeries(row, ["CPV01bp", "CPV01_BP", "CPV01_BP_BASIS"])
  );

  if (portfolioSensChartLine) {
    try {
      portfolioSensChartLine.destroy();
    } catch (err) {
      console.error("⚠️ Fehler beim Destroy von portfolioSensChartLine:", err);
    }
  }

  const data = {
    labels,
    datasets: [
      {
        label: "MDURATION (bp)",
        data: mDurationBp,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2
      },
      {
        label: "CPV01 (bp)",
        data: cpv01Bp,
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2
      }
    ]
  };

  // Basis-Options holen (Layout/Theme etc.)
  const options = createPercentChartOptions("Sensitivities (bp)");

  // ✅ Prozent-Formatierung überschreiben → Basispunkte
  options.scales = options.scales || {};
  options.scales.y = options.scales.y || {};

  options.scales.y.ticks = {
    ...(options.scales.y.ticks || {}),
    callback: (val) => `${Number(val).toFixed(2)}bp`
  };

  options.plugins = options.plugins || {};
  options.plugins.tooltip = {
    ...(options.plugins.tooltip || {}),
    callbacks: {
      ...(options.plugins.tooltip.callbacks || {}),
      label: (ctx) => {
        const y = ctx.raw;
        return `${ctx.dataset.label}: ${Number(y).toFixed(2)}bp`;
      }
    }
  };

  try {
    portfolioSensChartLine = createTimeSeriesChart(
      "portfolioSensChartLine",
      data,
      options,
      "line"
    );
    console.log("✅ portfolioSensChartLine rendered with", labels.length, "points");
  } catch (err) {
    console.error("💥 Fehler beim Erzeugen von portfolioSensChartLine:", err);
  }
}


let portfolioValueChartLine = null;

export function renderPortfolioValueChartLine() {
  const historyData = appState.getPortfolioHistoryData() || [];

  if (!Array.isArray(historyData) || historyData.length === 0) {
    console.warn("⚠️ Keine PortfolioHistoryMetrics zum Plotten vorhanden.");
    return;
  }

  const sortedData = [...historyData].sort(
    (a, b) => new Date(a.DATE) - new Date(b.DATE)
  );

  const labels = sortedData.map(row => row.DATE);

  const portValuePct = sortedData.map(row => {
    const value = parseFloat(row.PORTFOLIO_VALUE);
    const notional = parseFloat(row.PORTFOLIO_NOTIONAL);
    if (isNaN(value) || isNaN(notional) || notional === 0) return null;
    return value / notional;
  });

  const portValueBuyPct = sortedData.map(row => {
    const valueBuy =
      parseFloat(row.PORTFOLIO_VALUE_BUY) ||
      parseFloat(row.PORTVOLIO_VALUE_BUY);
    const notional =
      parseFloat(row.PORTFOLIO_NOTIONAL) ||
      parseFloat(row.PORTVOLIO_NOTIONAL);
    if (isNaN(valueBuy) || isNaN(notional) || notional === 0) return null;
    return valueBuy / notional;
  });

  const profitLossPct = sortedData.map(row => {
    const v = parseFloat(row.PROFIT_LOSS_PCT);
    return isNaN(v) ? null : v;
  });

  if (portfolioValueChartLine) {
    portfolioValueChartLine.destroy();
  }

  const data = {
    labels,
    datasets: [
      {
        type: "line",
        label: "Portfolio Value / Notional",
        data: portValuePct,
        borderColor: "rgba(54, 162, 235, 1)",
        backgroundColor: "rgba(54, 162, 235, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        yAxisID: "y"
      },
      {
        type: "line",
        label: "Portfolio BUY Value / Notional",
        data: portValueBuyPct,
        borderColor: "rgba(255, 99, 132, 1)",
        backgroundColor: "rgba(255, 99, 132, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        yAxisID: "y"
      },
      {
        type: "bar",
        label: "Profit/Loss (%)",
        data: profitLossPct,
        yAxisID: "y1",
        backgroundColor: "rgba(255, 159, 64, 0.5)",
        borderColor: "rgba(255, 159, 64, 1)",
        borderWidth: 1
      }
    ]
  };

const options = createPercentChartOptions("Portfolio Value / Notional (%)");

// linke Y-Achse explizit überschreiben/nachschärfen
options.scales.y = {
  ...options.scales.y,
  min: 0.9,           // harte Untergrenze
  beginAtZero: false  // globale Defaults aushebeln
};

options.scales.y1 = {
  position: "right",
  title: { display: true, text: "Profit/Loss (%)" },
  ticks: {
    callback: (val) => {
      const num = Number(val);
      if (isNaN(num)) return "";
      return (num * 100).toFixed(2) + " %";
    }
  },
  grid: {
    drawOnChartArea: false
  }
};

portfolioValueChartLine = createTimeSeriesChart(
  "portfolioValueChartLine",
  data,
  options,
  "bar"
);

}














