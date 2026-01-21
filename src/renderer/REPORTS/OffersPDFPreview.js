import { REPORT_DEFAULTS_OFFERS } from './OffersPDF.js';
import { handleModalAction } from '../UI/MODAL_HELPER/ModalActionHandler.js';
import { appState } from '../../renderer/renderer.js';
import { drawYieldVsTimeChart, transformTSDataToEUSWFormat, swapPointToDurationAsYearRate } from '../../renderer/ANALYSE_PORTFOLIO/SummaryYield.js';




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
    try { if (sections.productChart) renderOffersProductChart(rowsToShow); } catch (e) { console.warn('[OffersPreview] product chart failed:', e); }
    try {
      if (sections.durationChart && typeof renderOffersDurationProductChart === 'function') {
        renderOffersDurationProductChart(rowsToShow);
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

// export function renderOffersProductChart(rowsToShow = []) {
//   const CID = 'offersProductYieldChart';
//   const canvas = document.getElementById(CID);
//   if (!canvas) { console.warn('[Offers] Canvas nicht gefunden:', CID); return; }

//   // Height-Safety (sonst 0px Container = unsichtbar)
//   try { canvas.parentElement && (canvas.parentElement.style.minHeight = '320px'); } catch {}

//   // Destroy
//   try {
//     if (window.Chart?.getChart) {
//       const ex = window.Chart.getChart(CID);
//       if (ex?.destroy) ex.destroy();
//     } else if (window.__offersCharts?.[CID]?.destroy) {
//       window.__offersCharts[CID].destroy();
//       delete window.__offersCharts[CID];
//     }
//   } catch (e) { console.warn('[Offers] destroy(product) warn:', e); }

//   const rows = Array.isArray(rowsToShow) ? rowsToShow : [];
//   if (!rows.length) { console.warn('[Offers] rowsToShow leer -> kein Chart'); return; }

//   // Curve: TS optional, fallback nur EUSW (wenn draw-Funktion das akzeptiert)
//   const EUSWData = appState.getEUSWData?.() || [];
//   const TSData   = appState.getTblTSData?.() || [];
//   const latestRow = Array.isArray(TSData) && TSData.length ? TSData[TSData.length - 1] : null;

//   const yieldCurve = latestRow ? (transformTSDataToEUSWFormat(latestRow) || []) : [];
//   if (!yieldCurve.length && !EUSWData.length) {
//     console.warn('[Offers] Weder TS yieldCurve noch EUSWData vorhanden -> skip');
//     return;
//   }

//   // Punkte aus rowsToShow (DB/DOM)
//   const MSY = 365.25 * 24 * 3600 * 1000;

//   const points = rows.map((r, i) => {
//     const PROD_ID = String(r.PROD_ID ?? r.ISIN ?? `Produkt_${i+1}`);

//     // X: TtM oder MATURITY (Datum) -> Years-to-maturity
//     let TtM = toNum(r.TtM ?? r.ttm ?? r.x);
//     if (!Number.isFinite(TtM)) {
//       const mat = toDate(r.MATURITY ?? r.maturity);
//       if (mat) TtM = Math.max(0, (mat - new Date()) / MSY);
//     }
//     if (!Number.isFinite(TtM)) return null;

//     // Y: Rendite (ytm / YTM / Rendite in %)
//     // Hier tolerant: ytm kann in % oder als Dezimal kommen
//     let ytm = toNum(r.ytm ?? r.YTM ?? r.yield ?? r.YIELD ?? r['Rendite in % aktuell']);
//     if (!Number.isFinite(ytm)) return null;

//     // ✅ Vereinheitlichen: Produkt-ytm auf Dezimalrate wie Curve
//     // 3.02 (%) -> 0.0302
//     if (ytm > 1) ytm = ytm / 100;


//     return { TtM, ytm, PROD_ID };
//   }).filter(Boolean);

//   console.log('[Offers] product chart inputs:', {
//     rows: rows.length,
//     points: points.length,
//     yieldCurve: yieldCurve.length,
//     EUSWData: EUSWData.length
//   });

//   drawYieldVsTimeChart({
//     targetId: CID,
//     heading: 'Product Yields vs Maturity',
//     yieldCurve: yieldCurve.length ? yieldCurve : (EUSWData || []),
//     pastYieldCurve: [],
//     euswDataOriginal: EUSWData,
//     points
//   });

//   // Register
//   try {
//     window.__offersCharts = window.__offersCharts || {};
//     if (window.Chart?.getChart) {
//       const inst = window.Chart.getChart(CID);
//       if (inst) window.__offersCharts[CID] = inst;
//     }
//   } catch (e) { console.warn('[Offers] register(product) warn:', e); }
// }
// export function renderOffersProductChart(rowsToShow = [], { retryMs = 200, maxRetries = 3 } = {}) {
//   const CID = 'offersProductYieldChart';

//   // ---------- helpers ----------
//   const state = (window.appState || (typeof appState !== 'undefined' ? appState : null));
//   const log = (...a) => console.log('[OffersProductChart]', ...a);
//   const warn = (...a) => console.warn('[OffersProductChart]', ...a);

//   const toNum = (v) => {
//     if (v == null) return NaN;
//     if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
//     const s = String(v)
//       .trim()
//       .replace(/\s/g, '')
//       .replace('%', '')
//       .replace(',', '.');
//     const n = parseFloat(s);
//     return Number.isFinite(n) ? n : NaN;
//   };

//   const toDate = (v) => {
//     if (!v) return null;
//     if (v instanceof Date && !isNaN(v)) return v;
//     const s = String(v).trim();

//     // ISO-ish: "1980-01-31 00:00:00"
//     const isoCandidate = s.replace(' ', 'T');
//     const d1 = new Date(isoCandidate);
//     if (!isNaN(d1)) return d1;

//     // fallback
//     const d2 = new Date(s);
//     return isNaN(d2) ? null : d2;
//   };

//   const normalizeRateToDecimal = (x) => {
//     // Ziel: Dezimalrate (0.03 = 3%)
//     // Wenn x=3 (oder 3.02) → Prozent → 0.03
//     // Wenn x=0.03 → bleibt 0.03
//     if (!Number.isFinite(x)) return NaN;
//     if (Math.abs(x) >= 1.0) return x / 100;
//     return x;
//   };

//   const normalizeYtmToDecimal = (raw) => {
//     // toleriert: "3,02%" / "3.02" / 0.0302
//     const n = toNum(raw);
//     if (!Number.isFinite(n)) return NaN;
//     return normalizeRateToDecimal(n);
//   };

//   // ---------- canvas ----------
//   const canvas = document.getElementById(CID);
//   if (!canvas) {
//     warn('Canvas nicht gefunden:', CID);
//     return;
//   }

//   // Height-Safety (0px Container => unsichtbar)
//   try {
//     if (canvas.parentElement) canvas.parentElement.style.minHeight = '320px';
//   } catch {}

//   // ---------- destroy previous chart ----------
//   try {
//     if (window.Chart?.getChart) {
//       const ex = window.Chart.getChart(CID);
//       if (ex?.destroy) ex.destroy();
//     } else if (window.__offersCharts?.[CID]?.destroy) {
//       window.__offersCharts[CID].destroy();
//       delete window.__offersCharts[CID];
//     }
//   } catch (e) {
//     warn('destroy warn:', e);
//   }

//   // ---------- validate rows ----------
//   const rows = Array.isArray(rowsToShow) ? rowsToShow : [];
//   if (!rows.length) {
//     warn('rowsToShow leer -> kein Chart');
//     return;
//   }

//   // ---------- get curves ----------
//   if (!state) {
//     warn('Kein appState verfügbar (weder window.appState noch import).');
//     return;
//   }

//   const EUSWDataRaw = state.getEUSWData?.() || [];
//   const TSData      = state.getTblTSData?.() || [];

//   const latestRow   = (Array.isArray(TSData) && TSData.length) ? TSData[TSData.length - 1] : null;

//   // TS -> curve format (wenn vorhanden)
//   const tsCurve = latestRow ? (transformTSDataToEUSWFormat(latestRow) || []) : [];

//   // EUSW raw -> curve format (0.03 etc.)
//   // Erwartung: Array von Objekten (z.B. { Tenor:'1Y', Rate:0.03 } oder ähnlich)
//   // Wir normalisieren defensiv auf { tenor, rate } im selben Stil wie drawYieldVsTimeChart es erwartet.
//   const euswCurve = Array.isArray(EUSWDataRaw)
//     ? EUSWDataRaw.map((r) => {
//         if (!r || typeof r !== 'object') return null;

//         // mögliche Keys
//         const tenor =
//           r.tenor ?? r.TENOR ?? r.Tenor ??
//           r.maturity ?? r.MATURITY ?? r.Maturity ??
//           r.term ?? r.TERM ?? r.Term ??
//           r.label ?? r.LABEL ?? r.Label;

//         const rateRaw =
//           r.rate ?? r.RATE ?? r.Rate ??
//           r.value ?? r.VALUE ?? r.Value ??
//           r.swap ?? r.SWAP ?? r.Swap;

//         const rateDec = normalizeRateToDecimal(toNum(rateRaw));
//         if (!tenor || !Number.isFinite(rateDec)) return null;

//         // minimal kompatibel: gleiche Felder wie dein transformTSDataToEUSWFormat liefert
//         return { tenor: String(tenor), rate: rateDec };
//       }).filter(Boolean)
//     : [];

//   // wähle primäre curve: TS wenn da, sonst EUSW
//   const primaryCurve = tsCurve.length ? tsCurve : euswCurve;

//   // wenn beide leer: Retry statt “skip”
//   if (!primaryCurve.length) {
//     warn('Keine Curve-Daten yet.', {
//       EUSW_len: EUSWDataRaw.length,
//       EUSW_curve_len: euswCurve.length,
//       TS_len: TSData.length,
//       TS_curve_len: tsCurve.length
//     });

//     const triesKey = '__offersProductChartTries';
//     window[triesKey] = (window[triesKey] || 0) + 1;

//     if (window[triesKey] <= maxRetries) {
//       setTimeout(() => {
//         try { renderOffersProductChart(rowsToShow, { retryMs, maxRetries }); } catch {}
//       }, retryMs);
//       return;
//     }

//     warn('Max retries erreicht -> gebe auf.');
//     window[triesKey] = 0;
//     return;
//   }

//   // ---------- product points ----------
//   const MSY = 365.25 * 24 * 3600 * 1000;

//   const points = rows.map((r, i) => {
//     const PROD_ID = String(r.PROD_ID ?? r.ISIN ?? r.DESCRIPTION ?? `Produkt_${i + 1}`);

//     // X: TtM (Years) oder MATURITY -> Years-to-maturity
//     let TtM = toNum(r.TtM ?? r.ttm ?? r.x);
//     if (!Number.isFinite(TtM)) {
//       const mat = toDate(r.MATURITY ?? r.maturity);
//       if (mat) TtM = Math.max(0, (mat - new Date()) / MSY);
//     }
//     if (!Number.isFinite(TtM)) return null;

//     // Y: Rendite (ytm) -> Decimal
//     const ytmDec = normalizeYtmToDecimal(r.ytm ?? r.YTM ?? r.yield ?? r.YIELD ?? r['Rendite in % aktuell']);
//     if (!Number.isFinite(ytmDec)) return null;

//     // Guards (nicht zu streng, aber schützt Ausreißer)
//     if (!(TtM >= 0 && TtM <= 100)) return null;
//     if (!(Math.abs(ytmDec) <= 1.0)) return null; // <=100%

//     return { TtM, ytm: ytmDec, PROD_ID };
//   }).filter(Boolean);

//   log('inputs:', {
//     rows: rows.length,
//     points: points.length,
//     primaryCurve: primaryCurve.length,
//     tsCurve: tsCurve.length,
//     euswCurve: euswCurve.length
//   });

//   // ---------- draw ----------
//   // Ziel: zusätzlich Swapraten reinbringen:
//   // - yieldCurve = primary (TS bevorzugt)
//   // - euswDataOriginal = euswCurve (als zweite Referenzkurve)
//   // drawYieldVsTimeChart soll beide darstellen können.
//   try {
//     drawYieldVsTimeChart({
//       targetId: CID,
//       heading: 'Product Yields vs Maturity',
//       yieldCurve: primaryCurve,
//       pastYieldCurve: [],
//       euswDataOriginal: euswCurve,   // ✅ immer mitgeben (wenn leer, dann halt leer)
//       points
//     });
//   } catch (e) {
//     warn('drawYieldVsTimeChart failed:', e);
//     return;
//   }

//   // ---------- register instance ----------
//   try {
//     window.__offersCharts = window.__offersCharts || {};
//     if (window.Chart?.getChart) {
//       const inst = window.Chart.getChart(CID);
//       if (inst) window.__offersCharts[CID] = inst;
//     }
//   } catch (e) {
//     warn('register warn:', e);
//   }
// }

export function renderOffersProductChart(
  rowsToShow = [],
  { retryMs = 200, maxRetries = 6 } = {}
) {
  const CID = 'offersProductYieldChart';
  const state = (window.appState || (typeof appState !== 'undefined' ? appState : null));
  const log  = (...a) => console.log('[OffersProductChart]', ...a);
  const warn = (...a) => console.warn('[OffersProductChart]', ...a);

  const toNum = (v) => {
    if (v == null) return NaN;
    if (typeof v === 'number') return Number.isFinite(v) ? v : NaN;
    const s = String(v).trim().replace(/\s/g, '').replace('%','').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };

  const toDate = (v) => {
    if (!v) return null;
    if (v instanceof Date && !isNaN(v)) return v;
    const s = String(v).trim();
    const d1 = new Date(s.replace(' ', 'T')); // "1980-01-31 00:00:00"
    if (!isNaN(d1)) return d1;
    const d2 = new Date(s);
    return isNaN(d2) ? null : d2;
  };

  // Ziel: Dezimalrate (0.03 = 3%). 3.02 (%) -> 0.0302
const toPercentRate = (n) => {
  if (!Number.isFinite(n)) return NaN;
  // akzeptiert 0.03 oder 3.0 oder "3%"
  // 0.03 -> 3
  // 3.0  -> 3
  return (Math.abs(n) < 1) ? (n * 100) : n;
};


  const canvas = document.getElementById(CID);
  if (!canvas) { warn('Canvas nicht gefunden:', CID); return; }
  try { if (canvas.parentElement) canvas.parentElement.style.minHeight = '320px'; } catch {}

  // destroy old chart
  try {
    if (window.Chart?.getChart) {
      const ex = window.Chart.getChart(CID);
      if (ex?.destroy) ex.destroy();
    } else if (window.__offersCharts?.[CID]?.destroy) {
      window.__offersCharts[CID].destroy();
      delete window.__offersCharts[CID];
    }
  } catch (e) { warn('destroy warn:', e); }

  const rows = Array.isArray(rowsToShow) ? rowsToShow : [];
  if (!rows.length) { warn('rowsToShow leer -> kein Chart'); return; }
  if (!state) { warn('Kein appState verfügbar.'); return; }

  // ---------- EUSW curve (IR-panel kompatibel) ----------
  const rawEUSW = state.getEUSWData?.() || [];
  const selectedCurve =
    (typeof state.getSelectedCurve === 'function' && state.getSelectedCurve()) ||
    'EUSWAP';

  const euswCurve = Array.isArray(rawEUSW) ? rawEUSW.map(r => {
    if (!r || typeof r !== 'object') return null;
    const YEAR = toNum(r.YEAR ?? r.Year ?? r.tenor ?? r.TENOR);
    const rawRate = (r.RATES != null) ? r.RATES : r[selectedCurve];
    const RATES = toPercentRate(toNum(rawRate));   // bei dir meist 0.03 -> bleibt 0.03
    if (!Number.isFinite(YEAR) || !Number.isFinite(RATES)) return null;
    return { YEAR, RATES };
  }).filter(Boolean) : [];

  // ---------- TS curve (auch in {YEAR,RATES} umformen) ----------
  const TSData = state.getTblTSData?.() || [];
  const latestRow = (Array.isArray(TSData) && TSData.length) ? TSData[TSData.length - 1] : null;
  const tsRawCurve = latestRow ? (transformTSDataToEUSWFormat(latestRow) || []) : [];

  const tsCurve = Array.isArray(tsRawCurve) ? tsRawCurve.map(p => {
    if (!p || typeof p !== 'object') return null;

    // akzeptiere mehrere Shapes:
    // 1) {YEAR,RATES} 2) {tenor,rate} 3) {x,y}
    let YEAR = toNum(p.YEAR ?? p.year ?? p.x);
    if (!Number.isFinite(YEAR)) {
      // tenor "1Y" / "10Y" etc.
      const t = String(p.tenor ?? p.TENOR ?? '').trim().toUpperCase();
      const m = t.match(/^(\d+(?:\.\d+)?)\s*Y$/);
      if (m) YEAR = toNum(m[1]);
    }

    const rawRate = (p.RATES != null) ? p.RATES : (p.rate ?? p.RATE ?? p.y);
    const RATES = toPercentRate(toNum(rawRate));// falls TS als % kommt, wird /100

    if (!Number.isFinite(YEAR) || !Number.isFinite(RATES)) return null;
    return { YEAR, RATES };
  }).filter(Boolean) : [];

  const primaryCurve = tsCurve.length ? tsCurve : euswCurve;

  // Retry wenn beide leer
  if (!primaryCurve.length) {
    const triesKey = '__offersProductChartTries';
    window[triesKey] = (window[triesKey] || 0) + 1;

    warn('Keine Curve-Daten yet -> retry', {
      try: window[triesKey],
      tsCurve: tsCurve.length,
      euswCurve: euswCurve.length,
      TS_len: TSData?.length ?? 0,
      EUSW_len: rawEUSW?.length ?? 0,
      selectedCurve
    });

    if (window[triesKey] <= maxRetries) {
      setTimeout(() => {
        try { renderOffersProductChart(rowsToShow, { retryMs, maxRetries }); } catch {}
      }, retryMs);
      return;
    }
    warn('Max retries erreicht -> gebe auf.');
    window[triesKey] = 0;
    return;
  }

  // ---------- product points ----------
  const MSY = 365.25 * 24 * 3600 * 1000;

  const points = rows.map((r, i) => {
    const PROD_ID = String(r.PROD_ID ?? r.ISIN ?? r.DESCRIPTION ?? `Produkt_${i + 1}`);

    let TtM = toNum(r.TtM ?? r.ttm ?? r.x);
    if (!Number.isFinite(TtM)) {
      const mat = toDate(r.MATURITY ?? r.maturity);
      if (mat) TtM = Math.max(0, (mat - new Date()) / MSY);
    }
    if (!Number.isFinite(TtM)) return null;

    const ytmPct = toPercentRate(toNum(r.ytm ?? r.YTM ?? r.yield ?? r.YIELD ?? r['Rendite in % aktuell']));

    if (!Number.isFinite(ytmPct)) return null;

    return { TtM, ytm: ytmPct/100, PROD_ID };
  }).filter(Boolean);

  log('inputs:', {
    rows: rows.length,
    points: points.length,
    primaryCurve: primaryCurve.length,
    tsCurve: tsCurve.length,
    euswCurve: euswCurve.length,
    selectedCurve,
    sample_primary: primaryCurve[0],
    sample_eusw: euswCurve[0]
  });

  // ---------- draw ----------
  try {
    drawYieldVsTimeChart({
      targetId: CID,
      heading: 'Product Yields vs Maturity',
      yieldCurve: primaryCurve,     // {YEAR,RATES}
      pastYieldCurve: [],
      euswDataOriginal: euswCurve,  // {YEAR,RATES} zusätzliche Swap-Kurve
      points
    });
  } catch (e) {
    warn('drawYieldVsTimeChart failed:', e);
    return;
  }

  // register chart instance
  try {
    window.__offersCharts = window.__offersCharts || {};
    if (window.Chart?.getChart) {
      const inst = window.Chart.getChart(CID);
      if (inst) window.__offersCharts[CID] = inst;
    }
  } catch (e) { warn('register warn:', e); }
}






export function renderOffersDurationProductChart(rowsToShow = []) {
  const CID = 'durationOffersProductYieldChart';

  const canvas = document.getElementById(CID);
  if (!canvas) { console.warn('[DurationChart] Canvas nicht gefunden:', CID); return; }
  try { canvas.parentElement && (canvas.parentElement.style.minHeight = '320px'); } catch {}

  // Destroy
  try {
    if (window.Chart?.getChart) {
      const ex = window.Chart.getChart(CID);
      if (ex?.destroy) ex.destroy();
    } else if (window.__offersCharts?.[CID]?.destroy) {
      window.__offersCharts[CID].destroy();
      delete window.__offersCharts[CID];
    }
  } catch (e) { console.warn('[DurationChart] destroy warn:', e); }

  const rows = Array.isArray(rowsToShow) ? rowsToShow : [];
  if (!rows.length) { console.warn('[DurationChart] rowsToShow leer -> skip'); return; }

  const EUSWData = appState.getEUSWData?.() || [];
  const TSData   = appState.getTblTSData?.() || [];
  const latestRow = Array.isArray(TSData) && TSData.length ? TSData[TSData.length - 1] : null;

  const yieldCurve = latestRow ? (transformTSDataToEUSWFormat(latestRow) || []) : [];
  if (!yieldCurve.length && !EUSWData.length) {
    console.warn('[DurationChart] keine Curve-Daten (TS/EUSW) -> skip');
    return;
  }

  // Duration-Kurven
  const baseCurve = yieldCurve.length ? yieldCurve : EUSWData;
  const durationCurve    = baseCurve.map(swapPointToDurationAsYearRate).filter(Boolean);
  const durationEUSWData = (EUSWData || []).map(swapPointToDurationAsYearRate).filter(Boolean);

  // ---------- Helpers ----------
  const toNum = (v) => {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;
    const s = String(v).trim().replace('%','').replace(/\s/g,'').replace(',', '.');
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };

  // YTM als Dezimalrate (wie Kurve) normalisieren: 3.02 -> 0.0302
  const ytmToDecimal = (v) => {
    let y = toNum(v);
    if (!Number.isFinite(y)) return NaN;
    if (y > 1) y = y / 100;
    return y;
  };

  // Duration Years aus Row ableiten:
  // 1) wenn duration/mod_duration vorhanden -> nutzen (ggf. Days->Years)
  // 2) sonst PV01rel (% per bp) -> approx DurationYears = PV01rel * (1 + ytmDecimal)
  const durationYearsFromRow = (r, ytmDec) => {
    let d = toNum(r.duration ?? r.DURATION ?? r.mod_duration ?? r.MOD_DURATION);
    if (Number.isFinite(d)) {
      // Heuristik: wenn extrem groß, ist es sehr wahrscheinlich "Tage" -> Years
      if (d > 60) d = d / 365.25;
      return d;
    }

    const pv01rel = toNum(r.PV01rel ?? r.PV01REL);
    if (Number.isFinite(pv01rel)) {
      const adj = (Number.isFinite(ytmDec) ? (1 + ytmDec) : 1);
      return Math.abs(pv01rel) * adj;
    }

    return NaN;
  };

  // Produktpunkte: x=DurationYears, y=YTMDecimal
  const rejects = { xNaN:0, yNaN:0, guard:0 };
  const productDurationPoints = rows.map((r, i) => {
    const PROD_ID = String(r.PROD_ID ?? r.ISIN ?? `Produkt_${i+1}`);

    const yDec = ytmToDecimal(r.ytm ?? r.YTM ?? r.yield ?? r.YIELD ?? r['Rendite in % aktuell']);
    if (!Number.isFinite(yDec)) { rejects.yNaN++; return null; }

    const xYears = durationYearsFromRow(r, yDec);
    if (!Number.isFinite(xYears)) { rejects.xNaN++; return null; }

    // Guards: bewusst breiter, damit wir erstmal sehen
    if (!(xYears >= 0 && xYears <= 40 && Math.abs(yDec) <= 1.0)) { // 100% wäre 1.0 als Dezimal
      rejects.guard++;
      return null;
    }

    const yPct = yDec * 100;
    return { x: xYears, y: yPct, PROD_ID };

  }).filter(Boolean);

  console.log('[DurationChart] inputs:', {
    rows: rows.length,
    points: productDurationPoints.length,
    rejects,
    durationCurve: durationCurve.length,
    sampleRowKeys: Object.keys(rows[0] || {}).slice(0, 25),
    samplePoint: productDurationPoints[0] || null
  });

  // Wenn 0 Punkte -> sofort sehen, was fehlt
  if (!productDurationPoints.length) {
    console.warn('[DurationChart] 0 product points. Prüfe: duration/mod_duration/PV01rel vorhanden?');
  }

  drawYieldVsTimeChart({
    targetId: CID,
    heading: 'Product Yields vs Duration',
    yieldCurve: durationCurve,
    pastYieldCurve: [],
    euswDataOriginal: durationEUSWData,
    points: productDurationPoints
  });

  // Register
  try {
    window.__offersCharts = window.__offersCharts || {};
    if (window.Chart?.getChart) {
      const inst = window.Chart.getChart(CID);
      if (inst) window.__offersCharts[CID] = inst;
    }
  } catch (e) { console.warn('[DurationChart] register warn:', e); }
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



function toNum(v) {
  if (v == null) return NaN;
  const s = String(v).trim()
    .replace(/\s+/g, '')
    .replace('%', '')
    .replace(',', '.');
  const n = Number(s);
  return Number.isFinite(n) ? n : NaN;
}

function toDate(v) {
  if (!v) return null;
  const d = new Date(String(v).trim());
  return isNaN(d) ? null : d;
}

function rateDecToPct(y) {
  const n = Number(y);
  if (!Number.isFinite(n)) return null;
  // 0.03 -> 3.0 ; 3.0 bleibt 3.0
  return Math.abs(n) <= 1 ? n * 100 : n;
}

function getEUSWCurveAsSeries() {
  const raw = (typeof appState.getEUSWData === "function") ? appState.getEUSWData() : [];
  if (!Array.isArray(raw) || raw.length === 0) return { curve: null, series: [] };

  const curve =
    (typeof appState.getSelectedCurve === "function" && appState.getSelectedCurve()) ||
    "EUSWAP";

  // Einheitliche Spalte RATES erzeugen (wie im IR-Panel)
  const IRData = raw.map(row => {
    const r = { ...row };
    if (curve in r) r.RATES = r[curve];
    return r;
  });

  // Serie bauen: x=YEAR, y=RATES (RATES ist bei dir im Raw-Format 0.03)
  const series = IRData
    .map(r => {
      const x = r.YEAR ?? r.Year ?? r.years ?? r.tenor ?? null;
      const y = Number(String(r.RATES).replace(",", "."));
      if (x == null || !Number.isFinite(y)) return null;
      return { x, y }; // y bleibt Dezimal (0.03)
    })
    .filter(Boolean);

  return { curve, series };
}















