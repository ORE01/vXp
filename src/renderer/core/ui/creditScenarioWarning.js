export function updateCreditScenarioWarningUI(rows = []) {

  const warningContainer = document.getElementById("creditWarningContainer");
  const warningLight     = document.getElementById("creditWarning");

  if (!warningContainer || !warningLight) return;

  // erstes Szenario = Default
  const active = rows.find((r, i) => i === 0);

  const nonDefault = rows.find(
    (r, i) => i !== 0 && r.active === true
  );

  if (nonDefault) {

    warningContainer.style.visibility = "visible";
    warningLight.style.backgroundColor = "red";

  } else {

    warningContainer.style.visibility = "hidden";
    warningLight.style.backgroundColor = "transparent";

  }

}