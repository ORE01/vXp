
import { handleIRSensData } from '../ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioPV01Handler.js';
import { handleCSSensData } from '../ANALYSE_PORTFOLIO/marketRisk/sensitivities/portfolioCPV01Handler.js';
// Cross-module DOM access goes through the capture adapter (single source of
// truth for where Breakdown/Market/Credit render their charts & traffic lights).
import {
  getBreakdownPanel,
  getMarketPanel,
  getCreditPanel,
  hasCreditTrafficDom,
  hasMarketTrafficDom,
} from './captureAdapter.js';
// Lazy-Panels (Market Data, Analyse …) materialisieren, damit der Report ihren
// Inhalt erfassen kann, ohne dass man die Tabs vorher manuell öffnet.
import { renderAllRegisteredPanels } from '../../core/routing/panelOrchestrator.js';
// Liquidity-Dashboard vor der Erfassung in den by-category-Zustand bringen (Chart
// nach Kategorie + Cash-Flow-Pivot), damit es im Report immer so erscheint.
import { prepareLiquidityDashboardForReport } from '../ANALYSE_PORTFOLIO/liquidityDashboard.js';
// Credit-Overview-Charts (Loss distribution + Tail zoom) vor der Erfassung rendern,
// damit sie im Report erscheinen, ohne dass man das Overview-Panel vorher oeffnet.
import { renderCreditOverviewCharts } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/creditRiskDashboard.js';

// Materialisiert ALLE Report-Quellen aus dem Store, ohne dass Tabs/Panels offen
// sein müssen. Durchgängig: Lazy-Panels (Registry) + RISK-Charts, die nicht an
// der Registry hängen (MVaR Factors/Products via appState.refreshMarketRiskUI).
// Report-eigenes "Select Portfolio"-Dropdown: spiegelt createdPortDropdown0
// (die zentrale Portfolio-Auswahl). Bei Auswahl wird die zentrale Auswahl gesetzt
// + deren change-Event gefeuert (treibt die Pipeline), danach der Report neu
// materialisiert. So muss man zum Portfolio-Wechsel nicht den RISK-Tab öffnen.
let __reportDropdownBound = false;
function syncReportPortfolioDropdown() {
  const src = document.getElementById('createdPortDropdown0');
  const dst = document.getElementById('createdPortDropdownReport');
  if (!src || !dst) return;

  dst.innerHTML = src.innerHTML; // gleiche Optionsliste
  dst.value = src.value;         // aktuelle Auswahl spiegeln

  if (!__reportDropdownBound) {
    __reportDropdownBound = true;
    dst.addEventListener('change', () => {
      const s = document.getElementById('createdPortDropdown0');
      if (s && s.value !== dst.value) {
        s.value = dst.value;
        s.dispatchEvent(new Event('change', { bubbles: true })); // treibt Pipeline
      }
      // Daten werden NICHT automatisch geladen — der Nutzer klickt danach
      // "Get Risk Data", um die Vorschau für das gewählte Portfolio zu füllen.
    });
  }
}

// Report-Portfolio-Auswahl HART in die zentrale Auswahl (createdPortDropdown0)
// schreiben und deren input/change-Events feuern, BEVOR der Warmup rendert. Sonst
// bleibt selectedPort=null und refreshMarketRiskUI() bricht ab.
function syncReportPortfolioSelectionToMain() {
  const reportSel = document.getElementById('createdPortDropdownReport');
  const mainSel   = document.getElementById('createdPortDropdown0');

  const reportValue = reportSel?.value || '';
  if (!reportValue || !mainSel) {
    console.warn('[RiskPreview] cannot sync report portfolio selection', {
      reportValue,
      hasReportDropdown: !!reportSel,
      hasMainDropdown: !!mainSel,
      mainValue: mainSel?.value || null,
    });
    return false;
  }

  if (mainSel.value !== reportValue) {
    mainSel.value = reportValue;
  }

  // Zentralen Port-State HART setzen — refreshMarketRiskUI() liest
  // getSelectedPortTableName(); falls der change-Handler nicht (synchron) greift,
  // bleibt selectedPort sonst null und Market/Credit rendert nicht.
  try { window.appState?.setSelectedPortTableName?.(reportValue); } catch {}

  try { mainSel.dispatchEvent(new Event('input',  { bubbles: true })); } catch {}
  try { mainSel.dispatchEvent(new Event('change', { bubbles: true })); } catch {}

  console.log('[RiskPreview] synced report portfolio selection', {
    reportValue,
    mainValue: mainSel.value,
    selectedPortTableName: window.appState?.getSelectedPortTableName?.(),
  });

  return true;
}

function warmUpReportSources() {
  const as = window.appState;
  // 1) Lazy-Panels (Market Data, Historic) materialisieren.
  try { renderAllRegisteredPanels(); } catch (e) { console.warn('[RiskPreview] warmup panels failed', e); }
  // 2) Market-VaR (Factors/Products) aus dem Store rendern.
  try { as?.refreshMarketRiskUI?.(0); } catch (e) { console.warn('[RiskPreview] warmup market risk failed', e); }
  // 3) Credit-Risk (EAD/LGD, CVaR/ES) aus dem Store rendern — die Credit-Handler
  //    haben keinen eigenen Store-Refresh, daher hier aus den Stores einspeisen.
  try {
    const ead = as?.getAllEADData?.();
    if (ead && ead.length) (as?.handleEADData || window.handleEADData)?.(ead);
  } catch (e) { console.warn('[RiskPreview] warmup EAD failed', e); }
  try {
    const cvar = as?.getCvarData?.();
    if (cvar && cvar.length) (as?.handleCVaRData || window.handleCVaRData)?.(cvar, 0);
  } catch (e) { console.warn('[RiskPreview] warmup CVaR failed', e); }

  console.log('[RiskPreview warmup]', {
    hasAppState: !!window.appState,
    hasRefreshMarketRiskUI: typeof window.appState?.refreshMarketRiskUI,
    reportPortfolioValue: document.getElementById('createdPortDropdownReport')?.value,
    mainPortfolioValue: document.getElementById('createdPortDropdown0')?.value,
    marketPanel: !!getMarketPanel?.(),
    creditPanel: !!getCreditPanel?.(),
    marketSummaryRow: !!getMarketPanel?.()?.querySelector?.('.mvar-summary-row'),
    creditTrafficRow: !!getCreditPanel?.()?.querySelector?.('.cvar-pair'),
    mvarContainer: !!document.getElementById('MVaRDataContainer0'),
    cvarContainer: !!document.getElementById('CVaRDataContainer0'),
    irSens: !!document.getElementById('IRSensDataContainer'),
    csSens: !!document.getElementById('CSSensDataContainer'),
  });
}



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

// Accordion-Navigation der Preview: welche Sektion ist gerade offen (über
// Re-Renders hinweg gemerkt) + Guard, damit der Klick-Listener nur 1× bindet.
let __riskActiveSecId = '';
// Set der aufgeklappten Nav-Gruppen-IDs (beliebige Tiefe). null = noch nie
// gesetzt (→ Default: Vorfahren der aktiven Sektion auf); danach User-gesteuert.
let __riskExpandedKeys = null;
let __riskNavBound = false;
// Nach dem Laden eines Reports: beim nächsten Render alle Gruppen aufklappen,
// die eine aktivierte (checked) Section enthalten, und einmal zur ersten
// aktivierten Sektion scrollen.
let __riskExpandCheckedOnce = false;
let __riskScrollActiveOnce = false;

// "Include all"-Bulk: pro Gruppen-Key die State-Keys aller Nachkommen (Sections/
// Untergruppen) + die Chart-Prefixe (zum Entfernen einzelner Chart-Overrides).
// Sowie die Gesamtlisten für die globalen Buttons "Select all / Deselect all".
// Werden bei jedem Render aus der Hierarchie neu aufgebaut.
let __riskGroupBulk = new Map();
let __riskAllSectionKeys = [];
let __riskAllGroupKeys = [];

// "Get Risk Data"-Statusanzeige (Executing… + roter Punkt → grün), analog zu den
// Run/Calculate-Risk-Buttons. Der Punkt wird beim Klick rot, das "fertig"-Signal
// ist das risk:refresh-thumbnails-Event. Mindest-Anzeigedauer, damit der Zustand
// sichtbar ist (die Arbeit läuft teils synchron).
const GET_RISK_MIN_BUSY_MS = 700;
let __getRiskBusyT0 = 0;
let __getRiskDoneTimer = 0;
let __getRiskFailSafe = 0;

function getRiskDataEls() {
  return {
    btn: document.getElementById('refreshThumbnailsBtn'),
    dot: document.getElementById('riskDotGetData'),
  };
}
function setGetRiskDataBusy() {
  const { btn, dot } = getRiskDataEls();
  __getRiskBusyT0 = Date.now();
  clearTimeout(__getRiskDoneTimer);
  clearTimeout(__getRiskFailSafe);
  if (dot) { dot.classList.remove('is-done'); dot.classList.add('is-busy'); dot.title = 'executing…'; }
  if (btn) {
    if (!btn.dataset.label) btn.dataset.label = (btn.textContent || 'Get Risk Data').trim();
    btn.disabled = true;
    btn.textContent = 'Executing…';
  }
  __getRiskFailSafe = setTimeout(applyGetRiskDataDone, 8000); // Notausstieg
}
function setGetRiskDataDone() {
  const wait = Math.max(0, GET_RISK_MIN_BUSY_MS - (Date.now() - __getRiskBusyT0));
  clearTimeout(__getRiskDoneTimer);
  __getRiskDoneTimer = setTimeout(applyGetRiskDataDone, wait);
}
function applyGetRiskDataDone() {
  clearTimeout(__getRiskFailSafe);
  const { btn, dot } = getRiskDataEls();
  if (dot) { dot.classList.remove('is-busy'); dot.classList.add('is-done'); dot.title = 'done'; }
  if (btn) { btn.disabled = false; btn.textContent = btn.dataset.label || 'Get Risk Data'; }
}
// Führt fn NACH dem nächsten Paint aus (doppeltes rAF), damit der vorher gesetzte
// Busy-Zustand sofort sichtbar wird, bevor die (teils synchrone) Arbeit blockiert.
function afterPaint(fn) {
  requestAnimationFrame(() => requestAnimationFrame(() => {
    try { fn(); } catch (e) { console.error('[risk] afterPaint', e); }
  }));
}

//Report Title//
const RISK_REPORT_TITLE_KEY = 'rr-report-title';

export function setActiveRiskReportTitle(title) {
  const t = String(title || '').trim();
  try { localStorage.setItem(RISK_REPORT_TITLE_KEY, t); } catch {}
  return t;
}

export function getActiveRiskReportTitle() {
  try { return String(localStorage.getItem(RISK_REPORT_TITLE_KEY) || '').trim(); }
  catch { return ''; }
}


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
    // NEU: kundenweite CUSTOMER-SETUP-Settings (Market-Risk-Limits /
    // Credit-Risk-Thresholds). Eigener Container-Stil (.customer-mr-limits), aber
    // genauso report-relevant wie .data-container — portfolio-UNABHÄNGIG.
    ...panel.querySelectorAll('.customer-mr-limits[id]'),
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
  // 1) Wenn es keinen Breakdown-Parent gibt: nichts tun
  const hasBreakdown = sections.some(s => s.key === 'breakdown');
  if (!hasBreakdown) return sections;

  // 2) Welche Breakdown-Children sollen injected werden? -> aus Config
  const childKeys = RISK_CONFIG?.sectionChildrenOrder?.breakdown || [];
  if (!Array.isArray(childKeys) || childKeys.length === 0) return sections;

  const existing = new Set(sections.map(s => s?.key).filter(Boolean));

  // 3) Alle Breakdown-Charts aus dem DOM holen (einmal)
  const breakdownPanel = getBreakdownPanel();
  const breakdownCharts = breakdownPanel ? discoverChartsFromPanel(breakdownPanel) : [];

  // byId: chartId -> chartMeta
  const byId = new Map(breakdownCharts.map(ch => [ch.id, ch]));

  // 4) Helper: childKey -> groupName, rein aus Config (fallback: aus Key ableiten)
  // Erwartung: breakdownIssuer -> "Issuer", breakdownProducts -> "Products" oder "Product" (siehe unten)
  const resolveGroupName = (childKey) => {
    // a) explizite Zuordnung, falls du das in die Config packen willst
    const explicit = RISK_CONFIG?.breakdownChildToGroup?.[childKey];
    if (explicit) return explicit;

    // b) heuristisch: "breakdown" prefix strippen, Rest TitleCase
    // breakdownIssuer -> Issuer, breakdownGeography -> Geography
    const rest = String(childKey).replace(/^breakdown/, '');
    if (!rest) return null;

    // "Products" bleibt "Products"; du kannst aber in Config bewusst "Product" nutzen.
    return rest.charAt(0).toUpperCase() + rest.slice(1);
  };

  // 5) Inject: in der Reihenfolge aus sectionChildrenOrder.breakdown
  const injected = childKeys
    .filter(childKey => !existing.has(childKey))
    .map(childKey => {
      const groupName = resolveGroupName(childKey);

      // IDs der Charts, die zu dieser Group gehören: aus breakdownGroups
      // WICHTIG: breakdownGroups muss den groupName als Key haben
      const ids = (groupName && RISK_CONFIG?.breakdownGroups?.[groupName]) ? RISK_CONFIG.breakdownGroups[groupName] : [];

      const chartsInGroup = Array.isArray(ids)
        ? ids.map(id => byId.get(id)).filter(Boolean)
        : [];

      const sectionOn = isSectionEnabled(childKey, chartState);

      // enabledCharts: hier entscheidest du, ob du nur "sichtbare" Thumbs willst
      const enabledCharts = chartsInGroup.filter(ch =>
        isChartEnabled(childKey, ch.id, chartState)
      );

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
        title: sectionTitleFromKey(childKey),            // kommt aus RISK_CONFIG.sectionTitles
        sectionControls: buildSectionControlsHTML(childKey, chartState),
        chartItems: [],
        chartThumbs: [],
        tableItems: [],
        tableThumbs: [],
        breakdownControlsHtml,
        hasThumbs: true,
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
    // Credit-Kennzahlen: erscheinen bereits als "CVaR / TSI / MSD Ampeln"-Block
    // (creditTraffic) und werden fuers PDF ueber die CVaR/TSI/MSD-Checkboxen als
    // Tabellen ergaenzt (siehe getActiveRiskSectionsForPdf). Hier ausblenden, damit
    // sie NICHT zusaetzlich als doppelte, schmucklose "Tables:"-Checkboxen auftauchen.
    'CVaR_allRelativeContainer0',
    'creditTsiTableContainer0',
    'creditMsdTableContainer0',
    // Market-Kennzahlen: erscheinen als "Market VaR / ES – Traffic Light"-Block und
    // werden fuers PDF ueber die Ampel-Checkbox (tbl-mvar-es) als Tabelle ergaenzt.
    // Hier ausblenden, damit kein doppelter "Tables:"-Eintrag entsteht.
    'MVaRDataContainer0',
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

    // ===== Market Data (synthetischer Parent; Children = echte MD-Panels) =====
    marketData: 'Market Data',

    // ✅ Injected Breakdown Children (künstliche Sections)
    breakdownIssuer: 'Issuer',
    breakdownProducts: 'Products',
    breakdownGeneral: 'General',
    breakdownGeography: 'Geography',

    // ===== Performance (optional, falls du dieses Panel wirklich hast) =====
    performance: 'Performance',

    // ===== Market (Parent + Children) =====
    market: 'Market Risk',
    marketTraffic: 'Market Risk — Traffic Light', // injected special section (key = marketTraffic)
    mvar: 'Market Risk — VaR Details', // panel-mvar -> "mvar"
    sensitivities: 'Market Risk — Sensitivities', // panel-sensitivities -> "sensitivities"

    // ===== Credit (Parent + Children) =====
    credit: 'Credit Risk', // panel-credit -> "credit"
    creditTraffic: 'Credit Risk — Traffic Lights', // injected special section (key = creditTraffic)
    EAD: 'Credit Risk — EAD / LGD / PD', // panel-EAD -> "EAD"
    cvar: 'Credit Risk — VaR & ES', // panel-cvar -> "cvar"

    // ===== Historic Performance (Parent + Children) =====
    // PORTFOLIO_HISTORY_Modal -> "PORTFOLIO_HISTORY"
    PORTFOLIO_HISTORY: 'Historic Performance',
    'portfolio-value': 'Portfolio Value', // panel-portfolio-value -> "portfolio-value"
    'hist-sensitivities': 'Historical Sensitivities', // panel-hist-sensitivities -> "hist-sensitivities"
    'market-risk': 'Historic Market Risk', // panel-market-risk -> "market-risk"
    'credit-risk': 'Historic Credit Risk', // panel-credit-risk -> "credit-risk"

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
    breakdownIssuer: 'breakdown',
    breakdownProducts: 'breakdown',
    breakdownGeneral: 'breakdown',
    breakdownGeography: 'breakdown',

    // Market Data: DYNAMISCH (alle Sub-Panels im #MARKETDATA_Modal).
    // RISK (Market/Credit/History + Untergruppen): DYNAMISCH aus dem Trigger-DOM
    //   (#ANALYSE_Modal .risk-acc) — siehe buildRiskHierarchy(). NICHT hier
    //   hartcodieren, sonst weicht der Report von den RISK-Triggern ab.
  },

  // -------------------------------------------------------------------
  // ✅ Reihenfolge der Children pro Parent
  // -------------------------------------------------------------------
  sectionChildrenOrder: {
    // ✅ Breakdown children order
    breakdown: [
      'breakdownIssuer',
      'breakdownProducts',
      'breakdownGeneral',
      'breakdownGeography',
    ],

    // marketData + RISK-Reihenfolgen: dynamisch (siehe applySectionHierarchy).
  },

  // -------------------------------------------------------------------
  // Nicht-Canvas-Chartcontainer (DIVs), die als Chart erkannt werden sollen.
  // Heute HTML-Heatmap-Tabellen (kein Plotly mehr) → Erfassung via HTML-Snapshot
  // in smartThumb(). Label kommt aus data-label am Element.
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

    // ✅ NEU: Geography (IDs müssen exakt zu `${columnName.toLowerCase()}PieChart` passen)
    // Empfohlen: nutze die "Issuer..." Keys aus deiner v_Portfolios_enriched
    Geography: [
      'issuerregionPieChart',       // IssuerRegion
      'issuercountrynamePieChart',  // IssuerCountryName
      'issueriseuPieChart',         // IssuerIsEU
      'issueriseuroPieChart',       // IssuerIsEuro
      'issueriseeaPieChart',        // IssuerIsEEA
      'issuerisoecdPieChart',       // IssuerIsOECD
    ],
  },

  breakdownChildToGroup: {
  breakdownIssuer:   'Issuer',
  breakdownProducts: 'Product',     // oder 'Products' – aber dann überall konsistent
  breakdownGeneral:  'General',
  breakdownGeography:'Geography',
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
        .map(ch => { const th = smartThumb(ch.id, ch.label); return th ? thumbWithNoteHtml(ch.id, th) : ''; })
        .filter(Boolean);

      // Tables
      tableItems = buildDynamicTableItems(sec.key, sec.tables, chartState);
      tableThumbs = (sec.enabledTables || [])
        .filter(t => !IGNORED_TABLE_IDS.includes(t.id))
        .map(t => {
          // Per-Tabelle-Override: data-max-cols am Element (z.B. breite Pivot-Tabellen).
          const el = document.getElementById(t.id);
          const mc = Number(el?.dataset?.maxCols);
          const ov = (Number.isFinite(mc) && mc > 0) ? { maxCols: mc } : {};
          const th = miniTbl(t.id, ov);
          return th ? thumbWithNoteHtml(t.id, th) : '';
        })
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

// Opt-in-Modell: Default AUS. Eine Section ist nur im Report, wenn ihr Toggle
// (direkt oder via "Include all" der Gruppe) explizit auf true gesetzt wurde.
function isSectionEnabled(sectionKey, state = {}) {
  const v = state[`${sectionKey}:__section__`];
  return (typeof v === 'boolean') ? v : false; // Default: aus
}



// Master-Checkbox einer Gruppe (Tab/Untergruppe) – steht rechts in der "Section"-
// Zeile, identisch platziert wie "Include section". AUS = ganzer Teilbaum fliegt
// aus dem Report.
function buildGroupControlsHTML(groupKey, chartState = {}) {
  const domId   = `rr-group-${groupKey}`;
  const checked = (chartState[`${groupKey}:__group__`] === true) ? 'checked' : '';

  return `
    <label style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
      <input
        type="checkbox"
        id="${domId}"
        data-rr-group-toggle="${groupKey}"
        ${checked}
      >
      <span style="opacity:.85;">Include all</span>
    </label>
  `;
}


function buildSectionControlsHTML(sectionKey, chartState = {}) {
  const domId   = `rr-section-${sectionKey}`;
  const flatKey = `${sectionKey}:__section__`;
  const checked = (chartState[flatKey] === true) ? 'checked' : ''; // Opt-in: Default aus

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
    // WICHTIG: kanonischer Key (chartStateFlatKey), identisch zu save/isChartEnabled.
    // Sonst (roher Key) ist der State immer undefined → Box lässt sich nicht abhaken.
    const flatKey = chartStateFlatKey(sectionKey, chartId);
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

// === Tabellen-Notizen (pro Tabellen-Container-Id) ============================
// Freitext, der im PDF rechts neben der jeweiligen Tabelle gedruckt wird. Eigener
// localStorage-Key, damit saveChartToggleStateFromDOM() (baut rr-chart-state neu
// auf) sie NICHT ueberschreibt. Beim Report-Save werden sie mit ins Preset gebuendelt.
const TABLE_NOTES_KEY = 'rr-table-notes';
function loadTableNotes() {
  try { return JSON.parse(localStorage.getItem(TABLE_NOTES_KEY) || '{}'); } catch { return {}; }
}
function saveTableNote(tableId, text) {
  if (!tableId) return;
  const n = loadTableNotes();
  if (text && String(text).trim()) n[tableId] = String(text); else delete n[tableId];
  try { localStorage.setItem(TABLE_NOTES_KEY, JSON.stringify(n)); } catch {}
}
// Vom PDF-Export gelesen (RiskPDF.js).
export function getTableNote(tableId) {
  return String(loadTableNotes()[tableId] || '');
}
// Notiz-Textarea (Preview) fuer eine Tabelle; Wert vorbefuellt.
function noteTextareaHtml(tableId) {
  const val = String(loadTableNotes()[tableId] || '');
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  return `<textarea class="rr-note-input" data-note-for="${tableId}" placeholder="Notiz…" rows="3"
      style="width:100%;box-sizing:border-box;font-size:11px;padding:4px;border:1px solid var(--border);border-radius:4px;resize:vertical;">${esc(val)}</textarea>`;
}
// Tabellen-Thumbnail links + Notiz-Textbox rechts (spiegelt das PDF-Layout).
function thumbWithNoteHtml(tableId, thumbHtml) {
  return `<div class="rr-thumb-with-note" style="display:flex;gap:8px;align-items:flex-start;flex:1 1 100%;">
      <div style="flex:0 0 auto;">${thumbHtml}</div>
      <div style="flex:1 1 40%;min-width:140px;">${noteTextareaHtml(tableId)}</div>
    </div>`;
}
// Delegierter input-Listener (einmalig): speichert Notizen OHNE Re-Render, damit
// beim Tippen kein Fokus verloren geht.
let __tableNotesBound = false;
function wireTableNotesOnce() {
  if (__tableNotesBound) return;
  const root = document.getElementById('reportsRiskPreview') || document;
  root.addEventListener('input', (e) => {
    const ta = e.target;
    if (ta && ta.classList && ta.classList.contains('rr-note-input')) {
      saveTableNote(ta.dataset.noteFor, ta.value);
    }
  });
  __tableNotesBound = true;
}

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

  // Gruppen-Master-Checkboxen (Tabs/Untergruppen): AUS = ganzer Teilbaum aus.
  document.querySelectorAll('input[data-rr-group-toggle]').forEach(el => {
    const key = el.dataset.rrGroupToggle;
    if (!key) return;
    st[`${key}:__group__`] = !!el.checked;
  });

  try { localStorage.setItem(CHART_STATE_KEY, JSON.stringify(st)); } catch {}
}


// Prüfen, ob ein Chart enabled ist (Default: true)
// Default eines Charts ohne expliziten State: er FOLGT seiner Section (Opt-in).
// Traffic-Charts hängen an der jeweiligen Overview (market/credit).
function chartDefaultEnabled(section, chartKey, state) {
  if (section === 'marketTraffic') return isSectionEnabled('market', state);
  if (section === 'creditTraffic') return isSectionEnabled('credit', state);
  const canon = canonicalChartSection(section, chartKey); // breakdown* → breakdown
  return isSectionEnabled(canon, state);
}

function isChartEnabled(section, key, state) {
  const sKey = chartStateFlatKey(section, key);
  const v = (state || {})[sKey];
  if (typeof v === 'boolean') return v;
  return chartDefaultEnabled(section, key, state);
}


// Event-Wiring für diese Checkboxen
function wireChartControlsOnce() {
  const nodes = document.querySelectorAll(
    'input[data-chart-section][data-chart-key], input[data-section-key], input[data-rr-group-toggle]'
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
      // ✅ Gruppen-Master "Include all": ganzer Teilbaum an/aus. State-basiert,
      //    weil Charts ausgeschalteter Sektionen NICHT im DOM stehen.
      if (el.dataset.rrGroupToggle) {
        const G  = el.dataset.rrGroupToggle;
        const on = !!el.checked;
        const st = loadChartToggleState();
        const bulk = __riskGroupBulk.get(G) || { keys: [], prefixes: new Set() };

        // 1) Einzelne Chart/Table-Overrides der Nachkommen entfernen → Charts
        //    erben wieder den (neuen) Section-Status (alle an bzw. alle aus).
        for (const k of Object.keys(st)) {
          const i = k.lastIndexOf(':');
          if (i < 0) continue;
          const suf = k.slice(i + 1);
          if (suf === '__section__' || suf === '__group__') continue;
          if (bulk.prefixes.has(k.slice(0, i))) delete st[k];
        }

        // 2) Alle Nachkommen-Sections + Untergruppen + die Gruppe selbst setzen.
        st[`${G}:__group__`] = on;
        bulk.keys.forEach(k => { st[k] = on; });

        try { localStorage.setItem(CHART_STATE_KEY, JSON.stringify(st)); } catch {}
        try { scheduleRiskPreviewRender(); } catch {}
        return;
      }

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
        style="border:1px solid var(--border);border-radius:6px;background:var(--surface-card);"
      />
    `.trim();

    __thumbCache.set(key, html);
    return html;
  } catch (e) {
    console.warn('[canvasThumb] toDataURL failed für', id, e);
    return '';
  }
}

// Erkennbarer, inhaltstragender Chart-Content innerhalb eines Elements:
// Tabellen/SVG (Swaption-Heatmaps) oder DOM-Charts (Balken-Divs, z. B. das
// Product-VaR-Panel rendert einen DOM-Chart statt eines Canvas).
const SNAPSHOT_CONTENT_SELECTOR = 'table, svg, .mvar-product-dom-chart, [class*="dom-chart"]';
// Nur DOM-CHARTS (nicht beliebige Tabellen) — für die Canvas-Placeholder-Erkennung:
// manche Panels rendern einen DOM-Chart NEBEN einem ausgeblendeten Canvas.
const DOM_CHART_SELECTOR = '.mvar-product-dom-chart, [class*="dom-chart"]';

// HTML-Snapshot eines (Nicht-Canvas-)Chartcontainers. Skaliert den gerenderten
// Inhalt in eine Thumbnail-Box. Liefert '' wenn kein echter Inhalt da ist.
function htmlSnapshotThumb(el, w = 160) {
  if (!el) return '';
  const content = el.matches?.(SNAPSHOT_CONTENT_SELECTOR)
    ? el
    : el.querySelector?.(SNAPSHOT_CONTENT_SELECTOR);
  if (!content) return '';

  const scale = 0.4;
  const boxH = Math.round(w * 0.72);
  return `
    <div style="width:${w}px;max-height:${boxH}px;overflow:hidden;border:1px solid var(--border);border-radius:6px;background:var(--surface-card);">
      <div style="transform:scale(${scale});transform-origin:top left;width:${Math.round(100 / scale)}%;pointer-events:none;">
        ${content.outerHTML}
      </div>
    </div>`.trim();
}

function smartThumb(id, label, w = 160) {
  const el = document.getElementById(id);

  if (el && el.tagName === 'CANVAS') {
    // Manche Panels rendern einen DOM-Chart NEBEN einem ausgeblendeten Canvas
    // (z. B. Product VaR: canvas.style.display='none' + .mvar-product-dom-chart).
    // Der Canvas ist dann nur Platzhalter → den DOM-Chart snapshotten.
    // (canvasThumb würde sonst ein leeres 300×150-Bild liefern.)
    const domChart = el.parentElement?.querySelector?.(DOM_CHART_SELECTOR);
    if (domChart) {
      const snap = htmlSnapshotThumb(domChart, w);
      if (snap) return snap;
    }
    // Sonst: echtes Canvas-Bild (Chart.js).
    return safeThumb(id, label, w);
  }

  // Nicht-Canvas-Chartcontainer (z. B. Swaption-Heatmap-Tabellen) → HTML-Snapshot.
  if (el) {
    const snap = htmlSnapshotThumb(el, w);
    if (snap) return snap;
  }

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
      border:1px dashed var(--border);
      border-radius:6px;
      padding:4px;
      font-size:11px;
      color:var(--text-muted);
      display:flex;
      align-items:center;
      justify-content:center;
      text-align:center;
      background:var(--surface-card);
    ">
      ${label || id}<br><span style="opacity:.7">${info}</span>
    </div>
  `;
}




function buildMarketTrafficLightsSection(chartState = {}) {
  const marketPanel = getMarketPanel();
  console.log('[RiskPreview marketTraffic]', {
    marketPanel,
    marketPanelId: marketPanel?.id,
    hasSummaryRow: !!marketPanel?.querySelector?.('.mvar-summary-row'),
    hasMVaRDataContainer0: !!document.getElementById('MVaRDataContainer0'),
    allMvarContainers: [...document.querySelectorAll('[id*="MVaR"], [id*="mvar"]')].map(el => el.id),
  });
  if (!marketPanel) return null;

  const summaryRow = marketPanel.querySelector('.mvar-summary-row');
  if (!summaryRow) return null;

  const sectionOn =
    isSectionEnabled('market', chartState) ||
    isSectionEnabled('marketTraffic', chartState);

const sectionControls = buildSectionControlsHTML('market', chartState);

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
        ${tableOn ? `<div style="margin-top:8px;">
          <div style="font-size:10px;opacity:.7;margin-bottom:2px;">Notiz (im PDF neben der Tabelle)</div>
          ${noteTextareaHtml('MVaRDataContainer0')}
        </div>` : ''}
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
  const creditPanel = getCreditPanel();
  console.log('[RiskPreview creditTraffic]', {
    creditPanel,
    creditPanelId: creditPanel?.id,
    hasCvarPair: !!creditPanel?.querySelector?.('.cvar-pair'),
    hasCVaRDataContainer0: !!document.getElementById('CVaRDataContainer0'),
    allCreditContainers: [...document.querySelectorAll('[id*="CVaR"], [id*="cvar"], [id*="credit"], [id*="Credit"]')].map(el => el.id),
  });
  if (!creditPanel) return null;

  const trafficRow = creditPanel.querySelector('.cvar-pair');
  if (!trafficRow) return null;

  const sectionOn =
    isSectionEnabled('credit', chartState) ||
    isSectionEnabled('creditTraffic', chartState);

  const sectionControls = buildSectionControlsHTML('credit', chartState);

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

  // Notiz-Textboxen fuer die 3 Credit-Tabellen (kommen ueber den Ampel-Block, nicht
  // ueber die generischen Tabellen-Thumbnails -> hier separat). Gleiche Keys wie die
  // Container-Ids, damit der PDF-Export sie neben der Tabelle druckt.
  // Nur fuer die aktuell angehakten Kennzahlen eine Notizbox (gleiche Gate wie die
  // Tabellen-Sichtbarkeit); Key = Container-Id -> vom PDF neben der Tabelle gedruckt.
  const creditNoteBoxes = [
    ['CVaR_allRelativeContainer0', 'CVaR', 'traffic-credit-cvar'],
    ['creditTsiTableContainer0',   'TSI',  'traffic-credit-tsi'],
    ['creditMsdTableContainer0',   'MSD',  'traffic-credit-msd'],
  ]
    .filter(([, , ck]) => isChartEnabled('creditTraffic', ck, chartState))
    .map(([id, lbl]) =>
      `<div style="flex:1;min-width:140px;">
         <div style="font-size:10px;opacity:.7;margin-bottom:2px;">${lbl} – Notiz (im PDF neben der Tabelle)</div>
         ${noteTextareaHtml(id)}
       </div>`
    ).join('');

  const trafficHtml = `
    <div class="risk-credit-trafficlights" style="margin-top:8px;">
      <div style="font-size:12px;opacity:.75;margin-bottom:6px;">
        CVaR / TSI / MSD Ampeln (Credit Risk)
      </div>
      ${clone.outerHTML}
      ${creditNoteBoxes ? `<div style="display:flex;gap:8px;margin-top:8px;">${creditNoteBoxes}</div>` : ''}
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


// ─────────────────────────────────────────────────────────────────────────
// RISK-Hierarchie GENERISCH aus dem Trigger-DOM ableiten (keine Hardcodierung):
// die .risk-acc-Gruppen in #ANALYSE_Modal definieren Haupt/Sub/Sub-Sub. Gruppen-
// Toggles (ohne data-panel) werden synthetische Gruppen-Knoten; Blätter mappen
// über data-panel auf ihre Panel-Keys. Bei Änderungen an den RISK-Triggern
// folgt der Report automatisch.
// ─────────────────────────────────────────────────────────────────────────
function parseRiskAccNode(el) {
  const keyFromBtn = (btn) => {
    const p = btn?.getAttribute('data-panel') || btn?.getAttribute('aria-controls') || '';
    return p ? p.replace(/^panel-/, '').replace(/[_-]?Modal$/i, '') : null;
  };
  const labelOf = (btn) => btn?.querySelector('.section-header')?.textContent?.trim() || '';

  const toggle = el.querySelector(':scope > button.section-trigger');
  const node = { key: keyFromBtn(toggle), label: labelOf(toggle), children: [] };

  const body = el.querySelector(':scope > .risk-acc-body');
  if (body) {
    for (const child of Array.from(body.children)) {
      if (child.matches?.('.risk-acc')) {
        node.children.push(parseRiskAccNode(child));
      } else if (child.matches?.('button.section-trigger')) {
        node.children.push({ key: keyFromBtn(child), label: labelOf(child), children: [] });
      }
    }
  }
  return node;
}

function getRiskTriggerTree() {
  const modal = document.getElementById('ANALYSE_Modal');
  if (!modal) return [];
  const roots = [];
  modal.querySelectorAll('.risk-acc.risk-section').forEach(el => {
    if (el.parentElement?.closest('.risk-acc')) return; // nur Top-Level (Rest via Rekursion)
    roots.push(parseRiskAccNode(el));
  });
  return roots;
}

// Tab-Beschriftung aus dem Tab-Button lesen (nicht hardcoden).
function tabLabel(tabId, fallback) {
  return ((document.getElementById(tabId)?.textContent) || fallback).trim() || fallback;
}

// .chart-section/.chart-section--sub-Adjazenz (MARKET DATA, ANALYSE) → Trigger-
// Baum. Ein Haupt-.chart-section startet eine Gruppe; folgende .chart-section--sub
// sind ihre Kinder. (Nur Trigger-Ebene; Panels selbst werden übersprungen.)
function parseChartSectionTree(modalId) {
  const modal = document.getElementById(modalId);
  if (!modal) return [];
  const keyOf = (sec) => {
    const btn = sec.querySelector(':scope > button.section-trigger');
    const p = btn?.getAttribute('data-panel') || btn?.getAttribute('aria-controls') || '';
    return p ? p.replace(/^panel-/, '').replace(/[_-]?Modal$/i, '') : null;
  };
  const labelOf = (sec) => sec.querySelector(':scope > button.section-trigger .section-header')?.textContent?.trim() || '';

  const secs = Array.from(modal.querySelectorAll('.chart-section')).filter(s => !s.closest('.sub-panel'));
  const roots = [];
  let current = null;
  for (const sec of secs) {
    const node = { key: keyOf(sec), label: labelOf(sec), children: [] };
    if (!node.key && !node.label) continue; // Aktions-Buttons etc. überspringen
    if (sec.classList.contains('chart-section--sub') && current) current.children.push(node);
    else { roots.push(node); current = node; }
  }
  return roots;
}

// GENERISCH: Trigger-Baum (roots) → { parents, order, groupNodes, labels },
// gewurzelt unter einem Tab-Knoten. Knoten OHNE data-panel werden synthetische
// Gruppen-Knoten (pfad-stabiler Key); Knoten MIT data-panel mappen auf ihr Panel
// (und dürfen zugleich Kinder haben → z. B. Volatilities → Swaption*).
function buildHierarchyFromTree(roots, { tabKey, tabTitle, prefix }) {
  const slug = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'group';
  const parents = {}, order = {}, labels = {}, groupNodes = [];

  const walk = (node, parentKey) => {
    let key = node.key;
    if (!key) {
      key = (parentKey ? parentKey + '__' : prefix + '__') + slug(node.label);
      groupNodes.push({ key, title: node.label || 'Group' });
    }
    if (node.label) labels[key] = node.label;
    if (parentKey) parents[key] = parentKey;
    if (node.children?.length) order[key] = node.children.map(ch => walk(ch, key));
    return key;
  };

  if (!roots.length) return { parents, order, groupNodes, labels };
  groupNodes.push({ key: tabKey, title: tabTitle });
  labels[tabKey] = tabTitle;
  order[tabKey] = roots.map(r => walk(r, tabKey));
  return { parents, order, groupNodes, labels };
}

// RISK-Trigger (#ANALYSE_Modal .risk-acc) → Hierarchie unter Tab "RISK".
function buildRiskHierarchy() {
  return buildHierarchyFromTree(getRiskTriggerTree(), {
    tabKey: 'tab__risk', tabTitle: tabLabel('RISK_Tab', 'RISK'), prefix: 'risk',
  });
}

// MARKET-DATA-Trigger (#MARKETDATA_Modal .chart-section) → Hierarchie unter Tab
// "MARKET DATA". Spiegelt die echte Verschachtelung (Volatilities → Swaption*,
// Interest Rates → Forward, Scenarios → …) automatisch.
function buildMarketDataHierarchy() {
  return buildHierarchyFromTree(parseChartSectionTree('MARKETDATA_Modal'), {
    tabKey: 'marketData', tabTitle: tabLabel('MARKETDATA_Tab', 'Market Data'), prefix: 'md',
  });
}


function applySectionHierarchy(sections) {
  const uniq = (arr) => {
    const out = []; const seen = new Set();
    for (const x of arr) { if (!x || seen.has(x)) continue; seen.add(x); out.push(x); }
    return out;
  };

  // Hierarchie-Quellen zusammenführen — alle GENERISCH aus dem Trigger-DOM:
  //  - Breakdown: statische RISK_CONFIG (Breakdown-Children bleiben).
  //  - Market Data: aus #MARKETDATA_Modal-Triggern (echte Verschachtelung).
  //  - RISK: aus #ANALYSE_Modal .risk-acc-Gruppen.
  const mdH  = buildMarketDataHierarchy();
  const risk = buildRiskHierarchy();

  // Weitere Inhalts-Tabs GENERISCH über denselben Mechanismus wie MARKET DATA
  // (parseChartSectionTree + buildHierarchyFromTree). REPORTING (REPORTS_Modal) ist
  // bewusst ausgeschlossen; ANALYSE/RISK laufen über die Builder oben. Tabs ohne
  // report-relevante Panels werden weiter unten automatisch weggepruned
  // (synthetische Gruppe ohne echte Descendant-Sektion).
  // Nur Tabs, deren Panel-Inhalte der Report-Warmup auch rendert (Lazy-Registry).
  // CUSTOMER SETUP ist registriert (initCustomerSetupPanelsLazyRender). Weitere Tabs
  // erst aufnehmen, wenn ihre Panels ebenfalls registriert sind — sonst leere Sektionen.
  const EXTRA_TABS = [
    { tabId: 'CUSTOMER_SETUP_Tab', modalId: 'CUSTOMER_SETUP_Modal', prefix: 'cs' },
  ];
  const extraH = EXTRA_TABS.map(({ tabId, modalId, prefix }) =>
    buildHierarchyFromTree(parseChartSectionTree(modalId), {
      tabKey: 'tab__' + prefix,
      tabTitle: tabLabel(tabId, prefix.toUpperCase()),
      prefix,
    })
  );

  // Alle Hierarchie-Quellen generisch zusammenführen.
  const allH = [mdH, risk, ...extraH];

  const parents = { ...((RISK_CONFIG && RISK_CONFIG.sectionParents) || {}) };
  const orderByParent = { ...((RISK_CONFIG && RISK_CONFIG.sectionChildrenOrder) || {}) };
  const groupNodes = [];
  const labelEntries = [];
  for (const h of allH) {
    Object.assign(parents, h.parents);
    Object.assign(orderByParent, h.order);
    groupNodes.push(...h.groupNodes);
    labelEntries.push(...Object.entries(h.labels));
  }
  const groupKeys = new Set(groupNodes.map(g => g.key));
  const groupTitle = new Map(groupNodes.map(g => [g.key, g.title]));
  const labels = new Map(labelEntries);

  // ── Oberste Schicht = Tab-Namen (aus den Tab-Buttons gelesen, NICHT hardcoded).
  const tabName = (id, fb) => ((document.getElementById(id)?.textContent) || fb).trim() || fb;

  // ANALYSE: reale Top-Sektionen aus #ANALYSE_Modal ohne eigenen Parent
  // (Breakdown, Performance, Liquidity, …) unter den Tab "ANALYSE".
  const analyseTabKey = 'tab__analyse';
  const analyseTab = tabName('ANALYSE_Tab', 'Analyse');
  let analyseUsed = false;
  for (const s of sections) {
    const k = s?.key;
    if (!k || groupKeys.has(k) || parents[k]) continue;  // synthetisch oder schon Kind
    const panel = document.getElementById('panel-' + k)
      || document.getElementById(k + '_Modal')
      || document.getElementById(k);
    if (panel?.closest?.('.table')?.id === 'ANALYSE_Modal') {
      parents[k] = analyseTabKey;
      analyseUsed = true;
    }
  }
  if (analyseUsed) {
    groupKeys.add(analyseTabKey);
    groupTitle.set(analyseTabKey, analyseTab);
    labels.set(analyseTabKey, analyseTab);
  }

  // Parents OHNE eigenes Panel → synthetische Gruppen (z. B. "Scenarios" hat
  // keinen panel-scenarios-root). So überlebt der Teilbaum bzw. wird sauber
  // gepruned, ohne dass ein dangling Parent Kinder verliert.
  const realKeys = new Set(sections.map(s => s?.key).filter(Boolean));
  for (const pk of new Set([...Object.values(parents), ...Object.keys(orderByParent)])) {
    if (!pk || realKeys.has(pk) || groupKeys.has(pk)) continue;
    groupKeys.add(pk);
    if (!groupTitle.has(pk)) groupTitle.set(pk, labels.get(pk) || pk);
  }

  // Arbeitskopie + fehlende Gruppen-Sektionen injizieren (Inhalt leer).
  const work = sections.slice();
  const present = new Set(work.map(s => s?.key).filter(Boolean));
  const mkGroup = (key) => ({
    key, title: groupTitle.get(key) || key,
    sectionControls: '', chartItems: [], tableItems: [], chartThumbs: [], tableThumbs: [],
    breakdownControlsHtml: '', hasThumbs: true, sectionEnabled: true, __synthetic: true,
  });
  for (const gk of groupKeys) {
    if (!present.has(gk)) { work.push(mkGroup(gk)); present.add(gk); }
  }

  // Index
  const byKey = new Map();
  work.forEach((s, i) => { if (s?.key && !byKey.has(s.key)) byKey.set(s.key, { sec: s, idx: i }); });

  // Eltern → Kinder (nur wo beide existieren)
  const childrenMap = new Map();
  const childKeys = new Set();
  Object.entries(parents).forEach(([ck, pk]) => {
    if (!byKey.has(ck) || !byKey.has(pk)) return;
    childKeys.add(ck);
    if (!childrenMap.has(pk)) childrenMap.set(pk, []);
    childrenMap.get(pk).push(ck);
  });

  // Kinder ordnen (konfigurierte Reihenfolge zuerst, Rest nach DOM-Index)
  for (const [pk, list] of childrenMap.entries()) {
    const cfg = (orderByParent[pk] || []).filter(k => list.includes(k));
    const rest = list.filter(k => !cfg.includes(k)).sort((a, b) => (byKey.get(a)?.idx ?? 0) - (byKey.get(b)?.idx ?? 0));
    childrenMap.set(pk, uniq([...cfg, ...rest]));
  }

  // Pruning DATEN-UNABHÄNGIG: eine synthetische Gruppe nur entfernen, wenn ihr
  // Teilbaum KEINE echte Panel-Sektion enthält (z. B. "Select Portfolio" = nur
  // Dropdown). NICHT nach aktuell gerenderten Thumbnails prunen — sonst
  // verschwinden Tabs, deren Charts erst beim Öffnen des Tabs entstehen.
  const realCache = new Map();
  const hasRealDescendant = (key) => {
    if (realCache.has(key)) return realCache.get(key);
    realCache.set(key, false); // Zyklus-Guard
    let res = byKey.has(key) && !groupKeys.has(key); // echte (Panel-)Sektion?
    if (!res) for (const ck of (childrenMap.get(key) || [])) { if (hasRealDescendant(ck)) { res = true; break; } }
    realCache.set(key, res);
    return res;
  };

  // Anker-Index für Root-Reihenfolge (kleinster DOM-Index im Teilbaum)
  const anchorCache = new Map();
  const anchorIdx = (key) => {
    if (anchorCache.has(key)) return anchorCache.get(key);
    anchorCache.set(key, Infinity);
    let m = byKey.get(key)?.idx ?? Infinity;
    for (const ck of (childrenMap.get(key) || [])) m = Math.min(m, anchorIdx(ck));
    anchorCache.set(key, m);
    return m;
  };

  // Rekursiv emittieren (beliebige Tiefe). Leere synthetische Gruppen (+Teilbaum)
  // werden übersprungen → Config/Calculation/Eingaben fallen automatisch weg.
  const out = [];
  const emit = (key, level, parentKey) => {
    if (groupKeys.has(key) && !hasRealDescendant(key)) return;
    const sec = byKey.get(key)?.sec;
    if (!sec) return;
    out.push({
      ...sec,
      title: labels.get(key) || sec.title,
      __level: level,
      __isChild: level > 1,
      __isGroup: groupKeys.has(key),   // Tab/Untergruppe (Master-Checkbox "alles an/aus")
      __parentKey: parentKey || null,
    });
    for (const ck of (childrenMap.get(key) || [])) emit(ck, level + 1, key);
  };

  // Tab-Wurzeln in TAB-Reihenfolge (ANALYSE → RISK → MARKET DATA …) statt nach
  // Panel-Discovery-Index. Generisch: liest die Reihenfolge aus den Tab-Buttons,
  // folgt also automatisch, wenn die Tabs umsortiert werden.
  const TAB_NODE_BUTTON = {
    tab__analyse: 'ANALYSE_Tab', tab__risk: 'RISK_Tab', marketData: 'MARKETDATA_Tab',
    tab__cs: 'CUSTOMER_SETUP_Tab',
  };
  const tabOrder = {};
  (typeof document !== 'undefined' ? Array.from(document.querySelectorAll('.tablinks')) : [])
    .forEach((b, i) => { if (b.id) tabOrder[b.id] = i; });
  const rootRank = (key) => {
    const btn = TAB_NODE_BUTTON[key];
    if (btn && tabOrder[btn] != null) return tabOrder[btn]; // Tab-Reihenfolge
    const a = anchorIdx(key);
    return 100 + (a === Infinity ? 0 : a / 1e6);            // Rest nach den Tabs, in Discovery-Reihenfolge
  };

  const roots = uniq(work.map(s => s?.key).filter(k => k && !childKeys.has(k)));
  roots.sort((a, b) => rootRank(a) - rootRank(b)).forEach(k => emit(k, 1, null));

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

    // Liquidity-Dashboard vor der DOM-Erfassung nach Kategorie rendern (Chart + Pivot),
    // damit Preview/PDF immer die by-category-Ansicht inkl. Cash-Flow-Tabelle zeigen.
    try { prepareLiquidityDashboardForReport(); } catch (e) { console.warn('[RiskPreview] liquidity dashboard prep failed', e); }
    try { renderCreditOverviewCharts(); } catch (e) { console.warn('[RiskPreview] credit overview charts prep failed', e); }

    const chartState = loadChartToggleState?.() || {};
    let sections     = buildPreviewSections(chartState) || [];

    // ✅ Inject Breakdown child sections (Issuer / Products / General)
    sections = injectBreakdownChildren(sections, chartState) || sections;
    // Der "Market Data"-Parent + die RISK-/Tab-Gruppen werden in
    // applySectionHierarchy generisch injiziert (aus dem Trigger-DOM).

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
    // Traffic Lights gehören in die "Overview" (panel-market / panel-credit):
    // deren Inhalt in die Sektionen 'market' bzw. 'credit' mergen, KEINE
    // eigenen *Traffic-Sektionen mehr.
    // ─────────────────────────────────────────────
    removeWhere(sec => sec?.key === 'marketTraffic' || sec?.key === 'creditTraffic');

    const mergeTraffic = (trafficSec, targetKey) => {
      if (!trafficSec) return;

      let tgt = sections.find(s => s?.key === targetKey);

      if (!tgt) {
        tgt = {
          key: targetKey,
          title: sectionTitleFromKey(targetKey),
          sectionControls: buildSectionControlsHTML(targetKey, chartState),
          chartItems: [],
          chartThumbs: [],
          tableItems: [],
          tableThumbs: [],
          hasThumbs: true,
          sectionEnabled: isSectionEnabled(targetKey, chartState),
        };
        sections.push(tgt);
      }

      tgt.chartItems  = [...(tgt.chartItems  || []), ...(trafficSec.chartItems  || [])];
      tgt.chartThumbs = [...(tgt.chartThumbs || []), ...(trafficSec.chartThumbs || [])];
      tgt.hasThumbs = true;
    };
    mergeTraffic(buildMarketTrafficLightsSection(chartState), 'market');
    mergeTraffic(buildCreditTrafficLightsSection(chartState), 'credit');

    // Hard dedupe by key (reichere Instanz gewinnt).
    dedupeByKeyPrefer((a, b) => {
      const score = (s) =>
        (s?.chartThumbs?.length || 0) +
        (s?.tableThumbs?.length || 0) +
        (s?.chartItems?.length || 0) +
        (s?.tableItems?.length || 0) +
        (s?.breakdownControlsHtml ? 10 : 0);
      return score(b) >= score(a) ? b : a;
    });

    // Hierarchie anwenden (rekursiv, DOM-abgeleitet).
    sections = applySectionHierarchy(sections);


    // ─────────────────────────────────────────────
    // Accordion-Nav: stabile ID je Sektion (key-basiert wo möglich) + aktive
    // Sektion bestimmen (gemerkte beibehalten, sonst erste).
    // ─────────────────────────────────────────────
    const secMeta = sections.map((sec, i) => ({
      sec,
      key: sec?.key || null,
      id: sec?.key ? `k-${sec.key}` : `i-${i}`,
      level: sec.__level || 1,
      parentKey: sec.__parentKey || null,
      children: [],
    }));
    const ids = secMeta.map(m => m.id);
    // Keine Default-Auswahl: beim Öffnen ist NICHTS aktiv (kein schwarzer Trigger,
    // rechts leer) – erst ein Klick aktiviert eine Sektion. Nur eine bereits
    // gewählte Sektion bleibt aktiv.
    let activeId = ids.includes(__riskActiveSecId) ? __riskActiveSecId : '';
    __riskActiveSecId = activeId;

    // Baum über __parentKey aufbauen (beliebige Tiefe).
    const nodeByKey = new Map();
    secMeta.forEach(m => { if (m.key) nodeByKey.set(m.key, m); });
    const navRoots = [];
    secMeta.forEach(m => {
      const parent = m.parentKey ? nodeByKey.get(m.parentKey) : null;
      if (parent) parent.children.push(m);
      else navRoots.push(m);
    });

    // ── "Include all"-Bulk + globale Select/Deselect-Listen aus der Hierarchie.
    {
      const parentOf = new Map(secMeta.map(m => [m.key, m.parentKey]));
      const chainHas = (sk, G) => { let k = sk; while (k) { if (k === G) return true; k = parentOf.get(k); } return false; };
      __riskAllSectionKeys = secMeta.filter(m => m.key && !m.sec.__isGroup).map(m => m.key);
      __riskAllGroupKeys   = secMeta.filter(m => m.key &&  m.sec.__isGroup).map(m => m.key);
      __riskGroupBulk = new Map();
      __riskAllGroupKeys.forEach(G => {
        const keys = [];
        const prefixes = new Set();
        secMeta.forEach(m => {
          const sk = m.key;
          if (!sk || sk === G || !chainHas(sk, G)) return;
          if (m.sec.__isGroup) {
            keys.push(`${sk}:__group__`);
          } else {
            keys.push(`${sk}:__section__`);
            prefixes.add(sk);
            prefixes.add(canonicalChartSection(sk, '__x__')); // breakdown* → breakdown
          }
        });
        __riskGroupBulk.set(G, { keys, prefixes });
      });
    }

    // Expand-Status = Set von Node-IDs. null = noch nie gesetzt. Opt-in-Modell:
    // Baum startet KOMPLETT eingeklappt; der User öffnet selbst. Danach
    // User-Status respektieren (kein Zwang).
    if (__riskExpandedKeys === null) {
      __riskExpandedKeys = new Set();
    }

    // Nach Report-Load: Gruppen bis zur Leaf-Sektion aufklappen UND die erste
    // aktivierte Leaf-Sektion aktiv schalten, damit rechts direkt ihre Graphen/
    // Tabellen sichtbar werden.
    if (__riskExpandCheckedOnce) {
      __riskExpandCheckedOnce = false;
      let firstLeafWithContent = '';
      let firstEnabledLeaf = '';
      const hasContent = (s) =>
        (s?.chartThumbs?.length || s?.tableThumbs?.length ||
         s?.chartItems?.length  || s?.tableItems?.length);

      secMeta.forEach(m => {
        if (m.sec.__isGroup || !m.key) return;
        if (!isSectionEnabled(m.key, chartState)) return;
        if (!firstEnabledLeaf) firstEnabledLeaf = m.id;
        if (!firstLeafWithContent && hasContent(m.sec)) firstLeafWithContent = m.id;

        // alle Vorfahr-Gruppen entlang des Pfads aufklappen
        let pk = m.parentKey;
        while (pk) {
          const pnode = nodeByKey.get(pk);
          if (!pnode) break;
          __riskExpandedKeys.add(pnode.id);
          pk = pnode.parentKey;
        }
      });

      // Bevorzugt eine Leaf mit echtem Inhalt (Graphen/Tabellen) anzeigen.
      const target = firstLeafWithContent || firstEnabledLeaf;
      if (target) { activeId = target; __riskActiveSecId = target; __riskScrollActiveOnce = true; }
    }

    const esc = (s) => String(s || '').replace(/"/g, '&quot;');
    const renderNavNode = (m) => {
      const hasKids = m.children.length > 0;
      const sub = m.level > 1 ? ' rr-nav-trigger--sub' : '';
      const active = m.id === activeId ? ' is-active' : '';
      const label = m.sec.title || '';
      const arrow = m.level > 1 ? '↳ ' : '';
      if (!hasKids) {
        return `<button type="button" class="rr-nav-trigger${sub}${active}" data-rr-target="${m.id}" title="${esc(label)}">${arrow}${label}</button>`;
      }
      const expanded = __riskExpandedKeys.has(m.id) ? ' is-expanded' : '';
      return `<div class="rr-nav-group${expanded}" data-rr-group="${m.id}">`
        + `<button type="button" class="rr-nav-trigger rr-nav-trigger--has-children${sub}${active}" data-rr-target="${m.id}" data-rr-haskids="1" title="${esc(label)}">`
        + `<span class="rr-chev"></span><span class="rr-nav-label">${arrow}${label}</span></button>`
        + `<div class="rr-nav-children">${m.children.map(renderNavNode).join('')}</div>`
        + `</div>`;
    };
    const navHtml = navRoots.map(renderNavNode).join('');

    // Scroll-Position von Tree/Content merken, damit der Re-Render (z. B. nach
    // Checkbox-Auswahl) NICHT an den Anfang zurückspringt.
    const __prevNav = wrap.querySelector('.rr-nav');
    const __navScroll = __prevNav ? __prevNav.scrollTop : 0;
    const __prevContent = wrap.querySelector('.rr-content');
    const __contentScroll = __prevContent ? __prevContent.scrollTop : 0;

    // ─────────────────────────────────────────────
    // Render HTML
    // ─────────────────────────────────────────────
    wrap.innerHTML = `
      <div style="padding:10px;display:flex;flex-direction:column;height:100%;min-height:0;box-sizing:border-box;">

        <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;flex:0 0 auto;">
          <button id="rr-all-on"
                  style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-overlay);color:var(--text-primary);cursor:pointer;">
            Select all
          </button>
          <button id="rr-all-off"
                  style="padding:6px 10px;border-radius:8px;border:1px solid var(--border);background:var(--surface-overlay);color:var(--text-primary);cursor:pointer;">
            Deselect all
          </button>
          <span style="opacity:.7;font-size:12px;margin-left:auto;">Preview Controls</span>
        </div>

        <div class="rr-layout">
          <nav class="rr-nav">${navHtml}</nav>
          <div class="rr-content">
        ${secMeta.map(({ sec, id }) => `
          <div class="risk-section${id === activeId ? ' is-active-sec' : ''}" data-rr-sec="${id}">
            <div class="risk-section__title"
     style="
       padding-left:${(Math.max(1, sec.__level || 1) - 1) * 18}px;
       opacity:${(sec.__level || 1) > 1 ? '0.92' : '1'};
       font-size:${(sec.__level || 1) > 1 ? '12px' : '13px'};
     ">
  ${(sec.__level || 1) > 1 ? '↳ ' : ''}${sec.title}
</div>


            <div class="risk-section__row">
              <div class="risk-section__label">Section</div>
              <div class="risk-section__controls">
                ${sec.__isGroup ? buildGroupControlsHTML(sec.key, chartState) : (sec.sectionControls || '')}
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
        </div>

      </div>
    `;

    wireChartControlsOnce?.();
    wireTableNotesOnce?.();
    bindRiskNavOnce();

    // Scroll-Position von Tree/Content wiederherstellen (Re-Render-sicher).
    const __newNav = wrap.querySelector('.rr-nav');
    if (__newNav) __newNav.scrollTop = __navScroll;
    const __newContent = wrap.querySelector('.rr-content');
    if (__newContent) __newContent.scrollTop = __contentScroll;

    // Nach Report-Load: einmalig zur ersten aktivierten Sektion scrollen.
    if (__riskScrollActiveOnce) {
      __riskScrollActiveOnce = false;
      try { applyRiskNavState({ scroll: true }); } catch {}
    }
  } catch (err) {
    console.error('[RiskPreview] ERROR in renderRiskPreview', err);
  } finally {
    __lastRenderTs  = Date.now();
    __riskRendering = false;
  }
}

// Wendet den aktuellen Nav-Zustand (aktive Sektion + aufgeklappte Gruppe) auf
// das DOM an — OHNE Re-Render, damit die Checkbox-Zustände erhalten bleiben.
function applyRiskNavState({ scroll = false } = {}) {
  const wrap = document.getElementById('reportsRiskPreview');
  if (!wrap) return;
  const expanded = __riskExpandedKeys || new Set();
  // Vollvorschau: ALLE Sektionen bleiben sichtbar (nichts ausblenden). Die aktive
  // Sektion wird nur hervorgehoben und ggf. in den Sichtbereich gescrollt.
  wrap.querySelectorAll('.risk-section[data-rr-sec]').forEach(el => {
    el.classList.toggle('is-active-sec', el.getAttribute('data-rr-sec') === __riskActiveSecId);
  });
  wrap.querySelectorAll('.rr-nav-trigger').forEach(btn => {
    btn.classList.toggle('is-active', btn.getAttribute('data-rr-target') === __riskActiveSecId);
  });
  wrap.querySelectorAll('.rr-nav-group').forEach(g => {
    g.classList.toggle('is-expanded', expanded.has(g.getAttribute('data-rr-group')));
  });

  if (scroll && __riskActiveSecId) {
    const content = wrap.querySelector('.rr-content');
    const target  = wrap.querySelector(`.risk-section[data-rr-sec="${__riskActiveSecId}"]`);
    if (content && target) {
      const tr = target.getBoundingClientRect();
      const cr = content.getBoundingClientRect();
      content.scrollTop += (tr.top - cr.top);
    }
  }
}

// Delegierter Klick-Listener für die Nav-Trigger (nur 1× gebunden; das
// innerHTML wird bei jedem Render neu gebaut, der Listener am Container bleibt).
function bindRiskNavOnce() {
  if (__riskNavBound) return;
  const wrap = document.getElementById('reportsRiskPreview');
  if (!wrap) return;
  __riskNavBound = true;
  wrap.addEventListener('click', (e) => {
    const btn = e.target.closest?.('.rr-nav-trigger');
    if (!btn || !wrap.contains(btn)) return;
    e.preventDefault();
    if (!__riskExpandedKeys) __riskExpandedKeys = new Set();

    // Immer: Inhalt dieser Sektion aktivieren.
    __riskActiveSecId = btn.getAttribute('data-rr-target');

    const group   = btn.closest('.rr-nav-group');
    const hasKids = btn.hasAttribute('data-rr-haskids');
    const addAncestors = (from) => {
      let p = from;
      while (p) { __riskExpandedKeys.add(p.getAttribute('data-rr-group')); p = p.parentElement?.closest('.rr-nav-group'); }
    };

    if (hasKids && group) {
      const id = group.getAttribute('data-rr-group');
      if (__riskExpandedKeys.has(id)) {
        // Gruppe + alle Untergruppen einklappen.
        __riskExpandedKeys.delete(id);
        group.querySelectorAll('.rr-nav-group').forEach(g => __riskExpandedKeys.delete(g.getAttribute('data-rr-group')));
      } else {
        __riskExpandedKeys.add(id);
        addAncestors(group.parentElement?.closest('.rr-nav-group'));
      }
    } else {
      // Blatt: Vorfahren offen halten.
      addAncestors(btn.closest('.rr-nav-group'));
    }
    applyRiskNavState({ scroll: true }); // zur angeklickten Sektion scrollen
  });
}


// WIRE:==============================================================================================================WIRE

export function wireRiskPreview({ appRoot, force = false } = {}) {
  appRoot = appRoot || document.getElementById('app-root') || document;
  if (force) { try { teardownRiskPreview(); } catch {} }
  if (__riskWired && !force) return;
  __riskWired = true;

  // Report-Portfolio-Dropdown initial spiegeln + bei jedem Öffnen des Risk-
  // Report-Panels aktualisieren (Optionen kommen ggf. erst async).
  try { syncReportPortfolioDropdown(); } catch {}
  try { window.registerPanelOpenHook?.('panel-reports-risk', () => { try { syncReportPortfolioDropdown(); } catch {} }); } catch {}

  const scheduleSafe = () => { try { scheduleRiskPreviewRender(); } catch (e) { console.error(e); } };

  // --- 1) Globaler, erzwungener Delegations-Mechanismus ---
  const evtTypes = ['input', 'change', 'click', 'keyup', 'pointerup'];
__riskDocDelegatedHandler = (ev) => {
  if (__riskRendering) return;
  const t = ev.target;

  // Notiz-Textboxen: KEIN Re-Render (sonst wird die Textarea bei jedem Tastendruck
  // neu gebaut -> Fokus/Eingabe verloren). Gespeichert wird ueber wireTableNotesOnce().
  if (t && t.classList && t.classList.contains('rr-note-input')) return;

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
    const ctrls = appRoot.querySelectorAll(sel);

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
      const onClickReports = () => {
        // Beim Öffnen von REPORTS nur das Portfolio-Dropdown spiegeln + die
        // Vorschau-Struktur rendern. Die (teure) Daten-Materialisierung läuft
        // NICHT automatisch, sondern erst auf "Get Risk Data" → kein Warten.
        syncReportPortfolioDropdown();
        setTimeout(kick, 0);
      };
      reportsBtn.addEventListener('click', onClickReports, true);
      // nicht in __riskRefreshBtn speichern, das ist für den Refresh-Button reserviert
    }
  } catch {}

  // Optional: Refresh-Thumbnails (falls vorhanden)
  const refreshBtn = appRoot.querySelector?.('#refreshThumbnailsBtn');
;
  if (refreshBtn) {
    __riskRefreshBtn = refreshBtn;
    __riskRefreshHandler = (e) => {
      setGetRiskDataBusy(); // Executing… + roter Punkt SOFORT (synchron)
      const fn = window.handleRefreshThumbnailsClick
        || (typeof handleRefreshThumbnailsClick === 'function' ? handleRefreshThumbnailsClick : null);
      // Arbeit erst nach dem Paint → der Busy-Zustand erscheint sofort.
      afterPaint(() => {
        if (fn) { try { fn(e); } catch (err) { console.warn('[risk preview] refresh handler error', err); } }
        try { if (typeof clearThumbCache === 'function') clearThumbCache(); } catch {}
        setTimeout(kick, 0);
      });
    };
    try { refreshBtn.addEventListener('click', __riskRefreshHandler, true); } catch {}
  }

  // Externes Custom-Refresh + "fertig"-Signal für die Get-Risk-Data-Anzeige.
  __riskDocRefreshHandler = () => {
    try { setGetRiskDataDone(); } catch {}  // Punkt → grün, "Get Risk Data" zurück
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
          <th style="padding:${cellPad}px ${cellPad + 1}px; border:1px solid var(--border); text-align:left;">
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

    // 3b) Eingabefelder: Werte stehen in <input>/<select>/<textarea>, NICHT in
    //     td.textContent (z.B. Customer-Setup Threshold-/Limit-Tabellen). Ohne das
    //     blieb nur das "%"/Label sichtbar, der eigentliche Wert fehlte.
    const input = td.querySelector('input:not([type="checkbox"]):not([type="radio"])');
    if (input) {
      // Einheit/Suffix (z.B. "%") steht oft in einem verschachtelten <span>, nicht
      // als direkter Text-Node. td.textContent erfasst beides; das <input> selbst
      // hat keinen textContent, liefert also nur den Einheiten-/Suffix-Text.
      const suffix = (td.textContent || '').trim();
      return `${input.value ?? ''}${suffix ? ' ' + suffix : ''}`.trim();
    }

    const select = td.querySelector('select');
    if (select) {
      const selectedText =
        select.options?.[select.selectedIndex]?.textContent?.trim() ||
        select.value ||
        '';
      return selectedText;
    }

    const textarea = td.querySelector('textarea');
    if (textarea) {
      return textarea.value || '';
    }

    // 4) Traffic-/Ampel-Dots innerhalb der Zelle erhalten
    const trafficDot =
      td.querySelector('.traffic-dot') ||
      td.querySelector('.risk-dot') ||
      td.querySelector('.status-dot') ||
      td.querySelector('.ampel-dot') ||
      td.querySelector('.traffic-light-dot') ||
      td.querySelector('[data-traffic]') ||
      td.querySelector('[data-risk-status]') ||
      td.querySelector('[data-traffic-status]')

    if (trafficDot) {
      let color = '';

      const cls = Array.from(trafficDot.classList || []).join(' ').toLowerCase();

      if (cls.includes('green') || cls.includes('ok') || cls.includes('good')) {
        color = '#4caf50';
      } else if (cls.includes('yellow') || cls.includes('orange') || cls.includes('warn')) {
        color = '#ff9800';
      } else if (cls.includes('red') || cls.includes('bad') || cls.includes('fail')) {
        color = '#f44336';
      }

      const status = String(
        trafficDot.dataset?.status ||
        trafficDot.dataset?.traffic ||
        ''
      ).toLowerCase();

      if (!color && (status.includes('green') || status.includes('ok') || status.includes('good'))) {
        color = '#4caf50';
      }
      if (!color && (status.includes('yellow') || status.includes('orange') || status.includes('warn'))) {
        color = '#ff9800';
      }
      if (!color && (status.includes('red') || status.includes('bad') || status.includes('fail'))) {
        color = '#f44336';
      }

      if (!color) {
        try {
          const cs = getComputedStyle(trafficDot);
          color =
            cs.backgroundColor &&
            cs.backgroundColor !== 'rgba(0, 0, 0, 0)' &&
            cs.backgroundColor !== 'transparent'
              ? cs.backgroundColor
              : cs.color;
        } catch {}
      }

      const text = (td.textContent || '').trim();

      return `
        <span style="display:inline-flex;align-items:center;gap:5px;">
          <span style="
            display:inline-block;
            width:8px;
            height:8px;
            border-radius:50%;
            background:${color || '#999'};
            border:1px solid rgba(0,0,0,0.15);
            flex:0 0 auto;
          "></span>
          <span>${text}</span>
        </span>
      `;
    }

    // 5) Sonst normaler Text
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
          <td style="padding:${cellPad}px ${cellPad + 1}px; border:1px solid var(--border); text-align:${align};">
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
          border:1px solid var(--border);
          border-radius:6px;
          background:var(--surface-card);">
      <div style="
           transform:scale(${scale});
           transform-origin: top left;
           width:${innerWidthPct}%;">

        <table style="
               border-collapse:collapse;
               font-size:${fontSize}px;
               color:var(--text-primary);
               white-space:nowrap;
               background:var(--surface-card);">
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




// Globale Buttons "Select all / Deselect all". State-basiert (nicht DOM), damit
// auch Sektionen erfasst werden, deren Inhalt aktuell nicht gerendert ist.
function setAllRRCheckboxes(checked) {
  const st = loadChartToggleState();

  // 1) Alle einzelnen Chart/Table-Overrides entfernen → Charts erben Section.
  for (const k of Object.keys(st)) {
    const i = k.lastIndexOf(':');
    if (i < 0) continue;
    const suf = k.slice(i + 1);
    if (suf !== '__section__' && suf !== '__group__') delete st[k];
  }

  // 2) Alle bekannten Section- + Gruppen-Toggles setzen.
  (__riskAllSectionKeys || []).forEach(k => { st[`${k}:__section__`] = !!checked; });
  (__riskAllGroupKeys   || []).forEach(k => { st[`${k}:__group__`]   = !!checked; });

  try { localStorage.setItem(CHART_STATE_KEY, JSON.stringify(st)); } catch {}
  try { scheduleRiskPreviewRender(); } catch {}
}


// ─────────────────────────────────────────────
// Export: Aktives Layout für Risk-PDF
// ─────────────────────────────────────────────

export function getActiveRiskSectionsForPdf() {
  // Auch fuer den PDF-Export sicherstellen, dass das Liquidity-Dashboard by-category
  // (Chart + Cash-Flow-Pivot) im DOM steht, bevor die Sektionen erfasst werden.
  try { prepareLiquidityDashboardForReport(); } catch (e) { console.warn('[RiskPdf] liquidity dashboard prep failed', e); }
  try { renderCreditOverviewCharts(); } catch (e) { console.warn('[RiskPdf] credit overview charts prep failed', e); }
  const chartState = loadChartToggleState?.() || {};
  const layout     = computeRiskLayout(chartState) || [];

  // Helper: Section-Toggle respektieren (Opt-in → Default: aus)
  const isSectionOn = (key) => {
    const v = chartState[`${key}:__section__`];
    return (typeof v === 'boolean') ? v : false;
  };

  // 1) Roh-Sections (Section-Toggle respektieren). NICHT nach Inhalt filtern —
  //    Traffic wird gleich in market/credit eingefaltet, dann erst gefiltert.
  //    + SPEZIAL: Breakdown-Legend-Tabellen für das PDF ergänzen.
  let sections = layout
    .filter(sec => isSectionOn(sec.key)) // ✅ Section Checkbox wirkt im PDF
    .map(sec => {
      let enabledCharts = sec.enabledCharts || [];
      let enabledTables   = sec.enabledTables ? [...sec.enabledTables] : [];

      // 🔹 SPEZIALFALL: Breakdown. Der PDF-Pfad kennt nur die Parent-Section
      //    'breakdown' mit ALLEN Charts. Pro Unter-Section (Issuer/Products/…)
      //    gaten: ein Chart/Legend kommt nur ins PDF, wenn seine Unter-Section
      //    angehakt ist. Unbekannte Charts hängen am Parent-Toggle.
      if (sec.key === 'breakdown') {
        const groups = (RISK_CONFIG && RISK_CONFIG.breakdownGroups) || {};
        const childToGroup = (RISK_CONFIG && RISK_CONFIG.breakdownChildToGroup) || {};

        // chartId → Unter-Section-Key
        const chartToChild = new Map();
        Object.entries(childToGroup).forEach(([childKey, groupName]) => {
          (groups[groupName] || []).forEach(cid => chartToChild.set(cid, childKey));
        });
        // Unter-Section an? Explizit gesetzt → das; sonst dem Parent folgen.
        const childOn = (childKey) => {
          const v = chartState[`${childKey}:__section__`];
          return (typeof v === 'boolean') ? v : isSectionOn('breakdown');
        };

        // 1) Charts nur behalten, wenn ihre Unter-Section an ist.
        enabledCharts = enabledCharts.filter(ch => {
          const child = chartToChild.get(ch.id);
          return child ? childOn(child) : true;
        });

        // 2) Legend-Tabellen NUR für aktive Unter-Sections ergänzen.
        const existingIds = new Set(enabledTables.map(t => t.id));
        Object.entries(childToGroup).forEach(([childKey, groupName]) => {
          if (!childOn(childKey)) return;
          (groups[groupName] || []).forEach(chartId => {
            const legendId = `${chartId}-legend`;
            if (existingIds.has(legendId)) return;
            existingIds.add(legendId);
            enabledTables.push({ id: legendId, label: `${groupName} Breakdown` });
          });
        });
      }

      return { key: sec.key, title: sec.title, enabledCharts, enabledTables };
    });

  // 2) Traffic-Lights in die Overview-Sektionen (market/credit) FALTEN — wie die
  //    Preview. So liegen sie unter Market/Credit Risk statt als eigene Wurzel.
  const foldTraffic = (targetKey, charts) => {
    if (!charts.length) return;
    let tgt = sections.find(s => s.key === targetKey);
    if (!tgt) { tgt = { key: targetKey, title: targetKey, enabledCharts: [], enabledTables: [] }; sections.push(tgt); }
    tgt.enabledCharts = [...(tgt.enabledCharts || []), ...charts];
  };

  // Credit-Ampeln (CVaR/TSI/MSD): die Traffic-DIVs sind display:none und lassen sich
  // NICHT als Bild rastern -> nicht als "Charts" einfalten. Stattdessen die zugehoerigen
  // Kennzahlen-Tabellen als enabledTables ergaenzen; der Tabellen-Loop in RiskPDF zeichnet
  // sie inkl. Ampelpunkt. Gate: 'credit' (es gibt keinen eigenen creditTraffic-Toggle in
  // der UI), pro Kennzahl ueber die vorhandene CVaR/TSI/MSD-Checkbox.
  if (hasCreditTrafficDom() && isSectionOn('credit')) {
    let tgt = sections.find(s => s.key === 'credit');
    if (!tgt) { tgt = { key: 'credit', title: sectionTitleFromKey('credit'), enabledCharts: [], enabledTables: [] }; sections.push(tgt); }
    const tbls = tgt.enabledTables || (tgt.enabledTables = []);
    const addTbl = (on, id, label) => { if (on && !tbls.some(x => x.id === id)) tbls.push({ id, label }); };
    addTbl(isChartEnabled('creditTraffic', 'traffic-credit-cvar', chartState), 'CVaR_allRelativeContainer0', 'Credit Value at Risk (CVaR)');
    addTbl(isChartEnabled('creditTraffic', 'traffic-credit-tsi',  chartState), 'creditTsiTableContainer0',   'Tail Severity Index (TSI)');
    addTbl(isChartEnabled('creditTraffic', 'traffic-credit-msd',  chartState), 'creditMsdTableContainer0',   'Market Stress Divergence (MSD)');
  }
  // Market-Ampel: analog zu Credit — nicht das display:none-Traffic-Light als "Chart"
  // einfalten, sondern die echte VaR/ES-Tabelle (MVaRDataContainer0) als enabledTable
  // ergaenzen. Der Tabellen-Loop zeichnet sie inkl. Ampelpunkt. Gate: 'market',
  // ueber die Tabellen-Checkbox 'tbl-mvar-es'.
  if (hasMarketTrafficDom() && isSectionOn('market')) {
    let tgt = sections.find(s => s.key === 'market');
    if (!tgt) { tgt = { key: 'market', title: sectionTitleFromKey('market'), enabledCharts: [], enabledTables: [] }; sections.push(tgt); }
    const tbls = tgt.enabledTables || (tgt.enabledTables = []);
    if (isChartEnabled('marketTraffic', 'tbl-mvar-es', chartState) && !tbls.some(x => x.id === 'MVaRDataContainer0')) {
      tbls.push({ id: 'MVaRDataContainer0', label: 'Market VaR / ES' });
    }
  }

  // 3) Nur Sektionen mit Inhalt behalten.
  sections = sections.filter(s => (s.enabledCharts?.length) || (s.enabledTables?.length));

  // 4) GENERISCHE Hierarchie aus dem Trigger-DOM (Tabs/Gruppen/Verschachtelung) —
  //    IDENTISCH zur Preview. Synthetische Gruppen ohne Inhalt sind reine
  //    Überschriften (RiskPDF gibt sie nur ins Inhaltsverzeichnis).
  // Opt-in: Leere synthetische Gruppen (keine eingeschaltete Sektion darunter)
  // werden von applySectionHierarchy automatisch entfernt → kein stehender Titel.
  return applySectionHierarchy(sections);
}


// ─────────────────────────────────────────────
// Export: Preset State anwenden + Preview neu rendern
// ─────────────────────────────────────────────

export function applyRiskPresetState(state = {}, { forceRender = false } = {}) {
  try {
    const st = (state && typeof state === 'object') ? { ...state } : {};

    // Tabellen-Notizen aus dem Preset herausloesen und separat wiederherstellen,
    // damit sie nicht in rr-chart-state landen (dort wuerde saveChartToggleStateFromDOM
    // sie ohnehin verwerfen).
    if (st.__tableNotes && typeof st.__tableNotes === 'object') {
      try { localStorage.setItem(TABLE_NOTES_KEY, JSON.stringify(st.__tableNotes)); } catch {}
    }
    delete st.__tableNotes;

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

    // Geladener Report: beim Render die Gruppen mit aktivierten Sections aufklappen.
    __riskExpandCheckedOnce = true;

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

export function syncRiskPdfStateFromDOM() {
  try { saveChartToggleStateFromDOM(); } catch (e) {
    console.warn('[RiskPDFPreview] syncRiskPdfStateFromDOM failed', e);
  }
}


export async function handleRefreshThumbnailsClick(e) {
  // e.currentTarget ist nach dem (deferred) Event null → robust per ID holen.
  const btn = e?.currentTarget || document.getElementById('refreshThumbnailsBtn');
  if (!btn) return;

  // Button-Status (Executing… + Punkt) wird zentral über setGetRiskDataBusy/
  // setGetRiskDataDone gesteuert (siehe wireRiskPreview), nicht hier.
  try {
    // ✅ Durchgängig: ALLE Report-Quellen (Lazy-Panels + RISK-Charts) aus dem
    // Store rendern, damit ihr Inhalt im DOM steht — ohne dass man die Tabs
    // vorher manuell öffnen muss.
    syncReportPortfolioSelectionToMain();
    warmUpReportSources();

    // Daten holen (aus State)
    const portMainData =
      (window.appState?.getPortMainData?.() ||
       window.appState?.getPortMainTable?.() ||
       []);

    // IR Sensitivity (PV01)
    if (typeof handleIRSensData !== 'function') {
      throw new Error('handleIRSensData is not available (import missing or wrong)');
    }

    const irTable = handleIRSensData(portMainData);
    replaceContent('IRSensDataContainer', irTable);

    // Credit Sensitivity (CPV01)
    if (typeof handleCSSensData === 'function') {
      const crTable = handleCSSensData(portMainData);
      replaceContent('CSSensDataContainer', crTable);
    }

    // Optional: Event für weitere Listener (PDF / Preview etc.)
    document.dispatchEvent(
      new CustomEvent('risk:refresh-thumbnails', {
        detail: { source: 'manual-refresh' }
      })
    );

  } catch (err) {
    console.error('[RiskPDF] refresh failed:', err);
    try { setGetRiskDataDone(); } catch {} // bei Fehler nicht hängen bleiben
  }
}


// 3) Mini-Helper zum sicheren Ersetzen von Container-Inhalten
function replaceContent(containerId, node) {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = '';
  if (node) el.appendChild(node);
}







