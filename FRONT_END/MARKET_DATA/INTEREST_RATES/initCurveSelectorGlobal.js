// initCurveSelectorGlobal.js
export function initCurveSelectorGlobal() {
  const sel = document.getElementById("ratesSelector");
  if (!sel) return;

  // initialen Wert aus appState setzen
  const current =
    (typeof appState.getSelectedCurve === "function" && appState.getSelectedCurve()) ||
    "EUSWAP";
  sel.value = current;

  // nur einmal binden
  if (sel.dataset.bound === "1") return;
  sel.dataset.bound = "1";

  sel.addEventListener("change", () => {
    const curve = sel.value || "EUSWAP";
    appState.setSelectedCurve(curve);

    // globaler Event
    document.dispatchEvent(
      new CustomEvent("curve:changed", { detail: { curve } })
    );
  });
}
