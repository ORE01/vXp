// Panel "Curve Construction"
// Editiert je Währung die Basis-Laufzeit (curve_base) und die flachen bp-Spreads
// (curve_spreads), aus denen die Kurven OIS/3M/6M/12M gebaut werden
// (base + spread_bp/10000). "Rebuild curves" baut sie aus dem letzten
// ERSTE-Snapshot neu (kein Scrape). Zusätzlich: Vergleichs-Chart
// (konstruierte Kurven vs. Benchmark:tblTS) je Währung.

import { getInterestRateCurveData } from '../interestRates/interestRateCurveData.js';
import { renderInterestRateCurvesChart } from '../interestRates/renderInterestRateCurveChart.js';

const TENORS = ['OIS', '3M', '6M', '12M'];
const INPUT_IDS = {
  OIS: 'ccSpreadOIS',
  '3M': 'ccSpread3M',
  '6M': 'ccSpread6M',
  '12M': 'ccSpread12M',
};

let ccBound = false;

function ccSetStatus(msg, kind = '') {
  const el = document.getElementById('ccStatus');
  if (!el) return;
  el.textContent = msg || '';
  el.className = 'cc-status' + (kind ? ` cc-status--${kind}` : '');
}

// Vergleichs-Chart: alle RATES_BASE-Kurven der ccy (konstruierte SWAP-Kurven
// + BENCHMARK:tblTS) überlagern. Datenquelle = derselbe Cache wie Interest Rates.
function ccRenderCompareChart(ccy) {
  const canvas = document.getElementById('ccCompareChart');
  if (!canvas || !canvas.isConnected) return;

  const cache = window.appState?._RATESDataCacheByCcy?.[ccy] || [];
  const curveIds = [...new Set(cache.map(r => r.curve_id))].filter(Boolean);

  const curves = curveIds.map(cid => {
    const { IRData } = getInterestRateCurveData(window.appState, ccy, cid, cid);
    return { label: cid, rows: IRData };
  }).filter(c => c.rows && c.rows.length);

  renderInterestRateCurvesChart(curves, {
    canvasId: 'ccCompareChart',
    storeKey: '_ccCompareChart',
    title: 'Constructed vs Benchmark',
  });
}

// Select-Data-Drawer auf die gewählte Währung filtern: nur die passende
// Konventions-Gruppe zeigen. So werden auch nur deren Konventionen geholt
// (der Fetch liest nur sichtbare fieldsets, siehe PYTHON/execution/router.js).
function ccFilterDrawerByCcy(ccy) {
  const box = document.getElementById('marketDataSelector');
  if (!box) return;
  box.querySelectorAll('fieldset[data-ccy]').forEach((fs) => {
    fs.hidden = (fs.dataset.ccy !== ccy);
  });
}

// Zwischenspeicher der Basis-Optionen (Konventionen) der aktuellen ccy.
let ccBaseOptions = [];

function ccBaseOption(value) {
  return ccBaseOptions.find(o => o.value === value) || null;
}

// Base-Dropdown (wählbare Konventionen: value=market_data_type, Text=Label) füllen.
function ccPopulateBaseSelector(options, selectedValue) {
  const sel = document.getElementById('ccBaseSelector');
  ccBaseOptions = Array.isArray(options) ? options : [];
  if (!sel) return;
  sel.innerHTML = ccBaseOptions
    .map(o => `<option value="${o.value}">${o.label}</option>`)
    .join('');
  const has = ccBaseOptions.some(o => o.value === selectedValue);
  sel.value = has ? selectedValue : (ccBaseOptions[0]?.value || '');
}

// Hinweistext an die gewählte Basis-Konvention anpassen.
function ccUpdateHint(baseValue) {
  const el = document.getElementById('ccHint');
  if (!el) return;
  const opt = ccBaseOption(baseValue);
  const label = opt ? opt.label : 'base';
  const it = opt ? opt.index_tenor : '';
  el.innerHTML =
    `Curves are built from the <strong>${label}</strong> base swap rates: ` +
    `<code>value = base + spread(bp) / 10000</code>. ` +
    (it ? `The <strong>${it}</strong> curve equals the base (spread 0); ` : '') +
    `spreads are flat across all maturities.`;
}

// Zwischenspeicher der aktuell angezeigten Tenoren (für den Save).
let ccTenors = [];

// Base-per-Tenor-MATRIX in den Drawer rendern: Zeilen = Tenoren, Spalten =
// Konventionen. Pro Zeile genau EINE Auswahl (Basisquelle des Tenors); eine
// Spalte mit >=1 Auswahl wird spaeter auch geholt. Vorbelegt aus base_points,
// sonst mit der Default-Basis.
function ccRenderDrawerMatrix(ccy, tenors, baseOptions, basePoints, defaultMdt) {
  const box = document.getElementById('marketDataSelector');
  ccTenors = Array.isArray(tenors) ? tenors : [];
  if (!box) return;

  const opts = Array.isArray(baseOptions) ? baseOptions : [];
  const saved = new Map(
    (Array.isArray(basePoints) ? basePoints : [])
      .map(p => [String(p.tenor).toUpperCase(), String(p.market_data_type)])
  );

  if (!ccTenors.length || !opts.length) {
    box.innerHTML = `<p class="cc-matrix-empty">No tenors / conventions available for ${ccy}.</p>`;
    return;
  }

  const head = opts.map(o => `<th>${o.label}</th>`).join('');
  const body = ccTenors.map((t) => {
    const sel = saved.get(t) || defaultMdt || (opts[0] && opts[0].value) || '';
    const cells = opts.map(o =>
      `<td><input type="checkbox" value="${o.value}" data-ccy="${ccy}" data-tenor="${t}"` +
      `${o.value === sel ? ' checked' : ''}></td>`
    ).join('');
    return `<tr data-tenor="${t}"><th class="cc-matrix-tenor">${t}</th>${cells}</tr>`;
  }).join('');

  box.innerHTML =
    `<table class="cc-matrix"><thead><tr><th>Tenor</th>${head}</tr></thead>` +
    `<tbody>${body}</tbody></table>`;

  // 1 Auswahl je Zeile erzwingen: Haken setzen -> Geschwister der Zeile aus.
  box.querySelectorAll('table.cc-matrix input[type="checkbox"]').forEach((cb) => {
    cb.addEventListener('change', (e) => {
      if (!e.target.checked) return;
      const row = e.target.closest('tr');
      if (!row) return;
      row.querySelectorAll('input[type="checkbox"]').forEach((other) => {
        if (other !== e.target) other.checked = false;
      });
    });
  });
}

// Spreads + Basis einer Währung in die Inputs laden.
async function ccLoadSpreadsForCcy(ccy) {
  ccFilterDrawerByCcy(ccy);

  let data = { spreads: [], base_mdt: '', base_options: [], tenors: [], base_points: [] };
  try {
    data = await window.api.invoke('curve-spreads:get', { ccy }) || data;
  } catch (e) {
    ccSetStatus(`Could not load spreads: ${e.message}`, 'error');
  }

  const spreads = Array.isArray(data.spreads) ? data.spreads : [];
  const baseMdt = String(data.base_mdt || '');
  const baseOptions = Array.isArray(data.base_options) ? data.base_options : [];

  ccPopulateBaseSelector(baseOptions, baseMdt);
  ccUpdateHint(baseMdt);
  ccRenderDrawerMatrix(ccy, data.tenors, baseOptions, data.base_points, baseMdt);

  // index_tenor der Basis-Konvention -> deren Zielkurve wird 0 vorbelegt.
  const baseIt = (ccBaseOption(baseMdt) || {}).index_tenor || '';

  const byTenor = new Map(
    spreads.map(r => [String(r.index_tenor).toUpperCase(), r.spread_bp])
  );

  for (const t of TENORS) {
    const input = document.getElementById(INPUT_IDS[t]);
    if (!input) continue;
    const has = byTenor.has(t);
    // Vorbelegung: Basis-Kurve = 0, sonst leer.
    const v = has ? byTenor.get(t) : (t === baseIt ? 0 : '');
    input.value = (v === null || v === undefined) ? '' : v;
  }

  ccRenderCompareChart(ccy);
}

// CCY-Dropdown aus dem ERSTE-Mapping (INCLUDE=1) füllen.
async function ccPopulateCurrencies() {
  const sel = document.getElementById('ccCurrencySelector');
  if (!sel) return;

  let ccys = [];
  try {
    ccys = await window.api.invoke('curve-spreads:currencies') || [];
  } catch (e) { /* Fallback unten */ }
  if (!ccys.length) ccys = ['EUR'];

  const keep = sel.value;
  sel.innerHTML = ccys.map(c => `<option value="${c}">${c}</option>`).join('');
  const initial = ccys.includes(keep) ? keep : ccys[0];
  sel.value = initial;

  await ccLoadSpreadsForCcy(initial);
}

// Aktuelle Inputs -> curve_spreads speichern.
async function ccSave() {
  const ccy = document.getElementById('ccCurrencySelector')?.value;
  if (!ccy) return false;
  const baseMdt = document.getElementById('ccBaseSelector')?.value || '';

  const spreads = [];
  for (const t of TENORS) {
    const raw = document.getElementById(INPUT_IDS[t])?.value;
    if (raw === '' || raw === undefined || raw === null) continue;
    const bp = Number(raw);
    if (!Number.isFinite(bp)) {
      ccSetStatus(`Invalid value for ${t}.`, 'error');
      return false;
    }
    spreads.push({ index_tenor: t, spread_bp: bp });
  }

  // Per-Tenor-Basis-Auswahl aus der Drawer-Matrix einsammeln (1 Haken je Zeile).
  const base_points = [];
  document.querySelectorAll('#marketDataSelector input[type="checkbox"][data-tenor]:checked').forEach((cb) => {
    const tenor = String(cb.dataset.tenor || '').toUpperCase();
    const mdt = String(cb.value || '');
    if (tenor && mdt) base_points.push({ tenor, market_data_type: mdt });
  });

  try {
    const res = await window.api.invoke('curve-spreads:save', { ccy, spreads, base_mdt: baseMdt, base_points });
    if (res && res.success === false) {
      ccSetStatus(`Save failed: ${res.message || 'unknown error'}`, 'error');
      return false;
    }
    ccSetStatus(`Saved ${spreads.length} spread(s) for ${ccy}.`, 'ok');
    return true;
  } catch (e) {
    ccSetStatus(`Save failed: ${e.message}`, 'error');
    return false;
  }
}

// Erst speichern, dann Kurven aus dem letzten Snapshot neu bauen.
async function ccRebuild() {
  const saved = await ccSave();
  if (!saved) return;

  const btn = document.getElementById('ccRebuildBtn');
  if (btn) btn.disabled = true;
  ccSetStatus('Rebuilding curves from last snapshot…', 'info');
  window.api.send('start-py-erste-rebuild', {});
}

// Events nur einmal binden (DOM-Elemente sind statisch im index.html).
function ccWireOnce() {
  if (ccBound) return;
  ccBound = true;

  document.getElementById('ccCurrencySelector')
    ?.addEventListener('change', (e) => ccLoadSpreadsForCcy(e.target.value));
  document.getElementById('ccBaseSelector')
    ?.addEventListener('change', (e) => ccUpdateHint(e.target.value));
  document.getElementById('ccSaveBtn')
    ?.addEventListener('click', ccSave);
  document.getElementById('ccRebuildBtn')
    ?.addEventListener('click', ccRebuild);

  window.api.receive?.('py-erste-rebuild-progress', (p) => {
    if (p && typeof p.progress !== 'undefined') {
      ccSetStatus(`${p.message || 'Working…'} (${p.progress}%)`, 'info');
    }
  });

  window.api.receive?.('py-erste-rebuild-complete', (res) => {
    const btn = document.getElementById('ccRebuildBtn');
    if (btn) btn.disabled = false;
    if (res && res.success) {
      ccSetStatus(res.message || 'Curves rebuilt.', 'ok');
      // RATES_BASE wird nach dem Rebuild refresht -> Chart kurz verzögert neu zeichnen.
      setTimeout(() => {
        ccRenderCompareChart(document.getElementById('ccCurrencySelector')?.value);
      }, 500);
    } else {
      ccSetStatus((res && res.message) || 'Rebuild failed.', 'error');
    }
  });
}

export function renderCurveConstructionPanel() {
  const panel = document.getElementById('panel-curve-construction');
  if (!panel) return;

  ccWireOnce();
  ccPopulateCurrencies();
}
