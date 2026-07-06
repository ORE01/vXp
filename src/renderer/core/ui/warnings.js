export function updateCurveWarningUI() {
  const warningContainer = document.getElementById("curveWarningContainer");
  const warningLight = document.getElementById("curveWarning");
  const warningText = document.getElementById("curveWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  const activeRows = window.appState?.getRatesActive?.() || [];

  const affected = activeRows
    .filter(r => String(r?.scenario_id || "BASE").trim() !== "BASE")
    .map(r => {
      const ccy = String(r?.ccy || "").trim().toUpperCase();
      const curveId = String(r?.curve_id || "").trim();
      const scenario = String(r?.scenario_id || "").trim();

      if (curveId && scenario) return `${curveId}: ${scenario}`;
      if (ccy && scenario) return `${ccy}: ${scenario}`;
      return scenario;
    })
    .filter(Boolean);

  const showWarning = affected.length > 0;

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Curve Scenario Set";
  warningText.title = showWarning ? affected.join("\n") : "";
}

export function updateCSScenarioWarningUI() {
  const warningContainer = document.getElementById("csWarningContainer");
  const warningLight = document.getElementById("csWarning");
  const warningText = document.getElementById("csWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  const appState = window.appState;
  if (!appState) return;

  const activeRows = appState.getCSActive?.() || [];

  const affected = activeRows
    .filter(r => String(r?.scenario_id || "BASE").trim() !== "BASE")
    .map(r => {
      const ccy = String(r?.ccy || "").trim().toUpperCase();
      const scenario = String(r?.scenario_id || "").trim();
      return ccy ? `${ccy}: ${scenario}` : scenario;
    })
    .filter(Boolean);

  const showWarning = affected.length > 0;

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Credit Spread Scenario Set";
  warningText.title = showWarning ? affected.join("\n") : "";
}

export function updateProductCSWarningUI(filteredProdData) {
  const warningContainer = document.getElementById("creditWarningContainer");
  const warningLight = document.getElementById("creditWarning");
  const warningText = document.getElementById("creditWarningText");

  if (!warningContainer || !warningLight || !warningText) {
    console.error("credit warning elements not found");
    return;
  }

  const rows = Array.isArray(filteredProdData) ? filteredProdData : [];

  const affectedRows = rows.filter(
    row =>
      row.CS_Szenario !== null &&
      row.CS_Szenario !== undefined &&
      String(row.CS_Szenario).trim() !== ""
  );

  const affected = affectedRows
    .map(row => {
      const prodId = String(row.PROD_ID || "").trim();
      const value = String(row.CS_Szenario || "").trim();

      if (prodId && value) return `${prodId}: ${value} bp`;
      if (prodId) return prodId;
      return "";
    })
    .filter(Boolean);

  const showWarning = affected.length > 0;

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "CS Override for ID Set";
  warningText.title = showWarning ? affected.join("\n") : "";
}

export function updateFactorMapScenarioWarningUI() {
  const warningContainer = document.getElementById("factorMapWarningContainer");
  const warningLight = document.getElementById("factorMapWarning");
  const warningText = document.getElementById("factorMapWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  // Aktives Factor-Mapping-Szenario (vom Factor-Mapping-Panel gesetzt).
  let active = "default";
  try { active = localStorage.getItem("mvarFactorMapActiveScenario") || "default"; }
  catch (_) {}
  active = String(active).trim() || "default";

  const showWarning = active !== "default";

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Factor Mapping Scenario Set";
  warningText.title = showWarning ? active : "";
}

export function updatePdHistScenarioWarningUI() {
  const warningContainer = document.getElementById("pdHistWarningContainer");
  const warningLight = document.getElementById("pdHistWarning");
  const warningText = document.getElementById("pdHistWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  // Aktives Historical-PD-Szenario aus PD_HIST_ACTIVE (eine Zeile).
  const activeRows = window.appState?.getPDHistActive?.() || [];
  const active = String(activeRows[0]?.scenario_id || "BASE").trim() || "BASE";

  const showWarning = active !== "BASE";

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "PD Scenario Set";
  warningText.title = showWarning ? active : "";
}

export function updateVolScenarioWarningUI() {
  const warningContainer = document.getElementById("volWarningContainer");
  const warningLight = document.getElementById("volWarning");
  const warningText = document.getElementById("volWarningText");

  if (!warningContainer || !warningLight || !warningText) return;

  const activeRows = window.appState?.getSwaptionActive?.() || [];

  const affected = activeRows
    .filter(r => String(r?.scenario_id || "BASE").trim() !== "BASE")
    .map(r => {
      const ccy = String(r?.ccy || "").trim().toUpperCase();
      const scenario = String(r?.scenario_id || "").trim();
      return ccy ? `${ccy}: ${scenario}` : scenario;
    })
    .filter(Boolean);

  const showWarning = affected.length > 0;

  warningContainer.style.display = showWarning ? "flex" : "none";
  warningLight.style.backgroundColor = showWarning ? "red" : "transparent";

  warningText.textContent = "Vol Scenario Set";
  warningText.title = showWarning ? affected.join("\n") : "";
}
