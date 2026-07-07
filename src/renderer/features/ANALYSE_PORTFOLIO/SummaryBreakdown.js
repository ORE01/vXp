import { getColorForPieChart} from '../../utils/colors.js';
import { setupHiDPICanvas } from './SummaryYield.js';
import { getFormatRules } from '../../utils/tableCellFormats.js';
import { attachIdLinks } from '../../utils/linksToTables.js';

const { jsPDF } = window.jspdf;

let tableName = 'Portfolio';

function focusBreakdownGroup(group) {
  const sections = document.querySelectorAll('#pieChartGrid .pie-section');

  sections.forEach(sec => {
    const g = sec.dataset.breakdownGroup;

    // Hauptpunkt â†’ ALLES verstecken
    if (group === '__NONE__') {
      sec.style.display = 'none';
      return;
    }

    // "__ALL__" (oder kein Group) -> ALLE Sektionen anzeigen
    if (group === '__ALL__' || !group) {
      sec.style.display = '';
      return;
    }

    // Unterpunkte â†’ nur passende Section zeigen
    if (group && g === group) {
      sec.style.display = '';
    } else {
      sec.style.display = 'none';
    }
  });

  // Scroll nur bei echten Gruppen
  if (group && group !== '__NONE__' && group !== '__ALL__') {
    const target = document.querySelector(
      `#pieChartGrid .pie-section[data-breakdown-group="${group}"]`
    );
    if (target) {
      target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }
}

window.focusBreakdownGroup = focusBreakdownGroup;


const BREAKDOWN_CONFIG = [
  {
    key: 'Issuer',
    title: 'Issuer',
    overview: 'Issuer, Issuer Rating, Capital Structure',
    columns: [
      { key: 'ISSUER', label: 'Issuer' },
      { key: 'RATING', label: 'Issuer General Rating' },
      { key: 'RANK',   label: 'Issuer Capital Structure' },
    ],
  },
  {
    key: 'Product',
    title: 'Product',
    overview: 'Product Rating, Category, Coupon Type',
    columns: [
      { key: 'RATINGres',  label: 'Product Ratings' },
      { key: 'CATEGORY',   label: 'Product Categories' },
      { key: 'CouponType', label: 'Product Coupon Type' },
    ],
  },
  {
    key: 'General',
    title: 'General',
    overview: 'Depot Bank',
    columns: [
      { key: 'Depotbank', label: 'Depot Bank' },
    ],
  },

  // âœ… NEU
{
  key: 'Geography',
  title: 'Geography',
  overview: 'Region, Country, EU/EEA/OECD/Euro',
  columns: [
    { key: 'IssuerRegion',  label: 'Region' },         // falls du das so im View hast
    { key: 'IssuerCountryName', label: 'Country' },    // oder 'Country' - je nachdem was du wirklich im Data-Objekt hast

    // âœ… diese fehlen dir aktuell:
    { key: 'IssuerIsEU',   label: 'EU' },
    // EEA + OECD ausgeblendet (nicht geloescht — bei Bedarf wieder einkommentieren):
    // { key: 'IssuerIsEEA',  label: 'EEA' },
    // { key: 'IssuerIsOECD', label: 'OECD' },
    { key: 'IssuerIsEuro', label: 'Euro' },
  ],
},


];



// Letzte Args + Theme-Listener: bei Theme-Wechsel mit denselben Daten neu rendern
// (Pie-Farben sind theme-aware aus colors.js).
let _lastBreakdownArgs = null;
let _breakdownThemeBound = false;
let _concHookBound = false;
let _concDimension = 'ISSUER';   // aktuell im Konzentrations-Dashboard gezeigte Spalte
let _concMenuHideT = 0;          // Timeout-Handle fuer das Hover-Menue
let _concStack = [];             // Drill-Pfad als Stack von Views { path:[{colKey,value,label}], by }
let _concMenuCtx = null;         // prospektiver Pfad, auf den sich das offene Menue bezieht

export function handleSummaryNotionalData(filteredData, index, port_name) {
  _lastBreakdownArgs = { filteredData, index, port_name };
  if (!_breakdownThemeBound) {
    _breakdownThemeBound = true;
    document.addEventListener('theme:changed', () => {
      if (_lastBreakdownArgs) {
        handleSummaryNotionalData(
          _lastBreakdownArgs.filteredData,
          _lastBreakdownArgs.index,
          _lastBreakdownArgs.port_name
        );
      }
    });
  }

  const elementId      = `portDataContainer${0}`;
  const aggContainerId = `portAggDataContainer${5}`;
  const pieChartGridId = 'pieChartGrid';

  // ==== Ãœbersicht oberhalb der Charts: nur Breakdown-Struktur ====
  const summaryContainer = document.getElementById(aggContainerId);
if (summaryContainer) {
  summaryContainer.innerHTML = `
    <div class="breakdown-overview">
      <p class="ov-title">Breakdown Structure</p>
      <ul class="ov-list">
        ${BREAKDOWN_CONFIG.map(g =>
          `<li><strong>${g.title}</strong> : ${g.overview}</li>`
        ).join('')}
      </ul>
    </div>
  `;
}


  // ==== Zentraler Grid-Container fÃ¼r alle Pie-Charts ====
  const chartGrid = document.getElementById(pieChartGridId);
  if (!chartGrid) return;
  chartGrid.innerHTML = '';

  const columnsToChart = BREAKDOWN_CONFIG.flatMap(g => g.columns.map(c => c.key));

const columnDisplayNames = Object.fromEntries(
  BREAKDOWN_CONFIG.flatMap(g => g.columns.map(c => [c.key, c.label]))
);


  // Helper: Section erzeugen (Titel + inneres Grid)
  const ensureSection = (title, sectionId, groupKey) => {
    const section = document.createElement('section');
    section.className = 'pie-section';
    section.id = sectionId;
    if (groupKey) {
      section.dataset.breakdownGroup = groupKey;
    }

    const h = document.createElement('h2');
    h.className = 'pie-section-title';
    h.textContent = title;

    const inner = document.createElement('div');
    inner.className = 'pie-section-grid';

    section.appendChild(h);
    section.appendChild(inner);
    chartGrid.appendChild(section);
    return inner;
  };

  // Sektionen bauen
const sectionGrids = new Map(); // groupKey -> innerGrid

BREAKDOWN_CONFIG.forEach(g => {
  const inner = ensureSection(g.title, `pie-section-${g.key.toLowerCase()}`, g.key);
  sectionGrids.set(g.key, inner);
});


  // Mapping: Spalte -> Ziel-Container (inneres Grid)
const targetMap = new Map();
BREAKDOWN_CONFIG.forEach(g => {
  const inner = sectionGrids.get(g.key);
  g.columns.forEach(col => targetMap.set(col.key, inner));
});


  // ==== Charts + Legenden rendern (als getrennte Grid-Items) ====
  columnsToChart.forEach((column) => {
    const canvasId  = `${column.toLowerCase()}PieChart`;
    const legendId  = `${canvasId}-legend`;
    const container = targetMap.get(column) || chartGrid;

    // --- Chart-Block ---
    const chartBlock = document.createElement('div');
    chartBlock.className = 'chart-block';

    const chartHeading = document.createElement('h3');
    chartHeading.textContent = columnDisplayNames[column] || column;
    chartHeading.className = 'chart-block-title';

    const canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.className = 'pieChart';
    canvas.width = 240;
    canvas.height = 150;

    chartBlock.appendChild(chartHeading);
    chartBlock.appendChild(canvas);

    // --- Legenden-Block ---
    const legendBlock = document.createElement('div');
    legendBlock.className = 'chart-block legend-block';

    const legendHeading = document.createElement('h3');
    legendHeading.textContent = `${columnDisplayNames[column] || column}`;
    legendHeading.className = 'chart-block-title';

    const legendTable = document.createElement('table');
    legendTable.id = legendId;
    legendTable.className = 'chart-legend-table';
    legendTable.dataset.label = `${columnDisplayNames[column] || column}`;

    legendBlock.appendChild(legendHeading);
    legendBlock.appendChild(legendTable);

// âœ… Row-Wrapper: Chart + Tabelle gehÃ¶ren zusammen in eine Zeile
const row = document.createElement('div');
row.className = 'pie-pair-row';

row.appendChild(chartBlock);
row.appendChild(legendBlock);

container.appendChild(row);


    // Chart zeichnen (fÃ¼llt auch die Legend-Tabelle)
    drawPieChartByColumn(filteredData, column);
  });

  // Nach dem ersten Render: Risk-Preview/Thumbs aktualisieren
  try {
    notifyRiskPreview('breakdown:init');
  } catch {}

  // Emittenten-Konzentrations-Dashboard (eigenes Panel #panel-concentration).
  // Cards/KPIs werden immer aktualisiert; die Charts erst, wenn das Panel sichtbar
  // ist -> dafuer der Panel-Open-Hook (einmalig registriert).
  try { renderConcentrationDashboard(filteredData, { dataField: _concDimension }); } catch (e) { console.warn('[conc] render failed', e); }
  // Versteckte Report-Panels je Dimension (fuer das PDF) anlegen + mit dem aktuellen
  // Portfolio fuellen — ALLE Dimensionen, unabhaengig von der live gewaehlten.
  try { ensureConcReportPanels(); fillConcReportPanels(filteredData); } catch (e) { console.warn('[conc] report panels failed', e); }
  if (!_concHookBound) {
    _concHookBound = true;
    try {
      window.registerPanelOpenHook?.('panel-concentration', () => {
        // RAF: erst nach dem Sichtbarwerden zeichnen, damit Chart.js das Canvas misst.
        requestAnimationFrame(() => {
          try { renderConcentrationDashboard(_lastBreakdownArgs?.filteredData, { dataField: _concDimension }); } catch {}
        });
      });
    } catch {}
    // Sub-Trigger-Klick -> gewuenschte Dimension merken (capture: laeuft VOR dem
    // Panel-Open-Hook, damit dieser die richtige Dimension zeichnet).
    document.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('button.section-trigger[data-panel="panel-concentration"]');
      if (btn && btn.dataset.dimension) _concDimension = btn.dataset.dimension;
    }, true);
  }

  // ==== Value-Selector (NAV / Notional) ====
  // Bei JEDEM Render neu binden, damit der Handler das filteredData GENAU dieses
  // Renders nutzt (das auch gerade angezeigt wird). Vorher 1x gebunden → er fror
  // über die Daten des ersten Renders ein (Default-Portfolio).
  const valueSel = document.getElementById('valueSelector');
  if (valueSel) {
    if (valueSel.__breakdownHandler) {
      valueSel.removeEventListener('change', valueSel.__breakdownHandler);
    }
    const handler = () => {
      columnsToChart.forEach(column => drawPieChartByColumn(filteredData, column));
      try { renderConcentrationDashboard(filteredData, { dataField: 'ISSUER' }); } catch {}
      try { fillConcReportPanels(filteredData); } catch {}
      try { notifyRiskPreview('breakdown:valueSelector'); } catch {}
    };
    valueSel.addEventListener('change', handler);
    valueSel.__breakdownHandler = handler;
  }
}


// Datenfeld pro Breakdown-Spalte (entkoppelt von Canvas-ID/Label).
// "Product Ratings" soll das EIGENE Produkt-Rating (RATING_PROD) zeigen, NICHT
// das aufgelöste RATINGres (das bei fehlendem Produkt-Rating aufs Issuer-Rating
// zurückfällt → sonst tauchen alle Produkte auf).
const COLUMN_DATA_FIELD = { RATINGres: 'RATING_PROD' };
// Spalten, bei denen Zeilen OHNE Wert ausgeschlossen werden (statt "Unknown").
const COLUMN_EXCLUDE_EMPTY = new Set(['RATINGres']); // nur Produkte mit eigenem Rating

function drawPieChartByColumn(filteredData, columnName) {
  const valueTypeElem = document.getElementById('valueSelector');
  const valueType = valueTypeElem ? valueTypeElem.value : 'NAV';

  const dataField = COLUMN_DATA_FIELD[columnName] || columnName;
  const excludeEmpty = COLUMN_EXCLUDE_EMPTY.has(columnName);
  const { labels: rawLabels, values } = getValuesByColumn(filteredData, dataField, valueType, excludeEmpty);
  const canvasId = `${columnName.toLowerCase()}PieChart`;
  const legendId = `${canvasId}-legend`;

  // Canvas erneuern (wie bisher), damit kein alter Chart hÃ¤ngen bleibt
  const oldCanvas = document.getElementById(canvasId);
  if (!oldCanvas) {
    console.warn(`Canvas with ID ${canvasId} not found.`);
    return;
  }

  const canvasParent = oldCanvas.parentNode;
  oldCanvas.remove();

  const newCanvas = document.createElement('canvas');
  newCanvas.id = canvasId;
  newCanvas.className = 'pieChart';
  canvasParent.appendChild(newCanvas);

  const ctx = setupHiDPICanvas(newCanvas, 240, 150, true); // true = an tatsächliche Anzeigegröße anpassen (verhindert Überlappung/Unschärfe)

  const colors = rawLabels.map((_, index) => getColorForPieChart(index));
  const total = values.reduce((a, b) => a + b, 0) || 1; // Division durch 0 vermeiden
  const labels = rawLabels;

  // Chart-Legende komplett ausschalten: wir bauen sie selbst
  new Chart(ctx, {
    type: 'pie',
    data: {
      labels,
      datasets: [{
        label: `${valueType} by ${columnName}`,
        data: values,
        backgroundColor: colors.map(c => c.backgroundColor),
        borderColor: colors.map(c => c.borderColor),
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      maintainAspectRatio: false,
      devicePixelRatio: 1,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          bodyFont: { size: 10 },
          callbacks: {
            label: function (context) {
              const value = context.parsed;
              const percentage = ((value / total) * 100).toFixed(2);
              const fmtRules = getFormatRules();
              const fmt = fmtRules?.[valueType] || (v => v.toLocaleString('de-DE'));
              return `${labels[context.dataIndex]}: ${fmt(value)} â‚¬ (${percentage}%)`;
            }
          }
        }
      }
    }
  });

  // === Eigene Legende als Tabelle (rechts) bauen ===
  const legendTable = document.getElementById(legendId);
  if (!legendTable) {
    console.warn(`Legend table with ID ${legendId} not found.`);
    return;
  }

  // Tabelle leeren
  legendTable.innerHTML = '';

  const fmtRules = getFormatRules();
  const fmt = fmtRules?.[valueType] || (v => v.toLocaleString('de-DE'));

  // Optional: Headerzeile
  const headerRow = document.createElement('tr');
  ['', 'Category', valueType, '%'].forEach(text => {
    const th = document.createElement('th');
    th.textContent = text;
    headerRow.appendChild(th);
  });
  legendTable.appendChild(headerRow);

  // Zeilen hinzufÃ¼gen (ggf. auf Top 15 beschrÃ¤nken)
  labels.forEach((label, i) => {
    const value = values[i];
    const percentage = ((value / total) * 100).toFixed(1);
    const color = colors[i];

    const tr = document.createElement('tr');

    // Farbfeld
    const colorTd = document.createElement('td');
    const colorBox = document.createElement('span');
    colorBox.style.display = 'inline-block';
    colorBox.style.width = '10px';
    colorBox.style.height = '10px';
    colorBox.style.borderRadius = '2px';
    colorBox.style.marginRight = '4px';
    colorBox.style.backgroundColor = color.backgroundColor;
    colorBox.style.border = `1px solid ${color.borderColor}`;
    colorTd.appendChild(colorBox);
    tr.appendChild(colorTd);

    // Label
    const labelTd = document.createElement('td');
    labelTd.textContent = label;
    tr.appendChild(labelTd);

    // Wert
    const valueTd = document.createElement('td');
    valueTd.textContent = fmt(value);
    tr.appendChild(valueTd);

    // Prozent
    const pctTd = document.createElement('td');
    pctTd.textContent = `${percentage}%`;
    tr.appendChild(pctTd);

    legendTable.appendChild(tr);
  });
}

function getValuesByColumn(data, columnName, valueType = 'NAV', excludeEmpty = false) {
  // Hard fail if the column does not exist (prevents silently creating "Unknown" due to typos).
  // Ausnahme: bei excludeEmpty sind fehlende/leere Werte gewollt (→ überspringen).
  const hasColumn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  const map = {};

  data.forEach(entry => {
    if (!hasColumn(entry, columnName)) {
      if (excludeEmpty) return; // Feld fehlt → ausschließen statt Hard-Fail
      throw new Error(
        `[getValuesByColumn] Column "${columnName}" not found on entry. ` +
        `Check columnName spelling / mapping. Sample keys: ${Object.keys(entry).slice(0, 20).join(', ')}`
      );
    }

    const raw = entry[columnName];
    const isEmpty = raw === undefined || raw === null || String(raw).trim() === '';

    if (excludeEmpty && isEmpty) return; // z. B. Produkte ohne eigenes Rating ausblenden

    // Normalize "empty" values to Unknown (ONLY for real categorical columns)
    const key = isEmpty ? 'Unknown' : String(raw).trim();

    const value = Number(entry[valueType]) || 0;
    map[key] = (map[key] || 0) + value;
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);

  return {
    labels: sorted.map(([k]) => k),
    values: sorted.map(([, v]) => v),
  };
}


// ===== Emittenten-Konzentrations-Dashboard ====================================
// Generisch ueber eine Dimension (opts.dataField, Default 'ISSUER'). Nutzt dieselbe
// Aggregation wie die Pies (getValuesByColumn) und folgt dem NAV/Notional-Selector.
// Cards/KPIs werden immer aktualisiert; die Charts nur, wenn das Panel sichtbar ist
// (ein Canvas in einem display:none-Panel hat Groesse 0).
let __concCharts = { top10: null, donut: null };

function __concMedian(arr) {
  if (!arr.length) return 0;
  const s = [...arr].sort((a, b) => a - b);
  const m = Math.floor(s.length / 2);
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}
function __concEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
const __concPct = (x) => `${(x * 100).toFixed(x < 0.1 ? 2 : 1)}%`;

// Dimensions-Dropdown im Concentration-Panel einmalig fuellen (alle Breakdown-Spalten)
// + Change-Handler binden; Wert mit der aktuellen Dimension synchronisieren.
function ensureConcDimensionUI() {
  const sel = document.getElementById('concDimensionSelect');
  if (!sel) return;
  if (!sel.dataset.filled) {
    sel.innerHTML = BREAKDOWN_CONFIG
      .flatMap(g => g.columns)
      .map(c => `<option value="${c.key}">${c.label}</option>`)
      .join('');
    sel.dataset.filled = '1';
    sel.addEventListener('change', () => {
      _concDimension = sel.value;
      try { renderConcentrationDashboard(_lastBreakdownArgs?.filteredData, { dataField: _concDimension }); } catch {}
    });
  }
  if (sel.value !== _concDimension) sel.value = _concDimension;
}

// Reine Konzentrations-Kennzahlen fuer EINE Dimension. Eine Quelle der Wahrheit
// fuer das Live-Dashboard UND die versteckten Report-Panels je Dimension.
function computeConcentration(filteredData, dimKey, valueType) {
  if (!Array.isArray(filteredData) || !filteredData.length) return null;
  const key = dimKey || 'ISSUER';
  const field = COLUMN_DATA_FIELD[key] || key;
  const excludeEmpty = COLUMN_EXCLUDE_EMPTY.has(key);
  const dimLabel = (BREAKDOWN_CONFIG.flatMap(g => g.columns).find(c => c.key === key)?.label) || key;

  let agg;
  try { agg = getValuesByColumn(filteredData, field, valueType, excludeEmpty); }
  catch (e) { console.warn('[conc] getValuesByColumn failed', key, e); return null; }

  const items = agg.labels
    .map((name, i) => ({ name, value: Number(agg.values[i]) || 0 }))
    .filter(it => it.value > 0);
  if (!items.length) return null;

  const total = items.reduce((s, it) => s + it.value, 0) || 1;
  items.forEach(it => { it.share = it.value / total; });   // bereits absteigend sortiert
  const count = items.length;
  const top = items.slice(0, 10);
  const top10Share = top.reduce((s, it) => s + it.share, 0);
  const restShare = Math.max(0, 1 - top10Share);
  const meanShare = count ? 1 / count : 0;
  const medianShare = __concMedian(items.map(it => it.share));

  return { key, dimLabel, valueType, items, total, count, top, top10Share, restShare, meanShare, medianShare };
}

// Report-Quellen (Key Figures + Top) als .data-container-Tabellen fuellen.
// Die Risk-Report-Vorschau/das PDF erfasst .data-container-Tabellen nativ (die
// visuellen Kacheln/Karten dagegen nicht). Genutzt vom Live-Panel UND den
// versteckten Report-Panels je Dimension.
function renderConcReportTables(kfEl, tiEl, m) {
  if (!m) { if (kfEl) kfEl.innerHTML = ''; if (tiEl) tiEl.innerHTML = ''; return; }
  if (kfEl) {
    const rows = [
      ['Number of entries', String(m.count)],
      ['Top 10 share', __concPct(m.top10Share)],
      ['Others share', __concPct(m.restShare)],
      ['Avg share', __concPct(m.meanShare)],
      ['Median share', __concPct(m.medianShare)],
    ];
    kfEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      rows.map(([k, v]) => `<tr><td>${__concEsc(k)}</td><td>${__concEsc(v)}</td></tr>`).join('')
    }</tbody></table>`;
  }
  if (tiEl) {
    tiEl.dataset.label = `Top ${m.dimLabel}`;
    tiEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>${__concEsc(m.dimLabel)}</th><th>Share (${__concEsc(m.valueType)})</th></tr></thead><tbody>${
      m.items.slice(0, 10).map(it => `<tr><td>${__concEsc(it.name)}</td><td>${__concPct(it.share)}</td></tr>`).join('')
    }</tbody></table>`;
  }
}

// Alle Dimensionen (wie das Panel-Dropdown), config-getrieben.
function __concAllDims() {
  return BREAKDOWN_CONFIG.flatMap(g => g.columns);   // {key,label}[]
}

// Versteckte Report-Panels je Dimension: erlauben, im PDF ALLE Konzentrations-
// Dashboards einzeln zu waehlen — unabhaengig von der live gewaehlten Dimension.
// Die Preview erfasst .sub-panel > .data-container[id] generisch; die Panels liegen
// in #ANALYSE_Modal (→ Report-Baum unter dem PORTFOLIO/ANALYSE-Tab). Idempotent.
function ensureConcReportPanels() {
  const modal = document.getElementById('ANALYSE_Modal');
  if (!modal) return;
  const host = modal.querySelector('.table-content') || modal;
  __concAllDims().forEach(({ key, label }) => {
    const panelId = `panel-concentration-${key}`;
    if (document.getElementById(panelId)) return;
    const panel = document.createElement('div');
    panel.id = panelId;
    panel.className = 'sub-panel';
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'false');
    panel.hidden = true;
    panel.dataset.title = `Concentration — ${label}`;
    panel.innerHTML =
      `<div class="sub-panel-header"><div class="sub-panel-title">Concentration — ${__concEsc(label)}</div></div>` +
      `<div class="sub-panel-body">` +
        `<div class="data-container" id="concKeyFiguresTable__${key}" data-label="${__concEsc(label)} — Key Figures"></div>` +
        `<div class="data-container" id="concTopIssuersTable__${key}" data-label="Top ${__concEsc(label)}"></div>` +
      `</div>`;
    host.appendChild(panel);
  });
}

// Report-Panels je Dimension mit dem aktuellen Portfolio fuellen (alle Dimensionen,
// unabhaengig von der live gewaehlten). Folgt dem NAV/Notional-Selector.
function fillConcReportPanels(filteredData) {
  if (!Array.isArray(filteredData) || !filteredData.length) return;
  const valueSel  = document.getElementById('valueSelector');
  const valueType = valueSel ? valueSel.value : 'NAV';
  __concAllDims().forEach(({ key }) => {
    const kfEl = document.getElementById(`concKeyFiguresTable__${key}`);
    const tiEl = document.getElementById(`concTopIssuersTable__${key}`);
    if (!kfEl && !tiEl) return;
    renderConcReportTables(kfEl, tiEl, computeConcentration(filteredData, key, valueType));
  });
}

export function renderConcentrationDashboard(filteredData, opts = {}) {
  const host = document.getElementById('issuerConcentrationDashboard');
  if (!host || !Array.isArray(filteredData) || !filteredData.length) return;

  // Dimension aufloesen + Kennzahlen ueber den gemeinsamen Helfer (identische
  // Logik wie die Report-Panels).
  const dimKey = opts.dataField || _concDimension || 'ISSUER';
  _concDimension = dimKey;

  ensureConcDimensionUI();
  ensureConcDetailBound(host);
  const detailEl0 = document.getElementById('concDetail');
  if (detailEl0) detailEl0.style.display = 'none';   // Drill-down bei (Re-)Render / Dimensionswechsel schliessen
  _concStack = [];
  try { __concMenuHide(); } catch {}

  const valueSel  = document.getElementById('valueSelector');
  const valueType = valueSel ? valueSel.value : 'NAV';

  const m = computeConcentration(filteredData, dimKey, valueType);
  if (!m) return;
  const { dimLabel, items, total, count, top, top10Share, restShare, meanShare, medianShare } = m;

  const titleEl = host.querySelector('.conc-dash__title');
  if (titleEl) titleEl.textContent = dimLabel;
  const sub = document.getElementById('concHeadSub');
  if (sub) sub.textContent = `${count} entries · basis: ${valueType}`;

  // Top-Emittenten-Karten
  const cardsEl = document.getElementById('concCards');
  if (cardsEl) {
    cardsEl.innerHTML = items.slice(0, 8).map((it, i) => `
      <div class="conc-card conc-card--click ${i < 3 ? 'conc-card--lg' : ''}" data-conc-value="${__concEsc(it.name)}">
        <div class="conc-card__name" title="${__concEsc(it.name)}">${__concEsc(it.name)}</div>
        <div class="conc-card__pct">${__concPct(it.share)}</div>
      </div>`).join('');
  }

  // Kennzahlen-Kacheln
  const kpiEl = document.getElementById('concKpiTiles');
  if (kpiEl) {
    const tiles = [
      { v: String(count),          l: 'Number of entries' },
      { v: __concPct(top10Share),  l: 'Top 10 share' },
      { v: __concPct(restShare),   l: 'Others share' },
      { v: __concPct(meanShare),   l: 'Avg share' },
      { v: __concPct(medianShare), l: 'Median share' },
    ];
    kpiEl.innerHTML = tiles.map(t =>
      `<div class="conc-kpi"><div class="conc-kpi__val">${t.v}</div><div class="conc-kpi__lbl">${t.l}</div></div>`
    ).join('');
  }

  // Report-Quellen (Key Figures + Top) fuer die Live-Ansicht ueber den gemeinsamen
  // Helfer fuellen. Die versteckten Report-Panels je Dimension werden separat in
  // renderSummaryBreakdown/valueSelector befuellt (unabhaengig von der live
  // gewaehlten Dimension). Immer befuellen (reines HTML, visibility-unabhaengig).
  renderConcReportTables(
    document.getElementById('concKeyFiguresTable'),
    document.getElementById('concTopIssuersTable'),
    m,
  );

  // Charts nur wenn das Panel sichtbar ist (sonst Canvas-Groesse 0).
  const visible = host.offsetParent !== null;
  if (!visible || !window.Chart) return;

  const c0 = getColorForPieChart(0);
  const c4 = getColorForPieChart(4);

  // App-Font + Theme-Textfarbe fuer die Canvas-Beschriftung (Chart.js-Default
  // wirkte sonst "eigenartig" und im Dark-Theme schlecht lesbar).
  const bodyCss    = getComputedStyle(document.body);
  const chartFont  = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';

  const barCanvas = document.getElementById('concTop10Chart');
  if (barCanvas) {
    if (__concCharts.top10) { try { __concCharts.top10.destroy(); } catch {} }
    __concCharts.top10 = new window.Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      data: {
        labels: top.map(it => it.name),
        datasets: [{
          data: top.map(it => +(it.share * 100).toFixed(2)),
          backgroundColor: c0.backgroundColor, borderColor: c0.borderColor, borderWidth: 1,
          maxBarThickness: 18, borderRadius: 3,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        color: chartColor,
        onClick: (evt, els) => {
          if (els && els.length) {
            const name = top[els[0].index]?.name;
            if (name != null) concDrillTo({ path: [__concStep(_concDimension, String(name))], by: null });
          }
        },
        plugins: {
          legend: { display: false },
          tooltip: { callbacks: { label: (ctx) => `${Number(ctx.parsed.x).toFixed(2)} %` } },
        },
        scales: {
          x: { ticks: { callback: (v) => `${v}%`, color: chartColor, font: { family: chartFont } }, grid: { display: false } },
          y: { ticks: { color: chartColor, font: { family: chartFont, size: 11 } }, grid: { display: false } },
        },
      },
    });
  }

  const donutCanvas = document.getElementById('concDonutChart');
  if (donutCanvas) {
    if (__concCharts.donut) { try { __concCharts.donut.destroy(); } catch {} }
    __concCharts.donut = new window.Chart(donutCanvas.getContext('2d'), {
      type: 'doughnut',
      data: {
        labels: ['Top 10', 'Others'],
        datasets: [{
          data: [+(top10Share * 100).toFixed(2), +(restShare * 100).toFixed(2)],
          backgroundColor: [c0.backgroundColor, c4.backgroundColor],
          borderColor: [c0.borderColor, c4.borderColor], borderWidth: 1,
        }],
      },
      options: {
        responsive: true, maintainAspectRatio: false, cutout: '62%',
        color: chartColor,
        plugins: {
          legend: { position: 'bottom', labels: { boxWidth: 12, color: chartColor, font: { family: chartFont, size: 11 } } },
          tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${Number(ctx.parsed).toFixed(1)} %` } },
        },
      },
    });
  }
}

// ===== Drill-down: Menue-Auswahl + rekursive Aufschluesselung =================
// Zustand = Stack von Views. View { path:[{colKey,value,label}], by }:
//   by = Spalten-Key -> Tabelle nach dieser Dimension gruppiert (Zeilen weiter
//        aufklappbar, data-drill-value). by = null -> flache Positionsliste (Blatt).
// Menue (Karte ODER gruppierte Zeile): Positions / By <noch nicht genutzte Dimension>.
function ensureConcDetailBound(host) {
  if (!host || host.dataset.detailBound) return;
  host.dataset.detailBound = '1';

  // Karte: Hover -> Menue; Klick -> direkt Positionen (Schnellweg).
  host.addEventListener('mouseover', (e) => {
    const card = e.target?.closest?.('[data-conc-value]');
    if (card) { __concMenuCancelHide(); __concShowMenu(card, [__concStep(_concDimension, card.dataset.concValue)]); }
    else __concMenuScheduleHide();
  });
  host.addEventListener('mouseleave', __concMenuScheduleHide);
  host.addEventListener('click', (e) => {
    const card = e.target?.closest?.('[data-conc-value]');
    if (card) concDrillTo({ path: [__concStep(_concDimension, card.dataset.concValue)], by: null });
  });

  // Detail-Tabelle: Hover ueber eine gruppierte Zeile -> Menue (weiter drillen).
  const dtable = document.getElementById('concDetailTable');
  if (dtable) {
    dtable.addEventListener('mouseover', (e) => {
      const row = e.target?.closest?.('[data-drill-value]');
      const cur = _concStack[_concStack.length - 1];
      if (row && cur && cur.by) { __concMenuCancelHide(); __concShowMenu(row, [...cur.path, __concStep(cur.by, row.dataset.drillValue)]); }
      else __concMenuScheduleHide();
    });
    dtable.addEventListener('mouseleave', __concMenuScheduleHide);
    // Klick auf gruppierte Zeile = Schnellweg -> Positionen dieser Ebene.
    dtable.addEventListener('click', (e) => {
      const row = e.target?.closest?.('[data-drill-value]');
      const cur = _concStack[_concStack.length - 1];
      if (row && cur && cur.by) concDrillTo({ path: [...cur.path, __concStep(cur.by, row.dataset.drillValue)], by: null });
    });
  }

  // Breadcrumb-Klick -> zu dieser Ebene zurueck.
  document.getElementById('concDetailTitle')?.addEventListener('click', (e) => {
    const crumb = e.target?.closest?.('[data-crumb]');
    if (crumb) concGotoStackIndex(Number(crumb.dataset.crumb));
  });

  document.getElementById('concDetailClose')?.addEventListener('click', () => {
    _concStack = [];
    const d = document.getElementById('concDetail');
    if (d) d.style.display = 'none';
  });

  const menu = document.getElementById('concCardMenu');
  if (menu) {
    menu.addEventListener('mouseenter', __concMenuCancelHide);
    menu.addEventListener('mouseleave', __concMenuScheduleHide);
    menu.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.conc-menu__item');
      if (!btn || !_concMenuCtx) return;
      const by = btn.dataset.mode === 'group' ? btn.dataset.by : null;
      concDrillTo({ path: _concMenuCtx.slice(), by });
      __concMenuHide();
    });
  }
}

function __concStep(colKey, value) {
  const label = (BREAKDOWN_CONFIG.flatMap(g => g.columns).find(c => c.key === colKey)?.label) || colKey;
  return { colKey, value: String(value ?? ''), label };
}
function __concFieldOf(colKey) { return COLUMN_DATA_FIELD[colKey] || colKey; }
function __concColLabel(colKey) {
  return (BREAKDOWN_CONFIG.flatMap(g => g.columns).find(c => c.key === colKey)?.label) || colKey;
}
function __concNorm(raw) {
  const isEmpty = raw === undefined || raw === null || String(raw).trim() === '';
  return isEmpty ? 'Unknown' : String(raw).trim();
}

function __concMenuHide() { const m = document.getElementById('concCardMenu'); if (m) { m.style.display = 'none'; m.dataset.open = ''; } _concMenuCtx = null; }
function __concMenuScheduleHide() { clearTimeout(_concMenuHideT); _concMenuHideT = setTimeout(__concMenuHide, 200); }
function __concMenuCancelHide() { clearTimeout(_concMenuHideT); }

function __concBuildMenuHtml(prospectivePath) {
  const used = new Set(prospectivePath.map(s => s.colKey));
  const others = BREAKDOWN_CONFIG.flatMap(g => g.columns).filter(c => !used.has(c.key));
  const head = prospectivePath.map(s => s.value).join(' › ');
  const items = [`<button class="conc-menu__item" data-mode="positions">Positions</button>`]
    .concat(others.map(c => `<button class="conc-menu__item" data-mode="group" data-by="${c.key}">By ${__concEsc(c.label)}</button>`));
  return `<div class="conc-menu__hdr" title="${__concEsc(head)}">${__concEsc(head)}</div>${items.join('')}`;
}

function __concShowMenu(anchorEl, prospectivePath) {
  const menu = document.getElementById('concCardMenu');
  if (!menu || !anchorEl) return;
  const sig = prospectivePath.map(s => s.colKey + '=' + s.value).join('|');
  if (menu.dataset.open === sig && menu.style.display !== 'none') return;
  _concMenuCtx = prospectivePath;
  menu.dataset.open = sig;
  menu.innerHTML = __concBuildMenuHtml(prospectivePath);
  menu.style.display = 'block';
  const r = anchorEl.getBoundingClientRect();
  const mw = menu.offsetWidth || 180;
  const mh = menu.offsetHeight || 200;
  let left = r.right + 6;
  if (left + mw > window.innerWidth - 8) left = r.left - mw - 6;
  menu.style.left = Math.max(8, left) + 'px';
  menu.style.top = Math.max(8, Math.min(r.top, window.innerHeight - mh - 8)) + 'px';
}

// Zu einer View navigieren. Stack-Tiefe ergibt sich aus der Pfadlaenge -> Back via
// Breadcrumb funktioniert automatisch (jede tiefere Ebene ersetzt/ergaenzt).
function concDrillTo(view) {
  _concStack.length = Math.max(0, (view.path?.length || 1) - 1);
  _concStack.push(view);
  renderConcView(view);
}
function concGotoStackIndex(i) {
  if (i < 0 || i >= _concStack.length) return;
  _concStack.length = i + 1;
  renderConcView(_concStack[i]);
}

// View rendern: nach Pfad filtern, dann gruppieren (by) oder Positionen (Blatt).
function renderConcView(view) {
  const detail  = document.getElementById('concDetail');
  const titleEl = document.getElementById('concDetailTitle');
  const tableEl = document.getElementById('concDetailTable');
  const data = _lastBreakdownArgs?.filteredData;
  if (!detail || !titleEl || !tableEl || !Array.isArray(data)) return;

  const valueSel = document.getElementById('valueSelector');
  const valueType = valueSel ? valueSel.value : 'NAV';
  const fmtVal = (v) => Number(v).toLocaleString('de-DE', { maximumFractionDigits: 0 });

  // Zeilen nach gesamtem Pfad filtern.
  const rowsAll = data.filter(r => view.path.every(s => __concNorm(r[__concFieldOf(s.colKey)]) === s.value));

  // Breadcrumb (klickbare Pfadwerte) + aktueller Modus.
  const crumbs = view.path
    .map((s, i) => `<span class="conc-crumb" data-crumb="${i}" title="${__concEsc(s.label)}: ${__concEsc(s.value)}">${__concEsc(s.value)}</span>`)
    .join('<span class="conc-crumb-sep">›</span>');
  const modeLabel = view.by ? `by ${__concEsc(__concColLabel(view.by))}` : 'Positions';
  titleEl.innerHTML = `${crumbs}<span class="conc-crumb-mode"> · ${modeLabel}</span>`;

  if (view.by) {
    const byField = __concFieldOf(view.by);
    const map = {};
    rowsAll.forEach(r => { const k = __concNorm(r[byField]); map[k] = (map[k] || 0) + (Number(r[valueType]) || 0); });
    const sub = Object.entries(map).map(([name, val]) => ({ name, val })).sort((a, b) => b.val - a.val);
    const tot = sub.reduce((s, x) => s + x.val, 0) || 1;
    tableEl.innerHTML = `
      <table class="conc-detail-tbl">
        <thead><tr><th>${__concEsc(__concColLabel(view.by))}</th><th style="text-align:right;">${__concEsc(valueType)}</th><th style="text-align:right;">Share</th></tr></thead>
        <tbody>
          ${sub.map(x => `<tr class="conc-drill-row" data-drill-value="${__concEsc(x.name)}">
            <td>${__concEsc(x.name)} <span class="conc-drill-hint">›</span></td>
            <td style="text-align:right;">${fmtVal(x.val)}</td>
            <td style="text-align:right;">${__concPct(x.val / tot)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } else {
    const rows = rowsAll.map(r => ({
      id:   r.PROD_ID != null ? String(r.PROD_ID) : '',
      desc: (r.DESCRIPTION || '').toString(),
      val:  Number(r[valueType]) || 0,
    })).sort((a, b) => b.val - a.val);
    const tot = rows.reduce((s, r) => s + r.val, 0) || 1;
    tableEl.innerHTML = `
      <table class="conc-detail-tbl">
        <thead><tr><th>Product ID</th><th>Description</th><th style="text-align:right;">${__concEsc(valueType)}</th><th style="text-align:right;">Share</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${__concEsc(r.id)}</td>
            <td>${__concEsc(r.desc)}</td>
            <td style="text-align:right;">${fmtVal(r.val)}</td>
            <td style="text-align:right;">${__concPct(r.val / tot)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    // Product-ID-Spalte anklickbar machen -> oeffnet den Product-Drawer
    // (openProdEditorByProdId), gleiche Mechanik wie in den Portfolio-Tabellen.
    try { attachIdLinks(tableEl); } catch (e) { console.warn('[conc] attachIdLinks failed', e); }
  }

  detail.style.display = '';
  try { detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
}

