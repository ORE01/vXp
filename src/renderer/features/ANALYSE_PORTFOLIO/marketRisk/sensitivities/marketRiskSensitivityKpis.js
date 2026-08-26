'use strict';


import { setSensitivityTabGroupVisible } from './marketRiskSensitivityTabs.js';
import { appState } from '../../../../renderer.js';
import { fmtEurCompact } from '../../../../utils/tableCellFormats.js';

// Aenderungszeile (Zeile 3) je numerischer Sensitivities-KPI, vorbereitet fuer ALLE. Vorperiode
// aus PortfolioHistoryMetrics (Felder PV01/CPV01/MDURATION/CPV01bp; Vega-Feld folgt). Existiert
// das Feld (noch) nicht -> Finite-Check greift -> Zeile bleibt leer (wie not Valued/Liquidity).
function setSensKpiChange(id, cur, prevRaw, fmtAbs) {
  const el = document.getElementById(id);
  if (!el) return;
  const p = Number(prevRaw);
  if (!Number.isFinite(cur) || !Number.isFinite(p) || p === 0 || cur === p) { el.innerHTML = ''; el.hidden = true; return; }
  const up = cur >= p;
  const dAbs = Math.abs(cur - p), dRel = Math.abs((cur - p) / p * 100);
  el.hidden = false;
  el.innerHTML =
    `<span class="perf-chg-badge ${up ? 'is-up' : 'is-down'}">${up ? '↗' : '↘'}</span>` +
    `${fmtAbs(dAbs)} · ${dRel.toLocaleString('de-DE', { minimumFractionDigits: 1, maximumFractionDigits: 1 })} %`;
}

// live = { pv01, cpv01, duration, csDuration, vega } (aktuelle Live-Summen, wie in den KPIs
// angezeigt). Verglichen wird gegen die letzte reale History-Periode (vorletzter Eintrag; der
// letzte Eintrag ist ein Tages-/Platzhalter-Snapshot). Fehlt Live- ODER History-Wert -> leer.
function renderSensKpiChanges(selPort, live = {}) {
  const _num = (v) => { const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.')); return Number.isFinite(n) ? n : NaN; };
  const hist = (appState.getPortfolioHistoryData?.() || [])
    .filter(r => !selPort || String(r?.port_name ?? r?.PORT_NAME ?? '').trim() === selPort)
    .slice().sort((a, b) => new Date(a.DATE) - new Date(b.DATE));
  const prev = hist[hist.length - 2] || {};
  const fmtY = (v) => `${v.toLocaleString('de-DE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} Y`;
  setSensKpiChange('SensTotalPV01Chg',  Number(live.pv01),       _num(prev.PV01),      fmtEurCompact);
  setSensKpiChange('SensTotalCPV01Chg', Number(live.cpv01),      _num(prev.CPV01),     fmtEurCompact);
  setSensKpiChange('SensDurationChg',   Number(live.duration),   _num(prev.MDURATION), fmtY);
  setSensKpiChange('SensCsDurationChg', Number(live.csDuration), _num(prev.CS_DURATION), fmtY);
  setSensKpiChange('SensTotalVegaChg',  Number(live.vega),       _num(prev.VEGA),      fmtEurCompact);
}

const SENSITIVITY_ZERO_EPSILON = 1e-12;
const DEBUG_SENS_KPI = true;

function setText(id, value) {
  const el = document.getElementById(id);

  if (!el) {
    console.warn('[SENS KPI] DOM element not found:', id);
    return;
  }

  el.textContent = value;
}

function formatNumber(value, decimals = 0) {
  if (value === null || value === undefined || value === '') return '—';

  const n = Number(value);

  if (!Number.isFinite(n)) return '—';

  return n.toLocaleString('de-DE', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function normalizePortName(portName) {
  return String(portName ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

function getNumber(row, fields) {
  for (const field of fields) {
    const value = row?.[field];

    if (value !== undefined && value !== null && value !== '') {
      const n = Number(value);
      if (Number.isFinite(n)) return n;
    }
  }

  return 0;
}

function normalizeBucketLabel(bucket) {
  const text = String(bucket ?? '').trim();

  if (!text) return '';

  // CS:EUR:AAA -> AAA
  if (text.includes(':')) {
    const parts = text.split(':');
    return String(parts[parts.length - 1] ?? text).trim();
  }

  return text;
}

function getTopBucket(rows, bucketField) {
  const sums = new Map();

  rows.forEach(row => {
    const rawBucket = String(
      row?.[bucketField] ??
      row?.[bucketField?.toLowerCase?.()] ??
      ''
    ).trim();

    const bucket = normalizeBucketLabel(rawBucket);

    if (!bucket) return;

    const value = getNumber(row, [
      'VALUE_BASE',
      'value_base',
      'VALUE_LOCAL',
      'value_local',
      'CPV01',
      'PV01',
      'VEGA',
      'VEGA_1BP',
    ]);

    sums.set(bucket, (sums.get(bucket) || 0) + value);
  });

  let bestBucket = null;
  let bestAbsValue = -Infinity;

  for (const [bucket, value] of sums.entries()) {
    const absValue = Math.abs(value);

    if (absValue > bestAbsValue) {
      bestAbsValue = absValue;
      bestBucket = bucket;
    }
  }

  return bestBucket;
}

function buildRiskTotalsByCcy(rows = []) {
  return rows.reduce((acc, row) => {
    const ccy = String(row?.CCY ?? row?.ccy ?? 'UNKNOWN')
      .trim()
      .toUpperCase() || 'UNKNOWN';

    const value = getNumber(row, [
      'VALUE_BASE',
      'value_base',
      'VALUE_LOCAL',
      'value_local',
    ]);

    acc[ccy] = (acc[ccy] || 0) + value;

    return acc;
  }, {});
}

function buildCreditBucketSumsByCcy(rows = []) {
  return rows.reduce((acc, row) => {
    const ccy = String(row?.CCY ?? row?.ccy ?? 'UNKNOWN')
      .trim()
      .toUpperCase() || 'UNKNOWN';

    const rawBucket =
      row?.RISK_FACTOR_ID ??
      row?.risk_factor_id ??
      row?.RATING ??
      row?.rating ??
      row?.TENOR ??
      row?.tenor ??
      'UNKNOWN';

    const bucket = normalizeBucketLabel(rawBucket);

    if (!bucket) return acc;

    const value = getNumber(row, [
      'VALUE_BASE',
      'value_base',
      'VALUE_LOCAL',
      'value_local',
    ]);

    if (!acc[ccy]) {
      acc[ccy] = {};
    }

    acc[ccy][bucket] = (acc[ccy][bucket] || 0) + value;

    return acc;
  }, {});
}

function formatTopCreditBucketByCcy(groupedByCcy = {}) {
  const entries = Object.entries(groupedByCcy)
    .map(([ccy, buckets]) => {
      let bestBucket = null;
      let bestValue = 0;

      Object.entries(buckets || {}).forEach(([bucket, value]) => {
        const n = Number(value) || 0;

        if (Math.abs(n) > Math.abs(bestValue)) {
          bestValue = n;
          bestBucket = bucket;
        }
      });

      if (!bestBucket || Math.abs(bestValue) <= SENSITIVITY_ZERO_EPSILON) {
        return null;
      }

      return `${ccy} ${bestBucket}`;
    })
    .filter(Boolean)
    .sort();

  if (!entries.length) return '—';

  return entries.join(' | ');
}

function hasAnyNonZeroRiskByCcy(riskByCcy = {}) {
  return Object.values(riskByCcy).some(value => {
    const n = Number(value);
    return Number.isFinite(n) && Math.abs(n) > SENSITIVITY_ZERO_EPSILON;
  });
}

function formatRiskByCcy(riskByCcy = {}) {
  const entries = Object.entries(riskByCcy)
    .filter(([, value]) => {
      const n = Number(value);
      return Number.isFinite(n) && Math.abs(n) > SENSITIVITY_ZERO_EPSILON;
    })
    .sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) return '—';

  return entries
    .map(([ccy, value]) => `${ccy} ${formatNumber(value, 0)}`)
    .join(' | ');
}

function buildTenorSumsByCcy(rows = []) {
  return rows.reduce((acc, row) => {
    const ccy = String(row?.CCY ?? row?.ccy ?? 'UNKNOWN')
      .trim()
      .toUpperCase() || 'UNKNOWN';

    const tenor = parseInt(row?.TENOR ?? row?.tenor, 10);

    if (!Number.isFinite(tenor) || tenor < 1 || tenor > 30) {
      return acc;
    }

    const value = getNumber(row, [
      'VALUE_BASE',
      'value_base',
      'VALUE_LOCAL',
      'value_local',
    ]);

    if (!acc[ccy]) {
      acc[ccy] = Array(30).fill(0);
    }

    acc[ccy][tenor - 1] += value;

    return acc;
  }, {});
}

function formatTopTenorByCcy(irSensitivityByCcy = {}) {
  const entries = Object.entries(irSensitivityByCcy)
    .map(([ccy, tenorValues]) => {
      if (!Array.isArray(tenorValues)) return null;

      let bestTenor = null;
      let bestValue = 0;

      tenorValues.forEach((value, index) => {
        const n = Number(value) || 0;

        if (Math.abs(n) > Math.abs(bestValue)) {
          bestValue = n;
          bestTenor = index + 1;
        }
      });

      if (!bestTenor || Math.abs(bestValue) <= SENSITIVITY_ZERO_EPSILON) {
        return null;
      }

      return `${ccy} ${bestTenor}Y`;
    })
    .filter(Boolean)
    .sort();

  if (!entries.length) return '—';

  return entries.join(' | ');
}

function isMeaningfulSensitivityValue(value) {
  if (value === null || value === undefined) return false;

  if (typeof value === 'number') {
    if (!Number.isFinite(value)) return false;
    return Math.abs(value) > SENSITIVITY_ZERO_EPSILON;
  }

  const text = String(value).trim();

  if (!text) return false;
  if (text === '—' || text === '-') return false;
  if (text.toLowerCase() === 'nan') return false;

  // Supports German formatted values like "1.234,56"
  // and normal numeric strings like "1234.56".
  let numeric;

  if (text.includes(',') && text.includes('.')) {
    numeric = Number(text.replace(/\./g, '').replace(',', '.'));
  } else if (text.includes(',')) {
    numeric = Number(text.replace(',', '.'));
  } else {
    numeric = Number(text);
  }

  if (!Number.isFinite(numeric)) return false;

  return Math.abs(numeric) > SENSITIVITY_ZERO_EPSILON;
}

function getSensitivityKpiCard(valueElementId) {
  const valueEl = document.getElementById(valueElementId);

  if (!valueEl) {
    console.warn('[SENS KPI] DOM element not found:', valueElementId);
    return null;
  }

  return (
    valueEl.closest('[data-sensitivity-kpi]') ||
    valueEl.closest('.sensitivity-kpi') ||
    valueEl.closest('.sensitivity-card') ||
    valueEl.closest('.kpi-card') ||
    valueEl.closest('.metric-card') ||
    valueEl.closest('.summary-card') ||
    valueEl.parentElement
  );
}

function setSensitivityKpiVisible(valueElementId, value) {
  const card = getSensitivityKpiCard(valueElementId);

  if (!card) return;

  card.style.display = isMeaningfulSensitivityValue(value) ? '' : 'none';
}

function clearAndHideSensitivityKpi(valueElementId) {
  setText(valueElementId, '—');
  setSensitivityKpiVisible(valueElementId, 0);
}

// Spiegelt die 5 Sensitivities-KPIs in eine versteckte data-kpi-band-Tabelle (#sensKpiTable),
// damit Preview/PDF sie oberhalb der Charts als KPI-Band zeichnen (KPIs-zuerst-Logik).
function fillSensReportKpiBand() {
  const tbl = document.getElementById('sensKpiTable');
  if (!tbl) return;
  const esc = (s) => String(s ?? '').replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
  const defs = [
    ['Total PV01', 'SensTotalPV01'],
    ['Total CPV01', 'SensTotalCPV01'],
    ['Top IR Tenor', 'SensTopIRTenor'],
    ['Top Credit Bucket', 'SensTopCreditBucket'],
    ['Total Vega', 'SensTotalVega'],
  ];
  const rows = defs
    .map(([label, id]) => [label, (document.getElementById(id)?.textContent || '').trim()])
    .filter(([, v]) => v && v !== '—' && v !== '-');
  tbl.innerHTML = rows.length
    ? `<table class="conc-report-table"><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>${
        rows.map(([k, v]) => `<tr><td>${esc(k)}</td><td>${esc(v)}</td></tr>`).join('')
      }</tbody></table>`
    : '';
}

// Σ NOTIONAL per CCY over the (filtered) holdings — denominator for the relative
// KPIs (value / Σ Notional × 10000, bp). No fixed-value exclusion, to match the
// portfolio-level "Interest Rate Sensitivity" (PV01/Notional×10000).
export function notionalByCcyFromHoldings(holdings) {
  const out = {};
  (Array.isArray(holdings) ? holdings : []).forEach(h => {
    const ccy = String(h.CCY ?? h.ccy ?? '').toUpperCase().trim();
    const n = Number(h.NOTIONAL ?? h.notional);
    if (ccy && Number.isFinite(n)) out[ccy] = (out[ccy] || 0) + n;
  });
  return out;
}

// Σ NAV over the (filtered) holdings — denominator for the interest-rate duration.
export function navTotalFromHoldings(holdings) {
  return (Array.isArray(holdings) ? holdings : []).reduce((s, h) => {
    const n = Number(h.NAV ?? h.nav ?? h.NAV_BASE ?? h.nav_base);
    return s + (Number.isFinite(n) ? n : 0);
  }, 0);
}

// Relative = absolute / Σ Notional × 10000 = bp of price change per 1 bp move of
// the rate/spread/vol (dimensionless, NOT a currency amount), per CCY curve.
function buildRelByCcy(absByCcy = {}, notionalByCcy = {}) {
  const rel = {};
  Object.entries(absByCcy).forEach(([ccy, v]) => {
    const nom = Number(notionalByCcy?.[ccy]);
    rel[ccy] = (Number.isFinite(nom) && nom !== 0) ? (Number(v) / nom) * 10000 : 0;
  });
  return rel;
}

function formatRelByCcy(relByCcy = {}) {
  const entries = Object.entries(relByCcy)
    .filter(([, v]) => Number.isFinite(Number(v)) && Math.abs(Number(v)) > SENSITIVITY_ZERO_EPSILON)
    .sort(([a], [b]) => a.localeCompare(b));

  if (!entries.length) return '—';
  // bp of price (not a currency amount) — no CCY prefix; the currency is shown on
  // the absolute line below. Multiple curves are joined in the same (sorted) order.
  return entries.map(([, v]) => `${formatNumber(v, 2)} bp`).join(' | ');
}

// KPI value = relative (large) with the absolute below (small).
function setKpiRelAbs(id, relText, absText) {
  const el = document.getElementById(id);
  if (!el) {
    console.warn('[SENS KPI] DOM element not found:', id);
    return;
  }
  const esc = (s) => String(s ?? '').replace(/[<>&]/g, ch => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[ch]));
  el.innerHTML =
    `<span class="sens-kpi-rel">${esc(relText)}</span>` +
    `<span class="sens-kpi-abs">${esc(absText)}</span>`;
}

export function updateMarketRiskSensitivityKpis({
  rows = [],
  portName = null,
  pv01CalcData = null,
  cpv01SourceRows = null,
  cpv01CalcData = null,
  vegaCalcData = null,
  notionalByCcy = {},
  navTotal = 0,
} = {}) {
  const selectedPort = normalizePortName(portName);

  // Live-Summen der KPIs (fuer die Aenderungszeile: Live-Wert vs. Vorperiode aus der History).
  // Werden in den Branches unten befuellt; am Ende gerendert.
  const liveTotals = {};

  const portRows = rows.filter(row => {
    const rowPort = String(row?.PORT_NAME ?? row?.port_name ?? '').trim();

    if (!selectedPort) return true;

    return rowPort === selectedPort;
  });

const pv01Rows = portRows.filter(row => {
  const riskType = String(row?.RISK_TYPE ?? row?.risk_type ?? '').toUpperCase().trim();

  return riskType === 'PV01';
});

  const cpv01RowsFromRiskStore = portRows.filter(row => {
    const riskType = String(row?.RISK_TYPE ?? row?.risk_type ?? '').toUpperCase().trim();
    const ccy = String(row?.CCY ?? row?.ccy ?? '').toUpperCase().trim();

    return riskType === 'CPV01';
  });

  const vegaRowsFromRiskStore = portRows.filter(row => {
    const riskType = String(row?.RISK_TYPE ?? row?.risk_type ?? '').toUpperCase().trim();
    const ccy = String(row?.CCY ?? row?.ccy ?? '').toUpperCase().trim();

    return riskType === 'VEGA_PARALLEL' && ccy === 'EUR';
  });

  // Jeder Handler (PV01/CPV01/Vega) aktualisiert ALLE KPIs: bevorzugt aus seiner
  // eigenen Berechnung, sonst aus dem Risk-Store-Fallback (PortfolioRiskSensitivities,
  // nur letzter As-of -> korrekt). So bleibt z.B. der PV01-KPI sichtbar, wenn gerade
  // der CPV01-Handler laeuft.
  const hasPV01Data = pv01CalcData !== null || pv01Rows.length > 0;

  const hasCPV01Data =
    cpv01CalcData !== null ||
    Array.isArray(cpv01SourceRows) ||
    cpv01RowsFromRiskStore.length > 0;

  const hasExplicitVegaCalc =
    vegaCalcData !== null &&
    vegaCalcData !== undefined &&
    Number.isFinite(Number(vegaCalcData.totalVega));

  const hasVegaRows =
    vegaRowsFromRiskStore.length > 0;

// -------------------------------
// PV01 KPI update
// -------------------------------
if (hasPV01Data) {
  const pv01ByCcy =
    pv01CalcData?.pv01TotalByCcy ||
    buildRiskTotalsByCcy(pv01Rows);

  const irSensitivityByCcy =
    pv01CalcData?.irSensitivityByCcy ||
    buildTenorSumsByCcy(pv01Rows);

  const topIRTenorByCcy = formatTopTenorByCcy(irSensitivityByCcy);
  const hasVisiblePV01 = hasAnyNonZeroRiskByCcy(pv01ByCcy);

  setKpiRelAbs(
    'SensTotalPV01',
    formatRelByCcy(buildRelByCcy(pv01ByCcy, notionalByCcy)),
    formatRiskByCcy(pv01ByCcy)
  );
  setText('SensTopIRTenor', topIRTenorByCcy);

  // Modified duration (years) = |Σ PV01| / Σ NAV × 10000 — same as the Overview
  // "Interest Rate Duration" slider.
  const totalPv01 = Object.values(pv01ByCcy).reduce((s, v) => s + (Number(v) || 0), 0);
  const duration = navTotal ? (Math.abs(totalPv01) / navTotal) * 10000 : 0;
  setText('SensDuration', duration ? `${formatNumber(duration, 2)} y` : '—');
  liveTotals.pv01 = totalPv01;
  liveTotals.duration = duration;

  // Pass 1/0 intentionally.
  // The KPI card visibility helper expects a numeric-like value, not a formatted text.
  setSensitivityKpiVisible('SensTotalPV01', hasVisiblePV01 ? 1 : 0);
  setSensitivityKpiVisible('SensTopIRTenor', hasVisiblePV01 ? 1 : 0);
  setSensitivityKpiVisible('SensDuration', (hasVisiblePV01 && duration) ? 1 : 0);

  // if (DEBUG_SENS_KPI) {
  //   console.log('[SENS KPI] PV01 by CCY updated:', {
  //     selectedPort,
  //     pv01ByCcy,
  //     topIRTenorByCcy,
  //     pv01Rows: pv01Rows.length,
  //   });
  // }
} else {
  clearAndHideSensitivityKpi('SensTotalPV01');
  clearAndHideSensitivityKpi('SensTopIRTenor');
  clearAndHideSensitivityKpi('SensDuration');

  // if (DEBUG_SENS_KPI) {
  //   console.log('[SENS KPI] PV01 hidden: no data for selected portfolio', {
  //     selectedPort,
  //   });
  // }
}

// -------------------------------
// CPV01 KPI update
// -------------------------------
if (hasCPV01Data) {
  const safeCpv01SourceRows = Array.isArray(cpv01SourceRows)
    ? cpv01SourceRows
    : [];

  const cpv01ByCcy =
    cpv01CalcData?.cpv01TotalByCcy ||
    (
      cpv01RowsFromRiskStore.length > 0
        ? buildRiskTotalsByCcy(cpv01RowsFromRiskStore)
        : buildRiskTotalsByCcy(safeCpv01SourceRows)
    );

  const groupedCPV01ByCcy =
    cpv01CalcData?.groupedCPV01ByCcy ||
    (
      cpv01RowsFromRiskStore.length > 0
        ? buildCreditBucketSumsByCcy(cpv01RowsFromRiskStore)
        : buildCreditBucketSumsByCcy(safeCpv01SourceRows)
    );

  const topCreditBucketByCcy = formatTopCreditBucketByCcy(groupedCPV01ByCcy);
  const hasVisibleCPV01 = hasAnyNonZeroRiskByCcy(cpv01ByCcy);

  setKpiRelAbs(
    'SensTotalCPV01',
    formatRelByCcy(buildRelByCcy(cpv01ByCcy, notionalByCcy)),
    formatRiskByCcy(cpv01ByCcy)
  );
  setText('SensTopCreditBucket', topCreditBucketByCcy);

  // Credit spread duration (years) = |Σ CPV01| / Σ NAV × 10000 — analog to the
  // Overview "Credit Spread Duration" slider.
  const totalCpv01 = Object.values(cpv01ByCcy).reduce((s, v) => s + (Number(v) || 0), 0);
  const csDuration = navTotal ? (Math.abs(totalCpv01) / navTotal) * 10000 : 0;
  setText('SensCsDuration', csDuration ? `${formatNumber(csDuration, 2)} y` : '—');
  liveTotals.cpv01 = totalCpv01;
  liveTotals.csDuration = csDuration;

  setSensitivityKpiVisible('SensTotalCPV01', hasVisibleCPV01 ? 1 : 0);
  setSensitivityKpiVisible('SensTopCreditBucket', hasVisibleCPV01 ? 1 : 0);
  setSensitivityKpiVisible('SensCsDuration', (hasVisibleCPV01 && csDuration) ? 1 : 0);

  // if (DEBUG_SENS_KPI) {
  //   console.log('[SENS KPI] CPV01 by CCY updated:', {
  //     selectedPort,
  //     cpv01ByCcy,
  //     topCreditBucketByCcy,
  //     cpv01RowsFromRiskStore: cpv01RowsFromRiskStore.length,
  //     cpv01SourceRows: safeCpv01SourceRows.length,
  //   });
  // }
} else {
  clearAndHideSensitivityKpi('SensTotalCPV01');
  clearAndHideSensitivityKpi('SensTopCreditBucket');
  clearAndHideSensitivityKpi('SensCsDuration');

  // if (DEBUG_SENS_KPI) {
  //   console.log('[SENS KPI] CPV01 hidden: no data for selected portfolio', {
  //     selectedPort,
  //   });
  // }
}

  // -------------------------------
  // VEGA KPI update
  // -------------------------------
  if (hasExplicitVegaCalc || hasVegaRows) {
    const totalVega = hasExplicitVegaCalc
      ? Number(vegaCalcData.totalVega)
      : vegaRowsFromRiskStore.reduce((sum, row) => {
          return sum + getNumber(row, [
            'VALUE_BASE',
            'value_base',
            'VALUE_LOCAL',
            'value_local',
          ]);
        }, 0);

    const nomEur = Number(notionalByCcy?.EUR) || 0;
    const vegaRel = nomEur ? (totalVega / nomEur) * 10000 : 0;
    setKpiRelAbs(
      'SensTotalVega',
      vegaRel ? `${formatNumber(vegaRel, 2)} bp` : '—',
      formatNumber(totalVega, 0)
    );
    setSensitivityKpiVisible('SensTotalVega', totalVega);
    liveTotals.vega = totalVega;

    setSensitivityTabGroupVisible(
      ['VEGA', 'VEGA_PARALLEL', 'Vega'],
      Math.abs(Number(totalVega)) > 1e-12
    );

    // if (DEBUG_SENS_KPI) {
    //   console.log('[SENS KPI] VEGA updated:', {
    //     selectedPort,
    //     totalVega,
    //     visible: isMeaningfulSensitivityValue(totalVega),
    //     vegaRows: vegaRowsFromRiskStore.length,
    //   });
    // }
  } else {
    clearAndHideSensitivityKpi('SensTotalVega');

    setSensitivityTabGroupVisible(
      ['VEGA', 'VEGA_PARALLEL', 'Vega'],
      false
    );

    // if (DEBUG_SENS_KPI) {
    //   console.log('[SENS KPI] VEGA hidden: no data for selected portfolio', {
    //     selectedPort,
    //     vegaRows: vegaRowsFromRiskStore.length,
    //     vegaCalcData,
    //   });
    // }
  }

  // Vorperioden-Aenderung (Zeile 3): Live-Wert vs. letzte reale History-Periode.
  try { renderSensKpiChanges(selectedPort, liveTotals); } catch (e) { console.warn('[SENS KPI] change line failed', e); }

  // Report-Spiegel: Sensitivities-KPIs als verstecktes data-kpi-band (Preview/PDF).
  fillSensReportKpiBand();
}