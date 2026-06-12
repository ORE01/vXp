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
  buildFactorRows,
  buildRiskTypeRows,
  toNumber,
} from './mvarTransforms.js';

import {
  destroyRiskTypeVaRRelChart,
  renderRiskTypeVaRRelChart,
} from './mvarCharts.js';


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

  const filteredRows = allRows.filter(row =>
    rowMatchesMvarContext(row, context)
  );

  console.log('[MVaR FactorPL] local context filter', {
    selectedPort: normalizePortfolioName(portName),
    selectedScenario: normalizeMvarText(scenarioName),
    allRows: allRows.length,
    filteredRows: filteredRows.length,
    availablePorts: getAvailableMvarPorts(allRows),
    availableScenarios: getAvailableMvarScenarios(allRows),
    sample: filteredRows[0] || allRows[0],
  });

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
  const filteredRows = getStoredRowsForCurrentContext();

  if (!Array.isArray(filteredRows) || filteredRows.length === 0) {
    destroyRiskTypeVaRRelChart();
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

  const confidence = getConfidence();
  const horizonDays = getHorizonDays();
  const denominator = getRelativeScaleDenominator();

  const riskTypeRows = buildRiskTypeRows(filteredRows, confidence, denominator, horizonDays);
  const factorRows = buildFactorRows(filteredRows, confidence, denominator, horizonDays);

  requestAnimationFrame(() => {
    renderRiskTypeVaRRelChart(riskTypeRows);
  });



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

  console.log('[MVaR FactorPL] rendered', {
    portName,
    scenarioName,
    confidence,
    horizonDays,
    denominator,
    storeRows: appState.getMvarFactorPLData?.()?.length || 0,
    filteredRows: filteredRows.length,
    riskTypeRows: riskTypeRows.length,
    factorRows: factorRows.length,
    sample: filteredRows[0],
  });
}

export function handleMVaRFactorPLData(receivedData) {
  const safeRows = Array.isArray(receivedData) ? receivedData : [];

  console.log('[MVaR FactorPL] handler called', {
    receivedRows: safeRows.length,
    receivedSample: safeRows[0],
    storeRows: appState.getMvarFactorPLData?.()?.length || 0,
    hasStoreGetter: typeof appState.getMvarFactorPLData === 'function',
  });

  renderMVaRFactorPLPanel();
}

