'use strict';

// Risk-Factor-Viewer für das MVaR-Input-Panel.
// Zeigt die historischen Risikofaktor-Zeitreihen (tblTS = appState.getTblTSData())
// als Checklist + Multi-Line-Chart — analog zum HISTORIC-DATA-Viewer (TS.js),
// aber self-contained (kein Eingriff in TS.js). Variante A: ALLE tblTS-Faktoren.

import { appState } from '../../../../renderer.js';

const HOST_ID = 'mvarFactorChartHost';
const CANVAS_ID = 'mvarFactorTsChart';

let __chart = null;
let __selected = null;        // Set<string> der ausgewählten Faktor-Keys (null = noch nicht init.)
let __refreshBound = false;
let __rangeYears = 5;          // Zeitintervall-Default: 5Y (null = Max; sonst Jahre 1/5/10)
let __ctx = null;              // { rows, dateKey, factors } für externe Re-Draws
let __scenarioBound = false;   // Listener auf Szenario-Checkboxen nur einmal binden

// Start-Index für das gewählte Zeitintervall (letzte N Jahre ab dem jüngsten Datum).
function rangeStartIndex(rows, dateKey) {
  if (!__rangeYears) return 0; // Max
  const ts = rows.map((r) => Date.parse(toIsoDate(r[dateKey])));
  let last = NaN;
  for (let k = ts.length - 1; k >= 0; k--) { if (Number.isFinite(ts[k])) { last = ts[k]; break; } }
  if (!Number.isFinite(last)) return 0;
  const cutoff = last - __rangeYears * 365.25 * 24 * 3600 * 1000;
  let i = 0;
  while (i < ts.length && (!Number.isFinite(ts[i]) || ts[i] < cutoff)) i++;
  return Math.min(i, Math.max(0, rows.length - 1));
}

function markActiveRange(host) {
  host.querySelectorAll('.mvar-factor-range').forEach((b) => {
    const y = Number(b.dataset.years);
    const active = (__rangeYears == null && y === 0) || (__rangeYears === y);
    b.classList.toggle('is-active', active);
  });
}

function redraw() {
  if (__ctx) drawChart(__ctx.rows, __ctx.dateKey, __ctx.factors);
}

// START/END der im Model-Selection-Table (inputMvarContainer) angehakten Szenarien.
function getSelectedScenarioRanges() {
  const container = document.getElementById('inputMvarContainer');
  if (!container) return [];
  const checked = container.querySelectorAll('input.scenario-checkbox:checked');
  if (!checked.length) return [];
  const rows = appState.getMvarModelSelectionAppRows?.() || [];
  const byId = new Map(rows.map((r) => [String(r.id ?? ''), r]));
  const byName = new Map(rows.map((r) => [String(r.INTERVAL_NAME ?? ''), r]));
  const out = [];
  checked.forEach((cb) => {
    const row = byId.get(String(cb.dataset.id ?? '')) || byName.get(String(cb.dataset.interval ?? ''));
    if (row && row.START && row.END) {
      out.push({ start: row.START, end: row.END, label: String(row.INTERVAL_NAME ?? '') });
    }
  });
  return out;
}

// Datums-Range -> Index-Range innerhalb der (aufsteigend sortierten ISO-)Labels.
function rangeToIndices(labels, startIso, endIso) {
  if (!labels.length || !startIso || !endIso) return null;
  const startIdx = labels.findIndex((d) => d >= startIso);
  if (startIdx < 0) return null;
  let endIdx = -1;
  for (let i = labels.length - 1; i >= 0; i--) { if (labels[i] <= endIso) { endIdx = i; break; } }
  if (endIdx < 0 || endIdx < startIdx) return null;
  return { startIdx, endIdx };
}

const PALETTE = [
  '#2f6fb0', '#e67e00', '#2e9e5b', '#e0b400', '#9c4dcc',
  '#d24a4a', '#1b9e9e', '#7a7a7a', '#c2185b', '#5d8a00',
];
const color = (i) => PALETTE[i % PALETTE.length];

function getRows() {
  const r = appState.getTblTSData?.();
  return Array.isArray(r) ? r : [];
}

// Datumsspalte erkennen (heißt z.B. DATE/Datum), sonst die erste Spalte.
function detectDateKey(row) {
  const keys = Object.keys(row || {});
  return keys.find((k) => /date|datum/i.test(k)) || keys[0];
}

function toIsoDate(v) {
  if (v == null || v === '') return null;
  const s = String(v).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d = new Date(s.replace(' ', 'T'));
  if (!Number.isNaN(d.getTime())) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const da = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${da}`;
  }
  return s;
}

function num(v) {
  if (v == null || v === '') return null;
  const n = Number(String(v).replace(',', '.'));
  return Number.isFinite(n) ? n : null;
}

// Führende Platzhalter (konstanter Wert vor dem echten Datenbeginn, z.B. tblTS
// ist ab 1980 da, der Faktor aber erst ab ~2003) als "keine Daten" behandeln:
// den führenden Konstant-Lauf auf null setzen → der Chart zeichnet dort keine
// (flache) Linie. Erst ab der ersten echten Wertänderung wird gezeichnet.
function trimLeadingFlat(arr) {
  let i = 0;
  while (i < arr.length && arr[i] == null) i++;     // führende Nulls überspringen
  if (i >= arr.length) return arr;
  const first = arr[i];
  let run = i;
  while (run < arr.length && arr[run] === first) run++;   // führender Konstant-Lauf
  // Nur als Platzhalter behandeln, wenn der Lauf lang ist UND nicht die ganze
  // Reihe (eine durchgehend konstante Reihe nicht versehentlich leeren).
  if ((run - i) > 10 && run < arr.length) {
    for (let k = 0; k < run; k++) arr[k] = null;
  }
  return arr;
}

export function renderMvarFactorChart() {
  const host = document.getElementById(HOST_ID);
  if (!host) return;

  // Einmalig: auf nachladende tblTS-Daten reagieren (re-render), da tblTS evtl.
  // erst nach dem ersten Panel-Render verfügbar ist.
  if (!__refreshBound) {
    __refreshBound = true;
    document.addEventListener('risk:refresh-thumbnails', () => {
      if (document.getElementById(HOST_ID)) renderMvarFactorChart();
    });
  }

  const rows = getRows();
  if (!rows.length) {
    if (__chart) { try { __chart.destroy(); } catch {} __chart = null; }
    host.innerHTML =
      '<section class="mvar-factor-panel">'
      + '<div class="mvar-factor-title">Risk Factors</div>'
      + '<div class="mvar-factor-empty">Keine Faktor-Zeitreihen geladen (tblTS). '
      + 'Öffne MARKET DATA ▸ Historic Data oder berechne MVaR.</div></section>';
    return;
  }

  const dateKey = detectDateKey(rows[0]);
  const factors = Object.keys(rows[0]).filter((k) => k !== dateKey);

  // Default-Auswahl beim ersten Mal: erste 4 Faktoren.
  if (!__selected) {
    // Default-Auswahl: EU_1Y, EU_5Y, US_A, US_BBB (sofern vorhanden), sonst erste 4.
    const preferred = ['EU_1Y', 'EU_5Y', 'US_A', 'US_BBB'].filter((f) => factors.includes(f));
    __selected = new Set(preferred.length ? preferred : factors.slice(0, 4));
  }
  // Auswahl gegen aktuelle Faktorliste putzen (falls sich tblTS geändert hat).
  __selected = new Set([...__selected].filter((f) => factors.includes(f)));

  __ctx = { rows, dateKey, factors };

  // Re-Draw, wenn sich die Szenario-Auswahl (Select-Checkbox) im Model-Selection-
  // Table ändert → die START/END-Box aktualisieren. Delegiert auf inputMvarContainer
  // (Element bleibt stabil, nur innerHTML wechselt), daher nur einmal binden.
  if (!__scenarioBound) {
    __scenarioBound = true;
    const selHost = document.getElementById('inputMvarContainer');
    if (selHost) {
      selHost.addEventListener('change', (e) => {
        if (e.target?.classList?.contains('scenario-checkbox')) redraw();
      });
    }
  }

  host.innerHTML = `
    <section class="mvar-factor-panel">
      <div class="mvar-factor-head">
        <div class="mvar-factor-title">Risk Factors</div>
        <div class="mvar-factor-toolbar">
          <button type="button" class="mvar-factor-range" data-years="1">1Y</button>
          <button type="button" class="mvar-factor-range" data-years="5">5Y</button>
          <button type="button" class="mvar-factor-range" data-years="10">10Y</button>
          <button type="button" class="mvar-factor-range" data-years="0">Max</button>
          <button type="button" class="mvar-factor-resetzoom" title="Zoom zurücksetzen">Reset Zoom</button>
        </div>
      </div>
      <div class="mvar-factor-cols">
        <div class="mvar-factor-list" id="mvarFactorList"></div>
        <div class="mvar-factor-chart-wrap"><canvas id="${CANVAS_ID}"></canvas></div>
      </div>
    </section>`;

  // Zeitintervall-Buttons (1Y/5Y/10Y/Max) + Reset-Zoom.
  host.querySelectorAll('.mvar-factor-range').forEach((btn) => {
    btn.addEventListener('click', () => {
      const y = Number(btn.dataset.years);
      __rangeYears = y > 0 ? y : null;
      markActiveRange(host);
      drawChart(rows, dateKey, factors);
    });
  });
  host.querySelector('.mvar-factor-resetzoom')?.addEventListener('click', () => {
    try { __chart?.resetZoom?.(); } catch {}
  });
  markActiveRange(host);

  const list = host.querySelector('#mvarFactorList');
  factors.forEach((f) => {
    const label = document.createElement('label');
    label.className = 'mvar-factor-item';
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = __selected.has(f);
    cb.addEventListener('change', () => {
      if (cb.checked) __selected.add(f); else __selected.delete(f);
      drawChart(rows, dateKey, factors);
    });
    label.appendChild(cb);
    label.appendChild(document.createTextNode(' ' + f));
    list.appendChild(label);
  });

  drawChart(rows, dateKey, factors);
}

function drawChart(rows, dateKey, factors) {
  const canvas = document.getElementById(CANVAS_ID);
  if (!canvas || !window.Chart) return;

  // Zeitintervall (1Y/5Y/10Y/Max) auf die Reihe anwenden.
  const start = rangeStartIndex(rows, dateKey);
  const labels = rows.slice(start).map((r) => toIsoDate(r[dateKey]));
  const selected = factors.filter((f) => __selected.has(f));

  const datasets = selected.map((f, i) => ({
    label: f,
    // führende Platzhalter auf der vollen Reihe nullen, DANN aufs Intervall slicen
    data: trimLeadingFlat(rows.map((r) => num(r[f]))).slice(start),
    borderColor: color(i),
    backgroundColor: color(i),
    borderWidth: 1.4,
    pointRadius: 0,
    spanGaps: false,   // Lücke statt Linie, wo keine Daten sind
    fill: false,
  }));

  // Box-Annotation(en) für die im Model-Selection-Table angehakten Szenarien
  // (START..END) — dezent getöntes Rechteck (leicht andere Farbe als weiß).
  const annotations = {};
  getSelectedScenarioRanges().forEach((rg, k) => {
    const idx = rangeToIndices(labels, toIsoDate(rg.start), toIsoDate(rg.end));
    if (!idx) return;
    annotations[`scenario_${k}`] = {
      type: 'box',
      // Kategorie-Achse: Label-Strings (Datumswerte) statt Indizes.
      xMin: labels[idx.startIdx],
      xMax: labels[idx.endIdx],
      backgroundColor: 'rgba(255, 221, 120, 0.20)',
      borderColor: 'rgba(230, 180, 0, 0.45)',
      borderWidth: 1,
      drawTime: 'beforeDatasetsDraw',
    };
  });

  if (__chart) { try { __chart.destroy(); } catch {} __chart = null; }

  __chart = new window.Chart(canvas.getContext('2d'), {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: false,
      interaction: { mode: 'nearest', axis: 'x', intersect: false },
      plugins: {
        legend: { position: 'top', labels: { boxWidth: 18, font: { size: 11 } } },
        // Rechteck(e) für die angehakten Szenario-Zeiträume (START..END).
        annotation: { annotations },
        // Zoom/Pan wie in den anderen Charts (chartjs-plugin-zoom, global geladen).
        zoom: {
          // Pan auf Ctrl+Drag, damit normales Ziehen das Zoom-Rechteck ist.
          pan: { enabled: true, mode: 'x', modifierKey: 'ctrl' },
          zoom: {
            wheel: { enabled: true },
            pinch: { enabled: true },
            // Drag-to-zoom (Rechteck-Auswahl).
            drag: {
              enabled: true,
              backgroundColor: 'rgba(75, 150, 225, 0.15)',
              borderColor: 'rgba(75, 150, 225, 0.6)',
              borderWidth: 1,
            },
            mode: 'x',
          },
        },
      },
      scales: {
        x: { ticks: { maxTicksLimit: 12, font: { size: 10 } }, grid: { display: false } },
        y: { ticks: { font: { size: 10 } } },
      },
    },
  });
}
