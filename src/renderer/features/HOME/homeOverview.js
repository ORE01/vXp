// src/renderer/features/HOME/homeOverview.js
//
// Home / Landing "Financial Risk Management Overview".
// Drei Karten (Portfolio / Marktrisiko / Kreditrisiko) fuer das DEFAULT-Portfolio.
//
// Datenquelle: NUR die bereits beim Boot gefuellten Stores (letzter gespeicherter
// Stand) -> kein IPC, kein Python, kein Rechnen. Wird beim Boot, beim Oeffnen des
// OVERVIEW-Tabs und nach relevanten Table-Updates (dataRouter) neu gerendert.

import { appState } from '../../renderer.js';
import { enrichPortfolioRowsWithRisk } from '../portfolio/shared/portfolioRiskEnrichment.js';
import { buildPositionLoss, getRunConfQuantil } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/LossIssuer.js';
import { crTailTopForFlag, getCreditDashboardModel } from '../ANALYSE_PORTFOLIO/CREDIT_RISK/creditRiskDashboard.js';
import { getMvarRowAsofDate, getMvarRowScenarioName, normalizeMvarText } from '../ANALYSE_PORTFOLIO/marketRisk/mvar/mvarSelectors.js';
import { getMarketDashboardModel } from '../ANALYSE_PORTFOLIO/marketRisk/marketRiskDashboard.js';

// canvasId -> Chart-Instanz (fuer sauberes Neuzeichnen)
const _charts = Object.create(null);

// --- Formatierung -----------------------------------------------------------
const numOf = (v) => {
  if (v == null || v === '') return NaN;
  const n = parseFloat(String(v).replace(/[^\d.\-]/g, ''));
  return Number.isFinite(n) ? n : NaN;
};

function fmtEur(v) {
  if (!Number.isFinite(v)) return '–';
  const a = Math.abs(v);
  const sign = v < 0 ? '-' : '';
  if (a >= 1e6) return `${sign}EUR ${(a / 1e6).toLocaleString('en-US', { maximumFractionDigits: 1 })} Mio.`;
  if (a >= 1e3) return `${sign}EUR ${(a / 1e3).toLocaleString('en-US', { maximumFractionDigits: 1 })} k`;
  return `${sign}EUR ${a.toFixed(0)}`;
}
const fmtPctRaw = (v) => Number.isFinite(v) ? `${v.toFixed(2)} %` : '–';       // Wert ist bereits Prozent (Market)
const fmtNum = (v, d = 2) => Number.isFinite(v) ? v.toFixed(d) : '–';

const normPort = (s) => String(s ?? '').replace(/^Portfolios[_-]?/i, '').trim().toUpperCase();
const setText = (id, txt) => { const el = document.getElementById(id); if (el) el.textContent = txt; };
const showEl = (id, show) => { const el = document.getElementById(id); if (el) el.hidden = !show; };

// Ampel-Punkt (mr-amp-dot, Styles aus breakdown.css) setzen/verstecken.
function setDot(id, state) {
  const el = document.getElementById(id);
  if (!el) return;
  el.classList.remove('mr-amp--green', 'mr-amp--yellow', 'mr-amp--red', 'mr-amp--neutral');
  if (state) el.classList.add(`mr-amp--${state}`);
  el.hidden = !state;
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
  const fv = fmtValue || ((v) => `${Number(v).toFixed(2)}%`);
  const ft = fmtTip || ((v) => ` ${Number(v).toFixed(3)} %`);
  const fk = fmtTick || ((v) => `${v}%`);
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
    ['homePfNotional', 'homePfNav', 'homePfYield', 'homePfPv01', 'homePfCpv01'].forEach((id) => setText(id, '–'));
    destroyChart('homePfChart');
    return false;
  }

  const enriched = enrichPortfolioRowsWithRisk(rows, port);

  let notional = 0, nav = 0, yieldW = 0, pv01Base = 0, cpv01Base = 0;
  const byIssuer = new Map();
  for (const r of enriched) {
    const n = numOf(r.NOTIONAL);
    notional += Number.isFinite(n) ? n : 0;
    nav += numOf(r.NAV) || 0;
    yieldW += numOf(r.ytmPortA) || 0;
    pv01Base += Number(r.PV01_BASE) || 0;
    cpv01Base += Number(r.CPV01_BASE) || 0;
    const iss = String(r.ISSUER ?? '–').trim() || '–';
    byIssuer.set(iss, (byIssuer.get(iss) || 0) + (Number.isFinite(n) ? n : 0));
  }

  setText('homePfNotional', fmtEur(notional));
  setText('homePfNav', fmtEur(nav));
  // Portfolio-Yield exakt wie das Performance-Dashboard ("Portfolio Yield"):
  // RETURN (Fraktion, Basis PRICE_BUY) der juengsten PortfolioHistory-Zeile.
  // Fallback (keine History): Summe ytmPortA / Notional.
  const hist = (appState.getPortfolioHistoryData?.() || [])
    .filter((r) => normPort(r?.port_name) === port)
    .sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
  const ret = Number(hist[hist.length - 1]?.RETURN);
  setText('homePfYield', Number.isFinite(ret)
    ? fmtPctRaw(ret * 100)
    : (notional ? fmtPctRaw((yieldW / notional) * 100) : '–'));
  setText('homePfPv01', notional ? fmtNum((pv01Base / notional) * 10000) : '–');
  setText('homePfCpv01', notional ? fmtNum((cpv01Base / notional) * 10000) : '–');

  // Mini-Bar (horizontal): groesste Issuer in % vom Gesamt-Notional (Top 4) —
  // Balkenfarbe = Icon-Farbe der Karte (Portfolio-Badge, blau).
  const top = [...byIssuer.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4);
  drawMiniHBar(
    'homePfChart',
    top.map((e) => e[0]),
    top.map((e) => (notional ? +(e[1] / notional * 100).toFixed(1) : 0)),
    'rgba(108, 155, 209, 0.9)',
    { fmtValue: (v) => `${Number(v).toFixed(1)}%`, fmtTip: (v) => ` ${Number(v).toFixed(1)} % of notional` },
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
        fmtValue: (v) => `${Number(v).toFixed(1)}%`,
        fmtTip: (v) => ` ${Number(v).toFixed(1)} % of total VaR`,
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
    ['homeCrVar', 'homeCrVarRel', 'homeCrEs', 'homeCrEsAbs', 'homeCrTsi', 'homeCrMsd'].forEach((id) => setText(id, '–'));
    ['homeCrVarDot', 'homeCrEsDot', 'homeCrTsiDot', 'homeCrMsdDot'].forEach((id) => setDot(id, null));
    ['homeCrTsi', 'homeCrMsd'].forEach((id) => { const el = document.getElementById(id); if (el) el.style.color = ''; });
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
  // Cluster Risk (TSI) + Market Stress (MSD): Zeile 1 = Titel (fett/hell) +
  // Einstufung LOW/MEDIUM/HIGH in Ampelfarbe + Ampel-Punkt; Zeile 2 = Limit
  // (Rot-Schwelle aus dem Customer Setup, via Dashboard-Limit-Modell) +
  // aktueller Wert daneben.
  const RISK_WORD = { green: 'LOW', yellow: 'MEDIUM', red: 'HIGH' };
  const AMP_COLOR = { green: '#4CAF50', yellow: '#E0B000', red: '#D32F2F' };
  const setRiskWord = (valId, k) => {
    setText(valId, RISK_WORD[k.state] || '–');
    const el = document.getElementById(valId);
    if (el) el.style.color = AMP_COLOR[k.state] || '';
  };
  setRiskWord('homeCrTsi', kTsi);
  setDot('homeCrTsiDot', kTsi.state);
  setRiskWord('homeCrMsd', kMsd);
  setDot('homeCrMsdDot', kMsd.state);

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
      { fmtValue: (v) => `${Number(v).toFixed(0)}%`, fmtTip: (v) => ` ${Number(v).toFixed(1)} %` },
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
    ['PV01 (bp)', txt('homePfPv01')],
    ['CPV01 (bp)', txt('homePfCpv01')],
    ['Market — Normal Risk (VaR)', `${txt('homeMktVar')}  (${txt('homeMktVarRel')})`],
    ['Market — Extreme Risk (ES)', `${txt('homeMktEs')}  (${txt('homeMktEsAbs')})`],
    [`Market — VaR ${txt('homeMktScenNameVar')}`, `${txt('homeMktRollVar')}  (${txt('homeMktRollVarAbs')})`],
    [`Market — ES ${txt('homeMktScenNameEs')}`, `${txt('homeMktRollEs')}  (${txt('homeMktRollEsAbs')})`],
    ['Credit — Normal Risk (VaR)', `${txt('homeCrVar')}  (${txt('homeCrVarRel')})`],
    ['Credit — Extreme Risk (ES)', `${txt('homeCrEs')}  (${txt('homeCrEsAbs')})`],
    ['Credit — Cluster Risk (TSI)', txt('homeCrTsi')],
    ['Credit — Market Stress (MSD)', txt('homeCrMsd')],
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
  const tabThenPanel = (tabId, panelId) => {
    document.getElementById(tabId)?.click();
    if (!panelId) return;
    requestAnimationFrame(() => requestAnimationFrame(() => openPanelViaTrigger(panelId)));
  };

  const ACTIONS = {
    homePfIco: () => tabThenPanel('ANALYSE_Tab', null),
    homeMktIco: () => tabThenPanel('RISK_Tab', 'panel-market-dashboard'),
    homeCrIco: () => tabThenPanel('RISK_Tab', 'panel-credit-dashboard'),
  };

  const run = (e) => {
    const ico = e.target.closest?.('.home-ico--link');
    if (!ico || !ACTIONS[ico.id]) return;
    e.preventDefault();
    ACTIONS[ico.id]();
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
}
