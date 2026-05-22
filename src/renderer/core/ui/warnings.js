export function updateCurveWarningUI() {

  const warningContainer = document.getElementById("curveWarningContainer");
  const warningLight = document.getElementById("curveWarning");

  if (!warningContainer || !warningLight) return;

  const activeRows = window.appState?.getRatesActive?.() || [];

  const affected = activeRows.filter(
    r => (r.scenario_id || "BASE") !== "BASE"
  );

  if (affected.length > 0) {

    warningContainer.style.display = "flex";
    warningLight.style.backgroundColor = "red";

  } else {

    warningContainer.style.display = "none";
    warningLight.style.backgroundColor = "gray";

  }
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
  warningText.textContent = showWarning ? affected.join(" | ") : "";
  warningText.title = showWarning ? affected.join("\n") : "";
}

export function updateProductCSWarningUI(filteredProdData) {
  const warningContainer = document.getElementById('creditWarningContainer');
  const warningLight = document.getElementById('creditWarning');
  const warningText = document.getElementById('creditWarningText');

  if (!warningContainer || !warningLight || !warningText) {
    console.error('credit warning elements not found');
    return;
  }

  const affectedRows = filteredProdData.filter(
    (row) =>
      row.CS_Szenario !== null &&
      row.CS_Szenario !== undefined &&
      String(row.CS_Szenario).trim() !== ''
  );

  const affectedProdIds = affectedRows
    .map((row) => row.PROD_ID)
    .filter(Boolean);

  if (affectedProdIds.length > 0) {
    const count = affectedProdIds.length;

    warningContainer.style.display = 'flex';
    warningLight.style.backgroundColor = 'red';

    warningText.textContent = `${count} Product${count === 1 ? '' : 's'} affected`;
    warningText.title = affectedProdIds.join(', ');
  } else {
    warningContainer.style.display = 'none';
    warningLight.style.backgroundColor = 'transparent';
    warningText.textContent = '';
    warningText.title = '';
  }
}
