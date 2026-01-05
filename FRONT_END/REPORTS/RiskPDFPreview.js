
import { handleRefreshThumbnailsClick } from '../renderer.js';
//import { getSectionTitleFromPanel } from './RiskPDF.js';


// ==== oben ins Modul (Modul-Scope-Variablen) ====
let __riskWired = false;
let __riskRefreshBtn = null;       // Elem-Ref
let __riskRefreshHandler = null;   // Funktion-Ref
let __riskDocRefreshHandler = null;// Funktion-Ref (CustomEvent)
let __riskDocDelegatedHandler = null;

// ⬆️ Modul-scope:
let __riskRaf = 0;
let __riskIdle = 0;
let __riskScheduled = false;
let __riskControlsMO = null;
let __riskRendering = false;      
let __lastRenderTs = 0;           // letzter erfolgreicher Render (ms)
const RENDER_THROTTLE_MS = 200;   // Mindestabstand zwischen Renders



// ─────────────────────────────────────────────
// AUTO-DISCOVERY: Sections, Charts, Tables
// ─────────────────────────────────────────────

function discoverPanels() {
  return [...document.querySelectorAll('.sub-panel')].map(panel => {
    let id = panel.id || '';

    // Prefix entfernen (wie bisher)
    id = id.replace(/^panel-/, '');

    // Suffix "Modal" robust entfernen: _Modal, -Modal, Modal (case-insensitive)
    id = id.replace(/[_-]?Modal$/i, '');

    return { key: id, element: panel };
  });
}


function discoverChartsFromPanel(panel) {
  const canvases = [...panel.querySelectorAll('canvas[id]')];

  // Plotly: entweder hat der DIV die Plotly-Klasse oder eine konfigurierte ID
  const plotlyDivs = [
    // alle Plotly-Root-DIVs mit ID
    ...panel.querySelectorAll('.js-plotly-plot[id], .plotly-graph-div[id]'),
    // zusätzliche hart definierte IDs aus der Config
    ...RISK_CONFIG.swaptionPlotlyIds.flatMap(id =>
      [...panel.querySelectorAll(`#${id}`)]
    ),
  ];

  const uniqPlotly = [];
  const seen = new Set();
  for (const d of plotlyDivs) {
    if (!d?.id) continue;
    if (seen.has(d.id)) continue;
    seen.add(d.id);
    uniqPlotly.push(d);
  }

  return [
    ...canvases.map(c => ({ id: c.id, label: c.dataset.label || c.id })),
    ...uniqPlotly.map(d => ({ id: d.id, label: d.dataset.label || d.id })),
  ];
}



function discoverTablesFromPanel(panel) {
  const containers = [
    // Bisher: klassische Daten-Container
    ...panel.querySelectorAll('.data-container[id]'),
    // NEU: unsere Legend-Tabellen (direkte Tabellen mit ID)
    ...panel.querySelectorAll('table.chart-legend-table[id]'),
  ];

  return containers.map(el => ({
    id: el.id,
    label: el.dataset.label || el.id,
  }));
}


function discoverSectionsFull() {
  const sectionMap = {};

  discoverPanels().forEach(({ key, element }) => {
    sectionMap[key] = {
      key,
      charts: discoverChartsFromPanel(element),
      tables: discoverTablesFromPanel(element),
      element,
    };
  });

  return sectionMap;
}

function injectBreakdownChildren(sections, chartState = {}) {
  const hasBreakdown = sections.some(s => s.key === 'breakdown');
  if (!hasBreakdown) return sections;

  // Mapping ChildKey -> GroupName in RISK_CONFIG.breakdownGroups
  const map = {
    breakdownIssuer:   'Issuer',
    breakdownProducts: 'Product',  // ⚠️ Gruppe heißt "Product" in deiner breakdownGroups
    breakdownGeneral:  'General',
  };

  // Breakdown-Charts direkt aus dem DOM holen
  const breakdownPanel = document.getElementById('panel-breakdown');
  const breakdownCharts = breakdownPanel ? discoverChartsFromPanel(breakdownPanel) : [];

  // Nur die Charts, die wir kennen, sauber mapbar
  const byId = new Map(breakdownCharts.map(ch => [ch.id, ch]));

  const existing = new Set(sections.map(s => s?.key).filter(Boolean));

  const injected = Object.entries(map)
    .filter(([childKey]) => !existing.has(childKey))
    .map(([childKey, groupName]) => {
      const ids = (RISK_CONFIG.breakdownGroups?.[groupName] || []);
      const chartsInGroup = ids.map(id => byId.get(id)).filter(Boolean);

      // enabledCharts soll auf breakdown:* schauen (wegen canonicalChartSection)
      const enabledCharts = chartsInGroup.filter(ch =>
        isChartEnabled(childKey, ch.id, chartState)
      );

      const sectionOn = isSectionEnabled(childKey, chartState);

      const breakdownControlsHtml = sectionOn
        ? buildBreakdownControlsWithThumbs(
            childKey,
            chartsInGroup,
            enabledCharts,
            chartState
          )
        : '';

      return {
        key: childKey,
        title: sectionTitleFromKey(childKey),
        sectionControls: buildSectionControlsHTML(childKey, chartState),
        chartItems: [],
        chartThumbs: [],
        tableItems: [],
        tableThumbs: [],
        breakdownControlsHtml,
        hasThumbs: true,     // keine "Noch keine Thumbnails"
        injected: true,
        sectionEnabled: sectionOn,
      };
    });

  return [...sections, ...injected];
}


function canonicalChartSection(sectionKey, chartKey) {
  // Section-Checkbox bleibt eigenständig je Subsection
  if (chartKey === '__section__') return sectionKey;

  // Alle Breakdown-Untersections sollen denselben Chart-State wie "breakdown" benutzen
  if (sectionKey && sectionKey !== 'breakdown' && sectionKey.startsWith('breakdown')) {
    return 'breakdown';
  }
  return sectionKey;
}

function chartStateFlatKey(sectionKey, chartKey) {
  const sec = canonicalChartSection(sectionKey, chartKey);
  return `${sec}:${chartKey}`;
}




// ─────────────────────────────────────────────
// Zentrales Layout: Sections + enabled Charts/Tables
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ZENTRALE KONFIG FÜR RISK-PREVIEW / PDF
// ─────────────────────────────────────────────

// ─────────────────────────────────────────────
// ZENTRALE KONFIG FÜR RISK-PREVIEW / PDF
// ─────────────────────────────────────────────

// =====================================================================
// RISK_CONFIG (nur der relevante Teil – Titles + Hierarchy + Orders)
// =====================================================================

export const RISK_CONFIG = {
  // -------------------------------------------------------------------
  // Panels, die in der Preview / PDF ignoriert werden sollen
  // -------------------------------------------------------------------
  ignoredSectionTitles: [
    'RISK REPORT',
    'Risk Report',
    'OFFERS REPORT',
    'Offers Report',
    'READ OFFERS',
    'OFFERS',
    'EXCEL IMPORT',
    'VXP IMPORTS',
    'HISTORIC DATA (APIs)',
    'ECB',
    'Fed (FRED)',
    'Yahoo Finance',
    'ISSUER',
    'PRODUCTS',
    'NEW PORTFOLIO',
    'EDIT / CREATE PORTFOLIO',
    'Issuer (PDF) – Final Terms Parser',
  ],

  // -------------------------------------------------------------------
  // Panel-Keys die ignoriert werden
  // -------------------------------------------------------------------
  ignoredSectionKeys: [
    'TSDataContainer_1',
    'TSDataContainer_2',
    'TSDataContainer_3',
    'TSDataContainer_4',
  ],

  // -------------------------------------------------------------------
  // Tabellen-Container, die NIE als Thumbs/Checkboxen auftauchen sollen
  // -------------------------------------------------------------------
  ignoredTableIds: [
    'TSDataContainer_1',
    'TSDataContainer_2',
    'TSDataContainer_3',
    'TSDataContainer_4',
    'portAggDataContainer5',
  ],

  // -------------------------------------------------------------------
  // ✅ Label-Map (Section-Key → schöner Titel)
  // WICHTIG:
  // - Keys sind genau die, die discoverPanels() liefert:
  //   panel-XYZ      -> "XYZ"
  //   XYZ_Modal      -> "XYZ"
  // -------------------------------------------------------------------
  sectionTitles: {
    // ===== Breakdown =====
    breakdown: 'Portfolio Breakdown',

      // ✅ Injected Breakdown Children (künstliche Sections)
    breakdownIssuer:  'Issuer',
    breakdownProducts:'Products',
    breakdownGeneral: 'General',

    // ===== Performance (optional, falls du dieses Panel wirklich hast) =====
    performance: 'Performance',

    // ===== Market (Parent + Children) =====
    market: 'Market Risk',
    marketTraffic: 'Market Risk — Traffic Light',     // injected special section (key = marketTraffic)
    mvar: 'Market Risk — VaR Details',                 // panel-mvar -> "mvar"
    sensitivities: 'Market Risk — Sensitivities',      // panel-sensitivities -> "sensitivities"

    // ===== Credit (Parent + Children) =====
    credit: 'Credit Risk',                             // panel-credit -> "credit"
    creditTraffic: 'Credit Risk — Traffic Lights',     // injected special section (key = creditTraffic)
    EAD: 'Credit Risk — EAD / LGD / PD',                // panel-EAD -> "EAD"
    cvar: 'Credit Risk — VaR & ES',                     // panel-cvar -> "cvar"

    // ===== Historic Performance (Parent + Children) =====
    // PORTFOLIO_HISTORY_Modal -> "PORTFOLIO_HISTORY"
    PORTFOLIO_HISTORY: 'Historic Performance',
    'portfolio-value': 'Portfolio Value',              // panel-portfolio-value -> "portfolio-value"
    'hist-sensitivities': 'Historical Sensitivities',  // panel-hist-sensitivities -> "hist-sensitivities"
    'market-risk': 'Historic Market Risk',             // panel-market-risk -> "market-risk"
    'credit-risk': 'Historic Credit Risk',             // panel-credit-risk -> "credit-risk"

    // ===== Other =====
    liquidity: 'Liquidity',
    marketDataIR: 'Market Data — Interest Rates',
    marketDataCS: 'Market Data — Credit Spreads',

    swaptionATM: 'Swaption Vols — ATM Surface',
    swaptionSmile: 'Swaption Vols — Smile',
    swaptionCube: 'Swaption Vols — Cube Summary',

    historicTS: 'Historic Market Data',
    historicData: 'Historic Data — Timeseries',
    historicDataTS: 'Historic Data — Timeseries',
  },

  // -------------------------------------------------------------------
  // ✅ Hierarchie (ChildKey -> ParentKey)
  // Regel: Nur Keys, die es auch wirklich in sections[] gibt (oder injected specials)
  // -------------------------------------------------------------------
  sectionParents: {

      // ✅ Breakdown children
  breakdownIssuer:   'breakdown',
  breakdownProducts: 'breakdown',
  breakdownGeneral:  'breakdown',
    // Market children
    marketTraffic: 'market',
    mvar: 'market',
    sensitivities: 'market',

    // Credit children
    creditTraffic: 'credit',
    EAD: 'credit',
    cvar: 'credit',

    // Historic Performance children
    'portfolio-value': 'PORTFOLIO_HISTORY',
    'hist-sensitivities': 'PORTFOLIO_HISTORY',
    'market-risk': 'PORTFOLIO_HISTORY',
    'credit-risk': 'PORTFOLIO_HISTORY',
  },

  // -------------------------------------------------------------------
  // ✅ Reihenfolge der Children pro Parent
  // -------------------------------------------------------------------
  sectionChildrenOrder: {

      // ✅ Breakdown children order
  breakdown: ['breakdownIssuer', 'breakdownProducts', 'breakdownGeneral'],

    market: ['marketTraffic', 'mvar', 'sensitivities'],
    credit: ['creditTraffic', 'EAD', 'cvar'],
    PORTFOLIO_HISTORY: ['portfolio-value', 'hist-sensitivities', 'market-risk', 'credit-risk'],
  },

  // -------------------------------------------------------------------
  // Plotly-DIVs, die nicht über js-plotly-plot erkannt werden
  // -------------------------------------------------------------------
  swaptionPlotlyIds: [
    'swaption-atm-surface-3d',
    'swaption-cube-surface-3d',
  ],

  // -------------------------------------------------------------------
  // Canvas-IDs für expliziten Chart-Cleanup
  // -------------------------------------------------------------------
  riskCanvasIds: [
    'riskProductYieldChart',
    'riskDurationProductYieldChart',
    'riskChart',
    'riskDurationChart',
  ],

  // -------------------------------------------------------------------
  // Breakdown Gruppierung (innerhalb breakdown)
  // -------------------------------------------------------------------
  breakdownGroups: {
    Issuer: ['issuerPieChart', 'ratingPieChart', 'rankPieChart'],
    Product: ['ratingresPieChart', 'categoryPieChart', 'coupontypePieChart'],
    General: ['depotbankPieChart'],
  },

  // -------------------------------------------------------------------
  // Defaults für Mini-Tabellen
  // -------------------------------------------------------------------
  miniTableDefaults: {
    maxRows: 8,
    maxCols: 8,
    scale: 0.78,
    fontSize: 10,
    cellPad: 2,
    maxWidth: 320,
    maxHeight: 220,
  },
};

// Convenience Aliases (wie bisher)
export const IGNORED_SECTION_TITLES = RISK_CONFIG.ignoredSectionTitles;
export const IGNORED_SECTION_KEYS   = RISK_CONFIG.ignoredSectionKeys;
export const IGNORED_TABLE_IDS      = RISK_CONFIG.ignoredTableIds;





function getSectionTitleFromPanel(panel, fallbackKey = '') {
  if (!panel) return fallbackKey || 'Section';

  // 1) Datenattribute am Panel
  const dataTitle =
    (panel.dataset && panel.dataset.title) ||
    panel.getAttribute('data-panel-title');

  if (dataTitle && dataTitle.trim()) {
    return dataTitle.trim();
  }

  // 2) Überschrift im Panel suchen
  const heading = panel.querySelector(
    '.panel-title, .sub-panel-title, h2, h3, h1'
  );
  if (heading) {
    const text = (heading.textContent || '').trim();
    if (text) return text;
  }

  // 3) Fallback aus ID / Key ableiten
  const raw = panel.id || fallbackKey || '';
  if (raw) {
    const cleaned = raw
      .replace(/^panel-/, '')     // "panel-" vorne weg
      .replace(/_Modal$/, '')     // evtl. "_Modal" weg
      .replace(/[_-]+/g, ' ')     // "_" und "-" zu Leerzeichen
      .trim();

    if (cleaned) {
      // Erste Buchstaben groß
      return cleaned.replace(/\b\w/g, c => c.toUpperCase());
    }
  }

  // 4) Letzter Fallback
  return 'Section';
}



function computeRiskLayout(chartState = {}) {
  const discovered = discoverSectionsFull();
  const sections = [];

  Object.entries(discovered).forEach(([secKey, sec]) => {
    const title = getSectionTitleFromPanel
      ? getSectionTitleFromPanel(sec.element, secKey)
      : sectionTitleFromKey(secKey);

    // ---- Section-Ignore (Meta-Panels etc.) ----
    if (IGNORED_SECTION_TITLES.includes(title?.trim())) return;
    if (IGNORED_SECTION_KEYS.includes(secKey?.trim())) return;

    const sectionEnabled = isSectionEnabled(secKey, chartState);

    // 🔥 Charts unverändert lassen
    const allCharts = sec.charts || [];

    // 🔥 Tabellen-Container filtern
    let allTables = (sec.tables || []).filter(
      t => !IGNORED_TABLE_IDS.includes(t.id)
    );

    // 🔥 Legend-Tabellen im Breakdown-Panel NICHT als "Tables" verwenden
    if (secKey === 'breakdown') {
      allTables = allTables.filter(t =>
        !/piechart-legend$/i.test(t.id)    // z.B. issuerPieChart-legend
      );
    }

    const enabledCharts = allCharts.filter(ch =>
      isChartEnabled(secKey, ch.id, chartState)
    );
    const enabledTables = allTables.filter(t =>
      isChartEnabled(secKey, `tbl-${t.id}`, chartState)
    );


    sections.push({
      key: secKey,
      title,
      element: sec.element,
      sectionEnabled,
      charts: allCharts,       // alle Charts (nichts gefiltert)
      tables: allTables,       // gefilterte Tabellen (ohne TSDataContainer)
      enabledCharts,
      enabledTables,
    });
  });

  return sections;
}



// ─────────────────────────────────────────────
// PREVIEW_SECTIONS automatisch erstellen
// ─────────────────────────────────────────────


function buildPreviewSections(chartState) {
  const layout   = computeRiskLayout(chartState);
  const sections = [];

  layout.forEach(sec => {
    const sectionControls = buildSectionControlsHTML(sec.key, chartState);
    const isOn = !!sec.sectionEnabled;

    let chartItems = [];
    let chartThumbs = [];
    let breakdownControlsHtml = '';
    let tableItems = [];
    let tableThumbs = [];

    // ─────────────────────────────────────────────
    // 🔥 BREAKDOWN PARENT: nur Container, KEIN Inhalt
    // ─────────────────────────────────────────────
    if (sec.key === 'breakdown') {
      sections.push({
        key: sec.key,
        title: sec.title,
        sectionControls,
        chartItems: [],
        tableItems: [],
        chartThumbs: [],
        tableThumbs: [],
        breakdownControlsHtml: '', // ❌ alte Darstellung weg
        hasThumbs: true,           // ❌ keine "Noch keine Thumbnails"
        sectionEnabled: isOn,
      });
      return; // ⬅️ wichtig: nichts weiter für breakdown
    }

    // ─────────────────────────────────────────────
    // 🔹 ALLE ANDEREN SECTIONS (inkl. injected Breakdown-Children)
    // ─────────────────────────────────────────────
    if (isOn) {
      // Charts
      chartItems = buildDynamicChartItems(sec.key, sec.charts, chartState);
      chartThumbs = (sec.enabledCharts || [])
        .map(ch => smartThumb(ch.id, ch.label))
        .filter(Boolean);

      // Tables
      tableItems = buildDynamicTableItems(sec.key, sec.tables, chartState);
      tableThumbs = (sec.enabledTables || [])
        .filter(t => !IGNORED_TABLE_IDS.includes(t.id))
        .map(t => miniTbl(t.id))
        .filter(Boolean);
    }

    const hasThumbs = !isOn
      ? true
      : (chartThumbs.length || tableThumbs.length);

    sections.push({
      key: sec.key,
      title: sec.title,
      sectionControls,
      chartItems,
      tableItems,
      chartThumbs,
      tableThumbs,
      breakdownControlsHtml: '', // nur Children zeigen Inhalte
      hasThumbs,
      sectionEnabled: isOn,
    });
  });

  return sections;
}




function sectionTitleFromKey(key) {
  return RISK_CONFIG.sectionTitles[key] || key;
}



// SECTION CONTROLL: 

function isSectionEnabled(sectionKey, state = {}) {
  const v = state[`${sectionKey}:__section__`];
  return (typeof v === 'boolean') ? v : true; // Default: true
}



function buildSectionControlsHTML(sectionKey, chartState = {}) {
  const domId   = `rr-section-${sectionKey}`;
  const flatKey = `${sectionKey}:__section__`;
  const checked = (chartState[flatKey] !== false) ? 'checked' : '';

  return `
    <label style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
      <input
        type="checkbox"
        id="${domId}"
        data-section-key="${sectionKey}"
        ${checked}
      >
      <span style="opacity:.85;">Include section</span>
    </label>
  `;
}





// ─────────────────────────────────────────────
// Dynamische Chart-Checkboxen pro Section
// ─────────────────────────────────────────────

function createChartCheckboxLabel(sectionKey, chartId, label, state) {
  if (!chartId) return '';
  const flatKey = chartStateFlatKey(sectionKey, chartId);
  const domId   = `rr-chart-${sectionKey}-${chartId}`;
  const checked = (state || {})[flatKey] !== false ? 'checked' : '';

  return `
    <label style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
      <input
        type="checkbox"
        id="${domId}"
        data-chart-section="${sectionKey}"
        data-chart-key="${chartId}"
        ${checked}
      >
      <span>${label}</span>
    </label>
  `;
}


// Liefert ein Array von <label>...</label>-HTML-Strings für Charts
function buildDynamicChartItems(sectionKey, charts, chartState) {
  const list = charts || [];
  if (!list.length) return [];

  return list
    .map(ch => createChartCheckboxLabel(
      sectionKey,
      ch.id,
      ch.label || ch.id,
      chartState
    ))
    .filter(Boolean);
}






// Liefert ein Array von <label>...</label>-HTML-Strings für Tables
function buildDynamicTableItems(sectionKey, tables, chartState) {
  const list = (tables || []).filter(
    t => !IGNORED_TABLE_IDS.includes(t.id)
  );
  if (!list.length) return [];

  const state = chartState || {};

  return list.map(t => {
    const tableId = t.id;
    if (!tableId) return '';
    const label   = t.label || tableId;
    const flatKey = chartStateFlatKey(sectionKey, `tbl-${tableId}`);
    const domId   = `rr-table-${sectionKey}-${tableId}`;
    const checked = state[flatKey] !== false ? 'checked' : '';

    return `
      <label style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
        <input
          type="checkbox"
          id="${domId}"
          data-chart-section="${sectionKey}"
          data-chart-key="tbl-${tableId}"
          ${checked}
        >
        <span>${label}</span>
      </label>
    `;
  }).filter(Boolean);
}

function buildBreakdownControlsWithThumbs(sectionKey, charts, enabledCharts, chartState) {
  const list = charts || [];
  if (!list.length) return '';

  const state = chartState || {};
  const byId  = new Map(list.map(ch => [ch.id, ch]));

  const enabledSet = new Set((enabledCharts || []).map(ch => ch.id));

  // ✅ Thumbs: Chart + passende Legend-MiniTable nebeneinander
  const thumbMap = new Map();
  (enabledCharts || []).forEach(ch => {
    const chartId  = ch.id;
    const label    = ch.label || chartId;
    const legendId = `${chartId}-legend`;

    const chartThumb  = smartThumb(chartId, label);
    const tableThumb  = miniTbl(legendId, {
      maxWidth: 180,
      maxHeight: 160,
      scale: 0.7,
      fontSize: 9,
    });

    let html = chartThumb;
    if (chartThumb && tableThumb) {
      html = `
        <div class="rr-thumb-pair">
          <div class="rr-thumb-pair-chart">
            ${chartThumb}
          </div>
          <div class="rr-thumb-pair-table">
            ${tableThumb}
          </div>
        </div>
      `;
    }

    if (html) thumbMap.set(chartId, html);
  });

  const groupsConfig = (RISK_CONFIG && RISK_CONFIG.breakdownGroups) || {};

  const renderCheckbox = (ch) => {
    const chartId = ch.id;
    const label   = ch.label || chartId;
    const flatKey = `${sectionKey}:${chartId}`;
    const domId   = `rr-chart-${sectionKey}-${chartId}`;
    const checked = state[flatKey] !== false ? 'checked' : '';

    return `
      <label style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
        <input
          type="checkbox"
          id="${domId}"
          data-chart-section="${sectionKey}"
          data-chart-key="${chartId}"
          ${checked}
        >
        <span>${label}</span>
      </label>
    `;
  };

  const groupsHtml = Object.entries(groupsConfig).map(([groupName, ids]) => {
    const chartsInGroup = (ids || [])
      .map(id => byId.get(id))
      .filter(Boolean);

    if (!chartsInGroup.length) return '';

    const thumbs = (ids || [])
      .filter(id => enabledSet.has(id))
      .map(id => thumbMap.get(id))
      .filter(Boolean);

    return `
      <div class="rr-breakdown-group" style="margin-top:4px;">
        <div style="
          font-size:10px;
          text-transform:uppercase;
          letter-spacing:.06em;
          opacity:.75;
          margin-bottom:2px;">
          ${groupName.toUpperCase()}
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:8px 12px;margin-bottom:${thumbs.length ? '4px' : '0'};">
          ${chartsInGroup.map(renderCheckbox).join('')}
        </div>
        ${
          thumbs.length
            ? `
              <div class="risk-chart-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;">
                ${thumbs.join('')}
              </div>
            `
            : ''
        }
      </div>
    `;
  }).join('');

  // Charts, die in keiner Gruppe hängen → "Other"
  const usedIds = new Set(
    Object.values(groupsConfig)
      .flat()
      .filter(Boolean)
  );

  const leftoverCharts = list.filter(ch => !usedIds.has(ch.id));
  const leftoverThumbs = leftoverCharts
    .map(ch => thumbMap.get(ch.id))
    .filter(Boolean);

  const leftoversHtml =
    leftoverCharts.length || leftoverThumbs.length
      ? `
        <div class="rr-breakdown-group" style="margin-top:6px;">
          <div style="
            font-size:10px;
            text-transform:uppercase;
            letter-spacing:.06em;
            opacity:.65;
            margin-bottom:2px;">
            OTHER
          </div>
          <div style="display:flex;flex-wrap:wrap;gap:8px 12px;margin-bottom:${leftoverThumbs.length ? '4px' : '0'};">
            ${leftoverCharts.map(renderCheckbox).join('')}
          </div>
          ${
            leftoverThumbs.length
              ? `
                <div class="risk-chart-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;">
                  ${leftoverThumbs.join('')}
                </div>
              `
              : ''
          }
        </div>
      `
      : '';

  return `
    <div class="rr-chart-controls" style="margin:4px 0 8px;">
      <div style="font-size:11px;opacity:.8;margin-bottom:4px">Charts:</div>
      ${groupsHtml}
      ${leftoversHtml}
    </div>
  `;
}



// === Chart-Toggle-State (pro Chart) ==========================================
const CHART_STATE_KEY = 'rr-chart-state';

// State aus localStorage laden
function loadChartToggleState() {
  try {
    return JSON.parse(localStorage.getItem(CHART_STATE_KEY) || '{}');
  } catch {
    return {};
  }
}

// State aus den DOM-Checkboxen speichern
function saveChartToggleStateFromDOM() {
  const st = {};

  // Charts + Tables
  document.querySelectorAll('input[data-chart-section][data-chart-key]').forEach(el => {
    const sec = el.dataset.chartSection;
    const key = el.dataset.chartKey;
    if (!sec || !key) return;
    st[chartStateFlatKey(sec, key)] = !!el.checked;
  });

  // Sections
  document.querySelectorAll('input[data-section-key]').forEach(el => {
    const sec = el.dataset.sectionKey;
    if (!sec) return;
    st[`${sec}:__section__`] = !!el.checked;
  });

  try { localStorage.setItem(CHART_STATE_KEY, JSON.stringify(st)); } catch {}
}


// Prüfen, ob ein Chart enabled ist (Default: true)
function isChartEnabled(section, key, state) {
  const sKey = chartStateFlatKey(section, key);
  const v = (state || {})[sKey];
  return (typeof v === 'boolean') ? v : true;
}


// Event-Wiring für diese Checkboxen
function wireChartControlsOnce() {
  const nodes = document.querySelectorAll(
    'input[data-chart-section][data-chart-key], input[data-section-key]'
  );

  // Helper: Child sections für einen Parent bestimmen (aus RISK_CONFIG)
  const getChildSectionKeys = (parentKey) => {
    const order = RISK_CONFIG?.sectionChildrenOrder?.[parentKey];
    if (Array.isArray(order) && order.length) return order;

    // Fallback: aus sectionParents ableiten
    const parents = RISK_CONFIG?.sectionParents || {};
    return Object.entries(parents)
      .filter(([child, parent]) => parent === parentKey)
      .map(([child]) => child);
  };

  nodes.forEach(el => {
    if (el.dataset.bound) return;

    el.addEventListener('change', () => {
      // ✅ Section-Checkbox geändert → Charts/Tables in der gleichen Box sync
      if (el.dataset.sectionKey) {
        const sec = el.dataset.sectionKey;
        const on  = !!el.checked;

        // 1) alle Charts/Tables innerhalb dieser risk-section setzen
        const box = el.closest('.risk-section');
        if (box) {
          box.querySelectorAll('input[data-chart-section][data-chart-key]').forEach(ch => {
            ch.checked = on;
          });
        }

        // 2) 🔥 Parent → Child-Sections mitsynchronisieren (z.B. breakdown → issuer/products/general)
        const childKeys = getChildSectionKeys(sec);
        if (childKeys && childKeys.length) {
          childKeys.forEach(childKey => {
            const childSectionCb = document.querySelector(
              `input[data-section-key="${childKey}"]`
            );
            if (!childSectionCb) return;

            childSectionCb.checked = on;

            // auch Charts/Tables innerhalb der Child-Section Box toggeln
            const childBox = childSectionCb.closest('.risk-section');
            if (childBox) {
              childBox.querySelectorAll('input[data-chart-section][data-chart-key]').forEach(ch => {
                ch.checked = on;
              });
            }
          });
        }
      }

      saveChartToggleStateFromDOM();
      try { scheduleRiskPreviewRender(); } catch {}
    });

    el.dataset.bound = '1';
  });
}



// ersetzt Debounce:
function panelVisible() {
  const p = document.getElementById('panel-reports-risk');
  return p && getComputedStyle(p).display !== 'none' && !p.hidden && !document.hidden;
}

function scheduleRiskPreviewRender() {
  if (__riskScheduled) return;
  __riskScheduled = true;

  // Throttle: war der letzte Render gerade eben?
  const since = Date.now() - __lastRenderTs;
  const delay = since < RENDER_THROTTLE_MS ? (RENDER_THROTTLE_MS - since) : 0;

  const run = () => {
    __riskRaf = 0;
    __riskIdle = 0;
    __riskScheduled = false;
    try { renderRiskPreview(); } catch (e) { console.error('[risk] render error', e); }
  };

  // Watchdog (falls rAF/idle nicht feuern)
  let ran = false;
  const wd = setTimeout(() => { if (!ran) { ran = true; run(); } }, 400 + delay);

  // Sichtbar? rAF + idle; sonst einfacher Timeout
  const start = () => {
    if (panelVisible()) {
      __riskRaf = requestAnimationFrame(() => {
        if (ran) return;
        if ('requestIdleCallback' in window) {
          __riskIdle = requestIdleCallback(() => { if (!ran) { ran = true; run(); } }, { timeout: 200 });
        } else {
          __riskIdle = setTimeout(() => { if (!ran) { ran = true; run(); } }, 50);
        }
      });
    } else {
      __riskIdle = setTimeout(() => { if (!ran) { ran = true; run(); } }, 0);
    }
  };

  // Verzögert starten, um zu drosseln
  if (delay > 0) setTimeout(start, delay);
  else start();
}

// im Teardown aufräumen:
function cancelRiskSchedules() {
  if (__riskRaf)  { cancelAnimationFrame(__riskRaf); __riskRaf = 0; }
  if (__riskIdle) {
    if (window.cancelIdleCallback) { try { cancelIdleCallback(__riskIdle); } catch {} }
    else { clearTimeout(__riskIdle); }
    __riskIdle = 0;
  }
  __riskScheduled = false;
}

// ----- Risk Preview: Chart-Cleanup Helpers -----
function destroyRiskChartByCanvas(canvas) {
  if (!canvas) return;
  try {
    // Chart.js v3+
    if (window.Chart && typeof window.Chart.getChart === 'function') {
      const inst = window.Chart.getChart(canvas);
      if (inst) inst.destroy();
    } else if (canvas.__chartInstance) {
      // Fallback: falls du Instanz selbst abgelegt hast
      try { canvas.__chartInstance.destroy(); } catch {}
      canvas.__chartInstance = null;
    }
  } catch (e) {
    console.warn('[RiskPreview] destroy chart failed for', canvas.id, e);
  }
}

function destroyAllRiskCharts() {
  const knownIds = RISK_CONFIG.riskCanvasIds || [];

  knownIds.forEach(id => {
    const c = document.getElementById(id);
    if (c) destroyRiskChartByCanvas(c);
  });

  // plus Safety-Net: alle Canvas mit "risk" im id
  document.querySelectorAll('canvas[id*="risk"]').forEach(c => destroyRiskChartByCanvas(c));
}


/** Exportiertes Teardown (wird von reports:leave aufgerufen) */
function teardownRiskPreview() {
  try {
    // Stop scheduled work
    try { cancelRiskSchedules?.(); } catch {}
    try { if (typeof clearThumbCache === 'function') clearThumbCache(); } catch {}

    // Remove global delegated listeners
    if (__riskDocDelegatedHandler) {
      try { document.removeEventListener('input',  __riskDocDelegatedHandler, true); } catch {}
      try { document.removeEventListener('change', __riskDocDelegatedHandler, true); } catch {}
    }
    __riskDocDelegatedHandler = null;

    // Button & custom-event listeners
    try { if (__riskRefreshBtn && __riskRefreshHandler) __riskRefreshBtn.removeEventListener('click', __riskRefreshHandler); } catch {}
    __riskRefreshBtn = null;
    __riskRefreshHandler = null;

    try { if (__riskDocRefreshHandler) document.removeEventListener('risk:refresh-thumbnails', __riskDocRefreshHandler); } catch {}
    __riskDocRefreshHandler = null;

    // Charts
    try { destroyAllRiskCharts?.(); } catch {}

    __riskWired = false;
  } catch (e) {
    console.warn('[RiskPreview] teardown failed', e);
  }
}


// THUMBNAILS: Mini-Helfer: aus einem Canvas ein kleines PNG bauen

const __thumbCache = new Map(); 

function clearThumbCache() {
  __thumbCache.clear();
}

function canvasThumb(id, targetWidth = 160) {
  const c = document.getElementById(id);
  if (!c) {
    // console.warn('[canvasThumb] Kein Canvas mit ID gefunden:', id);
    return '';
  }

  // 1) Größe bestimmen – zuerst echte Canvas-Größe, sonst CSS-Size als Fallback
  let srcW = c.width;
  let srcH = c.height;

  if (!srcW || !srcH) {
    const rect = c.getBoundingClientRect();
    srcW = rect.width  || 300;
    srcH = rect.height || 150;
    // console.debug('[canvasThumb] Fallback Size für', id, '→', srcW, 'x', srcH);
  }

  if (!srcW || !srcH) {
    // console.warn('[canvasThumb] Canvas hat ungültige Größe:', id, srcW, srcH);
    return '';
  }

  const key = `${id}@${srcW}x${srcH}@${targetWidth}`;
  const cached = __thumbCache.get(key);
  if (cached) return cached;

  try {
    const ratio = srcW / srcH || 1.6;
    const targetHeight = Math.round(targetWidth / ratio);

    const data = c.toDataURL('image/png');
    const html = `
      <img
        src="${data}"
        width="${targetWidth}"
        height="${targetHeight}"
        style="border:1px solid #444;border-radius:6px;background:#111;"
      />
    `.trim();

    __thumbCache.set(key, html);
    return html;
  } catch (e) {
    console.warn('[canvasThumb] toDataURL failed für', id, e);
    return '';
  }
}

function smartThumb(id, label, w = 160) {
  // ✅ Spezialfall: Plotly Swaption Surface Preview
  if (id === "swaption-atm-surface-3d") {
    const png = appState?.swaptionATMSurfacePng;
    if (png) {
      const ratio = 900 / 520;
      const h = Math.round(w / ratio);
      return `
        <img
          src="${png}"
          width="${w}"
          height="${h}"
          style="border:1px solid #444;border-radius:6px;background:#111;"
        />
      `.trim();
    }
    return `
      <div style="
        width:${w}px;min-height:60px;border:1px dashed #555;border-radius:6px;
        padding:6px;font-size:11px;color:#aaa;display:flex;align-items:center;
        justify-content:center;text-align:center;background:#111;">
        ${label || id}<br><span style="opacity:.7">Surface PNG noch nicht verfügbar</span>
      </div>
    `;
  }

  if (id === "swaption-cube-surface-3d") {
  const png = appState?.swaptionCubeSurfacePng;
  if (png) {
    const ratio = 900 / 520;
    const h = Math.round(w / ratio);
    return `
      <img
        src="${png}"
        width="${w}"
        height="${h}"
        style="border:1px solid #444;border-radius:6px;background:#111;"
      />
    `.trim();
  }
  return `
    <div style="
      width:${w}px;min-height:60px;border:1px dashed #555;border-radius:6px;
      padding:6px;font-size:11px;color:#aaa;display:flex;align-items:center;
      justify-content:center;text-align:center;background:#111;">
      ${label || id}<br><span style="opacity:.7">Cube PNG noch nicht verfügbar</span>
    </div>
  `;
}


  // Default: Canvas
  return safeThumb(id, label, w);
}

function safeThumb(id, label, w = 160) {
  const html = canvasThumb(id, w);
  if (html) return html;

  const exists = !!document.getElementById(id);
  const info = exists ? 'Canvas vorhanden, aber kein Bild' : 'Canvas nicht gefunden';

  return `
    <div style="
      width:${w}px;
      min-height:40px;
      border:1px dashed #555;
      border-radius:6px;
      padding:4px;
      font-size:11px;
      color:#aaa;
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      background:#111;
    ">
      ${label || id}<br><span style="opacity:.7">${info}</span>
    </div>
  `;
}




function buildMarketTrafficLightsSection(chartState = {}) {
  const marketPanel = document.getElementById('panel-market');
  if (!marketPanel) return null;

  const summaryRow = marketPanel.querySelector('.mvar-summary-row');
  if (!summaryRow) return null;

  const sectionOn = isSectionEnabled('marketTraffic', chartState);
  const sectionControls = buildSectionControlsHTML('marketTraffic', chartState);

  // ✅ Section OFF → NUR Include section anzeigen (Sub-Checkboxen verstecken)
  if (!sectionOn) {
    return {
      key: 'marketTraffic',
      title: 'Market Risk – Traffic Light',
      sectionControls,
      chartItems: [],
      chartThumbs: [],
      tableItems: [],
      tableThumbs: [],
      hasThumbs: true,
      isMarketTraffic: true,
    };
  }

  const clone = summaryRow.cloneNode(true);
  clone.querySelectorAll('[id]').forEach(el => {
    el.dataset.sourceId = el.id;
    el.removeAttribute('id');
  });

  const tableOn   = isChartEnabled('marketTraffic', 'tbl-mvar-es', chartState);
  const trafficOn = isChartEnabled('marketTraffic', 'traffic-mvar', chartState);

  // ✅ Tabelle: robust → erste Tabelle im Clone
  const tbl = clone.querySelector('table');
  const tblWrap = tbl
    ? (tbl.closest?.('.data-container, .table-wrap, .mvar-table') || tbl)
    : null;

  // ✅ Ampel: NUR die Ampel toggeln
  const node = clone.querySelector(`[data-source-id="traffic-mvar"]`);
  const trafficWrap = node ? (node.closest?.('.traffic-light') || node) : null;

  // ✅ Sub-Checkboxen
  const chartItems = [
    createChartCheckboxLabel('marketTraffic', 'tbl-mvar-es', 'Market VaR/ES (Table)', chartState),
    createChartCheckboxLabel('marketTraffic', 'traffic-mvar', 'Traffic Light', chartState),
  ].filter(Boolean);

  // ✅ HTML getrennt ziehen (damit Flex-Layout sauber ist)
  const tableHtml   = (tableOn && tblWrap)     ? tblWrap.outerHTML     : '';
  const trafficHtml = (trafficOn && trafficWrap) ? trafficWrap.outerHTML : '';

  // Wenn beides aus → keine Thumbs (Checkboxen bleiben sichtbar)
  const bodyHtml = (tableHtml || trafficHtml) ? `
    <div class="risk-market-trafficlights"
         style="display:flex;align-items:flex-start;gap:24px;margin-top:10px;">

      <div style="flex:1;max-width:360px;">
        <div style="font-size:12px;opacity:.75;margin-bottom:6px;">
          Market VaR / ES – Traffic Light
        </div>
        ${tableHtml}
      </div>

      <div style="
        flex:0 0 auto;
        display:${trafficHtml ? 'flex' : 'none'};
        align-items:center;
        justify-content:center;
        padding-top:18px;
        transform: scale(0.72);
        transform-origin: top center;
      ">
        ${trafficHtml}
      </div>

    </div>
  ` : '';

  return {
    key: 'marketTraffic',
    title: 'Market Risk – Traffic Light',
    sectionControls,
    chartItems,
    chartThumbs: bodyHtml ? [bodyHtml] : [],
    tableItems: [],
    tableThumbs: [],
    hasThumbs: true,
    isMarketTraffic: true,
  };
}

function buildCreditTrafficLightsSection(chartState = {}) {
  const creditPanel = document.getElementById('panel-credit');
  if (!creditPanel) return null;

  const trafficRow = creditPanel.querySelector('.cvar-pair');
  if (!trafficRow) return null;

  const sectionOn = isSectionEnabled('creditTraffic', chartState);
  const sectionControls = buildSectionControlsHTML('creditTraffic', chartState);

  // Section OFF → nur Checkbox, sonst nichts
  if (!sectionOn) {
    return {
      key: 'creditTraffic',
      title: 'Credit Risk – Traffic Lights',
      sectionControls,
      chartItems: [],
      chartThumbs: [],
      tableItems: [],
      tableThumbs: [],
      hasThumbs: true,
      isCreditTraffic: true,
    };
  }

  const clone = trafficRow.cloneNode(true);
  clone.querySelectorAll('[id]').forEach(el => {
    el.dataset.sourceId = el.id;
    el.removeAttribute('id');
  });

  const cvarOn = isChartEnabled('creditTraffic', 'traffic-credit-cvar', chartState);
  const tsiOn  = isChartEnabled('creditTraffic', 'traffic-credit-tsi',  chartState);
  const msdOn  = isChartEnabled('creditTraffic', 'traffic-credit-msd',  chartState);

  const setVis = (sourceId, on) => {
    const node = clone.querySelector(`[data-source-id="${sourceId}"]`);
    if (!node) return;
    const wrapper =
      node.closest?.('.traffic-light, .traffic-item, .cvar-item, .metric, .pair, .ampel')
      || node.parentElement
      || node;
    wrapper.style.display = on ? '' : 'none';
  };

  setVis('traffic-credit-cvar', cvarOn);
  setVis('traffic-credit-tsi',  tsiOn);
  setVis('traffic-credit-msd',  msdOn);

  const chartItems = [
    createChartCheckboxLabel('creditTraffic', 'traffic-credit-cvar', 'CVaR', chartState),
    createChartCheckboxLabel('creditTraffic', 'traffic-credit-tsi',  'TSI',  chartState),
    createChartCheckboxLabel('creditTraffic', 'traffic-credit-msd',  'MSD',  chartState),
  ].filter(Boolean);

  const trafficHtml = `
    <div class="risk-credit-trafficlights" style="margin-top:8px;">
      <div style="font-size:12px;opacity:.75;margin-bottom:6px;">
        CVaR / TSI / MSD Ampeln (Credit Risk)
      </div>
      ${clone.outerHTML}
    </div>
  `;

  return {
    key: 'creditTraffic',
    title: 'Credit Risk – Traffic Lights',
    sectionControls,          // ✅ nur Section Checkbox
    chartItems,               // ✅ Ampel Checkboxen
    chartThumbs: [trafficHtml], // ✅ Ampel-Block kommt NACH den Checkboxen
    tableItems: [],
    tableThumbs: [],
    hasThumbs: true,
    isCreditTraffic: true,
  };
}

function applySectionHierarchy(sections) {
  const parents = (RISK_CONFIG && RISK_CONFIG.sectionParents) || {};
  const orderByParent = (RISK_CONFIG && RISK_CONFIG.sectionChildrenOrder) || {};

  // Index maps
  const byKey = new Map();
  sections.forEach((s, i) => {
    if (!s?.key) return;
    byKey.set(s.key, { sec: s, idx: i });
  });

  // Build children lists
  const childrenMap = new Map(); // parentKey -> array of child keys
  const childKeys = new Set();

  Object.entries(parents).forEach(([childKey, parentKey]) => {
    if (!byKey.has(childKey) || !byKey.has(parentKey)) return;
    childKeys.add(childKey);
    if (!childrenMap.has(parentKey)) childrenMap.set(parentKey, []);
    childrenMap.get(parentKey).push(childKey);
  });

  // Helper: stable unique
  const uniq = (arr) => {
    const out = [];
    const seen = new Set();
    for (const x of arr) {
      if (!x || seen.has(x)) continue;
      seen.add(x);
      out.push(x);
    }
    return out;
  };

  // Sort children per parent
  for (const [parentKey, childList] of childrenMap.entries()) {
    const configured = orderByParent[parentKey] || [];
    const configuredFiltered = configured.filter(k => childList.includes(k));

    // Remaining children keep original order from sections[]
    const remaining = childList
      .filter(k => !configuredFiltered.includes(k))
      .sort((a, b) => (byKey.get(a)?.idx ?? 0) - (byKey.get(b)?.idx ?? 0));

    childrenMap.set(parentKey, uniq([...configuredFiltered, ...remaining]));
  }

  // Build final flat list with levels
  const out = [];
  for (const s of sections) {
    if (!s?.key) continue;

    // skip children at top-level
    if (childKeys.has(s.key)) continue;

    out.push({ ...s, __level: 1, __isChild: false });

    const kids = childrenMap.get(s.key) || [];
    for (const ck of kids) {
      const child = byKey.get(ck)?.sec;
      if (!child) continue;
      out.push({ ...child, __level: 2, __isChild: true, __parentKey: s.key });
    }
  }

  return out;
}





//RENDER:========================================================================================================RENDER===========================================

function renderRiskPreview() {
  if (__riskRendering) return;

  const wrap  = document.getElementById('reportsRiskPreview');
  if (!wrap) return;

  const panel = document.getElementById('panel-reports-risk');
  if (!panel) return;

  __riskRendering = true;
  try {
    clearThumbCache?.();

    const chartState = loadChartToggleState?.() || {};
    let sections     = buildPreviewSections(chartState) || [];

    // ✅ Inject Breakdown child sections (Issuer / Products / General)
    sections = injectBreakdownChildren(sections, chartState) || sections;

    // ─────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────
    const norm = (s) =>
      String(s || '')
        .toLowerCase()
        .replace(/\s+/g, ' ')
        .trim();

    const removeWhere = (pred) => {
      for (let i = sections.length - 1; i >= 0; i--) {
        if (pred(sections[i])) sections.splice(i, 1);
      }
    };

    const dedupeByKeyPrefer = (preferFn) => {
      const map = new Map();
      for (const s of sections) {
        const key = s?.key;
        if (!key) continue;
        if (!map.has(key)) {
          map.set(key, s);
        } else {
          const keep = preferFn(map.get(key), s);
          map.set(key, keep);
        }
      }
      // preserve original order by walking sections and picking kept instance once
      const seen = new Set();
      const out = [];
      for (const s of sections) {
        const key = s?.key;
        const kept = key ? map.get(key) : s;
        if (key) {
          if (seen.has(key)) continue;
          seen.add(key);
          out.push(kept);
        } else {
          out.push(kept);
        }
      }
      sections = out;
    };

    const insertBeforeTitleMatch = (newSec, matcherFn) => {
      const idx = sections.findIndex(matcherFn);
      if (idx >= 0) sections.splice(idx, 0, newSec);
      else sections.push(newSec);
    };

    // ─────────────────────────────────────────────
    // 1) CREDIT – remove any auto-discovered duplicates
    // ─────────────────────────────────────────────
    removeWhere(sec => {
      const t = norm(sec?.title);
      const k = sec?.key;
      if (k === 'creditTraffic') return true;
      if (t.includes('credit') && t.includes('traffic') && t.includes('light')) return true;
      return false;
    });

    // 2) Insert the dedicated credit traffic section
    const creditTrafficSection = buildCreditTrafficLightsSection(chartState);
    if (creditTrafficSection) {
      insertBeforeTitleMatch(
        creditTrafficSection,
        sec => {
          const t = norm(sec?.title);
          return t.includes('credit') && t.includes('loss');
        }
      );
    }

    // ─────────────────────────────────────────────
    // 3) MARKET – ONLY necessary changes here:
    //    - remove accidental dupes (as before)
    //    - insert specifically BEFORE "Market Profit/Loss distribution"
    // ─────────────────────────────────────────────
    removeWhere(sec => {
      const t = norm(sec?.title);
      const k = sec?.key;
      if (k === 'marketTraffic') return true;
      if (t.includes('market') && t.includes('traffic') && t.includes('light')) return true;
      return false;
    });

    const marketTrafficSection = buildMarketTrafficLightsSection(chartState);
    if (marketTrafficSection) {
      insertBeforeTitleMatch(
        marketTrafficSection,
        sec => {
          const t = norm(sec?.title);

          // Anchor: Market Profit/Loss distribution (robust variants)
          const isMarket = t.includes('market');
          const isPL =
            t.includes('profit/loss') ||
            t.includes('profit loss') ||
            t.includes('p/l') ||
            (t.includes('profit') && t.includes('loss')) ||
            (t.includes('loss') && t.includes('distribution'));

          return isMarket && isPL;
        }
      );
    }

    // ─────────────────────────────────────────────
    // 4) HARD DEDUPE BY KEY (unchanged)
    // ─────────────────────────────────────────────
    dedupeByKeyPrefer((a, b) => {
      const aSpecial = !!(a?.isCreditTraffic || a?.isMarketTraffic);
      const bSpecial = !!(b?.isCreditTraffic || b?.isMarketTraffic);
      if (aSpecial !== bSpecial) return bSpecial ? b : a;

      const score = (s) =>
        (s?.chartThumbs?.length || 0) +
        (s?.tableThumbs?.length || 0) +
        (s?.chartItems?.length || 0) +
        (s?.tableItems?.length || 0) +
        (s?.breakdownControlsHtml ? 10 : 0);

      return score(b) >= score(a) ? b : a;
    });

    // ✅ HIER: nach Insert + Dedupe die Hierarchie anwenden
    sections = applySectionHierarchy(sections);


    // ─────────────────────────────────────────────
    // Render HTML (unchanged)
    // ─────────────────────────────────────────────
    wrap.innerHTML = `
      <div style="padding:10px">

        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
          <button id="rr-all-on"
                  style="padding:6px 10px;border-radius:8px;border:1px solid #444;background:#1a1a1a;color:#ddd;cursor:pointer;">
            Select all
          </button>
          <button id="rr-all-off"
                  style="padding:6px 10px;border-radius:8px;border:1px solid #444;background:#1a1a1a;color:#ddd;cursor:pointer;">
            Deselect all
          </button>
          <span style="opacity:.7;font-size:12px;margin-left:auto;">Preview Controls</span>
        </div>

        ${sections.map(sec => `
          <div class="risk-section">
            <div class="risk-section__title"
     style="
       padding-left:${sec.__level === 2 ? '18px' : '0'};
       opacity:${sec.__level === 2 ? '0.92' : '1'};
       font-size:${sec.__level === 2 ? '12px' : '13px'};
     ">
  ${sec.__level === 2 ? '↳ ' : ''}${sec.title}
</div>


            <div class="risk-section__row">
              <div class="risk-section__label">Section</div>
              <div class="risk-section__controls">
                ${sec.sectionControls || ''}
              </div>
            </div>

            ${
              ((sec.chartItems?.length) ||
               (sec.chartThumbs?.length) ||
               sec.breakdownControlsHtml)
                ? `
                  <div class="risk-section__row risk-section__row--deep">
                    <div class="risk-section__label">Charts</div>
                    <div class="risk-section__controls">
                      ${
                        sec.breakdownControlsHtml
                          ? sec.breakdownControlsHtml
                          : `
                            ${
                              sec.chartItems?.length
                                ? `
                                  <div class="rr-chart-controls">
                                    <div style="font-size:11px;opacity:.8;margin-bottom:4px">Charts:</div>
                                    <div style="display:flex;flex-wrap:wrap;gap:10px;">
                                      ${sec.chartItems.join('')}
                                    </div>
                                  </div>
                                `
                                : ''
                            }
                            ${
                              sec.chartThumbs?.length
                                ? `
                                  <div class="risk-chart-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">
                                    ${sec.chartThumbs.join('')}
                                  </div>
                                `
                                : ''
                            }
                          `
                      }
                    </div>
                  </div>
                `
                : ''
            }

            ${
              (sec.tableItems?.length || sec.tableThumbs?.length)
                ? `
                  <div class="risk-section__row risk-section__row--deep">
                    <div class="risk-section__label">Tables</div>
                    <div class="risk-section__controls">
                      ${
                        sec.tableItems?.length
                          ? `
                            <div class="rr-table-controls">
                              <div style="font-size:11px;opacity:.8;margin-bottom:4px">Tables:</div>
                              <div style="display:flex;flex-wrap:wrap;gap:10px;">
                                ${sec.tableItems.join('')}
                              </div>
                            </div>
                          `
                          : ''
                      }
                      ${
                        sec.tableThumbs?.length
                          ? `
                            <div class="risk-table-thumbs" style="display:flex;flex-wrap:wrap;gap:8px;margin-top:4px;">
                              ${sec.tableThumbs.join('')}
                            </div>
                          `
                          : ''
                      }
                    </div>
                  </div>
                `
                : ''
            }

            ${
              !sec.hasThumbs
                ? `<div style="opacity:.65;font-size:12px;margin:6px 0 0 0.8rem;">
                     (Noch keine Thumbnails – Daten laden/Panel rendern)
                   </div>`
                : ''
            }
          </div>
        `).join('')}

      </div>
    `;

    wireChartControlsOnce?.();
  } catch (err) {
    console.error('[RiskPreview] ERROR in renderRiskPreview', err);
  } finally {
    __lastRenderTs  = Date.now();
    __riskRendering = false;
  }
}


// WIRE:==============================================================================================================WIRE

export function wireRiskPreview(force = false) {
  if (force) { try { teardownRiskPreview(); } catch {} }
  if (__riskWired && !force) return;
  __riskWired = true;

  const scheduleSafe = () => { try { scheduleRiskPreviewRender(); } catch (e) { console.error(e); } };

  // --- 1) Globaler, erzwungener Delegations-Mechanismus ---
  const evtTypes = ['input', 'change', 'click', 'keyup', 'pointerup'];
__riskDocDelegatedHandler = (ev) => {
  if (__riskRendering) return;
  const t = ev.target;

  // ✅ Global Buttons
  if (t && t.id === 'rr-all-on')  { setAllRRCheckboxes(true);  return; }
  if (t && t.id === 'rr-all-off') { setAllRRCheckboxes(false); return; }

  const isRiskCtl = !!(t && t.id && t.id.startsWith('rr-'));
  const inRiskPanel = !!t?.closest?.('#panel-reports-risk');
  if (!isRiskCtl && !inRiskPanel) return;
  scheduleSafe();
};


  try { evtTypes.forEach(tp => document.addEventListener(tp, __riskDocDelegatedHandler, true)); } catch {}

  // --- 2) KICK: alle Controls synthetisch triggern + rendern ---
  const kick = () => {
    const panel = document.getElementById('panel-reports-risk');
    // wenn Panel existiert, trigger dort gezielt, sonst global (failsafe)
    const sel = panel ? '#panel-reports-risk [id^="rr-"]' : '[id^="rr-"]';
    const ctrls = document.querySelectorAll(sel);
    ctrls.forEach(el => {
      try { el.dispatchEvent(new Event('input',  { bubbles: true })); } catch {}
      try { el.dispatchEvent(new Event('change', { bubbles: true })); } catch {}
    });
    scheduleSafe();
  };

  // --- 3) Sichtbarkeitswechsel → sofort Kick ---
  try {
    document.addEventListener('visibilitychange', () => {
      if (!document.hidden) {
        // falls Scheduler "klemmt": entsperren
        if (__riskScheduled && !__riskRaf && !__riskIdle) __riskScheduled = false;
        kick();
      }
    }, true);
  } catch {}

  // REPORTS-Tab-Klick → Kick (falls Tabbar so benannt)
  try {
    const reportsBtn = document.getElementById('REPORTS_Tab');
    if (reportsBtn) {
      const onClickReports = () => setTimeout(kick, 0);
      reportsBtn.addEventListener('click', onClickReports, true);
      // nicht in __riskRefreshBtn speichern, das ist für den Refresh-Button reserviert
    }
  } catch {}

  // Optional: Refresh-Thumbnails (falls vorhanden)
  const refreshBtn = document.getElementById('refreshThumbnailsBtn');
  if (refreshBtn) {
    __riskRefreshBtn = refreshBtn;
    __riskRefreshHandler = (e) => {
      const fn = window.handleRefreshThumbnailsClick
        || (typeof handleRefreshThumbnailsClick === 'function' ? handleRefreshThumbnailsClick : null);
      if (!fn) return;
      try { fn(e); } catch (err) { console.warn('[risk preview] refresh handler error', err); }
      try { if (typeof clearThumbCache === 'function') clearThumbCache(); } catch {}
      setTimeout(kick, 0);
    };
    try { refreshBtn.addEventListener('click', __riskRefreshHandler, true); } catch {}
  }

  // Externes Custom-Refresh
  __riskDocRefreshHandler = () => {
    try { if (typeof clearThumbCache === 'function') clearThumbCache(); } catch {}
    kick();
  };
  try { document.addEventListener('risk:refresh-thumbnails', __riskDocRefreshHandler, true); } catch {}

  // --- 4) MutationObserver: sobald rr-* Controls (wieder) im DOM → Kick ---
  try {
const panel = document.getElementById('panel-reports-risk') || document.body;
if (__riskControlsMO) { try { __riskControlsMO.disconnect(); } catch {} }
__riskControlsMO = new MutationObserver((ml) => {
  if (__riskRendering) return; // keine Reaktion während Render

  for (const m of ml) {
    for (const n of (m.addedNodes || [])) {
      if (n.nodeType !== 1) continue;

      // Änderungen innerhalb der Preview ignorieren (eigener Rebuild)
      if (n.closest && n.closest('#reportsRiskPreview')) continue;

      const isRR = (n.id && n.id.startsWith('rr-')) || n.querySelector?.('[id^="rr-"]');
      if (isRR) {
        setTimeout(() => { try { scheduleRiskPreviewRender(); } catch {} }, 0);
        return;
      }
    }
  }
});
__riskControlsMO.observe(panel, { childList: true, subtree: true });

  } catch {}


}

// Zentrale Defaults für alle Mini-Tabellen
const MINI_TABLE_DEFAULTS = RISK_CONFIG.miniTableDefaults;



// Komfort-Wrapper
const miniTbl = (id, overrides = {}) =>
  miniTableFromContainer(id, { ...MINI_TABLE_DEFAULTS, ...overrides });

function miniTableFromContainer(
  containerId,
  {
    maxRows   = MINI_TABLE_DEFAULTS.maxRows,
    maxCols   = MINI_TABLE_DEFAULTS.maxCols,
    scale     = MINI_TABLE_DEFAULTS.scale,
    fontSize  = MINI_TABLE_DEFAULTS.fontSize,
    cellPad   = MINI_TABLE_DEFAULTS.cellPad,
    maxWidth  = MINI_TABLE_DEFAULTS.maxWidth,
    maxHeight = MINI_TABLE_DEFAULTS.maxHeight,
  } = {}
) {
  const host = document.getElementById(containerId);
  if (!host) return '';

  const table =
    host.tagName && host.tagName.toLowerCase() === 'table'
      ? host               // 🔹 Legend-Tabellen selbst
      : host.querySelector('table'); // 🔹 klassische data-container

  if (!table) return '';

  // Header ermitteln
  let ths  = Array.from(table.querySelectorAll('thead th')).slice(0, maxCols);
  let rows = Array.from(table.querySelectorAll('tbody tr'));

  if (!ths.length) {
    const allRows = rows.length ? rows : Array.from(table.querySelectorAll('tr'));
    if (allRows.length) {
      const firstCells = Array.from(allRows[0].children).slice(0, maxCols);
      ths = firstCells.map(c => {
        const th = document.createElement('th');
        th.textContent = c.textContent || '';
        return th;
      });
      rows = allRows.slice(1); // erste Zeile war headerähnlich
    }
  }

  const headLabels  = ths.map(th => (th.textContent || '').trim());
  const limitedRows = (rows.length ? rows : Array.from(table.querySelectorAll('tr'))).slice(0, maxRows);

  if (!headLabels.length && !limitedRows.length) return '';

  const headHTML = headLabels.length
    ? `<thead><tr>${
        headLabels.map(lbl => `
          <th style="padding:${cellPad}px ${cellPad + 1}px; border:1px solid #555; text-align:left;">
            ${lbl}
          </th>`).join('')
      }</tr></thead>`
    : '';

  // 🔧 Helfer: Zellinhalt extrahieren (mit Farb- & Radio-Unterstützung)
  const renderCell = (td, colIndex) => {
    // 1) Farb-Swatch in der ersten Spalte (Legendenspalte)
    if (colIndex === 0) {
      let color = '';

      // a) bevorzugt Kind-Element mit data-color oder eigener backgroundColor
      const swatchEl =
        td.querySelector('[data-color]') ||
        td.querySelector('.color-swatch') ||
        td.firstElementChild;

      if (swatchEl) {
        color = (swatchEl.dataset && swatchEl.dataset.color) || swatchEl.style?.backgroundColor || '';
        if (!color) {
          try {
            const cs = getComputedStyle(swatchEl);
            if (cs &&
                cs.backgroundColor &&
                cs.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
                cs.backgroundColor !== 'transparent') {
              color = cs.backgroundColor;
            }
          } catch {}
        }
      }

      // b) Fallback: Hintergrund der Zelle selbst
      if (!color) {
        try {
          const csTd = getComputedStyle(td);
          if (csTd &&
              csTd.backgroundColor &&
              csTd.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
              csTd.backgroundColor !== 'transparent') {
            color = csTd.backgroundColor;
          }
        } catch {}
      }

      if (color) {
        return `
          <span style="
            display:inline-block;
            width:10px;
            height:10px;
            border-radius:2px;
            background:${color};
            border:1px solid rgba(255,255,255,0.25);
          "></span>
        `;
      }
    }

    // 2) Radio?
    const radios = td.querySelectorAll('input[type="radio"]');
    if (radios.length) {
      const checked = Array.from(radios).some(r => r.checked);
      return `<span aria-label="${checked ? 'selected' : 'not selected'}"
                   title="${checked ? 'selected' : 'not selected'}">
                ${checked ? '●' : '○'}
              </span>`;
    }

    // 3) Optional: Checkboxen (falls du sie irgendwann brauchst)
    const cbs = td.querySelectorAll('input[type="checkbox"]');
    if (cbs.length) {
      const checked = Array.from(cbs).some(cb => cb.checked);
      return checked ? '✓' : '';
    }

    // 4) Sonst normaler Text
    return (td.textContent || '').trim();
  };

  const bodyHTML = limitedRows.map(tr => {
    const tds = Array.from(tr.children).slice(0, maxCols);
    return `<tr>${
      tds.map((td, idx) => {
        const isSelectCol =
          (headLabels[idx] && headLabels[idx].toLowerCase() === 'select') ||
          td.querySelector('input[type="radio"]');
        const align = isSelectCol ? 'center' : 'left';
        return `
          <td style="padding:${cellPad}px ${cellPad + 1}px; border:1px solid #333; text-align:${align};">
            ${renderCell(td, idx)}
          </td>`;
      }).join('')
    }</tr>`;
  }).join('');

  const innerWidthPct = Math.round(100 / (scale || 1));

  return `
    <div class="mini-table-wrap"
         style="
          max-width:${maxWidth}px;
          ${maxHeight ? `max-height:${maxHeight}px;` : ''}
          overflow:auto;
          border:1px solid #444;
          border-radius:6px;
          background:#111;">
      <div style="
           transform:scale(${scale});
           transform-origin: top left;
           width:${innerWidthPct}%;">

        <table style="
               border-collapse:collapse;
               font-size:${fontSize}px;
               color:#ddd;
               white-space:nowrap;
               background:#111;">
          ${headHTML}
          <tbody>${bodyHTML}</tbody>
        </table>

      </div>
    </div>
  `;
}



// RiskPDFPreview.js
document.addEventListener('reports:enter', () => {
  try { wireRiskPreview(); } catch (e) { console.error(e); }
  
});

document.addEventListener('reports:leave', () => {
  try { teardownRiskPreview?.(); } catch (e) { console.error(e); }
});




function setAllRRCheckboxes(checked) {
  const panel = document.getElementById('panel-reports-risk') || document;

  // ✅ Sections jetzt MIT togglen
  panel.querySelectorAll('input[data-section-key]').forEach(el => {
    el.checked = !!checked;
  });

  // ✅ Charts + Tables togglen
  panel.querySelectorAll('input[data-chart-section][data-chart-key]').forEach(el => {
    el.checked = !!checked;
  });

  saveChartToggleStateFromDOM();
  try { scheduleRiskPreviewRender(); } catch {}
}


// ─────────────────────────────────────────────
// Export: Aktives Layout für Risk-PDF
// ─────────────────────────────────────────────

export function getActiveRiskSectionsForPdf() {
  const chartState = loadChartToggleState?.() || {};
  const layout     = computeRiskLayout(chartState) || [];

  // Helper: Section-Toggle respektieren (Default: true)
  const isSectionOn = (key) => {
    const v = chartState[`${key}:__section__`];
    return (typeof v === 'boolean') ? v : true;
  };

  // 1) Standard-Sections wie bisher (nur mit Charts/Tables)
  //    + SPEZIAL: Breakdown-Legend-Tabellen für das PDF ergänzen
  const sections = layout
    .filter(sec => isSectionOn(sec.key)) // ✅ Section Checkbox wirkt im PDF
    .filter(sec =>
      (sec.enabledCharts && sec.enabledCharts.length) ||
      (sec.enabledTables && sec.enabledTables.length)
    )
    .map(sec => {
      const enabledCharts = sec.enabledCharts || [];
      let enabledTables   = sec.enabledTables ? [...sec.enabledTables] : [];

      // 🔹 SPEZIALFALL: Breakdown – Legend-Tabellen explizit fürs PDF dazunehmen
      if (sec.key === 'breakdown') {
        const groups = (RISK_CONFIG && RISK_CONFIG.breakdownGroups) || {};
        const existingIds = new Set(enabledTables.map(t => t.id));

        Object.entries(groups).forEach(([groupName, ids]) => {
          (ids || []).forEach(chartId => {
            const legendId = `${chartId}-legend`;
            if (existingIds.has(legendId)) return;

            enabledTables.push({
              id: legendId,
              label: `${groupName} Breakdown`,
            });
          });
        });
      }

      return {
        key: sec.key,
        title: sec.title,
        enabledCharts,
        enabledTables,
        isCreditTraffic: false,
        isMarketTraffic: false,
      };
    });

  // 2) CREDIT – Traffic-Lights-Section (mit Einzel-Ampel-Toggles)
  const hasCreditTrafficDom =
    typeof document !== 'undefined' && (
      document.getElementById('traffic-credit-cvar') ||
      document.getElementById('traffic-credit-tsi')  ||
      document.getElementById('traffic-credit-msd')
    );

  if (hasCreditTrafficDom && isSectionOn('creditTraffic')) {
    const enabledCharts = [];

    // ✅ Einzel-Checkboxen respektieren (Default true)
    if (isChartEnabled('creditTraffic', 'traffic-credit-cvar', chartState)) {
      enabledCharts.push({ id: 'traffic-credit-cvar', label: 'CVaR' });
    }
    if (isChartEnabled('creditTraffic', 'traffic-credit-tsi', chartState)) {
      enabledCharts.push({ id: 'traffic-credit-tsi', label: 'TSI' });
    }
    if (isChartEnabled('creditTraffic', 'traffic-credit-msd', chartState)) {
      enabledCharts.push({ id: 'traffic-credit-msd', label: 'MSD' });
    }

    // Wenn alle drei abgewählt sind: Section nicht ins PDF aufnehmen
    if (enabledCharts.length) {
      const creditTrafficSection = {
        key: 'creditTraffic',
        title: 'Credit Risk – Traffic Lights',
        enabledCharts,
        enabledTables: [],
        isCreditTraffic: true,
        isMarketTraffic: false,
      };

      const insertIdx = sections.findIndex(sec =>
        typeof sec.title === 'string' &&
        /credit/i.test(sec.title) &&
        /loss/i.test(sec.title)
      );

      if (insertIdx >= 0) sections.splice(insertIdx, 0, creditTrafficSection);
      else sections.push(creditTrafficSection);
    }
  }

  // 3) MARKET – Traffic-Light-Section (mit Toggle)
  const hasMarketTrafficDom =
    typeof document !== 'undefined' &&
    document.getElementById('traffic-mvar');

  if (hasMarketTrafficDom && isSectionOn('marketTraffic')) {
    const enabledCharts = [];

    if (isChartEnabled('marketTraffic', 'traffic-mvar', chartState)) {
      enabledCharts.push({ id: 'traffic-mvar', label: 'Market VaR/ES' });
    }

    // Wenn abgewählt: Section nicht ins PDF aufnehmen
    if (enabledCharts.length) {
      const marketTrafficSection = {
        key: 'marketTraffic',
        title: 'Market Risk – Traffic Light',
        enabledCharts,
        enabledTables: [],
        isCreditTraffic: false,
        isMarketTraffic: true,
      };

      const insertIdx = sections.findIndex(sec =>
        typeof sec.title === 'string' &&
        /market/i.test(sec.title) &&
        /profit/i.test(sec.title)
      );

      if (insertIdx >= 0) sections.splice(insertIdx, 0, marketTrafficSection);
      else sections.push(marketTrafficSection);
    }
  }

  return sections;
}


// ─────────────────────────────────────────────
// Export: Preset State anwenden + Preview neu rendern
// ─────────────────────────────────────────────

export function applyRiskPresetState(state = {}, { forceRender = false } = {}) {
  try {
    const st = (state && typeof state === 'object') ? state : {};

    // 1) Single Source of Truth
    try { localStorage.setItem(CHART_STATE_KEY, JSON.stringify(st)); } catch {}

    // 2) Wenn Controls existieren: direkt setzen (UI konsistent)
    const panel = document.getElementById('panel-reports-risk') || document;

    panel.querySelectorAll('input[data-chart-section][data-chart-key]').forEach(el => {
      const sec = el.dataset.chartSection;
      const key = el.dataset.chartKey;
      const v = st[`${sec}:${key}`];
      el.checked = (typeof v === 'boolean') ? v : true;
    });

    panel.querySelectorAll('input[data-section-key]').forEach(el => {
      const sec = el.dataset.sectionKey;
      const v = st[`${sec}:__section__`];
      el.checked = (typeof v === 'boolean') ? v : true;
    });

    // 3) Thumbs neu + Preview neu bauen (dein Bugfix)
    try { clearThumbCache(); } catch {}
    try { scheduleRiskPreviewRender(); } catch {}

    // 4) Zweiter Pass (Canvas/Plotly manchmal 1 Frame später fertig)
    requestAnimationFrame(() => {
      try { clearThumbCache(); } catch {}
      try { scheduleRiskPreviewRender(); } catch {}
    });

    // 5) Notfall: sofort rendern (selten nötig)
    if (forceRender) {
      try { renderRiskPreview(); } catch {}
    }
  } catch (e) {
    console.warn('[RiskPreview] applyRiskPresetState failed', e);
  }
}

// REPORTS/riskPreviewEvents.js
export function notifyRiskPreview(source) {
  try {
    document.dispatchEvent(
      new CustomEvent('risk:refresh-thumbnails', {
        detail: { source }
      })
    );
  } catch (e) {
    console.warn('[RiskPreview] risk:refresh-thumbnails dispatch failed', e);
  }
}









