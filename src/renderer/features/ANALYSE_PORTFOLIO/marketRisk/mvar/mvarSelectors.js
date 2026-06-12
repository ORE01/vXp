'use strict';

export function normalizePortfolioName(portName) {
  return String(portName ?? '')
    .replace(/^Portfolios[_-]?/i, '')
    .trim();
}

export function normalizeMvarText(value) {
  return String(value ?? '')
    .trim()
    .toUpperCase();
}

export function getMvarRowPortfolioName(row) {
  return (
    row?.port_name ??
    row?.PORT_NAME ??
    row?.portfolio ??
    row?.PORTFOLIO ??
    row?.Portfolio ??
    row?.port ??
    row?.PORT ??
    ''
  );
}

export function getMvarRowScenarioName(row) {
  return (
    row?.scenario_name ??
    row?.SCENARIO_NAME ??
    row?.scenario ??
    row?.SCENARIO ??
    row?.Scenario ??
    row?.interval_name ??
    row?.INTERVAL_NAME ??
    row?.CSSzenario ??
    row?.CS_Szenario ??
    ''
  );
}

export function getMvarRowAsofDate(row) {
  return String(
    row?.asof_date ??
    row?.ASOF_DATE ??
    row?.AsofDate ??
    row?.date ??
    row?.DATE ??
    ''
  ).slice(0, 10);
}

export function getCurrentMvarContext(appState) {
  return {
    portName: appState?.getSelectedPortTableName?.() ?? null,
    scenarioName: appState?.selectedMvarInterval ?? null,
  };
}

export function rowMatchesMvarContext(row, { portName, scenarioName } = {}) {
  if (!row || !portName) {
    return false;
  }

  const selectedPort = normalizePortfolioName(portName);
  const selectedScenario = normalizeMvarText(scenarioName);

  const rowPort = normalizePortfolioName(getMvarRowPortfolioName(row));
  const rowScenario = normalizeMvarText(getMvarRowScenarioName(row));

  const portMatches = rowPort === selectedPort;

  const scenarioMatches =
    !selectedScenario ||
    rowScenario === selectedScenario;

  return portMatches && scenarioMatches;
}

export function getAvailableMvarPorts(rows) {
  return [
    ...new Set(
      (Array.isArray(rows) ? rows : []).map(row =>
        normalizePortfolioName(getMvarRowPortfolioName(row))
      )
    ),
  ];
}

export function getAvailableMvarScenarios(rows) {
  return [
    ...new Set(
      (Array.isArray(rows) ? rows : []).map(row =>
        normalizeMvarText(getMvarRowScenarioName(row))
      )
    ),
  ];
}