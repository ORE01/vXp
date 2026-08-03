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
import { buildPositionLoss, getRunConfQuantil } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js';
import { crTailTopForFlag, getCreditDashboardModel } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/creditRiskDashboard.js';
import { getMvarRowAsofDate, getMvarRowScenarioName, normalizeMvarText } from '../ANALYSE_PORTFOLIO/marketRisk/mvar/mvarSelectors.js';
import { getMarketDashboardModel } from '../ANALYSE_PORTFOLIO/marketRisk/marketRiskDashboard.js';
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
     'homePfVega', 'homePfVegaRel'].forEach((id) => setText(id, '–'));
    updateRiskSliders({ avgMat: null, irDur: null, csDur: null });
    destroyChart('homePfChart');
    return false;
  }

  const enriched = enrichPortfolioRowsWithRisk(rows, port);

  let notional = 0, nav = 0, navBuy = 0, yieldW = 0, pv01Base = 0, cpv01Base = 0, vegaBase = 0, ttmW = 0, notTtm = 0;
  let hasPv01 = false, hasCpv01 = false, hasVega = false;
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
    // Durchschnittliche Laufzeit (WAM): TtM nominal-gewichtet; bereits faellige
    // Positionen (TtM < 0) werden ausgeklammert.
    const ttm = numOf(r.TtM);
    if (ttm != null && ttm >= 0 && Number.isFinite(n)) { ttmW += ttm * n; notTtm += n; }
    const iss = String(r.ISSUER ?? '–').trim() || '–';
    byIssuer.set(iss, (byIssuer.get(iss) || 0) + (Number.isFinite(n) ? n : 0));
  }

  setText('homePfNotional', fmtEur(notional));
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

  // Risk-Slider: Ø-Maturity (WAM) als Skala, Marken = Zins-/Spread-Duration in Jahren:
  // abs(PV01)/NAV*10000 bzw. abs(CPV01)/NAV*10000.
  updateRiskSliders({
    avgMat: notTtm ? (ttmW / notTtm) : null,
    irDur: nav ? Math.abs(pv01Base) / nav * 10000 : null,
    csDur: nav ? Math.abs(cpv01Base) / nav * 10000 : null,
  });

  // Mini-Bar (horizontal): groesste Issuer in % vom Gesamt-Notional (Top 4) —
  // Balkenfarbe = Icon-Farbe der Karte (Portfolio-Badge, blau).
  const top = [...byIssuer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
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

function renderMarketCard(port) {
  setText('homeMktPort', port ? `· ${port}` : '');
  const rows = (appState.getAllMvarData?.() || []).filter((r) => normPort(r?.port_name) === port);
  const row = pickMvarRow(rows);

  if (!row) {
    ['homeMktVar', 'homeMktVarRel', 'homeMktEs', 'homeMktEsAbs',
     'homeMktRollVar', 'homeMktRollVarAbs', 'homeMktRollEs', 'homeMktRollEsAbs'].forEach((id) => setText(id, '–'));
    setDot('homeMktVarDot', null);
    setDot('homeMktEsDot', null);
    destroyChart('homeMktChart');
    return null;
  }

  // Reihe 1 (gross) = ROLLING_1 (der AKTUELLE Markt, ohne Szenario-Zusatz im Label),
  // Reihe 2 (Kaestchen) = das gewaehlte Stress-Szenario. Die Ampel in Reihe 1 ist
  // MARKET STRESS: Buffer = (|Szenario| - |Rolling|) / |Rolling| je Metrik —
  // 0% heisst "Markt auf Stress-Niveau"; unter 30% gelb, unter 10% rot.
  const model = getMarketDashboardModel(row);
  const [kMvar, kEs] = model.cards;

  const scenName = normalizeMvarText(getMvarRowScenarioName(row));
  const rollRow = (scenName !== 'ROLLING_1')
    ? rows
        .filter((r) => normalizeMvarText(getMvarRowScenarioName(r)) === 'ROLLING_1')
        .sort((a, b) => getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b)))
        .at(-1) || null
    : row;
  const stressRow = (scenName !== 'ROLLING_1') ? row : null;
  const [rVar, rEs] = rollRow ? getMarketDashboardModel(rollRow).cards : [null, null];

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
  setText('homeMktVarRel', `Normal Risk (VaR)  ·  ${rVar ? rVar.abs : '–'}`);
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
  return crTailTopForFlag('RATING', issuerLoss, issuerRating, allLoss, getRunConfQuantil()).slice(0, 4);
}

function renderCreditCard(port) {
  setText('homeCrPort', port ? `· ${port}` : '');
  const rows = (appState.getAllCvarData?.() || []).filter((r) => normPort(r?.port_name) === port);

  if (!rows.length) {
    ['homeCrVar', 'homeCrVarRel', 'homeCrEs', 'homeCrEsAbs'].forEach((id) => setText(id, '–'));
    ['homeCrVarDot', 'homeCrEsDot'].forEach((id) => setDot(id, null));
    updateCreditRiskSliders({ tsi: { value: null, scaleMax: null }, msd: { value: null, scaleMax: null } });
    destroyChart('homeCrChart');
    return false;
  }

  // Kennzahlen 1:1 aus dem Credit-Risk-Dashboard (gleiches Modell, gleiche
  // Formatierung/Ampeln), gefuettert mit den CVaR-Zeilen des Overview-
  // Portfolios: Hero = VaR, Tiles = ES / TSI / MSD.
  const [kVar, kEs, kTsi, kMsd] = getCreditDashboardModel(rows).cards;
  setText('homeCrVar', kVar.rel);
  setDot('homeCrVarDot', kVar.state);
  setText('homeCrVarRel', `Normal Risk (VaR)  ·  ${kVar.abs}`);
  setText('homeCrEs', kEs.rel);
  setDot('homeCrEsDot', kEs.state);
  setText('homeCrEsAbs', kEs.abs);
  // Cluster Risk (TSI) + Market Stress (MSD) jetzt als Ampel-Slider: Marke = Wert,
  // Zonen aus den echten Schwellen (grün/gelb/rot).
  updateCreditRiskSliders({ tsi: _creditSliderCfg(kTsi), msd: _creditSliderCfg(kMsd) });

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

  const txt = (id) => document.getElementById(id)?.textContent?.trim() || '–';
  const rows = [
    ['Portfolio', port],
    ['Notional', txt('homePfNotional')],
    ['Net Asset Value', txt('homePfNav')],
    ['Yield', txt('homePfYield')],
    ['Market — Normal Risk (VaR)', `${txt('homeMktVar')}  (${txt('homeMktVarRel')})`],
    ['Market — Extreme Risk (ES)', `${txt('homeMktEs')}  (${txt('homeMktEsAbs')})`],
    [`Market — VaR ${txt('homeMktScenNameVar')}`, `${txt('homeMktRollVar')}  (${txt('homeMktRollVarAbs')})`],
    [`Market — ES ${txt('homeMktScenNameEs')}`, `${txt('homeMktRollEs')}  (${txt('homeMktRollEsAbs')})`],
    ['Credit — Normal Risk (VaR)', `${txt('homeCrVar')}  (${txt('homeCrVarRel')})`],
    ['Credit — Extreme Risk (ES)', `${txt('homeCrEs')}  (${txt('homeCrEsAbs')})`],
    ['Credit — Cluster Risk (TSI)', txt('tsiMarkerVal')],
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
      if (e.target.closest?.('.rs-card--tsi')) { e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-credit-tsi'); return; }
      if (e.target.closest?.('.rs-card--msd')) { e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-credit-msd'); return; }
    }
    // Credit-Kacheln Normal/Extreme Risk -> Credit Risk / Profit/Loss.
    const crTile = e.target.closest?.('.home-kpi[data-tile="cr_var"], .home-kpi[data-tile="cr_es"]');
    if (crTile) { e.preventDefault(); tabThenPanel('RISK_Tab', 'panel-credit'); return; }
    // Sensitivitaets-Kacheln (PV01/CPV01/Vega) -> Sensitivities-Panel + passender Tab,
    // analog zu den Duration-Slidern (data-tile == data-sens-tab).
    const sensTile = e.target.closest?.('.home-kpi[data-tile="pv01"], .home-kpi[data-tile="cpv01"], .home-kpi[data-tile="vega"]');
    if (sensTile) { e.preventDefault(); openSensitivity(sensTile.dataset.tile); return; }
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
