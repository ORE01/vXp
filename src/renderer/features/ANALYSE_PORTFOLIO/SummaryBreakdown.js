import { getColorForPieChart, getContrastColorForPieChart } from '../../utils/colors.js';
import { setupHiDPICanvas } from './SummaryYield.js';
import { getFormatRules } from '../../utils/tableCellFormats.js';
import { attachIdLinks } from '../../utils/linksToTables.js';
import { appState } from '../../renderer.js';
import { makeSortableDetailsTable } from './marketRisk/sensitivities/detailsTableSort.js';

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
      { key: 'ISSUER',      label: 'Issuer' },
      // Nach Issuer die drei Ratings zusammenhaengend: General -> Product -> Resolved.
      // (RATING_PROD/RATINGres sind Produkt-Ratings, hier aber bewusst direkt nach dem
      // Issuer-Rating platziert, damit sie in Dropdown/Preview/PDF zusammen erscheinen.)
      { key: 'RATING',      label: 'Issuer General Rating' },
      { key: 'RATING_PROD', label: 'Product Ratings' },
      { key: 'RATINGres',   label: 'Rating Resolved' },
      { key: 'RANK',        label: 'Issuer Capital Structure' },
    ],
  },
  {
    key: 'Product',
    title: 'Product',
    overview: 'Product Rating, Rating Resolved, Category, Coupon Type',
    columns: [
      // RATING_PROD / RATINGres wurden in die Issuer-Gruppe verschoben (Ratings direkt
      // nach Issuer). Hier bleiben die uebrigen Produkt-Dimensionen.
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
let _concMenuDrill = null;       // Drill-Funktion, die der Menue-Klick ausfuehrt
let _concCtxThunk = null;        // Rechtsklick-Ziel (Treemap/Balken): merkt sich Hover, zeigt das Menue erst bei contextmenu

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

  // Breakdown-Konzentrations-Dashboard (#panel-concentration) rendern —
  // UNABHAENGIG vom (entfernten) Pie-Grid des alten Breakdown-Panels.
  try { renderConcentrationDashboard(filteredData, { dataField: _concDimension }); } catch (e) { console.warn('[conc] render failed', e); }
  try { ensureConcReportPanels(); fillConcReportPanels(filteredData); } catch (e) { console.warn('[conc] report panels failed', e); }
  if (!_concHookBound) {
    _concHookBound = true;
    try {
      window.registerPanelOpenHook?.('panel-concentration', () => {
        requestAnimationFrame(() => {
          try { renderConcentrationDashboard(_lastBreakdownArgs?.filteredData, { dataField: _concDimension }); } catch {}
          // Beim Oeffnen OBEN beginnen (Dimension-Dropdown sichtbar) — sonst startet
          // die Ansicht bei den Charts. Der Scroller ist die .sub-panel-body (KIND
          // des Panels), zusaetzlich Panel, Vorfahren und Dokument zuruecksetzen.
          const scrollBreakdownTop = () => {
            try {
              const panel = document.getElementById('panel-concentration');
              if (!panel) return;
              panel.scrollTop = 0;
              panel.querySelectorAll('.sub-panel-body, .sub-panel-content').forEach((el) => { el.scrollTop = 0; });
              let el = panel.parentElement;
              while (el && el !== document.body) {
                if (el.scrollTop) el.scrollTop = 0;
                el = el.parentElement;
              }
              if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
            } catch {}
          };
          requestAnimationFrame(scrollBreakdownTop);
          // Nachzuegler abfangen (smooth-scrollIntoView/spaete Renders uebersteuern).
          setTimeout(scrollBreakdownTop, 120);
        });
      });
    } catch {}
    document.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('button.section-trigger[data-panel="panel-concentration"]');
      if (btn && btn.dataset.dimension) _concDimension = btn.dataset.dimension;
    }, true);
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

  // (Concentration- + Structure-Rendering samt Panel-Open-Hooks laufen jetzt oben,
  //  VOR dem #pieChartGrid-Early-Return — unabhaengig vom entfernten Breakdown-Panel.)

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
// Seit "Product Ratings" (RATING_PROD) und "Rating Resolved" (RATINGres) eigene
// Dimensionen sind, liest jede Dimension direkt ihre eigene Spalte.
const COLUMN_DATA_FIELD = {};
// Spalten, bei denen Zeilen OHNE Wert ausgeschlossen werden (statt "None").
// Produkte ohne eigenes Rating werden bewusst als "None" GEZEIGT.
const COLUMN_EXCLUDE_EMPTY = new Set([]);

// Value-Basis (NAV/Notional) für das Breakdown-Panel (#concValueSelector).
// Fallback auf den alten globalen #valueSelector, dann NAV.
function getConcValueType() {
  return document.getElementById('concValueSelector')?.value
    || document.getElementById('valueSelector')?.value
    || 'NAV';
}

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
    type: 'doughnut',
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
      cutout: '55%',
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          bodyFont: { size: 10 },
          callbacks: {
            label: function (context) {
              const value = context.parsed;
              const percentage = ((value / total) * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
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
    const percentage = ((value / total) * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
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

    // Leere Werte als "None" ausweisen (es gibt schlicht keinen Wert).
    const key = isEmpty ? 'None' : String(raw).trim();

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
const __concPct = (x) => `${(x * 100).toLocaleString('de-DE', { minimumFractionDigits: x < 0.1 ? 2 : 1, maximumFractionDigits: x < 0.1 ? 2 : 1 })}%`;

// Langen Kachel-Namen auf mehrere Zeilen umbrechen (<br>), damit er auch in
// schmalen Treemap-Kacheln passt (z.B. "Bayerische Landesbank").
function __wrapLabel(name, maxLen = 13) {
  const words = String(name ?? '').split(/\s+/).filter(Boolean);
  const lines = [];
  let cur = '';
  for (const w of words) {
    if (!cur) cur = w;
    else if ((cur + ' ' + w).length <= maxLen) cur += ' ' + w;
    else { lines.push(cur); cur = w; }
  }
  if (cur) lines.push(cur);
  return lines.join('<br>');
}

// Issuer-Groessen-Gradient (dunkel = gross -> hell = klein). Farbe kommt aus dem
// ANTEIL (nicht der Position): so bekommt "Others" seine wertgerechte (dunklere)
// Farbe und der Balken rechts nutzt exakt dieselbe Zuordnung wie die Treemap.
const __ISSUER_GRADIENT = [
  [  5,  33,  65],  // #052141  navy
  [ 40,  76, 116],  // #284C74
  [ 64, 100, 141],  // #40648D
  [106, 140, 179],  // #6A8CB3
  [ 89, 156, 167],  // #599CA7
  [ 98, 160, 165],  // #62A0A5
  [122, 169, 152],  // #7AA998
  [136, 170, 125],  // #88AA7D
  [189, 190, 123],  // #BDBE7B
  [214, 191, 119],  // #D6BF77  gold
  [217, 169,  91],  // #D9A95B  amber
  [209, 139,  74],  // #D18B4A  orange
  [192, 110,  66],  // #C06E42  burnt orange
  [172,  85,  64],  // #AC5540  terracotta
  [151,  58,  60],  // #973A3C  gedecktes Rot
];
function __concSizeColor(share, maxShare) {
  const g = __ISSUER_GRADIENT;
  const r = maxShare > 0 ? Math.max(0, Math.min(1, share / maxShare)) : 0; // 1 = groesste
  const pos = (1 - r) * (g.length - 1);   // groesste -> 0 (dunkel), klein -> letzte (hell)
  return __concGradAt(pos);
}

// Gradient an einer (float) Position auswerten. RANG-basiert genutzt: rank 0 =
// groesste = Gradient[0] (navy), rank 1 = Gradient[1], ... So bekommen die Top-
// Kacheln der Reihe nach die Blautoene (nicht wert-interpoliert -> springt nicht).
function __concGradAt(pos) {
  const g = __ISSUER_GRADIENT;
  const p = Math.max(0, Math.min(g.length - 1, pos));
  const i0 = Math.floor(p);
  const i1 = Math.min(i0 + 1, g.length - 1);
  const t = p - i0;
  const ch = (k) => Math.round(g[i0][k] + (g[i1][k] - g[i0][k]) * t);
  return `rgb(${ch(0)}, ${ch(1)}, ${ch(2)})`;
}

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
      [`Top ${m.top.length} share`, __concPct(m.top10Share)],
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

// Chart.js-Instanzen der Report-Panels je Dimension (zum Zerstoeren vor Neuzeichnen).
let __concReportCharts = {};   // { [dimKey]: { top10, donut } }

// Versteckte Report-Panels je Dimension: erlauben, im PDF ALLE Konzentrations-
// Dashboards einzeln zu waehlen — unabhaengig von der live gewaehlten Dimension.
// Je Panel: zwei Charts (Top-10-Balken + Donut, feste Canvas-Groesse) + zwei
// Tabellen. Die Preview erfasst .sub-panel > canvas[id]/.data-container[id]
// generisch; die Panels liegen in #ANALYSE_Modal (→ Report-Baum unter dem
// PORTFOLIO/ANALYSE-Tab). Idempotent.
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
    panel.dataset.title = label;
    panel.innerHTML =
      `<div class="sub-panel-header"><div class="sub-panel-title">${__concEsc(label)}</div></div>` +
      `<div class="sub-panel-body">` +
        `<div class="conc-report-charts" style="display:flex; gap:16px; flex-wrap:wrap; margin-bottom:12px;">` +
          `<div id="concTreemap__${key}" data-label="Breakdown — ${__concEsc(label)}" style="width:520px; height:300px;"></div>` +
          `<canvas id="concTop10Chart__${key}" width="460" height="300" data-label="Top 10 — ${__concEsc(label)}"></canvas>` +
        `</div>` +
        `<div class="data-container" id="concKeyFiguresTable__${key}" data-label="${__concEsc(label)} — Key Figures" data-kpi-band="1"></div>` +
        `<div class="data-container" id="concTopIssuersTable__${key}" data-label="Top ${__concEsc(label)}"></div>` +
      `</div>`;
    host.appendChild(panel);
  });
}

// Statische Report-Visuals je Dimension (wie das Live-Breakdown-Panel): Treemap
// (Plotly, feste Groesse) + Top-10-Balken (Chart.js, Rang+Name+%-Labels). responsive:false
// + fixe Groesse + animation:false -> malen auch in versteckten Panels, damit
// canvasThumb()/PDF ein echtes Bild bekommen. Ohne Drill-Interaktion/Tooltips.
function renderConcReportCharts(key, m) {
  // Treemap immer (auch zum Purgen bei leerem Portfolio).
  try { renderConcReportTreemap(key, m); } catch (e) { console.warn('[conc] report treemap failed', key, e); }

  if (!window.Chart) return;
  const prev = __concReportCharts[key] || {};
  if (!m) {
    try { prev.top10?.destroy(); } catch {}
    __concReportCharts[key] = {};
    return;
  }
  const bodyCss    = getComputedStyle(document.body);
  const chartFont  = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';

  const top = m.top || [];
  const barCanvas = document.getElementById(`concTop10Chart__${key}`);
  if (barCanvas) {
    try { prev.top10?.destroy(); } catch {}
    // data-label an die tatsaechliche Anzahl anpassen (Preview-Baum + PDF-Ueberschrift).
    barCanvas.dataset.label = `Top ${top.length} — ${m.dimLabel}`;
    // Canvas-Hoehe nach Balkenanzahl (Lesbarkeit), mit Mindest-/Maxhoehe.
    // Setzen von .width/.height leert das Bitmap -> Chart zeichnet danach frisch.
    barCanvas.width  = 460;
    barCanvas.height = Math.max(140, Math.min(340, top.length * 30 + 50));
    const maxPct = ((m.items[0] && m.items[0].share) || 0) * 100;
    prev.top10 = new window.Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
      data: {
        labels: top.map((it, i) => `${i + 1}   ${it.name}`),   // Rang + Name (wie Live-Panel)
        datasets: [{
          data: top.map(it => +(it.share * 100).toFixed(2)),
          backgroundColor: top.map((_, i) => __concGradAt(i)),   // Farbe nach Rang
          borderColor: top.map((_, i) => __concGradAt(i)),
          borderWidth: 0, maxBarThickness: 16, borderRadius: 3,
        }],
      },
      options: {
        indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false,
        color: chartColor,
        layout: { padding: { right: 6 } },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          datalabels: window.ChartDataLabels ? {
            anchor: 'end', align: 'end', clamp: true, offset: 2, color: chartColor,
            font: { family: chartFont, size: 12, weight: '700' },
            formatter: (v) => `${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
          } : undefined,
        },
        scales: {
          x: { display: false, beginAtZero: true, max: maxPct * 1.22, grid: { display: false } },
          y: { ticks: { color: chartColor, font: { family: chartFont, size: 12 }, crossAlign: 'far' }, grid: { display: false }, border: { display: false } },
        },
      },
    });
  }
  __concReportCharts[key] = prev;
}

// Report-Treemap je Dimension: eigenes Plotly-Element mit FEST gesetzter Breite/Hoehe
// (im Layout) -> rendert auch in verstecktem Panel korrekt, damit Preview/PDF ein Bild
// bekommen. staticPlot: keine Interaktion (reines Report-Bild).
function renderConcReportTreemap(key, m) {
  const el = document.getElementById(`concTreemap__${key}`);
  if (!el || !window.Plotly) return;
  if (!m || !Array.isArray(m.items) || !m.items.length) { try { window.Plotly.purge(el); } catch {} return; }

  const N = 15;
  const items = m.items;
  const shown = items.slice(0, N);
  const rest  = items.slice(N);
  const labels = shown.map(it => it.name);
  const values = shown.map(it => it.value);
  const custom = shown.map(it => __concPct(it.share));
  const colors = shown.map((_, i) => __concGradAt(i));   // Farbe nach Rang (wie Live-Treemap)
  if (rest.length) {
    const rv = rest.reduce((s, it) => s + it.value, 0);
    const rs = rest.reduce((s, it) => s + it.share, 0);
    labels.push(`Others (${rest.length})`);
    values.push(rv);
    custom.push(__concPct(rs));
    const othersBigger = shown.filter(it => it.value > rv).length;
    colors.push(__concGradAt(Math.max(0, othersBigger - 0.5)));
  }

  const bodyCss   = getComputedStyle(document.body);
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const data = [{
    type: 'treemap', labels, values, parents: labels.map(() => ''),
    customdata: custom,
    text: labels.map(t => __wrapLabel(t)),
    texttemplate: '%{text}<br>%{customdata}',
    hoverinfo: 'skip',
    textposition: 'middle center',
    textfont: { color: '#fff', family: chartFont, size: 14 },
    tiling: { pad: 2, packing: 'squarify' },
    marker: { colors, line: { width: 1, color: 'rgba(0,0,0,0.25)' } },
    pathbar: { visible: false },
    sort: true,
  }];
  const layout = {
    width: 520, height: 300, margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)', font: { family: chartFont, size: 11 },
  };
  try { window.Plotly.react(el, data, layout, { displayModeBar: false, staticPlot: true, responsive: false }); }
  catch (e) { console.warn('[conc] Plotly.react (report treemap) failed', key, e); }
}

// Report-Panels je Dimension mit dem aktuellen Portfolio fuellen (alle Dimensionen,
// unabhaengig von der live gewaehlten). Folgt dem NAV/Notional-Selector.
function fillConcReportPanels(filteredData) {
  if (!Array.isArray(filteredData) || !filteredData.length) return;
  const valueType = getConcValueType();
  __concAllDims().forEach(({ key }) => {
    const kfEl = document.getElementById(`concKeyFiguresTable__${key}`);
    const tiEl = document.getElementById(`concTopIssuersTable__${key}`);
    if (!kfEl && !tiEl) return;
    const m = computeConcentration(filteredData, key, valueType);
    renderConcReportTables(kfEl, tiEl, m);
    try { renderConcReportCharts(key, m); } catch (e) { console.warn('[conc] report chart failed', key, e); }
  });
}


// Aktuelle "Others"-Aggregat-Kachel der Treemap (Label + Namensmenge des Rests),
// je Render aktualisiert -> die einmalig gebundenen Handler lesen den aktuellen Stand.
let _concTreemapOthers = null;

// Pfad-Schritt fuer eine Treemap-Kachel: normale Emittenten exakt; "Others" via
// Match ueber die aggregierten Rest-Namen -> Drill zeigt die Positionen ALLER
// kleinen Emittenten aus der Sammelkachel.
function __concTreemapStep(name) {
  const o = _concTreemapOthers;
  if (o && name === o.label) {
    const names = o.names;
    const field = __concFieldOf(_concDimension);
    return { colKey: _concDimension, value: 'Others', label: __concColLabel(_concDimension), match: (r) => names.has(__concNorm(r[field])) };
  }
  return __concStep(_concDimension, String(name));
}

// Top-Emittenten-Treemap (ersetzt die Karten): Flaeche ∝ Anteil (Plotly, squarify).
// Braucht ein sichtbares Panel fuer die Breite -> beim Panel-Open re-rendert der Hook.
// Top 15 einzeln + "Others (n)"-Kachel fuer den Rest. Klick -> Drill zu Positionen.
function renderConcTreemap(items, host) {
  const el = document.getElementById('concCards');
  if (!el || !window.Plotly) return;
  if (host && host.offsetParent === null) return;   // Panel nicht sichtbar -> Groesse 0
  el.style.display = 'block';   // .conc-cards ist flex -> fuer Plotly-Breitenmessung auf block

  const N = 15;
  const shown = items.slice(0, N);
  const rest = items.slice(N);
  const labels = shown.map(it => it.name);
  const values = shown.map(it => it.value);
  const custom = shown.map(it => __concPct(it.share));
  const shares = shown.map(it => it.share);   // parallel zu labels -> Farbe nach Wert
  if (rest.length) {
    const rv = rest.reduce((s, it) => s + it.value, 0);
    const rs = rest.reduce((s, it) => s + it.share, 0);
    const othersLabel = `Others (${rest.length})`;
    labels.push(othersLabel);
    values.push(rv);
    custom.push(__concPct(rs));
    shares.push(rs);
    _concTreemapOthers = { label: othersLabel, names: new Set(rest.map(it => it.name)) };
  } else {
    _concTreemapOthers = null;
  }

  const bodyCss   = getComputedStyle(document.body);
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  // Farbe nach RANG: shown[i] -> Gradient[i] (groesste = navy, dann blau/teal/gruen/
  // gold/orange/rot). Others sitzt farblich an seiner Wert-Position (dunkler als der
  // naechstkleinere Emittent). So bleiben die Blautoene fuer die Top-Kacheln.
  const colors = shown.map((_, i) => __concGradAt(i));
  if (rest.length) {
    const rv = values[values.length - 1];   // Others-Wert (zuletzt angehaengt)
    const othersBigger = shown.filter(it => it.value > rv).length;
    colors.push(__concGradAt(Math.max(0, othersBigger - 0.5)));
  }

  const data = [{
    type: 'treemap',
    labels,
    values,
    parents: labels.map(() => ''),
    customdata: custom,
    // text = umgebrochener Anzeige-Name (labels bleiben der echte Name -> Hover/Klick
    // funktionieren weiter). %{text} zeigt den mehrzeiligen Namen + Anteil.
    text: labels.map(t => __wrapLabel(t)),
    texttemplate: '%{text}<br>%{customdata}',
    hovertemplate: '%{label}<br>%{customdata}<extra></extra>',
    textposition: 'middle center',
    textfont: { color: '#fff', family: chartFont, size: 15 },
    tiling: { pad: 2, packing: 'squarify' },
    marker: { colors, line: { width: 1, color: 'rgba(0,0,0,0.25)' } },
    pathbar: { visible: false },
    sort: true,
  }];
  const layout = {
    height: 260,
    margin: { l: 0, r: 0, t: 0, b: 0 },
    paper_bgcolor: 'rgba(0,0,0,0)',
    font: { family: chartFont, size: 11 },
    // KEIN uniformtext/minsize -> Plotly skaliert den Text pro Kachel und zeigt ihn
    // IMMER an (kleine Kacheln = kleinerer Text, aber vorhanden). Der Umbruch (<br>)
    // macht lange Namen lesbarer, ohne extrem schrumpfen zu muessen.
  };
  try {
    window.Plotly.react(el, data, layout, { displayModeBar: false, responsive: true });
  } catch (e) { console.warn('[conc] Plotly.react failed', e); return; }

  if (!el.__concTreemapBound && typeof el.on === 'function') {
    el.__concTreemapBound = true;

    // Klick auf eine Kachel -> Drill zu Positionen. return false verhindert das
    // Plotly-interne Treemap-Zoom (Schnellweg, wie der bisherige Karten-Klick).
    el.on('plotly_treemapclick', (ev) => {
      const name = ev?.points?.[0]?.label;
      if (name) {
        try { concDrillTo({ path: [__concTreemapStep(name)], by: null }); } catch {}
      }
      return false;
    });

    // Menue erst bei Rechtsklick sichtbar: Hover merkt sich nur Ziel + Ankerpunkt
    // (Positions / By <Dimension>), am Cursor verankert. Auch fuer "Others".
    el.on('plotly_hover', (ev) => {
      const name = ev?.points?.[0]?.label;
      if (!name) { _concCtxThunk = null; return; }
      const me = ev?.event;
      const x = me && typeof me.clientX === 'number' ? me.clientX : null;
      const y = me && typeof me.clientY === 'number' ? me.clientY : null;
      const anchor = (x != null && y != null)
        ? { getBoundingClientRect: () => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }) }
        : el;
      _concCtxThunk = () => __concShowMenu(anchor, [__concTreemapStep(name)]);
    });
    el.on('plotly_unhover', () => { _concCtxThunk = null; });

    // Rechtsklick auf eine Kachel -> Drill-Menue.
    el.addEventListener('contextmenu', (e) => {
      if (!_concCtxThunk) return;
      e.preventDefault();
      __concMenuCancelHide();
      _concCtxThunk();
    });
  }
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
  _concStack = [];
  try { __concMenuHide(); } catch {}

  const valueType = getConcValueType();

  // Eigener NAV/Notional-Selektor des Issuer-Breakdown-Panels: bei Wechsel neu rendern.
  const concValSel = document.getElementById('concValueSelector');
  if (concValSel) {
    if (concValSel.__concHandler) concValSel.removeEventListener('change', concValSel.__concHandler);
    const h = () => {
      try { renderConcentrationDashboard(filteredData, { dataField: _concDimension }); } catch {}
      try { fillConcReportPanels(filteredData); } catch {}
      try { notifyRiskPreview('concentration:valueSelector'); } catch {}
    };
    concValSel.addEventListener('change', h);
    concValSel.__concHandler = h;
  }

  const m = computeConcentration(filteredData, dimKey, valueType);
  if (!m) return;
  const { dimLabel, items, total, count, top, top10Share, restShare, meanShare, medianShare } = m;

  const titleEl = host.querySelector('.conc-dash__title');
  if (titleEl) titleEl.textContent = dimLabel;
  // Dimensionen mit <10 Auspraegungen (z.B. Issuer Rating): "Top N" statt fix "Top 10".
  const topTitleEl = document.getElementById('concTopTitle');
  if (topTitleEl) topTitleEl.textContent = `Top ${top.length}`;
  const sub = document.getElementById('concHeadSub');
  if (sub) sub.textContent = `${count} entries · basis: ${valueType}`;

  // Top-Emittenten als Treemap (Flaeche ∝ Anteil) statt gleich breiter Karten.
  // Rendert nur bei sichtbarem Panel (Plotly braucht Breite); der Panel-Open-Hook
  // re-rendert beim Oeffnen.
  try { renderConcTreemap(items, host); } catch (e) { console.warn('[conc] treemap failed', e); }

  // Kennzahlen-Kacheln
  const kpiEl = document.getElementById('concKpiTiles');
  if (kpiEl) {
    const tiles = [
      { v: String(count),          l: 'Number of entries' },
      { v: __concPct(top10Share),  l: `Top ${top.length} share` },
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

  // Root-Ansicht der Drill-Tabelle direkt zeigen: ALLE Eintraege der aktuellen
  // Dimension ("Others" aufgeloest) mit Share, ohne dass man erst reinklicken muss.
  try { concShowRoot(); } catch (e) { console.warn('[conc] root view failed', e); }

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
    const maxPct = ((items[0] && items[0].share) || 0) * 100;
    __concCharts.top10 = new window.Chart(barCanvas.getContext('2d'), {
      type: 'bar',
      plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
      data: {
        labels: top.map((it, i) => `${i + 1}   ${it.name}`),   // Rang + Name (wie Screenshot)
        datasets: [{
          data: top.map(it => +(it.share * 100).toFixed(2)),
          // Farbe pro Balken nach RANG (dunkler = groesser) — gleiche Reihenfolge wie
          // die Treemap-Kacheln (top[i] = shown[i]).
          backgroundColor: top.map((_, i) => __concGradAt(i)),
          borderColor: top.map((_, i) => __concGradAt(i)),
          borderWidth: 0,
          maxBarThickness: 16, borderRadius: 3,
        }],
      },
      options: {
        indexAxis: 'y', responsive: true, maintainAspectRatio: false,
        color: chartColor,
        onHover: (evt, els) => {
          // Menue erst bei Rechtsklick: Hover merkt sich nur Ziel + Ankerpunkt.
          if (!els || !els.length) { _concCtxThunk = null; return; }
          const name = top[els[0].index]?.name;
          if (name == null) { _concCtxThunk = null; return; }
          const me = evt?.native;
          const x = me && typeof me.clientX === 'number' ? me.clientX : null;
          const y = me && typeof me.clientY === 'number' ? me.clientY : null;
          const anchor = (x != null && y != null)
            ? { getBoundingClientRect: () => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }) }
            : (evt?.chart?.canvas || document.body);
          _concCtxThunk = () => __concShowMenu(anchor, [__concStep(_concDimension, String(name))]);
        },
        onClick: (evt, els) => {
          if (els && els.length) {
            const name = top[els[0].index]?.name;
            if (name != null) concDrillTo({ path: [__concStep(_concDimension, String(name))], by: null });
          }
        },
        layout: { padding: { right: 6 } },
        plugins: {
          legend: { display: false },
          tooltip: { enabled: false },
          datalabels: window.ChartDataLabels ? {
            anchor: 'end', align: 'end', clamp: true, offset: 2,
            color: chartColor,
            font: { family: chartFont, size: 14, weight: '700' },
            formatter: (v) => `${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`,
          } : undefined,
        },
        scales: {
          // Achse + Gitter aus (wie Screenshot); etwas Headroom rechts fuer die Wert-Labels.
          x: { display: false, beginAtZero: true, max: maxPct * 1.22, grid: { display: false } },
          y: {
            ticks: { color: chartColor, font: { family: chartFont, size: 14 }, crossAlign: 'far' },
            grid: { display: false }, border: { display: false },
          },
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

  // Klick auf eine Karte -> direkt Positionen (Schnellweg).
  host.addEventListener('click', (e) => {
    const card = e.target?.closest?.('[data-conc-value]');
    if (card) concDrillTo({ path: [__concStep(_concDimension, card.dataset.concValue)], by: null });
  });
  host.addEventListener('mouseleave', __concMenuScheduleHide);

  // Drill-Menue erst bei Rechtsklick sichtbar (Karte ODER Top-10-Balken).
  host.addEventListener('contextmenu', (e) => {
    const card = e.target?.closest?.('[data-conc-value]');
    if (card) {
      e.preventDefault();
      __concMenuCancelHide();
      __concShowMenu(card, [__concStep(_concDimension, card.dataset.concValue)]);
      return;
    }
    if (_concCtxThunk && e.target?.closest?.('#concTop10Chart')) {
      e.preventDefault();
      __concMenuCancelHide();
      _concCtxThunk();
    }
  });

  // Detail-Tabelle: Hover ueber eine gruppierte Zeile -> Menue (weiter drillen).
  const dtable = document.getElementById('concDetailTable');
  if (dtable) {
    dtable.addEventListener('mouseleave', __concMenuScheduleHide);
    // Drill-Menue fuer gruppierte Zeilen erst bei Rechtsklick (weiter drillen).
    dtable.addEventListener('contextmenu', (e) => {
      const row = e.target?.closest?.('[data-drill-value]');
      const cur = _concStack[_concStack.length - 1];
      if (row && cur && cur.by) {
        e.preventDefault();
        __concMenuCancelHide();
        __concShowMenu(row, [...cur.path, __concStep(cur.by, row.dataset.drillValue)]);
      }
    });
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
    concShowRoot();   // zurück zur Vollliste (alle Eintraege), statt auszublenden
  });

  const menu = document.getElementById('concCardMenu');
  if (menu) {
    menu.addEventListener('mouseenter', __concMenuCancelHide);
    menu.addEventListener('mouseleave', __concMenuScheduleHide);
    menu.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.conc-menu__item');
      if (!btn || !_concMenuCtx) return;
      const by = btn.dataset.mode === 'group' ? btn.dataset.by : null;
      (_concMenuDrill || concDrillTo)({ path: _concMenuCtx.slice(), by });
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
function __concNotional(r) {
  const n = Number(r?.NOTIONAL ?? r?.notional ?? r?.Notional ?? 0);
  return Number.isFinite(n) ? n : 0;
}
function __concNorm(raw) {
  const isEmpty = raw === undefined || raw === null || String(raw).trim() === '';
  // Leere Werte als "None" ausweisen (es gibt schlicht keinen Wert).
  return isEmpty ? 'None' : String(raw).trim();
}

function __concMenuHide() {
  // Alle Drill-Menues (auch dynamische je Panel) ausblenden.
  document.querySelectorAll('.conc-menu').forEach(m => { m.style.display = 'none'; m.dataset.open = ''; });
  _concMenuCtx = null;
}
function __concMenuScheduleHide() { clearTimeout(_concMenuHideT); _concMenuHideT = setTimeout(__concMenuHide, 200); }
function __concMenuCancelHide() { clearTimeout(_concMenuHideT); }

function __concBuildMenuHtml(prospectivePath, showLabels) {
  const used = new Set(prospectivePath.map(s => s.colKey));
  const others = BREAKDOWN_CONFIG.flatMap(g => g.columns).filter(c => !used.has(c.key));
  // showLabels: Kopf zeigt "Dimension: Wert" (z.B. "Issuer: UniCredit Bank"), damit
  // klar ist, dass nach der Dimension gedrillt wird — nicht nach einem Balken/Metrik.
  // Mehrere Pfad-Eintraege (z.B. zwei Issuer) UNTEREINANDER statt in einer Zeile —
  // sonst wird das Menue zu breit. Tooltip (title) bleibt einzeilig mit ' › '.
  const parts = prospectivePath.map(s => (showLabels && s.label) ? `${s.label}: ${s.value}` : s.value);
  const head = parts.join(' › ');
  const headHtml = parts
    .map((p, i) => `<div class="conc-menu__hdr-line">${i > 0 ? '› ' : ''}${__concEsc(p)}</div>`)
    .join('');
  const items = [`<button class="conc-menu__item" data-mode="positions">Positions</button>`]
    .concat(others.map(c => `<button class="conc-menu__item" data-mode="group" data-by="${c.key}">By ${__concEsc(c.label)}</button>`));
  return `<div class="conc-menu__hdr" title="${__concEsc(head)}">${headHtml}</div>${items.join('')}`;
}

function __concShowMenu(anchorEl, prospectivePath, drillFn, menuId, showLabels) {
  const menu = document.getElementById(menuId || 'concCardMenu');
  if (!menu || !anchorEl) return;
  _concMenuDrill = drillFn || concDrillTo;   // welcher Kontext beim Klick drillt
  const sig = prospectivePath.map(s => s.colKey + '=' + s.value).join('|');
  if (menu.dataset.open === sig && menu.style.display !== 'none') return;
  _concMenuCtx = prospectivePath;
  menu.dataset.open = sig;
  menu.innerHTML = __concBuildMenuHtml(prospectivePath, showLabels);
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
// Root der Drill-Tabelle: gruppiert nach aktueller Dimension = ALLE Eintraege.
function concShowRoot() {
  _concStack = [{ path: [], by: _concDimension || 'ISSUER' }];
  renderConcView(_concStack[0]);
}
function concGotoStackIndex(i) {
  if (i === -1) { concShowRoot(); return; }   // "All"-Krümel -> zurück zur Vollliste
  if (i < 0 || i >= _concStack.length) return;
  _concStack.length = i + 1;
  renderConcView(_concStack[i]);
}

// ---- Liquidity-Dashboard: eigener Drill-Kontext (gleiche Engine, eigenes Ziel) ----
// Eigenes Detail-Panel + Menue. Die Daten kommen NICHT aus
// _lastBreakdownArgs (Breakdown-Modul), sondern werden vom Liquidity-Dashboard per
// setLiqDrillData() gesetzt. valueType fest auf NOTIONAL, passend zu den Balken.
let _liqStack = [];
const LIQ_CTX = {
  detailId: 'liqDashDetail', titleId: 'liqDashDetailTitle', tableId: 'liqDashDetailTable',
  data: null, valueType: 'NOTIONAL',
};

export function setLiqDrillData(rows) {
  LIQ_CTX.data = Array.isArray(rows) ? rows : [];
}

function liqDrillTo(view) {
  _liqStack.length = Math.max(0, (view.path?.length || 1) - 1);
  _liqStack.push(view);
  renderConcView(view, LIQ_CTX);
}
function liqGotoStackIndex(i) {
  if (i < 0 || i >= _liqStack.length) return;
  _liqStack.length = i + 1;
  renderConcView(_liqStack[i], LIQ_CTX);
}

// Detail-Tabelle + Menue + Breadcrumb + Close des Liquidity-Panels binden (einmalig).
export function ensureLiqDrillBound() {
  const panel = document.getElementById('panel-liquidity-dash');
  if (!panel || panel.dataset.liqBound) return;
  panel.dataset.liqBound = '1';

  const dtable = document.getElementById('liqDashDetailTable');
  if (dtable) {
    dtable.addEventListener('mouseover', (e) => {
      const row = e.target?.closest?.('[data-drill-value]');
      const cur = _liqStack[_liqStack.length - 1];
      if (row && cur && cur.by) { __concMenuCancelHide(); __concShowMenu(row, [...cur.path, __concStep(cur.by, row.dataset.drillValue)], liqDrillTo, 'liqDashCardMenu'); }
      else __concMenuScheduleHide();
    });
    dtable.addEventListener('mouseleave', __concMenuScheduleHide);
    dtable.addEventListener('click', (e) => {
      const row = e.target?.closest?.('[data-drill-value]');
      const cur = _liqStack[_liqStack.length - 1];
      if (row && cur && cur.by) liqDrillTo({ path: [...cur.path, __concStep(cur.by, row.dataset.drillValue)], by: null });
    });
  }

  const lmenu = document.getElementById('liqDashCardMenu');
  if (lmenu && !lmenu.dataset.menuBound) {
    lmenu.dataset.menuBound = '1';
    lmenu.addEventListener('mouseenter', __concMenuCancelHide);
    lmenu.addEventListener('mouseleave', __concMenuScheduleHide);
    lmenu.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.conc-menu__item');
      if (!btn || !_concMenuCtx) return;
      const by = btn.dataset.mode === 'group' ? btn.dataset.by : null;
      (_concMenuDrill || concDrillTo)({ path: _concMenuCtx.slice(), by });
      __concMenuHide();
      // Balken im Dashboard entsprechend segmentieren: Positions -> je Position,
      // sonst nach dem gewaehlten Datenfeld.
      try {
        const field = by ? __concFieldOf(by) : '__POSITIONS';
        document.dispatchEvent(new CustomEvent('liq:chart-group', { detail: { field } }));
      } catch {}
    });
  }

  document.getElementById('liqDashDetailTitle')?.addEventListener('click', (e) => {
    const crumb = e.target?.closest?.('[data-crumb]');
    if (crumb) liqGotoStackIndex(Number(crumb.dataset.crumb));
  });
  document.getElementById('liqDashDetailClose')?.addEventListener('click', () => {
    _liqStack = [];
    const d = document.getElementById('liqDashDetail');
    if (d) d.style.display = 'none';
    // Segmentierung aufheben -> Balken zurueck auf Total.
    try { document.dispatchEvent(new CustomEvent('liq:chart-group', { detail: { field: null } })); } catch {}
  });
}

// Hover ueber einen Faelligkeits-Balken -> Floating-Menue (Positions / By <Dim>) am
// Cursor. steps[index] = Bucket-Schritt (mit match-Praedikat). Klick -> direkt drillen.
export function liqChartHoverMenu(evt, els, steps) {
  ensureLiqDrillBound();
  if (!els || !els.length) return;
  const step = steps[els[0].index];
  if (!step) { __concMenuScheduleHide(); return; }
  __concMenuCancelHide();
  const me = evt?.native;
  const x = me && typeof me.clientX === 'number' ? me.clientX : null;
  const y = me && typeof me.clientY === 'number' ? me.clientY : null;
  const anchor = (x != null && y != null)
    ? { getBoundingClientRect: () => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }) }
    : (evt?.chart?.canvas || document.body);
  __concShowMenu(anchor, [step], liqDrillTo, 'liqDashCardMenu');
}
export function liqChartClickDrill(els, steps) {
  ensureLiqDrillBound();
  if (!els || !els.length) return;
  const step = steps[els[0].index];
  if (step) liqDrillTo({ path: [step], by: null });
}

// Menue verstecken (z.B. beim Verlassen des Canvas), fuer externe Module.
export function scheduleHideConcMenu() { __concMenuScheduleHide(); }

// ---- Einheitlicher RECHTSKLICK-Drill fuer Chart.js-Balken/-Scatter ----------------
// Bindet einmalig ein contextmenu am Canvas: unterdrueckt das native Menue, sucht das
// Element unter dem Cursor und ruft onPick(el, chart, e) auf. So loesen ALLE Drill-Charts
// den Drill konsistent per Rechtsklick aus (kein Hover-/Linksklick-Menue mehr).
//   getChart() -> aktuelle Chart-Instanz (oder null); zur Klickzeit gelesen -> uebersteht
//     jedes Neuzeichnen. opts.datasetIndex filtert (z.B. Scatter: nur die Punkte-Serie).
export function bindRightClickDrill(canvas, getChart, onPick, opts = {}) {
  if (!canvas || canvas.dataset.rcDrillBound) return;
  canvas.dataset.rcDrillBound = '1';
  canvas.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    try {
      const chart = getChart?.();
      if (!chart) { __concMenuScheduleHide(); return; }
      let els = chart.getElementsAtEventForMode(e, 'nearest', { intersect: true }, false) || [];
      if (opts.datasetIndex != null) els = els.filter(x => x.datasetIndex === opts.datasetIndex);
      const el = els[0];
      if (!el) { __concMenuScheduleHide(); return; }
      onPick(el, chart, e);
    } catch {}
  });
}

// ---- Factory fuer Market-Risk Beitrags-Drill (Issuers/Products/Factors) ----
// Erzeugt pro Panel getrennte Drill-Kontexte je Metrik (VaR/ES) mit eigenen
// Detail-/Menue-Elementen. Beide Metriken teilen dieselben (enrichten) Drill-Rows,
// nur andere Wertspalte (valueType/valueLabel). Rueckgabe: { setData, hover, click }.
// config.var / config.es = { detailId, titleId, tableId, closeId, menuId, valueType, valueLabel }.
export function createContribDrill(config) {
  const mk = (c) => ({ stack: [], bound: false, menuId: c.menuId, closeId: c.closeId,
    ctx: { detailId: c.detailId, titleId: c.titleId, tableId: c.tableId, data: null, valueType: c.valueType, valueLabel: c.valueLabel, extraCol: c.extraCol, extraCols: c.extraCols, infoCol: c.infoCol, infoCols: c.infoCols, columns: c.columns } });
  const M = { var: mk(config.var), es: mk(config.es) };

  const drillTo = (kind, view) => {
    const m = M[kind]; if (!m) return;
    m.stack.length = Math.max(0, (view.path?.length || 1) - 1);
    m.stack.push(view);
    renderConcView(view, m.ctx);
  };
  const goto = (kind, i) => {
    const m = M[kind]; if (!m || i < 0 || i >= m.stack.length) return;
    m.stack.length = i + 1;
    renderConcView(m.stack[i], m.ctx);
  };
  const ensureBound = (kind) => {
    const m = M[kind]; if (!m || m.bound) return; m.bound = true;
    const dtable = document.getElementById(m.ctx.tableId);
    if (dtable) {
      dtable.addEventListener('mouseover', (e) => {
        const row = e.target?.closest?.('[data-drill-value]');
        const cur = m.stack[m.stack.length - 1];
        if (row && cur && cur.by) { __concMenuCancelHide(); __concShowMenu(row, [...cur.path, __concStep(cur.by, row.dataset.drillValue)], (v) => drillTo(kind, v), m.menuId, true); }
        else __concMenuScheduleHide();
      });
      dtable.addEventListener('mouseleave', __concMenuScheduleHide);
      dtable.addEventListener('click', (e) => {
        const row = e.target?.closest?.('[data-drill-value]');
        const cur = m.stack[m.stack.length - 1];
        if (row && cur && cur.by) drillTo(kind, { path: [...cur.path, __concStep(cur.by, row.dataset.drillValue)], by: null });
      });
    }
    const menu = document.getElementById(m.menuId);
    if (menu && !menu.dataset.menuBound) {
      menu.dataset.menuBound = '1';
      menu.addEventListener('mouseenter', __concMenuCancelHide);
      menu.addEventListener('mouseleave', __concMenuScheduleHide);
      menu.addEventListener('click', (e) => {
        const btn = e.target?.closest?.('.conc-menu__item');
        if (!btn || !_concMenuCtx) return;
        const by = btn.dataset.mode === 'group' ? btn.dataset.by : null;
        (_concMenuDrill || concDrillTo)({ path: _concMenuCtx.slice(), by });
        __concMenuHide();
      });
    }
    document.getElementById(m.ctx.titleId)?.addEventListener('click', (e) => {
      const crumb = e.target?.closest?.('[data-crumb]');
      if (crumb) goto(kind, Number(crumb.dataset.crumb));
    });
    document.getElementById(m.closeId)?.addEventListener('click', () => {
      m.stack = [];
      const d = document.getElementById(m.ctx.detailId);
      if (d) d.style.display = 'none';
    });
  };

  return {
    setData(rows) { const arr = Array.isArray(rows) ? rows : []; M.var.ctx.data = arr; M.es.ctx.data = arr; },
    // Hover ueber Balken/Punkt -> Floating-Menue; Klick -> direkt drillen. kind='var'|'es'.
    hover(kind, evt, els, steps) {
      ensureBound(kind);
      if (!els || !els.length) return;
      const step = steps[els[0].index];
      if (!step) { __concMenuScheduleHide(); return; }
      __concMenuCancelHide();
      const me = evt?.native;
      const x = me && typeof me.clientX === 'number' ? me.clientX : null;
      const y = me && typeof me.clientY === 'number' ? me.clientY : null;
      const anchor = (x != null && y != null)
        ? { getBoundingClientRect: () => ({ left: x, right: x, top: y, bottom: y, width: 0, height: 0 }) }
        : (evt?.chart?.canvas || document.body);
      __concShowMenu(anchor, [step], (v) => drillTo(kind, v), M[kind].menuId, true);
    },
    click(kind, els, steps) {
      ensureBound(kind);
      if (!els || !els.length) return;
      const step = steps[els[0].index];
      if (step) drillTo(kind, { path: [step], by: null });
    },
    // Alle Zeilen anzeigen (kein Filter) -> volle Positions-/EAD-Tabelle. match:()=>true
    // matcht jede Zeile; der Breadcrumb zeigt "All".
    showAll(kind) {
      ensureBound(kind);
      drillTo(kind, { path: [{ colKey: '__ALL', value: 'All', label: 'All', match: () => true }], by: null });
    },
  };
}

// ===== Produkt-Stammdaten-Tooltip: Hover ueber eine Kennnummer (.prod-id-link) =====
// Zeigt die Stammdaten des Produkts (aus appState.getProdById) in einer schwebenden
// Karte am Cursor. Wird an jede Detail-Tabelle einmal gebunden.
const PROD_STAMM_FIELDS = [
  ['Description', ['DESCRIPTION', 'description']],
  ['Issuer',      ['ISSUER', 'issuer']],
  ['Coupon type', ['CouponType', 'coupon_type', 'COUPON_TYPE']],
  ['Schedule',    ['SCHEDULE', 'schedule']],
  ['Maturity',    ['MATURITY', 'maturity', 'MATURITY_DATE']],
  ['Rank',        ['RANK', 'rank']],
  ['Rating',      ['RATING_PROD', 'RATING', 'rating']],
  ['Model',       ['MODEL', 'model']],
  ['Method',      ['METHODE', 'METHOD', 'method']],
];

function __prodTipEl() {
  let el = document.getElementById('prodStammdatenTip');
  if (!el) {
    el = document.createElement('div');
    el.id = 'prodStammdatenTip';
    el.className = 'prod-stamm-tip';
    el.style.cssText = 'position:fixed; z-index:2000; display:none; pointer-events:none;';
    document.body.appendChild(el);
  }
  return el;
}
function __prodStammHtml(prodId) {
  const p = (typeof appState?.getProdById === 'function') ? appState.getProdById(prodId) : null;
  if (!p) return null;
  const pick = (keys) => {
    for (const k of keys) { const v = p[k]; if (v !== undefined && v !== null && String(v).trim() !== '') return String(v); }
    return null;
  };
  const rows = PROD_STAMM_FIELDS.map(([lbl, keys]) => {
    const v = pick(keys);
    return v == null ? '' : `<tr><td class="pst-k">${__concEsc(lbl)}</td><td class="pst-v">${__concEsc(v)}</td></tr>`;
  }).join('');
  return `<div class="pst-hdr">${__concEsc(prodId)}</div><table class="pst-tbl">${rows}</table>`;
}
function __prodTipMove(x, y) {
  const el = __prodTipEl();
  if (el.style.display === 'none') return;
  const w = el.offsetWidth || 280, h = el.offsetHeight || 160;
  let left = x + 14, top = y + 14;
  if (left + w > window.innerWidth - 8) left = x - w - 14;
  if (top + h > window.innerHeight - 8) top = window.innerHeight - h - 8;
  el.style.left = Math.max(8, left) + 'px';
  el.style.top = Math.max(8, top) + 'px';
}
function __prodTipShow(prodId, x, y) {
  const html = __prodStammHtml(prodId);
  const el = __prodTipEl();
  if (!html) { el.style.display = 'none'; return; }
  el.innerHTML = html;
  el.style.display = 'block';
  __prodTipMove(x, y);
}
function __prodTipHide() { const el = document.getElementById('prodStammdatenTip'); if (el) el.style.display = 'none'; }

export function ensureProdHoverBound(tableEl) {
  if (!tableEl || tableEl.dataset.prodHoverBound) return;
  tableEl.dataset.prodHoverBound = '1';
  tableEl.addEventListener('mouseover', (e) => {
    const link = e.target?.closest?.('.prod-id-link');
    if (!link) return;
    const id = (link.dataset.prodId || link.textContent || '').trim();
    if (id) __prodTipShow(id, e.clientX, e.clientY);
  });
  tableEl.addEventListener('mousemove', (e) => {
    if (e.target?.closest?.('.prod-id-link')) __prodTipMove(e.clientX, e.clientY);
  });
  tableEl.addEventListener('mouseout', (e) => {
    const link = e.target?.closest?.('.prod-id-link');
    if (link && !link.contains(e.relatedTarget)) __prodTipHide();
  });
}

// View rendern: nach Pfad filtern, dann gruppieren (by) oder Positionen (Blatt).
// ctx bestimmt die Ziel-Detail-Elemente (Default = Overview). Pfad-Schritte koennen
// optional s.match(r) tragen (z.B. Rating-Buckets) statt exaktem Feldvergleich.
function renderConcView(view, ctx) {
  const c = ctx || { detailId: 'concDetail', titleId: 'concDetailTitle', tableId: 'concDetailTable', showAllCrumb: true };
  const detail  = document.getElementById(c.detailId);
  const titleEl = document.getElementById(c.titleId);
  const tableEl = document.getElementById(c.tableId);
  const data = c.data || _lastBreakdownArgs?.filteredData;
  if (!detail || !titleEl || !tableEl || !Array.isArray(data)) return;

  const valueSel = document.getElementById('valueSelector');
  const valueType = c.valueType
    || document.getElementById('concValueSelector')?.value
    || (valueSel ? valueSel.value : 'NAV');
  const valueLabel = c.valueLabel || valueType;   // Spaltenueberschrift (z.B. "VaR contrib")
  const fmtVal = (v) => Number(v).toLocaleString('de-DE', { maximumFractionDigits: 0 });
  // Optionale Zusatzspalte (z.B. Loss) — nur wenn der Aufrufer ctx.extraCol setzt.
  // Werte aus row[extra.key]; in der Gruppen-Sicht summiert. Andere Panels unberuehrt.
  const extra = (c.extraCol && c.extraCol.key) ? c.extraCol : null;
  // Optionale Text-Info-Spalte(n) (z.B. Issuer, Rating) — nur in der Positions-Sicht,
  // nicht summiert. Werte aus row[info.key]. Mehrere via ctx.infoCols; einzelnes
  // ctx.infoCol bleibt rueckwaertskompatibel (wird zu 1-elementiger Liste).
  const info = (c.infoCol && c.infoCol.key) ? c.infoCol : null;
  const infos = Array.isArray(c.infoCols)
    ? c.infoCols.filter(e => e && e.key)
    : (info ? [info] : []);
  // Mehrere optionale Zusatz-Wertspalten (z.B. VaR-Zerlegung IR/CS je Produkt).
  // Rueckwaertskompatibel: ein einzelnes extraCol wird als 1-elementige Liste behandelt.
  const extraCols = Array.isArray(c.extraCols)
    ? c.extraCols.filter(e => e && e.key)
    : (extra ? [extra] : []);

  // Zeilen nach gesamtem Pfad filtern (s.match hat Vorrang, z.B. Rating-Buckets).
  const rowsAll = data.filter(r => view.path.every(s => s.match ? s.match(r) : __concNorm(r[__concFieldOf(s.colKey)]) === s.value));

  // Breadcrumb (klickbare Pfadwerte) + aktueller Modus.
  const crumbs = view.path
    .map((s, i) => `<span class="conc-crumb" data-crumb="${i}" title="${__concEsc(s.label)}: ${__concEsc(s.value)}"><span class="conc-crumb-dim" style="opacity:.6;margin-right:4px;">${__concEsc(s.label)} ›</span>${__concEsc(s.value)}</span>`)
    .join('<span class="conc-crumb-sep">›</span>');
  const modeLabel = view.by ? `by ${__concEsc(__concColLabel(view.by))}` : 'Positions';
  if (view.path.length === 0) {
    // Root-Ansicht (keine Pfad-Krümel): alle Eintraege der Dimension.
    titleEl.innerHTML = `<span class="conc-crumb-mode">All entries · by ${__concEsc(__concColLabel(view.by))}</span>`;
  } else {
    // Führender "All"-Krümel (nur im Concentration-Kontext) -> Rücksprung zur Vollliste.
    const allCrumb = c.showAllCrumb
      ? `<span class="conc-crumb" data-crumb="-1">All</span><span class="conc-crumb-sep">›</span>`
      : '';
    titleEl.innerHTML = `${allCrumb}${crumbs}<span class="conc-crumb-mode"> · ${modeLabel}</span>`;
  }

  if (view.by) {
    const byField = __concFieldOf(view.by);
    const map = {};
    const nmap = {};   // summiertes Notional je Gruppe
    const emaps = extraCols.map(() => ({}));   // je Zusatzspalte ein Summen-Map je Gruppe
    rowsAll.forEach(r => {
      const k = __concNorm(r[byField]);
      map[k] = (map[k] || 0) + (Number(r[valueType]) || 0);
      nmap[k] = (nmap[k] || 0) + __concNotional(r);
      extraCols.forEach((e, ei) => { emaps[ei][k] = (emaps[ei][k] || 0) + (Number(r[e.key]) || 0); });
    });
    const sub = Object.entries(map).map(([name, val]) => ({ name, val, notional: nmap[name] || 0, extras: extraCols.map((_, ei) => emaps[ei][name] || 0) })).sort((a, b) => b.val - a.val);
    const tot = sub.reduce((s, x) => s + x.val, 0) || 1;
    tableEl.innerHTML = `
      <table class="conc-detail-tbl">
        <thead><tr><th>${__concEsc(__concColLabel(view.by))}</th><th style="text-align:right;">Notional</th><th style="text-align:right;">${__concEsc(valueLabel)}</th>${extraCols.map(e => `<th style="text-align:right;">${__concEsc(e.label)}</th>`).join('')}<th style="text-align:right;">Share</th></tr></thead>
        <tbody>
          ${sub.map(x => `<tr class="conc-drill-row" data-drill-value="${__concEsc(x.name)}">
            <td>${__concEsc(x.name)} <span class="conc-drill-hint">›</span></td>
            <td style="text-align:right;" data-sort-value="${x.notional}">${fmtVal(x.notional)}</td>
            <td style="text-align:right;" data-sort-value="${x.val}">${fmtVal(x.val)}</td>
            ${x.extras.map(v => `<td style="text-align:right;" data-sort-value="${v}">${fmtVal(v)}</td>`).join('')}
            <td style="text-align:right;" data-sort-value="${tot ? x.val / tot : 0}">${__concPct(x.val / tot)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
  } else if (Array.isArray(c.columns) && c.columns.length) {
    // Custom-Spalten (z.B. EAD-Panel: Rank/Rating/Notional/LGD/PD wie die EAD-Tabelle).
    // fmt: 'num' = Tausender ohne Nachkomma, 'dec' = bis 5 Nachkommastellen,
    // 'pct' = Wert*100 mit % (z.B. 0.0004 -> 0,04 %), sonst Text.
    const cols = c.columns;
    const fmtCell = (r, col) => {
      const v = r[col.key];
      if (col.fmt === 'num') return Number.isFinite(Number(v)) ? fmtVal(v) : '';
      if (col.fmt === 'dec') return Number.isFinite(Number(v)) ? Number(v).toLocaleString('de-DE', { maximumFractionDigits: 5 }) : '';
      if (col.fmt === 'pct') return Number.isFinite(Number(v)) ? `${(Number(v) * 100).toLocaleString('de-DE', { maximumFractionDigits: 4 })} %` : '';
      if (col.fmt === 'pctval') return Number.isFinite(Number(v)) ? `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })} %` : '';
      return v == null ? '' : String(v);
    };
    // Klick auf einen Spaltenkopf sortiert nach dieser Spalte (num/dec/pct/pctval
    // numerisch, sonst alphabetisch); erneuter Klick dreht die Richtung.
    // Default wie bisher: Notional absteigend.
    const isNumCol = (col) => ['num', 'dec', 'pct', 'pctval'].includes(col.fmt);
    let sortIdx = -1, sortDir = -1;
    const sortedRows = () => {
      if (sortIdx < 0) return rowsAll.slice().sort((a, b) => __concNotional(b) - __concNotional(a));
      const col = cols[sortIdx];
      return rowsAll.slice().sort((a, b) => {
        if (isNumCol(col)) {
          const av = Number(a[col.key]), bv = Number(b[col.key]);
          return ((Number.isFinite(av) ? av : -Infinity) - (Number.isFinite(bv) ? bv : -Infinity)) * sortDir;
        }
        return String(a[col.key] ?? '').localeCompare(String(b[col.key] ?? ''), 'de') * sortDir;
      });
    };
    const bodyHtml = () =>
      sortedRows().map(r => `<tr>${cols.map(col => `<td${col.align === 'right' ? ' style="text-align:right;"' : ''}>${__concEsc(fmtCell(r, col))}</td>`).join('')}</tr>`).join('');
    tableEl.innerHTML = `
      <table class="conc-detail-tbl">
        <thead><tr>${cols.map((col, i) => `<th data-sort-idx="${i}" title="Click to sort" style="cursor:pointer;${col.align === 'right' ? 'text-align:right;' : ''}">${__concEsc(col.label)}<span class="conc-sort-arrow"></span></th>`).join('')}</tr></thead>
        <tbody>${bodyHtml()}</tbody>
      </table>`;
    tableEl.querySelector('thead')?.addEventListener('click', (e) => {
      const th = e.target?.closest?.('[data-sort-idx]');
      if (!th) return;
      const i = Number(th.dataset.sortIdx);
      if (sortIdx === i) sortDir = -sortDir;
      else { sortIdx = i; sortDir = isNumCol(cols[i]) ? -1 : 1; }   // numerisch: erst groesste
      tableEl.querySelectorAll('.conc-sort-arrow').forEach(s => { s.textContent = ''; });
      const arrow = th.querySelector('.conc-sort-arrow');
      if (arrow) arrow.textContent = sortDir === 1 ? ' ▲' : ' ▼';
      const tb = tableEl.querySelector('tbody');
      if (tb) tb.innerHTML = bodyHtml();
      try { attachIdLinks(tableEl); } catch {}
    });
    try { attachIdLinks(tableEl); } catch (e) { console.warn('[conc] attachIdLinks failed', e); }
    try { ensureProdHoverBound(tableEl); } catch {}
    detail.style.display = '';
    try { detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
    return;
  } else {
    const rows = rowsAll.map(r => ({
      id:   r.PROD_ID != null ? String(r.PROD_ID) : '',
      desc: (r.DESCRIPTION || '').toString(),
      infos: infos.map(inf => String(r[inf.key] ?? '')),
      notional: __concNotional(r),
      val:  Number(r[valueType]) || 0,
      extras: extraCols.map(e => Number(r[e.key]) || 0),
    })).sort((a, b) => b.val - a.val);
    const tot = rows.reduce((s, r) => s + r.val, 0) || 1;
    tableEl.innerHTML = `
      <table class="conc-detail-tbl">
        <thead><tr><th>Product ID</th><th>Description</th>${infos.map(inf => `<th>${__concEsc(inf.label)}</th>`).join('')}<th style="text-align:right;">Notional</th><th style="text-align:right;">${__concEsc(valueLabel)}</th>${extraCols.map(e => `<th style="text-align:right;">${__concEsc(e.label)}</th>`).join('')}<th style="text-align:right;">Share</th></tr></thead>
        <tbody>
          ${rows.map(r => `<tr>
            <td>${__concEsc(r.id)}</td>
            <td>${__concEsc(r.desc)}</td>
            ${r.infos.map(v => `<td>${__concEsc(v)}</td>`).join('')}
            <td style="text-align:right;" data-sort-value="${r.notional}">${fmtVal(r.notional)}</td>
            <td style="text-align:right;" data-sort-value="${r.val}">${fmtVal(r.val)}</td>
            ${r.extras.map(v => `<td style="text-align:right;" data-sort-value="${v}">${fmtVal(v)}</td>`).join('')}
            <td style="text-align:right;" data-sort-value="${tot ? r.val / tot : 0}">${__concPct(r.val / tot)}</td>
          </tr>`).join('')}
        </tbody>
      </table>`;
    // Product-ID-Spalte anklickbar machen -> oeffnet den Product-Drawer
    // (openProdEditorByProdId), gleiche Mechanik wie in den Portfolio-Tabellen.
    try { attachIdLinks(tableEl); } catch (e) { console.warn('[conc] attachIdLinks failed', e); }
    // Hover ueber die Kennnummer -> Produkt-Stammdaten als schwebende Karte.
    try { ensureProdHoverBound(tableEl); } catch {}
  }

  // Make the drill table sortable by clicking headers (▲/▼). Default: the value
  // column descending — same order the rows already have (so signed drills like
  // perf are not reordered), just with the arrow shown; for the sensitivities
  // drills (magnitude values) this is "largest first". (Custom-columns branch
  // returned above and keeps its own header sorting.)
  try {
    makeSortableDetailsTable(tableEl.querySelector('table'), {
      defaultColLabel: valueLabel,
      defaultDir: -1,
    });
  } catch {}

  detail.style.display = '';
  try { detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
}

