import * as portfolioRiskSensitivitiesStoreModule from '../../core/state/stores/portfolioRiskSensitivitiesStore.js';

const portfolioRiskSensitivitiesStore =
  portfolioRiskSensitivitiesStoreModule.portfolioRiskSensitivitiesStore ||
  portfolioRiskSensitivitiesStoreModule.default ||
  portfolioRiskSensitivitiesStoreModule;

const DEBUG_PORT_RISK_ENRICHMENT = true;
const ZERO_EPSILON = 1e-12;

const RISK_DISPLAY_ALIASES = {
  PV01: 'PV01',
  CPV01: 'CPV01',
  VEGA_PARALLEL: 'VEGA',
  VEGA: 'VEGA',
  FX_DELTA: 'FX',
  FX_VEGA: 'FX VEGA',
};

const pf = (value) => {
  if (value === null || value === undefined || value === '') return 0;

  const n = parseFloat(String(value).replace(/\s/g, '').replace(',', '.'));

  return Number.isFinite(n) ? n : 0;
};

const fmtRel = (value) => {
  if (!Number.isFinite(value)) return '-';
  return value.toFixed(3);
};

function normalizeTradeId(value) {
  return String(value ?? '').trim();
}

function normalizePortName(value) {
  return String(value ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim()
    .toUpperCase();
}

function normalizeRiskType(value) {
  return String(value ?? '').trim().toUpperCase();
}

function normalizeCcy(value) {
  return String(value ?? '').trim().toUpperCase();
}

function getRiskRows() {
  return portfolioRiskSensitivitiesStore?.getRows?.() || [];
}

function getRiskValueBase(row) {
  const base = pf(row?.VALUE_BASE ?? row?.value_base);

  if (Math.abs(base) > ZERO_EPSILON) {
    return base;
  }

  return pf(row?.VALUE_LOCAL ?? row?.value_local);
}

function getRiskValueLocal(row) {
  return pf(row?.VALUE_LOCAL ?? row?.value_local);
}

function getRiskDisplayName(riskType) {
  const normalized = normalizeRiskType(riskType);
  return RISK_DISPLAY_ALIASES[normalized] || normalized;
}

function addToSetObject(target, key, value) {
  if (!value) return;

  if (!target[key]) {
    target[key] = new Set();
  }

  target[key].add(value);
}

function convertSetObjectsToArrays(summary) {
  ['ccysByRiskType', 'baseCcysByRiskType', 'factorsByRiskType'].forEach((groupKey) => {
    Object.keys(summary[groupKey] || {}).forEach((riskType) => {
      summary[groupKey][riskType] = Array.from(summary[groupKey][riskType]);
    });
  });

  return summary;
}

function buildRiskSummaryByTrade({
  riskRows = [],
  portName = null,
} = {}) {
  const normalizedPortName = normalizePortName(portName);
  const byTradeId = new Map();

  riskRows.forEach((row) => {
    const rowPortName = normalizePortName(row?.PORT_NAME ?? row?.port_name);

    if (normalizedPortName && rowPortName !== normalizedPortName) {
      return;
    }

    const tradeId = normalizeTradeId(row?.TRADE_ID ?? row?.trade_id);
    const riskType = normalizeRiskType(row?.RISK_TYPE ?? row?.risk_type);

    if (!tradeId || !riskType) return;

    const ccy = normalizeCcy(row?.CCY ?? row?.ccy);
    const baseCcy = normalizeCcy(row?.BASE_CCY ?? row?.base_ccy);
    const riskFactorId = String(row?.RISK_FACTOR_ID ?? row?.risk_factor_id ?? '').trim();

    if (!byTradeId.has(tradeId)) {
      byTradeId.set(tradeId, {
        totalsBase: {},
        totalsLocal: {},
        ccysByRiskType: {},
        baseCcysByRiskType: {},
        factorsByRiskType: {},
        rowCountByRiskType: {},
      });
    }

    const summary = byTradeId.get(tradeId);

    summary.totalsBase[riskType] =
      (summary.totalsBase[riskType] || 0) + getRiskValueBase(row);

    summary.totalsLocal[riskType] =
      (summary.totalsLocal[riskType] || 0) + getRiskValueLocal(row);

    summary.rowCountByRiskType[riskType] =
      (summary.rowCountByRiskType[riskType] || 0) + 1;

    addToSetObject(summary.ccysByRiskType, riskType, ccy);
    addToSetObject(summary.baseCcysByRiskType, riskType, baseCcy);
    addToSetObject(summary.factorsByRiskType, riskType, riskFactorId);
  });

  byTradeId.forEach((summary, tradeId) => {
    byTradeId.set(tradeId, convertSetObjectsToArrays(summary));
  });

  return byTradeId;
}

function buildRiskSummaryLabel(riskSummary) {
  const riskTypes = Object.entries(riskSummary?.totalsBase || {})
    .filter(([, value]) => {
      const numeric = Number(value);
      return Number.isFinite(numeric) && Math.abs(numeric) > ZERO_EPSILON;
    })
    .map(([riskType]) => getRiskDisplayName(riskType));

  if (!riskTypes.length) return '—';

  return Array.from(new Set(riskTypes)).join(' / ');
}

function calculateRiskDisplayValue(baseValue, notional) {
  const n = pf(notional);

  if (!n) return '-';

  return fmtRel((baseValue / n) * 10000);
}

function buildDisplayRiskFields({
  riskSummary = null,
  notional = 0,
} = {}) {
  const result = {};

  if (!riskSummary) return result;

  Object.entries(riskSummary.totalsBase || {}).forEach(([riskType, baseValue]) => {
    const displayName = getRiskDisplayName(riskType);

    result[displayName] = calculateRiskDisplayValue(baseValue, notional);
    result[`${displayName}_BASE`] = baseValue;
  });

  return result;
}

function buildRiskDebugSummary(riskSummary) {
  if (!riskSummary) return null;

  return Object.keys(riskSummary.totalsBase || {}).reduce((acc, riskType) => {
    acc[riskType] = {
      display: getRiskDisplayName(riskType),
      totalBase: riskSummary.totalsBase[riskType],
      totalLocal: riskSummary.totalsLocal[riskType],
      ccys: riskSummary.ccysByRiskType[riskType] || [],
      baseCcys: riskSummary.baseCcysByRiskType[riskType] || [],
      factors: riskSummary.factorsByRiskType[riskType] || [],
      rows: riskSummary.rowCountByRiskType[riskType] || 0,
    };

    return acc;
  }, {});
}

export function getTradeRiskTotalBase(portName, tradeId, riskType) {
  const riskSummaryByTrade = buildRiskSummaryByTrade({
    riskRows: getRiskRows(),
    portName,
  });

  const summary = riskSummaryByTrade.get(normalizeTradeId(tradeId));
  const normalizedRiskType = normalizeRiskType(riskType);

  return summary?.totalsBase?.[normalizedRiskType] || 0;
}

export function getTradePV01Base(portName, tradeId) {
  return getTradeRiskTotalBase(portName, tradeId, 'PV01');
}

export function getTradeCPV01Base(portName, tradeId) {
  return getTradeRiskTotalBase(portName, tradeId, 'CPV01');
}

export function enrichPortfolioRowsWithRisk(receivedData, portName) {
  if (!Array.isArray(receivedData)) return [];

  const riskRows = getRiskRows();

  const riskSummaryByTrade = buildRiskSummaryByTrade({
    riskRows,
    portName,
  });

  if (DEBUG_PORT_RISK_ENRICHMENT) {
    console.log('[PORT RISK ENRICHMENT] start', {
      portName,
      normalizedPortName: normalizePortName(portName),
      portfolioRows: receivedData.length,
      riskRows: riskRows.length,
      riskTradeCount: riskSummaryByTrade.size,
      riskPorts: Array.from(new Set(riskRows.map(r => r.PORT_NAME ?? r.port_name))).slice(0, 10),
    });
  }

  return receivedData.map((row) => {
    const tradeId = normalizeTradeId(row?.TRADE_ID ?? row?.trade_id);
    const notional = pf(row?.NOTIONAL ?? row?.notional);
    const nav = pf(row?.NAV ?? row?.nav);

    const riskSummary = riskSummaryByTrade.get(tradeId) || null;
    const displayRiskFields = buildDisplayRiskFields({
      riskSummary,
      notional,
    });

    const pv01Base = riskSummary?.totalsBase?.PV01 || 0;
    const cpv01Base = riskSummary?.totalsBase?.CPV01 || 0;

    const enrichedRow = {
      ...row,

      ...displayRiskFields,

      RISK_SUMMARY: buildRiskSummaryLabel(riskSummary),
      RISK_TOTALS_BASE: riskSummary?.totalsBase || {},
      RISK_TOTALS_LOCAL: riskSummary?.totalsLocal || {},
      RISK_CCYS: riskSummary?.ccysByRiskType || {},
      RISK_BASE_CCYS: riskSummary?.baseCcysByRiskType || {},
      RISK_FACTORS: riskSummary?.factorsByRiskType || {},
      RISK_ROW_COUNTS: riskSummary?.rowCountByRiskType || {},

      // Übergang: bleibt noch verfügbar, bis die Tabelle auf Drawer-only umgestellt ist
      PV01rel: nav ? fmtRel((pv01Base / nav) * 10000) : '-',
      CPV01rel: nav ? fmtRel((cpv01Base / nav) * 10000) : '-',
    };

    if (DEBUG_PORT_RISK_ENRICHMENT && String(tradeId).trim() === '14632') {
      console.log('[PORT RISK ENRICHMENT] trade 14632', {
        row,
        portName,
        tradeId,
        notional,
        nav,
        riskSummary: buildRiskDebugSummary(riskSummary),
        enrichedRow,
      });
    }

    return enrichedRow;
  });
}