import { getColorFromPalette, getEuswCurveColor } from '../utils/colors.js';
import { saveTrendlines, loadTrendlines } from '../features/MARKET_DATA/HISTORIC_DATA/TS.js';
//import { saveTrendlines, loadTrendlines } from '../renderer/MARKET_DATA/HISTORIC_DATA/TS.js';


const chartsByCanvasId = new Map();
// Gewählter Zeitbereich je TS-Modal (1/5/10/'max'), damit ein Live-Redraw
// (SMA/Normalization/Select Data) den aktuellen Zoombereich NICHT auf 5Y zurücksetzt.
const tsRangeByModal = {};
let chartInstance = null;
let futurePredictionsChartInstance = null;
let FWDlineChartInstance;
let isDrawing = false; // Variable to track if the mouse is being pressed
let debounceTimeout;

// Fadenkreuz am Cursor (gestrichelte Linien über die Chart-Fläche) — für den
// TS-Chart. Wird lokal in createLineChart eingehängt (nicht global).
const tsCrosshairPlugin = {
  id: 'tsCrosshair',
  afterEvent(chart, args) {
    const e = args.event;
    if (!e) return;
    if (e.type === 'mousemove') {
      chart.$crosshair = { x: e.x, y: e.y };
      args.changed = true;
    } else if (e.type === 'mouseout') {
      if (chart.$crosshair) { chart.$crosshair = null; args.changed = true; }
    }
  },
  afterDraw(chart) {
    const c = chart.$crosshair;
    const area = chart.chartArea;
    if (!c || !area) return;
    if (c.x < area.left || c.x > area.right || c.y < area.top || c.y > area.bottom) return;
    const ctx = chart.ctx;
    ctx.save();
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeStyle = 'rgba(160, 160, 160, 0.75)';
    ctx.beginPath(); ctx.moveTo(c.x, area.top); ctx.lineTo(c.x, area.bottom); ctx.stroke();  // vertikal
    ctx.beginPath(); ctx.moveTo(area.left, c.y); ctx.lineTo(area.right, c.y); ctx.stroke();  // horizontal
    ctx.restore();
  }
};


export default function createLineChart(datasets, chartName, chartTitle, pointRadius, modalIndex, smaPeriods) {
  const canvasElement = document.getElementById(chartName);
  if (!canvasElement) { console.error(`Canvas element with ID "${chartName}" not found.`); return null; }

  // Tooltip-Positioner: fixiert das Tooltip-Fenster oben links in der Chart-Fläche
  // (statt am Datenpunkt zu kleben). Einmalig registrieren.
  if (typeof Chart !== 'undefined' && Chart.Tooltip && !Chart.Tooltip.positioners.tsFixed) {
    Chart.Tooltip.positioners.tsFixed = function () {
      const area = this.chart.chartArea;
      return { x: area.left + 12, y: area.top + 12 };
    };
  }


  // âœ… Immer den alten Chart dieser Canvas-ID zerstÃ¶ren
  const prev = chartsByCanvasId.get(chartName);
  if (prev) {
    prev.destroy();                 // triggert auch deine Ã¼berschriebenen destroy-cleanups
    chartsByCanvasId.delete(chartName);
  }


  const ctx = canvasElement.getContext("2d");
  if (!ctx) { console.error(`Failed to get 2D context for ${chartName}.`); return null; }

  // --- Trendspeicher pro Chart ---
  const trendState = {
    lines: [],        // [{x1,y1,x2,y2}]
    drawing: false,   // ist im Draw-Modus?
    tempStart: null   // {x,y} Datenkoordinaten
  };

  // --- Zeichen-Plugin: rendert Linien nach den DatensÃ¤tzen ---
const trendlinePlugin = {
  id: 'trendlineDrawer',
  afterDatasetsDraw(chart, args, pluginOpts) {
    const { ctx } = chart;
    const sx = chart.scales.x;
    const sy = chart.scales.y;
    if (!sx || !sy) return;

    ctx.save();
    ctx.lineWidth = 1.5;
    ctx.strokeStyle = pluginOpts?.color || '#ffaa33';
    ctx.setLineDash(pluginOpts?.dash || []);

    // feste Linien
    trendState.lines.forEach(l => {
      const px1 = xPixel(chart, l.x1);
      const px2 = xPixel(chart, l.x2);
      if (px1 == null || px2 == null) return; // auÃŸerhalb des sichtbaren Bereichs/Labels nicht vorhanden
      const y1 = sy.getPixelForValue(l.y1);
      const y2 = sy.getPixelForValue(l.y2);
      ctx.beginPath(); ctx.moveTo(px1, y1); ctx.lineTo(px2, y2); ctx.stroke();
    });

    // Vorschau (wÃ¤hrend Ziehen)
    if (trendState.tempStart && pluginOpts?.preview && pluginOpts.preview.x !== undefined) {
      const px1 = xPixel(chart, trendState.tempStart.x);
      const px2 = xPixel(chart, pluginOpts.preview.x);
      if (px1 != null && px2 != null) {
        const y1 = sy.getPixelForValue(trendState.tempStart.y);
        const y2 = sy.getPixelForValue(pluginOpts.preview.y);
        ctx.setLineDash([4, 4]);
        ctx.strokeStyle = '#cccccc';
        ctx.beginPath(); ctx.moveTo(px1, y1); ctx.lineTo(px2, y2); ctx.stroke();
      }
    }

    ctx.restore();
  }
};


  // --- DatensÃ¤tze + SMAs zusammenbauen ---
  const allDatasets = [];
  datasets.forEach((dataset, index) => {
    const originalDataset = {
      label: dataset.label,
      data: dataset.data.map(p => ({ x: p.x, y: p.y, originalY: p.originalY })),
      fill: false,
      borderColor: getColorFromPalette(index),
      tension: 0.1,
      pointRadius: pointRadius,
      borderWidth: 1,
      spanGaps: false,
      borderDash: []
    };
    allDatasets.push(originalDataset);

    ['smaData1','smaData2','smaData3'].forEach((k,i)=>{
      if (dataset[k]?.length) {
        const period = smaPeriods[`sma${i+1}`];
        allDatasets.push({
          label: `${dataset.label} (SMA ${period})`,
          data: dataset[k].map(p=>({x:p.x,y:p.y})),
          fill: false,
          borderColor: `rgba(${255-(i*50)},0,0,0.5)`,
          borderDash: [5,5],
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2,
          spanGaps: false
        });
      }
    });
  });

  // --- Chart erstellen (Plugin einhÃ¤ngen) ---
  const chartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: datasets[0]?.data?.map(p=>p.x) || [],
      datasets: allDatasets
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      scales: {
        x: { display: true, title: { display: true, text: "Year" } },
        y: {
          display: true,
          // Log/Linear per Drawer-Toggle (#logScale_<modalIndex>).
          type: document.getElementById(`logScale_${modalIndex}`)?.checked ? 'logarithmic' : 'linear',
          title: { display: true, text: "Value" }
        }
      },
      plugins: {
        tooltip: {
          enabled: true,
          position: 'tsFixed',   // festes Fenster oben links (klebt nicht am Punkt)
          caretSize: 0,          // kein Zeiger-Dreieck
          callbacks: {
            label: (ctx) => {
              if (ctx.dataset.label.includes('SMA')) {
                return `${ctx.dataset.label}: ${ctx.raw?.y != null ? ctx.raw.y.toFixed(2) : 'N/A'}`;
              } else {
                const ov = ctx.raw ? ctx.raw.originalY : null;
                return `${ctx.dataset.label}: ${typeof ov === 'number' ? ov.toFixed(2) : 'N/A'}`;
              }
            }
          }
        },
        zoom: {
          pan: { enabled: true, mode: 'x' },
          zoom: {
            drag: { enabled: true },
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: 'x'
          }
        },
        trendlineDrawer: { color: '#ffaa33', dash: [] }
      }
    },
    plugins: [trendlinePlugin, tsCrosshairPlugin]
  });

  // --- gespeicherte Trendlinien nach Init laden ---
loadTrendlines(modalIndex, chartName).then((loaded) => {
  console.log('[TS-TL][CHART][APPLY] modal=', modalIndex, 'chart=', chartName, 'count=', Array.isArray(loaded) ? loaded.length : 0);
  if (!chartInstance.ctx) return;
  if (Array.isArray(loaded) && loaded.length) {
    trendState.lines = loaded.map(({ x1, y1, x2, y2 }) => ({ x1, y1, x2, y2 }));
    chartInstance.update();
  }
});




  // --- Zeichen-UI (Buttons) ---
ensureDrawToolbar(
  canvasElement,
  modalIndex,
  () => { // Toggle Draw
    trendState.drawing = !trendState.drawing;
    chartInstance.options.plugins.trendlineDrawer.preview = null;
    chartInstance.update();
  },
  async () => { // Undo last line (statt alles lÃ¶schen)
    if (!trendState.lines.length) return;           // nichts zu tun
    trendState.lines.pop();                         // letzte Linie entfernen
    trendState.tempStart = null;
    chartInstance.options.plugins.trendlineDrawer.preview = null;
    chartInstance.update();
    await saveTrendlines(modalIndex, chartName, trendState.lines);
  }
);


  // --- Canvas-Events fÃ¼r Zeichnen ---
  const getDataPointFromEvent = (evt) => {
    const pos = Chart.helpers.getRelativePosition(evt, chartInstance);
    const sx = chartInstance.scales.x;
    const sy = chartInstance.scales.y;
    if (!sx || !sy) return null;
    const xVal = sx.getValueForPixel(pos.x);
    const yVal = sy.getValueForPixel(pos.y);
    return (xVal == null || yVal == null) ? null : { x: xVal, y: yVal };
  };

const onClick = async (evt) => {
  if (!trendState.drawing) return;
  const pt = xValueFromEvent(chartInstance, evt);
  if (!pt) return;

  // y aus Pixel â†’ Datenwert
  const pos = Chart.helpers.getRelativePosition(evt, chartInstance);
  const sy  = chartInstance.scales.y;
  const y   = sy.getValueForPixel(pos.y);
  if (y == null) return;

  const xVal = pt.x; // Label (category) ODER Number (time/linear)

  if (!trendState.tempStart) {
    trendState.tempStart = { x: xVal, y };
  } else {
    const end = { x: xVal, y };
    if (evt.shiftKey) end.y = trendState.tempStart.y; // horizontale Linie

    trendState.lines.push({
      x1: trendState.tempStart.x, y1: trendState.tempStart.y,
      x2: end.x,                  y2: end.y
    });

    trendState.tempStart = null;
    chartInstance.options.plugins.trendlineDrawer.preview = null;
    chartInstance.update();
    await saveTrendlines(modalIndex, chartName, trendState.lines);
  }
};

const onMouseMove = (evt) => {
  if (!trendState.drawing || !trendState.tempStart) return;

  const pt = xValueFromEvent(chartInstance, evt);
  if (!pt) return;

  const pos = Chart.helpers.getRelativePosition(evt, chartInstance);
  const sy  = chartInstance.scales.y;
  const y   = sy.getValueForPixel(pos.y);
  if (y == null) return;

  const end = { x: pt.x, y };
  if (evt.shiftKey) end.y = trendState.tempStart.y;
  chartInstance.options.plugins.trendlineDrawer.preview = end;
  chartInstance.update('none');
};


  const onContextOrEsc = (evt) => {
    if ((evt.type === 'contextmenu') || (evt.type === 'keydown' && evt.key === 'Escape')) {
      trendState.tempStart = null;
      chartInstance.options.plugins.trendlineDrawer.preview = null;
      chartInstance.update();
    }
  };

  // Events binden
  canvasElement.addEventListener('click', onClick);
  canvasElement.addEventListener('mousemove', onMouseMove);
  canvasElement.addEventListener('contextmenu', (e)=>{ e.preventDefault(); onContextOrEsc(e); });
  window.addEventListener('keydown', onContextOrEsc);

  // Bestehende Buttons etc.
  setupChartButtons(chartInstance, datasets, modalIndex);

  // Cleanup beim Destroy (+ persist)
const _destroy = chartInstance.destroy.bind(chartInstance);

chartInstance.destroy = () => {
  // Speichern NICHT awaiten
  Promise.resolve(saveTrendlines(modalIndex, chartName, trendState.lines)).catch(()=>{});

  canvasElement.removeEventListener('click', onClick);
  canvasElement.removeEventListener('mousemove', onMouseMove);
  canvasElement.removeEventListener('contextmenu', onContextOrEsc);
  window.removeEventListener('keydown', onContextOrEsc);

  _destroy(); // Canvas wird SOFORT freigegeben
};



    // âœ… Chart merken
  chartsByCanvasId.set(chartName, chartInstance);

  return chartInstance;
}


/** pro Chart (modalIndex) eine kleine Zeichen-Toolbar ein */
function ensureDrawToolbar(canvasEl, modalIndex, onToggleDraw, onClear) {
  
  const holder = canvasEl.closest('.TSChart-container') || canvasEl.parentElement;
  if (!holder) return;

  const toolbarId = `tsDrawToolbar_${modalIndex}`;
  if (holder.querySelector(`#${toolbarId}`)) return;

  const bar = document.createElement('div');
  bar.id = toolbarId;
  bar.style.display = 'flex';
  bar.style.gap = '8px';
  bar.style.alignItems = 'center';
  bar.style.justifyContent = 'flex-end';
  bar.style.margin = '6px 0 8px';

  const btnDraw = document.createElement('button');
  btnDraw.type = 'button';
  btnDraw.title = 'Trendline zeichnen (Shift = horizontal)';
  btnDraw.innerHTML = 'Draw Line';
  btnDraw.style.padding = '6px 10px';
  btnDraw.style.borderRadius = '8px';
  btnDraw.style.border = '1px solid rgba(255,255,255,.12)';
  btnDraw.style.background = '#1a1a1a';
  btnDraw.style.color = '#cfcfcf';
  btnDraw.addEventListener('click', onToggleDraw);

  const btnClear = document.createElement('button');
  btnClear.type = 'button';
  btnClear.title = 'Alle Trendlines lÃ¶schen';
  btnClear.innerHTML = 'Clear';
  btnClear.style.padding = '6px 10px';
  btnClear.style.borderRadius = '8px';
  btnClear.style.border = '1px solid rgba(255,255,255,.12)';
  btnClear.style.background = '#1a1a1a';
  btnClear.style.color = '#cfcfcf';
  btnClear.addEventListener('click', onClear);

  bar.appendChild(btnDraw);
  bar.appendChild(btnClear);

  // Toolbar direkt VOR den Chart-Canvas setzen (falls du sie lieber oben willst)
  const chartCard = canvasEl.closest('.chart-container') || holder;
  chartCard.parentElement.insertBefore(bar, chartCard);
}
// Hilfsfunktionen: X-Wert â†” Pixel abhÃ¤ngig vom Scale-Typ
function xValueFromEvent(chart, evt) {
  const pos = Chart.helpers.getRelativePosition(evt, chart);
  const sx = chart.scales.x;
  if (!sx) return null;

  // category â†’ getValueForPixel gibt Index zurÃ¼ck â†’ auf Label mappen
  if (sx.type === 'category') {
    const idx = Math.round(sx.getValueForPixel(pos.x));
    const label = chart.data.labels?.[idx];
    return (label !== undefined) ? { x: label } : null;
  }

  // time/linear â†’ numerischer Wert
  const x = sx.getValueForPixel(pos.x);
  return (x == null) ? null : { x };
}

function xPixel(chart, xVal) {
  const sx = chart.scales.x;
  if (!sx) return null;

  if (sx.type === 'category') {
    const labels = chart.data.labels || [];
    const idx = labels.indexOf(xVal);
    if (idx === -1) return null;
    return sx.getPixelForValue(idx);
  }
  // time/linear
  return sx.getPixelForValue(xVal);
}

// === Hilfen: Label <-> Pixel Mapping ===
function xLabelToPixel(chart, xLabel) {
  const sx = chart.scales.x;
  if (!sx) return null;
  const labels = chart.data.labels || [];
  const idx = labels.indexOf(xLabel);
  if (idx < 0) return null;
  return sx.getPixelForValue(idx); // Category-Scale: Index -> Pixel
}

function pickXLabelFromEvent(chart, evt) {
  const sx = chart.scales.x;
  if (!sx) return null;
  const pos = Chart.helpers.getRelativePosition(evt, chart);
  let idx = Math.round(sx.getValueForPixel(pos.x));  // Index im aktuellen Label-Array
  const labels = chart.data.labels || [];
  idx = Math.max(0, Math.min(labels.length - 1, idx));
  return labels[idx]; // Datum/String-Label
}

// === Helpers: Date/Label utils ===
function parseDateMaybe(s) {
  // versuche ISO/Label â†’ Date
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
function getLabels(chart) {
  return chart?.data?.labels || [];
}
function getLabelDateRange(chart) {
  const labels = getLabels(chart);
  if (!labels.length) return { min: null, max: null };
  const first = parseDateMaybe(labels[0]);
  const last  = parseDateMaybe(labels[labels.length - 1]);
  return { min: first, max: last };
}
function findNearestIndexForDate(labels, target) {
  // labels: array of date-strings (ascending). binary search-ish fallback.
  let lo = 0, hi = labels.length - 1;
  const t = +target;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    const md  = +new Date(labels[mid]);
    if (md === t) return mid;
    if (md < t) lo = mid + 1; else hi = mid - 1;
  }
  // lo ist nun Insert-Position â†’ nimm nÃ¤chstliegend
  if (lo <= 0) return 0;
  if (lo >= labels.length) return labels.length - 1;
  const dl = Math.abs(+new Date(labels[lo]) - t);
  const dh = Math.abs(+new Date(labels[lo - 1]) - t);
  return (dl < dh) ? lo : (lo - 1);
}
function xAnyToPixel(chart, val) {
  // versteht xLabel (Datum-String) ODER altes numerisches x
  const sx = chart.scales.x;
  if (!sx) return null;
  const labels = getLabels(chart);

  // 1) Neues Format (Label/Datum)
  if (typeof val === 'string') {
    const d = parseDateMaybe(val);
    if (d) {
      const idx = findNearestIndexForDate(labels, d);
      return sx.getPixelForValue(idx);
    }
    // falls kein Datum, versuche exakte Label-Suche (kategorisch)
    const idx = labels.indexOf(val);
    if (idx >= 0) return sx.getPixelForValue(idx);
  }
  // 2) Altes Format (numerisch: Index/Value)
  if (typeof val === 'number') {
    return sx.getPixelForValue(val);
  }
  return null;
}
// clamp ein Linien-Ende auf sichtbaren Bereich via Date
function clampXLabelToView(chart, xLabelOrNum) {
  const labels = getLabels(chart);
  if (!labels.length) return xLabelOrNum;

  // wenn numerisch â†’ unverÃ¤ndert (alte DatensÃ¤tze)
  if (typeof xLabelOrNum === 'number') return xLabelOrNum;

  const d = parseDateMaybe(xLabelOrNum);
  if (!d) return xLabelOrNum;

  const { min, max } = getLabelDateRange(chart);
  if (!min || !max) return xLabelOrNum;

  if (d < min) return labels[0];
  if (d > max) return labels[labels.length - 1];
  return xLabelOrNum;
}







function setupChartButtons(chartInstance, datasets, modalIndex) {
  const filteredDatasetsCopy = JSON.parse(JSON.stringify(datasets));

  // Zurückgefüllten flachen Anfangslauf JE Serie ausblenden (y -> null = Lücke,
  // keine Linie). Nötig, damit kürzere Serien keinen waagrechten Strich zeigen,
  // wenn eine ANDERE Serie länger ist und die Achse weiter zurückreicht.
  filteredDatasetsCopy.forEach((dataset) => {
    const data = dataset?.data;
    if (!Array.isArray(data) || data.length < 2) return;
    const first = data[0]?.y;
    if (first == null) return;
    const changeIdx = data.findIndex((p) => p && p.y !== first);  // erster abweichender Wert
    // <=1: normale Serie (variiert sofort) ODER komplett konstant (-1) -> nicht anfassen.
    // Nur echte flache Anlaufstrecken (langer identischer Back-fill-Lauf) ausblenden.
    if (changeIdx <= 1) return;
    for (let i = 0; i < changeIdx; i++) {
      if (data[i]) data[i].y = null;
      ['smaData1', 'smaData2', 'smaData3'].forEach((k) => {
        if (Array.isArray(dataset[k]) && dataset[k][i]) dataset[k][i].y = null;
      });
    }
  });

  function getMaxYearsAvailable() {
    let maxYearsAvailable = 0;
    filteredDatasetsCopy.forEach((dataset) => {
      if (!dataset || !dataset.data) return;

      const firstValidIndex = dataset.data.findIndex(({ y }) => y !== null && !isNaN(y));
      const lastValidIndex = dataset.data.length - 1 - [...dataset.data].reverse().findIndex(({ y }) => y !== null && !isNaN(y));

      if (firstValidIndex !== -1 && lastValidIndex !== -1) {
        const firstDate = parseDateString(dataset.data[firstValidIndex].x);
        const lastDate = parseDateString(dataset.data[lastValidIndex].x);
        const yearsAvailable = (lastDate - firstDate) / (1000 * 60 * 60 * 24 * 365.25);

        maxYearsAvailable = Math.max(maxYearsAvailable, yearsAvailable);
      }
    });

    return maxYearsAvailable;
  }

  // "Max": ab dem ersten Datum, an dem eine geplottete Serie echte (variierende)
  // Werte hat -> schneidet den flach zurückgefüllten Prefix ab (kein waagrechter
  // Strich am Anfang). Nimmt das früheste solche Datum über alle Serien.
  function computeMaxStartDate() {
    let earliest = null;
    (filteredDatasetsCopy || []).forEach((ds) => {
      const data = ds?.data || [];
      if (!data.length) return;
      const first = data[0]?.y;
      let idx = data.findIndex((p) => p && p.y !== first);
      if (idx < 0) idx = 0;                 // komplett konstant -> ab Start
      const d = parseDateString(data[idx].x);
      if (d && (earliest == null || d < earliest)) earliest = d;
    });
    return earliest || new Date(0);
  }

  function filterDataByTimeRange(yearsBack) {
    let targetDate;
    if (yearsBack === 'max') {
      targetDate = computeMaxStartDate();
    } else {
      const maxYearsAvailable = getMaxYearsAvailable();
      const actualYearsBack = Math.min(yearsBack, maxYearsAvailable);
      const today = new Date();
      targetDate = new Date(today.setFullYear(today.getFullYear() - actualYearsBack));
    }

    const filteredDatasets = JSON.parse(JSON.stringify(filteredDatasetsCopy));

    filteredDatasets.forEach((dataset) => {
      if (!dataset || !dataset.data) return;

      dataset.data = dataset.data.filter(dataPoint => {
        const dataDate = parseDateString(dataPoint.x);
        return dataDate >= targetDate;
      });

      // Filter each SMA data set if it exists (SMA 1, SMA 2, SMA 3)
      ['smaData1', 'smaData2', 'smaData3'].forEach(smaKey => {
        if (dataset[smaKey]) {
          dataset[smaKey] = dataset[smaKey].filter(dataPoint => {
            const dataDate = parseDateString(dataPoint.x);
            return dataDate >= targetDate;
          });
        }
      });
    });

    // ---- Downsampling fürs Zeichnen ---------------------------------------
    // Lange Reihen (z.B. Max) auf ~1500 Punkte reduzieren -> deutlich schnelleres
    // Rendern der 4 Charts. WICHTIG: für ALLE Serien (+ SMA) dieselben Indizes,
    // sonst zerfällt die gemeinsame Kategorie-Achse. Kurze Bereiche (< Ziel)
    // bleiben voll aufgelöst (1Y/5Y unverändert).
    const TARGET_POINTS = 800;
    const srcLen = filteredDatasets[0]?.data?.length || 0;
    if (srcLen > TARGET_POINTS) {
      const stride = Math.ceil(srcLen / TARGET_POINTS);
      const keep = (arr) => (Array.isArray(arr)
        ? arr.filter((_, idx) => idx % stride === 0 || idx === arr.length - 1)
        : arr);
      filteredDatasets.forEach((ds) => {
        if (Array.isArray(ds.data)) ds.data = keep(ds.data);
        ds.smaData1 = keep(ds.smaData1);
        ds.smaData2 = keep(ds.smaData2);
        ds.smaData3 = keep(ds.smaData3);
      });
    }

    // Check which SMA is selected
    const applySMA1 = document.getElementById(`applySMA1_${modalIndex}`).checked;
    const applySMA2 = document.getElementById(`applySMA2_${modalIndex}`).checked;
    const applySMA3 = document.getElementById(`applySMA3_${modalIndex}`).checked;

    // Always load original dataset(s)
    chartInstance.data.labels = filteredDatasets[0]?.data.map(dataPoint => dataPoint.x) || [];
    
    const finalDatasets = [];
    filteredDatasets.forEach((dataset, index) => {
      finalDatasets.push({
        label: dataset.label,
        data: dataset.data,
        borderColor: getColorFromPalette(index),
        fill: false,
        tension: 0.1,
        pointRadius: 0,
        borderWidth: 2
      });

      // Push SMA datasets only if they are selected
      if (applySMA1 && dataset.smaData1) {
        finalDatasets.push({
          label: `${dataset.label} (SMA 1)`,
          data: dataset.smaData1,
          borderColor: 'rgba(255, 0, 0, 0.8)',  // Bright orange
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        });
      }
      if (applySMA2 && dataset.smaData2) {
        finalDatasets.push({
          label: `${dataset.label} (SMA 2)`,
          data: dataset.smaData2,
          borderColor: 'rgba(50, 205, 50, 0.8)',  // Bright lime green
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        });
      }
      if (applySMA3 && dataset.smaData3) {
        finalDatasets.push({
          label: `${dataset.label} (SMA 3)`,
          data: dataset.smaData3,
          borderColor: 'rgba(57, 255, 255, 0.8)',  // light blue
          borderDash: [5, 5],
          fill: false,
          tension: 0.1,
          pointRadius: 0,
          borderWidth: 2
        });
      }
    });

    chartInstance.data.datasets = finalDatasets;
    chartInstance.update();
  }

  // Aktiven Range-Button hervorheben (wie im Risk-Factors-Chart).
  function markActiveRange(buttonId) {
    const active = document.getElementById(buttonId);
    if (!active) return;
    const group = active.closest('.time-range-buttons');
    if (!group) return;
    group.querySelectorAll('button').forEach((b) => b.classList.remove('is-active'));
    active.classList.add('is-active');
  }

  function bindButton(buttonId, yearsBack) {
    const button = document.getElementById(buttonId);
    if (!button) {
      console.error(`Button with ID ${buttonId} not found.`);
      return;
    }
    button.replaceWith(button.cloneNode(true)); // Replace to reset event listeners
    const newButton = document.getElementById(buttonId);
    newButton.addEventListener('click', () => {
      chartInstance.resetZoom();
      tsRangeByModal[modalIndex] = yearsBack;   // Auswahl merken (überlebt Live-Redraw)
      filterDataByTimeRange(yearsBack);
      markActiveRange(buttonId);
    });
  }

  // Bind buttons with the appropriate year ranges
  bindButton(`oneYearButton_${modalIndex}`, 1);
  bindButton(`fiveYearButton_${modalIndex}`, 5);
  bindButton(`tenYearButton_${modalIndex}`, 10);
  bindButton(`maxButton_${modalIndex}`, 'max');

  // Reset-Zoom-Button (separat; setzt nur den Zoom zurück, ändert nicht den Range).
  const resetBtnId = `resetZoomButton_${modalIndex}`;
  const resetBtn = document.getElementById(resetBtnId);
  if (resetBtn) {
    resetBtn.replaceWith(resetBtn.cloneNode(true));
    document.getElementById(resetBtnId)?.addEventListener('click', () => {
      try { chartInstance.resetZoom(); } catch {}
    });
  }

  // Zuletzt gewählten Zeitbereich beibehalten (Default 5Y), damit ein
  // Live-Redraw den Zoombereich nicht zurücksetzt.
  const savedRange = (modalIndex in tsRangeByModal) ? tsRangeByModal[modalIndex] : 5;
  const rangeBtnId =
    savedRange === 'max' ? `maxButton_${modalIndex}` :
    savedRange === 1     ? `oneYearButton_${modalIndex}` :
    savedRange === 10    ? `tenYearButton_${modalIndex}` :
                           `fiveYearButton_${modalIndex}`;
  filterDataByTimeRange(savedRange);
  markActiveRange(rangeBtnId);
}




// Function to parse 'dd-mm-yyyy' format into a valid Date object
// function parseDateString(dateString) {
//   const [day, month, year] = dateString.split('-').map(Number);
//   return new Date(year, month - 1, day); // month is 0-indexed in JS Date
// }

function parseDateString(s) {
  if (!s) return null;

  // 1) "YYYY-MM-DD HH:mm:ss"  -> ISO machen
  if (typeof s === 'string') {
    const m1 = s.match(/^(\d{4})-(\d{2})-(\d{2})(?:[ T](\d{2}):(\d{2})(?::(\d{2}))?)?$/);
    if (m1) {
      const yyyy = m1[1], mm = m1[2], dd = m1[3];
      const HH = m1[4] ?? '00', MM = m1[5] ?? '00', SS = m1[6] ?? '00';
      const iso = `${yyyy}-${mm}-${dd}T${HH}:${MM}:${SS}`;
      const d = new Date(iso);
      return isNaN(d) ? null : d;
    }

    // 2) "DD-MM-YYYY" oder "DD.MM.YYYY"
    const m2 = s.match(/^(\d{2})[-.](\d{2})[-.](\d{4})$/);
    if (m2) {
      const iso = `${m2[3]}-${m2[2]}-${m2[1]}T00:00:00`;
      const d = new Date(iso);
      return isNaN(d) ? null : d;
    }
  }

  // 3) last resort
  const d = new Date(s);
  return isNaN(d) ? null : d;
}



export function createFWDLineChart(datasets, chartName, chartTitle, pointRadius) {
  const canvas = document.getElementById(chartName);
  if (!canvas) return null;

  // Destroy previous chart instance, if it exists
  if (typeof FWDlineChartInstance !== 'undefined' && FWDlineChartInstance) {
    FWDlineChartInstance.destroy();
  }

  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);

  const ctx = newCanvas.getContext("2d");
  Chart.defaults.font.color = "rgb(161, 160, 160)";

  const euswColor = getEuswCurveColor(1);
  // Start bei 1: Palette-Index 0 ist Blau und kollidiert mit der blauen
  // Original-Kurve (euswColor). So werden CMS-Kurven Orange/Grün -> klar getrennt.
  let paletteIndex = 1;

  const xValues = datasets?.[0]?.data?.map(dp => dp.x) ?? [];

  FWDlineChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: xValues,
      datasets: datasets.map((dataset, index) => {
        const isOriginalCurve = index === 0; // âœ… erste Kurve = Original/EUSW

        if (isOriginalCurve) {
          return {
            label: dataset.label,
            data: dataset.data,
            fill: false,
            borderColor: euswColor.borderColor,
            backgroundColor: euswColor.backgroundColor, // Legend-KÃ¤stchen gefÃ¼llt
            pointBackgroundColor: euswColor.borderColor,
            pointBorderColor: euswColor.borderColor,
            tension: 0.1,
            pointRadius: pointRadius,
            borderWidth: 1,
          };
        }

        // Nicht-Original: Palette-Farbe + Background fÃ¼r gefÃ¼lltes Legend-KÃ¤stchen
        const border = getColorFromPalette(paletteIndex, 1);
        const bg     = getColorFromPalette(paletteIndex, 0.6);
        paletteIndex++;

        return {
          label: dataset.label,
          data: dataset.data,
          fill: false,
          borderColor: border,
          backgroundColor: bg,             // âœ… damit Legende gefÃ¼llt ist
          pointBackgroundColor: border,    // optional: Punkte gefÃ¼llt
          pointBorderColor: border,
          tension: 0.1,
          pointRadius: pointRadius,
          borderWidth: 1,
        };
      }),
    },
    options: {
      responsive: true,

      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Year",
            color: "rgb(161, 160, 160)",
          },
          ticks: { color: "rgb(161, 160, 160)" },
          grid: {
            color: "rgba(255, 255, 255, 0.2)",
            lineWidth: 0.4,
            drawBorder: false,
            drawTicks: false,
          },
          border: { display: false }
        },

        y: {
          display: true,
          title: {
            display: true,
            text: "Rate (%)",
            color: "rgb(161, 160, 160)"
          },
          ticks: {
            color: "rgb(161, 160, 160)",
            callback: value => value.toFixed(2)
          },
          grid: {
            color: "rgba(255, 255, 255, 0.2)",
            lineWidth: 0.4,
            drawBorder: false,
            drawTicks: false,
          },
          border: { display: false },
          suggestedMin: Math.min(...datasets.flatMap(ds => ds.data.map(d => d.y))) - 0.1,
          suggestedMax: Math.max(...datasets.flatMap(ds => ds.data.map(d => d.y))) + 0.1,
        }
      },

      plugins: {
        annotation: {},
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x"
          }
        }
      }
    }
  });

  return FWDlineChartInstance;
}






export function createCSLineChart(data, chartConfig) {
  const canvas = document.getElementById('CS_ChartCanvas');
  if (!canvas) {
    console.warn('[Chart] CS_ChartCanvas not found - skip createCSLineChart');
    return;
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn('[Chart] No 2D context for CS_ChartCanvas - skip');
    return;
  }

  const lineChart = new Chart(ctx, {
    type: 'line',
    data: data,
    options: {
      ...chartConfig,
      plugins: {
        ...(chartConfig.plugins || {}),

        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            threshold: 10,
          },
          zoom: {
            drag: {
              enabled: true,
            },
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x',
          },
          limits: {
            x: { minRange: 1 },
          },
        },
      },
    },
  });

  return lineChart;
}


export function createForwardSwapChart(datasets, chartName, chartTitle, pointRadius) {
  const canvas = document.getElementById(chartName);
  if (!canvas) return null;

  // alte Instanz sauber entfernen
  if (window.forwardSwapChartInstance) {
    window.forwardSwapChartInstance.destroy();
  }

  const newCanvas = canvas.cloneNode(true);
  canvas.parentNode.replaceChild(newCanvas, canvas);
  const ctx = newCanvas.getContext("2d");

  Chart.defaults.font.color = "rgb(161, 160, 160)";

  const euswColor = getEuswCurveColor(1);
  // Start bei 1: Palette-Index 0 (Blau) kollidiert sonst mit der blauen
  // Original-Kurve (euswColor).
  let paletteIndex = 1;

  window.forwardSwapChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: datasets?.[0]?.data?.map(dp => dp.x) ?? [],
      datasets: datasets.map((dataset, index) => {
        const isOriginalCurve = index === 0; // âœ… erste Kurve = Original/EUSW

        if (isOriginalCurve) {
          return {
            label: dataset.label,
            data: dataset.data,
            fill: false,
            borderColor: euswColor.borderColor,
            backgroundColor: euswColor.backgroundColor, // âœ… Legende gefÃ¼llt
            pointBackgroundColor: euswColor.borderColor,
            pointBorderColor: euswColor.borderColor,
            tension: 0.1,
            pointRadius,
            borderWidth: 1
          };
        }

        // Nicht-Original: Palette-Farbe + Background fÃ¼r gefÃ¼lltes Legend-KÃ¤stchen
        const border = getColorFromPalette(paletteIndex, 1);
        const bg     = getColorFromPalette(paletteIndex, 0.6);
        paletteIndex++;

        return {
          label: dataset.label,
          data: dataset.data,
          fill: false,
          borderColor: border,
          backgroundColor: bg,             // âœ… damit Legende gefÃ¼llt ist
          pointBackgroundColor: border,    // optional: Punkte gefÃ¼llt
          pointBorderColor: border,
          tension: 0.1,
          pointRadius,
          borderWidth: 1
        };
      }),
    },
    options: {
      responsive: true,

      scales: {
        x: {
          display: true,
          title: { display: true, text: "Year", color: "rgb(161, 160, 160)" },
          ticks: { color: "rgb(161, 160, 160)" },
          grid: {
            color: "rgba(255, 255, 255, 0.2)",
            lineWidth: 0.4,
            drawBorder: false,
            drawTicks: false
          },
          border: { display: false }
        },

        y: {
          display: true,
          title: { display: true, text: "Rate (%)", color: "rgb(161, 160, 160)" },
          ticks: {
            color: "rgb(161, 160, 160)",
            callback: v => v.toFixed(2)
          },
          grid: {
            color: "rgba(255, 255, 255, 0.2)",
            lineWidth: 0.4,
            drawBorder: false,
            drawTicks: false
          },
          border: { display: false },
          suggestedMin: Math.min(...datasets.flatMap(ds => ds.data.map(d => d.y))) - 0.1,
          suggestedMax: Math.max(...datasets.flatMap(ds => ds.data.map(d => d.y))) + 0.1
        }
      },

      plugins: {
        zoom: {
          pan: { enabled: true, mode: "x" },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x"
          }
        }
      }
    }
  });

  return window.forwardSwapChartInstance;
}







export function createRatesLineChart(datasets, chartName, chartTitle, pointRadius) {
  const canvas = document.getElementById(chartName);
  if (!canvas || !canvas.isConnected) {
    console.warn(`[Chart] canvas missing/detached: #${chartName} - skip createRatesLineChart`);
    return null;
  }

  const existingChart = Chart.getChart(canvas);
  if (existingChart) {
    try {
      existingChart.destroy();
    } catch (err) {
      console.warn(`[Chart] destroy existing failed: #${chartName}`, err);
    }
  }

  const ctx = canvas.getContext('2d');
  if (!ctx) {
    console.warn(`[Chart] no 2D context: #${chartName} - skip createRatesLineChart`);
    return null;
  }

  Chart.defaults.font.color = "rgb(161, 160, 160)";
  const xValues = datasets?.[0]?.data?.map(dp => dp.x) ?? [];
  // Palette-Index nur fÃ¼r Nicht-Original-Serien hochzÃ¤hlen (damit nach der blauen Kurve sauber weitergezÃ¤hlt wird)
  let paletteIndex = 0;

let chart = null;

try {
  chart = new Chart(ctx, {
    type: "line",
    data: {
      labels: xValues,
      datasets: datasets.map((dataset, index) => {
        const isOriginalCurve = String(dataset?.label ?? '').toUpperCase() === 'RATES';
        const eusw = getEuswCurveColor(1);

        return {
          label: dataset.label,
          data: dataset.data,
          fill: false,
          borderColor: isOriginalCurve
            ? eusw.borderColor
            : getColorFromPalette(paletteIndex++, 1),
          backgroundColor: isOriginalCurve
            ? eusw.backgroundColor
            : undefined,
          tension: 0.1,
          pointRadius: pointRadius,
          borderWidth: 1,
          spanGaps: true,   // über fehlende Laufzeiten hinweg durchzeichnen
        };
      }),
    },
    options: {
      responsive: true,
      resizeDelay: 150,
      animation: { duration: 0 },
      normalized: true,

      plugins: {
        annotation: false,
        decimation: { enabled: true, algorithm: "min-max" },
        zoom: {
          pan: { enabled: true, mode: "x", threshold: 10 },
          zoom: {
            drag: { enabled: true },
            wheel: { enabled: true },
            pinch: { enabled: true },
            mode: "x",
          },
          limits: { x: { minRange: 1 } },
        },
      },

      scales: {
        x: {
          display: true,
          title: { display: true, text: "Year", color: "rgb(161, 160, 160)" },
          ticks: { color: "rgb(161, 160, 160)" },
          grid: {
            color: "rgba(255, 255, 255, 0.2)",
            lineWidth: 0.4,
            drawBorder: false,
            drawTicks: false,
          },
          border: { display: false }
        },

        y: {
          display: true,
          title: { display: true, text: "Rate (%)", color: "rgb(161, 160, 160)" },
          ticks: {
            color: "rgb(161, 160, 160)",
            callback: value => value.toFixed?.(2) + '%' ?? value
          },
          grid: {
            color: "rgba(255, 255, 255, 0.2)",
            lineWidth: 0.4,
            drawBorder: false,
            drawTicks: false,
          },
          border: { display: false }
        },
      },
    },
  });
} catch (err) {
  console.warn(`[Chart] createRatesLineChart failed: #${chartName}`, err);
  return null;
}

return chart;
}



export function futurePredictionsChart(datasets, chartName, chartTitle, pointRadius) {
  const canvas = document.getElementById(chartName);

  if (!canvas) {
    console.error(`Canvas with ID ${chartName} not found`);
    return;
  }

  const ctx = canvas.getContext("2d");

  // Destroy the previous chart instance if it exists
  if (futurePredictionsChartInstance) {
    futurePredictionsChartInstance.destroy();
    //console.log("Previous chart instance for future predictions destroyed");
  }

  // Extract x-values for the labels
  const xValues = datasets[0].data.map((dataPoint) => dataPoint.x);

  // Create the chart and store the instance globally
  futurePredictionsChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: xValues,  // Use x values as labels
      datasets: datasets.map((dataset, index) => ({
        label: dataset.label,
        data: dataset.data.map(point => point.y),  // Use y values as the dataset
        fill: false,
        borderColor: "rgba(75, 192, 192, 1)",  // Example color
        tension: 0.1,
        pointRadius: pointRadius,
        borderWidth: 1,
      })),
    },
    options: {
      responsive: true,
      plugins: {
        legend: {
          display: true,
          labels: {
            color: "rgb(161, 160, 160)"
          }
        }
      },
      scales: {
        x: {
          display: true,
          title: {
            display: true,
            text: "Index",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: "Predictions",
            color: "rgb(161, 160, 160)",
          },
          ticks: {
            color: "rgb(161, 160, 160)",
          },
          grid: {
            color: "rgb(90, 90, 90)",
          },
        },
      },
    },
  });
}

export function MLTestDataChart(datasets, chartName, chartTitle, pointRadius) {
  
  const canvas = document.getElementById(chartName);
  if (!canvas) {
    console.error(`Canvas with ID ${chartName} not found`);
    return;
  }

  const ctx = canvas.getContext("2d");

  // Destroy the previous chart instance if it exists
  if (window.chartInstance) {
    window.chartInstance.destroy();
    //console.log("Previous chart instance destroyed");
  }

  if (!datasets || !datasets.length || !datasets[0].data || !datasets[0].data.length) {
    console.error("Invalid dataset provided for chart:", datasets);
    return;
  }

  // Convert x-values (dates) to timestamps for the chart
  const xValues = datasets[0].data.map(dataPoint => new Date(dataPoint.x).getTime()); // Convert dates to timestamps

  const colors = {
    train: "rgba(0, 123, 255, 1)",  // Blue for Train Data
    test: "rgba(75, 192, 192, 1)",  // Cyan for Test Data
    predictions: "rgba(255, 99, 132, 1)",  // Red for Predictions
    future: "rgba(255, 206, 86, 1)",  // Yellow for Future Predictions
  };

  const lineStyles = {
    solid: [],  // Solid line
    dashed: [5, 5],  // Dashed line for future predictions
  };

  const allDatasets = datasets.map((dataset) => {
    let color, borderDash;
    if (dataset.label === 'Train Data') {
      color = colors.train;
      borderDash = lineStyles.solid;
    } else if (dataset.label === 'Test Data') {
      color = colors.test;
      borderDash = lineStyles.solid;
    } else if (dataset.label === 'Predictions') {
      color = colors.predictions;
      borderDash = lineStyles.solid;
    } else if (dataset.label === 'Future Predictions') {
      color = colors.future;
      borderDash = lineStyles.dashed;
    }

    return {
      label: dataset.label,
      data: dataset.data.map(point => ({ x: new Date(point.x).getTime(), y: point.y })),  // Use timestamps for x values
      fill: false,
      borderColor: color,
      borderDash: borderDash,
      tension: 0.1,
      pointRadius: pointRadius,
      borderWidth: 1,
    };
  });

  window.chartInstance = new Chart(ctx, {
    type: 'line',
    data: {
      labels: xValues,  // Use timestamps for labels
      datasets: allDatasets
    },
    options: {
      responsive: true,
      plugins: {
        zoom: {
          pan: {
            enabled: true,
            mode: 'x',
            threshold: 10,
          },
          zoom: {
            drag:{
              enabled: true
            },
            wheel: {
              enabled: true,
            },
            pinch: {
              enabled: true,
            },
            mode: 'x',
          },
          limits: {
            x: { minRange: 1 },
          },
        },
      },
      scales: {
        x: {
          type: 'linear',  // Linear scale instead of 'time'
          position: 'bottom',
          title: {
            display: true,
            text: 'Date',
            color: 'rgb(161, 160, 160)',
          },
          ticks: {
            color: 'rgb(161, 160, 160)',
            callback: function(value, index, ticks) {
              // Format the timestamp back into a readable date for the x-axis ticks
              const date = new Date(value);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }
          },
          grid: {
            color: 'rgb(90, 90, 90)',
          },
        },
        y: {
          display: true,
          title: {
            display: true,
            text: 'Values',
            color: 'rgb(161, 160, 160)',
          },
          ticks: {
            color: 'rgb(161, 160, 160)',
          },
          grid: {
            color: 'rgb(90, 90, 90)',
          },
        },
      },
    },
  });

  return window.chartInstance;
}

