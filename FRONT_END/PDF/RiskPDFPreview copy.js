import { REPORT_DEFAULTS } from './RiskPDF.js';
import { handleRefreshThumbnailsClick } from '../../FRONT_END/renderer.js';




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


// === Breakdown: Spalten, Labels, Gruppen ===
const BD_COLUMNS = ['ISSUER','RATING','RANK','RATINGres','CATEGORY','CouponType','Depotbank'];

const BD_DISPLAY = {
  ISSUER:     'Issuer',
  RATING:     'Issuer General Rating',
  RANK:       'Issuer Capital Structure',
  RATINGres:  'Product Ratings',
  CATEGORY:   'Product Categories',
  CouponType: 'Product Coupon Type',
  Depotbank:  'Depot Bank'
};

const BD_GROUPS = {
  Issuer:  ['ISSUER','RATING','RANK'],
  Product: ['RATINGres','CATEGORY','CouponType'],
  General: ['Depotbank']
};

// === abgeleitete Gruppen-Maps (für Preview/PDF-Filter) ===
const BD_GROUP_OF = (() => {
  const map = {};
  Object.entries(BD_GROUPS).forEach(([groupName, cols]) => {
    const key = groupName.toLowerCase(); // 'Issuer' → 'issuer'
    cols.forEach(col => { map[col] = key; });
  });
  return map;
})();

const BD_GROUPS_ORDERED = {
  issuer:  BD_GROUPS.Issuer,
  product: BD_GROUPS.Product,
  general: BD_GROUPS.General,
};


// === Persistenz ===
// ——— Per-Chart-Status laden/speichern (wie gehabt) ———
function loadBdState() {
  try { return JSON.parse(localStorage.getItem('rr-bd-state') || '{}'); } catch { return {}; }
}
function saveBdStateFromDOM() {
  const st = {};
  BD_COLUMNS.forEach(c => {
    const el = document.getElementById('rr-bd-' + c);
    st[c] = !!el?.checked;
  });
  try { localStorage.setItem('rr-bd-state', JSON.stringify(st)); } catch {}
}

// ——— Controls-HTML generieren ———
function buildBreakdownPerChartControlsHTML() {
  const st = loadBdState();
  const items = BD_COLUMNS.map(c => {
    const id = 'rr-bd-' + c;
    const label = BD_DISPLAY[c] || c;
    const checked = (st[c] !== false) ? 'checked' : '';
    return `
      <label style="display:flex;align-items:center;gap:8px;white-space:nowrap;">
        <input id="${id}" type="checkbox" ${checked}>
        <span>${label}</span>
      </label>`;
  }).join('');

  return `
    <div id="rr-bd-controls" style="margin:8px 0 0 24px;">
      <div style="opacity:.8;margin-bottom:6px">Show charts:</div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px;">
        ${items}
      </div>
    </div>
  `;
}

// ——— In Report Options unter „Portfolio Breakdown“ einhängen (einmalig) ———
let __bdControlsMounted = false;
function mountBreakdownControlsInReportOptions() {
  if (__bdControlsMounted) return;

  // Anker: die Haupt-Checkbox „Portfolio Breakdown“
  const anchor = document.getElementById('rr-portfolioBreakdown');
  if (!anchor) return; // Options-UI noch nicht da? Dann später erneut versuchen.

  // Host bestimmen: direkt nach dem Zeilen-Container einfügen,
  // sonst einfach nach dem Label/Eltern-Knoten.
  let host = null;
  host = anchor.closest?.('.option-row') || anchor.closest?.('label') || anchor.parentElement;
  if (!host) host = anchor;

  // Schauen, ob schon vorhanden
  if (!host.nextElementSibling || host.nextElementSibling.id !== 'rr-bd-controls') {
    const wrap = document.createElement('div');
    wrap.innerHTML = buildBreakdownPerChartControlsHTML();
    host.after(wrap.firstElementChild);
  }

  // Events binden
  BD_COLUMNS.forEach(c => {
    const el = document.getElementById('rr-bd-' + c);
    if (el && !el.dataset.bound) {
      el.addEventListener('change', () => {
        saveBdStateFromDOM();
        try { scheduleRiskPreviewRender(); } catch {}
      });
      el.dataset.bound = '1';
    }
  });

  __bdControlsMounted = true;
}



// === Controls-HTML für Preview ===
function buildBreakdownControlsHTML() {
  // Per-Chart-Defaults aus localStorage; Fallback: alles sichtbar
  const st = loadBdState();

  const checks = BD_COLUMNS.map(c => {
    const id = 'rr-bd-' + c;
    const label = BD_DISPLAY[c] || c;
    const checked = (st[c] !== false) ? 'checked' : '';
    return `
      <label class="rr-bd-item" style="display:flex;align-items:center;gap:8px">
        <input id="${id}" type="checkbox" ${checked}>
        <span>${label}</span>
      </label>`;
  }).join('');

  return `
    <div class="rr-bd-controls">
      <div class="rr-bd-head" style="font-weight:600;margin-bottom:6px">Portfolio Breakdown – Auswahl (Charts)</div>
      <div class="rr-bd-grid" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(220px,1fr));gap:8px">
        ${checks}
      </div>
    </div>
  `;
}



// === Wiring der Controls (einmalig) ===
function wireBreakdownControlsOnce() {
  BD_COLUMNS.forEach(c => {
    const el = document.getElementById('rr-bd-' + c);
    if (el && !el.dataset.bound) {
      el.addEventListener('change', () => {
        saveBdStateFromDOM();
        try { scheduleRiskPreviewRender(); } catch {}
      });
      el.dataset.bound = '1';
    }
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

// Helper
const getEl = (id) => document.getElementById(id); // KEIN '#'
const getChecked = (id, def) => {
  const el = getEl(id);
  return el ? !!el.checked : def;
};
const getValue = (id, def) => {
  const el = getEl(id);
  const v = el?.value?.trim();
  return v ? v : def;
};

// getRiskReportOptions REPORT OPTIONS=============================================

export function getRiskReportOptions() {
  const $   = (id) => document.getElementById(id);
  const chk = (id, def) => { const el = $(id); return el ? !!el.checked : def; };
  const val = (id, def) => { const el = $(id); const v = el?.value?.trim(); return v || def; };

  return {
    includeTOC: chk('rr-includeTOC', REPORT_DEFAULTS.includeTOC),
    sections: {
      // bereits vorhanden:
      portfolioBreakdown: (() => {
        const def = REPORT_DEFAULTS.sections.portfolioBreakdown || { enabled: true, issuer: true, product: true, general: true };

        const uiEnabled = document.getElementById('rr-portfolioBreakdown');
        const enabled   = uiEnabled ? !!uiEnabled.checked : (def.enabled !== false);

        const uiIssuer  = document.getElementById('rr-portfolioBreakdown-issuer');
        const uiProduct = document.getElementById('rr-portfolioBreakdown-product');
        const uiGeneral = document.getElementById('rr-portfolioBreakdown-general');

        const issuer  = uiIssuer  ? !!uiIssuer.checked  : (def.issuer  !== false);
        const product = uiProduct ? !!uiProduct.checked : (def.product !== false);
        const general = uiGeneral ? !!uiGeneral.checked : (def.general !== false);

        return { enabled, issuer, product, general };
      })(),

      performance: chk('rr-performance', REPORT_DEFAULTS.sections.performance),

      marketRisk: {
        enabled:       chk('rr-marketRisk-enabled',  REPORT_DEFAULTS.sections.marketRisk.enabled),
        details:       chk('rr-marketRisk-details',  REPORT_DEFAULTS.sections.marketRisk.details),
        sensitivities: chk('rr-marketRisk-sens',     REPORT_DEFAULTS.sections.marketRisk.sensitivities),
      },

      creditRisk: {
        enabled: chk('rr-creditRisk-enabled', REPORT_DEFAULTS.sections.creditRisk.enabled),
        details: chk('rr-creditRisk-details', REPORT_DEFAULTS.sections.creditRisk.details),
      },

      liquidity: {
        enabled: chk('rr-liquidity-enabled', REPORT_DEFAULTS.sections.liquidity.enabled),
      },

      marketData: {
        enabled:       chk('rr-marketData-enabled',   REPORT_DEFAULTS.sections.marketData.enabled),
        interestRates: chk('rr-marketData-ir',        REPORT_DEFAULTS.sections.marketData.interestRates),
        creditSpreads: chk('rr-marketData-cs',        REPORT_DEFAULTS.sections.marketData.creditSpreads),
      },

      // 🆕 HIER: Historic-Section
      historic: {
        // Checkbox mit id="rr-historic-enabled"
        enabled: chk(
          'rr-historic-enabled',
          (REPORT_DEFAULTS.sections.historic && REPORT_DEFAULTS.sections.historic.enabled) ?? true
        ),
      },

      appendixProducts: chk('rr-appendixProducts', REPORT_DEFAULTS.sections.appendixProducts),
    },
    fileName:    val('rr-filename',    REPORT_DEFAULTS.fileName),
    paper:       val('rr-paper',       REPORT_DEFAULTS.paper),
    orientation: val('rr-orientation', REPORT_DEFAULTS.orientation),
  };
}





// Mini-Helfer: aus einem Canvas ein kleines PNG bauen
const __thumbCache = new Map(); // key = id@WxH -> HTML

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



// sammelt bis zu `max` Pie-Chart-Canvases aus #pieChartGrid (oder .pieChart)
function canvasThumbsBreakdown(max = 12, w = 160) {
  const opts = getRiskReportOptions();
  const bd = opts.sections.portfolioBreakdown || { enabled: true, issuer: true, product: true, general: true };
  if (!bd.enabled) return [];

  const nodesAll = Array.from(document.querySelectorAll('#pieChartGrid canvas.pieChart'))
    .filter(c => c && c.width && c.height);

  const nodesFiltered = nodesAll.filter(c => {
    const id = (c.id || '').toLowerCase().replace('piechart', '');
    // Spalte aus Canvas-ID ableiten
    const col = BD_COLUMNS.find(C => id.includes(C.toLowerCase()));
    if (!col) return true; // unbekannt → nicht filtern

    // Gruppenflag aus Report Options
    const grpKey = BD_GROUP_OF[col]; // 'issuer' | 'product' | 'general'
    if (grpKey === 'issuer'  && !bd.issuer)  return false;
    if (grpKey === 'product' && !bd.product) return false;
    if (grpKey === 'general' && !bd.general) return false;

    // Per-Chart-Checkbox (Preview)
    const perCol = document.getElementById('rr-bd-' + col);
    if (perCol && !perCol.checked) return false;

    return true;
  });

  const nodes = nodesFiltered.slice(0, max);

  return nodes.map(c => {
    try {
      const r = c.width / c.height || 1.6;
      const h = Math.round(w / r);
      const title = c.dataset?.title || c.getAttribute('data-title') || '';
      const img = `<img src="${c.toDataURL('image/png')}" width="${w}" height="${h}" style="border:1px solid #444;border-radius:6px;background:#111;" />`;
      return title
        ? `<figure style="margin:0"><div>${img}</div><figcaption style="font-size:11px;opacity:.7;margin-top:4px">${title}</figcaption></figure>`
        : img;
    } catch { return ''; }
  }).filter(Boolean);
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







//RENDER:
function isVisible(el) {
  if (!el) return false;
  if (el.hidden) return false;
  const style = getComputedStyle(el);
  return style.display !== 'none' && style.visibility !== 'hidden' && style.opacity !== '0';
}



function renderRiskPreview() {
  // Mehrfach-Render verhindern
  if (typeof __riskRendering !== 'undefined' && __riskRendering) return;

  const wrap = document.getElementById('reportsRiskPreview');
  if (!wrap) return;

  const panel = document.getElementById('panel-reports-risk');
  if (!panel || !isVisible(panel)) return;

  __riskRendering = true;
  try {
    // 🔹 NEU: Thumbnail-Cache leeren, damit wir IMMER den aktuellen Chart-Stand sehen
    try {
      if (typeof clearThumbCache === 'function') clearThumbCache();
    } catch (e) {
      console.warn('[RiskPreview] clearThumbCache failed', e);
    }

    const opts = getRiskReportOptions();

    // Alle Thumbnails an einer Stelle definieren
    const thumbsFor = {
      breakdown: () => canvasThumbsBreakdown(12),

      // PERFORMANCE-BEREICH – exakt deine 4 Charts aus panel-performance
      performance: () => [
        safeThumb('euswapPortfolioYieldChart',   'EUSWAP Portfolio Yield'),
        safeThumb('euswapProductYieldChart',     'EUSWAP Product Yield'),
        safeThumb('durationSwapChart',           'Duration Swap'),
        safeThumb('durationProductYieldChart',   'Duration Product Yield'),
      ].filter(Boolean),

      // MARKET RISK – Basis (ohne historische Liniencharts, die kommen im "historic"-Block)
      marketRiskBase: () => [
        canvasThumb('tsEU1YChart'),
        canvasThumb('plMvarDistChart'),
        // canvasThumb('historicMarketRiskChart'), // Historic Market Risk → im "historic"-Block
      ].filter(Boolean),

      // SENSITIVITIES – historischer Sensitivities-Chart
      sensitivities: () => [
        // canvasThumb('historicPortfolioSensChart'), // wird zusätzlich im "historic"-Block gezeigt
      ].filter(Boolean),

      // CREDIT RISK – Basis (ohne historischen Credit-Risk-Chart)
      creditRiskBase: () => [
        canvasThumb('LossIssuerCombinedChart'),
        canvasThumb('LossIssuerCombinedESChart'),
        // canvasThumb('historicCreditRiskChart'), // Historic Credit Risk → im "historic"-Block
      ].filter(Boolean),

      // MARKET DATA – Interest Rates / Credit Spreads
      mdIR: () => [
        safeThumb('IRLineChart', 'Interest Rates'),
      ].filter(Boolean),

      mdCS: () => [
        safeThumb('CS_ChartCanvas', 'Credit Spreads'),
      ].filter(Boolean),

      liquidity: () => [canvasThumb('liquChart')].filter(Boolean),

      // 🔹 Sammel-Block für die historischen Charts (eigene Sektion)
      historic: () => [
        safeThumb('historicPortfolioYieldChart',     'Performance History'),
        safeThumb('historicPortfolioValueChart',   'Portfolio Value (Historic)'),
        safeThumb('historicPortfolioSensChart',    'Historical Sensitivities'),
        safeThumb('historicMarketRiskChart',      'Market Risk – Historic'),
        safeThumb('historicCreditRiskChart',    'Credit Risk – Historic'),
      ].filter(Boolean),
    };

    // Labels für "Sections included"
    const enabledLabels = [];
    if (opts.sections.portfolioBreakdown) enabledLabels.push('Portfolio Breakdown');
    if (opts.sections.performance)        enabledLabels.push('Performance');

    const mr = opts.sections.marketRisk;
    if (mr?.enabled) {
      const parts = [];
      if (mr.details)       parts.push('Details');
      if (mr.sensitivities) parts.push('Sensitivities');
      enabledLabels.push(`Market Risk${parts.length ? ' (' + parts.join(', ') + ')' : ''}`);
    }

    const cr = opts.sections.creditRisk;
    if (cr?.enabled) {
      enabledLabels.push('Credit Risk' + (cr.details ? ' (Details)' : ''));
    }

    if (opts.sections.marketData?.enabled) {
      const mdParts = [];
      if (opts.sections.marketData.interestRates) mdParts.push('Interest Rates');
      if (opts.sections.marketData.creditSpreads) mdParts.push('Credit Spreads');
      enabledLabels.push(`Market Data${mdParts.length ? ` (${mdParts.join(', ')})` : ''}`);
    }

    if (opts.sections.appendixProducts) {
      enabledLabels.push('Appendix: Products');
    }

    // Sections für die Preview sammeln
    const sections = [];

    // Portfolio Breakdown
    if (opts.sections.portfolioBreakdown) {
      const bdControlsHTML = buildBreakdownControlsHTML();
      sections.push({
        title: 'Portfolio Breakdown',
        thumbs: thumbsFor.breakdown(),
        extraHTML: bdControlsHTML,
      });
    }

    // Performance
    if (opts.sections.performance) {
      sections.push({
        title: 'Performance',
        thumbs: thumbsFor.performance(),
      });
    }

    // Market Risk (Basis + Details + Sensitivities)
    if (mr?.enabled) {
      // 1) Basis: Inputs + Basis-Thumbnails
      sections.push({
        title: 'Market Risk',
        thumbs: thumbsFor.marketRiskBase(),
        extraHTML: marketRiskInputsPreviewHTML(),
      });

      // 2) Detail-Sektion
      if (mr.details) {
        sections.push({
          title: 'Market Risk — Detail',
          thumbs: [],
          extraHTML: marketRiskDetailHTML({ heading: false }),
        });
      }

      // 3) Sensitivities mit Thumbnails
      if (mr.sensitivities) {
        sections.push({
          title: 'Sensitivities — Detail',
          thumbs: thumbsFor.sensitivities(),
          extraHTML: sensitivitiesDetailHTML({ heading: false }),
        });
      }
    }

    // Credit Risk
    if (cr?.enabled) {
      sections.push({
        title: 'Credit Risk',
        thumbs: thumbsFor.creditRiskBase(),
      });

      if (cr.details) {
        sections.push({
          title: 'Credit Risk — Details',
          thumbs: [],
          extraHTML: creditRiskDetailsPreviewHTML(),
        });
      }
    }

    // Liquidity
    if (opts.sections.liquidity?.enabled) {
      const liquHasAny =
        document.getElementById('liquChart') ||
        document.querySelector('#liquDataContainer table') ||
        document.querySelector('#issuerDataContainerLiqu table');

      if (liquHasAny) {
        sections.push({
          title: 'Liquidity',
          thumbs: thumbsFor.liquidity(),
          extraHTML: liquidityPreviewHTML(),
        });
      }
    }

    // 🔹 Historische Charts – direkt NACH Liquidity
    const histThumbs = thumbsFor.historic();
    if (histThumbs && histThumbs.length) {
      sections.push({
        title: 'Historic Performance & Risk',
        thumbs: histThumbs,
      });
    }

    // Market Data
    if (opts.sections.marketData?.enabled) {
      if (opts.sections.marketData.interestRates) {
        sections.push({
          title: 'Market Data — Interest Rates',
          thumbs: thumbsFor.mdIR(),
        });
      }
      if (opts.sections.marketData.creditSpreads) {
        sections.push({
          title: 'Market Data — Credit Spreads',
          thumbs: thumbsFor.mdCS(),
        });
      }
    }

    // HTML-Blöcke pro Section bauen
    const sectionBlocks = sections
      .map((sec) => {
        const hasThumbs = Array.isArray(sec.thumbs) && sec.thumbs.length > 0;
        const thumbsHTML = hasThumbs
          ? `<div style="display:flex;flex-wrap:wrap;gap:8px">${sec.thumbs.join('')}</div>`
          : '';
        const extra = sec.extraHTML ? `${sec.extraHTML}` : '';
        const content = `${extra || ''}${thumbsHTML}`;

        return `
          <div style="margin:12px 0 10px">
            <div style="font-weight:600;margin:0 0 6px">${sec.title}</div>
            ${content}
          </div>
        `;
      })
      .join('');

    // Gesamt-Preview in Wrap schreiben
    wrap.innerHTML = `
      <div style="padding:10px">
        <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
          <span style="opacity:.8">TOC:</span>
          <strong>${opts.includeTOC ? 'On' : 'Off'}</strong>
          <span style="opacity:.8;margin-left:12px">Format:</span>
          <code>${opts.paper.toUpperCase()} / ${opts.orientation === 'l' ? 'Landscape' : 'Portrait'}</code>
          <span style="opacity:.8;margin-left:12px">File:</span>
          <code>${opts.fileName}</code>
        </div>

        <div style="margin-bottom:8px">
          <div style="opacity:.8;margin-bottom:4px">Sections included:</div>
          <ul style="margin:0;padding-left:18px">
            ${enabledLabels.map((s) => `<li>${s}</li>`).join('')}
          </ul>
        </div>

        ${sectionBlocks || `<div style="opacity:.65;margin-top:8px">No sections enabled.</div>`}
      </div>
    `;

    try {
      wireBreakdownControlsOnce();
    } catch (e) {
      console.error(e);
    }
  } finally {
    __lastRenderTs = Date.now();
    __riskRendering = false;
  }
}





export function wireRiskPreview(force = false) {
  if (force) { try { teardownRiskPreview(); } catch {} }
  if (__riskWired && !force) return;
  __riskWired = true;

  const scheduleSafe = () => { try { scheduleRiskPreviewRender(); } catch (e) { console.error(e); } };

  // --- 1) Globaler, erzwungener Delegations-Mechanismus ---
  const evtTypes = ['input', 'change', 'click', 'keyup', 'pointerup'];
__riskDocDelegatedHandler = (ev) => {
  if (__riskRendering) return; // während Render ignorieren
  const t = ev.target;
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

  // --- 5) Initial erzwingen ---
  kick();
  try { mountBreakdownControlsInReportOptions(); } catch {}

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


// ───────── Market-Risk_INPUT – ─────────
function marketRiskInputsPreviewHTML() {
  // Tabellen aus dem DOM ziehen
  const inputsMini  = miniTbl('inputMVaRContainer', { maxRows: 8, maxCols: 8, maxWidth: 520 });
  const summaryMini = miniTbl('MVaRDataContainer0',  { maxRows: 10, maxCols: 4, maxWidth: 300 })
                   || miniTbl('MVaRDataContainer',   { maxRows: 10, maxCols: 4, maxWidth: 300 });

  // Wenn gar nichts da ist → nichts rendern
  if (!inputsMini && !summaryMini) return '';

  return `
    <div style="margin:6px 0 10px">
      <div style="font-weight:600;opacity:.9;margin:0 0 6px">Market Risk — Parameters & Summary</div>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(260px,1fr));align-items:start">
        ${inputsMini  ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Scenario Selection</div>${inputsMini}</div>` : ''}
        ${summaryMini ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">VaR / ES Summary</div>${summaryMini}</div>` : ''}
      </div>
    </div>
  `;
}

// ───────── Market-Risk – Detailblock (MVaR-Chart + Tabelle) ─────────
function marketRiskDetailHTML(opts = {}) {
  const withHeading = opts.heading !== false; // default: true

  const chartId = document.getElementById('MVaRChart') ? 'MVaRChart' : 'MVaRChart0';
  const tableId = document.getElementById('MVaRDataContainer') ? 'MVaRDataContainer' : 'MVaRDataContainer0';

  const chartImg  = chartId ? canvasThumb(chartId, 220) : '';
  const tableMini = tableId ? miniTbl(tableId, { maxRows: 8, maxCols: 8, maxWidth: 360 }) : '';

  if (!chartImg && !tableMini) return '';

  return `
    <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,.15);">
      ${withHeading ? `<div style="font-weight:600; opacity:.9; margin:0 0 8px">Market Risk — Detail</div>` : ''}
      <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap;">
        ${chartImg ? `<div>${chartImg}</div>` : ''}
        ${tableMini ? `<div style="flex:1 1 360px; min-width:280px;">${tableMini}</div>` : ''}
      </div>
    </div>
  `;
}

// ───────── Sensitivities (PV01/CPV01) – Charts + Tabellen ─────────
function sensitivitiesDetailHTML(opts = {}) {
  const withHeading = opts.heading !== false; // default: true

  const pvChartId  = document.getElementById('PV01Chart')  ? 'PV01Chart'  : (document.getElementById('PV01Chart0')  ? 'PV01Chart0'  : '');
  const cpvChartId = document.getElementById('CPV01Chart') ? 'CPV01Chart' : (document.getElementById('CPV01Chart0') ? 'CPV01Chart0' : '');
  const pvImg  = pvChartId  ? canvasThumb(pvChartId, 220)  : '';
  const cpvImg = cpvChartId ? canvasThumb(cpvChartId, 220) : '';

  const irTableId = document.getElementById('IRSensDataContainer') ? 'IRSensDataContainer'
                    : (document.getElementById('IRSensDataContainer0') ? 'IRSensDataContainer0' : '');
  const crTableId = document.getElementById('CRSensDataContainer') ? 'CRSensDataContainer'
                    : (document.getElementById('CRSensDataContainer0') ? 'CRSensDataContainer0' : '');

  // kompakte Tabellen mit globalen Defaults + leicht größerer Breite
  const irMini = irTableId ? miniTbl(irTableId, { maxRows: 8, maxCols: 10, maxWidth: 380 }) : '';
  const crMini = crTableId ? miniTbl(crTableId, { maxRows: 8, maxCols: 10, maxWidth: 380 }) : '';

  if (!pvImg && !cpvImg && !irMini && !crMini) return '';

  return `
    <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,.15);">
      ${withHeading ? `<div style="font-weight:600; opacity:.9; margin:0 0 8px">Sensitivities — Detail</div>` : ''}

      ${(pvImg || cpvImg) ? `
      <div style="display:flex; gap:12px; align-items:flex-start; flex-wrap:wrap; margin-bottom:10px;">
        ${pvImg  ? `<div><div style="font-size:11px;opacity:.75;margin-bottom:4px">PV01</div>${pvImg}</div>` : ''}
        ${cpvImg ? `<div><div style="font-size:11px;opacity:.75;margin-bottom:4px">CPV01</div>${cpvImg}</div>` : ''}
      </div>` : ''}

      ${(irMini || crMini) ? `
      <div style="display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));">
        ${irMini ? `<div><div style="font-size:11px;opacity:.75;margin:0 0 6px">PV01 Table</div>${irMini}</div>` : ''}
        ${crMini ? `<div><div style="font-size:11px;opacity:.75;margin:0 0 6px">CPV01 Table</div>${crMini}</div>` : ''}
      </div>` : ''}
    </div>
  `;
}

// ───────── Credit Risk – Detail-Panel (Top-Metriken, Charts, Tabellen) ─────────
function creditRiskDetailsPreviewHTML() {
  // Top-Metriken (klein & grid)
  const topRating = miniTbl('CVaR_ratingDataContainer', { maxRows: 8, maxCols: 8, maxWidth: 300 });
  const topMarket = miniTbl('CVaR_marketDataContainer', { maxRows: 8, maxCols: 8, maxWidth: 300 });
  const topNorm   = miniTbl('CVaR_normDataContainer',   { maxRows: 8, maxCols: 8, maxWidth: 300 });

  // Tabellen (EAD & Loss Issuer Varianten)
  const eadTbl = miniTbl('EADDataContainer', { maxRows: 10, maxCols: 12, maxWidth: 360 });
  const liR    = miniTbl('LossIssuerDataContainerRating',     { maxRows: 10, maxCols: 12, maxWidth: 360 });
  const liM    = miniTbl('LossIssuerDataContainerMarket',     { maxRows: 10, maxCols: 12, maxWidth: 360 });
  const liN    = miniTbl('LossIssuerDataContainerMarketNorm', { maxRows: 10, maxCols: 12, maxWidth: 360 });

  // Charts (als Thumbs)
  const lgdImg = canvasThumb('LGDChart', 200);
  const liRImg = canvasThumb('LossIssuerChartRating', 220);
  const liMImg = canvasThumb('LossIssuerChartMarket', 220);
  const liNImg = canvasThumb('LossIssuerChartMarketNorm', 220);

  const topBlock = (topRating || topMarket || topNorm) ? `
    <div style="margin-top:8px">
      <div style="font-weight:600;opacity:.9;margin:0 0 6px">Credit Metrics (Top)</div>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(240px,1fr))">
        ${topRating ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Historical</div>${topRating}</div>` : ''}
        ${topMarket ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Market Implied</div>${topMarket}</div>` : ''}
        ${topNorm   ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Risk Adjusted</div>${topNorm}</div>` : ''}
      </div>
    </div>` : '';

  const chartsBlock = (lgdImg || liRImg || liMImg || liNImg) ? `
    <div style="margin-top:12px">
      <div style="font-weight:600;opacity:.9;margin:0 0 6px">Charts</div>
      <div style="display:flex;flex-wrap:wrap;gap:10px;align-items:flex-start">
        ${lgdImg ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">LGD</div>${lgdImg}</div>` : ''}
        ${liRImg ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Loss Issuer (Historic)</div>${liRImg}</div>` : ''}
        ${liMImg ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Loss Issuer (Market)</div>${liMImg}</div>` : ''}
        ${liNImg ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Loss Issuer (Risk Adj.)</div>${liNImg}</div>` : ''}
      </div>
    </div>` : '';

  const tablesBlock = (eadTbl || liR || liM || liN) ? `
    <div style="margin-top:12px">
      <div style="font-weight:600;opacity:.9;margin:0 0 6px">Tables</div>
      <div style="display:grid;gap:10px;grid-template-columns:repeat(auto-fit,minmax(280px,1fr))">
        ${eadTbl ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">EAD Table</div>${eadTbl}</div>` : ''}
        ${liR    ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Loss Issuer (Historic)</div>${liR}</div>` : ''}
        ${liM    ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Loss Issuer (Market)</div>${liM}</div>` : ''}
        ${liN    ? `<div><div style="font-size:11px;opacity:.7;margin-bottom:4px">Loss Issuer (Risk Adj.)</div>${liN}</div>` : ''}
      </div>
    </div>` : '';

  const nothing = (!topBlock && !chartsBlock && !tablesBlock)
    ? `<div style="opacity:.65">No Credit-Risk details found (yet).</div>` : '';

  return `${topBlock}${chartsBlock}${tablesBlock}${nothing}`;
}

// ───────── Liquidity (Top-Metriken, Charts, Tabellen) ─────────
function liquidityPreviewHTML() {
  // kompakte Tabellen aus den bestehenden Containern
  const matxCat = miniTbl('liquDataContainer', { maxRows: 10, maxCols: 10, maxWidth: 380 });
  const issuers = miniTbl('issuerDataContainerLiqu', { maxRows: 10, maxCols: 10, maxWidth: 380 });

  if (!matxCat && !issuers) return ''; // nichts zu zeigen

  return `
    <div style="margin-top:10px; padding-top:8px; border-top:1px dashed rgba(255,255,255,.15);">
      <div style="display:grid; gap:12px; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));">
        ${matxCat ? `<div><div style="font-size:11px;opacity:.75;margin:0 0 6px">Maturities × Categories</div>${matxCat}</div>` : ''}
        ${issuers ? `<div><div style="font-size:11px;opacity:.75;margin:0 0 6px">Issuers</div>${issuers}</div>` : ''}
      </div>
    </div>
  `;
}


// RiskPDFPreview.js
document.addEventListener('reports:enter', () => {
  try { wireRiskPreview(); } catch (e) { console.error(e); }
  try { mountBreakdownControlsInReportOptions(); } catch {}
});

document.addEventListener('reports:leave', () => {
  try { teardownRiskPreview?.(); } catch (e) { console.error(e); }
});




