export function updateCurveWarningUI() {

  const warningContainer = document.getElementById("curveWarningContainer");
  const warningLight     = document.getElementById("curveWarning");

  if (!warningContainer || !warningLight) return;

  const activeRows = window.appState?.getRatesActive?.() || [];

  const affected = activeRows.filter(
    r => (r.scenario_id || "BASE") !== "BASE"
  );

  if (affected.length > 0) {

    warningContainer.style.visibility = "visible";
    warningLight.style.backgroundColor = "red";

  } else {

    warningContainer.style.visibility = "hidden";
    warningLight.style.backgroundColor = "gray";

  }

}