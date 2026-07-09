'use strict';

// Credit-Risk-Dashboard analog zum Market-Risk-Dashboard: KPI-Karten (CVaR + ES CVaR)
// mit relativem Wert + Ampel + Deltas + absolutem Wert, plus Limit-Auslastungsleiste.
// Nutzt dieselben CSS-Klassen (mr-kpi-card / mr-limit / mr-amp) -> gleiches Aussehen.
// TSI / MSD folgen spaeter.

import { appState } from '../../../renderer.js';

let _listenersBound = false;
const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

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
    if (e?.detail?.panelId === 'panel-credit-dashboard') {
      requestAnimationFrame(() => renderCreditRiskDashboard());
    }
  });
}

bindListeners();
