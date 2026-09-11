// ============================================================
// ASRF Analysis Panels (Regulatory Benchmark) — analytisches Credit-Risk-Modell.
//
// INSTANZFAEHIG: zwei Panels (historic PD -> pd_flag=RATING, market-adjusted PD ->
// pd_flag=NORM), beide identisch aufgebaut (klassenbasiert, `.asrf-panel-root` mit
// data-asrf-pdflag). Ein Renderer bedient beide -> ein echtes Vergleichspaar zu den
// MF-GC-Sichten (historic / market-adjusted).
//
// REIN ADDITIV + ASRF-guarded: rendert nur aus ASRF_Summary / ASRF_IssuerAnalysis.
// MF_GC schreibt diese Tabellen NICHT -> ohne ASRF-Daten Empty-State. Der MF_GC-Pfad
// wird an KEINER Stelle beruehrt.
// ============================================================

import { appState } from '../../../renderer.js';
// Scatter (Tail loss vs EAD share) aus dem MF-GC-Dashboard wiederverwenden — ID-basiert,
// generische Tools (Zoom/Show-N/Label-Kollision). Nur Wiederverwendung, kein MF-GC-Eingriff.
import { renderCrTcmScatter } from './creditRiskDashboard.js';
import { kpiCard } from '../../../utils/kpiCard.js';

const TOP_N = 8; // Charts: Top-N Issuer + "Others"-Bucket

// ---------- Formatter (de-DE) ----------
const _num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };
const esc = (s) => String(s ?? '').replace(/[<>&]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
const pct = (v, d = 2) => { const n = _num(v); return Number.isFinite(n) ? (n * 100).toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %' : '–'; };
const eurFull = (v) => { const n = _num(v); return Number.isFinite(n) ? n.toLocaleString('de-DE', { maximumFractionDigits: 0 }) : '–'; };
const facX = (v) => { const n = _num(v); return Number.isFinite(n) ? n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + 'x' : '–'; };
function smartEur(v) {
  const n = _num(v);
  if (!Number.isFinite(n)) return '–';
  if (Math.abs(n) >= 1e6) return 'EUR ' + (n / 1e6).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' Mio.';
  return 'EUR ' + n.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

const _grid = () => 'rgba(160,160,160,0.15)';

// Kompakte Log-Achsen-Ticks: nur ganze Dekaden, als 1e-x / kompakt (statt langer
// de-DE-Dezimalzahlen wie "0,0000100000"). Fuer die Probability-Mass-Log-Achse.
const _fmtLogPM = (v) => {
  const n = Number(v);
  if (!Number.isFinite(n) || n <= 0) return '';
  const e = Math.log10(n);
  if (Math.abs(e - Math.round(e)) > 1e-6) return '';   // nur Dekaden beschriften
  const r = Math.round(e);
  if (r === 0) return '1';
  if (r >= 1 && r <= 3) return n.toLocaleString('de-DE');
  return `1e${r}`;
};

// Chart-Instanz an der Canvas selbst halten (kein globaler Key-Konflikt zwischen Panels).
function _chartOn(canvas, config) {
  if (!canvas) return;
  try { if (canvas.__asrfChart) { canvas.__asrfChart.destroy(); canvas.__asrfChart = null; } } catch (_) {}
  if (!(canvas.clientWidth > 0 && canvas.clientHeight > 0)) return; // Panel nicht sichtbar
  if (!window.Chart) return;
  canvas.__asrfChart = new window.Chart(canvas.getContext('2d'), config);
}
function _destroyCharts(root) {
  root.querySelectorAll('canvas').forEach(c => { try { if (c.__asrfChart) { c.__asrfChart.destroy(); c.__asrfChart = null; } } catch (_) {} });
}

// Rating je Issuer aus der EAD-Tabelle (immer pd_flag='RATING') fuers gewaehlte Portfolio.
function _ratingByIssuer(port) {
  const map = new Map();
  (appState.getAllEADData?.() || []).forEach(r => {
    if (String(r?.port_name ?? '').trim() !== port) return;
    if (String(r?.pd_flag ?? '').trim().toUpperCase() !== 'RATING') return;
    const iss = String(r?.ISSUER ?? '').trim();
    if (iss && !map.has(iss)) map.set(iss, String(r?.RATING ?? '').trim());
  });
  return map;
}

// Top-N Issuer + aggregierter "Others"-Rest (fuer die Charts).
function _topWithOthers(rows, valueKey) {
  const sorted = [...rows].sort((a, b) => (_num(b[valueKey]) || 0) - (_num(a[valueKey]) || 0));
  if (sorted.length <= TOP_N) return sorted.map(r => ({ ...r, __label: r.ISSUER }));
  const head = sorted.slice(0, TOP_N).map(r => ({ ...r, __label: r.ISSUER }));
  const tail = sorted.slice(TOP_N);
  const agg = { __label: `Others (${tail.length})`, ISSUER: '__others__', __isOthers: true };
  ['EC_SHARE', 'EL_SHARE', 'VAR_SHARE', 'EAD', 'EC', 'EXPECTED_LOSS', 'VAR_CONTRIBUTION'].forEach(k => {
    agg[k] = tail.reduce((s, r) => s + (_num(r[k]) || 0), 0);
  });
  return [...head, agg];
}

function _buildTable(cols, rows) {
  const thead = '<thead><tr>' + cols.map(c => `<th${c[2] === 'r' ? ' style="text-align:right;"' : ''}>${esc(c[1])}</th>`).join('') + '</tr></thead>';
  const tbody = '<tbody>' + rows.map(r => '<tr>' + cols.map(c => `<td${c[2] === 'r' ? ' style="text-align:right;"' : ''}>${c[3](r[c[0]])}</td>`).join('') + '</tr>').join('') + '</tbody>';
  return `<table>${thead}${tbody}</table>`;
}

// ---------- KPI-Band + Bullets ----------
function _renderKpis(root, summary, issuerRows) {
  const set = (cls, txt) => { const el = root.querySelector('.' + cls); if (el) el.textContent = txt; };
  const sumOf = (k) => issuerRows.reduce((s, r) => s + (_num(r[k]) || 0), 0);
  const EL = summary ? _num(summary.EL) : sumOf('EXPECTED_LOSS');
  const VaR = summary ? _num(summary.VaR) : sumOf('VAR_CONTRIBUTION');
  const EC = summary ? _num(summary.EC) : sumOf('EC');
  const ES = summary ? _num(summary.ES) : NaN;
  const relEL = summary ? _num(summary.EL_rel) : NaN;
  const relVaR = summary ? _num(summary.VaR_rel) : NaN;
  const relEC = summary ? _num(summary.EC_rel) : NaN;
  const relES = summary ? _num(summary.ES_rel) : NaN;

  // KPI-Kacheln zentral ueber die kpiCard-Komponente rendern (wie Credit Historic/Market adjusted):
  // "EUR" klein vorne + kompakt (Tsd./Mio.), Rahmenfarbe je Metrik, Connector; Sub = "% of NAV".
  // conc-kpi-Markup bleibt -> gleiche Optik/Rahmen wie die MF-GC-Kacheln.
  const _sub = (rel, fb) => (Number.isFinite(rel) ? `${pct(rel, 2)} of NAV` : fb);
  const _card = (tile, metric, conn, label, abs, rel, fb) => kpiCard({
    tileKey: tile, metric, connector: conn, label, single: 'abs', abs, subText: _sub(rel, fb),
  });
  const grid = root.querySelector('.asrf-kpi-grid');
  if (grid) {
    grid.innerHTML =
      _card('asrf_el',  'el',  '+',  'Expected Loss (EL)',      EL,  relEL,  'Expected Loss')
      + _card('asrf_ec',  'ec',  '=',  'Economic Capital (EC)',   EC,  relEC,  'VaR − EL')
      + _card('asrf_var', 'var', '→',  'Value at Risk (VaR)',     VaR, relVaR, 'Value at Risk')
      + _card('asrf_es',  'es',  null, 'Expected Shortfall (ES)', ES,  relES,  'systemic tail');
  }

  const ul = root.querySelector('.asrf-bullets');
  if (ul) {
    const conf = summary ? _num(summary.conf_level) : NaN;
    const z = summary ? _num(summary.systemic_z) : NaN;
    const bullets = [
      'Regulatory benchmark model: Asymptotic Single Risk Factor (ASRF) — VaR is calculated analytically; ES via one-dimensional integration. No Monte Carlo simulation.',
      `Economic Capital of ${smartEur(EC)} provides a risk buffer${Number.isFinite(conf) ? ` at ${pct(conf, 1)} confidence` : ''}.`,
      `Value at Risk reaches ${smartEur(VaR)}; Expected Shortfall reaches ${smartEur(ES)}.`,
      Number.isFinite(z)
        ? `Issuer contributions below reflect the systemic tail state Z = ${z.toLocaleString('de-DE', { minimumFractionDigits: 4, maximumFractionDigits: 4 })}.`
        : 'Issuer contributions below show which names drive ASRF Economic Capital.',
    ];
    ul.innerHTML = bullets.map(b => `<li>${esc(b)}</li>`).join('');
  }
}

// ---------- Tail Concentration (Funnel / Scatter / TCM-Tabelle) ----------
// Spiegelt die zweite Reihe des MF-GC Internal-Model-Panels, aber aus der ANALYTISCHEN
// ASRF-Basis: Tail-Loss-Share = ES_SHARE (analytisch integrierter ES-Beitrag je Issuer),
// EAD-Share = EAD / Sum(EAD). TCM = Tail-Loss-Share / EAD-Share (>1 = ueberproportional).
// Rein additiv, kein MF-GC-/Python-Eingriff.
function _buildAsrfTcmRows(issuerRows, ratingMap) {
  const totalEad = issuerRows.reduce((s, r) => s + (_num(r.EAD) || 0), 0);
  return issuerRows.map((r) => {
    const name = String(r.ISSUER ?? '').trim();
    const pct = (_num(r.ES_SHARE) || 0) * 100;                 // Tail-Loss-Anteil (ES) in %
    const ead = _num(r.EAD) || 0;
    const eadShare = totalEad > 0 ? ead / totalEad * 100 : NaN; // Exposure-Anteil in %
    const tcm = (Number.isFinite(eadShare) && eadShare > 0) ? pct / eadShare : NaN;
    return { name, rating: (ratingMap.get(name) || ''), pct, eadShare, tcm, rankKeys: new Set() };
  }).filter(r => r.name);
}

// Concentration funnel: Total issuers -> Effective tail drivers (1/Sum(share^2), inverse HHI
// auf den ES-Shares) -> Top-K treiben X % des Tail-Loss. Box/Pfeil-Look wie MF-GC.
function _renderAsrfFunnel(root, issuerRows) {
  const el = root.querySelector('.asrf-tcm-funnel');
  if (!el) return;
  const shares = issuerRows.map(r => Math.max(0, _num(r.ES_SHARE) || 0)).sort((a, b) => b - a);
  const N = shares.length;
  const sumSh = shares.reduce((a, b) => a + b, 0) || 1;
  const norm = shares.map(s => s / sumSh);                     // auf 1 normiert (robust)
  const hhi = norm.reduce((a, s) => a + s * s, 0);
  const nEff = hhi > 0 ? Math.max(1, Math.min(N, Math.round(1 / hhi))) : N;
  const K = Math.max(1, Math.min(nEff, N));
  const topKShare = norm.slice(0, K).reduce((a, b) => a + b, 0) * 100;
  const f1 = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const box = (label, v) => `<div style="border:1px solid var(--border-subtle); border-radius:6px; padding:5px 9px; background:var(--surface-overlay); text-align:center;"><div style="font-size:9.5px; color:var(--text-muted); line-height:1.2;">${label}</div><div style="font-size:17px; font-weight:700; color:var(--text-bright); line-height:1.1; margin-top:1px;">${v}</div></div>`;
  const arrow = `<div style="color:var(--text-bright); font-size:15px; line-height:1; text-align:center; margin:2px 0;">&darr;</div>`;
  const boxes = [
    box('total issuers', N),
    box('effective tail drivers (1 / &Sigma; share&sup2;)', nEff),
    box(`top ${K} drive ${f1(topKShare)} % of tail loss (ES)`, K),
  ];
  el.innerHTML = `<div style="flex:1; display:flex; flex-direction:column; justify-content:space-between;">${boxes.join(arrow)}</div>`;
}

// TCM-Tabelle: Issuer | Tail loss | EAD | TCM, absteigend nach TCM (staerkste Schieflage oben),
// Ampelfarben ab 1,0x / 1,5x, Scroll ab 5 Zeilen. Markup identisch zum MF-GC-Panel.
function _renderAsrfTcmTable(root, tcmRows) {
  const el = root.querySelector('.asrf-tcm-table');
  if (!el) return;
  const rows = [...tcmRows].sort((a, b) => (Number.isFinite(b.tcm) ? b.tcm : -Infinity) - (Number.isFinite(a.tcm) ? a.tcm : -Infinity));
  if (!rows.length) {
    el.innerHTML = '<table class="conc-report-table"><tbody><tr><td>No tail data.</td></tr></tbody></table>';
    return;
  }
  const p1 = (x) => `${Number(x).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
  el.innerHTML = `<div class="cr-tcm-scroll"><table class="conc-report-table"><thead><tr><th>Issuer</th><th style="text-align:right;">Tail loss</th><th style="text-align:right;">EAD</th><th style="text-align:right;" title="Tail Concentration Multiplier = Tail loss share / EAD share">TCM</th></tr></thead><tbody>${
    rows.map((it) => {
      const tcmStyle = !Number.isFinite(it.tcm) ? '' : (it.tcm >= 1.5 ? 'color:#d9534f;font-weight:700;' : it.tcm > 1 ? 'color:#e0a533;font-weight:600;' : '');
      const tcmStr = Number.isFinite(it.tcm) ? `${it.tcm.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}×` : '–';
      return `<tr><td>${esc(it.name)}</td><td style="text-align:right;">${p1(it.pct)}</td><td style="text-align:right;">${Number.isFinite(it.eadShare) ? p1(it.eadShare) : '–'}</td><td style="text-align:right;${tcmStyle}">${tcmStr}</td></tr>`;
    }).join('')
  }</tbody></table></div>`;
  // Max 5 Zeilen sichtbar; bei mehr scrollt der Container (Zeilen bereits nach TCM absteigend).
  if (rows.length > 5) {
    const scroll = el.querySelector('.cr-tcm-scroll');
    const thead = el.querySelector('thead');
    const bodyRows = el.querySelectorAll('tbody tr');
    if (scroll && thead && bodyRows.length > 5) {
      let h = thead.offsetHeight || 0;
      for (let i = 0; i < 5; i++) h += (bodyRows[i].offsetHeight || 0);
      if (h > 0) { scroll.style.maxHeight = (h + 2) + 'px'; scroll.style.overflowY = 'auto'; }
    }
  }
}

// Scatter (Tail loss vs EAD share): wiederverwendeter MF-GC-Renderer, eigene Canvas-ID je Sicht.
function _renderAsrfTcmScatter(root, pdFlag, tcmRows) {
  const canvas = root.querySelector('canvas.asrf-tcm-scatter');
  if (!canvas) return;
  const canvasId = (pdFlag === 'NORM') ? 'asrfTcmScatterNorm' : 'asrfTcmScatterHist';
  if (canvas.id !== canvasId) canvas.id = canvasId;
  try { renderCrTcmScatter(canvasId, tcmRows); } catch (e) { console.warn('[ASRF] TCM scatter failed', e); }
}

// ---------- Chart: Top tail drivers (Anteil am Tail-Loss = VaR-Contribution-Share) ----------
function _renderTailDrivers(root, issuerRows) {
  const canvas = root.querySelector('canvas.asrf-taildrivers-chart');
  // Top-8 nach ES-Contribution-Share (analytische Euler-Allokation des ES, kein "Others").
  const top = [...issuerRows].sort((a, b) => (_num(b.ES_SHARE) || 0) - (_num(a.ES_SHARE) || 0)).slice(0, 8);
  const bodyCss = getComputedStyle(document.body);
  const col = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#ccc';
  _chartOn(canvas, {
    type: 'bar',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: {
      labels: top.map(d => d.ISSUER),
      datasets: [{
        label: 'Contribution to tail loss (ES, %)',
        data: top.map(d => +((_num(d.ES_SHARE) || 0) * 100).toFixed(1)),
        backgroundColor: 'rgba(210,70,70,0.85)',
        borderColor: 'rgba(210,70,70,0.95)',
        maxBarThickness: 22,
      }],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      layout: { padding: { right: 44 } },
      plugins: {
        legend: { display: false },
        datalabels: window.ChartDataLabels ? {
          anchor: 'end', align: 'right', clamp: true, color: col, font: { size: 10 },
          formatter: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 0 })}%`,
        } : undefined,
        tooltip: { callbacks: { label: (c) => `${Number(c.parsed.x).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %` } },
      },
      scales: {
        x: { beginAtZero: true, title: { display: true, text: 'Contribution to tail loss (ES, %)' }, ticks: { callback: (v) => `${v}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { grid: { display: false } },
      },
    },
  });
}

// ---------- Chart 2: Conditional PD (PD-Historic vs PD under stress, log-x, Dekaden-Ticks) ----------
function _renderCondPd(root, issuerRows, confLabel) {
  const canvas = root.querySelector('canvas.asrf-condpd-chart');
  const data = [...issuerRows].sort((a, b) => (_num(b.EC) || 0) - (_num(a.EC) || 0)).slice(0, TOP_N);
  const toPctPos = (v) => { const n = (_num(v) || 0) * 100; return n > 0 ? n : 1e-6; };
  const allVals = data.flatMap(d => [toPctPos(d.PD), toPctPos(d.PD_AT_VAR)]).filter(v => v > 0);
  const lo = allVals.length ? Math.min(...allVals) : 0.01;
  const hi = allVals.length ? Math.max(...allVals) : 1;
  const xMin = Math.pow(10, Math.floor(Math.log10(lo)));
  const xMax = Math.pow(10, Math.ceil(Math.log10(hi)));
  const fmtDecade = (v) => {
    const n = Number(v);
    if (!Number.isFinite(n) || n <= 0) return '';
    const d = Math.max(0, -Math.floor(Math.log10(n) + 1e-9));
    return n.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) + ' %';
  };
  _chartOn(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.ISSUER),
      datasets: [
        { label: 'PD (Historic)', data: data.map(d => toPctPos(d.PD)), backgroundColor: 'rgba(70,130,220,0.75)', borderColor: 'rgba(70,130,220,1)', borderWidth: 1 },
        { label: `PD under ${confLabel} stress`, data: data.map(d => toPctPos(d.PD_AT_VAR)), backgroundColor: 'rgba(210,60,55,0.75)', borderColor: 'rgba(210,60,55,1)', borderWidth: 1 },
      ],
    },
    options: {
      indexAxis: 'y', responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: 'rectRounded' } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.x.toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })} %` } },
      },
      scales: {
        x: {
          type: 'logarithmic', min: xMin, max: xMax,
          title: { display: true, text: 'Default probability (%) — log scale' },
          afterBuildTicks: (axis) => {
            const ticks = [];
            for (let e = Math.round(Math.log10(axis.min)); e <= Math.round(Math.log10(axis.max)); e++) ticks.push({ value: Math.pow(10, e) });
            axis.ticks = ticks;
          },
          ticks: { callback: (v) => fmtDecade(v) },
          grid: { color: _grid() },
        },
        y: { grid: { display: false } },
      },
    },
  });
}

// ---------- Chart 3: Pareto (EC-Share Balken + kumulierte Linie) ----------
function _renderPareto(root, issuerRows) {
  const canvas = root.querySelector('canvas.asrf-pareto-chart');
  const data = _topWithOthers(issuerRows, 'EC_SHARE');
  let cum = 0;
  const cumVals = data.map(d => { cum += (_num(d.EC_SHARE) || 0) * 100; return Math.min(cum, 100); });
  _chartOn(canvas, {
    data: {
      labels: data.map(d => d.__label),
      datasets: [
        { type: 'bar', label: 'EC share', data: data.map(d => (_num(d.EC_SHARE) || 0) * 100), backgroundColor: data.map(d => d.__isOthers ? 'rgba(150,150,150,0.6)' : 'rgba(210,60,55,0.7)'), borderColor: 'rgba(210,60,55,1)', borderWidth: 1, yAxisID: 'y', order: 2 },
        { type: 'line', label: 'Cumulative share', data: cumVals, borderColor: 'rgba(70,130,220,1)', backgroundColor: 'rgba(70,130,220,0.1)', borderWidth: 2, pointRadius: 3, tension: 0.2, yAxisID: 'y1', order: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: 'rectRounded' } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0 } },
        y: { position: 'left', title: { display: true, text: 'EC share (%)' }, ticks: { callback: v => v + ' %' }, grid: { color: _grid() } },
        y1: { position: 'right', min: 0, max: 100, title: { display: true, text: 'Cumulative (%)' }, ticks: { callback: v => v + ' %' }, grid: { display: false } },
      },
    },
  });
}

// ---------- Chart 4: EL- vs VaR-Contribution (gruppierte Balken) ----------
function _renderElVar(root, issuerRows) {
  const canvas = root.querySelector('canvas.asrf-elvar-chart');
  const data = _topWithOthers(issuerRows, 'EC_SHARE');
  _chartOn(canvas, {
    type: 'bar',
    data: {
      labels: data.map(d => d.__label),
      datasets: [
        { label: 'EL contribution', data: data.map(d => (_num(d.EL_SHARE) || 0) * 100), backgroundColor: 'rgba(70,130,220,0.8)', borderColor: 'rgba(70,130,220,1)', borderWidth: 1 },
        { label: 'VaR contribution', data: data.map(d => (_num(d.VAR_SHARE) || 0) * 100), backgroundColor: 'rgba(240,160,40,0.85)', borderColor: 'rgba(240,160,40,1)', borderWidth: 1 },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: { legend: { display: true, position: 'top', labels: { boxWidth: 12, boxHeight: 12, usePointStyle: true, pointStyle: 'rectRounded' } } },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 40, minRotation: 0 } },
        y: { title: { display: true, text: 'Contribution (%)' }, ticks: { callback: v => v + ' %' }, grid: { color: _grid() } },
      },
    },
  });
}

// ---------- Tabellen ----------
function _renderShareTable(root, issuerRows) {
  const el = root.querySelector('.asrf-share-table');
  if (!el) return;
  const rows = [...issuerRows].sort((a, b) => (_num(b.EC_SHARE) || 0) - (_num(a.EC_SHARE) || 0));
  const cols = [
    ['ISSUER', 'Issuer', 'l', esc],
    ['EL_SHARE', 'EL share', 'r', v => pct(v, 1)],
    ['VAR_SHARE', 'VaR share', 'r', v => pct(v, 1)],
    ['EC_SHARE', 'EC share', 'r', v => pct(v, 1)],
    ['EC_TO_EAD', 'EC / EAD', 'r', facX],
  ];
  el.innerHTML = _buildTable(cols, rows);
}

function _renderAllIssuers(root, issuerRows, port) {
  const el = root.querySelector('.asrf-all-table');
  if (!el) return;
  const ratings = _ratingByIssuer(port);
  const rows = [...issuerRows].sort((a, b) => (_num(a.EC_RANK) || 0) - (_num(b.EC_RANK) || 0))
    .map(r => ({ ...r, __RATING: ratings.get(String(r.ISSUER ?? '').trim()) || '–' }));
  const cols = [
    ['ISSUER', 'Issuer', 'l', esc],
    ['EC_RANK', 'Rank', 'r', v => (Number.isFinite(_num(v)) ? String(_num(v)) : '–')],
    ['__RATING', 'Rating', 'l', esc],
    ['EAD', 'EAD (EUR)', 'r', eurFull],
    ['LGD_RATE', 'LGD (%)', 'r', v => pct(v, 1)],
    ['PD', 'PD (%)', 'r', v => pct(v, 3)],
    ['PD_AT_VAR', 'PD under stress (%)', 'r', v => pct(v, 3)],
    ['EXPECTED_LOSS', 'Expected Loss (EUR)', 'r', eurFull],
    ['VAR_CONTRIBUTION', 'VaR Contribution (EUR)', 'r', eurFull],
    ['EC', 'Economic Capital (EUR)', 'r', eurFull],
    ['EC_SHARE', 'EC Share (%)', 'r', v => pct(v, 1)],
  ];
  el.innerHTML = _buildTable(cols, rows);
}

// ---------- Instanz-Render (ein Panel) ----------
function renderAsrfInstance(root) {
  if (!root) return;
  const pdFlag = String(root.getAttribute('data-asrf-pdflag') || 'RATING').toUpperCase();
  const empty = root.querySelector('.asrf-empty');
  const content = root.querySelector('.asrf-content');
  if (!empty || !content) return;

  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();
  const issuerRows = (appState.getAsrfIssuerAnalysis?.() || []).filter(r =>
    r && String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === pdFlag
  );
  const summary = (appState.getAsrfSummary?.() || []).find(r =>
    r && String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === pdFlag
  ) || null;

  if (!issuerRows.length) {
    content.style.display = 'none';
    empty.style.display = '';
    _destroyCharts(root);
    return;
  }

  empty.style.display = 'none';
  content.style.display = '';

  const confFrac = summary ? _num(summary.conf_level) : NaN;
  const confLabel = Number.isFinite(confFrac) ? pct(confFrac, 1) : '99,9 %';

  const byEc = [...issuerRows].sort((a, b) => (_num(b.EC) || 0) - (_num(a.EC) || 0));
  const topN = Math.min(5, byEc.length);
  const topShare = byEc.slice(0, topN).reduce((s, r) => s + (_num(r.EC_SHARE) || 0), 0);
  const noteEl = root.querySelector('.asrf-pareto-note');
  if (noteEl) noteEl.textContent = `Top ${topN} issuers account for ${pct(topShare, 1)} of ASRF Economic Capital.`;

  try { _renderKpis(root, summary, issuerRows); } catch (e) { console.warn('[ASRF] KPI render failed', e); }
  try { _renderShareTable(root, issuerRows); } catch (e) { console.warn('[ASRF] share table failed', e); }
  try { _renderAllIssuers(root, issuerRows, port); } catch (e) { console.warn('[ASRF] all-issuers table failed', e); }

  if (window.Chart) {
    // Erster Chart: analytische ASRF-Verteilung (Tail-Highlight + VaR/ES), pd_flag der Instanz.
    try {
      const lossRows = (appState.getAsrfLossHistogram?.() || []).filter(r =>
        String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === pdFlag);
      _drawLossHist(root.querySelector('canvas.asrf-lossdist-chart'), lossRows,
        summary ? _num(summary.VaR_rel) : NaN, summary ? _num(summary.ES_rel) : NaN, summary ? _num(summary.EL_rel) : NaN);
    } catch (e) { console.warn('[ASRF] loss dist chart failed', e); }
    try { _renderTailDrivers(root, issuerRows); } catch (e) { console.warn('[ASRF] tail drivers chart failed', e); }
    // Tail Concentration (Funnel / Scatter / TCM-Tabelle) aus ES_SHARE + EAD.
    try {
      const tcmRows = _buildAsrfTcmRows(issuerRows, _ratingByIssuer(port));
      _renderAsrfFunnel(root, issuerRows);
      _renderAsrfTcmTable(root, tcmRows);
      _renderAsrfTcmScatter(root, pdFlag, tcmRows);
    } catch (e) { console.warn('[ASRF] tail concentration failed', e); }
    try { _renderCondPd(root, issuerRows, confLabel); } catch (e) { console.warn('[ASRF] cond PD chart failed', e); }
    try { _renderPareto(root, issuerRows); } catch (e) { console.warn('[ASRF] pareto chart failed', e); }
    try { _renderElVar(root, issuerRows); } catch (e) { console.warn('[ASRF] EL/VaR chart failed', e); }
  }
}

// Alle ASRF-Panels rendern.
export function renderAsrfPanels() {
  document.querySelectorAll('.asrf-panel-root').forEach(root => {
    try { renderAsrfInstance(root); } catch (e) { console.warn('[ASRF] instance render failed', e); }
  });
}

// ============================================================
// MSD-Seite (panel-credit-msd): ASRF (analytisch, LINKS) vs MF-GC (simuliert, RECHTS).
// Diese Funktion rendert NUR den linken ASRF-Chart + die beiden KPI-Bloecke. Der rechte
// MF-GC-Chart (crTailZoomChartMsd) bleibt Sache von renderCreditMsdPanel -> unberuehrt.
// ============================================================

// Overlay: ES-Linien (gestrichelt) + MSD-Band + VaR-Marker bei 99,9 %.
const _asrfTailOverlay = {
  id: 'asrfTailOverlay',
  afterDatasetsDraw(chart) {
    const y = chart.scales?.y, x = chart.scales?.x, area = chart.chartArea, ctx = chart.ctx;
    if (!y || !x || !area) return;
    const eh = chart.$esHist, en = chart.$esNorm;

    // MSD-Band zwischen Historic-ES und Market-adjusted-ES + Wert mittig ins Band.
    if (Number.isFinite(eh) && Number.isFinite(en)) {
      const p1 = y.getPixelForValue(eh), p2 = y.getPixelForValue(en);
      ctx.save();
      ctx.fillStyle = 'rgba(240,185,75,0.18)';
      ctx.fillRect(area.left, Math.min(p1, p2), area.right - area.left, Math.abs(p2 - p1));
      if (chart.$msdLabel) {
        ctx.fillStyle = 'rgba(240,185,75,1)'; ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(chart.$msdLabel, (area.left + area.right) / 2, (p1 + p2) / 2);
      }
      ctx.restore();
    }
    const hline = (val, color, label) => {
      if (!Number.isFinite(val)) return;
      const py = y.getPixelForValue(val);
      ctx.save();
      ctx.strokeStyle = color; ctx.setLineDash([6, 4]); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(area.left, py); ctx.lineTo(area.right, py); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = color; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(label, area.left + 6, py - 9);
      ctx.restore();
    };
    hline(eh, 'rgba(210,60,55,0.95)', 'ES historic');
    hline(en, 'rgba(240,120,120,0.98)', 'ES market-adj.');

    // VaR-Marker bei 99,9 % (Index der 99.90-Kategorie).
    const vi = chart.$varIdx;
    if (Number.isInteger(vi) && vi >= 0) {
      const px = x.getPixelForValue(vi);
      const dot = (val, color) => {
        if (!Number.isFinite(val)) return;
        const py = y.getPixelForValue(val);
        ctx.save();
        ctx.fillStyle = color; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
        ctx.restore();
      };
      dot(chart.$varHist, 'rgba(70,130,220,1)');
      dot(chart.$varNorm, 'rgba(120,185,240,1)');
      ctx.save();
      ctx.strokeStyle = 'rgba(160,160,160,0.5)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, area.top); ctx.lineTo(px, area.bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,200,200,0.9)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('VaR 99,9%', px, area.top + 11);
      ctx.restore();
    }
  },
};

export function renderAsrfMsdCompare() {
  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const signedPct = (mag) => Number.isFinite(mag) ? `−${mag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '–';
  const posPct = (v, d = 1) => Number.isFinite(v) ? `${v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} %` : '–';
  const msdOf = (hist, norm) => (Number.isFinite(hist) && Number.isFinite(norm) && hist > 0) ? (norm - hist) / hist * 100 : NaN;

  // --- ASRF ES (Magnituden in %) aus ASRF_Summary ---
  const sums = (appState.getAsrfSummary?.() || []).filter(r => String(r.port_name ?? '').trim() === port);
  const esMag = (flag) => {
    const r = sums.find(x => String(x.pd_flag ?? '').trim().toUpperCase() === flag);
    return r ? Math.abs(_num(r.ES_rel)) * 100 : NaN;
  };
  const asrfEsHist = esMag('RATING'), asrfEsNorm = esMag('NORM');
  const asrfMsd = msdOf(asrfEsHist, asrfEsNorm);
  set('asrfMsdEsHist', signedPct(asrfEsHist));
  set('asrfMsdEsNorm', signedPct(asrfEsNorm));
  set('asrfMsdVal', posPct(asrfMsd, 2));

  // --- MF-GC ES (Magnituden in %) aus CreditVaR ---
  const cvar = (appState.getAllCvarData?.() || []).filter(r => String(r.port_name ?? '').trim() === port);
  const mfEsMag = (flag) => {
    const r = cvar.find(x => String(x.pd_flag ?? '').trim().toUpperCase() === flag);
    return r ? Math.abs(_num(r.ES_rel)) * 100 : NaN;
  };
  const mfEsHist = mfEsMag('RATING'), mfEsNorm = mfEsMag('NORM');
  set('mfgcMsdEsHist', signedPct(mfEsHist));
  set('mfgcMsdEsNorm', signedPct(mfEsNorm));
  set('mfgcMsdVal', posPct(msdOf(mfEsHist, mfEsNorm), 2));

  // --- Linker Chart: analytische ASRF-Tail-Kurve ---
  const canvas = document.getElementById('asrfTailChart');
  if (!canvas || !window.Chart) return;
  try { if (canvas.__asrfChart) { canvas.__asrfChart.destroy(); canvas.__asrfChart = null; } } catch (_) {}
  if (!(canvas.clientWidth > 0 && canvas.clientHeight > 0)) return;

  const tail = (appState.getAsrfTailCurve?.() || []).filter(r => String(r.port_name ?? '').trim() === port);
  const series = (flag) => tail.filter(r => String(r.pd_flag ?? '').trim().toUpperCase() === flag)
    .sort((a, b) => (_num(a.quantile) || 0) - (_num(b.quantile) || 0));
  const histSer = series('RATING'), normSer = series('NORM');
  const base = histSer.length ? histSer : normSer;
  if (!base.length) { return; }

  const labels = base.map(r => (_num(r.quantile)).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
  const toPct = (arr) => arr.map(r => (_num(r.loss_rel) || 0) * 100);
  const varIdx = base.findIndex(r => Math.abs((_num(r.quantile) || 0) - 99.90) < 1e-6);
  const valAt = (ser, idx) => (idx >= 0 && ser[idx]) ? (_num(ser[idx].loss_rel) || 0) * 100 : NaN;

  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        // Vor VaR (99,9 %) blau/hellblau, im Tail AB VaR rot/hellrot (wie der MF-GC-Tail) -
        // Linien-Segmente UND Punkte.
        { label: 'Historic PD', data: toPct(histSer), borderColor: 'rgba(70,130,220,1)', backgroundColor: 'rgba(70,130,220,0.08)', borderWidth: 2, pointRadius: 2, tension: 0.25, fill: false,
          segment: { borderColor: (c) => (varIdx >= 0 && c.p0DataIndex >= varIdx) ? 'rgba(210,60,55,1)' : 'rgba(70,130,220,1)' },
          pointBackgroundColor: (c) => (varIdx >= 0 && c.dataIndex >= varIdx) ? 'rgba(210,60,55,1)' : 'rgba(70,130,220,1)',
          pointBorderColor: (c) => (varIdx >= 0 && c.dataIndex >= varIdx) ? 'rgba(210,60,55,1)' : 'rgba(70,130,220,1)' },
        { label: 'Market-adjusted PD', data: toPct(normSer), borderColor: 'rgba(120,185,240,1)', backgroundColor: 'rgba(120,185,240,0.08)', borderWidth: 2, pointRadius: 2, tension: 0.25, fill: false,
          segment: { borderColor: (c) => (varIdx >= 0 && c.p0DataIndex >= varIdx) ? 'rgba(240,120,120,1)' : 'rgba(120,185,240,1)' },
          pointBackgroundColor: (c) => (varIdx >= 0 && c.dataIndex >= varIdx) ? 'rgba(240,120,120,1)' : 'rgba(120,185,240,1)',
          pointBorderColor: (c) => (varIdx >= 0 && c.dataIndex >= varIdx) ? 'rgba(240,120,120,1)' : 'rgba(120,185,240,1)' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 24, usePointStyle: true, pointStyle: 'line', font: { size: 11 } } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` } },
      },
      scales: {
        x: { title: { display: true, text: 'Confidence level (quantile)' }, grid: { display: false } },
        y: { title: { display: true, text: 'Loss (% of NAV)' }, ticks: { callback: v => v + ' %' }, grid: { color: _grid() }, beginAtZero: true },
      },
    },
    plugins: [_asrfTailOverlay],
  });
  chart.$esHist = asrfEsHist;
  chart.$esNorm = asrfEsNorm;
  chart.$msdLabel = Number.isFinite(asrfMsd) ? `MSD ${posPct(asrfMsd, 2)}` : '';
  chart.$varIdx = varIdx;
  chart.$varHist = valAt(histSer, varIdx);
  chart.$varNorm = valAt(normSer, varIdx);
  chart.update();
  canvas.__asrfChart = chart;
}

// ============================================================
// TSI-Seite (panel-credit-tsi): ASRF (analytisch, LINKS) vs MF-GC (simuliert, RECHTS).
// TSI = Tail-Severity der HISTORIC-Sicht: wie weit reicht ES ueber VaR hinaus.
// Rendert NUR den linken ASRF-Chart + die beiden KPI-Bloecke; der rechte MF-GC-Chart
// (crTailZoomChartTsi via renderCreditTsiPanel) bleibt unberuehrt.
// ============================================================

// Overlay: VaR-Linie + ES-Linie (violett) + TSI-Band dazwischen + VaR-Marker bei 99,9 %.
const _asrfTsiOverlay = {
  id: 'asrfTsiOverlay',
  afterDatasetsDraw(chart) {
    const y = chart.scales?.y, x = chart.scales?.x, area = chart.chartArea, ctx = chart.ctx;
    if (!y || !x || !area) return;
    const vv = chart.$var, ee = chart.$es;

    if (Number.isFinite(vv) && Number.isFinite(ee)) {
      const p1 = y.getPixelForValue(vv), p2 = y.getPixelForValue(ee);
      ctx.save();
      ctx.fillStyle = 'rgba(150,110,220,0.20)'; // TSI violett (wie MF-GC-Band)
      ctx.fillRect(area.left, Math.min(p1, p2), area.right - area.left, Math.abs(p2 - p1));
      if (chart.$tsiLabel) {
        ctx.fillStyle = 'rgba(190,160,240,1)'; ctx.font = 'bold 12px sans-serif';
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(chart.$tsiLabel, (area.left + area.right) / 2, (p1 + p2) / 2);
      }
      ctx.restore();
    }
    const hline = (val, color, label, dash) => {
      if (!Number.isFinite(val)) return;
      const py = y.getPixelForValue(val);
      ctx.save();
      ctx.strokeStyle = color; ctx.setLineDash(dash || []); ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(area.left, py); ctx.lineTo(area.right, py); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = color; ctx.font = '11px sans-serif'; ctx.textAlign = 'left';
      ctx.fillText(label, area.left + 6, py - 9);
      ctx.restore();
    };
    hline(vv, 'rgba(210,60,55,0.98)', 'VaR historic', []);      // VaR: rot, durchgezogen
    hline(ee, 'rgba(210,60,55,0.98)', 'ES historic', [6, 4]);   // ES: rot, gestrichelt

    const vi = chart.$varIdx;
    if (Number.isInteger(vi) && vi >= 0) {
      const px = x.getPixelForValue(vi);
      ctx.save();
      ctx.strokeStyle = 'rgba(160,160,160,0.5)'; ctx.setLineDash([3, 3]); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(px, area.top); ctx.lineTo(px, area.bottom); ctx.stroke();
      ctx.setLineDash([]);
      ctx.fillStyle = 'rgba(200,200,200,0.9)'; ctx.font = '10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText('99,9%', px, area.top + 11);
      if (Number.isFinite(chart.$varPoint)) {
        const py = y.getPixelForValue(chart.$varPoint);
        ctx.fillStyle = 'rgba(210,60,55,1)'; ctx.strokeStyle = '#fff'; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.arc(px, py, 4, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      }
      ctx.restore();
    }
  },
};

export function renderAsrfTsiCompare() {
  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();
  const set = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
  const signedPct = (mag) => Number.isFinite(mag) ? `−${mag.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '–';
  const posPct = (v, d = 1) => Number.isFinite(v) ? `${v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d })} %` : '–';
  const tsiOf = (v, e) => (Number.isFinite(v) && Number.isFinite(e) && v > 0) ? (e - v) / v * 100 : NaN;

  // ASRF VaR/ES historic (Magnituden %) aus ASRF_Summary (pd_flag RATING).
  const sRating = (appState.getAsrfSummary?.() || []).find(r => String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === 'RATING');
  const asrfVar = sRating ? Math.abs(_num(sRating.VaR_rel)) * 100 : NaN;
  const asrfEs = sRating ? Math.abs(_num(sRating.ES_rel)) * 100 : NaN;
  const asrfTsi = tsiOf(asrfVar, asrfEs);
  set('asrfTsiVar', signedPct(asrfVar));
  set('asrfTsiEs', signedPct(asrfEs));
  set('asrfTsiVal', posPct(asrfTsi, 2));

  // MF-GC VaR/ES historic (Magnituden %) aus CreditVaR (pd_flag RATING).
  const cvR = (appState.getAllCvarData?.() || []).find(r => String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === 'RATING');
  const mfVar = cvR ? Math.abs(_num(cvR.VaR_rel)) * 100 : NaN;
  const mfEs = cvR ? Math.abs(_num(cvR.ES_rel)) * 100 : NaN;
  set('mfgcTsiVar', signedPct(mfVar));
  set('mfgcTsiEs', signedPct(mfEs));
  set('mfgcTsiVal', posPct(tsiOf(mfVar, mfEs), 2));

  // Linker Chart: analytische ASRF-Tail-Kurve (historic PD) + VaR/ES-Linien + TSI-Band.
  const canvas = document.getElementById('asrfTsiChart');
  if (!canvas || !window.Chart) return;
  try { if (canvas.__asrfChart) { canvas.__asrfChart.destroy(); canvas.__asrfChart = null; } } catch (_) {}
  if (!(canvas.clientWidth > 0 && canvas.clientHeight > 0)) return;

  const hist = (appState.getAsrfTailCurve?.() || [])
    .filter(r => String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === 'RATING')
    .sort((a, b) => (_num(a.quantile) || 0) - (_num(b.quantile) || 0));
  if (!hist.length) return;

  const labels = hist.map(r => (_num(r.quantile)).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 2 }));
  const varIdx = hist.findIndex(r => Math.abs((_num(r.quantile) || 0) - 99.90) < 1e-6);

  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'line',
    data: {
      labels,
      datasets: [
        // Wie im MSD-ASRF-Chart: blau bis VaR, Tail ab VaR rot (Segmente + Punkte).
        { label: 'Historic PD', data: hist.map(r => (_num(r.loss_rel) || 0) * 100), borderColor: 'rgba(70,130,220,1)', backgroundColor: 'rgba(70,130,220,0.08)', borderWidth: 2, pointRadius: 2, tension: 0.25, fill: false,
          segment: { borderColor: (c) => (varIdx >= 0 && c.p0DataIndex >= varIdx) ? 'rgba(210,60,55,1)' : 'rgba(70,130,220,1)' },
          pointBackgroundColor: (c) => (varIdx >= 0 && c.dataIndex >= varIdx) ? 'rgba(210,60,55,1)' : 'rgba(70,130,220,1)',
          pointBorderColor: (c) => (varIdx >= 0 && c.dataIndex >= varIdx) ? 'rgba(210,60,55,1)' : 'rgba(70,130,220,1)' },
      ],
    },
    options: {
      responsive: true, maintainAspectRatio: false,
      plugins: {
        legend: { display: true, position: 'top', labels: { boxWidth: 24, usePointStyle: true, pointStyle: 'line', font: { size: 11 } } },
        tooltip: { callbacks: { label: c => `${c.dataset.label}: ${c.parsed.y.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` } },
      },
      scales: {
        x: { title: { display: true, text: 'Confidence level (quantile)' }, grid: { display: false } },
        y: { title: { display: true, text: 'Loss (% of NAV)' }, ticks: { callback: v => v + ' %' }, grid: { color: _grid() }, beginAtZero: true },
      },
    },
    plugins: [_asrfTsiOverlay],
  });
  chart.$var = asrfVar;
  chart.$es = asrfEs;
  chart.$tsiLabel = Number.isFinite(asrfTsi) ? `TSI ${posPct(asrfTsi, 2)}` : '';
  chart.$varIdx = varIdx;
  chart.$varPoint = (varIdx >= 0 && hist[varIdx]) ? (_num(hist[varIdx].loss_rel) || 0) * 100 : NaN;
  chart.update();
  canvas.__asrfChart = chart;
}

// ============================================================
// Loss-Distribution-Seite (panel-cvar): 2-up Verlustverteilung —
// ASRF analytisch (links) vs MF-GC simuliert (rechts), beide mit Tail-Highlight
// (Bins >= VaR rot) + VaR/ES-Linien. historic PD (pd_flag RATING).
// ASRF-Daten: ASRF_LossHistogram; MF-GC-Daten: lossHistogramMain (bestehend).
// ============================================================

let _lossHistFetchRequested = false;

// Overlay: VaR (orange) + ES (rot) als vertikale gestrichelte Linien an der naechsten Bin-Kategorie.
const _lossHistVeOverlay = {
  id: 'asrfLossHistVe',
  afterDatasetsDraw(chart) {
    const x = chart.scales?.x, area = chart.chartArea, ctx = chart.ctx;
    if (!x || !area) return;
    const centers = chart.$binCenters || [];
    if (!centers.length) return;
    const idxOf = (val) => { if (!Number.isFinite(val)) return -1; let bi = 0, bd = Infinity; centers.forEach((c, i) => { const d = Math.abs(c - val); if (d < bd) { bd = d; bi = i; } }); return bi; };
    const px = (i) => (i >= 0 ? x.getPixelForValue(i) : NaN);
    const elX = px(idxOf(chart.$elRel)), vX = px(idxOf(chart.$varRel)), eX = px(idxOf(chart.$esRel));

    // Economic-Capital-Band (EL -> VaR) violett + Label.
    if (Number.isFinite(elX) && Number.isFinite(vX) && Math.abs(vX - elX) > 2) {
      ctx.save();
      ctx.fillStyle = 'rgba(150,110,220,0.20)';
      ctx.fillRect(Math.min(elX, vX), area.top, Math.abs(vX - elX), area.bottom - area.top);
      ctx.fillStyle = 'rgba(180,145,238,0.98)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      const mx = (elX + vX) / 2;
      ctx.fillText('Economic', mx, area.top + 16); ctx.fillText('Capital', mx, area.top + 29);
      ctx.restore();
    }
    // Tail-Risk-Band (rechts von VaR) rot + Label.
    if (Number.isFinite(vX) && vX < area.right - 4) {
      ctx.save();
      ctx.fillStyle = 'rgba(220,70,70,0.08)';
      ctx.fillRect(vX, area.top, area.right - vX, area.bottom - area.top);
      ctx.fillStyle = 'rgba(224,120,120,0.95)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center';
      const mx = (vX + area.right) / 2;
      ctx.fillText('Tail', mx, area.top + 16); ctx.fillText('Risk', mx, area.top + 29);
      ctx.restore();
    }
    // Vertikale Linien EL / VaR / ES mit Wert-Label ueber der Plotflaeche.
    const pct = (f) => `${(f * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`;
    const line = (xp, val, color, prefix, dash) => {
      if (!Number.isFinite(xp) || !Number.isFinite(val)) return;
      ctx.save();
      ctx.strokeStyle = color; ctx.setLineDash(dash || []); ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(xp, area.top); ctx.lineTo(xp, area.bottom); ctx.stroke();
      ctx.setLineDash([]); ctx.fillStyle = color; ctx.font = 'bold 10px sans-serif'; ctx.textAlign = 'center';
      ctx.fillText(`${prefix} ${pct(val)}`, xp, area.top - 4);
      ctx.restore();
    };
    line(elX, chart.$elRel, '#5a6470', 'EL', []);
    line(vX, chart.$varRel, '#f08c00', 'VaR', []);
    line(eX, chart.$esRel, '#e03131', 'ES', [6, 4]);
  },
};

function _drawLossHist(canvas, rows, varRel, esRel, elRel) {
  if (!canvas || !window.Chart) return;
  try { if (canvas.__asrfChart) { canvas.__asrfChart.destroy(); canvas.__asrfChart = null; } } catch (_) {}
  if (!(canvas.clientWidth > 0 && canvas.clientHeight > 0)) return;
  const sorted = [...(rows || [])].sort((a, b) => (_num(a.bin_center) || 0) - (_num(b.bin_center) || 0));
  if (!sorted.length) return;
  const centers = sorted.map(r => _num(r.bin_center) || 0);
  const labels = centers.map(c => (c * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 }) + ' %');
  const rawCounts = sorted.map(r => _num(r.count) || 0);
  const totalCount = rawCounts.reduce((a, b) => a + b, 0) || 1;
  const counts = rawCounts.map(c => c / totalCount); // -> Wahrscheinlichkeitsmasse je Bin
  const vAbs = Math.abs(_num(varRel));
  const colors = centers.map(c => (Number.isFinite(vAbs) && c >= vAbs) ? 'rgba(210,70,70,0.85)' : 'rgba(70,120,180,0.85)');
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [{ label: 'Probability mass', data: counts, backgroundColor: colors, borderColor: colors, borderWidth: 0, categoryPercentage: 1.0, barPercentage: 1.0 }] },
    options: {
      responsive: true, maintainAspectRatio: false,
      layout: { padding: { top: 18 } }, // Platz fuer EL/VaR/ES-Labels ueber der Plotflaeche
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { title: (c) => `Loss ${labels[c[0].dataIndex]}`, label: (c) => `P = ${(c.parsed.y * 100).toLocaleString('de-DE', { maximumFractionDigits: 3 })} %` } },
      },
      scales: {
        x: { title: { display: true, text: 'Loss (% of NAV)' }, grid: { display: false }, ticks: { maxTicksLimit: 8, autoSkip: true } },
        y: { type: 'logarithmic', title: { display: true, text: 'Probability mass (log)' }, grid: { color: _grid() }, ticks: { callback: _fmtLogPM } },
      },
    },
    plugins: [_lossHistVeOverlay],
  });
  chart.$binCenters = centers;
  chart.$varRel = Math.abs(_num(varRel));
  chart.$esRel = Math.abs(_num(esRel));
  chart.$elRel = Math.abs(_num(elRel));
  chart.update();
  canvas.__asrfChart = chart;
}

export function renderAsrfLossDistCompare() {
  const port = String(appState.getSelectedPortTableName?.() ?? '').trim();

  // ASRF (analytisch)
  const asrfRows = (appState.getAsrfLossHistogram?.() || []).filter(r =>
    String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === 'RATING');
  const sR = (appState.getAsrfSummary?.() || []).find(r =>
    String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === 'RATING');
  _drawLossHist(document.getElementById('asrfLossHistChart'), asrfRows, sR ? _num(sR.VaR_rel) : NaN, sR ? _num(sR.ES_rel) : NaN, sR ? _num(sR.EL_rel) : NaN);

  // MF-GC (simuliert) — lossHistogramMain bei Bedarf einmal anfordern.
  const mfRows = (appState.getLossHistogram?.() || []).filter(r =>
    String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === 'RATING');
  if (!mfRows.length && !_lossHistFetchRequested) {
    _lossHistFetchRequested = true;
    try { window.api?.send?.('fetch-table-data', 'lossHistogramMain'); } catch (_) {}
  }
  const cvR = (appState.getAllCvarData?.() || []).find(r =>
    String(r.port_name ?? '').trim() === port && String(r.pd_flag ?? '').trim().toUpperCase() === 'RATING');
  _drawLossHist(document.getElementById('mfgcLossHistChart'), mfRows, cvR ? _num(cvR.VaR_rel) : NaN, cvR ? _num(cvR.ES_rel) : NaN);
}

// Neu rendern bei: ASRF-Daten-Eingang, Portfolio-Wechsel, Oeffnen eines ASRF-/MSD-/TSI-/Loss-Panels.
document.addEventListener('asrf:ready', () => { try { renderAsrfPanels(); renderAsrfMsdCompare(); renderAsrfTsiCompare(); renderAsrfLossDistCompare(); } catch (_) {} });
document.addEventListener('portfolio-context-changed', () => { try { renderAsrfPanels(); renderAsrfMsdCompare(); renderAsrfTsiCompare(); renderAsrfLossDistCompare(); } catch (_) {} });
document.addEventListener('losshist:ready', () => { try { renderAsrfLossDistCompare(); } catch (_) {} });
document.addEventListener('panel:opened', (e) => {
  const id = e?.detail?.panelId;
  if (id === 'panel-asrf' || id === 'panel-asrf-norm') {
    requestAnimationFrame(() => { try { renderAsrfInstance(document.getElementById(id)); } catch (_) {} });
  } else if (id === 'panel-credit-msd') {
    requestAnimationFrame(() => { try { renderAsrfMsdCompare(); } catch (_) {} });
  } else if (id === 'panel-credit-tsi') {
    requestAnimationFrame(() => { try { renderAsrfTsiCompare(); } catch (_) {} });
  } else if (id === 'panel-cvar') {
    requestAnimationFrame(() => { try { renderAsrfLossDistCompare(); } catch (_) {} });
  }
});

// Namensexport fuer Rueckwaertskompatibilitaet (alte Import-Aufrufe).
export const renderAsrfPanel = renderAsrfPanels;
