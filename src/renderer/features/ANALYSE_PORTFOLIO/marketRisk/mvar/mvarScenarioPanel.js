'use strict';

// Scenario Sensitivities (Delta-Approximation): Bewertungswirkung je Szenario aus
// den dynamischen Portfolio-Sensitivitaeten (PV01/CPV01/VEGA aus
// PortfolioRiskSensitivitiesData) * Shift. Keine Neubewertung, kein Python.
// Nutzer legt eigene Szenarien an (Faktor + Shift); jeder Eintrag = rauf/runter.
// Definitionen liegen in der Tabelle ScenarioDefinition (generisches CRUD).

import { appState } from '../../../../renderer.js';

const FACTORS = {
  PV01:  { label: 'Interest Rates', unit: 'bp' },
  CPV01: { label: 'Credit Spreads', unit: 'bp' },
  VEGA:  { label: 'Volatility',     unit: 'vol pt' },
};

const POS = 'rgba(46, 204, 113, 0.85)';
const NEG = 'rgba(192, 57, 43, 0.85)';

let _defs = [];            // ScenarioDefinition rows: { id, factor, shift }
let _tornadoChart = null;
let _initDone = false;

function normalizePort(p) {
  return String(p ?? '').replace(/^Portfolios[_-]?/i, '').trim();
}

function fmtMio(v) {
  return `${(v / 1e6).toFixed(1)} Mio EUR`;
}

// Faktor-Totals (Σ VALUE_BASE je RISK_TYPE) fuer das gewaehlte Portfolio.
function factorTotals() {
  const rows = appState.getPortfolioRiskSensitivitiesData?.() || [];
  const port = normalizePort(appState.getSelectedPortTableName?.());
  const totals = {};
  for (const r of rows) {
    if (port && normalizePort(r.PORT_NAME ?? r.port_name) !== port) continue;
    const type = String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim();
    if (!FACTORS[type]) continue;
    const val = parseFloat(r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local);
    if (!Number.isFinite(val)) continue;
    totals[type] = (totals[type] || 0) + val;
  }
  return totals;
}

// Szenario-Balken aus Definitionen (je Eintrag +shift und -shift). total==0 -> weg.
function buildBars(totals) {
  const bars = [];
  for (const def of _defs) {
    const factor = String(def.factor || '').toUpperCase().trim();
    const meta = FACTORS[factor];
    const total = totals[factor];
    if (!meta || !Number.isFinite(total) || total === 0) continue;
    const shift = Math.abs(Number(def.shift) || 0);
    if (!shift) continue;
    bars.push({ label: `${meta.label} +${shift}${meta.unit}`, impact: total * shift });
    bars.push({ label: `${meta.label} -${shift}${meta.unit}`, impact: total * (-shift) });
  }
  // Tornado: groesster positiver oben, groesster negativer unten.
  return bars.sort((a, b) => b.impact - a.impact);
}

function renderScenarioList() {
  const c = document.getElementById('scenarioListContainer');
  if (!c) return;
  if (!_defs.length) {
    c.innerHTML = '<div class="empty-state">No scenarios yet — add one above.</div>';
    return;
  }
  const rows = _defs.map(def => {
    const meta = FACTORS[String(def.factor || '').toUpperCase().trim()];
    const label = meta ? meta.label : def.factor;
    const unit = meta ? meta.unit : '';
    return `<tr>
      <td>${label}</td>
      <td style="text-align:right;">&plusmn;${Math.abs(Number(def.shift) || 0)} ${unit}</td>
      <td style="text-align:right;"><button type="button" class="edit-button delete-button scenario-del-btn" data-id="${def.id}">Remove</button></td>
    </tr>`;
  }).join('');
  c.innerHTML = `<table class="MVaRTable"><thead><tr><th>Factor</th><th style="text-align:right;">Shift</th><th></th></tr></thead><tbody>${rows}</tbody></table>`;
}

function renderFactorDropdown(totals) {
  const sel = document.getElementById('scenarioFactorSelect');
  if (!sel) return;
  const available = Object.keys(FACTORS).filter(f => Number.isFinite(totals[f]) && totals[f] !== 0);
  const prev = sel.value;
  sel.innerHTML = (available.length ? available : Object.keys(FACTORS))
    .map(f => `<option value="${f}">${FACTORS[f].label}</option>`).join('');
  if (prev && [...sel.options].some(o => o.value === prev)) sel.value = prev;
  updateShiftUnit();
}

function updateShiftUnit() {
  const sel = document.getElementById('scenarioFactorSelect');
  const unitEl = document.getElementById('scenarioShiftUnit');
  if (!sel || !unitEl) return;
  unitEl.textContent = FACTORS[sel.value]?.unit || 'bp';
}

function destroyTornado() {
  if (_tornadoChart) { try { _tornadoChart.destroy(); } catch {} _tornadoChart = null; }
}

function renderTornado(bars) {
  const canvas = document.getElementById('scenarioTornadoChart');
  if (!canvas || !window.Chart) return;
  destroyTornado();
  if (!bars.length) return;

  // Feste Canvas-Groesse + responsive:false -> malt das Bitmap auch bei
  // verstecktem Panel, damit Report-Preview/PDF den Chart bekommen (wie die anderen
  // Charts). Hoehe nach Balkenanzahl. CSS skaliert bei Bedarf auf Panelbreite.
  canvas.width = 800;
  canvas.height = Math.max(240, bars.length * 26 + 80);
  canvas.style.maxWidth = '100%';
  canvas.style.height = 'auto';

  const bodyCss = getComputedStyle(document.body);
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';

  _tornadoChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: {
      labels: bars.map(b => b.label),
      datasets: [{
        data: bars.map(b => +(b.impact / 1e6).toFixed(2)),
        backgroundColor: bars.map(b => (b.impact >= 0 ? POS : NEG)),
        borderColor: bars.map(b => (b.impact >= 0 ? POS : NEG)),
        borderWidth: 1,
        maxBarThickness: 22,
        borderRadius: 3,
      }],
    },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false,
      color: chartColor,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${Number(ctx.parsed.x).toFixed(1)} Mio EUR` } },
      },
      scales: {
        x: { title: { display: true, text: 'Valuation impact (Mio EUR)', color: chartColor, font: { family: chartFont } },
             ticks: { color: chartColor, font: { family: chartFont } }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 11 } }, grid: { display: false } },
      },
    },
  });
}

function renderKpis(bars) {
  const c = document.getElementById('scenarioKpiContainer');
  if (!c) return;
  if (!bars.length) { c.innerHTML = '<div class="empty-state">No scenario data (no sensitivities for this portfolio).</div>'; return; }
  const mostNeg = bars.reduce((a, b) => (b.impact < a.impact ? b : a), bars[0]);
  const mostPos = bars.reduce((a, b) => (b.impact > a.impact ? b : a), bars[0]);
  const card = (title, label, value, color) => `
    <div class="cp-card" style="margin-bottom:10px;">
      <div style="font-size:12px; color:var(--text-muted);">${title}</div>
      <div style="font-size:13px; color:var(--text-bright);">${label}</div>
      <div style="font-size:20px; font-weight:700; color:${color};">${value}</div>
    </div>`;
  c.innerHTML =
    card('Largest negative driver', mostNeg.label, fmtMio(mostNeg.impact), NEG) +
    card('Largest positive driver', mostPos.label, fmtMio(mostPos.impact), POS);
}

function render() {
  bindControls();
  const totals = factorTotals();
  renderFactorDropdown(totals);
  renderScenarioList();
  const bars = buildBars(totals);
  renderKpis(bars);
  requestAnimationFrame(() => renderTornado(bars));
}

function addScenario() {
  const sel = document.getElementById('scenarioFactorSelect');
  const shiftEl = document.getElementById('scenarioShiftInput');
  const factor = sel ? String(sel.value || '').trim() : '';
  const shift = shiftEl ? Math.abs(Number(shiftEl.value) || 0) : 0;
  if (!factor || !shift) return;
  try {
    window.api.send('add-new-row', {
      cleanTableName: 'ScenarioDefinition',
      newRowData: { factor, shift },
      requestId: `scenario-add-${Date.now()}`,
    });
  } catch (e) { console.warn('[scenario] add failed', e); }
}

function removeScenario(id) {
  if (id == null) return;
  try {
    window.api.send('erase-data', {
      cleanTableName: 'ScenarioDefinition',
      uniqueIdentifier: { column: 'id', value: Number(id) },
    });
  } catch (e) { console.warn('[scenario] remove failed', e); }
}

// Steuer-Elemente idempotent binden (laufen sicher, sobald das Panel-DOM da ist).
function bindControls() {
  const addBtn = document.getElementById('scenarioAddBtn');
  if (addBtn && !addBtn.dataset.bound) { addBtn.dataset.bound = '1'; addBtn.addEventListener('click', addScenario); }
  const sel = document.getElementById('scenarioFactorSelect');
  if (sel && !sel.dataset.bound) { sel.dataset.bound = '1'; sel.addEventListener('change', updateShiftUnit); }
  const list = document.getElementById('scenarioListContainer');
  if (list && !list.dataset.bound) {
    list.dataset.bound = '1';
    list.addEventListener('click', (e) => {
      const btn = e.target?.closest?.('.scenario-del-btn');
      if (btn) removeScenario(btn.dataset.id);
    });
  }
}

// Dokument-Listener EINMAL installieren (unabhaengig von den Daten -> Panel rendert
// beim Oeffnen auch ohne ScenarioDefinition-Daten). Chart braucht Breite -> Panel-Open;
// Portfolio-Wechsel -> frische Sensitivitaeten.
function installListeners() {
  if (_initDone) return;
  _initDone = true;
  document.addEventListener('panel:opened', (e) => {
    if (e?.detail?.panelId === 'panel-mvar-scenarios') requestAnimationFrame(render);
  });
  document.addEventListener('portfolio-context-changed', () => render());
  // Feuert, wenn (neue) Sensitivitaeten in den Store gelangen (Portfolio-Wechsel/Recalc).
  document.addEventListener('portfolio-risk-sensitivities-data-refreshed', () => render());
}

// DataPump -> ScenarioDefinition rows.
export function handleScenarioDefinitionData(rows) {
  _defs = (Array.isArray(rows) ? rows : [])
    .map(r => ({ id: r.id ?? r.ID, factor: r.factor ?? r.FACTOR, shift: r.shift ?? r.SHIFT }))
    .filter(d => d.factor != null);
  installListeners();
  render();
}

// Fuer Portfolio-/Sensitivitaets-Refreshes von aussen aufrufbar.
export function renderMvarScenarioPanel() {
  installListeners();
  render();
}

// Beim Modul-Load Listener installieren -> Panel funktioniert auch ohne Daten.
installListeners();
