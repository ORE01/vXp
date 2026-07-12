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
// rowOverride: die HOME-Overview uebergibt ihre eigene Zeilenauswahl, damit ihre
// KPI-Kaestchen und ihr Chart garantiert dieselbe MVaR-Zeile zeigen.
export function getMarketDashboardModel(rowOverride = null) {
  const row = rowOverride || currentMvarRow();
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

  const dVarRel = magDelta(num(row?.VaR_T_rel), lastVarRelPct);
  const dVarAbs = magDelta(num(row?.VaR_T_abs), lastVarAbs);
  const limit = computeLimitModel(row, varState);

  // KPI-Karten (4): relativer Wert = Hauptzahl, absoluter Wert immer darunter.
  const cards = [
    { label: 'MVaR', rel: fmtPct(row?.VaR_T_rel), abs: fmtEur(row?.VaR_T_abs), desc: interval || 'confidence · holding period',
      state: varState, dRel: dVarRel, dAbs: dVarAbs, relDeltaStr: fmtPpSigned(dVarRel), absDeltaStr: fmtEurSigned(dVarAbs) },
    { label: 'Expected Shortfall', rel: fmtPct(row?.ES_T_rel), abs: fmtEur(row?.ES_T_abs), desc: 'beyond MVaR', state: esState },
    { label: 'Delta vs previous', rel: fmtPpSigned(dVarRel), abs: fmtEurSigned(dVarAbs), desc: 'vs previous period', state: 'neutral', isDelta: true },
    { label: 'Limit buffer', rel: (limit ? limit.bufferRelStr : '–'), abs: (limit && limit.bufferAbs != null ? fmtEur(limit.bufferAbs) : '–'), desc: 'remaining to limit', state: varState },
  ];

  // Risk development: previous MVaR -> current MVaR -> Expected Shortfall (rel main, abs below).
  const prevVarRel = Number.isFinite(lastVarRelPct) ? -Math.abs(lastVarRelPct) : NaN;
  const flow = [
    { label: 'MVaR previous', rel: fmtPct(prevVarRel), abs: (Number.isFinite(lastVarAbs) ? fmtEur(lastVarAbs) : '–') },
    { label: 'MVaR current', rel: fmtPct(row?.VaR_T_rel), abs: fmtEur(row?.VaR_T_abs) },
    { label: 'Expected Shortfall', rel: fmtPct(row?.ES_T_rel), abs: fmtEur(row?.ES_T_abs) },
  ];

  // Status box (overall traffic light + short prose).
  const state = varState || (limit ? limit.state : null) || 'neutral';
  const label = { green: 'STATUS GREEN', yellow: 'STATUS YELLOW', red: 'STATUS RED' }[state] || 'STATUS';
  const utilStr = limit ? limit.utilStr : '–';
  const bufferAbsStr = (limit && limit.bufferAbs != null) ? fmtEur(limit.bufferAbs) : '–';
  const text = row
    ? `Market risk is within the defined risk framework. MVaR is ${fmtEur(row?.VaR_T_abs)} (${fmtPct(row?.VaR_T_rel)} of portfolio value) and Expected Shortfall is ${fmtEur(row?.ES_T_abs)}. Limit utilization is ${utilStr}, leaving a buffer of ${bufferAbsStr}.`
    : 'No market risk data for the selected portfolio yet.';
  const status = { state, label, text };

  return { status, cards, flow, limit, hasRow: !!row };
}

export function renderMarketRiskDashboard() {
  bindListeners();

  const statusEl = document.getElementById('mrDashStatus');
  const host = document.getElementById('mrDashKpi');
  const flowEl = document.getElementById('mrDashFlow');
  const introEl = document.getElementById('mrDashIntro');
  const limitEl = document.getElementById('mrDashLimit');
  const tblEl = document.getElementById('mrDashKpiTable');
  if (!host && !limitEl && !tblEl && !statusEl && !flowEl) return;

  const { status, cards, flow, limit } = getMarketDashboardModel();

  if (introEl) introEl.textContent = 'Current market risk position for the selected portfolio.';

  // Status-/Beschreibungs-Box mit grosser Ampel.
  if (statusEl) {
    const amp = `mr-amp--${status.state || 'neutral'}`;
    statusEl.innerHTML = `
      <div class="mr-status">
        <div class="mr-status__body">
          <div class="mr-status__title">Market Risk Overview</div>
          <div class="mr-status__text">${esc(status.text)}</div>
        </div>
        <div class="mr-status__badge">
          <span class="mr-amp-dot ${amp} mr-status__dot"></span>
          <span class="mr-status__badge-lbl">${esc(status.label)}</span>
        </div>
      </div>`;
  }

  // KPI-Karten: relativ = Hauptzahl, absolut immer darunter.
  if (host) {
    host.innerHTML = cards.map((c) => {
      const amp = `mr-amp--${c.state || 'neutral'}`;
      const dot = c.isDelta ? '' : `<span class="mr-amp-dot ${amp}"></span>`;
      const valCls = c.isDelta ? 'mr-kpi-card__value mr-kpi-card__value--delta' : 'mr-kpi-card__value';
      return `
      <div class="mr-kpi-card">
        <div class="mr-kpi-card__label">${esc(c.label)}</div>
        <div class="${valCls}">${esc(c.rel)}${dot}</div>
        <div class="mr-kpi-card__sub">${esc(c.abs)}</div>
        <div class="mr-kpi-card__desc">${esc(c.desc)}</div>
      </div>`;
    }).join('');
  }

  // Risk development (3 Boxen mit Pfeilen): rel oben, abs darunter.
  if (flowEl) {
    flowEl.innerHTML = `
      <div class="mr-flow__head">Risk development</div>
      <div class="mr-flow">${
        flow.map((f, i) => `${i > 0 ? '<div class="mr-flow__arrow">&#8594;</div>' : ''}
          <div class="mr-flow__box">
            <div class="mr-flow__lbl">${esc(f.label)}</div>
            <div class="mr-flow__val">${esc(f.rel)}</div>
            <div class="mr-flow__sub">${esc(f.abs)}</div>
          </div>`).join('')
      }</div>`;
  }

  renderLimitHtml(limitEl, limit);

  // KPI-Band-Spiegelung nur fuer die PREVIEW (Thumbnail-Erfassung). Das PDF zeichnet
  // das Dashboard nativ (RiskPDF, Composed).
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
    // Absolut (fuer Screen + PDF): "EUR … mn".
    limitAbsStr: (limitAbs != null ? fmtEur(limitAbs) : null),
    bufferAbsStr: (bufferAbs != null ? fmtEur(bufferAbs) : null),
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
          <div class="mr-limit-card__sub">${m.limitAbsStr ? esc(m.limitAbsStr) : 'CONSERVATIVE'}</div>
        </div>
        <div class="mr-limit-card">
          <div class="mr-limit-card__lbl">Buffer</div>
          <div class="mr-limit-card__val">${esc(m.bufferRelStr)}</div>
          <div class="mr-limit-card__sub">${m.bufferAbsStr ? esc(m.bufferAbsStr) : 'remaining to limit'}</div>
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
