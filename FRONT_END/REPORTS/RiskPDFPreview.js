
import { handleRefreshThumbnailsClick } from '../renderer.js';
import { getSectionTitleFromPanel } from './RiskPDF.js';


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
    id = id.replace(/^panel-/, '').replace(/_Modal$/, '');
    return { key: id, element: panel };
  });
}

function discoverChartsFromPanel(panel) {
  const canvases = [...panel.querySelectorAll('canvas[id]')];

  // Plotly: entweder hat der DIV die Plotly-Klasse oder genau deine ID
  const plotlyDivs = [
    ...panel.querySelectorAll('.js-plotly-plot[id]'),
    ...panel.querySelectorAll('#swaption-atm-surface-3d')
  ];

  // Du willst keine Duplikate
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
    ...uniqPlotly.map(d => ({ id: d.id, label: d.dataset.label || d.id }))
  ];
}


function discoverTablesFromPanel(panel) {
  return [...panel.querySelectorAll('.data-container[id]')].map(div => ({
    id: div.id,
    label: div.dataset.label || div.id
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

// ─────────────────────────────────────────────
// Zentrales Layout: Sections + enabled Charts/Tables
// ─────────────────────────────────────────────

function computeRiskLayout(chartState = {}) {
  const discovered = discoverSectionsFull();
  const sections = [];

  Object.entries(discovered).forEach(([secKey, sec]) => {
    const sectionEnabled = isSectionEnabled(secKey, chartState);

    // Charts/Tables: enabled nach aktuellem State
    const enabledCharts = (sec.charts || []).filter(ch =>
      isChartEnabled(secKey, ch.id, chartState)
    );
    const enabledTables = (sec.tables || []).filter(t =>
      isChartEnabled(secKey, `tbl-${t.id}`, chartState)
    );

    sections.push({
      key: secKey,
      title: getSectionTitleFromPanel
        ? getSectionTitleFromPanel(sec.element, secKey)
        : sectionTitleFromKey(secKey),
      element: sec.element,
      sectionEnabled,
      charts: sec.charts || [],       // alle Charts (für Controls)
      tables: sec.tables || [],       // alle Tables (für Controls)
      enabledCharts,                  // nur aktive Charts
      enabledTables,                  // nur aktive Tables
    });
  });

  return sections;
}



// ─────────────────────────────────────────────
// PREVIEW_SECTIONS automatisch erstellen
// ─────────────────────────────────────────────

function buildPreviewSections(chartState) {
  const layout = computeRiskLayout(chartState);
  const sections = [];

  layout.forEach(sec => {
    // Section-Toggle respektieren → ausgehackte Section gar nicht anzeigen
    if (!sec.sectionEnabled) return;

    // Controls immer bauen (damit man Charts/Tables wieder anhacken kann)
    const sectionControlsHTML = buildSectionControlsHTML(sec.key, chartState);
    const chartControlsHTML   = buildDynamicChartControlsHTML(sec.key, sec.charts, chartState);
    const tableControlsHTML   = buildDynamicTableControlsHTML(sec.key, sec.tables, chartState);

    // Thumbs nur für enabled-Charts
    const thumbs = (sec.enabledCharts || [])
      .map(ch => smartThumb(ch.id, ch.label))
      .filter(Boolean);

    const tablesHTML = (sec.enabledTables || [])
      .map(t => miniTbl(t.id))
      .join('');

    sections.push({
      key: sec.key,
      title: sec.title,
      thumbs,
      extraHTML: `
        ${sectionControlsHTML}
        ${chartControlsHTML || ''}
        ${tableControlsHTML || ''}
        ${tablesHTML || ''}
      `,
    });
  });

  return sections;
}




function sectionTitleFromKey(key) {
  const titles = {
    breakdown: 'Portfolio Breakdown',
    performance: 'Performance',
    market: 'Market Risk',
    mvar: 'Market Risk — Detail',
    sensitivities: 'Sensitivities — Detail',
    credit: 'Credit Risk',
    EAD: 'Credit Risk — Details',
    liquidity: 'Liquidity',
    PORTFOLIO_HISTORY: 'Historic Performance & Risk',
    marketDataIR: 'Market Data — Interest Rates',
    marketDataCS: 'Market Data — Credit Spreads',
  };
  return titles[key] || key;
}



// SECTION CONTROLL: 
function isSectionEnabled(sectionKey, state) {
  const k = `${sectionKey}:__section__`;
  const v = (state || {})[k];
  return (typeof v === 'boolean') ? v : true; // default: true
}

function buildSectionControlsHTML(sectionKey, chartState) {
  const state = chartState || {};
  const domId = `rr-sec-${sectionKey}`;
  const checked = state[`${sectionKey}:__section__`] !== false ? 'checked' : '';
  return `
    <div class="rr-sec-controls" style="margin:0 0 6px; display:flex; align-items:center; gap:10px;">
      <label style="display:flex;align-items:center;gap:6px;white-space:nowrap;">
        <input type="checkbox"
               id="${domId}"
               data-section-key="${sectionKey}"
               ${checked}>
        <span style="opacity:.85;">Section</span>
      </label>
    </div>
  `;
}


// ─────────────────────────────────────────────
// Dynamische Chart-Checkboxen pro Section
// ─────────────────────────────────────────────
function buildDynamicChartControlsHTML(sectionKey, charts, chartState) {
  const list = charts || [];
  if (!list.length) return '';

  const state = chartState || {};

  const items = list.map(ch => {
    const chartId  = ch.id;                     // DOM-ID des Canvas/Divs
    const label    = ch.label || chartId;       // Fallback: ID, falls kein Label
    const flatKey  = `${sectionKey}:${chartId}`;
    const domId    = `rr-chart-${sectionKey}-${chartId}`;
    const checked  = state[flatKey] !== false ? 'checked' : '';

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
  }).join('');

  return `
    <div class="rr-chart-controls" style="margin:4px 0 8px;">
      <div style="font-size:11px;opacity:.8;margin-bottom:4px">Charts:</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        ${items}
      </div>
    </div>
  `;
}

// ─────────────────────────────────────────────
// Dynamische Tabellen-Checkboxen pro Section
// ─────────────────────────────────────────────
function buildDynamicTableControlsHTML(sectionKey, tables, chartState) {
  const list = tables || [];
  if (!list.length) return '';

  const state = chartState || {};

  const items = list.map(t => {
    const tableId = t.id;                 // DOM-ID des Tabellen-Containers
    const label   = t.label || tableId;   // Fallback
    const flatKey = `${sectionKey}:tbl-${tableId}`;
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
  }).join('');

  return `
    <div class="rr-table-controls" style="margin:4px 0 8px;">
      <div style="font-size:11px;opacity:.8;margin-bottom:4px">Tables:</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;">
        ${items}
      </div>
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
    st[`${sec}:${key}`] = !!el.checked;
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
  const sKey = `${section}:${key}`;
  const v = (state || {})[sKey];
  return (typeof v === 'boolean') ? v : true;
}

// Event-Wiring für diese Checkboxen
function wireChartControlsOnce() {
  const nodes = document.querySelectorAll('input[data-chart-section][data-chart-key], input[data-section-key]');
  nodes.forEach(el => {
    if (el.dataset.bound) return;
    el.addEventListener('change', () => {
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
  // Wenn du feste IDs hast, kannst du die direkt angeben:
  const knownIds = [
    'riskProductYieldChart',
    'riskDurationProductYieldChart',
    'riskChart',
    'riskDurationChart'
  ];
  // bekannte IDs zuerst
  knownIds.forEach(id => {
    const c = document.getElementById(id);
    if (c) destroyRiskChartByCanvas(c);
  });
  // plus Safety-Net: alle Canvas mit "risk" im id
  document.querySelectorAll('canvas[id*="risk"]').forEach(c => destroyRiskChartByCanvas(c));
}

/** Exportiertes Teardown (wird von reports:leave aufgerufen) */
export function teardownRiskPreview() {
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

function isVisible(el) {
  if (!el) return false;
  if (el.hidden) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}

//RENDER:========================================================================================================RENDER

function renderRiskPreview() {
  if (__riskRendering) return;

  const wrap  = document.getElementById('reportsRiskPreview');
  if (!wrap) return;

  const panel = document.getElementById('panel-reports-risk');
  if (!panel || !isVisible(panel)) return;

  __riskRendering = true;
  try {
    clearThumbCache?.();

    // Nur noch: Toggle-State laden
    const chartState = loadChartToggleState?.() || {};

    // AUTOMATISCH: Sections aus DOM
    const sections = buildPreviewSections(chartState);

wrap.innerHTML = `
  <div style="padding:10px">

    <div style="display:flex;gap:8px;align-items:center;margin-bottom:10px;">
      <button id="rr-all-on"  style="padding:6px 10px;border-radius:8px;border:1px solid #444;background:#1a1a1a;color:#ddd;cursor:pointer;">
        Alles anhacken
      </button>
      <button id="rr-all-off" style="padding:6px 10px;border-radius:8px;border:1px solid #444;background:#1a1a1a;color:#ddd;cursor:pointer;">
        Alles aushacken
      </button>
      <span style="opacity:.7;font-size:12px;margin-left:auto;">Preview Controls</span>
    </div>

    ${sections.map(sec => `
      <div style="margin:12px 0 10px">
        <div style="font-weight:600;margin:0 0 6px">${sec.title}</div>

        ${sec.extraHTML || ''}

        ${sec.thumbs.length
          ? `<div style="display:flex;gap:8px;flex-wrap:wrap">${sec.thumbs.join('')}</div>`
          : `<div style="opacity:.65;font-size:12px;margin-top:6px;">(Noch keine Thumbnails – Daten laden/Panel rendern)</div>`
        }
      </div>
    `).join('')}

  </div>
`;



    // Controls (falls vorhanden)
    wireChartControlsOnce?.();

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
const MINI_TABLE_DEFAULTS = {
  maxRows: 8,
  maxCols: 8,
  scale: 0.78,
  fontSize: 10,
  cellPad: 2,
  maxWidth: 320,
  maxHeight: 220,  // optional: sichtbare Höhe mit Scroll
};

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

  const table = host.querySelector('table');
  if (!table) return '';

  // Header ermitteln
  let ths = Array.from(table.querySelectorAll('thead th')).slice(0, maxCols);
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

  const headLabels = ths.map(th => (th.textContent || '').trim());
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

  // 🔧 Helfer: Zellinhalt extrahieren (mit Radio-Unterstützung)
  const renderCell = (td) => {
    // Radio?
    const radios = td.querySelectorAll('input[type="radio"]');
    if (radios.length) {
      const checked = Array.from(radios).some(r => r.checked);
      return `<span aria-label="${checked ? 'selected' : 'not selected'}" title="${checked ? 'selected' : 'not selected'}">${checked ? '●' : '○'}</span>`;
    }
    // Checkboxen könnten optional ähnlich behandelt werden:
    // const cbs = td.querySelectorAll('input[type="checkbox"]');
    // ...

    // Sonst Text
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
            ${renderCell(td)}
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

  // ✅ Sections NICHT anfassen – sonst verschwindet alles
  // panel.querySelectorAll('input[data-section-key]').forEach(el => { el.checked = true; });

  // Charts + Tables toggeln
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
  const layout = computeRiskLayout(chartState);

  // Nur Sections, die:
  //  1. eingeschaltet sind
  //  2. mind. 1 aktiven Chart ODER Table besitzen
  return layout
    .filter(sec =>
      sec.sectionEnabled &&
      ((sec.enabledCharts && sec.enabledCharts.length) ||
       (sec.enabledTables && sec.enabledTables.length))
    )
    .map(sec => ({
      key: sec.key,
      title: sec.title,
      enabledCharts: sec.enabledCharts,
      enabledTables: sec.enabledTables,
    }));
}







