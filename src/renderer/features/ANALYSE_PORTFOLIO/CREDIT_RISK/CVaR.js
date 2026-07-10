import { filterColumnsInData } from '../../../core/ui/modal/modalData.js';
import processData from '../../../core/ui/modal/modalData.js';

import createBarChart from '../../../charts/BarChart.js';

import { formatNumber, isValidNumber, formatNumberWithCommas } from '../../../utils/tableCellFormats.js';
import { updateTrafficLight } from '../../../utils/trafficLight.js';
import { renderCreditRiskDashboard, renderCreditOverviewCharts } from './creditRiskDashboard.js';
import { appState } from '../../../renderer.js';
import { createContribDrill, scheduleHideConcMenu, bindRightClickDrill } from '../SummaryBreakdown.js';
import { renderChartLegend, sumNavForPort, _fmtLossCompact } from './LossIssuer.js';

// Drill-down fuer den EAD/LGD-Chart (Balken = Emittent -> dessen Positionen).
// Dieselbe Engine wie die Loss-/Market-Risk-Panels. Nur die 'var'-Schiene noetig;
// 'es' zeigt auf dieselben IDs und bleibt ungenutzt.
const _eadDrillCfg = {
  detailId: 'eadIssuerDetail', titleId: 'eadIssuerDetailTitle',
  tableId: 'eadIssuerDetailTable', closeId: 'eadIssuerDetailClose',
  menuId: 'eadIssuerCardMenu', valueType: 'NAV', valueLabel: 'NAV',
  // Positions-Tabelle wie der EAD-Data-Container: Rank/Rating/Notional/LGD/PD.
  columns: [
    { key: 'PROD_ID', label: 'Product ID' },
    { key: 'RANK', label: 'Rank' },
    { key: 'RATINGres', label: 'Rating' },
    { key: 'NOTIONAL', label: 'Notional', align: 'right', fmt: 'num' },
    { key: '__LGD', label: 'LGD', align: 'right', fmt: 'num' },
    { key: '__PD', label: 'PD-Historic', align: 'right', fmt: 'pct' },
    { key: '__PD_M', label: 'PD-MARKET', align: 'right', fmt: 'pct' },
    { key: '__PD_M_norm', label: 'PD-MARKET ADJUSTED', align: 'right', fmt: 'pct' },
  ],
};
const eadDrill = createContribDrill({ var: _eadDrillCfg, es: _eadDrillCfg });
function eadIssuerStep(name) {
  const s = String(name ?? '').trim();
  return s ? { colKey: 'ISSUER', value: s, label: 'Issuer' } : null;
}

// Positionen des Emittenten mit EAD-Feldern anreichern (je Emittent+Rang aus der
// EAD-Tabelle, pd_flag=RATING): LGD-Betrag je Position = NOTIONAL x LGD-Rate; PD/
// PD_M/PD_M_norm direkt uebernommen. Fuer die Drill-Spalten wie im EAD-Container.
function enrichEadDrillRows(portRows, port) {
  const info = new Map(); // "ISSUER||RANK" -> { rate, PD, PD_M, PD_M_norm }
  for (const e of (appState.getAllEADData?.() || [])) {
    if (String(e?.port_name ?? '') !== String(port)) continue;
    if (String(e?.pd_flag ?? '').toUpperCase() !== 'RATING') continue;
    const notion = Number(e?.NOTIONAL);
    const lgd = Number(e?.LGD);
    const key = `${String(e?.ISSUER ?? '').trim().toLowerCase()}||${String(e?.RANK ?? '').trim().toLowerCase()}`;
    info.set(key, {
      rate: (Number.isFinite(notion) && notion > 0 && Number.isFinite(lgd)) ? lgd / notion : null,
      PD: e?.PD, PD_M: e?.PD_M, PD_M_norm: e?.PD_M_norm,
    });
  }
  return (portRows || []).map((r) => {
    const key = `${String(r?.ISSUER ?? '').trim().toLowerCase()}||${String(r?.RANK ?? '').trim().toLowerCase()}`;
    const inf = info.get(key) || {};
    const notion = Number(r?.NOTIONAL);
    const lgdAmt = (Number.isFinite(inf.rate) && Number.isFinite(notion)) ? notion * inf.rate : null;
    return { ...r, __LGD: lgdAmt, __PD: inf.PD, __PD_M: inf.PD_M, __PD_M_norm: inf.PD_M_norm };
  });
}
function bindEadCanvasLeaveHide(canvas) {
  if (!canvas || canvas.dataset.eadLeaveBound) return;
  canvas.dataset.eadLeaveBound = '1';
  canvas.addEventListener('mouseleave', () => { try { scheduleHideConcMenu(); } catch {} });
}

// "All issuers": rendert die EAD-Daten (filteredEADMainData, je Emittent+Rang) in das
// Drill-Fenster -> gleiche Tabelle wie der EAD-Container (erste Spalte ISSUER).
function renderEadAllIssuers() {
  const detail = document.getElementById('eadIssuerDetail');
  const titleEl = document.getElementById('eadIssuerDetailTitle');
  const tableEl = document.getElementById('eadIssuerDetailTable');
  if (!detail || !tableEl) return;
  const rows = Array.isArray(filteredEADMainData) ? filteredEADMainData : [];
  const cols = [
    { key: 'ISSUER', label: 'Issuer' },
    { key: 'RANK', label: 'Rank' },
    { key: 'RATING', label: 'Rating' },
    { key: 'NOTIONAL', label: 'Notional', align: 'right', fmt: 'num' },
    { key: 'LGD', label: 'LGD', align: 'right', fmt: 'num' },
    { key: 'PD', label: 'PD-Historic', align: 'right', fmt: 'pct' },
    { key: 'PD_M', label: 'PD-MARKET', align: 'right', fmt: 'pct' },
    { key: 'PD_M_norm', label: 'PD-MARKET ADJUSTED', align: 'right', fmt: 'pct' },
  ];
  const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));
  const fmtCell = (r, col) => {
    const v = r[col.key];
    if (col.fmt === 'num') return Number.isFinite(Number(v)) ? Number(v).toLocaleString('de-DE', { maximumFractionDigits: 0 }) : '';
    if (col.fmt === 'pct') return Number.isFinite(Number(v)) ? `${(Number(v) * 100).toLocaleString('de-DE', { maximumFractionDigits: 4 })} %` : '';
    return v == null ? '' : String(v);
  };
  if (titleEl) titleEl.textContent = 'All issuers';
  tableEl.innerHTML = `
    <table class="conc-detail-tbl">
      <thead><tr>${cols.map(c => `<th${c.align === 'right' ? ' style="text-align:right;"' : ''}>${esc(c.label)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map(r => `<tr>${cols.map(c => `<td${c.align === 'right' ? ' style="text-align:right;"' : ''}>${esc(fmtCell(r, c))}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>`;
  detail.style.display = '';
  try { detail.scrollIntoView({ behavior: 'smooth', block: 'nearest' }); } catch {}
}




// === Modul-Scope ===
let LGDChart = null;
// dient als Cache fÃ¼r EAD/LDG-Daten des aktuellen Portfolios
let filteredEADMainData = [];


export function handleEADData(receivedData, index = 0, port_nameArg) {
  const port_name = String(
    port_nameArg ?? appState.getSelectedPortTableName?.() ?? ''
  ).trim();

  // âœ… If no portfolio selected: do nothing (no DOM, no chart, no warnings)
  if (!port_name) return;

  const EADDataContainer = document.getElementById('EADDataContainer');
  if (!EADDataContainer) return;

  // If payload missing/empty: clear UI + reset chart (quietly)
  if (!Array.isArray(receivedData) || receivedData.length === 0) {
    EADDataContainer.innerHTML = '';
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch {}
    return;
  }

  // Filter: current portfolio + PD-Flag RATING
  const filtered = receivedData.filter(row =>
    row &&
    String(row.port_name ?? '').trim() === port_name &&
    String(row.pd_flag ?? '').trim().toUpperCase() === 'RATING'
  );

  if (filtered.length === 0) {
    EADDataContainer.innerHTML = '';
    filteredEADMainData = [];
    try {
      if (LGDChart) {
        LGDChart.destroy();
        LGDChart = null;
      }
    } catch {}
    return;
  }

  // Relevant columns
  const columns = ['ISSUER', 'RANK', 'RATING', 'NOTIONAL', 'LGD', 'PD', 'PD_M', 'PD_M_norm'];
  const eadColumnLabelMap = {
    ISSUER: 'ISSUER',
    RANK: 'RANK',
    RATING: 'RATING',
    NOTIONAL: 'NOTIONAL',
    LGD: 'LGD',
    PD: 'PD-Historic',
    PD_M: 'PD-Market Implied',
    PD_M_norm: 'PD-Risk Adjusted',
  };

  filteredEADMainData = filterColumnsInData(filtered, columns);

  // Sort by NOTIONAL (numeric) desc
  filteredEADMainData.sort(
    (a, b) =>
      parseFloat((b.NOTIONAL || '0').toString().replace(/\s/g, '')) -
      parseFloat((a.NOTIONAL || '0').toString().replace(/\s/g, ''))
  );

  // Render table
  const EADMainDataHTML = processData(filteredEADMainData, 'EAD', eadColumnLabelMap);
  EADDataContainer.innerHTML = EADMainDataHTML;

  // Render chart after update
  renderLGDChart();

  // Standardansicht: beim Laden/Oeffnen der Seite direkt die "All issuers"-Tabelle
  // (= EAD-Daten) im Drill-Fenster zeigen.
  try { renderEadAllIssuers(); } catch (e) { console.warn('[EAD] All-issuers default failed', e); }
}


export function renderLGDChart() {
  if (!filteredEADMainData || filteredEADMainData.length === 0) {
    console.warn('renderLGDChart: keine Daten in filteredEADMainData');
    return;
  }

  const canvasId = 'LGDChart';
  const canvas = document.getElementById(canvasId);

  if (!canvas) {
    console.warn(`renderLGDChart: Canvas mit ID ${canvasId} nicht gefunden`);
    return;
  }

  // Alten Chart VOR dem Resize zerstören.
  // Wichtig beim Wechsel von wenigen -> vielen Einträgen.
  if (LGDChart) {
    try {
      LGDChart.destroy();
    } catch (err) {
      console.error('renderLGDChart: Fehler beim Destroy von LGDChart:', err);
    }
    LGDChart = null;
  }

  const labels = filteredEADMainData.map(row => String(row.ISSUER ?? '').trim());
  const rowCount = labels.length;

  /*
    Ziel:
    - wenige Emittenten: kompakt
    - viele Emittenten: wächst nach unten
    - Balkendicke bleibt stabil
  */
  const minChartHeight = 180;
  const rowSlotHeight = 24;
  const chartPadding = 90;
  const dynamicHeight = Math.max(
    minChartHeight,
    rowCount * rowSlotHeight + chartPadding
  );

  // Container hat feste Hoehe + overflow-y:auto (CSS). Das Canvas bekommt die volle
  // dynamicHeight (im raf) -> bei vielen Emittenten hoeher als die Karte, die Karte
  // scrollt. Frueheres Aufblasen der Container-Hoehe (inline) entfaellt.
  canvas.removeAttribute('height');
  canvas.style.height = '';
  canvas.style.maxHeight = '';
  canvas.style.minHeight = '';
  canvas.style.display = 'block';
  if (canvas.parentElement) {
    canvas.parentElement.style.height = '';
    canvas.parentElement.style.maxHeight = '';
    canvas.parentElement.style.minHeight = '';
  }

  const EADValues = filteredEADMainData.map(row => {
    const raw = (row.NOTIONAL || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  });

  const LGDValues = filteredEADMainData.map(row => {
    const raw = (row.LGD || '').toString().replace(/\s/g, '');
    const v = parseFloat(raw);
    return Number.isFinite(v) ? v : 0;
  });

  const commonBarOptions = {
    maxBarThickness: 12,
    categoryPercentage: 0.65,
    barPercentage: 0.75,
  };

  const datasets = [
    {
      label: 'EAD',
      data: EADValues,
      backgroundColor: 'rgba(70, 192, 230, 0.7)',
      borderColor: 'rgba(70, 192, 230, 0.7)',
      borderWidth: 1,
      ...commonBarOptions,
    },
    {
      label: 'LGD',
      data: LGDValues,
      backgroundColor: 'rgba(255, 0, 0, 0.7)',
      borderColor: 'rgba(255, 0, 0, 1)',
      borderWidth: 1,
      ...commonBarOptions,
    },
  ];

  // Drill-Schritte je Balken (Emittent) + Drill-Datenquelle (Positionen des gewaehlten
  // Portfolios, angereichert mit __LOSS). Balken = Emittent -> dessen Positionen.
  const steps = labels.map(iss => eadIssuerStep(iss));
  try {
    const selPort = String(appState.getSelectedPortTableName?.() ?? '').trim();
    const portRows = (appState.getAllPortfolioData?.() || [])
      .filter(r => String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === selPort);
    eadDrill.setData(enrichEadDrillRows(portRows, selPort));
  } catch (e) { console.warn('[EAD] drill data failed', e); }
  bindEadCanvasLeaveHide(canvas);

  // "All issuers"-Button im Drill-Fenster: rendert die EAD-Daten (je Emittent+Rang)
  // -> genau die EAD-Container-Tabelle, erste Spalte ISSUER. Einmalig binden.
  const showAllBtn = document.getElementById('eadShowAllBtn');
  if (showAllBtn && !showAllBtn.dataset.bound) {
    showAllBtn.dataset.bound = '1';
    showAllBtn.addEventListener('click', () => { try { renderEadAllIssuers(); } catch {} });
  }

  // Bei Breitenaenderung des Containers neu zeichnen (z.B. Panel-Open: Chart wurde
  // evtl. mit Fallback-Breite gerendert, solange das Panel versteckt war). Nur Breite
  // beruecksichtigen -> die von uns gesetzte Hoehe loest keine Endlosschleife aus.
  const eadContainer = canvas.parentElement;
  if (eadContainer && !eadContainer.__eadRO && typeof ResizeObserver !== 'undefined') {
    eadContainer.__eadRO = true;
    let lastW = 0;
    const ro = new ResizeObserver(() => {
      const w = eadContainer.getBoundingClientRect().width;
      if (w > 5 && Math.abs(w - lastW) > 8) { lastW = w; try { renderLGDChart(); } catch {} }
    });
    ro.observe(eadContainer);
  }

  // Einen Frame warten, damit Browser die neue Canvas-Höhe wirklich übernimmt.
  // Direkt mit new Chart() (statt createBarChart), damit Hover/Klick fuer den Drill
  // funktionieren (createBarChart setzt events:[]).
  requestAnimationFrame(() => {
    const cv = document.getElementById(canvasId);
    if (!cv || !cv.isConnected || !cv.parentNode) return;
    const existing = (typeof Chart !== 'undefined' && Chart.getChart) ? Chart.getChart(cv) : null;
    if (existing) { try { existing.destroy(); } catch {} }

    // Breite = Container-Innenbreite; Höhe = dynamicHeight -> bei vielen Emittenten
    // hoeher als die (fixe) Karte, die Karte scrollt (overflow-y in CSS).
    const padX = 24; // .chart-container-inner padding links+rechts
    cv.width = Math.max(320, Math.floor((cv.parentNode.clientWidth || 800) - padX));
    cv.height = dynamicHeight;

    // Fuer die Balken-Labels (Wert kompakt + rel % vom NAV, wie beim Loss-Chart).
    const sumNav = sumNavForPort(appState.getSelectedPortTableName?.());
    const bodyCss = getComputedStyle(document.body);
    const labelColor = (bodyCss.getPropertyValue('--text-primary') || '').trim() || '#ddd';

    LGDChart = new Chart(cv.getContext('2d'), {
      type: 'bar',
      plugins: window.ChartDataLabels ? [window.ChartDataLabels] : [],
      data: { labels, datasets },
      options: {
        responsive: false,
        maintainAspectRatio: false,
        indexAxis: 'y',
        animation: false,
        normalized: true,
        // Platz rechts fuer die Wert-Labels neben den Balken.
        layout: { padding: { right: 96 } },
        // Drill per RECHTSKLICK (bindRightClickDrill nach der Chart-Erzeugung).
        plugins: {
          // Canvas-Legende aus: sticky HTML-Legende (renderChartLegend) bleibt beim
          // Scrollen sichtbar, gleiches Styling wie beim Loss-Chart.
          legend: { display: false },
          annotation: false,
          // Wert (kompakt) + rel % vom NAV rechts neben jedem Balken.
          datalabels: window.ChartDataLabels ? {
            anchor: 'end', align: 'right', clamp: true,
            color: labelColor,
            font: { size: 10 },
            formatter: (value) => {
              const v = Number(value) || 0;
              if (!v) return '';
              const rel = sumNav > 0 ? (v / sumNav * 100) : 0;
              return `${_fmtLossCompact.format(v)} · ${rel.toFixed(1)}%`;
            },
          } : undefined,
        },
        scales: { y: { beginAtZero: true, ticks: { autoSkip: false } }, x: { beginAtZero: true, grace: '5%' } },
      },
    });

    LGDChart.$eadSteps = steps;
    bindRightClickDrill(cv, () => LGDChart,
      (el, ch, e) => eadDrill.hover('var', { native: e }, [el], ch.$eadSteps || []));

    try { renderChartLegend(LGDChart, document.getElementById('eadChartLegend')); } catch {}
  });
}


export function handleCVaRData(receivedData, index, port_nameArg) {
  const safeIndex = Number.isFinite(index) ? index : 0;

  // Slot → port_name (wie bei MVaR: panel-lokal)
  const dd = document.getElementById(`createdPortDropdown${safeIndex}`);
  const port_name = String(port_nameArg ?? dd?.value ?? '').trim();

  // Wenn Slot nichts selected hat: ruhig bleiben
  if (!port_name) return;

  // Optional: stale-guard (verhindert "alte Response überschreibt neuen Slot")
  const current = String(dd?.value ?? '').trim();
  if (current && current !== port_name) return;

  const filteredByPort = Array.isArray(receivedData)
    ? receivedData.filter(item =>
        item &&
        String(item.port_name ?? '').trim() === port_name
      )
    : [];

  appState.setCvarData?.(filteredByPort);

  // Nur Combined-Overview (slot-spezifisch!) – das ist stabil, weil ContainerId index-basiert ist
  const combinedRelData = {
    rating: filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'rating'),
    market: filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'market'),
    norm:   filteredByPort.filter(x => String(x?.pd_flag ?? '').toLowerCase() === 'norm'),
  };

  console.log('combinedRelData:', combinedRelData)

  renderCombinedCVaRRelTable(combinedRelData, safeIndex);

  // Credit-Risk-Dashboard (KPI-Karten) aus denselben CVaR-Daten aktualisieren.
  try { renderCreditRiskDashboard(); } catch (e) { console.warn('[CVaR] credit dashboard render failed', e); }
  // Overview-Loss-Charts (Loss distribution + Tail zoom) ebenfalls mitziehen, damit sie
  // beim Portfoliowechsel aktualisieren (nicht erst nach einer Neuberechnung).
  try { renderCreditOverviewCharts(); } catch (e) { console.warn('[CVaR] credit overview charts render failed', e); }
}




function populateCVaRTable(container, CVaRData, port_name) {
  if (!CVaRData || CVaRData.length === 0) {
    console.warn('âš ï¸ No CVaR data available.');
    container.innerHTML = '<p>No data available</p>';
    return;
  }

  const row0 = CVaRData[0];

  // Create a new table
  const table = document.createElement('table');
  table.border = '1'; // Add border for visibility

  // Create table headers
  const headers = [`Metric for ${port_name}`, 'Absolute', 'Relative'];
  const headerRow = table.insertRow();
  headers.forEach(headerText => {
    const cell = headerRow.insertCell();
    cell.textContent = headerText;
    cell.style.fontWeight = 'bold'; // Make headers bold
  });

  // Process and insert data rows
  const metrics = [
    { label: 'VaR', absKey: 'VaR_abs', relKey: 'VaR_rel' },
    { label: 'ES', absKey: 'ES_abs', relKey: 'ES_rel' },
  ];

  metrics.forEach(metric => {
    const row = table.insertRow();
    row.insertCell().textContent = metric.label; // First column: Metric name

    const absVal = row0[metric.absKey];
    const relVal = row0[metric.relKey];

    row.insertCell().textContent =
      absVal !== undefined ? formatNumber(0)(absVal) : 'N/A';
    row.insertCell().textContent = formatPercentage(relVal);
  });

  // Clear previous content and append the new table
  container.innerHTML = '';
  container.appendChild(table);
}

function formatPercentage(value) {
  if (value === undefined || value === null || isNaN(value)) return 'N/A';
  return (Number(value) * 100).toFixed(2) + '%';
}

// Cached inputs of the last credit-risk traffic-light render, so the ampel can be
// re-computed when the customer thresholds change (without new CVaR data).
let __lastCvarAmpelData = null;
let __lastCvarAmpelIndex = null;

// Re-render the credit-risk traffic lights from the last CVaR data using the
// CURRENT customer thresholds. No-op if nothing was rendered yet / panel hidden.
export function refreshCreditRiskTrafficLights() {
  if (__lastCvarAmpelData == null) return;
  renderCombinedCVaRRelTable(__lastCvarAmpelData, __lastCvarAmpelIndex);
}

// Core: append a small coloured status dot AFTER the value cell of a table row.
// Same colours/look as Market Risk. Removes any previous dot first.
function appendCreditStatusDot(row, state) {
  const valueCell = row && row.cells ? row.cells[1] : null;
  if (!valueCell) return;

  const existingDot = valueCell.querySelector('.credit-status-dot');
  if (existingDot) existingDot.remove();

  const colorMap = {
    green: 'var(--accent)',
    yellow: 'yellow',
    red: 'red',
  };
  const color = colorMap[state] || null;
  if (!color) return;

  const dot = document.createElement('span');
  dot.className = 'credit-status-dot';
  dot.dataset.status = state;   // green|yellow|red -> vom PDF-Export gelesen (dotStatusFromCell)
  dot.style.display = 'inline-block';
  dot.style.width = '10px';
  dot.style.height = '10px';
  dot.style.borderRadius = '50%';
  dot.style.backgroundColor = color;
  dot.style.marginLeft = '8px';
  dot.style.verticalAlign = 'middle';

  valueCell.appendChild(dot);
}

// CVaR: dot on the matching row of the existing VaR table (data-metric = pd_flag).
function applyCreditDotToTable(index, state, metric) {
  const container = document.getElementById(`CVaR_allRelativeContainer${index}`);
  if (!container) return;

  const row = container.querySelector(`tr[data-metric="${metric}"]`);
  appendCreditStatusDot(row, state);
}

// Extract the rating-row values used for TSI: ES_rel, VaR_rel and TSI = ES - VaR.
// Mirrors the field handling in trafficLightStateForTsi.
function getTsiRatingValues(allFilteredDataByPdFlag) {
  const ratingArr = allFilteredDataByPdFlag && allFilteredDataByPdFlag['rating'];
  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;

  const row = ratingArr[0];
  if (!row || typeof row !== 'object') return null;

  const esKey = ['ES_rel', 'es_rel'].find(k => k in row);
  const varKey = ['VaR_rel', 'var_rel'].find(k => k in row);
  if (!esKey || !varKey) return null;

  const esVal = Number(row[esKey]);
  const varVal = Number(row[varKey]);
  if (!Number.isFinite(esVal) || !Number.isFinite(varVal)) return null;

  return { esVal, varVal, tsiDiff: esVal - varVal };
}

// Build the TSI table (ES / VaR / TSI stacked) and put the traffic-light dot on the
// TSI row. Unlike CVaR, TSI has no pre-existing table, so we generate it here first.
function renderTsiTable(allFilteredDataByPdFlag, index, state) {
  const container = document.getElementById(`creditTsiTableContainer${index}`);
  if (!container) return;

  container.innerHTML = '';

  const vals = getTsiRatingValues(allFilteredDataByPdFlag);
  if (!vals) return;

  const table = document.createElement('table');
  table.classList.add('CVaRTable');

  const headerRow = table.insertRow();
  ['label', 'value'].forEach(text => {
    headerRow.insertCell().textContent = text;
  });

  const tsiRows = [
    { metric: 'tsi', label: 'TSI',          value: formatPercentage(vals.tsiDiff) },
    { metric: 'es',  label: 'Historic ES',  value: formatPercentage(vals.esVal) },
    { metric: 'var', label: 'Historic VaR', value: formatPercentage(vals.varVal) },
  ];

  tsiRows.forEach(({ metric, label, value }) => {
    const r = table.insertRow();
    r.dataset.metric = metric;
    r.insertCell(0).textContent = label;
    r.insertCell(1).textContent = value;
  });

  container.appendChild(table);

  // Dot only on the TSI row.
  const tsiRow = container.querySelector('tr[data-metric="tsi"]');
  appendCreditStatusDot(tsiRow, state);
}

// Extract the ES values used for MSD: Historic ES (rating), Adjusted ES (norm) and
// MSD = Adjusted ES - Historic ES. Mirrors the field handling in trafficLightStateForMsd.
function getMsdValues(allFilteredDataByPdFlag) {
  const ratingArr = allFilteredDataByPdFlag && allFilteredDataByPdFlag['rating'];
  const normArr   = allFilteredDataByPdFlag && allFilteredDataByPdFlag['norm'];
  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;
  if (!Array.isArray(normArr)   || !normArr.length)   return null;

  const ratingRow = ratingArr[0];
  const normRow   = normArr[0];
  if (!ratingRow || !normRow) return null;
  if (!('ES_rel' in ratingRow) || !('ES_rel' in normRow)) return null;

  const esRating = Number(ratingRow.ES_rel); // Historic ES
  const esNorm   = Number(normRow.ES_rel);   // Adjusted ES
  if (!Number.isFinite(esRating) || !Number.isFinite(esNorm)) return null;

  return { esRating, esNorm, msdDiff: esNorm - esRating };
}

// Build the MSD table (Adjusted ES / Historic ES / MSD) and put the dot on the MSD row.
function renderMsdTable(allFilteredDataByPdFlag, index, state) {
  const container = document.getElementById(`creditMsdTableContainer${index}`);
  if (!container) return;

  container.innerHTML = '';

  const vals = getMsdValues(allFilteredDataByPdFlag);
  if (!vals) return;

  const table = document.createElement('table');
  table.classList.add('CVaRTable');

  const headerRow = table.insertRow();
  ['label', 'value'].forEach(text => {
    headerRow.insertCell().textContent = text;
  });

  const msdRows = [
    { metric: 'msd',    label: 'MSD',                 value: formatPercentage(vals.msdDiff) },
    { metric: 'adjEs',  label: 'Market adjusted ES', value: formatPercentage(vals.esNorm) },
    { metric: 'histEs', label: 'Historic ES',         value: formatPercentage(vals.esRating) },
  ];

  msdRows.forEach(({ metric, label, value }) => {
    const r = table.insertRow();
    r.dataset.metric = metric;
    r.insertCell(0).textContent = label;
    r.insertCell(1).textContent = value;
  });

  container.appendChild(table);

  // Dot only on the MSD row.
  const msdRow = container.querySelector('tr[data-metric="msd"]');
  appendCreditStatusDot(msdRow, state);
}

function renderCombinedCVaRRelTable(allFilteredDataByPdFlag, index) {
  __lastCvarAmpelData = allFilteredDataByPdFlag;
  __lastCvarAmpelIndex = index;

  const containerId = `CVaR_allRelativeContainer${index}`;
  const container   = document.getElementById(containerId);
  if (!container) return;


  container.dataset.panelTitle = 'Credit Risk / Traffic Lights';

  
  if (
    !allFilteredDataByPdFlag ||
    typeof allFilteredDataByPdFlag !== 'object' ||
    Object.keys(allFilteredDataByPdFlag).length === 0
  ) {
    container.innerHTML = '';
    return;
  }

  
  const hasValidData = Object.values(allFilteredDataByPdFlag).some(
    data => Array.isArray(data) && data[0] && data[0].VaR_rel !== undefined
  );

  // Container immer zuerst leeren
  container.innerHTML = '';

  if (!hasValidData) return;

  // Tabelle neu anlegen
  const table = document.createElement('table');
  table.classList.add('CVaRTable');
  table.classList.add('CVaRTable--3col');   // 3 Spalten: label / VaR / ES

  const headerRow = table.insertRow();
  ['label', 'VaR', 'ES'].forEach(text => {
    const cell = headerRow.insertCell();
    cell.textContent = text;
  });

  // Welche pd_flags zeigen wir an?
  const allowedPdFlags = ['rating', 'market', 'norm'];

  const labelMap = {
    rating: 'Historic',
    market: 'Market',
    norm:   'Market adjusted',
  };

  Object.entries(allFilteredDataByPdFlag).forEach(([pd_flag, data]) => {
    if (!Array.isArray(data) || !data.length) return;
    if (allowedPdFlags.length > 0 && !allowedPdFlags.includes(pd_flag)) return;

    const row = data[0];
    if (!row || !('VaR_rel' in row)) return;

    // Label ohne " VaR" -> Historic / Market Implied / Risk Adjusted
    const label = labelMap[pd_flag] || pd_flag;
    const fmt = (raw) => (typeof raw === 'string' ? raw : formatPercentage(raw));

    const r = table.insertRow();
    // Tag the row with its pd_flag so the matching traffic-light state can place a
    // coloured status dot here (rating -> CVaR ampel, auf der VaR-Zelle = cells[1]).
    r.dataset.metric = pd_flag;
    r.insertCell(0).textContent = label;
    r.insertCell(1).textContent = fmt(row.VaR_rel);   // VaR
    r.insertCell(2).textContent = fmt(row.ES_rel);    // ES
  });

  container.appendChild(table);



  // Credit-risk thresholds now come from the customer store
  // (CustomerCreditRiskThresholdSetting), not the legacy CreditVaRInputThreshold.
  console.log('[CREDIT RISK SETTING THRESHOLDS USED]', {
    source: 'CustomerCreditRiskThresholdSetting/appState',
    CVAR: appState.getCustomerCreditRiskThreshold?.('CVAR'),
    TSI: appState.getCustomerCreditRiskThreshold?.('TSI'),
    MSD: appState.getCustomerCreditRiskThreshold?.('MSD'),
  });

  // CVaR
  const stateCvar = trafficLightStateForCvar(allFilteredDataByPdFlag, 'Historic');
  if (stateCvar) {
    const el = document.getElementById('traffic-credit-cvar');
    if (el) el.dataset.status = stateCvar;
    updateTrafficLight('#traffic-credit-cvar', stateCvar);
    // Same as Market Risk: show the CVaR state as a coloured dot after the value in
    // the FIRST table row (Historic VaR / pd_flag 'rating').
    applyCreditDotToTable(index, stateCvar, 'rating');
  }

  // MSD
  const stateMsd = trafficLightStateForMsd(allFilteredDataByPdFlag, allowedPdFlags);
  if (stateMsd) {
    const el = document.getElementById('traffic-credit-msd');
    if (el) el.dataset.status = stateMsd;
    updateTrafficLight('#traffic-credit-msd', stateMsd);
  }
  // Generate the MSD table (Adjusted ES / Historic ES / MSD) and put the dot on MSD.
  renderMsdTable(allFilteredDataByPdFlag, index, stateMsd);

  // TSI
  const stateTsi = trafficLightStateForTsi(allFilteredDataByPdFlag, allowedPdFlags);
  if (stateTsi) {
    const el = document.getElementById('traffic-credit-tsi');
    if (el) el.dataset.status = stateTsi;
    updateTrafficLight('#traffic-credit-tsi', stateTsi);
  }
  // Generate the TSI table (ES / VaR / TSI) and put the dot on the TSI row.
  renderTsiTable(allFilteredDataByPdFlag, index, stateTsi);
}




function trafficLightStateForCvar(allFilteredDataByPdFlag, flag) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCustomerCreditRiskThreshold
    ? appState.getCustomerCreditRiskThreshold('CVAR')
    : null;

  //console.log('getCvarInputThreshold("CVaR") â†’', thrRaw);

  if (!thrRaw) {
    console.warn('âš ï¸ CVaR-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "CVaR" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'CVaR') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ CVaR-Thresholds: Kein Eintrag fÃ¼r metric="CVaR" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe Thresholds aus DB (CVaR-Zeile):', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ CVaR-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // - Deine neue DB-Konvention: -0.05, -0.2 etc. â†’ already fractions â†’ bleiben so.
  // - Falls irgendwo noch alte Werte wie -5 / -20 drin sind â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // BetrÃ¤ge verwenden (weil Verlustseite negativ)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) Daten fÃ¼r aktuelles Flag holen
  const key = (flag === 'Historic') ? 'rating' : flag;
  const arr = allFilteredDataByPdFlag[key];

  if (!Array.isArray(arr) || !arr.length) return null;

  const row = arr[0];
  if (!row || row.VaR_rel == null) return null;

  const raw = Number(row.VaR_rel);
  if (!isFinite(raw)) return null;

  // VaR_rel ist bei Verlusten negativ â†’ Betrag
  const lossLevel = Math.abs(raw);   // z.B. -0.0552 â†’ 0.0552 = 5.52 %

  // console.log('CVaR Ampel Check:', {
  //   flag,
  //   VaR_rel_raw: raw,
  //   lossLevel,
  //   YELLOW,
  //   RED
  // });

  if (lossLevel >= RED)    return 'red';
  if (lossLevel >= YELLOW) return 'yellow';
  return 'green';
}
function trafficLightStateForMsd(allFilteredDataByPdFlag, _flags) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCustomerCreditRiskThreshold
    ? appState.getCustomerCreditRiskThreshold('MSD')
    : null;

  console.warn('[MSD THRESHOLD USED IN TRAFFIC LIGHT]', {
    threshold: appState.getCustomerCreditRiskThreshold?.('MSD'),
    red: appState.getCustomerCreditRiskThreshold?.('MSD')?.red_threshold,
  });

  if (!thrRaw) {
    console.warn('âš ï¸ MSD-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "MSD" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'MSD') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ MSD-Thresholds: Kein Eintrag fÃ¼r metric="MSD" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe MSD-Thresholds aus DB:', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ MSD-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // Neue Konvention: 0.01, 0.02 etc. â†’ bereits BrÃ¼che.
  // Falls mal alte Werte 1 / 2 oder 10 / 20 drin sind â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Ab jetzt arbeiten wir mit positiven Schwellen (Betrag)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte MSD-Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) rating/norm-Daten holen
  const ratingArr = allFilteredDataByPdFlag['rating'];
  const normArr   = allFilteredDataByPdFlag['norm'];

  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;
  if (!Array.isArray(normArr)   || !normArr.length)   return null;

  const ratingRow = ratingArr[0];
  const normRow   = normArr[0];

  if (!ratingRow || !normRow) return null;

  // Wir verwenden gezielt ES_rel
  const candidateKeys = ['ES_rel'];

  const findKey = (row) =>
    candidateKeys.find(k => k in row);

  const keyRating = findKey(ratingRow);
  const keyNorm   = findKey(normRow);

  if (!keyRating || !keyNorm) {
    console.warn('âš ï¸ Kein passender ES-Key in rating/norm gefunden (MSD)');
    return null;
  }

  const esRating = Number(ratingRow[keyRating]);
  const esNorm   = Number(normRow[keyNorm]);

  if (!Number.isFinite(esRating) || !Number.isFinite(esNorm)) {
    return null;
  }

  // Differenz, z.B. -0.01 = -1%, aber wir vergleichen den Betrag
  const diffRel = esNorm - esRating;
  const valueToCompare = Math.abs(diffRel);

  // console.log('Credit Risk Ampel MSD (ES):', {
  //   esRating,
  //   esNorm,
  //   diffRel,
  //   absDiff: valueToCompare,
  //   YELLOW,
  //   RED
  // });

  // Schwellen sind positiv:
  // Beispiel: YELLOW = 0.01, RED = 0.02
  // |diffRel| >= RED    â†’ rot
  // |diffRel| >= YELLOW â†’ gelb
  if (valueToCompare >= RED)    return 'red';
  if (valueToCompare >= YELLOW) return 'yellow';
  return 'green';
}
function trafficLightStateForTsi(allFilteredDataByPdFlag, _flags) {
  if (!allFilteredDataByPdFlag || typeof allFilteredDataByPdFlag !== 'object') {
    return null;
  }

  // 1) Thresholds aus appState holen (kann Array oder Objekt sein)
  const thrRaw = appState.getCustomerCreditRiskThreshold
    ? appState.getCustomerCreditRiskThreshold('TSI')
    : null;

  //console.log('getCvarInputThreshold("TSI") â†’', thrRaw);

  if (!thrRaw) {
    console.warn('âš ï¸ TSI-Thresholds: getCvarInputThreshold gibt null/undefined zurÃ¼ck');
    return null;
  }

  // 2) Falls Array â†’ passende Zeile nach metric = "TSI" suchen
  let thrObj;

  if (Array.isArray(thrRaw)) {
    thrObj = thrRaw.find(r => r.metric === 'TSI') || thrRaw[0];
  } else {
    thrObj = thrRaw;
  }

  if (!thrObj) {
    console.warn('âš ï¸ TSI-Thresholds: Kein Eintrag fÃ¼r metric="TSI" gefunden:', thrRaw);
    return null;
  }

  let YELLOW = Number(thrObj.yellow_threshold);
  let RED    = Number(thrObj.red_threshold);

  // console.log('Rohe TSI-Thresholds aus DB:', {
  //   rawYellow: YELLOW,
  //   rawRed: RED,
  // });

  if (!Number.isFinite(YELLOW) || !Number.isFinite(RED)) {
    console.warn('âš ï¸ TSI-Thresholds sind keine gÃ¼ltigen Zahlen:', thrObj);
    return null;
  }

  // 3) Einheit normalisieren:
  // Neue Konvention: 0.01, 0.02 etc. â†’ bereits BrÃ¼che (Prozentpunkte).
  // Alte Werte 1 / 2 / 10 / 20 â†’ in BrÃ¼che umrechnen.
  if (Math.abs(YELLOW) > 1 || Math.abs(RED) > 1) {
    YELLOW = YELLOW / 100;
    RED    = RED / 100;
  }

  // Ab jetzt mit positiven Schwellen (Betrag in Prozentpunkten)
  YELLOW = Math.abs(YELLOW);
  RED    = Math.abs(RED);

  //console.log('Normierte TSI-Thresholds (BrÃ¼che, Betrag):', { YELLOW, RED });

  // 4) Wir schauen nur auf "rating"
  const ratingArr = allFilteredDataByPdFlag['rating'];
  if (!Array.isArray(ratingArr) || !ratingArr.length) return null;

  const row = ratingArr[0];
  if (!row || typeof row !== 'object') return null;

  // Feldnamen - nur relative GrÃ¶ÃŸen
  const esCandidates  = ['ES_rel', 'es_rel'];
  const varCandidates = ['VaR_rel', 'var_rel'];

  const findKey = (r, candidates) =>
    candidates.find(k => k in r);

  const esKey  = findKey(row, esCandidates);
  const varKey = findKey(row, varCandidates);

  if (!esKey || !varKey) {
    console.warn('âš ï¸ Kein ES_rel-/VaR_rel-Key fÃ¼r rating gefunden (TSI).');
    return null;
  }

  const esVal  = Number(row[esKey]);   // z.B. -0.07
  const varVal = Number(row[varKey]);  // z.B. -0.05

  if (!Number.isFinite(esVal) || !Number.isFinite(varVal)) {
    return null;
  }

  // TSI in Prozentpunkten: Differenz zweier relativer Werte
  // z.B. -0.07 - (-0.05) = -0.02 ( = -2 %-Punkte )
  const tsiDiff = esVal - varVal;
  const valueToCompare = Math.abs(tsiDiff);  // 0.02

  // console.log('TSI (rating, Prozentpunkte):', {
  //   esKey,
  //   varKey,
  //   esVal,
  //   varVal,
  //   tsiDiff,
  //   absDiff: valueToCompare,
  //   YELLOW,
  //   RED
  // });

  // Schwellen sind positiv:
  // |TSI_diff| >= RED    â†’ rot
  // |TSI_diff| >= YELLOW â†’ gelb
  if (valueToCompare >= RED)    return 'red';
  if (valueToCompare >= YELLOW) return 'yellow';
  return 'green';
}


function ensureTrafficPanel({ id, title, hostId = 'CVaR_allRelativeContainer1' /* anpassen */ }) {
  // hostId: wo du den Panel-Block sinnvollerweise andocken willst
  const host = document.getElementById(hostId) || document.body;

  let panel = document.getElementById(id);
  if (!panel) {
    panel = document.createElement('section');
    panel.id = id;

    // WICHTIG: Diese Klasse muss zu deinem discoverPanels() Selector passen
    panel.classList.add('risk-panel');

    // WICHTIG: Title-Attr (oder das, was deine Discovery liest)
    panel.dataset.panelTitle = title;

    // Optional: Key stabil
    panel.dataset.panelKey = id;

    // etwas Layout, damit es im Preview nicht â€œfliegtâ€
    panel.style.marginTop = '12px';
    panel.style.padding = '10px';
    panel.style.border = '1px solid rgba(255,255,255,.12)';
    panel.style.borderRadius = '10px';

    host.appendChild(panel);
  }
  return panel;
}


export { filteredEADMainData };






