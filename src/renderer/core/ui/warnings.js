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
