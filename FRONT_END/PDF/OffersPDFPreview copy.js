
import { REPORT_DEFAULTS_OFFERS } from './OffersPDF.js';
import { handleFormAction } from '../renderer/FormButtonHandler.js';
import { appState } from '../renderer.js';

import { drawYieldVsTimeChart, transformTSDataToEUSWFormat, swapPointToDurationAsYearRate } from '../SummaryYield.js';



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
  const $ = (id) => document.getElementById(id);
  const val = (id, def) => { const el = $(id); const v = el?.value?.trim(); return v || def; };

  return {
    includeTOC: REPORT_DEFAULTS_OFFERS.includeTOC,
    sections:   { ...REPORT_DEFAULTS_OFFERS.sections },
    fileName:    val('or-filename',   REPORT_DEFAULTS_OFFERS.fileName),
    paper:       REPORT_DEFAULTS_OFFERS.paper,
    orientation: REPORT_DEFAULTS_OFFERS.orientation,
    ids:         { ...REPORT_DEFAULTS_OFFERS.ids },
    headerText:  val('or-headerText', REPORT_DEFAULTS_OFFERS.headerText),
    footerText:  val('or-footerText', REPORT_DEFAULTS_OFFERS.footerText),
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
const thumb = (canvasId, w = 220) => {
  const c = document.getElementById(canvasId);
  if (!c || !c.width || !c.height) return '';
  const r = c.width / c.height || 1.6;
  const h = Math.round(w / r);
  try {
    return `<img src="${c.toDataURL('image/png')}" width="${w}" height="${h}" style="border:1px solid #444;border-radius:6px;background:#111"/>`;
  } catch { return ''; }
};
const li = (txt) => `<li>${txt}</li>`;
const kvBox = (label, val) => `
  <div style="border:1px solid #444;border-radius:6px;padding:8px;background:#111">
    <div style="font-size:11px;opacity:.7;margin-bottom:4px">${label}</div>
    <div>${val}</div>
  </div>`;

// ---------- Preview Renderer ----------
export function renderOffersPreview(containerPreviewId = 'reportsOffersPreview', containerId = OFFERS_CONTAINER_ID) {
  const wrap = document.getElementById(containerPreviewId);
  if (!wrap) return;

  // Data & Options
  const opts = (() => { try { return getOffersReportOptions?.() || {}; } catch { return {}; } })();
  const sections = opts.sections || { intro:true, detailsTable:true, productChart:true, signature:true };
  const fileName = opts.fileName || 'Veranlagungsvorschlag.pdf';
  

  // Kunde laden + Prefill (Header aus Input > DB > Default)
  const customer = getCurrentCustomer();
  const prefillHeader = (() => {
    try {
      const inputVal = (getOffersReportOptions?.().headerText || '').trim();
      return inputVal || customer?.pdf_header || '';
    } catch {
      return customer?.pdf_header || '';
    }
  })();

  // bevorzugt: zentral hinterlegte Daten
  let rows = [];
  try {
    const data = getOffersReportData();
    if (Array.isArray(data) && data.length) rows = data;
  } catch {}
  // Fallback: DOM parsen
  if (!rows.length) rows = rowsAsObjectsFrom(containerId);

  if (!rows.length) {
    wrap.innerHTML = `
      <div style="padding:10px">
        ${controlsHTML(prefillHeader)}
        <div style="opacity:.65;padding:10px;border:1px dashed #444;border-radius:8px;margin-top:10px">
          Keine Daten gefunden.
        </div>
      </div>`;
    return;
  }
  const r = rows[0] || {};

  const fields = [
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

  const enabled = [];
  if (sections.intro)        enabled.push('Intro');
  if (sections.detailsTable) enabled.push('Details Table');
  if (sections.productChart) enabled.push('Product Chart');
  if (sections.signature)    enabled.push('Signature Block');

// const chartHTML = sections.productChart
//   ? `
//     <section id="yieldChartSection" class="offers-card">
//       <div class="offers-card__header">
//         <h3 class="offers-h3">Product Yields vs Maturity</h3>
//       </div>
//       <div class="offers-card__body">
//         <canvas id="offersProductYieldChart" class="lineChart"></canvas>
//       </div>
//     </section>`
//   : '';

const chartHTML = sections.productChart
  ? `
    <section id="yieldChartSection" class="offers-card">
      <div class="offers-card__header">
        <h3 class="offers-h3">Product Yields vs Maturity</h3>
      </div>
      <div class="offers-card__body">
        <canvas id="offersProductYieldChart" class="lineChart"></canvas>
      </div>
    </section>

    <section id="durationChartSection" class="offers-card" style="margin-top:12px">
      <div class="offers-card__header">
        <h3 class="offers-h3">Product Yields vs Duration</h3>
      </div>
      <div class="offers-card__body">
        <canvas id="durationOffersProductYieldChart" class="lineChart"></canvas>
      </div>
    </section>
  `
  : '';




  const detailsHTML = sections.detailsTable
    ? `<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(240px,1fr));gap:8px">
        ${fields.map(([key,label]) => (r[key] != null && r[key] !== '') ? kvBox(label, String(r[key])) : '').join('')}
      </div>`
    : '';

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

  const topBar = `
    <div style="display:flex;gap:12px;flex-wrap:wrap;align-items:center;margin-bottom:8px">
      <span style="opacity:.8">TOC:</span>
      <strong>${opts.includeTOC ? 'On' : 'Off'}</strong>
      <span style="opacity:.8;margin-left:12px">Format:</span>
      <code>${(opts.paper || 'a4').toUpperCase()} / ${opts.orientation === 'l' ? 'Landscape' : 'Portrait'}</code>
      <span style="opacity:.8;margin-left:12px">File:</span>
      <code>${fileName}</code>
    </div>`;

  const sectionsList = `
    <div style="margin-bottom:8px">
      <div style="opacity:.8;margin-bottom:4px">Sections included:</div>
      <ul style="margin:0;padding-left:18px">
        ${enabled.map(li).join('')}
      </ul>
    </div>`;

  wrap.innerHTML = `
    <div style="padding:10px">
      ${controlsHTML(prefillHeader)}

      ${topBar}
      ${sectionsList}

      <div style="margin:12px 0 10px">
        <div style="font-weight:600;margin:0 0 6px">Offer Overview</div>
        ${detailsHTML || `<div style="opacity:.65">Keine Detailfelder verfügbar.</div>`}
        ${chartHTML ? `<div style="margin-top:10px">${chartHTML}</div>` : ''}
      </div>

      ${signatureHTML}
    </div>
  `;

// if (sections.productChart) {
//   console.log('[OffersPreview] Chart?', !!window.Chart, 'v=', window.Chart?.version);
//   renderOffersProductChart();    
// }

if (sections.productChart) {
  console.log('[OffersPreview] Chart?', !!window.Chart, 'v=', window.Chart?.version);
  renderOffersProductChart();

  // optional: Duration-Kurven (ohne Punkte) direkt danach rendern
  try {
    if (typeof renderOffersDurationProductChart === 'function') {
      renderOffersDurationProductChart();
    } else {
      console.warn('[OffersPreview] renderOffersDurationProductChart() not found');
    }
  } catch (err) {
    console.warn('[OffersPreview] duration chart failed:', err);
  }
}



}


    // UI-Block (Header-Feld + Speichern)
    function controlsHTML(prefillHeader) {
      return `
        <div style="padding:10px;border:1px solid #444;border-radius:8px;margin-bottom:10px;background:#0f0f0f">
          <label for="or-headerText" style="display:block;font-size:12px;opacity:.8;margin-bottom:4px">
            PDF-Header (wird in Customer gespeichert)
          </label>
          <div style="display:flex;gap:8px;align-items:center">
            <input id="or-headerText" type="text"
                  value="${escapeHtml(prefillHeader)}"
                  placeholder="Headertext fürs PDF"
                  style="flex:1;padding:6px 8px;border:1px solid #555;border-radius:6px;background:#111;color:#eee" />

            
          </div>
          <div id="or-saveStatus" style="margin-top:6px;font-size:12px;opacity:.8"></div>
        </div>`;
    }



    export function wireOffersPreview({
      containerPreviewId = 'reportsOffersPreview',
      containerId = OFFERS_CONTAINER_ID,
      dropdownId = 'reportsOffersDropdown',
      inputIds = ['or-filename','or-headerText','or-footerText'],
      timeoutMs = 15000,
    } = {}) {
      console.log('[OffersPreview] wireOffersPreview init');

      // 1) Externe Inputs -> Live Preview
      inputIds.forEach(id=>{
        const el = document.getElementById(id);
        if (!el) return;
        el.addEventListener('change', () => renderOffersPreview(containerPreviewId, containerId));
        el.addEventListener('input',  () => renderOffersPreview(containerPreviewId, containerId));
      });

      // 2) Dropdown
      try { populateOffersDropdown(dropdownId, containerId); } catch(e){ console.warn('[OffersPreview] populate err', e); }

      // 3) Tabelle beobachten
      const host = document.getElementById(containerId);
      if (host) {
        const mo = new MutationObserver(() => renderOffersPreview(containerPreviewId, containerId));
        mo.observe(host, { childList: true, subtree: true });
      }

      // 4) Initial render
      renderOffersPreview(containerPreviewId, containerId);

      // 5) Styles einmalig
      if (!document.getElementById('offersPreviewStyles')) {
        const style = document.createElement('style');
        style.id = 'offersPreviewStyles';
        
        style.textContent += `
          /* ===== Preview Layout (Grid/Card) ===== */
          #panel-reports-offers { --panel-header-h: 56px; } /* zur Not anpassen */
          #reportsOffersPreview {
            display: grid;
            grid-template-columns: 1fr;
            gap: 12px;
            padding-top: var(--panel-header-h, 56px); /* Abstand, falls Header sticky/überlappt */
            position: relative;
            z-index: 0;
          }

          .offers-card {
            border: 1px solid #444;
            border-radius: 8px;
            background: #0f0f0f;
            padding: 12px;
          }
          .offers-card__header { margin-bottom: 8px; }
          .offers-h3 {
            margin: 0;
            font-weight: 600;
            font-size: 16px;
            line-height: 1.2;
          }
          .offers-card__body { overflow: visible; }

          /* Chart sichtbar & mittig */
          #yieldChartSection { scroll-margin-top: var(--panel-header-h, 56px); }
          #offersProductYieldChart {
            display: block;
            margin: 0 auto;
            max-width: 600px;   /* passt zu deiner draw()-Größe */
            height: 400px;      /* passt zu deiner draw()-Größe */
            background: transparent;
          }
        `;

        document.head.appendChild(style);
      }

      // 6) Delegation am Preview-Container
      const wrap = document.getElementById(containerPreviewId);
      if (!wrap) { console.warn('[OffersPreview] wrap not found'); return; }

      const persist = (val, statusEl, btnEl) => {
        const setStatus = t => { if (statusEl) statusEl.textContent = t; };
        const setBtn = (state, text) => {
          if (!btnEl) return;
          if (text != null) btnEl.textContent = text;
          if (state) btnEl.dataset.state = state; else delete btnEl.dataset.state;
        };

        const arr = window.appState?.getCustomerData?.();
        const customer = Array.isArray(arr) ? arr[0] : arr;

        console.log('[OffersPreview] persist start', { val, hasCustomer: !!customer?.id });

        if (!customer?.id) { setStatus('⚠️ Kein Customer geladen.'); setBtn('error','Speichern'); return; }
        if (!window.api?.send || !window.api?.once) { setStatus('⚠️ IPC-Bridge fehlt.'); setBtn('error','Speichern'); return; }

        // UI: Saving
        if (btnEl) { btnEl.disabled = true; setBtn('saving','Speichere…'); }
        setStatus('Speichere…');

        // EINMALIG auf statische Channels hören (dein Main antwortet so!)
        window.api.once('update-customer-texts-success', () => {
          console.log('[OffersPreview] SUCCESS from main');
          try { if (customer) customer.pdf_header = val; } catch {}
          setStatus('✓ Gespeichert');
          setBtn('saved','✓ Gespeichert');

          // erst nach Erfolg neu rendern
          renderOffersPreview(containerPreviewId, containerId);

          // Button/Status zurücksetzen (frisch referenzieren!)
          setTimeout(() => {
            const freshBtn = document.getElementById('or-saveHeader');
            const freshStatus = document.getElementById('or-saveStatus');
            if (freshBtn) { freshBtn.disabled = false; freshBtn.dataset.state=''; freshBtn.textContent='Speichern'; }
            if (freshStatus) freshStatus.textContent = '';
          }, 1200);
        });

        window.api.once('update-customer-texts-error', (msg='Unbekannter Fehler') => {
          console.warn('[OffersPreview] ERROR from main:', msg);
          setStatus(`❌ Fehler: ${msg}`);
          setBtn('error','❌ Fehler');
          setTimeout(() => {
            const freshBtn = document.getElementById('or-saveHeader');
            if (freshBtn) { freshBtn.disabled = false; freshBtn.dataset.state=''; freshBtn.textContent='Speichern'; }
          }, 1500);
        });

        // Senden (statisch, ohne requestId – passt zu deinem main.ipc)
        window.api.send('update-customer-texts', {
          customer_id: customer.id,
          pdf_header: val,
          pdf_footer: (typeof customer.pdf_footer === 'string' ? customer.pdf_footer : '')
        });

        // Timeout-Fallback
        if (timeoutMs > 0) {
          setTimeout(() => {
            const freshStatus = document.getElementById('or-saveStatus');
            if (freshStatus && freshStatus.textContent === 'Speichere…') {
              console.warn('[OffersPreview] No reply within timeout');
              freshStatus.textContent = '⚠️ Keine Antwort vom Backend';
              const freshBtn = document.getElementById('or-saveHeader');
              if (freshBtn) { freshBtn.disabled = false; freshBtn.dataset.state=''; freshBtn.textContent='Speichern'; }
            }
          }, timeoutMs);
        }
      };

      // Delegation Click
      wrap.addEventListener('click', (ev) => {
        const btn = ev.target.closest('#or-saveHeader');
        if (!btn) return;
        console.log('[OffersPreview] click detected on save');
        const input  = wrap.querySelector('#or-headerText');
        const status = wrap.querySelector('#or-saveStatus');
        const val    = input?.value?.trim() || '';
        persist(val, status, btn);
      });

      // Delegation Blur -> Autosave
      wrap.addEventListener('focusout', (ev) => {
        if (ev.target?.id !== 'or-headerText') return;
        console.log('[OffersPreview] blur detected on header input');
        const input  = ev.target;
        const status = wrap.querySelector('#or-saveStatus');
        const btn    = wrap.querySelector('#or-saveHeader');
        persist(input.value?.trim() || '', status, btn);
      });

      // Input -> Live Preview
      wrap.addEventListener('input', (ev) => {
        if (ev.target?.id !== 'or-headerText') return;
        renderOffersPreview(containerPreviewId, containerId);
      });

      // 7) Zusätzliches Direkt-Binding (Fallback, falls Delegation blockiert)
      const bindDirect = () => {
        const btn = document.getElementById('or-saveHeader');
        const input = document.getElementById('or-headerText');
        const status = document.getElementById('or-saveStatus');
        if (!btn || !input) return false;
        if (!btn.getAttribute('type')) btn.setAttribute('type','button');
        if (!btn.__offersBound) {
          btn.addEventListener('click', () => {
            console.log('[OffersPreview] direct binding click');
            persist(input.value?.trim() || '', status, btn);
          });
          btn.__offersBound = true;
        }
        return true;
      };

      // Direkt-Setup jetzt…
      bindDirect();

      // …und nach jedem Re-Render erneut probieren (Poll 1s, max 10x)
      let attempts = 0;
      const poll = setInterval(() => {
        attempts++;
        const ok = bindDirect();
        if (ok || attempts > 10) clearInterval(poll);
      }, 1000);
    }


    // NEU: Header speichern via Edit-Action auf Customer
    const offersSaveHeaderButton = document.getElementById('offersSaveHeaderButton');
    if (offersSaveHeaderButton && !offersSaveHeaderButton.dataset.bound) {
      offersSaveHeaderButton.dataset.bound = '1';
      offersSaveHeaderButton.addEventListener('click', (event) => {
        event.preventDefault();
        event.stopPropagation();
        handleOffersHeaderEditAction(event); // siehe Funktion unten
      });
    }

    // Speichert den PDF-Header aus der Preview in der Customer-DB über handleFormAction(..., 'Customer', 'edit')
    function handleOffersHeaderEditAction(event) {
      const btn    = document.getElementById('offersSaveHeaderButton');
      const input  = document.getElementById('or-headerText');   // Input aus der Offers-Preview
      const status = document.getElementById('or-saveStatus');   // Statuszeile in der Preview

      const setStatus = (t)=>{ if (status) status.textContent = t; };
      const setBtn    = (txt)=>{ if (btn && txt != null) btn.textContent = txt; };

      try {
        // UI-Feedback
        if (btn) btn.disabled = true;
        setBtn('Speichere…');
        setStatus('Speichere…');

        // Customer bestimmen
        const arr = window.appState?.getCustomerData?.();
        const customer = Array.isArray(arr) ? arr[0] : arr;
        if (!customer?.id) throw new Error('Kein Customer geladen.');

        // Neuen Header holen
        const headerVal = (input?.value ?? '').trim();

        // RowIndex der Customer-Zeile optional bestimmen (falls dein handleFormAction das nutzt)
        const rowIndex = findCustomerRowIndex(customer.id); // s.u. Helper – liefert Zahl oder null

        // EDIT-Payload (Patch): id + zu ändernde Felder
        const editData = {
          id: customer.id,
          pdf_header: headerVal,
          // pdf_footer bleibt unverändert – weglassen oder explizit beibehalten:
          // pdf_footer: (typeof customer.pdf_footer === 'string' ? customer.pdf_footer : '')
        };

        // 👉 jetzt über dein zentrales Edit-Framework speichern
        handleFormAction(event, editData, rowIndex, 'Customer', 'edit');

        // Erfolgs-UI (handleFormAction ist i.d.R. async; wenn du ein Promise zurückgibst, kannst du awaiten)
        setStatus('✓ Gespeichert');
        setBtn('Header speichern');
        if (btn) btn.disabled = false;

        // Lokalen State aktualisieren (damit Preview sofort passt)
        try { customer.pdf_header = headerVal; } catch {}

        // Preview neu rendern
        try { renderOffersPreview('reportsOffersPreview', 'portDataContainer4'); } catch { /* noop */ }

        // Status nach kurzer Zeit leeren
        setTimeout(() => { const fresh = document.getElementById('or-saveStatus'); if (fresh) fresh.textContent = ''; }, 1200);

      } catch (err) {
        setStatus('❌ ' + (err?.message || String(err)));
        setBtn('Header speichern');
        if (btn) btn.disabled = false;
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
  const EUSWData = appState.getEUSWData?.() || [];
  const TSData   = appState.getTblTSData?.() || [];
  if (!EUSWData.length || !TSData.length) {
    console.warn('[Offers] EUSW/TS fehlen.');
    return;
  }

  const latestRow  = TSData[TSData.length - 1];
  const yieldCurve = transformTSDataToEUSWFormat(latestRow) || [];

  // Nur echte Offers-Zeilen (beginnt mit OFFER/ OFFERS)
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
    // TtM: Zahl, ggf. aus MATURITY fallback
    let TtM = Number.isFinite(+r.TtM) ? +r.TtM
             : Number.isFinite(+r.x) ? +r.x
             : NaN;
    if (!Number.isFinite(TtM) && r.MATURITY) {
      const mat = new Date(r.MATURITY);
      if (!isNaN(mat)) {
        const MSY = 365.25 * 24 * 3600 * 1000;
        TtM = Math.max(0, (mat - new Date()) / MSY);
      }
    }

    // ytm: dezimal erlaubt (0.0245) -> draw() macht *100
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

  drawYieldVsTimeChart({
    targetId: 'offersProductYieldChart',
    heading: 'Product Yields vs Maturity',
    yieldCurve,
    pastYieldCurve: [],          // bewusst leer
    euswDataOriginal: EUSWData,
    points
  });
}

export function renderOffersDurationProductChart() {
  // Ziel-Canvas-ID konsistent halten
  const targetId = 'durationOffersProductYieldChart';

  // --- kleine Helfer nur für diese Funktion ---
  const parsePctToNumber = (v) => {
    if (v == null) return NaN;
    if (typeof v === 'number') return v;                 // bereits als %-Zahl (z.B. 2.45)
    const s = String(v).replace(',', '.').replace('%','').trim();
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;                 // gibt Prozent zurück (2.45)
  };
  // PV01rel = % Preisänderung je 1 bp → Duration [Jahre] (Macaulay ~)
  const pv01relToDurationYears = (pv01rel, ytm) => {
    const pv01PctPerBp = Math.abs(parsePctToNumber(pv01rel)); // z.B. 0.45 (%/bp)
    if (!Number.isFinite(pv01PctPerBp)) return NaN;
    const Dmod = pv01PctPerBp;                               // (deine aktuelle Skalierung beibehalten)
    const yPct = parsePctToNumber(ytm);                      // z.B. 2.45 (%)
    const y = Number.isFinite(yPct) ? (yPct / 100) : 0;      // in Dezimal
    return Dmod * (1 + y);                                   // Macaulay ~
  };

  // --- Daten holen ---
  const EUSWData = appState.getEUSWData?.() || [];
  const TSData   = appState.getTblTSData?.() || [];

  if (!Array.isArray(EUSWData) || !EUSWData.length || !Array.isArray(TSData) || !TSData.length) {
    console.warn('[DurationChart] EUSW/TS fehlen – übersprungen');
    return;
  }

  // letzte Zinskurven-Zeile
  const latestRow  = TSData[TSData.length - 1];
  const yieldCurve = transformTSDataToEUSWFormat(latestRow) || [];
  if (!yieldCurve.length) {
    console.warn('[DurationChart] yieldCurve leer – übersprungen');
    return;
  }

  // --- Duration-Kurven aus Swap-Daten ableiten ---
  const durationCurve    = yieldCurve.map(swapPointToDurationAsYearRate).filter(Boolean);
  const durationEUSWData = EUSWData.map(swapPointToDurationAsYearRate).filter(Boolean);

  // --- Produktpunkte (x = Duration[J], y = YTM[%]) ---
  // NUR echte OFFERS-Zeilen berücksichtigen
  const rawAll = appState.getFilteredPortData?.('OFFERS_DATA') || [];
  const raw = rawAll.filter(r => {
    const idStr = String(
      r.PORTFOLIO ?? r.Portfolio ?? r.portfolio ??
      r.Depotbank ?? r.DEPOTBANK ??
      r.ACCOUNT ?? r.account ??
      r.BOOK ?? r.Book ?? ''
    ).trim();
    return /^offers?/i.test(idStr); // beginnt mit OFFER oder OFFERS (case-insensitive)
  });

  const productDurationPoints = raw.map((r, i) => {
    // x: aus PV01rel/PV01/duration → Duration[Jahre]
    const xSource = r.PV01rel ?? r.PV01 ?? r.duration;
    let x = pv01relToDurationYears(xSource, r.ytm);

    // y: YTM auf Prozent normalisieren (0.0245 -> 2.45, "2.45%" -> 2.45, 2.45 -> 2.45)
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

    // Sanity/Bereiche – hier zusätzlich: max. 15 Jahre anzeigen
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

  // --- UI: Canvas minimal sicherstellen (simpel & robust) ---
  function getOrCreateCanvas(canvasId, fallbackContainerId = 'yieldChartSection') {
    let canvas = document.getElementById(canvasId);
    if (canvas) return canvas;

    const container =
      document.getElementById(fallbackContainerId) ||
      document.getElementById('reportsOffersPreview') ||
      document.body;

    canvas = document.createElement('canvas');
    canvas.id = canvasId;
    canvas.className = 'lineChart';
    container.appendChild(canvas);
    return canvas;
  }

  // Verwendung:
  const canvas = getOrCreateCanvas(targetId, 'durationChartSection');

  // (optional) minimale Styles
  canvas.style.display = 'block';
  canvas.style.margin = '0 auto';
  canvas.style.maxWidth = '600px';
  canvas.style.height = '400px';
  canvas.style.background = 'transparent';

  // --- Chart zeichnen (nur aktuelle Kurve + EUSW-Stützstellen + Punkte) ---
  drawYieldVsTimeChart({
    targetId,
    heading: 'Product Yields vs Duration',
    yieldCurve: durationCurve,
    pastYieldCurve: [],                 // explizit leer
    euswDataOriginal: durationEUSWData,
    points: productDurationPoints
  });
}





