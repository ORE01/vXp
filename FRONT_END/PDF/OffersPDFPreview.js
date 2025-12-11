import { REPORT_DEFAULTS_OFFERS } from './OffersPDF.js';
import { handleModalAction } from '../../MODAL_HELPER/ModalActionHandler.js';
import { appState } from '../../FRONT_END/renderer.js';
import { drawYieldVsTimeChart, transformTSDataToEUSWFormat, swapPointToDurationAsYearRate } from '../../FRONT_END/ANALYSE_PORTFOLIO/SummaryYield.js';




// ===== Module state / guards =====
let __offersWired = false;
let __offersMO = null;                // MutationObserver
let __renderRAF = 0;                  // requestAnimationFrame id
let __isRendering = false;            // Re-Entrancy guard
window.__offersCharts = window.__offersCharts || {}; // Chart instances

function scheduleOffersPreviewRender(containerPreviewId = 'reportsOffersPreview', containerId = OFFERS_CONTAINER_ID) {
  if (__isRendering) return;                 // nicht re-entrant
  if (__renderRAF) return;                   // bereits geplant
  __renderRAF = requestAnimationFrame(() => {
    __renderRAF = 0;
    __isRendering = true;
    try {
      renderOffersPreview(containerPreviewId, containerId);
    } catch (e) {
      console.error('[OffersPreview] render error:', e);
    } finally {
      __isRendering = false;
    }
  });
}




















// === Chart.js Helper ===
window.__offersCharts = window.__offersCharts || {}; // { [canvasId]: ChartInstance }



// === Detail-Felder zentral ===
export const DETAIL_FIELDS = [
  ['PROD_ID','ISIN'],
  ['ISSUER','Emittent'],
  ['DESCRIPTION','Beschreibung'],
  ['RATING','Rating Emittent'],
  ['RATINGres','Rating Produkt'],
  ['MATURITY','Laufzeit'],
  ['COUPON_PCT','Coupon in %'],
  ['PRICE_BUY','Kurs aktuell'],
  ['LIMIT_PRICE','Kurslimit'],
  ['ytm','Rendite in % aktuell'],
  ['RANK','Rank'],
  ['ESG','ESG'],
  ['Depotbank','Depotbank'],
  ['NOTIONAL','Volumen in EUR'],
];





// ---------- Daten-Speicher nur für Preview ----------
let __offersReportRows = [];
export function setOffersReportData(rows) { __offersReportRows = Array.isArray(rows) ? rows : []; }
export function getOffersReportData()     { return __offersReportRows || []; }

// ---------- Helpers ----------
function getCurrentCustomer() {
  try {
    const arr = window.appState?.getCustomerData?.();
    return Array.isArray(arr) ? arr[0] : arr;
  } catch { return null; }
}

function escapeHtml(s='') {
  return String(s)
    .replace(/&/g,'&amp;')
    .replace(/</g,'&lt;')
    .replace(/>/g,'&gt;')
    .replace(/"/g,'&quot;')
    .replace(/'/g,'&#39;');
}

// ---------- UI / Optionen auslesen ----------
export function getOffersReportOptions() {
  const $   = (id) => document.getElementById(id);
  const val = (id, def) => { const el = $(id); const v = el?.value?.trim(); return v || def; };
  const chk = (id, def) => { const el = $(id); return el ? !!el.checked : def; };

  const DEF = REPORT_DEFAULTS_OFFERS || {};
  const S   = DEF.sections || { intro:true, detailsTable:true, productChart:true, durationChart:true, signature:true };

  const customer  = getCurrentCustomer();
  const DB_HEADER = customer?.pdf_header ?? DEF.headerText;

  return {
    includeTOC:  chk('or-includeTOC', DEF.includeTOC),
    sections: {
      intro:         chk('or-sect-intro',     S.intro),
      detailsTable:  chk('or-sect-details',   S.detailsTable),
      productChart:  chk('or-sect-chart',     S.productChart),
      durationChart: chk('or-sect-duration',  S.durationChart),
      signature:     chk('or-sect-signature', S.signature),
    },
    fileName:    val('or-filename',   DEF.fileName),
    paper:       DEF.paper,
    orientation: DEF.orientation,
    ids:         { ...(DEF.ids || {}) },
    headerText:  val('or-headerText', DB_HEADER),

    // detailsEnabled bleibt wie gehabt (falls du es hast)
    detailsEnabled: (typeof DETAIL_FIELDS !== 'undefined')
      ? DETAIL_FIELDS.reduce((acc,[key]) => {
          const el = document.getElementById(`or-df-${key}`);
          acc[key] = el ? !!el.checked : true;
          return acc;
        }, {})
      : {},
  };
}



// ---------- DOM-Parsing ----------
export const OFFERS_CONTAINER_ID = 'portDataContainer4';

export function parseOffersFromDOM(containerId = OFFERS_CONTAINER_ID) {
  const host = document.getElementById(containerId);
  const table = host?.querySelector('table');
  if (!table) return { headers: [], rows: [] };

  let headers = Array.from(table.querySelectorAll('thead th')).map(th => th.textContent.trim());
  let trs = Array.from(table.querySelectorAll('tbody tr'));

  if (!headers.length && trs.length) {
    const first = Array.from(trs[0].children);
    headers = first.map((_, i) => `COL_${i+1}`);
    trs = trs.slice(1);
  }
  const rows = trs.map(tr => Array.from(tr.children).map(td => (td.textContent || '').trim()));
  return { headers, rows };
}

export function rowsAsObjectsFrom(containerId = OFFERS_CONTAINER_ID, maxCols = 80, maxRows = 2000) {
  const host  = document.getElementById(containerId);
  const table = host?.querySelector('table');
  if (!table) return [];

  let headers = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent || '').trim());
  let trs     = Array.from(table.querySelectorAll('tbody tr'));

  if (!headers.length) {
    const allRows = trs.length ? trs : Array.from(table.querySelectorAll('tr'));
    if (allRows.length) {
      headers = Array.from(allRows[0].children).slice(0, maxCols).map((_, i) => `COL_${i+1}`);
      trs = allRows.slice(1);
    }
  }

  return trs.slice(0, maxRows).map(tr => {
    const cells = Array.from(tr.children).slice(0, maxCols);
    const obj = {};
    cells.forEach((td, i) => {
      const key = headers[i] || `COL_${i+1}`;
      obj[key] = (td.textContent || '').trim();
    });
    return obj;
  });
}

function rowsAsObjects(containerId = OFFERS_CONTAINER_ID) {
  const { headers, rows } = parseOffersFromDOM(containerId);
  return rows.map(r => Object.fromEntries(r.map((v,i)=>[headers[i]||`COL_${i+1}`, v])));
}

// ---------- Dropdown füllen ----------
export function populateOffersDropdown(selectId = 'reportsOffersDropdown', containerId = OFFERS_CONTAINER_ID) {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  const objs = rowsAsObjects(containerId);
  if (!objs.length) return;

  if (!sel.options.length) {
    const frag = document.createDocumentFragment();
    objs.forEach((o, i) => {
      const value = o.PROD_ID || o.ISIN || `${i}`;
      const label = o.DESCRIPTION || value;
      frag.appendChild(new Option(label, value));
    });
    sel.appendChild(frag);
  }
}

// ---------- kleine Preview-Helper ----------

const li = (txt) => `<li>${txt}</li>`;
const kvBox = (label, val) => `
  <div style="border:1px solid #444;border-radius:6px;padding:8px;background:#111">
    <div style="font-size:11px;opacity:.7;margin-bottom:4px">${label}</div>
    <div>${val}</div>
  </div>`;

// ---------- Preview Renderer ----------

export function renderOffersPreview(
  containerPreviewId = 'reportsOffersPreview',
  containerId = OFFERS_CONTAINER_ID
) {
  const wrap = document.getElementById(containerPreviewId);
  if (!wrap) return;

  // --- Optionen + Meta ---
  const opts = (() => { try { return getOffersReportOptions?.() || {}; } catch { return {}; } })();
  const sections = opts.sections || { intro:true, detailsTable:true, productChart:true, durationChart:true, signature:true };
  const fileName = opts.fileName || 'Veranlagungsvorschlag.pdf';

  // Kunde + Header-Vorbelegung
  const customer = getCurrentCustomer();
  const prefillHeader = (() => {
    try {
      const inputVal = (getOffersReportOptions?.().headerText || '').trim();
      return inputVal || customer?.pdf_header || '';
    } catch { return customer?.pdf_header || ''; }
  })();

  // --- Daten laden ---
  let rows = [];
  try {
    const data = getOffersReportData();
    if (Array.isArray(data) && data.length) rows = data;
  } catch {}
  if (!rows.length) rows = rowsAsObjectsFrom(containerId);

  // ✅ Selektierte DOM-Zeilen bevorzugen (Checkbox .offer-select ODER Spalte "SELECTED")
  let rowsToShow = rows;
  try {
    const selected = selectedOffersFromDOM(containerId);
    if (Array.isArray(selected) && selected.length) rowsToShow = selected;
  } catch {}

  if (!rowsToShow.length) {
    wrap.innerHTML = `
      <div style="padding:10px">
        ${controlsHTML(prefillHeader)}
        <div style="opacity:.65;padding:10px;border:1px dashed #444;border-radius:8px;margin-top:10px">
          Keine Daten gefunden.
        </div>
      </div>`;
    try { __syncOffersControlsWith(opts); } catch {}
    return;
  }

  // --- Offer Overview (alle selektierten oder alle) ---
  const detailsEnabled = opts.detailsEnabled || {}; // { KEY: true/false }

  const offerCardsHTML = sections.detailsTable
    ? rowsToShow.map((r, idx) => {
        // Titel/Label für jede Karte
        const title =
          r.DESCRIPTION?.trim() ||
          r.PROD_ID?.trim() ||
          r.ISIN?.trim() ||
          `Produkt ${idx + 1}`;

        // Feldraster
        const grid = DETAIL_FIELDS.map(([key, label]) => {
          const enabled = detailsEnabled[key] !== false; // default: true
          const val = r[key];
          if (!enabled || val == null || String(val).trim() === '') return '';
          return kvBox(label, String(val));
        }).filter(Boolean).join('');

        const gridHTML = grid
          ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">${grid}</div>`
          : `<div style="opacity:.65">Keine Detailfelder verfügbar.</div>`;

        return `
          <section class="offers-card" style="margin-bottom:10px">
            <div class="offers-card__header">
              <h3 class="offers-h3">${escapeHtml(title)}</h3>
            </div>
            <div class="offers-card__body">
              ${gridHTML}
            </div>
          </section>`;
      }).join('')
    : '';

  // Liste aktivierter Bereiche (nur Anzeige)
  const enabled = [];
  if (sections.intro)        enabled.push('Intro');
  if (sections.detailsTable) enabled.push('Details Table');
  if (sections.productChart) enabled.push('Product Chart');
  if (sections.durationChart) enabled.push('Duration Chart');
  if (sections.signature)    enabled.push('Signature Block');

  // --- Charts (einmalig) ---
  let chartHTML = '';
  if (sections.productChart) {
    chartHTML += `
      <section id="yieldChartSection" class="offers-card">
        <div class="offers-card__header">
          <h3 class="offers-h3">Product Yields vs Maturity</h3>
        </div>
        <div class="offers-card__body">
          <canvas id="offersProductYieldChart" class="lineChart"></canvas>
        </div>
      </section>`;
  }
  if (sections.durationChart) {
    chartHTML += `
      <section id="durationChartSection" class="offers-card" style="margin-top:12px">
        <div class="offers-card__header">
          <h3 class="offers-h3">Product Yields vs Duration</h3>
        </div>
        <div class="offers-card__body">
          <canvas id="durationOffersProductYieldChart" class="lineChart"></canvas>
        </div>
      </section>`;
  }

  // --- Signature ---
  const signatureHTML = sections.signature ? `
    <div style="margin:12px 0 10px">
      <div style="font-weight:600;margin:0 0 6px">Signature</div>
      <div style="border:1px dashed rgba(255,255,255,.2);border-radius:6px;padding:8px">
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px">
          <div>
            <div style="margin-bottom:12px;font-weight:600">Freigabe</div>
            <div style="border-top:1px solid #555;height:1px;margin:12px 0 4px"></div>
            <div style="opacity:.8">Ort, Datum</div>
          </div>
          <div>
            <div style="border-top:1px solid #555;height:1px;margin:24px 0 4px"></div>
            <div style="opacity:.8">Unterschrift</div>
            <div style="opacity:.8;margin-top:4px">Rektor Dr. Peter Riedler</div>
          </div>
        </div>
      </div>
    </div>` : '';

  // --- Kopfzeile ---
  const topBar = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <span style="opacity:.8">TOC:</span>
      <strong>${opts.includeTOC ? 'On' : 'Off'}</strong>
      <span style="opacity:.8;margin-left:12px">Format:</span>
      <code>${(opts.paper || 'a4').toUpperCase()} / ${opts.orientation === 'l' ? 'Landscape' : 'Portrait'}</code>
      <span style="opacity:.8;margin-left:12px">File:</span>
      <code>${fileName}</code>
      <span style="opacity:.8;margin-left:12px">Auswahl:</span>
      <code>${rowsToShow.length} Produkt${rowsToShow.length === 1 ? '' : 'e'}</code>
    </div>`;

  const sectionsList = `
    <div style="margin-bottom:8px">
      <div style="opacity:.8;margin-bottom:4px">Sections included:</div>
      <ul style="margin:0;padding-left:18px">
        ${enabled.map(li).join('')}
      </ul>
    </div>`;

  // --- Render ---
  wrap.innerHTML = `
    <div style="padding:10px">
      ${controlsHTML(prefillHeader)}
      ${topBar}
      ${sectionsList}

      <div style="margin:12px 0 10px">
        <div style="font-weight:600;margin:0 0 6px">Offer Overview</div>
        ${offerCardsHTML || `<div style="opacity:.65">Keine Detailfelder verfügbar.</div>`}
        ${chartHTML ? `<div style="margin-top:10px">${chartHTML}</div>` : ''}
      </div>

      ${signatureHTML}
    </div>
  `;

  // Controls syncen
  try { __syncOffersControlsWith(opts); } catch {}

  // Charts erst nach DOM-Einbau zeichnen
  if (sections.productChart || sections.durationChart) {
    try { if (sections.productChart) renderOffersProductChart(); } catch (e) { console.warn('[OffersPreview] product chart failed:', e); }
    try {
      if (sections.durationChart && typeof renderOffersDurationProductChart === 'function') {
        renderOffersDurationProductChart();
      } else if (sections.durationChart) {
        console.warn('[OffersPreview] renderOffersDurationProductChart() not found');
      }
    } catch (err) {
      console.warn('[OffersPreview] duration chart failed:', err);
    }
  }
}


// Liest aus dem Offers-Table alle selektierten Zeilen.
// Erkannt werden:
//  - Checkbox pro Zeile: <input type="checkbox" class="offer-select">
//  - ODER Spalte "SELECTED" (1/true/x/yes)
function selectedOffersFromDOM(containerId = OFFERS_CONTAINER_ID, maxCols = 80) {
  const host  = document.getElementById(containerId);
  const table = host?.querySelector('table');
  if (!table) return [];

  const headers = Array.from(table.querySelectorAll('thead th')).map(th => (th.textContent || '').trim());
  const trs     = Array.from(table.querySelectorAll('tbody tr'));

  const isRowSelected = (tr) => {
    // a) Checkbox
    const cb = tr.querySelector('input[type="checkbox"].offer-select');
    if (cb) return !!cb.checked;
    // b) Spalte SELECTED
    const tds = Array.from(tr.children);
    const idx = headers.findIndex(h => /^selected$/i.test(h));
    if (idx >= 0) {
      const v = (tds[idx]?.textContent || '').trim().toLowerCase();
      if (['1','true','x','yes'].includes(v)) return true;
    }
    return false;
  };

  const picked = trs.filter(isRowSelected);
  return picked.map(tr => {
    const cells = Array.from(tr.children).slice(0, maxCols);
    const obj = {};
    cells.forEach((td, i) => {
      const key = headers[i] || `COL_${i+1}`;
      obj[key] = (td.textContent || '').trim();
    });
    return obj;
  });
}



// ---------- Controls (nur Header) ----------
function controlsHTML(prefillHeader = '') {
  const DEF = REPORT_DEFAULTS_OFFERS || {};
  const S   = DEF.sections || { intro:true, detailsTable:true, productChart:true, durationChart:true, signature:true };

  const currentFile   = (document.getElementById('or-filename')?.value || '').trim() || (DEF.fileName || 'Veranlagungsvorschlag.pdf');
  const currentHeader = (document.getElementById('or-headerText')?.value || '').trim() || (prefillHeader || DEF.headerText || '');

  // aktuelle Aktivierung aus DOM lesen (falls schon vorhanden), Default = true
  const detailsEnabledFromDom = DETAIL_FIELDS.reduce((acc, [key]) => {
    const el = document.getElementById(`or-df-${key}`);
    acc[key] = el ? !!el.checked : true;
    return acc;
  }, {});

  return `
    <div class="offers-controls">
      <div class="row">
        <label> Dateiname
          <input id="or-filename" class="offers-input" type="text" value="${escapeHtml(currentFile)}" />
        </label>
      </div>

      <div class="row">
        <div class="switches">
          <label><input id="or-includeTOC" type="checkbox" ${DEF.includeTOC ? 'checked' : ''}/> Inhaltsverzeichnis</label>
        </div>
      </div>

      <div class="row">
        <div class="switches">
          <label><input id="or-sect-intro"        type="checkbox" ${S.intro         ? 'checked' : ''}/> Intro</label>
          <label><input id="or-sect-details"      type="checkbox" ${S.detailsTable  ? 'checked' : ''}/> Details-Tabelle</label>
          <label><input id="or-sect-chart"        type="checkbox" ${S.productChart  ? 'checked' : ''}/> Produkt-Chart</label>
          <label><input id="or-sect-duration"     type="checkbox" ${S.durationChart ? 'checked' : ''}/> Duration-Chart</label>
          <label><input id="or-sect-signature"    type="checkbox" ${S.signature     ? 'checked' : ''}/> Signature-Block</label>
        </div>
      </div>

      <div class="row">
        <label>Header-Text
          <textarea id="or-headerText" class="offers-textarea" rows="3">${escapeHtml(currentHeader)}</textarea>
          <div style="display:flex;gap:8px;align-items:center;margin-top:6px">
            <button id="offersSaveHeaderButton" type="button">Header speichern</button>
            <span id="or-saveStatusHeader"></span>
          </div>
        </label>
      </div>

      <!-- Detail-Feld-Auswahl -->
      <div class="row" style="margin-top:8px">
        <div class="checks">
          ${DETAIL_FIELDS.map(([key,label]) => {
            const checked = detailsEnabledFromDom[key] !== false ? 'checked' : '';
            return `
              <label>
                <input id="or-df-${key}" type="checkbox" ${checked}/>
                <span>${escapeHtml(label)}</span>
              </label>`;
          }).join('')}
        </div>
      </div>
    </div>
  `;
}




// ---------- Wiring (ohne Footer) ----------
export function wireOffersPreview({
  containerPreviewId = 'reportsOffersPreview',
  containerId        = OFFERS_CONTAINER_ID,
  dropdownId         = 'reportsOffersDropdown',
  inputIds           = ['or-filename','or-headerText'],
} = {}) {
  // Mehrfach-Init vermeiden
  if (__offersWired) {
    // nur, wenn Daten schon da sind, rendern
    if (window.__offersDataReady) {
      scheduleOffersPreviewRender(containerPreviewId, containerId);
    }
    return;
  }
  __offersWired = true;

  // Safety: globale Helfer initialisieren
  window.__offersHandlers  = window.__offersHandlers || [];
  window.__offersDataReady = !!window.__offersDataReady;

  // Dropdown füllen (Best Effort)
  try { populateOffersDropdown(dropdownId, containerId); } catch {}



  // Inputs -> Preview (delegiert an Scheduler; der rendert nur wenn DataReady)
  inputIds.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    const onInput  = () => scheduleOffersPreviewRender(containerPreviewId, containerId);
    const onChange = () => scheduleOffersPreviewRender(containerPreviewId, containerId);
    el.addEventListener('input',  onInput);
    el.addEventListener('change', onChange);
    window.__offersHandlers.push([el, 'input', onInput], [el, 'change', onChange]);
  });

  // Delegation auf den Preview-Wrapper
  const wrap = document.getElementById(containerPreviewId);
  if (wrap) {
    const onClick = (ev) => {
      const h = ev.target.closest('#offersSaveHeaderButton');
      if (h) { ev.preventDefault(); ev.stopPropagation(); handleSaveHeader(ev); }
    };
    const onInput = (ev) => {
      if (ev.target?.id === 'or-headerText') return;
      scheduleOffersPreviewRender(containerPreviewId, containerId);
    };
    const onChange = (ev) => {
      const id = ev.target?.id;
      if (!id) return;
      if (id === 'or-includeTOC' || id === 'or-sect-intro' || id === 'or-sect-details' ||
          id === 'or-sect-chart' || id === 'or-sect-signature' || id.startsWith('or-df-')) {
        scheduleOffersPreviewRender(containerPreviewId, containerId);
      }
    };
    wrap.addEventListener('click', onClick);
    wrap.addEventListener('input', onInput);
    wrap.addEventListener('change', onChange);
    window.__offersHandlers.push([wrap,'click',onClick],[wrap,'input',onInput],[wrap,'change',onChange]);
  }

  // MutationObserver – nur EINMAL und nur auf Daten-Container
  const host = document.getElementById(containerId);
  if (host && !__offersMO) {
    __offersMO = new MutationObserver(() => {
      scheduleOffersPreviewRender(containerPreviewId, containerId);
    });
    __offersMO.observe(host, { childList: true, subtree: true, characterData: true });
  }

  // --- Data-Ready/Clear Events (Gate fürs Rendern) ---
  const onOffersReady = () => {
    window.__offersDataReady = true;
    scheduleOffersPreviewRender(containerPreviewId, containerId);
  };
  const onOffersClear = () => {
    window.__offersDataReady = false;
    // optional: Preview leeren
    // const w = document.getElementById(containerPreviewId);
    // if (w) w.innerHTML = '';
  };
  window.addEventListener('offers:data-ready', onOffersReady);
  window.addEventListener('offers:data-clear', onOffersClear);
  window.__offersHandlers.push(
    [window, 'offers:data-ready', onOffersReady],
    [window, 'offers:data-clear', onOffersClear],
  );

  // Initiales Render nur, wenn Daten bereits vorhanden sind
  if (window.__offersDataReady) {
    scheduleOffersPreviewRender(containerPreviewId, containerId);
  }
}



function __syncOffersControlsWith(opts) {
  const setC = (id, v) => { const el = document.getElementById(id); if (el) el.checked = !!v; };
  const setV = (id, v) => { const el = document.getElementById(id); if (el && v != null) el.value = String(v); };

  setC('or-includeTOC', opts.includeTOC);

  const s = opts.sections || {};
  setC('or-sect-intro',        !!s.intro);
  setC('or-sect-details',      !!s.detailsTable);
  setC('or-sect-chart',        !!s.productChart);
  setC('or-sect-duration',     !!s.durationChart);   // <<< neu
  setC('or-sect-signature',    !!s.signature);

  setV('or-filename',  opts.fileName);
  if (opts.headerText != null && String(opts.headerText).trim() !== '') {
    setV('or-headerText', opts.headerText);
  }

  // (optional) detailsEnabled spiegeln …
  if (opts.detailsEnabled) {
    Object.entries(opts.detailsEnabled).forEach(([key, isOn]) => {
      const el = document.getElementById(`or-df-${key}`);
      if (el) el.checked = !!isOn;
    });
  }
}


// ===== CONSTANTS =====
const PREVIEW_ID = 'reportsOffersPreview';

// ===== HEADER: Button-Binding + Handler (persist-Variante) =====
(function bindHeaderSave() {
  const wrap = document.getElementById(PREVIEW_ID);
  if (!wrap) return;

  const btn = wrap.querySelector('#offersSaveHeaderButton');
  if (!btn || btn.dataset.bound) return;
  btn.dataset.bound = '1';

  btn.addEventListener('click', async (event) => {
    if (typeof handleModalAction === 'function') {
      const res = await handleModalAction(event);
      if (res === false || res === 0) return;
    }
    setTimeout(() => handleOffersHeaderEditAction(), 0);
  });
})();

function handleOffersHeaderEditAction() {
  const wrap   = document.getElementById(PREVIEW_ID);
  const btn    = wrap?.querySelector('#offersSaveHeaderButton');
  const inputH = wrap?.querySelector('#or-headerText');
  const status = wrap?.querySelector('#or-saveStatusHeader');

  const setStatus = (t)=>{ if (status) status.textContent = t; };
  const setBtn    = (t)=>{ if (btn && t != null) btn.textContent = t; };

  const saveOne = (payload) => new Promise((resolve, reject) => {
    const onOk  = () => resolve();
    const onErr = (msg='Unbekannter Fehler') => reject(new Error(msg));
    window.api.once('update-customer-texts-success', onOk);
    window.api.once('update-customer-texts-error',  onErr);
    window.api.send('update-customer-texts', payload);
  });

  try {
    if (btn) btn.disabled = true;
    setBtn('Speichere…'); setStatus('Speichere…');

    const arr = window.appState?.getCustomerData?.();
    const customer = Array.isArray(arr) ? arr[0] : arr;
    if (!customer?.id) throw new Error('Kein Customer geladen.');
    if (!window.api?.send || !window.api?.once) throw new Error('IPC-Bridge fehlt.');

    const headerVal = (inputH?.value ?? '').trim();
    console.log('[SAVE header] sending', { id: customer.id, headerVal });

    // Nur pdf_header senden
    saveOne({ customer_id: customer.id, pdf_header: headerVal })
      .then(() => {
        try { customer.pdf_header = headerVal; } catch {}
        setStatus('✓ Gespeichert'); setBtn('Header speichern');
        if (btn) btn.disabled = false;
        try { scheduleOffersPreviewRender(PREVIEW_ID, 'portDataContainer4'); } catch {}
        setTimeout(() => { if (status) status.textContent = ''; }, 1200);
      })
      .catch(err => {
        setStatus('❌ ' + (err?.message || String(err)));
        setBtn('Header speichern'); if (btn) btn.disabled = false;
      });

  } catch (err) {
    setStatus('❌ ' + (err?.message || String(err)));
    setBtn('Header speichern'); if (btn) btn.disabled = false;
  }
}

    // Sucht optional den RowIndex der Customer-Zeile für handleFormAction (falls benötigt)
    function findCustomerRowIndex(customerId) {
      try {
        // Falls du eine zentrale Table-Quelle hast – bitte anpassen:
        // Beispiel: window.appState.getTableData('Customer') -> Array von Zeilen mit .id
        const rows = window.appState?.getTableData?.('Customer');
        if (Array.isArray(rows)) {
          const idx = rows.findIndex(r => String(r?.id) === String(customerId));
          return idx >= 0 ? idx : null;
        }
      } catch {}
      return null; // handleFormAction kann i.d.R. auch nur mit {id,...} arbeiten
    }

export function renderOffersProductChart() {
  const CID = 'offersProductYieldChart';

  // Canvas vorhanden?
  const canvas = document.getElementById(CID);
  if (!canvas) {
    console.warn('[Offers] Canvas nicht gefunden:', CID);
    return;
  }

  // === alte Chart-Instanz sicher zerstören (v3+ kompatibel) ===
  try {
    if (window.Chart?.getChart) {
      const ex = window.Chart.getChart(CID);
      if (ex && typeof ex.destroy === 'function') ex.destroy();
    } else if (window.__offersCharts?.[CID]?.destroy) {
      window.__offersCharts[CID].destroy();
      delete window.__offersCharts[CID];
    }
  } catch (e) {
    console.warn('[Offers] destroy (product) warn:', e);
  }

  // === Daten holen/aufbereiten ===
  const EUSWData = appState.getEUSWData?.() || [];
  const TSData   = appState.getTblTSData?.() || [];
  if (!EUSWData.length || !TSData.length) {
    console.warn('[Offers] EUSW/TS fehlen.');
    return;
  }

  const latestRow  = TSData[TSData.length - 1];
  const yieldCurve = transformTSDataToEUSWFormat(latestRow) || [];

  // Nur echte Offers-Zeilen (beginnt mit OFFER/OFFERS)
  const rawAll = appState.getFilteredPortData?.('OFFERS_DATA') || [];
  const raw = rawAll.filter(r => {
    const idStr = String(
      r.PORTFOLIO ?? r.Portfolio ?? r.portfolio ??
      r.Depotbank ?? r.DEPOTBANK ??
      r.ACCOUNT ?? r.account ??
      r.BOOK ?? r.Book ?? ''
    ).trim();
    return /^offers?/i.test(idStr);
  });

  // Produktpunkte wie im Summary, aber defensiv normalisiert
  const points = raw.map((r, i) => {
    let TtM = Number.isFinite(+r.TtM) ? +r.TtM
            : Number.isFinite(+r.x)   ? +r.x
            : NaN;
    if (!Number.isFinite(TtM) && r.MATURITY) {
      const mat = new Date(r.MATURITY);
      if (!isNaN(mat)) {
        const MSY = 365.25 * 24 * 3600 * 1000;
        TtM = Math.max(0, (mat - new Date()) / MSY);
      }
    }

    let ytm = (typeof r.ytm === 'number') ? r.ytm
            : (typeof r.ytm === 'string'
                ? (r.ytm.includes('%')
                    ? parseFloat(r.ytm.replace(',', '.')) / 100
                    : parseFloat(r.ytm.replace(',', '.')))
                : NaN);

    const PROD_ID = String(r.PROD_ID ?? `Produkt_${i+1}`);
    return (Number.isFinite(TtM) && Number.isFinite(ytm)) ? { TtM, ytm, PROD_ID } : null;
  }).filter(Boolean);

  console.log('[Offers] lens:', {
    yieldCurve: yieldCurve.length,
    EUSWData: EUSWData.length,
    points: points.length
  });

  // === Chart neu zeichnen ===
  drawYieldVsTimeChart({
    targetId: CID,
    heading: 'Product Yields vs Maturity',
    yieldCurve,
    pastYieldCurve: [],          // bewusst leer
    euswDataOriginal: EUSWData,
    points
  });

  // Instanz registrieren (für späteres Destroy)
  try {
    window.__offersCharts = window.__offersCharts || {};
    if (window.Chart?.getChart) {
      const inst = window.Chart.getChart(CID);
      if (inst) window.__offersCharts[CID] = inst;
    }
  } catch (e) {
    console.warn('[Offers] register (product) warn:', e);
  }
}


export function renderOffersDurationProductChart() {
  const CID = 'durationOffersProductYieldChart';

  // === Canvas sicherstellen (im richtigen Section) ===
  const getOrCreateCanvas = (canvasId, sectionId = 'durationChartSection') => {
    let canvas = document.getElementById(canvasId);
    if (canvas) return canvas;
    const container =
      document.getElementById(sectionId) ||
      document.getElementById('reportsOffersPreview') ||
      document.body;
    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.className = 'lineChart'; // Styling kommt aus CSS (schwarzer BG etc.)
    container.appendChild(canvas);
    return canvas;
  };
  const canvas = getOrCreateCanvas(CID, 'durationChartSection');

  // === Alte Chart-Instanz zerstören (Chart.js v3+) ===
  try {
    if (window.Chart?.getChart) {
      const ex = window.Chart.getChart(CID);
      if (ex && typeof ex.destroy === 'function') ex.destroy();
    } else if (window.__offersCharts?.[CID]?.destroy) {
      window.__offersCharts[CID].destroy();
      delete window.__offersCharts[CID];
    }
  } catch (e) {
    console.warn('[DurationChart] destroy warn:', e);
  }

  // === Daten laden ===
  const EUSWData = appState.getEUSWData?.() || [];
  const TSData   = appState.getTblTSData?.() || [];
  if (!Array.isArray(EUSWData) || !EUSWData.length || !Array.isArray(TSData) || !TSData.length) {
    console.warn('[DurationChart] EUSW/TS fehlen – übersprungen');
    return;
  }

  const latestRow  = TSData[TSData.length - 1];
  const yieldCurve = transformTSDataToEUSWFormat(latestRow) || [];
  if (!yieldCurve.length) {
    console.warn('[DurationChart] yieldCurve leer – übersprungen');
    return;
  }

  // === Hilfsfunktionen ===
  const parsePctToNumber = (v) => {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    const s = String(v).replace(',', '.').replace('%','').trim();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };
  // PV01rel (%/bp) → Duration[J] (vereinfachte Mod->Macaulay)
  const pv01relToDurationYears = (pv01rel, ytm) => {
    const pv01PctPerBp = Math.abs(parsePctToNumber(pv01rel)); // z.B. 0.45
    if (!Number.isFinite(pv01PctPerBp)) return NaN;
    const yPct = parsePctToNumber(ytm); // 2.45
    const y    = Number.isFinite(yPct) ? (yPct / 100) : 0;
    return pv01PctPerBp * (1 + y);
  };

  // === Duration-Kurven aus Swap-Daten ableiten ===
  const durationCurve    = yieldCurve.map(swapPointToDurationAsYearRate).filter(Boolean);
  const durationEUSWData = EUSWData.map(swapPointToDurationAsYearRate).filter(Boolean);

  // === Produktpunkte: x = Duration[J], y = YTM[%] ===
  const rawAll = appState.getFilteredPortData?.('OFFERS_DATA') || [];
  const raw = rawAll.filter(r => {
    const idStr = String(
      r.PORTFOLIO ?? r.Portfolio ?? r.portfolio ??
      r.Depotbank ?? r.DEPOTBANK ??
      r.ACCOUNT ?? r.account ??
      r.BOOK ?? r.Book ?? ''
    ).trim();
    return /^offers?/i.test(idStr);
  });

  const productDurationPoints = raw.map((r, i) => {
    const xSource = r.PV01rel ?? r.PV01 ?? r.duration;
    const x = pv01relToDurationYears(xSource, r.ytm);

    let y;
    if (typeof r.ytm === 'number') {
      y = (r.ytm <= 1 ? r.ytm * 100 : r.ytm);
    } else if (typeof r.ytm === 'string') {
      const s = r.ytm.replace(',', '.').replace('%', '').trim();
      const n = parseFloat(s);
      y = Number.isFinite(n) ? n : NaN;
    } else {
      y = NaN;
    }

    const PROD_ID = String(r.PROD_ID ?? `Produkt_${i+1}`);
    const ok = Number.isFinite(x) && x >= 0 && x <= 15 &&
               Number.isFinite(y) && Math.abs(y) <= 50;
    if (!ok) {
      console.warn('[DurationChart] skip product point', {
        i, PROD_ID, x, y, src: { PV01rel: r.PV01rel, PV01: r.PV01, duration: r.duration, ytm: r.ytm }
      });
      return null;
    }
    return { x, y, PROD_ID };
  }).filter(Boolean);

  // === Zeichnen ===
  drawYieldVsTimeChart({
    targetId: CID,
    heading: 'Product Yields vs Duration',
    yieldCurve: durationCurve,
    pastYieldCurve: [],
    euswDataOriginal: durationEUSWData,
    points: productDurationPoints
  });

  // Instanz registrieren (für späteres Destroy)
  try {
    window.__offersCharts = window.__offersCharts || {};
    if (window.Chart?.getChart) {
      const inst = window.Chart.getChart(CID);
      if (inst) window.__offersCharts[CID] = inst;
    }
  } catch (e) {
    console.warn('[DurationChart] register warn:', e);
  }
}



function handleSaveHeader(ev) {
  const btn = document.getElementById('offersSaveHeaderButton');
  const st  = document.getElementById('or-saveStatusHeader');
  const inp = document.getElementById('or-headerText');
  const val = (inp?.value ?? '');

  const setStatus = t => { if (st) st.textContent = t || ''; };
  const setBtn    = t => { if (btn && t != null) btn.textContent = t; };

  (async () => {
    try {
      const arr = window.appState?.getCustomerData?.();
      const customer = Array.isArray(arr) ? arr[0] : arr;
      if (!customer?.id) throw new Error('Kein Customer geladen.');

      if ((val || '').trim() === '') {
        setStatus('– Keine Änderung (leer) –');
        setTimeout(() => { if (st && st.textContent.includes('Keine Änderung')) st.textContent = ''; }, 1000);
        return;
      }

      // optionaler RowIndex
      let rowIndex = null;
      try {
        const rows = window.appState?.getTableData?.('Customer');
        if (Array.isArray(rows)) {
          const idx = rows.findIndex(r => String(r?.id) === String(customer.id));
          rowIndex = idx >= 0 ? idx : null;
        }
      } catch {}

      if (btn) btn.disabled = true;
      setBtn('Speichere…'); setStatus('Speichere…');

      const res = handleModalAction(ev, { id: customer.id, pdf_header: val }, rowIndex, 'Customer', 'edit');
      if (res && typeof res.then === 'function') await res;

      try { customer.pdf_header = val; } catch {}
      setStatus('✓ Gespeichert'); setBtn('Header speichern');
    } catch (err) {
      setStatus('❌ ' + (err?.message || String(err))); setBtn('Header speichern');
    } finally {
      if (btn) btn.disabled = false;
      setTimeout(() => { if (st && st.textContent.startsWith('✓')) st.textContent = ''; }, 1200);
    }
  })();
}

// irgendwo oben im Modul (falls noch nicht vorhanden):
let __offersDataReady = false;                 // Gate fürs Rendering
window.__offersHandlers = window.__offersHandlers || []; // [ [event, fn], ... ]

export function teardownOffersPreview() {
  // 1) RAF & Render-Flags
  try {
    if (typeof __renderRAF !== 'undefined' && __renderRAF) {
      cancelAnimationFrame(__renderRAF);
      __renderRAF = 0;
    }
  } catch {}
  if (typeof __isRendering !== 'undefined') __isRendering = false;

  // 2) Observer
  if (typeof __offersMO !== 'undefined' && __offersMO) {
    try { __offersMO.disconnect(); } catch {}
    __offersMO = null;
  }

  // 3) Charts zerstören (Registry + Safety-Net)
  try {
    // a) deine Registry
    if (window.__offersCharts && typeof window.__offersCharts === 'object') {
      Object.values(window.__offersCharts).forEach(inst => {
        try { inst?.destroy?.(); } catch {}
      });
      window.__offersCharts = {};
    }

    // b) Chart.js über Canvas (funktioniert in v3/v4)
    const destroyByCanvas = (c) => {
      if (!c) return;
      try {
        if (window.Chart && typeof window.Chart.getChart === 'function') {
          const inst = window.Chart.getChart(c);   // Canvas-Element reicht
          if (inst?.destroy) inst.destroy();
        } else if (c.__chartInstance) {
          try { c.__chartInstance.destroy(); } catch {}
          c.__chartInstance = null;
        }
      } catch (e) {
        console.warn('[OffersPreview] chart teardown warn:', c.id, e);
      }
    };

    // bekannte IDs + Fallback: alle offers-Canvases
    const canvases = [
      ...document.querySelectorAll('#offersProductYieldChart, #durationOffersProductYieldChart, canvas[id*="offers"]')
    ];
    canvases.forEach(destroyByCanvas);
  } catch (e) {
    console.warn('[OffersPreview] chart teardown warn:', e);
  }

  // 4) Event-Listener entfernen (die beim Wire registriert wurden)
  try {
    (window.__offersHandlers || []).forEach(([evt, fn]) => {
      try { window.removeEventListener(evt, fn); } catch {}
    });
  } catch {}
  window.__offersHandlers = [];

  // 5) (Optional) Styles entfernen
  try {
    const st = document.getElementById('offersPreviewStyles');
    if (st?.parentNode) st.parentNode.removeChild(st);
  } catch {}

  // 6) Flags zurücksetzen
  __offersDataReady = false;
  if (typeof __offersWired !== 'undefined') __offersWired = false;
}











