// src/renderer/features/HOME/homeOverview.js
//
// Home / Landing "Financial Risk Management Overview".
// Drei Karten (Portfolio / Marktrisiko / Kreditrisiko) fuer das DEFAULT-Portfolio.
//
// Datenquelle: NUR die bereits beim Boot gefuellten Stores (letzter gespeicherter
// Stand) -> kein IPC, kein Python, kein Rechnen. Wird beim Boot, beim Oeffnen des
// OVERVIEW-Tabs und nach relevanten Table-Updates (dataRouter) neu gerendert.

import { appState } from '../../renderer.js';
import { fmtEurCompact } from '../../utils/tableCellFormats.js';
import { enrichPortfolioRowsWithRisk } from '../portfolio/shared/portfolioRiskEnrichment.js';
import { buildPositionLoss, getRunConfQuantil, issuersFromRank } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js';
import { crTailTopForFlag, getCreditDashboardModel } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/creditRiskDashboard.js';
import { getMvarRowAsofDate, getMvarRowScenarioName, normalizeMvarText } from '../ANALYSE_PORTFOLIO/marketRisk/mvar/mvarSelectors.js';
import { getMarketDashboardModel } from '../ANALYSE_PORTFOLIO/marketRisk/marketRiskDashboard.js';
import { getTileMode } from '../CUSTOMER_SETUP/overviewTilesPanel.js';
import { applyOverviewTileVisibility } from '../CUSTOMER_SETUP/overviewTilesPanel.js';
import { getPortfolioDurationLimits } from '../CUSTOMER_SETUP/portfolioDurationLimitsPanel.js';

// canvasId -> Chart-Instanz (fuer sauberes Neuzeichnen)
const _charts = Object.create(null);

// --- Formatierung -----------------------------------------------------------
const numOf = (v) => {
  if (v == null || v === '') return NaN;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

function fmtEur(v) {
  return fmtEurCompact(v);
}
const fmtNum = (v, d = 2) => Number.isFinite(v) ? v.toLocaleString('de-DE', { minimumFractionDigits: d, maximumFractionDigits: d }) : '–';
const fmtPctRaw = (v) => Number.isFinite(v) ? `${fmtNum(v, 2)} %` : '–';       // Wert ist bereits Prozent (Market)

const normPort = (s) => String(s ?? '').replace(/^Portfolios[_-]?/i, '').trim().toUpperCase();
const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
const showEl = (id, show) => { const el = document.getElementById(id); if (el) el.hidden = !show; };
// Datenverfuegbarkeit ("wenn vorhanden") ueber CSS-Klasse statt Inline-Style, damit
// sie sich sauber mit der Kunden-Sichtbarkeit (applyOverviewTileVisibility, Inline)
// kombiniert: unchecked -> Inline none; checked+leer -> Klasse none; checked+Daten -> sichtbar.
const setTileEmpty = (tileKey, empty) => {
  document.querySelectorAll(`[data-tile="${tileKey}"]`).forEach((el) => {
    el.classList.toggle('home-tile-empty', !!empty);
  });
};

// Ampel-Punkt (mr-amp-dot, Styles aus breakdown.css) setzen/verstecken.
function setDot(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('mr-amp--green', 'mr-amp--yellow', 'mr-amp--red', 'mr-amp--neutral');
  if (state) el.classList.add(`mr-amp--${state}`);
  el.hidden = !state;
}

// Risk-Slider (Overview, in der Portfolio-Karte): beide Skalen 0 → Ø-Maturity.
//  IR: 0–1Y = Money Market; Marke = Zinsduration  = −PV01  (Jahre).
//  CS: Short ↔ Long Credit Horizon; Marke = Spread-Duration = −CPV01 (Jahre).
// PV01/CPV01 negativ -> Duration positiv. Anzeige-only.
const _clamp01 = (x) => Math.max(0, Math.min(1, x));

// Ampelfarben (Marke = kraeftig, Track = halbtransparent auf dunkler Kachel).
const RS_AMP = { green: '#4CAF50', yellow: '#E0B000', red: '#D32F2F' };
const RS_AMP_T = { green: 'rgba(76,175,80,0.55)', yellow: 'rgba(224,176,0,0.55)', red: 'rgba(211,47,47,0.55)' };
// DUMMY-Schwellen (Jahre): <g grün, g–y gelb, >y rot. Spaeter durch echte Werte
// (Customer Setup) ersetzen — nur diese zwei Zahlen je Slider anpassen.
const RS_DUMMY = { ir: { g: 2, y: 5 }, cs: { g: 2, y: 5 } };

function _ampState(dur, th) {
  if (dur == null) return null;
  return dur < th.g ? 'green' : dur < th.y ? 'yellow' : 'red';
}

// Aktualisiert EINE Slider-Gruppe (.rs-group) ueber ihre data-role-Elemente. So werden
// beliebig viele Instanzen (Overview, Customer Setup) mit einer Funktion versorgt.
// Die Overview-Elemente tragen zusaetzlich IDs -> RiskPDF liest die Werte per ID.
// irDur/csDur sind bereits fertige Durationen in Jahren (im Aufrufer berechnet:
// abs(PV01)/NAV*10000 bzw. abs(CPV01)/NAV*10000).
function _applyRiskGroup(group, { avgMat, irDur, csDur }) {
  const q = (role) => group.querySelector(`[data-role="${role}"]`);
  const hasMat = Number.isFinite(avgMat) && avgMat > 0;
  const matTxt = hasMat ? `${fmtNum(avgMat, 2)}Y` : '–';
  const posOf = (dur) => (hasMat && Number.isFinite(dur)) ? _clamp01(dur / avgMat) * 100 : 0;
  const setTxt = (role, t) => { const el = q(role); if (el) el.textContent = t; };

  // Ampel-Verlauf als Track-Hintergrund; %-Grenzen (+1Y) als data-Attribute -> PDF.
  const setTrack = (role, th, oneY) => {
    const el = q(role); if (!el) return;
    if (!hasMat) { el.style.background = ''; el.dataset.g = ''; el.dataset.y = ''; return; }
    const gP = _clamp01(th.g / avgMat) * 100, yP = _clamp01(th.y / avgMat) * 100;
    el.style.background =
      `linear-gradient(90deg, ${RS_AMP_T.green} 0 ${gP}%, ${RS_AMP_T.yellow} ${gP}% ${yP}%, ${RS_AMP_T.red} ${yP}% 100%)`;
    el.dataset.g = gP.toFixed(2); el.dataset.y = yP.toFixed(2);
    if (oneY != null) el.dataset.oneY = oneY.toFixed(2);
  };
  // Marke: Position + Zonenfarbe (via --rs-accent, Pill erbt es); pos/state als data-Attr.
  const setMarker = (role, dur, th) => {
    const el = q(role); if (!el) return;
    const pos = posOf(dur), state = _ampState(dur, th);
    el.style.left = `${pos}%`;
    el.style.setProperty('--rs-accent', state ? RS_AMP[state] : '');
    el.dataset.pos = pos.toFixed(2); el.dataset.state = state || '';
  };

  const pos1y = hasMat ? _clamp01(1 / avgMat) * 100 : 0;

  // Ampel-Schwellen (in Jahren) aus den Customer-Setup Duration Limits: g = Gelb,
  // y = Rot (darunter gruen, dazwischen gelb, darueber rot). Fallback = RS_DUMMY.
  const _lim = (() => { try { return getPortfolioDurationLimits(); } catch (_) { return null; } })();
  const _th = (code, dflt) => {
    const l = _lim?.[code];
    return (l && Number.isFinite(l.yellow) && Number.isFinite(l.red)) ? { g: l.yellow, y: l.red } : dflt;
  };
  const irTh = _th('ir_duration', RS_DUMMY.ir);
  const csTh = _th('cs_duration', RS_DUMMY.cs);

  // Interest Rate Sensitivity: Ampel-Track + 1Y-Grenze (Money Market | Capital Market).
  setTrack('ir-track', irTh, pos1y);
  const ir1y = q('ir-1y'); if (ir1y) ir1y.style.left = `${pos1y}%`;
  const irS1y = q('ir-scale1y'); if (irS1y) { irS1y.style.left = `${pos1y}%`; irS1y.style.visibility = pos1y >= 96 ? 'hidden' : 'visible'; }
  setMarker('ir-marker', irDur, irTh);
  setTxt('ir-val', Number.isFinite(irDur) ? `${fmtNum(irDur, 2)}Y` : '–');
  setTxt('ir-max', matTxt);

  // Credit Spread Sensitivity: Ampel-Track, Marke auf 0 → Ø-Maturity.
  setTrack('cs-track', csTh, null);
  setMarker('cs-marker', csDur, csTh);
  setTxt('cs-val', Number.isFinite(csDur) ? `${fmtNum(csDur, 2)}Y` : '–');
  setTxt('cs-max', matTxt);
}

// Alle Slider-Gruppen im Dokument (Overview + Customer Setup) aktualisieren.
function updateRiskSliders(vals) {
  document.querySelectorAll('.rs-group').forEach((g) => _applyRiskGroup(g, vals));
}

// ── Credit-Slider (TSI/MSD): Marke = Wert vs. ECHTE Schwellen (grün<gelb<rot).
// value/thYellow/thRed/scaleMax sind Fraktionen; state = fertige Ampel-Einstufung.
function _applyTrafficSlider(group, key, cfg) {
  const q = (r) => group.querySelector(`[data-role="${key}-${r}"]`);
  const c = cfg || {};
  const has = Number.isFinite(c.scaleMax) && c.scaleMax > 0;
  const pct = (v) => (has && Number.isFinite(v)) ? _clamp01(v / c.scaleMax) * 100 : 0;
  const track = q('track');
  if (track) {
    if (!has || !Number.isFinite(c.thYellow) || !Number.isFinite(c.thRed)) {
      track.style.background = ''; track.dataset.g = ''; track.dataset.y = '';
    } else {
      const gP = _clamp01(c.thYellow / c.scaleMax) * 100, yP = _clamp01(c.thRed / c.scaleMax) * 100;
      track.style.background =
        `linear-gradient(90deg, ${RS_AMP_T.green} 0 ${gP}%, ${RS_AMP_T.yellow} ${gP}% ${yP}%, ${RS_AMP_T.red} ${yP}% 100%)`;
      track.dataset.g = gP.toFixed(2); track.dataset.y = yP.toFixed(2);
    }
  }
  const marker = q('marker');
  if (marker) {
    const p = pct(c.value);
    marker.style.left = `${p}%`;
    marker.style.setProperty('--rs-accent', c.state ? RS_AMP[c.state] : '');
    marker.dataset.pos = p.toFixed(2); marker.dataset.state = c.state || '';
  }
  const valEl = q('val'); if (valEl) valEl.textContent = (c.valTxt != null && c.valTxt !== '') ? c.valTxt : '–';
  const maxEl = q('max'); if (maxEl) maxEl.textContent = has ? `${Math.round(c.scaleMax * 100)}%` : '–';
}

// Skala 0 → ~1,4×Rot-Schwelle (mind. Wert*1,15, damit Marke sichtbar bleibt).
function _creditSliderCfg(k) {
  const val = Number.isFinite(k?.val) ? k.val : null;
  const thY = Number.isFinite(k?.thYellow) ? k.thYellow : null;
  const thR = Number.isFinite(k?.thRed) ? k.thRed : null;
  if (val == null || thY == null || thR == null) return { value: null, scaleMax: null };
  return { value: val, thYellow: thY, thRed: thR, scaleMax: Math.max(thR * 1.4, val * 1.15), state: k.state, valTxt: k.rel };
}

function updateCreditRiskSliders({ tsi, msd }) {
  document.querySelectorAll('.rs-group').forEach((g) => {
    _applyTrafficSlider(g, 'tsi', tsi);
    _applyTrafficSlider(g, 'msd', msd);
  });
}

// ── Market-Risk-Slider (mr1/mr2): gleiche Ampel-Mechanik wie die Credit-Slider.
// VORERST mit festen Dummy-Werten befuellt (siehe renderMarketCard). Spaeter an die
// Market-Risk-Trigger-Daten anbinden: statt _creditSliderCfg(<dummy>) einfach die echten
// { val, thYellow, thRed, state, rel } durchreichen.
function updateMarketRiskSliders({ mr1, mr2 }) {
  document.querySelectorAll('.rs-group').forEach((g) => {
    _applyTrafficSlider(g, 'mr1', mr1);
    _applyTrafficSlider(g, 'mr2', mr2);
  });
}

function destroyChart(id) {
  if (_charts[id]) { try { _charts[id].destroy(); } catch (_) {} delete _charts[id]; }
}

// Horizontale Mini-Balken (Prozent-Werte auf der x-Achse) — gemeinsame Basis
// ALLER drei Overview-Charts (Portfolio-Issuer, Market-Product-Contributions,
// Credit-Tail-Drivers). fmtValue/fmtTip steuern Wert-Label bzw. Tooltip.
function drawMiniHBar(canvasId, labels, values, color, { fmtValue, fmtTip, fmtTick } = {}) {
  const cv = document.getElementById(canvasId);
  if (!cv || !window.Chart) return;
  destroyChart(canvasId);
  const light = document.body.classList.contains('light-theme');
  const gridColor = light ? 'rgba(0,0,0,0.06)' : 'rgba(255,255,255,0.10)';
  const tickColor = (getComputedStyle(document.body).getPropertyValue('--text-muted') || '').trim() || '#888';
  const fv = fmtValue || ((v) => `${fmtNum(Number(v), 2)}%`);
  const ft = fmtTip || ((v) => ` ${fmtNum(Number(v), 3)} %`);
  const fk = fmtTick || ((v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`);
  _charts[canvasId] = new window.Chart(cv.getContext('2d'), {
    type: 'bar',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: {
      labels,
      datasets: [{ data: values, backgroundColor: color, borderWidth: 0, borderRadius: 3, maxBarThickness: 24 }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      // Synchron fertig zeichnen: der Report-Spiegel kopiert die Bitmap direkt
      // nach dem Rendern (syncHomeReportPanel) — mit Animation waere sie leer.
      animation: false,
      layout: { padding: { right: 42 } },
      plugins: {
        legend: { display: false },
        fitDisplay: false,
        tooltip: { callbacks: { label: (c) => ft(c.parsed.x) } },
        // Wert-Label IN den Balken (am Balkenende, weiss + fett).
        datalabels: window.ChartDataLabels
          ? { anchor: 'end', align: 'start', clamp: true, color: '#fff', font: { size: 9.5, weight: 'bold' }, formatter: (v) => (v ? fv(v) : '') }
          : undefined,
      },
      scales: {
        x: { beginAtZero: true, grid: { color: gridColor }, ticks: { font: { size: 10 }, color: tickColor, maxTicksLimit: 5, callback: (v) => fk(v) } },
        y: { grid: { display: false }, ticks: { font: { size: 10 }, color: tickColor, autoSkip: false, callback(v) {
          // Mehrzeilige Labels (Array, z.B. PROD_ID + Stammdaten-Zeile) zeilenweise
          // kuerzen; einfache String-Labels wie bisher.
          const raw = this.chart?.data?.labels?.[v];
          const trunc = (s, n) => { s = String(s); return s.length > n ? `${s.slice(0, n - 1)}…` : s; };
          if (Array.isArray(raw)) return raw.map((s) => trunc(s, 28));
          return trunc(String(this.getLabelForValue(v)), 24);
        } } },
      },
    },
  });
}

// --- Karten -----------------------------------------------------------------

function renderPortfolioCard(port) {
  setText('homePfPort', port ? `· ${port}` : '');
  const rows = (appState.getAllPortfolioData?.() || []).filter((r) => normPort(r?.port_name) === port);

  if (!rows.length) {
    ['homePfNotional', 'homePfNav', 'homePfNavRel', 'homePfNavBuy', 'homePfNavBuyRel',
     'homePfPnl', 'homePfPnlRel', 'homePfYield',
     'homePfPv01', 'homePfPv01Rel', 'homePfCpv01', 'homePfCpv01Rel',
     'homePfVega', 'homePfVegaRel', 'homePfCashPct',
     'homePfMatSplitY', 'homePfMatSplitNvY', 'homePfMatSplitAvg',
     'homePfMatSplitNvPct', 'homePfMatSplitVPct',
     'homePfIrDurTotal', 'homePfIrDurValued',
     'homePfCsDurTotal', 'homePfCsDurValued'].forEach((id) => setText(id, '–'));
    ['homePfCashBar', 'homePfMatSplitNv', 'homePfMatSplitV',
     'homePfIrDurTotalBar', 'homePfIrDurValuedBar',
     'homePfCsDurTotalBar', 'homePfCsDurValuedBar'].forEach((id) => {
      const b = document.getElementById(id); if (b) b.style.width = '0%';
    });
    updateRiskSliders({ avgMat: null, irDur: null, csDur: null });
    destroyChart('homePfChart');
    return false;
  }

  const enriched = enrichPortfolioRowsWithRisk(rows, port);

  let notional = 0, nav = 0, navBuy = 0, yieldW = 0, pv01Base = 0, cpv01Base = 0, vegaBase = 0, ttmW = 0, notTtm = 0;
  let hasPv01 = false, hasCpv01 = false, hasVega = false;
  let cashNotional = 0; // Nominale der NICHT bewerteten Kategorien (FIXED_VALUE) -> "Cash".
  let navCash = 0;      // NAV derselben Positionen -> "bewertetes NAV" = nav - navCash.
  const fixedCats = appState.getFixedValueCategoryNames?.() || new Set();
  const byIssuer = new Map();
  for (const r of enriched) {
    const n = numOf(r.NOTIONAL);
    notional += Number.isFinite(n) ? n : 0;
    nav += numOf(r.NAV) || 0;
    // Einstandswert (NetAssetValueBuy): Σ (PRICE_BUY/100 × NOTIONAL), analog PORTFOLIO TOTAL.
    navBuy += (numOf(r.PRICE_BUY) / 100) * (Number.isFinite(n) ? n : 0);
    yieldW += numOf(r.ytmPort) || 0;
    pv01Base += Number(r.PV01_BASE) || 0;
    cpv01Base += Number(r.CPV01_BASE) || 0;
    vegaBase += Number(r.VEGA_BASE) || 0;
    // "wenn vorhanden": Sensitivitaet zaehlt als vorhanden, sobald der Risk-Typ
    // ueberhaupt in den Base-Totals eines Trades auftaucht (nicht ueber die Summe,
    // die sich zu 0 aufheben koennte).
    const tb = r.RISK_TOTALS_BASE || {};
    if ('PV01' in tb)  hasPv01  = true;
    if ('CPV01' in tb) hasCpv01 = true;
    if ('VEGA' in tb)  hasVega  = true;
    // Cash = Positionen in nicht bewerteten (FIXED_VALUE) Kategorien; Match per CATEGORY-String.
    const cat = String(r.CATEGORY ?? r.category ?? '').trim();
    const isCash = !!(cat && fixedCats.has(cat));
    // Durchschnittliche Laufzeit (WAM): TtM nominal-gewichtet; bereits faellige
    // Positionen (TtM < 0) werden ausgeklammert.
    const ttm = numOf(r.TtM);
    if (ttm != null && ttm >= 0 && Number.isFinite(n)) { ttmW += ttm * n; notTtm += n; }
    const iss = String(r.ISSUER ?? '–').trim() || '–';
    byIssuer.set(iss, (byIssuer.get(iss) || 0) + (Number.isFinite(n) ? n : 0));
    if (isCash) {
      if (Number.isFinite(n)) cashNotional += n;
      navCash += numOf(r.NAV) || 0;
    }
  }

  setText('homePfNotional', fmtEur(notional));
  // Cash-Kachel: Anteil der nicht bewerteten Kategorien an der Gesamt-Nominale (ein Balken).
  const cashPct = notional ? (cashNotional / notional) * 100 : 0;
  setText('homePfCashPct', notional ? fmtPctRaw(cashPct) : '–');
  const cashBar = document.getElementById('homePfCashBar');
  if (cashBar) cashBar.style.width = `${Math.max(0, Math.min(100, cashPct))}%`;
  setText('homePfNav', fmtEur(nav));
  // Relativ zur Nominale: NAV / Notional (in %), analog zur Portfolio-Yield-Kachel.
  setText('homePfNavRel', notional ? `${fmtPctRaw((nav / notional) * 100)} of notional` : '–');
  // Einstandswert (Buy): absolut + relativ (= Ø-Einstandskurs in % der Nominale).
  setText('homePfNavBuy', fmtEur(navBuy));
  setText('homePfNavBuyRel', notional ? `${fmtPctRaw((navBuy / notional) * 100)} of notional` : '–');
  // Profit/Loss = NAV - NAVBuy (absolut); relativ = (NAV - NAVBuy) / NAVBuy in %.
  const pnl = nav - navBuy;
  setText('homePfPnl', fmtEur(pnl));
  setText('homePfPnlRel', navBuy ? fmtPctRaw((pnl / navBuy) * 100) : '–');
  // Portfolio-Yield = Σ ytmPort / Σ Notional (nominalgewichtete Kauf-Yield), konsistent
  // mit der "Portfolio Yield"-KPI im Yield-Panel. NICHT der letzte Historic-RETURN.
  setText('homePfYield', notional ? fmtPctRaw((yieldW / notional) * 100) : '–');

  // Sensitivitaeten: absolut (EUR) gross, relativ klein. Relativ = Wert / ΣNotional
  // × 10000 in "bp" (bp Preisaenderung je 1bp Faktor-Move), konsistent zum
  // Sensitivities-Panel. Kacheln ohne vorhandene Sensitivitaet werden ausgeblendet.
  const fmtBp = (v) => Number.isFinite(v) ? `${fmtNum(v, 2)} bp` : '–';
  const relBp = (v) => notional ? fmtBp((v / notional) * 10000) : '–';
  setText('homePfPv01',  fmtEur(pv01Base));   setText('homePfPv01Rel',  relBp(pv01Base));
  setText('homePfCpv01', fmtEur(cpv01Base));  setText('homePfCpv01Rel', relBp(cpv01Base));
  setText('homePfVega',  fmtEur(vegaBase));   setText('homePfVegaRel',  relBp(vegaBase));
  setTileEmpty('pv01',  !hasPv01);
  setTileEmpty('cpv01', !hasCpv01);
  setTileEmpty('vega',  !hasVega);

  // IR-Duration-Kachel (2 Balken): Duration = |PV01|/NAV·10000 auf das GESAMTE NAV vs. auf
  // das BEWERTETE NAV (= nav - navCash, ohne Cash / nicht bewertete Kategorien). Balkenlaenge
  // relativ zur Ø-Laufzeit (sonst zum groesseren der beiden Werte).
  const navValued = nav - navCash;
  const irDurTotal  = nav ? Math.abs(pv01Base) / nav * 10000 : null;
  const irDurValued = (navValued > 0) ? Math.abs(pv01Base) / navValued * 10000 : null;
  const csDurTotal  = nav ? Math.abs(cpv01Base) / nav * 10000 : null;
  const csDurValued = (navValued > 0) ? Math.abs(cpv01Base) / navValued * 10000 : null;
  const _durScale = (notTtm && (ttmW / notTtm) > 0)
    ? (ttmW / notTtm)
    : (Math.max(irDurTotal || 0, irDurValued || 0, csDurTotal || 0, csDurValued || 0) || 1);
  const setDurBar = (barId, valId, dur) => {
    const bar = document.getElementById(barId);
    if (bar) bar.style.width = `${Number.isFinite(dur) ? Math.max(0, Math.min(100, dur / _durScale * 100)) : 0}%`;
    setText(valId, Number.isFinite(dur) ? `${fmtNum(dur, 2)}Y` : '–');
  };
  setDurBar('homePfIrDurTotalBar', 'homePfIrDurTotal', irDurTotal);
  setDurBar('homePfIrDurValuedBar', 'homePfIrDurValued', irDurValued);
  setDurBar('homePfCsDurTotalBar', 'homePfCsDurTotal', csDurTotal);
  setDurBar('homePfCsDurValuedBar', 'homePfCsDurValued', csDurValued);

  // IR-Duration-Split-Kachel: Balken nach Nominale in "nicht bewertet" | "bewertet" geteilt.
  // Not-valued = 0Y (Cash hat keine Zinsduration), valued = IR-Duration aufs bewertete NAV,
  // Ø = IR-Duration aufs GESAMTE NAV.
  const nvPct = Math.max(0, Math.min(100, cashPct));
  const _msNv = document.getElementById('homePfMatSplitNv');
  const _msV  = document.getElementById('homePfMatSplitV');
  if (_msNv) _msNv.style.width = `${nvPct}%`;
  if (_msV)  _msV.style.width  = `${100 - nvPct}%`;
  setText('homePfMatSplitNvY', '0Y');
  setText('homePfMatSplitY',   Number.isFinite(irDurValued) ? `${fmtNum(irDurValued, 2)}Y` : '–');
  setText('homePfMatSplitAvg', Number.isFinite(irDurTotal)  ? `Ø ${fmtNum(irDurTotal, 2)}Y` : 'Ø –');
  // Prozentsaetze unter dem Balken: Nominale-Anteil nicht bewertet | bewertet.
  setText('homePfMatSplitNvPct', notional ? fmtPctRaw(nvPct) : '–');
  setText('homePfMatSplitVPct',  notional ? fmtPctRaw(100 - nvPct) : '–');

  // Risk-Slider (versteckter IR-Slider fuer PDF + CS-Slider): Ø-Maturity (WAM) als Skala,
  // Marken = Zins-/Spread-Duration in Jahren: abs(PV01)/NAV*10000 bzw. abs(CPV01)/NAV*10000.
  updateRiskSliders({
    avgMat: notTtm ? (ttmW / notTtm) : null,
    irDur: nav ? Math.abs(pv01Base) / nav * 10000 : null,
    csDur: nav ? Math.abs(cpv01Base) / nav * 10000 : null,
  });

  // Mini-Bar (horizontal): groesste Issuer in % vom Gesamt-Notional (Top 4) —
  // Balkenfarbe = Icon-Farbe der Karte (Portfolio-Badge, blau).
  const top = [...byIssuer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3);
  drawMiniHBar(
    'homePfChart',
    top.map((e) => e[0]),
    top.map((e) => (notional ? +(e[1] / notional * 100).toFixed(1) : 0)),
    'rgba(108, 155, 209, 0.9)',
    { fmtValue: (v) => `${fmtNum(Number(v), 1)}%`, fmtTip: (v) => ` ${fmtNum(Number(v), 1)} % of notional` },
  );
  return true;
}

// MVaR-Zeile exakt wie das Market-Risk-Dashboard auswaehlen (getLatestAggregate-
// MvarRow): erst das Szenario aufloesen (aktuelle Auswahl -> Kunden-Default ->
// ROLLING_1 -> STRESSED -> erstes vorhandenes), dann innerhalb Portfolio+Szenario
// die Zeile der letzten Berechnung (juengstes asof_date; created_at ist in
// MarketVaR historisch NULL und taugt nicht als Kriterium).
function pickMvarRow(rows) {
  if (!rows.length) return null;
  const available = new Set(rows.map((r) => normalizeMvarText(getMvarRowScenarioName(r))).filter(Boolean));
  const scenario = [
    appState.selectedMvarInterval,
    appState.getCustomerMarketRiskSetting?.()?.default_market_risk_interval_code,
    'ROLLING_1',
    'STRESSED',
  ].map(normalizeMvarText).find((s) => s && available.has(s)) || null;
  const matches = scenario
    ? rows.filter((r) => normalizeMvarText(getMvarRowScenarioName(r)) === scenario)
    : rows;
  return matches.slice().sort((a, b) => getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b))).at(-1) || null;
}

// "as of"-Datum der Kopfzeile: Datum der letzten Berechnung (created_at der
// MVaR-Zeile). Historische Zeilen haben kein created_at -> Fallback: juengstes
// Marktdaten-Datum (tblTS) — mit diesen Daten wurde gerechnet.
function latestMarketDataDate() {
  const rows = appState.getTblTSData?.() || [];
  let max = '';
  for (const r of rows) {
    const d = String(r?.DATE ?? '').slice(0, 10);
    if (d > max) max = d;
  }
  return max || null;
}

// MARKET-STRESS-Buffer-Ampel (HOME-Market-Karte): Buffer = Abstand des aktuellen
// Markts (ROLLING_1) zum Stress-Szenario, relativ zum Rolling-Wert.
// Schwellen aus dem Customer Setup (CustomerMarketRiskThresholdSetting,
// Metrik MARKET_STRESS, aktives Warning-Profil); Fallback 30% gelb / 10% rot.
const MARKET_STRESS_DEFAULTS = { yellow: 0.30, red: 0.10 };
function marketStressThreshold() {
  const profile = String(appState.getCustomerMarketRiskSetting?.()?.risk_warning_profile || 'CONSERVATIVE');
  const rows = appState.getCustomerMarketRiskThresholdsByProfile?.(profile) || [];
  const r = rows.find((x) => String(x.metric_code) === 'MARKET_STRESS');
  const y = r ? Number(r.yellow_loss_limit) : NaN;
  const rd = r ? Number(r.red_loss_limit) : NaN;
  return {
    yellow: Number.isFinite(y) ? Math.abs(y) : MARKET_STRESS_DEFAULTS.yellow,
    red: Number.isFinite(rd) ? Math.abs(rd) : MARKET_STRESS_DEFAULTS.red,
  };
}

// Positioniert die 2 Werte-Bloecke ueber den Scale-Ticks (aus data-mark) und trennt sie
// garantiert, falls die Ticks nah/deckungsgleich liegen. Idempotent: setzt zuerst die
// Basisposition (posStyle) und schiebt dann nur bei Ueberlappung auseinander. Wird nach jedem
// Render UND vom ResizeObserver aufgerufen (Overview kann beim ersten Render noch versteckt sein).
function deCollideVals(valsEl) {
  if (!valsEl) return;
  const blocks = Array.from(valsEl.children);
  const posStyle = (left) => {
    const L = Math.max(0, Math.min(100, left));
    if (L <= 12) return { left: '0', transform: '' };
    if (L >= 88) return { left: '100%', transform: 'translateX(-100%)' };
    return { left: `${L}%`, transform: 'translateX(-50%)' };
  };
  // Basisposition (posStyle) wiederherstellen -> idempotent bei erneuten Aufrufen.
  blocks.forEach((el) => {
    const p = posStyle(Number(el.dataset.mark));
    el.style.left = p.left; el.style.right = 'auto'; el.style.transform = p.transform;
  });
  const W = valsEl.clientWidth;
  if (!(W > 0) || blocks.length !== 2) return;
  const GAP = 10; // px Mindestabstand
  const info = blocks.map((el) => ({
    el, w: el.offsetWidth,
    c: (Math.max(0, Math.min(100, Number(el.dataset.mark))) / 100) * W,
  })).sort((a, b) => a.c - b.c);
  const [L, R] = info;
  const need = (L.w + R.w) / 2 + GAP;
  if ((R.c - L.c) >= need) return; // kein Ueberlapp
  // Symmetrisch um den Mittelpunkt trennen; stoesst eine Seite an den Rand, die andere nachziehen.
  const lMin = L.w / 2, rMax = W - R.w / 2;
  const midC = (L.c + R.c) / 2;
  let lc = midC - need / 2, rc = midC + need / 2;
  if (lc < lMin) { lc = lMin; rc = Math.min(rMax, lc + need); }
  if (rc > rMax) { rc = rMax; lc = Math.max(lMin, rc - need); }
  L.c = lc; R.c = rc;
  [L, R].forEach((b) => { b.el.style.left = `${b.c}px`; b.el.style.right = 'auto'; b.el.style.transform = 'translateX(-50%)'; });
}

// Schiebt die Labels (Werte/Limits) so, dass sie garantiert innerhalb der Kachel bleiben — misst
// die tatsaechliche Geometrie (getBoundingClientRect + Padding), unabhaengig von etwaigen Breiten-
// Eigenheiten der Layer. Idempotent: aendert nur, was ueber den Innenrand hinausragt.
function clampLabelsInsideTile(layerEl) {
  if (!layerEl || typeof layerEl.closest !== 'function') return;
  const tile = layerEl.closest('.mkt-scale-tile');
  if (!tile) return;
  const layerRect = layerEl.getBoundingClientRect();
  if (!(layerRect.width > 0)) return;
  const tr = tile.getBoundingClientRect();
  const cs = getComputedStyle(tile);
  const innerLeft = tr.left + (parseFloat(cs.paddingLeft) || 0);
  const innerRight = tr.right - (parseFloat(cs.paddingRight) || 0);
  Array.from(layerEl.children).forEach((c) => {
    const rect = c.getBoundingClientRect();
    if (!(rect.width > 0)) return;
    let targetLeft = rect.left;
    if (rect.right > innerRight) targetLeft = innerRight - rect.width; // rechts reinziehen
    if (targetLeft < innerLeft) targetLeft = innerLeft;                // links reinziehen
    if (Math.abs(targetLeft - rect.left) > 0.5) {
      c.style.left = `${targetLeft - layerRect.left}px`;
      c.style.right = 'auto';
      c.style.transform = 'none';
    }
  });
}

function renderMarketCard(port) {
  setText('homeMktPort', port ? `· ${port}` : '');

  // Zeile-3-Metrik-Spec der Market-Kacheln dynamisch aus den Customer-Setup-Einstellungen
  // (Konfidenz + VaR-Horizont): z.B. "VaR 95% 10 days" / "ES 97,5% 10 days". Fehlt die
  // Einstellung, bleibt der statische HTML-Text stehen.
  try {
    const _mr = appState.getCustomerMarketRiskSetting?.() || null;
    const _confPct = Number(_mr?.confidence) * 100;
    const _days = Math.trunc(Number(_mr?.var_days));
    if (Number.isFinite(_confPct) && _confPct > 0 && Number.isFinite(_days) && _days > 0) {
      const _confTxt = `${_confPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`;
      const _daysTxt = `${_days} day${_days === 1 ? '' : 's'}`;
      const _mName = { VaR: 'Value at Risk', ES: 'Expected Shortfall' };
      document.querySelectorAll('.mkt-metric-spec').forEach((el) => {
        const _m = el.dataset.metric || 'VaR';
        el.textContent = `${_mName[_m] || _m} ${_confTxt} ${_daysTxt}`;
      });
    }
  } catch (_) {}

  const rows = (appState.getAllMvarData?.() || []).filter((r) => normPort(r?.port_name) === port);

  // Overview-Szenarien: "Current Market" = ROLLING_1 (Baseline). "Stressed Market" = das im
  // Customer Setup gewaehlte Default-Szenario (default_market_risk_interval_code) — NICHT die
  // View-Auswahl selectedMvarInterval (die jetzt auf ROLLING_1 steht). Fallback: STRESSED,
  // sonst erstes vorhandenes Nicht-ROLLING-Szenario.
  const available = new Set(rows.map((r) => normalizeMvarText(getMvarRowScenarioName(r))).filter(Boolean));
  const latestRowFor = (scen) => rows
    .filter((r) => normalizeMvarText(getMvarRowScenarioName(r)) === scen)
    .sort((a, b) => getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b)))
    .at(-1) || null;

  const custDefault = normalizeMvarText(appState.getCustomerMarketRiskSetting?.()?.default_market_risk_interval_code);
  const stressName = [custDefault, 'STRESSED'].find((s) => s && s !== 'ROLLING_1' && available.has(s))
    || [...available].find((s) => s !== 'ROLLING_1')
    || null;

  const rollRow = latestRowFor('ROLLING_1');
  const stressRow = stressName ? latestRowFor(stressName) : null;
  const row = rollRow || stressRow; // gueltige Aggregat-Zeile fuer Top-Product-Chart + Datum

  if (!row) {
    ['homeMktVar', 'homeMktVarAbs', 'homeMktEs', 'homeMktEsAbs',
     'homeMktRollVar', 'homeMktRollVarAbs', 'homeMktRollEs', 'homeMktRollEsAbs',
     'homeMktCurVarAbs', 'homeMktCurVarRel', 'homeMktCurEsAbs', 'homeMktCurEsRel',
     'homeMktStrVarAbs', 'homeMktStrVarRel', 'homeMktStrEsAbs', 'homeMktStrEsRel',
     'homeMktStrScenName',
     'homeMktExecStatus', 'homeMktExecVar', 'homeMktExecEs', 'homeMktExecTop',
     'homeMktCurDistVar', 'homeMktCurDistEs'].forEach((id) => setText(id, '–'));
    setDot('homeMktVarDot', null);
    setDot('homeMktEsDot', null);
    ['homeMktScaleTrack', 'homeMktScaleVals', 'homeMktScaleLimits',
     'homeMktScaleEsTrack', 'homeMktScaleEsVals', 'homeMktScaleEsLimits'].forEach((id) => {
      const el = document.getElementById(id); if (el) el.innerHTML = '';
    });
    destroyChart('homeMktChart');
    return null;
  }

  // Reihe 1 = ROLLING (Current Market) + MARKET-STRESS-Ampel; Reihe 2 (Kaestchen) = das
  // Stress-Szenario aus dem Customer Setup. scenName = Label des Stress-Szenarios.
  const scenName = stressName || '–';
  const stressModel = stressRow ? getMarketDashboardModel(stressRow) : null;
  const [kMvar, kEs] = stressModel ? stressModel.cards : [null, null];
  const rollModel = rollRow ? getMarketDashboardModel(rollRow) : null;
  const [rVar, rEs] = rollModel ? rollModel.cards : [null, null];

  const stressBuffer = (metric) => {
    const s = Math.abs(Number(stressRow?.[metric]));
    const r0 = Math.abs(Number(rollRow?.[metric]));
    if (!Number.isFinite(s) || !Number.isFinite(r0) || r0 === 0) return null;
    return (s - r0) / r0;
  };
  const msTh = marketStressThreshold();
  const bufferState = (b) => (b == null
    ? null
    : b < msTh.red ? 'red' : b < msTh.yellow ? 'yellow' : 'green');

  // Reihe 1: ROLLING-Werte + Market-Stress-Ampel.
  setText('homeMktVar', rVar ? rVar.rel : '–');
  setDot('homeMktVarDot', bufferState(stressBuffer('VaR_T_rel')));
  setText('homeMktVarAbs', rVar ? rVar.abs : '–');
  setText('homeMktEs', rEs ? rEs.rel : '–');
  setDot('homeMktEsDot', bufferState(stressBuffer('ES_T_rel')));
  setText('homeMktEsAbs', rEs ? rEs.abs : '–');

  // Reihe 2: gewaehltes Szenario (Name im Label); ohne Stress-Szenario '–'.
  const rollIds = ['homeMktRollVar', 'homeMktRollVarAbs', 'homeMktRollEs', 'homeMktRollEsAbs'];
  if (stressRow) {
    setText('homeMktRollVar', kMvar.rel);
    setText('homeMktRollVarAbs', kMvar.abs);
    setText('homeMktRollEs', kEs.rel);
    setText('homeMktRollEsAbs', kEs.abs);
    setText('homeMktScenNameVar', scenName);
    setText('homeMktScenNameEs', scenName);
  } else {
    rollIds.forEach((id) => setText(id, '–'));
    setText('homeMktScenNameVar', '–');
    setText('homeMktScenNameEs', '–');
  }

  // Zusammengefasste Kacheln: Current Market (rollRow) + Stressed Market (stressRow),
  // je Normal Risk (VaR) + Extreme Risk (ES), absolut + relativ.
  setText('homeMktCurVarAbs', rVar ? rVar.abs : '–');
  setText('homeMktCurVarRel', rVar ? rVar.rel : '–');
  setText('homeMktCurEsAbs', rEs ? rEs.abs : '–');
  setText('homeMktCurEsRel', rEs ? rEs.rel : '–');
  // Stressed Market: abs + rel = Stress-Szenario. In der Kopfzeile statt Buffer der Szenario-Name
  // (Originalschreibweise aus der Zeile).
  const fmtBuf = (b) => (b == null ? '–'
    : `${(b * 100).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);
  setText('homeMktStrVarAbs', stressRow ? kMvar.abs : '–');
  setText('homeMktStrVarRel', stressRow ? kMvar.rel : '–');
  setText('homeMktStrEsAbs', stressRow ? kEs.abs : '–');
  setText('homeMktStrEsRel', stressRow ? kEs.rel : '–');
  setText('homeMktStrScenName',
    stressRow ? (String(getMvarRowScenarioName(stressRow)).trim() || scenName) : '–');
  // Current Market: Anteil am Stress-Niveau = |Current| / |Stressed| (VaR + ES) in der Kopfzeile.
  const curOfStressed = (absKey) => {
    const c = Math.abs(Number(rollRow?.[absKey]));   // Current Market
    const s = Math.abs(Number(stressRow?.[absKey])); // Stressed (Extrem)
    if (!Number.isFinite(c) || !Number.isFinite(s) || s === 0) return null;
    return c / s;
  };
  setText('homeMktCurDistVar', stressRow ? fmtBuf(curOfStressed('VaR_T_abs')) : '–');
  setText('homeMktCurDistEs', stressRow ? fmtBuf(curOfStressed('ES_T_abs')) : '–');

  // Balken der zusammengefassten Kacheln (Current + Stressed): farbige Limit-Zonen (gruen bis
  // Warnschwelle, amber bis Limit) + Marker am aktuellen Wert (util) — analog zur Limit-Leiste
  // im Market-Risk-Dashboard. Gleiche VaR-/ES-Limits fuer beide Szenarien.
  const setZoneBar = (trackId, m) => {
    const track = document.getElementById(trackId);
    if (!track) return;
    if (!m) { track.classList.remove('mkt-grp-track--zones'); track.innerHTML = ''; return; }
    const yr = Math.max(0, Math.min(100, Number(m.yellowRatio)));
    const mark = Math.max(0, Math.min(100, Number(m.util) * 100));
    track.classList.add('mkt-grp-track--zones');
    track.innerHTML =
      `<div class="mkt-grp-zone mkt-grp-zone--green" style="left:0;width:${yr}%"></div>` +
      `<div class="mkt-grp-zone mkt-grp-zone--amber" style="left:${yr}%;width:${100 - yr}%"></div>` +
      `<div class="mkt-grp-marker" style="left:${mark}%"></div>`;
  };
  setZoneBar('homeMktCurVarTrack', rollModel?.limit);
  setZoneBar('homeMktCurEsTrack', rollModel?.esLimit);
  setZoneBar('homeMktStrVarTrack', stressModel?.limit);
  setZoneBar('homeMktStrEsTrack', stressModel?.esLimit);

  // Scale-Schieber (NORMAL RISK = VaR, EXTREME RISK = ES): Limit-Balken (gruene/amber Zonen wie
  // Current Market) mit 2 weissen Ticks = Auslastung Current (rollModel) + Stressed (stressModel).
  // Werte (3 Zeilen: Name / primaer / sekundaer) ueber den Ticks, Limits (Gelb + Rot) darunter,
  // Metrik-Spec ("VaR/ES <conf>% <days> days") rechts. Gemeinsame Logik fuer beide Kacheln.
  {
    const esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    // Label an einem left% verankern; an den Raendern links-/rechtsbuendig statt zentriert.
    const posStyle = (left) => {
      const L = Math.max(0, Math.min(100, left));
      if (L <= 12) return 'left:0;';
      if (L >= 88) return 'left:100%;transform:translateX(-100%);';
      return `left:${L}%;transform:translateX(-50%);`;
    };
    const mk = (m) => (m && Number.isFinite(Number(m.util)))
      ? Math.max(0, Math.min(100, Number(m.util) * 100)) : null;
    const _mScale = (() => { try { return getTileMode('mkt_scale'); } catch { return 'abs'; } })();
    // Konfidenz/Horizont aus Customer-Setup (fuer die Metrik-Spec rechts, VaR + ES gemeinsam).
    const _mr = appState.getCustomerMarketRiskSetting?.() || null;
    const _confPct = Number(_mr?.confidence) * 100;
    const _days = Math.trunc(Number(_mr?.var_days));
    const specTxt = (Number.isFinite(_confPct) && _confPct > 0 && Number.isFinite(_days) && _days > 0)
      ? `${_confPct.toLocaleString('de-DE', { maximumFractionDigits: 2 })}% ${_days} day${_days === 1 ? '' : 's'}`
      : '95% 10 days';
    const valBlock = (name, abs, rel, inc) => {
      const p  = _mScale === 'rel' ? rel : abs;
      const sv = _mScale === 'rel' ? abs : rel;
      // Stress-Anstieg (+X %) direkt hinter dem primaeren Wert (nur beim Stressed-Tick).
      const incHtml = (inc != null) ? ` <span class="mkt-scale-vinc">${inc >= 0 ? '+' : ''}${inc} %</span>` : '';
      return `<span class="mkt-scale-vn">${esc(name)}</span>`
           + `<span class="mkt-scale-vp">${esc(p ?? '–')}${incHtml}</span>`
           + `<span class="mkt-scale-vs">${esc(sv ?? '–')}</span>`;
    };

    const renderScaleTile = (ids, curLim, strLim, curCard, strCard, metric, strInc) => {
      const track = document.getElementById(ids.track);
      const valsEl = document.getElementById(ids.vals);
      const limsEl = document.getElementById(ids.lims);
      const specEl = document.getElementById(ids.spec);
      // Spec zweizeilig: voller Metrikname oben, Konfidenz/Horizont darunter.
      const metricFull = ({ VaR: 'Value at Risk', ES: 'Expected Shortfall' })[metric] || metric;
      if (specEl) specEl.innerHTML = `${metricFull}<span class="mkt-scale-spec-sub">${specTxt}</span>`;
      const lim = curLim || strLim || null;
      const curMark = mk(curLim);
      const strMark = mk(strLim);
      if (track) {
        if (!lim) { track.classList.remove('mkt-grp-track--zones'); track.innerHTML = ''; }
        else {
          const yr = Math.max(0, Math.min(100, Number(lim.yellowRatio)));
          track.classList.add('mkt-grp-track--zones');
          track.innerHTML =
            `<div class="mkt-grp-zone mkt-grp-zone--green" style="left:0;width:${yr}%"></div>` +
            `<div class="mkt-grp-zone mkt-grp-zone--amber" style="left:${yr}%;width:${100 - yr}%"></div>` +
            (curMark != null ? `<div class="mkt-grp-marker mkt-scale-tick" style="left:${curMark}%" title="Current ${metric}"></div>` : '') +
            (strMark != null ? `<div class="mkt-grp-marker mkt-scale-tick" style="left:${strMark}%" title="Stressed ${metric}"></div>` : '');
        }
      }
      // Werte ueber den Ticks (3 Zeilen). Position + Kollisionstrennung via deCollideVals; ein
      // ResizeObserver zieht die Trennung nach, sobald das Panel sichtbar/breit wird (beim ersten
      // Render ist das Overview evtl. noch versteckt -> clientWidth 0, dann keine Messung moeglich).
      if (valsEl) {
        valsEl.innerHTML = (!lim) ? '' :
          (curMark != null && curCard ? `<span data-mark="${curMark}">${valBlock('Current', curCard.abs, curCard.rel)}</span>` : '') +
          (strMark != null && strCard ? `<span data-mark="${strMark}">${valBlock('Stressed', strCard.abs, strCard.rel, strInc)}</span>` : '');
      }
      // Limits unter dem Balken: Gelb-Warnschwelle (an yellowRatio) + Rot-Limit (am rechten Ende).
      // Jede Angabe abs + rel nebeneinander: primaerer Wert (per Umschalter) vorn, der andere in
      // Klammern dahinter.
      if (limsEl) {
        const yr = lim ? Math.max(0, Math.min(100, Number(lim.yellowRatio))) : 0;
        const redAbs = lim ? Number(lim.limitAbs) : NaN;
        const yellowAbs = Number.isFinite(redAbs) ? redAbs * (yr / 100) : NaN;
        const pct = (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%`;
        // abs ohne "EUR"-Praefix (konsistent mit den Werten oben, kuerzer -> ragt nicht raus).
        const fmtNoCur = (v) => String(fmtEur(v)).replace(/^EUR\s*/i, '');
        const limLabel = (abs, rel) => {
          const p  = _mScale === 'rel' ? rel : abs;
          const sv = _mScale === 'rel' ? abs : rel;
          return `${esc(p)} <span class="mkt-scale-lim-sec">(${esc(sv)})</span>`;
        };
        limsEl.innerHTML = (!lim) ? '' :
          `<span class="mkt-scale-lim-cap">Limits:</span>` +
          (Number.isFinite(yellowAbs) ? `<span class="mkt-scale-lim-warn" style="${posStyle(yr)}" title="Warning limit">${limLabel(fmtNoCur(yellowAbs), pct(lim.yellowPct))}</span>` : '') +
          (Number.isFinite(redAbs) ? `<span title="Risk limit">${limLabel(fmtNoCur(redAbs), lim.limitRelStr || pct(lim.redPct))}</span>` : '');
      }
      // Labels final einpassen: Kollisionstrennung der Werte + beide Ebenen in die Kachel klemmen.
      // ResizeObserver zieht nach, sobald das Panel sichtbar/breit wird (beim ersten Render evtl.
      // noch versteckt -> nicht messbar).
      const relayout = () => {
        deCollideVals(valsEl);
        clampLabelsInsideTile(valsEl);
      };
      if (valsEl && !valsEl._decObs && typeof ResizeObserver !== 'undefined') {
        valsEl._decObs = new ResizeObserver(relayout);
        valsEl._decObs.observe(valsEl);
      }
      relayout();
    };

    // Stress-Anstieg (+X %) = (|Stress rel| - |Current rel|) / |Current rel| * 100 (wie mktCmp*Delta).
    const pctInc = (curRel, strRel) => {
      const c = Math.abs(Number(curRel) || 0), s = Math.abs(Number(strRel) || 0);
      return (c && s) ? Math.round(((s - c) / c) * 100) : null;
    };
    const varInc = stressRow ? pctInc(rollRow?.VaR_T_rel, stressRow?.VaR_T_rel) : null;
    const esInc  = stressRow ? pctInc(rollRow?.ES_T_rel, stressRow?.ES_T_rel) : null;
    renderScaleTile(
      { track: 'homeMktScaleTrack', vals: 'homeMktScaleVals', lims: 'homeMktScaleLimits', spec: 'homeMktScaleSpec' },
      rollModel?.limit, stressModel?.limit, rVar, stressRow ? kMvar : null, 'VaR', varInc);
    renderScaleTile(
      { track: 'homeMktScaleEsTrack', vals: 'homeMktScaleEsVals', lims: 'homeMktScaleEsLimits', spec: 'homeMktScaleEsSpec' },
      rollModel?.esLimit, stressModel?.esLimit, rEs, stressRow ? kEs : null, 'ES', esInc);
  }

  // Market-Risk-Vergleich (VaR | ES): Balken Current (rollRow) vs Stress (stressRow) +
  // %-Anstieg. Balkenlaenge relativ zum groesseren der beiden Werte (VaR_T_rel/ES_T_rel).
  {
    const _esc = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const _cmp = (prefix, curRelNum, strRelNum, curAbs, curRel, strAbs, strRel, mode) => {
      const A = (v) => Math.abs(Number(v) || 0);
      const c = A(curRelNum), s = A(strRelNum);
      const mx = Math.max(c, s) || 1;
      const W = (id, v) => { const el = document.getElementById(id); if (el) el.style.width = `${Math.min(100, (v / mx) * 100)}%`; };
      // Zelle: absoluter Wert + relativer dahinter. Bei mode 'rel' tauschen sie die Plaetze
      // (relativer Wert zuerst/gross, absoluter klein dahinter).
      const cell = (abs, rel) => {
        if (abs == null && rel == null) return '–';
        const p  = mode === 'rel' ? rel : abs;
        const sv = mode === 'rel' ? abs : rel;
        return `<span class="mkt-cmp-prim">${_esc(p ?? '–')}</span> <span class="mkt-cmp-sec">${_esc(sv ?? '')}</span>`;
      };
      const H = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
      W(`mktCmp${prefix}CurBar`, c);
      W(`mktCmp${prefix}StrBar`, s);
      H(`mktCmp${prefix}Cur`, cell(curAbs, curRel));
      H(`mktCmp${prefix}Str`, cell(strAbs, strRel));
      const d = (c && s) ? ((s - c) / c) * 100 : null;
      const dEl = document.getElementById(`mktCmp${prefix}Delta`);
      if (dEl) dEl.textContent = d == null ? '–' : `${d >= 0 ? '+' : ''}${Math.round(d)} %`;
    };
    const _mVar = (() => { try { return getTileMode('mkt_var'); } catch { return 'abs'; } })();
    const _mEs  = (() => { try { return getTileMode('mkt_es');  } catch { return 'abs'; } })();
    _cmp('Var', rollRow?.VaR_T_rel, stressRow?.VaR_T_rel, rVar?.abs, rVar?.rel, stressRow ? kMvar?.abs : null, stressRow ? kMvar?.rel : null, _mVar);
    _cmp('Es',  rollRow?.ES_T_rel,  stressRow?.ES_T_rel,  rEs?.abs,  rEs?.rel,  stressRow ? kEs?.abs  : null, stressRow ? kEs?.rel : null,  _mEs);
  }


  // Mini-Bar: Top-3 Product Contributions (wie Market Risk/Products) — groesste
  // |VaR-Beitraege| je Produkt aus MarketVaR_Product, gleiches Szenario + Stichtag
  // wie die gewaehlte Aggregat-Zeile (Fallback: nur Szenario).
  const scen = normalizeMvarText(getMvarRowScenarioName(row));
  const prodAll = (appState.getMvarProductData?.() || []).filter((r) =>
    normPort(r?.port_name) === port && normalizeMvarText(getMvarRowScenarioName(r)) === scen);
  const sameAsof = prodAll.filter((r) => String(r?.asof_date ?? '') === String(row.asof_date ?? ''));
  const prodVals = (sameAsof.length ? sameAsof : prodAll)
    .map((r) => {
      const total = Number(r?.var_contrib_total);
      const val = (Number.isFinite(total) && total !== 0)
        ? total
        : (Number(r?.var_contrib_ir) || 0) + (Number(r?.var_contrib_cs) || 0);
      return { id: String(r?.prod_id ?? ''), val };
    })
    .filter((p) => p.id && Math.abs(p.val) > 0);

  const prodTop = prodVals.slice().sort((a, b) => Math.abs(b.val) - Math.abs(a.val)).slice(0, 3);

  // Stammdaten der Top-Beitraege dreizeilig direkt im Chart-Label:
  // Zeile 1 = Kennnummer, Zeile 2 = Issuer, Zeile 3 = Rating · Maturity · Typ.
  const portRows = (appState.getAllPortfolioData?.() || []).filter((r) => normPort(r?.port_name) === port);
  const chartLabelFor = (p) => {
    const m = portRows.find((r) => String(r?.PROD_ID ?? '') === p.id);
    const s = (v) => String(v ?? '').trim();
    const issuer = s(m?.ISSUER);
    const rest = [s(m?.RATINGres) || s(m?.RATING), s(m?.MATURITY), s(m?.CouponType)].filter(Boolean).join(' · ');
    const lines = [p.id, issuer, rest].filter(Boolean);
    return lines.length > 1 ? lines : p.id;
  };

  if (prodTop.length) {
    // Beitrag in % vom Total-VaR; Fallback: Summe aller Produkt-Beitraege.
    const baseAbs = Math.abs(Number(row.VaR_T_abs)) ||
      prodVals.reduce((s, p) => s + Math.abs(p.val), 0);
    // Balkenfarbe = Icon-Farbe der Karte (Market-Badge, magenta).
    drawMiniHBar(
      'homeMktChart',
      prodTop.map(chartLabelFor),
      prodTop.map((p) => +(Math.abs(p.val) / baseAbs * 100).toFixed(1)),
      'rgba(42, 127, 127, 0.9)',
      {
        fmtValue: (v) => `${fmtNum(Number(v), 1)}%`,
        fmtTip: (v) => ` ${fmtNum(Number(v), 1)} % of total VaR`,
      },
    );
  } else {
    destroyChart('homeMktChart');
  }
  // Executive Summary: Status (Ampel Current-VaR) + Stress-Anstieg VaR/ES + groesster
  // VaR-Contributor. Prozent-Anstieg = (|Stress rel| - |Current rel|) / |Current rel| * 100.
  {
    const escE = (x) => String(x ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const setHtml = (id, html) => { const el = document.getElementById(id); if (el) el.innerHTML = html; };
    const pctInc = (curRel, strRel) => {
      const c = Math.abs(Number(curRel) || 0), s = Math.abs(Number(strRel) || 0);
      return (c && s) ? Math.round(((s - c) / c) * 100) : null;
    };
    // Status aus VaR + Stressed-VaR gegen das VaR-Limit. Zone je Metrik: gruen (unter Warn-
    // schwelle), gelb (Warnschwelle..Limit), ueber (>= Limit). Eskalation: beide gruen -> low;
    // eines gelb -> moderate; beide gelb -> elevated; irgendeines ueber Limit -> high.
    const zoneOf = (m) => {
      const u = Number(m?.util), yr = Number(m?.yellowRatio) / 100;
      if (!Number.isFinite(u)) return null;
      if (u >= 1) return 'over';
      if (Number.isFinite(yr) && u >= yr) return 'amber';
      return 'green';
    };
    // VaR + ES, je Current + Stressed (4 Auslastungen) gegen ihr jeweiliges Limit.
    const zones = [
      zoneOf(rollModel?.limit),   zoneOf(stressModel?.limit),   // VaR: Current, Stressed
      zoneOf(rollModel?.esLimit), zoneOf(stressModel?.esLimit), // ES:  Current, Stressed
    ].filter(Boolean);
    const overN = zones.filter((z) => z === 'over').length;
    const amberN = zones.filter((z) => z === 'amber').length;
    setHtml('homeMktExecStatus',
      !zones.length          ? 'Current market risk level –'
      : overN > 0            ? 'Current market risk is <b class="exec-hi">high</b> (limit exceeded)'
      : amberN >= 2          ? 'Current market risk is <b class="exec-mid">elevated</b> (multiple near limit)'
      : amberN === 1         ? 'Current market risk is <b class="exec-mid">moderate</b> (approaching limit)'
      :                        'Current market risk remains <b class="exec-lo">low</b>');
    const dVar = stressRow ? pctInc(rollRow?.VaR_T_rel, stressRow?.VaR_T_rel) : null;
    const dEs  = stressRow ? pctInc(rollRow?.ES_T_rel, stressRow?.ES_T_rel) : null;
    setHtml('homeMktExecVar', dVar == null ? 'No stress scenario for VaR' : `Stress scenario increases VaR by <b>${dVar} %</b>`);
    setHtml('homeMktExecEs',  dEs == null ? 'No stress scenario for ES'  : `Stress scenario increases ES by <b>${dEs} %</b>`);
    const topIssuer = prodTop.length
      ? (String(portRows.find((r) => String(r?.PROD_ID ?? '') === prodTop[0].id)?.ISSUER ?? '').trim() || prodTop[0].id)
      : null;
    setHtml('homeMktExecTop', topIssuer ? `Largest VaR contributor: <b>${escE(topIssuer)}</b>` : 'Largest VaR contributor: –');
  }

  // Datum der letzten Berechnung; ohne created_at das Marktdaten-Datum.
  return String(row.created_at ?? '').slice(0, 10) || latestMarketDataDate();
}

// Top tail drivers (Historic / pd_flag RATING): groesste Emittenten-Beitraege zum
// Tail-Verlust. Rechenkern = crTailTopForFlag aus dem Credit-Risk-Dashboard; hier
// nur der Aufbau der Inputs aus den Boot-Stores. EAD/Loss speichern den vollen
// Tabellennamen -> Rohnamen ueber normPort aufloesen.
function crTailTopIssuers(port) {
  const portRows = (appState.getAllPortfolioData?.() || []).filter((r) => normPort(r?.port_name) === port);
  if (!portRows.length) return [];
  const ead = appState.getAllEADData?.() || [];
  const rawPort = ead.find((r) => normPort(r?.port_name) === port)?.port_name ?? port;
  const issuerLoss = new Map();   // key -> { name, loss }
  const issuerRating = new Map(); // key -> rating (fuer die zweite Label-Zeile)
  for (const r of buildPositionLoss(portRows, rawPort)) {
    const name = String(r?.ISSUER ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = issuerLoss.get(key) || { name, loss: 0 };
    cur.loss += Number(r.__LOSS) || 0;
    issuerLoss.set(key, cur);
    if (!issuerRating.get(key)) issuerRating.set(key, String(r?.RATINGres ?? r?.RATING ?? '').trim());
  }
  const allLoss = (appState.getAllLossData?.() || []).filter((r) => normPort(r?.port_name) === port);
  return crTailTopForFlag('RATING', issuerLoss, issuerRating, allLoss, getRunConfQuantil()).slice(0, 3);
}

// Hoechste TCM (Tail Concentration Multiplier = Tail-Loss-Anteil / EAD-Anteil) im
// Portfolio (Historic / pd_flag RATING). Gleiche Rechnung wie im Credit-Dashboard
// (renderCreditTailContributors): Emittent mit der groessten Tail-Schieflage.
function crHighestTcm(port) {
  const portRows = (appState.getAllPortfolioData?.() || []).filter((r) => normPort(r?.port_name) === port);
  if (!portRows.length) return null;
  const ead = appState.getAllEADData?.() || [];
  const rawPort = ead.find((r) => normPort(r?.port_name) === port)?.port_name ?? port;
  const issuerLoss = new Map();
  const issuerRating = new Map();
  for (const r of buildPositionLoss(portRows, rawPort)) {
    const name = String(r?.ISSUER ?? '').trim();
    if (!name) continue;
    const key = name.toLowerCase();
    const cur = issuerLoss.get(key) || { name, loss: 0 };
    cur.loss += Number(r.__LOSS) || 0;
    issuerLoss.set(key, cur);
    if (!issuerRating.get(key)) issuerRating.set(key, String(r?.RATINGres ?? r?.RATING ?? '').trim());
  }
  const issuerEad = new Map(); let totalEad = 0;
  for (const r of portRows) {
    const name = String(r?.ISSUER ?? '').trim();
    if (!name) continue;
    const n = Number(r?.NOTIONAL) || 0;
    issuerEad.set(name.toLowerCase(), (issuerEad.get(name.toLowerCase()) || 0) + n);
    totalEad += n;
  }
  const allLoss = (appState.getAllLossData?.() || []).filter((r) => normPort(r?.port_name) === port);
  const top = crTailTopForFlag('RATING', issuerLoss, issuerRating, allLoss, getRunConfQuantil());
  let best = null;
  for (const it of top) {
    const eadV = issuerEad.get(String(it.name).toLowerCase()) || 0;
    const eadShare = totalEad > 0 ? eadV / totalEad * 100 : NaN;
    const tcm = (Number.isFinite(eadShare) && eadShare > 0) ? it.pct / eadShare : NaN;
    if (Number.isFinite(tcm) && (!best || tcm > best.tcm)) {
      best = { tcm, issuer: it.name, rating: it.rating, tailShare: it.pct, eadShare };
    }
  }
  return best;
}

// Concentration-Risk-Balken (TCM) in der Overview/Credit-Karte. Feste Skala 0–3.5×,
// Marker-Farbe nach Zone (gruen<=1 / gelb<=1.5 / orange<=2 / rot>2). Ersetzt den
// alten TSI-Ampel-Slider.
const CONC_TCM_MAX = 3.5;
function renderConcentrationRisk(port) {
  const marker = document.getElementById('crConcMarker');
  const pill = document.getElementById('crConcPill');
  const best = port ? crHighestTcm(port) : null;
  if (!best || !Number.isFinite(best.tcm)) {
    setText('crConcSub', 'No tail concentration data.');
    if (marker) marker.style.left = '0%';
    if (pill) pill.textContent = '–';
    return;
  }
  const tcmNum = best.tcm.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  setText('crConcSub', `${best.issuer} drives ${tcmNum}× more tail risk than its portfolio share.`);
  const p = _clamp01(best.tcm / CONC_TCM_MAX) * 100;
  if (marker) marker.style.left = `${p}%`;
  if (pill) pill.textContent = `${tcmNum}×`;
}

// Portfolioweiter Concentration-Risk-SCORE (Management-Score aus dem HHI der Tail-Loss-Anteile —
// identische Rechnung wie im Limits-Panel: N = alle Emittenten mit positivem Tail-Loss,
// HHI = Sum(share^2), eff = 1/HHI, score = ((N-eff)/(N-1))*100). Overview-Port-Konventionen.
function crConcentrationScore(port) {
  const portRows = (appState.getAllPortfolioData?.() || []).filter((r) => normPort(r?.port_name) === port);
  if (!portRows.length) return null;
  const ead = appState.getAllEADData?.() || [];
  const rawPort = ead.find((r) => normPort(r?.port_name) === port)?.port_name ?? port;
  const issuerLoss = new Map();
  for (const r of buildPositionLoss(portRows, rawPort)) {
    const name = String(r?.ISSUER ?? '').trim(); if (!name) continue;
    issuerLoss.set(name.toLowerCase(), (issuerLoss.get(name.toLowerCase()) || 0) + (Number(r.__LOSS) || 0));
  }
  const allLoss = (appState.getAllLossData?.() || []).filter((r) => normPort(r?.port_name) === port);
  const rows = allLoss.filter((r) => String(r?.pd_flag ?? '').toUpperCase() === 'RATING');
  const confQ = getRunConfQuantil();
  let tail = rows.filter((r) => Number(r.QUANTIL) >= confQ);
  if (tail.length < 3) {
    const sorted = rows.slice().sort((a, b) => Number(b.LOSS) - Number(a.LOSS));
    tail = sorted.slice(0, Math.max(3, Math.ceil(sorted.length * 0.05)));
  }
  const perIssuer = new Map();
  for (const s of tail) {
    for (const nm of issuersFromRank(s.ISSUER_RANK)) {
      const key = String(nm).trim().toLowerCase();
      perIssuer.set(key, (perIssuer.get(key) || 0) + (issuerLoss.get(key) || 0));
    }
  }
  const losses = [...perIssuer.values()].filter((v) => v > 0);
  const total = losses.reduce((a, b) => a + b, 0);
  const N = losses.length;
  if (!(total > 0) || N < 1) return null;
  const hhi = losses.reduce((a, v) => { const sh = v / total; return a + sh * sh; }, 0);
  const eff = hhi > 0 ? 1 / hhi : NaN;
  const score = (N > 1 && Number.isFinite(eff)) ? ((N - eff) / (N - 1)) * 100 : 100;
  const shares = losses.map((v) => (v / total) * 100).sort((a, b) => b - a);   // Tail-Anteile % absteigend
  return { pct: Math.max(0, Math.min(100, score)), eff, shares };
}

// Concentration-Risk-Score-Slider (Overview) im Stil des TCM-Sliders: Skala 0..100 %,
// Zonen gruen <40 / gelb 40-60 / rot >60, Marker beim Score.
const CONC_SCORE_GREEN = 40, CONC_SCORE_YELLOW = 60;
function renderConcentrationScore(port) {
  const marker = document.getElementById('crConcScoreMarker');
  const pill = document.getElementById('crConcScorePill');
  const c = port ? crConcentrationScore(port) : null;
  if (!c || !Number.isFinite(c.pct)) {
    setText('crConcScoreSub', 'No concentration data.');
    if (marker) marker.style.left = '0%';
    if (pill) pill.textContent = '–';
    return;
  }
  const f1 = (v) => v.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const status = c.pct >= CONC_SCORE_YELLOW ? 'High' : c.pct >= CONC_SCORE_GREEN ? 'Elevated' : 'Low';
  setText('crConcScoreSub', `${status} concentration · effective tail drivers: ${Number.isFinite(c.eff) ? f1(c.eff) : '–'}`);
  const p = _clamp01(c.pct / 100) * 100;
  if (marker) marker.style.left = `${p}%`;
  if (pill) pill.textContent = `${f1(c.pct)}%`;
}

// Tail-Loss-Anteil (%) der Top-3-Emittenten (fuer die Credit-Executive-Summary; wie im
// Economic-Capital-Fazit). Historic / RATING.
function crTop3TailSharePct(port) {
  const portRows = (appState.getAllPortfolioData?.() || []).filter((r) => normPort(r?.port_name) === port);
  if (!portRows.length) return NaN;
  const ead = appState.getAllEADData?.() || [];
  const rawPort = ead.find((r) => normPort(r?.port_name) === port)?.port_name ?? port;
  const issuerLoss = new Map(), issuerRating = new Map();
  for (const r of buildPositionLoss(portRows, rawPort)) {
    const name = String(r?.ISSUER ?? '').trim(); if (!name) continue;
    const key = name.toLowerCase();
    const cur = issuerLoss.get(key) || { name, loss: 0 };
    cur.loss += Number(r.__LOSS) || 0; issuerLoss.set(key, cur);
    if (!issuerRating.get(key)) issuerRating.set(key, '');
  }
  const allLoss = (appState.getAllLossData?.() || []).filter((r) => normPort(r?.port_name) === port);
  const top = crTailTopForFlag('RATING', issuerLoss, issuerRating, allLoss, getRunConfQuantil());
  const s = top.slice(0, 3).reduce((a, b) => a + (Number(b.pct) || 0), 0);
  return (Number.isFinite(s) && s > 0) ? s : NaN;
}

// Executive Summary (Credit, Overview): dieselben Aussagen wie das Key-Figures-Fazit im
// Economic-Capital-Panel (EL/VaR/ES rel + Top-3-Tail-Anteil).
function renderCreditExecSummary(port, ecH) {
  if (!port || !ecH) {
    ['homeCrExecEl', 'homeCrExecVar', 'homeCrExecEs', 'homeCrExecConc'].forEach((id) => setText(id, '–'));
    return;
  }
  const fR = (x) => Number.isFinite(x) ? `${(x * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '–';
  const fA = (x) => Number.isFinite(x) ? fmtEur(x) : '–';
  const f1 = (x) => x.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  // rel/abs je Kennzahl nach dem Customer-Setup-Umschalter (wie die KPI-Kacheln).
  const em = (key) => { try { return getTileMode(key); } catch { return 'abs'; } };
  const vEl = em('credit_el') === 'rel' ? fR(ecH.el?.rel) : fA(ecH.el?.abs);
  const vEc = em('credit_ec') === 'rel' ? fR(ecH.ec?.rel) : fA(ecH.ec?.abs);
  const vEs = em('credit_es') === 'rel' ? fR(ecH.es?.rel) : fA(ecH.es?.abs);
  const c = crConcentrationScore(port);
  const K = (c && Number.isFinite(c.eff)) ? Math.max(1, Math.round(c.eff)) : NaN;
  const topKShare = (c && Array.isArray(c.shares) && Number.isFinite(K)) ? c.shares.slice(0, K).reduce((a, b) => a + b, 0) : NaN;
  setText('homeCrExecEl',   `Reported expected loss remains low at ${vEl}.`);
  setText('homeCrExecVar',  `Economic Capital provides a ${vEc} realistic risk buffer.`);
  setText('homeCrExecEs',   `Average loss in extreme cases reaches ${vEs}.`);
  setText('homeCrExecConc', (Number.isFinite(K) && Number.isFinite(topKShare))
    ? `Tail risk is highly concentrated: ${K} issuers drive ${f1(topKShare)} % of tail losses.`
    : 'Tail risk concentration: n/a.');
}

// Economic-Capital-Kennzahlen (EL/EDE/VaR/EC) fuer eine PD-Variante — gleiche Rechnung wie
// im Credit-Risk-Panel (renderCreditKpiSet). eadPdField = 'PD' (historic) bzw. 'PD_M_norm'
// (current); cvarFlag = 'RATING' bzw. 'NORM'. Basiszeilen = EAD pd_flag RATING.
function creditEcSet(port, eadPdField, cvarFlag) {
  let elSum = 0, elCnt = 0, edeSum = 0;
  for (const r of (appState.getAllEADData?.() || [])) {
    if (normPort(r?.port_name) !== port) continue;
    if (String(r?.pd_flag ?? '').trim().toUpperCase() !== 'RATING') continue;
    const lgd = Number(r?.LGD), pd = Number(r?.[eadPdField]), notion = Number(r?.NOTIONAL);
    if (Number.isFinite(lgd) && Number.isFinite(pd)) { elSum += lgd * pd; elCnt++; }
    if (Number.isFinite(notion) && Number.isFinite(pd)) edeSum += notion * pd;
  }
  const cvar = (appState.getAllCvarData?.() || []).find((c) =>
    normPort(c?.port_name) === port && String(c?.pd_flag ?? '').trim().toUpperCase() === cvarFlag);
  const varAbs = Math.abs(Number(cvar?.VaR_abs));
  const varRel = Math.abs(Number(cvar?.VaR_rel));
  const base = (Number.isFinite(varAbs) && Number.isFinite(varRel) && varRel > 0) ? varAbs / varRel : NaN;
  const haveEl = elCnt > 0, haveVar = Number.isFinite(varAbs);
  const ecAbs = (haveEl && haveVar) ? varAbs - elSum : NaN;
  return {
    el:  { abs: haveEl ? elSum : NaN,  rel: (haveEl && Number.isFinite(base)) ? elSum / base : NaN },
    ede: { abs: haveEl ? edeSum : NaN, rel: (haveEl && Number.isFinite(base)) ? edeSum / base : NaN },
    vr:  { abs: haveVar ? varAbs : NaN, rel: haveVar ? varRel : NaN },
    es:  { abs: Math.abs(Number(cvar?.ES_abs)), rel: Math.abs(Number(cvar?.ES_rel)) },
    ec:  { abs: ecAbs, rel: (Number.isFinite(ecAbs) && Number.isFinite(base)) ? ecAbs / base : NaN },
  };
}

// Economic-Capital-Schieber (Historic): Loss-Skala mit EDE/VaR/ES-Ticks, EC-Band (EL..VaR) und
// ANGENOMMENEN Limits: Warnschwelle = VaR, Rot-Limit = 1,2 x ES (Risikoappetit). Skala 0..Limit.
function renderCreditScale(port, ids, eadPdField, cvarFlag) {
  const track = document.getElementById(ids.track);
  if (!track) return;
  const valsEl = document.getElementById(ids.vals);
  const limsEl = document.getElementById(ids.lims);
  const ecBar = document.getElementById(ids.ecBar);
  const clear = () => {
    track.classList.remove('mkt-grp-track--zones'); track.innerHTML = '';
    if (valsEl) valsEl.innerHTML = ''; if (limsEl) limsEl.innerHTML = '';
    if (ecBar) ecBar.innerHTML = '';
    setText(ids.ec, '–');
  };
  const s = creditEcSet(port, eadPdField, cvarFlag);
  const elR = s.el.rel, edeR = s.ede.rel, varR = s.vr.rel, esR = s.es.rel, ecR = s.ec.rel;
  if (!(Number.isFinite(varR) && Number.isFinite(esR) && esR > 0)) { clear(); return; }
  const warn = varR, limit = esR * 1.2;          // ANNAHME: Warn = VaR, Limit = 1,2 x ES
  const pct = (v) => Math.max(0, Math.min(100, (v / limit) * 100));
  const yr = pct(warn);
  const fR = (x) => Number.isFinite(x) ? `${(x * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '–';
  const fA = (x) => Number.isFinite(x) ? fmtEur(x) : '–';
  // abs oder rel gross je Customer-Setup-Umschalter (beide Schieber teilen die Einstellung).
  const mode = (() => { try { return getTileMode('cr_ec_scale'); } catch { return 'abs'; } })();
  const posStyle = (l) => { const L = Math.max(0, Math.min(100, l)); return L <= 12 ? 'left:0;' : L >= 88 ? 'left:100%;transform:translateX(-100%);' : `left:${L}%;transform:translateX(-50%);`; };
  // Track: Zonen (gruen bis Warn, amber bis Limit) + weisse Ticks.
  track.classList.add('mkt-grp-track--zones');
  const elP = Number.isFinite(elR) ? pct(elR) : null, varP = pct(varR);
  const tick = (v, lbl) => Number.isFinite(v) ? `<div class="mkt-grp-marker" style="left:${pct(v)}%" title="${lbl}"></div>` : '';
  track.innerHTML =
    `<div class="mkt-grp-zone mkt-grp-zone--green" style="left:0;width:${yr}%"></div>` +
    `<div class="mkt-grp-zone mkt-grp-zone--amber" style="left:${yr}%;width:${100 - yr}%"></div>` +
    tick(edeR, 'Expected Defaulted Exposure') + tick(varR, 'VaR') + tick(esR, 'ES');
  // EC-Band (EL..VaR) im eigenen Streifen darunter -> ueberlagert die gruenen Zonen nicht.
  if (ecBar) ecBar.innerHTML = (elP != null && varP > elP)
    ? `<div class="cr-scale-ec" style="left:${elP}%;width:${varP - elP}%" title="Economic Capital (EL..VaR)"></div>` : '';
  // Werte ueber den Ticks.
  if (valsEl) {
    const vb = (lbl, o) => Number.isFinite(o.rel) ? `<span style="${posStyle(pct(o.rel))}"><span class="mkt-scale-vn">${lbl}</span><span class="mkt-scale-vp">${mode === 'rel' ? fR(o.rel) : fA(o.abs)}</span><span class="mkt-scale-vs">${mode === 'rel' ? fA(o.abs) : fR(o.rel)}</span></span>` : '';
    valsEl.innerHTML = vb('EDE', s.ede) + vb('VaR', s.vr) + vb('ES', s.es);
  }
  // Limits unter dem Balken (Annahmen).
  if (limsEl) {
    const limLabel = (absNum, relNum) => {
      const p  = mode === 'rel' ? fR(relNum) : fA(absNum);
      const sv = mode === 'rel' ? fA(absNum) : fR(relNum);
      return `${p} <span class="mkt-scale-lim-sec">(${sv})</span>`;
    };
    const warnAbs = s.vr.abs;                                            // Warn = VaR
    const limitAbs = Number.isFinite(s.es.abs) ? s.es.abs * 1.2 : NaN;   // Limit = 1,2 x ES
    limsEl.innerHTML =
      `<span class="mkt-scale-lim-cap">Limits:</span>` +
      `<span class="mkt-scale-lim-warn" style="${posStyle(yr)}" title="Warning (assumed = VaR)">${limLabel(warnAbs, warn)}</span>` +
      `<span title="Limit (assumed 1.2 &times; ES)">${limLabel(limitAbs, limit)}</span>`;
  }
  setText(ids.ec, fR(ecR));
  // Labels in der Kachel halten (ResizeObserver, da Overview evtl. erst spaeter sichtbar/breit).
  if (valsEl && !valsEl._decObs && typeof ResizeObserver !== 'undefined') {
    valsEl._decObs = new ResizeObserver(() => clampLabelsInsideTile(valsEl));
    valsEl._decObs.observe(valsEl);
  }
  clampLabelsInsideTile(valsEl);
}

// ids-Saetze fuer die beiden Economic-Capital-Schieber (Historic + Market adjusted).
const CR_SCALE_HIST = { track: 'homeCrScaleTrack', vals: 'homeCrScaleVals', lims: 'homeCrScaleLimits', ecBar: 'homeCrScaleEcBar', ec: 'homeCrScaleEc' };
const CR_SCALE_MADJ = { track: 'homeCrScaleMTrack', vals: 'homeCrScaleMVals', lims: 'homeCrScaleMLimits', ecBar: 'homeCrScaleMEcBar', ec: 'homeCrScaleMEc' };
function renderCreditScales(port) {
  renderCreditScale(port, CR_SCALE_HIST, 'PD', 'RATING');
  renderCreditScale(port, CR_SCALE_MADJ, 'PD_M_norm', 'NORM');
}

function renderCreditCard(port) {
  setText('homeCrPort', port ? `· ${port}` : '');
  const rows = (appState.getAllCvarData?.() || []).filter((r) => normPort(r?.port_name) === port);

  if (!rows.length) {
    ['homeCrVar', 'homeCrVarAbs', 'homeCrEs', 'homeCrEsAbs',
     'homeCrEcElHAbs', 'homeCrEcElHRel', 'homeCrEcElMAbs', 'homeCrEcElMRel',
     'homeCrEcEdeHAbs', 'homeCrEcEdeHRel', 'homeCrEcEdeMAbs', 'homeCrEcEdeMRel',
     'homeCrEcVarHAbs', 'homeCrEcVarHRel', 'homeCrEcVarMAbs', 'homeCrEcVarMRel',
     'homeCrEcEcHAbs', 'homeCrEcEcHRel', 'homeCrEcEcMAbs', 'homeCrEcEcMRel',
     'homeCrSumElAbs', 'homeCrSumElRel', 'homeCrSumVarAbs', 'homeCrSumVarRel',
     'homeCrSumEcAbs', 'homeCrSumEcRel',
     'homeCrSumMElAbs', 'homeCrSumMElRel', 'homeCrSumMVarAbs', 'homeCrSumMVarRel',
     'homeCrSumMEcAbs', 'homeCrSumMEcRel'].forEach((id) => setText(id, '–'));
    ['homeCrVarDot', 'homeCrEsDot'].forEach((id) => setDot(id, null));
    updateCreditRiskSliders({ msd: { value: null, scaleMax: null } });
    renderConcentrationRisk(null);
    renderConcentrationScore(null);
    renderCreditExecSummary(null, null);
    try { renderCreditScales(port); } catch (_) {}
    destroyChart('homeCrChart');
    return false;
  }

  // Kennzahlen 1:1 aus dem Credit-Risk-Dashboard (gleiches Modell, gleiche
  // Formatierung/Ampeln), gefuettert mit den CVaR-Zeilen des Overview-
  // Portfolios: Hero = VaR, Tiles = ES / TSI / MSD.
  const [kVar, kEs, kTsi, kMsd] = getCreditDashboardModel(rows).cards;
  setText('homeCrVar', kVar.rel);
  setDot('homeCrVarDot', kVar.state);
  setText('homeCrVarAbs', kVar.abs);
  setText('homeCrEs', kEs.rel);
  setDot('homeCrEsDot', kEs.state);
  setText('homeCrEsAbs', kEs.abs);
  // Concentration Risk (TCM) + Market Stress (MSD): TCM-Balken aus den Tail-Loss-/EAD-Anteilen,
  // MSD weiterhin als Ampel-Slider (Marke = Wert, Zonen aus den echten Schwellen).
  updateCreditRiskSliders({ msd: _creditSliderCfg(kMsd) });
  renderConcentrationRisk(port);
  renderConcentrationScore(port);

  // Economic Capital: EL/EDE/VaR/EC je Historic (PD/RATING) + Current (PD_M_norm/NORM). Grosse
  // Zahl abs oder rel je Customer-Setup-Umschalter (gleiche Keys wie im Panel).
  // Economic Capital: getrennte Kacheln Historic (PD/RATING) + Market adjusted (PD_M_norm/NORM),
  // je 3-zeilig (Name / abs / rel).
  const ecH = creditEcSet(port, 'PD', 'RATING');
  const ecC = creditEcSet(port, 'PD_M_norm', 'NORM');
  renderCreditExecSummary(port, ecH);   // Executive Summary aus den Historic-EC-Werten
  const fAbs = (x) => Number.isFinite(x) ? fmtEur(x) : '–';
  const fRel = (x) => Number.isFinite(x) ? `${(x * 100).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '–';
  const setEc = (base, o) => { setText(base + 'Abs', fAbs(o.abs)); setText(base + 'Rel', fRel(o.rel)); };
  setEc('homeCrEcElH',  ecH.el);  setEc('homeCrEcElM',  ecC.el);
  setEc('homeCrEcEdeH', ecH.ede); setEc('homeCrEcEdeM', ecC.ede);
  setEc('homeCrEcVarH', ecH.vr);  setEc('homeCrEcVarM', ecC.vr);
  setEc('homeCrEcEcH',  ecH.ec);  setEc('homeCrEcEcM',  ecC.ec);
  // Zusammenfassungs-Kacheln (EL / EC / VaR nebeneinander): Historic + Market adjusted.
  setEc('homeCrSumEl',  ecH.el);
  setEc('homeCrSumVar', ecH.vr);
  setEc('homeCrSumEc',  ecH.ec);
  setEc('homeCrSumMEl',  ecC.el);
  setEc('homeCrSumMVar', ecC.vr);
  setEc('homeCrSumMEc',  ecC.ec);
  try { renderCreditScales(port); } catch (e) { console.warn('[home] credit scale', e); }

  // Mini-Bar: Top tail drivers (Historic) — wie im Credit-Risk-Dashboard.
  const top = crTailTopIssuers(port);
  if (top.length) {
    // Balkenfarbe = Icon-Farbe der Karte (Credit-Badge, violett).
    // Label zweizeilig: Issuer, darunter Rating (falls vorhanden).
    drawMiniHBar(
      'homeCrChart',
      top.map((t) => (t.rating ? [t.name, t.rating] : t.name)),
      top.map((t) => +t.pct.toFixed(1)),
      'rgba(122, 92, 145, 0.9)',
      { fmtValue: (v) => `${fmtNum(Number(v), 0)}%`, fmtTip: (v) => ` ${fmtNum(Number(v), 1)} %` },
    );
  } else {
    destroyChart('homeCrChart');
  }
  return true;
}

// --- Report-Spiegel (Preview/PDF) --------------------------------------------
// Verstecktes Sub-Panel #panel-overview: discoverPanels() im REPORTS-Modul
// findet es dokumentweit und bietet die Overview damit als Report-Sektion an —
// KPIs als Tabelle (.data-container -> autoTable im PDF), Charts als 1:1-
// Bitmap-Kopien der Live-Canvases. Befuellung bei jedem renderHomeOverview().
const _escHtml = (s) => String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function syncHomeReportPanel(port) {
  let panel = document.getElementById('panel-overview');
  if (!panel) {
    const host = document.getElementById('HOME_Modal');
    if (!host) return;
    panel = document.createElement('div');
    panel.id = 'panel-overview';
    panel.className = 'sub-panel';
    panel.hidden = true;
    panel.innerHTML = `
      <div class="sub-panel-body">
        <div class="data-container" id="overviewKpiTable" data-label="Overview — KPIs"></div>
        <canvas id="homePfChartR" data-label="Portfolio — largest issuers (% of notional)"></canvas>
        <canvas id="homeMktChartR" data-label="Market Risk — top product contributions"></canvas>
        <canvas id="homeCrChartR" data-label="Credit Risk — top tail drivers"></canvas>
      </div>`;
    host.appendChild(panel);
  }
  // Report-Sektionstitel explizit setzen. Sonst leitet getSectionTitleFromPanel() aus
  // der id "panel-overview" nur "Overview" (Title-Case) ab; der Nav-Trigger hat kein
  // CSS-uppercase und zeigt es dann klein statt wie die anderen Roots GROSS.
  panel.dataset.title = 'OVERVIEW';

  const txt = (id) => document.getElementById(id)?.textContent?.trim() || '–';
  const rows = [
    ['Portfolio', port],
    ['Notional', txt('homePfNotional')],
    ['Net Asset Value', txt('homePfNav')],
    ['Yield', txt('homePfYield')],
    ['Market — Normal Risk (VaR)', `${txt('homeMktVar')}  (${txt('homeMktVarAbs')})`],
    ['Market — Extreme Risk (ES)', `${txt('homeMktEs')}  (${txt('homeMktEsAbs')})`],
    ['Market — VaR (Stressed)', `${txt('homeMktRollVar')}  (${txt('homeMktRollVarAbs')})`],
    ['Market — ES (Stressed)', `${txt('homeMktRollEs')}  (${txt('homeMktRollEsAbs')})`],
    ['Credit — Normal Risk (VaR)', `${txt('homeCrVar')}  (${txt('homeCrVarAbs')})`],
    ['Credit — Extreme Risk (ES)', `${txt('homeCrEs')}  (${txt('homeCrEsAbs')})`],
    ['Credit — Concentration Risk', txt('crConcSub')],
    ['Credit — Market Stress (MSD)', txt('msdMarkerVal')],
  ];
  const tbl = document.getElementById('overviewKpiTable');
  if (tbl) {
    tbl.innerHTML = `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
      rows.map(([k, v]) => `<tr><td>${_escHtml(k)}</td><td>${_escHtml(v)}</td></tr>`).join('')
    }</tbody></table>`;
  }

  [['homePfChart', 'homePfChartR'], ['homeMktChart', 'homeMktChartR'], ['homeCrChart', 'homeCrChartR']]
    .forEach(([srcId, dstId]) => {
      const src = document.getElementById(srcId);
      const dst = document.getElementById(dstId);
      if (!dst) return;
      // Live-Canvas leer (z.B. Chart zerstoert)? Letzte gute Kopie behalten.
      if (!src || !src.width || !src.height) return;
      dst.width = src.width;
      dst.height = src.height;
      try { dst.getContext('2d').drawImage(src, 0, 0); } catch (_) {}
    });
}

// --- Haftungsausschluss-Gate (Boot) ------------------------------------------
// Liegt beim Start ueber der App (#disclaimerGate, index.html). "Weiter" wird
// erst freigegeben, wenn (a) die Portfolio-Daten aus dem Boot-Load im Store
// liegen (Fallback nach 30 s, damit der Nutzer bei leerer DB nicht ausgesperrt
// ist) UND (b) die "Ich stimme zu"-Checkbox angehakt ist.
export function initHomeDisclaimer() {
  const gate = document.getElementById('disclaimerGate');
  const btn = document.getElementById('disclaimerOkBtn');
  const status = document.getElementById('disclaimerStatus');
  const agree = document.getElementById('disclaimerAgree');
  if (!gate || !btn) return;

  btn.addEventListener('click', () => { gate.hidden = true; });

  const t0 = Date.now();
  let dataReady = false;
  let readyMsg = '';

  const sync = () => {
    const agreed = !agree || agree.checked;
    btn.disabled = !(dataReady && agreed);
    if (status && dataReady) {
      status.textContent = agreed ? readyMsg : `${readyMsg} Bitte zustimmen.`;
    }
    if (!btn.disabled) btn.focus();
  };
  agree?.addEventListener('change', sync);

  const enable = (msg) => { dataReady = true; readyMsg = msg; sync(); };
  (function poll() {
    if (gate.hidden) return;
    if ((appState?.getAllPortfolioData?.() || []).length > 0) {
      enable('Portfolio geladen.');
      return;
    }
    if (Date.now() - t0 > 30000) {
      enable('Keine Portfoliodaten geladen.');
      return;
    }
    setTimeout(poll, 300);
  })();
}

// --- Einstieg ---------------------------------------------------------------

// Icon-Klicks (Karten-Badges) -> zugehoerigen Bereich der App oeffnen:
// Portfolio = PORTFOLIO-Tab, Market/Credit = RISK-Tab + Dashboard-Trigger
// (echter Button-Klick, damit bootstrapTriggers/Hooks greifen; Trigger-Baum
// wird dabei aufgeklappt). Delegiert am Dokument gebunden (einmalig), damit
// die Links nach jedem Re-Render/Tab-Wechsel sicher funktionieren.
function bindHomeCardLinks() {
  if (document.body.dataset.homeLinksBound) return;
  document.body.dataset.homeLinksBound = '1';

  // Trigger-Baum aufklappen (alle UEBERGEORDNETEN Gruppen; die eigene toggelt
  // der Klick selbst) und Panel oeffnen; Endzustand der eigenen Gruppe = offen.
  const openPanelViaTrigger = (panelId) => {
    const trig = document.querySelector(`.section-trigger[data-panel="${panelId}"]`);
    if (!trig) return;
    let acc = trig.closest('.risk-acc')?.parentElement?.closest?.('.risk-acc');
    while (acc) {
      acc.classList.add('is-expanded');
      acc.querySelector('.risk-acc-toggle')?.setAttribute('aria-expanded', 'true');
      acc = acc.parentElement?.closest?.('.risk-acc');
    }
    trig.click();
    requestAnimationFrame(() => {
      trig.closest('.risk-acc')?.classList.add('is-expanded');
      trig.setAttribute('aria-expanded', 'true');
    });
  };

  // Zwei Frames warten: erst Tab-/Modal-Umschaltung rendern lassen, dann Panel oeffnen.
  // WICHTIG: War im Ziel-Tab bereits ein Sub-Panel offen (z.B. Breakdown), wird es
  // beim Tab-Wechsel OHNE Open-Event einfach wieder sichtbar — inkl. alter Scroll-
  // Position. Daher hier alle offenen Sub-Panels auf "oben" zuruecksetzen.
  const tabThenPanel = (tabId, panelId, then) => {
    document.getElementById(tabId)?.click();
    requestAnimationFrame(() => requestAnimationFrame(() => {
      try {
        document.querySelectorAll('.sub-panel.open').forEach((p) => {
          p.scrollTop = 0;
          p.querySelectorAll('.sub-panel-body').forEach((el) => { el.scrollTop = 0; });
        });
        if (document.scrollingElement) document.scrollingElement.scrollTop = 0;
      } catch (_) {}
      if (panelId) {
        // Selbstheilendes Oeffnen: der Tab-Wechsel rendert synchron die Overview neu
        // (showHomeBehind -> renderHomeOverview) und kann das verzoegerte Oeffnen
        // "verschlucken" -> Panel bekommt/haelt sein .open nicht (intermittierend,
        // v.a. beim Zurueckspringen auf Overview). Daher oeffnen UND ueber wenige
        // Frames pruefen, ob .open wirklich blieb; sonst erneut oeffnen. openPanel
        // ist idempotent, das Nachfassen ist also risikoarm.
        const ensureOpen = (tries) => {
          openPanelViaTrigger(panelId);
          const panel = document.getElementById(panelId);
          if (tries > 0 && !(panel && panel.classList.contains('open'))) {
            requestAnimationFrame(() => ensureOpen(tries - 1));
          } else if (then) {
            requestAnimationFrame(then);
          }
        };
        ensureOpen(3);
      } else if (then) {
        requestAnimationFrame(then);
      }
    }));
  };

  // Overview-Slider -> Portfolio-Ansicht, Sensitivities-Panel oeffnen und den
  // passenden Tab (PV01/CPV01) aktivieren.
  const openSensitivity = (sensTab) => tabThenPanel('ANALYSE_Tab', 'panel-sensitivities', () => {
    const t = document.querySelector(`#panel-sensitivities [data-sens-tab="${sensTab}"]`);
    if (t) t.click();
  });

  const ACTIONS = {
    homePfIco: () => tabThenPanel('ANALYSE_Tab', null),
    homeMktIco: () => tabThenPanel('RISK_Tab', 'panel-market-dashboard'),
    homeCrIco: () => tabThenPanel('RISK_Tab', 'panel-credit-dashboard'),
  };

  const run = (e) => {
    const ico = e.target.closest?.('.home-ico--link');
    if (ico && ACTIONS[ico.id]) { e.preventDefault(); ACTIONS[ico.id](); return; }
    // Klick auf einen Overview-Slider (nur die Overview-Instanz #homeRiskSliders):
    // Interest Rate Duration -> Sensitivities/PV01, Credit Spread Duration -> CPV01.
    if (e.target.closest?.('#homeRiskSliders')) {
      if (e.target.closest?.('.rs-card--ir')) { e.preventDefault(); openSensitivity('pv01'); return; }
      if (e.target.closest?.('.rs-card--cs')) { e.preventDefault(); openSensitivity('cpv01'); return; }
    }
    // Credit-Slider (Overview) -> Risk-Ansicht, TSI/MSD-Panel oeffnen.
    if (e.target.closest?.('#homeCreditSliders')) {
      if (e.target.closest?.('.rs-card--conc')) { e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-credit'); return; }
      if (e.target.closest?.('.rs-card--msd')) { e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-credit-msd'); return; }
    }
    // Credit-Kacheln Normal/Extreme Risk -> Credit Risk / Profit/Loss.
    const crTile = e.target.closest?.('.home-kpi[data-tile="cr_var"], .home-kpi[data-tile="cr_es"]');
    if (crTile) { e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-credit'); return; }
    // Market-Kacheln (Current + Stressed KPIs) UND Vergleichsbloecke (NORMAL/EXTREME RISK)
    // -> Market Risk / Profit/Loss.
    const mktTile = e.target.closest?.('.home-kpi[data-tile^="mkt_"], .mkt-cmp[data-tile^="mkt_cmp_"]');
    if (mktTile) { e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-market'); return; }
    // Sensitivitaets-Kacheln (PV01/CPV01/Vega) -> Sensitivities-Panel + passender Tab,
    // analog zu den Duration-Slidern (data-tile == data-sens-tab).
    const sensTile = e.target.closest?.('.home-kpi[data-tile="pv01"], .home-kpi[data-tile="cpv01"], .home-kpi[data-tile="vega"]');
    if (sensTile) { e.preventDefault(); openSensitivity(sensTile.dataset.tile); return; }
    // Market-Chart "Top product contributions" -> Market Risk / Products.
    if (e.target.closest?.('.home-chart-card[data-tile="mkt_chart"]')) {
      e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-mvar-products'); return;
    }
    // Backtest-Kopie -> Portfolio-Backtest-Panel.
    if (e.target.closest?.('.home-chart-card[data-tile="mkt_backtest"]')) {
      e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-portfolio-backtest'); return;
    }
    // Kachel-Navigation: Notional/NAV -> Portfolio-Panel (Tabelle + 2 Summaries),
    // Yield -> Yield-Panel. Ziel steckt in data-nav-panel.
    const nav = e.target.closest?.('.home-nav-link');
    if (nav?.dataset?.navPanel) { e.preventDefault(); tabThenPanel('ANALYSE_Tab', nav.dataset.navPanel); return; }
  };
  document.addEventListener('click', run);
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') run(e);
  });
}

export function renderHomeOverview() {
  const modal = document.getElementById('HOME_Modal');
  if (!modal) return;

  bindHomeCardLinks();

  // Immer das unter "Select Portfolio" gewaehlte Portfolio anzeigen — beim Boot
  // ist das der Default (das Dropdown initialisiert sich mit dem Default-Portfolio).
  const port = normPort(appState.getSelectedPortTableName?.() || appState.getDefaultPortfolio?.());

  if (!port) {
    setText('homeAsOf', 'No portfolio selected.');
    showEl('homeEmptyHint', true);
    renderPortfolioCard('');
    renderMarketCard('');
    renderCreditCard('');
    return;
  }

  showEl('homeEmptyHint', false);

  let asOf = null;
  try { renderPortfolioCard(port); } catch (e) { console.warn('[home] portfolio card', e); }
  try { asOf = renderMarketCard(port); } catch (e) { console.warn('[home] market card', e); }
  try { renderCreditCard(port); } catch (e) { console.warn('[home] credit card', e); }

  setText('homeAsOf', `Portfolio: ${port}${asOf ? `  ·  as of ${asOf}` : ''}`);

  // Report-Spiegel (Preview/PDF) mit den frisch gerenderten Werten befuellen.
  try { syncHomeReportPanel(port); } catch (e) { console.warn('[home] report panel sync', e); }

  // Hide the Overview "Portfolio" tiles the customer deselected (Customer Setup).
  try { applyOverviewTileVisibility(); } catch (e) { console.warn('[home] tile visibility', e); }
}
