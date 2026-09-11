'use strict';

import { appState } from '../../../../renderer.js';
import { formatNumberWithCommas, fmtEur, eurUnit, kpiValue } from '../../../../utils/tableCellFormats.js';
import { updateTrafficLight } from '../../../../utils/trafficLight.js';
import { kpiCard } from '../../../../utils/kpiCard.js';

import {
  getAvailableMvarPorts,
  getAvailableMvarScenarios,
  getMvarRowAsofDate,
  normalizeMvarText,
  rowMatchesMvarContext,
} from './mvarSelectors.js';

export function handleMVaRData(receivedData, index) {
  const portName = appState.getSelectedPortTableName?.();

  // Solange kein Portfolio existiert, nichts rendern.
  if (!portName) {
    return;
  }

  const scenarioName = appState.selectedMvarInterval;

  const containerIds = ['MVaRDataContainer'];

  if (index !== undefined && index !== null) {
    containerIds.push(`MVaRDataContainer${index}`);
  }

  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    clearContainers(containerIds);
    return;
  }

    const matches = receivedData.filter(row =>
    rowMatchesMvarContext(row, {
        portName,
        scenarioName,
    })
    );

  if (!matches.length) {
    clearContainers(containerIds);
    renderMvarPLKpis(null);

    console.warn('[MVaR Aggregate] no rows for current context', {
      portName,
      scenarioName,
      receivedRows: receivedData.length,
      availablePorts: getAvailableMvarPorts(receivedData),
      availableScenarios: getAvailableMvarScenarios(receivedData),
    });

    return;
  }

  const filteredData = matches
    .slice()
    .sort((a, b) =>
    getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b))
    )
    .at(-1);

  if (!filteredData) {
    return;
  }

  // Zusaetzlich die juengste ROLLING_1-Zeile desselben Portfolios (wird bei jedem
  // MVaR-Lauf mitgerechnet) -> eigene Spalte neben dem gewaehlten Szenario.
  let rollingData = null;
  if (normalizeMvarText(scenarioName) !== 'ROLLING_1') {
    const rollMatches = receivedData.filter(row =>
      rowMatchesMvarContext(row, { portName, scenarioName: 'ROLLING_1' })
    );
    rollingData = rollMatches
      .slice()
      .sort((a, b) => getMvarRowAsofDate(a).localeCompare(getMvarRowAsofDate(b)))
      .at(-1) || null;
  }

  renderMVaRRelativeTableWithIndex(filteredData, index, { rollingData, scenarioName });

let thresholds = getMVaRThresholdsFromInputUsingState();

if (!thresholds) {
  console.warn('[MVaR Aggregate] no thresholds available - traffic light set to neutral', {
    selectedMvarInterval: appState.selectedMvarInterval,
    selectedMvarId: appState.selectedMvarId,
  });

  applyMvarTrafficStateToTable(index, null);
  renderMvarPLKpis(filteredData, null, null);
  return;
}







const {
  RED_THRESHOLD,
  YELLOW_THRESHOLD,
  ES_RED_THRESHOLD,
  ES_YELLOW_THRESHOLD,
} = thresholds;

console.log('[MVAR TRAFFIC LIGHT INPUT CHECK]', {
  selectedMvarInterval: appState.selectedMvarInterval,
  selectedMvarId: appState.selectedMvarId,

  thresholdsObject: thresholds,
  redThresholdPassedToAmpel: RED_THRESHOLD,
  yellowThresholdPassedToAmpel: YELLOW_THRESHOLD,

  valuePassedToAmpel: filteredData?.VaR_T_rel,
  valueType: typeof filteredData?.VaR_T_rel,

  redType: typeof RED_THRESHOLD,
  yellowType: typeof YELLOW_THRESHOLD,

  isUsingFallbackDefaults:
    RED_THRESHOLD === -3 && YELLOW_THRESHOLD === -1,

  // New source (Customer / Risk Config) for comparison vs the old MVaRInput source.
  modelSelectionRows:
    typeof appState.getMvarModelSelectionAppRows === 'function'
      ? appState.getMvarModelSelectionAppRows()
      : appState.mvarModelSelectionAppRows,

  filteredDataSample: filteredData,
});

const state = trafficLightStateForMVaR(
  filteredData,
  RED_THRESHOLD,
  YELLOW_THRESHOLD
);

  if (state) {
    applyMvarTrafficStateToTable(index, state, 'totalVar');
  }

  // Total ES: same source, same state logic, same colouring — just the ES limits and
  // the ES_T_rel value. Skipped only if ES limits are absent in the customer row.
  let esState = null;
  if (ES_RED_THRESHOLD != null && ES_YELLOW_THRESHOLD != null) {
    esState = trafficLightStateForMVaR(
      filteredData,
      ES_RED_THRESHOLD,
      ES_YELLOW_THRESHOLD,
      'ES_T_rel'
    );

    if (esState) {
      applyMvarTrafficStateToTable(index, esState, 'totalEs');
    }
  }

  // KPI-Kacheln (Total VaR/ES abs + rel, mit Ampel-Punkt) — ersetzen die Tabelle in der Ansicht.
  renderMvarPLKpis(filteredData, state, esState);

  console.log('[MVaR Aggregate] rendered', {
    portName,
    scenarioName,
    selectedAsofDate: getMvarRowAsofDate(filteredData),
    receivedRows: receivedData.length,
    matchedRows: matches.length,
    state,
    sample: filteredData,
  });
}

function clearContainers(containerIds) {
  containerIds.forEach(id => {
    const el = document.getElementById(id);

    if (el) {
      el.innerHTML = '';
    }
  });
}

function renderMVaRRelativeTableWithIndex(data, index, { rollingData = null, scenarioName = '' } = {}) {
  const containerId = `MVaRDataContainer${index}`;
  const container = document.getElementById(containerId);

  if (!container) {
    return;
  }

  const hasValidData = data && (
    data.VaR_T_rel !== undefined ||
    data.VaR_IR_rel !== undefined ||
    data.VaR_CS_rel !== undefined ||
    data.ES_T_rel !== undefined
  );

  if (!hasValidData) {
    container.innerHTML = '';
    return;
  }

  container.innerHTML = '';

  const table = document.createElement('table');
  table.classList.add('MVaRTable');

  const headerRow = table.insertRow();

  // Mit Rolling-Spalte: Spaltenkoepfe = Szenario-Namen; ROLLING_1 zuerst,
  // dann das gewaehlte Szenario.
  const withRolling = !!rollingData;
  const headers = withRolling
    ? ['label', 'ROLLING_1', String(scenarioName || 'value')]
    : ['label', 'value'];
  headers.forEach(text => {
    const cell = headerRow.insertCell();
    cell.textContent = text;
  });

  const rows = [
    {
      label: 'Total VaR',
      value: formatNumberWithCommas(data.VaR_T_rel),
      rolling: withRolling ? formatNumberWithCommas(rollingData.VaR_T_rel) : null,
      metric: 'totalVar',
    },
    {
      label: 'Total ES',
      value: formatNumberWithCommas(data.ES_T_rel),
      rolling: withRolling ? formatNumberWithCommas(rollingData.ES_T_rel) : null,
      metric: 'totalEs',
    },
  ];

  rows.forEach(({ label, value, rolling, metric }) => {
    const row = table.insertRow();
    // Tag the row so the traffic-light state can colour its cells later
    // (replaces the separate traffic-light widget for Total VaR).
    row.dataset.metric = metric;

    row.insertCell(0).textContent = label;
    if (withRolling) row.insertCell(1).textContent = rolling ?? '';
    // Szenario-Wert-Zelle markieren: hier haengt der Ampel-Punkt
    // (applyMvarTrafficStateToTable), unabhaengig von der Spaltenreihenfolge.
    const valueCell = row.insertCell();
    valueCell.dataset.role = 'value';
    valueCell.textContent = value;
  });

  container.appendChild(table);

  // Eingestelltes/gerechnetes Intervall unter der Tabelle: Stichtag, Zeitraum,
  // Konfidenz, Horizont — direkt aus der MarketVaR-Zeile (deckt auch ROLLING ab).
  const d10 = (v) => String(v ?? '').slice(0, 10);
  const alpha = Number(data.alpha);
  const horizon = Number(data.horizon_days);
  const bits = [];
  if (d10(data.asof_date)) bits.push(`as of ${d10(data.asof_date)}`);
  if (d10(data.start_date) && d10(data.end_date)) bits.push(`${d10(data.start_date)} → ${d10(data.end_date)}`);
  if (Number.isFinite(alpha)) bits.push(`Confidence ${(alpha * 100).toLocaleString('de-DE', { maximumFractionDigits: 0 })}%`);
  if (Number.isFinite(horizon)) bits.push(`${horizon}d horizon`);
  if (bits.length) {
    const info = document.createElement('div');
    info.className = 'mvar-interval-info';
    info.textContent = bits.join(' · ');
    container.appendChild(info);
  }
}

// Show the traffic-light state as a small coloured dot AFTER the value (instead of
// colouring the whole row / the separate widget). Same colours as the ampel
// (green -> --accent, yellow, red). Pass null to clear the dot.
function applyMvarTrafficStateToTable(index, state, metric = 'totalVar') {
  const container = document.getElementById(`MVaRDataContainer${index}`);
  if (!container) return;

  const row = container.querySelector(`tr[data-metric="${metric}"]`);
  if (!row) return;

  const valueCell = row.querySelector('td[data-role="value"]') || row.cells[1];
  if (!valueCell) return;

  // Drop any previous dot so re-renders don't stack them.
  const existingDot = valueCell.querySelector('.mvar-status-dot');
  if (existingDot) existingDot.remove();

  // Konkrete Farben statt theme-var: --accent ist #4CAF50 (identische Optik im
  // Live-Panel), löst aber auch im geklonten Report-HTML zuverlässig auf.
  const colorMap = {
    green: '#4CAF50',
    yellow: 'yellow',
    red: 'red',
  };
  const color = colorMap[state] || null;
  if (!color) return;

  const dot = document.createElement('span');
  // mvar-status-dot bleibt (Remove-Selektor oben); zusätzlich generische, im Report
  // erkennbare Klassen + data-Attribut.
  dot.className = `mvar-status-dot risk-dot risk-dot--${state}`;
  dot.setAttribute('data-risk-status', state);
  dot.style.display = 'inline-block';
  dot.style.width = '10px';
  dot.style.height = '10px';
  dot.style.borderRadius = '50%';
  dot.style.backgroundColor = color;
  dot.style.marginLeft = '8px';
  dot.style.verticalAlign = 'middle';

  valueCell.appendChild(dot);
}

// Letzte Argumente merken, damit ein Wechsel des Stress-Szenarios (Dropdown) die KPI-Kacheln
// neu zeichnen kann, ohne dass neue MVaR-Daten reinkommen.
let _lastPLKpiArgs = null;
let _stressKpiBound = false;
const _escKpi = (s) => String(s ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

// Aggregat-Zeile des rechts gewaehlten Stress-Szenarios (mvarStressScenarioSelect). Fallback,
// wenn das Dropdown noch nicht befuellt ist: Customer-Default-Szenario (nicht ROLLING_1), sonst
// erstes Nicht-Rolling-Szenario. { name, VaR_T_abs, VaR_T_rel, ES_T_abs, ES_T_rel } oder null.
function _stressScenarioRow() {
  const port = appState.getSelectedPortTableName?.();
  if (!port) return null;
  const allAgg = appState.getAllMvarData?.() || [];
  const scenarios = [...new Set(
    allAgg.filter(i => i && i.port_name === port).map(i => String(i.scenario_name ?? '').trim()).filter(Boolean)
  )];
  if (!scenarios.length) return null;
  let name = (document.getElementById('mvarStressScenarioSelect')?.value || '').trim();
  if (!name || !scenarios.includes(name)) {
    const custDefaultU = String(appState.getCustomerMarketRiskSetting?.()?.default_market_risk_interval_code ?? '').trim().toUpperCase();
    name = (custDefaultU && custDefaultU !== 'ROLLING_1' ? scenarios.find(s => s.toUpperCase() === custDefaultU) : null)
      || scenarios.find(s => s.toUpperCase() !== 'ROLLING_1')
      || scenarios[0] || '';
  }
  if (!name) return null;
  const row = allAgg
    .filter(i => i && i.port_name === port && String(i.scenario_name ?? '').trim() === name)
    .sort((a, b) => String(a.asof_date).localeCompare(String(b.asof_date)))
    .at(-1) || null;
  if (!row) return null;
  return {
    name,
    VaR_T_abs: row.VaR_T_abs, VaR_T_rel: row.VaR_T_rel,
    ES_T_abs: (row.ES_T_abs ?? row.ES_abs), ES_T_rel: (row.ES_T_rel ?? row.ES_rel),
  };
}

// Bei Wechsel des Stress-Szenarios die KPIs neu zeichnen (einmalig gebunden).
function bindStressKpiRerender() {
  if (_stressKpiBound) return;
  const sel = document.getElementById('mvarStressScenarioSelect');
  if (!sel) return;
  sel.addEventListener('change', () => {
    if (_lastPLKpiArgs) renderMvarPLKpis(_lastPLKpiArgs.data, _lastPLKpiArgs.varState, _lastPLKpiArgs.esState);
  });
  _stressKpiBound = true;
}

// KPI-Kacheln fuer Profit/Loss: Total VaR + Total ES (Current, mit Ampel-Punkt) sowie die
// VaR-/ES-Werte des gewaehlten Stress-Szenarios daneben (Scenario VaR / Scenario ES).
function renderMvarPLKpis(data, varState, esState) {
  // Zwei Vergleichskacheln: links Current Market, rechts Stress-Szenario (je 2 KPIs + Chart).
  const curEl = document.getElementById('mvarPLKpiCur');
  const strEl = document.getElementById('mvarPLKpiStr');
  if (!curEl || !strEl) return;
  // Ausgewaehltes Stress-Szenario einmal berechnen (fuer Caption + Scenario-Kacheln unten).
  const scen = _stressScenarioRow();
  // Caption in EINER Zeile: "Current Market: <baseline>   Stress scenario: <name>".
  // Baseline = aktuelles Ansichts-/Rolling-Interval (appState.selectedMvarInterval, Default ROLLING_1).
  const _cap = document.querySelector('#panel-market .mvar-summary-header .mvar-caption');
  if (_cap) {
    const _baseline = String(appState.selectedMvarInterval ?? '').trim() || 'ROLLING_1';
    _cap.textContent = `Current Market: ${_baseline}`
      + (scen?.name ? ` Stress scenario: ${scen.name}` : '');
  }
  if (data) _lastPLKpiArgs = { data, varState, esState };
  bindStressKpiRerender();
  // Kachel-Titel (Vergleich): links Baseline, rechts das gewaehlte Stress-Szenario.
  const _baseTitle = String(appState.selectedMvarInterval ?? '').trim() || 'ROLLING_1';
  const _tc = document.getElementById('plCompareTitleCur');
  if (_tc) _tc.textContent = `Current Market: ${_baseTitle}`;
  if (!data) { curEl.innerHTML = ''; strEl.innerHTML = ''; return; }

  // Zentrales Zahlenformat wie bei Net Asset Value: EUR (klein) + absolute Zahl, relative Zahl
  // kleiner/muted. fmtEur (utils/tableCellFormats.js) haelt "EUR" vorne + .cur-unit (klein).
  // Vorzeichen ERHALTEN: VaR/ES sind Verluste (negativ) -> Minus anzeigen. Anders als das
  // zentrale fmtEur ("-EUR 256.349") soll das Minus hier VOR DER ZAHL stehen: "EUR -256.349".
  // Die Aenderungszeile uebergibt weiterhin positive Betraege (Richtung zeigt der Pfeil).
  const eurSigned = (v, html) => {
    const n = Number(v);
    if (!Number.isFinite(n)) return '–';
    const sign = n < 0 ? '-' : '';
    return `${eurUnit(html)} ${sign}${Math.round(Math.abs(n)).toLocaleString('de-DE')}`;
  };
  const eurAbsPlain = (v) => eurSigned(v, false);   // Report-Band: reiner Text
  const fmtRel = (v) => Number.isFinite(Number(v)) ? `${Number(v).toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %` : '–';
  // Aenderungszeile (Zeile NACH abs+rel) im Stil der Net-Asset-Value-KPI (Portfolio/Profit-Loss):
  // Kreis-Pfeil-Badge (Richtung) + absolute Aenderung · relative Aenderung. Vorperiode = vorletzter
  // gespeicherter Historic-Metrics-Snapshot (PortfolioHistoryMetrics), wie die NAV-KPI.
  const _num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  // Vorperioden-Snapshot: vorletzter History-Eintrag (letzter = aktueller/Platzhalter) fuer das
  // gewaehlte Portfolio. Die Snapshots halten nur die Gesamt-VaR/ES (M_VaR_ALL/M_ES_ALL), KEIN
  // Stress-Szenario -> Scenario-Kacheln bekommen keine Aenderungszeile.
  const _prevHistRow = () => {
    const sel = String(appState.getSelectedPortTableName?.() ?? '').trim();
    const rows = (appState.getPortfolioHistoryData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === sel)
      .slice().sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
    return rows.length >= 2 ? rows[rows.length - 2] : null;
  };
  const _fieldNum = (row, keys) => {
    for (const k of keys) { if (row && row[k] != null && row[k] !== '') { const n = _num(row[k]); if (Number.isFinite(n)) return n; } }
    return NaN;
  };
  const _chg = (cur, prevRaw) => {
    const p = _num(prevRaw), c = Number(cur);
    if (!Number.isFinite(c) || !Number.isFinite(p) || p === 0 || Math.abs(c) === Math.abs(p)) return null;
    const up = Math.abs(c) >= Math.abs(p);
    return { up, abs: Math.abs(Math.abs(c) - Math.abs(p)), rel: Math.abs((Math.abs(c) - Math.abs(p)) / Math.abs(p) * 100) };
  };
  // Stress-Szenario (scen wurde oben fuer die Caption bereits berechnet): VaR + ES daneben.
  // Ampel-Status fuers Szenario gegen DIESELBEN Limits (VaR-/ES-Schwellen aus Customer Setup).
  let scenVarState = null, scenEsState = null;
  if (scen) {
    const th = (() => { try { return getMVaRThresholdsFromInputUsingState(); } catch { return null; } })();
    if (th) {
      scenVarState = trafficLightStateForMVaR(scen, th.RED_THRESHOLD, th.YELLOW_THRESHOLD);
      if (th.ES_RED_THRESHOLD != null && th.ES_YELLOW_THRESHOLD != null) {
        scenEsState = trafficLightStateForMVaR(scen, th.ES_RED_THRESHOLD, th.ES_YELLOW_THRESHOLD, 'ES_T_rel');
      }
    }
  }

  // Vorperiode aus dem Historic-Metrics-Snapshot: nur Total VaR/ES (M_VaR_ALL/M_ES_ALL) haben
  // eine gespeicherte Vorperiode; die Stress-Szenario-Werte nicht -> dort keine Aenderungszeile.
  const _prevH = _prevHistRow();
  const varChg = _chg(data.VaR_T_abs, _fieldNum(_prevH, ['M_VaR_ALL', 'M_VaR_All', 'MVaR_All']));
  const esChg  = _chg(data.ES_T_abs,  _fieldNum(_prevH, ['M_ES_ALL', 'M_ES_All']));
  const scenVarChg = null;
  const scenEsChg  = null;

  // Reihenfolge: erst beide Current (portfolio total), dann beide Szenario-Kacheln.
  // Wert = EUR (absolut) + relative Zahl kleiner/muted (.conc-kpi__qual) + Ampelpunkt — wie NAV.
  // KPI-Kacheln zentral ueber die kpiCard-Komponente (conc-kpi) — identischer Aufbau/Format wie
  // die Credit-EC-Kacheln: EUR klein vorne, kompakt (Tsd./Mio.), Rahmenfarbe je Metrik, Ampelpunkt
  // (dot) + Trendzeile (chg) aus kpiCard. Report-Band (mvarPLKpiBand) unten bleibt unveraendert.
  // WICHTIG: KEIN tileKey/data-tile 'mkt_var'/'mkt_es' setzen — das sind Overview-Tile-Keys, die
  // applyOverviewTileVisibility/applyTileValueModes anfassen (display:none + home-tile-swap) und
  // die P&L-Kacheln sonst verstecken/flackern lassen wuerden. abs gross + rel als Sub (kein Swap).
  const plCard = (metric, label, r, st, chg) => kpiCard({
    metric, label, abs: r.abs, rel: r.rel, dot: st || null, chg: chg || null, reserveChg: true,
    pairInline: true,   // relative Zahl klein INLINE hinter dem Absolutwert (wie Credit VaR)
  });
  const _grid = (inner) => `<div class="conc-kpi-grid" style="width:100%">${inner}</div>`;
  // Kachel LINKS: die 2 Current-KPIs (VaR + ES). Der Kachel-Titel oben nennt "Current Market".
  curEl.innerHTML = _grid(
    plCard('var', 'Market Value at Risk (VaR)', { abs: data.VaR_T_abs, rel: data.VaR_T_rel }, varState, varChg)
    + plCard('es', 'Expected Shortfall (ES)', { abs: data.ES_T_abs, rel: data.ES_T_rel }, esState, esChg));
  // Kachel RECHTS: die 2 KPIs des gewaehlten Stress-Szenarios (oder Hinweis, wenn keins gewaehlt).
  strEl.innerHTML = scen
    ? _grid(
        plCard('var', 'Market Value at Risk (VaR)', { abs: scen.VaR_T_abs, rel: scen.VaR_T_rel }, scenVarState, scenVarChg)
        + plCard('es', 'Expected Shortfall (ES)', { abs: scen.ES_T_abs, rel: scen.ES_T_rel }, scenEsState, scenEsChg))
    : '<div class="mvar-caption" style="padding:8px 2px;">No stress scenario selected.</div>';

  // Report-Spiegel (data-kpi-band): dieselben KPIs als schlichte 2-Spalten-Tabelle (Label | Wert)
  // fuer den PDF-Report. drawKpiBand liest tbody-tr -> td[0]=Label, td[1]=Wert.
  const band = document.getElementById('mvarPLKpiBand');
  if (band) {
    // "·" trennt abs/rel -> drawKpiBand zeichnet EUR-abs (EUR klein) + rel kleiner/muted (wie App).
    // Kuerzere Labels als in der App (schmale PDF-Kacheln): "VaR · <Name>" / "ES · <Name>".
    // Aenderung als data-chg (+ data-up = Pfeilrichtung, data-up-color = Farbrichtung). Risiko:
    // gestiegen -> Pfeil hoch, Farbe ROT -> data-up=1, data-up-color=0 (im PDF via drawTrendCircle).
    const chgAttr = (chg) => chg
      ? ` data-chg="${_escKpi(`${eurAbsPlain(chg.abs)} · ${chg.rel.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} %`)}" data-up="${chg.up ? '1' : '0'}" data-up-color="${chg.up ? '0' : '1'}"`
      : '';
    const rows = [
      ['VaR · portfolio total', `${eurAbsPlain(data.VaR_T_abs)} · ${fmtRel(data.VaR_T_rel)}`, varChg],
      ['ES · portfolio total', `${eurAbsPlain(data.ES_T_abs)} · ${fmtRel(data.ES_T_rel)}`, esChg],
    ];
    if (scen) {
      rows.push([`VaR · ${scen.name}`, `${eurAbsPlain(scen.VaR_T_abs)} · ${fmtRel(scen.VaR_T_rel)}`, scenVarChg]);
      rows.push([`ES · ${scen.name}`, `${eurAbsPlain(scen.ES_T_abs)} · ${fmtRel(scen.ES_T_rel)}`, scenEsChg]);
    }
    band.innerHTML = `<table class="conc-report-table"><tbody>${
      rows.map(([l, v, chg]) => `<tr><td>${_escKpi(l)}</td><td${chgAttr(chg)}>${_escKpi(v)}</td></tr>`).join('')
    }</tbody></table>`;
  }
}

export function getMVaRThresholdsFromInputUsingState() {
  // Source switched to the Customer / Risk Config model-selection rows
  // (v_MVAR_MODEL_SELECTION_APP) instead of the old MVaRInput red/yellow_threshold.
  const modelSelectionRows =
    (
      typeof appState.getMvarModelSelectionAppRows === 'function'
        ? appState.getMvarModelSelectionAppRows()
        : appState.mvarModelSelectionAppRows
    ) || [];

  if (!Array.isArray(modelSelectionRows) || modelSelectionRows.length === 0) {
    console.warn('[MVaR Aggregate] no model-selection rows in state');
    return null;
  }

  let row = null;

  // 1) Match by selected interval (INTERVAL_NAME).
  const scenarioName = appState.selectedMvarInterval;
  if (scenarioName) {
    row = modelSelectionRows.find(item =>
      normalizeMvarText(item.INTERVAL_NAME ?? item.interval_name) === normalizeMvarText(scenarioName)
    );
  }

  // 2) Fallback within the same source: customer default row.
  if (!row) {
    row = modelSelectionRows.find(item => Number(item.is_customer_default) === 1);
  }

  // 3) Fallback within the same source: first row.
  if (!row) {
    row = modelSelectionRows[0];
  }

  if (!row) {
    console.warn('[MVaR Aggregate] no matching model-selection row found');
    return null;
  }

  const redRel = Number(row.var_red_loss_limit);
  const yellowRel = Number(row.var_yellow_loss_limit);

  if (!Number.isFinite(redRel) || !Number.isFinite(yellowRel)) {
    console.warn('[MVaR Aggregate] var loss limits missing or invalid', row);
    return null;
  }

  // ES limits from the SAME customer/risk-config row (may be absent -> null).
  const esRedRel = Number(row.es_red_loss_limit);
  const esYellowRel = Number(row.es_yellow_loss_limit);
  const esRedOk = Number.isFinite(esRedRel);
  const esYellowOk = Number.isFinite(esYellowRel);

  console.log('[MVAR THRESHOLD ROW USED]', {
    source: 'v_MVAR_MODEL_SELECTION_APP / getMvarModelSelectionAppRows',
    selectedMvarInterval: appState.selectedMvarInterval,
    selectedMvarId: appState.selectedMvarId,
    row,
    var_red_loss_limit_raw: row.var_red_loss_limit,
    var_yellow_loss_limit_raw: row.var_yellow_loss_limit,
    redThresholdFinal: redRel * 100,
    yellowThresholdFinal: yellowRel * 100,
    es_red_loss_limit_raw: row.es_red_loss_limit,
    es_yellow_loss_limit_raw: row.es_yellow_loss_limit,
    esRedThresholdFinal: esRedOk ? esRedRel * 100 : null,
    esYellowThresholdFinal: esYellowOk ? esYellowRel * 100 : null,
  });

  return {
    RED_THRESHOLD: redRel * 100,
    YELLOW_THRESHOLD: yellowRel * 100,
    ES_RED_THRESHOLD: esRedOk ? esRedRel * 100 : null,
    ES_YELLOW_THRESHOLD: esYellowOk ? esYellowRel * 100 : null,
  };
}

export function trafficLightStateForMVaR(data, redThreshold = -3, yellowThreshold = -1, valueKey = 'VaR_T_rel') {
  const value = Number(data?.[valueKey]);

  if (!Number.isFinite(value)) {
    console.error(`[MVaR Aggregate] ${valueKey} missing or invalid`, data);
    return null;
  }

  if (redThreshold >= yellowThreshold) {
    console.warn('[MVaR Aggregate] redThreshold should be smaller than yellowThreshold', {
      redThreshold,
      yellowThreshold,
    });
  }

  if (value < redThreshold) {
    return 'red';
  }

  if (value < yellowThreshold) {
    return 'yellow';
  }

  return 'green';
}