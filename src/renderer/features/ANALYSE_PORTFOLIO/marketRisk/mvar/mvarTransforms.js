'use strict';

export function toNumber(value, fallback = 0) {
  const n = Number(value);
  return Number.isFinite(n) ? n : fallback;
}

export function getFactorId(row) {
  return String(
    row?.factor_id ??
    row?.FACTOR_ID ??
    row?.risk_factor_id ??
    row?.RISK_FACTOR_ID ??
    ''
  ).trim();
}

export function getRiskTypeFromFactorId(factorId) {
  const value = String(factorId || '').trim();

  if (!value) return 'UNKNOWN';

  return value.includes(':')
    ? value.split(':')[0].toUpperCase().trim()
    : 'UNKNOWN';
}

export function getRowDate(row) {
  return String(
    row?.dt ??
    row?.DT ??
    row?.DATE ??
    row?.date ??
    row?.scenario_date ??
    row?.SCENARIO_DATE ??
    ''
  ).slice(0, 10);
}

export function getPLValue(row) {
  const raw =
    row?.pl ??
    row?.PL ??
    row?.factor_pl ??
    row?.FACTOR_PL ??
    row?.value ??
    row?.VALUE ??
    row?.pl_value ??
    row?.PL_VALUE ??
    row?.p_l ??
    row?.P_L ??
    0;

  return toNumber(raw, 0);
}

export function toRel(absValue, denominator) {
  if (!Number.isFinite(denominator) || denominator === 0) return null;
  return absValue / denominator;
}

export function lowerTailVaR(values, confidence, horizonDays = 1, debugLabel = 'UNKNOWN') {
  const rawValues = Array.isArray(values) ? values : [];

  const clean = rawValues
    .map(v => toNumber(v, NaN))
    .filter(Number.isFinite)
    .sort((a, b) => a - b);

  const totalObs = clean.length;

  if (!totalObs) {
    console.warn('[MVaR lowerTailVaR] no valid values', {
      debugLabel,
      rawRows: rawValues.length,
      confidence,
      horizonDays,
    });

    return {
      varAbs: null,
      esAbs: null,
      obs: 0,
      totalObs: 0,
      tailCount: 0,
      varIndex: null,
      var1d: null,
      es1d: null,
      scale: null,
      tailValues: [],
    };
  }

  const conf = toNumber(confidence, 0.99);
  const normalizedConfidence =
    conf > 1
      ? conf / 100
      : conf;

  const safeConfidence = Math.max(0, Math.min(1, normalizedConfidence));
  const tailProbability = Math.max(0, Math.min(1, 1 - safeConfidence));

  const tailCount = Math.max(
    1,
    Math.ceil(tailProbability * totalObs)
  );

  const varIndex = Math.max(
    0,
    Math.min(totalObs - 1, tailCount - 1)
  );

  const tail = clean.slice(0, tailCount);

  const var1d = clean[varIndex];

  const es1d = tail.length
    ? tail.reduce((sum, value) => sum + value, 0) / tail.length
    : var1d;

  const safeHorizonDays = Math.max(1, toNumber(horizonDays, 1));
  const scale = Math.sqrt(safeHorizonDays);

  const varAbs = var1d * scale;
  const esAbs = es1d * scale;

  // console.log('[MVaR lowerTailVaR DEBUG]', {
  //   debugLabel,

  //   rawRows: rawValues.length,
  //   validObs: totalObs,

  //   confidenceInput: confidence,
  //   confidenceUsed: safeConfidence,
  //   tailProbability,

  //   horizonDaysInput: horizonDays,
  //   horizonDaysUsed: safeHorizonDays,
  //   scale,

  //   tailCount,
  //   varIndex,

  //   worstValue: clean[0],
  //   var1d,
  //   es1d,

  //   varScaled: varAbs,
  //   esScaled: esAbs,

  //   first20SortedLosses: clean.slice(0, 20),
  //   tailValuesUsedForES: tail,
  // });

  return {
    varAbs,
    esAbs,
    obs: tailCount,
    totalObs,
    tailCount,
    varIndex,
    var1d,
    es1d,
    scale,
    tailValues: tail,
  };
}

function addToMap(map, key, value) {
  map.set(key, (map.get(key) || 0) + value);
}

export function buildDistributions(rows) {
  const totalByDate = new Map();
  const riskTypeByKey = new Map();
  const factorByKey = new Map();
  const factorMeta = new Map();

  for (const row of rows) {
    const date = getRowDate(row);
    const factorId = getFactorId(row);

    if (!date || !factorId) continue;

    const riskType = getRiskTypeFromFactorId(factorId);
    const pl = getPLValue(row);

    addToMap(totalByDate, date, pl);
    addToMap(riskTypeByKey, `${riskType}||${date}`, pl);
    addToMap(factorByKey, `${factorId}||${date}`, pl);

    if (!factorMeta.has(factorId)) {
      factorMeta.set(factorId, {
        factor_id: factorId,
        risk_type: riskType,
      });
    }
  }

  return {
    totalByDate,
    riskTypeByKey,
    factorByKey,
    factorMeta,
  };
}

export function buildRiskTypeRows(rows, confidence, denominator, horizonDays = 1) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const {
    totalByDate,
    riskTypeByKey,
  } = buildDistributions(safeRows);

  const valuesByRiskType = new Map();
  const totalValues = Array.from(totalByDate.values());

  if (totalValues.length) {
    valuesByRiskType.set('TOTAL', totalValues);
  }

  for (const [key, value] of riskTypeByKey.entries()) {
    const [riskType] = key.split('||');

    if (!valuesByRiskType.has(riskType)) {
      valuesByRiskType.set(riskType, []);
    }

    valuesByRiskType.get(riskType).push(value);
  }

  // console.log('[MVaR buildRiskTypeRows DEBUG] input/distribution', {
  //   inputRows: safeRows.length,
  //   confidence,
  //   horizonDays,
  //   denominator,

  //   totalDates: totalByDate.size,
  //   riskTypeDateKeys: riskTypeByKey.size,

  //   riskTypes: Array.from(valuesByRiskType.keys()),

  //   obsByRiskType: Array.from(valuesByRiskType.entries()).map(([riskType, values]) => ({
  //     riskType,
  //     valuesCount: values.length,
  //     min: values.length ? Math.min(...values) : null,
  //     max: values.length ? Math.max(...values) : null,
  //     first10Sorted: values
  //       .slice()
  //       .sort((a, b) => a - b)
  //       .slice(0, 10),
  //   })),
  // });

  return Array.from(valuesByRiskType.entries())
    .map(([riskType, values]) => {
      const stats = lowerTailVaR(
        values,
        confidence,
        horizonDays,
        `RiskType=${riskType}`
      );

      const result = {
        risk_type: riskType,
        obs: stats.obs,
        total_obs: stats.totalObs,
        tail_count: stats.tailCount,
        var_index: stats.varIndex,

        var_abs: stats.varAbs,
        var_rel: stats.varAbs == null ? null : toRel(stats.varAbs, denominator),

        es_abs: stats.esAbs,
        es_rel: stats.esAbs == null ? null : toRel(stats.esAbs, denominator),

        var_1d: stats.var1d,
        es_1d: stats.es1d,
        scale: stats.scale,
      };

      // console.log('[MVaR buildRiskTypeRows RESULT]', {
      //   riskType,
      //   result,
      // });

      return result;
    })
    .sort((a, b) => {
      if (a.risk_type === 'TOTAL') return -1;
      if (b.risk_type === 'TOTAL') return 1;

      return Math.abs(toNumber(b.var_abs, 0)) - Math.abs(toNumber(a.var_abs, 0));
    });
}

// Aggregiert die Faktor-P&L nach (risk_type x ccy) — factor_id = "RISK_TYPE:CCY:TENOR"
// (z.B. "IR:EUR:1Y"). Pro Gruppe wird die P&L je Datum summiert und daraus VaR/ES
// gerechnet (wie buildRiskTypeRows, nur zusaetzlich nach Waehrung getrennt).
export function buildRiskTypeCcyRows(rows, confidence, denominator, horizonDays = 1) {
  const safeRows = Array.isArray(rows) ? rows : [];
  const groupByKey = new Map();  // `${groupId}||${date}` -> summierte pl
  const meta = new Map();        // groupId -> { risk_type, ccy }

  for (const row of safeRows) {
    const date = getRowDate(row);
    const factorId = getFactorId(row);
    if (!date || !factorId) continue;
    const parts = factorId.split(':');
    const riskType = (parts[0] || 'UNKNOWN').toUpperCase().trim();
    const ccy = (parts[1] || '').toUpperCase().trim() || '—';
    const groupId = `${riskType}:${ccy}`;
    addToMap(groupByKey, `${groupId}||${date}`, getPLValue(row));
    if (!meta.has(groupId)) meta.set(groupId, { risk_type: riskType, ccy });
  }

  const valuesByGroup = new Map();
  for (const [key, value] of groupByKey.entries()) {
    const groupId = key.split('||')[0];
    if (!valuesByGroup.has(groupId)) valuesByGroup.set(groupId, []);
    valuesByGroup.get(groupId).push(value);
  }

  return Array.from(valuesByGroup.entries())
    .map(([groupId, values]) => {
      const stats = lowerTailVaR(values, confidence, horizonDays, `Group=${groupId}`);
      const m = meta.get(groupId) || {};
      return {
        factor_id: `${m.risk_type || ''} ${m.ccy || ''}`.trim(),
        risk_type: m.risk_type || 'UNKNOWN',
        ccy: m.ccy || '',
        var_abs: stats.varAbs,
        var_rel: stats.varAbs == null ? null : toRel(stats.varAbs, denominator),
        es_abs: stats.esAbs,
        es_rel: stats.esAbs == null ? null : toRel(stats.esAbs, denominator),
      };
    })
    .sort((a, b) => Math.abs(toNumber(b.var_abs, 0)) - Math.abs(toNumber(a.var_abs, 0)));
}

// Echter Risikobeitrag je Produkt zu einer Faktor-Gruppe (IR:CCY / CS:CCY).
// Idee: Faktor-P&L ist linear in der Sensitivitaet -> Produkt-Anteil an factorPL =
// factorPL x (Sensitivitaet_Produkt / Sum Sensitivitaet je Faktor). Am VaR-Szenario-
// Datum der Gruppe summieren die Produkt-P&L exakt zum Gruppen-VaR (Component-VaR);
// ES = Mittel ueber die Tail-Daten. Rueckgabe: Map(prod_id -> {var_contrib, es_contrib}).
// opts: { factorRows, sensRows (port-gefiltert), groupId "IR:EUR", confidence,
//         horizonDays, tradeToProd:Map(TRADE_ID->PROD_ID) }.
export function buildFactorGroupProductContrib(opts = {}) {
  const { factorRows = [], sensRows = [], groupId = '', confidence, horizonDays = 1, tradeToProd = new Map() } = opts;
  if (!groupId) return new Map();
  const riskType = groupId.split(':')[0];
  const sensRiskType = riskType === 'CS' ? 'CPV01' : (riskType === 'IR' ? 'PV01' : null);
  const prefix = `${groupId}:`;

  // 1) factor pl je (factor, date) + Gruppen-P&L je Datum
  const plByFactor = new Map();
  const groupPLByDate = new Map();
  for (const r of factorRows) {
    const fid = getFactorId(r);
    if (!fid.startsWith(prefix)) continue;
    const date = getRowDate(r); if (!date) continue;
    const pl = getPLValue(r);
    if (!plByFactor.has(fid)) plByFactor.set(fid, new Map());
    addToMap(plByFactor.get(fid), date, pl);
    addToMap(groupPLByDate, date, pl);
  }
  if (!groupPLByDate.size) return new Map();

  // 2) Sensitivitaeten je Faktor: trade -> value, Summe je Faktor
  const sensByFactor = new Map();
  const totalSens = new Map();
  for (const r of sensRows) {
    const rt = String(r.RISK_TYPE ?? r.risk_type ?? '').toUpperCase().trim();
    if (sensRiskType && rt !== sensRiskType) continue;
    const fid = String(r.RISK_FACTOR_ID ?? r.risk_factor_id ?? '').trim();
    if (!fid.startsWith(prefix) || !plByFactor.has(fid)) continue;
    const trade = String(r.TRADE_ID ?? r.trade_id ?? '');
    const val = toNumber(r.VALUE_BASE ?? r.value_base ?? r.VALUE_LOCAL ?? r.value_local, 0);
    if (!sensByFactor.has(fid)) sensByFactor.set(fid, new Map());
    addToMap(sensByFactor.get(fid), trade, val);
    addToMap(totalSens, fid, val);
  }

  // 3) Produkt-P&L je Datum = Sum_factor factorPL(date) x sensShare(trade,factor)
  const prodPLByDate = new Map();
  for (const [fid, tradeMap] of sensByFactor.entries()) {
    const tot = totalSens.get(fid) || 0;
    if (!tot) continue;
    const plDates = plByFactor.get(fid);
    for (const [trade, val] of tradeMap.entries()) {
      const share = val / tot;
      if (!share) continue;
      const prod = tradeToProd.get(trade) ?? tradeToProd.get(String(trade)) ?? `TRADE ${trade}`;
      if (!prodPLByDate.has(prod)) prodPLByDate.set(prod, new Map());
      const pm = prodPLByDate.get(prod);
      for (const [date, pl] of plDates.entries()) addToMap(pm, date, share * pl);
    }
  }

  // 4) VaR-/ES-Szenario-Datum aus der Gruppen-Verteilung (wie lowerTailVaR)
  const dates = [...groupPLByDate.keys()].sort((a, b) => groupPLByDate.get(a) - groupPLByDate.get(b));
  const N = dates.length;
  const conf = toNumber(confidence, 0.99);
  const nc = conf > 1 ? conf / 100 : conf;
  const tailCount = Math.max(1, Math.ceil(Math.max(0, Math.min(1, 1 - nc)) * N));
  const varDate = dates[Math.max(0, Math.min(N - 1, tailCount - 1))];
  const tailDates = dates.slice(0, tailCount);
  const scale = Math.sqrt(Math.max(1, toNumber(horizonDays, 1)));

  // 5) Component-VaR/ES je Produkt
  const out = new Map();
  for (const [prod, pm] of prodPLByDate.entries()) {
    const varC = (pm.get(varDate) || 0) * scale;
    let esSum = 0;
    for (const d of tailDates) esSum += (pm.get(d) || 0);
    out.set(prod, { var_contrib: varC, es_contrib: (esSum / tailDates.length) * scale });
  }
  return out;
}

export function buildFactorRows(rows, confidence, denominator, horizonDays = 1) {
  const safeRows = Array.isArray(rows) ? rows : [];

  const {
    factorByKey,
    factorMeta,
  } = buildDistributions(safeRows);

  const valuesByFactor = new Map();

  for (const [key, value] of factorByKey.entries()) {
    const [factorId] = key.split('||');

    if (!valuesByFactor.has(factorId)) {
      valuesByFactor.set(factorId, []);
    }

    valuesByFactor.get(factorId).push(value);
  }

  // console.log('[MVaR buildFactorRows DEBUG] input/distribution', {
  //   inputRows: safeRows.length,
  //   confidence,
  //   horizonDays,
  //   denominator,

  //   factorDateKeys: factorByKey.size,
  //   factors: valuesByFactor.size,

  //   obsByFactor: Array.from(valuesByFactor.entries()).map(([factorId, values]) => ({
  //     factorId,
  //     valuesCount: values.length,
  //     min: values.length ? Math.min(...values) : null,
  //     max: values.length ? Math.max(...values) : null,
  //     first10Sorted: values
  //       .slice()
  //       .sort((a, b) => a - b)
  //       .slice(0, 10),
  //   })),
  // });

  return Array.from(valuesByFactor.entries())
    .map(([factorId, values]) => {
      const stats = lowerTailVaR(
        values,
        confidence,
        horizonDays,
        `Factor=${factorId}`
      );

      const meta = factorMeta.get(factorId) || {
        factor_id: factorId,
        risk_type: getRiskTypeFromFactorId(factorId),
      };

      const result = {
        risk_type: meta.risk_type,
        factor_id: factorId,

        obs: stats.obs,
        total_obs: stats.totalObs,
        tail_count: stats.tailCount,
        var_index: stats.varIndex,

        var_abs: stats.varAbs,
        var_rel: stats.varAbs == null ? null : toRel(stats.varAbs, denominator),

        es_abs: stats.esAbs,
        es_rel: stats.esAbs == null ? null : toRel(stats.esAbs, denominator),

        var_1d: stats.var1d,
        es_1d: stats.es1d,
        scale: stats.scale,
      };

      // console.log('[MVaR buildFactorRows RESULT]', {
      //   factorId,
      //   riskType: meta.risk_type,
      //   result,
      // });

      return result;
    })
    .sort((a, b) =>
      Math.abs(toNumber(b.var_abs, 0)) - Math.abs(toNumber(a.var_abs, 0))
    );
}