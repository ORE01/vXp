import { appState } from '../../../renderer.js';
import { getTileMode } from '../../CUSTOMER_SETUP/overviewTilesPanel.js';
import { getPortfolioColor } from '../../../utils/colors.js';
import { fmtEur } from '../../../utils/tableCellFormats.js';


// HELPER: 

      // Globale Zoom-Config bleibt wie gehabt
      const zoomPluginConfig = {
        annotation: {},
        zoom: {
          // Pan auf Strg+Ziehen, damit Ziehen fuer den Box-Zoom frei ist.
          pan: {
            enabled: true,
            mode: "x",
            modifierKey: "ctrl"
          },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            // Box-Zoom: mit der Maus einen Zeitbereich aufziehen.
            drag: {
              enabled: true,
              backgroundColor: "rgba(75,150,225,0.15)",
              borderColor: "rgba(75,150,225,0.6)",
              borderWidth: 1
            },
            mode: "x"
          }
        }
      };
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
                  return (num * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
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
                  return label + ": " + (v * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
                }
              }
            },
            ...zoomPluginConfig
          }
        };
      }
      function createTimeSeriesChart(canvasId, data, options = {}, baseType = "line") {
  // 🔹 1) Canvas robust holen
  const canvas = document.getElementById(canvasId);
  if (!canvas) {
    console.info(
      `[HistoricCharts] Canvas #${canvasId} wurde nicht gefunden – Panel vermutlich nicht gemountet, Chart wird übersprungen.`
    );
    return null;
  }

  const ctx = canvas.getContext("2d");
  if (!ctx) {
    console.info(
      `[HistoricCharts] Konnte 2D-Context von #${canvasId} nicht holen – Chart wird übersprungen.`
    );
    return null;
  }

  // 🔹 2) Fallbacks für data/options
  const safeData = data && typeof data === "object"
    ? data
    : { labels: [], datasets: [] };

  const safeOptions = options && typeof options === "object"
    ? options
    : {};

  // 🔹 3) Chart erstellen
  const chart = new Chart(ctx, {
    type: baseType || "line",
    data: safeData,
    options: safeOptions
  });

  return chart;
}

// Tooltip fest in die obere linke Ecke der Zeichenflaeche legen (statt am Cursor),
// damit es die Kurven nicht verdeckt. Einmalig als Chart.js-Positioner registriert.
let _histTooltipPosBound = false;
function ensureFixedTooltipPositioner() {
  if (_histTooltipPosBound) return;
  const positioners = window.Chart?.Tooltip?.positioners;
  if (!positioners) return;
  positioners.histFixedCorner = function () {
    const area = this.chart?.chartArea;
    if (!area) return false;
    return { x: area.left + 10, y: area.top + 10 };
  };
  _histTooltipPosBound = true;
}

// Fadenkreuz-Plugin (opt-in via options.plugins.histCrosshair): vertikale + horizontale
// Linie am Cursor + Werte am Rand (Datum unten, y-Wert links). Global registriert, wirkt
// aber NUR auf Charts, die options.plugins.histCrosshair gesetzt haben.
// valueScale (Default 100): Faktor fuer die y-Randanzeige — die Historic-Charts
// speichern Anteile (0.985 -> "98.50 %"), Charts mit echten %-Werten setzen 1.
let _histCrosshairBound = false;
// Das Fadenkreuz ist NUR fuer Line-Charts gedacht, nie fuer Balkencharts. Ein Chart
// gilt als Line-Chart, sobald mindestens eine Serie kein 'bar' ist (der Basistyp des
// Charts dient als Default fuer Serien ohne eigenen type). So bekommt ein reiner
// Balkenchart selbst dann kein Fadenkreuz, wenn options.plugins.histCrosshair (z.B.
// ueber ein geteiltes Options-Objekt) gesetzt sein sollte.
function _chartHasLineSeries(chart) {
  const base = chart?.config?.type;
  const dss = chart?.data?.datasets || [];
  return dss.some((ds) => (ds?.type || base) !== 'bar');
}
export function ensureHistCrosshairPlugin() {
  if (_histCrosshairBound) return;
  if (!window.Chart?.register) return;
  window.Chart.register({
    id: "histCrosshair",
    afterEvent(chart, args) {
      if (chart?.config?.type !== "line") return;   // NUR echte Line-Charts (nie Scatter/Bar)
      if (chart.options?.plugins?.histCrosshair?.enabled !== true) return;   // explizit aktiviert
      const e = args.event, a = chart.chartArea;
      let pos = null;
      if (e && e.type !== "mouseout" && e.x != null &&
          e.x >= a.left && e.x <= a.right && e.y >= a.top && e.y <= a.bottom) {
        pos = { x: e.x, y: e.y };
      }
      const prev = chart.$histCross;
      if ((prev?.x !== pos?.x) || (prev?.y !== pos?.y)) { chart.$histCross = pos; args.changed = true; }
    },
    afterDraw(chart) {
      if (chart?.config?.type !== "line") return;   // NUR echte Line-Charts (nie Scatter/Bar)
      if (chart.options?.plugins?.histCrosshair?.enabled !== true) return;   // explizit aktiviert
      const c = chart.$histCross;
      if (!c) return;
      const ctx = chart.ctx, a = chart.chartArea, xs = chart.scales.x;

      // Naechster Datenindex zur Cursor-x-Position.
      let idx;
      try { idx = Math.round(xs.getValueForPixel(c.x)); } catch { return; }
      const len = (chart.data.labels || []).length;
      if (len) idx = Math.max(0, Math.min(len - 1, idx));

      // Unter den SICHTBAREN Linien-Serien den Punkt bei idx waehlen, der dem Cursor-y am
      // naechsten liegt -> das Fadenkreuz rastet auf die (naechste) Linie ein.
      let best = null;
      (chart.data.datasets || []).forEach((ds, di) => {
        if (ds.type === 'bar') return;
        if (!chart.isDatasetVisible(di)) return;
        const raw = ds.data?.[idx];
        const val = (raw && typeof raw === 'object') ? raw.y : raw;
        if (val == null || Number.isNaN(Number(val))) return;
        const meta = chart.getDatasetMeta(di);
        const yScale = chart.scales[ds.yAxisID || meta.yAxisID || 'y'] || chart.scales.y;
        const py = yScale.getPixelForValue(Number(val));
        if (!Number.isFinite(py)) return;
        const col = (Array.isArray(ds.borderColor) ? ds.borderColor.find(Boolean) : ds.borderColor) || '#888';
        const d = Math.abs(py - c.y);
        if (!best || d < best.d) best = { val, py, d, color: col, yScale };
      });

      const px = xs.getPixelForValue(idx);
      if (!Number.isFinite(px)) return;
      const py = best ? best.py : c.y;

      ctx.save();
      ctx.lineWidth = 1;
      ctx.strokeStyle = "rgba(150,160,175,0.9)";
      ctx.setLineDash([4, 3]);
      ctx.beginPath(); ctx.moveTo(px, a.top); ctx.lineTo(px, a.bottom); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(a.left, py); ctx.lineTo(a.right, py); ctx.stroke();
      ctx.setLineDash([]);

      // Punkt auf der Linie markieren.
      if (best) {
        ctx.fillStyle = best.color;
        ctx.beginPath(); ctx.arc(px, py, 3.5, 0, Math.PI * 2); ctx.fill();
        ctx.lineWidth = 1; ctx.strokeStyle = "#fff"; ctx.stroke();
      }

      // Randbeschriftung: Datum (x) unten am Strich, Linienwert (y) links.
      let xLabel = "";
      try { xLabel = xs.getLabelForValue ? String(xs.getLabelForValue(idx)) : String(idx); } catch {}
      // Fadenkreuz-Label EXAKT wie die y-Achse desselben Charts formatieren, damit
      // Achse und Fadenkreuz nie auseinanderlaufen (z.B. Bruch 0.0239 -> "2.39 %").
      // Nur wenn der Chart keinen y-Tick-Callback hat, greift der alte valueScale-Pfad
      // (Default 100) als Fallback.
      let yLabel = "";
      if (best) {
        const tickCb = best.yScale?.options?.ticks?.callback;
        if (typeof tickCb === "function") {
          try { yLabel = String(tickCb.call(best.yScale, Number(best.val), 0, [])); } catch { yLabel = ""; }
        }
        if (!yLabel) {
          const valueScale = Number(chart.options?.plugins?.histCrosshair?.valueScale ?? 100);
          yLabel = (Number(best.val) * valueScale).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
        }
      }
      ctx.font = "10px sans-serif";
      const pad = 3;
      if (xLabel) {
        const w = ctx.measureText(xLabel).width;
        ctx.fillStyle = "rgba(40,44,52,0.92)"; ctx.fillRect(px - w / 2 - pad, a.bottom + 2, w + pad * 2, 14);
        ctx.fillStyle = "#fff"; ctx.textAlign = "center"; ctx.textBaseline = "top";
        ctx.fillText(xLabel, px, a.bottom + 4);
      }
      if (yLabel) {
        const w = ctx.measureText(yLabel).width;
        ctx.fillStyle = "rgba(40,44,52,0.92)"; ctx.fillRect(a.left - w - pad * 2 - 2, py - 7, w + pad * 2, 14);
        ctx.fillStyle = "#fff"; ctx.textAlign = "right"; ctx.textBaseline = "middle";
        ctx.fillText(yLabel, a.left - pad - 2, py);
      }
      ctx.restore();
    }
  });
  _histCrosshairBound = true;
}

// "Reset Zoom"-Button oben rechts in den Chart-Container (idempotent). Setzt den Zoom
// des Charts auf dieser Canvas zurueck (Instanz zur Klickzeit via Chart.getChart).
function ensureZoomResetButton(canvasId) {
  const canvas = document.getElementById(canvasId);
  const box = canvas?.parentElement;
  if (!box) return;
  if (getComputedStyle(box).position === "static") box.style.position = "relative";
  if (box.querySelector(".hist-zoom-reset")) return;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = "hist-zoom-reset";
  btn.textContent = "Reset Zoom";
  btn.style.cssText =
    "position:absolute;top:4px;right:4px;z-index:6;font-size:10px;padding:2px 8px;" +
    "border:1px solid #cbd5e1;border-radius:4px;background:#f8fafc;color:#334155;cursor:pointer;";
  btn.addEventListener("click", () => {
    try { window.Chart.getChart(document.getElementById(canvasId))?.resetZoom?.(); } catch {}
  });
  box.appendChild(btn);
}


// HISORIC CHARTS:      

let _riskLastData = null;
let _riskLastOptions = null;


// Pro Canvas eigene Chart-Instanz + rAF-Handle -> der Market-Risk-History-Chart kann in MEHREREN
// Panels unabhaengig laufen (Risk History + Profit/Loss-Kopie).
const _mktRiskChartByCanvas = {};
const _mktRiskRafByCanvas = {};
const _creditRiskChartByCanvas = {};   // pro Canvas eigene Instanz (Risk History + EC-Kopie)
let historicPortfolioYieldChart = null;
let historicPortfolioSensChart = null;
let historicPortfolioValueChart = null;


function renderHistoricMarketRiskChart(historyData, canvasId = "historicMarketRiskChart", opts = {}) {
  historyData = Array.isArray(historyData) ? historyData : [];

  // Der eingebettete P&L-Chart (Titel "How has market risk evolved over time?") nur zeigen,
  // wenn fuer das AKTUELL EINGESTELLTE Portfolio ueberhaupt Market-Risk-History vorliegt
  // (PortfolioHistoryMetrics). historyData ist bereits aufs gewaehlte Portfolio gefiltert.
  // Die anderen Canvas-IDs (Factors/Original) haben keinen solchen Wrapper -> unberuehrt.
  const setPanelVisible = (visible) => {
    if (canvasId !== "plMarketRiskHistChart") return;
    const panel = document.getElementById("plMarketRiskHistPanel");
    if (panel) panel.style.display = visible ? "" : "none";
  };

  if (historyData.length === 0) {
    setPanelVisible(false);
    destroyChartByCanvasId(canvasId);
    return;
  }

  const sortedData = [...historyData].sort(
    (a, b) => new Date(a.DATE) - new Date(b.DATE)
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

  // P&L-Chart: Zeilen vorhanden, aber keine echten MVaR/ES-Werte fuers Portfolio -> Panel
  // ausblenden (analog Credit-Chart). Nur fuer die eingebettete P&L-Kopie mit eigenem Wrapper.
  if (canvasId === "plMarketRiskHistChart") {
    const hasMarketData =
      mvarAllPct.some(v => v != null) || mesAllPct.some(v => v != null);
    if (!hasMarketData) {
      setPanelVisible(false);
      destroyChartByCanvasId(canvasId);
      return;
    }
    setPanelVisible(true);
  }

  // 🔁 Falls schon ein Render-Loop läuft → abbrechen
  if (_mktRiskRafByCanvas[canvasId] != null) {
    cancelAnimationFrame(_mktRiskRafByCanvas[canvasId]);
    _mktRiskRafByCanvas[canvasId] = null;
  }

  // ♻️ Alte Chart-Instanz (dieser Canvas) einmalig vernichten
  if (_mktRiskChartByCanvas[canvasId]) {
    try {
      _mktRiskChartByCanvas[canvasId].destroy();
    } catch (err) {
      console.error("⚠️ Fehler beim Destroy von", canvasId, err);
    } finally {
      _mktRiskChartByCanvas[canvasId] = null;
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
        tension: 0.2
      },
      {
        label: "MVaR CS (%)",
        data: mvarCsPct,
        borderColor: "rgba(255, 159, 64, 1)",
        backgroundColor: "rgba(255, 159, 64, 0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2
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
        borderDash: [6, 4]
      },
      {
        label: "M ES CS (%)",
        data: mesCsPct,
        borderColor: "rgba(255, 159, 64, 1)",
        backgroundColor: "rgba(255, 159, 64, 0.0)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        borderDash: [6, 4]
      }
    ]
  };

  // Optionaler Serien-Filter (z.B. nur "MVaR All (%)" + "M ES All (%)" im Profit/Loss-Panel).
  if (Array.isArray(opts.onlyLabels) && opts.onlyLabels.length) {
    data.datasets = data.datasets.filter((ds) => opts.onlyLabels.includes(ds.label));
  }

  // Optionale Farb-Ueberschreibung je Serie (z.B. Profit/Loss: VaR rot, ES orange wie in den
  // Verteilungscharts). Greift auf den Originalnamen (vor labelMap).
  if (opts.colorMap && typeof opts.colorMap === "object") {
    data.datasets.forEach((ds) => {
      const c = opts.colorMap[ds.label];
      if (!c) return;
      if (c.border) ds.borderColor = c.border;
      if ("bg" in c) ds.backgroundColor = c.bg;
    });
  }

  // Optionale Umbenennung der Legenden-Labels (z.B. Profit/Loss-Panel: sprechende Namen
  // "VaR 95% · 10d" statt des kryptischen "MVaR All (%)"). Greift NACH dem Filter, damit
  // onlyLabels weiter auf den Originalnamen matcht.
  if (opts.labelMap && typeof opts.labelMap === "object") {
    data.datasets.forEach((ds) => {
      if (ds.label in opts.labelMap) ds.label = opts.labelMap[ds.label];
    });
  }

  const options = createPercentChartOptions("MVaR / ES Metrics (%)");
  // Legende nach RECHTS (untereinander) statt als Zeile oben — gilt fuer Profit/Loss- und
  // Factors-Chart. Kleine, leicht abgerundete Symbole wie im Yield-History-Chart.
  options.plugins.legend = {
    display: true, position: "right",
    labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, font: { size: 10 } },
  };

  _riskLastData = data;
  _riskLastOptions = options;

  const maxTries = 60;
  let tries = 0;

  const tryRender = () => {
    const canvas = document.getElementById(canvasId);

    if (!canvas) {
      if (++tries < maxTries) {
        _mktRiskRafByCanvas[canvasId] = requestAnimationFrame(tryRender);
      } else {
        console.warn("❌ canvas not found after retries:", canvasId);
      }
      return;
    }

    const w = canvas.clientWidth;
    const h = canvas.clientHeight;

    if (w === 0 || h === 0) {
      if (++tries < maxTries) {
        _mktRiskRafByCanvas[canvasId] = requestAnimationFrame(tryRender);
      } else {
        console.warn("❌ canvas has 0 size after retries:", canvasId, { w, h });
      }
      return;
    }

    try {
      // Extra-Sicherheit: eventuell existierenden Chart direkt über Chart.js-Registry killen
      const existingChart =
        window.Chart?.getChart
          ? window.Chart.getChart(canvas)
          : null;

      if (existingChart && existingChart !== _mktRiskChartByCanvas[canvasId]) {
        existingChart.destroy();
      }

      _mktRiskChartByCanvas[canvasId] = createTimeSeriesChart(
        canvasId,
        data,
        options,
        "line"
      );

      if (!_mktRiskChartByCanvas[canvasId]) {
        console.warn("❌ createTimeSeriesChart returned null/undefined for", canvasId);
        return;
      }

      _mktRiskChartByCanvas[canvasId].resize();
      _mktRiskChartByCanvas[canvasId].update();

      // "Reset Zoom"-Button wie bei den anderen History-Charts (Yield/Value/Credit).
      // Zoom ist ueber createPercentChartOptions aktiv; ohne diesen Aufruf fehlt der
      // Button. Gilt fuer alle Canvas-IDs (Original + Kopien plMarketRiskHistChart /
      // factorsMarketRiskHistChart).
      ensureZoomResetButton(canvasId);
    } catch (err) {
      console.error("💥 Fehler beim Erzeugen von", canvasId, err);
    } finally {
      // Render-Loop ist erledigt
      _mktRiskRafByCanvas[canvasId] = null;
    }
  };

  _mktRiskRafByCanvas[canvasId] = requestAnimationFrame(tryRender);
}

// function renderHistoricMarketRiskChart(historyData) {
//   historyData = Array.isArray(historyData) ? historyData : [];

//   if (historyData.length === 0) {
//     destroyChartByCanvasId("historicMarketRiskChart");
//     historicMarketRiskChart = null;
//     return;
//   }

//   const sortedData = [...historyData].sort(
//     (a, b) => new Date(a.DATE) - new Date(b.DATE)
//   );

//   function readPctSeries(row, keys) {
//     for (const k of keys) {
//       if (k in row && row[k] != null && row[k] !== "") {
//         const v = parseFloat(row[k]);
//         if (!isNaN(v)) return v;
//       }
//     }
//     return null;
//   }

//   const mvarAllPct = sortedData.map(row =>
//     readPctSeries(row, ["M_VaR_All_PCT", "M_VaR_ALL_PCT", "MVaR_All_PCT"])
//   );
//   const mvarIrPct = sortedData.map(row =>
//     readPctSeries(row, ["M_VaR_IR_PCT", "M_VaR_IR_pct", "MVaR_IR_PCT"])
//   );
//   const mvarCsPct = sortedData.map(row =>
//     readPctSeries(row, ["M_VaR_CS_PCT", "M_VaR_CS_pct", "MVaR_CS_PCT"])
//   );

//   const mesAllPct = sortedData.map(row =>
//     readPctSeries(row, ["M_ES_ALL_PCT", "M_ES_All_PCT", "M_ES_All_pct"])
//   );
//   const mesIrPct = sortedData.map(row =>
//     readPctSeries(row, ["M_ES_IR_PCT", "M_ES_IR_pct", "MES_IR_PCT"])
//   );
//   const mesCsPct = sortedData.map(row =>
//     readPctSeries(row, ["M_ES_CS_PCT", "M_ES_CS_pct", "MES_CS_PCT"])
//   );

//   const data = {
//     labels: sortedData.map(row => row.DATE),
//     datasets: [
//       {
//         label: "MVaR All (%)",
//         data: mvarAllPct,
//         borderColor: "rgba(54, 162, 235, 1)",
//         backgroundColor: "rgba(54, 162, 235, 0.15)",
//         borderWidth: 2,
//         pointRadius: 2,
//         tension: 0.2
//       },
//       {
//         label: "MVaR IR (%)",
//         data: mvarIrPct,
//         borderColor: "rgba(0, 200, 83, 1)",
//         backgroundColor: "rgba(0, 200, 83, 0.15)",
//         borderWidth: 2,
//         pointRadius: 2,
//         tension: 0.2
//       },
//       {
//         label: "MVaR CS (%)",
//         data: mvarCsPct,
//         borderColor: "rgba(255, 159, 64, 1)",
//         backgroundColor: "rgba(255, 159, 64, 0.15)",
//         borderWidth: 2,
//         pointRadius: 2,
//         tension: 0.2
//       },
//       {
//         label: "M ES All (%)",
//         data: mesAllPct,
//         borderColor: "rgba(54, 162, 235, 1)",
//         backgroundColor: "rgba(54, 162, 235, 0.0)",
//         borderWidth: 2,
//         pointRadius: 2,
//         tension: 0.2,
//         borderDash: [6, 4]
//       },
//       {
//         label: "M ES IR (%)",
//         data: mesIrPct,
//         borderColor: "rgba(0, 200, 83, 1)",
//         backgroundColor: "rgba(0, 200, 83, 0.0)",
//         borderWidth: 2,
//         pointRadius: 2,
//         tension: 0.2,
//         borderDash: [6, 4]
//       },
//       {
//         label: "M ES CS (%)",
//         data: mesCsPct,
//         borderColor: "rgba(255, 159, 64, 1)",
//         backgroundColor: "rgba(255, 159, 64, 0.0)",
//         borderWidth: 2,
//         pointRadius: 2,
//         tension: 0.2,
//         borderDash: [6, 4]
//       }
//     ]
//   };

//   const options = createPercentChartOptions("MVaR / ES Metrics (%)");

//   _riskLastData = data;
//   _riskLastOptions = options;

//   if (historicMarketRiskRafId != null) {
//     cancelAnimationFrame(historicMarketRiskRafId);
//     historicMarketRiskRafId = null;
//   }

//   historicMarketRiskRafId = requestAnimationFrame(() => {
//     const canvas = document.getElementById("historicMarketRiskChart");

//     if (!canvas) {
//       console.warn("historicMarketRiskChart canvas not found");
//       historicMarketRiskRafId = null;
//       return;
//     }

//     const w = canvas.clientWidth;
//     const h = canvas.clientHeight;

//     if (w === 0 || h === 0) {
//       console.warn("historicMarketRiskChart canvas has 0 size", { w, h });
//       historicMarketRiskRafId = null;
//       return;
//     }

//     try {
//       if (historicMarketRiskChart) {
//         historicMarketRiskChart.data = data;
//         historicMarketRiskChart.options = options;
//         historicMarketRiskChart.update("none");
//       } else {
//         historicMarketRiskChart = createTimeSeriesChart(
//           "historicMarketRiskChart",
//           data,
//           options,
//           "line"
//         );
//       }
//     } catch (err) {
//       console.error("Fehler beim Rendern von historicMarketRiskChart:", err);
//     } finally {
//       historicMarketRiskRafId = null;
//     }
//   });
// }


function renderHistoricCreditRiskChart(historyData, canvasId = "historicCreditRiskChart") {
  historyData = Array.isArray(historyData) ? historyData : [];

  // Die eingebettete EC-Kopie (Titel "How has credit risk evolved over time?") nur zeigen,
  // wenn fuer das AKTUELL EINGESTELLTE Portfolio ueberhaupt Credit-History-Daten vorliegen.
  // historyData ist bereits auf das gewaehlte Portfolio (port_name) gefiltert -> es reicht,
  // hier auf echte Credit-VaR/ES-Werte zu pruefen (derzeit nur UNI). Das Original in
  // panel-credit-risk hat keinen solchen Wrapper -> dort nichts aus-/einblenden.
  const setPanelVisible = (visible) => {
    if (canvasId !== "plCreditRiskHistChart") return;
    const panel = document.getElementById("plCreditRiskHistPanel");
    if (panel) panel.style.display = visible ? "" : "none";
  };

  if (historyData.length === 0) {
    setPanelVisible(false);
    destroyChartByCanvasId(canvasId);
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

  // Ohne echte Credit-VaR/ES-Werte fuer dieses Portfolio: Panel ausblenden (derzeit nur UNI).
  const hasCreditData = cVarPct.some(v => v != null) || cEsPct.some(v => v != null);
  if (!hasCreditData) {
    setPanelVisible(false);
    destroyChartByCanvasId(canvasId);
    return;
  }
  setPanelVisible(true);

  if (_creditRiskChartByCanvas[canvasId]) {
    try {
      _creditRiskChartByCanvas[canvasId].destroy();
    } catch (err) {
      console.error("⚠️ Fehler beim Destroy von", canvasId, err);
    }
    _creditRiskChartByCanvas[canvasId] = null;
  }

  const data = {
    labels: sortedData.map(row => row.DATE),
    datasets: [
      {
        // VaR orange, ES rot - dieselben Farben wie im Market-Chart "How has market risk evolved
        // over time?" und in den Verteilungscharts. Credit-Konfidenz = 99% (siehe Credit-KPIs).
        label: "Credit VaR 99%",
        data: cVarPct,
        borderColor: "rgba(255,150,0,0.98)",
        backgroundColor: "rgba(255,150,0,0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2
      },
      {
        label: "Expected Shortfall 99%",
        data: cEsPct,
        borderColor: "rgba(255,0,0,0.95)",
        backgroundColor: "rgba(255,0,0,0.15)",
        borderWidth: 2,
        pointRadius: 2,
        tension: 0.2,
        borderDash: [6, 4]
      }
    ]
  };

  const options = createPercentChartOptions("Credit VaR / ES (%)");
  // Legende nach RECHTS (untereinander) wie im Market-Chart "How has market risk evolved over time?".
  options.plugins.legend = {
    display: true, position: "right",
    labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, font: { size: 10 } },
  };

  try {
    _creditRiskChartByCanvas[canvasId] = createTimeSeriesChart(
      canvasId,
      data,
      options,
      "line"
    );
  } catch (err) {
    console.error("💥 Fehler beim Erzeugen von", canvasId, err);
  }
  // "Reset Zoom"-Button wie bei den anderen History-Charts (Yield/Value). Zoom ist ueber
  // createPercentChartOptions aktiv; ohne diesen Aufruf fehlt der Button zum Zuruecksetzen.
  ensureZoomResetButton(canvasId);
}
// Vergleichs-Zinsreihe im "How is the yield developing?"-Chart (perfHistYieldChart) ist
// per Dropdown waehlbar. Kandidaten -> nur die, die in tblTS wirklich vorhanden sind,
// landen im Dropdown. Werte sind wie EU_1Y als Prozent gespeichert (raw/100 -> Bruch).
const _PERF_HIST_RATE_OPTIONS = [
  ["EU_1Y", "EU 1Y"], ["EU_5Y", "EU 5Y"], ["EU_10Y", "EU 10Y"], ["EU_20Y", "EU 20Y"], ["EU_30Y", "EU 30Y"],
  ["EU_ECB_Deposit", "EU ECB Deposit"], ["DE_10Y_long", "DE 10Y"],
  ["US_1Y", "US 1Y"], ["US_2Y", "US 2Y"], ["US_5Y", "US 5Y"], ["US_10Y", "US 10Y"], ["US_30Y", "US 30Y"],
  ["US_FED_RATE", "US Fed Rate"],
];
let _perfHistCompareCol = "EU_1Y";
function _perfHistCompareLabel() {
  const o = _PERF_HIST_RATE_OPTIONS.find(([c]) => c === _perfHistCompareCol);
  return o ? o[1] : _perfHistCompareCol;
}
let _perfHistCompareBound = false;
function ensurePerfHistCompareDropdown() {
  const sel = document.getElementById("perfHistCompareSelect");
  if (!sel) return;
  const ts = appState.getTblTSData?.() || [];
  const cols = new Set(Object.keys(ts[0] || {}));
  const avail = _PERF_HIST_RATE_OPTIONS.filter(([c]) => cols.has(c));
  if (!avail.length) return;
  const wantKeys = avail.map(([c]) => c).join(",");
  if (sel.dataset.keys !== wantKeys) {   // Optionen nur bei Aenderung neu setzen
    sel.dataset.keys = wantKeys;
    sel.innerHTML = avail.map(([c, l]) => `<option value="${c}">${l}</option>`).join("");
  }
  if (!avail.some(([c]) => c === _perfHistCompareCol)) _perfHistCompareCol = avail[0][0];
  sel.value = _perfHistCompareCol;
  if (!_perfHistCompareBound) {
    _perfHistCompareBound = true;
    sel.addEventListener("change", () => {
      _perfHistCompareCol = sel.value;
      try { renderPerformanceHistoryCopies(); } catch {}
    });
  }
}

function renderHistoricPortfolioYieldChart(historyData, canvasId = "historicPortfolioYieldChart") {
  historyData = Array.isArray(historyData) ? historyData : [];

  if (historyData.length === 0) {
    destroyChartByCanvasId(canvasId);
    return;
  }
  const tsData = appState.getTblTSData();

  //console.log('EU_1Y', tsData)

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

  // Vergleichsreihe: im "How is the yield developing?"-Chart die per Dropdown gewaehlte
  // Zinsspalte, sonst (Risk-History) fest EU_1Y.
  const _compareCol = (canvasId === "perfHistYieldChart") ? _perfHistCompareCol : "EU_1Y";
  const tsMap = new Map();
  tsData.forEach(row => {
    if (!row || !row.DATE) return;
    const normDate = normalizeDateStr(row.DATE);
    const raw = parseFloat(row[_compareCol]);



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

  destroyChartByCanvasId(canvasId);

  const data = {
    labels,
    datasets: [
      {
        // Verschobener Yield-History-Chart (#perfHistYieldChart) -> "Portfolio Yield";
        // der originale Risk-History-Chart behaelt "Portfolio Return".
        label: canvasId === "perfHistYieldChart" ? "Portfolio Yield" : "Portfolio Return",
        data: returns,
        // NUR im Yield-History-Panel: blaue Linie + blaue Flaechen-Schattierung wie im
        // "How is the yield developing?"-Chart. Sonst (Risk-History) unveraendert teal.
        borderColor: canvasId === "perfHistYieldChart" ? "#6C9BD1" : "#4bc0c0",
        backgroundColor: canvasId === "perfHistYieldChart"
          ? (c) => {
              const { ctx, chartArea } = c.chart;
              if (!chartArea) return "rgba(108,155,209,0.20)";
              const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
              g.addColorStop(0, "rgba(108,155,209,0.35)");
              g.addColorStop(1, "rgba(108,155,209,0.02)");
              return g;
            }
          : "rgba(75, 192, 192, 0.15)",
        // Yield-History: glatter + dicker wie im "How is the yield developing?"-Chart.
        borderWidth: canvasId === "perfHistYieldChart" ? 3 : 2,
        pointRadius: 0,
        tension: canvasId === "perfHistYieldChart" ? 0.35 : 0.2,
        fill: canvasId === "perfHistYieldChart",
        yAxisID: "y"
      },
      {
        label: (canvasId === "perfHistYieldChart") ? _perfHistCompareLabel() : "EU 1Y",
        data: eu1ySeries,
        borderColor: "#ff9800",
        backgroundColor: "rgba(255, 152, 0, 0.15)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
        yAxisID: "y"
      }
    ]
  };

  const options = createPercentChartOptions("MVaR / ES Metrics (%)");
  // Achsen-Beschriftung theme-aware faerben (createPercentChartOptions setzt keine Farbe
  // -> im Dark-Theme sonst zu dunkel). Nur fuer perfHistYieldChart, wie im Scatter
  // "Where does the yield come from?" (--chart-text / --chart-grid).
  if (canvasId === "perfHistYieldChart") {
    const cs = getComputedStyle(document.body);
    const axisText = (cs.getPropertyValue("--chart-text") || "#888").trim();
    const axisGrid = (cs.getPropertyValue("--chart-grid") || "rgba(120,120,120,0.25)").trim();
    ["x", "y"].forEach((ax) => {
      const s = options.scales?.[ax];
      if (!s) return;
      s.ticks = { ...(s.ticks || {}), color: axisText };
      s.title = { ...(s.title || {}), color: axisText };
      s.grid  = { ...(s.grid  || {}), color: axisGrid };
    });
    // Korrekter y-Achsentitel (createPercentChartOptions liefert faelschlich "MVaR / ES Metrics").
    if (options.scales?.y?.title) options.scales.y.title.text = "Portfolio Yield (%)";
    // Zeitachse: weniger vertikale Gitterlinien. Ohne Limit zieht Chart.js eine Linie pro
    // Datum (~50) -> dichtes, dunkel wirkendes Band. Wie im Scatter nur wenige Ticks/Linien.
    if (options.scales?.x) {
      options.scales.x.ticks = { ...(options.scales.x.ticks || {}), maxTicksLimit: 8, autoSkip: true, maxRotation: 0 };
    }
  }
  // Legende seitlich (rechts) + kleine, leicht abgerundete Symbole.
  options.plugins.legend = {
    display: true, position: "right",
    labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, font: { size: 10 } }
  };
  // Tooltip fest in der oberen linken Ecke (nicht am Cursor).
  ensureFixedTooltipPositioner();
  options.plugins.tooltip.position = "histFixedCorner";
  options.plugins.tooltip.caretSize = 0;
  // Fadenkreuz am Cursor + Werte am Rand.
  ensureHistCrosshairPlugin();
  options.plugins.histCrosshair = { enabled: true };
  // perfHistYieldChart: Tooltip weg (das Fadenkreuz zeigt die Werte am Rand). Crosshair bleibt.
  if (canvasId === "perfHistYieldChart") {
    options.plugins.tooltip = { ...(options.plugins.tooltip || {}), enabled: false };
  }

  const _yieldChart = createTimeSeriesChart(canvasId, data, options, "line");
  if (canvasId === "historicPortfolioYieldChart") historicPortfolioYieldChart = _yieldChart;
  ensureZoomResetButton(canvasId);
}
function renderHistoricPortfolioSensChart(historyData) {
  historyData = Array.isArray(historyData) ? historyData : [];

  if (historyData.length === 0) {
    destroyChartByCanvasId("historicMarketRiskChart");
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

  if (historicPortfolioSensChart) {
    try {
      historicPortfolioSensChart.destroy();
    } catch (err) {
      console.error("⚠️ Fehler beim Destroy von historicPortfolioSensChart:", err);
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
    callback: (val) => `${Number(val).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}bp`
  };

  options.plugins = options.plugins || {};
  options.plugins.tooltip = {
    ...(options.plugins.tooltip || {}),
    callbacks: {
      ...(options.plugins.tooltip.callbacks || {}),
      label: (ctx) => {
        const y = ctx.raw;
        return `${ctx.dataset.label}: ${Number(y).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}bp`;
      }
    }
  };

  try {
    historicPortfolioSensChart = createTimeSeriesChart(
      "historicPortfolioSensChart",
      data,
      options,
      "line"
    );
    //console.log("✅ historicPortfolioSensChart rendered with", labels.length, "points");
  } catch (err) {
    console.error("💥 Fehler beim Erzeugen von historicPortfolioSensChart:", err);
  }
}

// Einzel-Serie-Zeitreihe (bp) fuer die Sensitivities-Panel-Charts: splittet den kombinierten
// Risk-History-Sens-Chart (PV01=MDURATION | CPV01=CPV01bp) in je einen eigenen Chart. Wird aus
// den PV01-/CPV01-Handlern beim Panel-/Portfolio-Refresh aufgerufen. Ueberspringt still, wenn
// die Canvas (noch) nicht gemountet ist.
const _sensPanelHistCharts = {};
export function renderSensHistorySingle(canvasId, historyData, { keys, label, borderColor, backgroundColor } = {}) {
  historyData = Array.isArray(historyData) ? historyData : [];
  if (!document.getElementById(canvasId)) return;           // View nicht gemountet
  if (historyData.length === 0) { destroyChartByCanvasId(canvasId); return; }

  const sortedData = [...historyData].sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
  const labels = sortedData.map(row => row.DATE);

  const readSeries = (row, ks) => {
    for (const k of ks) {
      if (k in row && row[k] != null && row[k] !== "") {
        const v = parseFloat(row[k]);
        if (!isNaN(v)) return v;
      }
    }
    return null;
  };
  const series = sortedData.map(row => readSeries(row, keys || []));

  // Alte Instanz auf dieser Canvas zerstoeren (verhindert doppelte Charts).
  if (_sensPanelHistCharts[canvasId]) {
    try { _sensPanelHistCharts[canvasId].destroy(); } catch {}
    _sensPanelHistCharts[canvasId] = null;
  }
  destroyChartByCanvasId(canvasId);

  const data = {
    labels,
    datasets: [{
      label,
      data: series,
      borderColor,
      backgroundColor,
      borderWidth: 2,
      pointRadius: 2,
      tension: 0.2,
    }],
  };

  // Gleiche bp-Achse/Tooltip wie der kombinierte Risk-History-Sens-Chart.
  const options = createPercentChartOptions("Sensitivities (bp)");
  options.scales = options.scales || {};
  options.scales.y = options.scales.y || {};
  options.scales.y.ticks = {
    ...(options.scales.y.ticks || {}),
    callback: (val) => `${Number(val).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}bp`,
  };
  options.plugins = options.plugins || {};
  options.plugins.tooltip = {
    ...(options.plugins.tooltip || {}),
    callbacks: {
      ...(options.plugins.tooltip?.callbacks || {}),
      label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.raw).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}bp`,
    },
  };

  // Explizite Puffergroesse + responsive:false, damit der Chart auch in einem VERBORGENEN
  // View gezeichnet wird (z.B. CPV01-Development, solange PV01 der aktive View ist). Sonst
  // haette die Canvas 0-Groesse -> leeres Bitmap -> im PDF/Report nur die "Huelle" ohne Graph.
  // Die CSS-Regel (width/height:100%) skaliert das feste Bitmap auf die Container-Groesse.
  const _canvas = document.getElementById(canvasId);
  const _cont = _canvas?.parentElement;
  const _w = Math.round(_cont?.clientWidth || 0) || 1000;   // 0 (verborgen) -> Fallback
  const _h = Math.round(_cont?.clientHeight || 0) || 300;
  if (_canvas) { _canvas.width = _w; _canvas.height = _h; }
  options.responsive = false;
  options.maintainAspectRatio = false;

  try {
    _sensPanelHistCharts[canvasId] = createTimeSeriesChart(canvasId, data, options, "line");
  } catch (err) {
    console.error(`💥 Fehler beim Erzeugen von ${canvasId}:`, err);
  }
}
function renderHistoricPortfolioValueChart(historyData, canvasId = "historicPortfolioValueChart") {
  historyData = Array.isArray(historyData) ? historyData : [];

  if (historyData.length === 0) {
    destroyChartByCanvasId("historicMarketRiskChart");
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

  destroyChartByCanvasId(canvasId);

  // Verschobener Value-History-Chart (#perfHistValueChart) -> kuerzere, Kachel-konsistente
  // Legende; der originale Risk-History-Chart behaelt seine bisherigen Labels.
  const _perf = canvasId === "perfHistValueChart";
  const data = {
    labels,
    datasets: [
      {
        type: "line",
        label: _perf ? "Portfolio Value" : "Portfolio Value / Notional",
        data: portValuePct,
        // Portfolio Value in der Portfolio-Farbe (wie der Portfolio-Punkt im Yield-vs-
        // reference-curve-Chart, getPortfolioColor); theme-aware.
        borderColor: _perf ? getPortfolioColor(1).borderColor : "rgba(54, 162, 235, 1)",
        backgroundColor: _perf ? getPortfolioColor(0.15).backgroundColor : "rgba(54, 162, 235, 0.15)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
        yAxisID: "y"
      },
      {
        type: "line",
        label: _perf ? "Portfolio Value (Buy)" : "Portfolio BUY Value / Notional",
        data: portValueBuyPct,
        borderColor: _perf ? "rgba(54, 162, 235, 1)" : "rgba(255, 99, 132, 1)",
        backgroundColor: _perf ? "rgba(54, 162, 235, 0.15)" : "rgba(255, 99, 132, 0.15)",
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.2,
        yAxisID: "y"
      },
      {
        type: "bar",
        label: _perf ? "Profit/Loss" : "Profit/Loss (%)",
        data: profitLossPct,
        yAxisID: "y1",
        // Gewinn gruen, Verlust rot.
        backgroundColor: profitLossPct.map(v => (Number(v) >= 0 ? "rgba(46,204,113,0.6)" : "rgba(211,70,70,0.6)")),
        borderColor: profitLossPct.map(v => (Number(v) >= 0 ? "rgba(46,204,113,1)" : "rgba(211,70,70,1)")),
        borderWidth: 1
      }
    ]
  };

const options = createPercentChartOptions("Portfolio Value / Notional (%)");

// linke Y-Achse explizit überschreiben/nachschärfen
options.scales.y = {
  ...options.scales.y,
  min: 0.9,           // harte Untergrenze
  beginAtZero: false, // globale Defaults aushebeln
  // Achsen-Titel aus: ueberlappt bei schmaler Report-Breite sonst die Ticks
  // (Legende + %-Ticks sind selbsterklaerend).
  title: { display: false }
};

options.scales.y1 = {
  position: "right",
  title: { display: false },
  ticks: {
    callback: (val) => {
      const num = Number(val);
      if (isNaN(num)) return "";
      return (num * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %";
    }
  },
  grid: {
    drawOnChartArea: false
  }
};

// App-Chart (perfHistValueChart): Legende RECHTS. Report-Variante (schmal): weiter UNTEN,
// damit sie nicht abgeschnitten wird und der Plot die volle Breite bekommt.
options.plugins.legend = {
  display: true, position: _perf ? "right" : "bottom",
  labels: { usePointStyle: true, pointStyle: "rectRounded", boxWidth: 10, boxHeight: 10, font: { size: 10 } }
};
// Tooltip fest in der oberen linken Ecke (nicht am Cursor).
ensureFixedTooltipPositioner();
options.plugins.tooltip.position = "histFixedCorner";
options.plugins.tooltip.caretSize = 0;
// Fadenkreuz am Cursor + Werte am Rand.
ensureHistCrosshairPlugin();
options.plugins.histCrosshair = { enabled: true };

const _valueChart = createTimeSeriesChart(canvasId, data, options, "bar");
if (canvasId === "historicPortfolioValueChart") historicPortfolioValueChart = _valueChart;
ensureZoomResetButton(canvasId);

}


// ✅ Registry bleibt – Renderer bekommen NUR die gefilterten Daten für das aktive port_name
export function getHistoricChartsRegistry() {
  return {
    yield:  { canvasId: "historicPortfolioYieldChart",  render: (hist) => renderHistoricPortfolioYieldChart(hist) },
    value:  { canvasId: "historicPortfolioValueChart",  render: (hist) => renderHistoricPortfolioValueChart(hist) },
    sens:   { canvasId: "historicPortfolioSensChart",   render: (hist) => renderHistoricPortfolioSensChart(hist) },
    market: { canvasId: "historicMarketRiskChart",      render: (hist) => renderHistoricMarketRiskChart(hist) },
    credit: { canvasId: "historicCreditRiskChart",      render: (hist) => renderHistoricCreditRiskChart(hist) },
  };
}

function destroyChartByCanvasId(canvasId) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) return;

  const existing = window.Chart?.getChart ? window.Chart.getChart(canvas) : null;
  if (existing) {
    try { existing.destroy(); } catch (_) {}
  }

  const ctx = canvas.getContext?.("2d");
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
}

export function destroyHistoricCharts(keys = null) {
  const reg = getHistoricChartsRegistry();
  const list = Array.isArray(keys) && keys.length ? keys : Object.keys(reg);

  for (const k of list) {
    const canvasId = reg[k]?.canvasId;
    if (canvasId) destroyChartByCanvasId(canvasId);
  }
}

export function renderHistoricCharts(keys = null, hist = []) {
  const reg = getHistoricChartsRegistry();
  const list = Array.isArray(keys) && keys.length ? keys : Object.keys(reg);

  for (const k of list) {
    const fn = reg[k]?.render;
    if (typeof fn === "function") fn(hist);
  }
}


export function rerenderHistoricCharts({ keys = null } = {}) {
  const selectedPortNameRaw = appState.getSelectedPortTableName?.();
  const selectedPortName = String(selectedPortNameRaw ?? "").trim();

  const all =
    (typeof appState.getPortfolioHistoryData === "function")
      ? (appState.getPortfolioHistoryData() || [])
      : [];

  const histForPort = Array.isArray(all)
    ? all.filter(r => String(r?.port_name ?? "").trim() === selectedPortName)
    : [];

  // Debug (kannst du später entfernen)
  // console.log("[HIST] selectedPortName:", selectedPortNameRaw, "->", selectedPortName,
  //             "all:", Array.isArray(all) ? all.length : "NOT_ARRAY",
  //             "filtered:", histForPort.length);

  if (!selectedPortName || histForPort.length === 0) {
    destroyHistoricCharts(keys);
    try { renderPerformanceHistoryCopies(); } catch {}
    return;
  }

  renderHistoricCharts(keys, histForPort);
  try { renderPerformanceHistoryCopies(); } catch {}
}

// History-Charts ZUSAETZLICH in den Profit/Loss- bzw. Economic-Capital-Panels (eigene Canvas-IDs
// -> keine Kollision mit den Originalen in Risk History):
//  - panel-market  -> Market-Risk-History (MVaR/ES) unter die Verteilungscharts.
//  - panel-credit  -> Credit-Risk-History (Credit VaR/ES) unten im EC-Panel (historic PD).
// Beim Oeffnen mit der Portfolio-History des gewaehlten Ports fuellen.
// Sprechende Legenden-Labels fuer die eingebetteten Market-Risk-History-Charts (statt des
// kryptischen "MVaR All (%)"). Profit/Loss: nur Gesamt. Factors: zusaetzlich nach Risikofaktor
// (Total = All, IR = Interest Rate, CS = Credit Spread).
const PL_MKT_LABEL_MAP = {
  'MVaR All (%)': 'VaR 95% · 10d',
  'M ES All (%)': 'Expected Shortfall 95% · 10d',
};
// VaR orange, ES rot - dieselben Farben wie die VaR-/ES-Linien in den Verteilungscharts.
const PL_MKT_COLOR_MAP = {
  'MVaR All (%)': { border: 'rgba(255,150,0,0.98)', bg: 'rgba(255,150,0,0.15)' },
  'M ES All (%)': { border: 'rgba(255,0,0,0.95)',   bg: 'rgba(255,0,0,0.15)' },
};
const FACTORS_MKT_LABEL_MAP = {
  'MVaR All (%)': 'VaR 95% · 10d (Total)',
  'MVaR IR (%)':  'VaR 95% · 10d (IR)',
  'MVaR CS (%)':  'VaR 95% · 10d (CS)',
  'M ES All (%)': 'Expected Shortfall 95% · 10d (Total)',
  'M ES IR (%)':  'Expected Shortfall 95% · 10d (IR)',
  'M ES CS (%)':  'Expected Shortfall 95% · 10d (CS)',
};

document.addEventListener('panel:opened', (e) => {
  const pid = e?.detail?.panelId;
  if (pid !== 'panel-market' && pid !== 'panel-credit' && pid !== 'panel-mvar') return;
  try {
    const sel = String(appState.getSelectedPortTableName?.() ?? '').trim();
    const hist = (appState.getPortfolioHistoryData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === sel);
    if (pid === 'panel-market') {
      // Profit/Loss: nur die Gesamt-Serien (MVaR All + M ES All).
      renderHistoricMarketRiskChart(hist, 'plMarketRiskHistChart', {
        onlyLabels: ['MVaR All (%)', 'M ES All (%)'],
        labelMap: PL_MKT_LABEL_MAP,
        colorMap: PL_MKT_COLOR_MAP,
      });
    } else if (pid === 'panel-mvar') {
      // Factors: voller Chart mit ALLEN Zeitreihen (All/IR/CS je VaR + ES).
      renderHistoricMarketRiskChart(hist, 'factorsMarketRiskHistChart', { labelMap: FACTORS_MKT_LABEL_MAP });
    } else {
      renderHistoricCreditRiskChart(hist, 'plCreditRiskHistChart');
    }
  } catch (err) { console.warn('[PL] history chart copy failed', pid, err); }
});

// Eingebettete Risk-History-Line-Charts fuer EIN Portfolio (neu) rendern:
//   - Profit & Loss:      "How has market risk evolved over time?" (plMarketRiskHistChart)
//   - Economic Capital:   "How has credit risk evolved over time?" (plCreditRiskHistChart)
// Wird vom Portfolio-Orchestrator (renderPortTable) bei JEDEM Portfolio-Wechsel mit dem
// AUTHORITATIVEN port_name aufgerufen -> zuverlaessig. (Das frueher genutzte Event
// 'portfolio-context-changed' feuert nur bei previous!==next und war je nach Wechsel-Pfad
// unzuverlaessig -> Sichtbarkeit hing "einen Wechsel hinterher".)
// Nur rendern, wenn das jeweilige Panel offen ist (sonst 0-Size-Canvas). Die Render-Funktionen
// blenden #plMarketRiskHistPanel / #plCreditRiskHistPanel je nach Datenlage selbst ein/aus.
export function renderEmbeddedRiskHistoryCharts(portName) {
  try {
    const sel = String(portName ?? appState.getSelectedPortTableName?.() ?? '').trim();
    const hist = (appState.getPortfolioHistoryData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === sel);
    if (document.getElementById('panel-market')?.classList.contains('open')) {
      renderHistoricMarketRiskChart(hist, 'plMarketRiskHistChart', {
        onlyLabels: ['MVaR All (%)', 'M ES All (%)'],
        labelMap: PL_MKT_LABEL_MAP,
        colorMap: PL_MKT_COLOR_MAP,
      });
    }
    if (document.getElementById('panel-credit')?.classList.contains('open')) {
      renderHistoricCreditRiskChart(hist, 'plCreditRiskHistChart');
    }
  } catch (e) { console.warn('[hist] embedded risk-history portfolio-switch refresh failed', e); }
}

// Nach jedem (Neu-)Laden der PortfolioHistoryMetrics (z.B. "Save to Historic Metrics")
// ALLE darauf basierenden Charts refreshen: die Original-History-Charts (rerenderHistoricCharts,
// inkl. Performance-Kopien) + die eingebetteten Kopien in Profit/Loss, Factors und Economic
// Capital - letztere nur, wenn ihr Panel gerade sichtbar ist (sonst 0-Size-Render / RAF-Loop;
// beim naechsten Oeffnen zeichnet der panel:opened-Listener ohnehin neu).
document.addEventListener('portfolio-history-updated', () => {
  try { rerenderHistoricCharts(); } catch (e) { console.warn('[hist] rerender originals failed', e); }
  try {
    const sel = String(appState.getSelectedPortTableName?.() ?? '').trim();
    const hist = (appState.getPortfolioHistoryData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === sel);
    const vis = (id) => { const c = document.getElementById(id); return !!(c && c.offsetParent !== null); };
    if (vis('plMarketRiskHistChart')) renderHistoricMarketRiskChart(hist, 'plMarketRiskHistChart', {
      onlyLabels: ['MVaR All (%)', 'M ES All (%)'],
      labelMap: PL_MKT_LABEL_MAP,
      colorMap: PL_MKT_COLOR_MAP,
    });
    if (vis('factorsMarketRiskHistChart')) renderHistoricMarketRiskChart(hist, 'factorsMarketRiskHistChart', { labelMap: FACTORS_MKT_LABEL_MAP });
    if (vis('plCreditRiskHistChart')) renderHistoricCreditRiskChart(hist, 'plCreditRiskHistChart');
  } catch (e) { console.warn('[hist] embedded copy refresh failed', e); }
});

// Kopien der Yield- + Value-History-Charts fuer das Panel "Performance -> History"
// (eigene Canvas-IDs, damit KEINE ID-Kollision mit den Originalen in Risk History).
// Zeichnet dieselben Daten in perfHistYieldChart / perfHistValueChart.
let _perfHistThemeBound = false;
function _bindPerfHistTheme() {
  if (_perfHistThemeBound) return;
  _perfHistThemeBound = true;
  // Wie der Scatter (bindPerformanceDashboardTheme): bei Theme-Wechsel die perfHist-Charts
  // mit den neuen Theme-Farben (--chart-grid/--chart-text) neu zeichnen, sonst bleiben sie
  // in den Farben des Erst-Renders haengen und passen nicht zum Nachbarchart.
  document.addEventListener("theme:changed", () => {
    const yp = document.getElementById("panel-performance-dashboard");
    const pp = document.getElementById("panel-performance-history");
    if (yp?.classList.contains("open") || pp?.classList.contains("open")) {
      try { renderPerformanceHistoryCopies(); } catch {}
    }
  });
}

export function renderPerformanceHistoryCopies() {
  _bindPerfHistTheme();
  const sel = String(appState.getSelectedPortTableName?.() ?? "").trim();

  // KPIs: aktueller NAV, Einstandswert (Buy) und P/L des ausgewaehlten Portfolios.
  // Verhalten wie die Overview-Kacheln: absoluter Wert + relative 2. Zeile; welcher
  // Wert gross steht, folgt dem Customer-Setup-Switch (abs/rel) der Kacheln nav/nav_buy/pnl.
  try {
    const _set = (id, t) => { const el = document.getElementById(id); if (el) el.innerHTML = t; };
    // "(of notional)" etc. zarter setzen (muted, nicht fett) — wie die 2. Zeile.
    const _q = (s) => `<span class="conc-kpi__qual">(${s})</span>`;
    const _pf = (v) => { const n = parseFloat(String(v ?? "").replace(/\s/g, "").replace(",", ".")); return Number.isFinite(n) ? n : 0; };
    const _eur = (v) => fmtEur(v);   // zentral: "EUR" VORNE (tableCellFormats.fmtEur)
    const _pct = (v) => Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + " %" : "–";
    // grosser Wert + kleine 2. Zeile je nach Mode ('abs' -> abs gross, 'rel' -> rel gross).
    const _kpi = (bigId, subId, key, absStr, relStr) => {
      const rel = (getTileMode?.(key) === "rel");
      _set(bigId, rel ? relStr : absStr);
      _set(subId, rel ? absStr : relStr);
    };

    const portRows = (appState.getAllPortfolioData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? "").trim() === sel);
    let _nav = 0, _navBuy = 0, _notional = 0;
    for (const r of portRows) {
      const n = _pf(r.NOTIONAL ?? r.notional);
      _notional += n;
      _nav += _pf(r.NAV ?? r.nav);
      _navBuy += (_pf(r.PRICE_BUY ?? r.price_buy) / 100) * n;
    }
    const _pnl = _nav - _navBuy;

    // Relative wie in den Overview-Kacheln: NAV/NAVBuy relativ zur Nominale (% of notional),
    // P/L relativ zum Einstand (% of buy value).
    const _navRel    = _notional ? `${_pct(_nav / _notional * 100)} ${_q("of notional")}` : "–";
    const _navBuyRel = _notional ? `${_pct(_navBuy / _notional * 100)} ${_q("of notional")}` : "–";
    const _pnlRel    = _navBuy ? `${_pct(_pnl / _navBuy * 100)} ${_q("of buy value")}` : "–";
    // Nur der %-Wert ohne "(of notional)"-Zusatz — fuer den PDF-Mirror, wo "(of notional)"
    // ins Kachel-Label (Zeile 1) wandert statt in die Sub-Zeile.
    const _navPct    = _notional ? _pct(_nav / _notional * 100)    : "–";
    const _navBuyPct = _notional ? _pct(_navBuy / _notional * 100) : "–";
    // "EUR" im Wert kleiner (.cur-unit) — einheitlich in allen EUR-Zahlen dieses Panels.
    const _eurWrap = (s) => String(s).replace("EUR", '<span class="cur-unit">EUR</span>');

    // Performance-Historie des Portfolios, nach Datum sortiert; Vorperiode = vorletzter
    // Eintrag. Daraus je Kennzahl die Veraenderung (relativ %, absolut EUR) ableiten.
    const _hist = (appState.getPortfolioHistoryData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? "").trim() === sel)
      .slice().sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
    const _prevRow = _hist[_hist.length - 2];
    const _sg = (v) => (v > 0 ? "+" : (v < 0 ? "-" : ""));
    // App-Aenderungszeile: Kreis-Pfeil-Badge (Richtung) am Anfang statt +/-.
    const _badge = (up) => `<span class="perf-chg-badge ${up ? "is-up" : "is-down"}">${up ? "↗" : "↘"}</span>`;
    const _chg = (cur, prevRaw) => {
      const p = _pf(prevRaw);
      if (!Number.isFinite(p) || p === 0) return null;
      const dAbs = cur - p, dPct = dAbs / p * 100;
      // abs/rel als Betrag (ohne Vorzeichen); Richtung via `up` -> Badge (App) bzw. +/- (PDF-Mirror).
      return { up: dAbs >= 0, abs: _eur(Math.abs(dAbs)), rel: _pct(Math.abs(dPct)) };
    };
    // Vorzeichen fuer den PDF-Mirror (dort kein Badge, sondern Textzeichen).
    const _pm = (c) => (c && c.up ? "+" : "-");

    // Notional: Veraenderung (%, absolut) in einer Zeile — mit Kreis-Pfeil am Anfang.
    const _notC = _chg(_notional, _prevRow?.PORTFOLIO_NOTIONAL ?? _prevRow?.PORTVOLIO_NOTIONAL);
    const _notionalChg = _notC ? `${_badge(_notC.up)}${_eurWrap(_notC.abs)} · ${_notC.rel}` : "–";

    // Kachel-Layout (NAV & NAV Buy), fest (kein abs/rel-Toggle):
    //  Zeile 2 = "%" (gross) + absoluter Wert (muted; statt "(of notional)").
    //  Zeile 3 = nur die Aenderungsraten: absolute · relative — OHNE Klammern.
    const _navC = _chg(_nav, _prevRow?.PORTFOLIO_VALUE);
    // Zeile 2: absoluter Wert (EUR klein) + relative % (muted). Zeile 3: Kreis+Pfeil + Aenderung.
    const _navLine2 = _notional ? `${_eurWrap(_eur(_nav))} <span class="conc-kpi__qual">${_navPct}</span>` : _eurWrap(_eur(_nav));
    const _navLine3 = _navC ? `${_badge(_navC.up)}${_eurWrap(_navC.abs)} · ${_navC.rel}` : "";

    // NAV (Buy): analog, History-Feld PORTFOLIO_VALUE_BUY = Einstandswert je Periode.
    const _navBuyC = _chg(_navBuy, _prevRow?.PORTFOLIO_VALUE_BUY);
    const _navBuyLine2 = _notional ? `${_eurWrap(_eur(_navBuy))} <span class="conc-kpi__qual">${_navBuyPct}</span>` : _eurWrap(_eur(_navBuy));
    const _navBuyLine3 = _navBuyC ? `${_badge(_navBuyC.up)}${_eurWrap(_navBuyC.abs)} · ${_navBuyC.rel}` : "";

    _set("perfHistKpiNotional", _eurWrap(_eur(_notional)));
    _set("perfHistKpiNotionalChg", _notionalChg);
    _set("perfHistKpiNav",       _navLine2);
    _set("perfHistKpiNavRel",    _navLine3);
    _set("perfHistKpiNavBuy",    _navBuyLine2);
    _set("perfHistKpiNavBuyRel", _navBuyLine3);
    _kpi("perfHistKpiPnl",    "perfHistKpiPnlRel",    "pnl",     _eurWrap(_eur(_pnl)),    _pnlRel);

    // Report-Spiegel: KPI-Band-Tabelle (data-kpi-band) fuer Preview/PDF.
    const _kpiTbl = document.getElementById("perfHistKpiTable");
    if (_kpiTbl) {
      const _esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
      const _strip = (s) => String(s).replace(/<[^>]*>/g, "").replace(/\s+/g, " ").trim();
      // [label, value, trend] — trend {up, chg} -> Kreis+Pfeil + Aenderung im PDF (drawKpiBand).
      const _rows = [
        ["Notional", `${_eur(_notional)}`, _notC ? { up: _notC.up, chg: `${_notC.abs} · ${_notC.rel}` } : null],
        ["Net Asset Value (Buy) (of notional)", `${_eur(_navBuy)} · ${_navBuyPct}`, _navBuyC ? { up: _navBuyC.up, chg: `${_navBuyC.abs} · ${_navBuyC.rel}` } : null],
        ["Net Asset Value (of notional)", `${_eur(_nav)} · ${_navPct}`, _navC ? { up: _navC.up, chg: `${_navC.abs} · ${_navC.rel}` } : null],
        ["Profit / Loss", `${_eur(_pnl)} · ${_strip(_pnlRel)}`, null],
      ];
      _kpiTbl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
        _rows.map(([k, v, tr]) => `<tr><td>${_esc(k)}</td><td${tr ? ` data-up="${tr.up ? 1 : 0}" data-chg="${_esc(tr.chg)}"` : ""}>${_esc(v)}</td></tr>`).join("")
      }</tbody></table>`;
    }
  } catch (e) { console.warn("[perfHist] KPI failed", e); }

  const all = (typeof appState.getPortfolioHistoryData === "function")
    ? (appState.getPortfolioHistoryData() || [])
    : [];
  const hist = Array.isArray(all)
    ? all.filter(r => String(r?.port_name ?? "").trim() === sel)
    : [];
  if (!sel || !hist.length) {
    destroyChartByCanvasId("perfHistYieldChart");
    destroyChartByCanvasId("perfHistValueChart");
    return;
  }
  ensurePerfHistCompareDropdown();   // Vergleichs-Zins-Dropdown befuellen/binden
  renderHistoricPortfolioYieldChart(hist, "perfHistYieldChart");
  renderHistoricPortfolioValueChart(hist, "perfHistValueChart");
}

