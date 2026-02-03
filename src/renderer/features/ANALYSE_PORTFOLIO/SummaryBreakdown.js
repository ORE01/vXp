import { getColorForPieChart} from '../../utils/colors.js';
import { setupHiDPICanvas } from './SummaryYield.js';
import { getFormatRules } from '../../utils/format.js';

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

    // Unterpunkte â†’ nur passende Section zeigen
    if (group && g === group) {
      sec.style.display = '';
    } else {
      sec.style.display = 'none';
    }
  });

  // Scroll nur bei echten Gruppen
  if (group && group !== '__NONE__') {
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
    { key: 'IssuerCountryName', label: 'Country' },    // oder 'Country' â€“ je nachdem was du wirklich im Data-Objekt hast

    // âœ… diese fehlen dir aktuell:
    { key: 'IssuerIsEU',   label: 'EU' },
    { key: 'IssuerIsEEA',  label: 'EEA' },
    { key: 'IssuerIsOECD', label: 'OECD' },
    { key: 'IssuerIsEuro', label: 'Euro' },
  ],
},


];



export function handleSummaryNotionalData(filteredData, index, port_name) {
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
    canvas.width = 420;
    canvas.height = 250;

    chartBlock.appendChild(chartHeading);
    chartBlock.appendChild(canvas);

    // --- Legenden-Block ---
    const legendBlock = document.createElement('div');
    legendBlock.className = 'chart-block legend-block';

    const legendHeading = document.createElement('h3');
    legendHeading.textContent = `${columnDisplayNames[column] || column} â€“ Breakdown`;
    legendHeading.className = 'chart-block-title';

    const legendTable = document.createElement('table');
    legendTable.id = legendId;
    legendTable.className = 'chart-legend-table';
    legendTable.dataset.label = `${columnDisplayNames[column] || column} â€“ Breakdown`;

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

  // ðŸ”” Nach dem ersten Render: Risk-Preview/Thumbs aktualisieren
  try {
    notifyRiskPreview('breakdown:init');
  } catch {}

  // ==== Value-Selector (NAV / Notional) nur 1x binden ====
  const valueSel = document.getElementById('valueSelector');
  if (valueSel && !valueSel.dataset.bound) {
    valueSel.addEventListener('change', () => {
      columnsToChart.forEach(column => drawPieChartByColumn(filteredData, column));
      try {
        notifyRiskPreview('breakdown:valueSelector');
      } catch {}
    });
    valueSel.dataset.bound = '1';
  }
}


function drawPieChartByColumn(filteredData, columnName) {
  const valueTypeElem = document.getElementById('valueSelector');
  const valueType = valueTypeElem ? valueTypeElem.value : 'NAV';

  const { labels: rawLabels, values } = getValuesByColumn(filteredData, columnName, valueType);
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

  const ctx = setupHiDPICanvas(newCanvas, 420, 250);

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
  ['Farbe', 'Kategorie', valueType, '%'].forEach(text => {
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

function getValuesByColumn(data, columnName, valueType = 'NAV') {
  // Hard fail if the column does not exist (prevents silently creating "Unknown" due to typos)
  const hasColumn = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

  const map = {};

  data.forEach(entry => {
    if (!hasColumn(entry, columnName)) {
      throw new Error(
        `[getValuesByColumn] Column "${columnName}" not found on entry. ` +
        `Check columnName spelling / mapping. Sample keys: ${Object.keys(entry).slice(0, 20).join(', ')}`
      );
    }

    const raw = entry[columnName];

    // Normalize "empty" values to Unknown (ONLY for real categorical columns)
    const key =
      raw === undefined || raw === null || raw === ''
        ? 'Unknown'
        : String(raw).trim();

    const value = Number(entry[valueType]) || 0;
    map[key] = (map[key] || 0) + value;
  });

  const sorted = Object.entries(map).sort((a, b) => b[1] - a[1]);

  return {
    labels: sorted.map(([k]) => k),
    values: sorted.map(([, v]) => v),
  };
}





    function mapPortDataToTableRows(data) {
        return [
        { label: 'Notional', value: data.formPortNotional },
        { label: 'NetAssetValue', value: data.formPortValue },
        // { label: 'Portfolio Yield', value: data.formPortYield },
        // { label: 'Portfolio Yield (act)', value: data.formPortYieldA },
        // { label: 'Interest Rate Sensitivity (PV01)', value: data.formPortPV01 },
        // { label: 'Credit Spread Sensitivity (CPV01)', value: data.formPortCPV01 },
        ];
    }

    // =====================================================================
// Section-Trigger Wiring (Analyse-Modal â†’ Breakdown-Gruppen)
// =====================================================================

// (function wireSectionTriggersOnce() {
//   // Mehrfach-Registrierung verhindern (falls File mehrfach geladen wird)
//   if (window.__breakdownTriggersWired) return;
//   window.__breakdownTriggersWired = true;

//   // sicherer Wrapper um openSubPanel
//   function openSubPanelSafe(panelId) {
//     try {
//       if (typeof window.openSubPanel === 'function') {
//         window.openSubPanel(panelId);
//       } else if (typeof openSubPanel === 'function') {
//         openSubPanel(panelId);
//       } else {
//         console.warn('[Breakdown] openSubPanel nicht gefunden');
//       }
//     } catch (e) {
//       console.error('[Breakdown] openSubPanel Error', e);
//     }
//   }

// document.addEventListener('click', (e) => {
//   const btn = e.target.closest?.('.section-trigger');
//   if (!btn) return;

//   // âœ… 1) Nur Trigger im ANALYSE_Modal behandeln
//   const analyseModal = btn.closest?.('#ANALYSE_Modal');
//   if (!analyseModal) return;

//   const panelId = btn.dataset.panel || btn.getAttribute('aria-controls');
//   if (!panelId) return;

//   // âœ… 2) Nur Breakdown-Trigger hier behandeln
//   // Alles andere (MarketData/Compare/etc.) ignorieren,
//   // weil die zentrale Panel-Logik das Ã¼bernimmt.
//   if (panelId !== 'panel-breakdown') return;

//   // âœ… 3) NUR Breakdown-Fokus steuern (kein globales openSubPanel!)
//   const group = btn.dataset.breakdownGroup;

//   if (!group) {
//     // Hauptpunkt â†’ Overview zeigen, alle Sections verstecken
//     focusBreakdownGroup('__NONE__');
//   } else {
//     // Unterpunkt â†’ nur diese Gruppe anzeigen
//     focusBreakdownGroup(group);
//   }
// });

// })();


























