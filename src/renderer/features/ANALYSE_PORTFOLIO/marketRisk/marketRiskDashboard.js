'use strict';

// Market-Risk-Dashboard ("Current Risk Overview", Vorlage-Stil): KPI-Karten fuer die
// aktuellen Marktrisiko-Kennzahlen des gewaehlten Portfolios. Vorerst NUR Market Risk
// (MVaR + ES MVaR). Deltas gg. Vorperiode und die Limit-Auslastungsleiste folgen.

import { appState } from '../../../renderer.js';
import { getMvarRowAsofDate, rowMatchesMvarContext } from './mvar/mvarSelectors.js';
import { getMVaRThresholdsFromInputUsingState, trafficLightStateForMVaR } from './mvar/mvarAggregatePanel.js';

let _listenersBound = false;

// Aktuellste MVaR-Aggregat-Zeile fuer Portfolio + gewaehltes Intervall (gleiche
// Auswahl wie handleMVaRData: Kontext-Match, dann neueste As-of-Zeile).
function currentMvarRow() {
  const rows = appState.getAllMvarData?.() || [];
  if (!rows.length) return null;
  const portName = appState.getSelectedPortTableName?.();
  if (!portName) return null;
  const scenarioName = appState.selectedMvarInterval;
  const matches = rows.filter((r) => rowMatchesMvarContext(r, { portName, scenarioName }));
  if (!matches.length) return null;
  return matches.slice()
    .sort((a, b) => getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b)))
    .at(-1);
}

const num = (v) => { const n = Number(v); return Number.isFinite(n) ? n : NaN; };

// EUR-Betrag als "EUR <n> mn" (Magnitude, adaptive Nachkommastellen).
function fmtEur(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  const mn = Math.abs(n) / 1e6;
  const dec = mn >= 100 ? 0 : mn >= 10 ? 1 : 2;
  return `EUR ${Number(mn.toFixed(dec)).toLocaleString('en-US')} mn`;
}
// Signierter EUR-Betrag (fuer Deltas): +EUR / -EUR. ASCII-Minus, damit der
// jsPDF-Standardfont (WinAnsi) es korrekt darstellt (kein U+2212).
function fmtEurSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : '-'}${fmtEur(Math.abs(n))}`;
}
// Signierte Prozentpunkt-Aenderung (fuer relative Deltas): +0.01% / -0.01%.
function fmtPpSigned(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '';
  return `${n >= 0 ? '+' : '-'}${Number(Math.abs(n).toFixed(3))}%`;
}
// Relativer Wert als Prozent (wie die MVaR-Summary im Screenshot, z.B. -0.244%).
function fmtPct(v) {
  const n = Number(v);
  if (!Number.isFinite(n)) return '–';
  return `${Number(n.toFixed(3))}%`;
}

function esc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

// CONSERVATIVE-Defaults (aus customerMarketRiskPanel), falls im Store keine Zeile.
const CONS_DEFAULTS = {
  VaR_T_rel: { yellow: -0.005, red: -0.010 },
  ES_T_rel:  { yellow: -0.007, red: -0.015 },
};
// Warn-/Limit-Schwellen (Fraktion, z.B. -0.010) fuer eine Metrik aus dem
// CONSERVATIVE-Profil; Fallback auf Defaults.
function conservativeLimit(metricCode) {
  const rows = appState.getCustomerMarketRiskThresholdsByProfile?.('CONSERVATIVE') || [];
  const r = rows.find((x) => String(x.metric_code) === metricCode);
  const d = CONS_DEFAULTS[metricCode] || CONS_DEFAULTS.VaR_T_rel;
  const y = r ? Number(r.yellow_loss_limit) : NaN;
  const rd = r ? Number(r.red_loss_limit) : NaN;
  return { yellow: Number.isFinite(y) ? y : d.yellow, red: Number.isFinite(rd) ? rd : d.red };
}

// Kandidaten-Portfolio-IDs (Tabellenname / Dropdown-Wert / Dropdown-Text), um die
// History-Zeilen (port_name, z.B. "UNI") robust zuzuordnen.
function selectedPortCandidates() {
  const set = new Set();
  const add = (v) => { const s = String(v ?? '').trim().toUpperCase(); if (s) set.add(s); };
  add(appState.getSelectedPortTableName?.());
  const dd = document.getElementById('createdPortDropdown0');
  add(dd?.value);
  if (dd && dd.selectedIndex >= 0) add(dd.options?.[dd.selectedIndex]?.textContent);
  return [...set];
}
// Letzter PortfolioHistoryMetrics-Eintrag fuer das aktuelle Portfolio (neuestes DATE).
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

// Datenmodell des Dashboards (Karten + Limit) aus dem Store — inkl. fertiger
// Anzeige-Strings. Basis fuer den HTML-Render (Screen) UND den nativen PDF-Composed-
// Renderer in RiskPDF (Vektor-Text/Rechtecke, KEIN Bild).
export function getMarketDashboardModel() {
  const row = currentMvarRow();
  const interval = String(appState.selectedMvarInterval ?? '').trim();

  const th = (() => { try { return getMVaRThresholdsFromInputUsingState(); } catch { return null; } })();
  const varState = (row && th) ? trafficLightStateForMVaR(row, th.RED_THRESHOLD, th.YELLOW_THRESHOLD, 'VaR_T_rel') : null;
  const esState = (row && th && th.ES_RED_THRESHOLD != null && th.ES_YELLOW_THRESHOLD != null)
    ? trafficLightStateForMVaR(row, th.ES_RED_THRESHOLD, th.ES_YELLOW_THRESHOLD, 'ES_T_rel')
    : null;

  // Delta = aktueller Wert - letzter PortfolioHistoryMetrics-Eintrag (Magnitude-
  // Aenderung: + = Risiko gestiegen). Relativ in Prozentpunkten (History-PCT ist eine
  // Fraktion -> *100), absolut in EUR.
  const hist = lastHistoryRow();
  const magDelta = (cur, last) => (Number.isFinite(cur) && Number.isFinite(last)) ? Math.abs(cur) - Math.abs(last) : null;
  const lastVarAbs = num(hist?.M_VaR_ALL ?? hist?.M_VaR_All);
  const lastEsAbs = num(hist?.M_ES_ALL ?? hist?.M_ES_All);
  const lastVarRelPct = num(hist?.M_VaR_ALL_PCT ?? hist?.M_VaR_All_PCT) * 100;
  const lastEsRelPct = num(hist?.M_ES_ALL_PCT ?? hist?.M_ES_All_PCT) * 100;

  // Vorerst NUR Market Risk (kein Credit).
  const cards = [
    { label: 'MVaR', abs: fmtEur(row?.VaR_T_abs), rel: fmtPct(row?.VaR_T_rel),
      dRel: magDelta(num(row?.VaR_T_rel), lastVarRelPct), dAbs: magDelta(num(row?.VaR_T_abs), lastVarAbs),
      desc: interval || 'Total VaR', state: varState },
    { label: 'ES MVaR', abs: fmtEur(row?.ES_T_abs), rel: fmtPct(row?.ES_T_rel),
      dRel: magDelta(num(row?.ES_T_rel), lastEsRelPct), dAbs: magDelta(num(row?.ES_T_abs), lastEsAbs),
      desc: 'beyond MVaR', state: esState },
  ];
  cards.forEach((c) => { c.relDeltaStr = fmtPpSigned(c.dRel); c.absDeltaStr = fmtEurSigned(c.dAbs); });

  return { cards, limit: computeLimitModel(row, varState), hasRow: !!row };
}

export function renderMarketRiskDashboard() {
  bindListeners();

  const host = document.getElementById('mrDashKpi');
  const introEl = document.getElementById('mrDashIntro');
  const limitEl = document.getElementById('mrDashLimit');
  const tblEl = document.getElementById('mrDashKpiTable');
  if (!host && !limitEl && !tblEl) return;

  const { cards, limit } = getMarketDashboardModel();

  if (introEl) introEl.textContent = 'Current market risk position for the selected portfolio.';

  if (host) {
    host.innerHTML = cards.map((c) => {
      const amp = `mr-amp--${c.state || 'neutral'}`;
      const relDeltaHtml = Number.isFinite(c.dRel)
        ? `<div class="mr-kpi-card__delta">${esc(c.relDeltaStr)}</div>` : '';
      const absDeltaHtml = Number.isFinite(c.dAbs)
        ? `<div class="mr-kpi-card__delta mr-kpi-card__delta--sub">${esc(c.absDeltaStr)}</div>` : '';
      return `
      <div class="mr-kpi-card">
        <div class="mr-kpi-card__label">${esc(c.label)}</div>
        <div class="mr-kpi-card__value">${esc(c.rel)}<span class="mr-amp-dot ${amp}"></span></div>
        ${relDeltaHtml}
        <div class="mr-kpi-card__sub">${esc(c.abs)}</div>
        ${absDeltaHtml}
        <div class="mr-kpi-card__desc">${esc(c.desc)}</div>
      </div>`;
    }).join('');
  }

  renderLimitHtml(limitEl, limit);

  // KPI-Band-Spiegelung nur fuer die PREVIEW (Thumbnail-Erfassung). Das PDF zeichnet
  // das Dashboard nativ (RiskPDF, Composed) — daher hier keine PDF-Sonderlogik.
  if (tblEl) {
    const rows = [];
    cards.forEach((c) => { rows.push([c.label, c.rel]); rows.push([`${c.label} (abs)`, c.abs]); });
    tblEl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
    }</tbody></table>`;
  }
}

// Limit-Modell (CONSERVATIVE): Auslastung = |MVaR| / Rot-Limit; Zonen gruen (bis
// Gelb-Limit) / amber (bis Rot-Limit). Plus Risikolimit + Puffer in EUR (aus abs/rel
// abgeleiteter Portfoliowert). null = keine Daten.
function computeLimitModel(row, state) {
  const lim = conservativeLimit('VaR_T_rel');
  const redPct = Math.abs(lim.red) * 100;       // z.B. 1.0 (%)
  const yellowPct = Math.abs(lim.yellow) * 100; // z.B. 0.5 (%)
  const curPct = Math.abs(num(row?.VaR_T_rel)); // z.B. 0.244 (%)
  if (!Number.isFinite(curPct) || !(redPct > 0)) return null;

  const util = curPct / redPct;
  const yellowRatio = Math.min(100, (yellowPct / redPct) * 100);
  const absV = Math.abs(num(row?.VaR_T_abs));
  const value = (Number.isFinite(absV) && curPct > 0) ? absV / (curPct / 100) : null;
  const limitAbs = value != null ? Math.abs(lim.red) * value : null;
  const bufferAbs = (limitAbs != null && Number.isFinite(absV)) ? (limitAbs - absV) : null;
  return {
    redPct, yellowPct, curPct, util, yellowRatio, limitAbs, bufferAbs, state,
    utilStr: `${(util * 100).toFixed(1)}%`,
    // Relativ: Limit = Rot-Schwelle in %, Buffer = verbleibende Prozentpunkte bis Limit.
    limitRelStr: `${Number(redPct.toFixed(2))}%`,
    bufferRelStr: `${Number((redPct - curPct).toFixed(2))}%`,
  };
}

function renderLimitHtml(el, m) {
  if (!el) return;
  if (!m) { el.innerHTML = '<div class="mr-dash-intro">No market risk data for the selected portfolio yet.</div>'; return; }
  const amp = `mr-amp--${m.state || 'neutral'}`;
  const fillW = Math.min(100, m.util * 100);
  el.innerHTML = `
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
          <div class="mr-limit-card__sub">CONSERVATIVE</div>
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
    if (e?.detail?.panelId === 'panel-market-dashboard') {
      requestAnimationFrame(() => renderMarketRiskDashboard());
    }
  });
}

// Listener schon beim Laden binden, damit ein Panel-Open vor dem ersten
// MVaR-Refresh trotzdem rendert.
bindListeners();
