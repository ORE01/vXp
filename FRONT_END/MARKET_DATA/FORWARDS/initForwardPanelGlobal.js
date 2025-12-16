// initForwardPanelGlobal.js
import { handleFWDData } from "./forwards.js";
import { handleSwapForwardCurve } from "./forwards.js";

export function initForwardPanelGlobalOnce() {
  const root = document.getElementById("panel-forward");
  if (!root) return;

  // nur 1x binden
  if (root.dataset.bound === "1") return;
  root.dataset.bound = "1";

  const btnCMS1 = root.querySelector("#CMSButton1");
  const btnCMS2 = root.querySelector("#CMSButton2");
  const btnYears = root.querySelector("#applyYearsForwardButton");

  btnCMS1?.addEventListener("click", () => {
    // nutzt EUSW + selectedCurve, weil handleFWDData das jetzt so macht
    handleFWDData();
  });

  btnCMS2?.addEventListener("click", () => {
    handleFWDData();
  });

  btnYears?.addEventListener("click", () => {
    // zweiter Chart
    handleSwapForwardCurve();
  });
}
