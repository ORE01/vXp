// src/renderer/features/ANALYSE_PORTFOLIO/marketRisk/mvarFactorPLPanel.js

'use strict';

import { appState } from '../../../../renderer.js';
import { formatNumber, formatNumberWithCommas } from '../../../../utils/tableCellFormats.js';

import {
  getAvailableMvarPorts,
  getAvailableMvarScenarios,
  getCurrentMvarContext,
  getMvarRowAsofDate,
  normalizeMvarText,
  normalizePortfolioName,
  rowMatchesMvarContext,
} from './mvarSelectors.js';

import {
  buildDistributions,
  buildFactorRows,
  buildRiskTypeRows,
  buildRiskTypeCcyRows,
  buildFactorGroupProductContrib,
  toNumber,
} from './mvarTransforms.js';

import { createContribDrill, scheduleHideConcMenu, bindRightClickDrill } from '../../SummaryBreakdown.js';



function fmtAbs(value) {
  return formatNumber()(value);
}

function fmtRel(value) {
  return formatNumberWithCommas(value);
}



function getStoredRowsForCurrentContext() {
  const context = getCurrentMvarContext(appState);
  const { portName, scenarioName } = context;

  if (!portName) {
    return [];
  }

  const allRows = appState.getMvarFactorPLData?.() || [];

  if (!Array.isArray(allRows) || !allRows.length) {
    return [];
  }

  let filteredRows = allRows.filter(row =>
    rowMatchesMvarContext(row, context)
  );

  // Nur den JUENGSTEN asof-Stichtag behalten — wie das Aggregat (MarketVaR), das ebenfalls
  // die letzte Stichtags-Zeile nimmt. Sonst mischt die Faktor-Rekonstruktion mehrere
  // Rolling-Fenster (mehrere asof) und die Total-VaR wird ueberhoeht (z.B. 481,6 statt
  // 263,2 Tsd fuer ROLLING_1).
  {
    const asofOf = (r) => String(r?.asof_date ?? r?.ASOF_DATE ?? '').slice(0, 10);
    let latest = '';
    for (const r of filteredRows) { const d = asofOf(r); if (d && d > latest) latest = d; }
    if (latest) filteredRows = filteredRows.filter((r) => asofOf(r) === latest);
  }

  // console.log('[MVaR FactorPL] local context filter', {
  //   selectedPort: normalizePortfolioName(portName),
  //   selectedScenario: normalizeMvarText(scenarioName),
  //   allRows: allRows.length,
  //   filteredRows: filteredRows.length,
  //   availablePorts: getAvailableMvarPorts(allRows),
  //   availableScenarios: getAvailableMvarScenarios(allRows),
  //   sample: filteredRows[0] || allRows[0],
  // });

  // Diagnostic only: raw vs context-matched rows, with field-name variants so we can
  // tell whether the filter drops existing data (port/scenario field/spelling).
  // console.log('[MVAR FACTOR FILTER CHECK]', {
  //   selectedPort: appState.getSelectedPortTableName?.(),
  //   selectedScenario: appState.selectedMvarInterval,

  //   inputRowsCount: Array.isArray(allRows) ? allRows.length : null,
  //   matchedRowsCount: Array.isArray(filteredRows) ? filteredRows.length : null,

  //   sampleBeforeFilter: Array.isArray(allRows) ? allRows[0] : null,
  //   sampleAfterFilter: Array.isArray(filteredRows) ? filteredRows[0] : null,

  //   availablePorts: Array.isArray(allRows)
  //     ? [...new Set(allRows.map(r => r.PORT_NAME ?? r.portName ?? r.port_name ?? r.PORT).filter(Boolean))].slice(0, 20)
  //     : [],

  //   availableScenarios: Array.isArray(allRows)
  //     ? [...new Set(allRows.map(r =>
  //         r.SCENARIO_NAME ??
  //         r.scenarioName ??
  //         r.scenario_name ??
  //         r.INTERVAL_NAME ??
  //         r.interval_name
  //       ).filter(Boolean))].slice(0, 20)
  //     : [],
  // });

  return filteredRows;
}

function getLatestAggregateMvarRow() {
  const context = getCurrentMvarContext(appState);
  const { portName, scenarioName } = context;
  const allRows = appState.getAllMvarData?.() || [];

  if (!Array.isArray(allRows) || !allRows.length || !portName) {
    return null;
  }

  const matches = allRows.filter(row =>
    rowMatchesMvarContext(row, context)
  );

  if (!matches.length) {
    console.warn('[MVaR FactorPL] no aggregate row for denominator', {
      selectedPort: normalizePortfolioName(portName),
      selectedScenario: normalizeMvarText(scenarioName),
      allRows: allRows.length,
      availablePorts: getAvailableMvarPorts(allRows),
      availableScenarios: getAvailableMvarScenarios(allRows),
    });

    return null;
  }

  return matches
    .slice()
    .sort((a, b) =>
      getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b))
    )
    .at(-1) || null;
}


function getSelectedMvarInputRow() {
  const rows = appState.getMvarInputData?.() || appState.mvarInputData || [];

  if (!Array.isArray(rows) || !rows.length) {
    return null;
  }

  if (typeof appState.selectedMvarId === 'number') {
    const byId = rows.find(row =>
      Number(row.id) === Number(appState.selectedMvarId)
    );

    if (byId) {
      return byId;
    }
  }

  const { scenarioName } = getCurrentMvarContext(appState);

  if (scenarioName) {
    const byScenario = rows.find(row =>
      normalizeMvarText(row.INTERVAL_NAME ?? row.interval_name) ===
      normalizeMvarText(scenarioName)
    );

    if (byScenario) {
      return byScenario;
    }
  }

  return rows[0] || null;
}

function getConfidence() {
  const row = getSelectedMvarInputRow();

  const raw =
    row?.Confidence ??
    row?.confidence ??
    row?.CONFIDENCE ??
    0.99;

  const n = toNumber(raw, 0.99);

  if (n > 1) return n / 100;
  if (n > 0 && n < 1) return n;

  return 0.99;
}

function getHorizonDays() {
  const row = getSelectedMvarInputRow();

  const raw =
    row?.horizon_days ??
    row?.HORIZON_DAYS ??
    row?.VaR_Days ??
    row?.var_days ??
    row?.VAR_DAYS ??
    1;

  const n = toNumber(raw, 1);

  return Number.isFinite(n) && n > 0 ? n : 1;
}

function getRelativeScaleDenominator() {
  const row = getLatestAggregateMvarRow();

  if (!row) return null;

  const pairs = [
    ['VaR_T_abs', 'VaR_T_rel'],
    ['ES_T_abs', 'ES_T_rel'],
    ['VaR_IR_abs', 'VaR_IR_rel'],
    ['VaR_CS_abs', 'VaR_CS_rel'],
  ];

  for (const [absKey, relKey] of pairs) {
    const abs = toNumber(row?.[absKey], NaN);
    const rel = toNumber(row?.[relKey], NaN);

    if (Number.isFinite(abs) && Number.isFinite(rel) && rel !== 0) {
      return abs / rel;
    }
  }

  return null;
}

function renderTable(container, rows, columns, emptyText) {
  if (!container) return;

  container.innerHTML = '';

  if (!Array.isArray(rows) || rows.length === 0) {
    container.innerHTML = `<div class="empty-state">${emptyText}</div>`;
    return;
  }

  const table = document.createElement('table');
  table.classList.add('MVaRTable');

  const thead = document.createElement('thead');
  const headRow = document.createElement('tr');

  columns.forEach((col) => {
    const th = document.createElement('th');
    th.textContent = col.label;

    if (col.alignRight) {
      th.style.textAlign = 'right';
    }

    headRow.appendChild(th);
  });

  thead.appendChild(headRow);
  table.appendChild(thead);

  const tbody = document.createElement('tbody');

  rows.forEach((row) => {
    const tr = document.createElement('tr');

    columns.forEach((col) => {
      const td = document.createElement('td');
      const value = col.value(row);

      td.textContent = value ?? '';

      if (col.alignRight) {
        td.style.textAlign = 'right';
      }

      tr.appendChild(td);
    });

    tbody.appendChild(tr);
  });

  table.appendChild(tbody);
  container.appendChild(table);
}

function formatMaybeAbs(value) {
  return value == null ? '-' : fmtAbs(value);
}

function formatMaybeRel(value) {
  return value == null ? '-' : fmtRel(value);
}

// ===== Factors: Balken (VaR% + ES% je Faktor) + Scatter (VaR% vs ES%), KEIN Drill =====
// Faktoren sind keine Positionen und die Faktor-P&L-Daten haben kein prod_id -> kein
// Drill. Zwei Werte je Faktor = Beitrag zum VaR % und zum ES % (rel. zum Portfoliowert).
const _factorCharts = new Map();
function destroyFactorChart(id) { const c = _factorCharts.get(id); if (c) { try { c.destroy(); } catch {} _factorCharts.delete(id); } }

function buildFactorChartRows(groupRows, expShare) {
  return (Array.isArray(groupRows) ? groupRows : [])
    .filter(r => String(r.risk_type || '').toUpperCase() !== 'TOTAL' && String(r.factor_id || '').toUpperCase() !== 'TOTAL')
    .map(r => {
      const groupId = `${r.risk_type || ''}:${r.ccy || ''}`;
      return {
        label: String(r.factor_id || '-'),
        groupId,
        var_abs: toNumber(r.var_abs, 0),
        es_abs: toNumber(r.es_abs, 0),
        var_pct: r.var_rel != null ? +(Math.abs(toNumber(r.var_rel, 0)) * 100).toFixed(3) : 0,
        es_pct:  r.es_rel  != null ? +(Math.abs(toNumber(r.es_rel, 0))  * 100).toFixed(3) : 0,
        share_pct: +(((expShare && expShare.get(groupId)) || 0) * 100).toFixed(3),
      };
    });
}

// Exposure-Anteil je Faktor-Gruppe = Sum|VALUE_BASE| der Gruppe / Gesamt (PV01 fuer
// IR, CPV01 fuer CS). Dient als "Portfolioanteil"-x-Achse der Streudiagramme.
function groupExposureShares() {
  const port = normalizeFactorPort(appState.getSelectedPortTableName?.());
  const rows = (appState.getPortfolioRiskSensitivitiesData?.() || [])
    .filter(r => !port || normalizeFactorPort(r.PORT_NAME ?? r.port_name) === port);
  const exp = new Map();          // groupId -> Sum|VALUE_BASE|
  const totByType = new Map();    // "IR"/"CS" -> Sum|VALUE_BASE| (Normierung je Typ)
  for (const r of rows) {
    const rt = String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim();
    if (rt !== 'PV01' && rt !== 'CPV01') continue;
    const fid = String(r.RISK_FACTOR_ID ?? r.risk_factor_id ?? '').trim();
    const parts = fid.split(':');
    if (parts.length < 2) continue;
    const type = parts[0].toUpperCase();
    const groupId = `${type}:${parts[1].toUpperCase()}`;
    const val = Math.abs(toNumber(r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local, 0));
    exp.set(groupId, (exp.get(groupId) || 0) + val);
    totByType.set(type, (totByType.get(type) || 0) + val);
  }
  // Anteil INNERHALB des Risikotyps: IR-Gruppen / Sum(IR), CS-Gruppen / Sum(CS).
  const share = new Map();
  for (const [k, v] of exp) {
    const type = k.split(':')[0];
    const tot = totByType.get(type) || 1;
    share.set(k, v / tot);
  }
  return share;
}

// Metrik-Konfiguration: getrennte VaR-/ES-Bloecke (wie Issuers/Products).
const FVAR_CFG = { kind: 'var', absKey: 'var_abs', contribKey: 'var_pct', metric: 'VaR', barId: 'mvarFactorVarContribChart', scatterId: 'mvarFactorVarScatterChart' };
const FES_CFG  = { kind: 'es',  absKey: 'es_abs',  contribKey: 'es_pct',  metric: 'ES',  barId: 'mvarFactorEsContribChart',  scatterId: 'mvarFactorEsScatterChart' };

// ---- Faktor-Gruppe -> Produkte mit echtem Risikobeitrag (Component-VaR/ES) ----
// Ueber die gemeinsame conc-Drill-Engine, damit auch hier das Menue (Positions /
// By Category / By Rating / ...) und die Kennnummer-Stammdaten funktionieren.
function normalizeFactorPort(p) { return String(p ?? '').replace(/^Portfolios[_-]?/i, '').trim(); }
function buildTradeToProdMap() {
  const m = new Map();
  const deals = appState.getAllDealsData?.() || appState.getDealsData?.() || [];
  for (const d of deals) {
    const t = d?.TRADE_ID ?? d?.trade_id;
    const p = d?.PROD_ID ?? d?.prod_id;
    if (t != null && p != null) m.set(String(t), String(p));
  }
  return m;
}
function buildFactorProdBaseMap() {
  const m = new Map();
  for (const r of (appState.getAllPortfolioData?.() || [])) {
    const pid = r?.PROD_ID ?? r?.prod_id ?? r?.product_id;
    if (pid == null) continue;
    const k = String(pid);
    if (!m.has(k)) m.set(k, r);
  }
  return m;
}

// Getrennte Drill-Kontexte je Metrik (VaR/ES) fuer das Factors-Panel.
const factorDrill = createContribDrill({
  var: { detailId: 'mrFactorVarDetail', titleId: 'mrFactorVarDetailTitle', tableId: 'mrFactorVarDetailTable', closeId: 'mrFactorVarDetailClose', menuId: 'mrFactorVarCardMenu', valueType: '__VAR_CONTRIB', valueLabel: 'VaR contrib' },
  es:  { detailId: 'mrFactorEsDetail',  titleId: 'mrFactorEsDetailTitle',  tableId: 'mrFactorEsDetailTable',  closeId: 'mrFactorEsDetailClose',  menuId: 'mrFactorEsCardMenu',  valueType: '__ES_CONTRIB',  valueLabel: 'ES contrib' },
});

// Enrichte Drill-Rows fuer eine Faktor-Gruppe: Produkte + Portfolio-Felder +
// Component-VaR/ES (Magnitude, damit Sortierung/Gruppierung wie sonst). Gecacht je Gruppe.
let _factorGroupCache = new Map();
function prepareFactorGroupData(groupId) {
  if (_factorGroupCache.has(groupId)) return _factorGroupCache.get(groupId);
  const factorRows = getStoredRowsForCurrentContext();
  const port = normalizeFactorPort(appState.getSelectedPortTableName?.());
  const sensRows = (appState.getPortfolioRiskSensitivitiesData?.() || [])
    .filter(r => !port || normalizeFactorPort(r.PORT_NAME ?? r.port_name) === port);
  const tradeToProd = buildTradeToProdMap();
  const contrib = buildFactorGroupProductContrib({
    factorRows, sensRows, groupId, confidence: getConfidence(), horizonDays: getHorizonDays(), tradeToProd,
  });
  const baseMap = buildFactorProdBaseMap();
  const rows = [...contrib.entries()]
    .map(([prod, c]) => {
      const b = baseMap.get(String(prod)) || {};
      return { ...b, PROD_ID: String(prod), __VAR_CONTRIB: Math.abs(c.var_contrib), __ES_CONTRIB: Math.abs(c.es_contrib) };
    })
    .filter(r => r.__VAR_CONTRIB > 1e-9 || r.__ES_CONTRIB > 1e-9);
  _factorGroupCache.set(groupId, rows);
  return rows;
}

// Chart-Interaktion: Gruppe der gehoverten/geklickten Stelle bestimmen, deren Rows
// setzen und ueber die Engine Menue zeigen (hover) bzw. drillen (click).
function factorChartInteract(kind, action, evt, els, chartRows) {
  // Bei leerem Treffer NICHT verstecken (wie Issuers/Products) — sonst verschwindet
  // das Menue, sobald man ueber leere Canvas-Flaeche Richtung Menue faehrt. Das
  // Ausblenden regeln Canvas-mouseleave + Menue-mouseleave.
  if (!els || !els.length) return;
  const cr = chartRows[els[0].index];
  if (!cr) return;
  try { factorDrill.setData(prepareFactorGroupData(cr.groupId)); } catch { return; }
  // Ein Schritt der ALLE Rows matcht (die Daten sind bereits nur diese Gruppe).
  const steps = chartRows.map(r => ({ colKey: '__FGROUP', value: r.label, label: 'Factor group', match: () => true }));
  if (action === 'hover') factorDrill.hover(kind, evt, els, steps);
  else factorDrill.click(kind, els, steps);
}
function bindFactorCanvasLeave(canvas) {
  if (!canvas || canvas.dataset.facLeaveBound) return;
  canvas.dataset.facLeaveBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}

// Balken je Faktor-Gruppe (Top 15 nach Metrik): Exposure-Anteil % + Risikobeitrag %.
function renderFactorBar(rows, cfg) {
  const canvas = document.getElementById(cfg.barId);
  destroyFactorChart(cfg.barId);
  if (!canvas || !window.Chart) return;
  const chartRows = (rows || []).slice().sort((a, b) => Math.abs(b[cfg.absKey]) - Math.abs(a[cfg.absKey])).slice(0, 15);
  if (!chartRows.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  bindFactorCanvasLeave(canvas);
  const labels = chartRows.map(r => r.label);
  const sharePct = chartRows.map(r => r.share_pct);
  const contribPct = chartRows.map(r => r[cfg.contribKey]);
  canvas.width = 760; canvas.height = Math.max(300, chartRows.length * 26 + 70);
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels, datasets: [
      { label: 'Portfolio share (exposure)', data: sharePct, backgroundColor: 'rgba(88,121,160,0.85)', borderColor: 'rgba(88,121,160,0.85)', borderWidth: 1, maxBarThickness: 10 },
      { label: `Risk contribution (${cfg.metric})`, data: contribPct, backgroundColor: 'rgba(46,204,113,0.85)', borderColor: 'rgba(46,204,113,0.85)', borderWidth: 1, maxBarThickness: 10 },
    ] },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      // Drill per RECHTSKLICK (bindRightClickDrill unten).
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartColor, font: { family: chartFont } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.x).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%` }, grid: { color: 'rgba(128,128,128,0.15)' }, title: { display: true, text: `% exposure  /  % ${cfg.metric} contribution`, color: chartColor, font: { family: chartFont } } },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 10 } }, grid: { display: false } },
      },
    },
  });
  chart.$drillRows = chartRows;
  _factorCharts.set(cfg.barId, chart);
  bindRightClickDrill(canvas, () => _factorCharts.get(cfg.barId),
    (el, ch, e) => factorChartInteract(cfg.kind, 'hover', { native: e }, [el], ch.$drillRows || []));
}

// Streudiagramm je Faktor-Gruppe: x = Portfolioanteil (Exposure) %, y = Risikobeitrag %.
function renderFactorScatter(rows, cfg) {
  const canvas = document.getElementById(cfg.scatterId);
  destroyFactorChart(cfg.scatterId);
  if (!canvas || !window.Chart) return;
  const pts = (rows || []).map(r => ({ x: r.share_pct, y: r[cfg.contribKey], issuer: r.label, groupId: r.groupId }));
  if (!pts.length) { canvas.style.display = 'none'; return; }
  canvas.style.display = 'block';
  bindFactorCanvasLeave(canvas);
  const scRows = pts.map(p => ({ groupId: p.groupId, label: p.issuer }));
  const labelSet = new Set([...pts].sort((a, b) => b.y - a.y).slice(0, 8).map(p => p.issuer));
  const axMax = Math.ceil(Math.max(0.5, ...pts.map(p => Math.max(p.x, p.y))) * 1.1);
  canvas.width = 520; canvas.height = 400;
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'scatter',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: { datasets: [
      { type: 'line', label: 'proportional', data: [{ x: 0, y: 0 }, { x: axMax, y: axMax }], borderColor: 'rgba(150,165,185,0.7)', borderDash: [6, 6], borderWidth: 1.5, pointRadius: 0, fill: false, order: 2 },
      { label: 'Factor groups', data: pts, backgroundColor: 'rgba(46,88,130,0.75)', borderColor: 'rgba(46,88,130,0.9)', pointRadius: 6, pointHoverRadius: 7, order: 1 },
    ] },
    options: {
      responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      // Drill per RECHTSKLICK (bindRightClickDrill unten; nur die Punkte-Serie, datasetIndex 1).
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => `${ctx.raw?.issuer ?? ''}: exposure ${ctx.raw?.x}% / ${cfg.metric} ${ctx.raw?.y}%` } },
        datalabels: window.ChartDataLabels ? { align: 'right', anchor: 'center', offset: 6, color: chartColor, font: { family: chartFont, size: 10 }, formatter: (v) => (v && labelSet.has(v.issuer) ? v.issuer : '') } : undefined,
      },
      scales: {
        x: { beginAtZero: true, max: axMax, title: { display: true, text: 'Portfolio share % (exposure)', color: chartColor, font: { family: chartFont } }, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { beginAtZero: true, max: axMax, title: { display: true, text: `Risk contribution % (${cfg.metric})`, color: chartColor, font: { family: chartFont } }, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
      },
    },
  });
  chart.$drillRows = scRows;
  _factorCharts.set(cfg.scatterId, chart);
  bindRightClickDrill(canvas, () => _factorCharts.get(cfg.scatterId),
    (el, ch, e) => factorChartInteract(cfg.kind, 'hover', { native: e }, [el], ch.$drillRows || []),
    { datasetIndex: 1 });
}

// KPIs im Market-Risk-Dashboard-Kartenstil: MVaR / ES MVaR (Total gross, relativ) mit
// Zeilen fuer IR / CS / Vega darunter (relativ). Vega fehlt hier -> 0%.
// var_rel/es_rel sind bereits in Prozent-Einheiten (z.B. -0.2432 = -0.2432%) -> KEIN *100.
function relPct(v) {
  const n = Number(v);
  return Number.isFinite(n) ? `${n.toLocaleString('de-DE', { maximumFractionDigits: 4 })}%` : '–';
}
function renderFactorKpis(riskTypeRows) {
  const el = document.getElementById('mvarFactorKpi');
  if (!el) return;
  const byType = {};
  (Array.isArray(riskTypeRows) ? riskTypeRows : []).forEach(r => { byType[String(r.risk_type || '').toUpperCase()] = r; });
  // Erste KPI = Gesamt-VaR/ES ABSOLUT + relativ (wie in Products/Issuers), darunter die
  // IR/CS/Vega-Zerlegung (relativ).
  const card = (label, relKey, absKey) => {
    const T = byType.TOTAL || {};
    const line = (nm, r) => `<div class="mr-kpi-row-line"><span>${nm}</span><span>${r ? relPct(r[relKey]) : '0%'}</span></div>`;
    return `<div class="mr-kpi-card">
      <div class="mr-kpi-card__label">${label}</div>
      <div class="mr-kpi-card__value">${fmtAbs(Math.abs(Number(T[absKey]) || 0))} (${relPct(T[relKey])})</div>
      <div class="mr-kpi-card__rows">
        ${line('IR', byType.IR)}
        ${line('CS', byType.CS)}
        ${line('Vega', byType.VEGA)}
      </div>
    </div>`;
  };
  // Dritte Karte "Core reading": erklaert die Zerlegung + dynamische VaR-Formel.
  let coreCard = '';
  const dec = computeDecomposition(riskTypeRows, 'var_rel');
  if (dec) {
    const parts = dec.comp.map(c => `${c.pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`).join(' + ');
    const divPart = dec.div < 0 ? `- ${Math.abs(dec.div).toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%` : `+ ${dec.div.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`;
    coreCard = `<div class="mr-kpi-card mvar-core-card">
      <div class="mr-kpi-card__label">Core reading</div>
      <div class="mvar-core-text">IR and CS create gross risk contributions that can exceed 100%. Diversification is a benefit, not an additional risk driver.</div>
      <div class="mvar-core-text"><b>${parts} ${divPart} = 100.0%</b> Total VaR.</div>
      <div class="mvar-core-text">Therefore diversification is shown as a negative adjustment.</div>
    </div>`;
  }

  el.innerHTML = card('Total VaR', 'var_rel', 'var_abs') + card('Total ES', 'es_rel', 'es_abs') + coreCard;
}

// Datenmodell der Factor-KPIs (MVaR / ES MVaR, Total + IR/CS/Vega, relativ) fuer den
// PDF-Renderer (RiskPDF) — damit im Report dieselben Karten wie das Dashboard erscheinen.
export function getFactorKpiModel() {
  const { filteredRows, riskTypeRows } = getFactorComputation();
  if (!Array.isArray(filteredRows) || !filteredRows.length) return null;
  const byType = {};
  riskTypeRows.forEach(r => { byType[String(r.risk_type || '').toUpperCase()] = r; });
  const mk = (relKey) => {
    const T = byType.TOTAL || {};
    return {
      total: relPct(T[relKey]),
      rows: [['IR', byType.IR], ['CS', byType.CS], ['Vega', byType.VEGA]].map(([nm, r]) => ({ nm, v: r ? relPct(r[relKey]) : '0%' })),
    };
  };
  return { var: mk('var_rel'), es: mk('es_rel') };
}

// MVaRChart als Balken der Risikotyp-Summen: Total / IR / CS / Vega VaR. Nur Anzeige.
let _mvarFactorEntriesChart = null;
function renderFactorEntriesChart(riskTypeRows) {
  const canvas = document.getElementById('MVaRChart');
  if (!canvas) return;
  try { const ex = (window.Chart && window.Chart.getChart) ? window.Chart.getChart(canvas) : null; if (ex) ex.destroy(); } catch {}
  if (_mvarFactorEntriesChart) { try { _mvarFactorEntriesChart.destroy(); } catch {} _mvarFactorEntriesChart = null; }
  if (!window.Chart) return;
  const byType = {};
  (Array.isArray(riskTypeRows) ? riskTypeRows : []).forEach(r => { byType[String(r.risk_type || '').toUpperCase()] = r; });
  // Feste Reihenfolge; fehlende (z.B. Vega) = 0. Relative Werte (|rel|*100 = %).
  const spec = [['TOTAL', 'Total'], ['IR', 'IR'], ['CS', 'CS'], ['VEGA', 'Vega']];
  // rel bereits in Prozent-Einheiten -> KEIN *100.
  const varPct = spec.map(([t]) => +Math.abs(toNumber(byType[t]?.var_rel, 0)).toFixed(4));
  const esPct = spec.map(([t]) => +Math.abs(toNumber(byType[t]?.es_rel, 0)).toFixed(4));
  canvas.style.display = 'block';
  canvas.width = 520; canvas.height = 240;
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  _mvarFactorEntriesChart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    data: { labels: spec.map(([, l]) => l), datasets: [
      { label: 'VaR %', data: varPct, backgroundColor: 'rgba(46,204,113,0.85)', borderColor: 'rgba(46,204,113,0.85)', borderWidth: 1, maxBarThickness: 14 },
      { label: 'ES %',  data: esPct,  backgroundColor: 'rgba(224,176,0,0.85)',  borderColor: 'rgba(224,176,0,0.85)',  borderWidth: 1, maxBarThickness: 14 },
    ] },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      plugins: {
        legend: { display: true, position: 'top', labels: { color: chartColor, font: { family: chartFont } } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.dataset.label}: ${Number(ctx.parsed.x).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%` } },
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%` }, grid: { color: 'rgba(128,128,128,0.15)' }, title: { display: true, text: '% of portfolio value', color: chartColor, font: { family: chartFont } } },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 11 } }, grid: { display: false } },
      },
    },
  });
}

// Weisse vertikale Referenzlinie bei 100 % (Waterfall) — das Annotation-Plugin ist
// global aus, daher eigenes Inline-Plugin.
const _vline100Plugin = {
  id: 'vline100',
  afterDatasetsDraw(chart) {
    const sx = chart.scales?.x;
    const area = chart.chartArea;
    if (!sx || !area) return;
    const x = sx.getPixelForValue(100);
    const ctx = chart.ctx;
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,0.85)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(x, area.top);
    ctx.lineTo(x, area.bottom);
    ctx.stroke();
    ctx.restore();
  },
};

// LINKER Chart je Abschnitt: VaR% (bzw. ES%) je Risikotyp (Total/IR/CS/Vega).
// x = % of portfolio value. Reine Anzeige (kein Drill).
function renderRiskTypeBar(riskTypeRows, cfg) {
  const canvas = document.getElementById(cfg.canvasId);
  destroyFactorChart(cfg.canvasId);
  if (!canvas || !window.Chart) return;
  const byType = {};
  (Array.isArray(riskTypeRows) ? riskTypeRows : []).forEach(r => { byType[String(r.risk_type || '').toUpperCase()] = r; });
  const spec = [['TOTAL', 'Total'], ['IR', 'IR'], ['CS', 'CS'], ['VEGA', 'Vega']];
  // rel ist bereits in Prozent-Einheiten -> KEIN *100.
  const vals = spec.map(([t]) => +Math.abs(toNumber(byType[t]?.[cfg.relKey], 0)).toFixed(4));
  if (!vals.some(v => v > 0)) { canvas.style.display = 'none'; return; }
  // Total-Balken blau wie im Decomposition-Waterfall; Risikotypen in Metrik-Farbe.
  const barColors = spec.map(([t]) => (t === 'TOTAL' ? 'rgba(46,88,130,0.9)' : cfg.color));
  canvas.style.display = 'block';
  canvas.width = 520; canvas.height = 300;
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
    data: { labels: spec.map(([, l]) => l), datasets: [
      { label: `${cfg.metric} %`, data: vals, backgroundColor: barColors, borderColor: barColors, borderWidth: 1, maxBarThickness: 18 },
    ] },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      layout: { padding: { right: 56 } },
      plugins: {
        legend: { display: false },
        title: { display: !!cfg.title, text: cfg.title || '', color: chartColor, align: 'start', font: { family: chartFont, size: 13, weight: 'bold' } },
        subtitle: { display: !!cfg.subtitle, text: cfg.subtitle || '', color: 'rgba(150,160,175,0.9)', align: 'start', padding: { bottom: 8 }, font: { family: chartFont, size: 10 } },
        tooltip: { callbacks: { label: (ctx) => `${cfg.metric}: ${Number(ctx.parsed.x).toLocaleString('de-DE', { minimumFractionDigits: 3, maximumFractionDigits: 3 })}%` } },
        datalabels: window.ChartDataLabels ? { anchor: 'end', align: 'right', color: chartColor, font: { size: 10 }, formatter: (v) => (v ? `${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}%` : '') } : undefined,
      },
      scales: {
        x: { beginAtZero: true, ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 11 } }, grid: { display: false } },
      },
    },
  });
  _factorCharts.set(cfg.canvasId, chart);
}

// Standalone/Total-Beitraege + Diversifikation je Metrik (VaR/ES) berechnen.
// IR/CS/Vega = |typ_rel| / |total_rel| * 100 (>0). gross = Summe; div = 100 - gross
// (negativ, wenn gross > 100 -> Diversifikationsvorteil).
function computeDecomposition(riskTypeRows, relKey) {
  const byType = {};
  (Array.isArray(riskTypeRows) ? riskTypeRows : []).forEach(r => { byType[String(r.risk_type || '').toUpperCase()] = r; });
  const total = Math.abs(toNumber(byType.TOTAL?.[relKey], 0));
  if (!(total > 0)) return null;
  const comp = [['IR', 'IR'], ['CS', 'CS'], ['VEGA', 'Vega']].map(([t, lab]) => ({
    label: lab, pct: +(Math.abs(toNumber(byType[t]?.[relKey], 0)) / total * 100).toFixed(1),
  }));
  const gross = +comp.reduce((s, c) => s + c.pct, 0).toFixed(1);
  const div = +(100 - gross).toFixed(1);   // negativ = Diversifikationsvorteil
  return { comp, gross, div };
}

// RECHTER Chart je Abschnitt: Waterfall der VaR-/ES-Zerlegung (in % von Total).
// Total = 100 % (blau), IR/CS/Vega kumulativ aufsteigend (gruen, floating), dann
// Diversification benefit als negative Korrektur zurueck auf 100 % (grau).
function renderDiversificationBar(riskTypeRows, cfg) {
  const canvas = document.getElementById(cfg.canvasId);
  destroyFactorChart(cfg.canvasId);
  if (!canvas || !window.Chart) return;
  const dec = computeDecomposition(riskTypeRows, cfg.relKey);
  if (!dec) { canvas.style.display = 'none'; return; }
  const { comp, gross, div } = dec;

  const blue = 'rgba(46,88,130,0.9)', gray = 'rgba(150,150,150,0.85)', green = cfg.color;
  const labels = ['Total', ...comp.map(c => c.label), 'Diversification benefit'];
  const segs = [];      // [start,end] je Balken (floating bars)
  const colors = [];
  const dl = [];        // Datalabel-Texte je Balken
  segs.push([0, 100]); colors.push(blue); dl.push('100,0%');
  let cum = 0;
  comp.forEach(c => { segs.push([cum, cum + c.pct]); colors.push(green); dl.push(`+${c.pct.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`); cum += c.pct; });
  // Diversifikation: von gross zurueck auf 100 -> Segment [min,max], Label = div (negativ).
  segs.push([Math.min(100, gross), Math.max(100, gross)]); colors.push(gray); dl.push(`${div.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%`);

  canvas.style.display = 'block';
  canvas.width = 520; canvas.height = 300;
  const bodyCss = getComputedStyle(document.body);
  const chartColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#333';
  const chartFont = (bodyCss.fontFamily || 'system-ui, sans-serif').trim();
  const chart = new window.Chart(canvas.getContext('2d'), {
    type: 'bar',
    plugins: [window.ChartDataLabels, _vline100Plugin].filter(Boolean),
    data: { labels, datasets: [
      { label: `${cfg.metric} decomposition`, data: segs, backgroundColor: colors, borderColor: colors, borderWidth: 1, maxBarThickness: 22 },
    ] },
    options: {
      indexAxis: 'y', responsive: false, maintainAspectRatio: false, animation: false, color: chartColor,
      layout: { padding: { right: 64 } },
      plugins: {
        legend: { display: false },
        title: { display: !!cfg.title, text: cfg.title || '', color: chartColor, align: 'start', font: { family: chartFont, size: 13, weight: 'bold' } },
        subtitle: { display: !!cfg.subtitle, text: cfg.subtitle || '', color: 'rgba(150,160,175,0.9)', align: 'start', padding: { bottom: 8 }, font: { family: chartFont, size: 10 } },
        tooltip: { callbacks: { label: (ctx) => `${ctx.label}: ${dl[ctx.dataIndex]}` } },
        datalabels: window.ChartDataLabels ? { anchor: 'end', align: 'right', color: chartColor, font: { size: 10 }, formatter: (v, ctx) => dl[ctx.dataIndex] } : undefined,
      },
      scales: {
        x: { beginAtZero: true, suggestedMax: Math.max(115, gross + 5), ticks: { color: chartColor, font: { family: chartFont }, callback: (v) => `${Number(v).toLocaleString('de-DE', { maximumFractionDigits: 2 })}%` }, grid: { color: 'rgba(128,128,128,0.15)' } },
        y: { ticks: { color: chartColor, font: { family: chartFont, size: 11 } }, grid: { display: false } },
      },
    },
  });
  _factorCharts.set(cfg.canvasId, chart);
}

// Je Abschnitt (VaR/ES): links VaR%/ES% je Risikotyp, rechts Diversifikations-Zerlegung.
function renderFactorContribCharts(riskTypeRows) {
  // Palette: VaR = Market-Teal, ES = gelblichere Nuance (olive) — wie in den
  // Issuer-/Product-Beitragscharts.
  renderRiskTypeBar(riskTypeRows, { canvasId: 'mvarFactorVarContribChart', relKey: 'var_rel', metric: 'VaR', color: 'rgba(42,127,127,0.9)', title: 'VaR Contribution by Risk Type', subtitle: '% of portfolio value' });
  renderDiversificationBar(riskTypeRows, { canvasId: 'mvarFactorVarScatterChart', relKey: 'var_rel', metric: 'VaR', color: 'rgba(42,127,127,0.9)', title: 'VaR Decomposition — % of Total VaR', subtitle: 'Waterfall: gross risk minus diversification benefit equals total' });
  renderRiskTypeBar(riskTypeRows, { canvasId: 'mvarFactorEsContribChart', relKey: 'es_rel', metric: 'ES', color: 'rgba(122,158,74,0.9)', title: 'ES Contribution by Risk Type', subtitle: '% of portfolio value' });
  renderDiversificationBar(riskTypeRows, { canvasId: 'mvarFactorEsScatterChart', relKey: 'es_rel', metric: 'ES', color: 'rgba(122,158,74,0.9)', title: 'ES Decomposition — % of Total ES', subtitle: 'Waterfall: gross risk minus diversification benefit equals total' });
}

// Cache der Faktor-Auswertung pro (port, scenario, asof, settings, rowcount). buildDistributions
// (teuer: Gruppieren + Quantil ueber ~10k Zeilen) laeuft so nur EINMAL pro Datenstand statt bei
// jedem Render zweimal; wiederholte Renders und Szenario-Wechsel zurueck auf ein bereits
// gerechnetes Szenario sind dann sofort da. Invalidierung ueber den Key (asof/rowcount/settings).
const _factorComputeCache = new Map(); // key -> { filteredRows, riskTypeRows, factorRows }
const _FACTOR_CACHE_MAX = 12;
let _factorStoreRef = null;

function getFactorComputation() {
  // Neue Store-Daten (die DataPump ersetzt das Array nach einer Rechnung) -> Cache leeren.
  // Zwischen Renders/Szenario-Wechseln bleibt die Referenz stabil -> Cache-Treffer.
  const storeRows = appState.getMvarFactorPLData?.() || [];
  if (storeRows !== _factorStoreRef) { _factorComputeCache.clear(); _factorStoreRef = storeRows; }

  const filteredRows = getStoredRowsForCurrentContext();
  const context = getCurrentMvarContext(appState);
  const confidence = getConfidence();
  const horizonDays = getHorizonDays();
  const denominator = getRelativeScaleDenominator();
  const asof = filteredRows.length
    ? String(filteredRows[0]?.asof_date ?? filteredRows[0]?.ASOF_DATE ?? '').slice(0, 10)
    : '';
  const key = [
    String(context.portName ?? ''),
    String(context.scenarioName ?? ''),
    asof,
    filteredRows.length,
    confidence,
    horizonDays,
    denominator,
  ].join('|');

  const hit = _factorComputeCache.get(key);
  if (hit) return hit;

  // buildDistributions EINMAL rechnen und an beide Builder weiterreichen.
  const dists = filteredRows.length ? buildDistributions(filteredRows) : null;
  const riskTypeRows = buildRiskTypeRows(filteredRows, confidence, denominator, horizonDays, dists);
  const factorRows = buildFactorRows(filteredRows, confidence, denominator, horizonDays, dists);
  const entry = { filteredRows, riskTypeRows, factorRows };

  _factorComputeCache.set(key, entry);
  if (_factorComputeCache.size > _FACTOR_CACHE_MAX) {
    _factorComputeCache.delete(_factorComputeCache.keys().next().value); // aeltesten Eintrag raus
  }
  return entry;
}

export function renderMVaRFactorPLPanel() {
  const factorContainer = document.getElementById('MVaRFactorPLContainer');
  const typeContainer = document.getElementById('MVaRRiskTypePLContainer');

  if (!factorContainer && !typeContainer) {
    console.warn('[MVaR FactorPL] containers missing', {
      factorContainer: !!factorContainer,
      typeContainer: !!typeContainer,
    });
    return;
  }

  const { portName, scenarioName } = getCurrentMvarContext(appState);
  const { filteredRows, riskTypeRows, factorRows } = getFactorComputation();

  if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
    renderFactorKpis([]);
    if (typeContainer) {
      renderTable(
        typeContainer,
        [],
        [],
        'No MVaR risk type P/L data.'
      );
    }

    if (factorContainer) {
      renderTable(
        factorContainer,
        [],
        [],
        'No MVaR factor P/L data.'
      );
    }

    renderFactorContribCharts([]);

    console.warn('[MVaR FactorPL] no rows for current context', {
      portName,
      scenarioName,
      storeRows: appState.getMvarFactorPLData?.()?.length || 0,
      availablePorts: [
        ...new Set((appState.getMvarFactorPLData?.() || []).map(r => r.port_name ?? r.PORT_NAME))
      ],
      availableScenarios: [
        ...new Set((appState.getMvarFactorPLData?.() || []).map(r => r.scenario_name ?? r.SCENARIO_NAME))
      ],
    });

    return;
  }

  // riskTypeRows/factorRows kommen aus getFactorComputation() (Compute-once + Cache).

  // Zwei Abschnitte (VaR/ES): links VaR%/ES% je Risikotyp, rechts Diversifikations-
  // Zerlegung (standalone/Total, Diversification = Summe - 100%).
  renderFactorContribCharts(riskTypeRows);
  renderFactorKpis(riskTypeRows);



  if (typeContainer) {
    renderTable(
      typeContainer,
      riskTypeRows,
      [
        {
          label: 'Risk Type',
          value: r => r.risk_type,
        },
        {
          label: 'VaR abs',
          value: r => formatMaybeAbs(r.var_abs),
          alignRight: true,
        },
        {
          label: 'VaR rel',
          value: r => formatMaybeRel(r.var_rel),
          alignRight: true,
        },
        {
          label: 'ES abs',
          value: r => formatMaybeAbs(r.es_abs),
          alignRight: true,
        },
        {
          label: 'ES rel',
          value: r => formatMaybeRel(r.es_rel),
          alignRight: true,
        },
        {
          label: 'Obs',
          value: r => r.obs,
          alignRight: true,
        },
      ],
      'No MVaR risk type P/L data.'
    );
  }

  if (factorContainer) {
    renderTable(
      factorContainer,
      factorRows,
      [
        {
          label: 'Risk Type',
          value: r => r.risk_type,
        },
        {
          label: 'Factor ID',
          value: r => r.factor_id,
        },
        {
          label: 'VaR abs',
          value: r => formatMaybeAbs(r.var_abs),
          alignRight: true,
        },
        {
          label: 'VaR rel',
          value: r => formatMaybeRel(r.var_rel),
          alignRight: true,
        },
        {
          label: 'ES abs',
          value: r => formatMaybeAbs(r.es_abs),
          alignRight: true,
        },
        {
          label: 'ES rel',
          value: r => formatMaybeRel(r.es_rel),
          alignRight: true,
        },
        {
          label: 'Obs',
          value: r => r.obs,
          alignRight: true,
        },
      ],
      'No MVaR factor P/L data.'
    );
  }

  // console.log('[MVaR FactorPL] rendered', {
  //   portName,
  //   scenarioName,
  //   confidence,
  //   horizonDays,
  //   denominator,
  //   storeRows: appState.getMvarFactorPLData?.()?.length || 0,
  //   filteredRows: filteredRows.length,
  //   riskTypeRows: riskTypeRows.length,
  //   factorRows: factorRows.length,
  //   sample: filteredRows[0],
  // });
}

export function handleMVaRFactorPLData(receivedData) {
  const rows = Array.isArray(receivedData) ? receivedData : [];

  if (typeof appState.setMvarFactorPLData !== 'function') {
    throw new Error('[MVaR FactorPL] Missing store: appState.setMvarFactorPLData');
  }

  appState.setMvarFactorPLData(rows);

  // console.log('[MVaR FactorPL] handler called', {
  //   receivedRows: rows.length,
  //   receivedSample: rows[0],
  //   storeRows: appState.getMvarFactorPLData?.()?.length || 0,
  //   hasStoreGetter: typeof appState.getMvarFactorPLData === 'function',
  //   hasStoreSetter: typeof appState.setMvarFactorPLData === 'function',
  // });

  renderMVaRFactorPLPanel();
}

