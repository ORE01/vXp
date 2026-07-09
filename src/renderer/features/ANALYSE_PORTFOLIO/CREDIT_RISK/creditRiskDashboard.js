'use strict';

// Credit-Risk-Dashboard analog zum Market-Risk-Dashboard: KPI-Karten (CVaR + ES CVaR)
// mit relativem Wert + Ampel + Deltas + absolutem Wert, plus Limit-Auslastungsleiste.
// Nutzt dieselben CSS-Klassen (mr-kpi-card / mr-limit / mr-amp) -> gleiches Aussehen.
// TSI / MSD folgen spaeter.

import { appState } from '../../../renderer.js';
import { sumNavForPort } from './LossIssuer.js';

let _listenersBound = false;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

// VaR-/ES-Referenzlinien (Annotation-Plugin global aus). Konfig via options.plugins.crLines:
//   { v: [{at, color, width, dash}], h: [...] }  (v = vertikal, h = horizontal).
const _crLinePlugin = {
  id: 'crLines',
  afterDatasetsDraw(chart, args, opts) {
    if (!opts) return;
    const ctx = chart.ctx, area = chart.chartArea;
    const stroke = (px, vertical, o) => {
      ctx.save();
      ctx.strokeStyle = o.color || 'rgba(43,108,176,0.95)';
      ctx.lineWidth = o.width || 2;
      if (o.dash) ctx.setLineDash(o.dash);
      ctx.beginPath();
      if (vertical) { ctx.moveTo(px, area.top); ctx.lineTo(px, area.bottom); }
      else { ctx.moveTo(area.left, px); ctx.lineTo(area.right, px); }
      ctx.stroke();
      ctx.restore();
    };
    (opts.v || []).forEach(o => { const x = chart.scales.x.getPixelForValue(o.at); if (Number.isFinite(x)) stroke(x, true, o); });
    (opts.h || []).forEach(o => { const y = chart.scales.y.getPixelForValue(o.at); if (Number.isFinite(y)) stroke(y, false, o); });
  },
};
const LINE_BLUE = 'rgba(43,108,176,0.95)';
const BAR_BLUE = 'rgba(70,120,180,0.85)';
const BAR_RED = 'rgba(210,70,70,0.85)';
function _crChartColor() {
  return (getComputedStyle(document.body).getPropertyValue('--text-primary') || '').trim() || '#333';
}
function _destroyCrChart(id) {
  const c = window[id];
  if (c && typeof c.destroy === 'function') { try { c.destroy(); } catch {} }
  window[id] = null;
}

// LINKS: Loss-Histogramm (lossHistogramMain, RATING) mit Tail-Highlight + VaR/ES-Linien.
// y = Frequency (log, da die Verteilung stark bei ~0 konzentriert ist). Tail-Bins
// (Verlust >= VaR) rot. Vertikale VaR (solid) + ES (dashed) Linien.
function renderCreditLossDist() {
  const canvas = document.getElementById('crLossDistChart');
  if (!canvas || !window.Chart) return;
  _destroyCrChart('crLossDistChart');
  const port = appState.getSelectedPortTableName?.();
  const rows = (appState.getLossHistogram?.() || [])
    .filter(r => String(r.port_name) === String(port) && String(r.pd_flag).toUpperCase() === 'RATING')
    .slice().sort((a, b) => Number(a.bin_center) - Number(b.bin_center));
  if (!rows.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  const rr = creditRowsByFlag().rating || {};
  const varPct = Math.abs(num(rr.VaR_rel)) * 100;
  const esPct = Math.abs(num(rr.ES_rel)) * 100;

  const labels = rows.map(r => (Number(r.bin_center) * 100).toFixed(1));
  const counts = rows.map(r => { const c = Number(r.count); return c > 0 ? c : null; });
  const colors = rows.map(r => (Number(r.bin_center) * 100 >= varPct ? BAR_RED : BAR_BLUE));
  const nearestIdx = (pct) => { let idx = 0, best = Infinity; rows.forEach((r, i) => { const d = Math.abs(Number(r.bin_center) * 100 - pct); if (d < best) { best = d; idx = i; } }); return idx; };
  const v = [];
  if (Number.isFinite(varPct)) v.push({ at: nearestIdx(varPct), color: LINE_BLUE, width: 2 });
  if (Number.isFinite(esPct)) v.push({ at: nearestIdx(esPct), color: LINE_BLUE, width: 2, dash: [6, 4] });

  const col = _crChartColor();
  canvas.width = Math.max(320, Math.floor((canvas.parentElement?.clientWidth || 540) - 28)); canvas.height = 300;
  window.crLossDistChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: [_crLinePlugin],
    data: { labels, datasets: [{ label: 'Frequency', data: counts, backgroundColor: colors, borderColor: colors, maxBarThickness: 22 }] },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: col,
      plugins: {
        legend: { display: false },
        subtitle: { display: true, text: 'Tail red · VaR (solid) · ES (dashed)', color: col, align: 'start', font: { size: 10 } },
        crLines: { v },
        tooltip: { callbacks: { title: (c) => `Loss ${labels[c[0].dataIndex]}%`, label: (c) => `Frequency: ${c.parsed.y}` } },
      },
      scales: {
        x: { title: { display: true, text: 'Loss (% of NAV)', color: col }, ticks: { color: col, maxTicksLimit: 14, autoSkip: true }, grid: { display: false } },
        y: { type: 'logarithmic', title: { display: true, text: 'Frequency (log)', color: col }, ticks: { color: col } },
      },
    },
  });
}

// RECHTS: Tail-Zoom — Verlust (% vom NAV) je Quantil im Extrem-Tail (sortedLossesIssuer,
// RATING). Balken >= VaR rot; horizontale VaR (solid) + ES (dashed) Linien.
function renderCreditTailZoom() {
  const canvas = document.getElementById('crTailZoomChart');
  if (!canvas || !window.Chart) return;
  _destroyCrChart('crTailZoomChart');
  const port = appState.getSelectedPortTableName?.();
  const rows = (appState.getAllLossData?.() || [])
    .filter(r => String(r.port_name) === String(port) && String(r.pd_flag).toUpperCase() === 'RATING' && Number.isFinite(Number(r.QUANTIL)));
  if (!rows.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';

  const sumNav = sumNavForPort(port);
  const rr = creditRowsByFlag().rating || {};
  const varPct = Math.abs(num(rr.VaR_rel)) * 100;
  const esPct = Math.abs(num(rr.ES_rel)) * 100;

  const sorted = rows.slice().sort((a, b) => Number(a.QUANTIL) - Number(b.QUANTIL));
  const targets = [99.0, 99.2, 99.4, 99.5, 99.6, 99.7, 99.8, 99.9, 99.95, 99.99];
  const nearest = (q) => sorted.reduce((best, r) => (Math.abs(Number(r.QUANTIL) - q) < Math.abs(Number(best.QUANTIL) - q) ? r : best), sorted[0]);
  const picks = targets.map(q => ({ q, row: nearest(q) }));
  const labels = picks.map(p => p.q.toFixed(p.q >= 99.9 ? 2 : 1));
  const lossPct = picks.map(p => (sumNav > 0 ? Number(p.row.LOSS) / sumNav * 100 : 0));
  const colors = lossPct.map(v => (v >= varPct ? BAR_RED : BAR_BLUE));
  const h = [];
  if (Number.isFinite(varPct)) h.push({ at: varPct, color: LINE_BLUE, width: 2 });
  if (Number.isFinite(esPct)) h.push({ at: esPct, color: LINE_BLUE, width: 2, dash: [6, 4] });

  const col = _crChartColor();
  canvas.width = Math.max(320, Math.floor((canvas.parentElement?.clientWidth || 540) - 28)); canvas.height = 300;
  window.crTailZoomChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: [_crLinePlugin],
    data: { labels, datasets: [{ label: 'Loss', data: lossPct, backgroundColor: colors, borderColor: colors, maxBarThickness: 30 }] },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: col,
      plugins: {
        legend: { display: false },
        subtitle: { display: true, text: 'Loss > VaR red · VaR (solid) · ES (dashed)', color: col, align: 'start', font: { size: 10 } },
        crLines: { h },
        tooltip: { callbacks: { title: (c) => `Quantile ${labels[c[0].dataIndex]}`, label: (c) => `Loss: ${Number(c.parsed.y).toFixed(2)}% of NAV` } },
      },
      scales: {
        x: { title: { display: true, text: 'Quantile', color: col }, ticks: { color: col }, grid: { display: false } },
        y: { beginAtZero: true, title: { display: true, text: 'Loss (% of NAV)', color: col }, ticks: { color: col } },
      },
    },
  });
}

// Headline-CVaR-Zeile: Historic VaR (pd_flag=rating; Fallback erste Zeile).
function currentCvarRow() {
  const rows = appState.getCvarData?.() || [];
  if (!Array.isArray(rows) || !rows.length) return null;
  return rows.find(r => String(r.pd_flag ?? '').toLowerCase() === 'rating') || rows[0];
}

// Credit-Warn-/Limit-Schwellen je Metrik (Fraktion); Fallback = App-Defaults.
// dir: 'neg' -> kleiner = schlechter (CVAR); 'pos' -> groesser = schlechter (TSI/MSD).
const CR_DEFAULTS = {
  CVAR: { yellow: -0.050, red: -0.052, dir: 'neg' },
  TSI:  { yellow: 0.010, red: 0.014, dir: 'pos' },
  MSD:  { yellow: 0.010, red: 0.030, dir: 'pos' },
};
function crThreshold(code) {
  const r = appState.getCustomerCreditRiskThreshold?.(code);
  const d = CR_DEFAULTS[code] || CR_DEFAULTS.CVAR;
  const y = r ? Number(r.yellow_loss_limit) : NaN;
  const rd = r ? Number(r.red_loss_limit) : NaN;
  return { yellow: Number.isFinite(y) ? y : d.yellow, red: Number.isFinite(rd) ? rd : d.red, dir: d.dir };
}
// Ampel: Wert (Fraktion) vs. Schwellen (Fraktion), Richtung aus der Schwelle.
function trafficState(valFraction, th) {
  const v = Number(valFraction);
  if (!Number.isFinite(v)) return null;
  if (th.dir === 'pos') {
    if (v > th.red) return 'red';
    if (v > th.yellow) return 'yellow';
    return 'green';
  }
  if (v < th.red) return 'red';
  if (v < th.yellow) return 'yellow';
  return 'green';
}

// pd_flag -> erste Zeile (rating / market / norm).
function creditRowsByFlag() {
  const rows = appState.getCvarData?.() || [];
  const byFlag = {};
  for (const r of rows) { const f = String(r?.pd_flag ?? '').toLowerCase(); if (f && !byFlag[f]) byFlag[f] = r; }
  return byFlag;
}

function fmtEur(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  const mn = Math.abs(n) / 1e6;
  const dec = mn >= 100 ? 0 : mn >= 10 ? 1 : 2;
  return `EUR ${Number(mn.toFixed(dec)).toLocaleString('en-US')} mn`;
}
function fmtEurSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : '-'}${fmtEur(Math.abs(n))}`;
}
function fmtPpSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : '-'}${Number(Math.abs(n).toFixed(3))}%`;
}
// Credit-rel ist eine Fraktion (-0.05) -> Prozent fuer die Anzeige.
function fmtRelPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  return `${Number((n * 100).toFixed(3))}%`;
}
function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function selectedPortCandidates() {
  const set = new Set();
  const add = (v) => { const s = String(v ?? '').trim().toUpperCase(); if (s) set.add(s); };
  add(appState.getSelectedPortTableName?.());
  const dd = document.getElementById('createdPortDropdown0');
  add(dd?.value);
  if (dd && dd.selectedIndex >= 0) add(dd.options?.[dd.selectedIndex]?.textContent);
  return [...set];
}
function lastHistoryRow() {
  const rows = appState.getPortfolioHistoryData?.() || [];
  if (!Array.isArray(rows) || !rows.length) return null;
  const cands = selectedPortCandidates();
  const match = (pn) => {
    const p = String(pn ?? '').trim().toUpperCase();
    if (!p) return false;
    return cands.some((c) => c === p || c.includes(p) || p.includes(c));
  };
  const filtered = cands.length ? rows.filter((r) => match(r.port_name)) : [];
  const use = filtered.length ? filtered : rows.slice();
  return use.slice().sort((a, b) => new Date(a.DATE) - new Date(b.DATE)).at(-1) || null;
}

// Datenmodell (Karten + Limit) — Basis fuer HTML-Render und PDF-Composed-Renderer.
export function getCreditDashboardModel() {
  const byFlag = creditRowsByFlag();
  const row = byFlag.rating || byFlag[Object.keys(byFlag)[0]] || null;   // Historic VaR
  const normRow = byFlag.norm || null;

  const cvarTh = crThreshold('CVAR');
  const varState = row ? trafficState(num(row.VaR_rel), cvarTh) : null;
  const esState = row ? trafficState(num(row.ES_rel), cvarTh) : null;

  const hist = lastHistoryRow();
  const magDelta = (cur, last) => (Number.isFinite(cur) && Number.isFinite(last)) ? Math.abs(cur) - Math.abs(last) : null;
  const lastVarAbs = num(hist?.C_VaR);
  const lastEsAbs = num(hist?.C_ES);
  const lastVarRelPct = num(hist?.C_VaR_PCT) * 100;
  const lastEsRelPct = num(hist?.C_ES_PCT) * 100;
  const curVarRelPct = num(row?.VaR_rel) * 100;
  const curEsRelPct = num(row?.ES_rel) * 100;

  // TSI = Historic ES - Historic VaR (rating). MSD = Adjusted ES (norm) - Historic ES (rating).
  const tsiVal = row ? (num(row.ES_rel) - num(row.VaR_rel)) : NaN;
  const msdVal = (row && normRow) ? (num(normRow.ES_rel) - num(row.ES_rel)) : NaN;
  const tsiTh = crThreshold('TSI');
  const msdTh = crThreshold('MSD');
  const tsiState = Number.isFinite(tsiVal) ? trafficState(tsiVal, tsiTh) : null;
  const msdState = Number.isFinite(msdVal) ? trafficState(msdVal, msdTh) : null;

  // Jede Kennzahl mit eigener Limitleiste (computeLimitModel je Wert + Schwelle).
  const cards = [
    { label: 'CVaR', abs: fmtEur(row?.VaR_abs), rel: fmtRelPct(row?.VaR_rel),
      dRel: magDelta(curVarRelPct, lastVarRelPct), dAbs: magDelta(num(row?.VaR_abs), lastVarAbs),
      desc: 'Credit VaR', state: varState, limit: computeLimitModel(row?.VaR_rel, cvarTh, varState) },
    { label: 'ES CVaR', abs: fmtEur(row?.ES_abs), rel: fmtRelPct(row?.ES_rel),
      dRel: magDelta(curEsRelPct, lastEsRelPct), dAbs: magDelta(num(row?.ES_abs), lastEsAbs),
      desc: 'beyond CVaR', state: esState, limit: computeLimitModel(row?.ES_rel, cvarTh, esState) },
    { label: 'TSI', abs: null, rel: fmtRelPct(tsiVal), dRel: null, dAbs: null,
      desc: 'Historic ES - VaR', state: tsiState, limit: Number.isFinite(tsiVal) ? computeLimitModel(tsiVal, tsiTh, tsiState) : null },
    { label: 'MSD', abs: null, rel: fmtRelPct(msdVal), dRel: null, dAbs: null,
      desc: 'Adjusted - Historic ES', state: msdState, limit: Number.isFinite(msdVal) ? computeLimitModel(msdVal, msdTh, msdState) : null },
  ];
  cards.forEach((c) => { c.relDeltaStr = fmtPpSigned(c.dRel); c.absDeltaStr = fmtEurSigned(c.dAbs); });

  return { cards, hasRow: !!row };
}

// Limit-Modell je Kennzahl: Auslastung = |Wert%| / Rot-Limit%. th aus der jeweiligen
// Credit-Schwelle (CVAR/TSI/MSD). Risk limit = Rot-Schwelle %, Buffer = Rest bis Limit.
function computeLimitModel(valueFraction, th, state) {
  const redPct = Math.abs(th.red) * 100;
  const yellowPct = Math.abs(th.yellow) * 100;
  const curPct = Math.abs(num(valueFraction)) * 100;
  if (!Number.isFinite(curPct) || !(redPct > 0)) return null;
  const util = curPct / redPct;
  const yellowRatio = Math.min(100, (yellowPct / redPct) * 100);
  return {
    redPct, yellowPct, curPct, util, yellowRatio, state,
    utilStr: `${(util * 100).toFixed(1)}%`,
    limitRelStr: `${Number(redPct.toFixed(2))}%`,
    bufferRelStr: `${Number((redPct - curPct).toFixed(2))}%`,
  };
}

export function renderCreditRiskDashboard() {
  bindListeners();

  const host = document.getElementById('crDashKpi');
  const introEl = document.getElementById('crDashIntro');
  const tblEl = document.getElementById('crDashKpiTable');
  if (!host && !tblEl) return;

  const { cards } = getCreditDashboardModel();

  if (introEl) introEl.textContent = 'Current credit risk position for the selected portfolio.';

  if (host) {
    // Pro Kennzahl eine Zeile: KPI-Karte + eigene Limitleiste (untereinander).
    host.innerHTML = cards.map((c) => {
      const amp = `mr-amp--${c.state || 'neutral'}`;
      const relDeltaHtml = Number.isFinite(c.dRel) ? `<div class="mr-kpi-card__delta">${esc(c.relDeltaStr)}</div>` : '';
      const absDeltaHtml = Number.isFinite(c.dAbs) ? `<div class="mr-kpi-card__delta mr-kpi-card__delta--sub">${esc(c.absDeltaStr)}</div>` : '';
      const absHtml = c.abs ? `<div class="mr-kpi-card__sub">${esc(c.abs)}</div>` : '';
      const cardHtml = `
        <div class="mr-kpi-card">
          <div class="mr-kpi-card__label">${esc(c.label)}</div>
          <div class="mr-kpi-card__value">${esc(c.rel)}<span class="mr-amp-dot ${amp}"></span></div>
          ${relDeltaHtml}
          ${absHtml}
          ${absDeltaHtml}
          <div class="mr-kpi-card__desc">${esc(c.desc)}</div>
        </div>`;
      return `<div class="cr-metric-row">${cardHtml}<div class="cr-metric-limit">${limitBarHtml(c.limit)}</div></div>`;
    }).join('');
  }

  if (tblEl) {
    const rows = [];
    cards.forEach((c) => { rows.push([c.label, c.rel]); if (c.abs) rows.push([`${c.label} (abs)`, c.abs]); });
    tblEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
    }</tbody></table>`;
  }
}

// Loss-Charts (Histogramm + Tail, Tail-Zoom) — jetzt im Overview-Panel (panel-credit),
// nicht im Dashboard. Rendert bei Overview-Open und wenn die Loss-Daten eintreffen.
function renderCreditOverviewCharts() {
  try { renderCreditLossDist(); } catch (e) { console.warn('[CreditOverview] loss dist failed', e); }
  try { renderCreditTailZoom(); } catch (e) { console.warn('[CreditOverview] tail zoom failed', e); }
}

function limitBarHtml(m) {
  if (!m) return '<div class="mr-dash-intro">No limit data.</div>';
  const amp = `mr-amp--${m.state || 'neutral'}`;
  const fillW = Math.min(100, m.util * 100);
  return `
    <div class="mr-limit">
      <div class="mr-limit__head">
        <span class="mr-limit__title">Limit utilization</span>
        <span class="mr-limit__util ${amp}">${(m.util * 100).toFixed(1)}%</span>
      </div>
      <div class="mr-limit__bar">
        <div class="mr-limit__zone mr-limit__zone--green" style="left:0;width:${m.yellowRatio}%"></div>
        <div class="mr-limit__zone mr-limit__zone--amber" style="left:${m.yellowRatio}%;width:${100 - m.yellowRatio}%"></div>
        <div class="mr-limit__fill" style="width:${fillW}%"></div>
      </div>
      <div class="mr-limit__scale">
        <span>0%</span>
        <span>Warning ${Number(m.yellowPct.toFixed(2))}%</span>
        <span>Limit ${Number(m.redPct.toFixed(2))}%</span>
      </div>
      <div class="mr-limit__cards">
        <div class="mr-limit-card">
          <div class="mr-limit-card__lbl">Risk limit</div>
          <div class="mr-limit-card__val">${esc(m.limitRelStr)}</div>
          <div class="mr-limit-card__sub">threshold</div>
        </div>
        <div class="mr-limit-card">
          <div class="mr-limit-card__lbl">Buffer</div>
          <div class="mr-limit-card__val">${esc(m.bufferRelStr)}</div>
          <div class="mr-limit-card__sub">remaining to limit</div>
        </div>
      </div>
    </div>`;
}

function bindListeners() {
  if (_listenersBound) return;
  _listenersBound = true;
  document.addEventListener('panel:opened', (e) => {
    const id = e?.detail?.panelId;
    if (id === 'panel-credit-dashboard') {
      requestAnimationFrame(() => renderCreditRiskDashboard());
    } else if (id === 'panel-credit') {
      // Overview-Panel: die Loss-Charts (nach den Tabellen) rendern.
      requestAnimationFrame(() => renderCreditOverviewCharts());
    }
  });
  // Loss-Charts nachziehen, wenn die Histogramm-/Loss-Daten (evtl. nach dem ersten
  // Render) eintreffen.
  document.addEventListener('losshist:ready', () => { try { renderCreditOverviewCharts(); } catch {} });
}

bindListeners();
